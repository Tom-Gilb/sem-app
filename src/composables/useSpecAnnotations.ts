// useSpecAnnotations.ts — Feature #200: Spec Quality Annotations
// Per-entry quality flags with four types: missing | ambiguous | misleading | conflicting
// Two sources: 'ai' (quality check) and 'manual' (user-set).
// AI re-runs replace only previous ai-sourced annotations; manual ones survive.
// Stored in localStorage: 'sem-spec-annotations', keyed by planModelId.

import { ref, computed } from 'vue'

// ── Types ─────────────────────────────────────────────────────────────────────

export type AnnotationType = 'missing' | 'ambiguous' | 'misleading' | 'conflicting'

export interface ConflictRef {
  /** 'same-spec' = another entry in this plan; 'cross-spec' = entry in a different saved plan */
  scope: 'same-spec' | 'cross-spec'
  /** For same-spec conflicts: the conflicting entry ID (e.g. "F.DataMinimisation") */
  entryId?: string
  /** For cross-spec: the other plan model's display name */
  specName?: string
  /** For cross-spec: the other plan model's ID (for linking) */
  specModelId?: string
  /** Human-readable explanation of the conflict */
  description: string
}

export interface SpecAnnotation {
  /** The F./V./S. entry ID being annotated */
  entryId: string
  type: AnnotationType
  /** 1–2 sentence explanation of the issue */
  note: string
  /** Populated for 'conflicting' type; empty array for others */
  conflictsWith: ConflictRef[]
  /** 'ai' = set by quality check run; 'manual' = user-set via flag button */
  source: 'ai' | 'manual'
  updatedAt: string
}

// ── Singleton store ───────────────────────────────────────────────────────────

const STORAGE_KEY = 'sem-spec-annotations'

/** Map: planModelId → Record<entryId, SpecAnnotation> */
const _store = ref<Record<string, Record<string, SpecAnnotation>>>(
  (() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') }
    catch { return {} }
  })(),
)

function _persist(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(_store.value))
}

// ── External hooks for plan import / export ──────────────────────────────────
// Mirror of the hooks in usePriorityRecord.ts. Allows usePlanModel to transfer
// an entire plan's annotations as a sidecar block on export and restore them
// on import in one shot. Updating `_store.value` keeps live subscribers in
// sync without a page reload.

/** Read all annotations for one plan (used by `exportPlanModel`). */
export function _getAnnotationsForPlan(planModelId: string): Record<string, SpecAnnotation> {
  return _store.value[planModelId] ?? {}
}

/**
 * Replace all annotations for one plan in one shot (used by
 * `importPlanModel`). Persists to localStorage AND updates the reactive
 * store so live subscribers re-render immediately.
 */
export function _setAnnotationsForPlan(planModelId: string, annotations: Record<string, SpecAnnotation>): void {
  _store.value = { ..._store.value, [planModelId]: annotations }
  _persist()
}

// ── Composable ────────────────────────────────────────────────────────────────

export function useSpecAnnotations(planModelId: string) {

  /** All annotations for this plan model, keyed by entryId */
  const annotationMap = computed<Record<string, SpecAnnotation>>(
    () => _store.value[planModelId] ?? {},
  )

  /** Get the annotation for a specific entry, or null */
  function getAnnotation(entryId: string): SpecAnnotation | null {
    return annotationMap.value[entryId] ?? null
  }

  /** Manually set or update an annotation (source = 'manual'). */
  function setAnnotation(
    entryId: string,
    type: AnnotationType,
    note: string,
    conflictsWith: ConflictRef[] = [],
  ): void {
    const existing = _store.value[planModelId] ?? {}
    _store.value = {
      ..._store.value,
      [planModelId]: {
        ...existing,
        [entryId]: {
          entryId, type, note, conflictsWith,
          source: 'manual',
          updatedAt: new Date().toISOString(),
        },
      },
    }
    _persist()
  }

  /** Remove the annotation for an entry. */
  function clearAnnotation(entryId: string): void {
    const existing = { ...(_store.value[planModelId] ?? {}) }
    delete existing[entryId]
    _store.value = { ..._store.value, [planModelId]: existing }
    _persist()
  }

  /**
   * Merge a fresh set of AI-detected annotations into the store.
   * Replaces all previous 'ai'-sourced entries with the new set.
   * 'manual'-sourced entries are never overwritten.
   */
  function mergeAiAnnotations(aiAnnotations: SpecAnnotation[]): void {
    const existing = _store.value[planModelId] ?? {}
    // Preserve only manual annotations
    const preserved: Record<string, SpecAnnotation> = {}
    for (const [eid, ann] of Object.entries(existing)) {
      if (ann.source === 'manual') preserved[eid] = ann
    }
    // Add all AI annotations (manual takes priority if same entry)
    for (const ann of aiAnnotations) {
      if (!preserved[ann.entryId]) {
        preserved[ann.entryId] = { ...ann, source: 'ai' }
      }
    }
    _store.value = { ..._store.value, [planModelId]: preserved }
    _persist()
  }

  /** Clear all AI-sourced annotations (keeps manual ones). */
  function clearAiAnnotations(): void {
    const existing = _store.value[planModelId] ?? {}
    const manualOnly: Record<string, SpecAnnotation> = {}
    for (const [eid, ann] of Object.entries(existing)) {
      if (ann.source === 'manual') manualOnly[eid] = ann
    }
    _store.value = { ..._store.value, [planModelId]: manualOnly }
    _persist()
  }

  /** Clear every annotation for this plan model. */
  function clearAll(): void {
    _store.value = { ..._store.value, [planModelId]: {} }
    _persist()
  }

  const hasAnyAnnotation = computed(
    () => Object.keys(annotationMap.value).length > 0,
  )

  const annotationCounts = computed<Record<AnnotationType, number>>(() => {
    const counts: Record<AnnotationType, number> = {
      missing: 0, ambiguous: 0, misleading: 0, conflicting: 0,
    }
    for (const ann of Object.values(annotationMap.value)) counts[ann.type]++
    return counts
  })

  const totalAnnotations = computed(
    () => Object.keys(annotationMap.value).length,
  )

  return {
    annotationMap,
    getAnnotation,
    setAnnotation,
    clearAnnotation,
    mergeAiAnnotations,
    clearAiAnnotations,
    clearAll,
    hasAnyAnnotation,
    annotationCounts,
    totalAnnotations,
  }
}
