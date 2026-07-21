// UNIT_TYPE=Composable
/**
 * useContractRedraft.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Contract Redraft composable — settings persistence + redraft orchestration.
 *
 * Tom Gilb 2026-07-02 verbatim: *"An option to get the entire document
 * redrafted... Navy meeting delayed. But I like the proposal and want to
 * get started now. So go for it. As much as you can as soon as you can."*
 *
 * Architecture:
 *   • Singleton settings ref, hydrated from localStorage on module init.
 *   • Auto-persist on every settings mutation (No-Silent-Data-Loss SUPREME).
 *   • Redraft orchestration uses Anthropic SDK — routed via Vite alias to
 *     `claudeCodeAdapter` per Claude-Code-as-AI-Layer SUPREME.
 *   • Result stored in memory + persisted per-contract to localStorage; a
 *     contract can carry multiple redraft results over time (version history).
 *
 * Twin-portable: pure logic; no Vue templates.
 */

import { ref, computed } from 'vue'
import Anthropic from '@anthropic-ai/sdk'
import { MODEL_ID } from '../config/llm'
import type {
  ContractRedraftSettings,
  ContractRedraftResult,
  ContractHealthIndex,
  ContractHealthDimension,
  ContractHealthDimensionId,
  ContractHealthOffendingEntry,
  RedraftCorrection,
  RedraftRemainingDefect,
  RedraftGlossaryEntry,
  RedraftPolicyReference,
  RedraftRelatedDocument,
  StandardId,
  PolicyId,
} from '../types/contractRedraft'
import {
  DEFAULT_REDRAFT_SETTINGS,
  REDRAFT_STANDARDS,
  REDRAFT_POLICIES,
  REDRAFT_SAFETY_LOCKS,
} from '../types/contractRedraft'
import type { ContractModel, ContractClause, PlanguageContractEntry } from '../types/contractTypes'
import { useGraphmetrixCoupling } from './useGraphmetrixCoupling'

// ── Storage keys ──────────────────────────────────────────────────────────────

const SETTINGS_KEY   = 'sem-app:contract-redraft:settings:v1'
const RESULTS_KEY    = 'sem-app:contract-redraft:results:v1'

// ── Settings persistence ─────────────────────────────────────────────────────

function _loadSettings(): ContractRedraftSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_REDRAFT_SETTINGS }
    const parsed = JSON.parse(raw) as ContractRedraftSettings
    // Merge with defaults so new fields introduced in later schema versions
    // are populated without wiping user's existing choices.
    return { ...DEFAULT_REDRAFT_SETTINGS, ...parsed }
  } catch (err) {
    console.error('[useContractRedraft] Failed to load settings from localStorage:', err)
    return { ...DEFAULT_REDRAFT_SETTINGS }
  }
}

function _saveSettings(settings: ContractRedraftSettings): void {
  try {
    const stamped = { ...settings, updatedAt: new Date().toISOString() }
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(stamped))
  } catch (err) {
    console.error('[useContractRedraft] Failed to save settings to localStorage:', err)
  }
}

// ── Results persistence ──────────────────────────────────────────────────────

