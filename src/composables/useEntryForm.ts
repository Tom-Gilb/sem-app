// UNIT_TYPE=Hook
// useEntryForm — reactive state for the SEM entry form (Stakes · Ends · Means)
// Spec: S.EvoStep1.ComposableImpl / F.ImplementVue3SPAForm

import { reactive, readonly } from 'vue'

export interface EntryFormState {
  stakes: string
  ends: string
  means: string
  isSubmitting: boolean
  hasSubmitted: boolean
}

/**
 * Composable for managing SEM entry form state (Stakes · Ends · Means).
 *
 * Creates an isolated reactive state instance per call — each component or test
 * receives its own state object with no shared singleton.  All mutations must go
 * through the returned setter functions; `state` is exposed as readonly to enforce
 * this contract at the type level.
 *
 * @returns {{ state, setStakes, setEnds, setMeans, setSubmitting, setHasSubmitted, resetForm }}
 *   - state: readonly reactive snapshot of current form state
 *   - setStakes / setEnds / setMeans: update individual string fields
 *   - setSubmitting: toggle the in-flight submission flag
 *   - setHasSubmitted: toggle the post-submission flag
 *   - resetForm: clears all fields and resets flags to initial values
 *
 * Preconditions: none — state initialises empty on every call.
 * Errors: callers must pass valid strings / booleans; no runtime type guards applied.
 */
export function useEntryForm() {
  const state = reactive<EntryFormState>({
    stakes: '',
    ends: '',
    means: '',
    isSubmitting: false,
    hasSubmitted: false,
  })

  function setStakes(value: string) {
    state.stakes = value
  }

  function setEnds(value: string) {
    state.ends = value
  }

  function setMeans(value: string) {
    state.means = value
  }

  function setSubmitting(value: boolean) {
    state.isSubmitting = value
  }

  function setHasSubmitted(value: boolean) {
    state.hasSubmitted = value
  }

  function resetForm() {
    state.stakes = ''
    state.ends = ''
    state.means = ''
    state.isSubmitting = false
    state.hasSubmitted = false
  }

  return {
    state: readonly(state),
    setStakes,
    setEnds,
    setMeans,
    setSubmitting,
    setHasSubmitted,
    resetForm,
  }
}
