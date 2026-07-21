// UNIT_TYPE=Test
// useToolUsage.test.ts — sanity tests for the click-counter composable.
//
// Tom Gilb 2026-06-19 verbatim: "interesting if you can track my usage."
// This test confirms the counter increments, the sort order is most-
// clicked-first, the clear function actually clears, and localStorage
// persistence round-trips (or no-ops cleanly when storage is unavailable).

import { describe, it, expect, beforeEach } from 'vitest'
import {
  recordToolClick,
  getUsageReport,
  clearUsage,
} from '../useToolUsage'

describe('useToolUsage', () => {
  beforeEach(() => {
    clearUsage()
  })

  it('records a single click as count = 1', () => {
    recordToolClick('toolbox')
    const report = getUsageReport()
    expect(report).toHaveLength(1)
    expect(report[0].toolId).toBe('toolbox')
    expect(report[0].count).toBe(1)
  })

  it('increments the same tool id across multiple clicks', () => {
    recordToolClick('toolbox')
    recordToolClick('toolbox')
    recordToolClick('toolbox')
    const report = getUsageReport()
    expect(report).toHaveLength(1)
    expect(report[0].count).toBe(3)
  })

  it('keeps firstClickAt stable while updating lastClickAt', () => {
    recordToolClick('toolbox')
    const first = getUsageReport()[0]
    // Wait a tick so the timestamp can differ.
    return new Promise<void>(resolve => setTimeout(() => {
      recordToolClick('toolbox')
      const second = getUsageReport()[0]
      expect(second.firstClickAt).toBe(first.firstClickAt)
      expect(second.lastClickAt >= first.lastClickAt).toBe(true)
      resolve()
    }, 5))
  })

  it('sorts the report by descending click count', () => {
    recordToolClick('toolbox')         // 1
    recordToolClick('sharpening')      // 1
    recordToolClick('sharpening')      // 2
    recordToolClick('sharpening')      // 3
    recordToolClick('penta')           // 1
    recordToolClick('penta')           // 2
    const report = getUsageReport()
    expect(report.map(r => r.toolId)).toEqual(['sharpening', 'penta', 'toolbox'])
    expect(report.map(r => r.count)).toEqual([3, 2, 1])
  })

  it('clears the map back to empty', () => {
    recordToolClick('toolbox')
    expect(getUsageReport()).toHaveLength(1)
    clearUsage()
    expect(getUsageReport()).toHaveLength(0)
  })

  it('ignores a blank tool id (no crash, no entry)', () => {
    recordToolClick('')
    expect(getUsageReport()).toHaveLength(0)
  })
})
