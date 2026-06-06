// UNIT_TYPE=Hook
// useMultiVision — Module-level singleton for MultiVision panel state
// VDT-grounded: V sliders set commitment level (Constraint or Target), R sliders set budget, consequences computed live.
// Tom Gilb 2026-06-06: "Ambition" was the wrong word — Ambition *423 is a vague informal summary
// that cannot be MET. The slider picks a precise Constraint (Tolerable) or Target (Goal/Wish).
// Spec: F.MultiVision (#MV1) — Design log rXX.

import { ref, computed, reactive, watch } from 'vue'
import type { VEntry, REntry, SEntry } from '../types/spec'
import { useSpecModel } from './useSpecModel'
import { computeMockImpactSnapshot } from './useImpactSuggestions'

// ── Module-level singleton state ───────────────────────────────────────────────

/** Whether the MultiVision panel is open. */
const isOpen = ref(false)

/**
 * Per-V-entry slider values (DEPRECATED single-thumb form — kept as alias of
 * `vWishSliders` so existing call sites continue to compile.  Tom Gilb
 * 2026-06-06: "ttons not one. One for the scalar constraint (Tolerable by
 * default), and one for the success level (Wish, or Goal when committed by
 * the design and resources etc., we can actually only set the Wish)".
 * The Planguage-correct model: the user SETS the Constraint (Tolerable) AND
 * the success target Wish; the Goal EMERGES from OPTIMA balancing.
 */
const vSliders = reactive<Record<string, number>>({})

/**
 * Per-V-entry **Tolerable Constraint** slider position.
 * 0 = at Past/benchmark · 100 = at primary Target (Wish or Goal).
 * Default 25 — the user is setting "below this the project fails".
 */
const vTolerableSliders = reactive<Record<string, number>>({})

/**
 * Per-V-entry **Wish Target** slider position.
 * 0 = at Past/benchmark · 100 = at the stakeholder dream level.
 * Default 75.  Tom Gilb 2026-06-06: "we can actually only set the Wish" —
 * the Wish is what the user articulates; Goal emerges from engineering.
 */
const vWishSliders = reactive<Record<string, number>>({})

/**
 * Per-R-entry budget slider values.
 * 0 = no budget, 100 = full budget.
 * Default: 100.
 */
const rSliders = reactive<Record<string, number>>({})

/**
 * Aggregate budget slider — used when no R entries exist in the spec.
 * 0 = no budget, 100 = full budget.
 */
const aggregateBudget = ref(100)

// ── Spec data access ──────────────────────────────────────────────────────────

const { currentModel } = useSpecModel()

/** Reactive V entries from the current spec. */
const values = computed<VEntry[]>(() =>
  currentModel.value?.spec?.values ?? []
)

/** Reactive R entries from the current spec. */
const resources = computed<REntry[]>(() =>
  currentModel.value?.spec?.resources ?? []
)

/** Reactive S entries from the current spec. */
const solutions = computed<SEntry[]>(() =>
  currentModel.value?.spec?.solutions ?? []
)

// ── VDT snapshot (deterministic mock) ─────────────────────────────────────────

/**
 * Mock VDT snapshot computed from current V × S entries.
 * Provides: matrix, vcRatios, calendarCosts, capitalCosts.
 */
const snapshot = computed(() =>
  computeMockImpactSnapshot(values.value, solutions.value)
)

// ── Budget fraction ────────────────────────────────────────────────────────────

/**
 * Fraction of total budget available (0–1).
 * Uses average of R sliders when R entries exist; otherwise aggregateBudget.
 */
const budgetFraction = computed<number>(() => {
  const res = resources.value
  if (res.length > 0) {
    const sum = res.reduce((acc, r) => acc + (rSliders[r.id] ?? 100), 0)
    return (sum / res.length) / 100
  }
  return aggregateBudget.value / 100
})

// ── Funded solutions ──────────────────────────────────────────────────────────

/**
 * Solutions funded within the available budget, sorted by VCRatio descending.
 * Takes solutions greedily by V/C ratio until available capital is exhausted.
 */
