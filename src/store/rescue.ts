import { geocodeAddress } from '../services/geocode'

export type DisasterType =
  | 'earthquake'
  | 'flood'
  | 'fire'
  | 'cyclone'
  | 'landslide'
  | 'tsunami'
  | 'drought'
  | 'heatwave'
  | 'coldwave'
  | 'storm_surge'
  | 'building_collapse'
  | 'industrial_accident'
  | 'chemical_leak'
  | 'transport_accident'
  | 'epidemic'
  | 'conflict_violence'
  | 'medical_emergency'
  | 'other'

export type RequestStatus = 'to_do' | 'in_progress' | 'reached' | 'completed'

export interface VictimRequest {
  id: string
  victimName: string
  contact?: string
  location: string
  disasterType: DisasterType
  // Exact label/text the victim provided or the human-friendly label
  disasterRaw?: string
  createdAt: number
  status: RequestStatus
  assignedNgoId?: string
  // Optional voice note and transcript for accessibility
  audioUrl?: string
  transcript?: string
}

export interface VictimProfile {
  name: string
  email: string
  password: string
  location: string // city / area
  address: string // full address used at rescue time
  contact: string // primary phone / WhatsApp
}

export interface NgoUser {
  id: string
  backendId?: string
  name: string
  email: string
  password: string
  phone: string
  address: string
  location: string
  serviceType: string
  branches?: string[]
  theme?: 'dark' | 'light'
  lat?: number
  lng?: number
}

export interface AdminUser {
  id: string
  name: string
  email: string
  password: string
}
export type CurrentRole = 'victim' | 'ngo' | 'admin' | null

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'
const VICTIM_REQUESTS_KEY = 'resc_victim_requests'
const CURRENT_VICTIM_KEY = 'resc_current_victim'
const NGO_USERS_KEY = 'resc_ngo_users'
const CURRENT_NGO_KEY = 'resc_current_ngo'
const ADMIN_USERS_KEY = 'resc_admin_users'
const CURRENT_ADMIN_KEY = 'resc_current_admin'
const CURRENT_ROLE_KEY = 'resc_current_role'
const OUTBOX_KEY = 'resc_outbox_requests'

// Admin ID is intentionally kept private to this module and never exported
const ADMIN_ID = 'RESCUETECH-ADMIN-2025'

function safeRead<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function safeWrite<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value))
}

type OutboxItem = {
  clientId: string
  payload: {
    victimName: string
    contact?: string
    location: string
    disasterType: DisasterType
    status: RequestStatus
    assignedNgoId?: string
    createdAt: number
    audioUrl?: string
  }
}

function readOutbox(): OutboxItem[] {
  return safeRead<OutboxItem[]>(OUTBOX_KEY, [])
}

function writeOutbox(items: OutboxItem[]) {
  safeWrite(OUTBOX_KEY, items)
}

