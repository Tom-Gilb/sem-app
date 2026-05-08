// UNIT_TYPE=Composable
// Feature #137 — "Spec as investor pitch deck" outline
import { ref, computed } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface PitchSlide {
  number: number
  title: string
  bullets: string[]   // 2–3 bullet points derived from spec content
}

const SLIDE_TITLES = [
  'Problem',
  'Solution',
  'Market',
  'Product',
  'Traction',
  'Business Model',
  'Competition',
  'Team',
  'Roadmap',
  'Ask',
]

export function usePitchDeck(blocks: SpecBlock[]) {
  const slides = computed<PitchSlide[]>(() => {
    const allFunctions = blocks.flatMap(b => b.functions)
    const allValues = blocks.flatMap(b => b.values)

    const fCount = allFunctions.length
    const vCount = allValues.length

    const firstV = allValues[0]
    const firstF = allFunctions[0]
    const secondF = allFunctions[1]

    const firstVName = firstV?.id ?? 'value'
    const firstVGoal = firstV?.goal?.trim() || '$0'
    const firstVStatus = firstV?.status?.trim() || '$0'
    const firstFName = firstF?.id ?? 'capability'
    const secondFName = secondF?.id ?? 'additional capabilities'
    const firstFDesc = firstF?.description?.trim() ?? ''
    const firstFDescShort = firstFDesc.length > 50 ? firstFDesc.slice(0, 50) : firstFDesc

    // Derive domain from function ids/descriptions
    const domainText = allFunctions.map(f => f.id + ' ' + f.description).join(' ')
    const domain = domainText.trim() ? domainText.split(/\s+/).slice(0, 3).join(' ') : 'specification'

    const slideData: Array<{ title: string; bullets: string[] }> = [
      // 1. Problem
      {
        title: SLIDE_TITLES[0],
        bullets: [
          `Current gap: ${firstVName} is not yet at Goal ${firstVGoal}`,
          `Solving this creates measurable value for practitioners`,
        ],
      },
      // 2. Solution
      {
        title: SLIDE_TITLES[1],
        bullets: [
          `Delivering ${fCount} core capabilities`,
          firstFDescShort
            ? `${firstFName}: ${firstFDescShort}`
            : `${firstFName}: core capability`,
        ],
      },
      // 3. Market
      {
        title: SLIDE_TITLES[2],
        bullets: [
          `Addressable market: teams using ${domain} workflows`,
          `TAM grows with ${vCount} measurable improvement vectors`,
        ],
      },
      // 4. Product
      {
        title: SLIDE_TITLES[3],
        bullets: [
          `Core product: ${firstFName}`,
          secondFName,
          'Planguage-compliant measurable specification',
        ],
      },
      // 5. Traction
      {
        title: SLIDE_TITLES[4],
        bullets: [
          `Methodology in active use (Status: ${firstVStatus})`,
          `Goal: ${firstVGoal}`,
        ],
      },
      // 6. Business Model
      {
        title: SLIDE_TITLES[5],
        bullets: [
          'Revenue from training, consulting, and tooling licenses',
          `Goal: ${firstVGoal}`,
        ],
      },
      // 7. Competition
      {
        title: SLIDE_TITLES[6],
        bullets: [
          'Competitors use qualitative specs — we use Planguage (measurable)',
          'V/C ratio analysis differentiates delivery priority',
        ],
      },
      // 8. Team
      {
        title: SLIDE_TITLES[7],
        bullets: [
          'Built by practitioners for practitioners',
          'Kai Gilb methodology — 40+ years of Planguage research',
        ],
      },
      // 9. Roadmap
      {
        title: SLIDE_TITLES[8],
        bullets: [
          `Step 1: ${firstFName}`,
          `Step 2: ${secondFName}`,
          `Step 3: Scale to ${vCount * 10} teams`,
        ],
      },
      // 10. Ask
      {
        title: SLIDE_TITLES[9],
        bullets: [
          'Seeking: strategic partners, pilot customers, and community contributors',
          `Next milestone: ${firstVGoal} for ${firstVName}`,
        ],
      },
    ]

    return slideData.map((s, idx) => ({
      number: idx + 1,
      title: s.title,
      bullets: s.bullets,
    }))
  })

  const copied = ref(false)

  async function copyMarkdown(): Promise<void> {
    const lines: string[] = []
    for (const slide of slides.value) {
      lines.push(`## ${slide.number}. ${slide.title}`)
      for (const bullet of slide.bullets) {
        lines.push(`- ${bullet}`)
      }
      lines.push('')
    }
    const text = lines.join('\n').trimEnd()
    try {
      await navigator.clipboard.writeText(text)
      copied.value = true
      setTimeout(() => { copied.value = false }, 2000)
    } catch {
      // clipboard not available
    }
  }

  return {
    slides,
    copyMarkdown,
    copied,
  }
}
