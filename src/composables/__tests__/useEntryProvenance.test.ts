// Tests for useEntryProvenance — Phase 1: Sources of Specs
// Covers: countWords, recordProvenanceEvent, getProvenance, getAllProvenance,
//         computeMainSource, initEntriesFromSpec, recordSharpenProvenance, recordEditProvenance

import { describe, it, expect, beforeEach } from 'vitest'
import {
  countWords,
  recordProvenanceEvent,
  getProvenance,
  getAllProvenance,
  computeMainSource,
  initEntriesFromSpec,
  recordSharpenProvenance,
  recordEditProvenance,
} from '../useEntryProvenance'
import type { EntryProvenanceEvent } from '../useEntryProvenance'
import type { SpecBlock } from '../../types/spec'

// ── Fixtures ───────────────────────────────────────────────────────────────────

const PLAN_ID = 'plan-test-001'
const ENTRY_ID = 'F.TestEntry'

const MOCK_SPEC: SpecBlock = {
  functions: [
    {
      id: 'F.ActivationRate',
      type: 'Function',
      level: 'Product',
      description: 'Enable user activation tracking across onboarding flow',
      successCriteria: 'Activation rate is tracked',
      functionOfValue: 'V.ActivationRate',
    },
  ],
  values: [
    {
      id: 'V.ActivationRate',
      type: 'Value',
      level: 'Product',
      description: 'User activation rate within seven days of signup',
      scale: 'Activation rate (%)',
      meter: 'Measured via product analytics weekly',
      status: 'pre-build',
      tolerable: '40%',
      goal: '60%',
      valueOfFunction: 'F.ActivationRate',
      wishStakeholder: 'Product team',
    },
  ],
  solutions: [
    {
      id: 'S.OnboardingFlow',
      type: 'Solution',
      level: 'Product',
      description: 'Build an onboarding flow with step-by-step guidance',
      impact: 'V.ActivationRate ~60%',
      function: 'F.ActivationRate',
    },
  ],
}

const SHARPENED_SPEC: SpecBlock = {
  functions: [
    {
      id: 'F.ActivationRate',
      type: 'Function',
      level: 'Product',
      description: 'Enable user activation tracking across the full onboarding flow including mobile',
      successCriteria: 'Activation rate is tracked across all channels',
      functionOfValue: 'V.ActivationRate',
    },
  ],
  values: [
    {
      id: 'V.ActivationRate',
      type: 'Value',
      level: 'Product',
      description: 'User activation rate within seven days of signup',  // unchanged
      scale: 'Activation rate (%)',
      meter: 'Measured via product analytics weekly',
      status: 'pre-build',
      tolerable: '45%',
      goal: '65%',
      valueOfFunction: 'F.ActivationRate',
      wishStakeholder: 'Product team',
    },
  ],
  solutions: [
    {
      id: 'S.OnboardingFlow',
      type: 'Solution',
      level: 'Product',
      description: 'Build a multi-platform onboarding flow with step-by-step guidance and push notifications',
      impact: 'V.ActivationRate ~65%',
      function: 'F.ActivationRate',
    },
  ],
}

function makeEvent(overrides: Partial<EntryProvenanceEvent> = {}): EntryProvenanceEvent {
  return {
    at:              new Date().toISOString(),
    actor:           'ai',
    changeType:      'generate',
    wordsBefore:     0,
    wordsAfter:      10,
    humanInputWords: 5,
    ...overrides,
  }
}

beforeEach(() => {
  // Clear localStorage between tests so state doesn't bleed
  localStorage.clear()
})

// ── countWords ─────────────────────────────────────────────────────────────────

describe('countWords', () => {
  it('counts words in a normal sentence', () => {
    expect(countWords('Enable user activation tracking')).toBe(4)
  })

  it('returns 0 for empty string', () => {
    expect(countWords('')).toBe(0)
  })

  it('returns 0 for undefined', () => {
    expect(countWords(undefined)).toBe(0)
  })

  it('returns 0 for null', () => {
    expect(countWords(null)).toBe(0)
  })

  it('handles extra whitespace', () => {
    expect(countWords('  hello   world  ')).toBe(2)
  })

  it('counts a single word', () => {
    expect(countWords('activation')).toBe(1)
  })
})

// ── recordProvenanceEvent / getProvenance ──────────────────────────────────────

