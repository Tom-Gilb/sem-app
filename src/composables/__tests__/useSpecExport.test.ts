// Spec: V.ExportSchemaCompliance (stub — full tests in Evo Step 3)
// Tests that the serialiser produces correct field structure and placeholder comments

import { useSpecExport } from '../useSpecExport'
import type { SpecBlock } from '../../types/spec'

const FULL_SPEC: SpecBlock = {
  functions: [
    {
      id: 'F.ExampleFunction',
      type: 'Function',
      level: 'Product',
      description: 'An example function',
      successCriteria: 'Works correctly',
      functionOfValue: 'V.ExampleValue',
    },
  ],
  values: [
    {
      id: 'V.ExampleValue',
      type: 'Value',
      level: 'Product',
      description: 'An example value',
      scale: 'Percentage of users satisfied',
      meter: 'Survey response rate',
      status: 'pre-build',
      tolerable: '70%',
      goal: '90%',
      valueOfFunction: 'F.ExampleFunction',
    },
  ],
  solutions: [
    {
      id: 'S.ExampleSolution',
      type: 'Solution',
      level: 'Product',
      description: 'An example solution',
      impact: 'V.ExampleValue ~70%',
      function: 'F.ExampleFunction',
    },
  ],
}

describe('useSpecExport', () => {
  it('serialises F entry with all required fields', () => {
    const { serialise } = useSpecExport()
    const output = serialise(FULL_SPEC)
    expect(output).toContain('#### F.ExampleFunction')
    expect(output).toContain('Type: Function')
    expect(output).toContain('Level: Product')
    expect(output).toContain('Description: An example function')
    expect(output).toContain('Success-Criteria: Works correctly')
    expect(output).toContain('Function of Value: V.ExampleValue')
  })

  it('serialises V entry with all required fields including Description/Scale/Meter/Goal', () => {
    const { serialise } = useSpecExport()
    const output = serialise(FULL_SPEC)
    expect(output).toContain('#### V.ExampleValue')
    expect(output).toContain('Description: An example value')
    expect(output).toContain('Scale: Percentage of users satisfied')
    expect(output).toContain('Meter: Survey response rate')
    expect(output).toContain('Status: pre-build')
    expect(output).toContain('Tolerable: 70%')
    expect(output).toContain('Goal: 90%')
  })

  it('serialises S entry with all required fields', () => {
    const { serialise } = useSpecExport()
    const output = serialise(FULL_SPEC)
    expect(output).toContain('#### S.ExampleSolution')
    expect(output).toContain('Description: An example solution')
    expect(output).toContain('Impact: V.ExampleValue ~70%')
    expect(output).toContain('Function: F.ExampleFunction')
  })

  it('emits placeholder comments for all missing V entry fields', () => {
    // Spec: S.MarkdownSerialiserSchema — any required field with empty string emits placeholder
    const { serialise } = useSpecExport()
    const specAllEmptyV: SpecBlock = {
      functions: [],
      values: [
        {
          id: 'V.AllEmpty',
          type: '',
          level: '',
          description: '',
          scale: '',
          meter: '',
          status: '',
          tolerable: '',
          goal: '',
          valueOfFunction: '',
        },
      ],
      solutions: [],
    }
    const output = serialise(specAllEmptyV)
    // 9 fields on VEntry are emittable (type, level, description, scale, meter, status, tolerable, goal, valueOfFunction)
    const placeholderCount = (output.match(/<!-- MISSING/g) || []).length
    expect(placeholderCount).toBe(9)
  })

  it('emits placeholder comment for missing required field', () => {
    const { serialise } = useSpecExport()
    const specWithGap: SpecBlock = {
      functions: [],
      values: [
        {
          id: 'V.Incomplete',
          type: 'Value',
          level: 'Product',
          description: 'A value with a missing scale',
          scale: '',
          meter: 'Some meter',
          status: 'pre-build',
          tolerable: '70%',
          goal: '90%',
          valueOfFunction: 'F.Something',
        },
      ],
      solutions: [],
    }
    const output = serialise(specWithGap)
    expect(output).toContain('<!-- MISSING')
    expect(output).toContain('Scale')
  })

  it('orders output as F entries then V entries then S entries', () => {
    const { serialise } = useSpecExport()
    const output = serialise(FULL_SPEC)
    const fPos = output.indexOf('#### F.ExampleFunction')
    const vPos = output.indexOf('#### V.ExampleValue')
    const sPos = output.indexOf('#### S.ExampleSolution')
    expect(fPos).toBeLessThan(vPos)
    expect(vPos).toBeLessThan(sPos)
  })

  it('returns empty string for empty spec', () => {
    const { serialise } = useSpecExport()
    expect(serialise({ functions: [], values: [], solutions: [] })).toBe('')
  })

  // ── Placeholder branch coverage for F and S missing fields ─────────────

  it('emits placeholder comment for missing F entry fields', () => {
    // Spec: S.MarkdownSerialiserSchema — any required field with empty string emits placeholder comment
    const { serialise } = useSpecExport()
    const specWithEmptyF: SpecBlock = {
      functions: [
        {
          id: 'F.Empty',
          type: '',
          level: '',
          description: '',
          successCriteria: '',
          functionOfValue: '',
        },
      ],
      values: [],
      solutions: [],
    }
    const output = serialise(specWithEmptyF)
    expect(output).toContain('#### F.Empty')
    // All empty fields should emit placeholder comments
    const placeholderCount = (output.match(/<!-- MISSING/g) || []).length
    // 5 fields on FEntry are emittable (type, level, description, successCriteria, functionOfValue)
    expect(placeholderCount).toBe(5)
  })

  it('emits placeholder comment for missing S entry fields', () => {
    // Spec: S.MarkdownSerialiserSchema — placeholder comments for missing required S fields
    const { serialise } = useSpecExport()
    const specWithEmptyS: SpecBlock = {
      functions: [],
      values: [],
      solutions: [
        {
          id: 'S.Empty',
          type: '',
          level: '',
          description: '',
          impact: '',
          function: '',
        },
      ],
    }
    const output = serialise(specWithEmptyS)
    expect(output).toContain('#### S.Empty')
    // 5 fields on SEntry are emittable (type, level, description, impact, function)
    const placeholderCount = (output.match(/<!-- MISSING/g) || []).length
    expect(placeholderCount).toBe(5)
  })

  it('handles multiple F, V, and S entries in a single spec', () => {
    // Spec: V.EvoStep3.SerialiserCompliance — representative spec with 2 F, 3 V, 2 S
    const { serialise } = useSpecExport()
    const multiSpec: SpecBlock = {
      functions: [
        { id: 'F.One', type: 'Function', level: 'Product', description: 'desc one', successCriteria: 'crit one', functionOfValue: 'V.One' },
        { id: 'F.Two', type: 'Function', level: 'Product', description: 'desc two', successCriteria: 'crit two', functionOfValue: 'V.Two' },
      ],
      values: [
        { id: 'V.One', type: 'Value', level: 'Product', description: 'value one', scale: 'scale one', meter: 'meter one', status: 'pre', tolerable: '70%', goal: '90%', valueOfFunction: 'F.One' },
        { id: 'V.Two', type: 'Value', level: 'Product', description: 'value two', scale: 'scale two', meter: 'meter two', status: 'pre', tolerable: '80%', goal: '95%', valueOfFunction: 'F.Two' },
        { id: 'V.Three', type: 'Value', level: 'Product', description: 'value three', scale: 'scale three', meter: 'meter three', status: 'pre', tolerable: '60%', goal: '85%', valueOfFunction: 'F.One' },
      ],
      solutions: [
        { id: 'S.One', type: 'Solution', level: 'Product', description: 'sol one', impact: 'V.One ~50%', function: 'F.One' },
        { id: 'S.Two', type: 'Solution', level: 'Product', description: 'sol two', impact: 'V.Two ~40%', function: 'F.Two' },
      ],
    }
    const output = serialise(multiSpec)
    // All 7 entries present
    expect(output).toContain('#### F.One')
    expect(output).toContain('#### F.Two')
    expect(output).toContain('#### V.One')
    expect(output).toContain('#### V.Two')
    expect(output).toContain('#### V.Three')
    expect(output).toContain('#### S.One')
    expect(output).toContain('#### S.Two')
    // No placeholders in a fully-populated spec
    expect(output).not.toContain('<!-- MISSING')
  })
})
