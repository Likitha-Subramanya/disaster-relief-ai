import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getAdminUsers,
  getCurrentAdmin,
  getNgoUsers,
  getVictimRequests,
  VictimRequest,
  NgoUser,
  assignNgoToVictim,
  deleteNgo,
  adminAddNgo,
  logoutAll,
  ensureAllNgoCoords,
} from '../store/rescue'
import { MapContainer, Marker, Popup, TileLayer, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { geocodeAddress } from '../services/geocode'
 

export default function AdminDashboard() {
  const navigate = useNavigate()
  const admin = getCurrentAdmin()
  const [victims, setVictims] = useState<VictimRequest[]>([])
  const [tab, setTab] = useState<'overview' | 'ngos' | 'victims' | 'manageNgos'>('overview')
  const [selectedNgoFilter, setSelectedNgoFilter] = useState<string>('all')

  const [ngos, setNgos] = useState(() => getNgoUsers())

  // Reload NGOs from storage when changes occur (best-effort)
  useEffect(() => {
    const id = setInterval(() => setNgos(getNgoUsers()), 2000)
    return () => clearInterval(id)
  }, [])
  const admins = getAdminUsers()

  const [newNgoName, setNewNgoName] = useState('')
  const [newNgoEmail, setNewNgoEmail] = useState('')
  const [newNgoPassword, setNewNgoPassword] = useState('')
  const [newNgoPhone, setNewNgoPhone] = useState('')
  const [newNgoLocation, setNewNgoLocation] = useState('')
  const [newNgoServices, setNewNgoServices] = useState('')
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const serviceOptions = useMemo(() => [
    'Fire Rescue',
    'Gas Control',
    'Blast Rescue',
    'Electrical Safety',
    'Search & Rescue',
    'Structural Safety',
    'Debris Removal',
    'Accident Rescue',
    'Emergency Aid',
    'Medical Aid',
    'Chemical Handling',
    'Hazard Control',
    'Toxic Fume Control',
    'Construction Safety',
    'Crowd Control',
    'Public Safety',
    'Victim Extraction',
    'Medical Emergency Support',
    'First Aid',
    'Life Support',
    'Flood Rescue',
    'Water Removal',
    'Landslide Clearance',
    'Storm Response',
    'Shelter Support',
    'Evacuation Support',
  ], [])
  const [manageError, setManageError] = useState<string | null>(null)
  const [geocoding, setGeocoding] = useState(false)

  useEffect(() => {
    const load = () => {
      setVictims(getVictimRequests())
    }
    load()
    const id = setInterval(load, 4000)
    return () => clearInterval(id)
  }, [])

  // Map markers state (overview)
  const [ngoPoints, setNgoPoints] = useState<Array<{ id: string; name: string; lat: number; lng: number; label: string }>>([])
  const [victimPoints, setVictimPoints] = useState<Array<{ id: string; name: string; lat: number; lng: number; label: string }>>([])
  const cacheKey = 'resc_geocode_cache'
  function readCache(): Record<string, { lat: number; lng: number; displayName: string }> {
    try { const raw = localStorage.getItem(cacheKey); return raw ? JSON.parse(raw) : {} } catch { return {} }
  }
  function writeCache(data: Record<string, { lat: number; lng: number; displayName: string }>) {
    localStorage.setItem(cacheKey, JSON.stringify(data))
  }
  const greenIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
  })

  function parseLatLng(raw?: string | null) {
    if (!raw) return null
    const match = String(raw).trim().match(/(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)/)
    if (!match) return null
    const lat = Number(match[1]); const lng = Number(match[2])
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    return { lat, lng }
  }

  // Manage NGOs: map-based location selection
  const [manageLocationMode, setManageLocationMode] = useState<'enter' | 'detect' | 'map'>('enter')
  const [manageCoords, setManageCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [manageGpsStatus, setManageGpsStatus] = useState<'idle' | 'locating' | 'ready' | 'error'>('idle')
  const [manageAddress, setManageAddress] = useState('')

  function MapClickSetterManage({ enabled }: { enabled: boolean }) {
    useMapEvents({
      click: async (e) => {
        if (!enabled) return
        const lat = e.latlng.lat
        const lng = e.latlng.lng
        setManageCoords({ lat, lng })
        setManageGpsStatus('ready')
        try {
          const nice = await reverseGeocodeSimple(lat, lng)
          const base = nice || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
          if (nice) setManageAddress(nice); else setManageAddress('')
          setNewNgoLocation(`${base} (${lat.toFixed(5)}, ${lng.toFixed(5)})`)
        } catch {
          const base = `${lat.toFixed(5)}, ${lng.toFixed(5)}`
          setManageAddress('')
          setNewNgoLocation(`${base} (${lat.toFixed(5)}, ${lng.toFixed(5)})`)
        }
      }
    })
    return null
  }

  async function reverseGeocodeSimple(lat: number, lng: number): Promise<string | undefined> {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
      if (!res.ok) return undefined
      const js = await res.json()
      return js?.display_name || undefined
    } catch {
      return undefined
    }
  }

  function handleManageDetect() {
    setManageLocationMode('detect')
    if (!('geolocation' in navigator)) {
      setManageGpsStatus('error')
      return
    }
    setManageGpsStatus('locating')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        setManageCoords({ lat, lng })
        setManageGpsStatus('ready')
        const nice = await reverseGeocodeSimple(lat, lng)
        const baseLabel = nice || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
        if (nice) setManageAddress(nice); else setManageAddress('')
        setNewNgoLocation(`${baseLabel} (${lat.toFixed(5)}, ${lng.toFixed(5)})`)
      },
      () => setManageGpsStatus('error')
    )
  }
  const redIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
  })

  useEffect(() => {
    let mounted = true
    const cache = readCache()
    async function geocodeAll() {
      // NGOs
      const ngoOut: Array<{ id: string; name: string; lat: number; lng: number; label: string }> = []
      for (const n of ngos) {
        const key = (n.location || n.address || '').trim()
        if (!key) continue
        if (!cache[key]) {
          try { const res = await geocodeAddress(key); if (res) cache[key] = { lat: res.lat, lng: res.lng, displayName: res.displayName } } catch {}
        }
        if (cache[key]) ngoOut.push({ id: n.id, name: n.name, lat: cache[key].lat, lng: cache[key].lng, label: cache[key].displayName })
      }

      // Victims
      const vicOut: Array<{ id: string; name: string; lat: number; lng: number; label: string }> = []
      for (const v of victims) {
        const key = (v.location || '').trim()
        if (!key) continue
        // try parse coordinates in text "(lat, lng)"
        const m = key.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/)
        if (m) {
          const lat = parseFloat(m[1]); const lng = parseFloat(m[2])
          if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
            vicOut.push({ id: v.id, name: v.victimName, lat, lng, label: key })
            continue
          }
        }
        if (!cache[key]) {
          try { const res = await geocodeAddress(key); if (res) cache[key] = { lat: res.lat, lng: res.lng, displayName: res.displayName } } catch {}
        }
        if (cache[key]) vicOut.push({ id: v.id, name: v.victimName, lat: cache[key].lat, lng: cache[key].lng, label: cache[key].displayName })
      }

      writeCache(cache)
      if (mounted) { setNgoPoints(ngoOut); setVictimPoints(vicOut) }
    }
    geocodeAll()
    // re-run when ngo/victim lists change
  }, [ngos.length, victims.length])

  if (!admin) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white via-secondary/40 to-white text-slate-700 flex items-center justify-center px-4 py-10">
        <div className="bg-white border border-blue-100 rounded-2xl p-6 md:p-8 shadow-card max-w-xl w-full text-center space-y-4">
          <p className="text-xs font-semibold tracking-[0.3em] text-slate-400 uppercase">Admin console</p>
          <h1 className="text-2xl font-semibold text-slate-800">Admin Dashboard</h1>
          <p className="text-sm text-slate-500">Please sign in as Admin to monitor NGOs and operations.</p>
          <button className="button-primary w-full" onClick={() => navigate('/admin/login')}>
            Go to Admin Sign In
          </button>
        </div>
      </div>
    )
  }

  const activeTasks = victims.filter(v => v.status !== 'completed')
  const completedTasks = victims.filter(v => v.status === 'completed')

  function getNgoById(id: string | undefined): NgoUser | undefined {
    if (!id) return undefined
    return ngos.find(n => n.id === id)
  }

  // Removed reassignment control per requirement

  function handleDeleteNgo(id: string) {
    if (!window.confirm('Remove this NGO from the system?')) return
    deleteNgo(id)
    // Refresh local state
    setNgos(getNgoUsers())
  }

  function handleAddNgo(e: React.FormEvent) {
    e.preventDefault()
    setManageError(null)
    if (!newNgoName.trim() || !newNgoEmail.trim() || !newNgoPassword.trim()) {
      setManageError('Name, email, and password are required to add an NGO')
      return
    }
    const res = adminAddNgo({
      name: newNgoName.trim(),
      email: newNgoEmail.trim(),
      password: newNgoPassword,
      phone: newNgoPhone.trim() || 'Not provided',
      address: newNgoLocation.trim() || 'Not provided',
      location: newNgoLocation.trim() || 'Not provided',
      serviceType: (selectedServices.length ? selectedServices.join(', ') : (newNgoServices.trim() || 'General support')),
    })
    if (!res.ok) {
      setManageError(res.error)
      return
    }
    setNewNgoName('')
    setNewNgoEmail('')
    setNewNgoPassword('')
    setNewNgoPhone('')
    setNewNgoLocation('')
    setNewNgoServices('')
    // Refresh local state so the table and maps reflect the new NGO
    setNgos(getNgoUsers())
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-secondary/40 to-white text-slate-700 px-4 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.3em] text-slate-400 uppercase">Admin console</p>
            <h1 className="text-3xl font-semibold text-slate-800">Admin Dashboard</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1.5 rounded-full border border-blue-100 bg-white text-xs text-slate-600"
              onClick={() => setTab('overview')}
            >
              Overview
            </button>
            <button
              className="px-3 py-1.5 rounded-full border border-danger/50 text-xs text-danger"
              onClick={() => { logoutAll(); navigate('/') }}
            >
              Logout
            </button>
          </div>
        </div>
        <div className="flex gap-2 text-xs mb-6 max-w-6xl mx-auto">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'ngos', label: 'NGOs' },
            { id: 'victims', label: 'Victims' },
            { id: 'manageNgos', label: 'Manage NGOs' },
          ].map(item => (
            <button
              key={item.id}
              className={`px-3 py-1.5 rounded-full border ${
                tab === item.id ? 'border-primary bg-primary/20 text-primary' : 'border-slate-100 text-slate-500'
              }`}
              onClick={() => setTab(item.id as any)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <section className="bg-white border border-blue-100 rounded-2xl p-5 shadow-card">
              <h2 className="text-lg font-semibold mb-2">Summary</h2>
              <ul className="text-sm space-y-1">
                <li>Total NGOs: {ngos.length}</li>
                <li>Total victim requests: {victims.length}</li>
                <li>Active requests: {activeTasks.length}</li>
                <li>Completed requests: {completedTasks.length}</li>
              </ul>
            </section>
            <section className="bg-white border border-blue-100 rounded-2xl p-5 shadow-card md:col-span-1 lg:col-span-2">
              <h2 className="text-lg font-semibold mb-2">Recent Victim Requests</h2>
              {victims.length === 0 ? (
                <p className="text-sm text-slate-500">As victims submit requests, they will appear here.</p>
              ) : (
                <div className="max-h-64 overflow-auto text-sm">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-blue-50 text-slate-600">
                      <tr>
                        <th className="px-2 py-1">Name</th>
                        <th className="px-2 py-1">Disaster</th>
                        <th className="px-2 py-1">Status</th>
                        <th className="px-2 py-1">Assigned NGO</th>
                        <th className="px-2 py-1">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {victims.map(v => {
                        const aNgo = getNgoById(v.assignedNgoId)
                        return (
                          <tr key={v.id} className="border-b border-blue-50">
                            <td className="px-2 py-1">{v.victimName}</td>
                            <td className="px-2 py-1 text-[11px]">{v.disasterRaw ? v.disasterRaw : v.disasterType.replace('_', ' ').toUpperCase()}</td>
                            <td className="px-2 py-1 text-[11px] capitalize">{v.status.replace('_', ' ')}</td>
                            <td className="px-2 py-1 text-[11px]">{aNgo ? aNgo.name : 'Unassigned'}</td>
                            <td className="px-2 py-1 text-[11px]">{new Date(v.createdAt).toLocaleString()}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
            <section className="bg-white border border-blue-100 rounded-2xl p-5 shadow-card md:col-span-3">
              <h2 className="text-lg font-semibold mb-2">Live Map: NGOs (green) and Victims (red)</h2>
              <div className="h-72 rounded-xl overflow-hidden border border-blue-100">
                <MapContainer center={[12.9716, 77.5946]} zoom={11} style={{ height: '100%', width: '100%' }}>
                  <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  {ngoPoints.map(p => (
                    <Marker key={`ngo_${p.id}`} position={[p.lat, p.lng]} icon={greenIcon}>
                      <Popup>
                        <div className="text-xs"><div className="font-semibold">{p.name}</div><div className="opacity-70">{p.label}</div></div>
                      </Popup>
                    </Marker>
                  ))}
                  {/* Fallback: render NGO markers directly from `ngos` when not present in cached ngoPoints */}
                  {ngos.map(ngo => {
                    if (ngoPoints.some(p => p.id === ngo.id)) return null
                    const lat = typeof (ngo as any).lat === 'number' ? (ngo as any).lat : null
                    const lng = typeof (ngo as any).lng === 'number' ? (ngo as any).lng : null
                    let final = null as null | { lat: number; lng: number }
                    if (lat !== null && lng !== null) final = { lat, lng }
                    else {
                      const p = parseLatLng(ngo.location) || parseLatLng(ngo.address)
                      if (p) final = p
                    }
                    if (!final) return null
                    return (
                      <Marker key={`ngo_fallback_${ngo.id}`} position={[final.lat, final.lng]} icon={greenIcon}>
                        <Popup>
                          <div className="text-xs"><div className="font-semibold">{ngo.name}</div><div className="opacity-70">{ngo.address || ngo.location}</div></div>
                        </Popup>
                      </Marker>
                    )
                  })}
                  {victimPoints.map(p => (
                    <Marker key={`vic_${p.id}`} position={[p.lat, p.lng]} icon={redIcon}>
                      <Popup>
                        <div className="text-xs"><div className="font-semibold">{p.name}</div><div className="opacity-70">{p.label}</div></div>
                      </Popup>
                    </Marker>
                  ))}
                  {/* Fallback: render victim markers from `victims` when not present in cached victimPoints */}
                  {victims.map(v => {
                    if (victimPoints.some(p => p.id === v.id)) return null
                    const p = parseLatLng(v.location)
                    if (!p) return null
                    return (
                      <Marker key={`vic_fallback_${v.id}`} position={[p.lat, p.lng]} icon={redIcon}>
                        <Popup>
                          <div className="text-xs"><div className="font-semibold">{v.victimName}</div><div className="opacity-70">{v.location}</div></div>
                        </Popup>
                      </Marker>
                    )
                  })}
                </MapContainer>
              </div>
            </section>
          </div>
        )}
      </div>

      {tab === 'ngos' && (
        <section className="bg-white border border-blue-100 rounded-2xl p-5 shadow-card max-w-6xl mx-auto">
          <h2 className="text-lg font-semibold mb-3">NGOs</h2>
          {ngos.length === 0 ? (
            <p className="text-sm text-slate-500">No NGOs registered yet.</p>
          ) : (
            <div className="max-h-[420px] overflow-auto text-xs">
              <table className="w-full text-left">
                <thead className="bg-blue-50 text-slate-600">
                  <tr>
                    <th className="px-2 py-1">Name</th>
                    <th className="px-2 py-1">Email</th>
                    <th className="px-2 py-1">Location</th>
                    <th className="px-2 py-1">Services</th>
                    <th className="px-2 py-1">Phone</th>
                    <th className="px-2 py-1 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {ngos.map(n => (
                    <tr key={n.id} className="border-b border-blue-50">
                      <td className="px-2 py-1 text-sm">{n.name}</td>
                      <td className="px-2 py-1">{n.email}</td>
                      <td className="px-2 py-1 text-[11px]">
                        <div className="whitespace-normal break-words" title={n.location}>{n.location}</div>
                      </td>
                      <td className="px-2 py-1 text-[11px] align-top">
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                          {(n.serviceType || '').split(',').map(s => s.trim()).filter(Boolean).map(s => (
                            <div key={s} className="truncate">• {s}</div>
                          ))}
                        </div>
                      </td>
                      <td className="px-2 py-1 text-[11px]">{n.phone}</td>
                      <td className="px-2 py-1 text-right">
                        <button
                          className="px-2 py-0.5 rounded-full border border-danger/40 text-[11px] text-danger"
                          onClick={() => handleDeleteNgo(n.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === 'victims' && (
        <section className="bg-white border border-blue-100 rounded-2xl p-5 shadow-card max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Victim Requests</h2>
            <div className="flex items-center gap-2 text-xs">
              <span>Filter by NGO:</span>
              <select
                className="input h-7 px-2 py-1 text-xs"
                value={selectedNgoFilter}
                onChange={e => setSelectedNgoFilter(e.target.value)}
              >
                <option value="all">All</option>
                <option value="unassigned">Unassigned</option>
                {ngos.map(n => (
                  <option key={n.id} value={n.id}>{n.name}</option>
                ))}
              </select>
            </div>
          </div>
          {victims.length === 0 ? (
            <p className="text-sm text-slate-500">No victim requests yet.</p>
          ) : (
            <div className="max-h-[420px] overflow-auto text-xs">
              <table className="w-full text-left">
                <thead className="bg-blue-50 text-slate-600">
                  <tr>
                    <th className="px-2 py-1">Name</th>
                    <th className="px-2 py-1">Location</th>
                    <th className="px-2 py-1">Disaster</th>
                    <th className="px-2 py-1">Status</th>
                    <th className="px-2 py-1">Assigned NGO</th>
                    <th className="px-2 py-1">Contact</th>
                  </tr>
                </thead>
                <tbody>
                  {victims
                    .filter(v => {
                      if (selectedNgoFilter === 'all') return true
                      if (selectedNgoFilter === 'unassigned') return !v.assignedNgoId
                      return v.assignedNgoId === selectedNgoFilter
                    })
                    .map(v => {
                      const aNgo = getNgoById(v.assignedNgoId)
                      return (
                        <tr key={v.id} className="border-b border-blue-50">
                          <td className="px-2 py-1 text-sm">{v.victimName}</td>
                          <td className="px-2 py-1 text-[11px]">{v.location}</td>
                          <td className="px-2 py-1 text-[11px]">{v.disasterType.toUpperCase()}</td>
                          <td className="px-2 py-1 text-[11px] capitalize">{v.status.replace('_', ' ')}</td>
                          <td className="px-2 py-1 text-[11px]">{aNgo ? aNgo.name : 'Unassigned'}</td>
                          <td className="px-2 py-1 text-[11px]">{v.contact || 'Not provided'}</td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === 'manageNgos' && (
        <div className="grid md:grid-cols-2 gap-6 max-w-6xl mx-auto">
          <section className="bg-white border border-blue-100 rounded-2xl p-5 shadow-card">
            <h2 className="text-lg font-semibold mb-2">Add new NGO</h2>
            <form className="space-y-2 text-sm" onSubmit={handleAddNgo}>
              <div className="space-y-1">
                <label className="font-medium">Name</label>
                <input className="input" value={newNgoName} onChange={e => setNewNgoName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="font-medium">Email</label>
                <input className="input" value={newNgoEmail} onChange={e => setNewNgoEmail(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="font-medium">Password</label>
                <input
                  className="input"
                  type="password"
                  value={newNgoPassword}
                  onChange={e => setNewNgoPassword(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="font-medium">Phone (optional)</label>
                <input className="input" value={newNgoPhone} onChange={e => setNewNgoPhone(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="font-medium">Location</label>
                <div className="flex gap-2 text-[11px] mb-1">
                  <button
                    type="button"
                    className={`px-3 py-1 rounded-full border ${manageLocationMode === 'enter' ? 'border-primary bg-primary/20 text-foreground' : 'border-slate-200 text-slate-600'}`}
                    onClick={() => setManageLocationMode('enter')}
                  >Enter manually</button>
                  <button
                    type="button"
                    className={`px-3 py-1 rounded-full border ${manageLocationMode === 'detect' ? 'border-primary bg-primary/20 text-foreground' : 'border-slate-200 text-slate-600'}`}
                    onClick={handleManageDetect}
                  >Use my current location</button>
                  <button
                    type="button"
                    className={`px-3 py-1 rounded-full border ${manageLocationMode === 'map' ? 'border-primary bg-primary/20 text-foreground' : 'border-slate-200 text-slate-600'}`}
                    onClick={() => setManageLocationMode('map')}
                  >Select on map</button>
                </div>
                <textarea className="input min-h-[60px]" value={newNgoLocation} onChange={e => setNewNgoLocation(e.target.value)} placeholder="Office address / area, city or coordinates" />
                <button type="button" className="px-2 py-1 rounded-md border border-blue-100 text-xs mt-1" onClick={async () => {
                  const q = newNgoLocation.trim(); if (!q) { alert('Enter a location first'); return }
                  try { const res = await geocodeAddress(q); if (res) { setNewNgoLocation(res.displayName) } else { alert('Address not found') } } catch { alert('Geocoding failed') }
                }}>Search this location</button>
                {manageAddress && (
                  <div className="text-[11px] opacity-70">Detected address: {manageAddress}</div>
                )}
                <div className="rounded-lg overflow-hidden border border-blue-100 bg-gradient-to-br from-white to-sky-50 mt-2" style={{ height: manageLocationMode === 'map' ? '65vh' : '25vh' }}>
                  {(manageCoords || manageLocationMode === 'map') ? (
                    <MapContainer center={[manageCoords?.lat || 12.9716, manageCoords?.lng || 77.5946]} zoom={manageCoords ? 15 : 12} style={{ height: '100%', width: '100%' }}>
                      <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      <MapClickSetterManage enabled={manageLocationMode === 'map'} />
                      {manageCoords && (
                        <Marker position={[manageCoords.lat, manageCoords.lng]} icon={redIcon}>
                          <Popup>
                            <div className="text-xs">
                              <div className="font-semibold">NGO location</div>
                              <div className="opacity-70">{manageAddress || newNgoLocation}</div>
                            </div>
                          </Popup>
                        </Marker>
                      )}
                    </MapContainer>
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-xs text-slate-500 px-4 text-center">
                      Choose "Use my current location" or "Select on map" to pick a precise location.
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <label className="font-medium">Services</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {serviceOptions.map(opt => (
                    <label key={opt} className="flex items-center gap-2">
                      <input type="checkbox" className="accent-primary" checked={selectedServices.includes(opt)} onChange={() => setSelectedServices(prev => prev.includes(opt) ? prev.filter(x => x!==opt) : [...prev, opt])} />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
              {manageError && <div className="text-xs text-danger">{manageError}</div>}
              <button type="submit" className="button-primary w-full mt-1 text-xs">Add NGO</button>
            </form>
          </section>
          <section className="bg-white border border-blue-100 rounded-2xl p-5 shadow-card">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold">Existing NGOs</h2>
              <div className="flex items-center gap-2">
                <button
                  className={`px-3 py-1 rounded-md border text-xs ${geocoding ? 'opacity-60 pointer-events-none' : ''}`}
                  onClick={async () => {
                    try {
                      setGeocoding(true)
                      await ensureAllNgoCoords()
                      setNgos(getNgoUsers())
                      // slight delay to allow cache write
                      setTimeout(() => setGeocoding(false), 300)
                    } catch (err) {
                      console.error('Geocode all failed', err)
                      setGeocoding(false)
                    }
                  }}
                >
                  {geocoding ? 'Geocoding…' : 'Geocode all NGOs'}
                </button>
              </div>
            </div>
            {ngos.length === 0 ? (
              <p className="text-sm text-slate-500">No NGOs registered yet.</p>
            ) : (
              <div className="max-h-72 overflow-auto text-xs">
                <table className="w-full text-left">
                  <thead className="bg-blue-50 text-slate-600">
                    <tr>
                      <th className="px-2 py-1">Name</th>
                      <th className="px-2 py-1">Email</th>
                      <th className="px-2 py-1 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ngos.map(n => (
                      <tr key={n.id} className="border-b border-blue-50">
                        <td className="px-2 py-1 text-sm">{n.name}</td>
                        <td className="px-2 py-1">{n.email}</td>
                        <td className="px-2 py-1 text-right">
                          <button
                            className="px-2 py-0.5 rounded-full border border-danger/40 text-[11px] text-danger"
                            onClick={() => handleDeleteNgo(n.id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      
    </div>
  )
}
