// UNIT_TYPE=Composable
// Feature #180 — Evo step "sprint review" generator
import { ref } from 'vue'
import type { Ref } from 'vue'

export interface ReviewSection {
  title: string
  items: string[]
}

export interface StepReview {
  stepId: string
  sections: [ReviewSection, ReviewSection, ReviewSection, ReviewSection]
}

export interface UseSprintReviewReturn {
  openSteps: Ref<Set<string>>
  toggleOpen: (stepId: string) => void
  isOpen: (stepId: string) => boolean
  getReview: (stepId: string, stepTitle: string) => StepReview
  copyReview: (stepId: string) => Promise<void>
  copiedSteps: Ref<Set<string>>
}

function seed(s: string, mod: number): number {
  return s.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % mod
}

const DEMO_ITEMS: readonly string[] = [
  'Demonstrated working prototype to stakeholders',
  'Showed live system integration',
  'Presented performance benchmark results',
  'Walked through user acceptance criteria',
  'Demoed error handling and edge cases',
  'Showed automated test results dashboard',
  'Presented API contract documentation',
  'Demoed accessibility compliance report',
]

const DECISIONS: readonly string[] = [
  'Agreed to proceed with current implementation approach',
  'Deferred scope to next sprint',
  'Prioritised critical path items first',
  'Approved technical architecture decision',
  'Resolved ambiguity in acceptance criteria',
  'Confirmed stakeholder sign-off timeline',
  'Agreed to increase test coverage threshold',
  'Decided to add monitoring instrumentation',
]

const BLOCKERS_CLEARED: readonly string[] = [
  'Resolved environment configuration issue',
  'Unblocked pending code review',
  'Cleared dependency on external team',
  'Fixed CI/CD pipeline failure',
  'Resolved merge conflict in shared module',
  'Obtained stakeholder approval for API design',
  'Removed requirement ambiguity',
  'Fixed test flakiness issue',
]

const NEXT_ACTIONS: readonly string[] = [
  'Write retrospective summary note',
  'Update definition of done documentation',
  'Share demo recording with wider team',
  'Schedule follow-up with stakeholders',
  'Create tickets for deferred items',
  'Update sprint velocity tracker',
  'Review and close resolved blockers',
  'Plan next sprint kick-off',
]

const SECTION_POOLS: readonly (readonly string[])[] = [
  DEMO_ITEMS,
  DECISIONS,
  BLOCKERS_CLEARED,
  NEXT_ACTIONS,
]

const SECTION_TITLES: readonly string[] = [
  'Demo Items',
  'Decisions Made',
  'Blockers Cleared',
  'Next Actions',
]

function pickTwo(pool: readonly string[], stepId: string, sectionIndex: number): [string, string] {
  const i0 = seed(stepId + String(sectionIndex) + '0', 8)
  let i1 = seed(stepId + String(sectionIndex) + '1', 8)
  if (i1 === i0) {
    i1 = (i1 + 1) % 8
  }
  return [pool[i0], pool[i1]]
}

// Cache keyed by stepId so repeated calls return identical objects
const reviewCache = new Map<string, StepReview>()

export function useSprintReview(
  steps: () => Array<{ id: string; title: string }>,
): UseSprintReviewReturn {
  const openSteps = ref<Set<string>>(new Set())
  const copiedSteps = ref<Set<string>>(new Set())

  function toggleOpen(stepId: string): void {
    const next = new Set(openSteps.value)
    if (next.has(stepId)) {
      next.delete(stepId)
    } else {
      next.add(stepId)
    }
    openSteps.value = next
  }

  function isOpen(stepId: string): boolean {
    return openSteps.value.has(stepId)
  }

  function getReview(stepId: string, stepTitle: string): StepReview {
    if (reviewCache.has(stepId)) {
      return reviewCache.get(stepId)!
    }
    const sections = SECTION_POOLS.map((pool, si) => {
      const [item0, item1] = pickTwo(pool, stepId, si)
      return {
        title: SECTION_TITLES[si],
        items: [item0, item1],
      }
    }) as [ReviewSection, ReviewSection, ReviewSection, ReviewSection]

    const review: StepReview = { stepId, sections }
    reviewCache.set(stepId, review)
    return review
  }

  async function copyReview(stepId: string): Promise<void> {
    const allSteps = steps()
    const stepData = allSteps.find((s) => s.id === stepId)
    const stepTitle = stepData?.title ?? stepId
    const review = getReview(stepId, stepTitle)

    const lines: string[] = []
    lines.push(`## Sprint Review: ${stepTitle}`)
    lines.push('')
    for (const section of review.sections) {
      lines.push(`### ${section.title}`)
      for (const item of section.items) {
        lines.push(`- ${item}`)
      }
      lines.push('')
    }

    const md = lines.join('\n').trimEnd()
    try {
      await navigator.clipboard.writeText(md)
    } catch {
      // clipboard may not be available in all environments
    }

    const next = new Set(copiedSteps.value)
    next.add(stepId)
    copiedSteps.value = next

    setTimeout(() => {
      const after = new Set(copiedSteps.value)
      after.delete(stepId)
      copiedSteps.value = after
    }, 2000)
  }

  return {
    openSteps,
    toggleOpen,
    isOpen,
    getReview,
    copyReview,
    copiedSteps,
  }
}
