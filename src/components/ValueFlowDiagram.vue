<!--
  ValueFlowDiagram.vue — shared diagram body for the 6-column causal Value Flow.
  Renders the legend bar, SVG diagram, and footer note with no modal wrapper.
  Used by ValueFlowPanel.vue (inside its modal shell) and
  VisualisePanelModal.vue (directly inside the 'flow' tab).

  Props match ValueFlowPanel:
    spec        — current SpecBlock
    evoSteps    — confirmed EvoStep[]
    tasksByStep — task lists keyed by step name (pass {} when steps are unknown)

  SVG marker IDs use the "vfd-" prefix to avoid collisions when multiple diagram
  SVGs coexist in the DOM (though exclusive-surface rules prevent that in practice).
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import type { SpecBlock } from '../types/spec'
import type { EvoStep } from '../types/evo-plan'
import type { TaskSuggestion } from '../types/task'
import type { ImpactMatrix } from '../types/impact'
import { extractAllStakeholders } from '../utils/stakeholderExtract'

const props = defineProps<{
  spec:        SpecBlock
  evoSteps:    EvoStep[]
  tasksByStep: Record<string, TaskSuggestion[]>
  /**
   * Impact matrix from the V/C Ratios table — impactMatrix[valueId][solutionId] = percent.
   * Used as the PRIMARY source for Solution→Value (col 2→3) edges.
   * When omitted (Impact Estimation stage not yet reached), the diagram falls back
   * to text-based heuristics (s.impact V.* parsing + shared F.* link chain).
   * Tom 2026-05-17: "DATABASE REDUNDANCY IS CLEARLY CONNECTED IN THE VDT TO MANY VALUES,
   * BUT IT SHOWS NO CONNECTION IN THE VALUE DIAGRAM — USE THE VDT DATA."
   */
  impactMatrix?: ImpactMatrix
  /**
   * When set, the matching node (by specId) is rendered with a distinct amber
   * "origin" highlight so the user can see which entry they navigated from.
   * Tom 2026-05-15: "add a distinct color to the exact item we clicked to get there."
   */
  highlightedEntryId?: string
  /**
   * Thumbnail mode — suppresses the headline, legend bar, and footer note so only
   * the bare SVG is rendered. Used by SpecEditorPanel's live mini-diagram strip.
   */
  thumbnail?: boolean
  /**
   * Fit-container mode — the SVG scales proportionally to fill its parent element
   * rather than using fixed pixel dimensions. Used by ValueFlowPanel (full-screen).
   * When true: SVG is width/height="100%" with preserveAspectRatio="xMidYMid meet";
   * the legend bar and footer note are hidden to maximise diagram space.
   * Tom 2026-05-18: "enlarge the diagram to fit the screen."
   */
  fitContainer?: boolean
}>()

const emit = defineEmits<{
  /** Emitted when the user clicks the ↗ glyph on a S./V./F. node.
   *  Parent should open the spec editor at that tab + entry. */
  'node-click': [{ tab: 'functions' | 'values' | 'solutions'; entryId: string }]
  /** Emitted when the user clicks the ⬡ glyph on a S./V./F. node.
   *  Parent opens the Spec Direct Relations view for that entry. */
  'node-relations-click': [{ tab: 'functions' | 'values' | 'solutions' | 'evo-steps'; entryId: string }]
  /** Emitted when the user clicks any Task node (ci=0).
   *  Parent should navigate to the Task Decomposition stage. */
  'go-to-tasks': []
}>()

// ── Layout constants (all in SVG px units) ────────────────────────────────────
const COL_W    = 158
const COL_GAP  = 56
const NODE_H   = 44
const NODE_GAP = 8
const H_PAD    = 20
const V_PAD    = 42
const STRIDE   = COL_W + COL_GAP  // 214

// ── Column style table ────────────────────────────────────────────────────────
interface ColDef {
  label:      string
  nodeFill:   string
  nodeStroke: string
  textFill:   string
  subFill:    string
  hdrFill:    string
  lineFill:   string
}

