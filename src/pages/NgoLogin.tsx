import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { signInNgo, setCurrentRole } from '../store/rescue'

export default function NgoLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const res = signInNgo(email, password)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setCurrentRole('ngo')
    navigate('/ngo/dashboard')
  }

  return (
    <div className="container max-w-xl py-10 md:py-16">
      <div className="card p-6 md:p-8">
        <h1 className="text-2xl font-semibold mb-2 text-center">NGO Sign In</h1>
        <p className="text-sm opacity-80 mb-4 text-center">Log in to view tasks near you and update progress.</p>
        <form className="space-y-4" onSubmit={handleSubmit} autoComplete="off">
          <div className="space-y-1 text-sm">
            <label className="font-medium">Email</label>
            <input
              className="input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="off"
              name="ngo-email"
            />
          </div>
          <div className="space-y-1 text-sm">
            <label className="font-medium">Password</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="new-password"
              name="ngo-password"
            />
          </div>
          {error && <div className="text-xs text-danger">{error}</div>}
          <button type="submit" className="button-primary w-full mt-2">Sign In</button>
        </form>
        <div className="text-xs opacity-80 mt-4 text-center">
          New NGO?{' '}
          <Link to="/ngo/register" className="text-primary underline">Register here</Link>
        </div>
      </div>
    </div>
  )
}
