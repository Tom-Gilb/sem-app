// UNIT_TYPE=Composable
// Feature #50 — Multi-project dashboard
import { ref } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface DashboardEntry {
  id: string          // UUID
  name: string        // derived from spec
  domain: string      // 'Engineering' | 'Product' | etc.
  qualityScore: number // 0–100
  entryCount: number
  createdAt: Date
  spec: SpecBlock
}

export function useProjectDashboard() {
  const entries = ref<DashboardEntry[]>([])

  function deriveName(spec: SpecBlock): string {
    const firstF = spec.functions[0]
    if (firstF?.description) return firstF.description.slice(0, 40) + (firstF.description.length > 40 ? '…' : '')
    const firstV = spec.values[0]
    if (firstV?.description) return firstV.description.slice(0, 40) + (firstV.description.length > 40 ? '…' : '')
    return `Spec ${entries.value.length + 1}`
  }

  function deriveDomain(spec: SpecBlock): string {
    const text = [
      ...spec.functions.map(f => f.description),
      ...spec.values.map(v => v.description),
    ].join(' ').toLowerCase()

    if (/api|deploy|latency|database|server|system|infra/.test(text)) return 'Engineering'
    if (/user|onboard|retention|feature|product|ux/.test(text)) return 'Product'
    if (/revenue|customer|sales|market|growth/.test(text)) return 'Business'
    if (/research|study|hypothesis|experiment/.test(text)) return 'Research'
    if (/health|exercise|habit|personal|fitness/.test(text)) return 'Personal'
    return 'General'
  }

  function deriveQualityScore(spec: SpecBlock): number {
    let score = 0
    const total = spec.functions.length + spec.values.length + spec.solutions.length
    if (total === 0) return 0
    // Award points for completeness
    for (const v of spec.values) {
      if (v.scale) score += 15
      if (v.goal) score += 15
      if (v.meter) score += 10
    }
    for (const f of spec.functions) {
      if (f.description) score += 10
      if (f.presenceTest || f.successCriteria) score += 5
    }
    for (const s of spec.solutions) {
      if (s.description) score += 5
    }
    return Math.min(100, Math.round(score / Math.max(total, 1)))
  }

  /** Add a brand-new entry. Returns the new entry's id (or existing id if duplicate). */
  function addEntry(spec: SpecBlock): string {
    // Deduplication: if an entry with identical spec content already exists, return its id.
    const fingerprint = JSON.stringify(spec)
    const existing = entries.value.find(e => JSON.stringify(e.spec) === fingerprint)
    if (existing) return existing.id

    const id = crypto.randomUUID()
    entries.value.unshift({
      id,
      name: deriveName(spec),
      domain: deriveDomain(spec),
      qualityScore: deriveQualityScore(spec),
      entryCount: spec.functions.length + spec.values.length + spec.solutions.length,
      createdAt: new Date(),
      spec,
    })
    return id
  }

  /**
   * Update an existing entry's live spec fields in place (for sharpening rounds).
   * The createdAt and domain stay fixed to the original generation event.
   */
  function updateEntry(id: string, spec: SpecBlock): void {
    const entry = entries.value.find(e => e.id === id)
    if (!entry) return
    entry.spec         = spec
    entry.name         = deriveName(spec)
    entry.qualityScore = deriveQualityScore(spec)
    entry.entryCount   = spec.functions.length + spec.values.length + spec.solutions.length
  }

  function removeEntry(id: string): void {
    entries.value = entries.value.filter(e => e.id !== id)
  }

  function clearAll(): void {
    entries.value = []
  }

  return { entries, addEntry, updateEntry, removeEntry, clearAll, deriveName, deriveDomain, deriveQualityScore }
}
