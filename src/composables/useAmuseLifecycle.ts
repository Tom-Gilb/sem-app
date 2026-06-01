// UNIT_TYPE=Hook
/**
 * useAmuseLifecycle — post-loading "Continue Amuse Me" lifecycle composable.
 *
 * Designed for inline wisdom-card carousels (ContractHub, EvoCritiquer,
 * DecisionMapper, StakeholderMapper, PlanImporter, MariaAgentBoard).
 * AmuseMeButton-based components use the module-level linger in useAmuseMe.ts.
 *
 * Phase machine:
 *
 *   hidden      ──(loading → true)──►  loading
 *   loading     ──(loading → false)──► finishing   (10s countdown starts)
 *   finishing   ──(countdown = 0)────► hidden       (amuse disappears)
 *   finishing   ──(extendAmuse())─────► extended    (user clicked Continue)
 *   extended    ──(loading → true)───► loading      (new analysis resets)
 *   extended    ──(dismissAmuse())────► hidden       (user manually closed)
 *
 * Usage in a carousel component:
 *
 *   const {
 *     amuseActive,    // v-if on the amuse block
 *     amuseFinishing, // v-if on the blinking Continue button
 *     amuseCountdown, // shows "Disappearing in Ns"
 *     extendAmuse,    // onClick for Continue button
 *     dismissAmuse,   // onClick for × dismiss (extended state only)
 *   } = useAmuseLifecycle(isAnalysing)
 *
 *   Template pattern:
 *     <!-- Spinner section -->
 *     <div v-if="isAnalysing">...</div>
 *
 *     <!-- Amuse block — stays visible through loading + finishing + extended -->
 *     <div v-if="amuseActive" class="...amuse card...">
 *       ...existing carousel...
 *       <!-- Continue offer — only during finishing phase -->
 *       <div v-if="amuseFinishing" class="...">
 *         <button class="animate-pulse ..." @click="extendAmuse">✨ Click to Continue Amuse Me</button>
 *         <p class="text-[10px] text-slate-400">Disappearing in {{ amuseCountdown }}s</p>
 *       </div>
 *     </div>
 *
 * Twin-portability: pure Composition API — no Vue template or store coupling.
 */

import { ref, watch, onUnmounted, computed, readonly } from 'vue'
import type { Ref, ComputedRef } from 'vue'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type AmusePhase = 'hidden' | 'loading' | 'finishing' | 'extended'

export interface AmuseLifecycle {
  /** True when the amuse block should be rendered (loading | finishing | extended). */
  amuseActive:    ComputedRef<boolean>
  /** True during the 10-second post-loading countdown. Show the blinking Continue button. */
  amuseFinishing: ComputedRef<boolean>
  /** True when user clicked Continue — amuse stays indefinitely. */
  amuseExtended:  ComputedRef<boolean>
  /** Current countdown value (countdownSecs → 0). Only meaningful when amuseFinishing. */
  amuseCountdown: Readonly<Ref<number>>
  /** User clicked "Click to Continue Amuse Me" — cancel the countdown, stay visible. */
  extendAmuse():  void
  /** User manually dismissed amuse (e.g. × button in extended state). */
  dismissAmuse(): void
}

// ─── Composable ────────────────────────────────────────────────────────────────

/**
 * @param loading       The parent component's loading boolean ref/computed.
 * @param countdownSecs How long (in seconds) to wait after loading before hiding amuse.
 *                      Default: 10 — matches the SEM App "Continue Amuse Me" spec.
 */
export function useAmuseLifecycle(
  loading:        Ref<boolean> | ComputedRef<boolean>,
  countdownSecs = 10,
): AmuseLifecycle {
  const phase     = ref<AmusePhase>(loading.value ? 'loading' : 'hidden')
  const countdown = ref(countdownSecs)

  let _countdownTimer: ReturnType<typeof setInterval> | null = null

  function _clearTimer(): void {
    if (_countdownTimer) { clearInterval(_countdownTimer); _countdownTimer = null }
  }

  function _startCountdown(): void {
    _clearTimer()
    countdown.value = countdownSecs
    _countdownTimer = setInterval(() => {
      countdown.value--
      if (countdown.value <= 0) {
        _clearTimer()
        phase.value = 'hidden'
      }
    }, 1_000)
  }

  watch(loading, (isLoading, wasLoading) => {
    if (isLoading) {
      // New analysis started — reset everything
      _clearTimer()
      phase.value     = 'loading'
      countdown.value = countdownSecs
    } else if (wasLoading && !isLoading && (phase.value === 'loading')) {
      // Analysis just finished — enter finishing countdown
      phase.value = 'finishing'
      _startCountdown()
    }
  })

  function extendAmuse(): void {
    _clearTimer()
    phase.value = 'extended'
  }

  function dismissAmuse(): void {
    _clearTimer()
    phase.value = 'hidden'
  }

  onUnmounted(_clearTimer)

  return {
    amuseActive:    computed(() => phase.value !== 'hidden'),
    amuseFinishing: computed(() => phase.value === 'finishing'),
    amuseExtended:  computed(() => phase.value === 'extended'),
    amuseCountdown: readonly(countdown),
    extendAmuse,
    dismissAmuse,
  }
}
