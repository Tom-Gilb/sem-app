// UNIT_TYPE=Test
// Feature #79 — useSpecHealthReport composable tests

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import type { SpecBlock, VEntry, FEntry, SEntry } from '../../types/spec'

// Mock jsPDF before importing the composable
vi.mock('jspdf', () => ({
  default: class {
    addPage() {}
    text() {}
    save() {}
    setFontSize() {}
    setFont() {}
    rect() {}
    setFillColor() {}
    addImage() {}
    setTextColor() {}
    setDrawColor() {}
    line() {}
    splitTextToSize(t: string) { return [t] }
  },
}))

import { useSpecHealthReport } from '../useSpecHealthReport'

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
    valueOfFunction: 'F.Test',
    ...overrides,
  }
}

function makeFEntry(overrides: Partial<FEntry> = {}): FEntry {
  return {
    id: 'F.Test',
    type: 'Function',
    level: 'Product',
    description: 'Provide a test function',
    successCriteria: 'Works correctly',
    functionOfValue: '',
    ...overrides,
  }
}

function makeSEntry(overrides: Partial<SEntry> = {}): SEntry {
  return {
    id: 'S.Test',
    type: 'Solution',
    level: 'Product',
    description: 'A test solution',
    impact: 'V.Test ~80%',
    function: 'F.Test',
    ...overrides,
  }
}

function makeSpec(overrides: Partial<SpecBlock> = {}): SpecBlock {
  return {
    functions: [makeFEntry()],
    values: [makeVEntry()],
    solutions: [makeSEntry()],
    ...overrides,
  }
}

describe('useSpecHealthReport', () => {
  it('initial state: healthPdfOpen is false', () => {
    const specRef = ref<SpecBlock | null>(null)
    const { healthPdfOpen } = useSpecHealthReport(specRef)
    expect(healthPdfOpen.value).toBe(false)
  })

  it('exportHealthPDF does nothing (no throw) when spec is null', () => {
    const specRef = ref<SpecBlock | null>(null)
    const { exportHealthPDF } = useSpecHealthReport(specRef)
    expect(() => exportHealthPDF()).not.toThrow()
  })

  it('exportHealthPDF calls jsPDF constructor when spec is set', async () => {
    const jsPDF = (await import('jspdf')).default
    const constructorSpy = vi.spyOn(jsPDF.prototype, 'save')
    const specRef = ref<SpecBlock | null>(makeSpec())
    const { exportHealthPDF } = useSpecHealthReport(specRef)
    exportHealthPDF()
    expect(constructorSpy).toHaveBeenCalledWith('spec-health-report.pdf')
  })

  it('useSpecHealthReport is exported and callable', () => {
    expect(typeof useSpecHealthReport).toBe('function')
    const specRef = ref<SpecBlock | null>(null)
    const result = useSpecHealthReport(specRef)
    expect(result).toHaveProperty('healthPdfOpen')
    expect(result).toHaveProperty('exportHealthPDF')
  })

  it('does not mutate the spec ref after export', () => {
    const spec = makeSpec()
    const specRef = ref<SpecBlock | null>(spec)
    const originalFCount = spec.functions.length
    const { exportHealthPDF } = useSpecHealthReport(specRef)
    exportHealthPDF()
    expect(specRef.value?.functions.length).toBe(originalFCount)
  })

  it('healthPdfOpen stays false after export (visual flag only)', () => {
    const specRef = ref<SpecBlock | null>(makeSpec())
    const { healthPdfOpen, exportHealthPDF } = useSpecHealthReport(specRef)
    exportHealthPDF()
    expect(healthPdfOpen.value).toBe(false)
  })

  it('exportHealthPDF handles spec with no V. entries without throwing', () => {
    const specRef = ref<SpecBlock | null>(makeSpec({ values: [] }))
    const { exportHealthPDF } = useSpecHealthReport(specRef)
    expect(() => exportHealthPDF()).not.toThrow()
  })

  it('exportHealthPDF handles spec with multiple V. entries', () => {
    const specRef = ref<SpecBlock | null>(makeSpec({
      values: [makeVEntry({ id: 'V.A' }), makeVEntry({ id: 'V.B' }), makeVEntry({ id: 'V.C' })],
    }))
    const { exportHealthPDF } = useSpecHealthReport(specRef)
    expect(() => exportHealthPDF()).not.toThrow()
  })
})
