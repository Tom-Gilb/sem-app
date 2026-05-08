// UNIT_TYPE=Composable
// Feature #163 — Per step cognitive load tracker
// Per step: cognitive load score across 5 axes (complexity/integration/team/timeline/risk)
// keyword-based; 0–100 score; amber/red threshold; "simplify" suggestion
import { ref } from 'vue'

export type CogAxis = 'complexity' | 'integration' | 'team' | 'timeline' | 'risk'

export interface CogProfile {
  stepId: string
  scores: Record<CogAxis, number>   // 0–100
  total: number                      // avg of 5 axes
  level: 'Low' | 'Medium' | 'High' | 'Critical'
  simplify: string                   // actionable suggestion
}

const AXIS_KEYWORDS: Record<CogAxis, string[]> = {
  complexity: ['complex', 'refactor', 'architecture', 'algorithm', 'migration', 'legacy', 'integration'],
  integration: ['api', 'third-party', 'sync', 'webhook', 'auth', 'oauth', 'service', 'external'],
  team: ['new member', 'onboard', 'cross-team', 'multiple', 'stakeholder', 'approval', 'review'],
  timeline: ['deadline', 'urgent', 'asap', 'sprint', 'milestone', 'release', 'date'],
  risk: ['uncertain', 'unknown', 'spike', 'experiment', 'poc', 'prototype', 'first time'],
}

const SIMPLIFY_SUGGESTIONS: Record<CogProfile['level'], string> = {
  Low: 'This step has low cognitive load — good candidate for junior pair.',
  Medium: 'Consider timebox and clear acceptance criteria to keep load manageable.',
  High: 'Break into 2 smaller steps or run a spike first to reduce unknowns.',
  Critical: 'High cognitive load — recommend mob programming, explicit spike, or defer non-essential scope.',
}

export function useStepCogLoad() {
  const openSteps = ref<Set<string>>(new Set())

  function seed(s: string): number {
    return s.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  }

  function toggleOpen(stepId: string) {
    if (openSteps.value.has(stepId)) openSteps.value.delete(stepId)
    else openSteps.value.add(stepId)
  }

  function isOpen(stepId: string): boolean {
    return openSteps.value.has(stepId)
  }

  function getProfile(stepId: string, stepTitle: string): CogProfile {
    const text = (stepTitle + ' ' + stepId).toLowerCase()
    const s = seed(stepId)
    const axes: CogAxis[] = ['complexity', 'integration', 'team', 'timeline', 'risk']
    const scores = {} as Record<CogAxis, number>

    for (const [i, axis] of axes.entries()) {
      let score = 20 + ((s + i * 13) % 30)  // seeded base 20–50
      for (const kw of AXIS_KEYWORDS[axis]) {
        if (text.includes(kw)) score += 15
      }
      scores[axis] = Math.min(100, score)
    }

    const total = Math.round(axes.reduce((a, ax) => a + scores[ax], 0) / 5)
    let level: CogProfile['level'] = 'Low'
    if (total >= 80) level = 'Critical'
    else if (total >= 60) level = 'High'
    else if (total >= 40) level = 'Medium'

    return { stepId, scores, total, level, simplify: SIMPLIFY_SUGGESTIONS[level] }
  }

  function cogBarWidth(score: number): number {
    return Math.round((score / 100) * 100)
  }

  return { openSteps, toggleOpen, isOpen, getProfile, cogBarWidth }
}
