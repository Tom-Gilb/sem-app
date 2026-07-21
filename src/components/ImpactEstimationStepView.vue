<!-- UNIT_TYPE=Widget -->
<!--
/**
 * Renders the V × Evo Step Impact Estimation grid — the Planguage Impact Table
 * keyed by EVO STEP (the unit of value delivery), not by Solution.
 *
 * Methodology (Tom Gilb, 2026-06-03): *"I expected want the VDT columns to be
 * Evo Steps (V × Step) instead of Solutions (V × S)? at that stage, just after Evo"*
 *
 * The Evo Step is the unit of value delivery. A Solution may span multiple Steps
 * (split delivery); a Step may combine multiple Solutions. Impact-per-Step drives
 * Evo prioritisation directly — V × Step makes the prioritisation decisions
 * legible at the stage where they matter.
 *
 * v1 SCOPE — DERIVED, DISPLAY-ONLY (this version):
 *   - Cells display each Step's impact-per-Value
 *   - Cell value = Σ (V × S cell value) for solutions in step.linkedSolutions
 *   - Source: capturedImpactMatrix (V × S, prop) — populated when user has visited
 *     the V × S view at any point in their session
 *   - If V × S matrix is empty, cells show "–" (no estimate)
 *   - No editing — view-only. Edit V × S to influence what shows here.
 *
 * v2 ROADMAP (deferred, not in this version):
 *   - Per-cell editing with step-keyed override matrix
 *   - Per-step calendar / capital costs (currently uses step.effortPercent only)
 *   - Efficiency ranking by step (Value Impact Sum / effortPercent)
 *   - AI-suggested cells via Claudian-orchestrated file write (NOT in-app API)
 *   - Optional toggle between V × Step and V × S display
 *
 * Visual contract: same traffic-light colour scheme as ImpactEstimationView
 *   (getImpactColour from utils/impactColour.ts) for visual continuity. Bottom
 *   row shows each step's effortPercent (already on the EvoStep). Right column
 *   shows each value's total impact across all steps.
 *
 * Twin portability:
 *   - Pure data contracts: values (VEntry[]) + steps (EvoStep[]) + matrix (V×S record)
 *   - No external state — all derivations are pure computeds
 *   - No Vue-specific business logic — Kai's team can port to any framework
 *   - Field names align to Template_Write_Value.md / EvoStep type contract
 */
-->
<script setup lang="ts">
import { computed } from 'vue'
import type { VEntry, SEntry } from '../types/spec'
import type { EvoStep } from '../types/evo-plan'
import { getImpactColour } from '../utils/impactColour'

const props = defineProps<{
  /** V. entries from currentSpec — one row per Value */
  values: VEntry[]
  /** Evo Steps from useEvoPlan() — one column per Step */
  steps: EvoStep[]
  /** S. entries from currentSpec — used to resolve step.linkedSolutions strings
   *  to solution.id keys for matrix lookup. The LLM's linkedSolutions can be
   *  descriptions, IDs, or fuzzy variants; this prop is the authoritative source
   *  for the description↔id mapping. Optional: when absent, linkedSolutions
   *  strings are used directly as matrix keys (legacy path). */
  solutions?: SEntry[]
  /** The V × S matrix from ImpactEstimationView — used to derive V × Step cells
   *  via step.linkedSolutions aggregation. Optional: empty matrix → all cells "–". */
  impactMatrix?: Record<string, Record<string, number>>
}>()

// ── Solution name resolution ─────────────────────────────────────────────────
//
// ROBUSTNESS NOTE (2026-06-03): The LLM that generates Evo Steps may write
// linkedSolutions using either:
//   (a) the solution.id      (e.g. "S.1", "S.SupabaseAuth")
//   (b) the solution.description (e.g. "Supabase Auth Integration")
//   (c) a fuzzy variant (e.g. lowercased, trimmed, partial match)
//
// The V × S impact matrix is always keyed by solution.id, so we need to resolve
// whatever the LLM wrote back to the canonical id before matrix lookup.
//
// The map below normalises all three forms: id-as-key, description-as-key
// (lowercased + trimmed), and id-as-key once more for direct hits. Direct-id
// references resolve in O(1); description references resolve in O(1) via the
// lowercased lookup. Unmatched references fall through to the raw string
// (which produces 0 from the matrix, rendering as "–").

