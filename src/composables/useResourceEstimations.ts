/**
 * useResourceEstimations — Resource estimation series per plan.
 *
 * v504 (2026-07-21) — Tom Gilb 2026-07-21 verbatim design brief:
 *
 *   ESTIMATION 1: at specific intervals, there should be automatic attempts
 *   to estimate the 3 central resources: Capital Cost (default US$, but any
 *   specified currency), Calendar Time, Full Time Specialist Staff (broken
 *   down into specialist types). A change in these 3 estimates should be
 *   triggered by a change in: New Values, Changed Value Levels (Tolerable,
 *   Wish, Goal), Changed Conditions (when who where how), Change in
 *   stipulated resources (budget, deadline, full time people), Change in
 *   constraints (legal, policy, regulation, contract).
 *
 *   ESTIMATION 2: estimations always carry Source, Timestamps, Causes,
 *   Reasoning.  Saved as a SERIES with the specs.  Visible or shown on
 *   request, displayed whenever a re-estimation change occurs.  Compared
 *   with current Resource BUDGETS (official/contractual stipulations).
 *   % differential ± computed and displayed for money, time, human resources.
 *
 *   ESTIMATION 3: when estimated exceeds budget by a settings-determined
 *   level (default 20%), resource shows FLASHING RED + a Resources
 *   Sharpening AI advice dialogue button.
 *
 * Scope of this v504 MVP:
 *   ✓ Data model + types (Estimation / Series / TriggerCause / SpecialistBreakdown)
 *   ✓ Per-plan localStorage persistence
 *   ✓ Manual `addEstimation()` API (planner or AI can push into the series)
 *   ✓ Differential % computed against Plan Scope Framework budget
 *   ✓ Status = 'ok' | 'warning' | 'overflow' per threshold settings
 *   ✓ Threshold settings (warning = ceiling × 100%; overflow = ceiling × 120%)
 *   ⏳ Automatic trigger detection (spec-change watchers)  — v505
 *   ⏳ AI-driven estimation via Claudian                    — v505
 *   ⏳ Specialist breakdown UI                              — v505
 *   ⏳ Currency-selector UI                                 — v505
 *   ⏳ Resources-Sharpening remedy dialogue                 — v506
 */

import { computed, ref, watch, type Ref, type ComputedRef } from 'vue'
import { usePlanScopeFramework } from './usePlanScopeFramework'

// ── Public types ────────────────────────────────────────────────────────────

/** The three central resources Tom named as estimation targets. */
export type EstimatableResource =
  | 'capitalCost'
  | 'calendarTime'
  | 'specialistStaff'
  // v508 — ESTIMATION 7 OPEX: annual overhead + technical debt costs of the
  // System of Concern.  Same trigger + manual-change pattern as capitalCost.
  // Each estimation carries an optional detailed breakdown (opexBreakdown).
  | 'annualOverhead'
  | 'technicalDebt'
  // v511 — Gilb Cost Engineering (2023) p.4 broader cost types.  Tom Gilb
  // verbatim: "Cost: any type of resource needed to create, develop,
  // maintain or retire.  Includes financial, time, space, reputation, human
  // talent, knowledge bases."  Default-OFF (planner opts in per plan) to
  // avoid overwhelming teams that only need the central 5.
  | 'spaceCost'          // physical footprint / cloud storage / real estate
  | 'reputationCost'     // brand / trust impact (delta from baseline)
  | 'knowledgeBase'      // documented process assets + training investment
  | 'opportunityCost'    // foregone alternative-project value
  | 'cognitiveLoad'      // mental attention + decision-fatigue load on team

export const RESOURCE_META: Record<EstimatableResource, { label: string; glyph: string; unit: string; hint: string }> = {
  capitalCost:     { label: 'Capital Cost',       glyph: '💰', unit: 'currency', hint: 'Total capital expenditure — money' },
  calendarTime:    { label: 'Calendar Time',      glyph: '🗓', unit: 'time',     hint: 'Real elapsed time from start to delivery' },
  specialistStaff: { label: 'Specialist Staff',   glyph: '👥', unit: 'FTE',      hint: 'Full-time specialist people required (broken down by specialist type)' },
  // v508 — OPEX
  annualOverhead:  { label: 'Annual Overhead',    glyph: '🏭', unit: 'currency', hint: 'Annual operational cost of the System of Concern (hosting, licences, support, admin)' },
  technicalDebt:   { label: 'Technical Debt',     glyph: '⚠️', unit: 'currency', hint: 'Carrying cost of deferred refactoring / rework / architectural compromise' },
  // v511 — Broader Cost Engineering resource types (default-off per plan)
  spaceCost:       { label: 'Space Cost',         glyph: '📐', unit: 'currency', hint: 'Physical footprint + cloud storage + real estate (Cost Engineering p.4)' },
  reputationCost:  { label: 'Reputation Impact',  glyph: '🎖', unit: 'index',    hint: 'Brand + stakeholder-trust impact (delta from baseline, index 0-100 or currency-equivalent)' },
  knowledgeBase:   { label: 'Knowledge Base',     glyph: '📚', unit: 'index',    hint: 'Documented process assets + training + tacit knowledge investment (Cost Engineering p.4)' },
  opportunityCost: { label: 'Opportunity Cost',   glyph: '🔀', unit: 'currency', hint: 'Foregone value of alternative uses of the same resources (finance / project-selection lens)' },
  cognitiveLoad:   { label: 'Cognitive Load',     glyph: '🧠', unit: 'index',    hint: 'Mental attention + decision-fatigue burden on the team (index 0-100; qualitative resource)' },
}