const fundedSolutions = computed<SEntry[]>(() => {
  const sols = solutions.value
  if (sols.length === 0) return []

  const { vcRatios, capitalCosts } = snapshot.value

  // Total capital cost across all solutions
  const totalCapital = sols.reduce(
    (acc, s) => acc + (capitalCosts[s.id] ?? 0),
    0
  )
  const availableCapital = totalCapital * budgetFraction.value

  // Sort solutions by V/C ratio descending
  const sorted = [...sols].sort((a, b) => {
    const ra = vcRatios[a.id] ?? 0
    const rb = vcRatios[b.id] ?? 0
    return rb - ra
  })

  // Greedy fill within budget
  let spent = 0
  const funded: SEntry[] = []
  for (const sol of sorted) {
    const cost = capitalCosts[sol.id] ?? 0
    if (spent + cost <= availableCapital) {
      funded.push(sol)
      spent += cost
    }
  }
  return funded
})

// ── V delivery (per value) ─────────────────────────────────────────────────────

/**
 * Estimated delivery level for each V entry (0–100) given funded solutions.
 */
const vDelivery = computed<Record<string, number>>(() => {
  const vals = values.value
  if (vals.length === 0) return {}

  const { matrix } = snapshot.value
  const funded = fundedSolutions.value
  const result: Record<string, number> = {}

  for (const v of vals) {
    if (funded.length === 0) {
      // No funded solutions → zero delivery
      result[v.id] = 0
      continue
    }
    if (solutions.value.length === 0) {
      // No solutions in spec → assume partial delivery
      result[v.id] = 50
      continue
    }

    const totalImpact = funded.reduce((acc, sol) => {
      return acc + (matrix[v.id]?.[sol.id] ?? 0)
    }, 0)

    // Normalize: max possible = fundedSolutions.length * 100
    const raw = (totalImpact / (funded.length * 100)) * 100
    result[v.id] = Math.min(100, Math.max(0, raw))
  }
  return result
})

// ── V feasibility ─────────────────────────────────────────────────────────────

type Feasibility = 'green' | 'amber' | 'red'

/**
 * Feasibility status for each V entry relative to its commitment-level slider position.
 */
const vFeasibility = computed<Record<string, Feasibility>>(() => {
  const vals = values.value
  const result: Record<string, Feasibility> = {}
  for (const v of vals) {
    const delivery = vDelivery.value[v.id] ?? 0
    const target = vSliders[v.id] ?? 50 // default uninitialized sliders to 50
    if (delivery >= target) {
      result[v.id] = 'green'
    } else if (delivery >= target * 0.7) {
      result[v.id] = 'amber'
    } else {
      result[v.id] = 'red'
    }
  }
  return result
})

// ── Balance score + breakdown ─────────────────────────────────────────────────

/**
 * Overall vision balance: percentage of V entries achieving 'green' feasibility.
 * Range 0–100. Default 50 when no V entries.
 */
const balanceScore = computed<number>(() => {
  const vals = values.value
  if (vals.length === 0) return 50
  const greenCount = vals.filter(
    v => vFeasibility.value[v.id] === 'green'
  ).length
  return Math.round((greenCount / vals.length) * 100)
})

/**
 * Count of Value entries in each feasibility band.
 * Shown beneath the balance gauge so the user sees the breakdown, not just the %.
 */
const balanceBreakdown = computed<{ green: number; amber: number; red: number; total: number }>(() => {
  const vals = values.value
  let green = 0, amber = 0, red = 0
  for (const v of vals) {
    const f = vFeasibility.value[v.id]
    if (f === 'green') green++
    else if (f === 'amber') amber++
    else red++
  }
  return { green, amber, red, total: vals.length }
})

// ── Capital / budget math (user-visible context for sliders) ──────────────────

/**
 * Sum of all solution capital costs ($k) from the mock VDT snapshot.
 * Used in the aggregate-budget panel to tell the user what 100% actually means.
 */
const totalCapitalCost = computed<number>(() => {
  const { capitalCosts } = snapshot.value
  return solutions.value.reduce((acc, s) => acc + (capitalCosts[s.id] ?? 0), 0)
})

/**
 * Effective capital available at current budget fraction ($k).
 * Drops as the user pulls down the budget slider.
 */
const availableCapital = computed<number>(() => {
  const res = resources.value
  const frac = res.length > 0
    ? res.reduce((acc, r) => acc + (rSliders[r.id] ?? 100), 0) / (res.length * 100)
    : aggregateBudget.value / 100
  return totalCapitalCost.value * frac
})

