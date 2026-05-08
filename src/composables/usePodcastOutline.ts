// UNIT_TYPE=Composable
// Feature #175 — Spec as podcast episode outline
// Generates a 3-act podcast outline (Hook / Body / CTA) from the spec blocks.
import { ref, computed } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface PodcastSegment {
  act: 'Hook' | 'Body' | 'CTA'
  title: string
  bullets: string[]
  durationMins: number
}

export interface PodcastOutline {
  episodeTitle: string
  totalMins: number
  segments: [PodcastSegment, PodcastSegment, PodcastSegment]
}

const UNIT_KEYWORDS = ['%', 'hrs', '$', 'ms', 'score', 'rate', 'pts', 'days']

function domainBadge(description: string): string {
  for (const kw of UNIT_KEYWORDS) {
    if (description.toLowerCase().includes(kw)) return kw
  }
  const words = description.split(/\s+/)
  return words[0] ?? 'General'
}

export function buildPodcastOutline(blocks: SpecBlock[]): PodcastOutline {
  const functions = blocks.flatMap(b => b.functions)
  const values = blocks.flatMap(b => b.values)
  const solutions = blocks.flatMap(b => b.solutions)

  const firstF = functions[0]
  const firstV = values[0]
  const firstS = solutions[0]

  // Episode title
  const episodeTitle = firstF
    ? `${firstF.description.slice(0, 40)}: A Planguage Deep Dive`
    : 'Planguage Spec Walkthrough: A Deep Dive'

  // Hook segment
  const hookBullets: string[] = [
    firstF ? firstF.description.slice(0, 80) : 'No function entries defined',
    `${values.length} value goal${values.length === 1 ? '' : 's'} defined`,
    firstV ? domainBadge(firstV.description) : 'General',
  ]
  const hook: PodcastSegment = {
    act: 'Hook',
    title: 'Why This Spec Matters',
    bullets: hookBullets,
    durationMins: 2,
  }

  // Body segment — up to 3 V. entry goals
  const bodyBullets: string[] = values.slice(0, 3).map(v =>
    v.goal.trim()
      ? `Goal: ${v.goal} — ${v.id}`
      : `Value entry ${v.id} — goal not yet defined`,
  )
  if (bodyBullets.length === 0) {
    bodyBullets.push('No value goals defined yet')
  }
  const body: PodcastSegment = {
    act: 'Body',
    title: firstV ? firstV.description.slice(0, 50) : 'Value Deep Dive',
    bullets: bodyBullets,
    durationMins: 2 + bodyBullets.length,
  }

  // CTA segment
  const currentYear = new Date().getFullYear()
  const ctaBullets: string[] = [
    firstS ? firstS.description.slice(0, 80) : 'Implement the highest-priority solution',
    'Share this spec with stakeholders',
    `Set a review date for ${currentYear + 1}`,
  ]
  const cta: PodcastSegment = {
    act: 'CTA',
    title: 'What To Do Next',
    bullets: ctaBullets,
    durationMins: 1,
  }

  const totalMins = hook.durationMins + body.durationMins + cta.durationMins

  return {
    episodeTitle,
    totalMins,
    segments: [hook, body, cta],
  }
}

export function usePodcastOutline(blocks: SpecBlock[]) {
  const open = ref(false)
  const copied = ref(false)

  const outline = computed((): PodcastOutline => {
    if (blocks.length === 0) {
      return {
        episodeTitle: 'Planguage Spec Walkthrough: A Deep Dive',
        totalMins: 6,
        segments: [
          { act: 'Hook', title: 'Why This Spec Matters', bullets: ['No spec loaded'], durationMins: 2 },
          { act: 'Body', title: 'Value Deep Dive', bullets: ['No value goals defined yet'], durationMins: 3 },
          { act: 'CTA', title: 'What To Do Next', bullets: ['Generate a spec first'], durationMins: 1 },
        ],
      }
    }
    return buildPodcastOutline(blocks)
  })

  async function copyMarkdown(): Promise<void> {
    const o = outline.value
    const lines: string[] = [
      `# Episode: ${o.episodeTitle}`,
      '',
      `Runtime: ~${o.totalMins} mins`,
      '',
    ]
    o.segments.forEach((seg, idx) => {
      lines.push(`## Act ${idx + 1}: ${seg.act} — ${seg.title} (${seg.durationMins} min)`)
      for (const b of seg.bullets) {
        lines.push(`- ${b}`)
      }
      lines.push('')
    })
    await navigator.clipboard.writeText(lines.join('\n'))
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }

  return { open, outline, copyMarkdown, copied }
}
