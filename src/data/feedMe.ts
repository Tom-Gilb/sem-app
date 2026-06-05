// UNIT_TYPE=Data
//
// feedMe.ts — types, Claudian prompt, mock seed for the "FEED ME!" Evo Tool.
//
// SOURCE (Tom Gilb 2026-06-03 verbatim):
//   *"Now the '\"FEED ME!\"' (yes a nod to the meat eating flower in the musical):
//     This is about feedback (very broad, deep, all sources) and Learning
//     (changes to specs and evo and task plans to account for, deal with,
//     satisfy, the feedback.  'Feedback Base': everything about older system
//     the Evo step is being integrated into, 'Evo Base' (everything about the
//     series of Evo steps done until now (measures, stakeholder feedback, our
//     dev staff observations, good question from this tool), 3. Last Step in
//     Paris (nod to Last Tango), the Very Last Evo Increment (including
//     lagging indicators a little while after (a week as opposed to immediate
//     measures).  A set of Tough questions to DEV about last increment, and
//     suggested clever AI answers to act on.  All this as the basis for a
//     recommended set of Planning and Step Management Actions to approve and
//     go with.  All actions that change the Planguage specs, and the Evo
//     Tasks, are recorded as to Source and Reason."*
//
// Cultural reference:  "FEED ME!" — Audrey II, the carnivorous plant in
// "Little Shop of Horrors" (Howard Ashman / Alan Menken 1982 musical, 1986
// film).  The plant grows by being fed.  Tool grows the Evo plan's quality
// by being fed feedback.
//
// AUDIT TRAIL is the binding constraint (Tom's words): every action that
// changes the Planguage spec or the Evo Tasks MUST carry Source + Reason
// fields.  RecommendedAction interface enforces this at the type level —
// both fields are required (not optional).
//
// AI ARCHITECTURE (per Claude-Code-as-AI-Layer SUPREME rule):
//   - Tool does NOT call AI in-app
//   - Tough question generation + suggested AI answers + recommended actions
//     ALL happen via Claudian (prompt → JSON paste-back)
//   - Mock seed provides demonstrable UX from first open
//   - buildClaudianPrompt() emits the structured prompt with required shape

import type { EvoStep } from '../types/evo-plan'
import type { SourceProvenance } from './aiSource'

// ── Section 1: Feedback Base — the older system being integrated into ────────

/** A baseline measurement of a Value entry BEFORE the Evo project started.
 *  Used to compute V. status delta later (vs. Goal). */
export interface BaselineMetric {
  /** V. entry id or descriptive ref */
  valueRef: string
  /** Measured baseline status (units of the V.'s Scale) */
  baselineStatus: number
  /** The V.'s Goal target (for reference / progress %) */
  goal: number
  /** Free-text notes about how the baseline was measured */
  notes?: string
  /** Date measured (Date.now()) */
  measuredAt: number
}

/** Section 1: everything about the older system the Evo step plugs into. */
export interface FeedbackBase {
  /** Free-text description of the legacy / existing system context. */
  systemContext: string
  /** Baseline measurements taken BEFORE the Evo project started. */
  baselineMetrics: BaselineMetric[]
  /** Known constraints / characteristics of the existing system that constrain Evo. */
  knownConstraints: string[]
  /** Integration notes — team observations about plugging into the existing system. */
  integrationNotes: string[]
}

// ── Section 2: Evo Base — all completed Evo steps until now ──────────────────

/** Record of a completed Evo step — what was delivered + measured + heard. */
export interface CompletedStepRecord {
  /** Step name (EvoStep.name from the time it was confirmed) */
  stepName: string
  /** Date the step was completed */
  completedAt: number
  /** V. status delta from before-step → after-step.  { valueRef: deltaUnits }. */
  vStatusDelta: Record<string, number>
  /** Stakeholder feedback verbatim quotes received about this step. */
  stakeholderFeedback: string[]
  /** Dev staff observations about this step. */
  devObservations: string[]
}

/** A piece of feedback received from any source. */
export interface AccumulatedFeedback {
  /** Where the feedback came from. */
  source: 'stakeholder' | 'dev' | 'tool' | 'measure' | 'external'
  /** The feedback content. */
  text: string
  /** Date received. */
  receivedAt: number
  /** If this feedback led to a spec/plan change, the action id. */
  appliedToActionId?: string
}

