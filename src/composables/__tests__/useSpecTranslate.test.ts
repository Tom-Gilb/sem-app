// UNIT_TYPE=Test
// Feature #70 — useSpecTranslate composable tests

import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { useSpecTranslate } from '../useSpecTranslate'
import type { SpecBlock } from '../../types/spec'

vi.stubEnv('VITE_MOCK_MODE', 'false')

const mockSpec: SpecBlock = {
  functions: [
    {
      id: 'F.Alpha',
      type: 'Function',
      level: 'Product',
      description: 'Provide user login',
      successCriteria: 'Users can log in',
      functionOfValue: 'V.Alpha',
    },
  ],
  values: [
    {
      id: 'V.Alpha',
      type: 'Value',
      level: 'Product',
      description: 'User login success rate',
      scale: '% successful logins',
      meter: 'Automated tracking',
      status: '70%',
      tolerable: '80%',
      goal: '95%',
      valueOfFunction: 'F.Alpha',
    },
  ],
  solutions: [
    {
      id: 'S.Alpha',
      type: 'Solution',
      level: 'Product',
      description: 'Implement OAuth2 flow',
      impact: 'V.Alpha ~95%',
      function: 'F.Alpha',
    },
  ],
}

const emptySpec: SpecBlock = { functions: [], values: [], solutions: [] }

describe('useSpecTranslate', () => {
  it('initial state: targetLanguage=fr, translating=false, entries empty, open=false', () => {
    const specRef = ref<SpecBlock | null>(null)
    const { targetLanguage, translating, translatedEntries, translateOpen } = useSpecTranslate(specRef, '')
    expect(targetLanguage.value).toBe('fr')
    expect(translating.value).toBe(false)
    expect(translatedEntries.value).toEqual([])
    expect(translateOpen.value).toBe(false)
  })

  it('translateSpec mock mode produces translatedEntries for all F/V/S', async () => {
    const specRef = ref<SpecBlock | null>(mockSpec)
    const { translatedEntries, translateSpec } = useSpecTranslate(specRef, '')
    await translateSpec()
    expect(translatedEntries.value.length).toBe(3)
  })

  it('mock entries have id, type, originalDescription, translatedDescription', async () => {
    const specRef = ref<SpecBlock | null>(mockSpec)
    const { translatedEntries, translateSpec } = useSpecTranslate(specRef, '')
    await translateSpec()
    for (const entry of translatedEntries.value) {
      expect(entry).toHaveProperty('id')
      expect(entry).toHaveProperty('type')
      expect(entry).toHaveProperty('originalDescription')
      expect(entry).toHaveProperty('translatedDescription')
    }
  })

  it('targetLanguage=fr uses [FR] prefix in mock mode', async () => {
    const specRef = ref<SpecBlock | null>(mockSpec)
    const { targetLanguage, translatedEntries, translateSpec } = useSpecTranslate(specRef, '')
    targetLanguage.value = 'fr'
    await translateSpec()
    expect(translatedEntries.value[0].translatedDescription).toContain('[FR]')
  })

  it('targetLanguage=de uses [DE] prefix in mock mode', async () => {
    const specRef = ref<SpecBlock | null>(mockSpec)
    const { targetLanguage, translatedEntries, translateSpec } = useSpecTranslate(specRef, '')
    targetLanguage.value = 'de'
    await translateSpec()
    expect(translatedEntries.value[0].translatedDescription).toContain('[DE]')
  })

  it('targetLanguage=ja uses [JA] prefix in mock mode', async () => {
    const specRef = ref<SpecBlock | null>(mockSpec)
    const { targetLanguage, translatedEntries, translateSpec } = useSpecTranslate(specRef, '')
    targetLanguage.value = 'ja'
    await translateSpec()
    expect(translatedEntries.value[0].translatedDescription).toContain('[JA]')
  })

  it('translating is true during async and false after', async () => {
    const specRef = ref<SpecBlock | null>(mockSpec)
    const { translating, translateSpec } = useSpecTranslate(specRef, '')
    const promise = translateSpec()
    expect(translating.value).toBe(true)
    await promise
    expect(translating.value).toBe(false)
  })

  it('clearTranslation empties translatedEntries', async () => {
    const specRef = ref<SpecBlock | null>(mockSpec)
    const { translatedEntries, translateSpec, clearTranslation } = useSpecTranslate(specRef, '')
    await translateSpec()
    expect(translatedEntries.value.length).toBeGreaterThan(0)
    clearTranslation()
    expect(translatedEntries.value).toEqual([])
  })

  it('copyTranslation markdown includes language header', async () => {
    const writes: string[] = []
    Object.defineProperty(globalThis, 'navigator', {
      value: { clipboard: { writeText: (t: string) => { writes.push(t); return Promise.resolve() } } },
      configurable: true,
    })
    const specRef = ref<SpecBlock | null>(mockSpec)
    const { targetLanguage, translateSpec, copyTranslation } = useSpecTranslate(specRef, '')
    targetLanguage.value = 'fr'
    await translateSpec()
    copyTranslation()
    expect(writes[0]).toContain('## Translated Spec (FR)')
  })

  it('empty spec produces empty translatedEntries', async () => {
    const specRef = ref<SpecBlock | null>(emptySpec)
    const { translatedEntries, translateSpec } = useSpecTranslate(specRef, '')
    await translateSpec()
    expect(translatedEntries.value).toEqual([])
  })

  it('null spec produces empty translatedEntries', async () => {
    const specRef = ref<SpecBlock | null>(null)
    const { translatedEntries, translateSpec } = useSpecTranslate(specRef, '')
    await translateSpec()
    expect(translatedEntries.value).toEqual([])
  })
})
