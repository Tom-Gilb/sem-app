// UNIT_TYPE=Utility
// Feature #58 — Team skills matrix inference
export interface SkillCategory {
  name: string
  keywords: string[]
  colour: string  // Tailwind bg hex
}

export const SKILL_CATEGORIES: SkillCategory[] = [
  { name: 'Frontend', keywords: ['ui', 'ux', 'interface', 'component', 'css', 'vue', 'react', 'html', 'design', 'modal', 'button', 'form'], colour: '#3b82f6' },
  { name: 'Backend', keywords: ['api', 'server', 'database', 'endpoint', 'query', 'sql', 'rest', 'graphql', 'cache', 'auth'], colour: '#8b5cf6' },
  { name: 'Data', keywords: ['analytics', 'metric', 'report', 'dashboard', 'chart', 'track', 'measure', 'kpi', 'score', 'rate'], colour: '#10b981' },
  { name: 'DevOps', keywords: ['deploy', 'ci', 'cd', 'pipeline', 'infrastructure', 'monitor', 'alert', 'scale', 'cloud', 'container'], colour: '#f59e0b' },
  { name: 'QA', keywords: ['test', 'qa', 'quality', 'bug', 'regression', 'coverage', 'verify', 'validate', 'audit'], colour: '#ef4444' },
  { name: 'Product', keywords: ['feature', 'roadmap', 'stakeholder', 'user story', 'requirement', 'spec', 'acceptance'], colour: '#6366f1' },
]

export type SkillLevel = 0 | 1 | 2 | 3  // none, low, medium, high

/**
 * Returns skill level for a skill category based on text content.
 */
export function detectSkillLevel(text: string, skill: SkillCategory): SkillLevel {
  const lower = text.toLowerCase()
  const hits = skill.keywords.filter(k => lower.includes(k)).length
  if (hits === 0) return 0
  if (hits === 1) return 1
  if (hits === 2) return 2
  return 3
}

/**
 * Returns a colour with opacity for a skill level cell.
 */
export function skillCellStyle(level: SkillLevel, colour: string): Record<string, string> {
  const opacities = [0.05, 0.25, 0.55, 0.85]
  return {
    backgroundColor: level === 0
      ? '#f1f5f9'
      : colour + Math.round(opacities[level] * 255).toString(16).padStart(2, '0'),
  }
}

/**
 * Builds the full skills matrix for a set of Evo steps.
 * Returns: skills × steps 2D array of SkillLevel
 */
export function buildSkillsMatrix(
  steps: Array<{ name: string; description?: string; solutionIds?: string[] }>,
  spec: { functions: Array<{ id: string; description: string }>; solutions: Array<{ id: string; description: string }> } | null
): SkillLevel[][] {
  return SKILL_CATEGORIES.map(skill =>
    steps.map(step => {
      const stepText = [
        step.name,
        step.description ?? '',
        ...(step.solutionIds ?? []).map(sid => {
          const s = spec?.solutions.find(sol => sol.id === sid)
          return s?.description ?? ''
        }),
      ].join(' ')
      return detectSkillLevel(stepText, skill)
    })
  )
}
