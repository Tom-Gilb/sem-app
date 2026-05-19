// UNIT_TYPE=Composable
// Feature #57 — Plain language spec rewriter with rewrite modes
// Feature #57b — Extended language modes + per-entry rewrite + scope apply
//
// 2026-05-18 Fix: removed `apiKey` parameter — was always undefined because
// App.vue never passed it, causing every call to fall through to simplifyTextMock()
// (near-identity transform — text appeared unchanged). Now uses the same
// self-contained _getClient() pattern as useDefine / useSharpen.
import Anthropic from '@anthropic-ai/sdk'
import { ref } from 'vue'
import { MODEL_ID } from '../config/llm'
import type { SpecBlock } from '../types/spec'

export type SimplifyMode =
  | 'plain'
  | 'short'
  | 'non-technical'
  | 'precise'
  | 'age-12'
  | 'manager'
  | 'tech-nerd'
  | 'grandma'
  | 'investor'
  | 'marketing'

export interface SimplifyModeOption {
  key: SimplifyMode
  label: string
  emoji: string
  hint: string
}

export const SIMPLIFY_MODES: SimplifyModeOption[] = [
  {
    key: 'plain',
    label: 'Plain language',
    emoji: '✏️',
    hint: 'Non-jargon, accessible to any adult',
  },
  {
    key: 'short',
    label: 'Shorten',
    emoji: '✂️',
    hint: 'Remove all redundancy — max ~10 words per entry',
  },
  {
    key: 'non-technical',
    label: 'Non-Technical',
    emoji: '💬',
    hint: 'Zero domain jargon — any adult understands instantly',
  },
  {
    key: 'precise',
    label: 'High Precision',
    emoji: '🎯',
    hint: 'Specific, testable, no hedging or vague qualifiers',
  },
  {
    key: 'age-12',
    label: '12 Year Old',
    emoji: '🧒',
    hint: 'Short words, short sentences, relatable examples',
  },
  {
    key: 'manager',
    label: 'Manager Language',
    emoji: '📊',
    hint: 'KPIs, ROI, deliverables — corporate executive framing',
  },
  {
    key: 'tech-nerd',
    label: 'Tech Nerd',
    emoji: '🔧',
    hint: 'Stack names, patterns, complexity notation — dev vernacular',
  },
  {
    key: 'grandma',
    label: 'Grandma Language',
    emoji: '👵',
    hint: 'Very simple, warm, relatable everyday examples',
  },
  {
    key: 'investor',
    label: 'Investor Pitch',
    emoji: '💰',
    hint: 'Market opportunity, traction, return — pitch deck framing',
  },
  {
    key: 'marketing',
    label: 'Marketing Copy',
    emoji: '📣',
    hint: 'Punchy, benefit-focused, action-oriented copy',
  },
]

const MODE_PROMPTS: Record<SimplifyMode, string> = {
  'plain':
    'Rewrite each entry in plain English for a non-technical reader. Remove jargon and passive voice. Keep the same ID prefix. One line per entry. Format: "ID: plain text"',
  'short':
    'Shorten each entry to at most 10 words. Cut every redundant word while keeping the core meaning. Keep the same ID prefix. One line per entry. Format: "ID: short text"',
  'non-technical':
    'Rewrite each entry so any adult with zero technical or domain knowledge can understand it instantly. Replace every piece of jargon, abbreviation, or domain term with everyday language. Keep the same ID prefix. One line per entry. Format: "ID: plain text"',
  'precise':
    'Rewrite each entry using precise, unambiguous language. Remove all hedging words (may, might, could, approximately, generally), vague qualifiers, and passive voice. Every statement must be specific, concrete, and testable. Keep the same ID prefix. One line per entry. Format: "ID: precise text"',
  'age-12':
    'Rewrite each entry as if explaining to a bright 12-year-old. Use very short sentences, simple everyday words, and a relatable example if it helps. Avoid all jargon and technical terms. Keep the same ID prefix. One line per entry. Format: "ID: simple text"',
  'manager':
    'Rewrite each entry in corporate executive language. Use terms like KPIs, ROI, deliverables, strategic alignment, stakeholder value, and efficiency gains. Make every statement sound like a board-level briefing. Keep the same ID prefix. One line per entry. Format: "ID: executive text"',
  'tech-nerd':
    'Rewrite each entry in developer/engineer vernacular. Use precise technical terms, stack names, design patterns, and idiomatic developer language. Every entry should read like it came from a senior engineer\'s ticket. Keep the same ID prefix. One line per entry. Format: "ID: technical text"',
  'grandma':
    'Rewrite each entry as if explaining to a loving grandmother with no technical knowledge. Use warm, simple language, everyday household examples, and very short sentences. Never use any jargon or abbreviations. Keep the same ID prefix. One line per entry. Format: "ID: simple text"',
  'investor':
    'Rewrite each entry in startup investor pitch language. Emphasise market opportunity, competitive advantage, traction signals, and return potential. Use crisp, confident language that belongs in a Series A deck. Keep the same ID prefix. One line per entry. Format: "ID: pitch text"',
  'marketing':
    'Rewrite each entry as punchy marketing copy. Lead with the benefit, use active voice, strong verbs, and a sense of momentum or transformation. Avoid passive voice and technical detail. Keep the same ID prefix. One line per entry. Format: "ID: copy text"',
}

export interface SimplifiedEntry {
  id: string
  original: string
  simplified: string
  type: 'F' | 'V' | 'S'
}

