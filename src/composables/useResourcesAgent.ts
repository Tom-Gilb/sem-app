/**
 * useResourcesAgent — v509 (2026-07-21) — ESTIMATION 8.
 *
 * Tom Gilb 2026-07-21 verbatim:
 *   "Estimation 8: Aside from spreading and collecting this resource data
 *   many places, I think we need a specialized Agent called 'Resources' where
 *   we can see all of the current data, and even dig into the time stamped
 *   series of any one resource, and have Sharpening sessions to deal with
 *   any resource situation based on the current set of data.  It would also
 *   be the place for resource settings (currency, frequency, data elements
 *   to capture, standards to apply (like the Navy Finance Standard REM
 *   already has in the Contracts), and References to any specific resource
 *   items in a RFP or Contract, and more things I cant think of yet (suggest
 *   some good ones!) including drawing graphs of changes and extrapolating
 *   init future"
 *
 * Purpose: single-agent hub for the 5-resource (Capital / Calendar / Staff /
 * Annual Overhead / Technical Debt) subsystem.  Combines every resource
 * surface built in v504–v508 into ONE screen the planner can drive from.
 *
 * MVP scope (v509):
 *  • Overview grid — all 5 resources, status, latest, stipulated, differential
 *  • Time-series sparkline per resource
 *  • Linear extrapolation forward N periods
 *  • Settings persisted per plan: default currency, default frequency,
 *    active standards (multi-select), per-resource Contract/RFP references
 *  • Sharpen pin per resource (emits, parent routes)
 *
 * Standing SUPREME rules composed:
 *  • v504 useResourceEstimations (source of series + budget lookup)
 *  • v507 useIetResourceSnapshot (snapshot history — surfaced as changelog)
 *  • v503 usePlanScopeFramework (stipulated budgets)
 *  • Module-level Map<planId, Ref<state>> shared reactive state pattern
 *  • No-Silent-Data-Loss (settings persist to localStorage)
 *  • Universal Undo (per-mutation route)
 *  • Twin portability (pure composable + no Vue-specific side effects)
 */

import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import {
  useResourceEstimations,
  RESOURCE_META,
  ALL_RESOURCES,
  type EstimatableResource,
  type Estimation,
  type EvidenceLink,
  type SecondOpinion,
  type EstimationSourceKind,
} from './useResourceEstimations'
import { useIetResourceSnapshot } from './useIetResourceSnapshot'
import { usePlanScopeFramework } from './usePlanScopeFramework'

// ── Types ────────────────────────────────────────────────────────────────────

/** Standards registry — a curated list of resource-relevant financial /
 *  procurement / project-management standards.  Categories mirror the
 *  contractRedraft.ts pattern.  Planners toggle which apply to the plan. */
export interface ResourceStandard {
  id: string
  label: string
  shortLabel: string
  category: 'us-federal' | 'us-navy' | 'us-dod' | 'international' | 'professional' | 'financial-reporting' | 'project-management' | 'custom'
  authorityUrl?: string
  defaultOn?: boolean
  appliesTo?: EstimatableResource[]   // when omitted, applies to all 5 resources
}

export const RESOURCE_STANDARDS: readonly ResourceStandard[] = [
  // — Financial reporting
  { id: 'gaap',              label: 'US GAAP — Generally Accepted Accounting Principles',   shortLabel: 'GAAP',            category: 'financial-reporting', authorityUrl: 'https://www.fasb.org',          defaultOn: false },
  { id: 'ifrs',              label: 'IFRS — International Financial Reporting Standards',   shortLabel: 'IFRS',            category: 'financial-reporting', authorityUrl: 'https://www.ifrs.org',          defaultOn: false },
  { id: 'iso-31000',         label: 'ISO 31000 — Risk Management (resource-risk clauses)',   shortLabel: 'ISO 31000',       category: 'international',       authorityUrl: 'https://www.iso.org/iso-31000-risk-management.html', defaultOn: false },
  // — US Navy / DoD (matching Contracts Redraft catalog)
  { id: 'navsup-p485',       label: 'NAVSUP P-485 — Naval Supply Procedures (Navy Finance / REM)', shortLabel: 'NAVSUP P-485', category: 'us-navy',           authorityUrl: 'https://www.navsup.navy.mil',   defaultOn: false, appliesTo: ['capitalCost', 'annualOverhead'] },
  { id: 'secnavinst-7000',   label: 'SECNAVINST 7000-Series — Navy Financial Management Policy', shortLabel: 'SECNAVINST 7000', category: 'us-navy',         authorityUrl: 'https://www.secnav.navy.mil/doni/', defaultOn: false, appliesTo: ['capitalCost', 'annualOverhead'] },
  { id: 'nmcars',            label: 'NMCARS — Navy Marine Corps Acquisition Regulation Supplement', shortLabel: 'NMCARS',      category: 'us-navy',           authorityUrl: 'https://www.secnav.navy.mil/rda/DASN%20AP/Pages/NMCARS.aspx', defaultOn: false },
  { id: 'far-part-31',       label: 'FAR Part 31 — Contract Cost Principles + Procedures',   shortLabel: 'FAR Part 31',     category: 'us-federal',        authorityUrl: 'https://www.acquisition.gov/far/part-31', defaultOn: false, appliesTo: ['capitalCost', 'annualOverhead'] },
  { id: 'dcaa-cam',          label: 'DCAA Contract Audit Manual — allowable costs guidance',  shortLabel: 'DCAA CAM',        category: 'us-dod',            authorityUrl: 'https://www.dcaa.mil',          defaultOn: false, appliesTo: ['capitalCost', 'annualOverhead'] },
  // — Project management
  { id: 'pmbok-7',           label: 'PMBOK Guide 7th Ed. — resource + cost management',       shortLabel: 'PMBOK 7',         category: 'project-management', authorityUrl: 'https://www.pmi.org',           defaultOn: false, appliesTo: ['calendarTime', 'specialistStaff', 'capitalCost'] },
  { id: 'ibm-cleanroom',     label: 'IBM Cleanroom — incremental-measurement discipline (Mills / PoSEM 1988)', shortLabel: 'IBM Cleanroom', category: 'project-management', authorityUrl: 'https://www.gilb.com', defaultOn: true },
  { id: 'gilb-planguage',    label: 'Tom Gilb · Planguage discipline (Resources chapter, CE Ch.7)', shortLabel: 'Planguage',   category: 'project-management', authorityUrl: 'https://www.gilb.com',        defaultOn: true },
  // v510 — Gilb-corpus + Cost Engineering references (per Tom's ESTIMATION 9)
  { id: 'gilb-cost-engineering', label: 'Gilb Cost Engineering (2023) — 10 principles of Dynamic Design-to-Cost + DtC / DDtC / Wright\'s Law / de-biasing', shortLabel: 'Gilb Cost Eng.', category: 'project-management', authorityUrl: 'https://www.gilb.com/tomtwin/concept/Cost.Engineering', defaultOn: true, appliesTo: ['capitalCost', 'annualOverhead', 'technicalDebt'] },
  { id: 'gilb-planguage-logic', label: 'Gilb Planguage Logic (July 2026) — formulas + equations grounding every estimate in evidence', shortLabel: 'Planguage Logic', category: 'project-management', authorityUrl: 'https://www.gilb.com', defaultOn: true },
  { id: 'gilb-viet',         label: 'Gilb VIET — Value Impact Estimation Table (Brodie PhD 2015)',    shortLabel: 'VIET',            category: 'project-management', authorityUrl: 'https://tinyurl.com/VIEbooklet', defaultOn: false },
  { id: 'gilb-dtc',          label: 'Gilb Design-to-Cost / Dynamic DtC — Cost Engineering Ch.3-5',    shortLabel: 'DtC / DDtC',      category: 'project-management', authorityUrl: 'https://www.gilb.com', defaultOn: false, appliesTo: ['capitalCost', 'calendarTime'] },
  { id: 'wrights-law',       label: 'Wright\'s Law — learning-curve cost reduction (cumulative production)', shortLabel: 'Wright\'s Law', category: 'project-management', authorityUrl: 'https://en.wikipedia.org/wiki/Experience_curve_effects', defaultOn: false, appliesTo: ['capitalCost', 'annualOverhead', 'specialistStaff'] },
  { id: 'flyvbjerg-iron-law', label: 'Bent Flyvbjerg — Iron Law of Megaprojects (over time, over budget, under benefits)', shortLabel: 'Iron Law',       category: 'project-management', authorityUrl: 'https://www.hup.harvard.edu/catalog.php?isbn=9780674293052', defaultOn: false },
  // — Custom
  { id: 'custom-url',        label: 'Custom URL(s) — user-supplied standards',                shortLabel: 'Custom',          category: 'custom',            defaultOn: false },
]

