import type { Request } from '../models'
import { getUnsyncedRequests, markRequestSynced } from '../store/db'
import triageLocal from './localTriage'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'

export async function syncRequestsWithServer() {
  try {
    const pending = await getUnsyncedRequests()
    if (!pending.length || !navigator.onLine) return

    for (const req of pending) {
        const ok = await pushRequest(req)
      if (ok) {
        await markRequestSynced(req.id)
      }
    }
  } catch (err) {
    console.error('syncRequestsWithServer failed', err)
  }
}

async function pushRequest(req: Request) {
  try {
    const locationText =
      req.locationLabel ||
      (req.location ? `${req.location.lat.toFixed(5)}, ${req.location.lng.toFixed(5)}` : 'Unknown location')
    // If we're online, run server-side advanced triage first to get an AI decision
    let triageResult: any = null
    if (navigator.onLine) {
      try {
        const triageBody = {
          text: req.text || undefined,
          ocrText: req.ocrText || undefined,
          audioTranscript: req.audioTranscript || undefined,
          photos: req.imageUrl ? [req.imageUrl] : undefined,
          location: req.locationLabel ? { label: req.locationLabel } : req.location ? { text: `${req.location.lat}, ${req.location.lng}` } : undefined,
        }
        const triageRes = await fetch(`${API_BASE}/api/ai/triage-full`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(triageBody),
        })
        if (triageRes.ok) triageResult = await triageRes.json()
      } catch (err) {
        console.warn('server triage failed, will fallback to local triage', err)
      }
    }

    // If no server triage available, use local triage to produce basic fields
    if (!triageResult) {
      try {
  triageResult = { ok: true, ...(await triageLocal({ text: req.text, ocrText: req.ocrText, audioTranscript: req.audioTranscript, photos: req.imageUrl ? [req.imageUrl] : undefined, location: req.locationLabel ? { label: req.locationLabel } : undefined })) }
      } catch (err) {
        triageResult = { ok: false }
      }
    }

    const body = {
      victimName: req.victimName || req.reporterUserId || 'Anonymous victim',
      contact: req.contact,
      location: locationText,
      disasterType: triageResult?.disasterType || req.aiDisasterType || 'other',
      assignedNgoId: triageResult?.selectedNgo?.ngoId || req.aiAssignedNgoId || null,
      message: req.text || '',
      aiSummary: triageResult?.summary || null,
      aiConfidence: triageResult?.confidence ?? null,
      aiUsed: triageResult?.usedAi ?? false,
      severityLevel: triageResult?.severityLevel ?? req.severityLevel ?? null,
      severityLabel: triageResult?.severityLabel ?? req.severityLabel ?? null,
      peopleAffected: triageResult?.peopleAffected ?? req.peopleAffected ?? null,
      trapped: typeof triageResult?.trapped === 'boolean' ? triageResult.trapped : req.trapped ?? null,
      injured: typeof triageResult?.injured === 'boolean' ? triageResult.injured : req.injured ?? null,
      specialConstraints: triageResult?.specialConstraints ?? req.specialConstraints ?? [],
      uncertaintyFlag: triageResult?.uncertaintyFlag ?? req.uncertaintyFlag ?? null,
      uncertaintyReasons: triageResult?.uncertaintyReasons ?? req.uncertaintyReasons ?? [],
    }

    const res = await fetch(`${API_BASE}/api/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      console.warn('Failed to sync request', req.id, res.status)
      return false
    }

    // Try to parse server-side id and trigger reanalysis/apply if triage was low-confidence or heuristic
    try {
      const data = await res.json()
      const serverRequestId = data?.id
      const triageConfidence = triageResult?.confidence ?? 0
      const usedAi = triageResult?.usedAi ?? false
      if (serverRequestId && (!usedAi || triageConfidence < 0.6) && navigator.onLine) {
        try {
          await fetch(`${API_BASE}/api/ai/apply-triage/${serverRequestId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: req.text, ocrText: req.ocrText, audioTranscript: req.audioTranscript, photos: req.imageUrl ? [req.imageUrl] : undefined, location: req.locationLabel ? { label: req.locationLabel } : req.location ? { text: `${req.location.lat}, ${req.location.lng}` } : undefined }),
          })
        } catch (err) {
          console.warn('apply-triage call failed', err)
        }
      }
    } catch (err) {
      // ignore JSON parse errors
    }

    return true
  } catch (err) {
    console.warn('pushRequest error', err)
    return false
  }
}
