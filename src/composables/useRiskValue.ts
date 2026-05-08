// UNIT_TYPE=Composable
// Feature #164 — Spec "risk-adjusted value" calculator
// Per V. entry: risk probability input; risk-adjusted value = Goal × probability
// Aggregate expected value; comparison table
import { ref, computed } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface RiskEntry {
  vId: string
  vDescription: string
  rawGoal: string         // original Goal string
  goalNumeric: number     // parsed numeric from Goal
  probability: number     // user-set 0–100 (default seeded)
  adjustedValue: number   // goalNumeric × (probability/100)
}

export function useRiskValue(blocks: SpecBlock[]) {
  const open = ref(false)
  const probabilities = ref<Record<string, number>>({})
  const copied = ref(false)

  function seed(s: string): number {
    return s.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  }

  function parseNum(s: string): number {
    const m = s.match(/[\d.]+/)
    return m ? parseFloat(m[0]) : 50
  }

  const entries = computed((): RiskEntry[] => {
    return blocks.flatMap(b => b.values).map(v => {
      const s = seed(v.id)
      const defaultProb = 50 + (s % 40)  // 50-89%
      const prob = probabilities.value[v.id] ?? defaultProb
      const goalNum = parseNum(v.goal)
      return {
        vId: v.id,
        vDescription: v.description.slice(0, 50),
        rawGoal: v.goal,
        goalNumeric: goalNum,
        probability: prob,
        adjustedValue: Math.round(goalNum * (prob / 100) * 10) / 10,
      }
    })
  })

  function setProbability(vId: string, value: number) {
    probabilities.value[vId] = Math.max(0, Math.min(100, value))
  }

  const totalAdjusted = computed(() =>
    entries.value.reduce((a, e) => a + e.adjustedValue, 0)
  )

  const totalRaw = computed(() =>
    entries.value.reduce((a, e) => a + e.goalNumeric, 0)
  )

  async function copyMarkdown() {
    const lines = ['# Risk-Adjusted Value\n']
    lines.push(`**Total raw:** ${totalRaw.value} | **Total adjusted:** ${totalAdjusted.value}\n`)
    lines.push('| Entry | Goal | Probability | Adjusted |')
    lines.push('|---|---|---|---|')
    for (const e of entries.value) {
      lines.push(`| ${e.vId} | ${e.rawGoal} | ${e.probability}% | ${e.adjustedValue} |`)
    }
    await navigator.clipboard.writeText(lines.join('\n'))
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }

  return { open, entries, setProbability, totalAdjusted, totalRaw, copied, copyMarkdown }
}
