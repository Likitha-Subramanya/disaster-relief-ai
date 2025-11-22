import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'
import { createWorker } from 'tesseract.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Reuse same DB as main backend
const dbPath = path.join(__dirname, 'rescuetech.db')
const db = new Database(dbPath)

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const OPENAI_EMBED_MODEL = 'text-embedding-3-small'
export const EMBEDDING_MODEL = OPENAI_EMBED_MODEL

const DEFAULT_WEIGHTS = {
  service: 20,
  location: 1,
  vector: 30,
  eta: 1,
  load: -1.5,
}

let cachedWeights = null
let cachedWeightsFetchedAt = 0

function getRoutingWeightsFromDb() {
  const row = db.prepare('SELECT service_weight, location_weight, vector_weight, eta_weight, load_weight FROM routing_weights WHERE id = 1').get()
  if (!row) return { ...DEFAULT_WEIGHTS }
  return {
    service: Number(row.service_weight) || DEFAULT_WEIGHTS.service,
    location: Number(row.location_weight) || DEFAULT_WEIGHTS.location,
    vector: Number(row.vector_weight) || DEFAULT_WEIGHTS.vector,
    eta: Number(row.eta_weight) || DEFAULT_WEIGHTS.eta,
    load: Number(row.load_weight) || DEFAULT_WEIGHTS.load,
  }
}

function persistRoutingWeights(weights) {
  db.prepare(`
    INSERT INTO routing_weights (id, service_weight, location_weight, vector_weight, eta_weight, load_weight, updated_at)
    VALUES (1, @service, @location, @vector, @eta, @load, @updatedAt)
    ON CONFLICT(id) DO UPDATE SET
      service_weight = excluded.service_weight,
      location_weight = excluded.location_weight,
      vector_weight = excluded.vector_weight,
      eta_weight = excluded.eta_weight,
      load_weight = excluded.load_weight,
      updated_at = excluded.updated_at
  `).run({
    service: weights.service,
    location: weights.location,
    vector: weights.vector,
    eta: weights.eta,
    load: weights.load,
    updatedAt: Date.now(),
  })
  cachedWeights = { ...weights }
  cachedWeightsFetchedAt = Date.now()
}

function getRoutingWeights() {
  if (!cachedWeights || Date.now() - cachedWeightsFetchedAt > 5 * 60 * 1000) {
    cachedWeights = getRoutingWeightsFromDb()
    cachedWeightsFetchedAt = Date.now()
  }
  return cachedWeights
}

function avgAbs(rows, key) {
  if (!rows.length) return 0
  const sum = rows.reduce((acc, row) => acc + Math.abs(Number(row[key]) || 0), 0)
  return sum / rows.length
}

export function recomputeRoutingWeights() {
  const rows = db
    .prepare(
      'SELECT service_score, location_score, vector_score, eta_score, load, completed_at FROM routing_feedback ORDER BY assigned_at DESC LIMIT 200'
    )
    .all()
  if (rows.length < 20) return getRoutingWeights()
  const completed = rows.filter(row => row.completed_at)
  if (!completed.length) return getRoutingWeights()

  const newWeights = { ...DEFAULT_WEIGHTS }
  const specs = [
    { key: 'service', column: 'service_score' },
    { key: 'location', column: 'location_score' },
    { key: 'vector', column: 'vector_score' },
    { key: 'eta', column: 'eta_score' },
    { key: 'load', column: 'load' },
  ]

  for (const spec of specs) {
    const avgAll = avgAbs(rows, spec.column)
    if (!avgAll) continue
    const avgCompleted = avgAbs(completed, spec.column)
    let factor = avgCompleted / avgAll
    if (!Number.isFinite(factor) || factor <= 0) factor = 1
    factor = Math.max(0.5, Math.min(1.5, factor))
    newWeights[spec.key] = DEFAULT_WEIGHTS[spec.key] * factor
  }

  persistRoutingWeights(newWeights)
  return newWeights
}