async function flushOutboxOnce(): Promise<void> {
  if (!isOnline()) return
  const items = readOutbox()
  if (!items.length) return
  const remaining: OutboxItem[] = []
  for (const it of items) {
    try {
      const body = {
        clientId: it.clientId,
        victimName: it.payload.victimName,
        contact: it.payload.contact || null,
        location: it.payload.location,
        disasterType: it.payload.disasterType,
        status: it.payload.status,
        assignedNgoId: it.payload.assignedNgoId || null,
        createdAt: it.payload.createdAt,
      }
      const res = await fetch(`${API_BASE}/api/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      // Attempt audio upload if present
      if (it.payload.audioUrl) {
        try {
          let serverId: string | number | null = null
          try {
            const data = await res.clone().json()
            serverId = data?.request?.id ?? data?.id ?? null
          } catch {}
          if (!serverId) {
            // refetch latest list and best-effort map by createdAt/location
            const check = await fetch(`${API_BASE}/api/requests`)
            if (check.ok) {
              const js = await check.json()
              const rows = Array.isArray(js.requests) ? js.requests : []
              const match = rows.find((r: any) => Number(r.created_at) === it.payload.createdAt && String(r.location) === it.payload.location)
              if (match) serverId = match.id
            }
          }
          if (serverId) {
            const blob = await fetch(it.payload.audioUrl).then(r => r.blob()).catch(() => null)
            if (blob) {
              const fd = new FormData()
              fd.append('audio', blob, 'note.webm')
              await fetch(`${API_BASE}/api/requests/${serverId}/audio`, { method: 'PUT', body: fd })
            }
          }
        } catch {}
      }
      // success; do not push back
    } catch {
      remaining.push(it)
    }
  }
  writeOutbox(remaining)
}

// Try to flush when the app regains connectivity
if (typeof window !== 'undefined') {
  try {
    window.addEventListener('online', () => { flushOutboxOnce().catch(() => {}) })
  } catch {}
}

// Expose a safe public flush (used when SW pings the page)
export async function flushOutboxPublic() {
  try { await flushOutboxOnce() } catch {}
}

function isOnline() {
  return typeof navigator !== 'undefined' ? navigator.onLine : false
}

function normalize(str: string | undefined | null) {
  return (str || '').toString().toLowerCase()
}

function parseLatLng(raw?: string | null) {
  if (!raw) return null
  const match = raw.trim().match(/(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)/)
  if (!match) return null
  const lat = parseFloat(match[1])
  const lng = parseFloat(match[2])
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const R = 6371
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

function computeTextualLocationScore(victimLoc: string, ngoLoc: string) {
  if (!victimLoc || !ngoLoc) return 0

  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9,\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

  const v = normalize(victimLoc)
  const n = normalize(ngoLoc)
  if (!v || !n) return 0
  if (v === n) return 10

  const splitParts = (s: string) =>
    s
      .split(/[\n,]/)
      .map(p => p.trim().replace(/\s+/g, ' '))
      .filter(Boolean)

  const vParts = splitParts(v)
  const nParts = splitParts(n)
  if (!vParts.length || !nParts.length) return 0

  const stop = new Set([
    'near','opp','opposite','beside','behind','front','road','rd','street','st','layout','sector','stage','area','town','city','district','state','india','pin','pincode','code','block'
  ])

  const tokenize = (s: string) =>
    s
      .split(/[\s,]/)
      .map(t => t.trim())
      .filter(t => t && t.length >= 3 && !stop.has(t))

  const vTokens = new Set<string>(tokenize(v))
  const nTokens = new Set<string>(tokenize(n))

  let score = 0

  const vMain = vParts[0]
  if (vMain) {
    if (n.includes(vMain)) score += vMain.length >= 8 ? 5 : 3
  }

  for (const vp of vParts.slice(1)) {
    if (!vp) continue
    if (nParts.some(np => np === vp)) score += 2
    else if (nParts.some(np => np.includes(vp) || vp.includes(np))) score += 1
  }

  for (const vt of vTokens) {
    if (nTokens.has(vt)) {
      score += vt.length >= 7 ? 1.2 : 0.8
    } else if ([...nTokens].some(nt => nt.includes(vt) || vt.includes(nt))) {
      score += 0.5
    }
  }

  // Nearby neighborhood/landmark adjacency bonus (simple handcrafted graph)
  const adjacency: Record<string, string[]> = {
    'southend circle': ['jayanagar', 'basavanagudi', 'lalbagh', 'banashankari', 'jp nagar'],
    jayanagar: ['southend circle', 'lalbagh', 'jp nagar', 'banashankari', 'basavanagudi'],
    lalbagh: ['jayanagar', 'basavanagudi', 'southend circle'],
    basavanagudi: ['lalbagh', 'southend circle', 'jayanagar'],
    hebbal: ['rt nagar', 'sahakara nagar', 'yeshwanthpur', 'nagavara'],
    'rt nagar': ['hebbal', 'sahakara nagar'],
    'sahakara nagar': ['hebbal', 'rt nagar'],
    yeshwanthpur: ['hebbal', 'malleshwaram'],
    'jp nagar': ['jayanagar', 'banashankari', 'btm'],
    btm: ['jp nagar', 'hsr'],
    hsr: ['btm', 'sarjapur'],
  }
  // Determine NGO primary area (first significant token or first part)
  const nPrimary = ((): string | null => {
    // Prefer first non-generic token from NGO location tokens
    for (const t of nTokens) {
      if (!stop.has(t)) return t
    }
    return nParts.length ? nParts[0] : null
  })()
  if (nPrimary) {
    const adj = adjacency[nPrimary] || adjacency[nPrimary.replace(/\s+/g, ' ')]
    if (adj && adj.some(a => v.includes(a))) {
      score += 2 // nearby area bonus
    }
  }

  const cityHints = ['bengaluru','bangalore','mumbai','delhi','chennai','kolkata','hyderabad','pune']
  const vCity = cityHints.find(c => v.includes(c))
  const nCity = cityHints.find(c => n.includes(c))
  if (vCity && nCity) {
    if (vCity === nCity) score += 2
    else return -1
  }

  if (!score && (v.includes(n) || n.includes(v))) score = 1

  return score || -0.5
}

function computeLocationScore(victimLocRaw: string, ngoLocRaw: string) {
  const victimCoords = parseLatLng(victimLocRaw)
  const ngoCoords = parseLatLng(ngoLocRaw)
  if (victimCoords && ngoCoords) {
    const distanceKm = haversineKm(victimCoords, ngoCoords)
    if (distanceKm <= 5) return 5
    if (distanceKm <= 15) return 4
    if (distanceKm <= 30) return 3
    if (distanceKm <= 60) return 2
    if (distanceKm <= 120) return 1
    return -Math.min(4, distanceKm / 50)
  }
  return computeTextualLocationScore(normalize(victimLocRaw), normalize(ngoLocRaw))
}

function splitServices(raw: string) {
  const parts = raw
    .split(/[\n,/|]/)
    .map(s => normalize(s).trim())
    .filter(Boolean)
  // Map common variations to canonical tokens to make matching robust
  const CANON: Record<string, string> = {
    'first aid': 'medical aid',
    'first-aid': 'medical aid',
    'medical aid': 'medical aid',
    'ambulance': 'ambulance support',
    'ambulance support': 'ambulance support',
    'search and rescue': 'search and rescue',
    'search & rescue': 'search and rescue',
    'food & water': 'food & water',
    'food and water': 'food & water',
    'food & water distribution': 'food & water',
    'volunteer coordination': 'volunteer coordination',
    'temporary shelter': 'temporary shelter',
    'shelter support': 'temporary shelter',
    'medical emergency support': 'medical aid',
    'firstaid': 'medical aid',
    'logistics': 'logistics',
    'logistics & transport': 'logistics',
    'legal / documentation': 'legal / documentation',
    'psychological support': 'psychological support',
    'animal rescue': 'animal rescue',
    'food distribution': 'food & water',
    'water removal': 'water removal',
    'flood rescue': 'flood rescue',
    'fire rescue': 'fire rescue',
    'hazard control': 'hazard control',
    'toxic fume control': 'toxic fume control',
  }
  return parts.map(p => CANON[p] || p)
}

function serviceMatchScore(tokens: string[], preferred: string[]) {
  const preferredTokens = preferred.map(p => normalize(p))
  // Exact canonical matches first
  let matches = 0
  for (const pref of preferredTokens) {
    if (tokens.some(token => token === pref)) {
      matches += 1
    } else if (tokens.some(token => token.includes(pref) || pref.includes(token))) {
      // fuzzy fallback
      matches += 0.8
    }
  }
  if (matches === 0 && tokens.some(token => token.includes('general support') || token.includes('volunteer coordination'))) {
    matches = 1
  }
  return matches
}

async function chooseAutoNgoForDisaster(disasterType: DisasterType, victimLocation?: string): Promise<string | undefined> {
  let ngos = getNgoUsers()
  if (!ngos.length) return undefined

  const key = normalize(disasterType)
  let preferred: string[] = []

  if (key === 'earthquake' || key === 'building_collapse' || key === 'landslide') {
    preferred = ['search and rescue', 'temporary shelter', 'medical aid', 'logistics']
  } else if (key === 'flood' || key === 'storm_surge' || key === 'tsunami') {
    preferred = ['search and rescue', 'food & water', 'temporary shelter', 'logistics']
  } else if (key === 'fire' || key === 'industrial_accident' || key === 'chemical_leak') {
    preferred = ['search and rescue', 'medical aid', 'logistics']
  } else if (key === 'epidemic' || key === 'medical_emergency') {
    preferred = ['medical aid', 'ambulance support']
  } else if (key === 'drought' || key === 'heatwave' || key === 'coldwave') {
    preferred = ['food & water', 'temporary shelter']
  } else {
    preferred = ['general support', 'volunteer coordination', 'food & water', 'temporary shelter']
  }

  const victimLocRaw = victimLocation || ''
  const victimCoordsParsed = parseLatLng(victimLocRaw)
  // Ensure NGOs have coordinates where possible so distance-based selection works
  try {
    // Geocode NGOs that don't have lat/lng but have textual addresses (best-effort)
    const toGeocode = ngos.filter(n => typeof n.lat !== 'number' || typeof n.lng !== 'number')
    for (const n of toGeocode) {
      const key = (n.location || n.address || '').trim()
      if (!key) continue
      try {
        const g = await tryGeocodeVariants(key)
        if (g) {
          n.lat = g.lat
          n.lng = g.lng
          updateNgo(n)
        }
      } catch {}
    }
    // reload ngos from storage in case updateNgo changed ids/order
    ngos = getNgoUsers()
  } catch {}

  const scored = ngos.map(ngo => {
    const services = splitServices(ngo.serviceType || '')
    const serviceScore = serviceMatchScore(services, preferred)
    const locationScore = computeLocationScore(victimLocRaw, ngo.location || '')
    // Compute a best-effort distance (km) when coordinates are present in NGO record or location string
    let distanceKm: number | null = null
    try {
      const ngoCoords = (typeof ngo.lat === 'number' && typeof ngo.lng === 'number')
        ? { lat: ngo.lat as number, lng: ngo.lng as number }
        : parseLatLng(ngo.location) || parseLatLng(ngo.address)
      if (victimCoordsParsed && ngoCoords) {
        distanceKm = haversineKm(victimCoordsParsed, ngoCoords)
      }
    } catch {}
    // Increase relative weight of location to honor nearby preference
    const totalScore = serviceScore * 12 + locationScore * 6
    return { ngo, serviceScore, locationScore, totalScore, distanceKm }
  })

  const serviceFiltered = scored.filter(entry => entry.serviceScore > 0)
  const pool = scored.filter(entry => entry.totalScore > 0) // Only consider NGOs with some positive score

  // If victim coordinates are available, prefer the absolute nearest NGO (regardless of service)
  // This ensures the geographically closest responder is chosen for immediate help.
  try {
    if (victimCoordsParsed) {
      const withDistAll = scored.map(s => {
        // ensure we have a numeric distance when possible (may be null)
        return { entry: s, distance: typeof s.distanceKm === 'number' ? (s.distanceKm as number) : null }
      }).filter(x => x.distance !== null)
      if (withDistAll.length) {
        withDistAll.sort((a, b) => (a.distance as number) - (b.distance as number))
        return withDistAll[0].entry.ngo.id
      }
    }

    // Primary selection: among NGOs that provide the required service, choose the nearest when possible
    if (serviceFiltered.length > 0) {
      // If victim coordinates exist and some NGOs have distance computed, pick the minimum distance among the service-matching set
      if (victimCoordsParsed) {
        const withDist = serviceFiltered.filter(s => typeof s.distanceKm === 'number')
        if (withDist.length) {
          withDist.sort((a, b) => (a.distanceKm as number) - (b.distanceKm as number))
          return withDist[0].ngo.id
        }
      }
      // Fallback: choose highest serviceScore, then locationScore, then name
      serviceFiltered.sort((a, b) => {
        const ds = (b.serviceScore || 0) - (a.serviceScore || 0)
        if (ds !== 0) return ds
        const dl = (b.locationScore || 0) - (a.locationScore || 0)
        if (dl !== 0) return dl
        return (a.ngo.name || '').localeCompare(b.ngo.name || '')
      })
      return serviceFiltered[0].ngo.id
    }
  } catch {}

  // Debug: if enabled via localStorage, print candidate scoring details for inspection
  try {
    const dbg = typeof window !== 'undefined' && window.localStorage && window.localStorage.getItem('resc_debug_match') === '1'
    if (dbg) {
      const rows = pool.map(p => ({ id: p.ngo.id, name: p.ngo.name, serviceScore: p.serviceScore, locationScore: p.locationScore, distanceKm: (p as any).distanceKm, totalScore: p.totalScore }))
      // Use console.table for easy inspection
      // eslint-disable-next-line no-console
      console.groupCollapsed && console.groupCollapsed('chooseAutoNgoForDisaster candidates')
      // eslint-disable-next-line no-console
      console.table(rows)
      // eslint-disable-next-line no-console
      console.groupEnd && console.groupEnd()
    }
  } catch {}

  if (!pool.length) return undefined // No suitable NGOs found

  // Sort with deterministic tie-breakers
  pool.sort((a, b) => {
    const d = b.totalScore - a.totalScore
    if (d !== 0) return d
    const dl = (b.locationScore || 0) - (a.locationScore || 0)
    if (dl !== 0) return dl
    const ds = (b.serviceScore || 0) - (a.serviceScore || 0)
    if (ds !== 0) return ds
    return (a.ngo.name || '').localeCompare(b.ngo.name || '')
  })

  const best = pool.reduce<{ ngo: NgoUser; totalScore: number } | null>((acc, curr) => {
    if (!acc || curr.totalScore > acc.totalScore) {
      return curr
    }
    return acc
  }, null)

  if (best) {
    return best.ngo.id
  }

  return undefined
}

export async function addVictimRequest(rec: Omit<VictimRequest, 'id' | 'createdAt' | 'status'>) {
  const list = safeRead<VictimRequest[]>(VICTIM_REQUESTS_KEY, [])
  // If location is textual and we can geocode, prefer coordinates for selection
  let victimLocForSelection = rec.location || ''
  try {
    if (!parseLatLng(victimLocForSelection) && isOnline()) {
      const g = await tryGeocodeVariants(victimLocForSelection)
      if (g) {
        victimLocForSelection = `${g.lat},${g.lng}`
      }
    }
  } catch {}

  const autoNgoId = rec.assignedNgoId ?? await chooseAutoNgoForDisaster(rec.disasterType, victimLocForSelection)
  const newItem: VictimRequest = {
    id: 'vr_' + Date.now(),
    createdAt: Date.now(),
    status: 'to_do',
    ...rec,
    // Preserve/display exactly what victim provided (or a human-friendly label)
    disasterRaw: (rec as any).disasterRaw || DISASTER_LABELS[rec.disasterType] || String(rec.disasterType),
    assignedNgoId: autoNgoId,
  }
  list.push(newItem)
  safeWrite(VICTIM_REQUESTS_KEY, list)
  // Best-effort backend sync (non-blocking); preserves existing local behavior
  const clientId = `cid_${newItem.id}_${Math.random().toString(36).slice(2, 7)}`
  const outboxItem: OutboxItem = {
    clientId,
    payload: {
      victimName: newItem.victimName,
      contact: newItem.contact,
      location: newItem.location,
      disasterType: newItem.disasterType,
      status: newItem.status,
      assignedNgoId: newItem.assignedNgoId,
      createdAt: newItem.createdAt,
      audioUrl: newItem.audioUrl,
    },
  }
  ;(async () => {
    try {
      if (isOnline()) {
        await flushOutboxOnce()
        // attempt direct post for this item
        const res = await fetch(`${API_BASE}/api/requests`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId, ...outboxItem.payload }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        // try audio upload immediately
        if (outboxItem.payload.audioUrl) {
          try {
            let serverId: string | number | null = null
            try {
              const data = await res.clone().json()
              serverId = data?.request?.id ?? data?.id ?? null
            } catch {}
            if (!serverId) {
              const check = await fetch(`${API_BASE}/api/requests`)
              if (check.ok) {
                const js = await check.json()
                const rows = Array.isArray(js.requests) ? js.requests : []
                const match = rows.find((r: any) => Number(r.created_at) === outboxItem.payload.createdAt && String(r.location) === outboxItem.payload.location)
                if (match) serverId = match.id
              }
            }
            if (serverId) {
              const blob = await fetch(outboxItem.payload.audioUrl).then(r => r.blob()).catch(() => null)
              if (blob) {
                const fd = new FormData()
                fd.append('audio', blob, 'note.webm')
                await fetch(`${API_BASE}/api/requests/${serverId}/audio`, { method: 'PUT', body: fd })
              }
            }
          } catch {}
        }
      } else {
        const current = readOutbox()
        current.push(outboxItem)
        writeOutbox(current)
      }
    } catch {
      const current = readOutbox()
      current.push(outboxItem)
      writeOutbox(current)
    }
    // Ask service worker for a background sync if available
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready
        // Not all browsers support bg sync; ignore errors
        // @ts-ignore
        if (reg.sync && reg.sync.register) {
          // @ts-ignore
          await reg.sync.register('rescue-sync')
        }
        // Also ping active SW to request immediate flush
        navigator.serviceWorker.controller?.postMessage({ type: 'sync-outbox' })
      }
    } catch {}
  })()
  // Best-effort: if victim location is textual, try to geocode it and re-evaluate the nearest NGO
  ;(async () => {
    try {
      if (!parseLatLng(newItem.location) && isOnline()) {
        const g = await geocodeAndCache(newItem.location)
        if (g) {
          const coordStr = `${g.lat},${g.lng}`
          const nearestNgo = await chooseAutoNgoForDisaster(newItem.disasterType, coordStr)
          if (nearestNgo && nearestNgo !== newItem.assignedNgoId) {
            assignNgoToVictim(newItem.id, nearestNgo)
          }
        }
      }
    } catch {}
  })()
  return newItem
}

export function getVictimRequests() {
  return safeRead<VictimRequest[]>(VICTIM_REQUESTS_KEY, [])
}

export function updateVictimRequestStatus(id: string, status: RequestStatus) {
  const list = getVictimRequests()
  const idx = list.findIndex(r => r.id === id)
  if (idx === -1) return
  list[idx] = { ...list[idx], status }
  safeWrite(VICTIM_REQUESTS_KEY, list)
  if (isOnline()) {
    fetch(`${API_BASE}/api/requests/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }).catch(err => console.error('Failed to sync status', err))
  }
}