/** Map from any recognised reference (id OR lowercased description) → solution.id */
const solutionIdLookup = computed<Map<string, string>>(() => {
  const m = new Map<string, string>()
  for (const sol of props.solutions ?? []) {
    m.set(sol.id, sol.id)                                  // direct id hit
    m.set(sol.description.trim().toLowerCase(), sol.id)    // description hit
  }
  return m
})

/** Resolves a linkedSolutions string to a solution.id, or returns the raw string
 *  unchanged when no match exists (signals "no matrix data" downstream).
 *
 *  DEBUG AID (2026-06-03): unresolved refs are logged ONCE per ref via the warned
 *  Set, so if cells show "–" the developer can open DevTools and see exactly which
 *  LLM-emitted linkedSolutions strings failed to match any spec.solution.id or
 *  spec.solution.description. Most common cause: LLM emitted a fuzzy variant
 *  (e.g., "Auth Backend" instead of "Supabase Auth Integration"). */
const _warned = new Set<string>()
function resolveSolutionRef(ref: string): string {
  const normalized = ref.trim().toLowerCase()
  const hit = solutionIdLookup.value.get(normalized)
           ?? solutionIdLookup.value.get(ref.trim())
  if (hit) return hit
  // Unresolved — log once for debug visibility, then fall through to raw ref
  if (!_warned.has(ref) && props.solutions && props.solutions.length > 0) {
    _warned.add(ref)
    const available = props.solutions.map(s => `${s.id} (${s.description})`).join(' | ')
    console.warn(
      `[ImpactEstimationStepView] linkedSolutions ref "${ref}" did not match any spec.solution. ` +
      `Available solutions: ${available}. Cell will show "–". ` +
      `LLM may have emitted a fuzzy variant — consider sharpening the spec or re-generating.`,
    )
  }
  return ref
}

// ── Cell derivation ──────────────────────────────────────────────────────────

/**
 * Derives a step's impact on a value by summing the impact of every Solution
 * the step is linked to. Returns 0 when the V × S matrix has no estimate for
 * any of the step's linked solutions (renders as "–" in the cell).
 *
 * Why sum (not average): a step that bundles two strong-impact solutions
 * delivers MORE value than a step that bundles one. Average would understate
 * combined-delivery steps.
 *
 * linkedSolutions strings are resolved through solutionIdLookup before matrix
 * lookup so the LLM's description-based references match the id-keyed matrix.
 */
function cellValue(valueId: string, step: EvoStep): number {
  if (!props.impactMatrix) return 0
  const valueRow = props.impactMatrix[valueId]
  if (!valueRow) return 0
  return step.linkedSolutions.reduce((sum, solRef) => {
    const solId = resolveSolutionRef(solRef)
    return sum + (valueRow[solId] ?? 0)
  }, 0)
}

// ── Per-cell diagnostic — explains WHY a cell is empty (Tom 2026-06-03:
//   "where are the estimates for the steps?"  Bitten 3× — the UI must self-
//   explain so the user does not need to open DevTools to understand a "–". )
//
// HoverHint shown on every cell.  When the cell has a value, just shows the
// value.  When empty, names the specific reason:
//   (a) V × S matrix entirely empty → suggest filling it
//   (b) This Value row missing from matrix → suggest adding the V. estimate
//   (c) Step has no linkedSolutions → suggest fixing the step spec
//   (d) Step linkedSolutions don't resolve → name the unresolved refs +
//       list what IS available so the user can fix the spec or re-gen
//   (e) Solutions resolve but no V × S impact data for them → suggest
//       filling V × S for those specific solutions

/** Counts non-zero cells across the entire matrix.  Cached via the underlying
 *  matrix ref so it only recomputes when the matrix changes. */
function _nonZeroCellCount(): number {
  if (!props.impactMatrix) return 0
  let n = 0
  for (const row of Object.values(props.impactMatrix)) {
    for (const cell of Object.values(row)) {
      if (cell !== 0) n++
    }
  }
  return n
}

