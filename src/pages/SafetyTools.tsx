import { useState } from 'react'
import { Volume2, VolumeX, Sun, Moon } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function SafetyTools() {
  const [flashlightOn, setFlashlightOn] = useState(false)
  const [sirenOn, setSirenOn] = useState(false)

  return (
    <div className={`min-h-[calc(100vh-4rem)] ${flashlightOn ? 'bg-white text-slate-900' : 'bg-background text-foreground'}`}>
      <div className="container py-8 md:py-10 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xl font-semibold">Safety tools</div>
            <div className="text-xs opacity-70">Useful tools and tips to help you before and during emergencies.</div>
          </div>
          <Link to="/" className="text-xs opacity-80 underline">Back to home</Link>
        </div>

        <div className="grid md:grid-cols-3 gap-6 items-start">
          {/* Tools column */}
          <div className="space-y-4 md:col-span-1">
            {/* Flashlight */}
            <div className="card p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between mb-1">
                <div className="text-sm font-semibold">Flashlight mode</div>
                <Sun className="w-4 h-4" />
              </div>
              <div className="text-xs opacity-80 mb-2">Turns the screen bright white for basic visibility in the dark.</div>
              <button
                className="px-3 py-2 rounded-lg border border-white/10 text-xs hover:bg-white/5 flex items-center gap-2"
                onClick={()=> setFlashlightOn(v => !v)}
              >
                {flashlightOn ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                {flashlightOn ? 'Turn flashlight off' : 'Turn flashlight on'}
              </button>
            </div>

            {/* Siren */}
            <div className="card p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between mb-1">
                <div className="text-sm font-semibold">SOS siren</div>
                <Volume2 className="w-4 h-4" />
              </div>
              <div className="text-xs opacity-80 mb-2">Visual toggle for a loud alarm. In this demo, we only show state; you can later attach audio playback.</div>
              <button
                className={`px-3 py-2 rounded-lg border text-xs flex items-center gap-2 ${sirenOn ? 'border-red-500 text-red-500 bg-red-500/10' : 'border-white/10 hover:bg-white/5'}`}
                onClick={()=> setSirenOn(v => !v)}
              >
                {sirenOn ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                {sirenOn ? 'Stop siren' : 'Activate siren'}
              </button>
              {sirenOn && <div className="text-[11px] text-red-500 font-semibold">SIREN ACTIVE (Demo)</div>}
            </div>
          </div>

          {/* Tips columns */}
          <div className="md:col-span-2 grid gap-4 text-xs">
            <div className="card p-4">
              <div className="text-sm font-semibold mb-2">First-aid basics</div>
              <ul className="list-disc pl-5 space-y-1 opacity-90">
                <li>Check for breathing and severe bleeding first.</li>
                <li>Apply direct pressure to bleeding wounds with clean cloth.</li>
                <li>Keep injured person warm and still; do not move if you suspect spinal injury.</li>
                <li>Call local emergency number when safe to do so.</li>
              </ul>
            </div>

            <div className="card p-4">
              <div className="text-sm font-semibold mb-2">Flood survival tips</div>
              <ul className="list-disc pl-5 space-y-1 opacity-90">
                <li>Move to higher ground immediately. Avoid walking or driving through flood water.</li>
                <li>Do not touch electrical equipment if you are wet or standing in water.</li>
                <li>Prepare a small go-bag: water, dry food, medications, ID documents.</li>
              </ul>
            </div>

            <div className="card p-4">
              <div className="text-sm font-semibold mb-2">Earthquake safety</div>
              <ul className="list-disc pl-5 space-y-1 opacity-90">
                <li>Drop, cover, and hold on under a sturdy piece of furniture.</li>
                <li>Stay away from windows and heavy objects that can fall.</li>
                <li>After shaking stops, check for injuries and hazards like gas leaks.</li>
              </ul>
            </div>

            <div className="card p-4">
              <div className="text-sm font-semibold mb-2">Offline survival tips</div>
              <ul className="list-disc pl-5 space-y-1 opacity-90">
                <li>Keep phones in low-power mode; send short, precise messages.</li>
                <li>Agree on a family meeting point in case networks go down.</li>
                <li>Store offline copies of important contacts and medical info.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
