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
  createdAt: number
  status: RequestStatus
  assignedNgoId?: string
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
  name: string
  email: string
  password: string
  phone: string
  address: string
  location: string
  serviceType: string
  branches?: string[]
  theme?: 'dark' | 'light'
}

export interface AdminUser {
  id: string
  name: string
  email: string
  password: string
}
export type CurrentRole = 'victim' | 'ngo' | 'admin' | null

const VICTIM_REQUESTS_KEY = 'resc_victim_requests'
const CURRENT_VICTIM_KEY = 'resc_current_victim'
const NGO_USERS_KEY = 'resc_ngo_users'
const CURRENT_NGO_KEY = 'resc_current_ngo'
const ADMIN_USERS_KEY = 'resc_admin_users'
const CURRENT_ADMIN_KEY = 'resc_current_admin'
const CURRENT_ROLE_KEY = 'resc_current_role'

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

function normalize(str: string) {
  return str.toLowerCase()
}

function chooseAutoNgoForDisaster(disasterType: DisasterType): string | undefined {
  const ngos = getNgoUsers()
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

  const scored = ngos.map(ngo => {
    const services = normalize(ngo.serviceType || '')
    let score = 0
    preferred.forEach(p => {
      if (services.includes(p)) score += 1
    })
    return { ngo, score }
  })

  const bestMatches = scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)

  if (bestMatches.length > 0) {
    return bestMatches[0].ngo.id
  }

  return ngos[0]?.id
}

export function addVictimRequest(rec: Omit<VictimRequest, 'id' | 'createdAt' | 'status'>) {
  const list = safeRead<VictimRequest[]>(VICTIM_REQUESTS_KEY, [])
  const autoNgoId = rec.assignedNgoId ?? chooseAutoNgoForDisaster(rec.disasterType)
  const newItem: VictimRequest = {
    id: 'vr_' + Date.now(),
    createdAt: Date.now(),
    status: 'to_do',
    ...rec,
    assignedNgoId: autoNgoId,
  }
  list.push(newItem)
  safeWrite(VICTIM_REQUESTS_KEY, list)
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
}

export function assignNgoToVictim(id: string, ngoId: string | null) {
  const list = getVictimRequests()
  const idx = list.findIndex(r => r.id === id)
  if (idx === -1) return
  list[idx] = { ...list[idx], assignedNgoId: ngoId || undefined }
  safeWrite(VICTIM_REQUESTS_KEY, list)
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
  return { ok: true as const, ngo: newNgo }
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
}

export function adminAddNgo(rec: Omit<NgoUser, 'id'>) {
  const list = safeRead<NgoUser[]>(NGO_USERS_KEY, [])
  if (list.some(u => u.email.toLowerCase() === rec.email.toLowerCase())) {
    return { ok: false as const, error: 'NGO already registered with this email' }
  }
  const newNgo: NgoUser = { id: 'ngo_' + Date.now(), ...rec }
  list.push(newNgo)
  safeWrite(NGO_USERS_KEY, list)
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
