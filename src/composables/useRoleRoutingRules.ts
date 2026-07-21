// UNIT_TYPE=Composable
// useRoleRoutingRules.ts — Phase 4 of Roles redesign (Tom Gilb 2026-06-23
// standing greenlight "then of course on with phase 2 and on").
//
// Tom Gilb 14-point directive #14:
//   "The creation of Roles will be as automatic as possible, with defaults
//    used, and placeholders when none is nominated, or is within the Role
//    Time Span Dates, or is generic, but with specific named individuals
//    (Musks responsibility principle 1)."
//
// Tom 10-point Roles framework #5: "Default Responsibility for defined
// Roles (example Design Approval for Major Architecture, for CTO)."
// Tom 10-point Roles framework #8: "The notion of maximum automation of
// the role management".
//
// PHASE 4 SCOPE
// Deterministic routing-rule engine that auto-fills `specOwner` /
// `implementationResponsible` / `authority` on Spec entries based on
// pattern matches against the entry's tag/description text. Each rule
// names: a list of trigger tags, a list of entry types it applies to, an
// optional scope filter, the target field to set, the Role tag to assign,
// a priority for tie-breaking, and provenance.
//
// COMPOSING RULES (binding)
// • Universal Undo SUPREME — caller MUST wrap applyRoutingRules() in
//   undoHistory.record() BEFORE mutating currentSpec.
// • No-Silent-Data-Loss SUPREME — fieldSources stamped on every auto-filled
//   field; `respectExisting:true` is the default so existing values NEVER
//   silently overwritten.
// • No-Silent-Removal SUPREME — rules ADD information; they never delete.
// • Conjunction-of-Technologies SUPREME — every rule and every auto-fill
//   carries a `source: FieldSource` chain so the planner sees provenance.
// • Stakeholder Engineering (Gilb 2025) — Role IS Stakeholder; routing
//   binds Stakeholders to Solution / Function / Value / Constraint /
//   Resource accountability fields.
// • Solution Parameters SUPREME (v270) — specOwner +
//   implementationResponsible + authority are first-class Solution
//   parameters.
// • Twin portability — pure module over SpecBlock; ports verbatim.

import type { SpecBlock, FieldSource, SEntry, FEntry, VEntry, CEntry, REntry } from '../types/spec'

// ── Public types ───────────────────────────────────────────────────────────

/** Which fields a routing rule can target on a spec entry. */
export type RoutingTargetField = 'specOwner' | 'implementationResponsible' | 'authority'

/** Entry-type letter for the `whenEntryTypes` matcher. */
export type RoutingEntryType = 'F' | 'V' | 'S' | 'C' | 'R'

/** Optional scope filter — only plan-level entries or all entries. */
export type RoutingScope = 'plan-level' | 'all'

/**
 * One routing rule — a deterministic pattern-match → auto-fill action.
 * Rules are persisted in localStorage under STORAGE_KEY and loaded on every
 * app boot.  Defaults seeded from `loadDefaultRoutingRules()` when no
 * persisted rules are present.
 */
export interface RoutingRule {
  /** Mnemonic id, e.g. 'architecture-to-cto'. */
  id: string
  /** Human-readable label, e.g. "Architecture changes → CTO". */
  label: string
  /** Lowercase trigger tokens; if ANY token is contained in the entry's
   *  tag/description (case-insensitive), the rule fires.  Examples:
   *  ['architecture', 'design'] · ['compliance', 'gdpr', 'regulatory']. */
  whenTags: string[]
  /** Which entry types this rule applies to. */
  whenEntryTypes: RoutingEntryType[]
  /** Optional — only fire on plan-level entries (`'plan-level'`) or all
   *  (`'all'`).  When omitted defaults to `'all'`. */
  whenScope?: RoutingScope
  /** Which field to set on a matched entry. */
  setField: RoutingTargetField
  /** Stakeholder tag (mnemonic) to assign to the target field. */
  setToRoleTag: string
  /** Lower number = higher precedence when multiple rules match the same
   *  entry+field pair.  Defaults seeded with stable ordering (10, 20, 30…). */
  priority: number
  /** Provenance stamp for every field this rule auto-fills. */
  source: FieldSource
  /** ISO 8601 when this rule was created.  Seeded defaults use the rule's
   *  banked date; planner-added rules use Date.now(). */
  createdAt: string
  /** null/empty if seeded; otherwise planner name/id who added the rule. */
  createdBy?: string
}

/** One change recorded by a routing-rule apply pass. */
export interface RoutingApplyChange {
  entryId: string
  entryType: RoutingEntryType
  field: RoutingTargetField
  oldValue: string
  newValue: string
  ruleId: string
  ruleLabel: string
}

