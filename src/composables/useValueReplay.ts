// UNIT_TYPE=Composable
// Feature #40 — Animated Value Delivery Replay
// Drives a step-by-step replay animation where each Evo step "delivers"
// its value one by one, with animated counter increments.

import { ref, computed } from 'vue'
import type { EvoStep } from '../types/evo-plan'

/** Duration (ms) between delivering each step */
const STEP_INTERVAL_MS = 1200
/** Duration (ms) of the counter animation per step */
const COUNTER_DURATION_MS = 800

export interface ReplayFrame {
  stepIndex: number
  stepName: string
  valueDelivered: number    // cumulative % of value delivered so far (0–100)
  effortPercent: number     // this step's effort %
}

export function useValueReplay() {
  /** Whether replay is currently running */
  const isPlaying = ref(false)
  /** Index of the step currently being "delivered" (-1 = not started) */
  const currentStepIndex = ref(-1)
  /** Cumulative value counter (0–100) — drives the animated display */
  const cumulativeValue = ref(0)
  /** Animated display value — lags behind cumulativeValue during tween */
  const displayValue = ref(0)
  /** Whether replay has completed all steps */
  const isComplete = ref(false)

  /** Frames in replay order, computed from confirmed steps */
  const frames = ref<ReplayFrame[]>([])

  let _stepTimer: ReturnType<typeof setTimeout> | null = null
  let _tweenTimer: ReturnType<typeof setInterval> | null = null

  /** Initialise frames from confirmed Evo steps */
  function init(steps: EvoStep[]): void {
    let cumulative = 0
    frames.value = steps.map((step, i) => {
      cumulative = Math.min(100, cumulative + step.effortPercent)
      return {
        stepIndex: i,
        stepName: step.name,
        valueDelivered: cumulative,
        effortPercent: step.effortPercent,
      }
    })
    reset()
  }

  /** Reset to initial state without clearing frames */
  function reset(): void {
    _stopTimers()
    isPlaying.value = false
    currentStepIndex.value = -1
    cumulativeValue.value = 0
    displayValue.value = 0
    isComplete.value = false
  }

  /** Animate displayValue from its current value up to targetValue */
  function _animateCounter(targetValue: number): void {
    _stopTween()
    const startValue = displayValue.value
    const delta = targetValue - startValue
    if (delta <= 0) {
      displayValue.value = targetValue
      return
    }
    const startTime = Date.now()
    _tweenTimer = setInterval(() => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(1, elapsed / COUNTER_DURATION_MS)
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      displayValue.value = Math.round(startValue + delta * eased)
      if (progress >= 1) {
        displayValue.value = targetValue
        _stopTween()
      }
    }, 16)
  }

  function _stopTween(): void {
    if (_tweenTimer !== null) {
      clearInterval(_tweenTimer)
      _tweenTimer = null
    }
  }

  function _stopTimers(): void {
    if (_stepTimer !== null) {
      clearTimeout(_stepTimer)
      _stepTimer = null
    }
    _stopTween()
  }

  /** Deliver the next step in the sequence */
  function _deliverNext(): void {
    const nextIndex = currentStepIndex.value + 1
    if (nextIndex >= frames.value.length) {
      isPlaying.value = false
      isComplete.value = true
      return
    }
    currentStepIndex.value = nextIndex
    const frame = frames.value[nextIndex]
    cumulativeValue.value = frame.valueDelivered
    _animateCounter(frame.valueDelivered)

    if (nextIndex < frames.value.length - 1) {
      _stepTimer = setTimeout(_deliverNext, STEP_INTERVAL_MS)
    } else {
      // Last step — mark complete after animation finishes
      _stepTimer = setTimeout(() => {
        isPlaying.value = false
        isComplete.value = true
      }, COUNTER_DURATION_MS + 100)
    }
  }

  /** Start replay from step 0 (or resume if paused) */
  function play(steps?: EvoStep[]): void {
    if (steps) init(steps)
    if (frames.value.length === 0) return
    if (isComplete.value) reset()
    isPlaying.value = true
    _deliverNext()
  }

  /** Pause mid-replay */
  function pause(): void {
    _stopTimers()
    isPlaying.value = false
  }

  /** Step forward one step manually */
  function stepForward(): void {
    if (isComplete.value) return
    const nextIndex = currentStepIndex.value + 1
    if (nextIndex >= frames.value.length) {
      isComplete.value = true
      return
    }
    currentStepIndex.value = nextIndex
    const frame = frames.value[nextIndex]
    cumulativeValue.value = frame.valueDelivered
    _animateCounter(frame.valueDelivered)
    if (nextIndex >= frames.value.length - 1) isComplete.value = true
  }

  /** Current frame being delivered (null if not started) */
  const currentFrame = computed(() =>
    currentStepIndex.value >= 0 ? frames.value[currentStepIndex.value] ?? null : null,
  )

  /** Progress as 0–1 fraction of steps delivered */
  const progress = computed(() =>
    frames.value.length > 0
      ? (currentStepIndex.value + 1) / frames.value.length
      : 0,
  )

  return {
    isPlaying,
    isComplete,
    currentStepIndex,
    displayValue,
    cumulativeValue,
    frames,
    currentFrame,
    progress,
    init,
    play,
    pause,
    reset,
    stepForward,
  }
}
