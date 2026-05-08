// UNIT_TYPE=Test
// Feature #109 — useImpactMap composable tests

import { describe, it, expect } from 'vitest'
import { useImpactMap } from '../useImpactMap'
import type { SpecBlock } from '../../types/spec'

const makeBlock = (
  functionIds: string[],
  valueIds: string[],
  valueOfFunctionMap: Record<string, string> = {},
): SpecBlock => ({
  functions: functionIds.map(id => ({
    id,
    type: 'Function',
    level: 'Product',
    description: `Desc for ${id}`,
    successCriteria: '',
    functionOfValue: '',
  })),
  values: valueIds.map(id => ({
    id,
    type: 'Value',
    level: 'Product',
    description: `Desc for ${id}`,
    scale: '',
    meter: '',
    status: '',
    tolerable: '',
    goal: '',
    valueOfFunction: valueOfFunctionMap[id] || '',
  })),
  solutions: [],
})

const emptyBlock: SpecBlock = { functions: [], values: [], solutions: [] }

describe('useImpactMap', () => {
  it('returns 1 domain node with empty blocks', () => {
    const { nodes } = useImpactMap([])
    const domainNodes = nodes.value.filter(n => n.type === 'domain')
    expect(domainNodes).toHaveLength(1)
  })

  it('domain node is at centre (300, 200)', () => {
    const { nodes } = useImpactMap([])
    const domain = nodes.value.find(n => n.type === 'domain')
    expect(domain?.x).toBe(300)
    expect(domain?.y).toBe(200)
  })

  it('node count = 1 domain + F + V entries', () => {
    const block = makeBlock(['F.Alpha', 'F.Beta'], ['V.One', 'V.Two', 'V.Three'])
    const { nodes } = useImpactMap([block])
    // 1 domain + 2 functions + 3 values = 6
    expect(nodes.value).toHaveLength(6)
  })

  it('function nodes have type "function"', () => {
    const block = makeBlock(['F.Foo', 'F.Bar'], [])
    const { nodes } = useImpactMap([block])
    const fnNodes = nodes.value.filter(n => n.type === 'function')
    expect(fnNodes).toHaveLength(2)
  })

  it('value nodes have type "value"', () => {
    const block = makeBlock([], ['V.X', 'V.Y'])
    const { nodes } = useImpactMap([block])
    const valNodes = nodes.value.filter(n => n.type === 'value')
    expect(valNodes).toHaveLength(2)
  })

  it('edges contain domain→function edges', () => {
    const block = makeBlock(['F.Alpha', 'F.Beta'], [])
    const { edges } = useImpactMap([block])
    const domainEdges = edges.value.filter(e => e.from === '__domain__')
    expect(domainEdges).toHaveLength(2)
  })

  it('edges contain function→value edges when valueOfFunction links', () => {
    const block = makeBlock(
      ['F.Alpha'],
      ['V.One'],
      { 'V.One': '[[F.Alpha]]' },
    )
    const { edges } = useImpactMap([block])
    const fToV = edges.value.filter(e => e.from === 'F.Alpha' && e.to === 'V.One')
    expect(fToV).toHaveLength(1)
  })

  it('total edge count: domain→F edges + F→V edges', () => {
    const block = makeBlock(
      ['F.Alpha', 'F.Beta'],
      ['V.One', 'V.Two'],
      { 'V.One': '[[F.Alpha]]', 'V.Two': '[[F.Beta]]' },
    )
    const { edges } = useImpactMap([block])
    // 2 domain→F + 2 F→V = 4
    expect(edges.value).toHaveLength(4)
  })

  it('highlighted is empty string initially', () => {
    const { highlighted } = useImpactMap([])
    expect(highlighted.value).toBe('')
  })

  it('highlightSubtree sets highlighted to given id', () => {
    const block = makeBlock(['F.Alpha'], [])
    const { highlighted, highlightSubtree } = useImpactMap([block])
    highlightSubtree('F.Alpha')
    expect(highlighted.value).toBe('F.Alpha')
  })

  it('clearHighlight resets highlighted to empty string', () => {
    const block = makeBlock(['F.Alpha'], [])
    const { highlighted, highlightSubtree, clearHighlight } = useImpactMap([block])
    highlightSubtree('F.Alpha')
    clearHighlight()
    expect(highlighted.value).toBe('')
  })

  it('when highlighted is empty, all nodes have highlighted=true', () => {
    const block = makeBlock(['F.Alpha'], ['V.One'])
    const { nodes, clearHighlight } = useImpactMap([block])
    clearHighlight()
    expect(nodes.value.every(n => n.highlighted)).toBe(true)
  })

  it('domain node highlighted after highlightSubtree(__domain__)', () => {
    const block = makeBlock(['F.Alpha'], [])
    const { nodes, highlightSubtree } = useImpactMap([block])
    highlightSubtree('__domain__')
    const domain = nodes.value.find(n => n.id === '__domain__')
    expect(domain?.highlighted).toBe(true)
  })

  it('function node id matches input F. id', () => {
    const block = makeBlock(['F.ProvideSEMInterface'], [])
    const { nodes } = useImpactMap([block])
    const fn = nodes.value.find(n => n.id === 'F.ProvideSEMInterface')
    expect(fn).toBeDefined()
  })

  it('value node id matches input V. id', () => {
    const block = makeBlock([], ['V.EntryFluency'])
    const { nodes } = useImpactMap([block])
    const val = nodes.value.find(n => n.id === 'V.EntryFluency')
    expect(val).toBeDefined()
  })

  it('empty blocks produce no edges', () => {
    const { edges } = useImpactMap([emptyBlock])
    expect(edges.value).toHaveLength(0)
  })
})
