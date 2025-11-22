import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle'|'success'|'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [question, setQuestion] = useState<string | null>(null)
  const [answer, setAnswer] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const debounceRef = useRef<number | null>(null)

  useEffect(() => {
    setQuestion(null)
    setAnswer('')
    setNewPassword('')
  }, [email])

  async function loadQuestion() {
    setError(null)
    if (!email.trim()) { setError('Enter your email'); return }
    try {
      const res = await fetch(`${API_BASE}/api/auth/security-question?email=${encodeURIComponent(email.trim())}`)
      if (!res.ok) throw new Error('HTTP '+res.status)
      const body = await res.json().catch(()=>({}))
      setQuestion(body?.question || null)
      if (!body?.question) {
        setError('No security question set for this account (use email reset).')
      }
    } catch (err:any) {
      setError('Unable to fetch security question')
    }
  }

  async function handleSecurityReset(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email.trim() || !answer.trim() || !newPassword.trim()) { setError('Fill all fields'); return }
    try {
      const res = await fetch(`${API_BASE}/api/auth/reset/security`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), answer: answer.trim(), newPassword })
      })
      const body = await res.json().catch(()=>({}))
      if (!res.ok || body?.ok === false) throw new Error(body?.error || 'Reset failed')
      setStatus('success')
    } catch (err:any) {
      setError(err?.message || 'Security reset failed')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-secondary/40 to-white text-slate-700 flex items-center justify-center px-4 py-12">
      <div className="bg-white border border-blue-100 rounded-2xl p-6 md:p-8 shadow-card w-full max-w-lg">
        <button type="button" className="text-xs text-slate-500 underline mb-3" onClick={() => navigate(-1)}>← Back</button>
        <h1 className="text-2xl font-semibold mb-2 text-center text-slate-800">Forgot Password</h1>
        <p className="text-sm text-slate-500 mb-4 text-center">Enter your email, answer your security question, and set a new password.</p>
        <form className="space-y-4" onSubmit={handleSecurityReset}>
          <div className="space-y-1 text-sm">
            <label className="font-medium">Email</label>
            <input className="input" type="email" value={email} onChange={e => {
              setEmail(e.target.value)
              setError(null)
              if (debounceRef.current) window.clearTimeout(debounceRef.current)
              debounceRef.current = window.setTimeout(() => { if (e.target.value.trim()) loadQuestion() }, 500)
            }} placeholder="your@email.com" />
          </div>
          {question !== null && (
            <>
              <div className="text-xs text-slate-600">Security question: <span className="font-medium">{question || 'Not set'}</span></div>
              <div className="space-y-1 text-sm">
                <label className="font-medium">Your answer</label>
                <input className="input" value={answer} onChange={e => setAnswer(e.target.value)} />
              </div>
              <div className="space-y-1 text-sm">
                <label className="font-medium">New password</label>
                <input className="input" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
              </div>
              <button type="submit" className="button-primary w-full mt-2">Reset password</button>
            </>
          )}
          {error && <div className="text-xs text-danger mt-2">{error}</div>}
          {status === 'success' && <div className="text-xs text-green-600 mt-2">Password updated. You can sign in now.</div>}
        </form>
      </div>
    </div>
  )
}
