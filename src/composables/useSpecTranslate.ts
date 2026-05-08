// UNIT_TYPE=Composable
// Feature #70 — Multi-language spec export
import { ref } from 'vue'
import type { Ref } from 'vue'
import type { SpecBlock } from '../types/spec'
import { parseApiError } from '../utils/parseApiError'

export type SupportedLang = 'fr' | 'de' | 'ja'

export interface TranslatedEntry {
  id: string
  type: 'F' | 'V' | 'S'
  originalDescription: string
  translatedDescription: string
}

const LANG_PREFIXES: Record<SupportedLang, string> = {
  fr: '[FR]',
  de: '[DE]',
  ja: '[JA]',
}

const LANG_NAMES: Record<SupportedLang, string> = {
  fr: 'French',
  de: 'German',
  ja: 'Japanese',
}

export function useSpecTranslate(
  spec: Ref<SpecBlock | null>,
  apiKey: Ref<string> | string,
) {
  const targetLanguage = ref<SupportedLang>('fr')
  const translating = ref(false)
  const translateError = ref<string | null>(null)
  const translatedEntries = ref<TranslatedEntry[]>([])
  const translateOpen = ref(false)

  function resolveApiKey(): string {
    return typeof apiKey === 'string' ? apiKey : apiKey.value
  }

  async function translateSpec(): Promise<void> {
    const currentSpec = spec.value
    if (!currentSpec) {
      translatedEntries.value = []
      return
    }

    translating.value = true
    translateError.value = null
    translatedEntries.value = []

    const lang = targetLanguage.value
    const isMock = !resolveApiKey() || import.meta.env.VITE_MOCK_MODE === 'true'

    if (isMock) {
      // Demo mode — simulate a plausible translation by word-swapping a fixed
      // dictionary per language so every word in the description is visibly changed
      // rather than the original text being preserved with just a suffix appended.
      await new Promise<void>(r => setTimeout(r, 400))
      const prefix = LANG_PREFIXES[lang]

      const MOCK_DICT: Record<SupportedLang, Record<string, string>> = {
        fr: {
          the: 'le', system: 'système', user: 'utilisateur', data: 'données',
          input: 'entrée', output: 'sortie', performance: 'performance',
          report: 'rapport', error: 'erreur', time: 'temps', response: 'réponse',
          load: 'charge', speed: 'vitesse', access: 'accès', plan: 'plan',
          feature: 'fonctionnalité', value: 'valeur', goal: 'objectif',
          function: 'fonction', solution: 'solution', requirement: 'exigence',
        },
        de: {
          the: 'das', system: 'System', user: 'Benutzer', data: 'Daten',
          input: 'Eingabe', output: 'Ausgabe', performance: 'Leistung',
          report: 'Bericht', error: 'Fehler', time: 'Zeit', response: 'Antwort',
          load: 'Last', speed: 'Geschwindigkeit', access: 'Zugriff', plan: 'Plan',
          feature: 'Funktion', value: 'Wert', goal: 'Ziel',
          function: 'Funktion', solution: 'Lösung', requirement: 'Anforderung',
        },
        ja: {
          the: 'その', system: 'システム', user: 'ユーザー', data: 'データ',
          input: '入力', output: '出力', performance: 'パフォーマンス',
          report: 'レポート', error: 'エラー', time: '時間', response: '応答',
          load: '負荷', speed: '速度', access: 'アクセス', plan: 'プラン',
          feature: '機能', value: '価値', goal: '目標',
          function: '機能', solution: '解決策', requirement: '要件',
        },
      }

      function mockTranslate(text: string): string {
        const dict = MOCK_DICT[lang]
        // Replace whole words (case-insensitive) with their translation
        let result = text
        for (const [en, tr] of Object.entries(dict)) {
          result = result.replace(new RegExp(`\\b${en}\\b`, 'gi'), tr)
        }
        return `${prefix} ${result}`
      }

      translatedEntries.value = [
        ...currentSpec.functions.map((f): TranslatedEntry => ({
          id: f.id,
          type: 'F',
          originalDescription: f.description,
          translatedDescription: mockTranslate(f.description),
        })),
        ...currentSpec.values.map((v): TranslatedEntry => ({
          id: v.id,
          type: 'V',
          originalDescription: v.description,
          translatedDescription: mockTranslate(v.description),
        })),
        ...currentSpec.solutions.map((s): TranslatedEntry => ({
          id: s.id,
          type: 'S',
          originalDescription: s.description,
          translatedDescription: mockTranslate(s.description),
        })),
      ]
    } else {
      try {
        const { Anthropic } = await import('@anthropic-ai/sdk')
        const client = new Anthropic({ apiKey: resolveApiKey(), dangerouslyAllowBrowser: true })
        const allEntries = [
          ...currentSpec.functions.map(f => ({ id: f.id, type: 'F' as const, text: f.description })),
          ...currentSpec.values.map(v => ({ id: v.id, type: 'V' as const, text: v.description })),
          ...currentSpec.solutions.map(s => ({ id: s.id, type: 'S' as const, text: s.description })),
        ]
        const input = JSON.stringify(allEntries.map(e => ({ id: e.id, text: e.text })))

        // Prefill the assistant turn with '[' to force a raw JSON array response
        // (no markdown fences, no preamble). The API returns the continuation after '['.
        const msg = await client.messages.create({
          model: 'claude-haiku-4-5',
          max_tokens: 4096,
          system: `You are a translation API. Translate each Planguage spec description to ${LANG_NAMES[lang]}. Return ONLY a valid JSON array — no markdown, no explanation, no code fences — with shape [{id: string, translated: string}].`,
          messages: [
            { role: 'user', content: input },
            { role: 'assistant', content: '[' },
          ],
        })

        // Reconstruct the full JSON array (prefill '[' + continuation)
        const continuation = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ']'
        const rawJson = '[' + continuation

        // Parse with a fallback that strips markdown fences if they appear anyway
        let parsed: Array<{ id: string; translated: string }> = []
        try {
          parsed = JSON.parse(rawJson)
        } catch {
          const fence = rawJson.match(/\[[\s\S]*\]/)
          if (fence) parsed = JSON.parse(fence[0])
        }

        translatedEntries.value = allEntries.map((entry): TranslatedEntry => {
          const match = parsed.find(p => p.id === entry.id)
          return {
            id: entry.id,
            type: entry.type,
            originalDescription: entry.text,
            translatedDescription: match?.translated ?? entry.text,
          }
        })
      } catch (e) {
        const parsed = parseApiError(e)
        translateError.value = `${parsed.title}: ${parsed.detail}`
        if (parsed.actionUrl) translateError.value += ` (${parsed.actionUrl})`
      }
    }

    translating.value = false
  }

  function copyTranslation(): void {
    const lang = targetLanguage.value.toUpperCase()
    const lines = [`## Translated Spec (${lang})`, '', '| ID | Original | Translated |', '|---|---|---|']
    for (const entry of translatedEntries.value) {
      const orig = entry.originalDescription.replace(/\|/g, '\\|')
      const trans = entry.translatedDescription.replace(/\|/g, '\\|')
      lines.push(`| ${entry.id} | ${orig} | ${trans} |`)
    }
    try {
      navigator.clipboard.writeText(lines.join('\n'))
    } catch {
      // clipboard not available
    }
  }

  function clearTranslation(): void {
    translatedEntries.value = []
    translateError.value = null
  }

  return {
    targetLanguage,
    translating,
    translateError,
    translatedEntries,
    translateOpen,
    translateSpec,
    copyTranslation,
    clearTranslation,
  }
}
