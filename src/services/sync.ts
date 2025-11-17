import type { Request } from '../models'
import { getUnsyncedRequests, markRequestSynced } from '../store/db'

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

    const body = {
      victimName: req.victimName || req.reporterUserId || 'Anonymous victim',
      contact: req.contact,
      location: locationText,
      disasterType: req.aiDisasterType || 'other',
      assignedNgoId: req.aiAssignedNgoId,
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
    return true
  } catch (err) {
    console.warn('pushRequest error', err)
    return false
  }
}
