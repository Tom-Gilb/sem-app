// UNIT_TYPE=Composable
// useFeynmanFindings.ts — Feynman Agent finding engine (Phase 1 — deterministic).
//
// Tom Gilb 2026-06-26 verbatim:
//   "now I want a Feynman Agent. See folder in assets and seach internet.
//    How would Richard evaluate a plan?"
//   + "i dont really want to stter, i want solid architecture, and well
//      architected changes, just do it"
//
// Architecture (Phase 1):
//   - Deterministic rule engine that scans a SpecBlock and emits FeynmanFinding[]
//   - sourceLayer = mix of `derived-from-plan` (deterministic findings) and
//     `cited-*` (when the finding draws on a specific Feynman text — the
//     citation tells the planner WHERE to verify)
//   - Phase 2 (later) — interactive Sharpening interview consuming the same
//     finding model + LLM-grounded categories (analogy / one-thing-everyone-gets-wrong)
//
// Composes with:
//   - Conjunction-of-Technologies SUPREME (Plan + Feynman texts + Gilb + LLM + Internet)
//   - Spell-out-Type-Names SUPREME (no V. / F. / S. / C. / R. abbreviations in user text)
//   - r93mmm Infinity Trap SUPREME (Qualifier holes surface as unexamined-assumption)
//   - rule_solution_parameters.md SUPREME (Tier 1/2/3 parameter presence checks)
//   - Planguage Parameter Discipline (≤25-word descriptions, no story-form prose)
//   - rule_loading_hint_honest_copy.md (descriptions are concrete, not aspirational)
//   - Architectural Resilience (deterministic IDs per r93l lesson — stable across re-runs)
//   - Twin portability (pure functions over spec data; no Vue reactivity in detectors)
//
// Full source mining in `<vault>/.claude/feynman-rules/`.

import { computed, ref, type Ref } from 'vue'
import type { SpecBlock, VEntry, FEntry, SEntry, CEntry, FieldSource } from '../types/spec'
import {
  type FeynmanFinding,
  type FeynmanReport,
  type FeynmanCategory,
  type FeynmanSeverity,
  type FeynmanFix,
  FEYNMAN_SEVERITY_META,
  FEYNMAN_CATEGORY_META,
  FEYNMAN_BUZZWORDS,
  honestyScoreLabel,
  feynmanWordCount,
} from '../types/feynman'

// ─── Constants ──────────────────────────────────────────────────────────────

/** Planguage Parameter Discipline word ceiling — descriptions exceeding this fail the 10-Year-Old Test. */
const DESCRIPTION_WORD_CEILING = 25

/** A buildable-this-week artifact has an effort budget under this many hours (roughly 1 person-week). */
const BUILDABLE_WEEK_HOURS = 40

/** Buzzword density threshold — N buzzwords in a single description fires jargon-curtain. */
const BUZZWORD_DENSITY_THRESHOLD = 2

/** Why-chain depth before we accept the chain bottoms out — Feynman demands ≥ 3 levels. */
const WHY_CHAIN_MIN_DEPTH = 3

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Deterministic ID — stable tuple across re-runs of the same logical inputs.
 * Pattern: feynman|<category>|<triggeredBy>|<principleKey>
 */
function stableFindingId(
  category: FeynmanCategory,
  triggeredBy: string,
  principleKey: string,
): string {
  return `feynman|${category}|${triggeredBy}|${principleKey}`
}

/** Count buzzwords in a string (case-insensitive). */
function buzzwordCount(s: string | undefined | null): { count: number; matches: string[] } {
  if (!s) return { count: 0, matches: [] }
  const lower = s.toLowerCase()
  const matches: string[] = []
  for (const w of FEYNMAN_BUZZWORDS) {
    if (lower.includes(w)) matches.push(w)
  }
  return { count: matches.length, matches }
}

/** True if the string looks "physical / concrete" — at least one unit / number / referent. */
function hasPhysicalReferent(s: string | undefined | null): boolean {
  if (!s) return false
  const t = s.trim()
  if (!t) return false
  // Number present (any kind) → concrete enough
  if (/\d/.test(t)) return true
  // Common units / concrete words present → concrete enough
  const concreteUnits = /\b(second|seconds|minute|minutes|hour|hours|day|days|week|weeks|month|months|year|years|kg|gram|metre|meter|km|mile|miles|dollar|euro|user|users|customer|customers|click|clicks|byte|bytes|gb|mb|kb|tps|qps|request|requests|case|cases|patient|patients|order|orders|message|messages)\b/i
  return concreteUnits.test(t)
}

/** Extract effort-hours estimate from a Solution's effortPercent or similar. Returns null if absent. */
function solutionBuildableHours(s: SEntry): number | null {
  // Solutions may carry various effort hints. Phase 1 — look at effortPercent if present.
  const ep = (s as unknown as { effortPercent?: number }).effortPercent
  if (typeof ep === 'number' && ep > 0) {
    // Heuristic: effortPercent maps to a fraction of a baseline 200-hour budget.
    // Phase 2 will look at Task effortHours sums per linked Function.
    return ep * 2  // 50% effort ≈ 100 hours; 5% ≈ 10 hours.
  }
  return null
}

