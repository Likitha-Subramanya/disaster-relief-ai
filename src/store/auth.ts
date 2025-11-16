export interface UserRecord { name: string; email: string; password: string }

const USERS_KEY = 'reliefai_users'
const CURRENT_KEY = 'reliefai_current_user'

function readUsers(): Record<string, UserRecord> {
  try {
    const raw = localStorage.getItem(USERS_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, UserRecord>
  } catch { return {} }
}

function writeUsers(map: Record<string, UserRecord>) {
  localStorage.setItem(USERS_KEY, JSON.stringify(map))
}

export function registerUser(rec: UserRecord): { ok: true } | { ok: false; error: string } {
  const users = readUsers()
  const key = rec.email.toLowerCase().trim()
  if (users[key]) return { ok: false, error: 'User already exists' }
  users[key] = { name: rec.name.trim(), email: key, password: rec.password }
  writeUsers(users)
  localStorage.setItem(CURRENT_KEY, key)
  return { ok: true }
}

export function signIn(email: string, password: string): { ok: true } | { ok: false; error: string } {
  const users = readUsers()
  const key = email.toLowerCase().trim()
  const rec = users[key]
  if (!rec || rec.password !== password) return { ok: false, error: 'Invalid credentials' }
  localStorage.setItem(CURRENT_KEY, key)
  return { ok: true }
}

export function signOut() {
  localStorage.removeItem(CURRENT_KEY)
}

export function getCurrentUser(): UserRecord | null {
  const key = localStorage.getItem(CURRENT_KEY)
  if (!key) return null
  const users = readUsers()
  return users[key] || null
}
