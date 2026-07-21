/**
 * useIlluminateClassifier — Phase 2 of the Illumination AI design.
 *
 * Tom Gilb 2026-06-15 verbatim (Phase 2 mandate):
 *   *"so fist they ask the concept words, they you parse it (what type of
 *    words, requirements, processes, design, qa, management, finances. THis
 *    is parallel to sharpening question areas, lets use that."*
 *
 * Scores an incoming concept query against six classification areas, modeled
 * on sharpening question areas as Tom instructed.  Returns the top area as
 * the "primary lens" + a suggested starting tab for the ⌘I picker so the
 * glance card can prime the planner toward the most useful initial surface.
 *
 * Each area maps to a sharpening category (parallel surface in SEM) and to
 * an auto-suggested ⌘I picker tab:
 *
 *    Requirements → 📖 Define   (definition-first — Values + Constraints)
 *    Processes    → 📐 Diagram  (ontology relationships in process modelling)
 *    Design       → 🎨 Pictures (illustrations show design forms)
 *    QA           → 📖 Define   (binary tests + thresholds — definition-grounded)
 *    Management   → 🌌 Universe (the overview vista of the field)
 *    Finance      → 🧠 Ask Twin (specific cost-modelling — Twin reasoning shines)
 *
 * The classifier is pure (no fetch, no AI call) — a deterministic keyword
 * scorer.  Phase 2's purpose is to give planners a fast hint, not a verdict.
 * Phase 4's purpose flow will refine the lens choice using stated purpose.
 *
 * Composes with:
 *   - r41 v27 6-tab IA (every area maps to one of the 6 tabs)
 *   - r41 v28 glance-card (the area + suggested tab render as a chip)
 *   - SEM-teaches-incrementally SUPREME (the chip teaches the lens vocabulary)
 *   - Conjunction-of-Technologies SUPREME (multi-area scoring expresses that
 *     Planguage concepts have multi-dimensional relevance)
 *   - Twin portability (pure function — ports verbatim to Kai's industrial app)
 *   - American English Standard (UI strings)
 *   - HoverHint (no "tooltip")
 */

export type IlluminateArea =
  | 'requirements'
  | 'processes'
  | 'design'
  | 'qa'
  | 'management'
  | 'finance'

export type IlluminateTabSuggestion =
  | 'define'
  | 'diagram'
  | 'pictures'
  | 'universe'
  | 'books'
  | 'twin'

export interface AreaMeta {
  id:           IlluminateArea
  label:        string                  // user-facing UI label
  emoji:        string                  // 1-emoji visual cue
  suggestedTab: IlluminateTabSuggestion // the ⌘I tab the area best surfaces in
  blurb:        string                  // HoverHint copy explaining the lens
}

export const AREA_META: Record<IlluminateArea, AreaMeta> = {
  requirements: {
    id: 'requirements', label: 'Requirements', emoji: '📋',
    suggestedTab: 'define',
    blurb: 'Concepts that articulate WHAT a system must do — Values, Functions, Constraints, Stakeholder needs.  Definitions are the foundation.',
  },
  processes: {
    id: 'processes', label: 'Processes', emoji: '🔁',
    suggestedTab: 'diagram',
    blurb: 'Concepts about HOW work flows — Evo cycles, Plan-Do-Study-Act, Tasks, Phases, Sequences.  Diagrams show the relationships.',
  },
  design: {
    id: 'design', label: 'Design', emoji: '🎨',
    suggestedTab: 'pictures',
    blurb: 'Concepts about Solution forms — architectures, patterns, mechanisms, design alternatives.  Illustrations show what designs look like.',
  },
  qa: {
    id: 'qa', label: 'QA', emoji: '🔬',
    suggestedTab: 'define',
    blurb: 'Concepts about verifying conformance — Tests, Thresholds, Binary Functions, Constraints, Defects.  Definitions ground the binary tests.',
  },
  management: {
    id: 'management', label: 'Management', emoji: '🗺️',
    suggestedTab: 'universe',
    blurb: 'Concepts about overseeing a Plan — Stakeholder governance, Owner roles, Planner hierarchies, Prioritization.  The Universe view shows the field.',
  },
  finance: {
    id: 'finance', label: 'Finance', emoji: '💰',
    suggestedTab: 'twin',
    blurb: 'Concepts about cost, budget, resource economics — Resources, Budgets, Targets, ROI, Total Cost.  Twin Consultant excels at reasoning over cost trade-offs.',
  },
}

export const ALL_AREAS: IlluminateArea[] = [
  'requirements', 'processes', 'design', 'qa', 'management', 'finance',
]

/**
 * Per-area keyword + concept-name lists.  Hand-curated from Tom Gilb's
 * Planguage Glossary + sharpening category vocabularies.  Each list is
 * deliberately non-exhaustive — false positives are worse than misses
 * for a "primary lens" hint that the planner can override.
 */