/** Section 2: everything about the series of Evo steps done until now. */
export interface EvoBase {
  /** All completed step records (most recent first). */
  completedSteps: CompletedStepRecord[]
  /** Accumulated feedback across sources. */
  accumulatedFeedback: AccumulatedFeedback[]
  /** Good questions this tool has asked before (institutional memory). */
  goodQuestionsAsked: string[]
}

// ── Section 3: Last Step in Paris — the very last Evo increment + lagging ────

/** A measurement of a V. — distinguished by whether it's immediate or lagging. */
export interface Measure {
  /** V. entry ref */
  valueRef: string
  /** Measured status value (units of the V.'s Scale) */
  status: number
  /** Date measured (Date.now()) */
  measuredAt: number
  /** How it was measured — instrumentation, survey, log mining, etc. */
  measurementMethod: string
  /** true = lagging indicator (measured days-to-weeks after delivery), false = immediate */
  isLagging: boolean
  /** For lagging measures: days after the step was delivered */
  daysAfterDelivery?: number
}

/** Status lifecycle for a tough question. */
export type ToughQuestionStatus = 'pending' | 'accepted' | 'modified' | 'dismissed'

/** A tough question to DEV about the last increment, with AI-suggested answer. */
export interface ToughQuestion {
  /** Stable id */
  id: string
  /** The tough question itself.  Tom's spec: questions that are HARD —
   *  the kind that surface what nobody wants to face about the last step. */
  text: string
  /** Optional context (which measure / feedback / observation prompted the question). */
  context?: string
  /** AI-suggested clever answer that DEV can accept, modify, or dismiss. */
  suggestedAIAnswer: string
  /** Dev's actual response (when answered).  May overwrite the suggested answer. */
  devResponse?: string
  /** Lifecycle status. */
  status: ToughQuestionStatus
  /** If this question triggered a recommended action, the action's id. */
  triggeredActionId?: string
  /** Source-layer provenance for the AI-suggested answer — Tom 2026-06-03
   *  Conjunction-of-Technologies principle. */
  answerProvenance?: SourceProvenance
}

/** Section 3: the very latest Evo increment + delayed measures. */
export interface LastStepInParis {
  /** Step name of the most recent completed Evo step. */
  stepName: string
  /** Date the step was delivered. */
  deliveredAt: number
  /** Measures taken immediately after delivery (within hours/days). */
  immediateMeasures: Measure[]
  /** Lagging measures taken a week+ later — Tom: "a little while after (a
   *  week as opposed to immediate measures)". */
  laggingMeasures: Measure[]
  /** Tough questions to DEV + suggested AI answers. */
  toughQuestions: ToughQuestion[]
}

// ── Section 4: Recommended Actions ───────────────────────────────────────────

/** Type of action being recommended. */
export type RecommendedActionType = 'spec-change' | 'evo-task-change' | 'plan-change'

/** Lifecycle status for an action. */
export type RecommendedActionStatus = 'pending' | 'approved' | 'rejected' | 'applied'

/** A recommended action.
 *
 *  AUDIT TRAIL (Tom 2026-06-03 verbatim): *"All actions that change the
 *  Planguage specs, and the Evo Tasks, are recorded as to Source and Reason."*
 *  Both `source` and `reason` are REQUIRED (not optional) — the type system
 *  prevents shipping an action without its audit trail. */
export interface RecommendedAction {
  /** Stable id */
  id: string
  /** What kind of change this is. */
  type: RecommendedActionType
  /** Short action title (one phrase). */
  title: string
  /** Full action description — what to do, where, how. */
  description: string

  // ── AUDIT TRAIL (required) ────────────────────────────────────────────────
  /** Where this action came from.  e.g., "Tough Question #2: lagging V.NPS
   *  drop after Step 4" or "Stakeholder feedback verbatim: 'the new flow
   *  hides the cancel button'".  REQUIRED — no action without provenance. */
  source: string
  /** Why this action is recommended — the chain of reasoning that justifies
   *  it.  REQUIRED — no action without rationale. */
  reason: string

