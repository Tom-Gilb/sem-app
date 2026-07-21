// UNIT_TYPE=Test
// Feature #61 — useSpecGlossary composable tests

import { describe, it, expect } from 'vitest'
import { useSpecGlossary } from '../useSpecGlossary'
import type { SpecBlock } from '../../types/spec'

const emptySpec: SpecBlock = {
  functions: [],
  values: [],
  solutions: [],
}

const specWithAcronyms: SpecBlock = {
  functions: [
    {
      id: 'F.ProvideAPI',
      type: 'Function',
      level: 'Product',
      description: 'Provide REST API endpoint for data retrieval with SLA guarantee',
      successCriteria: 'API returns correct responses within SLA limits',
      functionOfValue: 'V.Latency',
    },
  ],
  values: [
    {
      id: 'V.Latency',
      type: 'Value',
      level: 'Product',
      description: 'API response latency for UX improvement',
      scale: 'ms at 95th percentile',
      meter: 'Synthetic monitoring via KPI dashboard',
      status: '500ms',
      tolerable: '300ms',
      goal: '100ms',
      valueOfFunction: 'F.ProvideAPI',
    },
  ],
  solutions: [
    {
      id: 'S.CacheLayer',
      type: 'Solution',
      level: 'Solution',
      description: 'Implement Redis cache layer to reduce UI database load',
      impact: 'V.Latency ~80%',
      function: 'F.ProvideAPI',
    },
  ],
}

const specWithCapTerms: SpecBlock = {
  functions: [
    {
      id: 'F.Dashboard',
      type: 'Function',
      level: 'Product',
      description: 'Provide real-time Dashboard for stakeholder reporting',
      successCriteria: 'Dashboard loads within 2s',
      functionOfValue: 'V.Adoption',
    },
  ],
  values: [
    {
      id: 'V.Adoption',
      type: 'Value',
      level: 'Business',
      description: 'Stakeholder adoption rate of Dashboard features',
      scale: '% of stakeholders using Dashboard weekly',
      meter: 'Analytics platform',
      status: '30%',
      tolerable: '50%',
      goal: '80%',
      valueOfFunction: 'F.Dashboard',
    },
  ],
  solutions: [],
}

