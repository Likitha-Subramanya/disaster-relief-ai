export default function FirstAid() {
  return (
    <div>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 opacity-40 bg-[radial-gradient(900px_500px_at_50%_-40%,rgba(244,63,94,0.35),transparent)]" />
        <div className="container py-12 md:py-16">
          <h1 className="hero-title">Disaster First Aid Management</h1>
          <p className="mt-2 opacity-80">Learn essential first aid techniques and preparedness strategies.</p>
        </div>
      </section>
      <section className="container grid md:grid-cols-2 gap-6 pb-16">
        <div className="card p-6">
          <div className="section-title mb-2">Disaster-Specific Preparedness and First Aid</div>
          <div className="space-y-3 text-sm opacity-90">
            <div className="p-3 rounded border border-white/10 bg-white/5">Earthquake — Drop, Cover, and Hold On. Check for injuries, control bleeding.</div>
            <div className="p-3 rounded border border-white/10 bg-white/5">Flood — Move to higher ground. Avoid driving in water. Treat hypothermia.</div>
            <div className="p-3 rounded border border-white/10 bg-white/5">Cyclone — Stay indoors, away from windows. Prepare a go-bag.</div>
          </div>
        </div>
        <div className="card p-6">
          <div className="section-title mb-2">First Aid Kit Essentials</div>
          <ul className="list-disc pl-6 space-y-1 opacity-90 text-sm">
            <li>Bandages and gauze</li>
            <li>Antiseptic wipes</li>
            <li>Adhesive tape</li>
            <li>Pain relievers</li>
            <li>Thermal blanket</li>
          </ul>
        </div>
      </section>
    </div>
  )
}
