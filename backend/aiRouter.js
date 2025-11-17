import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Reuse same DB as main backend
const dbPath = path.join(__dirname, 'rescuetech.db')
const db = new Database(dbPath)

const OPENAI_API_KEY = process.env.OPENAI_API_KEY

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

export async function aiRouteRequest({ message, locationText }) {
  const ngos = db.prepare('SELECT id, name, service_type, location FROM ngos').all()

  if (!OPENAI_API_KEY || !ngos.length) {
    const fallback = simpleHeuristicRoute({ message, locationText, ngos })
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
      const fallbackNgo = simpleHeuristicRoute({ message, locationText, ngos }).assignedNgoId
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
    const fallback = simpleHeuristicRoute({ message, locationText, ngos })
    return {
      ...fallback,
      reason: (fallback.reason || '') + ' (AI unavailable, heuristic used instead)',
      usedAi: false,
    }
  }
}

export async function aiIntakeTriage({ text, ocrText, audioTranscript, location }) {
  const ngos = db.prepare('SELECT id, name, service_type, location FROM ngos').all()
  const combined = [text, ocrText, audioTranscript].map(t => (t || '').trim()).filter(Boolean).join('\n').trim()
  const locationText = location?.label || location?.text || ''

  const buildFallback = () => {
    const fallbackText = combined || 'No detailed description provided.'
    const category = simpleCategory(fallbackText)
    const urgency = simpleUrgency(fallbackText)
    const routing = simpleHeuristicRoute({ message: fallbackText, locationText, ngos })
    return {
      summary: fallbackText.slice(0, 400),
      category,
      urgency,
      disasterType: routing.disasterType,
      assignedNgoId: routing.assignedNgoId,
      reason: routing.reason,
      needs: [],
      usedAi: false,
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

    let disasterType = DISASTER_TYPES.includes(parsed.disasterType) ? parsed.disasterType : undefined
    let assignedNgoId = parsed.assignedNgoId ? String(parsed.assignedNgoId) : undefined
    if (!assignedNgoId || !disasterType) {
      const routing = simpleHeuristicRoute({ message: combined, locationText, ngos })
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

function simpleHeuristicRoute({ message, locationText, ngos }) {
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

  const victimLoc = normalize(locationText)

  let best = null
  for (const ngo of ngos) {
    const services = normalize(ngo.service_type || '')
    let serviceScore = 0
    for (const p of preferred) {
      if (services.includes(p)) serviceScore += 1
    }

    const ngoLoc = normalize(ngo.location || '')
    let locationScore = 0
    if (victimLoc && ngoLoc) {
      if (ngoLoc === victimLoc) {
        locationScore = 3
      } else {
        const parts = victimLoc.split(/[\n,]/).map(p => p.trim()).filter(Boolean)
        const matchingPart = parts.find(part => part && ngoLoc.includes(part))
        if (matchingPart) {
          locationScore = 2
        } else if (victimLoc.includes(ngoLoc)) {
          locationScore = 1
        } else {
          locationScore = -0.5
        }
      }
    }

    const totalScore = serviceScore * 10 + locationScore
    if (!best || totalScore > best.totalScore) {
      best = { ngo, totalScore }
    }
  }

  const assignedNgoId = best?.ngo ? String(best.ngo.id) : undefined

  return {
    disasterType,
    assignedNgoId,
    reason: 'Heuristic routing based on keywords and NGO service/location match.',
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

Respond ONLY in JSON with keys: summary, category, urgency, disasterType, assignedNgoId, reason, needs.`

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