// ─── Detector 1: cargo-cult — Goal without measured Past baseline ───────────

function detectGoalWithoutPast(spec: SpecBlock): FeynmanFinding[] {
  const findings: FeynmanFinding[] = []
  const nowIso = new Date().toISOString()
  for (const v of spec.values ?? []) {
    const hasGoal = !!v.goal && v.goal.trim().length > 0
    const hasPast = !!v.past && v.past.trim().length > 0
    if (hasGoal && !hasPast) {
      findings.push({
        id: stableFindingId('cargo-cult', v.id, 'goal-without-past'),
        category: 'cargo-cult',
        severity: 'moderate',
        sourceLayer: 'cited-cargo-cult',
        feynmanCitation: 'Feynman 1974 Caltech, on Millikan oil-drop case: claiming improvement from a baseline that was never measured',
        gilbCitation: 'Glossary · Past (measurement level)',
        verifyUrl: 'https://calteches.library.caltech.edu/51/2/CargoCult.htm',
        triggeredBy: v.id,
        principleViolated: 'No measured baseline',
        explanation: `Value "${v.id}" has a Goal target but no measured Past baseline. Claiming improvement from nothing is the Millikan-oil-drop pattern Feynman flagged in 1974 — the form is there, the measurement is not.`,
        feynmanLens: 'Cargo Cult Test',
        suggestedFix: {
          type: 'add-past-baseline',
          asPlanguage: `Past [today]: <measured current level for ${v.scale || 'this Scale'}>`,
          targetItemId: v.id,
          rationale: 'Before claiming a Goal, measure where you are now. Past is the floor that gives Goal its meaning.',
        },
        longTermConsequence: 'Goal achievement becomes unfalsifiable — the team cannot prove they moved the number because there is no anchor.',
        generatedAtIso: nowIso,
      })
    }
  }
  return findings
}

// ─── Detector 2: cargo-cult — Wish equals Goal (no aspiration gap) ──────────

function detectWishEqualsGoal(spec: SpecBlock): FeynmanFinding[] {
  const findings: FeynmanFinding[] = []
  const nowIso = new Date().toISOString()
  for (const v of spec.values ?? []) {
    if (!v.wish || !v.goal) continue
    if (v.wish.trim() === v.goal.trim()) {
      findings.push({
        id: stableFindingId('cargo-cult', v.id, 'wish-equals-goal'),
        category: 'cargo-cult',
        severity: 'moderate',
        sourceLayer: 'cited-cargo-cult',
        feynmanCitation: 'Feynman 1974: "they got a number closer to Millikan\'s value they didn\'t look so hard… they eliminated the numbers that were too far off."',
        gilbCitation: 'Glossary · Wish (uncommitted stakeholder aspiration, independent of cost+physics)',
        verifyUrl: 'https://calteches.library.caltech.edu/51/2/CargoCult.htm',
        triggeredBy: v.id,
        principleViolated: 'Wish identical to Goal',
        explanation: `Value "${v.id}" has Wish identical to Goal. A Wish that matches the Goal is no aspiration — it has been unconsciously sanded down to match what the planner thinks is achievable.`,
        feynmanLens: 'Cargo Cult Test',
        suggestedFix: {
          type: 'add-past-baseline',
          asPlanguage: `Wish [open horizon]: <2× the Goal level, OR the stakeholder dream level independent of cost + physics>`,
          targetItemId: v.id,
          rationale: 'Wish is the stakeholder\'s dream — uncommitted, independent of cost and physics. If it matches your Goal, the dream has been negotiated away before you started.',
        },
        longTermConsequence: 'The plan never targets transformational change because no transformational target exists in the spec.',
        generatedAtIso: nowIso,
      })
    }
  }
  return findings
}

// ─── Detector 3: cargo-cult — Function without presenceTest ─────────────────

function detectFunctionWithoutPresenceTest(spec: SpecBlock): FeynmanFinding[] {
  const findings: FeynmanFinding[] = []
  const nowIso = new Date().toISOString()
  for (const f of spec.functions ?? []) {
    const has = !!f.presenceTest && f.presenceTest.trim().length > 0
    if (!has) {
      findings.push({
        id: stableFindingId('cargo-cult', f.id, 'function-no-presence-test'),
        category: 'cargo-cult',
        severity: 'critical',
        sourceLayer: 'cited-cargo-cult',
        feynmanCitation: 'Feynman 1974 Cargo Cult Science: "the form is perfect — no plane lands"',
        gilbCitation: 'Planguage Function template — presenceTest is the binary verifier',
        verifyUrl: 'https://calteches.library.caltech.edu/51/2/CargoCult.htm',
        triggeredBy: f.id,
        principleViolated: 'Function without presence test',
        explanation: `Function "${f.id}" has no presenceTest. A Function entry without a binary verifier is a claim without a check — the form of a capability declaration with no way to confirm the capability is actually present.`,
        feynmanLens: 'Cargo Cult Test',
        suggestedFix: {
          type: 'add-presence-test',
          asPlanguage: `Presence Test: <single binary observable that proves the Function is present, e.g. "User authentication endpoint exists and accepts credentials">`,
          targetItemId: f.id,
          rationale: 'A Function is binary — present or absent. Without a presenceTest, you cannot prove it is present.',
        },
        longTermConsequence: 'The team will ship the spec and never know whether they actually delivered the Function.',
        generatedAtIso: nowIso,
      })
    }
  }
  return findings
}