/** Per-resource Contract/RFP reference — free-text list of citations.
 *  Tom Gilb 2026-07-21: "References to any specific resource items in a RFP
 *  or Contract".  Enables audit trail from resource line item to contractual
 *  authority. */
export interface ContractResourceReference {
  id:        string
  resource:  EstimatableResource
  citation:  string         // e.g. "PACRM Solicitation §3.2.1" or "Indianapolis Contract Article 8, Cl 2"
  url?:      string
  note?:     string
  addedAt:   string
}

/** Resource-agent settings persisted per plan. */
export interface ResourcesAgentSettings {
  /** Default currency for capitalCost / annualOverhead / technicalDebt. */
  defaultCurrency:  'USD' | 'EUR' | 'GBP' | 'JPY' | 'CHF' | 'CAD' | 'AUD' | 'NOK' | 'SEK' | 'DKK'
  /** v511 — DISPLAY currency (all amounts converted to this on read; original
   *  stored currency preserved). */
  displayCurrency:  'USD' | 'EUR' | 'GBP' | 'JPY' | 'CHF' | 'CAD' | 'AUD' | 'NOK' | 'SEK' | 'DKK'
  /** Default reporting frequency for OPEX breakdown line items. */
  defaultFrequency: 'annual' | 'monthly' | 'quarterly' | 'one-off'
  /** Which of the 10 resources are actively tracked (Central: default true;
   *  Extended: default false — planner opts in per plan). */
  activeResources:  Record<EstimatableResource, boolean>
  /** Standard IDs the planner has opted into. */
  activeStandardIds: string[]
  /** RFP/Contract references, indexed as a flat list. */
  contractReferences: ContractResourceReference[]
  /** Extrapolation window (periods forward) for the trend graph. */
  extrapolatePeriods: number
  /** v511 — Extrapolation method (linear-regression | wrights-law).  Applied
   *  per plan; individual resources can override via per-resource setting
   *  (future v512 extension). */
  extrapolationMethod: ExtrapolationMethod
  /** v511 — De-biasing pass configuration.  When enabled, all amounts on
   *  the applyToResources list are multiplied by (1 + optimism + strategic)
   *  before display.  Underlying stored amounts unchanged. */
  debiasing: DebiasingConfig
  /** Free-text notes / methodology narrative. */
  notes: string
}

function defaultSettings(): ResourcesAgentSettings {
  return {
    defaultCurrency:     'USD',
    displayCurrency:     'USD',
    defaultFrequency:    'annual',
    activeResources:     {
      // Central 5: on
      capitalCost: true, calendarTime: true, specialistStaff: true,
      annualOverhead: true, technicalDebt: true,
      // v511 Extended 5: off (opt-in)
      spaceCost: false, reputationCost: false, knowledgeBase: false,
      opportunityCost: false, cognitiveLoad: false,
    },
    activeStandardIds:   RESOURCE_STANDARDS.filter(s => s.defaultOn).map(s => s.id),
    contractReferences:  [],
    extrapolatePeriods:  3,
    extrapolationMethod: 'linear-regression',
    debiasing:           defaultDebiasingConfig(),
    notes:               '',
  }
}

// ── Module-level cache ───────────────────────────────────────────────────────

const _cache = new Map<string, Ref<ResourcesAgentSettings>>()

function _storageKey(planId: string): string {
  return `resources-agent-settings:${planId}`
}

function _load(planId: string): ResourcesAgentSettings {
  try {
    const raw = localStorage.getItem(_storageKey(planId))
    if (!raw) return defaultSettings()
    const parsed = JSON.parse(raw)
    const base = defaultSettings()
    return {
      ...base,
      ...parsed,
      activeResources:    { ...base.activeResources, ...(parsed.activeResources ?? {}) },
      activeStandardIds:  Array.isArray(parsed.activeStandardIds) ? parsed.activeStandardIds : base.activeStandardIds,
      contractReferences: Array.isArray(parsed.contractReferences) ? parsed.contractReferences : [],
    }
  } catch {
    return defaultSettings()
  }
}