function cellTooltip(valueId: string, step: EvoStep): string {
  const value = cellValue(valueId, step)
  if (value > 0) {
    // Has data — show the value + how it was aggregated for transparency
    const parts: string[] = [`Impact: ${value} (sum of step's linked-solution impacts on this Value)`]
    if (props.impactMatrix) {
      const valueRow = props.impactMatrix[valueId] ?? {}
      const contributing = step.linkedSolutions
        .map(ref => ({ ref, id: resolveSolutionRef(ref), val: valueRow[resolveSolutionRef(ref)] ?? 0 }))
        .filter(x => x.val !== 0)
      if (contributing.length > 0) {
        parts.push('Contributing:')
        for (const c of contributing) parts.push(`  ${c.ref} → ${c.val}`)
      }
    }
    return parts.join('\n')
  }

  // Cell is empty — diagnose WHY in order of likelihood
  if (!props.impactMatrix || _nonZeroCellCount() === 0) {
    return 'Empty: the Value × Solution matrix below has no impact estimates yet. Scroll down to Value × Solution and either fill cells manually or click "Regenerate AI Suggestions" to populate.'
  }
  const valueRow = props.impactMatrix[valueId]
  if (!valueRow) {
    return `Empty: Value "${valueId}" has no row in the Value × Solution matrix. Add impact estimates for this Value in the Value × Solution table below.`
  }
  if (step.linkedSolutions.length === 0) {
    return `Empty: Step "${step.name}" has no linkedSolutions. Edit the step (in the Evo Steps view) to link at least one Solution.`
  }
  // Solutions are linked but either don't resolve or resolve to 0-impact entries
  const resolved = step.linkedSolutions.map(ref => ({
    ref,
    id: resolveSolutionRef(ref),
    matched: solutionIdLookup.value.has(ref.trim().toLowerCase()) || solutionIdLookup.value.has(ref.trim()),
  }))
  const unmatched = resolved.filter(r => !r.matched)
  if (unmatched.length === step.linkedSolutions.length) {
    const available = (props.solutions ?? []).map(s => `${s.id} (${s.description.slice(0, 40)})`).join(' | ')
    return `Empty: NONE of this step's linkedSolutions resolve to a known solution. linkedSolutions: [${unmatched.map(u => u.ref).join(', ')}]. Available solutions: ${available || '(none)'}. Likely fix: re-generate the Evo plan or hand-edit linkedSolutions.`
  }
  if (unmatched.length > 0) {
    return `Empty for ${valueId}: some linkedSolutions resolve but have no Value × Solution impact for this Value. Unresolved refs: [${unmatched.map(u => u.ref).join(', ')}]. Matched refs have 0 impact for this Value in Value × Solution.`
  }
  return `Empty: linkedSolutions match solutions, but Value × Solution has no impact recorded for this Value × those Solutions. Fill the relevant cells in Value × Solution below.`
}

// ── Top-level diagnostic — what's wrong across the whole table ───────────────
// One concise banner the user reads before scrolling cell-by-cell.

interface Diagnostic {
  level: 'ok' | 'info' | 'warn'
  message: string
  detail?: string
}

const diagnostic = computed<Diagnostic>(() => {
  if (props.steps.length === 0) {
    return { level: 'info', message: 'No Evo Steps to estimate yet.' }
  }
  if (!props.impactMatrix || _nonZeroCellCount() === 0) {
    return {
      level: 'warn',
      message: 'No Value × Solution impact data yet — cells will stay "–" until Value × Solution has values.',
      detail: 'Scroll down to the Value × Solution table and either fill cells manually OR click "Regenerate AI Suggestions" in the Value × Solution header. This Value × Step view derives every cell by summing the step\'s linkedSolutions impacts in Value × Solution.',
    }
  }
  // Matrix has data — check for unresolved linkedSolutions
  const allRefs = new Set<string>()
  for (const step of props.steps) {
    for (const ref of step.linkedSolutions) allRefs.add(ref)
  }
  const unresolvedRefs: string[] = []
  for (const ref of allRefs) {
    const hit = solutionIdLookup.value.get(ref.trim().toLowerCase())
             ?? solutionIdLookup.value.get(ref.trim())
    if (!hit) unresolvedRefs.push(ref)
  }
  if (unresolvedRefs.length > 0) {
    const available = (props.solutions ?? []).map(s => `${s.id} (${s.description.slice(0, 30)}…)`).join(' | ')
    return {
      level: 'warn',
      message: `${unresolvedRefs.length} step linkedSolutions ref${unresolvedRefs.length === 1 ? '' : 's'} did not match any spec.solution — affected cells will show "–".`,
      detail: `Unresolved: [${unresolvedRefs.join(', ')}]. Available solutions: ${available || '(none)'}. Likely cause: the AI emitted a fuzzy variant of the solution name. Fix by hand-editing the step's linkedSolutions, or regenerate the Evo plan, or rename the spec.solution to match.`,
    }
  }
  // All refs resolve — check for cells with no impact
  let anyCellsEmpty = false
  for (const step of props.steps) {
    for (const v of props.values) {
      if (cellValue(v.id, step) === 0) {
        anyCellsEmpty = true
        break
      }
    }
    if (anyCellsEmpty) break
  }
  if (anyCellsEmpty) {
    return {
      level: 'info',
      message: 'Some cells are empty — the Value × Solution matrix has no impact recorded for those Value × Solution pairs.',
      detail: 'Hover any empty cell for the specific reason. Fill the relevant Value × Solution cells below to populate these.',
    }
  }
  return { level: 'ok', message: 'All cells populated from Value × Solution aggregation.' }
})

