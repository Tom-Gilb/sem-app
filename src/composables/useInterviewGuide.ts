// UNIT_TYPE=Composable
// Feature #75 — AI stakeholder interview guide
import { ref } from 'vue'
import type { Ref } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface InterviewQuestion {
  stakeholder: string
  question: string
}

export interface GuideGroup {
  stakeholder: string
  questions: InterviewQuestion[]
}

const STAKEHOLDER_KEYWORDS: Record<string, string[]> = {
  User: ['user', 'users'],
  Customer: ['customer', 'customers', 'client', 'clients'],
  Manager: ['manager', 'managers', 'management'],
  Developer: ['developer', 'developers', 'engineer', 'engineers'],
  Admin: ['admin', 'admins', 'administrator', 'administrators'],
  Stakeholder: ['stakeholder', 'stakeholders'],
  Trainer: ['trainer', 'trainers', 'training'],
  Practitioner: ['practitioner', 'practitioners'],
  Team: ['team', 'teams'],
  Organisation: ['org', 'organisation', 'organization'],
}

const MOCK_QUESTIONS: Record<string, string[]> = {
  User: [
    'What outcome matters most to you when using this system?',
    'How would you measure success in your daily workflow?',
    "What's your biggest frustration with the current approach?",
    'How often would you engage with this feature, and in what context?',
    'If this goal were achieved, what would you notice first?',
  ],
  Customer: [
    'What problem does this solution solve that nothing else has addressed?',
    'How does this fit into your current process or workflow?',
    'What would make you recommend this to a colleague?',
    'How do you currently measure the cost of the problem this solves?',
    'What would a perfect outcome look like for you six months from now?',
  ],
  Manager: [
    'How does this align with team or department objectives?',
    'What metrics will you report upward?',
    "What's your biggest risk if this spec goal isn't achieved?",
    'Who else needs to approve or be aware of progress?',
    'What does success look like at the 90-day mark?',
  ],
  Developer: [
    'What technical constraints should we know before implementation?',
    'How will this interact with the existing architecture?',
    'What does done look like from a code quality perspective?',
    'Which risks keep you up at night for this feature?',
    'What tooling or automation would speed up delivery of this spec?',
  ],
  Admin: [
    'What configuration or permissions model do you expect?',
    'How will you on-board new users to this capability?',
    'What audit trail requirements apply here?',
    'How should errors or misconfigurations surface to you?',
    'What existing admin workflows does this need to integrate with?',
  ],
  Stakeholder: [
    'What business outcome are you ultimately accountable for here?',
    'How will you know in three months if this was the right investment?',
    'What trade-offs are you willing to accept to hit the goal level?',
    'Who are the most important beneficiaries of this spec goal?',
    'What would cause you to pause or cancel this initiative?',
  ],
  Trainer: [
    'What skills gaps does this feature need to close for end users?',
    'How will training be delivered — self-serve, live, or embedded?',
    'What does a successful learner look like after completing training?',
    'How do you measure training effectiveness today?',
    'What is the biggest barrier to adoption you have seen in similar rollouts?',
  ],
  Practitioner: [
    'What day-to-day practice does this spec aim to improve?',
    'Which professional standards or norms should the solution respect?',
    'How do you currently document and share best practices?',
    'What would an expert peer say is missing from the current approach?',
    'How would this feature change how you spend your time each week?',
  ],
  Team: [
    'How will your team coordinate around this new capability?',
    'What shared agreements need to exist before this can succeed?',
    'How does this change your team\'s existing responsibilities?',
    'What does a high-performing team look like using this system?',
    'How will you surface blockers to leadership early?',
  ],
  Organisation: [
    'How does this align with the organisation\'s strategic priorities?',
    'What governance or approval process applies to this initiative?',
    'How will success be communicated across the organisation?',
    'What organisational constraints limit the solution space?',
    'Which departments or units will be most affected by this change?',
  ],
}

const GENERIC_QUESTIONS: string[] = [
  'What does success look like to you for this spec goal?',
  'What are the biggest risks or obstacles you foresee?',
  'How will you measure progress toward the target level?',
  'Who else has a stake in this outcome?',
  'What would you change about the current approach first?',
]

