// UNIT_TYPE=Test
// Feature #81 — useDebateMode composable tests

import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { useDebateMode } from '../useDebateMode'
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

function makeSpec(): SpecBlock {
  const f: FEntry = { id: 'F.Test', type: 'Function', level: 'Product', description: 'Provide test', successCriteria: '', functionOfValue: '' }
  const s: SEntry = { id: 'S.Test', type: 'Solution', level: 'Product', description: 'Test solution', impact: '', function: '' }
  return { functions: [f], values: [makeVEntry()], solutions: [s] }
}

describe('useDebateMode', () => {
  it('initial state: turns empty, debateOpen false', () => {
    const specRef = ref<SpecBlock | null>(null)
    const { turns, debateOpen } = useDebateMode(specRef, '')
    expect(turns.value).toHaveLength(0)
    expect(debateOpen.value).toBe(false)
  })

  it('generateDebate mock mode: produces 6 turns', async () => {
    const specRef = ref<SpecBlock | null>(makeSpec())
    const { turns, generateDebate } = useDebateMode(specRef, '')
    await generateDebate()
    expect(turns.value).toHaveLength(6)
  })

  it('all 3 rounds present in output', async () => {
    const specRef = ref<SpecBlock | null>(makeSpec())
    const { turns, generateDebate } = useDebateMode(specRef, '')
    await generateDebate()
    const rounds = new Set(turns.value.map(t => t.round))
    expect(rounds.has(1)).toBe(true)
    expect(rounds.has(2)).toBe(true)
    expect(rounds.has(3)).toBe(true)
  })

  it('both personas present', async () => {
    const specRef = ref<SpecBlock | null>(makeSpec())
    const { turns, generateDebate } = useDebateMode(specRef, '')
    await generateDebate()
    const personas = new Set(turns.value.map(t => t.persona))
    expect(personas.has('Optimist')).toBe(true)
    expect(personas.has('Critic')).toBe(true)
  })

  it('Optimist severity is always low', async () => {
    const specRef = ref<SpecBlock | null>(makeSpec())
    const { turns, generateDebate } = useDebateMode(specRef, '')
    await generateDebate()
    const optimistTurns = turns.value.filter(t => t.persona === 'Optimist')
    expect(optimistTurns.length).toBeGreaterThan(0)
    expect(optimistTurns.every(t => t.severity === 'low')).toBe(true)
  })

  it('Critic has at least one medium or high severity turn', async () => {
    const specRef = ref<SpecBlock | null>(makeSpec())
    const { turns, generateDebate } = useDebateMode(specRef, '')
    await generateDebate()
    const criticTurns = turns.value.filter(t => t.persona === 'Critic')
    expect(criticTurns.some(t => t.severity === 'medium' || t.severity === 'high')).toBe(true)
  })

  it('clearDebate empties turns', async () => {
    const specRef = ref<SpecBlock | null>(makeSpec())
    const { turns, generateDebate, clearDebate } = useDebateMode(specRef, '')
    await generateDebate()
    expect(turns.value.length).toBeGreaterThan(0)
    clearDebate()
    expect(turns.value).toHaveLength(0)
  })

  it('copyTranscript markdown contains "## Spec Debate"', async () => {
    const specRef = ref<SpecBlock | null>(makeSpec())
    const { turns, generateDebate, copyTranscript } = useDebateMode(specRef, '')
    await generateDebate()
    expect(turns.value.length).toBeGreaterThan(0)
    // Mock clipboard
    const written: string[] = []
    vi.stubGlobal('navigator', {
      clipboard: { writeText: (t: string) => { written.push(t); return Promise.resolve() } },
    })
    await copyTranscript()
    expect(written[0]).toContain('## Spec Debate')
  })
})
