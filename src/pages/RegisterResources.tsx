import { Upload } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import LocationInput, { LocationValue } from '../components/LocationInput'
import { putResource } from '../store/db'
import MapView from '../components/MapView'
import type { Category } from '../models'

export default function RegisterResources() {
  const [resource, setResource] = useState({ type: 'supplies' as Category, tags: '', quantity: 1 })
  const [loc, setLoc] = useState<LocationValue | undefined>(undefined)
  const [refreshSignal, setRefreshSignal] = useState(0)
  const navigate = useNavigate()

  return (
    <div className="container py-10 space-y-8">
      <div className="text-2xl font-semibold">Register Available Aid</div>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card p-6">
          <form className="grid gap-4" onSubmit={async (e)=>{
            e.preventDefault()
            if (!loc) { alert('Please select location'); return }
            const id = 'res_'+Date.now()
            await putResource({
              id,
              ownerUserId: 'local',
              type: resource.type,
              capabilityTags: resource.tags.split(',').map(s=>s.trim()).filter(Boolean),
              quantity: Number(resource.quantity)||1,
              location: { lat: loc.lat, lng: loc.lng },
              availabilityStatus: 'available'
            })
            setRefreshSignal(s=> s+1)
            alert('Resource saved. Redirecting to Home...')
            navigate('/')
          }}>
            <select className="input" value={resource.type} onChange={e=> setResource({...resource, type: e.target.value as Category})}>
              <option value="medical">Medical</option>
              <option value="rescue">Rescue</option>
              <option value="shelter">Shelter</option>
              <option value="supplies">Supplies</option>
            </select>
            <input className="input" placeholder="Tags (comma separated)" value={resource.tags} onChange={e=> setResource({...resource, tags: e.target.value})} />
            <input className="input" placeholder="Quantity" type="number" min={1} value={resource.quantity} onChange={e=> setResource({...resource, quantity: Number(e.target.value)})} />
            <LocationInput value={loc} onChange={setLoc} />
            <button className="button-primary self-start" type="submit">
              <Upload className="w-4 h-4" /> Save Resource
            </button>
          </form>
        </div>
        <div className="card p-6">
          <div className="text-lg font-semibold">Map</div>
          <div className="mt-4">
            <MapView refreshSignal={refreshSignal} />
          </div>
        </div>
      </div>
    </div>
  )
}
