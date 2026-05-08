// UNIT_TYPE=Test
// Feature #115 — useTogafView composable tests

import { describe, it, expect } from 'vitest'
import { useTogafView } from '../useTogafView'
import type { SpecBlock } from '../../types/spec'

function makeBlock(overrides?: {
  functions?: Array<{ id: string; description?: string }>
  values?: Array<{ id: string; scale?: string }>
  solutions?: Array<{ id: string; description?: string }>
}): SpecBlock {
  return {
    functions: (overrides?.functions ?? []).map(f => ({
      id: f.id,
      type: 'Function',
      level: 'Product',
      description: f.description ?? `Desc ${f.id}`,
      successCriteria: '',
      functionOfValue: '',
    })),
    values: (overrides?.values ?? []).map(v => ({
      id: v.id,
      type: 'Value',
      level: 'Product',
      description: `Desc ${v.id}`,
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
      description: s.description ?? `Desc ${s.id}`,
      impact: '',
      function: '',
    })),
  }
}

describe('useTogafView', () => {
  it('always returns exactly 4 layers', () => {
    const { layers } = useTogafView([makeBlock()])
    expect(layers.value).toHaveLength(4)
  })

  it('layers are in order: Business, Application, Data, Technology', () => {
    const { layers } = useTogafView([makeBlock()])
    const names = layers.value.map(l => l.name)
    expect(names).toEqual(['Business', 'Application', 'Data', 'Technology'])
  })

  it('F. entry with "process" keyword goes to Business layer', () => {
    const block = makeBlock({
      functions: [{ id: 'F.ProcessOrders', description: 'Manage the business process' }],
    })
    const { layers } = useTogafView([block])
    const biz = layers.value.find(l => l.name === 'Business')!
    expect(biz.entries.map(e => e.id)).toContain('F.ProcessOrders')
  })

  it('F. entry with "workflow" keyword goes to Business layer', () => {
    const block = makeBlock({
      functions: [{ id: 'F.ApprovalWorkflow', description: 'Automate the approval workflow' }],
    })
    const { layers } = useTogafView([block])
    const biz = layers.value.find(l => l.name === 'Business')!
    expect(biz.entries.map(e => e.id)).toContain('F.ApprovalWorkflow')
  })

  it('F. entry without Business keywords falls into Application layer', () => {
    const block = makeBlock({
      functions: [{ id: 'F.RenderUI', description: 'Render user interface' }],
    })
    const { layers } = useTogafView([block])
    const app = layers.value.find(l => l.name === 'Application')!
    expect(app.entries.map(e => e.id)).toContain('F.RenderUI')
  })

  it('S. entry with "database" keyword goes to Data layer', () => {
    const block = makeBlock({
      solutions: [{ id: 'S.DatabaseSchema', description: 'Define the database schema' }],
    })
    const { layers } = useTogafView([block])
    const data = layers.value.find(l => l.name === 'Data')!
    expect(data.entries.map(e => e.id)).toContain('S.DatabaseSchema')
  })

  it('S. entry with "api" keyword goes to Application layer', () => {
    const block = makeBlock({
      solutions: [{ id: 'S.RestApi', description: 'Implement REST api endpoints' }],
    })
    const { layers } = useTogafView([block])
    const app = layers.value.find(l => l.name === 'Application')!
    expect(app.entries.map(e => e.id)).toContain('S.RestApi')
  })

  it('V. entry with "uptime" scale goes to Technology layer', () => {
    const block = makeBlock({
      values: [{ id: 'V.Uptime', scale: 'System uptime percentage' }],
    })
    const { layers } = useTogafView([block])
    const tech = layers.value.find(l => l.name === 'Technology')!
    expect(tech.entries.map(e => e.id)).toContain('V.Uptime')
  })

  it('V. entry without Technology scale falls back to Business layer', () => {
    const block = makeBlock({
      values: [{ id: 'V.UserSatisfaction', scale: 'User satisfaction score 1-10' }],
    })
    const { layers } = useTogafView([block])
    const biz = layers.value.find(l => l.name === 'Business')!
    expect(biz.entries.map(e => e.id)).toContain('V.UserSatisfaction')
  })

  it('layers can be empty (no entries in some layers)', () => {
    const block = makeBlock({ functions: [], values: [], solutions: [] })
    const { layers } = useTogafView([block])
    // All layers exist but some may be empty
    expect(layers.value).toHaveLength(4)
    const emptyCount = layers.value.filter(l => l.entries.length === 0).length
    expect(emptyCount).toBeGreaterThan(0)
  })

  it('setHighlight sets highlightedLayer', () => {
    const { highlightedLayer, setHighlight } = useTogafView([makeBlock()])
    setHighlight('Business')
    expect(highlightedLayer.value).toBe('Business')
  })

  it('setHighlight toggles off when same layer clicked twice', () => {
    const { highlightedLayer, setHighlight } = useTogafView([makeBlock()])
    setHighlight('Data')
    setHighlight('Data')
    expect(highlightedLayer.value).toBeNull()
  })

  it('setHighlight switches to different layer', () => {
    const { highlightedLayer, setHighlight } = useTogafView([makeBlock()])
    setHighlight('Business')
    setHighlight('Technology')
    expect(highlightedLayer.value).toBe('Technology')
  })

  it('S. entry with "cache" keyword goes to Data layer', () => {
    const block = makeBlock({
      solutions: [{ id: 'S.CacheLayer', description: 'Redis cache store for sessions' }],
    })
    const { layers } = useTogafView([block])
    const data = layers.value.find(l => l.name === 'Data')!
    expect(data.entries.map(e => e.id)).toContain('S.CacheLayer')
  })

  it('V. entry with "latency" scale goes to Technology layer', () => {
    const block = makeBlock({
      values: [{ id: 'V.Latency', scale: 'API response latency in ms' }],
    })
    const { layers } = useTogafView([block])
    const tech = layers.value.find(l => l.name === 'Technology')!
    expect(tech.entries.map(e => e.id)).toContain('V.Latency')
  })
})
