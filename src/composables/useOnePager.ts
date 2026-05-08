// UNIT_TYPE=Composable
// Feature #142 — Marketing One-Pager (spec interface)
import { ref } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface OnePager {
  headline: string         // derived from domain + first F. entry
  subheadline: string
  benefits: string[]       // 3 items from V. entries
  proofPoints: string[]    // 2 items from V. entry Goals
  cta: string              // 'Get started with [first F. entry name]'
  markdown: string
}

function buildMarkdown(p: OnePager): string {
  const lines: string[] = [
    `# ${p.headline}`,
    '',
    p.subheadline,
    '',
    '---',
    '',
    '## Benefits',
    '',
    ...p.benefits.map(b => `- ${b}`),
    '',
    '## Proof Points',
    '',
    ...p.proofPoints.map(pp => `- ${pp}`),
    '',
    '---',
    '',
    `> ${p.cta}`,
  ]
  return lines.join('\n')
}

export function useOnePager(blocks: SpecBlock[], _apiKey: string = '') {
  const onePager = ref<OnePager | null>(null)
  const generating = ref(false)
  const copied = ref(false)

  async function generate(): Promise<void> {
    generating.value = true
    try {
      const allFunctions = blocks.flatMap(b => b.functions)
      const allValues = blocks.flatMap(b => b.values)

      const firstF = allFunctions[0]
      const firstFName = firstF?.id ?? 'this solution'

      // Headline: first F. entry name + '— Built for Results'
      const headline = (firstFName || 'The Solution') + ' — Built for Results'

      // Subheadline: 'Achieve ' + first V. entry name + ' with measurable outcomes'
      const firstVName = allValues[0]?.id ?? 'your goals'
      const subheadline = 'Achieve ' + firstVName + ' with measurable outcomes'

      // Benefits: up to 3 V. entries — 'Improve ' + v.name
      const topV = allValues.slice(0, 3)
      const benefits: string[] = topV.map(v => 'Improve ' + v.id)
      while (benefits.length < 3) {
        benefits.push('Improve your outcomes')
      }

      // Proof points: first 2 V. entries with goals
      const withGoals = allValues.filter(v => v.goal?.trim())
      const proofPoints: string[] = withGoals.slice(0, 2).map(v => {
        return (v.goal.trim() || 'Measurable outcomes defined') + ' for ' + v.id
      })
      while (proofPoints.length < 2) {
        proofPoints.push('Measurable outcomes defined')
      }

      // CTA
      const cta = 'Get started with ' + (firstFName || 'this solution')

      const pager: OnePager = {
        headline,
        subheadline,
        benefits,
        proofPoints,
        cta,
        markdown: '',
      }
      pager.markdown = buildMarkdown(pager)
      onePager.value = pager
    } finally {
      generating.value = false
    }
  }

  async function copyMarkdown(): Promise<void> {
    if (!onePager.value) return
    try {
      await navigator.clipboard.writeText(onePager.value.markdown)
      copied.value = true
      setTimeout(() => { copied.value = false }, 2000)
    } catch {
      // clipboard not available
    }
  }

  return {
    onePager,
    generating,
    generate,
    copyMarkdown,
    copied,
  }
}
