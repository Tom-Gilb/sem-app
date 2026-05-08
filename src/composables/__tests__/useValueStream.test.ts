// UNIT_TYPE=Test
// Feature #123 — useValueStream composable tests

import { describe, it, expect } from 'vitest'
import { useValueStream } from '../useValueStream'
import type { SpecBlock } from '../../types/spec'

function makeBlock(overrides?: {
  functions?: Array<{ id: string; description?: string }>
  values?: Array<{ id: string; description?: string; scale?: string }>
  solutions?: Array<{ id: string; description?: string }>
}): SpecBlock {
  return {
    functions: (overrides?.functions ?? []).map(f => ({
      id: f.id,
      type: 'Function',
      level: 'Product',
      description: f.description ?? '',
      successCriteria: '',
      functionOfValue: '',
    })),
    values: (overrides?.values ?? []).map(v => ({
      id: v.id,
      type: 'Value',
      level: 'Product',
      description: v.description ?? '',
      scale: v.scale ?? '',
      meter: '',
      status: '',
      tolerable: '',
      goal: '',
      valueOfFunction: '',
    })),
    solutions: (overrides?.solutions ?? []).map(s => ({
      id: s.id,
      type: 'Solution',
      level: 'Product',
      description: s.description ?? '',
      impact: '',
      function: '',
    })),
  }
}

describe('useValueStream', () => {
  it('returns empty nodes when blocks are empty', () => {
    const { nodes } = useValueStream([])
    expect(nodes.value).toHaveLength(0)
  })

  it('returns empty edges when blocks are empty', () => {
    const { edges } = useValueStream([])
    expect(edges.value).toHaveLength(0)
  })

  it('function nodes have type "function"', () => {
    const block = makeBlock({
      functions: [{ id: 'F.Alpha', description: 'alpha' }, { id: 'F.Beta', description: 'beta' }],
    })
    const { nodes } = useValueStream([block])
    const fNodes = nodes.value.filter(n => n.type === 'function')
    expect(fNodes).toHaveLength(2)
  })

  it('value nodes have type "value"', () => {
    const block = makeBlock({
      values: [{ id: 'V.Alpha' }, { id: 'V.Beta' }, { id: 'V.Gamma' }],
    })
    const { nodes } = useValueStream([block])
    const vNodes = nodes.value.filter(n => n.type === 'value')
    expect(vNodes).toHaveLength(3)
  })

  it('solution nodes have type "solution"', () => {
    const block = makeBlock({
      solutions: [{ id: 'S.Alpha' }],
    })
    const { nodes } = useValueStream([block])
    const sNodes = nodes.value.filter(n => n.type === 'solution')
    expect(sNodes).toHaveLength(1)
  })

  it('function nodes have y=60', () => {
    const block = makeBlock({
      functions: [{ id: 'F.Alpha', description: 'alpha' }],
    })
    const { nodes } = useValueStream([block])
    const fNode = nodes.value.find(n => n.type === 'function')!
    expect(fNode.y).toBe(60)
  })

  it('value nodes have y=180', () => {
    const block = makeBlock({
      values: [{ id: 'V.Alpha' }],
    })
    const { nodes } = useValueStream([block])
    const vNode = nodes.value.find(n => n.type === 'value')!
    expect(vNode.y).toBe(180)
  })

  it('solution nodes have y=300', () => {
    const block = makeBlock({
      solutions: [{ id: 'S.Alpha' }],
    })
    const { nodes } = useValueStream([block])
    const sNode = nodes.value.find(n => n.type === 'solution')!
    expect(sNode.y).toBe(300)
  })

  it('creates F→V edge when keyword overlap exists', () => {
    const block = makeBlock({
      functions: [{ id: 'F.Speed', description: 'speed optimisation' }],
      values: [{ id: 'V.Speed', description: 'speed measurement scale' }],
    })
    const { edges } = useValueStream([block])
    const hasEdge = edges.value.some(e => e.from === 'F.Speed' && e.to === 'V.Speed')
    expect(hasEdge).toBe(true)
  })

  it('creates V→S edge when keyword overlap exists', () => {
    const block = makeBlock({
      values: [{ id: 'V.Quality', description: 'quality metric' }],
      solutions: [{ id: 'S.Quality', description: 'quality improvement pipeline' }],
    })
    const { edges } = useValueStream([block])
    const hasEdge = edges.value.some(e => e.from === 'V.Quality' && e.to === 'S.Quality')
    expect(hasEdge).toBe(true)
  })

  it('does not create skip edges (F→S)', () => {
    const block = makeBlock({
      functions: [{ id: 'F.Alpha', description: 'alpha capability' }],
      solutions: [{ id: 'S.Alpha', description: 'alpha solution' }],
    })
    const { edges } = useValueStream([block])
    const hasSkip = edges.value.some(e => e.from.startsWith('F.') && e.to.startsWith('S.'))
    expect(hasSkip).toBe(false)
  })

  it('bottleneck detected when node has inDegree >= 3', () => {
    const block = makeBlock({
      functions: [
        { id: 'F.Alpha', description: 'performance tracking' },
        { id: 'F.Beta', description: 'performance monitoring' },
        { id: 'F.Gamma', description: 'performance measurement' },
      ],
      values: [{ id: 'V.Performance', description: 'performance metric scale' }],
    })
    const { nodes } = useValueStream([block])
    const bottleneck = nodes.value.find(n => n.isBottleneck)
    expect(bottleneck).toBeDefined()
  })

  it('bottleneckCount reflects bottleneck nodes', () => {
    const block = makeBlock({
      functions: [
        { id: 'F.Alpha', description: 'performance tracking' },
        { id: 'F.Beta', description: 'performance monitoring' },
        { id: 'F.Gamma', description: 'performance measurement' },
      ],
      values: [{ id: 'V.Performance', description: 'performance metric scale' }],
    })
    const { bottleneckCount } = useValueStream([block])
    expect(bottleneckCount.value).toBeGreaterThanOrEqual(1)
  })

  it('node label is truncated to 12 characters', () => {
    const block = makeBlock({
      functions: [{ id: 'F.VeryLongFunctionIdentifier', description: 'alpha' }],
    })
    const { nodes } = useValueStream([block])
    const fNode = nodes.value.find(n => n.type === 'function')!
    expect(fNode.label.length).toBeLessThanOrEqual(12)
  })

  it('nodes are spread across x=60 to x=560', () => {
    const block = makeBlock({
      functions: [
        { id: 'F.A', description: 'first' },
        { id: 'F.B', description: 'second' },
        { id: 'F.C', description: 'third' },
      ],
    })
    const { nodes } = useValueStream([block])
    const fNodes = nodes.value.filter(n => n.type === 'function')
    const xs = fNodes.map(n => n.x)
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(55)
    expect(Math.max(...xs)).toBeLessThanOrEqual(565)
  })
})