export function logRoutingDecision({ requestId, ngoId, disasterType, via, meta }) {
  if (!requestId || !ngoId || !meta) return
  try {
    const weights = getRoutingWeights()
    db.prepare(`
      INSERT INTO routing_feedback (
        request_id, ngo_id, disaster_type, via,
        service_score, location_score, vector_score, eta_score, eta_minutes, load,
        total_score, weights_json, assigned_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      requestId,
      Number(ngoId),
      disasterType,
      via,
      meta.serviceScore ?? null,
      meta.locationScore ?? null,
      meta.vectorScore ?? null,
      meta.etaScore ?? null,
      meta.etaMinutes ?? null,
      meta.load ?? null,
      meta.totalScore ?? null,
      JSON.stringify(weights),
      Date.now()
    )
  } catch (err) {
    console.error('logRoutingDecision failed', err)
  }
}

export function markRoutingFeedbackCompletion({ requestId, status }) {
  if (!requestId) return
  db.prepare('UPDATE routing_feedback SET completion_status = ?, completed_at = ? WHERE request_id = ?')
    .run(status || 'completed', Date.now(), requestId)
  recomputeRoutingWeights()
}

const DISASTER_TYPES = [
  'earthquake','flood','fire','cyclone','landslide','tsunami','drought','heatwave','coldwave',
  'storm_surge','building_collapse','industrial_accident','chemical_leak','transport_accident',
  'epidemic','conflict_violence','medical_emergency','other'
]

const CATEGORY_VALUES = ['medical','rescue','shelter','supplies','unknown']

const CATEGORY_KEYWORDS = {
  medical: ['injury','doctor','medic','hospital','medicine','bleeding','ambulance','fracture','fever','sick','pregnant','unconscious'],
  rescue: ['trapped','rescue','collapsed','stuck','evacuate','help me','save','boat','lift','blocked','search','buried'],
  shelter: ['shelter','homeless','evacuated','displaced','camp','tent','roof','stay','lodging','sleep','relocate'],
  supplies: ['food','water','blanket','supplies','kit','ration','milk','diaper','sanitary','flashlight','medicine kit','aid kit'],
  unknown: [],
}

function estimateEtaScore(victimCoords, ngoCoords) {
  if (!victimCoords || !ngoCoords) return { etaScore: 0, etaMinutes: null }
  const km = haversineKm(victimCoords, ngoCoords)
  const avgSpeedKmh = 40
  const etaMinutes = (km / avgSpeedKmh) * 60
  let etaScore = 0
  if (etaMinutes <= 10) etaScore = 6
  else if (etaMinutes <= 20) etaScore = 4
  else if (etaMinutes <= 40) etaScore = 2
  else if (etaMinutes <= 60) etaScore = 1
  else etaScore = -Math.min(6, etaMinutes / 15)
  return { etaScore, etaMinutes: Number.isFinite(etaMinutes) ? etaMinutes : null }
}

async function callEmbeddingAPI(input) {
  if (!OPENAI_API_KEY) return null
  const payload = String(input || '').trim()
  if (!payload) return null
  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: payload,
        model: OPENAI_EMBED_MODEL,
      }),
    })
    if (!res.ok) throw new Error(`Embedding error ${res.status}`)
    const data = await res.json()
    const vector = data?.data?.[0]?.embedding
    return Array.isArray(vector) ? vector : null
  } catch (err) {
    console.error('Embedding request failed', err)
    return null
  }
}

export async function embedRequestVector(message, locationText) {
  const content = [message || '', locationText || ''].join('\n').trim()
  return callEmbeddingAPI(content)
}

export async function embedServiceProfileVector(serviceSummary) {
  return callEmbeddingAPI(serviceSummary)
}

export function getActiveNgoLoadMap() {
  const rows = db
    .prepare(`
      SELECT assigned_ngo_id AS ngoId, COUNT(*) AS cnt
      FROM victim_requests
      WHERE assigned_ngo_id IS NOT NULL AND status != 'completed'
      GROUP BY assigned_ngo_id
    `)
    .all()
  const map = {}
  rows.forEach(row => {
    if (row.ngoId !== null && row.ngoId !== undefined) {
      map[String(row.ngoId)] = Number(row.cnt) || 0
    }
  })
  return map
}

export async function aiRouteRequest({ message, locationText }) {
  const ngos = db.prepare('SELECT id, name, service_type, location, service_vector, lat, lng FROM ngos').all()
  const ngoLoads = getActiveNgoLoadMap()

  if (!OPENAI_API_KEY || !ngos.length) {
    const requestVector = await embedRequestVector(message, locationText)
    const fallback = simpleHeuristicRoute({ message, locationText, ngos, requestVector, ngoLoads })
    return { ...fallback, usedAi: false }
  }

  const payload = buildOpenAiPayload({ message, locationText, ngos })

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(`OpenAI error ${res.status}`)
    const data = await res.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) throw new Error('No content from OpenAI')

    let parsed
    try {
      parsed = JSON.parse(content)
    } catch {
      throw new Error('Invalid JSON from OpenAI')
    }

    const disasterType = DISASTER_TYPES.includes(parsed.disasterType) ? parsed.disasterType : 'other'
    const assignedNgoId = typeof parsed.assignedNgoId === 'number' || typeof parsed.assignedNgoId === 'string'
      ? String(parsed.assignedNgoId)
      : undefined

    if (!assignedNgoId) {
      const requestVector = await embedRequestVector(message, locationText)
      const fallbackNgo = simpleHeuristicRoute({ message, locationText, ngos, requestVector, ngoLoads }).assignedNgoId
      return {
        disasterType,
        assignedNgoId: fallbackNgo,
        reason: parsed.reason || 'AI selected disaster type; NGO chosen by heuristic fallback.',
        usedAi: true,
      }
    }

    return {
      disasterType,
      assignedNgoId,
      reason: parsed.reason || 'AI selected this disaster type and NGO based on services and location.',
      usedAi: true,
    }
  } catch (err) {
    console.error('aiRouteRequest failed, using heuristic fallback', err)
    const requestVector = await embedRequestVector(message, locationText)
    const fallback = simpleHeuristicRoute({ message, locationText, ngos, requestVector })
    return {
      ...fallback,
      reason: (fallback.reason || '') + ' (AI unavailable, heuristic used instead)',
      usedAi: false,
    }
  }
}

export async function aiIntakeTriage({ text, ocrText, audioTranscript, location }) {
  const ngos = db.prepare('SELECT id, name, service_type, location, service_vector, lat, lng FROM ngos').all()
  const ngoLoads = getActiveNgoLoadMap()
  const combined = [text, ocrText, audioTranscript].map(t => (t || '').trim()).filter(Boolean).join('\n').trim()
  const locationText = location?.label || location?.text || ''

  const buildFallback = async () => {
    const fallbackText = combined || 'No detailed description provided.'
    const category = simpleCategory(fallbackText)
    const urgency = simpleUrgency(fallbackText)
    const requestVector = await embedRequestVector(fallbackText, locationText)
    const routing = simpleHeuristicRoute({ message: fallbackText, locationText, ngos, requestVector, ngoLoads })
    const signals = detectIncidentSignals(fallbackText)
    return {
      summary: fallbackText.slice(0, 400),
      category,
      urgency,
      disasterType: routing.disasterType,
      assignedNgoId: routing.assignedNgoId,
      reason: routing.reason,
      needs: [],
      usedAi: false,
      severityLevel: signals.severityLevel,
      severityLabel: signals.severityLabel,
      severityReason: signals.severityReason,
      peopleAffected: signals.peopleAffected,
      trapped: signals.trapped,
      injured: signals.injured,
      specialConstraints: signals.specialConstraints,
      uncertaintyReasons: signals.uncertaintyReasons,
    }
  }

  if (!combined) {
    return buildFallback()
  }

  if (!OPENAI_API_KEY || !ngos.length) {
    return buildFallback()
  }

  const payload = buildIntakePayload({ combined, ocrText, audioTranscript, locationText, ngos })

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(`OpenAI error ${res.status}`)
    const data = await res.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) throw new Error('No content from OpenAI')

    let parsed
    try {
      parsed = JSON.parse(content)
    } catch {
      throw new Error('Invalid JSON from OpenAI intake triage')
    }

    const category = CATEGORY_VALUES.includes(parsed.category) ? parsed.category : simpleCategory(combined)
    const urgency = clampUrgency(parsed.urgency)
    const summary = typeof parsed.summary === 'string' && parsed.summary.trim() ? parsed.summary.trim() : combined.slice(0, 400)
    const needs = Array.isArray(parsed.needs) ? parsed.needs : []
    const severityLevel = clampUrgency(parsed.severityLevel ?? parsed.urgency)
    const severityReason = typeof parsed.severityReason === 'string' && parsed.severityReason.trim()
      ? parsed.severityReason.trim()
      : 'AI severity estimate'
    const severityLabel = severityLabelFromLevel(severityLevel)
    const signalsFallback = detectIncidentSignals(combined)
    const peopleAffected = Number.isFinite(parsed.peopleAffected) ? Number(parsed.peopleAffected) : signalsFallback.peopleAffected
    const trapped = typeof parsed.trapped === 'boolean' ? parsed.trapped : signalsFallback.trapped
    const injured = typeof parsed.injured === 'boolean' ? parsed.injured : signalsFallback.injured
    const specialConstraints = Array.isArray(parsed.specialConstraints) && parsed.specialConstraints.length
      ? parsed.specialConstraints
      : signalsFallback.specialConstraints
    const uncertaintyReasons = Array.isArray(parsed.uncertaintyReasons) && parsed.uncertaintyReasons.length
      ? parsed.uncertaintyReasons
      : signalsFallback.uncertaintyReasons

    let disasterType = DISASTER_TYPES.includes(parsed.disasterType) ? parsed.disasterType : undefined
    let assignedNgoId = parsed.assignedNgoId ? String(parsed.assignedNgoId) : undefined
    if (!assignedNgoId || !disasterType) {
      const requestVector = await embedRequestVector(combined, locationText)
      const routing = simpleHeuristicRoute({ message: combined, locationText, ngos, requestVector, ngoLoads })
      assignedNgoId = assignedNgoId || routing.assignedNgoId
      disasterType = disasterType || routing.disasterType
      parsed.reason = parsed.reason || routing.reason
    }

    return {
      summary,
      category,
      urgency,
      disasterType,
      assignedNgoId,
      reason: parsed.reason || 'AI triage completed using OpenAI model.',
      needs,
      usedAi: true,
      severityLevel,
      severityLabel,
      severityReason,
      peopleAffected,
      trapped,
      injured,
      specialConstraints,
      uncertaintyReasons,
    }
  } catch (err) {
    console.error('aiIntakeTriage failed, using heuristic fallback', err)
    return buildFallback()
  }
}

function buildOpenAiPayload({ message, locationText, ngos }) {
  const ngoSummary = ngos.map(n => ({
    id: n.id,
    name: n.name,
    serviceType: n.service_type,
    location: n.location,
  }))

  const system = `You are an emergency triage router for a disaster relief platform. 
You receive a victim's free-text emergency description and approximate location, 
and a list of available NGOs with their service types and locations.

Your job:
1) Classify the situation into ONE of these disaster types: ${DISASTER_TYPES.join(', ')}.
2) Pick the SINGLE best NGO id from the list that should respond first, based on:
   - Matching services (search and rescue, medical aid, shelter, food, logistics, etc.)
   - Proximity / same city / same district where possible
3) Explain briefly why you chose this type and NGO.

