// UNIT_TYPE=Types
// valueAspects.ts — Value Aspects Articulation Tool (Tom Gilb 2026-06-11 22:45 CET).
//
// "For large and complex systems (military, national, health, space) a simple one-Scale
//  definition of the Value is too simple. The planner might appreciate the option to use
//  a more-sophisticated specification of a value." — Tom Gilb 2026-06-11
//
// References — Tom Gilb publication lineage (per Tom's request 2026-06-11 r93rr):
//   - Tom Gilb, Software Metrics (1976 UK, 1977 USA) — foundational multi-attribute quality measurement
//   - All succeeding Gilb books 1976–1988 (Reliable EDP Application Design, Humanised Input,
//     Software Engineering Management, etc.) — successive refinement of multi-Scale Value articulation
//   - Tom Gilb, Principles of Software Engineering Management (PoSEM) (1988) — canonical synthesis
//     with detailed industrial examples including the Bank Case demonstrating multi-Aspect Value
//     specification in practice. PoSEM p.17 carries the "as simple as possible but no simpler"
//     formulation (T.G., widely misattributed to Einstein per Tom's correction)
//   - Tom Gilb, Competitive Engineering Ch. 5 "Multi" (2005) — formalises multi-Scale as a named
//     Planguage technique
//   - Tom Gilb, Resilience (2023) — applies the multi-Aspect approach to systemic resilience
//
// PATENT PENDING (added r93ss per Tom 2026-06-11):
//   Co-Inventors: Tom Gilb & Kai Gilb
//   Invention:    Multi-Level Value-Driven Delegation, Governance, and Improvement of
//                 Generative Artificial Intelligence Agents
//   Docket No.:   24-142KG
//   Serial No.:   64/088,267
//   Filing Date:  June 11, 2026
//   System name:  KaiZen (built by Kai Gilb on Planguage / CE / PoSEM)
//   Descendants:  Tom's Twin (Kai's industrial Planguage application) AND
//                 SEM App (Tom's design sandbox; this Value Aspects Tool is from here).
//   Note: all inventive elements of this Aspects Tool fall within the pending claim above.
//
// Each Value can be elaborated into a SET of Aspects. Each Aspect carries its own
// Planguage scaffold (Scale / Meter / Tolerable / Goal / Wish / Stretch / Conditions).

import type { FieldSource } from './spec'

/** Planguage Qualifier per Aspect — per Glossary *124 Qualifier + *666 Qualifier Condition.
 *  Canonical three classes (Time / Place / Event) per Tom Gilb's Twin Glossary entry *124,
 *  banked in CLAUDE.md r93ooo. Each value is the Mnemonic Tag or short condition string
 *  (e.g. "Q1.2026", "EU.Region", "Peace"). The legacy `when/where/what/how/who/why` fields
 *  are retained as Phase-1 backward-compat aliases — `when` ⟶ `time`, `where` ⟶ `place`,
 *  `what` ⟶ `event` (per r93ooo who-rolls-under-place / what-rolls-under-event mapping).
 *  Phase 2 (the full Qualifiers Panel per r93kkk Two-Trigger UX) ports to the
 *  `QualifierSet[] + PlanguageQualifier + QualifierCondition { classification }` model.
 *  Cite: https://www.gilb.com/tomtwin/concept/Qualifier.124 + Qualifier-Condition.666 */
export interface ValueAspectConditions {
  /** Canonical 3-class taxonomy (per *124 + *666, r93ooo) */
  time?:  string   // 'when' — dates, deadlines, relative times
  place?: string   // 'where' — geography, user type/role, system component, market segment
  event?: string   // 'if' — occurrences, scenarios, system states, "Peace", "Cyberattack.Active"
  /** Legacy aliases (Phase 1 backward compat — read on import, prefer canonical fields) */
  when?:  string
  where?: string
  what?:  string
  how?:   string
  who?:   string
  why?:   string
}

/** One Aspect = one Planguage spec scaffold elaborating an aspect of a parent Value. */
export interface ValueAspectSpec {
  /** Deterministic mnemonic id — stable across re-runs per r93l lesson. */
  id: string
  /** Human-readable name — e.g. "Authentication Strength", "First-Time-User Activation". */
  name: string
  /** What is being measured + unit — e.g. "% of users completing primary task without help". */
  scale: string
  /** How measurement is performed — e.g. "Quarterly usability study with N=30 first-time users". */
  meter: string
  /** Minimum non-failure threshold per Planguage Glossary canonical commitment-category. */
  tolerable?: string
  /** Committed promise (negotiated trade-off). */
  goal?: string
  /** Stakeholder dream, uncommitted (independent of cost+physics). */
  wish?: string
  /** Stretch target — Tom 2026-06-11: "Wish, Goal, Stretch". A second tier between Goal and Wish. */
  stretch?: string
  /** Per-Aspect Planguage qualifier conditions (when/who/what/etc). */
  conditions?: ValueAspectConditions
  /** Optional rationale — why this Aspect matters; populated by AI suggestion or human edit. */
  rationale?: string
  /** Per-field FieldSource map — r93s canonical pattern. */
  fieldSources?: Record<string, FieldSource>
  /** True when this Aspect has been Applied + Locked into the master spec. */
  locked?: boolean
}

