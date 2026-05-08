// UNIT_TYPE=Test
// Feature #125 — Tests for useStepSpike composable

import { describe, it, expect } from 'vitest'
import { useStepSpike } from '../useStepSpike'

describe('useStepSpike', () => {
  // ── New tech keyword flagging ──────────────────────────────────────────────

  it('flags a step with a new tech keyword in name', () => {
    const { spikeMap, analyseStep } = useStepSpike()
    analyseStep({ id: 'step-0', name: 'Explore new database engine', description: '' })
    expect(spikeMap.value['step-0'].flagged).toBe(true)
  })

  it('flags a step with "prototype" keyword in description', () => {
    const { spikeMap, analyseStep } = useStepSpike()
    analyseStep({ id: 'step-1', name: 'Integration layer', description: 'Need to prototype a solution' })
    expect(spikeMap.value['step-1'].flagged).toBe(true)
  })

  it('flags step with "poc" keyword as new tech', () => {
    const { spikeMap, analyseStep } = useStepSpike()
    analyseStep({ id: 'step-2', name: 'Build a poc for auth flow', description: '' })
    const flags = spikeMap.value['step-2'].flags
    expect(flags.some(f => f.reason.includes('new tech'))).toBe(true)
  })

  // ── Unclear AC flagging ────────────────────────────────────────────────────

  it('flags a step with "tbd" keyword', () => {
    const { spikeMap, analyseStep } = useStepSpike()
    analyseStep({ id: 'step-3', name: 'Reporting module', description: 'Scope tbd' })
    expect(spikeMap.value['step-3'].flagged).toBe(true)
  })

  it('flags a step with "unclear" in description', () => {
    const { spikeMap, analyseStep } = useStepSpike()
    analyseStep({ id: 'step-4', name: 'Payment service', description: 'Requirements are unclear at this stage' })
    const flags = spikeMap.value['step-4'].flags
    expect(flags.some(f => f.reason.includes('unclear AC'))).toBe(true)
  })

  it('flags a step with "assumption" keyword', () => {
    const { spikeMap, analyseStep } = useStepSpike()
    analyseStep({ id: 'step-5', name: 'Data migration', description: 'Based on assumption about schema' })
    expect(spikeMap.value['step-5'].flagged).toBe(true)
  })

  // ── No prior experience flagging ───────────────────────────────────────────

  it('flags a step with "first time" in description', () => {
    const { spikeMap, analyseStep } = useStepSpike()
    analyseStep({ id: 'step-6', name: 'ML pipeline', description: 'This is first time we do this' })
    const flags = spikeMap.value['step-6'].flags
    expect(flags.some(f => f.reason.includes('new pattern'))).toBe(true)
  })

  it('flags a step with "untested" keyword', () => {
    const { spikeMap, analyseStep } = useStepSpike()
    analyseStep({ id: 'step-7', name: 'New streaming approach', description: 'Using untested library' })
    expect(spikeMap.value['step-7'].flagged).toBe(true)
  })

  // ── Severity: high (≥2 new tech matches) ──────────────────────────────────

  it('assigns high severity when new tech keywords ≥2', () => {
    const { spikeMap, analyseStep } = useStepSpike()
    analyseStep({ id: 'step-8', name: 'Research and prototype novel approach', description: '' })
    // "research", "prototype", "novel" all match new tech keywords → ≥2 → high
    const flags = spikeMap.value['step-8'].flags
    const newTechFlag = flags.find(f => f.reason.includes('new tech'))
    expect(newTechFlag?.severity).toBe('high')
    expect(newTechFlag?.suggestedDuration).toBe('2 days')
  })

  // ── Severity: medium (1 new tech match) ───────────────────────────────────

  it('assigns medium severity when exactly 1 new tech keyword', () => {
    const { spikeMap, analyseStep } = useStepSpike()
    analyseStep({ id: 'step-9', name: 'Evaluate caching strategy', description: '' })
    const flags = spikeMap.value['step-9'].flags
    const newTechFlag = flags.find(f => f.reason.includes('new tech'))
    expect(newTechFlag?.severity).toBe('medium')
    expect(newTechFlag?.suggestedDuration).toBe('1 day')
  })

  // ── Unflagged step ─────────────────────────────────────────────────────────

  it('does not flag a normal step with no risk keywords', () => {
    const { spikeMap, analyseStep } = useStepSpike()
    analyseStep({ id: 'step-10', name: 'Add user profile page', description: 'Display user data in a card layout' })
    expect(spikeMap.value['step-10'].flagged).toBe(false)
    expect(spikeMap.value['step-10'].flags).toHaveLength(0)
  })

  // ── Multiple flags from different banks ────────────────────────────────────

  it('generates multiple flags from different keyword banks', () => {
    const { spikeMap, analyseStep } = useStepSpike()
    analyseStep({
      id: 'step-11',
      name: 'Research novel payment gateway',
      description: 'requirements are unclear, first time integrating this vendor',
    })
    // "research", "novel" → new tech; "unclear" → unclear AC; "first time" → no prior
    const flags = spikeMap.value['step-11'].flags
    expect(flags.length).toBeGreaterThanOrEqual(2)
    const bankNames = flags.map(f => {
      if (f.reason.includes('new tech')) return 'new-tech'
      if (f.reason.includes('unclear AC')) return 'unclear-ac'
      if (f.reason.includes('new pattern')) return 'no-prior'
      return 'other'
    })
    expect(bankNames).toContain('new-tech')
    expect(bankNames).toContain('unclear-ac')
  })

  // ── suggestedDuration per severity ────────────────────────────────────────

  it('suggestedDuration is "1 day" for unclear AC flags', () => {
    const { spikeMap, analyseStep } = useStepSpike()
    analyseStep({ id: 'step-12', name: 'Feature X', description: 'scope is tbd and pending decision' })
    const flags = spikeMap.value['step-12'].flags
    const acFlag = flags.find(f => f.reason.includes('unclear AC'))
    expect(acFlag?.suggestedDuration).toBe('1 day')
  })

  it('suggestedDuration is "1 day" for no-prior flags', () => {
    const { spikeMap, analyseStep } = useStepSpike()
    analyseStep({ id: 'step-13', name: 'Deploy to K8s', description: 'untested approach, new pattern for us' })
    const flags = spikeMap.value['step-13'].flags
    const nopriorFlag = flags.find(f => f.reason.includes('new pattern'))
    expect(nopriorFlag?.suggestedDuration).toBe('1 day')
  })

  // ── spikeTask text ─────────────────────────────────────────────────────────

  it('spikeTask contains step name and duration', () => {
    const { spikeMap, analyseStep } = useStepSpike()
    analyseStep({ id: 'step-14', name: 'Investigate auth flow', description: '' })
    const flags = spikeMap.value['step-14'].flags
    expect(flags.length).toBeGreaterThan(0)
    const task = flags[0].spikeTask
    expect(task).toContain('Investigate auth flow')
    expect(task).toContain(flags[0].suggestedDuration)
  })

  // ── toggleOpen ─────────────────────────────────────────────────────────────

  it('toggleOpen flips the open state', () => {
    const { spikeMap, analyseStep, toggleOpen } = useStepSpike()
    analyseStep({ id: 'step-15', name: 'Explore new approach', description: '' })
    expect(spikeMap.value['step-15'].open).toBe(false)
    toggleOpen('step-15')
    expect(spikeMap.value['step-15'].open).toBe(true)
    toggleOpen('step-15')
    expect(spikeMap.value['step-15'].open).toBe(false)
  })

  it('toggleOpen on unknown stepId does not throw', () => {
    const { toggleOpen } = useStepSpike()
    expect(() => toggleOpen('nonexistent')).not.toThrow()
  })

  // ── copySpike ──────────────────────────────────────────────────────────────

  it('copySpike does not throw for a flagged step', () => {
    const { analyseStep, copySpike } = useStepSpike()
    analyseStep({ id: 'step-16', name: 'Research caching options', description: 'evaluate new libraries' })
    expect(() => copySpike('step-16')).not.toThrow()
  })

  it('copySpike does not throw for an unflagged step', () => {
    const { analyseStep, copySpike } = useStepSpike()
    analyseStep({ id: 'step-17', name: 'Fix typo in footer', description: '' })
    expect(() => copySpike('step-17')).not.toThrow()
  })

  // ── totalFlaggedCount ──────────────────────────────────────────────────────

  it('totalFlaggedCount returns 0 when no steps analysed', () => {
    const { totalFlaggedCount } = useStepSpike()
    expect(totalFlaggedCount.value).toBe(0)
  })

  it('totalFlaggedCount reflects only flagged steps', () => {
    const { analyseStep, totalFlaggedCount } = useStepSpike()
    analyseStep({ id: 'step-18', name: 'Add login page', description: '' })       // not flagged
    analyseStep({ id: 'step-19', name: 'Prototype new auth flow', description: '' }) // flagged
    analyseStep({ id: 'step-20', name: 'Investigate unknown API', description: '' }) // flagged
    expect(totalFlaggedCount.value).toBe(2)
  })
})
