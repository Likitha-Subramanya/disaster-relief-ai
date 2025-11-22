// Pluggable local LLM adapter. This file provides a small API that other code can call.
// To integrate a local model (wasm/worker), register an implementation using `registerAdapter`.

type TriageOutput = {
  summary?: string
  category?: string
  urgency?: number
  disasterType?: string
  needs?: string[]
  peopleAffected?: number | null
  trapped?: boolean | null
  injured?: boolean | null
  specialConstraints?: string[]
  confidence?: number
  severityLevel?: number
  severityLabel?: string
  severityReason?: string
  uncertaintyReasons?: string[]
}

let impl: {
  triage: (input: any) => Promise<TriageOutput>
} | null = null

export function registerAdapter(adapter: { triage: (input: any) => Promise<TriageOutput> }) {
  impl = adapter
}

export default {
  isAvailable() {
    return impl !== null
  },
  async triage(input: any): Promise<TriageOutput> {
    if (!impl) throw new Error('No local LLM adapter registered')
    return impl.triage(input)
  },
  registerAdapter,
}

export type { TriageOutput }
