export interface GeocodeResult { lat: number; lng: number; displayName: string }

export async function geocodeAddress(query: string): Promise<GeocodeResult | null> {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', query)
  url.searchParams.set('format', 'json')
  url.searchParams.set('limit', '1')
  const res = await fetch(url.toString(), { headers: { 'Accept': 'application/json' } })
  if (!res.ok) return null
  const data = await res.json()
  if (!Array.isArray(data) || data.length === 0) return null
  const item = data[0]
  return { lat: parseFloat(item.lat), lng: parseFloat(item.lon), displayName: item.display_name }
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