/** Total impact across all steps for one value row (right-column total) */
function valueRowTotal(valueId: string): number {
  return props.steps.reduce((sum, step) => sum + cellValue(valueId, step), 0)
}

/** Total impact across all values for one step column (bottom-row total) */
function stepColumnTotal(step: EvoStep): number {
  return props.values.reduce((sum, v) => sum + cellValue(v.id, step), 0)
}

// ── Visual styling — matches ImpactEstimationView traffic-light scheme ───────

/** Cell background — saturation scales with |value|, mirrors IET boldCellBg() */
function cellBg(value: number): string {
  if (value === 0) return '#ffffff'
  if (value < 0) return '#fca5a5'
  if (value >= 80) return '#86efac'
  if (value >= 60) return '#bbf7d0'
  if (value >= 30) return '#fde68a'
  return '#fecaca'
}

/** Cell foreground (number colour) — slate-900 on all non-empty tints */
function cellFg(value: number): string {
  return value === 0 ? '#9ca3af' : '#0f172a'
}

/** Full inline style for a data cell: background + foreground + left border */
function cellStyle(valueId: string, step: EvoStep): string {
  const v = cellValue(valueId, step)
  return [
    `background:${cellBg(v)}`,
    `color:${cellFg(v)}`,
    `border-left:4px solid ${getImpactColour(v)}`,
  ].join(';')
}

/** Display string for a cell value: "–" for 0, otherwise the number */
function cellDisplay(value: number): string {
  return value === 0 ? '–' : String(value)
}

// ── Empty-state detection ────────────────────────────────────────────────────

/** True when the V × S matrix has no estimates at all → guidance UI shows */
const matrixIsEmpty = computed<boolean>(() => {
  if (!props.impactMatrix) return true
  for (const valueRow of Object.values(props.impactMatrix)) {
    for (const cell of Object.values(valueRow)) {
      if (cell !== 0) return false
    }
  }
  return true
})

/** True when there are no steps to display (edge case — should not normally happen) */
const noSteps = computed<boolean>(() => props.steps.length === 0)
</script>

