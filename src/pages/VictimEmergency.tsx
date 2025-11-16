import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { addVictimRequest, DisasterType } from '../store/rescue'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// basic marker icon (reuse Leaflet defaults)
// @ts-ignore
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
})

export default function VictimEmergency() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [locationMode, setLocationMode] = useState<'enter' | 'detect'>('enter')
  const [location, setLocation] = useState('')
  const [disasterType, setDisasterType] = useState<DisasterType>('other')
  const [submitted, setSubmitted] = useState(false)
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'locating' | 'ready' | 'error'>('idle')
  const [address, setAddress] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !location.trim()) return

    try {
      await fetch('http://localhost:4000/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          victimName: name.trim(),
          contact: contact.trim() || undefined,
          location: location.trim(),
          disasterType,
        }),
      })
    } catch {
      // ignore backend errors for now and still keep local request so UI works
    }

    addVictimRequest({
      victimName: name.trim(),
      contact: contact.trim() || undefined,
      location: location.trim(),
      disasterType,
    })
    setSubmitted(true)
  }

  function handleDetect() {
    setLocationMode('detect')
    if (!('geolocation' in navigator)) {
      setGpsStatus('error')
      return
    }

    setGpsStatus('locating')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        setCoords({ lat, lng })
        setGpsStatus('ready')
        const nice = await reverseGeocode(lat, lng)
        if (nice) {
          setAddress(nice)
          setLocation(nice)
        } else {
          // fallback: at least show coordinates if address lookup fails
          const fallback = `${lat.toFixed(5)}, ${lng.toFixed(5)}`
          setAddress('')
          setLocation(fallback)
        }
      },
      () => setGpsStatus('error')
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-8">
        {/* Left column: form */}
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-semibold mb-1">Emergency Request</h1>
            <p className="text-xs opacity-80">Fill these details so nearby help can reach you quickly.</p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1 text-sm">
              <label className="font-medium">Name</label>
              <input
                className="input"
                placeholder="Your full name"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>

            <div className="space-y-1 text-sm">
              <label className="font-medium">Contact (optional)</label>
              <input
                className="input"
                placeholder="Phone number or WhatsApp"
                value={contact}
                onChange={e => setContact(e.target.value)}
              />
            </div>

            <div className="space-y-2 text-sm">
              <label className="font-medium">Location</label>
              <div className="flex gap-3 text-xs">
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
              </div>
              <textarea
                className="input min-h-[80px] mt-2"
                placeholder="House / street, area, city, landmarks"
                value={location}
                onChange={e => setLocation(e.target.value)}
              />
              {address && (
                <div className="text-[11px] opacity-70 mt-1">Detected address: {address}</div>
              )}
            </div>

            <div className="space-y-1 text-sm">
              <label className="font-medium">Type of disaster / problem</label>
              <select
                className="input"
                value={disasterType}
                onChange={e => setDisasterType(e.target.value as DisasterType)}
              >
                <option value="earthquake">Earthquake</option>
                <option value="flood">Flood</option>
                <option value="tsunami">Tsunami</option>
                <option value="cyclone">Cyclone / Hurricane / Severe storm</option>
                <option value="storm_surge">Storm surge / Coastal flooding</option>
                <option value="landslide">Landslide</option>
                <option value="building_collapse">Building collapse</option>
                <option value="fire">Fire</option>
                <option value="industrial_accident">Industrial accident</option>
                <option value="chemical_leak">Chemical leak / Gas leak</option>
                <option value="transport_accident">Road / Rail / Air accident</option>
                <option value="drought">Drought</option>
                <option value="heatwave">Heat wave</option>
                <option value="coldwave">Cold wave</option>
                <option value="epidemic">Epidemic / Disease outbreak</option>
                <option value="conflict_violence">Conflict / Violence</option>
                <option value="medical_emergency">Medical emergency (heart, injury, etc.)</option>
                <option value="other">Other / Not sure</option>
              </select>
            </div>

            <button type="submit" className="button-primary w-full mt-2">Submit request</button>
          </form>
        </div>

        {/* Right column: map */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <div className="font-medium">Location on map</div>
            <div className="text-[11px] opacity-70">
              {gpsStatus === 'ready' ? 'GPS ready' : gpsStatus === 'locating' ? 'Trying to detect location…' : 'Manual location'}
            </div>
          </div>
          <div className="h-64 md:h-80 rounded-lg overflow-hidden border border-white/10 bg-slate-900">
            {coords ? (
              <MapContainer center={[coords.lat, coords.lng]} zoom={15} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  attribution="&copy; OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={[coords.lat, coords.lng]} />
              </MapContainer>
            ) : (
              <div className="h-full w-full flex items-center justify-center text-xs opacity-70 px-4 text-center">
                Location not yet detected. You can enter your address or tap "Use my current location".
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation popup */}
      {submitted && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999]">
          <div className="bg-slate-900 border border-white/20 rounded-xl px-6 py-5 max-w-sm w-full text-center text-sm">
            <h2 className="text-lg font-semibold mb-2">Request sent</h2>
            <p className="opacity-80 mb-4">Help is on the way. Stay safe and keep your phone nearby.</p>
            <button
              className="button-primary w-full"
              onClick={() => navigate('/')}
            >
              Back to Home
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

async function reverseGeocode(lat: number, lng: number): Promise<string | undefined> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'RescueTech-demo',
        },
      }
    )
    if (!res.ok) return undefined
    const data = await res.json()
    return typeof data.display_name === 'string' ? data.display_name : undefined
  } catch {
    return undefined
  }
}

