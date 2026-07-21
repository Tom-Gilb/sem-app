// UNIT_TYPE=Composable
// useIncorruptibleSharpSynthesis.ts — Synthesise IncorruptibleFinding-shaped fixes from
// answered Sharpening questions. Phase 2a: deterministic template-based synthesis.
// Phase 2c (later): Claudian-mediated synthesis for richer Planguage edits.
//
// The synthesis output reuses the existing IncorruptibleFinding shape so applyIncorruptibleFix
// (r93q, r93s source-stamping, r93u accept-state, r93v Universal Undo) all work unchanged.

import type {
  IncorruptibleFinding,
  IncorruptibleCategory,
} from '../types/incorruptible'
import type { IncorruptibleSharpCategory } from '../data/incorruptibleSharpInterview'
import type { SpecBlock } from '../types/spec'

/** One answered question — text answer + selected suggestion indexes. */
export interface AnsweredQuestion {
  categoryId: IncorruptibleCategory
  questionId: string
  /** The category context for synthesis. */
  category: IncorruptibleSharpCategory
  /** Free-text answer the user typed (may be empty). */
  answer: string
  /** Indexes of suggested answers the user ticked (drives synthesis). */
  selectedSuggestionIndexes: number[]
}

/**
 * Map each category to its canonical fix-type so the synthesised finding routes through
 * the existing applyIncorruptibleFix machinery (r93q) with full source-stamping (r93s).
 */
// r93ff — fix-type mapping updated so every category produces a fix that ACTUALLY clears
// the original deterministic finding (Tom Gilb 2026-06-11 "i applied fixes but i could
// not see change in score or other consequence"):
//   - founder-vision-erosion: was add-source-charter (no detector impact); now add-wish
//     (sets V.wish > 1.5× Goal so the Wish ≈ Goal pattern detector clears)
//   - innovation-budget-predation: was add-constraint (no R. added); now add-resource
//     (appends an R. tagged "innovation" so the detector finds the floor)
const CATEGORY_FIX_TYPE: Record<IncorruptibleCategory,
  'add-wish' | 'add-stakeholder' | 'add-constraint' | 'add-source-charter' | 'raise-goal-when' | 'add-governance-cadence' | 'add-resource'
> = {
  'quarterly-tyranny':           'add-wish',
  'stakeholder-monoculture':     'add-stakeholder',
  'mission-drift':               'add-constraint',
  'founder-vision-erosion':      'add-wish',           // r93ff: was add-source-charter
  'innovation-budget-predation': 'add-resource',       // r93ff: was add-constraint
  'governance-hole':             'add-governance-cadence',
}

/** Per-category principle label inscribed into the synthesised finding. */
const CATEGORY_PRINCIPLE: Record<IncorruptibleCategory, string> = {
  'quarterly-tyranny':           'Long-horizon counterweight (user-sharpened) — Ries Coherence pillar',
  'stakeholder-monoculture':     'Multi-stakeholder accountability (user-sharpened) — Ries Integrity pillar',
  'mission-drift':               'Mission as Constraint (user-sharpened) — Ries Purpose pillar',
  'founder-vision-erosion':      'Transformational Wish (user-sharpened) — Ries Purpose pillar',
  'innovation-budget-predation': 'Innovation budget as floor (user-sharpened) — Ries Coherence pillar',
  'governance-hole':             'Explicit accountability cadence (user-sharpened) — Ries Compliance pillar',
}

