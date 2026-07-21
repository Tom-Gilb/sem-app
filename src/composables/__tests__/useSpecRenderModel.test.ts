// useSpecRenderModel — Phase A smoke tests (r41 v186)
//
// Phase A is the pure-data composable.  These tests pin the shape so that
// Phase B (useColorfulSpecHtml.ts) and Phase C (SpecOutput.vue) can refactor
// against a stable contract.

import { describe, it, expect } from 'vitest'
import {
  buildSpecRenderModel,
  sectionOf,
  entryCount,
  type SpecRenderModel,
} from '../useSpecRenderModel'
import type { SpecBlock } from '../../types/spec'

function makeMinimalSpec(): SpecBlock {
  return {
    functions: [
      {
        id:              'F.AlphaCapability',
        type:            'Function',
        level:           'Product',
        description:     'System can do thing X without error.',
        successCriteria: 'X completes within a single user-visible action.',
        functionOfValue: 'V.AlphaSpeed',
      },
    ],
    values: [
      {
        id:              'V.AlphaSpeed',
        type:            'Value',
        level:           'Product',
        description:     'End-to-end action completion time.',
        scale:           'seconds from click to completion',
        meter:           'browser performance timeline median over 30 days',
        status:          'pre-build',
        tolerable:       '2 [Q1.2026, Desktop]',
        goal:            '1 [Q1.2026, Desktop]',
        valueOfFunction: 'F.AlphaCapability',
      },
    ],
    solutions: [
      {
        id:          'S.AlphaCache',
        type:        'Solution',
        level:       'Product',
        description: 'Edge cache for the alpha lookup endpoint.',
        impact:      'V.AlphaSpeed ~0.4 sec saved',
        function:    'F.AlphaCapability',
      },
    ],
  } as unknown as SpecBlock
}

describe('useSpecRenderModel — buildSpecRenderModel', () => {
  it('returns one section per non-empty entry type', () => {
    const m = buildSpecRenderModel(makeMinimalSpec())
    const types = m.sections.map(s => s.type)
    expect(types).toEqual(['functions', 'values', 'solutions'])
  })

  it('omits sections for empty entry-type arrays', () => {
    const spec: SpecBlock = { functions: [], values: [], solutions: [] } as unknown as SpecBlock
    const m = buildSpecRenderModel(spec)
    expect(m.sections).toHaveLength(0)
  })

  it('emits Tag, Definition, Presence Test, Function-of-Value for a Function entry', () => {
    const m = buildSpecRenderModel(makeMinimalSpec())
    const fns = sectionOf(m, 'functions')!
    expect(fns.entries).toHaveLength(1)
    const keys = fns.entries[0].fields.map(f => f.key)
    expect(keys).toContain('tag')
    expect(keys).toContain('desc')
    expect(keys).toContain('presenceTest')
    expect(keys).toContain('functionOfValue')
  })

  it('emits Tag, Ambition Level, Scale, Meter, Tolerable, Goal for a Value entry', () => {
    const m = buildSpecRenderModel(makeMinimalSpec())
    const vals = sectionOf(m, 'values')!
    expect(vals.entries).toHaveLength(1)
    const keys = vals.entries[0].fields.map(f => f.key)
    expect(keys).toContain('tag')
    expect(keys).toContain('desc')
    expect(keys).toContain('scale')
    expect(keys).toContain('meter')
    expect(keys).toContain('tolerable')
    expect(keys).toContain('goal')
  })

  it('assigns canonical Planguage colours per section', () => {
    const m = buildSpecRenderModel(makeMinimalSpec())
    expect(sectionOf(m, 'functions')!.color).toBe('green')
    expect(sectionOf(m, 'values')!.color).toBe('violet')
    expect(sectionOf(m, 'solutions')!.color).toBe('orange')
  })

  it('marks Tag fields with kind="tag" and Description with kind="description"', () => {
    const m = buildSpecRenderModel(makeMinimalSpec())
    const v = sectionOf(m, 'values')!.entries[0]
    expect(v.fields.find(f => f.key === 'tag')?.kind).toBe('tag')
    expect(v.fields.find(f => f.key === 'desc')?.kind).toBe('description')
    expect(v.fields.find(f => f.key === 'scale')?.kind).toBe('param')
  })

  it('paints Tolerable amber and Goal green (signal colour stripes preserved)', () => {
    const m = buildSpecRenderModel(makeMinimalSpec())
    const v = sectionOf(m, 'values')!.entries[0]
    expect(v.fields.find(f => f.key === 'tolerable')?.color).toBe('amber')
    expect(v.fields.find(f => f.key === 'goal')?.color).toBe('green')
  })

  it('entryCount returns 3 for the minimal spec (one Function + one Value + one Solution)', () => {
    const m: SpecRenderModel = buildSpecRenderModel(makeMinimalSpec())
    expect(entryCount(m)).toBe(3)
  })
})
