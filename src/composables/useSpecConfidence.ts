// UNIT_TYPE=Composable
// Feature #78 — Spec "confidence interval" overlay
import { ref, computed, watch } from 'vue'
import type { Ref } from 'vue'
import type { SpecBlock } from '../types/spec'

export function useSpecConfidence(spec: Ref<SpecBlock | null>) {
  const confidenceOpen = ref(false)
  const confidenceScores = ref<Record<string, number>>({})

  // When spec changes, initialise any new V. entry IDs to 75; keep existing values
  watch(
    spec,
    (newSpec) => {
      if (!newSpec) return
      const updated = { ...confidenceScores.value }
      for (const v of newSpec.values) {
        if (!(v.id in updated)) {
          updated[v.id] = 75
        }
      }
      confidenceScores.value = updated
    },
    { immediate: true },
  )

  const vEntries = computed(() => spec.value?.values ?? [])

  const avgConfidence = computed((): number => {
    const vals = Object.values(confidenceScores.value)
    if (vals.length === 0) return 0
    return Math.round(vals.reduce((sum, v) => sum + v, 0) / vals.length)
  })

  const lowConfidenceEntries = computed((): string[] =>
    Object.entries(confidenceScores.value)
      .filter(([, v]) => v <= 60)
      .map(([id]) => id),
  )

  function setConfidence(id: string, value: number): void {
    confidenceScores.value = {
      ...confidenceScores.value,
      [id]: Math.max(0, Math.min(100, value)),
    }
  }

  function copyConfidenceSummary(): void {
    const lines: string[] = [
      '## Confidence Summary',
      `Average: ${avgConfidence.value}%`,
      '',
      '| ID | Scale | Confidence |',
      '| --- | --- | --- |',
    ]
    for (const v of vEntries.value) {
      const score = confidenceScores.value[v.id] ?? 75
      lines.push(`| ${v.id} | ${v.scale} | ${score}% |`)
    }
    const text = lines.join('\n')
    navigator.clipboard.writeText(text).catch(() => { /* no-op */ })
  }

  return {
    confidenceOpen,
    confidenceScores,
    vEntries,
    avgConfidence,
    lowConfidenceEntries,
    setConfidence,
    copyConfidenceSummary,
  }
}
