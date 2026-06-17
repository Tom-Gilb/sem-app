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
  | 'autoDbo'

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
}

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
  },

  'evo-step-critique': {
    emoji: '🔬',
    status: 'live',
    image: evoHealthUrl,
    accent: 'violet',
    shortLabel: 'Critiquer',
    label: 'Evo Critiquer',
    subtitle: 'Evo Health Check & Value Delivery',
    headerGradient: 'bg-gradient-to-r from-violet-700 to-violet-600',
    launchBtnClass: 'bg-violet-600 hover:bg-violet-700 focus-visible:outline-violet-600',
    tileBlurb: 'AI reviews your plan against all 9 steps of the Evo cycle. Scores 10 health dimensions (Stakeholder Coverage, Values Completeness, Priority Alignment, …), critiques each planning step, and gives a deep-dive on the Value Delivery cycle (Develop → Deliver → Measure → Learn) with practical tasks.',
    richTitle: `Evo Critiquer — Evo Health Check + Value Delivery

Reviews your plan against all 9 steps of the Evo cycle.  Scores 10 health dimensions (Stakeholder Coverage, Values Completeness, Priority Alignment, …) and gives a deep-dive on the Value Delivery cycle (Develop → Deliver → Measure → Learn).

✨ THE EVO CYCLE
Tom Gilb's iterative-delivery method since 1960 — predating Agile by 40+ years.  Used on shuttles, missile defence, banking, education.  The 9 steps + Value-Delivery sub-cycle are the bones; the heart at the centre symbolises plan vitality, and the ? marks the diagnostic question this agent asks at every step.`,
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
    tileBlurb: 'Question-and-answer companion to the Incorruptible Agent. Six categories × 2 questions × 3 AI-suggested starter answers, each carrying provenance (Plan / Gilb-Ries / Template). Tick suggestions, type your free-text, then click Synthesise & Apply — answers route through the standard Accept-Fix pipeline (Source-stamping + Undo preserved).',
    richTitle: `Incorruptible Sharpening — Q&A Companion to the Incorruptible Agent

Six categories × 2 questions × 3 AI-suggested answers.  Probes founder-mission text, multi-year measurement design, sanding-event history, explore/exploit splits, and review cadence specifics.

✨ THE KNIFE + INCORR BOOK
The sharpening knife is the canonical SEM App glyph for "make this Planguage spec more precise."  Crossed with the Incorruptible book it signals: ask the questions the deterministic engine can't infer.  Answers route through the standard Accept-Fix pipeline with Source-stamping + Undo preserved.`,
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
    tileBlurb: 'Question-and-answer companion to the Elon Agent. Nine categories × 2 questions × 3 AI-suggested starter answers, each carrying provenance (Plan / Gilb-Musk / Template). Pace-of-Innovation goes first (DOMINANT per Dove et al.); other categories follow Musk\'s 5-step algorithm and supporting practices.',
    richTitle: `Elon Sharpening — Q&A Companion to the Elon Agent

Nine categories × 2 questions × 3 AI-suggested answers.  Pace-of-Innovation goes FIRST (DOMINANT per Dove et al.); other categories follow Musk's 5-step algorithm + supporting practices.

✨ THE ROCKET + KNIFE
Pace-of-Innovation made visible.  The Falcon 9 rises on amber engine flames; the chef's knife crosses its flight path — the sharpening question that bisects the upward arc.  Answers route through the Accept-Fix pipeline (Source: Elon Sharpening) with Undo preserved.`,
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
