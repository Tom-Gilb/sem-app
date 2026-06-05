// UNIT_TYPE=Data
//
// evoStepImprovement.ts — types + example seed for the "Evo Step Improvement"
// tool. Generates improvement ideas for an Evo Step, including a "crazy"
// first-shot, a critical analysis of that crazy shot, 1-5 better ideas, and
// a "Skunkworks" section of 2x-10x daring shots at higher risk and cost.
//
// SOURCE: Tom Gilb 2026-06-03 (verbatim):
//   *"a separate Evo Tool section for (not at bottom of sharpening as in SEM,
//     separate): 'Evo Step Improvement'.  It suggests 1 or more strong ideas,
//     the 'Evo Planner' (note the term) suggest their best shot at a 'crazy'
//     possibility.  It analyzes critically.  Offers 1 or 5 better ideas.,
//     Then a separate sub tool 'Daring and Wild Evo Ideas' (designed to
//     improve the result by 2x to 10X, at higher risks and costs), sort of
//     'Skunkworks' (call it that)."*
//
// AUTHORITY: "Evo Planner" is Tom's term (preserved verbatim throughout).
// "Skunkworks" is Tom's chosen name for the Daring and Wild Evo Ideas
// sub-tool — preserved verbatim.
//
// AI ARCHITECTURE (per Claude-Code-as-AI-Layer SUPREME rule):
//   - The "Evo Planner" generation does NOT run inside the SEM App.
//   - The tool exposes a "Generate via Claudian" button that copies a
//     structured prompt to clipboard.
//   - Tom runs the prompt through Claudian (this session or fresh).
//   - Claudian writes the resulting JSON back via the file pattern
//     (localStorage in v1; vault file or Supabase blob in v2).
//   - The SEM App reads the JSON deterministically and renders.
//   - Result: no in-app API call, no API key dependency, Tom orchestrates
//     timing and budget via his Claudian subscription.
//
// MOCK seed data is provided so the UI is demonstrable from first load,
// even before Tom has invoked Claudian for real ideas.

import type { EvoStep } from '../types/evo-plan'
import type { SourceProvenance } from './aiSource'

/** Category of an idea — drives which section it renders in + colour coding. */
export type ImprovementCategory = 'crazy' | 'safe' | 'skunkworks'

/** A constraint relaxation proposed by an idea — Tom 2026-06-03:
 *  *"Focus on Radical shift in tradeoffs (more risk, more resources, relax
 *   known constraints)"*.  Skunkworks ideas in particular should list which
 *  constraints they propose to RELAX, what the relaxation looks like, and
 *  why the value lift is worth the relaxation. */
export interface ConstraintRelaxation {
  /** Reference to the constraint being relaxed — ideally an existing C. entry id,
   *  but may be a free-text description if the LLM names a constraint not yet
   *  in the spec (signals a missing C. entry to be added). */
  constraintRef: string
  /** What the relaxation looks like — 1-2 sentences. e.g. "Relax budget ceiling
   *  from $50k to $200k" or "Defer compliance review until cycle 3". */
  relaxation: string
  /** Why this relaxation is worth taking on — 1-2 sentences. */
  justification: string
}

/** VDT/IET projection for an idea — Tom 2026-06-03:
 *  *"Give options in terms of VDT/IET"*.  Each idea expresses its expected
 *  impact in Impact-Estimation-Table terms: per-Value projected impact, plus
 *  resource cost projections (calendar weeks, capital $k).  This is what
 *  makes ideas COMPARABLE — they share the same units as the V × Step VDT. */
export interface VDTProjection {
  /** Per-Value projected impact:  { valueRef: projectedImpactPercent }.
   *  Values are 0-100 normally; Skunkworks ideas may project >100 (signals
   *  "blows past the original V. Goal"). */
  valueImpacts: Record<string, number>
  /** Projected calendar weeks for this idea — IET cost row analogue. */
  calendarWeeks: number
  /** Projected capital cost in $k — IET cost row analogue. */
  capitalK: number
}

