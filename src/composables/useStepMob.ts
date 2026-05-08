// UNIT_TYPE=Composable
// Feature #135 — Evo step mob programming planner
import { ref } from 'vue'

export interface MobRotation {
  rotationNumber: number  // 1, 2, 3, 4
  driver: string          // "Driver (10 min)"
  focus: string           // what to work on
}

export interface MobPlan {
  stepId: string
  stepName: string
  sessionGoal: string   // 1-sentence goal for the mob session
  teamSize: number      // default 3 (1 driver + 2 observers)
  rotations: MobRotation[]  // 4 rotations
  rotationMinutes: number   // 10 min per rotation
  totalMinutes: number      // teamSize * rotationMinutes * rotations.length / teamSize ≈ 40 min
  open: boolean
}

const focusBankMob: string[] = [
  'Set up the problem context and skeleton',
  'Implement the core logic',
  'Write or review unit tests',
  'Refactor for clarity and readability',
  'Handle edge cases and error states',
  'Integrate with adjacent components',
  'Review and discuss design decisions',
  'Document the approach inline',
]

export function useStepMob() {
  const mobMap = ref<Record<string, MobPlan>>({})

  function generateMob(step: { id: string; name: string; description?: string }): void {
    const seed = step.name.split('').reduce((a, c) => a + c.charCodeAt(0), 0)

    const existing = mobMap.value[step.id]
    const wasOpen = existing?.open ?? false

    const rotations: MobRotation[] = [1, 2, 3, 4].map((rotationNumber, rotationIndex) => ({
      rotationNumber,
      driver: 'Driver (10 min)',
      focus: focusBankMob[(seed + rotationIndex) % focusBankMob.length],
    }))

    mobMap.value[step.id] = {
      stepId: step.id,
      stepName: step.name,
      sessionGoal: `Complete ${step.name} as a mob — driver rotates every 10 minutes.`,
      teamSize: 3,
      rotations,
      rotationMinutes: 10,
      totalMinutes: 40,
      open: wasOpen,
    }
  }

  function toggleOpen(stepId: string): void {
    const plan = mobMap.value[stepId]
    if (!plan) return
    plan.open = !plan.open
  }

  function copyMob(stepId: string): void {
    const plan = mobMap.value[stepId]
    if (!plan) return

    const lines: string[] = [
      `## Mob Session — ${plan.stepName}`,
      `Goal: ${plan.sessionGoal}`,
      `Team size: ${plan.teamSize} | Rotation: ${plan.rotationMinutes} min | Total: ${plan.totalMinutes} min`,
      '',
    ]

    for (const r of plan.rotations) {
      lines.push(`Rotation ${r.rotationNumber} — Driver: ${r.focus}`)
    }

    const text = lines.join('\n')

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {/* silent */})
    }
  }

  return { mobMap, generateMob, toggleOpen, copyMob }
}
