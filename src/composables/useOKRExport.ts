// UNIT_TYPE=Composable
// Feature #23 — OKR Export
// Converts a SpecBlock into formatted OKR text.

import type { SpecBlock, VEntry } from '../types/spec'

export function useOKRExport() {
  /**
   * Converts a SpecBlock to OKR-formatted text.
   * Each F. entry becomes an Objective; linked V. entries become Key Results.
   * If no linked V. entries are found for an F., all V. entries are used.
   */
  function convertToOKR(spec: SpecBlock): string {
    if (!spec.functions.length && !spec.values.length && !spec.solutions.length) {
      return '## Objectives & Key Results\n\n(No entries found)'
    }

    const lines: string[] = ['## Objectives & Key Results', '']

    if (spec.functions.length === 0) {
      // No F. entries — emit V. entries as standalone KRs
      lines.push('### Key Results')
      spec.values.forEach((v, i) => {
        lines.push(
          `KR${i + 1}: Achieve ${v.goal || '(goal TBD)'} on ${v.scale || '(scale TBD)'} (currently ${v.status || 'unknown'})`
        )
      })
      return lines.join('\n')
    }

    spec.functions.forEach((f) => {
      lines.push(`### Objective: ${f.description}`)
      if (f.presenceTest || f.successCriteria) {
        lines.push(`(Presence: ${f.presenceTest || f.successCriteria})`)
      }

      // Find linked V. entries: V. id is referenced in functionOfValue
      let linkedValues: VEntry[] = spec.values.filter((v) =>
        f.functionOfValue.includes(v.id)
      )

      // Fall back to all V. entries if none linked
      if (linkedValues.length === 0) {
        linkedValues = spec.values
      }

      if (linkedValues.length > 0) {
        linkedValues.forEach((v, i) => {
          const goal   = v.goal   || '(goal TBD)'
          const scale  = v.scale  || '(scale TBD)'
          const status = v.status || 'unknown'
          lines.push(`KR${i + 1}: Achieve ${goal} on ${scale} (currently ${status})`)
        })
      } else {
        lines.push('(No Key Results defined)')
      }

      lines.push('')
    })

    return lines.join('\n').trimEnd()
  }

  return { convertToOKR }
}
