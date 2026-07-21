// UNIT_TYPE=Composable
// Feature #191 — Spec "value-add ratio analyser"
// Analyses VA ratio and waste signals for V. entries.
import { ref, computed } from 'vue'
import type { SpecBlock } from '../types/spec'

export const WASTE_SIGNALS = [
  'manual', 'workaround', 'temporary', 'waiting', 'delay',
  'overhead', 'rework', 'redundant', 'batch', 'handoff',
]

export interface ValueAddEntry {
  id: string
  description: string   // truncated 60 chars
  goal: string
  goalNum: number | null
  statusNum: number | null
  vaRatio: number       // 0–100 derived from nums or seeded 40–89
  wasteSignals: string[]
  wasteCount: number
}

function parseFirstNum(s: string): number | null {
  const m = s.match(/(\d+(?:\.\d+)?)/)
  return m ? parseFloat(m[1]) : null
}

function seed(s: string, mod: number): number {
  return s.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % mod
}

export function buildValueAddEntry(
  id: string,
  description: string,
  goal: string,
  status: string,
  wasteSignals: string[],
): ValueAddEntry {
  const goalNum = parseFirstNum(goal)
  const statusNum = parseFirstNum(status)
  let vaRatio: number
  if (goalNum !== null && statusNum !== null && goalNum > 0) {
    vaRatio = Math.round((goalNum - Math.max(statusNum, 0)) / goalNum * 100)
  } else {
    vaRatio = seed(id + 'va', 50) + 40
  }
  return {
    id,
    description: description.slice(0, 60),
    goal,
    goalNum,
    statusNum,
    vaRatio,
    wasteSignals,
    wasteCount: wasteSignals.length,
  }
}

export function detectWasteSignals(text: string): string[] {
  const lower = text.toLowerCase()
  const found: string[] = []
  for (const signal of WASTE_SIGNALS) {
    if (lower.includes(signal)) found.push(signal)
  }
  return found
}

export function useValueAddRatio(blocks: SpecBlock[]) {
  const open = ref(false)
  const copied = ref(false)

  const entries = computed((): ValueAddEntry[] => {
    if (blocks.length === 0) return []
    const allSolutions = blocks.flatMap(b => b.solutions)

    return blocks.flatMap(b => b.values).map(v => {
      // Find S. entries whose .function links include any F. that this V. measures (via valueOfFunction).
      // r41 v41 — `?? ''` defensives.  AI-generated specs often omit these
      // cross-link fields entirely, which previously crashed the render with
      // `undefined is not an object (evaluating ...split)`.
      // r41 v230 — tolerate non-string shapes from historical stored specs.
      const _vof = typeof v.valueOfFunction === 'string'
        ? v.valueOfFunction
        : Array.isArray(v.valueOfFunction) ? v.valueOfFunction.join(',') : ''
      const linkedFIds = _vof
        .split(/[\s,]+/)
        .map(s => s.replace(/^\[\[|\]\]$/g, '').trim())
        .filter(Boolean)

      const linkedSolutions = allSolutions.filter(s => {
        const _sfn = typeof s.function === 'string'
          ? s.function
          : Array.isArray(s.function) ? (s.function as string[]).join(',') : ''
        const sFIds = _sfn
          .split(/[\s,]+/)
          .map(x => x.replace(/^\[\[|\]\]$/g, '').trim())
          .filter(Boolean)
        return sFIds.some(fid => linkedFIds.includes(fid))
      })

      const signals: string[] = []
      for (const s of linkedSolutions) {
        for (const ws of detectWasteSignals(s.description)) {
          if (!signals.includes(ws)) signals.push(ws)
        }
      }

      return buildValueAddEntry(v.id, v.description, v.goal, v.status, signals)
    })
  })

  const overallVaRatio = computed((): number => {
    if (entries.value.length === 0) return 0
    const sum = entries.value.reduce((a, e) => a + e.vaRatio, 0)
    return Math.round(sum / entries.value.length)
  })

  const topWastes = computed((): string[] => {
    const freq = new Map<string, number>()
    for (const e of entries.value) {
      for (const w of e.wasteSignals) {
        freq.set(w, (freq.get(w) ?? 0) + 1)
      }
    }
    return [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word)
  })

  async function copyMarkdown(): Promise<void> {
    const lines: string[] = [
      '| ID | VA Ratio % | Waste Count | Waste Signals |',
      '|---|---|---|---|',
    ]
    for (const e of entries.value) {
      lines.push(`| ${e.id} | ${e.vaRatio} | ${e.wasteCount} | ${e.wasteSignals.join(', ')} |`)
    }
    await navigator.clipboard.writeText(lines.join('\n'))
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }

  return { open, entries, overallVaRatio, topWastes, copyMarkdown, copied }
}
