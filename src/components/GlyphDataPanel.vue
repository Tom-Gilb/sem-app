<!--
  GlyphDataPanel.vue — Full reference panel for any Planguage glyph type.
  Opens when a PlTypeIcon is double-clicked (DD-013 universal rule) or when the
  user clicks a glyph FROM button in ArrowInfoPanel.

  Sections:
    • Header:           Big animated glyph + neon halo + identity
    • Glyph Anatomy:    Keyed notation decoded character-by-character + color glyph as artistic rendition
    • Planguage Connection: S·E·M position + definition paragraph
    • Ontology Diagram: SVG network diagram + clickable relation chips
    • Glossary Terms:   Key Planguage terms for this type
    • Example:          Real Planguage syntax example
    • History:          Historical fact + SVG illustration
    • Nerd Joke:        Domain-accurate joke
    • Source:           CE citation + gilb.com link

  z-tiers: backdrop z-[650], panel z-[651].
  Raised 2026-06-02 from 494/495 to 650/651 so panel renders above
  full-screen panels (ContractHub, MariaAgentBoard etc.) at z-[600].

  Architecture: all glyph reference data is co-located in this component
  (not a separate data file) so the panel is self-describing and portable
  to the Twin. PlTypeIcon is used for the live glyph render (no duplication).
-->
<script setup lang="ts">
// UNIT_TYPE=Panel
import { computed, onMounted, onUnmounted } from 'vue'
import PlTypeIcon, { type PlGlyphType } from './icons/PlTypeIcon.vue'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'

// ── Props / Emits ─────────────────────────────────────────────────────────────

const props = defineProps<{
  /** Which glyph type to display reference data for. */
  plType: PlGlyphType
}>()

const emit = defineEmits<{
  close: []
  /** User clicked a related-type chip — navigate to that glyph's panel. */
  'show-glyph': [plType: PlGlyphType]
}>()

// ── Types ─────────────────────────────────────────────────────────────────────

interface KeyedPart {
  chars: string
  meaning: string
}

interface GlossaryTerm {
  term: string
  abbrev: string
  definition: string
}

interface HistoricalFact {
  year: string
  who: string
  what: string
  context: string
}

interface GlyphEntry {
  fullName: string
  abbrev: string
  notation: string
  notationHint: string
  /** Keyed notation decoded part by part */
  keyedParts: KeyedPart[]
  /** One-sentence S·E·M position (S=Stakes, E=Ends, M=Means) */
  semPosition: string
  /** Full definition */
  definition: string
  hex: string
  badgeClass: string
  relations: Array<{
    label: string
    type: PlGlyphType
    direction: '→' | '←' | '↔'
  }>
  example: string
  glossaryTerms: GlossaryTerm[]
  history: HistoricalFact
  joke: string
  citation: string
  url: string
}

// ── Hex + short-label tables (used for SVG ontology diagram) ─────────────────

const GLYPH_HEX: Record<PlGlyphType, string> = {
  value:       '#7c3aed',
  function:    '#16a34a',
  constraint:  '#dc2626',
  solution:    '#ea580c',
  stakeholder: '#2563eb',
  'evo-step':  '#ca8a04',
  task:        '#374151',
  resource:    '#166534',
}

const GLYPH_SHORT: Record<PlGlyphType, string> = {
  value:       'V.',
  function:    'F.',
  constraint:  'C.',
  solution:    'S.',
  stakeholder: 'K.',
  'evo-step':  'Evo',
  task:        'Task',
  resource:    'R.',
}

// ── Reference data ─────────────────────────────────────────────────────────────

