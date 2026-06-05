// UNIT_TYPE=Data
// resourcesSharpenDimensions.ts — 9 sharpening areas for the Resources stage.
//
// Tom Gilb, 2026-06-04 (verbatim): *"I think we need to beef up the Resources
// Stage. We need to bring in any available resources tools, We need to deal
// with any resources in the Planguage plan. We need to have special resources
// sharpening tool. Suggested Sharpening Areas (feel free to add). Calendar
// Time, Work Hours, Human Specialists, Technical Debt, Future Maintenance
// Costs, Decommissioning Costs, ROI, Efficiency (Values/Costs ratio),
// Exceptional Tradeoff Opportunities (for reducing resources by reducing
// Values, or relaxing constraints. See Cost Engineering book, and Optima
// Book for [m]y specific ideas)"*.
//
// Composes WITH the Conjunction-of-Technologies SUPREME principle: every
// dimension carries a `gilbCite` field so any AI-assisted analysis can pass
// the citation through to the user. Composes WITH the Standards-First Rule:
// dimensions reference `10.Standard/` template files where relevant.
//
// Twin portability: pure data, no Vue, no DOM. Ports directly to the Twin's
// Resources-stage tooling.

export interface ResourcesSharpenDimension {
  /** Stable identifier — used as data-key, persistence key, prompt slug. */
  id: string
  /** Display label, short — title-case, ≤ 32 chars. */
  label: string
  /** One-sentence summary visible under the label. */
  summary: string
  /** Three to six guided questions the user works through. */
  questions: string[]
  /** Worked examples Claudian can paste in if the user wants suggestions. */
  examples: string[]
  /** Canonical Gilb citation (book/chapter/page where known). */
  gilbCite: string
  /** Free-text inline note flagging the trade-off or risk if this dimension is skipped. */
  whyItMatters: string
  /** Optional link into `10.Standard/` for the canonical Planguage rule. */
  standardRef?: string
}

