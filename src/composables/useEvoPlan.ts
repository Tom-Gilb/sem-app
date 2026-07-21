// UNIT_TYPE=Hook
// useEvoPlan — reactive Evo Step Plan composable for SEM App
// Spec: S.Evo7.EvoStepPlannerComposable

import { ref, readonly } from 'vue'
import { useEvoPlannerAPI } from './useEvoPlannerAPI'
import { useWorkspace } from './useWorkspace'
import { useSpecHistory } from './useSpecHistory'
import { useSpecModel } from './useSpecModel'
import { getSupabaseClient } from '../config/supabase'
import type { SpecBlock, SEntry } from '../types/spec'
import type { EvoStepPlan } from '../types/evo-plan'

/**
 * Composable for managing the reactive Evo Step Plan lifecycle.
 *
 * Calls useEvoPlannerAPI with the current SpecBlock, exposes the resulting
 * EvoStepPlan as reactive state, and provides actions to mutate the plan
 * before the user confirms it.
 *
 * confirmPlan() persists the plan to Supabase (evo_plans table) when
 * VITE_MOCK_MODE is not 'true'. In mock mode, logs to console only.
 *
 * @returns {{
 *   plan: Readonly<Ref<EvoStepPlan | null>>,
 *   isConfirmed: Readonly<Ref<boolean>>,
 *   loading: Readonly<Ref<boolean>>,
 *   error: Readonly<Ref<string>>,
 *   fetchPlan(specBlock: SpecBlock, force?: boolean): Promise<void>,
 *   reorderSteps(fromIndex: number, toIndex: number): void,
 *   renameStep(index: number, name: string): void,
 *   removeStep(index: number): void,
 *   confirmPlan(): Promise<void>,
 * }}
 *
 * Preconditions: fetchPlan() must be called with a valid SpecBlock before
 *   any mutation actions are meaningful.
 * Errors: exposed via `error` ref; all async functions catch and surface errors.
 *
 * Spec: S.Evo7.EvoStepPlannerComposable
 */
// ── Module-level singleton state ─────────────────────────────────────────────
// Shared across all callers so App.vue can read and write the active plan
// without going through EvoPlanView's component boundary.

const plan        = ref<EvoStepPlan | null>(null)
const isConfirmed = ref(false)
const _planError  = ref('')

/**
 * Deterministic fingerprint of the S. entries that were active when the most
 * recent successful Evo Step generation completed.
 *
 * Tom Gilb 2026-06-08: "Evo steps are a function of the set of actual and
 * detailed solutions. The moment any solution changes, the evo steps need
 * regeneration."
 *
 * Set after every successful fetchPlan().  Null means "no generation in this
 * session, or plan was loaded from history" — no staleness warning shown.
 * Cleared on clearLoadedPlan() and resetPlanForLoad().
 */
const _generatedSolutionsKey = ref<string | null>(null)

/**
 * Build a deterministic string fingerprint from a solutions array.
 * Any change to id, label, or description of ANY S. entry will produce a
 * different key — correctly signalling that the Evo Steps need regeneration.
 * Sorted so reorder-only changes are ignored (step order doesn't affect which
 * solutions the steps implement).
 *
 * Exported so EvoPlanView can compute the CURRENT fingerprint and compare.
 */
export function solutionsFingerprint(solutions: SEntry[]): string {
  if (!solutions || solutions.length === 0) return '__empty__'
  return solutions
    .map(s => `${s.id ?? ''}|${s.label ?? ''}|${s.description ?? ''}`)
    .sort()
    .join('§')
}

/**
 * Shared loading indicator — module-level singleton so that ALL callers
 * (App.vue's useEvoPlan instance AND EvoPlanView's) see the same loading
 * state.  Without this, App.vue's _fetchEvoPlan would set App.vue's own
 * loading ref (from its useEvoPlannerAPI instance) but EvoPlanView's
 * template would read ITS OWN loading (from its useEvoPlannerAPI instance),
 * which stays false → the user sees "No Evo plan yet" instead of a spinner
 * for the entire duration of the generation.
 *
 * useEvoPlan r06 (2026-05-29): promoted from per-instance to singleton.
 */
const _loading = ref(false)

/**
 * Pre-loads a saved plan so the very next fetchPlan() call is a no-op.
 * Called by App.vue's onHistoryRestore() before it updates currentSpec,
 * which would otherwise trigger a fresh AI generation in EvoPlanView.
 */
let _skipNextFetch = false

