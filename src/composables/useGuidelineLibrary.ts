// UNIT_TYPE=Composable
/**
 * useGuidelineLibrary — Singleton store for the global SEM App Guidelines
 * Library (Phase 3.5).
 *
 * Tom Gilb 2026-06-20 verbatim greenlight: Q1=c (global SEM App library),
 * Q2=b (library-scoped + version-pinning), Q3=b (structured whereChecked +
 * optional free-text fallback).
 *
 * Persistence: localStorage keys `sem-app:guidelines:library:v1` (the
 * library itself) + `sem-app:guidelines:active-sets:v1` (per-contract
 * pinning).
 *
 * Pattern: mirrors useContractStore.ts (module-level singleton; load-on-
 * init; auto-persist on mutation).  All state is module-level so every
 * agent that imports this composable shares one source of truth.
 *
 * SEM-Recommended seed: on first load (empty library) we seed three
 * canonical Guidelines: (1) "Tom Gilb Planguage", (2) "Plain English
 * Contract Style", (3) "ISO 9001 Auditability".  These match the three
 * most-used legacy `standards` array values, so migration from the flat
 * Contracts Mode config is forward-compatible.
 *
 * Composes with: Architectural Resilience SUPREME (global library reachable
 * by every agent), No-Silent-Data-Loss SUPREME (rejected Rules stay in the
 * library with status='rejected'; deleted Guidelines move to a `_trash`
 * bucket banked for Phase 3.5B), Universal Undo SUPREME (version bumps
 * preserve history), Sources-of-Specs SUPREME (every Rule + every pin
 * carries provenance + date).
 */

import { ref, computed } from 'vue'
import type {
  Guideline,
  GuidelineRule,
  GuidelinePin,
  ContractGuidelineActiveSet,
  RuleSeverity,
  RuleStatus,
} from '../types/guidelines'
// r41 v468 — same durable dual-write pattern as useContractStore.ts
// (v465).  Guideline library also silently truncated by localStorage
// quota when the v462 + v463 Navy sets were added on top of the
// existing library (Tom's Storage Report at 21:27 UTC showed only 3
// pre-v462 sets even though v463 had already shipped); IDB removes
// that class of failure.  Same idbKv namespaced-store pattern.
import { idbGet, idbSet, idbSupported } from '../lib/idbKv'
// v474 — silent guideline-library saves no longer fail invisibly.  Route
// through the shared SaveFailureEvent broadcaster (guard: rate-limit +
// dismiss-quiet + durability-flag) so a quota-exceeded on a Save-to-Test-
// Contracts click surfaces the same durability-aware banner as contract
// saves.  Tom Gilb 2026-07-03 verbatim: "I believe I did press the button".
import { broadcastStorageFailure, noteIdbWriteSuccess } from './useContractStore'

// ── Storage keys ────────────────────────────────────────────────────────────

const LIB_KEY    = 'sem-app:guidelines:library:v1'
const PINS_KEY   = 'sem-app:guidelines:active-sets:v1'

// ── Helpers ─────────────────────────────────────────────────────────────────

function _now(): string { return new Date().toISOString() }
function _uuid(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)
}