export const RESOURCES_SHARPEN_DIMENSIONS: ResourcesSharpenDimension[] = [
  {
    id: 'calendar-time',
    label: 'Calendar Time',
    summary: 'Real elapsed time from start to value delivery — distinct from work hours.',
    questions: [
      'What is the deadline (Goal date) for each Value to reach Goal level?',
      'What is the latest acceptable date (Tolerable) before stakeholders are harmed?',
      'Which Evo Steps sit on the critical path of the calendar?',
      'Are there fixed external dates (regulator, market window, contract clause)?',
    ],
    examples: [
      'R.CalendarBudget: Scale = days from project start; Tolerable [Stakeholder = Sponsor] = 180 days; Goal [Stakeholder = Sponsor] = 120 days.',
      'R.LaunchWindow: Scale = calendar date; Goal = 2026-09-01 (market window closes 2026-10-15).',
    ],
    gilbCite: 'Gilb, Competitive Engineering (2005) — Chapter on Resource specification; EVO 2024 ch.2 (Evo Step calendar planning).',
    whyItMatters: 'Stakeholders perceive delivered Value by the calendar, not by work hours. A plan that meets work-hour budgets but slips calendar dates is a failed plan.',
    standardRef: '10.Standard/Standard.Kai-Zen/Template_Write_Resource.md',
  },
  {
    id: 'work-hours',
    label: 'Work Hours',
    summary: 'Human effort expended — measured per role, per Evo Step.',
    questions: [
      'How many hours per role does each Evo Step consume?',
      'What is the total project work-hour budget? Per quarter?',
      'Are hours allocated to specialists who are also on other projects?',
      'What is the cost per work-hour by role (loaded rate)?',
    ],
    examples: [
      'R.WorkHours.Backend: Scale = engineer-hours; Tolerable = 1200 h; Goal = 800 h.',
      'R.WorkHours.Design: Scale = designer-hours; Goal = 240 h.',
    ],
    gilbCite: 'Gilb, Software Metrics (1988) — Effort estimation chapter; PoSEM (1988) — Effort vs Calendar distinction.',
    whyItMatters: 'Confusing work-hours with calendar-days inflates schedule confidence and burns the team. Separate them explicitly.',
    standardRef: '10.Standard/Standard.Kai-Zen/Template_Write_Resource.md',
  },
  {
    id: 'human-specialists',
    label: 'Human Specialists',
    summary: 'Scarce expertise — the bottleneck nobody can substitute for.',
    questions: [
      'Which skills are needed that only 1-3 people on the team can do?',
      'What is the maximum concurrent demand on each specialist?',
      'What is the cost of acquiring or training a substitute?',
      'What happens to the plan if specialist X is unavailable for 2 weeks?',
    ],
    examples: [
      'R.Specialist.NavalArchitect: Scale = qualified architects available; Tolerable = 1; Goal = 2 (no-single-point-of-failure).',
      'R.Specialist.SteamEngineer: Scale = engineer-weeks committed; Goal = 24 ew.',
    ],
    gilbCite: 'Gilb, Stakeholder Engineering — Stakeholder-as-Resource chapter; Competitive Engineering — Resource roles.',
    whyItMatters: 'Specialist bottlenecks are the most-frequently-missed plan failure. A V. goal that depends on one named human carries hidden single-point-of-failure risk.',
  },
  {
    id: 'technical-debt',
    label: 'Technical Debt',
    summary: 'Future cost incurred by shortcuts taken today.',
    questions: [
      'Which Evo Steps explicitly defer quality work to "later"?',
      'What is the estimated cost (hours, dollars) of paying back each piece of debt?',
      'Which debt items will block which future V. goals?',
      'Is the debt explicit (logged) or implicit (only known by the implementer)?',
    ],
    examples: [
      'R.TechDebt.UnitTestCoverage: Scale = % coverage; Now = 38%; Tolerable = 60%; Goal = 80%.',
      'R.TechDebt.DocumentationBacklog: Scale = pages overdue; Tolerable = 0.',
    ],
    gilbCite: 'Gilb, Competitive Engineering — Defect cost calculus; PoSEM Inspection ROI chapter.',
    whyItMatters: 'Unmeasured technical debt is the easiest Resource to forget. Quantify it as an R. entry so it appears in V/C tradeoffs.',
  },
  {
    id: 'future-maintenance',
    label: 'Future Maintenance Costs',
    summary: 'Operating cost across the asset lifecycle, not just at launch.',
    questions: [
      'What is the estimated annual maintenance cost (in hours and dollars) for each Solution?',
      'How long is the asset expected to operate? 5, 10, 25 years?',
      'Who pays maintenance — the same budget that paid build, or a different one?',
      'Which Solutions have lower-cost-of-ownership alternatives we did not pick?',
    ],
    examples: [
      'R.MaintHours.IroncladHull: Scale = engineer-hours/year; Goal ≤ 400 h/y for 20 years.',
      'R.MaintCost.SteamPlant: Scale = USD/year; Goal ≤ $40k/y average over lifecycle.',
    ],
    gilbCite: 'Gilb, Competitive Engineering — Lifecycle cost chapter; Cost Engineering book (Tom Gilb draft) — Total Cost of Ownership framework.',
    whyItMatters: 'A build that meets launch budgets but doubles its lifetime cost is a budget failure deferred. Goal levels at Tolerable lifecycle cost prevent this.',
  },
  {
    id: 'decommissioning',
    label: 'Decommissioning Costs',
    summary: 'End-of-life — the cost to retire and dispose responsibly.',
    questions: [
      'What is the planned end-of-life date for each Solution?',
      'What is the cost of decommissioning (removal, disposal, data migration, contract exits)?',
      'Are there regulatory disposal obligations (GDPR data delete, environmental cleanup)?',
      'Who pays decommissioning — current budget, sinking fund, or a future budget yet unfunded?',
    ],
    examples: [
      'R.DecommCost.Ironclad: Scale = USD; Goal ≤ $25k at end-of-service.',
      'R.DataDecom.GDPR: Scale = days from service end to full purge; Tolerable ≤ 30 days; Goal ≤ 7 days.',
    ],
    gilbCite: 'Gilb, Competitive Engineering — Resource specification (decommissioning as Resource); Optima book (Tom Gilb draft) — total-lifecycle optimisation.',
    whyItMatters: 'Decommissioning is the most-frequently-omitted Resource in technology plans. Funding it at planning time avoids forced abandonment later.',
  },
  {
    id: 'roi',
    label: 'ROI (Return on Investment)',
    summary: 'Value delivered divided by total resources expended — the master ratio.',
    questions: [
      'What dollar (or quantifiable) value does each Value entry produce per year?',
      'What is the total resource cost (build + maintain + decommission) per Solution?',
      'What is the projected ROI per Evo Step? Which step has the highest?',
      'When does the cumulative ROI cross zero (payback date)?',
    ],
    examples: [
      'Derived: ROI(IroncladHull) = $1.2M/y avoided convoy losses ÷ $180k build + $40k/y maint × 5y = 4.1×.',
      'R.PaybackDate.Goal: Scale = months from launch to cumulative ROI ≥ 0; Goal ≤ 18 months.',
    ],
    gilbCite: 'Gilb, Value Improvement (2024) — V/C prioritisation; SUCCESS book — ROI vs Goal lattice.',
    whyItMatters: 'Without explicit ROI, Resources decisions degenerate into "lowest bid" thinking. Planguage demands the Value-per-Resource ratio be the decision driver.',
  },
  {
    id: 'efficiency',
    label: 'Efficiency (Values / Costs)',
    summary: 'Per-Value-per-Resource ratio — the prioritisation engine of Planguage.',
    questions: [
      'For each (Value × Solution) pair, what is the Impact-per-unit-Cost?',
      'Which Evo Step has the highest Value-per-Calendar-day?',
      'Which has the highest Value-per-Work-hour?',
      'Are we picking Evo Steps by highest Efficiency, or by something else (familiar, easy, urgent)?',
    ],
    examples: [
      'Derived: Efficiency(SpeedUnderSteam × SteamEngineInstall) = 6 knots / 120 work-days = 0.05 knots/day.',
      'Derived: Efficiency(SpeedUnderSail × SailRigging) = 4 knots / 30 work-days = 0.13 knots/day → higher priority.',
    ],
    gilbCite: 'Gilb, EVO 2024 ch.7 (VDT — Value Decision Table); Competitive Engineering — Impact Estimation Table.',
    whyItMatters: 'Efficiency is the SUPREME prioritisation criterion in Planguage. If V/C ratios are not computed and ranked, prioritisation is gut-feel.',
    standardRef: '10.Standard/Standard.Kai-Zen/Proc_v_p_o_PrioritizeEvoSteps.md',
  },
  {
    id: 'tradeoffs',
    label: 'Exceptional Tradeoff Opportunities',
    summary: 'Reduce Resources by relaxing Values or Constraints — where the big savings live.',
    questions: [
      'Which V. Goal levels could be dropped to Tolerable to save which Resources?',
      'Which Constraints, if relaxed (with stakeholder approval), would unlock which Resource savings?',
      'Which Solution could be substituted for a cheaper one with acceptable Value loss?',
      'Which Evo Step could be deferred without harming any V. Goal?',
    ],
    examples: [
      'Tradeoff: drop SpeedUnderSail Goal 6 → 5.5 knots; save $18k rigging; Sponsor approval needed.',
      'Tradeoff: relax C.NavalCodeCompliance scope to exclude ornamental fittings; save 40 work-hours.',
      'Tradeoff: defer Evo 3 (Sail Rigging) past first sea trial; no V. Goal harmed; saves $12k calendar carry.',
    ],
    gilbCite: 'Gilb, Cost Engineering book (Tom Gilb draft) — Tradeoff matrix chapter; Optima book — value/constraint relaxation framework; Competitive Engineering — Stakeholder approval for Constraint changes.',
    whyItMatters: 'The biggest Resource savings come from re-negotiating Values and Constraints, not from squeezing the implementation. Most plans never look here.',
  },
]

