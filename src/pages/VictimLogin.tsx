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
    <div className="min-h-screen bg-gradient-to-b from-white via-secondary/40 to-white text-slate-700 flex items-center justify-center px-4 py-12">
      <div className="bg-white border border-blue-100 rounded-2xl p-6 md:p-8 shadow-card w-full max-w-lg">
        <button
          type="button"
          className="text-xs text-slate-500 underline mb-3"
          onClick={() => navigate('/')}
        >
          ← Back to home
        </button>
        <h1 className="text-2xl font-semibold mb-2 text-center text-slate-800">Victim Sign In</h1>
        <p className="text-sm text-slate-500 mb-6 text-center">
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
          <div className="text-xs text-right text-slate-500">Forgot password? <span className="italic">Contact admin in this demo</span></div>
          <button type="submit" className="button-primary w-full mt-2">Continue</button>
        </form>
      </div>
    </div>
  )
}
