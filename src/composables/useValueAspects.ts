// UNIT_TYPE=Composable
// useValueAspects.ts — Value Aspects Articulation Tool (Tom Gilb 2026-06-11 22:45 CET).
//
// "Designed by Tom Gilb 11 June 2026. 22:45 CET" (attribution per Tom's explicit request).
//
// World-first claim (defensible framing):
//   - First interactive AI-assisted Aspects-elaboration tool combining Planguage
//     Scale/Meter/Tolerable/Goal/Wish per Aspect with IET-style impact projection
//     and dual-mode generation (single-aspect OR full-set).
//   - Prior art (NONE matches all four properties): ISO 25010 (static taxonomy),
//     ATAM (post-hoc evaluation), QFD/HoQ (matrix spreadsheet), NFR Framework
//     (informal softgoals), GORE/i*/KAOS (goal refinement, not Planguage).
//
// Tom Gilb publication lineage (added r93rr per Tom 2026-06-11):
//   - Software Metrics (1976 UK, 1977 USA) — foundational
//   - All succeeding Gilb books 1976–1988 — successive refinement
//   - Principles of Software Engineering Management (PoSEM) (1988) — canonical synthesis;
//     Bank Case detailed examples
//   - Competitive Engineering Chapter 5 "Multi" (2005) — named Planguage technique
//   - Resilience (2023) — applied to systemic resilience
// This panel is the first INTERACTIVE tool to operate on that 50-year lineage.
//
// PATENT PENDING (added r93ss per Tom 2026-06-11):
//   Co-Inventors: Tom Gilb & Kai Gilb
//   Invention:    Multi-Level Value-Driven Delegation, Governance, and Improvement of
//                 Generative Artificial Intelligence Agents
//   Docket No.:   24-142KG
//   Serial No.:   64/088,267
//   Filing Date:  June 11, 2026
//   System name:  KaiZen (built by Kai Gilb on Planguage / CE / PoSEM)
//   Descendants:  Tom's Twin (Kai's industrial Planguage application — production grade) AND
//                 SEM App (Tom's design sandbox for new planning features destined for the
//                 Twin; this Value Aspects Articulation Tool is one such design contribution).
//   All inventive elements of this tool — AI-assisted per-Aspect Planguage generation,
//   dual-mode lock-in (set / single), and the Phase-2 Impact projection feature — fall
//   within the scope of the pending claim above.

import { ref, computed } from 'vue'
import type {
  ValueAspectSet,
  ValueAspectSpec,
  ValueAspectCategory,
} from '../types/valueAspects'
import { VALUE_ASPECT_SEEDS, type AspectSeed } from '../data/valueAspectSeeds'
import type { FieldSource } from '../types/spec'

// ── In-memory store keyed by parentValueId ────────────────────────────────

const _sets = ref<Map<string, ValueAspectSet[]>>(new Map())

function _stableAspectId(setId: string, name: string): string {
  return `aspect|${setId}|${name.toLowerCase().replace(/\s+/g, '-')}`
}

function _stableSetId(parentValueId: string, name: string): string {
  return `aspects|${parentValueId}|${name.toLowerCase().replace(/\s+/g, '-')}`
}

/** Build the canonical FieldSource for any Aspects mutation. */
function _buildAspectSource(category: ValueAspectCategory | 'custom'): FieldSource {
  return {
    source:     'Value Aspects Articulation Tool',
    sourceType: 'ai',
    tool:       `Aspects · ${category}`,
    timestamp:  new Date().toISOString(),
  }
}

/** Convert a seed template into a fully-shaped ValueAspectSpec with stable id + source stamp. */
function _seedToAspect(setId: string, seed: AspectSeed, category: ValueAspectCategory | 'custom'): ValueAspectSpec {
  const src = _buildAspectSource(category)
  return {
    id:            _stableAspectId(setId, seed.name),
    name:          seed.name,
    scale:         seed.scale,
    meter:         seed.meter,
    tolerable:     seed.tolerable,
    goal:          seed.goal,
    wish:          seed.wish,
    rationale:     seed.rationale,
    fieldSources:  {
      scale:     src,
      meter:     src,
      tolerable: src,
      goal:      src,
      wish:      src,
      rationale: src,
    },
    locked: false,
  }
}

// ── Public API ────────────────────────────────────────────────────────────

