import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<'idle'|'submitting'|'success'|'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!token.trim() || !password.trim()) { setError('Enter token and new password'); return }
    try {
      setStatus('submitting')
      const res = await fetch(`${API_BASE}/api/auth/reset/verify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim(), newPassword: password })
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setStatus('success')
    } catch (err: any) {
      setStatus('error')
      setError('Reset failed. Check token or try again.')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-secondary/40 to-white text-slate-700 flex items-center justify-center px-4 py-12">
      <div className="bg-white border border-blue-100 rounded-2xl p-6 md:p-8 shadow-card w-full max-w-lg">
        <button type="button" className="text-xs text-slate-500 underline mb-3" onClick={() => navigate(-1)}>← Back</button>
        <h1 className="text-2xl font-semibold mb-2 text-center text-slate-800">Reset Password</h1>
        <p className="text-sm text-slate-500 mb-4 text-center">Paste the reset token and enter a new password.</p>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1 text-sm">
            <label className="font-medium">Reset token</label>
            <input className="input" value={token} onChange={e => setToken(e.target.value)} placeholder="Paste token" />
          </div>
          <div className="space-y-1 text-sm">
            <label className="font-medium">New password</label>
            <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="New password" />
          </div>
          {error && <div className="text-xs text-danger">{error}</div>}
          {status === 'success' && (
            <div className="text-xs text-green-600">Password updated. You can sign in now.</div>
          )}
          <button type="submit" className="button-primary w-full mt-2" disabled={status==='submitting'}>
            {status==='submitting' ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  )
}
