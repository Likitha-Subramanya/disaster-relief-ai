import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { registerNgo } from '../store/rescue'

export default function NgoRegister() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [locationMode, setLocationMode] = useState<'enter' | 'detect'>('enter')
  const [location, setLocation] = useState('')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'locating' | 'ready' | 'error'>('idle')
  const [services, setServices] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

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
          setLocation(nice)
        } else {
          const fallback = `${lat.toFixed(5)}, ${lng.toFixed(5)}`
          setLocation(fallback)
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

    const localRes = registerNgo({
      name: name.trim(),
      email: email.trim(),
      password,
      phone: phone.trim(),
      address: location.trim(),
      location: location.trim(),
      serviceType: serviceLabel,
    })
    if (!localRes.ok) {
      setError(localRes.error)
      return
    }

    try {
      await fetch('http://localhost:4000/api/ngos/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          phone: phone.trim(),
          address: location.trim(),
          location: location.trim(),
          serviceType: serviceLabel,
          branches: [],
          theme: 'dark',
        }),
      })
    } catch {
    }

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
            </div>
            <textarea
              className="input min-h-[60px]"
              placeholder="Area, city where your NGO operates"
              value={location}
              onChange={e => setLocation(e.target.value)}
            />
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
                'Search and rescue',
                'Medical aid',
                'Ambulance support',
                'Food & water distribution',
                'Temporary shelter / camps',
                'Psychological support',
                'Child protection',
                'Elderly support',
                'Animal rescue',
                'Logistics & transport',
                'Clothing & essentials',
                'Clean-up & rehabilitation',
                'Legal / documentation help',
                'Cash / financial assistance',
                'Volunteer coordination',
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
