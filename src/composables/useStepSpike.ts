// UNIT_TYPE=Composable
// Feature #125 — Evo step spike detector
import { ref, computed } from 'vue'

export interface SpikeFlag {
  reason: string
  severity: 'high' | 'medium'
  suggestedDuration: string
  spikeTask: string
}

export interface StepSpikeResult {
  stepId: string
  flagged: boolean
  flags: SpikeFlag[]
  open: boolean
}

const NEW_TECH_KEYWORDS = [
  'new', 'unknown', 'explore', 'investigate', 'research', 'prototype',
  'poc', 'proof of concept', 'experiment', 'spike', 'novel', 'unfamiliar',
  'evaluate',
]

const UNCLEAR_AC_KEYWORDS = [
  'unclear', 'tbd', 'to be determined', 'pending', 'undecided', 'unknown',
  'question', 'assumption', 'depends', 'maybe', 'possibly',
]

const NO_PRIOR_KEYWORDS = [
  'first time', 'never done', 'no experience', 'new pattern', 'untested', 'unproven',
]

function countKeywordMatches(text: string, keywords: string[]): number {
  const lower = text.toLowerCase()
  return keywords.filter((kw) => lower.includes(kw)).length
}

export function useStepSpike() {
  const spikeMap = ref<Record<string, StepSpikeResult>>({})

  function analyseStep(step: { id: string; name: string; description?: string }): void {
    const text = `${step.name} ${step.description ?? ''}`

    const flags: SpikeFlag[] = []

    // New tech bank
    const newTechCount = countKeywordMatches(text, NEW_TECH_KEYWORDS)
    if (newTechCount >= 1) {
      const severity: 'high' | 'medium' = newTechCount >= 2 ? 'high' : 'medium'
      const suggestedDuration = severity === 'high' ? '2 days' : '1 day'
      flags.push({
        reason: `New technology signals detected (${newTechCount} keyword${newTechCount > 1 ? 's' : ''}: new tech exploration)`,
        severity,
        suggestedDuration,
        spikeTask: `Spike: research and prototype ${step.name} for ${suggestedDuration} to de-risk the unknown`,
      })
    }

    // Unclear AC bank
    const unclearAcCount = countKeywordMatches(text, UNCLEAR_AC_KEYWORDS)
    if (unclearAcCount >= 1) {
      const suggestedDuration = '1 day'
      flags.push({
        reason: `Unclear acceptance criteria signals detected (${unclearAcCount} keyword${unclearAcCount > 1 ? 's' : ''}: unclear AC)`,
        severity: 'medium',
        suggestedDuration,
        spikeTask: `Spike: research and prototype ${step.name} for ${suggestedDuration} to de-risk the unknown`,
      })
    }

    // No prior experience bank
    const noPriorCount = countKeywordMatches(text, NO_PRIOR_KEYWORDS)
    if (noPriorCount >= 1) {
      const suggestedDuration = '1 day'
      flags.push({
        reason: `No prior experience signals detected (${noPriorCount} keyword${noPriorCount > 1 ? 's' : ''}: new pattern)`,
        severity: 'medium',
        suggestedDuration,
        spikeTask: `Spike: research and prototype ${step.name} for ${suggestedDuration} to de-risk the unknown`,
      })
    }

    spikeMap.value[step.id] = {
      stepId: step.id,
      flagged: flags.length > 0,
      flags,
      open: spikeMap.value[step.id]?.open ?? false,
    }
  }

  function toggleOpen(stepId: string): void {
    const result = spikeMap.value[stepId]
    if (!result) return
    result.open = !result.open
  }

  const totalFlaggedCount = computed<number>(() => {
    return Object.values(spikeMap.value).filter((r) => r.flagged).length
  })

  function copySpike(stepId: string): void {
    const result = spikeMap.value[stepId]
    if (!result || !result.flagged) return

    const lines: string[] = [`## Spike Investigation — ${stepId}`]
    for (const flag of result.flags) {
      lines.push(`**Severity:** ${flag.severity}`)
      lines.push(`**Reason:** ${flag.reason}`)
      lines.push(`**Task:** ${flag.spikeTask}`)
      lines.push(`**Duration:** ${flag.suggestedDuration}`)
      lines.push('')
    }

    const text = lines.join('\n').trim()

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {/* silent */})
    }
  }

  return { spikeMap, analyseStep, toggleOpen, totalFlaggedCount, copySpike }
}
