// UNIT_TYPE=Test
// Tests for usePdfExport composable (Feature #14)

import { describe, it, expect, vi } from 'vitest'
import type { SpecBlock } from '../../types/spec'
import type { EvoStep } from '../../types/evo-plan'

// jsPDF uses browser APIs (canvas, etc.) — stub it for Node/JSDOM environment
vi.mock('jspdf', () => {
  function MockJsPDF() {
    this.setFontSize = vi.fn()
    this.setTextColor = vi.fn()
    this.setFont = vi.fn()
    this.setDrawColor = vi.fn()
    this.splitTextToSize = vi.fn((text: string) => [text])
    this.text = vi.fn()
    this.line = vi.fn()
    this.addPage = vi.fn()
    this.save = vi.fn()
  }
  return { default: MockJsPDF }
})

const minimalSpec: SpecBlock = {
  functions: [
    {
      id: 'F.Test',
      type: 'Function',
      level: 'Product',
      description: 'Test function',
      successCriteria: 'It works',
      functionOfValue: 'V.Test',
    },
  ],
  values: [
    {
      id: 'V.Test',
      type: 'Value',
      level: 'Product',
      description: 'Test value',
      scale: '% passing',
      meter: 'Automated tests',
      status: 'pre-build',
      tolerable: '70%',
      goal: '90%',
      valueOfFunction: 'F.Test',
    },
  ],
  solutions: [
    {
      id: 'S.Test',
      type: 'Solution',
      level: 'Product',
      description: 'Test solution',
      impact: 'V.Test ~90%',
      function: 'F.Test',
    },
  ],
}

const sampleSteps: EvoStep[] = [
  {
    name: 'S.Evo1.Step',
    description: 'First step description',
    linkedValues: ['V.Test'],
    linkedSolution: 'S.Test',
    effortPercent: 30,
  },
]

describe('usePdfExport', () => {
  it('exportToPdf does not throw for a minimal SpecBlock', async () => {
    const { usePdfExport } = await import('../usePdfExport')
    const { exportToPdf } = usePdfExport()
    expect(() => exportToPdf(minimalSpec)).not.toThrow()
  })

  it('exportToPdf does not throw with optional evo steps', async () => {
    const { usePdfExport } = await import('../usePdfExport')
    const { exportToPdf } = usePdfExport()
    expect(() => exportToPdf(minimalSpec, sampleSteps)).not.toThrow()
  })

  it('exportToPdf saves a PDF without errors for a spec with evo steps', async () => {
    const { usePdfExport } = await import('../usePdfExport')
    const { exportToPdf } = usePdfExport()
    // This test verifies the complete code path (including Evo Plan section) does not throw
    expect(() => exportToPdf(minimalSpec, sampleSteps)).not.toThrow()
  })
})
