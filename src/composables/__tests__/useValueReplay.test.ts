// UNIT_TYPE=Test
// Feature #40 — Tests for useValueReplay composable

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useValueReplay } from '../useValueReplay'
import type { EvoStep } from '../../types/evo-plan'

vi.useFakeTimers()

function makeSteps(effortPercents: number[]): EvoStep[] {
  return effortPercents.map((pct, i) => ({
    name: `Step${i + 1}`,
    description: `Step ${i + 1}`,
    linkedValues: ['V.TestValue'],
    linkedSolution: 'S.TestSolution',
    effortPercent: pct,
  }))
}

describe('useValueReplay', () => {
  let replay: ReturnType<typeof useValueReplay>

  beforeEach(() => {
    replay = useValueReplay()
    vi.clearAllTimers()
  })

  describe('init()', () => {
    it('creates one frame per step', () => {
      replay.init(makeSteps([20, 30, 50]))
      expect(replay.frames.value).toHaveLength(3)
    })

    it('frames have cumulative valueDelivered', () => {
      replay.init(makeSteps([20, 30, 50]))
      expect(replay.frames.value[0].valueDelivered).toBe(20)
      expect(replay.frames.value[1].valueDelivered).toBe(50)
      expect(replay.frames.value[2].valueDelivered).toBe(100)
    })

    it('cumulative value is capped at 100', () => {
      replay.init(makeSteps([60, 60]))
      expect(replay.frames.value[1].valueDelivered).toBe(100)
    })

    it('reset is called on init — currentStepIndex becomes -1', () => {
      replay.init(makeSteps([50]))
      expect(replay.currentStepIndex.value).toBe(-1)
    })

    it('handles empty steps array', () => {
      replay.init([])
      expect(replay.frames.value).toHaveLength(0)
    })
  })

  describe('play()', () => {
    it('sets isPlaying to true', () => {
      replay.init(makeSteps([50]))
      replay.play()
      expect(replay.isPlaying.value).toBe(true)
    })

    it('advances to first step immediately', () => {
      replay.init(makeSteps([30, 70]))
      replay.play()
      expect(replay.currentStepIndex.value).toBe(0)
    })

    it('does nothing when frames are empty', () => {
      replay.init([])
      replay.play()
      expect(replay.isPlaying.value).toBe(false)
    })

    it('advances through all steps after intervals fire', () => {
      replay.init(makeSteps([20, 30, 50]))
      replay.play()
      // First step (index 0) delivered immediately
      expect(replay.currentStepIndex.value).toBe(0)
      // STEP_INTERVAL_MS = 1200ms → step 1 fires at t=1200
      vi.advanceTimersByTime(1200)
      expect(replay.currentStepIndex.value).toBe(1)
      // Another 1200ms → step 2 fires at t=2400
      vi.advanceTimersByTime(1200)
      expect(replay.currentStepIndex.value).toBe(2)
    })

    it('marks isComplete after last step', () => {
      replay.init(makeSteps([100]))
      replay.play()
      // Last step marks complete after COUNTER_DURATION_MS (800ms) + 100ms buffer = 900ms
      vi.advanceTimersByTime(950)
      expect(replay.isComplete.value).toBe(true)
    })

    it('resets and replays if already complete', () => {
      replay.init(makeSteps([100]))
      replay.play()
      vi.advanceTimersByTime(950)
      expect(replay.isComplete.value).toBe(true)
      replay.play()
      expect(replay.isComplete.value).toBe(false)
      expect(replay.isPlaying.value).toBe(true)
    })
  })

  describe('pause()', () => {
    it('sets isPlaying to false', () => {
      replay.init(makeSteps([30, 70]))
      replay.play()
      replay.pause()
      expect(replay.isPlaying.value).toBe(false)
    })

    it('does not advance to next step after pause', () => {
      replay.init(makeSteps([30, 70]))
      replay.play()
      const indexAfterFirst = replay.currentStepIndex.value
      replay.pause()
      vi.advanceTimersByTime(5000)
      expect(replay.currentStepIndex.value).toBe(indexAfterFirst)
    })
  })

  describe('reset()', () => {
    it('resets currentStepIndex to -1', () => {
      replay.init(makeSteps([50]))
      replay.play()
      replay.reset()
      expect(replay.currentStepIndex.value).toBe(-1)
    })

    it('resets cumulativeValue and displayValue to 0', () => {
      replay.init(makeSteps([50]))
      replay.play()
      replay.reset()
      expect(replay.cumulativeValue.value).toBe(0)
      expect(replay.displayValue.value).toBe(0)
    })

    it('sets isPlaying to false', () => {
      replay.init(makeSteps([50]))
      replay.play()
      replay.reset()
      expect(replay.isPlaying.value).toBe(false)
    })

    it('sets isComplete to false', () => {
      replay.init(makeSteps([100]))
      replay.play()
      vi.advanceTimersByTime(950)   // enough for 1-step replay to complete
      expect(replay.isComplete.value).toBe(true)
      replay.reset()
      expect(replay.isComplete.value).toBe(false)
    })
  })

  describe('stepForward()', () => {
    it('advances one step at a time', () => {
      replay.init(makeSteps([25, 25, 50]))
      replay.stepForward()
      expect(replay.currentStepIndex.value).toBe(0)
      replay.stepForward()
      expect(replay.currentStepIndex.value).toBe(1)
    })

    it('does nothing when complete', () => {
      replay.init(makeSteps([100]))
      replay.stepForward()
      const idx = replay.currentStepIndex.value
      replay.stepForward()
      expect(replay.currentStepIndex.value).toBe(idx)
    })
  })

  describe('currentFrame', () => {
    it('is null before any steps delivered', () => {
      replay.init(makeSteps([50]))
      expect(replay.currentFrame.value).toBeNull()
    })

    it('reflects the currently delivered step', () => {
      replay.init(makeSteps([30, 70]))
      replay.play()
      expect(replay.currentFrame.value?.stepName).toBe('Step1')
    })
  })

  describe('progress', () => {
    it('is 0 before replay starts', () => {
      replay.init(makeSteps([50, 50]))
      expect(replay.progress.value).toBe(0)
    })

    it('is 0.5 after first of two steps', () => {
      replay.init(makeSteps([50, 50]))
      replay.play()
      expect(replay.progress.value).toBeCloseTo(0.5, 5)
    })

    it('is 0 when no frames', () => {
      replay.init([])
      expect(replay.progress.value).toBe(0)
    })
  })
})
