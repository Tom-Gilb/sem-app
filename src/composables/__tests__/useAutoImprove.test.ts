// UNIT_TYPE=Test
// Feature #88 — useAutoImprove composable tests

import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { useAutoImprove } from '../useAutoImprove'
import type { SpecBlock, VEntry, FEntry, SEntry } from '../../types/spec'

vi.stubEnv('VITE_MOCK_MODE', 'true')

function makeVEntry(overrides: Partial<VEntry> = {}): VEntry {
  return {
    id: 'V.Test',
    type: 'Value',
    level: 'Product',
    description: 'A test value',
    scale: 'score out of 100',
    meter: 'Automated test',
    status: 'Status [now] 50',
    tolerable: 'Tolerable [2026] 60',
    goal: 'Goal [2026] 80',
    valueOfFunction: '',
    ...overrides,
  }
}

function makeSpec(overrides: Partial<SpecBlock> = {}): SpecBlock {
  const f: FEntry = {
    id: 'F.Test',
    type: 'Function',
    level: 'Product',
    description: 'Test function',
    successCriteria: '',
    functionOfValue: '',
  }
  const s: SEntry = {
    id: 'S.Test',
    type: 'Solution',
    level: 'Product',
    description: 'Test solution',
    impact: '',
    function: '',
  }
  return { functions: [f], values: [makeVEntry()], solutions: [s], ...overrides }
}

describe('useAutoImprove', () => {
  it('initial state: steps is empty', () => {
    const spec = ref<SpecBlock | null>(null)
    const { steps } = useAutoImprove(spec, '')
    expect(steps.value).toHaveLength(0)
  })

  it('initial state: showDiff is false', () => {
    const spec = ref<SpecBlock | null>(null)
    const { showDiff } = useAutoImprove(spec, '')
    expect(showDiff.value).toBe(false)
  })

  it('initial state: improving is false', () => {
    const spec = ref<SpecBlock | null>(null)
    const { improving } = useAutoImprove(spec, '')
    expect(improving.value).toBe(false)
  })

  it('runAutoImprove mock mode produces 3 steps', async () => {
    const spec = ref<SpecBlock | null>(makeSpec())
    const { steps, runAutoImprove } = useAutoImprove(spec, '')
    await runAutoImprove()
    expect(steps.value).toHaveLength(3)
  }, 5000)

  it('all 3 sources present: Accessibility, PeerReview, Gaps', async () => {
    const spec = ref<SpecBlock | null>(makeSpec())
    const { steps, runAutoImprove } = useAutoImprove(spec, '')
    await runAutoImprove()
    const sources = steps.value.map(s => s.source)
    expect(sources).toContain('Accessibility')
    expect(sources).toContain('PeerReview')
    expect(sources).toContain('Gaps')
  }, 5000)

  it('all steps have applied=true after completion', async () => {
    const spec = ref<SpecBlock | null>(makeSpec())
    const { steps, runAutoImprove } = useAutoImprove(spec, '')
    await runAutoImprove()
    for (const step of steps.value) {
      expect(step.applied).toBe(true)
    }
  }, 5000)

  it('improvedSpec is non-null after completion', async () => {
    const spec = ref<SpecBlock | null>(makeSpec())
    const { improvedSpec, runAutoImprove } = useAutoImprove(spec, '')
    await runAutoImprove()
    expect(improvedSpec.value).not.toBeNull()
    expect(typeof improvedSpec.value).toBe('string')
  }, 5000)

  it('improving is false after completion', async () => {
    const spec = ref<SpecBlock | null>(makeSpec())
    const { improving, runAutoImprove } = useAutoImprove(spec, '')
    await runAutoImprove()
    expect(improving.value).toBe(false)
  }, 5000)

  it('showDiff is true after completion', async () => {
    const spec = ref<SpecBlock | null>(makeSpec())
    const { showDiff, runAutoImprove } = useAutoImprove(spec, '')
    await runAutoImprove()
    expect(showDiff.value).toBe(true)
  }, 5000)

  it('copyImprovedSpec does not throw when improvedSpec is set', async () => {
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined)
    const spec = ref<SpecBlock | null>(makeSpec())
    const { runAutoImprove, copyImprovedSpec } = useAutoImprove(spec, '')
    await runAutoImprove()
    expect(() => copyImprovedSpec()).not.toThrow()
  }, 5000)
})
