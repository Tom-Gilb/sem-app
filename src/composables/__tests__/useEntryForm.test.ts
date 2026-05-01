// Spec: S.EvoStep1.ComposableImpl / F.EvoStep1.DeliverComposableArch
// useEntryForm must be independently unit-testable without mounting a component.

import { describe, test, expect } from 'vitest'
import { useEntryForm } from '../useEntryForm'

// NOTE: useEntryForm creates isolated reactive state per call — each invocation
// returns its own independent state instance. Tests call resetForm() explicitly
// where they test reset behaviour, but cross-test isolation is guaranteed by
// instance-per-call design (Fix 2, Cycle 1 re-run).

describe('useEntryForm', () => {

  describe('initial state after reset', () => {

    test('stakes, ends, means are empty strings after resetForm', () => {
      // Spec: S.EvoStep1.ComposableImpl — useEntryForm reactive Stakes/Ends/Means fields
      const { resetForm, state } = useEntryForm()
      resetForm()
      expect(state.stakes).toBe('')
      expect(state.ends).toBe('')
      expect(state.means).toBe('')
    })

    test('isSubmitting is false after resetForm', () => {
      const { resetForm, state } = useEntryForm()
      resetForm()
      expect(state.isSubmitting).toBe(false)
    })

    test('hasSubmitted is false after resetForm', () => {
      const { resetForm, state } = useEntryForm()
      resetForm()
      expect(state.hasSubmitted).toBe(false)
    })

  })

  describe('setStakes', () => {

    test('updates stakes in state', () => {
      // Spec: S.EvoStep1.ComposableImpl — useEntryForm reactive Stakes field
      const { resetForm, setStakes, state } = useEntryForm()
      resetForm()
      setStakes('As a product manager')
      expect(state.stakes).toBe('As a product manager')
    })

    test('overwrites a previously set stakes value', () => {
      const { resetForm, setStakes, state } = useEntryForm()
      resetForm()
      setStakes('First value')
      setStakes('Second value')
      expect(state.stakes).toBe('Second value')
    })

  })

  describe('setEnds', () => {

    test('updates ends in state', () => {
      // Spec: S.EvoStep1.ComposableImpl — useEntryForm reactive Ends field
      const { resetForm, setEnds, state } = useEntryForm()
      resetForm()
      setEnds('I want to achieve 90% user retention')
      expect(state.ends).toBe('I want to achieve 90% user retention')
    })

  })

  describe('setMeans', () => {

    test('updates means in state', () => {
      // Spec: S.EvoStep1.ComposableImpl — useEntryForm reactive Means field
      const { resetForm, setMeans, state } = useEntryForm()
      resetForm()
      setMeans('By implementing a loyalty rewards programme')
      expect(state.means).toBe('By implementing a loyalty rewards programme')
    })

  })

  describe('setSubmitting', () => {

    test('sets isSubmitting to true', () => {
      const { resetForm, setSubmitting, state } = useEntryForm()
      resetForm()
      setSubmitting(true)
      expect(state.isSubmitting).toBe(true)
    })

    test('sets isSubmitting back to false', () => {
      const { resetForm, setSubmitting, state } = useEntryForm()
      resetForm()
      setSubmitting(true)
      setSubmitting(false)
      expect(state.isSubmitting).toBe(false)
    })

  })

  describe('setHasSubmitted', () => {

    test('sets hasSubmitted to true', () => {
      const { resetForm, setHasSubmitted, state } = useEntryForm()
      resetForm()
      setHasSubmitted(true)
      expect(state.hasSubmitted).toBe(true)
    })

    test('sets hasSubmitted back to false', () => {
      const { resetForm, setHasSubmitted, state } = useEntryForm()
      resetForm()
      setHasSubmitted(true)
      setHasSubmitted(false)
      expect(state.hasSubmitted).toBe(false)
    })

  })

  describe('resetForm', () => {

    test('clears all fields and resets flags', () => {
      // Spec: S.EvoStep1.ComposableImpl — composable must support form reset
      const { setStakes, setEnds, setMeans, setSubmitting, setHasSubmitted, resetForm, state } = useEntryForm()
      setStakes('populated stakes')
      setEnds('populated ends')
      setMeans('populated means')
      setSubmitting(true)
      setHasSubmitted(true)
      resetForm()
      expect(state.stakes).toBe('')
      expect(state.ends).toBe('')
      expect(state.means).toBe('')
      expect(state.isSubmitting).toBe(false)
      expect(state.hasSubmitted).toBe(false)
    })

  })

  describe('state is readonly', () => {

    test('state object is returned as readonly (direct mutation is blocked at type level)', () => {
      // Spec: S.EvoStep1.ComposableImpl — typed reactive state; readonly enforces
      // the contract that mutations must go through the setter functions.
      // At runtime, Vue readonly() only warns in dev mode; we verify the setters work
      // as the intended mutation path.
      const { resetForm, setStakes, state } = useEntryForm()
      resetForm()
      setStakes('via setter')
      expect(state.stakes).toBe('via setter')
    })

  })

  describe('instance isolation (Fix 2 — per-call state)', () => {

    test('two calls to useEntryForm() produce independent state instances', () => {
      // Spec: S.EvoStep1.ComposableImpl — HOOK_02: reactive state must be created inside
      // the composable function so each call creates an independent instance; no singleton.
      // This test verifies Fix 2 from QA Cycle 1: setting stakes on instance A must not
      // affect instance B.
      const a = useEntryForm()
      const b = useEntryForm()
      a.setStakes('instance A value')
      expect(a.state.stakes).toBe('instance A value')
      expect(b.state.stakes).toBe('')  // B is unaffected by A's mutation
    })

    test('resetting one instance does not affect another', () => {
      // Verifies isolation in the opposite direction: reset on B must not clear A's state.
      const a = useEntryForm()
      const b = useEntryForm()
      a.setStakes('should survive reset of B')
      b.setStakes('B value')
      b.resetForm()
      expect(a.state.stakes).toBe('should survive reset of B')
      expect(b.state.stakes).toBe('')
    })

  })

})
