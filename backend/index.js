// Express + SQLite backend for RescueTech (moved under backend/)
// Run with: node backend/index.js

import express from 'express'
import cors from 'cors'
import path from 'path'
import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { aiRouteRequest, aiIntakeTriage } from './aiRouter.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Database will now live under backend/rescuetech.db
const dbPath = path.join(__dirname, 'rescuetech.db')
const db = new Database(dbPath)

// ---- Migrations ----

db.exec(`
CREATE TABLE IF NOT EXISTS victims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  city TEXT NOT NULL,
  address TEXT NOT NULL,
  contact TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ngos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  location TEXT NOT NULL,
  service_type TEXT NOT NULL,
  branches_json TEXT,
  theme TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS victim_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  victim_id INTEGER,
  victim_name TEXT NOT NULL,
  contact TEXT,
  location TEXT NOT NULL,
  disaster_type TEXT NOT NULL,
  status TEXT NOT NULL,
  assigned_ngo_id INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (victim_id) REFERENCES victims(id),
  FOREIGN KEY (assigned_ngo_id) REFERENCES ngos(id)
);
`)

// ---- App setup ----

const app = express()
app.use(cors())
app.use(express.json())

// Very basic hashing placeholder (for demo only).
// In a real system, use bcrypt.
function hashPassword(pw) {
  return `plain:${pw}`
}

// ---- Victim endpoints ----

