// UNIT_TYPE=Composable
// Feature #49 — Spec fork and merge
import { ref } from 'vue'
import type { SpecBlock, VEntry } from '../types/spec'

export interface MergeConflict {
  entryId: string
  field: string
  original: string
  forked: string
}

export interface MergeResult {
  merged: SpecBlock
  conflicts: MergeConflict[]
}

export function useSpecFork() {
  const forkedSpec = ref<SpecBlock | null>(null)
  const mergeResult = ref<MergeResult | null>(null)
  const isMerged = ref(false)

  function forkSpec(spec: SpecBlock): void {
    // Deep clone the spec as the fork baseline
    forkedSpec.value = JSON.parse(JSON.stringify(spec))
    mergeResult.value = null
    isMerged.value = false
  }

  function clearFork(): void {
    forkedSpec.value = null
    mergeResult.value = null
    isMerged.value = false
  }

  function mergeSpecs(original: SpecBlock, forked: SpecBlock): MergeResult {
    const conflicts: MergeConflict[] = []
    const merged: SpecBlock = {
      functions: [],
      values: [],
      solutions: [],
    }

    // Merge functions
    const allFIds = new Set([...original.functions.map(f => f.id), ...forked.functions.map(f => f.id)])
    for (const id of allFIds) {
      const o = original.functions.find(f => f.id === id)
      const n = forked.functions.find(f => f.id === id)
      if (o && n) {
        // Both have it — check for conflicts
        const mergedF = { ...o }
        if (o.description !== n.description) {
          conflicts.push({ entryId: id, field: 'description', original: o.description, forked: n.description })
          mergedF.description = o.description // keep original in merge
        }
        merged.functions.push(mergedF)
      } else {
        merged.functions.push((o || n)!)
      }
    }

    // Merge values
    const allVIds = new Set([...original.values.map(v => v.id), ...forked.values.map(v => v.id)])
    for (const id of allVIds) {
      const o = original.values.find(v => v.id === id)
      const n = forked.values.find(v => v.id === id)
      if (o && n) {
        const mergedV = { ...o }
        const fields: (keyof VEntry)[] = ['description', 'goal', 'tolerable', 'scale', 'meter']
        for (const field of fields) {
          const ov = String(o[field] ?? '')
          const nv = String(n[field] ?? '')
          if (ov !== nv && ov && nv) {
            conflicts.push({ entryId: id, field, original: ov, forked: nv })
          }
        }
        merged.values.push(mergedV)
      } else {
        merged.values.push((o || n)!)
      }
    }

    // Merge solutions
    const allSIds = new Set([...original.solutions.map(s => s.id), ...forked.solutions.map(s => s.id)])
    for (const id of allSIds) {
      const o = original.solutions.find(s => s.id === id)
      const n = forked.solutions.find(s => s.id === id)
      if (o && n) {
        const mergedS = { ...o }
        if (o.description !== n.description) {
          conflicts.push({ entryId: id, field: 'description', original: o.description, forked: n.description })
        }
        merged.solutions.push(mergedS)
      } else {
        merged.solutions.push((o || n)!)
      }
    }

    const result: MergeResult = { merged, conflicts }
    mergeResult.value = result
    isMerged.value = true
    return result
  }

  return { forkedSpec, mergeResult, isMerged, forkSpec, clearFork, mergeSpecs }
}
