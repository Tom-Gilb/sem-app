// UNIT_TYPE=Test
// Regression tests for ValueCounter arrow system and stageProgressColors utility.
// 13 tests covering the indigo→emerald colour sweep, arrow stroke widths, and
// the ArrowInfoPanel data completeness.
//
// Spec: F.ValueAccumulationCounter (#15) — Design log r25 (13 test spec).
// Regression: guards against stale Vite cache silently breaking the colour utilities
// and against arrow index mismatches in ARROW_INFO_DATA.

import { describe, it, expect } from 'vitest'
import {
  stageProgressColor,
  pillProgressColor,
  arrowProgressColors,
  arrowShaftWidth,
  STAGE_COUNT,
} from '../../utils/stageProgressColors'
import { ARROW_INFO_DATA } from '../../data/arrowInfoData'

// ── stageProgressColor ─────────────────────────────────────────────────────────

describe('stageProgressColor()', () => {
  it('returns a valid hsl() string for all 11 stage positions', () => {
    for (let i = 0; i < STAGE_COUNT; i++) {
      const col = stageProgressColor(i)
      expect(col).toMatch(/^hsl\(\d+\.\d+, 80%, 65%\)$/)
    }
  })

  it('starts at indigo hue (~239°) at position 0', () => {
    const col = stageProgressColor(0)
    // Extract hue from "hsl(239.0, 80%, 65%)"
    const hue = parseFloat(col.replace('hsl(', ''))
    expect(hue).toBeCloseTo(239, 0)
  })

  it('ends at emerald hue (~160°) at position 10', () => {
    const col = stageProgressColor(10)
    const hue = parseFloat(col.replace('hsl(', ''))
    expect(hue).toBeCloseTo(160, 0)
  })

  it('hue decreases monotonically from position 0 to 10 (indigo→emerald)', () => {
    const hues = Array.from({ length: STAGE_COUNT }, (_, i) => {
      const col = stageProgressColor(i)
      return parseFloat(col.replace('hsl(', ''))
    })
    for (let i = 1; i < hues.length; i++) {
      expect(hues[i]).toBeLessThan(hues[i - 1])
    }
  })

  it('clamps gracefully: position -1 equals position 0', () => {
    expect(stageProgressColor(-1)).toBe(stageProgressColor(0))
  })

  it('clamps gracefully: position 11 equals position 10', () => {
    expect(stageProgressColor(11)).toBe(stageProgressColor(10))
  })
})

// ── pillProgressColor ─────────────────────────────────────────────────────────

describe('pillProgressColor()', () => {
  it('returns darker shade for done vs current', () => {
    // Extract lightness values: "hsl(239.0, 72%, 36%)" → 36
    const current = pillProgressColor(0, 'current')
    const done    = pillProgressColor(0, 'done')
    const future  = pillProgressColor(0, 'future')

    const extractL = (s: string) => parseFloat(s.match(/(\d+)%\)$/)?.[1] ?? '0')
    expect(extractL(current)).toBeGreaterThan(extractL(done))
    expect(extractL(done)).toBeGreaterThan(extractL(future))
  })
})

// ── arrowProgressColors ────────────────────────────────────────────────────────

describe('arrowProgressColors()', () => {
  it('returns from = stageProgressColor(idx) and to = stageProgressColor(idx+1)', () => {
    for (let idx = 0; idx < STAGE_COUNT - 1; idx++) {
      const { from, to } = arrowProgressColors(idx)
      expect(from).toBe(stageProgressColor(idx))
      expect(to).toBe(stageProgressColor(idx + 1))
    }
  })
})

// ── arrowShaftWidth ────────────────────────────────────────────────────────────

describe('arrowShaftWidth()', () => {
  it('first arrow (idx=0) has width ~3px', () => {
    expect(arrowShaftWidth(0)).toBeCloseTo(3, 1)
  })

  it('last arrow (idx=9) has width ~9px', () => {
    expect(arrowShaftWidth(9)).toBeCloseTo(9, 1)
  })

  it('stroke width increases monotonically from idx 0 to 9', () => {
    const widths = Array.from({ length: 10 }, (_, i) => arrowShaftWidth(i))
    for (let i = 1; i < widths.length; i++) {
      expect(widths[i]).toBeGreaterThan(widths[i - 1])
    }
  })
})

// ── ARROW_INFO_DATA ────────────────────────────────────────────────────────────

describe('ARROW_INFO_DATA', () => {
  it('has exactly 10 entries (one per inter-stage connector)', () => {
    expect(ARROW_INFO_DATA).toHaveLength(10)
  })

  it('each entry has idx matching its array position', () => {
    ARROW_INFO_DATA.forEach((info, arrayPos) => {
      expect(info.idx).toBe(arrayPos)
    })
  })

  it('each entry has 3 sections (History / Planguage / Fun Fact)', () => {
    ARROW_INFO_DATA.forEach(info => {
      expect(info.sections).toHaveLength(3)
    })
  })

  it('each section has at least one real link', () => {
    ARROW_INFO_DATA.forEach(info => {
      info.sections.forEach(section => {
        expect(section.links.length).toBeGreaterThan(0)
        section.links.forEach(link => {
          expect(link.url).toMatch(/^https?:\/\//)
          expect(link.label.length).toBeGreaterThan(3)
        })
      })
    })
  })

  it('fromStage and toStage are sequential (toStage = fromStage + 1)', () => {
    ARROW_INFO_DATA.forEach(info => {
      expect(info.toStage).toBe(info.fromStage + 1)
    })
  })

  it('idx 0 connects stages 1→2 (Stakes→Solutions)', () => {
    const first = ARROW_INFO_DATA[0]
    expect(first.fromStage).toBe(1)
    expect(first.toStage).toBe(2)
    expect(first.fromLabel).toBe('Stakes')
    expect(first.toLabel).toBe('Solutions')
  })

  it('idx 9 connects stages 10→11 (Plan→Export)', () => {
    const last = ARROW_INFO_DATA[9]
    expect(last.fromStage).toBe(10)
    expect(last.toStage).toBe(11)
    expect(last.fromLabel).toBe('Plan')
    expect(last.toLabel).toBe('Export')
  })
})
