<!-- UNIT_TYPE=Surface
  ValueAspectsPanel.vue — Value Aspects Articulation Tool.

  Designed by Tom Gilb 11 June 2026. 22:45 CET.

  "For large and complex systems (military, national, health, space) a simple one-Scale
   definition of the Value is too simple. The planner might appreciate the option to use
   a more-sophisticated specification of a value."

  Architecture:
    - Parent V. entry is the elaboration target
    - Planner picks a Category (Usability / Quality / Maintainability / Resilience / etc.)
    - Tool seeds 8-12 Aspect candidates per category from valueAspectSeeds.ts
    - Each Aspect has: Scale + Meter + Tolerable + Goal + Wish (+ optional Stretch + Conditions)
    - Planner edits / deletes / adds Aspects
    - Apply + Lock in per-Aspect OR whole set
    - All mutations stamped with Source: "Value Aspects Articulation Tool · <category> @ <time>"

  UI Rules applied:
    - CloseDot at END of header — Universal Close-Button Rule
    - Raw overflow-y-auto on body per r93r/r93t (centered Teleport card exception)
    - z-[615] panel / z-[610] backdrop — r93tt: must be ABOVE PentaPanel (which is at
      z-[590]/z-[595]) because Value Aspects is OPENED FROM Penta and must overlay it.
      Original z-[485]/z-[490] caused all clicks to land on PentaPanel below ("clicking is dead").
    - All buttons have title= — DD-009 Interaction Disclosure
    - Big fonts per accessibility_tom.md
    - R/G-colorblind-safe palette per r93o (emerald/red distinguishable at size)
    - Universal Undo via Apply emits — host wires into useUndoHistory
-->

<script setup lang="ts">
import { ref, computed } from 'vue'
import CloseDot from './CloseDot.vue'
import QualifiersBar from './QualifiersBar.vue'
import ValueAspectsGlyph from './icons/ValueAspectsGlyph.vue'
import { qualifiersHtml as _renderQualifiersHtml, qualifiersPlain as _renderQualifiersPlain } from '../composables/useQualifiersRender'
import { useValueAspects } from '../composables/useValueAspects'
// r93ww — Export-on-all-windows SUPREME rule applied; r93ll Completeness Pledge; r93mm HoverHint
import { exportCopy, exportEmail } from '../composables/useExportShared'
import { useToast } from '../composables/useToast'
const { showToast: _aspectsToast } = useToast()
import {
  VALUE_ASPECT_CATEGORY_META,
  type ValueAspectCategory,
  type ValueAspectSet,
  type ValueAspectSpec,
} from '../types/valueAspects'
import { TOM_PRIORITY_CATEGORIES } from '../data/valueAspectSeeds'

const props = defineProps<{
  /** The parent V. entry this set elaborates. */
  parentValueId:   string
  /** Human-readable label of the parent Value (for display only). */
  parentValueName: string
  /** Optional: existing Scale shown at the top so planner sees the "before". */
  parentScale?:    string
  /** Optional: existing Tolerable / Goal / Wish to display. */
  parentTolerable?: string
  parentGoal?:      string
  parentWish?:      string
}>()

const emit = defineEmits<{
  close: []
  /** Emitted when planner clicks "Apply Selected to Master". Host wires into spec mutation
   *  + Universal Undo + Cascade Ripple. */
  'apply-aspects': [payload: {
    setId: string
    aspects: ValueAspectSpec[]
    umbrellaTag: string
    /** r93sss — apply mode: 'keep-and-add' (default, preserves original Value as
     *  a sub-Value inside the Umbrella set) or 'replace' (deletes original Value,
     *  replaces with Umbrella + Aspects). Per-Aspect Apply always 'keep-and-add'. */
    applyMode: 'keep-and-add' | 'replace'
    parentValueId: string
    parentValueName: string
  }]
}>()

const {
  setsFor,
  createSetFromCategory,
  addAspect,
  deleteAspect,
  updateAspect,
  lockAspect,
  lockSet,
  deleteSet,
  renameSet,
} = useValueAspects()

const sets = setsFor(props.parentValueId)
const activeSetId = ref<string | null>(null)
const activeSet = computed<ValueAspectSet | null>(() => {
  if (!activeSetId.value) return sets.value[0] ?? null
  return sets.value.find(s => s.id === activeSetId.value) ?? null
})

/** r93eee — Active category colour (one of: emerald, violet, amber, red, slate,
 *  blue, indigo, rose, teal, orange). Drives the Umbrella Tag + Spec Tag tile
 *  palettes below. Falls back to violet (Aspects-family colour) if no active set. */
const activeCategoryColor = computed<string>(() => {
  if (!activeSet.value) return 'violet'
  return VALUE_ASPECT_CATEGORY_META[activeSet.value.category as ValueAspectCategory]?.color ?? 'violet'
})

/** r93eee + r93ggg TLC pass — UMBRELLA TAG tile palette (the Set name, hierarchical parent).
 *  Tom Gilb 2026-06-12: "the Umbrella Tag (thats a term, for a tag that simply
 *  points to a set of specs). It is also the Tag we use in a hierarchy.
 *  'Umbrella Tag.Spec Tag'... make it more dominant with size and color."
 *  + Tom 2026-06-12 r93ggg: *"umbrella tag at top need tlc"* — bumped bg saturation
 *  from -100 → -200 and ring -500 → -600 so the Umbrella visibly dominates the
 *  Spec child tile (bg-{c}-50 / ring-{c}-400) by ONE saturation step. Parent-
 *  before-child visual hierarchy preserved. */
const UMBRELLA_PALETTE: Record<string, string> = {
  emerald: 'bg-emerald-200 ring-emerald-600 text-emerald-950',
  violet:  'bg-violet-200  ring-violet-600  text-violet-950',
  amber:   'bg-amber-200   ring-amber-600   text-amber-950',
  red:     'bg-red-200     ring-red-600     text-red-950',
  slate:   'bg-slate-300   ring-slate-600   text-slate-950',
  blue:    'bg-blue-200    ring-blue-600    text-blue-950',
  indigo:  'bg-indigo-200  ring-indigo-600  text-indigo-950',
  rose:    'bg-rose-200    ring-rose-600    text-rose-950',
  teal:    'bg-teal-200    ring-teal-600    text-teal-950',
  orange:  'bg-orange-200  ring-orange-600  text-orange-950',
}

/** r93eee — SPEC TAG tile palette (the Aspect name, hierarchical child).
 *  Lighter background than the Umbrella so the parent–child relationship reads
 *  visually. Same hue family — reinforces "they belong together". */
const SPEC_TAG_PALETTE: Record<string, string> = {
  emerald: 'bg-emerald-50 ring-emerald-400 focus-within:ring-emerald-600 text-emerald-950',
  violet:  'bg-violet-50  ring-violet-400  focus-within:ring-violet-600  text-violet-950',
  amber:   'bg-amber-50   ring-amber-400   focus-within:ring-amber-600   text-amber-950',
  red:     'bg-red-50     ring-red-400     focus-within:ring-red-600     text-red-950',
  slate:   'bg-slate-100  ring-slate-400   focus-within:ring-slate-600   text-slate-950',
  blue:    'bg-blue-50    ring-blue-400    focus-within:ring-blue-600    text-blue-950',
  indigo:  'bg-indigo-50  ring-indigo-400  focus-within:ring-indigo-600  text-indigo-950',
  rose:    'bg-rose-50    ring-rose-400    focus-within:ring-rose-600    text-rose-950',
  teal:    'bg-teal-50    ring-teal-400    focus-within:ring-teal-600    text-teal-950',
  orange:  'bg-orange-50  ring-orange-400  focus-within:ring-orange-600  text-orange-950',
}

const umbrellaTileClass = computed<string>(() => UMBRELLA_PALETTE[activeCategoryColor.value] ?? UMBRELLA_PALETTE.violet)
const specTagTileClass  = computed<string>(() => SPEC_TAG_PALETTE[activeCategoryColor.value]  ?? SPEC_TAG_PALETTE.violet)

/** Hierarchy-dot colour matches the active category so the "." reads as one
 *  visual chain (Umbrella → . → Spec) rather than three separate elements. */
const HIERARCHY_DOT_PALETTE: Record<string, string> = {
  emerald: 'text-emerald-600',
  violet:  'text-violet-600',
  amber:   'text-amber-600',
  red:     'text-red-600',
  slate:   'text-slate-600',
  blue:    'text-blue-600',
  indigo:  'text-indigo-600',
  rose:    'text-rose-600',
  teal:    'text-teal-600',
  orange:  'text-orange-600',
}
const hierarchyDotClass = computed<string>(() => HIERARCHY_DOT_PALETTE[activeCategoryColor.value] ?? HIERARCHY_DOT_PALETTE.violet)

/** Category picker open when no sets exist OR when planner explicitly opens it. */
const pickerOpen = ref(true)
function pickCategory(cat: ValueAspectCategory): void {
  const set = createSetFromCategory(props.parentValueId, cat)
  activeSetId.value = set.id
  pickerOpen.value  = false
}

/** Toggle prior-art info section. */
const infoOpen = ref(false)

/** Inline edit state per Aspect — keyed by aspectId. */
const editingAspectId = ref<string | null>(null)

/**
 * r93sss — Apply mode (Tom Gilb 2026-06-12).
 *
 * Tom verbatim: *"I can see a need to keep it as is, or edit it, and let is with
 * its [Scale] etc become one of the subvalues, Can you design things so that this
 * option is clear: Replace xxx with the new set, or Keep the initial value VVVVV,
 * in the set with the Umbrella Tag TTTTT"*.
 *
 * Two clear modes for how the original parent Value relates to the new Umbrella set:
 *   - 'keep-and-add'  (DEFAULT, recommended): the original Value is preserved AND
 *     becomes one of the sub-Values inside the Umbrella set. Its Scale/Meter/
 *     Tolerable/Goal/Wish are kept verbatim; its tag is rewritten to
 *     `<Umbrella>.<original-name>` so it sits as a sibling of the generated Aspects.
 *     No data loss. Composes with No-Silent-Data-Loss SUPREME.
 *   - 'replace': the original Value entry is DELETED from the master spec and
 *     replaced by the Umbrella + its set of Aspects. Original Scale lives only in
 *     the new Aspects (or vanishes if no Aspect covers it). Reversible via Universal
 *     Undo SUPREME (⌘Z restores the deleted entry).
 *
 * Default is 'keep-and-add' — the conservative path per No-Silent-Data-Loss.
 */
const applyMode = ref<'keep-and-add' | 'replace'>('keep-and-add')

function applyToMaster(set: ValueAspectSet): void {
  // Lock everything before emit so host receives the locked-in snapshot
  lockSet(set.id, props.parentValueId, true)
  const refreshed = sets.value.find(s => s.id === set.id) ?? set
  emit('apply-aspects', {
    setId: set.id,
    aspects: refreshed.aspects,
    umbrellaTag: refreshed.name,
    applyMode: applyMode.value,
    parentValueId: props.parentValueId,
    parentValueName: props.parentValueName ?? props.parentValueId,
  })
}