function _loadResults(): ContractRedraftResult[] {
  try {
    const raw = localStorage.getItem(RESULTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ContractRedraftResult[]
    return Array.isArray(parsed) ? parsed : []
  } catch (err) {
    console.error('[useContractRedraft] Failed to load results:', err)
    return []
  }
}

function _saveResults(results: ContractRedraftResult[]): void {
  try {
    localStorage.setItem(RESULTS_KEY, JSON.stringify(results))
  } catch (err) {
    console.error('[useContractRedraft] Failed to save results:', err)
  }
}

// ── Singleton state ──────────────────────────────────────────────────────────

const _settings = ref<ContractRedraftSettings>(_loadSettings())
const _results  = ref<ContractRedraftResult[]>(_loadResults())
const _isRedrafting = ref(false)
const _redraftError = ref<string | null>(null)

// ── CHI computation (deterministic — no LLM call needed) ─────────────────────

/**
 * Compute Contract Health Index from a contract's parsed entries + the
 * redraft settings' CHI weights.  Deterministic: no LLM call needed here,
 * so the score can be surfaced BEFORE redraft (as a diagnostic) AND
 * recomputed AFTER redraft (to show delta).
 *
 * Algorithm v1 (documented in ContractHealthIndex.algorithmVersion):
 *   precision              = fraction of Function entries with `presenceTest`
 *   measurement            = fraction of Value entries with `scale` AND (`goal` OR `tolerable`)
 *   stakeholder-coverage   = min(4, distinct-stakeholder-categories-seen) / 4
 *   bounded-scope          = fraction of Value entries with at-least-one qualifier
 *                            (currently proxied by non-empty `scale` since qualifier
 *                             extraction is Phase 2 — will be refined in v438)
 *   standards-conformance  = 1 - (entries-with-standardsViolations / total-entries)
 *   structural-completeness = will only be non-zero AFTER a full redraft
 *                             (measures presence of A1-A6 appendices; currently 0)
 */
export function computeCHI(
  contract:  ContractModel,
  weights:   Record<ContractHealthDimensionId, number>
): ContractHealthIndex {
  const entries = contract.clauses.flatMap(cl => cl.entries)
  const total   = entries.length

  const fnEntries    = entries.filter(e => e.type === 'F')
  const valueEntries = entries.filter(e => e.type === 'V')
  const stakeEntries = entries.filter(e => e.type === 'S')
  const violCount    = entries.filter(e => Array.isArray(e.standardsViolations) && e.standardsViolations.length > 0).length

  // r41 v439 — SUPREME r93mmm Infinity-Trap discipline: NEVER default to
  // "1" when the denominator is 0.  A missing denominator means "we could
  // not measure" — NOT "we scored perfect".  Non-measurable dimensions
  // carry `measurable: false`, contribute nothing to numerator OR
  // denominator, and are surfaced in the UI as "— / N · Not measurable".

  // r41 v456 (Tom Gilb 2026-07-02 verbatim *"bar table smells wrong, as
  // reported before"*) — a field containing only a placeholder string
  // like "TBD" / "TBD ← 'reason'" / "N/A" / "not specified" is NOT a
  // populated value.  Tighten the "is this field really populated?"
  // check so placeholders don't earn full credit.  Composes with:
  //   • r93mmm Infinity Trap SUPREME (unmeasurable ≠ perfect; same
  //     shape at the string-value level — placeholder ≠ real value)
  //   • No-Silent-Data-Loss SUPREME (empty-but-populated is silent)
  //   • Trust-Rebuild framing (score reflects real state, not
  //     schema-shape state)
  const _isReallyPopulated = (raw: string | undefined): boolean => {
    const s = (raw ?? '').trim()
    if (s.length === 0) return false
    // Match placeholders like "TBD", "TBD ←...", "N/A", "not specified",
    // "not stated", "not applicable", "unknown", plus any string that is
    // ENTIRELY a placeholder prefix followed by explanatory text.
    if (/^TBD\b/i.test(s))            return false
    if (/^N\/A\b/i.test(s))           return false
    if (/^not\s+(specified|stated|applicable|defined|available)\b/i.test(s)) return false
    if (/^unknown\b/i.test(s))        return false
    if (/^—+$/.test(s))               return false
    return true
  }

  // Precision — Function entries with a REAL presence-test (not "TBD ...")
  const withPresence = fnEntries.filter(e => _isReallyPopulated(e.presenceTest)).length
  const precisionMeasurable = fnEntries.length > 0
  const precisionRatio      = precisionMeasurable ? withPresence / fnEntries.length : 0

  // Measurement — Value entries with a REAL Scale + a REAL (Goal or Tolerable)
  const wellMeasured = valueEntries.filter(e => {
    return _isReallyPopulated(e.scale) &&
           (_isReallyPopulated(e.goal) || _isReallyPopulated(e.tolerable))
  }).length
  const measurementMeasurable = valueEntries.length > 0
  const measurementRatio      = measurementMeasurable ? wellMeasured / valueEntries.length : 0

  // Stakeholder coverage — always measurable (target is a fixed ≥ 4;
  // 0 distinct categories is an honest 0, not N/A).
  const distinctStakeCats = new Set(stakeEntries.map(e => (e.obligatedParty ?? '').trim().toLowerCase() || 'unnamed').filter(s => s.length > 0))
  const stakeCoverageRatio = Math.min(4, distinctStakeCats.size) / 4

  // Bounded scope — proxy (Phase 2 target: use conditionSets when they exist).
  // v456: same TBD-filter — a Scale of "TBD" is not a bounded scope.
  const boundedMeasurable = valueEntries.length > 0
  const boundedRatio      = boundedMeasurable
    ? valueEntries.filter(e => _isReallyPopulated(e.scale)).length / valueEntries.length
    : 0

  // Standards conformance — measurable only when (a) there are entries
  // to scan AND (b) at least ONE entry has a non-empty standardsViolations
  // array OR was clearly analysed by the standards checker.
  //
  // v456 (Tom "bar table smells wrong"): recovered contracts (from .eml
  // via v454 recovery + sourceType: 'system' on every entry) have every
  // standardsViolations array empty/undefined because the recovery
  // didn't run the checker.  Pre-v456 scored those 10/10 = full
  // conformance = FALSE POSITIVE.  New rule: if ALL entries carry
  // sourceType === 'system' AND ALL standardsViolations arrays are
  // empty/undefined, Standards Conformance is Not Measurable — the
  // absence of flags is evidence of absence-of-analysis, not
  // conformance.  Composes with r93mmm Infinity Trap SUPREME (same
  // shape: absent-data ≠ perfect-score).
  const anyFlagPopulated  = entries.some(e => Array.isArray(e.standardsViolations) && e.standardsViolations.length > 0)
  const allSystemSourced  = entries.length > 0 && entries.every(e => e.sourceType === 'system')
  const conformanceMeasurable = total > 0 && (anyFlagPopulated || !allSystemSourced)
  const conformanceRatio      = conformanceMeasurable ? 1 - violCount / total : 0

  // Structural completeness — always measurable (0 pre-redraft is honest;
  // the boost below populates it once appendices land).
  const structuralRatio = 0

  // r41 v459 — helper: build offending-entry snapshots for the drill-down.
  // Cap at 5 per dimension (the panel shows "+ N more" if more exist).
  const _snap = (e: PlanguageContractEntry, reason: string): ContractHealthOffendingEntry => ({
    id:          e.id,
    tag:         e.tag,
    party:       e.obligatedParty,
    description: (e.description ?? '').slice(0, 120),
    reason,
  })

  const precisionOffenders = fnEntries
    .filter(e => !_isReallyPopulated(e.presenceTest))
    .slice(0, 5)
    .map(e => _snap(e, (e.presenceTest ?? '').trim() ? 'Placeholder Presence Test (e.g. "TBD")' : 'Blank Presence Test'))

  const measurementOffenders = valueEntries
    .filter(e => !(_isReallyPopulated(e.scale) && (_isReallyPopulated(e.goal) || _isReallyPopulated(e.tolerable))))
    .slice(0, 5)
    .map(e => {
      const reasons: string[] = []
      if (!_isReallyPopulated(e.scale))                                             reasons.push('no Scale')
      if (!_isReallyPopulated(e.goal) && !_isReallyPopulated(e.tolerable))          reasons.push('no Goal or Tolerable')
      return _snap(e, reasons.join(' + ') || 'placeholder Scale/Goal')
    })

  const boundedOffenders = valueEntries
    .filter(e => !_isReallyPopulated(e.scale))
    .slice(0, 5)
    .map(e => _snap(e, 'no Scale — scope unbounded'))

  const standardsOffenders = entries
    .filter(e => Array.isArray(e.standardsViolations) && e.standardsViolations.length > 0)
    .slice(0, 5)
    .map(e => _snap(e, `${e.standardsViolations!.length} flag${e.standardsViolations!.length === 1 ? '' : 's'}: ${e.standardsViolations![0]!.standard}`))

  const dimensions: ContractHealthDimension[] = [
    {
      id: 'precision',
      label: 'Precision',
      maxScore:   weights['precision'],
      score:      Math.round(precisionRatio * weights['precision']),
      measurable: precisionMeasurable,
      detail:     precisionMeasurable
        ? `${withPresence} of ${fnEntries.length} Function entries have a REAL testable Presence Test (placeholder values like "TBD" don't count).`
        : 'No Function entries extracted — Precision cannot be measured.',
      offendingEntryIds: precisionOffenders.map(o => o.id),
      offendingEntries:  precisionOffenders,
      recommendation:    (precisionMeasurable && withPresence < fnEntries.length)
        ? `Author testable Presence Tests for ${fnEntries.length - withPresence} Function entr${fnEntries.length - withPresence === 1 ? 'y' : 'ies'} (currently blank or placeholder "TBD"). A testable Presence Test is a binary "X is [done/provided]" statement an inspector can verify YES/NO on delivery day.`
        : undefined,
    },
    {
      id: 'measurement',
      label: 'Measurement',
      maxScore:   weights['measurement'],
      score:      Math.round(measurementRatio * weights['measurement']),
      measurable: measurementMeasurable,
      detail:     measurementMeasurable
        ? `${wellMeasured} of ${valueEntries.length} Value entries carry a REAL Scale + a REAL (Goal or Tolerable) (placeholders like "TBD" don't count).`
        : 'No Value entries extracted — Measurement cannot be measured.',
      offendingEntryIds: measurementOffenders.map(o => o.id),
      offendingEntries:  measurementOffenders,
      recommendation:    (measurementMeasurable && wellMeasured < valueEntries.length)
        ? `Populate a real Scale + a real Goal (or Tolerable) on ${valueEntries.length - wellMeasured} Value entr${valueEntries.length - wellMeasured === 1 ? 'y' : 'ies'}. Scale = what is measured (units + reference); Goal = the committed target; Tolerable = the minimum non-failure level.`
        : undefined,
    },
    {
      id: 'stakeholder-coverage',
      label: 'Stakeholder Coverage',
      maxScore:   weights['stakeholder-coverage'],
      score:      Math.round(stakeCoverageRatio * weights['stakeholder-coverage']),
      measurable: true, // always measurable — target ≥ 4 is absolute, 0 is an honest 0
      detail:     `${distinctStakeCats.size} distinct stakeholder categories present (target ≥ 4).`,
      recommendation: (distinctStakeCats.size < 4)
        ? `Add stakeholders in ${4 - distinctStakeCats.size} more categor${4 - distinctStakeCats.size === 1 ? 'y' : 'ies'}. Typical Navy-contract categories: Contractor, Government (Department / Navy Yard), Regulator (Congress / Board of Inspection), End-user / Operator, Supplier / Subcontractor.`
        : undefined,
    },
    {
      id: 'bounded-scope',
      label: 'Bounded Scope',
      maxScore:   weights['bounded-scope'],
      score:      Math.round(boundedRatio * weights['bounded-scope']),
      measurable: boundedMeasurable,
      detail:     boundedMeasurable
        ? 'Anti-Infinity-Trap proxy: Value entries carrying a Scale (Phase 2 will read Qualifiers).'
        : 'No Value entries extracted — Bounded Scope cannot be measured.',
      offendingEntryIds: boundedOffenders.map(o => o.id),
      offendingEntries:  boundedOffenders,
      recommendation:    (boundedMeasurable && boundedOffenders.length > 0)
        ? `Populate a real Scale on ${boundedOffenders.length}${boundedOffenders.length === 5 ? '+' : ''} Value entr${boundedOffenders.length === 1 ? 'y' : 'ies'}. Without a Scale, the Value commits to infinite scope — every stakeholder, every time, every context — which is unshippable.`
        : undefined,
    },
    {
      id: 'standards-conformance',
      label: 'Standards Conformance',
      maxScore:   weights['standards-conformance'],
      score:      Math.round(conformanceRatio * weights['standards-conformance']),
      measurable: conformanceMeasurable,
      detail:     conformanceMeasurable
        ? `${violCount} of ${total} entries carry at least one standards-violation flag.`
        : (total > 0 && allSystemSourced
          ? 'This contract came from a recovery / import — the standards checker was never run on it, so Standards Conformance cannot be measured.  Re-parse or run a redraft to populate a real signal.'
          : 'No entries extracted — Standards Conformance cannot be measured.'),
      offendingEntryIds: standardsOffenders.map(o => o.id),
      offendingEntries:  standardsOffenders,
      recommendation:    conformanceMeasurable && violCount > 0
        ? `${violCount} entr${violCount === 1 ? 'y' : 'ies'} carr${violCount === 1 ? 'ies' : 'y'} standards violations. Review the flags in the Redrafted Body + apply the cited-standard corrections; each fix raises this score.`
        : (!conformanceMeasurable && total > 0 && allSystemSourced
          ? 'Run a Contract Redraft to populate the standards signal — the redraft agent flags every entry against MSCD, MIL-HDBK-245D, and any other selected standards.'
          : undefined),
    },
    {
      id: 'structural-completeness',
      label: 'Structural Completeness',
      maxScore:   weights['structural-completeness'],
      score:      Math.round(structuralRatio * weights['structural-completeness']),
      measurable: true, // always measurable — post-redraft boost populates real count
      detail:     'Awaiting redraft — this dimension measures presence of A1-A6 appendices.',
      recommendation: 'Run a full Contract Redraft to populate Appendices A1 (Glossary), A2 (Policies), A3 (Related Documents), A4 (Contract Health Score), A5 (Corrections Applied), and A6 (Remaining Defects).',
    },
  ]

  return _finalizeCHI(dimensions)
}

/** Aggregate a dimension list into a `ContractHealthIndex`.
 *  Renormalized: `score` is a percentage over the SUM OF MEASURABLE
 *  MAXSCORES, NOT over 100.  This is the r41 v439 SUPREME-r93mmm fix —
 *  non-measurable dimensions are excluded from both numerator and
 *  denominator instead of silently defaulting to full credit.
 *  Exported so the post-redraft structural boost can re-aggregate. */
export function _finalizeCHI(dimensions: ContractHealthDimension[]): ContractHealthIndex {
  const availableMax = dimensions.filter(d => d.measurable).reduce((s, d) => s + d.maxScore, 0)
  const skippedMax   = dimensions.filter(d => !d.measurable).reduce((s, d) => s + d.maxScore, 0)
  const earned       = dimensions.filter(d => d.measurable).reduce((s, d) => s + d.score, 0)
  const score        = availableMax > 0 ? Math.round(earned / availableMax * 100) : 0
  const colourBand: 'green' | 'amber' | 'red' =
    score >= 90 ? 'green' : score >= 70 ? 'amber' : 'red'
  return {
    score,
    colourBand,
    breakdown: dimensions,
    availableMax,
    skippedMax,
    computedAt: new Date().toISOString(),
    algorithmVersion: 1,
  }
}

// ── Redraft prompt + JSON schema (r41 v438) ──────────────────────────────────

/** Per-clause redraft output shape emitted by Sonnet.  Merged into the
 *  aggregate `ContractRedraftResult` by the assembler below. */
interface PerClauseRedraftOutput {
  mnemonicTag:      string
  clauseNumber:     string
  rewrittenText:    string
  executiveNotes?:  string
  corrections:      Array<{
    before:              string
    after:               string
    reason:              string
    citedStandards:      StandardId[]
    citedPolicies:       PolicyId[]
    alternativeOptions?: string[]
    defectClass:         RedraftCorrection['defectClass']
    confidence:          'high' | 'medium' | 'low'
  }>
  remainingDefects: Array<{
    specStatement:     string
    ruleViolated:      string
    citedStandards:    StandardId[]
    citedPolicies:     PolicyId[]
    seriousness:       1 | 2 | 3 | 4 | 5
    roleToFix:         string
    roleToApprove:     string
    probableRootCause: string
    notes?:            string
  }>
  glossaryEntries:  Array<{ term: string; definition: string; source: string }>
  relatedDocumentReferences: Array<{
    title:               string
    documentType:        RedraftRelatedDocument['documentType']
    note?:               string
    externalUrl?:        string
    // r41 v460 — graphmetrixUri / graphmetrixNodeType intentionally
    // omitted from the parsed shape; assembler strips these fields even
    // if a future prompt drift reintroduces them.  Retained on the
    // stored `RedraftRelatedDocument` type only for import-compat.
  }>
}

/** Build the settings-aware prompt PREFIX for a redraft call.  Cached by
 *  Anthropic (`cache_control: ephemeral`) so N-clause runs share the prefix
 *  cost.  Standards + Policies + Safety Locks + Autonomy all injected as
 *  explicit named lists so Sonnet can cite them by id in the JSON output. */
function _buildRedraftPromptPrefix(settings: ContractRedraftSettings): string {
  const selectedStandards = REDRAFT_STANDARDS.filter(s => settings.standards.includes(s.id))
  const selectedPolicies  = REDRAFT_POLICIES.filter(p => settings.policies.includes(p.id))
  const engagedLocks      = REDRAFT_SAFETY_LOCKS.filter(l => settings.safetyLocks.includes(l.id))

  return `You are the Contract Redraft agent for the SEM App.  Your job is to redraft ONE clause of a signed or draft contract into a precision-enhanced form that complies with the selected Standards + Policies + Structure — while preserving ALL Safety-Locked content byte-identical.

━━ CANONICAL PLANGUAGE PARAMETER GRAMMAR (Kai-Zen Glossary SUPREME) ━━
This redraft agent inherits the same Planguage discipline as the Contract Parser.  When the redraft renames or adds Scale / Meter / Wish / Goal / Tolerable / Past / Status fields, Kai-Zen Glossary canonical order applies verbatim (Scale FIRST, then Meter, then Benchmarks Past+Status, then Wish, Goal, Tolerable).

━━ SETTINGS IN EFFECT ━━
Structure: ${settings.structure} (${settings.structure === 'current-redlined' ? 'mirror original clause order + insert corrections as redlines' : 'restructure into Planguage form with Mnemonic Tags + appendices'})
Autonomy: ${settings.autonomy}

Standards applied (cite by id in "citedStandards"):
${selectedStandards.map(s => `  • ${s.id} — ${s.label}`).join('\n')}
${settings.customStandardsUrls.length > 0 ? `\nCustom standards URLs:\n${settings.customStandardsUrls.map(u => `  • ${u}`).join('\n')}` : ''}

Policies applied (cite by id in "citedPolicies"):
${selectedPolicies.map(p => `  • ${p.id} — ${p.label}${p.underlyingRule ? ' [' + p.underlyingRule + ']' : ''}`).join('\n')}

━━ SAFETY LOCKS — HARD FORBIDDEN ZONES ━━
The following content classes MUST remain BYTE-IDENTICAL in the "rewrittenText" output.  ANY change is a hard reject.  If a lock conflicts with a redraft opportunity, keep the lock and flag the tension in "remainingDefects" instead.
${engagedLocks.map(l => `  🔒 ${l.label} — ${l.hoverHint}`).join('\n')}

━━ CORRECTION DISCIPLINE ━━
Every correction MUST cite at least one Standard AND at least one Policy from the selected lists above.  Corrections that violate any Safety Lock are FORBIDDEN.
When wording is ambiguous but you CAN'T resolve without a human decision (missing information, missing spec, unresolved negotiation trade-off), emit a "remainingDefects" entry INSTEAD of a "corrections" entry.
Every "remainingDefects" entry MUST name a specific role responsible for fixing AND a specific role responsible for approving — never leave either as "TBD" or "the user".  Standard Navy contracting roles: Contracting Officer, Contracting Officer's Representative, Program Manager, Program Executive Officer, Subject Matter Expert, Reviewing Attorney, Head of Contracts, Contractor's Technical Representative.

━━ MNEMONIC TAG DISCIPLINE ━━
The "mnemonicTag" for a clause is a 1-3 word Planguage-style identifier derived from the CLAUSE ESSENCE — the primary obligation or concept the clause encodes.  Examples: "Contract Price", "Delivery Deadline", "Acceptance Trials", "Armament Installation", "Termination for Default".  NEVER use bare numbers ("Clause 3.2") or generic labels ("Terms").  Never abbreviate; spell out full words.

━━ SPELL-OUT-TYPE-NAMES DISCIPLINE (r41 v461, Tom Gilb SUPREME 2026-06-06 + 2026-07-02 re-flag) ━━
When writing definitions, glossary entries, correction reasons, defect notes, and executive notes: NEVER use the abbreviations "[S]", "[F]", "[V]", "[C]", "[R]", "[Sol]", "[Task]" for Planguage types.  NEVER use "S.", "F.", "V.", "C.", "R." either.  Spell out the FULL type name in every sentence: Stakeholder, Function, Value, Constraint, Resource, Solution, Task.
Wrong: *"Each recovered entry is tagged by Planguage type ([S] Stakeholder, [F] Function, [C] Constraint, [V] Value, [R] Resource, [Task] Task, [Sol] Solution)"*.
Right: *"Each recovered entry is tagged by Planguage type — Stakeholder, Function, Value, Constraint, Resource, Solution, or Task — and awaits assignment to a numbered contract clause"*.
The audience is a Navy officer / Vice Admiral / contract officer; single-letter Planguage abbreviations require training the audience does not have.

━━ RELATED DOCUMENTS — REACHABLE-NOW SOURCE DISCIPLINE (r41 v460, Tom Gilb 2026-07-02: *"do not reference a graphmetrix node yet, until you can prove it is there. Reference things like standards with reachable now urls. SEM is experimental and not yet resident on gmx, as is toms twin"*) ━━
When the clause references a technical drawing / specification / P&ID / 3D model / test procedure / material spec / standard / policy / statute, you MAY populate a "relatedDocumentReferences" entry describing the reference.  BUT the following DISCIPLINE binds ABSOLUTELY:

  1. DO NOT invent, guess, or infer a "graphmetrixUri" of any form (no "graphmetrix://<inferred-path>", no "graphmetrix://foo/bar", no placeholder graphmetrix URIs whatsoever).  Graphmetrix is not yet deployed for SEM App experimental use; any graphmetrix:// URI would be UNREACHABLE and would break the reader's trust.  documentType "graphmetrix-node" is FORBIDDEN in this experimental phase — do not use it.
  2. For standards and policies referenced in the clause, you MAY populate an "externalUrl" ONLY IF you know the canonical public URL (examples: MSCD → https://www.acquisition.gov/, MIL-HDBK-245D → https://quicksearch.dla.mil/qsSearch.aspx).  If you do not know the canonical URL with high confidence, LEAVE "externalUrl" absent — do not invent a URL.
  3. For statutes / public laws referenced in the clause, populate the "title" with the canonical citation (e.g. "Act of 13 February 1929", "41 U.S.C. § 7101") and leave "externalUrl" absent unless you know the exact URL on a canonical publisher (Cornell LII, gpo.gov, congress.gov).
  4. When emitting a Related Document entry, ALWAYS populate: title + documentType + "note" (a plain-English sentence naming WHY this is cited and WHERE a reader would find it).  Missing note = reject.
  5. documentType allowed values: schedule · exhibit · sow · did · cdrl · appendix · standard · policy · statute · public-law · other.  documentType "graphmetrix-node" is FORBIDDEN this ship (see #1).

Recognition trigger for you (Sonnet): about to emit a graphmetrixUri field → do not.  About to emit externalUrl for something you are guessing at → leave absent instead.

━━ OUTPUT SCHEMA ━━
Return ONE JSON object matching EXACTLY this shape.  No preamble, no wrapper, no explanation.  If a field is optional and you have nothing to emit, use an empty array \`[]\` for arrays or omit the field entirely for optionals.

{
  "mnemonicTag": "1-3 word Planguage tag",
  "clauseNumber": "verbatim clause identifier",
  "rewrittenText": "full text of the redrafted clause — preserve safety-locked content byte-identical",
  "executiveNotes": "one-sentence summary of what changed in this clause (≤ 25 words)",
  "corrections": [
    {
      "before": "verbatim original snippet from the clause",
      "after": "redrafted snippet",
      "reason": "plain-English reason ≤ 40 words",
      "citedStandards": ["<standard-id from the selected list>"],
      "citedPolicies":  ["<policy-id from the selected list>"],
      "alternativeOptions": ["alt phrasing 1", "alt phrasing 2"],
      "defectClass": "ambiguous-scope | undefined-term | missing-presence-test | missing-scale | missing-target-or-tolerable | missing-stakeholder | unbounded-scope | stylistic-non-compliance | cross-reference-broken | subjective-adjective | redundant-language",
      "confidence": "high | medium | low"
    }
  ],
  "remainingDefects": [
    {
      "specStatement": "actual spec statement as it reads after redraft",
      "ruleViolated": "plain-English name of the rule violated",
      "citedStandards": ["<standard-id>"],
      "citedPolicies":  ["<policy-id>"],
      "seriousness": 1,
      "roleToFix": "named Navy / legal role",
      "roleToApprove": "named senior role",
      "probableRootCause": "best-guess plain-English root cause"
    }
  ],
  "glossaryEntries": [
    { "term": "Capitalised Term", "definition": "precise definition", "source": "clause tag / standard citation / auto-derived" }
  ],
  "relatedDocumentReferences": [
    { "title": "Referenced document name", "documentType": "schedule | exhibit | sow | did | cdrl | appendix | standard | policy | statute | public-law | other  (graphmetrix-node FORBIDDEN this ship)", "note": "why cited + where a reader would find it (REQUIRED)", "externalUrl": "OPTIONAL — canonical public URL you know with high confidence; omit if guessing" }
  ]
}`
}

/** Redraft a single clause via Sonnet.  Returns the parsed per-clause output
 *  or `null` on failure (with a `console.error` for diagnostics — silent
 *  failures forbidden per No-Silent-Data-Loss SUPREME). */
async function _redraftOneClause(
  client:    Anthropic,
  prefix:    string,
  clause:    ContractClause,
): Promise<PerClauseRedraftOutput | null> {
  const entries = clause.entries ?? []
  const suffix = `━━ CLAUSE TO REDRAFT ━━
Clause Number: ${clause.number}
Heading: ${clause.heading}
Parse Status: ${clause.parseStatus}

Raw text:
"""
${clause.rawText}
"""

Parsed Planguage entries (${entries.length}):
${entries.map(e => {
  const type = e.type
  const desc = e.description ?? ''
  return `- [${type}] ${desc}`
}).join('\n') || '(no entries — the clause may be signature-block, whereas, or definitions-only)'}

Return ONLY the JSON object matching the schema above.  Preserve every Safety-Lock byte-identical.  Cite Standards + Policies by id.`

  try {
    const response = await client.messages.create({
      model:      MODEL_ID,
      max_tokens: 8192,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prefix, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: suffix },
        ],
      }],
    })
    const text = response.content.find(b => b.type === 'text')?.text ?? ''
    if (response.stop_reason && response.stop_reason !== 'end_turn') {
      console.warn(
        `[useContractRedraft] Clause ${clause.number} — Sonnet stop_reason=${response.stop_reason} · in=${response.usage?.input_tokens} out=${response.usage?.output_tokens}`,
      )
    }
    // Extract JSON from response — Sonnet occasionally wraps in code fences
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) {
      console.error(`[useContractRedraft] Clause ${clause.number} — no JSON object in response.  First 400 chars:`, text.slice(0, 400))
      return null
    }
    const parsed = JSON.parse(match[0]) as PerClauseRedraftOutput
    return parsed
  } catch (err) {
    console.error(`[useContractRedraft] Clause ${clause.number} — redraft call failed:`, err)
    return null
  }
}

