import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function RescueHome() {
  const navigate = useNavigate()
  const [authMode, setAuthMode] = useState<'signin' | 'register' | null>(null)

  function openAuth(mode: 'signin' | 'register') {
    setAuthMode(mode)
  }

  function handleRoleClick(role: 'victim' | 'ngo' | 'admin') {
    if (!authMode) return
    if (role === 'victim') navigate(authMode === 'signin' ? '/victim/login' : '/victim/register')
    if (role === 'ngo') navigate(authMode === 'signin' ? '/ngo/login' : '/ngo/register')
    if (role === 'admin') navigate(authMode === 'signin' ? '/admin/login' : '/admin/register')
    setAuthMode(null)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col">
      {/* Top bar with Sign In / Register in the right corner */}
      <header className="w-full px-6 py-4 flex items-center justify-between">
        <div />
        <div className="flex gap-3 text-sm">
          <button
            className="px-4 py-2 rounded-full border border-white/20 hover:bg-white/5"
            onClick={() => openAuth('signin')}
          >
            Sign In
          </button>
          <button
            className="px-4 py-2 rounded-full bg-primary text-slate-950 font-medium hover:bg-primary/90"
            onClick={() => openAuth('register')}
          >
            Register
          </button>
        </div>
      </header>

      {/* Center content: name, tagline, and three options */}
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="text-center max-w-xl w-full">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">RescueTech</h1>
          <p className="text-base md:text-lg opacity-80 mb-10">
            A simple, smart, powerful app that connects you with the right help when every second matters.
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            <button
              className="px-4 py-3 rounded-lg border border-white/20 hover:bg-white/5 text-sm font-medium"
              onClick={() => navigate('/victim/emergency')}
            >
              Emergency Request
            </button>
            <button
              className="px-4 py-3 rounded-lg border border-white/20 hover:bg-white/5 text-sm font-medium"
              onClick={() => navigate('/ngo/login')}
            >
              NGO
            </button>
            <button
              className="px-4 py-3 rounded-lg border border-white/20 hover:bg-white/5 text-sm font-medium"
              onClick={() => navigate('/admin/login')}
            >
              Admin
            </button>
          </div>
        </div>
      </main>

      {authMode && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-40">
          <div className="bg-slate-900 border border-white/15 rounded-xl w-full max-w-md p-6 relative">
            <button
              className="absolute top-3 right-3 text-xs opacity-70 hover:opacity-100"
              onClick={() => setAuthMode(null)}
            >
              Close
            </button>
            <h2 className="text-xl font-semibold mb-2 text-center">
              {authMode === 'signin' ? 'Sign In' : 'Register'} as
            </h2>
            <p className="text-xs opacity-80 text-center mb-4">Choose your role to continue</p>
            <div className="grid grid-cols-1 gap-3">
              <button
                className="card p-3 flex flex-col items-center hover:bg-white/5"
                onClick={() => handleRoleClick('victim')}
              >
                <div className="font-semibold">Victim</div>
                <div className="text-[11px] opacity-75">Access your requests and guidance</div>
              </button>
              <button
                className="card p-3 flex flex-col items-center hover:bg-white/5"
                onClick={() => handleRoleClick('ngo')}
              >
                <div className="font-semibold">NGO</div>
                <div className="text-[11px] opacity-75">Coordinate rescue and relief tasks</div>
              </button>
              <button
                className="card p-3 flex flex-col items-center hover:bg-white/5"
                onClick={() => handleRoleClick('admin')}
              >
                <div className="font-semibold">Admin</div>
                <div className="text-[11px] opacity-75">Monitor NGOs and incidents</div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
