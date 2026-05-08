// UNIT_TYPE=Composable
// Feature #145 — Evo step daily standup generator

import { ref } from 'vue'
import type { Ref } from 'vue'

export interface StandupEntry {
  stepId: string
  stepName: string
  yesterday: string
  today: string
  blockers: string
  isOpen: boolean
}

const YESTERDAY_BANK: string[] = [
  'Completed initial implementation',
  'Reviewed PR and addressed feedback',
  'Wrote unit tests for core logic',
  'Debugged integration issues',
  'Paired with teammate on design',
  'Refined acceptance criteria',
  'Updated documentation',
  'Ran spike on technical approach',
]

const TODAY_BANK: string[] = [
  'Continue implementation of main feature',
  'Address code review comments',
  'Write integration tests',
  'Refactor for clarity',
  'Sync with stakeholders',
  'Complete remaining tasks',
  'Begin next sub-task',
  'Investigate blocking issue',
]

const BLOCKERS_BANK: string[] = [
  'None currently',
  'Waiting on API access',
  'Need design clarification',
  'Blocked by dependency',
  'Awaiting stakeholder sign-off',
  'Environment setup issue',
]

function charCodeSum(s: string): number {
  let sum = 0
  for (let i = 0; i < s.length; i++) {
    sum += s.charCodeAt(i)
  }
  return sum
}

export function useStandupGenerator(steps: Ref<{ id: string; name: string; effort?: number }[]>) {
  const standupMap = ref<Record<string, StandupEntry>>({})
  const standupCopied = ref<string | null>(null)

  function generate(stepId: string): void {
    const step = steps.value.find((s) => s.id === stepId)
    if (!step) return

    const seed = charCodeSum(step.id + step.name)
    const yesterday = YESTERDAY_BANK[seed % YESTERDAY_BANK.length]
    const today = TODAY_BANK[(seed + 1) % TODAY_BANK.length]
    const blockers = BLOCKERS_BANK[(seed + 2) % BLOCKERS_BANK.length]

    standupMap.value[stepId] = {
      stepId,
      stepName: step.name,
      yesterday,
      today,
      blockers,
      isOpen: standupMap.value[stepId]?.isOpen ?? false,
    }
  }

  function generateAll(): void {
    for (const step of steps.value) {
      generate(step.id)
    }
  }

  function toggleOpen(stepId: string): void {
    if (!standupMap.value[stepId]) {
      // entry may not exist yet — create a placeholder then generate
      generate(stepId)
    }
    standupMap.value[stepId].isOpen = !standupMap.value[stepId].isOpen
  }

  function copyStandup(stepId: string): void {
    const entry = standupMap.value[stepId]
    if (!entry) return

    const markdown = [
      `## Standup — ${entry.stepName}`,
      `**Yesterday:** ${entry.yesterday}`,
      `**Today:** ${entry.today}`,
      `**Blockers:** ${entry.blockers}`,
    ].join('\n')

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(markdown).catch(() => {/* silent */})
    }

    standupCopied.value = stepId
    setTimeout(() => {
      standupCopied.value = null
    }, 2000)
  }

  return {
    standupMap,
    standupCopied,
    generate,
    generateAll,
    toggleOpen,
    copyStandup,
  }
}