function _getSettings(planId: string): Ref<ResourcesAgentSettings> {
  if (!_cache.has(planId)) {
    const r = ref<ResourcesAgentSettings>(_load(planId))
    watch(r, (val) => {
      try { localStorage.setItem(_storageKey(planId), JSON.stringify(val)) } catch { /* quota — silent */ }
    }, { deep: true })
    _cache.set(planId, r)
  }
  return _cache.get(planId)!
}

// ── Helpers: extrapolation ───────────────────────────────────────────────────

/** v509+v511 Extrapolation contract.  Two methods supported: linear-regression
 *  (default; simple slope) and wrights-law (learning-curve: cost = a * n^-b
 *  per Gilb Cost Engineering + industrial-experience-curve literature). */
export interface Extrapolation {
  fittedLine:         { t: number; y: number }[]
  extrapolatedPoints: { t: number; y: number }[]
  trendPerPeriod:     number    // slope OR learning-rate depending on method
  r2:                 number    // coefficient of determination [0, 1]
  method:             'linear-regression' | 'wrights-law'
  /** v511 — Wright's-Law-only: b exponent + a coefficient in cost = a*n^-b */
  wrightsLawExponent?: number
  wrightsLawCoefficient?: number
}

/** v511 — Extrapolation method selector */
export type ExtrapolationMethod = 'linear-regression' | 'wrights-law'

/** v511 — De-biasing pass configuration.  Applied to any extrapolation OR
 *  raw estimation on display.  Gilb Cost Engineering + Bent Flyvbjerg
 *  Iron-Law antidote: "de-biasing of all cost, schedule, and benefit
 *  estimates".  Two independent biases modelled:
 *   - optimism bias (psychological — planners underestimate cost/time)
 *   - strategic-misrepresentation bias (political — advocates minimise cost/time
 *     to get project approved).
 *  Both adjust upward.  De-biasing multiplier = 1 + optimism + strategic. */
export interface DebiasingConfig {
  enabled:                    boolean
  optimismUpliftPct:          number   // 0-100, default 15
  strategicMisrepPct:         number   // 0-100, default 20
  applyToResources:           EstimatableResource[]   // which resources get uplifted
}
export function defaultDebiasingConfig(): DebiasingConfig {
  return {
    enabled: false,
    optimismUpliftPct: 15,
    strategicMisrepPct: 20,
    applyToResources: ['capitalCost', 'calendarTime', 'annualOverhead'],
  }
}
export function debiasedAmount(amount: number, cfg: DebiasingConfig): number {
  if (!cfg.enabled) return amount
  const mult = 1 + (cfg.optimismUpliftPct + cfg.strategicMisrepPct) / 100
  return amount * mult
}

/** v511 — Wright's Law extrapolation.  Fits `y = a * n^-b` where `n` is
 *  cumulative production count (index+1).  Best-fit via log-log linear
 *  regression on `log(y) = log(a) - b * log(n)`.  Learning-curve pattern:
 *  cost declines predictably as cumulative experience grows.  Requires all
 *  y > 0 (Wright's Law is undefined for zero cost). */
export function wrightsLawExtrapolate(series: Estimation[], periodsForward: number): Extrapolation | null {
  if (!Array.isArray(series) || series.length < 2) return null
  const sorted = [...series].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  // Reject any zero/negative amounts — Wright's Law needs positives only.
  if (sorted.some(e => !(e.amount > 0))) return null
  const n = sorted.length
  const ns = sorted.map((_, i) => i + 1)   // cumulative count starts at 1
  const ys = sorted.map(e => e.amount)
  const logN = ns.map(v => Math.log(v))
  const logY = ys.map(v => Math.log(v))
  const meanLogN = logN.reduce((s, v) => s + v, 0) / n
  const meanLogY = logY.reduce((s, v) => s + v, 0) / n
  let num = 0, denX = 0, denY = 0
  for (let i = 0; i < n; i++) {
    const dx = logN[i] - meanLogN, dy = logY[i] - meanLogY
    num  += dx * dy
    denX += dx * dx
    denY += dy * dy
  }
  // slope = -b (so b = -slope); intercept = log(a)
  const slope = denX === 0 ? 0 : num / denX
  const b = -slope
  const logA = meanLogY - slope * meanLogN
  const a = Math.exp(logA)
  const r2 = (denX === 0 || denY === 0) ? 0 : (num * num) / (denX * denY)
  const fittedLine = ns.map((k, i) => ({ t: i, y: a * Math.pow(k, -b) }))
  const extrapolatedPoints: { t: number; y: number }[] = []
  for (let k = 1; k <= periodsForward; k++) {
    const t = (n - 1) + k
    const cumN = n + k
    extrapolatedPoints.push({ t, y: Math.max(0, a * Math.pow(cumN, -b)) })
  }
  return {
    fittedLine,
    extrapolatedPoints,
    trendPerPeriod: -b,       // negative b means cost declines
    r2,
    method: 'wrights-law',
    wrightsLawExponent: b,
    wrightsLawCoefficient: a,
  }
}

/**
 * v511 — Currency conversion.  Static approximation table (indicative rates
 * ~July 2026).  Planners should override with live rates when precision
 * matters.  Rates expressed as "1 unit of FROM = N units of USD" for a
 * single-hub design; cross-currency conversions compute via USD hub.
 */
export const USD_RATES: Record<'USD' | 'EUR' | 'GBP' | 'JPY' | 'CHF' | 'CAD' | 'AUD' | 'NOK' | 'SEK' | 'DKK', number> = {
  USD: 1.00,
  EUR: 1.08,
  GBP: 1.27,
  JPY: 0.0067,
  CHF: 1.12,
  CAD: 0.74,
  AUD: 0.66,
  NOK: 0.095,
  SEK: 0.096,
  DKK: 0.145,
}
export function convertAmount(
  amount: number,
  from: keyof typeof USD_RATES,
  to:   keyof typeof USD_RATES,
): number {
  if (from === to) return amount
  const inUsd = amount * USD_RATES[from]
  return inUsd / USD_RATES[to]
}

