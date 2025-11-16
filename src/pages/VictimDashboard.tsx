import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCurrentVictim, getVictimRequests, VictimRequest, logoutAll } from '../store/rescue'

export default function VictimDashboard() {
  const navigate = useNavigate()
  const [profileMissing, setProfileMissing] = useState(false)
  const [requests, setRequests] = useState<VictimRequest[]>([])
  const [showProfilePanel, setShowProfilePanel] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const stored = localStorage.getItem('resc_victim_theme')
    return stored === 'light' ? 'light' : 'dark'
  })

  const victim = getCurrentVictim()

  useEffect(() => {
    if (!victim) {
      setProfileMissing(true)
    }
    setRequests(getVictimRequests())
  }, [])

  const myRequests = victim
    ? requests.filter(r => r.victimName.toLowerCase() === victim.name.toLowerCase())
    : []

  const otherRequests = victim
    ? requests.filter(r => r.victimName.toLowerCase() !== victim.name.toLowerCase())
    : requests

  useEffect(() => {
    localStorage.setItem('resc_victim_theme', theme)
  }, [theme])

  const containerClasses =
    theme === 'light'
      ? 'container py-8 md:py-10 bg-slate-50 text-slate-900'
      : 'container py-8 md:py-10 bg-slate-950 text-slate-50'

  function handleLogout() {
    logoutAll()
    navigate('/')
  }

  function disasterLabel(type: string) {
    return type.replace('_', ' ').toUpperCase()
  }

  const [guideType, setGuideType] = useState<string>('flood')

  return (
    <div className={containerClasses}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Victim Dashboard</h1>
          {victim && (
            <p className="text-sm opacity-80">Welcome, {victim.name}. We are tracking your safety.</p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            className="px-3 py-1.5 rounded-full border border-white/15 text-xs"
            onClick={() => navigate('/victim/contacts')}
          >
            Emergency contacts
          </button>
          <button
            className="px-3 py-1.5 rounded-full border border-white/15 text-xs"
            onClick={() => setShowProfilePanel(true)}
          >
            Profile
          </button>
        </div>
      </div>

      {profileMissing && (
        <div className="mb-4 text-xs bg-amber-500/10 border border-amber-500/40 rounded-lg px-3 py-2">
          Your profile is missing. Please sign in so we can link requests to you.
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <section className="card p-4">
          <h2 className="text-lg font-semibold mb-2">My Requests</h2>
          {myRequests.length === 0 ? (
            <p className="text-sm opacity-75">No requests found for your name yet. If you raised an SOS, ensure you used the same name.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {myRequests.map(r => (
                <li key={r.id} className="border border-white/10 rounded-lg px-3 py-2">
                  <div className="flex justify-between items-center">
                    <div className="font-medium">{r.disasterType.toUpperCase()}</div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/10">
                      {r.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="text-xs opacity-80 mt-1">{r.location}</div>
                  <div className="text-[11px] opacity-60 mt-1">
                    {new Date(r.createdAt).toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-4">
          <div className="card p-4">
            <h2 className="text-lg font-semibold mb-2">News & Live Incidents</h2>
            {otherRequests.length === 0 ? (
              <p className="text-sm opacity-75">Latest incidents will appear here as other victims submit requests.</p>
            ) : (
              <ul className="space-y-2 text-sm max-h-56 overflow-auto">
                {otherRequests.map(r => (
                  <li key={r.id} className="border border-white/10 rounded-lg px-3 py-2">
                    <div className="flex justify-between">
                      <span className="font-medium">
                        {disasterLabel(r.disasterType)} reported
                      </span>
                      <span className="text-[11px] opacity-70">{r.location}</span>
                    </div>
                    <div className="text-[11px] opacity-60">
                      {new Date(r.createdAt).toLocaleTimeString()} — status: {r.status.replace('_', ' ')}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card p-4">
            <h2 className="text-lg font-semibold mb-3">First Aid / Emergency Guide</h2>
            <div className="flex flex-wrap gap-2 mb-3 text-xs">
              {['flood', 'earthquake', 'cyclone', 'fire', 'landslide', 'medical_emergency', 'other'].map(type => (
                <button
                  key={type}
                  className={`px-3 py-1 rounded-full border ${
                    guideType === type ? 'border-primary bg-primary/20' : 'border-white/20'
                  }`}
                  onClick={() => setGuideType(type)}
                >
                  {disasterLabel(type)}
                </button>
              ))}
            </div>

            {guideType === 'flood' && (
              <div className="text-sm space-y-2">
                <h3 className="font-semibold text-xs">Before</h3>
                <ul className="list-disc list-inside text-xs space-y-1 opacity-90">
                  <li>Move valuables and important documents to higher shelves.</li>
                  <li>Prepare an emergency kit with water, dry food, torch and medicines.</li>
                  <li>Know the nearest higher ground and safe shelter locations.</li>
                </ul>
                <h3 className="font-semibold text-xs mt-2">During</h3>
                <ul className="list-disc list-inside text-xs space-y-1 opacity-90">
                  <li>Avoid walking or driving through flood water where you cannot see the road.</li>
                  <li>Turn off electricity if water enters your home, if it is safe to do so.</li>
                  <li>Stay on higher floors or rooftops and signal for help if trapped.</li>
                </ul>
                <h3 className="font-semibold text-xs mt-2">After</h3>
                <ul className="list-disc list-inside text-xs space-y-1 opacity-90">
                  <li>Avoid using contaminated tap water until authorities say it is safe.</li>
                  <li>Do not enter damaged buildings until they are checked.</li>
                  <li>Clean and disinfect items that were in contact with flood water.</li>
                </ul>
              </div>
            )}

            {guideType === 'earthquake' && (
              <div className="text-sm space-y-2">
                <h3 className="font-semibold text-xs">Before</h3>
                <ul className="list-disc list-inside text-xs space-y-1 opacity-90">
                  <li>Secure heavy furniture and gas cylinders to walls or floors.</li>
                  <li>Identify safe spots like under strong tables or along interior walls.</li>
                  <li>Keep emergency supplies and a battery-powered torch ready.</li>
                </ul>
                <h3 className="font-semibold text-xs mt-2">During</h3>
                <ul className="list-disc list-inside text-xs space-y-1 opacity-90">
                  <li>Drop, Cover and Hold under a sturdy table away from windows.</li>
                  <li>Do not use lifts; stay inside until shaking stops.</li>
                  <li>If outside, move to an open area away from buildings and trees.</li>
                </ul>
                <h3 className="font-semibold text-xs mt-2">After</h3>
                <ul className="list-disc list-inside text-xs space-y-1 opacity-90">
                  <li>Check yourself and others for injuries and give basic first aid.</li>
                  <li>Beware of aftershocks and avoid damaged buildings.</li>
                  <li>Turn off gas and electricity if you smell gas or see damage.</li>
                </ul>
              </div>
            )}

            {guideType === 'cyclone' && (
              <div className="text-sm space-y-2">
                <h3 className="font-semibold text-xs">Before</h3>
                <ul className="list-disc list-inside text-xs space-y-1 opacity-90">
                  <li>Reinforce doors and windows; remove loose objects from balconies.</li>
                  <li>Store enough drinking water and non-perishable food.</li>
                  <li>Keep important documents in a waterproof folder.</li>
                </ul>
                <h3 className="font-semibold text-xs mt-2">During</h3>
                <ul className="list-disc list-inside text-xs space-y-1 opacity-90">
                  <li>Stay indoors, away from windows and glass doors.</li>
                  <li>Do not go out during the eye of the storm; winds may return suddenly.</li>
                  <li>Listen to official updates on radio/phone if possible.</li>
                </ul>
                <h3 className="font-semibold text-xs mt-2">After</h3>
                <ul className="list-disc list-inside text-xs space-y-1 opacity-90">
                  <li>Avoid fallen power lines and damaged electric poles.</li>
                  <li>Help children, elderly and disabled neighbours to safe areas.</li>
                  <li>Do not drink water that looks muddy or has an unusual smell.</li>
                </ul>
              </div>
            )}

            {guideType === 'fire' && (
              <div className="text-sm space-y-2">
                <h3 className="font-semibold text-xs">Before</h3>
                <ul className="list-disc list-inside text-xs space-y-1 opacity-90">
                  <li>Know at least two exit routes from every room.</li>
                  <li>Keep gas cylinders and flammable items away from heat.</li>
                  <li>Check electrical wiring and avoid overloading sockets.</li>
                </ul>
                <h3 className="font-semibold text-xs mt-2">During</h3>
                <ul className="list-disc list-inside text-xs space-y-1 opacity-90">
                  <li>Crawl low under smoke; cover nose and mouth with cloth.</li>
                  <li>Do not use lifts; use stairs to exit.</li>
                  <li>If clothes catch fire, Stop, Drop and Roll to extinguish flames.</li>
                </ul>
                <h3 className="font-semibold text-xs mt-2">After</h3>
                <ul className="list-disc list-inside text-xs space-y-1 opacity-90">
                  <li>Do not re-enter the building until authorities declare it safe.</li>
                  <li>Cool minor burns with clean cool water for at least 10 minutes.</li>
                  <li>Seek medical care for breathing problems or serious burns.</li>
                </ul>
              </div>
            )}

            {guideType === 'landslide' && (
              <div className="text-sm space-y-2">
                <h3 className="font-semibold text-xs">Before</h3>
                <ul className="list-disc list-inside text-xs space-y-1 opacity-90">
                  <li>Avoid building or staying directly below steep slopes.</li>
                  <li>Watch for cracks in soil or tilting trees during heavy rain.</li>
                  <li>Have an evacuation plan to move to safer ground.</li>
                </ul>
                <h3 className="font-semibold text-xs mt-2">During</h3>
                <ul className="list-disc list-inside text-xs space-y-1 opacity-90">
                  <li>Move quickly to higher, stable ground away from the slide path.</li>
                  <li>Do not cross active slide areas or flowing debris.</li>
                  <li>Protect head with arms or any available object.</li>
                </ul>
                <h3 className="font-semibold text-xs mt-2">After</h3>
                <ul className="list-disc list-inside text-xs space-y-1 opacity-90">
                  <li>Stay away from the slide area; more slides may occur.</li>
                  <li>Check for injured people nearby and give basic first aid.</li>
                  <li>Report damaged roads, bridges or utilities to authorities.</li>
                </ul>
              </div>
            )}

            {guideType === 'medical_emergency' && (
              <div className="text-sm space-y-2">
                <h3 className="font-semibold text-xs">Before</h3>
                <ul className="list-disc list-inside text-xs space-y-1 opacity-90">
                  <li>Keep a basic first-aid kit and emergency numbers easily accessible.</li>
                  <li>Know if any family member has serious conditions (heart, asthma, epilepsy).</li>
                  <li>Store regular medicines in one place and check expiry dates.</li>
                </ul>
                <h3 className="font-semibold text-xs mt-2">During</h3>
                <ul className="list-disc list-inside text-xs space-y-1 opacity-90">
                  <li>Call local emergency number or ambulance immediately.</li>
                  <li>Do not give food or drink to an unconscious person.</li>
                  <li>For heavy bleeding, apply firm pressure with a clean cloth.</li>
                </ul>
                <h3 className="font-semibold text-xs mt-2">After</h3>
                <ul className="list-disc list-inside text-xs space-y-1 opacity-90">
                  <li>Follow doctor instructions carefully and complete medicines as prescribed.</li>
                  <li>Observe for any warning signs returning and seek help again if needed.</li>
                  <li>Update emergency contacts and share details with family members.</li>
                </ul>
              </div>
            )}

            {guideType === 'other' && (
              <div className="text-sm space-y-2">
                <h3 className="font-semibold text-xs">General</h3>
                <ul className="list-disc list-inside text-xs space-y-1 opacity-90">
                  <li>Stay as calm as possible and move away from immediate danger.</li>
                  <li>Call for help and clearly explain what happened and where you are.</li>
                  <li>Do not spread unverified information that may cause panic.</li>
                </ul>
                <h3 className="font-semibold text-xs mt-2">During</h3>
                <ul className="list-disc list-inside text-xs space-y-1 opacity-90">
                  <li>Follow instructions from local authorities and rescuers.</li>
                  <li>Help children, elderly and disabled people around you.</li>
                  <li>Avoid risky shortcuts or unknown routes while evacuating.</li>
                </ul>
                <h3 className="font-semibold text-xs mt-2">After</h3>
                <ul className="list-disc list-inside text-xs space-y-1 opacity-90">
                  <li>Check your body for injuries and seek medical help if needed.</li>
                  <li>Stay connected with your family and share your location if possible.</li>
                  <li>Support others emotionally; disasters can be mentally stressful.</li>
                </ul>
              </div>
            )}
          </div>
        </section>
      </div>

      {showProfilePanel && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999]">
          <div
            className="bg-slate-900 text-slate-50 border border-white/15 rounded-xl w-full max-w-md p-6 text-sm max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold mb-1">Profile & Settings</h2>
            <p className="text-[11px] opacity-70 mb-3">View your details, change theme or log out.</p>
            {victim ? (
              <div className="mb-4 text-xs space-y-1">
                <div><span className="font-medium">Name:</span> {victim.name}</div>
                <div><span className="font-medium">Email:</span> {victim.email}</div>
                <div><span className="font-medium">City / area:</span> {victim.location}</div>
                <div><span className="font-medium">Full address:</span> {victim.address}</div>
                <div><span className="font-medium">Rescue contact:</span> {victim.contact}</div>
              </div>
            ) : (
              <div className="mb-4 text-xs bg-amber-500/10 border border-amber-500/40 rounded-lg px-3 py-2">
                No profile is saved. Please close this and sign in again.
              </div>
            )}

            <div className="mb-4 text-xs">
              <h3 className="font-semibold mb-1">Theme</h3>
              <div className="flex gap-2">
                <button
                  className={`px-3 py-1 rounded-full border ${
                    theme === 'dark' ? 'border-primary bg-primary/20' : 'border-white/20'
                  }`}
                  onClick={() => setTheme('dark')}
                >
                  Dark
                </button>
                <button
                  className={`px-3 py-1 rounded-full border ${
                    theme === 'light' ? 'border-primary bg-primary/20' : 'border-white/20'
                  }`}
                  onClick={() => setTheme('light')}
                >
                  Light
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2 mt-3">
              <button
                className="px-3 py-1.5 rounded-full border border-white/20 text-xs"
                onClick={() => setShowProfilePanel(false)}
              >
                Close
              </button>
              <button
                className="px-3 py-1.5 rounded-full border border-red-400/70 text-xs text-red-300"
                onClick={handleLogout}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
