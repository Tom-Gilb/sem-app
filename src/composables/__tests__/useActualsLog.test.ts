// UNIT_TYPE=Test
// Feature #39 — Tests for useActualsLog composable

import { describe, it, expect, beforeEach } from 'vitest'
import { useActualsLog } from '../useActualsLog'

// localStorage is unavailable in jsdom by default in vitest — but useActualsLog
// handles that gracefully (saveToStorage is a no-op on error). We test logic only.

describe('useActualsLog', () => {
  let actualsLog: ReturnType<typeof useActualsLog>

  beforeEach(() => {
    actualsLog = useActualsLog()
    actualsLog.clearAll()
  })

  describe('logActual()', () => {
    it('stores an entry for a solution × value pair', () => {
      actualsLog.logActual('S.Foo', 'V.Bar', 70, 65, 'First delivery')
      const entries = actualsLog.getEntries('S.Foo', 'V.Bar')
      expect(entries).toHaveLength(1)
    })

    it('stores multiple entries for the same pair (history)', () => {
      actualsLog.logActual('S.Foo', 'V.Bar', 70, 65)
      actualsLog.logActual('S.Foo', 'V.Bar', 70, 72)
      const entries = actualsLog.getEntries('S.Foo', 'V.Bar')
      expect(entries).toHaveLength(2)
    })

    it('entry has the correct solutionId, valueId, aiEstimate, actual', () => {
      actualsLog.logActual('S.Alpha', 'V.Beta', 50, 55, 'Test note')
      const entry = actualsLog.getLatest('S.Alpha', 'V.Beta')
      expect(entry).toBeDefined()
      expect(entry!.solutionId).toBe('S.Alpha')
      expect(entry!.valueId).toBe('V.Beta')
      expect(entry!.aiEstimate).toBe(50)
      expect(entry!.actual).toBe(55)
      expect(entry!.note).toBe('Test note')
    })

    it('entry date is a valid ISO date string (YYYY-MM-DD)', () => {
      actualsLog.logActual('S.X', 'V.Y', 40, 40)
      const entry = actualsLog.getLatest('S.X', 'V.Y')
      expect(entry!.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('note defaults to empty string when omitted', () => {
      actualsLog.logActual('S.X', 'V.Y', 40, 40)
      expect(actualsLog.getLatest('S.X', 'V.Y')!.note).toBe('')
    })
  })

  describe('getEntries()', () => {
    it('returns empty array for unknown pair', () => {
      expect(actualsLog.getEntries('S.Unknown', 'V.Unknown')).toEqual([])
    })
  })

  describe('getLatest()', () => {
    it('returns undefined for unknown pair', () => {
      expect(actualsLog.getLatest('S.Unknown', 'V.Unknown')).toBeUndefined()
    })

    it('returns the last logged entry when multiple exist', () => {
      actualsLog.logActual('S.X', 'V.Y', 50, 40)
      actualsLog.logActual('S.X', 'V.Y', 50, 60)
      expect(actualsLog.getLatest('S.X', 'V.Y')!.actual).toBe(60)
    })
  })

  describe('calibrationDelta()', () => {
    it('returns null for unknown pair', () => {
      expect(actualsLog.calibrationDelta('S.X', 'V.Y')).toBeNull()
    })

    it('returns actual − aiEstimate', () => {
      actualsLog.logActual('S.X', 'V.Y', 70, 80)
      expect(actualsLog.calibrationDelta('S.X', 'V.Y')).toBe(10)
    })

    it('negative delta when actual < estimate', () => {
      actualsLog.logActual('S.X', 'V.Y', 70, 50)
      expect(actualsLog.calibrationDelta('S.X', 'V.Y')).toBe(-20)
    })
  })

  describe('calibrationSummary', () => {
    it('returns null when no entries logged', () => {
      expect(actualsLog.calibrationSummary.value).toBeNull()
    })

    it('returns count, mae, bias when entries exist', () => {
      actualsLog.logActual('S.A', 'V.A', 50, 60)  // delta +10
      actualsLog.logActual('S.B', 'V.B', 80, 70)  // delta -10
      const summary = actualsLog.calibrationSummary.value
      expect(summary).not.toBeNull()
      expect(summary!.count).toBe(2)
      expect(summary!.mae).toBe(10)   // (10 + 10) / 2
      expect(summary!.bias).toBe(0)   // (10 + -10) / 2 = 0
    })

    it('positive bias when actuals consistently exceed estimates', () => {
      actualsLog.logActual('S.A', 'V.A', 40, 60)
      actualsLog.logActual('S.B', 'V.B', 50, 70)
      const summary = actualsLog.calibrationSummary.value
      expect(summary!.bias).toBeGreaterThan(0)
    })
  })

  describe('clearAll()', () => {
    it('empties the log', () => {
      actualsLog.logActual('S.X', 'V.Y', 50, 60)
      actualsLog.clearAll()
      expect(actualsLog.getEntries('S.X', 'V.Y')).toHaveLength(0)
    })
  })
})
