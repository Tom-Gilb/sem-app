// UNIT_TYPE=Types
// elon.ts — types for the Elon Agent (Musk's Methods + Dove et al. Pace-of-Innovation paper).
//
// Tom Gilb, 2026-06-13 verbatim:
//   "YES ELON IS A NEW AGENT WE CAN DEPLOY TO EVALUATE AND SHARPEN ANY PLAN: I look forward
//    to your sharpening areas, which should include: Innovation, Incremental Improvement,
//    Pace of Learning, Pace of Innovation, Safety, Destiny Control (like suppliers,
//    alternative sources, legal framework (thing Deleware/Texas), Reusability,
//    Modularization, Management Automatedness, Testing Automation, Governance"
//
// Sources Conjunction (per Conjunction-of-Technologies SUPREME rule):
//   1. Tom Gilb — *Musk's Methods* (Apr 2026, 166 pp, version 13 April 2026) — primary principle source
//   2. Dove et al. — *Innovation Engineering at Tesla: Agility as a Cultural Practice* — DOMINANT-Requirement source
//   3. Gilb — EVO 2024 ch.2 — iteration-cycle / cycle-time grounding
//   4. Gilb — Resilience (2023) — supplier independence / supply-chain robustness
//   5. The current Plan (deterministic) — what triggered each finding
//
// Every finding carries a sourceLayer badge per the Conjunction rule.
//
// CRITICAL ARCHITECTURAL CHOICE: `pace-of-innovation` is FIRST in the enum, FIRST in the UI,
// has a higher severity floor (no 'suggestion' tier — minimum 'moderate'), and is weighted 2×
// in the Velocity Score per Tom's DOMINANT-Requirement instruction (Dove p. 8 / Justice 2022a).

/** The eleven diagnostic categories — Tom Gilb's preferred Elon sharpening areas (2026-06-13).
 *  ORDER IS LOAD-BEARING: 'pace-of-innovation' is FIRST because Dove et al. names it the
 *  dominant Requirement (Justice 2022a: "no other metric is above pace of innovation");
 *  UI sections, scoring weights, and AI prompts all rely on this order. Tom's remaining
 *  ten categories follow in his verbatim list order. */
export type ElonCategory =
  | 'pace-of-innovation'         // DOMINANT — Dove p. 8 (Justice 2022a) — cycle time / iteration cadence
  | 'innovation'                 // Bringing genuinely new capability online — Musk Tesla Master Plan
  | 'incremental-improvement'    // Continuous evolutionary refinement — Gilb Evo + Musk's 27 weekly changes
  | 'pace-of-learning'           // How fast feedback turns into spec / design change — Dove DSM
  | 'safety'                     // Failure modes, blast-radius, lives, irreversibility — Musk's "#1 requirement"
  | 'destiny-control'            // Supplier independence + alternate sources + legal jurisdiction independence (Delaware/Texas/etc.); no critical-path single-vendor lock-in
  | 'reusability'                // Components / designs reused across products — Tesla brain in Optimus
  | 'modularization'             // Decoupled, swappable subsystems — Dove "Adaptable Modular Architectures"
  | 'management-automatedness'   // Routine management decisions automated; humans handle exceptions (Dove DSM)
  | 'testing-automation'         // Automated, fast, repeatable test coverage — Musk Step 5 + Tesla NHTSA self-cert
  | 'governance'                 // Decision locks, accountability cadences, charter integrity — Musk MBO

/** Per-finding severity. Critical = blocker; moderate = should fix; suggestion = nice-to-have.
 *  Notes:
 *    - pace-of-innovation findings NEVER carry severity 'suggestion' — minimum 'moderate'
 *    - safety findings escalate automatically to 'critical' for plans involving humans /
 *      vehicles / machinery / medical / financial-loss potential (irreversibility = critical) */
export type ElonSeverity = 'critical' | 'moderate' | 'suggestion'

/**
 * Source-layer badge per the Conjunction-of-Technologies rule.
 * Highest provenance first.
 */
export type ElonSourceLayer =
  | 'derived-from-plan'            // Deterministic from spec data — highest confidence
  | 'cited-musk-methods'           // Musk's Methods book (Tom Gilb) — verified page references
  | 'cited-dove-pace-paper'        // Dove et al. Pace-of-Innovation paper — verified page references
  | 'cited-gilb'                   // Cross-reference to Gilb Standards / other Gilb books
  | 'llm-training'                 // General knowledge of Musk's publicly-stated methods (rarely used now)
  | 'generic-template'             // Fallback heuristic — lowest provenance

