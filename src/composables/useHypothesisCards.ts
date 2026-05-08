// UNIT_TYPE=Composable
// Feature #124 — Hypothesis Card Generator
import { computed, ref } from 'vue'
import type { Ref } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface HypothesisCard {
  blockId: string
  blockName: string
  weBelieve: string
  weWill: string
  weKnow: string
  evidenceThreshold: string
}

function charSeed(name: string): number {
  let s = 0
  for (let i = 0; i < name.length; i++) {
    s += name.charCodeAt(i)
  }
  return s
}

function parseGoalValue(goal: string): string {
  if (!goal) return ''
  const match = goal.match(/^Goal\s+\[[^\]]*\]\s+(.+)/)
  if (match) return match[1].trim()
  const simpleMatch = goal.match(/^Goal\s+(.+)/)
  if (simpleMatch) return simpleMatch[1].trim()
  return goal.trim()
}

function parseTolerableValue(tolerable: string): string {
  if (!tolerable) return ''
  const match = tolerable.match(/^Tolerable\s+\[[^\]]*\]\s+(.+)/)
  if (match) return match[1].trim()
  const simpleMatch = tolerable.match(/^Tolerable\s+(.+)/)
  if (simpleMatch) return simpleMatch[1].trim()
  return tolerable.trim()
}

export function buildHypothesisCard(block: SpecBlock): HypothesisCard {
  const vEntry = block.values[0]
  const blockId = vEntry?.id ?? (block.functions[0]?.id ?? 'unknown')
  const blockName = vEntry?.id ?? (block.functions[0]?.id ?? 'Unknown')

  const rawDesc = vEntry?.description ?? ''
  const weBelieve =
    rawDesc.length > 0 ? rawDesc.slice(0, 80) : 'this improvement delivers measurable value'

  const weWill = `implement and measure ${blockName}`

  const goalParsed = vEntry ? parseGoalValue(vEntry.goal) : ''
  const weKnow = goalParsed ? `Goal ${goalParsed} is reached` : 'measurable improvement is observed'

  const tolerableParsed = vEntry ? parseTolerableValue(vEntry.tolerable) : ''
  const evidenceThreshold =
    tolerableParsed && goalParsed
      ? `${tolerableParsed} to ${goalParsed}`
      : 'statistically significant improvement'

  return { blockId, blockName, weBelieve, weWill, weKnow, evidenceThreshold }
}

export function formatHypothesisCardMarkdown(card: HypothesisCard): string {
  return [
    `## Hypothesis — ${card.blockName}`,
    `**We believe:** ${card.weBelieve}`,
    `**We will:** ${card.weWill}`,
    `**We'll know it worked when:** ${card.weKnow}`,
    `**Evidence threshold:** ${card.evidenceThreshold}`,
  ].join('\n')
}

// Kept for deterministic seed usage in tests
export { charSeed }

export function useHypothesisCards(blocks: SpecBlock[]) {
  const copied: Ref<boolean> = ref(false)
  const selectedCard: Ref<HypothesisCard | null> = ref(null)

  // One card per V. entry (blocks with at least one value entry)
  const cards = computed<HypothesisCard[]>(() => {
    return blocks.filter((b) => b.values.length > 0).map((b) => buildHypothesisCard(b))
  })

  function selectCard(card: HypothesisCard): void {
    selectedCard.value = card
  }

  async function copyCard(card: HypothesisCard): Promise<void> {
    const text = formatHypothesisCardMarkdown(card)
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

  async function copyAll(): Promise<void> {
    if (!cards.value.length) return
    const text = cards.value.map((c) => formatHypothesisCardMarkdown(c)).join('\n\n---\n\n')
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

  return { cards, selectedCard, selectCard, copyCard, copyAll, copied }
}