/** v511 — Resource tiering.  CENTRAL = the 5 shipped v504-v508, always on
 *  by default.  EXTENDED = the 5 broader Cost Engineering types shipped v511,
 *  opt-in per plan via ResourcesAgent settings.activeResources. */
export const CENTRAL_RESOURCES: EstimatableResource[] = [
  'capitalCost', 'calendarTime', 'specialistStaff', 'annualOverhead', 'technicalDebt',
]
export const EXTENDED_RESOURCES: EstimatableResource[] = [
  'spaceCost', 'reputationCost', 'knowledgeBase', 'opportunityCost', 'cognitiveLoad',
]
export const ALL_RESOURCES: EstimatableResource[] = [
  ...CENTRAL_RESOURCES, ...EXTENDED_RESOURCES,
]

/** Currency ISO 4217 code (subset — extensible). */
export type Currency = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CHF' | 'CAD' | 'AUD' | 'NOK' | 'SEK' | 'DKK'

/** Time-unit for calendar-time estimates. */
export type TimeUnit = 'days' | 'weeks' | 'months' | 'years'

/** Trigger cause tags — what change prompted a re-estimation.
 *  Tom's brief listed 5 canonical triggers; `manual` = planner clicked "Add estimation". */
export type TriggerCause =
  | 'manual'                    // planner explicitly added
  | 'new-value'                 // a new Value entry
  | 'changed-value-level'       // Tolerable / Wish / Goal changed
  | 'changed-condition'         // Qualifier changed (when / who / where / how)
  | 'changed-stipulated-resources'  // Plan Scope Framework changed (budget / deadline / FTE)
  | 'changed-constraint'        // Constraint entry added / changed (legal / policy / regulation / contract)
  | 'scheduled'                 // periodic auto-estimation interval fired
  | 'evo-step-completion'       // v506 — Evo step completion measurement data entered (IBM Cleanroom / Mills / PoSEM 1988)

export const TRIGGER_CAUSE_META: Record<TriggerCause, { label: string; glyph: string }> = {
  'manual':                       { label: 'Manual',                        glyph: '👤' },
  'new-value':                    { label: 'New Value',                     glyph: '✨' },
  'changed-value-level':          { label: 'Changed Value Level',           glyph: '📊' },
  'changed-condition':            { label: 'Changed Condition (Qualifier)', glyph: '🎯' },
  'changed-stipulated-resources': { label: 'Changed Stipulated Resources',  glyph: '💰' },
  'changed-constraint':           { label: 'Changed Constraint',            glyph: '📝' },
  'scheduled':                    { label: 'Scheduled Interval',            glyph: '⏰' },
  'evo-step-completion':          { label: 'Evo Step Completion Actuals',   glyph: '✅' },
}

export type EstimationSourceKind = 'planner' | 'ai' | 'contract' | 'imported' | 'external'

/** Specialist staff breakdown row (used only when resource === 'specialistStaff'). */
export interface SpecialistBreakdownRow {
  type:  string   // free-text specialist type (e.g. "ML Engineer", "Systems Engineer", "QA")
  ftes:  number   // full-time-equivalent count
}

/**
 * v510 (2026-07-21) — ESTIMATION 9: EvidenceLink + EstimationEquation.
 *
 * Tom Gilb 2026-07-21 verbatim: "Estimation 9: see Gilb Cost Engineering book
 * for additional ideas and references.  See the new Planguage Logic for
 * Equations re resources (example linked to evidence for an estimate or
 * source of an estimate)"
 *
 * Grounding — Gilb Cost Engineering (2023) core definition: "Cost: any type
 * of resource needed to create, develop, maintain or retire.  Includes
 * financial, time, space, reputation, human talent, knowledge bases."  The
 * SEM App tracks the 5 most-common cost dimensions; the equation + evidence
 * pattern here generalises so a planner can capture ANY cost / value equation
 * with its source references.
 *
 * Grounding — Planguage Logic (July 2026, p.5): "In science and engineering
 * we call these logical relationships 'formulas' or 'equations' where the
 * relationships are expressed symbolically … the logic needs to be spelled
 * out explicitly for AI, and in such a way that humans can understand what
 * logic is being applied."  The equation captures that logic; the evidence
 * links capture the sources that ground the variables.
 */

/** One structured evidence reference tied to an Estimation.  Replaces the
 *  free-text-only `reasoning` field for cases where the source needs to be
 *  auditable.  Multiple evidence links can attach to a single Estimation. */
