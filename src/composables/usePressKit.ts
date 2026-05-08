// UNIT_TYPE=Composable
// Feature #162 — "Spec as Press Kit" Generator
// Headline + subheadline + 3 key facts + 2 quotes + boilerplate; from F./V./S. entries
import { computed, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface PressKit {
  headline: string
  subheadline: string
  keyFacts: string[]
  quotes: string[]
  boilerplate: string
}

export function buildPressKit(blocks: SpecBlock[]): PressKit {
  const fEntries = blocks.flatMap((b) => b.functions)
  const vEntries = blocks.flatMap((b) => b.values)
  const sEntries = blocks.flatMap((b) => b.solutions)

  const firstFName = fEntries[0]?.id ?? 'this product'
  const firstVGoal = vEntries[0]?.goal?.trim() || 'Better Results'
  const firstFDesc = fEntries[0]?.description ?? ''
  const firstVScale = vEntries[0]?.scale || 'performance'
  const firstVMeter = vEntries[0]?.meter || 'quantitative data'
  const firstVId = vEntries[0]?.id ?? 'the product team'
  const firstSDesc = sEntries[0]?.description ?? ''

  // Auto-detect domain word from first F. description
  const domainWords = firstFDesc.toLowerCase().match(/[a-z]{5,}/)
  const domainWord = domainWords ? domainWords[0] : 'operational excellence'

  const headline = `Introducing ${firstFName}: ${firstVGoal}`
  const subheadline = `A new approach to ${firstFDesc.slice(0, 40)}`

  const keyFacts: string[] = [
    `${fEntries.length} key capabilities delivering ${vEntries.length} measurable outcomes`,
    `Target metric: ${firstVScale} measured by ${firstVMeter}`,
    `${sEntries.length} solution approaches identified`,
  ]

  const quotes: string[] = [
    `"Our goal is to achieve ${firstVGoal} — ${firstVId}," said the Product Team.`,
    `"The approach delivers ${firstSDesc.slice(0, 30) || 'real value'}, which our stakeholders have been asking for," said Engineering.`,
  ]

  const boilerplate = `This product represents a significant step forward in ${domainWord}. For more information, contact the team.`

  return { headline, subheadline, keyFacts, quotes, boilerplate }
}

export function formatPressKitMarkdown(kit: PressKit): string {
  const lines = [
    `# ${kit.headline}`,
    '',
    `*${kit.subheadline}*`,
    '',
    '## Key Facts',
    ...kit.keyFacts.map((f) => `- ${f}`),
    '',
    '## Quotes',
    ...kit.quotes.map((q) => `> ${q}`),
    '',
    '## Boilerplate',
    kit.boilerplate,
  ]
  return lines.join('\n')
}

export function usePressKit(blocks: SpecBlock[]) {
  const copied: Ref<boolean> = ref(false)

  const pressKit: ComputedRef<PressKit> = computed<PressKit>(() =>
    buildPressKit(blocks),
  )

  async function copyMarkdown(): Promise<void> {
    const text = formatPressKitMarkdown(pressKit.value)
    try {
      await navigator.clipboard.writeText(text)
      copied.value = true
      setTimeout(() => {
        copied.value = false
      }, 2000)
    } catch {
      // clipboard not available
    }
  }

  return { pressKit, copyMarkdown, copied }
}
