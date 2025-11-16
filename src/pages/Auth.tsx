import { useState } from 'react'
import { registerUser, signIn } from '../store/auth'
import { useNavigate } from 'react-router-dom'

export default function Auth() {
  const [tab, setTab] = useState<'signin'|'register'>('signin')
  const [error, setError] = useState<string|null>(null)
  const navigate = useNavigate()
  return (
    <div className="container py-12 md:py-16 max-w-xl">
      <div className="card p-6 md:p-8">
        <h1 className="text-2xl font-semibold text-center">Welcome to RESCUE.AI</h1>
        <div className="mt-4 flex gap-6 justify-center text-sm">
          <button className={"pb-1 "+(tab==='signin'?'border-b-2 border-primary':'opacity-70')} onClick={()=> setTab('signin')}>Sign In</button>
          <button className={"pb-1 "+(tab==='register'?'border-b-2 border-primary':'opacity-70')} onClick={()=> setTab('register')}>Register</button>
        </div>
        {tab==='signin' ? (
          <SigninForm onError={setError} onSuccess={()=> navigate('/')} />
        ) : (
          <RegisterForm onError={setError} onSuccess={()=> navigate('/')} />
        )}
        {error && <div className="mt-3 text-sm text-danger text-center">{error}</div>}
      </div>
    </div>
  )
}

function SigninForm({ onError, onSuccess }: { onError:(e:string|null)=>void; onSuccess:()=>void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  return (
    <form className="mt-6 space-y-4" onSubmit={(e)=>{ e.preventDefault(); onError(null); const r = signIn(email, password); if (!r.ok) onError(r.error); else onSuccess() }}>
      <input className="input" placeholder="Email" value={email} onChange={e=> setEmail(e.target.value)} />
      <input className="input" type="password" placeholder="Password" value={password} onChange={e=> setPassword(e.target.value)} />
      <button className="button-primary w-full" type="submit">Sign In</button>
      <div className="text-xs opacity-70 text-center">Forgot Password?</div>
    </form>
  )
}

function RegisterForm({ onError, onSuccess }: { onError:(e:string|null)=>void; onSuccess:()=>void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  return (
    <form className="mt-6 space-y-4" onSubmit={(e)=>{ e.preventDefault(); onError(null); if (!name.trim()||!email.trim()||!password.trim()) { onError('All fields are required'); return } const r = registerUser({ name, email, password }); if (!r.ok) onError(r.error); else onSuccess() }}>
      <input className="input" placeholder="Name" value={name} onChange={e=> setName(e.target.value)} />
      <input className="input" placeholder="Email" value={email} onChange={e=> setEmail(e.target.value)} />
      <input className="input" type="password" placeholder="Password" value={password} onChange={e=> setPassword(e.target.value)} />
      <button className="button-primary w-full" type="submit">Create Account</button>
    </form>
  )
}
