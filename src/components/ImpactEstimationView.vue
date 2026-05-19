<!-- UNIT_TYPE=Widget -->
<!--
/**
 * Renders the V×S Impact Estimation VDT grid with Means Efficiency calculations.
 *
 * Cell colour coding (traffic-light, 2026-05-02 spec):
 *   ≥ 60     : green   #22c55e — strong positive impact
 *   30–59    : amber   #f59e0b — moderate positive impact
 *   1–29     : red     #ef4444 — weak positive impact
 *   0        : gray            — no estimate
 *  < 0       : red     #ef4444 — negative side effect
 *
 * Each cell also renders a mini horizontal bar proportional to the impact %.
 *
 * V/C ratio row (bottom of footer):
 *   ≥ 1.5   : green dot
 *   0.8–1.49: amber dot
 *   < 0.8   : red dot
 *
 * Cost rows:
 *   Calendar Time (weeks) — editable per solution
 *   Capital Cost ($k)     — editable per solution
 *
 * Means Efficiency = Σ(value impacts) / (calendarTime + capitalCost)
 *   → used for #1 / #2 ranking; falls back to Σ(impacts) when total cost = 0.
 *
 * Spec: S.Evo9.VDTTableComponent / S.ImpactEstimationUI
 */
-->
<script setup lang="ts">
// UNIT_TYPE=Widget
import { computed, ref, watch, onMounted, nextTick } from 'vue'
import { useImpactSuggestions } from '../composables/useImpactSuggestions'
import { useExpectedValue } from '../composables/useExpectedValue'
import { getImpactColour, getVCColour, interpretImpact } from '../utils/impactColour'
import { extractAllStakeholders, impactLevel } from '../utils/stakeholderExtract'
import type { VEntry, SEntry } from '../types/spec'
import type { ImpactMatrix } from '../types/impact'
import LoadingProgress from './LoadingProgress.vue'

const props = defineProps<{
  values: VEntry[]
  solutions: SEntry[]
  resourceClaims: Record<string, number>
}>()

const emit = defineEmits<{
  /** Fires after any cell update, cost update, or suggestion load */
  'matrix-updated': [
    matrix: Record<string, Record<string, number>>,
    efficiency: Record<string, number>,
    calendarCosts: Record<string, number>,
    capitalCosts: Record<string, number>,
  ]
}>()

// ── Composable ────────────────────────────────────────────────────────────────

const {
  impactMatrix,
  calendarCosts,
  capitalCosts,
  vcRatios,
  rankedSolutions: _composableRanked,
  loading,
  error,
  updateCell,
  loadSuggestions,
} = useImpactSuggestions(props.values, props.solutions, props.resourceClaims)

// ── Efficiency calculation ────────────────────────────────────────────────────

/** Total value impact for a solution (sum of all V×S cells, may include negatives) */
function totalImpact(solutionId: string): number {
  return props.values.reduce((sum, v) => sum + ((impactMatrix[v.id]?.[solutionId]) ?? 0), 0)
}

/** Means Efficiency = totalImpact / (calendarCost + capitalCost) */
const efficiencyRatios = computed<Record<string, number>>(() => {
  const result: Record<string, number> = {}
  for (const sol of props.solutions) {
    const impact = totalImpact(sol.id)
    const totalCost = (calendarCosts[sol.id] ?? 0) + (capitalCosts[sol.id] ?? 0)
    result[sol.id] = totalCost === 0 ? impact : impact / totalCost
  }
  return result
})

/** Solution IDs sorted by efficiency descending */
const rankedSolutions = computed<string[]>(() =>
  [...props.solutions.map(s => s.id)].sort((a, b) =>
    (efficiencyRatios.value[b] ?? 0) - (efficiencyRatios.value[a] ?? 0),
  ),
)

/** 1-based rank for a solution */
function rankOf(solutionId: string): number {
  return rankedSolutions.value.indexOf(solutionId) + 1
}

/** Format efficiency for display */
function formatEfficiency(solutionId: string): string {
  const totalCost = (calendarCosts[solutionId] ?? 0) + (capitalCosts[solutionId] ?? 0)
  if (totalCost === 0) {
    const impact = totalImpact(solutionId)
    return impact === 0 ? '–' : impact.toString()
  }
  const e = efficiencyRatios.value[solutionId]
  return e === undefined ? '–' : e.toFixed(2)
}

// ── V/C ratio display ────────────────────────────────────────────────────────

/**
 * Formats the V/C ratio for display.
 * When resourceClaim === 0, shows ∞ (unconstrained).
 */
function formatVCRatio(solutionId: string): string {
  const claim = props.resourceClaims[solutionId] ?? 20
  if (claim === 0) return '∞'
  const vc = vcRatios.value[solutionId]
  return vc === undefined ? '–' : vc.toFixed(2)
}

// ── Cell colour coding — traffic-light ───────────────────────────────────────

/**
 * Returns an inline CSS style string for a cell background tint and left border.
 *
 * Using inline styles (not Tailwind classes) because Tailwind's JIT scanner can
 * miss classes that are only reachable through function return-value expressions
 * at runtime, causing them to be stripped from the build output.
 */
function cellStyle(value: number | undefined): string {
  const v = value ?? 0
  const colour = getImpactColour(v)
  if (v === 0) {
    // No estimate: white background, gray left border
    return 'background:#ffffff;border-left:3px solid #d1d5db'
  }
  // Tint the background at 15% opacity, bold left border
  // We map the hex colour to a light tint manually for each tier
  const tint = v >= 60
    ? 'background:#f0fdf4'    // green-50
    : v >= 30
      ? 'background:#fffbeb'  // amber-50
      : 'background:#fff1f2'  // red-50 (weak positive or negative)
  return `${tint};border-left:3px solid ${colour}`
}

/**
 * Returns inline style for the mini horizontal bar inside an impact cell.
 * Width is proportional to |value| clamped to 0–100%.
 */
function barStyle(value: number | undefined): string {
  const v = value ?? 0
  const width = Math.min(100, Math.abs(v))
  const colour = getImpactColour(v)
  return `width:${width}%;background-color:${colour};height:3px;border-radius:2px;transition:width 0.2s ease`
}

/**
 * Returns inline style for the "Value Impact Sum" total row cells.
 * Uses the same traffic-light scale as individual cells (sum can exceed 100).
 * Normalises by number of value rows for a per-value average.
 */
function totalCellStyle(solutionId: string): string {
  const sum = totalImpact(solutionId)
  const count = props.values.length
  // Average impact per value row — used for colour bucket only
  const avg = count > 0 ? sum / count : 0
  return cellStyle(avg)
}

// ── View mode toggle ─────────────────────────────────────────────────────────

const viewMode = ref<'impact' | 'confidence' | 'stakeholders'>('impact')

// ── Density toggle (2026-05-12 redesign) ─────────────────────────────────────
// "Comfortable" — default, generous padding for presentation use
// "Compact"     — tighter padding for dense matrices (10+ columns)
const density = ref<'comfortable' | 'compact'>('comfortable')

// ── Hover highlight (2026-05-12 redesign) ────────────────────────────────────
// Tracks the currently-hovered row + column so we can dim the rest. Subtle
// — boosts focus without being noisy. Empty string ⇒ no highlight.
const hoverRow = ref<string>('')
const hoverCol = ref<string>('')

// ── Hero summary (2026-05-12 redesign) ──────────────────────────────────────
// Headline numbers shown above the table — the "what's the answer" answer.

const winningSolution = computed<string>(() => rankedSolutions.value[0] ?? '')
const runnerUpSolution = computed<string>(() => rankedSolutions.value[1] ?? '')

const totalCalendarWeeks = computed<number>(() =>
  props.solutions.reduce((s, sol) => s + (calendarCosts[sol.id] ?? 0), 0),
)
const totalCapitalCost = computed<number>(() =>
  props.solutions.reduce((s, sol) => s + (capitalCosts[sol.id] ?? 0), 0),
)
const grandTotalImpact = computed<number>(() =>
  props.solutions.reduce((s, sol) => s + totalImpact(sol.id), 0),
)
const bestEfficiency = computed<string>(() =>
  winningSolution.value ? formatEfficiency(winningSolution.value) : '–',
)

/** Find the solution description by id (for the hero card) */
function solutionDescription(id: string): string {
  return props.solutions.find((s) => s.id === id)?.description ?? id
}