// ════════════════════════════════════════════════════════════════════════════
// RESOURCES_ADVANCED_TOOLS — Tom Gilb 2026-06-04 (extension):
//
//   *"More tools for dealing with resources: RESOURCE CONSTRAINT SPECS: Give
//    suggestions for more-specific Resource Budgets and Tolerable levels.
//    Improve both Scales and Meters. Suggest Specific New or much better
//    strategies for Resource Management, Suggest Binary Constraints to
//    manage resources better (with expected effects), Make use of Scale
//    Qualifiers [Who, Where, What, How] in any Values and any Resources,
//    and any Strategies, which would have useful effects on resources.
//    This is advanced planguage, so read cost engineering well, optima,
//    Requirements Engineering (tell e to add books)"*.
//
// CITATION CORRECTION (Tom Gilb, 2026-06-04, same session):
//    *"correction I do not have a book on Requirements Eng. Refer to my CE
//    book 2005, and SEA book"*.  All citations below replace "Requirements
//    Engineering" with the CORRECT Gilb references:
//      • CE = Competitive Engineering (2005)
//      • SEA = Systems Enterprise Architecture
//    The reference_tom_gilb_corpus.md memory file confirms: line 597 [SE] =
//    Stakeholder Engineering (2021); line 598 [SEA] = Systems Enterprise
//    Architecture.  There is no Gilb book titled "Requirements Engineering".
//
// These are GENERATIVE tools (produce new spec content) sitting alongside
// the 9 ANALYTICAL dimensions above (which surface findings about the
// existing spec).  Each tool exposes a Claudian prompt and structured
// expected-output shape so AI-assist remains source-layer-badged per the
// Conjunction-of-Technologies SUPREME rule.
// ════════════════════════════════════════════════════════════════════════════

