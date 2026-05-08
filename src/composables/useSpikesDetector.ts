// UNIT_TYPE=Composable
// Feature #125 — Spike Detector
import { computed } from 'vue'

export interface SpikeFlag {
  stepId: string
  stepName: string
  triggers: string[]
  suggestion: string
  riskLevel: 'high' | 'medium' | 'low'
}

const HIGH_TRIGGERS = ['new technology', 'never done', 'unknown', 'prototype', 'research spike', 'unclear']
const MEDIUM_TRIGGERS = ['first time', 'experimental', 'investigate', 'explore', 'proof of concept', 'poc']
const LOW_TRIGGERS = ['unfamiliar', 'check if', 'verify', 'confirm approach']

function buildSuggestion(keyword: string, riskLevel: 'high' | 'medium' | 'low'): string {
  const days = riskLevel === 'high' ? 2 : 1
  return `Timebox a ${days}-day spike to validate ${keyword} before committing to implementation`
}

function detectSpike(step: { id: string; name: string; description?: string }): SpikeFlag | undefined {
  const text = `${step.name} ${step.description ?? ''}`.toLowerCase()

  const matchedHigh = HIGH_TRIGGERS.filter(kw => text.includes(kw))
  const matchedMedium = MEDIUM_TRIGGERS.filter(kw => text.includes(kw))
  const matchedLow = LOW_TRIGGERS.filter(kw => text.includes(kw))

  const allTriggers = [...matchedHigh, ...matchedMedium, ...matchedLow]
  if (allTriggers.length === 0) return undefined

  const riskLevel: 'high' | 'medium' | 'low' =
    matchedHigh.length > 0 ? 'high' :
    matchedMedium.length > 0 ? 'medium' :
    'low'

  const keyword = allTriggers[0]
  const suggestion = buildSuggestion(keyword, riskLevel)

  return {
    stepId: step.id,
    stepName: step.name,
    triggers: allTriggers,
    suggestion,
    riskLevel,
  }
}

export function useSpikesDetector(evoSteps: { id: string; name: string; description?: string }[]) {
  const spikes = computed<SpikeFlag[]>(() =>
    evoSteps.flatMap(step => {
      const flag = detectSpike(step)
      return flag ? [flag] : []
    }),
  )

  const spikeMap = computed<Record<string, SpikeFlag | undefined>>(() => {
    const map: Record<string, SpikeFlag | undefined> = {}
    for (const spike of spikes.value) {
      map[spike.stepId] = spike
    }
    return map
  })

  const riskCount = computed<{ high: number; medium: number; low: number }>(() => {
    const counts = { high: 0, medium: 0, low: 0 }
    for (const spike of spikes.value) {
      counts[spike.riskLevel]++
    }
    return counts
  })

  async function copyMarkdown(stepId: string): Promise<void> {
    const spike = spikeMap.value[stepId]
    if (!spike) return
    const text =
      `## Spike: ${spike.stepName}\n\n` +
      `**Risk Level:** ${spike.riskLevel}\n\n` +
      `**Triggers:** ${spike.triggers.join(', ')}\n\n` +
      `**Suggestion:** ${spike.suggestion}`
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // no-op
    }
  }

  return { spikes, spikeMap, riskCount, copyMarkdown }
}
