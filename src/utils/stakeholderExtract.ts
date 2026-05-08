// UNIT_TYPE=Utility
// Feature #59 — Stakeholder extraction from spec entries
export interface StakeholderMatch {
  name: string
  keywords: string[]
  colour: string
}

// Common stakeholder roles to detect
export const STAKEHOLDER_PATTERNS: StakeholderMatch[] = [
  { name: 'End User', keywords: ['user', 'customer', 'client', 'visitor', 'subscriber'], colour: '#3b82f6' },
  { name: 'Engineer', keywords: ['engineer', 'developer', 'dev', 'technical', 'api', 'backend', 'frontend'], colour: '#8b5cf6' },
  { name: 'Manager', keywords: ['manager', 'lead', 'director', 'head', 'executive', 'cto', 'ceo'], colour: '#f59e0b' },
  { name: 'Operations', keywords: ['ops', 'operations', 'devops', 'support', 'helpdesk', 'sre'], colour: '#10b981' },
  { name: 'Business', keywords: ['business', 'revenue', 'sales', 'marketing', 'growth'], colour: '#ef4444' },
  { name: 'Compliance', keywords: ['compliance', 'legal', 'audit', 'regulator', 'gdpr', 'security'], colour: '#6366f1' },
]

/**
 * Returns which stakeholders are mentioned in a text string.
 */
export function extractStakeholders(text: string): StakeholderMatch[] {
  const lower = text.toLowerCase()
  return STAKEHOLDER_PATTERNS.filter(s =>
    s.keywords.some(k => lower.includes(k))
  )
}

/**
 * Returns a 0-3 impact level for a V. entry relative to a stakeholder.
 * 0 = no relation, 1 = low, 2 = medium, 3 = high
 */
export function impactLevel(vEntryText: string, stakeholder: StakeholderMatch): 0 | 1 | 2 | 3 {
  const lower = vEntryText.toLowerCase()
  const hits = stakeholder.keywords.filter(k => lower.includes(k)).length
  if (hits === 0) return 0
  if (hits === 1) return 1
  if (hits === 2) return 2
  return 3
}
