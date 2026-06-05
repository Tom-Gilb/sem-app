// usePlanHealth.ts — Feature #202: Plan Health (PHI = Plan Health Index)
//
// Part of Governance. A weighted, editable formula over a catalog of Plan
// Health Aspects, grouped into Aspect Groups, that produces a single
// Plan Health Index in the range −100% (catastrophe) … +100% (perfect &
// guaranteed success).  The PHI shows on the Plan ID Bar as a large coloured
// circle that turns red below 0 and emerald above 75; below 50 it vibrates.
//
// Design contract (Tom):
//   • Aspects, groups, and weights are visible and editable.
//   • Within each group, aspect weights sum to 100%.
//   • Groups themselves carry a weight (also summing to 100%) so the overall
//     PHI is `Σ groupWeight × Σ aspectWeight × aspectScore`.
//   • Aspects can be added or removed by the Plan Owner / a documented
//     responsible Instance, but every weight change, addition or removal
//     requires a `reason` and a stamped audit row.
//   • PHI subsets (per group, per aspect set) can gate Plan Process
//     entry/exit conditions — exposed via `groupIndex(groupId)`.
//
// MVP catalog: 6 groups × 2–3 aspects = 16 default aspects. Three more groups
// (Stakeholder Alignment, Resource Health, Calibration / Evidence, Change
// Stability) are reserved as `available` but not seeded — added incrementally.

import { ref, computed } from 'vue'
import type { SpecBlock } from '../types/spec'
import { runAIExpertReview } from './useAIExpertReview'
import { readMigrated, writeBoth } from './useSpecKeyMigration'

// ── Aspect groups ────────────────────────────────────────────────────────────

export type AspectGroupId =
  | 'spec-defects'
  | 'inconsistencies'
  | 'rule-violations'
  | 'unknowns'
  | 'risks'
  | 'coverage'
  // ── AI Expert Reviewers — opt-in personas that contribute -10..+10 scores ──
  | 'ai-experts'
  // ── Reserved for incremental design (not seeded yet) ──
  | 'stakeholder-alignment'
  | 'resource-health'
  | 'calibration'
  | 'change-stability'

export interface AspectGroupMeta {
  id: AspectGroupId
  label: string
  icon: string
  /** What this group is *trying* to detect — shown as the group hint */
  hint: string
  /** Group weight in the overall PHI (0..1). Active groups should sum to 1. */
  defaultWeight: number
  /** True once the group has at least one seeded default aspect */
  seeded: boolean
}

export const ASPECT_GROUPS: Record<AspectGroupId, AspectGroupMeta> = {
  'spec-defects':         { id: 'spec-defects',         label: 'Spec Defects',         icon: '🩹', hint: 'Planguage syntax / structural problems',                  defaultWeight: 0.18, seeded: true },
  'inconsistencies':      { id: 'inconsistencies',      label: 'Inconsistencies',      icon: '🔀', hint: 'Contradictions across F. / V. / S.',                     defaultWeight: 0.16, seeded: true },
  'rule-violations':      { id: 'rule-violations',      label: 'Rule Violations',      icon: '🚦', hint: 'Governance and process rules broken',                    defaultWeight: 0.16, seeded: true },
  'unknowns':             { id: 'unknowns',             label: 'Unknowns',             icon: '❓', hint: 'Things deliberately not yet known',                      defaultWeight: 0.14, seeded: true },
  'risks':                { id: 'risks',                label: 'Risks',                icon: '⚠️', hint: 'Things that could blow up',                              defaultWeight: 0.18, seeded: true },
  'coverage':             { id: 'coverage',             label: 'Coverage',             icon: '🗺️', hint: 'Did we plan the whole thing?',                          defaultWeight: 0.18, seeded: true },
  // AI Experts is *seeded:false by default* so it adds nothing to the PHI math
  // until the Owner enables at least one Expert. addExpert() flips the group
  // on automatically + assigns a sensible default weight (0.15).
  'ai-experts':           { id: 'ai-experts',           label: 'AI Expert Reviews',    icon: '🧠', hint: 'Named AI personas (Security / ROI / Quality / …) score the plan',  defaultWeight: 0.00, seeded: false },
  'stakeholder-alignment':{ id: 'stakeholder-alignment',label: 'Stakeholder Alignment',icon: '🤝', hint: 'Are the people in the plan onside? (incremental)',     defaultWeight: 0.00, seeded: false },
  'resource-health':      { id: 'resource-health',      label: 'Resource Health',      icon: '⛽', hint: 'Are we still affordable? (links to Replan layer)',      defaultWeight: 0.00, seeded: false },
  'calibration':          { id: 'calibration',          label: 'Calibration',          icon: '🎯', hint: 'Are our estimates believable? (uses ActualsLog)',       defaultWeight: 0.00, seeded: false },
  'change-stability':     { id: 'change-stability',     label: 'Change Stability',     icon: '🌊', hint: 'Is the plan thrashing?',                                 defaultWeight: 0.00, seeded: false },
}

// ── Aspect ──────────────────────────────────────────────────────────────────

/**
 * The evaluator returns:
 *   • score   — in [-1, +1].  +1 = perfect, 0 = neutral/unknown, -1 = catastrophic.
 *   • detail  — human-readable explanation shown on hover / in the panel.
 *   • findings? — optional list of specific items contributing to the score
 *     (e.g. value IDs missing a Goal). Used in drill-down view.
 */
export interface AspectEvaluation {
  score: number
  detail: string
  findings?: string[]
}

export interface PlanHealthAspectDef {
  id: string
  group: AspectGroupId
  name: string
  description: string
  /** Aspect weight WITHIN its group (0..1). Group's aspects should sum to 1. */
  defaultWeight: number
  /** Pure function — takes whatever context the panel has and returns score + detail */
  evaluate: (ctx: SpecHealthContext) => AspectEvaluation
  /** True for the seeded defaults; user-added aspects are false */
  builtin: boolean
  /**
   * Optional auto-fix metadata — drives the ⚡ Auto-fix buttons in the Plan
   * Defects Panel. Three kinds:
   *   - 'deterministic' → `applyDeterministic` returns a patch directly with
   *     no LLM call. Cheap, instant, free.
   *   - 'ai'            → fix wiring requires an LLM call to propose the new
   *     field value. The description here is surfaced in the confirm dialog.
   *   - 'manual'        → no auto-fix; the ✏️ Fix button is the only path.
   *     Used for rules where the AI cannot safely guess (Plan Owner identity,
   *     stakeholder names, risk tolerances).
   */
  fix?: AspectFix
}

export type AspectFixKind = 'deterministic' | 'ai' | 'manual'

/** A single field-level patch operation against a SpecBlock. */
export type SpecPatchOp =
  | {
      kind: 'set-field'
      entryType: 'F' | 'V' | 'S'
      entryId: string
      field: string
      value: string
    }
  | {
      kind: 'rename-id'
      entryType: 'F' | 'V' | 'S'
      oldId: string
      newId: string
    }

export type SpecPatch = SpecPatchOp[]

export interface AspectFix {
  kind: AspectFixKind
  /** Plain-English description surfaced in the confirm dialog. */
  description: string
  /**
   * Only present for kind === 'deterministic'. Pure function: given the spec
   * context and the specific finding id (typically an F./V./S. entry id from
   * the AspectEvaluation.findings array), returns the patch ops to apply.
   */
  applyDeterministic?: (ctx: SpecHealthContext, finding: string) => SpecPatch
}

export interface SpecHealthContext {
  spec: SpecBlock
  /** From specModel.governance.specOwners */
  specOwnerCount: number
  /** True when specModel.owners has at least one Owner */
  hasSpecOwner: boolean
  /** Free-form key/value bag for incremental additions (actuals MAE, budgets, …) */
  signals?: Record<string, number | string | boolean>
}