export interface EvidenceLink {
  id:          string
  kind:        'contract-clause' | 'rfp-clause' | 'book-citation' | 'url' | 'file' | 'data-source' | 'expert-opinion' | 'historical-precedent' | 'benchmark'
  citation:    string       // human-readable citation (e.g. "PACRM Solicitation §3.2.1", "Gilb Cost Engineering p.4", "https://…")
  url?:        string       // optional canonical URL
  credibility: number       // 0.0–1.0 CE-scale confidence (0.9 = strongly supports, 0.3 = weak)
  addedAt:     string
  note?:       string
}

/** Structured equation record.  Captures the FORMULA that produced the
 *  Estimation `amount`.  When present, an estimation is auditable: the reader
 *  can see exactly how the number was arrived at, what variables fed in, and
 *  what evidence links to each variable.  Planguage-Logic aligned. */
export interface EstimationEquation {
  /** Symbolic formula in plain text — e.g. "years × avg_annual_cost + one_off_setup" */
  formula:     string
  /** Named variable values — { years: 5, avg_annual_cost: 48000, one_off_setup: 15000 } */
  variables:   Record<string, number>
  /** Computed value from formula + variables (SHOULD equal Estimation.amount
   *  — the composable does not enforce; the planner may override). */
  computed?:   number
  /** Per-variable evidence-link IDs — { avg_annual_cost: ['ev-abc', 'ev-def'] } */
  variableEvidence?: Record<string, string[]>
  /** Free-text methodology narrative — e.g. "Wright's Law learning-curve
   *  applied to the last 3 Evo Step actuals". */
  methodology?: string
}

/**
 * v508 (2026-07-21) — OPEX breakdown row.  Tom Gilb 2026-07-21 verbatim:
 *   "Estimate 7 OPEX: In the IET, and in financial estimates displays, we
 *   need to keep track of the annual overhead and technical debt costs of
 *   the System of Concern.  Same as for the capital cost (auto estimates on
 *   triggers, manual changes possible).  A detailed breakdown of the Opex
 *   should accompany each estimate."
 * Used ONLY when resource === 'annualOverhead' OR 'technicalDebt'.  Each row
 * names one line-item + amount + optional frequency + optional note.  The
 * sum of the rows' amounts SHOULD reconcile with the parent Estimation
 * `amount`; the composable does not enforce this — the planner may keep
 * top-level `amount` as an aggregate estimate and use the breakdown for
 * transparency.
 */
export interface OpexBreakdownRow {
  label:      string    // free-text line-item (e.g. "Cloud hosting", "Support engineer (0.2 FTE)")
  amount:     number    // numeric value
  frequency?: 'annual' | 'monthly' | 'quarterly' | 'one-off'   // default 'annual'
  category?:  'infrastructure' | 'personnel' | 'licence' | 'contract' | 'deferred-refactor' | 'compliance' | 'other'
  note?:      string
}

/**
 * v505 (2026-07-21) — Second opinion on an Estimation.  Tom Gilb 2026-07-21:
 *   "ESTIMATES 4: whatever the auto estimate there needs to be scope for 2
 *   additional elements of estimation, 1. second opinions (name/email of
 *   opinion holder, reasons), any number of these.  They should be retractable,
 *   and amendable."
 * Any number attach to a single Estimation.  Retracted opinions stay visible
 * (flagged, greyed out) to preserve the audit trail; amendments update in
 * place with an `amendedAt` stamp.
 */
export interface SecondOpinion {
  id:                string
  timestamp:         string   // ISO — when the opinion was first added
  holderName:        string
  holderEmail?:      string
  reasons:           string   // free-text — WHY the opinion holder disagrees / concurs / suggests
  alternativeAmount?: number   // optional — the amount the opinion holder would suggest instead
  // Retracted state
  retracted:         boolean
  retractedAt?:      string
  retractedReason?:  string
  // Amended state
  amendedAt?:        string   // ISO — set on each in-place amendment
}

/** One estimation event.  Immutable core once added (amount/timestamp/source/
 *  causes/reasoning don't change); new estimations append to the series.  The
 *  MUTABLE sidecars — second opinions + retract flags — do accumulate.  A NEW
 *  Estimation entry that supersedes a prior one carries `overridesId` + the
 *  override-metadata (Tom's ESTIMATION 4 part 2). */
export interface Estimation {
  id:        string                             // deterministic mnemonic (timestamp + resource)
  timestamp: string                             // ISO
  resource:  EstimatableResource
  amount:    number                             // primary numeric value
  currency?: Currency                           // when resource === 'capitalCost' | 'annualOverhead' | 'technicalDebt' (default 'USD')
  timeUnit?: TimeUnit                           // when resource === 'calendarTime'
  specialistBreakdown?: SpecialistBreakdownRow[] // when resource === 'specialistStaff'
  // v508 — OPEX breakdown (annualOverhead | technicalDebt only)
  opexBreakdown?: OpexBreakdownRow[]
  // v510 — ESTIMATION 9: Planguage-Logic-aligned evidence + equation.
  // Optional; when populated an Estimation becomes auditable end-to-end.
  evidenceLinks?: EvidenceLink[]
  equation?:      EstimationEquation
  source:    EstimationSourceKind               // who/what produced the estimate
  causes:    TriggerCause[]                     // what triggered this re-estimation
  reasoning: string                             // free-text explanation (AI-generated OR planner-typed)
  // v505 — ESTIMATION 4 part 1: second opinions.  Append-only per-estimation
  // sidecar list; retracted opinions stay visible (flag), amendments update in
  // place with an `amendedAt` stamp.
  secondOpinions?: SecondOpinion[]
  // v505 — ESTIMATION 4 part 2: manual override metadata.  When this Estimation
  // OVERRIDES a prior one, `overridesId` points to the superseded estimation
  // and the two override fields carry the responsible source + reason.
  overridesId?:               string
  overrideResponsibleSource?: string
  overrideReason?:            string
}

