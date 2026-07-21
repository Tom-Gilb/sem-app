<!-- UNIT_TYPE=Panel -->
<!--
 * PentaPanel — interactive Penta Model sharpening tool and visualization.
 * Co-invented by Al Shalloway and Tom Gilb (2022). SVERD (sword): Scope · Values · Efficiency · Resources · Designs.
 *
 * Layout:
 *   Header: gradient (blue→indigo) + PentaGlyph + "Penta Model" + subtitle + CloseDot
 *   Body (flex-row):
 *     Left 55%: PentaSVG — 5-sector pinwheel, hierarchical rings, hover + click
 *     Right 45%: Detail panel — shows selected item/sector, editable fields
 *   Bottom strip: PentaOptima command bar (collapsible)
 *   Footer: citation + efficiency score
 *
 * Rules: CloseDot, backdrop, registerExclusiveSurface (in App.vue), ScrollContainer,
 *        MOVE, Planguage-Glyph-First (PentaGlyph used in header), Interaction Disclosure,
 *        no Scrum vocabulary, Claude-Code-as-AI-Layer (no embedded API calls).
 *
 * DD-017: All canonical-color text on white/light backgrounds.
 * DD-015: No English letter abbreviations inside PentaGlyph SVG.
 * DD-011: PentaGlyph used in header (Planguage-Glyph-First).
-->
<script setup lang="ts">
import { ref, computed, toRef } from 'vue'
import CloseDot from './CloseDot.vue'
import QualifiersBar from './QualifiersBar.vue'
import ScrollContainer from './ScrollContainer.vue'
import SpecActionFooter from './SpecActionFooter.vue'
import PentaGlyph  from './icons/PentaGlyph.vue'
import OpenGlyph   from './icons/OpenGlyph.vue'
import ExitGlyph   from './icons/ExitGlyph.vue'
import PentaGovernancePanel from './PentaGovernancePanel.vue'
import PlanguageParamLabel from './PlanguageParamLabel.vue'
import CascadeImpactTable from './CascadeImpactTable.vue'
import CascadeDiagramPanel from './CascadeDiagramPanel.vue'
import EfficiencyInsightPanel from './EfficiencyInsightPanel.vue'
import EfficiencyGlyph from './icons/EfficiencyGlyph.vue'
import ValueAspectsGlyph from './icons/ValueAspectsGlyph.vue'  // r93uu — Planguage Aspects glyph
import { usePenta, SECTOR_COLORS, mnemonicLabel } from '../composables/usePenta'
import { usePentaVersions } from '../composables/usePentaVersions'
import { useSpecHistory }   from '../composables/useSpecHistory'
import { useSpecLock }      from '../composables/useSpecLock'
import { useStrategyMode } from '../composables/useStrategyMode'
import { deriveStakeholderLinks } from '../composables/useStakeholderDerivation'
import type { SpecBlock, AmbitionLevelEntry } from '../types/spec'
import type { FEntry, VEntry, SEntry, CEntry, REntry } from '../types/spec'
import type { EvoStep } from '../types/evo-plan'
import type { TaskSuggestion } from '../types/task'
import type { PentaItem, PentaSectorId, PentaOptimaCmd, PentaOptimaCmdType } from '../types/penta'
import { PENTA_SECTOR_ORDER } from '../types/penta'
import type { PentaFieldChange, CascadeImpact } from '../types/pentaGovernance'
import { useToast } from '../composables/useToast'
import CopyGlyph  from './icons/CopyGlyph.vue'
import EmailGlyph from './icons/EmailGlyph.vue'
import SourcePin from './SourcePin.vue'
import { renderColorfulSpecHtml } from '../composables/useColorfulSpecHtml'
import { exportEmail, exportCopy } from '../composables/useExportShared'
import { useSettings } from '../composables/useSettings'
import type { FieldSource } from '../types/spec'
// r41 v301 (Tom Gilb 2026-06-23 verbatim "gmorgen. Please continue w backlog.")
// Mount the universal stage strip + agents strip + Stage 2 sub-step strip + guidance bar
// INSIDE PentaPanel so the planner never loses orientation while editing the Penta sectors.
// Mirrors r41 v298 SpecEditorPanel pattern.  Composes with Stages-are-Cyclic SUPREME,
// No-Silent-Removal SUPREME, MOVE Principle, DD-009 Zero-Training UI, No-Silent-Data-Loss
// SUPREME (auto-save before close-and-navigate), Twin portability.
import PlanningStageBar from './PlanningStageBar.vue'
import AgentsStrip from './AgentsStrip.vue'
import Stage2SubStepStrip from './Stage2SubStepStrip.vue'
import type { Stage2SubStepKey } from '../data/stage2SubSteps'
import type { AgentRegistryId } from '../composables/useAgentRegistry'

const props = defineProps<{
  spec:         SpecBlock | null
  open:         boolean
  /** Evo Steps — Design sector middle ring (Tom 2026-06-07: Solutions → Evo Steps → Tasks). */
  evoSteps?:    EvoStep[]
  /** Tasks keyed by Evo Step name — Design sector inner ring. */
  tasksByStep?: Record<string, TaskSuggestion[]>
  /** r41 v301 — current planning stage (1–11) so embedded PlanningStageBar can highlight. */
  planningStage?: number
  /** r41 v301 — spec-presence map for AgentsStrip gating; falls back to derivation from spec. */
  specPresence?: Partial<Record<string, boolean>>
  /** r41 v301 — current Stage 2 sub-step (only used when planningStage === 2). */
  stage2SubStep?: Stage2SubStepKey
  /** r41 v301 — completed Stage 2 sub-steps. */
  stage2DoneSteps?: Stage2SubStepKey[]
  /** r41 v301 — has-plan flag for PlanningStageBar tile gating. */
  hasPlan?: boolean
}>()

const emit = defineEmits<{
  'close': []
  'update-spec': [SpecBlock]
  /** r93qq — open the Value Aspects Articulation Tool against a V. entry */
  'open-value-aspects': [item: PentaItem]
  /** r41 v301 — User clicked a stage tile inside the embedded PlanningStageBar.
   *  App.vue closes Penta (auto-save first) and calls handleStageBarNav(n). */
  'navigate-stage': [n: number]
  /** r41 v301 — User clicked an agent pin inside the embedded AgentsStrip.
   *  App.vue closes Penta (auto-save first) and routes via _openAgentFromEditor. */
  'open-agent': [agentId: AgentRegistryId]
  /** r41 v301 — User clicked a Stage 2 sub-step pill (only mounted when stage === 2). */
  'go-stage2-substep': [target: Stage2SubStepKey]
  /** r41 v301 — User clicked "Continue to Stage 3" inside the Stage 2 strip. */
  'continue-stage2': []
}>()

// r41 v301 — Stage names for the embedded breadcrumb sentence.
// r41 v349 (Tom Gilb 2026-06-25 stage-label revert sweep): switched from
// hand-maintained duplicate to canonical PLANNING_STAGES import.  The hand
// map had 5 stages drift (2='Values' / 3='Solutions' / 4='Sharpen' /
// 5='Impacts' / 10='Plan' from before the SVERD rename) — parallel-impl
// drift class.  Now any rename in planningStages.ts propagates here.
import { PLANNING_STAGES as _CANONICAL_STAGES } from '../data/planningStages'
const PENTA_STAGE_NAMES: Record<number, string> = Object.fromEntries(
  _CANONICAL_STAGES.map(s => [s.stage, s.label])
)
const currentStageName = computed(() =>
  props.planningStage ? (PENTA_STAGE_NAMES[props.planningStage] ?? `Stage ${props.planningStage}`) : null
)

// r41 v301 — spec-presence default (mirrors SpecEditorPanel v298 pattern).
const computedSpecPresence = computed(() => {
  if (props.specPresence) return props.specPresence
  const s = props.spec
  return {
    spec:         !!s,
    stakeholders: (s?.stakeholders?.length ?? 0) > 0,
    values:       (s?.values?.length ?? 0) > 0,
    functions:    (s?.functions?.length ?? 0) > 0,
    solutions:    (s?.solutions?.length ?? 0) > 0,
    resources:    (s?.resources?.length ?? 0) > 0,
  } as Partial<Record<string, boolean>>
})

// r41 v301 — guidance-bar dynamic sentence per active sector.  Stage-Has-A-Purpose
// SUPREME + Zero-Training UI.  selectedSector is declared lower in this file but
// Vue resolves the ref at template-evaluation time, so forward reference is safe
// inside computed.
const pentaGuidanceText = computed<string>(() => {
  const stage = props.planningStage ?? 0
  const sector = selectedSector.value
  if (sector === 'stakeholders')
    return 'Editing Stakeholders. Each Stakeholder names a Definition + Description and lists the Values they care about.'
  if (sector === 'values')
    return 'Editing Values. Each Value needs Scale, Meter, Tolerable, Goal, and at least one Qualifier (avoid the Infinity Trap).'
  if (sector === 'efficiency')
    return 'Reviewing Efficiency = Sum of Values delivered / Sum of Resources consumed. Click the badge for the in-depth illumination.'
  if (sector === 'resources')
    return 'Editing Resources. Each Resource has Scale, Meter, Budget (Tolerable / Goal / Wish) and Qualifiers that bound when, where, who.'
  if (sector === 'design')
    return 'Editing Solutions and downstream Evo Steps / Tasks. Per Solution Parameters SUPREME, every Solution needs 7 required + 8 recommended parameters.'
  const stageName = PENTA_STAGE_NAMES[stage] ?? null
  return stageName
    ? `Penta Model — pick a sector to edit Stakeholders, Values, Resources, or Design. You are in Stage ${stage}: ${stageName}.`
    : 'Penta Model — pick a sector (Stakeholders, Values, Efficiency, Resources, Design) to view and edit specs in that ring.'
})

// r41 v301 — auto-save then emit navigation event (No-Silent-Data-Loss SUPREME).
function pentaAutoSaveBeforeNavigate(): void {
  try {
    if (selectedItem.value) applyItemEdits(true) // silent — same shape as line 1183
  } catch { /* never block navigation */ }
}
function onPentaEmbeddedStageNav(n: number): void {
  pentaAutoSaveBeforeNavigate()
  emit('navigate-stage', n)
}
function onPentaEmbeddedAgentOpen(agentId: AgentRegistryId): void {
  pentaAutoSaveBeforeNavigate()
  emit('open-agent', agentId)
}
function onPentaEmbeddedStage2Go(target: Stage2SubStepKey): void {
  pentaAutoSaveBeforeNavigate()
  emit('go-stage2-substep', target)
}
function onPentaEmbeddedStage2Continue(): void {
  pentaAutoSaveBeforeNavigate()
  emit('continue-stage2')
}

function openValueAspects(item: PentaItem): void {
  emit('open-value-aspects', item)
}

const specRef = toRef(props, 'spec')
const {
  pentaModel,
  applyScaleToValue,
  applyScaleToResource,
  applyScaleToAllValues,
  applyScaleToAllResources,
  buildOptimaPrompt,
} = usePenta(specRef)

const { showToast } = useToast()
const { settings: _settings } = useSettings()

// ── Spec Sources — field-level source attribution (Tom Gilb 2026-06-09) ────────
// Planguage rule: "Source: will always be specified explicitly or implied
// from editing or AI change activity."
// buildFieldSource() creates a FieldSource for a human edit. Call before
// emitting 'update-spec' in applyItemEdits() for every changed field.
function buildFieldSource(sourceType: 'human' | 'ai' | 'system' = 'human', toolName?: string): FieldSource {
  const userName = _settings.value.defaultPlanOwner?.trim() || 'User'
  return {
    source:     userName,
    sourceType,
    timestamp:  new Date().toISOString(),
    ...(toolName ? { tool: toolName } : {}),
  }
}

// ── Penta Governance (version control + cascade tracking) ─────────────────────
// Tom Gilb 2026-06-08: "We have to go through the same governance here as for all changes,
//   Save the Version, Get Approval, Decide to Update the Master, Or Not."

const planId = computed(() => props.spec?.name ?? 'default')
const {
  pendingChanges,
  versions,
  trackChange,
  saveVersion,
  detectCascadeImpacts,
  declareCascadeNotCalculated,
  approveVersion,
  rejectVersion,
  integrateVersion,
  deleteVersion,
  clearPending,
  updateImpactNote,
  setImpactStatus,
} = usePentaVersions(planId)

const showGovernance = ref(false)

// ── Standard Done-Changing Close Process (DD-standard-close-2026-06-09) ─────
const { isLocked, lock, unlock } = useSpecLock()
const { addVersion: _addSpecSnapshot, history: _specHistory } = useSpecHistory()
/** Count of OPTIMA / Claudian Apply actions since the last version snapshot. */
const _changesSinceSnapshot = ref(0)
const _lastSaved             = ref<Date | null>(null)

// ── Cascade Ripple State (Tom 2026-06-10) ────────────────────────────────────
// Tom: "I want spelled out, in the App: 1. The Fact that a change can cause ripple
//   effects (Blinking Red Data). 2. Notice that Changes are not yet computed.
//   3. Notice where computed Changes are. And WHAT MIGHT HAPPEN, IF [you change this to X]."
// Three layers:
//   cascadeSources — items whose fields are in pendingChanges (amber pulse ring)
//   cascadeTargets — items targeted by pending cascade impacts (red blink dot)
//   whatIfTargets  — items that WOULD be impacted if current edit-refs were applied (orange flash)

// cascadeRippleOpen REMOVED r93e (Tom Gilb 2026-06-11 "the right most triangle hides the apply line"):
// the Cascade Ripple Panel header was a collapsible ▼/▲ button that hid the action row (Diagram /
// Copy / Email / Governance / Declare). Per Rule 10 "No Disclosure Triangles" (sem-app-ui-rules.md),
// the panel body now ALWAYS renders when impacts exist. No open/closed state needed.
const cascadeDiagramOpen    = ref(false)
const efficiencyInsightOpen = ref(false)

/** Item IDs that CAUSED pending changes → amber sonar pulse ring in SVG. */
const cascadeSources = computed<Set<string>>(() =>
  new Set(pendingChanges.value.map((c: PentaFieldChange) => c.itemId))
)

/** All cascade impacts already computed from pendingChanges — "WHAT HAPPENED". */
const pendingImpacts = computed<CascadeImpact[]>(() => {
  if (!props.spec || pendingChanges.value.length === 0) return []
  return detectCascadeImpacts(pendingChanges.value, props.spec)
})

/** Item IDs targeted by pending cascade → red blink dot in SVG. */
const cascadeTargets = computed<Set<string>>(() =>
  new Set(pendingImpacts.value.map((i: CascadeImpact) => i.effectItemId))
)

/**
 * Hypothetical changes derived from the current edit-ref values vs stored spec.
 * Computed BEFORE the user clicks Apply Changes — drives the "WHAT MIGHT HAPPEN IF" section.
 * Reactive: updates on every keystroke in Goal / Tolerable / Wish / Scale / Meter / Budget fields.
 */
const whatIfChanges = computed<PentaFieldChange[]>(() => {
  if (!selectedItem.value || !props.spec) return []
  const item = selectedItem.value
  const changes: PentaFieldChange[] = []
  const wi = (
    id: string, type: PentaFieldChange['itemType'], field: string, before: string, after: string
  ): PentaFieldChange => ({
    id, changedAt: '', itemId: item.id, itemType: type,
    itemLabel: item.label, field, before, after,
  })

  if (item.type === 'value') {
    const ex = props.spec.values.find(v => v.id === item.id)
    if (!ex) return []
    const goalNum = parseNum(editGoal.value)
    const tolNum  = parseNum(editTolerable.value)
    if (!isNaN(goalNum)  && String(goalNum) !== (ex.goal ?? ''))
      changes.push(wi('wi-g', 'value', 'goal',      ex.goal ?? '', String(goalNum)))
    if (!isNaN(tolNum)   && String(tolNum)  !== (ex.tolerable ?? ''))
      changes.push(wi('wi-t', 'value', 'tolerable', ex.tolerable ?? '', String(tolNum)))
    if (editWish.value.trim()  && editWish.value.trim()  !== (ex.wish  ?? ''))
      changes.push(wi('wi-w',  'value', 'wish',  ex.wish  ?? '', editWish.value.trim()))
    if (editScale.value.trim() && editScale.value.trim() !== (ex.scale ?? ''))
      changes.push(wi('wi-sc', 'value', 'scale', ex.scale ?? '', editScale.value.trim()))
    if (editMeter.value.trim() && editMeter.value.trim() !== (ex.meter ?? ''))
      changes.push(wi('wi-m',  'value', 'meter', ex.meter ?? '', editMeter.value.trim()))
  } else if (item.type === 'resource') {
    const ex = (props.spec.resources ?? []).find(r => r.id === item.id)
    if (!ex) return []
    // r87 BUG FIX (Tom 2026-06-10: "I changed the budget and the consumed, and nothing happened"):
    // Previously this used `editGoal.value`, but the Resource form's Budget input is bound to
    // `editBudget` (NOT editGoal — that's the Value-form ref). So every Resource Budget edit
    // was silently invisible to the cascade ripple + sticky banner. Also adds Status (consumed)
    // tracking so changes to BOTH fields register as pending edits.
    const budgetNum   = parseNum(editBudget.value)
    const consumedNum = parseNum(editConsumed.value)
    if (!isNaN(budgetNum)   && String(budgetNum)   !== (ex.budget ?? ex.goal ?? ''))
      changes.push(wi('wi-b', 'resource', 'budget', ex.budget ?? ex.goal ?? '', String(budgetNum)))
    if (!isNaN(consumedNum) && String(consumedNum) !== (ex.status ?? ''))
      changes.push(wi('wi-s', 'resource', 'status', ex.status ?? '',                 String(consumedNum)))
  }
  return changes
})

/** Cascade impacts predicted from unsaved edit-ref state — "WHAT MIGHT HAPPEN IF" view. */
const whatIfImpacts = computed<CascadeImpact[]>(() => {
  if (!props.spec || whatIfChanges.value.length === 0) return []
  return detectCascadeImpacts(whatIfChanges.value, props.spec)
})

/** Item IDs that WOULD be impacted if current edits are applied → orange flash dot in SVG. */
const whatIfTargets = computed<Set<string>>(() =>
  new Set(whatIfImpacts.value.map((i: CascadeImpact) => i.effectItemId))
)

/** Set of field names that are currently dirty for the selected item — used by the
 *  input pulse-blink class binding (Tom Gilb 2026-06-10 r87: "I like the blinking
 *  value and budget" — make the actual input fields blink too, not just the wheel). */
const dirtyFields = computed<Set<string>>(() =>
  new Set(whatIfChanges.value.map(c => c.field))
)

// ── Direction helper (Tom Gilb 2026-06-11 r92): "Flashing green look good, what
// if we added + or - to it?" — every change has a before/after, so it has a sign.
// + means the value went UP (budget increased, goal raised, status growth, etc.).
// − means the value went DOWN (budget cut, goal lowered, status decreased).
// ↻ means a non-numeric change (Scale unit, Meter method) — direction has no sign.
function changeDirection(before: string, after: string): '+' | '−' | '↻' {
  const bNum = parseFloat(before)
  const aNum = parseFloat(after)
  if (isNaN(bNum) || isNaN(aNum)) return '↻'
  if (aNum > bNum) return '+'
  if (aNum < bNum) return '−'
  return '↻'
}

/** Map of item ID → primary direction of its pending change(s). Last write wins.
 *  Used to overlay a +/− glyph on the SVG amber sonar pulse for cascade sources. */
const sourceDirection = computed<Map<string, '+' | '−' | '↻'>>(() => {
  const m = new Map<string, '+' | '−' | '↻'>()
  for (const c of pendingChanges.value) m.set(c.itemId, changeDirection(c.before, c.after))
  return m
})

/** Map of item ID → primary direction of its WHAT-IF change(s). Same as above
 *  but for unsaved edits that haven't yet been applied. */
const whatIfDirection = computed<Map<string, '+' | '−' | '↻'>>(() => {
  const m = new Map<string, '+' | '−' | '↻'>()
  for (const c of whatIfChanges.value) m.set(c.itemId, changeDirection(c.before, c.after))
  return m
})

/** Export the Cascade Ripple (Tom Gilb 2026-06-11 r92: "does it export").
 *  Builds colourful flat-table HTML matching the SEM Colorful HTML Spec Email Rule. */
async function exportCascade(mode: 'copy' | 'email'): Promise<void> {
  const html  = renderCascadeRippleHtml()
  const plain = renderCascadeRipplePlain()
  if (mode === 'copy') {
    await exportCopy(html, plain)
    showToast('Cascade Ripple copied as colourful HTML — paste with ⌘V')
  } else {
    await exportEmail(html, `Cascade Ripple: ${planLabel.value}`, planLabel.value, 'Tom@Gilb.com', plain)
  }
}

function renderCascadeRippleHtml(): string {
  const planName = planLabel.value
  const pendCount = pendingImpacts.value.length
  const whatIfCount = whatIfImpacts.value.length
  const dirSym = (b: string, a: string): string => {
    const bn = parseFloat(b); const an = parseFloat(a)
    if (isNaN(bn) || isNaN(an)) return '↻'
    return an > bn ? '+' : an < bn ? '−' : '↻'
  }
  const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const renderRow = (i: CascadeImpact, c: PentaFieldChange | undefined, color: string, lightBg: string): string => {
    const d = c ? dirSym(c.before, c.after) : '↻'
    const dColor = d === '+' ? '#15803d' : d === '−' ? '#b91c1c' : '#64748b'
    return `<tr>
      <td bgcolor="${lightBg}" align="center" style="background:${lightBg};border:1px solid ${color}33;padding:6px;font-size:14px;font-weight:900;color:${dColor};">${d}</td>
      <td bgcolor="${lightBg}" style="background:${lightBg};border:1px solid ${color}33;padding:6px;font-family:ui-monospace,monospace;font-size:11px;color:#1e293b;"><b>${escapeHtml(i.causeItemId)}</b></td>
      <td bgcolor="${lightBg}" style="background:${lightBg};border:1px solid ${color}33;padding:6px;font-size:11px;color:#475569;">${escapeHtml(i.causeField)}: <code>${c ? escapeHtml(c.before || '—') : '—'}</code> → <code>${c ? escapeHtml(c.after || '—') : '—'}</code></td>
      <td bgcolor="${lightBg}" style="background:${lightBg};border:1px solid ${color}33;padding:6px;font-size:10px;color:${color};text-transform:uppercase;font-weight:700;">${i.order}</td>
      <td bgcolor="${lightBg}" style="background:${lightBg};border:1px solid ${color}33;padding:6px;font-size:11px;color:#1e293b;"><b>${escapeHtml(i.effectItemType)}: ${escapeHtml(i.effectItemId)}</b></td>
      <td bgcolor="${lightBg}" style="background:${lightBg};border:1px solid ${color}33;padding:6px;font-size:11px;color:#475569;">${escapeHtml(i.impactDescription)}</td>
    </tr>`
  }
  return `
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:920px;font-family:system-ui,-apple-system,sans-serif;border-collapse:collapse;">
  <tr><td bgcolor="#dc2626" style="background:#dc2626;color:#fff;padding:18px 22px;border-radius:12px 12px 0 0;">
    <div style="font-size:22px;font-weight:900;">⚡ Cascade Ripple · ${planName}</div>
    <div style="font-size:13px;opacity:0.9;margin-top:4px;">${pendCount} locked-in consequence${pendCount !== 1 ? 's' : ''} · ${whatIfCount} hypothetical (if applied) · ${pendingChanges.value.length + whatIfChanges.value.length} change${pendingChanges.value.length + whatIfChanges.value.length !== 1 ? 's' : ''} tracked</div>
  </td></tr>
  ${pendCount > 0 ? `
  <tr><td bgcolor="#fef2f2" style="background:#fef2f2;padding:14px 22px;border-left:4px solid #dc2626;">
    <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:#991b1b;letter-spacing:1px;">🔴 Locked-In · already applied (${pendCount})</div>
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:8px;border-collapse:collapse;">
      <tr>
        <th align="center" bgcolor="#fecaca" style="background:#fecaca;border:1px solid #dc262633;padding:5px;font-size:10px;text-transform:uppercase;color:#991b1b;">±</th>
        <th align="left" bgcolor="#fecaca" style="background:#fecaca;border:1px solid #dc262633;padding:5px;font-size:10px;text-transform:uppercase;color:#991b1b;">Changed</th>
        <th align="left" bgcolor="#fecaca" style="background:#fecaca;border:1px solid #dc262633;padding:5px;font-size:10px;text-transform:uppercase;color:#991b1b;">Field · Before → After</th>
        <th align="left" bgcolor="#fecaca" style="background:#fecaca;border:1px solid #dc262633;padding:5px;font-size:10px;text-transform:uppercase;color:#991b1b;">Order</th>
        <th align="left" bgcolor="#fecaca" style="background:#fecaca;border:1px solid #dc262633;padding:5px;font-size:10px;text-transform:uppercase;color:#991b1b;">Consequence For</th>
        <th align="left" bgcolor="#fecaca" style="background:#fecaca;border:1px solid #dc262633;padding:5px;font-size:10px;text-transform:uppercase;color:#991b1b;">Impact</th>
      </tr>
      ${pendingImpacts.value.map(i => renderRow(i, pendingChanges.value.find(c => c.itemId === i.causeItemId && c.field === i.causeField) ?? pendingChanges.value.find(c => c.itemId === i.causeItemId), '#dc2626', '#fff')).join('')}
    </table>
  </td></tr>
  ` : ''}
  ${whatIfCount > 0 ? `
  <tr><td bgcolor="#fff7ed" style="background:#fff7ed;padding:14px 22px;border-left:4px solid #f97316;">
    <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:#9a3412;letter-spacing:1px;">🟠 Hypothetical · if you apply current edits (${whatIfCount})</div>
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:8px;border-collapse:collapse;">
      <tr>
        <th align="center" bgcolor="#fed7aa" style="background:#fed7aa;border:1px solid #f9731633;padding:5px;font-size:10px;text-transform:uppercase;color:#9a3412;">±</th>
        <th align="left" bgcolor="#fed7aa" style="background:#fed7aa;border:1px solid #f9731633;padding:5px;font-size:10px;text-transform:uppercase;color:#9a3412;">Would Change</th>
        <th align="left" bgcolor="#fed7aa" style="background:#fed7aa;border:1px solid #f9731633;padding:5px;font-size:10px;text-transform:uppercase;color:#9a3412;">Field · Before → After</th>
        <th align="left" bgcolor="#fed7aa" style="background:#fed7aa;border:1px solid #f9731633;padding:5px;font-size:10px;text-transform:uppercase;color:#9a3412;">Order</th>
        <th align="left" bgcolor="#fed7aa" style="background:#fed7aa;border:1px solid #f9731633;padding:5px;font-size:10px;text-transform:uppercase;color:#9a3412;">Would Affect</th>
        <th align="left" bgcolor="#fed7aa" style="background:#fed7aa;border:1px solid #f9731633;padding:5px;font-size:10px;text-transform:uppercase;color:#9a3412;">Predicted Impact</th>
      </tr>
      ${whatIfImpacts.value.map(i => renderRow(i, whatIfChanges.value.find(c => c.itemId === i.causeItemId && c.field === i.causeField) ?? whatIfChanges.value.find(c => c.itemId === i.causeItemId), '#f97316', '#fff')).join('')}
    </table>
  </td></tr>
  ` : ''}
  <tr><td bgcolor="#f8fafc" style="background:#f8fafc;padding:12px 22px;border-radius:0 0 12px 12px;font-size:10px;color:#64748b;">
    ± column: <b style="color:#15803d;">+</b> = value went up · <b style="color:#b91c1c;">−</b> = value went down · ↻ = non-numeric (Scale/Meter)
  </td></tr>
</table>`
}

function renderCascadeRipplePlain(): string {
  const planName = planLabel.value
  const dirSym = (b: string, a: string): string => {
    const bn = parseFloat(b); const an = parseFloat(a)
    if (isNaN(bn) || isNaN(an)) return '↻'
    return an > bn ? '+' : an < bn ? '−' : '↻'
  }
  const fmtImpact = (i: CascadeImpact, changes: PentaFieldChange[]): string => {
    const c = changes.find(ch => ch.itemId === i.causeItemId && ch.field === i.causeField) ?? changes.find(ch => ch.itemId === i.causeItemId)
    const d = c ? dirSym(c.before, c.after) : '↻'
    return `  ${d} ${i.causeItemId} (${i.causeField}: ${c?.before ?? '—'} → ${c?.after ?? '—'}) → [${i.order}] ${i.effectItemType}: ${i.effectItemId}\n    ${i.impactDescription}`
  }
  return [
    `⚡ CASCADE RIPPLE · ${planName}`,
    `${pendingImpacts.value.length} locked-in · ${whatIfImpacts.value.length} hypothetical · ${pendingChanges.value.length + whatIfChanges.value.length} changes tracked`,
    ``,
    ...(pendingImpacts.value.length > 0 ? [`🔴 LOCKED-IN (already applied):`, ...pendingImpacts.value.map(i => fmtImpact(i, pendingChanges.value)), ``] : []),
    ...(whatIfImpacts.value.length > 0 ? [`🟠 HYPOTHETICAL (if you apply current edits):`, ...whatIfImpacts.value.map(i => fmtImpact(i, whatIfChanges.value))] : []),
    ``,
    `± column: + value went up · − value went down · ↻ non-numeric (Scale/Meter)`,
  ].join('\n')
}

/** Direction of the CAUSING change for a cascade-target item. Resolves to the
 *  direction of whichever pending (or what-if) change made this item a target.
 *  Used by the SVG pulse-dot overlays on cascade targets so a Solution flashing
 *  red/orange also displays whether its impact is + (its Value went UP) or − (down). */
function getTargetDirection(effectItemId: string, scope: 'applied' | 'whatif'): '+' | '−' | '↻' | '' {
  const impacts = scope === 'applied' ? pendingImpacts.value : whatIfImpacts.value
  const matchingImpact = impacts.find(i => i.effectItemId === effectItemId)
  if (!matchingImpact) return ''
  const changes = scope === 'applied' ? pendingChanges.value : whatIfChanges.value
  const causingChange = changes.find(c => c.itemId === matchingImpact.causeItemId)
  if (!causingChange) return ''
  return changeDirection(causingChange.before, causingChange.after)
}

/** "Declare Not Computed" — saves a version flagging cascade as not-yet-analyzed. */
function handleDeclareNotComputed(): void {
  if (!props.spec || pendingChanges.value.length === 0) return
  const ts    = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  saveVersion(
    `Changes · Cascade Not Calculated · ${ts}`,
    'Cascade not yet computed — impacts flagged for later analysis.',
    props.spec,
  )
  // The version was just pushed; mark all its impacts as declared-not-calculated
  const latestId = versions.value[0]?.id ?? ''
  if (latestId) declareCascadeNotCalculated(latestId)
  // r93e: cascadeRippleOpen removed — the v-if on pendingImpacts/whatIfImpacts naturally hides
  // the panel once handleDeclareNotComputed clears pending changes.
  showToast('Pending changes versioned. Cascade declared not yet calculated.')
}

/** Source version — the most recent saved snapshot for this spec in History.
 *  "Source" = the master the trial is compared against.
 *  Tom Gilb 2026-06-10: "What is our Source Version and Title exactly?" */
const sourceVersionLabel = computed(() => {
  const specName = (props.spec?.name ?? '').trim()
  // Find most recent history entry whose specName matches (or the global most-recent if none)
  const match = _specHistory.value.find(v =>
    (v.specName ?? (v as any).planName ?? '').trim() === specName
  ) ?? _specHistory.value[0] ?? null
  if (!match) return null
  const date = new Date(match.timestamp)
  const today = new Date()
  const isToday = date.toDateString() === today.toDateString()
  return {
    label:   match.label,
    time:    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    // Day + date (Tom Gilb 2026-06-10 r89: "the source gives a time, and no Day and Date,
    //  the time is not today so" — old display showed only time which was misleading when
    //  the snapshot wasn't from today)
    day:     date.toLocaleDateString([], { weekday: 'short' }),
    date:    date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }),
    isToday,
    summary: match.summary,
  }
})

// ── Strategy Mode — display-label overrides (Tom Gilb 2026-06-09) ────────────
// termFor('Values') → 'Strategic Objectives' when Strategy Mode is ON.
// Underlying data model is UNCHANGED — display-only, Twin-portable.
const { termFor } = useStrategyMode()

/**
 * Returns the display label for a Penta sector, applying Strategy Mode
 * terminology overrides when active.
 *
 * 'values' sector  → termFor('Values')  → 'Strategic Objectives' (strategy mode)
 * 'design' sector  → termFor('Design')  → 'Strategies'           (strategy mode)
 * All other sectors → SECTOR_COLORS[id].label (no override needed)
 */
function sectorDisplayLabel(sectorId: PentaSectorId): string {
  return termFor(SECTOR_COLORS[sectorId].label)
}

/** Returns the first FieldSource found in any field of a PentaItem, or null if none.
 *  Used to show a summary [←] source coverage indicator in the accordion item cards. */
function itemFirstSource(item: PentaItem): FieldSource | null {
  const spec = props.spec
  if (!spec) return null
  let fieldSources: Record<string, FieldSource> | undefined
  switch (item.type) {
    case 'value':      fieldSources = spec.values?.find(v => v.id === item.id)?.fieldSources; break
    case 'function':   fieldSources = spec.functions?.find(f => f.id === item.id)?.fieldSources; break
    case 'solution':   fieldSources = spec.solutions?.find(s => s.id === item.id)?.fieldSources; break
    case 'constraint': fieldSources = spec.constraints?.find(c => c.id === item.id)?.fieldSources; break
    case 'resource':   fieldSources = spec.resources?.find(r => r.id === item.id)?.fieldSources; break
    default:           fieldSources = undefined
  }
  if (!fieldSources) return null
  const firstKey = Object.keys(fieldSources)[0]
  return firstKey ? (fieldSources[firstKey] ?? null) : null
}

