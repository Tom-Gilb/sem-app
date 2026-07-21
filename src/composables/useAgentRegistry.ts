// useAgentRegistry.ts — Single source of truth for SEM App agent identity:
// image asset, accent color, and rich HoverHint background story.
//
// Tom Gilb 2026-06-17 verbatim "the hover for icon info is a universal
// rule everywhere, including here, which is part of everywhere" — every
// surface that renders an agent (AgentsStrip Level 3 pin, AgentMenuPanel
// catalog tile, future agent thumbnails) imports from THIS module so the
// agent's identity stays consistent across surfaces.
//
// Per DD-009 Zero-Training UI: every agent self-explains on hover with a
// 3-section HoverHint — Action / "✨ BACKGROUND" / figure or symbol story.
//
// Per Conjunction-of-Technologies SUPREME: the agent identity ties to the
// Gilb / Ries / Musk / Montessori / Tom Gilb corpus the agent draws from.
//
// Twin portability: the registry is a pure Record — ports verbatim.

import mariaMontessoriUrl   from '../assets/agents/maria-montessori.jpg'
import contractsUrl         from '../assets/agents/contracts.svg'
import modelsBlueprintUrl   from '../assets/agents/models.svg'
import stakeholderGlyphUrl  from '../assets/agents/stakeholder.svg'
import evoHealthUrl         from '../assets/agents/evo-health.svg'
import specAgentStackUrl    from '../assets/agents/spec-agent.svg'
import decisionsForkUrl     from '../assets/agents/decisions.svg'
import chessUrl             from '../assets/agents/chess.jpg'
import ericRiesUrl          from '../assets/agents/eric-ries.jpg'
import incorruptSharpUrl    from '../assets/agents/incorrupt-sharp.svg'
import spacexLaunchUrl      from '../assets/agents/spacex-launch.jpg'
import elonSharpUrl         from '../assets/agents/elon-sharp.svg'
import appleIIUrl           from '../assets/agents/apple-ii.jpg'
import charlieMungerUrl     from '../assets/agents/charlie-munger.png'
import heilmeierUrl         from '../assets/agents/heilmeier.png'
import resourcesGlyphUrl    from '../assets/agents/resources.svg'

/** Canonical agent identity — matches the IDs used by AgentMenuPanel's `AGENTS` array. */
export type AgentRegistryId =
  | 'maria'
  | 'contracts'
  | 'models'
  | 'stakeholder-mapper'
  | 'evo-step-critique'
  | 'plan-importer'
  | 'decisions'
  | 'strategy-agent'
  | 'incorruptible'
  | 'incorruptible-sharpen'
  | 'elon'
  | 'elon-sharpen'
  | 'munger'
  | 'munger-sharpen'
  | 'heilmeier'
  | 'feynman'
  | 'roles'
  | 'autoDbo'
  // v528 (2026-07-21) — Tom Gilb: "resources agent should apply from stage 1
  // and on — any solution or value implies estimation of resources".
  | 'resources'

export interface AgentIdentity {
  /** Emoji glyph — legacy decoration kept for v-else fallback when no image. */
  emoji: string
  /** Lifecycle status — only 'live' agents are clickable. */
  status: 'live' | 'coming-soon'
  /** Image asset URL — real photo or hand-drawn SVG. */
  image: string
  /** Tailwind palette family for ring + focus. */
  accent: string
  /** Short label used on the AgentsStrip pin (≤ 12 chars). */
  shortLabel: string
  /** Full label rendered in AgentMenuPanel tile header. */
  label: string
  /** Subtitle (~3-7 words) rendered under the label in the tile header. */
  subtitle: string
  /** Medium-length tile blurb (~50-80 words) — what the agent DOES.
   *  Renders as the visible body paragraph in AgentMenuPanel catalog tiles.
   *  Spelled-out Planguage type names per Spell-out-Type-Names SUPREME rule
   *  (Function / Value / Solution / Constraint / Resource — never F./V./S./C./R.). */
  tileBlurb: string
  /** Tailwind classes for the AgentMenuPanel tile HEADER band gradient. */
  headerGradient: string
  /** Tailwind classes for the AgentMenuPanel tile LAUNCH button. */
  launchBtnClass: string
  /** Rich multi-paragraph HoverHint with Action / Background story. */
  richTitle: string
  /** r41 v154 — Planguage prerequisites for this agent.  Same gating logic
   *  as Stage Tools per Tom Gilb 2026-06-17 verbatim "Same with Agents
   *  (Grey, feedback if invalid to use at current state of Building
   *  Planguage specification)".  Empty array = always available. */
  requires?: AgentRequirement[]
  /** r41 v155 — Tool category for the agent, treated through the same lens
   *  as Stage Tools (Tom Gilb 2026-06-17 "Agents are tools").  Drives the
   *  visual category accent on each agent pin so the planner sees
   *  consistent identity across both surfaces. */
  category?: AgentCategory
}

/** Mirror of StageToolsStrip's PlanguageRequirement — kept in this file
 *  to avoid a circular import.  Same 9 values. */