describe('useSpecGlossary', () => {
  describe('initial state', () => {
    it('glossary starts empty', () => {
      const { glossary } = useSpecGlossary()
      expect(glossary.value).toEqual([])
    })

    it('loading starts false', () => {
      const { loading } = useSpecGlossary()
      expect(loading.value).toBe(false)
    })

    it('copied starts false', () => {
      const { copied } = useSpecGlossary()
      expect(copied.value).toBe(false)
    })
  })

  describe('extractTerms with acronym spec', () => {
    it('produces at least one acronym entry', () => {
      const { glossary, extractTerms } = useSpecGlossary()
      extractTerms(specWithAcronyms)
      const acronymEntries = glossary.value.filter(e => e.type === 'acronym')
      expect(acronymEntries.length).toBeGreaterThan(0)
    })

    it('each entry has required fields', () => {
      const { glossary, extractTerms } = useSpecGlossary()
      extractTerms(specWithAcronyms)
      for (const entry of glossary.value) {
        expect(entry).toHaveProperty('term')
        expect(entry).toHaveProperty('type')
        expect(entry).toHaveProperty('usedIn')
        expect(entry).toHaveProperty('definition')
      }
    })

    it('usedIn contains the entry ID where the term appeared', () => {
      const { glossary, extractTerms } = useSpecGlossary()
      extractTerms(specWithAcronyms)
      // API should appear in F.ProvideAPI description
      const apiEntry = glossary.value.find(e => e.term === 'API')
      expect(apiEntry).toBeDefined()
      expect(apiEntry!.usedIn).toContain('F.ProvideAPI')
    })

    it('known acronym gets a proper definition (not fallback)', () => {
      const { glossary, extractTerms } = useSpecGlossary()
      extractTerms(specWithAcronyms)
      const apiEntry = glossary.value.find(e => e.term === 'API')
      expect(apiEntry).toBeDefined()
      expect(apiEntry!.definition).toContain('Application Programming Interface')
    })

    it('unknown acronym gets a fallback definition', () => {
      const { glossary, extractTerms } = useSpecGlossary()
      extractTerms(specWithAcronyms)
      // SLA should appear and is in the known-acronyms map
      const slaEntry = glossary.value.find(e => e.term === 'SLA')
      expect(slaEntry).toBeDefined()
      expect(slaEntry!.definition).toContain('Service Level Agreement')
    })
  })

  describe('extractTerms with capitalised term spec', () => {
    it('produces at least one domain-term entry', () => {
      const { glossary, extractTerms } = useSpecGlossary()
      extractTerms(specWithCapTerms)
      const domainTermEntries = glossary.value.filter(e => e.type === 'domain-term')
      expect(domainTermEntries.length).toBeGreaterThan(0)
    })

    it('type is one of acronym, domain-term, metric, planguage-tag', () => {
      const { glossary, extractTerms } = useSpecGlossary()
      extractTerms(specWithCapTerms)
      for (const entry of glossary.value) {
        expect(['acronym', 'domain-term', 'metric', 'planguage-tag']).toContain(entry.type)
      }
    })
  })

  describe('optional Planguage Tags category (r41 v393)', () => {
    it('does NOT emit planguage-tag entries by default', () => {
      const { glossary, extractTerms } = useSpecGlossary()
      extractTerms(specWithAcronyms, { includePlanguageTags: false })
      expect(glossary.value.filter(e => e.type === 'planguage-tag')).toHaveLength(0)
    })

    it('emits one planguage-tag entry per F/V/S entry when opted in', () => {
      const { glossary, extractTerms } = useSpecGlossary()
      extractTerms(specWithAcronyms, { includePlanguageTags: true })
      const tags = glossary.value.filter(e => e.type === 'planguage-tag')
      // 1 Function + 1 Value + 1 Solution = 3
      expect(tags).toHaveLength(3)
    })

    it('each planguage-tag row carries a planguageType matching entry family', () => {
      const { glossary, extractTerms } = useSpecGlossary()
      extractTerms(specWithAcronyms, { includePlanguageTags: true })
      const tags = glossary.value.filter(e => e.type === 'planguage-tag')
      const types = tags.map(t => t.planguageType).sort()
      expect(types).toEqual(['Function', 'Solution', 'Value'])
    })

    it('Planguage Tag rows interleave alphabetically with other categories', () => {
      const { glossary, extractTerms } = useSpecGlossary()
      extractTerms(specWithAcronyms, { includePlanguageTags: true })
      const terms = glossary.value.map(e => e.term)
      const sorted = [...terms].sort((a, b) => a.localeCompare(b))
      expect(terms).toEqual(sorted)
    })

    it('Planguage Tag term uses mnemonic label (no dotted V./F./S. prefix in user-visible text)', () => {
      const { glossary, extractTerms } = useSpecGlossary()
      extractTerms(specWithAcronyms, { includePlanguageTags: true })
      for (const t of glossary.value.filter(e => e.type === 'planguage-tag')) {
        expect(t.term).not.toMatch(/^[VFSCRvfscr]\./)
      }
    })

    it('setIncludePlanguageTags(true, spec) toggles + re-extracts', () => {
      const { glossary, setIncludePlanguageTags, includePlanguageTags } = useSpecGlossary()
      setIncludePlanguageTags(true, specWithAcronyms)
      expect(includePlanguageTags.value).toBe(true)
      expect(glossary.value.some(e => e.type === 'planguage-tag')).toBe(true)
      setIncludePlanguageTags(false, specWithAcronyms)
      expect(includePlanguageTags.value).toBe(false)
      expect(glossary.value.some(e => e.type === 'planguage-tag')).toBe(false)
    })

    it('toHtml renders planguage-tag rows with Planguage Tag label', () => {
      const { extractTerms, toHtml } = useSpecGlossary()
      extractTerms(specWithAcronyms, { includePlanguageTags: true })
      const html = toHtml()
      expect(html).toContain('Planguage Tag')
    })

    it('toMarkdown labels planguage-tag rows with their canonical type', () => {
      const { extractTerms, toMarkdown } = useSpecGlossary()
      extractTerms(specWithAcronyms, { includePlanguageTags: true })
      const md = toMarkdown()
      expect(md).toMatch(/Planguage Tag · (Function|Value|Solution|Constraint|Resource)/)
    })
  })

  describe('sorting', () => {
    it('terms are sorted alphabetically', () => {
      const { glossary, extractTerms } = useSpecGlossary()
      extractTerms(specWithAcronyms)
      const terms = glossary.value.map(e => e.term)
      const sorted = [...terms].sort((a, b) => a.localeCompare(b))
      expect(terms).toEqual(sorted)
    })
  })

  describe('toMarkdown', () => {
    it('returns string containing term text', () => {
      const { glossary, extractTerms, toMarkdown } = useSpecGlossary()
      extractTerms(specWithAcronyms)
      const md = toMarkdown()
      expect(typeof md).toBe('string')
      // Each glossary term should appear in the markdown
      for (const entry of glossary.value) {
        expect(md).toContain(entry.term)
      }
    })

    it('starts with # Spec Glossary', () => {
      const { extractTerms, toMarkdown } = useSpecGlossary()
      extractTerms(specWithAcronyms)
      const md = toMarkdown()
      expect(md.startsWith('# Spec Glossary')).toBe(true)
    })
  })

  describe('empty spec', () => {
    it('extractTerms on empty spec produces glossary length 0', () => {
      const { glossary, extractTerms } = useSpecGlossary()
      extractTerms(emptySpec)
      expect(glossary.value.length).toBe(0)
    })
  })
})
