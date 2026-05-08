// UNIT_TYPE=Composable
// Feature #145 — Evo step daily standup generator
import { ref } from 'vue'

export interface StandupScript {
  stepId: string
  stepName: string
  yesterday: string
  today: string
  blockers: string
  open: boolean
}

const yesterdayBank: string[] = [
  'Completed initial scoping and requirements review',
  'Finished design and wireframe approval',
  'Delivered first working prototype',
  'Resolved blocking dependencies from upstream',
  'Completed code review feedback and revisions',
  'Shipped integration tests for core path',
  'Finalised documentation and handoff notes',
  'Ran end-to-end validation with stakeholders',
]

const todayBank: string[] = [
  'Implement the core logic and write unit tests',
  'Integrate with dependent services',
  'Complete the UI component and wire up state',
  'Review pull request and address feedback',
  'Deploy to staging and run smoke tests',
  'Pair with a teammate on the hardest task',
  'Fix identified issues from yesterday\'s review',
  'Prepare demo and update progress notes',
]

const blockerBank: string[] = [
  'None identified',
  'Waiting for API credentials to be provisioned',
  'Dependency not yet available in environment',
  'Unclear acceptance criteria — needs clarification',
  'Code review pending from another team member',
  'Infrastructure access required before proceeding',
]

export function useStepStandup() {
  const standupMap = ref<Record<string, StandupScript>>({})

  function generateStandup(step: { id: string; name: string }): void {
    const seed = step.name.split('').reduce((a, c) => a + c.charCodeAt(0), 0)

    standupMap.value[step.id] = {
      stepId: step.id,
      stepName: step.name,
      yesterday: yesterdayBank[seed % 8],
      today: todayBank[(seed + 1) % 8],
      blockers: blockerBank[(seed + 2) % 6],
      open: standupMap.value[step.id]?.open ?? false,
    }
  }

  function toggleOpen(stepId: string): void {
    const entry = standupMap.value[stepId]
    if (!entry) return
    entry.open = !entry.open
  }

  function copyStandup(stepId: string): void {
    const entry = standupMap.value[stepId]
    if (!entry) return

    const text = [
      `📢 Daily Standup — ${entry.stepName}`,
      '',
      `**Yesterday:** ${entry.yesterday}`,
      `**Today:** ${entry.today}`,
      `**Blockers:** ${entry.blockers}`,
    ].join('\n')

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {/* silent */})
    }
  }

  return { standupMap, generateStandup, toggleOpen, copyStandup }
}
