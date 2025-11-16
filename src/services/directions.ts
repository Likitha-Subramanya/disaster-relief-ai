export interface LatLng { lat: number; lng: number }
export interface RouteResult { distanceKm: number; durationMin: number; coordinates: [number, number][] }

export async function getRoute(origin: LatLng, dest: LatLng): Promise<RouteResult | null> {
  const token = import.meta.env.VITE_MAPBOX_TOKEN
  if (token) {
    try {
      const url = new URL(`https://api.mapbox.com/directions/v5/mapbox/driving/${origin.lng},${origin.lat};${dest.lng},${dest.lat}`)
      url.searchParams.set('geometries', 'geojson')
      url.searchParams.set('access_token', token)
      const res = await fetch(url.toString())
      if (res.ok) {
        const data = await res.json()
        const route = data?.routes?.[0]
        if (route) {
          const coords: [number, number][] = route.geometry.coordinates // [lng,lat]
          const latlng: [number, number][] = coords.map(([lng,lat]:[number,number])=> [lat,lng])
          return { distanceKm: route.distance/1000, durationMin: route.duration/60, coordinates: latlng }
        }
      }
    } catch {}
  }
  // OSRM fallback (no token)
  try {
    const url = new URL(`https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${dest.lng},${dest.lat}`)
    url.searchParams.set('overview', 'full')
    url.searchParams.set('geometries', 'geojson')
    const res = await fetch(url.toString())
    if (!res.ok) return null
    const data = await res.json()
    const route = data?.routes?.[0]
    if (!route) return null
    const coords: [number, number][] = route.geometry.coordinates // [lng,lat]
    const latlng: [number, number][] = coords.map(([lng,lat]:[number,number])=> [lat,lng])
    return { distanceKm: route.distance/1000, durationMin: route.duration/60, coordinates: latlng }
  } catch {
    return null
  }
}
