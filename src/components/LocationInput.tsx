import { useEffect, useState } from 'react'
import { geocodeAddress, reverseGeocode } from '../services/geocode'

export interface LocationValue { lat: number; lng: number; label?: string }

export default function LocationInput({ value, onChange }: { value?: LocationValue; onChange: (loc: LocationValue)=>void }) {
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)

  // Keep input in sync when parent-provided value changes
  useEffect(()=>{
    if (value?.label) setQuery(value.label)
  }, [value?.label])

  async function useAddress() {
    if (!query.trim()) return
    setBusy(true)
    try {
      const res = await geocodeAddress(query.trim())
      if (res) {
        setQuery(res.displayName)
        onChange({ lat: res.lat, lng: res.lng, label: res.displayName })
      }
      else alert('Address not found')
    } finally { setBusy(false) }
  }

  function useMyLocation() {
    if (!('geolocation' in navigator)) { alert('Geolocation not supported'); return }
    setBusy(true)
    navigator.geolocation.getCurrentPosition(async (pos)=>{
      const { latitude: lat, longitude: lng } = pos.coords
      let label: string | undefined = undefined
      try {
        const rev = await reverseGeocode(lat, lng)
        label = rev?.displayName || 'Current location'
      } catch {}
      onChange({ lat, lng, label })
      if (label) setQuery(label)
      setBusy(false)
    }, ()=>{ setBusy(false); alert('Failed to get location') })
  }

  return (
    <div className="space-y-2">
      <div className="text-sm opacity-80">Location</div>
      <div className="grid gap-2 sm:grid-cols-3">
        <input
          className="input sm:col-span-2"
          placeholder="Type address or landmark"
          value={query}
          onChange={e=> setQuery(e.target.value)}
          onKeyDown={(e)=> { if (e.key==='Enter') { e.preventDefault(); useAddress() } }}
        />
        <button type="button" className="button-primary" onClick={useAddress} disabled={busy}>Search</button>
      </div>
      <div>
        <button type="button" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5" onClick={useMyLocation} disabled={busy}>
          Use my current location
        </button>
      </div>
      {value && <div className="text-xs opacity-70">Selected: {value.label || `${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}`}</div>}
    </div>
  )
}
