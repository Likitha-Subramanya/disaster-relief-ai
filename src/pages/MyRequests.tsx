import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getRequests, getStatus } from '../store/db'
import type { Request, StatusEvent } from '../models'

export default function MyRequests() {
  const [requests, setRequests] = useState<Request[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [timeline, setTimeline] = useState<StatusEvent[]>([])

  useEffect(() => {
    (async () => {
      const rq = await getRequests()
      rq.sort((a, b) => b.createdAt - a.createdAt)
      setRequests(rq)
      if (rq[0]) {
        setSelectedId(rq[0].id)
        setTimeline(await getStatus(rq[0].id))
      }
    })()
  }, [])

  useEffect(() => {
    if (!selectedId) return
    ;(async () => {
      setTimeline(await getStatus(selectedId))
    })()
  }, [selectedId])

  const selected = requests.find(r => r.id === selectedId) || null

  return (
    <div className="container py-8 md:py-10 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xl font-semibold">My Requests</div>
          <div className="text-xs opacity-70">History of emergencies you have reported on this device.</div>
        </div>
        <Link to="/" className="text-xs opacity-80 underline">Back to home</Link>
      </div>

      <div className="grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)] gap-6 items-start">
        {/* Left: list of requests */}
        <div className="card p-4 text-xs">
          <div className="font-semibold mb-2">Requests on this device</div>
          {requests.length === 0 && (
            <div className="opacity-70">No requests have been submitted from this browser yet.</div>
          )}
          <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
            {requests.map(r => (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className={`w-full text-left p-3 rounded-lg border border-white/10 hover:bg-white/5 ${selectedId === r.id ? 'bg-white/10' : ''}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide">{r.category || 'Uncategorized'}</span>
                  <span className="text-[10px] opacity-70">{new Date(r.createdAt).toLocaleString()}</span>
                </div>
                <div className="text-[11px] opacity-80 line-clamp-2 whitespace-pre-wrap">{r.text}</div>
                <div className="mt-1 flex items-center gap-2 text-[10px]">
                  <span className="px-2 py-0.5 rounded-full bg-white/10">Urgency {r.urgency}</span>
                  <span className="px-2 py-0.5 rounded-full bg-white/5">Status {r.status}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right: detail view */}
        <div className="card p-5 text-xs">
          {selected ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold mb-0.5">Request details</div>
                  <div className="text-[11px] opacity-70">ID: {selected.id}</div>
                </div>
                <div className="text-right text-[11px] opacity-80">
                  <div>{new Date(selected.createdAt).toLocaleString()}</div>
                  <div className="mt-1">Urgency {selected.urgency} · Status {selected.status}</div>
                </div>
              </div>

              <div className="border-t border-white/10 pt-3">
                <div className="text-[11px] font-semibold mb-1">Description</div>
                <div className="opacity-80 whitespace-pre-wrap text-[11px]">{selected.text}</div>
              </div>

              <div className="border-t border-white/10 pt-3">
                <div className="text-[11px] font-semibold mb-1">Timeline</div>
                {timeline.length > 0 ? (
                  <ul className="ml-4 list-disc space-y-1 opacity-80">
                    {timeline.map(ev => (
                      <li key={ev.id}>
                        {new Date(ev.timestamp).toLocaleString()} · {ev.status}
                        {ev.note ? ` — ${ev.note}` : ''}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="opacity-70">No events recorded yet for this request.</div>
                )}
              </div>
            </div>
          ) : (
            <div className="opacity-70">Select a request on the left to see details.</div>
          )}
        </div>
      </div>
    </div>
  )
}
