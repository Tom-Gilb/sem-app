// UNIT_TYPE=Data
// semTemplates — Feature #30: One-Click Spec Templates

export interface SemTemplate {
  id: string
  label: string
  icon: string    // Unicode emoji
  stakes: string
  ends: string
  means: string
}

export const SEM_TEMPLATES: SemTemplate[] = [
  {
    id: 'product-launch',
    label: 'Product Launch',
    icon: '🚀',
    stakes: 'Product Manager at a B2B SaaS company',
    ends: 'Increase user activation rate from 30% to 65% within 60 days of launch',
    means: 'Implement personalised onboarding flow with progress milestones and contextual tooltips',
  },
  {
    id: 'engineering',
    label: 'Engineering',
    icon: '⚙️',
    stakes: 'Engineering team lead responsible for system reliability',
    ends: 'Reduce API error rate from 2.1% to below 0.1% and p99 latency from 800ms to 200ms',
    means: 'Introduce circuit breakers, request retry logic with exponential backoff, and distributed caching layer',
  },
  {
    id: 'personal-goal',
    label: 'Personal Goal',
    icon: '🎯',
    stakes: 'Individual professional seeking career advancement',
    ends: 'Transition from mid-level to senior engineer role within 9 months, with 25% salary increase',
    means: 'Complete AWS Solutions Architect certification, lead one cross-team project, and publish 4 technical articles',
  },
  {
    id: 'research',
    label: 'Research Study',
    icon: '🔬',
    stakes: 'Academic researcher conducting user behaviour study',
    ends: 'Collect 500 validated survey responses and identify 3 statistically significant predictors of task completion',
    means: 'Deploy mixed-methods study combining eye-tracking sessions, think-aloud protocols, and online surveys via Prolific',
  },
  {
    id: 'marketing',
    label: 'Marketing Campaign',
    icon: '📢',
    stakes: 'Marketing director at an e-commerce company',
    ends: 'Increase email open rate from 18% to 35% and conversion rate from 1.2% to 3.5% over 3 months',
    means: 'Implement AI-driven send-time optimisation, A/B test 5 subject line formulas, and segment list by purchase behaviour',
  },
  {
    id: 'org-change',
    label: 'Org Change',
    icon: '🏢',
    stakes: 'HR Director leading a digital transformation initiative',
    ends: 'Achieve 80% employee digital tool adoption and reduce administrative overhead by 40% within 6 months',
    means: 'Roll out unified platform with mandatory training modules, change champions network, and weekly adoption dashboards',
  },
]
