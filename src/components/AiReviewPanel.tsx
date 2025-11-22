import { useEffect, useState } from 'react'
import BatchOptimizePanel from './BatchOptimizePanel'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'

type TriageLog = {
  id: number
  request_id: number | null
  payload_json: string
  result_json: string
  confidence: number | null
  used_ai: number
  created_at: number
}

export default function AiReviewPanel() {
  const [logs, setLogs] = useState<TriageLog[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [anomalies, setAnomalies] = useState<any[]>([])

  async function loadAnomalies() {
    try {
  const res = await fetch(`${API_BASE}/api/ai/anomaly-scores`)
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setAnomalies(Array.isArray(data.anomalies) ? data.anomalies : [])
    } catch (err:any) {
      // ignore
    }
  }

  useEffect(()=>{ load() }, [])
  useEffect(()=>{ loadAnomalies() }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
  const res = await fetch(`${API_BASE}/api/ai/triage-logs`)
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setLogs(Array.isArray(data.logs) ? data.logs : [])
    } catch (err:any) {
      setError(err?.message || 'Failed to load logs')
    } finally { setLoading(false) }
  }

  async function handleOverride(log: TriageLog) {
    const parsedResult = (()=>{ try { return JSON.parse(log.result_json) } catch { return null } })()
    const suggestedNgo = parsedResult?.selectedNgo?.ngoId || ''
    const disasterType = parsedResult?.disasterType || ''
    const newNgo = window.prompt('Assign NGO id (leave blank to keep):', String(suggestedNgo))
    const newDis = window.prompt('Disaster type (leave blank to keep):', String(disasterType))
    if (newNgo === null && newDis === null) return
    const changes: any = {}
    if (newNgo !== null && newNgo !== '') changes.assignedNgoId = newNgo
    if (newDis !== null && newDis !== '') changes.disasterType = newDis
    const overriddenBy = window.prompt('Your admin id or name for the audit entry:', 'admin') || 'admin'
    const overrideReason = window.prompt('Reason (brief):', 'Manual review correction') || ''
    try {
      const res = await fetch(`${API_BASE}/api/ai/override`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: log.request_id, overriddenBy, overrideReason, changes })
      })
      if (!res.ok) throw new Error('Override failed')
      alert('Override recorded')
      load()
    } catch (err:any) {
      alert(err?.message || 'Override failed')
    }
  }

  return (
    <div>
      {loading && <div className="text-sm text-slate-500">Loading...</div>}
      {error && <div className="text-sm text-danger">{error}</div>}
      <div className="max-h-96 overflow-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-blue-50 text-slate-600">
            <tr>
              <th className="px-2 py-1">Time</th>
              <th className="px-2 py-1">Summary</th>
              <th className="px-2 py-1">Selected NGO</th>
              <th className="px-2 py-1">Confidence</th>
              <th className="px-2 py-1">Action</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(l => {
              let parsed = null
              try { parsed = JSON.parse(l.result_json) } catch {}
              const summary = parsed?.summary || ''
              const sel = parsed?.selectedNgo?.name || parsed?.selectedNgo?.ngoId || '—'
              const conf = l.confidence != null ? Number(l.confidence).toFixed(2) : '-'
              return (
                <tr key={l.id} className="border-b border-blue-50">
                  <td className="px-2 py-1 text-[11px]">{new Date(l.created_at).toLocaleString()}</td>
                  <td className="px-2 py-1">{summary.slice(0,120)}{summary.length>120?'…':''}</td>
                  <td className="px-2 py-1 text-[11px]">{sel}</td>
                  <td className="px-2 py-1 text-[11px]">{conf}</td>
                  <td className="px-2 py-1 text-[11px]"><button className="px-2 py-0.5 rounded-full border text-[11px]" onClick={()=>handleOverride(l)}>Override</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="mt-4">
          <h3 className="text-sm font-semibold mb-2">Detected Anomalies</h3>
          {anomalies.length === 0 ? <div className="text-xs opacity-70">No anomalies found.</div> : (
            <div className="space-y-2 text-xs">
              {anomalies.map(a=> (
                <div key={String(a.requestId)} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <div className="font-medium">Request {a.requestId}</div>
                    <div className="opacity-70">Score: {Number(a.score).toFixed(2)} · Loc: {a.location || '—'}</div>
                  </div>
                  <div>
                    <button className="px-2 py-0.5 rounded border text-[11px]" onClick={async()=>{ await fetch(`${API_BASE}/api/ai/apply-triage/`+a.requestId, { method: 'POST' }); alert('Reanalysis triggered') }}>Re-analyze</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <BatchOptimizePanel />
      </div>
    </div>
  )
}
