// UNIT_TYPE=Test
// useSpecKeyMigration — Phase 1 of Plan→Spec rename.
// Tom Gilb, 2026-06-04: *"confirm Phase 1"*.
//
// These tests pin down the six safety properties documented in the source:
//   1. read prefers NEW key when present
//   2. read falls back to OLD key when NEW is missing
//   3. read returns null when neither key exists
//   4. write dual-writes to both NEW and OLD keys
//   5. backfill copies legacy → new ONLY when new is empty (idempotent)
//   6. shim NEVER removes the OLD key

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  SPEC_KEY_MAP,
  oldKeyFor,
  newKeyFor,
  readMigrated,
  writeBoth,
  backfillSpecKeysFromPlanKeys,
  useSpecKeyMigration,
} from '../useSpecKeyMigration'

// jsdom in this project does not provide localStorage by default; install
// an in-memory polyfill so the safe-storage guard activates the real path.
function installMemoryLocalStorage() {
  const store: Record<string, string> = {}
  const fake: Storage = {
    get length() { return Object.keys(store).length },
    clear: () => { for (const k of Object.keys(store)) delete store[k] },
    getItem: (k: string) => (k in store ? store[k] : null),
    key: (i: number) => Object.keys(store)[i] ?? null,
    removeItem: (k: string) => { delete store[k] },
    setItem: (k: string, v: string) => { store[k] = String(v) },
  }
  Object.defineProperty(window, 'localStorage', { value: fake, configurable: true })
  return fake
}

describe('useSpecKeyMigration — key mapping helpers', () => {
  it('maps every plan-prefixed key to its spec-prefixed counterpart', () => {
    expect(SPEC_KEY_MAP['sem-current-plan-model']).toBe('sem-current-spec')
    expect(SPEC_KEY_MAP['sem-plan-health-custom']).toBe('sem-spec-health-custom')
    expect(SPEC_KEY_MAP['sem-plan-models']).toBe('sem-specs')
    expect(SPEC_KEY_MAP['sem-plan-targets']).toBe('sem-spec-targets')
  })

  it('oldKeyFor() returns the legacy plan key for each spec key', () => {
    expect(oldKeyFor('sem-current-spec')).toBe('sem-current-plan-model')
    expect(oldKeyFor('sem-specs')).toBe('sem-plan-models')
    expect(oldKeyFor('sem-unrelated-key')).toBeNull()
  })

  it('newKeyFor() returns the spec key for each plan key, or unchanged if unmapped', () => {
    expect(newKeyFor('sem-plan-models')).toBe('sem-specs')
    expect(newKeyFor('sem-active-profile')).toBe('sem-active-profile')
  })
})

describe('useSpecKeyMigration — readMigrated()', () => {
  beforeEach(() => { installMemoryLocalStorage() })

  it('returns the NEW-key value when present (property 1)', () => {
    window.localStorage.setItem('sem-current-spec', 'fresh')
    window.localStorage.setItem('sem-current-plan-model', 'legacy')
    expect(readMigrated('sem-current-spec')).toBe('fresh')
  })

  it('falls back to the OLD-key value when NEW is missing (property 2)', () => {
    window.localStorage.setItem('sem-current-plan-model', 'legacy-only')
    expect(readMigrated('sem-current-spec')).toBe('legacy-only')
  })

  it('returns null when neither key exists (property 3)', () => {
    expect(readMigrated('sem-current-spec')).toBeNull()
  })

  it('returns null for unmapped keys with no data (no crash)', () => {
    expect(readMigrated('sem-totally-unrelated-key')).toBeNull()
  })

  it('invokes onError when the storage read throws', () => {
    const onError = vi.fn()
    const broken: Storage = {
      ...installMemoryLocalStorage(),
      getItem: () => { throw new Error('quota') },
    } as Storage
    Object.defineProperty(window, 'localStorage', { value: broken, configurable: true })
    expect(readMigrated('sem-current-spec', { onError })).toBeNull()
    expect(onError).toHaveBeenCalledWith(expect.any(Error), 'sem-current-spec')
  })
})

