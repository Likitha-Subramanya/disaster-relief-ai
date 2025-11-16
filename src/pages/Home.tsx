import { HandHeart, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { getCurrentUser } from '../store/auth'
import MapView from '../components/MapView'
import { putResource } from '../store/db'
import type { Category } from '../models'

export default function Home() {
  const user = getCurrentUser()
  return (
    <div>
      <section className="container py-16 md:py-24 text-center">
        <h1 className="hero-title"><b>Relief.AI</b></h1>
        <p className="mt-3 opacity-80 max-w-2xl mx-auto">
          Coordinating help when it matters most. Simple. Fast. Reliable.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/auth" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 hover:bg-white/5">Sign In</Link>
          <Link to="/auth" className="button-primary">Register</Link>
          <Link to="/victim" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 hover:bg-white/5">
            <HandHeart className="w-4 h-4" /> Emergency Help
          </Link>
        </div>
      </section>

      {user && (
        <section className="container pb-16 grid md:grid-cols-2 gap-6">
          <VolunteerQuickRegister />
          <div className="card p-6">
            <div className="text-lg font-semibold mb-2">Live Map</div>
            <MapView />
          </div>
        </section>
      )}
    </div>
  )
}

function VolunteerQuickRegister() {
  const [type, setType] = useState<Category>('supplies')
  const [tags, setTags] = useState('')
  const [qty, setQty] = useState(1)
  const [loc, setLoc] = useState<{lat:number,lng:number,label?:string}|null>(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string|null>(null)

  useEffect(()=>{
    if (!('geolocation' in navigator)) return
    navigator.geolocation.getCurrentPosition((pos)=>{
      setLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'Current location' })
    })
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!loc) { setNotice('Please allow location'); return }
    setSaving(true)
    try {
      const id = 'res_'+Date.now()
      await putResource({
        id,
        ownerUserId: 'local',
        type,
        capabilityTags: tags.split(',').map(s=>s.trim()).filter(Boolean),
        quantity: Number(qty)||1,
        location: { lat: loc.lat, lng: loc.lng },
        availabilityStatus: 'available'
      })
      setNotice('Saved. You are visible on the map (green).')
    } finally { setSaving(false) }
    setTimeout(()=> setNotice(null), 3000)
  }

  return (
    <div className="card p-6">
      <div className="text-lg font-semibold mb-2">Register your availability</div>
      <form className="grid gap-3" onSubmit={submit}>
        <select className="input" value={type} onChange={e=> setType(e.target.value as Category)}>
          <option value="medical">Medical</option>
          <option value="rescue">Rescue</option>
          <option value="shelter">Shelter</option>
          <option value="supplies">Supplies</option>
        </select>
        <input className="input" placeholder="Tags (comma separated)" value={tags} onChange={e=> setTags(e.target.value)} />
        <input className="input" type="number" min={1} placeholder="Quantity" value={qty} onChange={e=> setQty(Number(e.target.value))} />
        <div className="text-xs opacity-70">Location: {loc ? `${loc.label||''} ${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}` : 'Detecting…'}</div>
        <button className="button-primary self-start" disabled={saving}>
          <MapPin className="w-4 h-4" /> {saving? 'Saving…' : 'Save Availability'}
        </button>
        {notice && <div className="text-xs opacity-80">{notice}</div>}
      </form>
    </div>
  )
}
