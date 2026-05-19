// UNIT_TYPE=Composable
// Feature #91 — Evo step Definition of Done composable
import { ref, watch, type Ref } from 'vue'
import type { EvoStep } from '../types/evo-plan'
import { ollamaChat } from '../lib/ollamaChat'

export interface DoDItem {
  text: string
  checked: boolean
}

interface DoDState {
  open: boolean
  items: DoDItem[]
  loading: boolean
}

const GENERIC_ITEMS: string[] = [
  'All code changes are reviewed and merged to main branch',
  'Unit tests pass with ≥90% coverage for new code',
  'Feature validated against the V. entry Goal in a live demo session',
]

function mockItemsForStep(title: string): DoDItem[] {
  const lower = title.toLowerCase()

  // Keyword-based customisation; fall back to generic items
  if (lower.includes('api') || lower.includes('backend') || lower.includes('endpoint')) {
    return [
      { text: 'API endpoints documented with request/response examples', checked: false },
      { text: 'Unit tests pass with ≥90% coverage for new code', checked: false },
      { text: 'Feature validated against the V. entry Goal in a live demo session', checked: false },
    ]
  }

  if (lower.includes('ui') || lower.includes('component') || lower.includes('view') || lower.includes('design')) {
    return [
      { text: 'UI component passes accessibility audit (WCAG 2.1 AA)', checked: false },
      { text: 'All code changes are reviewed and merged to main branch', checked: false },
      { text: 'Feature validated against the V. entry Goal in a live demo session', checked: false },
    ]
  }

  if (lower.includes('test') || lower.includes('qa') || lower.includes('quality')) {
    return [
      { text: 'Test suite covers all acceptance criteria scenarios', checked: false },
      { text: 'Unit tests pass with ≥90% coverage for new code', checked: false },
      { text: 'Feature validated against the V. entry Goal in a live demo session', checked: false },
    ]
  }

  if (lower.includes('data') || lower.includes('database') || lower.includes('migration')) {
    return [
      { text: 'Data migration script runs without errors on staging environment', checked: false },
      { text: 'Unit tests pass with ≥90% coverage for new code', checked: false },
      { text: 'Feature validated against the V. entry Goal in a live demo session', checked: false },
    ]
  }

  // Generic fallback
  return GENERIC_ITEMS.map(text => ({ text, checked: false }))
}

export function useStepDoD(
  steps: Ref<EvoStep[]>,
  apiKey: Ref<string> | string,
) {
  const dodByStep = ref<Record<string, DoDState>>({})

  // Initialise new step IDs when steps change
  watch(
    steps,
    (newSteps) => {
      for (let i = 0; i < newSteps.length; i++) {
        const stepId = `step-${i}`
        if (!dodByStep.value[stepId]) {
          dodByStep.value[stepId] = { open: false, items: [], loading: false }
        }
      }
    },
    { immediate: true },
  )

  function toggleDod(stepId: string): void {
    const state = dodByStep.value[stepId]
    if (!state) return

    state.open = !state.open

    // If opening and items not yet generated, generate them
    if (state.open && state.items.length === 0) {
      generateDod(stepId)
    }
  }

  async function generateDod(stepId: string): Promise<void> {
    const state = dodByStep.value[stepId]
    if (!state) return

    // Find the step title from index
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
            max_tokens: 300,
            messages: [{
              role: 'user',
              content: `Generate 3 Definition of Done items for Evo step: "${step.name}". Return ONLY a JSON array of strings, no explanation. Example: ["item1","item2","item3"]`,
            }],
          })
          const match = content.match(/\[[\s\S]*\]/)
          if (match) {
            const parsed: string[] = JSON.parse(match[0])
            if (Array.isArray(parsed) && parsed.length >= 3) {
              state.items = parsed.slice(0, 3).map(text => ({ text: String(text), checked: false }))
              return
            }
          }
        } catch {
          // Fall through to mock
        }
      }

      // Mock mode: deterministic keyword-based items
      state.items = mockItemsForStep(step.name)
    } finally {
      state.loading = false
    }
  }

  function toggleItem(stepId: string, index: number): void {
    const state = dodByStep.value[stepId]
    if (!state || index < 0 || index >= state.items.length) return
    state.items[index].checked = !state.items[index].checked
  }

  function copyDod(stepId: string): void {
    const state = dodByStep.value[stepId]
    if (!state) return

    const index = parseInt(stepId.replace('step-', ''), 10)
    const step = steps.value[index]
    const title = step?.name ?? stepId

    const lines = state.items.map(item =>
      `${item.checked ? '- [x]' : '- [ ]'} ${item.text}`,
    )

    const markdown = `### DoD: ${title}\n${lines.join('\n')}`

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(markdown).catch(() => {/* silent */})
    }
  }

  return { dodByStep, toggleDod, generateDod, toggleItem, copyDod }
}
