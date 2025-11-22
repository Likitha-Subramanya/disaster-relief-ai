import { useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { getNgoUsers, NgoUser } from '../store/rescue'
import { geocodeAddress } from '../services/geocode'

// Green marker icons (CDN)
const greenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

const cacheKey = 'resc_geocode_cache'
function readCache(): Record<string, { lat: number; lng: number; displayName: string }> {
  try {
    const raw = localStorage.getItem(cacheKey)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}
function writeCache(data: Record<string, { lat: number; lng: number; displayName: string }>) {
  localStorage.setItem(cacheKey, JSON.stringify(data))
}

export default function NgoMap() {
  const [ngos, setNgos] = useState(() => getNgoUsers())
  const [points, setPoints] = useState<Array<{ ngo: NgoUser; lat: number; lng: number; label: string }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const cache = readCache()
    async function load() {
      const out: Array<{ ngo: NgoUser; lat: number; lng: number; label: string }> = []
      for (const ngo of ngos) {
        const key = (ngo.location || ngo.address || '').trim()
        if (!key) continue
        if (cache[key]) {
          out.push({ ngo, lat: cache[key].lat, lng: cache[key].lng, label: cache[key].displayName })
          continue
        }
        try {
          const res = await geocodeAddress(key)
          if (res) {
            cache[key] = { lat: res.lat, lng: res.lng, displayName: res.displayName }
            out.push({ ngo, lat: res.lat, lng: res.lng, label: res.displayName })
          }
        } catch {}
      }
      writeCache(cache)
      if (mounted) {
        setPoints(out)
        setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [ngos])

  // Refresh NGO list periodically so newly added NGOs appear
  useEffect(() => {
    const id = setInterval(() => setNgos(getNgoUsers()), 2000)
    return () => clearInterval(id)
  }, [])

  const center = points.length ? [points[0].lat, points[0].lng] as [number, number] : ([12.9716, 77.5946] as [number, number])

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-secondary/40 to-white text-slate-700 px-4 py-8">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.3em] text-slate-400 uppercase">NGO network</p>
            <h1 className="text-3xl font-semibold text-slate-800">NGOs on Map</h1>
            <p className="text-sm text-slate-500">Green markers show registered NGOs. Click a marker to view details.</p>
          </div>
        </div>

        <div className="h-[70vh] rounded-xl overflow-hidden border border-blue-100 bg-gradient-to-br from-white to-sky-50">
          <MapContainer center={center} zoom={11} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {points.map(p => (
              <Marker key={p.ngo.id} position={[p.lat, p.lng]} icon={greenIcon}>
                <Popup>
                  <div className="text-sm">
                    <div className="font-semibold">{p.ngo.name}</div>
                    <div className="text-[11px] text-slate-500 mb-1">{p.label}</div>
                    <div className="text-[11px]">Services: {p.ngo.serviceType || '—'}</div>
                    <div className="text-[11px]">Phone: {p.ngo.phone || '—'}</div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {loading && <div className="text-xs text-slate-500">Locating NGOs on the map…</div>}
        {!loading && points.length === 0 && (
          <div className="text-xs text-slate-500">No NGOs found. Please register NGOs first.</div>
        )}
      </div>
    </div>
  )
}
