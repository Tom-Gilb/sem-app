// UNIT_TYPE=Hook
// useAnalyticsEvents — session analytics event store for Evo Step 10
// Spec: 3P.V.LLMResponseReliability / 3P.V.WorkflowResumability / 3P.V.EntryFluency
//       3P.V.EvoStepPlanQuality / 3P.V.MobileUX / 3P.V.TeamOnboardingSpeed
//
// Events are written to localStorage['sem-analytics-events'] as a JSON array capped at 1000.
// Claude Code reads this store to compute 3P.V.* and 1B.V.* Meter scores.

const EVENTS_KEY = 'sem-analytics-events'
const SESSION_ID_KEY = 'sem-session-id'
const MAX_EVENTS = 1000

// ── Event type definitions ────────────────────────────────────────────────────

export type AnalyticsEventType =
  | 'stage_complete'
  | 'spec_generated'
  | 'evo_plan_confirmed'
  | 'impact_estimated'
  | 'session_restored'
  | 'mobile_session'
  | 'llm_call_complete'

export interface StageCompleteEvent {
  type: 'stage_complete'
  stageId: 1 | 2 | 3 | 4 | 5
  sessionId: string
  userId: string | null
  /** Elapsed ms from app mount to this stage_complete (Entry Fluency proxy for stage 1) */
  elapsedFromMountMs: number
  timestamp: string
}

export interface SpecGeneratedEvent {
  type: 'spec_generated'
  sessionId: string
  fieldCount: number
  allFieldsPresent: boolean
  /** LLM response time for this call only */
  llmResponseMs: number
  /** Total elapsed from app mount — captures form-fill + LLM time (EntryFluency meter) */
  elapsedFromMountMs: number
  timestamp: string
}

export interface EvoPlanConfirmedEvent {
  type: 'evo_plan_confirmed'
  sessionId: string
  stepsCount: number
  timestamp: string
}

export interface ImpactEstimatedEvent {
  type: 'impact_estimated'
  sessionId: string
  entriesCount: number
  timestamp: string
}

export interface SessionRestoredEvent {
  type: 'session_restored'
  sessionId: string
  stateVersion: number
  success: boolean
  timestamp: string
}

export interface MobileSessionEvent {
  type: 'mobile_session'
  sessionId: string
  viewportWidth: number
  isMobile: boolean
  userAgent: string
  timestamp: string
}

export interface LlmCallCompleteEvent {
  type: 'llm_call_complete'
  callType: 'translation' | 'evo-plan' | 'impact'
  sessionId: string
  durationMs: number
  success: boolean
  cacheHit: boolean
  timestamp: string
}

export type AnalyticsEvent =
  | StageCompleteEvent
  | SpecGeneratedEvent
  | EvoPlanConfirmedEvent
  | ImpactEstimatedEvent
  | SessionRestoredEvent
  | MobileSessionEvent
  | LlmCallCompleteEvent

// ── Session ID ────────────────────────────────────────────────────────────────

/**
 * Returns a stable session ID for the current browser session.
 * Stored in sessionStorage — a new ID is generated per tab/reload.
 * Exported so useSurveyGate can reference the same session.
 */
