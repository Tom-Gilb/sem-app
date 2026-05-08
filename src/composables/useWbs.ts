// UNIT_TYPE=Composable
// Feature #172 — Spec "WBS" (work breakdown structure)
// Per F. entry: 3 sub-tasks, each with exactly 2 micro-tasks. All seeded deterministically.
import { ref, computed } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface WbsSubTask {
  label: string
  microTasks: [string, string]
}

export interface WbsNode {
  fId: string
  fLabel: string
  subTasks: [WbsSubTask, WbsSubTask, WbsSubTask]
}

const SUB_TASK_POOL = [
  'Design interface',
  'Write unit tests',
  'Implement core logic',
  'Review with stakeholders',
  'Document API',
  'Validate edge cases',
  'Deploy to staging',
  'Gather feedback',
]

const MICRO_TASK_POOL = [
  'Draft wireframe',
  'Code scaffold',
  'Write test cases',
  'Peer review',
  'Update docs',
  'CI/CD check',
  'User acceptance',
  'Post-deploy monitor',
]

export function seed(s: string, mod: number): number {
  return s.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % mod
}

export function buildWbsNode(fId: string, fDescription: string): WbsNode {
  const subTasks = ([0, 1, 2] as const).map(pos => {
    const subIdx = seed(fId + String(pos), 8)
    const micro0Idx = seed(fId + String(pos) + '0', 8)
    const micro1Idx = seed(fId + String(pos) + '1', 8)
    return {
      label: SUB_TASK_POOL[subIdx],
      microTasks: [
        MICRO_TASK_POOL[micro0Idx],
        MICRO_TASK_POOL[micro1Idx],
      ] as [string, string],
    }
  }) as [WbsSubTask, WbsSubTask, WbsSubTask]

  return {
    fId,
    fLabel: fDescription.slice(0, 60),
    subTasks,
  }
}

export function useWbs(blocks: SpecBlock[]) {
  const open = ref(false)
  const copied = ref(false)
  const expandedIds = ref<Set<string>>(new Set())

  const nodes = computed((): WbsNode[] => {
    return blocks.flatMap(b => b.functions).map(f =>
      buildWbsNode(f.id, f.description),
    )
  })

  function toggleExpand(fId: string): void {
    const s = new Set(expandedIds.value)
    if (s.has(fId)) {
      s.delete(fId)
    } else {
      s.add(fId)
    }
    expandedIds.value = s
  }

  async function copyMarkdown(): Promise<void> {
    const lines: string[] = []
    for (const node of nodes.value) {
      lines.push(`## WBS: ${node.fId}`)
      for (const sub of node.subTasks) {
        lines.push(`  - ${sub.label}`)
        for (const micro of sub.microTasks) {
          lines.push(`    - ${micro}`)
        }
      }
      lines.push('')
    }
    await navigator.clipboard.writeText(lines.join('\n'))
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }

  return { open, nodes, expandedIds, toggleExpand, copyMarkdown, copied }
}
