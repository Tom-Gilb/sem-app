// UNIT_TYPE=Composable
// Feature #127 — Spec as Job Description Generator
import { ref } from 'vue'
import type { Ref } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface JobDescription {
  roleSummary: string
  responsibilities: string[]
  successMetrics: string[]
  qualifications: string[]
  copyMarkdown(): string
}

const DEFAULT_QUALIFICATIONS = [
  'Experience with modern software engineering practices',
  'Ability to work with measurable goals and metrics',
  'Strong communication with technical and non-technical stakeholders',
]

function parseGoalValue(goal: string): string {
  if (!goal) return ''
  const match = goal.match(/^Goal\s+\[[^\]]*\]\s+(.+)/)
  if (match) return match[1].trim()
  const simpleMatch = goal.match(/^Goal\s+(.+)/)
  if (simpleMatch) return simpleMatch[1].trim()
  return goal.trim()
}

function buildMockJD(blocks: SpecBlock[]): JobDescription {
  const allFunctions = blocks.flatMap(b => b.functions)
  const allValues = blocks.flatMap(b => b.values)
  const allSolutions = blocks.flatMap(b => b.solutions)

  const firstFDesc = allFunctions[0]?.description ?? ''
  const vCount = allValues.length
  const roleSummary = allFunctions.length > 0
    ? `Join us to ${firstFDesc.slice(0, 40)} and deliver ${vCount} measurable outcome${vCount !== 1 ? 's' : ''}.`
    : `Join us to deliver ${vCount} measurable outcome${vCount !== 1 ? 's' : ''}.`

  const responsibilities = allFunctions.map(f =>
    `• Lead ${f.id}: ${f.description.slice(0, 50)}`
  )

  const successMetrics = allValues.map(v => {
    const goalParsed = parseGoalValue(v.goal)
    return goalParsed
      ? `• Achieve ${goalParsed} for ${v.id}`
      : `• Achieve measurable improvement for ${v.id}`
  })

  // Derive qualifications from S. entries or use defaults
  let qualifications: string[]
  if (allSolutions.length >= 3) {
    qualifications = allSolutions.slice(0, 3).map(s => `Experience with ${s.id}`)
  } else if (allSolutions.length > 0) {
    const fromSolutions = allSolutions.map(s => `Experience with ${s.id}`)
    qualifications = [
      ...fromSolutions,
      ...DEFAULT_QUALIFICATIONS.slice(0, 3 - fromSolutions.length),
    ]
  } else {
    qualifications = [...DEFAULT_QUALIFICATIONS]
  }

  const copyMarkdown = (): string => {
    const lines: string[] = [
      '## Role Summary',
      roleSummary,
      '',
      '## Responsibilities',
      ...responsibilities,
      '',
      '## Success Metrics',
      ...successMetrics,
      '',
      '## Qualifications',
      ...qualifications,
    ]
    return lines.join('\n')
  }

  return { roleSummary, responsibilities, successMetrics, qualifications, copyMarkdown }
}

export function useJobDescription(blocks: SpecBlock[], apiKey: string) {
  const jd: Ref<JobDescription | null> = ref(null)
  const generating: Ref<boolean> = ref(false)
  const copied: Ref<boolean> = ref(false)

  async function generate(): Promise<void> {
    generating.value = true
    const isMock = !apiKey || import.meta.env.VITE_MOCK_MODE === 'true'
    try {
      if (isMock) {
        jd.value = buildMockJD(blocks)
        return
      }

      // Live mode: claude-haiku-4-5
      const allFunctions = blocks.flatMap(b => b.functions)
      const allValues = blocks.flatMap(b => b.values)
      const allSolutions = blocks.flatMap(b => b.solutions)

      const prompt = `You are a technical job description writer.
Given these Planguage spec entries, generate a structured job description.
Return ONLY valid JSON (no markdown) with fields:
  roleSummary (string), responsibilities (string[]), successMetrics (string[]), qualifications (string[])

F. entries: ${JSON.stringify(allFunctions.map(f => ({ id: f.id, description: f.description })))}
V. entries: ${JSON.stringify(allValues.map(v => ({ id: v.id, description: v.description, goal: v.goal })))}
S. entries: ${JSON.stringify(allSolutions.map(s => ({ id: s.id, description: s.description })))}`

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 2048,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      if (!response.ok) throw new Error(`API error: ${response.status}`)
      const data = await response.json() as { content?: Array<{ type: string; text?: string }> }
      const text = data.content?.find(c => c.type === 'text')?.text ?? '{}'
      const parsed = JSON.parse(text) as {
        roleSummary: string
        responsibilities: string[]
        successMetrics: string[]
        qualifications: string[]
      }
      const { roleSummary, responsibilities, successMetrics, qualifications } = parsed
      const copyMarkdown = (): string => {
        const lines: string[] = [
          '## Role Summary',
          roleSummary,
          '',
          '## Responsibilities',
          ...responsibilities,
          '',
          '## Success Metrics',
          ...successMetrics,
          '',
          '## Qualifications',
          ...qualifications,
        ]
        return lines.join('\n')
      }
      jd.value = { roleSummary, responsibilities, successMetrics, qualifications, copyMarkdown }
    } catch {
      // Fallback to mock
      jd.value = buildMockJD(blocks)
    } finally {
      generating.value = false
    }
  }

  async function copyMarkdown(): Promise<void> {
    if (!jd.value) return
    const text = jd.value.copyMarkdown()
    try {
      await navigator.clipboard.writeText(text)
      copied.value = true
      setTimeout(() => { copied.value = false }, 2000)
    } catch {
      // clipboard not available
    }
  }

  return { jd, generating, generate, copyMarkdown, copied }
}