export function getSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_ID_KEY)
    if (!id) {
      id = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`
      sessionStorage.setItem(SESSION_ID_KEY, id)
    }
    return id
  } catch {
    // sessionStorage unavailable (private mode) — return ephemeral ID
    return `ephemeral-${Date.now()}`
  }
}

// ── Storage helpers ───────────────────────────────────────────────────────────

function readEvents(): AnalyticsEvent[] {
  try {
    const raw = localStorage.getItem(EVENTS_KEY)
    if (!raw) return []
    return JSON.parse(raw) as AnalyticsEvent[]
  } catch {
    return []
  }
}

function appendEvent(event: AnalyticsEvent): void {
  try {
    const events = readEvents()
    events.push(event)
    // Ring-buffer: drop oldest entries when over cap
    const trimmed = events.length > MAX_EVENTS ? events.slice(events.length - MAX_EVENTS) : events
    localStorage.setItem(EVENTS_KEY, JSON.stringify(trimmed))
  } catch {
    // localStorage unavailable (private mode / quota exceeded) — silently ignore
  }
}

// ── Standalone logger (used by useSDK, useEvoPlannerAPI, useImpactSuggestions) ─

/**
 * Records an LLM pipeline call result.
 * Safe to call at module scope — does not require Vue reactivity.
 * Used by useSDK, useEvoPlannerAPI, and useImpactSuggestions to feed 3P.V.LLMResponseReliability.
 */
export function logLlmCall(
  callType: 'translation' | 'evo-plan' | 'impact',
  durationMs: number,
  success: boolean,
  cacheHit: boolean,
): void {
  appendEvent({
    type: 'llm_call_complete',
    callType,
    sessionId: getSessionId(),
    durationMs,
    success,
    cacheHit,
    timestamp: new Date().toISOString(),
  })
}

// ── Composable (used by App.vue) ──────────────────────────────────────────────

/**
 * Composable for SEM App session analytics.
 *
 * All events are written to `localStorage['sem-analytics-events']` as a JSON array
 * capped at 1000 entries (ring buffer). Claude Code reads this store to compute
 * V. entry scores per 3P.V.* and 2S.V.* Meters.
 *
 * @param mountMs - Date.now() captured in App.vue onMounted — used to compute
 *   elapsed times for EntryFluency and other latency Meters.
 * @param userId - Supabase user ID, or null when not authenticated.
 *
 * @example
 * const analytics = useAnalyticsEvents(mountMs, user.value?.id ?? null)
 * analytics.logStageComplete(1)
 */
export function useAnalyticsEvents(mountMs: number, userId: string | null = null) {
  const sessionId = getSessionId()

  function logStageComplete(stageId: 1 | 2 | 3 | 4 | 5): void {
    appendEvent({
      type: 'stage_complete',
      stageId,
      sessionId,
      userId,
      elapsedFromMountMs: Date.now() - mountMs,
      timestamp: new Date().toISOString(),
    })
  }

  function logSpecGenerated(
    fieldCount: number,
    allFieldsPresent: boolean,
    llmResponseMs: number,
  ): void {
    appendEvent({
      type: 'spec_generated',
      sessionId,
      fieldCount,
      allFieldsPresent,
      llmResponseMs,
      elapsedFromMountMs: Date.now() - mountMs,
      timestamp: new Date().toISOString(),
    })
  }

  function logEvoPlanConfirmed(stepsCount: number): void {
    appendEvent({
      type: 'evo_plan_confirmed',
      sessionId,
      stepsCount,
      timestamp: new Date().toISOString(),
    })
  }

  function logImpactEstimated(entriesCount: number): void {
    appendEvent({
      type: 'impact_estimated',
      sessionId,
      entriesCount,
      timestamp: new Date().toISOString(),
    })
  }

  function logSessionRestored(stateVersion: number, success: boolean): void {
    appendEvent({
      type: 'session_restored',
      sessionId,
      stateVersion,
      success,
      timestamp: new Date().toISOString(),
    })
  }

  function logMobileSession(): void {
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0
    appendEvent({
      type: 'mobile_session',
      sessionId,
      viewportWidth,
      isMobile: viewportWidth <= 430,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      timestamp: new Date().toISOString(),
    })
  }

  /** Returns all stored events — for debugging or Claude Code export via DevTools. */
  function getAllEvents(): AnalyticsEvent[] {
    return readEvents()
  }

  /**
   * Clears all stored analytics events.
   * For development use only — call from browser DevTools console when needed.
   */
  function clearEvents(): void {
    try {
      localStorage.removeItem(EVENTS_KEY)
    } catch {}
  }

  return {
    sessionId,
    logStageComplete,
    logSpecGenerated,
    logEvoPlanConfirmed,
    logImpactEstimated,
    logSessionRestored,
    logMobileSession,
    getAllEvents,
    clearEvents,
  }
}
