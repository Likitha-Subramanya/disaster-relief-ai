import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { signInAdmin, setCurrentRole } from '../store/rescue'

export default function AdminLogin() {
  const navigate = useNavigate()
  const [adminId, setAdminId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const res = signInAdmin(adminId.trim(), password)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setCurrentRole('admin')
    navigate('/admin/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-secondary/40 to-white text-slate-700 flex items-center justify-center px-4 py-12">
      <div className="bg-white border border-blue-100 rounded-2xl p-6 md:p-8 shadow-card w-full max-w-lg">
        <button
          type="button"
          className="text-xs text-slate-500 underline mb-3"
          onClick={() => navigate('/')}
        >
          ← Back to home
        </button>
        <p className="text-xs font-semibold tracking-[0.3em] text-slate-400 uppercase text-center mb-2">Admin console</p>
        <h1 className="text-2xl font-semibold mb-2 text-center text-slate-800">Admin Sign In</h1>
        <p className="text-sm text-slate-500 mb-5 text-center">Use your system Admin ID to monitor all NGOs and operations.</p>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1 text-sm">
            <label className="font-medium">Admin ID</label>
            <input className="input" value={adminId} onChange={e => setAdminId(e.target.value)} />
          </div>
          <div className="space-y-1 text-sm">
            <label className="font-medium">Password</label>
            <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          {error && <div className="text-xs text-danger">{error}</div>}
          <button type="submit" className="button-primary w-full mt-2">Sign In</button>
        </form>
        <div className="text-xs text-slate-500 mt-4 text-center">
          Need access?{' '}
          <Link to="/admin/register" className="text-primary underline">Request Admin registration</Link>
        </div>
      </div>
    </div>
  )
}
