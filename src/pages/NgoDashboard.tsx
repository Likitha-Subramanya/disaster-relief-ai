import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getCurrentNgo,
  getVictimRequests,
  updateVictimRequestStatus,
  VictimRequest,
  RequestStatus,
  NgoUser,
  updateNgo,
  logoutAll,
  assignNgoToVictim,
} from '../store/rescue'

export default function NgoDashboard() {
  const navigate = useNavigate()
  const initialNgo = getCurrentNgo()
  const [ngo, setNgo] = useState<NgoUser | null>(initialNgo)
  const [requests, setRequests] = useState<VictimRequest[]>([])
  const [showSettings, setShowSettings] = useState(false)

  const [editName, setEditName] = useState(ngo?.name || '')
  const [editLocation, setEditLocation] = useState(ngo?.location || '')
  const [editServices, setEditServices] = useState<string[]>(() =>
    ngo?.serviceType ? ngo.serviceType.split(',').map(s => s.trim()).filter(Boolean) : []
  )
  const [branchesText, setBranchesText] = useState(ngo?.branches?.join('\n') || '')
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [oldPhone, setOldPhone] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [settingsError, setSettingsError] = useState<string | null>(null)
  const [showPasswordSection, setShowPasswordSection] = useState(false)
  const [settingsSection, setSettingsSection] = useState<'profile' | 'services' | 'appearance' | 'security' | 'account'>('profile')

  useEffect(() => {
    if (!ngo) return
    setRequests(getVictimRequests())
  }, [ngo])

  if (!ngo) {
    return (
      <div className="container py-10">
        <div className="card p-6 max-w-xl">
          <h1 className="text-xl font-semibold mb-2">NGO Dashboard</h1>
          <p className="text-sm opacity-80 mb-4">Please sign in as an NGO to view tasks assigned in your area.</p>
          <button className="button-primary" onClick={() => navigate('/ngo/login')}>Go to NGO Sign In</button>
        </div>
      </div>
    )
  }

  function handleStatusChange(id: string, status: RequestStatus) {
    updateVictimRequestStatus(id, status)
    if (status === 'completed' && ngo) {
      assignNgoToVictim(id, ngo.id)
    }
    setRequests(getVictimRequests())
  }

  function openMap(r: VictimRequest) {
    const origin = encodeURIComponent(ngo!.location)
    const destination = encodeURIComponent(r.location)
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`
    window.open(url, '_blank')
  }

  function handleContact(r: VictimRequest) {
    if (!r.contact) {
      window.alert('No contact information provided by this victim.')
      return
    }
    const value = r.contact.trim()
    if (!value) {
      window.alert('No contact information provided by this victim.')
      return
    }
    if (value.includes('@')) {
      window.location.href = `mailto:${value}`
    } else {
      window.location.href = `tel:${value}`
    }
  }

  function toggleService(key: string) {
    setEditServices(prev =>
      prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key]
    )
  }

  function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault()
    if (!ngo) return
    setSettingsError(null)

    let nextPassword = ngo.password
    if (showPasswordSection && (oldPassword || newPassword)) {
      if (oldPassword !== ngo.password) {
        setSettingsError('Old password does not match')
        return
      }
      if (!newPassword.trim()) {
        setSettingsError('New password cannot be empty')
        return
      }
      nextPassword = newPassword.trim()
    }

    // phone change security: require old phone to match
    let nextPhone = ngo.phone
    if (oldPhone || newPhone) {
      if (oldPhone.trim() !== ngo.phone) {
        setSettingsError('Old phone number does not match')
        return
      }
      if (!newPhone.trim()) {
        setSettingsError('New phone number cannot be empty')
        return
      }
      nextPhone = newPhone.trim()
    }

    const updated: NgoUser = {
      ...ngo,
      name: editName.trim() || ngo.name,
      phone: nextPhone,
      address: ngo.address,
      location: editLocation.trim() || ngo.location,
      serviceType: editServices.length ? editServices.join(', ') : ngo.serviceType,
      branches: branchesText
        .split('\n')
        .map(b => b.trim())
        .filter(Boolean),
      theme: 'light',
      password: nextPassword,
    }

    updateNgo(updated)
    setNgo(updated)
    setShowSettings(false)
    setOldPassword('')
    setNewPassword('')
    setOldPhone('')
    setNewPhone('')
  }

  function handleLogout() {
    logoutAll()
    navigate('/')
  }

  const todo = requests.filter(r => r.status === 'to_do' || r.status === 'in_progress' || r.status === 'reached')
  const done = requests.filter(r => r.status === 'completed')

  const serviceLabel = ngo.serviceType
  const containerClasses = 'min-h-screen bg-gradient-to-b from-white via-secondary/40 to-white text-slate-700 py-10 px-4'
  const settingsCardClasses = 'bg-white text-slate-700 border border-blue-100 rounded-2xl w-full max-w-3xl p-6 text-sm max-h-[80vh] overflow-y-auto shadow-card'

  return (
    <div className={containerClasses}>
      <div className="flex items-center justify-between mb-6 max-w-6xl mx-auto">
        <div>
          <p className="text-xs font-semibold tracking-[0.3em] text-slate-400 uppercase">Relief control room</p>
          <h1 className="text-3xl font-semibold text-slate-800">NGO Task Dashboard</h1>
          <p className="text-sm text-slate-500">{ngo.name} — {serviceLabel} in {ngo.location}</p>
        </div>
        <button
          className="px-3 py-1.5 rounded-full border border-blue-100 bg-white text-xs text-slate-600"
          onClick={() => setShowSettings(true)}
        >
          Settings
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-6 max-w-6xl mx-auto">
        <section className="bg-white border border-blue-100 rounded-2xl p-5 shadow-card">
          <h2 className="text-lg font-semibold mb-2">To Do</h2>
          {todo.length === 0 ? (
            <p className="text-sm text-slate-500">No pending tasks yet. New victim requests will appear here.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {todo.map(r => (
                <li key={r.id} className="border border-blue-50 rounded-xl px-4 py-3 bg-white/70">
                  <div className="flex justify-between items-center mb-1">
                    <div>
                      <div className="font-medium">{r.victimName}</div>
                      <div className="text-[11px] text-slate-500">{r.disasterType.toUpperCase()}</div>
                      {r.contact && (
                        <div className="text-[11px] text-slate-500">Contact: {r.contact}</div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button className="px-2 py-1 text-xs rounded-full border border-blue-100 text-slate-600" onClick={() => openMap(r)}>
                        Map
                      </button>
                      <button className="px-2 py-1 text-xs rounded-full border border-blue-100 text-slate-600" onClick={() => handleContact(r)}>
                        Contact
                      </button>
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 mb-1">{r.location}</div>
                  <div className="flex gap-2 flex-wrap text-[11px] mt-1">
                    <span>Status:</span>
                    {(['to_do', 'in_progress', 'reached', 'completed'] as RequestStatus[]).map(st => (
                      <button
                        key={st}
                        className={`px-2 py-0.5 rounded-full border ${r.status === st ? 'border-primary bg-primary/20 text-primary' : 'border-slate-100 text-slate-500'}`}
                        onClick={() => handleStatusChange(r.id, st)}
                      >
                        {st.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-white border border-blue-100 rounded-2xl p-5 shadow-card">
          <h2 className="text-lg font-semibold mb-2">Done</h2>
          {done.length === 0 ? (
            <p className="text-sm text-slate-500">Completed tasks will move here automatically.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {done.map(r => (
                <li key={r.id} className="border border-blue-50 rounded-xl px-3 py-2 bg-white/70">
                  <div className="flex justify-between items-center mb-1">
                    <div className="font-medium">{r.victimName}</div>
                    <span className="text-[11px] text-slate-500">{r.disasterType.toUpperCase()}</span>
                  </div>
                  <div className="text-xs text-slate-500">{r.location}</div>
                  <div className="text-[11px] text-slate-400 mt-1">Completed — {new Date(r.createdAt).toLocaleString()}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {showSettings && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-[9999]">
          <div
            className={settingsCardClasses}
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold mb-1">NGO Settings</h2>
            <p className="text-[11px] text-slate-500 mb-3">Manage your profile, services, and security.</p>
            <form className="flex gap-4" onSubmit={handleSaveSettings}>
              <aside className="w-32 flex flex-col gap-1 text-xs border-r border-blue-50 pr-3">
                {[
                  { id: 'profile', label: 'Profile' },
                  { id: 'services', label: 'Services' },
                  { id: 'security', label: 'Security' },
                  { id: 'account', label: 'Account' },
                ].map(item => (
                  <button
                    key={item.id}
                    type="button"
                    className={`text-left px-2 py-1 rounded-md border ${
                      settingsSection === item.id
                        ? 'border-primary bg-primary/20 text-primary'
                        : 'border-transparent hover:border-blue-100'
                    }`}
                    onClick={() => setSettingsSection(item.id as any)}
                  >
                    {item.label}
                  </button>
                ))}
              </aside>
              <div className="flex-1 flex flex-col justify-between gap-3">
                <div className="space-y-3 text-sm">
                  {settingsSection === 'profile' && (
                    <>
                      <div className="space-y-1">
                        <label className="font-medium">Name</label>
                        <input className="input" value={editName} onChange={e => setEditName(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <label className="font-medium">Phone number</label>
                        <p className="text-[11px] opacity-70">Enter your old and new phone to update.</p>
                        <input
                          className="input mb-1"
                          placeholder="Old phone number"
                          value={oldPhone}
                          onChange={e => setOldPhone(e.target.value)}
                        />
                        <input
                          className="input"
                          placeholder="New phone number"
                          value={newPhone}
                          onChange={e => setNewPhone(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="font-medium">Operating location (city / area)</label>
                        <textarea
                          className="input min-h-[60px]"
                          value={editLocation}
                          onChange={e => setEditLocation(e.target.value)}
                        />
                      </div>
                    </>
                  )}

                  {settingsSection === 'services' && (
                    <>
                      <div className="space-y-1">
                        <label className="font-medium">Services provided</label>
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
                                checked={editServices.includes(key)}
                                onChange={() => toggleService(key)}
                              />
                              <span>{key}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="font-medium">Branches (one per line)</label>
                        <textarea
                          className="input min-h-[80px]"
                          placeholder="Chennai - ...\nDelhi - ..."
                          value={branchesText}
                          onChange={e => setBranchesText(e.target.value)}
                        />
                      </div>
                    </>
                  )}

                  {settingsSection === 'security' && (
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <label className="font-medium">Change password</label>
                        <p className="text-[11px] opacity-70">Update your password by entering the old and new values.</p>
                        <input
                          className="input mb-1"
                          type="password"
                          placeholder="Old password"
                          value={oldPassword}
                          onChange={e => setOldPassword(e.target.value)}
                        />
                        <input
                          className="input"
                          type="password"
                          placeholder="New password"
                          value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {settingsSection === 'account' && (
                    <div className="space-y-2 text-sm">
                      <p className="text-[11px] opacity-70">
                        Account controls for this NGO. You can log out from this device using the button below.
                      </p>
                    </div>
                  )}

                  {settingsError && <div className="text-xs text-danger">{settingsError}</div>}
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-full border border-white/20 text-xs"
                      onClick={() => setShowSettings(false)}
                    >
                      Close
                    </button>
                    <button type="submit" className="button-primary text-xs px-4 py-1.5">
                      Save changes
                    </button>
                  </div>
                  <button
                    type="button"
                    className="w-full px-3 py-1.5 rounded-full border border-red-400/70 text-xs text-red-300"
                    onClick={handleLogout}
                  >
                    Logout
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