/** Medal emoji for top 3 ranks; empty string otherwise */
function medalFor(rank: number): string {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return ''
}

// ── Bold cell visuals (2026-05-12 redesign) ─────────────────────────────────
// Replaces the "tinted bg + tiny coloured bar at the bottom" look with a
// single saturated colour fill keyed to impact strength. The bar was
// competing with the number for attention; folding it into the cell colour
// makes the matrix readable at a glance from across a room.

/**
 * Background fill for an impact cell. Saturation scales with |value|:
 *   0          : white (no estimate)
 *   1–29       : light red    (#fee2e2)
 *   30–59      : amber tint   (#fde68a)
 *   60–79      : green tint   (#bbf7d0)
 *   ≥ 80       : strong green (#86efac)
 *   negative   : strong red   (#fca5a5)
 * Plus a coloured left bar for instant traffic-light scanning.
 */
function boldCellBg(value: number | undefined): string {
  const v = value ?? 0
  if (v === 0) return '#ffffff'
  if (v < 0) return '#fca5a5'
  if (v >= 80) return '#86efac'
  if (v >= 60) return '#bbf7d0'
  if (v >= 30) return '#fde68a'
  return '#fecaca'
}

/** Foreground (number) colour — dark on light fills, white on saturated fills */
function boldCellFg(value: number | undefined): string {
  const v = value ?? 0
  if (v === 0) return '#9ca3af'   // gray-400
  return '#0f172a'                 // slate-900 — high contrast on every fill above
}

/** Combined inline style for a redesigned data cell */
function boldDataCellStyle(valueId: string, solutionId: string): string {
  const v = impactMatrix[valueId]?.[solutionId]
  const bg = boldCellBg(v)
  const fg = boldCellFg(v)
  const colour = getImpactColour(v ?? 0)
  const overlay = confidenceOverlayStyle(solutionId)
  const winning = solutionId === winningSolution.value
    ? 'box-shadow:inset 0 0 0 2px rgba(234,179,8,0.45)'
    : ''
  const dimmed  = (hoverRow.value && hoverRow.value !== valueId) ||
                  (hoverCol.value && hoverCol.value !== solutionId)
    ? 'opacity:0.45;'
    : ''
  return [
    `background:${bg}`,
    `color:${fg}`,
    `border-left:4px solid ${colour}`,
    overlay,
    winning,
    dimmed,
  ].filter(Boolean).join(';')
}

/** Inline style for a header cell of the winning column */
function colHeaderStyle(solutionId: string): string {
  const winning = solutionId === winningSolution.value
  return winning
    ? 'background:linear-gradient(180deg,#fbbf24 0%,#1f2937 35%);box-shadow:inset 0 0 0 2px #fbbf24'
    : ''
}

// ── Feature #59: Stakeholder matrix ──────────────────────────────────────────
// stakeholderView is derived from viewMode so clicking the Stakeholders button
// replaces the VDT matrix (rather than appending below the fold).
// Legacy boolean kept as computed for any template bindings that still use it.

/**
 * Stakeholders detected across all spec text — F. + V. + S. descriptions plus
 * solutions list — so a stakeholder mentioned in any part of the spec is found.
 * Also runs contextual extraction for "for X" / "help X" phrases.
 */
const detectedStakeholders = computed(() => {
  if (!props.values.length && !props.solutions.length) return []
  const allText = [
    ...props.values.map(v => v.description),
    ...props.solutions.map(s => s.description),
  ].join(' ')
  return extractAllStakeholders(allText)
})

/**
 * Returns the natural-language description for impact scoring.
 *
 * Bug fix 2026-05-12: drop the `${v.id}` prefix so spec-ID single letters
 * ("V", "S", "F") cannot accidentally satisfy keyword matches against
 * contextual stakeholders. Only natural-language description text counts
 * for impact scoring — keeps the matrix in lock-step with PrioritisedPlanView.
 */
function vEntryText(v: VEntry): string {
  return v.description
}

/**
 * Inline style for a stakeholder matrix impact dot.
 */
function stakeholderDotStyle(
  level: 0 | 1 | 2 | 3,
  colour: string,
): string {
  const size = level === 0 ? '8px' : level === 1 ? '10px' : level === 2 ? '14px' : '18px'
  const bg   = level === 0 ? '#e2e8f0' : colour
  const op   = level === 0 ? '0.4' : '1'
  return `width:${size};height:${size};background-color:${bg};opacity:${op};border-radius:9999px;display:inline-block`
}

/**
 * Derives confidence level for a cell based on the V/C ratio of its column (solution).
 *   ≥ 1.5 → 'high'
 *   0.8–1.49 → 'medium'
 *   < 0.8 → 'low'
 * If no V/C ratio is available, treats as 'medium'.
 */
function confidenceLevel(solutionId: string): 'high' | 'medium' | 'low' {
  const vc = vcRatios.value[solutionId]
  if (vc === undefined) return 'medium'
  if (vc >= 1.5) return 'high'
  if (vc >= 0.8) return 'medium'
  return 'low'
}

/**
 * Returns the confidence overlay background-image CSS string for a cell.
 * High confidence → no overlay. Medium → light stripe. Low → heavy stripe.
 */
function confidenceOverlayStyle(solutionId: string): string {
  if (viewMode.value !== 'confidence') return ''
  const level = confidenceLevel(solutionId)
  if (level === 'high') return ''
  if (level === 'medium')
    return 'background-image:repeating-linear-gradient(45deg,rgba(0,0,0,0.08) 0px,rgba(0,0,0,0.08) 2px,transparent 2px,transparent 8px)'
  // low
  return 'background-image:repeating-linear-gradient(45deg,rgba(0,0,0,0.18) 0px,rgba(0,0,0,0.18) 2px,transparent 2px,transparent 6px)'
}

/**
 * Returns an inline style string for a data cell that merges the existing impact
 * style with (optionally) a confidence overlay background-image.
 */
function dataCellStyle(valueId: string, solutionId: string): string {
  const base = cellStyle(impactMatrix[valueId]?.[solutionId])
  const overlay = confidenceOverlayStyle(solutionId)
  return overlay ? `${base};${overlay}` : base
}

/**
 * Confidence tooltip text for a cell (used in confidence mode).
 */
function confidenceTooltipText(solutionId: string): string {
  const vc = vcRatios.value[solutionId]
  const level = confidenceLevel(solutionId)
  const levelLabel = level === 'high' ? 'High' : level === 'medium' ? 'Medium' : 'Low'
  const vcStr = vc === undefined ? 'N/A' : vc.toFixed(1)
  return `Confidence: ${levelLabel} — V/C ratio: ${vcStr}`
}

// ── Tooltip state ─────────────────────────────────────────────────────────────

const tooltipVisible = ref(false)
const tooltipText    = ref('')
const tooltipX       = ref(0)
const tooltipY       = ref(0)

function showTooltip(event: MouseEvent, valId: string, solId: string): void {
  const v = impactMatrix[valId]?.[solId] ?? 0
  const interpretation = interpretImpact(v)
  const impactPart = `${solId} addresses ${valId} by ${v}% — ${interpretation}`
  tooltipText.value = viewMode.value === 'confidence'
    ? `${impactPart} · ${confidenceTooltipText(solId)}`
    : impactPart
  tooltipX.value    = (event as MouseEvent & { currentTarget: HTMLElement }).currentTarget.getBoundingClientRect().left + window.scrollX
  tooltipY.value    = (event as MouseEvent & { currentTarget: HTMLElement }).currentTarget.getBoundingClientRect().bottom + window.scrollY + 4
  tooltipVisible.value = true
}

function hideTooltip(): void {
  tooltipVisible.value = false
}

// ── Ranked sidebar ────────────────────────────────────────────────────────────

const rankedDetails = computed(() =>
  rankedSolutions.value.map((solutionId, idx) => ({
    rank: idx + 1,
    solutionId,
    efficiency: formatEfficiency(solutionId),
    totalImpact: totalImpact(solutionId),
    calendar: calendarCosts[solutionId] ?? 0,
    capital: capitalCosts[solutionId] ?? 0,
  })),
)

// ── Emit helpers ──────────────────────────────────────────────────────────────

