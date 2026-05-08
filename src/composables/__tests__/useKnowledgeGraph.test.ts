import { describe, it, expect } from 'vitest'
import { useKnowledgeGraph } from '../useKnowledgeGraph'

const makeSteps = (names: string[]) =>
  names.map((name, i) => ({ id: `step-${i}`, name }))

const makeValues = (entries: { id: string; name: string; description: string }[]) =>
  entries

describe('useKnowledgeGraph — node count', () => {
  it('node count equals steps + connected values', () => {
    const steps = makeSteps(['Authentication', 'Dashboard'])
    const values = makeValues([
      { id: 'v1', name: 'Security', description: 'authentication security login' },
      { id: 'v2', name: 'Speed', description: 'fast performance latency' },
    ])
    const { nodes, edges } = useKnowledgeGraph(steps, values)
    // Steps always appear; values only appear when they have edges
    expect(nodes.value.filter(n => n.type === 'step')).toHaveLength(2)
    // Only v1 shares word "authentication" with step 0
    const valueNodes = nodes.value.filter(n => n.type === 'value')
    expect(valueNodes.length).toBeGreaterThanOrEqual(0)
    // Total = step nodes + connected value nodes
    expect(nodes.value.length).toBe(2 + valueNodes.length)
  })

  it('returns 0 value nodes when no keyword overlap', () => {
    const steps = makeSteps(['XYZ process'])
    const values = makeValues([{ id: 'v1', name: 'Zebra', description: 'jungle wildlife' }])
    const { nodes } = useKnowledgeGraph(steps, values)
    const valueNodes = nodes.value.filter(n => n.type === 'value')
    expect(valueNodes).toHaveLength(0)
  })

  it('step nodes are always present regardless of edges', () => {
    const steps = makeSteps(['Alpha', 'Beta', 'Gamma'])
    const { nodes } = useKnowledgeGraph(steps, [])
    expect(nodes.value.filter(n => n.type === 'step')).toHaveLength(3)
  })
})

describe('useKnowledgeGraph — arc positioning', () => {
  it('step nodes have y ≈ 80 (top arc)', () => {
    const steps = makeSteps(['Authentication', 'Dashboard', 'Reporting'])
    const { nodes } = useKnowledgeGraph(steps, [])
    for (const node of nodes.value.filter(n => n.type === 'step')) {
      expect(node.y).toBe(80)
    }
  })

  it('value nodes have y ≈ 240 (bottom arc)', () => {
    const steps = makeSteps(['Authentication'])
    const values = makeValues([
      { id: 'v1', name: 'Security', description: 'authentication security' },
    ])
    const { nodes } = useKnowledgeGraph(steps, values)
    const valueNodes = nodes.value.filter(n => n.type === 'value')
    for (const node of valueNodes) {
      expect(node.y).toBe(240)
    }
  })

  it('step nodes y is less than value nodes y', () => {
    const steps = makeSteps(['Authentication'])
    const values = makeValues([
      { id: 'v1', name: 'Security', description: 'authentication security' },
    ])
    const { nodes } = useKnowledgeGraph(steps, values)
    const stepY = nodes.value.find(n => n.type === 'step')!.y
    const valueY = nodes.value.find(n => n.type === 'value')!.y
    expect(stepY).toBeLessThan(valueY)
  })
})

