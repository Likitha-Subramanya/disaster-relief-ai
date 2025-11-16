import { useState } from 'react'
import MapView from '../components/MapView'
import { putRequest } from '../store/db'
import type { Request } from '../models'

export default function Alerts() {
  const [location, setLocation] = useState('')
  const [severity, setSeverity] = useState('Low')
  const [details, setDetails] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [notice, setNotice] = useState<string|null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const req: Request = {
      id: 'req_'+Date.now(),
      source: 'app',
      text: details || `Emergency at ${location}`,
      category: 'unknown',
      urgency: severity==='Critical' ? 5 : severity==='High' ? 4 : severity==='Moderate' ? 3 : severity==='Low' ? 2 : 1,
      status: 'new',
      createdAt: Date.now(),
      location: location ? { lat: 19.076, lng: 72.8777 } : undefined,
    }
    await putRequest(req)
    setNotice('Alert sent successfully!')
    setRefresh(v=> v+1)
    setLocation(''); setDetails(''); setSeverity('Low')
    setTimeout(()=> setNotice(null), 2500)
  }

  return (
    <div>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 opacity-40 bg-[radial-gradient(900px_500px_at_50%_-40%,rgba(244,63,94,0.35),transparent)]" />
        <div className="container py-10 md:py-14">
          <h1 className="hero-title">Emergency Alert System</h1>
          <p className="mt-2 opacity-80">Report and monitor emergencies in real-time. All alerts are shared with response teams.</p>
        </div>
      </section>

      <section className="container grid md:grid-cols-2 gap-6 pb-16">
        <form onSubmit={submit} className="card p-6 space-y-4">
          <div>
            <label className="text-sm opacity-80">Location</label>
            <input value={location} onChange={e=> setLocation(e.target.value)} placeholder="Enter affected location" className="input mt-1" />
          </div>
          <div>
            <label className="text-sm opacity-80">Severity Level</label>
            <select value={severity} onChange={e=> setSeverity(e.target.value)} className="input mt-1">
              {['Low','Moderate','High','Critical'].map(s=> <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm opacity-80">Emergency Details</label>
            <textarea value={details} onChange={e=> setDetails(e.target.value)} className="input mt-1 h-28" placeholder="Describe the emergency situation in detail" />
          </div>
          <button className="button-primary w-full">Trigger Emergency Alert</button>
          {notice && <div className="text-sm text-emerald-300">{notice}</div>}
        </form>
        <div className="space-y-4">
          <div className="section-title">Emergency Alerts Map</div>
          <MapView refreshSignal={refresh} />
        </div>
      </section>
    </div>
  )
}
