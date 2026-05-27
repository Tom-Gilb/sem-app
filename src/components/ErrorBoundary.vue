<!--
  ErrorBoundary.vue — Vue 3 render / lifecycle error catcher.
  Wraps risky surfaces (AI streaming panels, complex visualisations, third-party
  integrations) so a crash in one slot does NOT cascade to the whole app.

  Usage:
    <ErrorBoundary label="Plan Health Display">
      <PlanHealthStatusPanel :spec="currentSpec" />
    </ErrorBoundary>

    <ErrorBoundary label="Evo Simulator" silent>
      <EvoSimulatorView />
    </ErrorBoundary>

  Behaviour:
    - When a descendant throws (render, lifecycle, or async via `onErrorCaptured`),
      ErrorBoundary hides the slot and shows a friendly recovery card.
    - Returns `false` from `onErrorCaptured` to stop Vue propagating the error
      to the global `app.config.errorHandler`.
    - Retry button increments `mountKey`, forcing the slot subtree to fully remount.
    - `silent` mode: swallows the error and shows nothing (slot unmounts quietly).
      Use for decorative or non-essential content where an error card is worse than
      blank space.

  Architecture note (Architectural Resilience Rule, 2026-05-27):
    This is the "last defensive layer" — it does NOT replace try/catch in composables
    or graceful-degradation logic in individual components. It catches whatever slips
    through. Every surface that calls an external API or renders unbounded user data
    should be wrapped in an ErrorBoundary.

  Spec: Architectural Resilience Rule (Tom Gilb 2026-05-27) — resilience first.
  P6 (2026-05-27): Forensic reconstruction — was lost in git reset --hard.
-->
<script setup lang="ts">
// UNIT_TYPE=Widget
import { ref, onErrorCaptured } from 'vue'

const props = withDefaults(defineProps<{
  /** Human-readable label for the surface being protected (shown in error card). */
  label?: string
  /**
   * If true: swallows the error silently — slot unmounts with no visible card.
   * Use for decorative / non-essential content where an error card is intrusive.
   * Default false (shows the friendly recovery card on error).
   */
  silent?: boolean
}>(), {
  label: 'This section',
  silent: false,
})

const emit = defineEmits<{
  /** Fired when an error is caught. Useful for telemetry / logging. */
  error: [error: unknown, info: string]
}>()

const hasError  = ref(false)
const errorMsg  = ref('')
const mountKey  = ref(0)   // increment to force slot remount on retry

onErrorCaptured((err, _instance, info) => {
  hasError.value = true
  // Surface a readable message — most errors are Error instances.
  errorMsg.value =
    err instanceof Error
      ? err.message
      : String(err ?? 'An unexpected error occurred')

  // Always log to the console (helps developers without spamming users).
  console.error(`[ErrorBoundary] Error in "${props.label}":`, err, '\nInfo:', info)

  emit('error', err, info)

  // Return false → stop Vue's error propagation; we own this error now.
  return false
})

function retry(): void {
  hasError.value = false
  errorMsg.value = ''
  mountKey.value++
}
</script>

<template>
  <!-- Error recovery card — shown when a descendant throws. -->
  <div
    v-if="hasError && !silent"
    role="alert"
    class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3"
  >
    <!-- Warning icon -->
    <span class="text-amber-500 text-xl shrink-0 mt-0.5" aria-hidden="true">⚠️</span>
    <div class="min-w-0 flex-1">
      <p class="text-sm font-semibold text-amber-800 leading-tight">
        {{ label }} ran into a problem
      </p>
      <p class="text-xs text-amber-600 mt-1 leading-snug break-words">
        {{ errorMsg || 'An unexpected error occurred.' }}
      </p>
      <button
        type="button"
        class="mt-2 text-xs font-semibold text-amber-700 hover:text-amber-900
               focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded
               underline-offset-2 hover:underline"
        @click="retry"
      >
        ↻ Try again
      </button>
    </div>
  </div>

  <!-- Normal slot — hidden (not rendered) while error is active.
       mountKey forces a full remount on retry so stale state is cleared. -->
  <slot v-else :key="mountKey" />
</template>