  // ── State ────────────────────────────────────────────────────────────────
  /** Approval lifecycle. */
  status: RecommendedActionStatus
  /** Date approved (or rejected) */
  reviewedAt?: number
  /** Who reviewed it (Tom by default; future: named user) */
  reviewedBy?: string
  /** Free-text rejection / approval note */
  reviewNote?: string
  /** Date actually applied to the spec/plan (v2 — v1 stops at 'approved'). */
  appliedAt?: number
  /** Source-layer provenance — Tom 2026-06-03 Conjunction-of-Technologies
   *  principle.  Every recommended action MUST carry source-layer info so
   *  the user can see whether the recommendation came from the plan / Gilb
   *  corpus / standards / LLM / etc.  Optional in v1 for backward
   *  compatibility; REQUIRED in the Claudian prompt for new actions. */
  provenance?: SourceProvenance
}

// ── The whole FEED ME! set ───────────────────────────────────────────────────

export interface FeedMeSet {
  /** Plan id (stable identifier) */
  planId: string
  /** When the set was created or last regenerated */
  generatedAt: number
  /** Source — 'claudian' (real), 'mock' (seed), 'manual' (user-entered) */
  generatedBy: 'claudian' | 'mock' | 'manual'
  feedbackBase: FeedbackBase
  evoBase: EvoBase
  lastStepInParis: LastStepInParis | null
  recommendedActions: RecommendedAction[]
}

// ── localStorage key ─────────────────────────────────────────────────────────

export function storageKey(planId: string): string {
  return `feedMe:v1:${(planId || 'default').trim()}`
}

// ── Claudian prompt builder ──────────────────────────────────────────────────

/** Builds the prompt Tom copies into Claudian to generate a fresh FEED ME!
 *  set for the current plan.  Tom invokes Claudian (this session or fresh),
 *  pastes the JSON back into the panel. */
