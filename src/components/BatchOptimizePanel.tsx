import { useState } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'

export default function BatchOptimizePanel() {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<any>(null)

  async function runOptimize() {
    setRunning(true)
    try {
      const res = await fetch(`${API_BASE}/api/ai/optimize-batch`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setResult(data.applied || [])
      alert('Batch optimization applied to ' + ((data.applied && data.applied.length) || 0) + ' requests')
    } catch (err:any) {
      alert(err?.message || 'Batch optimize failed')
    } finally { setRunning(false) }
  }

  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold mb-2">Batch optimizer</h3>
      <div className="text-xs mb-2">Run the improved batch assignment algorithm to assign multiple unassigned requests at once.</div>
      <div className="flex gap-2">
        <button className="button-primary text-xs" onClick={runOptimize} disabled={running}>{running ? 'Running…' : 'Run batch optimizer'}</button>
        <button className="px-2 py-0.5 rounded border text-xs" onClick={()=>{ fetch(`${API_BASE}/api/ai/recompute-reliability`, { method: 'POST' }).then(()=> alert('Recompute triggered')).catch(()=> alert('Failed')) }}>Recompute reliability</button>
      </div>
      {result && result.length > 0 && (
        <div className="mt-3 text-xs">
          <div className="font-semibold">Applied assignments</div>
          <ul className="list-disc ml-4">
            {result.map((r:any)=> (<li key={String(r.requestId)}>Request {r.requestId} → NGO {String(r.assignedNgoId)} ({r.reason})</li>))}
          </ul>
        </div>
      )}
    </div>
  )
}