// ── Penta Export helpers (item / sector / full — Export-on-all-windows rule) ─────
const planLabel = computed(() => props.spec?.name ?? 'Penta Model')

/** Build a partial SpecBlock — keeps plan metadata, replaces entries with subset. */
function subsetSpec(entries: {
  functions?:   FEntry[]
  values?:      VEntry[]
  solutions?:   SEntry[]
  constraints?: CEntry[]
  resources?:   REntry[]
}): SpecBlock {
  return {
    ...props.spec!,
    functions:   entries.functions   ?? [],
    values:      entries.values      ?? [],
    solutions:   entries.solutions   ?? [],
    constraints: entries.constraints ?? [],
    resources:   entries.resources   ?? [],
  }
}

/** Build a SpecBlock with only the entries matching a single PentaItem. */
function singleItemSpec(item: PentaItem): SpecBlock {
  if (!props.spec) return props.spec!
  const s = props.spec
  switch (item.type) {
    case 'value':
      return subsetSpec({ values:      s.values?.filter(v => v.id === item.id) ?? [] })
    case 'function':
      return subsetSpec({ functions:   s.functions?.filter(f => f.id === item.id) ?? [] })
    case 'solution':
    case 'evo-step':
    case 'task':
      return subsetSpec({ solutions:   s.solutions?.filter(sol => sol.id === item.id) ?? [] })
    case 'constraint':
      return subsetSpec({ constraints: s.constraints?.filter(c => c.id === item.id) ?? [] })
    case 'resource':
      return subsetSpec({ resources:   s.resources?.filter(r => r.id === item.id) ?? [] })
    default:
      return subsetSpec({})
  }
}

/** Build a SpecBlock with only the entries belonging to one Penta sector. */
function sectorSpec(sectorId: PentaSectorId): SpecBlock {
  if (!props.spec || !pentaModel.value) return props.spec!
  const s   = props.spec
  const ids = new Set(pentaModel.value.sectors[sectorId].items.map(i => i.id))
  switch (sectorId) {
    case 'scope':
      return subsetSpec({
        functions:   s.functions?.filter(f => ids.has(f.id))   ?? [],
        constraints: s.constraints?.filter(c => ids.has(c.id)) ?? [],
      })
    case 'values':
      return subsetSpec({ values:      s.values?.filter(v => ids.has(v.id))     ?? [] })
    case 'resources':
      return subsetSpec({ resources:   s.resources?.filter(r => ids.has(r.id))  ?? [] })
    case 'design':
      return subsetSpec({ solutions:   s.solutions?.filter(sol => ids.has(sol.id)) ?? [] })
    case 'efficiency':
      // Efficiency is computed, not spec entries — export the full spec so the context is clear.
      return props.spec
    default:
      return subsetSpec({})
  }
}

/** One-line plain text summary of a PentaItem (for mailto body). */
function itemPlainText(item: PentaItem): string {
  const lines: string[] = [`${item.type.toUpperCase()}: ${item.label}`]
  if (item.description)          lines.push(`  Description: ${item.description}`)
  if (item.scale)                lines.push(`  Scale: ${item.scale}`)
  if (item.meter)                lines.push(`  Meter: ${item.meter}`)
  if (item.tolerable != null)    lines.push(`  Tolerable: ${item.tolerable}`)
  if (item.goal != null)         lines.push(`  Goal: ${item.goal}`)
  if (item.wish != null)         lines.push(`  Wish: ${item.wish}`)
  if (item.status != null)       lines.push(`  Status: ${item.status}`)
  if (item.impact)               lines.push(`  Impact: ${item.impact}`)
  if (item.budget != null)       lines.push(`  Budget: ${item.budget}`)
  if (item.consumed != null)     lines.push(`  Consumed: ${item.consumed}`)
  if (item.specOwner)            lines.push(`  Spec Owner: ${item.specOwner}`)
  if (item.justification)        lines.push(`  Justification: ${item.justification}`)
  return lines.join('\n')
}

/** Plain text for all items in a sector. */
function sectorPlainText(sectorId: PentaSectorId): string {
  const items = pentaModel.value?.sectors[sectorId].items ?? []
  return items.map(itemPlainText).join('\n\n')
}

/** Plain text for the entire Penta model. */
function fullPlainText(): string {
  return PENTA_SECTOR_ORDER
    .map(sid => {
      const label = SECTOR_COLORS[sid].label
      const body  = sectorPlainText(sid)
      return body ? `=== ${label} ===\n${body}` : ''
    })
    .filter(Boolean)
    .join('\n\n')
}

// ── Export handlers ──────────────────────────────────────────────────────────

async function exportItemCopy(item: PentaItem) {
  const html  = renderColorfulSpecHtml(singleItemSpec(item), `${item.label} — ${planLabel.value}`, undefined)
  const plain = itemPlainText(item)
  await exportCopy(html, plain)
  showToast(`${item.label} copied as colorful HTML — paste with ⌘V`)
}

async function exportItemEmail(item: PentaItem) {
  const html  = renderColorfulSpecHtml(singleItemSpec(item), `${item.label} — ${planLabel.value}`, undefined)
  const plain = itemPlainText(item)
  await exportEmail(html, `Penta: ${item.label}`, item.label, 'Tom@Gilb.com', plain)
}

async function exportSectorCopy(sectorId: PentaSectorId) {
  const label = SECTOR_COLORS[sectorId].label
  const html  = renderColorfulSpecHtml(sectorSpec(sectorId), `${label} — ${planLabel.value}`, undefined)
  const plain = sectorPlainText(sectorId)
  await exportCopy(html, plain)
  showToast(`${label} sector copied as colorful HTML — paste with ⌘V`)
}

async function exportSectorEmail(sectorId: PentaSectorId) {
  const label = SECTOR_COLORS[sectorId].label
  const html  = renderColorfulSpecHtml(sectorSpec(sectorId), `${label} — ${planLabel.value}`, undefined)
  const plain = sectorPlainText(sectorId)
  await exportEmail(html, `Penta ${label}: ${planLabel.value}`, label, 'Tom@Gilb.com', plain)
}

async function exportFullCopy() {
  if (!props.spec) return
  const html  = renderColorfulSpecHtml(props.spec, planLabel.value, undefined)
  const plain = fullPlainText()
  await exportCopy(html, plain)
  showToast('Full Penta Model copied as colorful HTML — paste with ⌘V')
}

async function exportFullEmail() {
  if (!props.spec) return
  const html  = renderColorfulSpecHtml(props.spec, planLabel.value, undefined)
  const plain = fullPlainText()
  await exportEmail(html, `Penta Model: ${planLabel.value}`, planLabel.value, 'Tom@Gilb.com', plain)
}

// ── Per-sector deep info (Tom 2026-06-09: hover def + dblclick extended panel) ──
interface PentaSectorDeepInfo {
  shortDef:    string   // one-sentence hover HoverHint
  fullDef:     string   // full glossary-style definition
  glyphNote:   string   // glyph design rationale
  plImportance: string  // deep Planguage importance
  historicalFact: string
}

const PENTA_SECTOR_DEEP_INFO: Record<PentaSectorId, PentaSectorDeepInfo> = {
  scope: {
    shortDef: 'Functions and binary Constraints that define what the system does and must not do — the boundary of the design space.',
    fullDef: 'Scope = Functions (F. entries — what the system does, binary present/absent) + binary Constraints (C. entries — what the system must NOT do or must maintain). Stakeholders are the sources of every Scope entry, not a sector themselves. Every Function has a presenceTest (a binary statement of presence or absence) — there are no degrees of function, only present or absent.',
    glyphNote: 'The Scope sector uses the bracket-asterisk-bracket form [*] — the most fundamental Planguage keyed element, representing a bounded entity. Functions (binary capabilities) and Constraints (hard boundaries) together define the space inside those brackets.',
    plImportance: 'Scope is the hardest sector to discipline. Most planning failures begin with ambiguous Scope — functions with implied quality levels baked in (a Planguage violation, DD-004), or Constraints stated as soft preferences rather than hard binary limits. Correct Scope forces the question: "Is this thing either present or absent?" If the answer requires a number, it belongs in Values.',
    historicalFact: 'The Function-is-binary principle (DD-004) originates from Tom Gilb\'s 1988 "Principles of Software Engineering Management", where every feature had a binary acceptance criterion. The insight: quality is not a property of Functions, it is a separate measurable Value. Most requirements methods conflate the two — Planguage separates them as an architectural decision.',
  },
  values: {
    shortDef: 'Quantified performance criteria — what stakeholders need, measured on a Scale with Tolerable, Goal, and Wish commitment levels.',
    fullDef: 'A Value entry specifies what a stakeholder needs measured: Scale (the measurement dimension — e.g. "seconds per search"), Meter (how to measure it — e.g. "stopwatch from query submission to first result displayed"), Tolerable (minimum non-failure threshold — the project fails if not reached), Goal (the committed promise — negotiated trade-off), and Wish (stakeholder ideal — uncommitted, independent of cost). Values are the ONLY specification language in Planguage that carries explicit commitment levels.',
    glyphNote: 'The Value glyph uses >> (double chevron) — representing progressive levels of commitment: Tolerable → Goal → Wish. Each chevron is a threshold gate. The keyed form [>>] denotes a graded performance scale with at least two commitment levels. Color: violet (canonical Planguage Value color).',
    plImportance: 'Values are the ONLY basis for rational prioritization in Planguage. A plan without quantified Values is a wish list — there is no way to determine which Solutions to implement, in what order, or when the project has succeeded. "If you can\'t measure it, you can\'t manage it." — Tom Gilb (after Deming). The Tolerable/Goal/Wish structure uniquely addresses the planning failure of setting only one threshold.',
    historicalFact: 'The quantified scale/meter/tolerable/goal/wish pattern emerged from Tom Gilb\'s Software Metrics (1976) and was formalized in Competitive Engineering (2005). Most requirements methods set a single acceptance threshold — Planguage was the first method to mandate three commitment levels per Value, reflecting the reality that stakeholders have a minimum they can accept, a promise they negotiate, and a dream they aspire to.',
  },
  efficiency: {
    shortDef: 'Value achievement / Resource utilization — how much stakeholder benefit is produced per unit consumed. Ratio ≥ 1.5 = excellent.',
    fullDef: 'Penta Efficiency = (average V. goal achievement ratio across all Value entries) / (average R. budget utilization ratio across all Resource entries). It is the ONLY sector in the Penta Model with no direct spec entries — it is computed from the other sectors. A ratio ≥ 1.5 means the plan delivers 50% more Value achievement than it consumes in Resources. Grades: ≥ 1.5 = excellent, ≥ 1.0 = good, ≥ 0.6 = acceptable, < 0.6 = poor.',
    glyphNote: 'Efficiency now has its dedicated Color Artsy Icon (approved by Tom Gilb 2026-06-10): a fraction stack — Σ [*] in violet over Σ € in amber, divided by a hand-drawn calligraphic line. It reads "sum of Values divided by sum of Resources" and lives in the center hub of the pinwheel above the percentage readout. Σ is universal mathematical (no English letters), [*] is the canonical Planguage Value keyed icon, and € is Tom\'s chosen currency symbol — the glyph is fully international per DD-015. The sector fill is teal/cyan, representing the emergent property arising from the interplay of Values (violet) and Resources (blue-green).',
    plImportance: '"Efficiency is not about doing things right — it is about achieving the right Values at the right Resource cost." A plan optimizing only for Value delivery (ignoring Resources) will overspend. A plan optimizing only for Resource economy (ignoring Values) will deliver nothing stakeholders care about. The Penta Model forces both into a single visible ratio — making the trade-off explicit and measurable.',
    historicalFact: 'The Penta Model (Tom Gilb & Al Shalloway, 2022) introduced Efficiency as a formal fifth sector — explicitly preventing the common planning failure of treating Value and Resource as independent concerns. The ratio metric maps directly to ROI. Prior planning methods tracked cost and value separately; Penta forces their ratio into a single visible dashboard number.',
  },
  resources: {
    shortDef: 'Budgets and capacities consumed to produce Values — time, money, people, energy — each with a budget limit and a consumption status.',
    fullDef: 'A Resource entry specifies a capacity constraint: what is available (budget/goal), what has been consumed (status), the unit (scale), and minimum/target levels (Tolerable/Goal). Resources are the cost side of the Efficiency equation. Every Resource entry is simultaneously a budget constraint and a measurement axis. In the Planguage priority engine, all Resource budgets must be respected — a plan that achieves all Values but violates a Resource budget has not succeeded.',
    glyphNote: 'The Resource glyph uses [*]→* (GetGlyph form) — taking from an available store. Resources flow into the system and are consumed. The bracket-asterisk-bracket form denotes a bounded store; the arrow denotes extraction. Color: blue-green (canonical Planguage Resource color), distinct from the pure violet of Values.',
    plImportance: 'Resources ARE constraints. Every R. entry is a hard edge on the design space — no combination of Solutions may be chosen that violates any Resource budget. In the DD-006 definition of SUCCESS: all Values reached AND all Constraints respected AND all Resource budgets respected. The Resources sector makes the budget structure first-class in the plan — not a footnote in a project management spreadsheet.',
    historicalFact: 'Planguage Resource entries evolved from Tom Gilb\'s 1988 "Principles of Software Engineering Management" cost-tracking language, where every feature had an explicit cost column. The modern R. entry adds the Tolerable/Goal/Wish threshold structure, making Resource management a Planguage citizen on equal footing with Value management.',
  },
  design: {
    shortDef: 'Solutions, Evo Steps, and Tasks that implement the plan — what the system will DO to achieve Values within Constraints. Hierarchy radiates outward.',
    fullDef: 'The Design sector contains S. (Solution) entries — implementable designs that produce Values. Solutions are at the core (innermost ring): they are the committed design decisions. Solutions decompose into Evo Steps (middle ring: tactical delivery increments — each an independently testable value-delivery cycle). Evo Steps decompose into Tasks (outermost ring: finest executable work units). The hierarchy radiates outward from the design core — Solutions → Evo Steps → Tasks.',
    glyphNote: 'The Design/Solution glyph uses [*]→ (PlSolutionIcon) — transforming the system from its current state ([*]) to a new state (→). Solutions drive state change. The arrow points outward from the bracket, representing the design pushing the system forward. Color: orange (canonical Planguage Solution color).',
    plImportance: 'In planning, the clear complete Values, Constraints, and Resources are a prerequisite for logically determining a set of Solutions — or even validating a "pre-mature" suggestion or constraint of a Solution. If a Solution is specified early, it might be classified as a "Design Constraint" ("we have to do this Solution, no matter the consequences"). As such, it is simultaneously a requirement and a design! If the "early Solution" is a suggestion to be considered, it should be annotated as such and source-attributed. If it is the common anti-pattern — a Solution proposed as "the objective" — then we should try to derive the implied requirements, use them, and keep the Solution as a suggestion, not a "constraint". All this is about keeping our focus on the real Values, and not getting distracted by fads, market forces, and ignorance. — Tom Gilb 2026-06-09',
    historicalFact: 'The constraint "Solutions must be linked to Values" dates to Tom Gilb\'s Evo Method (1976), formalized as Impact Estimation in Competitive Engineering (2005). The three-ring hierarchy (Solution → Evo Step → Task) models the decomposition chain from strategic design choice to executable work unit — a chain that makes every task\'s value-justification traceable upward through the entire plan.',
  },
}

// ── Balance-percent formatting helper (Tom Gilb 2026-06-10 r83) ───────────────
// New SIGNED semantic: 0 = balance, +N% = N% more resources than needed (surplus),
// -N% = N% deficit. This helper renders with explicit "+" prefix on positive values
// (negative gets "-" automatically from Math.round) so the sign is always visible.
function fmtBalance(n: number): string {
  const r = Math.round(n)
  // Tom Gilb 2026-06-11 r92c: for large values (|balance| ≥ 1000% i.e. ratio ≥ 11×),
  // the percentage representation is cognitively useless ("+41567%" doesn't tell anyone
  // anything actionable). Switch to ratio×: "Values delivering at 417× the cost".
  // Threshold 999 chosen so the percent representation always fits 4 chars (+999%).
  if (Math.abs(r) >= 1000) {
    const ratio = n / 100 + 1   // (n − 1) × 100 = balance → ratio = n/100 + 1
    const sign  = n > 0 ? '+' : '−'
    return `${sign}${Math.round(Math.abs(ratio))}×`
  }
  if (r > 0) return `+${r}%`
  if (r < 0) return `${r}%`  // Math.round already produced "-"
  return '0%'                 // perfect balance
}

// ── SVG geometry constants ────────────────────────────────────────────────────

const SVG_CX = 250
const SVG_CY = 250
const R_CENTER       = 42    // center hub circle
const R_SECTOR_INNER = 44    // inner edge of sector label ring
const R_SECTOR_LABEL = 88    // outer edge of sector label ring
const R_ITEM_INNER   = 90    // inner edge of items ring (all sectors)
const R_ITEM_MID     = 165   // outer edge of primary items ring (non-Design sectors)
const R_ITEM_OUTER   = 225   // outer edge of overflow ring / Design outer ring

// ── Design sector — 3-ring hierarchy (Tom 2026-06-07: Solutions → Evo Steps → Tasks) ──
// The Design sector is the only one with sub-levels; its rings use the full 90→225 band.
// Hierarchy radiates OUTWARD from the core: Solutions are the design decisions at the centre;
// Evo Steps decompose Solutions into delivery increments; Tasks decompose further into work units.
// Tom 2026-06-07: "Solutions inner, the quantity and hierarchy spreads outward."
// Ring 1 (Solutions) — innermost, core design decisions:  90 → 134
// Ring 2 (Evo Steps) — middle, delivery increments:      136 → 179
// Ring 3 (Tasks)     — outermost, finest work detail:    181 → 225
const R_SOL_INNER     = 90    // Solutions: inner edge (innermost — core design)
const R_SOL_OUTER     = 134   // Solutions: outer edge
const R_EVOSTEP_INNER = 136   // Evo Steps: inner edge
const R_EVOSTEP_OUTER = 179   // Evo Steps: outer edge
const R_TASK_INNER    = 181   // Tasks: inner edge (outermost — finest implementation detail)
const R_TASK_OUTER    = 225   // Tasks: outer edge (= R_ITEM_OUTER)

// Ring fill colours — Solutions (innermost) darkest; Tasks (outermost) lightest
// Colour intensity tracks proximity to the design core — denser decisions at centre.
const DESIGN_SOL_FILL     = '#ea580c'  // orange-600 — innermost, core design decisions
const DESIGN_EVOSTEP_FILL = '#f97316'  // orange-500 — middle, delivery increments
const DESIGN_TASK_FILL    = '#fb923c'  // orange-400 — outermost, finest work units

// Sector angular ranges (degrees, clockwise from top = -90°)
// Scope top, Values upper-right, Efficiency lower-right, Resources lower-left, Design upper-left
const SECTOR_ANGLES: Record<PentaSectorId, { start: number; end: number }> = {
  scope:        { start: -90, end:  -18 },
  values:       { start: -18, end:   54 },
  efficiency:   { start:  54, end:  126 },
  resources:    { start: 126, end:  198 },
  design:       { start: 198, end:  270 },
}

