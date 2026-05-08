// UNIT_TYPE=Test
// Feature #143 — Tests for useTimeboxPlanner composable

import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useTimeboxPlanner } from '../useTimeboxPlanner'

const sampleSteps = ref([
  { id: 'step-0', name: 'Define Scope' },
  { id: 'step-1', name: 'Build API' },
  { id: 'step-2', name: 'Write Tests' },
])

describe('useTimeboxPlanner', () => {
  it('entry count equals step count', () => {
    const { entries } = useTimeboxPlanner(sampleSteps)
    expect(entries.value).toHaveLength(3)
  })

  it('default timebox is 2hr for all entries', () => {
    const { entries } = useTimeboxPlanner(sampleSteps)
    for (const e of entries.value) {
      expect(e.timebox).toBe('2hr')
    }
  })

  it('default minutes is 120 for all entries', () => {
    const { entries } = useTimeboxPlanner(sampleSteps)
    for (const e of entries.value) {
      expect(e.minutes).toBe(120)
    }
  })

  it('setTimebox overrides to 1hr (60 min)', () => {
    const steps = ref([{ id: 'step-0', name: 'Define Scope' }])
    const { entries, setTimebox } = useTimeboxPlanner(steps)
    setTimebox('step-0', '1hr')
    expect(entries.value[0].timebox).toBe('1hr')
    expect(entries.value[0].minutes).toBe(60)
  })

  it('setTimebox overrides to 4hr (240 min)', () => {
    const steps = ref([{ id: 'step-0', name: 'Build API' }])
    const { entries, setTimebox } = useTimeboxPlanner(steps)
    setTimebox('step-0', '4hr')
    expect(entries.value[0].timebox).toBe('4hr')
    expect(entries.value[0].minutes).toBe(240)
  })

  it('setTimebox overrides to full-day (480 min)', () => {
    const steps = ref([{ id: 'step-0', name: 'Write Tests' }])
    const { entries, setTimebox } = useTimeboxPlanner(steps)
    setTimebox('step-0', 'full-day')
    expect(entries.value[0].timebox).toBe('full-day')
    expect(entries.value[0].minutes).toBe(480)
  })

  it('totalMinutes sums all step minutes (default: 3 × 120 = 360)', () => {
    const { totalMinutes } = useTimeboxPlanner(sampleSteps)
    expect(totalMinutes.value).toBe(360)
  })

  it('totalMinutes updates reactively after setTimebox', () => {
    const steps = ref([
      { id: 'step-0', name: 'A' },
      { id: 'step-1', name: 'B' },
    ])
    const { totalMinutes, setTimebox } = useTimeboxPlanner(steps)
    setTimebox('step-0', '4hr') // 240 + 120 = 360
    expect(totalMinutes.value).toBe(360)
  })

  it('totalFormatted shows hours and minutes for totals under 480', () => {
    const steps = ref([{ id: 'step-0', name: 'A' }])
    const { totalFormatted } = useTimeboxPlanner(steps)
    // 1 step × 120 min default = 2h
    expect(totalFormatted.value).toBe('2h')
  })

  it('totalFormatted shows days format when total >= 480', () => {
    const steps = ref([
      { id: 'step-0', name: 'A' },
      { id: 'step-1', name: 'B' },
      { id: 'step-2', name: 'C' },
      { id: 'step-3', name: 'D' },
    ])
    const { totalFormatted, setTimebox } = useTimeboxPlanner(steps)
    // 4 × 120 = 480 min = 1d
    expect(totalFormatted.value).toBe('1d')
    setTimebox('step-0', '4hr') // 240 + 120 + 120 + 120 = 600 min
    // 600 min: 1 day = 480, rem = 120 min = 2h → '1d 2h'
    expect(totalFormatted.value).toBe('1d 2h')
  })

  it('overLimitSteps returns steps with full-day timebox', () => {
    const steps = ref([
      { id: 'step-0', name: 'A' },
      { id: 'step-1', name: 'B' },
    ])
    const { overLimitSteps, setTimebox } = useTimeboxPlanner(steps)
    expect(overLimitSteps.value).toHaveLength(0)
    setTimebox('step-0', 'full-day')
    expect(overLimitSteps.value).toHaveLength(1)
    expect(overLimitSteps.value[0].stepId).toBe('step-0')
  })

  it('overLimitSteps is empty when no full-day steps', () => {
    const { overLimitSteps } = useTimeboxPlanner(sampleSteps)
    expect(overLimitSteps.value).toHaveLength(0)
  })

  it('copyMarkdown produces pipe table with Step, Timebox, Minutes headers', () => {
    const clipboardTexts: string[] = []
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        clipboard: {
          writeText: (text: string) => {
            clipboardTexts.push(text)
            return Promise.resolve()
          },
        },
      },
      writable: true,
      configurable: true,
    })

    const { copyMarkdown } = useTimeboxPlanner(sampleSteps)
    copyMarkdown()

    const text = clipboardTexts[0]
    expect(text).toContain('| Step | Timebox | Minutes |')
    expect(text).toContain('| --- | --- | --- |')
  })

  it('copyMarkdown includes step names and values', () => {
    const clipboardTexts: string[] = []
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        clipboard: {
          writeText: (text: string) => {
            clipboardTexts.push(text)
            return Promise.resolve()
          },
        },
      },
      writable: true,
      configurable: true,
    })

    const steps = ref([{ id: 'step-0', name: 'My Special Step' }])
    const { copyMarkdown } = useTimeboxPlanner(steps)
    copyMarkdown()

    const text = clipboardTexts[0]
    expect(text).toContain('My Special Step')
    expect(text).toContain('2hr')
    expect(text).toContain('120')
  })

  it('no steps yields totalMinutes of 0', () => {
    const steps = ref<{ id: string; name: string }[]>([])
    const { totalMinutes } = useTimeboxPlanner(steps)
    expect(totalMinutes.value).toBe(0)
  })

  it('setTimebox on one step does not affect others', () => {
    const steps = ref([
      { id: 'step-0', name: 'A' },
      { id: 'step-1', name: 'B' },
      { id: 'step-2', name: 'C' },
    ])
    const { entries, setTimebox } = useTimeboxPlanner(steps)
    setTimebox('step-0', '4hr')
    expect(entries.value[1].timebox).toBe('2hr')
    expect(entries.value[2].timebox).toBe('2hr')
  })
})
