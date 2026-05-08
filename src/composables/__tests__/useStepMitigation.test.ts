// UNIT_TYPE=Composable
// Feature #106 — Tests for useStepMitigation composable
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { useStepMitigation } from '../useStepMitigation'
import type { EvoStep } from '../../types/evo-plan'

// Mock fetch for live API tests (not used in mock mode)
vi.stubGlobal('fetch', vi.fn())

// Mock navigator.clipboard
vi.stubGlobal('navigator', {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
})

function makeStep(name: string, effortPercent = 20): EvoStep {
  return {
    name,
    description: `Description for ${name}`,
    linkedValues: ['V.Alpha'],
    linkedSolution: 'S.Test',
    effortPercent,
  }
}

describe('useStepMitigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('initial: mitigationByStep is populated for each step', async () => {
    const steps = ref<EvoStep[]>([makeStep('Step A'), makeStep('Step B'), makeStep('Step C')])
    const { mitigationByStep } = useStepMitigation(steps, '')
    await nextTick()
    expect(mitigationByStep.value['step-0']).toBeDefined()
    expect(mitigationByStep.value['step-1']).toBeDefined()
    expect(mitigationByStep.value['step-2']).toBeDefined()
  })

  test('each step starts with open=false', async () => {
    const steps = ref<EvoStep[]>([makeStep('Step A'), makeStep('Step B')])
    const { mitigationByStep } = useStepMitigation(steps, '')
    await nextTick()
    expect(mitigationByStep.value['step-0'].open).toBe(false)
    expect(mitigationByStep.value['step-1'].open).toBe(false)
  })

  test('each step starts with strategies=[]', async () => {
    const steps = ref<EvoStep[]>([makeStep('Step A'), makeStep('Step B')])
    const { mitigationByStep } = useStepMitigation(steps, '')
    await nextTick()
    expect(mitigationByStep.value['step-0'].strategies).toHaveLength(0)
    expect(mitigationByStep.value['step-1'].strategies).toHaveLength(0)
  })

  test('toggleMitigation opens the section', async () => {
    const steps = ref<EvoStep[]>([makeStep('Step A')])
    const { mitigationByStep, toggleMitigation } = useStepMitigation(steps, '')
    await nextTick()
    expect(mitigationByStep.value['step-0'].open).toBe(false)
    toggleMitigation('step-0')
    await nextTick()
    expect(mitigationByStep.value['step-0'].open).toBe(true)
  })

  test('generateMitigation mock: produces exactly 2 strategies', async () => {
    const steps = ref<EvoStep[]>([makeStep('Step A')])
    const { mitigationByStep, generateMitigation } = useStepMitigation(steps, '')
    await nextTick()
    await generateMitigation('step-0')
    expect(mitigationByStep.value['step-0'].strategies).toHaveLength(2)
  })

  test('strategies[0].type is "preventive"', async () => {
    const steps = ref<EvoStep[]>([makeStep('Step A')])
    const { mitigationByStep, generateMitigation } = useStepMitigation(steps, '')
    await nextTick()
    await generateMitigation('step-0')
    expect(mitigationByStep.value['step-0'].strategies[0].type).toBe('preventive')
  })

  test('strategies[1].type is "contingent"', async () => {
    const steps = ref<EvoStep[]>([makeStep('Step A')])
    const { mitigationByStep, generateMitigation } = useStepMitigation(steps, '')
    await nextTick()
    await generateMitigation('step-0')
    expect(mitigationByStep.value['step-0'].strategies[1].type).toBe('contingent')
  })

  test('both strategies have non-empty text', async () => {
    const steps = ref<EvoStep[]>([makeStep('Step A')])
    const { mitigationByStep, generateMitigation } = useStepMitigation(steps, '')
    await nextTick()
    await generateMitigation('step-0')
    for (const strategy of mitigationByStep.value['step-0'].strategies) {
      expect(typeof strategy.text).toBe('string')
      expect(strategy.text.length).toBeGreaterThan(0)
    }
  })

  test('loading is false after mock completes', async () => {
    const steps = ref<EvoStep[]>([makeStep('Step A')])
    const { mitigationByStep, generateMitigation } = useStepMitigation(steps, '')
    await nextTick()
    await generateMitigation('step-0')
    expect(mitigationByStep.value['step-0'].loading).toBe(false)
  })

  test('copyMitigation output starts with "### Risk Mitigation:"', async () => {
    const steps = ref<EvoStep[]>([makeStep('My Step')])
    const { generateMitigation, copyMitigation } = useStepMitigation(steps, '')
    await nextTick()
    await generateMitigation('step-0')
    copyMitigation('step-0')
    const writeText = vi.mocked(navigator.clipboard.writeText)
    expect(writeText).toHaveBeenCalledOnce()
    const arg = writeText.mock.calls[0][0]
    expect(arg).toMatch(/^### Risk Mitigation:/)
  })

  test('copyMitigation includes "Preventive:" and "Contingent:"', async () => {
    const steps = ref<EvoStep[]>([makeStep('My Step')])
    const { generateMitigation, copyMitigation } = useStepMitigation(steps, '')
    await nextTick()
    await generateMitigation('step-0')
    copyMitigation('step-0')
    const writeText = vi.mocked(navigator.clipboard.writeText)
    const arg = writeText.mock.calls[0][0]
    expect(arg).toContain('**Preventive:**')
    expect(arg).toContain('**Contingent:**')
  })

  test('multiple steps: strategies are independent (no cross-contamination)', async () => {
    const steps = ref<EvoStep[]>([makeStep('Architecture Design'), makeStep('QA Testing')])
    const { mitigationByStep, generateMitigation } = useStepMitigation(steps, '')
    await nextTick()
    await generateMitigation('step-0')
    await generateMitigation('step-1')

    const strategies0 = mitigationByStep.value['step-0'].strategies
    const strategies1 = mitigationByStep.value['step-1'].strategies

    // Both should be populated
    expect(strategies0.length).toBeGreaterThan(0)
    expect(strategies1.length).toBeGreaterThan(0)

    // The text content should differ (keyword-based mock gives different results)
    const text0 = strategies0.map(s => s.text).join('|')
    const text1 = strategies1.map(s => s.text).join('|')
    expect(text0).not.toBe(text1)
  })

  test('toggleMitigation second call closes the section', async () => {
    const steps = ref<EvoStep[]>([makeStep('Step A')])
    const { mitigationByStep, toggleMitigation } = useStepMitigation(steps, '')
    await nextTick()

    toggleMitigation('step-0')
    await nextTick()
    expect(mitigationByStep.value['step-0'].open).toBe(true)

    toggleMitigation('step-0')
    await nextTick()
    expect(mitigationByStep.value['step-0'].open).toBe(false)
  })

  test('keyword "deploy" produces deployment-specific strategies', async () => {
    const steps = ref<EvoStep[]>([makeStep('Deploy Release Pipeline')])
    const { mitigationByStep, generateMitigation } = useStepMitigation(steps, '')
    await nextTick()
    await generateMitigation('step-0')
    const strategies = mitigationByStep.value['step-0'].strategies
    const allText = strategies.map(s => s.text).join(' ').toLowerCase()
    // deployment-specific strategies should mention deployment/rollback
    expect(allText).toMatch(/deploy|rollback|staging/)
  })
})
