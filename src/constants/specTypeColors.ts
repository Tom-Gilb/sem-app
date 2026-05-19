/**
 * Canonical Planguage spec-type colour palette.
 *
 * ONE place to change colours for the entire app.
 * Agreed scheme (2026-05-16, Kai swap ratified same day):
 *
 *   Value       → Violet  #7c3aed  (royal · worth · Kai: "royal, let's make him happy")
 *   Function    → Green   #16a34a  (good to go · capability active · Kai: "good to go")
 *   Solution    → Orange  #ea580c  (creative means · not danger-red · not benefit-green)
 *   Constraint  → Red     #dc2626  (danger · hard limit · must-not-exceed)
 *   Evo Step    → Amber   #ca8a04  (process step · increment · time)
 *   Task        → Slate   #374151  (neutral work · "boring" by design)
 *   Stakeholder → Blue    #2563eb  (person · authority · trust)
 *   Resource    → Dark Green #166534  (money · input cost · "green for money" — Kai · →O keyed icon)
 *
 * Each entry has:
 *   base    — primary colour  (badge bg, header bg, icon stroke in colour mode)
 *   light   — very light tint (card / node fill background)
 *   border  — border / outline colour
 *   dark    — dark shade      (body text on light-bg cards)
 *   accent  — lighter accent  (sub-text, secondary icons, dashed lines)
 *   onBase  — text colour ON the base background (always white here)
 *   glow    — RGB triple for box-shadow / SVG filter (no # prefix)
 *
 * Tailwind equivalents (closest named class, for template-only usage):
 *   value        bg-violet-600  text-violet-600  border-violet-300
 *   function     bg-green-600   text-green-600   border-green-300
 *   solution     bg-orange-600  text-orange-600  border-orange-300
 *   constraint   bg-red-600     text-red-600     border-red-300
 *   evo-step     bg-yellow-600  text-yellow-600  border-yellow-300
 *   task         bg-gray-700    text-gray-700    border-gray-300
 *   stakeholder  bg-blue-600    text-blue-600    border-blue-300
 *   resource     bg-green-800   text-green-800   border-green-400
 */

export interface SpecTypeColourSet {
  base:   string
  light:  string
  border: string
  dark:   string
  accent: string
  onBase: string
  glow:   string   // "r, g, b"
}

export const SPEC_COLOURS: Record<string, SpecTypeColourSet> = {
  value: {
    base:   '#7c3aed',
    light:  '#f5f3ff',
    border: '#c4b5fd',
    dark:   '#5b21b6',
    accent: '#a78bfa',
    onBase: '#ffffff',
    glow:   '124, 58, 237',
  },
  function: {
    base:   '#16a34a',
    light:  '#f0fdf4',
    border: '#86efac',
    dark:   '#166534',
    accent: '#4ade80',
    onBase: '#ffffff',
    glow:   '22, 163, 74',
  },
  solution: {
    base:   '#ea580c',
    light:  '#fff7ed',
    border: '#fdba74',
    dark:   '#9a3412',
    accent: '#fb923c',
    onBase: '#ffffff',
    glow:   '234, 88, 12',
  },
  constraint: {
    base:   '#dc2626',
    light:  '#fef2f2',
    border: '#fca5a5',
    dark:   '#991b1b',
    accent: '#f87171',
    onBase: '#ffffff',
    glow:   '220, 38, 38',
  },
  'evo-step': {
    base:   '#ca8a04',
    light:  '#fefce8',
    border: '#fde047',
    dark:   '#713f12',
    accent: '#facc15',
    onBase: '#ffffff',
    glow:   '202, 138, 4',
  },
  task: {
    base:   '#374151',
    light:  '#f9fafb',
    border: '#d1d5db',
    dark:   '#111827',
    accent: '#6b7280',
    onBase: '#ffffff',
    glow:   '55, 65, 81',
  },
  stakeholder: {
    base:   '#2563eb',
    light:  '#eff6ff',
    border: '#93c5fd',
    dark:   '#1e40af',
    accent: '#60a5fa',
    onBase: '#ffffff',
    glow:   '37, 99, 235',
  },
  resource: {
    base:   '#166534',   // dark green-800 — "green for money" (Kai). Distinct from function #16a34a by luminance.
    light:  '#f0fdf4',
    border: '#4ade80',
    dark:   '#14532d',
    accent: '#22c55e',
    onBase: '#ffffff',
    glow:   '22, 101, 52',
  },
}

/** Resolve colours by single-letter entry-type prefix (F / V / S / C / T / E / R). */
export function coloursByPrefix(prefix: string): SpecTypeColourSet {
  switch (prefix.toUpperCase()) {
    case 'V': return SPEC_COLOURS.value
    case 'F': return SPEC_COLOURS.function
    case 'S': return SPEC_COLOURS.solution
    case 'C': return SPEC_COLOURS.constraint
    case 'T': return SPEC_COLOURS.task
    case 'E': return SPEC_COLOURS['evo-step']
    case 'R': return SPEC_COLOURS.resource
    default:  return SPEC_COLOURS.task
  }
}

/** Resolve colours by full spec type key string (e.g. "value", "evo-step"). */
export function coloursByType(type: string): SpecTypeColourSet {
  return SPEC_COLOURS[type.toLowerCase()] ?? SPEC_COLOURS.task
}