// ────────────────────────────────────────────────────────────────────────────
// RIES_FIGURE_5_1 — canonical rule framework for Incorruptible.
//
// Source: Eric Ries, *Incorruptible: Why Good Companies Go Bad... and How
// Great Companies Stay Great* (2026), Figure 5.1 p. 91. Tom Gilb 2026-06-13:
// "feed this to rules for incorruptible, from Ries book Figure 5.1".
//
// The figure shows a blueprint with TWO governing axes and FOUR pillars.
// Every Incorruptible defect category is mapped to exactly ONE pillar so the
// synthesised finding cites the canonical principle — and the user is taught
// WHY the defect matters in the Ries framework.
//
// AXES (vertical-arrow pair at the top of the blueprint):
//   - "Create Something Worth Protecting" (WHY pole — Purpose + Coherence)
//   - "Build with Structural Integrity"   (HOW pole — Integrity + Compliance)
//
// FOUR PILLARS:
//   1. PURPOSE     — Choose a mission aligned with human flourishing and an
//                    ethos that instills a determination to achieve it.
//                    Chapters 5 (The Blueprint) + 6 (Harder Is Easier).
//   2. COHERENCE   — When mission and business model reinforce each other,
//                    they create a virtuous performance cycle where doing the
//                    right thing drives superior results.
//                    Chapters 7 (Mission Drive) + 8 (The Invisible Leader).
//   3. INTEGRITY   — High-integrity organisations make promises that others
//                    can believe, even in the face of hostile outside pressures.
//                    Chapters 9 (Constitutional Governance) + 10 (Constellation
//                    View) + 11 (Spiritual Holding Company).
//   4. COMPLIANCE  — Following laws, preventing self-dealing, reporting
//                    accurately, and holding management accountable are
//                    essential oversight skills. The governance class has
//                    developed tremendous skill in these areas; build upon it.
// ────────────────────────────────────────────────────────────────────────────

export type RiesPillar = 'purpose' | 'coherence' | 'integrity' | 'compliance'
export type RiesAxis   = 'create-something-worth-protecting' | 'build-with-structural-integrity'

export interface RiesFigure51PillarSpec {
  pillar:    RiesPillar
  axis:      RiesAxis
  title:     string
  blueprint: string
  chapters:  string[]
}

export const RIES_FIGURE_5_1: Record<RiesPillar, RiesFigure51PillarSpec> = Object.freeze({
  purpose: {
    pillar: 'purpose',
    axis:   'create-something-worth-protecting',
    title:  'Purpose',
    blueprint:
      'Choose a mission aligned with human flourishing and an ethos that ' +
      'instils a determination to achieve it.',
    chapters: ['Ch.5 — The Blueprint', 'Ch.6 — Harder Is Easier'],
  },
  coherence: {
    pillar: 'coherence',
    axis:   'create-something-worth-protecting',
    title:  'Coherence',
    blueprint:
      'When mission and business model reinforce each other, they create a ' +
      'virtuous performance cycle where doing the right thing drives ' +
      'superior results.',
    chapters: ['Ch.7 — Mission Drive', 'Ch.8 — The Invisible Leader'],
  },
  integrity: {
    pillar: 'integrity',
    axis:   'build-with-structural-integrity',
    title:  'Integrity',
    blueprint:
      'High-integrity organisations make promises that others can believe, ' +
      'even in the face of hostile outside pressures.',
    chapters: [
      'Ch.9 — Constitutional Governance',
      'Ch.9 — Implementation Guide: The Legal Architecture (companion, v1.0, 2026-05-26)',
      'Ch.10 — The Constellation View',
      'Ch.11 — The Spiritual Holding Company',
    ],
  },
  compliance: {
    pillar: 'compliance',
    axis:   'build-with-structural-integrity',
    title:  'Compliance',
    blueprint:
      'Following laws, preventing self-dealing, reporting accurately, and ' +
      'holding management accountable are essential oversight skills. The ' +
      'governance class has developed tremendous skill in the past century ' +
      'in these areas, and we should build upon it.',
    // r41 v188 (Tom Gilb 2026-06-18) — Ch.9 Implementation Guide ingested.
    // Figure 5.1 places Ch.9 under Integrity, but in practice Ch.9 IS the
    // compliance architecture (DGCL § 362 PBC statute, Biennial Benefit
    // Statement § 366(b), Quorum & Approval thresholds, DCE accountability).
    // Point Compliance at Ch.9 too — Ries' framework treats Compliance and
    // Integrity as adjacent sides of the same structural seam.
    chapters: ['Ch.9 — Implementation Guide: The Legal Architecture'],
  },
})