const AREA_KEYWORDS: Record<IlluminateArea, RegExp[]> = {
  requirements: [
    /\brequirements?\b/i,
    /\bvalues?\b/i,
    /\bfunctions?\b/i,
    /\bconstraints?\b/i,
    /\bstakeholders?\b/i,
    /\bgoal\b/i,
    /\btolerable\b/i,
    /\bwish\b/i,
    /\bstretch\b/i,
    /\bambition\b/i,
    /\bneed(s|ed)?\b/i,
    /\bspec(ification)?s?\b/i,
    /\bquality\b/i,
    /\battribute\b/i,
    /\battainment\b/i,
    /\bscale\b/i,
    /\bmeter\b/i,
  ],
  processes: [
    /\bprocess(es)?\b/i,
    /\bworkflow\b/i,
    /\bevo\b/i,
    /\bcycle\b/i,
    /\bpdsa\b/i,
    /\bplan-do-study-act\b/i,
    /\biteration\b/i,
    /\btask\b/i,
    /\bphase\b/i,
    /\bsequence\b/i,
    /\bstage\b/i,
    /\bstep\b/i,
    /\bdeliver(y|able)\b/i,
    /\bschedule\b/i,
    /\bdecompose\b/i,
    /\bprior(it)?ize\b/i,
    /\blearn(ing)?\b/i,
    /\bmeasure(ment)?\b/i,
    /\bfeedback\b/i,
  ],
  design: [
    /\bdesign\b/i,
    /\bsolution\b/i,
    /\barchitectur(e|al)\b/i,
    /\bpattern\b/i,
    /\bmechanism\b/i,
    /\bstructure\b/i,
    /\balgorithm\b/i,
    /\btechnolog(y|ies)\b/i,
    /\bimplement(ation)?\b/i,
    /\bcomponent\b/i,
    /\bmodul(e|ar)\b/i,
    /\bplatform\b/i,
    /\bframework\b/i,
    /\binterface\b/i,
    /\bapi\b/i,
    /\bdiagram\b/i,
  ],
  qa: [
    /\bqa\b/i,
    /\bquality assurance\b/i,
    /\btest(s|ing)?\b/i,
    /\bverif(y|ication)\b/i,
    /\bvalidat(e|ion)\b/i,
    /\bcheck\b/i,
    /\bdefect\b/i,
    /\bbug\b/i,
    /\bfailure\b/i,
    /\bcomplian(ce|t)\b/i,
    /\baudit\b/i,
    /\binspection\b/i,
    /\breview\b/i,
    /\bcoverage\b/i,
    /\bregression\b/i,
    /\bbinary\b/i,
    /\bpresent\b/i,
    /\babsent\b/i,
  ],
  management: [
    /\bmanagement\b/i,
    /\bmanager\b/i,
    /\bowner(ship)?\b/i,
    /\bplanner\b/i,
    /\bgovernance\b/i,
    /\bsteward\b/i,
    /\bresponsib(le|ility)\b/i,
    /\baccount(ab(le|ility))?\b/i,
    /\bauthority\b/i,
    /\bdecision\b/i,
    /\bteam\b/i,
    /\bleadership\b/i,
    /\bdelegat(e|ion)\b/i,
    /\bdirect(or|ion)\b/i,
    /\bstrateg(y|ic)\b/i,
    /\borganization\b/i,
    /\bdepartment\b/i,
    /\brole\b/i,
  ],
  finance: [
    /\bfinanc(e|ial|ing)\b/i,
    /\bcost\b/i,
    /\bprice\b/i,
    /\bbudget\b/i,
    /\bresource\b/i,
    /\beffort\b/i,
    /\bspend(ing)?\b/i,
    /\bexpense\b/i,
    /\brevenue\b/i,
    /\bprofit\b/i,
    /\bmargin\b/i,
    /\broi\b/i,
    /\btco\b/i,
    /\binvestment\b/i,
    /\bcapital\b/i,
    /\bdollar\b/i,
    /\bcurrency\b/i,
    /\beconomic\b/i,
    /\bmonetary\b/i,
    /\beuro\b/i,
    /\bpayment\b/i,
  ],
}

export interface ClassifierResult {
  /** Primary area — the highest-scoring lens.  Null when no area scored. */
  primaryArea: IlluminateArea | null
  /** Suggested tab for the ⌘I picker based on the primary area. */
  suggestedTab: IlluminateTabSuggestion | null
  /** Confidence — 0-1, score of primary area divided by sum of all scores. */
  confidence: number
  /** Full score per area for transparency / Phase 4 weighting. */
  scores: Record<IlluminateArea, number>
}

/**
 * Classify an incoming concept query.  Pure function.
 * @param query — free-text concept words typed by the planner
 * @returns ClassifierResult with primary area, suggested tab, confidence, scores
 */
export function classifyConcept(query: string | null | undefined): ClassifierResult {
  const scores: Record<IlluminateArea, number> = {
    requirements: 0,
    processes:    0,
    design:       0,
    qa:           0,
    management:   0,
    finance:      0,
  }
  if (!query || !query.trim()) {
    return { primaryArea: null, suggestedTab: null, confidence: 0, scores }
  }

  const q = query.trim()
  // Score: 1 point per regex match (counted with global flag so multi-occurrence counts).
  for (const area of ALL_AREAS) {
    let s = 0
    for (const re of AREA_KEYWORDS[area]) {
      const matches = q.match(new RegExp(re.source, re.flags + 'g'))
      if (matches) s += matches.length
    }
    scores[area] = s
  }

  // Pick the top area.  Tie-break: prefer earlier in ALL_AREAS (requirements > processes
  // > design > qa > management > finance) which matches the natural reading order
  // in Tom's verbatim list.
  let topArea: IlluminateArea | null = null
  let topScore = 0
  for (const area of ALL_AREAS) {
    if (scores[area] > topScore) {
      topArea  = area
      topScore = scores[area]
    }
  }
  if (!topArea) {
    return { primaryArea: null, suggestedTab: null, confidence: 0, scores }
  }
  const totalScore = ALL_AREAS.reduce((a, k) => a + scores[k], 0)
  const confidence = totalScore > 0 ? topScore / totalScore : 0
  return {
    primaryArea:  topArea,
    suggestedTab: AREA_META[topArea].suggestedTab,
    confidence,
    scores,
  }
}

/**
 * useIlluminateClassifier — composable wrapper for components that
 * want to score a reactive query ref.  Stateless (pure pass-through),
 * exposed as a hook for ergonomic Vue use.
 */
export function useIlluminateClassifier() {
  return {
    classifyConcept,
    AREA_META,
    ALL_AREAS,
  }
}
