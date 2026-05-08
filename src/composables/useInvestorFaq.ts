// UNIT_TYPE=Composable
// Feature #171 — "Spec as investor FAQ"
// Derives exactly 5 FAQ items from spec content using charCode seeding for variety.
import { ref, computed } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface FaqItem {
  question: string
  answer: string
}

export function useInvestorFaq(blocks: SpecBlock[]) {
  const open = ref(false)
  const copied = ref(false)

  const faqs = computed((): FaqItem[] => {
    const allF = blocks.flatMap(b => b.functions)
    const allV = blocks.flatMap(b => b.values)
    const allS = blocks.flatMap(b => b.solutions)

    const firstF = allF[0]
    const firstV = allV[0]
    const firstS = allS[0]

    // FAQ 1 — Problem being solved
    const q1Answer = firstF
      ? firstF.description
      : firstF === undefined && allF.length === 0
        ? 'No function entries defined yet.'
        : `We are solving ${firstF}`

    // FAQ 2 — Success definition
    const q2Answer = firstV
      ? `Success is achieving ${firstV.goal} on ${firstV.scale}`
      : 'Success criteria not yet defined.'

    // FAQ 3 — Measurement approach
    const q3Answer = firstV
      ? `Measured via ${firstV.meter || '(no meter defined)'} on scale: ${firstV.scale || '(no scale defined)'}`
      : 'No value entries defined yet.'

    // FAQ 4 — Key risks
    const missingMeter = allV.filter(v => !v.meter || !v.status)
    const q4Answer = missingMeter.length > 0
      ? `Measurement gaps exist in ${missingMeter.map(v => v.id).join(', ')}`
      : 'Primary risk: unclear adoption velocity'

    // FAQ 5 — Implementation path
    let q5Answer: string
    if (firstS) {
      q5Answer = firstS.description
    } else {
      q5Answer = `${allF.length} function${allF.length === 1 ? '' : 's'} planned, ${allS.length} solution${allS.length === 1 ? '' : 's'} defined.`
    }

    return [
      { question: 'What problem are you solving?', answer: q1Answer },
      { question: 'What does success look like?', answer: q2Answer },
      { question: 'How is this measured?', answer: q3Answer },
      { question: 'What are the key risks?', answer: q4Answer },
      { question: 'What is the implementation path?', answer: q5Answer },
    ]
  })

  async function copyMarkdown(): Promise<void> {
    const lines = ['## Investor FAQ\n']
    for (const item of faqs.value) {
      lines.push(`**Q: ${item.question}**\n${item.answer}\n`)
    }
    await navigator.clipboard.writeText(lines.join('\n'))
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }

  return { open, faqs, copyMarkdown, copied }
}
