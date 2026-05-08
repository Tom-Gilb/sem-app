// UNIT_TYPE=Composable
// Feature #120 — Spec as Press Release Generator
import { ref } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface PressRelease {
  headline: string    // ≤80 chars
  body: string        // 2–3 sentences, ~100 words
  quote: string       // exec quote with attribution, ~30 words
  dateline: string    // "FOR IMMEDIATE RELEASE — [today's date ISO]"
}

function buildMockRelease(blocks: SpecBlock[]): PressRelease {
  const allF = blocks.flatMap(b => b.functions)
  const allV = blocks.flatMap(b => b.values)

  const firstFName = allF[0]?.id?.replace(/^F\./, '') ?? 'Solution'
  const firstVName = allV[0]?.id?.replace(/^V\./, '') ?? 'Value'
  const firstFDesc = (allF[0]?.description ?? 'our capability').slice(0, 40)
  const firstVGoal = allV[0]?.goal ?? ''
  const goalPhrase = firstVGoal.trim() ? firstVGoal.trim() : 'significant improvement'

  const headline = `Introducing ${firstFName}: ${firstVName} Made Measurable`.slice(0, 80)

  const body = [
    `Today we announce ${allF.length} capabilities that deliver ${allV.length} measurable outcomes.`,
    `Our approach focuses on ${firstFDesc}.`,
    `With a goal of ${goalPhrase}, teams can now track real progress.`,
  ].join(' ')

  const quote = '"We built this to close the gap between intention and outcome." — The Team'

  const dateline = `FOR IMMEDIATE RELEASE — ${new Date().toISOString().slice(0, 10)}`

  return { headline, body, quote, dateline }
}

export function usePressRelease(blocks: SpecBlock[], apiKey: string) {
  const release = ref<PressRelease | null>(null)
  const generating = ref(false)
  const copied = ref(false)

  async function generate(): Promise<void> {
    generating.value = true

    const isMock = !apiKey || import.meta.env.VITE_MOCK_MODE === 'true'

    if (isMock) {
      release.value = buildMockRelease(blocks)
      generating.value = false
      return
    }

    // Live mode: claude-haiku-4-5
    try {
      const allF = blocks.flatMap(b => b.functions)
      const allV = blocks.flatMap(b => b.values)

      const fList = allF.map(f => `- ${f.id}: ${f.description}`).join('\n')
      const vList = allV.map(v => `- ${v.id}: ${v.description} (goal: ${v.goal})`).join('\n')

      const prompt = `You are a product marketing writer. Generate a press release for a product spec.

Functions:
${fList}

Values (measurable outcomes):
${vList}

Return ONLY valid JSON with these fields:
- headline: string (≤80 chars)
- body: string (2-3 sentences, ~100 words)
- quote: string (~30 words, exec quote with attribution)
- dateline: string ("FOR IMMEDIATE RELEASE — ${new Date().toISOString().slice(0, 10)}")

JSON only, no other text.`

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 512,
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      if (!response.ok) {
        throw new Error(`API error ${response.status}`)
      }

      const data = await response.json()
      const text: string = data.content?.[0]?.text ?? ''
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        release.value = JSON.parse(jsonMatch[0]) as PressRelease
      } else {
        release.value = buildMockRelease(blocks)
      }
    } catch {
      release.value = buildMockRelease(blocks)
    } finally {
      generating.value = false
    }
  }

  async function copyMarkdown(): Promise<void> {
    const r = release.value
    if (!r) return
    const text = [
      r.dateline,
      '',
      `# ${r.headline}`,
      '',
      r.body,
      '',
      `> ${r.quote}`,
    ].join('\n')
    try {
      await navigator.clipboard.writeText(text)
      copied.value = true
      setTimeout(() => { copied.value = false }, 2000)
    } catch {
      // no-op
    }
  }

  return { release, generating, generate, copyMarkdown, copied }
}