/** Aggregate result of an apply pass. */
export interface RoutingApplyResult {
  matchedEntries: RoutingApplyChange[]
  /** Entries scanned that DID match a rule but were skipped because the
   *  target field was already populated and respectExisting=true. */
  skippedExisting: number
  /** Total entries scanned. */
  totalScanned: number
}

/** Options passed to applyRoutingRules(). */
export interface ApplyRoutingOptions {
  /** When true (default), entries with a non-empty target field are SKIPPED. */
  respectExisting?: boolean
  /** When true, do NOT mutate the returned spec — just report what would
   *  change.  Useful for the Panel's "Preview" button. */
  dryRun?: boolean
}

// ── Constants ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'roleRoutingRules:v1'

const DEFAULT_RULE_SOURCE: FieldSource = {
  source: 'Role Routing Defaults',
  sourceType: 'system',
  timestamp: '2026-06-23T00:00:00.000Z',
  tool: 'useRoleRoutingRules',
}

// ── Default rules (8-12 seeded, ordered by common precedence) ──────────────

/**
 * Returns the seeded default routing rules.  Tom Gilb 14-point directive
 * #14 + Tom framework #5 + #8 — sensible defaults for common planning
 * patterns so most Roles get auto-filled without any planner intervention.
 *
 * Priority ordering (lower = higher precedence): Security (10) → Legal
 * (20) → Architecture (30) → Compliance (40) → Infrastructure (50) →
 * Customer (60) → Data (70) → Testing (80) → Finance (90) → Operations
 * (100).  This means a Solution tagged "GDPR security compliance" gets
 * Security:CISO before Compliance:Legal.
 */
export function loadDefaultRoutingRules(): RoutingRule[] {
  return [
    {
      id: 'security-to-ciso',
      label: 'Security / privacy → CISO (authority)',
      whenTags: ['security', 'privacy', 'encryption', 'auth', 'authentication', 'vulnerability'],
      whenEntryTypes: ['S', 'F', 'V', 'C'],
      whenScope: 'all',
      setField: 'authority',
      setToRoleTag: 'CISO',
      priority: 10,
      source: DEFAULT_RULE_SOURCE,
      createdAt: DEFAULT_RULE_SOURCE.timestamp,
    },
    {
      id: 'legal-to-legal',
      label: 'Legal / regulatory → Legal (authority)',
      whenTags: ['legal', 'contract', 'regulatory', 'license', 'licensing', 'liability'],
      whenEntryTypes: ['S', 'C'],
      whenScope: 'all',
      setField: 'authority',
      setToRoleTag: 'Legal',
      priority: 20,
      source: DEFAULT_RULE_SOURCE,
      createdAt: DEFAULT_RULE_SOURCE.timestamp,
    },
    {
      id: 'architecture-to-cto',
      label: 'Architecture / design → CTO (authority)',
      whenTags: ['architecture', 'design', 'platform', 'system design', 'technical design'],
      whenEntryTypes: ['S'],
      whenScope: 'all',
      setField: 'authority',
      setToRoleTag: 'CTO',
      priority: 30,
      source: DEFAULT_RULE_SOURCE,
      createdAt: DEFAULT_RULE_SOURCE.timestamp,
    },
    {
      id: 'compliance-to-compliance-lead',
      label: 'Compliance / GDPR / audit → Compliance Lead (authority)',
      whenTags: ['compliance', 'gdpr', 'audit', 'soc2', 'iso 27001', 'hipaa'],
      whenEntryTypes: ['C', 'S'],
      whenScope: 'all',
      setField: 'authority',
      setToRoleTag: 'Compliance Lead',
      priority: 40,
      source: DEFAULT_RULE_SOURCE,
      createdAt: DEFAULT_RULE_SOURCE.timestamp,
    },
    {
      id: 'infrastructure-to-sre-lead',
      label: 'Infrastructure / SRE / platform → SRE Lead (specOwner)',
      whenTags: ['infrastructure', 'sre', 'reliability', 'uptime', 'platform', 'devops', 'kubernetes'],
      whenEntryTypes: ['S', 'V', 'R'],
      whenScope: 'all',
      setField: 'specOwner',
      setToRoleTag: 'SRE Lead',
      priority: 50,
      source: DEFAULT_RULE_SOURCE,
      createdAt: DEFAULT_RULE_SOURCE.timestamp,
    },
    {
      id: 'customer-to-product-lead',
      label: 'Customer-facing / UX → Product Lead (specOwner)',
      whenTags: ['customer', 'user experience', 'ux', 'ui', 'onboarding', 'customer-facing'],
      whenEntryTypes: ['F', 'V', 'S'],
      whenScope: 'all',
      setField: 'specOwner',
      setToRoleTag: 'Product Lead',
      priority: 60,
      source: DEFAULT_RULE_SOURCE,
      createdAt: DEFAULT_RULE_SOURCE.timestamp,
    },
    {
      id: 'data-to-data-lead',
      label: 'Data / analytics / ML → Data Lead (specOwner)',
      whenTags: ['data', 'analytics', 'machine learning', 'ml', 'reporting', 'metrics pipeline'],
      whenEntryTypes: ['S', 'V', 'F'],
      whenScope: 'all',
      setField: 'specOwner',
      setToRoleTag: 'Data Lead',
      priority: 70,
      source: DEFAULT_RULE_SOURCE,
      createdAt: DEFAULT_RULE_SOURCE.timestamp,
    },
    {
      id: 'testing-to-qa-lead',
      label: 'Testing / QA / validation → QA Lead (implementationResponsible)',
      whenTags: ['test', 'testing', 'qa', 'quality assurance', 'validation', 'regression'],
      whenEntryTypes: ['S', 'F'],
      whenScope: 'all',
      setField: 'implementationResponsible',
      setToRoleTag: 'QA Lead',
      priority: 80,
      source: DEFAULT_RULE_SOURCE,
      createdAt: DEFAULT_RULE_SOURCE.timestamp,
    },
    {
      id: 'budget-to-cfo',
      label: 'Budget / cost / procurement → CFO (authority)',
      whenTags: ['budget', 'cost', 'procurement', 'finance', 'capex', 'opex'],
      whenEntryTypes: ['R', 'S'],
      whenScope: 'all',
      setField: 'authority',
      setToRoleTag: 'CFO',
      priority: 90,
      source: DEFAULT_RULE_SOURCE,
      createdAt: DEFAULT_RULE_SOURCE.timestamp,
    },
    {
      id: 'operations-to-ops-lead',
      label: 'Operations / support → Operations Lead (implementationResponsible)',
      whenTags: ['operations', 'support', 'helpdesk', 'incident', 'runbook'],
      whenEntryTypes: ['F', 'S'],
      whenScope: 'all',
      setField: 'implementationResponsible',
      setToRoleTag: 'Operations Lead',
      priority: 100,
      source: DEFAULT_RULE_SOURCE,
      createdAt: DEFAULT_RULE_SOURCE.timestamp,
    },
  ]
}

