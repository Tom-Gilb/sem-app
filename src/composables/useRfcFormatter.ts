// UNIT_TYPE=Composable
// Feature #132 — Spec as RFC Formatter
import { ref, computed } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface RfcDocument {
  title: string
  abstract: string
  motivation: string
  detailedDesign: string
  drawbacks: string
  alternatives: string
  unresolved: string
}

export function useRfcFormatter(blocks: SpecBlock[]) {
  const rfc = computed<RfcDocument>(() => {
    const allFunctions = blocks.flatMap(b => b.functions)
    const allValues = blocks.flatMap(b => b.values)
    const allSolutions = blocks.flatMap(b => b.solutions)

    const fCount = allFunctions.length
    const vCount = allValues.length
    const sCount = allSolutions.length

    // Abstract
    const abstract =
      `This RFC proposes ${fCount} function${fCount !== 1 ? 's' : ''} delivering ${vCount} measurable outcome${vCount !== 1 ? 's' : ''}, implemented via ${sCount} solution${sCount !== 1 ? 's' : ''}.`

    // Motivation — from V. entry Goals (first 3, then "+ N more")
    const motivationParts: string[] = []
    const maxMotivation = 3
    for (let i = 0; i < Math.min(allValues.length, maxMotivation); i++) {
      const v = allValues[i]
      const goal = v.goal?.trim() || '(no goal defined)'
      motivationParts.push(`To achieve ${goal} for ${v.id}`)
    }
    const remaining = allValues.length - maxMotivation
    if (remaining > 0) {
      motivationParts.push(`+ ${remaining} more`)
    }
    const motivation = motivationParts.length > 0
      ? motivationParts.join('; ') + '.'
      : 'No value entries defined.'

    // Detailed Design — numbered F. entries + S. entries
    const designLines: string[] = []
    allFunctions.forEach((f, idx) => {
      const desc = f.description?.trim() ? ` — ${f.description}` : ''
      designLines.push(`${idx + 1}. ${f.id}${desc}`)
    })
    allSolutions.forEach(s => {
      const desc = s.description?.trim() ? `: ${s.description}` : ''
      designLines.push(`Implementation: ${s.id}${desc}`)
    })
    const detailedDesign = designLines.length > 0
      ? designLines.join('\n')
      : 'No functions or solutions defined.'

    // Drawbacks
    const vWithoutGoal = allValues.filter(v => !v.goal?.trim())
    let drawbacks: string
    if (vWithoutGoal.length > 0) {
      drawbacks = 'Some value entries lack defined Goals, reducing measurability.'
    } else if (blocks.length < 3) {
      drawbacks = 'Limited scope may restrict reusability.'
    } else {
      const totalEntries = fCount + vCount + sCount
      drawbacks = `Complexity scales with entry count (${totalEntries} entries total).`
    }

    // Alternatives
    const alternatives =
      'Alternative approaches were considered but not selected; this design was chosen for its measurability and Planguage compliance.'

    // Unresolved — entries with missing Goal, Scale, or Meter
    const missingLines: string[] = []
    for (const v of allValues) {
      const missing: string[] = []
      if (!v.goal?.trim()) missing.push('Goal')
      if (!v.scale?.trim()) missing.push('Scale')
      if (!v.meter?.trim()) missing.push('Meter')
      if (missing.length > 0) {
        missingLines.push(`- ${v.id}: missing ${missing.join(', ')}`)
      }
    }
    const unresolved = missingLines.length > 0
      ? missingLines.join('\n')
      : 'All required fields are present. No unresolved questions.'

    const title = allFunctions.length > 0
      ? `RFC: ${allFunctions[0].id}`
      : 'RFC: Untitled Spec'

    return { title, abstract, motivation, detailedDesign, drawbacks, alternatives, unresolved }
  })

  const copied = ref(false)

  async function copyMarkdown(): Promise<void> {
    const r = rfc.value
    const lines = [
      `# ${r.title}`,
      '',
      '## Abstract',
      r.abstract,
      '',
      '## Motivation',
      r.motivation,
      '',
      '## Detailed Design',
      r.detailedDesign,
      '',
      '## Drawbacks',
      r.drawbacks,
      '',
      '## Alternatives',
      r.alternatives,
      '',
      '## Unresolved Questions',
      r.unresolved,
    ]
    const text = lines.join('\n')
    try {
      await navigator.clipboard.writeText(text)
      copied.value = true
      setTimeout(() => { copied.value = false }, 2000)
    } catch {
      // clipboard not available
    }
  }

  return {
    rfc,
    copyMarkdown,
    copied,
  }
}
