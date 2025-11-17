import { Mic, Send, Camera, FileText, ShieldAlert } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import LocationInput, { LocationValue } from '../components/LocationInput'
import { ocrImage } from '../services/ocr'
import { classifyCategory, estimateUrgency } from '../services/nlp'
import { putRequest, getResources, putMatch, addStatus, getStatus } from '../store/db'
import MapView from '../components/MapView'
import { matchResources } from '../services/matching'
import type { Category, Resource, StatusEvent } from '../models'
import { notifyVolunteerMatched } from '../services/notify'
import { syncRequestsWithServer } from '../services/sync'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'

type IntakeResult = {
  summary?: string
  category: Category
  urgency: number
  needs?: string[]
  matched?: { id: string; type: string; distanceKm: number }
  assignedNgoId?: string
  aiReason?: string
  usedAi?: boolean
}

type AiPanelState = {
  summary?: string
  category?: string
  urgency?: number
  assignedNgoId?: string
  disasterType?: string
  needs?: string[]
  reason?: string
  usedAi?: boolean
  error?: string
}

export default function VictimIntake() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState({ name: '', phone: '', text: '' })
  const [ocrText, setOcrText] = useState('')
  const [loc, setLoc] = useState<LocationValue | undefined>(undefined)
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<any>(null)
  const [refreshSignal, setRefreshSignal] = useState(0)
  const [result, setResult] = useState<IntakeResult | null>(null)
  const [resources, setResources] = useState<Resource[]>([])
  const [lastRequestId, setLastRequestId] = useState<string | null>(null)
  const [timeline, setTimeline] = useState<StatusEvent[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [aiPanel, setAiPanel] = useState<AiPanelState | null>(null)
  const [aiPanelOpen, setAiPanelOpen] = useState(false)

  const mode = searchParams.get('mode') as 'photo' | 'voice' | 'text' | null

  useEffect(()=>{
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SR) {
      const rec = new SR()
      rec.continuous = true
      rec.interimResults = false
      rec.onresult = (e: any) => {
        const transcript = Array.from(e.results).map((r:any)=> r[0].transcript).join(' ')
        setForm(prev=> ({...prev, text: `${prev.text} ${transcript}`.trim()}))
      }
      rec.onend = ()=> setListening(false)
      recognitionRef.current = rec
    }
  }, [])

  useEffect(()=>{ (async()=>{ setResources(await getResources()) })() }, [refreshSignal])

  useEffect(()=>{ if (!lastRequestId) return; (async()=>{ setTimeline(await getStatus(lastRequestId)) })() }, [lastRequestId, refreshSignal])

  async function handleImageChange(file?: File) {
    if (!file) return
    const text = await ocrImage(file)
    setOcrText(text)
    setForm(f=> ({...f, text: f.text ? f.text + '\n' + text : text }))
  }
  function toggleVoice() {
    const rec = recognitionRef.current
    if (!rec) { alert('Voice recognition not supported on this browser.'); return }
    if (listening) { rec.stop(); setListening(false) } else { rec.start(); setListening(true) }
  }

  const offline = !navigator.onLine

  return (
    <div className="container py-8 md:py-10 space-y-6">
      {/* Step 1: confirmation banner */}
      <div className="card p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-red-900/20 border-red-500/40">
        <div className="flex items-start gap-3">
          <div className="mt-1">
            <ShieldAlert className="w-5 h-5 text-red-300" />
          </div>
          <div>
            <div className="text-sm font-semibold">Are you in danger?</div>
            <div className="text-xs opacity-80">This will create an emergency request with your location and details.</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="px-3 py-2 rounded-lg border border-white/15 text-xs hover:bg-white/5"
            onClick={()=> navigate('/')}
          >
            Cancel
          </button>
          <button
            type="button"
            className="button-primary text-xs"
            onClick={()=> setConfirmed(true)}
          >
            YES, SEND HELP
          </button>
        </div>
      </div>

      {/* Step 2+3 layout */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Left: Capture tiles + form */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between mb-1">
            <div className="text-sm font-semibold">Emergency details</div>
            <div className="text-[11px] opacity-70">Choose how to describe what is happening</div>
          </div>

          {/* Capture tiles */}
          <div className="grid grid-cols-3 gap-3 text-xs">
            <label className={`card p-3 flex flex-col items-center gap-2 hover:bg-white/5 cursor-pointer ${mode === 'photo' ? 'ring-1 ring-red-400' : ''}`}>
              <Camera className="w-5 h-5 text-red-300" />
              <span className="font-medium">Photo</span>
              <input type="file" accept="image/*" className="hidden" onChange={e=>handleImageChange(e.target.files?.[0])} />
            </label>
            <button
              type="button"
              className={`card p-3 flex flex-col items-center gap-2 hover:bg-white/5 ${mode === 'voice' ? 'ring-1 ring-amber-300' : ''}`}
              onClick={toggleVoice}
            >
              <Mic className="w-5 h-5 text-amber-300" />
              <span className="font-medium">Voice</span>
              <span className="text-[11px] opacity-70">{listening ? 'Listening… tap to stop' : 'Tap to speak'}</span>
            </button>
            <button
              type="button"
              className={`card p-3 flex flex-col items-center gap-2 hover:bg-white/5 ${mode === 'text' ? 'ring-1 ring-sky-300' : ''}`}
              onClick={()=> {}}
            >
              <FileText className="w-5 h-5 text-sky-300" />
              <span className="font-medium">Text</span>
              <span className="text-[11px] opacity-70">Use the form below</span>
            </button>
          </div>

          <form className="grid gap-4" onSubmit={async (e)=>{
            e.preventDefault()
            setError(null)
            if (!loc) { setError('Please select location'); return }
            if (!form.text.trim() && !ocrText.trim()) { setError('Please describe the situation'); return }
            setSubmitting(true)
            try {
              const combinedText = [form.text, ocrText].map(t => t.trim()).filter(Boolean).join('\n').trim()
              const fallbackCategory = classifyCategory(combinedText)
              const fallbackUrgency = estimateUrgency(combinedText)

              let aiCategory: Category = fallbackCategory
              let aiUrgency = fallbackUrgency
              let aiSummary = combinedText.slice(0, 180)
              let aiNeeds: string[] = []
              let aiAssignedNgoId: string | undefined = undefined
              let aiReason: string | undefined = undefined
              let aiDisasterType: string | undefined = undefined
              let aiUsedModel = false
              let aiError: string | undefined = undefined

              if (navigator.onLine) {
                try {
                  const aiRes = await fetch(`${API_BASE}/api/ai/intake`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      text: form.text.trim() || undefined,
                      ocrText: ocrText || undefined,
                      audioTranscript: undefined,
                      location: loc ? { lat: loc.lat, lng: loc.lng, label: loc.label } : undefined,
                    }),
                  })
                  if (aiRes.ok) {
                    const aiData = await aiRes.json()
                    if (aiData.ok) {
                      if (aiData.category && ['medical','rescue','shelter','supplies','unknown'].includes(aiData.category)) {
                        aiCategory = aiData.category as Category
                      }
                      if (typeof aiData.urgency === 'number') {
                        aiUrgency = Math.max(1, Math.min(5, Math.round(aiData.urgency)))
                      }
                      aiSummary = typeof aiData.summary === 'string' && aiData.summary.trim() ? aiData.summary.trim() : aiSummary
                      aiNeeds = Array.isArray(aiData.needs) ? aiData.needs : aiNeeds
                      aiAssignedNgoId = aiData.assignedNgoId ? String(aiData.assignedNgoId) : undefined
                      aiReason = aiData.reason || aiReason
                      aiDisasterType = aiData.disasterType || aiDisasterType
                      aiUsedModel = Boolean(aiData.usedAi)
                    } else {
                      aiError = aiData.error || 'AI triage failed'
                    }
                  } else {
                    aiError = `AI triage failed (${aiRes.status})`
                  }
                } catch (err) {
                  aiError = 'AI triage request failed. Using fallback classification.'
                }
              }

              const id = String(Date.now())
              await putRequest({
                id,
                reporterUserId: undefined,
                source: 'app',
                text: combinedText,
                imageUrl: undefined,
                audioUrl: undefined,
                ocrText: ocrText || undefined,
                detectedLang: undefined,
                category: aiCategory,
                urgency: aiUrgency,
                location: { lat: loc.lat, lng: loc.lng },
                locationLabel: loc.label,
                status: 'new',
                createdAt: Date.now(),
                aiSummary,
                aiNeeds,
                aiReason,
                aiUsedModel,
                aiDisasterType,
                aiAssignedNgoId,
                synced: false,
                victimName: form.name || undefined,
                contact: form.phone || undefined,
              })
              await addStatus({ id: 'se_'+Date.now(), entityType: 'request', entityId: id, status: 'new', timestamp: Date.now(), note: 'Request submitted' })
              // Auto-match with nearby resources
              const resList = await getResources()
              const top = matchResources({ id, reporterUserId: undefined, source: 'app', text: combinedText, imageUrl: undefined, audioUrl: undefined, ocrText: ocrText || undefined, detectedLang: undefined, category: aiCategory, urgency: aiUrgency, location: { lat: loc.lat, lng: loc.lng }, status: 'new', createdAt: Date.now() }, resList, 1)
              if (top[0]) {
                const mId = 'm_'+Date.now()
                await putMatch({ id: mId, requestId: id, resourceId: top[0].r.id, score: top[0].score, distanceKm: top[0].distanceKm, status: 'proposed' })
                await addStatus({ id: 'se_'+(Date.now()+1), entityType: 'match', entityId: mId, status: 'proposed', timestamp: Date.now(), note: `Proposed to resource ${top[0].r.id}` })
                notifyVolunteerMatched({ requestId: id, resourceId: top[0].r.id, victimPhone: form.phone })
                setResult({
                  summary: aiSummary,
                  category: aiCategory,
                  urgency: aiUrgency,
                  needs: aiNeeds,
                  matched: { id: top[0].r.id, type: top[0].r.type, distanceKm: Number(top[0].distanceKm.toFixed(2)) },
                  assignedNgoId: aiAssignedNgoId,
                  aiReason,
                  usedAi: aiUsedModel,
                })
              } else {
                setResult({
                  summary: aiSummary,
                  category: aiCategory,
                  urgency: aiUrgency,
                  needs: aiNeeds,
                  assignedNgoId: aiAssignedNgoId,
                  aiReason,
                  usedAi: aiUsedModel,
                })
              }
              setRefreshSignal(s=> s+1)
              setLastRequestId(id)
              if (navigator.onLine) {
                syncRequestsWithServer()
              }
              setAiPanel({
                summary: aiSummary,
                category: aiCategory,
                urgency: aiUrgency,
                assignedNgoId: aiAssignedNgoId,
                disasterType: aiDisasterType,
                needs: aiNeeds,
                reason: aiReason,
                usedAi: aiUsedModel,
                error: aiError,
              })
              setAiPanelOpen(true)
              // stay on page and show confirmation
              setForm({ name: '', phone: '', text: '' })
              setOcrText('')
            } catch (err:any) {
              console.error('Submit failed', err)
              setError(err?.message || 'Submission failed. Please try again.')
            } finally {
              setSubmitting(false)
            }
          }}>
            <input className="input" placeholder="Your Name" value={form.name} onChange={e=>setForm({...form, name: e.target.value})} />
            <input className="input" placeholder="Phone" value={form.phone} onChange={e=>setForm({...form, phone: e.target.value})} />
            <LocationInput value={loc} onChange={setLoc} />
            <textarea className="input min-h-[140px]" placeholder="Describe the situation and needs" value={form.text} onChange={e=>setForm({...form, text: e.target.value})} />
            {ocrText && <div className="text-xs opacity-70">OCR: {ocrText.slice(0,120)}{ocrText.length>120?'…':''}</div>}
            {error && <div className="text-sm text-danger">{error}</div>}
            <button className="button-primary self-start" type="submit" disabled={submitting || !confirmed}>
              <Send className="w-4 h-4" /> {submitting ? 'Sending…' : confirmed ? 'Send Request' : 'Confirm first above'}
            </button>
          </form>
        </div>
        {/* Right: Summary, AI info, timeline, nearby resources */}
        <div className="space-y-4">
          <div className="card p-6 text-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">Summary & AI triage</div>
              <span className="text-[11px] opacity-70">Auto-updated after you send</span>
            </div>
            {result ? (
              <div className="space-y-2">
                {result.summary && (
                  <div className="text-sm opacity-90">{result.summary}</div>
                )}
                <div className="text-xs opacity-80">
                  Category: <span className="font-semibold">{result.category}</span> · Urgency: <span className="font-semibold">{result.urgency}</span>
                </div>
                {result.needs && result.needs.length > 0 && (
                  <div className="text-xs">
                    Needs: <span className="opacity-80">{result.needs.join(', ')}</span>
                  </div>
                )}
                {result.assignedNgoId && (
                  <div className="text-xs">
                    AI priority NGO: <span className="font-semibold">{result.assignedNgoId}</span>
                  </div>
                )}
                {result.aiReason && (
                  <div className="text-[11px] opacity-70">Reason: {result.aiReason}</div>
                )}
                {result.usedAi === false && (
                  <div className="text-[11px] text-amber-500">AI unavailable, used local heuristic.</div>
                )}
                {result.matched ? (
                  <div className="mt-1">
                    Matched resource: <span className="font-medium">{result.matched.type}</span> ({result.matched.distanceKm} km)
                    <div className="mt-2">
                      <a
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5"
                        target="_blank"
                        rel="noreferrer"
                        href={`https://www.google.com/maps/dir/?api=1&destination=${loc?.lat},${loc?.lng}`}
                      >
                        Open route in Google Maps
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="mt-1 opacity-80">No nearby resources registered yet.</div>
                )}
              </div>
            ) : (
              <div className="text-xs opacity-70">After you submit, we will show AI-estimated category, urgency, and any matches here.</div>
            )}
            <div className="mt-4 text-xs opacity-80">
              {offline ? 'You appear to be offline. Your request will be saved locally and can be sent or encoded into SMS when network returns.' : 'You appear online. Your request will be sent immediately to the coordination system.'}
            </div>
          </div>

          <div className="card p-6 text-xs">
            <div className="font-semibold mb-2">Status timeline</div>
            {lastRequestId && timeline.length > 0 ? (
              <ul className="ml-4 list-disc opacity-80">
                {timeline.map(ev=> (
                  <li key={ev.id}>{new Date(ev.timestamp).toLocaleString()} · {ev.status}{ev.note? ` — ${ev.note}`:''}</li>
                ))}
              </ul>
            ) : (
              <div className="opacity-70">After you submit, you will see the history of this request here.</div>
            )}
          </div>

          <div className="card p-6">
            <div className="text-sm font-semibold">Nearby registered resources</div>
            <div className="mt-3">
              <MapView refreshSignal={refreshSignal} />
            </div>
            <div className="mt-4">
              <div className="font-semibold mb-2 text-xs">All volunteers/providers</div>
              <div className="space-y-2 text-xs max-h-40 overflow-auto pr-1">
                {resources.map(r=> (
                  <div key={r.id} className="p-2 rounded border border-white/10">
                    <div className="font-medium text-sm">{r.type}</div>
                    <div className="opacity-80">Tags: {r.capabilityTags.join(', ') || '—'}</div>
                    <div className="opacity-80">Qty: {r.quantity} · {r.availabilityStatus}</div>
                  </div>
                ))}
                {resources.length===0 && <div className="text-xs opacity-70">No providers yet.</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
