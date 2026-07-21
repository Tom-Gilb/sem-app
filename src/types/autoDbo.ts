// UNIT_TYPE=Types
// Auto-DBO — Design By Objectives type definitions
// Named after the Apple II Forth tool built by Lech Krzanik for Tom Gilb, circa 1978.
// Tom Gilb 2026-06-07: "Auto-DBO: I want to create a new tool, which is specialised
// in Design, finding Solutions."

import type { SpecBlock } from './spec'

// ── Sharpening Dimensions ────────────────────────────────────────────────────

export type DboSharpenDimension =
  | 'design-quality'
  | 'cost-reduction'
  | 'effort-reduction'
  | 'calendar-time-reduction'
  | 'risk-reduction'
  | 'competitiveness'
  | 'innovation'
  | 'security'
  | 'usability'

export interface DboSharpenDimensionMeta {
  label: string
  keyedIcon: string
  description: string
  prompt: string          // Claudian prompt template for this dimension
  colorClass: string
  bgClass: string
  borderClass: string
}

export const DBO_SHARPEN_DIMENSIONS: Record<DboSharpenDimension, DboSharpenDimensionMeta> = {
  'design-quality': {
    label: 'Design Quality Better',
    keyedIcon: '[*→**]',
    description: 'Improve the overall quality attributes of the design — cohesion, simplicity, elegance, maintainability.',
    prompt: 'Analyse the Solutions in this design version. For each Solution, identify ONE specific way to improve its overall design quality — simplicity, cohesion, maintainability, or elegance. Return JSON array: [{solutionId, currentDescription, improvedDescription, rationale, sourceLayer}]. sourceLayer must be one of: "derived-from-plan", "cited-from-gilb", "llm-training". Cite Gilb source if applicable.',
    colorClass: 'text-violet-700',
    bgClass: 'bg-violet-50',
    borderClass: 'border-violet-300',
  },
  'cost-reduction': {
    label: 'Design for Cost Reduction',
    keyedIcon: '[€↓]',
    description: 'Find cost savings without sacrificing Values — cheaper materials, simpler architecture, off-the-shelf components.',
    prompt: 'Analyse the Solutions in this design version for cost reduction opportunities. For each, identify ONE way to reduce implementation or operational cost without violating any Constraints or dropping below Tolerable on any Value. Return JSON array: [{solutionId, currentDescription, improvedDescription, estimatedCostReduction, rationale, sourceLayer}].',
    colorClass: 'text-emerald-700',
    bgClass: 'bg-emerald-50',
    borderClass: 'border-emerald-300',
  },
  'effort-reduction': {
    label: 'Design for Effort Reduction',
    keyedIcon: '[%↓]',
    description: 'Reduce person-hours to implement — reuse, automation, simpler scope, proven patterns.',
    prompt: 'Analyse the Solutions in this design version for effort reduction opportunities. Identify where reuse, automation, or simpler approaches reduce person-hours required. Return JSON array: [{solutionId, currentDescription, improvedDescription, estimatedEffortReduction, rationale, sourceLayer}].',
    colorClass: 'text-blue-700',
    bgClass: 'bg-blue-50',
    borderClass: 'border-blue-300',
  },
  'calendar-time-reduction': {
    label: 'Design for Calendar Time Reduction',
    keyedIcon: '[→↓]',
    description: 'Reduce elapsed calendar time to deliver — parallelisation, phasing, critical-path elimination.',
    prompt: 'Analyse the Solutions in this design version for calendar time reduction. Identify dependencies that can be parallelised, work that can be phased or deferred, and critical-path bottlenecks. Return JSON array: [{solutionId, currentDescription, improvedDescription, estimatedTimeReduction, rationale, sourceLayer}].',
    colorClass: 'text-amber-700',
    bgClass: 'bg-amber-50',
    borderClass: 'border-amber-300',
  },
  'risk-reduction': {
    label: 'Design for Risk Reduction',
    keyedIcon: '[!?↓]',
    description: 'Reduce probability and impact of failure modes — redundancy, reversibility, staged delivery.',
    prompt: 'Analyse the Solutions in this design version for risk reduction. For each, identify the primary failure mode and ONE design change that reduces its probability or impact. Consider reversibility, redundancy, staged delivery, and proven components. Return JSON array: [{solutionId, primaryRisk, currentDescription, improvedDescription, rationale, sourceLayer}].',
    colorClass: 'text-red-700',
    bgClass: 'bg-red-50',
    borderClass: 'border-red-300',
  },
  'competitiveness': {
    label: 'Design for Competitiveness',
    keyedIcon: '[*>*]',
    description: 'Improve advantage relative to competing alternatives — differentiation, speed, unique capabilities.',
    prompt: 'Analyse the Solutions in this design version for competitive advantage. For each, identify ONE design change that creates a clear advantage relative to alternative approaches or competitor offerings. Reference any industry context if known. Return JSON array: [{solutionId, competitiveWeakness, currentDescription, improvedDescription, competitiveAdvantage, sourceLayer}].',
    colorClass: 'text-orange-700',
    bgClass: 'bg-orange-50',
    borderClass: 'border-orange-300',
  },
  'innovation': {
    label: 'Design for Innovation',
    keyedIcon: '[?→*]',
    description: 'Find novel approaches not yet considered — new technologies, business models, unconventional combinations.',
    prompt: 'Analyse the Solutions in this design version and propose ONE genuinely novel alternative for each — approaches not yet considered, unconventional technology combinations, or new delivery models. Do not constrain to current assumptions. Return JSON array: [{solutionId, currentDescription, innovativeAlternative, noveltyRationale, risks, sourceLayer}].',
    colorClass: 'text-purple-700',
    bgClass: 'bg-purple-50',
    borderClass: 'border-purple-300',
  },
  'security': {
    label: 'Design for Security',
    keyedIcon: '[*]!',
    description: 'Harden the design against threats — authentication, encryption, least privilege, auditability.',
    prompt: 'Analyse the Solutions in this design version for security vulnerabilities. For each, identify the primary threat vector and ONE specific design hardening. Apply least-privilege, defence-in-depth, and auditability principles. Return JSON array: [{solutionId, primaryThreat, currentDescription, hardenedDescription, hardeningRationale, sourceLayer}].',
    colorClass: 'text-slate-700',
    bgClass: 'bg-slate-50',
    borderClass: 'border-slate-300',
  },
  'usability': {
    label: 'Design for Usability',
    keyedIcon: '[*→☺]',
    description: 'Ease of use and learnability for intended stakeholders — zero-training, MOVE principle, error prevention.',
    prompt: 'Analyse the Solutions in this design version for usability. For each Solution that involves user interaction, identify ONE specific usability improvement that reduces friction, cognitive load, or training time. Return JSON array: [{solutionId, usabilityGap, currentDescription, improvedDescription, stakeholderBenefit, sourceLayer}].',
    colorClass: 'text-teal-700',
    bgClass: 'bg-teal-50',
    borderClass: 'border-teal-300',
  },
}