Respond ONLY as compact JSON with keys: disasterType, assignedNgoId, reason.`

  const user = {
    role: 'user',
    content: JSON.stringify({
      message,
      locationText,
      ngos: ngoSummary,
    }),
  }

  return {
    model: 'gpt-4o-mini',
    temperature: 0.2,
    messages: [
      { role: 'system', content: system },
      user,
    ],
  }
}

function normalize(str) {
  return (str || '').toString().toLowerCase()
}

function splitServices(raw = '') {
  return raw
    .split(/[\n,/|]/)
    .map(token => normalize(token).trim())
    .filter(Boolean)
}

function parseVector(raw) {
  if (!raw) return null
  try {
    const arr = JSON.parse(raw)
    if (Array.isArray(arr)) return arr.map(Number)
  } catch {
    return null
  }
  return null
}

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return 0
  let dot = 0
  let magA = 0
  let magB = 0
  for (let i = 0; i < a.length; i += 1) {
    const va = a[i]
    const vb = b[i]
    dot += va * vb
    magA += va * va
    magB += vb * vb
  }
  if (!magA || !magB) return 0
  return dot / (Math.sqrt(magA) * Math.sqrt(magB))
}

function parseLatLng(raw) {
  if (!raw) return null
  const match = raw.trim().match(/(-?\d+(?:\.\d+)?)\s*[\s,]\s*(-?\d+(?:\.\d+)?)/)
  if (!match) return null
  const lat = Number(match[1])
  const lng = Number(match[2])
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}

function coalesceNgoCoords(ngo) {
  if (Number.isFinite(ngo?.lat) && Number.isFinite(ngo?.lng)) {
    return { lat: Number(ngo.lat), lng: Number(ngo.lng) }
  }
  return parseLatLng(ngo?.location || '')
}

function haversineKm(a, b) {
  const toRad = deg => (deg * Math.PI) / 180
  const R = 6371
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

function computeTextualLocationScore(victimLoc, ngoLoc) {
  if (!victimLoc || !ngoLoc) return 0
  if (ngoLoc === victimLoc) return 3
  const victimParts = victimLoc
    .split(/[\n,]/)
    .map(p => p.trim())
    .filter(Boolean)
  const match = victimParts.find(part => part && ngoLoc.includes(part))
  if (match) {
    return match.length > 4 ? 2.5 : 2
  }
  if (victimLoc.includes(ngoLoc)) return 1
  return -0.5
}

function computeLocationScore(victimLocRaw, ngoLocRaw) {
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

function serviceMatchScore(tokens, preferred) {
  const prefTokens = preferred.map(p => normalize(p))
  let matches = 0
  prefTokens.forEach(pref => {
    if (tokens.some(token => token.includes(pref) || pref.includes(token))) {
      matches += 1
    }
  })
  if (matches === 0 && tokens.some(token => token.includes('general support') || token.includes('volunteer coordination'))) {
    matches = 1
  }
  return matches
}

export function simpleHeuristicRoute({ message, locationText, ngos, requestVector, ngoLoads = {} }) {
  const text = normalize(message + ' ' + locationText)

  let disasterType = 'other'
  if (/earthquake|tremor|aftershock/.test(text)) disasterType = 'earthquake'
  else if (/flood|water level|overflow|inundat/.test(text)) disasterType = 'flood'
  else if (/tsunami/.test(text)) disasterType = 'tsunami'
  else if (/cyclone|hurricane|typhoon|storm/.test(text)) disasterType = 'cyclone'
  else if (/landslide|mudslide/.test(text)) disasterType = 'landslide'
  else if (/collapse|building collapsed|house collapsed/.test(text)) disasterType = 'building_collapse'
  else if (/fire|burning|smoke/.test(text)) disasterType = 'fire'
  else if (/chemical|gas leak|toxic|poison/.test(text)) disasterType = 'chemical_leak'
  else if (/accident|crash|collision|derail/.test(text)) disasterType = 'transport_accident'
  else if (/fever|virus|epidemic|outbreak|disease/.test(text)) disasterType = 'epidemic'
  else if (/attack|violence|fighting|riot/.test(text)) disasterType = 'conflict_violence'
  else if (/injury|heart attack|unconscious|bleeding|ambulance/.test(text)) disasterType = 'medical_emergency'
  else if (/drought|no rain|dry/.test(text)) disasterType = 'drought'
  else if (/heat wave|heatwave|very hot|heat stroke/.test(text)) disasterType = 'heatwave'
  else if (/cold wave|coldwave|snow|freezing/.test(text)) disasterType = 'coldwave'

  const preferred = (() => {
    const key = disasterType
    if (key === 'earthquake' || key === 'building_collapse' || key === 'landslide') {
      return ['search and rescue', 'temporary shelter', 'medical aid', 'logistics']
    } else if (key === 'flood' || key === 'storm_surge' || key === 'tsunami') {
      return ['search and rescue', 'food & water', 'temporary shelter', 'logistics']
    } else if (key === 'fire' || key === 'industrial_accident' || key === 'chemical_leak') {
      return ['search and rescue', 'medical aid', 'logistics']
    } else if (key === 'epidemic' || key === 'medical_emergency') {
      return ['medical aid', 'ambulance support']
    } else if (key === 'drought' || key === 'heatwave' || key === 'coldwave') {
      return ['food & water', 'temporary shelter']
    } else {
      return ['general support', 'volunteer coordination', 'food & water', 'temporary shelter']
    }
  })()

  const victimLocRaw = locationText || ''
  const victimCoords = parseLatLng(victimLocRaw)
  const scored = ngos.map(ngo => {
    const services = splitServices(ngo.service_type || '')
    const serviceScore = serviceMatchScore(services, preferred)
    const locationScore = computeLocationScore(victimLocRaw, ngo.location || '')
    const ngoCoords = coalesceNgoCoords(ngo)
    const { etaScore, etaMinutes } = estimateEtaScore(victimCoords, ngoCoords)
    let vectorScore = 0
    if (requestVector && ngo.service_vector) {
      const ngoVector = parseVector(ngo.service_vector)
      if (ngoVector) {
        vectorScore = cosineSimilarity(requestVector, ngoVector) * 30
      }
    }
    const load = ngoLoads[String(ngo.id)] || 0
    const loadScore = load ? -Math.min(6, load * 1.5) : 0
    const totalScore = serviceScore * 20 + locationScore + vectorScore + etaScore + loadScore
    return { ngo, totalScore, serviceScore, locationScore, vectorScore, etaScore, etaMinutes, load }
  })

  const serviceFiltered = scored.filter(entry => entry.serviceScore > 0)
  const pool = serviceFiltered.length ? serviceFiltered : scored

  const best = pool.reduce((acc, curr) => {
    if (!acc || curr.totalScore > acc.totalScore) {
      return curr
    }
    return acc
  }, null)

  const assignedNgoId = best?.ngo ? String(best.ngo.id) : undefined

  return {
    disasterType,
    assignedNgoId,
    reason: best
      ? `Scores — service: ${best.serviceScore}, location: ${best.locationScore.toFixed(1)}, semantic: ${best.vectorScore?.toFixed(2) || '0.00'}, ETA: ${best.etaMinutes ? `${best.etaMinutes.toFixed(1)}m` : 'n/a'}, load: ${best.load} → NGO ${best.ngo.name}`
      : 'No NGOs available for heuristic routing.',
  }
}

function buildIntakePayload({ combined, ocrText, audioTranscript, locationText, ngos }) {
  const ngoSummary = ngos.map(n => ({
    id: n.id,
    name: n.name,
    serviceType: n.service_type,
    location: n.location,
  }))

  const system = `You are an emergency triage specialist helping a crisis coordination center.