describe('recordProvenanceEvent', () => {
  it('creates a new record when none exists', () => {
    const event = makeEvent({ actor: 'ai', changeType: 'generate', wordsAfter: 8, humanInputWords: 12 })
    recordProvenanceEvent(PLAN_ID, ENTRY_ID, event)

    const p = getProvenance(PLAN_ID, ENTRY_ID)
    expect(p).not.toBeNull()
    expect(p!.entryId).toBe(ENTRY_ID)
    expect(p!.planModelId).toBe(PLAN_ID)
    expect(p!.aiChanges).toBe(1)
    expect(p!.humanChanges).toBe(0)
    expect(p!.appChanges).toBe(0)
    expect(p!.events).toHaveLength(1)
  })

  it('appends to an existing record', () => {
    recordProvenanceEvent(PLAN_ID, ENTRY_ID, makeEvent({ actor: 'ai' }))
    recordProvenanceEvent(PLAN_ID, ENTRY_ID, makeEvent({ actor: 'human', changeType: 'edit' }))

    const p = getProvenance(PLAN_ID, ENTRY_ID)!
    expect(p.events).toHaveLength(2)
    expect(p.aiChanges).toBe(1)
    expect(p.humanChanges).toBe(1)
  })

  it('tracks lastChangedAt correctly', () => {
    const early = new Date('2026-01-01T10:00:00.000Z').toISOString()
    const late  = new Date('2026-01-02T10:00:00.000Z').toISOString()
    recordProvenanceEvent(PLAN_ID, ENTRY_ID, makeEvent({ at: early }))
    recordProvenanceEvent(PLAN_ID, ENTRY_ID, makeEvent({ at: late  }))

    const p = getProvenance(PLAN_ID, ENTRY_ID)!
    expect(p.firstSeenAt).toBe(early)
    expect(p.lastChangedAt).toBe(late)
  })

  it('increments the correct actor counter', () => {
    recordProvenanceEvent(PLAN_ID, ENTRY_ID, makeEvent({ actor: 'app', changeType: 'import' }))
    const p = getProvenance(PLAN_ID, ENTRY_ID)!
    expect(p.appChanges).toBe(1)
    expect(p.aiChanges).toBe(0)
    expect(p.humanChanges).toBe(0)
  })

  it('persists across load cycles (simulates page refresh)', () => {
    recordProvenanceEvent(PLAN_ID, ENTRY_ID, makeEvent())
    // A second call to getProvenance re-reads from localStorage
    const p1 = getProvenance(PLAN_ID, ENTRY_ID)
    const p2 = getProvenance(PLAN_ID, ENTRY_ID)
    expect(p1).toEqual(p2)
  })

  it('returns null when no record exists', () => {
    expect(getProvenance(PLAN_ID, 'F.NonExistent')).toBeNull()
  })

  it('does not cross-contaminate different plan IDs', () => {
    recordProvenanceEvent('plan-a', ENTRY_ID, makeEvent())
    expect(getProvenance('plan-b', ENTRY_ID)).toBeNull()
  })
})

// ── getAllProvenance ────────────────────────────────────────────────────────────

describe('getAllProvenance', () => {
  it('returns all records for a plan', () => {
    recordProvenanceEvent(PLAN_ID, 'F.Alpha', makeEvent())
    recordProvenanceEvent(PLAN_ID, 'V.Beta',  makeEvent())
    const all = getAllProvenance(PLAN_ID)
    expect(Object.keys(all)).toHaveLength(2)
    expect(all['F.Alpha']).toBeDefined()
    expect(all['V.Beta']).toBeDefined()
  })

  it('returns empty object when plan has no records', () => {
    expect(getAllProvenance('plan-unknown')).toEqual({})
  })
})

// ── computeMainSource ─────────────────────────────────────────────────────────

describe('computeMainSource', () => {
  it('returns Unknown for null input', () => {
    expect(computeMainSource(null)).toBe('Unknown')
  })

  it('returns Unknown for empty events array', () => {
    recordProvenanceEvent(PLAN_ID, ENTRY_ID, makeEvent())
    const p = getProvenance(PLAN_ID, ENTRY_ID)!
    // Manually clear events for test (simulate missing data edge case)
    const fakeEmpty = { ...p, events: [], humanChanges: 0, aiChanges: 0, appChanges: 0 }
    expect(computeMainSource(fakeEmpty)).toBe('Unknown')
  })

  it('returns AI draft for generate-only events', () => {
    recordProvenanceEvent(PLAN_ID, ENTRY_ID, makeEvent({ actor: 'ai', changeType: 'generate' }))
    expect(computeMainSource(getProvenance(PLAN_ID, ENTRY_ID))).toBe('AI draft')
  })

  it('returns AI sharpened when sharpen events exist but no human edit', () => {
    recordProvenanceEvent(PLAN_ID, ENTRY_ID, makeEvent({ actor: 'ai', changeType: 'generate' }))
    recordProvenanceEvent(PLAN_ID, ENTRY_ID, makeEvent({ actor: 'ai', changeType: 'sharpen' }))
    expect(computeMainSource(getProvenance(PLAN_ID, ENTRY_ID))).toBe('AI sharpened')
  })

  it('returns Human edited when at least one human edit exists', () => {
    recordProvenanceEvent(PLAN_ID, ENTRY_ID, makeEvent({ actor: 'ai', changeType: 'generate' }))
    recordProvenanceEvent(PLAN_ID, ENTRY_ID, makeEvent({ actor: 'human', changeType: 'edit' }))
    expect(computeMainSource(getProvenance(PLAN_ID, ENTRY_ID))).toBe('Human edited')
  })

  it('returns Imported for import-only single event', () => {
    recordProvenanceEvent(PLAN_ID, ENTRY_ID, makeEvent({ actor: 'app', changeType: 'import' }))
    expect(computeMainSource(getProvenance(PLAN_ID, ENTRY_ID))).toBe('Imported')
  })

  it('returns AI draft when multiple generate events exist (no sharpen/edit)', () => {
    recordProvenanceEvent(PLAN_ID, ENTRY_ID, makeEvent({ actor: 'ai', changeType: 'generate' }))
    recordProvenanceEvent(PLAN_ID, ENTRY_ID, makeEvent({ actor: 'ai', changeType: 'generate' }))
    expect(computeMainSource(getProvenance(PLAN_ID, ENTRY_ID))).toBe('AI draft')
  })
})