/**
 * Concurrency guard — prevents fetchPlan from being re-entered while an
 * existing call is still in-flight.  Without this, a watcher that re-fires
 * the watch-getter (e.g. when currentSpec is replaced mid-fetch by an
 * unrelated downstream side-effect) can launch a second AI request that
 * clears `plan.value = null` while the first is awaiting — visible to the
 * user as the Evo Plan view flickering back to "Generate Evo Plan" right
 * after the first plan appears, then regenerating in a loop.
 */
let _inFlight = false

/**
 * Monotonic generation counter.  Every fetchPlan() invocation captures its
 * own generation number at entry.  The finally block only clears _inFlight
 * and _loading if the generation hasn't been superseded — preventing a
 * cancelled+immediately-restarted fetch from having its new loading state
 * killed by the old invocation's finally block.
 */
let _fetchGeneration = 0

/**
 * AbortController for the currently in-flight streaming fetch.
 * cancelFetch() aborts it so the SSE reader's await reader.read() throws,
 * which unblocks the planner promise, kills the Claude Code subprocess
 * via the Vite middleware's res.on('close') handler, and stops the
 * reactivity storm that was starving the event loop.
 *
 * Without this, cancelFetch only flipped Vue refs but the background SSE
 * stream kept pumping text-deltas indefinitely (Tom 2026-06-03: 215s
 * elapsed with Cancel button non-responsive).
 */
let _currentAbortController: AbortController | null = null

/**
 * User-cancellation flag. Set by cancelFetch() so that when planSteps()
 * eventually resolves (after the cancel), fetchPlan does not write the
 * result into reactive state — the API call keeps running in background
 * but its result is silently discarded.
 */
let _userCancelled = false
/** Tracks the most recent spec we've seen so subsequent calls with the
 *  exact same SpecBlock identity are a guaranteed no-op even after the
 *  inFlight guard clears.  Without this, a watcher firing twice with the
 *  same spec would still cause a second AI call once the first finished. */
let _lastFetchedSpec: SpecBlock | null = null

export function loadPlan(stored: EvoStepPlan): void {
  plan.value                   = { ...stored }
  isConfirmed.value            = false
  _planError.value             = ''
  _skipNextFetch               = true
  _generatedSolutionsKey.value = null  // no staleness warning for history-restored plans
}

/**
 * Clears any pre-loaded plan and resets the skip flag.
 * Call this when restoring a history entry that has NO saved plan,
 * so stale state from a previous loadPlan() call is not carried forward.
 */
export function clearLoadedPlan(): void {
  plan.value                   = null
  isConfirmed.value            = false
  _planError.value             = ''
  _skipNextFetch               = false
  _lastFetchedSpec             = null   // allow a fresh fetch for the next spec
  _generatedSolutionsKey.value = null
}

/**
 * Clears plan state but suppresses the next fetchPlan() call.
 * Use when loading/replacing a plan model — the spec changes but we do NOT
 * want EvoPlanView's immediate watcher to auto-generate steps on mount.
 * The user can trigger generation manually when ready.
 */
export function resetPlanForLoad(): void {
  plan.value                   = null
  isConfirmed.value            = false
  _planError.value             = ''
  _skipNextFetch               = true
  _lastFetchedSpec             = null   // forget identity so the next real fetch is allowed
  _generatedSolutionsKey.value = null
}

/**
 * Cancels an in-flight fetchPlan() call immediately from the caller's side.
 *
 * Sets _userCancelled so that when planSteps() eventually resolves (the
 * Anthropic API call cannot be aborted mid-flight), fetchPlan silently discards
 * the result instead of writing it into reactive state.
 *
 * Also clears the in-flight and loading guards immediately, so the UI returns
 * to the idle "Generate Evo Steps" state right away — the user does not have to
 * wait for the background API call to finish.
 *
 * Tom 2026-06-02: "no 66sec ad counting" — Cancel must be instant and obvious.
 */
/**
 * @param errorMessage  Optional message to surface in the UI after cancelling.
 *   Pass a non-empty string for timeout cancels so the user sees "timed out" rather
 *   than a blank error area.  Omit (or pass '') for user-initiated Cancel clicks —
 *   the UI returns to idle with no error banner.
 */
