import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getAdminUsers,
  getCurrentAdmin,
  getNgoUsers,
  getVictimRequests,
  VictimRequest,
  NgoUser,
  assignNgoToVictim,
  deleteNgo,
  adminAddNgo,
} from '../store/rescue'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const admin = getCurrentAdmin()
  const [victims, setVictims] = useState<VictimRequest[]>([])
  const [tab, setTab] = useState<'overview' | 'ngos' | 'victims' | 'manageNgos'>('overview')
  const [selectedNgoFilter, setSelectedNgoFilter] = useState<string>('all')

  const ngos = getNgoUsers()
  const admins = getAdminUsers()

  const [newNgoName, setNewNgoName] = useState('')
  const [newNgoEmail, setNewNgoEmail] = useState('')
  const [newNgoPassword, setNewNgoPassword] = useState('')
  const [newNgoPhone, setNewNgoPhone] = useState('')
  const [newNgoLocation, setNewNgoLocation] = useState('')
  const [newNgoServices, setNewNgoServices] = useState('')
  const [manageError, setManageError] = useState<string | null>(null)

  useEffect(() => {
    const load = () => {
      setVictims(getVictimRequests())
    }
    load()
    const id = setInterval(load, 4000)
    return () => clearInterval(id)
  }, [])

  if (!admin) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white via-secondary/40 to-white text-slate-700 flex items-center justify-center px-4 py-10">
        <div className="bg-white border border-blue-100 rounded-2xl p-6 md:p-8 shadow-card max-w-xl w-full text-center space-y-4">
          <p className="text-xs font-semibold tracking-[0.3em] text-slate-400 uppercase">Admin console</p>
          <h1 className="text-2xl font-semibold text-slate-800">Admin Dashboard</h1>
          <p className="text-sm text-slate-500">Please sign in as Admin to monitor NGOs and operations.</p>
          <button className="button-primary w-full" onClick={() => navigate('/admin/login')}>
            Go to Admin Sign In
          </button>
        </div>
      </div>
    )
  }

  const activeTasks = victims.filter(v => v.status !== 'completed')
  const completedTasks = victims.filter(v => v.status === 'completed')

  function getNgoById(id: string | undefined): NgoUser | undefined {
    if (!id) return undefined
    return ngos.find(n => n.id === id)
  }

  function handleAssignNgo(victimId: string, ngoId: string) {
    assignNgoToVictim(victimId, ngoId === 'none' ? null : ngoId)
    setVictims(getVictimRequests())
  }

  function handleDeleteNgo(id: string) {
    if (!window.confirm('Remove this NGO from the system?')) return
    deleteNgo(id)
  }

  function handleAddNgo(e: React.FormEvent) {
    e.preventDefault()
    setManageError(null)
    if (!newNgoName.trim() || !newNgoEmail.trim() || !newNgoPassword.trim()) {
      setManageError('Name, email, and password are required to add an NGO')
      return
    }
    const res = adminAddNgo({
      name: newNgoName.trim(),
      email: newNgoEmail.trim(),
      password: newNgoPassword,
      phone: newNgoPhone.trim() || 'Not provided',
      address: newNgoLocation.trim() || 'Not provided',
      location: newNgoLocation.trim() || 'Not provided',
      serviceType: newNgoServices.trim() || 'General support',
    })
    if (!res.ok) {
      setManageError(res.error)
      return
    }
    setNewNgoName('')
    setNewNgoEmail('')
    setNewNgoPassword('')
    setNewNgoPhone('')
    setNewNgoLocation('')
    setNewNgoServices('')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-secondary/40 to-white text-slate-700 py-10 px-4">
      <div className="flex items-center justify-between mb-6 max-w-6xl mx-auto">
        <div>
          <p className="text-xs font-semibold tracking-[0.3em] text-slate-400 uppercase">Command & control</p>
          <h1 className="text-3xl font-semibold text-slate-800">Admin Control Center</h1>
          <p className="text-sm text-slate-500">Welcome, {admin.name}. System Admins: {admins.length}</p>
        </div>
        <button className="px-3 py-1.5 rounded-full border border-blue-100 bg-white text-xs text-slate-600" onClick={() => navigate('/')}>Home</button>
      </div>

      <div className="flex gap-2 text-xs mb-6 max-w-6xl mx-auto">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'ngos', label: 'NGOs' },
          { id: 'victims', label: 'Victims' },
          { id: 'manageNgos', label: 'Manage NGOs' },
        ].map(item => (
          <button
            key={item.id}
            className={`px-3 py-1.5 rounded-full border ${
              tab === item.id ? 'border-primary bg-primary/20 text-primary' : 'border-slate-100 text-slate-500'
            }`}
            onClick={() => setTab(item.id as any)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          <section className="bg-white border border-blue-100 rounded-2xl p-5 shadow-card">
            <h2 className="text-lg font-semibold mb-2">Summary</h2>
            <ul className="text-sm space-y-1">
              <li>Total NGOs: {ngos.length}</li>
              <li>Total victim requests: {victims.length}</li>
              <li>Active requests: {activeTasks.length}</li>
              <li>Completed requests: {completedTasks.length}</li>
            </ul>
          </section>
          <section className="bg-white border border-blue-100 rounded-2xl p-5 shadow-card md:col-span-1 lg:col-span-2">
            <h2 className="text-lg font-semibold mb-2">Recent Victim Requests</h2>
            {victims.length === 0 ? (
              <p className="text-sm text-slate-500">As victims submit requests, they will appear here.</p>
            ) : (
              <div className="max-h-64 overflow-auto text-sm">
                <table className="w-full text-left text-xs">
                  <thead className="bg-blue-50 text-slate-600">
                    <tr>
                      <th className="px-2 py-1">Name</th>
                      <th className="px-2 py-1">Disaster</th>
                      <th className="px-2 py-1">Status</th>
                      <th className="px-2 py-1">Assigned NGO</th>
                      <th className="px-2 py-1">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {victims.map(v => {
                      const aNgo = getNgoById(v.assignedNgoId)
                      return (
                        <tr key={v.id} className="border-b border-blue-50">
                          <td className="px-2 py-1">{v.victimName}</td>
                          <td className="px-2 py-1 text-[11px]">{v.disasterType.toUpperCase()}</td>
                          <td className="px-2 py-1 text-[11px] capitalize">{v.status.replace('_', ' ')}</td>
                          <td className="px-2 py-1 text-[11px]">{aNgo ? aNgo.name : 'Unassigned'}</td>
                          <td className="px-2 py-1 text-[11px]">{new Date(v.createdAt).toLocaleString()}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {tab === 'ngos' && (
        <section className="bg-white border border-blue-100 rounded-2xl p-5 shadow-card max-w-6xl mx-auto">
          <h2 className="text-lg font-semibold mb-3">NGOs</h2>
          {ngos.length === 0 ? (
            <p className="text-sm text-slate-500">No NGOs registered yet.</p>
          ) : (
            <div className="max-h-[420px] overflow-auto text-xs">
              <table className="w-full text-left">
                <thead className="bg-blue-50 text-slate-600">
                  <tr>
                    <th className="px-2 py-1">Name</th>
                    <th className="px-2 py-1">Email</th>
                    <th className="px-2 py-1">Location</th>
                    <th className="px-2 py-1">Services</th>
                    <th className="px-2 py-1">Phone</th>
                    <th className="px-2 py-1 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {ngos.map(n => (
                    <tr key={n.id} className="border-b border-blue-50">
                      <td className="px-2 py-1 text-sm">{n.name}</td>
                      <td className="px-2 py-1">{n.email}</td>
                      <td className="px-2 py-1 text-[11px]">{n.location}</td>
                      <td className="px-2 py-1 text-[11px]">{n.serviceType}</td>
                      <td className="px-2 py-1 text-[11px]">{n.phone}</td>
                      <td className="px-2 py-1 text-right">
                        <button
                          className="px-2 py-0.5 rounded-full border border-danger/40 text-[11px] text-danger"
                          onClick={() => handleDeleteNgo(n.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === 'victims' && (
        <section className="bg-white border border-blue-100 rounded-2xl p-5 shadow-card max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Victim Requests</h2>
            <div className="flex items-center gap-2 text-xs">
              <span>Filter by NGO:</span>
              <select
                className="input h-7 px-2 py-1 text-xs"
                value={selectedNgoFilter}
                onChange={e => setSelectedNgoFilter(e.target.value)}
              >
                <option value="all">All</option>
                <option value="unassigned">Unassigned</option>
                {ngos.map(n => (
                  <option key={n.id} value={n.id}>{n.name}</option>
                ))}
              </select>
            </div>
          </div>
          {victims.length === 0 ? (
            <p className="text-sm text-slate-500">No victim requests yet.</p>
          ) : (
            <div className="max-h-[420px] overflow-auto text-xs">
              <table className="w-full text-left">
                <thead className="bg-blue-50 text-slate-600">
                  <tr>
                    <th className="px-2 py-1">Name</th>
                    <th className="px-2 py-1">Location</th>
                    <th className="px-2 py-1">Disaster</th>
                    <th className="px-2 py-1">Status</th>
                    <th className="px-2 py-1">Assigned NGO</th>
                    <th className="px-2 py-1">Contact</th>
                  </tr>
                </thead>
                <tbody>
                  {victims
                    .filter(v => {
                      if (selectedNgoFilter === 'all') return true
                      if (selectedNgoFilter === 'unassigned') return !v.assignedNgoId
                      return v.assignedNgoId === selectedNgoFilter
                    })
                    .map(v => {
                      const aNgo = getNgoById(v.assignedNgoId)
                      return (
                        <tr key={v.id} className="border-b border-blue-50">
                          <td className="px-2 py-1 text-sm">{v.victimName}</td>
                          <td className="px-2 py-1 text-[11px]">{v.location}</td>
                          <td className="px-2 py-1 text-[11px]">{v.disasterType.toUpperCase()}</td>
                          <td className="px-2 py-1 text-[11px] capitalize">{v.status.replace('_', ' ')}</td>
                          <td className="px-2 py-1 text-[11px]">
                            <select
                              className="input h-7 px-1 py-0 text-[11px]"
                              value={v.assignedNgoId || 'none'}
                              onChange={e => handleAssignNgo(v.id, e.target.value)}
                            >
                              <option value="none">Unassigned</option>
                              {ngos.map(n => (
                                <option key={n.id} value={n.id}>{n.name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-1 text-[11px]">{v.contact || 'Not provided'}</td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === 'manageNgos' && (
        <div className="grid md:grid-cols-2 gap-6 max-w-6xl mx-auto">
          <section className="bg-white border border-blue-100 rounded-2xl p-5 shadow-card">
            <h2 className="text-lg font-semibold mb-2">Add new NGO</h2>
            <form className="space-y-2 text-sm" onSubmit={handleAddNgo}>
              <div className="space-y-1">
                <label className="font-medium">Name</label>
                <input className="input" value={newNgoName} onChange={e => setNewNgoName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="font-medium">Email</label>
                <input className="input" value={newNgoEmail} onChange={e => setNewNgoEmail(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="font-medium">Password</label>
                <input
                  className="input"
                  type="password"
                  value={newNgoPassword}
                  onChange={e => setNewNgoPassword(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="font-medium">Phone (optional)</label>
                <input className="input" value={newNgoPhone} onChange={e => setNewNgoPhone(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="font-medium">Location</label>
                <input className="input" value={newNgoLocation} onChange={e => setNewNgoLocation(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="font-medium">Services (comma separated)</label>
                <input className="input" value={newNgoServices} onChange={e => setNewNgoServices(e.target.value)} />
              </div>
              {manageError && <div className="text-xs text-danger">{manageError}</div>}
              <button type="submit" className="button-primary w-full mt-1 text-xs">Add NGO</button>
            </form>
          </section>
          <section className="bg-white border border-blue-100 rounded-2xl p-5 shadow-card">
            <h2 className="text-lg font-semibold mb-2">Existing NGOs</h2>
            {ngos.length === 0 ? (
              <p className="text-sm text-slate-500">No NGOs registered yet.</p>
            ) : (
              <div className="max-h-72 overflow-auto text-xs">
                <table className="w-full text-left">
                  <thead className="bg-blue-50 text-slate-600">
                    <tr>
                      <th className="px-2 py-1">Name</th>
                      <th className="px-2 py-1">Email</th>
                      <th className="px-2 py-1 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ngos.map(n => (
                      <tr key={n.id} className="border-b border-blue-50">
                        <td className="px-2 py-1 text-sm">{n.name}</td>
                        <td className="px-2 py-1">{n.email}</td>
                        <td className="px-2 py-1 text-right">
                          <button
                            className="px-2 py-0.5 rounded-full border border-danger/40 text-[11px] text-danger"
                            onClick={() => handleDeleteNgo(n.id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