describe('useSpecKeyMigration — writeBoth()', () => {
  beforeEach(() => { installMemoryLocalStorage() })

  it('writes the same value to BOTH the NEW and OLD keys (property 4)', () => {
    writeBoth('sem-specs', '[{"name":"x"}]')
    expect(window.localStorage.getItem('sem-specs')).toBe('[{"name":"x"}]')
    expect(window.localStorage.getItem('sem-plan-models')).toBe('[{"name":"x"}]')
  })

  it('writes only the NEW key when there is no legacy mapping', () => {
    writeBoth('sem-new-feature-key', 'v1')
    expect(window.localStorage.getItem('sem-new-feature-key')).toBe('v1')
    // no crash, no legacy counterpart attempted
  })
})

describe('useSpecKeyMigration — backfillSpecKeysFromPlanKeys()', () => {
  beforeEach(() => { installMemoryLocalStorage() })

  it('copies legacy keys to spec keys when the spec key is empty', () => {
    window.localStorage.setItem('sem-plan-models', '[1,2,3]')
    window.localStorage.setItem('sem-plan-targets', '{"goal":80}')
    const copied = backfillSpecKeysFromPlanKeys()
    expect(window.localStorage.getItem('sem-specs')).toBe('[1,2,3]')
    expect(window.localStorage.getItem('sem-spec-targets')).toBe('{"goal":80}')
    expect(copied).toEqual(expect.arrayContaining(['sem-specs', 'sem-spec-targets']))
  })

  it('does NOT overwrite an existing spec-key value (idempotent / property 5)', () => {
    window.localStorage.setItem('sem-plan-models', 'OLD')
    window.localStorage.setItem('sem-specs',      'NEW')
    backfillSpecKeysFromPlanKeys()
    expect(window.localStorage.getItem('sem-specs')).toBe('NEW')   // untouched
    expect(window.localStorage.getItem('sem-plan-models')).toBe('OLD') // untouched
  })

  it('NEVER calls removeItem on the legacy key (property 6 — shim leaves OLD alone)', () => {
    const fake = installMemoryLocalStorage()
    const removeSpy = vi.spyOn(fake, 'removeItem')
    fake.setItem('sem-plan-models', 'legacy')
    backfillSpecKeysFromPlanKeys()
    writeBoth('sem-specs', 'fresh')
    readMigrated('sem-current-spec')
    expect(removeSpy).not.toHaveBeenCalled()
  })

  it('is safe to call multiple times in a row', () => {
    window.localStorage.setItem('sem-plan-models', 'legacy')
    const first  = backfillSpecKeysFromPlanKeys()
    const second = backfillSpecKeysFromPlanKeys()
    expect(first).toContain('sem-specs')
    expect(second).toEqual([])   // already copied — nothing new this run
  })
})

describe('useSpecKeyMigration — composable wrapper', () => {
  beforeEach(() => { installMemoryLocalStorage() })

  it('exposes read / write / backfill / key helpers as one object', () => {
    const m = useSpecKeyMigration()
    expect(typeof m.read).toBe('function')
    expect(typeof m.write).toBe('function')
    expect(typeof m.backfill).toBe('function')
    expect(m.keyMap).toBe(SPEC_KEY_MAP)
    expect(m.oldKeyFor('sem-current-spec')).toBe('sem-current-plan-model')
    expect(m.newKeyFor('sem-plan-models')).toBe('sem-specs')
  })

  it('round-trips through write + read using the composable API', () => {
    const m = useSpecKeyMigration()
    m.write('sem-current-spec', 'composable-value')
    expect(m.read('sem-current-spec')).toBe('composable-value')
    // legacy counterpart was also written (dual-write window)
    expect(window.localStorage.getItem('sem-current-plan-model')).toBe('composable-value')
  })
})
