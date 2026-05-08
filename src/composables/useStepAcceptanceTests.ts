// UNIT_TYPE=Composable
// Feature #140 — Evo step acceptance test generator
import { ref } from 'vue'

export interface GherkinScenario {
  title: string
  given: string
  when: string
  then: string
}

export interface StepAcceptanceTests {
  stepId: string
  scenarios: GherkinScenario[]   // 3 scenarios
  open: boolean
}

const givenBank: string[] = [
  'the system is in a clean initial state',
  'a user has valid credentials and access',
  'the required data is available and correctly formatted',
  'all dependencies are resolved and unblocked',
  'the environment matches the target configuration',
  'the previous Evo step has been completed successfully',
  'the acceptance criteria have been reviewed and agreed',
  'the team has allocated sufficient time and resources',
]

const whenBank: string[] = [
  'the implementation is deployed',
  'the feature is executed end-to-end',
  'the test suite runs against the deliverable',
  'a stakeholder reviews the output',
  'the integration point is exercised',
  'the edge case is triggered',
  'the performance test is run',
  'the user acceptance test session is conducted',
]

const thenBank: string[] = [
  'the output meets the defined acceptance criteria',
  'all unit and integration tests pass',
  'no regressions are introduced',
  'the measurable goal shows progress toward target',
  'the deliverable is approved by the responsible stakeholder',
  'the documentation reflects the current implementation',
  'the exit gate is cleared and the step is marked complete',
  'the value indicator moves closer to Goal',
]

export function useStepAcceptanceTests() {
  const testMap = ref<Record<string, StepAcceptanceTests>>({})

  function generateTests(step: { id: string; name: string }): void {
    const seed = step.name.split('').reduce((a, c) => a + c.charCodeAt(0), 0)

    const scenarios: GherkinScenario[] = []
    for (let i = 0; i < 3; i++) {
      const whenText = whenBank[(seed + i * 3) % 8]
      scenarios.push({
        title: `Scenario ${i + 1}: ${step.name} — ${whenText.slice(0, 30)}`,
        given: givenBank[(seed + i) % 8],
        when: whenBank[(seed + i + 1) % 8],
        then: thenBank[(seed + i + 2) % 8],
      })
    }

    testMap.value[step.id] = {
      stepId: step.id,
      scenarios,
      open: testMap.value[step.id]?.open ?? false,
    }
  }

  function toggleOpen(stepId: string): void {
    const entry = testMap.value[stepId]
    if (!entry) return
    entry.open = !entry.open
  }

  function copyTests(stepId: string): void {
    const entry = testMap.value[stepId]
    if (!entry) return

    const lines: string[] = [`## Acceptance Tests — ${stepId}`, '']

    for (const s of entry.scenarios) {
      lines.push(`**${s.title}**`)
      lines.push(`- Given: ${s.given}`)
      lines.push(`- When: ${s.when}`)
      lines.push(`- Then: ${s.then}`)
      lines.push('')
    }

    const text = lines.join('\n').trimEnd()

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {/* silent */})
    }
  }

  return { testMap, generateTests, toggleOpen, copyTests }
}
