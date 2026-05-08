// UNIT_TYPE=Composable
// Feature #80 — V. entry dependency graph
import { ref, computed } from 'vue'
import type { Ref } from 'vue'
import type { SpecBlock, VEntry } from '../types/spec'

export interface DepNode {
  id: string
  label: string   // truncated scale or description, max 30 chars
  type: 'V'
  x: number       // 0–100 %
  y: number       // 0–100 %
}

export interface DepEdge {
  from: string    // node id
  to: string      // node id
  strength: number // 1–3, how many keyword overlaps
}

export interface DepGraph {
  nodes: DepNode[]
  edges: DepEdge[]
}

// ── Layout helpers ────────────────────────────────────────────────────────────
function circleLayout(count: number): Array<{ x: number; y: number }> {
  return Array.from({ length: count }, (_, i) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2
    return {
      x: Math.round(50 + 35 * Math.cos(angle)),
      y: Math.round(50 + 35 * Math.sin(angle)),
    }
  })
}

function gridLayout(count: number): Array<{ x: number; y: number }> {
  const cols = Math.ceil(Math.sqrt(count))
  return Array.from({ length: count }, (_, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const rows = Math.ceil(count / cols)
    const xStep = cols > 1 ? 80 / (cols - 1) : 0
    const yStep = rows > 1 ? 80 / (rows - 1) : 0
    return {
      x: Math.round(10 + col * xStep),
      y: Math.round(10 + row * yStep),
    }
  })
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

function overlapCount(setA: Set<string>, setB: Set<string>): number {
  let count = 0
  for (const w of setA) {
    if (setB.has(w)) count++
  }
  return count
}

// ── Graph builder ─────────────────────────────────────────────────────────────
function buildGraph(spec: SpecBlock | null): DepGraph {
  if (!spec || spec.values.length === 0) return { nodes: [], edges: [] }

  const entries: VEntry[] = spec.values

  // Layout
  const positions = entries.length <= 6 ? circleLayout(entries.length) : gridLayout(entries.length)

  const nodes: DepNode[] = entries.map((v, i) => {
    const labelSrc = v.scale?.trim() || v.description?.trim() || v.id
    return {
      id: v.id,
      label: labelSrc.slice(0, 30),
      type: 'V' as const,
      x: positions[i].x,
      y: positions[i].y,
    }
  })

  const edges: DepEdge[] = []

  // Build keyword sets for each entry
  const kwSets = entries.map(v => extractKeywords(`${v.scale ?? ''} ${v.goal ?? ''} ${v.description ?? ''}`))

  for (let a = 0; a < entries.length; a++) {
    for (let b = a + 1; b < entries.length; b++) {
      const ab = overlapCount(kwSets[a], kwSets[b])
      const ba = overlapCount(kwSets[b], kwSets[a])
      const total = Math.max(ab, ba)
      if (total >= 1) {
        edges.push({
          from: entries[a].id,
          to: entries[b].id,
          strength: Math.min(3, total) as 1 | 2 | 3,
        })
      }
    }
  }

  // Fallback: if no edges detected and ≥2 nodes, add a linear chain
  if (edges.length === 0 && nodes.length >= 2) {
    for (let i = 0; i < nodes.length - 1; i++) {
      edges.push({ from: nodes[i].id, to: nodes[i + 1].id, strength: 1 })
    }
  }

  return { nodes, edges }
}

// ── Composable ────────────────────────────────────────────────────────────────
export function useDepGraph(spec: Ref<SpecBlock | null>) {
  const graphOpen = ref(false)
  const selectedNode = ref<string | null>(null)

  const graph = computed<DepGraph>(() => buildGraph(spec.value))

  function selectNode(id: string | null): void {
    selectedNode.value = id
  }

  return { graphOpen, graph, selectedNode, selectNode }
}