const GLYPH_DATA: Record<PlGlyphType, GlyphEntry> = {

  // ─── VALUE ──────────────────────────────────────────────────────────────────
  value: {
    fullName:     'Value Requirement',
    abbrev:       'V.',
    notation:     'O--*-->',
    notationHint: 'circle (scale) → asterisk (goal) → arrow (improvement direction)',
    keyedParts: [
      { chars: 'O',   meaning: 'Circle — the measurable Scale: a real-world property that can be quantified (Response Time, Satisfaction, Error Rate)' },
      { chars: '--',  meaning: 'Continuous range — Values live on a scalar continuum, not a binary yes/no. There is always a spectrum between Tolerable and Goal' },
      { chars: '*',   meaning: 'Asterisk — the Planguage wildcard for the current or target value. Here: the Goal (and Tolerable) data point on the Scale' },
      { chars: '-->',  meaning: 'Directional arrow — the direction of improvement. Values are always directional: less latency, more satisfaction, fewer errors' },
    ],
    semPosition:  'E (Ends) — Values define WHAT quality levels must be achieved for stakeholders. They sit in the Ends column, not the Means column: a Value specifies the required outcome, never the implementation.',
    definition:   `A Value is a quantified performance objective — a quality or characteristic that must reach a measurable level to satisfy a stakeholder. Values are defined by four key fields: Scale (what is measured), Meter (how it is measured), Tolerable (minimum acceptable level), and Goal (optimum target). The ratio of Value improvement to Cost is the fundamental Planguage prioritisation engine: solutions that deliver the most Value per unit Cost are scheduled first. Values are never binary — if it is binary, it is a Constraint or Function. Every Value must have a Scale and at least one numeric threshold (Tolerable or Goal) to be actionable.`,
    hex:          '#7c3aed',
    badgeClass:   'bg-violet-100 text-violet-700',
    relations: [
      { label: 'measured for', type: 'stakeholder', direction: '←' },
      { label: 'achieved by',  type: 'function',    direction: '←' },
      { label: 'delivered by', type: 'evo-step',    direction: '←' },
      { label: 'bounded by',   type: 'constraint',  direction: '↔' },
    ],
    example: `V. Response Time:
  Scale: Seconds from user action to full system response
  Meter: 95th-percentile measurement under production load
  Tolerable: < 5 s
  Goal:      < 1 s
  Record: [2026-05-01] Current: 3.2 s`,
    glossaryTerms: [
      { term: 'Scale',     abbrev: 'Sc.',  definition: 'The dimension of measurement — the named, observable property being quantified. Must be unambiguous: not "user happiness" but "Net Promoter Score (−100 to +100)".' },
      { term: 'Meter',     abbrev: 'Me.',  definition: 'The measurement instrument or procedure — HOW the Scale is measured. A Meter without a Scale is meaningless; a Scale without a Meter is unmeasurable.' },
      { term: 'Goal',      abbrev: 'Go.',  definition: 'The optimum target level on the Scale — the desired state if resources were unlimited. Not a minimum, not a threshold: the best achievable outcome.' },
      { term: 'Tolerable', abbrev: 'To.',  definition: 'The minimum acceptable level — below this, the stakeholder need is unmet. The boundary between acceptable and unacceptable performance.' },
      { term: 'Record',    abbrev: 'Rec.', definition: 'Time-stamped actual measurements on the Scale — the empirical evidence base. Without Records, the Value is a hypothesis, not an engineering claim.' },
    ],
    history: {
      year:    '1950',
      who:     'W. Edwards Deming',
      what:    'Deming\'s 14 Points introduced measurable quality targets to Japanese manufacturing. His insistence on data-driven goals — not vague aspirations — is the direct ancestor of Planguage\'s Scale/Meter/Goal/Tolerable structure.',
      context: 'American manufacturers dismissed Deming\'s statistical quality control after WWII. Japan embraced it. By 1980, Japan dominated global electronics and automotive manufacturing. The Deming Prize is still awarded annually in Tokyo. His phrase "In God we trust; all others bring data" is now inscribed on software dashboards worldwide.',
    },
    joke: 'A product manager submits: "V. User Satisfaction: Goal: high." A Planguage practitioner responds: "Scale is undefined. Meter is undefined. \'High\' has no numeric boundary. This is not a Value — this is a wish written in Value font." Two weeks of arguments later: "V. User Satisfaction: Scale: Net Promoter Score (−100 to +100). Meter: Quarterly NPS survey, N≥100. Tolerable: ≥30. Goal: ≥60." The PM stares at it. "This is the same thing I wrote." "No. Now the whole team knows what success actually means."',
    citation: 'Tom Gilb, Competitive Engineering (2005) — Chapter 5 "Values and Scales", p.47',
    url:      'https://www.gilb.com/store/p71/Competitive_Engineering.html',
  },

  // ─── FUNCTION ───────────────────────────────────────────────────────────────
  function: {
    fullName:     'Function Requirement',
    abbrev:       'F.',
    notation:     '→O→',
    notationHint: 'input arrow → process circle → output arrow (capability flow)',
    keyedParts: [
      { chars: '→', meaning: 'Input arrow — the capability receives a triggering input: a request, an event, a user action. Something flows IN.' },
      { chars: 'O', meaning: 'Process circle — the capability itself: WHAT the system does. The circle is opaque: quality and quantity live outside it, as V. entries.' },
      { chars: '→', meaning: 'Output arrow — the capability produces an output: a result, a state change, a transformed artifact. Something flows OUT. If either arrow is absent, the function is absent.' },
    ],
    semPosition:  'E (Ends) — Functions define WHAT the system does (binary presence). Like Values, Functions are in the Ends column — they specify required outcomes, not the implementation approach.',
    definition:   `A Function is a binary system capability — it is either PRESENT or ABSENT. There are no thresholds, no quality levels, no "partially present" functions. The quality and quantity of a function's output always attaches as a Value entry, not inside the function definition. This distinction is DD-004: "Function is binary." A well-formed function has a PresenceTest: a sentence that can be answered YES or NO to determine if the function is present. Functions are the structural skeleton of the system — they define WHAT the system does, not HOW WELL it does it.`,
    hex:          '#16a34a',
    badgeClass:   'bg-emerald-100 text-emerald-700',
    relations: [
      { label: 'qualified by',   type: 'value',       direction: '→' },
      { label: 'required by',    type: 'stakeholder', direction: '←' },
      { label: 'implemented by', type: 'solution',    direction: '←' },
      { label: 'bounded by',     type: 'constraint',  direction: '←' },
    ],
    example: `F. User Authentication:
  Description:  The system authenticates users by credential.
  PresenceTest: Can a registered user log in with valid username + password?
  Status:       Present`,
    glossaryTerms: [
      { term: 'PresenceTest', abbrev: 'PT.',   definition: 'A binary test sentence answerable YES or NO: "Can a registered user log in?" If YES, the function is present. Every F. entry must have one. No PresenceTest = no engineering target.' },
      { term: 'Binary',      abbrev: '0/1',   definition: 'In Planguage, binary means exactly two states: present or absent. A function cannot be "80% present" — that phrasing describes a defect or a Value deviation, not a function state.' },
      { term: 'Capability',  abbrev: 'Cap.',  definition: 'A system ability stated in the present tense: "The system authenticates users" not "will authenticate." A capability is always described from the outside — observable behaviour, not internal mechanism.' },
      { term: 'Decomposition', abbrev: 'Dec.', definition: 'Complex functions are decomposed into independently-testable sub-functions: F. → F.sub → F.sub.sub. Each level is binary-testable. Over-decomposition is when a sub-function cannot be tested without all others.' },
    ],
    history: {
      year:    '1843',
      who:     'Ada Lovelace',
      what:    'Note G — the first published algorithm — was the first formal specification of a function: WHAT the Analytical Engine would compute (Bernoulli numbers), completely separate from HOW the mechanism worked. Binary presence test: does the engine produce the correct Bernoulli sequence? Yes or No.',
      context: 'Lovelace translated Luigi Menabrea\'s memoir on Babbage\'s machine and added 7 annotations longer than the original paper. Note G is 2.5× longer than any prior algorithm description. Her key insight — the "law" (the function) must be fully specified before any mechanism is built — is the direct ancestor of DD-004: specify WHAT before HOW. She also noted that the machine could only do what it was told, never originate — anticipating the limits of deterministic computation 100 years before Turing.',
    },
    joke: 'An engineer says the authentication feature is "75% done." The Planguage practitioner asks: "Can a user log in with valid credentials right now?" Engineer: "Well... the password hashing is done, OAuth is set up, but session management needs..." Practitioner: "So the function is ABSENT." Engineer: "...yes." Practitioner: "Then it is 0% done. You have delivered excellent infrastructure for an absent capability. The function is binary — progress is not a function state."',
    citation: 'Tom Gilb, Competitive Engineering (2005) — Chapter 3 "Functions", p.29 + DD-004 (2026-05-14)',
    url:      'https://www.gilb.com/store/p71/Competitive_Engineering.html',
  },

  // ─── CONSTRAINT ─────────────────────────────────────────────────────────────
  constraint: {
    fullName:     'Constraint',
    abbrev:       'C.',
    notation:     '[→O→]',
    notationHint: 'square brackets = hard boundary around the process (binary or scalar limit)',
    keyedParts: [
      { chars: '[',    meaning: 'Left hard-boundary bracket — this is the wall. In Planguage square brackets always mean "non-negotiable container." The bracket says: you cannot cross this boundary.' },
      { chars: '→O→', meaning: 'Bounded process — the same →O→ as Function, now enclosed. The constraint wraps around the capability, defining the hard limits within which it must operate.' },
      { chars: ']',   meaning: 'Right hard-boundary bracket — sealing the constraint envelope. The pair [→O→] means: this process is allowed to exist, but only within these walls.' },
    ],
    semPosition:  'E (Ends) — Constraints are hard requirements in the Ends column. Unlike Values (which have ranges), Constraints have a single binary pass/fail boundary. DD-006: the primary optimisation is maximising Values WITHIN all Constraints. Constraints define the feasibility envelope.',
    definition:   `A Constraint is a requirement that must not be violated — a hard boundary on the solution space. Constraints include binary compliance rules (GDPR, ISO standards, legal requirements) and scalar budget limits (time, money, headcount). A solution that violates any constraint is invalid regardless of its Value delivery. All regulatory and legal requirements are Constraints. Budget entries are Constraints. The primary prioritisation in Planguage is maximising Value within all Constraints (DD-006). Constraints are distinct from Values: a Value has a Goal to optimise towards; a Constraint has a hard boundary that must not be crossed.`,
    hex:          '#dc2626',
    badgeClass:   'bg-red-100 text-red-700',
    relations: [
      { label: 'bounds',       type: 'solution',    direction: '→' },
      { label: 'bounds',       type: 'value',       direction: '→' },
      { label: 'imposed by',   type: 'stakeholder', direction: '←' },
      { label: 'respected by', type: 'evo-step',    direction: '←' },
    ],
    example: `C. GDPR Compliance:
  Description:  All personal data processing must comply with EU GDPR.
  PresenceTest: Does data processing meet all GDPR Article 5 principles?
  Status:       Must be Present

C. Budget:
  Scale:     Total development expenditure in EUR
  Tolerable: ≤ 500 000
  Record:    [2026-05-01] Current: 120 000`,
    glossaryTerms: [
      { term: 'Hard boundary', abbrev: 'HB.',  definition: 'A requirement that cannot be partially satisfied. Either the constraint is respected (PASS) or violated (FAIL). Unlike Values, there is no "tolerable deviation" from a Constraint.' },
      { term: 'Budget',        abbrev: 'Bud.', definition: 'A Resource Constraint — a ceiling on expenditure that the plan must not exceed. Budgets are C. entries, never V. entries, because exceeding a budget is categorical failure, not measured deviation.' },
      { term: 'Regulatory',    abbrev: 'Reg.', definition: 'A legal or standards obligation imposed by an external authority (GDPR, ISO, FDA). Regulatory constraints are always binary: compliant or non-compliant. The regulation\'s issuer is a Stakeholder.' },
      { term: 'Scalar',        abbrev: 'Scl.', definition: 'A Constraint with a numeric boundary (≤ €500,000 or response time ≤ 200 ms in a safety context). Distinguished from binary Constraints by having a threshold value on a named scale.' },
    ],
    history: {
      year:    '1947',
      who:     'George Dantzig',
      what:    'Dantzig\'s simplex algorithm formalised the concept of finding the optimum within a constraint boundary — linear programming. Every LP problem states: maximise an objective function WITHIN a set of hard constraint inequalities. DD-006 (maximise Values within all Constraints) is a direct descendant.',
      context: 'Dantzig developed the simplex method while at the US Air Force. Legend holds that in 1939 he arrived late to a statistics lecture, copied two problems from the board thinking they were homework, and solved them — only to discover they were famous unsolved problems. The LP duality theorem later proved that the constraint boundary and the objective gradient are mathematically dual: knowing one fully defines the other. Every Constraint in a Planguage spec is a duality partner to a Value goal.',
    },
    joke: 'The CEO says "there are no constraints — the sky\'s the limit!" The CFO says "we have a €500k budget." The GDPR officer says "personal data must be processed lawfully." The fire marshal says "maximum occupancy: 49 persons." The Planguage analyst says "congratulations, you have four C. entries. The sky-limit is V. Revenue Potential, and we can now prioritise properly." The CEO: "...I preferred my version." The analyst: "That is why projects fail."',
    citation: 'Tom Gilb, Competitive Engineering (2005) — Chapter 7 "Constraints", p.67',
    url:      'https://www.gilb.com/store/p71/Competitive_Engineering.html',
  },

  // ─── SOLUTION ───────────────────────────────────────────────────────────────
  solution: {
    fullName:     'Solution',
    abbrev:       'S.',
    notation:     '[*]→',
    notationHint: 'bracketed asterisk = design option flowing to outcomes',
    keyedParts: [
      { chars: '[',  meaning: 'Left bracket — a committed, bounded candidate. Not a vague idea: a specific, nameable design choice with impact claims.' },
      { chars: '*',  meaning: 'Asterisk — the Planguage wildcard for "this content." Inside brackets: the solution\'s substance, its design. The asterisk says: something specific is here.' },
      { chars: ']',  meaning: 'Right bracket — closing the package. The bracketed asterisk [*] is a vessel: a complete, shippable option.' },
      { chars: '→',  meaning: 'Arrow — the solution\'s causal chain. It flows toward outcomes: Functions it implements, Values it improves. Without the arrow (without impact), it is not a Solution — it is a technology choice.' },
    ],
    semPosition:  'M (Means) — Solutions are the "how." They sit in the Means column of the S·E·M model. Every Solution must have impact claims on at least one Value or Function — otherwise it is an activity, not a Solution.',
    definition:   `A Solution is a candidate design, strategy, or delivery approach that may implement Functions and achieve Values. Many solutions may address one stakeholder need; VDT (Value Delivery per unit Cost) determines which to schedule. Solutions are evaluated against Values (how much will this improve each Value?) and must respect all Constraints. A solution that maximally improves the highest-priority Values at the lowest Cost is the optimal choice. Solutions are hypotheses until tested against actual Value measurements in an Evo Step. The Planguage "Means" in the S·E·M parsing maps to Solutions.`,
    hex:          '#ea580c',
    badgeClass:   'bg-orange-100 text-orange-700',
    relations: [
      { label: 'implements',   type: 'function',    direction: '→' },
      { label: 'improves',     type: 'value',       direction: '→' },
      { label: 'must respect', type: 'constraint',  direction: '→' },
      { label: 'serves',       type: 'stakeholder', direction: '→' },
    ],
    example: `S. Progressive Web App (PWA):
  Description: Deliver the application as a PWA for offline access
  and push notifications without requiring a native app install.
  Impact: V.ResponseTime Goal: 0.5 s (50% improvement)
          V.UserSatisfaction Goal: +18 NPS points
          F.OfflineAccess: present`,
    glossaryTerms: [
      { term: 'VDT', abbrev: 'VDT', definition: 'Value Delivery per unit Cost — the primary prioritisation metric. How much Value improvement does this Solution deliver per unit of Resource consumed? Highest VDT is scheduled first.' },
      { term: 'Candidate design', abbrev: 'Cand.', definition: 'A Solution is always a candidate until its actual impact is measured. No Solution is "the architecture" until measured against real stakeholder Values. It is a hypothesis.' },
      { term: 'Impact', abbrev: 'Imp.', definition: 'The predicted or measured change in a Value or Function attributable to this Solution. Impact claims are the core of a Solution entry: without them, the Solution is unschedulable.' },
      { term: 'Means', abbrev: 'M.', definition: 'In the S·E·M three-level Keeney model, Means are the implementation strategies. A Solution is the canonical Means entry — the design that serves Ends, which serve Stakeholders.' },
    ],
    history: {
      year:    '1961',
      who:     'Charles Hitch · RAND Corporation',
      what:    'RAND\'s Planning-Programming-Budgeting System (PPBS) — adopted by McNamara at the Pentagon — was the first systematic method to evaluate competing solution candidates by their cost-effectiveness ratio rather than by political preference.',
      context: 'Multiple weapon system designs (solutions) were evaluated on the same scale: casualties prevented per dollar spent. Hitch\'s "The Economics of Defense in the Nuclear Age" (1960) introduced the principle that solutions are selected by value-delivery-per-dollar — identical to Planguage\'s VDT. McNamara\'s "whiz kids" replaced military intuition with explicit quantification of solution impact. The approach was controversial and politically unpopular — but it is the prototype for all modern cost-benefit analysis, from government procurement to software architecture decisions.',
    },
    joke: 'A developer calls their new microservices architecture a "solution." The practitioner asks: "What Value does it improve?" Developer: "Scalability." Practitioner: "That is a word. What is the Scale? The Meter? The Record? The Goal?" Developer: "Um... it lets us scale horizontally..." Practitioner: "So V. Throughput: Scale = TPS, Meter = load test P95, Current = 450 TPS, Goal = 2000 TPS. The architecture is a Solution candidate with predicted Impact = ×4.4 throughput. Now we can measure whether it worked." Developer: "This is a lot more work than just calling it scalable." Practitioner: "Yes. That extra work is called engineering."',
    citation: 'Tom Gilb, Competitive Engineering (2005) — Chapter 6 "Solutions and Means", p.55',
    url:      'https://www.gilb.com/store/p71/Competitive_Engineering.html',
  },

  // ─── STAKEHOLDER ────────────────────────────────────────────────────────────
  stakeholder: {
    fullName:     'Stakeholder',
    abbrev:       'K.',
    notation:     '←¶→',
    notationHint: 'pilcrow (person/entity) with bidirectional influence arrows',
    keyedParts: [
      { chars: '←', meaning: 'Receiving arrow — the stakeholder receives value. Stakeholders are beneficiaries: plans exist to deliver value to them.' },
      { chars: '¶', meaning: 'Pilcrow (¶) — traditionally marks a paragraph, a new voice, a distinct speaker. Here: the unique voice of an entity with needs. Every stakeholder has a distinct perspective that must be represented in the spec.' },
      { chars: '→', meaning: 'Influencing arrow — the stakeholder also IMPOSES requirements: Values, Functions, Constraints. Stakeholders are active, not passive. The bidirectional notation captures both directions simultaneously.' },
    ],
    semPosition:  'S (Stakes) — Stakeholders are the fundamental starting point of the S·E·M model. Their needs generate the entire Ends column (Values, Functions, Constraints) and thereby determine which Means are worth pursuing.',
    definition:   `A Stakeholder is any entity — person, organisation, system, or inanimate object — with needs that the plan must address. Inanimate stakeholders are equally valid: data has needs (GDPR compliance), regulations have requirements (they are legal stakeholders), databases have integrity requirements (Tom Gilb 2026-05-15). Stakeholders define WHOSE Values, Functions, and Constraints matter. When a stakeholder's needs are not reflected in the spec, they are invisible in the plan — a source of later failure. Every Value and Constraint should trace to at least one stakeholder need. In Planguage, stakeholders include customers, operators, maintainers, regulators, and all data/system entities.`,
    hex:          '#2563eb',
    badgeClass:   'bg-blue-100 text-blue-700',
    relations: [
      { label: 'has needs →', type: 'value',       direction: '→' },
      { label: 'requires',    type: 'function',    direction: '→' },
      { label: 'imposes',     type: 'constraint',  direction: '→' },
      { label: 'benefits from',type: 'evo-step',   direction: '←' },
    ],
    example: `Stakeholder: Passenger
  Alias: end-user, traveller
  Needs: V.JourneyTime, V.Reliability, F.RealTimeTracking
  Role: Primary value recipient; satisfaction is the primary success metric

Stakeholder: GDPR Regulation (inanimate)
  Needs: C.DataMinimisation, C.BreachNotification
  Role: Compliance requirement; all personal data processing must satisfy`,
    glossaryTerms: [
      { term: 'Inanimate stakeholder', abbrev: 'I.K.', definition: 'A non-person entity with legitimate needs: data (GDPR), databases (integrity), regulations (compliance), physical laws (gravity in aerospace). Tom Gilb 2026-05-15: "all data is a stakeholder, it has needs like GDPR."' },
      { term: 'Primary stakeholder', abbrev: 'P.K.', definition: 'The stakeholder whose Values are the primary optimisation target. In a product: the end user. In a hospital: the patient. When in doubt: whose failure to be satisfied makes the entire project a failure?' },
      { term: 'Value recipient', abbrev: 'VR.', definition: 'The stakeholder who receives the value delivered by a Solution or Evo Step. Identifying the value recipient makes it explicit whose life must improve — not just what the system does.' },
      { term: 'Power / Interest', abbrev: 'P/I', definition: 'Stakeholder analysis classifies entities by power to affect the plan AND interest in the outcome. Regulators: high power, specific interest. End users: low individual power, high collective interest. Both must be modelled.' },
    ],
    history: {
      year:    '1984',
      who:     'R. Edward Freeman',
      what:    'Freeman\'s "Strategic Management: A Stakeholder Approach" (1984) formally introduced the stakeholder model to business. But Tom Gilb had been using the concept in software specifications since the 1970s — earlier than Freeman\'s text. Gilb\'s innovation: inanimate entities (data, systems, laws) are stakeholders, not just people.',
      context: 'The traditional corporate view — "shareholders are the only stakeholders" — was dominant until Freeman. Even today, many organisations list only humans as stakeholders. Planguage goes further than Freeman: a regulatory mandate is a stakeholder because it has needs (compliance) that must be satisfied, regardless of whether it is a legal entity. GDPR, gravity, and database integrity are all stakeholders in any system that touches them. If you do not name them, their requirements will arrive as surprises.',
    },
    joke: 'The analyst creates a stakeholder register: CEO, CTO, customers. The Planguage practitioner adds: GDPR (the regulation), the PostgreSQL database (integrity requirements), and the server rack (needs ambient temperature ≤ 25°C). The analyst: "Regulations and servers aren\'t stakeholders!" Practitioner: "Does GDPR have needs the system must satisfy?" "...Yes." "Does the database crash if its integrity constraints are violated?" "...Yes." "Then they are stakeholders. Add them — or their requirements will surprise you at 3 am on a Friday." The analyst adds them. Three months later they avoid a GDPR audit fine. The rack temperature C. entry saves a data centre.',
    citation: 'Tom Gilb, Competitive Engineering (2005) — Chapter 2 "Stakeholders", p.17 · Tom Gilb 2026-05-15: "all data is a stakeholder"',
    url:      'https://www.gilb.com/store/p71/Competitive_Engineering.html',
  },

  // ─── EVO STEP ───────────────────────────────────────────────────────────────
  'evo-step': {
    fullName:     'Evo Step',
    abbrev:       'Evo',
    notation:     '< →+→',
    notationHint: 'left-chevron (learn/look back) → forward-plus (deploy) → forward-arrow (measure)',
    keyedParts: [
      { chars: '<',  meaning: 'Left chevron — look back, learn. Evo Steps 8–9 (Measure and Learn) feed back into the plan. The < encodes retrospective: we learned from the last delivery and are adjusting.' },
      { chars: '→',  meaning: 'Forward arrow — plan and develop (Evo Steps 5–6: Prioritise and Develop). The plan becomes action.' },
      { chars: '+',  meaning: 'Plus — additive delivery. Each Evo Step adds value on top of what was previously delivered. Not a rewrite — an increment.' },
      { chars: '→',  meaning: 'Second forward arrow — deliver and measure (Evo Steps 7–8: Deliver and Measure). The increment ships, and its actual Value impact is collected.' },
    ],
    semPosition:  'S·E·M Connector — Evo Steps are not in a single column; they are the active connector between M (Means: Solutions, Tasks) and E (Ends: Values, Functions). Each step takes Means and delivers against Ends, then measures whether the Ends were actually achieved.',
    definition:   `An Evo Step is one incremental delivery cycle within the Evo 9-step cycle (Tom Gilb EVO 2024, Ch.2, p.19). Each Evo Step delivers measurable stakeholder value by implementing specific Solutions and measuring their actual impact on Values. Evo Steps are never sequential gates — they are independent, self-contained delivery cycles that can be navigated in any order (DD-007). The Planning Cycle (Steps 1–5) produces the Evo Steps; the Value Delivery Cycle (Steps 6–9: Develop → Deliver → Measure → Learn) executes them. Measure = collect V. entry Status data; Learn = interpret data and update the spec. Both are distinct events (Deming PDSA letter to Tom Gilb, 18 May 1991).`,
    hex:          '#ca8a04',
    badgeClass:   'bg-amber-100 text-amber-700',
    relations: [
      { label: 'delivers',    type: 'value',       direction: '→' },
      { label: 'implements',  type: 'solution',    direction: '→' },
      { label: 'composed of', type: 'task',        direction: '→' },
      { label: 'serves',      type: 'stakeholder', direction: '→' },
    ],
    example: `Evo Step 1: Baseline Authentication
  Goal:      Implement F.UserAuthentication and measure V.LoginSuccessRate
  Solutions: S.OAuthIntegration
  Deliver by: 2026-06-15
  Measure:   V.LoginSuccessRate Current vs Goal
  Learn:     Was the Goal reached? What prevented it?`,
    glossaryTerms: [
      { term: 'Planning Cycle',      abbrev: 'PC.',  definition: 'Steps 1–5 of the 9-Step Evo Cycle: Stakeholders → Values → Solutions → Decompose → Prioritise. The planning cycle produces the Evo Step queue.' },
      { term: 'Value Delivery Cycle', abbrev: 'VDC.', definition: 'Steps 6–9 of the 9-Step Evo Cycle: Develop → Deliver → Measure → Learn. One iteration of a single Evo Step. The VDC converts planning into measured value delivery.' },
      { term: 'Measure',    abbrev: 'Me.', definition: 'Evo Step 8 — collect actual V. entry Status data from the real system in production. NOT estimation: it is empirical data from the deployed delivery.' },
      { term: 'Learn',      abbrev: 'Le.', definition: 'Evo Step 9 — interpret the Measure data and update the spec. Separate from Measure (Deming\'s PDSA distinction: Study before Act). Learning may reveal hidden stakeholder needs, incorrect Values, or wrong solutions.' },
    ],
    history: {
      year:    '1976',
      who:     'Tom Gilb',
      what:    'Tom Gilb published the first formulation of the Evo method in "Software Metrics" (1976). The core insight: deliver software in small increments, measure the real impact on stakeholders, use that data to improve the next increment. This predates Scrum (1995) by 19 years and the Agile Manifesto (2001) by 25 years.',
      context: 'W. Edwards Deming wrote to Tom Gilb on 18 May 1991 to confirm that Evo\'s Measure/Learn distinction correctly preserved the full PDSA cycle (Plan-Do-Study-Act), unlike most "Agile" interpretations that collapse Study and Act into a single "retrospective." The distinction matters: you cannot Act correctly on data you have not Studied. Gilb\'s EVO 2024 book specifies 9 explicit steps — a level of rigour that popular Agile methods consistently avoid. Tom Gilb: "AI means we no longer have to pander to the masses and their need for simplification. For the first time in history we can afford to DO IT RIGHT."',
    },
    joke: 'An Agile coach says "we do 2-week sprints and retros — that\'s basically Evo." The Evo practitioner says "name the 9 steps." Coach: "Plan, Sprint, Review, Retro." Practitioner: "That\'s 4. And Measure and Learn are the same step in your model." Coach: "Aren\'t they?" Practitioner: "Deming wrote to Tom Gilb in 1991 to explain why they are not. Study comes before Act. When you retro, are you studying measured data or scheduling the next sprint?" Long pause. "We... have velocity." Practitioner: "Velocity is not a Value. What stakeholder need did last sprint\'s velocity satisfy?"',
    citation: 'Tom Gilb, EVO (2024) — Chapter 2 "The 9-Step Evo Cycle", p.19 · Tom Gilb 2026-05-23: "My Evo cycle has 9-nine."',
    url:      'https://www.gilb.com/store/p71/',
  },

  // ─── TASK ───────────────────────────────────────────────────────────────────
  task: {
    fullName:     'Task',
    abbrev:       'Task',
    notation:     '→O→*',
    notationHint: 'input → process circle → output arrow + asterisk (produces a deliverable)',
    keyedParts: [
      { chars: '→',  meaning: 'Input arrow — a Task receives a trigger: an assignment, a definition of done, a place in the Evo Step plan. Something initiates it.' },
      { chars: 'O',  meaning: 'Process circle — the work itself: the engineering activity (coding, testing, deploying, documenting). The circle is the effort.' },
      { chars: '→',  meaning: 'Output arrow — the Task produces something. Work without output is overhead, not a Task.' },
      { chars: '*',  meaning: 'Asterisk — the DELIVERABLE. The asterisk is OUTSIDE the circle, marking the concrete artifact produced: a pull request, a deployed feature, a test suite. Tasks without deliverables are not Tasks.' },
    ],
    semPosition:  'M (Means) — Tasks are the leaf nodes of the Means column. The hierarchy: Stakeholders → Values → Solutions → Evo Steps → Tasks. Tasks implement the concrete work that makes Solutions real. They are the smallest unit of schedulable, assignable, and measurable work.',
    definition:   `A Task is a concrete work item that implements a Solution or delivers part of an Evo Step. Tasks are the engineering activities — coding, testing, deploying, documenting — that produce measurable results for stakeholders. Each Task consumes Resources (time, money, people) and contributes to the completion of an Evo Step. Tasks are the leaf nodes of the planning hierarchy: Stakeholders → Values → Solutions → Evo Steps → Tasks → Resources. A task that cannot be described in one clear sentence is probably too coarse and should be decomposed.`,
    hex:          '#374151',
    badgeClass:   'bg-slate-100 text-slate-700',
    relations: [
      { label: 'implements',  type: 'evo-step',  direction: '→' },
      { label: 'consumes',    type: 'resource',  direction: '→' },
      { label: 'delivers',    type: 'solution',  direction: '→' },
    ],
    example: `Task: Implement JWT Authentication Middleware
  Description:  Create Express.js middleware that validates JWT tokens on
  all protected API routes. Returns 401 on missing/invalid token.
  Evo Step:     Step 1 — Baseline Authentication
  Estimate:     2 person-days
  Owner:        Backend team
  Deliverable:  Pull request with tests, merged to main`,
    glossaryTerms: [
      { term: 'Work item',            abbrev: 'WI.',  definition: 'The atomic schedulable unit: one clear activity, one named owner, one time estimate, one deliverable. If it requires two sentences to describe, decompose it.' },
      { term: 'Leaf node',            abbrev: 'Lf.',  definition: 'In the planning hierarchy (Stakeholders → Values → Solutions → Evo Steps → Tasks), Tasks are the terminal entries. They have no sub-tasks. If decomposition is needed, they are Evo Steps.' },
      { term: 'Decomposition',        abbrev: 'Dec.', definition: 'Breaking a complex Evo Step into atomic Tasks. Correct decomposition: each Task is independently completable, independently testable, independently assignable. Over-decomposition creates overhead.' },
      { term: 'Resource consumption', abbrev: 'RC.',  definition: 'Every Task consumes at least one Resource (typically person-hours). The Resource cost of a Task is input to the VDT calculation: Value delivered by the parent Solution ÷ total Task Resource costs.' },
    ],
    history: {
      year:    '1910',
      who:     'Henry Gantt',
      what:    'Gantt\'s 1910 bar chart — the Gantt chart — was the first systematic tool for task decomposition and scheduling. Gantt broke large industrial projects into atomic tasks with durations and dependencies, visualised as horizontal bars on a timeline.',
      context: 'The US Army used Gantt charts for WWI mobilisation logistics; the Hoover Dam and the Interstate Highway System were planned with them. Gantt\'s insight — that large work must be decomposed into atomic, schedulable units BEFORE it can be managed — is the direct ancestor of all modern work breakdown structures, Jira tickets, and Planguage Task entries. His 1910 paper "Work, Wages and Profit" was the first to show that task management — not material supply — was the primary bottleneck in industrial production.',
    },
    joke: 'A developer says "I\'ll implement the entire user management system — about 2 weeks." The practitioner says "what are the Tasks?" Developer: "...implement user management." Practitioner: "That is an Evo Step, not a Task. Decompose." Developer: "User model, login endpoint, registration, email verification, password reset, session management, admin panel, audit logging..." Practitioner: "That is 8 Tasks with 3 implied dependencies. How long does each take?" Developer: "Um... 3 days each?" Practitioner: "That is 24 days. You found 10 weeks of work inside your 2-week estimate. That thinking just saved you a missed deadline."',
    citation: 'Tom Gilb, Competitive Engineering (2005) — Chapter 9 "Tasks and Work Breakdown", p.89',
    url:      'https://www.gilb.com/store/p71/Competitive_Engineering.html',
  },

  // ─── RESOURCE ───────────────────────────────────────────────────────────────
  resource: {
    fullName:     'Resource',
    abbrev:       'R.',
    notation:     '→O',
    notationHint: 'input arrow → oval (resource pool) — consumed, no output arrow',
    keyedParts: [
      { chars: '→', meaning: 'Consumption arrow — something flows INTO the Resource: budget assignment, team allocation, time commitment. The flow goes IN.' },
      { chars: 'O', meaning: 'Oval / pool — the resource reservoir: the available capacity. The oval is the pool being depleted.' },
      { chars: '(no →)', meaning: 'NO output arrow — the defining feature. Resources are consumed, not produced. The pool depletes; nothing flows out. Compare with Function (→O→) where output is the point.' },
    ],
    semPosition:  'Constraint on M (Means) — Resources bound what Means are feasible. Without Resources, all Solutions are equally valid theoretical options. With Resources, VDT determines which Solutions can actually be funded and scheduled.',
    definition:   `A Resource is a budget, capacity, or material allocated to the plan. Resources include time (person-hours, calendar duration), money (financial budget), people (team capacity, named roles), and tooling (licences, infrastructure). Resources are consumed by Tasks and constrained by Budgets (which are Constraints). The Resource dimension of planning ensures that Value delivery is grounded in realistic capacity — no solution can be prioritised that exceeds available Resources. In Planguage, Resources are tracked with initial allocation and remaining-after-depletion status, which feeds the primary prioritisation calculation.`,
    hex:          '#166534',
    badgeClass:   'bg-emerald-100 text-emerald-800',
    relations: [
      { label: 'consumed by',  type: 'task',        direction: '←' },
      { label: 'allocated to', type: 'evo-step',    direction: '←' },
      { label: 'bounded by',   type: 'constraint',  direction: '←' },
    ],
    example: `Resource: Development Team
  Scale:     Person-days available in Q2 2026
  Initial:   120 person-days
  Remaining: 87 person-days
  Allocated: Evo Step 1: 15 pd · Evo Step 2: 18 pd

Resource: Engineering Budget
  Scale:     EUR available for external services and tooling
  Initial:   €50 000
  Remaining: €31 400`,
    glossaryTerms: [
      { term: 'Budget',     abbrev: 'Bud.', definition: 'The initial allocation of a Resource to the plan. Every Budget is simultaneously a Resource entry AND a Constraint entry — the Budget ceiling is the hard boundary, the Resource is the pool.' },
      { term: 'Remaining',  abbrev: 'Rem.', definition: 'The current residual capacity of a Resource after Task assignments. Remaining = Initial − Allocated. VDT scheduling depends on Remaining: next highest-VDT Solution that fits within Remaining is scheduled.' },
      { term: 'Capacity',   abbrev: 'Cap.', definition: 'The maximum throughput of a human Resource. Capacity is NOT infinite and NOT fungible: adding people to a late project does not linearly add capacity (Brooks\' Law).' },
      { term: 'Allocation', abbrev: 'All.', definition: 'The assignment of Resource units to a specific Evo Step or Task. Allocation decisions are the output of the Prioritise phase: which Solutions get funded from the pool, in which order.' },
    ],
    history: {
      year:    '1975',
      who:     'Frederick P. Brooks Jr.',
      what:    'Brooks\' "The Mythical Man-Month" (1975) proved that person-months are not fungible: a 9-month project does not become a 1-month project by adding 9 people. Communication overhead grows as O(n²) with team size.',
      context: 'Brooks wrote the book while managing IBM\'s OS/360 development — the largest software project to that date. His Law — "adding manpower to a late software project makes it later" — directly challenged the accounting assumption that Resources are interchangeable units. Planguage models this correctly: a Resource must specify its TYPE (senior-architect-days are not substitutable for junior-developer-days). The Budget Constraint must specify the type of Resource, not just the quantity. Resource planning without type constraints is wishful accounting.',
    },
    joke: 'A PM reports: "We are 3 months behind. I have requested 6 more developers." The practitioner asks: "What is the remaining Architect Resource?" PM: "0 days — architects are at 100% allocation." Practitioner: "Adding 6 junior developers to a project with 0 architect capacity means those developers will create their own architecture, which will need to be reviewed by the architects who do not exist, at roughly 3× the time saved. This is Brooks\' Law. Please model it as a C. entry: Architect Capacity ≤ 0 person-days Remaining." PM: "...can I just add the developers anyway?" Practitioner: "Yes. I will update the risk register."',
    citation: 'Tom Gilb, Competitive Engineering (2005) — Chapter 10 "Resources and Budgets", p.101',
    url:      'https://www.gilb.com/store/p71/Competitive_Engineering.html',
  },
}