// ── initEntriesFromSpec ────────────────────────────────────────────────────────

describe('initEntriesFromSpec', () => {
  it('creates provenance records for all F/V/S entries', () => {
    initEntriesFromSpec(PLAN_ID, MOCK_SPEC, {
      actor:           'ai',
      changeType:      'generate',
      humanInputWords: 20,
    })
    const all = getAllProvenance(PLAN_ID)
    expect(Object.keys(all)).toHaveLength(3)
    expect(all['F.ActivationRate']).toBeDefined()
    expect(all['V.ActivationRate']).toBeDefined()
    expect(all['S.OnboardingFlow']).toBeDefined()
  })

  it('sets wordsBefore to 0 for all entries (new entries)', () => {
    initEntriesFromSpec(PLAN_ID, MOCK_SPEC, {
      actor: 'ai', changeType: 'generate', humanInputWords: 10,
    })
    const p = getProvenance(PLAN_ID, 'F.ActivationRate')!
    expect(p.events[0].wordsBefore).toBe(0)
  })

  it('sets wordsAfter to description word count', () => {
    initEntriesFromSpec(PLAN_ID, MOCK_SPEC, {
      actor: 'ai', changeType: 'generate', humanInputWords: 10,
    })
    const p = getProvenance(PLAN_ID, 'F.ActivationRate')!
    const expectedWords = countWords(MOCK_SPEC.functions[0].description)
    expect(p.events[0].wordsAfter).toBe(expectedWords)
  })

  it('sets humanInputWords on every event', () => {
    initEntriesFromSpec(PLAN_ID, MOCK_SPEC, {
      actor: 'app', changeType: 'import', humanInputWords: 0,
    })
    const all = getAllProvenance(PLAN_ID)
    for (const p of Object.values(all)) {
      expect(p.events[0].humanInputWords).toBe(0)
    }
  })

  it('appends events if called twice (re-import or re-generate)', () => {
    initEntriesFromSpec(PLAN_ID, MOCK_SPEC, { actor: 'ai', changeType: 'generate', humanInputWords: 5 })
    initEntriesFromSpec(PLAN_ID, MOCK_SPEC, { actor: 'app', changeType: 'import', humanInputWords: 0 })
    const p = getProvenance(PLAN_ID, 'F.ActivationRate')!
    expect(p.events).toHaveLength(2)
    expect(p.events[1].changeType).toBe('import')
  })
})

// ── recordSharpenProvenance ────────────────────────────────────────────────────

