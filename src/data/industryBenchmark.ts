// UNIT_TYPE=Data
//
// industryBenchmark.ts — Industry Benchmark Layer types + Claudian prompt.
//
// Tom Gilb 2026-06-03 Conjunction-of-Technologies SUPREME principle, EXPLOIT #4:
// "Given a Planguage V. entry with Scale, Claudian fetches published industry
// benchmarks + tells you where your Goal sits vs norms.  Suggests adjustments
// to Tolerable / Goal / Wish."

import type { SourceProvenance, InternetCitation } from './aiSource'

/** Where the user's V. entry sits relative to industry norms. */
export type BenchmarkVerdict = 'below-industry-floor' | 'below-median' | 'at-median' | 'above-median' | 'best-in-class'

/** Benchmark finding for one V. entry. */
export interface BenchmarkFinding {
  /** Stable id */
  id: string
  /** V. entry id */
  valueRef: string
  /** Brief one-line "where you sit" verdict */
  verdict: BenchmarkVerdict
  /** Verdict explanation */
  verdictExplanation: string
  /** Published industry data points (each from a real source) */
  dataPoints: Array<{ label: string; value: string; citation: InternetCitation }>
  /** Suggested Tolerable / Goal / Wish adjustments */
  suggestedTolerable?: string
  suggestedGoal?: string
  suggestedWish?: string
  /** Provenance — always internet */
  provenance: SourceProvenance
}

export interface BenchmarkSet {
  planId: string
  generatedAt: number
  generatedBy: 'claudian' | 'mock' | 'manual'
  findings: BenchmarkFinding[]
}

export function storageKey(planId: string): string {
  return `industryBenchmark:v1:${(planId || 'default').trim()}`
}

export function buildClaudianPrompt(valueEntries: Array<{ id: string; description: string; scale?: string; tolerable?: string; goal?: string; wish?: string }>): string {
  return [
    'You are the Industry Benchmark Layer (Tom Gilb 2026-06-03 Conjunction-of-Technologies EXPLOIT #4).',
    '',
    'TASK: For each Value Spec below, fetch published industry benchmarks (Auth0 / Okta / Gartner /',
    'industry reports / academic papers / vendor SLAs) and tell the user where their current',
    'Tolerable / Goal / Wish sits relative to the industry norm.  Suggest evidence-backed adjustments.',
    '',
    'INPUT VALUES:',
    JSON.stringify(valueEntries, null, 2),
    '',
    'INSTRUCTIONS:',
    '  1. For each Value, use WebSearch / WebFetch to find at least 2 published benchmark data points.',
    '  2. Classify the user\'s current Goal as below-industry-floor / below-median / at-median /',
    '     above-median / best-in-class.',
    '  3. Suggest adjusted Tolerable / Goal / Wish thresholds based on the industry data.',
    '  4. EVERY data point MUST have a real URL citation.  No hallucination.',
    '',
    'OUTPUT — return ONLY this JSON, no prose, no markdown fences:',
    '',
    JSON.stringify({
      planId: '(filled by app)',
      generatedAt: 0,
      generatedBy: 'claudian',
      findings: [{
        id: 'bm-V.X',
        valueRef: 'V.X',
        verdict: 'below-median',
        verdictExplanation: '...',
        dataPoints: [
          { label: 'Auth0 industry report 2026', value: '99.95%', citation: { url: 'https://...', title: '...', fetchedAt: '2026-06-03' } },
        ],
        suggestedTolerable: '...',
        suggestedGoal: '...',
        suggestedWish: '...',
        provenance: {
          source: 'internet',
          internetCitation: { url: 'https://...', title: '...', fetchedAt: '2026-06-03' },
        },
      }],
    }, null, 2),
  ].join('\n')
}
