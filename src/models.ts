export type UserRole = 'victim'|'volunteer'|'ngo'|'authority'

export interface User {
  id: string
  role: UserRole
  name: string
  phone?: string
  langs?: string[]
  location?: GeoPoint
}

export interface GeoPoint {
  lat: number
  lng: number
}

export type Category = 'medical'|'rescue'|'shelter'|'supplies'|'unknown'
export type RequestStatus = 'new'|'triaged'|'assigned'|'in_progress'|'delivered'|'closed'
export type MatchStatus = 'proposed'|'accepted'|'declined'|'failed'|'completed'

export interface Request {
  id: string
  reporterUserId?: string
  source: 'app'|'sms'|'ivr'|'whatsapp'
  text: string
  imageUrl?: string
  audioUrl?: string
  ocrText?: string
  detectedLang?: string
  category: Category
  urgency: number // 1-5
  location?: GeoPoint
  locationLabel?: string
  status: RequestStatus
  createdAt: number
  aiSummary?: string
  aiNeeds?: string[]
  aiReason?: string
  aiUsedModel?: boolean
  aiDisasterType?: string
  aiAssignedNgoId?: string
  synced?: boolean
  victimName?: string
  contact?: string
}

export interface Resource {
  id: string
  ownerUserId: string
  type: Category
  capabilityTags: string[]
  quantity: number
  location: GeoPoint
  availabilityStatus: 'available'|'busy'|'offline'
}

export interface Match {
  id: string
  requestId: string
  resourceId: string
  score: number
  distanceKm: number
  status: MatchStatus
}

export interface StatusEvent {
  id: string
  entityType: 'request'|'match'
  entityId: string
  status: string
  actorUserId?: string
  timestamp: number
  note?: string
}
