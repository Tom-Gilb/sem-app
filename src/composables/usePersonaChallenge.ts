// UNIT_TYPE=Composable
// Feature #85 — "Challenge from stakeholder" persona
import { ref } from 'vue'
import type { Ref } from 'vue'
import type { SpecBlock } from '../types/spec'

type Persona = 'CTO' | 'ProductManager' | 'EndUser' | 'Regulator'

export interface PersonaChallenge {
  persona: Persona
  displayName: string
  emoji: string
  challenges: string[]
}

const PERSONA_META: Record<Persona, { displayName: string; emoji: string }> = {
  CTO: { displayName: 'CTO', emoji: '🏗️' },
  ProductManager: { displayName: 'Product Manager', emoji: '📦' },
  EndUser: { displayName: 'End User', emoji: '👤' },
  Regulator: { displayName: 'Regulator', emoji: '⚖️' },
}

const MOCK_CHALLENGES: Record<Persona, string[]> = {
  CTO: [
    "How does this scale to 10× the stated load? The Scale field doesn't address infrastructure headroom.",
    "What's the rollback strategy if the Goal isn't met in production?",
    "The Solution entries don't reference observability or monitoring requirements.",
  ],
  ProductManager: [
    "Users won't read the spec — where's the user story mapping?",
    "The timeline assumptions aren't stated — what's the critical path?",
    "How do we measure adoption, not just delivery?",
  ],
  EndUser: [
    "I don't understand what 'Tolerable' means for me day-to-day — what happens if we hit that limit?",
    "The spec uses technical jargon I can't act on without a translator.",
    "How long will it take me to see any benefit after this ships?",
  ],
  Regulator: [
    "Are the data retention policies for measurements specified?",
    "Who is accountable if the Goal is not reached — the spec has no named owner.",
    "GDPR Article 5 requires data minimisation — is measurement data anonymised?",
  ],
}

export function usePersonaChallenge(
  spec: Ref<SpecBlock | null>,
  apiKey: Ref<string> | string
) {
  const personaOpen = ref(false)
  const selectedPersona = ref<Persona>('CTO')
  const challenging = ref(false)
  const challengeError = ref<string | null>(null)
  const result = ref<PersonaChallenge | null>(null)

  function resolvedApiKey(): string {
    return typeof apiKey === 'string' ? apiKey : apiKey.value
  }

  function buildSpecSummary(): string {
    if (!spec.value) return ''
    const parts: string[] = []
    for (const v of spec.value.values) {
      parts.push(`${v.id}: ${v.description}. Goal: ${v.goal}`)
    }
    for (const f of spec.value.functions) {
      parts.push(`${f.id}: ${f.description}`)
    }
    return parts.join('\n')
  }

  async function generateChallenge(): Promise<void> {
    if (!spec.value) {
      result.value = null
      return
    }
    challenging.value = true
    challengeError.value = null

    const persona = selectedPersona.value
    const meta = PERSONA_META[persona]

    if (!resolvedApiKey() || import.meta.env.VITE_MOCK_MODE === 'true') {
      await new Promise(r => setTimeout(r, 400))
      result.value = {
        persona,
        displayName: meta.displayName,
        emoji: meta.emoji,
        challenges: MOCK_CHALLENGES[persona],
      }
    } else {
      try {
        const { Anthropic } = await import('@anthropic-ai/sdk')
        const client = new Anthropic({ apiKey: resolvedApiKey(), dangerouslyAllowBrowser: true })
        const summary = buildSpecSummary()
        const msg = await client.messages.create({
          model: 'claude-haiku-4-5',
          max_tokens: 512,
          system: `Respond as a ${meta.displayName}. Give exactly 3 specific, numbered challenges about this spec. Each challenge should be 1–2 sentences. Format: "1. ...\n2. ...\n3. ..."`,
          messages: [{ role: 'user', content: `Challenge this spec:\n\n${summary}` }],
        })
        const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
        const lines = text
          .split('\n')
          .map(l => l.replace(/^\d+\.\s*/, '').trim())
          .filter(l => l.length > 0)
          .slice(0, 3)
        result.value = {
          persona,
          displayName: meta.displayName,
          emoji: meta.emoji,
          challenges: lines.length === 3 ? lines : MOCK_CHALLENGES[persona],
        }
      } catch (e) {
        challengeError.value = e instanceof Error ? e.message : 'Challenge generation failed'
      }
    }
    challenging.value = false
  }

  function copyChallenge(): void {
    if (!result.value) return
    const { displayName, challenges } = result.value
    const text = `## ${displayName} Challenge\n\n${challenges.map((c, i) => `${i + 1}. ${c}`).join('\n')}`
    navigator.clipboard.writeText(text).catch(() => { /* ignore */ })
  }

  return {
    personaOpen,
    selectedPersona,
    challenging,
    challengeError,
    result,
    generateChallenge,
    copyChallenge,
  }
}