function detectStakeholders(spec: SpecBlock | null): string[] {
  if (!spec) return ['User', 'Stakeholder']

  const allDescriptions = [
    ...spec.functions.map(f => f.description),
    ...spec.values.map(v => v.description),
    ...spec.solutions.map(s => s.description),
  ].join(' ').toLowerCase()

  const detected = new Set<string>()

  for (const [name, keywords] of Object.entries(STAKEHOLDER_KEYWORDS)) {
    for (const kw of keywords) {
      const pattern = new RegExp(`\\b${kw}\\b`, 'i')
      if (pattern.test(allDescriptions)) {
        detected.add(name)
        break
      }
    }
  }

  // Fallback
  if (detected.size === 0) {
    detected.add('User')
    detected.add('Stakeholder')
  }
  if (!detected.has('User')) {
    detected.add('User')
  }

  return Array.from(detected)
}

export function useInterviewGuide(
  spec: Ref<SpecBlock | null>,
  apiKey: Ref<string> | string,
) {
  const guideOpen = ref(false)
  const generating = ref(false)
  const guideError = ref<string | null>(null)
  const guideGroups = ref<GuideGroup[]>([])

  function buildMockGroups(stakeholders: string[]): GuideGroup[] {
    return stakeholders.map((stakeholder) => {
      const questions = (MOCK_QUESTIONS[stakeholder] ?? GENERIC_QUESTIONS).map(q => ({
        stakeholder,
        question: q,
      }))
      return { stakeholder, questions }
    })
  }

  function specSummary(s: SpecBlock): string {
    const vLines = s.values.map(v => `${v.id}: ${v.description} (Scale: ${v.scale})`).join('\n')
    const fLines = s.functions.map(f => `${f.id}: ${f.description}`).join('\n')
    return `Values:\n${vLines}\n\nFunctions:\n${fLines}`
  }

  async function generateGuide(): Promise<void> {
    generating.value = true
    guideError.value = null
    guideGroups.value = []

    const currentSpec = spec.value
    const stakeholders = detectStakeholders(currentSpec)

    const key = typeof apiKey === 'string' ? apiKey : apiKey.value

    if (!key || import.meta.env.VITE_MOCK_MODE === 'true') {
      await new Promise(r => setTimeout(r, 400))
      guideGroups.value = buildMockGroups(stakeholders)
    } else {
      try {
        const { Anthropic } = await import('@anthropic-ai/sdk')
        const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true })
        const summary = currentSpec ? specSummary(currentSpec) : 'No spec provided.'

        const results: GuideGroup[] = []

        for (const stakeholder of stakeholders) {
          const msg = await client.messages.create({
            model: 'claude-haiku-4-5',
            max_tokens: 512,
            messages: [{
              role: 'user',
              content: `Generate 5 open-ended interview questions for the ${stakeholder} stakeholder about this Planguage spec:\n\n${summary}\n\nReturn only a numbered list, one question per line.`,
            }],
          })
          const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
          const lines = text.split('\n')
            .map(l => l.replace(/^\d+[\.\)]\s*/, '').trim())
            .filter(l => l.length > 0)
            .slice(0, 5)
          results.push({
            stakeholder,
            questions: lines.map(q => ({ stakeholder, question: q })),
          })
        }
        guideGroups.value = results
      } catch (e) {
        guideError.value = e instanceof Error ? e.message : 'Guide generation failed'
      }
    }

    generating.value = false
  }

  function copyGuide(): void {
    const lines: string[] = ['## Stakeholder Interview Guide', '']
    for (const group of guideGroups.value) {
      lines.push(`### ${group.stakeholder}`)
      group.questions.forEach((q, i) => {
        lines.push(`${i + 1}. ${q.question}`)
      })
      lines.push('')
    }
    const text = lines.join('\n')
    navigator.clipboard.writeText(text).catch(() => { /* no-op */ })
  }

  function clearGuide(): void {
    guideGroups.value = []
    guideError.value = null
  }

  return {
    guideOpen,
    generating,
    guideError,
    guideGroups,
    generateGuide,
    copyGuide,
    clearGuide,
    detectStakeholders,
  }
}
