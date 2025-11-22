export interface GeocodeResult { lat: number; lng: number; displayName: string }

export async function geocodeAddress(query: string): Promise<GeocodeResult | null> {
  if (!query || !query.trim()) return null
  const tryOnce = async (q: string) => {
    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.searchParams.set('q', q)
    url.searchParams.set('format', 'json')
    url.searchParams.set('limit', '3')
    url.searchParams.set('addressdetails', '1')
    // prefer concise json response; Accept-Language helps prefer local names
    const res = await fetch(url.toString(), { headers: { 'Accept': 'application/json', 'Accept-Language': 'en' } })
    if (!res.ok) return null
    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) return null
    const item = data[0]
    return { lat: parseFloat(item.lat), lng: parseFloat(item.lon), displayName: item.display_name }
  }

  // Try the raw query first, then append common locality hints to improve matching
  const q0 = query.trim()
  let out = await tryOnce(q0)
  if (out) return out

  const fallbacks = [
    `${q0}, Bengaluru`,
    `${q0}, Bangalore`,
    `${q0}, India`,
  ]
  for (const fb of fallbacks) {
    try {
      out = await tryOnce(fb)
      if (out) return out
    } catch {}
  }

  return null
}

export async function reverseGeocode(lat: number, lng: number): Promise<GeocodeResult | null> {
  const url = new URL('https://nominatim.openstreetmap.org/reverse')
  url.searchParams.set('lat', String(lat))
  url.searchParams.set('lon', String(lng))
  url.searchParams.set('format', 'json')
  const res = await fetch(url.toString(), { headers: { 'Accept': 'application/json' } })
  if (!res.ok) return null
  const data = await res.json()
  if (!data || !data.lat || !data.lon) return null
  return { lat: parseFloat(data.lat), lng: parseFloat(data.lon), displayName: data.display_name || 'Selected location' }
}
