// UNIT_TYPE=Composable
// Feature #133 — Knowledge Graph for evo steps and value blocks
import { ref, computed } from 'vue'

export interface KGNode {
  id: string
  label: string
  type: 'step' | 'value'
  x: number
  y: number
  radius: number // 8–20px, proportional to edge count
}

export interface KGEdge {
  fromId: string
  toId: string
  weight: number // keyword overlap count (1–3+)
}

/** Extract words of 3+ chars from a string for keyword matching */
function extractWords(text: string): Set<string> {
  return new Set(
    (text ?? '')
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length >= 3),
  )
}

/** Count overlapping words between two sets */
function overlapCount(a: Set<string>, b: Set<string>): number {
  let count = 0
  for (const word of a) {
    if (b.has(word)) count += 1
  }
  return count
}

export function useKnowledgeGraph(
  steps: { id: string; name: string; linkedValues?: string[] }[],
  valueBlocks: { id: string; name: string; description: string }[],
) {
  const selectedId = ref<string | null>(null)

  function select(id: string | null): void {
    selectedId.value = id
  }

  const svgWidth = computed<number>(() =>
    Math.max(500, Math.max(steps.length, valueBlocks.length) * 70 + 40),
  )

  const svgHeight = 320

  const edges = computed<KGEdge[]>(() => {
    const result: KGEdge[] = []

    for (const step of steps) {
      const stepWords = extractWords(step.name)
      for (const vb of valueBlocks) {
        const vbWords = extractWords(`${vb.name} ${vb.description}`)
        const weight = overlapCount(stepWords, vbWords)
        if (weight >= 1) {
          result.push({ fromId: step.id, toId: vb.id, weight: Math.min(weight, 3) })
        }
      }
    }

    return result
  })

  const nodes = computed<KGNode[]>(() => {
    const result: KGNode[] = []
    const n = steps.length
    const m = valueBlocks.length

    // Steps: place in a top arc (y ≈ 80)
    for (let i = 0; i < n; i++) {
      const step = steps[i]
      const edgeCount = edges.value.filter((e) => e.fromId === step.id).length
      const radius = Math.min(20, 8 + edgeCount * 2)
      const x = n === 1 ? svgWidth.value / 2 : (i / (n - 1)) * (svgWidth.value - 60) + 30
      result.push({
        id: step.id,
        label: step.name,
        type: 'step',
        x,
        y: 80,
        radius,
      })
    }

    // Values: place in a bottom arc (y ≈ 240) — only include values with at least one edge
    const connectedValues = valueBlocks.filter((vb) =>
      edges.value.some((e) => e.toId === vb.id),
    )
    const cv = connectedValues.length
    for (let j = 0; j < cv; j++) {
      const vb = connectedValues[j]
      const edgeCount = edges.value.filter((e) => e.toId === vb.id).length
      const radius = Math.min(20, 8 + edgeCount * 2)
      const x = cv === 1 ? svgWidth.value / 2 : (j / (cv - 1)) * (svgWidth.value - 60) + 30
      result.push({
        id: vb.id,
        label: vb.name,
        type: 'value',
        x,
        y: 240,
        radius,
      })
    }

    return result
  })

  function isHighlighted(id: string): boolean {
    if (selectedId.value === null) return true
    if (id === selectedId.value) return true
    // Connected to selectedId via an edge
    return edges.value.some(
      (e) =>
        (e.fromId === selectedId.value && e.toId === id) ||
        (e.toId === selectedId.value && e.fromId === id),
    )
  }

  return {
    nodes,
    edges,
    selectedId,
    select,
    isHighlighted,
    svgWidth,
    svgHeight,
  }
}
