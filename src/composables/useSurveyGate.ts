// UNIT_TYPE=Hook
// useSurveyGate — in-app confidence survey composable for Evo Step 10
// Spec: 2S.V.PlannerConfidence / 2S.V.PlannerPlanningTrust / 3P.V.PrioritisationAccuracy
//
// Manages two post-action surveys:
//   post-generation: shown after spec generation, once per 7-day cooldown
//   post-planning:   shown after first Evo plan confirmation per session
//
// Responses stored in localStorage['sem-survey-responses'] as a JSON array.
// Claude Code reads this store for PlannerConfidence and PlannerPlanningTrust Meter scoring.

import { ref } from 'vue'
import { getSessionId } from './useAnalyticsEvents'

// ── Types ─────────────────────────────────────────────────────────────────────

export type SurveyType = 'post-generation' | 'post-planning'

export interface SurveyResponse {
  surveyType: SurveyType
  sessionId: string
  userId: string | null
  rating: 1 | 2 | 3 | 4 | 5
  timestamp: string
}

// ── Storage keys ──────────────────────────────────────────────────────────────

const RESPONSES_KEY = 'sem-survey-responses'
const COOLDOWN_KEY_PREFIX = 'sem-survey-cooldown'
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

// ── Survey questions (stable — must match Meter wording in spec) ──────────────

export const SURVEY_QUESTIONS: Record<SurveyType, string> = {
  'post-generation':
    'How confident are you that this spec output is ready to share without manual editing?',
  'post-planning':
    'How credible are these AI-suggested Evo steps as a starting plan for your work?',
}

// ── Storage helpers ───────────────────────────────────────────────────────────

function readResponses(): SurveyResponse[] {
  try {
    const raw = localStorage.getItem(RESPONSES_KEY)
    if (!raw) return []
    return JSON.parse(raw) as SurveyResponse[]
  } catch {
    return []
  }
}

function storeResponse(response: SurveyResponse): void {
  try {
    const responses = readResponses()
    responses.push(response)
    localStorage.setItem(RESPONSES_KEY, JSON.stringify(responses))
  } catch {
    // localStorage unavailable — silently ignore
  }
}

function isCooldownActive(surveyType: SurveyType): boolean {
  try {
    const raw = localStorage.getItem(`${COOLDOWN_KEY_PREFIX}-${surveyType}`)
    if (!raw) return false
    const lastShownMs = parseInt(raw, 10)
    return !isNaN(lastShownMs) && Date.now() - lastShownMs < COOLDOWN_MS
  } catch {
    return false
  }
}

function setCooldown(surveyType: SurveyType): void {
  try {
    localStorage.setItem(`${COOLDOWN_KEY_PREFIX}-${surveyType}`, String(Date.now()))
  } catch {}
}

// ── Composable ────────────────────────────────────────────────────────────────

/**
 * Composable for in-app confidence surveys.
 *
 * Controls visibility of the SurveyGateModal component via `surveyVisible`.
 * Enforces a 7-day cooldown per survey type and a per-session guard for post-planning.
 *
 * @param userId - Supabase user ID, or null when not authenticated.
 *
 * @example
 * const survey = useSurveyGate(user.value?.id ?? null)
 * // After spec generation succeeds:
 * survey.triggerPostGeneration()
 * // After Evo plan is confirmed:
 * survey.triggerPostPlanning()
 */
export function useSurveyGate(userId: string | null = null) {
  const sessionId = getSessionId()

  const surveyVisible = ref(false)
  const activeSurveyType = ref<SurveyType>('post-generation')
  const activeSurveyQuestion = ref(SURVEY_QUESTIONS['post-generation'])

  // Per-session guard — post-planning survey fires at most once per browser session
  let planningTriggeredThisSession = false

  /**
   * r41 v237 (Tom Gilb 2026-06-21 verbatim "the 'how credible..' is junk i
   * never asked for and got rid of long ago, why is it popping up here?")
   * — both survey triggers permanently NEUTERED.  Tom removed the survey
   * popup long ago and it silently resurfaced.  Converting the trigger
   * functions to no-ops + leaving the composable in place so callers don't
   * crash + still recording the storage helpers in case the data layer is
   * read for analytics.  Banked as feature invariant
   * `no-credibility-prompt` in scripts/feature-smoke-test.mjs so the popup
   * cannot resurrect again silently.  Composes with No-Silent-Removal
   * SUPREME (inverse — this rule prevents silent RE-ADDITION of dead
   * features) + Tom-Repeats-Himself SUPREME (one repeat = one permanent
   * invariant). */
  function triggerPostGeneration(): void {
    // no-op — survey killed per Tom Gilb 2026-06-21
    void isCooldownActive
  }

  function triggerPostPlanning(): void {
    // no-op — survey killed per Tom Gilb 2026-06-21
    void planningTriggeredThisSession
  }
  // Suppress unused-binding lint since we keep them for future un-killing if Tom asks.
  void planningTriggeredThisSession
  void setCooldown
  void storeResponse

  /**
   * Records the user's rating and closes the survey.
   * @param rating - integer 1–5; 4–5 counts as "agree" per PlannerConfidence Meter
   */
  function submitRating(rating: 1 | 2 | 3 | 4 | 5): void {
    storeResponse({
      surveyType: activeSurveyType.value,
      sessionId,
      userId,
      rating,
      timestamp: new Date().toISOString(),
    })
    surveyVisible.value = false
  }

  /** Closes the survey without recording a response (user dismissed). */
  function dismissSurvey(): void {
    surveyVisible.value = false
  }

  /** Returns all stored responses — for debugging or Claude Code scoring. */
  function getAllResponses(): SurveyResponse[] {
    return readResponses()
  }

  return {
    surveyVisible,
    activeSurveyType,
    activeSurveyQuestion,
    triggerPostGeneration,
    triggerPostPlanning,
    submitRating,
    dismissSurvey,
    getAllResponses,
  }
}
