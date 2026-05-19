// UNIT_TYPE=Data
// Concept hints — Level 1 short texts and canonical term names for each Planguage concept.
// Used by ConceptHint.vue to show an always-visible one-liner + a 📖 Look-up button
// that opens the Define panel for the canonical term.
//
// Short-text authorship:
//   Tom Gilb (2026-05-15): stakeholders, stakeholder-needs, value-requirements,
//                          solution, evo-step.
//   Claudian (2026-05-15): all others, derived from standard files in 10.Standard/.
//
// Keep language in Tom's register: plain, slightly blunt, stakeholder-first.

export interface ConceptHint {
  /** Canonical Planguage term sent to defineTerm() — matches glossary headings */
  term: string
  /** One-liner always shown below the section header */
  short: string
}

export const CONCEPT_HINTS = {

  // ── Core entry types ──────────────────────────────────────────────────────────

  function: {
    term: 'Function',
    short:
      'What the system DOES — binary: present or absent, yes or no. ' +
      'Quality and performance thresholds belong on linked Values, not here.',
  },

  value: {
    term: 'Value',
    short:
      'A measurable quality or outcome with Scale, Meter, Status, Tolerable, and Goal. ' +
      'The unit of stakeholder success — the reason the system exists.',
  },

  solution: {
    term: 'Solution',
    short:
      'Any idea which, if implemented in a specific system, can deliver Values at acceptable costs. ' +
      'Also called Strategy, Architecture, or Design.',
  },

  constraint: {
    term: 'Constraint',
    short:
      'A Must or Must-not rule that applies regardless of value trade-offs. ' +
      'Binary compliance only — no partial credit, no exceptions.',
  },

  resource: {
    term: 'Resource',
    short:
      'A budget the team consumes — time, money, people. ' +
      'Expenditure alone is a cost, not a value. Resources are spent inside Evo Steps.',
  },

  // ── Stakeholder concepts ──────────────────────────────────────────────────────

  stakeholders: {
    term: 'Stakeholder',
    short:
      'Your source of needs, which can become planned Values (qualities), ' +
      'Constraints (must-rules), and Resource Budgets.',
  },

  'stakeholder-needs': {
    term: 'Stakeholder',
    short:
      'Wish-level desires. We assess feasibility before committing — ' +
      'a Wish becomes a Goal only once delivery is confirmed possible.',
  },

  'value-requirements': {
    term: 'Value',
    short:
      'Stakeholder Values at Goal level — what we commit to deliver. ' +
      'Measured on Scale with a Meter; compared to Status and Tolerable.',
  },

  // ── Value measurement fields ──────────────────────────────────────────────────

  scale: {
    term: 'Scale',
    short:
      'The unit of measurement for this Value — defines what "more" or "less" means ' +
      'in objective, reproducible terms.',
  },

  meter: {
    term: 'Meter',
    short:
      'How we actually take the Scale measurement in practice. ' +
      'Must be operational: someone must be able to run it today.',
  },

  status: {
    term: 'Status',
    short:
      'The current measured level — the baseline before any Evo Steps run. ' +
      'The gap between Status and Goal is what the plan must close.',
  },

  goal: {
    term: 'Goal',
    short:
      'The target level committed to reaching, once feasibility is confirmed ' +
      'from a Stakeholder Wish.',
  },

  tolerable: {
    term: 'Tolerable',
    short:
      'The minimum acceptable level. ' +
      'Below this the system is failing its stakeholders and the plan has not delivered.',
  },

  wish: {
    term: 'Wish',
    short:
      'Initial stakeholder aspiration before design or resource constraints are known. ' +
      'Becomes a Goal once feasibility is confirmed.',
  },

  // ── Evo planning concepts ─────────────────────────────────────────────────────

  'evo-step': {
    term: 'Evo Step',
    short:
      'A size-limited package of actions (Tasks) intended to deliver Value at acceptable costs. ' +
      'Completion is intended delivery — confirmed only by measuring the Value afterward.',
  },

  task: {
    term: 'Task',
    short:
      'A set of actions which when successfully completed will enable the Solution value ' +
      'to be delivered, or at least measured. Completing tasks is a coordination metric — ' +
      'not value delivery itself. Value is assessed after the full Evo Step.',
  },

  'evo-plan': {
    term: 'Evo Plan',
    short:
      'The ranked sequence of Evo Steps, most valuable first. ' +
      'Each step is a learn-and-deliver cycle: implement → study → adapt.',
  },

  // ── Prioritisation concepts ───────────────────────────────────────────────────

  impact: {
    term: 'Impact',
    short:
      'Estimated % contribution of this Solution to each linked Value. ' +
      'Used alongside Resource cost to rank Solutions by value-for-effort.',
  },

  'vc-ratio': {
    term: 'Value/Cost ratio',
    short:
      'Value Impact ÷ Resource Cost. ' +
      'Higher means more stakeholder value per unit of expenditure — the primary prioritisation signal.',
  },

  'presence-test': {
    term: 'Function',
    short:
      'The binary YES/NO test for whether this Function exists in the system. ' +
      'Quality and performance measures live on linked Values, not here.',
  },

} as const satisfies Record<string, ConceptHint>

export type ConceptHintKey = keyof typeof CONCEPT_HINTS
