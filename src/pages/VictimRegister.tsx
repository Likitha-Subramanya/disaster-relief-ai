import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { setCurrentVictim } from '../store/rescue'
import { registerUser } from '../store/auth'

export default function VictimRegister() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [city, setCity] = useState('')
  const [address, setAddress] = useState('')
  const [contact, setContact] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim() || !password.trim() || !city.trim() || !address.trim() || !contact.trim()) {
      setError('Please fill in all details to register.')
      return
    }

    setLoading(true)
    setError(null)

    const localRes = registerUser({
      name: name.trim(),
      email: email.trim(),
      password: password.trim(),
    })
    if (!localRes.ok) {
      setError(localRes.error)
      setLoading(false)
      return
    }

    setCurrentVictim({
      name: name.trim(),
      email: email.trim(),
      password: password.trim(),
      location: city.trim(),
      address: address.trim(),
      contact: contact.trim(),
    })

    try {
      await fetch('http://localhost:4000/api/victims/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password: password.trim(),
          city: city.trim(),
          address: address.trim(),
          contact: contact.trim(),
        }),
      })
    } catch {
    }

    setLoading(false)
    navigate('/victim/login')
  }

  return (
    <div className="container max-w-xl py-10 md:py-16">
      <div className="card p-6 md:p-8">
        <h1 className="text-2xl font-semibold mb-2 text-center">Victim Register</h1>
        <p className="text-sm opacity-80 mb-6 text-center">
          Save your complete details so rescuers can recognise you faster and you can securely sign in later.
        </p>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1 text-sm">
            <label className="font-medium">Name</label>
            <input
              className="input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your full name"
            />
          </div>
          <div className="space-y-1 text-sm">
            <label className="font-medium">Email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email for login and updates"
            />
          </div>
          <div className="space-y-1 text-sm">
            <label className="font-medium">Password</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Create a secure password"
            />
          </div>
          <div className="space-y-1 text-sm">
            <label className="font-medium">City / area</label>
            <input
              className="input"
              value={city}
              onChange={e => setCity(e.target.value)}
              placeholder="City / area so we can show nearby incidents"
            />
          </div>
          <div className="space-y-1 text-sm">
            <label className="font-medium">Full address</label>
            <textarea
              className="input min-h-[70px]"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="House / street, landmark, pincode"
            />
          </div>
          <div className="space-y-1 text-sm">
            <label className="font-medium">Primary contact for rescue</label>
            <input
              className="input"
              value={contact}
              onChange={e => setContact(e.target.value)}
              placeholder="Phone or WhatsApp"
            />
          </div>
          {error && <div className="text-xs text-danger">{error}</div>}
          <button type="submit" className="button-primary w-full mt-2">
            {loading ? 'Creating account…' : 'Create profile'}
          </button>
        </form>
      </div>
    </div>
  )
}