/** Apply a set of simplified entries back onto a SpecBlock — returns a new SpecBlock. */
export function applySimplifiedToSpec(spec: SpecBlock, entries: SimplifiedEntry[]): SpecBlock {
  const map = Object.fromEntries(entries.map(e => [e.id, e.simplified]))
  return {
    ...spec,
    functions: spec.functions.map(f => map[f.id] ? { ...f, description: map[f.id] } : f),
    values:    spec.values.map(v    => map[v.id] ? { ...v, description: map[v.id] } : v),
    solutions: spec.solutions.map(s => map[s.id] ? { ...s, description: map[s.id] } : s),
  }
}

function _getClient(): Anthropic {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined
  const isLocal = !!(import.meta.env.VITE_OLLAMA_MODEL || import.meta.env.VITE_OLLAMA_BASE_URL)
  if (!apiKey && !isLocal) throw new Error('VITE_ANTHROPIC_API_KEY not set')
  return new Anthropic({ apiKey: apiKey ?? 'local', dangerouslyAllowBrowser: true, timeout: 30_000 })
}

export function useSpecSimplify() {
  const simplified = ref<SimplifiedEntry[]>([])
  const loading    = ref(false)
  const error      = ref('')
  const copied     = ref(false)
  const activeMode = ref<SimplifyMode>('plain')

  function simplifyTextMock(text: string): string {
    return text
      .replace(/\b(utilise|utilisation|leverage|synergise|facilitate|operationalise)\b/gi, (m) => ({
        'utilise': 'use', 'utilisation': 'use', 'leverage': 'use',
        'synergise': 'combine', 'facilitate': 'help', 'operationalise': 'run',
      }[m.toLowerCase()] ?? m))
      .replace(/\b(in order to)\b/gi, 'to')
      .replace(/\b(is being|are being|was being|were being)\b/gi, 'is')
      .replace(/\b(at this point in time)\b/gi, 'now')
      .replace(/([.!?])\s+([A-Z])/g, '$1 $2')
      .trim()
      || `Plain version of: ${text.slice(0, 60)}`
  }

  async function simplifySpec(spec: SpecBlock, mode: SimplifyMode = 'plain'): Promise<void> {
    activeMode.value   = mode
    loading.value      = true
    error.value        = ''
    simplified.value   = []

    const systemPrompt = MODE_PROMPTS[mode]

    if (import.meta.env.VITE_MOCK_MODE === 'true') {
      await new Promise(r => setTimeout(r, 500))
      const entries: SimplifiedEntry[] = [
        ...spec.functions.map((f): SimplifiedEntry => ({
          id: f.id, type: 'F', original: f.description,
          simplified: simplifyTextMock(f.description),
        })),
        ...spec.values.map((v): SimplifiedEntry => ({
          id: v.id, type: 'V', original: v.description,
          simplified: simplifyTextMock(v.description),
        })),
        ...spec.solutions.map((s): SimplifiedEntry => ({
          id: s.id, type: 'S', original: s.description,
          simplified: simplifyTextMock(s.description),
        })),
      ]
      simplified.value = entries
    } else {
      try {
        const client = _getClient()
        const allEntries = [
          ...spec.functions.map(f => ({ id: f.id, type: 'F', text: f.description })),
          ...spec.values.map(v => ({ id: v.id, type: 'V', text: v.description })),
          ...spec.solutions.map(s => ({ id: s.id, type: 'S', text: s.description })),
        ]
        const input = allEntries.map(e => `${e.id}: ${e.text}`).join('\n')
        const msg = await client.messages.create({
          model: MODEL_ID,
          max_tokens: 1500,
          system: systemPrompt,
          messages: [{ role: 'user', content: input }],
        })
        const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
        const lines = text.split('\n').filter(l => l.includes(':'))
        simplified.value = allEntries.map((entry) => {
          const line = lines.find(l => l.startsWith(entry.id + ':'))
          const simp = line ? line.slice(entry.id.length + 1).trim() : entry.text
          return { id: entry.id, type: entry.type as 'F'|'V'|'S', original: entry.text, simplified: simp }
        })
      } catch (e) {
        error.value = e instanceof Error ? e.message : 'Simplify failed'
      }
    }
    loading.value = false
  }

  /** Rewrite a single entry description in the given mode. Returns the rewritten text. */
  async function simplifyEntry(id: string, description: string, mode: SimplifyMode): Promise<string> {
    const systemPrompt = MODE_PROMPTS[mode]
    if (import.meta.env.VITE_MOCK_MODE === 'true') {
      await new Promise(r => setTimeout(r, 300))
      return simplifyTextMock(description)
    }
    try {
      const client = _getClient()
      const msg = await client.messages.create({
        model: MODEL_ID,
        max_tokens: 200,
        system: systemPrompt,
        messages: [{ role: 'user', content: `${id}: ${description}` }],
      })
      const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
      const line = text.split('\n').find(l => l.includes(':'))
      if (line) {
        const colonIdx = line.indexOf(':')
        return line.slice(colonIdx + 1).trim() || description
      }
      return text.trim() || description
    } catch {
      return description
    }
  }

  function toPlainText(): string {
    return simplified.value
      .map(e => `[${e.type}] ${e.id}: ${e.simplified}`)
      .join('\n\n')
  }

  async function copySimplified(): Promise<void> {
    try {
      await navigator.clipboard.writeText(toPlainText())
      copied.value = true
      setTimeout(() => { copied.value = false }, 2000)
    } catch { /* ignore */ }
  }

  return { simplified, loading, error, copied, activeMode, simplifySpec, simplifyEntry, copySimplified }
}