// ─── Detector 4-6: unexamined-assumption — Infinity Trap (Where / Who / When) ─

function detectInfinityTrapQualifier(spec: SpecBlock): FeynmanFinding[] {
  const findings: FeynmanFinding[] = []
  const nowIso = new Date().toISOString()
  // Phase 1 heuristic: a Value has explicit Qualifier coverage when its goalWhen / wishWhen /
  // status / wishStakeholder / impactsStakeholder fields show evidence of conditioning.
  // True Qualifier model lands in Phase 2 with QualifierSet[] from r93jjj architecture.
  for (const v of spec.values ?? []) {
    const goalText = (v.goal ?? '').trim()
    if (!goalText) continue  // No Goal — different detector handles
    const whenStr = (v.goalWhen ?? '').trim()
    const whoStr  = (v.wishStakeholder ?? '').trim()
    // Where indicator — Phase 1 looks for geographic / market / system keywords in description or scale
    const haystack = `${v.description ?? ''} ${v.scale ?? ''} ${v.meter ?? ''}`.toLowerCase()
    const hasWhere = /\b(global|region|country|market|segment|system|environment|territory|continent|europe|asia|america|africa|eu|us|uk|domestic|international|on-premise|cloud|mobile|desktop)\b/.test(haystack)

    if (!whenStr) {
      findings.push({
        id: stableFindingId('unexamined-assumption', v.id, 'no-when-qualifier'),
        category: 'unexamined-assumption',
        severity: 'critical',
        sourceLayer: 'cited-gilb',
        feynmanCitation: 'Feynman: spotting the unexamined belief sitting underneath everyone\'s reasoning',
        gilbCitation: 'r93mmm Infinity Trap SUPREME — no when-Qualifier means requirement applies for INFINITE future time',
        verifyUrl: 'https://www.gilb.com/tomtwin/concept/Qualifier.124',
        triggeredBy: v.id,
        principleViolated: 'Goal without time horizon',
        explanation: `Value "${v.id}" has a Goal target but no Goal-When time horizon. Feynman's Hidden Assumption Hunt asks "what am I treating as obvious that actually isn't?" — here the assumption is that the Goal applies forever. Infinity costs follow.`,
        feynmanLens: 'Hidden Assumption Hunt',
        suggestedFix: {
          type: 'add-when-qualifier',
          asPlanguage: `Goal [<specific date or milestone, e.g. 2027-Q2 OR "before EU AI Act compliance deadline">]: ${goalText}`,
          targetItemId: v.id,
          rationale: 'Every Goal commits infinite resources unless bounded in time. Name the deadline or the trigger event.',
        },
        longTermConsequence: 'Resources committed to an unbounded Goal cannot be planned, costed, or de-risked. Plan failure mode per Gilb r93mmm.',
        generatedAtIso: nowIso,
      })
    }
    if (!whoStr) {
      findings.push({
        id: stableFindingId('unexamined-assumption', v.id, 'no-who-qualifier'),
        category: 'unexamined-assumption',
        severity: 'moderate',
        sourceLayer: 'cited-gilb',
        feynmanCitation: 'Feynman: "what am I treating as obvious that actually isn\'t?"',
        gilbCitation: 'r93mmm Infinity Trap — no who-Qualifier means requirement applies to INFINITE stakeholders',
        verifyUrl: 'https://www.gilb.com/tomtwin/concept/Qualifier.124',
        triggeredBy: v.id,
        principleViolated: 'Goal without target stakeholder',
        explanation: `Value "${v.id}" has a Goal but no named target stakeholder. The plan is implicitly assuming every stakeholder cares equally about this Goal — usually false, always worth examining.`,
        feynmanLens: 'Hidden Assumption Hunt',
        suggestedFix: {
          type: 'add-who-qualifier',
          asPlanguage: `Goal [<stakeholder tag, e.g. "Premium.Users" OR "Regulator.GDPR">]: ${goalText}`,
          targetItemId: v.id,
          rationale: 'Different stakeholders care about different Goal levels. Name the one(s) this Goal serves.',
        },
        longTermConsequence: 'The Goal cannot be prioritised against other Goals because the stakeholder weighting is implicit.',
        generatedAtIso: nowIso,
      })
    }
    if (!hasWhere) {
      findings.push({
        id: stableFindingId('unexamined-assumption', v.id, 'no-where-qualifier'),
        category: 'unexamined-assumption',
        severity: 'suggestion',
        sourceLayer: 'cited-gilb',
        feynmanCitation: 'Feynman: "the unexamined belief sitting underneath"',
        gilbCitation: 'r93mmm Infinity Trap — no where-Qualifier means requirement applies in INFINITE places',
        verifyUrl: 'https://www.gilb.com/tomtwin/concept/Qualifier.124',
        triggeredBy: v.id,
        principleViolated: 'Goal without geographic / system scope',
        explanation: `Value "${v.id}" has a Goal but no geographic, market, or system-scope Qualifier in the Description or Scale. The plan is implicitly committing to deliver this Goal in every market and every environment.`,
        feynmanLens: 'Hidden Assumption Hunt',
        suggestedFix: {
          type: 'add-where-qualifier',
          asPlanguage: `Goal [<scope tag, e.g. "EU.Region" OR "Mobile" OR "On-Premise.Enterprise">]: ${goalText}`,
          targetItemId: v.id,
          rationale: 'Where does this Goal apply? Naming the scope bounds the cost.',
        },
        longTermConsequence: 'Implicit global commitment forces multi-region effort even where it brings no value.',
        generatedAtIso: nowIso,
      })
    }
  }
  return findings
}