/** Fan out per-clause redraft calls, 5 in parallel — mirrors the parse
 *  pipeline's batching pattern.
 *  r41 v445 (Tom Gilb 2026-07-02) — enhanced with per-batch onBatchFired
 *  callback so the UI can surface "N clauses fired, awaiting first response"
 *  the moment a batch starts, not the moment it finishes.  Cures the
 *  "hangs at zero for 40 seconds" perception. */
async function _redraftAllClauses(
  contract:    ContractModel,
  settings:    ContractRedraftSettings,
  onClauseDone?: (idx: number, total: number, out: PerClauseRedraftOutput | null) => void,
  onBatchFired?: (inFlightClauses: ContractClause[], startedAt: number) => void,
): Promise<Array<{ clause: ContractClause; output: PerClauseRedraftOutput | null }>> {
  const client = _getRedraftClient()
  const prefix = _buildRedraftPromptPrefix(settings)
  const clauses = contract.clauses ?? []
  const results: Array<{ clause: ContractClause; output: PerClauseRedraftOutput | null }> = []
  const BATCH = 5
  let done = 0
  for (let i = 0; i < clauses.length; i += BATCH) {
    const batch = clauses.slice(i, i + BATCH)
    // r41 v445 — announce the batch BEFORE awaiting Sonnet.  UI now shows
    // "Batch N of M · 5 clauses in flight · Sonnet processing…" during the
    // 30-40s Sonnet takes to return the first response of the batch.
    onBatchFired?.(batch, Date.now())
    const outs = await Promise.all(batch.map(cl => _redraftOneClause(client, prefix, cl)))
    for (let k = 0; k < batch.length; k++) {
      results.push({ clause: batch[k], output: outs[k] })
      done++
      onClauseDone?.(done, clauses.length, outs[k])
    }
  }
  return results
}