function applyOneToMaster(set: ValueAspectSet, aspect: ValueAspectSpec): void {
  lockAspect(set.id, props.parentValueId, aspect.id, true)
  // Per-Aspect Apply always uses 'keep-and-add' semantics — replacing the whole
  // parent Value with ONE aspect doesn't make sense; supplementation is the
  // only sensible single-Aspect mode.
  emit('apply-aspects', {
    setId: set.id,
    aspects: [{ ...aspect, locked: true }],
    umbrellaTag: set.name,
    applyMode: 'keep-and-add',
    parentValueId: props.parentValueId,
    parentValueName: props.parentValueName ?? props.parentValueId,
  })
}

function _onAspectFieldInput(
  setId: string,
  aspectId: string,
  field: keyof ValueAspectSpec | `conditions.${'time' | 'place' | 'event'}`,
  e: Event,
): void {
  const target = e.target as HTMLInputElement | HTMLTextAreaElement
  // r93qqq — support dotted `conditions.time|place|event` paths from the Qualifiers
  // bar. Top-level fields fall through to the simple shape used elsewhere.
  if (field.startsWith('conditions.')) {
    const subField = field.split('.')[1] as 'time' | 'place' | 'event'
    // Read current aspect to merge — don't blow away other condition fields.
    const set = sets.value.find(s => s.id === setId)
    const aspect = set?.aspects.find(a => a.id === aspectId)
    const prev = aspect?.conditions ?? {}
    updateAspect(setId, props.parentValueId, aspectId, {
      conditions: { ...prev, [subField]: target.value },
    })
    return
  }
  updateAspect(setId, props.parentValueId, aspectId, { [field as keyof ValueAspectSpec]: target.value })
}

// ─── r93ww — Export (Copy + Email) — Tom Gilb 2026-06-12 ───────────────────
//
// "did we agree that ALL windows, and particularly scrolled one, would have export?
//  this is important so people can take this long list, off line, in virtual distributed
//  environments, and think about it and discuss with local colleagues!" — Tom Gilb 2026-06-12
//
// Honours: Export-on-all-windows SUPREME rule, r93ll Completeness Pledge (every section
// the panel CAN show is INCLUDED — Info popover content, every set the planner has
// created for this Value, every Aspect in every set, lineage, patent attribution),
// r93mm HoverHint enumeration (button HoverHints enumerate what is included), r93nn
// (mailto body is just the LOUD ⌘V cue + edit space, no duplicate plain text), r93oo
// (visual content rendered, not described — the SVG glyph embedded inline).

