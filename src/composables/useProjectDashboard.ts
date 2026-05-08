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
      if (f.successCriteria) score += 5
    }
    for (const s of spec.solutions) {
      if (s.description) score += 5
    }
    return Math.min(100, Math.round(score / Math.max(total, 1)))
  }

  function addEntry(spec: SpecBlock): void {
    const existing = entries.value.find(e => JSON.stringify(e.spec) === JSON.stringify(spec))
    if (existing) return // deduplicate
    entries.value.unshift({
      id: crypto.randomUUID(),
      name: deriveName(spec),
      domain: deriveDomain(spec),
      qualityScore: deriveQualityScore(spec),
      entryCount: spec.functions.length + spec.values.length + spec.solutions.length,
      createdAt: new Date(),
      spec,
    })
  }

  function removeEntry(id: string): void {
    entries.value = entries.value.filter(e => e.id !== id)
  }

  function clearAll(): void {
    entries.value = []
  }

  return { entries, addEntry, removeEntry, clearAll, deriveName, deriveDomain, deriveQualityScore }
}
