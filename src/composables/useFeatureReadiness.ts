// UNIT_TYPE=Composable
// Feature #179 — Spec "feature readiness level" (FRL)
// Scores each F. and S. entry with a seeded TRL-style readiness level 1–9.
import { ref, computed } from 'vue'
import type { SpecBlock } from '../types/spec'

const FRL_DESCRIPTIONS: Record<number, string> = {
  1: 'Basic concept only — no implementation evidence',
  2: 'Technology concept formulated',
  3: 'Experimental proof of concept',
  4: 'Component validation in lab environment',
  5: 'Component validation in relevant environment',
  6: 'System prototype demonstrated',
  7: 'System prototype proven in operational environment',
  8: 'System complete and qualified',
  9: 'Actual system proven in operational environment',
}

export interface FrlEntry {
  id: string
  entryType: 'F' | 'S'
  label: string
  description: string
  level: number
  levelDescription: string
  colorClass: string
  bgClass: string
}

function seed(s: string, mod: number): number {
  return s.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % mod
}

function colorForLevel(level: number): string {
  if (level <= 3) return 'text-red-600'
  if (level <= 6) return 'text-amber-600'
  return 'text-emerald-600'
}

function bgForLevel(level: number): string {
  if (level <= 3) return 'bg-red-50'
  if (level <= 6) return 'bg-amber-50'
  return 'bg-emerald-50'
}

export function buildFrlEntry(
  id: string,
  entryType: 'F' | 'S',
  description: string,
): FrlEntry {
  const level = seed(id + 'frl', 9) + 1
  return {
    id,
    entryType,
    label: `${entryType}. ${id}`,
    description: description.slice(0, 60),
    level,
    levelDescription: FRL_DESCRIPTIONS[level],
    colorClass: colorForLevel(level),
    bgClass: bgForLevel(level),
  }
}

export function useFeatureReadiness(blocks: SpecBlock[]) {
  const open = ref(false)
  const copied = ref(false)

  const entries = computed((): FrlEntry[] => {
    if (blocks.length === 0) return []
    const functions = blocks.flatMap(b => b.functions)
    const solutions = blocks.flatMap(b => b.solutions)
    const fEntries = functions.map(f => buildFrlEntry(f.id, 'F', f.description))
    const sEntries = solutions.map(s => buildFrlEntry(s.id, 'S', s.description))
    return [...fEntries, ...sEntries]
  })

  const avgLevel = computed((): number => {
    const all = entries.value
    if (all.length === 0) return 0
    return Math.round(all.reduce((sum, e) => sum + e.level, 0) / all.length)
  })

  const overallStatus = computed((): 'Early' | 'Mid' | 'Advanced' => {
    const avg = avgLevel.value
    if (avg < 4) return 'Early'
    if (avg < 7) return 'Mid'
    return 'Advanced'
  })

  async function copyMarkdown(): Promise<void> {
    const lines: string[] = [
      '| ID | Type | Level | Description | Status |',
      '|---|---|---|---|---|',
    ]
    for (const e of entries.value) {
      lines.push(
        `| ${e.id} | ${e.entryType} | ${e.level} | ${e.description} | ${e.levelDescription} |`,
      )
    }
    await navigator.clipboard.writeText(lines.join('\n'))
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }

  return { open, entries, avgLevel, overallStatus, copyMarkdown, copied }
}
