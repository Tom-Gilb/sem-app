// UNIT_TYPE=Composable
// Feature #121 — Evo step pair programming prompt composable
import { ref } from 'vue'

export interface PomodoroBlock {
  blockNumber: number   // 1, 2, 3…
  role: 'driver' | 'navigator'
  focus: string         // what to work on in this 25-min block
}

export interface PairPlan {
  stepId: string
  stepName: string
  contextBrief: string  // 1-sentence context summary
  blocks: PomodoroBlock[]  // 4 blocks (2 × 25min driver/navigator swaps)
  swapNote: string       // "Swap roles after block 2"
  open: boolean
}

const focusBankA: string[] = [
  'Write the core logic and unit tests',
  'Implement the primary data flow',
  'Build the main UI component',
  'Set up the integration points',
  'Write the happy-path implementation',
]

const focusBankB: string[] = [
  'Review edge cases and suggest improvements',
  "Look ahead to the next block's requirements",
  'Check for code smells and refactoring opportunities',
  'Verify test coverage and missing scenarios',
  'Document decisions and update comments',
]

export function useStepPair() {
  const pairMap = ref<Record<string, PairPlan>>({})

  function generatePlan(step: { id: string; name: string; description?: string }): void {
    const seed = step.name.split('').reduce((a, c) => a + c.charCodeAt(0), 0)

    const existing = pairMap.value[step.id]
    const wasOpen = existing?.open ?? false

    const blocks: PomodoroBlock[] = [
      {
        blockNumber: 1,
        role: 'driver',
        focus: focusBankA[seed % focusBankA.length],
      },
      {
        blockNumber: 2,
        role: 'navigator',
        focus: focusBankB[(seed + 1) % focusBankB.length],
      },
      {
        blockNumber: 3,
        role: 'driver',
        focus: focusBankA[(seed + 2) % focusBankA.length],
      },
      {
        blockNumber: 4,
        role: 'navigator',
        focus: focusBankB[(seed + 3) % focusBankB.length],
      },
    ]

    pairMap.value[step.id] = {
      stepId: step.id,
      stepName: step.name,
      contextBrief: `Implement ${step.name} — focus on delivering the core requirement first.`,
      blocks,
      swapNote: 'Swap driver/navigator roles after Block 2',
      open: wasOpen,
    }
  }

  function toggleOpen(stepId: string): void {
    const plan = pairMap.value[stepId]
    if (!plan) return
    plan.open = !plan.open
  }

  function copyPlan(stepId: string): void {
    const plan = pairMap.value[stepId]
    if (!plan) return

    const lines: string[] = [
      `## Pair Session — ${plan.stepName}`,
      `Context: ${plan.contextBrief}`,
    ]

    for (const block of plan.blocks) {
      const roleLabel = block.role === 'driver' ? 'Driver' : 'Navigator'
      lines.push(`Block ${block.blockNumber} (25 min) — ${roleLabel}: ${block.focus}`)
      if (block.blockNumber === 2) {
        lines.push(plan.swapNote)
      }
    }

    const text = lines.join('\n')

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {/* silent */})
    }
  }

  return { pairMap, generatePlan, toggleOpen, copyPlan }
}
