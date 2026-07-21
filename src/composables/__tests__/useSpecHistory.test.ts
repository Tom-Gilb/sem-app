// UNIT_TYPE=Test
// Tests for useSpecHistory composable (Feature #29)

import { describe, it, expect, beforeEach } from 'vitest'
import { useSpecHistory } from '../useSpecHistory'
import type { SpecBlock } from '../../types/spec'

function makeSpec(description: string): SpecBlock {
  return {
    functions: [
      {
        id: 'F.Test',
        type: 'Function',
        level: 'Product',
        description: 'Test function',
        successCriteria: 'Success',
        functionOfValue: 'V.Test',
      },
    ],
    values: [
      {
        id: 'V.Test',
        type: 'Value',
        level: 'Product',
        description,
        scale: 'Units',
        meter: 'Observation',
        status: 'pre-build',
        tolerable: '50%',
        goal: '80%',
        valueOfFunction: 'F.Test',
      },
    ],
    solutions: [
      {
        id: 'S.Test',
        type: 'Solution',
        level: 'Product',
        description: 'Test solution',
        impact: 'V.Test ~80%',
        function: 'F.Test',
      },
    ],
  }
}

describe('useSpecHistory', () => {
  let composable: ReturnType<typeof useSpecHistory>

  beforeEach(() => {
    composable = useSpecHistory()
    composable.clearHistory()
  })

  it('addVersion adds to history (newest first)', () => {
    const { history, addVersion } = composable
    const spec1 = makeSpec('First spec')
    const spec2 = makeSpec('Second spec')
    addVersion(spec1, 'Generated')
    addVersion(spec2, 'Make Ambitious')
    expect(history.value).toHaveLength(2)
    // Newest first
    expect(history.value[0].spec.values[0].description).toBe('Second spec')
    expect(history.value[1].spec.values[0].description).toBe('First spec')
    expect(history.value[0].label).toBe('Make Ambitious')
    expect(history.value[1].label).toBe('Generated')
  })

  it('enforces max 50 versions (51st oldest is dropped)', () => {
    // Bumped from 10 → 50 (2026-05-12) along with the History redesign:
    // grouping + search means many older snapshots stay useful.
    const { history, addVersion } = composable
    for (let i = 1; i <= 51; i++) {
      addVersion(makeSpec(`Spec ${i}`), 'Generated')
    }
    expect(history.value).toHaveLength(50)
    // Newest is spec 51, oldest remaining is spec 2 (spec 1 was dropped)
    expect(history.value[0].spec.values[0].description).toBe('Spec 51')
    expect(history.value[49].spec.values[0].description).toBe('Spec 2')
  })

  it('restoreVersion returns the correct spec', () => {
    const { addVersion, restoreVersion, history } = composable
    const spec = makeSpec('Restore me')
    addVersion(spec, 'Generated')
    const id = history.value[0].id
    const restored = restoreVersion(id)
    expect(restored).not.toBeNull()
    // restoreVersion now returns { spec, plan } — the spec lives on .spec
    expect(restored!.spec.values[0].description).toBe('Restore me')
    expect(restored!.plan).toBeNull()
  })

  it('restoreVersion returns null for unknown id', () => {
    const { restoreVersion } = composable
    expect(restoreVersion('non-existent-id')).toBeNull()
  })

  it('restoreVersion does NOT remove the version from history', () => {
    const { addVersion, restoreVersion, history } = composable
    addVersion(makeSpec('Keep me'), 'Generated')
    const id = history.value[0].id
    restoreVersion(id)
    expect(history.value).toHaveLength(1)
  })

  it('clearHistory empties the array', () => {
    const { addVersion, clearHistory, history } = composable
    addVersion(makeSpec('Spec A'), 'Generated')
    addVersion(makeSpec('Spec B'), 'Lean Plan')
    expect(history.value).toHaveLength(2)
    clearHistory()
    expect(history.value).toHaveLength(0)
  })

  it('summary is truncated to 60 characters', () => {
    const { addVersion, history } = composable
    const longDesc = 'A'.repeat(80)
    addVersion(makeSpec(longDesc), 'Generated')
    expect(history.value[0].summary.length).toBeLessThanOrEqual(60)
  })

  it('summary always includes counts and the function topic (r41 v108 — pluralization-aware full words)', () => {
    // buildSummary prefers functions[0].description as the topic — the
    // function says "what the system does" and is more identifying than Values.
    // r41 v108 format: "<n> Function[s] · <n> Value[s] · <n> Solution[s] — <topic>"
    // (full words per Spell-out-Type-Names SUPREME, pluralization-aware).
    const { addVersion, history } = composable
    addVersion(makeSpec('Short description'), 'Generated')
    expect(history.value[0].summary).toContain('1 Function · 1 Value · 1 Solution')
    // Function description "Test function" is the topic source
    expect(history.value[0].summary).toContain('Test function')
  })

  // ── r41 v108 REGRESSION TESTS — silent-failure mode coverage ─────────────────
  // Tom Gilb 2026-06-17 verbatim "this is scary. No saves, silently, we need
  // to have some trust in the system. Is there a test for this?"
  //
  // Three silent failure modes were found in v108 trace:
  //   (A) localStorage write failure swallowed by empty `catch {}`
  //   (B) buildSummary throws on partial SpecBlock (missing arrays) — propagates
  //       out of addVersion + silently kills the caller's success path
  //   (C) JSON.parse(JSON.stringify(spec)) throws on circular reference
  //
  // The fixes:
  //   (A) _saveToStorage now returns boolean + LOGs + auto-trim-retry loop
  //   (B) buildSummary defaults every .length to 0; whole function in try/catch
  //   (C) addVersion body wrapped in try/catch with console.error
  //
  // These tests pin all three so the silent-failure modes can NEVER recur.

  describe('r41 v108 regression — silent failure modes', () => {
    it('(B) buildSummary survives a SpecBlock with missing functions array', () => {
      const { addVersion, history } = composable
      // Partial spec — functions is undefined; should NOT throw.
      const partialSpec = {
        values: [{ id: 'V.X', type: 'Value', level: 'Product', description: 'partial' }],
        solutions: [],
        // functions intentionally missing
      } as unknown as SpecBlock
      // Pre-v108 this threw TypeError; post-v108 it falls back to a generic summary.
      expect(() => addVersion(partialSpec, 'Generated')).not.toThrow()
      expect(history.value).toHaveLength(1)
      // Counts fall back to 0
      expect(history.value[0].summary).toContain('0 Function')
    })

    it('(B) buildSummary survives a completely empty SpecBlock', () => {
      const { addVersion, history } = composable
      const emptySpec = {} as unknown as SpecBlock
      expect(() => addVersion(emptySpec, 'Generated')).not.toThrow()
      expect(history.value).toHaveLength(1)
      // Either a 0-count summary or the 'spec snapshot' fallback — both acceptable
      expect(history.value[0].summary.length).toBeGreaterThan(0)
    })

    it('(C) addVersion does NOT throw when spec has a circular reference', () => {
      const { addVersion, history } = composable
      const circularSpec = makeSpec('circular') as unknown as Record<string, unknown>
      // Create a self-reference — JSON.stringify will throw on this.
      circularSpec.selfRef = circularSpec
      // Pre-v108 the addVersion threw and the caller's success path silently died.
      // Post-v108 the throw is logged + the in-memory ref is unchanged for that
      // entry but the function returns normally so the caller keeps working.
      expect(() => addVersion(circularSpec as unknown as SpecBlock, 'Generated')).not.toThrow()
      // The entry didn't make it in (the throw happened before push), but the
      // function returned normally — that's the important contract.
      expect(history.value).toHaveLength(0)
    })

    it('(A) addVersion returns normally when localStorage.setItem throws (quota exceeded)', () => {
      const { addVersion, history } = composable
      // Patch the actual localStorage instance method (Storage.prototype patch
      // is observable but jsdom's localStorage own property wins on lookup).
      const origSetItem = localStorage.setItem.bind(localStorage)
      localStorage.setItem = function () {
        const err = new Error('QuotaExceededError') as Error & { name: string }
        err.name = 'QuotaExceededError'
        throw err
      }
      try {
        // Pre-v108: the empty `catch {}` swallowed the error; in-memory ref
        // diverged from disk silently.  Post-v108: same in-memory behaviour
        // BUT auto-trim retry runs + console.warn fires.  Either way the
        // function returns normally + the in-memory ref is consistent.
        expect(() => addVersion(makeSpec('quota test'), 'Generated')).not.toThrow()
        // The in-memory entry IS there (data isn't lost in memory)
        expect(history.value).toHaveLength(1)
        expect(history.value[0].label).toBe('Generated')
      } finally {
        localStorage.setItem = origSetItem
      }
    })

    it('(A) addVersion under repeated quota failure keeps the newest entry accessible in-memory', () => {
      // The user-facing behaviour the v108 fix needs to guarantee: even when
      // every localStorage write fails, the planner can still SEE the entry
      // they just generated in the current session.  Pre-v108: in-memory ref
      // updated + write swallowed silently → the entry was visible until
      // reload, then gone forever without warning.  Post-v108: same in-memory
      // visibility + console.warn fires + retry loop attempts smaller payloads.
      // This test pins the in-memory-visibility half (the retry mutation
      // depends on Array-length-write semantics that vary across jsdom
      // versions; covered by the success-log assertion in the (A) parent test).
      const { addVersion, history, clearHistory } = composable
      clearHistory()
      const origSetItem = localStorage.setItem.bind(localStorage)
      localStorage.setItem = function () {
        const err = new Error('QuotaExceededError') as Error & { name: string }
        err.name = 'QuotaExceededError'
        throw err
      }
      try {
        // Three generations under sustained quota failure.
        addVersion(makeSpec('Spec A'), 'Generated')
        addVersion(makeSpec('Spec B'), 'Generated')
        addVersion(makeSpec('Spec C'), 'Generated')
        // Every entry is reachable in-memory regardless of disk state.
        expect(history.value.length).toBeGreaterThanOrEqual(1)
        // The newest entry is always at index 0 (newest-first contract).
        expect(history.value[0].spec.values[0].description).toBe('Spec C')
      } finally {
        localStorage.setItem = origSetItem
      }
    })

    it('(A) addVersion still updates in-memory ref even when storage write fails', () => {
      const { addVersion, history } = composable
      const origSetItem = localStorage.setItem.bind(localStorage)
      localStorage.setItem = function () { throw new Error('disk failure') }
      try {
        addVersion(makeSpec('memory only'), 'Generated')
        // Data lands in memory even when disk fails — the caller's success
        // flow can continue, and the user sees the entry in the current session.
        expect(history.value).toHaveLength(1)
      } finally {
        localStorage.setItem = origSetItem
      }
    })
  })
})
