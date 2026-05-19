// useAboutPriorityGlyph.ts — Source-of-truth content for the "About the
// Priority Glyph" panel that opens when the user clicks the `?` info
// affordance attached to the Priority keyed icon `[A>B>C]`.
//
// Mirrors verbatim:
//   /Users/Tomgilbs/Documents/MyVault/5 - Project/SEM App/03Execution/Priority-Icon-About.md
//
// The vault doc is the canonical record (so the text survives a code reset).
// This file ships the same content to the bundle so the panel can render
// offline and so Copy + Email actions work without a fetch.

export interface PriorityAboutSection {
  /** Short heading shown as a card title in the panel. */
  heading: string
  /** Body paragraphs. Each entry is one paragraph. */
  paragraphs: string[]
  /** Optional bullet list rendered under the paragraphs. Each entry: ["term", "definition"]. */
  bullets?: Array<{ term?: string; text: string }>
}

/** Title shown in the panel header and used for Email subject + Copy preamble. */
export const PRIORITY_GLYPH_TITLE = 'The SEM App Priority Glyph — `[A>B>C]`'

/** One-line subtitle / dek shown under the title. */
export const PRIORITY_GLYPH_SUBTITLE
  = 'A Planguage keyed icon for bounded-system priority: brackets carry the envelope, the chain carries transitivity.'