app.post('/api/victims/register', (req, res) => {
  const { name, email, password, city, address, contact } = req.body || {}
  if (!name || !email || !password || !city || !address || !contact) {
    return res.status(400).json({ ok: false, error: 'Missing required fields' })
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO victims (name, email, password_hash, city, address, contact, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    const result = stmt.run(name, email.toLowerCase(), hashPassword(password), city, address, contact, Date.now())
    return res.json({ ok: true, id: result.lastInsertRowid })
  } catch (err) {
    if (String(err).includes('UNIQUE')) {
      return res.status(409).json({ ok: false, error: 'Victim already registered with this email' })
    }
    console.error(err)
    return res.status(500).json({ ok: false, error: 'Server error' })
  }
})

app.post('/api/victims/login', (req, res) => {
  const { email, password } = req.body || {}
  if (!email || !password) {
    return res.status(400).json({ ok: false, error: 'Email and password are required' })
  }

  const stmt = db.prepare('SELECT * FROM victims WHERE email = ?')
  const row = stmt.get(email.toLowerCase())
  if (!row || row.password_hash !== hashPassword(password)) {
    return res.status(401).json({ ok: false, error: 'Invalid email or password' })
  }

  return res.json({
    ok: true,
    victim: {
      id: row.id,
      name: row.name,
      email: row.email,
      city: row.city,
      address: row.address,
      contact: row.contact,
    },
  })
})

// ---- NGO endpoints ----

app.post('/api/ngos/register', (req, res) => {
  const { name, email, password, phone, address, location, serviceType, branches, theme } = req.body || {}
  if (!name || !email || !password || !phone || !address || !location || !serviceType) {
    return res.status(400).json({ ok: false, error: 'Missing required fields' })
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO ngos (name, email, password_hash, phone, address, location, service_type, branches_json, theme, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const result = stmt.run(
      name,
      email.toLowerCase(),
      hashPassword(password),
      phone,
      address,
      location,
      serviceType,
      branches ? JSON.stringify(branches) : null,
      theme || null,
      Date.now()
    )
    return res.json({ ok: true, id: result.lastInsertRowid })
  } catch (err) {
    if (String(err).includes('UNIQUE')) {
      return res.status(409).json({ ok: false, error: 'NGO already registered with this email' })
    }
    console.error(err)
    return res.status(500).json({ ok: false, error: 'Server error' })
  }
})

app.post('/api/ngos/login', (req, res) => {
  const { email, password } = req.body || {}
  if (!email || !password) {
    return res.status(400).json({ ok: false, error: 'Email and password are required' })
  }

  const stmt = db.prepare('SELECT * FROM ngos WHERE email = ?')
  const row = stmt.get(email.toLowerCase())
  if (!row || row.password_hash !== hashPassword(password)) {
    return res.status(401).json({ ok: false, error: 'Invalid email or password' })
  }

  return res.json({
    ok: true,
    ngo: {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      address: row.address,
      location: row.location,
      serviceType: row.service_type,
      branches: row.branches_json ? JSON.parse(row.branches_json) : [],
      theme: row.theme || 'dark',
    },
  })
})

// ---- Admin endpoints ----

app.post('/api/admins/register', (req, res) => {
  const { name, email, password } = req.body || {}
  if (!name || !email || !password) {
    return res.status(400).json({ ok: false, error: 'Missing required fields' })
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO admins (name, email, password_hash, created_at)
      VALUES (?, ?, ?, ?)
    `)
    const result = stmt.run(name, email.toLowerCase(), hashPassword(password), Date.now())
    return res.json({ ok: true, id: result.lastInsertRowid })
  } catch (err) {
    if (String(err).includes('UNIQUE')) {
      return res.status(409).json({ ok: false, error: 'Admin already registered with this email' })
    }
    console.error(err)
    return res.status(500).json({ ok: false, error: 'Server error' })
  }
})

app.post('/api/admins/login', (req, res) => {
  const { email, password } = req.body || {}
  if (!email || !password) {
    return res.status(400).json({ ok: false, error: 'Email and password are required' })
  }

  const stmt = db.prepare('SELECT * FROM admins WHERE email = ?')
  const row = stmt.get(email.toLowerCase())
  if (!row || row.password_hash !== hashPassword(password)) {
    return res.status(401).json({ ok: false, error: 'Invalid email or password' })
  }

  return res.json({
    ok: true,
    admin: {
      id: row.id,
      name: row.name,
      email: row.email,
    },
  })
})

// ---- AI routing endpoints ----

app.post('/api/ai/route-request', async (req, res) => {
  const { message, locationText } = req.body || {}
  if (!message || !locationText) {
    return res.status(400).json({ ok: false, error: 'message and locationText are required' })
  }

  try {
    const result = await aiRouteRequest({ message, locationText })
    return res.json({ ok: true, ...result })
  } catch (err) {
    console.error('AI routing failed', err)
    return res.status(500).json({ ok: false, error: 'AI routing failed' })
  }
})

app.post('/api/ai/intake', async (req, res) => {
  const { text, ocrText, audioTranscript, location } = req.body || {}
  if (!text && !ocrText && !audioTranscript) {
    return res.status(400).json({ ok: false, error: 'At least one of text, ocrText, or audioTranscript is required' })
  }

  try {
    const result = await aiIntakeTriage({ text, ocrText, audioTranscript, location })
    return res.json({ ok: true, ...result })
  } catch (err) {
    console.error('AI intake triage failed', err)
    return res.status(500).json({ ok: false, error: 'AI intake triage failed' })
  }
})

// ---- Victim request endpoints ----

app.post('/api/requests', (req, res) => {
  const {
    victimId,
    victimName,
    contact,
    location,
    disasterType,
    status = 'to_do',
    assignedNgoId = null,
  } = req.body || {}

  if (!victimName || !location || !disasterType) {
    return res.status(400).json({ ok: false, error: 'Missing required fields' })
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO victim_requests (victim_id, victim_name, contact, location, disaster_type, status, assigned_ngo_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const result = stmt.run(
      victimId || null,
      victimName,
      contact || null,
      location,
      disasterType,
      status,
      assignedNgoId || null,
      Date.now()
    )
    return res.json({ ok: true, id: result.lastInsertRowid })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ ok: false, error: 'Server error' })
  }
})

app.get('/api/requests', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM victim_requests ORDER BY created_at DESC').all()
    return res.json({ ok: true, requests: rows })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ ok: false, error: 'Server error' })
  }
})

app.patch('/api/requests/:id/status', (req, res) => {
  const { id } = req.params
  const { status } = req.body || {}
  if (!status) return res.status(400).json({ ok: false, error: 'Status required' })

  try {
    const stmt = db.prepare('UPDATE victim_requests SET status = ? WHERE id = ?')
    stmt.run(status, id)
    return res.json({ ok: true })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ ok: false, error: 'Server error' })
  }
})

app.patch('/api/requests/:id/assign', (req, res) => {
  const { id } = req.params
  const { ngoId } = req.body || {}

  try {
    const stmt = db.prepare('UPDATE victim_requests SET assigned_ngo_id = ? WHERE id = ?')
    stmt.run(ngoId || null, id)
    return res.json({ ok: true })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ ok: false, error: 'Server error' })
  }
})

// ---- NGOs listing for admin ----

app.get('/api/ngos', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM ngos ORDER BY created_at DESC').all()
    return res.json({ ok: true, ngos: rows })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ ok: false, error: 'Server error' })
  }
})

app.delete('/api/ngos/:id', (req, res) => {
  const { id } = req.params
  try {
    const stmt = db.prepare('DELETE FROM ngos WHERE id = ?')
    stmt.run(id)
    return res.json({ ok: true })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ ok: false, error: 'Server error' })
  }
})

// ---- Transcription endpoint (multilingual voice-to-text) ----
// Accepts JSON { audioBase64: string } where audioBase64 is a base64-encoded audio file (webm/ogg/wav)
app.post('/api/transcribe', express.json({ limit: '25mb' }), async (req, res) => {
  const { audioBase64 } = req.body || {}
  if (!audioBase64) return res.status(400).json({ ok: false, error: 'No audio provided' })
  const OPENAI_KEY = process.env.OPENAI_API_KEY
  if (!OPENAI_KEY) return res.status(400).json({ ok: false, error: 'Transcription not configured on server (OPENAI_API_KEY missing)' })

  try {
    const buffer = Buffer.from(audioBase64, 'base64')
    // Use WHATWG FormData + Blob (Node 18+). Create a Blob from the buffer and send to OpenAI Whisper endpoint.
    const form = new FormData()
    const blob = new Blob([buffer], { type: 'audio/webm' })
    form.append('file', blob, 'audio.webm')
    form.append('model', 'whisper-1')

    const openaiRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_KEY}` },
      body: form,
    })
    const j = await openaiRes.json()
    if (!openaiRes.ok) {
      console.error('OpenAI transcription error', j)
      return res.status(500).json({ ok: false, error: 'Transcription provider error', raw: j })
    }
    // OpenAI returns { text: '...' }
    return res.json({ ok: true, transcript: j.text ?? j.transcript ?? null, raw: j })
  } catch (err) {
    console.error('Transcription failed', err)
    return res.status(500).json({ ok: false, error: 'Transcription failed' })
  }
})

const PORT = process.env.PORT || 4000
app.listen(PORT, () => {
  console.log(`RescueTech API running on http://localhost:${PORT}`)
})