function normalizeStatus(raw: string | undefined | null): RequestStatus {
  const allowed: RequestStatus[] = ['to_do', 'in_progress', 'reached', 'completed']
  if (raw && allowed.includes(raw as RequestStatus)) {
    return raw as RequestStatus
  }
  if (raw === 'new') return 'to_do'
  return 'to_do'
}

function normalizeDisaster(raw: string | undefined | null): DisasterType {
  const allowed: DisasterType[] = [
    'earthquake','flood','fire','cyclone','landslide','tsunami','drought','heatwave','coldwave',
    'storm_surge','building_collapse','industrial_accident','chemical_leak','transport_accident',
    'epidemic','conflict_violence','medical_emergency','other'
  ]
  if (raw && allowed.includes(raw as DisasterType)) {
    return raw as DisasterType
  }
  return 'other'
}

const DISASTER_LABELS: Record<DisasterType, string> = {
  earthquake: 'Earthquake',
  flood: 'Flood',
  fire: 'Fire',
  cyclone: 'Cyclone',
  landslide: 'Landslide',
  tsunami: 'Tsunami',
  drought: 'Drought',
  heatwave: 'Heatwave',
  coldwave: 'Coldwave',
  storm_surge: 'Storm surge',
  building_collapse: 'Building collapse',
  industrial_accident: 'Industrial accident',
  chemical_leak: 'Chemical leak',
  transport_accident: 'Transport accident',
  epidemic: 'Epidemic',
  conflict_violence: 'Conflict / violence',
  medical_emergency: 'Medical emergency',
  other: 'Other',
}

