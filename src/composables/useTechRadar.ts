// UNIT_TYPE=Composable
// Feature #134 — Spec "tech radar" visualiser
import { ref, computed } from 'vue'
import type { SpecBlock } from '../types/spec'

export type RadarRing = 'Adopt' | 'Trial' | 'Assess' | 'Hold'

export interface RadarEntry {
  id: string
  label: string        // truncated to 16 chars
  ring: RadarRing
  angle: number        // radians — evenly distributed within ring's entries
  x: number            // SVG x coordinate
  y: number            // SVG y coordinate
}

// Ring radii constants
export const RING_RADII: Record<RadarRing, number> = {
  Adopt: 55,
  Trial: 100,
  Assess: 145,
  Hold: 190,
}

// Ring offsets (in radians) to avoid overlap across rings
const RING_OFFSETS: Record<RadarRing, number> = {
  Adopt: 0,
  Trial: Math.PI / 4,
  Assess: Math.PI / 8,
  Hold: Math.PI / 3,
}

// Ring colours (for documentation/reference — used in component)
export const RING_COLOURS: Record<RadarRing, string> = {
  Adopt: '#10b981', // emerald-500
  Trial: '#3b82f6', // blue-500
  Assess: '#f59e0b', // amber-500
  Hold: '#f87171',  // red-400
}

// Classification keywords per ring
const RING_KEYWORDS: Record<RadarRing, string[]> = {
  Adopt: ['standard', 'proven', 'stable', 'established', 'recommended', 'default', 'core', 'production', 'mature'],
  Trial: ['testing', 'pilot', 'evaluation', 'beta', 'new', 'recent', 'promising', 'candidate'],
  Assess: ['explore', 'research', 'investigate', 'experimental', 'prototype', 'poc', 'unknown', 'unfamiliar', 'novel'],
  Hold: ['deprecated', 'legacy', 'avoid', 'old', 'outdated', 'remove', 'replace', 'technical debt', 'risky'],
}

// Priority order: Adopt > Hold > Trial > Assess
const RING_PRIORITY: RadarRing[] = ['Adopt', 'Hold', 'Trial', 'Assess']

function classifyRing(name: string, description: string): RadarRing {
  const text = (name + ' ' + description).toLowerCase()

  const matched: RadarRing[] = []
  for (const ring of RING_PRIORITY) {
    for (const keyword of RING_KEYWORDS[ring]) {
      if (text.includes(keyword)) {
        matched.push(ring)
        break
      }
    }
  }

  if (matched.length === 0) return 'Trial'

  // Priority: Adopt > Hold > Trial > Assess
  for (const ring of RING_PRIORITY) {
    if (matched.includes(ring)) return ring
  }

  return 'Trial'
}

const SVG_CENTRE = 220

export function useTechRadar(blocks: SpecBlock[]) {
  const entries = computed<RadarEntry[]>(() => {
    // Only use S. entries (type === 'Solution')
    const solutions = blocks.flatMap(b => b.solutions)

    // Group solutions by their assigned ring
    const ringGroups: Record<RadarRing, typeof solutions> = {
      Adopt: [],
      Trial: [],
      Assess: [],
      Hold: [],
    }

    for (const s of solutions) {
      const ring = classifyRing(s.id, s.description)
      ringGroups[ring].push(s)
    }

    const result: RadarEntry[] = []

    for (const ring of (['Adopt', 'Trial', 'Assess', 'Hold'] as RadarRing[])) {
      const group = ringGroups[ring]
      const count = group.length
      const radius = RING_RADII[ring]
      const offset = RING_OFFSETS[ring]

      group.forEach((s, idx) => {
        const angle = (2 * Math.PI / (count || 1)) * idx + offset
        const x = SVG_CENTRE + radius * Math.cos(angle)
        const y = SVG_CENTRE + radius * Math.sin(angle)
        const label = s.id.length > 16 ? s.id.slice(0, 16) : s.id

        result.push({
          id: s.id,
          label,
          ring,
          angle,
          x,
          y,
        })
      })
    }

    return result
  })

  const ringCounts = computed<Record<RadarRing, number>>(() => {
    const counts: Record<RadarRing, number> = { Adopt: 0, Trial: 0, Assess: 0, Hold: 0 }
    for (const e of entries.value) {
      counts[e.ring]++
    }
    return counts
  })

  const copied = ref(false)

  async function copyMarkdown(): Promise<void> {
    const rows = entries.value.map(e => `| ${e.label} | ${e.ring} | keyword match |`)
    const lines = [
      '| Name | Ring | Reason |',
      '|------|------|--------|',
      ...rows,
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
    entries,
    ringCounts,
    copyMarkdown,
    copied,
  }
}
