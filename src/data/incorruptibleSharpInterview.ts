// UNIT_TYPE=Data
// incorruptibleSharpInterview.ts — Question/answer flow for Incorruptible Sharpening.
//
// Tom Gilb 2026-06-11 verbatim:
//   "when I said sharpening, I meant with generate questions and answers based on the plan
//    and on incorruptible standards, like we do elsewhere w sharpening, but tailored to this
//    agent"
//   "Incorruptible Sharpening: is name of the tool within the agent and available outside"
//   "make it so, now thank you"
//
// Six categories matching the six Incorruptible finding categories. Each category gets 2
// pointed questions. Each question carries 3 AI-suggested starter answers (per AI-Max rule)
// with source-layer provenance so the user knows whether the suggestion came from their Plan,
// Ries Incorruptible (cited), Gilb Standards (cited), generic template, or LLM training.
//
// Architecture parallels EVO_SHARP_CATEGORIES in evoSharpInterview.ts — same shape, same UX
// patterns. Phase 2a starter content (template-derived); Phase 2b/2c will layer plan-derived
// + Claudian-cited answers on top via file-read pattern.
//
// ── RIES FIGURE 5.1 RULE FRAMEWORK (Tom Gilb 2026-06-13) ────────────────────
//
// Source: Eric Ries, *Incorruptible: Why Good Companies Go Bad... and How
// Great Companies Stay Great* (2026), Figure 5.1 p. 91. Tom Gilb verbatim:
// "feed this to rules for incorruptible, from Ries book Figure 5.1".
//
// The figure organises corporate integrity as a BLUEPRINT with two governing
// axes and four pillars. The six categories below map to the four pillars,
// and `useIncorruptibleSharpSynthesis.ts` (export `RIES_FIGURE_5_1`,
// `CATEGORY_RIES_PILLAR`, `riesPillarForCategory()`) carries the canonical
// constants. Every synthesised finding cites the pillar + axis + chapter.
//
//   ┌──── Create Something Worth Protecting ─────┬── Build with Structural Integrity ──┐
//   │                                            │                                     │
//   │  1. PURPOSE                                │  3. INTEGRITY                       │
//   │     Mission aligned with human flourishing │     Promises others can believe,    │
//   │     + ethos that instils determination     │     even under hostile pressure     │
//   │     Ch.5 Blueprint · Ch.6 Harder Is Easier │     Ch.9 Constitutional Governance  │
//   │       → mission-drift                      │     Ch.10 Constellation View        │
//   │       → founder-vision-erosion             │     Ch.11 Spiritual Holding Company │
//   │                                            │       → stakeholder-monoculture     │
//   │  2. COHERENCE                              │                                     │
//   │     Mission ↔ business-model reinforce —   │  4. COMPLIANCE                      │
//   │     virtuous performance cycle             │     Laws · no self-dealing ·        │
//   │     Ch.7 Mission Drive · Ch.8 Invisible    │     accurate reporting · holding    │
//   │     Leader                                 │     management accountable          │
//   │       → quarterly-tyranny                  │     (governance-class baseline)     │
//   │       → innovation-budget-predation        │       → governance-hole             │
//   │                                            │                                     │
//   └────────────────────────────────────────────┴─────────────────────────────────────┘
//
// Future categories MUST be mapped to one pillar by editing CATEGORY_RIES_PILLAR
// in useIncorruptibleSharpSynthesis.ts — the framework is the law.

import type { SourceProvenance } from './aiSource'

/** A single Incorruptible-Sharpening question. */
export interface IncorruptibleSharpQuestion {
  id: string
  /** The question itself — probes deeper context the deterministic engine can't infer. */
  text: string
  /** Why this question matters per Ries / Gilb principles — shown subtle below the question. */
  rationale?: string
  /** Placeholder hint inside the textarea. */
  placeholder?: string
  /** 3 AI-suggested starter answers (per AI-Max). */
  suggestedAnswers: string[]
  /** Provenance per suggestion (parallel array). */
  suggestedAnswerProvenances: SourceProvenance[]
}

/** A category groups related questions — matches IncorruptibleCategory in types/incorruptible.ts. */
export interface IncorruptibleSharpCategory {
  id:
    | 'quarterly-tyranny'
    | 'stakeholder-monoculture'
    | 'mission-drift'
    | 'founder-vision-erosion'
    | 'innovation-budget-predation'
    | 'governance-hole'
  label: string
  description: string
  /** Tailwind accent class (R-G safe). */
  accent: string
  questions: IncorruptibleSharpQuestion[]
}

