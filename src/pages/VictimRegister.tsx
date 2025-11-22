import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { geocodeAddress } from '../services/geocode'
import { MapContainer, Marker, Popup, TileLayer, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { setCurrentVictim } from '../store/rescue'
import { registerUser } from '../store/auth'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'

export default function VictimRegister() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [locationMode, setLocationMode] = useState<'enter' | 'detect' | 'map'>('enter')
  const [location, setLocation] = useState('')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'locating' | 'ready' | 'error'>('idle')
  const [contact, setContact] = useState('')
  
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Leaflet default icon fix
  // @ts-ignore
  delete (L.Icon.Default.prototype as any)._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
  })

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
    if (!name.trim() || !email.trim() || !password.trim() || !location.trim() || !contact.trim()) {
      setError('Please fill in all details to register.')
      return
    }

    setLoading(true)
    setError(null)

    const localRes = registerUser({
      name: name.trim(),
      email: email.trim(),
      password: password.trim(),
    })
    if (!localRes.ok) {
      setError(localRes.error)
      setLoading(false)
      return
    }

    setCurrentVictim({
      name: name.trim(),
      email: email.trim(),
      password: password.trim(),
      location: location.trim(),
      address: location.trim(),
      contact: contact.trim(),
    })

    try {
      const resp = await fetch(`${API_BASE}/api/victims/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password: password.trim(),
          city: location.trim(),
          address: location.trim(),
          contact: contact.trim(),
        }),
      })
      const body = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        // If the server reports a conflict (already registered), surface it.
        if (resp.status === 409) {
          setError(body.error || 'Victim already registered')
          setLoading(false)
          return
        }
        // For other server-side failures, do not block the user — we've already
        // saved the user locally above. Proceed to login so the user can continue.
        console.warn('Server registration failed, proceeding locally:', body)
      }
    } catch (err:any) {
      // Network error — allow local registration to continue so user can sign in.
      console.warn('Network error while registering on server, proceeding locally:', err)
    }

    setLoading(false)
    navigate('/victim/login')
  }

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-secondary/40 to-white text-slate-700 flex items-center justify-center px-4 py-12">
      <div className="bg-white border border-blue-100 rounded-2xl p-6 md:p-8 shadow-card w-full max-w-2xl">
        <button
          type="button"
          className="text-xs text-slate-500 underline mb-3"
          onClick={() => navigate('/')}
        >
          ← Back to home
        </button>
        <h1 className="text-2xl font-semibold mb-2 text-center text-slate-800">Victim Register</h1>
        <p className="text-sm text-slate-500 mb-6 text-center">
          Save your complete details so rescuers can recognise you faster and you can securely sign in later.
        </p>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1 text-sm">
            <label className="font-medium">Name</label>
            <input
              className="input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your full name"
            />
          </div>
          <div className="space-y-1 text-sm">
            <label className="font-medium">Email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email for login and updates"
            />
          </div>
          <div className="space-y-1 text-sm">
            <label className="font-medium">Password</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Create a secure password"
            />
          </div>
          <div className="space-y-1 text-sm">
            <label className="font-medium">Location</label>
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
              className="input min-h-[70px]"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="House / street / area, city (or tap detect/map)"
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
            <div className="rounded-lg overflow-hidden border border-blue-100 bg-gradient-to-br from-white to-sky-50 mt-2" style={{ height: locationMode === 'map' ? '60vh' : '10rem' }}>
              {(coords || locationMode === 'map') ? (
                <MapContainer center={[coords?.lat || 12.9716, coords?.lng || 77.5946]} zoom={coords ? 15 : 12} style={{ height: '100%', width: '100%' }}>
                  <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <MapClickSetter enabled={locationMode === 'map'} />
                  {coords && (
                    <Marker position={[coords.lat, coords.lng]}>
                      <Popup>
                        <div className="text-xs">
                          <div className="font-semibold">Selected Location</div>
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
            <label className="font-medium">Primary contact for rescue</label>
            <input
              className="input"
              value={contact}
              onChange={e => setContact(e.target.value)}
              placeholder="Phone or WhatsApp"
            />
          </div>
          
          {error && <div className="text-xs text-danger">{error}</div>}
          <div className="text-xs text-right text-slate-500">Already registered? <span className="italic">Use your email/password on the sign in page.</span></div>
          <button type="submit" className="button-primary w-full mt-2">
            {loading ? 'Creating account…' : 'Create profile'}
          </button>
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

