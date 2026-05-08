// UNIT_TYPE=Hook
// useReplay — animated value delivery replay composable
// Spec: Feature #40 — Animated Value Delivery Replay

import { ref } from 'vue'
import type { EvoStep } from '../types/evo-plan'

export function useReplay() {
  const isReplaying = ref(false)
  const replayStep = ref(-1)   // -1 = not started; 0..N-1 = current step; N = complete
  const replayValue = ref(0)   // cumulative value % delivered so far (0–100)

  let _stopped = false

  function _delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  function _animateValue(from: number, to: number, durationMs: number): Promise<void> {
    return new Promise((resolve) => {
      const startTime = performance.now()
      const delta = to - from

      function step(now: number) {
        if (_stopped) {
          resolve()
          return
        }
        const elapsed = now - startTime
        const progress = Math.min(elapsed / durationMs, 1)
        replayValue.value = from + delta * progress
        if (progress < 1) {
          requestAnimationFrame(step)
        } else {
          replayValue.value = to
          resolve()
        }
      }

      requestAnimationFrame(step)
    })
  }

  async function startReplay(steps: EvoStep[]): Promise<void> {
    _stopped = false
    isReplaying.value = true
    replayStep.value = -1
    replayValue.value = 0

    let cumulative = 0

    for (let i = 0; i < steps.length; i++) {
      if (_stopped) break

      replayStep.value = i

      // 800ms: step "delivers"
      await _delay(800)
      if (_stopped) break

      // Animate value from current to current + effortPercent over 600ms
      const target = Math.min(100, cumulative + steps[i].effortPercent)
      await _animateValue(cumulative, target, 600)
      if (_stopped) break

      cumulative = target

      // 400ms pause between steps
      await _delay(400)
      if (_stopped) break
    }

    if (!_stopped) {
      // Mark complete
      replayStep.value = steps.length
      await _delay(1500)
    }

    if (!_stopped) {
      isReplaying.value = false
      replayStep.value = -1
    }
  }

  function stopReplay(): void {
    _stopped = true
    isReplaying.value = false
    replayStep.value = -1
    replayValue.value = 0
  }

  return { isReplaying, replayStep, replayValue, startReplay, stopReplay }
}
