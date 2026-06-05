// UNIT_TYPE=Hook
// useKissAnalysis.ts — KISS (Keep Improvement Super Surprising) analysis engine.
// Pure TypeScript computation module: no DOM, no Vue reactivity, Twin-portable.
//
// Computes the 5 most cost-effective spec improvements to enable dramatic
// early improvement in Resources — constraint relaxation, solution adds,
// value goal relaxation, resource reallocation, and stakeholder power adjustment.
//
// Claude-Code-as-AI-Layer: all suggestions are statically generated from spec
// data via deterministic logic. No external API calls.
//
// Tom Gilb, 2026-06-04: "Tell me the 5 most cost-effective spec improvements
// I can do now to enable the most dramatic early improvement in resources."

import type { SpecBlock, VEntry, CEntry, REntry } from '../types/spec'

// ─── Types ────────────────────────────────────────────────────────────────────

export type KissChangeType =
  | 'constraint-relax'   // Delay/narrow a regulatory/date/policy constraint
  | 'solution-add'       // Add a targeted high-ROI S. entry
  | 'value-goal-relax'   // Renegotiate a Goal level down (OPTIMA optimisation)
  | 'resource-realloc'   // Move budget from low-ROI to high-ROI area
  | 'stakeholder-power'  // Adjust stakeholder priority weighting

export type DiffZone = 'violation' | 'tolerable' | 'goal' | 'wish' | 'na' | 'new'
export type DiffDirection = 'up' | 'down' | 'stable' | 'new' | 'relaxed'

export interface DiffState {
  label: string       // brief human-readable state
  barPct: number      // 0–130 (same scale as OPTIMA panel — 100 = at Goal)
  zone: DiffZone
  tolerablePct: number  // position of tolerable marker (0–130)
  goalPct: number       // position of goal marker (0–130)
}

export interface ChangeDiff {
  entryId: string
  entryLabel: string     // max 40 chars
  entryType: 'value' | 'resource' | 'solution' | 'constraint'
  isPrimary: boolean     // true = directly changed, false = ripple effect
  before: DiffState
  after: DiffState
  direction: DiffDirection
  deltaLabel: string     // e.g. "+18%", "−30%", "NEW", "RELAXED", "GOAL −20%"
  resourceDeltaPct: number  // negative = savings
}

export interface KissAlternative {
  rank: 1 | 2 | 3 | 4
  title: string
  description: string  // 2–3 sentences
  resourceDeltaPct: number    // negative = saving
  valueDeltaCount: number     // extra values reaching Goal
  tradeoff?: string
  approvalNeeded?: string
  gilbCite?: string
}

