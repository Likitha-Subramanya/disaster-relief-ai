import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, ShieldCheck, Radio } from 'lucide-react'

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
    <div className="min-h-screen bg-gradient-to-b from-background via-white to-secondary/30 text-foreground flex flex-col relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 right-[-40px] w-64 h-64 bg-primary/30 blur-[100px] animate-pulse" />
        <div className="absolute bottom-10 left-[-60px] w-72 h-72 bg-accent/20 blur-[90px] animate-[pulse_6s_ease-in-out_infinite]" />
        <svg className="absolute top-12 left-1/2 -translate-x-1/2 w-[500px] opacity-40" viewBox="0 0 600 600" xmlns="http://www.w3.org/2000/svg">
          <g transform="translate(300,300)">
            <path
              d="M120 -147C164 -104 216 -78 228 -38C240 2 211 56 178 118C145 180 108 250 50 257C-8 264 -86 208 -141 154C-196 100 -228 48 -230 -9C-232 -66 -205 -128 -160 -169C-115 -210 -52 -230 4 -234C60 -238 120 -226 120 -147"
              fill="url(#gradient)"
            />
            <defs>
              <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fbcfe8" />
                <stop offset="100%" stopColor="#7dd3fc" />
              </linearGradient>
            </defs>
          </g>
        </svg>
      </div>

      <header className="w-full px-6 py-5 flex items-center justify-between relative z-10">
        <span className="text-xs font-semibold tracking-widest text-slate-500 uppercase">On duty 24/7</span>
        <div className="flex gap-3 text-sm">
          <button
            className="px-4 py-2 rounded-full border border-blue-100 bg-white/80 text-slate-600 hover:border-primary/60"
            onClick={() => openAuth('signin')}
          >
            Sign In
          </button>
          <button
            className="px-4 py-2 rounded-full bg-primary text-primary-foreground font-medium shadow-lg shadow-primary/30"
            onClick={() => openAuth('register')}
          >
            Get Started
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 pb-12 relative z-10">
        <div className="grid md:grid-cols-2 gap-10 w-full max-w-6xl items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-white/80 border border-blue-100 text-xs font-semibold text-slate-600">
              <Sparkles className="w-4 h-4 text-accent" /> AI-powered relief orchestration
            </div>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight text-slate-800">
              AI-powered Disaster Management & Relief Coordination Platform
            </h1>
            <p className="text-base md:text-lg text-slate-500">
              Capture victim stories via text, voice, or images. Our triage AI classifies needs, assigns the best NGO, and keeps every request synced even when the network disappears.
            </p>
            <div className="flex flex-wrap gap-3 text-sm">
              <button
                className="button-primary"
                onClick={() => navigate('/victim/emergency')}
              >
                Request urgent help
              </button>
              <button
                className="px-4 py-2 rounded-lg border border-blue-100 bg-white/80 text-slate-600 hover:border-primary/60"
                onClick={() => navigate('/ngo/register')}
              >
                Onboard my NGO
              </button>
            </div>
            {/* Badges removed per request: removed AI triage and live routing summary blocks */}
          </div>

          <div className="relative">
            <div className="absolute -top-5 -right-5 w-24 h-24 bg-primary/30 blur-3xl animate-spin" />
            <div className="bg-white/90 border border-blue-100 rounded-3xl p-6 shadow-card backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400 mb-4">Choose your portal</p>
              <div className="grid gap-4">
                {[
                  { label: 'Emergency request', desc: 'Victims & first responders', action: () => navigate('/victim/emergency') },
                  { label: 'NGO task room', desc: 'Relief teams & coordinators', action: () => navigate('/ngo/login') },
                  { label: 'Command dashboard', desc: 'Authorities & admins', action: () => navigate('/admin/login') },
                ].map(card => (
                  <button
                    key={card.label}
                    className="text-left bg-white border border-blue-100 rounded-2xl px-4 py-3 hover:border-primary/40 transition shadow-sm"
                    onClick={card.action}
                  >
                    <div className="text-sm font-semibold text-slate-700">{card.label}</div>
                    <div className="text-[11px] text-slate-500">{card.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {authMode && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-40">
          <div className="bg-white border border-blue-100 rounded-2xl w-full max-w-lg p-6 relative shadow-card">
            <button
              className="absolute top-4 right-4 text-xs text-slate-400 hover:text-slate-600"
              onClick={() => setAuthMode(null)}
            >
              Close
            </button>
            <h2 className="text-xl font-semibold mb-1 text-center text-slate-800">
              {authMode === 'signin' ? 'Sign in' : 'Register'} as
            </h2>
            <p className="text-xs text-slate-500 text-center mb-4">Choose your role to continue</p>
            <div className="grid grid-cols-1 gap-3">
              {[
                { role: 'victim', label: 'Victim', desc: 'Access requests & safety guidance' },
                { role: 'ngo', label: 'NGO', desc: 'Coordinate rescue and relief tasks' },
                { role: 'admin', label: 'Admin', desc: 'Monitor NGOs and incidents' },
              ].map(item => (
                <button
                  key={item.role}
                  className="bg-white border border-blue-100 rounded-2xl p-4 text-left hover:border-primary/60 transition"
                  onClick={() => handleRoleClick(item.role as any)}
                >
                  <div className="font-semibold text-slate-700">{item.label}</div>
                  <div className="text-[11px] text-slate-500">{item.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
