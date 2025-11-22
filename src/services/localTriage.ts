type LocalTriageInput = {
  text?: string
  ocrText?: string
  audioTranscript?: string
  photos?: string[]
  location?: { label?: string; text?: string }
}

import localLlmAdapter from './localLlmAdapter'

export async function triageLocal({ text, ocrText, audioTranscript, photos, location }: LocalTriageInput) {
  const combined = [text, ocrText, audioTranscript].map(t => (t || '').trim()).filter(Boolean).join('\n').trim()

  function simpleCategoryLocal(txt: string) {
    const c = (txt || '').toLowerCase()
    if (/injury|bleed|unconscious|ambulance|fracture/.test(c)) return 'medical'
    if (/trapped|collapse|buried|stuck|rescue/.test(c)) return 'rescue'
    if (/shelter|homeless|evacuat|camp|tent/.test(c)) return 'shelter'
    if (/food|water|blanket|ration/.test(c)) return 'supplies'
    return 'unknown'
  }

  function simpleUrgencyLocal(txt: string) {
    const c = (txt || '').toLowerCase()
    let urgency = 2
    if (/(immediate|urgent|help now|bleeding|unconscious|trapped)/.test(c)) urgency = 5
    else if (/(serious|severe|critical)/.test(c)) urgency = 4
    return Math.max(1, Math.min(5, urgency))
  }

  function detectPeopleCount(txt: string) {
    const match = (txt || '').match(/(\d+)\s*(people|persons|victims|children|adults)/i)
    if (match) return Number(match[1])
    if (/(family of|we are|we need)/i.test(txt)) return 2
    return 1
  }

  function detectSeveritySignals(txt: string) {
    const c = (txt || '').toLowerCase()
    let level = 2
    const reasons: string[] = []
    if (/(critical|life threatening|unconscious|cardiac|major bleed)/.test(c)) {
      level = 5
      reasons.push('Critical medical keywords detected')
    }
    if (/(urgent|immediate help|emergency)/.test(c)) {
      level = Math.max(level, 4)
      reasons.push('Urgency keywords present')
    }
    if (/(trapped|stuck|buried|collapsed)/.test(c)) {
      level = Math.max(level, 4)
      reasons.push('Possible entrapment')
    }
    const special: string[] = []
    if (/(child|children|baby|infant)/.test(c)) special.push('children')
    if (/(elderly|old person|senior)/.test(c)) special.push('elderly')
    if (/(pregnant)/.test(c)) special.push('pregnant')
    if (/(disabled|wheelchair|paralyzed)/.test(c)) special.push('disabled')
    if (/(blocked road|road blocked|no access)/.test(c)) special.push('access_blocked')
    if (/(gas leak|chemical|hazardous|toxic)/.test(c)) special.push('hazardous_materials')

    const trapped = /(trapped|stuck|buried|collapsed)/.test(c)
    const injured = /(injured|injury|bleeding|fracture|burn|wound)/.test(c)

    const uncertainties: string[] = []
    if (!txt || txt.length < 40) uncertainties.push('Short/local triage description')

    return {
      severityLevel: Math.max(1, Math.min(5, level)),
      severityLabel: level >= 5 ? 'critical' : level >= 4 ? 'high' : level >= 3 ? 'elevated' : 'moderate',
      severityReason: reasons.join('; ') || 'Local heuristic severity estimate',
      trapped,
      injured,
      specialConstraints: special,
      uncertaintyReasons: uncertainties,
    }
  }

  // If a local LLM adapter is registered, use it for a stronger local triage
  if (localLlmAdapter.isAvailable()) {
    try {
      const llmRes = await localLlmAdapter.triage({ text, ocrText, audioTranscript, photos, location })
      if (llmRes && llmRes.summary) {
        return { ...llmRes, usedAi: true, confidence: llmRes.confidence ?? 0.6, reason: 'local-llm' }
      }
    } catch (err) {
      // fall through to heuristics
      console.warn('local LLM triage failed', err)
    }
  }

  const summary = combined ? combined.slice(0, 400) : 'No detailed description provided.'
  const category = simpleCategoryLocal(combined)
  const urgency = simpleUrgencyLocal(combined)
  const disasterType = (function () {
    const c = (combined || '').toLowerCase()
    // Natural disasters
    if (/(earthquake|tremor|seismic)/.test(c)) return 'earthquake'
    if (/(flood|inundat|water level|waterlogging|water logging|rain water)/.test(c)) return 'flood'
    if (/(tsunami)/.test(c)) return 'tsunami'
    if (/(landslide|mudslide)/.test(c)) return 'landslide'
    if (/(cyclone|hurricane|storm|strong winds|gale)/.test(c)) return 'cyclone'

    // Fire and explosions / electrical
    if (/(fire|burning|flames|blaze)/.test(c)) return 'fire'
    if (/(explosion|blast|explode)/.test(c)) return 'industrial_accident'
    if (/(short circuit|electrical short|sparks from wire)/.test(c)) return 'industrial_accident'

    // Chemical / gas
    if (/(chemical|gas leak|hazardous material|toxic fumes|smoke.*toxic)/.test(c)) return 'chemical_leak'

    // Building / structure
    if (/(building collapse|collapsed building|structure collapse|wall collapse|partial collapse|structural crack|ceiling fell|roof collapse)/.test(c)) return 'building_collapse'
    if (/(lift|elevator).*emergency/.test(c)) return 'medical_emergency'
    if (/(person trapped|trapped under|under debris)/.test(c)) return 'building_collapse'

    // Accidents
    if (/(road accident|car crash|vehicle collision|hit and run|bike accident)/.test(c)) return 'transport_accident'
    if (/(train accident|rail accident|derail)/.test(c)) return 'transport_accident'
    if (/(bus accident|bus crash)/.test(c)) return 'transport_accident'

    // Public safety / crowd
    if (/(stampede|large crowd risk|crowd panic)/.test(c)) return 'conflict_violence'
    if (/(violence|mob|riot|clashes)/.test(c)) return 'conflict_violence'

    // Medical catch-alls
    if (/(medical emergency|unconscious|heart attack|breathing difficulty|severe injury|bleeding)/.test(c)) return 'medical_emergency'

    // Default
    return 'other'
  })()

  const peopleAffected = detectPeopleCount(combined)
  const signals = detectSeveritySignals(combined)

  // lightweight needs extraction
  const needs: string[] = []
  if (/ambulance|doctor|medic/.test(combined)) needs.push('medical')
  if (/rescue|trapped|collapsed/.test(combined)) needs.push('rescue')
  if (/shelter|evacuate/.test(combined)) needs.push('shelter')
  if (/food|water|blanket/.test(combined)) needs.push('supplies')
  if (!needs.length) needs.push(category === 'unknown' ? 'general_support' : category)

  return {
    summary,
    category,
    urgency,
    disasterType,
    needs,
    peopleAffected,
    trapped: signals.trapped,
    injured: signals.injured,
    specialConstraints: signals.specialConstraints,
    severityLevel: signals.severityLevel,
    severityLabel: signals.severityLabel,
    reason: 'local-heuristic',
    severityReason: signals.severityReason,
    uncertaintyReasons: signals.uncertaintyReasons,
    usedAi: false,
    confidence: 0.35,
  }
}

export default triageLocal