/** Shape of a single suggested Planguage edit attached to a finding. */
export interface ElonFix {
  /** What KIND of edit the user would apply. Used for routing the Apply button. */
  type:
    | 'add-cycle-time-goal'        // V. entry tracking pace of innovation
    | 'name-requirement-asker'     // C. or V. with Source: <person/role> — Musk Step 1
    | 'mark-for-deletion'          // Annotation on S./F./R. entry: "Candidate for deletion under Step 2"
    | 'add-deletion-target'        // Goal: delete ≥10% by <when>
    | 'defer-optimization'         // Tag S. entry: "do not optimize until deletion-survival proven"
    | 'add-vertical-integration'   // R. entry: in-house capacity for critical-path dep / supplier alternative
    | 'add-jurisdiction-redundancy'// C. entry: name a legal-jurisdiction alternative (Delaware/Texas/etc.)
    | 'add-idiot-index-tracker'    // V. entry: ratio of finished-cost / raw-material-cost
    | 'raise-iteration-cadence'    // Tighter Evo Step granularity / shorter cycle time
    | 'add-learning-loop'          // V. entry tracking pace of learning (data → spec change)
    | 'add-safety-goal'            // V. entry: safety threshold + safeguards
    | 'add-innovation-goal'        // V. entry tracking genuinely new capability cadence
    | 'add-incremental-improvement'// Goal: N improvements per Evo Step
    | 'add-reusability-goal'       // V. entry: components reused across products
    | 'add-modularization-goal'    // V. entry: module-swap mean time + stable-interface count
    | 'add-management-automation'  // V. entry: routine-decisions-automated ratio
    | 'add-testing-automation'     // V. entry: automated-test-coverage ratio + cycle time
    | 'add-governance-clarity'     // C. entry: decision-rights cadence + charter integrity
    | 'add-constraint'             // Fallback Plan-level Constraint
  /** The proposed edit expressed as Planguage text. Shown to user for review. */
  asPlanguage: string
  /** Target entry id (V/F/S/C/R) the fix would attach to, or 'plan-level' for plan-wide. */
  targetItemId: string
  /** Human-readable rationale shown in the Accept/Modify/Dismiss card. */
  rationale: string
}

/** A single Elon finding — one violation, with cited source + suggested fix. */
export interface ElonFinding {
  /** Deterministic id — stable across re-runs of the same logical inputs. */
  id: string
  category: ElonCategory
  severity: ElonSeverity
  sourceLayer: ElonSourceLayer
  /** Musk's Methods book chapter / page reference. */
  muskCitation: string | null
  /** Dove et al. Pace-of-Innovation paper reference. */
  doveCitation: string | null
  /** Optional Gilb cross-reference (book + chapter / standard file). */
  gilbCitation: string | null
  /** Optional public-URL anchor for verification. */
  verifyUrl: string | null
  /** Which entry triggered this finding ('V.SearchLatency', 'plan-level', etc.). */
  triggeredBy: string
  /** The Musk's Methods principle being violated — short label. */
  principleViolated: string
  /** One-sentence explanation in plain English. */
  explanation: string
  /** Suggested Planguage fix the user can Accept / Modify / Dismiss. */
  suggestedFix: ElonFix
  /** One-sentence consequence framing — "what happens if you don't fix this". */
  longTermConsequence: string
  /** Computed at generation time so the UI can sort newest-first if needed. */
  generatedAtIso: string
}

/** Output of a single Elon run on a Plan — grouped + summarised for the UI. */
export interface ElonReport {
  generatedAtIso: string
  planTitle: string
  totalFindings: number
  byCategory: Record<ElonCategory, ElonFinding[]>
  bySeverity: Record<ElonSeverity, number>
  /** Aggregate "Velocity Score" 0-100 — higher = more aligned with Musk's Methods + Pace.
   *  Pace-of-innovation findings weight 2× others per Tom's "dominant Requirements" rule. */
  velocityScore: number
  /** One-line headline summary the user reads first. */
  headline: string
}

/** Category metadata for UI rendering — label, color, Musk principle one-liner.
 *  Pace-of-innovation gets the dominant electric-cyan/blue accent and the "DOMINANT" label
 *  per Tom's Dove et al. ratification.
 *
 *  Color palette (R/G-colorblind-safe; visually distinguishable):
 *    pace=cyan · innovation=violet · incremental=emerald · learning=blue · safety=red
 *    destiny-control=amber · reusability=indigo · modularization=teal
 *    mgmt-auto=slate · testing-auto=orange · governance=rose                            */
export const ELON_CATEGORY_META: Record<
  ElonCategory,
  { label: string; subtitle: string; color: string; muskPrinciple: string; dominant?: boolean }
