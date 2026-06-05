// UNIT_TYPE=Hook
//
// useFeedMe.ts — load / save / mutate the FEED ME! set for one plan.
//
// AUDIT TRAIL enforcement (Tom 2026-06-03): every approval / rejection /
// modification of an action stamps reviewedAt + reviewedBy + reviewNote
// (optional) onto the action record.  Question status changes likewise
// stamp lifecycle info.  The whole FeedMeSet is the audit log — no
// separate log file in v1, but the design allows extraction.

import { ref, watch, computed, type Ref } from 'vue'
import type { EvoStep } from '../types/evo-plan'
import {
  type FeedMeSet,
  type RecommendedActionStatus,
  type ToughQuestionStatus,
  storageKey,
  buildMockFeedMe,
} from '../data/feedMe'

function readSet(planId: string): FeedMeSet | null {
  try {
    const raw = localStorage.getItem(storageKey(planId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    return parsed as FeedMeSet
  } catch {
    return null
  }
}

function writeSet(planId: string, set: FeedMeSet): void {
  try {
    localStorage.setItem(storageKey(planId), JSON.stringify(set))
  } catch {
    // Quota / private mode — in-memory ref still holds.
  }
}

function clearStorage(planId: string): void {
  try {
    localStorage.removeItem(storageKey(planId))
  } catch { /* ignore */ }
}

/**
 * @param planId  - Stable plan id (plan model name) for storage scoping
 * @param steps   - The current Evo steps (used for mock generation)
 */
export function useFeedMe(planId: Ref<string>, steps: Ref<EvoStep[]>) {
  const set = ref<FeedMeSet | null>(readSet(planId.value))
  const lastError = ref<string>('')

  // Re-load if planId changes (user switches plans)
  watch(
    () => planId.value,
    (newPlan) => {
      set.value = readSet(newPlan)
      lastError.value = ''
    },
  )

  function persist(): void {
    if (set.value) writeSet(planId.value, set.value)
  }

  /** Populate with mock seed for the current plan. */
  function loadMock(): void {
    set.value = buildMockFeedMe(planId.value, steps.value)
    persist()
    lastError.value = ''
  }

  /** Paste a Claudian-generated JSON FeedMeSet.  Validates minimally. */
  function pasteSet(jsonText: string): boolean {
    let parsed: unknown
    try {
      parsed = JSON.parse(jsonText.trim())
    } catch (err) {
      lastError.value = `Could not parse JSON: ${err instanceof Error ? err.message : String(err)}`
      return false
    }
    if (typeof parsed !== 'object' || parsed === null) {
      lastError.value = 'Pasted content is not a JSON object.'
      return false
    }
    const p = parsed as Partial<FeedMeSet>
    if (!p.feedbackBase || !p.evoBase || !Array.isArray(p.recommendedActions)) {
      lastError.value = 'Missing required fields (feedbackBase, evoBase, recommendedActions).'
      return false
    }
    // Force the planId to current plan + stamp generatedAt
    const fresh: FeedMeSet = {
      planId: planId.value,
      generatedAt: Date.now(),
      generatedBy: 'claudian',
      feedbackBase: p.feedbackBase,
      evoBase: p.evoBase,
      lastStepInParis: p.lastStepInParis ?? null,
      recommendedActions: p.recommendedActions,
    }
    set.value = fresh
    persist()
    lastError.value = ''
    return true
  }

  /** Clear the entire set (with no confirm — caller's job). */
  function clearAll(): void {
    clearStorage(planId.value)
    set.value = null
    lastError.value = ''
  }

  // ── Tough question lifecycle ───────────────────────────────────────────────

  /** Update a tough question's status + optionally record dev's response.
   *  Status transitions are persisted immediately. */
  function setToughQuestionStatus(
    questionId: string,
    status: ToughQuestionStatus,
    devResponse?: string,
  ): void {
    if (!set.value?.lastStepInParis) return
    const q = set.value.lastStepInParis.toughQuestions.find(qq => qq.id === questionId)
    if (!q) return
    q.status = status
    if (devResponse !== undefined) q.devResponse = devResponse
    persist()
  }

  // ── Recommended action lifecycle (AUDIT TRAIL) ─────────────────────────────

  /** Approve / reject / re-pending an action.  Stamps reviewedAt + reviewedBy
   *  + reviewNote.  This is the audit trail Tom requires. */
  function setActionStatus(
    actionId: string,
    status: RecommendedActionStatus,
    reviewedBy: string,
    reviewNote?: string,
  ): void {
    if (!set.value) return
    const a = set.value.recommendedActions.find(aa => aa.id === actionId)
    if (!a) return
    a.status = status
    a.reviewedAt = Date.now()
    a.reviewedBy = reviewedBy
    if (reviewNote !== undefined) a.reviewNote = reviewNote
    persist()
  }

  // ── Computed summaries ─────────────────────────────────────────────────────

  const pendingActionsCount = computed<number>(() =>
    set.value?.recommendedActions.filter(a => a.status === 'pending').length ?? 0,
  )
  const approvedActionsCount = computed<number>(() =>
    set.value?.recommendedActions.filter(a => a.status === 'approved').length ?? 0,
  )
  const pendingToughQuestionsCount = computed<number>(() =>
    set.value?.lastStepInParis?.toughQuestions.filter(q => q.status === 'pending').length ?? 0,
  )

  return {
    set,
    lastError,
    loadMock,
    pasteSet,
    clearAll,
    setToughQuestionStatus,
    setActionStatus,
    pendingActionsCount,
    approvedActionsCount,
    pendingToughQuestionsCount,
  }
}
