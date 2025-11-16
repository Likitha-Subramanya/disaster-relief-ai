import { useNavigate } from 'react-router-dom'

export default function VictimEmergencyContacts() {
  const navigate = useNavigate()

  return (
    <div className="container py-8 md:py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Emergency Contacts</h1>
          <p className="text-sm opacity-80">Important numbers you can call immediately during an emergency.</p>
        </div>
        <button
          className="px-3 py-1.5 rounded-full border border-white/15 text-xs"
          onClick={() => navigate(-1)}
        >
          Back
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-6 text-sm">
        <section className="card p-4">
          <h2 className="text-lg font-semibold mb-2">All-in-one emergency</h2>
          <ul className="space-y-1 opacity-90">
            <li><span className="font-medium">National emergency number:</span> 112</li>
          </ul>
        </section>

        <section className="card p-4">
          <h2 className="text-lg font-semibold mb-2">Police / Fire / Ambulance</h2>
          <ul className="space-y-1 opacity-90">
            <li><span className="font-medium">Police:</span> 100</li>
            <li><span className="font-medium">Fire:</span> 101</li>
            <li><span className="font-medium">Ambulance:</span> 102 / 108</li>
          </ul>
        </section>

        <section className="card p-4">
          <h2 className="text-lg font-semibold mb-2">Disaster & relief</h2>
          <ul className="space-y-1 opacity-90">
            <li><span className="font-medium">Disaster management helpline:</span> 108</li>
            <li><span className="font-medium">Flood / cyclone control room (local):</span> Check local district number</li>
          </ul>
        </section>

        <section className="card p-4">
          <h2 className="text-lg font-semibold mb-2">Other useful</h2>
          <ul className="space-y-1 opacity-90">
            <li><span className="font-medium">Women helpline:</span> 1091</li>
            <li><span className="font-medium">Child helpline:</span> 1098</li>
            <li><span className="font-medium">Road accident emergency:</span> 1033 (where available)</li>
          </ul>
        </section>
      </div>

      <p className="mt-6 text-[11px] opacity-70 max-w-2xl">
        These numbers may vary slightly by state or country. Always follow instructions from local authorities and
        use your nearest verified emergency contacts when available.
      </p>
    </div>
  )
}
