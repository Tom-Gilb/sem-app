// UNIT_TYPE=Composable
// Feature #113 — Evo step retrospective generator

import { ref } from 'vue'

export interface RetroPrompt {
  category: 'went-well' | 'improve' | 'experiment'
  prompt: string
}

export interface StepRetro {
  stepId: string
  prompts: RetroPrompt[]
  loading: boolean
  open: boolean
}

// Deterministic mock prompt banks (index = (seed + categoryIndex) % 3)
const WENT_WELL_BANK: string[] = [
  'The team maintained clear communication throughout',
  'Scope was well-defined from the start',
  'Estimation accuracy exceeded expectations',
]

const IMPROVE_BANK: string[] = [
  'Reduce context-switching between tasks',
  'Earlier review cycles would help',
  'Documentation could be written alongside delivery',
]

const EXPERIMENT_BANK: string[] = [
  'Try time-boxing individual tasks to 2-hour slots',
  'Pair on the hardest item first',
  'Run a 5-min standup at start of each session',
]

function charCodeSum(name: string): number {
  let sum = 0
  for (let i = 0; i < name.length; i++) {
    sum += name.charCodeAt(i)
  }
  return sum
}

function mockPromptsForStep(name: string): RetroPrompt[] {
  const seed = charCodeSum(name) % 3
  return [
    { category: 'went-well', prompt: WENT_WELL_BANK[(seed + 0) % 3] },
    { category: 'improve', prompt: IMPROVE_BANK[(seed + 1) % 3] },
    { category: 'experiment', prompt: EXPERIMENT_BANK[(seed + 2) % 3] },
  ]
}

// Internal extended state tracks step name for copyRetro formatting
interface StepRetroInternal extends StepRetro {
  _name: string
}

export function useStepRetro(apiKey: string) {
  const retroMap = ref<Record<string, StepRetro>>({})

  // Internal map preserving the step name for copyRetro
  const _internalMap = retroMap as import('vue').Ref<Record<string, StepRetroInternal>>

  async function generateRetro(step: { id: string; name: string; description?: string }): Promise<void> {
    // Ensure entry exists
    if (!_internalMap.value[step.id]) {
      _internalMap.value[step.id] = { stepId: step.id, prompts: [], loading: false, open: false, _name: step.name }
    } else {
      _internalMap.value[step.id]._name = step.name
    }

    const state = _internalMap.value[step.id]
    state.loading = true

    try {
      const useMock = !apiKey || import.meta.env.VITE_MOCK_MODE === 'true'

      if (!useMock) {
        // Live mode: call claude-haiku-4-5
        try {
          const descPart = step.description ? `\nDescription: ${step.description}` : ''
          const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: 'claude-haiku-4-5',
              max_tokens: 400,
              messages: [
                {
                  role: 'user',
                  content: `Generate exactly 3 retrospective prompts for Evo step: "${step.name}".${descPart}
Return ONLY a JSON array with exactly 3 objects, each with "category" and "prompt" fields.
Categories must be exactly: "went-well", "improve", "experiment" (one each, in that order).
Example: [{"category":"went-well","prompt":"..."},{"category":"improve","prompt":"..."},{"category":"experiment","prompt":"..."}]`,
                },
              ],
            }),
          })

          if (response.ok) {
            const data = await response.json()
            const content = data.content?.[0]?.text ?? ''
            const match = content.match(/\[[\s\S]*\]/)
            if (match) {
              const parsed: Array<{ category: string; prompt: string }> = JSON.parse(match[0])
              if (
                Array.isArray(parsed) &&
                parsed.length >= 3 &&
                parsed[0].category === 'went-well' &&
                parsed[1].category === 'improve' &&
                parsed[2].category === 'experiment'
              ) {
                state.prompts = [
                  { category: 'went-well', prompt: String(parsed[0].prompt) },
                  { category: 'improve', prompt: String(parsed[1].prompt) },
                  { category: 'experiment', prompt: String(parsed[2].prompt) },
                ]
                return
              }
            }
          }
        } catch {
          // Fall through to mock
        }
      }

      // Mock mode: deterministic prompts seeded by step.name charCode sum
      state.prompts = mockPromptsForStep(step.name)
    } finally {
      state.loading = false
    }
  }

  function toggleOpen(stepId: string): void {
    if (!_internalMap.value[stepId]) {
      _internalMap.value[stepId] = { stepId, prompts: [], loading: false, open: false, _name: stepId }
    }
    _internalMap.value[stepId].open = !_internalMap.value[stepId].open
  }

  function copyRetro(stepId: string): void {
    const state = _internalMap.value[stepId]
    if (!state) return

    const stepName = state._name || stepId

    const wentWell = state.prompts.find(p => p.category === 'went-well')
    const improve = state.prompts.find(p => p.category === 'improve')
    const experiment = state.prompts.find(p => p.category === 'experiment')

    const markdown = [
      `## Retro — ${stepName}`,
      `**Went well:** ${wentWell?.prompt ?? ''}`,
      `**Improve:** ${improve?.prompt ?? ''}`,
      `**Experiment:** ${experiment?.prompt ?? ''}`,
    ].join('\n')

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(markdown).catch(() => {/* silent */})
    }
  }

  return { retroMap, generateRetro, toggleOpen, copyRetro }
}
