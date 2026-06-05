import { describe, it, expect } from 'vitest'
import { hexToRgb, relativeLuminance, contrastRatio, passesWCAG_AA } from '../../utils/wcagContrast'

const BUTTON_COMBOS = [
  // Stage 10 Resources pin sub-buttons
  // Pin 1 (emerald) — bg-white text-emerald-800
  { name: 'Pin1 Improve button', bg: '#ffffff', text: '#065f46', minRatio: 4.5 },
  // Pin 2 (blue) — bg-white text-blue-900
  { name: 'Pin2 Analyze button', bg: '#ffffff', text: '#1e3a5f', minRatio: 4.5 },
  // Pin 3 (violet) — bg-white text-violet-900
  { name: 'Pin3 Visualize button', bg: '#ffffff', text: '#2e1065', minRatio: 4.5 },
  // Pin 4 (amber/orange) — bg-white text-amber-900
  { name: 'Pin4 Optima button', bg: '#ffffff', text: '#78350f', minRatio: 4.5 },
  // Pin 5 (KISS dark) — bg-white text-indigo-900
  { name: 'Pin5 KISS button', bg: '#ffffff', text: '#312e81', minRatio: 4.5 },
  // Pin 6 (Cost Eng amber) — bg-white text-amber-900
  { name: 'Pin6 CostEng button', bg: '#ffffff', text: '#78350f', minRatio: 4.5 },

  // Pin sub-area background with container bg (to confirm no same-colour blend)
  // Pin 3 violet-50 bg with text (fallback: if button bg fails, text vs container must also pass)
  { name: 'Pin3 violet-50 container bg vs violet-900 text', bg: '#f5f3ff', text: '#2e1065', minRatio: 4.5 },

  // White text on dark gradient headers (WCAG AA — large/UI rule 3.0)
  { name: 'Pin1 header white-on-emerald-700', bg: '#047857', text: '#ffffff', minRatio: 3.0 },
  { name: 'Pin3 header white-on-violet-500', bg: '#8b5cf6', text: '#ffffff', minRatio: 3.0 },
  { name: 'Pin6 header white-on-amber-800', bg: '#92400e', text: '#ffffff', minRatio: 3.0 },

  // All Tools / Other Tools footer pills — small text
  { name: 'All Tools pill emerald', bg: '#ecfdf5', text: '#065f46', minRatio: 4.5 },
  { name: 'All Tools pill violet', bg: '#f5f3ff', text: '#3730a3', minRatio: 4.5 },
  { name: 'All Tools pill amber', bg: '#fffbeb', text: '#78350f', minRatio: 4.5 },
] as const

describe('WCAG AA Contrast Audit — SEM App button colours', () => {
  it.each(BUTTON_COMBOS)('$name meets contrast ratio >= $minRatio', ({ bg, text, minRatio }) => {
    const ratio = contrastRatio(bg, text)
    expect(ratio).toBeGreaterThanOrEqual(minRatio)
  })

  describe('hexToRgb', () => {
    it('parses #ffffff as [255, 255, 255]', () => {
      expect(hexToRgb('#ffffff')).toEqual([255, 255, 255])
    })
    it('parses #000000 as [0, 0, 0]', () => {
      expect(hexToRgb('#000000')).toEqual([0, 0, 0])
    })
  })

  describe('relativeLuminance', () => {
    it('white has luminance ≈ 1.0', () => {
      expect(relativeLuminance('#ffffff')).toBeCloseTo(1.0, 5)
    })
    it('black has luminance ≈ 0.0', () => {
      expect(relativeLuminance('#000000')).toBeCloseTo(0.0, 5)
    })
  })

  describe('contrastRatio', () => {
    it('white vs black is ≈ 21.0 (maximum contrast)', () => {
      expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21.0, 0)
    })
    it('white vs white is ≈ 1.0 (same colour)', () => {
      expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1.0, 5)
    })
  })

  describe('passesWCAG_AA', () => {
    it('black on white passes AA', () => {
      expect(passesWCAG_AA('#ffffff', '#000000')).toBe(true)
    })
    it('white on white fails AA', () => {
      expect(passesWCAG_AA('#ffffff', '#ffffff')).toBe(false)
    })
  })
})