describe('recordSharpenProvenance', () => {
  it('records events only for entries whose description changed', () => {
    // Pre-seed with generate events
    initEntriesFromSpec(PLAN_ID, MOCK_SPEC, { actor: 'ai', changeType: 'generate', humanInputWords: 10 })

    recordSharpenProvenance(PLAN_ID, MOCK_SPEC, SHARPENED_SPEC, {
      humanInputWords: 30,
      label: 'Finance',
    })

    // F.ActivationRate changed
    const fP = getProvenance(PLAN_ID, 'F.ActivationRate')!
    expect(fP.events).toHaveLength(2)
    expect(fP.events[1].changeType).toBe('sharpen')
    expect(fP.events[1].actor).toBe('ai')
    expect(fP.events[1].label).toBe('Finance')

    // V.ActivationRate did NOT change (description identical)
    const vP = getProvenance(PLAN_ID, 'V.ActivationRate')!
    expect(vP.events).toHaveLength(1)  // only the generate event
    expect(vP.events[0].changeType).toBe('generate')

    // S.OnboardingFlow changed
    const sP = getProvenance(PLAN_ID, 'S.OnboardingFlow')!
    expect(sP.events).toHaveLength(2)
    expect(sP.events[1].changeType).toBe('sharpen')
  })

  it('records new entries added during sharpening with wordsBefore = 0', () => {
    const specWithNewEntry: SpecBlock = {
      ...MOCK_SPEC,
      solutions: [
        ...MOCK_SPEC.solutions,
        {
          id: 'S.NewEntry',
          type: 'Solution',
          level: 'Product',
          description: 'Brand new solution added by sharpen round',
          impact: 'V.ActivationRate ~70%',
          function: 'F.ActivationRate',
        },
      ],
    }
    initEntriesFromSpec(PLAN_ID, MOCK_SPEC, { actor: 'ai', changeType: 'generate', humanInputWords: 10 })
    recordSharpenProvenance(PLAN_ID, MOCK_SPEC, specWithNewEntry, { humanInputWords: 15 })

    const p = getProvenance(PLAN_ID, 'S.NewEntry')!
    expect(p).not.toBeNull()
    expect(p.events[0].wordsBefore).toBe(0)
    expect(p.events[0].changeType).toBe('sharpen')
  })

  it('correctly sets wordsBefore and wordsAfter for modified entries', () => {
    initEntriesFromSpec(PLAN_ID, MOCK_SPEC, { actor: 'ai', changeType: 'generate', humanInputWords: 10 })
    recordSharpenProvenance(PLAN_ID, MOCK_SPEC, SHARPENED_SPEC, { humanInputWords: 20 })

    const p = getProvenance(PLAN_ID, 'F.ActivationRate')!
    const sharpenEvent = p.events[1]
    expect(sharpenEvent.wordsBefore).toBe(countWords(MOCK_SPEC.functions[0].description))
    expect(sharpenEvent.wordsAfter).toBe(countWords(SHARPENED_SPEC.functions[0].description))
  })

  it('sets humanInputWords on all sharpen events', () => {
    initEntriesFromSpec(PLAN_ID, MOCK_SPEC, { actor: 'ai', changeType: 'generate', humanInputWords: 10 })
    recordSharpenProvenance(PLAN_ID, MOCK_SPEC, SHARPENED_SPEC, { humanInputWords: 42 })

    const p = getProvenance(PLAN_ID, 'F.ActivationRate')!
    expect(p.events[1].humanInputWords).toBe(42)
  })
})

// ── recordEditProvenance ───────────────────────────────────────────────────────

describe('recordEditProvenance', () => {
  it('records a human edit event for each changed entry ID', () => {
    initEntriesFromSpec(PLAN_ID, MOCK_SPEC, { actor: 'ai', changeType: 'generate', humanInputWords: 10 })

    const editedSpec: SpecBlock = {
      ...MOCK_SPEC,
      functions: [
        {
          ...MOCK_SPEC.functions[0],
          description: 'Enable fast user activation tracking with analytics',
        },
      ],
    }

    recordEditProvenance(PLAN_ID, ['F.ActivationRate'], editedSpec, MOCK_SPEC)

    const p = getProvenance(PLAN_ID, 'F.ActivationRate')!
    expect(p.humanChanges).toBe(1)
    const editEvent = p.events[1]
    expect(editEvent.actor).toBe('human')
    expect(editEvent.changeType).toBe('edit')
    expect(editEvent.wordsBefore).toBe(countWords(MOCK_SPEC.functions[0].description))
    expect(editEvent.wordsAfter).toBe(countWords(editedSpec.functions[0].description))
  })

  it('sets humanInputWords equal to wordsAfter for human edits', () => {
    initEntriesFromSpec(PLAN_ID, MOCK_SPEC, { actor: 'ai', changeType: 'generate', humanInputWords: 10 })
    const editedSpec: SpecBlock = {
      ...MOCK_SPEC,
      functions: [{ ...MOCK_SPEC.functions[0], description: 'Short human edit of just five words here' }],
    }
    recordEditProvenance(PLAN_ID, ['F.ActivationRate'], editedSpec, MOCK_SPEC)
    const p = getProvenance(PLAN_ID, 'F.ActivationRate')!
    const editEvent = p.events[1]
    expect(editEvent.humanInputWords).toBe(editEvent.wordsAfter)
  })

  it('handles an empty changedIds array gracefully', () => {
    initEntriesFromSpec(PLAN_ID, MOCK_SPEC, { actor: 'ai', changeType: 'generate', humanInputWords: 10 })
    // Should not throw and should not add events
    expect(() => {
      recordEditProvenance(PLAN_ID, [], MOCK_SPEC, MOCK_SPEC)
    }).not.toThrow()
    const p = getProvenance(PLAN_ID, 'F.ActivationRate')!
    expect(p.events).toHaveLength(1)  // only the generate event, no edit added
  })
})
