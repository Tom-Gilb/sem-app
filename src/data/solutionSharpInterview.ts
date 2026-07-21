// UNIT_TYPE=Data
//
// solutionSharpInterview.ts — Solution Sharpening Interview catalogue.
//
// SOURCE: Tom Gilb 2026-06-08 verbatim:
//   "SOLUTION SHARPENING: REPLACE THE GENERIC SHARPENING CURRENTLY HERE.
//    Major purposes: Solution Spec with better teeth in them, new Solutions,
//    Replace with solutions using fewer critical resources. Solutions with
//    multiple effects. Getting rid of risks and negative side effects in
//    solutions. Detailing fluffy solution ideas into subsets of several well
//    defined sub-ideas. Finding Adaptive Solutions that can be tuned as we
//    get feedback, or reversed out if we regret them. Solutions that are more
//    architecture than local patching. Solutions that can be reused."
//
//   26 themes (Tom's verbatim list):
//   Architecture Level Thinking · Reusable Solutions · Simplification of
//   Solutions · Adaptable Solutions · Reversible Solutions · International
//   Solutions · Competitive Solutions · Innovative Solutions · Low Capital
//   Cost Solutions · Low Maintenance Cost Solutions · Outsourced Solutions ·
//   AI Solutions · In House Solutions · Security Solutions · Usability
//   Solutions · Reliability Solutions · Relax Constraints Solutions ·
//   Financially Interesting Solutions · Long-Term Thinking Solutions ·
//   Total Systems Thinking Solutions · Pivotable Solutions · Incremental
//   Solutions · Scale-Free Solutions · Top Level Policy and Objectives
//   Solutions · Critical Stakeholder Solutions · Risk Reduction Solutions.
//
// AUTHORITY: Grounded in Tom Gilb's Planguage + Evo methodology:
//   - Competitive Engineering (CE) ch.6 — Design Levels
//   - EVO 2024 book ch.2 — 9-step Evo cycle
//   - Stakeholder Engineering — stakeholder-driven solution selection
//   - RISK book — risk in design decisions
//   - Value Improvement — V/C ratio maximisation
//   - Simple book (Gilb 2024) — simplification as a design virtue
//
// OUTPUT TYPES:
//   'new-solution'      → creates a new S. entry in the spec
//   'improved-solution' → refines an existing S. entry
//   'new-value'         → creates a new V. entry (a requirement the solution
//                         must satisfy) which then drives a corresponding
//                         new or revised Solution
//
// USAGE: imported by SolutionSharpenPanel.vue. Data-driven — add/edit themes
// here; zero UI code changes needed. Twin-portable: pure data, no Vue coupling.

import type { SourceProvenance } from './aiSource'
import type { SuggestionJustification } from './sharpenJustification'

/** The output that a sharpening question produces when answered. */
export type SolutionSharpOutputType =
  | 'new-solution'
  | 'improved-solution'
  | 'new-value'

/** A single sharpening question within a Solution Sharpening theme. */
export interface SolutionSharpQuestion {
  /** Stable id — used as key + localStorage suffix. */
  id: string
  /** The pointed question the planner must answer. */
  text: string
  /** One-sentence rationale: WHY this question matters for Solutions. */
  rationale: string
  /** What kind of spec output the answer produces. */
  outputType: SolutionSharpOutputType
  /** Label describing the output — shown as a badge on the question card. */
  outputLabel: string
  /** 3 AI-suggested starter answers. Tick to approve; free-text to customise.
   *  Pattern per question: (a) concrete example, (b) Planguage/Evo lens,
   *  (c) counter-perspective or stretch goal. */
  suggestedAnswers: string[]
  /** Source provenance parallel to suggestedAnswers (Conjunction-of-Technologies). */
  suggestedAnswerProvenances: SourceProvenance[]
  /**
   * Solution Justification — Tom Gilb 2026-06-08.
   * Optional parallel array (same index as suggestedAnswers[]).
   * When absent for a given index, the panel falls back to:
   *   analysis      → q.rationale
   *   knowledgeBase → theme.gilbSource
   *   credibility   → DEFAULT_CREDIBILITY (7)
   * Analogous to IET Evidence + Source + ±Uncertainty in CE.
   */
  suggestedAnswerJustifications?: SuggestionJustification[]
}

/** A Solution Sharpening theme groups 2 focused questions. */
export interface SolutionSharpTheme {
  /** Stable id. */
  id: string
  /** Display title (Tom's verbatim theme name). */
  title: string
  /** One-line purpose shown in sidebar and as a sub-header. */
  purpose: string
  /** Gilb book/chapter citation for this theme. */
  gilbSource: string
  /** Tailwind background class for the theme's sidebar accent bar. */
  accent: string
  /** The 2 sharpening questions for this theme. */
  questions: SolutionSharpQuestion[]
}

// ── 26 Solution Sharpening Themes ─────────────────────────────────────────────