export function cancelFetch(errorMessage = ''): void {
  _userCancelled = true
  _inFlight      = false
  _loading.value = false
  _planError.value = errorMessage
  // Hard-cancel the in-flight streaming fetch so the SSE reader exits and
  // the Claude Code subprocess gets SIGTERM'd via the middleware's
  // res.on('close') handler. Otherwise the background stream keeps pumping
  // text-deltas, saturating the event loop and making subsequent UI
  // interactions sluggish (Tom 2026-06-03 Cancel-non-responsive bug).
  if (_currentAbortController !== null) {
    try { _currentAbortController.abort() } catch { /* ignore */ }
    _currentAbortController = null
  }
}

/**
 * Resets ALL module-level singleton state to initial values.
 *
 * @internal — for Vitest isolation ONLY. Not part of the public API.
 *
 * Vite HMR does NOT reinitialise module-level state between hot reloads, so
 * the same singleton persists for the entire dev-server session. In tests,
 * Vitest keeps the module alive across all tests in a file, so without this
 * reset, state from one test bleeds into the next — the same failure mode as
 * the `_inFlight` HMR bug (useEvoPlan r11 / useDefine r04).
 *
 * Call in `beforeEach` so every test starts with a clean slate.
 */
export function _resetModuleState(): void {
  plan.value        = null
  isConfirmed.value = false
  _planError.value  = ''
  _loading.value    = false
  _skipNextFetch    = false
  _inFlight         = false
  _userCancelled    = false
  _fetchGeneration  = 0
  _lastFetchedSpec  = null
}

