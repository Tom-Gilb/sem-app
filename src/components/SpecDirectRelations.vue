<!--
  SpecDirectRelations.vue — "Spec Direct Relations" view (Feature #SDR)
  Tom 2026-05-15: "If we click (somehow different from show the spec detail click)
  on a Value diagram figure, then we get an enlarged view of it and all the other
  ones it is directly coupled to. Call this 'Spec Direct Relations'. This
  enlargement might be large enough to include some text of the spec in each
  entity, and at least in the main one. Then, a click in any other spec there will
  do the same, show all of its direct relations. Surprise me, and jazz it up with
  appealing color and vibrations, and arrows in motion."

  Layout:  left column = incoming nodes → central (large, full text) → right column = outgoing nodes
  Arrows:  SVG with animated stroke-dashoffset for flowing motion
  Central: pulsing glow + vibrating label
  Colors:  each entry type gets its full column palette
-->
<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import CloseDot    from './CloseDot.vue'
import SpecMiniMap from './SpecMiniMap.vue'
import EditGlyph   from './icons/EditGlyph.vue'
import type { SpecBlock, FEntry, VEntry, SEntry } from '../types/spec'
import type { EvoStep } from '../types/evo-plan'
import type { TaskSuggestion } from '../types/task'
import type { ImpactMatrix } from '../types/impact'

// ── Props / Emits ─────────────────────────────────────────────────────────────

const props = defineProps<{
  spec:         SpecBlock
  evoSteps:     EvoStep[]
  tasksByStep?: Record<string, TaskSuggestion[]>
  /**
   * Impact matrix from the V/C table — impactMatrix[valueId][solutionId] = percent.
   * Used as the PRIMARY path for finding which Solutions deliver a given Value.
   * Without this, SDR fell back to the brittle function-chain lookup which fails
   * whenever the LLM omits valueOfFunction / s.function cross-reference fields.
   * Tom 2026-05-18: "failed to connect on 2 sides."
   */
  impactMatrix?: ImpactMatrix
  /** Entry that was ⬡-clicked in the diagram */
  entryId:   string
  entryTab:  'functions' | 'values' | 'solutions' | 'evo-steps'
}>()

const emit = defineEmits<{
  close:              []
  /** User clicked "← back to diagram" in the minimap — close SDR and reopen the originating diagram. */
  'back-to-diagram':  []
  /** User wants to open Spec Editor for this entry */
  'open-editor':      [{ tab: 'functions' | 'values' | 'solutions'; entryId: string }]
  /** Open the "About the Edit Glyph" info modal */
  'open-edit-info':   []
  /** User clicked an E dot in the mini-map — close SDR and return to Evo Plan (stage 2 / VFD) */
  'go-to-evo':        [stepName: string]
  /** User clicked a T dot in the mini-map — close SDR and navigate to Task Decomposition (stage 4) */
  'go-to-tasks':      []
}>()

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseFnIds(text: string | null | undefined): string[] {
  return [...new Set((text ?? '').split(/[,;]+/).map(s => s.trim()).filter(Boolean))]
}
function trunc(s: string | null | undefined, n: number): string {
  if (!s) return ''
  return s.length <= n ? s : s.slice(0, n - 1) + '…'
}

// ── Column palette — canonical spec-type colours (Kai swap 2026-05-16) ────────
// Source of truth: src/constants/specTypeColors.ts
// Value=Violet · Function=Green · Solution=Orange · Constraint=Red
// Evo Step=Amber · Task=Slate · Stakeholder=Blue · Resource=Dark Green
const PALETTE: Record<string, { bg: string; stroke: string; text: string; sub: string; badge: string; glow: string }> = {
  'evo-step':    { bg: '#fefce8', stroke: '#ca8a04', text: '#713f12', sub: '#facc15', badge: '#ca8a04', glow: '202, 138, 4' },
  'solutions':   { bg: '#fff7ed', stroke: '#ea580c', text: '#9a3412', sub: '#fb923c', badge: '#ea580c', glow: '234, 88, 12' },
  'values':      { bg: '#f5f3ff', stroke: '#7c3aed', text: '#5b21b6', sub: '#a78bfa', badge: '#7c3aed', glow: '124, 58, 237' },
  'functions':   { bg: '#f0fdf4', stroke: '#16a34a', text: '#166534', sub: '#4ade80', badge: '#16a34a', glow: '22, 163, 74' },
  'stakeholder': { bg: '#eff6ff', stroke: '#2563eb', text: '#1e40af', sub: '#60a5fa', badge: '#2563eb', glow: '37, 99, 235' },
  'resource':    { bg: '#f0fdf4', stroke: '#166534', text: '#14532d', sub: '#22c55e', badge: '#166534', glow: '22, 101, 52' },
  'task':        { bg: '#f9fafb', stroke: '#6b7280', text: '#111827', sub: '#9ca3af', badge: '#374151', glow: '107, 114, 128' },
}
function pal(type: string) { return PALETTE[type] ?? PALETTE['stakeholder'] }

// ── Entry type label ──────────────────────────────────────────────────────────
const TYPE_LABEL: Record<string, string> = {
  'evo-step': 'Evo Step', solutions: 'Solution', values: 'Value',
  functions: 'Function', stakeholder: 'Stakeholder', resource: 'Resource', task: 'Task',
}

// ── Keyed glyphs — inline SVG per spec type (white strokes on coloured badge bg) ──
// Geometry grammar: Value=0--✳-->, Function=→O→, Solution=[✳]->,
//                  Constraint=[→O→], Evo Step=< ->+->, Task=[v], Stakeholder=←¶→, Resource=→O
const GLYPHS: Record<string, string> = {
  values: `<svg viewBox="0 0 40 14" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="width:32px;height:11px;vertical-align:middle;overflow:visible;display:inline-block">
    <circle cx="4" cy="7" r="3" fill="none" stroke="white" stroke-width="1.5"/>
    <line x1="7.5" y1="7" x2="17" y2="7" stroke="white" stroke-width="1.2" stroke-dasharray="2.5 1.5"/>
    <text x="21" y="11" font-size="9" fill="white" text-anchor="middle" font-family="monospace" font-weight="700">✳</text>
    <line x1="25" y1="7" x2="34" y2="7" stroke="white" stroke-width="1.5"/>
    <polygon points="32,4.5 38,7 32,9.5" fill="white"/>
  </svg>`,
  functions: `<svg viewBox="0 0 40 14" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="width:32px;height:11px;vertical-align:middle;overflow:visible;display:inline-block">
    <line x1="0" y1="7" x2="10" y2="7" stroke="white" stroke-width="1.2" stroke-dasharray="2.5 1.5"/>
    <polygon points="8.5,4.5 13,7 8.5,9.5" fill="white" opacity="0.75"/>
    <ellipse cx="21" cy="7" rx="7" ry="5" fill="none" stroke="white" stroke-width="1.5"/>
    <line x1="28" y1="7" x2="36" y2="7" stroke="white" stroke-width="1.5"/>
    <polygon points="34,4.5 40,7 34,9.5" fill="white"/>
  </svg>`,
  solutions: `<svg viewBox="0 0 38 14" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="width:30px;height:11px;vertical-align:middle;overflow:visible;display:inline-block">
    <text x="1" y="11.5" font-size="13" fill="white" font-family="monospace" font-weight="600">[</text>
    <text x="10" y="11" font-size="9" fill="white" text-anchor="middle" font-family="monospace" font-weight="700">✳</text>
    <text x="17" y="11.5" font-size="13" fill="white" font-family="monospace" font-weight="600">]</text>
    <line x1="23" y1="7" x2="31" y2="7" stroke="white" stroke-width="1.5"/>
    <polygon points="29,4.5 36,7 29,9.5" fill="white"/>
  </svg>`,
  constraint: `<svg viewBox="0 0 40 14" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="width:32px;height:11px;vertical-align:middle;overflow:visible;display:inline-block">
    <text x="0" y="11.5" font-size="14" fill="white" font-family="monospace" font-weight="900">[</text>
    <line x1="7" y1="7" x2="13" y2="7" stroke="white" stroke-width="1" stroke-dasharray="2 1.2"/>
    <polygon points="11.5,5 15,7 11.5,9" fill="white" opacity="0.8"/>
    <ellipse cx="20" cy="7" rx="4" ry="3.5" fill="none" stroke="white" stroke-width="1.2"/>
    <line x1="24" y1="7" x2="30" y2="7" stroke="white" stroke-width="1.2"/>
    <polygon points="28.5,5 32,7 28.5,9" fill="white"/>
    <text x="32" y="11.5" font-size="14" fill="white" font-family="monospace" font-weight="900">]</text>
  </svg>`,
  // < ->+->  Past anchor · dashed planning gap · value dot+arrow · accumulation · next value
  'evo-step': `<svg viewBox="0 0 38 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="width:34px;height:11px;vertical-align:middle;overflow:visible;display:inline-block">
    <polyline points="5,4.5 1.5,8 5,11.5" fill="none" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
    <line x1="6.5" y1="8" x2="10" y2="8" stroke="white" stroke-width="1" stroke-dasharray="1.5 1.5" stroke-linecap="round" opacity="0.45"/>
    <circle cx="13" cy="8" r="2.2" fill="white"/>
    <line x1="15.3" y1="8" x2="19" y2="8" stroke="white" stroke-width="1.4" stroke-linecap="round"/>
    <polyline points="17.5,5.5 20.5,8 17.5,10.5" fill="none" stroke="white" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
    <line x1="22.5" y1="8" x2="25" y2="8" stroke="white" stroke-width="1.3" stroke-linecap="round"/>
    <line x1="23.8" y1="6.5" x2="23.8" y2="9.5" stroke="white" stroke-width="1.3" stroke-linecap="round"/>
    <circle cx="28" cy="8" r="2.2" fill="white"/>
    <line x1="30.3" y1="8" x2="34" y2="8" stroke="white" stroke-width="1.4" stroke-linecap="round"/>
    <polyline points="32.5,5.5 35.5,8 32.5,10.5" fill="none" stroke="white" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  // [v]  bracket · v-stroke (v = value contribution AND checkmark shape — keyed icon pun)
  task: `<svg viewBox="0 0 20 14" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="width:16px;height:11px;vertical-align:middle;overflow:visible;display:inline-block">
    <text x="0" y="12" font-size="14" fill="white" font-family="monospace" font-weight="700">[</text>
    <polyline points="6,4.5 9.5,10.5 13,4.5" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="15" y="12" font-size="14" fill="white" font-family="monospace" font-weight="700">]</text>
  </svg>`,
  // ←¶→  solid ← = value TO stakeholder · ¶ pilcrow = identity + left-facing human profile · dashed → = resources FROM stakeholder
  stakeholder: `<svg viewBox="0 0 40 14" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="width:32px;height:11px;vertical-align:middle;overflow:visible;display:inline-block">
    <!-- ← solid — value flows TO stakeholder -->
    <polygon points="3,4.5 0,7 3,9.5" fill="white"/>
    <line x1="0" y1="7" x2="10" y2="7" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
    <!-- ¶ pilcrow — identity AND a left-facing human profile (bowl=head, stems=body) -->
    <text x="18" y="12.5" font-size="11" fill="white" text-anchor="middle" font-family="serif">¶</text>
    <!-- → dashed — resources FROM stakeholder to system -->
    <line x1="25" y1="7" x2="35" y2="7" stroke="white" stroke-width="1.2" stroke-dasharray="2 1.5" stroke-linecap="round"/>
    <polygon points="33,4.5 38,7 33,9.5" fill="white" opacity="0.85"/>
  </svg>`,
  // →O  dashed arrow into oval (left half of →O→ function glyph — resource IN, no output)
  resource: `<svg viewBox="0 0 28 14" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="width:22px;height:11px;vertical-align:middle;overflow:visible;display:inline-block">
    <line x1="0" y1="7" x2="10" y2="7" stroke="white" stroke-width="1.2" stroke-dasharray="2.5 1.5"/>
    <polygon points="8.5,4.5 13,7 8.5,9.5" fill="white" opacity="0.85"/>
    <ellipse cx="21" cy="7" rx="6.5" ry="5" fill="none" stroke="white" stroke-width="1.5"/>
  </svg>`,
}

// ── ⓘ info popover — shows keyed icon + one-line description per type ─────────
const INFO_TEXT: Record<string, { icon: string; title: string; desc: string }> = {
  values:      { icon: '0--✳-->', title: 'Value',       desc: 'A measurable benefit with scale and goal. The royal "why" of the system.' },
  functions:   { icon: '→O→',     title: 'Function',    desc: 'What the system DOES — binary: present or absent. "Good to go" capability.' },
  solutions:   { icon: '[✳]→',    title: 'Solution',    desc: 'A constrained means (any useful data/approach) that leads to value delivery.' },
  constraint:  { icon: '[→O→]',   title: 'Constraint',  desc: 'A hard limit on functions or values. Must not be exceeded.' },
  'evo-step':  { icon: '< ->+->',  title: 'Evo Step',    desc: 'Past anchor · planning gap · value delivered · accumulation · next value.' },
  task:        { icon: '[v]',      title: 'Task',        desc: 'A piece of work. v = value contribution AND checkmark — keyed icon pun.' },
  stakeholder: { icon: '←¶→', title: 'Stakeholder', desc: '← value they receive (solid) · ¶ identity — paragraph of interests AND a left-facing human profile (bowl=head, stems=body, eye=face) · → resources they give (dashed). Brown (Stakeholder Engineering): "Follow the resources — every resource provider is a stakeholder." The → is the diagnostic: trace it back, find a stakeholder. Not just people — data, laws, systems too.' },
  resource:    { icon: '→O',       title: 'Resource',    desc: 'Input cost going into the system. →O is the left half of →O→ (Function).' },
}

/** id of the node whose ⓘ popover is currently open (null = none). */
const infoNodeId = ref<string | null>(null)
function toggleInfo(nodeId: string, e: MouseEvent): void {
  e.stopPropagation()
  infoNodeId.value = infoNodeId.value === nodeId ? null : nodeId
}

// ── RelationNode type ─────────────────────────────────────────────────────────
interface RelationNode {
  id:          string
  type:        'evo-step' | 'solutions' | 'values' | 'functions' | 'stakeholder' | 'task'
  label:       string        // short ID / name
  description: string        // full description
  extra:       string        // secondary metric line (scale·goal for V., impact for S., etc.)
  navigable:   boolean       // can the user click this to pivot to its relations
  tab?:        'functions' | 'values' | 'solutions'
}

// ── Navigation stack (pivot: clicking a connected node re-centres on it) ──────
const stack = ref<Array<{ entryId: string; entryTab: 'functions' | 'values' | 'solutions' | 'evo-steps' }>>([])

const currentId  = ref(props.entryId)
const currentTab = ref<'functions' | 'values' | 'solutions' | 'evo-steps'>(props.entryTab)
const expanded   = ref(false)   // full-screen toggle (Tom 2026-05-16)

watch(() => props.entryId, id => { currentId.value = id; currentTab.value = props.entryTab; stack.value = [] })

// ── Compute central + relations ───────────────────────────────────────────────

const central = computed<RelationNode>(() => {
  const id  = currentId.value
  const tab = currentTab.value
  if (tab === 'values') {
    const v = props.spec.values.find(e => e.id === id)
    if (!v) return { id, type: 'values', label: id, description: '', extra: '', navigable: false }
    const extra = [v.scale && `Scale: ${trunc(v.scale, 40)}`, v.goal && `Goal: ${trunc(v.goal, 30)}`].filter(Boolean).join(' · ')
    return { id, type: 'values', label: id, description: v.description, extra, navigable: true, tab: 'values' }
  }
  if (tab === 'solutions') {
    const s = props.spec.solutions.find(e => e.id === id)
    if (!s) return { id, type: 'solutions', label: id, description: '', extra: '', navigable: false }
    return { id, type: 'solutions', label: id, description: s.description, extra: s.impact ? `Impact: ${trunc(s.impact, 50)}` : '', navigable: true, tab: 'solutions' }
  }
  if (tab === 'functions') {
    const f = props.spec.functions.find(e => e.id === id)
    if (!f) return { id, type: 'functions', label: id, description: '', extra: '', navigable: false }
    const extra = f.presenceTest ?? (f as unknown as { successCriteria?: string }).successCriteria ?? ''
    return { id, type: 'functions', label: id, description: f.description, extra: trunc(extra, 60), navigable: true, tab: 'functions' }
  }
  if (tab === 'evo-steps') {
    const step = props.evoSteps.find(s => s.name === id)
    if (!step) return { id, type: 'evo-step', label: trunc(id, 24), description: id, extra: '', navigable: false }
    const extra = `${step.effortPercent}% effort · ${(step.linkedSolutions ?? []).length} solution(s) · ${(step.linkedValues ?? []).length} value(s)`
    return { id, type: 'evo-step', label: trunc(id, 28), description: step.description ?? step.name, extra, navigable: false }
  }
  return { id, type: 'values', label: id, description: '', extra: '', navigable: false }
})

const incoming = computed<RelationNode[]>(() => {
  const id  = currentId.value
  const tab = currentTab.value
  const nodes: RelationNode[] = []

  if (tab === 'values') {
    // ── Stakeholder(s) who wish this value ───────────────────────────────────
    // Planguage causal chain: Stakeholder → [needs] → Value → [measures] → Function
    // The stakeholder is the SOURCE of the value need — placed on the incoming
    // (left) side when viewing a Value node.
    const thisVEntry = props.spec.values.find(e => e.id === id) as VEntry | undefined
    if (thisVEntry?.wishStakeholder) {
      thisVEntry.wishStakeholder.split(/[,;]+/).map(s => s.trim()).filter(Boolean).forEach(sh => {
        nodes.push({ id: sh, type: 'stakeholder', label: sh, description: sh, extra: 'Wishes this value', navigable: false })
      })
    }

    // ── Evo Steps with direct V. link ────────────────────────────────────────
    props.evoSteps.forEach(step => {
      if ((step.linkedValues ?? []).includes(id)) {
        nodes.push({ id: step.name, type: 'evo-step', label: trunc(step.name, 24), description: step.name, extra: `${step.effortPercent}% effort`, navigable: false })
      }
    })
    // ── Find Solutions that deliver this Value — four paths, most→least authoritative ──
    // LLMs frequently omit or mismatch cross-reference fields, so we union all paths.
    const foundSolIds = new Set<string>()

    // Path A (authoritative): Impact Matrix — impactMatrix[valueId][solutionId] > 0
    // This IS the V/C table data: if a solution has any % impact on this value it is
    // directly connected. Best source because it is entered by the user, not inferred.
    const matrix = props.impactMatrix ?? {}
    if (Object.keys(matrix).length > 0) {
      props.spec.solutions.forEach(s => {
        if ((matrix[id]?.[s.id] ?? 0) > 0) foundSolIds.add(s.id)
      })
    }

    // Path B: s.impact free text contains this value's ID as a substring
    props.spec.solutions.forEach(s => {
      if (!foundSolIds.has(s.id) && s.impact && s.impact.includes(id)) foundSolIds.add(s.id)
    })

    // Path C: shared function-ID chain — s.function ∩ v.valueOfFunction (structural fallback)
    // Path C.1: build the set of function IDs linked to this value (bidirectional)
    const vFnIds = new Set(parseFnIds((props.spec.values.find(v => v.id === id) as VEntry | undefined)?.valueOfFunction))
    props.spec.functions.forEach(f => {
      if (parseFnIds(f.functionOfValue).some(vid => vid === id)) vFnIds.add(f.id)
      // also accept substring match when parseFnIds splits too coarsely
      if (!vFnIds.has(f.id) && (f.functionOfValue ?? '').includes(id)) vFnIds.add(f.id)
    })
    // Path C.2: solutions whose s.function overlaps those function IDs
    props.spec.solutions.forEach(s => {
      if (!foundSolIds.has(s.id) && parseFnIds(s.function).some(fid => vFnIds.has(fid))) foundSolIds.add(s.id)
    })

    props.spec.solutions.filter(s => foundSolIds.has(s.id)).forEach(s => {
      nodes.push({ id: s.id, type: 'solutions', label: s.id, description: s.description, extra: s.impact ? trunc(s.impact, 40) : '', navigable: true, tab: 'solutions' })
    })
  }

  if (tab === 'solutions') {
    props.evoSteps.forEach(step => {
      if ((step.linkedSolutions ?? []).includes(id)) {
        nodes.push({ id: step.name, type: 'evo-step', label: trunc(step.name, 24), description: step.name, extra: `${step.effortPercent}% effort`, navigable: false })
      }
    })
  }

  if (tab === 'functions') {
    // Values whose valueOfFunction references this function (Path A)
    // OR this function's own functionOfValue references the value (Path B — bidirectional)
    const thisF = props.spec.functions.find(e => e.id === id) as FEntry | undefined
    const fovIds = new Set(parseFnIds(thisF?.functionOfValue))  // value IDs back-referenced by this function
    props.spec.values.forEach(v => {
      const byVOF = parseFnIds(v.valueOfFunction).includes(id)        // Path A
      const byFOV = fovIds.has(v.id)                                   // Path B
      if (byVOF || byFOV) {
        const extra = [v.scale && trunc(v.scale, 30), v.goal && trunc(v.goal, 20)].filter(Boolean).join(' · ')
        nodes.push({ id: v.id, type: 'values', label: v.id, description: v.description, extra, navigable: true, tab: 'values' })
      }
    })
  }

  if (tab === 'evo-steps') {
    // Incoming = tasks assigned to this step
    const tasks = props.tasksByStep?.[id] ?? []
    tasks.forEach(t => {
      nodes.push({
        id: t.id,
        type: 'task' as RelationNode['type'],
        label: trunc(t.description || 'Untitled task', 24),
        description: t.description || 'Untitled task',
        extra: t.effortHours != null ? `${t.effortHours}h` : t.assignee ? `→ ${t.assignee}` : '',
        navigable: false,
      })
    })
  }

  return nodes
})

const outgoing = computed<RelationNode[]>(() => {
  const id  = currentId.value
  const tab = currentTab.value
  const nodes: RelationNode[] = []

  if (tab === 'values') {
    // Outgoing from a Value = the Function(s) it measures.
    // Bidirectional lookup — uses EITHER field that happens to be populated:
    // Path A: v.valueOfFunction lists the function's ID (forward ref)
    // Path B: f.functionOfValue lists this value's ID (back-ref from each Function)
    // Either field alone may be missing or mismatched by the LLM — union catches both cases.
    const v = props.spec.values.find(e => e.id === id) as VEntry | undefined
    const foundFnIds = new Set<string>()
    // Path A
    parseFnIds(v?.valueOfFunction).forEach(fnId => {
      const f = props.spec.functions.find(e => e.id === fnId) as FEntry | undefined
      if (f && !foundFnIds.has(f.id)) {
        foundFnIds.add(f.id)
        const extra = (f.presenceTest ?? (f as unknown as { successCriteria?: string }).successCriteria) ?? ''
        nodes.push({ id: f.id, type: 'functions', label: f.id, description: f.description, extra: trunc(extra, 40), navigable: true, tab: 'functions' })
      }
    })
    // Path B — functions whose functionOfValue back-references this value's id
    props.spec.functions.forEach(f => {
      if (!foundFnIds.has(f.id) && parseFnIds(f.functionOfValue).some(vid => vid === id)) {
        foundFnIds.add(f.id)
        const extra = (f.presenceTest ?? (f as unknown as { successCriteria?: string }).successCriteria) ?? ''
        nodes.push({ id: f.id, type: 'functions', label: f.id, description: f.description, extra: trunc(extra, 40), navigable: true, tab: 'functions' })
      }
    })

    // Path C — substring fallback: when the LLM wrote the value ID somewhere in the
    // function's fields without a clean comma-separated cross-ref. Also handles the
    // case where valueOfFunction lists a function ID that contains spaces and the
    // split-on-comma still matches via substring.
    if (foundFnIds.size === 0) {
      props.spec.functions.forEach(f => {
        if (!foundFnIds.has(f.id)) {
          const fnText = [f.functionOfValue, f.description, f.presenceTest].filter(Boolean).join(' ')
          if (fnText.includes(id)) {
            foundFnIds.add(f.id)
            const extra = (f.presenceTest ?? (f as unknown as { successCriteria?: string }).successCriteria) ?? ''
            nodes.push({ id: f.id, type: 'functions', label: f.id, description: f.description, extra: trunc(extra, 40), navigable: true, tab: 'functions' })
          }
        }
      })
    }
  }

  if (tab === 'solutions') {
    // 3-path lookup for Solution → Value outgoing links.
    // LLMs frequently omit or mismatch cross-reference fields, so we use every
    // available signal before giving up.
    const s = props.spec.solutions.find(e => e.id === id) as SEntry | undefined
    const sFnIds = new Set(parseFnIds(s?.function))
    const foundVIds = new Set<string>()

    // Path A: v.valueOfFunction overlaps with s.function (direct shared-function match)
    props.spec.values.forEach(v => {
      if (parseFnIds(v.valueOfFunction).some(fid => sFnIds.has(fid))) foundVIds.add(v.id)
    })

    // Path B: reverse — any function in s.function whose functionOfValue lists this value
    props.spec.functions.forEach(f => {
      if (sFnIds.has(f.id)) {
        parseFnIds(f.functionOfValue).forEach(vid => foundVIds.add(vid))
      }
    })

    // Path C: s.impact contains explicit V./F. ID references e.g. "V.Availability ~80%"
    const impactMatches = (s?.impact ?? '').match(/\b[A-Z]\.\w+/g) ?? []
    const impactIds = new Set(impactMatches)
    props.spec.values.forEach(v => {
      if (impactIds.has(v.id)) foundVIds.add(v.id)
    })

    props.spec.values
      .filter(v => foundVIds.has(v.id))
      .forEach(v => {
        const extra = [v.scale && trunc(v.scale, 30), v.goal && trunc(v.goal, 20)].filter(Boolean).join(' · ')
        nodes.push({ id: v.id, type: 'values', label: v.id, description: v.description, extra, navigable: true, tab: 'values' })
      })
  }

  if (tab === 'functions') {
    // Stakeholders who benefit from this function via its delivered values.
    // 4-tier fallback — Planguage causal chain: Stakeholder → Value → Function
    // Tier 1: wishStakeholder from values directly connected to this function
    const thisF2 = props.spec.functions.find(e => e.id === id) as FEntry | undefined
    const fov2   = new Set(parseFnIds(thisF2?.functionOfValue))
    const connVIds = new Set<string>()
    props.spec.values.forEach(v => {
      if (parseFnIds(v.valueOfFunction).includes(id) || fov2.has(v.id)) connVIds.add(v.id)
    })
    let shs: string[] = props.spec.values
      .filter(v => connVIds.has(v.id))
      .flatMap(v => v.wishStakeholder
        ? v.wishStakeholder.split(/[,;]+/).map((s: string) => s.trim()).filter(Boolean)
        : [])
    // Tier 2: widen to all values if none of the connected values carry wishStakeholder
    if (shs.length === 0) {
      shs = props.spec.values.flatMap(v => v.wishStakeholder
        ? v.wishStakeholder.split(/[,;]+/).map((s: string) => s.trim()).filter(Boolean)
        : [])
    }
    // Tier 3: last resort — use the original stakes string stored at generation time
    if (shs.length === 0 && props.spec.stakes) {
      shs = props.spec.stakes.split(/[,;]+/).map((s: string) => s.trim()).filter(Boolean)
    }
    const unique = [...new Set(shs)]
    unique.forEach(sh => {
      nodes.push({ id: sh, type: 'stakeholder', label: sh, description: sh, extra: 'Stakeholder beneficiary', navigable: false })
    })
  }

  if (tab === 'evo-steps') {
    // Outgoing = linked Solutions + linked Values
    const step = props.evoSteps.find(s => s.name === id)
    if (step) {
      ;(step.linkedSolutions ?? []).forEach(solId => {
        const s = props.spec.solutions.find(e => e.id === solId)
        if (s) nodes.push({ id: s.id, type: 'solutions', label: s.id, description: s.description, extra: s.impact ? trunc(s.impact, 40) : '', navigable: true, tab: 'solutions' })
      })
      ;(step.linkedValues ?? []).forEach(valId => {
        const v = props.spec.values.find(e => e.id === valId)
        if (v) {
          const extra = [v.scale && trunc(v.scale, 30), v.goal && trunc(v.goal, 20)].filter(Boolean).join(' · ')
          nodes.push({ id: v.id, type: 'values', label: v.id, description: v.description, extra, navigable: true, tab: 'values' })
        }
      })
    }
  }

  return nodes
})

// ── Pivot navigation ──────────────────────────────────────────────────────────

function pivotTo(node: RelationNode) {
  if (!node.navigable || !node.tab) return
  stack.value.push({ entryId: currentId.value, entryTab: currentTab.value })
  currentId.value  = node.id
  currentTab.value = node.tab
}

function goBack() {
  const prev = stack.value.pop()
  if (prev) { currentId.value = prev.entryId; currentTab.value = prev.entryTab }
}

// ── Mini-map ──────────────────────────────────────────────────────────────────
// Flat list of IDs directly connected to the current entry (incoming + outgoing).
// Passed to SpecMiniMap so it can highlight related dots and draw connection lines.
const relatedIds = computed<string[]>(() => [
  ...incoming.value.map(n => n.id),
  ...outgoing.value.map(n => n.id),
])

/**
 * SpecMiniMap only handles F/V/S tabs. When viewing an evo-step, pass 'values'
 * as the minimap highlight tab so TSC is satisfied — the minimap will not have
 * a matching dot to highlight anyway (evo-step dots are action-only in the map).
 */
const miniMapTab = computed<'functions' | 'values' | 'solutions'>(() => {
  const t = currentTab.value
  if (t === 'evo-steps') return 'values'
  return t
})

function handleMiniMapPivot(id: string, tab: 'functions' | 'values' | 'solutions'): void {
  // Build a minimal navigable RelationNode — the full description is computed when
  // the new central entry is rendered. We just need id + tab to push onto the stack.
  const node: RelationNode = {
    id, tab,
    type:        tab as RelationNode['type'],
    label:       id,
    description: '',
    extra:       '',
    navigable:   true,
  }
  pivotTo(node)
}

// ── Arrow geometry — computed from real DOM positions ─────────────────────────
// Tom 2026-05-16: "arrows do not connect" — old approach used a fixed 160px SVG
// div with percentage coords that never actually hit card edges. Replaced with a
// full-canvas absolute SVG overlay whose coordinates come from getBoundingClientRect.

const canvasEl    = ref<HTMLElement | null>(null)
const centralEl   = ref<HTMLElement | null>(null)
const incomingEls = ref<(HTMLElement | null)[]>([])
const outgoingEls = ref<(HTMLElement | null)[]>([])

interface Arrow { x1: number; y1: number; x2: number; y2: number }
const incomingArrows = ref<Arrow[]>([])
const outgoingArrows = ref<Arrow[]>([])

function recalcArrows(): void {
  if (!canvasEl.value || !centralEl.value) return
  const cb = canvasEl.value.getBoundingClientRect()
  const ce = centralEl.value.getBoundingClientRect()
  const cLeft   = ce.left   - cb.left
  const cRight  = ce.right  - cb.left
  const cMidY   = ce.top    - cb.top + ce.height / 2
  const cTop    = ce.top    - cb.top
  const cBottom = ce.bottom - cb.top
  const PAD = 28  // vertical padding from card edge to first/last arrow endpoint

  // ── Incoming: right edge of node → left edge of central (distributed, no-cross) ──
  // Sort by source Y so arrow rank matches visual top-to-bottom order → no crossing.
  const rawIn = incomingEls.value
    .filter((el): el is HTMLElement => !!el)
    .map(el => {
      const r = el.getBoundingClientRect()
      return { x1: r.right - cb.left, y1: r.top - cb.top + r.height / 2 }
    })
  rawIn.sort((a, b) => a.y1 - b.y1)
  incomingArrows.value = rawIn.map((src, i, arr) => {
    const n = arr.length
    const y2 = n === 1
      ? cMidY
      : cTop + PAD + (i / (n - 1)) * (cBottom - cTop - PAD * 2)
    return { x1: src.x1, y1: src.y1, x2: cLeft, y2 }
  })

  // ── Outgoing: right edge of central → left edge of node (distributed, no-cross) ──
  // Sort by destination Y so departure rank matches arrival order → no crossing.
  const rawOut = outgoingEls.value
    .filter((el): el is HTMLElement => !!el)
    .map(el => {
      const r = el.getBoundingClientRect()
      return { x2: r.left - cb.left, y2: r.top - cb.top + r.height / 2 }
    })
  rawOut.sort((a, b) => a.y2 - b.y2)
  outgoingArrows.value = rawOut.map((dst, i, arr) => {
    const n = arr.length
    const y1 = n === 1
      ? cMidY
      : cTop + PAD + (i / (n - 1)) * (cBottom - cTop - PAD * 2)
    return { x1: cRight, y1, x2: dst.x2, y2: dst.y2 }
  })
}

// Recalculate arrows on window resize — getBoundingClientRect values change
// when the viewport changes (e.g. browser fullscreen toggle, window resize).
function _onResize(): void { nextTick(recalcArrows) }
onMounted(() => { nextTick(recalcArrows); window.addEventListener('resize', _onResize) })
onUnmounted(() => window.removeEventListener('resize', _onResize))
watch([currentId, currentTab], () => nextTick(() => nextTick(recalcArrows)))
</script>

<template>
  <!-- Right-side drawer — leaves the main chart visible on the left.
       Tom 2026-05-16: "ouch, back to on top of main chart" — changed from
       fixed inset-0 fullscreen modal to a right-side drawer. -->
  <Teleport to="body">
    <div class="fixed inset-0 z-[650] flex items-stretch justify-end">
      <!-- Left dim overlay — click to close; chart stays dimly visible behind.
           sdr-backdrop fades in over 0.22s so the user registers the dimming
           as an intentional panel open, not a sudden context switch. -->
      <div
        class="sdr-backdrop flex-1 cursor-pointer"
        style="background: rgba(10,8,28,0.38); backdrop-filter: blur(2px);"
        aria-label="Close Spec Direct Relations"
        @click="emit('close')"
      />

      <!-- Panel slides in from the right; width is toggled full-screen via expanded ref -->
      <div
        class="sdr-panel relative flex flex-col shadow-2xl overflow-hidden"
        :style="`
          width:      ${expanded ? '100vw' : 'min(72vw, 920px)'};
          min-width:  ${expanded ? '100vw' : '400px'};
          height:     100vh;
          background: linear-gradient(155deg, #1e1b4b 0%, #13111e 55%, #1a0f2e 100%);`"
      >
        <!-- Header -->
        <div class="flex items-center gap-3 px-5 py-3 border-b border-white/10 shrink-0">
          <button
            v-if="stack.length"
            type="button"
            class="text-[11px] font-semibold text-indigo-300 hover:text-white px-2 py-1 rounded-md hover:bg-white/10 transition-colors"
            @click="goBack"
          >← Back</button>
          <span class="text-[11px] font-bold uppercase tracking-widest text-indigo-400">Spec Direct Relations</span>
          <span class="ml-2 text-white/50 text-[10px]">{{ central.label }}</span>
          <div class="ml-auto flex items-center gap-2">
            <button
              type="button"
              class="text-[10px] font-semibold px-2.5 py-1 rounded-lg border transition-colors"
              :style="`color:${pal(central.type).badge}; border-color:${pal(central.type).badge}40; background:${pal(central.type).bg}`"
              @click="central.tab && emit('open-editor', { tab: central.tab, entryId: central.id })"
            ><EditGlyph size="compact" class="h-3 w-auto shrink-0" aria-hidden="true" /> Edit in Spec Editor</button>
            <!-- About the Edit Glyph info affordance -->
            <button
              type="button"
              class="inline-flex items-center gap-0.5 text-[10px] font-semibold px-2 py-1 rounded-lg
                     border border-white/20 bg-white/8 text-white/60
                     hover:bg-white/15 hover:text-white transition-colors"
              title="About the Edit Glyph — what [*]→[**] means"
              @click="emit('open-edit-info')"
            ><EditGlyph size="compact" class="h-2.5 w-auto shrink-0" aria-hidden="true" /><span class="ml-0.5">?</span></button>
            <!-- Full-screen toggle (Tom 2026-05-16 — labelled pill so it is visible) -->
            <button
              type="button"
              class="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full border transition-colors select-none"
              :class="expanded
                ? 'bg-indigo-500/30 border-indigo-400/60 text-indigo-200 hover:bg-indigo-500/50 hover:text-white'
                : 'bg-white/8 border-white/25 text-white/80 hover:bg-white/15 hover:text-white'"
              @click="expanded = !expanded"
            >
              <span class="text-[13px] leading-none">{{ expanded ? '⊟' : '⊞' }}</span>
              <span>{{ expanded ? 'Shrink' : 'Full screen' }}</span>
            </button>
            <CloseDot variant="on-dark" aria-label="Close Spec Direct Relations" @click="emit('close')" />
          </div>
        </div>

        <!-- Canvas — scrollable; minimap is a separate shrink-0 footer BELOW this
             div so it is always visible regardless of canvas scroll depth. -->
        <div class="flex-1 min-h-0 overflow-auto p-6">
          <div
            ref="canvasEl"
            class="sdr-canvas relative flex items-start justify-center"
            style="min-height: 200px; gap: 0;"
            @click="infoNodeId = null"
          >

            <!-- SVG overlay — arrows drawn from real DOM coords; sits below cards (z-0) -->
            <svg
              class="absolute inset-0 pointer-events-none overflow-visible"
              style="width:100%; height:100%; z-index:0;"
              aria-hidden="true"
            >
              <defs>
                <marker id="sdr-arr-in"  markerWidth="12" markerHeight="9" refX="10" refY="4.5" orient="auto">
                  <polygon points="0 0 12 4.5 0 9" fill="#818cf8"/>
                </marker>
                <marker id="sdr-arr-out" markerWidth="12" markerHeight="9" refX="10" refY="4.5" orient="auto">
                  <polygon points="0 0 12 4.5 0 9" :fill="pal(central.type).badge"/>
                </marker>
              </defs>
              <!-- Incoming: right edge of node → left edge of central (cubic bezier, distributed Y) -->
              <path
                v-for="(a, i) in incomingArrows" :key="`in-${i}`"
                :d="`M ${a.x1},${a.y1} C ${(a.x1+a.x2)/2},${a.y1} ${(a.x1+a.x2)/2},${a.y2} ${a.x2},${a.y2}`"
                stroke="#818cf8" stroke-width="3.5" stroke-dasharray="12 7" fill="none"
                marker-end="url(#sdr-arr-in)" opacity="0.9"
                class="sdr-arrow-flow"
              />
              <!-- Outgoing: right edge of central → left edge of node (cubic bezier, distributed Y) -->
              <path
                v-for="(a, i) in outgoingArrows" :key="`out-${i}`"
                :d="`M ${a.x1},${a.y1} C ${(a.x1+a.x2)/2},${a.y1} ${(a.x1+a.x2)/2},${a.y2} ${a.x2},${a.y2}`"
                :stroke="pal(central.type).badge" stroke-width="3.5" stroke-dasharray="12 7" fill="none"
                marker-end="url(#sdr-arr-out)" opacity="0.9"
                class="sdr-arrow-flow"
              />
            </svg>

            <!-- LEFT: incoming nodes -->
            <div class="flex flex-col gap-5 z-10" style="min-width: 240px; max-width: 268px;">
              <template v-if="incoming.length">
                <div
                  v-for="(node, i) in incoming"
                  :key="node.id"
                  :ref="(el) => { incomingEls[i] = el as HTMLElement | null }"
                  class="sdr-node sdr-node-incoming"
                  :class="node.navigable ? 'sdr-navigable' : ''"
                  :style="`--pal-bg:${pal(node.type).bg}; --pal-stroke:${pal(node.type).stroke}; --pal-text:${pal(node.type).text}; --pal-sub:${pal(node.type).sub}`"
                  :title="node.navigable ? 'Click to see its direct relations' : undefined"
                  @click="pivotTo(node)"
                >
                  <div class="sdr-node-badge-row">
                    <div class="sdr-node-badge" :style="`background:${pal(node.type).badge}`">
                      <span class="sdr-glyph" v-html="GLYPHS[node.type] ?? ''"></span>
                      {{ TYPE_LABEL[node.type] }}
                    </div>
                    <button type="button" class="sdr-info-btn" :title="`About ${TYPE_LABEL[node.type]}`" @click.stop="toggleInfo(node.id, $event)">ⓘ</button>
                    <div v-if="infoNodeId === node.id" class="sdr-info-popup" @click.stop>
                      <span class="sdr-info-icon">{{ INFO_TEXT[node.type]?.icon }}</span>
                      <strong>{{ INFO_TEXT[node.type]?.title }}</strong>
                      <span>{{ INFO_TEXT[node.type]?.desc }}</span>
                    </div>
                  </div>
                  <div class="sdr-node-id">{{ node.label }}</div>
                  <div class="sdr-node-desc">{{ trunc(node.description, 90) }}</div>
                  <div v-if="node.extra" class="sdr-node-extra">{{ node.extra }}</div>
                  <div v-if="node.navigable" class="sdr-node-pivot">⬡ see relations</div>
                </div>
              </template>
              <div v-else class="text-white/30 text-xs italic text-center pt-8">No incoming links</div>
            </div>

            <!-- Spacer between left col and central -->
            <div style="width: 72px; flex-shrink: 0;" />

            <!-- CENTRAL node -->
            <div
              ref="centralEl"
              class="sdr-central z-20 flex-shrink-0"
              :style="`--glow:${pal(central.type).glow}; --pal-bg:${pal(central.type).bg}; --pal-stroke:${pal(central.type).stroke}; --pal-text:${pal(central.type).text}; --pal-sub:${pal(central.type).sub}; --pal-badge:${pal(central.type).badge}`"
            >
              <div class="sdr-node-badge-row">
                <div class="sdr-central-badge">
                  <span class="sdr-glyph" v-html="GLYPHS[central.type] ?? ''"></span>
                  {{ TYPE_LABEL[central.type] }}
                </div>
                <button type="button" class="sdr-info-btn" :title="`About ${TYPE_LABEL[central.type]}`" @click.stop="toggleInfo('__central__', $event)">ⓘ</button>
                <div v-if="infoNodeId === '__central__'" class="sdr-info-popup" @click.stop>
                  <span class="sdr-info-icon">{{ INFO_TEXT[central.type]?.icon }}</span>
                  <strong>{{ INFO_TEXT[central.type]?.title }}</strong>
                  <span>{{ INFO_TEXT[central.type]?.desc }}</span>
                </div>
              </div>
              <div class="sdr-central-id">{{ central.label }}</div>
              <div class="sdr-central-desc">{{ central.description }}</div>
              <div v-if="central.extra" class="sdr-central-extra">{{ central.extra }}</div>
            </div>

            <!-- Spacer between central and right col -->
            <div style="width: 72px; flex-shrink: 0;" />

            <!-- RIGHT: outgoing nodes -->
            <div class="flex flex-col gap-5 z-10" style="min-width: 240px; max-width: 268px;">
              <template v-if="outgoing.length">
                <div
                  v-for="(node, i) in outgoing"
                  :key="node.id"
                  :ref="(el) => { outgoingEls[i] = el as HTMLElement | null }"
                  class="sdr-node sdr-node-outgoing"
                  :class="node.navigable ? 'sdr-navigable' : ''"
                  :style="`--pal-bg:${pal(node.type).bg}; --pal-stroke:${pal(node.type).stroke}; --pal-text:${pal(node.type).text}; --pal-sub:${pal(node.type).sub}`"
                  :title="node.navigable ? 'Click to see its direct relations' : undefined"
                  @click="pivotTo(node)"
                >
                  <div class="sdr-node-badge-row">
                    <div class="sdr-node-badge" :style="`background:${pal(node.type).badge}`">
                      <span class="sdr-glyph" v-html="GLYPHS[node.type] ?? ''"></span>
                      {{ TYPE_LABEL[node.type] }}
                    </div>
                    <button type="button" class="sdr-info-btn" :title="`About ${TYPE_LABEL[node.type]}`" @click.stop="toggleInfo(node.id, $event)">ⓘ</button>
                    <div v-if="infoNodeId === node.id" class="sdr-info-popup" @click.stop>
                      <span class="sdr-info-icon">{{ INFO_TEXT[node.type]?.icon }}</span>
                      <strong>{{ INFO_TEXT[node.type]?.title }}</strong>
                      <span>{{ INFO_TEXT[node.type]?.desc }}</span>
                    </div>
                  </div>
                  <div class="sdr-node-id">{{ node.label }}</div>
                  <div class="sdr-node-desc">{{ trunc(node.description, 90) }}</div>
                  <div v-if="node.extra" class="sdr-node-extra">{{ node.extra }}</div>
                  <div v-if="node.navigable" class="sdr-node-pivot">⬡ see relations</div>
                </div>
              </template>
              <div v-else class="text-white/30 text-xs italic text-center pt-8">No outgoing links</div>
            </div>

          </div><!-- /canvas -->

          <!-- Relation count — inside scroll area so it follows the canvas -->
          <p class="text-[10px] text-white/30 text-right mt-3 px-1">
            {{ incoming.length }} incoming · {{ outgoing.length }} outgoing · click ⬡ on any node to pivot
          </p>
        </div><!-- /scroll area -->

        <!-- Mini-map sticky footer — outside the scroll area so it is ALWAYS visible.
             Tom 2026-05-16: "back to is covering the primary display" (earlier fix moved
             it out of the SVG canvas into the scroll area footer; now moved fully outside
             the overflow-auto div so it never scrolls off-screen).
             pb-20 clears the Actions button cluster (fixed bottom-6 right-6 z-[9999]). -->
        <div class="shrink-0 border-t border-white/10 bg-[rgba(10,8,28,0.6)] px-4 pt-3 pb-20">
          <SpecMiniMap
            :spec="spec"
            :evo-steps="evoSteps"
            :current-id="currentId"
            :current-tab="miniMapTab"
            :related-ids="relatedIds"
            @close="emit('back-to-diagram')"
            @pivot="handleMiniMapPivot"
            @go-evo="(name) => emit('go-to-evo', name)"
            @go-tasks="emit('go-to-tasks')"
          />
        </div>
      </div><!-- /panel -->
    </div><!-- /drawer wrapper -->
  </Teleport>
</template>

<style scoped>
/* ── Backdrop fade-in — overlay dims smoothly so the open feels intentional ─── */
.sdr-backdrop {
  animation: sdr-backdrop-in 0.22s ease-out both;
}
@keyframes sdr-backdrop-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* ── Panel entrance — slides in from the right ───────────────────────────────── */
.sdr-panel {
  animation: sdr-panel-in 0.26s cubic-bezier(0.22, 1, 0.36, 1) both;
  /* Width transition for full-screen toggle (Tom 2026-05-16) */
  transition: width 0.28s cubic-bezier(0.22, 1, 0.36, 1),
              min-width 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}
@keyframes sdr-panel-in {
  from { opacity: 0; transform: translateX(48px); }
  to   { opacity: 1; transform: translateX(0);    }
}

/* ── Central node ────────────────────────────────────────────────────────────── */
.sdr-central {
  width: 300px;
  min-height: 180px;
  background: var(--pal-bg);
  border: 2.5px solid var(--pal-stroke);
  border-radius: 18px;
  padding: 20px 22px 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  /* Pulsing glow — the "jazz" */
  animation: sdr-glow 1.8s ease-in-out infinite;
  position: relative;
  z-index: 20;
}
@keyframes sdr-glow {
  0%,100% { box-shadow: 0 0 0 0 rgba(var(--glow), 0.0),  0 4px 32px rgba(var(--glow), 0.18); }
  50%      { box-shadow: 0 0 0 14px rgba(var(--glow), 0.0), 0 4px 48px rgba(var(--glow), 0.45); }
}
.sdr-central-badge {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: white;
  background: var(--pal-badge);
  border-radius: 999px;
  padding: 2px 8px;
  align-self: flex-start;
}
.sdr-central-id {
  font-size: 11px;
  font-weight: 700;
  color: var(--pal-text);
  font-family: ui-monospace, 'SF Mono', monospace;
  animation: sdr-id-vibrate 0.5s linear infinite;
}
@keyframes sdr-id-vibrate {
  0%,100% { transform: translate(0, 0); }
  20%     { transform: translate(-1px, 0.3px); }
  40%     { transform: translate(1px, -0.3px); }
  60%     { transform: translate(-0.5px, 0.5px); }
  80%     { transform: translate(0.5px, -0.5px); }
}
.sdr-central-desc {
  font-size: 14px;
  font-weight: 600;
  color: var(--pal-text);
  line-height: 1.45;
}
.sdr-central-extra {
  font-size: 10.5px;
  color: var(--pal-sub);
  margin-top: 2px;
  line-height: 1.4;
}

/* ── Relation nodes ──────────────────────────────────────────────────────────── */
.sdr-node {
  background: var(--pal-bg);
  border: 1.5px solid var(--pal-stroke);
  border-radius: 12px;
  padding: 10px 14px 9px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  animation: sdr-node-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) both;
  transition: transform 0.15s, box-shadow 0.15s;
}
.sdr-node-incoming { animation-delay: 0.05s; }
.sdr-node-outgoing { animation-delay: 0.10s; }
@keyframes sdr-node-in {
  from { opacity: 0; transform: scale(0.88); }
  to   { opacity: 1; transform: scale(1);    }
}
.sdr-navigable {
  cursor: pointer;
}
.sdr-navigable:hover {
  transform: scale(1.03);
  box-shadow: 0 4px 24px rgba(0,0,0,0.18);
}
.sdr-node-badge {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.10em;
  color: white;
  border-radius: 999px;
  padding: 1px 6px;
  align-self: flex-start;
}
.sdr-node-id {
  font-size: 9.5px;
  font-weight: 700;
  color: var(--pal-text);
  font-family: ui-monospace, 'SF Mono', monospace;
}
.sdr-node-desc {
  font-size: 11px;
  font-weight: 500;
  color: var(--pal-text);
  line-height: 1.38;
}
.sdr-node-extra {
  font-size: 9.5px;
  color: var(--pal-sub);
  line-height: 1.3;
}
.sdr-node-pivot {
  font-size: 8.5px;
  font-weight: 700;
  color: var(--pal-stroke);
  margin-top: 2px;
  letter-spacing: 0.04em;
}

/* ── Glyph badge row ─────────────────────────────────────────────────────────── */
.sdr-node-badge-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
  align-self: flex-start;
}
.sdr-glyph {
  display: inline-flex;
  align-items: center;
  margin-right: 3px;
  vertical-align: middle;
  line-height: 1;
}
.sdr-info-btn {
  font-size: 11px;
  color: rgba(0, 0, 0, 0.35);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0 2px;
  line-height: 1;
  transition: color 0.15s;
  flex-shrink: 0;
  user-select: none;
}
.sdr-info-btn:hover { color: rgba(0, 0, 0, 0.7); }
.sdr-info-popup {
  position: absolute;
  top: calc(100% + 5px);
  left: 0;
  z-index: 120;
  background: #1e1b4b;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 10px;
  padding: 8px 11px 9px;
  min-width: 190px;
  max-width: 230px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45);
  pointer-events: auto;
}
.sdr-info-popup .sdr-info-icon {
  font-size: 9.5px;
  font-family: ui-monospace, 'SF Mono', monospace;
  color: rgba(255, 255, 255, 0.45);
  letter-spacing: 0.06em;
}
.sdr-info-popup strong {
  font-size: 11px;
  font-weight: 700;
  color: white;
}
.sdr-info-popup span:not(.sdr-info-icon) {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.72);
  line-height: 1.42;
}

/* ── Animated arrows ─────────────────────────────────────────────────────────── */
/* Tom 2026-05-16: "arrows do not connect, bigger too!" — replaced the broken
   fixed-width SVG div with a full-canvas absolute SVG overlay whose line coords
   come from getBoundingClientRect. stroke-width 3.5, marker 12×9, dasharray 12 7.
   Both incoming and outgoing flow LEFT→RIGHT (in path direction) via same keyframe. */
.sdr-arrow-flow {
  animation: sdr-flow 1.1s linear infinite;
}
@keyframes sdr-flow {
  from { stroke-dashoffset: 19; }
  to   { stroke-dashoffset: 0; }
}
</style>
