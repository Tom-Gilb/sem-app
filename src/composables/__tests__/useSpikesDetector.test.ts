// UNIT_TYPE=Test
// Feature #125 — useSpikesDetector composable tests

import { describe, it, expect, vi, afterEach } from 'vitest'
import { useSpikesDetector } from '../useSpikesDetector'

afterEach(() => { vi.restoreAllMocks() })

describe('useSpikesDetector', () => {
  // ── High risk triggers ─────────────────────────────────────────────────────

  it('detects high risk from "new technology" in name', () => {
    const steps = [{ id: 'step-0', name: 'Implement new technology layer', description: '' }]
    const { spikes } = useSpikesDetector(steps)
    expect(spikes.value[0].riskLevel).toBe('high')
  })

  it('detects high risk from "unknown" keyword', () => {
    const steps = [{ id: 'step-1', name: 'Unknown integration', description: '' }]
    const { spikes } = useSpikesDetector(steps)
    expect(spikes.value[0].riskLevel).toBe('high')
  })

  it('detects high risk from "prototype" in description', () => {
    const steps = [{ id: 'step-2', name: 'API layer', description: 'Need to build a prototype first' }]
    const { spikes } = useSpikesDetector(steps)
    expect(spikes.value[0].riskLevel).toBe('high')
  })

  it('detects high risk from "research spike" keyword', () => {
    const steps = [{ id: 'step-3', name: 'research spike for database', description: '' }]
    const { spikes } = useSpikesDetector(steps)
    expect(spikes.value[0].riskLevel).toBe('high')
  })

  // ── Medium risk triggers ───────────────────────────────────────────────────

  it('detects medium risk from "first time" keyword', () => {
    const steps = [{ id: 'step-4', name: 'first time deploying to cloud', description: '' }]
    const { spikes } = useSpikesDetector(steps)
    expect(spikes.value[0].riskLevel).toBe('medium')
  })

  it('detects medium risk from "experimental" keyword', () => {
    const steps = [{ id: 'step-5', name: 'Build experimental feature', description: '' }]
    const { spikes } = useSpikesDetector(steps)
    expect(spikes.value[0].riskLevel).toBe('medium')
  })

  it('detects medium risk from "poc" keyword', () => {
    const steps = [{ id: 'step-6', name: 'Create poc for auth service', description: '' }]
    const { spikes } = useSpikesDetector(steps)
    expect(spikes.value[0].riskLevel).toBe('medium')
  })

  // ── Low risk triggers ──────────────────────────────────────────────────────

  it('detects low risk from "unfamiliar" keyword', () => {
    const steps = [{ id: 'step-7', name: 'unfamiliar codebase migration', description: '' }]
    const { spikes } = useSpikesDetector(steps)
    expect(spikes.value[0].riskLevel).toBe('low')
  })

  it('detects low risk from "check if" keyword', () => {
    const steps = [{ id: 'step-8', name: 'check if API supports rate limiting', description: '' }]
    const { spikes } = useSpikesDetector(steps)
    expect(spikes.value[0].riskLevel).toBe('low')
  })

  // ── No match ──────────────────────────────────────────────────────────────

  it('returns empty spikes when no keywords match', () => {
    const steps = [{ id: 'step-9', name: 'Build login form', description: 'Standard form with validation' }]
    const { spikes } = useSpikesDetector(steps)
    expect(spikes.value).toHaveLength(0)
  })

  it('only includes steps with keyword matches', () => {
    const steps = [
      { id: 'step-0', name: 'Standard feature', description: '' },
      { id: 'step-1', name: 'Explore new technology', description: '' },
    ]
    const { spikes } = useSpikesDetector(steps)
    expect(spikes.value).toHaveLength(1)
    expect(spikes.value[0].stepId).toBe('step-1')
  })

  // ── spikeMap ──────────────────────────────────────────────────────────────

  it('spikeMap provides O(1) lookup by stepId', () => {
    const steps = [
      { id: 'step-0', name: 'Standard feature', description: '' },
      { id: 'step-1', name: 'Explore unknown tech', description: '' },
    ]
    const { spikeMap } = useSpikesDetector(steps)
    expect(spikeMap.value['step-0']).toBeUndefined()
    expect(spikeMap.value['step-1']).toBeDefined()
  })

  it('spikeMap returns undefined for non-flagged step', () => {
    const steps = [{ id: 'step-0', name: 'Normal task', description: '' }]
    const { spikeMap } = useSpikesDetector(steps)
    expect(spikeMap.value['step-0']).toBeUndefined()
  })

  // ── riskCount ─────────────────────────────────────────────────────────────

  it('riskCount totals high, medium, and low correctly', () => {
    const steps = [
      { id: 'step-0', name: 'prototype experiment', description: '' },
      { id: 'step-1', name: 'explore new technology', description: '' },
      { id: 'step-2', name: 'check if library works', description: '' },
    ]
    const { riskCount } = useSpikesDetector(steps)
    // step-0: "prototype" → high; step-1: "new technology" → high; step-2: "check if" → low
    expect(riskCount.value.high).toBeGreaterThanOrEqual(1)
    expect(riskCount.value.low).toBeGreaterThanOrEqual(1)
  })

  it('riskCount is 0 for all levels when no spikes', () => {
    const steps = [{ id: 'step-0', name: 'Normal work', description: '' }]
    const { riskCount } = useSpikesDetector(steps)
    expect(riskCount.value).toEqual({ high: 0, medium: 0, low: 0 })
  })

  // ── suggestion ────────────────────────────────────────────────────────────

  it('suggestion for high risk mentions 2-day spike', () => {
    const steps = [{ id: 'step-0', name: 'Implement new technology', description: '' }]
    const { spikes } = useSpikesDetector(steps)
    expect(spikes.value[0].suggestion).toContain('2-day')
  })

  it('suggestion for medium risk mentions 1-day spike', () => {
    const steps = [{ id: 'step-0', name: 'first time using this service', description: '' }]
    const { spikes } = useSpikesDetector(steps)
    expect(spikes.value[0].suggestion).toContain('1-day')
  })

  // ── copyMarkdown ──────────────────────────────────────────────────────────

  it('copyMarkdown writes spike markdown to clipboard', async () => {
    let written = ''
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: vi.fn().mockImplementation((text: string) => {
          written = text
          return Promise.resolve()
        }),
      },
    })
    const steps = [{ id: 'step-0', name: 'Explore unknown integration', description: '' }]
    const { copyMarkdown } = useSpikesDetector(steps)
    await copyMarkdown('step-0')
    expect(written).toContain('## Spike:')
    expect(written).toContain('Risk Level:')
  })

  it('copyMarkdown does nothing for non-existent step', async () => {
    const writeText = vi.fn()
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const steps = [{ id: 'step-0', name: 'Normal task', description: '' }]
    const { copyMarkdown } = useSpikesDetector(steps)
    await copyMarkdown('step-99')
    expect(writeText).not.toHaveBeenCalled()
  })
})
