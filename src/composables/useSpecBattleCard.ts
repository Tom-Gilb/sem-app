// UNIT_TYPE=Composable
// useSpecBattleCard — Spec "battle card" analyser
// Feature #99 — Battle Card

import { ref } from 'vue'
import type { Ref } from 'vue'
import type { SpecBlock } from '../types/spec'

export function useSpecBattleCard(spec: Ref<SpecBlock | null>) {
  const battleOpen = ref(false)
  const strengths = ref<string[]>([])
  const weaknesses = ref<string[]>([])

  function analyseSpec(): void {
    if (!spec.value) {
      strengths.value = ['Spec structure is well-defined per Planguage methodology']
      weaknesses.value = ['Spec lacks quantitative baselines for all value entries']
      return
    }

    const { functions, values, solutions } = spec.value
    const totalBlocks = functions.length + values.length + solutions.length
    const vEntries = values
    const sCount = solutions.length

    // ── Potential strengths ───────────────────────────────────────────────────
    const candidateStrengths: string[] = []

    // "High entry count"
    if (totalBlocks >= 6) {
      candidateStrengths.push(
        `High entry count: ${totalBlocks} F./V./S. entries covering all CE stages`,
      )
    }

    // "All V. entries have Scale and Goal defined"
    if (vEntries.length > 0 && vEntries.every(v => v.scale.trim() !== '' && v.goal.trim() !== '')) {
      candidateStrengths.push('All V. entries have Scale and Goal defined')
    }

    // "[N] Solution entries — complete solution coverage"
    if (sCount >= 2) {
      candidateStrengths.push(`${sCount} Solution entries — complete solution coverage`)
    }

    // "Measurable outcomes: [N] V. entries with numeric Goals"
    const numericGoalCount = vEntries.filter(v => /\d/.test(v.goal)).length
    if (numericGoalCount > 0) {
      candidateStrengths.push(`Measurable outcomes: ${numericGoalCount} V. entries with numeric Goals`)
    }

    // "Balanced spec: F., V., and S. entries all present"
    if (functions.length > 0 && vEntries.length > 0 && solutions.length > 0) {
      candidateStrengths.push('Balanced spec: F., V., and S. entries all present')
    }

    // Take first 3; fallback if none
    if (candidateStrengths.length === 0) {
      strengths.value = ['Spec structure is well-defined per Planguage methodology']
    } else {
      strengths.value = candidateStrengths.slice(0, 3)
    }

    // ── Potential weaknesses ──────────────────────────────────────────────────
    const candidateWeaknesses: string[] = []

    // "Missing Meter field in [N] V. entries"
    const missingMeter = vEntries.filter(v => v.meter.trim() === '').length
    if (missingMeter > 0) {
      candidateWeaknesses.push(`Missing Meter field in ${missingMeter} V. entries`)
    }

    // "No Tolerable threshold set in [N] V. entries"
    const missingTolerable = vEntries.filter(v => v.tolerable.trim() === '').length
    if (missingTolerable > 0) {
      candidateWeaknesses.push(`No Tolerable threshold set in ${missingTolerable} V. entries`)
    }

    // "Short spec: only [N] total entries"
    if (totalBlocks < 4) {
      candidateWeaknesses.push(
        `Short spec: only ${totalBlocks} total entries — consider expanding scope coverage`,
      )
    }

    // "No Solution entries present"
    if (sCount === 0) {
      candidateWeaknesses.push('No Solution entries present — delivery path unclear')
    }

    // "V. entries missing Status baseline"
    const missingStatus = vEntries.filter(v => v.status.trim() === '').length
    if (missingStatus > 0) {
      candidateWeaknesses.push('V. entries missing Status baseline — current state unknown')
    }

    // Take first 3; fallback if none
    if (candidateWeaknesses.length === 0) {
      weaknesses.value = ['Spec lacks quantitative baselines for all value entries']
    } else {
      weaknesses.value = candidateWeaknesses.slice(0, 3)
    }
  }

  async function copyBattleCard(): Promise<void> {
    const lines: string[] = [
      '## Battle Card',
      '',
      '### ✅ Strengths',
      ...strengths.value.map(s => `- ${s}`),
      '',
      '### ⚠️ Weaknesses',
      ...weaknesses.value.map(w => `- ${w}`),
    ]
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
    } catch {
      // clipboard not available in test / SSR environment
    }
  }

  return { battleOpen, strengths, weaknesses, analyseSpec, copyBattleCard }
}