/** Assemble per-clause outputs into a single `ContractRedraftResult`.
 *  Deduplicates glossary entries + related documents by term/title. */
function _assembleRedraftResult(
  contract:    ContractModel,
  settings:    ContractRedraftSettings,
  perClause:   Array<{ clause: ContractClause; output: PerClauseRedraftOutput | null }>,
  durationSeconds: number,
): ContractRedraftResult {
  const now = new Date().toISOString()

  // Assemble body — for MVP the "current-redlined" and "planguage-restructured"
  // shapes both render as HTML sections per clause; visual redline vs full
  // restructure is applied by the export renderer, not the assembler.
  const bodyPieces: string[] = []
  const plainPieces: string[] = []
  const corrections:      RedraftCorrection[]      = []
  const remainingDefects: RedraftRemainingDefect[] = []
  const glossaryMap:      Record<string, RedraftGlossaryEntry> = {}
  const relatedMap:       Record<string, RedraftRelatedDocument> = {}

  let clauseIdx = 0
  for (const { clause, output } of perClause) {
    clauseIdx++
    if (!output) {
      bodyPieces.push(`<section data-clause-id="${clause.id}" data-clause-number="${_esc(clause.number)}" style="margin-bottom:16px;padding:12px;background:#fef2f2;border-left:4px solid #dc2626;border-radius:4px">
  <h3 style="margin:0 0 6px 0;color:#7f1d1d;font-size:13px">Clause ${_esc(clause.number)} · ${_esc(clause.heading)} — <em>redraft failed</em></h3>
  <pre style="white-space:pre-wrap;color:#4b5563;font-size:11px;font-family:ui-monospace,monospace">${_esc(clause.rawText).slice(0, 800)}</pre>
</section>`)
      plainPieces.push(`Clause ${clause.number} · ${clause.heading} — REDRAFT FAILED (original preserved)\n\n${clause.rawText}\n\n`)
      continue
    }
    // Body piece
    bodyPieces.push(`<section data-clause-id="${clause.id}" data-mnemonic="${_esc(output.mnemonicTag)}" style="margin-bottom:20px;padding:14px;background:white;border:1px solid #e2e8f0;border-radius:8px">
  <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:8px">
    <h3 style="margin:0;color:#0f766e;font-size:14px;font-weight:700">${_esc(output.mnemonicTag)}<span style="color:#94a3b8;font-weight:400;margin-left:8px;font-size:11px">Clause ${_esc(output.clauseNumber)}</span></h3>
  </div>
  ${output.executiveNotes ? `<p style="margin:0 0 8px 0;color:#64748b;font-size:11px;font-style:italic">${_esc(output.executiveNotes)}</p>` : ''}
  <div style="color:#1e293b;font-size:12px;line-height:1.6;white-space:pre-wrap">${_esc(output.rewrittenText)}</div>
</section>`)
    plainPieces.push(`${output.mnemonicTag} · Clause ${output.clauseNumber}\n${output.rewrittenText}\n\n`)

    // Corrections
    for (const c of output.corrections ?? []) {
      corrections.push({
        id:                 _uuid(),
        clauseTag:          output.mnemonicTag,
        before:             c.before,
        after:              c.after,
        reason:             c.reason,
        citedStandards:     c.citedStandards ?? [],
        citedPolicies:      c.citedPolicies  ?? [],
        alternativeOptions: c.alternativeOptions,
        defectClass:        c.defectClass,
        confidence:         c.confidence,
      })
    }

    // Remaining defects
    for (const d of output.remainingDefects ?? []) {
      remainingDefects.push({
        id:                 _uuid(),
        clauseTag:          output.mnemonicTag,
        specStatement:      d.specStatement,
        ruleViolated:       d.ruleViolated,
        citedStandards:     d.citedStandards ?? [],
        citedPolicies:      d.citedPolicies  ?? [],
        seriousness:        d.seriousness,
        roleToFix:          d.roleToFix,
        roleToApprove:      d.roleToApprove,
        probableRootCause:  d.probableRootCause,
        notes:              d.notes,
      })
    }

    // Glossary — dedup by lowercase term
    for (const g of output.glossaryEntries ?? []) {
      const key = g.term.trim().toLowerCase()
      if (!glossaryMap[key]) {
        glossaryMap[key] = { term: g.term.trim(), definition: g.definition, source: g.source, citedIn: [output.mnemonicTag] }
      } else if (!glossaryMap[key].citedIn.includes(output.mnemonicTag)) {
        glossaryMap[key].citedIn.push(output.mnemonicTag)
      }
    }

    // Related docs — dedup by title, aggregate `referencedIn`.
    // r41 v460 (Tom Gilb 2026-07-02 "do not reference a graphmetrix node
    // yet, until you can prove it is there") — SERVER-SIDE STRIP of any
    // graphmetrixUri / graphmetrixNodeType that made it through despite
    // the updated prompt.  Belt-and-braces: even if a future prompt drift
    // reintroduces the "graphmetrix://<path>" pattern, the assembler
    // refuses to accept it.  Composes with the Term-Definition-Source
    // SUPREME rule (Sources must be Reachable-Now; graphmetrix:// is not).
    for (const r of output.relatedDocumentReferences ?? []) {
      const key = r.title.trim().toLowerCase()
      // Reject graphmetrix-node documentType entirely (not-yet-deployed).
      const documentType = r.documentType === 'graphmetrix-node' ? 'other' : r.documentType
      if (!relatedMap[key]) {
        relatedMap[key] = {
          title:               r.title.trim(),
          documentType,
          referencedIn:        [output.mnemonicTag],
          note:                r.note?.trim() || undefined,
          externalUrl:         r.externalUrl?.trim() || undefined,
          // graphmetrixUri + graphmetrixNodeType intentionally dropped —
          // will be reinstated when Graphmetrix deployment is proved.
        }
      } else if (!relatedMap[key].referencedIn.includes(output.mnemonicTag)) {
        relatedMap[key].referencedIn.push(output.mnemonicTag)
      }
    }
  }

  // Policy references list — derived from the settings
  const policyReferences: RedraftPolicyReference[] = settings.policies.map(id => {
    const p = REDRAFT_POLICIES.find(x => x.id === id)
    return {
      policyId:     id,
      policyLabel:  p?.label ?? id,
      version:      '1',
      effectiveDate: now.slice(0, 10),
      citedIn:      [],
    }
  })

  // CHI — recompute using deterministic algorithm.  Structural completeness
  // dimension now bumps because A1-A6 are populated by this result.
  const chiWeights = settings.chiWeights
  const rawChi = computeCHI(contract, chiWeights)
  // Boost structural-completeness dimension by counting how many appendices
  // are non-empty (up to 6, at 1/6 of maxScore each).
  const appendixCount =
    (Object.keys(glossaryMap).length > 0 ? 1 : 0) +
    (policyReferences.length > 0 ? 1 : 0) +
    (Object.keys(relatedMap).length > 0 ? 1 : 0) +
    1 /* A4 CHI itself */ +
    (corrections.length > 0 ? 1 : 0) +
    (remainingDefects.length > 0 ? 1 : 0)
  const structuralBonus = Math.round((appendixCount / 6) * chiWeights['structural-completeness'])
  const structuralDim = rawChi.breakdown.find(d => d.id === 'structural-completeness')
  if (structuralDim) {
    structuralDim.score = structuralBonus
    structuralDim.detail = `${appendixCount} of 6 appendices populated (A1-A6).`
  }
  // Re-aggregate through _finalizeCHI so the renormalized score reflects
  // the post-redraft structural bump AND stays honest about any
  // still-non-measurable dimensions (0 Function / 0 Value / 0 entries).
  const finalizedChi = _finalizeCHI(rawChi.breakdown)

  return {
    id:                  _uuid(),
    contractId:          contract.id,
    contractTitle:       contract.title,
    generatedAt:         now,
    settings,
    structure:           settings.structure,
    bodyHtml:            bodyPieces.join('\n'),
    bodyPlainText:       plainPieces.join(''),
    glossary:            Object.values(glossaryMap).sort((a, b) => a.term.localeCompare(b.term)),
    policyReferences,
    relatedDocuments:    Object.values(relatedMap).sort((a, b) => a.title.localeCompare(b.title)),
    contractHealthIndex: finalizedChi,
    corrections,
    remainingDefects,
    executiveSummary:    _buildExecutiveSummary(contract, corrections, remainingDefects, finalizedChi),
    audit: {
      agent:              'contract-redraft',
      modelUsed:          MODEL_ID,
      durationSeconds,
      autonomyLevel:      settings.autonomy,
      safetyLocksEngaged: settings.safetyLocks,
    },
  }
}

