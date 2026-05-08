// UNIT_TYPE=Hook
// useLoadingState — global async operation tracker for the SEM App
// Spec: F.GlobalThinkingIndicator
//
// Exposes a shared singleton set of active loading keys so any component or
// composable can register an in-progress async operation. ThinkingIndicator.vue
// reads isLoading to decide when to show the visual feedback.

import { ref, computed, readonly } from 'vue'

// --- Module-level singleton state ---
// Shared across all useLoadingState() calls so the indicator reflects every
// concurrent operation regardless of which composable started it.

const _activeKeys = ref<Set<string>>(new Set())

/**
 * Global loading-state composable.
 *
 * Call startLoading(key) before an async operation and stopLoading(key) in
 * its finally block. The key should describe the operation (e.g. 'sdk:translate',
 * 'auth:signIn') so concurrent operations do not cancel each other out.
 *
 * isLoading is true if any key is currently registered.
 * loadingMessage returns the most recent key label for context-aware copy.
 *
 * @returns {{ startLoading, stopLoading, isLoading, loadingMessage }}
 *
 * @example
 * const { startLoading, stopLoading } = useLoadingState()
 * startLoading('sdk:translate', 'Translating your plan…')
 * try {
 *   await translate(...)
 * } finally {
 *   stopLoading('sdk:translate')
 * }
 */
export function useLoadingState() {
  // Human-readable labels keyed by operation key — used for loadingMessage
  const _labels = ref<Record<string, string>>({})

  /**
   * Registers an active async operation by key.
   *
   * @param key   - Unique identifier for this operation (e.g. 'auth:signIn')
   * @param label - Optional human-readable label shown in the indicator
   *                (e.g. 'Translating your plan…')
   */
  function startLoading(key: string, label?: string): void {
    _activeKeys.value = new Set([..._activeKeys.value, key])
    if (label) {
      _labels.value = { ..._labels.value, [key]: label }
    }
  }

  /**
   * Deregisters a completed async operation by key.
   *
   * @param key - The same key passed to startLoading
   */
  function stopLoading(key: string): void {
    const next = new Set(_activeKeys.value)
    next.delete(key)
    _activeKeys.value = next
    const nextLabels = { ..._labels.value }
    delete nextLabels[key]
    _labels.value = nextLabels
  }

  /**
   * True when at least one async operation is registered.
   * Drives the ThinkingIndicator visibility.
   */
  const isLoading = computed(() => _activeKeys.value.size > 0)

  /**
   * The label of the most recently started still-active operation.
   * Falls back to a generic label when no specific label was provided.
   */
  const loadingMessage = computed<string>(() => {
    if (_activeKeys.value.size === 0) return ''
    // Return the label of the last active key, or a generic fallback
    const keys = [..._activeKeys.value]
    const lastKey = keys[keys.length - 1]
    return _labels.value[lastKey] ?? 'Thinking…'
  })

  return {
    startLoading,
    stopLoading,
    isLoading: readonly(isLoading),
    loadingMessage: readonly(loadingMessage),
  }
}

/**
 * Resets the module-level loading state for test isolation.
 * @internal
 */
export function _resetLoadingStateForTest(): void {
  _activeKeys.value = new Set()
}