> = {
  'pace-of-innovation': {
    label: 'Pace of Innovation',
    subtitle: 'DOMINANT REQUIREMENT — Dove et al. — cycle-time targets + iteration cadence',
    color: 'cyan',
    muskPrinciple:
      'Dove et al., Innovation Engineering at Tesla, p. 8 (citing Justice 2022a): ' +
      '"Pace of innovation is the only thing that matters – not cost per unit, not management ' +
      'efficiency, no other metric is above pace of innovation." Musk\'s Methods p. 72 (Lex Fridman ' +
      'interview): "What matters is the pace of innovation, access to resources, and raw materials."',
    dominant: true,
  },
  'innovation': {
    label: 'Innovation',
    subtitle: 'Genuinely new capability brought online — not incremental refinement of yesterday',
    color: 'violet',
    muskPrinciple:
      'Dove et al. p. 8: "the driving objective… is innovation. Agility appears as an emergent ' +
      'characteristic from a pursuit of innovation engineering." Musk\'s Methods p. 34 (Master Plan ' +
      'Part Deux): new capability — self-driving 10× safer than manual, autonomous earning, solar+EV ' +
      'integration — these are NEW categories of capability, not optimisations of old ones.',
  },
  'incremental-improvement': {
    label: 'Incremental Improvement',
    subtitle: 'Continuous evolutionary refinement — Gilb Evo + Tesla\'s 27 weekly production changes',
    color: 'emerald',
    muskPrinciple:
      'Musk\'s Methods p. 28: "If you have a high production rate, you have a high iteration rate. ' +
      'For pretty much any technology whatsoever, the progress is a function of how many iterations ' +
      'do you have, and how much progress do you make between each iteration." Tesla averages 60 ' +
      'part changes per day (Dove p. 6, Justice 2022). Composes with Gilb Evo (Software Metrics 1976 ' +
      'p. 214): "implemented in small steps and each step has a clear measure of successful achievement".',
  },
  'pace-of-learning': {
    label: 'Pace of Learning',
    subtitle: 'How fast feedback turns into spec / design change — the learning velocity',
    color: 'blue',
    muskPrinciple:
      'Dove et al. p. 5-6: "They get feedback. They get learning" (Justice 2021d). Tesla\'s DSM ' +
      '("Digital Self-Management") provides per-station real-time feedback loops — "an instant feedback ' +
      'loop for skill and station performance" (Dove p. 7). Musk\'s Methods p. 67: "the single best ' +
      'piece of advice: constantly think about how you could be doing things better and questioning ' +
      'yourself." Learning velocity = the rate at which observation becomes new specification.',
  },
  'safety': {
    label: 'Safety',
    subtitle: 'Failure modes, blast-radius, lives, irreversibility — Musk\'s #1 Tesla design requirement',
    color: 'red',
    muskPrinciple:
      'Musk\'s Methods p. 99 (AI Day): "The number one design requirement at Tesla is safety." Musk\'s ' +
      'Methods p. 28-30 (Safety chapter): "Safety is consciously designed into the Tesla Cars. First by ' +
      'basic design, then by the 27 weekly increments production line changes." Dove p. 6: "Speed of ' +
      'safety certification dictates iteration speed". Safety findings escalate to CRITICAL automatically ' +
      'when the plan touches humans, vehicles, machinery, medical, or financial-loss potential — ' +
      'irreversibility = critical.',
  },
  'destiny-control': {
    label: 'Destiny Control',
    subtitle: 'Supplier independence + alternate sources + legal-jurisdiction independence',
    color: 'amber',
    muskPrinciple:
      'Musk\'s Methods p. 66 ("Redundancy as Design Tactic to Avoid Dependencies"): "lab redundancy ' +
      '(Florida Texas) permitted specialization… redundancy is also a tactic to deal with geographical ' +
      'and regulatory problems." Musk built Starship sites in BOTH Cape Kennedy FL and Texas to avoid ' +
      'single-jurisdiction risk. Tesla incorporated in Delaware → moved to Texas for jurisdictional ' +
      'flexibility. Compose with Gilb Resilience (2023): supply-chain robustness as a planning Aspect. ' +
      'Critical-path components MUST have an in-house alternative on the roadmap AND a legal-jurisdiction ' +
      'alternative — external-only or single-jurisdiction dependencies cap cycle time at the supplier\'s / ' +
      'regulator\'s cadence.',
  },
  'reusability': {
    label: 'Reusability',
    subtitle: 'Components and designs reused across products — leverage existing platforms',
    color: 'indigo',
    muskPrinciple:
      'Musk\'s Methods p. 98 (Optimus / Tesla AI Day): "Our structural foundation for the robot is in ' +
      'the vehicle we produce… We want to leverage both the Autopilot hardware, and the software, for ' +
      'the humanoid platform." Same brain → cars AND Optimus. Musk\'s Methods p. 67: SpaceX rocket ' +
      'reusability gave 20× capital efficiency over single-use rockets — "The cost efficiency of Space-X ' +
      'is probably the best in history for any kind of rocket development." Reusability = capital ' +
      'efficiency = the third axis of Musk\'s innovation equation (after pace + access to resources).',
  },
  'modularization': {
    label: 'Modularization',
    subtitle: 'Decoupled, swappable subsystems — Dove\'s "Adaptable Modular Architectures"',
    color: 'teal',
    muskPrinciple:
      'Dove et al. p. 5 ("Adaptable Modular Architectures"): "Tesla uses modular architectures that are ' +
      'adaptable with interconnect specifications for everything: product, process, facility, production, ' +
      'tooling, and people… Adaptable modular architectures appear to be a dominant mental pattern for ' +
      'all types of systems at Tesla (Flyvbjerg & Gardner 2023 p. 169)." Musk\'s Methods p. 27 ' +
      '("Modularity and Stable Interfaces"): "If you have stable component interfaces you can radically ' +
      'improve your component models continuously." Service personnel are trained for "rapid module-swap ' +
      'replacement rather than repair" (Dove p. 5).',
  },
  'management-automatedness': {
    label: 'Management Automatedness',
    subtitle: 'Routine management decisions automated; humans handle exceptions only',
    color: 'slate',
    muskPrinciple:
      'Dove et al. p. 6 ("Attentive Decision Making", Justice 2023b): "Digital Self Management (DSM) ' +
      'means saying \'why would we ever ask a human to decide this?!\' … Replacing human decision points ' +
      'with apps is the digital backbone of a modern company and fundamentally determines the speed of ' +
      'product development and response." Dove p. 7: "There are no bosses, your manager is data. Any ' +
      'approval that waits for a manager is automated by software (Justice 2023b)." This software has ' +
      'largely replaced middle management. Principle: if a manager\'s decision is routine, automate it; ' +
      'humans handle the exceptional only.',
  },
  'testing-automation': {
    label: 'Testing Automation',
    subtitle: 'Automated, fast, repeatable test coverage — Musk Step 5 + Tesla in-factory NHTSA cert',
    color: 'orange',
    muskPrinciple:
      'Musk\'s Methods p. 2 (5-Step Algorithm, Step 5): "Automate. An important part of this is to ' +
      'remove in-process testing after the problems have been diagnosed; if a product is reaching the ' +
      'end of a production line with a high acceptance rate, there is no need for in-process testing." ' +
      'Dove et al. p. 6: "every car drives itself through an in-factory certification test and ' +
      'registers that result with the NHTSA". Automated testing is not just CI — it\'s the entire ' +
      'feedback-loop closure mechanism that lets cycle time accelerate without quality regression.',
  },
  'governance': {
    label: 'Governance',
    subtitle: 'Decision rights, accountability cadences, charter integrity — Musk MBO',
    color: 'rose',
    muskPrinciple:
      'Musk\'s Methods p. 106 ("Management By Objectives"): "[Musk] focuses on the big picture and ' +
      'strategic decision-making, leaving the details to his talented teams. This approach, known as ' +
      'management by objectives, … involves setting clear goals and objectives for employees and ' +
      'empowering them to make their own decisions on how to achieve those goals." Composes with Gilb ' +
      'Planguage: every requirement names its Source (Step 1 Asker). Governance defects = unowned ' +
      'decisions + unclear charter + missing accountability cadences.',
  },
}