// ── Provenance shortcuts ────────────────────────────────────────────────────

const T = (note?: string): SourceProvenance => ({ source: 'template', note })
const R = (note: string): SourceProvenance => ({ source: 'gilb', note: `Ries · ${note}` })
const G = (note: string): SourceProvenance => ({ source: 'gilb', note: `Gilb · ${note}` })

// ── The six categories ──────────────────────────────────────────────────────

export const INCORRUPTIBLE_SHARP_CATEGORIES: IncorruptibleSharpCategory[] = [

  // ── 1. Quarterly Tyranny ──────────────────────────────────────────────────
  {
    id: 'quarterly-tyranny',
    label: 'Quarterly Tyranny',
    description: 'Long-horizon counterweights for short-term metrics',
    accent: 'bg-red-500',
    questions: [
      {
        id: 'qt-wish-recovery',
        text: 'Name one Value where you would accept a quarter-of-target deliverable IF the 5-year Wish became more ambitious.',
        rationale: 'Ries: every quarterly Goal needs a long-horizon Wish counterweight, or the Goal becomes the planning ceiling.',
        placeholder: 'Value name + the unsanded 5-year Wish you would set in exchange…',
        suggestedAnswers: [
          'For User Activation: Goal 30% by Q4 is acceptable IF Wish becomes "industry-defining 5× retention vs cohort median by 2031" — i.e. we trade quarterly velocity for a transformational long-horizon target the team will not lose sight of.',
          'For Revenue: Goal $2M by Q4 is acceptable IF Wish becomes "$50M ARR by 2030 anchored on a category-defining product line not yet shipped" — i.e. quarterly delivery is real but a 25× Wish anchors the planning gravity.',
          'For any Value with Goal-When ≤ 12 months: add a Wish-When ≥ 60 months at 2-3× the Goal, OR explicitly mark the Value as "tactical-only" and state which strategic Value it serves.',
        ],
        suggestedAnswerProvenances: [
          T('Concrete pattern — User Activation example'),
          T('Concrete pattern — Revenue example'),
          R('Long-horizon counterweight principle'),
        ],
      },
      {
        id: 'qt-meter-multiyear',
        text: 'How will Status of this Value be MEASURED over multi-year horizons, not just per-quarter?',
        rationale: 'Ries: short-term measurement infrastructure cannot detect long-term value erosion. The Meter itself must include multi-year aggregates.',
        placeholder: 'Multi-year Meter design — e.g. trailing-36-month cohort retention, 5-year customer LTV trend, etc.',
        suggestedAnswers: [
          'Meter: trailing-36-month aggregate, recorded quarterly but never reset — distinguishes "good quarter" from "good trajectory". Quarterly Status reports include both quarter value AND 3-year-cumulative for comparison.',
          'Meter: a 5-year rolling cohort comparison — each new quarter is benchmarked against the same quarter 1, 2, 3, 4, 5 years ago. Surfaces both short-term wobble and long-term drift.',
          'Meter: two-tier — Operational Meter (quarterly raw) + Strategic Meter (5-year integral). Status reports both. Quarterly review can only declare success if BOTH are on track.',
        ],
        suggestedAnswerProvenances: [
          T('Trailing-aggregate pattern'),
          T('Cohort-comparison pattern'),
          R('Two-tier measurement (Ries Innovation Accounting extended)'),
        ],
      },
    ],
  },

  // ── 2. Stakeholder Monoculture ────────────────────────────────────────────
  {
    id: 'stakeholder-monoculture',
    label: 'Stakeholder Monoculture',
    description: 'Long-horizon + inanimate stakeholder representation',
    accent: 'bg-amber-500',
    questions: [
      {
        id: 'sm-future-user',
        text: 'Who in 2036 will have suffered if today\'s Plan optimises only for today\'s stakeholders? Name them — pretend to write to them.',
        rationale: 'Ries (LTSE charter): incorruptibility requires representing future-generation users who cannot be in the planning room today.',
        placeholder: 'Name + one-sentence definition of the long-horizon person/entity whose interests are not currently represented…',
        suggestedAnswers: [
          'Future Generation User (2036): A 14-year-old in 2036 whose data this system has been collecting for 10 years. They had no voice in the 2026 privacy decisions but live with the consequences. Their interest: data minimisation, deletion-on-request, no aggregation that locks them in.',
          'Junior Employee Future Self: An engineer in 2036 working in this codebase. Their interest: every shortcut taken today becomes their maintenance burden. They want code review standards that future-employees actually find readable.',
          'Community Bystander: People who never use the product but live in its second-order shadow (e.g. local economy effects, environmental load, supply-chain dependencies). Their interest: bounded externalities; they cannot opt out.',
        ],
        suggestedAnswerProvenances: [
          R('Future-generation stakeholder pattern'),
          T('Junior-employee future-self pattern'),
          R('LTSE expanded-stakeholders principle'),
        ],
      },
      {
        id: 'sm-inanimate-needs',
        text: 'Which inanimate stakeholders (data, regulators, ecosystems) have BINARY compliance needs your Plan must respect?',
        rationale: 'Gilb / Tom 2026-05-15: "all data is a stakeholder, it has needs like GDPR." Inanimate stakeholders become C. entries — binary non-negotiables.',
        placeholder: 'Name + the binary compliance rule the Plan must honour…',
        suggestedAnswers: [
          'GDPR (regulator): personal data of EU residents may not be transferred outside the EEA without adequate safeguards. Binary rule. Becomes a C. entry binding every data-export feature.',
          'Customer Data (inanimate entity): right to be forgotten — Plan must support deletion-on-request within 30 days end-to-end. Binary rule on retention systems.',
          'AI Act compliance (regulator, EU 2026+): any AI-assisted decision affecting an individual must be logged, explainable, and contestable. Binary rule on every classifier the Plan ships.',
        ],
        suggestedAnswerProvenances: [
          G('Inanimate stakeholders — Tom verbatim 2026-05-15'),
          T('Customer-data right-to-be-forgotten pattern'),
          T('AI Act compliance pattern — current 2026 regulatory context'),
        ],
      },
    ],
  },

  // ── 3. Mission Drift ──────────────────────────────────────────────────────
  {
    id: 'mission-drift',
    label: 'Mission Drift',
    description: 'Mission as Constraint, not aspiration',
    accent: 'bg-violet-500',
    questions: [
      {
        id: 'md-charter-text',
        text: 'Paste the founding mission statement of this Plan, verbatim, exactly as written in the original charter / pitch deck / agreement.',
        rationale: 'Ries: the founding mission is a CONSTRAINT, not aspiration. It cannot be machine-generated; it must come from the original document. Charter Lock requires exact text.',
        placeholder: 'Verbatim text from the founding document. If none exists, write the truth: "no formal charter — Plan is operationally defined and the team agrees to write one before next review."',
        suggestedAnswers: [
          '[Paste the verbatim mission statement here. The Plan will encode this as a C. Mission Lock Constraint with the exact text in the description field, so no Goal can silently drift away from it.]',
          'No formal charter exists yet. Pre-condition: the founding team writes one before the next review cadence. Until then, the Plan operates under a "no-irreversible-decisions" interim constraint.',
          'The mission is implicit in the founder\'s public statements. Capture: top-3 quotes from founder talks/writing that define the mission. Plan stops once these are demonstrably contradicted by any Value.',
        ],
        suggestedAnswerProvenances: [
          T('Verbatim charter capture (user-supplied)'),
          T('Honest no-charter pre-condition pattern'),
          R('Implicit-mission capture (Ries founder-mode protection)'),
        ],
      },
      {
        id: 'md-violation-test',
        text: 'What test would clearly show this Plan is VIOLATING its mission? Make the test binary and observable.',
        rationale: 'Gilb: every Constraint needs a violation test. Without one, mission drift is unfalsifiable.',
        placeholder: 'Concrete test — "if X observable thing is true, mission is violated"…',
        suggestedAnswers: [
          'Violation test: any quarterly Goal trade-off that materially weakens a mission-keyword target by >10% without an explicit Plan-level approval triggers a Mission Review with all stakeholders present.',
          'Violation test: any Solution shipped where >40% of measurable user value flows to non-mission-adjacent use cases — surface as Plan-level RED status until resolved.',
          'Violation test: any Resource allocation where mission-aligned R&D (tagged in R. entry) falls below 10% of total for two consecutive quarters — auto-flags governance review.',
        ],
        suggestedAnswerProvenances: [
          R('Quarterly-trade-off mission-review pattern'),
          T('Solution-value-flow pattern'),
          R('Resource-floor pattern (Ries innovation budget × Gilb cadence)'),
        ],
      },
    ],
  },

  // ── 4. Founder-Vision Erosion ─────────────────────────────────────────────
  {
    id: 'founder-vision-erosion',
    label: 'Founder-Vision Erosion',
    description: 'Original transformational Wish, before incremental sanding',
    accent: 'bg-indigo-500',
    questions: [
      {
        id: 'fv-unsanded-wish',
        text: 'What was the original Wish before the board, the budget, or the investors sanded it down? Write the unsanded version.',
        rationale: 'Ries (extending PG founder mode 2024): the original transformational Wish gets sanded down by incrementalism unless explicitly protected.',
        placeholder: 'Per Value: the un-sanded ambition that existed before someone said "be realistic"…',
        suggestedAnswers: [
          'V.UserActivation un-sanded: "Every new user reaches first delivered value within 60 seconds with zero help text" — the original founder ambition before "let\'s aim for 5 minutes" landed in the spec.',
          'V.Revenue un-sanded: "Replace the dominant incumbent\'s pricing model entirely within 5 years" — the original transformational target before "$2M ARR Y1" became the planning gravity.',
          'V.Reliability un-sanded: "Zero customer-facing incidents per year — every single incident triggers a charter review" — before "99.9% uptime" became the proxy.',
        ],
        suggestedAnswerProvenances: [
          T('Concrete pattern — Activation un-sanded'),
          T('Concrete pattern — Revenue un-sanded'),
          R('Zero-incidents un-sanded pattern (Ries founder-mode protection)'),
        ],
      },
      {
        id: 'fv-board-pressure-log',
        text: 'When was the last time a board/investor/exec pressure caused a Goal or Wish to be LOWERED? Name it.',
        rationale: 'Ries: sanding events are not random — they are predictable, recurring, and trackable. Naming past sanding makes future sanding visible.',
        placeholder: 'Specific event + which Value was lowered + by whom + what pressure caused it…',
        suggestedAnswers: [
          '2026-Q1 board meeting: V.UserActivation Goal was lowered from 50% to 30% after Q4 miss. Sanding cause: short-term-quarterly-pressure. Recommendation: future Goal reductions require explicit Wish increase to compensate.',
          'During fundraise prep 2026: V.Revenue Wish was lowered from $50M ARR to $20M ARR because "investors find $50M aggressive". Sanding cause: external-credibility-optimisation. Recommendation: keep two Wish levels — public-facing and internal.',
          'No past sanding events I can name — but the current Plan reads as already-sanded. Surface: pull the founder/charter author into one room and ask which Wishes feel safe vs ambitious.',
        ],
        suggestedAnswerProvenances: [
          T('Quarterly-pressure sanding event'),
          T('Fundraise-credibility sanding event'),
          R('Already-sanded plan recognition (Ries default-state)'),
        ],
      },
    ],
  },

  // ── 5. Innovation-Budget Predation ────────────────────────────────────────
  {
    id: 'innovation-budget-predation',
    label: 'Innovation Budget Predation',
    description: 'R&D budget as protected floor, never residual',
    accent: 'bg-orange-500',
    questions: [
      {
        id: 'ib-recent-predation',
        text: 'Last time quarterly Goal targets fell short, where did the budget come from to make up the gap? Was R&D touched?',
        rationale: 'Ries: R&D treated as residual after quarterly targets = institutionalised short-termism. Predation history is the leading indicator.',
        placeholder: 'Specific event + which budget category was redirected + what the long-term cost will be…',
        suggestedAnswers: [
          '2026-Q1: R&D budget reduced by $200K mid-quarter to fund sales hiring after revenue miss. Long-term cost: 2 R&D positions deferred to 2026-H2. Recommendation: add C. constraint forbidding mid-quarter R&D reallocation.',
          'Continuous slow predation: R&D allocation has dropped from 18% (2024) to 12% (2025) to 9% (2026 plan) — death by 1000 small reallocations, each individually justified. Recommendation: floor at 12% as Constraint.',
          'No predation event I can name — but no formal R&D floor exists, so the absence may just mean no major miss happened YET. Recommendation: pre-emptively set the floor before predation pressure arrives.',
        ],
        suggestedAnswerProvenances: [
          T('Acute-event predation pattern'),
          R('Slow-drift predation pattern (Ries empirical)'),
          T('Pre-emptive floor pattern'),
        ],
      },
      {
        id: 'ib-explore-vs-exploit',
        text: 'What fraction of next-year resources is committed to EXPLORATION (new bets that could fail) vs EXPLOITATION (refining what works)?',
        rationale: 'Ries / Lean Startup: Build-Measure-Learn requires explicit Explore budget. Without it, the team optimises only the legible quarterly Goal.',
        placeholder: 'Numeric split — explore % vs exploit %, and which projects fall in each bucket…',
        suggestedAnswers: [
          'Explore: 15% of engineering capacity dedicated to bets with <50% likelihood of success but potential transformational impact. Currently includes: Project A (new platform), Project B (research initiative). Exploit: 85% on current product roadmap. Pattern: Q4 each year, evaluate which explores graduate to exploit.',
          'Explore: 25% of all resources via an explicit "Discovery EvoStep" structure — Tasks within these EvoSteps are framed as questions to answer, not deliverables to ship. The 75% exploit funds the demonstrably-on-track Values.',
          'Currently 100% exploit — no explore allocation. Honest gap. Recommendation: pick ONE candidate explore bet and carve 10% of capacity for it in next planning cycle.',
        ],
        suggestedAnswerProvenances: [
          T('15%/85% pattern with graduation cycle'),
          R('Discovery-EvoStep pattern (Ries + Gilb fusion)'),
          T('Honest-zero-explore pattern'),
        ],
      },
    ],
  },

  // ── 6. Governance Hole ────────────────────────────────────────────────────
  {
    id: 'governance-hole',
    label: 'Governance Hole',
    description: 'Explicit review cadences, decision locks, accountability',
    accent: 'bg-slate-500',
    questions: [
      {
        id: 'gh-cadence-evidence',
        text: 'Who reviews this Plan? On what cadence? What evidence is required? What happens if review is missed?',
        rationale: 'Ries: governance is structural — without explicit cadence Constraints, structure decays. Each of WHO / WHEN / EVIDENCE / MISS-CONSEQUENCE must be encoded.',
        placeholder: 'Four-part answer: reviewers + cadence + required evidence + missed-review consequence…',
        suggestedAnswerProvenances: [
          T('Quarterly Plan review pattern with evidence requirements'),
          R('Stakeholder-quorum review pattern (Ries multi-stakeholder)'),
          G('Tom Gilb SUCCESS book — Plan governance is part of the Plan, not a side-document'),
        ],
        suggestedAnswers: [
          'Reviewers: founder + ops lead + customer-rep (rotating). Cadence: quarterly. Evidence: Status measurements against every V., updated cascade impact analysis since last review, stakeholder satisfaction signal. Miss consequence: Plan-level RED status; no major decisions until review completes.',
          'Reviewers: full stakeholder quorum (all named StakeholderEntries with PowerLevel ≥ Medium). Cadence: bi-monthly. Evidence: dashboards auto-generated from spec + each stakeholder\'s 1-line "this period\'s most-watched signal". Miss: auto-flag as governance failure on next cascade ripple report.',
          'Reviewers: small steering group (3 people max — speed matters). Cadence: every Evo Step boundary, not calendar-driven. Evidence: completed Study-Act results + diff against last spec snapshot. Miss: blocks initiating the next Evo Step until reviewed.',
        ],
      },
      {
        id: 'gh-decision-lock',
        text: 'Which decisions in this Plan should NEVER be allowed to change without explicit multi-stakeholder approval?',
        rationale: 'Ries: founder-mode protection requires explicit decision locks on original-intent decisions. Without naming them, all decisions are silently revisable.',
        placeholder: 'Specific decisions that must require multi-stakeholder approval to change…',
        suggestedAnswers: [
          'Locked decisions: (1) mission statement text (founder + board only), (2) explore-vs-exploit ratio floor (founder + ops), (3) data-stakeholder C. entries (founder + legal + customer-rep). Any change requires written approval logged in Plan history.',
          'Locked: any V. with Wish-When ≥ 60 months — long-horizon Wishes cannot be reduced without explicit Charter Amendment process. Includes timestamp + named approver + rationale. Prevents quiet erosion.',
          'Locked: founder-named "non-negotiables" list — write down 3 things the founder believes are non-negotiable even if the business case temporarily favours otherwise. Lock requires unanimous vote from named approver list to change.',
        ],
        suggestedAnswerProvenances: [
          R('Triple-lock pattern (mission / explore-floor / inanimate-stakeholders)'),
          R('Long-Wish lock pattern (Ries Charter Amendment)'),
          R('Founder-non-negotiables list (Ries founder-mode + PG 2024)'),
        ],
      },
    ],
  },
]

/** Total question count across all categories — for sidebar display + progress. */
export function totalIncorruptibleSharpQuestions(): number {
  return INCORRUPTIBLE_SHARP_CATEGORIES.reduce((sum, cat) => sum + cat.questions.length, 0)
}

export function getIncorruptibleSharpCategory(id: string): IncorruptibleSharpCategory | undefined {
  return INCORRUPTIBLE_SHARP_CATEGORIES.find(c => c.id === id)
}
