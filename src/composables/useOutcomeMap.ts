// UNIT_TYPE=Composable
// Feature #181 — Spec "outcome-assumption map"
// Maps V. entries to outcome categories with seeded importance and validity levels.
import { ref, computed } from 'vue'
import type { SpecBlock } from '../types/spec'

export type OutcomeCategory = 'Functional' | 'Emotional' | 'Social'
export type ValidityLevel = 'Validated' | 'Assumed' | 'Unknown'

export interface OutcomeEntry {
  id: string
  description: string
  goal: string
  category: OutcomeCategory
  importance: number
  validity: ValidityLevel
  assumptions: [string, string]
}

const ASSUMPTION_POOL: string[] = [
  'Users will find this intuitive',
  'Stakeholders will approve this approach',
  'The technical infrastructure supports this',
  'The team has capacity to deliver',
  'This will improve measurable outcomes',
  'External factors remain stable',
  'Data will be available for measurement',
  'Adoption will follow expected patterns',
]

const CATEGORIES: OutcomeCategory[] = ['Functional', 'Emotional', 'Social']
const VALIDITIES: ValidityLevel[] = ['Validated', 'Assumed', 'Unknown']

function seed(s: string, mod: number): number {
  return s.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % mod
}

export function buildOutcomeEntry(
  id: string,
  description: string,
  goal: string,
): OutcomeEntry {
  const categoryIdx = seed(id + 'cat', 3)
  const importance = seed(id + 'imp', 5) + 1
  const validityIdx = seed(id + 'val', 3)
  const a0Idx = seed(id + 'a0', 8)
  let a1Idx = seed(id + 'a1', 8)
  if (a1Idx === a0Idx) {
    a1Idx = (a1Idx + 1) % 8
  }

  return {
    id,
    description: description.slice(0, 60),
    goal,
    category: CATEGORIES[categoryIdx],
    importance,
    validity: VALIDITIES[validityIdx],
    assumptions: [ASSUMPTION_POOL[a0Idx], ASSUMPTION_POOL[a1Idx]],
  }
}

export function useOutcomeMap(blocks: SpecBlock[]) {
  const open = ref(false)
  const copied = ref(false)
  const selectedCategory = ref<OutcomeCategory | 'All'>('All')

  const entries = computed((): OutcomeEntry[] => {
    if (blocks.length === 0) return []
    const values = blocks.flatMap(b => b.values)
    return values.map(v => buildOutcomeEntry(v.id, v.description, v.goal))
  })

  const filteredEntries = computed((): OutcomeEntry[] => {
    if (selectedCategory.value === 'All') return entries.value
    return entries.value.filter(e => e.category === selectedCategory.value)
  })

  async function copyMarkdown(): Promise<void> {
    const lines: string[] = [
      '| ID | Category | Importance | Validity | Assumption 1 | Assumption 2 |',
      '|---|---|---|---|---|---|',
    ]
    for (const e of entries.value) {
      lines.push(
        `| ${e.id} | ${e.category} | ${e.importance} | ${e.validity} | ${e.assumptions[0]} | ${e.assumptions[1]} |`,
      )
    }
    await navigator.clipboard.writeText(lines.join('\n'))
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }

  return { open, entries, selectedCategory, filteredEntries, copyMarkdown, copied }
}
