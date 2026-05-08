// UNIT_TYPE=Composable
// Feature #88 — AI spec auto-improver
import { ref } from 'vue'
import type { Ref } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface ImprovementStep {
  source: 'Accessibility' | 'PeerReview' | 'Gaps'
  suggestion: string
  applied: boolean
}

const MOCK_SUGGESTIONS: ImprovementStep[] = [
  {
    source: 'Accessibility',
    suggestion: "Replace vague goal 'improve performance' with a specific numeric target (e.g., 'reduce latency by 30%')",
    applied: false,
  },
  {
    source: 'PeerReview',
    suggestion: 'Add a Tolerable threshold for the primary Value entry to define the minimum acceptable outcome',
    applied: false,
  },
  {
    source: 'Gaps',
    suggestion: 'Consider adding a V. entry for user adoption rate — this domain typically requires an adoption metric',
    applied: false,
  },
]

export function useAutoImprove(spec: Ref<SpecBlock | null>, apiKey: Ref<string> | string) {
  const autoImproveOpen = ref(false)
  const improving = ref(false)
  const improveError = ref<string | null>(null)
  const steps = ref<ImprovementStep[]>([])
  const improvedSpec = ref<string | null>(null)
  const showDiff = ref(false)

  function resolvedApiKey(): string {
    return typeof apiKey === 'string' ? apiKey : apiKey.value
  }

  function buildSpecMarkdown(): string {
    if (!spec.value) return ''
    const lines: string[] = []
    for (const f of spec.value.functions) {
      lines.push(`### F. ${f.id}\n${f.description}`)
    }
    for (const v of spec.value.values) {
      lines.push(`### V. ${v.id}\n${v.description}\nGoal: ${v.goal}\nTolerable: ${v.tolerable}`)
    }
    for (const s of spec.value.solutions) {
      lines.push(`### S. ${s.id}\n${s.description}`)
    }
    return lines.join('\n\n')
  }

  async function runAutoImprove(): Promise<void> {
    if (!spec.value) return
    improving.value = true
    improveError.value = null
    showDiff.value = false
    steps.value = []

    const useMock = !resolvedApiKey() || import.meta.env.VITE_MOCK_MODE === 'true'

    try {
      let baseMarkdown = buildSpecMarkdown()

      if (useMock) {
        // Simulate 3 steps with short delays
        for (const mockStep of MOCK_SUGGESTIONS) {
          await new Promise(r => setTimeout(r, 300))
          const applied: ImprovementStep = { ...mockStep, applied: true }
          steps.value = [...steps.value, applied]
          baseMarkdown += `\n\n<!-- Suggestion applied: ${mockStep.suggestion} -->`
        }
      } else {
        try {
          const { Anthropic } = await import('@anthropic-ai/sdk')
          const client = new Anthropic({ apiKey: resolvedApiKey(), dangerouslyAllowBrowser: true })

          const sources: Array<ImprovementStep['source']> = ['Accessibility', 'PeerReview', 'Gaps']
          const prompts: Record<ImprovementStep['source'], string> = {
            Accessibility: 'Check this spec for accessibility: vague goals, missing numeric targets, unclear language. Give 1 specific improvement.',
            PeerReview: 'Adversarially review this spec. Give 1 specific improvement to strengthen it.',
            Gaps: 'What is missing from this spec? Give 1 specific V. entry or field that should be added.',
          }

          for (const source of sources) {
            const msg = await client.messages.create({
              model: 'claude-haiku-4-5',
              max_tokens: 256,
              messages: [{ role: 'user', content: `${prompts[source]}\n\nSpec:\n${baseMarkdown}` }],
            })
            const suggestion = msg.content[0].type === 'text' ? msg.content[0].text.trim() : MOCK_SUGGESTIONS.find(m => m.source === source)!.suggestion
            const applied: ImprovementStep = { source, suggestion, applied: true }
            steps.value = [...steps.value, applied]
            baseMarkdown += `\n\n<!-- Suggestion applied: ${suggestion.slice(0, 80)} -->`
          }
        } catch (e) {
          improveError.value = e instanceof Error ? e.message : 'Auto-improve failed'
          improving.value = false
          return
        }
      }

      improvedSpec.value = baseMarkdown
      showDiff.value = true
    } catch (e) {
      improveError.value = e instanceof Error ? e.message : 'Auto-improve failed'
    }

    improving.value = false
  }

  function copyImprovedSpec(): void {
    if (!improvedSpec.value) return
    navigator.clipboard.writeText(improvedSpec.value).catch(() => { /* ignore */ })
  }

  return {
    autoImproveOpen,
    improving,
    improveError,
    steps,
    improvedSpec,
    showDiff,
    runAutoImprove,
    copyImprovedSpec,
  }
}