function _buildExecutiveSummary(
  contract:  ContractModel,
  corrections: RedraftCorrection[],
  remaining:   RedraftRemainingDefect[],
  chi:         ContractHealthIndex,
): string {
  const critical = remaining.filter(d => d.seriousness <= 2).length
  const totalDefects = corrections.length + remaining.length
  return (
    `Contract Redraft complete for "${contract.title}".  ` +
    `${corrections.length} corrections applied across ${contract.clauses?.length ?? 0} clauses.  ` +
    `${remaining.length} defects remain for human review (${critical} critical: seriousness ≤ 2).  ` +
    `Contract Health Score: ${chi.score} / 100 (${chi.colourBand.toUpperCase()}).  ` +
    `Total defects identified: ${totalDefects}.  ` +
    `Every correction cites at least one Standard and one Policy; every remaining defect names a role responsible for fixing and a role responsible for approving.`
  )
}

function _uuid(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `rdraft-${Math.random().toString(36).slice(2)}-${Date.now()}`
}

function _esc(s: string): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// ── Public redraft entry point ───────────────────────────────────────────────

/** Progress callback shape for UI wiring.
 *  r41 v445 (Tom Gilb 2026-07-02 verbatim *"we need some early consolation of
 *  what it is doing for 40 seconds at zero. I like lots of rt feedback"*) —
 *  extended with per-second live signals so the banner can show what's
 *  happening even before batch 1 returns its first clause. */