<template>
  <div class="w-full max-w-5xl space-y-4">
    <!-- Header -->
    <div class="rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-white to-emerald-50/30 shadow-lg overflow-hidden">
      <div class="px-5 py-3 bg-gradient-to-r from-emerald-600 to-teal-600">
        <h2 class="text-sm font-bold text-white flex items-center gap-2">
          <span aria-hidden="true">⛢</span> Impact Estimation — Values × Evo Steps
        </h2>
        <p class="text-[11px] text-emerald-100 mt-0.5">
          One column per Evo Step (the unit of value delivery) · Cells aggregated from Value × Solution via each step's linked Solutions · Edit Value × Solution to influence values here
        </p>
      </div>

      <!-- Edge case: no steps -->
      <div v-if="noSteps" class="p-8 text-center text-slate-500">
        <p class="text-sm">No Evo Steps yet — generate an Evo Plan in the previous stage first.</p>
      </div>

      <!-- Diagnostic banner — names the SPECIFIC reason cells are empty so the
           user does not have to open DevTools or guess.  Tom 2026-06-03:
           "where are the estimates for the steps?" — the answer is now visible
           in the UI itself, not only in console.warn.  Coloured by severity. -->
      <div
        v-else-if="diagnostic.level !== 'ok'"
        class="px-5 py-3 border-b"
        :class="diagnostic.level === 'warn'
          ? 'bg-amber-50 border-amber-200'
          : 'bg-sky-50 border-sky-200'"
      >
        <p class="text-[12px] font-semibold" :class="diagnostic.level === 'warn' ? 'text-amber-900' : 'text-sky-900'">
          <span aria-hidden="true">{{ diagnostic.level === 'warn' ? '⚠️' : 'ℹ️' }}</span>
          {{ diagnostic.message }}
        </p>
        <p v-if="diagnostic.detail" class="text-[11px] mt-1" :class="diagnostic.level === 'warn' ? 'text-amber-800' : 'text-sky-800'">
          {{ diagnostic.detail }}
        </p>
      </div>

      <!-- The V × Step grid -->
      <div v-if="!noSteps" class="p-4 bg-white">
        <table class="w-full border-collapse">
          <thead>
            <tr class="bg-slate-100">
              <th class="text-left text-[11px] font-bold text-slate-700 px-3 py-2 border-b-2 border-slate-300 sticky left-0 bg-slate-100">
                Value \ Evo Step
              </th>
              <th
                v-for="step in steps"
                :key="step.name"
                class="text-left text-[11px] font-bold text-slate-700 px-3 py-2 border-b-2 border-slate-300 min-w-[120px]"
                :title="step.description"
              >
                {{ step.name }}
              </th>
              <th class="text-right text-[11px] font-bold text-slate-700 px-3 py-2 border-b-2 border-slate-300 bg-slate-200">
                Σ Value
              </th>
            </tr>
          </thead>

          <tbody>
            <tr v-for="value in values" :key="value.id" class="border-b border-slate-100">
              <td class="text-[12px] font-medium text-slate-800 px-3 py-2 sticky left-0 bg-white" :title="value.description">
                <span class="font-bold text-emerald-700">{{ value.id }}</span>
                <span class="text-slate-500 ml-2">{{ value.description }}</span>
              </td>
              <td
                v-for="step in steps"
                :key="step.name"
                class="text-center text-[13px] font-bold px-3 py-2 transition-colors cursor-help"
                :style="cellStyle(value.id, step)"
                :title="cellTooltip(value.id, step)"
              >
                {{ cellDisplay(cellValue(value.id, step)) }}
              </td>
              <td class="text-right text-[12px] font-bold text-slate-800 px-3 py-2 bg-slate-50">
                {{ cellDisplay(valueRowTotal(value.id)) }}
              </td>
            </tr>
          </tbody>

          <tfoot>
            <!-- Effort percent row -->
            <tr class="bg-indigo-50 border-t-2 border-indigo-200">
              <td class="text-right text-[11px] font-semibold text-indigo-700 px-3 py-2">
                Effort %
              </td>
              <td
                v-for="step in steps"
                :key="step.name"
                class="text-center text-[12px] font-bold text-indigo-700 px-3 py-2"
              >
                {{ step.effortPercent }}%
              </td>
              <td class="text-right text-[11px] font-semibold text-indigo-700 px-3 py-2"></td>
            </tr>

            <!-- Total impact row -->
            <tr class="bg-slate-200 border-t-2 border-slate-300">
              <td class="text-right text-[11px] font-bold text-slate-700 px-3 py-2">
                Σ Impact (this step)
              </td>
              <td
                v-for="step in steps"
                :key="step.name"
                class="text-center text-[13px] font-extrabold text-slate-900 px-3 py-2"
              >
                {{ cellDisplay(stepColumnTotal(step)) }}
              </td>
              <td class="text-right text-[11px] font-bold text-slate-700 px-3 py-2 bg-slate-300">
                Σ Σ
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    <!-- Footer explanation + ESTIMATE PROVENANCE.
         Tom 2026-06-03: "i also expect estimate s here (ideally with evidence
         and source) or admisssion of other methods (SWAG)".  Be honest about
         what each cell is: derived from V × S = downstream-of-user-input;
         the V × S cells themselves are SWAG unless the user has entered evidence.
         No silent pretence of rigour. -->
    <div v-if="!noSteps" class="text-[11px] text-slate-500 px-2 space-y-2">
      <p>
        <span class="font-semibold text-slate-700">How cells are derived:</span>
        Each cell = Σ (Value × Solution impact) across the step's linked Solutions
        ({{ steps.map(s => s.linkedSolutions.length).join(' + ') }} Solutions total across the {{ steps.length }} Steps).
      </p>
      <p class="rounded border border-amber-200 bg-amber-50/60 px-2 py-1.5 text-amber-800">
        <span class="font-bold uppercase tracking-wide text-[10px]">Estimate provenance:</span>
        These cells inherit the provenance of the Value × Solution matrix below.  Unless you have entered
        evidence-backed numbers (logs / measurements / benchmarks) into Value × Solution, the values are
        <strong>SWAG</strong> (Scientific Wild-Assed Guess) — user / AI judgement, not measurement.
        Empty cells (<span class="font-mono">–</span>) admit "no estimate at all".  v2 will add per-cell
        evidence + source citations + a SWAG / Measured / Cited badge per cell.
      </p>
    </div>
  </div>
</template>
