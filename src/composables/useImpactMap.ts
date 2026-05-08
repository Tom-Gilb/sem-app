// UNIT_TYPE=Composable
// Feature #109 — Impact Map mind-map
import { ref, computed } from 'vue'
import type { Ref } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface ImpactNode {
  id: string
  label: string
  type: 'domain' | 'function' | 'value'
  x: number
  y: number
  highlighted: boolean
}

export interface ImpactEdge {
  from: string
  to: string
}

const CENTRE_X = 300
const CENTRE_Y = 200
const FUNCTION_RADIUS = 120
const VALUE_RADIUS = 220

export function useImpactMap(blocks: SpecBlock[]) {
  const highlighted = ref<string>('')

  // Gather all F. and V. entries from blocks
  const allFunctions = blocks.flatMap(b => b.functions)
  const allValues = blocks.flatMap(b => b.values)

  // Build function nodes evenly spaced in a ring
  const functionNodes: ImpactNode[] = allFunctions.map((f, i) => {
    const angle = (2 * Math.PI * i) / Math.max(allFunctions.length, 1)
    return {
      id: f.id,
      label: f.id.replace(/^F\./, '').slice(0, 18),
      type: 'function',
      x: Math.round(CENTRE_X + FUNCTION_RADIUS * Math.cos(angle)),
      y: Math.round(CENTRE_Y + FUNCTION_RADIUS * Math.sin(angle)),
      highlighted: false,
    }
  })

  // Build value nodes grouped near their parent F. node (same angular sector)
  // Determine parent index for each V. entry via valueOfFunction link
  const valueNodes: ImpactNode[] = allValues.map((v, i) => {
    // Find parent function index
    let parentAngle = (2 * Math.PI * i) / Math.max(allValues.length, 1)
    const link = v.valueOfFunction || ''
    const parentIndex = allFunctions.findIndex(f => link.includes(f.id))
    if (parentIndex >= 0) {
      const baseAngle = (2 * Math.PI * parentIndex) / Math.max(allFunctions.length, 1)
      // Spread values in the same sector, slightly offset
      const sectorSize = (2 * Math.PI) / Math.max(allFunctions.length, 1)
      const offset = ((i % 3) - 1) * (sectorSize * 0.25)
      parentAngle = baseAngle + offset
    }
    return {
      id: v.id,
      label: v.id.replace(/^V\./, '').slice(0, 18),
      type: 'value',
      x: Math.round(CENTRE_X + VALUE_RADIUS * Math.cos(parentAngle)),
      y: Math.round(CENTRE_Y + VALUE_RADIUS * Math.sin(parentAngle)),
      highlighted: false,
    }
  })

  const domainNode: ImpactNode = {
    id: '__domain__',
    label: 'Domain',
    type: 'domain',
    x: CENTRE_X,
    y: CENTRE_Y,
    highlighted: false,
  }

  const nodes = computed<ImpactNode[]>(() => {
    const h = highlighted.value
    return [domainNode, ...functionNodes, ...valueNodes].map(n => ({
      ...n,
      highlighted: h === '' || n.id === h || isHighlightedDescendant(n.id, h),
    }))
  })

  function isHighlightedDescendant(nodeId: string, highlightedId: string): boolean {
    // If domain is highlighted, all are highlighted
    if (highlightedId === '__domain__') return true
    // If a function is highlighted, its value children are also highlighted
    const hNode = [...functionNodes, domainNode].find(n => n.id === highlightedId)
    if (hNode && hNode.type === 'function') {
      const vNode = allValues.find(v => v.id === nodeId)
      if (vNode) {
        return (vNode.valueOfFunction || '').includes(highlightedId)
      }
    }
    return false
  }

  // Edges: domain → each F., then each F. → its V. children
  const edges = computed<ImpactEdge[]>(() => {
    const result: ImpactEdge[] = functionNodes.map(f => ({
      from: '__domain__',
      to: f.id,
    }))
    for (const v of allValues) {
      const link = v.valueOfFunction || ''
      const parent = allFunctions.find(f => link.includes(f.id))
      if (parent) {
        result.push({ from: parent.id, to: v.id })
      } else if (functionNodes.length > 0) {
        result.push({ from: functionNodes[0].id, to: v.id })
      } else {
        result.push({ from: '__domain__', to: v.id })
      }
    }
    return result
  })

  function highlightSubtree(id: string): void {
    highlighted.value = id
  }

  function clearHighlight(): void {
    highlighted.value = ''
  }

  return { nodes, edges, highlighted, highlightSubtree, clearHighlight }
}
