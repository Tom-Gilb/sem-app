// UNIT_TYPE=Composable
// Feature #96 — Spec as User Story Map
import { ref, computed } from 'vue'
import type { Ref } from 'vue'
import type { SpecBlock, FEntry } from '../types/spec'

export interface StoryMapLane {
  stakeholder: string
  entries: FEntry[]
}

// Inline stakeholder patterns matching the spec instruction
const STORY_STAKEHOLDER_PATTERNS: { name: string; keywords: string[] }[] = [
  { name: 'User', keywords: ['user', 'customer', 'client'] },
  { name: 'Manager', keywords: ['manager'] },
  { name: 'Developer', keywords: ['developer', 'admin'] },
  { name: 'Trainer', keywords: ['trainer'] },
  { name: 'Practitioner', keywords: ['practitioner'] },
  { name: 'Organisation', keywords: ['organisation', 'organization', 'team'] },
  { name: 'System', keywords: ['system'] },
]

function detectStakeholder(description: string): string {
  const lower = description.toLowerCase()
  for (const pattern of STORY_STAKEHOLDER_PATTERNS) {
    if (pattern.keywords.some(k => lower.includes(k))) {
      return pattern.name
    }
  }
  return 'General'
}

export function useStoryMap(spec: Ref<SpecBlock | null>) {
  const storyMapOpen = ref(false)
  const selectedLane = ref<string | null>(null)

  const lanes = computed<StoryMapLane[]>(() => {
    if (!spec.value) return []

    const fEntries = spec.value.functions

    // Build a map of stakeholder → FEntry[]
    const laneMap = new Map<string, FEntry[]>()
    for (const entry of fEntries) {
      const stakeholder = detectStakeholder(entry.description)
      if (!laneMap.has(stakeholder)) {
        laneMap.set(stakeholder, [])
      }
      laneMap.get(stakeholder)!.push(entry)
    }

    if (laneMap.size === 0) return []

    // Sort: alphabetical, "General" goes last
    const sorted = Array.from(laneMap.entries()).sort(([a], [b]) => {
      if (a === 'General') return 1
      if (b === 'General') return -1
      return a.localeCompare(b)
    })

    return sorted.map(([stakeholder, entries]) => ({ stakeholder, entries }))
  })

  return { storyMapOpen, lanes, selectedLane }
}