// ─── Detector 7-8: jargon-curtain — buzzword density + description too long ─

function detectJargonCurtain(spec: SpecBlock): FeynmanFinding[] {
  const findings: FeynmanFinding[] = []
  const nowIso = new Date().toISOString()

  // ─ 10-Year-Old Test: buzzword density ────────────────────────────────────
  const scan = (id: string, kind: string, text: string | undefined) => {
    if (!text) return
    const { count, matches } = buzzwordCount(text)
    if (count >= BUZZWORD_DENSITY_THRESHOLD) {
      findings.push({
        id: stableFindingId('jargon-curtain', id, `buzzwords-${kind}`),
        category: 'jargon-curtain',
        severity: 'moderate',
        sourceLayer: 'cited-feynman-prompts',
        feynmanCitation: 'Tom-dropped PDF prompt 1 (The 10-Year-Old Test): "If you can\'t make it simple, you don\'t understand it well enough yet."',
        gilbCitation: 'Planguage Parameter Discipline SUPREME — descriptions are ≤25 words, not corporate prose',
        verifyUrl: null,
        triggeredBy: id,
        principleViolated: 'Hiding behind buzzwords',
        explanation: `Entry "${id}" ${kind} contains ${count} corporate buzzwords (${matches.join(', ')}). Feynman's 10-Year-Old Test fails: the language is hiding the meaning.`,
        feynmanLens: '10-Year-Old Test',
        suggestedFix: {
          type: 'strip-jargon',
          asPlanguage: `<rewrite of the ${kind} stripped of: ${matches.join(', ')} — say it as if explaining to a smart 10-year-old>`,
          targetItemId: id,
          rationale: 'A 10-year-old does not know what "leverage" means. Say what you actually do.',
        },
        longTermConsequence: 'Implementers cannot act on the spec because the spec does not say what to do — it says what to sound like.',
        generatedAtIso: nowIso,
      })
    }
  }

  for (const v of spec.values ?? []) {
    scan(v.id, 'description', v.description)
    scan(v.id, 'scale',       v.scale)
  }
  for (const f of spec.functions ?? []) scan(f.id, 'description', f.description)
  for (const s of spec.solutions ?? []) scan(s.id, 'description', s.description)
  for (const c of spec.constraints ?? []) scan(c.id, 'description', c.description)

  // ─ Description too long — fails Parameter Discipline 25-word ceiling ─────
  const scanLength = (id: string, kind: string, text: string | undefined) => {
    if (!text) return
    const n = feynmanWordCount(text)
    if (n > DESCRIPTION_WORD_CEILING) {
      findings.push({
        id: stableFindingId('jargon-curtain', id, `desc-too-long-${kind}`),
        category: 'jargon-curtain',
        severity: 'suggestion',
        sourceLayer: 'cited-gilb',
        feynmanCitation: 'Feynman 10-Year-Old Test',
        gilbCitation: `Planguage Parameter Discipline SUPREME — ${kind} word ceiling = ${DESCRIPTION_WORD_CEILING}`,
        verifyUrl: null,
        triggeredBy: id,
        principleViolated: 'Description longer than 25 words',
        explanation: `Entry "${id}" ${kind} runs ${n} words. Planguage Parameter Discipline caps at ${DESCRIPTION_WORD_CEILING}. Feynman: "if you can't say it in one breath, it's a paragraph and it's wrong."`,
        feynmanLens: '10-Year-Old Test',
        suggestedFix: {
          type: 'shorten-description',
          asPlanguage: `<rewrite of the ${kind} in ≤${DESCRIPTION_WORD_CEILING} words; pull rationale / scale / threshold into their own parameters>`,
          targetItemId: id,
          rationale: 'Long descriptions hide multiple parameters in prose. Split them out.',
        },
        longTermConsequence: 'Each downstream view that renders this Description gets a paragraph of prose instead of a tag.',
        generatedAtIso: nowIso,
      })
    }
  }
  for (const v of spec.values    ?? []) scanLength(v.id, 'description', v.description)
  for (const f of spec.functions ?? []) scanLength(f.id, 'description', f.description)
  for (const s of spec.solutions ?? []) scanLength(s.id, 'description', s.description)
  for (const c of spec.constraints ?? []) scanLength(c.id, 'description', c.description)

  return findings
}

// ─── Detector 9: cannot-create — Solution with no buildable-this-week artifact ─

