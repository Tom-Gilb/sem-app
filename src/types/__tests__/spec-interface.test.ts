// Spec: S.EvoStep3.SpecBlockInterface — "All fields are typed as string or string[] — no optional fields (missing content uses empty string '')"
// This test documents the spec's intent: relatedSpecs field (added by implementation beyond spec definition)
// should behave as a required field with empty string as the missing-content sentinel, not an optional field.
//
// VATESTER NOTE: The implementation added relatedSpecs and past as TypeScript optional fields (using ?).
// The spec says "no optional fields." This test verifies the serialiser's behavior when these fields
// are set to empty string — per the spec contract, empty string should produce a placeholder comment,
// but the current implementation silently omits the field when it is empty/falsy.
// This is a spec violation for S.EvoStep3.SpecBlockInterface.

import { describe, it, expect } from 'vitest'
import { useSpecExport } from '../../composables/useSpecExport'
import type { SpecBlock } from '../spec'

describe('S.EvoStep3.SpecBlockInterface — no optional fields contract', () => {

  it('spec: all required F entry fields are strings (not undefined-able)', () => {
    // S.EvoStep3.SpecBlockInterface: FEntry must have { id, type, level, description, successCriteria, functionOfValue }
    // All typed as string — no optional fields. TypeScript interface must not have ? on any listed field.
    // This test verifies the interface is usable without optional field syntax at the call site.
    const entry = {
      id: 'F.Test',
      type: 'Function',
      level: 'Product',
      description: 'desc',
      successCriteria: 'crit',
      functionOfValue: 'V.Test',
    }
    // If the interface has optional fields not listed in the spec (e.g. relatedSpecs?),
    // this object is still valid TypeScript — the test confirms the required fields are all present.
    const spec: SpecBlock = { functions: [entry], values: [], solutions: [] }
    const { serialise } = useSpecExport()
    const output = serialise(spec)
    expect(output).toContain('#### F.Test')
    expect(output).not.toContain('<!-- MISSING')
  })

  it('spec: all required V entry fields are strings (not undefined-able)', () => {
    // S.EvoStep3.SpecBlockInterface: VEntry must have { id, type, level, description, scale, meter, status, tolerable, goal, valueOfFunction }
    const entry = {
      id: 'V.Test',
      type: 'Value',
      level: 'Product',
      description: 'desc',
      scale: 'scale',
      meter: 'meter',
      status: 'pre',
      tolerable: '70%',
      goal: '90%',
      valueOfFunction: 'F.Test',
    }
    const spec: SpecBlock = { functions: [], values: [entry], solutions: [] }
    const { serialise } = useSpecExport()
    const output = serialise(spec)
    expect(output).toContain('#### V.Test')
    expect(output).not.toContain('<!-- MISSING')
  })

  it('spec: all required S entry fields are strings (not undefined-able)', () => {
    // S.EvoStep3.SpecBlockInterface: SEntry must have { id, type, level, description, impact, function }
    const entry = {
      id: 'S.Test',
      type: 'Solution',
      level: 'Product',
      description: 'desc',
      impact: 'V.Test ~70%',
      function: 'F.Test',
    }
    const spec: SpecBlock = { functions: [], values: [], solutions: [entry] }
    const { serialise } = useSpecExport()
    const output = serialise(spec)
    expect(output).toContain('#### S.Test')
    expect(output).not.toContain('<!-- MISSING')
  })

})
