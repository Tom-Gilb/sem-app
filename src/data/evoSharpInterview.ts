// UNIT_TYPE=Data
//
// evoSharpInterview.ts — Question catalogue for the "Sharpen Next Step"
// (a.k.a. "Next Value Step Focus") Evo tool.
//
// SOURCE: Tom Gilb 2026-06-03: *"Sub-Tool 'Evo Sharp Interview' (Like the
// sharpening questions and answers) but very focussed on Evo Value Delivery,
// Evo Sharp Categories suggestion (add more): Task Definition, Solution
// Element Selection, Value Delivery Focus, Solution Redesign, Experience
// Capture, Feedback Learning, Resources Management, Risk Management."*
//
// AUTHORITY: Questions grounded in Tom Gilb's Evo theory:
//   - Software Metrics (Gilb 1976/1988) p.214 — original Evo publication
//   - Principles of Software Engineering Management (PoSEM) ch.15
//   - Competitive Engineering — Planguage spec rules
//   - EVO 2024 book — canonical 9-step cycle (1 Stakeholders → 2 Values
//     → 3 Solutions → 4 Decompose → 5 Prioritize → 6 Develop → 7 Deliver
//     → 8 Measure → 9 Learn)
//
// USAGE: imported by EvoSharpInterview.vue. Each category renders as a
// sidebar item; clicking it shows the category's questions for the
// currently-selected Evo Step. Answers persist via useEvoSharpAnswers.ts.
//
// DATA-DRIVEN: adding a question or category is a single-entry edit here;
// no UI code changes needed. Twin-portable: pure data, no framework coupling.

/** A single sharpening question within a category. */
export interface SharpQuestion {
  /** Stable id; used as localStorage key suffix + Vue :key. */
  id: string
  /** The question itself — pointed, forces concrete thinking. */
  text: string
  /** Optional one-sentence rationale shown in subtle text under the question,
   *  explaining WHY this question matters per Evo theory. Helps the user
   *  answer thoughtfully rather than tick-the-box. */
  rationale?: string
  /** Optional placeholder suggesting answer shape (e.g., "List 3-7 tasks…"). */
  placeholder?: string
  /** 3 AI-suggested answers (Tom 2026-06-03: "suggest 3 useful suggested
   *  answers, to tick if approved").  Each suggestion is a plausible
   *  starting point the user can tick to include in the effective answer.
   *  Three styles per question: (a) concrete template, (b) methodology prompt,
   *  (c) counter-perspective.  Pre-baked in this file for v1; future v2 can
   *  layer Claudian-generated suggestions on top via file-read pattern. */
  suggestedAnswers?: string[]
  /** Provenance per suggestion (parallel array to suggestedAnswers).
   *  Tom 2026-06-03 Conjunction-of-Technologies principle: every suggestion
   *  must declare its source layer.  Currently most are 'template' (the
   *  static fallback v1 ships); plan-aware derivation in v2 will produce
   *  'plan' sources, and Claudian retrofit will produce 'gilb' sources. */
  suggestedAnswerProvenances?: import('./aiSource').SourceProvenance[]
}

/** A category groups related questions. Tom's 8 + 4 PROPOSED additions. */
export interface SharpCategory {
  id: string
  /** Display label shown in sidebar + as section header in main pane. */
  label: string
  /** One-line description shown under the label in the sidebar. */
  description: string
  /** Tailwind classes for the category accent (sidebar bar + headers). */
  accent: string
  /** Mark as PROPOSED so Tom can review/drop the categories he didn't author. */
  proposed?: boolean
  /** The questions in display order. */
  questions: SharpQuestion[]
}