// ── Computed ──────────────────────────────────────────────────────────────────

const data = computed(() => GLYPH_DATA[props.plType])

// ── SVG Ontology Diagram ──────────────────────────────────────────────────────
// Generates a simple node-link SVG: central type node + up to 4 satellite related-type nodes.
// Arrow direction: → = central→satellite; ← = satellite→central; ↔ = both.

const _CX = 180; const _CY = 100; const _CR = 34; const _SR = 20

const _SAT_POS = [
  { x: 180, y: 32  },   // top
  { x: 320, y: 100 },   // right
  { x: 180, y: 168 },   // bottom
  { x: 40,  y: 100 },   // left
]

function _vecNorm(ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax; const dy = by - ay
  const len = Math.sqrt(dx * dx + dy * dy)
  return { ux: dx / len, uy: dy / len, len }
}

const ontologySvg = computed((): string => {
  const d      = data.value
  const cHex   = GLYPH_HEX[props.plType]
  const rels   = d.relations.slice(0, 4)

  // Unique hex values for arrowhead markers
  const hexSet = new Set([cHex, ...rels.map(r => GLYPH_HEX[r.type])])
  const defs   = [...hexSet].map(h => {
    const id = `a${h.replace('#', '')}`
    return `<marker id="${id}" markerWidth="7" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="${h}" opacity="0.85"/></marker>`
  }).join('')

  const parts = rels.map((rel, i) => {
    const pos  = _SAT_POS[i]
    const sHex = GLYPH_HEX[rel.type]
    const mid  = _vecNorm(_CX, _CY, pos.x, pos.y)

    let lines = ''
    // → : center to satellite
    if (rel.direction === '→' || rel.direction === '↔') {
      const x1 = (_CX + mid.ux * (_CR + 2)).toFixed(1)
      const y1 = (_CY + mid.uy * (_CR + 2)).toFixed(1)
      const x2 = (pos.x - mid.ux * (_SR + 6)).toFixed(1)
      const y2 = (pos.y - mid.uy * (_SR + 6)).toFixed(1)
      lines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${sHex}" stroke-width="1.6" marker-end="url(#a${sHex.replace('#','')})" opacity="0.8"/>`
    }
    // ← : satellite to center (dashed return)
    if (rel.direction === '←' || rel.direction === '↔') {
      const x1 = (pos.x - mid.ux * (_SR + 2)).toFixed(1)
      const y1 = (pos.y - mid.uy * (_SR + 2)).toFixed(1)
      const x2 = (_CX + mid.ux * (_CR + 6)).toFixed(1)
      const y2 = (_CY + mid.uy * (_CR + 6)).toFixed(1)
      const dashOp = rel.direction === '↔' ? '0.42" stroke-dasharray="4 2"' : '0.8"'
      lines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${cHex}" stroke-width="1.4" marker-end="url(#a${cHex.replace('#','')})" opacity="${dashOp}/>`
    }

    // Perpendicular label offset
    const midX = ((_CX + pos.x) / 2)
    const midY = ((_CY + pos.y) / 2)
    const lx   = (midX + (-mid.uy) * 11).toFixed(1)
    const ly   = (midY + mid.ux * 11).toFixed(1)

    return `${lines}
      <circle cx="${pos.x}" cy="${pos.y}" r="${_SR}" fill="${sHex}" fill-opacity="0.88"/>
      <text x="${pos.x}" y="${pos.y}" text-anchor="middle" dominant-baseline="central" font-size="8" font-weight="800" fill="white" font-family="ui-monospace,monospace">${GLYPH_SHORT[rel.type]}</text>
      <text x="${lx}" y="${ly}" text-anchor="middle" font-size="7" fill="#94a3b8" font-family="system-ui,sans-serif">${rel.label}</text>`
  }).join('\n')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 200" style="width:100%;max-width:100%" role="img" aria-label="Ontology: ${d.fullName} and its relations">
  <defs>${defs}</defs>
  <rect width="360" height="200" rx="10" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
  ${parts}
  <circle cx="${_CX}" cy="${_CY}" r="${_CR + 5}" fill="${cHex}" fill-opacity="0.12"/>
  <circle cx="${_CX}" cy="${_CY}" r="${_CR}" fill="${cHex}"/>
  <text x="${_CX}" y="${_CY - 5}" text-anchor="middle" dominant-baseline="central" font-size="11" font-weight="900" fill="white" font-family="ui-monospace,monospace">${d.abbrev}</text>
  <text x="${_CX}" y="${_CY + 10}" text-anchor="middle" font-size="7" fill="rgba(255,255,255,0.7)" font-family="ui-monospace,monospace">${d.notation}</text>
</svg>`
})

// ── History SVG illustrations ─────────────────────────────────────────────────
// One simple inline SVG per type — a stylised visual encoding the historical moment.

const historySvg = computed((): string => {
  switch (props.plType) {
    case 'value':
      // Quality improvement chart: flat US line vs rising Japan line (Deming 1950)
      return `<svg viewBox="0 0 200 90" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:200px" aria-hidden="true">
        <rect width="200" height="90" rx="6" fill="#1e1b4b"/>
        <text x="10" y="14" font-size="7" fill="#a5b4fc" font-family="system-ui">Quality</text>
        <line x1="20" y1="80" x2="20" y2="10" stroke="#6366f1" stroke-width="1.5"/>
        <line x1="20" y1="80" x2="190" y2="80" stroke="#6366f1" stroke-width="1.5"/>
        <polyline points="25,70 65,68 105,67 145,65 185,64" stroke="#ef4444" stroke-width="2" fill="none" stroke-linecap="round"/>
        <text x="145" y="60" font-size="6" fill="#ef4444">US factories</text>
        <polyline points="25,70 55,58 85,44 115,30 150,18" stroke="#a78bfa" stroke-width="2" fill="none" stroke-linecap="round"/>
        <text x="118" y="16" font-size="6" fill="#a78bfa">Japan</text>
        <text x="100" y="88" font-size="6" fill="#6366f1" text-anchor="middle">Time →   1950</text>
      </svg>`
    case 'function':
      // Open/closed switch — binary present/absent
      return `<svg viewBox="0 0 200 90" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:200px" aria-hidden="true">
        <rect width="200" height="90" rx="6" fill="#052e16"/>
        <text x="100" y="12" text-anchor="middle" font-size="7" fill="#86efac" font-family="system-ui">Function = Binary</text>
        <line x1="20" y1="45" x2="55" y2="45" stroke="#86efac" stroke-width="2.5"/>
        <circle cx="58" cy="45" r="4" fill="#86efac"/>
        <line x1="62" y1="30" x2="80" y2="45" stroke="#86efac" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="84" y1="45" x2="120" y2="45" stroke="#4ade80" stroke-width="2.5" stroke-dasharray="6 4"/>
        <text x="70" y="25" font-size="6" fill="#86efac">ABSENT</text>
        <line x1="130" y1="45" x2="165" y2="45" stroke="#16a34a" stroke-width="2.5"/>
        <circle cx="168" cy="45" r="4" fill="#16a34a"/>
        <line x1="172" y1="45" x2="172" y2="45" stroke="#16a34a" stroke-width="2.5"/>
        <line x1="145" y1="45" x2="162" y2="45" stroke="#16a34a" stroke-width="2.5"/>
        <line x1="143" y1="45" x2="160" y2="45" stroke="#4ade80" stroke-width="1" stroke-dasharray="1"/>
        <circle cx="141" cy="45" r="4" fill="#16a34a"/>
        <line x1="115" y1="45" x2="137" y2="45" stroke="#16a34a" stroke-width="2.5"/>
        <line x1="155" y1="45" x2="180" y2="45" stroke="#16a34a" stroke-width="2.5"/>
        <text x="148" y="36" font-size="6" fill="#4ade80">PRESENT</text>
        <text x="100" y="80" text-anchor="middle" font-size="6" fill="#86efac">Ada Lovelace · 1843</text>
      </svg>`
    case 'constraint':
      // Boundary fence — feasible region inside, invalid outside
      return `<svg viewBox="0 0 200 90" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:200px" aria-hidden="true">
        <rect width="200" height="90" rx="6" fill="#1c0202"/>
        <rect x="50" y="15" width="100" height="60" rx="4" fill="#7f1d1d" fill-opacity="0.3" stroke="#dc2626" stroke-width="2" stroke-dasharray="6 3"/>
        <text x="100" y="48" text-anchor="middle" font-size="8" fill="#fca5a5" font-weight="700">Feasible</text>
        <text x="100" y="58" text-anchor="middle" font-size="6" fill="#f87171">Solution Space</text>
        <text x="10" y="30" font-size="6.5" fill="#ef4444">✕ INVALID</text>
        <text x="165" y="30" font-size="6.5" fill="#ef4444">✕</text>
        <text x="10" y="70" font-size="6.5" fill="#ef4444">✕</text>
        <text x="165" y="70" font-size="6.5" fill="#ef4444">✕</text>
        <text x="100" y="85" text-anchor="middle" font-size="6" fill="#dc2626">Dantzig Simplex · 1947</text>
      </svg>`
    case 'solution':
      // Three paths with VDT values — highest selected
      return `<svg viewBox="0 0 200 90" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:200px" aria-hidden="true">
        <rect width="200" height="90" rx="6" fill="#1c0a00"/>
        <circle cx="30" cy="45" r="8" fill="#ea580c"/>
        <line x1="38" y1="38" x2="72" y2="20" stroke="#94a3b8" stroke-width="1.5"/>
        <line x1="38" y1="45" x2="72" y2="45" stroke="#ea580c" stroke-width="2.5"/>
        <line x1="38" y1="52" x2="72" y2="70" stroke="#94a3b8" stroke-width="1.5"/>
        <circle cx="80" cy="20" r="6" fill="#475569"/>
        <text x="88" y="23" font-size="6" fill="#94a3b8">VDT 1.2</text>
        <circle cx="80" cy="45" r="6" fill="#ea580c"/>
        <text x="88" y="48" font-size="6.5" fill="#fb923c" font-weight="700">VDT 3.7 ★</text>
        <circle cx="80" cy="70" r="6" fill="#475569"/>
        <text x="88" y="73" font-size="6" fill="#94a3b8">VDT 2.1</text>
        <line x1="86" y1="45" x2="155" y2="45" stroke="#ea580c" stroke-width="2" marker-end="url(#oa)"/>
        <defs><marker id="oa" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="#ea580c"/></marker></defs>
        <circle cx="160" cy="45" r="8" fill="#ea580c"/>
        <text x="100" y="85" text-anchor="middle" font-size="6" fill="#fb923c">RAND Cost-Effectiveness · 1961</text>
      </svg>`
    case 'stakeholder':
      // Person (¶) with arrows: receives from right, imposes to left; reg/data nodes
      return `<svg viewBox="0 0 200 90" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:200px" aria-hidden="true">
        <rect width="200" height="90" rx="6" fill="#030a1a"/>
        <circle cx="100" cy="30" r="10" fill="#2563eb" fill-opacity="0.8"/>
        <rect x="88" y="42" width="24" height="20" rx="4" fill="#2563eb" fill-opacity="0.8"/>
        <line x1="40" y1="45" x2="88" y2="45" stroke="#60a5fa" stroke-width="1.5" marker-end="url(#sb)"/>
        <text x="24" y="42" font-size="5.5" fill="#93c5fd" text-anchor="middle">Receive</text>
        <text x="24" y="49" font-size="5.5" fill="#93c5fd" text-anchor="middle">Value</text>
        <line x1="112" y1="45" x2="158" y2="45" stroke="#60a5fa" stroke-width="1.5" marker-end="url(#sb)"/>
        <text x="176" y="42" font-size="5.5" fill="#93c5fd" text-anchor="middle">Impose</text>
        <text x="176" y="49" font-size="5.5" fill="#ef4444" text-anchor="middle">C. V. F.</text>
        <circle cx="100" cy="75" r="7" fill="#4f46e5" fill-opacity="0.6"/>
        <text x="100" y="78" text-anchor="middle" font-size="5" fill="white">GDPR</text>
        <line x1="100" y1="62" x2="100" y2="68" stroke="#818cf8" stroke-width="1.2" stroke-dasharray="2 2"/>
        <defs><marker id="sb" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="#60a5fa"/></marker></defs>
        <text x="100" y="88" text-anchor="middle" font-size="5.5" fill="#60a5fa">Freeman 1984 · Gilb inanimate stakeholders</text>
      </svg>`
    case 'evo-step':
      // 9-step Evo cycle arc
      return `<svg viewBox="0 0 200 90" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:200px" aria-hidden="true">
        <rect width="200" height="90" rx="6" fill="#1c1200"/>
        <text x="100" y="10" text-anchor="middle" font-size="6.5" fill="#fbbf24">9-Step Evo Cycle</text>
        ${[1,2,3,4,5,6,7,8,9].map((n, i) => {
          const a = (i / 9) * Math.PI * 2 - Math.PI / 2
          const cx = 100 + Math.cos(a) * 34
          const cy = 50 + Math.sin(a) * 30
          const isPC = n <= 5
          const fill = isPC ? '#78350f' : '#92400e'
          const textFill = isPC ? '#fcd34d' : '#fbbf24'
          return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="9" fill="${fill}" stroke="#fbbf24" stroke-width="${n===8||n===9?'1.8':'0.8'}"/><text x="${cx.toFixed(1)}" y="${(cy+2).toFixed(1)}" text-anchor="middle" font-size="7" fill="${textFill}" font-weight="700">${n}</text>`
        }).join('')}
        <text x="100" y="84" text-anchor="middle" font-size="5.5" fill="#fbbf24">Tom Gilb Software Metrics · 1976</text>
      </svg>`
    case 'task':
      // Gantt chart — 4 horizontal task bars
      return `<svg viewBox="0 0 200 90" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:200px" aria-hidden="true">
        <rect width="200" height="90" rx="6" fill="#0c0c10"/>
        <text x="100" y="10" text-anchor="middle" font-size="6.5" fill="#94a3b8">Task Decomposition (Gantt · 1910)</text>
        ${[
          { y:20, x:30, w:80, done:true,  label:'Task 1 ✓' },
          { y:35, x:30, w:55, done:true,  label:'Task 2 ✓' },
          { y:50, x:45, w:70, done:false, label:'Task 3' },
          { y:65, x:70, w:50, done:false, label:'Task 4' },
        ].map(t => `<rect x="${t.x}" y="${t.y}" width="${t.w}" height="10" rx="2" fill="${t.done ? '#374151' : '#1e293b'}" stroke="${t.done ? '#6b7280' : '#334155'}" stroke-width="1"/>
          <text x="${t.x+4}" y="${t.y+8}" font-size="6" fill="${t.done ? '#9ca3af' : '#64748b'}">${t.label}</text>`).join('')}
        <line x1="30" y1="15" x2="30" y2="78" stroke="#475569" stroke-width="1" stroke-dasharray="2 2"/>
      </svg>`
    case 'resource':
      // Beaker/pool depleting — initial fill, allocated out, remaining
      return `<svg viewBox="0 0 200 90" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:200px" aria-hidden="true">
        <rect width="200" height="90" rx="6" fill="#052e16"/>
        <text x="100" y="10" text-anchor="middle" font-size="6.5" fill="#86efac">Resource Pool (Brooks · 1975)</text>
        <rect x="60" y="18" width="40" height="55" rx="3" fill="#166534" fill-opacity="0.4" stroke="#16a34a" stroke-width="1.5"/>
        <rect x="60" y="18" width="40" height="22" rx="3" fill="#dc2626" fill-opacity="0.4"/>
        <text x="80" y="32" text-anchor="middle" font-size="5.5" fill="#fca5a5">Used</text>
        <rect x="60" y="42" width="40" height="31" rx="0 0 3 3" fill="#16a34a" fill-opacity="0.6"/>
        <text x="80" y="62" text-anchor="middle" font-size="5.5" fill="#86efac">Remain</text>
        <line x1="100" y1="18" x2="130" y2="18" stroke="#6b7280" stroke-width="1" stroke-dasharray="3 2"/>
        <text x="134" y="21" font-size="5.5" fill="#6b7280">Initial</text>
        <line x1="100" y1="42" x2="130" y2="42" stroke="#ef4444" stroke-width="1"/>
        <text x="134" y="45" font-size="5.5" fill="#ef4444">Consumed</text>
        <text x="100" y="84" text-anchor="middle" font-size="6" fill="#86efac">Non-fungible · Brooks Law</text>
      </svg>`
    default:
      return ''
  }
})

// ── Keyboard ──────────────────────────────────────────────────────────────────

function _onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.stopPropagation()
    emit('close')
  }
}

onMounted(() => document.addEventListener('keydown', _onKeydown, { capture: true }))
onUnmounted(() => document.removeEventListener('keydown', _onKeydown, { capture: true }))
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <div
      class="fixed inset-0 z-[650] bg-black/60 backdrop-blur-sm"
      aria-hidden="true"
      @click="emit('close')"
    />

    <!-- Panel -->
    <div
      class="fixed inset-0 z-[651] flex items-start justify-center overflow-y-auto py-10 px-4"
      role="dialog"
      aria-modal="true"
      :aria-label="`${data.fullName} — Planguage glyph reference`"
    >
      <div class="w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl ring-1 ring-black/20">

        <!-- ── Header: big glyph + type identity ──────────────────────── -->
        <div
          class="relative px-6 py-5 flex items-center gap-5"
          :style="{ background: `linear-gradient(135deg, ${data.hex}22 0%, #0f172a 100%)`,
                    borderBottom: `2px solid ${data.hex}44` }"
        >
          <!-- Neon-glow glyph (xl) -->
          <div
            class="shrink-0 p-3 rounded-xl bg-black/30"
            :style="{ filter: `drop-shadow(0 0 14px ${data.hex})` }"
            aria-hidden="true"
          >
            <PlTypeIcon :pl-type="plType" size="xl" :no-detail-click="true" />
          </div>

          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap mb-1">
              <span
                class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-extrabold font-mono"
                :class="data.badgeClass"
              >{{ data.abbrev }}</span>
              <span
                class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold font-mono
                       bg-white/10 text-white/80 tracking-widest"
                :title="data.notationHint"
              >{{ data.notation }}</span>
            </div>
            <h2 class="text-xl font-extrabold text-white leading-tight">{{ data.fullName }}</h2>
            <p class="text-xs text-white/50 mt-0.5 italic leading-tight">{{ data.notationHint }}</p>
          </div>

          <!-- Close -->
          <div class="absolute top-3 right-4">
            <CloseDot variant="on-dark" aria-label="Close glyph reference panel" @click="emit('close')" />
          </div>
        </div>

        <!-- ── Body ────────────────────────────────────────────────────── -->
        <ScrollContainer
          outer-class="bg-slate-50"
          inner-class="p-5 space-y-5"
          :style="{ maxHeight: '76vh' }"
        >

          <!-- ── § 1 GLYPH ANATOMY ─────────────────────────────────────── -->
          <section aria-labelledby="gdp-anatomy">
            <h3 id="gdp-anatomy"
                class="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400 mb-2">
              Glyph Anatomy — Keyed Notation
            </h3>
            <!-- Keyed notation display (mono, dark) -->
            <div
              class="flex items-center justify-center gap-1 px-4 py-3 rounded-xl mb-3 font-mono"
              :style="{ background: '#0f172a', border: `1.5px solid ${data.hex}44` }"
              aria-hidden="true"
            >
              <span
                class="text-3xl font-extrabold tracking-widest"
                :style="{ color: data.hex, textShadow: `0 0 16px ${data.hex}80` }"
              >{{ data.notation }}</span>
            </div>
            <!-- Part-by-part breakdown -->
            <div class="space-y-1.5">
              <div
                v-for="part in data.keyedParts"
                :key="part.chars"
                class="flex items-start gap-2.5"
              >
                <span
                  class="shrink-0 inline-flex items-center justify-center w-10 h-6 rounded-md
                         text-[13px] font-extrabold font-mono"
                  :style="{ background: data.hex + '15', color: data.hex, border: `1px solid ${data.hex}30` }"
                >{{ part.chars }}</span>
                <p class="text-[11px] text-slate-600 leading-snug pt-0.5">{{ part.meaning }}</p>
              </div>
            </div>
            <!-- Color Glyph as artistic rendition (captioned) -->
            <div class="mt-3 flex items-center gap-3 px-3 py-2 rounded-lg bg-white ring-1 ring-black/8">
              <div
                class="shrink-0"
                :style="{ filter: `drop-shadow(0 0 6px ${data.hex}70)` }"
                aria-hidden="true"
                title="Color Glyph — the artistic, colored rendition of the keyed notation above"
              >
                <PlTypeIcon :pl-type="plType" size="lg" :no-detail-click="true" />
              </div>
              <p class="text-[11px] text-slate-500 italic leading-snug">
                Color Glyph — the artistic rendition of <span class="font-mono font-bold not-italic" :style="{ color: data.hex }">{{ data.notation }}</span>,
                rendered in the canonical {{ data.fullName }} color for visual identification in the SEM App.
              </p>
            </div>
          </section>

          <!-- ── § 2 PLANGUAGE CONNECTION ──────────────────────────────── -->
          <section aria-labelledby="gdp-connection">
            <h3 id="gdp-connection"
                class="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400 mb-2">
              Planguage Connection — S·E·M Position
            </h3>
            <div class="px-3 py-2.5 rounded-xl bg-white ring-1 ring-black/8 space-y-1.5">
              <p
                class="text-[11px] font-bold leading-snug"
                :style="{ color: data.hex }"
              >{{ data.semPosition }}</p>
              <p class="text-sm text-slate-700 leading-relaxed">{{ data.definition }}</p>
            </div>
          </section>

          <!-- ── § 3 ONTOLOGY DIAGRAM ──────────────────────────────────── -->
          <section aria-labelledby="gdp-ontology">
            <h3 id="gdp-ontology"
                class="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400 mb-2">
              Ontology — Relational Map
            </h3>
            <!-- SVG diagram -->
            <div
              class="rounded-xl overflow-hidden ring-1 ring-black/8 mb-2"
              v-html="ontologySvg"
              aria-hidden="true"
            />
            <!-- Clickable relation chips (navigate to related type) -->
            <div class="flex flex-wrap gap-2">
              <button
                v-for="rel in data.relations"
                :key="rel.type"
                type="button"
                class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
                       bg-white ring-1 ring-black/10 shadow-sm
                       hover:ring-indigo-400 hover:shadow-md transition-all
                       focus:outline-none focus:ring-2 focus:ring-indigo-400 text-left"
                :title="`${data.fullName} ${rel.direction} ${rel.label} → ${GLYPH_DATA[rel.type].fullName} — click to view`"
                @click="emit('show-glyph', rel.type)"
              >
                <span class="text-[10px] font-mono text-slate-400 select-none">{{ rel.direction }}</span>
                <PlTypeIcon :pl-type="rel.type" size="sm" :no-detail-click="true" />
                <div>
                  <span class="text-[10px] text-slate-400 leading-none block">{{ rel.label }}</span>
                  <span class="text-xs font-semibold text-slate-700 leading-tight">{{ GLYPH_DATA[rel.type].fullName }}</span>
                </div>
              </button>
            </div>
          </section>

          <!-- ── § 4 GLOSSARY TERMS ────────────────────────────────────── -->
          <section aria-labelledby="gdp-glossary">
            <h3 id="gdp-glossary"
                class="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400 mb-2">
              Planguage Glossary — Key Terms
            </h3>
            <div class="divide-y divide-slate-100 rounded-xl overflow-hidden ring-1 ring-black/8 bg-white">
              <div
                v-for="term in data.glossaryTerms"
                :key="term.term"
                class="flex items-start gap-2 px-3 py-2"
              >
                <span
                  class="shrink-0 inline-block mt-0.5 px-1.5 py-0.5 rounded font-mono text-[9px] font-extrabold whitespace-nowrap"
                  :style="{ background: data.hex + '15', color: data.hex }"
                >{{ term.abbrev }}</span>
                <div>
                  <span class="text-[11px] font-bold text-slate-700">{{ term.term }}</span>
                  <p class="text-[10px] text-slate-500 leading-snug mt-0.5">{{ term.definition }}</p>
                </div>
              </div>
            </div>
          </section>

          <!-- ── § 5 EXAMPLE ───────────────────────────────────────────── -->
          <section aria-labelledby="gdp-example">
            <h3 id="gdp-example"
                class="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400 mb-2">
              Example — Planguage Syntax
            </h3>
            <pre
              class="text-[11px] font-mono text-slate-700 bg-white rounded-xl px-4 py-3
                     ring-1 ring-black/8 overflow-x-auto whitespace-pre-wrap leading-relaxed"
            >{{ data.example }}</pre>
          </section>

          <!-- ── § 6 HISTORY ───────────────────────────────────────────── -->
          <section aria-labelledby="gdp-history">
            <h3 id="gdp-history"
                class="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400 mb-2">
              History — Origin of the Concept
            </h3>
            <div class="bg-white rounded-xl ring-1 ring-black/8 overflow-hidden">
              <div class="flex items-start gap-3 px-4 pt-3 pb-1">
                <!-- SVG illustration -->
                <div
                  class="shrink-0"
                  v-html="historySvg"
                  aria-hidden="true"
                />
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5 mb-1">
                    <span
                      class="inline-block px-2 py-0.5 rounded-full text-[9px] font-extrabold"
                      :style="{ background: data.hex, color: 'white' }"
                    >{{ data.history.year }}</span>
                    <span class="text-[11px] font-bold text-slate-700">{{ data.history.who }}</span>
                  </div>
                  <p class="text-[11px] text-slate-700 leading-snug font-medium">{{ data.history.what }}</p>
                </div>
              </div>
              <p class="text-[10px] text-slate-500 leading-relaxed px-4 pb-3 pt-1">{{ data.history.context }}</p>
            </div>
          </section>

          <!-- ── § 7 NERD JOKE ─────────────────────────────────────────── -->
          <section aria-labelledby="gdp-joke">
            <h3 id="gdp-joke"
                class="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400 mb-2">
              The Nerd's Corner
            </h3>
            <div
              class="px-4 py-3 rounded-xl ring-1 text-[11px] text-slate-600 leading-relaxed italic"
              :style="{ background: data.hex + '08', borderColor: data.hex + '30', borderWidth: '1px', borderStyle: 'solid' }"
            >
              <span class="not-italic font-extrabold text-lg mr-1" aria-hidden="true">😂</span>
              {{ data.joke }}
            </div>
          </section>

          <!-- ── § 8 SOURCE ────────────────────────────────────────────── -->
          <section aria-labelledby="gdp-source">
            <h3 id="gdp-source"
                class="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400 mb-2">
              Source
            </h3>
            <p class="text-xs text-slate-600 leading-relaxed">{{ data.citation }}</p>
            <a
              :href="data.url"
              target="_blank"
              rel="noopener noreferrer"
              class="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600
                     hover:text-indigo-800 hover:underline focus:outline-none focus-visible:ring-2
                     focus-visible:ring-indigo-400 rounded"
            >
              <span aria-hidden="true">🔗</span> More at gilb.com
              <span class="text-[10px] text-slate-400 font-normal" aria-label="opens in new tab">(↗)</span>
            </a>
          </section>

        </ScrollContainer>
      </div>
    </div>
  </Teleport>
</template>