// ── Planguage threshold parser (Tolerable / Goal / Wish) ──────────────────────

const _NUMERIC_RE = /(-?\d+\.?\d*)/

/**
 * Parse a Planguage threshold string (e.g. "Goal [2026, deployed] 85%") and
 * return the first numeric value with any %/unit suffix preserved.
 * Returns { num, raw } — raw is the bracket-stripped tail, num is the parsed number or null.
 */
function parsePlanguageThreshold(value: string): { num: number | null; display: string } {
  if (!value) return { num: null, display: '' }
  // Strip bracketed qualifiers like [2026, deployed]
  const stripped = value.replace(/\[[^\]]*\]/g, '').trim()
  const match = _NUMERIC_RE.exec(stripped)
  if (!match) return { num: null, display: stripped }
  const num = parseFloat(match[1])
  // Try to capture trailing unit (% / $ / weeks / days / hours / N)
  const after = stripped.slice(match.index + match[0].length).trim()
  const unitMatch = /^([%$€£]|\s*[A-Za-z]+)?/.exec(after)
  const unit = unitMatch?.[1]?.trim() ?? ''
  return { num, display: unit ? `${num}${unit.startsWith(' ') ? '' : ''}${unit}` : `${num}` }
}

// ── Tradeoff insights ─────────────────────────────────────────────────────────
//
// Tom Gilb 2026-06-06 (verbatim): "add to Multivision, at the end of a set of
// changes, you could write a set of insights, like IF YOU REDUCE WISH LEVEL X
// TO Y YOU CAN REDUCE COSTS BY 30% AND THESE CAN BE USED TO IMPROV VALUE Y TO
// THE WISH LEVEL, THIS YER".
//
// Pattern types:
//   - 'tradeoff'    — lower commitment level on one Value (e.g. Wish → Goal)
//                     → save budget → fund a Solution that lifts a struggling Value
//   - 'headroom'    — small budget bump would fund the next-best Solution
//   - 'over-deliver' — a Value is delivering far more than its committed level;
//                     raise the commitment or accept the slack
//   - 'all-green'   — every Value MEETS its committed level; congratulate +
//                     suggest raising one commitment toward Wish
//
// The math runs entirely off the deterministic mock VDT snapshot — no LLM.
// Insights are RECOMPUTED live as sliders move, so they stay relevant.

// ── Restatement consequences (Tom Gilb 2026-06-06) ──────────────────────────
//
// Tom verbatim: "the movable dot is the setting of the level required, not
// the 'status'. so when we move it, the intent is to restate the requirement
// or budget level. It then needs to redesign solutions, possible, or option,
// and to reconsider the cost impact of the change".
//
// Each Value slider is a LIVE RESTATEMENT of the requirement / Goal. Moving
// it has TWO real consequences the user must see:
//   1. Cost impact: pushing the required level up needs more budget / more
//      solutions; pulling it down frees budget.
//   2. Solutions to reconsider: funded solutions whose impact on the Value
//      now falls below the new required level need redesign — or a more
//      capable solution needs adding.

export interface RestatementConsequence {
  /** Slider default = 50 = at Goal. Delta from default in 0–100 IET units. */
  deltaFromDefault: number
  /** Estimated capital-cost impact in $k (rough heuristic). */
  estimatedCostImpactK: number
  /** Solution IDs whose impact on this Value is now BELOW the new required level. */
  solutionsToReconsider: string[]
  /** Plain-language hint suitable for display next to the slider. */
  hint: string
}