function mapServerRequest(row: any): VictimRequest {
  return {
    id: String(row.id),
    victimName: row.victim_name || row.victimName || 'Victim',
    contact: row.contact || undefined,
    location: row.location || 'Unknown location',
    disasterType: normalizeDisaster(row.disaster_type || row.disasterType),
    disasterRaw: row.disaster_raw || row.disasterRaw || DISASTER_LABELS[normalizeDisaster(row.disaster_type || row.disasterType)],
    createdAt: Number(row.created_at || row.createdAt || Date.now()),
    status: normalizeStatus(row.status),
    assignedNgoId: row.assigned_ngo_id !== null && row.assigned_ngo_id !== undefined
      ? String(row.assigned_ngo_id)
      : row.assignedNgoId || undefined,
  }
}

export async function refreshVictimRequestsFromServer(): Promise<VictimRequest[]> {
  if (!isOnline()) {
    return getVictimRequests()
  }
  try {
    const res = await fetch(`${API_BASE}/api/requests`)
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }
    const data = await res.json()
    const rows = Array.isArray(data.requests) ? data.requests : []
    const mapped = rows.map(mapServerRequest)
    safeWrite(VICTIM_REQUESTS_KEY, mapped)
    return mapped
  } catch (err) {
    console.error('refreshVictimRequestsFromServer failed', err)
    return getVictimRequests()
  }
}

