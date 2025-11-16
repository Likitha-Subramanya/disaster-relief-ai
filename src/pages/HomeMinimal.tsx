import { Camera, Mic, MessageCircle, MapPin, AlertTriangle, Shield, Droplets, Flame, Home, Ambulance, BadgeAlert } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import MapView from '../components/MapView'

type GpsState = { lat: number; lng: number; label?: string } | null

export default function HomeMinimal() {
  const navigate = useNavigate()
  const [gps, setGps] = useState<GpsState>(null)
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'locating' | 'ready' | 'error'>('idle')
  const [offline, setOffline] = useState(!navigator.onLine)

  useEffect(() => {
    setGpsStatus('locating')
    if (!('geolocation' in navigator)) {
      setGpsStatus('error')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'Current location' })
        setGpsStatus('ready')
      },
      () => {
        setGpsStatus('error')
      }
    )
  }, [])

  useEffect(() => {
    const handler = () => setOffline(!navigator.onLine)
    window.addEventListener('online', handler)
    window.addEventListener('offline', handler)
    return () => {
      window.removeEventListener('online', handler)
      window.removeEventListener('offline', handler)
    }
  }, [])

  function goToSOS(mode?: 'photo' | 'voice' | 'text') {
    const params = new URLSearchParams()
    if (mode) params.set('mode', mode)
    navigate(`/victim?${params.toString()}`)
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900">
      <section className="container py-10 md:py-14">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              AI Disaster Relief
            </h1>
            <p className="text-xs opacity-70 mt-1">Tap SOS or choose how to report. We attach your location automatically.</p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <button className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/5" aria-label="Notifications">
              <BadgeAlert className="w-4 h-4" />
            </button>
            <button className="px-3 py-1 rounded-full border border-white/10 hover:bg-white/5">
              EN
            </button>
            <button className="px-3 py-1 rounded-full border border-white/10 hover:bg-white/5 text-[11px]">
              Settings
            </button>
          </div>
        </div>

        {/* Offline bar */}
        <div className={`mb-4 rounded-xl px-4 py-2 text-xs flex items-center gap-2 ${offline ? 'bg-yellow-500/10 text-yellow-200 border border-yellow-500/40' : 'bg-emerald-500/10 text-emerald-200 border border-emerald-500/40'}`}>
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: offline ? '#facc15' : '#22c55e' }} />
          {offline ? 'Offline — requests will be queued and can fall back to SMS when possible.' : 'Online — requests will be sent in real time.'}
        </div>

        {/* Main content */}
        <div className="grid md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)] gap-6 md:gap-8 items-start">
          {/* Left: SOS & quick actions */}
          <div className="space-y-6">
            {/* SOS button */}
            <div className="card p-6 flex flex-col items-center text-center bg-gradient-to-b from-red-900/40 via-slate-950 to-slate-950 border-red-500/30">
              <p className="text-xs uppercase tracking-wide text-red-200/80">Emergency</p>
              <p className="text-sm opacity-80 mb-4">Tap and hold if you are in danger</p>
              <button
                className="relative w-40 h-40 md:w-48 md:h-48 rounded-full bg-red-600 shadow-[0_0_40px_rgba(220,38,38,0.7)] flex items-center justify-center active:scale-95 transition-all"
                onClick={() => goToSOS()}
              >
                <span className="absolute inset-2 rounded-full border border-red-300/60" />
                <span className="absolute inset-4 rounded-full border border-red-200/30" />
                <span className="text-2xl font-extrabold tracking-[0.3em]">SOS</span>
              </button>
              <p className="mt-4 text-xs opacity-80 max-w-sm">
                Large button for shaky hands. We will attach your GPS and classify urgency automatically.
              </p>
            </div>

            {/* Quick actions */}
            <div className="grid grid-cols-3 gap-3 text-xs">
              <button
                onClick={() => goToSOS('photo')}
                className="card p-3 flex flex-col items-center gap-2 hover:bg-white/5"
              >
                <Camera className="w-5 h-5 text-red-300" />
                <span className="font-medium">Send Photo</span>
              </button>
              <button
                onClick={() => goToSOS('voice')}
                className="card p-3 flex flex-col items-center gap-2 hover:bg-white/5"
              >
                <Mic className="w-5 h-5 text-amber-300" />
                <span className="font-medium">Voice</span>
              </button>
              <button
                onClick={() => goToSOS('text')}
                className="card p-3 flex flex-col items-center gap-2 hover:bg-white/5"
              >
                <MessageCircle className="w-5 h-5 text-sky-300" />
                <span className="font-medium">Text</span>
              </button>
            </div>

            {/* Emergency categories */}
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold">Emergency type</div>
                <div className="text-[11px] opacity-70">Tap to pre-select in SOS form</div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <CategoryTile icon={Ambulance} label="Medical" />
                <CategoryTile icon={Shield} label="Rescue" />
                <CategoryTile icon={Flame} label="Fire" />
                <CategoryTile icon={Droplets} label="Flood" />
                <CategoryTile icon={Home} label="Shelter" />
                <CategoryTile icon={AlertTriangle} label="Police" />
              </div>
            </div>
          </div>

          {/* Right: Location + mini map + navigation tiles */}
          <div className="space-y-4">
            <div className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <MapPin className="w-4 h-4 text-sky-300" />
                  Your location
                </div>
                <span className="text-[11px] opacity-70">{gpsStatus === 'ready' ? 'GPS locked' : gpsStatus === 'locating' ? 'Locating…' : 'Location unavailable'}</span>
              </div>
              <div className="text-xs opacity-80 mb-2 min-h-[1.5rem]">
                {gps
                  ? `${gps.label || ''} ${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)}`
                  : gpsStatus === 'error'
                    ? 'Please allow location access for faster help.'
                    : 'Trying to get your location…'}
              </div>
              <div className="h-40 rounded-lg overflow-hidden border border-white/10">
                <MapView refreshSignal={0} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <Link to="/my-requests" className="card p-3 flex flex-col gap-1 hover:bg-white/5">
                <span className="font-semibold">My Requests</span>
                <span className="opacity-70">See status and history</span>
              </Link>
              <Link to="/safety" className="card p-3 flex flex-col gap-1 hover:bg-white/5">
                <span className="font-semibold">Safety Tools</span>
                <span className="opacity-70">First-aid, tips, siren</span>
              </Link>
              <Link to="/dashboard" className="card p-3 flex flex-col gap-1 hover:bg-white/5">
                <span className="font-semibold">Operator View</span>
                <span className="opacity-70">Incidents & responders</span>
              </Link>
              <Link to="/profile" className="card p-3 flex flex-col gap-1 hover:bg-white/5">
                <span className="font-semibold">Profile & Settings</span>
                <span className="opacity-70">Contacts, language</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

type CategoryTileProps = {
  icon: React.ComponentType<{ className?: string }>
  label: string
}

function CategoryTile({ icon: Icon, label }: CategoryTileProps) {
  return (
    <button className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2 py-3 hover:bg-white/10">
      <Icon className="w-4 h-4" />
      <span className="text-[11px] font-medium">{label}</span>
    </button>
  )
}
