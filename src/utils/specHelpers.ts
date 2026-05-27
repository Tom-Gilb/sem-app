/**
 * specHelpers — Utilities for detecting incomplete Value specifications
 *
 * Provides functions to check if a Value entry is incomplete and what fields are missing.
 * Used by SpecEditorPanel to show "Incomplete" badges and draft buttons.
 */

import type { VEntry } from '../types/spec'

/**
 * Check if a Value entry is incomplete (missing scale, tolerable, or wish).
 */
export function isValueIncomplete(entry: VEntry): boolean {
  return !entry.scale || !entry.tolerable || !entry.wish
}

/**
 * Get array of missing field names for a Value entry.
 * Example: ['scale', 'wish']
 */
export function missingValueFields(entry: VEntry): string[] {
  const missing: string[] = []
  if (!entry.scale) missing.push('scale')
  if (!entry.tolerable) missing.push('tolerable')
  if (!entry.wish) missing.push('wish')
  return missing
}

/**
 * Get a human-readable label of missing fields.
 * Example: "scale, wish"
 */
export function missingFieldsLabel(entry: VEntry): string {
  return missingValueFields(entry).join(', ')
}