/** Authoritative content, section-by-section. */
export const PRIORITY_GLYPH_SECTIONS: PriorityAboutSection[] = [
  {
    heading: '1. Interpretation of the Icon',
    paragraphs: [
      '`[A>B>C]` reads as "within the bounded system marked by these brackets, A outranks B, and B outranks C." Every part of the glyph carries meaning.',
      'The brackets `[ ]` are not decorative. They mark the envelope of validity — the set of assumptions, constraints, authority, and scope inside which the priority claim is true. Outside the brackets, the ordering does not necessarily hold; the same three items might reverse, equalise, or dissolve under different assumptions, a different authority\'s domain, or a different resource regime. The brackets are the systems-engineering hygiene principle that distinguishes Planguage priority from a generic ranking widget: a priority claim without a stated envelope is, in Planguage terms, aesthetic ranking rather than priority engineering.',
      'The same `[ ]` glyph appears elsewhere in Planguage — bounding the Survival lower- and upper-marks on the Priority Level number line (`[a→→b→c→]d`), and unifying the four scoping keywords Assumption, Constraint, Authority, Scope. One bracket semantics across the whole language.',
      'The chevron `>` is rendered without a shaft — just the angle, not an arrow. This is a deliberate visual rule that distinguishes the priority comparator (a static relation: "A outranks B") from the Save/Get arrow `*→[*]` / `[*]→*` (an action: "put thing into vessel"). Both are members of the Planguage keyed-icon family; the absence or presence of the shaft tells you which verb-category you are looking at.',
      'The triple A > B > C is intentional, not arbitrary. Three is the smallest set that demonstrates transitivity: if A>B and B>C then A>C. The triple also matches Planguage\'s other ternary structures — the Priority Signal categories (Local / Environmental / Inherited) and the Priority Level zones (Survival / Fail / Goal). And it reflects that KaiZen and Patents, the two practical contexts in which this icon was minted, both operate primarily on three-or-more-level relationships.',
      'The compact pairwise form `[A>B]` exists only as a typographic fallback for slots too small for the triple. Semantically the triple is canonical.',
    ],
  },
  {
    heading: '2. Invention of the Icon',
    paragraphs: [
      'The `[A>B>C]` keyed icon was invented by Tom Gilb on 2026-05-13, in dialogue with the SEM App design log, as a member of the same keyed-icon family as the Save/Get glyph `*→[*]` / `[*]→*` (DD-001, same day). It is © Tom Gilb, 2026, and is offered as a Planguage glossary entry under the same open-use terms as the rest of the Planguage standard.',
      'The icon emerged from three accumulating frames in a single design conversation:',
    ],
    bullets: [
      { text: '"ok so I am interested in [A > B], and also [A > B>C] because 1. I veiw the square brackets as constraint symbois (within constraint). I a also interested int he triple, because a main feature of our tools (KaiZen, and Patents) is the relationship of multiple levels (3 or more specifically) and that nails it."' },
      { text: '"the brackets contrint, also signify an importent systems engineering idea, in Planguage: The notion of A>B can only hold true in a bounded system (under asumptions and contraints, and not necessarily, outside those [ ] s."' },
      { text: '"it is generic, any part of priority processes."' },
    ],
  },
  {
    heading: '3a. Multiple levels of priority',
    paragraphs: [
      'A single specification rarely has one priority — it carries a graded set of targets along the Priority Level number line. The five canonical level classes are:',
    ],
    bullets: [
      { term: 'Survival', text: 'the level below which the system is non-viable; failure to meet Survival is catastrophic' },
      { term: 'Fail', text: 'the level below which the system is in active defect; remediation is mandatory' },
      { term: 'Goal', text: 'the planned target; the level we are aiming for' },
      { term: 'Stretch', text: 'an ambitious upside target; success here is a win' },
      { term: 'Wish', text: 'the level we would take if the universe were generous' },
    ],
  },
  {
    heading: '3a. (continued)',
    paragraphs: [
      'These levels coexist within the same specification, each carrying its own implicit priority claim: Survival outranks Fail outranks Goal outranks Stretch outranks Wish within the same attribute. Across attributes, an explicit `Priority:` keyed-icon ordering decides.',
      'The bracketed Survival markers `[a→→b→c→]d` on the Priority Level number line use the same `[ ]` semantics as `[A>B>C]` — the brackets bound the validity envelope.',
    ],
  },
  {
    heading: '3b. Each planner\'s own attribute set — open by design',
    paragraphs: [
      'A priority claim is rarely along a single dimension — and crucially, Planguage does not prescribe what those dimensions are. There is no fixed, static, canonical set of value or cost factors that determines priority in Planguage. Each planner specifies their own set, and maintains it as the plan evolves. This is a deliberate design choice in the language, not an omission to be patched.',
      'The SEM App is built precisely to support this: you author your own attributes, your own scales, your own targets, your own costs — and the priority calculus operates over your set, not a textbook\'s. The app is the tool through which a planner expresses, refines, and re-balances their own attribute set over time.',
      'Books and frameworks do supply example dimensions to think with. Priority Engineering (Tom Gilb, 2026) catalogues many:',
    ],
    bullets: [
      { term: 'Implementation Speed', text: 'how quickly value is delivered' },
      { term: 'Plan-and-Work-Process Learning', text: 'how much the team learns through doing' },
      { term: 'Risk Management', text: 'reducing exposure to identified risks' },
      { term: 'Product Quality', text: 'measurable quality attributes of the deliverable' },
      { term: 'Cost-to-Completion', text: 'total resources to finish' },
      { term: 'Operational Costs', text: 'ongoing costs after delivery' },
      { term: 'Usability', text: 'how easily intended users can use the result' },
      { term: 'Security', text: 'resistance to compromise' },
      { text: '…and any other qualities or costs the planner cares about — extended, replaced, or pruned by each planner for their own envelope.' },
    ],
  },
  {
    heading: '3b. (continued)',
    paragraphs: [
      'These are starter material — vocabulary a planner can draw on, extend, or replace entirely — never a closed list. Tom\'s other writings extend the same open frame to power, wealth, regulatory authority, attractiveness, and many more.',
      'The practical consequence: when you write a priority claim `[A > B]`, you should be able to say on what dimension, drawn from your own attribute set. "A > B in regulatory authority" is a different claim from "A > B in attractiveness to investors" is a different claim from "A > B in cost-effectiveness." All three may be true simultaneously; or they may conflict; and the conflict itself is engineering information.',
      'This open-by-design property is the reason the brackets in `[A>B>C]` are load-bearing: they bound the envelope (assumptions, constraints, authority, scope) under which this particular planner\'s attribute ordering holds. A different planner with a different attribute set will inhabit a different envelope, and that is exactly as it should be.',
    ],
  },
  {
    heading: '3c. Priority is alignment with values × costs, within constraints',
    paragraphs: [
      'The Planguage formula in nutshell: priority is a function of how well a claim aligns with stated values, weighed against stated costs, and bounded by stated constraints.',
    ],
    bullets: [
      { term: 'Values', text: 'the qualities the system is trying to achieve, expressed quantitatively (Scale, Meter, Past, Tolerable, Goal, Stretch, Wish parameters)' },
      { term: 'Costs', text: 'the resources a claim consumes (budget, engineering time, schedule, opportunity)' },
      { term: 'Constraints', text: 'the envelope from which the brackets [ ] draw their semantics: Assumption, Constraint, Authority, Scope' },
    ],
  },
  {
    heading: '3c. (continued)',
    paragraphs: [
      'A claim that delivers more value at less cost has higher priority within the current constraint envelope. Change the envelope, change the priority. This is why the brackets are load-bearing.',
      'The Impact Estimation Table (IET) — Tom Gilb\'s "magic calculator" — is the computational form of this idea: a matrix that scores each candidate solution against each value attribute, divided by its cost, summed and ranked. The IET makes priority computable from facts rather than declared from preference.',
    ],
  },
  {
    heading: '3d. Priority is dynamic — it changes as the factors change',
    paragraphs: [
      'The most subtle and most important point: priority is a computed quantity, not a static label. As any factor in the formula moves, the priority shifts — even if no human acts on the shift.',
      'If a stakeholder\'s stated value changes, priority shifts. If a cost estimate is revised, priority shifts. If a constraint relaxes or tightens, priority shifts. If new evidence updates an attribute score in the IET, priority shifts. The system can therefore report its current priority ordering at any moment, derived from the live values of the inputs, without anyone having to re-rank manually.',
      'This is the Value Decision Table (VDT) / IET working principle: priority is a function, not a fact. The display can update in real time; the audit trail records every input change and the resulting priority change. Acting on the new priority is a separate, human decision — but the new priority is known and visible the instant its inputs move.',
      'The `[A>B>C]` keyed icon represents the current state of this function: the ordering valid right now, inside the brackets, under the current inputs. It is a snapshot of a computation, not a frozen rank.',
    ],
  },
  {
    heading: '4. Sources & further reading',
    paragraphs: [
      'In-vault decision record: design-decisions.md DD-002 — three Tom-quote ratifications, four-question resolutions, weighted-bracket design rationale, no-shaft chevron rule.',
      'In-vault background: Priority-history-background.md — etymology of "priority," management-science ancestors (Eisenhower, Drucker, CPM/PERT), the ranking-methods landscape (QFD → AHP → Kano → BSC → MoSCoW → WSJF → RICE), Planguage\'s three moves, and where this icon sits in the trajectory.',
      'Planguage glossary: Priority *112 (this concept), Priority-Level *471 (the level classes), Priority-Signal *515 (the attribute mechanism).',
      'Book: Priority Engineering by Tom Gilb (2026), in vault assets. Used as example material for §3b only — Planguage is open on the attribute axis by design; the book offers vocabulary, never a closed taxonomy. https://www.researchgate.net/publication/397223456_Priority_Engineering',
      'Sister keyed icon: the Save/Get `*→[*]` family — same Planguage keyed-icon tradition, action-arrow rather than static-comparator. See "About the Save Glyph" for the parallel writeup.',
    ],
  },
]

/** Flat-string builder for clipboard + mailto body. */
export function getAboutPriorityGlyphText(): string {
  const lines: string[] = []
  lines.push(PRIORITY_GLYPH_TITLE)
  lines.push(PRIORITY_GLYPH_SUBTITLE)
  lines.push('')
  for (const section of PRIORITY_GLYPH_SECTIONS) {
    lines.push(section.heading)
    lines.push('')
    for (const p of section.paragraphs) {
      lines.push(p)
      lines.push('')
    }
    if (section.bullets) {
      for (const b of section.bullets) {
        lines.push(b.term ? `  • ${b.term} — ${b.text}` : `  • ${b.text}`)
      }
      lines.push('')
    }
  }
  return lines.join('\n').trim() + '\n'
}

/** URI-encoded mailto URL with subject + body pre-filled. */
export function buildAboutPriorityGlyphMailto(): string {
  const subject = encodeURIComponent('The SEM App Priority Glyph — [A>B>C]')
  const body = encodeURIComponent(getAboutPriorityGlyphText())
  return `mailto:?subject=${subject}&body=${body}`
}
