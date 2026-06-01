<!--
  PlTypeBadge.vue — Colour-Glyph-First rule (DD-010, 2026-06-01).
  Renders the canonical PlTypeIcon glyph + optionally the spelled-out type name.

  Universal label rule (Tom Gilb, 2026-06-01):
    Any surface that shows a Planguage type code (F. V. C. R. S. Task) to a
    user who may not know Planguage MUST render the full spelled-out name
    alongside the glyph. Use show-label whenever the badge appears as a
    standalone identifier (card headers, list rows, filter chips, table cells).
    Icon-only (show-label omitted/false) is reserved for space-critical layouts
    where the full name is already visible nearby (e.g. compact count clusters).

  Accepts any input format:
    - Full lowercase name:  'function', 'value', 'solution', 'constraint',
                            'resource', 'stakeholder', 'evo-step', 'task'
    - Single uppercase letter: 'F', 'V', 'S', 'C', 'R', 'K', 'E', 'T'
    - Either case variant:  'Function', 'Value', etc.

  Renders nothing (safely) for unknown types — no runtime errors.

  Usage:
    <PlTypeBadge entry-type="function" />                   ← icon only
    <PlTypeBadge entry-type="F" show-label />               ← "🟢 Function"
    <PlTypeBadge entry-type="value" size="md" show-label /> ← larger + label

  Twin-portability: the type mapping is a pure Record — no Vue API involved.
  The normalisation logic can be ported to any language as a lookup table.

  DD-010: every entry-type badge on a button, chip, card, or list row
  MUST use PlTypeBadge (or PlTypeIcon directly) — never raw text with
  TYPE_BADGE_CLASS or locally-defined colour classes.
-->
<script setup lang="ts">
// UNIT_TYPE=Widget
import { computed } from 'vue'
import PlTypeIcon, { type PlGlyphType } from './PlTypeIcon.vue'

const props = withDefaults(defineProps<{
  /** The entry type — full name ('function') or letter abbreviation ('F'). Case-insensitive. */
  entryType: string
  /** Glyph size. Default 'sm' (20 px) — fits inline in list rows and badges. */
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Optional tooltip override. Defaults to PlTypeIcon canonical label. */
  title?: string
  /**
   * When true: render the full spelled-out type name after the glyph icon.
   * Universal label rule — use whenever the badge is a standalone identifier.
   * Color matches the canonical glyph color for each type.
   */
  showLabel?: boolean
}>(), {
  size: 'sm',
  showLabel: false,
})

/** Normalise any incoming type string to a canonical PlGlyphType. */
const LETTER_MAP: Record<string, PlGlyphType> = {
  f: 'function',
  v: 'value',
  s: 'solution',
  c: 'constraint',
  r: 'resource',
  k: 'stakeholder',
  e: 'evo-step',
  t: 'task',
}

/** Canonical spelled-out names — shown when showLabel is true. */
const LABEL_SHORT: Record<PlGlyphType, string> = {
  'function':    'Function',
  'value':       'Value',
  'constraint':  'Constraint',
  'resource':    'Resource',
  'stakeholder': 'Stakeholder',
  'solution':    'Solution',
  'evo-step':    'Evo Step',
  'task':        'Task',
}

/**
 * Label text color — matches the canonical icon fill color per type
 * (defined in PlTypeIcon.vue's CANONICAL_LABELS comment block).
 */
const LABEL_COLORS: Record<PlGlyphType, string> = {
  'value':       '#7c3aed',   // violet
  'function':    '#16a34a',   // green
  'constraint':  '#dc2626',   // red
  'resource':    '#166534',   // dark green
  'stakeholder': '#2563eb',   // blue
  'solution':    '#ea580c',   // orange
  'evo-step':    '#ca8a04',   // amber
  'task':        '#374151',   // slate
}

/** Label font size — scales with icon size for visual harmony. */
const LABEL_FONT_SIZE: Record<NonNullable<typeof props.size>, string> = {
  'sm': '10px',
  'md': '11px',
  'lg': '13px',
  'xl': '15px',
}

const glyphType = computed((): PlGlyphType | null => {
  const raw = props.entryType?.trim().toLowerCase() ?? ''
  if (!raw) return null
  // Try full name first (already lowercase)
  const fullNames: PlGlyphType[] = [
    'function', 'value', 'solution', 'constraint',
    'resource', 'stakeholder', 'evo-step', 'task',
  ]
  if (fullNames.includes(raw as PlGlyphType)) return raw as PlGlyphType
  // Try single letter
  if (raw.length === 1 && LETTER_MAP[raw]) return LETTER_MAP[raw]
  return null
})
</script>

<template>
  <span :class="showLabel ? 'inline-flex items-center gap-1' : 'inline-flex'">
    <PlTypeIcon
      v-if="glyphType"
      :pl-type="glyphType"
      :size="size"
      :title="title"
    />
    <!-- Graceful fallback for unknown types: dim monospace letter -->
    <span
      v-else
      class="inline-flex items-center justify-center text-[10px] font-mono
             text-slate-400 opacity-60 leading-none"
      :title="`Unknown entry type: ${entryType}`"
      aria-hidden="true"
    >{{ entryType }}.</span>

    <!-- Spelled-out label (universal label rule) -->
    <span
      v-if="showLabel && glyphType"
      class="font-semibold leading-none whitespace-nowrap"
      :style="{ fontSize: LABEL_FONT_SIZE[size], color: LABEL_COLORS[glyphType] }"
    >{{ LABEL_SHORT[glyphType] }}</span>
  </span>
</template>
