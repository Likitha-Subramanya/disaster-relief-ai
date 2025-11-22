import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { addVictimRequest, DisasterType, getNgoUsers, NgoUser, getVictimRequests, VictimRequest } from '../store/rescue'
import { geocodeAddress } from '../services/geocode'
import { MapContainer, Marker, Popup, TileLayer, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { triageLocal } from '../services/localTriage'

// basic marker icon (reuse Leaflet defaults)
// @ts-ignore
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
})

const greenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

export default function VictimEmergency() {
  const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [locationMode, setLocationMode] = useState<'enter' | 'detect' | 'map'>('enter')
  const [location, setLocation] = useState('')
  const [details, setDetails] = useState('')
  const [disasterType, setDisasterType] = useState<string>('')
  const [submitted, setSubmitted] = useState(false)
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'locating' | 'ready' | 'error'>('idle')
  const [searchingAddress, setSearchingAddress] = useState(false)
  const [address, setAddress] = useState('')
  const [addressSuggestions, setAddressSuggestions] = useState<Array<{ displayName: string; lat: number; lng: number }>>([])
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | undefined>(undefined)
  const [transcript, setTranscript] = useState<string | undefined>(undefined)
  const [recording, setRecording] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recognitionRef = useRef<any>(null)
  const [aiDebug, setAiDebug] = useState<{
    disasterType?: string
    assignedNgoId?: string
    reason?: string
    usedAi?: boolean
    error?: string
  } | null>(null)
  const [aiDebugOpen, setAiDebugOpen] = useState(false)
  const [lastUrgency, setLastUrgency] = useState<string | undefined>(undefined)
  const [lastRequestId, setLastRequestId] = useState<string | undefined>(undefined)

  const ngos = useMemo(() => getNgoUsers(), [])
  const [ngoPoints, setNgoPoints] = useState<Array<{ ngo: NgoUser; lat: number; lng: number; label: string }>>([])
  const [loadingNgos, setLoadingNgos] = useState(false)

  const geocodeCacheKey = 'resc_geocode_cache'
  function readCache(): Record<string, { lat: number; lng: number; displayName: string }> {
    try { const raw = localStorage.getItem(geocodeCacheKey); return raw ? JSON.parse(raw) : {} } catch { return {} }
  }
  function writeCache(data: Record<string, { lat: number; lng: number; displayName: string }>) {
    localStorage.setItem(geocodeCacheKey, JSON.stringify(data))
  }

  function formatLocationLabel(label: string, lat: number, lng: number) {
    return `${label} (${lat.toFixed(5)}, ${lng.toFixed(5)})`
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
          const base = nice || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
          if (nice) setAddress(nice); else setAddress('')
          setLocation(formatLocationLabel(base, lat, lng))
        } catch {
          const base = `${lat.toFixed(5)}, ${lng.toFixed(5)}`
          setAddress('')
          setLocation(formatLocationLabel(base, lat, lng))
        }
      }
    })
    return null
  }

  // Geocode NGO locations when the page loads once
  useEffect(() => {
    let mounted = true
    const cache = readCache()
    async function loadNgos() {
      setLoadingNgos(true)
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
      if (mounted) { setNgoPoints(out); setLoadingNgos(false) }
    }
    loadNgos()
    return () => { mounted = false }
  }, [ngos])

  useEffect(() => {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SR) {
      const rec = new SR()
      rec.continuous = true
      rec.interimResults = true
      rec.lang = 'en-IN'
      rec.onresult = (e: any) => {
        let text = ''
        for (let i = e.resultIndex; i < e.results.length; i++) {
          text += e.results[i][0].transcript
        }
        const t = text.trim()
        setTranscript(t)
        if (t) setDetails(t)
      }
      recognitionRef.current = rec
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Validation: require location always. Allow either (description OR transcript OR audioUrl)
    if (!location.trim()) {
      alert('Please provide your location (type or use current location).')
      return
    }
    const hasNarrative = (details && details.trim().length > 0) || (transcript && transcript.trim().length > 0) || !!audioUrl
    if (!hasNarrative) {
      alert('Please describe the emergency or record a short voice note.')
      return
    }

    // Local triage classification
    let finalDisasterType: DisasterType = (disasterType as DisasterType) || 'other'
    try {
      const triage = await triageLocal({ text: (details || transcript || '').trim(), location: { text: location.trim() } })
      if (triage && typeof triage.disasterType === 'string') {
        finalDisasterType = triage.disasterType as DisasterType
      }
      if (triage && typeof triage.urgency === 'string') {
        setLastUrgency(triage.urgency)
      } else {
        setLastUrgency(undefined)
      }
      setAiDebug({ disasterType: finalDisasterType, usedAi: false })
      setAiDebugOpen(true)
    } catch {}

    const created = await addVictimRequest({
      victimName: name.trim() || 'Anonymous victim',
      contact: contact.trim() || undefined,
      location: location.trim(),
      disasterType: finalDisasterType,
      assignedNgoId: undefined,
      audioUrl: audioUrl,
      transcript: transcript?.trim() || undefined,
    })
    setLastRequestId(created.id)
    setSubmitted(true)
  }

  async function toggleRecording() {
    try {
      if (!recording) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const mr = new MediaRecorder(stream)
        audioChunksRef.current = []
        mr.ondataavailable = ev => {
          if (ev.data && ev.data.size > 0) audioChunksRef.current.push(ev.data)
        }
        mr.onstop = async () => {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
          const url = URL.createObjectURL(blob)
          setAudioUrl(url)
          // Upload blob to server for multilingual transcription (best-effort)
          try {
            const base64 = await blobToBase64(blob)
            // base64 is like data:audio/webm;code..., so strip prefix
            const comma = base64.indexOf(',')
            const payload = comma === -1 ? base64 : base64.slice(comma + 1)
            const resp = await fetch(`${API_BASE}/api/transcribe`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audioBase64: payload }),
            })
            const js = await resp.json()
            if (js && js.ok && (js.transcript || js.text)) {
              const text = js.transcript || js.text
              setTranscript(text)
              // Only fill details if empty so user edits aren't overwritten
              setDetails(d => (d && d.trim().length ? d : text))
            } else {
              console.warn('Transcription response', js)
            }
          } catch (err) {
            console.error('Transcription upload failed', err)
          }
        }
        mr.start()
        mediaRecorderRef.current = mr
        setRecording(true)
        if (recognitionRef.current) {
          try { recognitionRef.current.start() } catch {}
        }
      } else {
        mediaRecorderRef.current?.stop()
        mediaRecorderRef.current?.stream.getTracks().forEach(t => t.stop())
        mediaRecorderRef.current = null
        setRecording(false)
        if (recognitionRef.current) {
          try { recognitionRef.current.stop() } catch {}
        }
      }
    } catch (err) {
      console.error('Recording failed', err)
      alert('Microphone access failed. Please check permissions.')
    }
  }

  function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.onerror = e => reject(e)
        reader.readAsDataURL(blob)
      } catch (e) {
        reject(e)
      }
    })
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
        const baseLabel = nice || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
        if (nice) {
          setAddress(nice)
        } else {
          setAddress('')
        }
        setLocation(formatLocationLabel(baseLabel, lat, lng))
      },
      () => setGpsStatus('error')
    )
  }

  async function handleSearchAddress() {
    const text = location.trim()
    if (!text) return
    setSearchingAddress(true)
    try {
      // Fetch multiple suggestions from Nominatim and let user pick
      const suggestions = await fetchAddressSuggestions(text)
      if (!suggestions || !suggestions.length) {
        window.alert('Address not found. Try adding city/state information.')
        setAddressSuggestions([])
        setSuggestionsOpen(false)
        return
      }
      // If only one suggestion, auto-select it
      if (suggestions.length === 1) {
        const s = suggestions[0]
        setCoords({ lat: s.lat, lng: s.lng })
        setAddress(s.displayName)
        setLocation(formatLocationLabel(s.displayName, s.lat, s.lng))
        setGpsStatus('ready')
        setAddressSuggestions([])
        setSuggestionsOpen(false)
      } else {
        setAddressSuggestions(suggestions)
        setSuggestionsOpen(true)
      }
    } catch (err) {
      console.error('Manual geocode failed', err)
      window.alert('Could not look up that address. Please check your network and try again.')
      setAddressSuggestions([])
      setSuggestionsOpen(false)
    } finally {
      setSearchingAddress(false)
    }
  }

  async function fetchAddressSuggestions(text: string) {
    try {
      const url = new URL('https://nominatim.openstreetmap.org/search')
      url.searchParams.set('q', text)
      url.searchParams.set('format', 'json')
      url.searchParams.set('limit', '5')
      url.searchParams.set('addressdetails', '1')
      const raw = await fetch(url.toString(), { headers: { 'Accept': 'application/json', 'Accept-Language': 'en' } })
      if (!raw.ok) return []
      const js = await raw.json()
      if (!Array.isArray(js) || js.length === 0) return []
      // map to normalized suggestions
      return js.map((it: any) => ({ displayName: it.display_name, lat: parseFloat(it.lat), lng: parseFloat(it.lon) }))
    } catch (e) {
      return []
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-secondary/40 to-white text-foreground flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-8">
        {/* Left column: form */}
        <div className="space-y-4 bg-white/90 border border-pink-100 rounded-2xl p-6 shadow-card">
          <div className="flex justify-between items-center">
            <button type="button" className="text-xs text-slate-500 underline" onClick={() => navigate('/')}>← Back to home</button>
          </div>
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
              <div className="flex items-center gap-2 text-xs">
                <button type="button" className={`px-3 py-1 rounded-full border ${recording ? 'border-danger text-danger' : 'border-blue-100 text-slate-600'}`} onClick={toggleRecording}>
                  {recording ? 'Stop voice recording' : 'Record voice instead'}
                </button>
                {audioUrl && (
                  <audio controls src={audioUrl} className="h-8">
                    Your browser does not support audio.
                  </audio>
                )}
              </div>
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
                <button
                  type="button"
                  className={`px-3 py-1 rounded-full border ${locationMode === 'map' ? 'border-primary bg-primary/20 text-foreground' : 'border-slate-200 text-slate-500'}`}
                  onClick={() => setLocationMode('map')}
                >
                  Select on map
                </button>
              </div>
              <textarea
                className="input min-h-[80px] mt-2"
                placeholder="House / street, area, city, landmarks"
                value={location}
                onChange={e => { setLocation(e.target.value); setAddressSuggestions([]); setSuggestionsOpen(false) }}
              />
              {suggestionsOpen && addressSuggestions.length > 0 && (
                <div className="mt-2 bg-white border border-slate-200 rounded-md shadow-sm text-sm">
                  <div className="px-2 py-1 text-xs text-slate-500">Select matching address</div>
                  {addressSuggestions.map((s, idx) => (
                    <button
                      key={`${s.lat}-${s.lng}-${idx}`}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 border-t first:border-t-0"
                      onClick={() => {
                        setCoords({ lat: s.lat, lng: s.lng })
                        setAddress(s.displayName)
                        setLocation(formatLocationLabel(s.displayName, s.lat, s.lng))
                        setGpsStatus('ready')
                        setAddressSuggestions([])
                        setSuggestionsOpen(false)
                      }}
                    >
                      <div className="font-medium text-xs text-slate-700">{s.displayName}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{s.lat.toFixed(5)}, {s.lng.toFixed(5)}</div>
                    </button>
                  ))}
                </div>
              )}
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
              <label className="font-medium">Type of incident</label>
              <select
                className="input"
                value={disasterType}
                onChange={e => setDisasterType(e.target.value)}
              >
                <option value="" disabled>Select</option>
                <option value="building_collapse">Building Collapse</option>
                <option value="fire">Fire</option>
                <option value="chemical_leak">Gas Leak</option>
                <option value="chemical_leak">Chemical Spill</option>
                <option value="chemical_leak">Hazardous Material Leak</option>
                <option value="chemical_leak">Smoke / Toxic Fumes</option>
                <option value="industrial_accident">Explosion</option>
                <option value="industrial_accident">Electrical Short Circuit</option>
                <option value="transport_accident">Road Accident</option>
                <option value="transport_accident">Train Accident</option>
                <option value="transport_accident">Bus Accident</option>
                <option value="transport_accident">Vehicle Collision</option>
                <option value="conflict_violence">Large Crowd / Stampede</option>
                <option value="medical_emergency">Medical Emergency</option>
                <option value="medical_emergency">Severe Injury / Bleeding</option>
                <option value="medical_emergency">Heart Attack / Breathing Difficulty</option>
                <option value="flood">Flood</option>
                <option value="landslide">Landslide</option>
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
          <div className="h-[50vh] md:h-[70vh] rounded-xl overflow-hidden border border-blue-100 bg-gradient-to-br from-white to-sky-50">
            {(coords || locationMode === 'map') ? (
              <MapContainer center={[coords?.lat || 12.9716, coords?.lng || 77.5946]} zoom={coords ? 15 : 12} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  attribution="&copy; OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapClickSetter enabled={locationMode === 'map'} />
                {coords && (
                <Marker position={[coords.lat, coords.lng]} icon={redIcon}>
                  <Popup>
                    <div className="text-xs">
                      <div className="font-semibold">Victim location</div>
                      <div className="opacity-70">{address || location}</div>
                    </div>
                  </Popup>
                </Marker>
                )}
                {ngoPoints.map(p => (
                  <Marker key={p.ngo.id} position={[p.lat, p.lng]} icon={greenIcon}>
                    <Popup>
                      <div className="text-xs">
                        <div className="font-semibold">{p.ngo.name}</div>
                        <div className="opacity-70 mb-1">{p.label}</div>
                        <div>Services: {p.ngo.serviceType || '—'}</div>
                        <div>Phone: {p.ngo.phone || '—'}</div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
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
          <div className="bg-white border border-blue-100 rounded-2xl px-6 py-5 max-w-sm w-full text-sm text-slate-600 shadow-card relative">
            <button
              type="button"
              aria-label="Close confirmation"
              className="absolute top-4 right-4 text-xs text-slate-400 hover:text-slate-600"
              onClick={() => setSubmitted(false)}
            >
              ✕
            </button>
            <h2 className="text-lg font-semibold mb-2 text-slate-700 text-center">Request sent</h2>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between"><span className="opacity-70">Incident</span><span className="font-medium">{aiDebug?.disasterType || disasterType}</span></div>
              {lastUrgency && (
                <div className="flex justify-between"><span className="opacity-70">Urgency</span><span className="font-medium capitalize">{lastUrgency}</span></div>
              )}
              {(() => {
                const reqId = lastRequestId
                if (!reqId) return null
                const requests = getVictimRequests()
                const req = requests.find((r: VictimRequest) => r.id === reqId)
                if (!req || !req.assignedNgoId) return (
                  <div className="flex justify-between"><span className="opacity-70">Assigned NGO</span><span className="font-medium">Pending</span></div>
                )
                const ngo = ngos.find(n => n.id === req.assignedNgoId)
                if (!ngo) return (
                  <div className="flex justify-between"><span className="opacity-70">Assigned NGO</span><span className="font-medium">Unknown</span></div>
                )
                return (
                  <div className="space-y-1">
                    <div className="flex justify-between"><span className="opacity-70">Assigned NGO</span><span className="font-medium">{ngo.name}</span></div>
                    <div className="flex justify-between"><span className="opacity-70">Contact</span><span className="font-medium">{ngo.phone || '—'}</span></div>
                  </div>
                )
              })()}
            </div>
            <div className="flex gap-2">
              <button
                className="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 w-1/2"
                onClick={() => setSubmitted(false)}
              >
                Close
              </button>
              <button
                className="button-primary w-1/2"
                onClick={() => navigate('/')}
              >
                Back to Home
              </button>
            </div>
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

