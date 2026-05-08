// UNIT_TYPE=Composable
// Feature #123 — Spec Value Stream Map
import { ref, computed } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface StreamNode {
  id: string
  label: string       // truncated entry ID, max 12 chars
  type: 'function' | 'value' | 'solution'
  x: number
  y: number
  isBottleneck: boolean  // true if this node has ≥3 incoming edges
  inDegree: number
}

export interface StreamEdge {
  from: string
  to: string
  label?: string
}

// ── Keyword helpers ───────────────────────────────────────────────────────────
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

// ── Layout helper ─────────────────────────────────────────────────────────────
function evenlySpaced(count: number, xMin = 60, xMax = 560): number[] {
  if (count === 0) return []
  if (count === 1) return [Math.round((xMin + xMax) / 2)]
  return Array.from({ length: count }, (_, i) =>
    Math.round(xMin + (i * (xMax - xMin)) / (count - 1)),
  )
}

// ── Builder ───────────────────────────────────────────────────────────────────
function buildStream(blocks: SpecBlock[]): {
  nodes: StreamNode[]
  edges: StreamEdge[]
} {
  const allF = blocks.flatMap(b => b.functions)
  const allV = blocks.flatMap(b => b.values)
  const allS = blocks.flatMap(b => b.solutions)

  const fXs = evenlySpaced(allF.length)
  const vXs = evenlySpaced(allV.length)
  const sXs = evenlySpaced(allS.length)

  const fKeywords = allF.map(f =>
    extractKeywords(`${f.id} ${f.description}`),
  )
  const vKeywords = allV.map(v =>
    extractKeywords(`${v.id} ${v.description} ${v.scale}`),
  )
  const sKeywords = allS.map(s =>
    extractKeywords(`${s.id} ${s.description}`),
  )

  const edges: StreamEdge[] = []

  // F → V edges
  for (let fi = 0; fi < allF.length; fi++) {
    for (let vi = 0; vi < allV.length; vi++) {
      if (hasOverlap(fKeywords[fi], vKeywords[vi])) {
        edges.push({ from: allF[fi].id, to: allV[vi].id })
      }
    }
  }

  // V → S edges
  for (let vi = 0; vi < allV.length; vi++) {
    for (let si = 0; si < allS.length; si++) {
      if (hasOverlap(vKeywords[vi], sKeywords[si])) {
        edges.push({ from: allV[vi].id, to: allS[si].id })
      }
    }
  }

  // Calculate in-degrees
  const inDegreeMap = new Map<string, number>()
  for (const e of edges) {
    inDegreeMap.set(e.to, (inDegreeMap.get(e.to) ?? 0) + 1)
  }

  const nodes: StreamNode[] = [
    ...allF.map((f, i) => ({
      id: f.id,
      label: f.id.slice(0, 12),
      type: 'function' as const,
      x: fXs[i],
      y: 60,
      inDegree: inDegreeMap.get(f.id) ?? 0,
      isBottleneck: (inDegreeMap.get(f.id) ?? 0) >= 3,
    })),
    ...allV.map((v, i) => ({
      id: v.id,
      label: v.id.slice(0, 12),
      type: 'value' as const,
      x: vXs[i],
      y: 180,
      inDegree: inDegreeMap.get(v.id) ?? 0,
      isBottleneck: (inDegreeMap.get(v.id) ?? 0) >= 3,
    })),
    ...allS.map((s, i) => ({
      id: s.id,
      label: s.id.slice(0, 12),
      type: 'solution' as const,
      x: sXs[i],
      y: 300,
      inDegree: inDegreeMap.get(s.id) ?? 0,
      isBottleneck: (inDegreeMap.get(s.id) ?? 0) >= 3,
    })),
  ]

  return { nodes, edges }
}

// ── Composable ────────────────────────────────────────────────────────────────
export function useValueStream(blocks: SpecBlock[]) {
  const nodes = computed<StreamNode[]>(() => buildStream(blocks).nodes)
  const edges = computed<StreamEdge[]>(() => buildStream(blocks).edges)
  const bottleneckCount = computed<number>(
    () => nodes.value.filter(n => n.isBottleneck).length,
  )

  return { nodes, edges, bottleneckCount }
}
