const API_BASE = import.meta.env.VITE_API_BASE_URL

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { addVictimRequest, DisasterType } from '../store/rescue'
import { geocodeAddress } from '../services/geocode'
import { MapContainer, Marker, TileLayer } from 'react-leaflet'
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
  const [details, setDetails] = useState('')
  const [disasterType, setDisasterType] = useState<DisasterType>('other')
  const [submitted, setSubmitted] = useState(false)
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'locating' | 'ready' | 'error'>('idle')
  const [searchingAddress, setSearchingAddress] = useState(false)
  const [address, setAddress] = useState('')
  const [aiDebug, setAiDebug] = useState<{
    disasterType?: string
    assignedNgoId?: string
    reason?: string
    usedAi?: boolean
    error?: string
  } | null>(null)
  const [aiDebugOpen, setAiDebugOpen] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !location.trim()) return

    let finalDisasterType: DisasterType = disasterType
    let assignedNgoId: string | undefined = undefined

    setAiDebug(null)

    if (navigator.onLine) {
      try {
        const aiRes = await fetch(`${API_BASE}/api/ai/route-request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: (details || '').trim() || `Name: ${name}. Location: ${location}. Type: ${disasterType}.`,
            locationText: location.trim(),
          }),
        })
        if (aiRes.ok) {
          const aiData = await aiRes.json()
          if (aiData.ok) {
            if (aiData.disasterType && typeof aiData.disasterType === 'string') {
              finalDisasterType = aiData.disasterType as DisasterType
            }

            if (aiData.assignedNgoId) {
              assignedNgoId = String(aiData.assignedNgoId)
            }
            setAiDebug({
              disasterType: aiData.disasterType,
              assignedNgoId: aiData.assignedNgoId ? String(aiData.assignedNgoId) : undefined,
              reason: aiData.reason,
              usedAi: aiData.usedAi,
            })
            setAiDebugOpen(true)
          }
        } else {
          setAiDebug({ error: `AI request failed with status ${aiRes.status}` })
        }
      } catch {
        setAiDebug({ error: 'AI request failed (network or server error). Falling back to local routing.' })
      }
    }

    try {
      await fetch(`${API_BASE}/api/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          victimName: name.trim(),
          contact: contact.trim() || undefined,
          location: location.trim(),
          disasterType: finalDisasterType,
          assignedNgoId,
        }),
      })
    } catch {
      // ignore backend errors for now and still keep local request so UI works
    }

    addVictimRequest({
      victimName: name.trim(),
      contact: contact.trim() || undefined,
      location: location.trim(),
      disasterType: finalDisasterType,
      assignedNgoId,
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

  async function handleSearchAddress() {
    const text = location.trim()
    if (!text) return
    setSearchingAddress(true)
    try {
      const res = await geocodeAddress(text)
      if (!res) {
        window.alert('Address not found. Try adding city/state information.')
        return
      }
      setCoords({ lat: res.lat, lng: res.lng })
      setAddress(res.displayName)
      setLocation(res.displayName)
      setGpsStatus('ready')
    } catch (err) {
      console.error('Manual geocode failed', err)
      window.alert('Could not look up that address. Please check your network and try again.')
    } finally {
      setSearchingAddress(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-secondary/40 to-white text-foreground flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-8">
        {/* Left column: form */}
        <div className="space-y-4 bg-white/90 border border-pink-100 rounded-2xl p-6 shadow-card">
          <div>
            <h1 className="text-2xl font-semibold mb-1 text-slate-700">Emergency Request</h1>
            <p className="text-xs text-slate-500">Fill these details so nearby help can reach you quickly.</p>
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
              <label className="font-medium">Describe your emergency</label>
              <textarea
                className="input min-h-[100px]"
                placeholder="What exactly is happening? How many people, visible injuries, trapped, water level, fire, etc."
                value={details}
                onChange={e => setDetails(e.target.value)}
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
                  className={`px-3 py-1 rounded-full border ${locationMode === 'enter' ? 'border-primary bg-primary/20 text-foreground' : 'border-slate-200 text-slate-500'}`}
                  onClick={() => setLocationMode('enter')}
                >
                  Enter manually
                </button>
                <button
                  type="button"
                  className={`px-3 py-1 rounded-full border ${locationMode === 'detect' ? 'border-primary bg-primary/20 text-foreground' : 'border-slate-200 text-slate-500'}`}
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
              <div className="flex flex-wrap gap-2 mt-2 text-xs">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-full border border-blue-100 bg-white text-slate-600"
                  onClick={handleSearchAddress}
                  disabled={searchingAddress}
                >
                  {searchingAddress ? 'Searching…' : 'Search this address'}
                </button>
                {gpsStatus === 'ready' && coords && (
                  <span className="text-[11px] text-slate-500">Map centered at {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}</span>
                )}
              </div>
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

          {aiDebug && (
            <div className="mt-4 border border-blue-100 rounded-xl text-xs bg-white/80">
              <button
                type="button"
                className="w-full text-left px-3 py-2 flex items-center justify-between text-slate-600"
                onClick={() => setAiDebugOpen(o => !o)}
              >
                <span className="font-semibold">AI routing debug</span>
                <span className="opacity-50">{aiDebugOpen ? 'Hide' : 'Show'}</span>
              </button>
              {aiDebugOpen && (
                <div className="px-3 pb-3 space-y-1 text-slate-600">
                  {aiDebug.error && (
                    <div className="text-danger">{aiDebug.error}</div>
                  )}
                  {!aiDebug.error && (
                    <>
                      <div>
                        Mode: <span className="font-medium">{aiDebug.usedAi ? 'OpenAI model' : 'Heuristic fallback'}</span>
                      </div>
                      <div>
                        Disaster type: <span className="font-medium">{aiDebug.disasterType || '(none)'}</span>
                      </div>
                      <div>
                        Assigned NGO id: <span className="font-medium">{aiDebug.assignedNgoId || '(none)'}</span>
                      </div>
                      {aiDebug.reason && (
                        <div className="mt-1 opacity-80">Reason: {aiDebug.reason}</div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right column: map */}
        <div className="space-y-3 bg-white/90 border border-blue-100 rounded-2xl p-4 shadow-card">
          <div className="flex justify-between items-center text-sm text-slate-600">
            <div className="font-medium text-slate-700">Location on map</div>
            <div className="text-[11px]">
              {gpsStatus === 'ready' ? 'GPS ready' : gpsStatus === 'locating' ? 'Detecting location…' : 'Manual location'}
            </div>
          </div>
          <div className="h-64 md:h-80 rounded-xl overflow-hidden border border-blue-100 bg-gradient-to-br from-white to-sky-50">
            {coords ? (
              <MapContainer center={[coords.lat, coords.lng]} zoom={15} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  attribution="&copy; OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={[coords.lat, coords.lng]} />
              </MapContainer>
            ) : (
              <div className="h-full w-full flex items-center justify-center text-xs text-slate-500 px-4 text-center">
                Location not yet detected. You can enter your address or tap "Use my current location".
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation popup */}
      {submitted && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-[9999]">
          <div className="bg-white border border-blue-100 rounded-2xl px-6 py-5 max-w-sm w-full text-center text-sm text-slate-600 shadow-card relative">
            <button
              type="button"
              aria-label="Close confirmation"
              className="absolute top-4 right-4 text-xs text-slate-400 hover:text-slate-600"
              onClick={() => setSubmitted(false)}
            >
              ✕
            </button>
            <h2 className="text-lg font-semibold mb-2 text-slate-700">Request sent</h2>
            <p className="mb-4">Help is on the way. Stay safe and keep your phone nearby.</p>
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