const restatementConsequences = computed<Record<string, RestatementConsequence>>(() => {
  const out: Record<string, RestatementConsequence> = {}
  const vals = values.value
  const sols = solutions.value
  const { matrix, capitalCosts } = snapshot.value

  for (const v of vals) {
    const required = vSliders[v.id] ?? 50
    const deltaFromDefault = required - 50 // negative = lowered, positive = raised

    // Funded solutions whose impact on this Value falls below the new required level
    // need reconsideration.  We compare the per-solution impact (already on the IET %
    // scale) to the new required level.
    const reconsider: string[] = []
    for (const sol of fundedSolutions.value) {
      const impact = matrix[v.id]?.[sol.id] ?? 0
      if (impact > 0 && impact < required) {
        reconsider.push(sol.id)
      }
    }

    // Rough cost-impact heuristic: a +N IET-unit restatement scales linearly with
    // the median funded-solution cost.  This is a HEURISTIC, not a contract — the
    // exact figure depends on which specific solutions get redesigned + a real OPTIMA
    // pass.  The sign + order-of-magnitude is what matters for the user's first read.
    const medianCost = fundedSolutions.value.length > 0
      ? (fundedSolutions.value.reduce((sum, s) => sum + (capitalCosts[s.id] ?? 0), 0) / fundedSolutions.value.length)
      : (totalCapitalCost.value / Math.max(1, sols.length))
    const estimatedCostImpactK = Math.round((deltaFromDefault / 50) * medianCost)

    // Human-readable hint.
    let hint: string
    if (Math.abs(deltaFromDefault) < 5) {
      hint = 'Required level near the Goal-zone default — minimal consequence.'
    } else if (deltaFromDefault > 0) {
      const n = reconsider.length
      hint = `Restating the required level UP by ${deltaFromDefault} IET units. ${n} funded solution${n !== 1 ? 's' : ''} would no longer reach the new requirement — they need REDESIGN or REPLACEMENT. Estimated cost impact: ~+$${estimatedCostImpactK}k.`
    } else {
      hint = `Restating the required level DOWN by ${-deltaFromDefault} IET units. The funded solution set has slack vs the new requirement. Estimated cost impact: ~-$${Math.abs(estimatedCostImpactK)}k (could free budget).`
    }

    out[v.id] = { deltaFromDefault, estimatedCostImpactK, solutionsToReconsider: reconsider, hint }
  }
  return out
})

export interface MultiVisionInsight {
  id: string
  type: 'tradeoff' | 'headroom' | 'over-deliver' | 'all-green' | 'no-budget' | 'restatement'
  severity: 'opportunity' | 'info' | 'warning'
  icon: string
  message: string
}