You receive:
- Raw victim text (multiple channels such as manual text, OCR, or voice transcript)
- Approximate location
- A list of NGOs/providers with their service types and locations.

Your tasks:
1) Produce a short summary (<= 80 words) of the situation.
2) Classify the request category as one of: ${CATEGORY_VALUES.join(', ')}.
3) Estimate urgency on a scale of 1 (low) to 5 (critical).
4) Map to ONE disasterType from: ${DISASTER_TYPES.join(', ')}.
5) Pick the best NGO id to respond first and explain briefly why.
6) List key needs as an array of short phrases.
7) Estimate severityLevel (1-5) with a brief severityReason and state peopleAffected (number or null).
8) Indicate if people seem trapped or injured (booleans) and list any specialConstraints (children, elderly, access_blocked, hazardous, etc.).
9) Provide any uncertaintyReasons as an array when details are unclear.

Respond ONLY in JSON with keys: summary, category, urgency, disasterType, assignedNgoId, reason, needs, severityLevel, severityReason, peopleAffected, trapped, injured, specialConstraints, uncertaintyReasons.`

  const user = {
    role: 'user',
    content: JSON.stringify({
      combinedText: combined,
      ocrText,
      audioTranscript,
      locationText,
      ngos: ngoSummary,
    }),
  }

  return {
    model: 'gpt-4o-mini',
    temperature: 0.2,
    messages: [
      { role: 'system', content: system },
      user,
    ],
  }
}

function simpleCategory(text) {
  const content = normalize(text)
  let best = 'unknown'
  let bestScore = 0
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0
    keywords.forEach(word => {
      if (content.includes(word)) score += 1
    })
    if (score > bestScore) {
      best = category
      bestScore = score
    }
  }
  return best
}

function simpleUrgency(text) {
  const content = normalize(text)
  let urgency = 2
  if (/(critical|urgent|immediate|bleeding|unconscious|trapped|child|baby|infant)/.test(content)) urgency += 2
  if (/(elderly|pregnant|disabled|injury|fracture)/.test(content)) urgency += 1
  return clampUrgency(urgency)
}

function clampUrgency(val) {
  const num = Number(val)
  if (Number.isNaN(num)) return 2
  return Math.max(1, Math.min(5, Math.round(num)))
}

// --- Advanced triage helpers and entrypoint ---
export async function computeNgoReliability(ngoId) {
  try {
    const row = db.prepare('SELECT reliability_score FROM ngo_reliability WHERE ngo_id = ?').get(ngoId)
    if (row && Number.isFinite(Number(row.reliability_score))) return Number(row.reliability_score)
    return 0.5
  } catch (err) {
    return 0.5
  }
}

export function estimateTravelTimeMinutes(victimLocRaw, ngo) {
  const victimCoords = parseLatLng(victimLocRaw)
  const ngoCoords = coalesceNgoCoords(ngo)
  if (!victimCoords || !ngoCoords) return null
  const km = haversineKm(victimCoords, ngoCoords)
  const avgSpeedKmh = 40 // approximated; can be tuned by routing weights
  const minutes = (km / avgSpeedKmh) * 60
  return Number.isFinite(minutes) ? minutes : null
}

export async function advancedTriage({ text, ocrText, audioTranscript, photos, location, requestId } = {}) {
  const combined = [text, ocrText, audioTranscript].map(t => (t || '').trim()).filter(Boolean).join('\n').trim()
  const locationText = location?.label || location?.text || ''

  // If photos are provided, try to extract OCR text from them and append
  let photosOcr = ''
  if (Array.isArray(photos) && photos.length) {
    try {
      const worker = await createWorker({ logger: () => {} })
      await worker.load()
      await worker.loadLanguage('eng')
      await worker.initialize('eng')
      for (const p of photos) {
        try {
          // photos expected as data URL or buffer; pass directly
          const image = p && p.data ? p.data : p
          const { data: { text: t } = {} } = await worker.recognize(image)
          if (t) photosOcr += '\n' + t
        } catch (pe) {
          console.error('Photo OCR failed for one image', pe)
        }
      }
      try { await worker.terminate() } catch (e) {}
    } catch (err) {
      console.error('Failed to initialize Tesseract worker', err)
    }
  }

  const combinedOcr = [ocrText || '', photosOcr].filter(Boolean).join('\n').trim()

  // Run intake triage to get structured summary (AI if available, otherwise heuristics)
  const intake = await aiIntakeTriage({ text: text || '', ocrText: combinedOcr || '', audioTranscript: audioTranscript || '', location })

  // Collect NGO data and current loads
  const ngos = db.prepare('SELECT id, name, service_type, location, service_vector, lat, lng FROM ngos').all()
  const ngoLoads = getActiveNgoLoadMap()
  const reliabilityRows = db.prepare('SELECT ngo_id, reliability_score FROM ngo_reliability').all()
  const reliabilityMap = {}
  reliabilityRows.forEach(row => {
    if (row && row.ngo_id !== undefined && row.ngo_id !== null) {
      reliabilityMap[String(row.ngo_id)] = Number(row.reliability_score)
    }
  })

  // Compute shortlist: match services and score each NGO with reliability and ETA
  const requestVector = await embedRequestVector(combined || intake.summary || '', locationText)

  const scored = ngos.map(ngo => {
    const services = splitServices(ngo.service_type || '')
    const serviceScore = serviceMatchScore(services, (intake.needs && intake.needs.length) ? intake.needs : [intake.category || 'general support'])
    const locationScore = computeLocationScore(locationText || intake.location || '', ngo.location || '')
    let vectorScore = 0
    if (requestVector && ngo.service_vector) {
      const ngoVector = parseVector(ngo.service_vector)
      if (ngoVector) vectorScore = cosineSimilarity(requestVector, ngoVector) * 30
    }
    const etaMinutes = estimateTravelTimeMinutes(locationText || intake.location || '', ngo)
    const etaScore = etaMinutes == null ? 0 : Math.max(0, 6 - Math.min(6, etaMinutes / 10))
    const load = ngoLoads[String(ngo.id)] || 0
    const loadScore = load ? -Math.min(6, load * 1.5) : 0
    const reliabilityScore = Number.isFinite(reliabilityMap[String(ngo.id)]) ? reliabilityMap[String(ngo.id)] : 0.5
    const reliabilityWeighted = reliabilityScore * 12
    const totalScore = serviceScore * 25 + locationScore * 1 + vectorScore + etaScore + loadScore + reliabilityWeighted
    return { ngo, totalScore, serviceScore, locationScore, vectorScore, etaScore, etaMinutes, load, reliability: reliabilityScore }
  })

  // Sort and pick top N shortlist
  const pool = scored.filter(s => s.serviceScore > 0)
  const shortlistPool = pool.length ? pool : scored
  shortlistPool.sort((a, b) => b.totalScore - a.totalScore)
  const shortlist = shortlistPool.slice(0, 5).map(s => ({
    ngoId: s.ngo.id,
    name: s.ngo.name,
    scores: {
      total: s.totalScore,
      service: s.serviceScore,
      location: s.locationScore,
      semantic: Number((s.vectorScore || 0).toFixed(2)),
      etaMinutes: s.etaMinutes,
      load: s.load,
      reliability: Number((s.reliability || 0).toFixed(2)),
    },
    reason: `service:${s.serviceScore} location:${s.locationScore.toFixed(1)} semantic:${(s.vectorScore||0).toFixed(2)} eta:${s.etaMinutes ? s.etaMinutes.toFixed(1)+'m' : 'n/a'} reliability:${(s.reliability || 0).toFixed(2)}`
  }))

  const selected = shortlist[0]

  // Confidence: simple heuristic — prefer AI outputs but lower when heuristics only
  const baseConfidence = intake.usedAi ? 0.75 : 0.45
  const confidence = Math.max(0, Math.min(1, baseConfidence))

  const signals = detectIncidentSignals([combined, combinedOcr, photosOcr, intake.summary].filter(Boolean).join('\n'))
  const severityLevel = Number.isFinite(intake.severityLevel) ? clampUrgency(intake.severityLevel) : signals.severityLevel
  const result = {
    summary: intake.summary || combined.slice(0, 400),
    category: intake.category,
    urgency: intake.urgency,
    disasterType: intake.disasterType,
    needs: intake.needs || [],
    severityLevel,
    severityLabel: intake.severityLabel || severityLabelFromLevel(severityLevel),
    severityReason: intake.severityReason || signals.severityReason,
    peopleAffected: intake.peopleAffected ?? signals.peopleAffected ?? null,
    trapped: typeof intake.trapped === 'boolean' ? intake.trapped : signals.trapped,
    injured: typeof intake.injured === 'boolean' ? intake.injured : signals.injured,
    specialConstraints: (intake.specialConstraints && intake.specialConstraints.length ? intake.specialConstraints : signals.specialConstraints),
    shortlist,
    selectedNgo: selected ? {
      ngoId: selected.ngoId,
      name: selected.name,
      reason: selected.reason,
      etaMinutes: selected.scores?.etaMinutes ?? null,
      reliability: selected.scores?.reliability ?? null,
    } : null,
    confidence,
    usedAi: intake.usedAi,
    reason: intake.reason || (selected ? selected.reason : 'heuristic'),
    uncertaintyReasons: (intake.uncertaintyReasons && intake.uncertaintyReasons.length ? intake.uncertaintyReasons : signals.uncertaintyReasons),
    uncertaintyFlag: Boolean((intake.uncertaintyReasons && intake.uncertaintyReasons.length) || signals.uncertaintyReasons.length),
  }

  // Persist triage audit log
  try {
    db.prepare('INSERT INTO ai_triage_logs (request_id, payload_json, result_json, confidence, used_ai, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(requestId || null, JSON.stringify({ text, ocrText, audioTranscript, photos, location }), JSON.stringify(result), result.confidence || confidence, intake.usedAi ? 1 : 0, Date.now())
  } catch (err) {
    console.error('Failed to record ai_triage_logs', err)
  }

  return result
}

// Recompute NGO reliability from routing_feedback table
export function recomputeAllNgoReliability() {
  try {
    const rows = db.prepare('SELECT ngo_id, COUNT(*) AS total, SUM(CASE WHEN completion_status = "completed" THEN 1 ELSE 0 END) AS completed FROM routing_feedback GROUP BY ngo_id').all()
    const updates = []
    rows.forEach(r => {
      const ngoId = r.ngo_id
      const total = Number(r.total) || 0
      const completed = Number(r.completed) || 0
      const score = total ? completed / total : 0
      db.prepare('INSERT INTO ngo_reliability (ngo_id, reliability_score, last_updated) VALUES (?, ?, ?) ON CONFLICT(ngo_id) DO UPDATE SET reliability_score = excluded.reliability_score, last_updated = excluded.last_updated').run(ngoId, score, Date.now())
      updates.push({ ngoId, score })
    })
    return updates
  } catch (err) {
    console.error('Failed to recompute NGO reliability', err)
    return []
  }
}

// --- Batch optimization ---
export async function optimizeBatchAssignment(requestRows) {
  // requestRows: array of { id, location, disaster_type, message }
  const ngos = db.prepare('SELECT id, name, service_type, location, service_vector, lat, lng FROM ngos').all()
  const ngoLoads = getActiveNgoLoadMap()

  // For each request, compute best NGO score similar to advancedTriage but in batch
  const results = []
  const ngoLoadMutable = { ...ngoLoads }

  // precompute vectors for requests
  const requestVectors = {}
  for (const r of requestRows) {
    requestVectors[r.id] = await embedRequestVector(r.message || r.disaster_type || '', r.location || '')
  }

  // sort requests by urgency proxy (not provided) – use Created order (assume requestRows provided sorted by priority)
  for (const r of requestRows) {
    let best = null
    for (const ngo of ngos) {
      const services = splitServices(ngo.service_type || '')
      const preferred = [r.disaster_type || 'general support']
      const serviceScore = serviceMatchScore(services, preferred)
      const locationScore = computeLocationScore(r.location || '', ngo.location || '')
      let vectorScore = 0
      const reqVec = requestVectors[r.id]
      if (reqVec && ngo.service_vector) {
        const ngoVec = parseVector(ngo.service_vector)
        if (ngoVec) vectorScore = cosineSimilarity(reqVec, ngoVec) * 30
      }
      const etaMinutes = estimateTravelTimeMinutes(r.location || '', ngo)
      const etaScore = etaMinutes == null ? 0 : Math.max(0, 6 - Math.min(6, etaMinutes / 10))
      const load = ngoLoadMutable[String(ngo.id)] || 0
      const loadScore = load ? -Math.min(6, load * 1.5) : 0
      const reliabilityRow = db.prepare('SELECT reliability_score FROM ngo_reliability WHERE ngo_id = ?').get(ngo.id)
      const reliabilityScore = reliabilityRow && Number.isFinite(Number(reliabilityRow.reliability_score)) ? Number(reliabilityRow.reliability_score) : 0.5
      const totalScore = serviceScore * 25 + locationScore * 1 + vectorScore + etaScore + loadScore + (reliabilityScore * 10)
      if (!best || totalScore > best.totalScore) {
        best = { ngo, totalScore, serviceScore, locationScore, vectorScore, etaMinutes, load }
      }
    }
    if (best) {
      // assign and increment load
      const assignId = Number.isFinite(Number(best.ngo.id)) ? Number(best.ngo.id) : best.ngo.id
      ngoLoadMutable[String(best.ngo.id)] = (ngoLoadMutable[String(best.ngo.id)] || 0) + 1
      results.push({ requestId: r.id, assignedNgoId: assignId, reason: `score:${best.totalScore.toFixed(2)}` })
    } else {
      results.push({ requestId: r.id, assignedNgoId: null, reason: 'no-ngos' })
    }
  }
  return results
}

// --- Anomaly detection helpers ---
export function jaccardSimilarity(a, b) {
  if (!a || !b) return 0
  const sa = new Set(String(a).toLowerCase().split(/\W+/).filter(Boolean))
  const sb = new Set(String(b).toLowerCase().split(/\W+/).filter(Boolean))
  const inter = [...sa].filter(x => sb.has(x)).length
  const uni = new Set([...sa, ...sb]).size
  return uni ? inter / uni : 0
}

export function computeAnomalyScores(limit = 200) {
  // Return simple anomaly scores for recent requests
  const rows = db.prepare('SELECT * FROM victim_requests ORDER BY created_at DESC LIMIT ?').all(limit)
  const now = Date.now()
  const oneHour = 60 * 60 * 1000
  const anomalies = []
  for (const r of rows) {
    let score = 0
    // high frequency from same contact
    if (r.contact) {
      const cnt = db.prepare('SELECT COUNT(*) AS cnt FROM victim_requests WHERE contact = ? AND created_at >= ?').get(r.contact, now - oneHour).cnt || 0
      if (cnt >= 5) score += Math.min(0.5, cnt / 20)
    }
    // location spikes
    const locCnt = db.prepare('SELECT COUNT(*) AS cnt FROM victim_requests WHERE location = ? AND created_at >= ?').get(r.location, now - oneHour).cnt || 0
    if (locCnt >= 3) score += Math.min(0.5, locCnt / 10)
    // OCR/audio mismatch heuristic
    if (r.ocr_text && r.audio_transcript) {
      const sim = jaccardSimilarity(r.ocr_text, r.audio_transcript)
      if (sim < 0.15) score += 0.3
    }
    // if request created very recently and many requests exist nearby, higher score
    if (now - Number(r.created_at) < 5 * 60 * 1000 && locCnt >= 5) score += 0.2
    if (score > 0) anomalies.push({ requestId: r.id, location: r.location, contact: r.contact, score, created_at: r.created_at })
  }
  return anomalies.sort((a,b)=>b.score - a.score)
}
