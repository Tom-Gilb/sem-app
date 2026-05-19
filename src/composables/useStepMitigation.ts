// UNIT_TYPE=Composable
// Feature #106 — Evo step Risk Mitigation Plan composable
import { ref, watch, type Ref } from 'vue'
import type { EvoStep } from '../types/evo-plan'
import { ollamaChat } from '../lib/ollamaChat'

export interface MitigationStrategy {
  type: 'preventive' | 'contingent'
  text: string
}

interface MitigationState {
  open: boolean
  strategies: MitigationStrategy[]
  loading: boolean
}

function mockStrategiesForStep(title: string): MitigationStrategy[] {
  const lower = title.toLowerCase()

  if (lower.includes('design') || lower.includes('architecture')) {
    return [
      {
        type: 'preventive',
        text: `Run an architecture review session before starting ${title} to align on component boundaries and interfaces`,
      },
      {
        type: 'contingent',
        text: 'If architectural disagreements arise mid-step, schedule a time-boxed design spike (max 2 days) and document the decision in an ADR',
      },
    ]
  }

  if (lower.includes('test') || lower.includes('qa') || lower.includes('quality')) {
    return [
      {
        type: 'preventive',
        text: `Define test coverage thresholds and required test types for ${title} before implementation begins`,
      },
      {
        type: 'contingent',
        text: 'If coverage targets are missed, triage failing scenarios by severity and defer low-risk edge cases to the next Evo step',
      },
    ]
  }

  if (lower.includes('deploy') || lower.includes('release') || lower.includes('launch')) {
    return [
      {
        type: 'preventive',
        text: `Create a deployment runbook and rehearse the ${title} procedure in a staging environment before production`,
      },
      {
        type: 'contingent',
        text: 'If the deployment fails, trigger the rollback procedure immediately and open a post-mortem within 24 hours',
      },
    ]
  }

  // Generic fallback
  return [
    {
      type: 'preventive',
      text: `Define clear acceptance criteria and review checkpoints before starting ${title}`,
    },
    {
      type: 'contingent',
      text: 'If blockers emerge, escalate to team lead within 24 hours and reduce scope to core deliverable',
    },
  ]
}

export function useStepMitigation(
  steps: Ref<EvoStep[]>,
  apiKey: Ref<string> | string,
) {
  const mitigationByStep = ref<Record<string, MitigationState>>({})

  // Initialise new step IDs when steps change
  watch(
    steps,
    (newSteps) => {
      for (let i = 0; i < newSteps.length; i++) {
        const stepId = `step-${i}`
        if (!mitigationByStep.value[stepId]) {
          mitigationByStep.value[stepId] = { open: false, strategies: [], loading: false }
        }
      }
    },
    { immediate: true },
  )

  function toggleMitigation(stepId: string): void {
    const state = mitigationByStep.value[stepId]
    if (!state) return

    state.open = !state.open

    // If opening and strategies not yet generated, generate them
    if (state.open && state.strategies.length === 0) {
      generateMitigation(stepId)
    }
  }

  async function generateMitigation(stepId: string): Promise<void> {
    const state = mitigationByStep.value[stepId]
    if (!state) return

    const index = parseInt(stepId.replace('step-', ''), 10)
    const step = steps.value[index]
    if (!step) return

    state.loading = true

    try {
      const key = typeof apiKey === 'string' ? apiKey : apiKey.value
      const hasBackend = (key && key.length > 0) || !!import.meta.env.VITE_OLLAMA_MODEL

      if (hasBackend) {
        // Live mode: call local Ollama
        try {
          const content = await ollamaChat({
            max_tokens: 400,
            messages: [{
              role: 'user',
              content: `Generate exactly 2 risk mitigation strategies for Evo step: "${step.name}".
Return ONLY a JSON array with exactly 2 objects, each with "type" ("preventive" or "contingent") and "text" fields.
First object must be preventive (avoid the risk before it occurs).
Second object must be contingent (respond if the risk occurs).
Example: [{"type":"preventive","text":"..."},{"type":"contingent","text":"..."}]`,
            }],
          })
          const match = content.match(/\[[\s\S]*\]/)
          if (match) {
            const parsed: Array<{ type: string; text: string }> = JSON.parse(match[0])
            if (
              Array.isArray(parsed) &&
              parsed.length >= 2 &&
              parsed[0].type === 'preventive' &&
              parsed[1].type === 'contingent'
            ) {
              state.strategies = [
                { type: 'preventive', text: String(parsed[0].text) },
                { type: 'contingent', text: String(parsed[1].text) },
              ]
              return
            }
          }
        } catch {
          // Fall through to mock
        }
      }

      // Mock mode: deterministic keyword-based strategies
      state.strategies = mockStrategiesForStep(step.name)
    } finally {
      state.loading = false
    }
  }

  function copyMitigation(stepId: string): void {
    const state = mitigationByStep.value[stepId]
    if (!state) return

    const index = parseInt(stepId.replace('step-', ''), 10)
    const step = steps.value[index]
    const title = step?.name ?? stepId

    const preventive = state.strategies.find(s => s.type === 'preventive')
    const contingent = state.strategies.find(s => s.type === 'contingent')

    const markdown = [
      `### Risk Mitigation: ${title}`,
      '',
      `**Preventive:** ${preventive?.text ?? ''}`,
      `**Contingent:** ${contingent?.text ?? ''}`,
    ].join('\n')

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(markdown).catch(() => {/* silent */})
    }
  }

  return { mitigationByStep, toggleMitigation, generateMitigation, copyMitigation }
}