/** A single improvement idea. */
export interface ImprovementIdea {
  /** Stable id for Vue :key + JSON storage. */
  id: string
  /** Rank within its category (1 = best, 5 = lowest of the top 5). 0 = unranked. */
  rank: number
  /** Short bold title (2-6 words). */
  title: string
  /** What the idea is, 2-4 sentences. */
  description: string
  /** Why this is better than the current step, 1-2 sentences. */
  rationale: string
  /** Estimated impact multiplier vs the current step
   *  (1.0 = same, 2.0 = twice as good, 10.0 = order-of-magnitude lift). */
  estimatedImpactMultiplier: number
  /** Risks introduced by this idea — short bullet phrases. */
  risks: string[]
  /** Costs introduced by this idea (calendar, capital, complexity) — short bullets. */
  costs: string[]
  /** Category — drives section placement and colour. */
  category: ImprovementCategory
  /** VDT/IET projection — Tom 2026-06-03: ideas should be expressible in
   *  Impact Estimation Table terms.  Optional in v1 (mocks include it,
   *  legacy data without it still renders); required in Claudian prompt. */
  vdtProjection?: VDTProjection
  /** Constraints this idea proposes to RELAX — Tom 2026-06-03: Skunkworks
   *  ideas in particular should make their constraint trades explicit.
   *  Optional in v1; emphasised in prompt for Skunkworks specifically. */
  constraintRelaxations?: ConstraintRelaxation[]
  /** Source-layer provenance — Tom 2026-06-03 Conjunction-of-Technologies
   *  SUPREME principle: every AI-generated idea MUST carry a source badge
   *  so the user sees whether the idea is plan-derived / Gilb-cited /
   *  LLM-knowledge / template / internet.  Optional in v1 for backward
   *  compatibility with legacy data; REQUIRED in the Claudian prompt for
   *  new ideas. */
  provenance?: SourceProvenance
}

/** The complete set of improvement ideas for one Evo Step. */
export interface ImprovementSet {
  /** Which Evo Step these ideas apply to. */
  stepName: string
  /** When the ideas were generated (Date.now()). */
  generatedAt: number
  /** Source of the ideas — 'claudian' (real), 'mock' (seed), 'manual' (user-entered). */
  generatedBy: 'claudian' | 'mock' | 'manual'
  /** The Evo Planner's bold first shot — deliberately ambitious. May be wrong. */
  crazyIdea: ImprovementIdea | null
  /** Critical analysis of the crazy idea — what's flawed, what assumptions break,
   *  what real-world constraints make it impractical. 3-5 sentences. */
  crazyCritique: string
  /** 1-5 better ideas — the safer, more practical refinements. Ranked. */
  betterIdeas: ImprovementIdea[]
  /** Skunkworks — Daring and Wild Evo Ideas. 2x-10x potential at high risk + cost.
   *  Typically 1-3 entries. Tom's term "Skunkworks" preserved per his 2026-06-03 quote. */
  skunkworksIdeas: ImprovementIdea[]
}

/** Builds the prompt Tom copies into Claudian to generate real improvement
 *  ideas for a specific Evo Step. Returns a multi-line string ready for
 *  clipboard. The prompt names the "Evo Planner" role (Tom's term) and
 *  specifies the exact JSON output shape so Claudian's response can be
 *  pasted back deterministically.
 *
 *  Tom 2026-06-03 sharpening — the SKUNKWORKS section is briefed
 *  explicitly to focus on RADICAL TRADEOFF SHIFTS (more risk, more
 *  resources, relax known constraints) and to express options in
 *  VDT / IET terms (per-Value projected impact + projected calendar
 *  weeks + projected capital $k). */
