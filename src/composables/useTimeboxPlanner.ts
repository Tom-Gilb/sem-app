// UNIT_TYPE=Composable
// Feature #143 — Timeboxing Planner (panel)
import { ref, computed } from 'vue'
import type { Ref } from 'vue'

export type TimeboxSize = '1hr' | '2hr' | '4hr' | 'full-day'
/** Alias for TimeboxSize — used by EvoPlanView Feature #143 */
export type TimeboxOption = TimeboxSize

export interface TimeboxEntry {
  stepId: string
  stepName: string
  timebox: TimeboxSize
  minutes: number  // 1hr=60, 2hr=120, 4hr=240, full-day=480
  barWidth: number // normalised to 0–100% of max timebox (480 min)
}

function sizeToMinutes(size: TimeboxSize): number {
  switch (size) {
    case '1hr':      return 60
    case '2hr':      return 120
    case '4hr':      return 240
    case 'full-day': return 480
  }
}

export function useTimeboxPlanner(
  steps: Ref<{ id: string; name: string }[]>
) {
  const overrides = ref<Record<string, TimeboxSize>>({})

  const entries = computed<TimeboxEntry[]>(() =>
    steps.value.map((s) => {
      const timebox: TimeboxSize = overrides.value[s.id] ?? '2hr'
      const minutes = sizeToMinutes(timebox)
      return {
        stepId: s.id,
        stepName: s.name,
        timebox,
        minutes,
        barWidth: Math.round((minutes / 480) * 100),
      }
    })
  )

  function setTimebox(stepId: string, size: TimeboxSize): void {
    overrides.value[stepId] = size
  }

  /** Alias for setTimebox — used by EvoPlanView Feature #143 */
  function updateTimebox(stepId: string, size: TimeboxSize): void {
    setTimebox(stepId, size)
  }

  const totalMinutes = computed<number>(() =>
    entries.value.reduce((sum, e) => sum + e.minutes, 0)
  )

  /** totalMinutes / 60 rounded to 1 decimal */
  const totalHours = computed<number>(() =>
    Math.round((totalMinutes.value / 60) * 10) / 10
  )

  /** true when totalMinutes > 480 (more than one full day) */
  const overloadWarning = computed<boolean>(() => totalMinutes.value > 480)

  const totalFormatted = computed<string>(() => {
    const total = totalMinutes.value
    if (total >= 480) {
      const days = Math.floor(total / 480)
      const rem = total % 480
      const remH = Math.floor(rem / 60)
      const remM = rem % 60
      if (remH === 0 && remM === 0) return `${days}d`
      if (remM === 0) return `${days}d ${remH}h`
      return `${days}d ${remH}h ${remM}m`
    }
    const h = Math.floor(total / 60)
    const m = total % 60
    if (m === 0) return `${h}h`
    return `${h}h ${m}m`
  })

  const overLimitSteps = computed<TimeboxEntry[]>(() =>
    entries.value.filter((e) => e.timebox === 'full-day')
  )

  const copied = ref(false)

  function copyMarkdown(): void {
    const header = '| Step | Timebox | Minutes |'
    const divider = '| --- | --- | --- |'
    const rows = entries.value.map(
      (e) => `| ${e.stepName} | ${e.timebox} | ${e.minutes} |`
    )
    const text = [header, divider, ...rows].join('\n')

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {/* silent */})
    }

    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }

  return {
    entries,
    overrides,
    setTimebox,
    updateTimebox,
    totalMinutes,
    totalHours,
    overloadWarning,
    totalFormatted,
    overLimitSteps,
    copyMarkdown,
    copied,
  }
}
