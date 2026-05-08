// UNIT_TYPE=Composable
// Feature #91 — Tests for useStepDoD composable
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { useStepDoD } from '../useStepDoD'
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

describe('useStepDoD', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('initial: dodByStep is populated for each step', async () => {
    const steps = ref<EvoStep[]>([makeStep('Step A'), makeStep('Step B'), makeStep('Step C')])
    const { dodByStep } = useStepDoD(steps, '')
    await nextTick()
    expect(dodByStep.value['step-0']).toBeDefined()
    expect(dodByStep.value['step-1']).toBeDefined()
    expect(dodByStep.value['step-2']).toBeDefined()
  })

  test('each step starts with open=false', async () => {
    const steps = ref<EvoStep[]>([makeStep('Step A'), makeStep('Step B')])
    const { dodByStep } = useStepDoD(steps, '')
    await nextTick()
    expect(dodByStep.value['step-0'].open).toBe(false)
    expect(dodByStep.value['step-1'].open).toBe(false)
  })

  test('each step starts with items=[]', async () => {
    const steps = ref<EvoStep[]>([makeStep('Step A'), makeStep('Step B')])
    const { dodByStep } = useStepDoD(steps, '')
    await nextTick()
    expect(dodByStep.value['step-0'].items).toHaveLength(0)
    expect(dodByStep.value['step-1'].items).toHaveLength(0)
  })

  test('toggleDod opens the DoD section', async () => {
    const steps = ref<EvoStep[]>([makeStep('Step A')])
    const { dodByStep, toggleDod } = useStepDoD(steps, '')
    await nextTick()
    expect(dodByStep.value['step-0'].open).toBe(false)
    toggleDod('step-0')
    await nextTick()
    expect(dodByStep.value['step-0'].open).toBe(true)
  })

  test('toggleDod closes the DoD section when already open', async () => {
    const steps = ref<EvoStep[]>([makeStep('Step A')])
    const { dodByStep, toggleDod } = useStepDoD(steps, '')
    await nextTick()
    toggleDod('step-0')
    await nextTick()
    expect(dodByStep.value['step-0'].open).toBe(true)
    toggleDod('step-0')
    await nextTick()
    expect(dodByStep.value['step-0'].open).toBe(false)
  })

  test('generateDod mock: produces exactly 3 items', async () => {
    const steps = ref<EvoStep[]>([makeStep('Step A')])
    const { dodByStep, generateDod } = useStepDoD(steps, '')
    await nextTick()
    await generateDod('step-0')
    expect(dodByStep.value['step-0'].items).toHaveLength(3)
  })

  test('items have text and checked=false initially', async () => {
    const steps = ref<EvoStep[]>([makeStep('Step A')])
    const { dodByStep, generateDod } = useStepDoD(steps, '')
    await nextTick()
    await generateDod('step-0')
    for (const item of dodByStep.value['step-0'].items) {
      expect(typeof item.text).toBe('string')
      expect(item.text.length).toBeGreaterThan(0)
      expect(item.checked).toBe(false)
    }
  })

  test('toggleItem flips checked state', async () => {
    const steps = ref<EvoStep[]>([makeStep('Step A')])
    const { dodByStep, generateDod, toggleItem } = useStepDoD(steps, '')
    await nextTick()
    await generateDod('step-0')
    expect(dodByStep.value['step-0'].items[0].checked).toBe(false)
    toggleItem('step-0', 0)
    expect(dodByStep.value['step-0'].items[0].checked).toBe(true)
    toggleItem('step-0', 0)
    expect(dodByStep.value['step-0'].items[0].checked).toBe(false)
  })

  test('toggleItem for index=0 flips only item 0', async () => {
    const steps = ref<EvoStep[]>([makeStep('Step A')])
    const { dodByStep, generateDod, toggleItem } = useStepDoD(steps, '')
    await nextTick()
    await generateDod('step-0')
    toggleItem('step-0', 0)
    expect(dodByStep.value['step-0'].items[0].checked).toBe(true)
    expect(dodByStep.value['step-0'].items[1].checked).toBe(false)
    expect(dodByStep.value['step-0'].items[2].checked).toBe(false)
  })

  test('copyDod output starts with "### DoD:"', async () => {
    const steps = ref<EvoStep[]>([makeStep('My Step')])
    const { dodByStep, generateDod, copyDod } = useStepDoD(steps, '')
    await nextTick()
    await generateDod('step-0')
    copyDod('step-0')
    const writeText = vi.mocked(navigator.clipboard.writeText)
    expect(writeText).toHaveBeenCalledOnce()
    const arg = writeText.mock.calls[0][0]
    expect(arg).toMatch(/^### DoD:/)
  })

  test('copyDod uses "- [ ]" for unchecked and "- [x]" for checked', async () => {
    const steps = ref<EvoStep[]>([makeStep('My Step')])
    const { dodByStep, generateDod, toggleItem, copyDod } = useStepDoD(steps, '')
    await nextTick()
    await generateDod('step-0')
    // Check item 1 (index 1) only
    toggleItem('step-0', 1)
    copyDod('step-0')
    const writeText = vi.mocked(navigator.clipboard.writeText)
    const arg = writeText.mock.calls[0][0]
    const lines = arg.split('\n')
    // line 0 is the heading
    // line 1 is item 0 (unchecked)
    // line 2 is item 1 (checked)
    // line 3 is item 2 (unchecked)
    expect(lines[1]).toContain('- [ ]')
    expect(lines[2]).toContain('- [x]')
    expect(lines[3]).toContain('- [ ]')
  })

  test('copyDod includes the step title in heading', async () => {
    const steps = ref<EvoStep[]>([makeStep('My Awesome Step')])
    const { generateDod, copyDod } = useStepDoD(steps, '')
    await nextTick()
    await generateDod('step-0')
    copyDod('step-0')
    const writeText = vi.mocked(navigator.clipboard.writeText)
    const arg = writeText.mock.calls[0][0]
    expect(arg).toContain('My Awesome Step')
  })
})
