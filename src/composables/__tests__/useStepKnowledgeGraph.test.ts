import { describe, it, expect } from 'vitest'
import { useStepKnowledgeGraph } from '../useStepKnowledgeGraph'

const sampleSteps = [
  { name: 'Authentication flow', description: 'user login and register' },
  { name: 'Dashboard design', description: 'performance and metrics display' },
  { name: 'API integration', description: 'connect external services' },
]

const sampleValues = [
  { id: 'V.Auth', name: 'Authentication', description: 'login flow security' },
  { id: 'V.Perf', name: 'Performance', description: 'dashboard performance metrics' },
  { id: 'V.NoMatch', name: 'Compliance', description: 'regulatory audit' },
]

describe('useStepKnowledgeGraph — step nodes', () => {
  it('step node count matches steps array length', () => {
    const { nodes } = useStepKnowledgeGraph(sampleSteps, [])
    const stepNodes = nodes.value.filter((n) => n.type === 'step')
    expect(stepNodes).toHaveLength(sampleSteps.length)
  })

  it('step nodes have type "step"', () => {
    const { nodes } = useStepKnowledgeGraph(sampleSteps, [])
    for (const n of nodes.value) {
      expect(n.type).toBe('step')
    }
  })

  it('step nodes have ids step-0, step-1, step-2', () => {
    const { nodes } = useStepKnowledgeGraph(sampleSteps, [])
    const ids = nodes.value.map((n) => n.id)
    expect(ids).toContain('step-0')
    expect(ids).toContain('step-1')
    expect(ids).toContain('step-2')
  })

  it('labels are truncated to 14 characters', () => {
    const longSteps = [{ name: 'This is a very long step name that exceeds fourteen chars' }]
    const { nodes } = useStepKnowledgeGraph(longSteps, [])
    for (const n of nodes.value) {
      expect(n.label.length).toBeLessThanOrEqual(14)
    }
  })

  it('short labels are not truncated', () => {
    const { nodes } = useStepKnowledgeGraph([{ name: 'Short' }], [])
    expect(nodes.value[0].label).toBe('Short')
  })
})

describe('useStepKnowledgeGraph — value nodes', () => {
  it('no value nodes when valueBlocks is empty', () => {
    const { nodes } = useStepKnowledgeGraph(sampleSteps, [])
    const valueNodes = nodes.value.filter((n) => n.type === 'value')
    expect(valueNodes).toHaveLength(0)
  })

  it('value nodes added for values that share keywords with a step', () => {
    const { nodes } = useStepKnowledgeGraph(sampleSteps, sampleValues)
    const valueNodes = nodes.value.filter((n) => n.type === 'value')
    // V.Auth shares "authentication" with step 0 (Authentication flow)
    // V.Perf shares "performance" with step 1 (Dashboard design)
    // V.NoMatch has no shared keywords → should NOT appear
    expect(valueNodes.length).toBeGreaterThanOrEqual(1)
    const valueIds = valueNodes.map((n) => n.id)
    expect(valueIds).not.toContain('value-V.NoMatch')
  })

  it('value nodes have type "value"', () => {
    const { nodes } = useStepKnowledgeGraph(sampleSteps, sampleValues)
    const valueNodes = nodes.value.filter((n) => n.type === 'value')
    for (const n of valueNodes) {
      expect(n.type).toBe('value')
    }
  })

  it('value node radius is 12', () => {
    const { nodes } = useStepKnowledgeGraph(sampleSteps, sampleValues)
    const valueNodes = nodes.value.filter((n) => n.type === 'value')
    for (const n of valueNodes) {
      expect(n.radius).toBe(12)
    }
  })
})

describe('useStepKnowledgeGraph — edges', () => {
  it('edges built on keyword overlap (3+ char words)', () => {
    const { edges } = useStepKnowledgeGraph(sampleSteps, sampleValues)
    expect(edges.value.length).toBeGreaterThan(0)
  })

  it('no edges when valueBlocks is empty', () => {
    const { edges } = useStepKnowledgeGraph(sampleSteps, [])
    expect(edges.value).toHaveLength(0)
  })

  it('no edge when step and value share no keywords', () => {
    const steps = [{ name: 'xyz qqq', description: 'something' }]
    const values = [{ id: 'V.None', name: 'completely different', description: 'other unrelated' }]
    const { edges } = useStepKnowledgeGraph(steps, values)
    // "completely" and "different" and "other" and "unrelated" are 3+ chars but not in step
    // "xyz" and "qqq" and "something" are not in value text
    // Potential overlap: "something" vs nothing in values → check
    // "something" is not in values text → no edge expected
    // Actually let's verify by checking no edge for V.None
    const hasEdge = edges.value.some((e) => e.to === 'value-V.None')
    expect(hasEdge).toBe(false)
  })

  it('edge connects from step-id to value-id', () => {
    const steps = [{ name: 'authentication flow', description: 'user login' }]
    const values = [{ id: 'V.Auth', name: 'authentication security', description: 'login' }]
    const { edges } = useStepKnowledgeGraph(steps, values)
    expect(edges.value.length).toBeGreaterThan(0)
    expect(edges.value[0].from).toBe('step-0')
    expect(edges.value[0].to).toBe('value-V.Auth')
  })
})

describe('useStepKnowledgeGraph — radius clamping', () => {
  it('step node radius is clamped to minimum 18', () => {
    const { nodes } = useStepKnowledgeGraph([{ name: 'Solo' }], [])
    const stepNode = nodes.value.find((n) => n.type === 'step')
    expect(stepNode?.radius).toBeGreaterThanOrEqual(18)
  })

  it('step node radius scales with linkedCount and clamps to 36', () => {
    // Create a step that matches many values to get high linkedCount
    const steps = [{ name: 'authentication performance security compliance audit review design' }]
    const manyValues = Array.from({ length: 8 }, (_, i) => ({
      id: `V.${i}`,
      name: ['authentication', 'performance', 'security', 'compliance', 'audit', 'review', 'design', 'testing'][i],
      description: '',
    }))
    const { nodes } = useStepKnowledgeGraph(steps, manyValues)
    const stepNode = nodes.value.find((n) => n.type === 'step')
    expect(stepNode?.radius).toBeLessThanOrEqual(36)
    expect(stepNode?.radius).toBeGreaterThanOrEqual(18)
  })

  it('radius formula: 18 + linkedCount * 3 (unclamped range)', () => {
    const steps = [{ name: 'authentication flow' }]
    const values = [
      { id: 'V.A', name: 'authentication system', description: '' },
      { id: 'V.B', name: 'authentication flow security', description: '' },
    ]
    const { nodes, edges } = useStepKnowledgeGraph(steps, values)
    const stepNode = nodes.value.find((n) => n.id === 'step-0')
    const linkedCount = edges.value.filter((e) => e.from === 'step-0').length
    const expectedRadius = Math.min(36, Math.max(18, 18 + linkedCount * 3))
    expect(stepNode?.radius).toBe(expectedRadius)
  })
})
