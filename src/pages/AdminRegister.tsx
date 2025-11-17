import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { registerAdmin } from '../store/rescue'

export default function AdminRegister() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [adminId, setAdminId] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('All fields are required')
      return
    }

    const localRes = registerAdmin(name.trim(), email.trim(), password, adminId.trim())
    if (!localRes.ok) {
      setError(localRes.error)
      return
    }

    try {
      await fetch('http://localhost:4000/api/admins/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
        }),
      })
    } catch {
    }

    navigate('/admin/login')
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
        <h1 className="text-2xl font-semibold mb-2 text-center text-slate-800">Admin Registration</h1>
        <p className="text-sm text-slate-500 mb-4 text-center">Only users with the predefined Admin ID can register as system admins.</p>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1 text-sm">
            <label className="font-medium">Name</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-1 text-sm">
            <label className="font-medium">Email</label>
            <input className="input" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1 text-sm">
            <label className="font-medium">Password</label>
            <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <div className="space-y-1 text-sm">
            <label className="font-medium">Admin ID (predefined)</label>
            <input className="input" value={adminId} onChange={e => setAdminId(e.target.value)} />
          </div>
          {error && <div className="text-xs text-danger">{error}</div>}
          <div className="text-xs text-right text-slate-500">Already registered? <span className="italic">Use your email/password on the sign in page.</span></div>
          <button type="submit" className="button-primary w-full mt-2">Register Admin</button>
        </form>
      </div>
    </div>
  )
}
