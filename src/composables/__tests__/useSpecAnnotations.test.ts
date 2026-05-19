// UNIT_TYPE=Test
// Tests for useSpecAnnotations composable (Feature #200 — Spec Quality Annotations)
// Verifies: setAnnotation, clearAnnotation, mergeAiAnnotations (AI/manual separation),
// clearAiAnnotations, clearAll, annotationCounts, totalAnnotations, hasAnyAnnotation,
// cross-model isolation, and singleton persistence.

import { describe, it, expect, beforeEach } from 'vitest'
import { useSpecAnnotations } from '../useSpecAnnotations'
import type { SpecAnnotation } from '../useSpecAnnotations'

// Unique model IDs so tests don't cross-contaminate
const MODEL_A = 'spec-ann-test-model-a'
const MODEL_B = 'spec-ann-test-model-b'

function makeAiAnnotation(entryId: string, note = 'AI-detected issue'): SpecAnnotation {
  return {
    entryId,
    type: 'ambiguous',
    note,
    conflictsWith: [],
    source: 'ai',
    updatedAt: new Date().toISOString(),
  }
}

describe('useSpecAnnotations', () => {
  beforeEach(() => {
    useSpecAnnotations(MODEL_A).clearAll()
    useSpecAnnotations(MODEL_B).clearAll()
  })

  // ── setAnnotation ──────────────────────────────────────────────────────────

  describe('setAnnotation', () => {
    it('stores a manual annotation keyed by entryId', () => {
      const ann = useSpecAnnotations(MODEL_A)
      ann.setAnnotation('F.Test', 'missing', 'Field is empty')
      const result = ann.getAnnotation('F.Test')
      expect(result).not.toBeNull()
      expect(result!.type).toBe('missing')
      expect(result!.note).toBe('Field is empty')
      expect(result!.source).toBe('manual')
    })

    it('overwrites an existing annotation for the same entryId', () => {
      const ann = useSpecAnnotations(MODEL_A)
      ann.setAnnotation('F.Test', 'missing', 'First note')
      ann.setAnnotation('F.Test', 'ambiguous', 'Updated note')
      const result = ann.getAnnotation('F.Test')
      expect(result!.type).toBe('ambiguous')
      expect(result!.note).toBe('Updated note')
    })

    it('stores conflictsWith array for "conflicting" type', () => {
      const ann = useSpecAnnotations(MODEL_A)
      const conflicts = [{ scope: 'same-spec' as const, entryId: 'V.Speed', description: 'Contradicts speed target' }]
      ann.setAnnotation('F.Slow', 'conflicting', 'Conflicts with V.Speed', conflicts)
      const result = ann.getAnnotation('F.Slow')
      expect(result!.conflictsWith).toHaveLength(1)
      expect(result!.conflictsWith[0].entryId).toBe('V.Speed')
      expect(result!.conflictsWith[0].description).toBe('Contradicts speed target')
    })

    it('stores empty conflictsWith for non-conflicting types', () => {
      const ann = useSpecAnnotations(MODEL_A)
      ann.setAnnotation('F.A', 'missing', 'No conflict')
      expect(ann.getAnnotation('F.A')!.conflictsWith).toEqual([])
    })
  })

  // ── clearAnnotation ────────────────────────────────────────────────────────

  describe('clearAnnotation', () => {
    it('removes a specific annotation without touching others', () => {
      const ann = useSpecAnnotations(MODEL_A)
      ann.setAnnotation('F.A', 'missing', 'Note A')
      ann.setAnnotation('F.B', 'ambiguous', 'Note B')
      ann.clearAnnotation('F.A')
      expect(ann.getAnnotation('F.A')).toBeNull()
      expect(ann.getAnnotation('F.B')).not.toBeNull()
    })

    it('is a no-op when the entry has no annotation', () => {
      const ann = useSpecAnnotations(MODEL_A)
      expect(() => ann.clearAnnotation('F.NotExist')).not.toThrow()
      expect(ann.totalAnnotations.value).toBe(0)
    })
  })

  // ── mergeAiAnnotations ─────────────────────────────────────────────────────

  describe('mergeAiAnnotations', () => {
    it('adds AI annotations for new entries', () => {
      const ann = useSpecAnnotations(MODEL_A)
      ann.mergeAiAnnotations([makeAiAnnotation('F.New'), makeAiAnnotation('V.Goal')])
      expect(ann.getAnnotation('F.New')).not.toBeNull()
      expect(ann.getAnnotation('V.Goal')).not.toBeNull()
    })

    it('marks merged annotations with source="ai"', () => {
      const ann = useSpecAnnotations(MODEL_A)
      ann.mergeAiAnnotations([makeAiAnnotation('F.X')])
      expect(ann.getAnnotation('F.X')!.source).toBe('ai')
    })

    it('replaces all previous AI annotations on re-run', () => {
      const ann = useSpecAnnotations(MODEL_A)
      ann.mergeAiAnnotations([makeAiAnnotation('F.Old', 'Old AI note')])
      ann.mergeAiAnnotations([makeAiAnnotation('F.New', 'New AI note')])
      // Previous AI annotation is gone; new one is present
      expect(ann.getAnnotation('F.Old')).toBeNull()
      expect(ann.getAnnotation('F.New')!.note).toBe('New AI note')
    })

    it('preserves manual annotations across AI re-runs', () => {
      const ann = useSpecAnnotations(MODEL_A)
      ann.setAnnotation('F.Manual', 'misleading', 'User flagged this')
      ann.mergeAiAnnotations([makeAiAnnotation('F.AiOnly')])
      const result = ann.getAnnotation('F.Manual')
      expect(result).not.toBeNull()
      expect(result!.source).toBe('manual')
      expect(result!.note).toBe('User flagged this')
    })

    it('manual annotation wins over AI for the same entryId on re-run', () => {
      const ann = useSpecAnnotations(MODEL_A)
      ann.setAnnotation('F.Contested', 'missing', 'User says missing')
      const aiVersion = { ...makeAiAnnotation('F.Contested', 'AI says ambiguous'), type: 'ambiguous' as const }
      ann.mergeAiAnnotations([aiVersion])
      const result = ann.getAnnotation('F.Contested')
      expect(result!.source).toBe('manual')
      expect(result!.note).toBe('User says missing')
    })

    it('merging an empty array clears all previous AI annotations', () => {
      const ann = useSpecAnnotations(MODEL_A)
      ann.mergeAiAnnotations([makeAiAnnotation('F.OnlyAi')])
      ann.mergeAiAnnotations([])  // empty re-run
      expect(ann.getAnnotation('F.OnlyAi')).toBeNull()
    })
  })

  // ── clearAiAnnotations ─────────────────────────────────────────────────────

  describe('clearAiAnnotations', () => {
    it('removes only AI-sourced annotations; manual ones survive', () => {
      const ann = useSpecAnnotations(MODEL_A)
      ann.setAnnotation('F.Manual', 'ambiguous', 'Manual')
      ann.mergeAiAnnotations([makeAiAnnotation('F.Ai')])
      ann.clearAiAnnotations()
      expect(ann.getAnnotation('F.Manual')).not.toBeNull()
      expect(ann.getAnnotation('F.Ai')).toBeNull()
    })

    it('is a no-op when there are no AI annotations', () => {
      const ann = useSpecAnnotations(MODEL_A)
      ann.setAnnotation('F.Manual', 'missing', 'Only manual')
      ann.clearAiAnnotations()
      expect(ann.getAnnotation('F.Manual')).not.toBeNull()
    })
  })

  // ── clearAll ───────────────────────────────────────────────────────────────

  describe('clearAll', () => {
    it('removes all annotations including manual', () => {
      const ann = useSpecAnnotations(MODEL_A)
      ann.setAnnotation('F.A', 'missing', 'Note')
      ann.mergeAiAnnotations([makeAiAnnotation('F.B')])
      ann.clearAll()
      expect(ann.totalAnnotations.value).toBe(0)
      expect(ann.hasAnyAnnotation.value).toBe(false)
    })
  })

  // ── annotationCounts ───────────────────────────────────────────────────────

  describe('annotationCounts', () => {
    it('returns zero counts when empty', () => {
      const ann = useSpecAnnotations(MODEL_A)
      const counts = ann.annotationCounts.value
      expect(counts.missing).toBe(0)
      expect(counts.ambiguous).toBe(0)
      expect(counts.misleading).toBe(0)
      expect(counts.conflicting).toBe(0)
    })

    it('returns correct counts per type', () => {
      const ann = useSpecAnnotations(MODEL_A)
      ann.setAnnotation('F.A', 'missing', 'A')
      ann.setAnnotation('F.B', 'missing', 'B')
      ann.setAnnotation('V.C', 'ambiguous', 'C')
      ann.setAnnotation('S.D', 'misleading', 'D')
      const counts = ann.annotationCounts.value
      expect(counts.missing).toBe(2)
      expect(counts.ambiguous).toBe(1)
      expect(counts.misleading).toBe(1)
      expect(counts.conflicting).toBe(0)
    })

    it('counts AI and manual annotations together', () => {
      const ann = useSpecAnnotations(MODEL_A)
      ann.setAnnotation('F.Manual', 'missing', 'Manual')
      ann.mergeAiAnnotations([makeAiAnnotation('F.Ai')])
      expect(ann.annotationCounts.value.missing).toBe(1)
      expect(ann.annotationCounts.value.ambiguous).toBe(1)
    })
  })

  // ── totalAnnotations ───────────────────────────────────────────────────────

  describe('totalAnnotations', () => {
    it('is 0 for an empty model', () => {
      expect(useSpecAnnotations(MODEL_A).totalAnnotations.value).toBe(0)
    })

    it('increments as annotations are added', () => {
      const ann = useSpecAnnotations(MODEL_A)
      ann.setAnnotation('F.A', 'missing', 'Note A')
      expect(ann.totalAnnotations.value).toBe(1)
      ann.setAnnotation('F.B', 'ambiguous', 'Note B')
      expect(ann.totalAnnotations.value).toBe(2)
    })

    it('decrements after clearAnnotation', () => {
      const ann = useSpecAnnotations(MODEL_A)
      ann.setAnnotation('F.A', 'missing', 'Note')
      ann.clearAnnotation('F.A')
      expect(ann.totalAnnotations.value).toBe(0)
    })
  })

  // ── hasAnyAnnotation ───────────────────────────────────────────────────────

  describe('hasAnyAnnotation', () => {
    it('is false when store is empty', () => {
      expect(useSpecAnnotations(MODEL_A).hasAnyAnnotation.value).toBe(false)
    })

    it('is true once an annotation is added', () => {
      const ann = useSpecAnnotations(MODEL_A)
      ann.setAnnotation('F.A', 'missing', 'Note')
      expect(ann.hasAnyAnnotation.value).toBe(true)
    })
  })

  // ── cross-model isolation ──────────────────────────────────────────────────

  describe('plan model isolation', () => {
    it('annotations for MODEL_A do not appear in MODEL_B', () => {
      useSpecAnnotations(MODEL_A).setAnnotation('F.Test', 'missing', 'Only in A')
      expect(useSpecAnnotations(MODEL_B).getAnnotation('F.Test')).toBeNull()
      expect(useSpecAnnotations(MODEL_B).totalAnnotations.value).toBe(0)
    })

    it('clearAll on MODEL_A does not affect MODEL_B', () => {
      useSpecAnnotations(MODEL_A).setAnnotation('F.InA', 'missing', 'In A')
      useSpecAnnotations(MODEL_B).setAnnotation('F.InB', 'ambiguous', 'In B')
      useSpecAnnotations(MODEL_A).clearAll()
      expect(useSpecAnnotations(MODEL_B).getAnnotation('F.InB')).not.toBeNull()
    })
  })

  // ── singleton persistence (same planModelId = same reactive state) ─────────

  describe('singleton behaviour', () => {
    it('annotations are visible to a second composable call with the same planModelId', () => {
      useSpecAnnotations(MODEL_A).setAnnotation('F.Persist', 'ambiguous', 'Should persist')
      // Call composable again — same singleton, same reactive state
      const fresh = useSpecAnnotations(MODEL_A)
      expect(fresh.getAnnotation('F.Persist')).not.toBeNull()
    })
  })
})
