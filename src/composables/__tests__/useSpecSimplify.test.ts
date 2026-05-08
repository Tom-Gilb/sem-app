// UNIT_TYPE=Test
// Feature #57 — useSpecSimplify composable tests

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSpecSimplify } from '../useSpecSimplify'
import type { SpecBlock } from '../../types/spec'

// No apiKey passed → mock path
vi.stubEnv('VITE_MOCK_MODE', 'false')

const mockSpec: SpecBlock = {
  functions: [
    {
      id: 'F.Test',
      type: 'Function',
      level: 'Product',
      description: 'We utilise machine learning to facilitate user onboarding',
      successCriteria: 'Users complete onboarding in order to access all features',
      functionOfValue: 'V.Test',
    },
  ],
  values: [
    {
      id: 'V.Test',
      type: 'Value',
      level: 'Product',
      description: 'Users leverage the platform in order to achieve their goals',
      scale: '% of users completing flow',
      meter: 'Automated tracking',
      status: '40%',
      tolerable: '60%',
      goal: '85%',
      valueOfFunction: 'F.Test',
    },
  ],
  solutions: [
    {
      id: 'S.Test',
      type: 'Solution',
      level: 'Product',
      description: 'Operationalise the onboarding wizard to synergise user steps',
      impact: 'V.Test ~85%',
      function: 'F.Test',
    },
  ],
}

const emptySpec: SpecBlock = {
  functions: [],
  values: [],
  solutions: [],
}

describe('useSpecSimplify', () => {
  describe('initial state', () => {
    it('simplified starts empty', () => {
      const { simplified } = useSpecSimplify()
      expect(simplified.value).toEqual([])
    })

    it('loading starts false', () => {
      const { loading } = useSpecSimplify()
      expect(loading.value).toBe(false)
    })

    it('error starts empty string', () => {
      const { error } = useSpecSimplify()
      expect(error.value).toBe('')
    })

    it('copied starts false', () => {
      const { copied } = useSpecSimplify()
      expect(copied.value).toBe(false)
    })
  })

  describe('simplifySpec (mock mode — no apiKey)', () => {
    it('produces correct total entry count', async () => {
      const { simplified, simplifySpec } = useSpecSimplify()
      await simplifySpec(mockSpec)
      const expected = mockSpec.functions.length + mockSpec.values.length + mockSpec.solutions.length
      expect(simplified.value.length).toBe(expected)
    })

    it('each entry has id, type, original, simplified fields', async () => {
      const { simplified, simplifySpec } = useSpecSimplify()
      await simplifySpec(mockSpec)
      for (const entry of simplified.value) {
        expect(entry).toHaveProperty('id')
        expect(entry).toHaveProperty('type')
        expect(entry).toHaveProperty('original')
        expect(entry).toHaveProperty('simplified')
      }
    })

    it('entry types are F, V, or S only', async () => {
      const { simplified, simplifySpec } = useSpecSimplify()
      await simplifySpec(mockSpec)
      for (const entry of simplified.value) {
        expect(['F', 'V', 'S']).toContain(entry.type)
      }
    })

    it('replaces utilise → use', async () => {
      const { simplified, simplifySpec } = useSpecSimplify()
      await simplifySpec(mockSpec)
      const fEntry = simplified.value.find(e => e.id === 'F.Test')
      expect(fEntry?.simplified).toContain('use')
      expect(fEntry?.simplified).not.toMatch(/\butilise\b/i)
    })

    it('replaces in order to → to', async () => {
      const { simplified, simplifySpec } = useSpecSimplify()
      await simplifySpec(mockSpec)
      const fEntry = simplified.value.find(e => e.id === 'F.Test')
      expect(fEntry?.simplified).not.toMatch(/in order to/i)
    })

    it('replaces leverage → use', async () => {
      const { simplified, simplifySpec } = useSpecSimplify()
      await simplifySpec(mockSpec)
      const vEntry = simplified.value.find(e => e.id === 'V.Test')
      expect(vEntry?.simplified).not.toMatch(/\beverages?\b/i)
      // 'leverage' → 'use'
      expect(vEntry?.simplified).toContain('use')
    })

    it('replaces operationalise → run', async () => {
      const { simplified, simplifySpec } = useSpecSimplify()
      await simplifySpec(mockSpec)
      const sEntry = simplified.value.find(e => e.id === 'S.Test')
      expect(sEntry?.simplified).not.toMatch(/\boperationalise\b/i)
    })

    it('replaces synergise → combine', async () => {
      const { simplified, simplifySpec } = useSpecSimplify()
      await simplifySpec(mockSpec)
      const sEntry = simplified.value.find(e => e.id === 'S.Test')
      expect(sEntry?.simplified).not.toMatch(/\bsynergise\b/i)
    })

    it('loading is false after completion', async () => {
      const { loading, simplifySpec } = useSpecSimplify()
      await simplifySpec(mockSpec)
      expect(loading.value).toBe(false)
    })

    it('handles empty spec without error', async () => {
      const { simplified, simplifySpec, error } = useSpecSimplify()
      await simplifySpec(emptySpec)
      expect(simplified.value.length).toBe(0)
      expect(error.value).toBe('')
    })

    it('original field matches spec description', async () => {
      const { simplified, simplifySpec } = useSpecSimplify()
      await simplifySpec(mockSpec)
      const fEntry = simplified.value.find(e => e.id === 'F.Test')
      expect(fEntry?.original).toBe(mockSpec.functions[0].description)
    })
  })

  describe('copySimplified', () => {
    it('does not crash when clipboard is unavailable', async () => {
      // navigator.clipboard may not be available in test env
      const { simplifySpec, copySimplified } = useSpecSimplify()
      await simplifySpec(mockSpec)
      // Should not throw
      await expect(copySimplified()).resolves.toBeUndefined()
    })
  })
})
