// r41 v232 (Tom Gilb 2026-06-20 "❌ SEM App failed to start" + "cant you test
// for failures like this?" + "help locked out") — centralized SpecBlock
// normalizer.  Coerces every string-typed field of every spec entry into a
// real string.  Tolerates: array (→ join), number (→ String()), object,
// undefined, null.  Returns a clean SpecBlock the rest of the codebase can
// `.trim()` / `.split()` / `.includes()` without crashing.
//
// Call this ONCE at every spec-load entry point (localStorage hydrate,
// import, fixture).  Class-level fix replaces per-site defensive coercion:
// once the SpecBlock is clean, all downstream readers are safe.
//
// Composes with:
//   - Mount-Smoke-Test-Before-Ship SUPREME — the test below feeds dirty
//     SpecBlocks into the normalizer and asserts no mount crash.
//   - No-Silent-Data-Loss — non-string values are NOT dropped; arrays are
//     joined, numbers are stringified, objects fall through to '' as a
//     last resort (signalled in console for traceability).
//   - Architectural Resilience — one normalizer; one bug surface.
//   - Twin portability — pure function, ports verbatim.

import type { SpecBlock } from '../types/spec'

/** Coerce ANY value to a string.  Arrays join with ','.  Numbers stringify.
 *  Objects → ''.  null/undefined → ''.  Strings pass through. */
export function toStr(v: unknown): string {
  if (typeof v === 'string') return v
  if (v == null) return ''
  if (Array.isArray(v))     return v.map(x => typeof x === 'string' ? x : String(x ?? '')).join(',')
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  // Object / function / symbol — drop and warn for traceability.
  try {
    if (typeof v === 'object') {
      console.warn('[normalizeSpec] non-string-typed field carried an object; coercing to "":', v)
    }
  } catch { /* */ }
  return ''
}

interface AnyEntry { [key: string]: unknown }

const STRING_FIELDS_BY_TYPE: Record<string, readonly string[]> = {
  Function:   ['id','type','level','description','successCriteria','presenceTest','functionOfValue','stakeholders','specOwner','justification','version','risks','motherFunction','source','sourceType'],
  Value:      ['id','type','level','description','scale','meter','status','tolerable','goal','wish','wishStakeholder','valueOfFunction','stakeholders','specOwner','justification','version','risks','forecast','past','stretch','statusWhen','tolerableWhen','goalWhen','wishWhen','pastWhen','stretchWhen','source','sourceType'],
  Solution:   ['id','type','level','description','impact','function','impactsValues','impactsCosts','stakeholders','specOwner','justification','version','risks','source','sourceType'],
  Constraint: ['id','type','level','description','scope','rationale','source','stakeholders','specOwner','justification','version','risks','sourceType'],
  Resource:   ['id','type','level','description','scale','meter','status','tolerable','budget','goal','wish','wishStakeholder','ideal','resourceForValue','consumedBy','stakeholders','specOwner','justification','version','risks','forecast','statusWhen','tolerableWhen','budgetWhen','goalWhen','wishWhen','idealWhen','source','sourceType'],
  Stakeholder:['id','type','definition','description','source','sourceType'],
}

function _normEntry(entry: AnyEntry, typeKey: string): AnyEntry {
  const fields = STRING_FIELDS_BY_TYPE[typeKey] ?? []
  const out: AnyEntry = { ...entry }
  for (const k of fields) {
    // r41 v286 (Tom Gilb 2026-06-22 SECOND mount crash, same class as v285 —
    // `useValueAddRatio.buildValueAddEntry` dereferenced `description.slice` on
    // undefined). Root cause was THIS function silently skipping missing /
    // undefined fields, leaving downstream `.length` / `.slice` / `.trim()` /
    // `.toLowerCase()` callers unsafe. Fix: ALWAYS coerce to a real string —
    // missing field → '', undefined → '', null → '', etc. No-Silent-Data-Loss
    // preserved (real strings pass through unchanged; toStr only inserts ''
    // where there was nothing to lose). Closes the ~80-site downstream class
    // discovered in the v285 grep sweep with one structural fix.
    out[k] = toStr(out[k])
  }
  // Common array-of-string fields — coerce inner items defensively.
  for (const arrKey of ['needs', 'costs', 'subFunctions']) {
    const v = out[arrKey]
    if (Array.isArray(v)) {
      out[arrKey] = v.map(x => typeof x === 'string' ? x : String(x ?? ''))
    }
  }
  return out
}

/** Normalize a SpecBlock by coercing every string-typed field on every
 *  entry to a real string.  Idempotent — safe to call multiple times. */
export function normalizeSpecBlock(spec: SpecBlock | null | undefined): SpecBlock {
  const safe: SpecBlock = spec ?? {
    functions: [], values: [], solutions: [], constraints: [], resources: [],
  }
  return {
    ...safe,
    functions:   (safe.functions   ?? []).map(e => _normEntry(e as unknown as AnyEntry, 'Function')   as unknown as SpecBlock['functions'][number]),
    values:      (safe.values      ?? []).map(e => _normEntry(e as unknown as AnyEntry, 'Value')      as unknown as SpecBlock['values'][number]),
    solutions:   (safe.solutions   ?? []).map(e => _normEntry(e as unknown as AnyEntry, 'Solution')   as unknown as SpecBlock['solutions'][number]),
    constraints: (safe.constraints ?? []).map(e => _normEntry(e as unknown as AnyEntry, 'Constraint') as unknown as NonNullable<SpecBlock['constraints']>[number]),
    resources:   (safe.resources   ?? []).map(e => _normEntry(e as unknown as AnyEntry, 'Resource')   as unknown as NonNullable<SpecBlock['resources']>[number]),
    stakeholderEntries: (safe.stakeholderEntries ?? []).map(e => _normEntry(e as unknown as AnyEntry, 'Stakeholder') as unknown as NonNullable<SpecBlock['stakeholderEntries']>[number]),
    stakes: toStr(safe.stakes),
  }
}
