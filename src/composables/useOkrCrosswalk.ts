// UNIT_TYPE=Composable
// useOkrCrosswalk — Spec vs OKR crosswalk
// Feature #102 — OKR Crosswalk

import { ref } from 'vue'
import type { Ref } from 'vue'
import type { SpecBlock, FEntry, VEntry } from '../types/spec'

interface OkrKeyResult {
  id: string        // V. entry id
  keyResult: string // "KR[n]: " + scale + " from " + status + " to " + goal
  current: string   // status value or "TBD"
  target: string    // goal value or "TBD"
}

interface OkrObjective {
  id: string             // F. entry id
  objective: string      // "O1: " + description (first 80 chars)
  keyResults: OkrKeyResult[]
}

function keywordsFrom(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/\W+/)
      .filter(w => w.length > 3),
  )
}

function hasKeywordOverlap(a: string, b: string): boolean {
  const aWords = keywordsFrom(a)
  const bWords = keywordsFrom(b)
  for (const w of aWords) {
    if (bWords.has(w)) return true
  }
  return false
}

function buildKeyResult(v: VEntry, index: number): OkrKeyResult {
  const scale = v.scale.trim() || v.description.slice(0, 60)
  const current = v.status.trim() || 'TBD'
  const target = v.goal.trim() || 'TBD'
  return {
    id: v.id,
    keyResult: `KR${index + 1}: ${scale} from ${current} to ${target}`,
    current,
    target,
  }
}

export function useOkrCrosswalk(spec: Ref<SpecBlock | null>) {
  const okrOpen = ref(false)
  const objectives = ref<OkrObjective[]>([])

  function buildOkrCrosswalk(): void {
    if (!spec.value) {
      objectives.value = [
        {
          id: 'O-generic',
          objective: 'O1: Deliver the specified value outcomes',
          keyResults: [],
        },
      ]
      return
    }

    const { functions, values } = spec.value

    // No F. entries → one generic objective with all V. entries as KRs
    if (functions.length === 0) {
      objectives.value = [
        {
          id: 'O-generic',
          objective: 'O1: Deliver the specified value outcomes',
          keyResults: values.map((v, i) => buildKeyResult(v, i)),
        },
      ]
      return
    }

    // Build one objective per F. entry
    // Attempt heuristic keyword matching for V. entries
    const unmatched: VEntry[] = [...values]

    const result: OkrObjective[] = functions.map((f, fIdx) => {
      const matched: VEntry[] = []
      const remaining: VEntry[] = []

      for (const v of unmatched) {
        if (
          hasKeywordOverlap(f.description, v.description) ||
          (f.functionOfValue ?? '').includes(v.id) ||
          (v.valueOfFunction ?? '').includes(f.id)
        ) {
          matched.push(v)
        } else {
          remaining.push(v)
        }
      }

      // Put unmatched back (will be allocated to first objective below)
      unmatched.length = 0
      unmatched.push(...remaining)

      return {
        id: f.id,
        objective: `O${fIdx + 1}: ${f.description.slice(0, 80)}`,
        keyResults: matched.map((v, i) => buildKeyResult(v, i)),
      }
    })

    // Assign any unmatched V. entries to the first objective
    if (unmatched.length > 0 && result.length > 0) {
      const existingKrCount = result[0].keyResults.length
      result[0].keyResults.push(
        ...unmatched.map((v, i) => buildKeyResult(v, existingKrCount + i)),
      )
    }

    objectives.value = result
  }

  async function copyOkrTable(): Promise<void> {
    const lines: string[] = ['## OKR Crosswalk', '']

    for (const obj of objectives.value) {
      lines.push(`### ${obj.objective}`)
      for (const kr of obj.keyResults) {
        lines.push(`- ${kr.keyResult}`)
        lines.push(`  Current: ${kr.current} → Target: ${kr.target}`)
      }
      lines.push('')
    }

    try {
      await navigator.clipboard.writeText(lines.join('\n'))
    } catch {
      // clipboard not available in test / SSR environment
    }
  }

  return { okrOpen, objectives, buildOkrCrosswalk, copyOkrTable }
}