function detectCannotCreate(spec: SpecBlock): FeynmanFinding[] {
  const findings: FeynmanFinding[] = []
  const nowIso = new Date().toISOString()
  for (const s of spec.solutions ?? []) {
    const hours = solutionBuildableHours(s)
    const tooBig = hours === null || hours > BUILDABLE_WEEK_HOURS
    if (tooBig) {
      findings.push({
        id: stableFindingId('cannot-create', s.id, 'no-buildable-week'),
        category: 'cannot-create',
        severity: 'moderate',
        sourceLayer: 'cited-feynman-blackboard',
        feynmanCitation: 'Feynman blackboard at his death (Caltech February 1988): "What I cannot create, I do not understand."',
        gilbCitation: 'Stages-are-Cyclic SUPREME — Evo cycle requires a buildable first version',
        verifyUrl: null,
        triggeredBy: s.id,
        principleViolated: 'Solution has no week-1 buildable artifact',
        explanation: `Solution "${s.id}" has no effort estimate ≤ ${BUILDABLE_WEEK_HOURS} hours. Feynman's test: until you can BUILD the smallest first version this week, you do not yet understand what you are promising.`,
        feynmanLens: 'Build-It-This-Week',
        suggestedFix: {
          type: 'add-evo-step',
          asPlanguage: `Carve a 1-week first build out of "${s.id}". The act of carving will reveal which assumptions you do not yet understand.`,
          targetItemId: s.id,
          rationale: 'Wish becomes plan the moment you can build the first version.',
        },
        longTermConsequence: 'Solution remains a wish; Stage 4 Impact estimates against it will be guesses.',
        generatedAtIso: nowIso,
      })
    }
  }
  return findings
}

// ─── Detector 11: estimate-gap — Solution lacks Implementation Responsible ───

function detectEstimateGapPrecondition(spec: SpecBlock): FeynmanFinding[] {
  const findings: FeynmanFinding[] = []
  const nowIso = new Date().toISOString()
  for (const s of spec.solutions ?? []) {
    const has = !!s.implementationResponsible && s.implementationResponsible.trim().length > 0
    if (!has) {
      findings.push({
        id: stableFindingId('estimate-gap', s.id, 'no-implementation-responsible'),
        category: 'estimate-gap',
        severity: 'moderate',
        sourceLayer: 'cited-challenger-app-f',
        feynmanCitation: 'Feynman Challenger Appendix F: engineers 1-in-100 vs management 1-in-100,000; the gap was the bug',
        gilbCitation: 'rule_solution_parameters.md SUPREME — Tier 2 RECOMMENDED · Implementation Responsible',
        verifyUrl: 'https://www.refsmmat.com/files/reflections.pdf',
        triggeredBy: s.id,
        principleViolated: 'No engineer-side estimate possible',
        explanation: `Solution "${s.id}" has no Implementation Responsible named. Without someone close to the work, the only estimate you'll get is the top-down one — exactly the Challenger pathology Feynman exposed.`,
        feynmanLens: 'Bottom-Up vs Top-Down',
        suggestedFix: {
          type: 'add-implementation-responsible',
          asPlanguage: `Implementation Responsible: <name of the engineer / team who would actually build this; the person whose estimate you'll compare to the planner estimate>`,
          targetItemId: s.id,
          rationale: 'You need TWO estimates — planner-side and implementer-side. The gap between them is the diagnosis.',
        },
        longTermConsequence: 'Estimate gap cannot be measured. Plan ships with management\'s number and discovers reality at delivery time.',
        generatedAtIso: nowIso,
      })
    }
  }
  return findings
}

// ─── Detector 12: jargon-curtain — Value Scale with no physical referent ────

function detectScaleNoPhysicalImage(spec: SpecBlock): FeynmanFinding[] {
  const findings: FeynmanFinding[] = []
  const nowIso = new Date().toISOString()
  for (const v of spec.values ?? []) {
    if (!v.scale) continue
    if (!hasPhysicalReferent(v.scale)) {
      findings.push({
        id: stableFindingId('jargon-curtain', v.id, 'scale-no-physical-image'),
        category: 'jargon-curtain',
        severity: 'moderate',
        sourceLayer: 'cited-feynman-prompts',
        feynmanCitation: 'Tom-dropped PDF prompt 6 (The Concrete Picture): "If it has no picture, it has no meaning."',
        gilbCitation: 'Planguage Glossary · Scale (the unit of measurement)',
        verifyUrl: null,
        triggeredBy: v.id,
        principleViolated: 'Scale defined abstractly',
        explanation: `Value "${v.id}" Scale "${v.scale}" has no concrete unit, number, or real-world referent. Feynman thought in pictures; if you cannot see the unit, you cannot measure it.`,
        feynmanLens: 'Concrete Picture',
        suggestedFix: {
          type: 'add-physical-image',
          asPlanguage: `Scale: <restate "${v.scale}" with a concrete unit (seconds, percent, users, dollars, requests, …)>`,
          targetItemId: v.id,
          rationale: 'A Scale is a unit. Pick the unit that names what you would physically measure.',
        },
        longTermConsequence: 'Status / Tolerable / Goal cannot be numerically populated because there is no unit to populate them in.',
        generatedAtIso: nowIso,
      })
    }
  }
  return findings
}

// ─── Detector 13: unexamined-assumption — Constraint with no rationale ──────