export function buildClaudianPrompt(
  steps: EvoStep[],
  lastStep: EvoStep | null,
  existingFeedbackBase?: FeedbackBase,
): string {
  const stepsListing = steps.length === 0
    ? '(no Evo steps yet)'
    : steps.map((s, i) => `  ${i + 1}. ${s.name} — ${s.description.slice(0, 100)}`).join('\n')

  return [
    'You are the FEED ME! analyst (Tom Gilb 2026-06-03 — feedback + learning agent for the Evo plan).',
    '',
    'CONTEXT:',
    `  Plan has ${steps.length} Evo step(s):`,
    stepsListing,
    '',
    `  Most recent (Last Step in Paris): ${lastStep?.name ?? '(none yet)'}`,
    lastStep ? `  Last step description: ${lastStep.description}` : '',
    '',
    existingFeedbackBase ? `EXISTING FEEDBACK BASE:\n${JSON.stringify(existingFeedbackBase, null, 2)}\n` : '',
    'TASK — produce a fresh FEED ME! analysis covering 4 sections:',
    '',
    '  1. FEEDBACK BASE — what we know about the older system the Evo steps integrate into:',
    '       systemContext, baselineMetrics, knownConstraints, integrationNotes.',
    '       If existing Feedback Base is provided above, preserve and augment, do not replace.',
    '',
    '  2. EVO BASE — what we have learned across the completed Evo steps:',
    '       completedSteps (with vStatusDelta per V., stakeholderFeedback verbatim, devObservations),',
    '       accumulatedFeedback (across sources),',
    '       goodQuestionsAsked (institutional memory of questions worth asking).',
    '',
    '  3. LAST STEP IN PARIS — the very latest increment, including LAGGING measures:',
    '       immediateMeasures (taken hours-to-days after delivery),',
    '       laggingMeasures (taken ~1 WEEK after — the delayed signals),',
    '       toughQuestions: a set of HARD questions to DEV about the last step,',
    '         each with a clever suggestedAIAnswer DEV can accept / modify / dismiss.',
    '       Tom\'s spec: tough questions should surface what nobody wants to face.',
    '',
    '  4. RECOMMENDED ACTIONS — a prioritised list of Planning + Step Management Actions',
    '       to approve.  EVERY action MUST carry source (where it came from) and reason',
    '       (why it is recommended).  This is the audit trail Tom requires.',
    '       Actions can be:',
    '         type: "spec-change"     — modify a V/F/S/C entry',
    '         type: "evo-task-change" — insert / rescope / reorder an Evo step or task',
    '         type: "plan-change"     — broader plan-level adjustment',
    '       All status: "pending".',
    '',
    'SOURCE-LAYER REQUIREMENT (Tom 2026-06-03 Conjunction-of-Technologies SUPREME principle):',
    '  Every Tough Question answer + every Recommended Action MUST carry a `provenance` object',
    '  with `source` enum: "plan" (deterministic from spec) | "gilb" (cite Gilb book + chapter)',
    '  | "standards" (cite 10.Standard file) | "internet" (with URL) | "llm" (general knowledge)',
    '  | "template" (fallback).  Prefer plan / gilb / standards.  Gilb citations MUST be real —',
    '  name the book + chapter + short quote.  Do NOT hallucinate citations.',
    '  Add `answerProvenance` per ToughQuestion and `provenance` per RecommendedAction.',
    '',
    'OUTPUT — return ONLY this JSON, no prose, no markdown fences:',
    '',
    JSON.stringify({
      planId: '(filled in by app — leave empty)',
      generatedAt: 0,
      generatedBy: 'claudian',
      feedbackBase: {
        systemContext: '...',
        baselineMetrics: [{ valueRef: 'V.X', baselineStatus: 0, goal: 100, notes: '...', measuredAt: 0 }],
        knownConstraints: ['...'],
        integrationNotes: ['...'],
      },
      evoBase: {
        completedSteps: [{
          stepName: '...',
          completedAt: 0,
          vStatusDelta: { 'V.X': 20 },
          stakeholderFeedback: ['verbatim quote...'],
          devObservations: ['...'],
        }],
        accumulatedFeedback: [{ source: 'stakeholder', text: '...', receivedAt: 0 }],
        goodQuestionsAsked: ['...'],
      },
      lastStepInParis: {
        stepName: lastStep?.name ?? '(none)',
        deliveredAt: 0,
        immediateMeasures: [{ valueRef: 'V.X', status: 75, measuredAt: 0, measurementMethod: '...', isLagging: false }],
        laggingMeasures: [{ valueRef: 'V.X', status: 65, measuredAt: 0, measurementMethod: '...', isLagging: true, daysAfterDelivery: 7 }],
        toughQuestions: [{
          id: 'tq-1',
          text: 'Why did the lagging V.X drop 10 points one week after delivery?',
          context: 'Lagging measure for V.X is 10 below immediate measure',
          suggestedAIAnswer: 'Likely root cause: ...',
          status: 'pending',
          answerProvenance: {
            source: 'gilb',
            gilbCitation: { book: 'PoSEM', ref: 'ch.15', quote: 'Optional supporting quote' },
          },
        }],
      },
      recommendedActions: [{
        id: 'act-1',
        type: 'spec-change',
        title: 'Add constraint C.NoSessionEviction',
        description: 'What to do, where, how',
        source: 'Tough Question #1 about lagging V.X drop',
        reason: 'The drop is explained by session eviction; preventing it requires a new C. entry',
        status: 'pending',
        provenance: {
          source: 'gilb',
          gilbCitation: { book: 'Competitive Engineering', ref: 'Constraints chapter', quote: 'Optional quote' },
        },
      }],
    }, null, 2),
    '',
    'After producing the JSON, paste the entire JSON block into the FEED ME! panel via "Paste & Save".',
  ].join('\n')
}

// ── Mock seed ────────────────────────────────────────────────────────────────

/** Builds a generic mock FeedMeSet so the panel is demonstrable on first open.
 *  Uses the actual step list so the mock references real step names. */