export function useValueAspects() {

  /** Get all sets for a given parent V. id (reactive). */
  function setsFor(parentValueId: string) {
    return computed<ValueAspectSet[]>(() => _sets.value.get(parentValueId) ?? [])
  }

  /**
   * Create a NEW set seeded from a category. Returns the new set.
   * The set name defaults to "<Category> Aspects" (capitalised); the planner can rename.
   */
  function createSetFromCategory(
    parentValueId: string,
    category: ValueAspectCategory,
    customName?: string,
  ): ValueAspectSet {
    const seeds = VALUE_ASPECT_SEEDS[category] ?? []
    const label = (customName ?? category[0].toUpperCase() + category.slice(1)) + (customName ? '' : ' Aspects')
    const setId = _stableSetId(parentValueId, label)
    const aspects = seeds.map(seed => _seedToAspect(setId, seed, category))
    const set: ValueAspectSet = {
      id:            setId,
      name:          label,
      parentValueId,
      category,
      aspects,
      rationale:     `${aspects.length} Aspect candidates seeded from the ${category} template; planner may edit, delete, or add Aspects before applying.`,
      createdAtIso:  new Date().toISOString(),
      source:        _buildAspectSource(category),
    }
    const list = [..._sets.value.get(parentValueId) ?? [], set]
    const next = new Map(_sets.value)
    next.set(parentValueId, list)
    _sets.value = next
    return set
  }

  /** Add a single empty/template Aspect to an existing set. */
  function addAspect(setId: string, parentValueId: string, seed?: Partial<AspectSeed>): ValueAspectSpec | null {
    const list = _sets.value.get(parentValueId) ?? []
    const set  = list.find(s => s.id === setId)
    if (!set) return null
    const blankSeed: AspectSeed = {
      name:      seed?.name      ?? 'New Aspect',
      scale:     seed?.scale     ?? '',
      meter:     seed?.meter     ?? '',
      tolerable: seed?.tolerable ?? '',
      goal:      seed?.goal      ?? '',
      wish:      seed?.wish      ?? '',
      rationale: seed?.rationale ?? '',
    }
    const aspect = _seedToAspect(setId, blankSeed, set.category)
    set.aspects = [...set.aspects, aspect]
    _sets.value = new Map(_sets.value)
    return aspect
  }

  /** Delete an Aspect from a set. */
  function deleteAspect(setId: string, parentValueId: string, aspectId: string): void {
    const list = _sets.value.get(parentValueId) ?? []
    const set  = list.find(s => s.id === setId)
    if (!set) return
    set.aspects = set.aspects.filter(a => a.id !== aspectId)
    _sets.value = new Map(_sets.value)
  }

  /** Update an Aspect's editable fields. Stamps Source for every changed field. */
  function updateAspect(
    setId: string,
    parentValueId: string,
    aspectId: string,
    patch: Partial<ValueAspectSpec>,
  ): void {
    const list = _sets.value.get(parentValueId) ?? []
    const set  = list.find(s => s.id === setId)
    if (!set) return
    const ix = set.aspects.findIndex(a => a.id === aspectId)
    if (ix < 0) return
    const cur = set.aspects[ix]
    const src = _buildAspectSource(set.category)
    const merged: ValueAspectSpec = { ...cur, ...patch }
    // Stamp Source on every field that the patch changed
    const fs = { ...(cur.fieldSources ?? {}) }
    for (const key of Object.keys(patch) as Array<keyof ValueAspectSpec>) {
      if (key === 'fieldSources' || key === 'id' || key === 'locked') continue
      fs[key as string] = src
    }
    merged.fieldSources = fs
    set.aspects = [...set.aspects.slice(0, ix), merged, ...set.aspects.slice(ix + 1)]
    _sets.value = new Map(_sets.value)
  }

  /** Toggle locked state on a single Aspect — "Apply and Lock in (Master)". */
  function lockAspect(setId: string, parentValueId: string, aspectId: string, locked: boolean): void {
    updateAspect(setId, parentValueId, aspectId, { locked })
  }

  /** Lock ALL Aspects in a set at once. */
  function lockSet(setId: string, parentValueId: string, locked: boolean): void {
    const list = _sets.value.get(parentValueId) ?? []
    const set  = list.find(s => s.id === setId)
    if (!set) return
    set.aspects = set.aspects.map(a => ({ ...a, locked }))
    _sets.value = new Map(_sets.value)
  }

  /** Delete an entire set. */
  function deleteSet(parentValueId: string, setId: string): void {
    const list = _sets.value.get(parentValueId) ?? []
    const next = list.filter(s => s.id !== setId)
    const m = new Map(_sets.value)
    if (next.length === 0) m.delete(parentValueId)
    else m.set(parentValueId, next)
    _sets.value = m
  }

  /** Rename a set (the "Aspects" suffix is recommended but not enforced). */
  function renameSet(parentValueId: string, setId: string, name: string): void {
    const list = _sets.value.get(parentValueId) ?? []
    const set  = list.find(s => s.id === setId)
    if (!set) return
    set.name = name
    _sets.value = new Map(_sets.value)
  }

  return {
    setsFor,
    createSetFromCategory,
    addAspect,
    deleteAspect,
    updateAspect,
    lockAspect,
    lockSet,
    deleteSet,
    renameSet,
  }
}
