// UNIT_TYPE=Test
// Tests for usePriorityRecord composable (Feature #199 — Priority Decision Recording)
// Verifies: upsertRecord (create + update), getRecord, removeRecord, hasRecord,
// cross-model isolation, and default field values.

import { describe, it, expect, beforeEach } from 'vitest'
import { usePriorityRecord } from '../usePriorityRecord'

// Unique model IDs so tests don't cross-contaminate via the singleton store
const MODEL_A = 'priority-test-model-a'
const MODEL_B = 'priority-test-model-b'

/** Remove all records for a given model — used in beforeEach cleanup. */
function clearModel(modelId: string): void {
  const store = usePriorityRecord(modelId)
  // Snapshot the IDs first to avoid mutating while iterating
  const ids = store.records.value.map(r => r.id)
  for (const id of ids) store.removeRecord(id)
}

describe('usePriorityRecord', () => {
  beforeEach(() => {
    clearModel(MODEL_A)
    clearModel(MODEL_B)
  })

  // ── upsertRecord (create) ──────────────────────────────────────────────────

  describe('upsertRecord — create', () => {
    it('creates a new record with the correct entryId and entryType', () => {
      const store = usePriorityRecord(MODEL_A)
      const rec = store.upsertRecord('F.Alpha', 'F', {})
      expect(rec.entryId).toBe('F.Alpha')
      expect(rec.entryType).toBe('F')
    })

    it('defaults source, authority, purposes, exceptions to empty strings', () => {
      const store = usePriorityRecord(MODEL_A)
      const rec = store.upsertRecord('F.Alpha', 'F', {})
      expect(rec.source).toBe('')
      expect(rec.authority).toBe('')
      expect(rec.purposes).toBe('')
      expect(rec.exceptions).toBe('')
    })

    it('defaults notifyOwners=true, notifySkip=false, notifyExtra=[]', () => {
      const store = usePriorityRecord(MODEL_A)
      const rec = store.upsertRecord('F.Alpha', 'F', {})
      expect(rec.notifyOwners).toBe(true)
      expect(rec.notifySkip).toBe(false)
      expect(rec.notifyExtra).toEqual([])
    })

    it('defaults all impact fields to empty strings', () => {
      const store = usePriorityRecord(MODEL_A)
      const rec = store.upsertRecord('F.Alpha', 'F', {})
      expect(rec.impactTiming).toBe('')
      expect(rec.impactCosts).toBe('')
      expect(rec.impactValues).toBe('')
      expect(rec.impactSolutions).toBe('')
    })

    it('applies provided patch fields at create time', () => {
      const store = usePriorityRecord(MODEL_A)
      const rec = store.upsertRecord('V.Beta', 'V', {
        source: 'Regulatory requirement',
        authority: 'Compliance team',
        notifyOwners: false,
      })
      expect(rec.source).toBe('Regulatory requirement')
      expect(rec.authority).toBe('Compliance team')
      expect(rec.notifyOwners).toBe(false)
    })

    it('adds the record to the reactive records list', () => {
      const store = usePriorityRecord(MODEL_A)
      store.upsertRecord('F.One', 'F', {})
      expect(store.records.value).toHaveLength(1)
    })

    it('assigns a unique id to each new record', () => {
      const store = usePriorityRecord(MODEL_A)
      const r1 = store.upsertRecord('F.One', 'F', {})
      const r2 = store.upsertRecord('V.Two', 'V', {})
      expect(r1.id).toBeTruthy()
      expect(r2.id).toBeTruthy()
      expect(r1.id).not.toBe(r2.id)
    })

    it('sets createdAt and updatedAt ISO timestamps', () => {
      const before = Date.now()
      const store = usePriorityRecord(MODEL_A)
      const rec = store.upsertRecord('F.Time', 'F', {})
      const after = Date.now()
      const createdMs = new Date(rec.createdAt).getTime()
      expect(createdMs).toBeGreaterThanOrEqual(before)
      expect(createdMs).toBeLessThanOrEqual(after)
      expect(rec.createdAt).toBe(rec.updatedAt) // same on initial create
    })
  })

  // ── upsertRecord (update) ──────────────────────────────────────────────────

  describe('upsertRecord — update', () => {
    it('updates an existing record instead of creating a duplicate', () => {
      const store = usePriorityRecord(MODEL_A)
      store.upsertRecord('F.One', 'F', { source: 'First source' })
      store.upsertRecord('F.One', 'F', { source: 'Updated source' })
      expect(store.records.value).toHaveLength(1)
      expect(store.getRecord('F.One')!.source).toBe('Updated source')
    })

    it('preserves unpatched fields on update', () => {
      const store = usePriorityRecord(MODEL_A)
      store.upsertRecord('F.One', 'F', { source: 'Market research', authority: 'CEO' })
      store.upsertRecord('F.One', 'F', { source: 'Changed source' })
      expect(store.getRecord('F.One')!.authority).toBe('CEO')
    })

    it('bumps updatedAt on each update', async () => {
      const store = usePriorityRecord(MODEL_A)
      const r1 = store.upsertRecord('F.One', 'F', {})
      // Ensure at least 1 ms passes
      await new Promise(resolve => setTimeout(resolve, 2))
      const r2 = store.upsertRecord('F.One', 'F', { source: 'Changed' })
      expect(r2.updatedAt >= r1.updatedAt).toBe(true)
    })

    it('preserves the original createdAt on update', async () => {
      const store = usePriorityRecord(MODEL_A)
      const r1 = store.upsertRecord('F.One', 'F', {})
      await new Promise(resolve => setTimeout(resolve, 2))
      const r2 = store.upsertRecord('F.One', 'F', { source: 'Changed' })
      expect(r2.createdAt).toBe(r1.createdAt)
    })
  })

  // ── getRecord ──────────────────────────────────────────────────────────────

  describe('getRecord', () => {
    it('returns null when no record exists for the entryId', () => {
      const store = usePriorityRecord(MODEL_A)
      expect(store.getRecord('F.Missing')).toBeNull()
    })

    it('returns the correct record for the given entryId', () => {
      const store = usePriorityRecord(MODEL_A)
      store.upsertRecord('F.Alpha', 'F', { source: 'A' })
      store.upsertRecord('V.Beta', 'V', { source: 'B' })
      expect(store.getRecord('V.Beta')!.source).toBe('B')
    })
  })

  // ── removeRecord ───────────────────────────────────────────────────────────

  describe('removeRecord', () => {
    it('removes the record with the given id', () => {
      const store = usePriorityRecord(MODEL_A)
      const rec = store.upsertRecord('F.ToRemove', 'F', {})
      store.removeRecord(rec.id)
      expect(store.getRecord('F.ToRemove')).toBeNull()
      expect(store.records.value).toHaveLength(0)
    })

    it('only removes the specified record, leaving others intact', () => {
      const store = usePriorityRecord(MODEL_A)
      const r1 = store.upsertRecord('F.Keep', 'F', {})
      const r2 = store.upsertRecord('V.Remove', 'V', {})
      store.removeRecord(r2.id)
      expect(store.records.value).toHaveLength(1)
      expect(store.records.value[0].id).toBe(r1.id)
    })

    it('is a no-op when the id does not exist', () => {
      const store = usePriorityRecord(MODEL_A)
      store.upsertRecord('F.One', 'F', {})
      expect(() => store.removeRecord('nonexistent-id')).not.toThrow()
      expect(store.records.value).toHaveLength(1)
    })
  })

  // ── hasRecord ──────────────────────────────────────────────────────────────

  describe('hasRecord', () => {
    it('returns false when no record exists', () => {
      const store = usePriorityRecord(MODEL_A)
      expect(store.hasRecord('F.None')).toBe(false)
    })

    it('returns true after a record is created', () => {
      const store = usePriorityRecord(MODEL_A)
      store.upsertRecord('F.Exists', 'F', {})
      expect(store.hasRecord('F.Exists')).toBe(true)
    })

    it('returns false after the record is removed', () => {
      const store = usePriorityRecord(MODEL_A)
      const rec = store.upsertRecord('F.Gone', 'F', {})
      store.removeRecord(rec.id)
      expect(store.hasRecord('F.Gone')).toBe(false)
    })
  })

  // ── notifyExtra ────────────────────────────────────────────────────────────

  describe('notifyExtra array', () => {
    it('stores and retrieves an array of extra notifyee names', () => {
      const store = usePriorityRecord(MODEL_A)
      const rec = store.upsertRecord('F.Test', 'F', { notifyExtra: ['Alice', 'Bob'] })
      expect(rec.notifyExtra).toEqual(['Alice', 'Bob'])
    })

    it('can be updated to add new notifyees', () => {
      const store = usePriorityRecord(MODEL_A)
      store.upsertRecord('F.Test', 'F', { notifyExtra: ['Alice'] })
      store.upsertRecord('F.Test', 'F', { notifyExtra: ['Alice', 'Bob', 'Carol'] })
      expect(store.getRecord('F.Test')!.notifyExtra).toEqual(['Alice', 'Bob', 'Carol'])
    })
  })

  // ── cross-model isolation ──────────────────────────────────────────────────

  describe('plan model isolation', () => {
    it('records for MODEL_A do not appear in MODEL_B', () => {
      usePriorityRecord(MODEL_A).upsertRecord('F.A', 'F', { source: 'Model A only' })
      expect(usePriorityRecord(MODEL_B).getRecord('F.A')).toBeNull()
      expect(usePriorityRecord(MODEL_B).records.value).toHaveLength(0)
    })

    it('removing a record from MODEL_A does not touch MODEL_B', () => {
      usePriorityRecord(MODEL_A).upsertRecord('F.Shared', 'F', {})
      const bRec = usePriorityRecord(MODEL_B).upsertRecord('F.Shared', 'F', { source: 'B source' })
      const aRec = usePriorityRecord(MODEL_A).getRecord('F.Shared')!
      usePriorityRecord(MODEL_A).removeRecord(aRec.id)
      // MODEL_B record survives
      expect(usePriorityRecord(MODEL_B).records.value).toHaveLength(1)
      expect(usePriorityRecord(MODEL_B).getRecord('F.Shared')!.id).toBe(bRec.id)
    })
  })
})
