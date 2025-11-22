const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result === 'string') {
        const base64 = result.split(',')[1] || ''
        resolve(base64)
      } else if (result instanceof ArrayBuffer) {
        const bytes = new Uint8Array(result)
        let binary = ''
        bytes.forEach(b => { binary += String.fromCharCode(b) })
        resolve(btoa(binary))
      } else {
        reject(new Error('Unsupported FileReader result'))
      }
    }
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

export async function transcribeAudio(file: File): Promise<string> {
  if (!navigator.onLine) {
    return ''
  }
  try {
    const audioBase64 = await fileToBase64(file)
    const res = await fetch(`${API_BASE}/api/media/audio-transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioBase64, mimeType: file.type || 'audio/webm' }),
    })
    if (!res.ok) {
      console.warn('Audio transcription failed with status', res.status)
      return ''
    }
    const data = await res.json()
    return typeof data.transcript === 'string' ? data.transcript.trim() : ''
  } catch (err) {
    console.error('transcribeAudio failed', err)
    return ''
  }
}
