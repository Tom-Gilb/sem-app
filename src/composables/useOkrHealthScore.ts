// UNIT_TYPE=Composable
// Feature #174 — Spec "OKR health score"
// Scores each V. entry against Measurability, Ambition, and Coverage.
import { ref, computed } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface OkrHealthEntry {
  id: string
  objective: string
  keyResult: string
  measurability: boolean
  ambition: boolean
  coverage: boolean
  score: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
}

function seed(s: string, mod: number): number {
  return s.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % mod
}

function gradeFromScore(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A'
  if (score >= 75) return 'B'
  if (score >= 60) return 'C'
  if (score >= 40) return 'D'
  return 'F'
}

function extractFirstNumber(s: string): number | null {
  const m = s.match(/(\d+(?:\.\d+)?)/)
  return m ? parseFloat(m[1]) : null
}

export function buildOkrHealthEntry(
  id: string,
  objective: string,
  keyResult: string,
  goal: string,
  tolerable: string,
  valueOfFunction: string,
): OkrHealthEntry {
  const measurability = /\d/.test(goal)

  let ambition: boolean
  const goalNum = extractFirstNumber(goal)
  const tolerableNum = extractFirstNumber(tolerable)
  if (goalNum !== null && tolerableNum !== null) {
    ambition = goalNum > tolerableNum
  } else {
    ambition = seed(id + 'amb', 2) === 1
  }

  const coverage = valueOfFunction.trim().length > 0

  const score = (measurability ? 33 : 0) + (ambition ? 33 : 0) + (coverage ? 34 : 0)
  const grade = gradeFromScore(score)

  return {
    id,
    objective,
    keyResult: keyResult.trim() || 'No goal defined',
    measurability,
    ambition,
    coverage,
    score,
    grade,
  }
}

export function useOkrHealthScore(blocks: SpecBlock[]) {
  const open = ref(false)
  const copied = ref(false)

  const entries = computed((): OkrHealthEntry[] => {
    if (blocks.length === 0) return []
    const functions = blocks.flatMap(b => b.functions)
    const values = blocks.flatMap(b => b.values)
    return values.map(v => {
      // Find linked F. entry via valueOfFunction field
      const linkedF = functions.find(f => (v.valueOfFunction ?? '').includes(f.id))
      const objective = linkedF
        ? linkedF.description.slice(0, 80)
        : v.description.slice(0, 80)
      return buildOkrHealthEntry(v.id, objective, v.goal, v.goal, v.tolerable, v.valueOfFunction)
    })
  })

  const overallScore = computed((): number => {
    const all = entries.value
    if (all.length === 0) return 0
    return Math.round(all.reduce((sum, e) => sum + e.score, 0) / all.length)
  })

  const overallGrade = computed((): string => gradeFromScore(overallScore.value))

  async function copyMarkdown(): Promise<void> {
    const lines: string[] = [
      '| ID | Key Result | Measurable | Ambitious | Covered | Score | Grade |',
      '|---|---|---|---|---|---|---|',
    ]
    for (const e of entries.value) {
      lines.push(
        `| ${e.id} | ${e.keyResult} | ${e.measurability ? '✅' : '❌'} | ${e.ambition ? '✅' : '❌'} | ${e.coverage ? '✅' : '❌'} | ${e.score} | ${e.grade} |`,
      )
    }
    await navigator.clipboard.writeText(lines.join('\n'))
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }

  return { open, entries, overallScore, overallGrade, copyMarkdown, copied }
}
