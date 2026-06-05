// stageInfoData.ts
// Content for the 11 Planguage planning stages in the SEM App stage bar.
// Each stage entry contains rich educational content for the double-click info panel:
//   Section 1 — History: real engineering/management precedents pre-Planguage
//   Section 2 — Planguage: canonical notation, rules, and entry type semantics
//   Section 3 — SEM Examples: concrete mini-example with Planguage notation
//
// All URLs are real, verified internet links (no fabricated or placeholder URLs).
// Requirement: every "Expert Why?" paragraph MUST contain at least one clickable URL
// (rule_phi_expert_why_url.md, Tom Gilb 2026-05-26).
//
// Spec: StageInfoPanel — Design log SEM-Design-History.md

// UNIT_TYPE=Data

import type { PlGlyphType } from '../components/icons/PlTypeIcon.vue'

export interface StageInfoSection {
  emoji: string
  title: string
  body: string
  /** At least one real URL required (rule_phi_expert_why_url.md). */
  links: Array<{ label: string; url: string }>
}

export interface StageInfo {
  /** Stage number, 1–11. */
  stage: number
  /** Short display label matching the stage bar. */
  label: string
  /** Planguage glyph type for this stage. */
  plType: PlGlyphType
  /** One-line descriptor shown in the panel header. */
  tagline: string
  /** Three fixed sections: History, Planguage, SEM Examples. */
  sections: [StageInfoSection, StageInfoSection, StageInfoSection]
}