export function useEvoPlan() {
  // loading is the module-level _loading singleton — NOT the per-instance ref
  // from useEvoPlannerAPI.  This ensures all callers (App.vue's instance AND
  // EvoPlanView's) see the same loading state, fixing the "no spinner during
  // App.vue-triggered generation" bug (useEvoPlan r06 / 2026-05-29).
  const { error: apiError, planSteps } = useEvoPlannerAPI()
  const { currentWorkspace } = useWorkspace()
  const { updateLatestPlan } = useSpecHistory()
  const { currentModel } = useSpecModel()

  // error alias — wraps the module-level ref so callers keep the same API
  const error = _planError

  // --- Fetch plan from the LLM API ---

  /**
   * Calls the Evo Planner API with the given SpecBlock and populates plan state.
   * Resets isConfirmed to false — a re-fetch starts a fresh confirmation cycle.
   *
   * If loadPlan() was called immediately before this (version-history restore),
   * skips the API call and uses the pre-loaded plan instead — UNLESS `force`
   * is true, in which case both the skip-next guard and the identity guard are
   * bypassed.  Pass `force = true` from explicit user-triggered actions (the
   * "Generate Evo Plan" CTA and the Retry button) so that clicking always
   * launches a fresh LLM call regardless of cached / pre-loaded state.
   */
  async function fetchPlan(
    specBlock: SpecBlock,
    force = false,
    /**
     * Optional streaming progress callback — forwarded to planSteps().
     * Fires with the accumulated partial text every time a new token chunk
     * arrives. Used by EvoPlanView to extract step names live for the
     * loading-state commentary. Safe to omit.
     */
    onProgress?: (partialText: string) => void,
  ): Promise<void> {
    // Restore path: a plan was pre-loaded — use it directly, skip AI generation.
    // Bypassed when force = true (user explicitly asked to regenerate).
    if (!force && _skipNextFetch) {
      _skipNextFetch = false
      _lastFetchedSpec = specBlock
      return
    }
    // Consume a pending skip flag even when forcing so it doesn't fire on the
    // next automatic watcher call after the forced fetch completes.
    if (force) _skipNextFetch = false

    // Concurrency guard — drop re-entrant calls while a fetch is already running.
    // Bypassed when force = true:
    //   (a) Explicit user action ("Generate Evo Plan" button, Retry) must ALWAYS work.
    //   (b) Vite HMR does NOT reinitialise module-level state between hot reloads —
    //       if a fetch was in-flight when HMR fired, _inFlight stays `true` forever
    //       and every subsequent call (including the Generate button) is silently
    //       dropped.  force=true is the user's explicit override and the correct
    //       escape hatch.  (Same root cause as the Illuminate eternal-spinner fixed
    //       2026-05-18; see useDefine.ts r04.)
    if (!force && _inFlight) {
      console.warn('[useEvoPlan] fetchPlan re-entered while in flight — ignoring duplicate call')
      return
    }
    // Identity guard — if the exact same spec object was just successfully
    // planned, skip the re-fetch.  Prevents a watcher that fires twice with
    // the same currentSpec reference from regenerating the plan in a loop.
    // Bypassed when force = true (user explicitly asked to regenerate).
    if (!force && _lastFetchedSpec === specBlock && plan.value && !apiError.value) {
      return
    }

    _inFlight = true
    _loading.value = true
    const thisGeneration = ++_fetchGeneration

    // ── Backup timeout guard — setInterval-based (reliable in WKWebView) ────────
    //
    // ROOT CAUSE (2026-06-02): setTimeout(fn, ms) does NOT reliably fire in
    // this WKWebView/Electron context.  Evidence: spinner reached 182s despite
    // three independent setTimeout mechanisms.  setInterval(fn, 1_000) IS
    // reliable (LoadingProgress elapsed counter proved it by reaching 182s).
    //
    // APPROACH: Count ticks of 1s each using setInterval.  On the Nth tick,
    // call cancelFetch().  The interval is cleared in the finally block so a
    // successful API call before the ceiling cancels it cleanly.
    //
    // CEILING (Tom 2026-06-03): 180s for streaming, 60s for non-streaming.
    // Streaming surfaces live step names in the UI, so the user has
    // continuous feedback and a longer ceiling is reasonable. Non-streaming
    // is a blank wait — 60s is the "no ad counting" limit. Must match
    // EVO_TIMEOUT_S in useEvoPlannerAPI.ts.
    const _backupCeilingSec = onProgress ? 180 : 60
    let _backupTicks = 0
    const _backupIntervalHandle = setInterval(() => {
      _backupTicks++
      if (_backupTicks >= _backupCeilingSec && !_userCancelled && _fetchGeneration === thisGeneration) {
        cancelFetch(`Evo generation timed out after ${_backupCeilingSec} s — click Retry.`)
        clearInterval(_backupIntervalHandle)
      }
    }, 1_000)

    try {
      error.value = ''
      isConfirmed.value = false
      plan.value = null

      // Read cycle length from the active plan model — constrains LLM step sizing.
      // Default 'week' if no model is active yet.
      const cycleLength = currentModel.value?.evoCycleLength ?? 'week'

      // Fresh AbortController per fetch — cancelFetch() will abort this
      // signal to hard-stop the streaming fetch + Claude subprocess.
      // Cleared in the finally block so a successful fetch leaves no
      // stale controller for the next cancelFetch to (no-op) abort.
      _currentAbortController = new AbortController()
      const result = await planSteps(specBlock, cycleLength, onProgress, _currentAbortController.signal)

      // User cancelled while the API call was in-flight — discard result silently.
      // _loading and _inFlight are already reset by cancelFetch(); just clear the flag.
      if (_userCancelled) {
        _userCancelled = false
        return
      }

      if (apiError.value) {
        // Propagate API error into this composable's error ref for the component
        error.value = apiError.value
        return
      }

      if (!result) {
        // Defensive guard: planSteps returned null without setting apiError.
        // This should never happen (every null-return path in planSteps sets
        // its own error before returning null), but if it does the user would
        // silently see "No Evo plan yet" with no explanation.  Surface it as
        // an explicit error so the Retry button appears (useEvoPlan r06).
        error.value = 'Evo plan generation returned no result — please retry.'
        return
      }

      plan.value = result
      _lastFetchedSpec = specBlock
      // Capture the solutions fingerprint at generation time.
      // Any subsequent S. entry change will produce a different key → staleness
      // warning shown in EvoPlanView (Tom 2026-06-08 principle).
      _generatedSolutionsKey.value = solutionsFingerprint(specBlock.solutions ?? [])
      // Retroactively update the most recent history entry with the generated plan.
      // addVersion() is always called before fetchPlan() completes (timing gap),
      // so the entry's plan field starts as null — this fills it in correctly.
      updateLatestPlan(result)
    } catch (err) {
      // Catches any unexpected exception that propagates through planSteps or
      // the code above.  Without this catch, an unhandled throw would leave
      // plan.value = null and error.value = '' — the user would silently see
      // "No Evo plan yet" with no way to know what went wrong (useEvoPlan r06).
      error.value = err instanceof Error ? err.message : String(err)
    } finally {
      // Cancel the backup timeout — the API responded (or we already cancelled)
      // so the timer must not fire late and clobber a newly started fetch.
      clearInterval(_backupIntervalHandle)

      // Only clear the guards if THIS invocation is still the active generation.
      // If the user cancelled and immediately re-generated (force=true), a newer
      // generation will have incremented _fetchGeneration — we must not kill its
      // loading state from this old finally block.
      if (_fetchGeneration === thisGeneration) {
        _inFlight = false
        _loading.value = false
        // Clear the controller only if it's still ours — a newer fetch may
        // have replaced it while this finally was running.
        _currentAbortController = null
      }
    }
  }

  // --- Mutation actions ---

  /**
   * Moves a step from fromIndex to toIndex, shifting other steps to fill the gap.
   *
   * @param fromIndex - 0-based index of the step to move
   * @param toIndex   - 0-based target index
   */
  function reorderSteps(fromIndex: number, toIndex: number): void {
    if (!plan.value) return
    const steps = [...plan.value.steps]

    // Guard: silently ignore out-of-bounds indices
    if (
      fromIndex < 0 ||
      fromIndex >= steps.length ||
      toIndex < 0 ||
      toIndex >= steps.length
    ) {
      return
    }

    // Remove from source, insert at destination
    const [moved] = steps.splice(fromIndex, 1)
    steps.splice(toIndex, 0, moved)
    plan.value = { ...plan.value, steps }
  }

  /**
   * Renames the step at the given index.
   *
   * @param index - 0-based index of the step to rename
   * @param name  - New name for the step (non-empty string)
   */
  function renameStep(index: number, name: string): void {
    if (!plan.value) return
    if (index < 0 || index >= plan.value.steps.length) return

    const steps = plan.value.steps.map((step, i) =>
      i === index ? { ...step, name } : step,
    )
    plan.value = { ...plan.value, steps }
  }

  /**
   * Removes the step at the given index from the plan.
   *
   * @param index - 0-based index of the step to remove
   */
  function removeStep(index: number): void {
    if (!plan.value) return
    if (index < 0 || index >= plan.value.steps.length) return

    const steps = plan.value.steps.filter((_, i) => i !== index)
    plan.value = { ...plan.value, steps }
  }

  /**
   * Confirms the current plan and persists it to Supabase (or console in mock mode).
   *
   * Sets isConfirmed = true on success.
   * Throws if plan has no steps — a plan with zero steps cannot be confirmed.
   *
   * Spec: S.Evo7.EvoPlanPersistence
   *
   * @throws {Error} if plan has no steps
   */
  async function confirmPlan(): Promise<void> {
    error.value = ''

    if (!plan.value || plan.value.steps.length === 0) {
      throw new Error('Cannot confirm an empty plan — add at least one step before confirming.')
    }

    // --- Mock mode: log only, no Supabase call ---
    if (import.meta.env.VITE_MOCK_MODE === 'true') {
      console.log('[useEvoPlan] confirmPlan (mock mode):', JSON.stringify(plan.value, null, 2))
      isConfirmed.value = true
      return
    }

    // --- Real mode: upsert to evo_plans table ---
    try {
      const client = getSupabaseClient()
      const workspaceId = currentWorkspace.value?.id

      if (!workspaceId) {
        // No workspace in session — confirm locally without persisting.
        // Plan is still usable for tasks and impact estimation this session.
        console.warn('[useEvoPlan] No workspace selected — plan confirmed locally only (not persisted to Supabase).')
        isConfirmed.value = true
        return
      }

      const { data: sessionData } = await client.auth.getSession()
      const userId = sessionData.session?.user?.id
      if (!userId) {
        throw new Error('Not authenticated — cannot persist the Evo plan.')
      }

      // Upsert based on workspace_id so re-confirming replaces the previous plan
      const { error: dbError } = await client
        .from('evo_plans')
        .upsert(
          {
            workspace_id: workspaceId,
            plan: plan.value,
            confirmed_at: new Date().toISOString(),
            confirmed_by: userId,
          },
          { onConflict: 'workspace_id' },
        )

      if (dbError) {
        throw new Error(dbError.message)
      }

      isConfirmed.value = true
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      throw err
    }
  }

  return {
    plan: readonly(plan),
    isConfirmed: readonly(isConfirmed),
    // Module-level singleton — shared across all useEvoPlan() callers so
    // EvoPlanView always sees the true loading state regardless of which
    // caller (App.vue vs EvoPlanView) triggered the fetch (useEvoPlan r06).
    loading: readonly(_loading),
    error: readonly(error),
    /** Fingerprint of S. entries at last generation time. Null = no generation
     *  in this session. Compare against solutionsFingerprint(specBlock.solutions)
     *  to detect staleness (Tom 2026-06-08 principle). */
    generatedSolutionsKey: readonly(_generatedSolutionsKey),
    fetchPlan,
    cancelFetch,
    reorderSteps,
    renameStep,
    removeStep,
    confirmPlan,
  }
}