export type AgentRequirement =
  | 'spec' | 'stakeholders' | 'values' | 'functions' | 'solutions'
  | 'impactEstimates' | 'evoSteps' | 'tasks' | 'resources'

/** r41 v155 — Tom Gilb 2026-06-17 verbatim "Agents are tools, Maria is an
 *  analysis tool, Elon analysis and edit (sharpening), Incorruptible is
 *  analysis and edit (a sharpening tool) etc, look at all agents as they
 *  were also tools".  Same 6 categories as StageToolsStrip ToolCategory
 *  union — agents categorize alongside Stage Tools. */
export type AgentCategory = 'visualize' | 'analyze' | 'edit' | 'deepAi' | 'import' | 'export'

export const AGENT_REGISTRY: Record<AgentRegistryId, AgentIdentity> = {
  'maria': {
    emoji: '🏛',
    status: 'live',
    image: mariaMontessoriUrl,
    accent: 'emerald',
    shortLabel: 'Maria',
    label: 'Maria',
    subtitle: 'Board Work Parse',
    headerGradient: 'bg-gradient-to-r from-emerald-700 to-emerald-600',
    launchBtnClass: 'bg-emerald-600 hover:bg-emerald-700 focus-visible:outline-emerald-600',
    tileBlurb: 'Analyses board minutes, resolutions, and strategy papers to produce a decision inventory, authority clarity report, governance gap list, and pattern analysis. Delivers a structured report and email to named stakeholders.',
    richTitle: `Maria — Board Work Parse Agent

Analyses board minutes / resolutions / strategy papers and produces a decision inventory + authority clarity report + governance gap list.

✨ NAMED AFTER MARIA MONTESSORI (1870-1952)
Italy's first woman doctor and a revolutionary educator.  She proved children flourish under prepared environments and self-directed activity rather than top-down instruction — a governance philosophy this agent embodies for boardrooms.  Her schools survive on five continents 120 years on.`,
    requires: [],
    category: 'analyze',
  },

  'contracts': {
    emoji: '📋',
    status: 'live',
    image: contractsUrl,
    accent: 'teal',
    shortLabel: 'Contracts',
    label: 'Contracts',
    subtitle: 'Planguage Contract Analysis',
    headerGradient: 'bg-gradient-to-r from-teal-700 to-teal-600',
    launchBtnClass: 'bg-teal-600 hover:bg-teal-700 focus-visible:outline-teal-600',
    tileBlurb: 'Imports any contract — SLA, NDA, service agreement, employment — and converts clauses to clear, measurable Planguage: Function, Value, Constraint, Resource, Solution, Task entries. Flags vague language and builds a party-obligation matrix.',
    richTitle: `Contracts — Planguage Contract Analysis Agent

Imports any contract (SLA / NDA / service / employment) and converts clauses to Function / Value / Constraint / Resource / Solution Planguage entries.

✨ THE § SILCROW
A medieval European symbol marking legal sections since the 12th century, originally for breaking civil-law codes into atomic obligations.  Each § is a discrete enforceable unit — exactly what this agent extracts from your contract.`,
    requires: [],
    category: 'deepAi',
  },

  'models': {
    emoji: '🗂️',
    status: 'live',
    image: modelsBlueprintUrl,
    accent: 'blue',
    shortLabel: 'Models',
    label: 'Models',
    subtitle: 'Spec Model Library',
    headerGradient: 'bg-gradient-to-r from-blue-700 to-blue-600',
    launchBtnClass: 'bg-blue-600 hover:bg-blue-700 focus-visible:outline-blue-600',
    tileBlurb: 'Browse 18 built-in domain models across 6 categories — Organizational, Project, Product, National, International, Software. View Planguage Function / Value / Constraint / Resource entries, copy any model into your plan, and add your own.',
    richTitle: `Models — Spec Model Library

18 built-in domain models across 6 categories (Organizational / Project / Product / National / International / Software).

✨ THE BLUEPRINT
Sir John Herschel invented the cyanotype process in 1842 — the original way engineers shared a reference design before construction.  The white-on-blue look became the universal symbol of "the master plan".  Every domain model in this library is a Planguage blueprint your plan can copy and adapt.`,
    requires: [],
    category: 'import',
  },

  'stakeholder-mapper': {
    emoji: '👥',
    status: 'live',
    image: stakeholderGlyphUrl,
    accent: 'indigo',
    shortLabel: 'Stakeholder',
    label: 'Stakeholder Mapper',
    subtitle: 'AI-Drafted Attribute Profiles',
    headerGradient: 'bg-gradient-to-r from-indigo-700 to-indigo-600',
    launchBtnClass: 'bg-indigo-600 hover:bg-indigo-700 focus-visible:outline-indigo-600',
    tileBlurb: 'Name any stakeholder — person, organisation, government, or inanimate entity — and AI immediately drafts all 10 attribute levels (Power, Interest, Influence, Support, …) with a source URL and fact for each. Updates automatically when you refine the stakeholder context.',
    richTitle: `Stakeholder Mapper — AI-Drafted Attribute Profiles

Name any stakeholder (person / organisation / government / inanimate entity) and AI drafts all 10 attribute levels (Power, Interest, Influence, Support…) with a source URL + fact for each.

✨ THE PLANGUAGE ←§→ GLYPH
The canonical Planguage Stakeholder symbol encodes the relationship in three parts: Values flow IN (violet ←), the entity is identified (blue § — section, paragraph, person), Resources flow OUT (green dashed →).  Tom Gilb 25-year-old notation; hand-drawn here as it appears throughout SEM App.`,
    requires: [],
    category: 'deepAi',
  },

  'evo-step-critique': {
    emoji: '🔪',
    status: 'live',
    image: evoHealthUrl,
    accent: 'violet',
    // r41 v156 — renamed Evo Critiquer → Evo Sharpening per Tom Gilb
    // 2026-06-17 ("1. ok evo sharp") to align with sibling Sharpening
    // agents (Strategy Sharpening, Incorruptible Sharpening, Elon Sharpening).
    // The registry id 'evo-step-critique' kept for code back-compat.
    shortLabel: 'Evo Sharp',
    label: 'Evo Sharpening',
    subtitle: 'Evo Health Check & Value Delivery',
    headerGradient: 'bg-gradient-to-r from-violet-700 to-violet-600',
    launchBtnClass: 'bg-violet-600 hover:bg-violet-700 focus-visible:outline-violet-600',
    tileBlurb: 'AI reviews your plan against all 9 steps of the Evo cycle. Scores 10 health dimensions (Stakeholder Coverage, Values Completeness, Priority Alignment, …), critiques each planning step, gives a deep-dive on the Value Delivery cycle (Develop → Deliver → Measure → Learn), and suggests sharpening edits you can Accept / Dismiss.',
    richTitle: `Evo Sharpening — Evo Health Check + Value Delivery + Accept-Fix

Reviews your plan against all 9 steps of the Evo cycle.  Scores 10 health dimensions (Stakeholder Coverage, Values Completeness, Priority Alignment, …) and gives a deep-dive on the Value Delivery cycle (Develop → Deliver → Measure → Learn).  Findings route through the standard Accept-Fix pipeline so the deep AI analysis becomes auto-edit on your approval.

✨ THE EVO CYCLE
Tom Gilb's iterative-delivery method since 1960 — predating Agile by 40+ years.  Used on shuttles, missile defence, banking, education.  The 9 steps + Value-Delivery sub-cycle are the bones; the heart at the centre symbolises plan vitality, and the ? marks the diagnostic question this agent asks at every step.`,
    requires: ['evoSteps'],
    category: 'deepAi',
  },

  'plan-importer': {
    emoji: '📄',
    status: 'live',
    image: specAgentStackUrl,
    accent: 'orange',
    shortLabel: 'Spec Agent',
    label: 'Spec Agent',
    subtitle: 'Universal Planguage Converter',
    headerGradient: 'bg-gradient-to-r from-orange-700 to-orange-600',
    launchBtnClass: 'bg-orange-600 hover:bg-orange-700 focus-visible:outline-orange-600',
    tileBlurb: 'Paste any text — business brief, roadmap, strategy doc, rough notes — and AI converts it to full Planguage Function / Value / Constraint / Resource / Solution entries. Then analyses problems and inconsistencies, suggests improvements, and applies them on command. Full version history with before/after comparison.',
    richTitle: `Spec Agent — Universal Planguage Converter

Paste any text (brief / roadmap / strategy / rough notes) and AI converts it to full Planguage entries.  Then analyses problems and inconsistencies, suggests improvements, and applies them on your command ("simplify", "innovate", "make measurable").

✨ THE [*+*+*+*+*] PLAN GLYPH
Canonical Planguage symbology for "a Plan / Spec — a container of multiple typed entries".  The brackets bound the container; each colored asterisk is one canonical type:
   ✻ Function (green) — what the system does
   ✻ Value (violet) — what stakeholders care about
   ✻ Solution (orange) — how we deliver
   ✻ Constraint (red) — what we must respect
   ✻ Resource (blue) — what we spend
A 25-year-old Gilb notation; this agent produces all five.`,
    requires: [],
    category: 'deepAi',
  },

  'decisions': {
    emoji: '🎯',
    status: 'live',
    image: decisionsForkUrl,
    accent: 'rose',
    shortLabel: 'Decisions',
    label: 'Decisions',
    subtitle: 'Planguage Decision Analysis',
    headerGradient: 'bg-gradient-to-r from-rose-700 to-rose-600',
    launchBtnClass: 'bg-rose-600 hover:bg-rose-700 focus-visible:outline-rose-600',
    tileBlurb: 'Describe any decision and its options. AI builds a scored decision matrix (options × Planguage criteria), models each option as Function / Value / Constraint entries, recommends the best path with rationale, and compares options against any other plan you load. Redo the analysis with new instructions any time.',
    richTitle: `Decisions — Planguage Decision Analysis Agent

Describe any decision and its options.  AI builds a scored decision matrix (options × Planguage criteria), models each option as Function / Value / Constraint entries, recommends the best path with rationale, and compares against any other plan you load.

✨ THE FORK IN THE ROAD
Humanity's oldest symbol of decision — from Heraclitus' "the road up and the road down" (~500 BC) to Robert Frost's "two roads diverged in a wood" (1916).  Every decision is a fork; the ? above the divergence is the question this agent helps you answer before you commit.`,
    requires: [],
    category: 'deepAi',
  },

  'strategy-agent': {
    emoji: '⚡',
    status: 'live',
    image: chessUrl,
    accent: 'amber',
    shortLabel: 'Strategy',
    label: 'Strategy Sharpening',
    subtitle: '10-Dimension Gilb Strategy Audit',
    headerGradient: 'bg-gradient-to-r from-orange-800 to-orange-700',
    launchBtnClass: 'bg-orange-700 hover:bg-orange-800 focus-visible:outline-orange-700',
    tileBlurb: 'Instantly audits your spec against 10 Gilb-grounded dimensions — Value Traceability, Impact Quantification, Constraint Compliance, Goal Coverage, Resource Feasibility, Solution Specificity, Redundancy Detection, Dependency Ordering, Past Sharpening Patterns, and Strategy Completeness. Scores each dimension, surfaces findings, and suggests improvements you can approve and apply directly.',
    richTitle: `Strategy Sharpening — 10-Dimension Gilb Strategy Audit

Audits your spec against 10 Gilb-grounded dimensions: Value Traceability · Impact Quantification · Constraint Compliance · Goal Coverage · Resource Feasibility · Solution Specificity · Redundancy Detection · Dependency Ordering · Past Sharpening Patterns · Strategy Completeness.

✨ THE STAUNTON CHESS SET
Chess (originally Chaturanga, 6th-century India) is humanity's oldest formal strategy game — every piece carries asymmetric value, every move trades position for opportunity.  These pieces are the Staunton standard, designed by Nathaniel Cooke in 1849 for tournament use — the same set Magnus Carlsen plays today.  This agent audits strategy with the same precision.`,
    requires: ['spec'],
    category: 'deepAi',
  },

  'incorruptible': {
    emoji: '⚖️',
    status: 'live',
    image: ericRiesUrl,
    accent: 'indigo',
    shortLabel: 'Incorrupt',
    label: 'Incorruptible',
    subtitle: 'Eric Ries 2026 · Strategic Resilience',
    headerGradient: 'bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900',
    launchBtnClass: 'bg-indigo-600 hover:bg-indigo-700 focus-visible:outline-indigo-600',
    tileBlurb: 'Checks your strategic plan against Eric Ries\'s Incorruptible (2026) principles. Surfaces six classes of short-term-thinking: Quarterly Tyranny, Stakeholder Monoculture, Mission Drift, Founder-Vision Erosion, Innovation-Budget Predation, Governance Hole. Each finding cites Ries + Gilb + a verify URL with a Planguage fix you can Accept or Dismiss.',
    richTitle: `Incorruptible — Eric Ries 2026 Strategic Resilience Agent

Surfaces six classes of short-term-thinking in your plan: Quarterly Tyranny (no long-horizon Wish) · Stakeholder Monoculture (no future-generation voice) · Mission Drift (no mission-lock Constraint) · Founder-Vision Erosion (Wish ≈ Goal) · Innovation-Budget Predation (R&D as residual) · Governance Hole (no review cadence).

✨ ERIC RIES
Born 1978.  Author of The Lean Startup (2011) — the bible of build-measure-learn that reshaped Silicon Valley.  His 2026 follow-up Incorruptible names six ways good companies decay into short-termism.  "Quarterly results cannot determine quality or long-term thinking."`,
    requires: ['spec'],
    category: 'deepAi',
  },

  'incorruptible-sharpen': {
    emoji: '🔪',
    status: 'live',
    image: incorruptSharpUrl,
    accent: 'amber',
    shortLabel: 'Inc Sharp',
    label: 'Incorruptible Sharpening',
    subtitle: 'Eric Ries 2026 · Q&A · Tailored Sharpening',
    headerGradient: 'bg-gradient-to-r from-amber-700 via-orange-700 to-amber-700',
    launchBtnClass: 'bg-amber-600 hover:bg-amber-700 focus-visible:outline-amber-600',
    tileBlurb: 'Question-and-answer companion to the Incorruptible Agent. Six categories × 2 questions × 3 AI-suggested starter answers, each carrying Source (Plan / Gilb-Ries / Template). Tick suggestions, type your free-text, then click Synthesise & Apply — answers route through the standard Accept-Fix pipeline (Source-stamping + Undo preserved).',
    richTitle: `Incorruptible Sharpening — Q&A Companion to the Incorruptible Agent

Six categories × 2 questions × 3 AI-suggested answers.  Probes founder-mission text, multi-year measurement design, sanding-event history, explore/exploit splits, and review cadence specifics.

✨ THE KNIFE + INCORR BOOK
The sharpening knife is the canonical SEM App glyph for "make this Planguage spec more precise."  Crossed with the Incorruptible book it signals: ask the questions the deterministic engine can't infer.  Answers route through the standard Accept-Fix pipeline with Source-stamping + Undo preserved.`,
    requires: ['spec'],
    category: 'deepAi',
  },

  'elon': {
    emoji: '⚡',
    status: 'live',
    image: spacexLaunchUrl,
    accent: 'cyan',
    shortLabel: 'Elon',
    label: 'Elon',
    subtitle: 'Musk\'s Methods · Pace, First Principles, Delete-then-Optimize',
    headerGradient: 'bg-gradient-to-r from-slate-900 via-cyan-900 to-slate-900',
    launchBtnClass: 'bg-cyan-600 hover:bg-cyan-700 focus-visible:outline-cyan-600',
    tileBlurb: 'Checks your plan against Tom Gilb\'s Musk\'s Methods book + the Dove et al. Pace-of-Innovation paper. Nine categories: Pace of Innovation (DOMINANT — Dove names it the dominant Requirement), First-Principles violations, the five-step Musk algorithm (Question Requirements → Delete → Simplify → Accelerate → Automate), Vertical-Integration gaps, Idiot-Index blindness.',
    richTitle: `Elon — Musk's Methods Agent

Nine-category Musk-aligned check; Pace-of-Innovation is the DOMINANT axis per Dove et al.  Surfaces First-Principles violations, applies the five-step Musk algorithm (Question Requirements → Delete → Simplify → Accelerate → Automate), Vertical-Integration gaps, Idiot-Index blindness.

✨ FALCON 9 SES-10 — 30 MARCH 2017
The world's first reflight of an orbital-class rocket.  Booster B1021 launched SES-10 to geosynchronous transfer orbit then landed on the droneship "Of Course I Still Love You" — its SECOND landing.  Musk proved reusability is economic, not just possible.  Launch cost dropped from $54M to ~$15M per Falcon 9.`,
    requires: ['spec'],
    category: 'deepAi',
  },

  'elon-sharpen': {
    emoji: '🔪',
    status: 'live',
    image: elonSharpUrl,
    accent: 'cyan',
    shortLabel: 'Elon Sharp',
    label: 'Elon Sharpening',
    subtitle: 'Musk\'s Methods · Q&A · Pace + 5-Step Sharpening',
    headerGradient: 'bg-gradient-to-r from-cyan-800 via-cyan-700 to-cyan-800',
    launchBtnClass: 'bg-cyan-600 hover:bg-cyan-700 focus-visible:outline-cyan-600',
    tileBlurb: 'Question-and-answer companion to the Elon Agent. Nine categories × 2 questions × 3 AI-suggested starter answers, each carrying Source (Plan / Gilb-Musk / Template). Pace-of-Innovation goes first (DOMINANT per Dove et al.); other categories follow Musk\'s 5-step algorithm and supporting practices.',
    richTitle: `Elon Sharpening — Q&A Companion to the Elon Agent

Nine categories × 2 questions × 3 AI-suggested answers.  Pace-of-Innovation goes FIRST (DOMINANT per Dove et al.); other categories follow Musk's 5-step algorithm + supporting practices.

✨ THE ROCKET + KNIFE
Pace-of-Innovation made visible.  The Falcon 9 rises on amber engine flames; the chef's knife crosses its flight path — the sharpening question that bisects the upward arc.  Answers route through the Accept-Fix pipeline (Source: Elon Sharpening) with Undo preserved.`,
    requires: ['spec'],
    category: 'deepAi',
  },

  'munger': {
    emoji: '🧠',
    status: 'live',
    image: charlieMungerUrl,
    accent: 'amber',
    shortLabel: 'Munger',
    label: 'Munger',
    subtitle: 'Charlie Munger\'s 12 Prompts · Analytical Rigor',
    headerGradient: 'bg-gradient-to-r from-amber-800 via-amber-700 to-amber-800',
    launchBtnClass: 'bg-amber-600 hover:bg-amber-700 focus-visible:outline-amber-600',
    tileBlurb: 'Runs Charlie Munger\'s 12 analytical prompts against your plan: Inversion (what guarantees I fail?), Second-Order Thinking, Circle of Competence, Bias Audit (25 cognitive biases), Lollapalooza compound forces, Opportunity Cost, Fat Pitch filter, Incentive Map, Simplicity Filter (≤ 3 sentences), Destroy-Your-Own-Idea kill switch, Long Game (10/20/30 years), and the Deathbed Filter (regret of action vs inaction).',
    richTitle: `Munger — Analytical Rigor Agent

12-category check against Charlie Munger's published prompts.  Surfaces missing failure-mode Constraints (Inversion), missing second-order rationale on Values, scope-edge leaks (Circle of Competence), un-audited cognitive biases, compound-force blindness (Lollapalooza), implicit opportunity costs, over-committed Solutions (Fat Pitch), unmapped Stakeholder incentives, over-complex descriptions (Simplicity Filter), missing kill-switch Constraints (Destroy-Your-Own-Idea), short-horizon-only Goals (Long Game), and no long-arc legacy Stakeholders (Deathbed Filter).

✨ CHARLIE MUNGER (1924-2023)
The "abominable no-man" — Warren Buffett's partner who could destroy any bad idea in 30 seconds flat.  Dropped out of Harvard Law in 1945 with $20 in his pocket; co-built Berkshire Hathaway into a $700 billion empire.  Read for 6 hours a day until he was 99.  Famous for "invert, always invert" and the 25 biases of "The Psychology of Human Misjudgment".`,
    requires: ['spec'],
    category: 'deepAi',
  },

  'munger-sharpen': {
    emoji: '🔪',
    status: 'live',
    image: charlieMungerUrl,
    accent: 'amber',
    shortLabel: 'Munger Sharp',
    label: 'Munger Sharpening',
    subtitle: 'Charlie Munger · Q&A · 12-Prompt Sharpening',
    headerGradient: 'bg-gradient-to-r from-amber-800 via-amber-700 to-amber-800',
    launchBtnClass: 'bg-amber-600 hover:bg-amber-700 focus-visible:outline-amber-600',
    tileBlurb: 'Question-and-answer companion to the Munger Agent. 12 categories × Munger\'s original prompt × AI-suggested starter answers, each carrying Source (Plan / Munger PDF / Almanack / Template). PHASE 2 — pending build per Tom\'s greenlight.',
    richTitle: `Munger Sharpening — Q&A Companion to the Munger Agent (PHASE 2)

12 categories × Munger's original prompt × AI-suggested answers.  Each answer routes through the Accept-Fix pipeline (Source: Munger Sharpening) with Undo preserved.

✨ STATUS: PHASE 2 — pending build.  The MVP Munger Agent (analysis-only) ships first; Sharpening Q&A interview follows per Tom's standard agent-build cadence.`,
    requires: ['spec'],
    category: 'deepAi',
  },

  'feynman': {
    emoji: '⚛',
    status: 'live',
    image: '', // r41 v385 — no portrait yet; ⚛ atom glyph stands in (DD-015 universal symbol)
    accent: 'indigo',
    shortLabel: 'Feynman',
    label: 'Feynman',
    subtitle: "Feynman's Plan-Evaluation Lenses · Honesty over Optimism",
    headerGradient: 'bg-gradient-to-r from-indigo-700 via-violet-700 to-indigo-700',
    launchBtnClass: 'bg-indigo-600 hover:bg-indigo-700 focus-visible:outline-indigo-600',
    tileBlurb: 'Runs Richard Feynman\'s six plan-evaluation lenses against your plan: Cargo Cult Test (form populated, substance absent), Estimate Gap (bottom-up engineer estimate vs top-down manager estimate — the Challenger pattern), Cannot Create (Solution has no buildable-this-week artifact), 10-Year-Old Test (jargon hiding meaning), Hidden Assumption Hunt (Infinity-Trap qualifier holes), Notebook Confession (plan claims false completeness — no acknowledged uncertainty).',
    richTitle: `Feynman — Plan-Honesty Agent

Six-category deterministic check grounded in Feynman\'s 1974 Caltech "Cargo Cult Science" speech, his 1986 Challenger Rogers-Commission Appendix F, his blackboard at his death ("What I cannot create, I do not understand"), and Tom\'s dropped PDF of 10 Claude prompts inspired by how Feynman explained things (Louis Gleeson @aigleeson 2026-06-26).

✨ RICHARD P. FEYNMAN (1918-1988)
Nobel laureate in physics (1965, QED).  Manhattan Project at 25.  Discovered the O-ring cause of the Challenger disaster on live TV by dropping rubber in ice water.  Famously refused to fool himself OR be fooled.  Closing line of his Challenger appendix: "For a successful technology, reality must take precedence over public relations, for Nature cannot be fooled."

🔗 Verifiable sources:
• https://calteches.library.caltech.edu/51/2/CargoCult.htm — Cargo Cult Science (Caltech 1974)
• https://calteches.library.caltech.edu/3570/1/Feynman.pdf — Challenger Appendix F (1986)
• Tom-dropped PDF: assets/Feynman Agent/`,
    requires: ['spec'],
    category: 'deepAi',
  },

  // r41 v385 Phase 2 deferred:
  // The 'feynman-sharpen' registry entry will be added in Phase 2 alongside
  // the FeynmanSharpeningPanel.vue component.  Adding the registry id without
  // the panel trips the every-agent-panel-has-export-pin feature-smoke
  // invariant (Export-Button-on-All-Windows SUPREME meta-rule).  Conservative
  // path: ship MVP analysis-only Feynman Agent now; Sharpening Q&A follows.
  // Tom's pattern matches Munger 2026-06-20 (analysis-first, sharpening-second).

  'heilmeier': {
    emoji: '🎯',
    status: 'live',
    image: heilmeierUrl,
    accent: 'indigo',
    shortLabel: 'Heilmeier',
    label: 'Heilmeier',
    subtitle: 'DARPA\'s 9-Question Catechism · Project Viability',
    headerGradient: 'bg-gradient-to-r from-indigo-800 via-blue-700 to-indigo-800',
    launchBtnClass: 'bg-indigo-600 hover:bg-indigo-700 focus-visible:outline-indigo-600',
    tileBlurb: 'Runs George H. Heilmeier\'s 9-question DARPA Catechism against your plan: What are you trying to do? · How is it done today? · What is new in your approach? · Who cares? · What are the risks? · How much will it cost? · How long will it take? · What are the midterm and final exams? · plus the IEEE 2025 "Who is left out?" stakeholder gap question (Butler, Kohno et al.), mapped to Planguage per Tom Gilb\'s Heilmeier-vs-Planguage comparison PDF.',
    richTitle: `Heilmeier — DARPA Catechism Agent

9-category check against George H. Heilmeier's published Catechism (DARPA, 1965-1977).  Surfaces missing quantified objectives (Q1) + jargon-laden descriptions, missing current-practice baselines (Q2), missing novelty Solutions (Q3), thin or missing Stakeholders with unquantified impacts (Q4), un-named risks (Q5), missing cost ceilings (Q6), missing time horizons (Q7), missing midterm-exam checkpoints (Q8), and the IEEE 2025 extension — thin or Direct-only stakeholder maps that hide indirect, regulatory, or marginalized groups (Q9 "Who is left out?").

✨ GEORGE H. HEILMEIER (1936-2014)
DARPA Director 1975-1977.  Invented the liquid-crystal display (LCD) at RCA in 1968 — the screen technology now in every phone, laptop, and monitor.  Recipient of the National Medal of Science (1991) and the IEEE Founders Medal.  Formalised the 9-question Catechism as DARPA's program-evaluation framework; the same questions are used today by venture capitalists, research funders, and program managers worldwide as a structural test of project viability.`,
    requires: ['spec'],
    category: 'deepAi',
  },

  'roles': {
    emoji: '🎭',
    status: 'live',
    image: stakeholderGlyphUrl,
    accent: 'cyan',
    shortLabel: 'Roles',
    label: 'Role Agent',
    subtitle: 'Role Agent · Stakeholder + Role Compliance · Musk\'s responsibility principle',
    headerGradient: 'bg-gradient-to-r from-indigo-700 via-cyan-700 to-indigo-700',
    launchBtnClass: 'bg-cyan-600 hover:bg-cyan-700 focus-visible:outline-cyan-600',
    tileBlurb: 'Checks every Stakeholder + spec entry for explicit AND implicit Roles + Responsibilities. 13 deterministic detectors: every Value needs a Stakeholder + delivery / design / testing / spec-level-setting Roles; every Role needs Name OR Position (Tom 2026-06-23 directive #6); contact + time-span fields recommended; vague "team / we / they" actors flagged per Musk\'s "always name a specific individual" principle; missing Stewards (Owner / Planner / Scribe) surfaced; placeholder Roles tracked until a real individual is named.',
    richTitle: `Role Agent — Stakeholder + Role Compliance

13-category deterministic check covering Tom Gilb's 2026-06-23 MAJOR REDESIGN directive ("PLEASE DO A MAJOR REDESIGN TO FOCUS ON ROLES AND RESPONSIBILITY", 14 numbered points).  Every Value needs at least one Stakeholder (Tom #13.1) and Roles responsible for delivery / design / testing / spec-level-setting (Tom #13.2).  Every Role needs a minimum Name OR Position (Tom #6), with contact + time-span fields ideal (Tom #7).  Stewards Owner / Planner / Scribe must be present (Tom #3).  Vague collective actors ("team / we / they") flagged per Musk's responsibility principle (Tom #14).  Implicit roles in spec text surfaced for naming (Tom #2).

✨ STAKEHOLDER ENGINEERING + MUSK + TOM'S 10-POINT ROLES FRAMEWORK
Grounded in Tom Gilb's Stakeholder Engineering (2025) — Role IS a Stakeholder by definition (Tom #8/9), recorded as a Stakeholder Spec, governed by the same logic and rules.  Composes with Elon Musk's "always name a specific individual" management principle and Tom Gilb's 10-point Roles framework (2026-06-23) covering identity, contact, time-span, default responsibilities, authority scope, entry/exit conditions, RAG defaults, many-to-many Role-holding, placeholder discipline, spec-binding.`,
    requires: ['spec'],
    category: 'deepAi',
  },

  'autoDbo': {
    emoji: '⚙',
    status: 'live',
    image: appleIIUrl,
    accent: 'slate',
    shortLabel: 'Auto-DBO',
    label: 'Auto-DBO',
    subtitle: 'Design By Objectives · Tom Gilb + Lech Krzanik, 1978',
    headerGradient: 'bg-gradient-to-r from-slate-700 via-slate-600 to-slate-700',
    launchBtnClass: 'bg-slate-600 hover:bg-slate-700 focus-visible:outline-slate-600',
    tileBlurb: 'Design BY Objectives — explore Solution alternatives as versioned spec snapshots. Edit any version speculatively (without affecting the master), sharpen each with 9 design dimensions (quality, cost, effort, time, risk, competitiveness, innovation, security, usability), compare versions via IET matrix, then approve the winner to master.',
    richTitle: `Auto-DBO — Design BY Objectives Agent

Explore Solution alternatives as versioned spec snapshots.  Edit any version speculatively (without affecting the master), sharpen each with 9 design dimensions, compare versions via IET matrix, then approve the winner to master.

✨ APPLE II — 1977
Designed by Steve Wozniak.  First mass-market personal computer.  6502 CPU at 1 MHz · 48 KB RAM · 280×192 colour graphics · floppy drive.  Tom Gilb + Lech Krzanik built the ORIGINAL Auto-DBO on Apple II Forth in 1978 — the Forth interpreter let them prototype design-by-objectives interactively.  This is the original host machine.  48 years later, the method ports to AI.`,
    requires: ['solutions'],
    category: 'edit',
  },
  // v528 (2026-07-21) — Resources agent promoted to top-level from Stage-10-only.
  // Tom Gilb verbatim: "resources agent should apply from stage 1 and on — any
  // solution or value implies estimation of resources".  The agent panel itself
  // (ResourcesAgent.vue) was shipped in v509 as ESTIMATION 8; this entry gives
  // it discoverability alongside every other top-level agent.
  'resources': {
    emoji: '📐',
    status: 'live',
    image: resourcesGlyphUrl,
    accent: 'indigo',
    shortLabel: 'Resources',
    label: 'Resources',
    subtitle: 'Capital · Time · Staff · OPEX · Tech Debt',
    headerGradient: 'bg-gradient-to-r from-indigo-800 via-indigo-700 to-indigo-800',
    launchBtnClass: 'bg-indigo-600 hover:bg-indigo-700 focus-visible:outline-indigo-600',
    tileBlurb: 'Central resource estimation hub — 5 resources (Capital Cost / Calendar Time / Specialist Staff / Annual Overhead / Technical Debt) with full time-stamped series, linear extrapolation, standards registry (US Navy Finance / FAR / DCAA / GAAP / IFRS / ISO 31000 / PMBOK / Planguage / custom), Contract/RFP references per resource, currency + frequency + threshold settings, and per-resource Sharpening dialogues. Available from every stage because every Value and every Solution implies resource cost.',
    richTitle: `Resources — Central Estimation Agent (📐)

Every Value and every Solution added at any stage implies a resource cost.  This agent is the single home for the 5-resource estimation model shipped in ESTIMATION 1–9 (v504–v510).

★ SET SQUARE — the draftsman's tool
The set-square (📐) is a right-angle triangle used to measure and lay out.  Fits the agent's role: measure current estimates, extrapolate forward, benchmark against stipulated budgets from the Plan Scope Framework, and flag overflow.

★ WHAT IT DOES
· Capital / Calendar / Staff / Annual Overhead / Tech Debt — 5 resources at once
· Every estimation carries Source + Timestamp + Reasoning (+ optional Evidence + Equation)
· Second Opinions + Manual Override with responsible source + reason
· Auto-trigger on Value / Value-Level / Condition / Constraint / Stipulation changes
· Auto-trigger on Evo Step completion actuals (IBM Cleanroom · Tom Gilb PoSEM 1988 §17)
· Linear extrapolation forward N periods with fitted line + trend + R²
· Standards registry (12 curated: Navy Finance NAVSUP P-485 / SECNAVINST 7000 / FAR Part 31 / DCAA CAM / GAAP / IFRS / ISO 31000 / PMBOK 7 / IBM Cleanroom / Planguage / custom)
· Contract/RFP references per resource
· Per-resource Sharpening dialogue

★ SETTINGS — reachable from anywhere
Currency · frequency · active resources · extrapolation periods · standards multi-select · notes.  All persist per-plan.

★ COMPOSES WITH
Plan Scope Framework (stipulated budgets) · IET/VDT (auto-snapshot on change) · Universal Undo · Twin portability (industrial-strength resource discipline).`,
    // No `requires` — Resources applies from Stage 1 onwards.  Even an empty
    // spec benefits from setting stipulated budgets, currencies, standards.
    category: 'analyze',
  },
}

/** Resolve a registry id to its identity bundle (with safe fallback). */
export function getAgentIdentity(id: string): AgentIdentity | null {
  return (AGENT_REGISTRY as Record<string, AgentIdentity>)[id] ?? null
}

/** Composable wrapper for components that want reactive access. */
export function useAgentRegistry() {
  return {
    AGENT_REGISTRY,
    getAgentIdentity,
  }
}