function _loadLibrary(): Guideline[] {
  try {
    const raw = localStorage.getItem(LIB_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Guideline[]
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

// r41 v468 — DUAL-WRITE (same pattern as useContractStore.ts v465).
// IDB is the durable store (~50% of disk); localStorage stays for
// sync-bootstrap on next tab-open.  Fire-and-forget IDB write; sync
// localStorage write inline.  If localStorage quota fails, IDB still
// succeeds; on next load, the post-bootstrap IDB check restores.
async function _saveLibraryToIdb(lib: Guideline[]): Promise<void> {
  if (!idbSupported()) return
  try {
    await idbSet(LIB_KEY, lib)
    // v474 — contribute to the shared origin-level IDB health signal
    // so subsequent localStorage-only failures are marked durable=true.
    noteIdbWriteSuccess()
  } catch (err) {
    console.error('[useGuidelineLibrary] IDB save failed (localStorage still tried):', err)
  }
}
function _saveLibrary(lib: Guideline[]): void {
  void _saveLibraryToIdb(lib)
  try {
    localStorage.setItem(LIB_KEY, JSON.stringify(lib))
  } catch (err) {
    const errName = (err as Error)?.name ?? '(unknown)'
    const errMsg  = (err as Error)?.message ?? String(err)
    const isQuota = errName === 'QuotaExceededError' || errName.includes('Quota')
    const bytes   = (() => { try { return JSON.stringify(lib).length } catch { return 0 } })()
    console.error(
      '[useGuidelineLibrary] localStorage save FAILED (IDB may still have succeeded).',
      'Library sets:', lib.length, 'Total serialised size:', bytes, 'bytes.',
      '\nError name:', errName,
      '\nError:', err,
    )
    // v474 — route through the shared SaveFailureEvent broadcaster.  If
    // the guard-guarded emit is suppressed (rate-limit, dismiss-quiet,
    // etc), the console.error above is the audit trail.  If it emits,
    // ContractHub renders the durability-aware banner — informational
    // slate-grey when IDB is healthy, red alarm when both layers failed.
    broadcastStorageFailure({
      reason:         isQuota ? 'quota-exceeded' : 'unknown',
      contractsCount: lib.length,        // repurposed as "item count" for library saves
      totalBytes:     bytes,
      attemptedPrune: false,             // no prune for library — user manages test files manually
      pruneSucceeded: false,
      errorMessage:   errMsg,
      source:         'guideline-library',
    })
  }
}

function _loadActiveSets(): ContractGuidelineActiveSet[] {
  try {
    const raw = localStorage.getItem(PINS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ContractGuidelineActiveSet[]
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

function _saveActiveSets(sets: ContractGuidelineActiveSet[]): void {
  try { localStorage.setItem(PINS_KEY, JSON.stringify(sets)) } catch { /* */ }
}

// ── SEM-Recommended seed Guidelines ────────────────────────────────────────

/** First-load seed: three canonical Guidelines covering the three most-used
 *  legacy `standards` config values (gilb-planguage, plain-english, iso-9001).
 *  Forward-compatible migration from Contracts Mode `standards: string[]`. */
function _semRecommendedSeed(): Guideline[] {
  const today = _now()
  return [
    {
      id:          _uuid(),
      tag:         'Tom Gilb Planguage',
      title:       'Tom Gilb Planguage Methodology',
      version:     1,
      source:      'SEM Curated · Tom Gilb · Competitive Engineering (2005) · ASPECTS (2026) · 65 books on Tom Gilb Consultant Twin',
      date:        today,
      description: 'The canonical Planguage methodology — every spec carries a Scale and at least one future required state (Tolerable and/or Wish/Goal/Stretch). Meter is desirable but not initially required.',
      category:    'sem-curated',
      rules: [
        {
          id:           _uuid(),
          tag:          'Unambiguous',
          title:        'No vague intensifiers',
          justification: 'Vague terms ("promptly", "reasonable", "best efforts") cannot be objectively tested and lead to disputes. Tom Gilb 2026-06-20: ambiguity is the root of contract failure.',
          source:       'Tom Gilb · Competitive Engineering · Rule_Write_planguage-spec.md',
          date:         today,
          whereChecked: { entryTypes: ['F','V','C','R','S'], clauseKinds: ['obligation','remedy'], phases: ['phase-2-extract','phase-3-rewrite-review','sharpen'] },
          exceptions:   ['Recital clauses (boilerplate context)', 'Definitions sections that explicitly bound the term elsewhere'],
          howToCorrect: {
            auto:   'Replace vague intensifiers (promptly, reasonable, best efforts, timely manner) with a numeric scale + meter + target. Example: "promptly" → "within 15 minutes of receipt, measured by system timestamp".',
            manual: 'Identify the vague phrase; ask the obligated party what specific numeric threshold they commit to; rewrite using a Planguage Scale + Target.',
          },
          severity:     'high',
          status:       'active',
          version:      1,
          parentRuleId: null,
        },
        {
          id:           _uuid(),
          tag:          'Scale Present',
          title:        'Every Value entry has a defined Scale of Measure',
          justification: 'Tom Gilb 2026-06-20 verbatim: A Defined Scale of Measure is one of the two unconditional Planguage requirements. Without it, the spec cannot be measured.',
          source:       'Tom Gilb · Competitive Engineering Ch.5 · ASPECTS p.30 · rule_value_definition_identity.md SUPREME',
          date:         today,
          whereChecked: { entryTypes: ['V','R'], clauseKinds: ['obligation'], phases: ['phase-2-extract','sharpen','plan-health'] },
          exceptions:   ['Definitions clauses creating named scales themselves'],
          howToCorrect: {
            auto:   'Derive a Scale from the spec description (e.g. "delivery speed" → Scale: days from contract signing to delivery).',
            manual: 'Read the spec description; identify the dimension being measured; name its unit precisely.',
          },
          severity:     'critical',
          status:       'active',
          version:      1,
          parentRuleId: null,
        },
        {
          id:           _uuid(),
          tag:          'Future State Present',
          title:        'Every Value entry has at least one future required state',
          justification: 'Tom Gilb 2026-06-20 verbatim: at least one future required state — Scalar Constraint (Tolerable) AND/OR Target (Wish, Goal, Stretch) — is the second unconditional Planguage requirement.',
          source:       'Tom Gilb · Competitive Engineering Ch.4 · SUCCESS book § 2.1 · rule_value_definition_identity.md SUPREME',
          date:         today,
          whereChecked: { entryTypes: ['V','R'], clauseKinds: ['obligation'], phases: ['phase-2-extract','sharpen','plan-health'] },
          exceptions:   [],
          howToCorrect: {
            auto:   'Propose a Tolerable, Goal, or Wish derived from the spec description and any numeric anchors in the clause text.',
            manual: 'Ask the planner to commit to at least one future state — Tolerable (project-viability floor), Goal (committed promise), or Wish (uncommitted stakeholder dream).',
          },
          severity:     'critical',
          status:       'active',
          version:      1,
          parentRuleId: null,
        },
      ],
    },
    {
      id:          _uuid(),
      tag:         'Plain English',
      title:       'Plain English Contract Style',
      version:     1,
      source:      'SEM Curated · Plain English Foundation · Joseph Kimble (2006) Lifting the Fog of Legalese',
      date:        today,
      description: 'Modern, jargon-free contract drafting. Active voice. Short sentences. Defined terms used consistently.',
      category:    'sem-curated',
      rules: [
        {
          id:           _uuid(),
          tag:          'Active Voice',
          title:        'Prefer active over passive voice',
          justification: 'Active voice makes the actor and obligation explicit. Passive voice ("shall be delivered") hides WHO has the obligation, creating ambiguity about the obligated party.',
          source:       'Joseph Kimble · Lifting the Fog of Legalese (2006)',
          date:         today,
          whereChecked: { entryTypes: ['F','V','C','S'], clauseKinds: ['obligation'], phases: ['phase-3-rewrite-review'] },
          exceptions:   ['Where the actor is genuinely unknown or irrelevant'],
          howToCorrect: {
            auto:   'Rewrite passive constructions to active: identify the actor; place subject + verb + object.',
            manual: 'Find the obligated party; rewrite the obligation so they are the grammatical subject.',
          },
          severity:     'medium',
          status:       'active',
          version:      1,
          parentRuleId: null,
        },
        {
          id:           _uuid(),
          tag:          'No Archaic',
          title:        'No archaic legal phrasing',
          justification: 'Archaic terms (hereinabove, witnesseth, aforesaid) add no legal force and obscure meaning for non-lawyer readers.',
          source:       'Plain English Foundation · Modern Drafting Style Guide',
          date:         today,
          whereChecked: { entryTypes: ['F','V','C','R','S'], clauseKinds: ['obligation','recital'], phases: ['phase-3-rewrite-review'] },
          exceptions:   ['Quoted historical contract text where archaic phrasing is being preserved'],
          howToCorrect: {
            auto:   'Replace archaic terms with plain equivalents: hereinabove → above, witnesseth → states, aforesaid → above-mentioned.',
            manual: 'Identify archaic phrases; substitute modern equivalents that preserve the legal meaning.',
          },
          severity:     'low',
          status:       'active',
          version:      1,
          parentRuleId: null,
        },
      ],
    },
    {
      id:          _uuid(),
      tag:         'ISO 9001',
      title:       'ISO 9001 Quality Management Auditability',
      version:     1,
      source:      'SEM Curated · ISO 9001:2015 § 4 + § 8.5 traceability requirements',
      date:        today,
      description: 'Quality-management traceability: every obligation must be auditable, owned, and tied to a measurable evidence record.',
      category:    'sem-curated',
      rules: [
        {
          id:           _uuid(),
          tag:          'Auditable Trail',
          title:        'Every obligation references a measurable evidence artefact',
          justification: 'ISO 9001:2015 § 8.5.2 requires every controlled activity to leave an auditable trail. Obligations without a Meter or evidence reference are unauditable.',
          source:       'ISO 9001:2015 § 8.5.2',
          date:         today,
          whereChecked: { entryTypes: ['F','V'], clauseKinds: ['obligation'], phases: ['phase-2-extract','plan-health'] },
          exceptions:   ['Recital clauses (no controlled activity)'],
          howToCorrect: {
            auto:   'Propose a Meter naming the audit artefact (e.g. "third-party inspection report", "system log", "delivery receipt").',
            manual: 'Identify the audit evidence the obligation will be measured against; add it as the Meter.',
          },
          severity:     'medium',
          status:       'active',
          version:      1,
          parentRuleId: null,
        },
      ],
    },
    // r41 v463 (Tom Gilb 2026-07-02 verbatim *"maybe you can make a NAVY
    // Guidelines section for SEM"*) — SEM's first proper domain-specific
    // guideline section: 6 focused sets under category 'us-navy'.  Each
    // set covers ONE Navy-contracting concern (payment, deliverables,
    // authority, citations, funding, cybersecurity) with 2 rules each.
    // Every rule cites a Reachable-Now FAR / DFARS / MIL-STD / DoD-FMR
    // URL per Term + Definition + Source SUPREME (v460).  Audience: Navy
    // contracting officer / KO / COR / PACRM PMO reviewer / Vice Admiral.
    //
    // Ports directly to Kai's industrial Twin as a domain-section pattern:
    // Aerospace, Medical Device, EU Procurement, ITAR, etc. can each be
    // authored as their own category with focused sets.
    ..._navyGuidelinesSeed(today),
  ]
}

/** r41 v463 — Navy Guidelines section factory.  Returns 6 focused sets
 *  under `category: 'us-navy'`, each with 2 rules, each rule Source
 *  citing a public URL. */
function _navyGuidelinesSeed(today: string): Guideline[] {
  return [
    // ── Set 1 · Navy WAWF + Payment Discipline ─────────────────────────
    {
      id:          _uuid(),
      tag:         'Navy · WAWF + Payment',
      title:       'Navy · WAWF Payment Requests + Receiving Reports Discipline',
      version:     1,
      source:      'DFARS 252.232-7003 · DFARS PGI 232.7002 · Wide Area Workflow (WAWF) system',
      date:        today,
      description: 'Payment requests + receiving reports must be electronically submitted via Wide Area Workflow (WAWF) with specific DoD data elements. Missing electronic-channel or DoDAAC data delays payment + creates contract disputes.',
      category:    'us-navy',
      rules: [
        {
          id:           _uuid(),
          tag:          'WAWF Payment Format',
          title:        'Payment requests must specify WAWF (or authorized equivalent) as the electronic submission channel',
          justification: 'DFARS 252.232-7003 requires all DoD payment requests + receiving reports to be submitted electronically via Wide Area Workflow (WAWF) or a specifically authorized alternative.  A contract without a named electronic-payment channel is non-compliant on receipt.',
          source:       'DFARS 252.232-7003 · https://www.acquisition.gov/dfars/252.232-7003-electronic-submission-payment-requests-and-receiving-reports',
          date:         today,
          whereChecked: { entryTypes: ['F','C'], clauseKinds: ['obligation'], phases: ['phase-2-extract','phase-3-rewrite-review','sharpen'] },
          exceptions:   ['Contracts explicitly exempted under DFARS 232.7002(a)', 'Contracts below the Micro-Purchase Threshold'],
          howToCorrect: {
            auto:   'Add an explicit constraint citing DFARS 252.232-7003 and naming WAWF as the required submission system, with the Contractor CAGE code + Pay Official DoDAAC.',
            manual: 'Verify with the Contracting Officer which WAWF role assignments apply (Inspector, Acceptor, LPO, Pay Official) + add them as named Stakeholders with DoDAACs.',
          },
          severity:     'critical',
          status:       'active',
          version:      1,
          parentRuleId: null,
        },
        {
          id:           _uuid(),
          tag:          'Receiving Report Format',
          title:        'Receiving Report data elements match DFARS PGI 232.7002 (CAGE + DoDAAC + Contract # + ACRN + CLIN + Qty + Unit Price + Inspection Point)',
          justification: 'DFARS PGI 232.7002 + DFARS 252.232-7003(b) require the electronic receiving report to carry specific data elements.  Missing elements delay payment and create disputes.',
          source:       'DFARS PGI 232.7002 · DFARS 252.232-7003(b) · https://www.acquisition.gov/dfars/pgi/232.7002-electronic-payment-requests-and-receiving-reports',
          date:         today,
          whereChecked: { entryTypes: ['F','C'], clauseKinds: ['obligation'], phases: ['phase-2-extract','sharpen'] },
          exceptions:   ['Services-only contracts using invoice-only WAWF flow'],
          howToCorrect: {
            auto:   'Add a Function entry with Presence Test enumerating the required data elements (CAGE + DoDAAC + Contract # + ACRN + CLIN + Qty + Unit Price + Inspection Point).',
            manual: 'Cross-check with the Contracting Officer that the Inspection + Acceptance DoDAACs are correct + reachable.',
          },
          severity:     'critical',
          status:       'active',
          version:      1,
          parentRuleId: null,
        },
      ],
    },

    // ── Set 2 · Navy CDRL + DID Discipline ────────────────────────────
    {
      id:          _uuid(),
      tag:         'Navy · CDRL + DID',
      title:       'Navy · Contract Data Requirements List (CDRL) + Data Item Description (DID) Discipline',
      version:     1,
      source:      'MIL-STD-963C · DD Form 1423 · DoD Data Item Description Portal',
      date:        today,
      description: 'Every formal deliverable must appear on a CDRL (DD Form 1423) entry backed by a valid Data Item Description (DID). Missing CDRL/DID linkage makes deliverables unenforceable + fails audit.',
      category:    'us-navy',
      rules: [
        {
          id:           _uuid(),
          tag:          'CDRL DID Citation',
          title:        'Every formal deliverable cites a CDRL entry (DD Form 1423) backed by a valid Data Item Description (DID)',
          justification: 'MIL-STD-963C + DD Form 1423 require every data deliverable to be listed on a CDRL entry that cites a specific approved DID (or notes "TDP-only" if no DID applies).  Absent CDRL/DID linkage, deliverables are unenforceable + auditors flag the contract.',
          source:       'MIL-STD-963C · DoD Data Item Description Portal · https://quicksearch.dla.mil/qsSearch.aspx',
          date:         today,
          whereChecked: { entryTypes: ['F','Task'], clauseKinds: ['obligation'], phases: ['phase-2-extract','phase-3-rewrite-review'] },
          exceptions:   ['Deliverables covered by a Statement of Work paragraph rather than a CDRL entry (rare)'],
          howToCorrect: {
            auto:   'Add a Task entry naming the CDRL Sequence Number (Aoxx) + the referenced DID (DI-xxxx-xxxxx) + delivery frequency.',
            manual: 'Request the CDRL/DID matrix from the requiring activity; verify each deliverable maps to an approved DID before contract award.',
          },
          severity:     'high',
          status:       'active',
          version:      1,
          parentRuleId: null,
        },
        {
          id:           _uuid(),
          tag:          'DD Form 1423 Complete',
          title:        'CDRL DD Form 1423 blocks are complete + accurate (blocks 1-16 with correct format, frequency, distribution, DoDAAC)',
          justification: 'MIL-STD-963C § 4.3 + DD Form 1423 instructions require every CDRL entry to populate 16 blocks: Sequence #, Title, Subtitle, Authority, Technical Point of Contact, Requiring Office, Distribution Statement, Distribution + Frequency, Format, Data Item Description Number, Contract Reference, Government Approval, Government Distribution DoDAAC, Address, Remarks.  Blank blocks create ambiguity and delay reviews.',
          source:       'MIL-STD-963C § 4.3 · DD Form 1423-1 Instructions · https://quicksearch.dla.mil/qsSearch.aspx',
          date:         today,
          whereChecked: { entryTypes: ['Task','C'], clauseKinds: ['obligation'], phases: ['phase-3-rewrite-review','sharpen'] },
          exceptions:   ['DD Form 1423-2 (Continuation Sheet) entries inheriting parent blocks'],
          howToCorrect: {
            auto:   'Enumerate the 16 CDRL blocks as sub-fields on the deliverable Task entry so completeness is checkable at a glance.',
            manual: 'Coordinate with the Technical Point of Contact + Requiring Office to fill any blank blocks before contract award.',
          },
          severity:     'medium',
          status:       'active',
          version:      1,
          parentRuleId: null,
        },
      ],
    },

    // ── Set 3 · Navy KO + COR Authority ────────────────────────────────
    {
      id:          _uuid(),
      tag:         'Navy · KO + COR Authority',
      title:       'Navy · Contracting Officer (KO) + Contracting Officer Representative (COR) Authority Discipline',
      version:     1,
      source:      'FAR 1.602-1 · FAR 1.602-3 · FAR 1.604',
      date:        today,
      description: 'Exclusive contracting authority vests in the KO; COR designations must be in writing. Unauthorized commitments require ratification or Termination for Convenience.',
      category:    'us-navy',
      rules: [
        {
          id:           _uuid(),
          tag:          'KO and COR Named',
          title:        'Contracting Officer is named + COR designation is referenced (or explicitly deferred to post-award)',
          justification: 'FAR 1.602-1 vests exclusive contracting authority in the Contracting Officer; FAR 1.604 requires COR designations to be in writing.  Contracts without a named KO + a written COR designation path are unenforceable at the operational level.',
          source:       'FAR 1.602-1 · FAR 1.604 · https://www.acquisition.gov/far/1.602-1 · https://www.acquisition.gov/far/1.604',
          date:         today,
          whereChecked: { entryTypes: ['S'], clauseKinds: ['obligation','remedy'], phases: ['phase-2-extract','sharpen'] },
          exceptions:   ['Solicitations pre-award (KO named but COR deferred to post-award designation letter)'],
          howToCorrect: {
            auto:   'Add a Stakeholder entry for the Contracting Officer with name + office code + email + phone.  Add a companion Stakeholder for COR designation citing the post-award designation-letter path.',
            manual: 'Obtain the KO nomination letter + PCO delegation memo before contract award; verify COR appointment is in writing within 30 days of award.',
          },
          severity:     'critical',
          status:       'active',
          version:      1,
          parentRuleId: null,
        },
        {
          id:           _uuid(),
          tag:          'Unauthorized Commitment Path',
          title:        'Every clause anticipating field-level direction cites a ratification path per FAR 1.602-3',
          justification: 'FAR 1.602-3 provides for ratification of an unauthorized commitment made by an official without contracting authority.  Absent an explicit ratification path, government personnel making informal directions expose the contract to voidability and the Government to unenforceable claims.',
          source:       'FAR 1.602-3 · https://www.acquisition.gov/far/1.602-3',
          date:         today,
          whereChecked: { entryTypes: ['C','S'], clauseKinds: ['remedy'], phases: ['phase-3-rewrite-review','sharpen'] },
          exceptions:   ['Fixed-price contracts with no anticipated field-level Government direction'],
          howToCorrect: {
            auto:   'Add a Constraint entry naming FAR 1.602-3 + the ratifying official (typically the Head of the Contracting Activity or delegated Chief of the Contracting Office) as the authority path for any field-level unauthorized commitment.',
            manual: 'Include a specific Notification-of-Unauthorized-Commitment reporting clause + escalation path to the Contracting Officer.',
          },
          severity:     'high',
          status:       'active',
          version:      1,
          parentRuleId: null,
        },
      ],
    },

    // ── Set 4 · Navy FAR/DFARS Citation Discipline ────────────────────
    {
      id:          _uuid(),
      tag:         'Navy · FAR + DFARS Citations',
      title:       'Navy · FAR + DFARS Citation Discipline',
      version:     1,
      source:      'FAR 52.301 · DFARS 252 Matrix',
      date:        today,
      description: 'Every incorporated clause must be cited by specific section + effective date. Bare references to "the FAR" or "applicable regulations" are not enforceable.',
      category:    'us-navy',
      rules: [
        {
          id:           _uuid(),
          tag:          'FAR/DFARS Citation Complete',
          title:        'Every incorporated FAR / DFARS clause is cited by its specific section number + effective date',
          justification: 'FAR 52.301 (Provisions and Clauses Matrix) requires clauses to be cited by specific number (e.g. FAR 52.212-4 (JAN 2024), DFARS 252.204-7012 (DEC 2023)).  Bare references to "the FAR" or "applicable regulations" are not enforceable.',
          source:       'FAR 52.301 · https://www.acquisition.gov/far/52.301',
          date:         today,
          whereChecked: { entryTypes: ['C'], clauseKinds: ['obligation'], phases: ['phase-2-extract','sharpen'] },
          exceptions:   ['General references in recital clauses (not operative)'],
          howToCorrect: {
            auto:   'Replace bare "FAR / DFARS" references with the specific clause number + parenthetical effective date + short title.',
            manual: 'Cross-check the FAR/DFARS Matrix on acquisition.gov; verify the cited effective date matches the applicable version.',
          },
          severity:     'high',
          status:       'active',
          version:      1,
          parentRuleId: null,
        },
        {
          id:           _uuid(),
          tag:          'Clause Fill-in Values',
          title:        'Every FAR / DFARS clause with a fill-in has its fill-in values explicitly stated',
          justification: 'Many FAR / DFARS clauses (e.g. FAR 52.204-7 System for Award Management, FAR 52.212-3 Offeror Representations) require Contractor + Contracting Officer to fill in specific values.  A clause incorporated by reference without its fill-ins is defective and creates dispute risk at first payment.',
          source:       'FAR Part 52 Subpart 52.1 · https://www.acquisition.gov/far/part-52',
          date:         today,
          whereChecked: { entryTypes: ['C'], clauseKinds: ['obligation'], phases: ['phase-3-rewrite-review','sharpen'] },
          exceptions:   ['Clauses that Contractor fills at proposal + KO accepts by award (not pre-award review scope)'],
          howToCorrect: {
            auto:   'Enumerate the fill-in blocks the incorporated clause requires + add sub-fields for each.',
            manual: 'Cross-check every incorporated clause against FAR Part 52 Subpart 52.1 fill-in matrix; solicit values from the Contractor pre-award.',
          },
          severity:     'medium',
          status:       'active',
          version:      1,
          parentRuleId: null,
        },
      ],
    },

    // ── Set 5 · Navy Funds + Line of Accounting ───────────────────────
    {
      id:          _uuid(),
      tag:         'Navy · Funds + LOA',
      title:       'Navy · Funds Citation + Line of Accounting (LOA) Discipline',
      version:     1,
      source:      'DoD FMR Vol 10 Ch 8 · DFARS PGI 204.7107 · Antideficiency Act (31 U.S.C. § 1341)',
      date:        today,
      description: 'Every funding citation carries ACRN + full LOA. Fiscal-Law compliance (Purpose · Time · Amount) enforced per DoD FMR to avoid Antideficiency Act violations.',
      category:    'us-navy',
      rules: [
        {
          id:           _uuid(),
          tag:          'Line of Accounting Format',
          title:        'Funding citations include ACRN + full Line of Accounting (LOA) per DoD FMR discipline',
          justification: 'DoD FMR Vol 10 Ch 8 + DFARS PGI 204.7107 require every funding citation to carry an Accounting Classification Reference Number (ACRN) tied to a full Line of Accounting.  ACRN-only citations without LOA cannot be paid.',
          source:       'DoD FMR Vol 10 Ch 8 · DFARS PGI 204.7107 · https://comptroller.defense.gov/FMR/current/10/10_08.pdf',
          date:         today,
          whereChecked: { entryTypes: ['C','R'], clauseKinds: ['obligation'], phases: ['phase-2-extract','sharpen'] },
          exceptions:   ['Unfunded IDIQ contracts where funding is added by task-order modification'],
          howToCorrect: {
            auto:   'Add a Resource entry naming the ACRN (2-char) + the full LOA fields (Appropriation, Fiscal Year, Object Class, BCN, SA, BFY, Amount).',
            manual: 'Coordinate with the Funds Certifying Official for the LOA + verify Fiscal-Law compliance (Purpose · Time · Amount) before award.',
          },
          severity:     'high',
          status:       'active',
          version:      1,
          parentRuleId: null,
        },
        {
          id:           _uuid(),
          tag:          'Antideficiency Act Compliance',
          title:        'No obligation exceeds available funds + no obligation crosses appropriation Fiscal Year without proper authority',
          justification: 'Antideficiency Act (31 U.S.C. § 1341) prohibits obligating in excess of appropriated funds + crossing Fiscal Years without a multi-year or no-year appropriation.  Violations carry personal criminal liability for the obligating official.  Every Navy contract must be audit-provably compliant.',
          source:       '31 U.S.C. § 1341 · DoD FMR Vol 14 Ch 2 · https://www.law.cornell.edu/uscode/text/31/1341',
          date:         today,
          whereChecked: { entryTypes: ['C','R'], clauseKinds: ['obligation'], phases: ['phase-3-rewrite-review','sharpen'] },
          exceptions:   ['Cost-reimbursement contracts with a Limitation-of-Funds clause (FAR 52.232-22)'],
          howToCorrect: {
            auto:   'Add a Constraint entry naming the appropriation ceiling + FY boundary; flag any obligation extending beyond as a required multi-year or no-year appropriation authority.',
            manual: 'Verify with the Funds Certifying Official + Program Office that Purpose (correct appropriation) + Time (correct FY) + Amount (within ceiling) all align.  Cite the specific appropriations act.',
          },
          severity:     'critical',
          status:       'active',
          version:      1,
          parentRuleId: null,
        },
      ],
    },

    // ── Set 6 · Navy Cybersecurity + CUI ──────────────────────────────
    {
      id:          _uuid(),
      tag:         'Navy · Cybersecurity + CUI',
      title:       'Navy · Cybersecurity + Controlled Unclassified Information (CUI) Discipline',
      version:     1,
      source:      'DFARS 252.204-7012 · NIST SP 800-171 · DFARS 252.204-7021 (CMMC) · DoDI 5200.48',
      date:        today,
      description: 'Contractors handling Covered Defense Information (CDI) or CUI must safeguard per NIST SP 800-171 + report cyber incidents per DFARS 252.204-7012 + hold appropriate CMMC certification per DFARS 252.204-7021.',
      category:    'us-navy',
      rules: [
        {
          id:           _uuid(),
          tag:          'CUI Handling Compliance',
          title:        'CUI is marked + safeguarded per DFARS 252.204-7012 + NIST SP 800-171',
          justification: 'DFARS 252.204-7012 requires Contractors handling Covered Defense Information (CDI) to implement NIST SP 800-171 security controls + report cyber incidents to DoD within 72 hours.  Contracts without a CUI-handling clause expose CDI to unauthorized disclosure.',
          source:       'DFARS 252.204-7012 · NIST SP 800-171 · DoDI 5200.48 · https://www.acquisition.gov/dfars/252.204-7012-safeguarding-covered-defense-information-and-cyber-incident-reporting',
          date:         today,
          whereChecked: { entryTypes: ['C','F'], clauseKinds: ['obligation'], phases: ['phase-2-extract','sharpen'] },
          exceptions:   ['Contracts whose scope contains no CDI as determined by the Requiring Activity (documented in the SF-1449 or equivalent)'],
          howToCorrect: {
            auto:   'Add a Constraint entry citing DFARS 252.204-7012 + a Function entry with Presence Test on NIST SP 800-171 controls implementation + 72-hour cyber-incident reporting to https://dibnet.dod.mil.',
            manual: 'Coordinate with the DoD CIO Office + Requiring Activity to identify CDI scope; verify Contractor NIST SP 800-171 self-assessment posted in Supplier Performance Risk System (SPRS).',
          },
          severity:     'critical',
          status:       'active',
          version:      1,
          parentRuleId: null,
        },
        {
          id:           _uuid(),
          tag:          'CMMC Certification Level',
          title:        'Contractor holds a CMMC certification at the level required for the contract',
          justification: 'DFARS 252.204-7021 (Cybersecurity Maturity Model Certification) requires Contractors handling FCI (Level 1) or CUI (Level 2 or 3) to hold a valid CMMC certification prior to contract award.  Absent a CMMC-level requirement, the Government cannot enforce the safeguarding baseline.',
          source:       'DFARS 252.204-7021 · CMMC Program Rule 32 CFR Part 170 · https://dodcio.defense.gov/CMMC/',
          date:         today,
          whereChecked: { entryTypes: ['C','S'], clauseKinds: ['obligation'], phases: ['phase-2-extract','sharpen'] },
          exceptions:   ['Contracts explicitly scoped as COTS-only per FAR 12.505 with no CUI'],
          howToCorrect: {
            auto:   'Add a Constraint entry naming the required CMMC Level (1 · 2 · 3) + a Stakeholder entry for the Contractor CISO / Cybersecurity POC.',
            manual: 'Coordinate with the Requiring Activity to determine the CMMC level applicable; verify Contractor certification in the CMMC accreditation database prior to award.',
          },
          severity:     'critical',
          status:       'active',
          version:      1,
          parentRuleId: null,
        },
      ],
    },
  ]
}

// ── Singleton state ────────────────────────────────────────────────────────

const _library    = ref<Guideline[]>(_loadLibrary())
const _activeSets = ref<ContractGuidelineActiveSet[]>(_loadActiveSets())

// First-load seed: if the library is empty, seed the SEM-recommended set.
if (_library.value.length === 0) {
  _library.value = _semRecommendedSeed()
  _saveLibrary(_library.value)
} else {
  // r41 v463 (Tom Gilb 2026-07-02 verbatim *"maybe you can make a NAVY
  // Guidelines section for SEM"*) — non-destructive upsert PLUS a
  // one-shot migration: replace the deprecated v462 omnibus "US
  // Federal Navy Solicitation" set with the 6 focused Navy sets under
  // category 'us-navy'.  Composes with:
  //   • No-Silent-Data-Loss SUPREME (user-authored + user-edited
  //     guideline sets are NEVER overwritten — upsert is by TAG only;
  //     migration only touches the v462 seed we know we shipped)
  //   • No-Silent-Removal SUPREME (migration console.info-logs the
  //     replacement so nothing is silently removed)
  //   • Term + Definition + Source SUPREME (v460)
  //   • Audience-Declaration (Navy KO / COR / Vice Admiral)

  // Migration step 1 — remove the deprecated v462 omnibus set.
  const V462_DEPRECATED_TAG = 'US Federal Navy Solicitation'
  const hadOmnibus = _library.value.some(g => g.tag === V462_DEPRECATED_TAG)
  if (hadOmnibus) {
    _library.value = _library.value.filter(g => g.tag !== V462_DEPRECATED_TAG)
    console.info(`[useGuidelineLibrary] Migrated: removed deprecated v462 omnibus set "${V462_DEPRECATED_TAG}" — replaced by 6 focused Navy sets under category 'us-navy' (v463).`)
  }

  // Step 2 — upsert every seed set whose tag is not in the library.
  const existingTags = new Set(_library.value.map(g => g.tag))
  const missing = _semRecommendedSeed().filter(g => !existingTags.has(g.tag))
  if (missing.length > 0) {
    _library.value = [..._library.value, ...missing]
    _saveLibrary(_library.value)
    console.info(`[useGuidelineLibrary] Upserted ${missing.length} missing seed set(s): ${missing.map(g => g.tag).join(', ')}`)
  } else if (hadOmnibus) {
    // No new seeds but we did a migration — persist the removal.
    _saveLibrary(_library.value)
  }
}

// r41 v468 (Tom Gilb 2026-07-03 "I could not see any NAVY when I looked
// at the list") — post-bootstrap IDB check.  If IDB has authoritative
// library data with MORE sets than the sync localStorage bootstrap,
// prefer IDB.  This is the durable fail-safe: even if localStorage was
// truncated by a prior QuotaExceededError (which was the plausible
// cause of Tom's missing Navy sets at 21:27 UTC), IDB has the full
// library.  Also seeds any missing Navy sets that never landed in
// localStorage due to quota.
;(async () => {
  if (!idbSupported()) return
  try {
    const idbData = await idbGet<Guideline[]>(LIB_KEY)
    if (Array.isArray(idbData) && idbData.length > _library.value.length) {
      console.info(`[useGuidelineLibrary] IDB has ${idbData.length} guideline sets vs localStorage's ${_library.value.length}.  Preferring IDB (localStorage likely truncated by quota).`)
      _library.value = idbData
      // Re-run the seed check now that IDB data is loaded, in case NEW
      // seeds shipped after the IDB write.
      const tagsAfter = new Set(_library.value.map(g => g.tag))
      const missingAfter = _semRecommendedSeed().filter(g => !tagsAfter.has(g.tag))
      if (missingAfter.length > 0) {
        _library.value = [..._library.value, ...missingAfter]
        _saveLibrary(_library.value)
        console.info(`[useGuidelineLibrary] Post-IDB seed: added ${missingAfter.length} missing set(s): ${missingAfter.map(g => g.tag).join(', ')}`)
      }
    } else if (!Array.isArray(idbData) || idbData.length === 0) {
      // IDB empty → first v468 run → seed IDB with current localStorage state.
      if (_library.value.length > 0) {
        await idbSet(LIB_KEY, _library.value)
        console.info(`[useGuidelineLibrary] MIGRATION: seeded IDB with ${_library.value.length} guideline set(s) from localStorage.`)
      }
    }
  } catch (err) {
    console.error('[useGuidelineLibrary] Post-bootstrap IDB check failed:', err)
  }
})()

// ── Public API ─────────────────────────────────────────────────────────────

export function useGuidelineLibrary() {
  // ── Library mutators ─────────────────────────────────────────────────────

  function addGuideline(g: Omit<Guideline, 'id' | 'date'>): Guideline {
    const guideline: Guideline = { ...g, id: _uuid(), date: _now() }
    _library.value = [..._library.value, guideline]
    _saveLibrary(_library.value)
    return guideline
  }

  function updateGuideline(id: string, patch: Partial<Omit<Guideline, 'id'>>): void {
    _library.value = _library.value.map(g => g.id === id ? { ...g, ...patch, date: _now() } : g)
    _saveLibrary(_library.value)
  }

  /** Bumps the Guideline's version + date.  Does NOT touch its Rules. */
  function bumpGuidelineVersion(id: string): void {
    _library.value = _library.value.map(g => g.id === id ? { ...g, version: g.version + 1, date: _now() } : g)
    _saveLibrary(_library.value)
  }

  // ── Rule mutators ────────────────────────────────────────────────────────

  function addRule(guidelineId: string, r: Omit<GuidelineRule, 'id' | 'version' | 'parentRuleId' | 'date'>): GuidelineRule {
    const rule: GuidelineRule = { ...r, id: _uuid(), version: 1, parentRuleId: null, date: _now() }
    _library.value = _library.value.map(g => g.id === guidelineId ? { ...g, rules: [...g.rules, rule] } : g)
    _saveLibrary(_library.value)
    return rule
  }

  /** Edit a Rule.  Forks the prior version (saved with status='edited' and
   *  the new rule's parentRuleId pointing to it) and creates the new
   *  active Rule with version + 1.  Universal Undo SUPREME — history
   *  preserved. */
  function editRule(guidelineId: string, ruleId: string, patch: Partial<Omit<GuidelineRule, 'id' | 'version' | 'parentRuleId' | 'date' | 'status'>>): GuidelineRule | null {
    const g = _library.value.find(x => x.id === guidelineId)
    if (!g) return null
    const prior = g.rules.find(r => r.id === ruleId)
    if (!prior) return null
    const forked: GuidelineRule = { ...prior, status: 'edited' as RuleStatus }
    const next: GuidelineRule = {
      ...prior,
      ...patch,
      id:           _uuid(),
      version:      prior.version + 1,
      parentRuleId: prior.id,
      status:       'active',
      date:         _now(),
    }
    _library.value = _library.value.map(x => x.id === guidelineId
      ? { ...x, rules: x.rules.map(r => r.id === ruleId ? forked : r).concat([next]) }
      : x
    )
    _saveLibrary(_library.value)
    return next
  }

  function rejectRule(guidelineId: string, ruleId: string): void {
    _library.value = _library.value.map(g => g.id === guidelineId
      ? { ...g, rules: g.rules.map(r => r.id === ruleId ? { ...r, status: 'rejected' as RuleStatus } : r) }
      : g
    )
    _saveLibrary(_library.value)
  }

  function reactivateRule(guidelineId: string, ruleId: string): void {
    _library.value = _library.value.map(g => g.id === guidelineId
      ? { ...g, rules: g.rules.map(r => r.id === ruleId ? { ...r, status: 'active' as RuleStatus } : r) }
      : g
    )
    _saveLibrary(_library.value)
  }

  // ── Per-contract pinning ────────────────────────────────────────────────

  function activeSetFor(contractId: string): ContractGuidelineActiveSet | null {
    return _activeSets.value.find(s => s.contractId === contractId) ?? null
  }

  function setActivePins(contractId: string, pins: GuidelinePin[]): void {
    const idx = _activeSets.value.findIndex(s => s.contractId === contractId)
    const next: ContractGuidelineActiveSet = { contractId, pins }
    if (idx >= 0) {
      const copy = [..._activeSets.value]
      copy[idx] = next
      _activeSets.value = copy
    } else {
      _activeSets.value = [..._activeSets.value, next]
    }
    _saveActiveSets(_activeSets.value)
  }

  function pinGuideline(contractId: string, guidelineId: string, version: number): void {
    const existing = activeSetFor(contractId)
    const pins = existing?.pins ?? []
    // Replace any prior pin for this guidelineId (move to new version).
    const filtered = pins.filter(p => p.guidelineId !== guidelineId)
    setActivePins(contractId, [...filtered, { guidelineId, version, pinnedAt: _now() }])
  }

  function unpinGuideline(contractId: string, guidelineId: string): void {
    const existing = activeSetFor(contractId)
    if (!existing) return
    setActivePins(contractId, existing.pins.filter(p => p.guidelineId !== guidelineId))
  }

  // ── Derived ──────────────────────────────────────────────────────────────

  /** All guidelines, in load order. */
  const allGuidelines = computed(() => _library.value)

  /** Active Rules across the planner's currently-pinned Guidelines for a
   *  given contract.  Useful for AI-prompt context + Plan Health Indicator
   *  scoring. */
  function activeRulesFor(contractId: string): GuidelineRule[] {
    const set = activeSetFor(contractId)
    if (!set) return []
    const out: GuidelineRule[] = []
    for (const pin of set.pins) {
      const g = _library.value.find(x => x.id === pin.guidelineId)
      if (!g) continue
      // Use the Rules at the pinned version snapshot (Phase 3.5B will add
      // proper version snapshotting; for now we use the live rules of the
      // guideline since the version snapshot ARE the rules in v1).
      for (const r of g.rules) {
        if (r.status === 'active') out.push(r)
      }
    }
    return out
  }

  // r41 2026-06-20 (Tom Gilb verbatim "Of course we need to be able to
  // export guidelines.....") — export as JSON.  Colorful HTML export
  // composes with the Colorful HTML Spec Email Rule SUPREME and is banked
  // for Phase 3.5B once the Rule render layout stabilises.  JSON export
  // is the universal lossless format — round-trippable into the same
  // library shape, importable by other SEM App instances or by Kai's
  // Twin.  Composes with: Sources-of-Specs SUPREME (every Guideline +
  // Rule carries Source + Date; exports preserve them), Architectural
  // Resilience SUPREME (JSON shape exactly matches the type definitions
  // in types/guidelines.ts so import is straightforward).

  /** Export ONE Guideline as a JSON blob.  Includes all Rules (active,
   *  rejected, and edited) so the import is lossless. */
  function exportGuidelineJson(guidelineId: string): { filename: string; json: string } | null {
    const g = _library.value.find(x => x.id === guidelineId)
    if (!g) return null
    const json = JSON.stringify(g, null, 2)
    const slug = g.tag.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()
    return { filename: `guideline-${slug}-v${g.version}.json`, json }
  }

  /** Export the ENTIRE library + per-contract pin map.  Useful for cross-
   *  device sync, backup, or sharing a planner's curated set. */
  function exportLibraryJson(): { filename: string; json: string } {
    const blob = {
      _format:    'sem-app-guidelines-library/v1',
      _exportedAt: _now(),
      library:    _library.value,
      activeSets: _activeSets.value,
    }
    const json = JSON.stringify(blob, null, 2)
    return { filename: `sem-app-guidelines-library-${new Date().toISOString().slice(0,10)}.json`, json }
  }

  /** Trigger a browser download for the given JSON payload.  Used by the
   *  GuidelineLibraryPanel + the active-guidelines bar export button.
   *  Pure DOM operation — no Vue component dependencies; ports cleanly to
   *  Kai's Twin (different download mechanism but same API shape). */
  function downloadJson(payload: { filename: string; json: string }): void {
    const blob = new Blob([payload.json], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = payload.filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  /** Format a Rule's canonical tag — `<Guideline.tag>.<Rule.tag>.v<version>`. */
  function ruleTagFor(guidelineId: string, ruleId: string): string {
    const g = _library.value.find(x => x.id === guidelineId)
    if (!g) return ruleId
    const r = g.rules.find(x => x.id === ruleId)
    if (!r) return ruleId
    return `${g.tag}.${r.tag}.v${r.version}`
  }

  /** Severity buckets — useful for visual prominence in panels. */
  const SEVERITY_ORDER: Record<RuleSeverity, number> = {
    critical: 0, high: 1, medium: 2, low: 3, info: 4,
  }

  return {
    library:     allGuidelines,
    activeSets:  computed(() => _activeSets.value),
    // Guideline mutators
    addGuideline, updateGuideline, bumpGuidelineVersion,
    // Rule mutators
    addRule, editRule, rejectRule, reactivateRule,
    // Pinning
    activeSetFor, setActivePins, pinGuideline, unpinGuideline,
    // Derived
    activeRulesFor, ruleTagFor,
    // Export
    exportGuidelineJson, exportLibraryJson, downloadJson,
    // Constants
    SEVERITY_ORDER,
  }
}
