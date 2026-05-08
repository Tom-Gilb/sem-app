// UNIT_TYPE=Composable
// Feature #147 — "Spec as SWOT analysis"
import { computed, ref } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface SwotQuadrant {
  strengths: string[]
  weaknesses: string[]
  opportunities: string[]
  threats: string[]
}

/** Extract first numeric value from a string; returns NaN if not found */
function extractNumeric(text: string): number {
  const match = text.match(/[-+]?(\d+(\.\d+)?)/)
  return match ? parseFloat(match[1]) : NaN
}

export function useSwotAnalysis(blocks: SpecBlock[]) {
  const swot = computed<SwotQuadrant>(() => {
    const allFunctions = blocks.flatMap((b) => b.functions)
    const allValues = blocks.flatMap((b) => b.values)
    const allSolutions = blocks.flatMap((b) => b.solutions)

    // ── Strengths ──────────────────────────────────────────────────────────────
    // V. entries where numeric Goal > numeric Tolerable, or Goal exists
    const strengths: string[] = []
    for (const v of allValues) {
      const goalNum = extractNumeric(v.goal)
      const tolNum = extractNumeric(v.tolerable)
      const hasGoal = v.goal.trim().length > 0

      if (!isNaN(goalNum) && !isNaN(tolNum) && goalNum > tolNum) {
        strengths.push(`${v.id}: ${v.goal}`)
      } else if (hasGoal && (isNaN(tolNum) || tolNum === 0)) {
        strengths.push(`${v.id}: ${v.goal}`)
      }
    }

    // ── Weaknesses ─────────────────────────────────────────────────────────────
    // V. entries where status is "At Risk" or "Below Tolerable",
    // OR where entry has no goal field
    const weaknesses: string[] = []
    for (const v of allValues) {
      const statusLower = v.status.toLowerCase()
      const noGoal = !v.goal.trim()
      if (
        statusLower.includes('at risk') ||
        statusLower.includes('below tolerable') ||
        noGoal
      ) {
        weaknesses.push(`${v.id} — goal not met / not set`)
      }
    }

    // ── Opportunities ──────────────────────────────────────────────────────────
    // F. entries — label = entry.id + ": " + entry.description.slice(0,40)
    const opportunities: string[] = allFunctions.map((f) =>
      `${f.id}: ${f.description.slice(0, 40)}`,
    )

    // ── Threats ────────────────────────────────────────────────────────────────
    // V. entries where meter is missing, OR S. entries where description is empty
    const threats: string[] = []
    for (const v of allValues) {
      if (!v.meter.trim()) {
        threats.push(`${v.id} — incomplete spec coverage`)
      }
    }
    for (const s of allSolutions) {
      if (!s.description.trim()) {
        threats.push(`${s.id} — incomplete spec coverage`)
      }
    }

    return { strengths, weaknesses, opportunities, threats }
  })

  const copied = ref(false)

  async function copyMarkdown(): Promise<void> {
    const q = swot.value
    const section = (label: string, items: string[]) => {
      const lines = [`## ${label}`]
      if (items.length === 0) {
        lines.push('- (none)')
      } else {
        for (const item of items) lines.push(`- ${item}`)
      }
      return lines.join('\n')
    }

    const text = [
      section('Strengths', q.strengths),
      '',
      section('Weaknesses', q.weaknesses),
      '',
      section('Opportunities', q.opportunities),
      '',
      section('Threats', q.threats),
    ].join('\n')

    try {
      await navigator.clipboard.writeText(text)
      copied.value = true
      setTimeout(() => {
        copied.value = false
      }, 2000)
    } catch {
      // clipboard not available
    }
  }

  return {
    swot,
    copyMarkdown,
    copied,
  }
}
