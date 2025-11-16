import { useState } from 'react'
import { Link } from 'react-router-dom'

export default function Profile() {
  const [language, setLanguage] = useState('en')
  const [smsFallback, setSmsFallback] = useState(true)
  const [offlineMode, setOfflineMode] = useState(true)
  const [notifications, setNotifications] = useState(true)
  const [shareData, setShareData] = useState(false)

  return (
    <div className="container py-8 md:py-10 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xl font-semibold">Profile & Settings</div>
          <div className="text-xs opacity-70">Configure how the app behaves during emergencies.</div>
        </div>
        <Link to="/" className="text-xs opacity-80 underline">Back to home</Link>
      </div>

      <div className="grid md:grid-cols-2 gap-6 items-start text-xs">
        {/* Profile & contacts */}
        <div className="space-y-4">
          <div className="card p-4">
            <div className="text-sm font-semibold mb-2">Your details</div>
            <div className="grid gap-2">
              <div>
                <label className="block mb-1 opacity-80">Name</label>
                <input className="input text-xs" placeholder="Your full name" />
              </div>
              <div>
                <label className="block mb-1 opacity-80">Primary phone</label>
                <input className="input text-xs" placeholder="Number used for emergencies" />
              </div>
              <div>
                <label className="block mb-1 opacity-80">Medical info (optional)</label>
                <textarea className="input text-xs min-h-[60px]" placeholder="Allergies, medications, conditions" />
              </div>
            </div>
          </div>

          <div className="card p-4">
            <div className="text-sm font-semibold mb-2">Emergency contacts</div>
            <div className="grid gap-2">
              <div>
                <label className="block mb-1 opacity-80">Contact 1</label>
                <input className="input text-xs" placeholder="Name and phone" />
              </div>
              <div>
                <label className="block mb-1 opacity-80">Contact 2</label>
                <input className="input text-xs" placeholder="Name and phone" />
              </div>
              <p className="text-[11px] opacity-70 mt-1">In future versions, these contacts can be auto-notified when you create a critical SOS.</p>
            </div>
          </div>
        </div>

        {/* Behaviour & preferences */}
        <div className="space-y-4">
          <div className="card p-4">
            <div className="text-sm font-semibold mb-2">Language & mode</div>
            <div className="grid gap-3">
              <div>
                <label className="block mb-1 opacity-80">Language</label>
                <select className="input text-xs" value={language} onChange={e=> setLanguage(e.target.value)}>
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="ta">Tamil</option>
                  <option value="es">Spanish</option>
                </select>
              </div>
              <div className="flex items-start gap-2">
                <input
                  id="offlineMode"
                  type="checkbox"
                  className="mt-0.5"
                  checked={offlineMode}
                  onChange={e=> setOfflineMode(e.target.checked)}
                />
                <label htmlFor="offlineMode" className="cursor-pointer">
                  <div className="font-semibold text-xs">Offline-first mode</div>
                  <div className="text-[11px] opacity-80">Keep recent requests on this device and allow using the app when internet is down.</div>
                </label>
              </div>
            </div>
          </div>

          <div className="card p-4">
            <div className="text-sm font-semibold mb-2">Alerts & SMS</div>
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <input
                  id="notifications"
                  type="checkbox"
                  className="mt-0.5"
                  checked={notifications}
                  onChange={e=> setNotifications(e.target.checked)}
                />
                <label htmlFor="notifications" className="cursor-pointer">
                  <div className="font-semibold text-xs">Notification alerts</div>
                  <div className="text-[11px] opacity-80">Allow this app to show updates when a responder is assigned or status changes.</div>
                </label>
              </div>

              <div className="flex items-start gap-2">
                <input
                  id="smsFallback"
                  type="checkbox"
                  className="mt-0.5"
                  checked={smsFallback}
                  onChange={e=> setSmsFallback(e.target.checked)}
                />
                <label htmlFor="smsFallback" className="cursor-pointer">
                  <div className="font-semibold text-xs">Allow SMS fallback</div>
                  <div className="text-[11px] opacity-80">When online delivery fails, the system may encode basic emergency info into a compact SMS packet.</div>
                </label>
              </div>
            </div>
          </div>

          <div className="card p-4">
            <div className="text-sm font-semibold mb-2">Data & privacy</div>
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <input
                  id="shareData"
                  type="checkbox"
                  className="mt-0.5"
                  checked={shareData}
                  onChange={e=> setShareData(e.target.checked)}
                />
                <label htmlFor="shareData" className="cursor-pointer">
                  <div className="font-semibold text-xs">Allow anonymous data for improvement</div>
                  <div className="text-[11px] opacity-80">Share anonymized incident data to improve AI models and disaster planning.</div>
                </label>
              </div>
              <p className="text-[11px] opacity-70">
                These settings are local in this demo. In a full deployment, they would be stored securely on the server and respected across devices.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