const insights = computed<MultiVisionInsight[]>(() => {
  const result: MultiVisionInsight[] = []
  const vals = values.value
  const sols = solutions.value
  const funded = fundedSolutions.value
  const unfunded = sols.filter(s => !funded.some(f => f.id === s.id))
  const { matrix, vcRatios, capitalCosts } = snapshot.value

  // Edge case: no spec data → no insights to draw
  if (vals.length === 0 || sols.length === 0) return result

  // Canonical Planguage commitment terms — Tom Gilb 2026-06-06: insights must
  // surface the Glossary semantics. "Ambition" is the wrong term (it is a vague
  // informal summary, cannot be MET); the slider chooses a precise commitment
  // level — a Constraint (Tolerable) or a Target (Goal / Wish).
  //   Tolerable >> = minimum non-failure (project-viability threshold)
  //   Goal      >  = committed promise the project will deliver
  //   Wish      >? = stakeholder dream, uncommitted, independent of cost+physics

  // ── Pattern: zero-budget warning ─────────────────────────────────────────
  if (funded.length === 0 && sols.length > 0) {
    result.push({
      id: 'no-budget',
      type: 'no-budget',
      severity: 'warning',
      icon: '⚠️',
      message:
        `No solutions funded at the current Resource budget. Without funded solutions, no Value ` +
        `clears even its Tolerable threshold — every Value sits in the Intolerable Range and the ` +
        `project fails. Raise the Resource budget slider to start delivering Value.`,
    })
  }

  // ── Pattern: lower-Wish-to-fund-shortfall ───────────────────────────────
  // Find Values aiming high (slider > 67 = Wish zone) AND another Value falling short.
  // Wish is the STAKEHOLDER DREAM — uncommitted. Reducing it to Goal (committed
  // promise) is a perfectly Planguage-faithful tradeoff because the project never
  // promised the Wish level in the first place.
  const aimingHigh = vals.filter(v => (vSliders[v.id] ?? 50) > 67)
  const shortfallValues = vals.filter(v => vFeasibility.value[v.id] === 'red')

  for (const highV of aimingHigh) {
    if (shortfallValues.length === 0) break
    const shortV = shortfallValues.find(s => s.id !== highV.id)
    if (!shortV) continue
    let bestSol = null as null | { id: string; impact: number; cost: number }
    for (const sol of unfunded) {
      const impact = matrix[shortV.id]?.[sol.id] ?? 0
      const cost = capitalCosts[sol.id] ?? 0
      if (impact > 30 && (bestSol === null || impact > bestSol.impact)) {
        bestSol = { id: sol.id, impact, cost }
      }
    }
    if (bestSol) {
      result.push({
        id: `tradeoff-${highV.id}-${shortV.id}`,
        type: 'tradeoff',
        severity: 'opportunity',
        icon: '💡',
        message:
          `Drop ${highV.id} from Wish (stakeholder dream — uncommitted) back to Goal (committed promise). ` +
          `Frees ~$${bestSol.cost}k that could fund Solution ${bestSol.id}, lifting ${shortV.id} by ~${bestSol.impact.toFixed(0)}% ` +
          `out of the project-failure zone toward its Goal commitment.`,
      })
      if (result.filter(r => r.type === 'tradeoff').length >= 3) break
    }
  }

  // ── Pattern: budget-headroom (next-best unfunded Solution) ──────────────
  if (unfunded.length > 0 && funded.length > 0) {
    const nextUp = [...unfunded].sort(
      (a, b) => (vcRatios[b.id] ?? 0) - (vcRatios[a.id] ?? 0)
    )[0]
    const cost = capitalCosts[nextUp.id] ?? 0
    const ratio = vcRatios[nextUp.id] ?? 0
    let bestValue: { id: string; impact: number } | null = null
    for (const v of vals) {
      const impact = matrix[v.id]?.[nextUp.id] ?? 0
      if (impact > (bestValue?.impact ?? 0)) {
        bestValue = { id: v.id, impact }
      }
    }
    if (cost > 0 && bestValue && bestValue.impact > 20) {
      const budgetBump = Math.ceil((cost / totalCapitalCost.value) * 100)
      result.push({
        id: `headroom-${nextUp.id}`,
        type: 'headroom',
        severity: 'opportunity',
        icon: '🪜',
        message:
          `Adding ~${budgetBump}% to the Resource budget (about $${cost}k) would fund Solution ${nextUp.id} ` +
          `(Value-per-Cost ${ratio.toFixed(1)}), moving ${bestValue.id} ~${bestValue.impact.toFixed(0)}% closer to its Goal commitment.`,
      })
    }
  }

  // ── Pattern: over-delivery (a Value way above its target) ───────────────
  // Per Glossary *109: beyond Goal = diminishing returns. If we're over-delivering
  // on a Value sitting at a low commitment level, that's surplus the project could redirect
  // OR re-commit to a higher Goal (i.e., raise the negotiated promise).
  for (const v of vals) {
    const delivery = vDelivery.value[v.id] ?? 0
    const target = vSliders[v.id] ?? 50
    if (delivery >= target + 30 && target < 90) {
      result.push({
        id: `over-${v.id}`,
        type: 'over-deliver',
        severity: 'info',
        icon: '🎯',
        message:
          `${v.id} delivers ${delivery.toFixed(0)}% IET Achievement against your committed level of ${target}/100. ` +
          `Beyond Goal = diminishing returns (Glossary *109). Either raise the Goal commitment for this Value, ` +
          `or accept the headroom and redirect budget elsewhere.`,
      })
      if (result.filter(r => r.type === 'over-deliver').length >= 2) break
    }
  }

  // ── Pattern: all-green congratulation ───────────────────────────────────
  if (
    vals.length > 0 &&
    balanceBreakdown.value.green === vals.length &&
    balanceScore.value === 100
  ) {
    result.push({
      id: 'all-green',
      type: 'all-green',
      severity: 'opportunity',
      icon: '✅',
      message:
        `Every Value meets its committed Goal at the current budget. Try pushing one slider toward Wish ` +
        `(the stakeholder dream level) — if it stays green, your Vision has real headroom to raise the Goal commitment.`,
    })
  }

  return result
})

// ── Auto-init watchers ────────────────────────────────────────────────────────

/** Initialize any missing V slider entries to default (50) without resetting existing.
 *  Tom Gilb 2026-06-06: also seed the two-thumb Tolerable + Wish defaults. */
watch(values, (newVals) => {
  for (const v of newVals) {
    if (!(v.id in vSliders))         vSliders[v.id]         = 50
    if (!(v.id in vTolerableSliders)) vTolerableSliders[v.id] = 25  // failure line — low end
    if (!(v.id in vWishSliders))      vWishSliders[v.id]      = 75  // dream level — high end
  }
}, { immediate: true })

