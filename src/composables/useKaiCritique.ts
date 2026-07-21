// UNIT_TYPE=Composable
// Feature #48 — "What would Kai do?" critique
import { ref } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface KaiCritique {
  id: string
  principle: 'measurability' | 'specificity' | 'traceability' | 'ambition' | 'clarity'
  entryId: string
  issue: string        // what's wrong
  suggestion: string   // what Kai would say instead / recommend
  severity: 'high' | 'medium' | 'low'
}

export function useKaiCritique(apiKey?: string) {
  const critiques = ref<KaiCritique[]>([])
  const loading = ref(false)
  const error = ref('')

  async function generateCritique(spec: SpecBlock): Promise<void> {
    loading.value = true
    error.value = ''
    critiques.value = []

    if (!apiKey || import.meta.env.VITE_MOCK_MODE === 'true') {
      // Mock: generate critiques from spec content
      await new Promise(r => setTimeout(r, 600))
      const allEntries = [...spec.functions, ...spec.values, ...spec.solutions]
      const mockCritiques: KaiCritique[] = []

      // Critique 1: first V. entry — measurability
      const firstV = spec.values[0]
      if (firstV) {
        mockCritiques.push({
          id: 'k1',
          principle: 'measurability',
          entryId: firstV.id,
          issue: firstV.scale
            ? `Scale "${firstV.scale}" could be more operationally precise.`
            : 'No Scale defined — cannot measure this value.',
          suggestion: 'Gilb: "Every V. needs a Scale that any two observers can measure independently. State the unit and measurement method explicitly."',
          severity: firstV.scale ? 'medium' : 'high',
        })
      }

      // Critique 2: first F. entry — specificity
      const firstF = spec.functions[0]
      if (firstF) {
        mockCritiques.push({
          id: 'k2',
          principle: 'specificity',
          entryId: firstF.id,
          issue: 'Function description uses passive voice or vague language.',
          suggestion: 'Gilb: "Functions must state precisely who does what to whom, in what context. Avoid passive constructions like \'is provided\' — write \'System delivers X to Y within Z conditions\'."',
          severity: 'medium',
        })
      }

      // Critique 3: V. goal — ambition
      const secondV = spec.values[1] || spec.values[0]
      if (secondV) {
        mockCritiques.push({
          id: 'k3',
          principle: 'ambition',
          entryId: secondV.id,
          issue: `Goal "${secondV.goal || 'not set'}" — is this truly ambitious? Kai would challenge whether this represents the maximum feasible improvement.`,
          suggestion: 'Gilb: "Goals should represent the best possible outcome, not a safe estimate. Ask: what would delight the stakeholder? Start there and work backwards."',
          severity: 'low',
        })
      }

      // Critique 4: first S. entry — traceability
      const firstS = spec.solutions[0]
      if (firstS) {
        mockCritiques.push({
          id: 'k4',
          principle: 'traceability',
          entryId: firstS.id,
          issue: 'Solution description does not explicitly reference which Function or Value it implements.',
          suggestion: 'Gilb: "Every Solution must be traceable to its parent Function or Value entry. State \'implements Function X\' or \'delivers Value Y\' explicitly — traceability is mandatory in Planguage."',
          severity: 'high',
        })
      }

      // Critique 5: general — clarity
      const entry = allEntries[Math.floor(allEntries.length / 2)] || allEntries[0]
      if (entry) {
        mockCritiques.push({
          id: 'k5',
          principle: 'clarity',
          entryId: entry.id,
          issue: 'Description contains compound sentences that mix multiple requirements.',
          suggestion: 'Gilb: "Each entry should express a single, atomic requirement. Split compound entries — \'and\' in a description is a warning sign. One idea, one entry."',
          severity: 'medium',
        })
      }

      critiques.value = mockCritiques
    } else {
      // Live API
      try {
        const { Anthropic } = await import('@anthropic-ai/sdk')
        const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
        const specText = JSON.stringify(spec, null, 2).slice(0, 3000)
        const msg = await client.messages.create({
          model: 'claude-opus-4-5',
          max_tokens: 800,
          system: 'You are Tom Gilb, the creator of Planguage. You are reviewing a spec. Return a JSON array of exactly 5 objects with keys: id (string), principle (one of measurability|specificity|traceability|ambition|clarity), entryId (string — an id from the spec), issue (string — what is wrong), suggestion (string — start with "Gilb: \\""), severity (high|medium|low). Be direct and educational.',
          messages: [{ role: 'user', content: `Spec:\n${specText}\n\nReturn only valid JSON array.` }],
        })
        const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
        const parsed = JSON.parse(text.match(/\[[\s\S]*\]/)?.[0] || '[]') as KaiCritique[]
        critiques.value = parsed.slice(0, 5)
      } catch (e) {
        error.value = e instanceof Error ? e.message : 'Critique failed'
      }
    }

    loading.value = false
  }

  return { critiques, loading, error, generateCritique }
}
