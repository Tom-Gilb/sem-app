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
  // ── Spec Quality — traceability, source attribution, data provenance ─────────
  | 'spec-quality'
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
  'spec-quality':         { id: 'spec-quality',         label: 'Spec Quality',         icon: '🏷️', hint: 'Source attribution, traceability',       defaultWeight: 0.00, seeded: true },
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
      return { score: ratioToScore(countBadFraction(bad.length, spec.values.length)), detail: `${bad.length} of ${spec.values.length} Values lack a Scale`, findings: bad }
    },
    fix: {
      kind: 'ai',
      description: 'Propose a measurable Scale unit (e.g. "Net Promoter Score, monthly") based on the Value description.',
    },
  },
  {
    id: 'sd-missing-goal', group: 'spec-defects', builtin: true,
    name: 'V. with no Goal (and no Wish)', description: 'Every Value should declare at least one Target — Wish (uncommitted) graduates to Goal (committed) once cost/feasibility are negotiated.',
    defaultWeight: 0.35,
    // r07 — Tom Gilb 2026-06-16 SUPREME (Value Definition Identity, rule
    // r05 at-least-one-Target): NEVER fire when Wish IS present, because the
    // Wish→Goal commitment evolution means a Wish satisfies the at-least-one-
    // Target rule by itself during early planning. The Goal will graduate
    // from the Wish once cost/feasibility are negotiated. Tom verbatim:
    // "Required at least one constrain level (Tolerable) and at least one
    // target (Wish until we commit to Goal)."  Combined Wish-OR-Goal SHIP-
    // BLOCKING surface lives in sd-no-target below; this kept defect is the
    // softer "still no Goal even though Wish is gone or never existed" case.
    evaluate: ({ spec }) => {
      const bad = spec.values
        .filter(v => !v.goal?.trim() && !v.wish?.trim())
        .map(v => v.id)
      return {
        score: ratioToScore(countBadFraction(bad.length, spec.values.length)),
        detail: `${bad.length} of ${spec.values.length} Values lack BOTH a Goal AND a Wish`,
        findings: bad,
      }
    },
    fix: {
      kind: 'ai',
      description: 'Propose either a Wish (uncommitted stakeholder dream) or a Goal (committed target value with date) using the existing Scale and Meter.  A Wish is the natural first Target — it graduates to a Goal once cost + feasibility are negotiated.',
    },
  },

  // ── SHIP-BLOCKING (r07 — Tom Gilb 2026-06-16 SUPREME) ────────────────────
  // SUCCESS book § 2.1 + § 3.3 + Glossary Success Range *548.  A V. entry
  // with Tolerable (failure-floor) but NO {Wish, Goal} has NO Success Range:
  // designers cannot aim at a target they cannot see.  Most severe defect
  // class — surfaces above all other Sharpening targets per Tom verbatim
  // *"Failure to define Wish means there is no success and completion and
  // sufficient definition.  Quite important for design and implementation."*
  {
    id: 'sd-ship-blocking-no-target', group: 'spec-defects', builtin: true,
    name: '🚫 SHIP-BLOCKING — V. with Tolerable but NO Wish AND NO Goal',
    description: 'SUCCESS book § 2.1 + § 3.3: scalar constraints (Tolerable) define Failure; Wish/Goal Targets define Success.  Without a Wish or Goal there is NO Success Range — no completion criterion, no aim point.  Designers cannot aim at a target they cannot see.',
    defaultWeight: 0.45,
    evaluate: ({ spec }) => {
      const bad = spec.values
        .filter(v =>
          v.tolerable?.trim() &&
          !v.goal?.trim() &&
          !v.wish?.trim()
        )
        .map(v => v.id)
      // Catastrophic: a single ship-blocking defect drives the aspect score
      // hard negative to surface above other defects in the panel ordering.
      const score = bad.length === 0 ? 1 : -1
      return {
        score,
        detail: bad.length === 0
          ? 'All V. with a Tolerable have at least one Wish or Goal — Success Range defined'
          : `${bad.length} V. have a Tolerable (failure-floor) but no Wish AND no Goal — designers cannot aim`,
        findings: bad,
      }
    },
    fix: {
      kind: 'ai',
      description: 'Propose a Wish OR a Goal so the Success Range is defined.  Per SUCCESS book § 2.1: Wish is the uncommitted stakeholder dream; Goal is the committed promise.  Either satisfies the at-least-one-Target rule.  Without one, there is no completion criterion for designers / implementers.',
    },
  },

  // ── CRITICAL (r07 — Tom Gilb 2026-06-16 SUPREME) ────────────────────────
  // At-least-one-constraint-level rule + SUCCESS book § 3.3.  Tolerable is
  // the project-viability threshold; without it there is no project-failure
  // line.  Distinct Glossary concept from Fail *098 (r08 correction): Fail
  // is the attribute-acceptability boundary, Tolerable is the project-
  // viability boundary.  Either one would satisfy the at-least-one-
  // constraint-level rule, but recent books standardise on Tolerable.
  // SEM App's VEntry.tolerable: string is the canonical field.  A separate
  // .fail field is not yet defined; when added, this evaluator must accept
  // either.
  {
    id: 'sd-no-tolerable', group: 'spec-defects', builtin: true,
    name: 'V. with no Tolerable',
    description: 'Tom Gilb 2026-06-16: "Required at least one constrain level (Tolerable)".  SUCCESS book § 3.3: Tolerable is "not intolerable"; intolerable is a degree of failure.  Without it, the V. has no project-viability floor.',
    defaultWeight: 0.4,
    evaluate: ({ spec }) => {
      const bad = spec.values.filter(v => !v.tolerable?.trim()).map(v => v.id)
      return {
        score: ratioToScore(countBadFraction(bad.length, spec.values.length)),
        detail: `${bad.length} of ${spec.values.length} Values lack a Tolerable (project-viability floor)`,
        findings: bad,
      }
    },
    fix: {
      kind: 'ai',
      description: 'Propose a Tolerable (failure-floor) on the existing Scale.  Below Tolerable, the WHOLE PROJECT fails — not just this attribute.  Per Tom Gilb verbatim 2026-06-16, also: "too hot and too cold are both intolerable" — set lower bound, upper bound, or both as the Scale\'s failure semantics require.',
    },
  },

  // ── HIGH (r03 — Tom Gilb 2026-06-16 SUPREME, practice in all books) ─────
  // Ambition Level sits ABOVE Scale.  Sentence-length vision/ambition that
  // motivates and precedes quantification.  Tom verbatim: "The Ambition
  // Level is required with a source above the Scale, see practice in all
  // my books."  Sourced authority via sourcePerson / sourceRef / sourceUrl
  // gives the V. real-world standing.
  {
    id: 'sd-no-ambition', group: 'spec-defects', builtin: true,
    name: 'V. with no Ambition Level',
    description: 'Tom Gilb 2026-06-16: "The Ambition Level is required with a source above the Scale, see practice in all my books."  A sentence-length vision precedes quantification.  Without it, the Value has no motivating ambition.',
    defaultWeight: 0.2,
    evaluate: ({ spec }) => {
      const bad = spec.values
        .filter(v => !v.ambitionLevel || v.ambitionLevel.length === 0 || !v.ambitionLevel[0].statement?.trim())
        .map(v => v.id)
      return {
        score: ratioToScore(countBadFraction(bad.length, spec.values.length)),
        detail: `${bad.length} of ${spec.values.length} Values lack an Ambition Level statement`,
        findings: bad,
      }
    },
    fix: {
      kind: 'ai',
      description: 'Propose a sentence-length Ambition Level statement that names the vision for this Value, plus a source (sourcePerson, sourceRef, sourceUrl) when derivable.  Tom Gilb: "When source is power, Planguage clarification has real authority behind it."',
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

  // ── Spec defect: non-mnemonic Tags (Tom Gilb 2026-06-09) ─────────────────
  // Catches three categories of bad Tag:
  //   1. Sequential type-codes (V1, F2, S3, C4, R5) — nobody can discuss "V3"
  //   2. PascalCase / CamelCase (no spaces, interior uppercase): "CostSave", "WorkBal"
  //   3. Long stuck-together words (no space, >8 chars, mixed case): "SafeAgg", "UserActivation"
  // Fix: propose 1–3 normal English words with spaces, Title Case, derived from description.
  {
    id: 'sd-non-mnemonic-ids', group: 'spec-defects', builtin: true,
    name: 'Non-mnemonic Tags', description: 'Tags must be readable human words with spaces — not V1/F1 codes or stuck-together CamelCase.',
    defaultWeight: 0.3,
    evaluate: ({ spec }) => {
      const isNonMnemonic = (id: string): boolean => {
        const t = id.trim()
        if (!t) return false
        // 1. Sequential type-code: V1, F2, S3, C4, R5 (whole-string match)
        if (/^[VFSCRvfscr]\d+$/.test(t)) return true
        // 2. CamelCase / PascalCase: no spaces, contains interior uppercase after a lowercase
        if (!/\s/.test(t) && /[a-z][A-Z]/.test(t)) return true
        // 3. Stuck-together: no space, >8 chars, not an all-uppercase acronym, has lowercase
        if (!/\s/.test(t) && t.length > 8 && !/^[A-Z0-9._-]+$/.test(t) && /[a-z]/.test(t)) return true
        return false
      }
      const all = [
        ...spec.functions.map(f => f.id),
        ...spec.values.map(v => v.id),
        ...spec.solutions.map(s => s.id),
      ]
      const bad = all.filter(isNonMnemonic)
      return {
        score: ratioToScore(countBadFraction(bad.length, all.length || 1)),
        detail: `${bad.length} Tag${bad.length === 1 ? '' : 's'} use non-mnemonic format (V1-type code / CamelCase / stuck-together words)`,
        findings: bad,
      }
    },
    fix: {
      kind: 'ai',
      description: 'Propose a 1–3 word mnemonic Tag in normal English with spaces and Title Case, derived from the entry description. Examples: "Cost Save" not "CostSave"; "Safety Aggregate" not "SafeAgg"; "Work Balance" not "WorkBal". The Tag must be discussable over coffee — if you cannot say it as natural English, it is wrong.',
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
        // r41 v236 — also check canonical mainImpacts / derivedFrom + legacy impact
        const haystack = `${s.mainImpacts ?? ''} ${s.derivedFrom ?? ''} ${s.impact ?? ''}`
        if (!haystack.trim()) return false
        return !allVIds.some(vid => haystack.includes(vid))
      }).map(s => s.id)
      return { score: ratioToScore(countBadFraction(bad.length, spec.solutions.length)), detail: `${bad.length} Solutions reference no declared Value`, findings: bad }
    },
    fix: {
      kind: 'ai',
      description: 'Propose which declared V. this Solution most likely Impacts based on the Solution description and existing V. set.',
    },
  },
  // r41 v236 (Tom Gilb 2026-06-21 SUPREME — Solution Parameters pinned 26-parameter canonical inventory).
  // Tier 1 REQUIRED fields per memory/rule_solution_parameters.md:
  //   id (always set) · type (always set) · level (always set) · status · description (always set)
  //   · derivedFrom · function · mainImpacts (legacy fallback: impact or impactsValues)
  // Audit fires when ANY of {status, derivedFrom, function, mainImpacts-or-legacy} is missing on
  // a Solution. Each missing field is a CRITICAL defect (ship-blocker). Composes with the
  // Planguage Parameter Discipline SUPREME (≤25-word ceiling per param — not audited here;
  // future Sharpening pass).
  {
    id: 'ic-solution-tier1-incomplete', group: 'inconsistencies', builtin: true,
    name: 'S. missing Tier-1 required parameter(s)',
    description: 'Every Solution must populate Tier-1 canonical parameters: Status · Description · Derived From · Function · Main Impacts (Tom Gilb 2026-06-21 SUPREME).',
    defaultWeight: 0.7,
    evaluate: ({ spec }) => {
      const bad: string[] = []
      const reasons: string[] = []
      for (const s of spec.solutions) {
        const gaps: string[] = []
        if (!(s.status ?? '').trim())                                                        gaps.push('Status')
        if (!(s.derivedFrom ?? '').trim())                                                   gaps.push('Derived From')
        if (!(s.function ?? '').trim())                                                      gaps.push('Function')
        if (!(s.mainImpacts ?? '').trim() && !(s.impact ?? '').trim() && !(s.impactsValues ?? '').trim()) gaps.push('Main Impacts')
        if (gaps.length > 0) {
          bad.push(s.id)
          reasons.push(`${s.id}: missing ${gaps.join(', ')}`)
        }
      }
      const detail = bad.length === 0
        ? 'All Solutions carry the Tier-1 required parameter set'
        : `${bad.length} of ${spec.solutions.length} Solutions missing Tier-1 fields — ${reasons.slice(0, 3).join(' · ')}${reasons.length > 3 ? ` · …` : ''}`
      return { score: ratioToScore(countBadFraction(bad.length, spec.solutions.length)), detail, findings: bad }
    },
    fix: {
      kind: 'ai',
      description: 'For each Solution, populate the missing Tier-1 parameters per the 26-parameter canonical inventory (Tom Gilb 2026-06-21 SUPREME). Status: NotProduction (default). Derived From: wikilink array of V. entries this Solution intends to satisfy. Function: wikilink to F. entry this Solution creates/modifies. Main Impacts: estimated % impact per Derived-From Value (e.g. "[[V.Latency]] +30%, [[V.Cost]] −15%"). ONE sentence per parameter, ≤25-word ceiling per Planguage Parameter Discipline SUPREME — no story-form paragraphs.',
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
      return { score: ratioToScore(countBadFraction(bad.length, spec.values.length)), detail: `${bad.length} Values with status already past Goal`, findings: bad }
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
    name: 'V. with no Meter (delivery-time gap)',
    description: 'Tom Gilb 2026-06-16 SUPREME: "Meter is Not required in initial planning, because we do not measure there, only after evo steps are defined… not required for planning until evo steps are going to be delivered (not just evo planned, but really delivered)."  Meter becomes REQUIRED when an Evo step that needs to measure this V. is about to be delivered.',
    // r07 lifecycle gating: Meter is a delivery-time concern, NOT a planning-time
    // concern.  Down-weighted from 0.35 → 0.10 so it stays visible as an upcoming
    // gap but does NOT drag PHI down during planning.  When the Sharpen orchestrator
    // gains an Evo-step lifecycle signal (steps 1–5 = planning, 6–9 = delivery),
    // upgrade to lifecycle-gated firing per the rule_value_definition_identity.md
    // memory rule.
    defaultWeight: 0.10,
    evaluate: ({ spec }) => {
      const bad = spec.values.filter(v => !v.meter?.trim()).map(v => v.id)
      return { score: ratioToScore(countBadFraction(bad.length, spec.values.length)), detail: `${bad.length} of ${spec.values.length} Values lack a Meter (deferred to delivery — set Meter before the Evo step that measures this Value goes into Develop / Deliver / Measure / Learn)`, findings: bad }
    },
    fix: {
      kind: 'ai',
      description: 'Propose a measurement method (Meter) that pairs with the existing Scale.  Per Tom Gilb SUPREME 2026-06-16: Meter is a delivery-time engineering decision deferred until the engineering context clarifies — carries its own qualities (accuracy, ease of training, tool availability) and costs (financial, duration, effort, training, tools).',
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
    // r41 v416 — was 0.5, rebalanced to 0.3 to accommodate Infinity Trap
    // (0.4).  Group weights: 0.3 + 0.3 + 0.4 = 1.0 ✓.
    defaultWeight: 0.3,
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
    defaultWeight: 0.3,
    evaluate: ({ spec }) => {
      const sByValue = new Map<string, number>()
      const allVIds2 = spec.values.map(v => v.id)
      for (const s of spec.solutions) {
        const refs = allVIds2.filter(vid => (s.impact ?? '').includes(vid))
        for (const r of refs) sByValue.set(r, (sByValue.get(r) ?? 0) + 1)
      }
      const monoVs = spec.values.filter(v => (sByValue.get(v.id) ?? 0) <= 1).map(v => v.id)
      return { score: ratioToScore(countBadFraction(monoVs.length, spec.values.length)), detail: `${monoVs.length} Values covered by 1 or fewer Solutions`, findings: monoVs }
    },
    fix: {
      kind: 'ai',
      description: 'Propose a second Solution that Impacts this V. from a different angle, so the V. has fallback coverage.',
    },
  },
  {
    // r41 v416 (Tom Gilb 2026-07-01 "do pending items" — audit-backlog #1) —
    // INFINITY TRAP DETECTOR.  r93mmm SUPREME rule banked 2026-06-12 in
    // CLAUDE.md but never wired into PHI.  Tom's verbatim principle:
    //   "Every scalar level without explicit Qualifiers on every relevant
    //    dimension is silently committing to infinity. Infinity costs are
    //    infinite; resources are finite; therefore unqualified levels
    //    guarantee failure."
    // The Tolstoy mnemonic (Tom 2026-06-12): a Value without Qualifiers
    // applies "no matter what — war or peace as Tolstoy said" — the most
    // extreme polar conditions, both included.  Infinite cost = certain
    // failure.  See CLAUDE.md r93mmm + memory rule_qualifiers_first_class.md.
    //
    // Detection: any V. or R. entry that HAS a scalar level (goal /
    // tolerable / wish / status / survival / stretch / fail) BUT has NO
    // conditionSets populated is in the Infinity Trap.
    //
    // Weight 0.4 (highest in `risks` group) because r93mmm names Infinity
    // Trap as SUPREME-tier + Tom banked it as CRITICAL PHI defect.
    // Composes with:
    //   - r93jjj Qualifiers-First SUPREME (canonical framework)
    //   - r93mmm Infinity Trap SUPREME (the WHY)
    //   - r93kkk Multi-Set + Two-Trigger Progressive Disclosure UX
    //   - Stage 3.3 Add-Qualifiers flow (existing target for the fix)
    //   - No-Silent-Data-Loss SUPREME (unqualified level = silent commitment
    //     to infinity = silent trust violation)
    //   - Conjunction-of-Technologies SUPREME (Claudian + Gilb-corpus +
    //     Internet can suggest realistic finite Qualifiers)
    //   - Twin portability — pure detector; ports verbatim
    id: 'rk-infinity-trap', group: 'risks', builtin: true,
    name: 'Infinity Trap — unqualified scalar levels',
    description:
      'r93mmm SUPREME: every scalar level (Goal / Tolerable / Wish / Survival / Status / Stretch / Fail) without explicit Qualifiers commits silently to INFINITE time × INFINITE place × INFINITE stakeholder × INFINITE scenario. Infinite cost + finite resources = certain failure. Bind each level to at least one when/where/who Qualifier via Stage 3.3.',
    defaultWeight: 0.4,
    evaluate: ({ spec }) => {
      // A "scalar" entry is one that CARRIES a numeric-flavoured level.
      // We check every V. and R. entry for either the legacy string fields
      // OR any conditionSet-carried level.  If it has ANY level but ZERO
      // populated conditionSets, it's in the trap.
      type ScalarEntry = { id: string; kind: 'V' | 'R' }
      const trappedEntries: ScalarEntry[] = []

      // Legacy scalar level keys — presence of any non-empty string here
      // means the entry expresses a commitment (Goal / Tolerable / Wish /
      // Survival / Status / Stretch / Fail).  We treat presence as an
      // Infinity-Trap-eligible commitment even if conditionSets is empty.
      const scalarKeys = ['goal', 'tolerable', 'wish', 'survival', 'status', 'stretch', 'fail'] as const

      function hasLegacyScalarLevel(entry: Record<string, unknown>): boolean {
        for (const k of scalarKeys) {
          const raw = entry[k]
          if (typeof raw === 'string' && raw.trim()) return true
        }
        return false
      }

      function hasAtLeastOneQualifierBoundLevel(sets: unknown): boolean {
        if (!Array.isArray(sets) || sets.length === 0) return false
        // Any set with a non-empty qualifiers array AND at least one level
        // populated proves the entry is NOT in the trap.
        for (const set of sets as Array<Record<string, unknown>>) {
          const qs = (set['qualifiers'] ?? set['conditions']) as unknown
          const hasQualifier = Array.isArray(qs) && qs.length > 0
          if (!hasQualifier) continue
          for (const k of scalarKeys) {
            const raw = set[k]
            if (typeof raw === 'string' && raw.trim()) return true
          }
        }
        return false
      }

      for (const v of spec.values ?? []) {
        const entry = v as unknown as Record<string, unknown>
        if (hasLegacyScalarLevel(entry) && !hasAtLeastOneQualifierBoundLevel(entry['conditionSets'])) {
          trappedEntries.push({ id: v.id, kind: 'V' })
        }
      }
      for (const r of spec.resources ?? []) {
        const entry = r as unknown as Record<string, unknown>
        if (hasLegacyScalarLevel(entry) && !hasAtLeastOneQualifierBoundLevel(entry['conditionSets'])) {
          trappedEntries.push({ id: r.id, kind: 'R' })
        }
      }

      const totalScalarEntries =
        (spec.values ?? []).length + (spec.resources ?? []).length
      if (totalScalarEntries === 0) {
        return { score: 0, detail: 'No V./R. scalar entries to assess yet' }
      }

      if (trappedEntries.length === 0) {
        return {
          score: 1,
          detail: `All ${totalScalarEntries} scalar entries have at least one Qualifier-bound level (no Infinity Trap defects)`,
        }
      }

      const findings = trappedEntries.map(e => e.id)
      const worstScore = ratioToScore(
        countBadFraction(trappedEntries.length, totalScalarEntries),
      )
      // Infinity Trap is CRITICAL — floor the score below 0 even at low
      // trapped counts (one trapped entry is still one silent commitment
      // to infinity).  Tom banked "CRITICAL-tier defect" verbatim in
      // r93mmm — hence the -0.4 minimum penalty regardless of ratio.
      const cappedScore = Math.min(-0.4, worstScore)
      return {
        score: cappedScore,
        detail:
          `${trappedEntries.length} of ${totalScalarEntries} scalar entries are in the INFINITY TRAP (${findings.slice(0, 3).join(', ')}${findings.length > 3 ? ', …' : ''}) — no Qualifiers bounding time / place / stakeholder / scenario`,
        findings,
      }
    },
    fix: {
      kind: 'manual',
      description:
        '🕰️ Open Stage 3.3 Add Qualifiers.  Every trapped V./R. entry needs at least one Qualifier (when / where / who) to escape the Infinity Trap.  Tom mnemonic: "If your spec applies in war AND peace (Tolstoy), you\'re in the trap."',
    },
  },

  // ── Coverage (3) ─────────────────────────────────────────────────────────
  {
    id: 'cv-stakeholder-coverage', group: 'coverage', builtin: true,
    name: 'Stakeholders with ≥1 V.', description: 'Every named stakeholder should have at least one Value. Stakeholder is DEFINED by their stake — no value cared about = not a stakeholder.',
    defaultWeight: 0.4,
    evaluate: ({ spec }) => {
      // r41 v227 (Tom Gilb 2026-06-19 verbatim "many stakeholders without
      // values, logic fail bigtime, that is definition of a stakeholder,
      // cough up values or delete stakehol") — original implementation
      // derived the stakeholder set FROM the values themselves
      // (spec.values.map(v => v.wishStakeholder)) then compared that set
      // against itself for coverage — ratio always 1.0, defect never
      // fired.  CORRECT logic: read the canonical stakeholder list from
      // spec.stakeholderEntries (the structured Planguage Stakeholder
      // section) and check each one has at least one Value with
      // wishStakeholder matching its id OR name (case-insensitive match
      // because the AI often writes names instead of ids).  A stakeholder
      // with zero Values is a definitional violation: "stakeholder" means
      // someone who has a stake — i.e. cares about at least one Value.
      const stakeholders = (spec as unknown as {
        stakeholderEntries?: Array<{ id: string; description?: string; definition?: string }>
      }).stakeholderEntries ?? []
      if (stakeholders.length === 0) return { score: 0, detail: 'No structured Stakeholder entries to assess yet' }
      const wishMap = spec.values
        .map(v => (v.wishStakeholder ?? '').trim().toLowerCase())
        .filter(Boolean)
      const orphans: string[] = []
      for (const sh of stakeholders) {
        const idLower = sh.id.toLowerCase()
        // Match by id OR id without prefix (e.g. "Compliance" matches "Compliance")
        // OR by description substring (AI sometimes writes name into description).
        const matched = wishMap.some(w =>
          w === idLower ||
          w.includes(idLower) ||
          idLower.includes(w) ||
          (sh.description ?? '').toLowerCase().includes(w),
        )
        if (!matched) orphans.push(sh.id)
      }
      const covered = stakeholders.length - orphans.length
      if (orphans.length === 0) {
        return { score: 1, detail: `All ${stakeholders.length} stakeholders have ≥1 Value` }
      }
      return {
        score: ratioToScore(covered / stakeholders.length),
        detail: `${orphans.length} of ${stakeholders.length} stakeholders have NO Value — definitional violation (a stakeholder by definition has at least one stake)`,
        findings: orphans,
      }
    },
    fix: {
      kind: 'manual',
      description: 'For each orphan stakeholder: EITHER add at least one V. entry with wishStakeholder set to that stakeholder\'s name (what value do they care about?), OR delete the stakeholder entry (they have no stake → not actually a stakeholder).  Tom Gilb 2026-06-19 verbatim: "cough up values or delete stakeholder".',
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
      return { score: ratioToScore(countBadFraction(orphans.length, spec.values.length)), detail: `${orphans.length} Values with no Solution`, findings: orphans }
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
        // r41 v230 (Tom Gilb 2026-06-20 crash) — defensive: a stored spec may
        // carry `valueOfFunction` as an array or other non-string due to a
        // historical writer bug; coerce to string before .split so the whole
        // app doesn't fail to mount.  Composes with No-Silent-Data-Loss
        // (we read what's there + degrade gracefully) + Architectural Resilience.
        const vofRaw = (v as { valueOfFunction?: unknown }).valueOfFunction
        const vofStr = typeof vofRaw === 'string'
          ? vofRaw
          : Array.isArray(vofRaw)
            ? vofRaw.join(',')
            : String(vofRaw ?? '')
        const refs = vofStr.split(/[,;]+/).map(s => s.trim()).filter(Boolean)
        for (const r of refs) fLinked.add(r)
      }
      const orphans = Array.from(fIds).filter(id => !fLinked.has(id))
      return { score: ratioToScore(countBadFraction(orphans.length, fIds.size)), detail: `${orphans.length} Functions without a measurable Value`, findings: orphans }
    },
    fix: {
      kind: 'ai',
      description: 'Propose a Value (with Scale + Meter) that measures the performance of this orphan F.',
    },
  },

  // ── Spec Quality: Source Knowledge (Tom Gilb 2026-06-09 Spec Sources design) ─
  // Percentage of significant Planguage fields that carry explicit source attribution.
  // "Source: will always be specified explicitly or implied from editing or AI change activity."
  // Starts at 0 PHI weight (spec-quality group defaultWeight: 0.00) so it monitors without
  // penalising existing plans that pre-date the feature. Plan owners can increase the group
  // weight once they start caring about traceability.
  {
    id: 'src-knowledge-score', group: 'spec-quality', builtin: true,
    name: 'Source Knowledge',
    description: 'Percentage of spec fields with explicit source attribution. ' +
      'Planguage rule: "Source: will always be specified explicitly or implied from editing or AI change activity." ' +
      '(Tom Gilb 2026-06-09)',
    defaultWeight: 1.0,
    evaluate: ({ spec }) => {
      // Count significant Planguage fields per entry type and check fieldSources coverage.
      // Values: scale, meter, goal, tolerable, status — the 5 primary quantification fields.
      // Resources: scale, meter, budget — the 3 primary resource fields.
      // Functions: description, presenceTest — the 2 binary presence fields.
      // Solutions: description — the primary field.
      // Constraints: description — the primary field.
      let total = 0
      let attributed = 0

      for (const v of spec.values) {
        const fields = ['scale', 'meter', 'goal', 'tolerable', 'status'] as const
        for (const f of fields) {
          if (v[f]?.trim()) {
            total++
            if (v.fieldSources?.[f]) attributed++
          }
        }
      }
      for (const r of (spec.resources ?? [])) {
        const fields = ['scale', 'meter'] as const
        for (const f of fields) {
          if (r[f]?.trim()) {
            total++
            if (r.fieldSources?.[f]) attributed++
          }
        }
        // budget (backwards-compat via r.budget ?? r.goal)
        const bVal = r.budget ?? r.goal
        if (bVal?.trim()) {
          total++
          if (r.fieldSources?.['budget']) attributed++
        }
      }
      for (const fn of spec.functions) {
        if (fn.description?.trim()) {
          total++
          if (fn.fieldSources?.['description']) attributed++
        }
        const pt = fn.presenceTest ?? fn.successCriteria ?? ''
        if (pt.trim()) {
          total++
          if (fn.fieldSources?.['presenceTest']) attributed++
        }
      }
      for (const s of spec.solutions) {
        if (s.description?.trim()) {
          total++
          if (s.fieldSources?.['description']) attributed++
        }
      }
      for (const c of (spec.constraints ?? [])) {
        if (c.description?.trim()) {
          total++
          if (c.fieldSources?.['description']) attributed++
        }
      }

      if (total === 0) return { score: 0, detail: 'No attributed fields yet — no significant fields found' }
      const pct = Math.round((attributed / total) * 100)
      return {
        score: ratioToScore(attributed / total),
        detail: `Source Knowledge: ${pct}% (${attributed} of ${total} significant fields attributed)`,
        findings: total === 0 ? [] : undefined,
      }
    },
    fix: {
      kind: 'manual',
      description: 'Open the field in PentaPanel and click Apply Changes to stamp the source. ' +
        'Source attribution requires human confirmation — it cannot be guessed automatically.',
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