function _escHtml(s: string | null | undefined): string {
  if (s == null) return ''
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function renderAspectsHtml(): string {
  // r93aaa (Tom Gilb 2026-06-12 "this paste is a bit messy. it comes out at about 6 stacked
  // files, we need it to hang together as it does in the window — applies to all pastes in sem").
  // RESTRUCTURED as ONE outer <table> with sequential <tr> rows. Previously this renderer used
  // multiple nested <table> elements (one per set + multiple framing tables), which Keynote
  // splits into separate free-floating Keynote tables on paste. The same pattern Tom flagged
  // on 2026-06-04 ("Keynote splits nested tables into SEPARATE Keynote tables") that was banned
  // in the Colorful HTML Spec Email Rule — I shipped it anyway. Now: ZERO nested <table>. Each
  // logical section is a sequence of <tr> rows in the SAME outer table. The per-Aspect grid of
  // Scale/Meter/Tolerable/Goal/Wish is rendered as inline <div> rows within a single <td>, not
  // a nested <table>. Result: ONE cohesive document that pastes as ONE Keynote table or ONE
  // Mail block — "hangs together as it does in the window" per Tom's verbatim request.
  const date = new Date().toISOString().slice(0, 10)
  const setsForValue = sets.value
  const fieldRow = (label: string, value: string | undefined, colorHex: string) =>
    value
      ? `<div style="padding:2px 0;line-height:1.45;"><span style="color:${colorHex};font-weight:bold;font-family:ui-monospace,monospace;display:inline-block;min-width:78px;">${label}:</span> <span style="font-family:ui-monospace,monospace;color:#1e293b;">${_escHtml(value)}</span></div>`
      : ''
  // r93fff (Tom Gilb 2026-06-12 verbatim Planguage book convention): "I always in
  // Planguage, see all my books, have the spec tag uppermost, followed by a colon,
  // that means you can easily make it big, and have it long, and readability demands
  // both." The exported Aspect now leads with `Umbrella.Spec:` rendered BIG (20 px
  // mono-extrabold) above the parameter cascade — matches every Gilb book's spec
  // entry layout. Parameters indent below as `Scale: ...` rows (already inline).
  const aspectRow = (a: ValueAspectSpec, umbrellaName: string) => `
  <tr><td bgcolor="#fafafa" style="background:#fafafa;padding:12px 24px;border-left:4px solid #7c3aed;border-bottom:1px solid #e5e7eb;">
    <div style="font-size:20px;font-weight:900;color:#1e1b4b;font-family:ui-monospace,monospace;line-height:1.25;letter-spacing:-0.01em;">
      <span style="color:#5b21b6;">${_escHtml(umbrellaName)}</span><span style="color:#a78bfa;font-weight:900;">.</span><span style="color:#1e1b4b;">${_escHtml(a.name)}</span><span style="color:#5b21b6;font-weight:900;">:</span>${a.locked ? ' <span style="display:inline-block;margin-left:8px;padding:2px 8px;background:#d1fae5;color:#065f46;font-size:10px;border-radius:10px;vertical-align:middle;">🔒 Applied to Master</span>' : ''}
    </div>
    ${a.rationale ? `<div style="font-size:11px;color:#64748b;font-style:italic;margin-top:6px;line-height:1.45;">${_escHtml(a.rationale)}</div>` : ''}
    <div style="margin-top:8px;font-size:12px;padding-left:12px;">
      ${fieldRow('Scale',     a.scale,     '#7c3aed')}
      ${fieldRow('Meter',     a.meter,     '#7c3aed')}
      ${fieldRow('Tolerable', a.tolerable, '#b45309')}
      ${fieldRow('Goal',      a.goal,      '#15803d')}
      ${fieldRow('Wish',      a.wish,      '#1d4ed8')}
      ${fieldRow('Stretch',   a.stretch,   '#0891b2')}
    </div>
    ${_renderQualifiersHtml(a.conditions, { entryName: a.name, levelLabel: 'Goal', levelValue: a.goal, forceTrap: true })}
  </td></tr>`
  const setRows = (set: ValueAspectSet) => `
  <tr><td bgcolor="#7c3aed" style="background:#7c3aed;color:white;padding:12px 24px;font-size:13px;font-weight:bold;letter-spacing:0.5px;">
    ${_escHtml(set.name)} · ${set.aspects.length} Aspect${set.aspects.length === 1 ? '' : 's'} · Category: ${_escHtml(set.category)}
  </td></tr>
  ${set.rationale ? `<tr><td bgcolor="#faf5ff" style="background:#faf5ff;padding:8px 24px;font-size:11px;color:#5b21b6;font-style:italic;">${_escHtml(set.rationale)}</td></tr>` : ''}
  ${set.aspects.map(a => aspectRow(a, set.name)).join('')}`

  // r93aaa: ONE outer <table>. Every section is one <tr>. NO nested <table> anywhere.
  return `
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:900px;font-family:system-ui,-apple-system,sans-serif;border-collapse:collapse;">
  <tr><td bgcolor="#7c3aed" style="background:#7c3aed;color:white;padding:20px 24px;border-radius:12px 12px 0 0;">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:2px;opacity:0.85;">🧬 Value Aspects Articulation Tool · Designed by Tom Gilb · 11 Jun 2026 · 22:45 CET</div>
    <div style="font-size:24px;font-weight:900;margin-top:8px;">${_escHtml(props.parentValueName || props.parentValueId)}</div>
    <div style="font-size:13px;opacity:0.9;margin-top:4px;font-style:italic;">"Things should be as simple as possible, but no simpler." — T. Gilb (PoSEM p.17)</div>
    <div style="font-size:11px;opacity:0.8;margin-top:8px;">Exported: ${date} · ${setsForValue.length} set${setsForValue.length === 1 ? '' : 's'} for this Value</div>
  </td></tr>
  ${(props.parentScale || props.parentTolerable || props.parentGoal || props.parentWish) ? `
  <tr><td bgcolor="#f8fafc" style="background:#f8fafc;padding:12px 24px;border-bottom:1px solid #e2e8f0;font-size:12px;">
    <div style="font-weight:bold;color:#0f172a;margin-bottom:4px;">Parent Value baseline (the one-Scale form being elaborated):</div>
    ${fieldRow('Scale',     props.parentScale,     '#7c3aed')}
    ${fieldRow('Tolerable', props.parentTolerable, '#b45309')}
    ${fieldRow('Goal',      props.parentGoal,      '#15803d')}
    ${fieldRow('Wish',      props.parentWish,      '#1d4ed8')}
  </td></tr>` : ''}
  ${setsForValue.length > 0
    ? setsForValue.map(setRows).join('')
    : '<tr><td style="padding:18px 24px;font-style:italic;color:#64748b;">No Aspect sets created yet for this Value.</td></tr>'}
  <tr><td bgcolor="#eef2ff" style="background:#eef2ff;padding:16px 24px;border-top:3px solid #6366f1;">
    <div style="font-size:11px;font-weight:bold;text-transform:uppercase;color:#3730a3;letter-spacing:1px;">Prior-Art Research &amp; Tom Gilb Publication Lineage</div>
    <div style="font-size:12px;color:#1e293b;line-height:1.5;margin-top:8px;">
      Prior art reviewed: ISO 25010 (static taxonomy), ATAM (post-hoc evaluation), QFD/HoQ (matrix spreadsheet), NFR Framework (informal softgoals), GORE/i*/KAOS (goal refinement, not Planguage).
    </div>
    <div style="font-size:12px;color:#1e293b;line-height:1.5;margin-top:8px;">
      <b>Tom Gilb 50-year publication lineage:</b> Software Metrics (1976 UK / 1977 USA) → all succeeding Gilb books 1976-1988 → Principles of Software Engineering Management (PoSEM, 1988) with the celebrated Bank Case → Competitive Engineering Ch.5 "Multi" (2005) → Resilience (2023).
    </div>
    <div style="font-size:12px;color:#1e293b;line-height:1.5;margin-top:8px;font-style:italic;">
      World-first claim: the first interactive AI-assisted Aspects-elaboration tool combining Planguage Scale/Meter/Tolerable/Goal/Wish per Aspect with IET-style impact projection AND dual-mode (single-Aspect OR full-set) generation, grounded in Tom Gilb's 50-year publication lineage. — Designed by Tom Gilb 11 June 2026 · 22:45 CET.
    </div>
  </td></tr>
  <tr><td bgcolor="#fef2f2" style="background:#fef2f2;padding:16px 24px;">
    <div style="font-size:11px;font-weight:bold;text-transform:uppercase;color:#991b1b;letter-spacing:1px;">⚠️ Why Qualifiers Matter — The INFINITY TRAP (Tom Gilb 2026-06-12)</div>
    <div style="font-size:12px;color:#1e293b;line-height:1.5;margin-top:8px;">
      A scalar level (Tolerable / Goal / Wish / Stretch) without Qualifiers silently commits the plan to <b>infinity</b>. The Planguage Glossary (Tom Gilb) recognises THREE canonical classes of Qualifier Condition — omitting any opens an infinite scope on that class:
    </div>
    <div style="font-size:12px;color:#1e293b;line-height:1.6;margin-top:8px;font-family:ui-monospace,monospace;">
      • No TIME ("when") → INFINITE future time<br/>
      • No PLACE ("where") → INFINITE places (geography, user roles, components, market segments)<br/>
      • No EVENT ("if") → applies <b>no matter what</b> — war or peace, as Tolstoy said
    </div>
    <div style="font-size:11px;color:#475569;font-style:italic;margin-top:8px;padding:6px 10px;background:#f8fafc;border-radius:4px;">
      Per Planguage Glossary *124 (Qualifier) + *666 (Qualifier Condition): all conditions in <code>[A, B, C]</code> must be true simultaneously (AND logic, definitional). A missing class = an open door to infinity.
    </div>
    <div style="font-size:12px;color:#7f1d1d;line-height:1.5;margin-top:8px;padding:8px 12px;background:white;border:1px solid #fecaca;border-radius:6px;font-weight:bold;">
      INFINITY (no finiteness with Qualifiers) = INFINITE COSTS + FINITE CERTAINTY OF FAILURE to have enough resources to deliver Value in INFINITE SPACE AND TIME.
    </div>
    <div style="font-size:12px;color:#065f46;line-height:1.5;margin-top:8px;padding:8px 12px;background:#ecfdf5;border:1px solid #6ee7b7;border-radius:6px;">
      <b>Finiteness creates feasibility.</b> Bound a Goal in Time + Place + Event → finite resource envelope → can be funded, scheduled, measured, delivered. Bounded commitments are the only kind that ship.
    </div>
    <div style="font-size:11px;color:#475569;font-style:italic;margin-top:8px;">
      Canonical sources — at-a-click via the <a href="https://www.gilb.com/tomtwin/login" style="color:#5b21b6;font-weight:bold;">Tom Gilb Consultant Twin</a> (by Kai Gilb — intelligent ontology-backed search; books free, deeper consultation supports continued development):<br/>
      • <a href="https://www.gilb.com/tomtwin/concept/Qualifier.124" style="color:#6d28d9;">*124 Qualifier (Planguage Glossary, added 2004-07-29)</a><br/>
      • <a href="https://www.gilb.com/tomtwin/concept/Qualifier-Condition.666" style="color:#6d28d9;">*666 Qualifier Condition (Planguage Glossary, added 2021-06-03)</a><br/>
      Composes with: Competitive Engineering 6.6 (Cost of Perfection + Rolls Royce + Principle 3); ASPECTS: The Aspect Engine (T. Gilb, 28 Apr 2026) p. 30 + § 2.0 p. 23; Tom Gilb verbatim 2026-06-12.
    </div>
  </td></tr>
  <tr><td bgcolor="#fef3c7" style="background:#fef3c7;padding:16px 24px;">
    <div style="font-size:11px;font-weight:bold;text-transform:uppercase;color:#7c2d12;letter-spacing:1px;">⚖️ Patent Pending — Co-Inventors Tom Gilb &amp; Kai Gilb</div>
    <div style="font-size:12px;color:#1e293b;line-height:1.5;margin-top:8px;">
      <b>Invention:</b> Multi-Level Value-Driven Delegation, Governance, and Improvement of Generative Artificial Intelligence Agents
    </div>
    <div style="font-size:12px;color:#1e293b;font-family:ui-monospace,monospace;line-height:1.5;margin-top:6px;">
      Docket No.: 24-142KG · Serial No.: 64/088,267 · Filing Date: June 11, 2026
    </div>
    <div style="font-size:12px;color:#1e293b;line-height:1.5;margin-top:8px;">
      System name: <b>KaiZen</b>, built by Kai Gilb on Planguage (per Tom Gilb's CE and PoSEM books). KaiZen spawns <b>Tom's Twin</b> (Kai's industrial Planguage application) AND the <b>SEM App</b> (Tom's design sandbox for new planning features destined to be ported into the Twin). The Value Aspects Articulation Tool is one such design contribution.
    </div>
  </td></tr>
  <tr><td bgcolor="#f1f5f9" style="background:#f1f5f9;padding:14px 24px;border-radius:0 0 12px 12px;font-size:11px;color:#475569;">
    <b>Completeness Pledge (r93ll / r93ww / r93aaa):</b> this export includes every section the Value Aspects panel can show — every Aspect set across all categories the planner has seeded for this Value, every Aspect with its full Scale/Meter/Tolerable/Goal/Wish/(Stretch), per-Aspect rationale, per-Aspect locked state, the parent Value baseline, the prior-art research, the Tom Gilb publication lineage, and the Patent Pending attribution — even content currently collapsed (Info popover) or below the fold in the live panel. The interactive editing UI is environment-specific; recipients receive the static snapshot for offline distributed-team review. Structured as ONE outer table with zero nested tables, so the entire document hangs together as ONE Keynote/Mail block on paste.
  </td></tr>
</table>`
}

function renderAspectsPlain(): string {
  // r93zz (Tom Gilb 2026-06-12 "same problem the info is exported incomplete") — the plain
  // text variant MUST be complete per the r93ll Completeness Pledge. Previously this was a
  // lazy pointer to the HTML — wrong for any paste target that only accepts plain text
  // (Apple Mail compose body in plain mode, Slack, terminals, archival text files, screen
  // readers, etc). Plain text now mirrors EVERY section of the HTML.
  const date = new Date().toISOString().slice(0, 10)
  const setsForValue = sets.value
  const SEP_THICK = '═'.repeat(72)
  const SEP_THIN  = '─'.repeat(72)
  const lines: string[] = []
  lines.push(SEP_THICK)
  lines.push(`🧬 VALUE ASPECTS ARTICULATION TOOL`)
  lines.push(`Designed by Tom Gilb · 11 June 2026 · 22:45 CET`)
  lines.push(SEP_THICK)
  lines.push('')
  lines.push(`Parent Value:  ${props.parentValueName || props.parentValueId}`)
  lines.push(`Exported:      ${date}`)
  lines.push(`Sets:          ${setsForValue.length}`)
  lines.push('')
  lines.push(`"Things should be as simple as possible, but no simpler." — T. Gilb (PoSEM p.17)`)
  lines.push('')
  // Parent Value baseline strip
  if (props.parentScale || props.parentTolerable || props.parentGoal || props.parentWish) {
    lines.push(SEP_THIN)
    lines.push(`PARENT VALUE BASELINE (the one-Scale form being elaborated)`)
    lines.push(SEP_THIN)
    if (props.parentScale)     lines.push(`Scale:     ${props.parentScale}`)
    if (props.parentTolerable) lines.push(`Tolerable: ${props.parentTolerable}`)
    if (props.parentGoal)      lines.push(`Goal:      ${props.parentGoal}`)
    if (props.parentWish)      lines.push(`Wish:      ${props.parentWish}`)
    lines.push('')
  }
  // Every set + every Aspect
  if (setsForValue.length === 0) {
    lines.push('(no Aspect sets created yet for this Value)')
    lines.push('')
  } else {
    for (const set of setsForValue) {
      lines.push(SEP_THICK)
      lines.push(`SET: ${set.name}`)
      lines.push(`Category: ${set.category} · ${set.aspects.length} Aspect${set.aspects.length === 1 ? '' : 's'}`)
      if (set.rationale) lines.push(`Rationale: ${set.rationale}`)
      lines.push(SEP_THICK)
      lines.push('')
      for (const a of set.aspects) {
        // r93fff — Planguage book convention: spec tag uppermost, ends with colon.
        // Tom Gilb verbatim 2026-06-12: "I always in Planguage, see all my books,
        // have the spec tag uppermost, followed by a colon, that means you can
        // easily make it big, and have it long, and readability demands both."
        // Plain-text mirror: `Umbrella.Spec:` on its own line, parameters cascade below.
        lines.push(`${set.name}.${a.name}:${a.locked ? '   🔒 APPLIED TO MASTER' : ''}`)
        if (a.rationale) lines.push(`   Rationale: ${a.rationale}`)
        if (a.scale)     lines.push(`   Scale:     ${a.scale}`)
        if (a.meter)     lines.push(`   Meter:     ${a.meter}`)
        if (a.tolerable) lines.push(`   Tolerable: ${a.tolerable}`)
        if (a.goal)      lines.push(`   Goal:      ${a.goal}`)
        if (a.wish)      lines.push(`   Wish:      ${a.wish}`)
        if (a.stretch)   lines.push(`   Stretch:   ${a.stretch}`)
        // r93rrr — shared plain-text Qualifiers renderer (replaces r93qqq inline)
        for (const ql of _renderQualifiersPlain(a.conditions, { entryName: a.name, levelLabel: 'Goal', levelValue: a.goal, forceTrap: true })) {
          lines.push(`   ${ql}`)
        }
        lines.push('')
      }
    }
  }
  // Prior-Art Research + Tom Gilb Publication Lineage
  lines.push(SEP_THICK)
  lines.push(`PRIOR-ART RESEARCH & TOM GILB PUBLICATION LINEAGE`)
  lines.push(SEP_THICK)
  lines.push(`Prior art reviewed (none matches all four properties — interactive,`)
  lines.push(`AI-assisted, Planguage-grounded, IET-style Impact projection):`)
  lines.push(`  · ISO 25010 (2011)  — static 8-characteristic taxonomy`)
  lines.push(`  · ATAM (Kazman/SEI, 2000) — post-hoc architecture evaluation`)
  lines.push(`  · QFD / House of Quality (Akao 1966) — static matrix spreadsheet`)
  lines.push(`  · NFR Framework (Chung & Mylopoulos 1993) — informal softgoals`)
  lines.push(`  · GORE / i* / KAOS / Tropos — goal refinement, not Planguage`)
  lines.push('')
  lines.push(`Tom Gilb 50-year publication lineage of multi-Scale "Aspects":`)
  lines.push(`  · Software Metrics (1976 UK, 1977 USA) — foundational text`)
  lines.push(`  · All succeeding Gilb books 1976-1988 — successive refinement`)
  lines.push(`  · Principles of Software Engineering Management (PoSEM, 1988)`)
  lines.push(`      — canonical synthesis; celebrated Bank Case detailed examples`)
  lines.push(`  · Competitive Engineering Ch.5 "Multi" (2005)`)
  lines.push(`      — formal Planguage naming of the multi-Scale technique`)
  lines.push(`  · Resilience (2023) — applied to systemic resilience`)
  lines.push('')
  lines.push(`World-first claim: the first interactive AI-assisted Aspects-elaboration`)
  lines.push(`tool combining Planguage Scale/Meter/Tolerable/Goal/Wish per Aspect with`)
  lines.push(`IET-style impact projection AND dual-mode (single-Aspect OR full-set)`)
  lines.push(`generation, grounded in Tom Gilb's 50-year publication lineage from`)
  lines.push(`Software Metrics (1976) through PoSEM (1988) and CE Ch.5 (2005) to`)
  lines.push(`Resilience (2023). — Designed by Tom Gilb 11 June 2026 · 22:45 CET.`)
  lines.push('')
  // r93nnn — INFINITY TRAP teaching (Tom Gilb 2026-06-12 verbatim).
  // Travels with every export so the teaching reaches every recipient.
  lines.push(SEP_THICK)
  lines.push(`⚠️ WHY QUALIFIERS MATTER — THE INFINITY TRAP (Tom Gilb 2026-06-12)`)
  lines.push(SEP_THICK)
  lines.push(`A scalar level (Tolerable / Goal / Wish / Stretch) without Qualifiers`)
  lines.push(`silently commits the plan to INFINITY. The Planguage Glossary recognises`)
  lines.push(`THREE canonical classes of Qualifier Condition — omitting any opens an`)
  lines.push(`infinite scope on that class:`)
  lines.push('')
  lines.push(`   No TIME  ("when")  →  requirement applies for INFINITE future time`)
  lines.push(`   No PLACE ("where") →  applies in INFINITE places  (geography,`)
  lines.push(`                          user roles, components, market segments)`)
  lines.push(`   No EVENT ("if")    →  applies NO MATTER WHAT`)
  lines.push(`                          — war or peace, as Tolstoy said`)
  lines.push('')
  lines.push(`Per Planguage Glossary *124 (Qualifier) + *666 (Qualifier Condition):`)
  lines.push(`all conditions in [A, B, C] must be true simultaneously (AND logic,`)
  lines.push(`definitional). A missing class = an open door to infinity.`)
  lines.push('')
  lines.push(`   INFINITY (no finiteness with Qualifiers)`)
  lines.push(`       = INFINITE COSTS`)
  lines.push(`       + FINITE CERTAINTY OF FAILURE`)
  lines.push(`         to have enough resources to deliver Value`)
  lines.push(`         in INFINITE SPACE AND TIME.`)
  lines.push('')
  lines.push(`Finiteness creates feasibility — bound a Goal in Time + Place + Event`)
  lines.push(`→ finite resource envelope → can be funded, scheduled, measured,`)
  lines.push(`delivered. Bounded commitments are the only kind that ship.`)
  lines.push('')
  lines.push(`Canonical sources — at-a-click via the Tom Gilb Consultant Twin`)
  lines.push(`(by Kai Gilb; ontology-backed search across Tom's corpus; books free`)
  lines.push(` and open source, deeper consultation supports continued development):`)
  lines.push(`   • https://www.gilb.com/tomtwin/login   ← the Twin Consultant`)
  lines.push(`   • https://www.gilb.com/tomtwin/concept/Qualifier.124`)
  lines.push(`     *124 Qualifier (Planguage Glossary, added 2004-07-29)`)
  lines.push(`   • https://www.gilb.com/tomtwin/concept/Qualifier-Condition.666`)
  lines.push(`     *666 Qualifier Condition (Planguage Glossary, added 2021-06-03)`)
  lines.push(`   • Competitive Engineering 6.6 — Principle of "The Cost of Perfection"`)
  lines.push(`     + Principle of "The Rolls Royce" + Principle 3 "You Get What You`)
  lines.push(`     Pay For"`)
  lines.push(`   • ASPECTS: The Aspect Engine (T. Gilb, 28 Apr 2026) p. 30 + § 2.0 p. 23`)
  lines.push('')
  // Patent Pending block
  lines.push(SEP_THICK)
  lines.push(`⚖️ PATENT PENDING — CO-INVENTORS TOM GILB & KAI GILB`)
  lines.push(SEP_THICK)
  lines.push(`Invention:    Multi-Level Value-Driven Delegation, Governance, and`)
  lines.push(`              Improvement of Generative Artificial Intelligence Agents`)
  lines.push(`Docket No.:   24-142KG`)
  lines.push(`Serial No.:   64/088,267`)
  lines.push(`Filing Date:  June 11, 2026`)
  lines.push('')
  lines.push(`System name:  KaiZen (built by Kai Gilb on Planguage per Tom Gilb's`)
  lines.push(`              CE and PoSEM books)`)
  lines.push(`Descendants:  Tom's Twin (Kai Gilb's industrial Planguage application,`)
  lines.push(`              production grade) AND the SEM App (Tom Gilb's design`)
  lines.push(`              sandbox for new planning features destined to be ported`)
  lines.push(`              into the Twin). The Value Aspects Articulation Tool is`)
  lines.push(`              one such design contribution from the SEM App.`)
  lines.push('')
  lines.push(`All inventive elements of this tool — including the AI-assisted`)
  lines.push(`per-Aspect Planguage generation, the dual-mode lock-in pipeline, and`)
  lines.push(`the Phase 2 Impact projection feature — fall within the scope of the`)
  lines.push(`pending claim above.`)
  lines.push('')
  // Completeness Pledge
  lines.push(SEP_THIN)
  lines.push(`COMPLETENESS PLEDGE (r93ll / r93ww / r93zz)`)
  lines.push(SEP_THIN)
  lines.push(`This plain-text export mirrors EVERY section the Value Aspects panel`)
  lines.push(`can show — every Aspect set, every Aspect's full Scale/Meter/Tolerable/`)
  lines.push(`Goal/Wish/Stretch + rationale + locked state, the parent Value baseline,`)
  lines.push(`the prior-art research, the Tom Gilb 50-year publication lineage, and`)
  lines.push(`the Patent Pending attribution. The colour-HTML version on the clipboard`)
  lines.push(`carries the same content with category-keyed tile colours; press ⌘V at`)
  lines.push(`the top of this message to upgrade to colour. The interactive editing UI`)
  lines.push(`itself is environment-specific (open the SEM App Penta panel → select`)
  lines.push(`the Value → click the Value Aspects button).`)
  return lines.join('\n')
}

async function exportAspects(mode: 'copy' | 'email'): Promise<void> {
  const html  = renderAspectsHtml()
  const plain = renderAspectsPlain()
  const subject = `🧬 Value Aspects · ${props.parentValueName || props.parentValueId}`
  if (mode === 'copy') {
    await exportCopy(html, plain)
    _aspectsToast(`🧬 Value Aspects "${props.parentValueName || props.parentValueId}" copied as colourful HTML — paste with ⌘V`, 5000)
  } else {
    await exportEmail(html, subject, 'Value Aspects', 'Tom@Gilb.com', plain)
  }
}
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop — r93tt z-[610] above PentaPanel z-[595] -->
    <div
      class="fixed inset-0 z-[610] bg-black/55 backdrop-blur-sm"
      aria-hidden="true"
      @click="emit('close')"
    />

    <!-- Panel card — r93tt z-[615] above PentaPanel z-[595] -->
    <div
      class="fixed inset-0 z-[615] flex items-center justify-center p-4 pointer-events-none"
      role="dialog"
      aria-modal="true"
      aria-label="Value Aspects Articulation Tool"
    >
      <div
        class="pointer-events-auto w-full max-w-6xl max-h-[94vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden bg-white ring-1 ring-black/10"
      >
        <!-- ── Header ────────────────────────────────────────────────── -->
        <div class="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-violet-700 via-fuchsia-700 to-violet-700 shrink-0">
          <ValueAspectsGlyph size="xl" theme="on-dark" aria-hidden="true" />
          <div class="flex-1 min-w-0">
            <h2 class="text-lg font-bold text-white leading-tight tracking-tight">
              Value Aspects Articulation Tool
              <span class="text-[11px] font-normal text-fuchsia-200 uppercase tracking-wider ml-2">
                Designed by Tom Gilb · 11 Jun 2026 · 22:45 CET
              </span>
            </h2>
            <p class="text-[13px] text-white/85 leading-snug mt-1 italic">
              "Things should be as simple as possible, but no simpler." — T. Gilb (PoSEM p.17)
            </p>
          </div>
          <!-- r93ww — Export buttons per Export-on-all-windows SUPREME rule + Tom Gilb 2026-06-12
               "All windows, particularly scrolled ones, must have export — IMPORTANT FOR HUMANS
                so people can take this long list offline and discuss with colleagues." -->
          <button
            type="button"
            class="px-3 py-1.5 rounded bg-emerald-500 hover:bg-emerald-600 text-white text-[12px] font-bold whitespace-nowrap transition-colors ring-1 ring-emerald-700 flex items-center gap-1"
            title="📋 Copy — captures MORE than what's currently visible. Includes EVERY Aspect set across all categories you've seeded for this Value, EVERY Aspect with full Scale/Meter/Tolerable/Goal/Wish/Stretch, per-Aspect rationale, locked state, the parent Value baseline, the prior-art research, the Tom Gilb 50-year publication lineage (Software Metrics 1976 → PoSEM 1988 Bank Case → CE Ch.5 2005 → Resilience 2023), AND the Patent Pending attribution (24-142KG, 64/088,267). Paste with ⌘V into Mail, Notes, Keynote, anywhere — for offline distributed-team review."
            @click="exportAspects('copy')"
          >📋 Copy</button>
          <button
            type="button"
            class="px-3 py-1.5 rounded bg-blue-500 hover:bg-blue-600 text-white text-[12px] font-bold whitespace-nowrap transition-colors ring-1 ring-blue-700 flex items-center gap-1"
            title="✉ Email — captures MORE than what's currently visible. Includes EVERY Aspect set, EVERY Aspect with full Scale/Meter/Tolerable/Goal/Wish/Stretch + rationale + locked state, parent Value baseline, prior-art research, Tom Gilb publication lineage, AND Patent Pending attribution. Auto-opens Mail with colourful HTML on clipboard — paste with ⌘V in the body. For offline distributed-team review."
            @click="exportAspects('email')"
          >✉ Email</button>
          <button
            type="button"
            class="px-3 py-1.5 rounded bg-white/15 hover:bg-white/25 text-white text-[12px] font-bold whitespace-nowrap transition-colors ring-1 ring-white/30 flex items-center gap-1"
            :title="infoOpen ? 'Hide the prior-art research and design rationale' : 'Show prior art: ISO 25010, ATAM, QFD, NFR, GORE — and why this tool is the world-first Planguage-grounded interactive variant.'"
            @click="infoOpen = !infoOpen"
          >ℹ Info</button>
          <CloseDot
            variant="on-dark"
            size="lg"
            aria-label="Close Value Aspects"
            title="Close — your edits persist in this session; click again to re-open."
            @click="emit('close')"
          />
        </div>

        <!-- ── Parent Value strip ───────────────────────────────────────── -->
        <div class="px-5 py-3 bg-slate-50 border-b border-slate-200 shrink-0">
          <div class="flex items-baseline gap-3 flex-wrap">
            <span class="text-[11px] uppercase tracking-wide text-slate-500 font-bold">Elaborating Value</span>
            <span class="text-[15px] font-bold text-slate-900 font-mono">{{ parentValueName || parentValueId }}</span>
          </div>
          <div class="mt-1.5 flex gap-3 flex-wrap text-[12px] text-slate-700">
            <span v-if="parentScale" class="font-mono">
              <b class="text-violet-700">Scale:</b> {{ parentScale }}
            </span>
            <span v-if="parentTolerable" class="font-mono">
              <b class="text-amber-700">Tolerable:</b> {{ parentTolerable }}
            </span>
            <span v-if="parentGoal" class="font-mono">
              <b class="text-emerald-700">Goal:</b> {{ parentGoal }}
            </span>
            <span v-if="parentWish" class="font-mono">
              <b class="text-blue-700">Wish:</b> {{ parentWish }}
            </span>
          </div>
        </div>

        <!-- ── SINGLE scrollable body — r93vv (Tom Gilb 2026-06-12 "the window does not
             scroll and clearly must"). Previously the Info popover, Category Picker, and
             Active Set were three separate `shrink-0` sections, each unable to scroll
             individually. With instructions + 10 category tiles + lineage block + patent
             block + 8-15 Aspect rows all rendering, the content blew through the modal
             height and the bottom was unreachable. Per r93t Scroll-Engagement Verification:
             one scrollable container, every long-content section inside it. -->
        <!-- r93bbb (Tom Gilb 2026-06-12 "and the scroll is not in that window"): scroll WAS
             engaged after r93vv but the scrollbar was invisible (macOS default = hidden until
             active), so users couldn't see at a glance that more content existed above or
             below. Added `value-aspects-scroll` class with custom CSS that forces an always-
             visible vertical scrollbar with a violet thumb matching the panel's accent. The
             `relative` is for the optional fade-edge indicator below. -->
        <div class="flex-1 min-h-0 overflow-y-auto value-aspects-scroll relative">

        <!-- ── Info / Prior Art (collapsible) ──────────────────────────── -->
        <div v-if="infoOpen" class="px-5 py-3 bg-indigo-50 border-b border-indigo-200 text-[12px] text-indigo-950 space-y-2">
          <p>
            <b>Design rationale:</b> For large and complex systems (military, national, health, space) a single Scale is "too simple". This tool elaborates a Value into a SET of Aspects, each with its own Planguage Scale / Meter / Tolerable / Goal / Wish (+ optional Stretch + Conditions).
          </p>
          <p>
            <b>Prior art (none matches all four of: interactive · AI-assisted · Planguage-grounded · with IET-style Impact projection):</b>
          </p>
          <ul class="list-disc ml-5 space-y-0.5">
            <li><b>ISO 25010</b> (2011) — static 8-characteristic taxonomy. Not interactive, not Planguage-quantified.</li>
            <li><b>ATAM</b> (Kazman/Klein/SEI 2000) — utility trees for architecture trade-off analysis. Post-hoc evaluation, not planning-time elaboration.</li>
            <li><b>QFD / House of Quality</b> (Akao 1966) — matrix mapping customer needs to engineering specs. Static spreadsheet, no Planguage rigour.</li>
            <li><b>NFR Framework</b> (Chung &amp; Mylopoulos 1993) — softgoal interdependency graphs. Informal contribution links, not quantified.</li>
            <li><b>i* / KAOS / Tropos GORE</b> — goal-oriented requirements engineering with goal refinement. Refines into operational requirements, not Planguage Aspects.</li>
          </ul>
          <div class="mt-3 p-3 rounded-lg bg-white ring-2 ring-violet-400">
            <p class="font-bold text-violet-900 text-[12px] uppercase tracking-wide mb-1.5">
              The Tom Gilb publication lineage of multi-Scale "Aspects" (added per T. Gilb 2026-06-11)
            </p>
            <p class="text-[12px] text-slate-800 leading-snug">
              The intellectual lineage of multi-Scale Value articulation traces through Tom Gilb's
              published works across <b>half a century</b>:
            </p>
            <ul class="list-disc ml-5 mt-2 space-y-1 text-[12px] text-slate-800">
              <li><b>Software Metrics</b> (Gilb 1976 UK, 1977 USA) — the foundational text introducing quantified multi-attribute software quality measurement; the seed of the multi-Scale Value concept.</li>
              <li><b>All succeeding Gilb books 1976–1988</b> — successive elaborations across Reliable EDP Application Design, Software Engineering Management, Humanised Input, etc. Each volume refined the practice of articulating quality as multiple measurable dimensions per Value.</li>
              <li><b>Principles of Software Engineering Management (PoSEM)</b> (Gilb 1988) — the canonical synthesis. Chapter-length elaborated examples — including the celebrated <b>Bank Case</b> — demonstrate multi-Aspect Value specification in industrial practice. PoSEM p.17 carries Tom's "as simple as possible but no simpler" formulation (widely misattributed to Einstein).</li>
              <li><b>Competitive Engineering (CE)</b> (Gilb 2005) — <b>Chapter 5 "Multi"</b> formalises the concept as an explicit Planguage technique. Multi-dimensional Scale specification is named and templated.</li>
              <li><b>Resilience</b> (Gilb 2023) — applies the multi-Aspect approach to systemic resilience, expanding the canonical category set (MTBF, RTO, RPO, blast radius, adaptability, graceful degradation, detection time).</li>
            </ul>
            <p class="text-[12px] text-slate-700 mt-2 italic">
              All ten category seed sets in this tool draw on Tom Gilb's 50-year body of work plus
              ISO 25010, NIST, WCAG, Nielsen Norman, Hollnagel, and IEEE references where they
              complement the Gilb lineage.
            </p>
          </div>
          <p class="italic text-indigo-800 mt-3">
            World-first claim: the first interactive AI-assisted Aspects-elaboration tool combining Planguage Scale/Meter/Tolerable/Goal/Wish per Aspect with IET-style impact projection AND dual-mode (single-Aspect OR full-set) generation, grounded in Tom Gilb's 50-year publication lineage from Software Metrics (1976) through PoSEM (1988) and CE Ch.5 (2005) to Resilience (2023). — Designed by Tom Gilb 11 June 2026 · 22:45 CET.
          </p>

          <!-- r93nnn → r93ooo — THE INFINITY TRAP teaching card. Tom Gilb 2026-06-12
               verbatim principle banked in CLAUDE.md r93mmm; surfaced HERE so planners
               see it at the moment of need. Per Tom 2026-06-12: "PUT THAT SOMEWHERE
               USEFUL SO PEOPLE SEE IT, IN CONDITIONS INFO FOR EXAMPLE." r93ooo update:
               taxonomy corrected to the Planguage-canonical 3 classes (Time / Place /
               Event) per Tom's Twin Glossary *124 + *666, fetched live via Twin
               /api/chat. The OODA-loop reflex: Tom preached, Claudian went to the
               source (Twin Consultant), retrieved the authoritative entry, corrected
               the SEM-internal model + UI in one pass. -->
          <div class="mt-4 p-4 rounded-lg bg-red-50 ring-2 ring-red-500 shadow-md">
            <p class="font-bold text-red-900 text-[13px] uppercase tracking-wide mb-2 flex items-center gap-2">
              <span aria-hidden="true" class="text-[20px] leading-none">⚠️</span>
              <span>Why Qualifiers Matter — The INFINITY TRAP</span>
            </p>
            <p class="text-[12px] text-red-950 leading-relaxed mb-2 font-semibold">
              A scalar level (Tolerable / Goal / Wish / Stretch) without Qualifiers
              is silently committing your plan to <b>infinity</b>. The Planguage
              Glossary recognises THREE canonical classes of Qualifier Condition —
              omitting any class opens an infinite scope on that dimension:
            </p>
            <ul class="list-none ml-0 mt-1.5 space-y-1 text-[12px] text-slate-900 font-mono">
              <li><b class="text-red-700">No TIME (<code>when</code>)</b> &nbsp;→&nbsp; requirement applies for INFINITE future time</li>
              <li><b class="text-red-700">No PLACE (<code>where</code>)</b> &nbsp;→&nbsp; applies in INFINITE places — geography, user roles, system components, market segments</li>
              <li><b class="text-red-700">No EVENT (<code>if</code>)</b> &nbsp;→&nbsp; applies <b>no matter what</b> — war or peace, as Tolstoy said</li>
            </ul>
            <p class="text-[11px] text-slate-700 italic mt-2 px-1">
              Per Planguage Glossary entry *124 Qualifier and *666 Qualifier Condition:
              all conditions in <code>[A, B, C]</code> must be true simultaneously
              (AND logic, definitional). Brackets around a missing class = an open
              door to infinity on that class.
            </p>
            <p class="text-[12px] text-slate-900 leading-relaxed mt-3 p-2 rounded bg-white ring-1 ring-red-300 font-bold">
              INFINITY (no finiteness with Qualifiers)
              <span class="text-red-700">=</span> INFINITE COSTS
              <span class="text-red-700">+</span> FINITE CERTAINTY OF FAILURE
              to have enough resources to deliver Value in INFINITE SPACE AND TIME.
            </p>
            <p class="text-[12px] text-emerald-900 leading-relaxed mt-2 p-2 rounded bg-emerald-50 ring-1 ring-emerald-400">
              <b>The inverse — Finiteness creates feasibility:</b>
              When you bound a Goal in <b>Time</b> (Q1.2026) + <b>Place</b> (EU markets,
              Premium users, mobile clients) + <b>Event</b> (normal operating conditions,
              if traffic &lt; 10k req/s), you create a FINITE resource envelope. Finite
              envelopes can be funded, scheduled, measured, and delivered. Bounded
              commitments are the only kind that ship.
            </p>
            <p class="text-[12px] text-amber-900 leading-relaxed mt-3 p-2 rounded bg-amber-50 ring-1 ring-amber-400">
              <b>The Infinity Trap is already in Tom's published canon</b> (Competitive Engineering 6.6):
              <br/>
              <span class="font-mono text-[11px]">• <b>Principle of "The Cost of Perfection"</b> &nbsp;— &nbsp;<i>Perfect quality costs infinity.</i></span>
              <br/>
              <span class="font-mono text-[11px]">• <b>Principle of "The Rolls Royce"</b> &nbsp;— &nbsp;<i>Near-perfect performance levels cost more than most people would pay.</i></span>
              <br/>
              <span class="font-mono text-[11px]">• <b>Principle 3: "You Get What You Pay For"</b> &nbsp;— &nbsp;<i>availability of resources is what limits delivered performance.</i></span>
              <br/>
              The Infinity Trap framing names the MECHANISM (missing Qualifiers on Time / Place / Event) that turns those principles into project failure.
            </p>
            <p class="text-[11px] text-slate-700 italic mt-3">
              <b>Canonical sources — at-a-click via the
              <a href="https://www.gilb.com/tomtwin/login" target="_blank" rel="noopener" class="text-violet-800 underline font-bold">Tom Gilb Consultant Twin</a>
              (by Kai Gilb — intelligent ontology-backed search across Tom's full corpus; supports continued development):</b><br/>
              <a href="https://www.gilb.com/tomtwin/concept/Qualifier.124" target="_blank" rel="noopener" class="text-violet-700 underline">*124 Qualifier (Planguage Glossary, added 2004-07-29)</a><br/>
              <a href="https://www.gilb.com/tomtwin/concept/Qualifier-Condition.666" target="_blank" rel="noopener" class="text-violet-700 underline">*666 Qualifier Condition (Planguage Glossary, added 2021-06-03)</a><br/>
              Tom's books are free (open source). For deeper Planguage consultation, the Twin Consultant is the source. Composes with: Competitive Engineering 6.6 (Cost of Perfection + Rolls Royce + Principle 3); ASPECTS: The Aspect Engine (T. Gilb, 28 Apr 2026) p. 30 + § 2.0 p. 23; Tom Gilb verbatim 2026-06-12 (the Infinity Trap mechanism naming).
            </p>
          </div>

          <!-- r93ss — Patent attribution block (added per Tom Gilb 2026-06-11) -->
          <div class="mt-4 p-3 rounded-lg bg-amber-50 ring-2 ring-amber-500">
            <p class="font-bold text-amber-900 text-[12px] uppercase tracking-wide mb-1.5 flex items-center gap-2">
              <span aria-hidden="true">⚖️</span>
              <span>Patent Pending — Co-Inventors Tom Gilb & Kai Gilb</span>
            </p>
            <p class="text-[12px] text-slate-800 leading-snug">
              <b>Invention:</b> Multi-Level Value-Driven Delegation, Governance, and Improvement of Generative Artificial Intelligence Agents
            </p>
            <ul class="list-none ml-0 mt-1.5 space-y-0.5 text-[12px] text-slate-800 font-mono">
              <li><b>Docket No.:</b> 24-142KG</li>
              <li><b>Serial No.:</b> 64/088,267</li>
              <li><b>Filing Date:</b> June 11, 2026</li>
            </ul>
            <p class="text-[12px] text-slate-800 leading-snug mt-2">
              The shared system name is <b>KaiZen</b>, built by Kai Gilb on Planguage (per Tom Gilb's
              CE and PoSEM books). The KaiZen platform spawns two production-grade descendants:
              <b>Tom's Twin</b> — Kai Gilb's industrial Planguage application — and the
              <b>SEM App</b> — Tom Gilb's design sandbox for new planning features destined to be
              ported into the Twin. The Value Aspects Articulation Tool shipped in this panel is
              one such design contribution from the SEM App side of the lineage.
            </p>
            <p class="text-[11px] text-amber-800 italic mt-2">
              All inventive elements demonstrated by this tool — including the AI-assisted
              per-Aspect Planguage generation, the dual-mode (set / single) lock-in pipeline, and
              the Impact projection feature (Phase 2) — fall within the scope of the pending
              patent claim above.
            </p>
          </div>
        </div>

        <!-- ── Category Picker — r93tt: prominent instructions added at the top -->
        <div v-if="pickerOpen || sets.length === 0" class="px-5 py-5 bg-white border-b border-slate-200">
          <!-- Instruction strip — what to do, step by step -->
          <div class="rounded-lg bg-violet-50 ring-2 ring-violet-300 px-4 py-3 mb-4">
            <p class="text-[13px] font-bold text-violet-900 mb-1.5">
              👋 What to do in this tool — three steps
            </p>
            <ol class="list-decimal ml-5 space-y-1 text-[12px] text-slate-800 leading-snug">
              <li>
                <b>Pick a category</b> below — click any of the 10 tiles. Your Value will be
                elaborated into a SET of <b>8 to 15 Aspects</b> seeded from that category's
                template (Gilb / ISO 25010 / NIST / Hollnagel etc).
              </li>
              <li>
                <b>Edit / delete / add</b> — each Aspect comes with Scale, Meter, Tolerable,
                Goal, Wish pre-filled. Tweak any field, delete Aspects you don't want, add
                new ones with the <b>+ Add Aspect</b> button.
              </li>
              <li>
                <b>Apply &amp; Lock to Master</b> — commit ALL Aspects with the green button at
                top (or bottom) of the set, or ONE Aspect at a time with the per-row green
                button. ⌘Z always undoes; every edit is Source-stamped.
              </li>
            </ol>
            <p class="text-[11px] text-violet-700 italic mt-2">
              Want to know more? Click the <b>ℹ Info</b> button in the header above for the
              prior-art research, the Tom Gilb 50-year publication lineage, and the Patent
              Pending attribution.
            </p>
          </div>
          <h3 class="text-[14px] font-bold text-slate-800 mb-1">Pick a category to seed the Aspects</h3>
          <p class="text-[12px] text-slate-600 mb-3">
            The four highlighted in violet are the categories Tom named explicitly (Usability, Quality, Maintainability, Resilience). All ISO 25010 / Gilb categories follow. Click any tile to begin.
          </p>
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
            <button
              v-for="cat in Object.keys(VALUE_ASPECT_CATEGORY_META) as ValueAspectCategory[]"
              :key="cat"
              type="button"
              class="flex flex-col items-start gap-1 p-3 rounded-lg ring-1 transition-all hover:scale-105 text-left"
              :class="TOM_PRIORITY_CATEGORIES.includes(cat)
                ? 'bg-violet-50 ring-violet-400 hover:bg-violet-100'
                : 'bg-white ring-slate-300 hover:bg-slate-50'"
              :title="`Seed ${VALUE_ASPECT_CATEGORY_META[cat].label} Aspects · ${VALUE_ASPECT_CATEGORY_META[cat].description}`"
              @click="pickCategory(cat)"
            >
              <div class="flex items-center gap-1.5">
                <span class="text-xl">{{ VALUE_ASPECT_CATEGORY_META[cat].emoji }}</span>
                <span class="text-[13px] font-bold text-slate-800">{{ VALUE_ASPECT_CATEGORY_META[cat].label }}</span>
              </div>
              <p class="text-[11px] text-slate-600 leading-snug">{{ VALUE_ASPECT_CATEGORY_META[cat].description }}</p>
              <p class="text-[10px] text-slate-400 italic">{{ VALUE_ASPECT_CATEGORY_META[cat].source }}</p>
            </button>
          </div>
        </div>

        <!-- ── Active Set Body — r93vv: no longer needs its own overflow-y-auto since
             the parent body wrapper handles scrolling. -->
        <div v-if="!pickerOpen && activeSet" class="px-5 py-4 space-y-3">
          <!-- r93ggg (Tom Gilb 2026-06-12: "umbrella tag at top need tlc") — Set header
               redesigned as the canonical UMBRELLA TAG editor surface, matching the
               Planguage book layout (tag uppermost + colon + parameters cascade below),
               using the same UMBRELLA_PALETTE as the per-Aspect-row pills so the user
               recognises the editor and the pills as the SAME tag family.

               Layout:
                 ┌──────────────────────────────────────────────────────────┐
                 │  UMBRELLA TAG                                             │  ← small caption
                 │  Maintainability Aspects                      :  ↓ 6 Aspects │  ← BIG editable + colon + count
                 └──────────────────────────────────────────────────────────┘
                 [ ✓ Apply All to Master ] [ + Add Aspect ] [ 🗑 Delete Set ]    ← actions on own row
                 Optional rationale text…                                          -->
          <!-- Umbrella Tag editor tile -->
          <div
            class="rounded-xl shadow-md ring-2 transition-shadow focus-within:shadow-lg overflow-hidden"
            :class="umbrellaTileClass"
            :title="`Umbrella Tag — '${activeSet.name}'. Edit here. This is the canonical Planguage Mnemonic Tag for the SET that umbrellas the ${activeSet.aspects.length} Aspect Spec Tag${activeSet.aspects.length === 1 ? '' : 's'} below. Per Planguage book convention: tag uppermost, colon terminator, parameters cascade below.`"
          >
            <!-- Caption strip — small "UMBRELLA TAG" label so the term is visible -->
            <div class="px-4 pt-2 text-[10px] font-bold uppercase tracking-[0.18em] opacity-70 select-none">
              Umbrella Tag
            </div>
            <!-- Tag input + colon + set-count badge — baseline-aligned row -->
            <div class="flex items-baseline px-1 pb-2 gap-1 flex-wrap">
              <input
                :value="activeSet.name"
                type="text"
                class="flex-1 min-w-[240px] font-mono font-extrabold bg-transparent border-0 px-3 py-1 text-[30px] tracking-tight focus:ring-0 focus:outline-none placeholder:opacity-50"
                placeholder="Umbrella Tag…"
                @input="(e) => renameSet(parentValueId, activeSet!.id, (e.target as HTMLInputElement).value)"
              />
              <!-- COLON — Planguage book convention (matches r93fff Spec Tag) -->
              <span
                class="font-mono font-extrabold text-[30px] leading-none px-1 select-none pointer-events-none shrink-0"
                aria-hidden="true"
              >:</span>
              <!-- Set-count badge — "this Umbrella points to N specs" -->
              <span
                class="inline-flex items-baseline gap-1 px-3 py-1 rounded-full bg-white/40 backdrop-blur text-[12px] font-bold tracking-wide shrink-0 ring-1 ring-white/60"
                :title="`This Umbrella Tag points to ${activeSet.aspects.length} Spec Tag${activeSet.aspects.length === 1 ? '' : 's'} (the Aspects below).`"
              >
                <span class="opacity-80">↓</span>
                <span>{{ activeSet.aspects.length }}</span>
                <span class="opacity-75 text-[11px] uppercase tracking-wider">Aspect{{ activeSet.aspects.length === 1 ? '' : 's' }}</span>
              </span>
            </div>
          </div>

          <!-- r93sss — APPLY MODE CHOICE. Tom Gilb 2026-06-12 verbatim: "I can see a
               need to keep it as is … Replace xxx with the new set, or Keep the initial
               value VVVVV, in the set with the Umbrella Tag TTTTT". Two clear modes
               surfaced as a visible chooser ABOVE the Apply All button so the planner
               makes a conscious decision before pressing Apply. Default = keep-and-add
               (No-Silent-Data-Loss SUPREME). MOVE Principle: visible without hunt. -->
          <div
            class="rounded-lg ring-2 px-3 py-2.5"
            :class="applyMode === 'keep-and-add' ? 'bg-emerald-50 ring-emerald-400' : 'bg-amber-50 ring-amber-400'"
          >
            <p class="text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
              <span aria-hidden="true">⚖️</span>
              <span>How should "{{ props.parentValueName || props.parentValueId }}" relate to "{{ activeSet.name }}"?</span>
            </p>
            <div class="space-y-2">
              <label
                class="flex items-start gap-2.5 p-2 rounded cursor-pointer transition-colors"
                :class="applyMode === 'keep-and-add' ? 'bg-white ring-1 ring-emerald-500 shadow-sm' : 'hover:bg-slate-100'"
                :title="`KEEP-AND-ADD (recommended): the original Value '${props.parentValueName || props.parentValueId}' is preserved AND becomes one of the sub-Values inside the '${activeSet.name}' set. Its Scale / Meter / Tolerable / Goal / Wish are kept verbatim; its tag becomes '${activeSet.name}.${props.parentValueName || props.parentValueId}'. No data loss. Composes with No-Silent-Data-Loss SUPREME.`"
              >
                <input v-model="applyMode" type="radio" value="keep-and-add" class="mt-0.5 accent-emerald-600 shrink-0" />
                <div class="flex-1">
                  <div class="text-[12px] font-bold text-emerald-900 leading-snug">
                    Keep "{{ props.parentValueName || props.parentValueId }}" — add it to the "{{ activeSet.name }}" set as a sub-Value
                  </div>
                  <div class="text-[11px] text-slate-600 leading-snug mt-0.5">
                    Original Scale / Meter / Tolerable / Goal / Wish preserved verbatim. Tag becomes
                    <code class="font-mono text-violet-700">{{ activeSet.name }}.{{ props.parentValueName || props.parentValueId }}</code>,
                    a sibling of the generated Aspects. <b>Recommended.</b> No data loss.
                  </div>
                </div>
              </label>
              <label
                class="flex items-start gap-2.5 p-2 rounded cursor-pointer transition-colors"
                :class="applyMode === 'replace' ? 'bg-white ring-1 ring-amber-500 shadow-sm' : 'hover:bg-slate-100'"
                :title="`REPLACE: the original Value '${props.parentValueName || props.parentValueId}' is DELETED from the master spec and replaced by the '${activeSet.name}' Umbrella + its ${activeSet.aspects.length} Aspect(s). Original Scale lives only in the generated Aspects (or is lost if no Aspect covers it). Reversible via ⌘Z (Universal Undo SUPREME).`"
              >
                <input v-model="applyMode" type="radio" value="replace" class="mt-0.5 accent-amber-600 shrink-0" />
                <div class="flex-1">
                  <div class="text-[12px] font-bold text-amber-900 leading-snug">
                    Replace "{{ props.parentValueName || props.parentValueId }}" with the new "{{ activeSet.name }}" set
                  </div>
                  <div class="text-[11px] text-slate-600 leading-snug mt-0.5">
                    Original Value <b>deleted</b>. Scale lives only in the generated Aspects.
                    Reversible via ⌘Z (Universal Undo).
                  </div>
                </div>
              </label>
            </div>
          </div>

          <!-- Action row — buttons get their own row below the Umbrella Tag editor -->
          <div class="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              class="px-3 py-1.5 rounded text-white text-[12px] font-bold whitespace-nowrap transition-colors ring-1"
              :class="applyMode === 'keep-and-add'
                ? 'bg-emerald-600 hover:bg-emerald-700 ring-emerald-800'
                : 'bg-amber-600 hover:bg-amber-700 ring-amber-800'"
              :title="applyMode === 'keep-and-add'
                ? `Apply ALL ${activeSet.aspects.length} Aspects to the master spec, KEEPING the original Value '${props.parentValueName || props.parentValueId}' as a sub-Value inside the '${activeSet.name}' set. Full Undo via ⌘Z.`
                : `Apply ALL ${activeSet.aspects.length} Aspects to the master spec, REPLACING the original Value '${props.parentValueName || props.parentValueId}' with the new Umbrella + Aspects. Reversible via ⌘Z.`"
              @click="applyToMaster(activeSet)"
            >✓ Apply All — {{ applyMode === 'keep-and-add' ? 'Keep & Add' : 'Replace' }}</button>
            <button
              type="button"
              class="px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-white text-[12px] font-bold whitespace-nowrap transition-colors"
              title="Add a new empty Aspect to this set"
              @click="addAspect(activeSet.id, parentValueId)"
            >+ Add Aspect</button>
            <button
              type="button"
              class="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-700 text-white text-[12px] font-bold whitespace-nowrap transition-colors"
              :title="`Delete this entire set of ${activeSet.aspects.length} Aspects. The parent Value entry is NOT touched.`"
              @click="(() => { if (confirm('Delete entire set?')) { deleteSet(parentValueId, activeSet!.id); pickerOpen = true } })()"
            >🗑 Delete Set</button>
          </div>
          <p v-if="activeSet.rationale" class="text-[12px] text-slate-600 italic">{{ activeSet.rationale }}</p>

          <!-- Aspects table -->
          <div class="rounded-xl border-2 border-slate-200 overflow-hidden">
            <!-- r93ccc (Tom Gilb 2026-06-12 "Scale and meter are normally a sentence long and
                 we should normally fit them fully into the immediately visible window") —
                 grid proportions re-tuned: Scale+Meter widened col-span-3 → col-span-5 so a
                 typical 1-2 line sentence fits without wrapping. Name col-span-3 → col-span-2,
                 Actions col-span-3 → col-span-2. T/G/W stay col-span-1 each. Sum: 12 cols. -->
            <!-- r93fff (Tom Gilb 2026-06-12 verbatim Planguage book convention): "spec tag,
                 I always in Planguage, see all my books, have the spec tag uppermost, followed
                 by a colon, that means you can easily make it big, and have it long, and
                 readability demands both." Column header drops "Name" — the tag now lives in
                 its own full-width strip ABOVE each Aspect's parameter grid (per Planguage book
                 layout), not in a sidebar column. The Name column-span (2) is redistributed:
                 Scale·Meter 5 → 6 (more sentence room), Actions 2 → 3 (more button room).
                 Grid sum stays 12. -->
            <div class="grid grid-cols-12 gap-2 px-3 py-2 bg-slate-100 text-[11px] font-bold uppercase tracking-wide text-slate-700">
              <div class="col-span-6">Scale · Meter</div>
              <div class="col-span-1">Tolerable</div>
              <div class="col-span-1">Goal</div>
              <div class="col-span-1">Wish</div>
              <div class="col-span-3">Actions</div>
            </div>
            <div
              v-for="aspect in activeSet.aspects"
              :key="aspect.id"
              class="px-3 py-3 border-t border-slate-100 hover:bg-violet-50/30 text-[12px]"
            >
              <!-- r93fff — TAG STRIP (UPPERMOST, per Planguage book convention).
                   Tom Gilb 2026-06-12 verbatim: "I always in Planguage, see all my books, have
                   the spec tag uppermost, followed by a colon, that means you can easily make
                   it big, and have it long, and readability demands both."

                   Layout (full width above the parameter grid, baseline-aligned):

                     [Umbrella Tag pill]  .  [Spec Tag tile — BIG + LONG  :]
                          ↑                       ↑
                       set.name              aspect.name (editable)
                       parent in hierarchy   child in hierarchy, ends with ':'

                   Reads exactly as a Planguage book spec entry — `Umbrella.Spec:` above the
                   parameter cascade. The colon is a visible mark right after the Spec Tag, in
                   the same colour family, signalling "tag terminates here, parameters follow".

                   Composes with: r93eee Umbrella Tag concept (banked as new Planguage term),
                   Planguage Mnemonic ID Standard (both tags 1-3 words from spec essence),
                   accessibility_tom.md (28 px tag is universal-readable not Tom-specific). -->
              <div class="flex items-end gap-2 mb-3 flex-wrap">
                <!-- UMBRELLA TAG pill (Set name, read-only, deep category bg) — r93ggg
                     bumped from 18 px → 22 px so it reads as a peer of the 28 px Spec
                     Tag rather than a footnote (visual hierarchy: parent ≥ child weight). -->
                <div
                  class="rounded-lg px-3 py-2 ring-2 shadow-sm shrink-0"
                  :class="umbrellaTileClass"
                  :title="`Umbrella Tag — '${activeSet.name}'. The Planguage Mnemonic Tag for the SET that umbrellas these Aspect Spec Tags. Used in hierarchy: ${activeSet.name}.${aspect.name}. Edit at the Set header above; read-only here.`"
                >
                  <div class="font-mono font-extrabold text-[22px] tracking-tight leading-tight whitespace-nowrap">
                    {{ activeSet.name }}
                  </div>
                </div>

                <!-- Hierarchy dot — Planguage dotted notation `Umbrella.Spec` -->
                <span
                  class="font-mono font-extrabold text-[28px] leading-none pb-1 select-none pointer-events-none shrink-0"
                  :class="hierarchyDotClass"
                  aria-hidden="true"
                >.</span>

                <!-- SPEC TAG tile (Aspect name, editable, BIG + LONG, ends with COLON `:`).
                     `flex-1` so it grows to fill the remaining strip width — long multi-word
                     tags get the room readability demands. -->
                <div
                  class="rounded-lg shadow-sm ring-2 transition-shadow focus-within:shadow-md flex items-baseline flex-1 min-w-[18rem]"
                  :class="specTagTileClass"
                >
                  <input
                    :value="aspect.name"
                    type="text"
                    class="flex-1 font-mono font-extrabold bg-transparent border-0 px-3 py-2 text-[28px] tracking-tight focus:ring-0 focus:outline-none"
                    :title="`Spec Tag — '${aspect.name}'. The canonical Planguage Mnemonic Tag for THIS Aspect. Full hierarchical name: '${activeSet.name}.${aspect.name}:'. Per the Planguage Mnemonic ID Standard — 1-3 words derived from spec essence; per Planguage book convention the tag goes uppermost with a colon terminator.`"
                    @input="(e) => _onAspectFieldInput(activeSet!.id, aspect.id, 'name', e)"
                  />
                  <!-- COLON — Planguage book convention: spec tag uppermost, followed by colon -->
                  <span
                    class="font-mono font-extrabold text-[28px] leading-none pr-3 pb-0.5 select-none pointer-events-none"
                    aria-hidden="true"
                  >:</span>
                </div>
              </div>

              <!-- Rationale + locked badge — sit under the tag strip, before the parameter grid -->
              <div v-if="aspect.rationale || aspect.locked" class="flex items-center gap-2 mb-3 -mt-1 px-1 flex-wrap">
                <p v-if="aspect.rationale" class="text-[11px] text-slate-500 italic leading-snug flex-1">{{ aspect.rationale }}</p>
                <span
                  v-if="aspect.locked"
                  class="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 text-[11px] font-bold ring-1 ring-emerald-300 shrink-0"
                  title="This Aspect has been applied to the master spec. Click '↶ Unlock' below to revert."
                >🔒 Applied to Master</span>
              </div>

              <!-- PARAMETER GRID — the spec parameters cascade below the tag, Planguage-book style.
                   r93fff column re-balance: Name col removed, Scale·Meter 5→6, Actions 2→3. -->
              <div class="grid grid-cols-12 gap-2">
                <!-- Scale + Meter — r93ccc auto-grow + r93fff widened to col-span-6 -->
                <div class="col-span-6 space-y-1.5">
                  <textarea
                    :value="aspect.scale"
                    rows="2"
                    class="vap-autogrow w-full text-[13px] border border-slate-300 rounded px-2.5 py-2 focus:ring-2 focus:ring-violet-400 focus:outline-none font-mono leading-snug"
                    :title="`Scale — what is being measured + the unit. Per Planguage Glossary canonical Scale. The field grows to fit your text — no need to scroll inside the box.`"
                    placeholder="Scale… (sentence-long; the box grows to fit your text)"
                    @input="(e) => _onAspectFieldInput(activeSet!.id, aspect.id, 'scale', e)"
                  />
                  <textarea
                    :value="aspect.meter"
                    rows="2"
                    class="vap-autogrow w-full text-[13px] text-slate-700 border border-slate-200 rounded px-2.5 py-2 focus:ring-2 focus:ring-violet-400 focus:outline-none italic leading-snug"
                    :title="`Meter — how measurement is performed. Per Planguage Glossary canonical Meter. The field grows to fit your text.`"
                    placeholder="Meter… (how the Scale is measured — sentence-long is normal)"
                    @input="(e) => _onAspectFieldInput(activeSet!.id, aspect.id, 'meter', e)"
                  />
                </div>

                <!-- r41 v376 (Tom Gilb 2026-06-26 "the 3 numbersw lack text
                     what they are, maybe status tolerable wish") — added
                     ALWAYS-VISIBLE labels above each input.  Previously
                     only the `placeholder` showed the level name, which
                     disappears the moment the planner enters a value
                     (e.g. "85%") — leaving 3 anonymous numbers.  Now each
                     input carries a small canonical Planguage-coloured
                     label (Tolerable amber · Goal emerald · Wish blue) that
                     stays visible regardless of input state.  Composes with
                     DD-009 Zero-Training UI + Spell-out-Type-Names SUPREME
                     + Color Keyed Icons DD-016 (canonical level colours). -->
                <!-- Tolerable -->
                <div class="col-span-1">
                  <label
                    class="block text-[9px] font-bold uppercase tracking-wider text-amber-700 mb-0.5"
                    :for="`aspect-tol-${aspect.id}`"
                    title="Tolerable — minimum non-failure / project-viability threshold. Per Planguage Glossary."
                  >Tolerable</label>
                  <input
                    :id="`aspect-tol-${aspect.id}`"
                    :value="aspect.tolerable"
                    type="text"
                    class="w-full text-[12px] border border-amber-300 rounded px-2 py-1 focus:ring-1 focus:ring-amber-400 focus:outline-none font-mono bg-amber-50/40"
                    :title="`Tolerable — minimum non-failure / project-viability threshold. Per Planguage Glossary.`"
                    placeholder="Tolerable"
                    @input="(e) => _onAspectFieldInput(activeSet!.id, aspect.id, 'tolerable', e)"
                  />
                </div>

                <!-- Goal -->
                <div class="col-span-1">
                  <label
                    class="block text-[9px] font-bold uppercase tracking-wider text-emerald-700 mb-0.5"
                    :for="`aspect-goal-${aspect.id}`"
                    title="Goal — committed promise (negotiated trade-off). Per Planguage Glossary."
                  >Goal</label>
                  <input
                    :id="`aspect-goal-${aspect.id}`"
                    :value="aspect.goal"
                    type="text"
                    class="w-full text-[12px] border border-emerald-300 rounded px-2 py-1 focus:ring-1 focus:ring-emerald-400 focus:outline-none font-mono bg-emerald-50/40"
                    :title="`Goal — committed promise (negotiated trade-off). Per Planguage Glossary.`"
                    placeholder="Goal"
                    @input="(e) => _onAspectFieldInput(activeSet!.id, aspect.id, 'goal', e)"
                  />
                </div>

                <!-- Wish -->
                <div class="col-span-1">
                  <label
                    class="block text-[9px] font-bold uppercase tracking-wider text-blue-700 mb-0.5"
                    :for="`aspect-wish-${aspect.id}`"
                    title="Wish — stakeholder dream, uncommitted (independent of cost + physics). Per Planguage Glossary."
                  >Wish</label>
                  <input
                    :id="`aspect-wish-${aspect.id}`"
                    :value="aspect.wish"
                    type="text"
                    class="w-full text-[12px] border border-blue-300 rounded px-2 py-1 focus:ring-1 focus:ring-blue-400 focus:outline-none font-mono bg-blue-50/40"
                    :title="`Wish — stakeholder dream, uncommitted (independent of cost+physics). Per Planguage Glossary.`"
                    placeholder="Wish"
                    @input="(e) => _onAspectFieldInput(activeSet!.id, aspect.id, 'wish', e)"
                  />
                </div>

                <!-- Actions — r93fff: col-span-2 → col-span-3 (Name col freed two units; one to Scale·Meter, one to Actions for less-cramped buttons) -->
                <div class="col-span-3 flex flex-col gap-1.5">
                <button
                  type="button"
                  class="px-2 py-1 rounded text-[11px] font-bold transition-colors"
                  :class="aspect.locked
                    ? 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white ring-1 ring-emerald-800'"
                  :title="aspect.locked
                    ? 'Unlock this Aspect — removes the applied state in this session; the master spec field is not yet wired to revert in P1.'
                    : 'Apply ONLY this Aspect to the master spec. Cascade ripple analysis runs. Undo available via ⌘Z or the global Undo pin.'"
                  @click="aspect.locked
                    ? lockAspect(activeSet!.id, parentValueId, aspect.id, false)
                    : applyOneToMaster(activeSet!, aspect)"
                >{{ aspect.locked ? '↶ Unlock' : '✓ Apply This Aspect' }}</button>
                <button
                  type="button"
                  class="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition-colors border border-slate-300"
                  :title="`Show speculative Impacts of this Aspect — solutions implied, added Resources, costs. P2 feature: full IET-style impact projection with URLs + citations. Currently shows placeholder copy.`"
                  @click="alert('Impacts — Phase 2 of Aspects Tool. Will compute: solutions implied, Resources required, cost estimate, risks, dependencies, with URLs + citations like IET. — T. Gilb 2026-06-11')"
                >💡 Impacts? (Phase 2)</button>
                <button
                  type="button"
                  class="px-2 py-1 rounded bg-rose-100 hover:bg-rose-200 text-rose-800 text-[11px] font-semibold transition-colors border border-rose-300"
                  title="Delete this Aspect from the set"
                  @click="deleteAspect(activeSet!.id, parentValueId, aspect.id)"
                >🗑 Delete</button>
              </div>
              <!-- /Actions col-span-3 -->
              </div>
              <!-- /Parameter grid (12-col) — r93fff -->

              <!-- r93rrr — Universal QualifiersBar mount (Tom Gilb 2026-06-12 "3 classes,
                   everywhere"). Replaces the r93qqq inline markup with the shared
                   <QualifiersBar> component. Same component now mounts in PentaPanel + all
                   future spec-edit surfaces — one source of truth, one Phase-2 upgrade path. -->
              <div class="mt-3 -mx-1">
                <QualifiersBar
                  :model-value="aspect.conditions"
                  :entry-name="aspect.name"
                  :level-preview="aspect.goal"
                  level-label="Goal"
                  @update:model-value="(v) => updateAspect(activeSet!.id, parentValueId, aspect.id, { conditions: v })"
                />
              </div>
            </div>
            <!-- /Aspect row (outer v-for) — r93fff -->
            <div v-if="activeSet.aspects.length === 0" class="px-3 py-6 text-center text-slate-400 italic text-[12px]">
              No Aspects in this set. Click "+ Add Aspect" to add one, or "Delete Set" to start over.
            </div>
          </div>

          <!-- Bottom action row mirror (DD-014) -->
          <div class="rounded-xl border-t-4 border-emerald-300 bg-emerald-50 p-3 mt-4 flex items-center gap-3 flex-wrap">
            <span class="text-[12px] font-bold text-emerald-900 uppercase tracking-wide flex-1">
              End of {{ activeSet.name }} · {{ activeSet.aspects.length }} Aspects
            </span>
            <button
              type="button"
              class="px-4 py-2 rounded text-white text-[13px] font-bold transition-colors ring-1"
              :class="applyMode === 'keep-and-add'
                ? 'bg-emerald-600 hover:bg-emerald-700 ring-emerald-800'
                : 'bg-amber-600 hover:bg-amber-700 ring-amber-800'"
              :title="applyMode === 'keep-and-add'
                ? `Apply ALL ${activeSet.aspects.length} Aspects, KEEPING the original Value '${props.parentValueName || props.parentValueId}' as a sub-Value inside the set. DD-014 bottom mirror. Full Undo via ⌘Z.`
                : `Apply ALL ${activeSet.aspects.length} Aspects, REPLACING the original Value '${props.parentValueName || props.parentValueId}' with the new set. DD-014 bottom mirror. Reversible via ⌘Z.`"
              @click="applyToMaster(activeSet)"
            >✓ Apply All ({{ activeSet.aspects.length }}) — {{ applyMode === 'keep-and-add' ? 'Keep & Add' : 'Replace' }}</button>
            <button
              type="button"
              class="px-3 py-2 rounded bg-violet-600 hover:bg-violet-700 text-white text-[12px] font-semibold transition-colors"
              title="Add ANOTHER set of Aspects from a different category alongside this one"
              @click="pickerOpen = true"
            >+ Add Another Category Set</button>
            <!--
              r41 v294 (Tom Gilb 2026-06-22 verbatim "it is not clear how to move
              on from this after accepting, another round yes, but what if you are
              done with this tool").  The bottom row offered Apply All (continue
              with this set) and Add Another Category Set (continue with a
              different set) but no visible "I'm done with this tool" exit.
              The header CloseDot existed but was easy to miss after a long
              scrolling session.  Per MOVE Principle SUPREME + DD-014 Top-and-
              Bottom Navigation Mirror + Zero-Training UI (DD-009): the exit
              affordance must be visible alongside the continue affordances at
              the end of the action sequence.  Slate-coloured to read clearly
              as a NEUTRAL EXIT (not a primary CTA — applies / adds remain the
              primary actions).
            -->
            <button
              type="button"
              class="px-4 py-2 rounded bg-slate-700 hover:bg-slate-800 text-white text-[13px] font-bold transition-colors ring-1 ring-slate-900"
              title="Done with this tool — close the Value Aspects panel and return to the spec.  Any Aspects you already pressed Apply on stay on the master spec (visible in the spec view).  Anything you have NOT pressed Apply on is discarded.  Re-open this tool any time via the Value Aspects pin to add more sets."
              aria-label="Done · Close Value Aspects tool · applied Aspects remain on the master spec"
              @click="emit('close')"
            >✓ Done — Close Tool</button>
          </div>
        </div>

        </div><!-- /r93vv single scrollable body wrapper -->
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* r93bbb — always-visible violet scrollbar so the user can see at a glance that the modal
   body scrolls. macOS hides scrollbars by default; this overrides that for our scoped class.
   Composes with: r93t Scroll-Engagement Verification + accessibility_tom.md (visible
   affordances over silent ones — Tom is 85, can't be expected to discover invisible UI). */
.value-aspects-scroll {
  scrollbar-width: thin;           /* Firefox + modern Chromium */
  scrollbar-color: #7c3aed #f3e8ff; /* thumb · track */
}
.value-aspects-scroll::-webkit-scrollbar {
  width: 12px;                     /* WebKit (Safari + Chromium): force width so always visible */
  height: 12px;
}
.value-aspects-scroll::-webkit-scrollbar-track {
  background: #f3e8ff;             /* light violet track */
  border-radius: 6px;
}
.value-aspects-scroll::-webkit-scrollbar-thumb {
  background: #7c3aed;             /* violet-700 thumb matches panel accent */
  border-radius: 6px;
  border: 2px solid #f3e8ff;       /* slight inset so thumb reads as separate from track */
}
.value-aspects-scroll::-webkit-scrollbar-thumb:hover {
  background: #6d28d9;             /* violet-700 → violet-800 on hover */
}

/* r93ccc — auto-grow Scale/Meter textareas so a sentence-long Planguage Scale or Meter is
   visible at a glance without scrolling INSIDE the textarea. `field-sizing: content` is
   the modern one-line solution (Safari 17.4+, Chrome 123+). For older browsers we keep the
   `rows="2"` default which falls back to a fixed 2-line height — still acceptable. */
.vap-autogrow {
  field-sizing: content;
  min-height: 3rem;        /* ~2 lines of text-[13px] — comfortable for an empty box */
  max-height: 22rem;       /* sanity cap — beyond this scroll inside the textarea kicks in */
  resize: vertical;        /* user can still drag-resize if they want more / less */
}
</style>
