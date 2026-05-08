// UNIT_TYPE=Composable
// Feature #57 — Plain language spec rewriter
import { ref } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface SimplifiedEntry {
  id: string
  original: string
  simplified: string
  type: 'F' | 'V' | 'S'
}

export function useSpecSimplify(apiKey?: string) {
  const simplified = ref<SimplifiedEntry[]>([])
  const loading = ref(false)
  const error = ref('')
  const copied = ref(false)

  function simplifyTextMock(text: string): string {
    // Strip jargon patterns, shorten sentences, avoid passive voice signals
    return text
      .replace(/\b(utilise|utilisation|leverage|synergise|facilitate|operationalise)\b/gi, (m) => ({
        'utilise': 'use', 'utilisation': 'use', 'leverage': 'use',
        'synergise': 'combine', 'facilitate': 'help', 'operationalise': 'run',
      }[m.toLowerCase()] ?? m))
      .replace(/\b(in order to)\b/gi, 'to')
      .replace(/\b(is being|are being|was being|were being)\b/gi, 'is')
      .replace(/\b(at this point in time)\b/gi, 'now')
      .replace(/([.!?])\s+([A-Z])/g, '$1 $2')  // keep spacing clean
      .trim()
      || `Plain version of: ${text.slice(0, 60)}`
  }

  async function simplifySpec(spec: SpecBlock): Promise<void> {
    loading.value = true
    error.value = ''
    simplified.value = []

    if (!apiKey || import.meta.env.VITE_MOCK_MODE === 'true') {
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
        const { Anthropic } = await import('@anthropic-ai/sdk')
        const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
        const allEntries = [
          ...spec.functions.map(f => ({ id: f.id, type: 'F', text: f.description })),
          ...spec.values.map(v => ({ id: v.id, type: 'V', text: v.description })),
          ...spec.solutions.map(s => ({ id: s.id, type: 'S', text: s.description })),
        ]
        const input = allEntries.map(e => `${e.id}: ${e.text}`).join('\n')
        const msg = await client.messages.create({
          model: 'claude-haiku-4-5',
          max_tokens: 1000,
          system: 'Rewrite each entry in plain English for a non-technical reader. Keep the same ID prefix. One line per entry. Format: "ID: plain text"',
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

  return { simplified, loading, error, copied, simplifySpec, copySimplified }
}
