// UNIT_TYPE=Composable
// Feature #81 — AI spec "debate mode"
import { ref } from 'vue'
import type { Ref } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface DebateTurn {
  persona: 'Optimist' | 'Critic'
  round: number   // 1, 2, or 3
  argument: string
  severity: 'low' | 'medium' | 'high'  // Critic only; Optimist always low
}

function buildMockTurns(): DebateTurn[] {
  return [
    {
      persona: 'Optimist',
      round: 1,
      argument: 'This spec has clear measurable goals with defined scales — a strong foundation for success.',
      severity: 'low',
    },
    {
      persona: 'Critic',
      round: 1,
      argument: 'But the goals may be too ambitious given no Status baseline is established yet. High risk.',
      severity: 'high',
    },
    {
      persona: 'Optimist',
      round: 2,
      argument: 'The solution entries directly address the function requirements — good traceability.',
      severity: 'low',
    },
    {
      persona: 'Critic',
      round: 2,
      argument: 'Traceability exists, but missing Tolerable values leaves the team without a fallback target.',
      severity: 'medium',
    },
    {
      persona: 'Optimist',
      round: 3,
      argument: 'Overall, the spec demonstrates methodological rigour that most teams lack at this stage.',
      severity: 'low',
    },
    {
      persona: 'Critic',
      round: 3,
      argument: 'Rigour is present, but implementation effort is not bounded — scope creep risk remains medium.',
      severity: 'medium',
    },
  ]
}

export function useDebateMode(
  spec: Ref<SpecBlock | null>,
  apiKey: Ref<string> | string,
) {
  const debateOpen = ref(false)
  const debating = ref(false)
  const debateError = ref<string | null>(null)
  const turns = ref<DebateTurn[]>([])

  const resolvedApiKey = (): string => {
    if (typeof apiKey === 'string') return apiKey
    return apiKey.value
  }

  async function generateDebate(): Promise<void> {
    if (!spec.value) return

    debating.value = true
    debateError.value = null
    turns.value = []

    const key = resolvedApiKey()

    if (!key || import.meta.env.VITE_MOCK_MODE === 'true') {
      // Mock: 500ms delay then return fixed turns
      await new Promise(r => setTimeout(r, 500))
      turns.value = buildMockTurns()
      debating.value = false
      return
    }

    try {
      const { Anthropic } = await import('@anthropic-ai/sdk')
      const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true })

      const s = spec.value
      const context = [
        `Functions: ${s.functions.length}`,
        `Values: ${s.values.length}`,
        `Solutions: ${s.solutions.length}`,
        s.values[0] ? `First V. scale: ${s.values[0].scale}` : '',
      ].filter(Boolean).join(', ')

      const msg = await client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 800,
        system: `You are a spec debate moderator. Generate a 3-round debate between an Optimist and a Critic about the given Planguage spec. Return a JSON array of exactly 6 DebateTurn objects. Each turn: { "persona": "Optimist"|"Critic", "round": 1|2|3, "argument": string, "severity": "low"|"medium"|"high" }. Optimist severity is always "low". Critic severity is "medium" or "high". Arguments are 1–2 sentences each.`,
        messages: [{ role: 'user', content: `Spec context: ${context}. Generate debate JSON array only.` }],
      })

      const text = msg.content[0].type === 'text' ? msg.content[0].text : '[]'
      const match = text.match(/\[[\s\S]*\]/)
      if (match) {
        const parsed = JSON.parse(match[0]) as DebateTurn[]
        turns.value = parsed
      } else {
        turns.value = buildMockTurns()
      }
    } catch (e) {
      debateError.value = e instanceof Error ? e.message : 'Debate generation failed'
      turns.value = buildMockTurns()
    }

    debating.value = false
  }

  function buildTranscript(): string {
    const rounds = [1, 2, 3]
    const lines: string[] = ['## Spec Debate', '']
    for (const r of rounds) {
      const roundTurns = turns.value.filter(t => t.round === r)
      if (roundTurns.length === 0) continue
      lines.push(`### Round ${r}`)
      for (const t of roundTurns) {
        lines.push(`**${t.persona}:** ${t.argument}`)
      }
      lines.push('')
    }
    return lines.join('\n')
  }

  async function copyTranscript(): Promise<void> {
    try {
      await navigator.clipboard.writeText(buildTranscript())
    } catch { /* no-op */ }
  }

  function clearDebate(): void {
    turns.value = []
    debateError.value = null
  }

  return { debateOpen, debating, debateError, turns, generateDebate, copyTranscript, clearDebate }
}
