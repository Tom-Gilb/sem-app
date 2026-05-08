// UNIT_TYPE=Utility
// Feature #58 — Team skills matrix unit tests

import { describe, test, expect } from 'vitest'
import {
  SKILL_CATEGORIES,
  detectSkillLevel,
  skillCellStyle,
  buildSkillsMatrix,
} from '../skillsMatrix'

const BACKEND_SKILL = SKILL_CATEGORIES.find(s => s.name === 'Backend')!
const FRONTEND_SKILL = SKILL_CATEGORIES.find(s => s.name === 'Frontend')!

const mockSpec = {
  functions: [{ id: 'F.1', description: 'A function' }],
  solutions: [{ id: 'S.1', description: 'api endpoint solution' }],
}

describe('SKILL_CATEGORIES', () => {
  test('has at least 6 categories', () => {
    expect(SKILL_CATEGORIES.length).toBeGreaterThanOrEqual(6)
  })

  test('each category has name, keywords, and colour', () => {
    for (const cat of SKILL_CATEGORIES) {
      expect(typeof cat.name).toBe('string')
      expect(Array.isArray(cat.keywords)).toBe(true)
      expect(cat.keywords.length).toBeGreaterThan(0)
      expect(typeof cat.colour).toBe('string')
      expect(cat.colour).toMatch(/^#/)
    }
  })
})

describe('detectSkillLevel', () => {
  test('returns ≥1 for text with backend keywords', () => {
    const level = detectSkillLevel('build api endpoint with database query', BACKEND_SKILL)
    expect(level).toBeGreaterThanOrEqual(1)
  })

  test('returns 0 for text with no matching keywords', () => {
    const level = detectSkillLevel('no keywords', FRONTEND_SKILL)
    expect(level).toBe(0)
  })

  test('returns 3 for text with many frontend keyword hits', () => {
    const level = detectSkillLevel('ui component form button design css', FRONTEND_SKILL)
    expect(level).toBe(3)
  })

  test('returns 1 for exactly one keyword hit', () => {
    const level = detectSkillLevel('deploy the service', SKILL_CATEGORIES.find(s => s.name === 'DevOps')!)
    expect(level).toBe(1)
  })

  test('returns 2 for exactly two keyword hits', () => {
    const level = detectSkillLevel('deploy and monitor the service', SKILL_CATEGORIES.find(s => s.name === 'DevOps')!)
    expect(level).toBe(2)
  })

  test('is case insensitive', () => {
    const level = detectSkillLevel('BUILD API ENDPOINT', BACKEND_SKILL)
    expect(level).toBeGreaterThanOrEqual(1)
  })
})

describe('skillCellStyle', () => {
  test('level 0 returns light background color', () => {
    const style = skillCellStyle(0, '#3b82f6')
    expect(style.backgroundColor).toBe('#f1f5f9')
  })

  test('level 3 returns a color including the base colour', () => {
    const style = skillCellStyle(3, '#3b82f6')
    expect(style.backgroundColor).toContain('#3b82f6')
  })

  test('level 1 returns a semi-transparent variant of the colour', () => {
    const style = skillCellStyle(1, '#3b82f6')
    expect(style.backgroundColor).toContain('#3b82f6')
    expect(style.backgroundColor).not.toBe('#f1f5f9')
  })

  test('level 2 returns a more opaque variant than level 1', () => {
    const style1 = skillCellStyle(1, '#3b82f6')
    const style2 = skillCellStyle(2, '#3b82f6')
    // Level 2 has higher opacity suffix (hex), so string is longer or different
    expect(style1.backgroundColor).not.toBe(style2.backgroundColor)
  })

  test('returns an object with backgroundColor key', () => {
    const style = skillCellStyle(0, '#3b82f6')
    expect(Object.keys(style)).toContain('backgroundColor')
  })
})

describe('buildSkillsMatrix', () => {
  test('returns 2D array with outer length = 6 (skills) for one step', () => {
    const matrix = buildSkillsMatrix([{ name: 'Build API' }], mockSpec)
    expect(matrix.length).toBe(6)
    expect(matrix[0].length).toBe(1)
  })

  test('returns 6 empty inner arrays for zero steps', () => {
    const matrix = buildSkillsMatrix([], mockSpec)
    expect(matrix.length).toBe(6)
    for (const row of matrix) {
      expect(row.length).toBe(0)
    }
  })

  test('handles null spec without throwing', () => {
    const matrix = buildSkillsMatrix([{ name: 'UI Work' }], null)
    expect(matrix).not.toBeNull()
    expect(matrix.length).toBe(6)
  })

  test('all values in matrix are 0, 1, 2, or 3', () => {
    const matrix = buildSkillsMatrix(
      [{ name: 'Build ui api test deploy' }],
      mockSpec,
    )
    for (const row of matrix) {
      for (const cell of row) {
        expect([0, 1, 2, 3]).toContain(cell)
      }
    }
  })

  test('detects frontend skill for step with UI keywords', () => {
    const matrix = buildSkillsMatrix([{ name: 'ui component form button design css' }], null)
    const frontendRow = matrix[0] // Frontend is first in SKILL_CATEGORIES
    expect(frontendRow[0]).toBeGreaterThan(0)
  })

  test('inner arrays match the number of steps', () => {
    const steps = [
      { name: 'Step 1' },
      { name: 'Step 2' },
      { name: 'Step 3' },
    ]
    const matrix = buildSkillsMatrix(steps, mockSpec)
    for (const row of matrix) {
      expect(row.length).toBe(3)
    }
  })

  test('uses solutionIds to look up spec solutions', () => {
    const specWithSol = {
      functions: [],
      solutions: [{ id: 'S.1', description: 'deploy pipeline ci infrastructure' }],
    }
    const matrix = buildSkillsMatrix([{ name: 'Basic', solutionIds: ['S.1'] }], specWithSol)
    const devopsIndex = SKILL_CATEGORIES.findIndex(s => s.name === 'DevOps')
    expect(matrix[devopsIndex][0]).toBeGreaterThan(0)
  })
})
