// UNIT_TYPE=Test
// Feature #103 — useResilienceChecker composable tests

import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { useResilienceChecker } from '../useResilienceChecker'
import type { SpecBlock, FEntry, VEntry, SEntry } from '../../types/spec'

function makeF(overrides: Partial<FEntry> = {}): FEntry {
  return {
    id: 'F.ProvideSEMEntry',
    type: 'Function',
    level: 'Product',
    description: 'The system provides a structured entry interface.',
    successCriteria: '',
    functionOfValue: '',
    ...overrides,
  }
}

function makeV(overrides: Partial<VEntry> = {}): VEntry {
  return {
    id: 'V.EntryFluency',
    type: 'Value',
    level: 'Product',
    description: 'Measures user entry speed.',
    scale: 'seconds per entry',
    meter: 'Automated timer',
    status: 'Status [now] 60',
    tolerable: 'Tolerable [2026] 45',
    goal: 'Goal [2026] 30',
    valueOfFunction: '',
    ...overrides,
  }
}

function makeS(overrides: Partial<SEntry> = {}): SEntry {
  return {
    id: 'S.MarkdownSerialiser',
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

describe('useResilienceChecker', () => {
  it('initial: resilienceOpen is false', () => {
    const spec = ref<SpecBlock | null>(null)
    const { resilienceOpen } = useResilienceChecker(spec)
    expect(resilienceOpen.value).toBe(false)
  })

  it('initial: issues is empty', () => {
    const spec = ref<SpecBlock | null>(null)
    const { issues } = useResilienceChecker(spec)
    expect(issues.value).toHaveLength(0)
  })

  it('scanResilience with null spec: issues remains empty', () => {
    const spec = ref<SpecBlock | null>(null)
    const { scanResilience, issues } = useResilienceChecker(spec)
    scanResilience()
    expect(issues.value).toHaveLength(0)
  })

  it('"only source" in description triggers H risk', () => {
    const spec = ref<SpecBlock | null>(
      makeSpec({
        solutions: [makeS({ description: 'Uses only source database for all data.' })],
      }),
    )
    const { scanResilience, issues } = useResilienceChecker(spec)
    scanResilience()
    const hIssues = issues.value.filter(i => i.risk === 'H')
    expect(hIssues.length).toBeGreaterThan(0)
  })

  it('"no fallback" in description triggers H risk', () => {
    const spec = ref<SpecBlock | null>(
      makeSpec({
        solutions: [makeS({ description: 'System operates with no fallback mechanism available.' })],
      }),
    )
    const { scanResilience, issues } = useResilienceChecker(spec)
    scanResilience()
    const hIssues = issues.value.filter(i => i.risk === 'H')
    expect(hIssues.length).toBeGreaterThan(0)
  })

  it('"external api" in description triggers L risk', () => {
    const spec = ref<SpecBlock | null>(
      makeSpec({
        solutions: [makeS({ description: 'Calls an external api to fetch data.' })],
      }),
    )
    const { scanResilience, issues } = useResilienceChecker(spec)
    scanResilience()
    const lIssues = issues.value.filter(i => i.risk === 'L')
    expect(lIssues.length).toBeGreaterThan(0)
  })

  it('"manual only" in description triggers M risk', () => {
    const spec = ref<SpecBlock | null>(
      makeSpec({
        solutions: [makeS({ description: 'Requires manual only review before deployment.' })],
      }),
    )
    const { scanResilience, issues } = useResilienceChecker(spec)
    scanResilience()
    const mIssues = issues.value.filter(i => i.risk === 'M')
    expect(mIssues.length).toBeGreaterThan(0)
  })

  it('highCount computed counts H-risk issues correctly', () => {
    const spec = ref<SpecBlock | null>(
      makeSpec({
        solutions: [
          makeS({ id: 'S.1', description: 'Uses only source database for all operations.' }),
          makeS({ id: 'S.2', description: 'System has no fallback mechanism for recovery.' }),
        ],
      }),
    )
    const { scanResilience, highCount } = useResilienceChecker(spec)
    scanResilience()
    expect(highCount.value).toBeGreaterThanOrEqual(1)
  })

  it('issues are sorted H before M before L', () => {
    const spec = ref<SpecBlock | null>(
      makeSpec({
        functions: [
          makeF({ description: 'The system calls an external api for all data.' }),
        ],
        solutions: [
          makeS({ id: 'S.1', description: 'Requires manual only review process for all changes.' }),
          makeS({ id: 'S.2', description: 'Uses only source system with no fallback available.' }),
        ],
      }),
    )
    const { scanResilience, issues } = useResilienceChecker(spec)
    scanResilience()
    const risks = issues.value.map(i => i.risk)
    // Verify no L/M comes before H, no L comes before M
    const riskOrder = { H: 0, M: 1, L: 2 }
    for (let i = 1; i < risks.length; i++) {
      expect(riskOrder[risks[i]]).toBeGreaterThanOrEqual(riskOrder[risks[i - 1]])
    }
  })

  it('copyReport contains "## Resilience Report"', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    const spec = ref<SpecBlock | null>(makeSpec())
    const { scanResilience, copyReport } = useResilienceChecker(spec)
    scanResilience()
    await copyReport()
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('## Resilience Report'))
  })
})
