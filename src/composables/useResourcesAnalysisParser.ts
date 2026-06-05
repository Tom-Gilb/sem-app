// UNIT_TYPE=Composable
// useResourcesAnalysisParser.ts — Phase 2 of the Resources beef-up.
//
// Tom Gilb 2026-06-04: *"I am keen to push resources far, that looks very
// significant"*.  This is the parser layer between Claudian's structured
// JSON output (per the r70 prompt) and SEM's spec write-back pipeline.
//
// Architecture (per Claude-Code-as-AI-Layer SUPREME rule):
//   1. User opens ResourcesSharpenPanel
//   2. Clicks "Copy prompt + spec" → bundle lands on clipboard
//   3. User pastes into Claudian (local terminal)
//   4. Claudian writes a structured JSON response per the schema below
//   5. User pastes that JSON back into the panel's "Apply Analysis" textarea
//   6. This parser validates + surfaces the structured findings
//   7. User ticks-to-approve per finding (AI-Max rule — never imposed)
//   8. Approved findings flow into SpecBlock as new R./S./C. entries
//
// Conjunction-of-Technologies SUPREME rule compliance:
//   • Every finding carries a `source` enum so provenance is visible
//   • `cited-from-gilb` findings carry a verifiable Gilb citation key
//   • The TwinPod URI registry (`twinPodBooksRegistry.ts`) resolves citation
//     keys to verify URIs for the AGENT (not surfaced to end users per the
//     TwinPod-URI Access Policy)
//
// Twin portability: pure parse/validate functions, no Vue reactivity, no
// DOM dependency.  Ports directly to Kai's industrial Twin app.

import type { REntry, SEntry, CEntry } from '../types/spec'

// ─── Source-layer badges (per Conjunction-of-Technologies rule) ───────────────

export type SourceLayer =
  | 'derived-from-plan'
  | 'cited-from-gilb'
  | 'llm-training'
  | 'internet-fetched'
  | 'generic-template'

export const SOURCE_LAYER_LABELS: Record<SourceLayer, string> = {
  'derived-from-plan':  'Derived from plan',
  'cited-from-gilb':    'Cited from Gilb',
  'llm-training':       'LLM training',
  'internet-fetched':   'Internet-fetched',
  'generic-template':   'Generic template',
}

export const SOURCE_LAYER_TONES: Record<SourceLayer, { bg: string; text: string; border: string }> = {
  'derived-from-plan':  { bg: '#dcfce7', text: '#15803d', border: '#16a34a' },
  'cited-from-gilb':    { bg: '#ede9fe', text: '#6d28d9', border: '#7c3aed' },
  'llm-training':       { bg: '#fef3c7', text: '#92400e', border: '#d97706' },
  'internet-fetched':   { bg: '#dbeafe', text: '#1d4ed8', border: '#2563eb' },
  'generic-template':   { bg: '#f1f5f9', text: '#475569', border: '#94a3b8' },
}

// ─── Severity levels for analytical findings ──────────────────────────────────

export type Severity = 'info' | 'suggestion' | 'warning' | 'critical'

export const SEVERITY_LABELS: Record<Severity, string> = {
  'info':        'Info',
  'suggestion':  'Suggestion',
  'warning':     'Warning',
  'critical':    'Critical',
}

// ─── Proposed-entry shapes (less strict than full SpecBlock entries) ──────────
//
// Claudian's output omits `type` (always implied) and `level` (defaults to
// 'Product').  Empty fields are tolerated so partial proposals still parse.

export interface REntryProposal {
  id:          string
  scale:       string
  meter?:      string
  tolerable:   string
  goal:        string
  status?:     string
  wish?:       string
  rationale?:  string
  resourceForValue?: string
  consumedBy?: string
}

export interface SEntryProposal {
  id:          string
  description: string
  impact:      string
  function?:   string
  rationale?:  string
}

export interface CEntryProposal {
  id:          string
  description: string
  scope?:      string
  rationale?:  string
  expectedResourceEffect?: string
  enforcedBy?: string
}

