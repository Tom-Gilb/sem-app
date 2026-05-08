// UNIT_TYPE=Test
// Tests for useSpecContract composable (Feature #94)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import type { SpecBlock } from '../../types/spec'

// Mock jsPDF before importing the composable
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

// Mock navigator.clipboard
const writeTextMock = vi.fn().mockResolvedValue(undefined)
vi.stubGlobal('navigator', {
  clipboard: { writeText: writeTextMock },
})

const minimalSpec: SpecBlock = {
  functions: [
    {
      id: 'F.TestFunction',
      type: 'Function',
      level: 'Product',
      description: 'A test function for users',
      successCriteria: 'Works correctly',
      functionOfValue: 'V.TestValue',
    },
  ],
  values: [
    {
      id: 'V.TestValue',
      type: 'Value',
      level: 'Product',
      description: 'Test value description for measurement',
      scale: 'Percentage of successful tasks (0–100%)',
      meter: 'Automated test suite run',
      status: 'pre-build',
      tolerable: '70%',
      goal: '90%',
      valueOfFunction: 'F.TestFunction',
    },
  ],
  solutions: [
    {
      id: 'S.TestSolution',
      type: 'Solution',
      level: 'Product',
      description: 'Implements the test function',
      impact: 'V.TestValue ~90%',
      function: 'F.TestFunction',
    },
  ],
}

describe('useSpecContract', () => {
  it('initial state: contractOpen is false and clauses is empty', async () => {
    const { useSpecContract } = await import('../useSpecContract')
    const specRef = ref<SpecBlock | null>(null)
    const { contractOpen, clauses } = useSpecContract(specRef)
    expect(contractOpen.value).toBe(false)
    expect(clauses.value).toHaveLength(0)
  })

  it('initial contractTitle is "Value Delivery Contract"', async () => {
    const { useSpecContract } = await import('../useSpecContract')
    const specRef = ref<SpecBlock | null>(null)
    const { contractTitle } = useSpecContract(specRef)
    expect(contractTitle.value).toBe('Value Delivery Contract')
  })

  it('generateClauses from spec with one V. entry produces 1 clause', async () => {
    const { useSpecContract } = await import('../useSpecContract')
    const specRef = ref<SpecBlock | null>(minimalSpec)
    const { clauses, generateClauses } = useSpecContract(specRef)
    generateClauses()
    expect(clauses.value).toHaveLength(1)
  })

  it('clause.obligation starts with "The system shall"', async () => {
    const { useSpecContract } = await import('../useSpecContract')
    const specRef = ref<SpecBlock | null>(minimalSpec)
    const { clauses, generateClauses } = useSpecContract(specRef)
    generateClauses()
    expect(clauses.value[0].obligation).toMatch(/^The system shall/)
  })

  it('clause.metric is non-empty (uses scale or fallback)', async () => {
    const { useSpecContract } = await import('../useSpecContract')
    const specRef = ref<SpecBlock | null>(minimalSpec)
    const { clauses, generateClauses } = useSpecContract(specRef)
    generateClauses()
    expect(clauses.value[0].metric).toBeTruthy()
  })

  it('clause.threshold uses goal field value', async () => {
    const { useSpecContract } = await import('../useSpecContract')
    const specRef = ref<SpecBlock | null>(minimalSpec)
    const { clauses, generateClauses } = useSpecContract(specRef)
    generateClauses()
    expect(clauses.value[0].threshold).toBe('90%')
  })

  it('updateSignOff updates signOff and signedDate for the entry', async () => {
    const { useSpecContract } = await import('../useSpecContract')
    const specRef = ref<SpecBlock | null>(minimalSpec)
    const { clauses, generateClauses, updateSignOff } = useSpecContract(specRef)
    generateClauses()
    updateSignOff('V.TestValue', 'Alice', '2026-05-01')
    expect(clauses.value[0].signOff).toBe('Alice')
    expect(clauses.value[0].signedDate).toBe('2026-05-01')
  })

  it('copyContract produces markdown with "# " title heading', async () => {
    writeTextMock.mockClear()
    const { useSpecContract } = await import('../useSpecContract')
    const specRef = ref<SpecBlock | null>(minimalSpec)
    const { generateClauses, copyContract, contractTitle } = useSpecContract(specRef)
    generateClauses()
    copyContract()
    expect(writeTextMock).toHaveBeenCalledOnce()
    const capturedText: string = writeTextMock.mock.calls[0][0]
    expect(capturedText).toMatch(/^# /)
    expect(capturedText).toContain(contractTitle.value)
  })

  it('copyContract markdown includes clause ID', async () => {
    writeTextMock.mockClear()
    const { useSpecContract } = await import('../useSpecContract')
    const specRef = ref<SpecBlock | null>(minimalSpec)
    const { generateClauses, copyContract } = useSpecContract(specRef)
    generateClauses()
    copyContract()
    expect(writeTextMock).toHaveBeenCalledOnce()
    const capturedText: string = writeTextMock.mock.calls[0][0]
    expect(capturedText).toContain('V.TestValue')
  })

  it('exportContractPDF does not throw with jsPDF mocked', async () => {
    const { useSpecContract } = await import('../useSpecContract')
    const specRef = ref<SpecBlock | null>(minimalSpec)
    const { generateClauses, exportContractPDF } = useSpecContract(specRef)
    generateClauses()
    await expect(exportContractPDF()).resolves.not.toThrow()
  })
})
