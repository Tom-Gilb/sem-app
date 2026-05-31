/**
 * iconRegistry.ts — maps well-known emoji strings to their canonical
 * SEM Planguage glyph Component.
 *
 * Used by data-driven surfaces (Bullock audit table, Maria board, etc.) to
 * swap a raw emoji for the consistent, Twin-portable SVG glyph when one exists.
 *
 * Tom 2026-05-31 (#7b): "Extend icon-registry to hold a Component slot,
 * then swap 5 data-driven ✏️ sites (emoji maps)."
 *
 * To add a new mapping in future:
 *   1. import the Glyph component at the top of this file
 *   2. add an entry to ICON_COMPONENTS below
 *
 * Twin note: this file has NO Vue reactivity — plain ESM export; safe to
 * import anywhere (composables, plain TypeScript, test files).
 */

import type { Component } from 'vue'
import EditGlyph from '../components/icons/EditGlyph.vue'

/**
 * Emoji → Component map.
 * Keep entries alphabetically sorted by emoji codepoint for readability.
 */
export const ICON_COMPONENTS: Readonly<Record<string, Component>> = {
  '✏️': EditGlyph,
  // Future entries:
  // '💾': SaveGlyph,
  // '📋': CopyGlyph,
  // '📧': EmailGlyph,
} as const

/**
 * Resolve an emoji string to its registered Component, or null if none.
 *
 * Usage in templates (v-if / v-else pattern avoids dynamic :is on spans):
 *   <component v-if="resolveIcon(emoji)" :is="resolveIcon(emoji)" size="compact" aria-hidden="true" />
 *   <span v-else aria-hidden="true">{{ emoji }}</span>
 */
export function resolveIcon(emoji: string): Component | null {
  return (ICON_COMPONENTS as Record<string, Component>)[emoji] ?? null
}