export interface TradeoffProposal {
  axis:        string  // Value name or Constraint id being traded
  give:        string  // What to give up
  save:        string  // What is saved
  approvedBy?: string  // Stakeholder name(s) who must approve
}

// ─── Finding shapes (Part A) ──────────────────────────────────────────────────

export interface AnalyticalFinding {
  /** Used to render a unique key + map back to the dimension on apply. */
  dimensionId:    string
  title:          string
  description:    string
  severity:       Severity
  source:         SourceLayer
  gilbCite?:      string
  proposedREntry?: REntryProposal | null
  tradeoff?:      TradeoffProposal | null
}

// ─── Tool outputs (Part B) ────────────────────────────────────────────────────

export interface GenerativeOutput {
  /** Mirrors `RESOURCES_ADVANCED_TOOLS.id` from `resourcesSharpenDimensions.ts`. */
  toolId:           string
  proposedREntries?: REntryProposal[]
  proposedSEntries?: SEntryProposal[]
  proposedCEntries?: CEntryProposal[]
  /** For Scale + Meter improvement / Scale qualifiers — describes the modification
   *  intent.  Apply-handler can either patch the existing entry in-place
   *  (with user approval) or surface it as a diff. */
  proposedFieldEdits?: Array<{
    entryId:    string
    field:      string
    currentValue?: string
    proposedValue: string
    rationale?: string
    source:     SourceLayer
    gilbCite?:  string
  }>
  notes?:        string
}

// ─── Top-level analysis output ────────────────────────────────────────────────

export interface ResourcesAnalysisOutput {
  /** Schema version — bumped when the prompt + parser shape change in lockstep. */
  schemaVersion?: string
  partA?: { [dimensionId: string]: AnalyticalFinding[] }
  partB?: { [toolId: string]:      GenerativeOutput }
  /** Optional top-level notes from Claudian. */
  notes?: string
}

// ─── Parse + validate ─────────────────────────────────────────────────────────

export interface ParseResult {
  ok:        boolean
  data?:     ResourcesAnalysisOutput
  errors:    string[]
  warnings:  string[]
}

const VALID_SEVERITIES = new Set<Severity>(['info', 'suggestion', 'warning', 'critical'])
const VALID_SOURCES    = new Set<SourceLayer>([
  'derived-from-plan', 'cited-from-gilb', 'llm-training', 'internet-fetched', 'generic-template',
])

/**
 * Parse + validate a Claudian-emitted JSON string.  Returns `ParseResult`
 * with `ok=true` and the structured `data`, OR `ok=false` with an array of
 * specific error messages naming the offending field path.
 *
 * Tolerant: extra fields are kept (forward-compat), missing optional fields
 * default sensibly, but invalid enum values + missing required fields are
 * flagged as errors.
 */