export interface ResourcesAdvancedTool {
  /** Stable id — used as data-key, persistence key, prompt slug. */
  id: string
  /** Display label, short. */
  label: string
  /** One-sentence summary visible under the label. */
  summary: string
  /** What this tool produces — output shape Claudian must emit. */
  outputShape: string
  /** Three to five worked examples of the kind of output expected. */
  examples: string[]
  /** Canonical Gilb citation — book / chapter / page where the technique is taught. */
  gilbCite: string
  /** Optional `10.Standard/` canonical rule. */
  standardRef?: string
  /** When to invoke this tool — natural workflow trigger. */
  whenToUse: string
}

export const RESOURCES_ADVANCED_TOOLS: ResourcesAdvancedTool[] = [
  {
    id: 'resource-constraint-specs',
    label: 'Resource Constraint Specs — sharpen Budgets + Tolerables',
    summary: 'Generate more-specific Resource Budgets and Tolerable levels per R. entry, with proposed numeric tightenings.',
    outputShape: 'For each existing R. entry: { id, currentBudget, proposedTolerable, proposedGoal, qualifiers[], rationale, gilbCite }. Where the spec has no R. entries, propose them from inferred resource demands of the F/V/S blocks.',
    examples: [
      'R.CalendarBudget: Tolerable [Sponsor, Year-1, Worst-Case] = 180 days; Goal [Sponsor, Year-1, Best-Case] = 120 days — tightened from un-qualified "Tolerable: 200 days".',
      'R.WorkHours.Backend: Tolerable [Q1, Lead-Engineer-Available] = 600 h; Goal [Q1, Lead-Engineer-Available] = 400 h — adds Who/When qualifiers.',
      'R.CapitalBudget: Tolerable [USD, FY26-Q4-Close] = $400k; Goal [USD, FY26-Q4-Close] = $280k — adds When + Currency qualifiers.',
    ],
    gilbCite: 'Gilb, Competitive Engineering (CE, 2005) — chapter on Resource specification + Budget + Tolerable level distinction; Cost Engineering book (2023) — Resource numeric tightening framework; Systems Enterprise Architecture (SEA) — enterprise-scope Budget reasoning.',
    standardRef: '10.Standard/Standard.Kai-Zen/Template_Write_Resource.md',
    whenToUse: 'Run when R. entries exist with un-qualified or round-number Tolerable/Goal levels — every Resource should have time-, condition-, and stakeholder-qualified numerics.',
  },
  {
    id: 'scale-and-meter-improvement',
    label: 'Scale + Meter Improvement',
    summary: 'Improve the Scale (what is measured + unit) and Meter (how it is measured) on every Resource and every Value.',
    outputShape: 'For each V. or R. entry: { id, currentScale, currentMeter, issues[], proposedScale, proposedMeter, qualifierAdditions[], gilbCite }.',
    examples: [
      'V.SpeedUnderSail: Current Scale "knots in sea trials" → Proposed "knots [Wind-Speed = 10-20 kt, Sea-State ≤ 3, Heading = Beam-Reach]" — adds Where/What qualifiers Scale Qualifier rule).',
      'V.EntryFluency: Current Meter "user reports" → Proposed "Meter [Method = task-completion timer; Sample = ≥ 30 users / week; Where = production]" — Who/Where/What qualified.',
      'R.MaintHours.SteamPlant: Current Scale "hours/year" → Proposed "engineer-hours/year [Role = Chief Engineer or Boiler Specialist; Where = port maintenance facility]" — Who + Where qualified.',
    ],
    gilbCite: 'Gilb, Competitive Engineering (CE, 2005) — Scale + Meter chapter; PoSEM ch.9 — Meter design discipline; Software Metrics (1988) — quantification of quality.',
    standardRef: '10.Standard/Standard.Kai-Zen/Rule_Write_planguage-spec.md',
    whenToUse: 'Run when any Scale lacks units OR any Meter lacks measurement method/sample/where — sharpening this is the single biggest leverage on plan precision.',
  },
  {
    id: 'resource-management-strategies',
    label: 'Resource Management Strategies — propose new S. entries',
    summary: 'Suggest specific new (or much better) Solution-level Strategies that primarily affect Resources — reduce, multiply, or re-allocate.',
    outputShape: 'New S. entries: { id, description, primaryResourceAffected, expectedSavings, impactsValues[], cost, rationale, gilbCite }.',
    examples: [
      'S.CrossTrainShiftPair: cross-train each calendar shift to two adjacent roles — reduces R.Specialist.NavalArchitect single-point-of-failure risk by 70% at marginal training cost.',
      'S.FixedPriceVendorContract: convert SteamEngine procurement from time-and-materials to fixed-price — caps R.CapitalBudget volatility at +/-5%; transfers schedule risk to vendor.',
      'S.MaintenanceTwinship: use ironclad sister-ship for parts-cannibalisation in emergencies — halves R.PartsInventory carrying cost; small risk to twin if cascade failure.',
    ],
    gilbCite: 'Gilb, Competitive Engineering (CE, 2005) — Solution generation + Strategy-as-Solution chapter; Optima book — multi-objective strategy generation; Systems Enterprise Architecture (SEA) — enterprise-scale strategy patterns.',
    whenToUse: 'Run when the V/C ratios are unfavourable AND no obvious Solution exists in the spec — generates strategies the planner has not yet considered.',
  },
  {
    id: 'binary-constraints-for-resources',
    label: 'Binary Constraints — to manage Resources better',
    summary: 'Suggest Constraint entries (C.) whose enforcement primarily protects Resources — with explicit expected effects.',
    outputShape: 'New C. entries: { id, description, scope, rationale, expectedResourceEffect, enforcedBy, gilbCite }.',
    examples: [
      'C.NoOvertimeOverEightyHoursPerWeek [Role = engineer, Period = any rolling 4-week window] — prevents burnout-driven R.WorkHours overrun; rationale = sustainability + quality compounding cost.',
      'C.AllVendorContractsFixedPrice [Project = Ironclad, Threshold = > $20k] — caps R.CapitalBudget tail risk; enforced by Procurement Officer.',
      'C.NoNewSpecialistDependencyMidProject [Phase = post-keel-laying] — protects R.Specialist availability; rationale = specialist substitution mid-project doubles ramp-up cost.',
    ],
    gilbCite: 'Gilb, Competitive Engineering (CE, 2005) — Constraint specification + binary rule chapter + Constraint vs Value distinction; Cost Engineering book (2023) — Constraint as cost-cap mechanism; Systems Enterprise Architecture (SEA) — enterprise constraint frameworks.',
    standardRef: '10.Standard/Standard.Kai-Zen/Template_Write_Constraint.md',
    whenToUse: 'Run after Resource Budgets are set — Constraints are the binary enforcement layer that prevents Budget breaches in execution.',
  },
  {
    id: 'scale-qualifiers',
    label: 'Scale Qualifiers — apply [Who, Where, What, How] to V. + R. + S.',
    summary: 'Sharpen every Value, Resource, and Strategy with the four canonical Scale Qualifier dimensions — Who, Where, What, How.',
    outputShape: 'For each entry: { id, type, currentScale, qualifierAudit: { who, where, what, how }, proposedScaleWithQualifiers, gilbCite }. The audit shows present/absent for each of the 4 qualifier dimensions.',
    examples: [
      'V.UserResponseTime: current "ms" → "ms [Who = anonymous-user; Where = production EU region; What = checkout flow; How = p95 measurement over 24h]" — all 4 qualifiers added.',
      'R.WorkHours: current "hours" → "engineer-hours [Who = senior backend, Where = remote-Pacific timezone, What = critical-path Evo Steps, How = self-reported time entries audited weekly]".',
      'S.CrossTrainShiftPair: current "cross-train" → "cross-train [Who = all shift-leads, Where = on-board operational drills, What = two adjacent specialist roles per lead, How = 8-hour wet-deck sessions × 3 over Evo 2]".',
    ],
    gilbCite: 'Gilb, Competitive Engineering (CE, 2005) — Scale Qualifier chapter (the 4 canonical dimensions Who/Where/What/How) + Qualifier-as-Precision-Operator framework; Value Improvement (2024) — qualifier impact on V/C ratios; Systems Enterprise Architecture (SEA) — enterprise-scope qualifier usage.',
    standardRef: '10.Standard/Standard.Kai-Zen/Rule_Write_format-scale-qualifiers.md',
    whenToUse: 'Run on EVERY entry on every plan — Scale Qualifiers are the most-frequently-skipped Planguage precision tool, and the highest-leverage sharpen.',
  },
]