export const SOLUTION_SHARP_THEMES: SolutionSharpTheme[] = [

  // ── 1. Architecture Level Thinking ────────────────────────────────────────
  {
    id: 'architecture-level',
    title: 'Architecture Level Thinking',
    purpose: 'Is this a structural design decision or a local patch?',
    gilbSource: 'CE ch.6 — Design Levels; Competitive Engineering p.88',
    accent: 'bg-slate-700',
    questions: [
      {
        id: 'arch-1',
        text: 'Does this solution address a root-cause structural problem, or does it patch a symptom?',
        rationale: 'Architectural solutions multiply their value across the whole system; local patches accumulate technical debt (CE ch.6).',
        outputType: 'improved-solution',
        outputLabel: 'Improve Solution',
        suggestedAnswers: [
          'Redesign as a platform capability: move from a one-off fix to a reusable service layer',
          'Identify which architectural layer this belongs to (data / service / interface / policy) and specify it explicitly',
          'Add an Architectural Decision Record (ADR) field to the S. entry documenting why this level was chosen',
        ],
        suggestedAnswerProvenances: ['template', 'template', 'template'],
        suggestedAnswerJustifications: [
          {
            analysis: 'Applies when solutions are one-off fixes with no structural role — they solve a single case but do not serve the system as a whole, meaning the same problem recurs in a different form in a later Evo cycle.',
            knowledgeBase: 'CE ch.6 — Design Levels (Gilb) · Platform Thinking — Parker, Van Alstyne & Choudary 2016 · https://martinfowler.com/bliki/ApplicationBoundary.html',
            credibility: 8,
          },
          {
            analysis: 'Applies when the S. entry does not name a system layer — unspecified solutions accidentally couple layers across Evo cycles, making future refactors disproportionately expensive.',
            knowledgeBase: 'CE ch.6 — Design Levels (Gilb) · Clean Architecture — Robert C. Martin 2017 · https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html',
            credibility: 9,
          },
          {
            analysis: 'Applies when design rationale is undocumented — without a recorded decision, the same architectural choice gets relitigated in every subsequent Evo Step, consuming Resource for decisions already made.',
            knowledgeBase: 'Architecture Decision Records — Michael Nygard 2011 · https://adr.github.io/ · CE — traceability principle',
            credibility: 7,
          },
        ],
      },
      {
        id: 'arch-2',
        text: 'What architectural constraints must this solution respect — and which ones does it violate?',
        rationale: 'A solution that violates architectural constraints propagates coupling debt into future Evo Steps.',
        outputType: 'new-value',
        outputLabel: 'New Value Requirement',
        suggestedAnswers: [
          'Add V. entry: "Architectural coupling — no solution couples more than 2 system layers; Goal: 0 cross-layer violations"',
          'Add V. entry: "System cohesion — each solution module has exactly one reason to change (SRP); Goal: 100% modules compliant"',
          'Add V. entry: "Deployment independence — solution can be deployed without co-releasing 3+ other modules; Goal: 100% of releases"',
        ],
        suggestedAnswerProvenances: ['template', 'template', 'template'],
        suggestedAnswerJustifications: [
          {
            analysis: 'Applies when a solution introduces dependencies between non-adjacent system layers — typically visible when the solution requires simultaneous changes in multiple modules to ship.',
            knowledgeBase: 'CE ch.6 — coupling constraint (Gilb) · https://www.freecodecamp.org/news/an-introduction-to-software-architecture-patterns/ · DORA Accelerate metrics — deploy coupling',
            credibility: 9,
          },
          {
            analysis: 'Applies when a module handles multiple concerns — each extra concern increases the probability of unintended change propagation and makes the solution harder to test independently.',
            knowledgeBase: 'Single Responsibility Principle — Robert C. Martin (Clean Code 2008) · CE — design clarity rule · https://blog.cleancoder.com/uncle-bob/2014/05/08/SingleReponsibilityPrinciple.html',
            credibility: 8,
          },
          {
            analysis: 'Applies when deploying this solution forces co-release of unrelated modules — indicating hidden coupling that will grow more expensive to untangle with each Evo Step.',
            knowledgeBase: 'CE — independent deployment principle · Accelerate (Forsgren, Humble, Kim 2018) — deployment frequency & coupling · https://dora.dev/research/',
            credibility: 8,
          },
        ],
      },
    ],
  },

  // ── 2. Reusable Solutions ─────────────────────────────────────────────────
  {
    id: 'reusable',
    title: 'Reusable Solutions',
    purpose: 'Can this solution serve multiple contexts, projects, or stakeholders?',
    gilbSource: 'CE — Solution economy; PoSEM ch.15 reuse factor',
    accent: 'bg-teal-600',
    questions: [
      {
        id: 'reuse-1',
        text: 'In how many other contexts (projects, products, stakeholder groups) could this solution be applied without modification?',
        rationale: 'Reusable solutions amortise their Resource cost across multiple uses — directly improving V/C ratio.',
        outputType: 'improved-solution',
        outputLabel: 'Improve Solution',
        suggestedAnswers: [
          'Parameterise the solution: extract all context-specific values as configuration, leaving the core logic reusable',
          'Publish as an internal shared component or service with a versioned API contract',
          'Document the re-use pre-conditions explicitly in the S. entry presenceTest field',
        ],
        suggestedAnswerProvenances: ['template', 'template', 'template'],
        suggestedAnswerJustifications: [
          {
            analysis: 'Applies when the solution hard-codes context-specific values — any new context then requires a full rewrite rather than a configuration change, multiplying Resource cost for identical Value.',
            knowledgeBase: 'CE — Solution economy (Gilb) · Software Reuse: Architecture, Process and Organisation — Jacobson, Griss & Jonsson 1997 · https://www.sei.cmu.edu/our-work/software-reuse/',
            credibility: 9,
          },
          {
            analysis: 'Applies when multiple teams independently develop similar solutions — duplicating Resource cost for equivalent Value, while preventing cross-team learning.',
            knowledgeBase: 'CE ch.15 PoSEM — reuse factor · DRY principle — Hunt & Thomas, The Pragmatic Programmer 1999 · https://www.oreilly.com/library/view/the-pragmatic-programmer/9780135956977/',
            credibility: 8,
          },
          {
            analysis: 'Applies when reuse conditions are informal or implicit — undocumented pre-conditions lead to misapplication in unsuitable contexts, producing bugs that are expensive to diagnose.',
            knowledgeBase: 'Planguage Template_Write_Solution.md — presenceTest field · CE — precondition specification · Design by Contract — Bertrand Meyer 1992',
            credibility: 7,
          },
        ],
      },
      {
        id: 'reuse-2',
        text: 'What would need to change in this solution to make it reusable across 3+ contexts?',
        rationale: 'Identifying the barrier to reuse often reveals an unnecessary coupling in the current design.',
        outputType: 'new-solution',
        outputLabel: 'New Solution',
        suggestedAnswers: [
          'New S. entry: "Solution as a configurable template" — extract hard-coded values into a schema-driven configuration',
          'New S. entry: "Solution marketplace entry" — publish with usage documentation, test suite, and versioning so other teams can adopt',
          'New S. entry: "Solution abstraction layer" — introduce an interface/adapter so the core logic is isolated from its context',
        ],
        suggestedAnswerProvenances: ['template', 'template', 'template'],
        suggestedAnswerJustifications: [
          {
            analysis: 'Applies when context-specific values are scattered through the solution body — each new context requires manual surgery to find and replace all hard-coded assumptions.',
            knowledgeBase: 'Template Method Pattern — Gang of Four (Design Patterns 1994) · CE — Solution parameterisation · https://refactoring.guru/design-patterns/template-method',
            credibility: 8,
          },
          {
            analysis: 'Applies when the solution has no discoverability or adoption documentation — other teams cannot find and reuse it even when it already meets their need, so they build duplicates instead.',
            knowledgeBase: 'InnerSource — O\'Reilly 2016 · Platform Engineering patterns · https://platformengineering.org/ · CE — solution economy',
            credibility: 7,
          },
          {
            analysis: 'Applies when the solution is tightly bound to its first-use context via direct dependencies — extracting it for reuse requires an interface layer to break those bindings.',
            knowledgeBase: 'Dependency Inversion Principle — Robert C. Martin (SOLID) · CE ch.6 — abstraction levels · https://blog.cleancoder.com/uncle-bob/2016/01/04/ALittleArchitecture.html',
            credibility: 9,
          },
        ],
      },
    ],
  },

  // ── 3. Simplification of Solutions ───────────────────────────────────────
  {
    id: 'simplification',
    title: 'Simplification of Solutions',
    purpose: 'Is there a simpler design that achieves the same Value at lower cost?',
    gilbSource: 'Simple book (Gilb 2024) — simplicity as a design virtue; CE ch.9',
    accent: 'bg-cyan-600',
    questions: [
      {
        id: 'simple-1',
        text: 'What is the minimum viable design that still meets the Value Goals — what can be removed without losing Value?',
        rationale: 'Every element of a solution that is not delivering Value is consuming Resource for free (CE).',
        outputType: 'improved-solution',
        outputLabel: 'Improve Solution',
        suggestedAnswers: [
          'Strip the solution to its core function; list every removed element and confirm which Value it was supposed to serve',
          'Replace a multi-step workflow with a single decision rule that covers 80% of cases',
          'Eliminate any solution element whose removal does not change any measurable Value outcome',
        ],
        suggestedAnswerProvenances: ['template', 'template', 'template'],
        suggestedAnswerJustifications: [
          {
            analysis: 'Applies when the solution has features that were speculated to be needed but have no corresponding V. entry — they consume Resource without contributing to any measurable stakeholder Value.',
            knowledgeBase: 'Simple book (Gilb 2024) — simplicity as design virtue · YAGNI (You Aren\'t Gonna Need It) — Extreme Programming (Beck 1999) · CE ch.9 — Value density',
            credibility: 9,
          },
          {
            analysis: 'Applies when the solution models a complex workflow that could be replaced by a simpler heuristic — complex workflows increase training Resource cost and error rates without proportional Value gain.',
            knowledgeBase: 'Simple book (Gilb 2024) · Pareto 80/20 applied to solution coverage · CE — minimum complexity principle · https://www.gilb.com/simple',
            credibility: 7,
          },
          {
            analysis: 'Applies when the solution has legacy elements carried over from an earlier version that no longer correspond to any current V. entry — dead weight that consumes maintenance Resource.',
            knowledgeBase: 'CE ch.9 — dead weight elimination · Simple book (Gilb 2024) — zero-Value features · Refactoring — Martin Fowler 2018 · https://refactoring.com/',
            credibility: 9,
          },
        ],
      },
      {
        id: 'simple-2',
        text: 'Does the current solution complexity create learning or maintenance burden for stakeholders?',
        rationale: 'Complexity has a hidden Resource cost: training time, error rate, and cognitive load are all measurable Values.',
        outputType: 'new-value',
        outputLabel: 'New Value Requirement',
        suggestedAnswers: [
          'Add V. entry: "Solution simplicity — new team member productive without training; Tolerable: ≤4 hours; Goal: ≤1 hour"',
          'Add V. entry: "Maintenance burden — hours per month to keep solution operational; Tolerable: ≤8h; Goal: ≤2h"',
          'Add V. entry: "Solution cognitive load — number of concepts a user must understand to use it; Tolerable: ≤7; Goal: ≤3"',
        ],
        suggestedAnswerProvenances: ['template', 'template', 'template'],
        suggestedAnswerJustifications: [
          {
            analysis: 'Applies when the solution has no measurable onboarding target — without a Value entry, complexity is invisible until stakeholders spend unbudgeted training time that erodes the Resource plan.',
            knowledgeBase: 'Simple book (Gilb 2024) · Cognitive Load Theory — Sweller 1988 · CE — training Resource as a measurable V. entry · https://en.wikipedia.org/wiki/Cognitive_load',
            credibility: 8,
          },
          {
            analysis: 'Applies when maintenance cost is untracked — complex solutions typically show maintenance cost creep that consumes budget originally allocated to new Solution development.',
            knowledgeBase: 'CE — total cost of ownership as a V. metric · Software Engineering at Google — Winters, Manshreck & Wright 2020 · https://abseil.io/resources/swe-book',
            credibility: 9,
          },
          {
            analysis: 'Applies when the solution exposes more concepts to users than necessary — each additional concept a user must hold in working memory increases error rate and reduces effective use of the solution.',
            knowledgeBase: 'Cognitive Load Theory — Sweller 1988 · Simple book (Gilb 2024) · CE ch.9 — user mental model Resource cost · Miller\'s Law (7±2) · https://en.wikipedia.org/wiki/The_Magical_Number_Seven',
            credibility: 8,
          },
        ],
      },
    ],
  },

  // ── 4. Adaptable Solutions ────────────────────────────────────────────────
  {
    id: 'adaptable',
    title: 'Adaptable Solutions',
    purpose: 'Can parameters be tuned as feedback arrives without redesign?',
    gilbSource: 'EVO 2024 ch.2 — Learn step; Evo feedback cycle',
    accent: 'bg-emerald-600',
    questions: [
      {
        id: 'adapt-1',
        text: 'Which parameters of this solution are currently hard-coded that could instead be configurable and tuned from Measure/Learn data?',
        rationale: 'Evo Learn step (step 9) requires solutions to respond to measurement data — hard-coded solutions cannot adapt.',
        outputType: 'improved-solution',
        outputLabel: 'Improve Solution',
        suggestedAnswers: [
          'Extract threshold values, weights, and limits as externally configurable parameters with documented valid ranges',
          'Add a feedback loop: solution reads its own performance metric and adjusts a configurable parameter automatically',
          'Build a configuration UI that allows authorised stakeholders to tune parameters within safe bounds in production',
        ],
        suggestedAnswerProvenances: ['template', 'template', 'template'],
      },
      {
        id: 'adapt-2',
        text: 'How will this solution behave when the requirements that drove it change in the next Evo cycle?',
        rationale: 'A solution that requires redesign when requirements evolve has hidden Resource costs that compound over Evo cycles.',
        outputType: 'new-value',
        outputLabel: 'New Value Requirement',
        suggestedAnswers: [
          'Add V. entry: "Solution adaptability — re-configuration time when a V. entry Goal changes by ≤20%; Tolerable: ≤1 day; Goal: ≤1 hour"',
          'Add V. entry: "Requirement change absorption — % of anticipated requirement changes handled without code change; Goal: ≥60%"',
          'Add V. entry: "Parameter coverage — % of tunable decisions exposed as configuration rather than hard-code; Goal: ≥80%"',
        ],
        suggestedAnswerProvenances: ['template', 'template', 'template'],
      },
    ],
  },

  // ── 5. Reversible Solutions ───────────────────────────────────────────────
  {
    id: 'reversible',
    title: 'Reversible Solutions',
    purpose: 'Can this decision be undone quickly if it proves wrong?',
    gilbSource: 'EVO 2024 — Evo step rollback; RISK book — reversibility premium',
    accent: 'bg-amber-600',
    questions: [
      {
        id: 'reverse-1',
        text: 'What would it cost in time and resources to reverse this solution if stakeholder feedback showed it was wrong?',
        rationale: 'Irreversible solutions carry a hidden risk premium — they must be right first time, which raises speculative effort.',
        outputType: 'improved-solution',
        outputLabel: 'Improve Solution',
        suggestedAnswers: [
          'Design with a feature-flag: the solution is active when the flag is on, and the pre-solution state is restored when it is off',
          'Run the solution in shadow mode (parallel to the old approach) before committing — reversibility with zero delivery gap',
          'Define an explicit rollback plan in the S. entry: which state to restore, whose approval is needed, and how long rollback takes',
        ],
        suggestedAnswerProvenances: ['template', 'template', 'template'],
      },
      {
        id: 'reverse-2',
        text: 'Does this solution lock stakeholders into a dependency that would be costly to exit?',
        rationale: 'Lock-in is an asymmetric risk: easy to enter, expensive to exit. Evo cycles must stay free to Learn and Pivot.',
        outputType: 'new-value',
        outputLabel: 'New Value Requirement',
        suggestedAnswers: [
          'Add V. entry: "Exit cost — cost to replace this solution with an alternative; Tolerable: ≤3 months effort; Goal: ≤1 month"',
          'Add V. entry: "Vendor independence — solution uses open standards or interfaces with ≥2 alternative providers; Goal: 100%"',
          'Add V. entry: "Data portability — all data produced by this solution exportable in open format within; Goal: ≤24 hours"',
        ],
        suggestedAnswerProvenances: ['template', 'template', 'template'],
      },
    ],
  },

  // ── 6. International Solutions ────────────────────────────────────────────
  {
    id: 'international',
    title: 'International Solutions',
    purpose: 'Does this work across languages, cultures, regulations, and time zones?',
    gilbSource: 'CE — International Constraints; Stakeholder Engineering — global stakeholders',
    accent: 'bg-blue-600',
    questions: [
      {
        id: 'intl-1',
        text: 'Which elements of this solution are currently English-language or culturally specific — and what would localisation cost?',
        rationale: 'Internationalisation retrofitted after deployment costs 5–10× what it costs to design in from the start.',
        outputType: 'improved-solution',
        outputLabel: 'Improve Solution',
        suggestedAnswers: [
          'Extract all user-facing strings into a localisation resource file with locale keys from day one',
          'Replace date, currency, and number formatting with locale-aware library calls throughout the solution',
          'Add right-to-left layout support as a boolean parameter so Arabic/Hebrew markets are a configuration change, not a redesign',
        ],
        suggestedAnswerProvenances: ['template', 'template', 'template'],
      },
      {
        id: 'intl-2',
        text: 'Which regulations in your target markets (GDPR, HIPAA, local data-sovereignty laws) does this solution need to satisfy?',
        rationale: 'Regulatory Constraints are binary — non-compliance is a blocker, not a tradeoff.',
        outputType: 'new-value',
        outputLabel: 'New Value Requirement',
        suggestedAnswers: [
          'Add C. entry per regulation: "GDPR compliance — all personal data processed under explicit consent; Goal: 100% of data subjects"',
          'Add V. entry: "Regulatory audit readiness — time to produce compliance evidence on demand; Tolerable: ≤5 days; Goal: ≤1 day"',
          'Add V. entry: "Data residency — % of personal data stored in the jurisdiction of the data subject; Goal: 100%"',
        ],
        suggestedAnswerProvenances: ['template', 'template', 'template'],
      },
    ],
  },

  // ── 7. Competitive Solutions ──────────────────────────────────────────────
  {
    id: 'competitive',
    title: 'Competitive Solutions',
    purpose: 'Does this give a measurable competitive advantage — better than alternatives?',
    gilbSource: 'Competitive Engineering — V/C ratio vs competitor benchmark; CE ch.1',
    accent: 'bg-red-600',
    questions: [
      {
        id: 'compete-1',
        text: 'How does this solution compare to the best alternative available to stakeholders — and what makes it better?',
        rationale: 'A solution that is merely "adequate" loses to a competitor who delivers "better". Competitive Engineering demands explicit benchmarking.',
        outputType: 'improved-solution',
        outputLabel: 'Improve Solution',
        suggestedAnswers: [
          'Benchmark the solution against the 2 best competitive alternatives on the same Value Scale/Meter — document the advantage',
          'Identify the one dimension on which this solution is uniquely superior and make that the lead differentiator',
          'Add a "Why better than alternatives" justification block to the S. entry — forces concrete differentiation thinking',
        ],
        suggestedAnswerProvenances: ['template', 'template', 'template'],
      },
      {
        id: 'compete-2',
        text: 'What would a well-resourced competitor do differently to achieve the same Value Goals — and should we adopt that approach?',
        rationale: 'Competitive advantage is lost when incumbents copy better solutions. Design from the competitive frontier, not yesterday\'s practice.',
        outputType: 'new-solution',
        outputLabel: 'New Solution',
        suggestedAnswers: [
          'New S. entry: "Competitor-benchmarked approach" — adopt the proven best-in-class method from the top 3 competitors with explicit adaptation notes',
          'New S. entry: "Competitive leapfrog" — identify the next generation of the solution (not incremental) and design toward it',
          'New S. entry: "Open source competitive baseline" — use the leading open-source equivalent as the foundation, differentiating only where needed',
        ],
        suggestedAnswerProvenances: ['template', 'template', 'template'],
      },
    ],
  },

  // ── 8. Innovative Solutions ───────────────────────────────────────────────
  {
    id: 'innovative',
    title: 'Innovative Solutions',
    purpose: 'Is there a novel, non-obvious approach not yet tried in this domain?',
    gilbSource: 'CE — Design invention; Value Improvement — breakthrough Value delivery',
    accent: 'bg-violet-600',
    questions: [
      {
        id: 'innov-1',
        text: 'What is the most unconventional approach to this problem — and why has it not been tried before?',
        rationale: 'Innovation is constrained by assumption, not physics. Explicitly challenging assumptions surfaces solutions that competitors overlook.',
        outputType: 'new-solution',
        outputLabel: 'New Solution',
        suggestedAnswers: [
          'New S. entry: "Inverted solution" — instead of processing X to produce Y, provide Y directly and back-derive X on demand',
          'New S. entry: "Cross-domain transfer" — apply the best solution from an adjacent domain (manufacturing, biology, game design) to this problem',
          'New S. entry: "Constraint removal" — identify the one assumption that, if eliminated, would make the entire problem trivially solvable',
        ],
        suggestedAnswerProvenances: ['template', 'template', 'template'],
      },
      {
        id: 'innov-2',
        text: 'Which current constraints are self-imposed conventions rather than real physical or regulatory limits?',
        rationale: 'Many "constraints" are inherited convention. Distinguishing real from assumed constraints unlocks solution space.',
        outputType: 'improved-solution',
        outputLabel: 'Improve Solution',
        suggestedAnswers: [
          'List every assumption embedded in the current solution design and mark each as: physical limit / regulatory constraint / convention / solvable with technology',
          'Challenge the most load-bearing convention: what would the solution look like without that assumption?',
          'Run a "five whys" on each constraint — stop at the one that has no further "why", that is the real constraint; everything above it is convention',
        ],
        suggestedAnswerProvenances: ['template', 'template', 'template'],
      },
    ],
  },

  // ── 9. Low Capital Cost Solutions ────────────────────────────────────────
  {
    id: 'low-capital',
    title: 'Low Capital Cost Solutions',
    purpose: 'Can the same Value be achieved with less upfront Resource investment?',
    gilbSource: 'RISK book — capital risk; CE — Resource budget constraints',
    accent: 'bg-emerald-700',
    questions: [
      {
        id: 'capex-1',
        text: 'What is the minimum capital investment needed to validate this solution before committing the full budget?',
        rationale: 'Evo principle: deliver measurable Value in the smallest possible Evo Step — learn before spending.',
        outputType: 'improved-solution',
        outputLabel: 'Improve Solution',
        suggestedAnswers: [
          'Design a proof-of-concept version at ≤10% of full budget that tests the highest-risk assumption',
          'Replace capital-intensive build with a manual/wizard-of-oz version first — validate demand before automating',
          'Use existing licensed or open-source components to cut build cost; only build what has no adequate alternative',
        ],
        suggestedAnswerProvenances: ['template', 'template', 'template'],
      },
      {
        id: 'capex-2',
        text: 'Could this solution be funded as operating expenditure (OpEx) rather than capital expenditure (CapEx) — and would that be financially better?',
        rationale: 'OpEx solutions (SaaS, subscription, usage-based) avoid capital risk but require ongoing cash flow; the right model depends on scale.',
        outputType: 'new-value',
        outputLabel: 'New Value Requirement',
        suggestedAnswers: [
          'Add V. entry: "Capital efficiency — ROI breakeven point; Tolerable: ≤18 months; Goal: ≤6 months"',
          'Add V. entry: "Upfront capital required — total investment before first Value delivery; Tolerable: ≤[budget]; Goal: ≤[30% of budget]"',
          'Add V. entry: "Cash flow timing — months before solution generates positive ROI; Tolerable: ≤24; Goal: ≤12"',
        ],
        suggestedAnswerProvenances: ['template', 'template', 'template'],
      },
    ],
  },

  // ── 10. Low Maintenance Cost Solutions ───────────────────────────────────
  {
    id: 'low-maintenance',
    title: 'Low Maintenance Cost Solutions',
    purpose: 'What is the ongoing operational burden — and can it be radically reduced?',
    gilbSource: 'CE — total cost of ownership; RISK book — operational risk',
    accent: 'bg-green-700',
    questions: [
      {
        id: 'maint-1',
        text: 'What are the recurring maintenance tasks this solution requires — and which of them can be automated or eliminated?',
        rationale: 'Maintenance cost is often larger than build cost over a solution\'s lifetime. Automating maintenance directly improves V/C.',
        outputType: 'improved-solution',
        outputLabel: 'Improve Solution',
        suggestedAnswers: [
          'List every recurring maintenance task, estimate monthly hours, and build automation for the top 3 by effort',
          'Design the solution to be self-healing: automatic recovery from the 5 most common failure modes',
          'Use managed services (cloud-hosted, vendor-maintained) to transfer maintenance burden to specialists',
        ],
        suggestedAnswerProvenances: ['template', 'template', 'template'],
      },
      {
        id: 'maint-2',
        text: 'How long will this solution remain maintainable as dependencies age and team knowledge turns over?',
        rationale: 'Solutions with outdated dependencies or undocumented tacit knowledge become unmaintainable in 2–5 years.',
        outputType: 'new-value',
        outputLabel: 'New Value Requirement',
        suggestedAnswers: [
          'Add V. entry: "Operational self-sufficiency — hours per month for routine maintenance by a new team member; Tolerable: ≤16h; Goal: ≤4h"',
          'Add V. entry: "Dependency freshness — % of dependencies within 2 major versions of current release; Goal: ≥90%"',
          'Add V. entry: "Knowledge documentation — time for a new developer to understand and safely modify the solution; Tolerable: ≤1 week; Goal: ≤1 day"',
        ],
        suggestedAnswerProvenances: ['template', 'template', 'template'],
      },
    ],
  },

  // ── 11. Outsourced Solutions ──────────────────────────────────────────────
  {
    id: 'outsourced',
    title: 'Outsourced Solutions',
    purpose: 'Could an external party deliver this faster, cheaper, or better?',
    gilbSource: 'CE — Resource efficiency; make-vs-buy decision framework',
    accent: 'bg-sky-600',
    questions: [
      {
        id: 'outsource-1',
        text: 'Is this solution in your organisation\'s core competency — or does a specialist vendor do this better at lower cost?',
        rationale: 'Outsourcing non-core activities improves V/C by directing scarce internal Resource to highest-value problems.',
        outputType: 'improved-solution',
        outputLabel: 'Improve Solution',
        suggestedAnswers: [
          'Evaluate 3 specialist vendors on the same Value Scale/Meter as the in-house alternative — include switching cost in the comparison',
          'Hybrid: outsource the commodity layer, retain internal ownership of the differentiating business logic',
          'Use a managed service for infrastructure (cloud, database, auth) and reserve engineering Resource for Value-differentiating features',
        ],
        suggestedAnswerProvenances: ['template', 'template', 'template'],
      },
      {
        id: 'outsource-2',
        text: 'What contractual Value requirements would you specify to an outsource partner — and how would you measure their performance?',
        rationale: 'Outsourcing without quantified Planguage Value requirements transfers accountability without retaining control.',
        outputType: 'new-value',
        outputLabel: 'New Value Requirement',
        suggestedAnswers: [
          'Add V. entry: "Vendor delivery reliability — % of contracted deliverables on time and within spec; Tolerable: ≥90%; Goal: ≥99%"',
          'Add V. entry: "Vendor quality — defect rate in delivered work; Tolerable: ≤5 per 100 units; Goal: ≤1 per 100 units"',
          'Add V. entry: "Service continuity — uptime of outsourced service; Tolerable: ≥99%; Goal: ≥99.9%"',
        ],
        suggestedAnswerProvenances: ['template', 'template', 'template'],
      },
    ],
  },

  // ── 12. AI Solutions ─────────────────────────────────────────────────────
  {
    id: 'ai-solutions',
    title: 'AI Solutions',
    purpose: 'Can AI automate, augment, or dramatically accelerate this solution?',
    gilbSource: 'CE — Technology leverage; Value Improvement — order-of-magnitude improvements',
    accent: 'bg-indigo-600',
    questions: [
      {
        id: 'ai-1',
        text: 'Which parts of this solution involve pattern recognition, prediction, or content generation that an AI model could do better than a rule-based system?',
        rationale: 'AI delivers order-of-magnitude improvements on classification, generation, and prediction tasks vs hand-coded rules.',
        outputType: 'new-solution',
        outputLabel: 'New Solution',
        suggestedAnswers: [
          'New S. entry: "AI-augmented decision support" — replace manual decision rules with a trained model; human retains final authority',
          'New S. entry: "AI-generated draft with human review" — AI produces 80% of the output, human reviews and approves, reducing effort 5×',
          'New S. entry: "Retrieval-augmented AI layer" — AI answers questions grounded in the organisation\'s own documents, not general knowledge',
        ],
        suggestedAnswerProvenances: ['template', 'template', 'template'],
      },
      {
        id: 'ai-2',
        text: 'What measurable accuracy or performance level must the AI achieve to be trusted by stakeholders — and how will you verify it?',
        rationale: 'AI solutions without quantified accuracy requirements cannot be evaluated or improved in Evo Learn cycles.',
        outputType: 'new-value',
        outputLabel: 'New Value Requirement',
        suggestedAnswers: [
          'Add V. entry: "AI accuracy — correct outputs as % of all outputs; Tolerable: ≥90%; Goal: ≥99%; Meter: blind test on held-out dataset"',
          'Add V. entry: "AI explainability — % of AI decisions accompanied by a human-readable rationale; Goal: 100% of high-stakes decisions"',
          'Add V. entry: "AI bias — deviation in outcomes between demographic groups; Tolerable: ≤5%; Goal: ≤1%; Meter: quarterly audit"',
        ],
        suggestedAnswerProvenances: ['template', 'template', 'template'],
      },
    ],
  },

  // ── 13. In House Solutions ────────────────────────────────────────────────
  {
    id: 'in-house',
    title: 'In House Solutions',
    purpose: 'When should you build internally to retain strategic control?',
    gilbSource: 'CE — Core competency; Stakeholder Engineering — internal capability',
    accent: 'bg-orange-700',
    questions: [
      {
        id: 'inhouse-1',
        text: 'What is the strategic value of owning this capability internally vs buying it externally — and does that justify the Resource cost?',
        rationale: 'In-house solutions are only justified when: (a) they are a core differentiator, (b) no vendor meets requirements, or (c) data/IP sensitivity demands it.',
        outputType: 'improved-solution',
        outputLabel: 'Improve Solution',
        suggestedAnswers: [
          'Define the "build justification": which of the three strategic reasons (differentiator / no-vendor / IP-sensitive) applies — and quantify it',
          'Narrow in-house scope to the unique differentiating 20%; use commodity components for the remaining 80%',
          'Specify the internal platform as a product with external users — forces design discipline and creates a natural reuse pathway',
        ],
        suggestedAnswerProvenances: ['template', 'template', 'template'],
      },
      {
        id: 'inhouse-2',
        text: 'How will this solution be maintained, improved, and owned over a 5-year horizon as team composition changes?',
        rationale: 'In-house solutions require long-term resourcing plans — "build it and forget" creates the highest maintenance debt.',
        outputType: 'new-value',
        outputLabel: 'New Value Requirement',
        suggestedAnswers: [
          'Add V. entry: "Internal adoption — number of teams/products using this in-house solution; Tolerable: ≥3; Goal: ≥10 within 2 years"',
          'Add V. entry: "Bus factor — minimum team members who must be unavailable to make the solution undeliverable; Tolerable: ≥2; Goal: ≥5"',
          'Add V. entry: "Internal velocity — feature delivery pace by in-house team vs best external alternative; Goal: within 2× of external"',
        ],
        suggestedAnswerProvenances: ['template', 'template', 'template'],
      },
    ],
  },

  // ── 14. Security Solutions ────────────────────────────────────────────────
  {
    id: 'security',
    title: 'Security Solutions',
    purpose: 'Does this solution introduce risks — and can it be hardened?',
    gilbSource: 'RISK book — security risk; CE — Constraint on security',
    accent: 'bg-red-700',
    questions: [
      {
        id: 'sec-1',
        text: 'What are the top 3 attack vectors this solution introduces — and how is each mitigated by design?',
        rationale: 'Security must be designed in, not audited in. Mitigation retrofitted after delivery costs 100× more than designed-in mitigation.',
        outputType: 'improved-solution',
        outputLabel: 'Improve Solution',
        suggestedAnswers: [
          'Conduct a threat model (STRIDE) on the solution and embed the top 3 mitigations as explicit sub-components of the S. entry',
          'Apply the principle of least privilege: every access right, API call, and data field is limited to the minimum required by the use case',
          'Design for breach containment: assume compromise of one component — ensure lateral movement to other components is architecturally impossible',
        ],
        suggestedAnswerProvenances: ['template', 'template', 'template'],
      },
      {
        id: 'sec-2',
        text: 'What security compliance requirements (SOC2, ISO27001, OWASP Top 10) must this solution satisfy — and are they currently specified?',
        rationale: 'Security requirements that are not quantified cannot be verified and will be missed in delivery.',
        outputType: 'new-value',
        outputLabel: 'New Value Requirement',
        suggestedAnswers: [
          'Add C. entry: "OWASP Top 10 compliance — solution has zero OWASP Top 10 vulnerabilities; Goal: 0 in quarterly scan"',
          'Add V. entry: "Vulnerability remediation speed — critical CVE patched within; Tolerable: ≤72 hours; Goal: ≤24 hours"',
          'Add V. entry: "Penetration test score — findings from annual pen test; Tolerable: 0 critical, ≤3 high; Goal: 0 critical, 0 high"',
        ],
        suggestedAnswerProvenances: ['template', 'template', 'template'],
      },
    ],
  },

  // ── 15. Usability Solutions ───────────────────────────────────────────────
  {
    id: 'usability',
    title: 'Usability Solutions',
    purpose: 'Is this usable by the target stakeholders without training?',
    gilbSource: 'Stakeholder Engineering — user value; CE — Zero-Training UI principle',
    accent: 'bg-pink-600',
    questions: [
      {
        id: 'use-1',
        text: 'Can a first-time user achieve their goal within 5 minutes without reading any documentation?',
        rationale: 'Tom\'s Zero-Training UI principle: every interaction must be self-evident from context. Invisible affordances are Value destroyers.',
        outputType: 'improved-solution',
        outputLabel: 'Improve Solution',
        suggestedAnswers: [
          'Run a hallway test: 5 first-time users, observe where they get stuck, fix the top 3 friction points before next Evo cycle',
          'Embed progressive disclosure: show only what is needed at each step; advanced options revealed only when relevant',
          'Replace ambiguous icons and labels with explicit action language: "Save to clipboard" not "Copy"; "Delete permanently" not "Remove"',
        ],
        suggestedAnswerProvenances: ['template', 'template', 'template'],
      },
      {
        id: 'use-2',
        text: 'Which user groups (age, language, disability, technical literacy) are excluded by the current design?',
        rationale: 'Exclusion of a user group is a missing Value for that stakeholder — and often a legal Constraint.',
        outputType: 'new-value',
        outputLabel: 'New Value Requirement',
        suggestedAnswers: [
          'Add V. entry: "Task completion rate — % of target users who complete core task without assistance; Tolerable: ≥80%; Goal: ≥98%"',
          'Add V. entry: "Accessibility — WCAG 2.1 AA compliance; Tolerable: ≥90% of criteria; Goal: 100%"',
          'Add V. entry: "Time on task — median time to complete core workflow for first-time user; Tolerable: ≤10 min; Goal: ≤2 min"',
        ],
        suggestedAnswerProvenances: ['template', 'template', 'template'],
      },
    ],
  },

  // ── 16. Reliability Solutions ─────────────────────────────────────────────
  {
    id: 'reliability',
    title: 'Reliability Solutions',
    purpose: 'What happens when this solution fails — and is it fault-tolerant?',
    gilbSource: 'CE — reliability constraint; RISK book — failure modes',
    accent: 'bg-slate-600',
    questions: [
      {
        id: 'rel-1',
        text: 'What is the most likely failure mode of this solution — and what is the stakeholder impact when it occurs?',
        rationale: 'Mean Time To Recovery (MTTR) and Mean Time Between Failures (MTBF) are measurable Values that directly affect stakeholder trust.',
        outputType: 'improved-solution',
        outputLabel: 'Improve Solution',
        suggestedAnswers: [
          'Add graceful degradation: when the solution fails partially, it delivers reduced functionality rather than total failure',
          'Implement automatic retry with exponential backoff for transient failures; circuit breaker for systemic failures',
          'Design for failure in advance: chaos engineering approach — intentionally inject failures in staging to verify recovery behaviour',
        ],
        suggestedAnswerProvenances: ['template', 'template', 'template'],
      },
      {
        id: 'rel-2',
        text: 'What availability and recovery time does the highest-priority stakeholder actually require — is it explicitly specified?',
        rationale: 'Reliability requirements that are unspecified default to "as much as possible" — which is both unmeasurable and undeliverable.',
        outputType: 'new-value',
        outputLabel: 'New Value Requirement',
        suggestedAnswers: [
          'Add V. entry: "Availability — % uptime per month; Tolerable: ≥99%; Goal: ≥99.9%; Meter: monthly uptime monitoring report"',
          'Add V. entry: "Recovery time objective — time from failure detection to restored service; Tolerable: ≤4h; Goal: ≤15min"',
          'Add V. entry: "Data durability — % of committed transactions recoverable after failure; Tolerable: ≥99.9%; Goal: 100%"',
        ],
        suggestedAnswerProvenances: ['template', 'template', 'template'],
      },
    ],
  },

  // ── 17. Relax Constraints Solutions ──────────────────────────────────────
  {
    id: 'relax-constraints',
    title: 'Relax Constraints Solutions',
    purpose: 'Are constraints over-specified? Can phasing or renegotiation unlock better Solutions?',
    gilbSource: 'EVO 2024 — Evo-gate phasing; KISS Analysis — constraint relaxation',
    accent: 'bg-red-500',
    questions: [
      {
        id: 'relax-1',
        text: 'Which constraints are blocking the highest-value solutions — and are those constraints real limits or inherited conventions?',
        rationale: 'KISS analysis: phasing a constraint to a later Evo Step can release critical resources for earlier, higher-value delivery.',
        outputType: 'improved-solution',
        outputLabel: 'Improve Solution',
        suggestedAnswers: [
          'Identify the one constraint that, if relaxed for the first 2 Evo cycles only, would unlock the highest-ROI solutions — propose Evo-gate phasing',
          'Distinguish hard constraints (physical, regulatory, contractual) from soft constraints (process, preference, convention) — relax the soft ones',
          'Negotiate a constraint relaxation with the relevant stakeholder: trade a tighter Goal on a different Value in exchange',
        ],
        suggestedAnswerProvenances: ['template', 'template', 'template'],
      },
      {
        id: 'relax-2',
        text: 'If you removed the most restrictive constraint from the spec for 1 Evo cycle, what new solutions would become available?',
        rationale: 'Thought experiment: visualising solutions that would exist without a constraint reveals whether the constraint\'s cost is worth its Value.',
        outputType: 'new-solution',
        outputLabel: 'New Solution',
        suggestedAnswers: [
          'New S. entry: "Phased constraint compliance" — implement the solution now without the constraint; add constraint enforcement in Evo Step 3 when the system is mature',
          'New S. entry: "Constraint-relaxed pilot" — run the unconstrained solution for a limited stakeholder group with explicit monitoring; re-evaluate constraint after Measure',
          'New S. entry: "Constraint negotiation" — formalise a request to the constraint owner with Value evidence for why relaxation increases overall system performance',
        ],
        suggestedAnswerProvenances: ['template', 'template', 'template'],
      },
    ],
  },

  // ── 18. Financially Interesting Solutions ─────────────────────────────────
  {
    id: 'financially-interesting',
    title: 'Financially Interesting Solutions',
    purpose: 'Does this create significant revenue, cost reduction, or ROI worth noting?',
    gilbSource: 'CE — Resource budget; Value Improvement — financial Value',
    accent: 'bg-yellow-600',
    questions: [
      {
        id: 'fin-1',
        text: 'What is the total financial impact of this solution over 3 years — and how confident are you in that estimate?',
        rationale: 'Solutions without financial projections cannot be prioritised on V/C ratio against solutions that do have projections.',
        outputType: 'improved-solution',
        outputLabel: 'Improve Solution',
        suggestedAnswers: [
          'Add a 3-year NPV estimate to the S. entry with explicit assumptions documented — even a rough order of magnitude beats no estimate',
          'Identify the 3 key financial drivers of this solution (cost avoided, revenue generated, churn reduced) and quantify each separately',
          'Model two scenarios: conservative (10th percentile) and optimistic (90th percentile) — the range reveals decision risk',
        ],
        suggestedAnswerProvenances: ['template', 'template', 'template'],
      },
      {
        id: 'fin-2',
        text: 'Does this solution create a new revenue stream, or only improve an existing one — and which is more strategically valuable?',
        rationale: 'New revenue streams compound over time; cost reductions are one-time. Portfolio balance between the two is a strategic design decision.',
        outputType: 'new-value',
        outputLabel: 'New Value Requirement',
        suggestedAnswers: [
          'Add V. entry: "Revenue contribution — annual revenue attributable to this solution; Tolerable: ≥[break-even]; Goal: ≥[target ARR]"',
          'Add V. entry: "Cost avoidance — annual cost eliminated by this solution; Tolerable: ≥[implementation cost]; Goal: ≥3× implementation cost"',
          'Add V. entry: "Payback period — months to recover total implementation cost from financial returns; Tolerable: ≤24; Goal: ≤12"',
        ],
        suggestedAnswerProvenances: ['template', 'template', 'template'],
      },
    ],
  },

  // ── 19. Long-Term Thinking Solutions ─────────────────────────────────────
  {
    id: 'long-term',
    title: 'Long-Term Thinking Solutions',
    purpose: 'How does this solution look in 5–10 years? Is it still a good idea?',
    gilbSource: 'CE — long-range planning; EVO 2024 — strategic Evo direction',
    accent: 'bg-slate-500',
    questions: [
      {
        id: 'lt-1',
        text: 'In 5 years, will this solution still be solving the right problem — or will the problem have shifted?',
        rationale: 'Solutions optimised for current requirements often become liabilities as the problem evolves. Long-term validity must be designed in.',
        outputType: 'improved-solution',
        outputLabel: 'Improve Solution',
        suggestedAnswers: [
          'Write the "5-year press release": assume this solution has been running 5 years — what headlines does it generate? What problems does it no longer solve?',
          'Identify the 3 most likely ways the problem will evolve; design the solution so each evolution is an additive change, not a replacement',
          'Build in a formal review gate at 18 months: solution remains in use only if it still delivers ≥70% of its original Value Goals',
        ],
        suggestedAnswerProvenances: ['template', 'template', 'template'],
      },
      {
        id: 'lt-2',
        text: 'What technology, regulatory, or market trends in the next 5 years could make this solution obsolete — and is that risk mitigated?',
        rationale: 'Technology obsolescence is a Resource risk: investment in a solution that is deprecated externally wastes the full build cost.',
        outputType: 'new-value',
        outputLabel: 'New Value Requirement',
        suggestedAnswers: [
          'Add V. entry: "Solution longevity — projected years before solution requires major rearchitecting; Tolerable: ≥3 years; Goal: ≥7 years"',
          'Add V. entry: "Platform stability — dependency on a technology projected to remain actively maintained; Goal: 100% of core dependencies"',
          'Add V. entry: "Trend alignment — solution aligns with the dominant technology direction in its domain; Goal: confirmed by annual review"',
        ],
        suggestedAnswerProvenances: ['template', 'template', 'template'],
      },
    ],
  },

  // ── 20. Total Systems Thinking Solutions ──────────────────────────────────
  {
    id: 'systems-thinking',
    title: 'Total Systems Thinking Solutions',
    purpose: 'What are the second and third-order effects across the whole system?',
    gilbSource: 'CE — systemic design; Stakeholder Engineering — system-wide impact',
    accent: 'bg-purple-600',
    questions: [
      {
        id: 'sys-1',
        text: 'Which other parts of the system (components, processes, stakeholders) does this solution affect — and are any of those effects negative?',
        rationale: 'Every solution has side effects. Unmanaged negative side effects cost more to fix than positive effects are worth.',
        outputType: 'improved-solution',
        outputLabel: 'Improve Solution',
        suggestedAnswers: [
          'Map the solution\'s interaction surface: every component it calls, every data store it writes to, every stakeholder workflow it changes',
          'Identify the top 2 unintended consequences and redesign to eliminate them — or explicitly accept them with a Value tradeoff justification',
          'Add system-boundary documentation to the S. entry: what this solution touches, what it explicitly does not touch, and why',
        ],
        suggestedAnswerProvenances: ['template', 'template', 'template'],
      },
      {
        id: 'sys-2',
        text: 'If 10× as many stakeholders used this solution simultaneously, what would break — and is that a design problem?',
        rationale: 'Scale reveals hidden coupling and bottlenecks that are invisible at current load. Designing for 10× now costs a fraction of rescaling later.',
        outputType: 'new-value',
        outputLabel: 'New Value Requirement',
        suggestedAnswers: [
          'Add V. entry: "System throughput under load — performance at 10× current peak; Tolerable: within 20% of current performance; Goal: within 5%"',
          'Add V. entry: "Bottleneck freedom — number of single points of failure in the solution end-to-end; Tolerable: ≤2; Goal: 0"',
          'Add V. entry: "Cascading failure containment — failure of one component triggers outage in N others; Tolerable: ≤1; Goal: 0"',
        ],
        suggestedAnswerProvenances: ['template', 'template', 'template'],
      },
    ],
  },

  // ── 21. Pivotable Solutions ───────────────────────────────────────────────
  {
    id: 'pivotable',
    title: 'Pivotable Solutions',
    purpose: 'Can the direction be changed quickly if the market or requirements shift?',
    gilbSource: 'EVO 2024 — Evo Learn step; RISK book — strategic pivot cost',
    accent: 'bg-fuchsia-600',
    questions: [
      {
        id: 'pivot-1',
        text: 'If a major stakeholder changed their top Value priority tomorrow, how quickly could this solution be redirected?',
        rationale: 'Evo is a feedback learning cycle — solutions that cannot pivot from Measure/Learn signals lose the value of the entire Evo process.',
        outputType: 'improved-solution',
        outputLabel: 'Improve Solution',
        suggestedAnswers: [
          'Separate the Value-delivery mechanism (pivotable) from the infrastructure (stable): the mechanism can change; the infrastructure absorbs the change',
          'Modularise the solution so a change in priority requires replacing one module, not redesigning the whole',
          'Build pivotability in as a feature: define the 3 most likely pivot scenarios and verify the solution can execute each within 1 Evo Step',
        ],
        suggestedAnswerProvenances: ['template', 'template', 'template'],
      },
      {
        id: 'pivot-2',
        text: 'What is the minimum viable pivot — the smallest change to this solution that would redirect it to a different Value priority?',
        rationale: 'If the minimum viable pivot is a full redesign, the solution architecture is too rigid for Evo learning cycles.',
        outputType: 'new-value',
        outputLabel: 'New Value Requirement',
        suggestedAnswers: [
          'Add V. entry: "Pivot speed — time to redirect solution to a different top-priority Value; Tolerable: ≤1 Evo cycle; Goal: ≤1 sprint"',
          'Add V. entry: "Configuration vs code — % of solution behaviour controllable via configuration without code change; Goal: ≥50% of behaviour"',
          'Add V. entry: "Modular independence — % of solution modules replaceable without affecting other modules; Goal: ≥80%"',
        ],
        suggestedAnswerProvenances: ['template', 'template', 'template'],
      },
    ],
  },

  // ── 22. Incremental Solutions ─────────────────────────────────────────────
  {
    id: 'incremental',
    title: 'Incremental Solutions',
    purpose: 'Can this be delivered in smaller, verifiable Evo Steps that each deliver Value?',
    gilbSource: 'EVO 2024 ch.2 — Evo Step decomposition; PoSEM ch.15',
    accent: 'bg-lime-600',
    questions: [
      {
        id: 'incr-1',
        text: 'What is the smallest version of this solution that still delivers measurable Value to the highest-priority stakeholder?',
        rationale: 'Evo step 4 (Decompose) requires each step to deliver standalone Value. A solution that requires full delivery to deliver any Value is an Evo anti-pattern.',
        outputType: 'improved-solution',
        outputLabel: 'Improve Solution',
        suggestedAnswers: [
          'Define a Minimum Valuable Slice: 1 use case, 1 stakeholder, 1 Value metric — deliver that in Evo Step 1',
          'Decompose the solution into 3–5 independent vertical slices, each delivering measurable Value from day 1',
          'Apply the "walking skeleton" pattern: the thinnest possible implementation that connects all layers — then flesh out incrementally',
        ],
        suggestedAnswerProvenances: ['template', 'template', 'template'],
      },
      {
        id: 'incr-2',
        text: 'After each incremental delivery, what specific measurement will tell you whether to continue, modify, or stop?',
        rationale: 'Evo Measure (step 8) requires explicit measurement criteria per Evo Step — not just "it works", but "the Value Goal moved in the right direction".',
        outputType: 'new-value',
        outputLabel: 'New Value Requirement',
        suggestedAnswers: [
          'Add V. entry per deliverable increment with explicit Status/Tolerable/Goal — each increment has its own measurable threshold',
          'Add V. entry: "Increment value validation — % of increments that move their target Value metric in the correct direction; Goal: ≥80%"',
          'Add V. entry: "Increment delivery cadence — working increment in stakeholder hands every N days; Tolerable: ≤30 days; Goal: ≤14 days"',
        ],
        suggestedAnswerProvenances: ['template', 'template', 'template'],
      },
    ],
  },

  // ── 23. Scale-Free Solutions ──────────────────────────────────────────────
  {
    id: 'scale-free',
    title: 'Scale-Free Solutions',
    purpose: 'Does this work as well at 10× the load as at current scale?',
    gilbSource: 'CE — scalability; Architecture resilience rule',
    accent: 'bg-teal-700',
    questions: [
      {
        id: 'scale-1',
        text: 'What is the maximum load this solution can handle before performance degrades — and is that at least 3× your projected peak?',
        rationale: 'Solutions that fail at 2× expected load force emergency rearchitecting at the worst possible time.',
        outputType: 'improved-solution',
        outputLabel: 'Improve Solution',
        suggestedAnswers: [
          'Add horizontal scaling support: the solution adds capacity by adding instances, not by upgrading single nodes',
          'Eliminate all global state and shared mutability from the solution — stateless components scale linearly',
          'Introduce rate limiting and backpressure so the solution degrades gracefully under overload rather than failing catastrophically',
        ],
        suggestedAnswerProvenances: ['template', 'template', 'template'],
      },
      {
        id: 'scale-2',
        text: 'What performance Values must be maintained as usage scales — and are they currently specified with scale parameters?',
        rationale: 'Performance requirements without scale parameters ("response time ≤200ms") are underspecified — they must include load context.',
        outputType: 'new-value',
        outputLabel: 'New Value Requirement',
        suggestedAnswers: [
          'Add V. entry: "Response time at scale — p95 latency at 10× current peak load; Tolerable: ≤500ms; Goal: ≤200ms"',
          'Add V. entry: "Throughput ceiling — maximum requests per second before response time exceeds Tolerable; Goal: ≥[10× current peak]"',
          'Add V. entry: "Cost at scale — marginal infrastructure cost per additional 1000 users; Goal: ≤[linear with 20% overhead]"',
        ],
        suggestedAnswerProvenances: ['template', 'template', 'template'],
      },
    ],
  },

  // ── 24. Top Level Policy and Objectives Solutions ─────────────────────────
  {
    id: 'policy-objectives',
    title: 'Top Level Policy and Objectives Solutions',
    purpose: 'Does this align with strategic objectives — and can it be traced to them?',
    gilbSource: 'Stakeholder Engineering — policy stakeholders; CE — strategic alignment',
    accent: 'bg-stone-600',
    questions: [
      {
        id: 'policy-1',
        text: 'Which top-level organisational objective does this solution directly serve — and can you trace the connection quantitatively?',
        rationale: 'Solutions that cannot be traced to a top-level objective are burning Resources without strategic justification.',
        outputType: 'improved-solution',
        outputLabel: 'Improve Solution',
        suggestedAnswers: [
          'Add a traceability field to the S. entry: "Serves objective: [objective name] → via V. entry [V.id] → Goal [value]"',
          'If no clear objective connection exists, challenge whether this solution belongs in the spec at all',
          'Quantify the contribution: "If this solution achieves its Goal, the top-level objective moves from X% to Y%"',
        ],
        suggestedAnswerProvenances: ['template', 'template', 'template'],
      },
      {
        id: 'policy-2',
        text: 'Are there policy-level decisions (regulatory, governance, strategic direction) that are currently blocking or constraining this solution — and who owns those decisions?',
        rationale: 'Policy-blocked solutions need escalation paths, not technical redesign. Identifying the correct decision owner unlocks the solution.',
        outputType: 'new-value',
        outputLabel: 'New Value Requirement',
        suggestedAnswers: [
          'Add C. entry: "Strategic alignment — solution approved by policy owner [name]; Goal: signed off before Evo Step 2 begins"',
          'Add V. entry: "Policy compliance score — % of top-level policies this solution is consistent with; Goal: 100%"',
          'Add V. entry: "Decision escalation speed — time from solution proposal to policy-owner decision; Tolerable: ≤4 weeks; Goal: ≤1 week"',
        ],
        suggestedAnswerProvenances: ['template', 'template', 'template'],
      },
    ],
  },

  // ── 25. Critical Stakeholder Solutions ───────────────────────────────────
  {
    id: 'critical-stakeholder',
    title: 'Critical Stakeholder Solutions',
    purpose: 'Does this primarily serve the highest-priority stakeholders?',
    gilbSource: 'Stakeholder Engineering — priority stakeholders; CE — stakeholder Value mapping',
    accent: 'bg-indigo-700',
    questions: [
      {
        id: 'stake-1',
        text: 'Which stakeholder benefits most from this solution — and is that the stakeholder with the highest priority in your spec?',
        rationale: 'A solution that serves low-priority stakeholders at the expense of high-priority ones is inverted in the V/C calculation.',
        outputType: 'improved-solution',
        outputLabel: 'Improve Solution',
        suggestedAnswers: [
          'Map each solution to its primary beneficiary stakeholder and rank solutions by beneficiary priority — reorder accordingly',
          'If the solution serves a low-priority stakeholder, redesign to serve the highest-priority stakeholder first and treat low-priority benefit as a side effect',
          'Add an explicit stakeholder benefit statement to the S. entry: "Primary: [stakeholder name] — [specific Value delivered]"',
        ],
        suggestedAnswerProvenances: ['template', 'template', 'template'],
      },
      {
        id: 'stake-2',
        text: 'What does the most critical stakeholder say they actually need — and does this solution deliver it, or does it deliver what designers assumed they need?',
        rationale: 'Designer assumptions about stakeholder needs diverge from actual needs without direct stakeholder input — a classic source of wasted Resource.',
        outputType: 'new-value',
        outputLabel: 'New Value Requirement',
        suggestedAnswers: [
          'Add V. entry derived directly from a stakeholder interview: "Stakeholder-stated need — [exact quote]; Goal: solution delivers this outcome measurably"',
          'Add V. entry: "Stakeholder satisfaction with solution — rating by primary stakeholder on [1–10 scale]; Tolerable: ≥7; Goal: ≥9"',
          'Add V. entry: "Stakeholder adoption rate — % of target stakeholders using the solution within 30 days; Tolerable: ≥50%; Goal: ≥90%"',
        ],
        suggestedAnswerProvenances: ['template', 'template', 'template'],
      },
    ],
  },

  // ── 26. Risk Reduction Solutions ──────────────────────────────────────────
  {
    id: 'risk-reduction',
    title: 'Risk Reduction Solutions',
    purpose: 'What risks does this solution carry — and how are they eliminated or mitigated?',
    gilbSource: 'RISK book (Gilb 2024) — risk in design; CE — risk as negative Value',
    accent: 'bg-rose-700',
    questions: [
      {
        id: 'risk-1',
        text: 'What are the top 3 risks that could cause this solution to fail to deliver its Value Goals — and what is the mitigation for each?',
        rationale: 'Risk is negative expected Value. Every unmitigated risk directly reduces the V/C ratio of the solution.',
        outputType: 'improved-solution',
        outputLabel: 'Improve Solution',
        suggestedAnswers: [
          'Enumerate risks with probability × impact scoring; add a mitigation sub-component to the S. entry for the top 2 risks',
          'Apply Evo risk management: address the highest-risk assumption in Evo Step 1 (learn early, not late)',
          'Add a risk register field to the S. entry: "Risk: [description] · Probability: [H/M/L] · Impact: [H/M/L] · Mitigation: [action]"',
        ],
        suggestedAnswerProvenances: ['template', 'template', 'template'],
      },
      {
        id: 'risk-2',
        text: 'What negative side effects might this solution introduce — and are any of them worse than the problem it is solving?',
        rationale: 'A solution whose side-effects exceed its benefits has negative net Value — it should be redesigned or dropped.',
        outputType: 'new-value',
        outputLabel: 'New Value Requirement',
        suggestedAnswers: [
          'Add V. entry: "Negative side effect impact — measurable harm introduced by solution in [unit]; Tolerable: ≤[threshold]; Goal: 0"',
          'Add V. entry: "Risk-adjusted ROI — expected Value after probability-weighting all risks; Goal: ≥[unadjusted ROI × 0.7]"',
          'Add C. entry: "No net harm — solution must not degrade any existing V. entry that is currently meeting its Goal; Goal: 0 regressions"',
        ],
        suggestedAnswerProvenances: ['template', 'template', 'template'],
      },
    ],
  },

] // end SOLUTION_SHARP_THEMES

/** Lookup a theme by id. Returns undefined if not found. */
export function findSolutionSharpTheme(id: string): SolutionSharpTheme | undefined {
  return SOLUTION_SHARP_THEMES.find(t => t.id === id)
}

/** Total question count across all themes. */
export const SOLUTION_SHARP_TOTAL_QUESTIONS =
  SOLUTION_SHARP_THEMES.reduce((s, t) => s + t.questions.length, 0)

/** Total suggestion count across all themes. */
export const SOLUTION_SHARP_TOTAL_SUGGESTIONS =
  SOLUTION_SHARP_THEMES.reduce(
    (s, t) => s + t.questions.reduce((qs, q) => qs + q.suggestedAnswers.length, 0),
    0,
  )
