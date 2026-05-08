// UNIT_TYPE=Composable
// Feature #60 — Spec gap analyser
import { ref } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface SpecGap {
  id: string
  category: string    // e.g. "Performance", "User Experience"
  description: string // what's missing
  template: string    // which template this comes from
  severity: 'critical' | 'recommended' | 'optional'
  exampleEntry: string // suggested V. entry description
}

// Template gap definitions
const GAP_TEMPLATES: Record<string, SpecGap[]> = {
  Product: [
    { id: 'g-product-1', category: 'Adoption', description: 'No V. entry measuring user adoption rate or active users', template: 'Product', severity: 'critical', exampleEntry: 'V.AdoptionRate — % of target users actively using the feature per month' },
    { id: 'g-product-2', category: 'Retention', description: 'No V. entry measuring user retention or churn', template: 'Product', severity: 'critical', exampleEntry: 'V.UserRetention — % of users still active 30 days after first use' },
    { id: 'g-product-3', category: 'Performance', description: 'No V. entry for response time or latency', template: 'Product', severity: 'recommended', exampleEntry: 'V.ResponseTime — 95th percentile page load time in ms' },
  ],
  Engineering: [
    { id: 'g-eng-1', category: 'Reliability', description: 'No V. entry for uptime or availability', template: 'Engineering', severity: 'critical', exampleEntry: 'V.Availability — % uptime over rolling 30-day window' },
    { id: 'g-eng-2', category: 'Performance', description: 'No V. entry for throughput or latency SLA', template: 'Engineering', severity: 'critical', exampleEntry: 'V.Throughput — requests/second at 99th percentile under load' },
    { id: 'g-eng-3', category: 'Security', description: 'No V. entry for security or vulnerability coverage', template: 'Engineering', severity: 'recommended', exampleEntry: 'V.SecurityScanCoverage — % of code paths covered by automated security scans' },
  ],
  Business: [
    { id: 'g-biz-1', category: 'Revenue', description: 'No V. entry measuring revenue impact', template: 'Business', severity: 'critical', exampleEntry: 'V.RevenueImpact — incremental monthly recurring revenue in USD' },
    { id: 'g-biz-2', category: 'Cost', description: 'No V. entry for cost reduction or efficiency', template: 'Business', severity: 'recommended', exampleEntry: 'V.OperationalCostReduction — % reduction in support tickets per month' },
    { id: 'g-biz-3', category: 'Customer', description: 'No V. entry for customer satisfaction or NPS', template: 'Business', severity: 'recommended', exampleEntry: 'V.CustomerSatisfaction — NPS score from monthly survey' },
  ],
  Research: [
    { id: 'g-res-1', category: 'Validity', description: 'No V. entry for hypothesis validation rate', template: 'Research', severity: 'critical', exampleEntry: 'V.HypothesisValidationRate — % of tested hypotheses with statistically significant results' },
    { id: 'g-res-2', category: 'Reproducibility', description: 'No V. entry for result reproducibility', template: 'Research', severity: 'recommended', exampleEntry: 'V.ReproducibilityRate — % of experiments that produce same result on re-run' },
  ],
  Personal: [
    { id: 'g-per-1', category: 'Progress', description: 'No V. entry for measurable personal progress', template: 'Personal', severity: 'critical', exampleEntry: 'V.WeeklyProgressRate — % of weekly goals achieved' },
    { id: 'g-per-2', category: 'Consistency', description: 'No V. entry for habit or consistency tracking', template: 'Personal', severity: 'recommended', exampleEntry: 'V.HabitConsistency — days per week the habit is performed' },
  ],
  General: [
    { id: 'g-gen-1', category: 'Completeness', description: 'No V. entry with all required fields (Scale, Meter, Goal, Tolerable)', template: 'General', severity: 'critical', exampleEntry: 'Every V. entry should have Scale (what), Meter (how), Goal (target), Tolerable (minimum)' },
    { id: 'g-gen-2', category: 'Traceability', description: 'No S. entries — solutions not defined', template: 'General', severity: 'recommended', exampleEntry: 'Add S. entries that trace to each F. entry — one implementation approach per function' },
  ],
}

function detectDomain(spec: SpecBlock): string {
  const text = [
    ...spec.functions.map(f => f.description),
    ...spec.values.map(v => `${v.description} ${v.scale ?? ''}`),
  ].join(' ').toLowerCase()

  if (/api|deploy|latency|database|server|uptime/.test(text)) return 'Engineering'
  if (/user|onboard|retention|feature|product/.test(text)) return 'Product'
  if (/revenue|customer|sales|nps|churn/.test(text)) return 'Business'
  if (/research|hypothesis|experiment|study/.test(text)) return 'Research'
  if (/health|habit|personal|fitness|exercise/.test(text)) return 'Personal'
  return 'General'
}

function hasEntryAddressing(spec: SpecBlock, keywords: string[]): boolean {
  const allText = [
    ...spec.values.map(v => `${v.description} ${v.scale ?? ''} ${v.goal ?? ''}`),
  ].join(' ').toLowerCase()
  return keywords.some(k => allText.includes(k))
}

export function useSpecGapAnalyser() {
  const gaps = ref<SpecGap[]>([])
  const detectedDomain = ref('')
  const selectedTemplate = ref('Auto')

  function analyseGaps(spec: SpecBlock): void {
    const domain = selectedTemplate.value === 'Auto' ? detectDomain(spec) : selectedTemplate.value
    detectedDomain.value = domain
    const templateGaps = GAP_TEMPLATES[domain] ?? GAP_TEMPLATES.General

    // Filter out gaps that are already addressed
    const domainKeywords: Record<string, string[]> = {
      'g-product-1': ['adopt', 'active user', 'monthly active'],
      'g-product-2': ['retention', 'churn', 'return'],
      'g-product-3': ['latency', 'response time', 'load time', 'ms'],
      'g-eng-1': ['uptime', 'availability', 'sla'],
      'g-eng-2': ['throughput', 'rps', 'latency', 'p99'],
      'g-eng-3': ['security', 'vulnerability', 'scan'],
      'g-biz-1': ['revenue', 'mrr', 'arr', 'usd'],
      'g-biz-2': ['cost', 'efficiency', 'reduction'],
      'g-biz-3': ['satisfaction', 'nps', 'csat'],
      'g-res-1': ['hypothesis', 'validation', 'significance'],
      'g-res-2': ['reproduc', 'repeat', 'replicate'],
      'g-per-1': ['progress', 'goal achieved', 'weekly'],
      'g-per-2': ['habit', 'consistency', 'streak'],
      'g-gen-1': ['scale', 'meter', 'goal'],
      'g-gen-2': ['solution', 'implement'],
    }

    gaps.value = templateGaps.filter(gap => {
      const keywords = domainKeywords[gap.id] ?? []
      return !hasEntryAddressing(spec, keywords)
    })
  }

  return { gaps, detectedDomain, selectedTemplate, analyseGaps }
}