/** Per-resource series with the full history + latest snapshot + budget-comparison. */
export interface EstimationSeries {
  resource:        EstimatableResource
  history:         Estimation[]                 // append-only; latest at end
  latestAmount:    number | null                // convenience — history[history.length-1]?.amount ?? null
  budgetAmount:    number | null                // from Plan Scope Framework (v503) — null if not yet set
  differentialPct: number | null                // (latestAmount - budgetAmount) / budgetAmount × 100; null if either missing
  status:          'ok' | 'warning' | 'overflow' | 'no-budget' | 'no-estimate'
}

/** Threshold settings — planner-configurable warning + overflow ceilings. */
export interface EstimationThresholds {
  /** % over budget that triggers amber warning (default 100 = at budget). */
  warningPct:  number
  /** % over budget that triggers red overflow (default 120 = 20% over per Tom's brief). */
  overflowPct: number
}

export const DEFAULT_THRESHOLDS: EstimationThresholds = {
  warningPct:  100,   // hitting the budget is a warning
  overflowPct: 120,   // 20% over budget is the red-flash trigger (Tom's brief default)
}

// ── Storage layer ───────────────────────────────────────────────────────────

interface StoredShape {
  estimations: Estimation[]
  thresholds:  EstimationThresholds
}

function _storageKey(planId: string): string {
  return `sem-app:resource-estimations:v1:${planId}`
}

function _loadFromStorage(key: string): StoredShape {
  const empty: StoredShape = { estimations: [], thresholds: { ...DEFAULT_THRESHOLDS } }
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return empty
    const parsed = JSON.parse(raw) as Partial<StoredShape>
    const out: StoredShape = {
      estimations: Array.isArray(parsed.estimations) ? parsed.estimations.filter(_isValidEstimation) : [],
      thresholds:  {
        warningPct:  typeof parsed.thresholds?.warningPct  === 'number' ? parsed.thresholds.warningPct  : DEFAULT_THRESHOLDS.warningPct,
        overflowPct: typeof parsed.thresholds?.overflowPct === 'number' ? parsed.thresholds.overflowPct : DEFAULT_THRESHOLDS.overflowPct,
      },
    }
    return out
  } catch { return empty }
}

function _isValidEstimation(e: unknown): e is Estimation {
  if (!e || typeof e !== 'object') return false
  const r = e as Record<string, unknown>
  return typeof r.id === 'string'
      && typeof r.timestamp === 'string'
      && typeof r.amount === 'number'
      && (r.resource === 'capitalCost' || r.resource === 'calendarTime' || r.resource === 'specialistStaff')
}

// Module-level cache — one Ref per planId shared across consumers.
const _cache = new Map<string, Ref<StoredShape>>()

function _getState(planId: string): Ref<StoredShape> {
  let cached = _cache.get(planId)
  if (cached) return cached
  const key = _storageKey(planId)
  const state = ref<StoredShape>(_loadFromStorage(key))
  watch(state, (v) => {
    try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* quota */ }
  }, { deep: true })
  _cache.set(planId, state)
  return state
}

// ── Public composable API ──────────────────────────────────────────────────

