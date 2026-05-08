// UNIT_TYPE=Test
// Feature #92 — useAntiPatterns composable tests

import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { useAntiPatterns } from '../useAntiPatterns'
import type { SpecBlock, FEntry, VEntry, SEntry } from '../../types/spec'

function makeF(overrides: Partial<FEntry> = {}): FEntry {
  return {
    id: '3P.F.CheckerTool',
    type: 'Function',
    level: 'Product',
    description: 'The system provides a spec entry interface.',
    successCriteria: '',
    functionOfValue: '',
    ...overrides,
  }
}

function makeV(overrides: Partial<VEntry> = {}): VEntry {
  return {
    id: '3P.V.EntryFluency',
    type: 'Value',
    level: 'Product',
    description: 'Measures user entry speed at 30 seconds per entry.',
    scale: 'seconds per entry',
    meter: 'Automated timer',
    status: 'Status [now] 60',
    tolerable: 'Tolerable [2026] 45',
    goal: 'Goal [2026] 30 seconds',
    valueOfFunction: '',
    ...overrides,
  }
}

function makeS(overrides: Partial<SEntry> = {}): SEntry {
  return {
    id: '3P.S.MarkdownSerialiser',
    type: 'Solution',
    level: 'Product',
    description: 'A markdown serialiser outputs structured text.',
    impact: '',
    function: '',
    ...overrides,
  }
}

function makeSpec(overrides: Partial<SpecBlock> = {}): SpecBlock {
  return {
    functions: [makeF()],
    values: [makeV()],
    solutions: [makeS()],
    ...overrides,
  }
}

describe('useAntiPatterns', () => {
  it('initial: violations is empty', () => {
    const spec = ref<SpecBlock | null>(null)
    const { violations } = useAntiPatterns(spec)
    expect(violations.value).toHaveLength(0)
  })

  it('initial: antiPatternsOpen is false', () => {
    const spec = ref<SpecBlock | null>(null)
    const { antiPatternsOpen } = useAntiPatterns(spec)
    expect(antiPatternsOpen.value).toBe(false)
  })

  it('scanAntiPatterns with null spec produces no violations', () => {
    const spec = ref<SpecBlock | null>(null)
    const { violations, scanAntiPatterns } = useAntiPatterns(spec)
    scanAntiPatterns()
    expect(violations.value).toHaveLength(0)
  })

  it('AP1 fires for V. entry with scale "100" (no units)', () => {
    const spec = ref<SpecBlock | null>(makeSpec({
      functions: [],
      solutions: [],
      values: [makeV({ scale: '100' })],
    }))
    const { violations, scanAntiPatterns } = useAntiPatterns(spec)
    scanAntiPatterns()
    const ap1 = violations.value.filter(v => v.patternId === 'AP1')
    expect(ap1.length).toBeGreaterThan(0)
  })

  it('AP1 does NOT fire for V. entry with scale "100%"', () => {
    const spec = ref<SpecBlock | null>(makeSpec({
      functions: [],
      solutions: [],
      values: [makeV({ scale: '100%' })],
    }))
    const { violations, scanAntiPatterns } = useAntiPatterns(spec)
    scanAntiPatterns()
    const ap1 = violations.value.filter(v => v.patternId === 'AP1')
    expect(ap1).toHaveLength(0)
  })

  it('AP2 fires for description "The system will be improved by the team"', () => {
    const spec = ref<SpecBlock | null>(makeSpec({
      values: [],
      solutions: [],
      functions: [makeF({ description: 'The system will be improved by the team' })],
    }))
    const { violations, scanAntiPatterns } = useAntiPatterns(spec)
    scanAntiPatterns()
    const ap2 = violations.value.filter(v => v.patternId === 'AP2')
    expect(ap2.length).toBeGreaterThan(0)
  })

  it('AP3 fires for description with more than 100 words', () => {
    const longDesc = Array.from({ length: 110 }, (_, i) => `word${i}`).join(' ')
    const spec = ref<SpecBlock | null>(makeSpec({
      values: [],
      solutions: [],
      functions: [makeF({ description: longDesc })],
    }))
    const { violations, scanAntiPatterns } = useAntiPatterns(spec)
    scanAntiPatterns()
    const ap3 = violations.value.filter(v => v.patternId === 'AP3')
    expect(ap3.length).toBeGreaterThan(0)
  })

  it('AP4 fires for goal "50%" (bare percentage)', () => {
    const spec = ref<SpecBlock | null>(makeSpec({
      functions: [],
      solutions: [],
      values: [makeV({ goal: '50%' })],
    }))
    const { violations, scanAntiPatterns } = useAntiPatterns(spec)
    scanAntiPatterns()
    const ap4 = violations.value.filter(v => v.patternId === 'AP4')
    expect(ap4.length).toBeGreaterThan(0)
  })

  it('AP5 fires for "improve performance" in description (no number)', () => {
    const spec = ref<SpecBlock | null>(makeSpec({
      values: [],
      solutions: [],
      functions: [makeF({ description: 'The system should improve performance across all modules' })],
    }))
    const { violations, scanAntiPatterns } = useAntiPatterns(spec)
    scanAntiPatterns()
    const ap5 = violations.value.filter(v => v.patternId === 'AP5')
    expect(ap5.length).toBeGreaterThan(0)
  })

  it('AP7 fires for description containing "good"', () => {
    const spec = ref<SpecBlock | null>(makeSpec({
      values: [],
      solutions: [],
      functions: [makeF({ description: 'The system provides a good user experience' })],
    }))
    const { violations, scanAntiPatterns } = useAntiPatterns(spec)
    scanAntiPatterns()
    const ap7 = violations.value.filter(v => v.patternId === 'AP7')
    expect(ap7.length).toBeGreaterThan(0)
  })

  it('violationCount matches violations.length', () => {
    const spec = ref<SpecBlock | null>(makeSpec({
      values: [],
      solutions: [],
      functions: [
        makeF({ description: 'The system provides a good user experience' }),
        makeF({ id: 'NoConvention', description: 'This has passive voice: will be improved' }),
      ],
    }))
    const { violations, violationCount, scanAntiPatterns } = useAntiPatterns(spec)
    scanAntiPatterns()
    expect(violationCount.value).toBe(violations.value.length)
  })

  it('copyReport markdown contains "## Anti-Pattern Report"', async () => {
    let captured = ''
    vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(async (text) => {
      captured = text
    })
    const spec = ref<SpecBlock | null>(makeSpec({
      values: [],
      solutions: [],
      functions: [makeF({ description: 'The system provides a good user experience' })],
    }))
    const { scanAntiPatterns, copyReport } = useAntiPatterns(spec)
    scanAntiPatterns()
    await copyReport()
    expect(captured).toContain('## Anti-Pattern Report')
  })
})
