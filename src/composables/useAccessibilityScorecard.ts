// UNIT_TYPE=Composable
// Feature #177 — Spec accessibility scorecard
// NOTE: Feature #38 is useAccessibilityChecker.ts — a DIFFERENT composable.
// This composable provides a per-entry scorecard with 6 criteria.
import { ref, computed } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface ScorecardCriterion {
  key: string
  label: string
  description: string
  passCount: number
  failCount: number
  passRate: number
}

export interface ScorecardEntry {
  id: string
  entryType: 'F' | 'V' | 'S'
  description: string
  criteria: {
    plainLanguage: boolean
    numericGoal: boolean
    stakeholderCoverage: boolean
    noPassiveVoice: boolean
    unitsPresent: boolean
    descLength: boolean
  }
  totalScore: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
}

const UNIT_KEYWORDS = ['%', 'hrs', '$', 'ms', 'score', 'rate', 'pts', 'days']
const PASSIVE_VOICE_RE = /\b(is|was|were|be|been|being)\s+\w+ed\b/i

function gradeFromScorecardScore(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 5) return 'A'
  if (score >= 4) return 'B'
  if (score >= 3) return 'C'
  if (score >= 2) return 'D'
  return 'F'
}

function checkPlainLanguage(description: string): boolean {
  return !description.split(/\s+/).some(w => w.replace(/[^a-zA-Z]/g, '').length > 12)
}

function checkUnitsPresent(scale: string, entryType: 'F' | 'V' | 'S'): boolean {
  if (entryType !== 'V') return true
  return UNIT_KEYWORDS.some(u => scale.includes(u))
}

export function buildScorecardEntry(
  id: string,
  entryType: 'F' | 'V' | 'S',
  description: string,
  scale: string,
  goal: string,
  valueOfFunction: string,
  functionOfValue: string,
  functionField: string,
): ScorecardEntry {
  const plainLanguage = checkPlainLanguage(description)

  const numericGoal = entryType === 'V' ? /\d/.test(goal) : true

  let stakeholderCoverage: boolean
  if (entryType === 'V') {
    stakeholderCoverage = valueOfFunction.trim().length > 0
  } else if (entryType === 'F') {
    stakeholderCoverage = functionOfValue.trim().length > 0
  } else {
    stakeholderCoverage = functionField.trim().length > 0
  }

  const noPassiveVoice = !PASSIVE_VOICE_RE.test(description)

  const unitsPresent = checkUnitsPresent(scale, entryType)

  const descLength = description.length >= 20 && description.length <= 200

  const criteria = {
    plainLanguage,
    numericGoal,
    stakeholderCoverage,
    noPassiveVoice,
    unitsPresent,
    descLength,
  }

  const totalScore = Object.values(criteria).filter(Boolean).length
  const grade = gradeFromScorecardScore(totalScore)

  return {
    id,
    entryType,
    description,
    criteria,
    totalScore,
    grade,
  }
}

const CRITERION_META: Array<{ key: keyof ScorecardEntry['criteria']; label: string; description: string }> = [
  { key: 'plainLanguage', label: 'Plain Language', description: 'No words longer than 12 characters' },
  { key: 'numericGoal', label: 'Numeric Goal', description: 'Goal contains a digit (Value entries only)' },
  { key: 'stakeholderCoverage', label: 'Stakeholder Coverage', description: 'Linked to a function or value entry' },
  { key: 'noPassiveVoice', label: 'No Passive Voice', description: 'Description avoids passive constructions' },
  { key: 'unitsPresent', label: 'Units Present', description: 'Scale contains a recognisable unit (Value entries only)' },
  { key: 'descLength', label: 'Desc Length', description: 'Description is between 20 and 200 characters' },
]

export function useAccessibilityScorecard(blocks: SpecBlock[]) {
  const open = ref(false)
  const copied = ref(false)

  const entries = computed((): ScorecardEntry[] => {
    if (blocks.length === 0) return []
    const result: ScorecardEntry[] = []

    for (const b of blocks) {
      for (const f of b.functions) {
        result.push(buildScorecardEntry(f.id, 'F', f.description, '', '', '', f.functionOfValue, ''))
      }
      for (const v of b.values) {
        result.push(buildScorecardEntry(v.id, 'V', v.description, v.scale, v.goal, v.valueOfFunction, '', ''))
      }
      for (const s of b.solutions) {
        result.push(buildScorecardEntry(s.id, 'S', s.description, '', '', '', '', s.function))
      }
    }
    return result
  })

  const criteria = computed((): ScorecardCriterion[] => {
    const all = entries.value
    return CRITERION_META.map(meta => {
      const passCount = all.filter(e => e.criteria[meta.key]).length
      const failCount = all.length - passCount
      const passRate = all.length === 0 ? 0 : Math.round((passCount / all.length) * 100)
      return {
        key: meta.key,
        label: meta.label,
        description: meta.description,
        passCount,
        failCount,
        passRate,
      }
    })
  })

  const overallScore = computed((): number => {
    const all = entries.value
    if (all.length === 0) return 0
    return Math.round(all.reduce((sum, e) => sum + e.totalScore, 0) / all.length)
  })

  const overallGrade = computed((): string => gradeFromScorecardScore(overallScore.value))

  async function copyMarkdown(): Promise<void> {
    const lines: string[] = [
      '| ID | Type | Plain | Numeric Goal | Stakeholder | No Passive | Units | Desc Length | Score | Grade |',
      '|---|---|---|---|---|---|---|---|---|---|',
    ]
    for (const e of entries.value) {
      const c = e.criteria
      lines.push(
        `| ${e.id} | ${e.entryType} | ${c.plainLanguage ? '✅' : '❌'} | ${c.numericGoal ? '✅' : '❌'} | ${c.stakeholderCoverage ? '✅' : '❌'} | ${c.noPassiveVoice ? '✅' : '❌'} | ${c.unitsPresent ? '✅' : '❌'} | ${c.descLength ? '✅' : '❌'} | ${e.totalScore} | ${e.grade} |`,
      )
    }
    await navigator.clipboard.writeText(lines.join('\n'))
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }

  return { open, entries, criteria, overallGrade, overallScore, copyMarkdown, copied }
}