export function assignNgoToVictim(id: string, ngoId: string | null) {
  const list = getVictimRequests()
  const idx = list.findIndex(r => r.id === id)
  if (idx === -1) return
  list[idx] = { ...list[idx], assignedNgoId: ngoId || undefined }
  safeWrite(VICTIM_REQUESTS_KEY, list)
  if (isOnline()) {
    fetch(`${API_BASE}/api/requests/${id}/assign`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ngoId }),
    }).catch(err => console.error('Failed to sync assignment', err))
  }
}

export function setCurrentVictim(profile: VictimProfile) {
  safeWrite(CURRENT_VICTIM_KEY, profile)
}

export function getCurrentVictim(): VictimProfile | null {
  return safeRead<VictimProfile | null>(CURRENT_VICTIM_KEY, null)
}

export function registerNgo(rec: Omit<NgoUser, 'id'>) {
  const list = safeRead<NgoUser[]>(NGO_USERS_KEY, [])
  if (list.some(u => u.email.toLowerCase() === rec.email.toLowerCase())) {
    return { ok: false as const, error: 'NGO already registered with this email' }
  }
  const newNgo: NgoUser = { id: 'ngo_' + Date.now(), ...rec }
  list.push(newNgo)
  safeWrite(NGO_USERS_KEY, list)
  safeWrite(CURRENT_NGO_KEY, newNgo.id)
  // Fire-and-forget: attempt to geocode and populate lat/lng for this NGO
  ;(async () => {
    try { await ensureNgoCoordsForId(newNgo.id) } catch {}
  })()
  return { ok: true as const, ngo: newNgo }
}

