import { useEffect, useMemo, useState } from 'react'
import { getRequests, getResources, getAllMatches, getStatus, updateRequestStatus } from '../store/db'
import type { Match, Request, Resource, StatusEvent } from '../models'
import DirectionsPreview from '../components/DirectionsPreview'

export default function Dashboard() {
  const [requests, setRequests] = useState<Request[]>([])
  const [resources, setResources] = useState<Resource[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [timeline, setTimeline] = useState<Record<string, StatusEvent[]>>({})
  const [selected, setSelected] = useState<{ req?: Request, res?: Resource }|null>(null)

  useEffect(()=>{ (async()=>{
    const [rq, rs, ms] = await Promise.all([getRequests(), getResources(), getAllMatches()])
    setRequests(rq)
    setResources(rs)
    setMatches(ms)
    const timelines: Record<string, StatusEvent[]> = {}
    await Promise.all(rq.map(async r=> { timelines[r.id] = await getStatus(r.id) }))
    setTimeline(timelines)
  })() }, [])

  const rows = useMemo(()=>{
    const mapRes: Record<string, Resource> = Object.fromEntries(resources.map(r=> [r.id, r]))
    const mapByReq: Record<string, Match[]> = {}
    for (const m of matches) {
      if (!mapByReq[m.requestId]) mapByReq[m.requestId] = []
      mapByReq[m.requestId].push(m)
    }
    return requests
      .sort((a,b)=> b.createdAt - a.createdAt)
      .map(r=> ({ r, matches: (mapByReq[r.id]||[]).map(m=> ({ m, res: mapRes[m.resourceId] })) }))
  }, [requests, resources, matches])

  return (
    <div className="container py-10 space-y-8">
      <div className="text-2xl font-semibold">Operations Dashboard</div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 card p-6">
          <div className="font-semibold mb-3">Requests</div>
          <div className="space-y-3">
            {rows.map(({ r, matches })=> (
              <div key={r.id} className="p-4 rounded-lg border border-white/10 bg-white/5">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{r.category.toUpperCase()} · Urgency {r.urgency}</div>
                  <div className="text-xs opacity-70">{new Date(r.createdAt).toLocaleString()}</div>
                </div>
                <div className="mt-2 text-sm opacity-90 whitespace-pre-wrap">{r.text}</div>
                <div className="mt-3 flex items-center gap-2 text-xs">
                  <span className="px-2 py-1 rounded bg-white/10">Status: {r.status}</span>
                  <button className="px-2 py-1 rounded border border-white/10 hover:bg-white/5" onClick={()=> updateRequestStatus(r.id, 'assigned')}>assigned</button>
                  <button className="px-2 py-1 rounded border border-white/10 hover:bg-white/5" onClick={()=> updateRequestStatus(r.id, 'in_progress')}>en_route</button>
                  <button className="px-2 py-1 rounded border border-white/10 hover:bg-white/5" onClick={()=> updateRequestStatus(r.id, 'delivered')}>delivered</button>
                  <button className="px-2 py-1 rounded border border-white/10 hover:bg-white/5" onClick={()=> updateRequestStatus(r.id, 'closed')}>closed</button>
                </div>
                {matches.length>0 && (
                  <div className="mt-3 text-sm">
                    <div className="opacity-80">Matches:</div>
                    <ul className="list-disc ml-5 mt-1 space-y-1">
                      {matches.map(({ m, res })=> (
                        <li key={m.id}>
                          Resource {res?.type} · {m.distanceKm.toFixed(1)} km · score {m.score.toFixed(1)}
                          {r.location && res?.location && (
                            <button className="ml-2 text-primary underline" onClick={()=> setSelected({ req: r, res })}>Route</button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {timeline[r.id]?.length>0 && (
                  <div className="mt-3 text-xs opacity-80">
                    <div>Timeline:</div>
                    <ul className="ml-4 list-disc">
                      {timeline[r.id].map(ev=> (
                        <li key={ev.id}>{new Date(ev.timestamp).toLocaleString()} · {ev.status}{ev.note? ` — ${ev.note}`:''}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
            {rows.length===0 && <div className="text-sm opacity-70">No requests yet.</div>}
          </div>
        </div>
        <div className="card p-6 space-y-4">
          <div>
            <div className="font-semibold mb-2">Resources</div>
            <div className="space-y-2 text-sm">
              {resources.map(res=> (
                <div key={res.id} className="p-2 rounded border border-white/10">
                  <div className="font-medium">{res.type}</div>
                  <div className="opacity-80">Tags: {res.capabilityTags.join(', ')}</div>
                  <div className="opacity-80">Qty: {res.quantity} · {res.availabilityStatus}</div>
                </div>
              ))}
              {resources.length===0 && <div className="text-sm opacity-70">No resources yet.</div>}
            </div>
          </div>
          <div>
            <div className="font-semibold mb-2">Route Preview</div>
            {selected?.req?.location && selected?.res?.location ? (
              <DirectionsPreview origin={selected.res.location} dest={selected.req.location} />
            ) : (
              <div className="text-xs opacity-70">Select a match with a Route link to preview.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
