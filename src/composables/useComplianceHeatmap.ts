// UNIT_TYPE=Composable
// Feature #76 — Spec compliance heatmap
import { ref, computed } from 'vue'
import type { Ref } from 'vue'
import type { SpecBlock, VEntry, FEntry, SEntry } from '../types/spec'

type AnyEntry = FEntry | VEntry | SEntry

const PLANGUAGE_RULES = [
  {
    id: 'R1',
    label: 'Scale defined',
    check: (e: AnyEntry) => e.type === 'Value' ? !!((e as VEntry).scale?.trim()) : true,
  },
  {
    id: 'R2',
    label: 'Meter defined',
    check: (e: AnyEntry) => e.type === 'Value' ? !!((e as VEntry).meter?.trim()) : true,
  },
  {
    id: 'R3',
    label: 'Goal set',
    check: (e: AnyEntry) => e.type === 'Value' ? !!((e as VEntry).goal?.trim()) : true,
  },
  {
    id: 'R4',
    label: 'Tolerable set',
    check: (e: AnyEntry) => e.type === 'Value' ? !!((e as VEntry).tolerable?.trim()) : true,
  },
  {
    id: 'R5',
    label: 'Status set',
    check: (e: AnyEntry) => e.type === 'Value' ? !!((e as VEntry).status?.trim()) : true,
  },
  {
    id: 'R6',
    label: 'Description present',
    check: (e: AnyEntry) => !!e.description?.trim(),
  },
  {
    id: 'R7',
    label: 'Scale has units',
    check: (e: AnyEntry) =>
      e.type === 'Value'
        ? /(%|hrs|ms|\/|usd|\$|pts|score|rate|count|num)/i.test((e as VEntry).scale ?? '')
        : true,
  },
  {
    id: 'R8',
    label: 'ID format valid',
    check: (e: AnyEntry) => /^[A-Za-z0-9._-]+$/.test(e.id ?? ''),
  },
]

export interface HeatmapRow {
  id: string
  type: 'Function' | 'Value' | 'Solution'
  checks: boolean[]
  passCount: number
  failCount: number
}

export function useComplianceHeatmap(spec: Ref<SpecBlock | null>) {
  const heatmapOpen = ref(false)
  const heatmapRows = ref<HeatmapRow[]>([])
  const rules = PLANGUAGE_RULES

  function computeHeatmap(): void {
    const currentSpec = spec.value
    if (!currentSpec) {
      heatmapRows.value = []
      return
    }

    const allEntries: AnyEntry[] = [
      ...currentSpec.functions,
      ...currentSpec.values,
      ...currentSpec.solutions,
    ]

    heatmapRows.value = allEntries.map((entry) => {
      const checks = rules.map(r => r.check(entry))
      const passCount = checks.filter(Boolean).length
      const failCount = checks.length - passCount
      return {
        id: entry.id,
        type: entry.type as 'Function' | 'Value' | 'Solution',
        checks,
        passCount,
        failCount,
      }
    })
  }

  const overallPass = computed((): number => {
    const rows = heatmapRows.value
    if (rows.length === 0) return 1
    const total = rows.length * rules.length
    const passing = rows.reduce((sum, r) => sum + r.passCount, 0)
    return passing / total
  })

  const totalViolations = computed((): number =>
    heatmapRows.value.reduce((a, r) => a + r.failCount, 0),
  )

  function copyHeatmap(): void {
    const header = `| ID | Type | ${rules.map(r => r.id).join(' | ')} | Pass |`
    const separator = `| --- | --- | ${rules.map(() => '---').join(' | ')} | --- |`
    const rows = heatmapRows.value.map(row => {
      const cells = row.checks.map(c => (c ? '✓' : '✗')).join(' | ')
      return `| ${row.id} | ${row.type} | ${cells} | ${row.passCount}/${rules.length} |`
    })
    const text = ['## Compliance Heatmap', '', header, separator, ...rows].join('\n')
    navigator.clipboard.writeText(text).catch(() => { /* no-op */ })
  }

  return {
    heatmapOpen,
    heatmapRows,
    rules,
    overallPass,
    totalViolations,
    computeHeatmap,
    copyHeatmap,
  }
}
