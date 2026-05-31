/**
 * Planguage entry type colours — colorblind-safe palette.
 * Red-green colorblind (deuteranopia/protanopia) cannot distinguish red from green.
 * We use orange/fuchsia/sky/blue instead of red/green for functional signals.
 *
 * Tom Gilb confirmed red-green colorblindness 2026-05-31.
 * WCAG 2.1 AA: colour must never be the ONLY visual indicator.
 * These badge classes accompany the letter label (F./V./C./R./S.) which is the
 * primary differentiator — colour is supplementary.
 *
 * Twin-portable: these are pure string constants, no Vue dependency.
 */

export type EntryType = 'F' | 'V' | 'C' | 'R' | 'S'

/** Tailwind class string for a type badge (background + text colour). */
export const TYPE_BADGE_CLASS: Record<EntryType, string> = {
  F: 'bg-orange-100 text-orange-800',    // Function  — orange (warm, active)
  V: 'bg-blue-100 text-blue-800',        // Value     — blue (analytical, measurable)
  C: 'bg-fuchsia-100 text-fuchsia-800',  // Constraint — fuchsia/pink (was red — colorblind fix)
  R: 'bg-sky-100 text-sky-800',          // Resource  — sky/cyan (was emerald/green — colorblind fix)
  S: 'bg-violet-100 text-violet-800',    // Solution  — violet (means/solution)
}

/** Solid colour for SVG fills, chart dots, etc. */
export const TYPE_FILL_COLOR: Record<EntryType, string> = {
  F: '#f97316',  // orange-500
  V: '#3b82f6',  // blue-500
  C: '#d946ef',  // fuchsia-500
  R: '#0ea5e9',  // sky-500
  S: '#8b5cf6',  // violet-500
}

/** Border/stroke colour (darker variant of the fill). */
export const TYPE_STROKE_COLOR: Record<EntryType, string> = {
  F: '#ea580c',  // orange-600
  V: '#2563eb',  // blue-600
  C: '#c026d3',  // fuchsia-600
  R: '#0284c7',  // sky-600
  S: '#7c3aed',  // violet-600
}

/** Light background fill for V. entries in SVG nodes. */
export const TYPE_NODE_FILL: Record<EntryType, string> = {
  F: '#fff7ed',  // orange-50
  V: '#eff6ff',  // blue-50
  C: '#fdf4ff',  // fuchsia-50
  R: '#f0f9ff',  // sky-50
  S: '#f5f3ff',  // violet-50
}

/**
 * Severity colours — used for defect analysis badges.
 * "critical" was red — changed to rose (pink-purple, still alarming, visible to colorblind).
 */
export const SEVERITY_BADGE_CLASS: Record<'critical' | 'major' | 'minor' | 'info', string> = {
  critical: 'bg-rose-100 text-rose-700 border-rose-300',
  major:    'bg-orange-100 text-orange-700 border-orange-300',
  minor:    'bg-amber-100 text-amber-700 border-amber-300',
  info:     'bg-blue-100 text-blue-700 border-blue-300',
}

export const SEVERITY_DOT_CLASS: Record<'critical' | 'major' | 'minor' | 'info', string> = {
  critical: 'bg-rose-500',
  major:    'bg-orange-500',
  minor:    'bg-amber-400',
  info:     'bg-blue-400',
}

/**
 * Health / quality score colours.
 * Was green (good) / amber (ok) / red (bad) → now blue / amber / orange.
 */
export function healthScoreColor(score: number): string {
  if (score >= 80) return '#2563eb'  // blue-600 (was green)
  if (score >= 60) return '#d97706'  // amber-600
  return '#f97316'                    // orange-500 (was red)
}

export function healthScoreTailwind(score: number): string {
  if (score >= 80) return 'text-blue-600'
  if (score >= 60) return 'text-amber-600'
  return 'text-orange-500'
}

/** Colorblind-safe arrow colours for SVG relationship diagrams. */
export const ARROW_COLOR = {
  valueDelivery:   '#2563eb',  // F→V: blue (was green)
  constraint:      '#f97316',  // F→C: orange (was red)
  stakeholder:     '#2563eb',  // S→F: blue (medium)
  feedback:        '#93c5fd',  // V→F: light blue dashed (was light blue dashed — fine)
  resource:        '#0ea5e9',  // R→F: sky
}

/** In-boundary / out-of-boundary dot colours for boundary diagram. */
export const BOUNDARY_DOT = {
  inBoundary:     '#2563eb',  // blue (was green #34d399)
  outOfBoundary:  '#f97316',  // orange (was red #ef4444)
  inBoundaryText: '#1e3a8a',  // blue-900
}
