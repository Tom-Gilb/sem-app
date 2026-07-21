<!-- UNIT_TYPE=Panel
  MultiForksPanel.vue — System diagram: Resource arrows fork INTO the System
  oval (left), Value arrows fork OUT (right).  Each arrow has 3 level markers
  (Benchmark / Constraint = Tolerable / Target = Goal-or-Wish) plus a
  current-level progress bar coloured by status (green / amber / red).

  Tom Gilb 2026-06-06 brief:
    "Left side a stack of resource arrows. Connected to the system oval (with
     system Name, default 'System'). On right side all Value Arrows, emanating
     from system oval. The arrows are marked with 3 levels (Benchmark,
     Constraint, Target (labelled Wish or Goal), or Budget. Their current
     levels. Tag, about 20 letters of Scale. The diagram includes the Balance
     Score (from MV). It also includes a Version, and Date-Time stamp. A
     progress Bar along the [arrows] shows current Level. Green if Goal or
     under budget, Orange if Tolerable, and RED if intolerable. We need to
     annotate: Evo steps delivered = 0 Initial Plan."

  Tom Gilb 2026-06-06 r02 review:
    "multifork: good draft. missing the input resource forks. the bar is all
     same length, should vary in relation to target, color varies dependent of
     relation to requirements, several texts cut off, try againt"

  Fixes shipped in r02:
    (1) `parsePlanguageThreshold` returns `{num, display}` — earlier code
        compared the OBJECT to numbers (always wrong), so every entry came out
        green.  Now uses `.num` for the numeric comparisons.
    (2) Bar LENGTH now varies — each arrow's progress bar fills a fraction
        proportional to where Status sits along the Tolerable→Goal axis,
        clamped to [0.08, 1.05].  Long target gaps and high Status produce
        longer green bars; low Status produces short red bars.
    (3) Bar COLOR computed from real Status vs Tolerable + Goal thresholds.
        When Status is unknown, the bar renders gray with a "Status unknown"
        badge so the viewer is not lied to.
    (4) When `spec.resources` is empty, three placeholder Resource arrows
        (Time, Capital Cost, People) render with dashed strokes + a
        "placeholder — add Resource entries" badge so the diagram still shows
        the FORK metaphor.
    (5) Text cut-offs fixed: wider status badges, longer Scale tag (≈ 42 chars
        across two lines), system-oval name wraps to up to 3 lines, and the
        oval auto-widens when the spec name is long.

  Architecture:
    - Reads currentSpec + balanceScore from useMultiVision composable.
    - Pure SVG layout; pure functions; Twin-portable.
    - No internal state mutation; receives `open` from parent.
-->
<script setup lang="ts">
// UNIT_TYPE=Panel
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'
import { useMultiVision } from '../composables/useMultiVision'
// Tom 2026-06-06 fix: import was `usePlanModel` from `../composables/usePlanModel`
// but the composable was renamed to `useSpecModel` in the 2026-06-05 Plan→Spec
// rename (Phase D, see SEM-Design-History). The local alias `planModel` is
// kept so the rest of this file's references continue to work unchanged.
import { useSpecModel as usePlanModel } from '../composables/useSpecModel'
import {
  GOAL_VALIDITY_CONDITIONS,
  PLANGUAGE_TERMS,
  RESOURCE_ALLOCATION_TERMS,
  type PlanguageTerm,
} from '../composables/usePlanguageTerms'
import { rBudget, rBudgetLabel } from '../types/spec'
import PlanguageTermWidget from './PlanguageTerm.vue'
import { keyedLevelHoverHint } from '../composables/useKeyedLevelInfo'

const props = defineProps<{
  open: boolean
  systemName?: string
  evoStepsDelivered?: number
}>()
const emit = defineEmits<{ close: [] }>()

const { values, resources, solutions, balanceScore, parsePlanguageThreshold } = useMultiVision()
const { currentModel: planModel } = usePlanModel()

// ── Diagram constants ────────────────────────────────────────────────────────
const ROW_HEIGHT  = 96            // extra room per row (was 80) — Scale label gets 2 lines
const ROW_PAD     = 20
const ARROW_LEN   = 420
const SVG_WIDTH   = 1240
const LEFT_X      = 60
const RIGHT_X     = SVG_WIDTH - 60

// ── Placeholder Resource forks — Tom 2026-06-06 r02 ──────────────────────────
// "missing the input resource forks" — when the spec has no Resource entries,
// render three default placeholders so the user STILL sees the Resources →
// System ← Values fork metaphor.  Marked visually (dashed stroke + badge)
// so the viewer knows these are not real spec data.
interface PlaceholderRow {
  id: string
  description: string
  scale: string
  status: string
  tolerable: string
  goal: string
  wish?: string
  isPlaceholder: true
}
// Tom Gilb 2026-06-07 doctrine correction: Tolerable for Resources is the
// MINIMUM allocation for non-failure (not a maximum consumption cap).
// Placeholder values reflect the correct axis: Tolerable (floor) < Budget (official).
// "CONSUMPTION ITSELF IS A DIFFERENT MATTER — NOT A PLAN TO CONSUME, JUST A HISTORIC FACT."
const PLACEHOLDER_RESOURCES: PlaceholderRow[] = [
  {
    id: 'R.Deadline',
    description: 'Calendar time allocated per Evo Step',
    scale: 'Weeks of calendar time per Evo Step',
    status: '',
    // Tolerable = minimum time needed for non-failure (floor)
    // Budget/Deadline = officially allocated time window
    // Wish = what planners would love to have
    tolerable: '≥ 4 wks',    // minimum weeks needed — below this the Evo Step fails
    goal: '8 wks',            // Budget (Deadline): officially allocated time
    wish: '12 wks',           // stakeholder's desired time allocation
    isPlaceholder: true,
  },
  {
    id: 'R.Capital',
    description: 'Capital allocated per Evo Step',
    scale: '$k allocated per Evo Step',
    status: '',
    tolerable: '≥ 50 $k',    // minimum $k for non-failure
    goal: '100 $k',           // Budget: officially allocated capital
    wish: '200 $k',           // stakeholder's desired allocation
    isPlaceholder: true,
  },
  {
    id: 'R.Headcount',
    description: 'Specialists allocated per Evo Step',
    scale: 'FTE-weeks per Evo Step',
    status: '',
    tolerable: '≥ 3 FTE-wk',  // minimum specialists for non-failure
    goal: '6 FTE-wk',          // Budget (Headcount): officially allocated people
    wish: '12 FTE-wk',         // stakeholder's desired allocation
    isPlaceholder: true,
  },
]

// Tom Gilb 2026-06-06 r03: Solutions now live in the MIDDLE rectangle, not on
// the left.  Semantic model: Resources fund Solutions → Solutions deliver Values.
// Left side = real R. entries only (or PLACEHOLDER_RESOURCES when none exist).
const effectiveResources = computed(() =>
  resources.value.length > 0 ? resources.value : PLACEHOLDER_RESOURCES
)

const rowCount = computed(() =>
  Math.max(values.value.length, effectiveResources.value.length, 1)
)
const svgHeight = computed(() =>
  // Must be tall enough for both the resource/value arrow rows AND the Solutions
  // rectangle (which grows with the number of Solution entries).
  Math.max(
    rowCount.value * ROW_HEIGHT + 2 * ROW_PAD + 120,
    OVAL_RY.value  * 2         + 2 * ROW_PAD + 100,
  )
)
const ovalCy    = computed(() => svgHeight.value / 2)

// ── System-name oval geometry: auto-widen for long names ──────────────────────
const systemName = computed(() => props.systemName || planModel.value?.name || 'System')

/** Wrap a string into ≤ N-char lines at word boundaries. */
function wrapLines(s: string, maxCharsPerLine: number, maxLines: number): string[] {
  if (!s) return ['']
  const words = s.trim().split(/\s+/)
  const out: string[] = []
  let cur = ''
  for (const w of words) {
    if (!cur) {
      cur = w
    } else if (cur.length + 1 + w.length <= maxCharsPerLine) {
      cur += ' ' + w
    } else {
      out.push(cur)
      cur = w
      if (out.length === maxLines - 1) break
    }
  }
  if (out.length < maxLines && cur) out.push(cur)
  if (words.join(' ').length > out.join(' ').length && out.length === maxLines) {
    // truncate last line with ellipsis if we ran out of room
    const last = out[out.length - 1]
    out[out.length - 1] = last.length > 3 ? last.slice(0, last.length - 1) + '…' : last
  }
  return out
}

// ── Solutions rectangle geometry ─────────────────────────────────────────────
// Tom Gilb 2026-06-06: "remove the Oval, and put a colorful rectangle there
// (the icon for solutions!) and inside the rectangle, all the Solutions, with
// arrows out to right (inside the rectangle)."
// OVAL_RX / OVAL_RY names kept so all downstream template expressions
// (arrow endpoint calc, hit-zone calc, status badge positions) work unchanged.
const OVAL_RX       = 175   // fixed half-width of the Solutions rectangle (px)
const RECT_HEADER_H = 84    // px: title + sys-name + ver/date + balance + separator
const SOLUTION_ROW_H = 26   // px: height per Solution row listed inside rectangle

const OVAL_RY = computed(() =>
  // Rectangle grows with the number of Solution entries; minimum 80 so an
  // empty spec still renders a visible rectangle.
  Math.max(80, Math.ceil((RECT_HEADER_H + solutions.value.length * SOLUTION_ROW_H + 14) / 2))
)
const OVAL_CX = SVG_WIDTH / 2

// ── Per-arrow positioning ────────────────────────────────────────────────────
function rowY(idx: number, total: number): number {
  const block = total * ROW_HEIGHT
  const startY = ovalCy.value - block / 2 + ROW_HEIGHT / 2
  return startY + idx * ROW_HEIGHT
}

// ── Numeric Status + threshold parsing (Tom r02 fix) ─────────────────────────
// parsePlanguageThreshold returns `{ num, display }`. Earlier code treated the
// whole object as a number — every comparison was undefined, so every entry
// resolved to one branch (everything green). This now uses .num explicitly.
function numOf(level: string | undefined | null): number | null {
  if (!level) return null
  const parsed = parsePlanguageThreshold(level)
  return parsed.num
}

// ── Status band ──────────────────────────────────────────────────────────────
type Status = 'success' | 'tolerable' | 'failed' | 'unknown'

function statusForEntry(
  status: string,
  tolerable: string,
  goal: string
): Status {
  const cur = numOf(status)
  const tol = numOf(tolerable)
  const gol = numOf(goal)
  if (cur == null) return 'unknown'
  if (tol == null && gol == null) return 'unknown'
  // Determine polarity from Tolerable / Goal numerics if both available.
  const goalIsHigher = (tol != null && gol != null) ? (gol > tol) : true
  if (goalIsHigher) {
    if (gol != null && cur >= gol) return 'success'
    if (tol != null && cur >= tol) return 'tolerable'
    return 'failed'
  }
  // Lower is better (typical for Resource Budgets).
  if (gol != null && cur <= gol) return 'success'
  if (tol != null && cur <= tol) return 'tolerable'
  return 'failed'
}

function statusColor(s: Status): string {
  if (s === 'success')   return '#10b981'   // emerald-500
  if (s === 'tolerable') return '#f59e0b'   // amber-500
  if (s === 'failed')    return '#ef4444'   // red-500
  return '#94a3b8'                          // slate-400 — unknown
}

function statusLabel(s: Status, side: 'value' | 'resource'): string {
  if (s === 'success')   return side === 'value' ? 'Goal MET' : 'Under Budget'
  if (s === 'tolerable') return side === 'value' ? 'Tolerable Range' : 'Tolerable Excess'
  if (s === 'failed')    return side === 'value' ? 'VIOLATION' : 'Exceeds Budget'
  return 'Status unknown'
}

// ── Numeric-to-axis projection (Tom Gilb 2026-06-06 doctrinal fix) ──────────
//
// Tom verbatim: "At Tolerable → 0.50 ??? tolerable is not at 50%, it is where
// it is specified by stakeholders".  Earlier r02 placed Tolerable at a fixed
// 0.50 fraction of the bar — wrong.  Tolerable's position on the bar is the
// NUMERIC POSITION the stakeholders set, projected onto the Past→Target axis.
//
// Axis model:
//   • Left end (fraction 0.0)  = Past / Benchmark level (or implicit origin
//                                when spec has no Past field — see below).
//   • Right end (fraction 1.0) = primary Target (Wish if present, else Goal).
//   • Tolerable, Goal, Status each project to wherever they land on that axis.
//   • Polarity-aware: when lower-is-better (Resource Budgets), the projection
//     is inverted so the geometry still reads "left = worse, right = better".
//
// When Past is absent from the spec (current VEntry / REntry shape has no
// Past field), we synthesize an implicit Past:
//   • Forward polarity (Wish/Goal > Tolerable): Past = max(0, Tolerable − (
//     Target − Tolerable))   — i.e. mirror the Goal-side gap on the Tolerable
//     side so Tolerable still sits visibly to the right of the origin.
//   • Inverted polarity:                          Past = Tolerable + (Tolerable
//     − Target)   — mirror equivalently for the inverted axis.
//
// Returns each marker's fraction in [0, 1.05] (overshoot toward Wish caps at
// 1.05 so the marker stays drawable).
//
// All projections are linear.  If the inputs do not parse as numbers the
// function returns `null` for that marker (caller renders no marker / no
// progress fill — honest about the gap rather than guessing).

export interface ForkAxisProjection {
  /** Fraction of ARROW_LEN (0..1.05) for each marker; null when unparseable. */
  past:       number       // always 0 by construction
  tolerable:  number | null
  goal:       number | null
  wish:       number | null
  status:     number | null
  /** Which target defines the right end of the axis (1.0). */
  targetRef:  'wish' | 'goal' | 'none'
  /** True when lower is better (typical for Resource Budgets). */
  inverted:   boolean
}

function axisProjection(
  statusStr:    string,
  tolerableStr: string,
  goalStr:      string,
  wishStr?:     string
): ForkAxisProjection {
  const tol = numOf(tolerableStr)
  const gol = numOf(goalStr)
  const wsh = numOf(wishStr ?? '')
  const cur = numOf(statusStr)

  // Determine polarity from Tolerable + Goal numerics ONLY (Wish does NOT
  // determine polarity — Tom Gilb 2026-06-06: Wish can be optimistic OR
  // pessimistic, so it cannot be assumed to be in the "good" direction).
  // For Resources: Budget (goal) < Tolerable numerically → inverted=true →
  // LEFT = high consumption (bad), RIGHT = low consumption (good).
  // Logical sequence left-to-right: Tolerable → Budget → Wish (worst → committed → ideal).
  const inverted = (gol != null && tol != null) ? (gol < tol) : false

  const targetRef: ForkAxisProjection['targetRef'] = wsh != null ? 'wish'
                                                    : gol != null ? 'goal'
                                                    : 'none'

  // Collect ALL known numerics so the axis spans them — Tom Gilb 2026-06-06
  // doctrinal correction: do NOT assume Wish > Goal.  Wish can sit anywhere
  // on the scale (optimistic, pessimistic, or absent).  The axis is built
  // around the min/max of whatever the stakeholder ACTUALLY articulated.
  const known: number[] = []
  if (tol != null) known.push(tol)
  if (gol != null) known.push(gol)
  if (wsh != null) known.push(wsh)
  if (cur != null) known.push(cur)

  // Tom Gilb 2026-06-06: "The left side is status past benchmarks."
  // When Status is non-numeric (e.g. 'pre-build'), only Tolerable + Goal end
  // up in `known`.  The axis then spans [Tolerable − pad … Goal + pad] and
  // Tolerable projects to ≈ 4 % of the bar — extreme left, which visually
  // implies "Tolerable is the worst possible level."
  //
  // Fix: synthesise an implicit Past/Benchmark at  2 × Tolerable − Goal.
  // This mirrors the Tolerable→Goal gap on the Tolerable side, so Tolerable
  // sits at approximately the mid-point of the bar (Past … Tolerable ≈ same
  // distance as Tolerable … Goal).  The formula is polarity-agnostic:
  //   • Forward (Goal > Tolerable): Past = 2T − G  < Tolerable  ✓
  //   • Inverted (Goal < Tolerable): Past = 2T − G  > Tolerable ✓ (worse)
  // Only applied when Status is absent — when Status IS measured its real
  // value anchors the left end naturally (Status < Tolerable is the normal
  // early-project position and naturally pushes Tolerable toward the centre).
  if (cur == null && tol != null && gol != null) {
    known.push(2 * tol - gol)
  }

  if (known.length === 0) {
    return {
      past: 0, tolerable: null, goal: null, wish: null, status: null,
      targetRef, inverted,
    }
  }
  const minVal = Math.min(...known)
  const maxVal = Math.max(...known)
  // Pad each end so the extreme markers sit visibly inside the bar.
  const pad = maxVal === minVal ? Math.abs(maxVal) * 0.1 || 1 : (maxVal - minVal) * 0.08

  // Axis orientation: in forward polarity, left = worst (lowest performance),
  // right = best (highest).  In inverted polarity (Resource Budgets where
  // lower is better), left = worst (highest cost), right = best (lowest cost).
  // Either way, "right = closer to commitment" reads consistently.
  const axisLeft  = inverted ? (maxVal + pad / 2) : (minVal - pad / 2)
  const axisRight = inverted ? (minVal - pad / 2) : (maxVal + pad / 2)

  const project = (n: number | null): number | null => {
    if (n == null) return null
    const denom = axisRight - axisLeft
    if (Math.abs(denom) < 1e-9) return 0.5
    const raw = (n - axisLeft) / denom
    // Clamp to [-0.02, 1.05] so a marker slightly outside the spec range is
    // still drawable but signals overshoot/undershoot.
    return Math.max(-0.02, Math.min(1.05, raw))
  }

  return {
    past:      0,
    tolerable: project(tol),
    goal:      project(gol),
    wish:      project(wsh),
    status:    project(cur),
    targetRef,
    inverted,
  }
}

/**
 * Progress-bar fill fraction = where Status projects onto the axis (0..1.05).
 * Returns null when Status is unparseable — caller renders the "unknown"
 * dashed gray bar instead.
 */
function progressFraction(
  status:    string,
  tolerable: string,
  goal:      string,
  wish?:     string
): number | null {
  const ax = axisProjection(status, tolerable, goal, wish)
  return ax.status
}

// ── Tag preview (≈ 42 chars of Scale, wrapped onto 2 lines) ──────────────────
function scaleLines(scale: string): string[] {
  if (!scale) return ['(no Scale)']
  const trimmed = scale.trim().replace(/\s+/g, ' ')
  return wrapLines(trimmed, 42, 2)
}

function levelShort(level: string): string {
  if (!level) return '—'
  const t = level.trim().replace(/\s+/g, ' ')
  return t.length > 18 ? t.slice(0, 17) + '…' : t
}

// ── Per-arrow data for the template loops ────────────────────────────────────
const valueArrows = computed(() => values.value.map((v, i) => {
  const ax = axisProjection(v.status, v.tolerable, v.goal, v.wish)
  return {
    ...v,
    y:               rowY(i, values.value.length),
    rawStatus:       v.status,                            // preserve raw before override
    status:          statusForEntry(v.status, v.tolerable, v.goal),
    progressFrac:    ax.status,                           // null when Status unparseable
    axisTolFrac:    ax.tolerable,                        // marker positions = stakeholder-set numerics
    axisGoalFrac:   ax.goal,
    axisWishFrac:   ax.wish,
    scaleLines:     scaleLines(v.scale),
    tolerableShort: levelShort(v.tolerable),
    targetLabel:    v.wish ? 'Wish' : 'Goal',
    targetShort:    levelShort(v.wish || v.goal),
    isPlaceholder:  false,
  }
}))

interface ResourceArrowRow {
  id: string
  description: string
  scale: string
  status: string
  rawStatus: string
  tolerable: string
  goal: string
  wish?: string
  y: number
  statusBand: Status
  /** Status projected onto Past→Target axis. null when unparseable. */
  progressFrac: number | null
  /** Tolerable marker position on the axis (0..1.05). null when unparseable. */
  axisTolFrac:  number | null
  axisGoalFrac: number | null
  axisWishFrac: number | null
  scaleLines: string[]
  tolerableShort: string
  targetLabel: string
  targetShort: string
  isPlaceholder: boolean
}

const resourceArrows = computed<ResourceArrowRow[]>(() =>
  effectiveResources.value.map((r, i) => {
    const isPh   = (r as PlaceholderRow).isPlaceholder === true
    const budget = isPh ? r.goal : rBudget(r)   // placeholder rows use .goal directly
    const ax     = axisProjection(r.status, r.tolerable, budget, r.wish)
    return {
      id:             r.id,
      description:    r.description,
      scale:          r.scale,
      status:         r.status,
      rawStatus:      r.status,
      tolerable:      r.tolerable,
      goal:           budget,       // ForkInfo.goal = the commitment level (Budget)
      wish:           r.wish,
      y:              rowY(i, effectiveResources.value.length),
      statusBand:     statusForEntry(r.status, r.tolerable, budget),
      progressFrac:   ax.status,
      axisTolFrac:    ax.tolerable,
      axisGoalFrac:   ax.goal,
      axisWishFrac:   ax.wish,
      scaleLines:     scaleLines(r.scale),
      tolerableShort: levelShort(r.tolerable),
      // Tom Gilb 2026-06-07: Resources are constrained by Budget, not Goaled.
      // rBudgetLabel() returns "Deadline" / "Headcount" / "Budget" per resourceKind.
      targetLabel:    isPh ? 'Budget' : rBudgetLabel(r),
      targetShort:    levelShort(r.wish || budget),
      isPlaceholder:  isPh,
    }
  })
)

// ── Diagram header data ──────────────────────────────────────────────────────
const versionStr  = computed(() => planModel.value?.version ? `v${planModel.value.version}` : 'v0.1')
const dateTimeStr = computed(() => {
  const now = new Date()
  const d = now.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  const t = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  return `${d} · ${t}`
})
const evoFootnote = computed(() => {
  const n = props.evoStepsDelivered ?? 0
  return n === 0 ? 'Evo steps delivered = 0 · Initial Plan' : `Evo steps delivered = ${n}`
})

// Whether the rendered left side is generic placeholders (no real R. entries in spec).
const usingPlaceholderResources = computed(() => resources.value.length === 0)

// ── Colored-zone palette (Tom Gilb 2026-06-06 r12 fix) ──────────────────────
//
// Tom verbatim: "re is no colored bar relative to the numbers".  The earlier
// rendering used a single gray shaft + a status-coloured progress fill that
// stopped at Status's projected position.  When Status was unknown (the
// common case in raw specs) the bar showed nothing relative to the actual
// Tolerable / Goal / Wish numerics.  Tom's fix: paint the SHAFT itself as
// three colored ZONES whose widths reflect the stakeholder-set numeric
// positions of Tolerable + Goal (+ Wish).  Status, if known, becomes a
// separate dark marker on top — the colored zones do the geometric heavy
// lifting whether or not Status has been measured.
//
// Zone semantics — applies to BOTH Value and Resource forks:
//
//   • Red   (#fecaca): Past origin → Tolerable position
//     Values:    Performance below minimum acceptable → project failure.
//     Resources: Allocation below minimum floor → cannot deliver committed targets.
//
//   • Amber (#fde68a): Tolerable → Budget/Goal position
//     Values:    Alive but below committed target.
//     Resources: At minimum floor, below official Budget (tight but viable).
//
//   • Green (#bbf7d0): Budget/Goal → end (Wish or shaft end)
//     Values:    At or above committed target (Success Range).
//     Resources: At or above official Budget (adequately funded).
//
// Tom Gilb 2026-06-07: Resource Tolerable = MINIMUM allocation for non-failure.
// NOT a maximum consumption cap. Consumption (Status) is a historical fact tracked
// separately. The zones reflect the ALLOCATION axis, not a spending-limit axis.
// Bands are pastels so the Status marker + tick marks remain visible.

const ZONE_RED   = '#fecaca'   // red-200
const ZONE_AMBER = '#fde68a'   // amber-200
const ZONE_GREEN = '#bbf7d0'   // green-200
const ZONE_GRAY  = '#e2e8f0'   // slate-200 — used when axis is degenerate

// ── Hover + click info-window state (Tom Gilb 2026-06-06 r12 NEW idea) ─────
//
// Tom verbatim: "new Multiforks idea, sort of like the live action value flow,
// when cursor over a fork, some info window opens, and if we click a larger
// info window full detail about the spec comes up".
//
// Hover yields a small floating preview card anchored near the cursor.
// Click opens a full-detail modal with the canonical Planguage entry.

interface ForkInfo {
  id:               string
  description:      string
  scale:            string
  status:           string
  tolerable:        string
  goal:             string   // for resource entries: holds the Budget value (rBudget)
  wish?:            string
  meter?:           string
  side:             'value' | 'resource'
  /** Resource entries: "Budget" | "Deadline" | "Headcount". Undefined for Value entries. */
  budgetLabel?:     string
  statusBand:       Status
  axisTolFrac:      number | null
  axisGoalFrac:     number | null
  axisWishFrac:     number | null
  progressFrac:     number | null
  isPlaceholder:    boolean
}

const hoveredFork  = ref<ForkInfo | null>(null)
const hoverPos     = ref<{ x: number; y: number } | null>(null)
const clickedFork  = ref<ForkInfo | null>(null)

function onForkEnter(info: ForkInfo, ev: MouseEvent): void {
  hoveredFork.value = info
  hoverPos.value    = { x: ev.clientX, y: ev.clientY }
}
function onForkMove(ev: MouseEvent): void {
  if (hoveredFork.value) hoverPos.value = { x: ev.clientX, y: ev.clientY }
}
function onForkLeave(): void {
  hoveredFork.value = null
  hoverPos.value    = null
}
function onForkClick(info: ForkInfo): void {
  clickedFork.value = info
  // Also clear the hover card so it doesn't sit on top of the modal.
  hoveredFork.value = null
  hoverPos.value    = null
}
function closeDetail(): void {
  clickedFork.value = null
}

// Position the hover card so it never overflows the viewport.
const hoverCardStyle = computed(() => {
  const pos = hoverPos.value
  if (!pos) return { display: 'none' }
  const CARD_W = 320
  const CARD_H = 220
  const MARGIN = 12
  const desiredLeft = pos.x + 16
  const maxLeft     = window.innerWidth - CARD_W - MARGIN
  const clampedLeft = Math.max(MARGIN, Math.min(desiredLeft, maxLeft))
  const desiredTop  = pos.y + 16
  const maxTop      = window.innerHeight - CARD_H - MARGIN
  const clampedTop  = Math.max(MARGIN, Math.min(desiredTop, maxTop))
  return {
    left: `${clampedLeft}px`,
    top:  `${clampedTop}px`,
  }
})

// ── Term definition hover (Planguage concept labels in SVG) ──────────────────
// Tom Gilb 2026-06-07: "all these new definitions as Info, either on request,
// or on hovering over the concept. But, in direct connection with this tool."
// When the user hovers any level label in the SVG (Tolerable / Goal / Budget /
// Wish / Wish?) a canonical Glossary definition card appears near the cursor.
// The handler receives the correct PlanguageTerm object for the context
// (value side → PLANGUAGE_TERMS.*; resource side → RESOURCE_ALLOCATION_TERMS.*).
//
// 400ms intentional-hover delay (Tom 2026-06-07 feedback: "annoying in Fork
// when the Concept Definitions were triggered") — quick cursor passes over a
// label while reading the diagram do NOT trigger the card; only a deliberate
// pause does.
const hoveredTerm     = ref<PlanguageTerm | null>(null)
const termHoverPos    = ref<{ x: number; y: number } | null>(null)
let   termHoverTimer: ReturnType<typeof setTimeout> | null = null

function onTermEnter(term: PlanguageTerm, ev: MouseEvent): void {
  termHoverPos.value = { x: ev.clientX, y: ev.clientY }
  termHoverTimer = setTimeout(() => { hoveredTerm.value = term }, 400)
}
function onTermMove(ev: MouseEvent): void {
  // Keep the card tracking the cursor but only after it has shown.
  if (hoveredTerm.value) termHoverPos.value = { x: ev.clientX, y: ev.clientY }
}
function onTermLeave(): void {
  if (termHoverTimer) { clearTimeout(termHoverTimer); termHoverTimer = null }
  hoveredTerm.value  = null
  termHoverPos.value = null
}

// ── Stale-card cleanup (Bug 2026-06-07) ──────────────────────────────────────
// The two hover Teleports (term card + fork card) sit at the component's
// TEMPLATE ROOT LEVEL, outside the <div v-if="open"> wrapper.  When the panel
// closes, Vue removes the inner panel DOM but the Teleport state refs
// (hoveredFork, hoveredTerm) keep their values, leaving the cards rendered on
// <body> as ghosts.  Fix: watch open + onUnmounted to flush all hover state
// the instant the panel leaves the screen.
function clearAllHovers(): void {
  if (termHoverTimer) { clearTimeout(termHoverTimer); termHoverTimer = null }
  hoveredTerm.value  = null
  termHoverPos.value = null
  hoveredFork.value  = null
  hoverPos.value     = null
}

watch(() => props.open, (isOpen) => { if (!isOpen) clearAllHovers() })

// Viewport-clamped position for the term card.
// Appears ABOVE the cursor (so it doesn't hide the SVG label underneath).
const termCardStyle = computed(() => {
  const pos = termHoverPos.value
  if (!pos) return { display: 'none' }
  const W = 340, H = 210, M = 12
  const left = Math.max(M, Math.min(pos.x + 20, window.innerWidth  - W - M))
  const top  = Math.max(M, Math.min(pos.y - H - 14, window.innerHeight - H - M))
  return { left: `${left}px`, top: `${top}px` }
})

// Helper: short pretty Planguage threshold display (≈ 26 chars, for cards).
function thresholdDisplayLong(level: string): string {
  if (!level) return '—'
  const t = level.trim().replace(/\s+/g, ' ')
  return t.length > 32 ? t.slice(0, 31) + '…' : t
}

// ── Goal-validity heuristic evaluation (Tom Gilb 2026-06-06 doctrine) ──────
// A proposed level becomes an official GOAL only when ALL 7 Glossary
// conditions hold.  SEM should auto-check what it can; the rest surface as
// questions to the user.  This is a HEURISTIC: limits of static analysis
// mean some `auto` rows still need user confirmation.
type ConditionVerdict = 'pass' | 'fail' | 'unknown' | 'manual'

function evaluateGoalCondition(
  condName: string,
  goalText: string,
  hasTolerable: boolean,
  hasWish: boolean
): ConditionVerdict {
  // Only a tiny static evaluation — full evaluation needs cross-spec context
  // (Budget vs Resource entries, V/C ratio, Global Priority, etc.) which is
  // out of scope for this in-panel checker.  We mark manual/unknown for
  // judgement-requiring conditions so the user sees the checklist as a
  // teaching artefact, not a false-confidence dashboard.
  switch (condName) {
    case 'Conditions true': {
      // Heuristic: does the Goal text include a [...] qualifier?
      if (!goalText) return 'unknown'
      return /\[.+\]/.test(goalText) ? 'pass' : 'fail'
    }
    case 'Cost-consistent':
      // Needs Budget / R. entries cross-check — surface as MANUAL until SEM
      // can run the OPTIMA-style balance check (queued for a later iteration).
      return 'manual'
    case 'Profitable':
      // Needs V/C ratio context from the IET. MANUAL for now.
      return 'manual'
    case 'Prioritised':
      // SEM has a Global Priority surface but we can't read it from inside
      // this isolated panel cheaply. Mark MANUAL.
      return 'manual'
    default:
      // Technically possible · Economically possible · Effective — all
      // require domain judgement.
      return 'manual'
  }
}

function verdictBadge(v: ConditionVerdict): { bg: string; fg: string; label: string } {
  if (v === 'pass')    return { bg: '#10b981', fg: '#ffffff', label: 'PASS' }
  if (v === 'fail')    return { bg: '#ef4444', fg: '#ffffff', label: 'FAIL' }
  if (v === 'manual')  return { bg: '#475569', fg: '#ffffff', label: 'MANUAL' }
  return                       { bg: '#94a3b8', fg: '#ffffff', label: '?' }
}

// Map per-arrow row → ForkInfo for event handlers.
// Both Value and Resource rows carry the same shape needed by the cards
// (we read fields, never write).  Use loose typing here — Vue templates pass
// the row directly to onForkEnter / onForkClick.
function makeValueForkInfo(v: ReturnType<typeof valueArrows.value['map']>[number] | typeof valueArrows.value[number]): ForkInfo {
  return {
    id:            v.id,
    description:   v.description,
    scale:         v.scale,
    status:        v.rawStatus,                 // raw Status string from spec
    tolerable:     v.tolerable,
    goal:          v.goal,
    wish:          v.wish,
    meter:         v.meter,
    side:          'value',
    statusBand:    v.status as Status,           // computed band
    axisTolFrac:   v.axisTolFrac,
    axisGoalFrac:  v.axisGoalFrac,
    axisWishFrac:  v.axisWishFrac,
    progressFrac:  v.progressFrac,
    isPlaceholder: v.isPlaceholder,
  }
}
function makeResourceForkInfo(r: ResourceArrowRow): ForkInfo {
  return {
    id:            r.id,
    description:   r.description,
    scale:         r.scale,
    status:        r.rawStatus,
    tolerable:     r.tolerable,
    goal:          r.goal,   // holds Budget value (rBudget) from resourceArrows computed
    wish:          r.wish,
    side:          'resource',
    budgetLabel:   r.targetLabel,   // "Budget" | "Deadline" | "Headcount"
    statusBand:    r.statusBand,
    axisTolFrac:   r.axisTolFrac,
    axisGoalFrac:  r.axisGoalFrac,
    axisWishFrac:  r.axisWishFrac,
    progressFrac:  r.progressFrac,
    isPlaceholder: r.isPlaceholder,
  }
}

// Esc key closes the detail modal.
function onEsc(ev: KeyboardEvent): void {
  if (ev.key === 'Escape' && clickedFork.value) closeDetail()
}
onMounted(() => window.addEventListener('keydown', onEsc))
onUnmounted(() => window.removeEventListener('keydown', onEsc))
</script>

<template>
  <Teleport to="body">
    <Transition name="mf-fade">
      <div v-if="open" class="fixed inset-0 z-[700]">
        <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" @click="emit('close')" />
        <section
          class="absolute inset-2 md:inset-6 lg:inset-8 rounded-2xl bg-white shadow-2xl
                 ring-1 ring-slate-200 flex flex-col overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-label="MultiForks — System fork diagram"
        >
          <!-- Header -->
          <header class="flex items-start justify-between gap-3 px-6 py-3 bg-gradient-to-br from-indigo-700 to-violet-700 text-white">
            <div class="min-w-0">
              <h2 class="text-lg font-extrabold tracking-tight">🔱 MultiForks</h2>
              <p class="text-[12px] text-indigo-100">
                  Resources → Solutions → Values · live diagram
              </p>
            </div>
            <div class="flex items-center gap-4 text-[11px] text-indigo-100">
              <span><b>System:</b> {{ systemName }}</span>
              <span><b>Version:</b> {{ versionStr }}</span>
              <span><b>Time:</b> {{ dateTimeStr }}</span>
              <span><b>Balance:</b> <span class="text-white font-bold">{{ balanceScore }}%</span></span>
            </div>
            <CloseDot size="lg" @click="emit('close')" />
          </header>

          <!-- Body — SVG diagram -->
          <!-- width="100%" makes the SVG fill the full panel width at any screen
               size; the viewBox + preserveAspectRatio scale the internal
               coordinate system proportionally.  This replaces the fixed
               SVG_WIDTH=1240 so the diagram uses ALL available space. -->
          <ScrollContainer class="flex-1 min-h-0 px-4 py-3 bg-slate-50">
            <svg :viewBox="`0 0 ${SVG_WIDTH} ${svgHeight}`" width="100%"
                 class="block mx-auto bg-white rounded-xl shadow-inner"
                 preserveAspectRatio="xMidYMid meet">

              <!-- ── Resource arrows (left, point INTO oval) ───────────────────
                   Tom r03 fix: markers (Tolerable / Goal / Wish) now sit at
                   their NUMERIC POSITIONS along the Past→Target axis — not at
                   fixed 0.45 / 0.85 of the shaft.  Position = (value − Past) /
                   (Target − Past).  See axisProjection() in <script>. -->
              <g v-for="r in resourceArrows" :key="`r-${r.id}`"
                 style="cursor: pointer;"
                 @mouseenter="onForkEnter(makeResourceForkInfo(r), $event)"
                 @mousemove="onForkMove($event)"
                 @mouseleave="onForkLeave()"
                 @click="onForkClick(makeResourceForkInfo(r))">
                <!-- Invisible hit-zone covering the whole arrow for hover/click -->
                <rect
                  :x="LEFT_X - 4"
                  :y="r.y - 36"
                  :width="OVAL_CX - OVAL_RX - 6 - LEFT_X + 8"
                  height="76"
                  fill="transparent"
                />
                <!-- ── Colored ZONES for Resource bars ──────────────────────────────────
                     Inverted axis: LEFT = high consumption (bad), RIGHT = low (good)
                     Logical sequence left→right: Tolerable → Budget → Wish
                       (worst-acceptable → committed-limit → aspirational-minimum)
                     Zone semantics mirror Value bars (worse left, better right):
                       Red   : 0 → Tolerable — exceeds max acceptable (failure)
                       Amber : Tolerable → Budget — over budget, still tolerable
                       Green : Budget → end — within committed limit (success)
                -->
                <!-- Gray shaft fallback when no thresholds parse -->
                <line v-if="r.axisTolFrac == null && r.axisGoalFrac == null"
                  :x1="LEFT_X" :y1="r.y" :x2="OVAL_CX - OVAL_RX - 6" :y2="r.y"
                  :stroke="ZONE_GRAY" stroke-width="14" stroke-linecap="round" />
                <!-- Red zone: 0 → Tolerable (exceeds maximum acceptable) -->
                <line v-if="r.axisTolFrac != null"
                  :x1="LEFT_X" :y1="r.y"
                  :x2="LEFT_X + (OVAL_CX - OVAL_RX - 6 - LEFT_X) * r.axisTolFrac" :y2="r.y"
                  :stroke="ZONE_RED" stroke-width="14" stroke-linecap="round" />
                <!-- Amber zone: Tolerable → Budget (over budget, still acceptable) -->
                <line v-if="r.axisTolFrac != null && r.axisGoalFrac != null"
                  :x1="LEFT_X + (OVAL_CX - OVAL_RX - 6 - LEFT_X) * r.axisTolFrac" :y1="r.y"
                  :x2="LEFT_X + (OVAL_CX - OVAL_RX - 6 - LEFT_X) * Math.min(r.axisGoalFrac, 1)" :y2="r.y"
                  :stroke="ZONE_AMBER" stroke-width="14" stroke-linecap="butt" />
                <!-- Green zone: Budget → end (within committed limit) -->
                <line v-if="r.axisGoalFrac != null"
                  :x1="LEFT_X + (OVAL_CX - OVAL_RX - 6 - LEFT_X) * r.axisGoalFrac" :y1="r.y"
                  :x2="OVAL_CX - OVAL_RX - 6" :y2="r.y"
                  :stroke="ZONE_GREEN" stroke-width="14" stroke-linecap="round" />
                <!-- Status indicator (only when Status is parseable) — dark vertical bar + diamond -->
                <g v-if="r.progressFrac != null">
                  <line
                    :x1="LEFT_X + (OVAL_CX - OVAL_RX - 6 - LEFT_X) * r.progressFrac" :y1="r.y - 10"
                    :x2="LEFT_X + (OVAL_CX - OVAL_RX - 6 - LEFT_X) * r.progressFrac" :y2="r.y + 10"
                    stroke="#0f172a" stroke-width="3" stroke-linecap="round" />
                  <polygon
                    :points="`${LEFT_X + (OVAL_CX - OVAL_RX - 6 - LEFT_X) * r.progressFrac - 5},${r.y - 14} ${LEFT_X + (OVAL_CX - OVAL_RX - 6 - LEFT_X) * r.progressFrac + 5},${r.y - 14} ${LEFT_X + (OVAL_CX - OVAL_RX - 6 - LEFT_X) * r.progressFrac},${r.y - 4}`"
                    fill="#0f172a" />
                </g>
                <!-- Arrowhead: teal for real R. entries, slate for placeholders -->
                <polygon
                  :points="`${OVAL_CX - OVAL_RX - 6},${r.y} ${OVAL_CX - OVAL_RX - 20},${r.y - 9} ${OVAL_CX - OVAL_RX - 20},${r.y + 9}`"
                  :fill="r.isPlaceholder ? '#64748b' : '#0f766e'"
                />
                <!-- ID label -->
                <text :x="LEFT_X" :y="r.y - 22" font-size="12" font-weight="800"
                      :fill="r.isPlaceholder ? '#64748b' : '#0f766e'">{{ r.id }}</text>
                <!-- Badge: 'placeholder' for generic scaffolding -->
                <g v-if="r.isPlaceholder">
                  <rect :x="LEFT_X + 116" :y="r.y - 34" width="78" height="14" rx="3" fill="#475569" />
                  <text :x="LEFT_X + 155" :y="r.y - 24" text-anchor="middle"
                        font-size="8" font-weight="800" fill="#ffffff">placeholder</text>
                </g>
                <!-- Scale tag (2 lines) — offset from +26 → +36 to give space below threshold value text at +22 -->
                <text v-for="(line, li) in r.scaleLines" :key="`r-scale-${r.id}-${li}`"
                      :x="LEFT_X" :y="r.y + 36 + li * 12" font-size="10" fill="#475569">
                  {{ li === 0 ? 'Scale: ' + line : '   ' + line }}
                </text>
                <!-- Benchmark (always at fraction 0, the Past origin) -->
                <g font-size="9" fill="#334155">
                  <text :x="LEFT_X + 6" :y="r.y - 6" font-weight="600">Benchmark</text>
                  <text :x="LEFT_X + 6" :y="r.y + 14">—</text>
                </g>
                <!-- Tolerable marker at its NUMERIC position -->
                <g v-if="r.axisTolFrac != null" font-size="9" fill="#334155">
                  <!-- Tick mark at the actual position -->
                  <line
                    :x1="LEFT_X + (OVAL_CX - OVAL_RX - 6 - LEFT_X) * r.axisTolFrac"
                    :y1="r.y - 10"
                    :x2="LEFT_X + (OVAL_CX - OVAL_RX - 6 - LEFT_X) * r.axisTolFrac"
                    :y2="r.y + 10"
                    stroke="#92400e"
                    stroke-width="2"
                  />
                  <text :x="LEFT_X + (OVAL_CX - OVAL_RX - 6 - LEFT_X) * r.axisTolFrac"
                        :y="r.y - 14" text-anchor="middle"
                        font-weight="700" fill="#92400e" cursor="help"
                        @mouseenter="onTermEnter(RESOURCE_ALLOCATION_TERMS.TolerableResource, $event)"
                        @mousemove="onTermMove"
                        @mouseleave="onTermLeave">Tolerable</text>
                  <text :x="LEFT_X + (OVAL_CX - OVAL_RX - 6 - LEFT_X) * r.axisTolFrac"
                        :y="r.y + 22" text-anchor="middle">{{ r.tolerableShort }}</text>
                </g>
                <!-- Budget marker at its NUMERIC position
                     Tom Gilb 2026-06-07: Resources are constrained, never "Goaled".
                     Generic label = Budget. Future: Deadline (time) / Headcount (people)
                     when REntry.resourceKind field is added to the schema. -->
                <g v-if="r.axisGoalFrac != null" font-size="9" fill="#334155">
                  <line
                    :x1="LEFT_X + (OVAL_CX - OVAL_RX - 6 - LEFT_X) * r.axisGoalFrac"
                    :y1="r.y - 10"
                    :x2="LEFT_X + (OVAL_CX - OVAL_RX - 6 - LEFT_X) * r.axisGoalFrac"
                    :y2="r.y + 10"
                    stroke="#0f766e"
                    stroke-width="2"
                  />
                  <text :x="LEFT_X + (OVAL_CX - OVAL_RX - 6 - LEFT_X) * r.axisGoalFrac"
                        :y="r.y - 14" text-anchor="middle"
                        font-weight="700" fill="#0f766e" cursor="help"
                        @mouseenter="onTermEnter(RESOURCE_ALLOCATION_TERMS.Budget, $event)"
                        @mousemove="onTermMove"
                        @mouseleave="onTermLeave">{{ r.targetLabel }}</text>
                  <text v-if="r.wish"
                        :x="LEFT_X + (OVAL_CX - OVAL_RX - 6 - LEFT_X) * r.axisGoalFrac"
                        :y="r.y + 22" text-anchor="middle">{{ levelShort(r.goal) /* r.goal = budget value in ResourceArrowRow */ }}</text>
                  <text v-else
                        :x="LEFT_X + (OVAL_CX - OVAL_RX - 6 - LEFT_X) * r.axisGoalFrac"
                        :y="r.y + 22" text-anchor="middle">{{ r.targetShort }}</text>
                </g>
                <!-- Wish marker (only when present) at its NUMERIC position -->
                <g v-if="r.axisWishFrac != null && r.wish" font-size="9" fill="#334155">
                  <line
                    :x1="LEFT_X + (OVAL_CX - OVAL_RX - 6 - LEFT_X) * r.axisWishFrac"
                    :y1="r.y - 10"
                    :x2="LEFT_X + (OVAL_CX - OVAL_RX - 6 - LEFT_X) * r.axisWishFrac"
                    :y2="r.y + 10"
                    stroke="#5b21b6"
                    stroke-width="2"
                  />
                  <text :x="LEFT_X + (OVAL_CX - OVAL_RX - 6 - LEFT_X) * r.axisWishFrac"
                        :y="r.y - 14" text-anchor="middle"
                        font-weight="700" fill="#5b21b6" cursor="help"
                        @mouseenter="onTermEnter(RESOURCE_ALLOCATION_TERMS.ResourceWish, $event)"
                        @mousemove="onTermMove"
                        @mouseleave="onTermLeave">Wish</text>
                  <text :x="LEFT_X + (OVAL_CX - OVAL_RX - 6 - LEFT_X) * r.axisWishFrac"
                        :y="r.y + 22" text-anchor="middle">{{ r.targetShort }}</text>
                </g>
                <!-- Status badge (wider so labels don't truncate) -->
                <rect :x="OVAL_CX - OVAL_RX - 116" :y="r.y - 44" width="110" height="16" rx="4"
                      :fill="statusColor(r.statusBand)" />
                <text :x="OVAL_CX - OVAL_RX - 61" :y="r.y - 33" text-anchor="middle"
                      font-size="9" font-weight="800" fill="#ffffff">{{ statusLabel(r.statusBand, 'resource') }}</text>
              </g>

              <!-- ── Solutions rectangle (drawn AFTER resource arrows so it covers stray
                   text from the leftmost arrow ends) ─────────────────────────────
                   Tom Gilb 2026-06-06: "remove the Oval, and put a colorful rectangle
                   there (the icon for solutions!) and inside the rectangle, all the
                   Solutions, with arrows out to right (inside the rectangle)."
                   Semantic: Resources fund Solutions → Solutions deliver Values. -->
              <rect
                :x="OVAL_CX - OVAL_RX"
                :y="ovalCy - OVAL_RY"
                :width="OVAL_RX * 2"
                :height="OVAL_RY * 2"
                rx="14"
                fill="#ea580c"
                stroke="#c2410c"
                stroke-width="2"
              />
              <!-- "SOLUTIONS" header title -->
              <text :x="OVAL_CX" :y="ovalCy - OVAL_RY + 20"
                    text-anchor="middle" font-size="14" font-weight="900"
                    fill="#ffffff" letter-spacing="1">SOLUTIONS</text>
              <!-- System name -->
              <text :x="OVAL_CX" :y="ovalCy - OVAL_RY + 36"
                    text-anchor="middle" font-size="10" fill="#ffedd5">{{ systemName }}</text>
              <!-- Version · Date-Time stamp -->
              <text :x="OVAL_CX" :y="ovalCy - OVAL_RY + 50"
                    text-anchor="middle" font-size="9" fill="#fed7aa">{{ versionStr }} · {{ dateTimeStr }}</text>
              <!-- Balance score -->
              <text :x="OVAL_CX" :y="ovalCy - OVAL_RY + 66"
                    text-anchor="middle" font-size="12" font-weight="800" fill="#fef08a">Balance {{ balanceScore }}%</text>
              <!-- Separator line -->
              <line
                :x1="OVAL_CX - OVAL_RX + 14" :y1="ovalCy - OVAL_RY + 76"
                :x2="OVAL_CX + OVAL_RX - 14" :y2="ovalCy - OVAL_RY + 76"
                stroke="#c2410c" stroke-width="1.5"
              />
              <!-- Per-Solution rows — Tom: "all the Solutions, with arrows out to right" -->
              <g v-if="solutions.length > 0">
                <g v-for="(s, si) in solutions" :key="`rect-s-${s.id}`">
                  <text
                    :x="OVAL_CX - OVAL_RX + 18"
                    :y="ovalCy - OVAL_RY + 93 + si * 26"
                    font-size="10"
                  >
                    <tspan fill="#ffedd5" font-weight="900">→ </tspan>
                    <tspan font-weight="800" fill="#ffffff">{{ s.id }}</tspan>
                    <tspan fill="#fed7aa" font-style="italic">  {{ (s.description || s.impact || '').slice(0, 26) }}</tspan>
                  </text>
                </g>
              </g>
              <g v-else>
                <text :x="OVAL_CX" :y="ovalCy + 8"
                      text-anchor="middle" font-size="10" fill="#ffedd5" font-style="italic">No Solution entries yet</text>
                <text :x="OVAL_CX" :y="ovalCy + 22"
                      text-anchor="middle" font-size="9" fill="#fed7aa">Add Solution entries to your Spec</text>
              </g>

              <!-- ── Value arrows (right, emanate FROM oval) ──────────────────── -->
              <g v-for="v in valueArrows" :key="`v-${v.id}`"
                 style="cursor: pointer;"
                 @mouseenter="onForkEnter(makeValueForkInfo(v), $event)"
                 @mousemove="onForkMove($event)"
                 @mouseleave="onForkLeave()"
                 @click="onForkClick(makeValueForkInfo(v))">
                <!-- Invisible hit-zone -->
                <rect
                  :x="OVAL_CX + OVAL_RX + 2"
                  :y="v.y - 36"
                  :width="RIGHT_X - OVAL_CX - OVAL_RX - 2"
                  height="76"
                  fill="transparent"
                />
                <!-- Gray shaft fallback when no thresholds parse -->
                <line v-if="v.axisTolFrac == null && v.axisGoalFrac == null"
                  :x1="OVAL_CX + OVAL_RX + 6" :y1="v.y" :x2="RIGHT_X" :y2="v.y"
                  :stroke="ZONE_GRAY" stroke-width="14" stroke-linecap="round" />
                <!-- Red zone: 0 → Tolerable -->
                <line v-if="v.axisTolFrac != null"
                  :x1="OVAL_CX + OVAL_RX + 6" :y1="v.y"
                  :x2="(OVAL_CX + OVAL_RX + 6) + (RIGHT_X - (OVAL_CX + OVAL_RX + 6)) * v.axisTolFrac" :y2="v.y"
                  :stroke="ZONE_RED" stroke-width="14" stroke-linecap="round" />
                <!-- Amber zone: Tolerable → Goal -->
                <line v-if="v.axisTolFrac != null && v.axisGoalFrac != null"
                  :x1="(OVAL_CX + OVAL_RX + 6) + (RIGHT_X - (OVAL_CX + OVAL_RX + 6)) * v.axisTolFrac" :y1="v.y"
                  :x2="(OVAL_CX + OVAL_RX + 6) + (RIGHT_X - (OVAL_CX + OVAL_RX + 6)) * Math.min(v.axisGoalFrac, 1)" :y2="v.y"
                  :stroke="ZONE_AMBER" stroke-width="14" stroke-linecap="butt" />
                <!-- Green zone: Goal → end -->
                <line v-if="v.axisGoalFrac != null"
                  :x1="(OVAL_CX + OVAL_RX + 6) + (RIGHT_X - (OVAL_CX + OVAL_RX + 6)) * v.axisGoalFrac" :y1="v.y"
                  :x2="RIGHT_X" :y2="v.y"
                  :stroke="ZONE_GREEN" stroke-width="14" stroke-linecap="round" />
                <!-- Status indicator -->
                <g v-if="v.progressFrac != null">
                  <line
                    :x1="(OVAL_CX + OVAL_RX + 6) + (RIGHT_X - (OVAL_CX + OVAL_RX + 6)) * v.progressFrac" :y1="v.y - 10"
                    :x2="(OVAL_CX + OVAL_RX + 6) + (RIGHT_X - (OVAL_CX + OVAL_RX + 6)) * v.progressFrac" :y2="v.y + 10"
                    stroke="#0f172a" stroke-width="3" stroke-linecap="round" />
                  <polygon
                    :points="`${(OVAL_CX + OVAL_RX + 6) + (RIGHT_X - (OVAL_CX + OVAL_RX + 6)) * v.progressFrac - 5},${v.y - 14} ${(OVAL_CX + OVAL_RX + 6) + (RIGHT_X - (OVAL_CX + OVAL_RX + 6)) * v.progressFrac + 5},${v.y - 14} ${(OVAL_CX + OVAL_RX + 6) + (RIGHT_X - (OVAL_CX + OVAL_RX + 6)) * v.progressFrac},${v.y - 4}`"
                    fill="#0f172a" />
                </g>
                <polygon
                  :points="`${RIGHT_X},${v.y} ${RIGHT_X - 14},${v.y - 9} ${RIGHT_X - 14},${v.y + 9}`"
                  fill="#7c3aed"
                />
                <text :x="RIGHT_X" :y="v.y - 22" text-anchor="end" font-size="12" font-weight="800" fill="#7c3aed">{{ v.id }}</text>
                <!-- Description below ID — Tom recognises his entries by description, not just ID -->
                <text v-if="v.description" :x="RIGHT_X" :y="v.y - 8" text-anchor="end" font-size="9"
                      font-style="italic" fill="#6d28d9">{{ v.description.slice(0, 36) }}</text>
                <!-- Scale tag (2 lines) — starts at +40 to clear level-label text (y+14) + numeric (y+26) below shaft -->
                <text v-for="(line, li) in v.scaleLines" :key="`v-scale-${v.id}-${li}`"
                      :x="OVAL_CX + OVAL_RX + 10" :y="v.y + 40 + li * 12" font-size="10" fill="#475569">
                  {{ li === 0 ? 'Scale: ' + line : '   ' + line }}
                </text>
                <!-- Benchmark at the Past origin -->
                <g font-size="9" fill="#334155">
                  <text :x="OVAL_CX + OVAL_RX + 10" :y="v.y - 6" font-weight="600">Benchmark</text>
                  <text :x="OVAL_CX + OVAL_RX + 10" :y="v.y + 14">—</text>
                </g>
                <!-- Tolerable marker at its NUMERIC position -->
                <g v-if="v.axisTolFrac != null" font-size="9" fill="#334155">
                  <line
                    :x1="(OVAL_CX + OVAL_RX + 6) + (RIGHT_X - (OVAL_CX + OVAL_RX + 6)) * v.axisTolFrac"
                    :y1="v.y - 10"
                    :x2="(OVAL_CX + OVAL_RX + 6) + (RIGHT_X - (OVAL_CX + OVAL_RX + 6)) * v.axisTolFrac"
                    :y2="v.y + 10"
                    stroke="#92400e"
                    stroke-width="2"
                  />
                  <!-- Label BELOW shaft (v.y + 14) — avoids collision with V.ID
                       (v.y - 22) and description (v.y - 8) at the right end. -->
                  <text :x="(OVAL_CX + OVAL_RX + 6) + (RIGHT_X - (OVAL_CX + OVAL_RX + 6)) * v.axisTolFrac"
                        :y="v.y + 14" text-anchor="middle"
                        font-weight="700" fill="#92400e" cursor="help"
                        @mouseenter="onTermEnter(PLANGUAGE_TERMS.Tolerable, $event)"
                        @mousemove="onTermMove"
                        @mouseleave="onTermLeave">Tolerable</text>
                  <text :x="(OVAL_CX + OVAL_RX + 6) + (RIGHT_X - (OVAL_CX + OVAL_RX + 6)) * v.axisTolFrac"
                        :y="v.y + 26" text-anchor="middle">{{ v.tolerableShort }}</text>
                </g>
                <!-- Goal marker at its NUMERIC position -->
                <g v-if="v.axisGoalFrac != null" font-size="9" fill="#334155">
                  <line
                    :x1="(OVAL_CX + OVAL_RX + 6) + (RIGHT_X - (OVAL_CX + OVAL_RX + 6)) * v.axisGoalFrac"
                    :y1="v.y - 10"
                    :x2="(OVAL_CX + OVAL_RX + 6) + (RIGHT_X - (OVAL_CX + OVAL_RX + 6)) * v.axisGoalFrac"
                    :y2="v.y + 10"
                    stroke="#7c3aed"
                    stroke-width="2"
                  />
                  <text :x="(OVAL_CX + OVAL_RX + 6) + (RIGHT_X - (OVAL_CX + OVAL_RX + 6)) * v.axisGoalFrac"
                        :y="v.y + 14" text-anchor="middle"
                        font-weight="700" fill="#7c3aed" cursor="help"
                        @mouseenter="onTermEnter(PLANGUAGE_TERMS.Goal, $event)"
                        @mousemove="onTermMove"
                        @mouseleave="onTermLeave">Goal</text>
                  <text :x="(OVAL_CX + OVAL_RX + 6) + (RIGHT_X - (OVAL_CX + OVAL_RX + 6)) * v.axisGoalFrac"
                        :y="v.y + 26" text-anchor="middle">{{ levelShort(v.goal) }}</text>
                </g>
                <!-- Wish marker — real numeric position when Wish is in spec -->
                <g v-if="v.axisWishFrac != null && v.wish" font-size="9" fill="#334155">
                  <line
                    :x1="(OVAL_CX + OVAL_RX + 6) + (RIGHT_X - (OVAL_CX + OVAL_RX + 6)) * v.axisWishFrac"
                    :y1="v.y - 10"
                    :x2="(OVAL_CX + OVAL_RX + 6) + (RIGHT_X - (OVAL_CX + OVAL_RX + 6)) * v.axisWishFrac"
                    :y2="v.y + 10"
                    stroke="#5b21b6"
                    stroke-width="2"
                  />
                  <text :x="(OVAL_CX + OVAL_RX + 6) + (RIGHT_X - (OVAL_CX + OVAL_RX + 6)) * v.axisWishFrac"
                        :y="v.y + 14" text-anchor="middle"
                        font-weight="700" fill="#5b21b6" cursor="help"
                        @mouseenter="onTermEnter(PLANGUAGE_TERMS.Wish, $event)"
                        @mousemove="onTermMove"
                        @mouseleave="onTermLeave">Wish</text>
                  <text :x="(OVAL_CX + OVAL_RX + 6) + (RIGHT_X - (OVAL_CX + OVAL_RX + 6)) * v.axisWishFrac"
                        :y="v.y + 26" text-anchor="middle">{{ v.targetShort }}</text>
                </g>
                <!-- Symbolic Wish indicator — shown when NO Wish is in the spec.
                     Tom Gilb 2026-06-07: "add Wish in symbolically to right of (more
                     than) Goal." Position: Goal + 12% clamped to 96% of shaft.
                     Style: dashed violet tick — communicates the CONCEPT and teaches
                     that a Wish can exist at any level beyond (or below) the Goal.
                     A Wish can be converted to a Goal of same or different magnitude;
                     new Wishes can emerge even after a Goal is committed. -->
                <g v-if="!v.wish && v.axisGoalFrac != null" font-size="8">
                  <line
                    :x1="(OVAL_CX + OVAL_RX + 6) + (RIGHT_X - (OVAL_CX + OVAL_RX + 6)) * Math.min(0.96, v.axisGoalFrac + 0.12)"
                    :y1="v.y - 8"
                    :x2="(OVAL_CX + OVAL_RX + 6) + (RIGHT_X - (OVAL_CX + OVAL_RX + 6)) * Math.min(0.96, v.axisGoalFrac + 0.12)"
                    :y2="v.y + 8"
                    stroke="#8b5cf6" stroke-width="1.5" stroke-dasharray="3 2" stroke-linecap="round" />
                  <text
                    :x="(OVAL_CX + OVAL_RX + 6) + (RIGHT_X - (OVAL_CX + OVAL_RX + 6)) * Math.min(0.96, v.axisGoalFrac + 0.12)"
                    :y="v.y + 14" text-anchor="middle"
                    font-weight="600" fill="#8b5cf6" font-style="italic" cursor="help"
                    @mouseenter="onTermEnter(PLANGUAGE_TERMS.Wish, $event)"
                    @mousemove="onTermMove"
                    @mouseleave="onTermLeave">Wish?</text>
                  <text
                    :x="(OVAL_CX + OVAL_RX + 6) + (RIGHT_X - (OVAL_CX + OVAL_RX + 6)) * Math.min(0.96, v.axisGoalFrac + 0.12)"
                    :y="v.y + 26" text-anchor="middle"
                    fill="#a78bfa" font-style="italic">none stated</text>
                </g>
                <rect :x="OVAL_CX + OVAL_RX + 6" :y="v.y - 44" width="110" height="16" rx="4"
                      :fill="statusColor(v.status)" />
                <text :x="OVAL_CX + OVAL_RX + 61" :y="v.y - 33" text-anchor="middle"
                      font-size="9" font-weight="800" fill="#ffffff">{{ statusLabel(v.status, 'value') }}</text>
              </g>

              <!-- Footer annotation -->
              <text :x="OVAL_CX" :y="svgHeight - 30" text-anchor="middle"
                    font-size="12" font-weight="700" fill="#475569">{{ evoFootnote }}</text>
              <text v-if="usingPlaceholderResources" :x="OVAL_CX" :y="svgHeight - 12" text-anchor="middle"
                    font-size="10" font-style="italic" fill="#64748b">
                Resource forks above are PLACEHOLDERS — add Resource entries to your Spec for real data.
              </text>
            </svg>

            <p v-if="values.length === 0 && resources.length === 0"
               class="text-center text-sm text-slate-500 italic mt-4">
              No Value or Resource entries in the current Spec yet — diagram shows placeholders.
            </p>
          </ScrollContainer>

          <!-- Footer -->
          <footer class="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
            <div class="text-[11px] text-slate-500 italic flex-1">
              MultiForks v2 (r04) ·
              Values: <span class="text-emerald-700 font-bold">Green</span> = Goal met ·
              <span class="text-amber-700 font-bold">Amber</span> = Tolerable range ·
              <span class="text-red-700 font-bold">Red</span> = below minimum ·
              Resources: <span class="text-emerald-700 font-bold">Green</span> = at/above Budget ·
              <span class="text-amber-700 font-bold">Amber</span> = Tolerable to Budget ·
              <span class="text-red-700 font-bold">Red</span> = below min allocation ·
              <span class="text-slate-500 font-bold">Gray</span> = Status unknown.
              Hover any fork for details · click for full definition + doctrine.
            </div>
            <button
              type="button"
              class="px-4 py-2 rounded-lg bg-slate-700 text-white font-semibold text-sm hover:bg-slate-800
                     focus:outline-none focus:ring-2 focus:ring-slate-400"
              @click="emit('close')"
            >Done</button>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>

  <!-- ── Term definition hover card ────────────────────────────────────────────
       Tom Gilb 2026-06-07: "I would like to see all these new definitions as
       Info, either on request, or on hovering over the concept. But, in direct
       connection with this tool."
       Appears when hovering any Planguage level label in the SVG (Tolerable /
       Goal / Budget / Deadline / Headcount / Wish / Wish?).  Shows the
       canonical Glossary definition from usePlanguageTerms so the planner
       learns in-context while reading the diagram.
       z-index 9998 = below the fork hover card (9000) … wait, above — term
       card and fork card should not both show at once because term labels only
       appear BETWEEN arrows, not on the bar itself. Both are pointer-events-none
       so they cannot block clicks. -->
  <Teleport to="body">
    <div
      v-if="hoveredTerm && termHoverPos"
      class="fixed z-[9999] pointer-events-none rounded-xl border border-violet-600/50 bg-gray-900 shadow-2xl"
      style="width:340px;padding:12px 16px;"
      :style="termCardStyle"
      role="tooltip"
      aria-live="polite"
    >
      <div class="flex items-center gap-2 mb-1">
        <span class="font-mono text-[15px] font-bold text-violet-300">{{ hoveredTerm.keyedIcon }}</span>
        <span class="text-[13px] font-extrabold text-white">{{ hoveredTerm.name }}</span>
        <span class="font-mono text-[10px] text-violet-400 ml-1">{{ hoveredTerm.conceptNumber }}</span>
      </div>
      <p class="text-[10px] font-bold uppercase tracking-wide text-amber-300 mb-1.5">{{ hoveredTerm.role }}</p>
      <p class="text-[11px] leading-snug text-slate-200">{{ hoveredTerm.tooltipFull }}</p>
      <p class="mt-2 text-[9px] italic text-slate-400">Click the arrow bar for full definition &amp; checklist</p>
    </div>
  </Teleport>

  <!-- ── Hover preview card (Tom Gilb 2026-06-06 r12 NEW idea) ───────────────
       Small floating card anchored to the cursor.  Mirrors the live-action
       Value Flow pattern Tom referenced.  Teleported to body + fixed
       position with viewport-clamped coords (see hoverCardStyle). -->
  <Teleport to="body">
    <Transition name="mf-hover">
      <div
        v-if="hoveredFork && hoverPos"
        class="fixed z-[9000] pointer-events-none w-[320px] max-w-[320px] rounded-xl bg-slate-900/95 backdrop-blur-sm text-white shadow-2xl border border-slate-700 px-3 py-2.5 space-y-1.5"
        :style="hoverCardStyle"
        role="tooltip"
        aria-live="polite"
      >
        <div class="flex items-center gap-2">
          <span class="text-[10px] font-extrabold uppercase tracking-wide"
                :class="hoveredFork.side === 'value' ? 'text-violet-300' : 'text-orange-300'">
            {{ hoveredFork.side === 'value' ? 'VALUE' : 'RESOURCE' }}
          </span>
          <span class="text-[12px] font-extrabold text-white">{{ hoveredFork.id }}</span>
          <span v-if="hoveredFork.isPlaceholder"
                class="ml-auto text-[8px] font-bold uppercase tracking-wide bg-slate-600 text-slate-100 rounded px-1.5 py-0.5">placeholder</span>
        </div>
        <p class="text-[11px] text-slate-200 leading-snug">{{ hoveredFork.description || '(no description)' }}</p>
        <p class="text-[10px] text-slate-400 leading-snug"><b>Scale:</b> {{ thresholdDisplayLong(hoveredFork.scale) }}</p>
        <div class="grid grid-cols-3 gap-1 text-[10px] mt-1">
          <div class="rounded bg-amber-200/15 border border-amber-300/40 px-1.5 py-1">
            <div class="text-amber-300 font-bold uppercase text-[8px]">
              <PlanguageTermWidget
                :term="hoveredFork.side === 'resource' ? 'Tolerable (Resource)' : 'Tolerable'"
                class="text-amber-300 font-bold uppercase text-[8px] no-underline"
                :show-icon="false"
              />
            </div>
            <div class="text-white font-semibold text-[10px] leading-tight">{{ thresholdDisplayLong(hoveredFork.tolerable) }}</div>
          </div>
          <div class="rounded bg-emerald-200/15 border border-emerald-300/40 px-1.5 py-1">
            <div class="text-emerald-300 font-bold uppercase text-[8px]">
              <PlanguageTermWidget
                :term="hoveredFork.side === 'resource' ? (hoveredFork.budgetLabel ?? 'Budget') : 'Goal'"
                class="text-emerald-300 font-bold uppercase text-[8px] no-underline"
                :show-icon="false"
              />
            </div>
            <div class="text-white font-semibold text-[10px] leading-tight">{{ thresholdDisplayLong(hoveredFork.goal) }}</div>
          </div>
          <div class="rounded bg-violet-200/15 border border-violet-300/40 px-1.5 py-1">
            <div class="text-violet-300 font-bold uppercase text-[8px]">
              <PlanguageTermWidget
                term="Wish"
                class="text-violet-300 font-bold uppercase text-[8px] no-underline"
                :show-icon="false"
              />
            </div>
            <div class="text-white font-semibold text-[10px] leading-tight">{{ thresholdDisplayLong(hoveredFork.wish || '') }}</div>
          </div>
        </div>
        <div class="flex items-center gap-2 pt-1 border-t border-slate-700">
          <span class="text-[10px] text-slate-400">Status:</span>
          <span v-if="hoveredFork.status" class="text-[10px] font-semibold text-white">{{ thresholdDisplayLong(hoveredFork.status) }}</span>
          <span v-else class="text-[10px] italic text-slate-500">not measured yet</span>
          <span class="ml-auto inline-block px-1.5 py-0.5 rounded text-[8px] font-bold text-white"
                :style="`background:${statusColor(hoveredFork.statusBand)}`">
            {{ statusLabel(hoveredFork.statusBand, hoveredFork.side) }}
          </span>
        </div>
        <div class="text-[9px] text-slate-500 italic pt-1">click for full detail</div>
      </div>
    </Transition>
  </Teleport>

  <!-- ── Click detail modal (Tom Gilb 2026-06-06 r12 NEW idea) ───────────────
       Full Planguage entry detail.  Backdrop click + Escape + close button
       all dismiss.  Teleported to body, z-[9100] so it sits above the hover
       card AND above the MultiForks panel itself. -->
  <Teleport to="body">
    <Transition name="mf-fade">
      <div v-if="clickedFork" class="fixed inset-0 z-[9100] flex items-center justify-center p-4"
           role="dialog" aria-modal="true" aria-labelledby="mf-detail-title">
        <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="closeDetail" />
        <div class="relative w-full max-w-xl rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 overflow-hidden flex flex-col max-h-[88vh]">
          <header class="flex items-start gap-3 px-5 py-3 text-white"
                  :style="`background: linear-gradient(135deg, ${clickedFork.side === 'value' ? '#7c3aed' : '#c2410c'} 0%, #1e293b 100%)`">
            <div class="flex-1 min-w-0">
              <div class="text-[10px] font-extrabold uppercase tracking-widest opacity-80">
                {{ clickedFork.side === 'value' ? 'VALUE ENTRY' : 'RESOURCE ENTRY' }}
              </div>
              <h3 id="mf-detail-title" class="text-lg font-extrabold tracking-tight">{{ clickedFork.id }}</h3>
              <p class="text-[11px] opacity-90 mt-0.5">{{ clickedFork.description || '(no description)' }}</p>
            </div>
            <button type="button" class="shrink-0 h-8 w-8 rounded-full bg-white/15 hover:bg-white/30 text-white text-lg font-bold flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-white/60"
                    aria-label="Close detail" title="Close (Esc)"
                    @click="closeDetail">×</button>
          </header>
          <ScrollContainer outer-class="relative overflow-hidden flex-1 min-h-0"
                           inner-class="px-5 py-4 space-y-3"
                           :no-pill="false">
            <div class="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 space-y-1">
              <div class="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Planguage</div>
              <p class="text-[12px] text-gray-800"><b>Scale:</b> {{ clickedFork.scale || '—' }}</p>
              <p v-if="clickedFork.meter" class="text-[12px] text-gray-800"><b>Meter:</b> {{ clickedFork.meter }}</p>
            </div>
            <!-- ── Tolerable / Budget|Goal / Wish — context-sensitive cards ──────
                 Value entries: classic STG performance axis (Tolerable = min performance).
                 Resource entries: Allocation axis (Tolerable = min allocation for non-failure;
                   Budget = official allocation; Wish = stakeholder-desired allocation).
                 Tom Gilb 2026-06-07: "IT IS THE MINIMUM RESOURCE ALLOCATED OR AVAILABLE
                 FOR CONSUMPTION, THAT WILL NOT CAUSE A STATE OR DEGREE OF FAILURE." -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <!-- Tolerable card -->
              <div class="rounded-lg border-2 border-amber-300 bg-amber-50 px-3 py-2">
                <div class="text-[10px] font-extrabold text-amber-800 uppercase tracking-wide flex items-center gap-1">
                  Tolerable
                  <span class="font-mono opacity-60 text-[9px]" :title="keyedLevelHoverHint('tolerable')">&gt;&gt;</span>
                </div>
                <div class="text-[13px] font-bold text-gray-900 mt-0.5 leading-tight">{{ clickedFork.tolerable || '—' }}</div>
                <!-- Value: performance floor · Resource: allocation floor -->
                <p v-if="clickedFork.side === 'value'"
                   class="text-[9px] text-amber-700 italic mt-1">
                  Minimum non-failure performance level · below this the project fails.
                </p>
                <p v-else
                   class="text-[9px] text-amber-700 italic mt-1">
                  Minimum allocation for non-failure · below this the system cannot deliver its targets.
                  NOT a consumption limit — consumption is a historical fact.
                </p>
              </div>
              <!-- Goal (Value) / Budget (Resource) card -->
              <div class="rounded-lg border-2 border-emerald-300 bg-emerald-50 px-3 py-2">
                <div class="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wide flex items-center gap-1">
                  {{ clickedFork.side === 'resource' ? (clickedFork.budgetLabel ?? 'Budget') : 'Goal' }}
                  <span class="font-mono opacity-60 text-[9px]" :title="keyedLevelHoverHint(clickedFork.side === 'resource' ? 'budget' : 'goal')">&gt;</span>
                </div>
                <div class="text-[13px] font-bold text-gray-900 mt-0.5 leading-tight">{{ clickedFork.goal || '—' }}</div>
                <p v-if="clickedFork.side === 'value'"
                   class="text-[9px] text-emerald-700 italic mt-1">
                  Committed promise Target · valid only when 7 Glossary conditions hold.
                </p>
                <p v-else
                   class="text-[9px] text-emerald-700 italic mt-1">
                  Official resource allocation · the committed resource envelope.
                  Should be at or above the Tolerable floor.
                </p>
              </div>
              <!-- Wish card -->
              <div class="rounded-lg border-2 border-violet-300 bg-violet-50 px-3 py-2">
                <div class="text-[10px] font-extrabold text-violet-800 uppercase tracking-wide flex items-center gap-1">
                  Wish
                  <span class="font-mono opacity-60 text-[9px]" :title="keyedLevelHoverHint('wish')">&gt;?</span>
                </div>
                <div class="text-[13px] font-bold text-gray-900 mt-0.5 leading-tight">{{ clickedFork.wish || '—' }}</div>
                <p v-if="clickedFork.side === 'value'"
                   class="text-[9px] text-violet-700 italic mt-1">
                  Stakeholder-articulated target · uncommitted · sits anywhere on the scale.
                </p>
                <p v-else
                   class="text-[9px] text-violet-700 italic mt-1">
                  Stakeholder-desired allocation · uncommitted · can be either side of Budget.
                  Optional — if no stakeholder expressed a Wish, there is none to record.
                </p>
              </div>
            </div>
            <div class="rounded-lg border border-slate-300 bg-white px-3 py-2">
              <div class="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Current Status</div>
              <div v-if="clickedFork.status" class="text-[13px] font-bold text-gray-900 mt-0.5">{{ clickedFork.status }}</div>
              <div v-else class="text-[11px] italic text-slate-500 mt-0.5">No Status recorded yet · the bar shows the spec structure but cannot place Status.</div>
              <div class="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
                   :style="`background:${statusColor(clickedFork.statusBand)}`">
                {{ statusLabel(clickedFork.statusBand, clickedFork.side) }}
              </div>
            </div>
            <!-- ── Resource Budget Doctrine (Tom Gilb 2026-06-07) ─────────────
                 Shown ONLY for Resource entries. Explains the 4-level allocation
                 model: Tolerable floor → Budget commitment → Wish aspiration → Ideal.
                 Replaces the Goal Validity Conditions panel (which applies to Values only). -->
            <div v-if="clickedFork.side === 'resource'"
                 class="rounded-lg border border-orange-300 bg-orange-50/60 px-3 py-2 space-y-2">
              <div class="flex items-center gap-2">
                <span class="text-[10px] font-extrabold uppercase tracking-wide text-orange-800">Resource Allocation Levels</span>
                <span class="text-[10px] text-orange-700">· Tom Gilb 2026-06-07</span>
              </div>
              <p class="text-[10px] text-orange-900 italic leading-snug">
                Resources are governed by an <b>allocation axis</b>, not a performance axis. Consumption (Status / Now) is a separate historical fact — not a plan.
              </p>
              <div class="space-y-1">
                <div v-for="level in [
                  { label: 'Tolerable >>', colour: '#d97706', bg: '#fef3c7', text: RESOURCE_ALLOCATION_TERMS.TolerableResource.shortDef },
                  { label: (clickedFork.budgetLabel ?? 'Budget') + ' >', colour: '#15803d', bg: '#dcfce7', text: RESOURCE_ALLOCATION_TERMS.Budget.shortDef },
                  { label: 'Wish >?', colour: '#7c3aed', bg: '#ede9fe', text: RESOURCE_ALLOCATION_TERMS.ResourceWish.shortDef },
                  { label: 'Ideal >*', colour: '#0369a1', bg: '#e0f2fe', text: RESOURCE_ALLOCATION_TERMS.ResourceIdeal.shortDef },
                ]" :key="level.label"
                     class="flex items-start gap-2 rounded px-2 py-1.5 border border-orange-100"
                     :style="`background:${level.bg}`">
                  <span class="shrink-0 text-[9px] font-extrabold rounded px-1.5 py-0.5 mt-0.5 text-white"
                        :style="`background:${level.colour}`">{{ level.label }}</span>
                  <div class="text-[10px] text-gray-800 leading-snug">{{ level.text }}</div>
                </div>
              </div>
              <p class="text-[9px] text-slate-500 italic">
                Ideal = what's needed to reach ALL Value Targets given current Solutions — derived by Claudian, not entered directly. Glossary entry "Ideal (for Resources)" proposed 2026-06-07.
              </p>
            </div>

            <!-- ── Goal Validity Conditions (Tom Gilb 2026-06-06 doctrine) ──
                 A proposed level becomes an OFFICIAL Goal only when ALL 7
                 Glossary conditions hold.  SEM auto-checks what it can; the
                 rest surface as MANUAL with the canonical explanation.  This
                 panel TEACHES the discipline whether or not the conditions
                 are met. Shown only for Value entries (not Resource entries). -->
            <div v-if="clickedFork.goal && clickedFork.side === 'value'" class="rounded-lg border border-emerald-300 bg-emerald-50/60 px-3 py-2 space-y-2">
              <div class="flex items-center gap-2">
                <span class="text-[10px] font-extrabold uppercase tracking-wide text-emerald-800">Goal Validity</span>
                <span class="font-mono text-[10px] text-emerald-700">&gt;</span>
                <span class="text-[10px] text-emerald-700">· 7 Glossary conditions (Goal *109)</span>
              </div>
              <p class="text-[10px] text-emerald-900 italic leading-snug">
                A level becomes an <b>official Goal</b> only when ALL 7 conditions hold.  A Goal cannot be set in isolation — it must balance against all other Values, Resources, and competing stakeholders (OPTIMA discipline).
              </p>
              <div class="space-y-1">
                <div v-for="cond in GOAL_VALIDITY_CONDITIONS" :key="cond.name"
                     class="flex items-start gap-2 rounded bg-white border border-emerald-200 px-2 py-1.5">
                  <span class="shrink-0 text-[8px] font-extrabold rounded px-1.5 py-0.5 mt-0.5"
                        :style="`background:${verdictBadge(evaluateGoalCondition(cond.name, clickedFork.goal, clickedFork.tolerable !== '', clickedFork.wish != null && clickedFork.wish !== '')).bg};color:${verdictBadge(evaluateGoalCondition(cond.name, clickedFork.goal, clickedFork.tolerable !== '', clickedFork.wish != null && clickedFork.wish !== '')).fg}`">
                    {{ verdictBadge(evaluateGoalCondition(cond.name, clickedFork.goal, clickedFork.tolerable !== '', clickedFork.wish != null && clickedFork.wish !== '')).label }}
                  </span>
                  <div class="flex-1 min-w-0">
                    <div class="text-[11px] font-bold text-gray-800 leading-tight">{{ cond.name }}</div>
                    <div class="text-[10px] text-gray-600 leading-snug">{{ cond.meaning }}</div>
                  </div>
                </div>
              </div>
              <p class="text-[10px] text-slate-500 italic">
                MANUAL verdicts need stakeholder judgement.  The Cost-consistent / Profitable / Prioritised checks are queued for a future OPTIMA-style auto-evaluator.
              </p>
            </div>

            <!-- Wish position note — context-sensitive.
                 Value side: always shown (symbolic Wish marker appears even when no Wish in spec).
                 Resource side: shown only when a Wish is explicitly stated. -->
            <div v-if="clickedFork.side === 'value' || clickedFork.wish"
                 class="rounded-lg border border-violet-300 bg-violet-50/60 px-3 py-2 text-[10px] text-violet-900 italic leading-snug">
              <template v-if="clickedFork.side === 'value'">
                <b>Wish &gt;? (Value):</b>
                the Wish is whatever the stakeholder articulated — it can sit ANYWHERE on the scale
                (optimistic OR pessimistic), not automatically above Goal.
                If no stakeholder has articulated a Wish, there is none to record — the dashed
                <span class="text-violet-600 font-semibold not-italic">Wish?</span> marker
                on the arrow shows where one could naturally sit, to prompt the conversation.
                <span class="block mt-1 not-italic font-medium text-violet-800">
                  Conversion: a Wish can become a Goal of the SAME or a DIFFERENT magnitude —
                  the negotiated Goal level may be higher or lower than the Wish, depending on
                  what passes the 7 Goal-validity conditions given resources and competing
                  stakeholders. (Tom Gilb 2026-06-07.)
                </span>
                <span class="block mt-1 not-italic font-medium text-violet-800">
                  Living spec: new Wishes can emerge AFTER a Goal is committed — as conditions
                  change, new information arrives, or post-delivery insights surface.
                  New Wishes become candidates for future Evo Step Goals.
                  (Tom Gilb 2026-06-07; Glossary Wish *244.)
                </span>
              </template>
              <template v-else>
                <b>Wish &gt;? (Resource):</b> a stakeholder's desired allocation — uncommitted.
                Can be ABOVE or BELOW the official Budget. A Wish above Budget signals the
                stakeholder perceives under-resourcing; below Budget suggests potential
                over-allocation. Tom Gilb 2026-06-07: "If no stakeholder expresses a Wish,
                then none need be specified." (Resource Wish *244.)
                <span class="block mt-1 not-italic font-medium text-violet-800">
                  Conversion: a Resource Wish can be converted to a Budget of the SAME or
                  DIFFERENT magnitude once the 7 Goal-validity conditions are met.
                  New Resource Wishes can emerge even after an official Budget is committed.
                </span>
              </template>
            </div>

            <div v-if="clickedFork.isPlaceholder" class="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-[11px] text-slate-600 italic">
              This is a PLACEHOLDER Resource — the current Spec has no Resource entries, so MultiForks rendered three defaults so the diagram still shows the fork pattern. Add R. entries to your Spec for real data.
            </div>
          </ScrollContainer>
          <footer class="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
            <button type="button"
                    class="px-4 py-2 rounded-lg bg-slate-700 text-white font-semibold text-sm hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
                    @click="closeDetail">Close</button>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.mf-fade-enter-active { animation: mf-in 220ms cubic-bezier(0.22, 1, 0.36, 1) both; }
.mf-fade-leave-active { animation: mf-in 180ms cubic-bezier(0.7, 0, 0.84, 0) reverse both; }
@keyframes mf-in {
  from { opacity: 0; transform: scale(0.98); }
  to   { opacity: 1; transform: scale(1); }
}
.mf-hover-enter-active,
.mf-hover-leave-active { transition: opacity 120ms ease, transform 120ms ease; }
.mf-hover-enter-from,
.mf-hover-leave-to { opacity: 0; transform: translateY(4px); }
</style>
