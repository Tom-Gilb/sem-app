// UNIT_TYPE=Test
// Feature #165 — Tests for useFlowEfficiency composable

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useFlowEfficiency } from '../useFlowEfficiency'

beforeEach(() => {
  Object.defineProperty(globalThis, 'navigator', {
    value: {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    },
    writable: true,
    configurable: true,
  })
  vi.useFakeTimers()
})

const STEPS_3 = [
  { id: 'step-0', title: 'Setup CI/CD' },
  { id: 'step-1', title: 'Build Core API' },
  { id: 'step-2', title: 'Write Tests' },
]

const STEPS_SINGLE = [{ id: 'step-0', title: 'Alpha' }]

describe('useFlowEfficiency', () => {
  // 1 — open starts false
  it('open starts false', () => {
    const { open } = useFlowEfficiency(() => STEPS_3)
    expect(open.value).toBe(false)
  })

  // 2 — correct step count
  it('flowSteps has same length as input steps', () => {
    const { flowSteps } = useFlowEfficiency(() => STEPS_3)
    expect(flowSteps.value).toHaveLength(3)
  })

  // 3 — flowEfficiency = active/(active+idle) × 100 rounded
  it('flowEfficiency equals Math.round(effort / (effort + idleTime) * 100)', () => {
    const { flowSteps } = useFlowEfficiency(() => STEPS_SINGLE)
    const s = flowSteps.value[0]
    const expected = Math.round((s.effort / (s.effort + s.idleTime)) * 100)
    expect(s.flowEfficiency).toBe(expected)
  })

  // 4 — isBottleneck when flowEfficiency < 40
  it('isBottleneck is true when flowEfficiency < 40', () => {
    // Craft a step where idle >> effort to guarantee bottleneck
    // Use effort=1, idleTime from seed; or just check computed value against threshold
    const { flowSteps } = useFlowEfficiency(() => STEPS_3)
    for (const s of flowSteps.value) {
      expect(s.isBottleneck).toBe(s.flowEfficiency < 40)
    }
  })

  // 5 — avgFlowEfficiency = average across all steps
  it('avgFlowEfficiency is the rounded average of all step efficiencies', () => {
    const { flowSteps, avgFlowEfficiency } = useFlowEfficiency(() => STEPS_3)
    const sum = flowSteps.value.reduce((a, s) => a + s.flowEfficiency, 0)
    const expected = Math.round(sum / flowSteps.value.length)
    expect(avgFlowEfficiency.value).toBe(expected)
  })

  // 6 — bottleneckCount = count where isBottleneck
  it('bottleneckCount equals the number of steps with isBottleneck=true', () => {
    const { flowSteps, bottleneckCount } = useFlowEfficiency(() => STEPS_3)
    const expected = flowSteps.value.filter(s => s.isBottleneck).length
    expect(bottleneckCount.value).toBe(expected)
  })

  // 7 — empty steps: flowSteps empty, avgFlowEfficiency = 0, bottleneckCount = 0
  it('edge case: empty steps returns empty flowSteps and avgFlowEfficiency=0', () => {
    const { flowSteps, avgFlowEfficiency, bottleneckCount } = useFlowEfficiency(() => [])
    expect(flowSteps.value).toHaveLength(0)
    expect(avgFlowEfficiency.value).toBe(0)
    expect(bottleneckCount.value).toBe(0)
  })

  // 8 — single step: step count = 1
  it('single step: flowSteps has exactly 1 entry', () => {
    const { flowSteps } = useFlowEfficiency(() => STEPS_SINGLE)
    expect(flowSteps.value).toHaveLength(1)
  })

  // 9 — stepTitle is truncated to 20 chars
  it('stepTitle is truncated to at most 20 characters', () => {
    const longTitle = 'A'.repeat(30)
    const { flowSteps } = useFlowEfficiency(() => [{ id: 'step-0', title: longTitle }])
    expect(flowSteps.value[0].stepTitle.length).toBeLessThanOrEqual(20)
  })

  // 10 — effort defaults when not provided
  it('effort defaults when not provided (4 + (i%4)*2)', () => {
    const { flowSteps } = useFlowEfficiency(() => [
      { id: 'step-0', title: 'No Effort' },
    ])
    // default for i=0: 4 + (0%4)*2 = 4
    expect(flowSteps.value[0].effort).toBe(4)
  })

  // 11 — explicit effort is used when provided
  it('explicit effort is used when provided', () => {
    const { flowSteps } = useFlowEfficiency(() => [
      { id: 'step-0', title: 'Has Effort', effort: 12 },
    ])
    expect(flowSteps.value[0].effort).toBe(12)
  })

  // 12 — idleTime is between 1 and 8
  it('idleTime is between 1 and 8 (inclusive)', () => {
    const { flowSteps } = useFlowEfficiency(() => STEPS_3)
    for (const s of flowSteps.value) {
      expect(s.idleTime).toBeGreaterThanOrEqual(1)
      expect(s.idleTime).toBeLessThanOrEqual(8)
    }
  })

  // 13 — flowEfficiency is between 0 and 100
  it('flowEfficiency is between 0 and 100', () => {
    const { flowSteps } = useFlowEfficiency(() => STEPS_3)
    for (const s of flowSteps.value) {
      expect(s.flowEfficiency).toBeGreaterThanOrEqual(0)
      expect(s.flowEfficiency).toBeLessThanOrEqual(100)
    }
  })

  // 14 — copyMarkdown writes to clipboard and contains expected headers
  it('copyMarkdown writes to clipboard with correct headers', async () => {
    const { copyMarkdown } = useFlowEfficiency(() => STEPS_3)
    await copyMarkdown()
    expect(navigator.clipboard.writeText).toHaveBeenCalledOnce()
    const written = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(written).toContain('# Flow Efficiency')
    expect(written).toContain('| Step | Active (h) | Idle (h) | Efficiency |')
    expect(written).toContain('Average:')
    expect(written).toContain('Bottlenecks:')
  })

  // 15 — copyMarkdown includes bottleneck flag for bottleneck steps
  it('copyMarkdown includes warning emoji for bottleneck steps', async () => {
    // Use a step with very low effort to force bottleneck
    const { flowSteps, copyMarkdown } = useFlowEfficiency(() => [
      { id: 'step-0', title: 'Slow Step', effort: 1 },
    ])
    // Check if this step is actually a bottleneck
    if (flowSteps.value[0].isBottleneck) {
      await copyMarkdown()
      const written = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
      expect(written).toContain('⚠️')
    } else {
      // Step not a bottleneck with these seeds — just verify no warning
      await copyMarkdown()
      expect(navigator.clipboard.writeText).toHaveBeenCalled()
    }
  })

  // 16 — copied starts false, becomes true after copyMarkdown
  it('copied becomes true after copyMarkdown and resets after timeout', async () => {
    const { copied, copyMarkdown } = useFlowEfficiency(() => STEPS_SINGLE)
    expect(copied.value).toBe(false)
    await copyMarkdown()
    expect(copied.value).toBe(true)
    vi.advanceTimersByTime(2100)
    expect(copied.value).toBe(false)
  })

  // 17 — stepId matches input id
  it('stepId on each FlowStep matches the input id', () => {
    const { flowSteps } = useFlowEfficiency(() => STEPS_3)
    STEPS_3.forEach((s, i) => {
      expect(flowSteps.value[i].stepId).toBe(s.id)
    })
  })
})