/** A SET of Aspects elaborating a single Value entry. */
export interface ValueAspectSet {
  /** Deterministic id — `aspects|<parentValueId>|<setName>`. */
  id: string
  /** Editable name — e.g. "Security Aspects", "Usability Aspects". "Aspects" suffix recommended. */
  name: string
  /** The parent V. entry id this set elaborates. */
  parentValueId: string
  /** The category seed used to generate the initial set (Usability, Security, etc.). */
  category: ValueAspectCategory | 'custom'
  /** The Aspects themselves (5-15 typical, 10 ± 5 per Tom's spec). */
  aspects: ValueAspectSpec[]
  /** Why these Aspects collectively — set-level rationale. */
  rationale?: string
  /** Created/updated timestamps per audit-trail. */
  createdAtIso: string
  /** Source provenance per r93s. */
  source: FieldSource
}

/** Pre-baked categories Tom named or commonly used in CE / SEI / ISO 25010. */
export type ValueAspectCategory =
  | 'usability'
  | 'quality'
  | 'maintainability'
  | 'resilience'
  | 'security'
  | 'performance'
  | 'reliability'
  | 'accessibility'
  | 'portability'
  | 'efficiency'

/** Category metadata for UI display. */
export interface ValueAspectCategoryMeta {
  id:          ValueAspectCategory
  label:       string
  /** Tailwind colour accent. */
  color:       string
  /** Emoji glyph for the card. */
  emoji:       string
  /** One-sentence framing of what this category articulates. */
  description: string
  /** Reference book/standard for prior art. */
  source:      string
}

export const VALUE_ASPECT_CATEGORY_META: Record<ValueAspectCategory, ValueAspectCategoryMeta> = {
  usability: {
    id:          'usability',
    label:       'Usability',
    color:       'emerald',
    emoji:       '🧭',
    description: 'How the user interacts: discovery, learnability, efficiency-of-use, memorability, satisfaction.',
    source:      'Nielsen 1994 + Gilb CE Ch.5 + ISO 25010',
  },
  quality: {
    id:          'quality',
    label:       'Quality',
    color:       'violet',
    emoji:       '◆',
    description: 'How well the product meets stated and implied needs across functional + non-functional dimensions.',
    source:      'Gilb 1976 Software Metrics + ISO 25010',
  },
  maintainability: {
    id:          'maintainability',
    label:       'Maintainability',
    color:       'amber',
    emoji:       '🛠',
    description: 'How easily the system can be modified, corrected, extended, and ported by future engineers.',
    source:      'Gilb 1988 Principles of Software Engineering Management + ISO 25010',
  },
  resilience: {
    id:          'resilience',
    label:       'Resilience',
    color:       'red',
    emoji:       '🛡',
    description: 'How well the system absorbs disturbance, recovers from failure, and adapts to change.',
    source:      'Gilb Resilience (2023) + Hollnagel Engineering Resilience',
  },
  security: {
    id:          'security',
    label:       'Security',
    color:       'slate',
    emoji:       '🔒',
    description: 'Confidentiality, integrity, availability, authenticity, accountability, non-repudiation.',
    source:      'NIST CIA Triad + ISO 27001 + ISO 25010',
  },
  performance: {
    id:          'performance',
    label:       'Performance',
    color:       'blue',
    emoji:       '⚡',
    description: 'Time behaviour, resource utilisation, capacity, throughput, latency distributions.',
    source:      'ISO 25010 + Gilb CE Ch.5',
  },
  reliability: {
    id:          'reliability',
    label:       'Reliability',
    color:       'indigo',
    emoji:       '⏱',
    description: 'Maturity, availability, fault tolerance, recoverability under specified conditions.',
    source:      'IEEE 1633 + ISO 25010',
  },
  accessibility: {
    id:          'accessibility',
    label:       'Accessibility',
    color:       'rose',
    emoji:       '♿',
    description: 'Usable by people with the widest range of capabilities — visual, motor, cognitive, hearing.',
    source:      'WCAG 2.2 + Gilb accessibility memory (Tom 85, R-G colourblind)',
  },
  portability: {
    id:          'portability',
    label:       'Portability',
    color:       'teal',
    emoji:       '✈',
    description: 'How easily the system moves to new platforms, environments, or operational contexts.',
    source:      'ISO 25010 + Gilb 1988',
  },
  efficiency: {
    id:          'efficiency',
    label:       'Efficiency',
    color:       'orange',
    emoji:       '📈',
    description: 'Value delivered per unit Resource consumed — the Penta efficiency lens applied per Aspect.',
    source:      'Gilb Penta Model (Gilb-Shalloway 2022)',
  },
}

/** A single AI-suggested impact prediction for a Value Aspect or set. */
export interface ValueAspectImpactPrediction {
  /** Deterministic id. */
  id: string
  /** Which Aspect (or whole set) this impact applies to. */
  targetAspectId: string | 'set'
  /** The predicted impact type — Solution, Resource, Cost, Risk, Stakeholder, Dependency. */
  impactType: 'solution' | 'resource' | 'cost' | 'risk' | 'stakeholder' | 'dependency'
  /** One-sentence description of the impact. */
  description: string
  /** Magnitude — rough estimate (low / medium / high). */
  magnitude: 'low' | 'medium' | 'high'
  /** Source URL for evidence — Wikipedia, vendor docs, paper, standard, etc. */
  verifyUrl?: string
  /** Source attribution — Ries, Gilb, ISO, NIST, etc. */
  citation?: string
  /** Free-text reasoning. */
  reasoning: string
}
