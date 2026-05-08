// UNIT_TYPE=Composable
// Feature #159 — Assumption→Experiment Mapper
// Per V. entry: lean experiment card (hypothesis + success metric + threshold + result field)
import { ref, computed } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface ExperimentCard {
  entryId: string
  entryDescription: string
  hypothesis: string      // "We believe [action] will [outcome]"
  metric: string          // what to measure
  threshold: string       // success threshold (derived from Goal)
  result: string          // user-editable result (starts empty)
}

const HYPOTHESES = [
  'implementing this feature will increase',
  'improving this metric will drive',
  'delivering this capability will reduce',
  'addressing this goal will improve',
  'automating this function will accelerate',
]

const METRICS = [
  'user satisfaction score',
  'task completion rate',
  'error rate',
  'time to complete',
  'adoption rate',
  'Net Promoter Score',
]

function seed(s: string): number {
  return s.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
}

export function useExperimentMapper(blocks: SpecBlock[]) {
  const open = ref(false)
  const results = ref<Record<string, string>>({})
  const copied = ref(false)

  const cards = computed((): ExperimentCard[] => {
    return blocks
      .flatMap(b => b.values)
      .map(v => {
        const s = seed(v.id ?? v.description ?? '')
        const hyp = HYPOTHESES[s % HYPOTHESES.length]
        const metric = METRICS[(s + 1) % METRICS.length]
        const threshold = v.goal || v.tolerable || '> baseline'
        return {
          entryId: v.id ?? '?',
          entryDescription: v.description?.slice(0, 60) ?? v.id ?? '',
          hypothesis: `We believe ${hyp} "${v.description?.slice(0, 30) ?? v.id}"`,
          metric,
          threshold,
          result: results.value[v.id ?? ''] ?? '',
        }
      })
  })

  function setResult(entryId: string, value: string) {
    results.value[entryId] = value
  }

  async function copyAll() {
    const lines = ['# Lean Experiments\n']
    for (const c of cards.value) {
      lines.push(`## ${c.entryId}`)
      lines.push(`**Hypothesis:** ${c.hypothesis}`)
      lines.push(`**Metric:** ${c.metric}`)
      lines.push(`**Threshold:** ${c.threshold}`)
      lines.push(`**Result:** ${c.result || '(pending)'}\n`)
    }
    await navigator.clipboard.writeText(lines.join('\n'))
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }

  return { open, cards, results, setResult, copied, copyAll }
}
