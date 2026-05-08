// UNIT_TYPE=Test
// Feature #23 — Tests for useOKRExport composable

import { describe, it, expect } from 'vitest'
import { useOKRExport } from '../useOKRExport'
import type { SpecBlock } from '../../types/spec'

const { convertToOKR } = useOKRExport()

const fullSpec: SpecBlock = {
  functions: [
    {
      id: 'F.ProvideSEMInterface',
      type: 'Function',
      level: 'Product',
      description: 'Provide a SEM entry interface for users',
      successCriteria: 'All required fields validated on submission',
      functionOfValue: 'V.EntryFluency',
    },
  ],
  values: [
    {
      id: 'V.EntryFluency',
      type: 'Value',
      level: 'Product',
      description: 'Time for users to complete a SEM entry',
      scale: 'seconds per entry',
      meter: 'Automated usability test',
      status: '120s',
      tolerable: '90s',
      goal: '45s',
      valueOfFunction: 'F.ProvideSEMInterface',
    },
  ],
  solutions: [
    {
      id: 'S.FormAutoComplete',
      type: 'Solution',
      level: 'Product',
      description: 'Auto-complete suggestions for entry fields',
      impact: 'V.EntryFluency ~60s',
      function: 'F.ProvideSEMInterface',
    },
  ],
}

const emptySpec: SpecBlock = {
  functions: [],
  values: [],
  solutions: [],
}

const noLinkedSpec: SpecBlock = {
  functions: [
    {
      id: 'F.Solo',
      type: 'Function',
      level: 'Product',
      description: 'Solo function with no linked values',
      successCriteria: 'It works',
      functionOfValue: '', // no links
    },
  ],
  values: [
    {
      id: 'V.Unlinked',
      type: 'Value',
      level: 'Product',
      description: 'A standalone value',
      scale: '% uptime',
      meter: 'Monitoring',
      status: '95%',
      tolerable: '99%',
      goal: '99.9%',
      valueOfFunction: '',
    },
  ],
  solutions: [],
}

describe('useOKRExport — convertToOKR', () => {

  it('returns a string containing "Objective:"', () => {
    const result = convertToOKR(fullSpec)
    expect(result).toContain('Objective:')
  })

  it('returns a string containing "KR1"', () => {
    const result = convertToOKR(fullSpec)
    expect(result).toContain('KR1')
  })

  it('returns a string containing "Key Result" or "KR1"', () => {
    const result = convertToOKR(fullSpec)
    expect(result.includes('Key Result') || result.includes('KR1')).toBe(true)
  })

  it('empty spec returns a string (no crash)', () => {
    const result = convertToOKR(emptySpec)
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('output starts with ## Objectives & Key Results', () => {
    const result = convertToOKR(fullSpec)
    expect(result.startsWith('## Objectives & Key Results')).toBe(true)
  })

  it('F. description appears as Objective text', () => {
    const result = convertToOKR(fullSpec)
    expect(result).toContain('Provide a SEM entry interface for users')
  })

  it('V. goal and scale appear in KR line', () => {
    const result = convertToOKR(fullSpec)
    expect(result).toContain('45s')
    expect(result).toContain('seconds per entry')
  })

  it('V. status appears as "currently X" in KR line', () => {
    const result = convertToOKR(fullSpec)
    expect(result).toContain('currently 120s')
  })

  it('when no linked V. entries, falls back to all V. entries', () => {
    const result = convertToOKR(noLinkedSpec)
    expect(result).toContain('KR1')
    expect(result).toContain('99.9%')
  })

  it('success criteria appears in output when present', () => {
    const result = convertToOKR(fullSpec)
    expect(result).toContain('All required fields validated on submission')
  })
})