function detectConstraintNoRationale(spec: SpecBlock): FeynmanFinding[] {
  const findings: FeynmanFinding[] = []
  const nowIso = new Date().toISOString()
  for (const c of spec.constraints ?? []) {
    const has = !!(c as unknown as { rationale?: string }).rationale && ((c as unknown as { rationale?: string }).rationale ?? '').trim().length > 0
    if (!has) {
      findings.push({
        id: stableFindingId('unexamined-assumption', c.id, 'constraint-no-rationale'),
        category: 'unexamined-assumption',
        severity: 'suggestion',
        sourceLayer: 'cited-feynman-prompts',
        feynmanCitation: 'Tom-dropped PDF prompt 4 (Hidden Assumption Hunt): "what am I treating as obvious that actually isn\'t?"',
        gilbCitation: 'Planguage Constraint template — rationale carries the WHY',
        verifyUrl: null,
        triggeredBy: c.id,
        principleViolated: 'Constraint without rationale',
        explanation: `Constraint "${c.id}" has no rationale. A rule with no recorded reason is an unexamined assumption — Feynman: the unexamined belief sitting underneath everyone's reasoning.`,
        feynmanLens: 'Hidden Assumption Hunt',
        suggestedFix: {
          type: 'add-rationale',
          asPlanguage: `Rationale: <one sentence naming WHY this Constraint applies and what risk it bounds>`,
          targetItemId: c.id,
          rationale: 'Constraints inherited without rationale become cargo cult — followed without understanding why.',
        },
        longTermConsequence: 'Future re-design cannot safely relax this Constraint because no one knows what risk it was bounding.',
        generatedAtIso: nowIso,
      })
    }
  }
  return findings
}

// ─── Detector 14: cargo-cult — Solution with no Risks parameter ─────────────

function detectSolutionNoRisks(spec: SpecBlock): FeynmanFinding[] {
  const findings: FeynmanFinding[] = []
  const nowIso = new Date().toISOString()
  for (const s of spec.solutions ?? []) {
    const has = !!s.risks && s.risks.trim().length > 0
    if (!has) {
      findings.push({
        id: stableFindingId('cargo-cult', s.id, 'solution-no-risks'),
        category: 'cargo-cult',
        severity: 'moderate',
        sourceLayer: 'cited-cargo-cult',
        feynmanCitation: 'Feynman 1974: "details that could throw doubt on your interpretation must be given, if you know them."',
        gilbCitation: 'rule_solution_parameters.md SUPREME — Tier 2 RECOMMENDED · Risks',
        verifyUrl: 'https://calteches.library.caltech.edu/51/2/CargoCult.htm',
        triggeredBy: s.id,
        principleViolated: 'Solution declared without acknowledged risk',
        explanation: `Solution "${s.id}" has no Risks parameter. Feynman's bending-over-backwards honesty test: a Solution that names no risks has either skipped the analysis or hidden it.`,
        feynmanLens: 'Notebook Confession',
        suggestedFix: {
          type: 'add-risks',
          asPlanguage: `Risks: <one short sentence naming the top 1-3 ways this Solution could fail to deliver its Main Impact>`,
          targetItemId: s.id,
          rationale: 'Every Solution has risks. Naming them is the precondition for managing them.',
        },
        longTermConsequence: 'Unnamed risks become uncovered failures. Stage 4 Impact estimates against this Solution are unsafe.',
        generatedAtIso: nowIso,
      })
    }
  }
  return findings
}

// ─── Detector 15: notebook-confession — plan-level confessed uncertainty ────

function detectPlanLevelConfession(spec: SpecBlock): FeynmanFinding[] {
  const findings: FeynmanFinding[] = []
  const nowIso = new Date().toISOString()
  // Plan-level heuristic: does any Solution OR any Value carry a non-empty Risks field?
  // If the entire plan has ZERO acknowledged risks, the planner is claiming clean omniscience.
  const anyRiskOnSolution = (spec.solutions ?? []).some(s => !!s.risks && s.risks.trim().length > 0)
  const anyRiskOnValue    = (spec.values ?? []).some(v => !!v.risks && v.risks.trim().length > 0)
  if (!anyRiskOnSolution && !anyRiskOnValue && (spec.solutions ?? []).length + (spec.values ?? []).length > 0) {
    findings.push({
      id: stableFindingId('notebook-confession', 'plan-level', 'no-risks-anywhere'),
      category: 'notebook-confession',
      severity: 'critical',
      sourceLayer: 'cited-feynman-prompts',
      feynmanCitation: 'Tom-dropped PDF prompt 10 (Notebook Confession): "What part of [topic] do you find genuinely confusing or unresolved?"',
      gilbCitation: 'rule_solution_parameters.md SUPREME · rule_stage_4_impacts_design.md (Evidence + Credibility)',
      verifyUrl: null,
      triggeredBy: 'plan-level',
      principleViolated: 'No acknowledged uncertainty anywhere in the plan',
      explanation: 'The entire plan contains zero Risks across all Values and all Solutions. Feynman kept a list titled "Things I Don\'t Know." A plan with no confessed uncertainty has either not thought about risk or is hiding it.',
      feynmanLens: 'Notebook Confession',
      suggestedFix: {
        type: 'add-confession',
        asPlanguage: '<plan-level note: "Things this plan is unsure about" — name the 3 most uncertain assumptions or events; one short sentence each>',
        targetItemId: 'plan-level',
        rationale: 'The honest edge of a plan is where the most interesting thinking lives. Confess it.',
      },
      longTermConsequence: 'The plan ships overconfident. First contact with reality produces surprise where the surprise was foreseeable.',
      generatedAtIso: nowIso,
    })
  }
  return findings
}