function emitUpdated(): void {
  const matrixSnap: Record<string, Record<string, number>> = {}
  for (const vid of Object.keys(impactMatrix)) {
    matrixSnap[vid] = { ...impactMatrix[vid] }
  }
  emit(
    'matrix-updated',
    matrixSnap,
    { ...efficiencyRatios.value },
    { ...calendarCosts },
    { ...capitalCosts },
  )
}

// ── Auto-emit on initial load ─────────────────────────────────────────────────
// The composable runs loadSuggestions() automatically on init.
// • Mock mode  — synchronous; matrix is populated before onMounted fires, loading stays false.
//   We emit after nextTick so Vue has flushed all reactive writes.
// • Real-API mode — async; loading goes true→false after the Anthropic call completes.
//   We watch loading for the false transition so we emit as soon as it settles.
onMounted(() => {
  nextTick(() => {
    if (!loading.value) emitUpdated()   // mock / already-complete path
  })
})
watch(loading, (isLoading) => {
  if (!isLoading) emitUpdated()         // real-API path: fires when request finishes
})

function onCellInput(valueId: string, solutionId: string, event: Event): void {
  const raw = (event.target as HTMLInputElement).value
  const num = parseInt(raw, 10)
  if (!isNaN(num)) {
    updateCell(valueId, solutionId, num)
    emitUpdated()
  }
}

function onCostInput(
  type: 'calendar' | 'capital',
  solutionId: string,
  event: Event,
): void {
  const raw = (event.target as HTMLInputElement).value
  const num = parseFloat(raw)
  if (!isNaN(num) && num >= 0) {
    if (type === 'calendar') calendarCosts[solutionId] = num
    else capitalCosts[solutionId] = num
    emitUpdated()
  }
}

async function handleRegenerate(): Promise<void> {
  await loadSuggestions()
  emitUpdated()
}

/** Short label for a V entry */
function valueLabel(v: VEntry): string { return v.id }
/** Short label for an S entry */
function solutionLabel(s: SEntry): string { return s.id }

// ── Feature #39 — IET Actuals Column ─────────────────────────────────────────

/** Keyed by solutionId → actual overall impact % (0–100) logged by the user */
const actuals = ref<Record<string, number>>({})

/** When true, number inputs are shown below each column header */
const actualsMode = ref(false)

function onActualInput(solutionId: string, event: Event): void {
  const raw = (event.target as HTMLInputElement).value
  const num = parseFloat(raw)
  if (!isNaN(num)) {
    actuals.value[solutionId] = num
  }
}

/**
 * Delta between the sum of AI-estimated impacts for a column vs the logged actual.
 * Returns null when no actual is logged for that solution.
 */
function actualDelta(solutionId: string): number | null {
  const actual = actuals.value[solutionId]
  if (actual === undefined) return null
  return actual - totalImpact(solutionId)
}

// ── Feature #34: Quick Win Highlighter ───────────────────────────────────────

/**
 * Returns the ordinal string for a rank (1 → "1st", 2 → "2nd", 3 → "3rd").
 */
function rankOrdinal(rank: number): string {
  if (rank === 1) return '1st'
  if (rank === 2) return '2nd'
  return '3rd'
}

/**
 * Short interpretation of a V/C ratio value.
 */
function interpretVCRatio(vc: number): string {
  if (vc >= 1.5) return '>1.5 = strong investment case'
  if (vc >= 0.8) return '0.8–1.5 = moderate'
  return '<0.8 = consider dropping'
}

/**
 * quickWins: top 1–3 solutions by V/C ratio descending, with V/C > 0.
 * Only computed when vcRatios has at least one entry.
 */
const quickWins = computed(() => {
  const entries = props.solutions
    .map(s => ({ solutionId: s.id, vc: vcRatios.value[s.id] ?? 0 }))
    .filter(e => e.vc > 0)
    .sort((a, b) => b.vc - a.vc)
    .slice(0, 3)
  return entries.map((e, i) => ({
    rank: i + 1,
    solutionId: e.solutionId,
    vc: e.vc,
    ordinal: rankOrdinal(i + 1),
    interpretation: interpretVCRatio(e.vc),
  }))
})

/** Whether the Quick Wins section should be shown */
const showQuickWins = computed(() => quickWins.value.length > 0)

// ── Feature #98: EV Mode ──────────────────────────────────────────────────────

/** Reactive list of V. entry IDs derived from the values prop */
const vEntryIds = computed<string[]>(() => props.values.map((v) => v.id))

/**
 * Wraps the reactive ImpactMatrix object from useImpactSuggestions in a Ref
 * so useExpectedValue can watch it. We use a computed ref that re-reads the
 * reactive object each time — Vue tracks the reactive dependency automatically.
 */
const impactMatrixRef = computed<ImpactMatrix>(() => {
  // Build a plain snapshot so the computed re-evaluates when the matrix changes.
  // This is a shallow copy; the inner objects are still reactive.
  const snap: ImpactMatrix = {}
  for (const vId of vEntryIds.value) {
    snap[vId] = impactMatrix[vId] ? { ...impactMatrix[vId] } : {}
  }
  return snap
})

const {
  evModeOpen,
  probabilities,
  expectedValues,
  aggregateEV,
  topVEntry,
  setProbability,
} = useExpectedValue(vEntryIds, impactMatrixRef)

// ── Copy table to clipboard ───────────────────────────────────────────────────

const copied = ref(false)   // rich-text copy (text/html + text/plain TSV via ClipboardItem)

/**
 * Builds the TSV (tab-separated) representation of the table.
 * Used both as the plain-text fallback in the HTML copy and as the
 * standalone Keynote copy payload.
 */
function buildTSV(): string {
  // Use .description (natural language with spaces) not .id (camelCase slug) so
  // Keynote and Numbers can wrap cell text when columns are narrow.
  // IDs are kept only for matrix/cost lookups — never appear as visible labels.
  const sols = props.solutions
  const rows: string[][] = [
    ['Value / Solution', ...sols.map((s) => s.description)],
    ...props.values.map((val) => [
      val.description,
      ...sols.map((s) => String(impactMatrix[val.id]?.[s.id] ?? 0)),
    ]),
    ['Calendar (weeks)', ...sols.map((s) => String(calendarCosts[s.id] ?? 0))],
    ['Capital ($k)',     ...sols.map((s) => String(capitalCosts[s.id]  ?? 0))],
    ['Total Impact',    ...sols.map((s) => String(totalImpact(s.id)))],
    ['Means Efficiency',...sols.map((s) => formatEfficiency(s.id))],
    ['Rank',            ...sols.map((s) => `#${rankOf(s.id)}`)],
  ]
  return rows.map((r) => r.join('\t')).join('\n')
}

/**
 * Copies the table as a rich HTML document (text/html) — renders as a colour-coded
 * formatted table when pasted into Mac Notes, Pages, Word, or Google Docs.
 * A TSV plain-text fallback is also written for apps that prefer plain text.
 */
