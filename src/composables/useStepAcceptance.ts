// UNIT_TYPE=Composable
// Feature #140 — Acceptance Test Generator (per step)
import { ref } from 'vue'

export interface GherkinScenario {
  title: string
  given: string
  when: string
  then: string
}

const givenBank: string[] = [
  'a user with appropriate permissions',
  'the system is in a valid initial state',
  'all prerequisite steps are complete',
]

const whenBank: string[] = [
  'the step is executed as planned',
  'the implementation is deployed',
  'the feature is activated',
]

const thenBank: string[] = [
  'the expected outcome is achieved',
  'all acceptance criteria are met',
  'the value goal advances by the specified measure',
]

const titleBank: string[] = [
  'Happy path',
  'Edge case: boundary conditions',
  'Regression: prior state preserved',
]

export function useStepAcceptance(apiKey: string) {
  const acceptanceMap = ref<Record<string, { scenarios: GherkinScenario[]; open: boolean; loading: boolean }>>({})
  const acceptanceCopied = ref<Record<string, boolean>>({})

  async function generate(step: { id: string; name: string; description?: string }): Promise<void> {
    if (!acceptanceMap.value[step.id]) {
      acceptanceMap.value[step.id] = { scenarios: [], open: false, loading: false }
    }
    acceptanceMap.value[step.id].loading = true

    const seed = step.name.split('').reduce((a, c) => a + c.charCodeAt(0), 0)

    const scenarios: GherkinScenario[] = [0, 1, 2].map((i) => ({
      title: titleBank[i],
      given: givenBank[(seed + i) % 3],
      when: whenBank[(seed + i + 1) % 3],
      then: thenBank[(seed + i + 2) % 3],
    }))

    acceptanceMap.value[step.id].scenarios = scenarios
    acceptanceMap.value[step.id].loading = false
  }

  function toggleOpen(stepId: string): void {
    const entry = acceptanceMap.value[stepId]
    if (!entry) return
    entry.open = !entry.open
  }

  function copyAcceptance(stepId: string): void {
    const entry = acceptanceMap.value[stepId]
    if (!entry) return

    const lines: string[] = []
    for (const sc of entry.scenarios) {
      lines.push(`Scenario: ${sc.title}`)
      lines.push(`  Given ${sc.given}`)
      lines.push(`  When ${sc.when}`)
      lines.push(`  Then ${sc.then}`)
      lines.push('')
    }

    const text = lines.join('\n').trimEnd()

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {/* silent */})
    }

    acceptanceCopied.value[stepId] = true
    setTimeout(() => {
      acceptanceCopied.value[stepId] = false
    }, 2000)
  }

  return { acceptanceMap, acceptanceCopied, generate, toggleOpen, copyAcceptance }
}