// ─── Aggregator ─────────────────────────────────────────────────────────────

const ALL_DETECTORS = [
  detectGoalWithoutPast,
  detectWishEqualsGoal,
  detectFunctionWithoutPresenceTest,
  detectInfinityTrapQualifier,
  detectJargonCurtain,
  detectCannotCreate,
  detectEstimateGapPrecondition,
  detectScaleNoPhysicalImage,
  detectConstraintNoRationale,
  detectSolutionNoRisks,
  detectPlanLevelConfession,
] as const

/** Run all Feynman detectors against a SpecBlock; return a sorted report. */
export function runFeynmanAnalysis(spec: SpecBlock, planTitle = ''): FeynmanReport {
  const generatedAtIso = new Date().toISOString()
  const findings: FeynmanFinding[] = []
  for (const detector of ALL_DETECTORS) findings.push(...detector(spec))

  // Sort by severity then category
  findings.sort((a, b) => {
    const sa = FEYNMAN_SEVERITY_META[a.severity].sortOrder
    const sb = FEYNMAN_SEVERITY_META[b.severity].sortOrder
    if (sa !== sb) return sa - sb
    return a.category.localeCompare(b.category)
  })

  // Group by category
  const byCategory = {
    'cargo-cult':             [] as FeynmanFinding[],
    'estimate-gap':           [] as FeynmanFinding[],
    'cannot-create':          [] as FeynmanFinding[],
    'jargon-curtain':         [] as FeynmanFinding[],
    'unexamined-assumption': [] as FeynmanFinding[],
    'notebook-confession':    [] as FeynmanFinding[],
  } satisfies Record<FeynmanCategory, FeynmanFinding[]>
  for (const f of findings) byCategory[f.category].push(f)

  // Severity tally
  const bySeverity: Record<FeynmanSeverity, number> = { critical: 0, moderate: 0, suggestion: 0 }
  for (const f of findings) bySeverity[f.severity]++

  // Honesty Score 0-100
  let score = 100
  for (const f of findings) score -= FEYNMAN_SEVERITY_META[f.severity].weight
  if (score < 0) score = 0
  const scoreLabel = honestyScoreLabel(score)

  // Headline
  const totalFindings = findings.length
  const headline = totalFindings === 0
    ? `Plan looks clean — Feynman would still ask harder questions in the Sharpening interview.`
    : `${totalFindings} finding${totalFindings === 1 ? '' : 's'} — honesty score ${score} (${scoreLabel}). ${bySeverity.critical} critical, ${bySeverity.moderate} moderate, ${bySeverity.suggestion} suggestion${bySeverity.suggestion === 1 ? '' : 's'}.`

  return {
    generatedAtIso,
    planTitle,
    totalFindings,
    byCategory,
    bySeverity,
    honestyScore: score,
    headline,
  }
}

// ─── Composable singleton (mirrors useMungerFindings pattern) ───────────────

/**
 * Composable — singleton state holder for the Feynman Panel.
 *
 * Mirrors `useMungerFindings` shape so the Panel can dismiss + undismiss
 * findings without re-running detectors.  `setReport(...)` is called by the
 * panel on mount + on spec/title change.  `visibleFindings` filters out
 * dismissed ids; `dismissFinding` / `undismissFinding` mutate the dismissed
 * set; `report` is the raw set of findings most recently produced.
 */
const _report        = ref<FeynmanReport | null>(null)
const _dismissedIds  = ref<Set<string>>(new Set())

export function useFeynmanFindings() {
  const report          = computed<FeynmanReport | null>(() => _report.value)
  const dismissedIds    = computed<Set<string>>(() => _dismissedIds.value)
  const visibleFindings = computed<FeynmanFinding[]>(() => {
    const r = _report.value
    if (!r) return []
    const out: FeynmanFinding[] = []
    for (const cat of Object.keys(r.byCategory) as FeynmanCategory[]) {
      for (const f of r.byCategory[cat]) {
        if (!_dismissedIds.value.has(f.id)) out.push(f)
      }
    }
    return out
  })

  function setReport(r: FeynmanReport | null): void {
    _report.value = r
  }
  function dismissFinding(id: string): void {
    const next = new Set(_dismissedIds.value)
    next.add(id)
    _dismissedIds.value = next
  }
  function undismissFinding(id: string): void {
    const next = new Set(_dismissedIds.value)
    next.delete(id)
    _dismissedIds.value = next
  }
  function clearDismissed(): void {
    _dismissedIds.value = new Set()
  }

  return { report, visibleFindings, dismissedIds, setReport, dismissFinding, undismissFinding, clearDismissed }
}

/**
 * Apply-fix return shape — mirrors `useMungerFindings.ApplyFixResult` so the
 * App.vue `onFeynmanAcceptFix` handler matches the Munger / Heilmeier
 * convention exactly.
 */