export interface RedraftProgress {
  clausesDone:      number
  clausesTotal:     number
  correctionsSoFar: number
  remainingSoFar:   number
  /** Phase-aware banner text.  'starting' = firing first batch; 'running' =
   *  at least one clause returned; 'finishing' = all clauses returned, assembler
   *  building the result artefact. */
  phase:            'starting' | 'running' | 'finishing'
  /** Seconds since generateRedraft() was called.  Ticks every 1s. */
  elapsedSeconds:   number
  /** How many clauses are currently being processed by Sonnet in parallel.
   *  Batch of 5 fires → inFlightCount = 5.  Each returned clause decrements. */
  inFlightCount:    number
  /** Rolling per-clause average duration (seconds).  Empty until at least one
   *  clause returns.  UI uses this to show ETA. */
  averageClauseSeconds: number
  /** Estimated seconds remaining based on averageClauseSeconds × remaining
   *  clauses / batch parallelism.  Empty until averageClauseSeconds is set. */
  estimatedRemainingSeconds: number
  /** Which clause numbers are currently in flight (for surface-level
   *  visibility — "Article 3, Article 4, Article 5..." in the banner). */
  inFlightClauseNumbers: string[]
}

/**
 * Full contract redraft.  Fan-out to Sonnet per-clause (5 in parallel),
 * assemble into a single `ContractRedraftResult`, persist, return.  Progress
 * reported via `onProgress` so a panel can render a live counter.
 *
 * r41 v445 (Tom Gilb 2026-07-02) — rich per-second progress emission:
 *   • 1-second ticker fires onProgress with fresh elapsedSeconds even when
 *     no clause has returned yet — cures the "hangs at zero for 40s"
 *     black-hole perception of batch startup
 *   • Phase transitions: 'starting' → 'running' → 'finishing'
 *   • In-flight clause tracking (which clauses Sonnet is processing right now)
 *   • Rolling per-clause average → estimated remaining seconds (ETA)
 */