export const EVO_SHARP_CATEGORIES: SharpCategory[] = [
  // ── 1. Task Definition (Tom) ────────────────────────────────────────────────
  {
    id: 'task-definition',
    label: 'Task Definition',
    description: 'What concrete work units make up this Evo step',
    accent: 'bg-blue-500',
    questions: [
      {
        id: 'tasks-list',
        text: 'What are the 3–7 specific tasks needed to deliver this step?',
        rationale: 'Tasks are coordination metrics (task completion ≠ value delivery). Naming them explicitly prevents scope creep mid-step.',
        placeholder: 'List the concrete tasks, one per line…',
        suggestedAnswers: [
          'Three tasks: (a) backend endpoint + schema migration, (b) frontend client wiring, (c) instrumented end-to-end smoke test. Each fits in ~1 work day.',
          'Walk the user-visible workflow first, then derive the minimum set of technical tasks that each visible step requires. Stop when no single task exceeds one work day.',
          'Scaffolding (skeleton without integration) · Integration (wire to existing system) · Validation (instrumented test pass). Three named buckets, owners assigned at planning time.',
        ],
      },
      {
        id: 'tasks-owners',
        text: 'For each task: who owns it and roughly how many hours?',
        rationale: 'Explicit ownership prevents the "everyone owns it, no one owns it" failure mode.',
        suggestedAnswers: [
          'Owner = single named person per task (not a team). Hours = the owner\'s OWN estimate, not a manager\'s. Recorded in the team\'s tracker before work starts.',
          'For each task: assign a primary owner AND a backup. Primary writes the code; backup reviews and pairs when blocked. Hours = primary\'s estimate × 1.3 buffer.',
          'If the same person owns >50% of the step\'s tasks, the step is too narrow or the team is too thin — surface as a risk before assigning hours.',
        ],
      },
      {
        id: 'tasks-bottleneck',
        text: 'Which tasks are bottlenecks (downstream tasks blocked by them)?',
        rationale: 'Bottleneck tasks should start first and get the strongest people.',
        suggestedAnswers: [
          'The backend endpoint is the bottleneck — frontend wiring and end-to-end tests both depend on it. Assigned to the senior; started on day 1; partial mock available by day 2.',
          'Draw a quick dependency graph: any task with ≥2 downstream tasks is a bottleneck. Schedule those first; ensure the strongest implementer owns each.',
          'If no task is a clear bottleneck, the step may be a parallel-friendly batch — confirm by checking that any task could start on day 1 without waiting on another.',
        ],
      },
    ],
  },

  // ── 2. Solution Element Selection (Tom) ─────────────────────────────────────
  {
    id: 'solution-selection',
    label: 'Solution Element Selection',
    description: 'Which S. entries inform this step, and which design ideas within them',
    accent: 'bg-violet-500',
    questions: [
      {
        id: 'linked-solutions',
        text: 'Which Solution (S.) entries does this step draw from? Why these and not others?',
        rationale: 'Evo-Step *141: a step contains "a set of design ideas". Explicit selection forces the team to commit to a chosen path and defer alternatives.',
        suggestedAnswers: [
          'Step draws from S.1 only because it is the single highest V/C-ratio solution that touches both target V. entries. S.2 deferred because it duplicates S.1\'s value with higher cost.',
          'List candidate solutions in V/C order. Pick the smallest set that covers all of this step\'s target V. entries. Justify each inclusion AND each exclusion in one sentence.',
          'If a step draws from >2 solutions, it is likely a hidden Decompose-target — split before committing. One solution = one cleanly-attributable result.',
        ],
      },
      {
        id: 'solution-scope',
        text: 'What "design ideas" within those solutions are IN scope vs OUT of scope for this step?',
        rationale: 'A solution may contain multiple design ideas; this step only implements some. Naming the boundary prevents accidental scope expansion.',
        suggestedAnswers: [
          'IN: core authentication flow + session token issuance. OUT: password reset, multi-factor, social login — those land in subsequent steps.',
          'Re-read the solution description. For each clause that names a capability, decide IN / OUT / DEFER explicitly. Capture the OUT list — it is next-cycle\'s candidate scope.',
          'If the IN list keeps growing during discussion, the step is overrun before it started — apply the Decomposition Check category before committing.',
        ],
      },
      {
        id: 'solution-still-vague',
        text: 'Are any chosen solutions still vague enough to need sharpening BEFORE this step starts?',
        rationale: 'A vague solution will produce a vague step. Sharpen the solution first if needed (return to Stage 5 Refine).',
        suggestedAnswers: [
          'S.1 has crisp impact ("99.9% auth reliability") but vague mechanism ("integrate Supabase"). Sharpen the mechanism field before this step — 15 minutes saves a re-plan later.',
          'For each chosen solution: check whether the description names an OUTCOME and a MECHANISM. Either missing = vague — return to Stage 5 Refine for that one solution before starting this step.',
          'If sharpening would change the linkedSolutions or vStatusDelta projections, do it now. If sharpening is purely cosmetic wording, defer to after delivery.',
        ],
      },
    ],
  },

  // ── 3. Value Delivery Focus (Tom) ───────────────────────────────────────────
  {
    id: 'value-delivery',
    label: 'Value Delivery Focus',
    description: 'Which V. entries this step moves toward Goal',
    accent: 'bg-emerald-500',
    questions: [
      {
        id: 'target-values',
        text: 'Which V. entries are this step\'s primary value-delivery targets?',
        rationale: 'A step that doesn\'t target a specific V. entry status change is a "work step", not a "value step".',
        suggestedAnswers: [
          'Primary: V.AuthDeliverySpeed and V.LoginSuccessRate. Secondary (potential side-benefit, not measured): V.UserTrust. The Measure step instruments only the primaries.',
          'Pick the V. entries with the highest projected lift × highest stakeholder visibility. A step with vague V. targets cannot Learn from its own delivery.',
          'If a step lifts NO V. status by ≥1 measurable unit, it is a work step, not a value step. Tag it as enabling work and pair it with a value step that depends on it.',
        ],
      },
      {
        id: 'movement-amount',
        text: 'By how many units of [Scale] should this step move each V. toward Goal?',
        rationale: 'Without a quantified target, you cannot Measure (Evo step 8) whether the step succeeded.',
        placeholder: 'e.g., "Login Success Rate: 92% → 96%"',
        suggestedAnswers: [
          'V.LoginSuccessRate: 92% → 96% (+4 units). V.AuthDeliverySpeed: 12d → 6d (-6 days). Both measured 24h after deploy; locked Goal stays 99% / 1d.',
          'Read each V.\'s current Status and Goal. Pick a step target that is 25–50% of the remaining gap — ambitious enough to matter, not so wild it cannot be measured cleanly.',
          'If you cannot quantify the expected movement in the V.\'s own Scale units, the V. lacks a sharp enough Scale — fix the Scale field first.',
        ],
      },
      {
        id: 'anti-goal-check',
        text: 'Are there V. entries this step might NEGATIVELY impact (anti-goal check)?',
        rationale: 'Tom Gilb: SUCCESS = ALL Values within ALL Constraints. A step that lifts V.1 but drops V.2 below Tolerable has failed.',
        suggestedAnswers: [
          'Risk: V.PageLoadSpeed may drop -200ms because the new auth check adds a server round-trip. Mitigation: client-side token cache. Tolerable is 1500ms, projected 1300ms — within bounds.',
          'For each V. NOT in linkedValues: ask "could this step plausibly move it in the wrong direction?" If yes, add to anti-goal list with mitigation plan or accept the risk.',
          'If anti-goal Values exceed primary-target Values, the step is net-negative under SUCCESS — split or redesign before committing.',
        ],
      },
    ],
  },

  // ── 4. Solution Redesign (Tom) ──────────────────────────────────────────────
  {
    id: 'solution-redesign',
    label: 'Solution Redesign',
    description: 'Refinement opportunity before committing the step',
    accent: 'bg-amber-500',
    questions: [
      {
        id: 'weakest-part',
        text: 'Now that we\'re planning this step, what\'s the WEAKEST part of the underlying solution(s)?',
        rationale: 'Pre-commit is the cheapest moment to redesign. Once tasks start, every change costs more.',
        suggestedAnswers: [
          'Weakest: the assumed session-management library. We have no production experience with it; a 1-day spike on it before committing the step would derisk the rest of the work.',
          'Walk through each solution component: which one is "trust-me-it-will-work" rather than "we have evidence"? That is the weakest part — invest the redesign there.',
          'If no part of the solution feels weak, you are either too confident or not looking hard enough — invite a sceptical reviewer to point at one part for 5 minutes.',
        ],
      },
      {
        id: 'cheaper-impact',
        text: 'Could a small redesign of the S. entry deliver more V. impact per unit cost?',
        rationale: 'V/C ratio (Value per Cost) is the Planguage primary prioritisation metric. Small redesigns can move the ratio dramatically.',
        suggestedAnswers: [
          'Yes: swapping the heavy auth library for the lighter alternative saves 2 cycles AND keeps the same V. impact — V/C ratio doubles. 30-minute redesign before commit.',
          'For each V. target: ask "what is the smallest mechanism that delivers 80% of the projected lift?" Often the answer is a feature flag or config change, not a build.',
          'If a redesign would change the V/C ratio by <20%, leave it — the cost of the redesign exceeds the gain. Reserve redesign energy for the high-leverage levers.',
        ],
      },
      {
        id: 'simpler-alternative',
        text: 'Is there a simpler alternative we should consider before locking in?',
        rationale: 'Simpler = faster delivery, lower risk, often equal value. Evo rewards humility.',
        suggestedAnswers: [
          'Simpler alternative: use the platform\'s built-in auth (1 day, 70% of target V. lift) instead of custom (5 days, 100% lift). Ship simpler now; iterate to full if Measure shows a gap.',
          'For each component: ask "could a 10-line script or an existing capability deliver this?" If yes, do that first; build the elaborate version only if the simple one fails to move the V.',
          'If the simpler alternative is rejected, capture WHY in 1 sentence — that captured rationale is the audit trail when stakeholders later ask "why so much work?"',
        ],
      },
    ],
  },

  // ── 5. Experience Capture (Tom) ─────────────────────────────────────────────
  {
    id: 'experience-capture',
    label: 'Experience Capture',
    description: 'What past learning applies to this step',
    accent: 'bg-orange-500',
    questions: [
      {
        id: 'prior-same-values',
        text: 'Which prior Evo steps measured the SAME V. entries — what did we learn?',
        rationale: 'Evo is a learning system. Prior cycle data is the single highest-signal input to the next cycle.',
        suggestedAnswers: [
          'Steps 1 and 2 both targeted V.LoginSuccess. Step 1 lifted +8 (estimate +12), Step 2 lifted +3 (estimate +6). Pattern: we are over-estimating by ~50% — calibrate this step\'s projection down.',
          'For each linkedValue: search the Evo Base for prior measurements. Report the average estimate-vs-actual delta. Use that delta to discount this step\'s projection.',
          'If no prior step measured these V. entries, instrument MORE aggressively this time — this step is the first data point, not the third.',
        ],
      },
      {
        id: 'recent-surprises',
        text: 'What surprised us in the last 1–2 steps that should inform this one?',
        rationale: 'Surprises = unmodelled reality. Folding them into the next step\'s plan is the heart of "Study-Act".',
        suggestedAnswers: [
          'Surprise from Step 2: stakeholder NPS rose on week-1 but fell on week-2 (novelty bias). Action for this step: pre-commit to a week-2 lagging measurement before judging success.',
          'Look at the most recent FEED ME! "Last Step in Paris" tough questions. Pick the one with the highest divergence between AI-suggested answer and dev response — that gap is the surprise to absorb.',
          'If "no surprises" feels accurate, we are probably not measuring enough lagging indicators — add one new lagging measure to this step.',
        ],
      },
      {
        id: 'stakeholder-feedback',
        text: 'What did stakeholders say after the last delivery that we should act on?',
        rationale: 'Stakeholder voice trumps team intuition. If they want something different, change the V. targets first, then the step.',
        suggestedAnswers: [
          'Stakeholders said the new flow is fast but "missing the cancel shortcut". Action: extend this step\'s acceptance to include the cancel shortcut — small add, large perceived-value gain.',
          'List the top 3 stakeholder quotes from the last delivery cycle. For each: does it call for a V. target change, an F. presenceTest update, or a new step? Decide before planning this one.',
          'If stakeholder feedback contradicts the planned V. targets, change the V. targets first — then re-derive this step. Steps serve V., not the other way around.',
        ],
      },
    ],
  },

  // ── 6. Feedback Learning (Tom) ──────────────────────────────────────────────
  {
    id: 'feedback-learning',
    label: 'Feedback Learning',
    description: 'Instrumentation + review loops for this step',
    accent: 'bg-pink-500',
    questions: [
      {
        id: 'instruments-needed',
        text: 'What measurement instruments are needed BEFORE delivery to confirm V. status change?',
        rationale: 'No instrument = no Measure step = no Learn step. Build the meter before you build the value.',
        suggestedAnswers: [
          'Need: server-side latency histogram (already exists), per-user success counter (NEW — add to this step\'s tasks), week-2 NPS micro-survey (NEW — schedule for +7d).',
          'List each V. in linkedValues. For each: name the EXACT instrument (logs/db query/survey/manual count). If "we will figure it out at the end", the instrument is missing.',
          'If the instrument does not exist, BUILD-THE-METER becomes an inline subtask of this step. No instrument = the step cannot prove its own success.',
        ],
      },
      {
        id: 'reviewer-timing',
        text: 'Who reviews the outcome and when (Study-Act timing)?',
        rationale: 'Without a named reviewer and a date, Study-Act becomes "someone, eventually" = never.',
        suggestedAnswers: [
          'Reviewer: Product lead (Maria). When: 7 days after deploy, 30-minute review meeting on the team calendar. Output: written 1-pager decision in the plan history.',
          'Pick ONE named reviewer per V., and ONE calendar date. If the reviewer is "the team", reduce to a single accountable individual — Study-Act diffuses without a single owner.',
          'If no review is scheduled, this step skips Evo cycle steps 8–9 entirely — it becomes Plan-Do only. Tom\'s 9-step cycle requires Measure + Learn to count.',
        ],
      },
      {
        id: 'decision-data',
        text: 'What\'s the MINIMUM data needed to decide "this step worked" or "didn\'t work"?',
        rationale: 'Define minimal data upfront so the team doesn\'t fall into "we need more data before deciding" paralysis.',
        suggestedAnswers: [
          'Minimum: V.LoginSuccess delta ≥ +3 over 7-day window vs baseline. If delta < +3, the step did not work as intended — regardless of dev sentiment.',
          'For each target V.: pre-commit to ONE numeric threshold the data must clear. Anything below = did not work; equal to or above = worked. No "we need more time".',
          'If the team cannot agree on the minimum threshold pre-delivery, the V. target is too vague — re-sharpen the V.\'s Tolerable/Goal fields before starting this step.',
        ],
      },
    ],
  },

  // ── 7. Resources Management (Tom) ───────────────────────────────────────────
  {
    id: 'resources',
    label: 'Resources Management',
    description: 'Time, money, people budgets for this step',
    accent: 'bg-teal-500',
    questions: [
      {
        id: 'calendar-budget',
        text: 'Calendar weeks budget — is it fixed (cycle ceiling) or can it flex?',
        rationale: 'Fixed = the step must be cut if it overruns. Flexible = scope can grow. Decide BEFORE you start.',
        suggestedAnswers: [
          'Fixed at 1 week (cycle ceiling). If we overrun, we cut scope per the prepared cut-list — we do NOT extend the cycle.',
          'Flexible up to +50% IF the V. impact projection holds. Beyond +50%, we stop, re-estimate, and re-commit at the next planning cycle.',
          'If "we will see" — that is the failure mode. Pre-commit either "fixed, cut on overrun" or "flex with a cap" — never both, never neither.',
        ],
      },
      {
        id: 'capital-budget',
        text: 'Capital $ budget — what\'s the breakeven V. impact required to justify it?',
        rationale: 'Spending without a breakeven means accepting any outcome as "fine". Set the bar in advance.',
        suggestedAnswers: [
          'Budget $15k. Breakeven: V.LoginSuccess must lift +5 points OR V.Revenue projected +$50k/year (3× payback in year 1).',
          'Compute: cost / (annual revenue-per-user-point × number-of-users) = the minimum V. point lift to break even. Use that as the no-go threshold.',
          'If the breakeven V. impact is higher than the step\'s projected V. impact, the step is unfunded by its own math — split, cheapen, or kill.',
        ],
      },
      {
        id: 'resource-contention',
        text: 'What other steps share these resources (contention check)?',
        rationale: 'Two steps sharing one critical person is a single point of failure. Surface the contention before commitment.',
        suggestedAnswers: [
          'Step shares the senior backend dev with Step 5 (which is parallel). Mitigation: this step\'s backend task starts on day 1; Step 5\'s backend task starts on day 4 after handoff.',
          'List the named owners across this step and adjacent steps. If any single person appears in >1 active step, surface the contention to leadership before committing.',
          'If no contention exists, this step is fully isolated — confirm by checking dependencies in BOTH directions (we depend on others, others depend on us).',
        ],
      },
    ],
  },

  // ── 8. Risk Management (Tom) ────────────────────────────────────────────────
  {
    id: 'risk',
    label: 'Risk Management',
    description: 'What could fail, and how we\'ll catch / recover',
    accent: 'bg-red-500',
    questions: [
      {
        id: 'biggest-risk',
        text: 'What\'s the biggest risk to this step\'s VALUE delivery (not just task completion)?',
        rationale: 'Many risks affect tasks (slip, scope, blockers). The dangerous risks affect V. status — completing tasks but failing to move the metric.',
        suggestedAnswers: [
          'Biggest risk: we ship the auth flow, tasks complete, but stakeholder V.LoginSuccess does not lift because the bottleneck is the password reset (NOT in this step\'s scope).',
          'Distinguish risks-to-tasks (slip, scope creep, blockers) from risks-to-V. (we did the work but the V. did not move). Name the top risk in EACH bucket.',
          'If the biggest risk is "tasks slip", the step is rated too easy on V. impact — re-check whether finishing tasks even moves any V. measurably.',
        ],
      },
      {
        id: 'early-warning',
        text: 'What\'s the early-warning signal if value delivery is going wrong?',
        rationale: 'Without an early signal, you\'ll discover failure at the end. The earlier the signal, the cheaper the pivot.',
        suggestedAnswers: [
          'Early signal: day-3 internal demo against staging — if the test users cannot complete the flow in <10s, the V.LoginSpeed target will not land. Pivot day = day 4.',
          'For each target V.: identify the cheapest leading indicator that can be checked mid-cycle. Schedule the check explicitly (date + owner) so it is not skipped.',
          'If no early signal exists, build one as part of this step\'s tasks. The cost of building the signal is far below the cost of discovering failure at delivery.',
        ],
      },
      {
        id: 'rollback-plan',
        text: 'What\'s the rollback plan if a V. status DROPS instead of rises?',
        rationale: 'Steps can make things WORSE. Pre-committing a rollback path means you can ship aggressively, knowing you can revert.',
        suggestedAnswers: [
          'Rollback: feature flag wraps the new flow. If V.LoginSuccess drops ≥2 points in 24h, flip the flag back. Old flow retained in code for 30 days.',
          'For each target V.: define the threshold at which we roll back, and the mechanism (flag flip / db revert / re-deploy previous build). Test the mechanism BEFORE shipping.',
          'If no rollback is possible (irreversible db migration, third-party commitment), this is not a normal Evo step — escalate to a Skunkworks-class decision with explicit constraint relaxation.',
        ],
      },
    ],
  },

  // ── 9. Stakeholder Visibility (PROPOSED — Claudian) ─────────────────────────
  {
    id: 'stakeholder-visibility',
    label: 'Stakeholder Visibility',
    description: 'Who actually experiences and signs off this step\'s value',
    accent: 'bg-sky-500',
    proposed: true,
    questions: [
      {
        id: 'experiencing-stakeholders',
        text: 'Which stakeholders directly experience this step\'s delivery?',
        rationale: 'Tasks completing inside the team ≠ stakeholders experiencing benefit. If nobody outside the team sees it, no value was delivered.',
        suggestedAnswers: [
          'End users (~12,000 daily active), Support team (10 agents), Compliance reviewer (1). Each gets a tailored notice; end users via in-app banner, others via email.',
          'For each stakeholder in the spec\'s F. or V. entries: ask "do they SEE / FEEL / MEASURE this step\'s delivery?" If yes, list them; if no, the step is internal-only.',
          'If no external stakeholder experiences the step, the step delivers no stakeholder value — re-classify as enabling work and pair with a value-delivering step downstream.',
        ],
      },
      {
        id: 'discovery-comms',
        text: 'How do they find out it\'s available (communication plan)?',
        rationale: 'Released ≠ adopted. The comms plan is part of the step, not an afterthought.',
        suggestedAnswers: [
          'In-app banner on first login post-deploy + Support team gets a 1-page brief 2 days before + Compliance reviewer gets a calendar invite for week-2 review.',
          'For each experiencing stakeholder: name the channel, the message, and the date. Released-but-no-comms = nobody adopts = no V. lift = step failure.',
          'If the comms plan is "we will figure it out at the end" — the step is incomplete. Comms is a first-class task, not an afterthought.',
        ],
      },
      {
        id: 'value-signoff',
        text: 'Who explicitly approves "VALUE delivered" (vs. "work completed")?',
        rationale: 'A named external sign-off is the only honest test that the V. target was reached.',
        suggestedAnswers: [
          'Product lead (external to dev team) signs off after reading the Measure report at +7 days. Sign-off is captured in the plan history with the date.',
          'Pick a named individual outside the implementing team. Their sign-off is conditional on the Measure data meeting the pre-committed threshold (Decision Data answer above).',
          'If the only approver is on the dev team, you have task sign-off — NOT value sign-off. Add an external approver before commit.',
        ],
      },
    ],
  },

  // ── 10. Acceptance / Done (PROPOSED — Claudian) ─────────────────────────────
  {
    id: 'acceptance',
    label: 'Acceptance / Done Criterion',
    description: 'Observable, falsifiable definition of "done" for this step',
    accent: 'bg-cyan-500',
    proposed: true,
    questions: [
      {
        id: 'done-criterion',
        text: 'What is the LITERAL "done" criterion — observable and falsifiable?',
        rationale: '"Done" must be checkable by an outsider. "It\'s working" is not a criterion.',
        suggestedAnswers: [
          'Done = (a) endpoint returns valid token for valid credentials in <200ms p95 across 1000 synthetic requests, (b) F.UserAuth presenceTest passes, (c) external smoke-test script exits 0.',
          'Write the done criterion as a YES/NO question an outsider could answer with a screenshot or a log query. "It works" is NOT a criterion.',
          'If the done criterion takes >2 sentences, decompose it into per-task done criteria so each task has its own falsifiable check.',
        ],
      },
      {
        id: 'presence-tests',
        text: 'Which presenceTest(s) on F. entries does this step satisfy?',
        rationale: 'Functions are binary (present/absent). Naming the F. entries this step turns on ties the step to the Planguage spec.',
        suggestedAnswers: [
          'F.UserAuth.presenceTest ("authentication endpoint exists and returns session token") flips from NO to YES on deployment of this step.',
          'For each F. in the spec touched by this step: name the presenceTest, name the YES/NO state before this step, name the YES/NO state after. Three of four cells should change.',
          'If no F. presenceTest flips state, this step adds no Function — it is a Value-only step (e.g., tightens a tolerable). Tag explicitly so it is not confused with Function-delivering steps.',
        ],
      },
      {
        id: 'acceptance-scenarios',
        text: 'What Given/When/Then scenarios can you write NOW (before code)?',
        rationale: 'Behaviour-first writing forces clarity. If you can\'t write the scenarios, the step isn\'t crisp enough yet.',
        suggestedAnswers: [
          'GIVEN valid email + password / WHEN POST /auth/login / THEN response is 200 + session token + token is verifiable. Plus 2 negative scenarios (wrong password, missing email).',
          'For each linkedSolution: write 1 happy-path GIVEN/WHEN/THEN + 1 sad-path. Six scenarios for a 2-solution step. If you cannot, the step is not yet sharp enough.',
          'If the scenarios change every time you write them down, the step\'s scope is moving — Lock the scope first, then write the scenarios.',
        ],
      },
    ],
  },

  // ── 11. Cycle Fit Check (PROPOSED — Claudian) ───────────────────────────────
  {
    id: 'cycle-fit',
    label: 'Cycle Fit Check',
    description: 'Does this step fit ONE cycle? Where would it split if not?',
    accent: 'bg-indigo-500',
    proposed: true,
    questions: [
      {
        id: 'fits-cycle',
        text: 'Does the estimated effort fit within ONE Evo cycle (per evoCycleLength)?',
        rationale: 'The most common Evo failure is oversized increments. If the answer is "barely", treat it as "no".',
        suggestedAnswers: [
          'Yes, comfortably: estimated 28h of 40h Week cycle = 70% utilisation. 30% slack absorbs typical overruns without scope cuts.',
          'Estimate the step\'s hours; divide by the cycle\'s ~Nh. If <60%, fits comfortably. 60–80%, fits with slack. 80–100%, risky — apply the split-boundary question.',
          'If "barely fits" — treat as "does not fit". Barely-fitting steps consume all slack and have no recovery margin when reality intrudes.',
        ],
      },
      {
        id: 'split-boundary',
        text: 'If it doesn\'t fit, where\'s the natural split — what\'s the smaller first step that still moves a V.?',
        rationale: 'Splitting is the Decompose step (Evo cycle step 4). The split MUST itself deliver value, not just be "half the work".',
        suggestedAnswers: [
          'Split: Step 1A = backend endpoint only (V.AuthAvailable: NO→YES). Step 1B = frontend client + UX polish (V.LoginSpeed: 12s→6s). Each ships in 1 cycle, each moves a different V.',
          'A valid split must produce TWO steps that each move ≥1 V. measurably. "Half the work" without value movement is NOT a valid split — it is just slicing.',
          'If you cannot find a value-preserving split, the step\'s scope IS atomic — escalate to a longer cycle (e.g., Week → Month) rather than cramming.',
        ],
      },
      {
        id: 'slack-budget',
        text: 'Is there slack to absorb estimate overruns, or is this step at the cycle ceiling?',
        rationale: 'A step at the ceiling has zero margin. Plan a cut-list (what we drop if we overrun) in advance.',
        suggestedAnswers: [
          'Slack: 30% (12h of 40h). Cut-list if needed: (1) drop the polished error messages, (2) defer the admin dashboard, (3) skip the i18n strings. All retain V. lift.',
          'Compute slack = cycle hours − estimated step hours. If <20%, write a CUT LIST in advance: 3 named items, in priority order, that get dropped on overrun without losing the V. target.',
          'If the cut list is empty (everything is essential), the step is over-scoped — apply the split-boundary question before committing.',
        ],
      },
    ],
  },

  // ── 12. Decomposition Check (PROPOSED — Claudian) ───────────────────────────
  {
    id: 'decomposition',
    label: 'Decomposition Check',
    description: 'Could this step be smaller and still deliver value?',
    accent: 'bg-fuchsia-500',
    proposed: true,
    questions: [
      {
        id: 'split-candidates',
        text: 'Could this step be split into 2+ smaller steps with INDEPENDENTLY measurable V. delivery?',
        rationale: 'Two smaller steps that each move a V. = two learning opportunities. One big step = one learning opportunity.',
        suggestedAnswers: [
          'Yes: split into (a) read-path step (V.QueryLatency lift) + (b) write-path step (V.WriteThroughput lift). Each ships independently, each measures its own V.',
          'For each linkedValue: ask "could a smaller step move JUST this V.?" If yes for ≥2 V., the step is a candidate for splitting along value lines.',
          'If splitting would force shared infrastructure to be built twice (or a shared mock retained for too long), the cost of split exceeds the value of the second learning loop — keep as one step.',
        ],
      },
      {
        id: 'smallest-meaningful',
        text: 'What\'s the smallest meaningful V. movement deliverable in 1/3 of this step\'s time?',
        rationale: 'Asks the team to imagine the tiniest first step. Often reveals a useful Spike or proof-of-concept slice.',
        suggestedAnswers: [
          'Smallest: end-to-end hardcoded happy-path login that proves the architecture. Ships in 2 days (vs 6 day full step). Lifts V.LoginAvailable from NO to YES; defers V.LoginSpeed to the rest of the step.',
          'Imagine a 30%-time slice. What is the most value-bearing piece you could ship in that slice? That piece is your candidate first-half OR your candidate Spike.',
          'If no meaningful V. movement is possible in 1/3 the time, the step\'s value-delivery curve is back-loaded — accept the risk explicitly, or rethink the architecture.',
        ],
      },
      {
        id: 'compounding-effect',
        text: 'Does delivering this step unlock OTHER steps (positive compounding)?',
        rationale: 'Steps that unlock others have higher real value than their direct V. impact suggests. Worth prioritising.',
        suggestedAnswers: [
          'Yes: unlocks Steps 4, 5, 7 (all blocked on auth). Real value = this step\'s direct V. lift PLUS 3 unblocked steps\' cumulative V. lift × probability they ship.',
          'List downstream steps in the current plan. For each: does it depend on this step\'s output? If yes, this step\'s real V/C ratio is undercounted — boost its priority accordingly.',
          'If this step unlocks nothing downstream, its priority should be EXACTLY its direct V. impact — no leverage bonus. Useful to avoid over-prioritising "infrastructure" steps without payoff.',
        ],
      },
    ],
  },
]

/** Helper: total question count across all categories (for progress UI). */
export function totalQuestionCount(): number {
  return EVO_SHARP_CATEGORIES.reduce((sum, cat) => sum + cat.questions.length, 0)
}

/** Helper: returns category by id, or undefined. */
export function getCategoryById(id: string): SharpCategory | undefined {
  return EVO_SHARP_CATEGORIES.find(c => c.id === id)
}
