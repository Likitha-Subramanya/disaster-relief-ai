import express from 'express'
import cors from 'cors'
import multer from 'multer'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import sqlite3 from 'sqlite3'
import path from 'path'
import fs from 'fs'

const PORT = process.env.PORT || 4000
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'
const upload = multer({ dest: path.join(process.cwd(), 'server', 'uploads') })

// Ensure uploads folder exists
fs.mkdirSync(path.join(process.cwd(), 'server', 'uploads'), { recursive: true })

// SQLite setup
sqlite3.verbose()
const dbPath = path.join(process.cwd(), 'server', 'data.db')
const db = new sqlite3.Database(dbPath)

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err)
      resolve(this)
    })
  })
}
function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err)
      resolve(rows)
    })
  })
}
function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err)
      resolve(row)
    })
  })
}

async function init() {
  await run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL,
    name TEXT,
    email TEXT UNIQUE,
    phone TEXT,
    pass_hash TEXT,
    created_at INTEGER
  )`)

  await run(`CREATE TABLE IF NOT EXISTS ngos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    location TEXT,
    serviceType TEXT
  )`)

  await run(`CREATE TABLE IF NOT EXISTS victim_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id TEXT UNIQUE,
    victim_name TEXT,
    contact TEXT,
    location TEXT,
    disaster_type TEXT,
    created_at INTEGER,
    status TEXT,
    assigned_ngo_id INTEGER,
    audio_present INTEGER DEFAULT 0
  )`)

  await run(`CREATE TABLE IF NOT EXISTS reset_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    token TEXT UNIQUE,
    expires_at INTEGER,
    used_at INTEGER,
    method TEXT,
    meta TEXT
  )`)
}

const app = express()
app.use(cors())
app.use(express.json({ limit: '2mb' }))

// Auth: register NGO/Admin/Victim (simple)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { role, name, email, phone, password } = req.body || {}
    if (!role || !email || !password) return res.status(400).json({ error: 'Missing fields' })
    const hash = await bcrypt.hash(password, 10)
    await run(
      `INSERT INTO users(role, name, email, phone, pass_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [role, name || '', email.toLowerCase(), phone || '', hash, Date.now()]
    )
    res.json({ ok: true })
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) })
  }
})

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {}
    const user = await get(`SELECT * FROM users WHERE email = ?`, [String(email || '').toLowerCase()])
    if (!user) return res.status(401).json({ error: 'Invalid credentials' })
    const ok = await bcrypt.compare(String(password || ''), user.pass_hash || '')
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' })
    const token = jwt.sign({ uid: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' })
    res.json({ token, role: user.role, name: user.name })
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) })
  }
})

// Password reset: email-style tokens (stub sender)
app.post('/api/auth/reset/request', async (req, res) => {
  try {
    const { email } = req.body || {}
    const user = await get(`SELECT * FROM users WHERE email = ?`, [String(email || '').toLowerCase()])
    if (!user) return res.json({ ok: true }) // do not reveal existence
    const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
    const expires = Date.now() + 15 * 60 * 1000
    await run(
      `INSERT INTO reset_tokens(user_id, token, expires_at, method, meta) VALUES (?, ?, ?, ?, ?)`,
      [user.id, token, expires, 'email', 'console']
    )
    console.log(`[RESET] Send this token to user via email: ${token}`)
    res.json({ ok: true })
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) })
  }
})

app.post('/api/auth/reset/verify', async (req, res) => {
  try {
    const { token, newPassword } = req.body || {}
    const row = await get(`SELECT * FROM reset_tokens WHERE token = ?`, [String(token || '')])
    if (!row || row.used_at) return res.status(400).json({ error: 'Invalid token' })
    if (Date.now() > Number(row.expires_at)) return res.status(400).json({ error: 'Token expired' })
    const hash = await bcrypt.hash(String(newPassword || ''), 10)
    await run(`UPDATE users SET pass_hash = ? WHERE id = ?`, [hash, row.user_id])
    await run(`UPDATE reset_tokens SET used_at = ? WHERE id = ?`, [Date.now(), row.id])
    res.json({ ok: true })
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) })
  }
})

// NGOs
app.get('/api/ngos', async (req, res) => {
  try {
    const rows = await all(`SELECT * FROM ngos ORDER BY id DESC`)
    res.json({ ngos: rows })
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) })
  }
})

app.post('/api/ngos', async (req, res) => {
  try {
    const { name, email, phone, address, location, serviceType } = req.body || {}
    await run(
      `INSERT INTO ngos(name, email, phone, address, location, serviceType) VALUES (?, ?, ?, ?, ?, ?)`,
      [name || '', email || '', phone || '', address || '', location || '', serviceType || '']
    )
    const row = await get(`SELECT * FROM ngos ORDER BY id DESC LIMIT 1`)
    res.json({ ngo: row })
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) })
  }
})

// Victim requests
app.get('/api/requests', async (req, res) => {
  try {
    const rows = await all(`SELECT * FROM victim_requests ORDER BY id DESC`)
    res.json({ requests: rows })
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) })
  }
})

app.post('/api/requests', async (req, res) => {
  try {
    const { clientId, victimName, contact, location, disasterType, status, assignedNgoId, createdAt } = req.body || {}

    // idempotent by clientId
    if (clientId) {
      const exists = await get(`SELECT * FROM victim_requests WHERE client_id = ?`, [clientId])
      if (exists) return res.json({ request: exists })
    }

    const created = Number(createdAt) || Date.now()
    await run(
      `INSERT INTO victim_requests(client_id, victim_name, contact, location, disaster_type, created_at, status, assigned_ngo_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [clientId || null, victimName || 'Victim', contact || null, location || '', disasterType || 'other', created, status || 'to_do', assignedNgoId || null]
    )
    const row = await get(`SELECT * FROM victim_requests ORDER BY id DESC LIMIT 1`)
    res.json({ request: row })
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) })
  }
})

app.patch('/api/requests/:id/status', async (req, res) => {
  try {
    const { status } = req.body || {}
    await run(`UPDATE victim_requests SET status = ? WHERE id = ?`, [String(status || 'to_do'), Number(req.params.id)])
    res.json({ ok: true })
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) })
  }
})

app.patch('/api/requests/:id/assign', async (req, res) => {
  try {
    const { ngoId } = req.body || {}
    await run(`UPDATE victim_requests SET assigned_ngo_id = ? WHERE id = ?`, [ngoId || null, Number(req.params.id)])
    res.json({ ok: true })
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) })
  }
})

app.put('/api/requests/:id/audio', upload.single('audio'), async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (!req.file) return res.status(400).json({ error: 'No audio provided' })
    await run(`UPDATE victim_requests SET audio_present = 1 WHERE id = ?`, [id])
    res.json({ ok: true })
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) })
  }
})

app.get('/api/health', (req, res) => res.json({ ok: true }))

init()
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`))
  })
  .catch(err => {
    console.error('DB init failed', err)
    process.exit(1)
  })
