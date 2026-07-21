// UNIT_TYPE=Utility
//
// wcagContrast.ts — WCAG 2.1 relative luminance + contrast ratio helpers.
//
// Standard: https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
//
// Binding design rule (SEM App, 2026-06-05):
//   - Normal text (< 18pt / < 14pt bold): minimum contrast ratio 4.5 : 1 (WCAG AA)
//   - Large text (≥ 18pt / ≥ 14pt bold):  minimum contrast ratio 3.0 : 1 (WCAG AA large)
//   - UI components / graphical objects:   minimum contrast ratio 3.0 : 1 (WCAG AA UI)
//
// Recognition trigger: any new button, label, chip, badge, HoverHint, or pin sub-option
// text colour MUST pass contrastRatio(bg, text) >= 4.5 for normal text sizes.
// Add a row to the BUTTON_COMBOS table in wcagContrast.audit.test.ts for every new
// colour combination introduced — the test is the automated gate.

/** Parse a CSS hex colour (#rgb, #rrggbb, #rrggbbaa) into [r, g, b] 0-255. */
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  if (h.length === 3) {
    return [
      parseInt(h[0] + h[0], 16),
      parseInt(h[1] + h[1], 16),
      parseInt(h[2] + h[2], 16),
    ]
  }
  if (h.length === 6 || h.length === 8) {
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ]
  }
  throw new Error(`wcagContrast: cannot parse hex colour "${hex}"`)
}

/** Compute WCAG relative luminance for a single linear channel (0-255 → 0-1). */
function linearise(c: number): number {
  const sRGB = c / 255
  return sRGB <= 0.04045 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4)
}

/** WCAG 2.1 relative luminance of an #rrggbb hex colour (returns 0..1). */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return 0.2126 * linearise(r) + 0.7152 * linearise(g) + 0.0722 * linearise(b)
}

/** WCAG 2.1 contrast ratio between two colours (range 1..21). */
export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1)
  const l2 = relativeLuminance(hex2)
  const lighter = Math.max(l1, l2)
  const darker  = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

/** True if the colour pair passes WCAG AA for normal text (ratio ≥ 4.5). */
export function passesWCAG_AA(bgHex: string, textHex: string): boolean {
  return contrastRatio(bgHex, textHex) >= 4.5
}

/** True if the colour pair passes WCAG AA for large text / UI components (ratio ≥ 3.0). */
export function passesWCAG_AA_Large(bgHex: string, textHex: string): boolean {
  return contrastRatio(bgHex, textHex) >= 3.0
}