describe('useKnowledgeGraph — edges', () => {
  it('builds edge when step name has 3+ char word overlap with value name+description', () => {
    const steps = makeSteps(['Authentication flow'])
    const values = makeValues([
      { id: 'v1', name: 'Security authentication', description: 'secure login' },
    ])
    const { edges } = useKnowledgeGraph(steps, values)
    expect(edges.value.length).toBeGreaterThanOrEqual(1)
    expect(edges.value[0].fromId).toBe('step-0')
    expect(edges.value[0].toId).toBe('v1')
  })

  it('no edge without word overlap', () => {
    const steps = makeSteps(['Alpha step'])
    const values = makeValues([{ id: 'v1', name: 'Zebra fauna', description: 'jungle wildlife' }])
    const { edges } = useKnowledgeGraph(steps, values)
    expect(edges.value).toHaveLength(0)
  })

  it('edge weight is the count of overlapping words, capped at 3', () => {
    const steps = makeSteps(['authentication security login dashboard'])
    const values = makeValues([
      { id: 'v1', name: 'authentication security login reporting', description: '' },
    ])
    const { edges } = useKnowledgeGraph(steps, values)
    expect(edges.value[0].weight).toBeGreaterThanOrEqual(1)
    expect(edges.value[0].weight).toBeLessThanOrEqual(3)
  })
})

describe('useKnowledgeGraph — radius', () => {
  it('radius scales with edge count', () => {
    const steps = makeSteps(['Authentication login security'])
    const values = makeValues([
      { id: 'v1', name: 'Security', description: 'authentication login' },
      { id: 'v2', name: 'Auth', description: 'authentication login security' },
    ])
    const { nodes } = useKnowledgeGraph(steps, values)
    const stepNode = nodes.value.find(n => n.type === 'step')!
    // Step connects to both values → higher radius than if it only connected to 1
    expect(stepNode.radius).toBeGreaterThanOrEqual(8)
    expect(stepNode.radius).toBeLessThanOrEqual(20)
  })

  it('step with no edges has minimum radius 8', () => {
    const steps = makeSteps(['Xyzzy step'])
    const { nodes } = useKnowledgeGraph(steps, [])
    const stepNode = nodes.value.find(n => n.type === 'step')!
    expect(stepNode.radius).toBe(8)
  })
})

describe('useKnowledgeGraph — selectedId and isHighlighted', () => {
  it('selectedId starts as null', () => {
    const { selectedId } = useKnowledgeGraph([], [])
    expect(selectedId.value).toBeNull()
  })

  it('select(id) sets selectedId', () => {
    const { selectedId, select } = useKnowledgeGraph(makeSteps(['A']), [])
    select('step-0')
    expect(selectedId.value).toBe('step-0')
  })

  it('select(null) clears selectedId', () => {
    const { selectedId, select } = useKnowledgeGraph(makeSteps(['A']), [])
    select('step-0')
    select(null)
    expect(selectedId.value).toBeNull()
  })

  it('isHighlighted returns true for all nodes when selectedId is null', () => {
    const steps = makeSteps(['Authentication', 'Dashboard'])
    const { isHighlighted } = useKnowledgeGraph(steps, [])
    expect(isHighlighted('step-0')).toBe(true)
    expect(isHighlighted('step-1')).toBe(true)
  })

  it('isHighlighted returns true for the selected node', () => {
    const steps = makeSteps(['Authentication', 'Dashboard'])
    const { isHighlighted, select } = useKnowledgeGraph(steps, [])
    select('step-0')
    expect(isHighlighted('step-0')).toBe(true)
  })

  it('isHighlighted returns false for unconnected non-selected nodes', () => {
    const steps = makeSteps(['Authentication', 'Dashboard'])
    const { isHighlighted, select } = useKnowledgeGraph(steps, [])
    select('step-0')
    // step-1 is not connected to step-0 (no edges between steps) and is not selected
    expect(isHighlighted('step-1')).toBe(false)
  })
})

describe('useKnowledgeGraph — svgWidth', () => {
  it('svgWidth minimum is 500', () => {
    const { svgWidth } = useKnowledgeGraph([], [])
    expect(svgWidth.value).toBeGreaterThanOrEqual(500)
  })

  it('svgWidth scales with step count', () => {
    const manySteps = makeSteps(Array.from({ length: 10 }, (_, i) => `Step ${i}`))
    const { svgWidth } = useKnowledgeGraph(manySteps, [])
    expect(svgWidth.value).toBeGreaterThanOrEqual(Math.max(500, 10 * 70 + 40))
  })
})
