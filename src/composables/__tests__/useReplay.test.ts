// Tests for useReplay composable — Feature #40

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { useReplay } from '../useReplay'
import type { EvoStep } from '../../types/evo-plan'

function makeStep(name: string, effortPercent = 25): EvoStep {
  return {
    name,
    description: 'A step',
    linkedValues: ['V.Test'],
    linkedSolution: 'S.Test',
    effortPercent,
  }
}

const STEPS: EvoStep[] = [
  makeStep('S.Evo1', 30),
  makeStep('S.Evo2', 20),
  makeStep('S.Evo3', 10),
]

describe('useReplay', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // requestAnimationFrame: immediately invoke with a timestamp so animations complete synchronously
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(performance.now() + 700) // large elapsed so progress === 1 immediately
      return 0
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  test('initial state: isReplaying=false, replayStep=-1, replayValue=0', () => {
    const { isReplaying, replayStep, replayValue } = useReplay()
    expect(isReplaying.value).toBe(false)
    expect(replayStep.value).toBe(-1)
    expect(replayValue.value).toBe(0)
  })

  test('stopReplay() resets all values to initial state', () => {
    const { isReplaying, replayStep, replayValue, stopReplay } = useReplay()
    // Manually set some values to simulate mid-replay state
    isReplaying.value = true
    replayStep.value = 1
    replayValue.value = 42

    stopReplay()

    expect(isReplaying.value).toBe(false)
    expect(replayStep.value).toBe(-1)
    expect(replayValue.value).toBe(0)
  })

  test('startReplay() sets isReplaying=true immediately', () => {
    const { isReplaying, startReplay } = useReplay()

    const promise = startReplay(STEPS)
    expect(isReplaying.value).toBe(true)

    // Clean up
    vi.runAllTimersAsync().then(() => promise)
  })

  test('after startReplay completes, isReplaying=false', async () => {
    const { isReplaying, startReplay } = useReplay()

    const promise = startReplay(STEPS)
    await vi.runAllTimersAsync()
    await promise

    expect(isReplaying.value).toBe(false)
  })

  test('after startReplay completes, replayStep resets to -1', async () => {
    const { replayStep, startReplay } = useReplay()

    const promise = startReplay(STEPS)
    await vi.runAllTimersAsync()
    await promise

    expect(replayStep.value).toBe(-1)
  })

  test('replayValue is between 0 and 100 during replay', async () => {
    const { replayValue, startReplay } = useReplay()

    const promise = startReplay(STEPS)
    // Check at start
    expect(replayValue.value).toBeGreaterThanOrEqual(0)
    expect(replayValue.value).toBeLessThanOrEqual(100)

    await vi.runAllTimersAsync()
    await promise

    expect(replayValue.value).toBeGreaterThanOrEqual(0)
    expect(replayValue.value).toBeLessThanOrEqual(100)
  })

  test('startReplay sets replayStep to steps.length when complete (before reset)', async () => {
    const { replayStep, startReplay } = useReplay()
    let stepAtComplete = -999

    const promise = startReplay(STEPS)

    // Advance past all step timers (3 steps × (800 + 400) = 3600ms)
    await vi.advanceTimersByTimeAsync(3600)
    // At this point replayStep should be steps.length (3) before the final 1500ms delay
    stepAtComplete = replayStep.value

    // Now let the final 1500ms + reset happen
    await vi.runAllTimersAsync()
    await promise

    // The step was steps.length before final reset
    expect(stepAtComplete).toBe(STEPS.length)
  })

  test('stopReplay() during replay stops it immediately', async () => {
    const { isReplaying, replayStep, replayValue, startReplay, stopReplay } = useReplay()

    startReplay(STEPS)
    expect(isReplaying.value).toBe(true)

    stopReplay()

    expect(isReplaying.value).toBe(false)
    expect(replayStep.value).toBe(-1)
    expect(replayValue.value).toBe(0)

    vi.clearAllTimers()
  })
})