export function parseResourcesAnalysis(raw: string): ParseResult {
  const errors:   string[] = []
  const warnings: string[] = []

  if (!raw || raw.trim() === '') {
    errors.push('Input is empty — paste Claudian-generated JSON to apply an analysis.')
    return { ok: false, errors, warnings }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw.trim())
  } catch (err) {
    errors.push(`Not valid JSON: ${(err as Error).message}`)
    return { ok: false, errors, warnings }
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    errors.push('Top-level must be a JSON object with optional `partA` and `partB` keys.')
    return { ok: false, errors, warnings }
  }

  const obj = parsed as Record<string, unknown>
  const out: ResourcesAnalysisOutput = {}
  if (typeof obj.schemaVersion === 'string') out.schemaVersion = obj.schemaVersion
  if (typeof obj.notes === 'string')         out.notes = obj.notes

  // ── Part A — analytical dimensions ────────────────────────────────────────
  if (obj.partA !== undefined) {
    if (typeof obj.partA !== 'object' || obj.partA === null || Array.isArray(obj.partA)) {
      errors.push('`partA` must be an object keyed by dimensionId.')
    } else {
      out.partA = {}
      for (const [dimId, rawFindings] of Object.entries(obj.partA as Record<string, unknown>)) {
        if (!Array.isArray(rawFindings)) {
          errors.push(`partA.${dimId}: must be an array of findings.`)
          continue
        }
        const findings: AnalyticalFinding[] = []
        rawFindings.forEach((rawF, i) => {
          if (typeof rawF !== 'object' || rawF === null) {
            errors.push(`partA.${dimId}[${i}]: must be an object.`)
            return
          }
          const f = rawF as Record<string, unknown>
          const finding: AnalyticalFinding = {
            dimensionId: dimId,
            title:       typeof f.title       === 'string' ? f.title       : '',
            description: typeof f.description === 'string' ? f.description : '',
            severity:    'info',
            source:      'generic-template',
          }
          if (!finding.title)       errors.push(`partA.${dimId}[${i}].title: required, got empty.`)
          if (!finding.description) warnings.push(`partA.${dimId}[${i}].description: empty.`)
          if (VALID_SEVERITIES.has(f.severity as Severity)) {
            finding.severity = f.severity as Severity
          } else if (f.severity !== undefined) {
            warnings.push(`partA.${dimId}[${i}].severity: "${String(f.severity)}" invalid, defaulted to "info".`)
          }
          if (VALID_SOURCES.has(f.source as SourceLayer)) {
            finding.source = f.source as SourceLayer
          } else if (f.source !== undefined) {
            warnings.push(`partA.${dimId}[${i}].source: "${String(f.source)}" invalid, defaulted to "generic-template".`)
          }
          if (typeof f.gilbCite === 'string') finding.gilbCite = f.gilbCite
          if (f.source === 'cited-from-gilb' && !finding.gilbCite) {
            warnings.push(`partA.${dimId}[${i}]: source=cited-from-gilb but no gilbCite — provenance unverifiable.`)
          }
          if (f.proposedREntry && typeof f.proposedREntry === 'object') {
            finding.proposedREntry = f.proposedREntry as REntryProposal
          }
          if (f.tradeoff && typeof f.tradeoff === 'object') {
            finding.tradeoff = f.tradeoff as TradeoffProposal
          }
          findings.push(finding)
        })
        out.partA[dimId] = findings
      }
    }
  }

  // ── Part B — generative tools ─────────────────────────────────────────────
  if (obj.partB !== undefined) {
    if (typeof obj.partB !== 'object' || obj.partB === null || Array.isArray(obj.partB)) {
      errors.push('`partB` must be an object keyed by toolId.')
    } else {
      out.partB = {}
      for (const [toolId, rawTool] of Object.entries(obj.partB as Record<string, unknown>)) {
        if (typeof rawTool !== 'object' || rawTool === null || Array.isArray(rawTool)) {
          errors.push(`partB.${toolId}: must be an object.`)
          continue
        }
        const t = rawTool as Record<string, unknown>
        const tool: GenerativeOutput = { toolId }
        if (Array.isArray(t.proposedREntries))    tool.proposedREntries    = t.proposedREntries    as REntryProposal[]
        if (Array.isArray(t.proposedSEntries))    tool.proposedSEntries    = t.proposedSEntries    as SEntryProposal[]
        if (Array.isArray(t.proposedCEntries))    tool.proposedCEntries    = t.proposedCEntries    as CEntryProposal[]
        if (Array.isArray(t.proposedFieldEdits)) {
          tool.proposedFieldEdits = (t.proposedFieldEdits as Array<Record<string, unknown>>)
            .map((e) => ({
              entryId:       typeof e.entryId       === 'string' ? e.entryId       : '',
              field:         typeof e.field         === 'string' ? e.field         : '',
              currentValue:  typeof e.currentValue  === 'string' ? e.currentValue  : undefined,
              proposedValue: typeof e.proposedValue === 'string' ? e.proposedValue : '',
              rationale:     typeof e.rationale     === 'string' ? e.rationale     : undefined,
              source:        VALID_SOURCES.has(e.source as SourceLayer) ? (e.source as SourceLayer) : 'generic-template',
              gilbCite:      typeof e.gilbCite      === 'string' ? e.gilbCite      : undefined,
            }))
            .filter((e) => e.entryId && e.field && e.proposedValue)
        }
        if (typeof t.notes === 'string') tool.notes = t.notes
        out.partB[toolId] = tool
      }
    }
  }

  if (!out.partA && !out.partB) {
    warnings.push('No `partA` or `partB` content — analysis appears empty.')
  }

  return { ok: errors.length === 0, data: out, errors, warnings }
}

