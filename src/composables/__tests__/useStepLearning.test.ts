// UNIT_TYPE=Composable
// Feature #95 — Tests for useStepLearning composable
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { useStepLearning } from '../useStepLearning'
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

describe('useStepLearning', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('initial: learningByStep is populated for each step', async () => {
    const steps = ref<EvoStep[]>([makeStep('Step A'), makeStep('Step B'), makeStep('Step C')])
    const { learningByStep } = useStepLearning(steps, '')
    await nextTick()
    expect(learningByStep.value['step-0']).toBeDefined()
    expect(learningByStep.value['step-1']).toBeDefined()
    expect(learningByStep.value['step-2']).toBeDefined()
  })

  test('each step starts with open=false', async () => {
    const steps = ref<EvoStep[]>([makeStep('Step A'), makeStep('Step B')])
    const { learningByStep } = useStepLearning(steps, '')
    await nextTick()
    expect(learningByStep.value['step-0'].open).toBe(false)
    expect(learningByStep.value['step-1'].open).toBe(false)
  })

  test('each step starts with outcomes=[]', async () => {
    const steps = ref<EvoStep[]>([makeStep('Step A'), makeStep('Step B')])
    const { learningByStep } = useStepLearning(steps, '')
    await nextTick()
    expect(learningByStep.value['step-0'].outcomes).toHaveLength(0)
    expect(learningByStep.value['step-1'].outcomes).toHaveLength(0)
  })

  test('toggleLearning opens the section', async () => {
    const steps = ref<EvoStep[]>([makeStep('Step A')])
    const { learningByStep, toggleLearning } = useStepLearning(steps, '')
    await nextTick()
    expect(learningByStep.value['step-0'].open).toBe(false)
    toggleLearning('step-0')
    await nextTick()
    expect(learningByStep.value['step-0'].open).toBe(true)
  })

  test('generateLearning mock: produces exactly 3 outcomes', async () => {
    const steps = ref<EvoStep[]>([makeStep('Step A')])
    const { learningByStep, generateLearning } = useStepLearning(steps, '')
    await nextTick()
    await generateLearning('step-0')
    expect(learningByStep.value['step-0'].outcomes).toHaveLength(3)
  })

  test('outcomes have text (non-empty strings)', async () => {
    const steps = ref<EvoStep[]>([makeStep('Step A')])
    const { learningByStep, generateLearning } = useStepLearning(steps, '')
    await nextTick()
    await generateLearning('step-0')
    for (const outcome of learningByStep.value['step-0'].outcomes) {
      expect(typeof outcome.text).toBe('string')
      expect(outcome.text.length).toBeGreaterThan(0)
    }
  })

  test('loading flag is false after mock completes', async () => {
    const steps = ref<EvoStep[]>([makeStep('Step A')])
    const { learningByStep, generateLearning } = useStepLearning(steps, '')
    await nextTick()
    await generateLearning('step-0')
    expect(learningByStep.value['step-0'].loading).toBe(false)
  })

  test('copyLearning output starts with "### Learning Outcomes:"', async () => {
    const steps = ref<EvoStep[]>([makeStep('My Step')])
    const { generateLearning, copyLearning } = useStepLearning(steps, '')
    await nextTick()
    await generateLearning('step-0')
    copyLearning('step-0')
    const writeText = vi.mocked(navigator.clipboard.writeText)
    expect(writeText).toHaveBeenCalledOnce()
    const arg = writeText.mock.calls[0][0]
    expect(arg).toMatch(/^### Learning Outcomes:/)
  })

  test('outcomes for different steps are independent (no cross-contamination)', async () => {
    const steps = ref<EvoStep[]>([makeStep('API Backend'), makeStep('UI Component')])
    const { learningByStep, generateLearning } = useStepLearning(steps, '')
    await nextTick()
    await generateLearning('step-0')
    await generateLearning('step-1')

    const outcomes0 = learningByStep.value['step-0'].outcomes
    const outcomes1 = learningByStep.value['step-1'].outcomes

    // Both should be populated
    expect(outcomes0.length).toBeGreaterThan(0)
    expect(outcomes1.length).toBeGreaterThan(0)

    // The text content should differ (keyword-based mock gives different results)
    const text0 = outcomes0.map(o => o.text).join('|')
    const text1 = outcomes1.map(o => o.text).join('|')
    expect(text0).not.toBe(text1)
  })

  test('multiple toggleLearning calls: does not regenerate if outcomes already present', async () => {
    const steps = ref<EvoStep[]>([makeStep('Step A')])
    const { learningByStep, toggleLearning } = useStepLearning(steps, '')
    await nextTick()

    // First toggle: opens and generates
    toggleLearning('step-0')
    await nextTick()
    // Wait for async generate to complete
    await new Promise(resolve => setTimeout(resolve, 10))

    const firstOutcomes = [...learningByStep.value['step-0'].outcomes]
    expect(firstOutcomes.length).toBeGreaterThan(0)

    // Second toggle: closes
    toggleLearning('step-0')
    await nextTick()
    expect(learningByStep.value['step-0'].open).toBe(false)

    // Third toggle: re-opens but should NOT regenerate (outcomes already exist)
    toggleLearning('step-0')
    await nextTick()
    expect(learningByStep.value['step-0'].open).toBe(true)
    // Outcomes should be unchanged (same references)
    expect(learningByStep.value['step-0'].outcomes).toHaveLength(firstOutcomes.length)
    expect(learningByStep.value['step-0'].outcomes[0].text).toBe(firstOutcomes[0].text)
  })

  test('copyLearning includes the step title in the heading', async () => {
    const steps = ref<EvoStep[]>([makeStep('My Awesome Step')])
    const { generateLearning, copyLearning } = useStepLearning(steps, '')
    await nextTick()
    await generateLearning('step-0')
    copyLearning('step-0')
    const writeText = vi.mocked(navigator.clipboard.writeText)
    const arg = writeText.mock.calls[0][0]
    expect(arg).toContain('My Awesome Step')
  })

  test('copyLearning formats outcomes as markdown list items', async () => {
    const steps = ref<EvoStep[]>([makeStep('My Step')])
    const { generateLearning, copyLearning } = useStepLearning(steps, '')
    await nextTick()
    await generateLearning('step-0')
    copyLearning('step-0')
    const writeText = vi.mocked(navigator.clipboard.writeText)
    const arg = writeText.mock.calls[0][0]
    const lines = arg.split('\n').slice(1) // skip heading
    for (const line of lines) {
      expect(line).toMatch(/^- /)
    }
  })
})