/**
 * AI-assist prompt template for Claudian-path Resources analysis.
 * Tom orchestrates: copies a spec context + this prompt to Claudian, Claudian
 * returns a structured JSON analysis that the SEM App reads back as a file.
 *
 * Conjunction-of-Technologies: the prompt explicitly asks Claudian to cite
 * Gilb sources per finding so the user sees provenance.
 */
export const RESOURCES_ANALYSIS_PROMPT = `You are analysing a Planguage Spec from the SEM App for Resources stage sharpening. The user is Tom Gilb (the author of Planguage). You operate locally on Tom's machine per the SEM App's Claude-Code-as-AI-Layer SUPREME rule — no external API calls; you ARE the AI layer.

INPUT: a SpecBlock JSON (functions, values, solutions, constraints) plus any existing R. (Resource) entries plus the captured cost data from prior stages (calendar costs, capital costs, V/C ratios).

TASK PART A — ANALYTICAL DIMENSIONS: produce a structured Resources Sharpening analysis covering these 9 dimensions: calendar-time, work-hours, human-specialists, technical-debt, future-maintenance, decommissioning, roi, efficiency, tradeoffs.

TASK PART B — GENERATIVE TOOLS: also produce output for each of these 5 generative tools: resource-constraint-specs (tighten Budgets + Tolerables on existing R. entries with Who/Where/What/How qualifiers), scale-and-meter-improvement (sharpen Scale + Meter on every V. and R. entry), resource-management-strategies (propose NEW S. entries that primarily affect Resources, with expected savings), binary-constraints-for-resources (propose NEW C. entries that protect Resources with expected effects), scale-qualifiers (audit every entry against the canonical 4 qualifier dimensions Who/Where/What/How and propose qualified Scale strings).

For EACH dimension produce a JSON object with this shape:

  {
    "dimensionId": "calendar-time" | "work-hours" | …,
    "findings": [
      {
        "title":       "Concise headline of the finding",
        "description": "What you observed in the spec",
        "severity":    "info" | "suggestion" | "warning" | "critical",
        "source":      "derived-from-plan" | "cited-from-gilb" | "llm-training" | "internet-fetched" | "generic-template",
        "gilbCite":    "Book + chapter + page when source = cited-from-gilb",
        "proposedREntry": {
          "id":          "R.…",
          "scale":       "…",
          "tolerable":   "…",
          "goal":        "…",
          "rationale":   "…"
        } | null,
        "tradeoff": {
          "axis":        "Value name or Constraint id",
          "give":        "What to give up",
          "save":        "What is saved",
          "approvedBy":  "Stakeholder name(s) who must approve"
        } | null
      }
    ]
  }

RULES:
1. Pass the Planguage structure rigorously — do not paraphrase F./V./S./C. content into prose.
2. Every "cited-from-gilb" source must be a REAL Gilb reference (Competitive Engineering [CE, 2005], EVO 2024, Value Improvement, SUCCESS, Stakeholder Engineering [SE], PoSEM, Software Metrics, Cost Engineering, Optima, Systems Enterprise Architecture [SEA]).
3. Never hallucinate a citation. If you do not know the exact page, omit the citation rather than invent it.
4. For the "tradeoffs" dimension, every finding should have a populated tradeoff{} field.
5. Output JSON only — no prose around it.`
