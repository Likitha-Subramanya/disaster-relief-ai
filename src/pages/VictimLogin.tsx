import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { setCurrentVictim, setCurrentRole } from '../store/rescue'
import { signIn, getCurrentUser } from '../store/auth'

export default function VictimLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password to sign in.')
      return
    }
    setError(null)

    const res = signIn(email.trim(), password.trim())
    if (!res.ok) {
      setError(res.error)
      return
    }

    const user = getCurrentUser()
    if (user) {
      setCurrentVictim({
        name: user.name,
        email: user.email,
        password: user.password,
        location: '',
        address: '',
        contact: '',
      })
    }

    setCurrentRole('victim')
    navigate('/victim/dashboard')
  }

  return (
    <div className="container max-w-xl py-10 md:py-16">
      <div className="card p-6 md:p-8">
        <h1 className="text-2xl font-semibold mb-2 text-center">Victim Sign In</h1>
        <p className="text-sm opacity-80 mb-6 text-center">
          Sign in using the email and password you used during registration so we can show your requests and updates.
        </p>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1 text-sm">
            <label className="font-medium">Email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email used during registration"
            />
          </div>
          <div className="space-y-1 text-sm">
            <label className="font-medium">Password</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Your password"
            />
          </div>
          {error && <div className="text-xs text-danger">{error}</div>}
          <button type="submit" className="button-primary w-full mt-2">Continue</button>
        </form>
      </div>
    </div>
  )
}