export function buildClaudianPrompt(step: EvoStep): string {
  return [
    'You are the Evo Planner (Tom Gilb\'s term).  Generate improvement ideas for the following Evo Step.',
    '',
    'EVO STEP:',
    `  Name: ${step.name}`,
    `  Description: ${step.description}`,
    `  Linked Values: ${step.linkedValues.join(', ') || '(none)'}`,
    `  Linked Solutions: ${step.linkedSolutions.join(', ') || '(none)'}`,
    `  Effort %: ${step.effortPercent}`,
    '',
    'TASK:',
    '  1. CRAZY IDEA: Propose your bold first shot — an ambitious, even risky',
    '     improvement that could change the value-delivery game.  Do not censor.',
    '  2. CRITIQUE: Then analyse the crazy idea critically.  What is flawed?',
    '     What assumptions fail?  What real-world constraints break it?  3-5 sentences.',
    '  3. BETTER IDEAS: Offer 1-5 better, safer, more practical refinements,',
    '     each with rationale, risks, costs, an estimated impact multiplier,',
    '     and a vdtProjection (per-Value projected impact %, calendar weeks, capital $k).',
    '  4. SKUNKWORKS: Daring and Wild Evo Ideas — 1-3 entries designed to lift',
    '     the result 2× to 10×.  Brief them explicitly on:',
    '       (a) RADICAL TRADEOFF SHIFTS — accept more risk, allocate more resources',
    '       (b) RELAX known constraints — each Skunkworks idea MUST list which',
    '           constraints it relaxes (constraintRelaxations array)',
    '       (c) EXPRESS in VDT/IET TERMS — vdtProjection must include per-Value',
    '           projected impacts (may exceed 100 to signal "blows past Goal"),',
    '           plus projected calendar weeks and capital $k',
    '       (d) EXPLORE AND ITERATE — produce DIVERSE skunkworks (do not duplicate the same idea',
    '           with cosmetic variations).  Each should be a distinct strategic move.',
    '',
    '',
    'SOURCE-LAYER REQUIREMENT (Tom 2026-06-03 Conjunction-of-Technologies SUPREME principle):',
    '  Every idea MUST carry a `provenance` object with `source` enum:',
    '    "plan"      — deterministic from the spec JSON above (preferred — name the spec field used)',
    '    "gilb"      — cite a specific Gilb book/chapter (Software Metrics, PoSEM, Competitive Engineering,',
    '                  EVO 2024, Stakeholder Engineering, SUCCESS, Value Improvement, etc.)',
    '    "standards" — cite a 10.Standard/Standard.Kai-Zen/ file (Template_Write_*.md, Rule_Write_*.md)',
    '    "internet"  — include URL (must be real, verifiable)',
    '    "llm"       — general LLM-training knowledge, no specific source',
    '    "template"  — fallback (least preferred)',
    '  Prefer plan / gilb / standards.  If you cite Gilb, the citation must be REAL — name the book,',
    '  chapter, and (where possible) a short quote.  Do NOT hallucinate citations.',
    '',
    'OUTPUT — return ONLY this JSON, no prose, no markdown fences:',
    '',
    JSON.stringify({
      stepName: step.name,
      generatedAt: 0,
      generatedBy: 'claudian',
      crazyIdea: {
        id: 'crazy-1',
        rank: 0,
        title: '...',
        description: '...',
        rationale: '...',
        estimatedImpactMultiplier: 3.0,
        risks: ['...'],
        costs: ['...'],
        category: 'crazy',
        vdtProjection: {
          valueImpacts: { 'V.ValueName': 75 },
          calendarWeeks: 4,
          capitalK: 20,
        },
        provenance: {
          source: 'gilb',
          gilbCitation: {
            book: 'EVO 2024',
            ref: 'ch.2 p.19',
            quote: 'Optional short quote that supports this idea',
          },
        },
      },
      crazyCritique: '...',
      betterIdeas: [
        {
          id: 'better-1',
          rank: 1,
          title: '...',
          description: '...',
          rationale: '...',
          estimatedImpactMultiplier: 1.5,
          risks: ['...'],
          costs: ['...'],
          category: 'safe',
          vdtProjection: {
            valueImpacts: { 'V.ValueName': 55 },
            calendarWeeks: 2,
            capitalK: 10,
          },
          provenance: {
            source: 'plan',
            note: 'Derived from step.linkedSolutions + V × S aggregation in the input spec',
          },
        },
      ],
      skunkworksIdeas: [
        {
          id: 'skunk-1',
          rank: 1,
          title: '...',
          description: '...',
          rationale: '...',
          estimatedImpactMultiplier: 5.0,
          risks: ['... (elevated)', '...'],
          costs: ['... (elevated)', '...'],
          category: 'skunkworks',
          vdtProjection: {
            valueImpacts: { 'V.ValueName': 120 },
            calendarWeeks: 8,
            capitalK: 80,
          },
          constraintRelaxations: [
            {
              constraintRef: 'C.ConstraintName (or free text if not yet in spec)',
              relaxation: 'What the relaxation looks like, 1-2 sentences',
              justification: 'Why the value lift is worth the relaxation, 1-2 sentences',
            },
          ],
          provenance: {
            source: 'gilb',
            gilbCitation: {
              book: 'Competitive Engineering',
              ref: 'Primary Prioritisation chapter',
              quote: 'Optional short quote',
            },
          },
        },
      ],
    }, null, 2),
    '',
    'After producing the JSON, paste the entire JSON block into the Evo Step Improvement panel via the "Paste & Save" button.',
  ].join('\n')
}

