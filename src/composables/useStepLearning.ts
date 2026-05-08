// UNIT_TYPE=Composable
// Feature #95 — Evo step Learning Outcomes composable
import { ref, watch, type Ref } from 'vue'
import type { EvoStep } from '../types/evo-plan'

export interface LearningOutcome {
  text: string
}

interface LearningState {
  open: boolean
  outcomes: LearningOutcome[]
  loading: boolean
}

const GENERIC_OUTCOMES: string[] = [
  'How to validate {title} against the defined V. entry Goals',
  'Where the specification gaps are in this area and how to document them',
  'What the real-world constraints are that were not visible in the spec',
]

function mockOutcomesForStep(title: string): LearningOutcome[] {
  const lower = title.toLowerCase()

  if (lower.includes('api') || lower.includes('backend') || lower.includes('endpoint')) {
    return [
      { text: `How to validate ${title} against the defined V. entry Goals` },
      { text: 'Where the specification gaps are in this area and how to document them' },
      { text: 'What API contract constraints were not visible in the spec and how to resolve them' },
    ]
  }

  if (lower.includes('ui') || lower.includes('component') || lower.includes('view') || lower.includes('design')) {
    return [
      { text: `How to validate ${title} against the defined V. entry Goals` },
      { text: 'What real-world usability constraints emerge that were not anticipated in the spec' },
      { text: 'Where the specification gaps are in this area and how to document them' },
    ]
  }

  if (lower.includes('test') || lower.includes('qa') || lower.includes('quality')) {
    return [
      { text: `How to validate ${title} against the defined V. entry Goals` },
      { text: 'What coverage gaps exist in the current test strategy and how to address them' },
      { text: 'Where the specification gaps are in this area and how to document them' },
    ]
  }

  if (lower.includes('data') || lower.includes('database') || lower.includes('migration')) {
    return [
      { text: `How to validate ${title} against the defined V. entry Goals` },
      { text: 'What data integrity constraints were not visible in the spec' },
      { text: 'Where the specification gaps are in this area and how to document them' },
    ]
  }

  // Generic fallback — interpolate title
  return GENERIC_OUTCOMES.map(text => ({
    text: text.replace('{title}', title),
  }))
}

export function useStepLearning(
  steps: Ref<EvoStep[]>,
  apiKey: Ref<string> | string,
) {
  const learningByStep = ref<Record<string, LearningState>>({})

  // Initialise new step IDs when steps change
  watch(
    steps,
    (newSteps) => {
      for (let i = 0; i < newSteps.length; i++) {
        const stepId = `step-${i}`
        if (!learningByStep.value[stepId]) {
          learningByStep.value[stepId] = { open: false, outcomes: [], loading: false }
        }
      }
    },
    { immediate: true },
  )

  function toggleLearning(stepId: string): void {
    const state = learningByStep.value[stepId]
    if (!state) return

    state.open = !state.open

    // If opening and outcomes not yet generated, generate them
    if (state.open && state.outcomes.length === 0) {
      generateLearning(stepId)
    }
  }

  async function generateLearning(stepId: string): Promise<void> {
    const state = learningByStep.value[stepId]
    if (!state) return

    // Find the step title from index
    const index = parseInt(stepId.replace('step-', ''), 10)
    const step = steps.value[index]
    if (!step) return

    state.loading = true

    try {
      const key = typeof apiKey === 'string' ? apiKey : apiKey.value

      if (key && key.length > 0) {
        // Live mode: call claude-haiku-4-5
        try {
          const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': key,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: 'claude-haiku-4-5',
              max_tokens: 300,
              messages: [
                {
                  role: 'user',
                  content: `Generate 2-3 learning outcomes for completing Evo step: "${step.name}". Return ONLY a JSON array of strings, no explanation. Example: ["outcome1","outcome2","outcome3"]`,
                },
              ],
            }),
          })

          if (response.ok) {
            const data = await response.json()
            const content = data.content?.[0]?.text ?? ''
            const match = content.match(/\[[\s\S]*\]/)
            if (match) {
              const parsed: string[] = JSON.parse(match[0])
              if (Array.isArray(parsed) && parsed.length >= 2) {
                state.outcomes = parsed.slice(0, 3).map(text => ({ text: String(text) }))
                return
              }
            }
          }
        } catch {
          // Fall through to mock
        }
      }

      // Mock mode: deterministic keyword-based outcomes
      state.outcomes = mockOutcomesForStep(step.name)
    } finally {
      state.loading = false
    }
  }

  function copyLearning(stepId: string): void {
    const state = learningByStep.value[stepId]
    if (!state) return

    const index = parseInt(stepId.replace('step-', ''), 10)
    const step = steps.value[index]
    const title = step?.name ?? stepId

    const lines = state.outcomes.map(outcome => `- ${outcome.text}`)
    const markdown = `### Learning Outcomes: ${title}\n${lines.join('\n')}`

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(markdown).catch(() => {/* silent */})
    }
  }

  return { learningByStep, toggleLearning, generateLearning, copyLearning }
}