// ── Persistence ────────────────────────────────────────────────────────────

/**
 * Load routing rules from localStorage.  Returns the persisted set if
 * present, otherwise seeds with `loadDefaultRoutingRules()` and persists
 * those defaults so a planner can edit them on first run.
 */
export function loadRoutingRulesFromStorage(): RoutingRule[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const defaults = loadDefaultRoutingRules()
      saveRoutingRulesToStorage(defaults)
      return defaults
    }
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return loadDefaultRoutingRules()
    return parsed.filter(_isValidRule) as RoutingRule[]
  } catch {
    return loadDefaultRoutingRules()
  }
}

export function saveRoutingRulesToStorage(rules: RoutingRule[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rules))
  } catch {
    /* silent degrade — quota / private mode */
  }
}

function _isValidRule(r: unknown): r is RoutingRule {
  if (!r || typeof r !== 'object') return false
  const obj = r as Record<string, unknown>
  return typeof obj.id === 'string'
    && typeof obj.label === 'string'
    && Array.isArray(obj.whenTags)
    && Array.isArray(obj.whenEntryTypes)
    && (obj.setField === 'specOwner' || obj.setField === 'implementationResponsible' || obj.setField === 'authority')
    && typeof obj.setToRoleTag === 'string'
    && typeof obj.priority === 'number'
}

// ── Matching helpers ───────────────────────────────────────────────────────

function _matchesTags(text: string, tags: string[]): boolean {
  if (!text) return false
  const lower = text.toLowerCase()
  for (const tag of tags) {
    const t = tag.toLowerCase().trim()
    if (t.length === 0) continue
    if (lower.includes(t)) return true
  }
  return false
}

function _entryHaystack(entry: FEntry | VEntry | SEntry | CEntry | REntry): string {
  const parts: string[] = []
  if ('id' in entry && entry.id) parts.push(String(entry.id))
  if ('description' in entry && entry.description) parts.push(String(entry.description))
  // S/F entries: scan key fields too
  const anyEntry = entry as Record<string, unknown>
  if (typeof anyEntry.presenceTest === 'string') parts.push(anyEntry.presenceTest)
  if (typeof anyEntry.scale === 'string')        parts.push(anyEntry.scale)
  if (typeof anyEntry.rationale === 'string')    parts.push(anyEntry.rationale)
  if (typeof anyEntry.scope === 'string')        parts.push(anyEntry.scope)
  return parts.join(' · ')
}