/** Severity metadata for UI rendering. */
export const ELON_SEVERITY_META: Record<
  ElonSeverity,
  { label: string; bg: string; text: string; ring: string; sortOrder: number }
> = {
  critical: {
    label: 'CRITICAL',
    bg: 'bg-red-600',
    text: 'text-white',
    ring: 'ring-red-900',
    sortOrder: 0,
  },
  moderate: {
    label: 'MODERATE',
    bg: 'bg-amber-500',
    text: 'text-white',
    ring: 'ring-amber-700',
    sortOrder: 1,
  },
  suggestion: {
    label: 'SUGGESTION',
    bg: 'bg-blue-500',
    text: 'text-white',
    ring: 'ring-blue-700',
    sortOrder: 2,
  },
}

/** Source-layer metadata for UI rendering. */
export const ELON_SOURCE_META: Record<
  ElonSourceLayer,
  { label: string; bg: string; text: string }
> = {
  'derived-from-plan':       { label: 'Derived from plan',          bg: 'bg-emerald-100', text: 'text-emerald-900' },
  'cited-musk-methods':      { label: 'Cited · Musk\'s Methods',    bg: 'bg-cyan-100',    text: 'text-cyan-900' },
  'cited-dove-pace-paper':   { label: 'Cited · Dove Pace paper',    bg: 'bg-violet-100',  text: 'text-violet-900' },
  'cited-gilb':              { label: 'Cited · Gilb',               bg: 'bg-rose-100',    text: 'text-rose-900' },
  'llm-training':            { label: 'LLM training',               bg: 'bg-slate-100',   text: 'text-slate-700' },
  'generic-template':        { label: 'Template fallback',          bg: 'bg-slate-100',   text: 'text-slate-500' },
}