// Canonical spec-type colours — agreed 2026-05-16, Kai swap ratified same day.
// Source of truth: src/constants/specTypeColors.ts
// Value=Violet · Function=Green · Solution=Orange · Evo Step=Amber · Task=Slate · Stakeholder=Blue
const COLS: ColDef[] = [
  { label: 'TASKS',        nodeFill: '#f9fafb', nodeStroke: '#d1d5db', textFill: '#111827', subFill: '#6b7280', hdrFill: '#374151', lineFill: '#6b7280' },
  { label: 'EVO STEPS',    nodeFill: '#fefce8', nodeStroke: '#fde047', textFill: '#713f12', subFill: '#facc15', hdrFill: '#ca8a04', lineFill: '#facc15' },
  { label: 'SOLUTIONS',    nodeFill: '#fff7ed', nodeStroke: '#fdba74', textFill: '#9a3412', subFill: '#fb923c', hdrFill: '#ea580c', lineFill: '#fb923c' },
  { label: 'VALUES',       nodeFill: '#f5f3ff', nodeStroke: '#c4b5fd', textFill: '#5b21b6', subFill: '#a78bfa', hdrFill: '#7c3aed', lineFill: '#a78bfa' },
  { label: 'FUNCTIONS',    nodeFill: '#f0fdf4', nodeStroke: '#86efac', textFill: '#166534', subFill: '#4ade80', hdrFill: '#16a34a', lineFill: '#4ade80' },
  { label: 'STAKEHOLDERS', nodeFill: '#eff6ff', nodeStroke: '#93c5fd', textFill: '#1e40af', subFill: '#60a5fa', hdrFill: '#2563eb', lineFill: '#60a5fa' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function trunc(s: string | null | undefined, max: number): string {
  if (!s) return ''
  return s.length <= max ? s : s.slice(0, max - 1) + '…'
}

function parseFnIds(text: string | null | undefined): string[] {
  return [...new Set((text ?? '').split(/[,;]+/).map(s => s.trim()).filter(Boolean))]
}
/** Parse all Value IDs mentioned in free text (e.g. SEntry.impact field). */
function parseValIds(text: string | null | undefined, knownIds: string[] = []): string[] {
  if (!text) return []
  if (knownIds.length > 0) {
    // New format: plain-word IDs — find known value IDs that appear as substrings in the text
    return [...new Set(knownIds.filter(id => text.includes(id)))]
  }
  // Legacy fallback: old V.* prefix format
  return [...new Set(text.match(/V\.\w+/g) ?? [])]
}

/**
 * Words meaningful enough to use as correlation signals.
 * Filters short functional words and domain-generic verbs so only semantically
 * significant nouns/adjectives drive keyword matching (Tier 2/3.5 analysis).
 */
const STOP_WORDS = new Set([
  'that', 'this', 'with', 'from', 'have', 'will', 'been', 'they', 'their', 'there',
  'when', 'which', 'should', 'would', 'could', 'ensure', 'provide', 'enable', 'support',
  'within', 'system', 'using', 'based', 'across', 'through', 'achieve', 'target',
  'improve', 'allows', 'allow', 'makes', 'every', 'given', 'where', 'value', 'function',
  'solution', 'stakeholder', 'requirement', 'level', 'shall', 'must', 'needs',
])
function getSignificantWords(text: string | null | undefined): Set<string> {
  if (!text) return new Set()
  return new Set(
    text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
      .filter(w => w.length >= 5 && !STOP_WORDS.has(w))
  )
}

const specText = computed<string>(() => [
  ...props.spec.functions.map(f => `${f.description} ${f.presenceTest ?? f.successCriteria ?? ''} ${f.functionOfValue}`),
  ...props.spec.values.map(v => `${v.description} ${v.scale} ${v.valueOfFunction}`),
  ...props.spec.solutions.map(s => `${s.description} ${s.impact} ${s.function}`),
].join(' '))

// ── Node type ─────────────────────────────────────────────────────────────────
interface FlowNode {
  id:      string
  label:   string
  sub?:    string
  colour?: string
  empty?:  boolean
  /** Actual spec entry ID (e.g. "F.BookingSystem") — present for S./V./F. columns. */
  specId?: string
  /** Spec editor tab to open when clicked — mirrors the specId column. */
  tab?:    'functions' | 'values' | 'solutions'
  /** Task node has no effort hours or assignee (AI-suggested, not yet planned).
   *  Rendered with dashed border + "◌ suggested" sub label.
   *  Tom 2026-05-16: "Suggested, not planned effort and assignee." */
  suggested?: boolean
}

// ── Interactivity ─────────────────────────────────────────────────────────────
/** ID of the node currently under the mouse, or null. Drives hover visuals. */
const hoveredNodeId = ref<string | null>(null)

/**
 * Task focus state — Tom 2026-05-16:
 * "display the first priority evo step with its tasks, then if we click on another
 *  one, it goes to the enlarged focus of that step with its tasks, and when we go
 *  back to overall display, that recent set of tasks (recent interest tasks) is then
 *  displayed. That would be elegant and cool."
 *
 * focusedStepName holds the LAST step the user explicitly clicked.
 * effectiveFocusStep falls back to the first evo step when nothing is focused.
 */
const focusedStepName = ref<string | null>(null)
/**
 * selectedNodeId — tracks which F/V/S node the user first-clicked.
 * Two-stage intent pattern (mirrors the evo-step focusedStepName model):
 *   First click  → select (indigo ring, no SDR)
 *   Second click → open SDR and clear selection
 * Prevents accidental SDR opens from casual browsing/hover-click.
 * Tom 2026-05-28: "spec direct jumped out, fix stability."
 */
const selectedNodeId = ref<string | null>(null)

const effectiveFocusStep = computed<string | null>(() => {
  const steps = props.evoSteps
  if (!steps.length) return null
  if (focusedStepName.value && steps.some(s => s.name === focusedStepName.value)) {
    return focusedStepName.value
  }
  return steps[0].name   // default: first (highest-priority) step
})

// ── Hover-connection highlighting ─────────────────────────────────────────────
/**
 * Col/row of the currently hovered node — drives edge & node spotlight.
 * Tom 2026-05-18: "when we hover over a spec, show its relationship with bigger
 * arrows, hide all other arrows."
 */
const hoveredColRow = computed<{ col: number; row: number } | null>(() => {
  if (!hoveredNodeId.value) return null
  const id = hoveredNodeId.value
  const cn = colNodes.value
  for (let ci = 0; ci < cn.length; ci++) {
    const ni = cn[ci].findIndex(n => n.id === id)
    if (ni >= 0) return { col: ci, row: ni }
  }
  return null
})

/**
 * Set of node IDs that are directly connected to the hovered node (neighbours),
 * plus the hovered node itself. Used to spotlight connected nodes and dim the rest.
 * NOTE: references `edges.value` which is defined after this computed in the file —
 * this is safe because computed getters are lazy and only run at render time, by
 * which point all setup declarations have executed.
 */
const hoveredConnectedNodeIds = computed<Set<string>>(() => {
  const h = hoveredColRow.value
  if (!h) return new Set()
  const cn = colNodes.value
  const s = new Set<string>()
  const selfId = cn[h.col]?.[h.row]?.id
  if (selfId) s.add(selfId)
  edges.value.forEach(e => {
    // Crossing (fallback fan) edges are NOT clear relations — exclude them from the
    // spotlight set so their target nodes are correctly dimmed during hover.
    // Tom 2026-05-18: "Do not show arrow if there is not a clear relation."
    if (e.crossing) return
    const fId = cn[e.fromCol]?.[e.fromIdx]?.id
    const tId = cn[e.toCol  ]?.[e.toIdx  ]?.id
    if (e.fromCol === h.col && e.fromIdx === h.row && tId) s.add(tId)
    if (e.toCol   === h.col && e.toIdx   === h.row && fId) s.add(fId)
  })
  return s
})

/**
 * True when edge e is directly connected to the currently hovered node AND is
 * a clear/explicit relation. Fallback fan edges (crossing=true) always return
 * false so they fade to near-invisible during hover and no big arrowhead is shown.
 * Tom 2026-05-18: "Do not show arrow if there is not a clear relation."
 */
function isEdgeConnected(e: FlowEdge): boolean {
  if (e.crossing) return false   // fallback fan — not a clear relation
  const h = hoveredColRow.value
  if (!h) return false
  return (e.fromCol === h.col && e.fromIdx === h.row) ||
         (e.toCol   === h.col && e.toIdx   === h.row)
}

/** Returns true when this column's nodes are clickable (S./V./F. — direct spec entries). */
function isClickable(ci: number, node: FlowNode): boolean {
  return (ci === 2 || ci === 3 || ci === 4) && !node.empty
}

/**
 * Tom 2026-05-15 redesign:
 *  • Click the TAG chip (specId + ✎) → opens Spec Editor  (node-click)
 *  • Click anywhere else in the rectangle → opens SDR      (node-relations-click)
 * The tag <g> uses @click.stop so the parent body-click does not double-fire.
 */
/**
 * True when this evo-step node has been explicitly focused by the user
 * (i.e. focusedStepName was set by a click — NOT the auto-fallback to step 0).
 * Used to show the amber "click again for SDR" ring and drive the two-stage click.
 * Tom 2026-05-17: "first click — bring out tasks; click again (tasks shown) — focus enlargement."
 */
function isFocusedStep(node: FlowNode): boolean {
  return focusedStepName.value !== null && node.id === `s::${focusedStepName.value}`
}
/** True when this F/V/S node has been first-clicked and is waiting for a second click to open SDR. */
function isSelectedNode(node: FlowNode): boolean {
  return selectedNodeId.value !== null && node.specId === selectedNodeId.value
}

function handleTagClick(node: FlowNode): void {
  if (!node.specId || !node.tab) return
  emit('node-click', { tab: node.tab, entryId: node.specId })
}
function handleBodyClick(ci: number, node: FlowNode): void {
  if (node.empty) return
  // Evo Step click — two-stage behavior:
  //   First click (step not yet focused):  switch task focus → show its tasks in col 0. No SDR.
  //   Second click (step already focused): open SDR (near-focus / relations view).
  // Tom 2026-05-17: "first click on evo step without tasks just brings out the tasks.
  //   Click on evo step with tasks displayed brings us to the focus enlargement."
  if (ci === 1) {
    const stepName = node.id.replace(/^s::/, '')
    if (focusedStepName.value === stepName) {
      // Already focused — second click: open SDR
      emit('node-relations-click', { tab: 'evo-steps', entryId: stepName })
    } else {
      // Not yet focused — first click: focus the step (show its tasks in col 0)
      focusedStepName.value = stepName
    }
    return
  }
  // Task node click — navigate to Task Decomposition stage
  if (ci === 0) {
    emit('go-to-tasks')
    return
  }
  if (!isClickable(ci, node)) return
  if (!node.specId || !node.tab) return
  // Single click on S/V/F = toggle selection ring only.
  // SDR is opened exclusively by double-click (handleDblBodyClick) — never by
  // repeated single clicks.  This prevents the flash-and-disappear that occurred
  // when click2 opened SDR while the VFP backdrop was still in the same render
  // batch, causing the dblclick to land on the backdrop and close SDR immediately.
  if (selectedNodeId.value === node.specId) {
    selectedNodeId.value = null   // deselect on re-click
  } else {
    selectedNodeId.value = node.specId  // select: indigo ring
  }
}

/** Double-click on an S/V/F node → open Spec Direct Relations directly.
 *  The @dblclick.stop modifier prevents the event from bubbling to the SVG root
 *  or any parent element, keeping the VFP backdrop from intercepting it.
 *  Evo-step nodes (ci=1) keep the two-single-click model (focus → SDR). */
function handleDblBodyClick(ci: number, node: FlowNode): void {
  if (node.empty) return
  if (ci === 0) { emit('go-to-tasks'); return }
  if (ci === 1) return  // evo steps: two single-clicks; dblclick is a no-op here
  if (!isClickable(ci, node)) return
  if (!node.specId || !node.tab) return
  selectedNodeId.value = null   // clear ring before SDR opens
  emit('node-relations-click', { tab: node.tab, entryId: node.specId })
}

// ── Headline node (the rectangle corresponding to the vibrating red title) ────
/** The specId of the first Value — its description IS the vibrating headline. */
const headlineSpecId = computed<string>(() => props.spec.values[0]?.id ?? '')
/** True when this node IS the headline entry. */
function isHeadline(node: FlowNode): boolean {
  return !!headlineSpecId.value && node.specId === headlineSpecId.value
}

// ── Per-column node lists ─────────────────────────────────────────────────────
const colNodes = computed<FlowNode[][]>(() => {
  // Col 0: Tasks — focused step only
  // Tom 2026-05-16: show first-priority step's tasks by default; clicking an evo step
  // switches focus to that step's tasks ("recent interest tasks" persist on return).
  // Step name shown in column sub-header, so sub-label here is effort/suggested only.
  const tasks: FlowNode[] = []
  const focusStep = effectiveFocusStep.value
  if (focusStep) {
    ;(props.tasksByStep[focusStep] ?? []).forEach(t => {
      const isSuggested = t.effortHours === null && t.assignee === null
      const sub = isSuggested
        ? '◌ suggested'
        : (t.effortHours != null ? `${t.effortHours}h` : '')
      tasks.push({ id: `t::${focusStep}::${t.id}`, label: trunc(t.description, 20), sub, suggested: isSuggested })
    })
  }
  if (!tasks.length) tasks.push({ id: 't::empty', label: focusStep ? 'No tasks yet' : 'No steps', empty: true })

  // Col 1: Evo Steps
  const steps: FlowNode[] = props.evoSteps.length
    ? props.evoSteps.map(s => ({ id: `s::${s.name}`, label: trunc(s.name, 20), sub: `${s.effortPercent}% effort` }))
    : [{ id: 's::empty', label: 'No evo steps', empty: true }]

  // Col 2: Solutions — clickable → spec editor 'solutions' tab
  const sols: FlowNode[] = props.spec.solutions.length
    ? props.spec.solutions.map(s => ({
        id: `sol::${s.id}`, label: trunc(s.description, 20), sub: trunc(s.id, 16),
        specId: s.id, tab: 'solutions' as const,
      }))
    : [{ id: 'sol::empty', label: 'No solutions', empty: true }]

  // Col 3: Values — clickable → spec editor 'values' tab
  const vals: FlowNode[] = props.spec.values.length
    ? props.spec.values.map(v => ({
        id: `val::${v.id}`, label: trunc(v.description, 20), sub: trunc(v.id, 16),
        specId: v.id, tab: 'values' as const,
      }))
    : [{ id: 'val::empty', label: 'No values', empty: true }]

  // Col 4: Functions — clickable → spec editor 'functions' tab
  const fns: FlowNode[] = props.spec.functions.length
    ? props.spec.functions.map(f => ({
        id: `fn::${f.id}`, label: trunc(f.description, 20), sub: trunc(f.id, 16),
        specId: f.id, tab: 'functions' as const,
      }))
    : [{ id: 'fn::empty', label: 'No functions', empty: true }]

  // Col 5: Stakeholders
  const shList = extractAllStakeholders(specText.value)
  const shs: FlowNode[] = shList.length
    ? shList.map(s => ({ id: `sh::${s.name}`, label: trunc(s.name, 20), colour: s.colour }))
    : [{ id: 'sh::empty', label: 'No stakeholders', empty: true }]

  return [tasks, steps, sols, vals, fns, shs]
})

// ── Edge type ─────────────────────────────────────────────────────────────────
interface FlowEdge {
  fromCol:    number
  fromIdx:    number
  toCol:      number
  toIdx:      number
  crossing?:  boolean   // placeholder/fallback-fan edges — dashed; hidden during hover spotlight
  /**
   * Impact percentage from the Impact Matrix (0–100). Present only on Sol→Val edges
   * (col 2→3) derived from Tier 1 (the V/C table). Used during hover to scale arrow
   * thickness proportionally. Tom 2026-05-18: "Make arrow thickness proportional to
   * degree of relation."
   */
  impactPct?: number
}

// ── Edge computation ──────────────────────────────────────────────────────────
const edges = computed<FlowEdge[]>(() => {
  const result: FlowEdge[] = []
  const cn = colNodes.value

  // 0→1  Task → EvoStep (focused step only — mirrors the filtered col 0).
  // All task nodes in col 0 belong to the focused step, so all connect to that one
  // evo step node. When no tasks exist, draw a dashed placeholder edge so the
  // left→right flow is always visible.
  let taskEdgesAdded = 0
  const focusStepEdge = effectiveFocusStep.value
  if (focusStepEdge) {
    const stepIdx = props.evoSteps.findIndex(s => s.name === focusStepEdge)
    if (stepIdx >= 0 && !cn[1][stepIdx]?.empty) {
      cn[0].forEach((tn, ti) => {
        if (!tn.empty) {
          result.push({ fromCol: 0, fromIdx: ti, toCol: 1, toIdx: stepIdx })
          taskEdgesAdded++
        }
      })
    }
  }
  // Placeholder: no real task edges → connect placeholder to all evo steps
  if (taskEdgesAdded === 0 && cn[0][0]?.empty && cn[1].some(n => !n.empty)) {
    cn[1].forEach((n, si) => {
      if (!n.empty) result.push({ fromCol: 0, fromIdx: 0, toCol: 1, toIdx: si, crossing: true })
    })
  }

  // 1→2  EvoStep → Solution(s) (via linkedSolutions — a step may span multiple solutions)
  const solIdToIdx = new Map(props.spec.solutions.map((s, i) => [s.id, i]))
  props.evoSteps.forEach((step, si) => {
    if (cn[1][si]?.empty) return
    let edgesAdded = 0
    ;(step.linkedSolutions ?? []).forEach(solId => {
      const solIdx = solIdToIdx.get(solId)
      if (solIdx !== undefined && !cn[2][solIdx]?.empty) {
        result.push({ fromCol: 1, fromIdx: si, toCol: 2, toIdx: solIdx })
        edgesAdded++
      }
    })
    // Fallback: if no linkedSolutions matched the spec S. IDs (LLM ID mismatch or
    // omitted field), draw dashed inferred edges to ALL solutions so the evo step
    // is never a floating island. Tom 2026-05-17: "the evo step does not connect to anything."
    if (edgesAdded === 0 && !cn[2][0]?.empty) {
      cn[2].forEach((sn, solIdx) => {
        if (!sn.empty) result.push({ fromCol: 1, fromIdx: si, toCol: 2, toIdx: solIdx, crossing: true })
      })
    }
  })

  // 1→3  EvoStep → Value REMOVED 2026-05-17 (Tom Gilb design decision):
  //   "Evo Steps are subdivisions of Solutions — the incremental realisation of a Solution
  //    is what delivers the incremental Value increases. Solutions are high-level design
  //    concepts (often too big to implement in one go); Evo Steps decompose them into
  //    incremental deliveries (see Tom Gilb, 'Split'). The dotted skip-lines from Evo Steps
  //    directly to Values bypassed Solutions and implied a causal chain that is
  //    architecturally misleading. The correct model is Tasks → Evo Steps → Solutions → Values."
  //   The EvoStep.linkedValues field is still stored on the type (used by SpecHeatLane +
  //   EfficiencyDiagram) — only the VFD crossing edges are removed.

  // 2→3  Solution → Value — three-tier edge derivation (most→least authoritative):
  //   Tier 1: Impact Matrix (impactMatrix[valueId][solutionId] > 0) — explicit VDT data.
  //            This is the authoritative source: it IS the data shown in the V/C table.
  //            Tom 2026-05-17: "USE THE VDT DATA."
  //   Tier 2: SEntry.impact free-text parsing (V.Foo mentions in the impact field).
  //            Semi-structured; catches connections when no matrix yet.
  //   Tier 3: Shared F.* link chain (s.function ∩ v.valueOfFunction F-IDs).
  //            Structural inference — weakest but works without any explicit linking.
  //   All three are unioned; the seen-set deduplicates so no edge is drawn twice.
  const sv3Seen = new Set<string>()

  // Build value-ID → column-index lookup (used by all three tiers)
  const valIdToIdx = new Map(props.spec.values.map((v, i) => [v.id, i]))

  // ── Tier 1: Impact Matrix ───────────────────────────────────────────────────
  const matrix = props.impactMatrix ?? {}
  if (Object.keys(matrix).length > 0) {
    // matrix[valueId][solutionId] = impactPercent — connect any non-zero cell
    props.spec.solutions.forEach((s, si) => {
      if (cn[2][si]?.empty) return
      props.spec.values.forEach((v, vi) => {
        if (cn[3][vi]?.empty) return
        const pct = matrix[v.id]?.[s.id] ?? 0
        if (pct > 0) {
          const key = `${si}-${vi}`
          if (!sv3Seen.has(key)) { result.push({ fromCol: 2, fromIdx: si, toCol: 3, toIdx: vi, impactPct: pct }); sv3Seen.add(key) }
        }
      })
    })
  }

  // ── Tier 2: SEntry.impact text parsing (V.* mentions) ──────────────────────
  props.spec.solutions.forEach((s, si) => {
    if (cn[2][si]?.empty) return
    parseValIds(s.impact, props.spec?.values.map(v => v.id) ?? []).forEach(valId => {
      const vi = valIdToIdx.get(valId)
      if (vi === undefined || cn[3][vi]?.empty) return
      const key = `${si}-${vi}`
      if (!sv3Seen.has(key)) { result.push({ fromCol: 2, fromIdx: si, toCol: 3, toIdx: vi }); sv3Seen.add(key) }
    })
  })

  // ── Tier 3: Shared F.* link chain ──────────────────────────────────────────
  const fnIdToValIdxs = new Map<string, number[]>()
  props.spec.values.forEach((v, vi) => {
    parseFnIds(v.valueOfFunction).forEach(fnId => {
      const arr = fnIdToValIdxs.get(fnId) ?? []
      arr.push(vi)
      fnIdToValIdxs.set(fnId, arr)
    })
  })
  props.spec.solutions.forEach((s, si) => {
    if (cn[2][si]?.empty) return
    parseFnIds(s.function).forEach(fnId => {
      ;(fnIdToValIdxs.get(fnId) ?? []).forEach(vi => {
        if (cn[3][vi]?.empty) return
        const key = `${si}-${vi}`
        if (!sv3Seen.has(key)) { result.push({ fromCol: 2, fromIdx: si, toCol: 3, toIdx: vi }); sv3Seen.add(key) }
      })
    })
  })

  // ── Tier 3.5: Keyword-match Sol→Val ─────────────────────────────────────────
  // For solutions still disconnected after Tiers 1-3 (no Impact Matrix data,
  // no V.* mentions, no shared F.* chain), extract significant words from the
  // solution description+impact and match against value description+scale.
  // ≥2 overlapping significant words = probable connection (impactPct 10-40).
  // These are REAL (non-crossing) edges so they remain visible during hover
  // spotlight — every solution shows SOME causal path.
  // Tom 2026-05-18: "there is always some correlation."
  props.spec.solutions.forEach((s, si) => {
    if (cn[2][si]?.empty) return
    const hasEdge = result.some(e => e.fromCol === 2 && e.fromIdx === si && e.toCol === 3)
    if (hasEdge) return  // Tiers 1-3 already found something
    const solWords = getSignificantWords(`${s.description ?? ''} ${s.impact ?? ''}`)
    if (solWords.size === 0) return
    props.spec.values.forEach((v, vi) => {
      if (cn[3][vi]?.empty) return
      const valWords = getSignificantWords(`${v.description ?? ''} ${(v as any).scale ?? ''}`)
      const overlap = [...solWords].filter(w => valWords.has(w)).length
      if (overlap >= 2) {
        const key = `${si}-${vi}`
        if (!sv3Seen.has(key)) {
          result.push({ fromCol: 2, fromIdx: si, toCol: 3, toIdx: vi, impactPct: Math.min(40, 10 + overlap * 8) })
          sv3Seen.add(key)
        }
      }
    })
  })

  // ── Tier 4: Fallback fan-to-all ─────────────────────────────────────────────
  // When ALL tiers above produce zero Sol→Val edges for a given solution
  // (Tier 1 is empty pre-Impact-Estimation; Tiers 2+3 fail when the LLM omits
  // cross-link IDs or uses non-canonical formats; Tier 3.5 needs ≥2 word overlap),
  // draw dashed inferred edges to ALL values so no Solution is ever a floating island.
  // Identical pattern to the EvoStep→Solution fallback (col 1→2).
  // 2026-05-18 fix: "value flow visualization lost connection arrows between
  //   columns" — root cause was that at the Evo Plan stage the Impact Matrix
  //   is always empty, and Ollama-generated specs often omit V.*/F.* ID
  //   cross-links, leaving all three tiers empty and Solutions disconnected.
  props.spec.solutions.forEach((s, si) => {
    if (cn[2][si]?.empty) return
    const hasSolEdge = result.some(e => e.fromCol === 2 && e.fromIdx === si && e.toCol === 3)
    if (!hasSolEdge && !cn[3][0]?.empty) {
      cn[3].forEach((vn, vi) => {
        if (!vn.empty) result.push({ fromCol: 2, fromIdx: si, toCol: 3, toIdx: vi, crossing: true })
      })
    }
  })

  // 3→4  Value → Function — bidirectional lookup + fallback dashed fan.
  // Path A: v.valueOfFunction contains f.id  (value says which function delivers it)
  // Path B: f.functionOfValue contains v.id  (function says which value it delivers — reverse)
  // Fallback: dashed fan to all functions when both paths produce zero edges for a value.
  const fnIdToFnIdx = new Map(props.spec.functions.map((f, i) => [f.id, i]))
  const vf4Seen = new Set<string>()
  props.spec.values.forEach((v, vi) => {
    if (cn[3][vi]?.empty) return
    let edgeCount = 0
    // Path A
    parseFnIds(v.valueOfFunction).forEach(fnId => {
      const fi = fnIdToFnIdx.get(fnId)
      if (fi !== undefined && !cn[4][fi]?.empty) {
        const key = `${vi}-${fi}`
        if (!vf4Seen.has(key)) { result.push({ fromCol: 3, fromIdx: vi, toCol: 4, toIdx: fi }); vf4Seen.add(key); edgeCount++ }
      }
    })
    // Path B — reverse: function declares it delivers this value
    props.spec.functions.forEach((f, fi) => {
      if (cn[4][fi]?.empty) return
      if (parseFnIds(f.functionOfValue).includes(v.id)) {
        const key = `${vi}-${fi}`
        if (!vf4Seen.has(key)) { result.push({ fromCol: 3, fromIdx: vi, toCol: 4, toIdx: fi }); vf4Seen.add(key); edgeCount++ }
      }
    })
    // Fallback: dashed fan to every non-empty function node
    if (edgeCount === 0) {
      cn[4].forEach((fn, fi) => {
        if (!fn.empty) {
          const key = `${vi}-${fi}`
          if (!vf4Seen.has(key)) { result.push({ fromCol: 3, fromIdx: vi, toCol: 4, toIdx: fi, crossing: true }); vf4Seen.add(key) }
        }
      })
    }
  })

  // 4→5  Function → Stakeholder — 3-tier value-chain analysis.
  // Replaces the dumb all-to-all fan. Tom 2026-05-18:
  // "all functions to all stakeholders is no selection at all, use ai analysis
  //  to find certain and potential correlation."
  //
  // Tier 1 (certain, impactPct 80): value-chain fn → val → stakeholder.
  //   A function that delivers a value is certainly relevant to stakeholders whose
  //   name appears in that value's description/scale (proxy for wishStakeholder).
  //   When wishStakeholder is populated on the value, it is also checked directly.
  // Tier 2 (potential, impactPct 40): keyword match — a significant word from the
  //   function description/presenceTest appears as a word in the stakeholder name.
  //   e.g. "Manage Passenger Check-in" → "passenger" matches stakeholder "Passenger".
  // Tier 3 (fallback, crossing: true): all-to-all fan ONLY for functions that
  //   produced zero Tier-1 + Tier-2 connections — ensures no Function is isolated.
  if (!cn[4][0]?.empty && !cn[5][0]?.empty) {
    const fs45Seen = new Set<string>()

    // Full stakeholder names from node IDs (label may be truncated; ID is not)
    const shFullNames = cn[5].map(n => n.id.startsWith('sh::') ? n.id.slice(4) : n.label)

    // Build fn-index → value-index[] lookup (bidirectional: f.functionOfValue + v.valueOfFunction)
    const fnIdxToValIdxs = new Map<number, Set<number>>()
    const addFnValLink = (fi: number, vi: number) => {
      const s = fnIdxToValIdxs.get(fi) ?? new Set<number>()
      s.add(vi); fnIdxToValIdxs.set(fi, s)
    }
    props.spec.functions.forEach((f, fi) => {
      if (cn[4][fi]?.empty) return
      parseFnIds(f.functionOfValue).forEach(valId => {
        const vi = valIdToIdx.get(valId)
        if (vi !== undefined && !cn[3][vi]?.empty) addFnValLink(fi, vi)
      })
    })
    props.spec.values.forEach((v, vi) => {
      if (cn[3][vi]?.empty) return
      parseFnIds(v.valueOfFunction).forEach(fnId => {
        const fi = props.spec.functions.findIndex(f => f.id === fnId)
        if (fi >= 0 && !cn[4][fi]?.empty) addFnValLink(fi, vi)
      })
    })

    cn[4].forEach((fn, fi) => {
      if (fn.empty) return
      const f = props.spec.functions[fi]
      let tierConnections = 0

      // ── Tier 1: value-chain fn → val → stakeholder ──────────────────────────
      // For each value this function delivers, check if a stakeholder name appears
      // in the value text (description, scale, wishStakeholder if populated).
      ;(fnIdxToValIdxs.get(fi) ?? new Set()).forEach(vi => {
        const v = props.spec.values[vi]
        const vText = `${v.description ?? ''} ${(v as any).scale ?? ''} ${(v as any).wishStakeholder ?? ''}`.toLowerCase()
        cn[5].forEach((sh, si) => {
          if (sh.empty) return
          const key = `${fi}-${si}`
          if (fs45Seen.has(key)) return
          // Match: any word of the stakeholder name (≥4 chars) found in value text
          const shName = shFullNames[si].toLowerCase()
          const match = shName.split(/\s+/).some(w => w.length >= 4 && vText.includes(w))
          if (match) {
            result.push({ fromCol: 4, fromIdx: fi, toCol: 5, toIdx: si, impactPct: 80 })
            fs45Seen.add(key)
            tierConnections++
          }
        })
      })

      // ── Tier 2: keyword match fn description vs stakeholder name ────────────
      // A significant word from the function's description appears in the stakeholder name.
      const fnWords = getSignificantWords(`${f.description ?? ''} ${(f as any).presenceTest ?? (f as any).successCriteria ?? ''}`)
      cn[5].forEach((sh, si) => {
        if (sh.empty) return
        const key = `${fi}-${si}`
        if (fs45Seen.has(key)) return
        // Check if any word of the stakeholder name (≥5 chars) is in the function's significant words
        const shName = shFullNames[si].toLowerCase()
        const directHit = shName.split(/\s+/).some(w => w.length >= 5 && fnWords.has(w))
        if (directHit) {
          result.push({ fromCol: 4, fromIdx: fi, toCol: 5, toIdx: si, impactPct: 40 })
          fs45Seen.add(key)
          tierConnections++
        }
      })

      // ── Tier 3: fallback fan — only for functions with zero explicit connections
      if (tierConnections === 0) {
        cn[5].forEach((sh, si) => {
          if (sh.empty) return
          const key = `${fi}-${si}`
          if (!fs45Seen.has(key)) {
            result.push({ fromCol: 4, fromIdx: fi, toCol: 5, toIdx: si, crossing: true })
            fs45Seen.add(key)
          }
        })
      }
    })
  }

  return result
})

// ── SVG geometry helpers ──────────────────────────────────────────────────────
function colX(ci: number): number    { return H_PAD + ci * STRIDE }
function nodeTop(ni: number): number { return V_PAD + ni * (NODE_H + NODE_GAP) }
function nodeCY(ni: number): number  { return nodeTop(ni) + NODE_H / 2 }

const svgWidth  = computed<number>(() => H_PAD * 2 + 6 * COL_W + 5 * COL_GAP)
const svgHeight = computed<number>(() => {
  const maxN = Math.max(...colNodes.value.map(c => c.length))
  return V_PAD + maxN * (NODE_H + NODE_GAP) - NODE_GAP + 28
})

/** Cubic bezier — tipOffset shortens endpoint so arrowhead doesn't overlap node. */
function edgePath(e: FlowEdge, tipOffset = 0): string {
  const sx = colX(e.fromCol) + COL_W
  const sy = nodeCY(e.fromIdx)
  const tx = colX(e.toCol) - tipOffset
  const ty = nodeCY(e.toIdx)
  const span = tx - sx
  const cp   = span * 0.45
  return `M ${sx} ${sy} C ${sx + cp} ${sy} ${tx - cp} ${ty} ${tx} ${ty}`
}

function edgeStrokeW(e: FlowEdge): number {
  // Hover spotlight — connected edges grow; non-/unclear-connected collapse to hairlines
  if (hoveredColRow.value) {
    if (isEdgeConnected(e)) {
      // Impact-Matrix edges: thickness ∝ impact %.
      // Scale: 2.5px at 1% impact → 9px at 100% impact (continuous linear).
      // Tom 2026-05-18: "Make arrow thickness proportional to degree of relation."
      if (e.impactPct !== undefined && e.impactPct > 0) {
        return 2.5 + (e.impactPct / 100) * 6.5
      }
      // Non-matrix explicit edges (Tier 2/3 for Sol→Val, Task→Evo, Val→Fn, Fn→Sh):
      // fixed prominent size — no % data available but it IS a clear relation.
      return e.fromCol === 4 ? 3.5 : 5.5
    }
    return 0.8   // not connected (or crossing — always returns false from isEdgeConnected)
  }
  // Non-hover: crossing (dashed placeholder) must be checked before fromCol
  // because Tier-3 Fn→Sh edges have both crossing=true and fromCol===4.
  if (e.crossing)      return 1.2   // dashed placeholder — always subdued
  if (e.fromCol === 4) {
    // Fn→Sh: Tier 1 (impactPct=80) is visually bolder than Tier 2 (impactPct=40)
    return e.impactPct !== undefined ? (1.0 + (e.impactPct / 100) * 1.2) : 1.4
  }
  return 2.8                        // adjacent links
}
function edgeOpacity(e: FlowEdge): number {
  // Hover spotlight — connected = full opacity; others = nearly invisible
  if (hoveredColRow.value) {
    return isEdgeConnected(e) ? 1.0 : 0.05
  }
  // Non-hover: crossing before fromCol (same reason as edgeStrokeW)
  // Tom 2026-05-29: "the lines between dots should be much darker, I cannot see them"
  if (e.crossing)      return 0.62  // placeholder dashed — subdued but visible
  if (e.fromCol === 4) {
    // Tier 1 (impactPct=80) → 0.82; Tier 2 (impactPct=40) → 0.72
    return e.impactPct !== undefined ? (0.62 + (e.impactPct / 100) * 0.25) : 0.68
  }
  return 0.92                       // adjacent links — near-solid
}
/** Connected + hovered: always solid — relationship reads clearly even for inferred placeholder edges. */
function edgeDash(e: FlowEdge): string {
  if (hoveredColRow.value && isEdgeConnected(e)) return 'none'
  return e.crossing ? '5 3' : 'none'
}
function edgeColor(e: FlowEdge): string { return COLS[e.fromCol].lineFill }
/** Longer tip offset when the hover arrowhead variant is active (larger marker). */
function edgeTipOffset(e: FlowEdge): number {
  if (e.fromCol === 4) return 0
  if (hoveredColRow.value && isEdgeConnected(e)) return 13
  return 7
}

/** True when this node is the one the user navigated FROM (origin highlight). */
function isHighlighted(node: FlowNode): boolean {
  return !!props.highlightedEntryId && node.specId === props.highlightedEntryId
}

/**
 * Opacity for the node group — dims nodes that are NOT connected to the hovered node.
 * Creates a spotlight effect that focuses attention on direct relationships.
 */
function nodeGroupOpacity(node: FlowNode): number {
  if (!hoveredColRow.value) return 1
  return hoveredConnectedNodeIds.value.has(node.id) ? 1 : 0.25
}

function accentFill(ci: number, node: FlowNode): string {
  if (isHighlighted(node)) return '#f59e0b'   // amber-500 — origin highlight left bar
  if (isHeadline(node))    return '#dc2626'   // red-600  — headline node left bar
  if (isFocusedStep(node)) return '#f59e0b'   // amber-500 — focused step accent
  if (isSelectedNode(node)) return '#6366f1'  // indigo-500 — "click again for SDR" ring
  if (node.colour) return node.colour
  if (node.empty)  return '#cbd5e1'
  return COLS[ci].hdrFill
}
// Slightly more saturated fill for clickable/interactive columns when hovered
const HOVER_FILL: Record<number, string> = {
  1: '#fef9c3',   // Evo Steps: yellow-100 — click to focus tasks
  2: '#ede9fe',   // Solutions: violet-100 (vs default violet-50 #f5f3ff)
  3: '#d1fae5',   // Values:    emerald-100 (vs default emerald-50 #ecfdf5)
  4: '#dbeafe',   // Functions: blue-100   (vs default blue-50   #eff6ff)
}

/** True when a node responds to hover/click visuals (spec entries + evo steps + tasks) */
function isInteractive(ci: number, node: FlowNode): boolean {
  return (isClickable(ci, node) || (ci === 1 && !node.empty) || (ci === 0 && !node.empty))
}

function nodeBoxFill(ci: number, node: FlowNode): string {
  if (isHighlighted(node)) return '#fef3c7'   // amber-100 — warm gold bg
  if (isHeadline(node))    return '#fff1f2'   // rose-50  — vibrating headline node
  if (node.colour) return '#ffffff'
  if (node.empty)  return '#f1f5f9'
  // Focused evo step: amber-50 tint — signals "click again for SDR"
  if (isFocusedStep(node)) return '#fffbeb'   // amber-50
  // Selected F/V/S node: indigo-50 tint — signals "click again for SDR"
  if (isSelectedNode(node)) return '#eef2ff'  // indigo-50
  if (hoveredNodeId.value === node.id && isInteractive(ci, node))
    return HOVER_FILL[ci] ?? COLS[ci].nodeFill
  return COLS[ci].nodeFill
}
function nodeBoxStroke(ci: number, node: FlowNode): string {
  if (isHighlighted(node)) return '#f59e0b'   // amber-500 — vivid amber ring
  if (isHeadline(node))    return '#dc2626'   // red-600  — matches headline text
  if (node.colour) return node.colour
  if (node.empty)  return '#e2e8f0'
  // Focused evo step (explicitly clicked): vivid amber ring — "click again for SDR"
  if (isFocusedStep(node)) return '#f59e0b'   // amber-500
  // Selected F/V/S node: vivid indigo ring — "click again for SDR"
  if (isSelectedNode(node)) return '#6366f1'  // indigo-500
  if (hoveredNodeId.value === node.id && isInteractive(ci, node))
    return COLS[ci].hdrFill
  return COLS[ci].nodeStroke
}
function nodeLabelFill(ci: number, node: FlowNode): string {
  if (isHighlighted(node)) return '#92400e'   // amber-800 — readable on amber-100
  if (isHeadline(node))    return '#9f1239'   // rose-800  — readable on rose-50
  if (node.colour) return node.colour
  if (node.empty)  return '#94a3b8'
  return COLS[ci].textFill
}

// ── Vibrating headline ────────────────────────────────────────────────────────
// "After your original words, however much, the first sentence, larger and bold,
//  vibrating and red should be exposed." (Tom Gilb, 2026-05-15)
// Use the first Value's description as the plan's primary intent sentence —
// it is what everything in this causal chain ultimately flows toward.
// Fall back to the first Function, then to the flow formula if spec is empty.
const headlineSentence = computed<string>(() => {
  if (props.spec.values.length > 0)    return props.spec.values[0].description
  if (props.spec.functions.length > 0) return props.spec.functions[0].description
  return 'Tasks → Evo Steps → Solutions → Values → Functions → Stakeholders'
})
</script>

<template>
  <!--
    Outer wrapper — single root element required for flex-fill mode (fitContainer).
    When fitContainer=true:  flex column fills the full parent height.
                             The SVG lives inside an absolutely-positioned sub-div
                             (see below) to avoid SVG-in-flex-item intrinsic-size
                             conflicts (breaks in Safari when flex-1+min-h-0 battles
                             the SVG's viewBox-derived intrinsic height).
    When fitContainer=false: plain block; SVG uses fixed pixel width × height.
    Tom 2026-05-18: "enlarge the diagram to fit the screen."
    Tom 2026-05-19: "make sure the arrows point correctly — they got lost in space."
  -->
  <div :class="props.fitContainer ? 'flex flex-col w-full h-full' : ''">

  <!-- ── Primary Value banner (Tom 2026-05-16: "pulsates like its spec; needs
       explanation; larger text in a coloured rectangle box")
       Shows the first V. entry — the plan's most important outcome — as a
       prominent labelled box that breathes in sync with the matching SVG node.
       Hidden in fitContainer (full-screen) mode — the ValueFlowPanel header
       carries the context, and hiding the banner gives the SVG the full vertical
       space, preventing the flex-height conflict that clipped lower-row arrows. -->
  <div v-if="!thumbnail && !props.fitContainer" class="vfd-headline-box shrink-0" aria-label="Primary Value Target">
    <p class="vfd-headline-label">
      <span aria-hidden="true">★</span> Most valuable spec to act on
    </p>
    <p class="vfd-headline-text">{{ headlineSentence }}</p>
  </div>

  <!-- ── Legend bar — hidden in fitContainer mode to maximise diagram space ─── -->
  <div v-if="!thumbnail && !props.fitContainer" class="flex flex-wrap items-center gap-x-4 gap-y-1 mb-4 text-[10px] text-slate-500">
    <span class="font-semibold text-slate-400 uppercase tracking-wide mr-1">Legend</span>
    <span class="inline-flex items-center gap-1">
      <svg width="24" height="6"><line x1="0" y1="3" x2="24" y2="3" stroke="#818cf8" stroke-width="1.4"/></svg>
      adjacent link
    </span>
    <span class="inline-flex items-center gap-1">
      <svg width="24" height="6"><line x1="0" y1="3" x2="24" y2="3" stroke="#818cf8" stroke-width="1" stroke-dasharray="5 3"/></svg>
      placeholder link (no tasks assigned yet)
    </span>
    <span class="inline-flex items-center gap-1">
      <svg width="24" height="6"><line x1="0" y1="3" x2="24" y2="3" stroke="#60a5fa" stroke-width="0.7" opacity="0.6"/></svg>
      function → stakeholder fan
    </span>
    <!-- Affordance hints — plain English per DD-009 Zero-Training UI.
         Tom 2026-06-03 third pass: HOVER (not click) is the focus mechanism
         (since 2026-05-18 quote in the source: "when we hover over a spec,
         show its relationship with bigger arrows, hide all other arrows" —
         see hoveredConnectedNodeIds computed). The earlier "Click an Evo
         Step to see its Tasks" hint was REMOVED because at the Evo planning
         stage, Tasks do not yet exist as entries — they are produced at
         Stage 8 (Tasks). Showing a Tasks-related hint here was misleading
         users into looking for content that has not been generated. -->
    <span class="inline-flex items-center gap-1 text-indigo-400 font-medium">
      <span aria-hidden="true">⬡</span>
      Hover your cursor over a rectangle (or say the name of a spec) to focus
      on a spec and its relatives — connecting arrows light up, the rest dim.
    </span>
  </div>

  <!--
    ── SVG diagram ─────────────────────────────────────────────────────────────
    user-select: none — prevents SVG text labels from being accidentally selected
    when the user hovers or clicks on a diagram node. Without this, the browser
    can select e.g. "SOLUTIONS" header text, which triggers SelectionDefiner's
    "💡 Illuminate" pill at z-[700], covering the VISUALISE panel at z-[600] and
    making the diagram appear to disappear.  SVG diagram labels are interactive
    controls, not prose content — the CLAUDE.md "no select-none on body content"
    rule does not apply here.

    fitContainer layout (two-element approach):
      1. Wrapper div — flex-1 min-h-0 relative overflow-hidden
         Takes all remaining height in the flex column above. overflow-hidden clips
         any SVG overflow (fallback safety).
      2. SVG — position: absolute; inset: 0; width: 100%; height: 100%
         Fills the wrapper exactly using absolute positioning. This sidesteps the
         SVG-in-flex-item intrinsic-size conflict where Safari uses the viewBox
         aspect ratio to compute the SVG's minimum height, fighting flex-1's
         height assignment and causing the diagram to overflow or misproportion.

    preserveAspectRatio="xMinYMin meet":
      "meet" — keep aspect ratio, fit entire viewBox inside the SVG element.
      "xMinYMin" — anchor content to top-left corner (NOT centred with xMidYMid).
      Previously xMidYMid caused the diagram to float in the vertical middle of a
      tall SVG element with grey empty space above AND below — the "arrows in space"
      effect Tom reported. xMinYMin places the diagram at the top so empty space
      (if any) falls below the diagram, not around it.
      Tom 2026-05-19: "make sure the arrows point correctly — they got lost in space."
  -->
  <!--
    SVG positioning wrapper:
    • fitContainer mode — flex-1 min-h-0 relative overflow-hidden. The SVG inside
      uses position:absolute inset:0 to fill this exact slot. Sidesteps the
      SVG-in-flex-item intrinsic-size conflict (Safari uses viewBox aspect ratio
      to compute SVG min-height, fighting flex-1; absolute positioning removes it
      from the flex algorithm entirely so the wrapper controls the space).
    • non-fitContainer mode — display:contents makes this div invisible to the
      layout engine; SVG renders as a direct child of the outer wrapper.
      (display:contents: Chrome 58+, Firefox 37+, Safari 11.1+ — safe.)
  -->
  <div
    :class="props.fitContainer ? 'flex-1 min-h-0 relative overflow-hidden' : ''"
    :style="!props.fitContainer ? 'display: contents' : ''"
  >
    <svg
      :width="props.fitContainer ? '100%' : svgWidth"
      :height="props.fitContainer ? '100%' : svgHeight"
      :viewBox="`0 0 ${svgWidth} ${svgHeight}`"
      :preserveAspectRatio="props.fitContainer ? 'xMinYMin meet' : 'xMidYMid meet'"
      xmlns="http://www.w3.org/2000/svg"
      :style="props.fitContainer
        ? 'position: absolute; inset: 0; display: block; user-select: none'
        : 'display: block; flex-shrink: 0; user-select: none'"
    >
    <!-- Arrowhead markers (cols 0–4). Fan edges col 4→5 are intentionally arrow-free. -->
    <defs>
      <!-- Normal markers — used when no node is hovered -->
      <marker
        v-for="(col, ci) in COLS.slice(0, 5)"
        :key="ci"
        :id="`vfd-arr-c${ci}`"
        markerWidth="14"
        markerHeight="10"
        refX="11"
        refY="5"
        orient="auto"
        markerUnits="userSpaceOnUse"
      >
        <path d="M 0 1 L 11 5 L 0 9 Z" :fill="col.lineFill" />
      </marker>
      <!-- Hover markers — larger arrowheads for spotlit connected edges.
           Tom 2026-05-18: "show its relationship with bigger arrows." -->
      <marker
        v-for="(col, ci) in COLS.slice(0, 5)"
        :key="`hover-${ci}`"
        :id="`vfd-arr-hover-c${ci}`"
        markerWidth="20"
        markerHeight="14"
        refX="17"
        refY="7"
        orient="auto"
        markerUnits="userSpaceOnUse"
      >
        <path d="M 0 1.5 L 17 7 L 0 12.5 Z" :fill="col.lineFill" />
      </marker>
    </defs>

    <!-- Background rect — click away from nodes clears any pending node selection -->
    <rect
      :width="svgWidth"
      :height="svgHeight"
      fill="#f8fafc"
      rx="10"
      style="cursor: default"
      @click="selectedNodeId = null"
    />

    <!-- Edges (drawn first — behind nodes) -->
    <g>
      <path
        v-for="(e, ei) in edges"
        :key="ei"
        class="vfd-edge"
        :d="edgePath(e, edgeTipOffset(e))"
        :stroke="edgeColor(e)"
        :stroke-width="edgeStrokeW(e)"
        :stroke-opacity="edgeOpacity(e)"
        :stroke-dasharray="edgeDash(e)"
        fill="none"
        stroke-linecap="round"
        :marker-end="hoveredColRow && isEdgeConnected(e)
          ? `url(#vfd-arr-hover-c${e.fromCol})`
          : `url(#vfd-arr-c${e.fromCol})`"
      />
    </g>

    <!-- Column headers -->
    <g>
      <g v-for="(col, ci) in COLS" :key="ci">
        <text
          :x="colX(ci) + COL_W / 2"
          :y="V_PAD - 18"
          text-anchor="middle"
          font-family="-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif"
          font-size="8"
          font-weight="800"
          letter-spacing="0.09em"
          :fill="col.hdrFill"
          pointer-events="none"
        >{{ col.label }}</text>
        <!-- Tasks column: show focused step name as sub-header (amber) -->
        <text
          v-if="ci === 0 && effectiveFocusStep"
          :x="colX(ci) + COL_W / 2"
          :y="V_PAD - 5"
          text-anchor="middle"
          font-family="-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif"
          font-size="7.5"
          font-weight="600"
          fill="#ca8a04"
          pointer-events="none"
        >{{ trunc(effectiveFocusStep, 18) }}</text>
        <!-- All other columns: entry count -->
        <text
          v-else
          :x="colX(ci) + COL_W / 2"
          :y="V_PAD - 5"
          text-anchor="middle"
          font-family="-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif"
          font-size="8"
          font-weight="400"
          fill="#9ca3af"
          pointer-events="none"
        >{{ colNodes[ci].filter(n => !n.empty).length || '—' }}</text>
      </g>
    </g>

    <!-- Nodes
         Tom 2026-05-15 interaction redesign:
         • TAG chip (specId + ✎) at top of each S./V./F. node → click opens Spec Editor.
         • Body of the rectangle (everything else) → click opens Spec Direct Relations.
         Tag <g> uses @click.stop so the body handler never double-fires.
         Non-clickable nodes (Tasks, EvoSteps, Stakeholders) keep the original single-click behavior (no-op). -->
    <g v-for="(nodes, ci) in colNodes" :key="ci">
      <g
        v-for="(node, ni) in nodes"
        :key="node.id"
        :transform="`translate(${colX(ci)}, ${nodeTop(ni)})`"
        :opacity="nodeGroupOpacity(node)"
        class="vfd-node-group"
        @mouseenter="hoveredNodeId = node.id"
        @mouseleave="hoveredNodeId = null"
      >
        <!-- Inner focus wrapper: animation class lives here, SEPARATE from the
             positioning transform above so CSS transform never displaces the node.
             Tom 2026-05-15: "enlarge and colour, focus in a fun way" →
             headline node gets a scale-pulse + red glow via vfd-headline-node class. -->
        <g :class="{ 'vfd-headline-node': isHeadline(node) }">

          <!-- Body rect — S/V/F nodes: click = select ring, dblclick = open SDR.
               Evo-step (ci=1): click = focus step / click again = open SDR.
               Task (ci=0): click = go to Task Decomposition. -->
          <rect
            :width="COL_W"
            :height="NODE_H"
            rx="7"
            :fill="nodeBoxFill(ci, node)"
            :stroke="nodeBoxStroke(ci, node)"
            :stroke-width="isHighlighted(node) ? 3 : isHeadline(node) ? 2.5 : isFocusedStep(node) ? 2.5 : isSelectedNode(node) ? 2.5 : hoveredNodeId === node.id && isInteractive(ci, node) ? 2 : node.colour ? 1.8 : 1.4"
            :stroke-opacity="node.empty ? 0.45 : 1"
            :stroke-dasharray="node.suggested ? '5 3' : undefined"
            :style="isInteractive(ci, node) ? 'cursor: pointer' : undefined"
            :title="isClickable(ci, node)
              ? isSelectedNode(node)
                ? 'Double-click to open Spec Direct Relations · click to deselect'
                : 'Click to select · double-click to open Spec Direct Relations'
              : ci === 1 && !node.empty
                ? isFocusedStep(node) ? 'Click again to open Spec Direct Relations for this Evo Step' : 'Click to focus this Evo Step · click again to open Spec Direct Relations'
                : undefined"
            @click="handleBodyClick(ci, node)"
            @dblclick.stop="handleDblBodyClick(ci, node)"
          />

          <!-- Accent left bar -->
          <rect
            v-if="!node.empty"
            x="0" y="0"
            :width="4"
            :height="NODE_H"
            rx="3"
            :fill="accentFill(ci, node)"
            fill-opacity="0.85"
          />

          <!-- SPEC-ID LABEL — shows the entry ID as a small monospaced chip.
               Pointer-events disabled so ALL clicks fall through to the body
               rect below → handleBodyClick → SDR.
               (Previously this was an interactive TAG ZONE that opened the
               Spec Editor on click — removed 2026-05-16 so clicking anywhere
               on a VFD node consistently opens SDR, keeping the VFD visible.) -->
          <g
            v-if="isClickable(ci, node)"
            style="pointer-events: none"
          >
            <!-- Pill background -->
            <rect
              x="6" y="4"
              :width="Math.min(COL_W - 14, (node.specId?.length ?? 4) * 5.7 + 12)"
              height="14"
              rx="3.5"
              :fill="isHeadline(node) ? '#dc2626' : COLS[ci].hdrFill"
              opacity="0.15"
            />
            <!-- specId text -->
            <text
              x="10" y="14.5"
              font-family="ui-monospace, 'SF Mono', monospace"
              font-size="8.5"
              font-weight="700"
              :fill="isHeadline(node) ? '#dc2626' : COLS[ci].hdrFill"
            >{{ node.specId }}</text>
          </g>

          <!-- Description label — y position accounts for the specId chip height above -->
          <text
            x="11"
            :y="isClickable(ci, node) ? NODE_H * 0.74 : (node.sub ? NODE_H * 0.45 : NODE_H * 0.60)"
            font-family="-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif"
            :font-size="isClickable(ci, node) ? 9.5 : 10.5"
            :font-weight="node.empty ? 400 : 600"
            :font-style="node.empty ? 'italic' : 'normal'"
            :fill="nodeLabelFill(ci, node)"
            pointer-events="none"
          >{{ node.label }}</text>

          <!-- Sub label (EvoSteps, Tasks — unchanged Y) -->
          <text
            v-if="node.sub"
            x="11"
            :y="NODE_H * 0.72"
            font-family="-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif"
            font-size="8.5"
            font-weight="400"
            :fill="COLS[ci].subFill"
            pointer-events="none"
          >{{ node.sub }}</text>

        </g><!-- end inner focus wrapper -->
      </g>
    </g>
  </svg>
  </div><!-- end SVG positioning wrapper -->

  <!-- Footer note — hidden in thumbnail mode and fitContainer mode -->
  <p v-if="!thumbnail && !props.fitContainer" class="mt-4 text-[10px] text-slate-400 italic text-center shrink-0">
    Evo Steps are subdivisions of Solutions · Fan lines = Function → Stakeholder benefit
  </p>

  </div><!-- end outer wrapper -->
</template>

<style scoped>
/* ── Hover spotlight transitions ────────────────────────────────────────────── */
/* Tom 2026-05-18: "when we hover over a spec, show its relationship with bigger  */
/* arrows, hide all other arrows."                                                */
/* stroke-opacity fades smoothly; stroke-width jump is instant (browsers handle  */
/* SVG stroke-width transitions inconsistently so we let it be instantaneous).   */
.vfd-edge {
  transition: stroke-opacity 0.14s ease;
}
/* Nodes not connected to the hovered node fade to 25% so the lit path pops. */
.vfd-node-group {
  transition: opacity 0.14s ease;
}

/* ── Primary Value banner — pulse animation ─────────────────────────────────── */
/* Tom 2026-05-16: "jiggling makes me nervous — pulsates like its spec;          */
/*  needs explanation; larger text in a coloured rectangle box."                 */
/* Box breathes (scale + box-shadow) in a 2 s ease-in-out loop, matching        */
/* vfd-node-focus used on the corresponding SVG node.                            */
@keyframes vfd-headline-pulse {
  0%,  100% {
    transform:  scale(1);
    box-shadow: 0 0  0   0   rgba(220, 38, 38, 0.18),
                0 2px 8px    rgba(220, 38, 38, 0.10);
  }
  50% {
    transform:  scale(1.018);
    box-shadow: 0 0  0   8px  rgba(220, 38, 38, 0.07),
                0 4px 22px   rgba(220, 38, 38, 0.26);
  }
}
.vfd-headline-box {
  background:     #fff1f2;            /* rose-50  */
  border:         2.5px solid #fca5a5; /* red-300  */
  border-radius:  14px;
  padding:        12px 24px 16px;
  text-align:     center;
  margin-bottom:  18px;
  transform-origin: center;
  animation:      vfd-headline-pulse 2.0s ease-in-out infinite;
  user-select:    none;
}
.vfd-headline-label {
  font-size:      0.68rem;
  font-weight:    700;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color:          #9f1239;            /* rose-800 */
  margin-bottom:  6px;
}
.vfd-headline-text {
  font-size:      1.35rem;
  font-weight:    800;
  color:          #dc2626;            /* red-600  */
  line-height:    1.3;
}

/* ── Headline node — stable glow, NO scale animation ────────────────────────── */
/* Previous: scale(1.02)→scale(1.07) animation caused two problems:             */
/*   1. Shakiness — 7% scale expansion bled into adjacent nodes at 60 fps;      */
/*      filter:drop-shadow on SVG <g> is GPU-expensive and causes frame jitter.  */
/*   2. Accidental SDR opens — the expanding hitbox moved into the cursor's      */
/*      position mid-pulse, turning a hover into an unintended click.            */
/* Fix (2026-05-28): no scale change — stroke breathes instead. The node stays  */
/* exactly its laid-out size so no neighbors are disturbed and the clickable     */
/* area is stable throughout the animation cycle.                                */
@keyframes vfd-node-focus {
  0%,  100% { stroke-opacity: 0.65; }
  50%        { stroke-opacity: 1.00; }
}
.vfd-headline-node rect:first-child {
  animation:      vfd-node-focus 1.8s ease-in-out infinite;
  stroke:         #dc2626 !important;
  stroke-width:   3       !important;
}
</style>
