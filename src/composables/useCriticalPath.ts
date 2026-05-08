// UNIT_TYPE=Composable
// Feature #119 — Spec Critical Path Highlighter
import { ref, computed } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface CriticalPathResult {
  stepChain: string[]   // ordered list of step names in the critical path
  totalSteps: number
  criticalNodeIds: string[]  // SpecBlock IDs on the critical path
  explanation: string   // e.g. "3-step chain: A → B → C (longest dependency sequence)"
}

// ── Keyword extraction ────────────────────────────────────────────────────────
function extractKeywords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/\W+/)
      .filter(w => w.length >= 3),
  )
}

function hasOverlap(setA: Set<string>, setB: Set<string>): boolean {
  for (const w of setA) {
    if (setB.has(w)) return true
  }
  return false
}

// ── DAG longest path (DFS + memoisation) ─────────────────────────────────────
function longestPath(
  nodeId: string,
  adj: Map<string, string[]>,
  memo: Map<string, string[]>,
): string[] {
  if (memo.has(nodeId)) return memo.get(nodeId)!

  const neighbours = adj.get(nodeId) ?? []
  let best: string[] = []
  for (const nb of neighbours) {
    const sub = longestPath(nb, adj, memo)
    if (sub.length > best.length) best = sub
  }
  const result = [nodeId, ...best]
  memo.set(nodeId, result)
  return result
}

// ── Main builder ──────────────────────────────────────────────────────────────
function buildCriticalPath(
  blocks: SpecBlock[],
): CriticalPathResult {
  const empty: CriticalPathResult = {
    stepChain: [],
    totalSteps: 0,
    criticalNodeIds: [],
    explanation: '',
  }

  if (blocks.length === 0) return empty

  const allF = blocks.flatMap(b => b.functions)
  const allV = blocks.flatMap(b => b.values)
  const allS = blocks.flatMap(b => b.solutions)

  // Mock fallback: if fewer than 2 total entries across F+V but some blocks exist
  if (allF.length + allV.length < 2) {
    const firstName = allF[0]?.id ?? 'F.Unknown'
    const firstVName = allV[0]?.id ?? 'V.Unknown'
    return {
      stepChain: [firstName, firstVName],
      totalSteps: 2,
      criticalNodeIds: [firstName, firstVName],
      explanation: `2-step chain: ${firstName} → ${firstVName} (longest dependency sequence)`,
    }
  }

  // Build adjacency list
  // F → V: share 3+ char word overlap between F.description/id and V.description/id/scale
  // V → S: share 3+ char word overlap between V.description/id and S.description/id
  const adj = new Map<string, string[]>()

  const fKeywords = allF.map(f =>
    extractKeywords(`${f.id} ${f.description}`),
  )
  const vKeywords = allV.map(v =>
    extractKeywords(`${v.id} ${v.description} ${v.scale}`),
  )
  const sKeywords = allS.map(s =>
    extractKeywords(`${s.id} ${s.description}`),
  )

  // F → V edges
  for (let fi = 0; fi < allF.length; fi++) {
    const fId = allF[fi].id
    if (!adj.has(fId)) adj.set(fId, [])
    for (let vi = 0; vi < allV.length; vi++) {
      if (hasOverlap(fKeywords[fi], vKeywords[vi])) {
        adj.get(fId)!.push(allV[vi].id)
      }
    }
  }

  // V → S edges
  for (let vi = 0; vi < allV.length; vi++) {
    const vId = allV[vi].id
    if (!adj.has(vId)) adj.set(vId, [])
    for (let si = 0; si < allS.length; si++) {
      if (hasOverlap(vKeywords[vi], sKeywords[si])) {
        adj.get(vId)!.push(allS[si].id)
      }
    }
  }

  // Ensure all V and S nodes exist in adj
  for (const v of allV) {
    if (!adj.has(v.id)) adj.set(v.id, [])
  }
  for (const s of allS) {
    if (!adj.has(s.id)) adj.set(s.id, [])
  }

  // Find longest path starting from any F node
  const memo = new Map<string, string[]>()
  let bestChain: string[] = []

  // Start from F entries
  for (const f of allF) {
    const chain = longestPath(f.id, adj, memo)
    if (chain.length > bestChain.length) bestChain = chain
  }

  // Also try from V entries in case no F entries
  if (bestChain.length === 0) {
    for (const v of allV) {
      const chain = longestPath(v.id, adj, memo)
      if (chain.length > bestChain.length) bestChain = chain
    }
  }

  if (bestChain.length === 0) return empty

  const chainStr = bestChain.join(' → ')
  const explanation = `${bestChain.length}-step chain: ${chainStr} (longest dependency sequence)`

  return {
    stepChain: bestChain,
    totalSteps: bestChain.length,
    criticalNodeIds: bestChain,
    explanation,
  }
}

// ── Composable ────────────────────────────────────────────────────────────────
export function useCriticalPath(
  blocks: SpecBlock[],
  _evoSteps?: { name: string; linkedValues?: string[] }[],
) {
  const copied = ref(false)

  const criticalPath = computed<CriticalPathResult>(() =>
    buildCriticalPath(blocks),
  )

  const highlightedIds = computed<Set<string>>(
    () => new Set(criticalPath.value.criticalNodeIds),
  )

  async function copyMarkdown(): Promise<void> {
    const cp = criticalPath.value
    const lines = [
      '## Critical Path',
      '',
      cp.stepChain.length > 0
        ? cp.stepChain.join(' → ')
        : 'No dependency chain detected.',
      '',
      cp.explanation,
    ]
    const text = lines.join('\n')
    try {
      await navigator.clipboard.writeText(text)
      copied.value = true
      setTimeout(() => { copied.value = false }, 2000)
    } catch {
      // no-op
    }
  }

  return { criticalPath, highlightedIds, copyMarkdown, copied }
}
