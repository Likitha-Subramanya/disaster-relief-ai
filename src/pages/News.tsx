import { useMemo } from 'react'

export default function News() {
  const items = useMemo(()=>[
    { title: 'Flood Warning Issued', body: 'Flood warnings for western coastal regions.', time: '4/6/2025, 12:37 PM' },
    { title: 'Emergency Services in Chennai', body: 'NDRF teams deployed.', time: '4/6/2025, 9:37 AM' },
    { title: 'Delhi Schools Closed', body: 'Closure due to air quality.', time: '4/6/2025, 5:53 AM' },
  ],[])
  return (
    <div>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 opacity-40 bg-[radial-gradient(900px_500px_at_50%_-40%,rgba(244,63,94,0.35),transparent)]" />
        <div className="container py-12 md:py-16">
          <h1 className="hero-title">Disaster News & Updates</h1>
          <p className="mt-2 opacity-80">Stay informed with the latest news and updates on disasters and emergency situations.</p>
        </div>
      </section>
      <section className="container pb-16 space-y-4">
        {items.map((n,i)=> (
          <div key={i} className="card p-5">
            <div className="font-semibold text-lg">{n.title}</div>
            <div className="opacity-80 mt-1 text-sm">{n.body}</div>
            <div className="opacity-60 text-xs mt-2">{n.time}</div>
          </div>
        ))}
      </section>
    </div>
  )
}