export const DBO_SHARPEN_DIMENSION_KEYS = Object.keys(DBO_SHARPEN_DIMENSIONS) as DboSharpenDimension[]

// ── Version Metadata ─────────────────────────────────────────────────────────

export type SolutionVersionStatus = 'draft' | 'approved' | 'deprecated'

export const SOLUTION_VERSION_STATUS_META: Record<SolutionVersionStatus, { label: string; colorClass: string; bgClass: string; borderClass: string }> = {
  draft:      { label: 'Draft',      colorClass: 'text-amber-700',   bgClass: 'bg-amber-50',   borderClass: 'border-amber-300' },
  approved:   { label: 'Approved',   colorClass: 'text-emerald-700', bgClass: 'bg-emerald-50', borderClass: 'border-emerald-300' },
  deprecated: { label: 'Deprecated', colorClass: 'text-slate-500',   bgClass: 'bg-slate-100',  borderClass: 'border-slate-300' },
}

export type SolutionVersionPurpose =
  | 'thought-experiment'
  | 'stakeholder-alignment'
  | 'cost-analysis'
  | 'risk-analysis'
  | 'innovation-search'
  | 'resource-optimisation'
  | 'custom'

export const SOLUTION_VERSION_PURPOSE_LABELS: Record<SolutionVersionPurpose, string> = {
  'thought-experiment':    'Thought Experiment',
  'stakeholder-alignment': 'Stakeholder Alignment',
  'cost-analysis':         'Cost Analysis',
  'risk-analysis':         'Risk Analysis',
  'innovation-search':     'Innovation Search',
  'resource-optimisation': 'Resource Optimisation',
  'custom':                'Custom',
}

// ── Sharpening Record ────────────────────────────────────────────────────────

export interface DboSharpenRecord {
  id: string
  dimension: DboSharpenDimension
  appliedAt: string
  suggestions: string[]
  appliedSuggestions: string[]
  notes: string
  /**
   * Structured before/after diff — same SharpenChangedEntry shape used by
   * SharpenDiffList.vue so the DBO changes display is identical to Stage 2.
   * Optional: records persisted before this field was added will have undefined.
   */
  changes?: import('../composables/useSharpen').SharpenChangedEntry[]
}

// ── IET Comparison ────────────────────────────────────────────────────────────

export interface DboImpactCell {
  versionId: string
  valueId: string
  impactEstimate: string
  confidence: 'high' | 'medium' | 'low' | 'unknown'
  notes: string
}

// ── Solution Version ──────────────────────────────────────────────────────────

export interface SolutionVersion {
  id: string
  name: string
  versionNumber: string
  dateCreated: string
  dateModified: string
  purpose: SolutionVersionPurpose
  purposeCustom: string
  status: SolutionVersionStatus
  description: string
  specSnapshot: SpecBlock
  sharpeningHistory: DboSharpenRecord[]
  impactEstimates: DboImpactCell[]
  notes: string
  tags: string[]
  approvedAt?: string
  approvedNote?: string
  forkedFromId?: string
  forkedFromName?: string
}

// ── Storage Shape ─────────────────────────────────────────────────────────────

export interface AutoDboStore {
  versions: SolutionVersion[]
  activeVersionId: string | null
}
