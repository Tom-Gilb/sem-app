// UNIT_TYPE=Composable
// Feature #149 — Spec Customer Empathy Map
import { computed, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface EmpathyCard {
  vEntryId: string
  vEntryName: string
  think: string
  feel: string
  say: string
  doText: string
}

const THINK_BANK = [
  'Wants measurable outcomes',
  'Needs clear success criteria',
  'Worried about scope creep',
  'Expects transparent progress',
  'Values reliability over speed',
  'Questions the ROI',
]

const FEEL_BANK = [
  'Optimistic about the goal',
  'Anxious about deadlines',
  'Confident in the team',
  'Frustrated by ambiguity',
  'Excited to see results',
  'Uncertain about trade-offs',
]

const SAY_BANK = [
  "'Show me the numbers'",
  "'When will this be done?'",
  "'Is this the right approach?'",
  "'What are the risks?'",
  "'Let's keep it simple'",
  "'Can we measure this?'",
]

const DO_BANK = [
  'Reviews progress weekly',
  'Asks for status updates',
  'Compares against competitors',
  'Escalates blocking issues',
  'Validates with end users',
  'Adjusts priorities based on data',
]

export function charCodeSeed(id: string): number {
  let s = 0
  for (let i = 0; i < id.length; i++) {
    s += id.charCodeAt(i)
  }
  return s
}

export function buildEmpathyCard(vEntryId: string, vEntryName: string): EmpathyCard {
  const seed = charCodeSeed(vEntryId)
  return {
    vEntryId,
    vEntryName,
    think: THINK_BANK[seed % 6],
    feel: FEEL_BANK[(seed + 1) % 6],
    say: SAY_BANK[(seed + 2) % 6],
    doText: DO_BANK[(seed + 3) % 6],
  }
}

export function formatEmpathyMarkdown(cards: EmpathyCard[]): string {
  return cards
    .map(
      (c) =>
        `## Empathy Map — ${c.vEntryName}\n**Think:** ${c.think}\n**Feel:** ${c.feel}\n**Say:** ${c.say}\n**Do:** ${c.doText}`,
    )
    .join('\n\n')
}

export function useEmpathyMap(blocks: SpecBlock[]) {
  const selectedId: Ref<string | null> = ref(null)
  const copied: Ref<boolean> = ref(false)

  const cards: ComputedRef<EmpathyCard[]> = computed<EmpathyCard[]>(() => {
    const result: EmpathyCard[] = []
    for (const block of blocks) {
      for (const v of block.values) {
        result.push(buildEmpathyCard(v.id, v.id))
      }
    }
    return result
  })

  function selectCard(vEntryId: string): void {
    selectedId.value = vEntryId
  }

  async function copyMarkdown(): Promise<void> {
    if (!cards.value.length) return
    const text = formatEmpathyMarkdown(cards.value)
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

  return { cards, selectedId, selectCard, copyMarkdown, copied }
}
