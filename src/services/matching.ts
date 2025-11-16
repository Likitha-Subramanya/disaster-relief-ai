import type { Request, Resource } from '../models'

function haversine(a: {lat:number,lng:number}, b:{lat:number,lng:number}) {
  const R=6371, dLat=(b.lat-a.lat)*Math.PI/180, dLon=(b.lng-a.lng)*Math.PI/180
  const la=a.lat*Math.PI/180, lb=b.lat*Math.PI/180
  const h = Math.sin(dLat/2)**2 + Math.cos(la)*Math.cos(lb)*Math.sin(dLon/2)**2
  return 2*R*Math.asin(Math.sqrt(h))
}

export function scoreResource(req: Request, res: Resource) {
  const distanceKm = (req.location && res.location) ? haversine(req.location, res.location) : 999
  const capabilityMatch = (res.capabilityTags || []).reduce((acc, t)=> acc + (req.text.toLowerCase().includes(t.toLowerCase()) ? 1 : 0), 0)
  const typeMatch = res.type === req.category ? 1 : 0
  const wd= -1, wc= 3, wt= 2, wu= 1
  const score = distanceKm*wd + capabilityMatch*wc + typeMatch*wt + req.urgency*wu
  return { score, distanceKm }
}

export function matchResources(req: Request, resources: Resource[], topK=3) {
  return resources
    .filter(r=> r.availabilityStatus==='available')
    .map(r=> ({ r, ...scoreResource(req, r) }))
    .sort((a,b)=> b.score - a.score)
    .slice(0, topK)
}
