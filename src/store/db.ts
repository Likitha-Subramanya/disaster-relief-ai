import { openDB, DBSchema, IDBPDatabase } from 'idb'
import type { Request, Resource, StatusEvent, Match } from '../models'

interface ReliefDb extends DBSchema {
  requests: { key: string; value: Request }
  resources: { key: string; value: Resource }
  statusEvents: { key: string; value: StatusEvent }
  matches: { key: string; value: Match }
}

const DB_NAME = 'reliefai'
// Bump version to ensure all required object stores are created on existing installs
const DB_VERSION = 3

export async function getDb() {
  return openDB<ReliefDb>(DB_NAME, DB_VERSION, {
    upgrade(db: IDBPDatabase<ReliefDb>) {
      if (!db.objectStoreNames.contains('requests')) db.createObjectStore('requests', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('resources')) db.createObjectStore('resources', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('statusEvents')) db.createObjectStore('statusEvents', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('matches')) db.createObjectStore('matches', { keyPath: 'id' })
    }
  })
}

export async function putRequest(r: Request) {
  const db = await getDb(); await db.put('requests', r)
}
export async function getRequests(): Promise<Request[]> {
  const db = await getDb(); return (await db.getAll('requests'))
}
export async function putResource(r: Resource) {
  const db = await getDb(); await db.put('resources', r)
}
export async function getResources(): Promise<Resource[]> {
  const db = await getDb(); return (await db.getAll('resources'))
}
export async function addStatus(e: StatusEvent) {
  const db = await getDb(); await db.put('statusEvents', e)
}
export async function getStatus(entityId: string): Promise<StatusEvent[]> {
  const db = await getDb();
  const all = await db.getAll('statusEvents');
  return all
    .filter((e: StatusEvent)=> e.entityId===entityId)
    .sort((a: StatusEvent, b: StatusEvent)=> a.timestamp - b.timestamp)
}

export async function putMatch(m: Match) {
  const db = await getDb(); await db.put('matches', m)
}
export async function getMatchesByRequest(requestId: string): Promise<Match[]> {
  const db = await getDb(); const all = await db.getAll('matches'); return all.filter(m=> m.requestId===requestId)
}
export async function getAllResources() { return getResources() }
export async function getAllMatches(): Promise<Match[]> { const db = await getDb(); return db.getAll('matches') }
export async function getResourceById(id: string): Promise<Resource | undefined> {
  const db = await getDb();
  return db.get('resources', id)
}

export async function updateRequestStatus(id: string, status: Request['status']) {
  const db = await getDb();
  const r = await db.get('requests', id)
  if (!r) return
  r.status = status
  await db.put('requests', r)
  await addStatus({ id: 'se_'+Date.now(), entityType: 'request', entityId: id, status, timestamp: Date.now() })
}

export async function setResourceAvailability(id: string, availabilityStatus: Resource['availabilityStatus']) {
  const db = await getDb();
  const res = await db.get('resources', id)
  if (!res) return
  res.availabilityStatus = availabilityStatus
  await db.put('resources', res)
}

export async function getUnsyncedRequests(): Promise<Request[]> {
  const db = await getDb()
  const all = await db.getAll('requests')
  return all.filter(r => !r.synced)
}

export async function markRequestSynced(id: string) {
  const db = await getDb()
  const req = await db.get('requests', id)
  if (!req) return
  req.synced = true
  await db.put('requests', req)
}
