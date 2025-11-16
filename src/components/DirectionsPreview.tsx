import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useState } from 'react'
import { getRoute } from '../services/directions'

export default function DirectionsPreview({ origin, dest }: { origin: {lat:number,lng:number}, dest: {lat:number,lng:number} }) {
  const [coords, setCoords] = useState<[number,number][]>([])
  const [distance, setDistance] = useState<number|undefined>()
  const [duration, setDuration] = useState<number|undefined>()

  useEffect(()=>{ (async()=>{
    const route = await getRoute(origin, dest)
    if (route) {
      setCoords(route.coordinates)
      setDistance(route.distanceKm)
      setDuration(route.durationMin)
    } else {
      setCoords([])
      setDistance(undefined)
      setDuration(undefined)
    }
  })() }, [origin.lat, origin.lng, dest.lat, dest.lng])

  const center = dest

  return (
    <div className="rounded-lg overflow-hidden border border-white/10">
      <MapContainer center={[center.lat, center.lng]} zoom={12} style={{height:'260px', width:'100%'}}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[origin.lat, origin.lng]}>
          <Popup>Origin</Popup>
        </Marker>
        <Marker position={[dest.lat, dest.lng]}>
          <Popup>Destination</Popup>
        </Marker>
        {coords.length>0 && (
          <Polyline positions={coords} pathOptions={{ color: '#4f46e5', weight: 5, opacity: 0.8 }} />
        )}
      </MapContainer>
      <div className="p-2 text-xs opacity-80">
        {distance ? `Distance: ${distance.toFixed(1)} km · ETA: ${Math.round(duration!)} min` : 'Set VITE_MAPBOX_TOKEN to enable in-app route preview. Fallback: open in Google Maps.'}
      </div>
    </div>
  )
}