// ─── Promotion helpers — proposals → full entries ────────────────────────────
//
// `promote*` functions convert a Proposal (partial) into a full Entry
// (REntry / SEntry / CEntry) by filling defaults.  Used by the apply-handler
// after the user ticks a proposal for approval.

export function promoteREntry(p: REntryProposal, level = 'Product'): REntry {
  return {
    id:          p.id,
    type:        'Resource',
    level,
    description: p.id,                          // fallback if not provided elsewhere
    scale:       p.scale,
    meter:       p.meter        ?? '',
    status:      p.status       ?? '',
    tolerable:   p.tolerable,
    goal:        p.goal,
    wish:        p.wish         || undefined,
    forecast:    undefined,
    resourceForValue: p.resourceForValue || undefined,
    consumedBy:       p.consumedBy       || undefined,
  }
}

export function promoteSEntry(p: SEntryProposal, level = 'Product'): SEntry {
  return {
    id:          p.id,
    type:        'Solution',
    level,
    description: p.description,
    impact:      p.impact,
    function:    p.function     ?? '',
  }
}

export function promoteCEntry(p: CEntryProposal, level = 'Product'): CEntry {
  return {
    id:          p.id,
    type:        'Constraint',
    level,
    description: p.description,
    scope:       p.scope        ?? '',
    rationale:   p.rationale    ?? '',
  }
}

// ─── Apply approved findings to a SpecBlock (immutable update) ────────────────

export interface ApprovalSet {
  /** Approved REntry proposals (key = unique id from proposal). */
  rEntries: REntryProposal[]
  /** Approved SEntry proposals. */
  sEntries: SEntryProposal[]
  /** Approved CEntry proposals. */
  cEntries: CEntryProposal[]
  /** Approved field edits (modifications to existing entries). */
  fieldEdits: Array<{ entryId: string; field: string; proposedValue: string }>
}

/**
 * Apply approved proposals to a SpecBlock, returning a NEW SpecBlock
 * (immutable; original input untouched).  Idempotent: applying twice with
 * the same approval set produces the same output, with duplicate ids
 * de-duplicated by keeping the LAST occurrence (so a re-approval can update).
 *
 * Composes with the Architectural Resilience rule (immutability) and the
 * Phase 1 REntry schema (r77) — writes flow into `spec.resources` which is
 * the optional `REntry[]` field added in the schema upgrade.
 */
export function applyApprovedToSpec<T extends {
  functions: unknown[]; values: unknown[]; solutions: SEntry[];
  constraints?: CEntry[]; resources?: REntry[];
}>(
  spec: T,
  approvals: ApprovalSet,
): T {
  // Helper: upsert by id (last write wins).
  function upsertById<E extends { id: string }>(arr: E[], item: E): E[] {
    const without = arr.filter((x) => x.id !== item.id)
    return [...without, item]
  }

  let resources    = [...(spec.resources    ?? [])]
  let solutions    = [...(spec.solutions    ?? [])]
  let constraints  = [...(spec.constraints  ?? [])]

  for (const p of approvals.rEntries) resources   = upsertById(resources,   promoteREntry(p))
  for (const p of approvals.sEntries) solutions   = upsertById(solutions,   promoteSEntry(p))
  for (const p of approvals.cEntries) constraints = upsertById(constraints, promoteCEntry(p))

  // Field edits — patch in place by entryId + field.
  if (approvals.fieldEdits.length > 0) {
    const patch = <E extends { id: string }>(arr: E[]): E[] =>
      arr.map((e) => {
        const edits = approvals.fieldEdits.filter((fe) => fe.entryId === e.id)
        if (edits.length === 0) return e
        const next = { ...e } as Record<string, unknown>
        for (const fe of edits) next[fe.field] = fe.proposedValue
        return next as E
      })
    resources   = patch(resources)
    solutions   = patch(solutions)
    constraints = patch(constraints)
  }

  return { ...spec, resources, solutions, constraints }
}
