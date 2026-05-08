// UNIT_TYPE=Test
// Feature #80 — useDepGraph composable tests

import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useDepGraph } from '../useDepGraph'
import type { SpecBlock, VEntry, FEntry, SEntry } from '../../types/spec'

function makeVEntry(overrides: Partial<VEntry> = {}): VEntry {
  return {
    id: 'V.Test',
    type: 'Value',
    level: 'Product',
    description: 'A test value',
    scale: 'score out of 100',
    meter: 'Automated test',
    status: 'Status [now] 50',
    tolerable: 'Tolerable [2026] 60',
    goal: 'Goal [2026] 80',
    valueOfFunction: '',
    ...overrides,
  }
}

function makeFEntry(): FEntry {
  return { id: 'F.Test', type: 'Function', level: 'Product', description: 'Test', successCriteria: '', functionOfValue: '' }
}

function makeSEntry(): SEntry {
  return { id: 'S.Test', type: 'Solution', level: 'Product', description: 'Test', impact: '', function: '' }
}

function makeSpec(values: VEntry[] = []): SpecBlock {
  return { functions: [makeFEntry()], values, solutions: [makeSEntry()] }
}

describe('useDepGraph', () => {
  it('initial state: graphOpen is false, selectedNode is null', () => {
    const specRef = ref<SpecBlock | null>(null)
    const { graphOpen, selectedNode } = useDepGraph(specRef)
    expect(graphOpen.value).toBe(false)
    expect(selectedNode.value).toBeNull()
  })

  it('empty spec: graph has 0 nodes and 0 edges', () => {
    const specRef = ref<SpecBlock | null>(makeSpec([]))
    const { graph } = useDepGraph(specRef)
    expect(graph.value.nodes).toHaveLength(0)
    expect(graph.value.edges).toHaveLength(0)
  })

  it('null spec: graph has 0 nodes and 0 edges', () => {
    const specRef = ref<SpecBlock | null>(null)
    const { graph } = useDepGraph(specRef)
    expect(graph.value.nodes).toHaveLength(0)
    expect(graph.value.edges).toHaveLength(0)
  })

  it('1 V. entry: 1 node, 0 edges (no linear chain fallback for single node)', () => {
    const specRef = ref<SpecBlock | null>(makeSpec([makeVEntry({ id: 'V.One' })]))
    const { graph } = useDepGraph(specRef)
    expect(graph.value.nodes).toHaveLength(1)
    expect(graph.value.edges).toHaveLength(0)
  })

  it('2 V. entries with no keyword overlap: linear chain fallback produces 1 edge', () => {
    const specRef = ref<SpecBlock | null>(makeSpec([
      makeVEntry({ id: 'V.Alpha', scale: 'xyz quantity per zzz', description: 'zzz measurement', goal: 'zzz 100' }),
      makeVEntry({ id: 'V.Beta', scale: 'abc ratio per bbb', description: 'bbb tracking', goal: 'bbb 50' }),
    ]))
    const { graph } = useDepGraph(specRef)
    expect(graph.value.nodes).toHaveLength(2)
    // Either real edge or fallback — should have exactly 1 edge
    expect(graph.value.edges).toHaveLength(1)
  })

  it('2 V. entries with keyword overlap: real inference produces 1 edge', () => {
    const specRef = ref<SpecBlock | null>(makeSpec([
      makeVEntry({ id: 'V.Alpha', scale: 'user retention rate', description: 'user engagement score' }),
      makeVEntry({ id: 'V.Beta', scale: 'user satisfaction score', description: 'engagement metric' }),
    ]))
    const { graph } = useDepGraph(specRef)
    expect(graph.value.nodes).toHaveLength(2)
    expect(graph.value.edges).toHaveLength(1)
    expect(graph.value.edges[0].strength).toBeGreaterThanOrEqual(1)
    expect(graph.value.edges[0].strength).toBeLessThanOrEqual(3)
  })

  it('3 V. entries: 3 nodes', () => {
    const specRef = ref<SpecBlock | null>(makeSpec([
      makeVEntry({ id: 'V.A' }),
      makeVEntry({ id: 'V.B' }),
      makeVEntry({ id: 'V.C' }),
    ]))
    const { graph } = useDepGraph(specRef)
    expect(graph.value.nodes).toHaveLength(3)
  })

  it('selectNode sets selectedNode', () => {
    const specRef = ref<SpecBlock | null>(makeSpec([makeVEntry({ id: 'V.X' })]))
    const { selectedNode, selectNode } = useDepGraph(specRef)
    selectNode('V.X')
    expect(selectedNode.value).toBe('V.X')
  })

  it('selectNode(null) clears selectedNode', () => {
    const specRef = ref<SpecBlock | null>(makeSpec([makeVEntry({ id: 'V.X' })]))
    const { selectedNode, selectNode } = useDepGraph(specRef)
    selectNode('V.X')
    selectNode(null)
    expect(selectedNode.value).toBeNull()
  })

  it('node.x and node.y are numbers between 0 and 100', () => {
    const specRef = ref<SpecBlock | null>(makeSpec([
      makeVEntry({ id: 'V.A' }),
      makeVEntry({ id: 'V.B' }),
      makeVEntry({ id: 'V.C' }),
    ]))
    const { graph } = useDepGraph(specRef)
    for (const node of graph.value.nodes) {
      expect(typeof node.x).toBe('number')
      expect(typeof node.y).toBe('number')
      expect(node.x).toBeGreaterThanOrEqual(0)
      expect(node.x).toBeLessThanOrEqual(100)
      expect(node.y).toBeGreaterThanOrEqual(0)
      expect(node.y).toBeLessThanOrEqual(100)
    }
  })
})