/** @deprecated Use SpecHealthContext instead */
export type PlanHealthContext = SpecHealthContext

// ── Default aspect catalog (the seeded 16) ──────────────────────────────────

function ratioToScore(ratio: number): number {
  // Linear map [0..1] → [-1..+1]. 0 → -1, 0.5 → 0, 1 → +1.
  if (!Number.isFinite(ratio)) return 0
  if (ratio < 0) return -1
  if (ratio > 1) return 1
  return ratio * 2 - 1
}

function countBadFraction(badCount: number, total: number): number {
  // Fraction of good entries.  When total is 0 we return 1 (nothing to be wrong).
  if (total <= 0) return 1
  return Math.max(0, (total - badCount) / total)
}

const DEFAULT_ASPECTS: PlanHealthAspectDef[] = [
  // ── Spec Defects (3) ─────────────────────────────────────────────────────
  {
    id: 'sd-missing-scale', group: 'spec-defects', builtin: true,
    name: 'V. with no Scale', description: 'Every Value should declare a measurable Scale.',
    defaultWeight: 0.4,
    evaluate: ({ spec }) => {
      const bad = spec.values.filter(v => !v.scale?.trim()).map(v => v.id)
      return { score: ratioToScore(countBadFraction(bad.length, spec.values.length)), detail: `${bad.length} of ${spec.values.length} V. lack a Scale`, findings: bad }
    },
    fix: {
      kind: 'ai',
      description: 'Propose a measurable Scale unit (e.g. "Net Promoter Score, monthly") based on the Value description.',
    },
  },
  {
    id: 'sd-missing-goal', group: 'spec-defects', builtin: true,
    name: 'V. with no Goal', description: 'Every Value should declare a Goal threshold.',
    defaultWeight: 0.35,
    evaluate: ({ spec }) => {
      const bad = spec.values.filter(v => !v.goal?.trim()).map(v => v.id)
      return { score: ratioToScore(countBadFraction(bad.length, spec.values.length)), detail: `${bad.length} of ${spec.values.length} V. lack a Goal`, findings: bad }
    },
    fix: {
      kind: 'ai',
      description: 'Propose a Goal threshold (target value with date) using the existing Scale and Meter.',
    },
  },
  {
    id: 'sd-duplicate-ids', group: 'spec-defects', builtin: true,
    name: 'Duplicate IDs', description: 'F./V./S. IDs must be unique.',
    defaultWeight: 0.25,
    evaluate: ({ spec }) => {
      const all = [...spec.functions.map(f => f.id), ...spec.values.map(v => v.id), ...spec.solutions.map(s => s.id)]
      const seen = new Set<string>(); const dupes = new Set<string>()
      for (const id of all) { if (seen.has(id)) dupes.add(id); else seen.add(id) }
      const total = all.length || 1
      return { score: ratioToScore(countBadFraction(dupes.size, total)), detail: `${dupes.size} duplicate ID${dupes.size === 1 ? '' : 's'}`, findings: Array.from(dupes) }
    },
    fix: {
      kind: 'deterministic',
      description: 'Append " (2)", " (3)" suffixes to second-and-later occurrences so each ID becomes unique. The first occurrence is kept unchanged.',
      // Deterministic: scan all entries with the given duplicated id, leave the FIRST untouched,
      // rename the rest by appending " (2)", " (3)" etc. We emit rename-id ops only for the
      // duplicates so existing references to the original (first) id stay valid.
      applyDeterministic: ({ spec }, finding) => {
        const ops: SpecPatch = []
        // Bucket candidates by entryType. Even though the evaluator flags
        // cross-type bare-id collisions as duplicates, the fix only renames
        // within a single type bucket — F.Foo and V.Foo are semantically
        // different entries and a "(2)" suffix would be misleading.
        const byType: Array<{ entryType: 'F' | 'V' | 'S'; ids: string[] }> = [
          { entryType: 'F', ids: spec.functions.filter(f => f.id === finding).map(f => f.id) },
          { entryType: 'V', ids: spec.values.filter(v => v.id === finding).map(v => v.id) },
          { entryType: 'S', ids: spec.solutions.filter(s => s.id === finding).map(s => s.id) },
        ]
        for (const bucket of byType) {
          // Keep the first occurrence; rename the rest. The "(2)", "(3)" suffix counter
          // starts at 2 because the kept original IS the "(1)".
          for (let i = 1; i < bucket.ids.length; i++) {
            ops.push({
              kind: 'rename-id',
              entryType: bucket.entryType,
              oldId: bucket.ids[i],
              newId: `${bucket.ids[i]} (${i + 1})`,
            })
          }
        }
        return ops
      },
    },
  },

  // ── Inconsistencies (2) ──────────────────────────────────────────────────
  {
    id: 'ic-orphan-solutions', group: 'inconsistencies', builtin: true,
    name: 'S. impacts a non-existent V.', description: 'Solutions should reference declared Values.',
    defaultWeight: 0.55,
    evaluate: ({ spec }) => {
      const valueIds = new Set(spec.values.map(v => v.id))
      const allVIds = [...valueIds]
      const bad = spec.solutions.filter(s => {
        if (!(s.impact ?? '').trim()) return false
        return !allVIds.some(vid => (s.impact ?? '').includes(vid))
      }).map(s => s.id)
      return { score: ratioToScore(countBadFraction(bad.length, spec.solutions.length)), detail: `${bad.length} S. reference no declared V.`, findings: bad }
    },
    fix: {
      kind: 'ai',
      description: 'Propose which declared V. this Solution most likely Impacts based on the Solution description and existing V. set.',
    },
  },
  {
    id: 'ic-stale-status', group: 'inconsistencies', builtin: true,
    name: 'V. status already past Goal', description: 'A current measurement past Goal probably means Goal is stale.',
    defaultWeight: 0.45,
    evaluate: ({ spec }) => {
      const num = (s: string | undefined) => {
        if (!s) return null
        const m = s.replace(/\[[^\]]*\]/g, ' ').match(/-?\d+(?:\.\d+)?/)
        return m ? Number(m[0]) : null
      }
      const bad = spec.values.filter(v => {
        const cur = num(v.status); const goal = num(v.goal)
        return cur != null && goal != null && cur > goal * 1.05 // 5% tolerance
      }).map(v => v.id)
      return { score: ratioToScore(countBadFraction(bad.length, spec.values.length)), detail: `${bad.length} V. with status already past Goal`, findings: bad }
    },
    fix: {
      kind: 'manual',
      description: 'A stale Goal is a strategy decision — bumping it is the planner\'s call, not the AI\'s.',
    },
  },

  // ── Rule Violations (2) ──────────────────────────────────────────────────
  {
    id: 'rv-no-plan-owner', group: 'rule-violations', builtin: true,
    name: 'No Plan Owner set', description: 'Governance rule: every Plan needs an accountable Owner.',
    defaultWeight: 0.5,
    evaluate: ({ hasSpecOwner }) => ({ score: hasSpecOwner ? 1 : -1, detail: hasSpecOwner ? 'Spec Owner is set' : 'No Spec Owner — single point of accountability missing' }),
    fix: {
      kind: 'manual',
      description: 'Plan Owner identity must be set by a human — AI cannot guess who is accountable.',
    },
  },
  {
    id: 'rv-no-spec-owners', group: 'rule-violations', builtin: true,
    name: 'No Spec Owners assigned', description: 'Governance rule: spec areas should have named owners.',
    defaultWeight: 0.5,
    evaluate: ({ specOwnerCount }) => {
      // 0 → -1; 1 → 0; ≥3 → +1
      const score = specOwnerCount === 0 ? -1 : specOwnerCount >= 3 ? 1 : (specOwnerCount - 1) / 2
      return { score, detail: `${specOwnerCount} Spec Owner${specOwnerCount === 1 ? '' : 's'} assigned` }
    },
    fix: {
      kind: 'manual',
      description: 'Spec Owner assignments are organisational decisions — the planner picks from the existing planner roster.',
    },
  },

  // ── Unknowns (3) ─────────────────────────────────────────────────────────
  {
    id: 'uk-tbd-tokens', group: 'unknowns', builtin: true,
    name: 'TBD / TODO tokens', description: '"TBD" / "TODO" / "?" placeholders left in the spec.',
    defaultWeight: 0.4,
    evaluate: ({ spec }) => {
      const re = /\bTBD\b|\bTODO\b|\?\?\?/i
      const stringsOf = [
        ...spec.functions.flatMap(f => [f.description]),
        ...spec.values.flatMap(v => [v.description, v.scale, v.meter, v.status, v.goal, v.tolerable]),
        ...spec.solutions.flatMap(s => [s.description, s.impact]),
      ].filter(Boolean) as string[]
      const bad = stringsOf.filter(s => re.test(s)).length
      return { score: ratioToScore(countBadFraction(bad, stringsOf.length)), detail: `${bad} TBD/TODO tokens across the spec` }
    },
    fix: {
      kind: 'manual',
      description: 'A TBD/TODO marks a known unknown — replacing it with real content is the whole point of planning.',
    },
  },
  {
    id: 'uk-no-meter', group: 'unknowns', builtin: true,
    name: 'V. with no Meter', description: 'How will we actually measure this Value?',
    defaultWeight: 0.35,
    evaluate: ({ spec }) => {
      const bad = spec.values.filter(v => !v.meter?.trim()).map(v => v.id)
      return { score: ratioToScore(countBadFraction(bad.length, spec.values.length)), detail: `${bad.length} of ${spec.values.length} V. lack a Meter`, findings: bad }
    },
    fix: {
      kind: 'ai',
      description: 'Propose a measurement method (Meter) that pairs with the existing Scale.',
    },
  },
  {
    id: 'uk-wish-no-stakeholder', group: 'unknowns', builtin: true,
    name: 'Wish without Stakeholder', description: 'Aspirations need an accountable source.',
    defaultWeight: 0.25,
    evaluate: ({ spec }) => {
      const withWish = spec.values.filter(v => v.wish?.trim())
      const bad = withWish.filter(v => !v.wishStakeholder?.trim()).map(v => v.id)
      return { score: ratioToScore(countBadFraction(bad.length, withWish.length)), detail: `${bad.length} of ${withWish.length} Wish entries lack a Stakeholder`, findings: bad }
    },
    fix: {
      kind: 'manual',
      description: 'The stakeholder who voiced a Wish is a fact about who said it — humans only.',
    },
  },

  // ── Risks (2) ────────────────────────────────────────────────────────────
  {
    id: 'rk-single-owner', group: 'risks', builtin: true,
    name: 'Single-owner concentration', description: '1 owner covering everything = bus risk.',
    defaultWeight: 0.5,
    evaluate: ({ specOwnerCount }) => ({
      score: specOwnerCount === 0 ? -0.5 : specOwnerCount === 1 ? -1 : specOwnerCount === 2 ? 0 : 1,
      detail: `${specOwnerCount} Spec Owner${specOwnerCount === 1 ? '' : 's'} — concentration risk`,
    }),
    fix: {
      kind: 'manual',
      description: 'Adding owners is an organisational decision — humans only.',
    },
  },
  {
    id: 'rk-solution-monoculture', group: 'risks', builtin: true,
    name: 'Solution monoculture', description: 'A V. with only one S. has no fallback.',
    defaultWeight: 0.5,
    evaluate: ({ spec }) => {
      const sByValue = new Map<string, number>()
      const allVIds2 = spec.values.map(v => v.id)
      for (const s of spec.solutions) {
        const refs = allVIds2.filter(vid => (s.impact ?? '').includes(vid))
        for (const r of refs) sByValue.set(r, (sByValue.get(r) ?? 0) + 1)
      }
      const monoVs = spec.values.filter(v => (sByValue.get(v.id) ?? 0) <= 1).map(v => v.id)
      return { score: ratioToScore(countBadFraction(monoVs.length, spec.values.length)), detail: `${monoVs.length} V. covered by 1 or fewer S.`, findings: monoVs }
    },
    fix: {
      kind: 'ai',
      description: 'Propose a second Solution that Impacts this V. from a different angle, so the V. has fallback coverage.',
    },
  },

  // ── Coverage (3) ─────────────────────────────────────────────────────────
  {
    id: 'cv-stakeholder-coverage', group: 'coverage', builtin: true,
    name: 'Stakeholders with ≥1 V.', description: 'Every named stakeholder should have at least one Value.',
    defaultWeight: 0.4,
    evaluate: ({ spec }) => {
      const stakeholders = new Set(spec.values.map(v => v.wishStakeholder?.trim()).filter(Boolean) as string[])
      if (stakeholders.size === 0) return { score: 0, detail: 'No named stakeholders to assess yet' }
      const covered = new Set<string>()
      for (const v of spec.values) if (v.wishStakeholder?.trim()) covered.add(v.wishStakeholder.trim())
      const ratio = covered.size / stakeholders.size
      return { score: ratioToScore(ratio), detail: `${covered.size} / ${stakeholders.size} stakeholders have ≥1 V.` }
    },
    fix: {
      kind: 'manual',
      description: 'Stakeholder–Value mapping is a human relationship — humans only.',
    },
  },
  {
    id: 'cv-v-with-s', group: 'coverage', builtin: true,
    name: 'V. linked to ≥1 S.', description: 'A Value with no Solution has no path to delivery.',
    defaultWeight: 0.35,
    evaluate: ({ spec }) => {
      const vsLinked = new Set<string>()
      const allVIds3 = spec.values.map(v => v.id)
      for (const s of spec.solutions) {
        const refs = allVIds3.filter(vid => (s.impact ?? '').includes(vid))
        for (const r of refs) vsLinked.add(r)
      }
      const orphans = spec.values.filter(v => !vsLinked.has(v.id)).map(v => v.id)
      return { score: ratioToScore(countBadFraction(orphans.length, spec.values.length)), detail: `${orphans.length} V. with no Solution`, findings: orphans }
    },
    fix: {
      kind: 'ai',
      description: 'Propose a Solution that would Impact this orphan V., grounded in the existing Function set.',
    },
  },
  {
    id: 'cv-f-with-v', group: 'coverage', builtin: true,
    name: 'F. with measurable V.', description: 'A Function with no Value can\'t be assessed.',
    defaultWeight: 0.25,
    evaluate: ({ spec }) => {
      const fIds = new Set(spec.functions.map(f => f.id))
      const fLinked = new Set<string>()
      for (const v of spec.values) {
        const refs = (v.valueOfFunction ?? '').split(/[,;]+/).map(s => s.trim()).filter(Boolean)
        for (const r of refs) fLinked.add(r)
      }
      const orphans = Array.from(fIds).filter(id => !fLinked.has(id))
      return { score: ratioToScore(countBadFraction(orphans.length, fIds.size)), detail: `${orphans.length} F. without a measurable V.`, findings: orphans }
    },
    fix: {
      kind: 'ai',
      description: 'Propose a Value (with Scale + Meter) that measures the performance of this orphan F.',
    },
  },
]

