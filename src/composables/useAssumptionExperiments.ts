// UNIT_TYPE=Composable
// Feature #159 — Spec "assumption→experiment" mapper
import { computed, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface ExperimentCard {
  assumptionText: string
  hypothesis: string
  metric: string
  threshold: string
  resultInput: string
  assumptionRisk: 'high' | 'medium' | 'low'
}

const ASSUMPTION_TRIGGERS = [
  'assumes',
  'expected',
  'should',
  'if',
  'when',
  'must',
]

const METRIC_BANK = [
  'Conversion rate',
  'User retention',
  'Response time',
  'Error rate',
  'Adoption rate',
  'Satisfaction score',
]

const THRESHOLD_BANK = [
  '≥10% improvement',
  '≥95% uptime',
  '≤200ms',
  '≤1% error rate',
  '≥50% adoption',
  '≥4.0 rating',
]

export function charCodeSeed(text: string): number {
  let s = 0
  for (let i = 0; i < text.length; i++) {
    s += text.charCodeAt(i)
  }
  return s
}

export function extractTriggerPhrase(text: string): string | null {
  const lower = text.toLowerCase()
  for (const trigger of ASSUMPTION_TRIGGERS) {
    const idx = lower.indexOf(trigger)
    if (idx !== -1) {
      // Extract the clause containing the trigger (up to 80 chars from trigger start)
      return text.slice(idx, idx + 80).trim()
    }
  }
  return null
}

export function buildExperimentCard(
  assumptionText: string,
  firstVGoal: string,
): ExperimentCard {
  const seed = charCodeSeed(assumptionText)
  const goalText = firstVGoal.trim() || 'measurable improvement'
  const hypothesis = `We believe ${assumptionText.slice(0, 40)} will lead to ${goalText}`
  const metric = METRIC_BANK[seed % 6]
  const threshold = THRESHOLD_BANK[seed % 6]
  const riskIdx = seed % 3
  const assumptionRisk: 'high' | 'medium' | 'low' =
    riskIdx === 0 ? 'high' : riskIdx === 1 ? 'medium' : 'low'

  return {
    assumptionText,
    hypothesis,
    metric,
    threshold,
    resultInput: '',
    assumptionRisk,
  }
}

export function formatExperimentsMarkdown(cards: ExperimentCard[]): string {
  return cards
    .map(
      (c) =>
        `## Experiment\n**Assumption:** ${c.assumptionText}\n**Hypothesis:** ${c.hypothesis}\n**Metric:** ${c.metric}\n**Threshold:** ${c.threshold}\n**Risk:** ${c.assumptionRisk}\n**Result:** ${c.resultInput || '(pending)'}`,
    )
    .join('\n\n')
}

export function useAssumptionExperiments(blocks: SpecBlock[]) {
  const allCopied: Ref<boolean> = ref(false)
  const resultInputs: Ref<string[]> = ref([])

  const cards: ComputedRef<ExperimentCard[]> = computed<ExperimentCard[]>(() => {
    const found: string[] = []

    const firstVGoal =
      blocks.flatMap((b) => b.values).find((v) => v.goal?.trim())?.goal?.trim() ?? ''

    for (const block of blocks) {
      const allEntries = [
        ...block.functions.map((f) => f.description),
        ...block.values.map((v) => `${v.description} ${v.scale}`),
        ...block.solutions.map((s) => s.description),
      ]

      for (const text of allEntries) {
        if (found.length >= 8) break
        const phrase = extractTriggerPhrase(text)
        if (phrase && !found.includes(phrase)) {
          found.push(phrase)
        }
      }

      if (found.length >= 8) break
    }

    // Fallback: synthetic experiments from spec name
    if (found.length === 0) {
      const specName =
        blocks[0]?.functions[0]?.id ??
        blocks[0]?.values[0]?.id ??
        'this feature'
      found.push(
        `${specName} improves user outcomes as expected`,
        `${specName} meets performance targets under load`,
      )
    }

    const base = found.slice(0, 8).map((phrase) =>
      buildExperimentCard(phrase, firstVGoal),
    )

    // Merge any existing resultInputs
    return base.map((card, i) => ({
      ...card,
      resultInput: resultInputs.value[i] ?? '',
    }))
  })

  function updateResult(idx: number, value: string): void {
    const current = [...resultInputs.value]
    current[idx] = value
    resultInputs.value = current
  }

  async function copyAll(): Promise<void> {
    if (!cards.value.length) return
    const text = formatExperimentsMarkdown(cards.value)
    try {
      await navigator.clipboard.writeText(text)
      allCopied.value = true
      setTimeout(() => {
        allCopied.value = false
      }, 2000)
    } catch {
      // clipboard not available
    }
  }

  return { cards, updateResult, copyAll, allCopied }
}
