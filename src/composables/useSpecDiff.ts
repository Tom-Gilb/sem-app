// UNIT_TYPE=Hook
// useSpecDiff — compares two SpecBlock objects field by field (Feature #26)

import type { SpecBlock } from '../types/spec'

export interface FieldChange {
  entryId: string       // e.g. "V.UserRetention"
  entryType: 'F' | 'V' | 'S'
  field: string         // e.g. "goal", "description"
  oldValue: string
  newValue: string
}

/**
 * Composable for diffing two SpecBlock snapshots field by field.
 *
 * Returns only fields that changed between oldSpec and newSpec.
 * Entries present in newSpec but not oldSpec are recorded with oldValue "(new entry)".
 * Entries present in oldSpec but not newSpec are recorded with newValue "(removed)".
 */
export function useSpecDiff() {
  /**
   * Compares two SpecBlocks and returns a flat list of FieldChange objects
   * for every field that differs between them.
   */
  function diffSpecs(oldSpec: SpecBlock, newSpec: SpecBlock): FieldChange[] {
    const changes: FieldChange[] = []

    // ── V. entries (Values) ────────────────────────────────────────────────────
    const V_FIELDS = ['description', 'scale', 'meter', 'goal', 'tolerable', 'status'] as const

    // Build lookup maps by id
    const oldVById = new Map(oldSpec.values.map((v) => [v.id, v]))
    const newVById = new Map(newSpec.values.map((v) => [v.id, v]))

    // Entries in new spec: compare or mark as new
    for (const newV of newSpec.values) {
      const oldV = oldVById.get(newV.id)
      if (!oldV) {
        // New entry — report all populated fields as changed from "(new entry)"
        for (const field of V_FIELDS) {
          if (newV[field]) {
            changes.push({
              entryId: newV.id,
              entryType: 'V',
              field,
              oldValue: '(new entry)',
              newValue: newV[field],
            })
          }
        }
      } else {
        // Existing entry — compare each field
        for (const field of V_FIELDS) {
          if (oldV[field] !== newV[field]) {
            changes.push({
              entryId: newV.id,
              entryType: 'V',
              field,
              oldValue: oldV[field],
              newValue: newV[field],
            })
          }
        }
      }
    }

    // Entries removed from old spec
    for (const oldV of oldSpec.values) {
      if (!newVById.has(oldV.id)) {
        for (const field of V_FIELDS) {
          if (oldV[field]) {
            changes.push({
              entryId: oldV.id,
              entryType: 'V',
              field,
              oldValue: oldV[field],
              newValue: '(removed)',
            })
          }
        }
      }
    }

    // ── F. entries (Functions) ─────────────────────────────────────────────────
    const F_FIELDS = ['description', 'successCriteria'] as const

    const oldFById = new Map(oldSpec.functions.map((f) => [f.id, f]))
    const newFById = new Map(newSpec.functions.map((f) => [f.id, f]))

    for (const newF of newSpec.functions) {
      const oldF = oldFById.get(newF.id)
      if (!oldF) {
        for (const field of F_FIELDS) {
          if (newF[field]) {
            changes.push({
              entryId: newF.id,
              entryType: 'F',
              field,
              oldValue: '(new entry)',
              newValue: newF[field],
            })
          }
        }
      } else {
        for (const field of F_FIELDS) {
          if (oldF[field] !== newF[field]) {
            changes.push({
              entryId: newF.id,
              entryType: 'F',
              field,
              oldValue: oldF[field],
              newValue: newF[field],
            })
          }
        }
      }
    }

    for (const oldF of oldSpec.functions) {
      if (!newFById.has(oldF.id)) {
        for (const field of F_FIELDS) {
          if (oldF[field]) {
            changes.push({
              entryId: oldF.id,
              entryType: 'F',
              field,
              oldValue: oldF[field],
              newValue: '(removed)',
            })
          }
        }
      }
    }

    // ── S. entries (Solutions) ─────────────────────────────────────────────────
    const S_FIELDS = ['description', 'impact'] as const

    const oldSById = new Map(oldSpec.solutions.map((s) => [s.id, s]))
    const newSById = new Map(newSpec.solutions.map((s) => [s.id, s]))

    for (const newS of newSpec.solutions) {
      const oldS = oldSById.get(newS.id)
      if (!oldS) {
        for (const field of S_FIELDS) {
          if (newS[field]) {
            changes.push({
              entryId: newS.id,
              entryType: 'S',
              field,
              oldValue: '(new entry)',
              newValue: newS[field],
            })
          }
        }
      } else {
        for (const field of S_FIELDS) {
          if (oldS[field] !== newS[field]) {
            changes.push({
              entryId: newS.id,
              entryType: 'S',
              field,
              oldValue: oldS[field],
              newValue: newS[field],
            })
          }
        }
      }
    }

    for (const oldS of oldSpec.solutions) {
      if (!newSById.has(oldS.id)) {
        for (const field of S_FIELDS) {
          if (oldS[field]) {
            changes.push({
              entryId: oldS.id,
              entryType: 'S',
              field,
              oldValue: oldS[field],
              newValue: '(removed)',
            })
          }
        }
      }
    }

    return changes
  }

  return { diffSpecs }
}