export interface UseResourceEstimations {
  /** All estimation events across all resources (append-only). */
  estimations:     ComputedRef<Estimation[]>
  /** Threshold settings (mutable — auto-persisted on change). */
  thresholds:      Ref<EstimationThresholds>
  /** Per-resource series with budget comparison + status. */
  series:          ComputedRef<Record<EstimatableResource, EstimationSeries>>
  /** Any resource in overflow (any red). */
  anyOverflow:     ComputedRef<boolean>
  /** Any resource in warning (any amber). */
  anyWarning:      ComputedRef<boolean>
  /** Add a new estimation event (planner input OR AI-produced). */
  addEstimation:   (e: Omit<Estimation, 'id' | 'timestamp'>) => void
  /** Remove an estimation event by id (mostly for undo / test cleanup). */
  removeEstimation:(id: string) => void
  /** Reset the entire series (destructive — use with care). */
  resetAll:        () => void
  // v505 — ESTIMATION 4 API
  /** Add a second opinion to an existing estimation.  Any number allowed. */
  addSecondOpinion: (estimationId: string, opinion: Omit<SecondOpinion, 'id' | 'timestamp' | 'retracted'>) => void
  /** Retract a second opinion.  Opinion stays in the record (flagged), never deleted. */
  retractSecondOpinion: (estimationId: string, opinionId: string, retractedReason?: string) => void
  /** Amend a second opinion in place (updates the fields, stamps `amendedAt`). */
  amendSecondOpinion: (estimationId: string, opinionId: string, patch: Partial<Omit<SecondOpinion, 'id' | 'timestamp'>>) => void
  /** Override a prior estimation: creates a NEW Estimation entry that supersedes
   *  the given `originalId` with a new amount + responsible source + reason.
   *  The superseded estimation stays in the history (audit trail preserved). */
  overrideEstimation: (originalId: string, newAmount: number, responsibleSource: string, reason: string, reasoning?: string) => void
  /** v508 — ESTIMATION 7 OPEX: replace the opexBreakdown array on an
   *  Estimation.  Used by the ResourceEstimationCard breakdown editor.
   *  Only meaningful for annualOverhead / technicalDebt estimations. */
  updateOpexBreakdown: (estimationId: string, breakdown: OpexBreakdownRow[]) => void
  // ── v510 — ESTIMATION 9: Evidence + Equation (Planguage Logic) ─────────
  /** Add a structured evidence link to an estimation. */
  addEvidenceLink: (estimationId: string, ev: Omit<EvidenceLink, 'id' | 'addedAt'>) => void
  /** Remove an evidence link by id. */
  removeEvidenceLink: (estimationId: string, evidenceId: string) => void
  /** Replace the entire equation record on an estimation (or clear if
   *  passed null).  When an equation with a `computed` value differs from
   *  the estimation's amount, both are surfaced side-by-side in the UI. */
  setEstimationEquation: (estimationId: string, eq: EstimationEquation | null) => void
  /** v513 — bulk-import estimations from an external system (Jira / CSV /
   *  accounting export).  Each row becomes an Estimation with source='imported'.
   *  Returns the created Estimation[] so the UI can preview + undo. */
  bulkImportEstimations: (rows: Omit<Estimation, 'id' | 'timestamp'>[]) => Estimation[]
  // ── v514 — Envelope round-trip (SpecVersion / export / import) ────────
  /** Serialise the composable's full state to a plain-JSON snapshot.
   *  Used by useResourcesEnvelope to attach estimation data to SpecVersion
   *  + spec-export appendix per No-Silent-Data-Loss SUPREME. */
  getSnapshot: () => { estimations: Estimation[]; thresholds: EstimationThresholds }
  /** Restore state from a snapshot (replaces current state atomically).
   *  Called during SpecVersion restore + spec-import. */
  hydrateFromSnapshot: (snapshot: { estimations: Estimation[]; thresholds: EstimationThresholds }) => void
  /** v506 — ESTIMATION 5: Evo step completion actuals auto-trigger re-estimation.
   *  Called when a planner reports the completed cost / calendar / human resources
   *  for a just-finished Evo step.  Pushes a new Estimation per reported resource
   *  with source='planner', causes=['evo-step-completion'], and reasoning that
   *  cites the Evo step name + PoSEM 1988 (IBM Cleanroom / Mills). */
  estimateFromEvoStepActuals: (evoStepName: string, actuals: {
    reportedCapital?: number
    reportedCapitalCurrency?: Currency
    reportedTime?:    number
    reportedTimeUnit?: TimeUnit
    reportedHuman?:   number
    reportedHumanBreakdown?: SpecialistBreakdownRow[]
    // v508 — OPEX auto-trigger from Evo Step actuals
    reportedAnnualOverhead?:          number
    reportedAnnualOverheadCurrency?:  Currency
    reportedAnnualOverheadBreakdown?: OpexBreakdownRow[]
    reportedTechnicalDebt?:           number
    reportedTechnicalDebtCurrency?:   Currency
    reportedTechnicalDebtBreakdown?:  OpexBreakdownRow[]
    note?: string
  }) => Estimation[]
}

