// UNIT_TYPE=Composable
// Feature #170 — Spec "value chain" visualiser
// Porter-style SVG layout: primary activities (F.) at bottom, support activities (S.) at top.
// V. entries shown as circles assigned to primary activities.
import { ref, computed } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface VcActivity {
  id: string
  label: string
  actType: 'primary' | 'support'
  description: string
  outcomeSummary: string
}

export function useValueChain(blocks: SpecBlock[]) {
  const open = ref(false)
  const copied = ref(false)
  const selectedId = ref<string | null>(null)

  const primaryActivities = computed((): VcActivity[] => {
    return blocks.flatMap(b => b.functions).slice(0, 6).map(f => ({
      id: f.id,
      label: f.id,
      actType: 'primary' as const,
      description: f.description.slice(0, 60),
      outcomeSummary: f.description.slice(0, 40),
    }))
  })

  const supportActivities = computed((): VcActivity[] => {
    return blocks.flatMap(b => b.solutions).slice(0, 4).map(s => {
      const linkedV = blocks.flatMap(b => b.values).find(v =>
        s.impact.includes(v.id),
      )
      return {
        id: s.id,
        label: s.id,
        actType: 'support' as const,
        description: s.description.slice(0, 60),
        outcomeSummary: linkedV ? linkedV.goal.slice(0, 40) : s.description.slice(0, 40),
      }
    })
  })

  function select(id: string): void {
    selectedId.value = selectedId.value === id ? null : id
  }

  async function copyMarkdown(): Promise<void> {
    const rows: string[] = [
      '| Type | ID | Description | Outcome |',
      '|---|---|---|---|',
    ]
    for (const a of primaryActivities.value) {
      rows.push(`| Primary | ${a.id} | ${a.description} | ${a.outcomeSummary} |`)
    }
    for (const a of supportActivities.value) {
      rows.push(`| Support | ${a.id} | ${a.description} | ${a.outcomeSummary} |`)
    }
    await navigator.clipboard.writeText(rows.join('\n'))
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }

  return {
    open,
    primaryActivities,
    supportActivities,
    selectedId,
    select,
    copyMarkdown,
    copied,
  }
}