// ── Geometry helpers ──────────────────────────────────────────────────────────

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number): { x: number; y: number } {
  // SVG convention: 0° = right (3 o'clock), 90° = bottom, -90° = top (12 o'clock).
  // SECTOR_ANGLES use this same convention (-90°=top), so no offset needed.
  const rad = angleDeg * (Math.PI / 180)
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function midAngle(start: number, end: number): number {
  return (start + end) / 2
}

/**
 * Build an SVG path string for an annular sector (donut arc segment).
 * r1 = inner radius, r2 = outer radius, angles in degrees clockwise from north.
 */
function arcPath(cx: number, cy: number, r1: number, r2: number, startDeg: number, endDeg: number): string {
  // Clamp sweep to avoid degenerate arcs
  const sweep = endDeg - startDeg
  const largeArc = sweep > 180 ? 1 : 0

  const p1 = polarToCartesian(cx, cy, r2, startDeg)
  const p2 = polarToCartesian(cx, cy, r2, endDeg)
  const p3 = polarToCartesian(cx, cy, r1, endDeg)
  const p4 = polarToCartesian(cx, cy, r1, startDeg)

  return [
    `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
    `A ${r2} ${r2} 0 ${largeArc} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
    `L ${p3.x.toFixed(2)} ${p3.y.toFixed(2)}`,
    `A ${r1} ${r1} 0 ${largeArc} 0 ${p4.x.toFixed(2)} ${p4.y.toFixed(2)}`,
    'Z',
  ].join(' ')
}

// ── SVG geometry for all sectors + items ─────────────────────────────────────

interface ItemArc {
  path:       string
  item:       PentaItem
  labelX:     number
  labelY:     number
  midDeg:     number
  textAnchor: 'start' | 'middle' | 'end'
}

interface SectorGeometry {
  sectorLabelPath: string   // full sector (center to rim)
  labelBandPath:   string   // inner label band only
  labelX:          number
  labelY:          number
  itemArcs:        ItemArc[]
  // Empty-state: shown when itemArcs.length === 0
  emptyArcPath:    string   // full items ring arc for the dashed placeholder
  emptyLabelX:     number   // center of items ring at sector mid-angle
  emptyLabelY:     number
  emptyTextAnchor: 'start' | 'middle' | 'end'
}

const sectorGeometry = computed<Record<PentaSectorId, SectorGeometry>>(() => {
  const model = pentaModel.value
  const result = {} as Record<PentaSectorId, SectorGeometry>

  for (const sectorId of PENTA_SECTOR_ORDER) {
    const { start, end } = SECTOR_ANGLES[sectorId]
    const items = model?.sectors[sectorId].items ?? []

    // Full sector arc (used for broad background hit area)
    const sectorLabelPath = arcPath(SVG_CX, SVG_CY, R_SECTOR_INNER, R_ITEM_OUTER, start, end)
    // Inner label band
    const labelBandPath   = arcPath(SVG_CX, SVG_CY, R_SECTOR_INNER, R_SECTOR_LABEL, start, end)

    const bandMid = midAngle(start, end)
    const labelPt = polarToCartesian(SVG_CX, SVG_CY, (R_SECTOR_INNER + R_SECTOR_LABEL) / 2, bandMid)

    // Divide the items ring into equal slices
    const sliceCount = Math.max(items.length, 1)
    const sliceSpan  = (end - start) / sliceCount

    const itemArcs: ItemArc[] = items.map((item, idx) => {
      const sliceStart = start + idx * sliceSpan
      const sliceEnd   = sliceStart + sliceSpan
      const sliceMid   = midAngle(sliceStart, sliceEnd)
      const path       = arcPath(SVG_CX, SVG_CY, R_ITEM_INNER, R_ITEM_MID, sliceStart, sliceEnd)
      const labelR     = (R_ITEM_INNER + R_ITEM_MID) / 2
      const labelPt2   = polarToCartesian(SVG_CX, SVG_CY, labelR, sliceMid)

      // Text anchor based on corrected SVG convention (0°=right, 90°=bottom, 270°=top).
      // Right half (cos > 0): text expands rightward → 'start'.
      // Left half (cos < 0): text expands leftward → 'end'.
      // Near top (≈270°) or bottom (≈90°): center → 'middle'.
      let textAnchor: 'start' | 'middle' | 'end' = 'middle'
      const normalised = ((sliceMid % 360) + 360) % 360
      if (normalised > 270 || normalised < 90)  textAnchor = 'start'  // right half
      if (normalised > 90 && normalised < 270)  textAnchor = 'end'    // left half

      return { path, item, labelX: labelPt2.x, labelY: labelPt2.y, midDeg: sliceMid, textAnchor }
    })

    // Empty-state arc + label (used when no spec entries map to this sector)
    const emptyArcPath = arcPath(SVG_CX, SVG_CY, R_ITEM_INNER, R_ITEM_MID, start, end)
    const emptyLabelR  = (R_ITEM_INNER + R_ITEM_MID) / 2
    const emptyLabelPt = polarToCartesian(SVG_CX, SVG_CY, emptyLabelR, bandMid)
    const emptyNorm    = ((bandMid % 360) + 360) % 360
    const emptyTextAnchor: 'start' | 'middle' | 'end' =
      (emptyNorm > 270 || emptyNorm < 90) ? 'start'
      : (emptyNorm > 90 && emptyNorm < 270) ? 'end'
      : 'middle'

    result[sectorId] = {
      sectorLabelPath,
      labelBandPath,
      labelX: labelPt.x,
      labelY: labelPt.y,
      itemArcs,
      emptyArcPath,
      emptyLabelX:     emptyLabelPt.x,
      emptyLabelY:     emptyLabelPt.y,
      emptyTextAnchor,
    }
  }

  return result
})

// ── Design sector 3-ring hierarchy (Tom 2026-06-07) ──────────────────────────
// Separate from sectorGeometry because the Design sector uses 3 concentric rings
// (Solutions outer, Evo Steps middle, Tasks inner) rather than the single items ring.

interface DesignRingArc {
  path:         string
  item:         PentaItem
  /** Short mnemonic tag rendered inside the arc — first word of the label for Solutions,
   *  E{n}.{n} hierarchy notation for Evo Steps, T{n}.{n}.{n} for Tasks.
   *  Full label is on item.label — shown in hover HoverHint and detail panel. */
  displayLabel: string
  labelX:       number
  labelY:       number
  dotX:         number                                          // left-anchor dot x (always in the arc box)
  labelParts:   { before: string; center: string; after: string } // split: overflow=light, center=dark
  textAnchor:   'start' | 'middle' | 'end'
}

interface DesignHierarchyGeometry {
  solutionArcs: DesignRingArc[]
  evoStepArcs:  DesignRingArc[]
  taskArcs:     DesignRingArc[]
}

function buildDesignRing(
  items:         PentaItem[],
  rInner:        number,
  rOuter:        number,
  charPx:        number   = 4.0,  // approximate px per char at this ring's font-size
  displayLabels: string[] = [],   // short aliases (S1, E1.2, T1.2.3); falls back to item.label
): DesignRingArc[] {
  const { start, end } = SECTOR_ANGLES.design
  const count     = items.length
  if (count === 0) return []
  const sliceSpan = (end - start) / count
  const midR      = (rInner + rOuter) / 2
  // How many chars fit within the arc box at this density?
  const arcLenPx   = midR * sliceSpan * Math.PI / 180
  const inBoxChars = Math.max(4, Math.floor(arcLenPx / charPx))

  return items.map((item, idx) => {
    const sStart       = start + idx * sliceSpan
    const sEnd         = sStart + sliceSpan
    const sMid         = (sStart + sEnd) / 2
    const path         = arcPath(SVG_CX, SVG_CY, rInner, rOuter, sStart, sEnd)
    const labelPt      = polarToCartesian(SVG_CX, SVG_CY, midR, sMid)
    const displayLabel = displayLabels[idx] ?? item.label
    // Dot: left of the label text.  Estimated left edge = center − halfWidth of alias.
    const labelLen = Math.min(displayLabel.length, 18)
    const dotX     = labelPt.x - (labelLen * charPx) / 2 - 2
    // Split alias: middle inBoxChars rendered dark, overflow before/after rendered light.
    // With short aliases (≤5 chars) overflow will almost never occur.
    const L = displayLabel.length
    const labelParts = L <= inBoxChars
      ? { before: '', center: displayLabel, after: '' }
      : (() => {
          const s = Math.floor((L - inBoxChars) / 2)
          return {
            before: displayLabel.substring(0, s),
            center: displayLabel.substring(s, s + inBoxChars),
            after:  displayLabel.substring(s + inBoxChars),
          }
        })()
    return {
      path, item, displayLabel,
      labelX: labelPt.x, labelY: labelPt.y,
      dotX, labelParts,
      textAnchor: 'middle' as const,
    }
  })
}

const designHierarchy = computed<DesignHierarchyGeometry>(() => {
  const model     = pentaModel.value
  const solutions = model?.sectors.design.items ?? []

  // ── Solution mnemonic tags — first word of label, truncated to 7 chars.
  // Tom Gilb 2026-06-09: "drop the F V S C stuff everywhere — generate Great Mnemonic Unique Tags."
  // No S1/S2 abbreviations; real design concepts deserve real names in the circle.
  const solAliases = solutions.map(s => {
    const words = s.label.split(/\s+/)
    const first = words[0] ?? s.label
    return first.length <= 7 ? first : first.substring(0, 6) + '…'
  })
  // Map solution label → 1-based index (used when resolving evo step parents)
  const solLabelToIdx = new Map<string, number>(
    solutions.map((s, i) => [s.label, i + 1]),
  )

  // ── Evo Step items + aliases: E{parentSolIdx}.{localWithinSol}
  // Primary parent = linkedSolutions[0]; if unresolvable, emit flat E{n}.
  const evoStepItems: PentaItem[] = (props.evoSteps ?? []).map((step, idx) => ({
    id:              `evo-step-${idx}`,
    label:           step.name,
    description:     step.description,
    type:            'evo-step' as const,
    linkedSolutions: step.linkedSolutions,
    effortPercent:   step.effortPercent,
    entryRef:        step.name,
  }))

  const solStepCount = new Map<number, number>()  // solIdx → # evo steps assigned so far
  let   flatEvoIdx   = 0
  const evoAliases = evoStepItems.map(item => {
    const primarySol = item.linkedSolutions?.[0]
    const solIdx     = primarySol ? (solLabelToIdx.get(primarySol) ?? 0) : 0
    if (solIdx === 0) {
      flatEvoIdx++
      return `E${flatEvoIdx}`
    }
    const local = (solStepCount.get(solIdx) ?? 0) + 1
    solStepCount.set(solIdx, local)
    return `E${solIdx}.${local}`
  })
  // Map step name → its alias (e.g. "E1.2") for task alias lookup
  const stepNameToAlias = new Map<string, string>(
    evoStepItems.map((s, i) => [s.label, evoAliases[i]]),
  )

  // ── Task items + aliases: T{solIdx}.{stepLocal}.{taskLocal}
  // Derived from T + (strip the leading "E" from the step alias) + .{n}
  const stepTaskCount = new Map<string, number>()
  const taskItems:   PentaItem[] = []
  const taskAliases: string[]    = []

  Object.entries(props.tasksByStep ?? {}).forEach(([stepName, tasks]) => {
    tasks.forEach((t, idx) => {
      const stepAlias = stepNameToAlias.get(stepName)
      const local     = (stepTaskCount.get(stepName) ?? 0) + 1
      stepTaskCount.set(stepName, local)
      // e.g. stepAlias "E1.2" → tAlias "T1.2.3"
      const tAlias = stepAlias ? `T${stepAlias.slice(1)}.${local}` : `T${local}`
      taskItems.push({
        id:          `task-${stepName}-${idx}`,
        label:       t.description.slice(0, 28),
        description: t.description,
        type:        'task' as const,
        parentStep:  stepName,
        effortHours: t.effortHours,
        assignee:    t.assignee,
        entryRef:    t.id,
      })
      taskAliases.push(tAlias)
    })
  })

  return {
    solutionArcs: buildDesignRing(solutions,    R_SOL_INNER,     R_SOL_OUTER,    4.0, solAliases),
    evoStepArcs:  buildDesignRing(evoStepItems, R_EVOSTEP_INNER, R_EVOSTEP_OUTER, 3.7, evoAliases),
    taskArcs:     buildDesignRing(taskItems,    R_TASK_INNER,    R_TASK_OUTER,    3.5, taskAliases),
  }
})

/** Lookup: item.id → mnemonic tag shown in the Design pinwheel ring
 *  (first-word mnemonic for Solutions, E{n}.{n} for Evo Steps, T{n}.{n}.{n} for Tasks).
 *  Used in the detail-panel header badge. */
const designItemAlias = computed((): Map<string, string> => {
  const map = new Map<string, string>()
  for (const arc of designHierarchy.value.solutionArcs) map.set(arc.item.id, arc.displayLabel)
  for (const arc of designHierarchy.value.evoStepArcs)  map.set(arc.item.id, arc.displayLabel)
  for (const arc of designHierarchy.value.taskArcs)     map.set(arc.item.id, arc.displayLabel)
  return map
})

// ── Value-Flow relations (IET / Value Flow Table) ────────────────────────────
// Tom Gilb 2026-06-08: "add all known strong relations as in a value flow table or IET —
//   S: Produces Value X Y, Consumes Resource R1 R2
//   Solutions: Supported by Evo Steps E1 E2
//   Evo Steps: Composed of Tasks T1 T2"

export interface FlowRelation {
  label:  string     // e.g. "Produces Values", "Supported by Evo Steps"
  color:  string     // CSS colour for the label
  refs:   string[]   // aliases or short IDs to display, e.g. ["E1.1","E1.2"]
}

/** Inverted lookup maps, built once from the full hierarchy.
 *  solutionLabel → evoStep aliases that link to it.
 *  evoStepName   → task aliases that belong to it. */
const flowInverseMaps = computed(() => {
  const solToEvoSteps = new Map<string, string[]>()
  for (const arc of designHierarchy.value.evoStepArcs) {
    for (const solLabel of arc.item.linkedSolutions ?? []) {
      if (!solToEvoSteps.has(solLabel)) solToEvoSteps.set(solLabel, [])
      solToEvoSteps.get(solLabel)!.push(arc.displayLabel)
    }
  }
  const stepToTasks = new Map<string, string[]>()
  for (const arc of designHierarchy.value.taskArcs) {
    const step = arc.item.parentStep
    if (!step) continue
    if (!stepToTasks.has(step)) stepToTasks.set(step, [])
    stepToTasks.get(step)!.push(arc.displayLabel)
  }
  return { solToEvoSteps, stepToTasks }
})

/** Parses SEntry.impact free text for V. entry references.
 *  e.g. "V.OutputCompleteness ~80%, V.Speed goal" → ["V.OutputCompleteness ~80%", "V.Speed goal"] */
function parseImpactRefs(impact: string): string[] {
  // Split on commas, keep each token that contains a V. or R. reference
  return impact.split(/[,;]+/)
    .map(s => s.trim())
    .filter(s => /[VRS]\.\w/.test(s))
}

/** Returns the flow relations for a given PentaItem. */
function flowRelationsFor(item: PentaItem): FlowRelation[] {
  const rels: FlowRelation[] = []
  if (item.type === 'solution') {
    // Values this solution produces (from SEntry.impact)
    if (item.impact) {
      const valRefs = parseImpactRefs(item.impact)
      if (valRefs.length)
        rels.push({ label: 'Produces Values', color: '#7c3aed', refs: valRefs })
    }
    // Evo Steps that implement this solution
    const evoSteps = flowInverseMaps.value.solToEvoSteps.get(item.label) ?? []
    if (evoSteps.length)
      rels.push({ label: 'Supported by Evo Steps', color: '#c2410c', refs: evoSteps })
  }
  if (item.type === 'evo-step') {
    // Solutions this Evo Step implements
    const solAliases = (item.linkedSolutions ?? []).map(label => {
      const arc = designHierarchy.value.solutionArcs.find(a => a.item.label === label)
      return arc ? arc.displayLabel : label
    })
    if (solAliases.length)
      rels.push({ label: 'Implements Solutions', color: '#ea580c', refs: solAliases })
    // Tasks in this Evo Step
    const tasks = flowInverseMaps.value.stepToTasks.get(item.label) ?? []
    if (tasks.length)
      rels.push({ label: 'Composed of Tasks', color: '#b45309', refs: tasks })
  }
  if (item.type === 'task') {
    if (item.parentStep) {
      const stepArc = designHierarchy.value.evoStepArcs.find(a => a.item.label === item.parentStep)
      const stepRef = stepArc ? stepArc.displayLabel : item.parentStep
      rels.push({ label: 'Part of Evo Step', color: '#c2410c', refs: [stepRef] })
    }
  }
  return rels
}

// ── Interaction state ─────────────────────────────────────────────────────────

const hoveredSector  = ref<PentaSectorId | null>(null)
const hoveredItem    = ref<PentaItem | null>(null)
const selectedSector = ref<PentaSectorId | null>(null)
const selectedItem   = ref<PentaItem | null>(null)
const deepInfoSector  = ref<PentaSectorId | null>(null)
/**
 * Controls which panel the right side shows when an item is selected.
 * 'detail' = full item editor; 'summary' = sector accordion (selectedItem stays set
 * so the SVG polygon remains highlighted — Tom 2026-06-10).
 */
const viewMode = ref<'summary' | 'detail'>('summary')
const hoveredSectorPos = ref<{ x: number; y: number }>({ x: 0, y: 0 })
// All sectors expanded by default — Tom 2026-06-09: "I want these things on the normal surface, not hidden"
const expandedSectors = ref<Set<PentaSectorId>>(new Set(PENTA_SECTOR_ORDER as PentaSectorId[]))
function toggleSector(id: PentaSectorId): void {
  const next = new Set(expandedSectors.value)
  if (next.has(id)) next.delete(id); else next.add(id)
  expandedSectors.value = next
}
const tooltipPos     = ref<{ x: number; y: number }>({ x: 0, y: 0 })
const svgRef         = ref<SVGSVGElement | null>(null)

// r93gg (Tom Gilb 2026-06-11 "penta jumps out in middle of hoveri"): viewport-clamped hover
// position. The hover tooltip is `fixed z-[700] max-w-xs` (~288 px wide) teleported to body.
// Naive `clientX + 14` near the right viewport edge pushed the tooltip past the viewport,
// expanded the body width, and made the Penta wheel "jump" horizontally to accommodate
// scrollbar appearance. Same effect near the bottom edge with clientY.
// Estimates: tooltip ≈ 288 wide × ~140 tall in worst case. Margin: 16 px from each edge.
const TOOLTIP_W = 304   // 288 max-w-xs + small buffer
const TOOLTIP_H = 160   // ~140 + small buffer
const TOOLTIP_MARGIN = 16
function clampTooltipPos(rawX: number, rawY: number): { x: number; y: number } {
  if (typeof window === 'undefined') return { x: rawX, y: rawY }
  const vw = window.innerWidth
  const vh = window.innerHeight
  // If cursor is in right half, flip tooltip to the LEFT of the cursor instead of right
  const x = rawX + TOOLTIP_W + TOOLTIP_MARGIN > vw
    ? Math.max(TOOLTIP_MARGIN, rawX - TOOLTIP_W - 14)
    : rawX
  // If cursor near bottom, lift tooltip above cursor
  const y = rawY + TOOLTIP_H + TOOLTIP_MARGIN > vh
    ? Math.max(TOOLTIP_MARGIN, rawY - TOOLTIP_H - 8)
    : rawY
  return { x, y }
}

function onSectorEnter(sectorId: PentaSectorId, event: MouseEvent): void {
  hoveredSector.value    = sectorId
  hoveredSectorPos.value = clampTooltipPos(event.clientX + 14, event.clientY - 8)
}
function onSectorMove(event: MouseEvent): void {
  hoveredSectorPos.value = clampTooltipPos(event.clientX + 14, event.clientY - 8)
}
function onSectorLeave(): void {
  hoveredSector.value = null
}
function onSectorClick(sectorId: PentaSectorId): void {
  // No-Silent-Data-Loss: auto-save pending detail edits before returning to the sector accordion
  if (selectedItem.value) applyItemEdits(true)
  deepInfoSector.value  = null           // exit deep-info mode on any single click
  selectedSector.value  = sectorId
  selectedItem.value    = null
  // Ensure the focused sector is expanded so entries are immediately visible (Tom 2026-06-09)
  expandedSectors.value = new Set([...expandedSectors.value, sectorId])
}
function onSectorDoubleClick(sectorId: PentaSectorId): void {
  if (selectedItem.value) applyItemEdits(true)  // No-Silent-Data-Loss
  deepInfoSector.value  = sectorId
  selectedItem.value    = null
  selectedSector.value  = null
}
function closeDeepInfo(): void {
  deepInfoSector.value = null
}

function onItemEnter(item: PentaItem, event: MouseEvent): void {
  hoveredItem.value = item
  // r93gg viewport-clamped position
  tooltipPos.value  = clampTooltipPos(event.clientX + 14, event.clientY - 8)
}
function onItemMove(event: MouseEvent): void {
  // r93gg viewport-clamped position
  tooltipPos.value = clampTooltipPos(event.clientX + 14, event.clientY - 8)
}
function onItemLeave(): void {
  hoveredItem.value = null
}
function onItemClick(item: PentaItem, sectorId: PentaSectorId): void {
  // No-Silent-Data-Loss rule: auto-save the current item's edits before switching to another.
  // selectedItem still points to the OLD item here, so applyItemEdits saves the right data.
  if (selectedItem.value && selectedItem.value.id !== item.id) {
    applyItemEdits(true)  // silent — user didn't press Apply, just navigated
  }
  // Exit deep-info mode — if the user previously double-clicked a sector label band, the right
  // panel shows the sector deep-info panel (v-if="deepInfoSector" wins over v-else-if="selectedItem").
  // Clicking any item must clear deepInfoSector so the item detail panel can render.
  // Bug: after dblclick-Values → sector deep info shown → clicking a Value item did nothing visible
  //      because deepInfoSector was still set and blocked the v-else-if branch. (2026-06-09)
  deepInfoSector.value = null
  selectedItem.value   = item
  selectedSector.value = sectorId
  viewMode.value       = 'detail'
}

// ── Detail panel edit state ───────────────────────────────────────────────────

// Local editable copies of the selected item's numeric fields
const editGoal      = ref<string>('')
const editTolerable = ref<string>('')
const editStatus    = ref<string>('')
const editBudget    = ref<string>('')
const editConsumed  = ref<string>('')

// ── Penta Full Edit — all entry types (Tom Gilb 2026-06-08) ──────────────────
// "edit any Planguage spec by clicking on the Penta Glyph, and getting a rightside
//  template, to change, delete, create, modify, add parameters to any valid Planguage expression."
const editDescription       = ref<string>('')
const editLevel             = ref<string>('')
const editScale             = ref<string>('')
const editMeter             = ref<string>('')
const editWish              = ref<string>('')
const editStatusWhen        = ref<string>('')
const editTolerableWhen     = ref<string>('')
const editGoalWhen          = ref<string>('')
const editWishWhen          = ref<string>('')
const editPresenceTest      = ref<string>('')
const editFunctionOfValue   = ref<string>('')
const editCurrentStatus     = ref<string>('')
const editImpact            = ref<string>('')
const editFunctionRef       = ref<string>('')
const editScope             = ref<string>('')
const editRationale         = ref<string>('')
const editSource            = ref<string>('')
const editResourceTolerable = ref<string>('')
const editResourceWish      = ref<string>('')
// Extension parameters — Planguage full template (Tom Gilb 2026-06-09)
// Applies to all 5 entry types; Solutions also get impactsValues + impactsCosts
const editStakeholders  = ref<string>('')
const editSpecOwner     = ref<string>('')
const editJustification = ref<string>('')
const editVersion       = ref<string>('')
const editRisksIssues   = ref<string>('')
const editImpactsValues = ref<string>('')  // Solutions: impacts on Values
const editImpactsCosts  = ref<string>('')  // Solutions: impacts on cost/Resources
// ── Ambition Level (Tom Gilb 2026-06-09) — unquantified vision statement + source ──
// The raw natural-language ambition that PRECEDES the Planguage quantification.
// Source fields: who stated it (sourcePerson), where/when (sourceRef), URL (sourceUrl).
// Applied to Value entries only (primary use per Tom's definition).
const editAmbitionStatement    = ref<string>('')
const editAmbitionSourcePerson = ref<string>('')
const editAmbitionSourceRef    = ref<string>('')
const editAmbitionSourceUrl    = ref<string>('')

// ── Qualifier Conditions (Tom Gilb 2026-06-09) — Planguage Qualifier *124 ─────
// Applied to Value and Resource entries (primary + secondary use).
// conditionsOpen: true if any condition is set OR user has clicked "Add Conditions"
const editConditionWhen   = ref<string>('')
const editConditionWhere  = ref<string>('')
const editConditionWhat   = ref<string>('')
const editConditionHow    = ref<string>('')
const editConditionWhy    = ref<string>('')
const conditionsOpen      = ref<boolean>(false)

/**
 * r93rrr — bridge between the legacy 5 separate refs (when/where/what/how/why)
 * and the canonical 3-class Qualifiers object the shared `<QualifiersBar>`
 * v-models against (Tom Gilb 2026-06-12 "3 classes, everywhere"). Mapping per
 * the r93rrr migration:
 *     legacy when  → canonical time
 *     legacy where → canonical place
 *     legacy what  → canonical event  (primary)
 *     legacy how   → canonical event  (fallback / merged)
 *     legacy why   → promote to a separate rationale field (kept below the bar
 *                    as a dedicated input so existing data is not lost)
 * The setter writes into the canonical aliases on each ref so the persist path
 * at lines ~1514 + ~1596 (Object.entries on the 5 refs) continues to work
 * unchanged for Phase-1 backward compat.
 */
const editConditionsObject = computed<{ time?: string; place?: string; event?: string; when?: string; where?: string; what?: string; how?: string; why?: string }>({
  get: () => ({
    time:  editConditionWhen.value,
    place: editConditionWhere.value,
    event: editConditionWhat.value || editConditionHow.value,
    // legacy aliases for r93rrr migration read-compat:
    when:  editConditionWhen.value,
    where: editConditionWhere.value,
    what:  editConditionWhat.value,
    how:   editConditionHow.value,
    why:   editConditionWhy.value,
  }),
  set: (v) => {
    // The shared component writes to time / place / event (canonical). We mirror
    // back into the legacy refs that the persist path reads.
    editConditionWhen.value  = v.time  ?? v.when  ?? ''
    editConditionWhere.value = v.place ?? v.where ?? ''
    editConditionWhat.value  = v.event ?? v.what  ?? ''
    // `how` is preserved separately if the legacy data carried it; otherwise blank.
    if (v.how !== undefined) editConditionHow.value = v.how
    if (v.why !== undefined) editConditionWhy.value = v.why
  },
})
// Create-new-entry mode: null = editing existing; non-null = creating new of that type
const creatingType          = ref<PentaItem['type'] | null>(null)
const editNewId             = ref<string>('')
const editId                = ref<string>('')

// ── Numeric helpers (Tom 2026-06-08: comma-formatted numbers) ─────────────────
/** Strip commas/spaces then parseFloat — accepts "42,000" or "42000" identically */
function parseNum(s: string): number {
  return parseFloat(s.replace(/,/g, '').replace(/\s/g, ''))
}
/** Format a stored number value with commas for display: "42000" → "42,000" */
function fmtNum(v: string | number | null | undefined): string {
  if (v == null || v === '') return ''
  const n = parseFloat(String(v).replace(/,/g, ''))
  if (isNaN(n)) return String(v)
  return n.toLocaleString('en-US')
}

// Sync edit state when selection changes — reads from full spec entry for all fields
function syncEdits(item: PentaItem | null): void {
  // Reset all refs
  editGoal.value = ''; editTolerable.value = ''; editStatus.value = ''
  editBudget.value = ''; editConsumed.value = ''
  editDescription.value = ''; editLevel.value = ''; editScale.value = ''; editMeter.value = ''
  editWish.value = ''
  editStatusWhen.value = ''; editTolerableWhen.value = ''; editGoalWhen.value = ''; editWishWhen.value = ''
  editPresenceTest.value = ''; editFunctionOfValue.value = ''; editCurrentStatus.value = ''
  editImpact.value = ''; editFunctionRef.value = ''
  editScope.value = ''; editRationale.value = ''; editSource.value = ''
  editResourceTolerable.value = ''; editResourceWish.value = ''
  // Extension parameters
  editStakeholders.value = ''; editSpecOwner.value = ''; editJustification.value = ''
  editVersion.value = ''; editRisksIssues.value = ''
  editImpactsValues.value = ''; editImpactsCosts.value = ''
  // Ambition Level
  editAmbitionStatement.value    = ''
  editAmbitionSourcePerson.value = ''
  editAmbitionSourceRef.value    = ''
  editAmbitionSourceUrl.value    = ''
  // Qualifier Conditions
  editConditionWhen.value = ''; editConditionWhere.value = ''; editConditionWhat.value = ''
  editConditionHow.value  = ''; editConditionWhy.value   = ''
  conditionsOpen.value    = false
  editId.value = ''
  if (!item) return

  editDescription.value = item.description ?? ''
  editId.value          = item.id

  if (item.type === 'value') {
    const e = props.spec?.values.find(v => v.id === item.id)
    editGoal.value          = fmtNum(e?.goal)
    editTolerable.value     = fmtNum(e?.tolerable)
    editStatus.value        = fmtNum(e?.status)
    editScale.value         = e?.scale     ?? ''
    editMeter.value         = e?.meter     ?? ''
    editWish.value          = fmtNum(e?.wish)
    editLevel.value         = e?.level     ?? ''
    editStatusWhen.value    = e?.statusWhen    ?? ''
    editTolerableWhen.value = e?.tolerableWhen ?? ''
    editGoalWhen.value      = e?.goalWhen      ?? ''
    editWishWhen.value      = e?.wishWhen      ?? ''
    editStakeholders.value  = e?.stakeholders  ?? ''
    editSpecOwner.value     = e?.specOwner     ?? ''
    editJustification.value = e?.justification ?? ''
    editVersion.value       = e?.version       ?? ''
    editRisksIssues.value   = e?.risks         ?? ''
    // Ambition Level — read first entry (the primary vision statement)
    const al0 = e?.ambitionLevel?.[0]
    editAmbitionStatement.value    = al0?.statement    ?? ''
    editAmbitionSourcePerson.value = al0?.sourcePerson ?? ''
    editAmbitionSourceRef.value    = al0?.sourceRef    ?? ''
    editAmbitionSourceUrl.value    = al0?.sourceUrl    ?? ''
    // Qualifier Conditions
    editConditionWhen.value  = e?.conditions?.when   ?? ''
    editConditionWhere.value = e?.conditions?.where  ?? ''
    editConditionWhat.value  = e?.conditions?.what   ?? ''
    editConditionHow.value   = e?.conditions?.how    ?? ''
    editConditionWhy.value   = e?.conditions?.why    ?? ''
    conditionsOpen.value     = !!(e?.conditions?.when || e?.conditions?.where ||
                                  e?.conditions?.what || e?.conditions?.how   ||
                                  e?.conditions?.why)
  } else if (item.type === 'resource') {
    const e = (props.spec?.resources ?? []).find(r => r.id === item.id)
    editBudget.value            = fmtNum(e?.budget ?? e?.goal)
    editConsumed.value          = fmtNum(e?.status)
    editScale.value             = e?.scale ?? ''
    editMeter.value             = e?.meter ?? ''
    editResourceTolerable.value = fmtNum(e?.tolerable)
    editResourceWish.value      = fmtNum(e?.wish)
    editLevel.value             = e?.level ?? ''
    editStakeholders.value      = e?.stakeholders  ?? ''
    editSpecOwner.value         = e?.specOwner     ?? ''
    editJustification.value     = e?.justification ?? ''
    editVersion.value           = e?.version       ?? ''
    editRisksIssues.value       = e?.risks         ?? ''
    // Qualifier Conditions (secondary use for Resources)
    editConditionWhen.value  = e?.conditions?.when   ?? ''
    editConditionWhere.value = e?.conditions?.where  ?? ''
    editConditionWhat.value  = e?.conditions?.what   ?? ''
    editConditionHow.value   = e?.conditions?.how    ?? ''
    editConditionWhy.value   = e?.conditions?.why    ?? ''
    conditionsOpen.value     = !!(e?.conditions?.when || e?.conditions?.where ||
                                  e?.conditions?.what || e?.conditions?.how   ||
                                  e?.conditions?.why)
  } else if (item.type === 'function') {
    const e = props.spec?.functions.find(f => f.id === item.id)
    editPresenceTest.value    = e?.presenceTest    ?? ''
    editFunctionOfValue.value = e?.functionOfValue ?? ''
    editCurrentStatus.value   = e?.currentStatus   ?? ''
    editLevel.value           = e?.level           ?? ''
    editStakeholders.value    = e?.stakeholders    ?? ''
    editSpecOwner.value       = e?.specOwner       ?? ''
    editJustification.value   = e?.justification   ?? ''
    editVersion.value         = e?.version         ?? ''
    editRisksIssues.value     = e?.risks           ?? ''
  } else if (item.type === 'solution') {
    const e = props.spec?.solutions.find(s => s.id === item.id)
    // Backwards compat: impactsValues falls back to old impact field
    editImpactsValues.value = e?.impactsValues ?? e?.impact  ?? ''
    editImpactsCosts.value  = e?.impactsCosts  ?? ''
    editImpact.value        = e?.impact        ?? ''
    editFunctionRef.value   = e?.function      ?? ''
    editLevel.value         = e?.level         ?? ''
    editStakeholders.value  = e?.stakeholders  ?? ''
    editSpecOwner.value     = e?.specOwner     ?? ''
    editJustification.value = e?.justification ?? ''
    editVersion.value       = e?.version       ?? ''
    editRisksIssues.value   = e?.risks         ?? ''
  } else if (item.type === 'constraint') {
    const e = (props.spec?.constraints ?? []).find(c => c.id === item.id)
    editScope.value         = e?.scope         ?? ''
    editRationale.value     = e?.rationale     ?? ''
    editSource.value        = e?.source        ?? ''
    editLevel.value         = e?.level         ?? ''
    editStakeholders.value  = e?.stakeholders  ?? ''
    editSpecOwner.value     = e?.specOwner     ?? ''
    editJustification.value = e?.justification ?? ''
    editVersion.value       = e?.version       ?? ''
    editRisksIssues.value   = e?.risks         ?? ''
  }
}

// Watch selectedItem via a computed watcher pattern
const _watchTrigger = computed(() => selectedItem.value?.id)
let _prevId: string | undefined
import { watch } from 'vue'
watch(_watchTrigger, (id) => {
  if (id !== _prevId) {
    _prevId = id
    syncEdits(selectedItem.value)
  }
})

// ── Stakeholder derivation for selected item ──────────────────────────────────
const selectedItemStakeholderLinks = computed(() => {
  if (!selectedItem.value) return { sources: [], impacted: [] }
  return deriveStakeholderLinks(selectedItem.value, props.spec)
})

/**
 * Save the currently selected item's edit-refs back to the spec.
 * silent=true suppresses the toast — used for auto-save on navigation
 * (No-Silent-Data-Loss rule, Tom Gilb 2026-06-09: "data we specify in the specs
 * cannot disappear without explicit warning and implicit or explicit permission").
 */
function applyItemEdits(silent = false): void {
  const item = selectedItem.value
  if (!item || !props.spec) return

  if (item.type === 'value') {
    const goalNum      = parseNum(editGoal.value)
    const tolerableNum = parseNum(editTolerable.value)
    const statusNum    = parseNum(editStatus.value)
    const newId        = editId.value.trim() || item.id

    // Track field changes for Governance cascade analysis
    // Tracked: Goal, Tolerable, Status (numeric commitment levels) + Wish (aspirational ceiling)
    //          + Scale (measurement unit — most severe: invalidates ALL numeric levels)
    //          + Meter (measurement method — affects how Status data is collected)
    // Tom Gilb 2026-06-10: "when I change a wish or a resource or a deadline, it has
    //   consequences in other specs. I am hoping you are computing the consequences."
    const existingValue = props.spec.values.find(v => v.id === item.id)
    if (existingValue) {
      if (!isNaN(goalNum) && String(goalNum) !== (existingValue.goal ?? '')) {
        trackChange({ itemId: item.id, itemType: 'value', itemLabel: `${item.label} — Goal`, field: 'goal', before: existingValue.goal ?? '', after: String(goalNum) })
      }
      if (!isNaN(tolerableNum) && String(tolerableNum) !== (existingValue.tolerable ?? '')) {
        trackChange({ itemId: item.id, itemType: 'value', itemLabel: `${item.label} — Tolerable`, field: 'tolerable', before: existingValue.tolerable ?? '', after: String(tolerableNum) })
      }
      if (!isNaN(statusNum) && String(statusNum) !== (existingValue.status ?? '')) {
        trackChange({ itemId: item.id, itemType: 'value', itemLabel: `${item.label} — Status`, field: 'status', before: existingValue.status ?? '', after: String(statusNum) })
      }
      // Wish — aspirational ceiling; if it moves, solutions targeting wish-level delivery must review
      if (editWish.value.trim() && editWish.value.trim() !== (existingValue.wish ?? '')) {
        trackChange({ itemId: item.id, itemType: 'value', itemLabel: `${item.label} — Wish`, field: 'wish', before: existingValue.wish ?? '', after: editWish.value.trim() })
      }
      // Scale — measurement unit; most severe cascade: changing units invalidates ALL numeric levels
      if (editScale.value.trim() && editScale.value.trim() !== (existingValue.scale ?? '')) {
        trackChange({ itemId: item.id, itemType: 'value', itemLabel: `${item.label} — Scale`, field: 'scale', before: existingValue.scale ?? '', after: editScale.value.trim() })
      }
      // Meter — measurement method; changing how we measure affects Status collection + past records
      if (editMeter.value.trim() && editMeter.value.trim() !== (existingValue.meter ?? '')) {
        trackChange({ itemId: item.id, itemType: 'value', itemLabel: `${item.label} — Meter`, field: 'meter', before: existingValue.meter ?? '', after: editMeter.value.trim() })
      }
      if (editDescription.value.trim() && editDescription.value !== existingValue.description) {
        trackChange({ itemId: item.id, itemType: 'value', itemLabel: `${item.label} — Description`, field: 'description', before: existingValue.description, after: editDescription.value.trim() })
      }
    }

    // Build modified spec — all editable V. fields (Planguage full template)
    // Spec Sources: compute which primary Planguage fields changed so we can stamp them.
    const _valueFieldSrc = buildFieldSource('human')
    const _existingValueForSrc = props.spec.values.find(v => v.id === item.id)
    const _newFieldSources: Record<string, FieldSource> = { ...(_existingValueForSrc?.fieldSources ?? {}) }
    if (editScale.value.trim() && editScale.value.trim() !== (_existingValueForSrc?.scale ?? ''))
      _newFieldSources['scale'] = _valueFieldSrc
    if (editMeter.value.trim() && editMeter.value.trim() !== (_existingValueForSrc?.meter ?? ''))
      _newFieldSources['meter'] = _valueFieldSrc
    if (!isNaN(goalNum) && String(goalNum) !== (_existingValueForSrc?.goal ?? ''))
      _newFieldSources['goal'] = _valueFieldSrc
    if (!isNaN(tolerableNum) && String(tolerableNum) !== (_existingValueForSrc?.tolerable ?? ''))
      _newFieldSources['tolerable'] = _valueFieldSrc
    if (!isNaN(statusNum) && String(statusNum) !== (_existingValueForSrc?.status ?? ''))
      _newFieldSources['status'] = _valueFieldSrc
    if (editWish.value.trim() && editWish.value.trim() !== (_existingValueForSrc?.wish ?? ''))
      _newFieldSources['wish'] = _valueFieldSrc
    if (editDescription.value.trim() && editDescription.value.trim() !== (_existingValueForSrc?.description ?? ''))
      _newFieldSources['description'] = _valueFieldSrc
    if (editAmbitionStatement.value.trim())
      _newFieldSources['ambitionLevel'] = _valueFieldSrc

    const updated: SpecBlock = {
      ...props.spec,
      values: props.spec.values.map(v => {
        if (v.id !== item.id) return v
        return {
          ...v,
          id:            newId,
          description:   editDescription.value.trim()   || v.description,
          goal:          !isNaN(goalNum)      ? String(goalNum)      : v.goal,
          tolerable:     !isNaN(tolerableNum) ? String(tolerableNum) : v.tolerable,
          status:        !isNaN(statusNum)    ? String(statusNum)    : v.status,
          scale:         editScale.value.trim()           || v.scale,
          meter:         editMeter.value.trim()           || v.meter,
          wish:          editWish.value.trim()            || v.wish,
          level:         editLevel.value.trim()           || v.level,
          statusWhen:    editStatusWhen.value.trim()      || v.statusWhen,
          tolerableWhen: editTolerableWhen.value.trim()   || v.tolerableWhen,
          goalWhen:      editGoalWhen.value.trim()        || v.goalWhen,
          wishWhen:      editWishWhen.value.trim()        || v.wishWhen,
          stakeholders:  editStakeholders.value.trim()   || v.stakeholders,
          specOwner:     editSpecOwner.value.trim()      || v.specOwner,
          justification: editJustification.value.trim()  || v.justification,
          version:       editVersion.value.trim()        || v.version,
          risks:         editRisksIssues.value.trim()    || v.risks,
          // Spec Sources — persist updated field attributions
          fieldSources:  Object.keys(_newFieldSources).length ? _newFieldSources : v.fieldSources,
          // Qualifier Conditions — save only non-empty keys; delete if all blank
          conditions: (() => {
            const c: Record<string, string> = {}
            if (editConditionWhen.value.trim())  c.when  = editConditionWhen.value.trim()
            if (editConditionWhere.value.trim()) c.where = editConditionWhere.value.trim()
            if (editConditionWhat.value.trim())  c.what  = editConditionWhat.value.trim()
            if (editConditionHow.value.trim())   c.how   = editConditionHow.value.trim()
            if (editConditionWhy.value.trim())   c.why   = editConditionWhy.value.trim()
            return Object.keys(c).length ? c : v.conditions
          })(),
          // Ambition Level — save as primary AmbitionLevelEntry when statement is present
          ambitionLevel: (() => {
            const stmt = editAmbitionStatement.value.trim()
            if (!stmt) return v.ambitionLevel  // preserve existing if cleared
            const entry: AmbitionLevelEntry = { statement: stmt }
            if (editAmbitionSourcePerson.value.trim()) entry.sourcePerson = editAmbitionSourcePerson.value.trim()
            if (editAmbitionSourceRef.value.trim())    entry.sourceRef    = editAmbitionSourceRef.value.trim()
            if (editAmbitionSourceUrl.value.trim())    entry.sourceUrl    = editAmbitionSourceUrl.value.trim()
            return [entry]
          })(),
        }
      }),
    }
    emit('update-spec', updated)
    if (newId !== item.id) selectedItem.value = null
    if (!silent) showToast('Value updated in spec.')

  } else if (item.type === 'resource') {
    const budgetNum   = parseNum(editBudget.value)
    const consumedNum = parseNum(editConsumed.value)
    const newId       = editId.value.trim() || item.id

    // Track numeric field changes for Governance cascade analysis
    const existingResource = (props.spec.resources ?? []).find(r => r.id === item.id)
    if (existingResource) {
      if (!isNaN(budgetNum) && String(budgetNum) !== (existingResource.budget ?? existingResource.goal ?? '')) {
        trackChange({ itemId: item.id, itemType: 'resource', itemLabel: `${item.label} — Budget`, field: 'budget', before: existingResource.budget ?? existingResource.goal ?? '', after: String(budgetNum) })
      }
      if (!isNaN(consumedNum) && String(consumedNum) !== (existingResource.status ?? '')) {
        trackChange({ itemId: item.id, itemType: 'resource', itemLabel: `${item.label} — Consumed`, field: 'consumed', before: existingResource.status ?? '', after: String(consumedNum) })
      }
    }

    // Spec Sources: stamp changed Resource fields
    const _resFieldSrc = buildFieldSource('human')
    const _newResFieldSources: Record<string, FieldSource> = { ...(existingResource?.fieldSources ?? {}) }
    if (editScale.value.trim() && editScale.value.trim() !== (existingResource?.scale ?? ''))
      _newResFieldSources['scale'] = _resFieldSrc
    if (editMeter.value.trim() && editMeter.value.trim() !== (existingResource?.meter ?? ''))
      _newResFieldSources['meter'] = _resFieldSrc
    if (!isNaN(budgetNum) && String(budgetNum) !== (existingResource?.budget ?? existingResource?.goal ?? ''))
      _newResFieldSources['budget'] = _resFieldSrc
    if (!isNaN(consumedNum) && String(consumedNum) !== (existingResource?.status ?? ''))
      _newResFieldSources['status'] = _resFieldSrc
    if (editResourceTolerable.value.trim() && editResourceTolerable.value.trim() !== (existingResource?.tolerable ?? ''))
      _newResFieldSources['tolerable'] = _resFieldSrc
    if (editResourceWish.value.trim() && editResourceWish.value.trim() !== (existingResource?.wish ?? ''))
      _newResFieldSources['wish'] = _resFieldSrc

    const updated: SpecBlock = {
      ...props.spec,
      resources: (props.spec.resources ?? []).map(r => {
        if (r.id !== item.id) return r
        return {
          ...r,
          id:            newId,
          description:   editDescription.value.trim()             || r.description,
          budget:        !isNaN(budgetNum)   ? String(budgetNum)   : (r.budget ?? r.goal),
          goal:          !isNaN(budgetNum)   ? String(budgetNum)   : r.goal,
          status:        !isNaN(consumedNum) ? String(consumedNum) : r.status,
          scale:         editScale.value.trim()             || r.scale,
          meter:         editMeter.value.trim()             || r.meter,
          tolerable:     editResourceTolerable.value.trim() || r.tolerable,
          wish:          editResourceWish.value.trim()      || r.wish,
          level:         editLevel.value.trim()             || r.level,
          stakeholders:  editStakeholders.value.trim()      || r.stakeholders,
          specOwner:     editSpecOwner.value.trim()         || r.specOwner,
          justification: editJustification.value.trim()     || r.justification,
          version:       editVersion.value.trim()           || r.version,
          risks:         editRisksIssues.value.trim()       || r.risks,
          // Spec Sources — persist updated field attributions
          fieldSources:  Object.keys(_newResFieldSources).length ? _newResFieldSources : r.fieldSources,
          // Qualifier Conditions (secondary use for Resources)
          conditions: (() => {
            const c: Record<string, string> = {}
            if (editConditionWhen.value.trim())  c.when  = editConditionWhen.value.trim()
            if (editConditionWhere.value.trim()) c.where = editConditionWhere.value.trim()
            if (editConditionWhat.value.trim())  c.what  = editConditionWhat.value.trim()
            if (editConditionHow.value.trim())   c.how   = editConditionHow.value.trim()
            if (editConditionWhy.value.trim())   c.why   = editConditionWhy.value.trim()
            return Object.keys(c).length ? c : r.conditions
          })(),
        }
      }),
    }
    emit('update-spec', updated)
    if (newId !== item.id) selectedItem.value = null
    if (!silent) showToast('Resource updated in spec.')

  } else if (item.type === 'function') {
    // ── Function full edit — Planguage F. template ─────────────────────────
    const newId = editId.value.trim() || item.id
    const existingFn = props.spec.functions.find(f => f.id === item.id)
    if (existingFn) {
      if (editDescription.value.trim() && editDescription.value !== existingFn.description) {
        trackChange({ itemId: item.id, itemType: 'function', itemLabel: `${item.label} — Description`, field: 'description', before: existingFn.description, after: editDescription.value.trim() })
      }
      if (editPresenceTest.value.trim() && editPresenceTest.value !== existingFn.presenceTest) {
        trackChange({ itemId: item.id, itemType: 'function', itemLabel: `${item.label} — PresenceTest`, field: 'presenceTest', before: existingFn.presenceTest ?? '', after: editPresenceTest.value.trim() })
      }
    }
    // Spec Sources: stamp changed Function fields
    const _fnFieldSrc = buildFieldSource('human')
    const _newFnFieldSources: Record<string, FieldSource> = { ...(existingFn?.fieldSources ?? {}) }
    if (editDescription.value.trim() && editDescription.value.trim() !== (existingFn?.description ?? ''))
      _newFnFieldSources['description'] = _fnFieldSrc
    if (editPresenceTest.value.trim() && editPresenceTest.value.trim() !== (existingFn?.presenceTest ?? ''))
      _newFnFieldSources['presenceTest'] = _fnFieldSrc

    const fnUpdated: SpecBlock = {
      ...props.spec,
      functions: props.spec.functions.map(f => {
        if (f.id !== item.id) return f
        return {
          ...f,
          id:              newId,
          description:     editDescription.value.trim()     || f.description,
          presenceTest:    editPresenceTest.value.trim()    || f.presenceTest,
          functionOfValue: editFunctionOfValue.value.trim() || f.functionOfValue,
          currentStatus:   (editCurrentStatus.value as 'present' | 'absent' | 'partial' | '') || f.currentStatus,
          level:           editLevel.value.trim()           || f.level,
          stakeholders:    editStakeholders.value.trim()    || f.stakeholders,
          specOwner:       editSpecOwner.value.trim()       || f.specOwner,
          justification:   editJustification.value.trim()   || f.justification,
          version:         editVersion.value.trim()         || f.version,
          risks:           editRisksIssues.value.trim()     || f.risks,
          // Spec Sources — persist updated field attributions
          fieldSources:    Object.keys(_newFnFieldSources).length ? _newFnFieldSources : f.fieldSources,
        }
      }),
    }
    emit('update-spec', fnUpdated)
    if (newId !== item.id) selectedItem.value = null
    if (!silent) showToast('Function updated in spec.')

  } else if (item.type === 'solution') {
    // ── Solution full edit — Planguage S. template ─────────────────────────
    const newId = editId.value.trim() || item.id
    const existingSol = props.spec.solutions.find(s => s.id === item.id)
    if (existingSol) {
      if (editDescription.value.trim() && editDescription.value !== existingSol.description) {
        trackChange({ itemId: item.id, itemType: 'solution', itemLabel: `${item.label} — Description`, field: 'description', before: existingSol.description, after: editDescription.value.trim() })
      }
      const combinedImpact = [editImpactsValues.value.trim(), editImpactsCosts.value.trim()].filter(Boolean).join('\n')
      if (combinedImpact && combinedImpact !== existingSol.impact) {
        trackChange({ itemId: item.id, itemType: 'solution', itemLabel: `${item.label} — Impact`, field: 'impact', before: existingSol.impact, after: combinedImpact })
      }
    }
    // Spec Sources: stamp changed Solution fields
    const _solFieldSrc = buildFieldSource('human')
    const _newSolFieldSources: Record<string, FieldSource> = { ...(existingSol?.fieldSources ?? {}) }
    if (editDescription.value.trim() && editDescription.value.trim() !== (existingSol?.description ?? ''))
      _newSolFieldSources['description'] = _solFieldSrc
    if (editImpactsValues.value.trim() && editImpactsValues.value.trim() !== (existingSol?.impactsValues ?? existingSol?.impact ?? ''))
      _newSolFieldSources['impactsValues'] = _solFieldSrc
    if (editImpactsCosts.value.trim() && editImpactsCosts.value.trim() !== (existingSol?.impactsCosts ?? ''))
      _newSolFieldSources['impactsCosts'] = _solFieldSrc

    const solUpdated: SpecBlock = {
      ...props.spec,
      solutions: props.spec.solutions.map(s => {
        if (s.id !== item.id) return s
        const valImpact  = editImpactsValues.value.trim() || s.impactsValues || s.impact
        const costImpact = editImpactsCosts.value.trim()  || s.impactsCosts  || ''
        const combined   = [valImpact, costImpact].filter(Boolean).join('\n') || s.impact
        return {
          ...s,
          id:            newId,
          description:   editDescription.value.trim()  || s.description,
          impact:        combined,
          impactsValues: valImpact,
          impactsCosts:  costImpact,
          function:      editFunctionRef.value.trim()  || s.function,
          level:         editLevel.value.trim()        || s.level,
          stakeholders:  editStakeholders.value.trim() || s.stakeholders,
          specOwner:     editSpecOwner.value.trim()    || s.specOwner,
          justification: editJustification.value.trim()|| s.justification,
          version:       editVersion.value.trim()      || s.version,
          risks:         editRisksIssues.value.trim()  || s.risks,
          // Spec Sources — persist updated field attributions
          fieldSources:  Object.keys(_newSolFieldSources).length ? _newSolFieldSources : s.fieldSources,
        }
      }),
    }
    emit('update-spec', solUpdated)
    if (newId !== item.id) selectedItem.value = null
    if (!silent) showToast('Solution updated in spec.')

  } else if (item.type === 'constraint') {
    // ── Constraint full edit — Planguage C. template ───────────────────────
    const newId = editId.value.trim() || item.id
    const existingCon = (props.spec.constraints ?? []).find(c => c.id === item.id)
    if (existingCon) {
      if (editDescription.value.trim() && editDescription.value !== existingCon.description) {
        trackChange({ itemId: item.id, itemType: 'constraint', itemLabel: `${item.label} — Description`, field: 'description', before: existingCon.description, after: editDescription.value.trim() })
      }
    }
    // Spec Sources: stamp changed Constraint fields
    const _conFieldSrc = buildFieldSource('human')
    const _newConFieldSources: Record<string, FieldSource> = { ...(existingCon?.fieldSources ?? {}) }
    if (editDescription.value.trim() && editDescription.value.trim() !== (existingCon?.description ?? ''))
      _newConFieldSources['description'] = _conFieldSrc
    if (editScope.value.trim() && editScope.value.trim() !== (existingCon?.scope ?? ''))
      _newConFieldSources['scope'] = _conFieldSrc
    if (editRationale.value.trim() && editRationale.value.trim() !== (existingCon?.rationale ?? ''))
      _newConFieldSources['rationale'] = _conFieldSrc
    if (editSource.value.trim() && editSource.value.trim() !== (existingCon?.source ?? ''))
      _newConFieldSources['sourceField'] = _conFieldSrc

    const conUpdated: SpecBlock = {
      ...props.spec,
      constraints: (props.spec.constraints ?? []).map(c => {
        if (c.id !== item.id) return c
        return {
          ...c,
          id:            newId,
          description:   editDescription.value.trim()   || c.description,
          scope:         editScope.value.trim()         || c.scope,
          rationale:     editRationale.value.trim()     || c.rationale,
          source:        editSource.value.trim()        || c.source,
          level:         editLevel.value.trim()         || c.level,
          stakeholders:  editStakeholders.value.trim()  || c.stakeholders,
          specOwner:     editSpecOwner.value.trim()     || c.specOwner,
          justification: editJustification.value.trim() || c.justification,
          version:       editVersion.value.trim()       || c.version,
          risks:         editRisksIssues.value.trim()   || c.risks,
          // Spec Sources — persist updated field attributions
          fieldSources:  Object.keys(_newConFieldSources).length ? _newConFieldSources : c.fieldSources,
        }
      }),
    }
    emit('update-spec', conUpdated)
    if (newId !== item.id) selectedItem.value = null
    if (!silent) showToast('Constraint updated in spec.')
  }
}

/**
 * Auto-save the current item's edits, then return to the summary accordion.
 * No-Silent-Data-Loss rule: every navigation away from a detail editor first persists
 * whatever has been typed. Silent = no toast (user didn't click "Apply Changes").
 */
function autoSaveAndDeselect(): void {
  applyItemEdits(true)    // persist edits silently
  viewMode.value = 'summary' // switch right panel to accordion WITHOUT clearing selectedItem
  // selectedItem stays set so the SVG polygon remains highlighted (Tom 2026-06-10)
}

/**
 * Discard pending edits — Tom Gilb 2026-06-10 r87: "I do not see a 'we did nothing
 * with your edit' button". Re-syncs all edit refs from the stored spec (what's
 * actually persisted), so any unsaved changes are reverted. Fires a confirmation
 * toast so the user knows the revert actually happened.
 */
function discardEdits(): void {
  if (!selectedItem.value) return
  syncEdits(selectedItem.value)  // re-read from props.spec → reset every edit ref
  showToast('Edits discarded — nothing was saved to the spec')
}

/**
 * Every close path (backdrop, CloseDot, external via registerExclusiveSurface)
 * MUST go through handleClose() or be caught by the props.open watcher below.
 *
 * No-Silent-Data-Loss Rule: if the user has a detail editor open when the panel
 * closes, save their edits first — silently, no toast.
 */
function handleClose(): void {
  if (selectedItem.value) {
    applyItemEdits(true)  // No-Silent-Data-Loss Rule: auto-save open edit before closing
  }
  // Done-Changing process: auto-snapshot if OPTIMA changes were applied since last version.
  if (_changesSinceSnapshot.value > 0 && props.spec) {
    const label = `Penta changes · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    _addSpecSnapshot(props.spec, label)
    _changesSinceSnapshot.value = 0
    _lastSaved.value = new Date()
  }
  emit('close')
}

/** Save a version snapshot mid-session (SpecActionFooter "Save Version" button) without closing. */
function handleSaveVersion(): void {
  if (!props.spec) return
  const label = `Penta changes · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  _addSpecSnapshot(props.spec, label)
  _changesSinceSnapshot.value = 0
  _lastSaved.value = new Date()
  showToast('Version snapshot saved to History.')
}

// Safety net: catches external closes (registerExclusiveSurface sets open=false
// directly, bypassing handleClose). props.open watcher fires synchronously
// before Vue tears down the teleport content, so selectedItem + edit refs
// are still live and applyItemEdits can emit update-spec safely.
watch(() => props.open, (isOpen, wasOpen) => {
  if (wasOpen && !isOpen && selectedItem.value) {
    applyItemEdits(true)  // silent auto-save on external close
  }
})

// ── Delete entry from spec ────────────────────────────────────────────────────

/** Removes the selected entry from the spec. Deletion tracked in Governance for cascade review. */
function deleteSelectedEntry(): void {
  const item = selectedItem.value
  if (!item || !props.spec) return
  const typeLabel = typeBadge(item.type).label
  trackChange({
    itemId: item.id, itemType: item.type as any,
    itemLabel: `${item.label} [DELETED]`, field: 'entry',
    before: item.description, after: '[DELETED]',
  })
  let updated: SpecBlock = props.spec
  if (item.type === 'value') {
    updated = { ...updated, values: updated.values.filter(v => v.id !== item.id) }
  } else if (item.type === 'resource') {
    updated = { ...updated, resources: (updated.resources ?? []).filter(r => r.id !== item.id) }
  } else if (item.type === 'function') {
    updated = { ...updated, functions: updated.functions.filter(f => f.id !== item.id) }
  } else if (item.type === 'solution') {
    updated = { ...updated, solutions: updated.solutions.filter(s => s.id !== item.id) }
  } else if (item.type === 'constraint') {
    updated = { ...updated, constraints: (updated.constraints ?? []).filter(c => c.id !== item.id) }
  }
  emit('update-spec', updated)
  selectedItem.value = null
  showToast(`${typeLabel} "${item.label}" deleted from spec.`)
}

// ── Create new entry ──────────────────────────────────────────────────────────

/** Prepares the creation form for a new entry of the given type. */
function startCreating(type: PentaItem['type']): void {
  // No-Silent-Data-Loss: auto-save any pending edits before leaving the detail view
  if (selectedItem.value) applyItemEdits(true)
  selectedItem.value = null
  syncEdits(null)
  creatingType.value = type
  const counts: Partial<Record<PentaItem['type'], number>> = {
    function:   props.spec?.functions.length ?? 0,
    value:      props.spec?.values.length    ?? 0,
    solution:   props.spec?.solutions.length ?? 0,
    constraint: (props.spec?.constraints ?? []).length,
    resource:   (props.spec?.resources   ?? []).length,
  }
  // Leave Tag blank — user must choose a real mnemonic (V1/F1 style is banned per
  // Planguage Mnemonic ID Standard, CLAUDE.md). PlanguageParamLabel [?] shows the rules.
  void counts  // counts still used for entry-type cardinality display elsewhere
  editNewId.value = ''
}

function cancelCreating(): void {
  creatingType.value = null
  editNewId.value = ''
  syncEdits(null)
}

/** Creates and adds a new spec entry from the current edit refs. Tracked in Governance. */
function createEntry(): void {
  if (!creatingType.value || !props.spec) return
  const id = editNewId.value.trim()
  if (!id || !editDescription.value.trim()) {
    showToast('ID and Description are required to create an entry.')
    return
  }
  let updated: SpecBlock = props.spec
  const type = creatingType.value

  if (type === 'function') {
    updated = {
      ...updated,
      functions: [...updated.functions, {
        id, type: 'Function', level: editLevel.value.trim() || '1',
        description: editDescription.value.trim(),
        presenceTest: editPresenceTest.value.trim(),
        functionOfValue: editFunctionOfValue.value.trim(),
        currentStatus: (editCurrentStatus.value as 'present' | 'absent' | 'partial' | '') || '',
      }],
    }
  } else if (type === 'value') {
    const goalN = parseNum(editGoal.value)
    const tolN  = parseNum(editTolerable.value)
    const statN = parseNum(editStatus.value)
    updated = {
      ...updated,
      values: [...updated.values, {
        id, type: 'Value', level: editLevel.value.trim() || '1',
        description: editDescription.value.trim(),
        scale: editScale.value.trim(), meter: editMeter.value.trim(),
        goal:      !isNaN(goalN) ? String(goalN) : '',
        tolerable: !isNaN(tolN)  ? String(tolN)  : '',
        status:    !isNaN(statN) ? String(statN) : '',
        wish:      editWish.value.trim(),
        valueOfFunction: '',
      }],
    }
  } else if (type === 'solution') {
    updated = {
      ...updated,
      solutions: [...updated.solutions, {
        id, type: 'Solution', level: editLevel.value.trim() || '1',
        description: editDescription.value.trim(),
        impact: editImpact.value.trim(),
        function: editFunctionRef.value.trim(),
      }],
    }
  } else if (type === 'constraint') {
    updated = {
      ...updated,
      constraints: [...(updated.constraints ?? []), {
        id, type: 'Constraint', level: editLevel.value.trim() || '1',
        description: editDescription.value.trim(),
        scope: editScope.value.trim(),
        rationale: editRationale.value.trim(),
        source: editSource.value.trim(),
      }],
    }
  } else if (type === 'resource') {
    const budgetN   = parseNum(editBudget.value)
    const consumedN = parseNum(editConsumed.value)
    updated = {
      ...updated,
      resources: [...(updated.resources ?? []), {
        id, type: 'Resource', level: editLevel.value.trim() || '1',
        description: editDescription.value.trim(),
        scale: editScale.value.trim(), meter: editMeter.value.trim(),
        budget:    !isNaN(budgetN)   ? String(budgetN)   : '',
        goal:      !isNaN(budgetN)   ? String(budgetN)   : '',
        status:    !isNaN(consumedN) ? String(consumedN) : '',
        tolerable: editResourceTolerable.value.trim(),
        wish:      editResourceWish.value.trim(),
      }],
    }
  }

  trackChange({
    itemId: id, itemType: type as any,
    itemLabel: `${id} [CREATED]`, field: 'entry',
    before: '[NEW]', after: editDescription.value.trim(),
  })
  emit('update-spec', updated)
  showToast(`New ${typeBadge(type).label} "${id}" added to spec.`)
  creatingType.value = null
  editNewId.value = ''
}

// ── Efficiency impact preview ─────────────────────────────────────────────────

/** Preview what the Efficiency score would be if the current edits were applied.
 *  Returns the cannot-compute reason when no Resources exist, matching the badge/centre-hub display. */
const previewEfficiency = computed<string>(() => {
  const model = pentaModel.value
  if (!model) return ''

  // Tom Gilb 2026-06-10: surface the cannot-compute reason here too — preview must be honest
  if (model.efficiency.cannotCompute) {
    return model.efficiency.cannotComputeReason ?? 'Efficiency cannot be computed.'
  }

  const item = selectedItem.value
  if (!item) return `Current: ${fmtBalance(model.efficiency.balancePercent)} (${model.efficiency.grade})`

  if (item.type === 'value') {
    const newGoal   = parseNum(editGoal.value)
    const newStatus = parseNum(editStatus.value)
    if (isNaN(newGoal) || isNaN(newStatus) || newGoal <= 0) return ''
    const achievementRatio = newStatus / newGoal
    const resUtil = model.efficiency.resourceUtilization
    const newRatio = achievementRatio / Math.max(resUtil, 0.01)
    const newScore = Math.min(Math.max(newRatio * 50, 0), 100)
    return `After edit: ~${Math.round(newScore)}%`
  }
  if (item.type === 'resource') {
    const newBudget   = parseNum(editBudget.value)
    const newConsumed = parseNum(editConsumed.value)
    if (isNaN(newBudget) || isNaN(newConsumed) || newBudget <= 0) return ''
    const utilizationRatio = newConsumed / newBudget
    const newRatio = model.efficiency.valueAchievement / Math.max(utilizationRatio, 0.01)
    const newScore = Math.min(Math.max(newRatio * 50, 0), 100)
    return `After edit: ~${Math.round(newScore)}%`
  }
  return ''
})

// ── Efficiency grade styling ──────────────────────────────────────────────────

function efficiencyBadgeClass(grade: string): string {
  if (grade === 'excellent') return 'bg-emerald-100 text-emerald-800 border-emerald-300'
  if (grade === 'good')      return 'bg-blue-100 text-blue-800 border-blue-300'
  if (grade === 'acceptable')return 'bg-amber-100 text-amber-800 border-amber-300'
  return                            'bg-red-100 text-red-800 border-red-300'
}

// ── PentaOptima command bar ───────────────────────────────────────────────────

const optimaOpen          = ref(false)
const optimaInput         = ref('')
const optimaPrompt        = ref('')
const optimaCopied        = ref(false)
const optimaResponse      = ref('')
const optimaValueScale    = ref(100)   // Direct scaling slider: 50–200 (percent of current Goals)
const optimaResourceScale = ref(100)   // Direct scaling slider: 50–200 (percent of current Budgets)
let _copiedTimer: ReturnType<typeof setTimeout> | null = null
let _optimaToggleLock = false           // Debounce guard: prevents accidental double-tap collapse

/** Toggle PentaOptima open/closed with a 400 ms debounce guard (prevents trackpad double-tap closing). */
function toggleOptima(): void {
  if (_optimaToggleLock) return
  _optimaToggleLock = true
  optimaOpen.value = !optimaOpen.value
  setTimeout(() => { _optimaToggleLock = false }, 400)
}

/** Apply Value Goal Scale slider to all Value entries — direct spec manipulation without Claudian. */
function applyValueScale(): void {
  if (isLocked.value) { showToast('Spec is locked — unlock to make changes.'); return }
  if (!props.spec) { showToast('No spec loaded — generate a spec first.'); return }
  const updated = applyScaleToAllValues(optimaValueScale.value / 100)
  if (updated) {
    emit('update-spec', updated)
    showToast(`All Value Goals scaled to ${optimaValueScale.value}% — spec updated.`)
    _changesSinceSnapshot.value++
  } else {
    showToast('No Value entries to scale.')
  }
}

/** Apply Resource Budget Scale slider to all Resource entries — direct spec manipulation without Claudian. */
function applyResourceScale(): void {
  if (isLocked.value) { showToast('Spec is locked — unlock to make changes.'); return }
  if (!props.spec) { showToast('No spec loaded — generate a spec first.'); return }
  const updated = applyScaleToAllResources(optimaResourceScale.value / 100)
  if (updated) {
    emit('update-spec', updated)
    showToast(`All Resource Budgets scaled to ${optimaResourceScale.value}% — spec updated.`)
    _changesSinceSnapshot.value++
  } else {
    showToast('No Resource entries to scale.')
  }
}

const PRESET_COMMANDS: Array<{ label: string; cmd: PentaOptimaCmd }> = [
  { label: 'Reduce all Resources by 50%',    cmd: { type: 'scale-all-resources', description: 'Reduce all Resource Budget levels by 50% while preserving their relative proportions. Reflect the reduced budget in all entries.' } },
  { label: 'Increase all Value Goals by 10%', cmd: { type: 'scale-all-values',   description: 'Increase all Value Goal levels by 10% — raise the ambition across all value targets.' } },
  { label: 'Identify highest leverage change',cmd: { type: 'identify-leverage',  description: 'Identify the single spec change that would most improve the Efficiency ratio. Consider relaxing constraints, adding solutions, or reallocating resources.' } },
  { label: 'Show constraint conflicts',        cmd: { type: 'identify-leverage',  description: 'Identify any Constraints that conflict with each other or with the Solutions, and suggest which Constraint scope to clarify or relax.' } },
  { label: 'Maximize Efficiency',              cmd: { type: 'custom',             description: 'Suggest a combination of changes to maximize the Efficiency score (value achievement / resource utilization). Prioritize feasible changes within current Constraint boundaries.' } },
]

function usePreset(cmd: PentaOptimaCmd): void {
  optimaInput.value  = cmd.description
  optimaPrompt.value = buildOptimaPrompt(cmd)
}

function buildPromptFromInput(): void {
  const cmdType: PentaOptimaCmdType = 'custom'
  optimaPrompt.value = buildOptimaPrompt({ type: cmdType, description: optimaInput.value })
}

async function copyPrompt(): Promise<void> {
  if (!optimaPrompt.value) return
  try {
    await navigator.clipboard.writeText(optimaPrompt.value)
    optimaCopied.value = true
    if (_copiedTimer) clearTimeout(_copiedTimer)
    _copiedTimer = setTimeout(() => { optimaCopied.value = false }, 2000)
  } catch {
    showToast('Copy failed — select and copy manually.')
  }
}

function applyClaudianResponse(): void {
  const raw = optimaResponse.value.trim()
  if (!raw || !props.spec) {
    showToast('Paste a Claudian Planguage Representation response first.')
    return
  }
  let parsed: { changes?: Array<{ entryId: string; field: string; newValue: string }> }
  try {
    // Try to extract JSON from the raw response (Claudian may wrap in prose)
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON object found')
    parsed = JSON.parse(jsonMatch[0])
  } catch {
    showToast('Could not parse Claudian response as Planguage Representation — check format.')
    return
  }

  const changes = parsed.changes ?? []
  if (!changes.length) {
    showToast('No changes found in Claudian response.')
    return
  }

  let updated: SpecBlock = props.spec
  for (const change of changes) {
    const { entryId, field, newValue } = change
    if (entryId.startsWith('V.')) {
      updated = {
        ...updated,
        values: updated.values.map(v =>
          v.id === entryId ? { ...v, [field]: newValue } : v,
        ),
      }
    } else if (entryId.startsWith('R.')) {
      updated = {
        ...updated,
        resources: (updated.resources ?? []).map(r =>
          r.id === entryId ? { ...r, [field]: newValue } : r,
        ),
      }
    } else if (entryId.startsWith('F.')) {
      updated = {
        ...updated,
        functions: updated.functions.map(f =>
          f.id === entryId ? { ...f, [field]: newValue } : f,
        ),
      }
    } else if (entryId.startsWith('S.')) {
      updated = {
        ...updated,
        solutions: updated.solutions.map(s =>
          s.id === entryId ? { ...s, [field]: newValue } : s,
        ),
      }
    } else if (entryId.startsWith('C.')) {
      updated = {
        ...updated,
        constraints: (updated.constraints ?? []).map(c =>
          c.id === entryId ? { ...c, [field]: newValue } : c,
        ),
      }
    }
  }

  emit('update-spec', updated)
  showToast(`Applied ${changes.length} change(s) from Claudian.`)
  _changesSinceSnapshot.value++
  optimaResponse.value = ''
}

// ── Entry-type badge helper ───────────────────────────────────────────────────

function typeBadge(type: PentaItem['type']): { label: string; cls: string } {
  const map: Record<PentaItem['type'], { label: string; cls: string }> = {
    function:   { label: 'Function',   cls: 'bg-green-100 text-green-800 border-green-200' },
    value:      { label: 'Value',      cls: 'bg-violet-100 text-violet-800 border-violet-200' },
    constraint: { label: 'Constraint', cls: 'bg-red-100 text-red-800 border-red-200' },
    resource:   { label: 'Resource',   cls: 'bg-purple-100 text-purple-800 border-purple-200' },
    solution:   { label: 'Solution',   cls: 'bg-orange-100 text-orange-800 border-orange-200' },
  }
  return map[type] ?? { label: type, cls: 'bg-slate-100 text-slate-700 border-slate-200' }
}

/** Bold text color for the mnemonic label heading in the detail panel (DD-017: white bg applied) */
function typeLabelColor(type: PentaItem['type']): string {
  const map: Record<string, string> = {
    function:   'text-green-800',
    value:      'text-violet-800',
    constraint: 'text-red-700',
    resource:   'text-purple-800',
    solution:   'text-orange-700',
    'evo-step': 'text-orange-600',
    task:       'text-slate-700',
  }
  return map[type] ?? 'text-slate-800'
}
</script>

<template>
  <Teleport to="body">
    <template v-if="open">
      <!-- Backdrop — click-outside to dismiss (CloseDot rule) -->
      <div
        class="fixed inset-0 bg-black/40 z-[590]"
        @click="handleClose()"
      />

      <!-- Panel -->
      <div
        class="fixed inset-0 z-[595] flex flex-col bg-white shadow-2xl overflow-hidden"
        role="dialog"
        aria-label="Penta Model — SVERD design tool"
        aria-modal="true"
        @click.stop
      >
        <!-- ── Header ──────────────────────────────────────────────────────── -->
        <header class="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-blue-700 to-indigo-700 shrink-0">
          <PentaGlyph
            class="w-9 h-9 shrink-0"
            aria-hidden="true"
          />
          <div class="flex-1 min-w-0">
            <h2 class="text-white font-bold text-lg leading-tight">Penta Model</h2>
            <p class="text-blue-200 text-xs leading-tight">
              SVERD (sword): Scope · Values · Efficiency · Resources · Designs · Gilb-Shalloway 2022
            </p>
          </div>
          <!-- Efficiency glyph (Color Artsy Icon, Tom 2026-06-10 r68) + clickable badge + ⓘ button
               — all three open EfficiencyInsightPanel
               (Tom Gilb 2026-06-10: "explain efficiency in an Info in depth, display the basis
                for the efficiency computation in more detail, include 'So What'"
                + "make and get approved a beautiful artsy glyph") -->
          <div v-if="pentaModel" class="shrink-0 flex items-center gap-1.5">
            <!-- Color Artsy Icon: Σ Values / Σ Resources (Tom's verbatim suggestion) -->
            <button
              type="button"
              class="shrink-0 rounded-lg hover:ring-2 hover:ring-indigo-400 transition-all"
              title="Efficiency glyph: Σ Values / Σ Resources — click for in-depth illumination"
              @click="efficiencyInsightOpen = true"
            >
              <EfficiencyGlyph
                :size="48"
                :balance-percent="pentaModel.efficiency.balancePercent"
                :value-achievement-percent="pentaModel.efficiency.cannotCompute ? null : pentaModel.efficiency.valueAchievement * 100"
                :resource-utilization-percent="pentaModel.efficiency.cannotCompute ? null : pentaModel.efficiency.resourceUtilization * 100"
              />
            </button>
          </div>
          <div v-if="pentaModel" class="shrink-0 flex items-stretch gap-0.5">
            <button
              type="button"
              :class="[
                'rounded-l-full px-3 py-1 text-xs font-semibold border whitespace-nowrap transition-all hover:brightness-95',
                pentaModel.efficiency.cannotCompute
                  ? 'bg-slate-100 text-slate-600 border-slate-300 italic'
                  : efficiencyBadgeClass(pentaModel.efficiency.grade),
              ]"
              :title="pentaModel.efficiency.cannotCompute
                ? pentaModel.efficiency.cannotComputeReason + ' — click for in-depth explanation and how to improve'
                : `Efficiency = Value Delivered / Resources Used = ${fmtBalance(pentaModel.efficiency.balancePercent)} (${pentaModel.efficiency.grade}) — click for in-depth illumination, computation basis, and So-What actions`"
              @click="efficiencyInsightOpen = true"
            >
              <template v-if="pentaModel.efficiency.cannotCompute">
                Efficiency — N/A
              </template>
              <template v-else>
                Efficiency {{ fmtBalance(pentaModel.efficiency.balancePercent) }}
              </template>
            </button>
            <button
              type="button"
              class="rounded-r-full px-2 py-1 text-xs font-bold border border-l-0 bg-white hover:bg-slate-100 text-slate-600 border-slate-300 transition-colors"
              title="Open Efficiency Insight — what is Efficiency, the formula, your live computation basis, and So-What actions to improve it"
              @click="efficiencyInsightOpen = true"
            >ⓘ</button>
          </div>
          <!-- Export full Penta — Copy + Email (Export-on-all-windows rule + MOVE) -->
          <button
            v-if="props.spec"
            class="shrink-0 flex flex-col items-center gap-0.5 px-2 py-1 rounded hover:bg-white/20 transition-colors text-blue-100"
            title="Copy full Penta Model as colorful HTML — paste with ⌘V in any app"
            @click="exportFullCopy"
          >
            <CopyGlyph size="compact" />
            <span class="text-[8px] font-bold tracking-wider uppercase">Copy</span>
          </button>
          <button
            v-if="props.spec"
            class="shrink-0 flex flex-col items-center gap-0.5 px-2 py-1 rounded hover:bg-white/20 transition-colors text-blue-100"
            title="Email full Penta Model — colorful HTML on clipboard, Mail opens with ⌘V cue"
            @click="exportFullEmail"
          >
            <EmailGlyph size="compact" />
            <span class="text-[8px] font-bold tracking-wider uppercase">Email</span>
          </button>
          <!-- Governance button — r89 (Tom 2026-06-10: "that governance glyph is there, hate it").
               Dropped the 📋 emoji (banned per DD-012 No-Generic-Icon-Libraries) — text-only
               now with the pending count as an amber pill. Cleaner, no stock emoji. -->
          <button
            class="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold transition-colors border border-slate-600"
            :title="pendingChanges.length > 0
              ? `Penta Governance — ${pendingChanges.length} pending change(s) not yet versioned`
              : 'Penta Governance — version control, approval workflow, cascade analysis'"
            @click="showGovernance = true"
          >
            <span>Governance</span>
            <span
              v-if="pendingChanges.length > 0"
              class="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold"
            >{{ pendingChanges.length }}</span>
          </button>
          <!-- CloseDot — on-dark, size lg, end of header (CloseDot rule) -->
          <CloseDot
            variant="on-dark"
            size="lg"
            aria-label="Close Penta Model panel"
            @click="handleClose()"
          />
        </header>

        <!-- ── r41 v301 (Tom Gilb 2026-06-23 verbatim "gmorgen. Please continue w
             backlog.") ─────────────────────────────────────────────────────────
             Embedded universal chrome — PlanningStageBar + AgentsStrip
             + Stage2SubStepStrip (when stage === 2) + guidance bar.  Mirrors r41
             v298 SpecEditorPanel pattern.  Composes with Stages-are-Cyclic SUPREME,
             No-Silent-Removal SUPREME, MOVE Principle, DD-009 Zero-Training UI,
             No-Silent-Data-Loss SUPREME (auto-save before navigate). -->
        <!-- r41 v353 (Tom Gilb 2026-06-25 post-demo: *"pentaa did not scroll,
             please fix"*): wrap each v301 chrome strip in a `shrink-0`
             container so they cannot compete with the body's `min-h-0`.
             Without these wrappers, in flex-col context the strips fight
             the body for vertical space — when viewport gets short, body
             collapses to 0 and the right-pane scroll disappears (the
             content has nowhere to overflow into, so wheel events scroll
             the outer modal instead of the intended right pane).  Same
             regression class as the v316 fix; the v316 invariant only
             checked the right-pane's classes, not the parent chain.  This
             fix shores up the chain. -->
        <div class="shrink-0">
          <PlanningStageBar
            v-if="props.planningStage != null"
            :current-stage="props.planningStage ?? 1"
            :has-spec="!!props.spec"
            :has-plan="!!props.hasPlan"
            @navigate="onPentaEmbeddedStageNav"
          />
        </div>
        <div class="shrink-0">
          <AgentsStrip
            :has-spec="!!props.spec"
            :spec-presence="computedSpecPresence as Record<string, boolean>"
            @open-maria="onPentaEmbeddedAgentOpen('maria')"
            @open-contracts="onPentaEmbeddedAgentOpen('contracts')"
            @open-models="onPentaEmbeddedAgentOpen('models')"
            @open-stakeholder-mapper="onPentaEmbeddedAgentOpen('stakeholder-mapper')"
            @open-evo-critiquer="onPentaEmbeddedAgentOpen('evo-step-critique')"
            @open-spec-importer="onPentaEmbeddedAgentOpen('plan-importer')"
            @open-decisions="onPentaEmbeddedAgentOpen('decisions')"
            @open-strategy="onPentaEmbeddedAgentOpen('strategy-agent')"
            @open-incorruptible="onPentaEmbeddedAgentOpen('incorruptible')"
            @open-incorruptible-sharpen="onPentaEmbeddedAgentOpen('incorruptible-sharpen')"
            @open-elon="onPentaEmbeddedAgentOpen('elon')"
            @open-elon-sharpen="onPentaEmbeddedAgentOpen('elon-sharpen')"
            @open-munger="onPentaEmbeddedAgentOpen('munger')"
            @open-munger-sharpen="onPentaEmbeddedAgentOpen('munger-sharpen')"
            @open-heilmeier="onPentaEmbeddedAgentOpen('heilmeier')"
            @open-auto-dbo="onPentaEmbeddedAgentOpen('autoDbo')"
            @open-mode-picker="onPentaEmbeddedAgentOpen"
          />
        </div>
        <div class="shrink-0">
          <Stage2SubStepStrip
            v-if="props.planningStage === 2"
            :current="props.stage2SubStep"
            :done="props.stage2DoneSteps"
            @go="onPentaEmbeddedStage2Go"
            @continue="onPentaEmbeddedStage2Continue"
          />
        </div>
        <!-- Guidance bar — Stage-Has-A-Purpose SUPREME + Zero-Training UI -->
        <div
          v-if="props.planningStage != null"
          class="shrink-0 flex items-start gap-2 px-4 py-2 bg-slate-900/55 border-b border-white/10 text-[12px] leading-snug text-amber-100/90"
          role="note"
          aria-label="What this surface is for"
        >
          <span class="shrink-0 mt-0.5 text-amber-300/80" aria-hidden="true">▸</span>
          <span>{{ pentaGuidanceText }}<span v-if="currentStageName" class="ml-1 opacity-70">· Stage {{ props.planningStage }}: {{ currentStageName }}</span></span>
        </div>

        <!-- ── Body: SVG pinwheel (left) + detail panel (right) ──────────── -->
        <div class="flex flex-1 min-h-0 overflow-hidden">

          <!-- LEFT: Penta SVG pinwheel ─────────────────────────────────── -->
          <!-- r41 v370 (Tom Gilb 2026-06-25 post-demo follow-up: *"it was left
               pane"* clarifying v369's right-pane-focused fix): LEFT-pane
               ScrollContainer was missing `min-h-0` in outer-class.  Per
               ScrollContainer's `resolvedInnerClass` (lines ~162-172 of
               ScrollContainer.vue): the auto-h-full injection ONLY fires when
               `outerClass.includes('min-h-0')`.  Without that, the inner div
               has no explicit height → grows freely → `overflow-y-auto` never
               triggers → SVG with `min-height: 320px` overflows the pane on
               cramped viewports but the user can't scroll to see the bottom.
               Added `min-h-0` so the auto-h-full path engages and scroll
               works. ScrollContainer rule: any overflow-y-auto area MUST use
               ScrollContainer.  On small screens the pinwheel maintains min-
               width/min-height (320px) and the scroll affordance button
               appears when the SVG no longer fits. -->
          <ScrollContainer
            outer-class="relative bg-slate-50 min-h-0"
            outer-style="flex: 0 0 58%;"
            inner-class="flex items-center justify-center p-1"
          >
            <svg
              ref="svgRef"
              viewBox="0 0 500 500"
              class="w-full h-full"
              style="min-width: 320px; min-height: 320px;"
              aria-label="Penta Model 5-sector pinwheel — 1 click a sector to display its specs on the right"
            >
              <!-- Sector backgrounds + label bands -->
              <template v-for="sectorId in PENTA_SECTOR_ORDER" :key="sectorId">
                <!-- Full sector hit area (lighter fill) -->
                <path
                  :d="sectorGeometry[sectorId].sectorLabelPath"
                  :fill="SECTOR_COLORS[sectorId].bg"
                  :stroke="SECTOR_COLORS[sectorId].stroke"
                  stroke-width="1"
                  class="cursor-pointer"
                  :title="`${SECTOR_COLORS[sectorId].label} — 1 click to display ${sectorDisplayLabel(sectorId)} specs on right`"
                  @mouseenter="onSectorEnter(sectorId, $event)"
                  @mousemove="onSectorMove($event)"
                  @mouseleave="onSectorLeave"
                  @click="onSectorClick(sectorId)"
                />
                <!-- Inner label band (darker) — click: show specs on right; dblclick: deep Planguage info -->
                <path
                  :d="sectorGeometry[sectorId].labelBandPath"
                  :fill="SECTOR_COLORS[sectorId].stroke"
                  fill-opacity="0.85"
                  stroke="white"
                  stroke-width="1.5"
                  class="cursor-pointer"
                  :title="`${SECTOR_COLORS[sectorId].label} — 1 click to display ${sectorDisplayLabel(sectorId)} specs on right · Double-click for deep Planguage info`"
                  @mouseenter="onSectorEnter(sectorId, $event)"
                  @mousemove="onSectorMove($event)"
                  @mouseleave="onSectorLeave"
                  @click="onSectorClick(sectorId)"
                  @dblclick.stop="onSectorDoubleClick(sectorId)"
                />
                <!-- Sector label text -->
                <text
                  :x="sectorGeometry[sectorId].labelX"
                  :y="sectorGeometry[sectorId].labelY"
                  text-anchor="middle"
                  dominant-baseline="middle"
                  fill="white"
                  font-size="8"
                  font-weight="700"
                  class="pointer-events-none select-none"
                >
                  {{ sectorDisplayLabel(sectorId).toUpperCase() }}
                </text>

                <!-- Empty-sector placeholder — for Design sector checks all three rings -->
                <template v-if="sectorId === 'design'
                  ? (designHierarchy.solutionArcs.length === 0 && designHierarchy.evoStepArcs.length === 0 && designHierarchy.taskArcs.length === 0)
                  : sectorGeometry[sectorId].itemArcs.length === 0">
                  <path
                    :d="sectorGeometry[sectorId].emptyArcPath"
                    :fill="SECTOR_COLORS[sectorId].bg"
                    fill-opacity="0.25"
                    :stroke="SECTOR_COLORS[sectorId].stroke"
                    stroke-width="0.8"
                    stroke-dasharray="5 4"
                    class="pointer-events-none"
                  />
                  <text
                    :x="sectorGeometry[sectorId].emptyLabelX"
                    :y="sectorGeometry[sectorId].emptyLabelY"
                    :text-anchor="sectorGeometry[sectorId].emptyTextAnchor"
                    dominant-baseline="middle"
                    :fill="SECTOR_COLORS[sectorId].stroke"
                    fill-opacity="0.6"
                    font-size="7"
                    font-style="italic"
                    class="pointer-events-none select-none"
                  >
                    No {{ sectorDisplayLabel(sectorId) }} entries
                  </text>
                </template>

                <!-- Design sector: 3-ring hierarchy — Solutions (outermost) → Evo Steps → Tasks (innermost) -->
                <!-- Tom Gilb 2026-06-07: "next level of solutions is evo steps, next level of evo steps is tasks" -->
                <template v-if="sectorId === 'design'">
                  <!-- Ring 1 (innermost, R=90–134): Solutions — core design decisions -->
                  <template v-for="arc in designHierarchy.solutionArcs" :key="arc.item.id">
                    <path
                      :d="arc.path"
                      :fill="selectedItem?.id === arc.item.id ? '#9a3412' : DESIGN_SOL_FILL"
                      :fill-opacity="selectedItem?.id === arc.item.id ? 0.95 : 0.82"
                      stroke="white"
                      stroke-width="0.6"
                      class="cursor-pointer"
                      :title="`${arc.displayLabel}: ${arc.item.label} (Solution) — click to view details`"
                      @mouseenter="onItemEnter(arc.item, $event)"
                      @mousemove="onItemMove"
                      @mouseleave="onItemLeave"
                      @click="onItemClick(arc.item, 'design')"
                    />
                    <!-- Dot: always in this arc's box even when label overflows neighbours -->
                    <text
                      :x="arc.dotX"
                      :y="arc.labelY"
                      text-anchor="middle"
                      dominant-baseline="middle"
                      :fill="selectedItem?.id === arc.item.id ? 'white' : '#431407'"
                      font-size="9"
                      font-weight="900"
                      class="pointer-events-none select-none"
                    >·</text>
                    <!-- Label: in-box middle chars = dark; overflow before/after = faded light -->
                    <text
                      :x="arc.labelX"
                      :y="arc.labelY"
                      text-anchor="middle"
                      dominant-baseline="middle"
                      font-size="7.5"
                      font-weight="700"
                      class="pointer-events-none select-none"
                    >
                      <tspan v-if="arc.labelParts.before"
                        :fill="selectedItem?.id === arc.item.id ? 'rgba(255,255,255,0.4)' : '#fed7aa'">{{ arc.labelParts.before }}</tspan>
                      <tspan :fill="selectedItem?.id === arc.item.id ? 'white' : '#431407'">{{ arc.labelParts.center }}</tspan>
                      <tspan v-if="arc.labelParts.after"
                        :fill="selectedItem?.id === arc.item.id ? 'rgba(255,255,255,0.4)' : '#fed7aa'">{{ arc.labelParts.after }}</tspan>
                    </text>
                    <!-- Cascade overlay for Solution arcs (primary cascade target type) + r92 +/− glyph.
                         r93f (Tom Gilb 2026-06-11): bigger dot, slower blink, dark ring instead of
                         white halo (which was washing the colour out), thicker minus sign. -->
                    <g v-if="cascadeTargets.has(arc.item.id)" class="pointer-events-none">
                      <circle :cx="arc.labelX" :cy="arc.labelY + 7" r="6" fill="#991b1b" stroke="#450a0a" stroke-width="1.2">
                        <animate attributeName="r" values="4;9;4" dur="1.6s" repeatCount="indefinite"/>
                        <animate attributeName="fill-opacity" values="1;0.55;1" dur="1.6s" repeatCount="indefinite"/>
                      </circle>
                      <text
                        :x="arc.labelX + 11" :y="arc.labelY + 13"
                        text-anchor="middle"
                        font-size="15"
                        font-weight="900"
                        fill="#7f1d1d"
                        stroke="white"
                        stroke-width="1.4"
                        paint-order="stroke"
                      >{{ getTargetDirection(arc.item.id, 'applied') }}</text>
                    </g>
                    <g v-else-if="whatIfTargets.has(arc.item.id)" class="pointer-events-none">
                      <!-- r93k (Tom Gilb 2026-06-11 "the dots are better but I do not see red"):
                           what-if dot now BRIGHT VIVID RED with pulsing radius. Solution-arc site. -->
                      <circle :cx="arc.labelX" :cy="arc.labelY + 7" r="7" fill="#dc2626" stroke="#450a0a" stroke-width="1.2">
                        <animate attributeName="r" values="5;10;5" dur="1.8s" repeatCount="indefinite"/>
                        <animate attributeName="fill-opacity" values="0.95;0.55;0.95" dur="1.8s" repeatCount="indefinite"/>
                      </circle>
                      <text
                        :x="arc.labelX + 12" :y="arc.labelY + 13"
                        text-anchor="middle"
                        font-size="14"
                        font-weight="900"
                        fill="#7f1d1d"
                        stroke="white"
                        stroke-width="1.3"
                        paint-order="stroke"
                      >{{ getTargetDirection(arc.item.id, 'whatif') }}</text>
                    </g>
                  </template>
                  <!-- Ring 2 (middle, R=136–179): Evo Steps — delivery increments decomposing Solutions -->
                  <template v-for="arc in designHierarchy.evoStepArcs" :key="arc.item.id">
                    <path
                      :d="arc.path"
                      :fill="selectedItem?.id === arc.item.id ? '#c2410c' : DESIGN_EVOSTEP_FILL"
                      :fill-opacity="selectedItem?.id === arc.item.id ? 0.95 : 0.82"
                      stroke="white"
                      stroke-width="0.6"
                      class="cursor-pointer"
                      :title="`${arc.displayLabel}: ${arc.item.label} (Evo Step) — click to view details`"
                      @mouseenter="onItemEnter(arc.item, $event)"
                      @mousemove="onItemMove"
                      @mouseleave="onItemLeave"
                      @click="onItemClick(arc.item, 'design')"
                    />
                    <text
                      :x="arc.dotX"
                      :y="arc.labelY"
                      text-anchor="middle"
                      dominant-baseline="middle"
                      :fill="selectedItem?.id === arc.item.id ? 'white' : '#431407'"
                      font-size="8"
                      font-weight="900"
                      class="pointer-events-none select-none"
                    >·</text>
                    <text
                      :x="arc.labelX"
                      :y="arc.labelY"
                      text-anchor="middle"
                      dominant-baseline="middle"
                      font-size="7"
                      font-weight="600"
                      class="pointer-events-none select-none"
                    >
                      <tspan v-if="arc.labelParts.before"
                        :fill="selectedItem?.id === arc.item.id ? 'rgba(255,255,255,0.4)' : '#fed7aa'">{{ arc.labelParts.before }}</tspan>
                      <tspan :fill="selectedItem?.id === arc.item.id ? 'white' : '#431407'">{{ arc.labelParts.center }}</tspan>
                      <tspan v-if="arc.labelParts.after"
                        :fill="selectedItem?.id === arc.item.id ? 'rgba(255,255,255,0.4)' : '#fed7aa'">{{ arc.labelParts.after }}</tspan>
                    </text>
                  </template>
                  <!-- Ring 3 (outermost, R=181–225): Tasks — finest work detail -->
                  <template v-for="arc in designHierarchy.taskArcs" :key="arc.item.id">
                    <path
                      :d="arc.path"
                      :fill="selectedItem?.id === arc.item.id ? '#ea580c' : DESIGN_TASK_FILL"
                      :fill-opacity="selectedItem?.id === arc.item.id ? 0.95 : 0.82"
                      stroke="white"
                      stroke-width="0.6"
                      class="cursor-pointer"
                      :title="`${arc.displayLabel}: ${arc.item.label} (Task) — click to view details`"
                      @mouseenter="onItemEnter(arc.item, $event)"
                      @mousemove="onItemMove"
                      @mouseleave="onItemLeave"
                      @click="onItemClick(arc.item, 'design')"
                    />
                    <text
                      :x="arc.dotX"
                      :y="arc.labelY"
                      text-anchor="middle"
                      dominant-baseline="middle"
                      :fill="selectedItem?.id === arc.item.id ? 'white' : '#431407'"
                      font-size="7.5"
                      font-weight="900"
                      class="pointer-events-none select-none"
                    >·</text>
                    <text
                      :x="arc.labelX"
                      :y="arc.labelY"
                      text-anchor="middle"
                      dominant-baseline="middle"
                      font-size="6.5"
                      font-weight="600"
                      class="pointer-events-none select-none"
                    >
                      <tspan v-if="arc.labelParts.before"
                        :fill="selectedItem?.id === arc.item.id ? 'rgba(255,255,255,0.4)' : '#fed7aa'">{{ arc.labelParts.before }}</tspan>
                      <tspan :fill="selectedItem?.id === arc.item.id ? 'white' : '#431407'">{{ arc.labelParts.center }}</tspan>
                      <tspan v-if="arc.labelParts.after"
                        :fill="selectedItem?.id === arc.item.id ? 'rgba(255,255,255,0.4)' : '#fed7aa'">{{ arc.labelParts.after }}</tspan>
                    </text>
                  </template>
                </template>

                <!-- All other sectors: standard single-ring item arcs -->
                <template v-else>
                  <template v-for="arc in sectorGeometry[sectorId].itemArcs" :key="arc.item.id">
                    <path
                      :d="arc.path"
                      :fill="selectedItem?.id === arc.item.id
                        ? SECTOR_COLORS[sectorId].stroke
                        : SECTOR_COLORS[sectorId].bg"
                      :fill-opacity="selectedItem?.id === arc.item.id ? 0.9 : 0.7"
                      :stroke="SECTOR_COLORS[sectorId].stroke"
                      stroke-width="0.8"
                      class="cursor-pointer"
                      :title="`${arc.item.label} (${arc.item.type}) — click to edit`"
                      @mouseenter="onItemEnter(arc.item, $event)"
                      @mousemove="onItemMove"
                      @mouseleave="onItemLeave"
                      @click="onItemClick(arc.item, sectorId)"
                    />
                    <!-- Item label text — short truncated label -->
                    <text
                      :x="arc.labelX"
                      :y="arc.labelY"
                      :text-anchor="arc.textAnchor"
                      dominant-baseline="middle"
                      :fill="selectedItem?.id === arc.item.id ? 'white' : SECTOR_COLORS[sectorId].text"
                      font-size="8"
                      font-weight="500"
                      class="pointer-events-none select-none"
                    >
                      {{ arc.item.label.length > 14 ? arc.item.label.substring(0, 13) + '…' : arc.item.label }}
                    </text>
                    <!-- ── Cascade Ripple overlay rings (Tom 2026-06-10) ──────────────────────
                         Amber sonar: this item CAUSED a pending change — cascade originates here.
                         Red blink:   this item IS a cascade target of an already-tracked change.
                         Orange flash: this item WOULD be targeted if current edits are applied. -->
                    <!-- Cascade SOURCE: amber sonar ring + r92 +/− glyph showing change direction.
                         r93f: slower sonar (1.4s → 1.8s), bigger ring (5→15 pulse), thicker glyph
                         with white outline so the +/− reads at a glance against the wheel colour. -->
                    <g v-if="cascadeSources.has(arc.item.id)" class="pointer-events-none">
                      <circle
                        :cx="arc.labelX" :cy="arc.labelY"
                        r="8" fill="none" stroke="#f59e0b" stroke-width="2.2"
                      >
                        <animate attributeName="r" values="6;15;6" dur="1.8s" repeatCount="indefinite"/>
                        <animate attributeName="stroke-opacity" values="1;0.2;1" dur="1.8s" repeatCount="indefinite"/>
                      </circle>
                      <text
                        :x="arc.labelX" :y="arc.labelY + 4"
                        text-anchor="middle"
                        font-size="14"
                        font-weight="900"
                        fill="#7c2d12"
                        stroke="white"
                        stroke-width="1.3"
                        paint-order="stroke"
                      >{{ sourceDirection.get(arc.item.id) ?? '' }}</text>
                    </g>
                    <g v-else-if="cascadeTargets.has(arc.item.id)" class="pointer-events-none">
                      <!-- r93f: bigger + slower + dark-ring + thicker minus (same as Solution-arc site). -->
                      <circle :cx="arc.labelX" :cy="arc.labelY + 8" r="6" fill="#991b1b" stroke="#450a0a" stroke-width="1.2">
                        <animate attributeName="r" values="4;9;4" dur="1.6s" repeatCount="indefinite"/>
                        <animate attributeName="fill-opacity" values="1;0.55;1" dur="1.6s" repeatCount="indefinite"/>
                      </circle>
                      <text
                        :x="arc.labelX + 11" :y="arc.labelY + 14"
                        text-anchor="middle"
                        font-size="15"
                        font-weight="900"
                        fill="#7f1d1d"
                        stroke="white"
                        stroke-width="1.4"
                        paint-order="stroke"
                      >{{ getTargetDirection(arc.item.id, 'applied') }}</text>
                    </g>
                    <g v-else-if="whatIfTargets.has(arc.item.id)" class="pointer-events-none">
                      <!-- r93k: bright-vivid-red what-if dot — Design ring site (Solution/EvoStep/Task). -->
                      <circle :cx="arc.labelX" :cy="arc.labelY + 8" r="7" fill="#dc2626" stroke="#450a0a" stroke-width="1.2">
                        <animate attributeName="r" values="5;10;5" dur="1.8s" repeatCount="indefinite"/>
                        <animate attributeName="fill-opacity" values="0.95;0.55;0.95" dur="1.8s" repeatCount="indefinite"/>
                      </circle>
                      <text
                        :x="arc.labelX + 12" :y="arc.labelY + 14"
                        text-anchor="middle"
                        font-size="14"
                        font-weight="900"
                        fill="#7f1d1d"
                        stroke="white"
                        stroke-width="1.3"
                        paint-order="stroke"
                      >{{ getTargetDirection(arc.item.id, 'whatif') }}</text>
                    </g>
                  </template>
                </template>
              </template>

              <!-- White halo ring (r89b — Tom Gilb 2026-06-11: "The glyph above right does not
                   distinguish itself from the dark background"). Wider white ring outside the
                   hub provides visual separation between the central glyph and the dark sector
                   colours (especially the violet Resources sector at top-right). -->
              <circle
                :cx="SVG_CX"
                :cy="SVG_CY"
                :r="R_CENTER + 4"
                fill="white"
                stroke="none"
                class="pointer-events-none"
              />

              <!-- "Off-the-chart" pulsing outer ring (Tom Gilb 2026-06-11: "That is NOT 500%
                   visually!"). The Yin-Yang visual saturates at ±100% — beyond that, balance %
                   can be huge (e.g. +500%) but the symbol can't show it. This ring fires when
                   |balance| > 100, pulsing emerald for extreme surplus or red for extreme deficit,
                   so the user gets a clear "BEYOND THE SYMBOL'S RANGE" signal. -->
              <circle
                v-if="pentaModel && !pentaModel.efficiency.cannotCompute && Math.abs(pentaModel.efficiency.balancePercent) > 100"
                :cx="SVG_CX"
                :cy="SVG_CY"
                :r="R_CENTER + 7"
                fill="none"
                :stroke="pentaModel.efficiency.balancePercent > 0 ? '#15803d' : '#b91c1c'"
                stroke-width="2.5"
                stroke-dasharray="4 3"
                class="pointer-events-none"
              >
                <animate
                  attributeName="stroke-opacity"
                  values="0.3;1;0.3"
                  dur="1.8s"
                  repeatCount="indefinite"
                />
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  :from="`0 ${SVG_CX} ${SVG_CY}`"
                  :to="`360 ${SVG_CX} ${SVG_CY}`"
                  dur="20s"
                  repeatCount="indefinite"
                />
              </circle>

              <!-- Center hub circle — single OR double click opens Efficiency Insight Panel
                   (Tom Gilb 2026-06-10: "double click efficiency info did not work") -->
              <circle
                :cx="SVG_CX"
                :cy="SVG_CY"
                :r="R_CENTER"
                fill="white"
                stroke="#0f172a"
                stroke-width="2.5"
                class="cursor-pointer transition-all hover:stroke-indigo-500 hover:stroke-[3.5px]"
                @click.stop="efficiencyInsightOpen = true"
                @dblclick.stop="efficiencyInsightOpen = true"
              >
                <title>Σ Values / Σ Resources — Penta Efficiency · click to open the Insight Panel for in-depth illumination, computation basis, and So-What actions to improve it</title>
              </circle>
              <!-- Embedded Yin-Yang EfficiencyGlyph (Tom Gilb 2026-06-10 r88: rejected the
                   Σ Values/Σ € fraction in favour of the international timeless Yin-Yang
                   balance symbol — "appeals to my optima feelings"). The S-curve shifts
                   dynamically based on the live `balancePercent`: violet head grows for
                   surplus, amber head grows for deficit. The glyph IS the readout. -->
              <g
                v-if="pentaModel"
                :transform="`translate(${SVG_CX - 23}, ${SVG_CY - 40})`"
                :opacity="pentaModel.efficiency.cannotCompute ? '0.35' : '1'"
                class="pointer-events-none select-none"
              >
                <!-- r93c: bumped 42 → 46 to amplify the readability gains from the label re-position. -->
                <EfficiencyGlyph
                  :size="46"
                  :balance-percent="pentaModel.efficiency.balancePercent"
                  :value-achievement-percent="pentaModel.efficiency.cannotCompute ? null : pentaModel.efficiency.valueAchievement * 100"
                  :resource-utilization-percent="pentaModel.efficiency.cannotCompute ? null : pentaModel.efficiency.resourceUtilization * 100"
                />
              </g>

              <!-- Efficiency score in center hub — tightened vertical position r79 (Tom: "text goes outside of circle").
                   Hub width at y=+14 is ~79 px; at y=+26 is ~66 px — both fit the longest grade text. -->
              <text
                v-if="pentaModel"
                :x="SVG_CX"
                :y="SVG_CY + 10"
                text-anchor="middle"
                dominant-baseline="middle"
                :fill="pentaModel.efficiency.cannotCompute ? '#64748b' : '#1e3a8a'"
                font-size="12"
                font-weight="800"
                class="select-none pointer-events-none"
              >
                <title v-if="pentaModel.efficiency.cannotCompute">{{ pentaModel.efficiency.cannotComputeReason }}</title>
                <title v-else-if="pentaModel.efficiency.isProjected">{{ pentaModel.efficiency.projectionNote }}</title>
                {{ pentaModel.efficiency.cannotCompute ? 'N/A' : (pentaModel.efficiency.isProjected ? '~' : '') + fmtBalance(pentaModel.efficiency.balancePercent) }}
              </text>
              <!-- Grade word — r93b moved down from +26 to +28 so it has clean breathing room
                   below the number (which moved up from +14 to +10 per Tom's "number up so it has space"). -->
              <text
                v-if="pentaModel && !pentaModel.efficiency.cannotCompute"
                :x="SVG_CX"
                :y="SVG_CY + 28"
                text-anchor="middle"
                dominant-baseline="middle"
                :fill="pentaModel.efficiency.grade === 'excellent' ? '#15803d'
                      : pentaModel.efficiency.grade === 'good' ? '#1d4ed8'
                      : pentaModel.efficiency.grade === 'acceptable' ? '#b45309'
                      : '#b91c1c'"
                font-size="8"
                font-weight="700"
                class="select-none pointer-events-none"
              >
                {{ pentaModel.efficiency.grade }}
              </text>
              <!-- "No Resources planned" sub-label in center hub when cannot compute -->
              <text
                v-if="pentaModel && pentaModel.efficiency.cannotCompute"
                :x="SVG_CX"
                :y="SVG_CY + 28"
                text-anchor="middle"
                dominant-baseline="middle"
                fill="#64748b"
                font-size="7"
                font-style="italic"
                class="select-none pointer-events-none"
              >
                no Resources yet
              </text>

              <!-- Bulletproof click-catcher OVERLAY (r68/r79). Transparent circle drawn LAST
                   = topmost in SVG paint order. Both @click and @dblclick open the insight panel.
                   r80 (Tom 2026-06-10: "no hover text about double or single click"): title text
                   explicitly lists BOTH interaction modes per DD-009 Interaction Disclosure rule
                   (every multi-mode element must list ALL modes in plain English in its HoverHint). -->
              <circle
                v-if="pentaModel"
                :cx="SVG_CX"
                :cy="SVG_CY"
                :r="R_CENTER"
                fill="transparent"
                pointer-events="all"
                style="cursor: pointer"
                @click.stop="efficiencyInsightOpen = true"
                @dblclick.stop="efficiencyInsightOpen = true"
              >
                <title>Σ Values / Σ Resources — Penta Efficiency · click to open the Insight Panel for definition · formula · live computation basis · So-What actions to improve</title>
              </circle>
            </svg>

            <!-- No-spec fallback -->
            <div
              v-if="!pentaModel"
              class="absolute inset-0 flex items-center justify-center"
            >
              <p class="text-slate-400 text-sm text-center px-8">
                Generate a spec first — then the Penta pinwheel will populate with your Scope, Values, Efficiency, Resources, and Designs.
              </p>
            </div>
          </ScrollContainer>

          <!-- RIGHT: Detail panel ─────────────────────────────────────────── -->
          <!-- r41 v316 (Tom Gilb 2026-06-24 "the penta not scrolling is not scrolling now"):
               r93t-approved fallback. ScrollContainer's auto-h-full wired correctly (the
               "14% shown" badge proved hasMore=true / overflow engaged) but native scroll
               input still didn't reach the target for Tom. Switched to raw flex-1 min-h-0
               overflow-y-auto — the r93t-documented approved fallback for the centered-card
               + Teleport + multiple shrink-0 siblings layout class (sem-app-ui-rules.md). -->
          <div class="flex-1 min-h-0 overflow-y-auto border-l border-slate-200 p-5 space-y-4">

            <!-- r93i diagnostic strip REMOVED 2026-06-11 — purpose served: confirmed (after
                 Safari "Empty Caches" step 2) that the r93h v-if broadening was the real fix.
                 Tom verbatim: "after 2 the whole display magnified by 2x so i could not see the
                 whole, but what happens if was back". The "2x magnified" was a Safari page-zoom
                 side-effect of Empty Caches (⌘0 resets); the what-if cascade now shows on every
                 budget change as intended. No more diagnostic needed. -->

            <!-- ── Version Status Banner (Tom 2026-06-10: "What is our Source Version
                     and Title exactly, and what new trial version is this, and what if
                     we want to apply to the master. Illumination please")
                 Source = last saved snapshot in History (the master).
                 Trial  = current in-memory state (N unsaved changes).
                 Apply  = "Save Version" promotes trial to a new source snapshot. ────── -->
            <div
              class="flex items-center gap-2 px-3 py-2 rounded-lg border text-[11px] shrink-0 mb-1"
              :class="_changesSinceSnapshot > 0
                ? 'bg-amber-50 border-amber-200'
                : 'bg-slate-50 border-slate-200'"
            >
              <div class="flex-1 min-w-0 space-y-0.5">
                <!-- Source version row -->
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="text-slate-400 whitespace-nowrap font-semibold uppercase tracking-wide text-[10px]">Source:</span>
                  <span
                    v-if="sourceVersionLabel"
                    class="font-semibold text-slate-700 truncate"
                    :title="`Master snapshot: '${sourceVersionLabel.label}' — saved ${sourceVersionLabel.time} on ${sourceVersionLabel.day} ${sourceVersionLabel.date}. Summary: ${sourceVersionLabel.summary}`"
                  >{{ sourceVersionLabel.label }} · {{ sourceVersionLabel.day }} {{ sourceVersionLabel.date }} {{ sourceVersionLabel.time }}<span v-if="!sourceVersionLabel.isToday" class="text-amber-700 font-bold ml-1" title="This snapshot is NOT from today — verify it's the master version you intend">(not today)</span></span>
                  <span v-else class="text-slate-400 italic">No previous save — first session</span>
                </div>
                <!-- Trial version row -->
                <div class="flex items-center gap-1.5">
                  <span class="text-slate-400 whitespace-nowrap font-semibold uppercase tracking-wide text-[10px]">Trial:</span>
                  <span
                    v-if="isLocked"
                    class="text-indigo-700 font-semibold"
                  >Locked — edits frozen</span>
                  <span
                    v-else-if="_changesSinceSnapshot > 0"
                    class="font-semibold text-amber-700"
                    :title="`${_changesSinceSnapshot} change${_changesSinceSnapshot !== 1 ? 's' : ''} applied since last Save Version. Click 'Save Version' to promote to master.`"
                  >{{ _changesSinceSnapshot }} unsaved change{{ _changesSinceSnapshot !== 1 ? 's' : '' }}</span>
                  <span v-else class="text-emerald-700 font-semibold">Clean — matches source</span>
                </div>
              </div>
              <!-- Quick actions: Save Version + open Governance panel -->
              <div class="flex items-center gap-1.5 shrink-0">
                <button
                  v-if="_changesSinceSnapshot > 0 && !isLocked"
                  type="button"
                  class="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold whitespace-nowrap transition-colors"
                  title="Save Version now — promotes current trial state to a new source snapshot to Past Versions (no close required)"
                  @click="handleSaveVersion"
                >Save Version</button>
                <button
                  type="button"
                  class="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-bold whitespace-nowrap transition-colors flex items-center gap-1"
                  :title="pendingChanges.length > 0
                    ? `Open Governance — ${pendingChanges.length} field change(s) pending review. See before/after values, cascade impacts, approval workflow.`
                    : 'Open Governance — version control, field-change audit trail, cascade analysis, approval workflow'"
                  @click="showGovernance = true"
                >
                  📋
                  <span
                    v-if="pendingChanges.length > 0"
                    class="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-amber-400 text-slate-900 text-[9px] font-bold"
                  >{{ pendingChanges.length }}</span>
                </button>
              </div>
            </div>

            <!-- ── Cascade Ripple Panel (Tom 2026-06-10: "Blinking Red Data" +
                     "WHAT HAPPENED / WHAT MIGHT HAPPEN IF")
                 r93h (Tom Gilb 2026-06-11 "the what if and apply disappeared totally for me even
                 after i made a new budget change"): condition broadened from `*Impacts.length > 0`
                 to `*Changes.length > 0 || *Impacts.length > 0`. Previously the panel hid when no
                 cascade impacts were detected even though changes existed — happens when the spec
                 has no Values to ripple into (resource-budget cascade requires spec.values to fire
                 the nth-order Value-delivery impacts). Now ANY pending or what-if CHANGE shows the
                 panel, with the impact table reporting 0 impacts gracefully if none were found. -->
            <div
              v-if="pendingChanges.length > 0 || whatIfChanges.length > 0 || pendingImpacts.length > 0 || whatIfImpacts.length > 0"
              class="rounded-lg border overflow-hidden mb-2 shrink-0 max-h-[32vh] flex flex-col"
              style="overflow-anchor: none;"
              :class="pendingChanges.length > 0 ? 'border-red-300 bg-red-50' : 'border-orange-200 bg-orange-50'"
            >
              <!-- Header row: blinking dot + title + counts (FLAT — no disclosure triangle).
                   Tom Gilb 2026-06-11 r93e verbatim: "the right most triangle hides the apply line".
                   The previous ▼/▲ chevron hid the Diagram/Copy/Email/Governance/Declare action row
                   behind a discovery step — exactly what Rule 10 (sem-app-ui-rules.md) bans.
                   Now: static info banner; body ALWAYS rendered when impacts exist. -->
              <div
                class="w-full flex items-center gap-2 px-3 py-2"
                :class="pendingChanges.length > 0 ? 'bg-red-100' : 'bg-orange-100'"
              >
                <!-- Animated sonar ring (CSS animate-ping works fine in HTML context). r93h:
                     red when ANY pending change exists (locked-in territory), orange otherwise. -->
                <span class="relative flex h-3 w-3 shrink-0">
                  <span
                    class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                    :class="pendingChanges.length > 0 ? 'bg-red-400' : 'bg-orange-400'"
                  />
                  <span
                    class="relative inline-flex rounded-full h-3 w-3"
                    :class="pendingChanges.length > 0 ? 'bg-red-500' : 'bg-orange-500'"
                  />
                </span>
                <span
                  class="font-bold text-[11px] uppercase tracking-wide flex-1"
                  :class="pendingChanges.length > 0 ? 'text-red-800' : 'text-orange-800'"
                >⚡ Cascade Ripple</span>
                <!-- Count chips — r93h: show changes AND impacts so Tom can tell whether the
                     change registered (changes ≥ 1) vs. whether ripple effects exist (impacts ≥ 1).
                     Previously only impacts chips rendered → a change with 0 impacts looked
                     like the panel was broken. -->
                <span v-if="pendingChanges.length > 0"
                  class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-200 text-red-800 text-[9px] font-bold whitespace-nowrap"
                  title="Locked-in CHANGES: edits already applied, awaiting versioning"
                >{{ pendingChanges.length }} change{{ pendingChanges.length === 1 ? '' : 's' }}</span>
                <span v-if="pendingImpacts.length > 0"
                  class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-200 text-red-800 text-[9px] font-bold whitespace-nowrap"
                  title="Locked-in IMPACTS: cascade consequences from the pending changes"
                >{{ pendingImpacts.length }} impact{{ pendingImpacts.length === 1 ? '' : 's' }}</span>
                <span v-if="whatIfChanges.length > 0"
                  class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-orange-200 text-orange-800 text-[9px] font-bold whitespace-nowrap"
                  title="What-if CHANGES: unsaved edits in the form, not yet applied"
                >{{ whatIfChanges.length }} what-if</span>
                <span v-if="whatIfImpacts.length > 0"
                  class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-orange-200 text-orange-800 text-[9px] font-bold whitespace-nowrap"
                  title="What-if IMPACTS: cascade consequences if you apply the current edits"
                >{{ whatIfImpacts.length }} would-impact</span>
                <!-- r93k (Tom Gilb 2026-06-11 "no appy line on right"): Apply button mirrored
                     here in the cascade header so it's always reachable regardless of scroll
                     position. The Apply action lives canonically inside the editor form's
                     sticky banner (below the fold for long forms); this top mirror means Tom
                     can apply without scrolling back to the editor. DD-014 Top-and-Bottom
                     Mirror principle. -->
                <button
                  v-if="whatIfChanges.length > 0"
                  type="button"
                  class="ml-1 inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold whitespace-nowrap transition-colors ring-1 ring-emerald-800"
                  :title="`Apply your ${whatIfChanges.length} unsaved edit(s) to the spec — locks in the change and converts what-if impacts to pending`"
                  @click="applyItemEdits()"
                >✓ Apply {{ whatIfChanges.length }}</button>
                <button
                  v-if="whatIfChanges.length > 0"
                  type="button"
                  class="inline-flex items-center px-2 py-1 rounded bg-white hover:bg-slate-50 text-slate-700 text-[10px] font-semibold whitespace-nowrap border border-slate-300 transition-colors"
                  title="Discard your unsaved edits — restores the spec values currently saved (nothing lost from disk)"
                  @click="discardEdits"
                >Discard</button>
              </div>

              <!-- Body — table + diagram controls (always rendered when impacts exist).
                   r93k: internal overflow-y-auto so the panel can scroll within its 32vh cap
                   instead of growing to push the editor form below the fold. -->
              <div class="px-3 pb-3 pt-2 space-y-2.5 overflow-y-auto flex-1 min-h-0">

                <!-- ❶ Structured consequence table (Tom 2026-06-10: "a table with changes and consequences") -->
                <CascadeImpactTable
                  :pending-changes="pendingChanges"
                  :pending-impacts="pendingImpacts"
                  :what-if-changes="whatIfChanges"
                  :what-if-impacts="whatIfImpacts"
                />

                <!-- r93h diagnostic banner: when CHANGES exist but no IMPACTS were detected,
                     explain why so Tom doesn't think the cascade engine is broken.
                     Most common cause: spec has no Values for resource-budget cascades to ripple
                     into, or no Solutions that mention the changed Resource by keyword. -->
                <div
                  v-if="(pendingChanges.length > 0 || whatIfChanges.length > 0)
                        && pendingImpacts.length === 0 && whatIfImpacts.length === 0"
                  class="rounded border border-amber-300 bg-amber-50 text-amber-900 text-[11px] px-2.5 py-1.5 leading-snug"
                  title="Diagnostic — the change registered but no cascade targets were found in the current spec"
                >
                  <span class="font-bold">ℹ Change registered, no cascade detected.</span>
                  Likely reasons: the spec has no Values for budget changes to ripple into,
                  or no Solutions mention this Resource by keyword.
                  Add a Value (or a Solution referencing the resource) and the cascade will populate.
                </div>

                <!-- ❷ Action row: Diagram + Export + Governance + Declare -->
                <div class="flex items-center gap-2 flex-wrap pt-1 border-t border-red-100 relative">
                  <!-- Open animated diagram -->
                  <button
                    type="button"
                    class="flex items-center gap-1 px-2.5 py-1 rounded bg-gradient-to-r from-violet-700 to-indigo-700 hover:from-violet-600 hover:to-indigo-600 text-white text-[10px] font-bold whitespace-nowrap transition-all shadow-sm"
                    title="Open animated Cascade Ripple Diagram — full-screen colorful flow diagram with ▶ Play animation showing how changes ripple through the spec"
                    @click="cascadeDiagramOpen = true"
                  >
                    <span>🎬</span>
                    <span>Diagram</span>
                  </button>
                  <!-- Export actions — inline buttons (Tom Gilb 2026-06-11 r93: "that upside down
                       triangle to get the apply line is not intuitive, or documented, dont do that!
                       In this case simply display the line"). The previous Export ▾ popover hid the
                       options behind a discovery step; this flattens them so both actions read at a
                       glance. Per the new "No Disclosure Triangles" rule (sem-app-ui-rules.md). -->
                  <button
                    type="button"
                    class="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold whitespace-nowrap transition-colors"
                    title="Copy the full Cascade Ripple as colourful HTML — paste with ⌘V into Mail, Notes, Keynote, anywhere"
                    @click="exportCascade('copy')"
                  >
                    <span>📋</span><span>Copy</span>
                  </button>
                  <button
                    type="button"
                    class="flex items-center gap-1 px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold whitespace-nowrap transition-colors"
                    title="Email the Cascade Ripple — opens Mail to Tom@Gilb.com with colourful HTML on clipboard, paste with ⌘V in the body"
                    @click="exportCascade('email')"
                  >
                    <span>✉</span><span>Email</span>
                  </button>
                  <button
                    type="button"
                    class="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-semibold whitespace-nowrap transition-colors"
                    title="Open Governance panel — full Past Versions, cascade impact audit trail, approval workflow"
                    @click="showGovernance = true"
                  >Governance →</button>
                  <button
                    v-if="pendingChanges.length > 0"
                    type="button"
                    class="px-2.5 py-1 rounded border border-amber-400 bg-amber-50 hover:bg-amber-100 text-amber-800 text-[10px] font-semibold whitespace-nowrap transition-colors"
                    title="Formally declare that the cascade has not been calculated yet — versions the changes and flags all impacts as 'declared not calculated' so reviewers know the analysis is pending"
                    @click="handleDeclareNotComputed"
                  >Declare Not Computed</button>
                </div>
              </div>

              <!-- Cascade Diagram Panel (Tom 2026-06-10: full-screen animated cascade wave) -->
              <CascadeDiagramPanel
                v-if="cascadeDiagramOpen"
                :pending-changes="pendingChanges"
                :pending-impacts="pendingImpacts"
                :what-if-changes="whatIfChanges"
                :what-if-impacts="whatIfImpacts"
                @close="cascadeDiagramOpen = false"
              />
            </div>

            <!-- ── Deep sector info panel (dblclick on label band) ─────────────────────── -->
            <template v-if="deepInfoSector">
              <!-- Back button -->
              <button
                type="button"
                class="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 mb-4 transition-colors"
                title="Return to the sector overview"
                @click="closeDeepInfo"
              >
                ← Back to sectors
              </button>

              <div
                class="rounded-xl border-2 p-4 space-y-4"
                :style="{ borderColor: SECTOR_COLORS[deepInfoSector].stroke, backgroundColor: SECTOR_COLORS[deepInfoSector].bg }"
              >
                <!-- Header -->
                <div class="flex items-center gap-2">
                  <h3 class="text-base font-bold" :style="{ color: SECTOR_COLORS[deepInfoSector].text }">
                    {{ SECTOR_COLORS[deepInfoSector].label }}
                  </h3>
                  <span class="text-xs px-2 py-0.5 rounded-full font-semibold text-white"
                    :style="{ backgroundColor: SECTOR_COLORS[deepInfoSector].stroke }">
                    Penta Sector
                  </span>
                </div>

                <!-- Short definition -->
                <p class="text-sm text-slate-700 leading-snug italic">
                  "{{ PENTA_SECTOR_DEEP_INFO[deepInfoSector].shortDef }}"
                </p>
              </div>

              <!-- Full definition -->
              <div class="space-y-1">
                <h4 class="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                  <span :style="{ color: SECTOR_COLORS[deepInfoSector].stroke }">📖</span> Full Glossary Definition
                </h4>
                <p class="text-sm text-slate-700 leading-relaxed">{{ PENTA_SECTOR_DEEP_INFO[deepInfoSector].fullDef }}</p>
              </div>

              <!-- Glyph design -->
              <div class="space-y-1">
                <h4 class="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                  <span :style="{ color: SECTOR_COLORS[deepInfoSector].stroke }">◈</span> Glyph Design
                </h4>
                <p class="text-sm text-slate-700 leading-relaxed">{{ PENTA_SECTOR_DEEP_INFO[deepInfoSector].glyphNote }}</p>
              </div>

              <!-- Deep Planguage importance -->
              <div class="rounded-lg border p-3 space-y-1"
                :style="{ borderColor: SECTOR_COLORS[deepInfoSector].stroke + '60', backgroundColor: SECTOR_COLORS[deepInfoSector].bg }">
                <h4 class="text-xs font-bold uppercase tracking-wide flex items-center gap-1.5"
                  :style="{ color: SECTOR_COLORS[deepInfoSector].text }">
                  ⚡ Deep Planguage Importance
                </h4>
                <p class="text-sm text-slate-700 leading-relaxed">{{ PENTA_SECTOR_DEEP_INFO[deepInfoSector].plImportance }}</p>
              </div>

              <!-- Historical fact -->
              <div class="space-y-1">
                <h4 class="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                  <span :style="{ color: SECTOR_COLORS[deepInfoSector].stroke }">🏛</span> Historical Context
                </h4>
                <p class="text-sm text-slate-600 leading-relaxed italic">{{ PENTA_SECTOR_DEEP_INFO[deepInfoSector].historicalFact }}</p>
              </div>

              <!-- Source attribution -->
              <p class="text-[10px] text-orange-500 italic mt-2">
                📖 Sources: Competitive Engineering (Gilb 2005) · Planguage Principles · Penta Model (Gilb–Shalloway 2022) · Software Metrics (Gilb 1976)
              </p>
            </template>

            <!-- Sector accordion — all 5 sectors, or focused to one when a sector is clicked in the SVG.
                 Tom Gilb 2026-06-09: "one click to explore should be specific, to explore your Specs of that Type at right" -->
            <template v-else-if="(viewMode === 'summary' || !selectedItem) && creatingType === null && pentaModel">

              <!-- Focused header: shown when a sector is active from a pinwheel click -->
              <template v-if="selectedSector">
                <div class="flex items-center gap-2 mb-3">
                  <button
                    type="button"
                    class="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors px-2 py-1 rounded border border-slate-200 hover:border-slate-400 bg-white"
                    title="Return to all sectors"
                    @click="selectedSector = null"
                  >← All sectors</button>
                  <span class="text-sm font-bold" :style="{ color: SECTOR_COLORS[selectedSector].stroke }">
                    {{ sectorDisplayLabel(selectedSector) }} specs
                  </span>
                  <span class="text-xs text-slate-400">({{ pentaModel.sectors[selectedSector].items.length }} entries)</span>
                </div>
              </template>
              <template v-else>
                <p class="text-xs text-slate-400 mb-3 italic">1 click on a sector to display its specs here on the right. Click any entry to edit.</p>
              </template>

              <div
                v-for="sectorId in (selectedSector ? [selectedSector] : PENTA_SECTOR_ORDER)"
                :key="sectorId"
                class="mb-3"
              >
                <!-- Sector header row — click toggles expand/collapse -->
                <div
                  class="rounded-lg border cursor-pointer hover:shadow-sm transition-shadow select-none"
                  :class="expandedSectors.has(sectorId) ? 'rounded-b-none border-b-0' : ''"
                  :style="{ borderColor: SECTOR_COLORS[sectorId].stroke, backgroundColor: SECTOR_COLORS[sectorId].bg }"
                  :title="`Click to ${expandedSectors.has(sectorId) ? 'collapse' : 'expand'} ${sectorDisplayLabel(sectorId)}`"
                  @click="toggleSector(sectorId)"
                >
                  <div class="flex items-center justify-between p-3">
                    <span class="font-semibold text-sm flex items-center gap-1.5" :style="{ color: SECTOR_COLORS[sectorId].text }">
                      <span class="text-[10px] opacity-60">{{ expandedSectors.has(sectorId) ? '▾' : '▸' }}</span>
                      {{ sectorDisplayLabel(sectorId) }}
                    </span>
                    <!-- Right: item count + Copy/Email sector export (Export-on-all-windows rule) -->
                    <div class="flex items-center gap-1.5" @click.stop>
                      <span
                        class="text-xs px-2 py-0.5 rounded-full font-medium"
                        :style="{ backgroundColor: SECTOR_COLORS[sectorId].stroke, color: 'white' }"
                      >
                        {{ pentaModel.sectors[sectorId].items.length }} item(s)
                      </span>
                      <button
                        v-if="pentaModel.sectors[sectorId].items.length > 0 && sectorId !== 'efficiency'"
                        class="flex flex-col items-center gap-0 px-1.5 py-0.5 rounded hover:bg-white/60 transition-colors"
                        :style="{ color: SECTOR_COLORS[sectorId].stroke }"
                        :title="`Copy all ${sectorDisplayLabel(sectorId)} entries as colorful HTML — paste with ⌘V`"
                        @click.stop="exportSectorCopy(sectorId)"
                      >
                        <CopyGlyph size="compact" />
                      </button>
                      <button
                        v-if="pentaModel.sectors[sectorId].items.length > 0 && sectorId !== 'efficiency'"
                        class="flex flex-col items-center gap-0 px-1.5 py-0.5 rounded hover:bg-white/60 transition-colors"
                        :style="{ color: SECTOR_COLORS[sectorId].stroke }"
                        :title="`Email all ${sectorDisplayLabel(sectorId)} entries — colorful HTML on clipboard, Mail opens with ⌘V cue`"
                        @click.stop="exportSectorEmail(sectorId)"
                      >
                        <EmailGlyph size="compact" />
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Expanded content — always visible by default -->
                <div
                  v-if="expandedSectors.has(sectorId)"
                  class="rounded-b-lg border border-t-0 px-3 pb-3 pt-2"
                  :style="{ borderColor: SECTOR_COLORS[sectorId].stroke, backgroundColor: SECTOR_COLORS[sectorId].bg }"
                >
                  <p class="text-xs text-slate-500 mb-2">
                    <template v-if="sectorId === 'scope'">Scope = Functions (what the system does) + Binary Constraints (what it must NOT do). Stakeholders are the SOURCES of every Scope entry, not a sector.</template>
                    <template v-else-if="sectorId === 'values'">Quantified {{ termFor('Values').toLowerCase() }} — Scale / Tolerable / Goal / Status.</template>
                    <template v-else-if="sectorId === 'efficiency'">Computed ratio: {{ termFor('Value') }} achievement / Resource utilisation. Higher = more value per unit consumed.</template>
                    <template v-else-if="sectorId === 'resources'">Limited budgets (time, money, people) that constrain the plan.</template>
                    <template v-else-if="sectorId === 'design'">{{ termFor('Solution') }} entries — concrete {{ termFor('Solutions').toLowerCase() }} that deliver {{ termFor('Values') }} within Stakeholder constraints.</template>
                  </p>

                  <!-- Item list inside the box -->
                  <div class="space-y-2">
                    <div
                      v-for="item in pentaModel.sectors[sectorId].items"
                      :key="item.id"
                      class="rounded border bg-white/70 p-2 cursor-pointer hover:shadow-sm transition-shadow"
                      :style="{ borderColor: SECTOR_COLORS[sectorId].stroke }"
                      :title="`${item.label} — click to edit all parameters: Scale, Meter, Tolerable, Goal, Status, Wish, Conditions (When/Where/What/How/Why), Stakeholders, Spec Owner, Justification, Version, Risks`"
                      @click.stop="onItemClick(item, sectorId)"
                    >
                      <div class="flex items-center gap-2">
                        <!-- r41 v234 (Tom Gilb 2026-06-20 "the Tags of the Planguage
                             specs seem missin right side?") — render Mnemonic
                             Tag, not raw V1/V2 id, per Planguage Mnemonic ID
                             Standard SUPREME. -->
                        <span
                          class="text-xs font-semibold text-slate-700"
                          :title="`Tag: ${mnemonicLabel(item.id, item.label)} · raw id: ${item.id}`"
                        >{{ mnemonicLabel(item.id, item.label) }}</span>
                        <span :class="['text-xs px-1.5 py-0.5 rounded border font-medium', typeBadge(item.type).cls]">
                          {{ typeBadge(item.type).label }}
                        </span>
                        <SourcePin
                          field-name="Field Sources"
                          :field-source="itemFirstSource(item)"
                        />
                      </div>
                      <!-- Ambition Level — vision statement before Planguage quantification (Tom 2026-06-09) -->
                      <div v-if="item.ambitionLevel?.length" class="mt-1 space-y-0.5">
                        <div v-for="(al, alIdx) in item.ambitionLevel" :key="alIdx" class="text-xs bg-indigo-50 rounded px-1.5 py-0.5">
                          <span class="font-semibold text-indigo-600">@∑ Ambition: </span>
                          <span class="text-indigo-900 italic">{{ al.statement }}</span>
                          <span v-if="al.sourcePerson || al.sourceRef" class="text-indigo-400 ml-1 not-italic">
                            ← {{ [al.sourcePerson, al.sourceRef].filter(Boolean).join(' · ') }}
                          </span>
                          <a
                            v-if="al.sourceUrl"
                            :href="al.sourceUrl"
                            target="_blank"
                            rel="noopener"
                            class="ml-1 text-indigo-400 underline hover:text-indigo-600"
                            @click.stop
                          >[↗]</a>
                        </div>
                      </div>
                      <!-- Scale (primary Planguage field for Value/Resource — shown first per Tom 2026-06-09) -->
                      <div v-if="item.scale" class="mt-1 text-xs">
                        <span class="font-semibold text-violet-600">Scale:</span>
                        <span class="text-violet-800"> {{ item.scale }}</span>
                      </div>
                      <!-- Value metrics: Status · Tolerable · Goal · Wish (Planguage commitment ladder) -->
                      <div
                        v-if="item.type === 'value' && (item.status != null || item.tolerable != null || item.goal != null || item.wish != null)"
                        class="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs"
                      >
                        <span v-if="item.status != null" class="text-slate-600"><span class="font-medium">Status:</span> {{ item.status }}</span>
                        <span v-if="item.tolerable != null" class="text-red-700"><span class="font-medium">Tolerable:</span> {{ item.tolerable }}</span>
                        <span v-if="item.goal != null" class="text-emerald-700"><span class="font-medium">Goal:</span> {{ item.goal }}</span>
                        <span v-if="item.wish != null" class="text-violet-600"><span class="font-medium">Wish:</span> {{ item.wish }}</span>
                      </div>
                      <!-- Meter (how the scale is measured) -->
                      <div v-if="item.meter" class="mt-0.5 text-[11px] text-slate-500">
                        <span class="font-semibold">Meter:</span> {{ item.meter }}
                      </div>
                      <!-- Resource metrics inline -->
                      <div v-if="item.type === 'resource' && item.budget != null" class="flex gap-3 mt-1 text-xs text-slate-500">
                        <span><span class="font-medium">Budget:</span> {{ item.budget }}</span>
                        <span v-if="item.consumed != null"><span class="font-medium">Consumed:</span> {{ item.consumed }}</span>
                      </div>
                      <!-- Description — full text shown (Tom 2026-06-09: "on the normal surface, not hidden") -->
                      <p class="text-xs mt-1 text-slate-500">{{ item.description }}</p>
                      <!-- Shared Planguage parameters (r20 2026-06-09: Spec Owner, Stakeholders, Justification, Version, Risks) -->
                      <div
                        v-if="item.specOwner || item.stakeholders || item.justification || item.version || item.risks"
                        class="mt-1 pt-1 border-t border-dashed border-slate-200 flex flex-wrap gap-x-3 gap-y-0.5"
                        style="font-size:10px;"
                      >
                        <span v-if="item.specOwner" class="text-orange-700"><span class="font-semibold">Owner:</span> {{ item.specOwner }}</span>
                        <span v-if="item.stakeholders" class="text-blue-700"><span class="font-semibold">Stakeholders:</span> {{ item.stakeholders }}</span>
                        <span v-if="item.justification" class="text-slate-500 italic"><span class="font-semibold not-italic text-slate-600">Why:</span> {{ item.justification }}</span>
                        <span v-if="item.version" class="text-slate-400"><span class="font-semibold">v</span>{{ item.version }}</span>
                        <span v-if="item.risks" class="text-amber-700"><span class="font-semibold">⚠ Risks:</span> {{ item.risks }}</span>
                      </div>
                      <!-- Value-flow relations (IET) — S→V, S→E, E→T, T→E -->
                      <div
                        v-if="flowRelationsFor(item).length"
                        class="mt-1.5 pt-1.5 border-t border-dashed space-y-0.5"
                        :style="{ borderColor: SECTOR_COLORS[sectorId].stroke + '55' }"
                        @click.stop
                      >
                        <div v-for="rel in flowRelationsFor(item)" :key="rel.label" class="flex items-baseline gap-1 text-[10px] leading-tight flex-wrap">
                          <span class="font-semibold shrink-0" :style="{ color: rel.color }">{{ rel.label }}:</span>
                          <span
                            v-for="ref in rel.refs"
                            :key="ref"
                            class="font-mono bg-white/80 border rounded px-1 py-px"
                            :style="{ color: rel.color, borderColor: rel.color + '44' }"
                          >{{ ref }}</span>
                        </div>
                      </div>
                      <!-- DETAIL button — OpenGlyph + "DETAIL" label (MOVE rule: Tom 2026-06-09) -->
                      <div class="mt-2 pt-1.5 border-t border-dashed flex justify-end"
                           :style="{ borderColor: SECTOR_COLORS[sectorId].stroke + '44' }">
                        <button
                          class="flex flex-col items-center gap-0.5 px-3 py-1 rounded hover:bg-white/70 transition-colors"
                          :style="{ color: SECTOR_COLORS[sectorId].stroke }"
                          title="Open full detail — view and edit all Planguage parameters for this entry"
                          @click.stop="onItemClick(item, sectorId)"
                        >
                          <OpenGlyph size="compact" />
                          <span class="text-[9px] font-bold tracking-widest uppercase">DETAIL</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- + New entry buttons inside expanded box (MOVE rule) -->
                  <div v-if="sectorId !== 'efficiency'" class="mt-3 flex flex-wrap gap-2">
                    <button
                      v-if="sectorId === 'values'"
                      class="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-semibold border border-violet-200 transition-colors"
                      title="Create a new Value entry in the spec"
                      @click.stop="startCreating('value')"
                    >+ New Value</button>
                    <button
                      v-if="sectorId === 'resources'"
                      class="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold border border-purple-200 transition-colors"
                      title="Create a new Resource entry in the spec"
                      @click.stop="startCreating('resource')"
                    >+ New Resource</button>
                    <template v-if="sectorId === 'scope'">
                      <button
                        class="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-50 hover:bg-green-100 text-green-700 text-xs font-semibold border border-green-200 transition-colors"
                        title="Create a new Function entry — what the system does (a Scope item)"
                        @click.stop="startCreating('function')"
                      >+ New Function</button>
                      <button
                        class="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold border border-red-200 transition-colors"
                        title="Create a new Constraint entry — what the system must NOT do (a binary Scope boundary)"
                        @click.stop="startCreating('constraint')"
                      >+ New Constraint</button>
                    </template>
                    <button
                      v-if="sectorId === 'design'"
                      class="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-semibold border border-orange-200 transition-colors"
                      title="Create a new Solution entry — a concrete implementable design decision"
                      @click.stop="startCreating('solution')"
                    >+ New Solution</button>
                  </div>
                </div>
              </div>
            </template>

            <!-- Create new entry form — Tom Gilb 2026-06-08: "create, modify, add parameters to any valid Planguage expression" -->
            <template v-else-if="creatingType !== null">
              <div class="space-y-3">
                <div class="flex items-center gap-2">
                  <span :class="['text-xs px-1.5 py-0.5 rounded border font-medium', typeBadge(creatingType).cls]">
                    New {{ typeBadge(creatingType).label }}
                  </span>
                  <button class="ml-auto text-xs text-slate-400 hover:text-slate-700" title="Cancel — discard new entry" @click="cancelCreating">✕ Cancel</button>
                </div>
                <!-- Tag / ID (mnemonic — required) -->
                <div>
                  <PlanguageParamLabel param-key="Tag" />
                  <input v-model="editNewId" type="text" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-300 focus:outline-none" placeholder="e.g. Search Latency, GDPR Compliance, User Activation Rate" title="Tag — unique mnemonic 1–3 words, Title Case with spaces. Must be unique in the spec. Hierarchical: Parent Tag.Child Tag. BANNED: V1, F1, PascalCase." />
                  <p class="text-[10px] text-slate-400 mt-0.5">1–3 mnemonic words · Title Case with spaces · unique in spec</p>
                </div>
                <div>
                  <PlanguageParamLabel param-key="Level" />
                  <input v-model="editLevel" type="text" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-slate-300 focus:outline-none" placeholder="1" title="Planguage hierarchy level: Business / Stakeholder / Product / Solution / Evo / To-Do" />
                </div>
                <div>
                  <PlanguageParamLabel param-key="Description" />
                  <textarea v-model="editDescription" rows="2" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-slate-300 focus:outline-none resize-none" placeholder="Plain-language description of this entry" title="Required — the primary description of this Planguage entry" />
                </div>
                <!-- Function fields -->
                <template v-if="creatingType === 'function'">
                  <div>
                    <PlanguageParamLabel param-key="Presence Test" />
                    <textarea v-model="editPresenceTest" rows="2" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-green-300 focus:outline-none resize-none" placeholder="e.g. Authentication endpoint exists and accepts valid credentials" title="Binary test — is this function present or absent? (DD-004)" />
                  </div>
                  <div>
                    <PlanguageParamLabel param-key="Function" />
                    <input v-model="editFunctionOfValue" type="text" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-green-300 focus:outline-none" placeholder="e.g. V.CustomerSatisfaction" title="Which Value entry does this function primarily serve?" />
                  </div>
                  <div>
                    <label class="block text-xs font-semibold text-slate-600 mb-1">Current Status</label>
                    <select v-model="editCurrentStatus" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-green-300 focus:outline-none bg-white" title="Current implementation status">
                      <option value="">— not assessed —</option>
                      <option value="absent">absent</option>
                      <option value="partial">partial</option>
                      <option value="present">present</option>
                    </select>
                  </div>
                </template>
                <!-- Value fields -->
                <template v-if="creatingType === 'value'">
                  <div class="grid grid-cols-2 gap-2">
                    <div>
                      <PlanguageParamLabel param-key="Scale" />
                      <input v-model="editScale" type="text" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-violet-300 focus:outline-none" placeholder="e.g. % user satisfaction" title="What is being measured and its unit" />
                    </div>
                    <div>
                      <PlanguageParamLabel param-key="Meter" />
                      <input v-model="editMeter" type="text" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-violet-300 focus:outline-none" placeholder="e.g. NPS survey monthly" title="How measurement is performed" />
                    </div>
                  </div>
                  <div class="grid grid-cols-3 gap-2">
                    <div>
                      <PlanguageParamLabel param-key="Tolerable" />
                      <input v-model="editTolerable" type="text" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-violet-300 focus:outline-none" placeholder="60" title="Minimum non-failure threshold" />
                    </div>
                    <div>
                      <PlanguageParamLabel param-key="Goal" />
                      <input v-model="editGoal" type="text" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-violet-300 focus:outline-none" placeholder="90" title="Committed target level" />
                    </div>
                    <div>
                      <PlanguageParamLabel param-key="Wish" />
                      <input v-model="editWish" type="text" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-violet-300 focus:outline-none" placeholder="100" title="Wish >?: stakeholder dream level — uncommitted. CORRECT planning target before Solutions are confirmed. NOT a committed requirement." />
                    </div>
                  </div>
                  <!-- Wish-first principle callout — Tom Gilb 2026-06-09 -->
                  <div class="flex items-start gap-2 rounded border border-violet-200 bg-violet-50 px-2.5 py-2 text-[11px] leading-snug text-violet-700">
                    <span class="mt-0.5 shrink-0 font-bold text-violet-500">⚠</span>
                    <span>
                      <strong>Wish >? is the planning target — not Goal.</strong>
                      Set Goal only after MultiVision IET confirms ≥100% delivery capability.
                      <em>Wish is NOT a committed requirement.</em>
                    </span>
                  </div>
                </template>
                <!-- Solution fields -->
                <template v-if="creatingType === 'solution'">
                  <div>
                    <PlanguageParamLabel param-key="Impacts Values" />
                    <textarea v-model="editImpact" rows="2" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-orange-300 focus:outline-none resize-none" placeholder="e.g. V.Throughput +20%, R.Budget -8%" title="Expected impact on Value and Resource entries" />
                  </div>
                  <div>
                    <PlanguageParamLabel param-key="Function" />
                    <input v-model="editFunctionRef" type="text" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-orange-300 focus:outline-none" placeholder="e.g. F.ProcessPayments" title="Which Function does this solution implement?" />
                  </div>
                </template>
                <!-- Constraint fields -->
                <template v-if="creatingType === 'constraint'">
                  <div>
                    <PlanguageParamLabel param-key="Scope" />
                    <input v-model="editScope" type="text" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-red-300 focus:outline-none" placeholder="e.g. All EU-resident user data processing" title="What does this constraint apply to?" />
                  </div>
                  <div>
                    <PlanguageParamLabel param-key="Rationale" />
                    <textarea v-model="editRationale" rows="2" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-red-300 focus:outline-none resize-none" placeholder="e.g. EU GDPR Article 44 — data transfer rules" title="Why does this constraint exist?" />
                  </div>
                  <div>
                    <PlanguageParamLabel param-key="Source" />
                    <input v-model="editSource" type="text" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-red-300 focus:outline-none" placeholder="e.g. GDPR Art.44; Legal Team 2026-01-15" title="Authoritative source mandating this constraint" />
                  </div>
                </template>
                <!-- Resource fields -->
                <template v-if="creatingType === 'resource'">
                  <div class="grid grid-cols-2 gap-2">
                    <div>
                      <PlanguageParamLabel param-key="Scale" />
                      <input v-model="editScale" type="text" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-purple-300 focus:outline-none" placeholder="e.g. engineer-hours" title="What is being measured" />
                    </div>
                    <div>
                      <PlanguageParamLabel param-key="Meter" />
                      <input v-model="editMeter" type="text" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-purple-300 focus:outline-none" placeholder="e.g. Jira time tracking" title="How consumption is measured" />
                    </div>
                  </div>
                  <div class="grid grid-cols-2 gap-2">
                    <div>
                      <PlanguageParamLabel param-key="Budget" />
                      <input v-model="editBudget" type="text" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-purple-300 focus:outline-none" placeholder="e.g. 500000" title="Official allocated budget limit" />
                    </div>
                    <div>
                      <PlanguageParamLabel param-key="Tolerable" />
                      <input v-model="editResourceTolerable" type="text" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-purple-300 focus:outline-none" placeholder="e.g. 550000" title="Tolerable consumption limit" />
                    </div>
                  </div>
                </template>
                <div class="flex gap-2 pt-1">
                  <button class="flex-1 py-2 rounded-lg bg-slate-700 hover:bg-slate-800 text-white text-sm font-semibold transition-colors" title="Create this entry and add it to the spec — tracked in Governance" @click="createEntry">
                    Create Entry
                  </button>
                  <button class="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold border border-slate-300 transition-colors" title="Cancel — discard new entry" @click="cancelCreating">
                    Cancel
                  </button>
                </div>
                <p class="text-[11px] text-slate-400">New entry added to spec and tracked in Governance as [CREATED].</p>
              </div>
            </template>

            <!-- Item selected — full edit panel -->
            <template v-else-if="selectedItem && viewMode === 'detail'">

              <!-- ── Sticky pending-edits banner (Tom 2026-06-10 r87) ──────────────────────
                   "I changed the budget and the consumed, and nothing happened, and I do not
                    see an activate changes button, and I do not see a 'we did nothing with
                    your edit' button"
                   The Apply Changes button at the BOTTOM of the form is below the fold for
                   long entry types (Resource, Value with all the Conditions/Source/etc fields)
                   — especially at Tom's accessibility font sizes. This banner surfaces the
                   action at the TOP of the editor where the eye actually is, with an explicit
                   Discard option so the user knows they can revert without saving. -->
              <div
                v-if="whatIfChanges.length > 0"
                class="sticky top-0 z-20 -mx-2 mb-2 px-3 py-2.5 rounded-lg bg-amber-50 border-2 border-amber-400 shadow-sm flex items-center gap-3"
              >
                <div class="flex items-center gap-2 shrink-0">
                  <span class="relative flex h-3 w-3">
                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"/>
                    <span class="relative inline-flex rounded-full h-3 w-3 bg-amber-500"/>
                  </span>
                  <span class="text-[11px] font-bold uppercase tracking-wide text-amber-900 whitespace-nowrap">
                    {{ whatIfChanges.length }} unsaved edit{{ whatIfChanges.length !== 1 ? 's' : '' }}
                  </span>
                </div>
                <span class="text-[10px] text-amber-700 italic flex-1 hidden sm:inline">
                  click Apply to update Penta · Discard to revert
                </span>
                <button
                  type="button"
                  class="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold whitespace-nowrap transition-colors ring-2 ring-emerald-300"
                  :title="`Apply your ${whatIfChanges.length} edit(s) to the spec — updates Penta wheel + Efficiency immediately`"
                  @click="applyItemEdits()"
                >
                  ✓ Apply {{ whatIfChanges.length }}
                </button>
                <button
                  type="button"
                  class="shrink-0 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold whitespace-nowrap border border-slate-300 transition-colors"
                  title="Discard your unsaved edits — restores the spec values that are currently saved (nothing is lost from disk)"
                  @click="discardEdits"
                >
                  ✕ Discard
                </button>
              </div>

              <!-- ── Mnemonic heading — the tag IS the heading, click to rename (Tom 2026-06-09: "we do not write the parameter word Tag") ── -->
              <div class="flex items-start gap-2 mb-1.5 bg-white rounded-lg border border-slate-100 px-3 py-2">
                <span
                  v-if="selectedSector"
                  class="w-2.5 h-2.5 rounded-full shrink-0 mt-1"
                  :style="{ backgroundColor: SECTOR_COLORS[selectedSector].stroke }"
                />
                <div class="flex-1 min-w-0">
                  <!-- The mnemonic tag IS the heading — directly editable inline.
                       No separate "Tag [?]" label (Tom 2026-06-09: never write the parameter word "Tag").
                       Styled as a bold heading; underline-on-focus signals editability. -->
                  <input
                    v-model="editId"
                    type="text"
                    :class="['w-full text-base font-bold leading-snug break-words bg-transparent border-0 border-b-2 border-transparent focus:border-b-2 focus:outline-none px-0 py-0', typeLabelColor(selectedItem.type)]"
                    :style="{ '--tw-ring-shadow': 'none' }"
                    title="Mnemonic tag — 1–3 words, normal English with spaces. Examples: 'Search Latency', 'GDPR Compliance', 'Booking Coverage'. Edit here to rename; applied when you press Apply Changes."
                    placeholder="e.g. Search Latency"
                    @focus="$event.target.style.borderBottomColor = SECTOR_COLORS[selectedSector ?? 'values'].stroke"
                    @blur="$event.target.style.borderBottomColor = 'transparent'"
                  />
                  <!-- Type badge + optional Design ring alias -->
                  <div class="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span :class="['text-[11px] px-1.5 py-px rounded border font-semibold shrink-0', typeBadge(selectedItem.type).cls]">
                      {{ typeBadge(selectedItem.type).label }}
                    </span>
                    <span
                      v-if="designItemAlias.get(selectedItem.id)"
                      class="text-[11px] font-mono font-bold px-1.5 py-px rounded bg-orange-100 text-orange-700 border border-orange-200"
                      :title="`Mnemonic tag shown in the Design pinwheel ring`"
                    >
                      {{ designItemAlias.get(selectedItem.id) }}
                    </span>
                  </div>
                </div>
                <!-- Entry-level export: Copy + Email (Export-on-all-windows rule) -->
                <div class="flex items-center gap-0.5">
                  <button
                    class="shrink-0 flex flex-col items-center gap-0.5 px-2 py-1 rounded hover:bg-slate-100 transition-colors"
                    :style="selectedSector ? { color: SECTOR_COLORS[selectedSector].stroke } : { color: '#64748b' }"
                    :title="`Copy this entry (${selectedItem.label}) as colorful HTML — paste with ⌘V`"
                    @click="exportItemCopy(selectedItem)"
                  >
                    <CopyGlyph size="compact" />
                    <span class="text-[8px] font-bold tracking-wider uppercase">Copy</span>
                  </button>
                  <button
                    class="shrink-0 flex flex-col items-center gap-0.5 px-2 py-1 rounded hover:bg-slate-100 transition-colors"
                    :style="selectedSector ? { color: SECTOR_COLORS[selectedSector].stroke } : { color: '#64748b' }"
                    :title="`Email this entry (${selectedItem.label}) — colorful HTML on clipboard, Mail opens`"
                    @click="exportItemEmail(selectedItem)"
                  >
                    <EmailGlyph size="compact" />
                    <span class="text-[8px] font-bold tracking-wider uppercase">Email</span>
                  </button>
                  <!-- SUMMARY SPEC back button — ExitGlyph + label, mirrors DETAIL button style (MOVE rule: Tom 2026-06-09) -->
                  <button
                    class="shrink-0 flex flex-col items-center gap-0.5 px-3 py-1 rounded hover:bg-slate-100 transition-colors"
                    :style="selectedSector ? { color: SECTOR_COLORS[selectedSector].stroke } : { color: '#64748b' }"
                    title="Summary Spec — return to all sector cards"
                    @click="autoSaveAndDeselect()"
                  >
                    <ExitGlyph size="compact" />
                    <span class="text-[9px] font-bold tracking-widest uppercase">Summary Spec</span>
                  </button>
                </div>
              </div>

              <!-- Value-flow relations panel (IET / Value Flow Table)
                   Tom Gilb 2026-06-08: S→Values, S→Evo Steps, E→Solutions, E→Tasks, T→Evo Step -->
              <div
                v-if="flowRelationsFor(selectedItem).length"
                class="mb-3 rounded-lg border border-orange-200 bg-orange-50/60 px-3 py-2 space-y-1"
              >
                <div class="text-[10px] font-bold text-orange-700 uppercase tracking-wide mb-1">Value Flow</div>
                <div v-for="rel in flowRelationsFor(selectedItem)" :key="rel.label" class="flex items-baseline gap-1.5 flex-wrap text-xs">
                  <span class="font-semibold shrink-0" :style="{ color: rel.color }">{{ rel.label }}:</span>
                  <span
                    v-for="ref in rel.refs"
                    :key="ref"
                    class="font-mono rounded border px-1.5 py-px text-[11px] bg-white"
                    :style="{ color: rel.color, borderColor: rel.color + '55' }"
                    :title="ref"
                  >{{ ref }}</span>
                </div>
              </div>

              <!-- Stakeholder relationships (Sources + Impacted) -->
              <div v-if="selectedItemStakeholderLinks.sources.length || selectedItemStakeholderLinks.impacted.length"
                   class="rounded-lg border border-blue-200 bg-blue-50 p-3 mb-3">
                <div class="text-xs font-bold text-blue-700 mb-2 flex items-center gap-1">
                  <span class="font-mono">[§]</span> Stakeholder Relationships
                </div>

                <!-- Value status banner — shows whether impacted stakeholders' needs are currently met -->
                <div v-if="selectedItemStakeholderLinks.valueStatusNote"
                     :class="selectedItemStakeholderLinks.valueStatusNote.startsWith('⚠')
                       ? 'rounded px-2 py-1 mb-2 text-[10px] font-mono font-bold bg-amber-100 text-amber-800 border border-amber-300'
                       : 'rounded px-2 py-1 mb-2 text-[10px] font-mono font-bold bg-green-50 text-green-800 border border-green-200'"
                     :title="'Value Status vs Goal — shows whether impacted stakeholders are currently receiving the committed level'">
                  {{ selectedItemStakeholderLinks.valueStatusNote }}
                </div>

                <!-- Sources -->
                <div v-if="selectedItemStakeholderLinks.sources.length" class="mb-2">
                  <div class="text-[10px] font-bold text-blue-600 uppercase tracking-wide mb-1">[§→] Sources (required this)</div>
                  <div class="flex flex-wrap gap-1">
                    <span v-for="link in selectedItemStakeholderLinks.sources" :key="'src-'+link.name"
                          :title="link.reason"
                          :class="link.confidence === 'explicit'
                            ? 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono bg-blue-200 text-blue-900 border border-blue-400'
                            : 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono bg-white text-blue-700 border border-dashed border-blue-300'">
                      <span class="text-[9px]">{{ link.confidence === 'explicit' ? '[§]' : '[§?]' }}</span>
                      {{ link.name }}
                    </span>
                  </div>
                </div>

                <!-- Impacted — amber warning on chips where the Value is below Goal -->
                <div v-if="selectedItemStakeholderLinks.impacted.length">
                  <div class="text-[10px] font-bold text-blue-600 uppercase tracking-wide mb-1">[§←] Impacted (affected by system attributes)</div>
                  <div class="flex flex-wrap gap-1">
                    <span v-for="link in selectedItemStakeholderLinks.impacted" :key="'imp-'+link.name"
                          :title="link.reason"
                          :class="link.satisfactionGap
                            ? 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono bg-amber-100 text-amber-900 border border-amber-400'
                            : link.confidence === 'explicit'
                              ? 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono bg-indigo-200 text-indigo-900 border border-indigo-400'
                              : 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono bg-white text-indigo-700 border border-dashed border-indigo-300'">
                      <span class="text-[9px]">{{ link.satisfactionGap ? '⚠' : link.confidence === 'explicit' ? '[§]' : '[§?]' }}</span>
                      {{ link.name }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Value editor — full Planguage V. template -->
              <template v-if="selectedItem.type === 'value'">
                <div class="space-y-3">
                  <!-- r93uu — Value Aspects Articulation Tool entry point (Tom Gilb 2026-06-11 22:45 CET).
                       r93uu: switched the visible icon from the 🧬 emoji (DD-011 violation — not a Planguage
                       glyph, "almost invisible" at small size) to the new ValueAspectsGlyph.vue — extends
                       PlValueIcon's O--*--> single-axis canonical form to THREE radiating axes ⇒
                       O ⇒ *--> × 3 + violet cluster brace at the right (signals "set of aspects").
                       Composes with DD-011 / DD-015 / DD-016. Button width + height + ring bumped so it
                       reads as a primary CTA, not a secondary chip. -->
                  <button
                    type="button"
                    class="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-violet-700 via-fuchsia-700 to-violet-700 hover:from-violet-600 hover:via-fuchsia-600 hover:to-violet-600 text-white text-[14px] font-bold transition-colors ring-2 ring-violet-900 flex items-center gap-3 shadow-md"
                    :title="`Value Aspects Articulation Tool — Designed by Tom Gilb 11 Jun 2026 22:45 CET. For complex Values, elaborate into a SET of Aspects (8-15 typical), each with its own Scale / Meter / Tolerable / Goal / Wish. Pre-seeded by Category (Usability, Quality, Maintainability, Resilience, Security, Performance, Reliability, Accessibility, Portability, Efficiency). Apply all OR a single Aspect to the master spec. Universal Undo wired. Patent Pending (24-142KG, 64/088,267) Co-Inventors Tom Gilb + Kai Gilb. Would you like to explore a deeper more advanced set of scales related to this one?`"
                    @click="openValueAspects(selectedItem)"
                  >
                    <ValueAspectsGlyph size="md" theme="on-dark" />
                    <span class="text-[15px] font-extrabold tracking-tight">Value Aspects — Deeper Articulation</span>
                    <span class="text-[11px] opacity-90 font-normal italic ml-auto">Tom Gilb 2026-06-11</span>
                  </button>
                  <!-- Ambition Level — unquantified vision statement + authoritative source (Tom Gilb 2026-06-09) -->
                  <!-- NOT the Scale/Tolerable/Goal/Wish quantification — those are BELOW. This is the raw human ambition BEFORE Planguage clarification. -->
                  <div class="rounded-lg border border-violet-300 bg-violet-50/70 px-3 py-2.5">
                    <PlanguageParamLabel param-key="Ambition Level" wrapper-class="mb-1" />
                    <textarea
                      v-model="editAmbitionStatement"
                      rows="2"
                      class="w-full text-sm border border-violet-200 rounded px-2 py-1 focus:ring-2 focus:ring-violet-300 focus:outline-none resize-none bg-white"
                      title="The vision or ambition statement — unquantified natural language (management directive, user story, politician speech). The Planguage fields below convert this into a precise, testable spec."
                      placeholder="e.g. 'We want world-class customer satisfaction' or 'No patient waits more than 4 hours'"
                    />
                    <!-- Source fields: person + reference context + URL -->
                    <div class="grid grid-cols-3 gap-2 mt-2">
                      <div>
                        <label class="block text-[10px] text-violet-500 uppercase tracking-wide font-semibold mb-0.5">Source: Person / Role</label>
                        <input v-model="editAmbitionSourcePerson" type="text"
                          class="w-full text-xs border border-violet-200 rounded px-2 py-0.5 bg-white focus:ring-1 focus:ring-violet-300 focus:outline-none"
                          title="Who stated this ambition — person name, role, or title (e.g. CEO, Minister Smith, Tom Gilb)"
                          placeholder="CEO, Board, Minister…" />
                      </div>
                      <div>
                        <label class="block text-[10px] text-violet-500 uppercase tracking-wide font-semibold mb-0.5">Source: Reference / Date</label>
                        <input v-model="editAmbitionSourceRef" type="text"
                          class="w-full text-xs border border-violet-200 rounded px-2 py-0.5 bg-white focus:ring-1 focus:ring-violet-300 focus:outline-none"
                          title="Where/when stated — title + date/time (e.g. 'Board meeting 2026-06-08', 'SEM Sharpening 9 July 12:42')"
                          placeholder="Board meeting 2026-06-08…" />
                      </div>
                      <div>
                        <label class="block text-[10px] text-violet-500 uppercase tracking-wide font-semibold mb-0.5">Source: URL</label>
                        <input v-model="editAmbitionSourceUrl" type="text"
                          class="w-full text-xs border border-violet-200 rounded px-2 py-0.5 bg-white focus:ring-1 focus:ring-violet-300 focus:outline-none"
                          title="URL to the source document, speech, slide deck, or recording"
                          placeholder="https://…" />
                      </div>
                    </div>
                    <!-- Authority signal — shown when source person is filled -->
                    <p v-if="editAmbitionSourcePerson" class="text-[10px] text-violet-700 mt-1.5 italic leading-tight">
                      ⚡ Authority signal — the Planguage clarification below carries the weight of
                      <strong>{{ editAmbitionSourcePerson }}</strong>'s stated directive.
                      This is a major Planguage mechanism, not mere BS statement. (TG 2026-06-09)
                    </p>
                    <p v-if="!editAmbitionStatement" class="text-[10px] text-violet-400 mt-1 italic">
                      Optional — capture the raw vision statement before quantifying it below.
                      A power-backed source (boss, minister, regulator) gives legal and political authority to this spec.
                    </p>
                  </div>
                  <!-- Description omitted for Value entries: the Planguage parameters (Scale, Meter, Tolerable, Goal, Wish, Ambition Level) ARE the description. Tom Gilb 2026-06-09: "drop it." -->
                  <!-- Scale + Meter: full-width textareas — full sentence always visible (Tom 2026-06-09: no truncation ever) -->
                  <div class="space-y-2">
                    <div>
                      <div class="flex items-center gap-1 mb-0.5">
                        <PlanguageParamLabel param-key="Scale" wrapper-class="mb-0" />
                        <SourcePin
                          field-name="Scale"
                          :field-source="props.spec?.values.find(v => v.id === selectedItem.id)?.fieldSources?.['scale'] ?? null"
                        />
                      </div>
                      <textarea v-model="editScale" rows="2" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-violet-300 focus:outline-none resize-none" :title="`Scale — what is measured and its unit for ${selectedItem.id}`" placeholder="e.g. Number of neighbor complaints per summer season" />
                    </div>
                    <div>
                      <div class="flex items-center gap-1 mb-0.5">
                        <PlanguageParamLabel param-key="Meter" wrapper-class="mb-0" />
                        <SourcePin
                          field-name="Meter"
                          :field-source="props.spec?.values.find(v => v.id === selectedItem.id)?.fieldSources?.['meter'] ?? null"
                        />
                      </div>
                      <textarea v-model="editMeter" rows="2" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-violet-300 focus:outline-none resize-none" :title="`Meter — how measurement is performed for ${selectedItem.id}`" placeholder="e.g. Log of direct complaints, notes, or reports from neighbors" />
                    </div>
                  </div>
                  <!-- ── Qualifiers (Planguage *124) — Tom Gilb r93rrr 2026-06-12 ──────
                       Universal QualifiersBar mount per "3 classes, everywhere". Same
                       component renders in ValueAspectsPanel + all future spec-edit
                       surfaces. Replaces the legacy 5-field block (When/Where/What/How/Why)
                       per the r93rrr Glossary-canonical migration; legacy data preserved
                       via the `editConditionsObject` bridge computed (legacy refs still
                       written by the persist path at ~1514 + ~1596). Why → promoted to
                       a dedicated Rationale input below the bar so existing data is
                       not lost (No-Silent-Data-Loss SUPREME). -->
                  <QualifiersBar
                    v-model="editConditionsObject"
                    :entry-name="editId || selectedItem.id"
                    :level-preview="editGoal"
                    level-label="Goal"
                  />
                  <!-- Legacy 'Why' → Rationale (preserved per No-Silent-Data-Loss; per r93rrr
                       it is NOT a Qualifier — promoted out of the bracketed Qualifiers set). -->
                  <div v-if="editConditionWhy || conditionsOpen" class="mt-1 px-1">
                    <label class="flex items-center gap-2 text-[11px]">
                      <span class="font-mono text-[10px] uppercase tracking-wide text-slate-600 shrink-0">Rationale</span>
                      <span class="text-[10px] text-slate-400 italic shrink-0">(legacy "Why" — not a Qualifier per *124; describes the spec's purpose)</span>
                    </label>
                    <input v-model="editConditionWhy" type="text"
                      class="mt-0.5 w-full text-xs border border-slate-200 rounded px-2 py-1 focus:ring-1 focus:ring-slate-400 focus:outline-none bg-white"
                      placeholder="e.g. for compliance reporting workflows"
                      title="Rationale — the purpose / intent behind this spec. Per r93rrr Glossary migration, this is NOT a Qualifier (Qualifiers are Time/Place/Event per *124) — it describes WHY the spec exists." />
                  </div>
                  <!-- Show / hide toggle preserved so existing collapsed-state behaviour still works. -->
                  <p v-if="!conditionsOpen && !(editConditionWhy)" class="text-[10px] text-sky-500 italic leading-snug">
                    <button type="button" class="font-semibold text-sky-600 hover:text-sky-800" @click.stop="conditionsOpen = true">▼ Add Rationale (optional)</button>
                  </p>
                  <div class="grid grid-cols-3 gap-2">
                    <div>
                      <div class="flex items-center gap-1 mb-0.5">
                        <PlanguageParamLabel param-key="Tolerable" wrapper-class="mb-0" />
                        <SourcePin
                          field-name="Tolerable"
                          :field-source="props.spec?.values.find(v => v.id === selectedItem.id)?.fieldSources?.['tolerable'] ?? null"
                        />
                      </div>
                      <input v-model="editTolerable" type="text" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-violet-300 focus:outline-none" :title="`Tolerable: minimum non-failure / project-viability threshold for ${selectedItem.id}`" placeholder="60" />
                    </div>
                    <div>
                      <div class="flex items-center gap-1 mb-0.5">
                        <PlanguageParamLabel param-key="Goal" wrapper-class="mb-0" />
                        <SourcePin
                          field-name="Goal"
                          :field-source="props.spec?.values.find(v => v.id === selectedItem.id)?.fieldSources?.['goal'] ?? null"
                        />
                      </div>
                      <input v-model="editGoal" type="text" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-violet-300 focus:outline-none" :title="`Goal > · Committed promise for ${selectedItem.id} — ONLY set after MultiVision IET confirms ≥100% delivery capability. Use Wish as the planning target until then.`" placeholder="90" />
                    </div>
                    <div>
                      <div class="flex items-center gap-1 mb-0.5">
                        <PlanguageParamLabel param-key="Wish" wrapper-class="mb-0" />
                        <SourcePin
                          field-name="Wish"
                          :field-source="props.spec?.values.find(v => v.id === selectedItem.id)?.fieldSources?.['wish'] ?? null"
                        />
                      </div>
                      <input v-model="editWish" type="text" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-violet-300 focus:outline-none" :title="`Wish >? · Stakeholder dream level for ${selectedItem.id} — uncommitted. This is the CORRECT planning target before Solutions are confirmed. Wish is NOT a committed requirement.`" placeholder="100" />
                    </div>
                  </div>
                  <!-- Wish-first principle callout — Tom Gilb 2026-06-09 -->
                  <!-- Before solutions are found and financed, Wish is the correct target. -->
                  <!-- Goal can only be committed after MultiVision IET confirms ≥100% delivery capability. -->
                  <div class="flex items-start gap-2 rounded border border-violet-200 bg-violet-50 px-2.5 py-2 text-[11px] leading-snug text-violet-700">
                    <span class="mt-0.5 shrink-0 font-bold text-violet-500">⚠</span>
                    <span>
                      <strong>Wish >? is the planning target — not Goal.</strong>
                      Before Solutions are confirmed and funded, stakeholders can only express a Wish (uncommitted dream).
                      Set Goal only after <strong>MultiVision IET</strong> confirms ≥100% delivery capability.
                      <em>Wish is NOT a committed requirement.</em>
                    </span>
                  </div>
                  <div>
                    <div class="flex items-center gap-1 mb-0.5">
                      <PlanguageParamLabel param-key="Status" wrapper-class="mb-0" />
                      <SourcePin
                        field-name="Status"
                        :field-source="props.spec?.values.find(v => v.id === selectedItem.id)?.fieldSources?.['status'] ?? null"
                      />
                    </div>
                    <input v-model="editStatus" type="text" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-300 focus:outline-none" :title="`Status: current measured value for ${selectedItem.id}`" placeholder="75" />
                  </div>
                  <!-- When conditions (optional) -->
                  <details class="text-xs">
                    <summary class="cursor-pointer text-slate-500 hover:text-slate-700 font-medium">When conditions (optional — time/event qualifiers)</summary>
                    <div class="mt-2 space-y-2">
                      <div class="grid grid-cols-2 gap-2">
                        <div>
                          <label class="block text-[11px] font-medium text-slate-500 mb-0.5">Status When</label>
                          <input v-model="editStatusWhen" type="text" class="w-full text-xs border border-slate-200 rounded px-2 py-1 focus:ring-1 focus:ring-slate-300 focus:outline-none" placeholder="e.g. 2026-Q2" />
                        </div>
                        <div>
                          <label class="block text-[11px] font-medium text-slate-500 mb-0.5">Tolerable When</label>
                          <input v-model="editTolerableWhen" type="text" class="w-full text-xs border border-slate-200 rounded px-2 py-1 focus:ring-1 focus:ring-slate-300 focus:outline-none" placeholder="e.g. after MVP launch" />
                        </div>
                        <div>
                          <label class="block text-[11px] font-medium text-slate-500 mb-0.5">Goal When</label>
                          <input v-model="editGoalWhen" type="text" class="w-full text-xs border border-slate-200 rounded px-2 py-1 focus:ring-1 focus:ring-slate-300 focus:outline-none" placeholder="e.g. 2027-Q1" />
                        </div>
                        <div>
                          <label class="block text-[11px] font-medium text-slate-500 mb-0.5">Wish When</label>
                          <input v-model="editWishWhen" type="text" class="w-full text-xs border border-slate-200 rounded px-2 py-1 focus:ring-1 focus:ring-slate-300 focus:outline-none" placeholder="e.g. 2028" />
                        </div>
                      </div>
                    </div>
                  </details>
                  <div>
                    <PlanguageParamLabel param-key="Level" />
                    <input v-model="editLevel" type="text" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-slate-300 focus:outline-none" :title="`Planguage level: Business / Stakeholder / Product / Solution / Evo / To-Do`" placeholder="e.g. 1" />
                  </div>
                  <!-- ─ Additional Planguage parameters (Tom Gilb 2026-06-09) ─ -->
                  <div class="border-t border-slate-100 pt-3 space-y-3">
                    <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Additional Planguage Parameters</div>
                    <div>
                      <PlanguageParamLabel param-key="Stakeholders" />
                      <textarea v-model="editStakeholders" rows="2" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-slate-300 focus:outline-none resize-none" title="Stakeholders relevant to this Value entry" placeholder="e.g. Patient, Nurse, Admin" />
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                      <div>
                        <PlanguageParamLabel param-key="Spec Owner" />
                        <input v-model="editSpecOwner" type="text" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-slate-300 focus:outline-none" title="Who is responsible for this spec entry" placeholder="e.g. Product Manager" />
                      </div>
                      <div>
                        <PlanguageParamLabel param-key="Version / Date" />
                        <input v-model="editVersion" type="text" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-slate-300 focus:outline-none" title="Version or date-time stamp of this spec entry" placeholder="e.g. v1.2 · 2026-06-09" />
                      </div>
                    </div>
                    <div>
                      <PlanguageParamLabel param-key="Justification" />
                      <textarea v-model="editJustification" rows="2" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-slate-300 focus:outline-none resize-none" title="Why this entry is in the spec — business justification" placeholder="Why this Value is in the spec — business case, stakeholder requirement, etc." />
                    </div>
                    <div>
                      <PlanguageParamLabel param-key="Risks / Issues" />
                      <textarea v-model="editRisksIssues" rows="2" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-slate-300 focus:outline-none resize-none" title="Known risks or issues associated with this entry" placeholder="Known risks, open issues, or concerns about this Value entry" />
                    </div>
                  </div>
                  <!-- Efficiency impact preview -->
                  <p v-if="previewEfficiency" class="text-xs text-blue-600 font-medium">{{ previewEfficiency }}</p>
                  <div class="flex gap-2">
                    <button class="flex-1 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors" title="Apply all changes to the Value entry in the spec" @click="applyItemEdits()">
                      Apply Changes
                    </button>
                    <button class="px-4 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-sm font-semibold border border-red-200 transition-colors" title="Delete this Value entry from the spec — deletion tracked in Governance" @click="deleteSelectedEntry">
                      Delete
                    </button>
                  </div>
                  <!-- Bottom nav mirror — DD-014: SUMMARY SPEC after Apply Changes so user never has to scroll back up (Tom 2026-06-09) -->
                  <div class="border-t border-dashed pt-3 mt-1 flex justify-end"
                       :style="{ borderColor: selectedSector ? SECTOR_COLORS[selectedSector].stroke + '44' : '#cbd5e1' }">
                    <button
                      class="flex flex-col items-center gap-0.5 px-3 py-1 rounded hover:bg-slate-100 transition-colors"
                      :style="selectedSector ? { color: SECTOR_COLORS[selectedSector].stroke } : { color: '#64748b' }"
                      title="Summary Spec — return to all sector cards"
                      @click="autoSaveAndDeselect()"
                    >
                      <ExitGlyph size="compact" />
                      <span class="text-[9px] font-bold tracking-widest uppercase">Summary Spec</span>
                    </button>
                  </div>
                </div>
              </template>

              <!-- Resource editor — full Planguage R. template -->
              <template v-else-if="selectedItem.type === 'resource'">
                <div class="space-y-3">
                  <!-- Description omitted for Resource entries: Scale, Meter, Budget, Consumed are the description. Tom Gilb 2026-06-09: "drop it." -->
                  <!-- Scale + Meter: full-width textareas — full sentence always visible (Tom 2026-06-09: no truncation ever) -->
                  <div class="space-y-2">
                    <div>
                      <div class="flex items-center gap-1 mb-0.5">
                        <PlanguageParamLabel param-key="Scale" wrapper-class="mb-0" />
                        <SourcePin
                          field-name="Scale"
                          :field-source="props.spec?.resources?.find(r => r.id === selectedItem.id)?.fieldSources?.['scale'] ?? null"
                        />
                      </div>
                      <textarea v-model="editScale" rows="2" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-purple-300 focus:outline-none resize-none" :title="`Scale — what is measured for ${selectedItem.id}`" placeholder="e.g. Engineer-hours consumed by this initiative" />
                    </div>
                    <div>
                      <div class="flex items-center gap-1 mb-0.5">
                        <PlanguageParamLabel param-key="Meter" wrapper-class="mb-0" />
                        <SourcePin
                          field-name="Meter"
                          :field-source="props.spec?.resources?.find(r => r.id === selectedItem.id)?.fieldSources?.['meter'] ?? null"
                        />
                      </div>
                      <textarea v-model="editMeter" rows="2" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-purple-300 focus:outline-none resize-none" :title="`Meter — how consumption is measured for ${selectedItem.id}`" placeholder="e.g. Jira time-tracking logged by each team member" />
                    </div>
                  </div>
                  <!-- ── Qualifiers (Planguage *124) — r93rrr shared QualifiersBar for Resources ── -->
                  <QualifiersBar
                    v-model="editConditionsObject"
                    :entry-name="editId || selectedItem.id"
                    :level-preview="editBudget"
                    level-label="Budget"
                  />
                  <div v-if="editConditionWhy" class="mt-1 px-1">
                    <label class="flex items-center gap-2 text-[11px]">
                      <span class="font-mono text-[10px] uppercase tracking-wide text-slate-600 shrink-0">Rationale</span>
                      <span class="text-[10px] text-slate-400 italic shrink-0">(legacy "Why" — not a Qualifier per *124)</span>
                    </label>
                    <input v-model="editConditionWhy" type="text"
                      class="mt-0.5 w-full text-xs border border-slate-200 rounded px-2 py-1 focus:ring-1 focus:ring-slate-400 focus:outline-none bg-white"
                      placeholder="e.g. for compliance reporting"
                      title="Rationale — the purpose / intent behind this Resource constraint. Per r93rrr migration, this is NOT a Qualifier (Qualifiers are Time/Place/Event per *124)." />
                  </div>
                  <div class="grid grid-cols-2 gap-2">
                    <div>
                      <div class="flex items-center gap-1 mb-0.5">
                        <PlanguageParamLabel param-key="Budget" wrapper-class="mb-0" />
                        <SourcePin
                          field-name="Budget"
                          :field-source="props.spec?.resources?.find(r => r.id === selectedItem.id)?.fieldSources?.['budget'] ?? null"
                        />
                      </div>
                      <input v-model="editBudget" type="text"
                        class="w-full text-sm border rounded px-2 py-1 focus:ring-2 focus:ring-purple-300 focus:outline-none transition-all"
                        :class="dirtyFields.has('budget') ? 'border-amber-500 ring-2 ring-amber-300 bg-amber-50 animate-pulse' : 'border-slate-300'"
                        :title="`Budget: official allocated limit for ${selectedItem.id}${dirtyFields.has('budget') ? ' · UNSAVED EDIT — click Apply at top of form to save' : ''}`"
                        placeholder="e.g. 500000" />
                    </div>
                    <div>
                      <div class="flex items-center gap-1 mb-0.5">
                        <PlanguageParamLabel param-key="Consumed" wrapper-class="mb-0" />
                        <SourcePin
                          field-name="Consumed"
                          :field-source="props.spec?.resources?.find(r => r.id === selectedItem.id)?.fieldSources?.['status'] ?? null"
                        />
                      </div>
                      <input v-model="editConsumed" type="text"
                        class="w-full text-sm border rounded px-2 py-1 focus:ring-2 focus:ring-purple-300 focus:outline-none transition-all"
                        :class="dirtyFields.has('status') ? 'border-amber-500 ring-2 ring-amber-300 bg-amber-50 animate-pulse' : 'border-slate-300'"
                        :title="`Current consumption (Status field) for ${selectedItem.id}${dirtyFields.has('status') ? ' · UNSAVED EDIT — click Apply at top of form to save' : ''}`"
                        placeholder="e.g. 200000" />
                    </div>
                  </div>
                  <div class="grid grid-cols-2 gap-2">
                    <div>
                      <div class="flex items-center gap-1 mb-0.5">
                        <PlanguageParamLabel param-key="Tolerable" wrapper-class="mb-0" />
                        <SourcePin
                          field-name="Tolerable"
                          :field-source="props.spec?.resources?.find(r => r.id === selectedItem.id)?.fieldSources?.['tolerable'] ?? null"
                        />
                      </div>
                      <input v-model="editResourceTolerable" type="text" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-purple-300 focus:outline-none" :title="`Tolerable consumption ceiling for ${selectedItem.id}`" placeholder="e.g. 550000" />
                    </div>
                    <div>
                      <div class="flex items-center gap-1 mb-0.5">
                        <PlanguageParamLabel param-key="Wish" wrapper-class="mb-0" />
                        <SourcePin
                          field-name="Wish"
                          :field-source="props.spec?.resources?.find(r => r.id === selectedItem.id)?.fieldSources?.['wish'] ?? null"
                        />
                      </div>
                      <input v-model="editResourceWish" type="text" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-purple-300 focus:outline-none" :title="`Stakeholder desired allocation — uncommitted aspiration for ${selectedItem.id}`" placeholder="e.g. 400000" />
                    </div>
                  </div>
                  <div>
                    <PlanguageParamLabel param-key="Level" />
                    <input v-model="editLevel" type="text" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-slate-300 focus:outline-none" title="Planguage hierarchy level" placeholder="e.g. 1" />
                  </div>
                  <!-- ─ Additional Planguage parameters ─ -->
                  <div class="border-t border-slate-100 pt-3 space-y-3">
                    <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Additional Planguage Parameters</div>
                    <div>
                      <PlanguageParamLabel param-key="Stakeholders" />
                      <textarea v-model="editStakeholders" rows="2" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-slate-300 focus:outline-none resize-none" title="Stakeholders relevant to this Resource entry" placeholder="e.g. Finance Team, Engineering Lead" />
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                      <div>
                        <PlanguageParamLabel param-key="Spec Owner" />
                        <input v-model="editSpecOwner" type="text" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-slate-300 focus:outline-none" title="Who is responsible for this spec entry" placeholder="e.g. CFO" />
                      </div>
                      <div>
                        <PlanguageParamLabel param-key="Version / Date" />
                        <input v-model="editVersion" type="text" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-slate-300 focus:outline-none" title="Version or date-time stamp of this spec entry" placeholder="e.g. v1.2 · 2026-06-09" />
                      </div>
                    </div>
                    <div>
                      <PlanguageParamLabel param-key="Justification" />
                      <textarea v-model="editJustification" rows="2" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-slate-300 focus:outline-none resize-none" title="Why this entry is in the spec" placeholder="Why this Resource is in the spec — what plan element it enables" />
                    </div>
                    <div>
                      <PlanguageParamLabel param-key="Risks / Issues" />
                      <textarea v-model="editRisksIssues" rows="2" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-slate-300 focus:outline-none resize-none" title="Known risks or issues associated with this entry" placeholder="Known risks, open issues, or concerns about this Resource entry" />
                    </div>
                  </div>
                  <!-- Efficiency impact preview -->
                  <p v-if="previewEfficiency" class="text-xs text-blue-600 font-medium">{{ previewEfficiency }}</p>
                  <div class="flex gap-2">
                    <button class="flex-1 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-colors" title="Apply all changes to the Resource entry in the spec" @click="applyItemEdits()">
                      Apply Changes
                    </button>
                    <button class="px-4 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-sm font-semibold border border-red-200 transition-colors" title="Delete this Resource entry — tracked in Governance, triggers cascade analysis" @click="deleteSelectedEntry">
                      Delete
                    </button>
                  </div>
                  <!-- Bottom nav mirror — DD-014 -->
                  <div class="border-t border-dashed pt-3 mt-1 flex justify-end"
                       :style="{ borderColor: selectedSector ? SECTOR_COLORS[selectedSector].stroke + '44' : '#cbd5e1' }">
                    <button class="flex flex-col items-center gap-0.5 px-3 py-1 rounded hover:bg-slate-100 transition-colors"
                            :style="selectedSector ? { color: SECTOR_COLORS[selectedSector].stroke } : { color: '#64748b' }"
                            title="Summary Spec — return to all sector cards"
                            @click="autoSaveAndDeselect()">
                      <ExitGlyph size="compact" />
                      <span class="text-[9px] font-bold tracking-widest uppercase">Summary Spec</span>
                    </button>
                  </div>
                </div>
              </template>

              <!-- Evo Step detail — read-only summary (Tom Gilb 2026-06-07: Design hierarchy) -->
              <template v-else-if="selectedItem.type === 'evo-step'">
                <div class="space-y-3">
                  <div v-if="selectedItem.effortPercent != null">
                    <label class="block text-xs font-semibold text-slate-600 mb-1">Effort Share</label>
                    <div class="flex items-center gap-2">
                      <div class="flex-1 bg-slate-200 rounded-full h-2">
                        <div
                          class="bg-orange-500 h-2 rounded-full"
                          :style="{ width: `${Math.min(selectedItem.effortPercent, 100)}%` }"
                        />
                      </div>
                      <span class="text-sm font-semibold text-orange-700">{{ selectedItem.effortPercent }}%</span>
                    </div>
                  </div>
                  <div v-if="selectedItem.linkedSolutions?.length">
                    <label class="block text-xs font-semibold text-slate-600 mb-1">Linked Solutions</label>
                    <div class="flex flex-wrap gap-1">
                      <span
                        v-for="sol in selectedItem.linkedSolutions"
                        :key="sol"
                        class="text-[11px] bg-orange-100 text-orange-800 border border-orange-200 rounded px-1.5 py-0.5"
                      >{{ sol }}</span>
                    </div>
                  </div>
                  <p class="text-xs text-slate-500 italic">Evo Steps are defined in the Evo Planner — manage via Evo Tools.</p>
                </div>
              </template>

              <!-- Task detail — read-only summary (Tom Gilb 2026-06-07: Design hierarchy) -->
              <template v-else-if="selectedItem.type === 'task'">
                <div class="space-y-3">
                  <div v-if="selectedItem.parentStep">
                    <label class="block text-xs font-semibold text-slate-600 mb-1">Parent Evo Step</label>
                    <p class="text-sm text-orange-700 bg-orange-50 rounded border border-orange-100 px-2 py-1">{{ selectedItem.parentStep }}</p>
                  </div>
                  <div class="grid grid-cols-2 gap-2">
                    <div v-if="selectedItem.effortHours != null">
                      <label class="block text-xs font-semibold text-slate-600 mb-1">Effort (hours)</label>
                      <p class="text-sm font-semibold text-slate-700 bg-slate-50 rounded border border-slate-200 px-2 py-1">
                        {{ selectedItem.effortHours ?? '—' }}
                      </p>
                    </div>
                    <div v-if="selectedItem.assignee != null">
                      <label class="block text-xs font-semibold text-slate-600 mb-1">Assignee</label>
                      <!-- break-words: spec text never truncates silently (Tom 2026-06-09) -->
                      <p class="text-sm text-slate-700 bg-slate-50 rounded border border-slate-200 px-2 py-1 break-words"
                         :title="selectedItem.assignee || '—'">
                        {{ selectedItem.assignee || '—' }}
                      </p>
                    </div>
                  </div>
                  <p class="text-xs text-slate-500 italic">Tasks are managed in the Evo Planner task breakdown.</p>
                </div>
              </template>

              <!-- Function editor — full Planguage F. template (Tom Gilb 2026-06-08) -->
              <template v-else-if="selectedItem.type === 'function'">
                <div class="space-y-3">
                  <div>
                    <div class="flex items-center gap-1 mb-0.5">
                      <PlanguageParamLabel param-key="Description" wrapper-class="mb-0" />
                      <SourcePin
                        field-name="Description"
                        :field-source="props.spec?.functions?.find(f => f.id === selectedItem.id)?.fieldSources?.['description'] ?? null"
                      />
                    </div>
                    <textarea v-model="editDescription" rows="2" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-green-300 focus:outline-none resize-none" :title="`Function description (DD-004): bare-noun capability — present or absent for ${selectedItem.id}`" placeholder="e.g. Process customer payments" />
                  </div>
                  <div>
                    <div class="flex items-center gap-1 mb-0.5">
                      <PlanguageParamLabel param-key="Presence Test" wrapper-class="mb-0" />
                      <SourcePin
                        field-name="Presence Test"
                        :field-source="props.spec?.functions?.find(f => f.id === selectedItem.id)?.fieldSources?.['presenceTest'] ?? null"
                      />
                    </div>
                    <textarea v-model="editPresenceTest" rows="2" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-green-300 focus:outline-none resize-none" :title="`Presence test — the binary check that determines whether this function exists in the system`" placeholder="e.g. Payment endpoint exists and accepts valid card data" />
                  </div>
                  <div>
                    <PlanguageParamLabel param-key="Function" />
                    <input v-model="editFunctionOfValue" type="text" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-green-300 focus:outline-none" title="Which Value entry(s) does this function primarily serve?" placeholder="e.g. V.CustomerSatisfaction" />
                  </div>
                  <div>
                    <label class="block text-xs font-semibold text-slate-600 mb-1">Current Status</label>
                    <select v-model="editCurrentStatus" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-green-300 focus:outline-none bg-white" title="Current implementation status: is this function present, absent, or partially implemented?">
                      <option value="">— not assessed —</option>
                      <option value="absent">absent</option>
                      <option value="partial">partial</option>
                      <option value="present">present</option>
                    </select>
                  </div>
                  <div>
                    <PlanguageParamLabel param-key="Level" />
                    <input v-model="editLevel" type="text" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-slate-300 focus:outline-none" title="Planguage level: Business / Stakeholder / Product / Solution / Evo / To-Do" placeholder="e.g. 1" />
                  </div>
                  <!-- ─ Additional Planguage parameters ─ -->
                  <div class="border-t border-slate-100 pt-3 space-y-3">
                    <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Additional Planguage Parameters</div>
                    <div>
                      <PlanguageParamLabel param-key="Stakeholders" />
                      <textarea v-model="editStakeholders" rows="2" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-slate-300 focus:outline-none resize-none" title="Stakeholders relevant to this Function entry" placeholder="e.g. Patient, Nurse, Admin" />
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                      <div>
                        <PlanguageParamLabel param-key="Spec Owner" />
                        <input v-model="editSpecOwner" type="text" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-slate-300 focus:outline-none" title="Who is responsible for this spec entry" placeholder="e.g. Product Owner" />
                      </div>
                      <div>
                        <PlanguageParamLabel param-key="Version / Date" />
                        <input v-model="editVersion" type="text" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-slate-300 focus:outline-none" title="Version or date-time stamp of this spec entry" placeholder="e.g. v1.2 · 2026-06-09" />
                      </div>
                    </div>
                    <div>
                      <PlanguageParamLabel param-key="Justification" />
                      <textarea v-model="editJustification" rows="2" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-slate-300 focus:outline-none resize-none" title="Why this Function is in the spec" placeholder="Why this Function is in the spec — business requirement, stakeholder need, etc." />
                    </div>
                    <div>
                      <PlanguageParamLabel param-key="Risks / Issues" />
                      <textarea v-model="editRisksIssues" rows="2" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-slate-300 focus:outline-none resize-none" title="Known risks or issues associated with this entry" placeholder="Known risks, open issues, or concerns about this Function entry" />
                    </div>
                  </div>
                  <div class="flex gap-2">
                    <button class="flex-1 py-2 rounded-lg bg-green-700 hover:bg-green-800 text-white text-sm font-semibold transition-colors" title="Apply all changes to this Function entry in the spec" @click="applyItemEdits()">
                      Apply Changes
                    </button>
                    <button class="px-4 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-sm font-semibold border border-red-200 transition-colors" title="Delete this Function entry — tracked in Governance" @click="deleteSelectedEntry">
                      Delete
                    </button>
                  </div>
                  <p class="text-[11px] text-slate-400">Function is binary (present or absent) — DD-004. Quality levels attach as Value entries.</p>
                  <!-- Bottom nav mirror — DD-014 -->
                  <div class="border-t border-dashed pt-3 mt-1 flex justify-end"
                       :style="{ borderColor: selectedSector ? SECTOR_COLORS[selectedSector].stroke + '44' : '#cbd5e1' }">
                    <button class="flex flex-col items-center gap-0.5 px-3 py-1 rounded hover:bg-slate-100 transition-colors"
                            :style="selectedSector ? { color: SECTOR_COLORS[selectedSector].stroke } : { color: '#64748b' }"
                            title="Summary Spec — return to all sector cards"
                            @click="autoSaveAndDeselect()">
                      <ExitGlyph size="compact" />
                      <span class="text-[9px] font-bold tracking-widest uppercase">Summary Spec</span>
                    </button>
                  </div>
                </div>
              </template>

              <!-- Solution editor — full Planguage S. template -->
              <template v-else-if="selectedItem.type === 'solution'">
                <div class="space-y-3">
                  <div>
                    <div class="flex items-center gap-1 mb-0.5">
                      <PlanguageParamLabel param-key="Description" wrapper-class="mb-0" />
                      <SourcePin
                        field-name="Description"
                        :field-source="props.spec?.solutions?.find(s => s.id === selectedItem.id)?.fieldSources?.['description'] ?? null"
                      />
                    </div>
                    <textarea v-model="editDescription" rows="3" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-orange-300 focus:outline-none resize-none" :title="`Solution description — a concrete, implementable design for ${selectedItem.id}`" placeholder="e.g. Implement REST API gateway with OAuth 2.0 authentication layer" />
                  </div>
                  <div>
                    <div class="flex items-center gap-1 mb-0.5">
                      <PlanguageParamLabel param-key="Impacts Values" wrapper-class="mb-0" />
                      <SourcePin
                        field-name="Impacts Values"
                        :field-source="props.spec?.solutions?.find(s => s.id === selectedItem.id)?.fieldSources?.['impactsValues'] ?? null"
                      />
                    </div>
                    <textarea v-model="editImpactsValues" rows="2" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-orange-300 focus:outline-none resize-none" :title="`Expected improvement to Value entries — e.g. 'V.Throughput ~+20%, V.Reliability ~+15%' for ${selectedItem.id}`" placeholder="e.g. Search Latency ~+15%, User Satisfaction ~+20%" />
                  </div>
                  <div>
                    <div class="flex items-center gap-1 mb-0.5">
                      <PlanguageParamLabel param-key="Impacts Costs" wrapper-class="mb-0" />
                      <SourcePin
                        field-name="Impacts Costs"
                        :field-source="props.spec?.solutions?.find(s => s.id === selectedItem.id)?.fieldSources?.['impactsCosts'] ?? null"
                      />
                    </div>
                    <textarea v-model="editImpactsCosts" rows="2" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-orange-300 focus:outline-none resize-none" :title="`Expected resource cost impact — e.g. 'R.Budget ~-8%, R.Timeline ~+3 days' for ${selectedItem.id}`" placeholder="e.g. R.Budget ~-8%, R.Timeline ~+3 days" />
                  </div>
                  <div>
                    <PlanguageParamLabel param-key="Function" />
                    <input v-model="editFunctionRef" type="text" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-orange-300 focus:outline-none" title="Which Function does this solution implement? (Planguage S.function field)" placeholder="e.g. F.ProcessPayments" />
                  </div>
                  <div>
                    <PlanguageParamLabel param-key="Level" />
                    <input v-model="editLevel" type="text" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-slate-300 focus:outline-none" title="Planguage level" placeholder="e.g. 1" />
                  </div>
                  <!-- ─ Additional Planguage parameters ─ -->
                  <div class="border-t border-slate-100 pt-3 space-y-3">
                    <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Additional Planguage Parameters</div>
                    <div>
                      <PlanguageParamLabel param-key="Stakeholders" />
                      <textarea v-model="editStakeholders" rows="2" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-slate-300 focus:outline-none resize-none" title="Stakeholders relevant to this Solution" placeholder="e.g. Engineering Team, Tech Lead" />
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                      <div>
                        <PlanguageParamLabel param-key="Spec Owner" />
                        <input v-model="editSpecOwner" type="text" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-slate-300 focus:outline-none" title="Who is responsible for this spec entry" placeholder="e.g. Tech Lead" />
                      </div>
                      <div>
                        <PlanguageParamLabel param-key="Version / Date" />
                        <input v-model="editVersion" type="text" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-slate-300 focus:outline-none" title="Version or date-time stamp of this spec entry" placeholder="e.g. v1.2 · 2026-06-09" />
                      </div>
                    </div>
                    <div>
                      <PlanguageParamLabel param-key="Justification" />
                      <textarea v-model="editJustification" rows="2" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-slate-300 focus:outline-none resize-none" title="Why this Solution is in the spec" placeholder="Why this Solution is chosen — design rationale, alternatives considered, etc." />
                    </div>
                    <div>
                      <PlanguageParamLabel param-key="Risks / Issues" />
                      <textarea v-model="editRisksIssues" rows="2" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-slate-300 focus:outline-none resize-none" title="Known risks or issues associated with this entry" placeholder="Known risks, implementation concerns, or open issues" />
                    </div>
                  </div>
                  <div class="flex gap-2">
                    <button class="flex-1 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold transition-colors" title="Apply all changes to this Solution entry in the spec" @click="applyItemEdits()">
                      Apply Changes
                    </button>
                    <button class="px-4 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-sm font-semibold border border-red-200 transition-colors" title="Delete this Solution entry — tracked in Governance for Cascade analysis" @click="deleteSelectedEntry">
                      Delete
                    </button>
                  </div>
                  <!-- Bottom nav mirror — DD-014 -->
                  <div class="border-t border-dashed pt-3 mt-1 flex justify-end"
                       :style="{ borderColor: selectedSector ? SECTOR_COLORS[selectedSector].stroke + '44' : '#cbd5e1' }">
                    <button class="flex flex-col items-center gap-0.5 px-3 py-1 rounded hover:bg-slate-100 transition-colors"
                            :style="selectedSector ? { color: SECTOR_COLORS[selectedSector].stroke } : { color: '#64748b' }"
                            title="Summary Spec — return to all sector cards"
                            @click="autoSaveAndDeselect()">
                      <ExitGlyph size="compact" />
                      <span class="text-[9px] font-bold tracking-widest uppercase">Summary Spec</span>
                    </button>
                  </div>
                </div>
              </template>

              <!-- Constraint editor — full Planguage C. template -->
              <template v-else-if="selectedItem.type === 'constraint'">
                <div class="space-y-3">
                  <div>
                    <div class="flex items-center gap-1 mb-0.5">
                      <PlanguageParamLabel param-key="Description" wrapper-class="mb-0" />
                      <SourcePin
                        field-name="Description"
                        :field-source="props.spec?.constraints?.find(c => c.id === selectedItem.id)?.fieldSources?.['description'] ?? null"
                      />
                    </div>
                    <textarea v-model="editDescription" rows="2" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-red-300 focus:outline-none resize-none" :title="`Constraint description — the binary rule that is either violated or not for ${selectedItem.id}`" placeholder="e.g. Must comply with GDPR at all times" />
                  </div>
                  <div>
                    <div class="flex items-center gap-1 mb-0.5">
                      <PlanguageParamLabel param-key="Scope" wrapper-class="mb-0" />
                      <SourcePin
                        field-name="Scope"
                        :field-source="props.spec?.constraints?.find(c => c.id === selectedItem.id)?.fieldSources?.['scope'] ?? null"
                      />
                    </div>
                    <textarea v-model="editScope" rows="2" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-red-300 focus:outline-none resize-none" title="What does this constraint apply to?" placeholder="e.g. All EU-resident user data processing operations" />
                  </div>
                  <div>
                    <div class="flex items-center gap-1 mb-0.5">
                      <PlanguageParamLabel param-key="Rationale" wrapper-class="mb-0" />
                      <SourcePin
                        field-name="Rationale"
                        :field-source="props.spec?.constraints?.find(c => c.id === selectedItem.id)?.fieldSources?.['rationale'] ?? null"
                      />
                    </div>
                    <textarea v-model="editRationale" rows="2" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-red-300 focus:outline-none resize-none" title="Why does this constraint exist — the regulation, principle, or risk behind it?" placeholder="e.g. EU GDPR Article 44 prohibits data transfer outside EEA" />
                  </div>
                  <div>
                    <div class="flex items-center gap-1 mb-0.5">
                      <PlanguageParamLabel param-key="Source" wrapper-class="mb-0" />
                      <SourcePin
                        field-name="Source"
                        :field-source="props.spec?.constraints?.find(c => c.id === selectedItem.id)?.fieldSources?.['sourceField'] ?? null"
                      />
                    </div>
                    <textarea v-model="editSource" rows="2" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-red-300 focus:outline-none resize-none" title="The authoritative source mandating this constraint" placeholder="e.g. GDPR Art.44; Legal Team 2026-01-15" />
                  </div>
                  <div>
                    <PlanguageParamLabel param-key="Level" />
                    <input v-model="editLevel" type="text" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-slate-300 focus:outline-none" title="Planguage level" placeholder="e.g. 1" />
                  </div>
                  <!-- ─ Additional Planguage parameters ─ -->
                  <div class="border-t border-slate-100 pt-3 space-y-3">
                    <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Additional Planguage Parameters</div>
                    <div>
                      <PlanguageParamLabel param-key="Stakeholders" />
                      <textarea v-model="editStakeholders" rows="2" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-slate-300 focus:outline-none resize-none" title="Stakeholders who imposed or are bound by this Constraint" placeholder="e.g. Legal Team, GDPR Officer" />
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                      <div>
                        <PlanguageParamLabel param-key="Spec Owner" />
                        <input v-model="editSpecOwner" type="text" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-slate-300 focus:outline-none" title="Who is responsible for monitoring compliance with this constraint" placeholder="e.g. Compliance Officer" />
                      </div>
                      <div>
                        <PlanguageParamLabel param-key="Version / Date" />
                        <input v-model="editVersion" type="text" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-slate-300 focus:outline-none" title="Version or date-time stamp of this spec entry" placeholder="e.g. v1.2 · 2026-06-09" />
                      </div>
                    </div>
                    <div>
                      <PlanguageParamLabel param-key="Justification" />
                      <textarea v-model="editJustification" rows="2" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-slate-300 focus:outline-none resize-none" title="Why this Constraint is in the spec" placeholder="Why this boundary is non-negotiable — regulation, risk, or principle" />
                    </div>
                    <div>
                      <PlanguageParamLabel param-key="Risks / Issues" />
                      <textarea v-model="editRisksIssues" rows="2" class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-slate-300 focus:outline-none resize-none" title="Known risks or issues associated with this constraint" placeholder="Risks of constraint violation, compliance monitoring issues, etc." />
                    </div>
                  </div>
                  <div class="flex gap-2">
                    <button class="flex-1 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white text-sm font-semibold transition-colors" title="Apply all changes to this Constraint entry in the spec" @click="applyItemEdits()">
                      Apply Changes
                    </button>
                    <button class="px-4 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-sm font-semibold border border-red-200 transition-colors" title="Delete this Constraint — CAUTION: removing a constraint relaxes the plan boundary" @click="deleteSelectedEntry">
                      Delete
                    </button>
                  </div>
                  <p class="text-[11px] text-amber-600">⚠ Deleting a Constraint relaxes the plan boundary — record the reason in Governance notes.</p>
                  <!-- Bottom nav mirror — DD-014 -->
                  <div class="border-t border-dashed pt-3 mt-1 flex justify-end"
                       :style="{ borderColor: selectedSector ? SECTOR_COLORS[selectedSector].stroke + '44' : '#cbd5e1' }">
                    <button class="flex flex-col items-center gap-0.5 px-3 py-1 rounded hover:bg-slate-100 transition-colors"
                            :style="selectedSector ? { color: SECTOR_COLORS[selectedSector].stroke } : { color: '#64748b' }"
                            title="Summary Spec — return to all sector cards"
                            @click="autoSaveAndDeselect()">
                      <ExitGlyph size="compact" />
                      <span class="text-[9px] font-bold tracking-widest uppercase">Summary Spec</span>
                    </button>
                  </div>
                </div>
              </template>

              <!-- Fallback: Evo Step / Task / unknown — not directly editable here -->
              <template v-else>
                <p class="text-xs text-slate-500 italic">
                  {{ selectedItem.type === 'evo-step' ? 'Evo Steps are defined in the Evo Planner — manage via Evo Tools.' : '' }}
                  {{ selectedItem.type === 'task'     ? 'Tasks are managed in the Evo Planner task breakdown.' : '' }}
                </p>
              </template>
            </template>
          </div>
        </div>

        <!-- ── PentaOptima Command Bar (collapsible) ─────────────────────── -->
        <div class="border-t border-slate-200 shrink-0">
          <!-- Toggle strip -->
          <button
            class="w-full flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            :title="optimaOpen ? 'Collapse PentaOptima — click to hide sliders and command bar' : 'Expand PentaOptima — direct scaling sliders + natural-language command builder for Claudian'"
            @click="toggleOptima"
          >
            <span class="text-amber-500">⚡</span>
            <span>PentaOptima — Natural Language Commands</span>
            <span class="ml-auto text-slate-400 text-xs">{{ optimaOpen ? '▲' : '▼' }}</span>
          </button>

          <template v-if="optimaOpen">
            <ScrollContainer
              outer-class="relative"
              inner-class="px-5 pb-5 pt-2 space-y-4"
              inner-style="max-height: min(52vh, 580px)"
              fade-from="white"
            >

              <!-- ── Direct Scaling Sliders ─────────────────────────────── -->
              <!-- Tom 2026-06-09: "should the sliders work?" — YES, sliders are here now.
                   These apply immediately to the live spec without needing Claudian.
                   Use the NLP command builder below for more complex Claudian-guided changes. -->
              <div class="bg-white rounded-lg border border-slate-200 p-3 space-y-4">
                <p class="text-xs font-bold text-slate-700">Direct Spec Scaling — Instant Apply</p>

                <!-- Value Goal Scale slider -->
                <div>
                  <div class="flex justify-between items-center text-xs mb-1.5">
                    <label
                      class="font-semibold text-violet-800"
                      title="Scale all Value Goal levels by this percentage. 100% = no change. 120% raises all Goals by 20%. 80% reduces all Goals by 20%."
                    >Value Goal Scale</label>
                    <span class="font-mono font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded border border-violet-200">{{ optimaValueScale }}%</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="200"
                    step="5"
                    v-model.number="optimaValueScale"
                    class="w-full h-2 rounded-full cursor-pointer accent-violet-600"
                    title="Drag to set Value Goal scale — 50% halves Goals, 200% doubles them. Press Apply to write to spec."
                    @click.stop
                  />
                  <div class="flex items-center gap-2 mt-2">
                    <button
                      class="text-xs px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      :disabled="isLocked"
                      :title="isLocked ? 'Spec is locked — unlock in the footer to apply changes' : 'Apply Value Goal scale to all Value entries in the spec'"
                      @click.stop="applyValueScale"
                    >
                      Apply ({{ optimaValueScale }}%)
                    </button>
                    <button
                      class="text-xs px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium transition-colors border border-slate-300"
                      title="Reset Value Goal scale to 100% (no change)"
                      @click.stop="optimaValueScale = 100"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                <!-- Resource Budget Scale slider -->
                <div>
                  <div class="flex justify-between items-center text-xs mb-1.5">
                    <label
                      class="font-semibold text-purple-800"
                      title="Scale all Resource Budget levels by this percentage. 100% = no change. 80% cuts all budgets by 20%. 150% increases all budgets by 50%."
                    >Resource Budget Scale</label>
                    <span class="font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">{{ optimaResourceScale }}%</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="200"
                    step="5"
                    v-model.number="optimaResourceScale"
                    class="w-full h-2 rounded-full cursor-pointer accent-purple-600"
                    title="Drag to set Resource Budget scale — 50% halves all budgets, 200% doubles them. Press Apply to write to spec."
                    @click.stop
                  />
                  <div class="flex items-center gap-2 mt-2">
                    <button
                      class="text-xs px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      :disabled="isLocked"
                      :title="isLocked ? 'Spec is locked — unlock in the footer to apply changes' : 'Apply Resource Budget scale to all Resource entries in the spec'"
                      @click.stop="applyResourceScale"
                    >
                      Apply ({{ optimaResourceScale }}%)
                    </button>
                    <button
                      class="text-xs px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium transition-colors border border-slate-300"
                      title="Reset Resource Budget scale to 100% (no change)"
                      @click.stop="optimaResourceScale = 100"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>

              <!-- ── Claudian NLP Command Builder ───────────────────────── -->
              <div class="border-t border-slate-100 pt-3">
                <p class="text-xs font-bold text-slate-600 mb-2">Claudian Command Builder — Natural Language</p>
              </div>

              <!-- Preset command chips (MOVE — all visible) -->
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="preset in PRESET_COMMANDS"
                  :key="preset.cmd.type + preset.label"
                  class="text-xs px-3 py-1 rounded-full border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 transition-colors"
                  :title="`Use preset: ${preset.label}`"
                  @click="usePreset(preset.cmd)"
                >
                  {{ preset.label }}
                </button>
              </div>

              <!-- Free-form command input -->
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">
                  Custom command (natural language)
                </label>
                <textarea
                  v-model="optimaInput"
                  rows="2"
                  class="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-amber-300 focus:outline-none resize-none"
                  placeholder="e.g. Reduce Capex by 50%, Increase Project Duration by 3 months…"
                  title="Describe the change you want Claudian to apply to this spec"
                />
              </div>

              <!-- Build prompt button -->
              <button
                class="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-800 text-white text-sm font-semibold transition-colors"
                title="Build a structured Claudian prompt from your command — then copy to Claudian"
                @click="buildPromptFromInput"
              >
                Build Claudian Prompt
              </button>

              <!-- Claudian prompt (read-only) -->
              <template v-if="optimaPrompt">
                <div>
                  <label class="block text-xs font-semibold text-slate-600 mb-1">
                    Claudian prompt (copy → paste into Claude Code)
                  </label>
                  <textarea
                    :value="optimaPrompt"
                    readonly
                    rows="6"
                    class="w-full text-xs font-mono border border-slate-200 rounded bg-slate-50 px-2 py-1 resize-none text-slate-700 focus:outline-none"
                    title="Claudian prompt — copy this and paste into your Claude Code terminal"
                  />
                </div>
                <button
                  class="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
                  title="Copy the Claudian prompt to clipboard — then paste in Claude Code terminal"
                  @click="copyPrompt"
                >
                  <span>{{ optimaCopied ? 'Copied ✓' : 'Copy to Claudian' }}</span>
                </button>
              </template>

              <!-- Claudian response paste area -->
              <template v-if="optimaPrompt">
                <div>
                  <label class="block text-xs font-semibold text-slate-600 mb-1">
                    Paste Claudian's Planguage Representation response here
                  </label>
                  <textarea
                    v-model="optimaResponse"
                    rows="5"
                    class="w-full text-xs font-mono border border-slate-300 rounded bg-white px-2 py-1 resize-none focus:ring-2 focus:ring-blue-300 focus:outline-none"
                    placeholder='{"changes": [{"entryId": "V.x", "field": "goal", "newValue": "99", "rationale": "…"}], …}'
                    title="Paste Claudian's Planguage Representation response here, then click Apply"
                  />
                </div>
                <button
                  class="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  :disabled="isLocked"
                  :title="isLocked ? 'Spec is locked — unlock in the footer to apply changes' : 'Parse Claudian\'s Planguage Representation response and apply the changes to the spec'"
                  @click="applyClaudianResponse"
                >
                  Apply Claudian Response
                </button>
              </template>

              <!-- OPTIMA bottom collapse — MOVE / DD-014: close from bottom without scrolling up -->
              <div class="border-t border-slate-100 pt-3 pb-1 flex justify-center">
                <button
                  type="button"
                  title="Collapse OPTIMA — close this section (same as clicking the OPTIMA header toggle)"
                  class="text-xs px-4 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium transition-colors border border-slate-200"
                  @click.stop="toggleOptima"
                >▲ Collapse OPTIMA</button>
              </div>
            </ScrollContainer>
          </template>
        </div>

        <!-- ── Penta Governance Panel (version control + cascade overlay) ── -->
        <PentaGovernancePanel
          :open="showGovernance"
          :plan-id="planId"
          :spec="spec"
          :pending-changes="pendingChanges"
          :versions="versions"
          @close="showGovernance = false"
          @restore-spec="(snapshot) => emit('update-spec', snapshot as SpecBlock)"
          @save-version="(label, notes) => spec && saveVersion(label, notes, spec)"
          @approve="approveVersion"
          @reject="rejectVersion"
          @integrate="integrateVersion"
          @delete="deleteVersion"
          @declare-not-calculated="declareCascadeNotCalculated"
          @update-impact="({ versionId, impactId, notes }) => updateImpactNote(versionId, impactId, notes)"
          @set-impact-status="({ versionId, impactId, status }) => setImpactStatus(versionId, impactId, status)"
        />

        <!-- ── Efficiency Insight Panel (Tom 2026-06-10: in-depth + computation basis + So What) ── -->
        <EfficiencyInsightPanel
          v-if="efficiencyInsightOpen && pentaModel"
          :penta-model="pentaModel"
          @close="efficiencyInsightOpen = false"
        />

        <!-- ── Footer: Standard Done-Changing Close Process ────────────────── -->
        <SpecActionFooter
          :change-count="_changesSinceSnapshot"
          :last-saved="_lastSaved"
          :is-locked="isLocked"
          @close="handleClose"
          @save-version="handleSaveVersion"
          @toggle-lock="isLocked ? unlock() : lock()"
        />
        <!-- Citation + efficiency score (slim strip below action footer) -->
        <div class="flex items-center gap-3 px-5 py-1.5 bg-slate-100 border-t border-slate-200 text-[10px] text-slate-400 shrink-0 flex-wrap">
          <span>Penta Model © Tom Gilb &amp; Al Shalloway 2022 · CE Design chapter</span>
          <template v-if="pentaModel">
            <span>·</span>
            <span
              v-for="sectorId in PENTA_SECTOR_ORDER"
              :key="sectorId"
              class="px-1.5 py-0.5 rounded"
              :style="{ backgroundColor: SECTOR_COLORS[sectorId].bg, color: SECTOR_COLORS[sectorId].text }"
            >{{ sectorDisplayLabel(sectorId) }}: {{ pentaModel.sectors[sectorId].items.length }}</span>
            <span>·</span>
            <span :class="['px-2 py-0.5 rounded-full font-semibold border text-[10px]', efficiencyBadgeClass(pentaModel.efficiency.grade)]">
              Efficiency {{ fmtBalance(pentaModel.efficiency.balancePercent) }} — {{ pentaModel.efficiency.grade }}
            </span>
          </template>
        </div>
      </div>
    </template>

    <!-- Hover HoverHint -->
    <Teleport to="body">
      <div
        v-if="hoveredItem"
        class="fixed z-[700] pointer-events-none bg-slate-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl max-w-xs"
        :style="{ left: tooltipPos.x + 'px', top: tooltipPos.y + 'px' }"
      >
        <div class="font-semibold mb-0.5">{{ hoveredItem.label }}</div>
        <div class="text-slate-300 text-[11px]">{{ hoveredItem.description }}</div>
        <div v-if="hoveredItem.goal != null" class="mt-1 text-[11px] text-slate-300">
          Goal: {{ hoveredItem.goal }}<span v-if="hoveredItem.status != null"> · Status: {{ hoveredItem.status }}</span>
        </div>
        <div v-if="hoveredItem.budget != null" class="mt-1 text-[11px] text-slate-300">
          Budget: {{ hoveredItem.budget }}<span v-if="hoveredItem.consumed != null"> · Consumed: {{ hoveredItem.consumed }}</span>
        </div>
        <!-- Evo Step hover extras -->
        <div v-if="hoveredItem.type === 'evo-step'" class="mt-1 text-[11px] text-orange-300">
          <span v-if="hoveredItem.effortPercent != null">Effort: {{ hoveredItem.effortPercent }}%</span>
          <span v-if="hoveredItem.linkedSolutions?.length"> · Links: {{ hoveredItem.linkedSolutions.join(', ') }}</span>
        </div>
        <!-- Task hover extras -->
        <div v-if="hoveredItem.type === 'task'" class="mt-1 text-[11px] text-orange-300">
          <span v-if="hoveredItem.effortHours != null">{{ hoveredItem.effortHours }}h</span>
          <span v-if="hoveredItem.assignee"> · {{ hoveredItem.assignee }}</span>
          <span v-if="hoveredItem.parentStep" class="block text-[10px] text-slate-400">Step: {{ hoveredItem.parentStep }}</span>
        </div>
        <div class="mt-1 text-amber-300 text-[10px]">Click to view · Double-click for detailed icon info</div>
      </div>
    </Teleport>

    <!-- Sector hover HoverHint — short definition of the hovered sector label band -->
    <Teleport to="body">
      <div
        v-if="hoveredSector && !hoveredItem"
        class="fixed z-[700] pointer-events-none bg-slate-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl max-w-xs"
        :style="{ left: hoveredSectorPos.x + 'px', top: hoveredSectorPos.y + 'px' }"
      >
        <div class="font-semibold mb-0.5 text-amber-300">{{ SECTOR_COLORS[hoveredSector].label }}</div>
        <div class="text-slate-200 text-[11px] leading-snug">{{ PENTA_SECTOR_DEEP_INFO[hoveredSector].shortDef }}</div>
        <div class="mt-1.5 text-amber-300 text-[10px]">1 click → display specs on right · Double-click → full sector info</div>
      </div>
    </Teleport>
  </Teleport>
</template>
