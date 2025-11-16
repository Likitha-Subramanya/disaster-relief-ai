import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useEffect, useMemo, useState } from 'react'
import type { Request, Resource } from '../models'
import { getRequests, getResources } from '../store/db'

// Fix default icon paths in Vite
// @ts-ignore
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
})

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

const greenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

export default function MapView({ refreshSignal = 0 }: { refreshSignal?: number }) {
  const [requests, setRequests] = useState<Request[]>([])
  const [resources, setResources] = useState<Resource[]>([])

  useEffect(()=>{ (async()=>{
    setRequests(await getRequests())
    setResources(await getResources())
  })() }, [refreshSignal])

  const center = useMemo(()=>{
    const r = requests.find(r=> r.location)
    return r?.location ? [r.location.lat, r.location.lng] as [number, number] : [20.5937, 78.9629] as [number, number]
  },[requests])

  return (
    <div className="h-[360px] md:h-[420px] rounded-lg overflow-hidden border border-white/10">
      <MapContainer center={center} zoom={5} style={{height:'100%', width:'100%'}}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {requests.filter(r=> r.location).map(r=> (
          <Marker key={r.id} position={[r.location!.lat, r.location!.lng]} icon={redIcon}> 
            <Popup>
              <div className="text-sm">
                <div className="font-semibold">Request ({r.category})</div>
                <div className="opacity-80 mt-1">{r.text.slice(0,120)}</div>
                <div className="mt-1">Urgency: {r.urgency}</div>
              </div>
            </Popup>
          </Marker>
        ))}
        {resources.map(res=> (
          <Marker key={res.id} position={[res.location.lat, res.location.lng]} icon={greenIcon}>
            <Popup>
              <div className="text-sm">
                <div className="font-semibold">Resource: {res.type}</div>
                <div className="opacity-80 mt-1">Tags: {res.capabilityTags.join(', ')}</div>
                <div className="mt-1">Qty: {res.quantity} · {res.availabilityStatus}</div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