/**
 * Maps every SEM Incorruptible defect category to ONE Ries pillar.
 * Every synthesised finding cites the pillar so the planner is taught the
 * principle behind the fix — composes with the SEM-Teaches-Incrementally
 * SUPREME rule and Conjunction-of-Technologies citation discipline.
 */
export const CATEGORY_RIES_PILLAR: Record<IncorruptibleCategory, RiesPillar> = Object.freeze({
  'quarterly-tyranny':           'coherence',  // mission ↔ business-model time-horizon coherence
  'stakeholder-monoculture':     'integrity',  // believable promises across ALL stakeholders
  'mission-drift':               'purpose',    // mission protected from drift
  'founder-vision-erosion':      'purpose',    // founder's mission ethos restored
  'innovation-budget-predation': 'coherence',  // mission vs short-term-budget coherence
  'governance-hole':             'compliance', // accountability cadence is core compliance
})

/** Convenience accessor — returns the full pillar spec for a defect category. */
export function riesPillarForCategory(c: IncorruptibleCategory): RiesFigure51PillarSpec {
  return RIES_FIGURE_5_1[CATEGORY_RIES_PILLAR[c]]
}

// ────────────────────────────────────────────────────────────────────────────
// RIES_PASSAGES — passage-level citations from Ries' Incorruptible, cumulated
// as Tom reads.  Each entry is verbatim source + chapter + page + pillar
// mapping + a canonical citation string ready to drop into riesCitation fields.
//
// Cumulation rule: every new Tom-shared passage from the book lands here AND
// gets a matching MD file under `.claude/ries-incorruptible-rules/`.  See
// `rule_ries_incorruptible_cumulation.md` in memory for the workflow.
// ────────────────────────────────────────────────────────────────────────────

export interface RiesPassageComponent {
  number: number
  label:  string
  text:   string
  pillar: RiesPillar
}

export interface RiesPassage {
  verbatim:         string
  book:             string
  page:             number
  chapter:          string
  primaryPillar:    RiesPillar
  secondaryPillar?: RiesPillar
  citation:         string
  /** r27 — optional named concept this passage defines (e.g. "Harder Is Easier") */
  name?:            string
  /** r27 — optional structured decomposition for multi-part principles (e.g. the
   *  three-part definition of harder-is-easier on p.114).  Each component can
   *  map to a different Figure 5.1 pillar; the passage's primaryPillar is the
   *  HOLISTIC pillar (chapter assignment per Figure 5.1).  Per-component pillars
   *  are useful for scoring a defect that violates a SUBSET of the components. */
  components?:      RiesPassageComponent[]
}

