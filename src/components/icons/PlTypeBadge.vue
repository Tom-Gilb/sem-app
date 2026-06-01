<!--
  PlTypeBadge.vue — Colour-Glyph-First rule (DD-010, 2026-06-01).
  Replaces raw text letter badges ("F.", "V.", etc.) with the canonical
  PlTypeIcon glyph at size="sm" (20 px).

  Accepts any input format:
    - Full lowercase name:  'function', 'value', 'solution', 'constraint',
                            'resource', 'stakeholder', 'evo-step', 'task'
    - Single uppercase letter: 'F', 'V', 'S', 'C', 'R', 'K', 'E', 'T'
    - Either case variant:  'Function', 'Value', etc.

  Renders nothing (safely) for unknown types — no runtime errors.

  Usage:
    <PlTypeBadge entry-type="function" />
    <PlTypeBadge entry-type="F" />
    <PlTypeBadge entry-type="value" size="md" />

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
}>(), {
  size: 'sm',
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
</template>