export function useResourceEstimations(planIdRef: Ref<string> | ComputedRef<string>): UseResourceEstimations {
  const scope = usePlanScopeFramework(planIdRef)
  const activeStore = computed(() => _getState(planIdRef.value))

  const estimations = computed<Estimation[]>(() => activeStore.value.value.estimations)

  const thresholds = computed<EstimationThresholds>({
    get: () => activeStore.value.value.thresholds,
    set: (v) => { activeStore.value.value.thresholds = v },
  }) as unknown as Ref<EstimationThresholds>   // computed getter/setter behaves like a Ref for template v-model

  // Budget lookup from Plan Scope Framework.  For capitalCost, prefer 'total'
  // then 'fixed' then 'contracted' then 'annual' × horizon-in-years (rough).
  // For calendarTime, derive from the deadline (date - today OR from-start value).
  // For specialistStaff, no framework field yet — return null (v505 will add).
  const budgetFor = (r: EstimatableResource): number | null => {
    const s = scope.state.value
    if (r === 'capitalCost') {
      const b = s.budgetAmounts
      return b.total ?? b.fixed ?? b.contracted ?? b.annual ?? null
    }
    if (r === 'calendarTime') {
      if (s.deadlineMode === 'from-start' && typeof s.deadlineFromStartValue === 'number') {
        // Convert to days for a canonical comparison unit
        const v = s.deadlineFromStartValue
        return s.deadlineFromStartUnit === 'years'  ? v * 365
             : s.deadlineFromStartUnit === 'months' ? v * 30
             : s.deadlineFromStartUnit === 'weeks'  ? v * 7
             : v
      }
      if (s.deadlineMode === 'date' && s.deadlineDate) {
        const deadline = new Date(s.deadlineDate).getTime()
        const now = Date.now()
        const days = Math.max(0, Math.round((deadline - now) / 86_400_000))
        return days
      }
      return null
    }
    // v508 — annualOverhead: use PlanScopeFramework.budgetAmounts.annual when
    // present (the annual budget is the natural "stipulated" overhead ceiling).
    if (r === 'annualOverhead') {
      const b = s.budgetAmounts
      return b.annual ?? null
    }
    // v508 — technicalDebt: no PSF field yet.  Future extension: add a
    // dedicated `technicalDebtCeiling` field to Plan Scope Framework.
    if (r === 'technicalDebt') {
      return null
    }
    // v511 — broader Cost Engineering resource types have no PSF budget
    // field yet (each will get one in v513+ as the planner needs them).
    // specialistStaff + extended-tier — no framework field yet
    return null
  }

  const series = computed<Record<EstimatableResource, EstimationSeries>>(() => {
    const out = {} as Record<EstimatableResource, EstimationSeries>
    const t = thresholds.value
    for (const r of ALL_RESOURCES) {
      const history = estimations.value.filter(e => e.resource === r)
      const latest = history[history.length - 1]
      const latestAmount = latest?.amount ?? null
      const budgetAmount = budgetFor(r)
      let differentialPct: number | null = null
      let status: EstimationSeries['status'] = 'no-estimate'
      if (latestAmount == null) {
        status = 'no-estimate'
      } else if (budgetAmount == null) {
        status = 'no-budget'
      } else if (budgetAmount === 0) {
        // Avoid divide-by-zero.  Non-zero estimate against zero budget = overflow.
        differentialPct = latestAmount > 0 ? Infinity : 0
        status = latestAmount > 0 ? 'overflow' : 'ok'
      } else {
        differentialPct = ((latestAmount - budgetAmount) / budgetAmount) * 100
        const pctOfBudget = (latestAmount / budgetAmount) * 100
        if (pctOfBudget >= t.overflowPct)      status = 'overflow'
        else if (pctOfBudget >= t.warningPct)  status = 'warning'
        else                                   status = 'ok'
      }
      out[r] = { resource: r, history, latestAmount, budgetAmount, differentialPct, status }
    }
    return out
  })

  const anyOverflow = computed<boolean>(() =>
    Object.values(series.value).some(s => s.status === 'overflow')
  )
  const anyWarning = computed<boolean>(() =>
    Object.values(series.value).some(s => s.status === 'warning')
  )

  function addEstimation(e: Omit<Estimation, 'id' | 'timestamp'>): void {
    const now = new Date().toISOString()
    const id = `est-${e.resource}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const full: Estimation = { ...e, id, timestamp: now }
    activeStore.value.value.estimations = [...activeStore.value.value.estimations, full]
  }

  function removeEstimation(id: string): void {
    activeStore.value.value.estimations = activeStore.value.value.estimations.filter(e => e.id !== id)
  }

  function resetAll(): void {
    activeStore.value.value = { estimations: [], thresholds: { ...DEFAULT_THRESHOLDS } }
  }

  // ── v505 — ESTIMATION 4: second opinions + manual override ────────────────

  function _mutateEstimation(id: string, mut: (e: Estimation) => Estimation): void {
    const list = activeStore.value.value.estimations
    const idx = list.findIndex(e => e.id === id)
    if (idx === -1) return
    // Replace the entry (immutable-style) so Vue's reactivity sees a new array.
    const next = [...list]
    next[idx] = mut({ ...list[idx] })
    activeStore.value.value.estimations = next
  }

  function addSecondOpinion(
    estimationId: string,
    opinion: Omit<SecondOpinion, 'id' | 'timestamp' | 'retracted'>,
  ): void {
    _mutateEstimation(estimationId, (e) => {
      const now = new Date().toISOString()
      const oid = `op-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const full: SecondOpinion = { ...opinion, id: oid, timestamp: now, retracted: false }
      return { ...e, secondOpinions: [...(e.secondOpinions ?? []), full] }
    })
  }

  function retractSecondOpinion(estimationId: string, opinionId: string, retractedReason?: string): void {
    _mutateEstimation(estimationId, (e) => {
      const now = new Date().toISOString()
      const opinions = (e.secondOpinions ?? []).map(o =>
        o.id === opinionId ? { ...o, retracted: true, retractedAt: now, retractedReason: retractedReason ?? '' } : o
      )
      return { ...e, secondOpinions: opinions }
    })
  }

  function amendSecondOpinion(
    estimationId: string,
    opinionId: string,
    patch: Partial<Omit<SecondOpinion, 'id' | 'timestamp'>>,
  ): void {
    _mutateEstimation(estimationId, (e) => {
      const now = new Date().toISOString()
      const opinions = (e.secondOpinions ?? []).map(o =>
        o.id === opinionId ? { ...o, ...patch, amendedAt: now } : o
      )
      return { ...e, secondOpinions: opinions }
    })
  }

  // v508 — ESTIMATION 7 OPEX: replace the breakdown on an estimation.
  function updateOpexBreakdown(estimationId: string, breakdown: OpexBreakdownRow[]): void {
    _mutateEstimation(estimationId, (e) => ({ ...e, opexBreakdown: [...breakdown] }))
  }

  // ── v514 — Envelope round-trip (getSnapshot / hydrateFromSnapshot) ──────
  function getSnapshot(): { estimations: Estimation[]; thresholds: EstimationThresholds } {
    // Deep clone via JSON round-trip to guarantee plain-data (no Vue Proxy,
    // no shared references) — same pattern as v487 IDB fix.
    return JSON.parse(JSON.stringify({
      estimations: activeStore.value.value.estimations,
      thresholds:  activeStore.value.value.thresholds,
    }))
  }
  function hydrateFromSnapshot(snapshot: { estimations: Estimation[]; thresholds: EstimationThresholds }): void {
    if (!snapshot || typeof snapshot !== 'object') return
    const clean = JSON.parse(JSON.stringify(snapshot))
    activeStore.value.value = {
      estimations: Array.isArray(clean.estimations) ? clean.estimations.filter(_isValidEstimation) : [],
      thresholds:  {
        warningPct:  typeof clean.thresholds?.warningPct  === 'number' ? clean.thresholds.warningPct  : DEFAULT_THRESHOLDS.warningPct,
        overflowPct: typeof clean.thresholds?.overflowPct === 'number' ? clean.thresholds.overflowPct : DEFAULT_THRESHOLDS.overflowPct,
      },
    }
  }

  // ── v513 — Bulk import from external systems ───────────────────────────
  function bulkImportEstimations(rows: Omit<Estimation, 'id' | 'timestamp'>[]): Estimation[] {
    const created: Estimation[] = []
    const nowBase = Date.now()
    for (let i = 0; i < rows.length; i++) {
      const now = new Date(nowBase + i).toISOString()
      const id = `est-${rows[i].resource}-${nowBase + i}-${Math.random().toString(36).slice(2, 6)}`
      created.push({ ...rows[i], id, timestamp: now })
    }
    if (created.length > 0) {
      activeStore.value.value.estimations = [...activeStore.value.value.estimations, ...created]
    }
    return created
  }

  // ── v510 — ESTIMATION 9: Evidence + Equation (Planguage Logic) ─────────
  function addEvidenceLink(
    estimationId: string,
    ev: Omit<EvidenceLink, 'id' | 'addedAt'>,
  ): void {
    _mutateEstimation(estimationId, (e) => {
      const now = new Date().toISOString()
      const id = `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const full: EvidenceLink = { ...ev, id, addedAt: now }
      return { ...e, evidenceLinks: [...(e.evidenceLinks ?? []), full] }
    })
  }
  function removeEvidenceLink(estimationId: string, evidenceId: string): void {
    _mutateEstimation(estimationId, (e) => ({
      ...e,
      evidenceLinks: (e.evidenceLinks ?? []).filter(x => x.id !== evidenceId),
    }))
  }
  function setEstimationEquation(estimationId: string, eq: EstimationEquation | null): void {
    _mutateEstimation(estimationId, (e) => {
      const next = { ...e }
      if (eq === null) delete next.equation
      else next.equation = eq
      return next
    })
  }

  function overrideEstimation(
    originalId: string,
    newAmount: number,
    responsibleSource: string,
    reason: string,
    reasoning = '',
  ): void {
    const original = activeStore.value.value.estimations.find(e => e.id === originalId)
    if (!original) return
    const now = new Date().toISOString()
    const id = `est-${original.resource}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const overriding: Estimation = {
      id,
      timestamp: now,
      resource:  original.resource,
      amount:    newAmount,
      currency:  original.currency,
      timeUnit:  original.timeUnit,
      specialistBreakdown: original.specialistBreakdown,
      source:    'planner',            // manual overrides are planner-authored by definition
      causes:    ['manual'],
      reasoning: reasoning.trim() || `Manual override of estimation ${originalId}: ${reason}`,
      overridesId:               originalId,
      overrideResponsibleSource: responsibleSource,
      overrideReason:            reason,
    }
    activeStore.value.value.estimations = [...activeStore.value.value.estimations, overriding]
  }

  // ── v506 — ESTIMATION 5: Evo step completion actuals auto-trigger ─────────
  //
  // Tom Gilb 2026-07-21 verbatim:
  //   "ESTIMATION 5: I FORGOT an important trigger for reestimation of future
  //   resources, and that is the evo step measures reported costs and calendar
  //   time.  This should be automatic and a function of the entry of that evo
  //   step completion measurement data.  This is the practice of IBM cleanroom
  //   (Mills) as reporten in my PoSEM 1988 book"
  //
  // Cleanroom software engineering (Harlan Mills, IBM FSD, 1980s) built its
  // measurement discipline on incremental delivery: each completed increment
  // yields ACTUAL cost + calendar + effort measurements that immediately re-
  // calibrate the projection for the remaining increments.  Tom's PoSEM 1988
  // §17 documents the pattern; SEM's Evo Step is the direct descendant.
  function estimateFromEvoStepActuals(
    evoStepName: string,
    actuals: {
      reportedCapital?:         number
      reportedCapitalCurrency?: Currency
      reportedTime?:            number
      reportedTimeUnit?:        TimeUnit
      reportedHuman?:           number
      reportedHumanBreakdown?:  SpecialistBreakdownRow[]
      // v508 — OPEX
      reportedAnnualOverhead?:          number
      reportedAnnualOverheadCurrency?:  Currency
      reportedAnnualOverheadBreakdown?: OpexBreakdownRow[]
      reportedTechnicalDebt?:           number
      reportedTechnicalDebtCurrency?:   Currency
      reportedTechnicalDebtBreakdown?:  OpexBreakdownRow[]
      note?:                    string
    },
  ): Estimation[] {
    const created: Estimation[] = []
    const stepLabel = evoStepName.trim() || 'un-named Evo Step'
    const note = actuals.note?.trim() || ''
    const noteSuffix = note ? ` · Planner note: ${note}` : ''
    const cite = 'Source: Evo Step completion actuals · IBM Cleanroom incremental-measurement practice (Mills) · Tom Gilb PoSEM 1988 §17.'

    const push = (partial: Omit<Estimation, 'id' | 'timestamp'>): void => {
      const now = new Date().toISOString()
      const id = `est-${partial.resource}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const full: Estimation = { ...partial, id, timestamp: now }
      created.push(full)
    }

    if (typeof actuals.reportedCapital === 'number' && actuals.reportedCapital >= 0) {
      push({
        resource: 'capitalCost',
        amount:   actuals.reportedCapital,
        currency: actuals.reportedCapitalCurrency ?? 'USD',
        source:   'planner',
        causes:   ['evo-step-completion'],
        reasoning: `Reported Capital actual for Evo Step "${stepLabel}"${noteSuffix}.  ${cite}`,
      })
    }
    if (typeof actuals.reportedTime === 'number' && actuals.reportedTime >= 0) {
      push({
        resource: 'calendarTime',
        amount:   actuals.reportedTime,
        timeUnit: actuals.reportedTimeUnit ?? 'weeks',
        source:   'planner',
        causes:   ['evo-step-completion'],
        reasoning: `Reported Calendar Time actual for Evo Step "${stepLabel}"${noteSuffix}.  ${cite}`,
      })
    }
    if (typeof actuals.reportedHuman === 'number' && actuals.reportedHuman >= 0) {
      push({
        resource: 'specialistStaff',
        amount:   actuals.reportedHuman,
        specialistBreakdown: actuals.reportedHumanBreakdown,
        source:   'planner',
        causes:   ['evo-step-completion'],
        reasoning: `Reported Specialist Staff actual for Evo Step "${stepLabel}"${noteSuffix}.  ${cite}`,
      })
    }
    // v508 — OPEX auto-trigger from Evo Step actuals
    if (typeof actuals.reportedAnnualOverhead === 'number' && actuals.reportedAnnualOverhead >= 0) {
      push({
        resource: 'annualOverhead',
        amount:   actuals.reportedAnnualOverhead,
        currency: actuals.reportedAnnualOverheadCurrency ?? 'USD',
        opexBreakdown: actuals.reportedAnnualOverheadBreakdown,
        source:   'planner',
        causes:   ['evo-step-completion'],
        reasoning: `Reported Annual Overhead actual for Evo Step "${stepLabel}"${noteSuffix}.  ${cite}`,
      })
    }
    if (typeof actuals.reportedTechnicalDebt === 'number' && actuals.reportedTechnicalDebt >= 0) {
      push({
        resource: 'technicalDebt',
        amount:   actuals.reportedTechnicalDebt,
        currency: actuals.reportedTechnicalDebtCurrency ?? 'USD',
        opexBreakdown: actuals.reportedTechnicalDebtBreakdown,
        source:   'planner',
        causes:   ['evo-step-completion'],
        reasoning: `Reported Technical Debt actual for Evo Step "${stepLabel}"${noteSuffix}.  ${cite}`,
      })
    }

    if (created.length > 0) {
      activeStore.value.value.estimations = [...activeStore.value.value.estimations, ...created]
    }
    return created
  }

  return {
    estimations, thresholds, series, anyOverflow, anyWarning,
    addEstimation, removeEstimation, resetAll,
    // v505 — ESTIMATION 4
    addSecondOpinion, retractSecondOpinion, amendSecondOpinion, overrideEstimation,
    // v506 — ESTIMATION 5
    estimateFromEvoStepActuals,
    // v508 — ESTIMATION 7 OPEX
    updateOpexBreakdown,
    // v510 — ESTIMATION 9: Evidence + Equation (Planguage Logic)
    addEvidenceLink, removeEvidenceLink, setEstimationEquation,
    // v513 — bulk import
    bulkImportEstimations,
    // v514 — envelope round-trip
    getSnapshot, hydrateFromSnapshot,
  }
}
