// UNIT_TYPE=Composable
// Feature #167 — "Spec as sprint backlog" exporter
// Per F. entry: 2–3 Jira-style story cards (title + AC + story points)
import { ref, computed } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface StoryCard {
  storyId: string        // "F-1.1", "F-1.2" etc.
  parentFId: string
  title: string          // "As a [role], I want to [action] so that [outcome]"
  acceptanceCriteria: string[]  // 2 criteria
  storyPoints: number    // seeded: 1/2/3/5/8
  type: 'story' | 'task' | 'bug'
}

const FIBONACCI = [1, 2, 3, 5, 8]
const ROLES = ['practitioner', 'team lead', 'product manager', 'developer', 'analyst']
const AC_PREFIXES = ['Given', 'When', 'Then']

export function useSprintBacklog(blocks: SpecBlock[]) {
  const open = ref(false)
  const copyMode = ref<'markdown' | 'json'>('markdown')
  const copied = ref(false)

  function seed(s: string): number {
    return s.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  }

  const stories = computed((): StoryCard[] => {
    const cards: StoryCard[] = []
    blocks.flatMap(b => b.functions).forEach((f, fi) => {
      const s = seed(f.id)
      const count = 2 + (s % 2)  // 2 or 3 stories per F.
      for (let i = 0; i < count; i++) {
        const role = ROLES[(s + i) % ROLES.length]
        const sp = FIBONACCI[(s + i * 3) % FIBONACCI.length]
        const title = `As a ${role}, I want to ${f.description.slice(0, 40)} so that I can achieve the defined goal`
        const ac = [
          `${AC_PREFIXES[0]} the ${role} provides input, ${AC_PREFIXES[1]} the system processes it, ${AC_PREFIXES[2]} a result is available`,
          `${AC_PREFIXES[0]} an error occurs, ${AC_PREFIXES[1]} the system shows a clear message, ${AC_PREFIXES[2]} the ${role} can retry`,
        ]
        cards.push({
          storyId: `F-${fi + 1}.${i + 1}`,
          parentFId: f.id,
          title,
          acceptanceCriteria: ac,
          storyPoints: sp,
          type: 'story' as const,
        })
      }
    })
    return cards
  })

  function toMarkdown(): string {
    const lines = ['# Sprint Backlog\n']
    let current = ''
    for (const s of stories.value) {
      if (s.parentFId !== current) {
        current = s.parentFId
        lines.push(`\n## ${s.parentFId}`)
      }
      lines.push(`\n### [${s.storyPoints}pt] ${s.storyId}: ${s.title}`)
      lines.push('**Acceptance Criteria:**')
      for (const ac of s.acceptanceCriteria) lines.push(`- ${ac}`)
    }
    return lines.join('\n')
  }

  function toJson(): string {
    return JSON.stringify(stories.value.map(s => ({
      id: s.storyId,
      parent: s.parentFId,
      title: s.title,
      points: s.storyPoints,
      type: s.type,
      ac: s.acceptanceCriteria,
    })), null, 2)
  }

  async function copyToClipboard() {
    const text = copyMode.value === 'json' ? toJson() : toMarkdown()
    await navigator.clipboard.writeText(text)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }

  return { open, stories, copyMode, copied, toMarkdown, toJson, copyToClipboard }
}
