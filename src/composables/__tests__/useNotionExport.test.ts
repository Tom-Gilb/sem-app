// UNIT_TYPE=Test
// Tests for useNotionExport composable (Feature #33)

import { describe, it, expect } from 'vitest'
import { useNotionExport } from '../useNotionExport'
import type { SpecBlock } from '../../types/spec'
import type { EvoStep } from '../../types/evo-plan'

const makeSpec = (): SpecBlock => ({
  functions: [
    {
      id: 'F.OnboardUser',
      type: 'Function',
      level: 'Product',
      description: 'Allow new users to complete onboarding',
      successCriteria: 'User reaches dashboard after sign-up',
      functionOfValue: 'V.OnboardingSpeed',
    },
  ],
  values: [
    {
      id: 'V.OnboardingSpeed',
      type: 'Value',
      level: 'Stakeholder',
      description: 'Time for new user to complete onboarding',
      scale: 'Minutes to first successful action',
      meter: 'Automated session timer',
      status: 'Status [now] 12 minutes',
      tolerable: 'Tolerable [2025] 8 minutes',
      goal: 'Goal [2025] 5 minutes',
      valueOfFunction: 'F.OnboardUser',
    },
  ],
  solutions: [
    {
      id: 'S.WizardFlow',
      type: 'Solution',
      level: 'Solution',
      description: 'Step-by-step onboarding wizard',
      impact: 'V.OnboardingSpeed ~70%',
      function: 'F.OnboardUser',
    },
  ],
})

const makeSteps = (): EvoStep[] => [
  {
    name: 'S.Evo1.Foundation',
    description: 'Set up core infrastructure',
    linkedValues: ['V.OnboardingSpeed'],
    linkedSolution: 'S.WizardFlow',
    effortPercent: 30,
  },
  {
    name: 'S.Evo2.Wizard',
    description: 'Implement the onboarding wizard UI',
    linkedValues: ['V.OnboardingSpeed'],
    linkedSolution: 'S.WizardFlow',
    effortPercent: 50,
  },
]

describe('useNotionExport', () => {
  const { convertToNotionMarkdown } = useNotionExport()

  it('output contains "# Planguage Specification"', () => {
    const output = convertToNotionMarkdown(makeSpec())
    expect(output).toContain('# Planguage Specification')
  })

  it('output contains a *Generated ...* date line', () => {
    const output = convertToNotionMarkdown(makeSpec())
    expect(output).toMatch(/\*Generated \d{4}-\d{2}-\d{2}\*/)
  })

  it('F. entry produces bold ID + description', () => {
    const output = convertToNotionMarkdown(makeSpec())
    expect(output).toContain('**F.OnboardUser** Allow new users to complete onboarding')
  })

  it('F. entry includes success criteria as blockquote', () => {
    const output = convertToNotionMarkdown(makeSpec())
    expect(output).toContain('> Success: User reaches dashboard after sign-up')
  })

  it('V. entry produces a markdown table with Scale and Meter rows', () => {
    const output = convertToNotionMarkdown(makeSpec())
    expect(output).toContain('**V.OnboardingSpeed**')
    expect(output).toContain('| Scale | Minutes to first successful action |')
    expect(output).toContain('| Meter | Automated session timer |')
  })

  it('V. entry table includes Goal, Tolerable, and Status rows', () => {
    const output = convertToNotionMarkdown(makeSpec())
    expect(output).toContain('| Goal | Goal [2025] 5 minutes |')
    expect(output).toContain('| Tolerable | Tolerable [2025] 8 minutes |')
    expect(output).toContain('| Status | Status [now] 12 minutes |')
  })

  it('S. entry produces bold ID + description + impact', () => {
    const output = convertToNotionMarkdown(makeSpec())
    expect(output).toContain('**S.WizardFlow** Step-by-step onboarding wizard')
    expect(output).toContain('*Impact: V.OnboardingSpeed ~70%*')
  })

  it('Evo Plan section included when steps provided', () => {
    const output = convertToNotionMarkdown(makeSpec(), makeSteps())
    expect(output).toContain('## Evo Plan')
    expect(output).toContain('S.Evo1.Foundation — 30% effort')
    expect(output).toContain('Values: V.OnboardingSpeed')
  })

  it('Evo Plan section absent when steps not provided', () => {
    const output = convertToNotionMarkdown(makeSpec())
    expect(output).not.toContain('## Evo Plan')
  })

  it('Evo Plan section absent when empty steps array provided', () => {
    const output = convertToNotionMarkdown(makeSpec(), [])
    expect(output).not.toContain('## Evo Plan')
  })

  it('output contains ## Functions, ## Values, ## Solutions headings', () => {
    const output = convertToNotionMarkdown(makeSpec())
    expect(output).toContain('## Functions')
    expect(output).toContain('## Values')
    expect(output).toContain('## Solutions')
  })
})
