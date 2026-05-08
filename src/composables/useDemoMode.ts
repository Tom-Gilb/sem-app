// UNIT_TYPE=Hook
// useDemoMode — 60-second automated walkthrough composable
// Spec: F.DemoMode (#8)

import { ref } from 'vue'

const DEMO_STAKES = 'Product Manager at a SaaS startup'
const DEMO_ENDS = 'Increase user retention rate from 45% to 75% within 3 months'
const DEMO_MEANS =
  'Implement personalised onboarding flow with progress tracking and milestone celebration'

export function useDemoMode() {
  const isDemoRunning = ref(false)
  /** 0=idle, 1=filling fields, 2=translating, 3=evoplan, 4=tasks, 5=impact */
  const demoStage = ref(0)

  let _autoStopTimer: ReturnType<typeof setTimeout> | null = null

  function stopDemo(): void {
    isDemoRunning.value = false
    demoStage.value = 0
    if (_autoStopTimer !== null) {
      clearTimeout(_autoStopTimer)
      _autoStopTimer = null
    }
  }

  async function startDemo(callbacks: {
    fillFields: (s: string, e: string, m: string) => void
    submitForm: () => void
    advanceStage: (n: number) => void
  }): Promise<void> {
    isDemoRunning.value = true
    demoStage.value = 1

    // Auto-stop after 60s
    _autoStopTimer = setTimeout(() => stopDemo(), 60_000)

    // After 800ms: fill the fields
    await _delay(800)
    if (!isDemoRunning.value) return
    callbacks.fillFields(DEMO_STAKES, DEMO_ENDS, DEMO_MEANS)

    // After 2s total (1200ms more): submit
    await _delay(1200)
    if (!isDemoRunning.value) return
    demoStage.value = 2
    callbacks.submitForm()

    // After 3 more seconds: advance to evo plan stage
    await _delay(3000)
    if (!isDemoRunning.value) return
    callbacks.advanceStage(2)
    demoStage.value = 3
  }

  return {
    isDemoRunning,
    demoStage,
    startDemo,
    stopDemo,
    DEMO_STAKES,
    DEMO_ENDS,
    DEMO_MEANS,
  }
}

function _delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
