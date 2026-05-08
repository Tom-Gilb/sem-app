// UNIT_TYPE=Test
// Feature #62 — Tests for useShipChecklist composable

import { describe, it, expect } from 'vitest'
import { useShipChecklist } from '../useShipChecklist'
import type { SpecBlock } from '../../types/spec'

const baseValue = {
  type: 'Value',
  level: 'Product',
  scale: 'percentage',
  meter: 'automated test',
  tolerable: '',
  valueOfFunction: 'F.Provide',
}

const specWithGoalMet: SpecBlock = {
  functions: [],
  values: [
    {
      ...baseValue,
      id: 'V.Fluency',
      description: 'User fluency rate',
      status: '95%',
      goal: '90%',
    },
  ],
  solutions: [],
}

const specWithNoStatus: SpecBlock = {
  functions: [],
  values: [
    {
      ...baseValue,
      id: 'V.Speed',
      description: 'Page load time',
      status: '',
      goal: '2s',
    },
  ],
  solutions: [],
}

const specWithPartialStatus: SpecBlock = {
  functions: [],
  values: [
    {
      ...baseValue,
      id: 'V.Coverage',
      description: 'Test coverage rate',
      status: '75%',
      goal: '90%',
    },
  ],
  solutions: [],
}

const emptySpec: SpecBlock = {
  functions: [],
  values: [],
  solutions: [],
}

const mixedSpec: SpecBlock = {
  functions: [],
  values: [
    {
      ...baseValue,
      id: 'V.One',
      description: 'First metric',
      status: '95%',
      goal: '90%',
    },
    {
      ...baseValue,
      id: 'V.Two',
      description: 'Second metric',
      status: '',
      goal: '80%',
    },
    {
      ...baseValue,
      id: 'V.Three',
      description: 'Third metric',
      status: '',
      goal: '70%',
    },
  ],
  solutions: [],
}

describe('useShipChecklist', () => {
  it('checklist starts empty', () => {
    const { checklist } = useShipChecklist()
    expect(checklist.value).toHaveLength(0)
  })

  it('generateChecklist with goal met produces a pass item', () => {
    const { checklist, generateChecklist } = useShipChecklist()
    generateChecklist(specWithGoalMet)
    expect(checklist.value).toHaveLength(1)
    expect(checklist.value[0].checkStatus).toBe('pass')
  })

  it('generateChecklist with no status produces a fail item', () => {
    const { checklist, generateChecklist } = useShipChecklist()
    generateChecklist(specWithNoStatus)
    expect(checklist.value).toHaveLength(1)
    expect(checklist.value[0].checkStatus).toBe('fail')
  })

  it('generateChecklist with partial status produces a warn item', () => {
    const { checklist, generateChecklist } = useShipChecklist()
    generateChecklist(specWithPartialStatus)
    expect(checklist.value).toHaveLength(1)
    expect(checklist.value[0].checkStatus).toBe('warn')
  })

  it('overallStatus is ready when all goals are met', () => {
    const { overallStatus, generateChecklist } = useShipChecklist()
    generateChecklist(specWithGoalMet)
    expect(overallStatus.value).toBe('ready')
  })

  it('overallStatus is not-ready when fails outnumber passes', () => {
    const { overallStatus, generateChecklist } = useShipChecklist()
    generateChecklist(mixedSpec)
    expect(overallStatus.value).toBe('not-ready')
  })

  it('all checklist items have required fields', () => {
    const { checklist, generateChecklist } = useShipChecklist()
    generateChecklist(specWithGoalMet)
    const item = checklist.value[0]
    expect(item).toHaveProperty('entryId')
    expect(item).toHaveProperty('description')
    expect(item).toHaveProperty('goal')
    expect(item).toHaveProperty('status')
    expect(item).toHaveProperty('checkStatus')
    expect(item).toHaveProperty('notes')
  })

  it('generateChecklist with empty spec produces empty checklist without crashing', () => {
    const { checklist, generateChecklist } = useShipChecklist()
    expect(() => generateChecklist(emptySpec)).not.toThrow()
    expect(checklist.value).toHaveLength(0)
  })
})
