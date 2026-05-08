// Tests for useLoadingState composable
// Spec: F.GlobalThinkingIndicator
// Covers: isLoading false with no keys, true with one key,
//         true with multiple keys, false after all keys stopped,
//         loadingMessage fallback, label override.

import { describe, it, expect, beforeEach } from 'vitest'
import { useLoadingState, _resetLoadingStateForTest } from '../useLoadingState'

describe('useLoadingState', () => {
  beforeEach(() => {
    // Isolate each test — reset the shared singleton
    _resetLoadingStateForTest()
  })

  it('isLoading is false when no keys are active', () => {
    const { isLoading } = useLoadingState()
    expect(isLoading.value).toBe(false)
  })

  it('isLoading is true after startLoading is called with one key', () => {
    const { startLoading, isLoading } = useLoadingState()
    startLoading('test:op')
    expect(isLoading.value).toBe(true)
  })

  it('isLoading remains true when multiple keys are active', () => {
    const { startLoading, stopLoading, isLoading } = useLoadingState()
    startLoading('op:a')
    startLoading('op:b')
    stopLoading('op:a')
    // op:b is still active — should still be true
    expect(isLoading.value).toBe(true)
  })

  it('isLoading is false after all active keys are stopped', () => {
    const { startLoading, stopLoading, isLoading } = useLoadingState()
    startLoading('op:x')
    startLoading('op:y')
    stopLoading('op:x')
    stopLoading('op:y')
    expect(isLoading.value).toBe(false)
  })

  it('loadingMessage returns the label provided to startLoading', () => {
    const { startLoading, loadingMessage } = useLoadingState()
    startLoading('sdk:translate', 'Translating your plan…')
    expect(loadingMessage.value).toBe('Translating your plan…')
  })

  it('loadingMessage falls back to "Thinking…" when no label is provided', () => {
    const { startLoading, loadingMessage } = useLoadingState()
    startLoading('op:unlabelled')
    expect(loadingMessage.value).toBe('Thinking…')
  })

  it('loadingMessage is empty string when no keys are active', () => {
    const { loadingMessage } = useLoadingState()
    expect(loadingMessage.value).toBe('')
  })

  it('stopLoading is a no-op for a key that was never started', () => {
    const { stopLoading, isLoading } = useLoadingState()
    expect(() => stopLoading('non-existent:key')).not.toThrow()
    expect(isLoading.value).toBe(false)
  })
})
