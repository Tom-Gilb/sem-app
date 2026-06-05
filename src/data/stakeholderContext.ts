// UNIT_TYPE=Data
//
// stakeholderContext.ts — Stakeholder Context Fetcher types + Claudian prompt.
//
// Tom Gilb 2026-06-03 Conjunction-of-Technologies SUPREME principle, EXPLOIT #3:
// "Given a Planguage stakeholder entry (e.g. 'GDPR' or 'End User'), Claudian
// pulls current internet context (GDPR 2026 updates, etc.) and proposes V./C.
// updates citing sources."
//
// v1 (this ships): types + Claudian prompt + paste-back UX.  The actual
// internet fetch happens in Claudian (which has WebFetch / WebSearch tools).
// SEM App reads the paste-back JSON deterministically and renders.

import type { SourceProvenance, InternetCitation } from './aiSource'

/** A single suggested spec update derived from internet context for one stakeholder. */
export interface StakeholderContextFinding {
  /** Stable id */
  id: string
  /** Stakeholder name (matches the Planguage stakeholder ref) */
  stakeholderName: string
  /** Short observation title */
  title: string
  /** Full observation — what current context implies for this plan */
  observation: string
  /** Suggested spec change (e.g., "Add C.GDPR2026Article17", "Tighten V.PIIRetention Goal") */
  suggestedSpecUpdate: string
  /** Severity / relevance */
  severity: 'red' | 'orange' | 'green'
  /** Provenance — always internet for this tool, with citation */
  provenance: SourceProvenance
  /** Required internet citation (every finding MUST cite a URL) */
  citation: InternetCitation
}

export interface StakeholderContextSet {
  planId: string
  stakeholderName: string
  generatedAt: number
  generatedBy: 'claudian' | 'mock' | 'manual'
  findings: StakeholderContextFinding[]
}

export function storageKey(planId: string, stakeholderName: string): string {
  return `stakeholderContext:v1:${(planId || 'default').trim()}:${stakeholderName.trim()}`
}

export function buildClaudianPrompt(stakeholderName: string, planSummary: string): string {
  return [
    'You are the Stakeholder Context Fetcher (Tom Gilb 2026-06-03 Conjunction-of-Technologies EXPLOIT #3).',
    '',
    `TASK: Fetch current internet context relevant to the stakeholder "${stakeholderName}" and propose`,
    'concrete Planguage spec updates (new V./C./F. entries, threshold changes) the plan should make.',
    '',
    `STAKEHOLDER: ${stakeholderName}`,
    '',
    'PLAN SUMMARY (Planguage spec extract):',
    planSummary,
    '',
    'INSTRUCTIONS:',
    '  1. Use WebSearch / WebFetch (your tools) to find current authoritative information about this',
    '     stakeholder — e.g., regulatory updates, published standards, recent incidents, public',
    '     statements, industry benchmarks specific to this stakeholder.',
    '  2. For each material finding, propose a CONCRETE spec update:',
    '     - new Constraint Spec ("Add C.X stating Y")',
    '     - new Value Spec ("Add V.X measuring Y")',
    '     - threshold tightening ("Tighten V.Z Goal from A to B")',
    '     - new Function Spec presenceTest ("Add F.X presenceTest stating Y")',
    '  3. EVERY finding MUST cite a real URL.  No hallucinated citations.',
    '  4. Provenance: always `{ source: "internet", internetCitation: { url, title, fetchedAt, quote? } }`.',
    '',
    'OUTPUT — return ONLY this JSON, no prose, no markdown fences:',
    '',
    JSON.stringify({
      planId: '(filled by app)',
      stakeholderName,
      generatedAt: 0,
      generatedBy: 'claudian',
      findings: [{
        id: 'find-1',
        stakeholderName,
        title: '...',
        observation: '...',
        suggestedSpecUpdate: 'Add C.X stating Y; or Tighten V.Z Goal from A to B',
        severity: 'red',
        provenance: {
          source: 'internet',
          internetCitation: { url: 'https://...', title: 'Source title', fetchedAt: '2026-06-03', quote: 'Optional short quote' },
        },
        citation: { url: 'https://...', title: '...', fetchedAt: '2026-06-03' },
      }],
    }, null, 2),
  ].join('\n')
}
