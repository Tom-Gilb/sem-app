// UNIT_TYPE=Test
// Feature #63 — useSpecNarrative composable tests

import { describe, it, expect } from 'vitest'
import { useSpecNarrative } from '../useSpecNarrative'
import type { SpecBlock } from '../../types/spec'

const emptySpec: SpecBlock = {
  functions: [],
  values: [],
  solutions: [],
}

const mockSpec: SpecBlock = {
  functions: [
    {
      id: 'F.ProvideSearch',
      type: 'Function',
      level: 'Product',
      description: 'Provide full-text search capability across all documents',
      successCriteria: 'Search returns relevant results within 500ms',
      functionOfValue: 'V.SearchSpeed',
    },
    {
      id: 'F.ProvideFiltering',
      type: 'Function',
      level: 'Product',
      description: 'Provide faceted filtering by category and date range',
      successCriteria: 'Filters apply without page reload',
      functionOfValue: 'V.UserSatisfaction',
    },
  ],
  values: [
    {
      id: 'V.SearchSpeed',
      type: 'Value',
      level: 'Product',
      description: 'Time to return search results',
      scale: 'ms at median',
      meter: 'Synthetic test suite',
      status: '800ms',
      tolerable: '500ms',
      goal: '200ms',
      valueOfFunction: 'F.ProvideSearch',
    },
    {
      id: 'V.UserSatisfaction',
      type: 'Value',
      level: 'Business',
      description: 'User satisfaction with search experience',
      scale: 'NPS score -100 to +100',
      meter: 'In-app survey',
      status: '20',
      tolerable: '40',
      goal: '70',
      valueOfFunction: 'F.ProvideFiltering',
    },
    {
      id: 'V.Accuracy',
      type: 'Value',
      level: 'Product',
      description: 'Relevance accuracy of search results',
      scale: '% of top-5 results rated relevant by user',
      meter: 'User feedback',
      status: '60%',
      tolerable: '75%',
      goal: '90%',
      valueOfFunction: 'F.ProvideSearch',
    },
  ],
  solutions: [
    {
      id: 'S.ElasticSearch',
      type: 'Solution',
      level: 'Solution',
      description: 'Integrate Elasticsearch with custom ranking algorithm',
      impact: 'V.SearchSpeed ~70%, V.Accuracy ~80%',
      function: 'F.ProvideSearch',
    },
  ],
}

describe('useSpecNarrative', () => {
  describe('initial state', () => {
    it('narrative starts as empty string', () => {
      const { narrative } = useSpecNarrative()
      expect(narrative.value).toBe('')
    })

    it('loading starts false', () => {
      const { loading } = useSpecNarrative()
      expect(loading.value).toBe(false)
    })

    it('error starts as empty string', () => {
      const { error } = useSpecNarrative()
      expect(error.value).toBe('')
    })

    it('copied starts false', () => {
      const { copied } = useSpecNarrative()
      expect(copied.value).toBe(false)
    })
  })

  describe('generateNarrative with mockSpec', () => {
    it('narrative is non-empty string after generation', async () => {
      const { narrative, generateNarrative } = useSpecNarrative()
      await generateNarrative(mockSpec)
      expect(narrative.value.length).toBeGreaterThan(0)
    })

    it('narrative includes at least one function description (lowercased)', async () => {
      const { narrative, generateNarrative } = useSpecNarrative()
      await generateNarrative(mockSpec)
      // "provide full-text search capability across all documents" should appear
      expect(narrative.value.toLowerCase()).toContain('provide full-text search capability')
    })

    it('narrative includes at least one value goal', async () => {
      const { narrative, generateNarrative } = useSpecNarrative()
      await generateNarrative(mockSpec)
      // Should mention one of the goals: 200ms, 70, or 90%
      const hasGoal = narrative.value.includes('200ms') || narrative.value.includes('70') || narrative.value.includes('90%')
      expect(hasGoal).toBe(true)
    })

    it('narrative length is > 100 chars', async () => {
      const { narrative, generateNarrative } = useSpecNarrative()
      await generateNarrative(mockSpec)
      expect(narrative.value.length).toBeGreaterThan(100)
    })

    it('loading is false after completion', async () => {
      const { loading, generateNarrative } = useSpecNarrative()
      await generateNarrative(mockSpec)
      expect(loading.value).toBe(false)
    })
  })

  describe('generateNarrative with emptySpec', () => {
    it('narrative is still non-empty (has the count sentence)', async () => {
      const { narrative, generateNarrative } = useSpecNarrative()
      await generateNarrative(emptySpec)
      expect(narrative.value.length).toBeGreaterThan(0)
    })

    it('empty spec narrative contains the requirements count sentence', async () => {
      const { narrative, generateNarrative } = useSpecNarrative()
      await generateNarrative(emptySpec)
      expect(narrative.value).toContain('0 requirements')
    })
  })
})
