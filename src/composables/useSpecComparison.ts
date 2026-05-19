// UNIT_TYPE=Composable
// Feature #74 — Spec "What If" Scenario Comparison
import { ref, computed } from 'vue'
import type { DashboardEntry } from './useProjectDashboard'
import type { FEntry, VEntry, SEntry } from '../types/spec'

export interface EntryDiff {
  id: string
  type: 'F' | 'V' | 'S'
  onlyInA: boolean
  onlyInB: boolean
  fields: {
    fieldName: string
    valueA: string | null
    valueB: string | null
    changed: boolean
  }[]
}

export interface ComparisonResult {
  entryDiffs: EntryDiff[]
  entriesOnlyInA: number
  entriesOnlyInB: number
  sharedEntries: number
  changedEntries: number
  isIdentical: boolean
}

// Fields compared for each entry type
const F_FIELDS: (keyof FEntry)[] = ['description', 'presenceTest', 'functionOfValue', 'level']
const V_FIELDS: (keyof VEntry)[] = ['description', 'scale', 'meter', 'goal', 'tolerable', 'status', 'level', 'valueOfFunction']
const S_FIELDS: (keyof SEntry)[] = ['description', 'impact', 'function', 'level']

function buildEntryMap<T extends { id: string }>(entries: T[]): Map<string, T> {
  return new Map(entries.map(e => [e.id, e]))
}

function diffFields(
  entryA: Record<string, unknown> | undefined,
  entryB: Record<string, unknown> | undefined,
  fields: string[],
): EntryDiff['fields'] {
  return fields.map(fieldName => {
    const valueA = entryA ? String(entryA[fieldName] ?? '') || null : null
    const valueB = entryB ? String(entryB[fieldName] ?? '') || null : null
    return {
      fieldName,
      valueA: valueA === '' ? null : valueA,
      valueB: valueB === '' ? null : valueB,
      changed: valueA !== valueB,
    }
  })
}

export function useSpecComparison() {
  const selectedIds = ref<string[]>([])

  const canCompare = computed(() => selectedIds.value.length === 2)

  function toggleSelect(id: string): void {
    const idx = selectedIds.value.indexOf(id)
    if (idx !== -1) {
      // Already selected — deselect it
      selectedIds.value = selectedIds.value.filter(s => s !== id)
    } else if (selectedIds.value.length < 2) {
      selectedIds.value = [...selectedIds.value, id]
    } else {
      // Replace the second slot
      selectedIds.value = [selectedIds.value[0], id]
    }
  }

  function compareSpecs(specA: DashboardEntry, specB: DashboardEntry): ComparisonResult {
    const diffs: EntryDiff[] = []

    // --- Functions ---
    const fA = buildEntryMap(specA.spec.functions)
    const fB = buildEntryMap(specB.spec.functions)
    const fAllIds = new Set([...fA.keys(), ...fB.keys()])
    for (const id of fAllIds) {
      const a = fA.get(id) as Record<string, unknown> | undefined
      const b = fB.get(id) as Record<string, unknown> | undefined
      diffs.push({
        id,
        type: 'F',
        onlyInA: a !== undefined && b === undefined,
        onlyInB: a === undefined && b !== undefined,
        fields: diffFields(a, b, F_FIELDS as string[]),
      })
    }

    // --- Values ---
    const vA = buildEntryMap(specA.spec.values)
    const vB = buildEntryMap(specB.spec.values)
    const vAllIds = new Set([...vA.keys(), ...vB.keys()])
    for (const id of vAllIds) {
      const a = vA.get(id) as Record<string, unknown> | undefined
      const b = vB.get(id) as Record<string, unknown> | undefined
      diffs.push({
        id,
        type: 'V',
        onlyInA: a !== undefined && b === undefined,
        onlyInB: a === undefined && b !== undefined,
        fields: diffFields(a, b, V_FIELDS as string[]),
      })
    }

    // --- Solutions ---
    const sA = buildEntryMap(specA.spec.solutions)
    const sB = buildEntryMap(specB.spec.solutions)
    const sAllIds = new Set([...sA.keys(), ...sB.keys()])
    for (const id of sAllIds) {
      const a = sA.get(id) as Record<string, unknown> | undefined
      const b = sB.get(id) as Record<string, unknown> | undefined
      diffs.push({
        id,
        type: 'S',
        onlyInA: a !== undefined && b === undefined,
        onlyInB: a === undefined && b !== undefined,
        fields: diffFields(a, b, S_FIELDS as string[]),
      })
    }

    const entriesOnlyInA = diffs.filter(d => d.onlyInA).length
    const entriesOnlyInB = diffs.filter(d => d.onlyInB).length
    const sharedEntries = diffs.filter(d => !d.onlyInA && !d.onlyInB).length
    const changedEntries = diffs.filter(
      d => !d.onlyInA && !d.onlyInB && d.fields.some(f => f.changed),
    ).length

    return {
      entryDiffs: diffs,
      entriesOnlyInA,
      entriesOnlyInB,
      sharedEntries,
      changedEntries,
      isIdentical: entriesOnlyInA === 0 && entriesOnlyInB === 0 && changedEntries === 0,
    }
  }

  function copyComparisonTable(
    result: ComparisonResult,
    nameA: string,
    nameB: string,
  ): void {
    const rows: string[] = [
      `| ID | Field | ${nameA} | ${nameB} | Status |`,
      '| --- | --- | --- | --- | --- |',
    ]

    for (const diff of result.entryDiffs) {
      if (diff.onlyInA) {
        rows.push(`| ${diff.id} | (all) | (present) | — | ← Only in A |`)
        continue
      }
      if (diff.onlyInB) {
        rows.push(`| ${diff.id} | (all) | — | (present) | → Only in B |`)
        continue
      }
      for (const f of diff.fields) {
        const status = f.changed ? '≠ Changed' : '= Same'
        const a = f.valueA ?? '—'
        const b = f.valueB ?? '—'
        rows.push(`| ${diff.id} | ${f.fieldName} | ${a} | ${b} | ${status} |`)
      }
    }

    const text = rows.join('\n')
    navigator.clipboard.writeText(text).catch(() => {
      // Fallback: create a temporary textarea
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    })
  }

  return { selectedIds, canCompare, toggleSelect, compareSpecs, copyComparisonTable }
}
