// UNIT_TYPE=Composable
// Feature #83 — Spec "elevator pitch" generator
import { ref, computed } from 'vue'
import type { Ref } from 'vue'
import type { SpecBlock } from '../types/spec'

export function useElevatorPitch(
  spec: Ref<SpecBlock | null>,
  apiKey: Ref<string> | string,
) {
  const pitchOpen = ref(false)
  const generating = ref(false)
  const pitchError = ref<string | null>(null)
  const pitch = ref<string>('')
  const isSpeaking = ref(false)

  const wordCount = computed(() => pitch.value.split(/\s+/).filter(Boolean).length)
  const estimatedSeconds = computed(() => Math.round(wordCount.value / 2.5))

  const resolvedApiKey = (): string => {
    if (typeof apiKey === 'string') return apiKey
    return apiKey.value
  }

  function buildMockPitch(s: SpecBlock): string {
    const fCount = s.functions.length
    const vCount = s.values.length
    const sCount = s.solutions.length
    const firstVId = s.values[0]?.id ?? 'measurable improvement'
    const scaleSnippet = s.values[0]?.scale
      ? s.values[0].scale.slice(0, 40)
      : 'objective metrics'

    return (
      `This spec defines ${fCount} function${fCount !== 1 ? 's' : ''} targeting ${vCount} measurable outcome${vCount !== 1 ? 's' : ''}. ` +
      `The primary value delivered is ${firstVId}. ` +
      `Success is tracked via ${scaleSnippet}. ` +
      `${sCount} solution approach${sCount !== 1 ? 'es are' : ' is'} identified, ordered by value-to-cost ratio. ` +
      `The result: a team aligned on what matters, measured by data, not opinion.`
    )
  }

  async function generatePitch(): Promise<void> {
    if (!spec.value) return

    generating.value = true
    pitchError.value = null
    pitch.value = ''

    const key = resolvedApiKey()

    if (!key || import.meta.env.VITE_MOCK_MODE === 'true') {
      await new Promise(r => setTimeout(r, 400))
      pitch.value = buildMockPitch(spec.value)
      generating.value = false
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
        s.values[0] ? `Primary value: ${s.values[0].id} — ${s.values[0].scale}` : '',
        s.functions[0] ? `Primary function: ${s.functions[0].description}` : '',
      ].filter(Boolean).join('\n')

      const msg = await client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 200,
        system: 'Write a 30-second elevator pitch (~75 words) for the spec. Structure: aim / benefit / measure / call to action. Plain conversational English. No bullet points, just prose.',
        messages: [{ role: 'user', content: context }],
      })

      pitch.value = msg.content[0].type === 'text' ? msg.content[0].text.trim() : buildMockPitch(s)
    } catch (e) {
      pitchError.value = e instanceof Error ? e.message : 'Pitch generation failed'
      if (spec.value) pitch.value = buildMockPitch(spec.value)
    }

    generating.value = false
  }

  let utterance: SpeechSynthesisUtterance | null = null

  function speak(): void {
    if (!('speechSynthesis' in window)) return
    if (!pitch.value) return
    stopSpeaking()
    utterance = new SpeechSynthesisUtterance(pitch.value)
    utterance.rate = 1.0
    utterance.onstart = () => { isSpeaking.value = true }
    utterance.onend = () => { isSpeaking.value = false }
    utterance.onerror = () => { isSpeaking.value = false }
    window.speechSynthesis.speak(utterance)
  }

  function stopSpeaking(): void {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    isSpeaking.value = false
  }

  async function copyPitch(): Promise<void> {
    if (!pitch.value) return
    try {
      await navigator.clipboard.writeText(pitch.value)
    } catch { /* no-op */ }
  }

  return {
    pitchOpen,
    generating,
    pitchError,
    pitch,
    wordCount,
    estimatedSeconds,
    isSpeaking,
    generatePitch,
    speak,
    stopSpeaking,
    copyPitch,
  }
}
