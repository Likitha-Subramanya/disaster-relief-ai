import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { addVictimRequest, getNgoUsers, VictimRequest } from '../store/rescue'
import { triageLocal } from '../services/localTriage'

export default function AiDemo() {
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [audioUrl, setAudioUrl] = useState<string | undefined>(undefined)
  const [transcript, setTranscript] = useState<string | undefined>(undefined)
  const [recording, setRecording] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recognitionRef = useRef<any>(null)
  const [result, setResult] = useState<{
    request: VictimRequest
    ngoName?: string
    disasterType: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Prepare speech recognition if available
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SR) {
      const rec = new SR()
      rec.continuous = true
      rec.interimResults = true
      rec.lang = 'en-IN'
      rec.onresult = (e: any) => {
        let text = ''
        for (let i = e.resultIndex; i < e.results.length; i++) {
          text += e.results[i][0].transcript
        }
        setTranscript(text.trim())
      }
      recognitionRef.current = rec
    }
  }, [])

  async function handleRun(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setResult(null)
    if (!location.trim()) {
      setError('Please enter location')
      return
    }

    try {
      setLoading(true)
      const triage = await triageLocal({
        text: description.trim(),
        location: { text: location.trim() },
      })

      const rec = await addVictimRequest({
        victimName: name.trim() || 'Anonymous victim',
        contact: phone.trim() || undefined,
        location: location.trim(),
        disasterType: (triage.disasterType as any) || 'other',
        assignedNgoId: undefined,
        audioUrl: audioUrl,
        transcript: transcript?.trim() || undefined,
      })

      const ngos = getNgoUsers()
      const ngoName = rec.assignedNgoId
        ? ngos.find(n => n.id === rec.assignedNgoId)?.name
        : undefined

      setResult({
        request: rec,
        ngoName,
        disasterType: rec.disasterType,
      })
    } catch (err: any) {
      setError(err?.message || 'AI routing failed')
    } finally {
      setLoading(false)
    }
  }

  async function toggleRecording() {
    try {
      if (!recording) {
        // Start recording
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const mr = new MediaRecorder(stream)
        audioChunksRef.current = []
        mr.ondataavailable = ev => {
          if (ev.data && ev.data.size > 0) audioChunksRef.current.push(ev.data)
        }
        mr.onstop = () => {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
          const url = URL.createObjectURL(blob)
          setAudioUrl(url)
        }
        mr.start()
        mediaRecorderRef.current = mr
        setRecording(true)
        if (recognitionRef.current) {
          try { recognitionRef.current.start() } catch {}
        }
      } else {
        // Stop recording
        mediaRecorderRef.current?.stop()
        mediaRecorderRef.current?.stream.getTracks().forEach(t => t.stop())
        mediaRecorderRef.current = null
        setRecording(false)
        if (recognitionRef.current) {
          try { recognitionRef.current.stop() } catch {}
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Microphone access failed')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-secondary/40 to-white text-slate-700 flex items-center justify-center px-4 py-12">
      <div className="bg-white border border-blue-100 rounded-2xl p-6 md:p-8 shadow-card w-full max-w-3xl space-y-4">
        <div className="flex justify-between items-center mb-2">
          <button
            type="button"
            className="text-xs text-slate-500 underline"
          >
            <Link to="/">← Back to home</Link>
          </button>
          <span className="text-[11px] text-slate-400">Demo uses only local AI logic (no backend)</span>
        </div>
        <h1 className="text-2xl font-semibold text-slate-800 text-center">AI Routing Demo</h1>
        <p className="text-sm text-slate-500 text-center">
          Enter a short description and location. The local AI will classify the disaster and
          auto-assign the best NGO based on services and distance.
        </p>

        <form className="space-y-3" onSubmit={handleRun}>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1 text-sm">
              <label className="font-medium">Victim name (optional)</label>
              <input
                className="input"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Name or leave blank"
              />
            </div>
            <div className="space-y-1 text-sm">
              <label className="font-medium">Contact (optional)</label>
              <input
                className="input"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="Phone / email"
              />
            </div>
          </div>

          <div className="space-y-1 text-sm">
            <label className="font-medium">Describe the situation</label>
            <textarea
              className="input min-h-[80px]"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Example: Building collapsed, people trapped, injuries, water rising..."
            />
            <div className="flex items-center gap-2 text-xs">
              <button type="button" className={`px-3 py-1 rounded-full border ${recording ? 'border-danger text-danger' : 'border-blue-100 text-slate-600'}`} onClick={toggleRecording}>
                {recording ? 'Stop voice recording' : 'Record voice instead'}
              </button>
              {audioUrl && (
                <audio controls src={audioUrl} className="h-8">
                  Your browser does not support audio.
                </audio>
              )}
            </div>
            {transcript && (
              <p className="text-[11px] text-slate-500">Transcript: {transcript}</p>
            )}
          </div>

          <div className="space-y-1 text-sm">
            <label className="font-medium">Location</label>
            <input
              className="input"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="Area / city or coordinates like 12.9716, 77.5946"
            />
          </div>

          {error && <div className="text-xs text-danger">{error}</div>}

          <button
            type="submit"
            className="button-primary w-full mt-2 disabled:opacity-70"
            disabled={loading}
          >
            {loading ? 'Running AI…' : 'Run AI routing'}
          </button>
        </form>

        {result && (
          <div className="mt-4 border border-blue-100 rounded-xl p-4 bg-slate-50/70 text-sm space-y-2">
            <p className="text-xs font-semibold tracking-[0.2em] text-slate-400 uppercase">AI decision</p>
            <p><span className="font-medium">Disaster type:</span> {result.disasterType}</p>
            <p>
              <span className="font-medium">Assigned NGO:</span>{' '}
              {result.ngoName || 'No NGO matched (check that NGOs are registered with services & locations).'}
            </p>
            <p className="text-[11px] text-slate-500">
              This request is now stored locally and will also appear in the NGO dashboard for the assigned NGO.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
