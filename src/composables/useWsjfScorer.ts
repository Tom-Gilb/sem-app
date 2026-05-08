// UNIT_TYPE=Composable
// Feature #86 — Evo Step WSJF Scorer
import { ref, computed, watch, type Ref } from 'vue'
import type { EvoStep } from '../types/evo-plan'

export interface WsjfEntry {
  stepId: string
  title: string
  codInput: number       // Cost of Delay (1–10 scale, user-entered; default 5)
  jobDuration: number    // derived from effort: effortPercent/100*4 weeks; min 0.5
  wsjf: number           // codInput / jobDuration, rounded to 1 decimal
  rank: number           // 1 = highest WSJF = highest priority
}

export function useWsjfScorer(steps: Ref<EvoStep[]>) {
  const wsjfOpen = ref(false)
  const codInputs = ref<Record<string, number>>({})  // stepId → user CoD value

  // When steps change, initialise any new step IDs to CoD=5 (default)
  watch(
    steps,
    (newSteps) => {
      newSteps.forEach((_, i) => {
        const id = `step-${i}`
        if (!(id in codInputs.value)) {
          codInputs.value[id] = 5
        }
      })
    },
    { immediate: true },
  )

  const wsjfEntries = computed<WsjfEntry[]>(() => {
    const entries = steps.value.map((step, i) => {
      const id = `step-${i}`
      const cod = codInputs.value[id] ?? 5
      // effortHours = effortPercent/100 * 160 (a full 4-week month at 40h/week)
      // jobDuration in weeks = effortHours / 40; fallback when effortPercent is 0
      const effortHours = step.effortPercent > 0
        ? (step.effortPercent / 100) * 160
        : (i + 1) * 8
      const jobDuration = Math.max(effortHours / 40, 0.5)
      const wsjf = Math.round((cod / jobDuration) * 10) / 10

      return {
        stepId: id,
        title: step.name,
        codInput: cod,
        jobDuration,
        wsjf,
        rank: 0, // assigned after sort
      }
    })

    // Sort descending by WSJF
    entries.sort((a, b) => b.wsjf - a.wsjf)

    // Assign rank starting at 1
    entries.forEach((e, i) => {
      e.rank = i + 1
    })

    return entries
  })

  function setCod(stepId: string, value: number): void {
    // Clamp to 1–10
    codInputs.value[stepId] = Math.max(1, Math.min(10, value))
  }

  function copyWsjfTable(): void {
    if (wsjfEntries.value.length === 0) return

    const header = '| Rank | Step | CoD | Duration (weeks) | WSJF |'
    const divider = '|------|------|-----|------------------|------|'
    const rows = wsjfEntries.value.map(
      (e) => `| ${e.rank} | ${e.title} | ${e.codInput} | ${e.jobDuration.toFixed(1)} | ${e.wsjf} |`,
    )
    const markdown = [header, divider, ...rows].join('\n')
    navigator.clipboard?.writeText(markdown).catch(() => {
      // silent — clipboard unavailable in test environment
    })
  }

  return { wsjfOpen, wsjfEntries, codInputs, setCod, copyWsjfTable }
}
