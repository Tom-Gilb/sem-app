// UNIT_TYPE=Test
// Feature #52 — Tests for useRegulationMap composable

import { describe, it, expect } from 'vitest'
import { useRegulationMap } from '../useRegulationMap'
import type { SpecBlock } from '../../types/spec'

// Spec with data/privacy keywords — should trigger GDPR
const specWithDataKeywords: SpecBlock = {
  functions: [
    {
      id: 'F.ManageUserData',
      type: 'Function',
      level: 'Product',
      description: 'Manage user personal data with consent and privacy controls',
      successCriteria: 'Data access restricted to authorised users',
      functionOfValue: 'V.DataPrivacy',
    },
  ],
  values: [
    {
      id: 'V.DataPrivacy',
      type: 'Value',
      level: 'Product',
      description: 'User personal data retention and privacy compliance',
      scale: '% records with consent on file',
      meter: 'Automated data audit',
      status: '60%',
      tolerable: '90%',
      goal: '100%',
      valueOfFunction: 'F.ManageUserData',
    },
  ],
  solutions: [
    {
      id: 'S.ConsentGate',
      type: 'Solution',
      level: 'Product',
      description: 'Consent gate blocks data access without user consent',
      impact: 'V.DataPrivacy ~95%',
      function: 'F.ManageUserData',
    },
  ],
}

// Spec with quality/process keywords — should trigger ISO 9001
const specWithQualityKeywords: SpecBlock = {
  functions: [
    {
      id: 'F.QualityAudit',
      type: 'Function',
      level: 'Product',
      description: 'Run quality audit process for customer improvement records',
      successCriteria: 'All process documents reviewed quarterly',
      functionOfValue: 'V.ProcessQuality',
    },
  ],
  values: [
    {
      id: 'V.ProcessQuality',
      type: 'Value',
      level: 'Product',
      description: 'Quality process improvement audit score for customer documents',
      scale: 'audit pass rate %',
      meter: 'Quarterly audit record',
      status: '70%',
      tolerable: '85%',
      goal: '95%',
      valueOfFunction: 'F.QualityAudit',
    },
  ],
  solutions: [
    {
      id: 'S.AuditDashboard',
      type: 'Solution',
      level: 'Product',
      description: 'Audit dashboard shows process improvement records and quality scores',
      impact: 'V.ProcessQuality ~90%',
      function: 'F.QualityAudit',
    },
  ],
}

// Empty spec — no entries, no mappings
const emptySpec: SpecBlock = {
  functions: [],
  values: [],
  solutions: [],
}

// Spec with 4+ entries (enough to test padding logic triggering)
const specWith4Entries: SpecBlock = {
  functions: [
    {
      id: 'F.One',
      type: 'Function',
      level: 'Product',
      description: 'First function',
      successCriteria: 'Works',
      functionOfValue: '',
    },
    {
      id: 'F.Two',
      type: 'Function',
      level: 'Product',
      description: 'Second function',
      successCriteria: 'Works',
      functionOfValue: '',
    },
  ],
  values: [
    {
      id: 'V.Alpha',
      type: 'Value',
      level: 'Product',
      description: 'Alpha value',
      scale: 'units',
      meter: 'Test',
      status: '0',
      tolerable: '5',
      goal: '10',
      valueOfFunction: '',
    },
    {
      id: 'V.Beta',
      type: 'Value',
      level: 'Product',
      description: 'Beta value',
      scale: 'units',
      meter: 'Test',
      status: '0',
      tolerable: '5',
      goal: '10',
      valueOfFunction: '',
    },
  ],
  solutions: [],
}

describe('useRegulationMap', () => {
  it('mappings starts empty', () => {
    const { mappings } = useRegulationMap()
    expect(mappings.value).toHaveLength(0)
  })

  it('generateMappings with data keywords produces at least one GDPR mapping', () => {
    const { mappings, generateMappings } = useRegulationMap()
    generateMappings(specWithDataKeywords)
    const gdprMappings = mappings.value.filter(m => m.framework === 'GDPR')
    expect(gdprMappings.length).toBeGreaterThanOrEqual(1)
  })

  it('generateMappings with quality keywords produces at least one ISO 9001 mapping', () => {
    const { mappings, generateMappings } = useRegulationMap()
    generateMappings(specWithQualityKeywords)
    const isoMappings = mappings.value.filter(m => m.framework === 'ISO 9001')
    expect(isoMappings.length).toBeGreaterThanOrEqual(1)
  })

  it('generateMappings with empty spec produces 0 mappings', () => {
    const { mappings, generateMappings } = useRegulationMap()
    generateMappings(emptySpec)
    expect(mappings.value).toHaveLength(0)
  })

  it('each mapping has all required fields', () => {
    const { mappings, generateMappings } = useRegulationMap()
    generateMappings(specWithDataKeywords)
    for (const m of mappings.value) {
      expect(m).toHaveProperty('entryId')
      expect(m).toHaveProperty('entryType')
      expect(m).toHaveProperty('framework')
      expect(m).toHaveProperty('clause')
      expect(m).toHaveProperty('relevance')
      expect(m).toHaveProperty('rationale')
      expect(typeof m.entryId).toBe('string')
      expect(['F', 'V', 'S']).toContain(m.entryType)
      expect(['GDPR', 'ISO 9001', 'SOC 2', 'OKR']).toContain(m.framework)
      expect(['high', 'medium', 'low']).toContain(m.relevance)
      expect(typeof m.rationale).toBe('string')
    }
  })

  it('mappings.length >= 3 when spec has >=3 entries (padding logic)', () => {
    const { mappings, generateMappings } = useRegulationMap()
    generateMappings(specWith4Entries)
    expect(mappings.value.length).toBeGreaterThanOrEqual(3)
  })

  it('copied starts false', () => {
    const { copied } = useRegulationMap()
    expect(copied.value).toBe(false)
  })
})
