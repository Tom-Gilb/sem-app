// UNIT_TYPE=Test
// Feature #85 — usePersonaChallenge composable tests

import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { usePersonaChallenge } from '../usePersonaChallenge'
import type { SpecBlock, VEntry, FEntry, SEntry } from '../../types/spec'

vi.stubEnv('VITE_MOCK_MODE', 'true')

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
    valueOfFunction: '',
    ...overrides,
  }
}

function makeSpec(overrides: Partial<SpecBlock> = {}): SpecBlock {
  const f: FEntry = {
    id: 'F.Test',
    type: 'Function',
    level: 'Product',
    description: 'Test function',
    successCriteria: '',
    functionOfValue: '',
  }
  const s: SEntry = {
    id: 'S.Test',
    type: 'Solution',
    level: 'Product',
    description: 'Test solution',
    impact: '',
    function: '',
  }
  return { functions: [f], values: [makeVEntry()], solutions: [s], ...overrides }
}

describe('usePersonaChallenge', () => {
  it('initial state: personaOpen is false', () => {
    const spec = ref<SpecBlock | null>(null)
    const { personaOpen } = usePersonaChallenge(spec, '')
    expect(personaOpen.value).toBe(false)
  })

  it('initial state: result is null', () => {
    const spec = ref<SpecBlock | null>(null)
    const { result } = usePersonaChallenge(spec, '')
    expect(result.value).toBeNull()
  })

  it('selectedPersona defaults to CTO', () => {
    const spec = ref<SpecBlock | null>(null)
    const { selectedPersona } = usePersonaChallenge(spec, '')
    expect(selectedPersona.value).toBe('CTO')
  })

  it('generateChallenge in mock mode produces result with 3 challenges', async () => {
    const spec = ref<SpecBlock | null>(makeSpec())
    const { result, generateChallenge } = usePersonaChallenge(spec, '')
    await generateChallenge()
    expect(result.value).not.toBeNull()
    expect(result.value?.challenges).toHaveLength(3)
  })

  it('changing selectedPersona changes persona in result', async () => {
    const spec = ref<SpecBlock | null>(makeSpec())
    const { result, selectedPersona, generateChallenge } = usePersonaChallenge(spec, '')
    selectedPersona.value = 'Regulator'
    await generateChallenge()
    expect(result.value?.persona).toBe('Regulator')
  })

  it('result emoji is non-empty', async () => {
    const spec = ref<SpecBlock | null>(makeSpec())
    const { result, generateChallenge } = usePersonaChallenge(spec, '')
    await generateChallenge()
    expect(result.value?.emoji).toBeTruthy()
    expect(result.value?.emoji.length).toBeGreaterThan(0)
  })

  it('challenging is false after mock completion', async () => {
    const spec = ref<SpecBlock | null>(makeSpec())
    const { challenging, generateChallenge } = usePersonaChallenge(spec, '')
    await generateChallenge()
    expect(challenging.value).toBe(false)
  })

  it('each challenge is a non-empty string', async () => {
    const spec = ref<SpecBlock | null>(makeSpec())
    const { result, generateChallenge } = usePersonaChallenge(spec, '')
    await generateChallenge()
    for (const challenge of result.value?.challenges ?? []) {
      expect(typeof challenge).toBe('string')
      expect(challenge.length).toBeGreaterThan(0)
    }
  })

  it('copyChallenge markdown contains ## and persona name', async () => {
    const spec = ref<SpecBlock | null>(makeSpec())
    let clipboardText = ''
    vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(async (text) => {
      clipboardText = text
    })
    const { result, generateChallenge, copyChallenge } = usePersonaChallenge(spec, '')
    await generateChallenge()
    copyChallenge()
    expect(clipboardText).toMatch(/^## /)
    expect(clipboardText).toContain(result.value?.displayName)
  })
})
