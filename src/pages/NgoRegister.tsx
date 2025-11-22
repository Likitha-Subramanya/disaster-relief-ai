import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { registerNgo } from '../store/rescue'
import { geocodeAddress } from '../services/geocode'
import { MapContainer, Marker, Popup, TileLayer, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

export default function NgoRegister() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [locationMode, setLocationMode] = useState<'enter' | 'detect' | 'map'>('enter')
  const [location, setLocation] = useState('')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'locating' | 'ready' | 'error'>('idle')
  const [services, setServices] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'

  // Leaflet default icon fix
  // @ts-ignore
  delete (L.Icon.Default.prototype as any)._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
  })

  function MapClickSetter({ enabled }: { enabled: boolean }) {
    useMapEvents({
      click: async (e) => {
        if (!enabled) return
        const lat = e.latlng.lat
        const lng = e.latlng.lng
        setCoords({ lat, lng })
        setGpsStatus('ready')
        try {
          const nice = await reverseGeocode(lat, lng)
          const label = nice || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
          setLocation(`${label} (${lat.toFixed(5)}, ${lng.toFixed(5)})`)
        } catch {
          const base = `${lat.toFixed(5)}, ${lng.toFixed(5)}`
          setLocation(`${base} (${lat.toFixed(5)}, ${lng.toFixed(5)})`)
        }
      }
    })
    return null
  }

  function toggleService(key: string) {
    setServices(prev =>
      prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key]
    )
  }

  async function handleDetect() {
    setLocationMode('detect')
    if (!('geolocation' in navigator)) {
      setGpsStatus('error')
      return
    }

    setGpsStatus('locating')
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        setCoords({ lat, lng })
        setGpsStatus('ready')
        const nice = await reverseGeocode(lat, lng)
        if (nice) {
          setLocation(`${nice} (${lat.toFixed(5)}, ${lng.toFixed(5)})`)
        } else {
          const fallback = `${lat.toFixed(5)}, ${lng.toFixed(5)}`
          setLocation(`${fallback} (${lat.toFixed(5)}, ${lng.toFixed(5)})`)
        }
      },
      () => setGpsStatus('error')
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim() || !phone.trim() || !email.trim() || !password.trim() || !location.trim()) {
      setError('All fields are required')
      return
    }

    const serviceLabel = services.length ? services.join(', ') : 'General support'

    const res = registerNgo({
      name: name.trim(),
      email: email.trim(),
      password,
      phone: phone.trim(),
      address: location.trim(),
      location: location.trim(),
      serviceType: serviceLabel,
    })
    if (!res.ok) {
      setError(res.error)
      return
    }
    // Best-effort backend persistence (non-blocking)
    try {
      await fetch(`${API_BASE}/api/ngos/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(), email: email.trim(), password,
          phone: phone.trim(), address: location.trim(), location: location.trim(),
          serviceType: serviceLabel,
        })
      })
    } catch {}

    navigate('/ngo/login')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-secondary/40 to-white text-slate-700 flex items-center justify-center px-4 py-12">
      <div className="bg-white border border-blue-100 rounded-2xl p-6 md:p-8 shadow-card w-full max-w-3xl">
        <button
          type="button"
          className="text-xs text-slate-500 underline mb-3"
          onClick={() => navigate('/')}
        >
          ← Back to home
        </button>
        <h1 className="text-2xl font-semibold mb-2 text-center text-slate-800">Register NGO</h1>
        <p className="text-sm text-slate-500 mb-4 text-center">Share your details so victims and admins can see your availability.</p>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1 text-sm">
            <label className="font-medium">Name</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-1 text-sm">
            <label className="font-medium">Phone number</label>
            <input className="input" value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1 text-sm">
            <label className="font-medium">Email</label>
            <input className="input" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1 text-sm">
            <label className="font-medium">Password</label>
            <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <div className="space-y-1 text-sm">
            <label className="font-medium">Address</label>
            <div className="flex gap-3 text-xs mb-1">
              <button
                type="button"
                className={`px-3 py-1 rounded-full border ${locationMode === 'enter' ? 'border-primary bg-primary/10' : 'border-white/20'}`}
                onClick={() => setLocationMode('enter')}
              >
                Enter manually
              </button>
              <button
                type="button"
                className={`px-3 py-1 rounded-full border ${locationMode === 'detect' ? 'border-primary bg-primary/10' : 'border-white/20'}`}
                onClick={handleDetect}
              >
                Use my current location
              </button>
              <button
                type="button"
                className={`px-3 py-1 rounded-full border ${locationMode === 'map' ? 'border-primary bg-primary/10' : 'border-white/20'}`}
                onClick={() => setLocationMode('map')}
              >
                Select on map
              </button>
            </div>
            <textarea
              className="input min-h-[60px]"
              placeholder="Area, city where your NGO operates"
              value={location}
              onChange={e => setLocation(e.target.value)}
            />
            <div className="flex items-center gap-2 mt-1">
              <button
                type="button"
                className="px-2 py-1 rounded-md border border-blue-100 text-xs"
                onClick={async () => {
                  const q = location.trim(); if (!q) { alert('Enter a location first'); return }
                  try {
                    const res = await geocodeAddress(q)
                    if (!res) { alert('Address not found'); return }
                    setCoords({ lat: res.lat, lng: res.lng })
                    setLocation(`${res.displayName} (${res.lat.toFixed(5)}, ${res.lng.toFixed(5)})`)
                    setGpsStatus('ready')
                  } catch {
                    alert('Geocoding failed')
                  }
                }}
              >Search this address</button>
              {gpsStatus === 'ready' && coords && (
                <span className="text-[11px] text-slate-500">Map centered at {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}</span>
              )}
            </div>
            <div className="rounded-lg overflow-hidden border border-blue-100 bg-gradient-to-br from-white to-sky-50 mt-2" style={{ height: locationMode === 'map' ? '70vh' : '25vh' }}>
              {(coords || locationMode === 'map') ? (
                <MapContainer center={[coords?.lat || 12.9716, coords?.lng || 77.5946]} zoom={coords ? 15 : 12} style={{ height: '100%', width: '100%' }}>
                  <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <MapClickSetter enabled={locationMode === 'map'} />
                  {coords && (
                    <Marker position={[coords.lat, coords.lng]}>
                      <Popup>
                        <div className="text-xs">
                          <div className="font-semibold">NGO Location</div>
                          <div className="opacity-70">{location}</div>
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
            <div className="text-[11px] opacity-70 mt-1">
              {gpsStatus === 'ready'
                ? 'GPS ready'
                : gpsStatus === 'locating'
                ? 'Trying to detect location…'
                : 'Manual location'}
            </div>
          </div>
          <div className="space-y-1 text-sm">
            <label className="font-medium">Services provided (select all that apply)</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {[
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
              ].map(key => (
                <label key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="accent-primary"
                    checked={services.includes(key)}
                    onChange={() => toggleService(key)}
                  />
                  <span>{key}</span>
                </label>
              ))}
            </div>

          </div>
          {error && <div className="text-xs text-danger">{error}</div>}
          <div className="text-xs text-right text-slate-500">Already registered? <span className="italic">Use your email/password on the sign in page.</span></div>
          <button type="submit" className="button-primary w-full mt-2">Create NGO Account</button>
        </form>
      </div>
    </div>
  )
}

async function reverseGeocode(lat: number, lng: number): Promise<string | undefined> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
    )
    const data = await res.json().catch(() => ({}))
    return data?.display_name || undefined
  } catch (err) {
    return undefined
  }
}