export const RIES_PASSAGES: Record<string, RiesPassage> = Object.freeze({
  /**
   * Ch.6 p.100 — Causal mechanism behind the Coherence pillar.
   * Ingested 2026-06-13.  See `01-chapter-6-p100-flourishing-metrics.md`.
   * Proposed (NOT yet wired) new defect category: `flourishing-metric-gap`.
   */
  'p100-flourishing-metrics': {
    verbatim:        'Metrics aligned with human flourishing consistently drive tomorrow\'s financial indicators.',
    book:            'Eric Ries, Incorruptible (2026)',
    page:            100,
    chapter:         'Ch.6 — Harder Is Easier',
    primaryPillar:   'coherence',
    secondaryPillar: 'purpose',
    citation:        '[Ries Incorruptible · p.100 · Ch.6 Harder Is Easier · Coherence pillar (cause: Purpose)]',
  },

  /**
   * Ch.6 p.114 — CANONICAL DEFINITION of "Harder Is Easier".
   * Ingested 2026-06-13.  See `02-chapter-6-p114-harder-is-easier-definition.md`.
   * Three-component structure spans Purpose (chapter assignment + Component 3)
   * + Coherence (Component 1) + Integrity (Component 2).
   * Proposed (NOT yet wired) new defect category: `harder-is-easier-gap`.
   */
  'p114-harder-is-easier-definition': {
    name:            'Harder Is Easier',
    verbatim:        'I call it "harder is easier." From here on out, I\'ll use the shorthand of a harder-is-easier mission to mean this specific combination I\'ve witnessed in the very best companies: 1. An ambitious mission to maximize human flourishing, aligned with the business model so the company only makes more money by accomplishing more mission. This rejects "making money by any means necessary" in favor of making money by doing as much mission as possible. 2. An ethos that includes an unwavering commitment to principled decision-making. A team on a harder-is-easier mission is willing to face the full consequences of its principles, no matter how difficult. 3. A commitment to "figure it out" when challenges arise. They find solutions.',
    book:            'Eric Ries, Incorruptible (2026)',
    page:            114,
    chapter:         'Ch.6 — Harder Is Easier',
    primaryPillar:   'purpose',
    secondaryPillar: 'coherence',
    citation:        '[Ries Incorruptible · p.114 · Ch.6 Harder Is Easier · Purpose pillar (3-part definition spans Purpose + Coherence + Integrity)]',
    components: [
      {
        number: 1,
        label:  'Mission-aligned business model',
        text:   'An ambitious mission to maximize human flourishing, aligned with the business model so the company only makes more money by accomplishing more mission. This rejects "making money by any means necessary" in favor of making money by doing as much mission as possible.',
        pillar: 'coherence',
      },
      {
        number: 2,
        label:  'Principled decision-making ethos',
        text:   'An ethos that includes an unwavering commitment to principled decision-making. A team on a harder-is-easier mission is willing to face the full consequences of its principles, no matter how difficult.',
        pillar: 'integrity',
      },
      {
        number: 3,
        label:  '"Figure it out" commitment',
        text:   'A commitment to "figure it out" when challenges arise. They find solutions.',
        pillar: 'purpose',
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────────
  // Chapter 9 Implementation Guide passages (ingested 2026-06-18, r41 v188).
  // See `.claude/ries-incorruptible-rules/03-chapter-9-implementation-guide.md`
  // for the full verbatim ingestion + 5-Layer Stack + 5 Configurations matrix.
  // Source: Eric Ries + Virgil PBC, Ch.9 Implementation Guide v1.0.0,
  // CC BY-NC-SA 4.0, 2026-05-26 (36-page companion).
  // ────────────────────────────────────────────────────────────────────────────

  /** Ch.9 IG p.5 — The five-layer architecture overview. */
  'ch9-p5-five-layers': {
    name:            'The Incorruptible Stack',
    verbatim:        'The Incorruptible Stack has five layers. Each builds on the ones before it. Mission protection cannot rest on any single layer. LAYER 1 FOUNDATION (PBC status and the Director\'s Oath) is permanent. LAYER 2 SUCCESSION PLAN (the MGE Bridge transfers mission-control rights from founders to a Mission Guardian Entity). LAYER 3 NEGATIVE PROTECTIONS (veto rights and quorum & approval thresholds that block mission-threatening actions). LAYER 4 AFFIRMATIVE PROTECTIONS (voting power to approve corporate actions, not merely block them). LAYER 5 SPECIAL PROTECTIONS (additional tools for unique circumstances).',
    book:            'Eric Ries + Virgil PBC, Incorruptible Ch.9 Implementation Guide v1.0 (2026)',
    page:            5,
    chapter:         'Ch.9 IG — The Layers',
    primaryPillar:   'integrity',
    secondaryPillar: 'compliance',
    citation:        '[Ries Incorruptible Ch.9 IG · p.5 · Five-layer Stack · Integrity pillar (architecture); Compliance pillar (implementation detail)]',
  },

  /** Ch.9 IG p.12-13 — The Mission Statement durability rubric (4 tests). */
  'ch9-p12-mission-statement-durability': {
    name:            'Durable vs. Decorative Mission Statement',
    verbatim:        'A durable Mission Statement is specific enough to be tested and broad enough to survive pivots. What makes a mission DURABLE: It names the beneficiary ("We serve X"). It describes the change you are creating, not the product ("We exist so that X is more available / more affordable / better stewarded"). It survives the five-year test (in five years, will the language still tell you what to say no to?). It survives the pivot test (could you pivot the product or service significantly while still honoring the stated mission?). What makes a mission DECORATIVE: It offers superlatives without specifics ("Build the best." "Revolutionize."). It describes the product, not the purpose. It centers the company, not the beneficiary ("Become the leader in…"). It promises impossible things ("End poverty." "Solve climate change."). WORKING TEST: Could a mission-aligned successor team, ten years from now, working on technology that does not yet exist, read this and know what trade-offs they should make?',
    book:            'Eric Ries + Virgil PBC, Incorruptible Ch.9 Implementation Guide v1.0 (2026)',
    page:            12,
    chapter:         'Ch.9 IG — Layer 1 Foundation: PBC + Mission Statement',
    primaryPillar:   'purpose',
    secondaryPillar: 'integrity',
    citation:        '[Ries Incorruptible Ch.9 IG · p.12-13 · Durable-vs-Decorative rubric · Purpose pillar (mission identity) + Integrity (testable promise)]',
  },

  /** Ch.9 IG p.17 — Director's Oath = Filter + Commit (behavioral instrument). */
  'ch9-p17-oath-filter-and-commit': {
    name:            'Director\'s Oath: Filter + Commit',
    verbatim:        'The Oath is a behavioral instrument, not a legal one. The Oath does not create new liability… The Oath works through two mechanisms: filtering and commitment. FILTERING: A director who refuses to sign has revealed something that no due-diligence process would have. Their decline is information, not failure. It is a screen against directors who are indifferent to the mission. COMMITMENT: Once a director signs, the consistency principle from behavioral psychology applies: people who make a public commitment follow through more consistently than people who hold the same views privately.',
    book:            'Eric Ries + Virgil PBC, Incorruptible Ch.9 Implementation Guide v1.0 (2026)',
    page:            17,
    chapter:         'Ch.9 IG — Layer 1 Foundation: Director\'s Oath',
    primaryPillar:   'integrity',
    secondaryPillar: 'purpose',
    citation:        '[Ries Incorruptible Ch.9 IG · p.17 · Oath: Filter + Commit · Integrity pillar (believable promise via personal commitment)]',
  },

  /** Ch.9 IG p.21 — Cautionary: never accept naked calendar sunsets on
   *  mission-bearing share classes (Twilio case: founder lost CEO within
   *  months after Class B sunset expired in 2023). */
  'ch9-p21-naked-sunset-cautionary': {
    name:            'Never Accept Naked Sunsets',
    verbatim:        'The Charter contains no calendar-based sunset on Class B stock. If an investor pushes for a date-certain sunset, you can honor it without undoing the architecture by attaching it to the Bridge, so Class B sunsets and the MGE activates at the same time, and control transfers rather than collapsing. The Incorruptible book specifically warns against a "naked" calendar-based sunset with no corresponding trigger for the MGE Bridge. TWILIO CAUTIONARY: Class B supervoting with a 7-year sunset. When it expired in 2023, Lawson lost voting control and was replaced as CEO within months. Central cautionary case: never accept sunsets on mission-bearing share classes.',
    book:            'Eric Ries + Virgil PBC, Incorruptible Ch.9 Implementation Guide v1.0 (2026)',
    page:            21,
    chapter:         'Ch.9 IG — Layer 2 Succession: MGE Bridge + Sunset Warning',
    primaryPillar:   'integrity',
    secondaryPillar: 'compliance',
    citation:        '[Ries Incorruptible Ch.9 IG · p.21 · Naked-sunset cautionary (Twilio 2023) · Integrity pillar (durable promise)]',
  },

  /** Ch.9 IG p.33-34 — The full Standard NVCA vs. Incorruptible diff. */
  'ch9-p33-standard-vs-incorruptible-diff': {
    name:            'Standard NVCA vs. Incorruptible',
    verbatim:        'The Incorruptible architecture preserves everything investors expect, and adds a parallel mission-protection layer. WHAT STAYS THE SAME: The entire standard venture playbook works. Investors get the same economic protections, the same governance rights, and the same exit mechanics they expect from any Series Seed or Series A. WHAT CHANGES: PBC status replaces standard C-Corp status, which means directors owe a triple fiduciary duty instead of a single-beneficiary duty. WHAT\'S NEW: The Director\'s and Officer\'s Oath; Mission protective provisions (a second veto regime, parallel to investor protective provisions); Class B Common Stock with 10:1 supervoting rights and the N+1 board formula; The Disqualifying Conduct Event provides the accountability counterweight; The Mission Guardian Entity as the planned-succession mechanism; Class M Common Stock (dormant until the MGE Bridge is triggered).',
    book:            'Eric Ries + Virgil PBC, Incorruptible Ch.9 Implementation Guide v1.0 (2026)',
    page:            33,
    chapter:         'Ch.9 IG — Standard vs. Incorruptible diff',
    primaryPillar:   'integrity',
    secondaryPillar: 'compliance',
    citation:        '[Ries Incorruptible Ch.9 IG · p.33-34 · Standard NVCA vs. Incorruptible diff table · Integrity + Compliance pillars]',
  },
})

/**
 * Build a stable, deterministic id per r93l lesson — same answers always produce the same id
 * so re-running synthesis on the same inputs doesn't churn the UI.
 */
function stableSynthId(
  categoryId: IncorruptibleCategory,
  questionId: string,
): string {
  return `incorrupt-sharp|${categoryId}|${questionId}`
}

/**
 * r93dd (Tom Gilb 2026-06-11 "inc sharp, not apply there now"): pick a valid target item id
 * for fix types that need a specific entry. add-wish / raise-goal-when / add-source-charter
 * all look for V.<id>; if the spec has at least one V. we use the FIRST one (best-effort). If
 * the spec has no V. for those fix types, we DOWNGRADE the fix-type to add-constraint so the
 * synthesis still produces a working mutation — the user's answer becomes a Plan-level
 * Constraint documenting their commitment. Better than silent failure.
 */
function resolveTargetForFix(
  fixType: ReturnType<typeof getFixType>,
  spec: SpecBlock | null,
): { resolvedFixType: typeof fixType; targetItemId: string } {
  const needsV = fixType === 'add-wish' || fixType === 'raise-goal-when' || fixType === 'add-source-charter'
  if (!needsV) return { resolvedFixType: fixType, targetItemId: 'plan-level' }
  // r93ff: when fix needs a V., prefer the V. with the SMALLEST Wish/Goal ratio for
  // founder-vision-erosion (the one most in need of an un-sanded Wish); otherwise first V.
  const values = spec?.values ?? []
  if (values.length === 0) {
    // No V. exists — downgrade to add-constraint so the synthesis still produces a fix
    return { resolvedFixType: 'add-constraint', targetItemId: 'plan-level' }
  }
  // Try to find the V. with shortest goalWhen + no wishWhen for add-wish (quarterly-tyranny)
  // — that's the V. the deterministic detector flags
  if (fixType === 'add-wish') {
    const targeted = values.find(v => {
      const gw = v.goalWhen ?? ''
      const ww = v.wishWhen ?? ''
      return gw && !ww
    })
    if (targeted) return { resolvedFixType: fixType, targetItemId: targeted.id }
  }
  return { resolvedFixType: fixType, targetItemId: values[0].id }
}
function getFixType(categoryId: IncorruptibleCategory): typeof CATEGORY_FIX_TYPE[IncorruptibleCategory] {
  return CATEGORY_FIX_TYPE[categoryId]
}

/**
 * Convert one answered question into one IncorruptibleFinding. The finding's suggestedFix
 * carries the user-authored Planguage text in the asPlanguage field (user's selections +
 * free-text answer concatenated). Severity = 'moderate' by default (user-driven, not
 * deterministic-engine critical).
 *
 * r93dd: now spec-aware — resolves a valid target item id for fix types that need a specific
 * V. entry, downgrading to add-constraint when no V. exists in the spec.
 */
function synthesiseFindingFromAnswer(q: AnsweredQuestion, spec: SpecBlock | null): IncorruptibleFinding | null {
  // Compose the proposed Planguage from selected suggestions + free-text
  const selected = q.selectedSuggestionIndexes
    .map(i => q.category.questions.find(qq => qq.id === q.questionId)?.suggestedAnswers[i])
    .filter((s): s is string => typeof s === 'string' && s.length > 0)
  const userText = q.answer.trim()
  // Need at least one selection OR a non-empty free-text to synthesise
  if (selected.length === 0 && !userText) return null
  const asPlanguage = [
    userText,
    ...selected,
  ].filter(Boolean).join('\n\n')

  const principle    = CATEGORY_PRINCIPLE[q.categoryId]
  const baseFixType  = CATEGORY_FIX_TYPE[q.categoryId]
  // r93dd: resolve a real target so V.-needing fixes don't silently fail
  const resolved     = resolveTargetForFix(baseFixType, spec)

  // Question text for display
  const questionText = q.category.questions.find(qq => qq.id === q.questionId)?.text ?? q.questionId

  // r93qqq 2026-06-13 — Ries Figure 5.1 pillar attribution.
  // Every finding now cites the canonical pillar + axis + chapter pointers so
  // the planner is taught the framework while sharpening.
  const pillarSpec   = riesPillarForCategory(q.categoryId)
  const chapterCite  = pillarSpec.chapters.length ? ` · ${pillarSpec.chapters[0]}` : ''
  const riesCitation = `[Ries Incorruptible · Fig. 5.1 p.91 · ${pillarSpec.title} pillar${chapterCite}]`

  return {
    id:                stableSynthId(q.categoryId, q.questionId),
    category:          q.categoryId,
    severity:          'moderate',
    sourceLayer:       'derived-from-plan',
    riesCitation,
    gilbCitation:      'Gilb Sharp Interview pattern + Conjunction-of-Technologies (Ries × Gilb × user input)',
    verifyUrl:         null,
    triggeredBy:       resolved.targetItemId,
    principleViolated: principle,
    explanation:       `Sharpening question — ${questionText}\n\nRies Figure 5.1 ${pillarSpec.title} pillar (axis: ${pillarSpec.axis === 'create-something-worth-protecting' ? 'Create Something Worth Protecting' : 'Build with Structural Integrity'}): ${pillarSpec.blueprint}`,
    suggestedFix: {
      type:           resolved.resolvedFixType,
      targetItemId:   resolved.targetItemId,
      asPlanguage,
      rationale:      `Synthesised from your Sharpening answer to "${questionText}". Selected ${selected.length} suggestion(s) + ${userText.length > 0 ? 'your free-text' : 'no free-text'}.${resolved.resolvedFixType !== baseFixType ? ` Fix downgraded ${baseFixType} → ${resolved.resolvedFixType} (your spec has no V. yet; the answer becomes a Plan-level Constraint).` : ''} Applies via the standard Incorruptible Accept Fix machinery — Source stamped, Undo available.`,
    },
    longTermConsequence: `Your sharpened answer encodes context the deterministic engine cannot infer. Applying it makes the Plan structurally more incorruptible against this specific failure mode.`,
    generatedAtIso:    new Date().toISOString(),
  }
}

/**
 * Synthesise an array of IncorruptibleFindings from all answered questions.
 * r93dd: spec-aware — V.-needing fix types resolve against the bound spec.
 */
export function synthesiseIncorruptibleFindings(
  answers: AnsweredQuestion[],
  spec: SpecBlock | null = null,
): IncorruptibleFinding[] {
  const out: IncorruptibleFinding[] = []
  for (const a of answers) {
    const f = synthesiseFindingFromAnswer(a, spec)
    if (f) out.push(f)
  }
  return out
}
