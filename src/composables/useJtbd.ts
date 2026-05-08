// UNIT_TYPE=Composable
// Feature #156 — Spec "jobs to be done" canvas
import { computed, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import type { SpecBlock, VEntry } from '../types/spec'

export interface JtbdCard {
  fEntryId: string
  fEntryName: string
  when: string
  iWantTo: string
  soICan: string
}

const WHEN_BANK = [
  "I'm onboarding a new user",
  "I'm planning the next sprint",
  "I'm reviewing progress",
  "I'm evaluating options",
  "I'm troubleshooting an issue",
  "I'm preparing a report",
]

export function charCodeSeed(id: string): number {
  let s = 0
  for (let i = 0; i < id.length; i++) {
    s += id.charCodeAt(i)
  }
  return s
}

export function hasKeywordOverlap(fId: string, vId: string): boolean {
  const fParts = fId.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter((w) => w.length > 2)
  const vParts = vId.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter((w) => w.length > 2)
  return fParts.some((fp) => vParts.includes(fp))
}

export function buildJtbdCard(
  fEntryId: string,
  fDescription: string,
  vEntries: VEntry[],
): JtbdCard {
  const seed = charCodeSeed(fEntryId)
  const when = WHEN_BANK[seed % 6]
  const iWantTo = fDescription.slice(0, 60).trim()

  const matchedV = vEntries.find((v) => hasKeywordOverlap(fEntryId, v.id))
  const soICan = matchedV?.goal?.trim() || 'achieve measurable value'

  return {
    fEntryId,
    fEntryName: fEntryId,
    when,
    iWantTo,
    soICan,
  }
}

export function formatJtbdMarkdown(cards: JtbdCard[]): string {
  return cards
    .map(
      (c) =>
        `## JTBD: ${c.fEntryName}\n**When** ${c.when}\n**I want to** ${c.iWantTo}\n**So I can** ${c.soICan}`,
    )
    .join('\n\n')
}

export function useJtbd(blocks: SpecBlock[]) {
  const selectedCard: Ref<string | null> = ref(null)
  const allCopied: Ref<boolean> = ref(false)

  const cards: ComputedRef<JtbdCard[]> = computed<JtbdCard[]>(() => {
    const result: JtbdCard[] = []
    const allValues: VEntry[] = blocks.flatMap((b) => b.values)
    for (const block of blocks) {
      for (const f of block.functions) {
        result.push(buildJtbdCard(f.id, f.description, allValues))
      }
    }
    return result
  })

  function selectCard(id: string): void {
    selectedCard.value = id
  }

  async function copyAll(): Promise<void> {
    if (!cards.value.length) return
    const text = formatJtbdMarkdown(cards.value)
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

  return { cards, selectedCard, selectCard, copyAll, allCopied }
}
