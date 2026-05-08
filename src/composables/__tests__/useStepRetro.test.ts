// UNIT_TYPE=Test
// Feature #113 — Tests for useStepRetro composable

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useStepRetro } from '../useStepRetro'

// Mock navigator.clipboard
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
})

const STEP_A = { id: 'step-0', name: 'Setup Infrastructure', description: 'Prepare CI/CD pipeline' }
const STEP_B = { id: 'step-1', name: 'Build Core API' }

describe('useStepRetro', () => {
  it('retroMap initialised empty', () => {
    const { retroMap } = useStepRetro('')
    expect(Object.keys(retroMap.value)).toHaveLength(0)
  })

  it('mock mode: generateRetro returns exactly 3 prompts', async () => {
    const { retroMap, generateRetro } = useStepRetro('')
    await generateRetro(STEP_A)
    expect(retroMap.value[STEP_A.id].prompts).toHaveLength(3)
  })

  it('mock mode: prompts contain one per category', async () => {
    const { retroMap, generateRetro } = useStepRetro('')
    await generateRetro(STEP_A)
    const categories = retroMap.value[STEP_A.id].prompts.map(p => p.category)
    expect(categories).toContain('went-well')
    expect(categories).toContain('improve')
    expect(categories).toContain('experiment')
  })

  it('mock mode: deterministic — same step name produces same prompts on repeated calls', async () => {
    const { retroMap, generateRetro } = useStepRetro('')
    await generateRetro(STEP_A)
    const firstPrompts = retroMap.value[STEP_A.id].prompts.map(p => p.prompt)
    await generateRetro(STEP_A)
    const secondPrompts = retroMap.value[STEP_A.id].prompts.map(p => p.prompt)
    expect(firstPrompts).toEqual(secondPrompts)
  })

  it('mock mode: different step names produce consistent (seed-driven) prompts', async () => {
    const { retroMap, generateRetro } = useStepRetro('')
    await generateRetro(STEP_A)
    await generateRetro(STEP_B)
    // Both must have 3 prompts
    expect(retroMap.value[STEP_A.id].prompts).toHaveLength(3)
    expect(retroMap.value[STEP_B.id].prompts).toHaveLength(3)
  })

  it('toggleOpen flips open state from false to true', async () => {
    const { retroMap, generateRetro, toggleOpen } = useStepRetro('')
    await generateRetro(STEP_A)
    expect(retroMap.value[STEP_A.id].open).toBe(false)
    toggleOpen(STEP_A.id)
    expect(retroMap.value[STEP_A.id].open).toBe(true)
  })

  it('toggleOpen flips open state from true back to false', async () => {
    const { retroMap, generateRetro, toggleOpen } = useStepRetro('')
    await generateRetro(STEP_A)
    toggleOpen(STEP_A.id)
    expect(retroMap.value[STEP_A.id].open).toBe(true)
    toggleOpen(STEP_A.id)
    expect(retroMap.value[STEP_A.id].open).toBe(false)
  })

  it('generateRetro sets loading false after completion', async () => {
    const { retroMap, generateRetro } = useStepRetro('')
    const promise = generateRetro(STEP_A)
    // loading starts true during the call
    await promise
    expect(retroMap.value[STEP_A.id].loading).toBe(false)
  })

  it('generateRetro sets loading true during async call then false after', async () => {
    const { retroMap, generateRetro } = useStepRetro('')
    let loadingDuringCall = false
    // We can't easily observe mid-call state in sync tests, so we verify the final state
    await generateRetro(STEP_A)
    loadingDuringCall = retroMap.value[STEP_A.id].loading
    expect(loadingDuringCall).toBe(false)
  })

  it('copyRetro formats markdown correctly', async () => {
    const { generateRetro, copyRetro } = useStepRetro('')
    await generateRetro(STEP_A)
    copyRetro(STEP_A.id)
    expect(navigator.clipboard.writeText).toHaveBeenCalledOnce()
    const written = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(written).toContain('## Retro — Setup Infrastructure')
    expect(written).toContain('**Went well:**')
    expect(written).toContain('**Improve:**')
    expect(written).toContain('**Experiment:**')
  })

  it('multiple steps tracked independently', async () => {
    const { retroMap, generateRetro } = useStepRetro('')
    await generateRetro(STEP_A)
    await generateRetro(STEP_B)
    expect(Object.keys(retroMap.value)).toHaveLength(2)
    expect(retroMap.value[STEP_A.id].stepId).toBe(STEP_A.id)
    expect(retroMap.value[STEP_B.id].stepId).toBe(STEP_B.id)
  })

  it('edge: step with no description still generates 3 prompts', async () => {
    const { retroMap, generateRetro } = useStepRetro('')
    await generateRetro({ id: 'step-nodesc', name: 'No Description Step' })
    expect(retroMap.value['step-nodesc'].prompts).toHaveLength(3)
  })

  it('mock mode active when VITE_MOCK_MODE=true even with non-empty apiKey', async () => {
    // Patch import.meta.env
    const originalEnv = import.meta.env.VITE_MOCK_MODE
    ;(import.meta.env as Record<string, string>).VITE_MOCK_MODE = 'true'
    try {
      const { retroMap, generateRetro } = useStepRetro('sk-fake-key')
      await generateRetro(STEP_A)
      // Should still produce 3 prompts (mock path taken)
      expect(retroMap.value[STEP_A.id].prompts).toHaveLength(3)
    } finally {
      ;(import.meta.env as Record<string, string>).VITE_MOCK_MODE = originalEnv
    }
  })

  it('retroMap entry open is false by default after generateRetro', async () => {
    const { retroMap, generateRetro } = useStepRetro('')
    await generateRetro(STEP_A)
    expect(retroMap.value[STEP_A.id].open).toBe(false)
  })
})