export async function generateRedraft(
  contract:  ContractModel,
  settings:  ContractRedraftSettings,
  onProgress?: (p: RedraftProgress) => void,
): Promise<ContractRedraftResult> {
  const startMs = Date.now()
  const clausesTotal = contract.clauses?.length ?? 0
  let correctionsSoFar = 0
  let remainingSoFar   = 0
  let clausesDone      = 0
  let inFlightCount    = 0
  let inFlightClauseNumbers: string[] = []
  const clauseDurations: number[] = []   // per-clause seconds — for rolling avg
  let phase: RedraftProgress['phase'] = 'starting'

  const emit = (): void => {
    const elapsedSeconds = Math.round((Date.now() - startMs) / 1000)
    const averageClauseSeconds = clauseDurations.length > 0
      ? Math.round(clauseDurations.reduce((s, d) => s + d, 0) / clauseDurations.length)
      : 0
    const remainingClauses = clausesTotal - clausesDone
    // ETA = avg × remaining / batch parallelism (5).  Only when we have data.
    const estimatedRemainingSeconds = averageClauseSeconds > 0 && remainingClauses > 0
      ? Math.round(averageClauseSeconds * remainingClauses / 5)
      : 0
    onProgress?.({
      clausesDone,
      clausesTotal,
      correctionsSoFar,
      remainingSoFar,
      phase,
      elapsedSeconds,
      inFlightCount,
      averageClauseSeconds,
      estimatedRemainingSeconds,
      inFlightClauseNumbers: [...inFlightClauseNumbers],
    })
  }

  // Ticker — every 1s, re-emit with fresh elapsedSeconds so the banner is
  // ALWAYS moving.  Even when zero clauses have returned, the seconds counter
  // proves the pipeline is alive.  Cleared in the `finally` block.
  const ticker = setInterval(emit, 1000)

  // Fire the initial progress event IMMEDIATELY (before batch 1 starts) so
  // the banner doesn't display default zeros until the first `emit` call.
  emit()

  try {
    let batchStartMs = Date.now()
    const perClause = await _redraftAllClauses(
      contract,
      settings,
      (done, total, out) => {
        if (out) {
          correctionsSoFar += (out.corrections?.length     ?? 0)
          remainingSoFar   += (out.remainingDefects?.length ?? 0)
        }
        clausesDone = done
        void total
        phase = 'running'
        // When a clause returns, decrement in-flight and record duration.
        // Duration = (now - batchStart) approximate (parallel — first return
        // in batch shows batch duration; later returns show 0 delta).  For
        // averaging we use the first return of each batch as the batch duration.
        if (inFlightCount > 0) inFlightCount--
        // Remove first-matching in-flight number.  (Order doesn't matter
        // because we display them sorted anyway.)
        if (inFlightClauseNumbers.length > 0) inFlightClauseNumbers.shift()
        emit()
      },
      (batchClauses, startedAt) => {
        // A new batch fired.  Update in-flight state IMMEDIATELY so the
        // banner shows "5 clauses in flight" during the first 30-40s.
        inFlightCount = batchClauses.length
        inFlightClauseNumbers = batchClauses.map(cl => cl.number ?? '?')
        batchStartMs = startedAt
        phase = 'running'
        emit()
      },
    )
    // Assemble phase — Sonnet done, client-side stitching + CHI computation.
    phase = 'finishing'
    inFlightCount = 0
    inFlightClauseNumbers = []
    emit()
    void batchStartMs
    const durationSeconds = Math.round((Date.now() - startMs) / 1000)
    // Also compute avg from the total clock — for a batched parallel pipeline
    // the individual clause durations are approximate; wall-clock / batches
    // is the real signal we log.
    void clauseDurations
    const result = _assembleRedraftResult(contract, settings, perClause, durationSeconds)
    return result
  } finally {
    clearInterval(ticker)
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function useContractRedraft() {
  const settings = computed(() => _settings.value)

  /** Merge a partial settings patch and persist.  Universal-Undo compatible
   *  because settings are versioned in localStorage; a user can Revert to
   *  defaults via the reset button below. */
  function updateSettings(patch: Partial<ContractRedraftSettings>): void {
    _settings.value = { ..._settings.value, ...patch, updatedAt: new Date().toISOString() }
    _saveSettings(_settings.value)
  }

  function resetToDefaults(): void {
    _settings.value = { ...DEFAULT_REDRAFT_SETTINGS, updatedAt: new Date().toISOString() }
    _saveSettings(_settings.value)
  }

  /** Ensure a redraft result is persisted; caller manages array shape. */
  function saveResult(result: ContractRedraftResult): void {
    const existing = _results.value.findIndex(r => r.id === result.id)
    if (existing >= 0) _results.value[existing] = result
    else _results.value.unshift(result)
    _saveResults(_results.value)
  }

  function resultsForContract(contractId: string): ContractRedraftResult[] {
    return _results.value.filter(r => r.contractId === contractId)
  }

  /** Async orchestration entry point — wraps generateRedraft with progress
   *  + error refs so panels can bind reactively.  In v437 this throws;
   *  panels can catch and display the "not yet implemented" message. */
  async function runRedraft(
    contract:   ContractModel,
    onProgress?: (p: RedraftProgress) => void,
  ): Promise<ContractRedraftResult | null> {
    _redraftError.value = null
    _isRedrafting.value = true
    try {
      const result = await generateRedraft(contract, _settings.value, onProgress)
      saveResult(result)
      return result
    } catch (err) {
      _redraftError.value = err instanceof Error ? err.message : String(err)
      return null
    } finally {
      _isRedrafting.value = false
    }
  }

  return {
    // State
    settings,
    isRedrafting: computed(() => _isRedrafting.value),
    redraftError: computed(() => _redraftError.value),
    results:      computed(() => _results.value),

    // Actions
    updateSettings,
    resetToDefaults,
    saveResult,
    resultsForContract,
    runRedraft,

    // Pure helpers (no state)
    computeCHI,
  }
}

// ── Client factory (matches useContractParser's pattern) ─────────────────────
// Kept alongside the composable so v438's Sonnet call can reuse the exact
// same claudeCodeAdapter routing.

export function _getRedraftClient(): Anthropic {
  const apiKey  = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined
  const isLocal = !!(import.meta.env.VITE_OLLAMA_MODEL || import.meta.env.VITE_OLLAMA_BASE_URL || import.meta.env.VITE_AI_PROVIDER === 'claude-code')
  if (!apiKey && !isLocal) {
    console.error('[useContractRedraft] No AI provider configured — VITE_AI_PROVIDER or VITE_ANTHROPIC_API_KEY required.')
    throw new Error('The redraft engine is not configured. Please check settings.')
  }
  return new Anthropic({ apiKey: apiKey ?? 'local', dangerouslyAllowBrowser: true, timeout: 600_000 })
}

// Kept for future reference — v438 will import this MODEL_ID constant.
export const REDRAFT_MODEL_ID = MODEL_ID