// ── Derived Goal slider position (Tom Gilb 2026-06-06) ───────────────────────
// The user does NOT directly set the Goal — it EMERGES from OPTIMA balancing.
// Default heuristic: Goal sits at the midpoint between the Tolerable Constraint
// and the Wish Target.  Once a real OPTIMA evaluator runs against Resource
// constraints + V/C ratios, this midpoint becomes the OPTIMA-balanced result.
const vDerivedGoal = computed<Record<string, number>>(() => {
  const out: Record<string, number> = {}
  for (const v of values.value) {
    const tol = vTolerableSliders[v.id] ?? 25
    const wsh = vWishSliders[v.id]      ?? 75
    out[v.id] = Math.round((tol + wsh) / 2)
  }
  return out
})

/** Initialize any missing R slider entries to default (100) without resetting existing. */
watch(resources, (newRes) => {
  for (const r of newRes) {
    if (!(r.id in rSliders)) {
      rSliders[r.id] = 100
    }
  }
}, { immediate: true })

// ── Exported functions ────────────────────────────────────────────────────────

function openMultiVision(): void {
  initSliders()
  isOpen.value = true
}

function closeMultiVision(): void {
  isOpen.value = false
}

function setVSlider(id: string, val: number): void {
  vSliders[id] = Math.min(100, Math.max(0, val))
}

/** Set the Tolerable Constraint slider for a Value entry. */
function setVTolerableSlider(id: string, val: number): void {
  const clamped = Math.min(100, Math.max(0, val))
  vTolerableSliders[id] = clamped
  // Tolerable can never exceed Wish — push Wish up if needed.
  const wish = vWishSliders[id] ?? 75
  if (clamped > wish - 2) vWishSliders[id] = Math.min(100, clamped + 2)
}

/** Set the Wish Target slider for a Value entry. */
function setVWishSlider(id: string, val: number): void {
  const clamped = Math.min(100, Math.max(0, val))
  vWishSliders[id] = clamped
  // Wish can never go below Tolerable — pull Tolerable down if needed.
  const tol = vTolerableSliders[id] ?? 25
  if (clamped < tol + 2) vTolerableSliders[id] = Math.max(0, clamped - 2)
}

function setRSlider(id: string, val: number): void {
  rSliders[id] = Math.min(100, Math.max(0, val))
}

function setAggregateBudget(val: number): void {
  aggregateBudget.value = Math.min(100, Math.max(0, val))
}

/** Reset all sliders to their defaults. */
function resetSliders(): void {
  for (const v of values.value) {
    vSliders[v.id]          = 50
    vTolerableSliders[v.id] = 25
    vWishSliders[v.id]      = 75
  }
  for (const r of resources.value) {
    rSliders[r.id] = 100
  }
  aggregateBudget.value = 100
}

/**
 * Initialize sliders for any entries not yet tracked.
 * Called in openMultiVision so new entries added since last open get defaults.
 */
function initSliders(): void {
  for (const v of values.value) {
    if (!(v.id in vSliders))          vSliders[v.id]          = 50
    if (!(v.id in vTolerableSliders)) vTolerableSliders[v.id] = 25
    if (!(v.id in vWishSliders))      vWishSliders[v.id]      = 75
  }
  for (const r of resources.value) {
    if (!(r.id in rSliders)) {
      rSliders[r.id] = 100
    }
  }
}

// ── Composable export ─────────────────────────────────────────────────────────

export function useMultiVision() {
  return {
    // Panel state
    isOpen,
    openMultiVision,
    closeMultiVision,

    // Slider state
    vSliders,
    vTolerableSliders,
    vWishSliders,
    vDerivedGoal,
    rSliders,
    aggregateBudget,

    // Slider setters
    setVSlider,
    setVTolerableSlider,
    setVWishSlider,
    setRSlider,
    setAggregateBudget,
    resetSliders,
    initSliders,

    // Derived data
    fundedSolutions,
    vDelivery,
    vFeasibility,
    balanceScore,
    balanceBreakdown,
    totalCapitalCost,
    availableCapital,
    insights,
    restatementConsequences,
    snapshot,

    // Helpers
    parsePlanguageThreshold,

    // Spec data (reactive)
    values,
    resources,
    solutions,
  }
}