export function attachNgoBackendId(tempId: string, backendId: string) {
  const all = getNgoUsers()
  const idx = all.findIndex(n => n.id === tempId)
  if (idx === -1) return
  const newId = backendId
  const updated = { ...all[idx], id: newId, backendId: newId }
  all[idx] = updated
  safeWrite(NGO_USERS_KEY, all)
  const currentId = safeRead<string | null>(CURRENT_NGO_KEY, null)
  if (currentId === tempId) {
    safeWrite(CURRENT_NGO_KEY, newId)
  }
  const requests = getVictimRequests()
  let changed = false
  for (const req of requests) {
    if (req.assignedNgoId === tempId) {
      req.assignedNgoId = newId
      changed = true
    }
  }
  if (changed) {
    safeWrite(VICTIM_REQUESTS_KEY, requests)
  }
}

export interface BackendNgoRecord {
  id: number | string
  name: string
  email: string
  phone: string
  address: string
  location: string
  serviceType: string
  branches?: string[]
  theme?: 'dark' | 'light'
}

export function syncNgoFromBackend(record: BackendNgoRecord) {
  const id = String(record.id)
  const list = getNgoUsers()
  const idx = list.findIndex(n => n.id === id || n.email.toLowerCase() === record.email.toLowerCase())
  const merged: NgoUser = {
    id,
    backendId: id,
    name: record.name,
    email: record.email,
    password: '',
    phone: record.phone,
    address: record.address,
    location: record.location,
    serviceType: record.serviceType,
    branches: record.branches || [],
    theme: record.theme,
  }
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...merged }
  } else {
    list.push(merged)
  }
  safeWrite(NGO_USERS_KEY, list)
  safeWrite(CURRENT_NGO_KEY, id)
  // Best-effort: ensure we have lat/lng for this NGO by geocoding its location/address
  try {
    // Fire-and-forget; do not block caller
    ;(async () => {
      await ensureNgoCoordsForId(id)
    })()
  } catch {}
  return merged
}

