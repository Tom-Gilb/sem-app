// UNIT_TYPE=Composable
// Feature #142 — "Spec as marketing one-pager"
import { ref, computed } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface MarketingOnePager {
  headline: string       // "Achieve [first V. goal] with [first F. name]"
  subheadline: string    // "[F. count] capabilities. [V. count] measurable outcomes."
  benefits: string[]     // 3 bullets: one per top V. entry Goal (first 3)
  proofPoints: string[]  // 2 bullets: "Goal: [goal]" for top 2 V. entries by numeric goal
  cta: string            // fixed
  footer: string         // fixed
}

const CTA = 'Get started — your first spec in under 5 minutes'
const FOOTER = 'Built on Planguage — measurable specifications since 1988'

const GENERIC_BENEFITS = [
  '✓ Measurable goals reduce ambiguity',
  '✓ Planguage scales across teams',
  '✓ Structured specs accelerate delivery',
]

/** Extract first numeric value from a string */
function extractFirstNumeric(text: string): number {
  const match = text.match(/[-+]?(\d+(\.\d+)?)/)
  return match ? parseFloat(match[1]) : -Infinity
}

/** Parse Goal field — strip "Goal" prefix, take up to 30 chars */
function parseGoalShort(goal: string): string {
  const trimmed = goal.trim().replace(/^Goal\s*/i, '')
  return trimmed.length > 30 ? trimmed.slice(0, 30) : trimmed
}

/** Parse Status field — strip "Status" prefix for display */
function parseStatus(status: string): string {
  const trimmed = status.trim().replace(/^Status\s*/i, '')
  return trimmed || 'not started'
}

export function useMarketingOnePager(blocks: SpecBlock[]) {
  const onePager = computed<MarketingOnePager>(() => {
    const allFunctions = blocks.flatMap(b => b.functions)
    const allValues = blocks.flatMap(b => b.values)

    const fCount = allFunctions.length
    const vCount = allValues.length

    const firstF = allFunctions[0]
    const firstV = allValues[0]

    // Headline
    let headline: string
    if (firstV && firstF) {
      const goalShort = parseGoalShort(firstV.goal)
      const goalPart = goalShort || firstV.id
      const fPart = firstF.id
      headline = `Achieve ${goalPart} with ${fPart}`
    } else {
      headline = 'Deliver measurable value with Planguage'
    }

    // Subheadline
    const subheadline = `${fCount} capabilities. ${vCount} measurable outcomes.`

    // Benefits: first 3 V. entries → "✓ [name]: reach [goal] (currently [status])"
    const topV = allValues.slice(0, 3)
    const benefits: string[] = topV.map(v => {
      const goalShort = parseGoalShort(v.goal) || 'target'
      const status = parseStatus(v.status) || 'not started'
      return `✓ ${v.id}: reach ${goalShort} (currently ${status})`
    })
    // Pad with generic bullets if fewer than 3 V. entries
    while (benefits.length < 3) {
      benefits.push(GENERIC_BENEFITS[benefits.length])
    }

    // Proof points: top 2 V. entries sorted by first numeric in Goal (descending)
    const sortedByGoal = [...allValues].sort((a, b) => {
      return extractFirstNumeric(b.goal) - extractFirstNumeric(a.goal)
    })
    const proofPoints: string[] = sortedByGoal.slice(0, 2).map(v => {
      const goalShort = parseGoalShort(v.goal) || 'target'
      return `📊 Target: ${goalShort} for ${v.id}`
    })

    return {
      headline,
      subheadline,
      benefits,
      proofPoints,
      cta: CTA,
      footer: FOOTER,
    }
  })

  const copied = ref(false)

  async function copyMarkdown(): Promise<void> {
    const p = onePager.value
    const lines: string[] = [
      `# ${p.headline}`,
      '',
      p.subheadline,
      '',
      '---',
      '',
      ...p.benefits.map(b => `- ${b}`),
      '',
      ...p.proofPoints.map(pp => `- ${pp}`),
      '',
      '---',
      '',
      `> ${p.cta}`,
      '',
      `_${p.footer}_`,
    ]
    const text = lines.join('\n')
    try {
      await navigator.clipboard.writeText(text)
      copied.value = true
      setTimeout(() => { copied.value = false }, 2000)
    } catch {
      // clipboard not available
    }
  }

  return {
    onePager,
    copyMarkdown,
    copied,
  }
}
