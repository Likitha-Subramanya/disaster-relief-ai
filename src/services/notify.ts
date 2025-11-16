// Notification stubs for SMS/WhatsApp integration
// Replace these with real API calls (Twilio/MSG91/WhatsApp Business API) on the backend.
export function notifyVolunteerMatched({ requestId, resourceId, victimPhone }: { requestId: string; resourceId: string; victimPhone?: string }) {
  // TODO: send SMS/WhatsApp via backend function
  console.log('[notify] Matched request', { requestId, resourceId, victimPhone })
}

export function notifyVictimStatus({ requestId, status, victimPhone }: { requestId: string; status: string; victimPhone?: string }) {
  // TODO: send SMS/WhatsApp update to victim
  console.log('[notify] Victim status update', { requestId, status, victimPhone })
}
