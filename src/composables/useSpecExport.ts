// UNIT_TYPE=Hook
// useSpecExport — serialises a SpecBlock object to Planguage Markdown
// Stub implementation for Evo Step 1; full serialiser in Evo Step 3 (S.EvoStep3.SerialiserComposable)
// Spec: S.EvoStep1.ComposableImpl

import type { SpecBlock, FEntry, VEntry, SEntry } from '../types/spec'

const PLACEHOLDER = (field: string) => `<!-- MISSING — ${field} fill before export -->`

function serialiseFEntry(entry: FEntry): string {
  return [
    `#### ${entry.id}`,
    `Type: ${entry.type || PLACEHOLDER('Type')}`,
    `Level: ${entry.level || PLACEHOLDER('Level')}`,
    `Description: ${entry.description || PLACEHOLDER('Description')}`,
    `Success-Criteria: ${entry.successCriteria || PLACEHOLDER('Success-Criteria')}`,
    `Function of Value: ${entry.functionOfValue || PLACEHOLDER('Function of Value')}`,
  ].join('\n')
}

function serialiseVEntry(entry: VEntry): string {
  return [
    `#### ${entry.id}`,
    `Type: ${entry.type || PLACEHOLDER('Type')}`,
    `Level: ${entry.level || PLACEHOLDER('Level')}`,
    `Description: ${entry.description || PLACEHOLDER('Description')}`,
    `Scale: ${entry.scale || PLACEHOLDER('Scale')}`,
    `Meter: ${entry.meter || PLACEHOLDER('Meter')}`,
    `Status: ${entry.status || PLACEHOLDER('Status')}`,
    `Tolerable: ${entry.tolerable || PLACEHOLDER('Tolerable')}`,
    `Goal: ${entry.goal || PLACEHOLDER('Goal')}`,
    `Value of function: ${entry.valueOfFunction || PLACEHOLDER('Value of function')}`,
  ].join('\n')
}

function serialiseSEntry(entry: SEntry): string {
  return [
    `#### ${entry.id}`,
    `Type: ${entry.type || PLACEHOLDER('Type')}`,
    `Level: ${entry.level || PLACEHOLDER('Level')}`,
    `Description: ${entry.description || PLACEHOLDER('Description')}`,
    `Impact: ${entry.impact || PLACEHOLDER('Impact')}`,
    `Function: ${entry.function || PLACEHOLDER('Function')}`,
  ].join('\n')
}

/**
 * Composable for serialising a SpecBlock to Planguage Markdown.
 *
 * Outputs entries in F → V → S order.  Any required field that is an empty
 * string emits an HTML placeholder comment so reviewers can locate gaps before
 * exporting to a live spec document.
 *
 * @returns {{ serialise }}
 *   - serialise(spec): converts a SpecBlock to a Markdown string; returns empty
 *     string when all three arrays are empty.
 *
 * Preconditions: all entry `id` fields must be non-empty (used as section headers).
 * Errors: no exception is thrown for empty arrays or empty id strings; output may
 *   contain blank headers if ids are omitted.
 */
export function useSpecExport() {
  function serialise(spec: SpecBlock): string {
    const sections: string[] = []

    for (const entry of spec.functions) {
      sections.push(serialiseFEntry(entry))
    }
    for (const entry of spec.values) {
      sections.push(serialiseVEntry(entry))
    }
    for (const entry of spec.solutions) {
      sections.push(serialiseSEntry(entry))
    }

    return sections.join('\n\n')
  }

  return { serialise }
}
