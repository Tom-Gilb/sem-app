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
  /**
   * Suggested answers — one sub-array per question (index-matched to `questions`).
   * Each sub-array contains 3-5 actionable Planguage-syntax answers with Gilb citations.
   * Optional for backward compatibility; callers degrade gracefully when absent.
   */
  suggestedAnswers?: string[][]
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
    suggestedAnswers: [
      // Q0: What is the deadline (Goal date) for each Value to reach Goal level?
      [
        'Goal date: end of Q2 calendar year (specific named quarter, not "as soon as possible"). Scale = calendar date; Goal [Stakeholder = Sponsor, Condition = full integration test passed] = 2026-06-30. (CE 2005, Resource chapter — Goals must be calendar-dated, not open-ended.)',
        'Use the market window to set the Goal: identify the latest date before which customers will pay the premium price. That date minus 3 weeks (delivery buffer) is your Goal. R.LaunchWindow: Scale = calendar date; Goal [Stakeholder = Sales Director, Condition = trade-show window] = 2026-09-01. (CE 2005 — Resource Budget as market-window constraint.)',
        'Compute backwards from the desired Evo Step launch, not forwards from today. Goal date = start of Evo Step N where this Value is first measurable in production. E.g. V.SpeedUnderSail Goal date = start of Evo Step 3 = 2026-08-15. (EVO 2024 ch.2 — Value Delivery per Evo Step calendar.)',
        'Goal [Stakeholder = Regulatory Body, Condition = EU compliance window] = 2026-09-01 (regulatory soft deadline); Tolerable = 2026-12-31 (hard enforcement date). Distinguish soft-Goal from hard-Tolerable — missing Tolerable is a Constraint violation. (CE 2005 — Resource Tolerable as hard limit.)',
      ],
      // Q1: What is the latest acceptable date (Tolerable) before stakeholders are harmed?
      [
        'R.DeliveryTolerable: Scale = calendar date; Tolerable [Stakeholder = Client, Condition = contract penalty clause] = 2026-07-31. Any date beyond this triggers a financial penalty — that is the definition of Tolerable. (CE 2005 — Tolerable as "harm threshold", not "preferred" threshold.)',
        'Ask each named stakeholder: "On what date does late delivery start costing you money or reputation?" Their answer is the Tolerable. Document it verbatim with their name as the qualifier: Tolerable [Stakeholder = Port Authority] = 2026-10-01. (SE, Stakeholder Engineering — stakeholder-name qualification of thresholds.)',
        'Tolerable = Goal + maximum acceptable slip. If Goal = 2026-06-30 and the sponsor can absorb a 6-week slip without board escalation, Tolerable = 2026-08-11. State the slip explicitly so it is reviewable. (EVO 2024 ch.2 — Tolerable level sets the outer calendar bound per Evo Step.)',
        'For regulated industries: Tolerable = last legal compliance date. E.g. GDPR deadline = Tolerable [Stakeholder = Data Protection Authority, Condition = first data-subject access] = 2026-05-25. Missing Tolerable here is a C. violation, not just a schedule slip. (CE 2005 — Constraint vs Resource Tolerable distinction.)',
      ],
      // Q2: Which Evo Steps sit on the critical path of the calendar?
      [
        'A step is on the critical path if any slip in it directly delays a V. Goal date. List all Evo Steps; for each ask: "If this step finishes 1 week late, does the calendar Goal for any Value slip?" Those that answer YES are critical. (EVO 2024 ch.2 — critical-path Evo Step identification.)',
        'Use the dependency chain: Step N is critical if it is a prerequisite for Step N+1 AND Step N+1 delivers the highest-priority Value. Mark critical steps in the spec with a C.CriticalPath Constraint: C.NoSlipInEvoStep3 [Condition = all predecessor steps complete on time]. (CE 2005 — Constraint to enforce critical-path discipline.)',
        'Critical path = the chain of Evo Steps with zero float. Float(Step) = Tolerable(downstream Value) − earliest-possible-finish(Step). Any step where Float ≤ 0 is critical. Compute this for each step before committing to the calendar. (EVO 2024 ch.7 — VDT prioritisation by calendar float.)',
        'Specialist-gated steps are almost always critical — they have zero float because the specialist cannot be compressed or parallelised. Flag every step that requires a named human with no substitute as automatically critical. (SE — single-point-of-specialist risk on critical path.)',
      ],
      // Q3: Are there fixed external dates (regulator, market window, contract clause)?
      [
        'External fixed dates must become Constraint entries, not Resource entries — they are binary. C.RegulatoryFilingDeadline [Stakeholder = SEC, Date = 2026-09-30, Condition = fiscal-year-end filing] = must be met with no exception. Constraints cannot be traded off; Resources can. (CE 2005 — Constraint vs Resource Tolerable distinction.)',
        'Market windows are typically R. entries with a short Tolerable range: R.MarketEntryWindow: Scale = calendar date; Tolerable = 2026-10-15 (market closes to new entrants after trade show). Capture both the Goal (earliest valuable entry) and Tolerable (last viable entry). (CE 2005 — Resource Goal vs Tolerable.)',
        'Contract penalty clauses are the clearest external fixed dates. Read every signed contract and extract: (a) delivery date, (b) penalty type (liquidated damages, SLA credit, termination right), (c) cure period. Each becomes a named R. entry with Tolerable = penalty trigger date. (CE 2005 — Resource specification from contract obligations.)',
        'Regulatory renewal cycles (annual audits, biennial certifications, quarterly filings) set a repeating calendar: R.AnnualComplianceAudit: Scale = days before audit date all evidence is ready; Goal ≤ 30 days before audit; Tolerable ≤ 7 days before audit. Model repeating external dates as recurring R. entries, not one-off milestones. (CE 2005 — Resource entries for recurring obligations.)',
      ],
    ],
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
    suggestedAnswers: [
      // Q0: How many hours per role does each Evo Step consume?
      [
        'Build a matrix: rows = Evo Steps, columns = roles (Lead Engineer, QA, Designer, PM). Each cell = estimated hours. Sum columns = per-role total; sum rows = per-step total. Any cell > 80 h/step/person signals over-allocation risk. (EVO 2024 ch.2 — Evo Step resource assignment; CE 2005 — Resource per role.)',
        'Use prior-step actuals as the Meter for future estimates: R.WorkHours.BackendPerStep: Scale = engineer-hours/Evo-Step; Meter [Method = time-tracker actuals from completed steps; Condition = steps of similar scope]; Goal = 120 h/step. Calibrate forward from real data, not from optimistic estimates. (Software Metrics 1988 — calibrated estimation from prior data.)',
        'Establish a per-step budget cap before the step starts: C.MaxHoursPerEvoStep [Role = engineer, Threshold = 200 h] — if a step is scoped larger than this, split it. Planguage Evo Steps are deliberately small; large steps indicate scope creep in the spec. (EVO 2024 ch.2 — small Evo Step principle; CE 2005 — Constraint to cap step size.)',
        'Distinguish parallel effort (multiple people working simultaneously) from serial effort (one person, sequential tasks). 3 engineers × 40 h = 120 engineer-hours BUT only 40 calendar-hours if perfectly parallel. State both: R.WorkHours.Backend: Scale = engineer-hours (effort); R.CalendarDays.Backend: Scale = calendar-days (duration). (PoSEM ch.9 — effort vs calendar separation.)',
      ],
      // Q1: What is the total project work-hour budget? Per quarter?
      [
        'R.TotalWorkHourBudget: Scale = engineer-hours across all roles; Tolerable [Stakeholder = CFO, Period = FY26] = 8000 h; Goal [Stakeholder = Project Lead, Period = FY26] = 5500 h. The gap between Tolerable and Goal is the contingency buffer — state it explicitly. (CE 2005 — Resource Budget with Tolerable and Goal.)',
        'Quarterly sub-budgets prevent back-loading risk: R.WorkHours.Q1: Goal = 1200 h; R.WorkHours.Q2: Goal = 1800 h. If Q1 actuals exceed Q1 Goal, raise an alarm before Q2 starts — do not assume it will "average out." (EVO 2024 ch.2 — per-Evo-Step resource tracking; CE 2005 — Resource budget per period.)',
        'Total budget = sum of all R.WorkHours entries across all roles and all Evo Steps. If this sum exceeds the Tolerable, the plan is infeasible and requires either: (a) scope reduction in V. Goals, (b) new S. entries to reduce effort, or (c) additional R. (more people). State the infeasibility explicitly — do not hide it. (CE 2005 — Resource feasibility check.)',
        'Include non-productive hours: R.AdminOverhead: Scale = engineer-hours/quarter consumed by meetings + reporting; Goal ≤ 15% of total hours. Subtract from productive budget: Productive hours = Total hours − AdminOverhead. Using gross hours as the budget is a common planning error. (Software Metrics 1988 — productive vs total effort distinction.)',
      ],
      // Q2: Are hours allocated to specialists who are also on other projects?
      [
        'Build a specialist availability table: Specialist name | Project A % | Project B % | Available % | SEM commitment needed %. If Available % < SEM commitment needed %, you have a Resource Constraint violation before the project starts. Make it visible. (SE — specialist availability as a Resource constraint.)',
        'R.SpecialistAvailability.NavalArchitect: Scale = % of working hours available to this project; Tolerable ≥ 40%; Goal ≥ 70%. If actuals fall below Tolerable, the R. budget is breached — trigger a renegotiation with the sponsor of the competing project. (CE 2005 — Resource Tolerable as breach trigger.)',
        'C.NoSharedSpecialistOnCriticalPath [Condition = Evo Steps 1-3, Role = Lead Naval Architect] — prevents the critical-path specialist from being diluted across projects during the highest-risk phase. A named Constraint forces the conversation upfront, not mid-crisis. (CE 2005 — Constraint protecting Resource availability.)',
        'Model sharing as a cost: if Specialist X is 50% available, their effective hourly rate doubles (their attention cost is higher, context-switch overhead is real). R.ContextSwitchOverhead: Scale = % capacity lost to context switching; Goal ≤ 10% for any specialist on a critical Evo Step. (Software Metrics 1988 — context-switch overhead in effort estimation.)',
      ],
      // Q3: What is the cost per work-hour by role (loaded rate)?
      [
        'Loaded rate = salary + benefits + overhead + tooling + management allocation. Never use bare salary as your cost — the loaded rate is typically 1.5-2.5× bare salary for full-time employees, and 1.0-1.2× invoice rate for contractors (no benefits overhead). R.CostPerHour.BackendEngineer: Scale = USD/hour (loaded); Goal = $95/h. (CE 2005 — Resource cost specification with loaded rate.)',
        'Use loaded rates to convert work-hour budgets to dollar budgets for the ROI calculation: Dollar cost = Σ(role hours × loaded rate). This connects the work-hours dimension directly to the ROI dimension. Without loaded rates, ROI cannot be computed rigorously. (CE 2005 — Resource cost as ROI input; Value Improvement 2024 — V/C ratio requires cost in same units as Value.)',
        'Different roles have different loaded rates — do not average them. A senior architect at $150/h and a junior developer at $65/h have very different cost implications per Evo Step. Track costs at role granularity, not at "team average." (CE 2005 — Role-specific Resource cost specification.)',
        'Include contractor premium costs: C.ContractorRateCapPerRole [Role = UX Designer, Threshold = $120/h] — prevents scope creep in contractor costs. A named Constraint on contractor rates forces a competitive-tender decision rather than a single-source default. (CE 2005 — Constraint as cost-cap mechanism.)',
      ],
    ],
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
    suggestedAnswers: [
      // Q0: Which skills are needed that only 1-3 people on the team can do?
      [
        'Audit each Evo Step: list every task, then for each task ask "who on the team can do this?" If the answer is ≤ 3 people, that skill is a specialist dependency. Document: R.Specialist.X: Scale = people with this skill available; Tolerable ≥ 1; Goal ≥ 2. (SE — specialist as Resource; CE 2005 — Resource specification for scarce roles.)',
        'Check certification and regulatory requirements: some skills require licensed practitioners (structural engineer, registered nurse, chartered accountant). These are automatically specialist dependencies regardless of team size. R.Specialist.LicensedEngineer: Scale = licensed engineers committed; Tolerable ≥ 1 [Condition = all phases requiring sign-off]. (CE 2005 — Constraint for regulated specialist roles.)',
        'Look for implicit specialists: the person who "knows how this codebase works" or "has the relationship with that client." These informal specialists are risk-invisible until they go on leave. Capture them: R.Specialist.CriticalKnowledgeHolder: Scale = named people who can answer domain questions independently; Tolerable ≥ 2. (SE — knowledge as a specialist Resource.)',
        'Rate each specialist dependency by substitution lag: how long does it take to bring a substitute to the same effectiveness? Under 1 week = low risk; 1-4 weeks = moderate; > 4 weeks = critical. Critical specialist dependencies must appear as C. entries to prevent their simultaneous unavailability. (CE 2005 — Constraint protecting specialist continuity.)',
      ],
      // Q1: What is the maximum concurrent demand on each specialist?
      [
        'Map the Evo Step calendar horizontally, and each specialist vertically. For each calendar week, sum the hours demanded from each specialist across all concurrent Evo Steps. If demand > capacity in any week, you have an over-allocation — a Resource Constraint violation before the project starts. (EVO 2024 ch.2 — Evo Step resource calendar; CE 2005 — Resource demand vs capacity check.)',
        'R.Specialist.ArchitectPeakDemand: Scale = concurrent projects requiring architect attention; Tolerable ≤ 2 [Period = any single week]; Goal = 1 [Period = critical-path Evo Steps]. Exceeding the Tolerable triggers a step-sequencing decision — never absorb it silently. (CE 2005 — Resource Tolerable as breach trigger.)',
        'C.MaxConcurrentSpecialistDemand [Role = Lead Architect, Threshold = 2 projects simultaneous] — a named Constraint that prevents the project manager from double-booking the specialist without a formal decision. Constraints make invisible over-allocation visible. (CE 2005 — Constraint as Resource-protection mechanism.)',
        'Peak demand often occurs at testing/sign-off phases when multiple Evo Steps converge for review. Plan specialist capacity at 80% of stated availability to absorb this convergence: Goal ≤ 80% utilisation [Period = any 4-week window]. The 20% buffer prevents the cascade failure where one slip triggers a chain of specialist conflicts. (EVO 2024 ch.2 — Evo Step slack and buffer planning.)',
      ],
      // Q2: What is the cost of acquiring or training a substitute?
      [
        'Cost of acquiring a substitute = recruiter fee (typically 15-25% first-year salary) + onboarding time + productivity ramp (typically 3-6 months to full effectiveness). R.SubstitutionCost.NavalArchitect: Scale = USD (total cost to hire + ramp to full effectiveness); Goal ≤ $45k. Use this to decide whether cross-training is cheaper. (CE 2005 — Resource cost comparison for make-vs-buy decisions.)',
        'Cost of training a substitute = training course fee + mentor time + ramp-up period at reduced productivity. For most specialist skills: training cost < hiring cost. R.CrossTrainingCost.SteamEngineering: Scale = USD (course + 3-month mentor allocation); Goal ≤ $12k per backup engineer. Build the business case before arguing it verbally. (CE 2005 — Resource investment for redundancy.)',
        'Compare substitute cost against the cost of a 2-week plan slip caused by specialist absence: Slip cost = [number of delayed Evo Steps × cost per day × days delayed] + [contract penalties, if any]. If Slip cost > Substitute cost, acquire or train a substitute. Make this calculation explicit. (CE 2005 — Cost Engineering tradeoff framework.)',
        'For regulated specialists (licensed architect, GDPR officer, qualified auditor): acquisition is slower and costlier than for generic roles. Model the lead time: R.SpecialistLeadTime.QualifiedAuditor: Scale = weeks from decision to hire to ready to work; Tolerable ≤ 8 weeks; Goal ≤ 4 weeks. Long lead times must be started early — add them as early Evo Step dependencies. (SE — specialist Resource with long acquisition lead time.)',
      ],
      // Q3: What happens to the plan if specialist X is unavailable for 2 weeks?
      [
        'Run a Named-Specialist Absence Analysis: for each critical specialist, identify every Evo Step they appear in, then ask "if they were absent for 2 weeks at the worst possible time, what is the maximum schedule slip and cost impact?" Document as a scenario: Scenario.NavalArchitectAbsence: Impact = 3-week slip on Evo Step 2; Cost = $18k day-rate for emergency contractor cover. (CE 2005 — Resource sensitivity analysis.)',
        'Use the analysis result to decide the mitigation: (a) cross-train a backup, (b) arrange a preferred-substitute contract with an external firm, or (c) reschedule the most vulnerable Evo Steps to reduce dependency. Document the chosen mitigation as an S. entry: S.SpecialistBackupContract: description = retainer agreement with [Firm] for 2-week emergency cover. (CE 2005 — Solution to Resource risk; SE — specialist mitigation strategy.)',
        'The 2-week absence test should become a Constraint: C.SpecialistAbsenceContingency [Role = Lead Naval Architect, Condition = planned absence > 3 days] — requires a documented backup arrangement to be in place before the absence date. The Constraint forces the governance process without requiring it to be manually remembered. (CE 2005 — Constraint as governance mechanism.)',
        'If the plan cannot tolerate a 2-week absence of Specialist X, that is a project risk that must be surfaced to the Sponsor — it is not a team-internal matter. Write the risk as a V. entry: V.ProjectScheduleResilience: Scale = % of key Values still on-track if any single specialist is absent for 2 weeks; Tolerable ≥ 90%; Goal = 100%. This forces the sponsor to fund the mitigation or accept the risk. (CE 2005 — Value + Resource interaction; SE — stakeholder risk escalation.)',
      ],
    ],
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
    suggestedAnswers: [
      // Q0: Which Evo Steps explicitly defer quality work to "later"?
      [
        'Audit every S. (Solution) entry for phrases like "basic implementation", "MVP version", "simplified", "without tests", "temporary workaround." Each is a debt signal. Create a corresponding R.TechDebt.X entry for each, naming the deferred work: R.TechDebt.AuthorizationModule: Scale = weeks of full-security refactor deferred; Now = 3 weeks deferred from Evo Step 1. (CE 2005 — defect and debt as Resource; PoSEM — deferred-inspection cost.)',
        'Check the Evo Step calendar: any step explicitly labelled "Phase 1 / Phase 2" where Phase 2 is not yet scheduled is a debt-creation event. The debt is: work committed but not funded. R.TechDebt.Phase2Backlog: Scale = S. entries deferred to an unscheduled future step; Tolerable = 0 unscheduled; Goal = 0. (EVO 2024 ch.2 — all Evo Steps must be scheduled to be real.)',
        'Look for Evo Steps where the Meter is "manual testing" or "developer spot-check" rather than automated verification. Every step without automated test coverage is accruing debt on the Meter. R.TechDebt.AutomatedCoverage: Scale = % of F. entries covered by automated tests; Now = 25%; Tolerable ≥ 60%; Goal ≥ 90%. (PoSEM Inspection ROI — automated inspection amortises debt exponentially.)',
        'Interview each Evo Step lead: "What would you do differently if you had 20% more time on this step?" The answer is almost always the implicit debt. Convert each answer to a named R.TechDebt entry with a cost estimate. Implicit debt that becomes explicit is 50% solved — it can now be scheduled and budgeted. (CE 2005 — debt quantification as Resource entry.)',
      ],
      // Q1: What is the estimated cost (hours, dollars) of paying back each piece of debt?
      [
        'Payback cost = hours required to bring the artefact to its full-quality standard. For code: coverage gap × lines per test × minutes per line. For documentation: pages missing × hours per page. State as: R.TechDebt.UnitTests: Scale = engineer-hours to reach 80% coverage; Now = 120 h outstanding; Goal = 0. (CE 2005 — defect cost calculus; PoSEM Inspection ROI — cost of late vs early quality work.)',
        'Apply the cost-of-defect-at-later-stage multiplier from CE 2005: a defect found in design costs 1×; found in testing costs 10×; found in production costs 100×. Debt deferred past Evo Step N therefore costs 10-100× more per unit than addressing it now. Compute: Total deferred debt cost = [debt units] × [stage-multiplier] × [unit cost]. Make the inflation explicit. (CE 2005 — defect cost escalation across lifecycle stages.)',
        'R.TechDebt.AuthorizationRefactor: Scale = USD cost to complete full security refactor; Now = $12k (estimated from 80 engineer-hours × $150/h loaded rate); Goal = completed by Evo Step 4 at ≤ $12k. Expressing debt in USD makes it comparable to the ROI of new features — it competes for budget explicitly. (CE 2005 — Resource cost in consistent units; Value Improvement 2024 — cost denominator for V/C ratio.)',
        'Use the Inspection ROI argument to justify early payback: PoSEM shows that 1 hour of review/inspection prevents 3-10 hours of debugging. R.InspectionROI: if $5k inspection cost now prevents $30k-$50k production-defect cost, the ROI on debt payback is 6-10×. Present this ratio to the Sponsor when asking for debt-reduction budget. (PoSEM Inspection ROI chapter — inspection investment vs defect cost.)',
      ],
      // Q2: Which debt items will block which future V. goals?
      [
        'For each R.TechDebt entry, trace forward: which V. entry has a Goal that cannot be achieved until this debt is resolved? State the dependency explicitly: R.TechDebt.AuthorizationModule blocks V.DataPrivacy Goal ≥ 99.9% [Condition = GDPR-compliant]. This link forces the debt into the priority queue whenever V.DataPrivacy is prioritised. (EVO 2024 ch.7 — VDT dependency chains; CE 2005 — Resource blocking a Value.)',
        'Build a Debt-Blocks-Value matrix: rows = R.TechDebt entries, columns = V. Goals. Cell = "blocks", "slows" or empty. Any V. Goal with a "blocks" cell cannot reach its Goal level until the debt is resolved. Use this matrix to sequence debt-payback Evo Steps ahead of the blocked Value Evo Steps. (EVO 2024 ch.7 — VDT prioritisation with blocking dependencies.)',
        'C.NoProdDeploymentWithBlockingDebt [Condition = any R.TechDebt entry marked "blocks" a live V. Goal] — a named Constraint that prevents production deployment while a blocking debt exists. This converts a good intention into an enforceable gate. (CE 2005 — Constraint as quality gate.)',
        'Debt that only "slows" (rather than "blocks") a V. Goal can be managed differently: schedule the payback in the same Evo Step as the Value delivery, allocating 10-20% of step budget to debt payback. This prevents infinite debt accumulation without stopping feature delivery. (EVO 2024 ch.2 — Evo Step budget allocation; CE 2005 — debt management as Resource planning.)',
      ],
      // Q3: Is the debt explicit (logged) or implicit (only known by the implementer)?
      [
        'Explicit debt: an R.TechDebt entry exists in the spec with a named cost and a scheduled payback Evo Step. Implicit debt: someone on the team knows about it but it has never been written down. Run a team debt-capture session: each person names 3 things they know are "owed" to the codebase/spec. Convert every answer to a named R.TechDebt entry before the session ends. (CE 2005 — Resource must be named to be managed.)',
        'C.AllDebtMustBeLogged [Condition = any deferred-quality decision made during an Evo Step, Period = within 24 hours of the decision] — a named Constraint that prevents implicit debt accumulation. The Constraint moves debt disclosure from a cultural aspiration to a governed obligation. (CE 2005 — Constraint as governance for Resource management.)',
        'Implicit debt is dangerous because it does not appear in V/C ratios, is invisible to the Sponsor, and is forgotten when the person who knows leaves. The cost of making it explicit is trivial (30 minutes to write the entries); the cost of forgetting it is compounding. Default rule: if it is not in the spec, it does not exist. (CE 2005 — "unspecified = non-existent" principle.)',
        'R.ImplicitDebtCount: Scale = number of known informal debt items not yet captured as R.TechDebt entries; Tolerable ≤ 5; Goal = 0. Measure this by running a quarterly debt-discovery session. The metric is the incentive: if 0 is the Goal, the team writes down the debt rather than accumulating it silently. (Software Metrics 1988 — measuring the unmeasured to make it manageable.)',
      ],
    ],
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
    suggestedAnswers: [
      // Q0: What is the estimated annual maintenance cost (in hours and dollars) for each Solution?
      [
        'For each S. entry, ask the implementing team: "What is the expected annual effort to keep this working — patching, monitoring, support, upgrades?" Convert to: R.MaintHours.X: Scale = engineer-hours/year; Goal = [estimate with 20% contingency]. Never omit the contingency — maintenance estimates are optimistic by design. (CE 2005 — lifecycle Resource specification; Cost Engineering — maintenance cost estimation.)',
        'Use a maintenance-fraction rule-of-thumb as a first estimate: enterprise software maintenance typically runs 15-20% of build cost per year; hardware typically runs 5-10% of replacement cost per year. Apply the fraction to each S. entry\'s build cost to derive R.MaintCost.X: Goal ≤ 18% of build cost [Period = year 1-5]. Revise with actuals as they become available. (Cost Engineering — maintenance cost as a fraction of build cost.)',
        'Distinguish reactive maintenance (fixing failures) from proactive maintenance (preventing failures). R.ReactiveMaint.SteamPlant: Scale = USD/year for unplanned repairs; Goal ≤ $15k/year. R.ProactiveMaint.SteamPlant: Scale = USD/year for scheduled inspections + part replacements; Goal ≤ $25k/year. The split matters: reactive costs are volatile and can spike; proactive costs are controllable. (CE 2005 — Resource with qualifiers for maintenance type.)',
        'Include the cost of staying current: software libraries need updates; hardware needs firmware patches; documentation needs revision. R.CurrencyMaintCost.SoftwareStack: Scale = engineer-hours/year to keep dependencies current and secure; Goal ≤ 80 h/year [Condition = no major framework version changes]. A system that falls behind on currency accrues a form of technical debt. (CE 2005 — lifecycle maintenance Resource; PoSEM — inspection-equivalent for currency management.)',
      ],
      // Q1: How long is the asset expected to operate? 5, 10, 25 years?
      [
        'Define lifecycle explicitly: R.AssetLifecycle.X: Scale = years of planned operation from first production use; Goal = 10 years; Tolerable ≥ 7 years [Condition = no obsolescence forcing earlier replacement]. The Goal drives decommissioning planning; the Tolerable is the minimum viable lifecycle to justify build cost. (CE 2005 — Resource lifecycle specification; Cost Engineering — TCO over lifecycle horizon.)',
        'Use the lifecycle to compute Total Cost of Ownership: TCO = Build cost + Σ(Annual maintenance cost × Lifecycle years) + Decommission cost. If TCO of Solution A is lower than Solution B despite Solution A having a higher build cost, the lifecycle comparison changes the decision. Build this comparison before selecting Solutions. (Cost Engineering — TCO framework; CE 2005 — lifecycle cost comparison for Solution selection.)',
        'Challenge the lifecycle assumption: who decided 10 years? If the technology is on a 3-year depreciation curve but the plan assumes 10 years, there is a hidden replacement cost in years 4-10. R.AssetLifecycle: Meter [Method = annual review by CTO/technical authority; Condition = if core technology generation changes] — lifecycle assumptions must be revisited, not frozen. (CE 2005 — Resource review cadence; Cost Engineering — lifecycle uncertainty management.)',
        'Lifecycle directly determines maintenance budget. A 5-year asset justifies lower maintenance investment than a 25-year one — the amortisation math is different. R.LifetimeMaintenanceBudget: Scale = USD (total maintenance across entire lifecycle); Goal ≤ [build cost × 1.5] for a 10-year asset. Exceeding 1.5× suggests the Solution should be replaced, not maintained. (Cost Engineering — TCO threshold; CE 2005 — replacement vs maintenance decision.)',
      ],
      // Q2: Who pays maintenance — the same budget that paid build, or a different one?
      [
        'The most common maintenance-planning failure: the build team says "OpEx will handle it" and the OpEx budget says "we didn\'t know about this." Resolve this before launch: name the budget owner explicitly. C.MaintenanceBudgetOwner [Solution = X, Role = Operations Manager] = named person who has committed to fund annual maintenance. A Constraint converts the verbal commitment to a governance obligation. (CE 2005 — Constraint for Resource ownership; SE — stakeholder accountability for Resource.)',
        'If maintenance is funded from a different budget than build, model the hand-off: R.MaintenanceHandoffCost: Scale = USD (cost of knowledge transfer, documentation, and support onboarding from build team to maintenance team); Goal ≤ $8k. Unplanned hand-offs are expensive — typically 15-25% of annual maintenance cost is consumed in the first 6 months by the new team learning the system. (CE 2005 — Resource transition cost; Cost Engineering — knowledge transfer cost.)',
        'Split budget ownership creates incentive misalignment: the build team optimises for low build cost, not low maintenance cost, because maintenance is "someone else\'s problem." Counter this with a shared-skin-in-the-game structure: require the build team to forecast R.MaintCost.X and have that forecast reviewed and approved by the maintenance budget owner before sign-off. (CE 2005 — stakeholder alignment on lifecycle cost; SE — budget-owner as stakeholder with V. Goals on maintenance cost.)',
        'C.NoLaunchWithoutMaintenanceFunding [Condition = Solution X, Date = first production deployment] — prevents launch unless the maintenance budget is committed in writing. This is the single most effective Constraint against the "we\'ll figure out maintenance later" failure mode. (CE 2005 — Constraint as launch gate for Resource funding.)',
      ],
      // Q3: Which Solutions have lower-cost-of-ownership alternatives we did not pick?
      [
        'Run a TCO comparison for every S. entry where a lower-cost alternative exists: compare [chosen Solution TCO] vs [alternative Solution TCO] using the same lifecycle horizon. If the alternative TCO is ≥ 20% lower and its V. impact is acceptable, surface it to the Sponsor as a tradeoff: "Alternative S.B costs $X less over 10 years at a V.Y impact of [reduction]." (Cost Engineering — TCO comparison; CE 2005 — Solution selection with lifecycle cost.)',
        'Managed services and SaaS often have lower TCO than self-hosted Solutions — the maintenance cost is included in the subscription. Compare: R.TCO.SelfHosted vs R.TCO.SaaSAlternative: Scale = USD/year (all-in); Goal = whichever is lower [Condition = V. Goals are equally met]. The key question is whether the V. Goals are equally met — if yes, choose the lower TCO. (Cost Engineering — build vs buy vs SaaS TCO analysis.)',
        'Open-source Solutions have zero licensing cost but non-zero support cost. R.SupportCost.OpenSourceDB: Scale = USD/year for internal expertise + community-support subscription; Goal ≤ $12k/year. Compare this against the licensing cost of a commercially-supported alternative: R.LicenseCost.CommercialDB: Goal ≤ $20k/year. If the delta is < $8k/year and the commercial option carries SLA guarantees, the commercial option may be lower-risk despite higher licensing cost. (CE 2005 — full-cost Resource comparison.)',
        'Modular Solutions typically have lower TCO than monolithic ones — components can be replaced independently without full rebuild. When selecting between a modular and a monolithic Solution, estimate: R.ModularReplacementCost: Scale = USD to replace one module without touching others; Goal ≤ 15% of full-system build cost. Monolithic systems where replacement = full rebuild have a TCO liability that should be named in the spec. (CE 2005 — architectural Resource implications; Optima — modularity as TCO optimisation.)',
      ],
    ],
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
    suggestedAnswers: [
      // Q0: What is the planned end-of-life date for each Solution?
      [
        'R.EndOfLife.X: Scale = calendar date; Goal = [planned retirement date]; Tolerable = [latest acceptable retirement — beyond this the system poses an operational or regulatory risk]. Both must be stated: Goal is the plan; Tolerable is the safety boundary. (CE 2005 — Resource with Goal and Tolerable dates; Optima — lifecycle boundary definition.)',
        'End-of-life date is driven by: (a) hardware obsolescence (vendor support end date), (b) software end-of-support (vendor security patch deadline), (c) contractual obligation (service agreement termination date), or (d) business decision (product retirement). Document which driver applies: R.EndOfLife.Database: Scale = date; Tolerable = vendor EOL date [Vendor = Oracle, Version = 12c] = 2027-12-31. (CE 2005 — Resource with external-driver qualification.)',
        'Challenge the implicit assumption that the current system will "keep running forever." Ask: what happens if we do NOT actively decommission it? Model the risk: if no decommission plan exists by [date], the cost of forced decommission (security incident, compliance failure, vendor abandonment) is [estimate]. This flips the default from "ignore decommissioning" to "fund the planned option." (CE 2005 — Resource risk of omission; Optima — cost of no decommission plan.)',
        'Systems that replace the current one need the decommission date of the old system to be set before the new system is built — otherwise migration is never fully complete. C.OldSystemDecommissionDate [Condition = new Solution X goes live, Period = within 6 months of go-live] — a named Constraint that prevents the organisation from running parallel systems indefinitely. (CE 2005 — Constraint for decommission timeline.)',
      ],
      // Q1: What is the cost of decommissioning (removal, disposal, data migration, contract exits)?
      [
        'Decommission cost has four components: (1) Removal cost: labour to shut down, uninstall, and physically remove. (2) Data migration cost: moving data to the successor system. (3) Contract exit cost: early-termination fees, residual licence costs. (4) Disposal cost: responsible disposal of hardware, including e-waste fees. State each separately: R.DecommCost.DataMigration: Scale = USD; Goal ≤ $15k. (CE 2005 — Resource with component-level specification.)',
        'Data migration is typically the most expensive decommission component for software systems. Estimate: R.DataMigrationCost: Scale = USD; Now = [baseline estimate]; Goal ≤ $X [Condition = data volume ≤ Y GB, schema changes ≤ Z tables]. Include data validation cost: migrated data that cannot be verified as complete and accurate is a downstream quality risk. (CE 2005 — Resource cost specification; Cost Engineering — migration cost estimation.)',
        'Contract exit costs are often hidden: check every vendor contract for early-termination clauses, minimum-commitment periods, and notice requirements. R.ContractExitCost.X: Scale = USD; Goal ≤ $8k [Condition = 90 days notice, no breach of minimums]. Renegotiating exit terms at signing is far cheaper than paying penalties at exit. (CE 2005 — Resource specification from contract obligations.)',
        'C.AllSystemsHaveDecommissionCostEstimate [Condition = any new S. entry approved for build, Period = within the same Evo Step] — requires a decommission cost estimate before any Solution is approved. This prevents the perpetual "we\'ll think about that later" default. The estimate can be rough (+/-50%) but must exist. (CE 2005 — Constraint for Resource completeness.)',
      ],
      // Q2: Are there regulatory disposal obligations (GDPR data delete, environmental cleanup)?
      [
        'GDPR data deletion: C.GDPRDataPurge [Stakeholder = Data Protection Authority, Condition = service end, Scale = days to full purge] — Tolerable ≤ 30 days; Goal ≤ 7 days. The purge is binary (either done or not done) but the timeline for completion is scalar. Model both the binary obligation (C.) and the timeline Resource (R.). (CE 2005 — Constraint + Resource for regulatory obligations; SE — regulatory body as stakeholder.)',
        'Environmental regulations: hardware disposal is subject to WEEE (Waste Electrical and Electronic Equipment) regulations in the EU and equivalent laws elsewhere. R.EWasteDisposalCost: Scale = USD; Goal ≤ $2k [Condition = all hardware certified disposed through licensed recycler]. Retain disposal certificates — auditors require them. (CE 2005 — regulatory Resource with compliance evidence.)',
        'Data residency regulations may require data to be destroyed in the jurisdiction where it was held, not centralised and destroyed elsewhere. C.DataDestructionJurisdiction [Stakeholder = Data Protection Authority, Condition = EU user data] = must be destroyed on EU-resident infrastructure. This Constraint may add to decommission cost but cannot be waived. (CE 2005 — Constraint for regulatory compliance; SE — regulatory stakeholder.)',
        'Industry-specific obligations: healthcare (HIPAA — retain for 6 years then destroy), finance (SOX — retain for 7 years then destroy), legal (bar association — varies by jurisdiction). These create a two-phase lifecycle: RETAIN phase + DESTROY phase with specific timelines. R.DataRetentionCost: Scale = USD/year for compliant retention; R.DataDestructionCost: Scale = USD for compliant destruction at retention end. (CE 2005 — Resource for each lifecycle phase; SE — regulatory body as stakeholder with specific V. entry requirements.)',
      ],
      // Q3: Who pays decommissioning — current budget, sinking fund, or a future budget yet unfunded?
      [
        'The worst answer: "a future budget yet unfunded." That is the guaranteed path to either (a) the system never being decommissioned (running indefinitely at growing cost and risk) or (b) forced decommission under crisis conditions (data breach, vendor abandonment, compliance deadline) at 5-10× the planned cost. Name the funding source now. (Cost Engineering — decommission cost must be funded in the period when the build is approved, not later.)',
        'Sinking fund model: set aside a fixed amount per year into a ring-fenced budget. R.DecommSinkingFund: Scale = USD/year; Goal = [Total Decommission Cost / Lifecycle Years]. At end-of-life, the fund is sufficient. Example: if decommission will cost $25k in 10 years, fund $2.5k/year. (Cost Engineering — sinking fund as decommission Resource planning.)',
        'C.DecommFundingCommitmentRequired [Condition = any new Solution approved for build, Period = before first Evo Step deployment] — prevents launch unless the decommission funding source is documented and committed. This Constraint is the organisational equivalent of requiring a demolition bond before a construction permit. (CE 2005 — Constraint as financial governance; Cost Engineering — decommission funding as mandatory Resource.)',
        'If current-budget funding is chosen, add a decommission line item to the project budget before the project starts — do not leave it as a future CfO negotiation. R.DecommBudget.X: Scale = USD; Goal = $25k [Source = capital budget FY26, Line = IT-Decommission-Reserve]. A named budget line is a commitment; an unnamed expectation is a wish. (CE 2005 — Resource with named funding source; Cost Engineering — capital budget decommission line.)',
      ],
    ],
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
      'Derived: ROI(IroncladHull) = $1.2M/y avoided convoy losses / $180k build + $40k/y maint × 5y = 4.1×.',
      'R.PaybackDate.Goal: Scale = months from launch to cumulative ROI ≥ 0; Goal ≤ 18 months.',
    ],
    gilbCite: 'Gilb, Value Improvement (2024) — V/C prioritisation; SUCCESS book — ROI vs Goal lattice.',
    whyItMatters: 'Without explicit ROI, Resources decisions degenerate into "lowest bid" thinking. Planguage demands the Value-per-Resource ratio be the decision driver.',
    suggestedAnswers: [
      // Q0: What dollar (or quantifiable) value does each Value entry produce per year?
      [
        'For each V. entry, ask: "If this Value moves from Now to Goal, what changes for the named stakeholder in measurable terms?" Then quantify that change. V.ResponseTime Goal = 200 ms → stakeholder benefit = 8% higher checkout completion rate × $2.4M/year revenue = $192k/year benefit. State the benefit derivation, not just the number. (Value Improvement 2024 — quantified stakeholder benefit per Value entry; CE 2005 — Value as measurable stakeholder impact.)',
        'Use avoided-cost framing when direct revenue attribution is difficult: V.SystemUptime Goal ≥ 99.9% → benefit = avoided outage cost. If 1 hour downtime costs $15k in lost transactions + $5k in support cost, and current uptime of 99.5% implies ~44 hours downtime/year, Goal-level uptime saves: (44 − 8.8 hours) × $20k/h = $706k/year. (CE 2005 — Value quantification via avoided cost; Cost Engineering — benefit estimation.)',
        'For Values with no direct revenue impact (e.g. user satisfaction, team morale, documentation quality): estimate the downstream Value impact. V.DocumentationQuality → 30% reduction in onboarding time → R.OnboardingCost reduced by $1,800/hire × 20 hires/year = $36k/year. Every V. entry has a downstream Resource impact; trace it. (Value Improvement 2024 — indirect Value quantification; CE 2005 — Value-Resource chain.)',
        'Use stakeholder willingness-to-pay as a proxy for annual Value when market data exists: "What would [stakeholder] pay for this performance level if they had to buy it elsewhere?" Survey 3-5 stakeholders, average the answers, apply a 30% discount for conservative estimation. R.WillingnessToPay.V.SpeedUnderSail: Scale = USD/year stakeholder would pay for Goal-level performance; Meter [Method = stakeholder interview × 3; Who = Sponsor + Operations + Client] = $180k/year. (SE — stakeholder as Value-source; Value Improvement 2024 — willingness-to-pay methodology.)',
      ],
      // Q1: What is the total resource cost (build + maintain + decommission) per Solution?
      [
        'TCO formula per Solution: TCO(S.X) = BuildCost(S.X) + Σ(AnnualMaintCost(S.X) × LifecycleYears) + DecommCost(S.X). All three components must be estimated before selecting a Solution — optimising for BuildCost alone is a known failure mode. R.TCO.SteamEngine: Scale = USD (20-year TCO); Goal ≤ $550k [Build $180k + Maint $18k/y × 20y + Decomm $10k]. (Cost Engineering — TCO formula; CE 2005 — full lifecycle Resource cost.)',
        'Break down build cost into sub-components: labour (engineer-hours × loaded rate) + materials/licensing + integration + testing + deployment. Each sub-component can be estimated independently and summed. R.BuildCost.X: Scale = USD; Meter [Method = bottom-up estimate from Evo Step task lists]; Goal ≤ [budget line]. Bottom-up estimates beat top-down estimates by 2-3× accuracy for software. (CE 2005 — Resource estimation methodology; Cost Engineering — bottom-up cost estimation.)',
        'Include integration cost: every Solution that connects to existing systems has an integration cost often omitted from the Solution\'s own estimate. R.IntegrationCost.X: Scale = USD; Goal ≤ 15% of Solution build cost. If integration cost exceeds 15%, it should be its own S. entry with its own Resource budget. (CE 2005 — Resource completeness; Cost Engineering — integration cost as separate Resource.)',
        'Model cost uncertainty: point estimates are optimistic by default. Use three-point estimation: R.BuildCost.X: Optimistic = $120k; Most-Likely = $165k; Pessimistic = $240k; PERT estimate = (O + 4ML + P) / 6 = $168k. Using the PERT estimate rather than the optimistic case reduces budget surprise risk. (CE 2005 — Resource estimation under uncertainty; Cost Engineering — PERT for cost ranges.)',
      ],
      // Q2: What is the projected ROI per Evo Step? Which step has the highest?
      [
        'ROI(Evo Step N) = [Total V. Goal impact delivered by Step N] / [Total Resource cost of Step N]. Compute this for every Evo Step before the final sequence is locked. The step with the highest ROI should typically run first — highest Value per Resource spent earliest. This is the Planguage V/C prioritisation principle applied at the step level. (EVO 2024 ch.7 — VDT; Value Improvement 2024 — V/C ratio as priority driver.)',
        'Incremental ROI: because Evo Steps deliver Value incrementally, compute cumulative ROI at each step boundary. If Steps 1-3 already deliver 80% of total V. Goal impact at 40% of total cost, Steps 4-6 add only 20% more impact at 60% of remaining cost — a strong signal to stop after Step 3 and redirect resources. (EVO 2024 ch.2 — early delivery of high Value; Value Improvement 2024 — diminishing returns detection.)',
        'Opportunity cost of step ordering: the sequence that maximises early ROI is not always the sequence that feels natural (e.g. not "do foundations first, then features"). Use the VDT to calculate ROI for multiple ordering alternatives and pick the sequence with highest cumulative ROI at each checkpoint. (EVO 2024 ch.7 — VDT for step sequencing; CE 2005 — opportunity cost of Resource allocation.)',
        'R.StepROI.EvoStep1: Scale = $ Value delivered / $ cost; Meter [Method = V. Goal impact estimated by stakeholder interview + actual Resource cost tracked against budget]; Goal ≥ 2.0× (i.e. $2 of Value for every $1 spent). Any step where projected ROI < 1.0× is a candidate for elimination from the plan — it destroys Value. (Value Improvement 2024 — ROI floor as acceptance criterion; CE 2005 — Resource investment justification.)',
      ],
      // Q3: When does the cumulative ROI cross zero (payback date)?
      [
        'Payback date = the calendar date when cumulative Value delivered equals cumulative Resource cost. R.PaybackDate: Scale = months from first launch to cumulative ROI ≥ 1.0×; Tolerable ≤ 36 months; Goal ≤ 18 months. Without a named Tolerable, no one notices if the plan never pays back. (CE 2005 — Resource Tolerable for financial viability; Value Improvement 2024 — payback as ROI milestone.)',
        'Model payback monthly, not annually. If Value is delivered in increments per Evo Step, the cumulative ROI curve crosses zero between Step N and Step N+1 — knowing which step is the payback step allows the sponsor to make a go/no-go decision at that boundary. "We will commit to Step N+1 only if payback has been achieved by the end of Step N." (EVO 2024 ch.2 — incremental Value delivery; Value Improvement 2024 — milestone-gated investment.)',
        'Discount cash flows to present value for multi-year plans: $100k of Value in Year 1 is worth more than $100k in Year 3. Use a discount rate matching the organisation\'s cost of capital (typically 8-12%). R.NPV: Scale = USD (net present value of all Value minus all Resource cost over lifecycle); Goal ≥ $0. Negative NPV = the plan destroys economic value even if it meets V. Goals. (Cost Engineering — NPV calculation; Value Improvement 2024 — time-value of Value delivery.)',
        'Payback sensitivity: model how payback date moves if (a) build cost is 30% over budget, or (b) V. delivery is 3 months later than planned. These scenarios reveal whether the business case is robust or fragile. If a 30% cost overrun pushes payback past the Tolerable date, the plan is fragile and needs either a larger margin in the Goal or a stronger Constraint on build cost. (CE 2005 — Resource sensitivity analysis; Cost Engineering — scenario-based payback modelling.)',
      ],
    ],
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
    suggestedAnswers: [
      // Q0: For each (Value × Solution) pair, what is the Impact-per-unit-Cost?
      [
        'Build the Value Decision Table (VDT): rows = Solutions, columns = Values, cells = Impact(V. moves from Now to Goal if S. is implemented) / Cost(S.). The cell value is the efficiency ratio for that pairing. The Solution with the highest total efficiency column-sum is the priority pick. (EVO 2024 ch.7 — VDT construction; CE 2005 — Impact Estimation Table.)',
        'Impact units must match Value Scale units for the ratio to be meaningful. V.SpeedUnderSail Scale = knots; S.SailRigging cost = 30 work-days. Efficiency = (5.5 knots Goal − 3.0 knots Now) / 30 days = 0.083 knots/day. Always carry units through the calculation — a dimensionless ratio is uninterpretable. (CE 2005 — dimensional consistency in Impact calculations.)',
        'For multi-Value Solutions: compute a weighted efficiency. Each V. entry has a weight proportional to its stakeholder priority. Efficiency(S.X) = Σ[Weight(V.i) × Impact(V.i | S.X)] / Cost(S.X). This accounts for the fact that some Values matter more than others to the plan\'s primary stakeholders. (EVO 2024 ch.7 — weighted VDT; CE 2005 — stakeholder-weighted prioritisation.)',
        'Impact estimation must be honest, not optimistic. The most common VDT error is overestimating the Impact of the preferred Solution and underestimating the alternatives. Use three-point estimation: Impact(Optimistic), Impact(Most-Likely), Impact(Pessimistic); use Most-Likely for the VDT; document the range. (CE 2005 — Impact estimation methodology; Value Improvement 2024 — unbiased V/C ratio.)',
      ],
      // Q1: Which Evo Step has the highest Value-per-Calendar-day?
      [
        'Efficiency(Evo Step N, Calendar) = [V. Goal impact delivered by Step N] / [Calendar days consumed by Step N from start to completion]. This ratio is the "bang per calendar-day." Rank all steps by this ratio. The step with the highest ratio is the highest-priority for calendar-constrained plans. (EVO 2024 ch.7 — step prioritisation by calendar efficiency; CE 2005 — calendar as Resource denominator.)',
        'Short Evo Steps almost always have higher calendar-efficiency than long ones, even if long steps deliver more total Value, because the Value of short steps is delivered sooner and therefore has higher present value. If Step A delivers $50k Value in 10 days and Step B delivers $100k Value in 60 days, Step A\'s calendar-efficiency ($5k/day) beats Step B\'s ($1.67k/day). Run Step A first. (EVO 2024 ch.2 — small step advantage; Value Improvement 2024 — time-value of Value delivery.)',
        'R.BestCalendarEfficiencyStep: Scale = Evo Step ID with highest [V. Goal impact / calendar days]; Meter [Method = VDT calculation per step]; Goal = Step 1 (highest efficiency step runs first). Using this as a named Resource metric forces the planning team to actually compute the ratio rather than sequence intuitively. (EVO 2024 ch.7 — VDT as prioritisation discipline.)',
        'Calendar-efficiency can be improved by parallelising steps: if Steps 2 and 3 have no data dependency, run them simultaneously. Parallel efficiency = combined V. impact / max(calendar days of Step 2, Step 3). Parallelism requires additional specialist availability — model that cost before assuming it is free. (EVO 2024 ch.2 — Evo Step parallelism; CE 2005 — Resource cost of parallelism.)',
      ],
      // Q2: Which has the highest Value-per-Work-hour?
      [
        'Efficiency(Evo Step N, Effort) = [V. Goal impact delivered by Step N] / [Total engineer-hours consumed by Step N]. This ratio is "bang per hour" — the priority metric for effort-constrained teams. Rank all steps by this ratio. When calendar and effort rankings disagree, surface the conflict to the Sponsor. (EVO 2024 ch.7 — VDT with effort denominator; CE 2005 — V/C with effort as cost.)',
        'Work-hour efficiency improves with re-use. If S.APIFramework can be built in 40 hours and then enables 3 downstream Solutions at lower cost, its effective efficiency is: combined V. impact across all 3 downstream Solutions / 40 hours. Infrastructure Solutions systematically understate their true efficiency if only direct Value impact is counted. (CE 2005 — infrastructure multiplier in efficiency calculation.)',
        'Identify the efficiency ceiling for the team\'s skill mix: a Solution requiring specialist X at 90% utilisation cannot be accelerated by adding junior engineers. R.EfficiencyConstraint.SpecialistX: Scale = V. impact / engineer-hours achievable given specialist availability; Goal = [VDT calculation with realistic availability]. (SE — specialist as efficiency constraint; EVO 2024 ch.7 — VDT with availability-adjusted costs.)',
        'R.BestEffortEfficiencyStep: Scale = Evo Step ID with highest [V. Goal impact / engineer-hours]; Meter [Method = VDT calculation × actuals from prior steps]; Goal = highest-ratio step runs first in each planning cycle. Revisit this metric after every Evo Step as actuals replace estimates. (EVO 2024 ch.7 — VDT as living planning tool; Software Metrics 1988 — actual vs estimate calibration.)',
      ],
      // Q3: Are we picking Evo Steps by highest Efficiency, or by something else?
      [
        'Run a prioritisation audit: list the planned Evo Step sequence, then compute the V/C efficiency ratio for each step. If the sequence does not match the efficiency ranking (highest first), document WHY it deviates. Valid reasons: dependency constraints, specialist availability, external fixed dates. Invalid reasons: "it felt natural," "we always do infrastructure first," "the sponsor prefers it." (EVO 2024 ch.7 — VDT as sequencing discipline; CE 2005 — rational prioritisation vs gut-feel.)',
        'Common non-efficiency prioritisation patterns (and their costs): (a) Urgency bias — urgent-but-low-efficiency tasks displace high-efficiency tasks. (b) Familiarity bias — the team picks steps they know how to do. (c) Completeness bias — finishing a half-done step before starting a higher-efficiency new one. Each bias should be named and quantified: "Urgency bias cost us $X in delayed high-Value delivery." (EVO 2024 ch.7 — priority bias recognition; Value Improvement 2024 — opportunity cost of non-optimal sequencing.)',
        'C.VDTPrioritisationRequired [Condition = before any Evo Step is added to the active sprint-equivalent, Period = start of each planning cycle] — a named Constraint that prevents informal step-picking without a VDT calculation. The Constraint makes efficiency-based prioritisation a governance obligation, not an aspiration. (EVO 2024 ch.7 — VDT as mandatory planning tool; CE 2005 — Constraint to enforce methodology.)',
        'Test the sequence with the "would we still do this?" question: if the next planned Evo Step had its efficiency ratio cut in half (e.g. the V. impact estimate was wrong), would we still run it next? If yes, the sequence is robust. If no, the sequence is fragile — it depends on an uncertain estimate. For fragile sequences, run the highest-certainty step first and re-evaluate. (EVO 2024 ch.2 — risk-adjusted Evo Step sequencing; CE 2005 — robust planning under uncertainty.)',
      ],
    ],
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
    suggestedAnswers: [
      // Q0: Which V. Goal levels could be dropped to Tolerable to save which Resources?
      [
        'For each V. entry: compute the Resource cost differential between delivering Goal vs delivering Tolerable. If V.SpeedUnderSail Goal = 6 knots costs $42k and Tolerable = 5.5 knots costs $24k, the tradeoff is: $18k saved at the cost of 0.5-knot performance loss. Present this ratio to the Sponsor, not a binary "cut this feature." (CE 2005 — tradeoff matrix; Optima — Goal-to-Tolerable relaxation analysis.)',
        'Target the V. entries with the widest Goal-to-Tolerable gap first — these offer the largest absolute Resource saving per unit of Value reduction. Sort V. entries by [Cost(Goal) − Cost(Tolerable)] descending. The top 3 entries are the tradeoff opportunities worth presenting. (Cost Engineering — tradeoff matrix prioritisation; CE 2005 — efficiency-first tradeoff selection.)',
        'Distinguish "nice to have Goal" from "safety-margin Goal" before proposing relaxation. A Goal set at 99.99% uptime when the business case was built on 99.9% is a candidate for relaxation. A Goal set at 99.9% because below 99.5% the regulatory licence is revoked is not relaxable regardless of Resource saving. Document the basis for each Goal before proposing cuts. (CE 2005 — stakeholder-justified Goal levels; SE — stakeholder approval required for Goal relaxation.)',
        'Run the "which Values does the sponsor care most about?" exercise: ask the Sponsor to rank the V. entries by importance. Values in the bottom 25% of importance with a significant Goal-to-Tolerable cost differential are the first tradeoff candidates. Bring the ranked list and the cost differentials to the tradeoff conversation — it becomes a data-driven negotiation, not a "what can we cut?" panic. (SE — stakeholder prioritisation of Values; Value Improvement 2024 — prioritised V/C tradeoff.)',
      ],
      // Q1: Which Constraints, if relaxed (with stakeholder approval), would unlock which Resource savings?
      [
        'Not all Constraints are equally fixed. Classify each C. entry: (a) Regulatory — cannot be relaxed (GDPR, building code, food safety). (b) Contractual — requires contract amendment (expensive but possible). (c) Internal policy — relaxable with Sponsor approval (procedural, organisational). Only class (b) and (c) Constraints are tradeoff candidates. (CE 2005 — Constraint relaxation classification; SE — stakeholder authority over Constraints.)',
        'For each relaxable Constraint, estimate the Resource saving if it were removed or scoped down. C.AllUnitsManufacturedInEU [Condition = procurement, Scope = all components] → if relaxed to "all safety-critical components manufactured in EU", estimated saving = $28k/year in procurement cost + 3-week lead-time reduction. Present the saving and the stakeholder who must approve relaxation. (CE 2005 — Constraint relaxation tradeoff; Optima — scoped-Constraint as Resource optimisation.)',
        'C. entries that are protecting a V. entry (i.e. the Constraint exists only to guarantee a Value Goal) can be relaxed if the V. Goal is simultaneously relaxed. C.MaxDeploymentDowntime ≤ 4 hours exists to protect V.SystemUptime Goal ≥ 99.9%. If the Sponsor accepts V.SystemUptime Tolerable = 99.5%, the Constraint can be relaxed to ≤ 12 hours — saving the Resource cost of the more expensive deployment process. (CE 2005 — Constraint-Value coupling; Optima — paired V./C. relaxation.)',
        'Document every Constraint relaxation with: (a) who approved it, (b) date of approval, (c) what was relaxed and to what new level, (d) which Resource saving was achieved, (e) which V. Goal or risk was accepted. Without this audit trail, relaxed Constraints silently revert under new management. R.ConstraintRelaxationLog: Scale = entries in the log; Goal = complete entry for every relaxation. (CE 2005 — Resource governance for Constraint changes; SE — stakeholder sign-off record.)',
      ],
      // Q2: Which Solution could be substituted for a cheaper one with acceptable Value loss?
      [
        'Run a Solution substitution analysis: for each S. entry, identify at least one cheaper alternative. Then compute: ΔValue(S.original vs S.alternative) / ΔCost(S.original vs S.alternative). If the ratio is < 1.0 (more cost than Value preserved), the original is not worth its premium — substitute. (CE 2005 — Solution substitution; Optima — Solution selection with V/C tradeoff.)',
        'The "minimum viable Solution" test: what is the cheapest Solution that keeps every V. entry at or above Tolerable (not Goal)? This defines the floor budget. The difference between floor-budget and the current-plan budget is the total premium being paid for Goal-level (rather than Tolerable-level) performance. Present this figure to the Sponsor as "this is what premium performance is costing us." (CE 2005 — Tolerable-floor budget analysis; Value Improvement 2024 — cost of Goal vs Tolerable.)',
        'Commercial-off-the-shelf (COTS) substitution: for any custom-built S. entry, ask "does a COTS product exist that delivers ≥ 80% of this Solution\'s V. impact at ≤ 40% of this Solution\'s cost?" If yes, the COTS substitution is a tradeoff opportunity. Model it explicitly: R.COTSSubstitutionSaving.X: Scale = USD saved vs custom build; Goal = $X saving [Condition = COTS delivers V.Goal ≥ Tolerable for all relevant V. entries]. (CE 2005 — build vs buy as Solution tradeoff; Cost Engineering — COTS cost-benefit.)',
        'Open-source substitution: for any licensed software S. entry, identify the open-source equivalent. Saving = (licence cost − support cost premium for OSS). C.OpenSourceReviewRequired [Condition = any new licensed software Solution > $10k/year] — a named Constraint that ensures open-source alternatives are always evaluated before a licence commitment. (CE 2005 — Constraint as Solution-selection governance; Cost Engineering — licence vs OSS TCO.)',
      ],
      // Q3: Which Evo Step could be deferred without harming any V. Goal?
      [
        'Run a deferral test for each Evo Step: if this step is removed from the current planning cycle, which V. Goals (if any) would fall below their Tolerable level? If the answer is "none," the step is a deferral candidate. R.DeferrableSteps: Scale = count of Evo Steps whose deferral does not cause any V. entry to fall below Tolerable; Goal ≥ 1 [Condition = current planning cycle]. (EVO 2024 ch.2 — Evo Step dependency and deferral; CE 2005 — Resource saving via deferral.)',
        'Deferral saves cash-flow, not lifetime cost — the work will still be done, just later. The Resource saving is the time-value of money plus the option value of learning before committing. If deferring Step N for 3 months allows the team to learn from Steps N-1 delivery and re-scope Step N to be 20% cheaper, the 3-month deferral has a real financial value. (EVO 2024 ch.2 — Evo Step learning loop; Value Improvement 2024 — option value of deferral.)',
        'C.StepDeferralRequiresVImpactAnalysis [Condition = any Evo Step proposed for deferral] — a named Constraint that requires a V. impact analysis before any step is deferred, to prevent accidental deferral of a step that is protecting a V. Tolerable. The Constraint takes 30 minutes to satisfy but prevents multi-month recoveries when a surprise dependency surfaces later. (CE 2005 — Constraint as deferral governance; EVO 2024 ch.7 — dependency analysis.)',
        'Frame deferrals as conditional commitments: "We commit to deferring Evo Step 4 provided that: (1) V.MaintenanceCost remains ≤ Tolerable through Evo Step 3, AND (2) the sponsor approves the deferral before the Evo Step 3 end date." This prevents the deferral from becoming a permanent cancellation by accident — it has explicit re-commitment conditions. (EVO 2024 ch.2 — conditional Evo Step commitment; SE — Sponsor approval for scope changes.)',
      ],
    ],
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