export function linearExtrapolate(series: Estimation[], periodsForward: number): Extrapolation | null {
  if (!Array.isArray(series) || series.length < 2) return null
  // Order by timestamp (they should already be — belt + braces).
  const sorted = [...series].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  const n = sorted.length
  // Use series index as t (uniform spacing).  Meaningful because we're
  // projecting NEXT N estimation events, not a strict calendar-forecast.
  const xs = sorted.map((_, i) => i)
  const ys = sorted.map(e => e.amount)
  const meanX = xs.reduce((s, v) => s + v, 0) / n
  const meanY = ys.reduce((s, v) => s + v, 0) / n
  let num = 0, denX = 0, denY = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX, dy = ys[i] - meanY
    num  += dx * dy
    denX += dx * dx
    denY += dy * dy
  }
  const slope = denX === 0 ? 0 : num / denX
  const intercept = meanY - slope * meanX
  const r2 = (denX === 0 || denY === 0) ? 0 : (num * num) / (denX * denY)
  const fittedLine = xs.map(x => ({ t: x, y: intercept + slope * x }))
  const extrapolatedPoints: { t: number; y: number }[] = []
  for (let k = 1; k <= periodsForward; k++) {
    const t = xs[n - 1] + k
    extrapolatedPoints.push({ t, y: Math.max(0, intercept + slope * t) })
  }
  return {
    fittedLine,
    extrapolatedPoints,
    trendPerPeriod: slope,
    r2,
    method: 'linear-regression',
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export interface UseResourcesAgent {
  settings:  Ref<ResourcesAgentSettings>
  /** Add a Contract/RFP reference tied to a resource. */
  addContractReference: (resource: EstimatableResource, citation: string, url?: string, note?: string) => void
  /** Remove a Contract/RFP reference by id. */
  removeContractReference: (id: string) => void
  /** Toggle a standard on/off. */
  toggleStandard: (id: string) => void
  /** Toggle a resource active/inactive (hides from panel — does NOT delete data). */
  toggleResourceActive: (r: EstimatableResource) => void
  /** Get extrapolation for a resource using current series + settings. */
  extrapolationFor: (r: EstimatableResource) => Extrapolation | null
  /** All active standards resolved to full ResourceStandard entries. */
  activeStandards: ComputedRef<ResourceStandard[]>
  /** Standards relevant to a given resource (either applies-to-all OR includes it). */
  standardsForResource: (r: EstimatableResource) => ResourceStandard[]
  // ── v512 — Aggregation helpers across all estimations ──────────────────
  /** All estimation events flattened + sorted by timestamp (oldest first)
   *  — feeds the Timeline view. */
  getAllTimelineEvents: () => TimelineEvent[]
  /** All non-retracted second opinions across every resource. */
  getOutstandingSecondOpinions: () => OutstandingOpinion[]
  /** Compliance matrix — for each active resource × active standard cell,
   *  the count of estimations carrying at least one evidence link + a %
   *  score derived from evidence-count + credibility. */
  getComplianceMatrix: () => ComplianceMatrix
  /** All evidence links across every estimation (flat + sorted newest first). */
  getAllEvidenceLinks: () => AggregatedEvidence[]
  /** Build a colourful HTML quarterly report of the whole resource landscape. */
  buildQuarterlyReport: () => { html: string; plainText: string; title: string }
  // ── v513 — AI Sharpening + What-if + Auto-import ──────────────────────
  /** Build a prompt for Claudian (Claude Code) to analyse a resource's
   *  situation + propose remediation.  Per Claude-Code-as-AI-Layer SUPREME
   *  the SEM App NEVER calls an API — the prompt goes to the clipboard for
   *  Tom to paste into his local Claudian session, JSON comes back via paste. */
  buildSharpenPrompt: (resource: EstimatableResource) => string
  /** Parse an incoming CSV / TSV / JSON block of external resource data
   *  into an array of Estimation drafts ready for review + bulk import. */
  parseImportText: (raw: string, defaultSource?: EstimationSourceKind) => ImportedEstimationDraft[]
  // v514 — envelope round-trip
  getSnapshot: () => ResourcesAgentSettings
  hydrateFromSnapshot: (snap: ResourcesAgentSettings) => void
}

// v513 — Types
export interface ImportedEstimationDraft {
  resource:    EstimatableResource
  amount:      number
  currency?:   'USD' | 'EUR' | 'GBP' | 'JPY' | 'CHF' | 'CAD' | 'AUD' | 'NOK' | 'SEK' | 'DKK'
  timeUnit?:   'days' | 'weeks' | 'months' | 'years'
  reasoning:   string
  source:      EstimationSourceKind
  rowIndex:    number
  warning?:    string   // when the row could not be fully parsed
}

// v512 — Aggregation types
export interface TimelineEvent {
  timestamp:  string
  resource:   EstimatableResource
  kind:       'estimation' | 'override' | 'second-opinion' | 'evidence'
  amount?:    number
  label:      string
  estimationId: string
}
export interface OutstandingOpinion {
  estimation:  Estimation
  opinion:     SecondOpinion
}
export interface ComplianceMatrix {
  resources:  EstimatableResource[]
  standards:  ResourceStandard[]
  /** [resource][standard.id] = { estimationsWithEvidence, totalEstimations, avgCredibility, score } */
  cells:      Record<string, Record<string, ComplianceCell>>
}
export interface ComplianceCell {
  estimationsWithEvidence: number
  totalEstimations:        number
  avgCredibility:          number   // 0-1
  score:                   number   // 0-100
  band:                    'ok' | 'partial' | 'weak' | 'none'
}
export interface AggregatedEvidence {
  estimation: Estimation
  evidence:   EvidenceLink
  resource:   EstimatableResource
}

export function useResourcesAgent(
  planIdRef: Ref<string> | ComputedRef<string>,
): UseResourcesAgent {
  const settings = computed({
    get:  () => _getSettings(planIdRef.value).value,
    set:  (v) => { _getSettings(planIdRef.value).value = v },
  }) as unknown as Ref<ResourcesAgentSettings>

  const estim = useResourceEstimations(planIdRef)

  function addContractReference(
    resource: EstimatableResource,
    citation: string,
    url?: string,
    note?: string,
  ): void {
    const trimmed = citation.trim()
    if (!trimmed) return
    const ref: ContractResourceReference = {
      id: `ref-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      resource,
      citation: trimmed,
      url:  url?.trim() || undefined,
      note: note?.trim() || undefined,
      addedAt: new Date().toISOString(),
    }
    const s = settings.value
    settings.value = { ...s, contractReferences: [...s.contractReferences, ref] }
  }

  function removeContractReference(id: string): void {
    const s = settings.value
    settings.value = { ...s, contractReferences: s.contractReferences.filter(r => r.id !== id) }
  }

  function toggleStandard(id: string): void {
    const s = settings.value
    const present = s.activeStandardIds.includes(id)
    settings.value = {
      ...s,
      activeStandardIds: present
        ? s.activeStandardIds.filter(x => x !== id)
        : [...s.activeStandardIds, id],
    }
  }

  function toggleResourceActive(r: EstimatableResource): void {
    const s = settings.value
    settings.value = {
      ...s,
      activeResources: { ...s.activeResources, [r]: !s.activeResources[r] },
    }
  }

  function extrapolationFor(r: EstimatableResource): Extrapolation | null {
    const series = estim.estimations.value.filter(e => e.resource === r)
    const method = settings.value.extrapolationMethod
    let base: Extrapolation | null = null
    if (method === 'wrights-law') {
      base = wrightsLawExtrapolate(series, settings.value.extrapolatePeriods)
      // Fall back to linear if Wright's Law fails (needs positives, ≥2 points)
      if (!base) base = linearExtrapolate(series, settings.value.extrapolatePeriods)
    } else {
      base = linearExtrapolate(series, settings.value.extrapolatePeriods)
    }
    if (!base) return null
    // v511 — apply de-biasing uplift if enabled for this resource.
    const cfg = settings.value.debiasing
    if (cfg.enabled && cfg.applyToResources.includes(r)) {
      const mult = 1 + (cfg.optimismUpliftPct + cfg.strategicMisrepPct) / 100
      return {
        ...base,
        fittedLine:         base.fittedLine.map(p => ({ t: p.t, y: p.y * mult })),
        extrapolatedPoints: base.extrapolatedPoints.map(p => ({ t: p.t, y: p.y * mult })),
      }
    }
    return base
  }

  const activeStandards = computed<ResourceStandard[]>(() => {
    const ids = new Set(settings.value.activeStandardIds)
    return RESOURCE_STANDARDS.filter(s => ids.has(s.id))
  })

  function standardsForResource(r: EstimatableResource): ResourceStandard[] {
    return activeStandards.value.filter(s => !s.appliesTo || s.appliesTo.includes(r))
  }

  // ── v512 — Aggregation helpers across all resources / estimations ──────

  function getAllTimelineEvents(): TimelineEvent[] {
    const out: TimelineEvent[] = []
    for (const e of estim.estimations.value) {
      // The Estimation itself is an event
      out.push({
        timestamp:    e.timestamp,
        resource:     e.resource,
        kind:         e.overridesId ? 'override' : 'estimation',
        amount:       e.amount,
        label:        e.overridesId
          ? `${RESOURCE_META[e.resource].label} override: ${e.amount.toLocaleString()} (${e.overrideResponsibleSource ?? 'planner'})`
          : `${RESOURCE_META[e.resource].label} estimation: ${e.amount.toLocaleString()} — source ${e.source}`,
        estimationId: e.id,
      })
      // Each second opinion is a sub-event on the estimation's timeline
      for (const op of e.secondOpinions ?? []) {
        out.push({
          timestamp:    op.timestamp,
          resource:     e.resource,
          kind:         'second-opinion',
          label:        `Second opinion on ${RESOURCE_META[e.resource].label} — ${op.holderName}${op.retracted ? ' (retracted)' : ''}`,
          estimationId: e.id,
        })
      }
      // Each evidence link is a sub-event too (uses addedAt)
      for (const ev of e.evidenceLinks ?? []) {
        out.push({
          timestamp:    ev.addedAt,
          resource:     e.resource,
          kind:         'evidence',
          label:        `Evidence added to ${RESOURCE_META[e.resource].label} — ${ev.kind}: ${ev.citation}`,
          estimationId: e.id,
        })
      }
    }
    return out.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  }

  function getOutstandingSecondOpinions(): OutstandingOpinion[] {
    const out: OutstandingOpinion[] = []
    for (const e of estim.estimations.value) {
      for (const op of e.secondOpinions ?? []) {
        if (!op.retracted) out.push({ estimation: e, opinion: op })
      }
    }
    // Newest first
    return out.sort((a, b) => new Date(b.opinion.timestamp).getTime() - new Date(a.opinion.timestamp).getTime())
  }

  function getComplianceMatrix(): ComplianceMatrix {
    const s = settings.value
    const resources = (Object.keys(s.activeResources) as EstimatableResource[]).filter(r => s.activeResources[r])
    const stds = activeStandards.value
    const cells: Record<string, Record<string, ComplianceCell>> = {}
    for (const r of resources) {
      cells[r] = {}
      const resourceEstimations = estim.estimations.value.filter(e => e.resource === r)
      for (const std of stds) {
        // A resource-standard cell is "covered" when the resource has
        // estimations that carry evidence links.  Score = weighted evidence
        // presence × average credibility.
        const withEvidence = resourceEstimations.filter(e => (e.evidenceLinks?.length ?? 0) > 0)
        const totalCred = withEvidence.reduce((sum, e) => {
          const creds = (e.evidenceLinks ?? []).map(ev => ev.credibility)
          const avg = creds.length ? creds.reduce((a, b) => a + b, 0) / creds.length : 0
          return sum + avg
        }, 0)
        const avgCred = withEvidence.length ? totalCred / withEvidence.length : 0
        const coverage = resourceEstimations.length ? withEvidence.length / resourceEstimations.length : 0
        const score = Math.round(coverage * avgCred * 100)
        const band: ComplianceCell['band'] =
          resourceEstimations.length === 0 ? 'none' :
          score >= 70 ? 'ok' :
          score >= 40 ? 'partial' :
          'weak'
        cells[r][std.id] = {
          estimationsWithEvidence: withEvidence.length,
          totalEstimations:        resourceEstimations.length,
          avgCredibility:          avgCred,
          score,
          band,
        }
      }
    }
    return { resources, standards: stds, cells }
  }

  function getAllEvidenceLinks(): AggregatedEvidence[] {
    const out: AggregatedEvidence[] = []
    for (const e of estim.estimations.value) {
      for (const ev of e.evidenceLinks ?? []) {
        out.push({ estimation: e, evidence: ev, resource: e.resource })
      }
    }
    return out.sort((a, b) => new Date(b.evidence.addedAt).getTime() - new Date(a.evidence.addedAt).getTime())
  }

  function _htmlEsc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }

  function buildQuarterlyReport(): { html: string; plainText: string; title: string } {
    const now = new Date()
    const q = Math.floor(now.getMonth() / 3) + 1
    const title = `Resources Quarterly Review — Q${q} ${now.getFullYear()} · Plan ${planIdRef.value}`
    const s = settings.value
    const activeR = (Object.keys(s.activeResources) as EstimatableResource[]).filter(r => s.activeResources[r])

    // ONE outer table per r93aaa One-Table-for-Cohesion — this is a single
    // cohesive document (not a per-entry-type Spec).
    let html = `<table cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="background:#ffffff;border:1px solid #cbd5e1;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;width:100%;max-width:800px;margin:0 auto">`

    // Header
    html += `<tr><td bgcolor="#4338ca" style="background:#4338ca;color:#ffffff;padding:18px 22px;border-radius:12px 12px 0 0"><div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#c7d2fe">Resources Agent · Quarterly Review</div><div style="font-size:20px;font-weight:800;margin-top:4px">${_htmlEsc(title)}</div><div style="font-size:11px;color:#c7d2fe;margin-top:4px">Generated ${now.toISOString().slice(0, 19).replace('T', ' ')}</div></td></tr>`

    // Overview per resource
    html += `<tr><td bgcolor="#f1f5f9" style="background:#f1f5f9;padding:14px 22px;font-size:13px;font-weight:700;color:#334155;border-top:1px solid #cbd5e1">Resource Overview (${activeR.length} of 10 active)</td></tr>`
    for (const r of activeR) {
      const series = estim.series.value[r]
      const latest = series.latestAmount != null ? series.latestAmount.toLocaleString() : '—'
      const stip = series.budgetAmount != null ? series.budgetAmount.toLocaleString() : '—'
      const diff = series.differentialPct != null && Number.isFinite(series.differentialPct)
        ? `${series.differentialPct > 0 ? '+' : ''}${series.differentialPct.toFixed(1)}%`
        : '—'
      const bandBg = series.status === 'overflow' ? '#fee2e2' : series.status === 'warning' ? '#fef3c7' : series.status === 'ok' ? '#dcfce7' : '#f1f5f9'
      const bandColor = series.status === 'overflow' ? '#991b1b' : series.status === 'warning' ? '#92400e' : series.status === 'ok' ? '#166534' : '#475569'
      html += `<tr><td bgcolor="${bandBg}" style="background:${bandBg};padding:10px 22px;border-top:1px solid #e2e8f0"><div style="font-size:13px;font-weight:700;color:${bandColor}">${RESOURCE_META[r].glyph} ${_htmlEsc(RESOURCE_META[r].label)} — ${_htmlEsc(series.status.toUpperCase())}</div><div style="font-size:11px;color:#334155;margin-top:3px"><b>Estimated:</b> ${latest} · <b>Stipulated:</b> ${stip} · <b>Δ:</b> ${diff} · <b>${series.history.length}</b> estimation event${series.history.length === 1 ? '' : 's'}</div></td></tr>`
    }

    // Active standards
    html += `<tr><td bgcolor="#ede9fe" style="background:#ede9fe;padding:14px 22px;font-size:13px;font-weight:700;color:#5b21b6;border-top:1px solid #cbd5e1">Active Standards (${activeStandards.value.length})</td></tr>`
    html += `<tr><td style="padding:8px 22px;font-size:11px;color:#334155">${activeStandards.value.map(std => `<span style="display:inline-block;background:#f5f3ff;border:1px solid #c4b5fd;color:#5b21b6;padding:2px 8px;border-radius:9999px;margin:2px;font-weight:600">${_htmlEsc(std.shortLabel)}</span>`).join(' ')}</td></tr>`

    // Outstanding second opinions
    const opinions = getOutstandingSecondOpinions()
    html += `<tr><td bgcolor="#fef3c7" style="background:#fef3c7;padding:14px 22px;font-size:13px;font-weight:700;color:#92400e;border-top:1px solid #cbd5e1">Outstanding Second Opinions (${opinions.length})</td></tr>`
    if (opinions.length === 0) {
      html += `<tr><td style="padding:8px 22px;font-size:11px;color:#94a3b8;font-style:italic">No outstanding second opinions.</td></tr>`
    } else {
      for (const o of opinions.slice(0, 20)) {
        html += `<tr><td style="padding:6px 22px;font-size:11px;color:#334155;border-top:1px solid #f1f5f9"><b>${_htmlEsc(o.opinion.holderName)}</b> on ${_htmlEsc(RESOURCE_META[o.estimation.resource].label)}: ${_htmlEsc(o.opinion.reasons.slice(0, 200))}${o.opinion.reasons.length > 200 ? '…' : ''}</td></tr>`
      }
    }

    // Evidence summary
    const allEvidence = getAllEvidenceLinks()
    html += `<tr><td bgcolor="#dbeafe" style="background:#dbeafe;padding:14px 22px;font-size:13px;font-weight:700;color:#1e3a8a;border-top:1px solid #cbd5e1">Evidence Trail (${allEvidence.length} link${allEvidence.length === 1 ? '' : 's'})</td></tr>`
    if (allEvidence.length === 0) {
      html += `<tr><td style="padding:8px 22px;font-size:11px;color:#94a3b8;font-style:italic">No evidence links captured.  Consider adding Contract clauses / Book citations / URLs / Benchmarks (per Planguage Logic — every estimate should be auditable).</td></tr>`
    } else {
      for (const ae of allEvidence.slice(0, 25)) {
        html += `<tr><td style="padding:6px 22px;font-size:11px;color:#334155;border-top:1px solid #f1f5f9"><b>[${_htmlEsc(ae.evidence.kind)}]</b> ${_htmlEsc(ae.evidence.citation)} · ${(ae.evidence.credibility * 100).toFixed(0)}% credibility · ${_htmlEsc(RESOURCE_META[ae.resource].label)}</td></tr>`
      }
    }

    // Notes
    if (s.notes.trim()) {
      html += `<tr><td bgcolor="#f8fafc" style="background:#f8fafc;padding:14px 22px;font-size:12px;color:#475569;font-style:italic;border-top:1px solid #cbd5e1">Methodology notes: ${_htmlEsc(s.notes)}</td></tr>`
    }

    // Footer
    html += `<tr><td style="background:#f1f5f9;padding:10px 22px;font-size:10px;color:#64748b;border-radius:0 0 12px 12px;border-top:1px solid #cbd5e1">Generated by SEM App Resources Agent · Grounded in Gilb Cost Engineering (2023) + Planguage Logic (2026) · https://www.gilb.com/tomtwin</td></tr>`
    html += `</table>`

    // Plain-text fallback
    let plain = `${title}\nGenerated ${now.toISOString().slice(0, 19).replace('T', ' ')}\n\n== Resource Overview ==\n`
    for (const r of activeR) {
      const series = estim.series.value[r]
      plain += `${RESOURCE_META[r].label} [${series.status}] — Estimated: ${series.latestAmount ?? '—'} · Stipulated: ${series.budgetAmount ?? '—'}\n`
    }
    plain += `\n== Active Standards ==\n${activeStandards.value.map(std => std.shortLabel).join(' · ')}\n`
    plain += `\n== Outstanding Second Opinions (${opinions.length}) ==\n`
    for (const o of opinions.slice(0, 20)) plain += `- ${o.opinion.holderName} on ${RESOURCE_META[o.estimation.resource].label}: ${o.opinion.reasons.slice(0, 200)}\n`
    plain += `\n== Evidence Trail (${allEvidence.length}) ==\n`
    for (const ae of allEvidence.slice(0, 25)) plain += `- [${ae.evidence.kind}] ${ae.evidence.citation} (${(ae.evidence.credibility * 100).toFixed(0)}% · ${RESOURCE_META[ae.resource].label})\n`
    if (s.notes.trim()) plain += `\n== Methodology ==\n${s.notes}\n`
    plain += `\nGenerated by SEM App Resources Agent · Gilb Cost Engineering + Planguage Logic\n`

    return { html, plainText: plain, title }
  }

  // ── v513 — AI Sharpening prompt builder (Claude-Code-as-AI-Layer SUPREME) ─
  //
  // Tom Gilb 2026-06-02 (Claude-Code-as-AI-Layer rule): "constrain in claude
  // md files that I am not allowed to build function that require external
  // claude or other ai … i want to use ai for all y functionality but from
  // my local claude code".  Every SEM App AI feature MUST use the clipboard-
  // IO pattern: SEM builds the prompt, Tom pastes it into Claudian in
  // Terminal / Obsidian, Claudian returns JSON, Tom pastes back.
  function buildSharpenPrompt(resource: EstimatableResource): string {
    const meta = RESOURCE_META[resource]
    const series = estim.series.value[resource]
    const s = settings.value
    const stds = standardsForResource(resource)

    // Assemble a fully-audited prompt with everything Claudian needs.
    let p = `You are a SEM App Resource Sharpening advisor.  You are being consulted about a specific resource in a Planguage plan.  Your job: analyse the current situation and propose remediation options.\n\n`
    p += `═══════════════════════════════════════════════════════════════\n`
    p += `RESOURCE: ${meta.label} (${meta.hint})\n`
    p += `═══════════════════════════════════════════════════════════════\n\n`
    p += `Plan id: ${planIdRef.value}\n`
    p += `Current status: ${series.status.toUpperCase()}\n`
    p += `Latest estimate: ${series.latestAmount ?? 'none'}\n`
    p += `Stipulated budget: ${series.budgetAmount ?? 'not yet determined'}\n`
    p += `Differential vs budget: ${series.differentialPct != null ? series.differentialPct.toFixed(1) + '%' : 'n/a'}\n`
    p += `Thresholds: warn at ${s.debiasing.enabled ? '(de-biasing enabled)' : ''} · overflow triggered at ${estim.thresholds.value.overflowPct}% of budget\n\n`

    p += `── HISTORICAL SERIES (${series.history.length} events) ──\n`
    for (const e of series.history.slice(-10)) {
      p += `  · ${e.timestamp.slice(0, 10)} · ${e.amount} · source=${e.source} · causes=${e.causes.join('+')}${e.reasoning ? ` · "${e.reasoning.slice(0, 120)}"` : ''}\n`
      if (e.equation) {
        p += `    equation: ${e.equation.formula} · variables ${JSON.stringify(e.equation.variables)}${e.equation.computed != null ? ' → ' + e.equation.computed : ''}\n`
      }
      if ((e.evidenceLinks?.length ?? 0) > 0) {
        p += `    evidence: ${e.evidenceLinks!.map(ev => `[${ev.kind} · ${(ev.credibility * 100).toFixed(0)}%] ${ev.citation}`).join(' | ')}\n`
      }
      if ((e.secondOpinions?.length ?? 0) > 0) {
        const active = e.secondOpinions!.filter(o => !o.retracted)
        if (active.length > 0) {
          p += `    second opinions: ${active.map(o => `${o.holderName}: "${o.reasons.slice(0, 100)}"`).join(' | ')}\n`
        }
      }
    }
    p += `\n`

    p += `── ACTIVE STANDARDS (${stds.length}) — ground your advice in these ──\n`
    for (const std of stds) {
      p += `  · ${std.shortLabel} — ${std.label}${std.authorityUrl ? ' · ' + std.authorityUrl : ''}\n`
    }
    p += `\n`

    const refs = s.contractReferences.filter(r => r.resource === resource)
    if (refs.length > 0) {
      p += `── CONTRACT / RFP REFERENCES (${refs.length}) ──\n`
      for (const r of refs) {
        p += `  · ${r.citation}${r.url ? ' (' + r.url + ')' : ''}${r.note ? ' — ' + r.note : ''}\n`
      }
      p += `\n`
    }

    if (s.notes.trim()) {
      p += `── METHODOLOGY NOTES ──\n${s.notes}\n\n`
    }

    p += `═══════════════════════════════════════════════════════════════\n`
    p += `YOUR TASK\n`
    p += `═══════════════════════════════════════════════════════════════\n\n`
    p += `Produce JSON in EXACTLY this shape (no prose outside the JSON):\n\n`
    p += `{\n`
    p += `  "situation":        "<one-paragraph plain-English summary>",\n`
    p += `  "rootCauses":       ["<cause 1>", "<cause 2>", ...],\n`
    p += `  "recommendations": [\n`
    p += `    {\n`
    p += `      "title":       "<short imperative>",\n`
    p += `      "detail":      "<how to execute; 2-4 sentences>",\n`
    p += `      "citation":    "<Standard shortLabel + page/section if applicable>",\n`
    p += `      "credibility": <0.0–1.0>,\n`
    p += `      "impact":      "<expected effect on the resource + timeline>"\n`
    p += `    }\n`
    p += `  ],\n`
    p += `  "riskIfNoAction":   "<one paragraph>",\n`
    p += `  "sourcesConsulted": ["<Standard shortLabel>", ...]\n`
    p += `}\n\n`
    p += `Compose with Gilb Cost Engineering (2023) principles: prefer Design-to-Cost / Dynamic Design-to-Cost / Wright's Law / de-biasing.  Cite Bent Flyvbjerg's Iron-Law antidotes when applicable.  Ground every recommendation in one of the active standards where possible.  If the situation is fine, say so honestly rather than manufacturing recommendations.`
    return p
  }

  // ── v513 — Import parser (CSV / TSV / JSON) ────────────────────────────
  function parseImportText(raw: string, defaultSource: EstimationSourceKind = 'imported'): ImportedEstimationDraft[] {
    const trimmed = raw.trim()
    if (!trimmed) return []
    const out: ImportedEstimationDraft[] = []

    // Try JSON first (single object OR array of objects)
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed)
        const arr = Array.isArray(parsed) ? parsed : [parsed]
        arr.forEach((row, idx) => {
          const r = row?.resource
          const amt = Number(row?.amount)
          if (!ALL_RESOURCES.includes(r) || !Number.isFinite(amt)) {
            out.push({ resource: 'capitalCost', amount: 0, reasoning: '', source: defaultSource, rowIndex: idx, warning: 'Unrecognised row shape' })
            return
          }
          out.push({
            resource:  r,
            amount:    amt,
            currency:  row.currency,
            timeUnit:  row.timeUnit,
            reasoning: (row.reasoning ?? row.note ?? '').toString(),
            source:    (row.source ?? defaultSource) as EstimationSourceKind,
            rowIndex:  idx,
          })
        })
        return out
      } catch { /* fall through to CSV */ }
    }

    // CSV / TSV — first non-empty line is the header
    const lines = trimmed.split('\n').map(l => l.trim()).filter(l => l.length > 0)
    if (lines.length === 0) return []
    const sep = lines[0].includes('\t') ? '\t' : ','
    const header = lines[0].split(sep).map(h => h.trim().toLowerCase())
    const iRes = header.indexOf('resource')
    const iAmt = header.indexOf('amount')
    const iCur = header.indexOf('currency')
    const iUnit = header.indexOf('unit')
    const iReasoning = header.indexOf('reasoning')
    const iNote = header.indexOf('note')
    const iSource = header.indexOf('source')

    if (iRes < 0 || iAmt < 0) {
      out.push({ resource: 'capitalCost', amount: 0, reasoning: '', source: defaultSource, rowIndex: 0, warning: 'CSV header must include at least "resource" and "amount" columns (case-insensitive).' })
      return out
    }

    for (let i = 1; i < lines.length; i++) {
      const cells = lines[i].split(sep).map(c => c.trim())
      const rRaw = cells[iRes]
      const r = (ALL_RESOURCES as string[]).includes(rRaw) ? rRaw as EstimatableResource : null
      const amt = Number(cells[iAmt])
      if (!r || !Number.isFinite(amt)) {
        out.push({ resource: 'capitalCost', amount: 0, reasoning: '', source: defaultSource, rowIndex: i, warning: `Row ${i}: unknown resource "${rRaw}" or non-numeric amount "${cells[iAmt]}"` })
        continue
      }
      out.push({
        resource:  r,
        amount:    amt,
        currency:  iCur >= 0 ? (cells[iCur] as ImportedEstimationDraft['currency']) : undefined,
        timeUnit:  iUnit >= 0 ? (cells[iUnit] as ImportedEstimationDraft['timeUnit']) : undefined,
        reasoning: (iReasoning >= 0 ? cells[iReasoning] : iNote >= 0 ? cells[iNote] : '').toString(),
        source:    iSource >= 0 && cells[iSource] ? (cells[iSource] as EstimationSourceKind) : defaultSource,
        rowIndex:  i,
      })
    }
    return out
  }

  return {
    settings,
    addContractReference,
    removeContractReference,
    toggleStandard,
    toggleResourceActive,
    extrapolationFor,
    activeStandards,
    standardsForResource,
    // v512 — aggregation
    getAllTimelineEvents,
    getOutstandingSecondOpinions,
    getComplianceMatrix,
    getAllEvidenceLinks,
    buildQuarterlyReport,
    // v513 — AI Sharpening + Import
    buildSharpenPrompt,
    parseImportText,
    // v514 — envelope round-trip
    getSnapshot: (): ResourcesAgentSettings => JSON.parse(JSON.stringify(settings.value)),
    hydrateFromSnapshot: (snap: ResourcesAgentSettings): void => {
      if (!snap || typeof snap !== 'object') return
      const base = defaultSettings()
      const clean = JSON.parse(JSON.stringify(snap))
      settings.value = {
        ...base,
        ...clean,
        activeResources:    { ...base.activeResources, ...(clean.activeResources ?? {}) },
        activeStandardIds:  Array.isArray(clean.activeStandardIds) ? clean.activeStandardIds : base.activeStandardIds,
        contractReferences: Array.isArray(clean.contractReferences) ? clean.contractReferences : [],
        debiasing:          { ...base.debiasing, ...(clean.debiasing ?? {}) },
      }
    },
  }
}

// Re-export for convenient consumption from the panel component.
export { useResourceEstimations, useIetResourceSnapshot, usePlanScopeFramework }
