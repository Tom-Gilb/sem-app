// Spec: V.ExportSchemaCompliance (stub — full tests in Evo Step 3)
// Spec: V.EvoStep8.TaskExportFormat — task list export format (added Evo Step 8)
// Tests that the serialiser produces correct field structure and placeholder comments

import { useSpecExport, exportWithTasks } from '../useSpecExport'
import type { SpecBlock } from '../../types/spec'
import type { EvoStep } from '../../types/evo-plan'
import type { TaskSuggestion } from '../../types/task'

const FULL_SPEC: SpecBlock = {
  functions: [
    {
      id: 'F.ExampleFunction',
      type: 'Function',
      level: 'Product',
      description: 'An example function',
      // DD-004 (2026-05-14): successCriteria renamed → presenceTest.
      presenceTest: 'Works correctly',
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
    expect(output).toContain('Presence-Test: Works correctly')
    expect(output).toContain('Function of Value: V.ExampleValue')
  })

  it('serialises V entry with all required fields including Type/Level/Description/Scale/Meter/Status/Tolerable/Goal/ValueOfFunction', () => {
    // Spec: S.EvoStep3.SerialiserComposable — (a) output string contains all required field keys for V entry
    const { serialise } = useSpecExport()
    const output = serialise(FULL_SPEC)
    expect(output).toContain('#### V.ExampleValue')
    expect(output).toContain('Type: Value')
    expect(output).toContain('Level: Product')
    expect(output).toContain('Description: An example value')
    expect(output).toContain('Scale: Percentage of users satisfied')
    expect(output).toContain('Meter: Survey response rate')
    expect(output).toContain('Status: pre-build')
    expect(output).toContain('Tolerable: 70%')
    expect(output).toContain('Goal: 90%')
    expect(output).toContain('Value of function: F.ExampleFunction')
  })

  it('serialises S entry with all required fields including Type and Level', () => {
    // Spec: S.EvoStep3.SerialiserComposable — (a) output string contains all required field keys for S entry
    const { serialise } = useSpecExport()
    const output = serialise(FULL_SPEC)
    expect(output).toContain('#### S.ExampleSolution')
    expect(output).toContain('Type: Solution')
    expect(output).toContain('Level: Product')
    expect(output).toContain('Description: An example solution')
    expect(output).toContain('Impact: V.ExampleValue ~70%')
    expect(output).toContain('Function: F.ExampleFunction')
  })

  it('V entry field order matches required sequence: Type → Level → Description → Scale → Meter → Status → Tolerable → Goal → Value of function', () => {
    // Spec: S.EvoStep3.SerialiserComposable — (c) field order matches the required sequence
    const { serialise } = useSpecExport()
    const output = serialise(FULL_SPEC)
    const vBlock = output.slice(output.indexOf('#### V.ExampleValue'))
    const typePos = vBlock.indexOf('Type:')
    const levelPos = vBlock.indexOf('Level:')
    const descPos = vBlock.indexOf('Description:')
    const scalePos = vBlock.indexOf('Scale:')
    const meterPos = vBlock.indexOf('Meter:')
    const statusPos = vBlock.indexOf('Status:')
    const tolerablePos = vBlock.indexOf('Tolerable:')
    const goalPos = vBlock.indexOf('Goal:')
    const vofPos = vBlock.indexOf('Value of function:')
    expect(typePos).toBeLessThan(levelPos)
    expect(levelPos).toBeLessThan(descPos)
    expect(descPos).toBeLessThan(scalePos)
    expect(scalePos).toBeLessThan(meterPos)
    expect(meterPos).toBeLessThan(statusPos)
    expect(statusPos).toBeLessThan(tolerablePos)
    expect(tolerablePos).toBeLessThan(goalPos)
    expect(goalPos).toBeLessThan(vofPos)
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

  // ── Optional field absence tests ───────────────────────────────────────────
  // relatedSpecs and past are deferred to a future Evo step — serialiser must
  // never emit those labels on the current interface.

  it('omits Related-Specs for F entry when not provided', () => {
    const { serialise } = useSpecExport()
    const spec: SpecBlock = {
      functions: [
        {
          id: 'F.NoRelated',
          type: 'Function',
          level: 'Product',
          description: 'desc',
          successCriteria: 'crit',
          functionOfValue: 'V.Something',
        },
      ],
      values: [],
      solutions: [],
    }
    const output = serialise(spec)
    expect(output).not.toContain('Related-Specs')
  })

  it('V.EvoStep3.SerialiserCompliance — representative spec (2F 3V 2S) passes at 100% field completeness', () => {
    // Spec: V.EvoStep3.SerialiserCompliance — exit gate requires ≥ 98% completeness
    // This test uses a fully-populated representative spec and verifies zero MISSING comments.
    const { serialise } = useSpecExport()
    const representativeSpec: SpecBlock = {
      functions: [
        { id: 'F.One', type: 'Function', level: 'Product', description: 'First function', successCriteria: 'works', functionOfValue: 'V.One' },
        { id: 'F.Two', type: 'Function', level: 'Solution', description: 'Second function', successCriteria: 'also works', functionOfValue: 'V.Two' },
      ],
      values: [
        { id: 'V.One', type: 'Value', level: 'Product', description: 'First value', scale: 'Scale one', meter: 'Meter one', status: 'pre', tolerable: '70%', goal: '90%', valueOfFunction: 'F.One' },
        { id: 'V.Two', type: 'Value', level: 'Solution', description: 'Second value', scale: 'Scale two', meter: 'Meter two', status: 'pre', tolerable: '80%', goal: '95%', valueOfFunction: 'F.Two' },
        { id: 'V.Three', type: 'Value', level: 'Evo', description: 'Third value', scale: 'Scale three', meter: 'Meter three', status: 'pre', tolerable: '60%', goal: '85%', valueOfFunction: 'F.One' },
      ],
      solutions: [
        { id: 'S.One', type: 'Solution', level: 'Product', description: 'First solution', impact: 'V.One ~50%', function: 'F.One' },
        { id: 'S.Two', type: 'Solution', level: 'Solution', description: 'Second solution', impact: 'V.Two ~40%', function: 'F.Two' },
      ],
    }
    const output = serialise(representativeSpec)
    // No placeholders — all required fields are present
    expect(output).not.toContain('<!-- MISSING')
    // All 7 entries present
    expect(output).toContain('#### F.One')
    expect(output).toContain('#### F.Two')
    expect(output).toContain('#### V.One')
    expect(output).toContain('#### V.Two')
    expect(output).toContain('#### V.Three')
    expect(output).toContain('#### S.One')
    expect(output).toContain('#### S.Two')
  })
})

// ── exportWithTasks — Evo Step 8 (S.Evo8.TaskMarkdownExport) ──────────────────

/** Minimal EvoStep fixture */
function makeEvoStep(name: string): EvoStep {
  return {
    name,
    description: 'Test step description',
    linkedValues: ['V.Test'],
    linkedSolutions: ['S.Test'],
    effortPercent: 10,
  }
}

/** Minimal TaskSuggestion fixture */
function makeTask(description: string, overrides: Partial<TaskSuggestion> = {}): TaskSuggestion {
  return {
    id: `task-${Math.random().toString(36).slice(2)}`,
    description,
    effortHours: null,
    assignee: null,
    completed: false,
    ...overrides,
  }
}

const EMPTY_SPEC: SpecBlock = { functions: [], values: [], solutions: [] }

describe('exportWithTasks', () => {
  // ── "- [ ]" format ──────────────────────────────────────────────────────────

  it('2 steps × 2 tasks each → produces "- [ ]" format for each task', () => {
    // Spec: V.EvoStep8.TaskExportFormat — task items must be "- [ ]" Markdown format
    const steps = [makeEvoStep('S.Evo8.StepOne'), makeEvoStep('S.Evo8.StepTwo')]
    const tasks = {
      'S.Evo8.StepOne': [makeTask('Implement the handler'), makeTask('Create the schema')],
      'S.Evo8.StepTwo': [makeTask('Build the component'), makeTask('Add unit tests')],
    }
    const output = exportWithTasks(EMPTY_SPEC, steps, tasks)

    // All 4 tasks present with "- [ ]" format
    expect(output).toContain('- [ ] Implement the handler')
    expect(output).toContain('- [ ] Create the schema')
    expect(output).toContain('- [ ] Build the component')
    expect(output).toContain('- [ ] Add unit tests')
  })

  it('step headings use "###" prefix', () => {
    const steps = [makeEvoStep('S.StepA')]
    const tasks = { 'S.StepA': [makeTask('Do something')] }
    const output = exportWithTasks(EMPTY_SPEC, steps, tasks)
    expect(output).toContain('### S.StepA')
  })

  it('includes "## Evo Plan" section header', () => {
    const steps = [makeEvoStep('S.StepA')]
    const output = exportWithTasks(EMPTY_SPEC, steps, {})
    expect(output).toContain('## Evo Plan')
  })

  // ── No tasks → step headings only ──────────────────────────────────────────

  it('export with no tasks → step headings present with no "- [ ]" items', () => {
    // Spec: V.EvoStep8.TaskExportFormat — steps with no tasks show heading only
    const steps = [makeEvoStep('S.StepA'), makeEvoStep('S.StepB')]
    const output = exportWithTasks(EMPTY_SPEC, steps, {})
    expect(output).toContain('### S.StepA')
    expect(output).toContain('### S.StepB')
    expect(output).not.toContain('- [ ]')
    expect(output).not.toContain('- [x]')
  })

  // ── Effort hours ───────────────────────────────────────────────────────────

  it('task with effortHours set → includes "(Xh)" suffix', () => {
    const steps = [makeEvoStep('S.Step1')]
    const tasks = { 'S.Step1': [makeTask('Implement feature', { effortHours: 4 })] }
    const output = exportWithTasks(EMPTY_SPEC, steps, tasks)
    expect(output).toContain('- [ ] Implement feature (4h)')
  })

  it('task with no effort estimate → omits "(Xh)" suffix', () => {
    const steps = [makeEvoStep('S.Step1')]
    const tasks = { 'S.Step1': [makeTask('Implement feature', { effortHours: null })] }
    const output = exportWithTasks(EMPTY_SPEC, steps, tasks)
    expect(output).toContain('- [ ] Implement feature')
    expect(output).not.toContain('(')
  })

  // ── Completed tasks use "- [x]" ────────────────────────────────────────────

  it('completed task → "- [x]" format', () => {
    // Spec: V.EvoStep8.TaskExportFormat — completed tasks must use "- [x]"
    const steps = [makeEvoStep('S.Step1')]
    const tasks = {
      'S.Step1': [
        makeTask('Completed task', { completed: true }),
        makeTask('Incomplete task', { completed: false }),
      ],
    }
    const output = exportWithTasks(EMPTY_SPEC, steps, tasks)
    expect(output).toContain('- [x] Completed task')
    expect(output).toContain('- [ ] Incomplete task')
  })

  it('completed task with effort hours → "- [x] description (Xh)"', () => {
    const steps = [makeEvoStep('S.Step1')]
    const tasks = {
      'S.Step1': [makeTask('Done task', { completed: true, effortHours: 2.5 })],
    }
    const output = exportWithTasks(EMPTY_SPEC, steps, tasks)
    expect(output).toContain('- [x] Done task (2.5h)')
  })

  // ── Spec content included ──────────────────────────────────────────────────

  it('includes existing Planguage spec content before the Evo Plan section', () => {
    const steps = [makeEvoStep('S.Step1')]
    const tasks = { 'S.Step1': [makeTask('Task A')] }
    const output = exportWithTasks(FULL_SPEC, steps, tasks)

    const specPos = output.indexOf('#### F.ExampleFunction')
    const evoPos = output.indexOf('## Evo Plan')
    expect(specPos).toBeGreaterThanOrEqual(0)
    expect(evoPos).toBeGreaterThan(specPos)
  })

  it('returns only Evo Plan section when spec is empty', () => {
    const steps = [makeEvoStep('S.Step1')]
    const tasks = { 'S.Step1': [makeTask('Task A')] }
    const output = exportWithTasks(EMPTY_SPEC, steps, tasks)
    // Should start directly with ## Evo Plan (no leading blank lines from empty spec)
    expect(output.startsWith('## Evo Plan')).toBe(true)
  })

  // ── V.EvoStep8.TaskExportFormat exit gate: 3 Evo steps × ≥2 tasks each ────
  // Exit gate: "Task list export for a test plan (3 Evo steps, ≥2 tasks each)"
  // This directly matches the Evo Plan exit gate wording.

  it('V.EvoStep8.TaskExportFormat — 3 Evo steps × 2 tasks each produces correct - [ ] blocks under each step heading', () => {
    // Spec: V.EvoStep8.TaskExportFormat — vitest parse test for correct format
    const steps = [
      makeEvoStep('S.Evo8.Step1'),
      makeEvoStep('S.Evo8.Step2'),
      makeEvoStep('S.Evo8.Step3'),
    ]
    const tasks: Record<string, ReturnType<typeof makeTask>[]> = {
      'S.Evo8.Step1': [makeTask('Implement handler'), makeTask('Create schema')],
      'S.Evo8.Step2': [makeTask('Build component'), makeTask('Add unit tests')],
      'S.Evo8.Step3': [makeTask('Configure layout'), makeTask('Verify touch targets')],
    }
    const output = exportWithTasks(EMPTY_SPEC, steps, tasks)

    // All 3 step headings present
    expect(output).toContain('### S.Evo8.Step1')
    expect(output).toContain('### S.Evo8.Step2')
    expect(output).toContain('### S.Evo8.Step3')

    // All 6 tasks present in - [ ] format
    expect(output).toContain('- [ ] Implement handler')
    expect(output).toContain('- [ ] Create schema')
    expect(output).toContain('- [ ] Build component')
    expect(output).toContain('- [ ] Add unit tests')
    expect(output).toContain('- [ ] Configure layout')
    expect(output).toContain('- [ ] Verify touch targets')

    // Each step heading appears before its tasks
    const step1Pos = output.indexOf('### S.Evo8.Step1')
    const step1Task1Pos = output.indexOf('- [ ] Implement handler')
    const step2Pos = output.indexOf('### S.Evo8.Step2')
    const step2Task1Pos = output.indexOf('- [ ] Build component')
    const step3Pos = output.indexOf('### S.Evo8.Step3')
    const step3Task1Pos = output.indexOf('- [ ] Configure layout')

    expect(step1Task1Pos).toBeGreaterThan(step1Pos)
    expect(step2Task1Pos).toBeGreaterThan(step2Pos)
    expect(step3Task1Pos).toBeGreaterThan(step3Pos)

    // Steps are in order
    expect(step2Pos).toBeGreaterThan(step1Pos)
    expect(step3Pos).toBeGreaterThan(step2Pos)
  })
})

// ── exportPrioritisedPlan — Evo Step 9 (S.Evo9.PrioritisedPlanExport) ──────────────

import { exportPrioritisedPlan } from '../useSpecExport'
import type { ImpactMatrix } from '../../types/impact'

/** Minimal SpecBlock for Evo Step 9 export tests */
const PRIORITY_SPEC: SpecBlock = {
  functions: [
    { id: 'F.TestFunction', type: 'Function', level: 'Product', description: 'Test function', successCriteria: 'Works', functionOfValue: 'V.Alpha' },
  ],
  values: [
    { id: 'V.Alpha', type: 'Value', level: 'Product', description: 'Alpha value', scale: 'Scale', meter: 'Meter', status: 'pre', tolerable: '50%', goal: '80%', valueOfFunction: 'F.TestFunction' },
    { id: 'V.Beta', type: 'Value', level: 'Product', description: 'Beta value', scale: 'Scale', meter: 'Meter', status: 'pre', tolerable: '50%', goal: '80%', valueOfFunction: 'F.TestFunction' },
  ],
  solutions: [
    { id: 'S.One', type: 'Solution', level: 'Product', description: 'First solution', impact: 'V.Alpha ~60%', function: 'F.TestFunction' },
    { id: 'S.Two', type: 'Solution', level: 'Product', description: 'Second solution', impact: 'V.Beta ~40%', function: 'F.TestFunction' },
    { id: 'S.Three', type: 'Solution', level: 'Product', description: 'Third solution', impact: 'V.Alpha ~20%', function: 'F.TestFunction' },
  ],
}

/** Impact matrix: V.Alpha → S.One = 60, V.Beta → S.One = 40; S.Two = 30, 80; S.Three = 20, 10 */
const PRIORITY_MATRIX: ImpactMatrix = {
  'V.Alpha': { 'S.One': 60, 'S.Two': 30, 'S.Three': 20 },
  'V.Beta':  { 'S.One': 40, 'S.Two': 80, 'S.Three': 10 },
}

// V/C ratios with resourceClaim = 20 for all:
// S.One: (60+40)/20 = 5.00
// S.Two: (30+80)/20 = 5.50
// S.Three: (20+10)/20 = 1.50
const PRIORITY_VC_RATIOS: Record<string, number> = {
  'S.One': 5,
  'S.Two': 5.5,
  'S.Three': 1.5,
}

const PRIORITY_STEPS: EvoStep[] = [
  { name: 'Step.One',   description: 'Implements S.One',   linkedValues: ['V.Alpha'], linkedSolutions: ['S.One'],   effortPercent: 30 },
  { name: 'Step.Two',   description: 'Implements S.Two',   linkedValues: ['V.Beta'],  linkedSolutions: ['S.Two'],   effortPercent: 40 },
  { name: 'Step.Three', description: 'Implements S.Three', linkedValues: ['V.Alpha'], linkedSolutions: ['S.Three'], effortPercent: 20 },
]

const PRIORITY_TASKS: Record<string, TaskSuggestion[]> = {
  'Step.One': [
    makeTask('Implement the handler', { completed: false }),
    makeTask('Write unit tests',      { completed: true }),
  ],
  'Step.Two': [
    makeTask('Build the UI component'),
  ],
  'Step.Three': [],
}

describe('exportPrioritisedPlan', () => {
  // ── All four sections present ────────────────────────────────────────────────

  test('output contains the spec Planguage section', () => {
    // Spec: S.Evo9.PrioritisedPlanExport — section 1: Full Planguage Markdown spec
    const md = exportPrioritisedPlan(PRIORITY_SPEC, PRIORITY_STEPS, PRIORITY_TASKS, PRIORITY_MATRIX, PRIORITY_VC_RATIOS)
    expect(md).toContain('#### F.TestFunction')
    expect(md).toContain('#### V.Alpha')
    expect(md).toContain('#### S.One')
  })

  test('output contains the VDT Impact Matrix section', () => {
    // Spec: S.Evo9.PrioritisedPlanExport — section 2: VDT Impact Matrix
    const md = exportPrioritisedPlan(PRIORITY_SPEC, PRIORITY_STEPS, PRIORITY_TASKS, PRIORITY_MATRIX, PRIORITY_VC_RATIOS)
    expect(md).toContain('## VDT Impact Matrix')
  })

  test('output contains the V/C Ratios section', () => {
    // Spec: S.Evo9.PrioritisedPlanExport — section 3: V/C Ratios
    const md = exportPrioritisedPlan(PRIORITY_SPEC, PRIORITY_STEPS, PRIORITY_TASKS, PRIORITY_MATRIX, PRIORITY_VC_RATIOS)
    expect(md).toContain('## V/C Ratios')
  })

  test('output contains the Ranked Evo Plan section', () => {
    // Spec: S.Evo9.PrioritisedPlanExport — section 4: Ranked Evo Plan
    const md = exportPrioritisedPlan(PRIORITY_SPEC, PRIORITY_STEPS, PRIORITY_TASKS, PRIORITY_MATRIX, PRIORITY_VC_RATIOS)
    expect(md).toContain('## Ranked Evo Plan')
  })

  test('sections appear in correct order: spec → VDT → V/C → Ranked', () => {
    const md = exportPrioritisedPlan(PRIORITY_SPEC, PRIORITY_STEPS, PRIORITY_TASKS, PRIORITY_MATRIX, PRIORITY_VC_RATIOS)
    const specPos = md.indexOf('#### F.TestFunction')
    const vdtPos  = md.indexOf('## VDT Impact Matrix')
    const vcPos   = md.indexOf('## V/C Ratios')
    const rankPos = md.indexOf('## Ranked Evo Plan')
    expect(specPos).toBeLessThan(vdtPos)
    expect(vdtPos).toBeLessThan(vcPos)
    expect(vcPos).toBeLessThan(rankPos)
  })

  // ── VDT table pipe-delimited format ─────────────────────────────────────────

  test('VDT table has correct pipe-delimited header row with solution IDs', () => {
    // Spec: S.Evo9.PrioritisedPlanExport — pipe-delimited Markdown table format
    const md = exportPrioritisedPlan(PRIORITY_SPEC, PRIORITY_STEPS, PRIORITY_TASKS, PRIORITY_MATRIX, PRIORITY_VC_RATIOS)
    expect(md).toContain('| Value | S.One | S.Two | S.Three |')
  })

  test('VDT table has correct data rows for each value', () => {
    const md = exportPrioritisedPlan(PRIORITY_SPEC, PRIORITY_STEPS, PRIORITY_TASKS, PRIORITY_MATRIX, PRIORITY_VC_RATIOS)
    // V.Alpha row: 60 | 30 | 20
    expect(md).toContain('| V.Alpha | 60 | 30 | 20 |')
    // V.Beta row: 40 | 80 | 10
    expect(md).toContain('| V.Beta | 40 | 80 | 10 |')
  })

  // ── Ranked order matches vcRatios sort ──────────────────────────────────────

  test('ranked Evo Plan lists solutions in V/C descending order (S.Two > S.One > S.Three)', () => {
    // Spec: S.Evo9.PrioritisedPlanExport — ranked order matches vcRatios sort
    const md = exportPrioritisedPlan(PRIORITY_SPEC, PRIORITY_STEPS, PRIORITY_TASKS, PRIORITY_MATRIX, PRIORITY_VC_RATIOS)
    const twoPos   = md.lastIndexOf('Step.Two')
    const onePos   = md.lastIndexOf('Step.One')
    const threePos = md.lastIndexOf('Step.Three')
    expect(twoPos).toBeLessThan(onePos)
    expect(onePos).toBeLessThan(threePos)
  })

  // ── Completed tasks render as "- [x]" ────────────────────────────────────────

  test('completed tasks render as "- [x]" in the Ranked Evo Plan', () => {
    // Spec: S.Evo9.PrioritisedPlanExport — completed tasks render as "- [x]"
    const md = exportPrioritisedPlan(PRIORITY_SPEC, PRIORITY_STEPS, PRIORITY_TASKS, PRIORITY_MATRIX, PRIORITY_VC_RATIOS)
    expect(md).toContain('- [x] Write unit tests')
  })

  test('incomplete tasks render as "- [ ]" in the Ranked Evo Plan', () => {
    const md = exportPrioritisedPlan(PRIORITY_SPEC, PRIORITY_STEPS, PRIORITY_TASKS, PRIORITY_MATRIX, PRIORITY_VC_RATIOS)
    expect(md).toContain('- [ ] Implement the handler')
  })

  // ── V/C Ratios table accuracy ────────────────────────────────────────────────

  test('V/C Ratios table contains all solution IDs', () => {
    const md = exportPrioritisedPlan(PRIORITY_SPEC, PRIORITY_STEPS, PRIORITY_TASKS, PRIORITY_MATRIX, PRIORITY_VC_RATIOS)
    expect(md).toContain('| S.One |')
    expect(md).toContain('| S.Two |')
    expect(md).toContain('| S.Three |')
  })

  test('V/C Ratios table contains the correct value impact sums', () => {
    // S.One: 60+40=100; S.Two: 30+80=110; S.Three: 20+10=30
    const md = exportPrioritisedPlan(PRIORITY_SPEC, PRIORITY_STEPS, PRIORITY_TASKS, PRIORITY_MATRIX, PRIORITY_VC_RATIOS)
    // V/C Ratios table rows should contain the right sums
    expect(md).toContain('| S.One | 100 |')
    expect(md).toContain('| S.Two | 110 |')
    expect(md).toContain('| S.Three | 30 |')
  })

  // ── Empty spec ───────────────────────────────────────────────────────────────

  test('empty spec still produces all four section headers', () => {
    const md = exportPrioritisedPlan(
      { functions: [], values: [], solutions: [] },
      [],
      {},
      {},
      {},
    )
    expect(md).toContain('## VDT Impact Matrix')
    expect(md).toContain('## V/C Ratios')
    expect(md).toContain('## Ranked Evo Plan')
  })

  // ── Zero resourceClaim renders ∞ in the V/C Ratios table ─────────────────────

  test('zero resourceClaim solution renders ∞ in the V/C Ratios export section', () => {
    // Spec: S.Evo9.PrioritisedPlanExport — V/C Ratio section should reflect ∞ when
    // resource claim = 0 (per spec: "display as ∞ with a tooltip" in the UI; export
    // follows the same logic — vcRatios[sid] will be Infinity for zero-cost solutions).
    const spec: SpecBlock = {
      functions: [],
      values: [{ id: 'V.A', type: 'Value', level: 'Product', description: '', scale: '', meter: '', status: '', tolerable: '', goal: '', valueOfFunction: '' }],
      solutions: [{ id: 'S.Free', type: 'Solution', level: 'Product', description: '', impact: '', function: '' }],
    }
    const matrix: ImpactMatrix = { 'V.A': { 'S.Free': 50 } }
    // vcRatios with Infinity (zero resourceClaim)
    const vcRatios: Record<string, number> = { 'S.Free': Infinity }

    const md = exportPrioritisedPlan(spec, [], {}, matrix, vcRatios)

    expect(md).toContain('## V/C Ratios')
    expect(md).toContain('∞')
  })

  // ── Ranked Evo Plan fallback: no steps match solutions ────────────────────────

  test('Ranked Evo Plan falls back to listing all steps when no linkedSolutions match', () => {
    // Spec: S.Evo9.PrioritisedPlanExport — fallback to listing all steps when no step
    // has a linkedSolutions entry matching any solution ID in the VDT (e.g. when steps
    // are from a different spec context).
    const stepsNoMatch: EvoStep[] = [
      { name: 'Step.Unmatched', description: 'No solution link', linkedValues: ['V.Alpha'], linkedSolutions: ['S.Nonexistent'], effortPercent: 10 },
    ]
    const md = exportPrioritisedPlan(PRIORITY_SPEC, stepsNoMatch, {}, PRIORITY_MATRIX, PRIORITY_VC_RATIOS)

    // Fallback should still include the step name in the ranked section
    expect(md).toContain('## Ranked Evo Plan')
    expect(md).toContain('Step.Unmatched')
  })
})