export interface FeynmanApplyFixResult {
  newSpec: SpecBlock
  affectedItemId: string
  affectedItemType: 'value' | 'function' | 'solution' | 'constraint' | 'plan-level'
  summary: string
}

/**
 * r41 v408 (Tom Gilb 2026-06-28 verbatim "in all cases I want consolation
 * that the exact source of the change is attached to the spec"): build a
 * canonical FieldSource stamp for every Feynman-applied field mutation.
 * Carries the agent name + ai sourceType + ISO timestamp + tool name +
 * the Feynman principle violated as the human-readable rationale anchor.
 * Per the Spec Sources design 2026-06-09 + Conjunction-of-Technologies
 * SUPREME source-layer audit trail.  v405 audit revealed Feynman was the
 * ONLY agent missing this stamping; v408 closes the gap.
 */
function _buildFeynmanSource(principleViolated: string): FieldSource {
  return {
    source:     'Feynman Agent',
    sourceType: 'ai',
    timestamp:  new Date().toISOString(),
    tool:       `Feynman Agent · ${principleViolated.slice(0, 60)}`,
  }
}

/**
 * Apply a Feynman fix to a SpecBlock.  Phase 1 — handles the simpler fix
 * types that just stamp text into an existing field; the complex ones
 * (`add-evo-step`, `request-engineer-estimate`) are deferred to Phase 2
 * pending the Stage 8 Tasks editor and the Stage 4 Estimates Approval
 * surface.  Returns null when the fix type is not yet routed — the panel
 * surfaces a notification telling the planner to apply manually.
 *
 * Argument order matches Munger: `(finding, spec)`.
 *
 * r41 v408 — every mutated field now gets a FieldSource stamp per Tom's
 * "consolation that the exact source of the change is attached to the spec"
 * verbatim.  Composes with Spec Sources design + Conjunction-of-Technologies
 * SUPREME.
 */
export function applyFeynmanFix(
  finding: FeynmanFinding,
  spec: SpecBlock,
): FeynmanApplyFixResult | null {
  const fix = finding.suggestedFix
  // Defensive clone — Universal Undo SUPREME relies on prev != next identity.
  const next: SpecBlock = JSON.parse(JSON.stringify(spec))
  const src = _buildFeynmanSource(finding.principleViolated)
  switch (fix.type) {
    case 'add-past-baseline': {
      const target = (next.values ?? []).find(v => v.id === finding.triggeredBy)
      if (!target) return null
      ;(target as VEntry & { past?: string }).past = fix.asPlanguage
      target.fieldSources = { ...(target.fieldSources ?? {}), past: src }
      return { newSpec: next, affectedItemId: target.id, affectedItemType: 'value', summary: `Past stamped on ${target.id}` }
    }
    case 'add-presence-test': {
      const target = (next.functions ?? []).find(f => f.id === finding.triggeredBy)
      if (!target) return null
      target.presenceTest = fix.asPlanguage
      target.fieldSources = { ...(target.fieldSources ?? {}), presenceTest: src }
      return { newSpec: next, affectedItemId: target.id, affectedItemType: 'function', summary: `presenceTest stamped on ${target.id}` }
    }
    case 'add-risks': {
      const target = (next.solutions ?? []).find(s => s.id === finding.triggeredBy)
      if (!target) return null
      target.risks = fix.asPlanguage
      target.fieldSources = { ...(target.fieldSources ?? {}), risks: src }
      return { newSpec: next, affectedItemId: target.id, affectedItemType: 'solution', summary: `Risks stamped on ${target.id}` }
    }
    case 'add-implementation-responsible': {
      const target = (next.solutions ?? []).find(s => s.id === finding.triggeredBy)
      if (!target) return null
      target.implementationResponsible = fix.asPlanguage
      target.fieldSources = { ...(target.fieldSources ?? {}), implementationResponsible: src }
      return { newSpec: next, affectedItemId: target.id, affectedItemType: 'solution', summary: `Implementation Responsible stamped on ${target.id}` }
    }
    case 'add-rationale': {
      const target = (next.constraints ?? []).find(c => c.id === finding.triggeredBy)
      if (!target) return null
      ;(target as CEntry & { rationale?: string }).rationale = fix.asPlanguage
      target.fieldSources = { ...(target.fieldSources ?? {}), rationale: src }
      return { newSpec: next, affectedItemId: target.id, affectedItemType: 'constraint', summary: `Rationale stamped on ${target.id}` }
    }
    case 'shorten-description':
    case 'strip-jargon':
    case 'add-physical-image':
    case 'add-where-qualifier':
    case 'add-who-qualifier':
    case 'add-when-qualifier':
    case 'add-evo-step':
    case 'request-engineer-estimate':
    case 'add-confession':
    default:
      // Phase 2 — these require the planner to MODIFY rather than ACCEPT-as-stamp.
      // Phase 1 surfaces the fix text; planner edits manually until Phase 2 routing.
      return null
  }
}

// Reference imports to suppress unused-import warnings on type-only imports
export type _VEntryRef = VEntry
export type _FEntryRef = FEntry
export type _SEntryRef = SEntry
export type _CEntryRef = CEntry
export type _FixRef = FeynmanFix
