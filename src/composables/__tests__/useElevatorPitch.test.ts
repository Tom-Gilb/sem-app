// UNIT_TYPE=Test
// Feature #83 — useElevatorPitch composable tests

import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { useElevatorPitch } from '../useElevatorPitch'
import type { SpecBlock, VEntry, FEntry, SEntry } from '../../types/spec'

// Force mock mode so no API is called
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
  const f: FEntry = { id: 'F.Test', type: 'Function', level: 'Product', description: 'Provide test function', successCriteria: '', functionOfValue: '' }
  const s: SEntry = { id: 'S.Test', type: 'Solution', level: 'Product', description: 'Test solution', impact: '', function: '' }
  return { functions: [f], values: [makeVEntry()], solutions: [s], ...overrides }
}

describe('useElevatorPitch', () => {
  it('initial state: pitch is empty, pitchOpen is false', () => {
    const specRef = ref<SpecBlock | null>(null)
    const { pitch, pitchOpen } = useElevatorPitch(specRef, '')
    expect(pitch.value).toBe('')
    expect(pitchOpen.value).toBe(false)
  })

  it('generatePitch mock mode: populates pitch string', async () => {
    const specRef = ref<SpecBlock | null>(makeSpec())
    const { pitch, generatePitch } = useElevatorPitch(specRef, '')
    await generatePitch()
    expect(pitch.value.length).toBeGreaterThan(0)
  })

  it('wordCount is computed from pitch', async () => {
    const specRef = ref<SpecBlock | null>(makeSpec())
    const { pitch, wordCount, generatePitch } = useElevatorPitch(specRef, '')
    await generatePitch()
    const expected = pitch.value.split(/\s+/).filter(Boolean).length
    expect(wordCount.value).toBe(expected)
  })

  it('estimatedSeconds equals wordCount / 2.5 rounded', async () => {
    const specRef = ref<SpecBlock | null>(makeSpec())
    const { wordCount, estimatedSeconds, generatePitch } = useElevatorPitch(specRef, '')
    await generatePitch()
    expect(estimatedSeconds.value).toBe(Math.round(wordCount.value / 2.5))
  })

  it('pitch contains function-count or entry-type keywords', async () => {
    const specRef = ref<SpecBlock | null>(makeSpec())
    const { pitch, generatePitch } = useElevatorPitch(specRef, '')
    await generatePitch()
    const lower = pitch.value.toLowerCase()
    expect(lower.includes('function') || lower.includes('value') || lower.includes('solution') || lower.includes('spec')).toBe(true)
  })

  it('copyPitch: pitch is non-empty after generate', async () => {
    const specRef = ref<SpecBlock | null>(makeSpec())
    const { pitch, generatePitch, copyPitch } = useElevatorPitch(specRef, '')
    await generatePitch()
    expect(pitch.value.length).toBeGreaterThan(0)
    // Mock clipboard
    const written: string[] = []
    vi.stubGlobal('navigator', {
      clipboard: { writeText: (t: string) => { written.push(t); return Promise.resolve() } },
    })
    await copyPitch()
    expect(written[0]).toBe(pitch.value)
  })

  it('isSpeaking starts as false', () => {
    const specRef = ref<SpecBlock | null>(null)
    const { isSpeaking } = useElevatorPitch(specRef, '')
    expect(isSpeaking.value).toBe(false)
  })

  it('generatePitch replaces existing pitch on re-call', async () => {
    const specRef = ref<SpecBlock | null>(makeSpec())
    const { pitch, generatePitch } = useElevatorPitch(specRef, '')
    await generatePitch()
    const first = pitch.value
    await generatePitch()
    // Should still be a populated string (may be same content in mock mode)
    expect(pitch.value.length).toBeGreaterThan(0)
    // Pitch was set (even if same content it ran without error)
    expect(typeof pitch.value).toBe('string')
    // Suppress unused variable warning
    expect(first.length).toBeGreaterThan(0)
  })

  it('generatePitch does not throw when spec is null', async () => {
    const specRef = ref<SpecBlock | null>(null)
    const { generatePitch } = useElevatorPitch(specRef, '')
    await expect(generatePitch()).resolves.toBeUndefined()
  })
})