const GEOCODE_CACHE_KEY = 'resc_geocode_cache'

type GeocodeCacheEntry = { lat: number; lng: number; displayName?: string; ts: number }

function readGeocodeCache(): Record<string, GeocodeCacheEntry> {
  return safeRead<Record<string, GeocodeCacheEntry>>(GEOCODE_CACHE_KEY, {})
}

function writeGeocodeCache(v: Record<string, GeocodeCacheEntry>) {
  safeWrite(GEOCODE_CACHE_KEY, v)
}

function normalizeQuery(q: string | undefined | null) {
  return (q || '').toString().trim().toLowerCase()
}

export async function geocodeAndCache(query: string): Promise<{ lat: number; lng: number; displayName?: string } | null> {
  if (!query) return null
  const key = normalizeQuery(query)
  const cache = readGeocodeCache()
  if (cache[key] && typeof cache[key].lat === 'number') {
    return { lat: cache[key].lat, lng: cache[key].lng, displayName: cache[key].displayName }
  }
  if (!isOnline()) return null
  try {
    const res = await geocodeAddress(query)
    if (!res) return null
    cache[key] = { lat: res.lat, lng: res.lng, displayName: res.displayName, ts: Date.now() }
    try { writeGeocodeCache(cache) } catch {}
    return { lat: res.lat, lng: res.lng, displayName: res.displayName }
  } catch (err) {
    return null
  }
}

async function tryGeocodeVariants(query: string): Promise<{ lat: number; lng: number; displayName?: string } | null> {
  if (!query) return null
  const q = query.trim()
  // Try several helpful variants to catch landmark / neighbourhood names
  const variants = new Set<string>()
  variants.add(q)
  // common city fallbacks
  variants.add(`${q}, bengaluru`)
  variants.add(`${q}, bangalore`)
  variants.add(`${q}, karnataka`)
  // strip common suffixes like 'metro station' which sometimes confuses geocoders
  variants.add(q.replace(/metro station|metro stn|station/gi, '').trim())
  // remove parenthetical coordinates or extra brackets
  variants.add(q.replace(/\([^)]*\)/g, '').trim())
  // if the string has commas, try first part (neighbourhood) and last part (city)
  const parts = q.split(/[,\-]/).map(s => s.trim()).filter(Boolean)
  if (parts.length) {
    variants.add(parts[0])
    if (parts.length > 1) variants.add(parts.slice(-1)[0])
  }

  for (const v of variants) {
    try {
      const res = await geocodeAndCache(v)
      if (res) return res
    } catch {}
  }
  return null
}

export async function ensureNgoCoordsForId(ngoId: string): Promise<{ lat: number; lng: number } | null> {
  const all = getNgoUsers()
  const ngo = all.find(n => n.id === ngoId)
  if (!ngo) return null
  if (typeof ngo.lat === 'number' && typeof ngo.lng === 'number') return { lat: ngo.lat as number, lng: ngo.lng as number }
  const parsed = parseLatLng(ngo.location) || parseLatLng(ngo.address)
  if (parsed) {
    ngo.lat = parsed.lat
    ngo.lng = parsed.lng
    updateNgo(ngo)
    return parsed
  }
  const queries = [ngo.location, ngo.address].filter(Boolean) as string[]
  for (const q of queries) {
    try {
      const r = await geocodeAndCache(q)
      if (r) {
        ngo.lat = r.lat
        ngo.lng = r.lng
        updateNgo(ngo)
        return { lat: r.lat, lng: r.lng }
      }
    } catch {}
  }
  return null
}

export async function ensureAllNgoCoords(): Promise<void> {
  const all = getNgoUsers()
  for (const ngo of all) {
    if (typeof ngo.lat === 'number' && typeof ngo.lng === 'number') continue
    // polite delay to avoid rapid-fire geocoding requests
    // eslint-disable-next-line no-await-in-loop
    await ensureNgoCoordsForId(ngo.id)
    // small delay
    // eslint-disable-next-line no-await-in-loop
    await new Promise(r => setTimeout(r, 250))
  }
}

