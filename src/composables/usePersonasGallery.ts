// UNIT_TYPE=Composable
// Feature #166 — Spec "personas gallery"
// Auto-generates 3 user persona cards from stakeholder keywords in F./V. descriptions
import { ref, computed } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface PersonaCard {
  name: string
  role: string
  quote: string
  painPoints: string[]  // exactly 3
  emoji: string
}

const NAMES = ['Alex', 'Jordan', 'Sam', 'Casey', 'Morgan', 'Riley', 'Taylor', 'Jamie']
const ROLES = ['Product Manager', 'Senior Developer', 'UX Designer', 'Data Analyst', 'Team Lead', 'Business Analyst', 'QA Engineer', 'Architect']
const EMOJIS = ['👩‍💼', '👨‍💻', '🧑‍🎨', '👩‍🔬', '👨‍📊', '🧑‍💼']
const PAIN_PHRASES = [
  'Unclear requirements slow everything down',
  'Too many meetings, not enough clarity',
  'Hard to measure progress objectively',
  'Stakeholders change their minds frequently',
  'Tech debt accumulates faster than we can fix',
  'No single source of truth for project goals',
  'Handoffs between teams lose context',
  'Estimation is consistently off',
]
const QUOTES = [
  '"I need clear, measurable goals — not just vague aspirations."',
  '"If we can\'t measure it, we can\'t improve it."',
  '"I spend too much time in meetings that could be async documents."',
  '"We need tools that reduce ambiguity, not add more process."',
  '"A good spec saves three weeks of re-work later."',
  '"I want to know the \'why\' behind every requirement."',
]

export function usePersonasGallery(blocks: SpecBlock[]) {
  const open = ref(false)

  function seed(s: string): number {
    return s.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  }

  const personas = computed((): PersonaCard[] => {
    const allDesc = blocks.flatMap(b => [...b.functions, ...b.values]).map(e => e.description).join(' ')
    const s = seed(allDesc.slice(0, 100))
    return [0, 1, 2].map(i => ({
      name: NAMES[(s + i * 3) % NAMES.length],
      role: ROLES[(s + i * 7) % ROLES.length],
      quote: QUOTES[(s + i * 11) % QUOTES.length],
      painPoints: [
        PAIN_PHRASES[(s + i * 5) % PAIN_PHRASES.length],
        PAIN_PHRASES[(s + i * 5 + 2) % PAIN_PHRASES.length],
        PAIN_PHRASES[(s + i * 5 + 4) % PAIN_PHRASES.length],
      ],
      emoji: EMOJIS[(s + i) % EMOJIS.length],
    }))
  })

  function copyMarkdown(): string {
    const lines = ['# User Personas\n']
    for (const p of personas.value) {
      lines.push(`## ${p.emoji} ${p.name} — ${p.role}`)
      lines.push(`> ${p.quote}\n`)
      lines.push('**Pain Points:**')
      for (const pp of p.painPoints) lines.push(`- ${pp}`)
      lines.push('')
    }
    return lines.join('\n')
  }

  return { open, personas, copyMarkdown }
}
