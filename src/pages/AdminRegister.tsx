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
    <div className="container max-w-xl py-10 md:py-16">
      <div className="card p-6 md:p-8">
        <h1 className="text-2xl font-semibold mb-2 text-center">Admin Registration</h1>
        <p className="text-sm opacity-80 mb-4 text-center">Only users with the predefined Admin ID can register as system admins.</p>
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
          <button type="submit" className="button-primary w-full mt-2">Register Admin</button>
        </form>
      </div>
    </div>
  )
}