async function copyForNotes(): Promise<void> {
  // ── Inline-style helpers (mirror the cell colour spec) ───────────────────
  function inlineCellStyle(v: number): string {
    const colour = getImpactColour(v)
    if (v === 0) return 'background:#ffffff;color:#9ca3af'
    const bg = v >= 60 ? '#f0fdf4' : v >= 30 ? '#fffbeb' : '#fff1f2'
    return `background:${bg};color:#111827;border-left:3px solid ${colour}`
  }

  const BASE  = 'font-family:system-ui,-apple-system,Helvetica Neue,sans-serif;font-size:13px;border-collapse:collapse'
  // white-space:normal on all header/label cells so text wraps when columns are narrow
  const TH_H  = 'background:#1f2937;color:#ffffff;padding:6px 12px;text-align:center;white-space:normal;font-size:12px'
  const TH_H1 = 'background:#1f2937;color:#ffffff;padding:6px 12px;text-align:left;white-space:normal;font-size:12px'
  const TD_C  = 'text-align:center;padding:5px 8px;font-size:13px;border:1px solid #e5e7eb'
  const TH_R  = 'text-align:left;padding:5px 12px;font-size:12px;font-weight:600;white-space:normal;border:1px solid #e5e7eb'

  // ── Build HTML table ──────────────────────────────────────────────────────
  // Wrap in a complete HTML document — required by Mac Notes, Keynote, and Word
  // to accept the clipboard as rich-text rather than plain text.
  let table = `<table style="${BASE}">`

  const sols = props.solutions

  // Header row — use description text so column headers wrap in Keynote/Numbers
  table += `<thead><tr><th style="${TH_H1}">Value / Solution</th>`
  for (const s of sols) table += `<th style="${TH_H}">${s.description}</th>`
  table += `</tr></thead>`

  // All rows go in <tbody> — Mac Notes strips <tfoot> and only renders <tbody> content.
  table += `<tbody>`

  // Value × solution data rows — use description for row labels, ids for lookup
  for (const val of props.values) {
    table += `<tr><th style="${TH_R}">${val.description}</th>`
    for (const s of sols) {
      const v = impactMatrix[val.id]?.[s.id] ?? 0
      table += `<td style="${TD_C};${inlineCellStyle(v)}">${v}</td>`
    }
    table += `</tr>`
  }

  // Visual separator row between value cells and cost/summary rows
  const colSpan = sols.length + 1
  table += `<tr><td colspan="${colSpan}" style="padding:0;height:4px;background:#e5e7eb"></td></tr>`

  // Calendar time
  table += `<tr style="border-top:1px solid #bfdbfe">`
  table += `<th style="${TH_R};color:#1d4ed8">⏱ Calendar (weeks)</th>`
  for (const s of sols) {
    table += `<td style="${TD_C};background:#eff6ff;color:#1e40af">${calendarCosts[s.id] ?? 0}</td>`
  }
  table += `</tr>`

  // Capital cost
  table += `<tr>`
  table += `<th style="${TH_R};color:#7c3aed">💰 Capital ($k)</th>`
  for (const s of sols) {
    table += `<td style="${TD_C};background:#f5f3ff;color:#6d28d9">${capitalCosts[s.id] ?? 0}</td>`
  }
  table += `</tr>`

  // Total impact
  table += `<tr style="border-top:1px solid #d1d5db">`
  table += `<th style="${TH_R}">Σ Value Impact</th>`
  for (const s of sols) {
    table += `<td style="${TD_C};background:#f9fafb">${totalImpact(s.id)}</td>`
  }
  table += `</tr>`

  // Means efficiency + rank
  table += `<tr style="border-top:2px solid #6b7280">`
  table += `<th style="${TH_R};font-weight:700">Means Efficiency</th>`
  for (const s of sols) {
    const top = rankOf(s.id) === 1
    table += `<td style="${TD_C};font-weight:700;background:${top ? '#f0fdf4' : '#f9fafb'};color:${top ? '#15803d' : '#111827'}">`
    table += `${formatEfficiency(s.id)}&nbsp;<span style="font-size:11px;color:${top ? '#16a34a' : '#9ca3af'}">#${rankOf(s.id)}</span></td>`
  }
  table += `</tr>`

  table += `</tbody></table>`

  // Wrap in a full HTML document — Mac Notes, Keynote, Pages all require this
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${table}</body></html>`

  const tsv = buildTSV()

  // ── Write HTML + TSV to clipboard ────────────────────────────────────────
  try {
    if (typeof ClipboardItem !== 'undefined') {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html':  new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([tsv],  { type: 'text/plain' }),
        }),
      ])
    } else {
      await navigator.clipboard.writeText(tsv)
    }
    copied.value = true
    setTimeout(() => { copied.value = false }, 2500)
  } catch {
    try { await navigator.clipboard.writeText(tsv) } catch { /* silent */ }
    copied.value = true
    setTimeout(() => { copied.value = false }, 2500)
  }
}


// ── Public API for parent (App.vue reads this at export time) ─────────────────
/**
 * Returns a point-in-time snapshot of the full IET state.
 * App.vue calls this synchronously in exportFull() — before setting stage = 5
 * unmounts this component — so the data is always current regardless of whether
 * the matrix-updated event has fired yet.
 */
defineExpose({
  getSnapshot() {
    const matrixSnap: Record<string, Record<string, number>> = {}
    for (const vid of Object.keys(impactMatrix)) {
      matrixSnap[vid] = { ...impactMatrix[vid] }
    }
    return {
      matrix:       matrixSnap,
      efficiency:   { ...efficiencyRatios.value },
      calendarCosts: { ...calendarCosts },
      capitalCosts:  { ...capitalCosts },
      actuals:       { ...actuals.value },
    }
  },
})
</script>

<template>
  <section class="w-full px-4 py-6" aria-label="Impact estimation VDT">

    <!-- Tooltip — absolutely positioned floating label -->
    <div
      v-if="tooltipVisible"
      role="tooltip"
      class="fixed z-50 pointer-events-none rounded bg-gray-900 text-white text-xs px-2 py-1 shadow-lg max-w-xs"
      :style="`left:${tooltipX}px;top:${tooltipY}px`"
    >{{ tooltipText }}</div>

    <!-- Loading banner -->
    <div v-if="loading" class="mb-6">
      <LoadingProgress
        :loading="loading"
        label="Loading AI impact suggestions…"
        :baseline="25"
        hint="can take up to 45s on slow networks"
        color="indigo"
      />
    </div>
    <!-- Error banner -->
    <div
      v-if="error"
      role="alert"
      class="mb-4 rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700"
    >{{ error }}</div>

    <!-- Empty state -->
    <div
      v-if="!values.length || !solutions.length"
      class="py-8 text-center text-gray-400 text-sm"
    >
      Add V. and S. entries to your spec to use the impact estimation table.
    </div>

    <template v-else>

      <!-- ── Hero summary banner (2026-05-12 redesign) ─────────────────────
           Big, bold, presentational header that answers the question
           "what's the answer?" before the user even reads the matrix.
           Three tiles: WINNER (gold gradient), TOTAL IMPACT (blue),
           INVESTMENT (slate). Each tile is a click-target — clicking
           the winner card scrolls to its column highlight in the table. -->
      <div
        class="mb-5 grid grid-cols-1 sm:grid-cols-3 gap-3"
        aria-label="Impact estimation summary"
        data-testid="iet-hero-banner"
      >
        <!-- Winner tile -->
        <div
          class="relative overflow-hidden rounded-xl shadow-lg p-4 text-white"
          style="background:linear-gradient(135deg,#f59e0b 0%,#d97706 60%,#92400e 100%)"
          :aria-label="`Winning solution: ${winningSolution || 'none yet'}`"
        >
          <div class="text-[11px] uppercase tracking-wider opacity-80 font-bold">🏆 Winner</div>
          <div class="mt-1 text-2xl font-extrabold leading-tight" :title="solutionDescription(winningSolution)">
            {{ winningSolution || '—' }}
          </div>
          <div class="text-xs opacity-90 line-clamp-2 mt-0.5" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">
            {{ solutionDescription(winningSolution) }}
          </div>
          <div class="mt-3 flex items-baseline gap-3">
            <div>
              <div class="text-[10px] uppercase tracking-wider opacity-75 font-semibold">Efficiency</div>
              <div class="text-2xl font-bold leading-none">{{ bestEfficiency }}</div>
            </div>
            <div v-if="runnerUpSolution" class="ml-auto text-right">
              <div class="text-[10px] uppercase tracking-wider opacity-75 font-semibold">🥈 Runner-up</div>
              <div class="text-sm font-bold leading-tight">{{ runnerUpSolution }}</div>
            </div>
          </div>
          <!-- decorative ribbon -->
          <div class="absolute -right-4 -top-4 opacity-15 text-7xl font-black select-none pointer-events-none">★</div>
        </div>

        <!-- Total Impact tile -->
        <div
          class="rounded-xl shadow-md p-4 text-white"
          style="background:linear-gradient(135deg,#1e3a8a 0%,#1d4ed8 60%,#2563eb 100%)"
          aria-label="Aggregate impact summary"
        >
          <div class="text-[11px] uppercase tracking-wider opacity-80 font-bold">📊 Σ Coverage</div>
          <div class="mt-1 text-3xl font-extrabold leading-tight">{{ grandTotalImpact }}</div>
          <div class="text-xs opacity-85 mt-0.5">total impact across all V × S</div>
          <div class="mt-3 flex items-center gap-4 text-xs">
            <div>
              <div class="text-[10px] uppercase tracking-wider opacity-75 font-semibold">Values</div>
              <div class="text-base font-bold leading-none">{{ values.length }}</div>
            </div>
            <div>
              <div class="text-[10px] uppercase tracking-wider opacity-75 font-semibold">Solutions</div>
              <div class="text-base font-bold leading-none">{{ solutions.length }}</div>
            </div>
            <div>
              <div class="text-[10px] uppercase tracking-wider opacity-75 font-semibold">Cells</div>
              <div class="text-base font-bold leading-none">{{ values.length * solutions.length }}</div>
            </div>
          </div>
        </div>

        <!-- Investment tile -->
        <div
          class="rounded-xl shadow-md p-4 text-white"
          style="background:linear-gradient(135deg,#0f172a 0%,#334155 60%,#475569 100%)"
          aria-label="Investment cost summary"
        >
          <div class="text-[11px] uppercase tracking-wider opacity-80 font-bold">💰 Investment</div>
          <div class="mt-1 flex items-baseline gap-2">
            <span class="text-3xl font-extrabold leading-tight">${{ totalCapitalCost }}k</span>
            <span class="text-base font-bold opacity-80">+ {{ totalCalendarWeeks }}w</span>
          </div>
          <div class="text-xs opacity-85 mt-0.5">across {{ solutions.length }} solutions</div>
          <div class="mt-3 text-xs">
            <span class="opacity-75">avg per solution:</span>
            <span class="font-bold ml-1">
              ${{ solutions.length ? (totalCapitalCost / solutions.length).toFixed(1) : 0 }}k
              · {{ solutions.length ? (totalCalendarWeeks / solutions.length).toFixed(1) : 0 }}w
            </span>
          </div>
        </div>
      </div>

      <!-- View mode toggle: Impact | Confidence -->
      <div class="mb-3 flex flex-wrap items-center gap-2" aria-label="View mode toggle">
        <span class="text-xs font-semibold text-gray-600">View:</span>
        <div class="inline-flex rounded-lg border border-gray-200 overflow-hidden" role="group" aria-label="Select view mode">
          <button
            type="button"
            :class="[
              'min-h-[44px] px-4 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500',
              viewMode === 'impact' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
            ]"
            aria-label="Impact view mode"
            :aria-pressed="viewMode === 'impact'"
            data-testid="toggle-impact"
            @click="viewMode = 'impact'"
          >Impact</button>
          <button
            type="button"
            :class="[
              'min-h-[44px] px-4 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500',
              viewMode === 'confidence' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
            ]"
            aria-label="Confidence view mode"
            :aria-pressed="viewMode === 'confidence'"
            data-testid="toggle-confidence"
            @click="viewMode = 'confidence'"
          >Confidence</button>
        </div>

        <!-- Feature #59 — Stakeholders view mode (replaces VDT matrix when active) -->
        <button
          type="button"
          class="min-h-[44px] px-4 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
          :class="viewMode === 'stakeholders' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
          :aria-pressed="viewMode === 'stakeholders'"
          aria-label="Stakeholder matrix view"
          data-testid="toggle-stakeholders"
          @click="viewMode = viewMode === 'stakeholders' ? 'impact' : 'stakeholders'"
        >Stakeholders</button>

        <!-- Feature #39 — Log Actuals toggle -->
        <button
          type="button"
          class="h-11 px-4 rounded-lg bg-blue-100 text-blue-700 text-xs font-medium hover:bg-blue-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          :aria-pressed="actualsMode"
          aria-label="Toggle actuals logging mode"
          data-testid="toggle-actuals"
          @click="actualsMode = !actualsMode"
        >
          📊 Log Actuals
        </button>

        <!-- Feature #98 — EV Mode toggle -->
        <button
          type="button"
          class="bg-purple-100 hover:bg-purple-200 h-11 px-3 text-sm rounded text-purple-800 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500"
          :aria-pressed="evModeOpen"
          aria-label="Toggle Expected Value mode"
          data-testid="toggle-ev-mode"
          @click="evModeOpen = !evModeOpen"
        >
          📐 EV
        </button>

        <!-- Density toggle (2026-05-12 redesign) — Comfortable | Compact -->
        <div class="ml-auto inline-flex rounded-lg border border-gray-200 overflow-hidden" role="group" aria-label="Table density">
          <button
            type="button"
            :class="[
              'h-11 px-3 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-slate-500',
              density === 'comfortable' ? 'bg-slate-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
            ]"
            :aria-pressed="density === 'comfortable'"
            aria-label="Comfortable density (default)"
            data-testid="density-comfortable"
            title="Comfortable — generous spacing, presentation-ready"
            @click="density = 'comfortable'"
          >▤ Comfy</button>
          <button
            type="button"
            :class="[
              'h-11 px-3 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-slate-500',
              density === 'compact' ? 'bg-slate-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
            ]"
            :aria-pressed="density === 'compact'"
            aria-label="Compact density (dense matrices)"
            data-testid="density-compact"
            title="Compact — fits more columns on screen"
            @click="density = 'compact'"
          >▦ Dense</button>
        </div>
      </div>

      <!-- Colour legend + Regenerate -->
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <!-- Legend -->
        <div class="flex flex-wrap items-center gap-2 text-xs text-gray-600">
          <span class="font-semibold text-gray-500">Impact:</span>
          <span class="inline-flex items-center gap-1">
            <span class="inline-block w-3 h-3 rounded-full" style="background:#22c55e"></span>
            ≥ 60 strong
          </span>
          <span class="inline-flex items-center gap-1">
            <span class="inline-block w-3 h-3 rounded-full" style="background:#f59e0b"></span>
            30–59 moderate
          </span>
          <span class="inline-flex items-center gap-1">
            <span class="inline-block w-3 h-3 rounded-full" style="background:#ef4444"></span>
            &lt; 30 weak / negative
          </span>
          <span class="inline-flex items-center gap-1">
            <span class="inline-block w-3 h-3 rounded-full bg-gray-300"></span>
            0 none
          </span>
        </div>
        <!-- Actions: Copy (Notes) + Copy (Keynote) + Regenerate -->
        <div class="flex flex-wrap items-center gap-2">

          <!-- Single copy — writes text/html (coloured table) + text/plain (TSV) simultaneously -->
          <button
            type="button"
            class="flex items-center gap-2 min-h-[44px] px-3 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            :aria-label="copied ? 'Copied!' : 'Copy impact table — pastes as coloured table in Notes, Pages, Keynote'"
            :title="'Pastes as a coloured table in Notes, Pages, and Keynote'"
            @click="copyForNotes"
          >
            <svg v-if="copied" class="h-4 w-4 text-green-600 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
            </svg>
            <svg v-else class="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M8 2a2 2 0 00-2 2v1H5a2 2 0 00-2 2v9a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H8zm0 2h4v1H8V4zm-3 3h10v9H5V7z"/>
            </svg>
            <span :class="copied ? 'text-green-600 font-semibold' : ''">
              {{ copied ? 'Copied!' : '📋 Copy' }}
            </span>
          </button>

          <!-- Regenerate -->
          <button
            type="button"
            class="flex items-center justify-center min-h-[44px] min-w-[44px] px-4 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Regenerate AI impact suggestions"
            @click="handleRegenerate"
          >
            Regenerate AI Suggestions
          </button>
        </div>
      </div>

      <!-- VDT table — bold redesign (2026-05-12 v2):
           – column headers stack a RANK BADGE (medal for top 3) above ID
             above 2-line description; winning column gets a gold gradient
           – cells use SOLID colour fills keyed to impact strength (no more
             tiny competing bar inside the cell) so the matrix reads at a
             glance from across a room
           – footer rows (Σ, V/C, Efficiency) get bigger, bolder numbers
             and the winning column is outlined in gold
           – density toggle drives padding + column width
           – v-show hides (not unmounts) the table when Stakeholders view is active -->
      <div v-show="viewMode !== 'stakeholders'" class="overflow-x-auto rounded-xl border border-gray-300 shadow-md mb-6 bg-white">
        <table
          class="w-auto border-collapse bg-white"
          :class="density === 'compact' ? 'text-xs' : 'text-sm'"
          role="table"
          aria-label="Impact estimation matrix — rows are values, columns are solutions"
        >
          <!-- Column headers — rank badge + ID + description; winner = gold -->
          <thead>
            <tr role="row">
              <th
                scope="col"
                class="sticky left-0 z-20 bg-gradient-to-b from-slate-800 to-slate-900 text-white font-bold uppercase tracking-wider text-left align-bottom"
                :class="density === 'compact' ? 'px-3 py-2 min-w-[180px] text-[11px]' : 'px-4 py-3 min-w-[220px] text-xs'"
                role="columnheader"
              >Value × Solution</th>
              <th
                v-for="sol in solutions"
                :key="sol.id"
                scope="col"
                class="bg-slate-800 align-bottom relative cursor-pointer transition-colors hover:bg-slate-700"
                :class="density === 'compact' ? 'px-1 pb-2 pt-1' : 'px-2 pb-3 pt-2'"
                :style="(density === 'compact'
                  ? 'width:110px;min-width:110px;'
                  : 'width:140px;min-width:140px;') + colHeaderStyle(sol.id)"
                role="columnheader"
                :aria-label="`Solution: ${sol.id}, rank ${rankOf(sol.id)}`"
                @mouseenter="hoverCol = sol.id"
                @mouseleave="hoverCol = ''"
              >
                <div class="flex flex-col items-center text-center gap-1">
                  <!-- Rank badge — medal for top 3, # for the rest -->
                  <span
                    class="inline-flex items-center justify-center rounded-full font-extrabold leading-none"
                    :class="[
                      density === 'compact' ? 'h-5 min-w-[20px] px-1.5 text-[10px]' : 'h-6 min-w-[24px] px-2 text-xs',
                      rankOf(sol.id) === 1 ? 'bg-yellow-400 text-slate-900 shadow' :
                      rankOf(sol.id) === 2 ? 'bg-gray-300 text-slate-800' :
                      rankOf(sol.id) === 3 ? 'bg-orange-300 text-slate-800' :
                      'bg-slate-600 text-slate-200',
                    ]"
                    :title="`Rank #${rankOf(sol.id)} by Means Efficiency`"
                  >
                    <span v-if="medalFor(rankOf(sol.id))" class="mr-0.5">{{ medalFor(rankOf(sol.id)) }}</span>
                    <span>#{{ rankOf(sol.id) }}</span>
                  </span>
                  <!-- ID — bold, white -->
                  <span
                    class="text-white font-extrabold leading-tight"
                    :class="density === 'compact' ? 'text-[11px]' : 'text-xs'"
                    :title="sol.id"
                  >{{ sol.id }}</span>
                  <!-- Description — softer, 2-line clamp -->
                  <span
                    v-if="sol.description"
                    class="text-slate-300 font-normal leading-snug"
                    :class="density === 'compact' ? 'text-[10px]' : 'text-[11px]'"
                    :title="sol.description"
                    style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;text-overflow:ellipsis"
                  >{{ sol.description }}</span>
                </div>
                <!-- Feature #39 — Actuals input -->
                <div v-if="actualsMode" class="mt-2 flex justify-center">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    placeholder="–"
                    :value="actuals[sol.id] ?? ''"
                    :aria-label="`Actual impact % for ${sol.id}`"
                    class="w-20 h-9 text-xs rounded border border-blue-300 text-center bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    @input="onActualInput(sol.id, $event)"
                  />
                </div>
              </th>

              <!-- Feature #98 — EV column header -->
              <th
                v-if="evModeOpen"
                scope="col"
                class="bg-purple-800 px-2 pb-2 pt-1 align-bottom"
                style="width:70px;min-width:70px"
                role="columnheader"
                aria-label="Expected Value column"
              >
                <div
                  class="text-white font-semibold text-xs mx-auto text-center"
                >EV</div>
              </th>
            </tr>
          </thead>

          <!-- Data rows (values × solutions) -->
          <tbody>
            <tr
              v-for="(val, rowIdx) in values"
              :key="val.id"
              role="row"
              :class="rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50'"
              @mouseenter="hoverRow = val.id"
              @mouseleave="hoverRow = ''"
            >
              <!-- Sticky row header — wider (220 px) so V. descriptions
                   wrap to two lines instead of being truncated at 105 px -->
              <th
                scope="row"
                class="sticky left-0 z-10 bg-inherit text-left font-medium text-slate-900 align-top border-r border-slate-200"
                :class="density === 'compact'
                  ? 'px-3 py-1.5 text-xs'
                  : 'px-4 py-2.5 text-sm'"
                role="rowheader"
                :title="val.description || val.id"
                :style="density === 'compact'
                  ? 'min-width:180px;max-width:220px'
                  : 'min-width:220px;max-width:260px'"
              >
                <div class="flex items-center gap-1.5">
                  <span class="inline-block w-1 self-stretch rounded bg-indigo-400" aria-hidden="true"></span>
                  <span class="font-bold text-slate-900 leading-tight">{{ val.id }}</span>
                </div>
                <div
                  v-if="val.description"
                  class="font-normal text-slate-500 leading-snug mt-0.5"
                  :class="density === 'compact' ? 'text-[10px]' : 'text-[11px]'"
                  style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;text-overflow:ellipsis"
                >{{ val.description }}</div>

                <!-- Feature #98 — Probability slider (shown in EV mode) -->
                <div v-if="evModeOpen" class="mt-1 flex items-center gap-1">
                  <label :for="`ev-prob-${val.id}`" class="sr-only">
                    Probability for {{ val.id }} (percent)
                  </label>
                  <input
                    :id="`ev-prob-${val.id}`"
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    :value="probabilities[val.id] ?? 70"
                    :aria-label="`Probability for ${val.id}`"
                    class="w-16 accent-purple-600"
                    @input="setProbability(val.id, Number(($event.target as HTMLInputElement).value))"
                  />
                  <span class="text-purple-700 font-semibold" style="font-size:10px">
                    {{ probabilities[val.id] ?? 70 }}%
                  </span>
                </div>
              </th>

              <!-- Impact % cells — bold solid-colour fill, big number,
                   no separate bar (the cell IS the bar). Hover dims other
                   rows/cols. Winning column gets a gold inset shadow. -->
              <td
                v-for="sol in solutions"
                :key="sol.id"
                class="text-center transition-opacity"
                :class="density === 'compact' ? 'p-0.5' : 'p-1'"
                role="cell"
                :style="boldDataCellStyle(val.id, sol.id)"
                :data-confidence="viewMode === 'confidence' ? confidenceLevel(sol.id) : undefined"
                @mouseenter="hoverCol = sol.id; showTooltip($event, val.id, sol.id)"
                @mouseleave="hoverCol = ''; hideTooltip()"
                @focusin="showTooltip($event as unknown as MouseEvent, val.id, sol.id)"
                @focusout="hideTooltip"
              >
                <label :for="`cell-${val.id}-${sol.id}`" class="sr-only">
                  Impact of {{ sol.id }} on {{ val.id }} as a percentage
                </label>
                <input
                  :id="`cell-${val.id}-${sol.id}`"
                  type="number"
                  min="-100"
                  max="100"
                  class="rounded border border-transparent bg-transparent text-center font-extrabold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-white focus:bg-white/90"
                  :class="density === 'compact'
                    ? 'w-12 px-0.5 py-0.5 text-sm'
                    : 'w-16 px-1 py-1 text-base'"
                  :value="impactMatrix[val.id]?.[sol.id] ?? 0"
                  :aria-label="`Impact of ${sol.id} on ${val.id} (percent)`"
                  :style="`color:${boldCellFg(impactMatrix[val.id]?.[sol.id])}`"
                  @input="onCellInput(val.id, sol.id, $event)"
                />
              </td>

              <!-- Feature #98 — EV cell at the right of the row -->
              <td
                v-if="evModeOpen"
                class="p-1 text-center text-xs font-semibold"
                role="cell"
                :style="val.id === topVEntry ? 'background:#ecfdf5' : 'background:#f5f3ff'"
                :aria-label="`Expected value for ${val.id}`"
              >
                {{ (expectedValues[val.id] ?? 0).toFixed(1) }}
              </td>
            </tr>
          </tbody>

          <!-- Footer: costs + totals + efficiency + V/C
               Redesigned 2026-05-12: bigger numbers, winning column outlined
               in gold, ranking medal alongside Efficiency. -->
          <tfoot>
            <!-- Calendar Time row -->
            <tr role="row" class="border-t-2 border-slate-200 bg-blue-50">
              <th
                scope="row"
                class="sticky left-0 z-10 bg-blue-50 text-left font-bold text-blue-900 whitespace-nowrap border-r border-blue-200"
                :class="density === 'compact' ? 'px-3 py-1 text-[11px]' : 'px-4 py-2 text-xs'"
                role="rowheader"
              >
                ⏱ Weeks
                <div class="font-normal text-blue-500/70 mt-0.5" style="font-size:10px">
                  Σ {{ totalCalendarWeeks }}w
                </div>
              </th>
              <td
                v-for="sol in solutions"
                :key="sol.id"
                class="text-center"
                :class="density === 'compact' ? 'p-0.5' : 'p-1'"
                :style="sol.id === winningSolution ? 'box-shadow:inset 0 0 0 2px rgba(234,179,8,0.45)' : ''"
                role="cell"
              >
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  class="rounded border border-blue-200 bg-white text-center font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  :class="density === 'compact' ? 'w-12 px-0.5 py-0.5 text-xs' : 'w-16 px-1 py-1 text-sm'"
                  :value="calendarCosts[sol.id] ?? ''"
                  :aria-label="`Calendar time for ${sol.id} in weeks`"
                  placeholder="0"
                  @input="onCostInput('calendar', sol.id, $event)"
                />
              </td>
            </tr>

            <!-- Capital Cost row -->
            <tr role="row" class="border-t border-blue-100 bg-purple-50">
              <th
                scope="row"
                class="sticky left-0 z-10 bg-purple-50 text-left font-bold text-purple-900 whitespace-nowrap border-r border-purple-200"
                :class="density === 'compact' ? 'px-3 py-1 text-[11px]' : 'px-4 py-2 text-xs'"
                role="rowheader"
              >
                💰 $k
                <div class="font-normal text-purple-500/70 mt-0.5" style="font-size:10px">
                  Σ ${{ totalCapitalCost }}k
                </div>
              </th>
              <td
                v-for="sol in solutions"
                :key="sol.id"
                class="text-center"
                :class="density === 'compact' ? 'p-0.5' : 'p-1'"
                :style="sol.id === winningSolution ? 'box-shadow:inset 0 0 0 2px rgba(234,179,8,0.45)' : ''"
                role="cell"
              >
                <input
                  type="number"
                  min="0"
                  step="1"
                  class="rounded border border-purple-200 bg-white text-center font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
                  :class="density === 'compact' ? 'w-12 px-0.5 py-0.5 text-xs' : 'w-16 px-1 py-1 text-sm'"
                  :value="capitalCosts[sol.id] ?? ''"
                  :aria-label="`Capital cost for ${sol.id} in thousands`"
                  placeholder="0"
                  @input="onCostInput('capital', sol.id, $event)"
                />
              </td>
            </tr>

            <!-- Value Impact Sum row — bigger, bolder -->
            <tr role="row" class="border-t-2 border-slate-300">
              <th
                scope="row"
                class="sticky left-0 z-10 bg-slate-100 text-left font-bold text-slate-700 whitespace-nowrap border-r border-slate-300"
                :class="density === 'compact' ? 'px-3 py-1 text-[11px]' : 'px-4 py-2 text-xs'"
                role="rowheader"
              >
                Σ Impact
                <div class="font-normal text-slate-400 mt-0.5" style="font-size:10px">total {{ grandTotalImpact }}</div>
              </th>
              <td
                v-for="sol in solutions"
                :key="sol.id"
                class="text-center font-extrabold"
                :class="density === 'compact' ? 'p-1 text-base' : 'p-2 text-lg'"
                role="cell"
                :style="totalCellStyle(sol.id) + (sol.id === winningSolution ? ';box-shadow:inset 0 0 0 2px rgba(234,179,8,0.45)' : '')"
              >{{ totalImpact(sol.id) }}</td>
            </tr>

            <!-- V/C Ratio row — colour-coded pill badge -->
            <tr role="row" class="border-t border-slate-200 bg-slate-50">
              <th
                scope="row"
                class="sticky left-0 z-10 bg-slate-50 text-left font-bold text-slate-700 whitespace-nowrap border-r border-slate-200"
                :class="density === 'compact' ? 'px-3 py-1 text-[11px]' : 'px-4 py-2 text-xs'"
                role="rowheader"
                aria-label="Value to cost ratio row"
              >
                V/C
                <div class="font-normal text-slate-400 mt-0.5" style="font-size:10px">val ÷ claim</div>
              </th>
              <td
                v-for="sol in solutions"
                :key="sol.id"
                class="text-center"
                :class="density === 'compact' ? 'p-0.5' : 'p-1'"
                :style="sol.id === winningSolution ? 'box-shadow:inset 0 0 0 2px rgba(234,179,8,0.45)' : ''"
                role="cell"
              >
                <div class="flex items-center justify-center gap-1.5">
                  <span
                    class="inline-block rounded-full shrink-0"
                    :class="density === 'compact' ? 'w-2 h-2' : 'w-2.5 h-2.5'"
                    :style="`background-color:${getVCColour(vcRatios[sol.id] ?? 0)}`"
                    aria-hidden="true"
                  ></span>
                  <span class="font-bold text-slate-800" :class="density === 'compact' ? 'text-xs' : 'text-sm'">
                    {{ formatVCRatio(sol.id) }}
                  </span>
                </div>
                <div
                  v-if="actualDelta(sol.id) !== null"
                  :class="actualDelta(sol.id)! >= 0 ? 'text-green-600' : 'text-red-600'"
                  style="font-size:10px"
                  :aria-label="`Actual vs estimate delta for ${sol.id}`"
                >
                  Δ {{ actualDelta(sol.id)! >= 0 ? '+' : '' }}{{ actualDelta(sol.id) }}%
                </div>
              </td>
            </tr>

            <!-- Means Efficiency row — the headline number, biggest of all -->
            <tr role="row" class="border-t-2 border-slate-400 bg-gradient-to-b from-slate-100 to-slate-200">
              <th
                scope="row"
                class="sticky left-0 z-10 text-left font-extrabold text-slate-900 whitespace-nowrap border-r border-slate-300 bg-gradient-to-b from-slate-100 to-slate-200"
                :class="density === 'compact' ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-sm'"
                role="rowheader"
                aria-label="Means efficiency row"
              >
                Efficiency
                <div class="font-normal text-slate-500 mt-0.5" style="font-size:10px">Σ ÷ (wks + $k)</div>
              </th>
              <td
                v-for="sol in solutions"
                :key="sol.id"
                class="text-center"
                :class="density === 'compact' ? 'p-1' : 'p-2'"
                :style="sol.id === winningSolution
                  ? 'background:linear-gradient(180deg,#fef3c7 0%,#fde68a 100%);box-shadow:inset 0 0 0 2px rgba(234,179,8,0.55)'
                  : ''"
                role="cell"
              >
                <div
                  class="font-black text-slate-900 leading-none"
                  :class="density === 'compact' ? 'text-base' : 'text-xl'"
                >{{ formatEfficiency(sol.id) }}</div>
                <div class="mt-1 inline-flex items-center justify-center gap-1">
                  <span v-if="medalFor(rankOf(sol.id))" class="text-base leading-none">{{ medalFor(rankOf(sol.id)) }}</span>
                  <span
                    class="font-bold text-slate-600"
                    :class="density === 'compact' ? 'text-[10px]' : 'text-[11px]'"
                  >#{{ rankOf(sol.id) }}</span>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- ── Feature #98: EV Mode summary banner ──────────────────────────── -->
      <div
        v-if="evModeOpen"
        class="mb-4 flex items-center gap-3 rounded-lg border border-purple-200 bg-purple-50 px-4 py-3"
        data-testid="ev-summary-banner"
        aria-label="Expected Value summary"
      >
        <span class="text-sm font-semibold text-purple-900">
          Total Expected Value:
          <span class="ml-1 text-purple-700">{{ aggregateEV.toFixed(1) }}</span>
        </span>
        <template v-if="topVEntry">
          <span class="text-xs text-purple-500">·</span>
          <span class="text-xs text-purple-700">
            Top entry: <span class="font-medium">{{ topVEntry }}</span>
            ({{ (expectedValues[topVEntry] ?? 0).toFixed(1) }})
          </span>
        </template>
      </div>

      <!-- ── Feature #59: Stakeholder impact matrix ───────────────────────── -->
      <!-- Shown as the PRIMARY content when viewMode === 'stakeholders' (replaces the VDT table above). -->
      <div v-if="viewMode === 'stakeholders'" class="overflow-x-auto mt-4 mb-6" aria-label="Stakeholder impact matrix">
        <!-- Empty state -->
        <p
          v-if="detectedStakeholders.length === 0"
          class="py-4 text-center text-sm text-gray-400"
        >
          No stakeholders detected — add role keywords to your V. entry descriptions
        </p>

        <!-- Matrix grid -->
        <table
          v-else
          class="w-auto border-collapse text-xs bg-white rounded-lg border border-gray-200 shadow-sm"
          role="table"
          aria-label="Stakeholder × value impact matrix"
        >
          <thead>
            <tr role="row">
              <th
                scope="col"
                class="sticky left-0 z-10 bg-gray-800 text-white font-semibold px-3 py-2 min-w-[120px] text-left text-xs"
                role="columnheader"
              >Stakeholder / V.</th>
              <th
                v-for="v in values"
                :key="v.id"
                scope="col"
                class="bg-gray-800 px-1 pb-2 pt-1 align-bottom"
                style="width:56px;min-width:56px"
                role="columnheader"
                :aria-label="`Value: ${v.id}`"
              >
                <div
                  class="text-white font-medium text-xs mx-auto"
                  style="writing-mode:vertical-rl;transform:rotate(180deg);white-space:nowrap;max-height:100px;overflow:hidden;text-overflow:ellipsis"
                  :title="v.id"
                >{{ v.id.slice(0, 14) }}</div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(stakeholder, rowIdx) in detectedStakeholders"
              :key="stakeholder.name"
              role="row"
              :class="rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'"
            >
              <!-- Row header: stakeholder name + colour dot -->
              <th
                scope="row"
                class="sticky left-0 z-10 bg-inherit text-left px-3 py-2 font-medium text-gray-800 text-xs whitespace-nowrap"
                role="rowheader"
              >
                <span class="inline-flex items-center gap-1.5">
                  <span
                    class="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                    :style="`background-color:${stakeholder.colour}`"
                    aria-hidden="true"
                  ></span>
                  {{ stakeholder.name }}
                </span>
              </th>
              <!-- Impact dot cells -->
              <td
                v-for="v in values"
                :key="v.id"
                class="p-0 text-center align-middle"
                style="height:40px"
                role="cell"
              >
                <span
                  class="inline-flex items-center justify-center w-full h-full"
                  style="min-height:40px"
                >
                  <span
                    :style="stakeholderDotStyle(impactLevel(vEntryText(v), stakeholder), stakeholder.colour)"
                    :title="`${stakeholder.name} × ${v.id}: impact ${impactLevel(vEntryText(v), stakeholder)}/3`"
                    :aria-label="`${stakeholder.name} impact on ${v.id}: ${impactLevel(vEntryText(v), stakeholder)} out of 3`"
                  />
                </span>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Legend -->
        <div class="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
          <span class="font-semibold">Impact:</span>
          <span class="inline-flex items-center gap-1">
            <span class="inline-block rounded-full" style="width:8px;height:8px;background:#e2e8f0;opacity:0.4"></span>
            None
          </span>
          <span class="inline-flex items-center gap-1">
            <span class="inline-block rounded-full" style="width:10px;height:10px;background:#6366f1"></span>
            Low
          </span>
          <span class="inline-flex items-center gap-1">
            <span class="inline-block rounded-full" style="width:14px;height:14px;background:#6366f1"></span>
            Medium
          </span>
          <span class="inline-flex items-center gap-1">
            <span class="inline-block rounded-full" style="width:18px;height:18px;background:#6366f1"></span>
            High
          </span>
        </div>
      </div>

      <!-- ── Feature #34: Quick Wins callout ──────────────────────────────── -->
      <div
        v-if="showQuickWins"
        class="rounded-xl bg-emerald-50 border border-emerald-200 p-4 mt-4"
        data-testid="quick-wins-section"
        aria-label="Quick Wins — highest value per resource invested"
      >
        <h3 class="text-sm font-semibold text-emerald-800 mb-3">
          ⚡ Quick Wins — highest value per resource invested
        </h3>
        <ol class="space-y-2 list-none m-0 p-0">
          <li
            v-for="win in quickWins"
            :key="win.solutionId"
            class="min-h-[44px] flex items-center gap-3"
            :data-testid="`quick-win-row-${win.rank}`"
          >
            <!-- Rank badge -->
            <span
              class="flex items-center justify-center min-w-[36px] min-h-[36px] rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold shrink-0"
              :data-testid="`quick-win-badge-${win.rank}`"
            >{{ win.ordinal }}</span>
            <!-- Solution name -->
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-gray-900 truncate">{{ win.solutionId }}</div>
              <div class="text-xs text-gray-500 mt-0.5">{{ win.interpretation }}</div>
            </div>
            <!-- V/C value -->
            <span class="text-base font-bold text-emerald-700 shrink-0">
              V/C {{ win.vc.toFixed(1) }}×
            </span>
          </li>
        </ol>
      </div>

      <!-- Confidence legend (shown only in confidence mode) -->
      <div
        v-if="viewMode === 'confidence'"
        class="mb-4 flex flex-wrap items-center gap-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-xs text-gray-600"
        aria-label="Confidence level legend"
        data-testid="confidence-legend"
      >
        <span class="font-semibold text-gray-500">Confidence:</span>
        <span class="inline-flex items-center gap-1.5">
          <span
            class="inline-block w-8 h-4 rounded border border-gray-300 bg-white"
            aria-hidden="true"
          ></span>
          High (&ge;1.5 V/C)
        </span>
        <span class="inline-flex items-center gap-1.5">
          <span
            class="inline-block w-8 h-4 rounded border border-gray-300"
            style="background-image:repeating-linear-gradient(45deg,rgba(0,0,0,0.08) 0px,rgba(0,0,0,0.08) 2px,transparent 2px,transparent 8px);background-color:#fff"
            aria-hidden="true"
          ></span>
          Medium (0.8–1.49)
        </span>
        <span class="inline-flex items-center gap-1.5">
          <span
            class="inline-block w-8 h-4 rounded border border-gray-300"
            style="background-image:repeating-linear-gradient(45deg,rgba(0,0,0,0.18) 0px,rgba(0,0,0,0.18) 2px,transparent 2px,transparent 6px);background-color:#fff"
            aria-hidden="true"
          ></span>
          Low (&lt;0.8)
        </span>
      </div>

      <!-- Ranked solutions panel -->
      <div
        role="region"
        class="rounded-lg border border-gray-200 bg-white shadow-sm p-4"
        aria-labelledby="ranked-solutions-heading"
      >
        <h2
          id="ranked-solutions-heading"
          class="text-sm font-semibold text-gray-800 mb-3"
        >Ranked Solutions (by Means Efficiency)</h2>
        <ol class="space-y-2 list-none m-0 p-0">
          <li
            v-for="item in rankedDetails"
            :key="item.solutionId"
            class="flex items-center gap-3"
          >
            <span
              class="flex items-center justify-center min-w-[32px] min-h-[32px] rounded-full text-white text-xs font-bold shrink-0"
              :class="item.rank === 1 ? 'bg-green-600' : item.rank === 2 ? 'bg-blue-600' : 'bg-gray-400'"
              :aria-label="`Rank ${item.rank}`"
            >{{ item.rank }}</span>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-gray-900 truncate">{{ item.solutionId }}</div>
              <div class="text-xs text-gray-500">
                Efficiency: <span class="font-medium">{{ item.efficiency }}</span>
                &nbsp;·&nbsp;&#931; Impact: {{ item.totalImpact }}
                <template v-if="item.calendar || item.capital">
                  &nbsp;·&nbsp;Time: {{ item.calendar }}w&nbsp;·&nbsp;Cost: ${{ item.capital }}k
                </template>
              </div>
            </div>
          </li>
        </ol>
        <p class="mt-3 text-xs text-gray-400">
          Efficiency = total value impact &#247; (calendar weeks + capital $k). Enter costs above to enable ranking. Negative cells reduce the score.
        </p>
      </div>

    </template>
  </section>
</template>