function _entryLevelIsPlanLevel(entry: FEntry | VEntry | SEntry | CEntry | REntry): boolean {
  const level = String((entry as { level?: string }).level ?? '').toLowerCase()
  return level === 'business' || level === 'plan' || level === ''
}

function _getField(entry: Record<string, unknown>, field: RoutingTargetField): string {
  const v = entry[field]
  return typeof v === 'string' ? v : ''
}

function _setField(
  entry: Record<string, unknown>,
  field: RoutingTargetField,
  value: string,
  source: FieldSource,
): void {
  entry[field] = value
  const fs = (entry.fieldSources && typeof entry.fieldSources === 'object')
    ? entry.fieldSources as Record<string, FieldSource>
    : {}
  fs[field] = source
  entry.fieldSources = fs
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Walk every spec entry matched by the active routing rules and auto-fill
 * the configured target field where it is currently empty.  Returns a new
 * spec (the input is NEVER mutated) plus a result manifest naming every
 * change that landed.
 *
 * UNIVERSAL UNDO SUPREME: callers MUST call `undoHistory.record()` BEFORE
 * assigning the returned `newSpec` back into `currentSpec`.
 */
export function applyRoutingRules(
  spec: SpecBlock,
  rules: RoutingRule[],
  options: ApplyRoutingOptions = {},
): { newSpec: SpecBlock; result: RoutingApplyResult } {
  const respectExisting = options.respectExisting !== false
  const dryRun = options.dryRun === true

  // Clone deeply so the input is never mutated even on apply (caller will
  // wrap in undo.record() against the original; we hand back the clone).
  const next: SpecBlock = JSON.parse(JSON.stringify(spec)) as SpecBlock

  // Sort rules by priority asc so higher-precedence rules win when the
  // same entry+field would otherwise be set twice in one pass.
  const sorted = rules.slice().sort((a, b) => a.priority - b.priority)

  const changes: RoutingApplyChange[] = []
  let skippedExisting = 0
  let totalScanned = 0

  // Helper that processes one entry-type bucket.
  function _processBucket(
    entries: Array<FEntry | VEntry | SEntry | CEntry | REntry>,
    entryType: RoutingEntryType,
  ): void {
    for (const entry of entries) {
      totalScanned++
      const haystack = _entryHaystack(entry)
      const isPlanLevel = _entryLevelIsPlanLevel(entry)
      // For each field, the FIRST rule that matches wins (priority order).
      const filledFieldsThisPass = new Set<RoutingTargetField>()
      for (const rule of sorted) {
        if (!rule.whenEntryTypes.includes(entryType)) continue
        if (rule.whenScope === 'plan-level' && !isPlanLevel) continue
        if (filledFieldsThisPass.has(rule.setField)) continue
        if (!_matchesTags(haystack, rule.whenTags)) continue

        const entryRec = entry as unknown as Record<string, unknown>
        const oldVal = _getField(entryRec, rule.setField)
        if (oldVal && respectExisting) {
          skippedExisting++
          continue
        }
        if (oldVal === rule.setToRoleTag) continue // already exactly this value

        if (!dryRun) _setField(entryRec, rule.setField, rule.setToRoleTag, rule.source)

        changes.push({
          entryId:   String((entry as { id?: string }).id ?? '(unknown)'),
          entryType,
          field:     rule.setField,
          oldValue:  oldVal,
          newValue:  rule.setToRoleTag,
          ruleId:    rule.id,
          ruleLabel: rule.label,
        })
        filledFieldsThisPass.add(rule.setField)
      }
    }
  }

  _processBucket(next.functions ?? [],  'F')
  _processBucket(next.values    ?? [],  'V')
  _processBucket(next.solutions ?? [],  'S')
  _processBucket(next.constraints ?? [], 'C')
  _processBucket(next.resources   ?? [], 'R')

  return {
    newSpec: next,
    result: { matchedEntries: changes, skippedExisting, totalScanned },
  }
}

/**
 * Convenience pure-function wrapper for the Panel's "Preview" button.
 * Same as applyRoutingRules with `dryRun: true`.
 */
export function previewRoutingRules(
  spec: SpecBlock,
  rules: RoutingRule[],
): RoutingApplyResult {
  return applyRoutingRules(spec, rules, { dryRun: true, respectExisting: true }).result
}