export function buildMockFeedMe(planId: string, steps: EvoStep[]): FeedMeSet {
  const lastStep = steps[steps.length - 1] ?? null
  const completedSteps: CompletedStepRecord[] = steps.slice(0, -1).map(s => ({
    stepName: s.name,
    completedAt: Date.now() - (steps.length * 7 * 86400_000),
    vStatusDelta: Object.fromEntries((s.linkedValues.length > 0 ? s.linkedValues : ['(no values)']).map(v => [v, 15])),
    stakeholderFeedback: [
      `"${s.name} was solid but slower to land than expected." — Product lead`,
      `"Useful, but we still need X." — Operations`,
    ],
    devObservations: [
      `Integration with legacy module took 2× the estimate.`,
      `Test coverage on the new code dropped to 78%.`,
    ],
  }))

  return {
    planId,
    generatedAt: Date.now(),
    generatedBy: 'mock',
    feedbackBase: {
      systemContext:
        'Legacy system: 8-year-old monolith with REST API layer.  Authentication via JWT in HTTP-only ' +
        'cookies.  Database: PostgreSQL 14 with ~50M user rows.  Front-end: a mix of jQuery (older flows) and Vue 2 ' +
        '(newer flows).  Average request latency: 240ms p50, 1.2s p95.',
      baselineMetrics: [
        { valueRef: '(your first V.)', baselineStatus: 40, goal: 90, notes: 'Measured Q4 last year', measuredAt: Date.now() - (180 * 86400_000) },
        { valueRef: '(your second V.)', baselineStatus: 12, goal: 50, notes: 'Initial baseline from logs', measuredAt: Date.now() - (180 * 86400_000) },
      ],
      knownConstraints: [
        'Cannot modify the legacy authentication module without 6-week security review',
        'Database migrations limited to 2-hour off-peak windows',
        'Front-end framework upgrade blocked until end of FY',
      ],
      integrationNotes: [
        'Legacy module emits inconsistent error codes — needs adapter layer',
        'Session timeout in legacy is 30min; new flows assume 24h — needs reconciliation',
      ],
    },
    evoBase: {
      completedSteps,
      accumulatedFeedback: [
        { source: 'stakeholder', text: 'Sales team says new login flow saved them 4 hours/week in support tickets', receivedAt: Date.now() - (14 * 86400_000) },
        { source: 'dev', text: 'CI build time increased 25% after Step 2 — caching may be wrong', receivedAt: Date.now() - (7 * 86400_000) },
        { source: 'measure', text: 'Lagging V.X dropped 8 points one week after Step 3', receivedAt: Date.now() - (3 * 86400_000) },
        { source: 'tool', text: 'Sharp Interview surfaced unaddressed risk in Solution Redesign for Step 4', receivedAt: Date.now() - (1 * 86400_000) },
      ],
      goodQuestionsAsked: [
        'What lagging measure are we NOT instrumenting that would prove the V. delivery?',
        'Which stakeholder is silent — and is silence consent or absence?',
        'What constraint did we accidentally relax without recording it?',
      ],
    },
    lastStepInParis: lastStep ? {
      stepName: lastStep.name,
      deliveredAt: Date.now() - (7 * 86400_000),
      immediateMeasures: (lastStep.linkedValues.length > 0 ? lastStep.linkedValues : ['(no V.)']).map(v => ({
        valueRef: v,
        status: 75,
        measuredAt: Date.now() - (7 * 86400_000),
        measurementMethod: 'Synthetic load test + production sample',
        isLagging: false,
      })),
      laggingMeasures: (lastStep.linkedValues.length > 0 ? lastStep.linkedValues : ['(no V.)']).map(v => ({
        valueRef: v,
        status: 63,
        measuredAt: Date.now() - (1 * 86400_000),
        measurementMethod: 'Production telemetry, 7-day window',
        isLagging: true,
        daysAfterDelivery: 7,
      })),
      toughQuestions: [
        {
          id: 'tq-1',
          text: `The lagging measure for ${lastStep.name} is 12 points BELOW the immediate measure.  Why?`,
          context: 'Immediate showed 75; lagging (7 days later) shows 63.  That gap is the real signal.',
          suggestedAIAnswer:
            'Likely root cause: the immediate measure captured peak-traffic synthetic load that excludes long-tail user behaviour.  ' +
            'The lagging measure includes mobile users on slow networks where the new flow times out at 8s vs the 5s budget.  ' +
            'Action: add a mobile-network-aware timeout retry path before declaring the step complete.',
          status: 'pending',
          answerProvenance: {
            source: 'gilb',
            gilbCitation: { book: 'PoSEM', ref: 'ch.15 (Measurement)', quote: 'You can only Learn from data you have Measured.' },
          },
        },
        {
          id: 'tq-2',
          text: `What did stakeholders say in week-2 that contradicts what they said in week-1?`,
          context: 'Stakeholder voice often pivots once usage becomes habitual rather than novel.',
          suggestedAIAnswer:
            'Week-1 feedback was overwhelmingly positive (novelty bias).  Week-2 quotes shifted: "it works but I miss the old keyboard shortcut".  ' +
            'The keyboard-shortcut regression was not in our DoD or acceptance scenarios.  ' +
            'Action: add a regression test for keyboard shortcuts to the spec\'s F. entries.',
          status: 'pending',
          answerProvenance: {
            source: 'gilb',
            gilbCitation: { book: 'Stakeholder Engineering', ref: 'Stakeholder Voice chapter', quote: 'Stakeholder week-1 enthusiasm regresses by week-2 — instrument lagging signal.' },
          },
        },
        {
          id: 'tq-3',
          text: `Did we accidentally relax a constraint to ship this step?`,
          context: 'Tom\'s Skunkworks framing: every shipped step may have implicitly relaxed something.',
          suggestedAIAnswer:
            'Yes — the implicit constraint "session timeout matches legacy 30min" was relaxed to 24h to make the new flow work.  ' +
            'This was not recorded as a C. entry change.  ' +
            'Action: either (a) add C.Session-Timeout-24h as an explicit relaxed constraint, or (b) revert to 30min and refactor the new flow.',
          status: 'pending',
          answerProvenance: {
            source: 'standards',
            standardsCitation: { file: 'Template_Write_Constraint.md', quote: 'Implicit constraint changes are technical debt — record every relaxation as an explicit C. entry change.' },
          },
        },
      ],
    } : null,
    recommendedActions: lastStep ? [
      {
        id: 'act-1',
        type: 'spec-change',
        title: 'Add C.MobileNetworkTimeout constraint',
        description: 'Add a new Constraint entry: "Mobile-network requests must complete or retry within 8s p95".  Update Step DoR to require mobile-network testing.',
        source: `Tough Question #1: ${lastStep.name} lagging measure 12 points below immediate`,
        reason: 'The lagging-vs-immediate gap is explained by mobile-network long-tail.  Without an explicit C. entry, future steps will silently repeat the regression.',
        status: 'pending',
        provenance: {
          source: 'standards',
          standardsCitation: { file: 'Template_Write_Constraint.md', quote: 'Every implicit constraint must become an explicit C. entry — Tom Gilb standard.' },
        },
      },
      {
        id: 'act-2',
        type: 'evo-task-change',
        title: 'Insert "Keyboard Shortcut Regression Fix" step',
        description: 'Insert a small Evo step before the next planned increment to restore keyboard shortcuts identified as missing by week-2 stakeholder feedback.',
        source: 'Tough Question #2: week-2 stakeholder feedback regression',
        reason: 'Stakeholder week-1 positivity was novelty bias.  Week-2 surfaced a real regression.  Inserting a small step preserves trust and prevents the regression compounding.',
        status: 'pending',
        provenance: {
          source: 'gilb',
          gilbCitation: { book: 'EVO 2024', ref: 'ch.2 step 9 (Learn)', quote: 'The Learn step turns measured surprise into the next plan iteration.' },
        },
      },
      {
        id: 'act-3',
        type: 'spec-change',
        title: 'Record C.Session-Timeout-24h as an explicit relaxed constraint',
        description: 'Either (a) add C.Session-Timeout-24h to the spec, or (b) revert to 30min and refactor.  Currently the relaxation is implicit and undocumented.',
        source: 'Tough Question #3: implicit constraint relaxation',
        reason: 'Implicit constraint changes are technical debt that costs 10× to discover later.  Recording the relaxation makes the trade explicit and reviewable.',
        status: 'pending',
        provenance: {
          source: 'gilb',
          gilbCitation: { book: 'Competitive Engineering', ref: 'Constraints chapter', quote: 'A constraint that is not explicit is not a constraint — it is an accident waiting to happen.' },
        },
      },
      {
        id: 'act-4',
        type: 'plan-change',
        title: 'Schedule a Feedback-Base refresh before next cycle',
        description: 'Update Feedback Base (legacy system context, baseline metrics, known constraints) before planning the next increment.  Some assumptions are 6 months stale.',
        source: 'Evo Base review: legacy system docs and baseline metrics last touched 6 months ago',
        reason: 'Stale baseline metrics produce stale impact deltas, which produce mis-prioritised Evo steps.  A 1-day refresh prevents a 1-cycle waste.',
        status: 'pending',
        provenance: {
          source: 'plan',
          note: 'Derived deterministically from the Evo Base completedSteps[].completedAt dates — last touched > 180 days ago.',
        },
      },
    ] : [],
  }
}