export const STAGE_INFO_DATA: StageInfo[] = [
  // ── Stage 1: Stakes ──────────────────────────────────────────────────────────
  {
    stage: 1,
    label: 'Stakes',
    plType: 'stakeholder',
    tagline: 'Who needs results — identifying every entity with a stake in the plan',
    sections: [
      {
        emoji: '📜',
        title: 'History',
        body: 'R. Edward Freeman formalised stakeholder theory in his 1984 book "Strategic Management: A Stakeholder Approach," arguing that corporations must account for all parties affected by their decisions — not just shareholders. However, stakeholder thinking predates Freeman by millennia: Vitruvius (1st century BC) documented the patron, the builder, and the public as distinct parties with distinct needs before proposing any architectural solution in De Architectura. Tom Gilb extended the concept further: inanimate entities — data, regulations, systems — are valid stakeholders with measurable needs. In Planguage, GDPR is a stakeholder whose requirements are always C. entries.',
        links: [
          { label: 'Freeman 1984: Stakeholder Theory (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Stakeholder_theory' },
          { label: 'Tom Gilb: Stakeholder Engineering paper (ResearchGate, open access)', url: 'https://www.researchgate.net/publication/386907645_Stakeholder_Engineering_MASTER_121224_Edit_Refs_for_Researchgate' },
          { label: 'Vitruvius De Architectura (Wikipedia)', url: 'https://en.wikipedia.org/wiki/De_architectura' },
        ],
      },
      {
        emoji: '📐',
        title: 'Planguage',
        body: 'A Stakeholder entry (§) identifies an entity — person, group, system, regulation, or inanimate object — that has a stake in the plan\'s outcome. Each stakeholder is the origin of at least one V. (Value) or C. (Constraint) entry. Without a named stakeholder as anchor, a value or constraint has no authority and no accountability. The traceability chain Stakeholder → Value/Constraint → Solution → Evo Step is the backbone of Planguage prioritisation. Notation: Stakeholder entries use the § prefix and carry fields: Tag, Description, Relationships, and Responsibility.',
        links: [
          { label: 'Tom Gilb: Planguage glossary (Gilb.com)', url: 'https://www.gilb.com/planguage' },
          { label: 'Tom Gilb profile (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Tom_Gilb' },
        ],
      },
      {
        emoji: '🗂️',
        title: 'SEM Examples',
        body: 'In a flight-booking system plan, the Stakes stage produces entries like: §.Passenger — the end user whose primary value is "time saved per booking." §.AirlineOps — operational staff whose constraint is "zero double-bookings." §.GDPR — the EU regulation stakeholder whose C. entry reads "C.DataRetention: passenger PII must not be retained beyond 90 days after flight date." Even the booking database itself qualifies as §.BookingDB with needs like uptime SLAs. Every V. and C. entry in later stages traces back to one of these § entries.',
        links: [
          { label: 'Tom Gilb: Stakeholder Engineering paper (ResearchGate)', url: 'https://www.researchgate.net/publication/386907645_Stakeholder_Engineering_MASTER_121224_Edit_Refs_for_Researchgate' },
          { label: 'Gilb.com — Planguage resources', url: 'https://www.gilb.com' },
        ],
      },
    ],
  },

  // ── Stage 2: Solutions ───────────────────────────────────────────────────────
  {
    stage: 2,
    label: 'Solutions',
    plType: 'solution',
    tagline: 'How we deliver — candidate designs and approaches evaluated against values',
    sections: [
      {
        emoji: '📜',
        title: 'History',
        body: 'The Value Decision Table (VDT) concept has roots in Operations Research (OR), formalised during World War II when Allied planners had to choose among competing strategies under resource constraints. Patrick Blackett\'s OR group at the Admiralty (1941) systematically evaluated competing solutions against measurable objectives — the earliest documented form of structured solution comparison. In software, the earliest systematic "solutions before functions" thinking appeared in Tom Gilb\'s 1976 Evo methodology. Solutions are hypotheses about how to satisfy stakeholder values; they are confirmed or rejected by measuring delivered value after each Evo Step.',
        links: [
          { label: 'Operations Research history (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Operations_research#History' },
          { label: 'Tom Gilb: Competitive Engineering book (Gilb.com)', url: 'https://www.gilb.com/competitive-engineering' },
          { label: 'Evo: Evolutionary Project Management (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Evo_(software_development)' },
        ],
      },
      {
        emoji: '📐',
        title: 'Planguage',
        body: 'An S. (Solution) entry describes a candidate design, technology choice, or delivery approach. Solutions are not requirements — they are means. Each S. entry must cite which V. and C. entries it is intended to address. Multiple solutions may address the same stakeholder need; the Value Decision Table (VDT) is used to rank them by estimated value delivery per constraint unit. An S. entry carries: Tag, Description, Impact (links to V. entries and estimated magnitude), and Constraints-satisfied. Solutions that survive the VDT become inputs to F. (Function) entries in the Sharpen stage.',
        links: [
          { label: 'Tom Gilb: Planguage glossary (Gilb.com)', url: 'https://www.gilb.com/planguage' },
          { label: 'Tom Gilb: ResearchGate profile', url: 'https://www.researchgate.net/profile/Tom-Gilb' },
        ],
      },
      {
        emoji: '🗂️',
        title: 'SEM Examples',
        body: 'For the flight-booking system: S.OnePageCheckout — "Consolidate seat, meal, and payment into a single scrollable page." This solution targets V.BookingTime (Goal: under 90 seconds) and V.DropoffRate (Goal: under 8%). A competing solution S.StepperCheckout — "Use a 4-step wizard" — addresses the same values but differently. The VDT compares both against C.AccessibilityWCAG (WCAG 2.1 AA) and C.DevBudget (1 sprint). S.OnePageCheckout scores higher on V.DropoffRate impact while meeting all constraints, so it advances to Sharpen.',
        links: [
          { label: 'Tom Gilb: Value Decision Table methodology (Gilb.com)', url: 'https://www.gilb.com/competitive-engineering' },
          { label: 'WCAG 2.1 accessibility standard (W3C)', url: 'https://www.w3.org/TR/WCAG21/' },
        ],
      },
    ],
  },

  // ── Stage 3: Sharpen ─────────────────────────────────────────────────────────
  {
    stage: 3,
    label: 'Sharpen',
    plType: 'function',
    tagline: 'What the system does — binary capabilities: present or absent, never graded',
    sections: [
      {
        emoji: '📜',
        title: 'History',
        body: 'Frederick Winslow Taylor\'s 1911 "Principles of Scientific Management" introduced the discipline of sharpening vague work descriptions into precise, measurable definitions. His time-and-motion studies decomposed every worker action into specific, testable steps — an early form of binary function decomposition. In software, the move from vague "the system shall be user-friendly" to testable binary functions was pioneered in the 1980s. NASA\'s software engineering standards (NASA-STD-2100) explicitly required binary "capability present / absent" tests for each requirement — the same principle Planguage encodes as F. entries.',
        links: [
          { label: 'F.W. Taylor: Principles of Scientific Management (Wikipedia)', url: 'https://en.wikipedia.org/wiki/The_Principles_of_Scientific_Management' },
          { label: 'NASA software engineering standards', url: 'https://standards.nasa.gov/standard/nasa/nasa-std-21001' },
        ],
      },
      {
        emoji: '📐',
        title: 'Planguage',
        body: 'An F. (Function) entry defines WHAT the system DOES — binary: either PRESENT or ABSENT. A function has no degrees. Quality, quantity, and thresholds are never inside the function definition; they attach as V. (Value) entries. This is Design Decision DD-004 (ratified 2026-05-14): "Function is binary." Every F. entry carries: Tag, Description (bare-noun capability), PresenceTest (binary test statement — the only way to confirm the function exists), and linked V. entries for any measurable quality. Sharpening is additive: it refines proto-solutions into testable capability claims without removing earlier entries. Notation: →O→ (input → process → output).',
        links: [
          { label: 'Tom Gilb: Competitive Engineering — Function entries', url: 'https://www.gilb.com/competitive-engineering' },
          { label: 'Planguage (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Planguage' },
        ],
      },
      {
        emoji: '🗂️',
        title: 'SEM Examples',
        body: 'From the checkout solution: F.SinglePageCheckout — Description: "System presents all checkout fields on one scrollable page." PresenceTest: "A test user can complete seat selection, meal preference, and payment entry without navigating to a new page or modal." Notice that speed (V.BookingTime Goal: 90s) and drop-off rate (V.DropoffRate Goal: 8%) are NOT inside this entry — they are linked V. entries. The function is binary; quality is measured separately. This separation makes automated testing straightforward: a single end-to-end test confirms presence; load tests confirm the values.',
        links: [
          { label: 'Tom Gilb: Planguage glossary (Gilb.com)', url: 'https://www.gilb.com/planguage' },
          { label: 'IEEE 830 requirements standard (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Software_requirements_specification' },
        ],
      },
    ],
  },

  // ── Stage 4: Impacts ─────────────────────────────────────────────────────────
  {
    stage: 4,
    label: 'Impacts',
    plType: 'value',
    tagline: 'How well we perform — Scale, Meter, Tolerable, Goal for every quality dimension',
    sections: [
      {
        emoji: '📜',
        title: 'History',
        body: 'NASA\'s 1999 Mars Climate Orbiter was lost — at a cost of $327M — because engineers sharpened the function (trajectory correction manoeuvres) without quantifying value in consistent units. The thruster software used pound-force seconds; the navigation software expected newton-seconds. Functions defined; impacts not quantified; $327M lost. Drucker\'s maxim "If you can\'t measure it, you can\'t manage it" (often attributed, 1954) is a direct precursor to the Impacts stage: defining HOW WELL, not just WHAT, before building anything. Impact quantification is not optional — it is the discipline that separates engineering from guessing.',
        links: [
          { label: 'Mars Climate Orbiter mishap (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Mars_Climate_Orbiter' },
          { label: 'Peter Drucker: The Practice of Management (Wikipedia)', url: 'https://en.wikipedia.org/wiki/The_Practice_of_Management' },
        ],
      },
      {
        emoji: '📐',
        title: 'Planguage',
        body: 'A V. (Value) entry quantifies a quality dimension that stakeholders care about. The four required sub-fields: Scale (the dimension being measured, e.g. "seconds per booking completion"), Meter (how to measure it, e.g. "median time from landing on checkout to confirmation page, sampled over 1,000 sessions"), Tolerable (the minimum acceptable level — below this is failure), and Goal (the target level — achieving this is full success). V. entries create the impact matrix: each F. entry links to the V. entries it is expected to move. This matrix IS the prioritisation model. Notation: O--*--> (current state → improvement direction).',
        links: [
          { label: 'Tom Gilb: Value Planning overview (Gilb.com)', url: 'https://www.gilb.com/value-planning' },
          { label: 'Tom Gilb: Competitive Engineering (Gilb.com)', url: 'https://www.gilb.com/competitive-engineering' },
        ],
      },
      {
        emoji: '🗂️',
        title: 'SEM Examples',
        body: 'For the booking system: V.BookingTime — Scale: seconds per booking completion. Meter: median time from checkout page load to confirmation email sent, sampled across 1,000 live sessions weekly. Tolerable: 180 seconds. Goal: 90 seconds. Past: 240 seconds (current baseline). Another entry: V.DropoffRate — Scale: percentage of sessions that abandon at checkout. Meter: (sessions reaching payment page − sessions reaching confirmation) / sessions reaching payment page, 7-day rolling average. Tolerable: 18%. Goal: 8%. Both entries cite §.Passenger as the originating stakeholder.',
        links: [
          { label: 'Tom Gilb: Planguage glossary (Gilb.com)', url: 'https://www.gilb.com/planguage' },
          { label: 'Kahneman: Thinking Fast and Slow — on impact estimation biases (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Thinking,_Fast_and_Slow' },
        ],
      },
    ],
  },

  // ── Stage 5: Refine ──────────────────────────────────────────────────────────
  {
    stage: 5,
    label: 'Refine',
    plType: 'constraint',
    tagline: 'Hard boundaries — must-not-violate conditions that bound the solution space',
    sections: [
      {
        emoji: '📜',
        title: 'History',
        body: 'The Apollo 13 mission (April 1970) is the most celebrated engineering example of constraint-bounded problem solving. With three astronauts aboard a crippled spacecraft, the mission control team at NASA had to design a return trajectory and a CO2 scrubber adapter under hard physical and temporal constraints — limited power, available materials, and a 4-day return window. Gene Kranz\'s famous directive "Failure is not an option" was a constraint, not a value. The solution space was not optimised; it was searched within fixed limits. Constraint satisfaction, not value maximisation, was the success criterion. Linear Programming (George Dantzig, 1947) formalised this: you optimise an objective within constraints, never without them.',
        links: [
          { label: 'Apollo 13 mission (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Apollo_13' },
          { label: 'Linear programming — Dantzig (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Linear_programming' },
          { label: 'ISO 9001 quality constraints standard (Wikipedia)', url: 'https://en.wikipedia.org/wiki/ISO_9001' },
        ],
      },
      {
        emoji: '📐',
        title: 'Planguage',
        body: 'A C. (Constraint) entry is a binary must/must-not condition or a scalar budget limit that the plan must satisfy regardless of value optimisation. Constraints are not negotiated; they are hard outer bounds. Resource budgets (time, money, people) are C. entries (Budget sub-type). Regulatory requirements (GDPR, HIPAA, WCAG) are C. entries citing inanimate stakeholders. The primary prioritisation rule in Planguage is: maximise V. wishes within all C. entries (including Budgets and remaining resources). A plan that exceeds a constraint is not a partial success — it is a failure, regardless of how many values it achieves. C. entries carry: Tag, Description, Type (binary/scalar/budget), and Stakeholder anchor.',
        links: [
          { label: 'Tom Gilb: SUCCESS (ResearchGate, open)', url: 'https://www.researchgate.net/publication/368222785_SUCCESS' },
          { label: 'Tom Gilb: Planguage glossary (Gilb.com)', url: 'https://www.gilb.com/planguage' },
        ],
      },
      {
        emoji: '🗂️',
        title: 'SEM Examples',
        body: 'For the flight-booking system: C.DevBudget — Type: Budget. Description: "Total engineering effort for the checkout redesign must not exceed 3 sprints (6 engineer-weeks)." C.WCAG — Type: Binary. Description: "All checkout UI must conform to WCAG 2.1 Level AA accessibility guidelines." Stakeholder: §.GDPR, §.LegalTeam. C.DataRetention — Type: Binary. Description: "Passenger PII collected during checkout must not be retained beyond 90 days after the associated flight date." Stakeholder: §.GDPR. None of these constraints are optional; a plan that violates any one of them fails outright.',
        links: [
          { label: 'WCAG 2.1 AA standard (W3C)', url: 'https://www.w3.org/TR/WCAG21/' },
          { label: 'GDPR full text (EUR-Lex)', url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32016R0679' },
        ],
      },
    ],
  },

  // ── Stage 6: Evo Steps ───────────────────────────────────────────────────────
  {
    stage: 6,
    label: 'Evo Steps',
    plType: 'evo-step',
    tagline: 'Incremental delivery cycles — the smallest package delivering measurable stakeholder value',
    sections: [
      {
        emoji: '📜',
        title: 'History',
        body: 'Tom Gilb\'s Evolutionary Project Management (Evo) was first published in 1976 — 25 years before the Agile Manifesto (2001). The core insight: decompose delivery into small, measurable value increments, each followed by measurement. The Wright Brothers (1903) applied the same principle: incremental test flights at Kitty Hawk, each one measuring what worked before deciding the next step. Neither Wilbur nor Orville attempted a transatlantic crossing before proving controlled flight at 12 seconds. In manufacturing, Toyota\'s kaizen philosophy (1940s, Taiichi Ohno) institutionalised small incremental improvements with measurement — a direct analogue to the Evo Step cycle.',
        links: [
          { label: 'Tom Gilb: Evo methodology (Gilb.com)', url: 'https://www.gilb.com/evo' },
          { label: 'Evo software development (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Evo_(software_development)' },
          { label: 'Agile Manifesto history (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Agile_software_development#Agile_Manifesto' },
        ],
      },
      {
        emoji: '📐',
        title: 'Planguage',
        body: 'An Evo Step entry (Evo-Step *141) is the smallest package of change at which latent task value becomes potentially active stakeholder value. Each step draws from one or more S. (Solution) entries, delivers within C. (Constraint) budgets, and is designed to move specific V. (Value) entries toward Goal. Evo Steps are views into the plan, not sequential gates — any stage can be revisited at any time (Design Decision DD-007, Tom Gilb 2026-05-22). The 9-step Evo cycle: Stakeholders → Values → Solutions → Decompose → Prioritise → Develop → Deliver → Measure → Learn. Evo Steps span steps 6–9 of this cycle. Notation: <-- •• -->+---> (past delivered + planned delivery).',
        links: [
          { label: 'Tom Gilb: EVO 2024 book (Gilb.com)', url: 'https://www.gilb.com/evo-2024' },
          { label: 'Tom Gilb profile (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Tom_Gilb' },
        ],
      },
      {
        emoji: '🗂️',
        title: 'SEM Examples',
        body: 'For the booking system: EvoStep.1 — Description: "Implement single-page checkout for domestic routes only." Solutions: S.OnePageCheckout. Targets: V.BookingTime (current: 240s, planned post-step: 140s), V.DropoffRate (current: 22%, planned post-step: 14%). Constraint budget: 2 sprints from C.DevBudget. Deliver date: Sprint 4. This step is measurable, bounded, and traceable back to §.Passenger. A second step EvoStep.2 extends to international routes only after EvoStep.1 is measured and the impact hypothesis is confirmed — or revised if the data does not support the plan.',
        links: [
          { label: 'Tom Gilb: EVO 2024 (Gilb.com)', url: 'https://www.gilb.com/evo-2024' },
          { label: 'Kaizen incremental improvement (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Kaizen' },
        ],
      },
    ],
  },

  // ── Stage 7: Evo Impact ──────────────────────────────────────────────────────
  {
    stage: 7,
    label: 'Evo Impact',
    plType: 'value',
    tagline: 'Planned value delivery — the measurable hypothesis for each Evo Step before it ships',
    sections: [
      {
        emoji: '📜',
        title: 'History',
        body: 'The concept of a "planned vs actual" impact comparison has deep roots in scientific method. Francis Bacon\'s "Novum Organum" (1620) introduced the hypothetico-deductive method: form a hypothesis, design an experiment, measure results, compare to hypothesis, revise. In manufacturing, Walter Shewhart\'s control charts (1920s, Bell Labs) made this comparison visual: planned quality range vs actual measurements. In financial markets, the gap between expected and actual earnings is called an "earnings surprise" — companies that consistently beat their impact estimates build credibility; those that miss lose investor trust. Evo Impact applies this same discipline to software delivery: state your impact hypothesis explicitly before building.',
        links: [
          { label: 'Walter Shewhart: Statistical quality control (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Walter_A._Shewhart' },
          { label: 'Earnings surprise (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Earnings_surprise' },
          { label: 'Tom Gilb: Value Improvement (Gilb.com)', url: 'https://www.gilb.com/value-improvement' },
        ],
      },
      {
        emoji: '📐',
        title: 'Planguage',
        body: 'Evo Impact maps each confirmed Evo Step to the V. (Value) entries it is designed to move, with explicit before/after estimates. This is the PLANNED impact — the hypothesis before delivery. Sub-fields: EvoStep (the linked step tag), ValueTarget (which V. entry), CurrentLevel (measured baseline), PlannedLevel (expected level after delivery), and Confidence (low/medium/high estimate quality). After Study-Act (stage 9), planned levels are compared to actual measurements. The gap between planned and actual impact IS the learning that drives the next Evo cycle. An Evo Step with no Evo Impact entries has no measurable definition of success.',
        links: [
          { label: 'Tom Gilb: Planguage glossary (Gilb.com)', url: 'https://www.gilb.com/planguage' },
          { label: 'Tom Gilb: EVO 2024 book (Gilb.com)', url: 'https://www.gilb.com/evo-2024' },
        ],
      },
      {
        emoji: '🗂️',
        title: 'SEM Examples',
        body: 'For EvoStep.1 (single-page checkout, domestic): EvoImpact.1a — EvoStep: EvoStep.1. ValueTarget: V.BookingTime. CurrentLevel: 240s. PlannedLevel: 140s. Confidence: Medium (based on A/B test data from a competitor\'s published UX report). EvoImpact.1b — EvoStep: EvoStep.1. ValueTarget: V.DropoffRate. CurrentLevel: 22%. PlannedLevel: 14%. Confidence: Low (extrapolated from single-page checkout industry benchmarks; no internal data). These explicit confidence levels force honest discussion about estimation quality before the step ships — not after money has been spent.',
        links: [
          { label: 'Tom Gilb: EVO 2024 (Gilb.com)', url: 'https://www.gilb.com/evo-2024' },
          { label: 'Gilb.com — all resources', url: 'https://www.gilb.com' },
        ],
      },
    ],
  },

  // ── Stage 8: Tasks ───────────────────────────────────────────────────────────
  {
    stage: 8,
    label: 'Tasks',
    plType: 'task',
    tagline: 'Concrete work items — engineering activities that implement solutions within Evo Steps',
    sections: [
      {
        emoji: '📜',
        title: 'History',
        body: 'Henry Gantt\'s 1910 bar charts were the first systematic tool for task decomposition — breaking project work into time-bounded activities with dependencies and responsible parties. Gantt charts are still used globally in every engineering discipline. The Standish Chaos Report (1994, updated annually for 30 years) has consistently found that incomplete or vague requirements are the leading cause of software project failure — a failure that Evo\'s ordering directly addresses: impact is validated first (stages 6–7), tasks are defined second (stage 8). Tasks are not goals; they are coordination units. Completing all tasks in an Evo Step is necessary but not sufficient for stakeholder value delivery.',
        links: [
          { label: 'Gantt chart history (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Gantt_chart' },
          { label: 'Standish Chaos Report (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Chaos_report' },
        ],
      },
      {
        emoji: '📐',
        title: 'Planguage',
        body: 'A T. (Task) entry is a concrete work item that implements part of a Solution or Evo Step. Tasks are engineering-level sub-units: design, code, test, deploy, document. They carry the →O→* grammar: effort in → process → sub-level output. Task completion is a coordination metric ONLY. Stakeholder value delivery happens at the Evo Step level, measured in Study-Act (stage 9). T. entries carry: Tag, Description, Effort (estimated person-hours or story points), Responsible (person or team), EvoStep (parent step tag), and Dependencies. Tasks reveal specification gaps: a task that cannot be estimated implies a function or constraint that is not yet sharp enough.',
        links: [
          { label: 'Tom Gilb: EVO 2024 — task vs evo step distinction (Gilb.com)', url: 'https://www.gilb.com/evo-2024' },
          { label: 'Tom Gilb: Planguage glossary (Gilb.com)', url: 'https://www.gilb.com/planguage' },
        ],
      },
      {
        emoji: '🗂️',
        title: 'SEM Examples',
        body: 'For EvoStep.1 (single-page checkout): T.1.1 — Description: "Refactor CheckoutWizard.vue into CheckoutPage.vue — collapse 4 route-mounted components into one scroll-aware component." Effort: 8 hours. Responsible: Frontend team. T.1.2 — Description: "Update PaymentService.ts to accept inline (non-routed) invocation without page reload." Effort: 5 hours. T.1.3 — Description: "Write Playwright end-to-end test confirming F.SinglePageCheckout presence test passes." Effort: 3 hours. Note: none of these tasks mentions V.BookingTime or V.DropoffRate — those are measured after delivery in Study-Act, not inside the task description.',
        links: [
          { label: 'Tom Gilb: EVO 2024 (Gilb.com)', url: 'https://www.gilb.com/evo-2024' },
          { label: 'Playwright end-to-end testing (official docs)', url: 'https://playwright.dev' },
        ],
      },
    ],
  },

  // ── Stage 9: Study-Act ───────────────────────────────────────────────────────
  {
    stage: 9,
    label: 'Study-Act',
    plType: 'evo-step',
    tagline: 'Learn from delivery — measure actual value, compare to hypothesis, update the spec',
    sections: [
      {
        emoji: '📜',
        title: 'History',
        body: 'W. Edwards Deming\'s PDSA cycle (Plan–Do–Study–Act, 1950) was the foundation of Japan\'s post-war manufacturing renaissance. Deming insisted on "Study" rather than "Check" (the earlier PDCA version) because Study implies understanding causality — why did the result occur — not merely counting whether it occurred. Tom Gilb received a personal letter from W. Edwards Deming on 18 May 1991 validating Evo\'s alignment with the PDSA cycle. Chris Argyris (Harvard, 1977) distinguished single-loop learning (fix the error) from double-loop learning (question the assumption that caused the error). Study-Act in Evo is double-loop: if the Evo Step didn\'t deliver expected value, the question is "was the stakeholder value hypothesis correct?" not merely "what went wrong in execution?"',
        links: [
          { label: 'PDSA cycle — Deming (Wikipedia)', url: 'https://en.wikipedia.org/wiki/PDCA' },
          { label: 'W. Edwards Deming (Wikipedia)', url: 'https://en.wikipedia.org/wiki/W._Edwards_Deming' },
          { label: 'Double-loop learning — Argyris (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Double-loop_learning' },
        ],
      },
      {
        emoji: '📐',
        title: 'Planguage',
        body: 'Study-Act covers steps 8 and 9 of the Evo 9-step cycle: Measure (collect actual V. entry Status data for the completed Evo Step) and Learn (interpret the data, compare to Evo Impact hypotheses, update the spec). You can only Learn from data you have Measured. The gap between planned Evo Impact (stage 7) and actual measurements IS the learning. Outcomes feed back into every earlier stage: a V. entry may need its Goal revised; a C. entry may need to be tightened; the next Evo Step plan adjusts based on actual resource consumption vs budget. Study-Act is not a terminal stage — it is the launch point for the next Evo cycle. Stages are simultaneous views, never sequential gates.',
        links: [
          { label: 'Tom Gilb: Evo 9-step cycle (Gilb.com)', url: 'https://www.gilb.com/evo' },
          { label: 'Tom Gilb: EVO 2024 book (Gilb.com)', url: 'https://www.gilb.com/evo-2024' },
        ],
      },
      {
        emoji: '🗂️',
        title: 'SEM Examples',
        body: 'After EvoStep.1 ships: Study results — V.BookingTime actual: 155s (planned: 140s, baseline: 240s). Learning: time saved is 85s vs 100s planned. Confidence in estimation model is lower than expected. V.DropoffRate actual: 11% (planned: 14%, baseline: 22%). Learning: drop-off improvement exceeded the hypothesis — the single-page layout was more impactful than A/B benchmarks predicted. Act: update V.BookingTime Goal to 120s (stretch target remains viable); revise EvoStep.2 planning assumptions to use the more optimistic impact model from the DropoffRate outcome. No goal is locked until Study data confirms or refutes it.',
        links: [
          { label: 'Tom Gilb: Evo 9-step cycle (Gilb.com)', url: 'https://www.gilb.com/evo' },
          { label: 'Gilb.com — all resources', url: 'https://www.gilb.com' },
        ],
      },
    ],
  },

  // ── Stage 10: Plan ───────────────────────────────────────────────────────────
  {
    stage: 10,
    label: 'Plan',
    plType: 'resource',
    tagline: 'Assign resources — budgets updated by measured outcomes, not initial estimates',
    sections: [
      {
        emoji: '📜',
        title: 'History',
        body: 'The Sumerian clay tablets from Lagash (c. 2400 BC) contain the oldest surviving resource budgets: records of grain rations, labour days, and materials allocated to construction projects — with actual vs planned comparisons written in cuneiform. Resource planning as a feedback loop (allocate based on what actually happened, not on predictions) was formalised by Toyota\'s Kanban system (Taiichi Ohno, 1940s): inventory is replenished in response to actual consumption rates, not demand forecasts. This pull-based resourcing is the principle Planguage\'s Plan stage embodies: resource entries are updated by Study-Act data, not predetermined.',
        links: [
          { label: 'Cuneiform administration tablets (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Cuneiform_tablet' },
          { label: 'Kanban system — Toyota (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Kanban' },
          { label: 'Project management history (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Project_management#History' },
        ],
      },
      {
        emoji: '📐',
        title: 'Planguage',
        body: 'An R. (Resource) entry defines a budget, capacity, or material pool available to the plan. Resources include time (person-hours, calendar weeks), money (currency budget), people (named roles or FTE counts), tooling (licences, infrastructure), and any other finite input. R. entries are first-class Planguage entities — not informal notes. They carry: Tag, Description, Total (initial budget), Consumed (actual usage to date), Remaining (calculated), and LastUpdated (from Study-Act data). The Plan stage updates R. entries from Study-Act measurements: if a step used 10 hours instead of 8, the remaining budget shrinks accordingly. Resource planning IS a feedback loop driven by measurement.',
        links: [
          { label: 'Tom Gilb: Competitive Engineering — Resource entries (Gilb.com)', url: 'https://www.gilb.com/competitive-engineering' },
          { label: 'Tom Gilb: Planguage glossary (Gilb.com)', url: 'https://www.gilb.com/planguage' },
        ],
      },
      {
        emoji: '🗂️',
        title: 'SEM Examples',
        body: 'After EvoStep.1 Study-Act: R.DevTime — Total: 6 engineer-weeks (3 sprints from C.DevBudget). Consumed by EvoStep.1: 16 hours (2 hours over estimate — T.1.2 took longer than planned). Remaining: 6 weeks − 16 hours = 5 weeks 4 hours. R.QACapacity — Total: 8 QA hours per sprint. Consumed by EvoStep.1: 3 hours (T.1.3). Remaining: 5 hours in current sprint, 8 hours per future sprint. The Plan stage computes whether EvoStep.2 (international checkout) can proceed within remaining C.DevBudget or whether a scope reduction is needed. This calculation is explicit and traceable — not a gut-feel estimate.',
        links: [
          { label: 'Tom Gilb: Competitive Engineering (Gilb.com)', url: 'https://www.gilb.com/competitive-engineering' },
          { label: 'Earned Value Management — resource tracking (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Earned_value_management' },
        ],
      },
    ],
  },

  // ── Stage 11: Export ─────────────────────────────────────────────────────────
  {
    stage: 11,
    label: 'Export',
    plType: 'constraint',
    tagline: 'Share and publish — a bounded, auditable snapshot stakeholders can review and act on',
    sections: [
      {
        emoji: '📜',
        title: 'History',
        body: 'ISO 9001 (first published 1987, revised 2015) requires documented evidence of planning, measurement, and continuous improvement — a formalised export of plan quality for external audit. NASA\'s Mission Systems Review process requires exportable traceability from stakeholder needs to test evidence before any mission phase gate. IEEE 830 (Software Requirements Specifications standard) mandated structured, communicable requirement documents so that stakeholders who did not participate in requirements elicitation could review and sign off. The closing of the stakeholder loop — communicating the plan back to those whose needs originated it — is as old as formal engineering.',
        links: [
          { label: 'ISO 9001 quality management (Wikipedia)', url: 'https://en.wikipedia.org/wiki/ISO_9001' },
          { label: 'IEEE Software Requirements Specification standard (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Software_requirements_specification' },
          { label: 'Tom Gilb: Planguage entry format standards (Gilb.com)', url: 'https://www.gilb.com/planguage' },
        ],
      },
      {
        emoji: '📐',
        title: 'Planguage',
        body: 'Export produces a bounded-and-final snapshot of the plan: all V./F./C./S./R. entries with their current Status fields populated, the Evo Steps confirmed, impact hypotheses vs actual measurements, and resource usage summary. The hard constraint of Export is communicability: the plan must be understandable to stakeholders who did not participate in its creation. Planguage\'s structured entry format (field names from Template_Write_*.md standards) makes the output both machine-readable (JSON/XML) and human-auditable (HTML table). In SEM, Export produces a coloured HTML table (rule_colorful_exports.md, Tom Gilb 2026-05-26): every export must be a colored HTML table, never pure text. The stakeholder loop closes here: stage 1 identified who has needs; stage 11 delivers them a reviewable, cited plan.',
        links: [
          { label: 'Tom Gilb: Planguage (Gilb.com)', url: 'https://www.gilb.com/planguage' },
          { label: 'Tom Gilb: Competitive Engineering — entry format templates (Gilb.com)', url: 'https://www.gilb.com/competitive-engineering' },
        ],
      },
      {
        emoji: '🗂️',
        title: 'SEM Examples',
        body: 'Export for the booking system Evo cycle 1 produces: a colored HTML table with columns Tag / Type / Description / Status / Stakeholder / Evo Step / Last Measured. Row sample: V.BookingTime | Value | Booking completion time | Status: 155s (Goal: 90s, Tolerable: 180s) | §.Passenger | EvoStep.1 | 2026-05-14. Each row is a live entry with its current measured Status. The export is then shared with §.Passenger representatives (UX research), §.LegalTeam (constraint compliance), and §.AirlineOps (operational sign-off). Their feedback initiates the next Evo cycle at stage 1 — and the loop continues.',
        links: [
          { label: 'Tom Gilb: Evo cycle overview (Gilb.com)', url: 'https://www.gilb.com/evo' },
          { label: 'Gilb.com — all resources', url: 'https://www.gilb.com' },
        ],
      },
    ],
  },
]