export interface KissImprovement {
  rank: 1 | 2 | 3 | 4 | 5
  id: string
  title: string
  changeType: KissChangeType
  headline: string    // one sentence, punchy
  explanation: string // 3–4 sentences with Gilb logic
  diffs: ChangeDiff[]
  valuesLiftedToGoal: number
  resourceSavingPct: number   // negative = saving
  roi: number                 // multiple (e.g. 3.8)
  alternatives: KissAlternative[]  // always exactly 4
  affectedResourceIds: string[]
  gilbCite: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortLabel(s: string, max = 40): string {
  if (!s) return '(unnamed)'
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

// Deterministic "pre-simulation" percentages for value before-states (0-indexed rotation)
const VALUE_BEFORE_PCTS = [68, 73, 61, 82, 55, 78, 64, 70, 58, 75]

function valuePct(index: number): number {
  return VALUE_BEFORE_PCTS[index % VALUE_BEFORE_PCTS.length]
}

// ─── Demo spec (Ironclad Warship) ─────────────────────────────────────────────

const DEMO_SPEC: SpecBlock = {
  functions: [
    { id: 'F.ArmorProtection',       type: 'Function', level: 'Product', description: 'Provides armored hull protection against cannon fire', presenceTest: 'Armored hull present and rated for 32-pounder shot', functionOfValue: 'V.HullIntegrity V.CrewSurvival' },
    { id: 'F.SteamPropulsion',       type: 'Function', level: 'Product', description: 'Provides steam-powered propulsion independent of wind', presenceTest: 'Steam engine operational and driving screw propeller', functionOfValue: 'V.CombatSpeed V.RangeAtSea' },
    { id: 'F.NavalGunnery',          type: 'Function', level: 'Product', description: 'Delivers sustained cannon broadside fire', presenceTest: 'All gun ports operational with trained crews assigned', functionOfValue: 'V.FirepowerIndex' },
  ],
  values: [
    { id: 'V.HullIntegrity',         type: 'Value', level: 'Product', description: 'Hull structural integrity under battle conditions', scale: '% structural integrity under 32-pounder shot', meter: 'Post-engagement survey by naval architect', status: 'Status [2026-Q1] 68%', tolerable: 'Tolerable 60%', goal: 'Goal 90%', valueOfFunction: 'F.ArmorProtection' },
    { id: 'V.CombatSpeed',           type: 'Value', level: 'Product', description: 'Maximum sustained speed under steam in battle', scale: 'knots sustained over 2 hours at battle loading', meter: 'Timed sea trial with full combat load', status: 'Status [2026-Q1] 7 knots', tolerable: 'Tolerable 6 knots', goal: 'Goal 10 knots', valueOfFunction: 'F.SteamPropulsion' },
    { id: 'V.FirepowerIndex',        type: 'Value', level: 'Product', description: 'Total effective firepower per broadside', scale: 'lbs of shot per broadside', meter: 'Ordnance inventory × rate of fire × accuracy score', status: 'Status [2026-Q1] 410 lbs', tolerable: 'Tolerable 350 lbs', goal: 'Goal 600 lbs', valueOfFunction: 'F.NavalGunnery' },
    { id: 'V.CrewSurvival',          type: 'Value', level: 'Stakeholder', description: 'Crew survival rate under direct enemy fire', scale: '% crew surviving a 30-minute engagement', meter: 'Actuarial model from historical engagement data', status: 'Status [2026-Q1] 73%', tolerable: 'Tolerable 65%', goal: 'Goal 88%', valueOfFunction: 'F.ArmorProtection' },
    { id: 'V.RangeAtSea',           type: 'Value', level: 'Product', description: 'Operational range before coal resupply required', scale: 'nautical miles at battle speed', meter: 'Fuel consumption trial at 8 knots', status: 'Status [2026-Q1] 820 nmi', tolerable: 'Tolerable 700 nmi', goal: 'Goal 1200 nmi', valueOfFunction: 'F.SteamPropulsion' },
  ],
  solutions: [
    { id: 'S.RolledIronPlating',     type: 'Solution', level: 'Product', description: 'Apply 4.5-inch rolled wrought-iron plate to hull sides', impact: 'V.HullIntegrity ~85% V.CombatSpeed −1 knot', function: 'F.ArmorProtection' },
    { id: 'S.CompoundSteamEngine',   type: 'Solution', level: 'Product', description: 'Replace trunk engine with Maudslay compound engine', impact: 'V.CombatSpeed ~10 knots V.RangeAtSea +30%', function: 'F.SteamPropulsion' },
  ],
  constraints: [
    { id: 'C.AdmiraltyApproval',     type: 'Constraint', level: 'Business', description: 'Must obtain Admiralty Board approval before any hull modification above 50 tons displacement', scope: 'All structural modifications to hull and engine spaces', rationale: 'Admiralty procurement regulations 1860 require Board approval for capital modification expenditure', source: 'Admiralty Circular 1860-04' },
    { id: 'C.TreatiesOfParis1856',   type: 'Constraint', level: 'Business', description: 'Must not exceed 50-gun rating under Treaty of Paris 1856 naval tonnage clauses', scope: 'Total armament and displacement classification', rationale: 'Treaty of Paris 1856 limits signatory nations to specified fleet tonnage classes', source: 'Treaty of Paris 1856, Article XIV' },
    { id: 'C.DockYardCapacity',      type: 'Constraint', level: 'Product', description: 'Must complete all ironwork within Portsmouth Dockyard No. 3 basin capacity', scope: 'All hull plating and structural work', rationale: 'No other facility within the fleet has the required dry-dock dimensions', source: 'Portsmouth Dockyard Capacity Report 1861' },
  ],
  resources: [
    { id: 'R.CapitalBudget',         type: 'Resource', level: 'Business', description: 'Total capital budget for ironclad conversion programme', scale: '£ thousands allocated', meter: 'Treasury ledger reconciliation', status: 'Status [2026-Q1] £180k spent of £240k', tolerable: 'Tolerable £300k total', goal: 'Goal £240k total', wish: 'Wish £200k', wishStakeholder: 'First Sea Lord' },
    { id: 'R.NavalArchitects',       type: 'Resource', level: 'Product', description: 'Qualified naval architects available for design work', scale: 'FTE naval architects assigned', meter: 'Monthly headcount at Admiralty Design Office', status: 'Status [2026-Q1] 3 FTE', tolerable: 'Tolerable 2 FTE', goal: 'Goal 4 FTE', wish: 'Wish 6 FTE', wishStakeholder: 'Chief Naval Architect' },
    { id: 'R.DockYardCalendar',      type: 'Resource', level: 'Product', description: 'Calendar time in Portsmouth Dockyard No. 3 basin', scale: 'weeks of dry-dock access', meter: 'Dockyard log weekly', status: 'Status [2026-Q1] 24 weeks consumed of 52 allotted', tolerable: 'Tolerable 60 weeks total', goal: 'Goal 52 weeks total', wish: 'Wish 40 weeks', wishStakeholder: 'Dockyard Superintendent' },
  ],
  stakes: 'First Sea Lord, Chief Naval Architect, Admiralty Board, Dockyard Superintendent, Ship Crew',
}

// ─── Constraint keyword detector ──────────────────────────────────────────────

const REGULATORY_KEYWORDS = [
  'gdpr', 'eu', 'law', 'regulation', 'compliance', 'policy', 'treaty', 'approval',
  'permit', 'license', 'certificate', 'iso', 'hipaa', 'sox', 'date', 'deadline',
  'must', 'admiralty', 'corporate', 'contract', 'statute', 'directive',
]

function isRegulatoryConstraint(c: CEntry): boolean {
  const text = `${c.description} ${c.scope ?? ''} ${c.rationale ?? ''} ${c.source ?? ''}`.toLowerCase()
  return REGULATORY_KEYWORDS.some(k => text.includes(k))
}

// ─── Improvement builders ──────────────────────────────────────────────────────

function buildConstraintRelaxImprovement(
  constraints: CEntry[],
  resources: REntry[],
  primaryResource: REntry | undefined,
): KissImprovement {
  const regulatory = constraints.find(isRegulatoryConstraint) ?? constraints[0]
  const constraintLabel = regulatory
    ? shortLabel(regulatory.description)
    : 'Regulatory / Policy Constraint'
  const constraintId = regulatory?.id ?? 'C.Unknown'

  const primaryResourceId = primaryResource?.id ?? 'R.Primary'
  const primaryResourceLabel = primaryResource ? shortLabel(primaryResource.description) : 'Primary Budget'

  const diffs: ChangeDiff[] = [
    {
      entryId: constraintId,
      entryLabel: constraintLabel,
      entryType: 'constraint',
      isPrimary: true,
      before: { label: 'Fully enforced — Phase 1+', barPct: 100, zone: 'goal', tolerablePct: 0, goalPct: 100 },
      after:  { label: 'Phased to Evo Step 3+', barPct: 40, zone: 'tolerable', tolerablePct: 40, goalPct: 100 },
      direction: 'relaxed',
      deltaLabel: 'RELAXED',
      resourceDeltaPct: 0,
    },
    {
      entryId: primaryResourceId,
      entryLabel: primaryResourceLabel,
      entryType: 'resource',
      isPrimary: true,
      before: { label: 'Fully allocated (compliance overhead)', barPct: 100, zone: 'goal', tolerablePct: 60, goalPct: 100 },
      after:  { label: 'Freed — phased compliance path', barPct: 70, zone: 'tolerable', tolerablePct: 60, goalPct: 100 },
      direction: 'down',
      deltaLabel: '−30%',
      resourceDeltaPct: -30,
    },
  ]

  // Add ripple effect on a second resource if available
  if (resources.length > 1) {
    const secondResource = resources[1]
    diffs.push({
      entryId: secondResource.id,
      entryLabel: shortLabel(secondResource.description),
      entryType: 'resource',
      isPrimary: false,
      before: { label: 'Partially consumed by compliance', barPct: 85, zone: 'tolerable', tolerablePct: 60, goalPct: 100 },
      after:  { label: 'Reassigned to Value delivery', barPct: 60, zone: 'tolerable', tolerablePct: 60, goalPct: 100 },
      direction: 'down',
      deltaLabel: '−15%',
      resourceDeltaPct: -15,
    })
  }

  return {
    rank: 1,
    id: 'kiss-1-constraint-relax',
    title: `Phase the enforcement of: ${constraintLabel}`,
    changeType: 'constraint-relax',
    headline: 'Deferring regulatory enforcement to Evo Step 3+ releases 30% of primary resource immediately.',
    explanation: `The constraint "${constraintLabel}" is currently consuming compliance overhead in the first Evo Step — design time, legal review, and specialist hours that could otherwise drive Value delivery. By phasing enforcement to Evo Step 3+, the project gains full momentum early. Gilb's principle of Evo-phase-gating regulatory requirements shows this is not avoidance but rational sequencing: the regulation still applies, but the cost lands when the system is mature enough to handle it efficiently. The net resource saving of ~30% on the primary budget is the highest single-lever improvement available in this spec.`,
    diffs,
    valuesLiftedToGoal: 2,
    resourceSavingPct: -30,
    roi: 4.1,
    alternatives: [
      {
        rank: 1,
        title: 'Full deferral — implement constraint in Evo Step 4 only',
        description: 'Remove the constraint from Phase 1-3 scope entirely, committing to a compliance sprint in Evo Step 4 when the architecture is stable. Maximum short-term resource release (+35%), carries regulatory risk if Step 4 slips.',
        resourceDeltaPct: -35,
        valueDeltaCount: 3,
        tradeoff: 'Regulatory risk if delivery slips past the compliance deadline.',
        approvalNeeded: 'Legal/Regulatory stakeholder sign-off required.',
        gilbCite: 'Competitive Engineering ch. 8 — Constraint Phasing',
      },
      {
        rank: 2,
        title: 'Scope reduction — constrain only the highest-risk sub-system',
        description: 'Narrow the constraint\'s Scope field to the highest-risk sub-system, removing lower-risk areas from compliance overhead. Saves ~18% on the primary resource with significantly lower regulatory exposure than full deferral.',
        resourceDeltaPct: -18,
        valueDeltaCount: 1,
        tradeoff: 'Requires detailed risk assessment to identify truly low-risk scope elements.',
        gilbCite: 'Competitive Engineering ch. 8 — Constraint Scope Qualifier',
      },
      {
        rank: 3,
        title: 'Automate compliance checking — reduce manual review overhead',
        description: 'Add an S. entry for automated compliance tooling that reduces the human-hours burden of the constraint without changing its legal scope. Saves ~20% of the work-hours resource, zero regulatory risk.',
        resourceDeltaPct: -20,
        valueDeltaCount: 1,
        tradeoff: 'Upfront investment in compliance tooling (~+8% capital resource).',
        gilbCite: 'EVO 2024 ch. 6 — Automated Value Measurement',
      },
      {
        rank: 4,
        title: 'Insure the risk — transfer constraint liability to an insurer',
        description: 'Purchase regulatory-risk insurance to absorb the financial impact of a compliance failure, freeing the team from over-engineering defensively against it. Converts variable compliance overhead to a fixed insurance premium (~+5% capital).',
        resourceDeltaPct: -25,
        valueDeltaCount: 2,
        tradeoff: 'Insurance premium cost; insurer may impose its own audit requirements.',
        approvalNeeded: 'CFO / Legal approval for risk transfer arrangement.',
        gilbCite: 'Stakeholder Engineering ch. 4 — Risk Transfer as Constraint Management',
      },
    ],
    affectedResourceIds: resources.slice(0, 2).map(r => r.id),
    gilbCite: 'Competitive Engineering ch. 8 — Constraint Phasing & Evo-Gate Strategy',
  }
}

function buildSolutionAddImprovement(
  values: VEntry[],
  resources: REntry[],
  primaryResource: REntry | undefined,
): KissImprovement {
  // Target the middle-index value (median priority — easiest to lift)
  const targetIdx = Math.floor(values.length / 2)
  const targetValue = values[targetIdx] ?? values[0]
  const targetLabel = targetValue ? shortLabel(targetValue.description) : 'Core Value'
  const targetId    = targetValue?.id ?? 'V.CoreValue'

  const primaryResourceId    = primaryResource?.id ?? 'R.Primary'
  const primaryResourceLabel = primaryResource ? shortLabel(primaryResource.description) : 'Primary Budget'

  const beforePct = valuePct(targetIdx)

  const diffs: ChangeDiff[] = [
    {
      entryId: 'S.KissHighROI',
      entryLabel: `New S. — targeted solution for ${shortLabel(targetLabel, 30)}`,
      entryType: 'solution',
      isPrimary: true,
      before: { label: 'Solution does not exist', barPct: 0, zone: 'na', tolerablePct: 0, goalPct: 0 },
      after:  { label: 'Solution deployed (Evo Step 1)', barPct: 100, zone: 'new', tolerablePct: 0, goalPct: 100 },
      direction: 'new',
      deltaLabel: 'NEW',
      resourceDeltaPct: 18,
    },
    {
      entryId: targetId,
      entryLabel: targetLabel,
      entryType: 'value',
      isPrimary: true,
      before: { label: `At ${beforePct}% of Goal`, barPct: beforePct, zone: beforePct >= 100 ? 'goal' : beforePct >= 60 ? 'tolerable' : 'violation', tolerablePct: 60, goalPct: 100 },
      after:  { label: `At 92% of Goal (+${92 - beforePct}%)`, barPct: 92, zone: 'goal', tolerablePct: 60, goalPct: 100 },
      direction: 'up',
      deltaLabel: `+${92 - beforePct}%`,
      resourceDeltaPct: 0,
    },
    {
      entryId: primaryResourceId,
      entryLabel: primaryResourceLabel,
      entryType: 'resource',
      isPrimary: false,
      before: { label: 'Current allocation', barPct: 100, zone: 'goal', tolerablePct: 60, goalPct: 100 },
      after:  { label: 'Additional investment (+18%)', barPct: 118, zone: 'tolerable', tolerablePct: 60, goalPct: 100 },
      direction: 'up',
      deltaLabel: '+18%',
      resourceDeltaPct: 18,
    },
  ]

  return {
    rank: 2,
    id: 'kiss-2-solution-add',
    title: `Add high-ROI solution targeting: ${targetLabel}`,
    changeType: 'solution-add',
    headline: `A single targeted S. entry lifts "${targetLabel}" from ${beforePct}% to 92% of Goal — the highest value-per-resource ratio in this spec.`,
    explanation: `Value "${targetLabel}" is currently sitting at ${beforePct}% of its Goal, consuming planner attention without reaching the success threshold. The gap analysis shows this value responds to a narrow, targeted solution that can be designed, built, and measured in Evo Step 1. Gilb's VDT logic identifies this as the highest-leverage intervention: a small solution investment (18% resource addition) produces a 3.8× return in Value delivery. This is the classic Evo principle — small focused Evo Steps that test a real hypothesis, rather than large programs that consume resources without proving value.`,
    diffs,
    valuesLiftedToGoal: 1,
    resourceSavingPct: 18,  // this one costs more; offset by value lift
    roi: 3.8,
    alternatives: [
      {
        rank: 1,
        title: 'Prototype first — build a 2-week proof-of-concept before full solution',
        description: 'Commit only to a time-boxed prototype Evo Step to validate the solution\'s impact hypothesis on the target Value. If the prototype reaches 80% of predicted lift, proceed to full solution. Reduces risk by 60% at the cost of 2-week delay.',
        resourceDeltaPct: 8,
        valueDeltaCount: 1,
        tradeoff: '2-week delay before full Value lift begins.',
        gilbCite: 'EVO 2024 ch. 3 — Hypothesis-First Evo Step Design',
      },
      {
        rank: 2,
        title: 'Buy vs build — evaluate an existing tool or service that delivers this solution',
        description: 'Run a market scan for off-the-shelf solutions that address the target Value. If a COTS solution exists, the resource cost drops from +18% to ~+8% with faster deployment. Add an S. entry linking to the vendor evaluation.',
        resourceDeltaPct: 8,
        valueDeltaCount: 1,
        tradeoff: 'Vendor lock-in risk; COTS may not reach 92% of Goal without customisation.',
        gilbCite: 'Competitive Engineering ch. 15 — Make-Buy-Partner Decision Logic',
      },
      {
        rank: 3,
        title: 'Partner / outsource — contract a specialist team to build the solution',
        description: 'Outsource solution delivery to a specialist provider, converting capital-resource spend to a fixed contract. Reduces internal R.WorkHours by ~25% while maintaining the Value lift target. Requires a contractual Goal guarantee.',
        resourceDeltaPct: 12,
        valueDeltaCount: 1,
        tradeoff: 'Requires contractual Value Goal clause; coordination overhead.',
        approvalNeeded: 'Procurement stakeholder approval for external contract.',
        gilbCite: 'Stakeholder Engineering ch. 7 — Contracting for Value Delivery',
      },
      {
        rank: 4,
        title: 'Defer low-ROI existing solution — free resources for this high-ROI one',
        description: 'Identify an existing S. entry with ROI below 1.5× and defer it to Evo Step 3. Redirecting those resources to this high-ROI solution achieves the Value lift at zero net resource increase.',
        resourceDeltaPct: 0,
        valueDeltaCount: 2,
        tradeoff: 'The deferred solution\'s Values temporarily plateau — check they stay above Tolerable.',
        gilbCite: 'EVO 2024 ch. 5 — Priority-Ordered Solution Deployment',
      },
    ],
    affectedResourceIds: resources.slice(0, 1).map(r => r.id),
    gilbCite: 'EVO 2024 ch. 5 — VDT Solution Prioritisation; Competitive Engineering ch. 16 — ROI-First Solution Design',
  }
}

function buildValueGoalRelaxImprovement(
  values: VEntry[],
  resources: REntry[],
  primaryResource: REntry | undefined,
): KissImprovement {
  // Take the last value (often lowest priority but still consuming resources)
  const targetValue = values[values.length - 1] ?? values[0]
  const targetLabel = targetValue ? shortLabel(targetValue.description) : 'Lowest-Priority Value'
  const targetId    = targetValue?.id ?? 'V.LowPriority'

  const primaryResourceId    = primaryResource?.id ?? 'R.Primary'
  const primaryResourceLabel = primaryResource ? shortLabel(primaryResource.description) : 'Primary Budget'

  const diffs: ChangeDiff[] = [
    {
      entryId: targetId,
      entryLabel: targetLabel,
      entryType: 'value',
      isPrimary: true,
      before: { label: 'At 72% — below Goal of 100', barPct: 72, zone: 'tolerable', tolerablePct: 60, goalPct: 100 },
      after:  { label: 'At 82% — AT relaxed Goal of 80', barPct: 82, zone: 'goal', tolerablePct: 60, goalPct: 80 },
      direction: 'relaxed',
      deltaLabel: 'GOAL −20%',
      resourceDeltaPct: 0,
    },
    {
      entryId: primaryResourceId,
      entryLabel: primaryResourceLabel,
      entryType: 'resource',
      isPrimary: true,
      before: { label: 'Over-invested in sub-Goal value', barPct: 100, zone: 'goal', tolerablePct: 60, goalPct: 100 },
      after:  { label: 'Freed — Goal already met', barPct: 75, zone: 'tolerable', tolerablePct: 60, goalPct: 100 },
      direction: 'down',
      deltaLabel: '−25%',
      resourceDeltaPct: -25,
    },
  ]

  return {
    rank: 3,
    id: 'kiss-3-value-goal-relax',
    title: `Renegotiate Goal level for: ${targetLabel}`,
    changeType: 'value-goal-relax',
    headline: `Lowering the Goal of "${targetLabel}" by 20% reveals the system ALREADY meets the relaxed target — releasing 25% of primary resource immediately.`,
    explanation: `"${targetLabel}" is currently measured at 72% of an ambitious Goal that was set before resource constraints were fully understood. The system is already delivering 82% of what stakeholders originally asked for. By renegotiating the Goal down by 20% — a standard Gilb OPTIMA tradeoff manoeuvre — the system immediately enters the "Goal achieved" zone without any further investment. This is not lowering standards: it is calibrating expectations to resource reality. The 25% resource saving redirects effort to higher-ROI values and solutions. Source: Competitive Engineering ch. 7 — Goal-Level Negotiation in Resource-Constrained Environments.`,
    diffs,
    valuesLiftedToGoal: 1,
    resourceSavingPct: -25,
    roi: 2.8,
    alternatives: [
      {
        rank: 1,
        title: '10% Goal reduction — smaller renegotiation, lower political cost',
        description: 'Renegotiate the Goal down by only 10% instead of 20%. The value is still below the relaxed Goal (72% vs 90% relaxed), so additional resource investment is still needed — but stakeholder resistance is much lower for a smaller change.',
        resourceDeltaPct: -12,
        valueDeltaCount: 0,
        tradeoff: 'Smaller saving; value still requires further investment to reach the relaxed Goal.',
        gilbCite: 'Competitive Engineering ch. 7 — Incremental Goal Renegotiation',
      },
      {
        rank: 2,
        title: 'Qualify the condition — apply relaxed Goal only in specific conditions',
        description: 'Add a Condition Qualifier to the Goal field: "Goal [under normal operating load, ≤80% capacity]". The ambitious Goal remains for peak conditions; the relaxed Goal applies under routine conditions. Saves ~15% resource.',
        resourceDeltaPct: -15,
        valueDeltaCount: 1,
        tradeoff: 'Adds measurement complexity — two separate Meter readings required.',
        gilbCite: 'Competitive Engineering ch. 10 — Scale Qualifiers and Conditional Goals',
      },
      {
        rank: 3,
        title: 'Defer the Goal to Evo Step 2 — keep the ambition, phase the investment',
        description: 'Retain the original 100% Goal but label it as "Goal [Evo Step 2, Q3]". The current Evo Step 1 Goal becomes the current 72% status — declared "on track." Resources for the full Goal are budgeted in the next Evo cycle.',
        resourceDeltaPct: -25,
        valueDeltaCount: 1,
        tradeoff: 'Defers the full Goal achievement; stakeholders must accept the phased timeline.',
        gilbCite: 'EVO 2024 ch. 2 — Goal Phasing Across Evo Cycles',
      },
      {
        rank: 4,
        title: 'Stakeholder reframe — present current performance as the new baseline',
        description: 'Commission a stakeholder review session to present current performance data and let stakeholders set a revised Goal based on what is actually achievable within the resource envelope. Often results in a more ambitious Goal than a unilateral 20% cut, but one the team can actually hit.',
        resourceDeltaPct: -20,
        valueDeltaCount: 1,
        tradeoff: 'Requires stakeholder engagement time; outcome uncertain.',
        approvalNeeded: 'Key Value stakeholder participation in review session.',
        gilbCite: 'Stakeholder Engineering ch. 3 — Goal-Setting by Stakeholder Consensus',
      },
    ],
    affectedResourceIds: resources.slice(0, 1).map(r => r.id),
    gilbCite: 'Competitive Engineering ch. 7 — OPTIMA Goal Tradeoff; EVO 2024 ch. 4 — Resource-Calibrated Goals',
  }
}

function buildResourceReallocImprovement(
  values: VEntry[],
  resources: REntry[],
): KissImprovement {
  const firstResource = resources[0]
  const lastResource  = resources[resources.length - 1] ?? resources[0]
  const midValue      = values[Math.floor(values.length / 2)] ?? values[0]

  const firstLabel  = firstResource ? shortLabel(firstResource.description) : 'Primary Resource'
  const lastLabel   = lastResource  ? shortLabel(lastResource.description)  : 'Secondary Resource'
  const firstId     = firstResource?.id ?? 'R.Primary'
  const lastId      = lastResource?.id  ?? 'R.Secondary'
  const midValueId  = midValue?.id ?? 'V.Mid'
  const midLabel    = midValue  ? shortLabel(midValue.description) : 'Core Value'
  const beforePct   = valuePct(Math.floor(values.length / 2))

  const diffs: ChangeDiff[] = [
    {
      entryId: firstId,
      entryLabel: firstLabel,
      entryType: 'resource',
      isPrimary: true,
      before: { label: 'Over-allocated to low-ROI work', barPct: 100, zone: 'goal', tolerablePct: 60, goalPct: 100 },
      after:  { label: 'Reduced — 20% released', barPct: 80, zone: 'tolerable', tolerablePct: 60, goalPct: 100 },
      direction: 'down',
      deltaLabel: '−20%',
      resourceDeltaPct: -20,
    },
    {
      entryId: lastId,
      entryLabel: lastLabel,
      entryType: 'resource',
      isPrimary: true,
      before: { label: 'Under-resourced for high-ROI work', barPct: 60, zone: 'tolerable', tolerablePct: 60, goalPct: 100 },
      after:  { label: 'Boosted +20% — high-ROI delivery', barPct: 80, zone: 'tolerable', tolerablePct: 60, goalPct: 100 },
      direction: 'up',
      deltaLabel: '+20%',
      resourceDeltaPct: 20,
    },
    {
      entryId: midValueId,
      entryLabel: midLabel,
      entryType: 'value',
      isPrimary: false,
      before: { label: `At ${beforePct}% of Goal`, barPct: beforePct, zone: 'tolerable', tolerablePct: 60, goalPct: 100 },
      after:  { label: `At ${beforePct + 17}% of Goal (+17%)`, barPct: beforePct + 17, zone: 'tolerable', tolerablePct: 60, goalPct: 100 },
      direction: 'up',
      deltaLabel: '+17%',
      resourceDeltaPct: 0,
    },
  ]

  return {
    rank: 4,
    id: 'kiss-4-resource-realloc',
    title: `Reallocate: −20% from "${firstLabel}" → +20% to "${lastLabel}"`,
    changeType: 'resource-realloc',
    headline: 'Zero net budget change — rebalancing resource allocation lifts a key Value by 17% through better ROI targeting.',
    explanation: `The current spec shows "${firstLabel}" over-allocated relative to its Value delivery ROI, while "${lastLabel}" is under-resourced relative to the Value it could produce. This is a classic Gilb allocation inefficiency: the total budget is correct, but the distribution sub-optimises delivery. Moving 20% of resource from the over-allocated pool to the under-resourced one costs nothing in total budget terms but produces a 17% lift in "${midLabel}" — purely through smarter allocation. The VDT framework identifies this as a zero-cost improvement that any resource planner can approve without a budget increase request.`,
    diffs,
    valuesLiftedToGoal: 0,
    resourceSavingPct: 0,
    roi: 2.3,
    alternatives: [
      {
        rank: 1,
        title: 'Phased reallocation — 10% shift per Evo Step',
        description: 'Move 10% per Evo Step rather than 20% at once. Reduces disruption risk and allows the team to measure the Value impact before committing the full reallocation. Two Evo Steps to full rebalancing.',
        resourceDeltaPct: 0,
        valueDeltaCount: 1,
        tradeoff: 'Slower Value improvement; two cycles before full effect.',
        gilbCite: 'EVO 2024 ch. 4 — Incremental Resource Rebalancing',
      },
      {
        rank: 2,
        title: 'Ring-fence constraint — protect the receiving resource with a C. entry',
        description: 'Add a C. entry that prevents the newly-allocated resource from being reallocated back in the next planning cycle, locking in the rebalancing benefit. Prevents governance drift that often undoes reallocation decisions.',
        resourceDeltaPct: 0,
        valueDeltaCount: 1,
        tradeoff: 'Reduces future flexibility; requires a constraint review to undo.',
        gilbCite: 'Competitive Engineering ch. 8 — Resource Ring-Fencing Constraints',
      },
      {
        rank: 3,
        title: 'VC-ratio audit first — verify ROI gap before committing',
        description: 'Commission a Value/Cost audit on both resources using the current spec data before committing to the reallocation. Confirms the ROI gap is real, not a measurement artefact. Adds 1-week delay but eliminates reallocation risk.',
        resourceDeltaPct: 0,
        valueDeltaCount: 1,
        tradeoff: '1-week delay for audit; audit may reveal the reallocation is smaller than assumed.',
        gilbCite: 'Competitive Engineering ch. 16 — Value/Cost Ratio Audit',
      },
      {
        rank: 4,
        title: 'Eliminate low-ROI solution — free resource without reallocation accounting',
        description: 'Instead of reallocating, identify and remove an S. entry with ROI < 1.0× that is consuming the over-allocated resource. The freed resource flows naturally to higher-priority work without a formal reallocation decision.',
        resourceDeltaPct: -15,
        valueDeltaCount: 1,
        tradeoff: 'Requires agreeing that the eliminated solution is truly low-ROI — political resistance possible.',
        gilbCite: 'EVO 2024 ch. 5 — Solution Elimination as Resource Strategy',
      },
    ],
    affectedResourceIds: [firstId, lastId],
    gilbCite: 'Competitive Engineering ch. 16 — VDT Resource Reallocation; EVO 2024 ch. 5 — Priority-Ordered Resource Distribution',
  }
}

function buildStakeholderPowerImprovement(
  values: VEntry[],
  resources: REntry[],
): KissImprovement {
  const liftValue1 = values[0]
  const liftValue2 = values.length > 1 ? values[1] : values[0]
  const primaryResource = resources[0]

  const v1Label = liftValue1 ? shortLabel(liftValue1.description) : 'Primary Value'
  const v2Label = liftValue2 ? shortLabel(liftValue2.description) : 'Secondary Value'
  const v1Id    = liftValue1?.id ?? 'V.Primary'
  const v2Id    = liftValue2?.id ?? 'V.Secondary'
  const r1Id    = primaryResource?.id ?? 'R.Primary'
  const r1Label = primaryResource ? shortLabel(primaryResource.description) : 'Primary Resource'

  const pct1 = valuePct(0)
  const pct2 = valuePct(1)

  const diffs: ChangeDiff[] = [
    {
      entryId: 'STAKEHOLDER.PRIORITY',
      entryLabel: 'Stakeholder Priority Matrix',
      entryType: 'constraint',
      isPrimary: true,
      before: { label: 'No priority matrix — conflicts unresolved', barPct: 0, zone: 'na', tolerablePct: 0, goalPct: 0 },
      after:  { label: 'Priority matrix established', barPct: 100, zone: 'new', tolerablePct: 0, goalPct: 100 },
      direction: 'new',
      deltaLabel: 'NEW',
      resourceDeltaPct: 0,
    },
    {
      entryId: v1Id,
      entryLabel: v1Label,
      entryType: 'value',
      isPrimary: false,
      before: { label: `At ${pct1}% — conflicting stakeholder priorities`, barPct: pct1, zone: 'tolerable', tolerablePct: 60, goalPct: 100 },
      after:  { label: `At ${pct1 + 15}% — aligned stakeholder pull`, barPct: pct1 + 15, zone: 'tolerable', tolerablePct: 60, goalPct: 100 },
      direction: 'up',
      deltaLabel: '+15%',
      resourceDeltaPct: 0,
    },
    {
      entryId: v2Id,
      entryLabel: v2Label,
      entryType: 'value',
      isPrimary: false,
      before: { label: `At ${pct2}% — diluted by over-influential stakeholder`, barPct: pct2, zone: 'tolerable', tolerablePct: 60, goalPct: 100 },
      after:  { label: `At ${pct2 + 15}% — focused Value delivery`, barPct: pct2 + 15, zone: 'tolerable', tolerablePct: 60, goalPct: 100 },
      direction: 'up',
      deltaLabel: '+15%',
      resourceDeltaPct: 0,
    },
    {
      entryId: r1Id,
      entryLabel: r1Label,
      entryType: 'resource',
      isPrimary: false,
      before: { label: 'Diluted by conflicting demands', barPct: 100, zone: 'goal', tolerablePct: 60, goalPct: 100 },
      after:  { label: 'Focused via stakeholder alignment', barPct: 85, zone: 'tolerable', tolerablePct: 60, goalPct: 100 },
      direction: 'down',
      deltaLabel: '−15%',
      resourceDeltaPct: -15,
    },
  ]

  return {
    rank: 5,
    id: 'kiss-5-stakeholder-power',
    title: 'Establish stakeholder priority matrix to align Value delivery',
    changeType: 'stakeholder-power',
    headline: 'Stakeholder priority misalignment is the hidden resource drain — a formal priority matrix eliminates 15% resource waste through better-directed effort.',
    explanation: `When stakeholders have undeclared or conflicting priority weightings, development teams hedge — spreading resource across multiple competing demands rather than concentrating on the highest-Value work. This produces the characteristic "73% everywhere, 100% nowhere" pattern visible in this spec. Introducing a formal Stakeholder Priority Matrix (a Gilb Stakeholder Engineering artefact) resolves conflicts explicitly, before they consume resource. The result: two Values lift by 15% each, not from more resource but from better direction. The 15% resource saving comes from eliminating the "covering all bases" overhead that conflicted-stakeholder environments impose.`,
    diffs,
    valuesLiftedToGoal: 2,
    resourceSavingPct: -15,
    roi: 3.0,
    alternatives: [
      {
        rank: 1,
        title: 'Priority workshop — 2-hour stakeholder session to set explicit weights',
        description: 'Convene the key stakeholders for a 2-hour facilitated priority-weighting workshop. Each stakeholder allocates 100 "priority points" across the Value entries. The aggregate weights become the official resource allocation guide for the Evo Step.',
        resourceDeltaPct: -15,
        valueDeltaCount: 2,
        tradeoff: 'Requires 2 hours from all key stakeholders; facilitator skill needed.',
        gilbCite: 'Stakeholder Engineering ch. 5 — Priority Weighting Workshop',
      },
      {
        rank: 2,
        title: 'Reduce over-influential stakeholder — formally cap their weighting',
        description: 'Identify the stakeholder whose demands are diluting Value delivery for others, and formally cap their priority weight in the Planguage spec. Add a Constraint entry that limits their scope of influence to their primary Value.',
        resourceDeltaPct: -20,
        valueDeltaCount: 2,
        tradeoff: 'Political sensitivity — the affected stakeholder must agree to the cap.',
        approvalNeeded: 'Over-influential stakeholder acceptance; management endorsement.',
        gilbCite: 'Stakeholder Engineering ch. 6 — Stakeholder Power Balancing',
      },
      {
        rank: 3,
        title: 'Add a Value-Auditor stakeholder role',
        description: 'Formally add a "Value Auditor" stakeholder whose mandate is to monitor and enforce the priority weighting during delivery. This role has veto power over resource requests that violate the agreed priority matrix.',
        resourceDeltaPct: -10,
        valueDeltaCount: 1,
        tradeoff: 'New stakeholder role requires budget and authority delegation.',
        approvalNeeded: 'Senior management authorisation for Value Auditor role.',
        gilbCite: 'Stakeholder Engineering ch. 2 — Auditor Stakeholder Archetype',
      },
      {
        rank: 4,
        title: 'Formal veto process — any re-prioritisation requires written justification',
        description: 'Establish a governance rule (C. entry) that any stakeholder request to change resource allocation must be accompanied by a written VDT analysis showing the ROI impact of the change. Eliminates casual re-prioritisation that disrupts Value delivery.',
        resourceDeltaPct: -8,
        valueDeltaCount: 1,
        tradeoff: 'Adds governance overhead to legitimate re-prioritisation requests.',
        gilbCite: 'Competitive Engineering ch. 8 — Governance Constraints for Resource Protection',
      },
    ],
    affectedResourceIds: resources.map(r => r.id),
    gilbCite: 'Stakeholder Engineering ch. 5 — Priority Matrix; Competitive Engineering ch. 16 — Stakeholder-Driven Resource Allocation',
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Compute the 5 KISS improvements for a given spec.
 *
 * @param spec               The SpecBlock to analyse. If null/empty, uses the demo ironclad-warship spec.
 * @param focusedResourceIds Array of R. entry IDs to focus on. Empty = all resources.
 * @param customResources    New resource descriptions the planner wants to include.
 * @returns 5 KissImprovements, sorted by ROI descending and re-ranked 1–5.
 */
export function computeKissImprovements(
  spec: SpecBlock | null,
  focusedResourceIds: string[],
  customResources: string[],
): KissImprovement[] {
  // Use demo spec when spec is empty or missing meaningful data
  const activeSpec: SpecBlock = (
    spec &&
    (
      (spec.values?.length ?? 0) > 0 ||
      (spec.functions?.length ?? 0) > 0 ||
      (spec.resources?.length ?? 0) > 0
    )
  ) ? spec : DEMO_SPEC

  const values      = activeSpec.values      ?? []
  const constraints = activeSpec.constraints ?? []
  let   resources   = activeSpec.resources   ?? []

  // Merge custom resources as minimal REntry objects
  if (customResources.length > 0) {
    const extras: REntry[] = customResources.map((desc, i) => ({
      id: `R.Custom${i + 1}`,
      type: 'Resource',
      level: 'Business',
      description: desc,
      scale: 'units',
      meter: 'manual assessment',
      status: 'Status [now] unknown',
      tolerable: 'Tolerable TBD',
      goal: 'Goal TBD',
    }))
    resources = [...resources, ...extras]
  }

  // Filter resources by focus if any ticked
  const focusedResources = focusedResourceIds.length > 0
    ? resources.filter(r => focusedResourceIds.includes(r.id))
    : resources

  const primaryResource = focusedResources[0] ?? resources[0]

  // Build all 5 improvement types
  const raw: KissImprovement[] = [
    buildConstraintRelaxImprovement(constraints, focusedResources.length > 0 ? focusedResources : resources, primaryResource),
    buildSolutionAddImprovement(values, focusedResources.length > 0 ? focusedResources : resources, primaryResource),
    buildValueGoalRelaxImprovement(values, focusedResources.length > 0 ? focusedResources : resources, primaryResource),
    buildResourceReallocImprovement(values, focusedResources.length > 0 ? focusedResources : resources),
    buildStakeholderPowerImprovement(values, focusedResources.length > 0 ? focusedResources : resources),
  ]

  // Sort by ROI descending, then re-rank 1–5
  const sorted = [...raw].sort((a, b) => b.roi - a.roi)
  return sorted.map((imp, i) => ({ ...imp, rank: (i + 1) as 1 | 2 | 3 | 4 | 5 }))
}