export function signInNgo(email: string, password: string) {
  const list = safeRead<NgoUser[]>(NGO_USERS_KEY, [])
  const user = list.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password)
  if (!user) return { ok: false as const, error: 'Invalid NGO credentials' }
  safeWrite(CURRENT_NGO_KEY, user.id)
  return { ok: true as const, ngo: user }
}

export function getNgoUsers() {
  return safeRead<NgoUser[]>(NGO_USERS_KEY, [])
}

export function deleteNgo(id: string) {
  const all = getNgoUsers()
  const filtered = all.filter(n => n.id !== id)
  safeWrite(NGO_USERS_KEY, filtered)
  const currentId = safeRead<string | null>(CURRENT_NGO_KEY, null)
  if (currentId === id) {
    localStorage.removeItem(CURRENT_NGO_KEY)
  }
}

export function getCurrentNgo(): NgoUser | null {
  const id = safeRead<string | null>(CURRENT_NGO_KEY, null)
  if (!id) return null
  const all = getNgoUsers()
  return all.find(u => u.id === id) || null
}

export function updateNgo(updated: NgoUser) {
  const all = getNgoUsers()
  const idx = all.findIndex(u => u.id === updated.id)
  if (idx === -1) return
  all[idx] = { ...all[idx], ...updated }
  safeWrite(NGO_USERS_KEY, all)
  // keep current NGO pointing at this id
  safeWrite(CURRENT_NGO_KEY, updated.id)
  // If coordinates are missing, try to populate them in background
  try {
    if (typeof updated.lat !== 'number' || typeof updated.lng !== 'number') {
      ;(async () => { try { await ensureNgoCoordsForId(updated.id) } catch {} })()
    }
  } catch {}
}

export function adminAddNgo(rec: Omit<NgoUser, 'id'>) {
  const list = safeRead<NgoUser[]>(NGO_USERS_KEY, [])
  if (list.some(u => u.email.toLowerCase() === rec.email.toLowerCase())) {
    return { ok: false as const, error: 'NGO already registered with this email' }
  }
  const newNgo: NgoUser = { id: 'ngo_' + Date.now(), ...rec }
  list.push(newNgo)
  safeWrite(NGO_USERS_KEY, list)
  // Fire-and-forget: geocode and populate lat/lng
  ;(async () => { try { await ensureNgoCoordsForId(newNgo.id) } catch {} })()
  return { ok: true as const, ngo: newNgo }
}

export function registerAdmin(name: string, email: string, password: string, adminId: string) {
  if (adminId !== ADMIN_ID) {
    return { ok: false as const, error: 'Admin ID does not match system configuration' }
  }
  const list = safeRead<AdminUser[]>(ADMIN_USERS_KEY, [])
  if (list.some(a => a.email.toLowerCase() === email.toLowerCase())) {
    return { ok: false as const, error: 'Admin already registered with this email' }
  }
  const admin: AdminUser = { id: 'admin_' + Date.now(), name, email, password }
  list.push(admin)
  safeWrite(ADMIN_USERS_KEY, list)
  safeWrite(CURRENT_ADMIN_KEY, admin.id)
  return { ok: true as const, admin }
}

export function signInAdmin(adminId: string, password: string) {
  if (adminId !== ADMIN_ID) {
    return { ok: false as const, error: 'Invalid Admin ID' }
  }
  const list = safeRead<AdminUser[]>(ADMIN_USERS_KEY, [])
  const admin = list.find(a => a.password === password)
  if (!admin) return { ok: false as const, error: 'Invalid password' }
  safeWrite(CURRENT_ADMIN_KEY, admin.id)
  return { ok: true as const, admin }
}

export function getAdminUsers() {
  return safeRead<AdminUser[]>(ADMIN_USERS_KEY, [])
}

export function getCurrentAdmin(): AdminUser | null {
  const id = safeRead<string | null>(CURRENT_ADMIN_KEY, null)
  if (!id) return null
  const list = getAdminUsers()
  return list.find(a => a.id === id) || null
}

export function setCurrentRole(role: CurrentRole) {
  safeWrite(CURRENT_ROLE_KEY, role)
}

export function getCurrentRole(): CurrentRole {
  return safeRead<CurrentRole>(CURRENT_ROLE_KEY, null)
}

export function logoutAll() {
  localStorage.removeItem(CURRENT_VICTIM_KEY)
  localStorage.removeItem(CURRENT_NGO_KEY)
  localStorage.removeItem(CURRENT_ADMIN_KEY)
  localStorage.removeItem(CURRENT_ROLE_KEY)
}