// ── Spec patch helper — applies a SpecPatch to a SpecBlock ──────────────────
//
// Pure function: returns a new SpecBlock, never mutates the input. The patch
// op semantics:
//   - set-field: assigns a new string value to one field on one entry. The
//     field name is a string-typed key (e.g. 'scale', 'meter', 'goal'). Only
//     fields currently typed as `string` on the relevant interface can be
//     targeted — TypeScript narrows this at the call site, not here.
//   - rename-id: replaces the entry's `id`. Existing wikilink references in
//     OTHER entries are NOT auto-updated by this helper — the caller decides
//     whether to also emit set-field ops to patch references. For the
//     deterministic dup-id fix we DO NOT patch references (the original first
//     occurrence keeps its id, so existing references stay valid).
//
// Returns a NEW SpecBlock with the same identity for unmodified entries; only
// touched entries are cloned. Safe to plug into Vue reactivity.

/* eslint-disable @typescript-eslint/no-explicit-any */
export function applySpecPatch(spec: SpecBlock, patch: SpecPatch): SpecBlock {
  let out: SpecBlock = spec
  const _ensureClone = () => {
    if (out === spec) {
      out = {
        functions: spec.functions.slice(),
        values: spec.values.slice(),
        solutions: spec.solutions.slice(),
      }
    }
  }
  for (const op of patch) {
    _ensureClone()
    const list = op.entryType === 'F' ? out.functions
              : op.entryType === 'V' ? out.values
              : out.solutions
      // We need the original id to locate the entry. For set-field that's
    // `entryId`; for rename-id that's `oldId`.
    const targetId = op.kind === 'set-field' ? op.entryId : op.oldId
    const idx = list.findIndex((e: any) => e.id === targetId)
    if (idx < 0) continue
    const existing = list[idx]
    if (op.kind === 'set-field') {
      list[idx] = { ...(existing as any), [op.field]: op.value }
    } else {
      list[idx] = { ...(existing as any), id: op.newId }
    }
  }
  return out
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function getDefaultAspects(): PlanHealthAspectDef[] {
  return DEFAULT_ASPECTS.slice()
}

// ── Per-plan customisation (overrides + reason log) ──────────────────────────

export interface AspectOverride {
  /** Aspect id (built-in or custom) */
  aspectId: string
  /** Overridden aspect weight within group (0..1) */
  weight?: number
  /** True when the user disabled this aspect entirely */
  disabled?: boolean
}

export interface GroupOverride {
  groupId: AspectGroupId
  weight?: number
  disabled?: boolean
}

export interface ReasonEntry {
  at: string
  by: string
  action: 'weight-change' | 'aspect-disable' | 'aspect-enable' | 'aspect-add' | 'aspect-remove' | 'group-weight-change' | 'group-disable' | 'group-enable' | 'threshold-change'
  target: string
  before?: number | string | boolean
  after?: number | string | boolean
  reason: string
}

export interface PlanHealthCustom {
  planModelId: string
  aspectOverrides: AspectOverride[]
  groupOverrides: GroupOverride[]
  /** Custom (non-builtin) aspects added by the Plan Owner */
  customAspects: Array<Omit<PlanHealthAspectDef, 'evaluate' | 'builtin'> & {
    /** Custom aspects don't run code; user supplies a manual score in [-1,+1] */
    manualScore: number
    manualDetail: string
  }>
  /** Vibrate-below threshold for the badge (default 50) */
  threshold: number
  /** Audit log of all changes */
  reasonLog: ReasonEntry[]
  /** Plan Health Record Administration Specification — automatic-loop knobs */
  admin: PlanHealthAdminSpec
  /** Append-only history of PHI snapshots (one per version-bump or interval) */
  snapshots: SpecHealthSnapshot[]
  /** Outstanding notifications to the Plan Owner(s) — dismissable */
  notifications: PlanHealthNotification[]
  /** AI Expert Reviewers — named personas (Security / ROI / Quality / Risk / Usability / …)
   *  that read the plan and emit a -10..+10 score with a short paragraph "why".
   *  Each enabled Expert is synthesized into an aspect inside the 'ai-experts' group. */
  experts: AIExpert[]
  updatedAt: string
}

/**
 * One AI Expert persona. The Expert reads the plan according to:
 *   • `'all'`    — every governance / Planguage rule on file
 *   • `'select'` — a subset of rule ids checked from a list
 *   • `'custom'` — free-text rules the Owner typed in (e.g. domain heuristics)
 *
 * It returns a single `score: -10 .. +10` (perfect = +10) and a short
 * paragraph "why". The score × 10 maps onto the standard PHI -100..+100 scale
 * and contributes inside the 'ai-experts' group, weighted by `weight`.
 */
export interface AIExpert {
  id: string
  /** Display name, e.g. "Security Sage" */
  name: string
  /** Domain label — Security | Usability | ROI | Risk | Quality | … (free text) */
  domain: string
  /** What this expert focuses on — shown as a hint in the UI */
  description: string
  /** Optional persona / system-prompt override; when empty, a built-in template is used */
  systemPromptOverride?: string
  /** Which rules to apply during the review */
  ruleMode: 'all' | 'select' | 'custom'
  /** When ruleMode='select' — ids of rules to apply */
  selectedRuleIds?: string[]
  /** When ruleMode='custom' — free-text rule list (one per line is conventional) */
  customRules?: string
  /** Weight WITHIN the 'ai-experts' group (0..1). Group's experts should sum to 1. */
  weight: number
  /** Master enable — disabled experts contribute nothing and aren't called */
  enabled: boolean
  createdAt: number
  createdBy: string
  /** Last completed review — what's currently feeding into the PHI */
  lastReview?: AIExpertReview | null
  /** Last error from a failed review attempt — surfaces in the UI */
  lastError?: string | null
  /** Whether a review is currently in flight (set by run helpers) */
  running?: boolean
}

export interface AIExpertReview {
  /** Score in [-10..+10], +10 = perfect, 0 = neutral, -10 = catastrophic */
  score: number
  /** Short paragraph explaining the score */
  why: string
  /**
   * At least one URL the Expert cites as supporting justification (standard,
   * benchmark, post-mortem, OWASP entry, etc.). Tom: "The Expert Why?
   * Paragraph, or next to it should always contain at least one URL for more
   * justification and detail."  Empty array only for legacy reviews / mocks
   * where no URL was returned.
   */
  references?: string[]
  /** When the review ran (epoch ms) */
  ranAt: number
  /** Plan version label at review time, e.g. "v0.7" */
  planVersion: string
  /** How many rules were applied */
  ruleCount: number
  /** Which model produced this — e.g. "claude-sonnet-4-6" or "mock" */
  model: string
}

/** Five seed personas — all start disabled so a brand-new plan spends 0 LLM tokens. */
export const SEED_EXPERTS: Array<Omit<AIExpert, 'id' | 'createdAt' | 'createdBy' | 'lastReview' | 'lastError' | 'running'>> = [
  {
    name: 'Security Sage', domain: 'Security',
    description: 'Looks for OWASP-class concerns, threat-model gaps, sensitive-data exposure, missing auth/audit hooks.',
    ruleMode: 'custom',
    customRules: 'Penalise: missing auth on sensitive operations; PII handled without consent / encryption; no audit trail on destructive actions.\nReward: explicit threat model; least-privilege defaults; measurable security V. with Goal.',
    weight: 0.20, enabled: false,
  },
  {
    name: 'ROI Auditor', domain: 'ROI',
    description: 'Judges value-per-cost across S. entries — does the spend / effort buy the right outcomes?',
    ruleMode: 'custom',
    customRules: 'Penalise: large S. with no measurable V. impact; V. with no Goal so ROI cannot be computed; effort skewed to low-value entries.\nReward: clear V/C ratio; effort prioritised on broadest value coverage.',
    weight: 0.20, enabled: false,
  },
  {
    name: 'Risk Inspector', domain: 'Risk',
    description: 'Scans for unmitigated risks, single points of failure, and reversibility gaps.',
    ruleMode: 'custom',
    customRules: 'Penalise: any S. with no rollback path; single-owner concentration; risks named without a mitigating S.\nReward: explicit fallback / kill-switch S.; risks linked to a mitigation.',
    weight: 0.20, enabled: false,
  },
  {
    name: 'Quality Hawk', domain: 'Quality',
    description: 'Tests V. measurability and Planguage compliance — is each value crisp enough to evaluate?',
    ruleMode: 'all',
    weight: 0.20, enabled: false,
  },
  {
    name: 'Usability Critic', domain: 'Usability',
    description: 'Reads the plan from a non-technical user POV — clarity, jargon, friction.',
    ruleMode: 'custom',
    customRules: 'Penalise: jargon without explanation; UX-relevant V. with no human-centric Meter; missing accessibility considerations.\nReward: V. tied to a real user task; explicit user-research touchpoints.',
    weight: 0.20, enabled: false,
  },
]

/**
 * Plan Health Record Administration Specification — every knob that controls
 * the *automatic* Plan Health loop. Defaults are tuned for "fire and forget":
 * Plan Owner gets a notification only when something material changes.
 */
export interface PlanHealthAdminSpec {
  /** Master switch — when false, no automatic notifications are produced */
  notifyOnDrop: boolean
  /** Drop in PHI (in absolute % points on the −100..+100 scale) considered
   *  "significant". Default 5 — i.e. 62 → 56 fires; 62 → 58 does not. */
  dropThresholdPct: number
  /** How often the Plan Owner wants the periodic digest. `realtime` fires on
   *  every snapshot drop; `daily` / `weekly` are batched (UI-rendered);
   *  `never` mutes everything except an explicit "open the panel" view. */
  notifyFrequency: 'realtime' | 'daily' | 'weekly' | 'never'
  /** Channel selection — in-app dot/banner is always available; email is a
   *  flag for a future server-side hook (not delivered locally). */
  notifyChannels: { inApp: boolean; email: boolean }
  /** Take an automatic snapshot on every spec-version bump (default ON) */
  autoSnapshotOnVersionBump: boolean
  /** Periodic snapshot interval in hours (0 = disabled). Independent of
   *  version bumps so a long-lived spec still gets a heartbeat. */
  autoSnapshotIntervalHours: number
  /** Subset of `planModel.owners` to notify. Empty = ALL owners. */
  notifyOwnerIds: string[]
  /** Cap on retained snapshots — older ones drop off the front of history */
  maxSnapshots: number
  /** When true, every spec-version bump triggers `runAllExperts()`. OFF by
   *  default because each enabled Expert costs one LLM call per bump. */
  autoRunExpertsOnVersionBump: boolean
}

/**
 * One PHI sample. Captured automatically by `recordSnapshot()` whenever the
 * watched spec version changes (or via the periodic timer). Plotted in the
 * Status panel along the Version + Date axis.
 */
export interface SpecHealthSnapshot {
  /** Stable id — used by graph keys + dismissNotification cross-reference */
  id: string
  at: string                              // ISO timestamp
  /** Spec model version label at this snapshot, e.g. "v0.7" — empty when unknown */
  planVersion: string
  /** Optional human label from the version (e.g. "Sharpen", "Restore", "Replan") */
  versionLabel: string
  index: number                           // overall PHI in −100..+100
  groupIndices: Partial<Record<AspectGroupId, number>>
  /** aspectId → −100..+100 score (rounded) for graphing per-aspect history */
  aspectScores: Record<string, number>
  /** What caused the snapshot to be taken */
  trigger: 'version-bump' | 'interval' | 'manual' | 'replan' | 'inception'
  reason?: string
}

/** @deprecated Use SpecHealthSnapshot instead */
export type PlanHealthSnapshot = SpecHealthSnapshot

export interface PlanHealthNotification {
  id: string
  at: string
  /** "drop" alerts fire when the latest snapshot is `dropThresholdPct` lower
   *  than the previous one (typically right after a Replan). */
  kind: 'drop' | 'recovery' | 'threshold-cross' | 'inception'
  fromIndex: number
  toIndex: number
  /** Human-readable headline — used in the in-app notification list */
  headline: string
  /** Snapshot id this notification refers to (links Status graph → list) */
  snapshotId: string
  dismissed: boolean
}

const DEFAULT_ADMIN_SPEC: PlanHealthAdminSpec = {
  notifyOnDrop: true,
  dropThresholdPct: 5,
  notifyFrequency: 'realtime',
  notifyChannels: { inApp: true, email: false },
  autoSnapshotOnVersionBump: true,
  autoSnapshotIntervalHours: 0, // off by default — version bumps already cover most cases
  notifyOwnerIds: [],
  maxSnapshots: 200,
  autoRunExpertsOnVersionBump: false, // opt-in — each enabled Expert costs 1 LLM call per bump
}

/** Builds the seed AIExpert array — called from _empty/_normalize so brand-new
 *  plans get the personas pre-populated (still disabled, zero token cost). */
function _seedExperts(): AIExpert[] {
  const now = Date.now()
  return SEED_EXPERTS.map((s, i) => ({
    ...s,
    id: `expert-seed-${i}-${now.toString(36)}`,
    createdAt: now,
    createdBy: 'system',
    lastReview: null,
    lastError: null,
    running: false,
  }))
}

const STORAGE_KEY = 'sem-spec-health-custom'   // Phase A rename; shim reads old 'sem-plan-health-custom' as fallback

const _store = ref<Record<string, PlanHealthCustom>>(
  (() => {
    try { return JSON.parse(readMigrated(STORAGE_KEY) ?? '{}') }   // reads new key, falls back to old
    catch { return {} }
  })(),
)
function _persist(): void { writeBoth(STORAGE_KEY, JSON.stringify(_store.value)) }  // dual-write during transition

function _empty(planModelId: string): PlanHealthCustom {
  return {
    planModelId,
    aspectOverrides: [],
    groupOverrides: [],
    customAspects: [],
    threshold: 50,
    reasonLog: [],
    admin: { ...DEFAULT_ADMIN_SPEC, notifyChannels: { ...DEFAULT_ADMIN_SPEC.notifyChannels } },
    snapshots: [],
    notifications: [],
    experts: _seedExperts(),
    updatedAt: new Date().toISOString(),
  }
}

/** Migration helper — older localStorage records (pre-2026-05-12 evening) lack
 *  admin/snapshots/notifications. Lazily back-fill missing fields on every read
 *  so the rest of the file can assume a fully-populated record. */
function _normalize(rec: Partial<PlanHealthCustom> | undefined, planModelId: string): PlanHealthCustom {
  if (!rec) return _empty(planModelId)
  return {
    planModelId,
    aspectOverrides: rec.aspectOverrides ?? [],
    groupOverrides:  rec.groupOverrides  ?? [],
    customAspects:   rec.customAspects   ?? [],
    threshold:       rec.threshold       ?? 50,
    reasonLog:       rec.reasonLog       ?? [],
    admin:           rec.admin
      ? { ...DEFAULT_ADMIN_SPEC, ...rec.admin, notifyChannels: { ...DEFAULT_ADMIN_SPEC.notifyChannels, ...(rec.admin.notifyChannels ?? {}) } }
      : { ...DEFAULT_ADMIN_SPEC, notifyChannels: { ...DEFAULT_ADMIN_SPEC.notifyChannels } },
    snapshots:       rec.snapshots       ?? [],
    notifications:   rec.notifications   ?? [],
    experts:         (rec.experts && rec.experts.length > 0)
      ? rec.experts.map(e => ({
          ...e,
          lastReview: e.lastReview ?? null,
          lastError:  e.lastError  ?? null,
          running:    e.running    ?? false,
        }))
      : _seedExperts(),
    updatedAt:       rec.updatedAt       ?? new Date().toISOString(),
  }
}

// ── Composable ───────────────────────────────────────────────────────────────

export interface IndexBreakdown {
  /** Overall PHI in the range −100 … +100 */
  index: number
  groups: Array<{
    groupId: AspectGroupId
    groupLabel: string
    groupIcon: string
    groupWeight: number
    /** Group sub-index in the range −100 … +100 */
    groupIndex: number
    aspects: Array<{
      aspectId: string
      name: string
      weight: number
      score: number
      detail: string
      findings?: string[]
      disabled: boolean
    }>
  }>
}

export function useSpecHealth(planModelId: string) {

  const custom = computed<PlanHealthCustom>({
    get: () => _normalize(_store.value[planModelId], planModelId),
    set: (v) => {
      _store.value = { ..._store.value, [planModelId]: { ...v, updatedAt: new Date().toISOString() } }
      _persist()
    },
  })

  function _patch(patch: Partial<PlanHealthCustom>): void {
    custom.value = { ...custom.value, ...patch }
  }

  // ── Resolved (default + override) views ───────────────────────────────────

  function resolveAspect(aspect: PlanHealthAspectDef): { weight: number; disabled: boolean } {
    const o = custom.value.aspectOverrides.find(x => x.aspectId === aspect.id)
    return { weight: o?.weight ?? aspect.defaultWeight, disabled: o?.disabled ?? false }
  }

  function resolveGroup(group: AspectGroupMeta): { weight: number; disabled: boolean } {
    const o = custom.value.groupOverrides.find(x => x.groupId === group.id)
    return { weight: o?.weight ?? group.defaultWeight, disabled: o?.disabled ?? !group.seeded }
  }

  /** All aspects = built-in + custom + AI-Expert-derived. Each enabled Expert
   *  becomes an aspect inside the 'ai-experts' group; its last review's
   *  -10..+10 score maps to the standard -1..+1 aspect score. Experts with no
   *  review yet contribute a neutral 0 with an "awaiting review" detail. */
  function allAspects(): PlanHealthAspectDef[] {
    const customDefs: PlanHealthAspectDef[] = custom.value.customAspects.map(c => ({
      id: c.id, group: c.group, name: c.name, description: c.description,
      defaultWeight: c.defaultWeight, builtin: false,
      evaluate: () => ({ score: c.manualScore, detail: c.manualDetail }),
    }))
    const expertDefs: PlanHealthAspectDef[] = custom.value.experts
      .filter(e => e.enabled)
      .map(e => ({
        id: `expert-${e.id}`,
        group: 'ai-experts' as AspectGroupId,
        name: `${e.name} — ${e.domain}`,
        description: e.description,
        defaultWeight: e.weight,
        builtin: false,
        evaluate: () => {
          const r = e.lastReview
          if (!r) return { score: 0, detail: 'No review yet — open Status panel and click 🔁 to call this expert.' }
          // Score is -10..+10; aspect contract is -1..+1
          const s = Math.max(-1, Math.min(1, r.score / 10))
          return {
            score: s,
            detail: r.why,
            findings: [`score ${r.score >= 0 ? '+' : ''}${r.score}/10 · v${r.planVersion || '?'} · ${r.model}`],
          }
        },
      }))
    return [...DEFAULT_ASPECTS, ...customDefs, ...expertDefs]
  }

  // ── Index computation ─────────────────────────────────────────────────────

  function computeBreakdown(ctx: SpecHealthContext): IndexBreakdown {
    const aspects = allAspects()
    const groupIds = (Object.keys(ASPECT_GROUPS) as AspectGroupId[])

    const groups: IndexBreakdown['groups'] = []
    let weightedSum = 0
    let totalGroupWeight = 0

    for (const gid of groupIds) {
      const meta = ASPECT_GROUPS[gid]
      const g = resolveGroup(meta)
      if (g.disabled || g.weight <= 0) continue

      const groupAspects = aspects.filter(a => a.group === gid)
      const aspectRows: IndexBreakdown['groups'][number]['aspects'] = []
      let aspectWeightedSum = 0
      let totalAspectWeight = 0

      for (const a of groupAspects) {
        const { weight, disabled } = resolveAspect(a)
        if (disabled) {
          aspectRows.push({ aspectId: a.id, name: a.name, weight: 0, score: 0, detail: 'Disabled', disabled: true })
          continue
        }
        const ev = a.evaluate(ctx)
        const safeScore = Math.max(-1, Math.min(1, ev.score))
        aspectRows.push({ aspectId: a.id, name: a.name, weight, score: safeScore, detail: ev.detail, findings: ev.findings, disabled: false })
        aspectWeightedSum += weight * safeScore
        totalAspectWeight += weight
      }

      const groupScore = totalAspectWeight > 0 ? aspectWeightedSum / totalAspectWeight : 0
      groups.push({
        groupId: gid,
        groupLabel: meta.label,
        groupIcon: meta.icon,
        groupWeight: g.weight,
        groupIndex: Math.round(groupScore * 100),
        aspects: aspectRows,
      })

      weightedSum += g.weight * groupScore
      totalGroupWeight += g.weight
    }

    const index = totalGroupWeight > 0 ? Math.round((weightedSum / totalGroupWeight) * 100) : 0
    return { index, groups }
  }

  /** Convenience — returns just the −100…+100 number */
  function planHealthIndex(ctx: SpecHealthContext): number {
    return computeBreakdown(ctx).index
  }

  /** Per-group sub-index, for entry/exit gating */
  function groupIndex(groupId: AspectGroupId, ctx: SpecHealthContext): number {
    return computeBreakdown(ctx).groups.find(g => g.groupId === groupId)?.groupIndex ?? 0
  }

  // ── Mutations (every mutation logs a ReasonEntry) ────────────────────────

  function setAspectWeight(aspectId: string, newWeight: number, by: string, reason: string): void {
    const before = custom.value.aspectOverrides.find(o => o.aspectId === aspectId)?.weight
                 ?? DEFAULT_ASPECTS.find(a => a.id === aspectId)?.defaultWeight ?? 0
    const overrides = custom.value.aspectOverrides.filter(o => o.aspectId !== aspectId)
    overrides.push({ aspectId, weight: newWeight })
    _patch({
      aspectOverrides: overrides,
      reasonLog: [...custom.value.reasonLog, {
        at: new Date().toISOString(), by, action: 'weight-change',
        target: aspectId, before, after: newWeight, reason,
      }],
    })
  }

  function setAspectDisabled(aspectId: string, disabled: boolean, by: string, reason: string): void {
    const overrides = custom.value.aspectOverrides.filter(o => o.aspectId !== aspectId)
    overrides.push({ aspectId, disabled, weight: overrides.find(o => o.aspectId === aspectId)?.weight })
    _patch({
      aspectOverrides: overrides,
      reasonLog: [...custom.value.reasonLog, {
        at: new Date().toISOString(), by, action: disabled ? 'aspect-disable' : 'aspect-enable',
        target: aspectId, after: disabled, reason,
      }],
    })
  }

  function setGroupWeight(groupId: AspectGroupId, newWeight: number, by: string, reason: string): void {
    const before = custom.value.groupOverrides.find(o => o.groupId === groupId)?.weight
                 ?? ASPECT_GROUPS[groupId].defaultWeight
    const overrides = custom.value.groupOverrides.filter(o => o.groupId !== groupId)
    overrides.push({ groupId, weight: newWeight, disabled: custom.value.groupOverrides.find(o => o.groupId === groupId)?.disabled })
    _patch({
      groupOverrides: overrides,
      reasonLog: [...custom.value.reasonLog, {
        at: new Date().toISOString(), by, action: 'group-weight-change',
        target: groupId, before, after: newWeight, reason,
      }],
    })
  }

  function setGroupDisabled(groupId: AspectGroupId, disabled: boolean, by: string, reason: string): void {
    const overrides = custom.value.groupOverrides.filter(o => o.groupId !== groupId)
    overrides.push({ groupId, disabled, weight: custom.value.groupOverrides.find(o => o.groupId === groupId)?.weight })
    _patch({
      groupOverrides: overrides,
      reasonLog: [...custom.value.reasonLog, {
        at: new Date().toISOString(), by, action: disabled ? 'group-disable' : 'group-enable',
        target: groupId, after: disabled, reason,
      }],
    })
  }

  /** Reset all aspect + group weight overrides to their built-in defaults.
   *  Single composite audit entry — useful when a user has tuned weights into
   *  an unusable state ("everything stuck at 0.1") and wants a clean slate. */
  function resetAllWeights(by: string, reason: string): void {
    const beforeAspects = custom.value.aspectOverrides.length
    const beforeGroups  = custom.value.groupOverrides.length
    _patch({
      aspectOverrides: [],
      groupOverrides: [],
      reasonLog: [...custom.value.reasonLog, {
        at: new Date().toISOString(), by, action: 'weight-change',
        target: '<all-weights>', before: `${beforeAspects} aspect + ${beforeGroups} group overrides`,
        after: 'cleared to defaults', reason,
      }],
    })
  }

  function setThreshold(newThreshold: number, by: string, reason: string): void {
    const before = custom.value.threshold
    _patch({
      threshold: newThreshold,
      reasonLog: [...custom.value.reasonLog, {
        at: new Date().toISOString(), by, action: 'threshold-change',
        target: 'threshold', before, after: newThreshold, reason,
      }],
    })
  }

  function addCustomAspect(args: {
    name: string; description: string; group: AspectGroupId;
    defaultWeight: number; manualScore: number; manualDetail: string;
    by: string; reason: string;
  }): string {
    const id = `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    const next = [...custom.value.customAspects, {
      id, group: args.group, name: args.name, description: args.description,
      defaultWeight: args.defaultWeight, manualScore: args.manualScore, manualDetail: args.manualDetail,
    }]
    _patch({
      customAspects: next,
      reasonLog: [...custom.value.reasonLog, {
        at: new Date().toISOString(), by: args.by, action: 'aspect-add',
        target: id, after: args.name, reason: args.reason,
      }],
    })
    return id
  }

  function removeCustomAspect(aspectId: string, by: string, reason: string): void {
    const removed = custom.value.customAspects.find(a => a.id === aspectId)
    if (!removed) return
    _patch({
      customAspects: custom.value.customAspects.filter(a => a.id !== aspectId),
      reasonLog: [...custom.value.reasonLog, {
        at: new Date().toISOString(), by, action: 'aspect-remove',
        target: aspectId, before: removed.name, reason,
      }],
    })
  }

  // ── Snapshots (automatic history) ─────────────────────────────────────────

  /**
   * Capture a snapshot of the current breakdown into the per-plan history.
   * Idempotent for `version-bump` triggers — if the latest snapshot already
   * carries the same `planVersion`, we update it in-place instead of pushing
   * a duplicate (so a redundant fire from the App-level watcher is harmless).
   *
   * Side-effect: when the new snapshot is `dropThresholdPct` lower than the
   * previous one AND `admin.notifyOnDrop` is on AND `admin.notifyFrequency`
   * isn't `never`, a notification is appended for the Plan Owner.
   *
   * Returns the recorded (or updated) snapshot.
   */
  function recordSnapshot(
    ctx: SpecHealthContext,
    opts: { trigger: SpecHealthSnapshot['trigger']; planVersion?: string; versionLabel?: string; reason?: string },
  ): SpecHealthSnapshot {
    const breakdown = computeBreakdown(ctx)
    const groupIndices: Partial<Record<AspectGroupId, number>> = {}
    for (const g of breakdown.groups) groupIndices[g.groupId] = g.groupIndex
    const aspectScores: Record<string, number> = {}
    for (const g of breakdown.groups) {
      for (const a of g.aspects) aspectScores[a.aspectId] = Math.round(a.score * 100)
    }

    const id = `snap-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    const snap: SpecHealthSnapshot = {
      id, at: new Date().toISOString(),
      planVersion: opts.planVersion ?? '',
      versionLabel: opts.versionLabel ?? '',
      index: breakdown.index, groupIndices, aspectScores,
      trigger: opts.trigger, reason: opts.reason,
    }

    const existing = custom.value.snapshots
    const last = existing.at(-1)

    // Idempotent for version-bump — replace the matching tail row instead of duplicating
    let snapshots: SpecHealthSnapshot[]
    if (opts.trigger === 'version-bump' && last && last.planVersion && last.planVersion === snap.planVersion) {
      snapshots = [...existing.slice(0, -1), { ...snap, id: last.id }]
    } else {
      snapshots = [...existing, snap]
    }
    // Cap retention
    const max = custom.value.admin.maxSnapshots
    if (snapshots.length > max) snapshots = snapshots.slice(snapshots.length - max)

    // Drop / recovery detection (vs the actual previous snapshot)
    const newNotifications: PlanHealthNotification[] = []
    const admin = custom.value.admin
    const muteAll = !admin.notifyOnDrop || admin.notifyFrequency === 'never'
    const prev = existing.length > 0 && opts.trigger !== 'inception'
      ? (snapshots.length >= 2 ? snapshots[snapshots.length - 2] : null)
      : null
    if (!muteAll && prev) {
      const delta = snap.index - prev.index
      if (delta <= -admin.dropThresholdPct) {
        newNotifications.push({
          id: `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          at: snap.at, kind: 'drop',
          fromIndex: prev.index, toIndex: snap.index,
          headline: `Plan Health dropped ${Math.abs(delta)}% (${prev.index >= 0 ? '+' : ''}${prev.index} → ${snap.index >= 0 ? '+' : ''}${snap.index})${snap.planVersion ? ` at ${snap.planVersion}` : ''}`,
          snapshotId: snap.id, dismissed: false,
        })
      } else if (delta >= admin.dropThresholdPct && prev.index < 0 && snap.index >= 0) {
        // Crossed back into positive territory — worth telling the Owner
        newNotifications.push({
          id: `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          at: snap.at, kind: 'recovery',
          fromIndex: prev.index, toIndex: snap.index,
          headline: `Plan Health recovered to positive (${prev.index} → +${snap.index})${snap.planVersion ? ` at ${snap.planVersion}` : ''}`,
          snapshotId: snap.id, dismissed: false,
        })
      }
    } else if (opts.trigger === 'inception' && existing.length === 0) {
      newNotifications.push({
        id: `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        at: snap.at, kind: 'inception',
        fromIndex: snap.index, toIndex: snap.index,
        headline: `Plan Health Inception baseline recorded: ${snap.index >= 0 ? '+' : ''}${snap.index}%`,
        snapshotId: snap.id, dismissed: false,
      })
    }

    _patch({
      snapshots,
      notifications: newNotifications.length
        ? [...custom.value.notifications, ...newNotifications]
        : custom.value.notifications,
    })
    return snap
  }

  /** Active (un-dismissed) notifications, newest-first */
  const pendingNotifications = computed<PlanHealthNotification[]>(() =>
    custom.value.notifications.filter(n => !n.dismissed).slice().reverse(),
  )

  function dismissNotification(id: string): void {
    _patch({
      notifications: custom.value.notifications.map(n =>
        n.id === id ? { ...n, dismissed: true } : n,
      ),
    })
  }

  function dismissAllNotifications(): void {
    _patch({ notifications: custom.value.notifications.map(n => ({ ...n, dismissed: true })) })
  }

  // ── Admin spec ────────────────────────────────────────────────────────────

  /** Patch one or more admin-spec fields. Logs a single ReasonEntry per call. */
  function setAdminSpec(patch: Partial<PlanHealthAdminSpec>, by: string, reason: string): void {
    const before = custom.value.admin
    const next: PlanHealthAdminSpec = {
      ...before,
      ...patch,
      notifyChannels: { ...before.notifyChannels, ...(patch.notifyChannels ?? {}) },
    }
    _patch({
      admin: next,
      reasonLog: [...custom.value.reasonLog, {
        at: new Date().toISOString(), by, action: 'weight-change',
        target: 'admin-spec',
        before: JSON.stringify(before),
        after: JSON.stringify(next),
        reason,
      }],
    })
  }

  /** Convenience for owner-subset toggle from the Admin UI */
  function setNotifyOwner(ownerId: string, on: boolean, by: string, reason: string): void {
    const cur = custom.value.admin.notifyOwnerIds
    const next = on
      ? (cur.includes(ownerId) ? cur : [...cur, ownerId])
      : cur.filter(x => x !== ownerId)
    setAdminSpec({ notifyOwnerIds: next }, by, reason)
  }

  // ── AI Experts (CRUD + review storage) ───────────────────────────────────

  /**
   * Ensure the 'ai-experts' group is enabled with a sensible weight whenever
   * the first Expert is enabled. Keeps the design "as automatic as possible"
   * — the Owner doesn't have to know the group exists, just enable an Expert.
   */
  function _ensureExpertsGroupActive(by: string, reason: string): void {
    const meta = ASPECT_GROUPS['ai-experts']
    const current = resolveGroup(meta)
    if (!current.disabled && current.weight > 0) return
    // Enable the group + set 0.15 weight (auditable as two ReasonEntries)
    setGroupDisabled('ai-experts', false, by, `${reason} (auto: AI Expert enabled)`)
    if (current.weight <= 0) {
      setGroupWeight('ai-experts', 0.15, by, `${reason} (auto: default Experts weight)`)
    }
  }

  function addExpert(args: {
    name: string; domain: string; description: string;
    ruleMode?: 'all' | 'select' | 'custom';
    selectedRuleIds?: string[]; customRules?: string;
    systemPromptOverride?: string;
    weight?: number; enabled?: boolean;
    by: string; reason: string;
  }): string {
    const id = `expert-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    const expert: AIExpert = {
      id,
      name: args.name.trim() || 'Unnamed Expert',
      domain: args.domain.trim() || 'General',
      description: args.description.trim() || '',
      ruleMode: args.ruleMode ?? 'custom',
      selectedRuleIds: args.selectedRuleIds,
      customRules: args.customRules,
      systemPromptOverride: args.systemPromptOverride,
      weight: args.weight ?? 0.20,
      enabled: args.enabled ?? true,
      createdAt: Date.now(),
      createdBy: args.by,
      lastReview: null, lastError: null, running: false,
    }
    _patch({
      experts: [...custom.value.experts, expert],
      reasonLog: [...custom.value.reasonLog, {
        at: new Date().toISOString(), by: args.by, action: 'aspect-add',
        target: `expert:${id}`, after: `${expert.name} (${expert.domain})`, reason: args.reason,
      }],
    })
    if (expert.enabled) _ensureExpertsGroupActive(args.by, args.reason)
    return id
  }

  function removeExpert(expertId: string, by: string, reason: string): void {
    const removed = custom.value.experts.find(e => e.id === expertId)
    if (!removed) return
    _patch({
      experts: custom.value.experts.filter(e => e.id !== expertId),
      reasonLog: [...custom.value.reasonLog, {
        at: new Date().toISOString(), by, action: 'aspect-remove',
        target: `expert:${expertId}`, before: `${removed.name} (${removed.domain})`, reason,
      }],
    })
  }

  function updateExpert(expertId: string, patch: Partial<AIExpert>, by: string, reason: string): void {
    const before = custom.value.experts.find(e => e.id === expertId)
    if (!before) return
    const next = custom.value.experts.map(e => e.id === expertId ? { ...e, ...patch } : e)
    _patch({
      experts: next,
      reasonLog: [...custom.value.reasonLog, {
        at: new Date().toISOString(), by, action: 'weight-change',
        target: `expert:${expertId}`,
        before: JSON.stringify({ name: before.name, weight: before.weight, ruleMode: before.ruleMode, enabled: before.enabled }),
        after:  JSON.stringify({ ...{ name: before.name, weight: before.weight, ruleMode: before.ruleMode, enabled: before.enabled }, ...patch }),
        reason,
      }],
    })
    if (patch.enabled === true) _ensureExpertsGroupActive(by, reason)
  }

  function setExpertEnabled(expertId: string, enabled: boolean, by: string, reason: string): void {
    updateExpert(expertId, { enabled }, by, reason)
  }

  /** Internal — quietly write a review result without an audit row. The audit
   *  row lives on the *trigger* (manual run button or auto-run watcher). */
  function _writeExpertReview(expertId: string, review: AIExpertReview | null, error?: string | null): void {
    _patch({
      experts: custom.value.experts.map(e =>
        e.id === expertId
          ? { ...e, lastReview: review ?? e.lastReview, lastError: error ?? null, running: false }
          : e,
      ),
    })
  }

  function _setExpertRunning(expertId: string, running: boolean): void {
    _patch({
      experts: custom.value.experts.map(e => e.id === expertId ? { ...e, running } : e),
    })
  }

  /**
   * Run a single Expert review. Lazy-imports the LLM helper so the heavy
   * Anthropic client only loads when an Expert is actually invoked.
   *
   * Returns the new review on success, null on failure (lastError is set).
   */
  async function runExpertReview(
    expertId: string,
    spec: SpecBlock,
    planVersion: string,
    by: string,
    reason: string,
  ): Promise<AIExpertReview | null> {
    const expert = custom.value.experts.find(e => e.id === expertId)
    if (!expert) return null
    _setExpertRunning(expertId, true)
    try {
      const result = await runAIExpertReview(expert, spec, planVersion)
      _writeExpertReview(expertId, result, null)
      _patch({
        reasonLog: [...custom.value.reasonLog, {
          at: new Date().toISOString(), by, action: 'weight-change',
          target: `expert-review:${expertId}`,
          before: expert.lastReview ? expert.lastReview.score : '—',
          after: result.score,
          reason: `${reason} — "${result.why.slice(0, 80)}${result.why.length > 80 ? '…' : ''}"`,
        }],
      })
      return result
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      _writeExpertReview(expertId, null, msg)
      return null
    }
  }

  /** Run every enabled Expert in parallel. Resolves once all settle. */
  async function runAllExperts(spec: SpecBlock, planVersion: string, by: string, reason: string): Promise<void> {
    const enabled = custom.value.experts.filter(e => e.enabled)
    await Promise.allSettled(enabled.map(e => runExpertReview(e.id, spec, planVersion, by, reason)))
  }

  /** Test-only / admin-only — wipe history. Logs a reason. */
  function clearSnapshots(by: string, reason: string): void {
    _patch({
      snapshots: [],
      reasonLog: [...custom.value.reasonLog, {
        at: new Date().toISOString(), by, action: 'aspect-remove',
        target: 'all-snapshots',
        before: custom.value.snapshots.length, after: 0, reason,
      }],
    })
  }

  return {
    custom,
    allAspects,
    resolveAspect,
    resolveGroup,
    computeBreakdown,
    planHealthIndex,
    groupIndex,
    setAspectWeight,
    setAspectDisabled,
    setGroupWeight,
    setGroupDisabled,
    resetAllWeights,
    setThreshold,
    addCustomAspect,
    removeCustomAspect,
    // Snapshot + notifications + admin
    recordSnapshot,
    pendingNotifications,
    dismissNotification,
    dismissAllNotifications,
    setAdminSpec,
    setNotifyOwner,
    clearSnapshots,
    // AI Experts
    addExpert,
    removeExpert,
    updateExpert,
    setExpertEnabled,
    runExpertReview,
    runAllExperts,
  }
}