/** Generates mock seed ideas for a step so the UI is alive on first open.
 *  The mocks are deliberately generic (not domain-specific) so they make
 *  sense for any step. Real ideas come from Claudian via buildClaudianPrompt.
 *
 *  vdtProjection valueImpacts use the step's actual linkedValues as keys so
 *  the mini-VDT in the UI shows real value names from the user's spec. */
export function buildMockIdeas(step: EvoStep): ImprovementSet {
  // Build a per-value impact map using the step's actual linked values.
  // Each value gets a different mock impact so the mini-VDT is visually varied.
  const mockImpactsFor = (basePct: number, jitter: number): Record<string, number> => {
    const result: Record<string, number> = {}
    if (step.linkedValues.length === 0) {
      result['(no linked values)'] = basePct
    } else {
      step.linkedValues.forEach((vName, i) => {
        result[vName] = Math.max(0, basePct + (i * jitter))
      })
    }
    return result
  }

  return {
    stepName: step.name,
    generatedAt: Date.now(),
    generatedBy: 'mock',
    crazyIdea: {
      id: 'crazy-1',
      rank: 0,
      title: 'Eliminate this step entirely',
      description:
        'Identify whether the value targeted by this step could be delivered by an existing capability ' +
        'or by a 10-line manual workaround that ships today, deferring the full implementation indefinitely.',
      rationale:
        'The cheapest step is the one you do not build.  If the V. target can be met by repurposing an ' +
        'existing capability, the entire step\'s effort is freed for higher-leverage work.',
      estimatedImpactMultiplier: 5.0,
      risks: [
        'Workaround may be brittle and create technical debt',
        'Stakeholders may distrust a manual-looking solution',
        'Hidden capability gaps surface only at scale',
      ],
      costs: [
        '~1 day of investigation effort',
        'Possible reputational cost if workaround visibly degrades',
      ],
      category: 'crazy',
      vdtProjection: {
        valueImpacts: mockImpactsFor(40, -5),
        calendarWeeks: 0.2,
        capitalK: 1,
      },
      provenance: {
        source: 'gilb',
        gilbCitation: {
          book: 'Competitive Engineering',
          ref: 'Decision Tables chapter',
          quote: 'The cheapest design idea is the one not built.',
        },
      },
    },
    crazyCritique:
      'The "eliminate the step" idea is structurally sound — Evo theory rewards smaller scope — but it conflates ' +
      'two things: deferring a step vs. genuinely satisfying its V. target by other means.  If the existing capability ' +
      'truly hits the V. target, the step is redundant.  If it only approximates the V., the workaround creates a false ' +
      'sense of progress and prevents the real measurement.  Verify the workaround actually moves the V. status BEFORE ' +
      'deferring the step; otherwise this is hiding the work, not eliminating it.',
    betterIdeas: [
      {
        id: 'better-1',
        rank: 1,
        title: 'Halve the step, double the cycles',
        description:
          'Split the current step into two smaller steps that each deliver an independently measurable V. ' +
          'movement.  Ship the smaller step in the next cycle; learn; ship the second smaller step in the cycle after.',
        rationale:
          'Two learning loops beat one big bet.  If the first half exposes a flawed assumption, the second half ' +
          'is reshaped before any cost is sunk into it.',
        estimatedImpactMultiplier: 1.5,
        risks: ['Coordination overhead between the two halves', 'Stakeholders may perceive slower visible progress'],
        costs: ['Re-plan effort (~2 hours)', 'Second cycle slot consumed'],
        category: 'safe',
        vdtProjection: {
          valueImpacts: mockImpactsFor(55, 8),
          calendarWeeks: 2,
          capitalK: 8,
        },
        provenance: {
          source: 'gilb',
          gilbCitation: {
            book: 'EVO 2024',
            ref: 'ch.2 step 4 (Decompose)',
            quote: 'My Evo cycle has 9-nine steps.  Decompose is distinct from Prioritize.',
          },
        },
      },
      {
        id: 'better-2',
        rank: 2,
        title: 'Borrow from a parallel team',
        description:
          'Identify whether another team has solved this or an adjacent problem.  Borrow their solution, ' +
          'sharpen it for our context, ship a thin adapter.',
        rationale:
          'Reuse is the highest-leverage form of effort reduction.  A borrowed solution carries proven ' +
          'risk profile and proven cost.',
        estimatedImpactMultiplier: 2.0,
        risks: ['Adapter complexity if the borrowed solution does not fit', 'Cross-team coordination delays'],
        costs: ['1-2 days of sharpening + adapter work', 'Possible licence / IP review'],
        category: 'safe',
        vdtProjection: {
          valueImpacts: mockImpactsFor(65, 5),
          calendarWeeks: 1,
          capitalK: 5,
        },
        provenance: {
          source: 'plan',
          note: 'Derived from comparing this step\'s linkedSolutions against other plans in the Model Library (deterministic similarity check).',
        },
      },
      {
        id: 'better-3',
        rank: 3,
        title: 'Build the meter before the value',
        description:
          'Ship the measurement instrumentation FIRST in a thin cycle, then ship the value-delivery work ' +
          'in the next cycle with real baselines already captured.',
        rationale:
          'No instrument = no Measure step = no Learn step.  An instrumented step is a sharpened step.',
        estimatedImpactMultiplier: 1.3,
        risks: ['Stakeholders may question why a cycle "delivered no visible value"'],
        costs: ['One cycle slot spent on instrumentation only'],
        category: 'safe',
        vdtProjection: {
          valueImpacts: mockImpactsFor(45, 10),
          calendarWeeks: 1,
          capitalK: 3,
        },
        provenance: {
          source: 'gilb',
          gilbCitation: {
            book: 'PoSEM',
            ref: 'ch.15 (Measurement)',
            quote: 'You can only Learn from data you have Measured.',
          },
        },
      },
    ],
    skunkworksIdeas: [
      {
        id: 'skunk-1',
        rank: 1,
        title: 'Rebuild the underlying solution',
        description:
          'Instead of incrementally improving the current solution, swap it for a fundamentally different ' +
          'architecture chosen for 10x potential on the target V. entries.',
        rationale:
          'Incremental improvement of a wrong architecture caps you at the architecture\'s ceiling.  A new ' +
          'architecture has its own ceiling — if higher, the lift is permanent.',
        estimatedImpactMultiplier: 8.0,
        risks: [
          'Multi-cycle migration; first cycle may regress V.',
          'Team unfamiliarity with new architecture',
          'Stakeholder trust costs during transition',
          'Unknown unknowns in the new architecture',
        ],
        costs: [
          '3-6 cycles of migration effort',
          'Training / hiring for new tech',
          'Parallel maintenance of old + new during transition',
        ],
        category: 'skunkworks',
        vdtProjection: {
          valueImpacts: mockImpactsFor(140, 20),     // >100 signals "blows past Goal"
          calendarWeeks: 16,
          capitalK: 120,
        },
        constraintRelaxations: [
          {
            constraintRef: 'C.Budget (illustrative)',
            relaxation: 'Relax the per-step capital budget from $20k to $120k for the architecture rewrite cycle.',
            justification: 'The 8× projected value lift more than offsets the 6× capital increase; permanent ceiling lift.',
          },
          {
            constraintRef: 'C.Cycle-Length (illustrative)',
            relaxation: 'Allow a 4-cycle migration window where the standard is 1 cycle per step.',
            justification: 'Migration cannot be decomposed cleanly into single-cycle increments without regressing the V.',
          },
        ],
        provenance: {
          source: 'gilb',
          gilbCitation: {
            book: 'Competitive Engineering',
            ref: 'Architecture Engineering chapter',
            quote: 'Incremental improvement of a wrong architecture caps you at the architecture\'s ceiling.',
          },
        },
      },
      {
        id: 'skunk-2',
        rank: 2,
        title: 'Skip the human entirely',
        description:
          'Automate the entire step\'s value path so that delivery happens continuously without human ' +
          'intervention — e.g., generative pipeline that produces the V.-moving output on demand.',
        rationale:
          '10x potential because automation compounds — once shipped, each cycle thereafter is essentially ' +
          'free.  Caveat: only works when the V. quality is preserved under automation.',
        estimatedImpactMultiplier: 10.0,
        risks: [
          'Automated quality may regress the V. silently',
          'Compliance / accountability gap if no human signs off',
          'High up-front engineering cost may exceed budget',
        ],
        costs: [
          '4-8 cycles of pipeline engineering',
          'Ongoing monitoring + override infrastructure',
          'Possible regulatory review',
        ],
        category: 'skunkworks',
        vdtProjection: {
          valueImpacts: mockImpactsFor(180, 15),     // 10× signals far past Goal
          calendarWeeks: 24,
          capitalK: 200,
        },
        constraintRelaxations: [
          {
            constraintRef: 'C.Human-Approval-Required (illustrative)',
            relaxation: 'Drop the per-delivery human-approval gate; replace with anomaly-detection rollback.',
            justification: 'Human-approval is the cost driver that prevents continuous delivery; anomaly-detection covers 95% of failure modes with O(1) cost.',
          },
          {
            constraintRef: 'C.Quarterly-Compliance-Review (illustrative)',
            relaxation: 'Move compliance review from per-release to per-quarter, with sampling.',
            justification: 'Per-release review caps release frequency at the review cadence; sampling preserves the audit signal.',
          },
        ],
        provenance: {
          source: 'llm',
          note: 'General automation/continuous-delivery pattern from LLM training corpus. No specific Gilb citation — Tom\'s books predate the continuous-delivery wave.',
        },
      },
    ],
  }
}

/** localStorage key — keep stable, v2 migration must respect it. */
export function storageKey(planId: string, stepName: string): string {
  const safePlan = planId.trim() || 'default'
  const safeStep = stepName.trim() || 'default-step'
  return `evoStepImprovement:v1:${safePlan}:${safeStep}`
}
