<!-- UNIT_TYPE=Widget -->
<!-- Feature #196 — Spec Editor
     Full-screen editor for F., V., S. Planguage entries.
     Three edit levels: 1 = Descriptions · 2 = + Metrics · 3 = Full Planguage.
     Two modes: Draft (saved Edit Version) vs Master (commits back to parent).
     Connected to Plan Targets — editor can be opened for a specific target.
-->
<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
// r41 v239 (Tom Gilb 2026-06-21 verbatim "please drop those V1 V2 tags forever").
// Planguage Mnemonic ID Standard SUPREME — render mnemonic tag derived from
// description when stored id is a banned V1/V2/F1/S1/C1 sequential form.
import { mnemonicLabel } from '../composables/usePenta'
import ScrollContainer from './ScrollContainer.vue'
import SpecActionFooter from './SpecActionFooter.vue'
import CloseDot from './CloseDot.vue'
import ConceptHint from './ConceptHint.vue'
// r41 v298 (Tom Gilb 2026-06-23 verbatim "stages row and others not present, and
// no clarity in what to do and how to progress").  Mount the universal stage
// strip + agents strip + Stage 2 sub-step strip INSIDE the editor chrome so the
// planner never loses orientation when the editor occludes the canvas behind it.
// Composes with: Stages-are-Cyclic SUPREME (every stage reachable from every
// surface), No-Silent-Removal-of-Permanent-Surfaces SUPREME (strips were missing,
// now restored), MOVE Principle SUPREME (orientation visible at-a-glance), DD-009
// Zero-Training UI, No-Silent-Data-Loss SUPREME (auto-save before close-and-navigate).
import PlanningStageBar from './PlanningStageBar.vue'
import AgentsStrip from './AgentsStrip.vue'
import Stage2SubStepStrip from './Stage2SubStepStrip.vue'
import type { Stage2SubStepKey } from '../data/stage2SubSteps'
import type { AgentRegistryId } from '../composables/useAgentRegistry'
// DD-001 (2026-05-13) — Save glyph replaces 💾 floppy disc.
import SaveGlyph from './icons/SaveGlyph.vue'
// DD-011 (2026-06-02) — Planguage Spec Field Icons replace generic emoji on field labels.
import PlSpecFieldIcon from './icons/PlSpecFieldIcon.vue'
import EditGlyph from './icons/EditGlyph.vue'
import PriorityActionButton from './PriorityActionButton.vue'
import ValueFlowDiagram from './ValueFlowDiagram.vue'
import {
  useSpecEditor,
  EDIT_LEVEL_LABELS,
  EDIT_LEVEL_HINTS,
  type EditLevel,
  type EditMode,
} from '../composables/useSpecEditor'
import type { SpecBlock } from '../types/spec'
import { incrementManualEditCount, useSpecModel } from '../composables/useSpecModel'
import { recordEditProvenance } from '../composables/useEntryProvenance'
import { CONCEPT_HINTS } from '../data/conceptHints'
import { useEvoPlan } from '../composables/useEvoPlan'
import { useDraftValueSpec, type DraftResult } from '../composables/useDraftValueSpec'
import { isValueIncomplete, missingFieldsLabel } from '../utils/specHelpers'
import { useSpecLock } from '../composables/useSpecLock'

// ── Edit Depth icon + short-label lookup ──────────────────────────────────────
// Supplementary metadata for the rich depth-picker dropdown.
// Tom 2026-05-16: "a click on it should give a rich symbol laden menu, no 1 2 3.
//                  hovering should give a short sample of the options."
const EDIT_LEVEL_ICONS: Record<EditLevel, string> = {
  1: '✏️',  // pencil — text descriptions only
  2: '📐',  // ruler  — measurable targets (scale, meter, goal…)
  3: '🔭',  // telescope — full Planguage depth (IDs, links, all fields)
}

const EDIT_LEVEL_SHORT: Record<EditLevel, string> = {
  1: 'Describe',
  2: 'Measure',
  3: 'Full',
}

// ── Type-specific per-entry row metadata ──────────────────────────────────────
// Tom 2026-05-17: "the glyph is not easy to read / more colorful glyphs we planned."
// Each tab's per-entry EDIT button uses the Planguage keyed-glyph text + type colour.
const ENTRY_TYPE_META: Record<string, { glyph: string; color: string; bg: string }> = {
  functions:   { glyph: '→O→',   color: '#16a34a', bg: '#f0fdf4' },
  values:      { glyph: '0▸✳',  color: '#7c3aed', bg: '#f5f3ff' },
  solutions:   { glyph: '[✳]→',  color: '#ea580c', bg: '#fff7ed' },
  constraints: { glyph: '[→O→]', color: '#dc2626', bg: '#fef2f2' },
}

// ── Props / Emits ─────────────────────────────────────────────────────────────

const props = defineProps<{
  spec: SpecBlock
  initialTargetId?:   string
  initialTargetName?: string
  initialMode?:       EditMode
  initialLevel?:      EditLevel
  /** Pre-select a tab when the editor opens from an edit button */
  initialTab?:        'functions' | 'values' | 'solutions' | 'constraints' | 'versions'
  /** Pre-expand a specific entry by ID when the editor opens from a per-entry edit button */
  initialEntryId?:    string
  /**
   * When set, the editor was opened by clicking a node in the Value Flow diagram.
   * A "Back to Value Flow Diagram" strip appears below the header so the user
   * can navigate back without losing their place.
   * Tom 2026-05-15: "I need a path back to the diagram — a miniature picture of
   * the real diagram, texts Back to Value Flow Diagram."
   */
  returnTo?: 'visualise' | 'valueFlow'
  /**
   * Current planning stage (1–11) from App.vue.
   * Drives the stage navigation strip shown below the editor header so the
   * user can see where they are in the planning cycle and navigate without
   * closing the editor.
   * Tom 2026-05-28: "the always in title nd step 1-11 are gone" (when Spec
   * Editor is open, the stage bar in the main content is hidden behind this
   * full-screen panel — this prop + nav strip replaces it inside the editor).
   */
  planningStage?: number
  /** r41 v298 — live spec-presence map for AgentsStrip gating.  Same shape as
   *  the canvas mount in App.vue.  Defaults safely if not provided. */
  specPresence?: Partial<Record<string, boolean>>
  /** r41 v298 — current Stage 2 sub-step (only used when planningStage === 2). */
  stage2SubStep?: Stage2SubStepKey
  /** r41 v298 — list of completed Stage 2 sub-steps for the sub-step strip. */
  stage2DoneSteps?: Stage2SubStepKey[]
  /** r41 v298 — has-plan flag for PlanningStageBar tile gating. */
  hasPlan?: boolean
}>()

const emit = defineEmits<{
  close:            []
  'commit-master':  [SpecBlock]
  /** Tom 2026-05-13: "Global Priority is only in Actions, it needs to be a
   *  button in Sharpening and in Editing and maybe other places." App.vue
   *  flips `globalPriorityOpen` to true; the exclusive-surface rule auto-closes
   *  this editor as the priority panel opens. */
  'open-global-priority': []
  /** Open the "About the Priority Glyph" info modal (DD-002, 2026-05-14 split-button) */
  'open-priority-info': []
  /** Open the "About the Edit Glyph" info modal */
  'open-edit-info': []
  /**
   * User clicked "Back to Value Flow Diagram". App.vue closes this panel and
   * reopens the originating diagram surface (VisualisePanelModal or ValueFlowPanel).
   */
  'back-to-value-flow': []
  /**
   * r41 v240 (Tom Gilb 2026-06-21 verbatim "no export") — Export pin in the toolbar.
   * App.vue passes the working SpecBlock through useColorfulSpecHtml + opens Mail per
   * Auto-Open Email SUPREME + Export-button-on-all-windows SUPREME.
   */
  'export-spec': [SpecBlock]
  /**
   * User clicked "◈ Flow" on a specific entry, or "🌊 All" on a tab.
   * App.vue closes the editor, highlights the entry (if entryId set) and opens
   * VisualisePanelModal on the Value Flow tab.
   * Tom 2026-05-16: "Show Value Flow Relation, next to Edit button… applies to F S etc"
   */
  'show-in-value-flow': [{ tab: 'functions' | 'values' | 'solutions'; entryId: string }]
  /**
   * User clicked ⚡ Actions inside the editor.
   * App.vue opens ActionsHubPanel (menuOpen = true).
   * The Single-Surface rule auto-closes the editor when the hub opens.
   */
  'open-actions': []
  /**
   * User clicked ← Back or → Next in the stage navigation strip.
   * App.vue calls handleStageBarNav(n) so planningStage updates and the
   * stage bar outside the editor stays in sync.
   */
  'navigate-stage': [n: number]
  /**
   * r41 v298 (Tom Gilb 2026-06-23) — User clicked an agent pin INSIDE the
   * editor's embedded AgentsStrip.  App.vue closes the editor (auto-saving
   * first via Universal Undo + No-Silent-Data-Loss) and opens the named
   * agent panel.  agentId matches AgentRegistryId so App.vue routes through
   * the existing open-* handlers.
   */
  'open-agent': [agentId: AgentRegistryId]
  /**
   * r41 v298 — User clicked a Stage 2 sub-step pill inside the editor.
   * App.vue invokes onStage2SubStepGo(target).  Stage 2 strip is shown only
   * when planningStage === 2.
   */
  'go-stage2-substep': [target: Stage2SubStepKey]
  /**
   * r41 v298 — User clicked "Continue to Stage 3" inside the Stage 2 strip.
   * App.vue invokes onStage2ContinueToStage3().
   */
  'continue-stage2': []
}>()

// ── Stage navigation data (mirrors ValueCounter STAGES labels) ────────────────
// r41 v349 (Tom Gilb 2026-06-25 *"retrograd unasked for change of stages.
// Please revert to what we had, what esle have you screwed up that that fine?"*):
// EDITOR_STAGE_NAMES was a hand-maintained duplicate of canonical
// `PLANNING_STAGES` labels.  It had drifted FIVE stages off (2='Values' vs
// canonical 'Solutions', 3='Solutions' vs 'Sharpen', 4='Sharpen' vs 'Impacts',
// 5='Impacts' vs 'Refine', 10='Plan' vs 'Resources') — a classic Parallel-
// Implementation Drift (Trace-Before-Patch SUPREME).  Now imports the
// canonical labels so any future rename in planningStages.ts propagates here
// automatically and this file can never drift again.
import { PLANNING_STAGES as _CANONICAL_STAGES } from '../data/planningStages'
const EDITOR_STAGE_NAMES: Record<number, string> = Object.fromEntries(
  _CANONICAL_STAGES.map(s => [s.stage, s.label])
)

const currentStageName = computed(() =>
  props.planningStage ? (EDITOR_STAGE_NAMES[props.planningStage] ?? `Stage ${props.planningStage}`) : null
)

// r41 v298 (Tom Gilb 2026-06-23 "no clarity in what to do and how to progress").
// guidanceText computed lives below — it depends on `activeTab` which is
// declared later in <script setup>.  Composes with Stage-Has-A-Purpose SUPREME.

// ── Composables ───────────────────────────────────────────────────────────────

const {
  editVersions,
  workingSpec,
  originalSpec,
  editLevel,
  editMode,
  editName,
  linkedTargetName,
  changedCount,
  hasChanges,
  isChanged,
  getChangedIds,
  getOriginalEntry,
  openEditor,
  updateFEntry,
  updateVEntry,
  updateSEntry,
  updateCEntry,
  addFEntry,
  addVEntry,
  addSEntry,
  addCEntry,
  revertEntry,
  revertAll,
  setEditLevel,
  setEditMode,
  setEditName,
  setLinkedTarget,
  saveEditVersion,
  getSpecForMaster,
  deleteEditVersion,
} = useSpecEditor()

const { currentModel: _planModel } = useSpecModel()

// ── Standard Done-Changing Close Process (DD-standard-close-2026-06-09) ─────
const { isLocked, lock, unlock } = useSpecLock()
/** Timestamp set each time a draft save or master commit completes. */
const _lastSaved = ref<Date | null>(null)

// ── Evo Plan — needed for the live mini-thumbnail in the back-to-diagram strip ──
const { plan: _evoPlan } = useEvoPlan()
const _miniEvoSteps = computed(() => _evoPlan.value?.steps ?? [])

// ── Spec Target options ───────────────────────────────────────────────────────
// Tom 2026-05-15: replace opaque "Any Instance" / Plan-Targets dropdown with a
// plain-English fixed list of who is reading/reviewing this version of the spec.
const SPEC_TARGETS = [
  { id: 'all',           label: 'All',           emoji: '🌐' },
  { id: 'planners',      label: 'Planners',      emoji: '💡' },
  { id: 'reviewers',     label: 'Reviewers',     emoji: '👁' },
  { id: 'auto-checking', label: 'Auto Checking', emoji: '🤖' },
  { id: 'this-app',      label: 'This App',      emoji: '📱' },
  { id: 'novices',       label: 'Novices',       emoji: '🌱' },
  { id: 'none',          label: 'None',          emoji: '–' },
] as const

const othersText = ref('')

// ── Initialise ────────────────────────────────────────────────────────────────

openEditor(props.spec, {
  // r41 v281 (Tom Gilb 2026-06-22 "a moment ago we had great detailed solutions and now we are back to the bad stuff") — default Edit Depth bumped 1 → 3 so all 26 canonical parameters are immediately editable. Levels 1+2 remain as opt-in NARROWING modes for description-only / metrics-only edits.
  level:      props.initialLevel      ?? 3,
  mode:       props.initialMode       ?? 'draft',
  targetId:   props.initialTargetId   ?? '',
  targetName: props.initialTargetName ?? '',
})

// ── Tab ───────────────────────────────────────────────────────────────────────

type TabId = 'functions' | 'values' | 'solutions' | 'constraints' | 'versions'
const activeTab = ref<TabId>(props.initialTab ?? 'functions')

// Pre-expand specific entry when opened from a per-entry edit button

const tabCounts = computed(() => ({
  functions:   workingSpec.value?.functions.length              ?? 0,
  values:      workingSpec.value?.values.length                 ?? 0,
  solutions:   workingSpec.value?.solutions.length              ?? 0,
  constraints: (workingSpec.value?.constraints ?? []).length,
  versions:    editVersions.value.length,
}))

// r41 v298 — guidance-bar computed (declared here so activeTab is in scope).
// Returns the dynamic sentence shown at the bottom of the embedded chrome.
// Composes with Stage-Has-A-Purpose SUPREME.
const guidanceText = computed<string>(() => {
  const stage = props.planningStage ?? 1
  const tab   = activeTab.value
  // Stage 2 — Solutions is the primary lens
  if (stage === 2) {
    if (tab === 'solutions')   return 'Editing Solutions for Stage 2. Generate or refine Solutions that move the Value Targets within Resources and Constraints. Use Save Edit Version to commit, then continue to Stage 3 Sharpen.'
    if (tab === 'values')      return 'Editing Values for Stage 2. Each Value needs Scale, Meter, Tolerable, Goal and Qualifiers. Avoid the Infinity Trap — bound every level with when, where, who.'
    if (tab === 'functions')   return 'Editing Functions for Stage 2. Functions are BINARY (present or absent). Put quality thresholds on linked Values, not Functions.'
    if (tab === 'constraints') return 'Editing Constraints for Stage 2. Constraints are HARD rules (binary pass or fail). The qualifier — under what conditions — is critical.'
    if (tab === 'versions')    return 'Edit Versions for Stage 2. Each saved version is a snapshot; restore one to roll back to it via Universal Undo.'
  }
  // Other stages — generic guidance
  const stageName = EDITOR_STAGE_NAMES[stage] ?? `Stage ${stage}`
  if (tab === 'versions') return `Edit Versions list for ${stageName}. Saved versions roll back via Universal Undo.`
  const typed: Record<string, string> = {
    functions:   `Editing Functions in ${stageName}. Functions are BINARY (present or absent).`,
    values:      `Editing Values in ${stageName}. Each Value needs Scale, Meter, Tolerable, Goal and Qualifiers.`,
    solutions:   `Editing Solutions in ${stageName}. Each Solution has a Description, Derived From, Main Impacts and Risks.`,
    constraints: `Editing Constraints in ${stageName}. Constraints are HARD rules; qualifiers bound their scope.`,
  }
  return typed[tab] ?? `Editing the spec at ${stageName}.`
})

// r41 v298 — spec-presence default (so AgentsStrip can grey-out unmet prerequisites
// even if App.vue does not pass an explicit presencePresence prop).
const computedSpecPresence = computed(() => {
  if (props.specPresence) return props.specPresence
  const w = workingSpec.value
  return {
    spec:         !!w,
    stakeholders: (w?.stakeholders?.length ?? 0) > 0,
    values:       (w?.values?.length ?? 0) > 0,
    functions:    (w?.functions?.length ?? 0) > 0,
    solutions:    (w?.solutions?.length ?? 0) > 0,
    resources:    (w?.resources?.length ?? 0) > 0,
  } as Partial<Record<string, boolean>>
})

// r41 v298 — handlers for the embedded chrome.  Per No-Silent-Data-Loss SUPREME,
// auto-save via handleSaveDraft (draft mode) or commit-master (master mode) before
// the editor unmounts.  Then emit the navigation event.  App.vue closes the editor
// via its standard close handler when it transitions stages / opens an agent panel.
function autoSaveBeforeNavigate(): void {
  try {
    if (editMode.value === 'master' && hasChanges.value) {
      // Master mode — commit silently; App.vue's commit-master handler closes editor.
      const spec = getSpecForMaster()
      if (spec) emit('commit-master', spec)
    } else if (editMode.value === 'draft' && hasChanges.value) {
      // Draft mode — persist the Edit Version so unsaved typing is not lost.
      saveEditVersion()
    }
  } catch { /* never block navigation */ }
}
function onEmbeddedStageNav(n: number): void {
  autoSaveBeforeNavigate()
  emit('navigate-stage', n)
}
function onEmbeddedAgentOpen(agentId: AgentRegistryId): void {
  autoSaveBeforeNavigate()
  emit('open-agent', agentId)
}
function onEmbeddedStage2Go(target: Stage2SubStepKey): void {
  autoSaveBeforeNavigate()
  emit('go-stage2-substep', target)
}
function onEmbeddedStage2Continue(): void {
  autoSaveBeforeNavigate()
  emit('continue-stage2')
}

// ── Expanded cards ────────────────────────────────────────────────────────────

const expandedId  = ref<string | null>(props.initialEntryId ?? null)
const keptFlash   = ref(new Set<string>())   // IDs showing "✓ Kept" briefly after collapse
const showSafetyBanner = ref(true)           // Safety Net Banner — uncommitted changes reminder

// ── AI Draft Value Specs ──────────────────────────────────────────────────────
const { draftOne: draftValueOne, draftAllIncomplete, loading: draftLoading } = useDraftValueSpec()
const draftingEntryId = ref<string | null>(null)              // Which entry is currently drafting
const draftResults = ref<Map<string, DraftResult>>(new Map()) // Per-entry draft results
const bulkDraftResults = ref<Map<string, DraftResult>>(new Map()) // Bulk draft results
const showBulkReview = ref(false)                              // Show bulk review modal
const activeDraftTab = ref<'single' | 'bulk'>('single')        // Which draft panel is active

function toggleExpand(id: string): void {
  if (expandedId.value === id) {
    // Collapsing — if entry was changed, flash "✓ Kept" for 2s
    if (isChanged(id)) {
      keptFlash.value = new Set(keptFlash.value).add(id)
      setTimeout(() => {
        const next = new Set(keptFlash.value)
        next.delete(id)
        keptFlash.value = next
      }, 2000)
    }
    expandedId.value = null
  } else {
    expandedId.value = id
  }
}

// Tom 2026-05-15: "no invite to edit else" — after closing an edited entry,
// auto-open the next entry in the same tab so the user immediately sees there's
// more to review. If this was the last entry, nothing extra happens.
function doneEntry(id: string): void {
  toggleExpand(id)
  const entries: Array<{ id: string }> =
    activeTab.value === 'functions'   ? (workingSpec.value?.functions    ?? []) :
    activeTab.value === 'values'      ? (workingSpec.value?.values       ?? []) :
    activeTab.value === 'solutions'   ? (workingSpec.value?.solutions    ?? []) :
    (workingSpec.value?.constraints ?? [])
  const idx = entries.findIndex(e => e.id === id)
  if (idx >= 0 && idx < entries.length - 1) {
    nextTick(() => { expandedId.value = entries[idx + 1].id })
  }
}

function isExpanded(id: string): boolean {
  return expandedId.value === id
}

// r41 v239 (Tom Gilb 2026-06-21 — Planguage Mnemonic ID Standard SUPREME).
// Helper for the entry-row tag — drops banned V1/V2/F1/S1/C1 sequential IDs in
// favour of the first significant phrase of the description (e.g. "Portfolio
// Net Worth" instead of "V1"). When the stored id is already a real mnemonic
// (e.g. "Onboarding Speed"), it passes through unchanged.
function entryTag(entry: { id: string; description?: string }): string {
  return mnemonicLabel(entry.id, entry.description ?? '')
}

// Strip the leading "Mnemonic: " or "Mnemonic — " prefix from the description
// when it duplicates the derived tag (otherwise the row reads
// "Portfolio Net Worth | Portfolio Net Worth: Total market value …").
function entryBody(entry: { id: string; description?: string }): string {
  const desc = entry.description ?? ''
  const tag = entryTag(entry)
  const m = desc.match(/^([^:—\n]+)([:—])\s*(.*)$/)
  if (m && m[1].trim().toLowerCase() === tag.trim().toLowerCase()) return m[3]
  return desc
}

/** Add a blank entry to the active tab, then auto-expand and scroll to it. */
function handleAddEntry(tab: 'functions' | 'values' | 'solutions' | 'constraints'): void {
  const id =
    tab === 'functions'   ? addFEntry()  :
    tab === 'values'      ? addVEntry()  :
    tab === 'solutions'   ? addSEntry()  :
    addCEntry()
  if (!id) return
  // expandedId watcher handles focus; nextTick ensures the new card is in the DOM first
  nextTick(() => { expandedId.value = id })
}

// Auto-expand first entry when switching tabs
watch(activeTab, () => { expandedId.value = null })

// Tom 2026-05-15 general rule: "when the thing to fill out appears, the window
// to fill in does NOT. The window should display with blinking cursor immediately."
// Whenever a card expands (expandedId changes to a non-null value), focus the
// first EMPTY editable field in that card (Description is almost always pre-filled
// by the AI, so focus naturally lands on Wish / Impact / Goal / etc.).
// Falls back to the first field overall when everything already has content.
// requestAnimationFrame ensures we fire AFTER the button click's own focus event —
// without it the browser re-focuses the clicked header button after our .focus() call.
// Handles BOTH direct click-to-expand AND the auto-advance from doneEntry().
// { immediate: true } — fires on initial mount when initialEntryId pre-sets expandedId.
// Without it, the watch only fires on user-click expansions, so entries opened directly
// from the Value Flow diagram (where expandedId is set during setup, not via a click)
// render as visually expanded but without the auto-focus activation, making the form
// fields appear inert until the user closes and reopens the entry manually.
// Bug report: Tom 2026-05-16 — "the top spec was open but I could not edit it until
// I closed and opened again."
watch(expandedId, (newId) => {
  if (!newId) return
  nextTick(() => {
    requestAnimationFrame(() => {
      const card = document.querySelector(`[data-entry-id="${newId}"]`)
      if (!card) return
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      const fields = Array.from(
        card.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
          'textarea:not([disabled]), input[type="text"]:not([disabled])'
        )
      )
      const firstEmpty = fields.find(el => el.value.trim() === '')
      ;(firstEmpty ?? fields[0])?.focus()
    })
  })
}, { immediate: true })

// ── Save / commit actions ─────────────────────────────────────────────────────

const savedFlash = ref(false)
let _flashTimer = 0

function handleSaveDraft(): void {
  // Phase 1 (Sources of Specs) — snapshot changed IDs before save clears state on next openEditor
  const changedIds = getChangedIds()
  const v = saveEditVersion()
  if (!v) return
  // Record human-edit provenance for each entry that changed this session
  if (_planModel.value?.id && changedIds.length > 0 && workingSpec.value && originalSpec.value) {
    recordEditProvenance(_planModel.value.id, changedIds, workingSpec.value, originalSpec.value)
  }
  incrementManualEditCount()  // Planner Consequences tracking — human directly edited the spec
  savedFlash.value = true
  _lastSaved.value = new Date()   // Done-Changing: record snapshot time for SpecActionFooter badge
  clearTimeout(_flashTimer)
  _flashTimer = window.setTimeout(() => { savedFlash.value = false }, 2500)
}

function handleCommitMaster(): void {
  const spec = getSpecForMaster()
  if (!spec) return
  emit('commit-master', spec)
  _lastSaved.value = new Date()   // Done-Changing: record commit time for SpecActionFooter badge
  emit('close')
}

// ── Close — auto-saves in master mode (Tom 2026-05-15: "save on close") ──────
// In master mode: if there are unsaved changes, commit them automatically
// before closing. Draft mode always just closes (user controls save explicitly).
function handleClose(): void {
  if (editMode.value === 'master' && hasChanges.value) {
    handleCommitMaster()  // already emits 'commit-master' + 'close'
    return
  }
  emit('close')
}

// ── Target picker ─────────────────────────────────────────────────────────────

const targetMenuOpen = ref(false)
const depthMenuOpen  = ref(false)

function pickTarget(id: string, name: string): void {
  setLinkedTarget(id, name)
  targetMenuOpen.value = false
}

// ── Diff display helpers ──────────────────────────────────────────────────────

function originalDesc(id: string): string {
  const orig = getOriginalEntry(id)
  return orig?.description ?? ''
}

// ── AI Draft Value Specs ──────────────────────────────────────────────────────

/**
 * Draft missing fields for a single Value entry.
 * Shows result in inline suggest panel for per-field accept/skip.
 */
async function handleDraftSingleValue(entryId: string): Promise<void> {
  const entry = workingSpec.value?.values.find(v => v.id === entryId)
  if (!entry) return

  draftingEntryId.value = entryId
  try {
    const result = await draftValueOne(entry, workingSpec.value!)
    draftResults.value.set(entryId, result)
    activeDraftTab.value = 'single'
  } catch (err) {
    console.error(`Draft failed for ${entryId}:`, err)
  } finally {
    draftingEntryId.value = null
  }
}

/**
 * Accept a single drafted field with optional uncertainty marker.
 * uncertain=true appends " ?" to indicate provisional value.
 */
function acceptDraftField(
  entryId: string,
  fieldName: 'scale' | 'tolerable' | 'wish',
  uncertain: boolean,
): void {
  const result = draftResults.value.get(entryId)
  if (!result) return

  const idx = workingSpec.value?.values.findIndex(v => v.id === entryId) ?? -1
  if (idx < 0) return

  let value = result[fieldName]
  if (uncertain && value) {
    value = value.endsWith('?') ? value : `${value} ?`
  }

  updateVEntry(idx, { [fieldName]: value })
  draftResults.value.delete(entryId)
}

/**
 * Bulk draft all incomplete Values.
 */
async function handleDraftAllIncomplete(): Promise<void> {
  if (!workingSpec.value) return
  const incompleteCount = workingSpec.value.values.filter(v => isValueIncomplete(v)).length
  if (incompleteCount === 0) return

  try {
    const results = await draftAllIncomplete(workingSpec.value)
    bulkDraftResults.value = new Map(Object.entries(results))
    showBulkReview.value = true
    activeDraftTab.value = 'bulk'
  } catch (err) {
    console.error('Bulk draft failed:', err)
  }
}

/**
 * Accept all drafted fields from bulk review (with optional uncertainty).
 */
function acceptAllDrafts(uncertain: boolean): void {
  for (const [entryId, result] of bulkDraftResults.value.entries()) {
    const idx = workingSpec.value?.values.findIndex(v => v.id === entryId) ?? -1
    if (idx < 0) continue

    const updates: Record<string, string> = {}
    for (const field of ['scale', 'tolerable', 'wish'] as const) {
      let value = result[field]
      if (uncertain && value) {
        value = value.endsWith('?') ? value : `${value} ?`
      }
      updates[field] = value
    }

    updateVEntry(idx, updates)
  }

  bulkDraftResults.value.clear()
  showBulkReview.value = false
}

// ── Edit mode label colours ───────────────────────────────────────────────────

const modeBadge = computed(() =>
  editMode.value === 'master'
    ? 'bg-rose-100 text-rose-700 ring-1 ring-rose-300'
    : 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300'
)

const modeIcon = computed(() => editMode.value === 'master' ? '📝' : '📄')

// ── Save button label ─────────────────────────────────────────────────────────

/** Save-button state machine. Returns one of four shapes so the template
 *  can render the SaveGlyph SVG inline (when in draft-save mode) without
 *  baking emoji into a string. DD-001 (2026-05-13). */
const saveLabelState = computed<{ kind: 'master-commit' | 'master-empty' | 'draft-saved' | 'draft-idle'; text: string }>(() => {
  if (editMode.value === 'master') {
    if (hasChanges.value) {
      return { kind: 'master-commit', text: `✏️ Commit ${changedCount.value} change${changedCount.value !== 1 ? 's' : ''} to Master` }
    }
    return { kind: 'master-empty', text: 'No changes yet' }
  }
  return savedFlash.value
    ? { kind: 'draft-saved', text: '✅ Saved!' }
    : { kind: 'draft-idle', text: 'Save Edit Version' }
})

// ── Reusable field row component (inline via template) ────────────────────────

// (Using template helpers instead of sub-components to avoid file proliferation)
</script>

<template>
  <Teleport to="body">
    <!-- translateZ(0) forces GPU compositing so this layer correctly sits above
         the Plan Crest shimmer animation in Safari (same fix as ContractHub). -->
    <div
      class="fixed inset-0 z-[600] flex flex-col bg-gray-950"
      style="transform: translateZ(0);"
      role="dialog"
      aria-modal="true"
      aria-label="Spec Editor"
    >
      <!-- ── Header ──────────────────────────────────────────────────────────
           r41 v240 (Tom Gilb 2026-06-21 verbatim "there is a close word bottom, but
           not a close button (UPPER RIGHT) and there is no ← Go Back; and no export").
           Three SUPREME-rule fixes in one toolbar:
             • flex-wrap gap-y-2 ensures CloseDot at the end never gets clipped on narrow
               windows — previously the toolbar overflowed off the right edge so CloseDot
               sat invisible past the window margin (CloseDot SUPREME violation in practice).
             • Explicit "← Back to Plan" affordance added LEFT of the Spec Editor label —
               DD-014 Top-and-Bottom Navigation Mirror SUPREME + Tom's verbatim "Go Back".
             • Export pin added in the toolbar's right-cluster — Export-button-on-all-windows
               SUPREME (rule_export_button_on_all_windows.md). -->
      <div class="shrink-0 flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3 bg-gradient-to-r from-indigo-800 to-violet-700 border-b border-indigo-900/60 z-50 relative">
        <!-- ← Back to Plan — Tom 2026-06-21 "no ← Go Back".  Closes editor; semantically
             identical to CloseDot but framed as navigation so users with a back-arrow mental
             model find it instantly. -->
        <button
          type="button"
          class="flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold transition-colors focus:outline-none shrink-0"
          title="← Back to the Plan view (closes the Spec Editor; unsaved Edit Version changes auto-save first)"
          aria-label="Back to Plan view"
          @click="handleClose"
        >
          <span aria-hidden="true" class="text-sm">←</span>
          <span>Back to Plan</span>
        </button>
        <!-- Title -->
        <span class="text-sm font-bold text-white tracking-wide shrink-0 flex items-center gap-1.5">
          <EditGlyph size="compact" class="h-3.5 w-auto shrink-0" aria-hidden="true" /> Spec Editor
          <button
            type="button"
            class="inline-flex items-center justify-center h-4 w-4 rounded-full
                   bg-white/15 text-white/70 text-[9px] font-bold
                   hover:bg-white/25 hover:text-white transition-colors
                   focus:outline-none focus:ring-1 focus:ring-white/60"
            title="About the Edit Glyph — what [*]→[**] means"
            @click="emit('open-edit-info')"
          >?</button>
        </span>

        <!-- Mode toggle — r41 v240 (Tom Gilb 2026-06-21 verbatim "Edit Version did not work,
             and Name Edit Version did not work"). The buttons WERE wired correctly; clicking
             the ACTIVE-mode button is a no-op by design (you're already in that mode). The
             complaint is that the labels read as ACTIONS ("create a new Edit Version"), not
             as MODE INDICATORS. Added explicit HoverHints that name them as mode toggles +
             "MODE:" label prefix above the pair so the semantics are unambiguous at a glance
             per DD-009 Zero-Training UI. -->
        <div class="flex flex-col items-stretch shrink-0">
          <span class="text-[8px] font-semibold uppercase tracking-widest text-white/40 px-1 mb-0.5" aria-hidden="true">Mode</span>
          <div
            class="flex items-center gap-1 rounded-lg bg-black/20 p-0.5"
            role="radiogroup"
            aria-label="Editing mode"
          >
            <button
              type="button"
              role="radio"
              :aria-checked="editMode === 'draft'"
              :title="editMode === 'draft' ? 'CURRENTLY in Edit Version mode — changes save to a DRAFT (not Master Plan). Already active; click Master Plan to switch.' : 'Switch to Edit Version mode — changes save to a draft, leaving the Master Plan untouched.'"
              class="h-7 px-2.5 rounded-md text-[11px] font-semibold transition-all"
              :class="editMode === 'draft'
                ? 'bg-white text-indigo-800 shadow-sm'
                : 'text-white/60 hover:text-white'"
              @click="setEditMode('draft')"
            >📄 Edit Version</button>
            <button
              type="button"
              role="radio"
              :aria-checked="editMode === 'master'"
              :title="editMode === 'master' ? 'CURRENTLY editing Master Plan — changes commit directly. Already active; click Edit Version to switch to draft mode.' : 'Switch to Master Plan mode — changes commit directly to the canonical Master Plan.'"
              class="h-7 px-2.5 rounded-md text-[11px] font-semibold transition-all"
              :class="editMode === 'master'
                ? 'bg-rose-500 text-white shadow-sm'
                : 'text-white/60 hover:text-white'"
              @click="setEditMode('master')"
            >📝 Master Plan</button>
          </div>
        </div>

        <!-- Mode badge (mobile-visible status) — r41 v238 (Tom Gilb 2026-06-21):
             Tom kept clicking the "DRAFT MODE" pill expecting it to do something. It's a
             status indicator, not a button. Adding role+title+aria-label so screen-reader
             + HoverHint identify it as a status indicator and not an affordance, plus
             cursor-default styling so the pointer doesn't change to a pointer-finger. -->
        <span
          role="status"
          :title="(editMode === 'master' ? 'Currently EDITING MASTER (changes commit directly to the Master Plan). Status only — click the Master Plan / Edit Version buttons on the left to switch.' : 'Currently in DRAFT MODE (changes save to an Edit Version, not the Master Plan). Status only — click the Master Plan / Edit Version buttons on the left to switch.')"
          :aria-label="(editMode === 'master' ? 'Status: Editing Master' : 'Status: Draft Mode')"
          :class="['hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 cursor-default select-none', modeBadge]"
        >
          {{ modeIcon }} {{ editMode === 'master' ? 'EDITING MASTER' : 'DRAFT MODE' }}
        </span>

        <!-- Spacer -->
        <div class="flex-1 min-w-0" />

        <!-- Diagrams shortcut — always-visible escape hatch back to the Viz gallery.
             Tom 2026-05-16: "there is no patch back to the value flow diagram or anything there."
             Fires back-to-value-flow; App.vue opens VisualisePanelModal (or ValueFlowPanel if
             the editor was opened directly from the standalone VFD). Subtle so it doesn't compete
             with the back-strip thumbnail that appears when returnTo is set. -->
        <!-- Diagrams escape hatch — always visible. Tom 2026-05-17: "📊 alien, means nothing.
             Clarity in Icons + Clarity in Text principles." Replaced 📊 with ◈ (diagram dot)
             + explicit text "Diagrams"; made brighter and larger so it can't be missed. -->
        <button
          type="button"
          class="flex items-center gap-1.5 h-8 px-2.5 rounded-lg
                 text-white/75 hover:text-white hover:bg-white/15
                 text-[11px] font-semibold transition-colors focus:outline-none shrink-0"
          title="Back to Diagrams — open the Visualise gallery"
          @click="emit('back-to-value-flow')"
        >
          <span aria-hidden="true" style="font-size:14px;line-height:1">◈</span>
          <span class="font-semibold">Diagrams</span>
        </button>

        <!-- Edit Depth — rich symbol-laden dropdown
             Tom 2026-05-16: "a click on it should give a rich symbol laden menu, no 1 2 3.
             hovering should give a short sample of the options." -->
        <div class="relative shrink-0">
          <!-- Trigger: icon + short label + chevron. Hover title = hint + all-options preview. -->
          <button
            type="button"
            class="flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-black/20 hover:bg-black/30 text-white transition-colors focus:outline-none focus:ring-2 focus:ring-white/40"
            :title="`${EDIT_LEVEL_LABELS[editLevel]} — ${EDIT_LEVEL_HINTS[editLevel]}\n\n✏️ Describe  ·  📐 Measure  ·  🔭 Full`"
            @click="depthMenuOpen = !depthMenuOpen"
          >
            <span class="text-base leading-none shrink-0" aria-hidden="true">{{ EDIT_LEVEL_ICONS[editLevel] }}</span>
            <span class="text-[10px] font-semibold text-white/90 hidden sm:inline whitespace-nowrap">{{ EDIT_LEVEL_SHORT[editLevel] }}</span>
            <svg viewBox="0 0 12 12" fill="currentColor" class="h-2.5 w-2.5 shrink-0 text-white/50" aria-hidden="true">
              <path d="M6 8.5L1.5 3h9L6 8.5z"/>
            </svg>
          </button>

          <!-- Rich depth-picker dropdown -->
          <div
            v-if="depthMenuOpen"
            class="absolute right-0 top-full mt-1.5 w-[272px] rounded-xl border border-gray-700 bg-gray-900 shadow-2xl z-30 overflow-hidden"
            role="menu"
            aria-label="Choose edit depth"
          >
            <p class="px-3 pt-2.5 pb-1 text-[9px] font-semibold uppercase tracking-widest text-gray-500">Edit Depth</p>
            <button
              v-for="lv in ([1, 2, 3] as EditLevel[])"
              :key="lv"
              type="button"
              role="menuitem"
              class="flex items-start gap-3 w-full px-3 py-2.5 text-left transition-colors"
              :class="editLevel === lv
                ? 'bg-amber-500/20 text-amber-200'
                : 'text-gray-300 hover:bg-white/[0.08]'"
              @click="setEditLevel(lv); depthMenuOpen = false"
            >
              <span class="text-xl leading-tight shrink-0 mt-0.5" aria-hidden="true">{{ EDIT_LEVEL_ICONS[lv] }}</span>
              <div class="flex-1 min-w-0">
                <p class="text-[12px] font-bold leading-tight">{{ EDIT_LEVEL_LABELS[lv] }}</p>
                <p class="text-[10px] text-gray-400 mt-0.5 leading-snug">{{ EDIT_LEVEL_HINTS[lv] }}</p>
              </div>
              <span v-if="editLevel === lv" class="text-amber-400 text-sm shrink-0 mt-0.5 font-bold" aria-label="active">✓</span>
            </button>
          </div>
        </div>

        <!-- Spec Target — who is reading / reviewing this version of the spec -->
        <div class="relative shrink-0">
          <button
            type="button"
            class="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs transition-colors"
            :title="'Spec Target — who is this spec version for?'"
            @click="targetMenuOpen = !targetMenuOpen"
          >
            <span class="text-[10px] text-white/50 font-medium hidden md:inline">Spec Target</span>
            <span class="font-semibold truncate max-w-[90px]">{{ linkedTargetName || 'All' }}</span>
            <svg viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4 shrink-0 text-white/60" aria-hidden="true"><path d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zM10 17a.75.75 0 01-.55-.24l-3.25-3.5a.75.75 0 111.1-1.02L10 15.148l2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5A.75.75 0 0110 17z"/></svg>
          </button>
          <div
            v-if="targetMenuOpen"
            class="absolute right-0 top-full mt-1 w-48 rounded-xl border border-gray-700 bg-gray-900 shadow-2xl z-10 py-1 overflow-hidden"
          >
            <p class="px-3 pt-2 pb-1 text-[9px] font-semibold uppercase tracking-wider text-gray-500">Spec Target</p>
            <button
              v-for="opt in SPEC_TARGETS"
              :key="opt.id"
              type="button"
              class="flex items-center gap-2 w-full px-3 py-1.5 text-xs transition-colors"
              :class="linkedTargetName === opt.label
                ? 'bg-indigo-700/60 text-white font-semibold'
                : 'text-gray-300 hover:bg-white/10'"
              @click="pickTarget(opt.id, opt.label); targetMenuOpen = false"
            >
              <span class="w-4 shrink-0 text-center">{{ opt.emoji }}</span>
              <span>{{ opt.label }}</span>
            </button>
            <!-- Others: free-text specify -->
            <div class="px-3 py-2 border-t border-gray-700 mt-1">
              <p class="text-[9px] text-gray-500 mb-1.5">Others — specify:</p>
              <div class="flex gap-1">
                <input
                  v-model="othersText"
                  type="text"
                  placeholder="e.g. Auditors"
                  class="flex-1 min-w-0 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  @keydown.enter.prevent="pickTarget('others', othersText.trim() || 'Others'); targetMenuOpen = false"
                />
                <button
                  type="button"
                  class="shrink-0 px-2 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-[10px] text-white font-semibold transition-colors"
                  @click="pickTarget('others', othersText.trim() || 'Others'); targetMenuOpen = false"
                >Set</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Edit version name (draft mode) — r41 v238 (Tom Gilb 2026-06-21):
             Previously the input visually looked like the toolbar's "Edit Version" mode-toggle
             button and Tom kept clicking it expecting an action; it just focuses. Adding
             explicit "Name:" label, pencil glyph, and italic placeholder so it reads as a
             text field at a glance per DD-009 Zero-Training UI. -->
        <label
          v-if="editMode === 'draft'"
          class="hidden md:flex items-center gap-1.5 h-8 px-2 bg-white/5 border border-dashed border-white/30 rounded-lg shrink-0"
          :title="'Type a name for this Edit Version (e.g. \'For Auditors v2\'). This is a TEXT FIELD, not a button.'"
        >
          <span aria-hidden="true" class="text-[11px] text-white/60">✎</span>
          <span class="text-[9px] uppercase tracking-wider text-white/50 font-semibold">Name:</span>
          <input
            :value="editName"
            type="text"
            class="w-24 bg-transparent text-xs text-white placeholder-white/40 italic focus:outline-none"
            placeholder="type name…"
            @input="setEditName(($event.target as HTMLInputElement).value)"
          />
        </label>

        <!-- ⚖️ Global Priority — Tom 2026-05-13: needs to be a button here.
             Sits left of the Save button so the eye reads: identity / level /
             target / priority / save. Single-surface rule closes the editor
             when the priority panel opens. -->
        <!-- Split-button (DD-002 2026-05-14): glyph half → About modal,
             action half → Global Priority. Hover glyph for the ? hint. -->
        <PriorityActionButton
          label="Set Priority"
          chrome-class="shrink-0 bg-white/10 text-white border border-white/20"
          rounded-class="rounded-lg"
          height-class="h-9"
          text-size-class="text-xs"
          glyph-size-class="h-4"
          action-title="Open Global Priority — rank stakeholders, values, costs, constraints and solutions"
          action-aria-label="Open Global Priority"
          @action="emit('open-global-priority')"
          @info="emit('open-priority-info')"
        />
        <!-- Action buttons: Revert + Commit/Save + Close (right side group).
             Tom 2026-05-27: "All control pins are at top lines, never floating bottom left or right."
             Prominent commit button (2nd button) with larger size and bright color. -->
        <div class="flex items-center gap-1.5 shrink-0 border-l border-white/20 pl-3">
          <!-- Export — Tom Gilb 2026-06-21 verbatim "no export".  Per
               Export-button-on-all-windows SUPREME rule (rule_export_button_on_all_windows.md):
               every substantial SEM App window MUST expose an Export pin.  Emits 'export-spec'
               with the current workingSpec; App.vue handles the colourful HTML export
               (useColorfulSpecHtml with full Tier-1/2/3 Solution rendering banked v236,
               including the canonical Planguage definition footer) + auto-opens Mail per the
               Auto-Open Email SUPREME rule. -->
          <button
            type="button"
            class="shrink-0 flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold transition-colors focus:outline-none"
            title="Export the current spec — colourful HTML to clipboard + opens Mail. Per Export-on-all-windows SUPREME rule."
            aria-label="Export current spec as colourful HTML"
            @click="workingSpec && emit('export-spec', workingSpec)"
          >
            <span aria-hidden="true">📤</span>
            <span>Export</span>
          </button>
          <!-- Revert Last Round — undo recent edits (shows when changes exist) -->
          <button
            v-if="hasChanges && editMode === 'master'"
            type="button"
            class="shrink-0 h-8 px-3 rounded-lg text-xs font-medium transition-all
                   bg-white/15 hover:bg-white/25 text-white"
            title="Revert the most recent round of edits"
            aria-label="Revert last round of changes"
            @click="revertAll"
          >
            <span class="inline-flex items-center gap-1.5">
              <span aria-hidden="true">↩</span>
              <span>Revert Last</span>
            </span>
          </button>

          <!-- Commit/Save button — PROMINENT (large, right-aligned, second button).
               Hidden in master mode when nothing to commit. Draft mode shows "Save Version". -->
          <button
            v-show="editMode === 'draft' || hasChanges"
            type="button"
            class="shrink-0 h-10 px-5 rounded-lg text-sm font-bold transition-all shadow-lg"
            :class="editMode === 'master'
              ? 'bg-rose-500 hover:bg-rose-400 text-white'
              : 'bg-emerald-500 hover:bg-emerald-400 text-white'"
            :title="editMode === 'master' ? 'Commit changes to master plan' : 'Save as a named version'"
            @click="editMode === 'master' ? handleCommitMaster() : handleSaveDraft()"
          >
            <span class="inline-flex items-center gap-2">
              <!-- Show the SaveGlyph only for the idle draft-save state — the
                   ✅ / ✏️ feedback states keep their existing affirmation. -->
              <SaveGlyph
                v-if="saveLabelState.kind === 'draft-idle'"
                size="compact"
                class="h-3.5 w-auto"
                aria-hidden="true"
              />
              <span>{{ saveLabelState.text }}</span>
            </span>
          </button>

          <!-- Close — universal CloseDot per "Universal Close-Button Rule".
               Tom 2026-05-18: "no clear close for editor — a universal rule close on all screens." -->
          <CloseDot
            variant="on-dark"
            :title="editMode === 'master' && hasChanges ? 'Save & Close' : 'Close editor'"
            :aria-label="editMode === 'master' && hasChanges ? 'Save changes and close editor' : 'Close Spec Editor'"
            @click="handleClose"
          />
        </div>
      </div>

      <!-- ── r41 v298 (Tom Gilb 2026-06-23 verbatim "stages row and others not
           present, and no clarity in what to do and how to progress") ───────
           Embedded universal chrome — three strips + guidance bar — restored
           INSIDE the editor so the planner never loses orientation when the
           full-screen editor occludes the canvas behind it.

           Layered top-down:
             1. PlanningStageBar (11 tiles) — every stage reachable from this surface.
             2. AgentsStrip — all agents one click away (auto-saves first).
             3. Stage2SubStepStrip — only when planningStage === 2.
             4. Guidance bar — one sentence naming the current purpose + next move.

           Composes with: Stages-are-Cyclic SUPREME, No-Silent-Removal SUPREME,
           MOVE Principle SUPREME, DD-009 Zero-Training UI, No-Silent-Data-Loss
           SUPREME (auto-save before close-and-navigate), Twin portability.
           The strips themselves carry their own internal styling (dark theme);
           they sit cleanly above the existing thin Back/Stage/Next breadcrumb. -->
      <PlanningStageBar
        v-if="props.planningStage != null"
        :current-stage="props.planningStage ?? 1"
        :has-spec="!!workingSpec"
        :has-plan="!!props.hasPlan"
        @navigate="onEmbeddedStageNav"
      />
      <AgentsStrip
        :has-spec="!!workingSpec"
        :spec-presence="computedSpecPresence as Record<string, boolean>"
        @open-maria="onEmbeddedAgentOpen('maria')"
        @open-contracts="onEmbeddedAgentOpen('contracts')"
        @open-models="onEmbeddedAgentOpen('models')"
        @open-stakeholder-mapper="onEmbeddedAgentOpen('stakeholder-mapper')"
        @open-evo-critiquer="onEmbeddedAgentOpen('evo-step-critique')"
        @open-spec-importer="onEmbeddedAgentOpen('plan-importer')"
        @open-decisions="onEmbeddedAgentOpen('decisions')"
        @open-strategy="onEmbeddedAgentOpen('strategy-agent')"
        @open-incorruptible="onEmbeddedAgentOpen('incorruptible')"
        @open-incorruptible-sharpen="onEmbeddedAgentOpen('incorruptible-sharpen')"
        @open-elon="onEmbeddedAgentOpen('elon')"
        @open-elon-sharpen="onEmbeddedAgentOpen('elon-sharpen')"
        @open-munger="onEmbeddedAgentOpen('munger')"
        @open-munger-sharpen="onEmbeddedAgentOpen('munger-sharpen')"
        @open-heilmeier="onEmbeddedAgentOpen('heilmeier')"
        @open-auto-dbo="onEmbeddedAgentOpen('autoDbo')"
        @open-mode-picker="onEmbeddedAgentOpen"
      />
      <Stage2SubStepStrip
        v-if="props.planningStage === 2"
        :current="props.stage2SubStep"
        :done="props.stage2DoneSteps"
        @go="onEmbeddedStage2Go"
        @continue="onEmbeddedStage2Continue"
      />
      <!-- Guidance bar — Stage-Has-A-Purpose SUPREME + Zero-Training UI -->
      <div
        v-if="props.planningStage != null"
        class="shrink-0 flex items-start gap-2 px-4 py-2 bg-slate-900/55 border-b border-white/10 text-[12px] leading-snug text-amber-100/90"
        role="note"
        aria-label="What this surface is for"
      >
        <span class="shrink-0 mt-0.5 text-amber-300/80" aria-hidden="true">▸</span>
        <span>{{ guidanceText }}</span>
      </div>

      <!-- ── Stage navigation strip ─────────────────────────────────────────
           Tom 2026-05-28: "the always in title nd step 1-11 are gone" and
           "action is not working at all now" — when SpecEditorPanel is open
           as fixed inset-0 z-[600] it covers the stage bar and ⚡ Actions
           button in the main content. This strip gives access to both without
           closing the editor.
           Shows: ← Back | Stage N: Name | → Next | ⚡ Actions
           Only rendered when planningStage prop is provided. -->
      <div
        v-if="props.planningStage != null"
        class="shrink-0 flex items-center gap-1.5 px-4 py-1.5
               bg-indigo-950/80 border-b border-indigo-800/40"
      >
        <!-- ← Back -->
        <button
          v-if="(props.planningStage ?? 1) > 1"
          type="button"
          class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium
                 text-indigo-200 hover:text-white hover:bg-white/10
                 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
          :title="`Go back to Stage ${(props.planningStage ?? 1) - 1}: ${EDITOR_STAGE_NAMES[(props.planningStage ?? 1) - 1] ?? ''}`"
          :aria-label="`Go back to Stage ${(props.planningStage ?? 1) - 1}`"
          @click="emit('navigate-stage', (props.planningStage ?? 1) - 1)"
        >
          ← Back
        </button>

        <!-- Stage indicator -->
        <div class="flex-1 flex items-center justify-center gap-1.5 min-w-0">
          <span class="text-[10px] font-semibold text-indigo-300 tracking-wide">
            Stage {{ props.planningStage }} of 11
          </span>
          <span class="text-[10px] text-white/60">·</span>
          <span class="text-[11px] font-bold text-white truncate">
            {{ currentStageName }}
          </span>
        </div>

        <!-- → Next -->
        <button
          v-if="(props.planningStage ?? 11) < 11"
          type="button"
          class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium
                 text-indigo-200 hover:text-white hover:bg-white/10
                 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
          :title="`Go to Stage ${(props.planningStage ?? 1) + 1}: ${EDITOR_STAGE_NAMES[(props.planningStage ?? 1) + 1] ?? ''}`"
          :aria-label="`Go to Stage ${(props.planningStage ?? 1) + 1}`"
          @click="emit('navigate-stage', (props.planningStage ?? 1) + 1)"
        >
          Next →
        </button>

        <!-- ⚡ Actions -->
        <button
          type="button"
          class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium
                 text-amber-300 hover:text-white hover:bg-white/10
                 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400/40"
          title="Open ⚡ Actions — plan management, saves, exports &amp; shortcuts"
          aria-label="Open Actions hub"
          @click="emit('open-actions')"
        >
          ⚡ Actions
        </button>
      </div>

      <!-- ── Back to Value Flow Diagram strip ──────────────────────────────── -->
      <!-- Tom 2026-05-15 (v3): "Back to value flow diagram needs to be nearer
           and middle of mini diagram and larger. Isn't there more space downwards?
           I still can't see the near relationships."
           Layout: full-width thumbnail fills the strip; label is a centred
           overlay pinned to the bottom third of the diagram (gradient backdrop
           so it reads on any column colour). Scale 0.40 → svgWidth 1268px
           displayed as ~507px (right edge clips on narrow panels but all six
           causal-chain columns are legible). svgHeight ~280px × 0.40 = 112px;
           container: 148px so arrows + node labels are clearly readable. -->
      <Transition
        enter-active-class="transition-all duration-200 ease-out overflow-hidden"
        enter-from-class="max-h-0 opacity-0"
        enter-to-class="max-h-[220px] opacity-100"
        leave-active-class="transition-all duration-150 ease-in overflow-hidden"
        leave-from-class="max-h-[220px] opacity-100"
        leave-to-class="max-h-0 opacity-0"
      >
        <div
          v-if="props.returnTo"
          class="shrink-0 bg-indigo-950 border-b border-indigo-800/50"
        >
          <!-- Back-to-diagram button: thumbnail above, big-arrow label strip directly below.
               Tom 2026-05-16: "move top text nearer the mini and with larger letters, big arrow." -->
          <button
            type="button"
            class="block w-full px-2 pt-2 pb-0 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-indigo-400"
            aria-label="Back to Value Flow Diagram"
            @click="emit('back-to-value-flow')"
          >
            <!-- Mini diagram — no text overlay; label strip sits immediately below -->
            <div
              class="w-full overflow-hidden rounded-t border border-b-0 border-indigo-700/40"
              style="height: 148px; position: relative; flex-shrink: 0;"
              aria-hidden="true"
            >
              <div style="position: absolute; top: 0; left: 0; transform: scale(0.40); transform-origin: top left; pointer-events: none; user-select: none;">
                <ValueFlowDiagram
                  v-if="workingSpec"
                  :spec="workingSpec"
                  :evo-steps="_miniEvoSteps"
                  :tasks-by-step="{}"
                  :thumbnail="true"
                  :highlighted-entry-id="props.initialEntryId"
                />
              </div>
            </div>

            <!-- Label strip — butts directly against the thumbnail bottom edge.
                 Big arrow (text-4xl, 36px) + bold label (text-[15px]).
                 bg-indigo-900/90 so it reads as a distinct clickable zone. -->
            <div class="flex items-center justify-center gap-2.5 py-2.5 rounded-b border border-t-0 border-indigo-700/40 bg-indigo-900/90">
              <span class="text-4xl font-black leading-none text-white" aria-hidden="true">←</span>
              <span class="text-[15px] font-bold tracking-wide text-white/95">Back to Value Flow Diagram</span>
            </div>
          </button>
        </div>
      </Transition>

      <!-- ── Level hint bar ─────────────────────────────────────────────────── -->
      <div class="shrink-0 flex items-center gap-3 px-5 py-1.5 bg-amber-500/10 border-b border-amber-500/20 z-40 relative">
        <span class="text-amber-300 text-[10px] font-semibold uppercase tracking-wide">Edit Depth {{ editLevel }} — {{ EDIT_LEVEL_LABELS[editLevel] }}</span>
        <span class="text-amber-400/70 text-[10px]">{{ EDIT_LEVEL_HINTS[editLevel] }}</span>
        <!-- ℹ️ About the Edit Glyph — visible always, not buried in the header -->
        <button
          type="button"
          class="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                 text-[10px] font-bold bg-amber-400/25 text-amber-200 border border-amber-400/30
                 hover:bg-amber-400/40 hover:text-white transition-colors"
          title="About the Edit Glyph — what [*]→[**] means"
          @click="emit('open-edit-info')"
        ><EditGlyph size="compact" class="h-2.5 w-auto shrink-0" aria-hidden="true" /><span class="ml-0.5">?</span></button>
        <div v-if="hasChanges" class="ml-auto flex items-center gap-2">
          <span class="text-amber-300 text-[10px] font-semibold">{{ changedCount }} changed</span>
          <button
            type="button"
            class="h-6 px-2.5 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10px] font-medium transition-colors"
            @click="revertAll"
          >↩ Revert All</button>
        </div>
      </div>

      <!-- ── Safety Net Banner — uncommitted changes warning ───────────────────── -->
      <!-- Shows when there are changes, with edit count on right and safety message.
           Close button (✕) dismisses the banner. Amber styling indicates caution. -->
      <!-- audit-ignore: scroll — max-h-0/max-h-16 are CSS animation keyframe classes on <Transition>, not a scroll region; the element has overflow-hidden so no scroll surface exists -->
      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        enter-from-class="max-h-0 opacity-0"
        enter-to-class="max-h-16 opacity-100"
        leave-active-class="transition-all duration-150 ease-in"
        leave-from-class="max-h-16 opacity-100"
        leave-to-class="max-h-0 opacity-0"
      >
        <div
          v-if="hasChanges && showSafetyBanner"
          class="shrink-0 flex items-center gap-3 px-5 py-2.5 bg-amber-50 border-b border-amber-200 z-40 relative"
          role="status"
          aria-live="polite"
          aria-label="Uncommitted changes safety reminder"
        >
          <!-- Safety message -->
          <div class="flex-1 min-w-0">
            <p class="text-sm text-amber-900 font-medium">
              <span class="font-semibold">{{ changedCount }} change{{ changedCount !== 1 ? 's' : '' }} pending.</span>
              Changes auto-incorporate when you close the editor—or save to master now to commit formally.
            </p>
          </div>
          <!-- Edit count badge on right -->
          <div class="shrink-0 flex items-center gap-2">
            <span class="inline-flex items-center px-3 py-1 rounded-lg bg-amber-100 text-amber-900 text-xs font-bold">
              {{ changedCount }} {{ changedCount === 1 ? 'edit' : 'edits' }}
            </span>
            <!-- Close button (dismiss banner) — CloseDot rule: panel-level dismiss -->
            <CloseDot
              variant="on-light"
              aria-label="Dismiss safety reminder"
              title="Dismiss this reminder"
              @click="showSafetyBanner = false"
            />
          </div>
        </div>
      </Transition>

      <!-- ── Tabs ───────────────────────────────────────────────────────────── -->
      <div class="shrink-0 flex items-center gap-0 border-b border-gray-800 bg-gray-900 px-4 pt-2">
        <button
          v-for="tab in (['functions', 'values', 'solutions', 'constraints', 'versions'] as TabId[])"
          :key="tab"
          type="button"
          class="relative px-4 py-2 text-sm font-medium transition-colors rounded-t-lg mr-0.5"
          :class="activeTab === tab
            ? tab === 'constraints' ? 'bg-red-50 text-red-900' : 'bg-white text-gray-900'
            : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'"
          @click="activeTab = tab"
        >
          <span>
            {{ tab === 'functions' ? '→O→ Functions' : tab === 'values' ? '0▸✳ Values' : tab === 'solutions' ? '[✳]→ Solutions' : tab === 'constraints' ? '[→O→] Constraints' : '📄 Saved Versions' }}
          </span>
          <span
            class="ml-1.5 inline-flex items-center justify-center h-4 min-w-[1rem] rounded-full text-[9px] font-bold px-1"
            :class="activeTab === tab
              ? tab === 'constraints' ? 'bg-red-100 text-red-700' : 'bg-indigo-100 text-indigo-700'
              : 'bg-gray-700 text-gray-400'"
          >{{ tabCounts[tab] }}</span>
          <!-- Change dot for entry tabs -->
          <span
            v-if="tab !== 'versions' && workingSpec"
            class="absolute top-1.5 right-1 h-1.5 w-1.5 rounded-full bg-amber-400"
            :class="
              (tab === 'functions'    && workingSpec.functions.some(e    => isChanged(e.id)))  ||
              (tab === 'values'       && workingSpec.values.some(e       => isChanged(e.id)))  ||
              (tab === 'solutions'    && workingSpec.solutions.some(e    => isChanged(e.id)))  ||
              (tab === 'constraints'  && (workingSpec.constraints ?? []).some(e => isChanged(e.id)))
                ? 'opacity-100' : 'opacity-0'
            "
          />
        </button>
        <!-- Spacer pushes the Value Flow shortcut to the right -->
        <div class="flex-1" />
        <!-- Value Flow shortcut — jump to VFD showing all entries of the current tab's type.
             Tom 2026-05-17: "All in Flow / 🌊 icon escaped my attention completely — alien icon,
             unintelligible text." Fix: Picture + Text (VFD sparkline + '← Value Flow'), larger,
             brighter, tinted background so it can't be missed.
             Only shown for F · V · S (the three types that appear in the Value Flow). -->
        <button
          v-if="activeTab === 'functions' || activeTab === 'values' || activeTab === 'solutions'"
          type="button"
          class="mb-1 flex items-center gap-1.5 h-8 px-3 rounded-lg
                 text-xs font-semibold text-indigo-100
                 bg-indigo-700/40 hover:bg-indigo-600/60 hover:text-white
                 border border-indigo-400/30 transition-colors shrink-0"
          :title="`Show all ${activeTab} in the Value Flow Diagram`"
          @click="emit('show-in-value-flow', { tab: activeTab as 'functions' | 'values' | 'solutions', entryId: '' })"
        >
          <!-- VFD mini-sparkline: 6 column-bars matching the real diagram's type colours -->
          <svg width="22" height="12" viewBox="0 0 22 12" aria-hidden="true" style="flex-shrink:0;display:block">
            <rect x="0"   y="0" width="2.5" height="12" rx="0.7" fill="#374151"/>
            <rect x="3.5" y="0" width="2.5" height="12" rx="0.7" fill="#ca8a04"/>
            <rect x="7"   y="0" width="2.5" height="12" rx="0.7" fill="#ea580c"/>
            <rect x="10.5" y="0" width="2.5" height="12" rx="0.7" fill="#7c3aed"/>
            <rect x="14"  y="0" width="2.5" height="12" rx="0.7" fill="#16a34a"/>
            <rect x="17.5" y="0" width="2.5" height="12" rx="0.7" fill="#2563eb"/>
          </svg>
          ← Value Flow
        </button>
      </div>

      <!-- ── Concept hint strip (Level 1 text + Level 2 💡 Illuminate) ────────── -->
      <ConceptHint
        v-if="activeTab !== 'versions'"
        :term="activeTab === 'functions'   ? CONCEPT_HINTS.function.term
             : activeTab === 'values'      ? CONCEPT_HINTS.value.term
             : activeTab === 'solutions'   ? CONCEPT_HINTS.solution.term
             :                              CONCEPT_HINTS.constraint.term"
        :short="activeTab === 'functions'  ? CONCEPT_HINTS.function.short
              : activeTab === 'values'     ? CONCEPT_HINTS.value.short
              : activeTab === 'solutions'  ? CONCEPT_HINTS.solution.short
              :                             CONCEPT_HINTS.constraint.short"
        :spec="props.spec"
      />

      <!-- ── Entry cards ────────────────────────────────────────────────────── -->
      <ScrollContainer outer-class="flex-1 min-h-0 relative" inner-class="h-full bg-gray-50">
        <div v-if="workingSpec" class="p-6 space-y-2 max-w-4xl mx-auto">

          <!-- ── FUNCTIONS tab ──────────────────────────────────────────────── -->
          <template v-if="activeTab === 'functions'">
            <div
              v-for="(entry, idx) in workingSpec.functions"
              :key="entry.id"
              :data-entry-id="entry.id"
              class="rounded-xl border-2 bg-white overflow-hidden transition-all"
              :class="isChanged(entry.id) ? 'border-amber-300 shadow-amber-100 shadow-md' : 'border-gray-200'"
            >
              <!-- Card header — Functions -->
              <button
                type="button"
                class="group w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-green-50 transition-colors"
                @click="toggleExpand(entry.id)"
                :title="isExpanded(entry.id) ? (isChanged(entry.id) ? 'Collapse this row — your edits stay (use ↩ Revert below to discard)' : 'Collapse this row — nothing to save or discard') : 'Expand to edit this entry'"
              >
                <!-- Type glyph badge (Tom 2026-05-17: "more colorful glyphs we planned") -->
                <span class="shrink-0 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded leading-none"
                      style="background:#f0fdf4; color:#16a34a">→O→</span>
                <!-- r41 v239 (Tom 2026-06-21 "drop V1 V2 tags forever") — mnemonic tag from description -->
                <span class="text-sm font-bold underline underline-offset-4 decoration-2 shrink-0" style="color:#16a34a">{{ entryTag(entry) }}:</span>
                <!-- Tom 2026-05-15: show old→new diff in collapsed EDITED state -->
                <template v-if="isChanged(entry.id) && !isExpanded(entry.id)">
                  <div class="flex-1 min-w-0 space-y-0.5">
                    <p class="text-[10px] text-amber-500 line-through truncate leading-tight opacity-80">{{ originalDesc(entry.id) }}</p>
                    <p class="text-sm text-gray-900 font-medium truncate leading-tight">{{ entryBody(entry) }}</p>
                  </div>
                </template>
                <span v-else class="flex-1 text-sm text-gray-700 truncate">{{ entryBody(entry) }}</span>
                <!-- Changed badge -->
                <span
                  v-if="isChanged(entry.id) || keptFlash.has(entry.id)"
                  class="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold transition-colors"
                  :class="keptFlash.has(entry.id) ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'"
                >{{ keptFlash.has(entry.id) ? '✓ Kept' : 'EDITED' }}</span>
                <!-- Expand/collapse — type-colored glyph pill -->
                <span
                  class="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide transition-colors"
                  :class="isExpanded(entry.id) ? 'bg-indigo-100 text-indigo-700' : ''"
                  :style="!isExpanded(entry.id) ? 'background:#f0fdf4; color:#16a34a' : ''"
                  aria-hidden="true"
                ><span v-if="!isExpanded(entry.id)" class="font-mono font-bold text-[10px]">→O→</span>{{ isExpanded(entry.id) ? '▾ Collapse' : '▸ Click to Edit' }}</span>
              </button>

              <!-- Edit form (expanded) -->
              <div v-if="isExpanded(entry.id)" class="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3">
                <!-- Original description diff (show when changed) -->
                <div v-if="isChanged(entry.id)" class="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                  <p class="text-[9px] font-bold text-amber-600 uppercase tracking-wide mb-1">Original</p>
                  <p class="text-xs text-amber-800 line-through opacity-70">{{ originalDesc(entry.id) }}</p>
                </div>

                <!-- Level 1+: description -->
                <div>
                  <label class="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Description</label>
                  <textarea
                    :value="entry.description ?? ''"
                    rows="3"
                    class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    @input="updateFEntry(idx, { description: ($event.target as HTMLTextAreaElement).value })"
                  />
                </div>

                <!-- Level 2+: successCriteria -->
                <div v-if="editLevel >= 2">
                  <label class="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Success Criteria</label>
                  <textarea
                    :value="entry.successCriteria ?? ''"
                    rows="2"
                    class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    @input="updateFEntry(idx, { successCriteria: ($event.target as HTMLTextAreaElement).value })"
                  />
                </div>

                <!-- Level 3: ID + links -->
                <template v-if="editLevel >= 3">
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label class="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">ID</label>
                      <input
                        :value="entry.id ?? ''"
                        type="text"
                        class="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        @input="updateFEntry(idx, { id: ($event.target as HTMLInputElement).value })"
                      />
                    </div>
                    <div>
                      <label class="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Function of Value</label>
                      <input
                        :value="entry.functionOfValue ?? ''"
                        type="text"
                        class="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        @input="updateFEntry(idx, { functionOfValue: ($event.target as HTMLInputElement).value })"
                      />
                    </div>
                  </div>
                </template>

                <!-- Entry actions: Done (always) + Revert (when changed) -->
                <div class="flex items-center justify-between gap-2">
                  <!-- ◈ Flow — show this entry highlighted in the Value Flow diagram -->
                  <button
                    type="button"
                    class="flex items-center gap-1 h-7 px-2.5 rounded-lg text-[10px] font-medium
                           text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 transition-colors"
                    :title="`Show ${entry.id} in the Value Flow diagram`"
                    @click="emit('show-in-value-flow', { tab: 'functions', entryId: entry.id })"
                  >◈ Flow</button>
                  <div class="flex items-center gap-2">
                    <button
                      v-if="isChanged(entry.id)"
                      type="button"
                      class="h-7 px-3 rounded-lg text-[10px] font-medium bg-gray-100 text-gray-500 hover:bg-amber-100 hover:text-amber-700 transition-colors"
                      @click="revertEntry(entry.id)"
                      title="Discard your edits to this entry — restores the original description"
                    >↩ Revert</button>
                    <button
                      type="button"
                      class="h-7 px-4 rounded-lg text-[10px] font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                      @click="doneEntry(entry.id)"
                      :title="isChanged(entry.id) ? 'Keep your edits and collapse this row (Undo restores at any time)' : 'Collapse this row — no edits made'"
                    >{{ isChanged(entry.id) ? '✓ Keep Change' : '▾ Collapse' }}</button>
                  </div>
                </div>
              </div>
            </div>
            <!-- Add Function button — doubles as empty state when list is empty -->
            <button
              type="button"
              class="w-full flex items-center justify-center gap-2 h-11 rounded-xl border-2 border-dashed
                     text-[11px] font-semibold transition-all hover:opacity-90 mt-1"
              style="border-color:#86efac; color:#16a34a; background:#f0fdf4"
              @click="handleAddEntry('functions')"
            >
              <span class="font-mono font-bold text-[10px]">→O→</span>
              + Add Function
            </button>
          </template>

          <!-- ── VALUES tab ─────────────────────────────────────────────────── -->
          <template v-if="activeTab === 'values'">
            <!-- Bulk draft button (header) — shows when incomplete values exist -->
            <div v-if="workingSpec.values.some(v => isValueIncomplete(v))" class="mb-4 flex items-center justify-between gap-2">
              <span class="text-[11px] font-semibold text-gray-500 uppercase">Values</span>
              <button
                type="button"
                class="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-all
                       text-violet-700 hover:text-violet-900 hover:bg-violet-50 bg-violet-50 border border-violet-200"
                :disabled="draftLoading.value"
                @click="handleDraftAllIncomplete"
              >
                <span v-if="draftLoading.value" aria-hidden="true">⟳</span>
                <span v-else aria-hidden="true">✨</span>
                {{ draftLoading.value ? 'Drafting...' : `Draft ${workingSpec.values.filter(v => isValueIncomplete(v)).length} Incomplete` }}
              </button>
            </div>
            <div
              v-for="(entry, idx) in workingSpec.values"
              :key="entry.id"
              :data-entry-id="entry.id"
              class="rounded-xl border-2 bg-white overflow-hidden transition-all"
              :class="isChanged(entry.id) ? 'border-amber-300 shadow-amber-100 shadow-md' : 'border-gray-200'"
            >
              <!-- Card header — Values -->
              <button
                type="button"
                class="group w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-violet-50 transition-colors"
                @click="toggleExpand(entry.id)"
                :title="isExpanded(entry.id) ? (isChanged(entry.id) ? 'Collapse this row — your edits stay (use ↩ Revert below to discard)' : 'Collapse this row — nothing to save or discard') : 'Expand to edit this entry'"
              >
                <span class="shrink-0 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded leading-none"
                      style="background:#f5f3ff; color:#7c3aed">0▸✳</span>
                <!-- r41 v239 (Tom 2026-06-21 "drop V1 V2 tags forever") — mnemonic tag from description -->
                <span class="text-sm font-bold underline underline-offset-4 decoration-2 shrink-0" style="color:#7c3aed">{{ entryTag(entry) }}:</span>
                <!-- Tom 2026-05-15: show old→new diff in collapsed EDITED state -->
                <template v-if="isChanged(entry.id) && !isExpanded(entry.id)">
                  <div class="flex-1 min-w-0 space-y-0.5">
                    <p class="text-[10px] text-amber-500 line-through truncate leading-tight opacity-80">{{ originalDesc(entry.id) }}</p>
                    <p class="text-sm text-gray-900 font-medium truncate leading-tight">{{ entryBody(entry) }}</p>
                  </div>
                </template>
                <span v-else class="flex-1 text-sm text-gray-700 truncate">{{ entryBody(entry) }}</span>
                <span
                  v-if="isChanged(entry.id) || keptFlash.has(entry.id)"
                  class="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold transition-colors"
                  :class="keptFlash.has(entry.id) ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'"
                >{{ keptFlash.has(entry.id) ? '✓ Kept' : 'EDITED' }}</span>
                <span v-if="isValueIncomplete(entry)" class="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-700" :title="`Missing: ${missingFieldsLabel(entry)}`">● Incomplete</span>
                <!-- Expand/collapse — type-colored glyph pill -->
                <span
                  class="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide transition-colors"
                  :class="isExpanded(entry.id) ? 'bg-indigo-100 text-indigo-700' : ''"
                  :style="!isExpanded(entry.id) ? 'background:#f5f3ff; color:#7c3aed' : ''"
                  aria-hidden="true"
                ><span v-if="!isExpanded(entry.id)" class="font-mono font-bold text-[10px]">0▸✳</span>{{ isExpanded(entry.id) ? '▾ Collapse' : '▸ Click to Edit' }}</span>
              </button>

              <!-- Edit form -->
              <div v-if="isExpanded(entry.id)" class="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3">
                <!-- Original diff -->
                <div v-if="isChanged(entry.id)" class="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                  <p class="text-[9px] font-bold text-amber-600 uppercase tracking-wide mb-1">Original Description</p>
                  <p class="text-xs text-amber-800 line-through opacity-70">{{ originalDesc(entry.id) }}</p>
                </div>

                <!-- Level 1+: description + wish -->
                <div>
                  <label class="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Description — what is being measured</label>
                  <textarea
                    :value="entry.description ?? ''"
                    rows="2"
                    class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    @input="updateVEntry(idx, { description: ($event.target as HTMLTextAreaElement).value })"
                  />
                </div>
                <div v-if="editLevel >= 1">
                  <label class="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Wish <span class="font-normal normal-case text-gray-400">— initial stakeholder aspiration</span></label>
                  <input
                    :value="entry.wish ?? ''"
                    type="text"
                    class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    @input="updateVEntry(idx, { wish: ($event.target as HTMLInputElement).value })"
                  />
                </div>

                <!-- Level 2+: metrics grid -->
                <template v-if="editLevel >= 2">
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label class="flex items-center gap-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        <PlSpecFieldIcon field="scale" size="xs" /><span>Scale</span>
                      </label>
                      <input :value="entry.scale ?? ''" type="text" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400" @input="updateVEntry(idx, { scale: ($event.target as HTMLInputElement).value })" />
                    </div>
                    <div>
                      <label class="flex items-center gap-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        <PlSpecFieldIcon field="meter" size="xs" /><span>Meter</span>
                      </label>
                      <input :value="entry.meter ?? ''" type="text" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400" @input="updateVEntry(idx, { meter: ($event.target as HTMLInputElement).value })" />
                    </div>
                    <div>
                      <label class="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 uppercase tracking-wide mb-1">
                        <PlSpecFieldIcon field="tolerable" size="xs" /><span>Tolerable <span class="font-normal normal-case text-gray-400">— minimum</span></span>
                      </label>
                      <input :value="entry.tolerable ?? ''" type="text" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400" @input="updateVEntry(idx, { tolerable: ($event.target as HTMLInputElement).value })" />
                    </div>
                    <div>
                      <label class="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 uppercase tracking-wide mb-1">
                        <PlSpecFieldIcon field="goal" size="xs" /><span>Goal <span class="font-normal normal-case text-gray-400">— target</span></span>
                      </label>
                      <input :value="entry.goal ?? ''" type="text" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400" @input="updateVEntry(idx, { goal: ($event.target as HTMLInputElement).value })" />
                    </div>
                  </div>
                  <div>
                    <label class="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Wish Stakeholder</label>
                    <input :value="entry.wishStakeholder ?? ''" type="text" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400" @input="updateVEntry(idx, { wishStakeholder: ($event.target as HTMLInputElement).value })" />
                  </div>
                  <div>
                    <label class="flex items-center gap-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                      <PlSpecFieldIcon field="status" size="xs" /><span>Status <span class="font-normal normal-case text-gray-400">— current measured state</span></span>
                    </label>
                    <input :value="entry.status ?? ''" type="text" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400" @input="updateVEntry(idx, { status: ($event.target as HTMLInputElement).value })" />
                  </div>
                </template>

                <!-- Level 3: ID + link -->
                <template v-if="editLevel >= 3">
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label class="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">ID</label>
                      <input :value="entry.id ?? ''" type="text" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-400" @input="updateVEntry(idx, { id: ($event.target as HTMLInputElement).value })" />
                    </div>
                    <div>
                      <label class="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Value of Function</label>
                      <input :value="entry.valueOfFunction ?? ''" type="text" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-400" @input="updateVEntry(idx, { valueOfFunction: ($event.target as HTMLInputElement).value })" />
                    </div>
                  </div>
                </template>

                <!-- ✨ Draft missing fields button (edit level 2+, if incomplete) -->
                <div v-if="editLevel >= 2 && isValueIncomplete(entry)" class="space-y-3">
                  <button
                    type="button"
                    class="w-full flex items-center justify-center gap-2 h-8 px-4 rounded-lg text-sm font-semibold transition-all
                           text-violet-700 hover:text-violet-900 hover:bg-violet-50 bg-violet-50 border border-violet-200"
                    :disabled="draftingEntryId.value === entry.id || draftLoading.value"
                    @click="handleDraftSingleValue(entry.id)"
                  >
                    <span v-if="draftingEntryId.value === entry.id" aria-hidden="true">⟳</span>
                    <span v-else aria-hidden="true">✨</span>
                    {{ draftingEntryId.value === entry.id ? 'Drafting...' : 'Draft missing fields' }}
                  </button>

                  <!-- Inline suggest panel — shows after draft completes -->
                  <!-- audit-ignore: scroll — max-h-0/max-h-96 are CSS animation keyframe classes on <Transition>, not a scroll region -->
                  <Transition
                    enter-active-class="transition-all duration-200"
                    enter-from-class="max-h-0 opacity-0"
                    enter-to-class="max-h-96 opacity-100"
                    leave-active-class="transition-all duration-150"
                    leave-from-class="max-h-96 opacity-100"
                    leave-to-class="max-h-0 opacity-0"
                  >
                    <div v-if="draftResults.has(entry.id)" class="rounded-lg bg-indigo-50 border border-indigo-200 p-3 space-y-2">
                      <p class="text-[10px] font-bold text-indigo-700 uppercase tracking-wide">Draft suggestions</p>
                      <div v-for="field of ['scale', 'tolerable', 'wish'] as const" :key="field" class="space-y-1">
                        <div class="flex items-start gap-2">
                          <div class="flex-1 min-w-0">
                            <p class="text-[10px] font-semibold text-indigo-600">{{ field }}</p>
                            <p class="text-xs text-indigo-700 font-medium">{{ draftResults.get(entry.id)?.[field] || '—' }}</p>
                          </div>
                          <div class="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              title="Accept (confident)"
                              class="h-6 w-6 flex items-center justify-center rounded-md text-[13px] font-bold text-emerald-600 hover:bg-emerald-100 transition-colors"
                              @click="acceptDraftField(entry.id, field, false)"
                            >✓</button>
                            <button
                              type="button"
                              title="Accept with ? (uncertain)"
                              class="h-6 w-6 flex items-center justify-center rounded-md text-[13px] font-bold text-amber-600 hover:bg-amber-100 transition-colors"
                              @click="acceptDraftField(entry.id, field, true)"
                            >❓</button>
                            <button
                              type="button"
                              title="Skip"
                              class="h-6 w-6 flex items-center justify-center rounded-md text-[13px] font-bold text-slate-400 hover:bg-slate-200 transition-colors"
                              @click="draftResults.delete(entry.id)"
                            >✕</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Transition>
                </div>

                <!-- Entry actions: Done (always) + Revert (when changed) — same pattern as Functions tab -->
                <div class="flex items-center justify-between gap-2">
                  <!-- ◈ Flow — show this entry highlighted in the Value Flow diagram -->
                  <button
                    type="button"
                    class="flex items-center gap-1 h-7 px-2.5 rounded-lg text-[10px] font-medium
                           text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 transition-colors"
                    :title="`Show ${entry.id} in the Value Flow diagram`"
                    @click="emit('show-in-value-flow', { tab: 'values', entryId: entry.id })"
                  >◈ Flow</button>
                  <div class="flex items-center gap-2">
                    <button
                      v-if="isChanged(entry.id)"
                      type="button"
                      class="h-7 px-3 rounded-lg text-[10px] font-medium bg-gray-100 text-gray-500 hover:bg-amber-100 hover:text-amber-700 transition-colors"
                      @click="revertEntry(entry.id)"
                      title="Discard your edits to this entry — restores the original description"
                    >↩ Revert</button>
                    <button
                      type="button"
                      class="h-7 px-4 rounded-lg text-[10px] font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                      @click="doneEntry(entry.id)"
                      :title="isChanged(entry.id) ? 'Keep your edits and collapse this row (Undo restores at any time)' : 'Collapse this row — no edits made'"
                    >{{ isChanged(entry.id) ? '✓ Keep Change' : '▾ Collapse' }}</button>
                  </div>
                </div>
              </div>
            </div>
            <!-- Add Value button -->
            <button
              type="button"
              class="w-full flex items-center justify-center gap-2 h-11 rounded-xl border-2 border-dashed
                     text-[11px] font-semibold transition-all hover:opacity-90 mt-1"
              style="border-color:#c4b5fd; color:#7c3aed; background:#f5f3ff"
              @click="handleAddEntry('values')"
            >
              <span class="font-mono font-bold text-[10px]">0▸✳</span>
              + Add Value
            </button>
          </template>

          <!-- ── SOLUTIONS tab ──────────────────────────────────────────────── -->
          <template v-if="activeTab === 'solutions'">
            <div
              v-for="(entry, idx) in workingSpec.solutions"
              :key="entry.id"
              :data-entry-id="entry.id"
              class="rounded-xl border-2 bg-white overflow-hidden transition-all"
              :class="isChanged(entry.id) ? 'border-amber-300 shadow-amber-100 shadow-md' : 'border-gray-200'"
            >
              <!-- Card header — Solutions -->
              <button
                type="button"
                class="group w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-orange-50 transition-colors"
                @click="toggleExpand(entry.id)"
                :title="isExpanded(entry.id) ? (isChanged(entry.id) ? 'Collapse this row — your edits stay (use ↩ Revert below to discard)' : 'Collapse this row — nothing to save or discard') : 'Expand to edit this entry'"
              >
                <span class="shrink-0 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded leading-none"
                      style="background:#fff7ed; color:#ea580c">[✳]→</span>
                <!-- r41 v239 (Tom 2026-06-21 "drop V1 V2 tags forever") — mnemonic tag from description -->
                <span class="text-sm font-bold underline underline-offset-4 decoration-2 shrink-0" style="color:#ea580c">{{ entryTag(entry) }}:</span>
                <!-- Tom 2026-05-15: show old→new diff in collapsed EDITED state -->
                <template v-if="isChanged(entry.id) && !isExpanded(entry.id)">
                  <div class="flex-1 min-w-0 space-y-0.5">
                    <p class="text-[10px] text-amber-500 line-through truncate leading-tight opacity-80">{{ originalDesc(entry.id) }}</p>
                    <p class="text-sm text-gray-900 font-medium truncate leading-tight">{{ entryBody(entry) }}</p>
                  </div>
                </template>
                <span v-else class="flex-1 text-sm text-gray-700 truncate">{{ entryBody(entry) }}</span>
                <span
                  v-if="isChanged(entry.id) || keptFlash.has(entry.id)"
                  class="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold transition-colors"
                  :class="keptFlash.has(entry.id) ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'"
                >{{ keptFlash.has(entry.id) ? '✓ Kept' : 'EDITED' }}</span>
                <!-- Expand/collapse — type-colored glyph pill -->
                <span
                  class="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide transition-colors"
                  :class="isExpanded(entry.id) ? 'bg-indigo-100 text-indigo-700' : ''"
                  :style="!isExpanded(entry.id) ? 'background:#fff7ed; color:#ea580c' : ''"
                  aria-hidden="true"
                ><span v-if="!isExpanded(entry.id)" class="font-mono font-bold text-[10px]">[✳]→</span>{{ isExpanded(entry.id) ? '▾ Collapse' : '▸ Click to Edit' }}</span>
              </button>

              <!-- Edit form -->
              <div v-if="isExpanded(entry.id)" class="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3">
                <!-- Original diff -->
                <div v-if="isChanged(entry.id)" class="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                  <p class="text-[9px] font-bold text-amber-600 uppercase tracking-wide mb-1">Original</p>
                  <p class="text-xs text-amber-800 line-through opacity-70">{{ originalDesc(entry.id) }}</p>
                </div>

                <!-- Level 1+: description -->
                <div>
                  <label class="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Description</label>
                  <textarea
                    :value="entry.description ?? ''"
                    rows="3"
                    class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-400"
                    @input="updateSEntry(idx, { description: ($event.target as HTMLTextAreaElement).value })"
                  />
                </div>

                <!-- Level 2+: impact -->
                <div v-if="editLevel >= 2">
                  <label class="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Impact <span class="font-normal normal-case text-gray-400">— estimated effect on Values</span></label>
                  <input
                    :value="entry.impact ?? ''"
                    type="text"
                    class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                    @input="updateSEntry(idx, { impact: ($event.target as HTMLInputElement).value })"
                  />
                </div>

                <!-- Level 3: ID + function link -->
                <template v-if="editLevel >= 3">
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label class="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">ID</label>
                      <input :value="entry.id ?? ''" type="text" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-violet-400" @input="updateSEntry(idx, { id: ($event.target as HTMLInputElement).value })" />
                    </div>
                    <div>
                      <label class="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Implements Function</label>
                      <input :value="entry.function ?? ''" type="text" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-violet-400" @input="updateSEntry(idx, { function: ($event.target as HTMLInputElement).value })" />
                    </div>
                  </div>
                </template>

                <!-- Entry actions: Done (always) + Revert (when changed) — same pattern as Functions tab -->
                <div class="flex items-center justify-between gap-2">
                  <!-- ◈ Flow — show this entry highlighted in the Value Flow diagram -->
                  <button
                    type="button"
                    class="flex items-center gap-1 h-7 px-2.5 rounded-lg text-[10px] font-medium
                           text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 transition-colors"
                    :title="`Show ${entry.id} in the Value Flow diagram`"
                    @click="emit('show-in-value-flow', { tab: 'solutions', entryId: entry.id })"
                  >◈ Flow</button>
                  <div class="flex items-center gap-2">
                    <button
                      v-if="isChanged(entry.id)"
                      type="button"
                      class="h-7 px-3 rounded-lg text-[10px] font-medium bg-gray-100 text-gray-500 hover:bg-amber-100 hover:text-amber-700 transition-colors"
                      @click="revertEntry(entry.id)"
                      title="Discard your edits to this entry — restores the original description"
                    >↩ Revert</button>
                    <button
                      type="button"
                      class="h-7 px-4 rounded-lg text-[10px] font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                      @click="doneEntry(entry.id)"
                      :title="isChanged(entry.id) ? 'Keep your edits and collapse this row (Undo restores at any time)' : 'Collapse this row — no edits made'"
                    >{{ isChanged(entry.id) ? '✓ Keep Change' : '▾ Collapse' }}</button>
                  </div>
                </div>
              </div>
            </div>
            <!-- Add Solution button -->
            <button
              type="button"
              class="w-full flex items-center justify-center gap-2 h-11 rounded-xl border-2 border-dashed
                     text-[11px] font-semibold transition-all hover:opacity-90 mt-1"
              style="border-color:#fdba74; color:#ea580c; background:#fff7ed"
              @click="handleAddEntry('solutions')"
            >
              <span class="font-mono font-bold text-[10px]">[✳]→</span>
              + Add Solution
            </button>
          </template>

          <!-- ── CONSTRAINTS tab ──────────────────────────────────────────────── -->
          <template v-if="activeTab === 'constraints'">
            <div
              v-for="(entry, idx) in (workingSpec.constraints ?? [])"
              :key="entry.id"
              :data-entry-id="entry.id"
              class="rounded-xl border-2 bg-white overflow-hidden transition-all"
              :class="isChanged(entry.id) ? 'border-amber-300 shadow-amber-100 shadow-md' : 'border-red-200'"
            >
              <!-- Card header — Constraints -->
              <button
                type="button"
                class="group w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-red-50 transition-colors"
                @click="toggleExpand(entry.id)"
                :title="isExpanded(entry.id) ? (isChanged(entry.id) ? 'Collapse this row — your edits stay (use ↩ Revert below to discard)' : 'Collapse this row — nothing to save or discard') : 'Expand to edit this entry'"
              >
                <span class="shrink-0 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded leading-none"
                      style="background:#fef2f2; color:#dc2626">[→O→]</span>
                <!-- r41 v239 (Tom 2026-06-21 "drop V1 V2 tags forever") — mnemonic tag from description -->
                <span class="text-sm font-bold underline underline-offset-4 decoration-2 shrink-0" style="color:#dc2626">{{ entryTag(entry) }}:</span>
                <!-- Tom 2026-05-15: show old→new diff in collapsed EDITED state -->
                <template v-if="isChanged(entry.id) && !isExpanded(entry.id)">
                  <div class="flex-1 min-w-0 space-y-0.5">
                    <p class="text-[10px] text-amber-500 line-through truncate leading-tight opacity-80">{{ originalDesc(entry.id) }}</p>
                    <p class="text-sm text-gray-900 font-medium truncate leading-tight">{{ entryBody(entry) }}</p>
                  </div>
                </template>
                <span v-else class="flex-1 text-sm text-gray-700 truncate">{{ entryBody(entry) }}</span>
                <span
                  v-if="isChanged(entry.id) || keptFlash.has(entry.id)"
                  class="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold transition-colors"
                  :class="keptFlash.has(entry.id) ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'"
                >{{ keptFlash.has(entry.id) ? '✓ Kept' : 'EDITED' }}</span>
                <!-- Expand/collapse — type-colored glyph pill -->
                <span
                  class="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide transition-colors"
                  :class="isExpanded(entry.id) ? 'bg-red-100 text-red-700' : ''"
                  :style="!isExpanded(entry.id) ? 'background:#fef2f2; color:#dc2626' : ''"
                  aria-hidden="true"
                ><span v-if="!isExpanded(entry.id)" class="font-mono font-bold text-[10px]">[→O→]</span>{{ isExpanded(entry.id) ? '▾ Collapse' : '▸ Click to Edit' }}</span>
              </button>

              <!-- Edit form (expanded) -->
              <div v-if="isExpanded(entry.id)" class="border-t border-red-100 px-4 pb-4 pt-3 space-y-3">
                <!-- Original diff -->
                <div v-if="isChanged(entry.id)" class="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                  <p class="text-[9px] font-bold text-amber-600 uppercase tracking-wide mb-1">Original</p>
                  <p class="text-xs text-amber-800 line-through opacity-70">{{ originalDesc(entry.id) }}</p>
                </div>

                <!-- Level 1+: description (the binary rule — "Must…" / "Must not…") -->
                <div>
                  <label class="block text-[10px] font-semibold text-red-600 uppercase tracking-wide mb-1">Description <span class="font-normal normal-case text-gray-400">— "Must…" or "Must not…" binary rule</span></label>
                  <textarea
                    :value="entry.description ?? ''"
                    rows="2"
                    class="w-full border border-red-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-400"
                    placeholder="Must comply with GDPR at all times"
                    @input="updateCEntry(idx, { description: ($event.target as HTMLTextAreaElement).value })"
                  />
                </div>

                <!-- Level 2+: scope + rationale (Template_Write_Constraint.md standard fields) -->
                <template v-if="editLevel >= 2">
                  <div>
                    <label class="block text-[10px] font-semibold text-red-600 uppercase tracking-wide mb-1">Scope <span class="font-normal normal-case text-gray-400">— what this constraint binds</span></label>
                    <textarea
                      :value="entry.scope ?? ''"
                      rows="2"
                      class="w-full border border-red-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-400"
                      placeholder="e.g. All data storage and transfer operations involving EU-resident personal data"
                      @input="updateCEntry(idx, { scope: ($event.target as HTMLTextAreaElement).value })"
                    />
                  </div>
                  <div>
                    <label class="block text-[10px] font-semibold text-red-600 uppercase tracking-wide mb-1">Rationale <span class="font-normal normal-case text-gray-400">— why this constraint exists</span></label>
                    <textarea
                      :value="entry.rationale ?? ''"
                      rows="2"
                      class="w-full border border-red-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-400"
                      placeholder="e.g. EU GDPR Article 44 prohibits transfer of personal data outside the EEA"
                      @input="updateCEntry(idx, { rationale: ($event.target as HTMLTextAreaElement).value })"
                    />
                  </div>
                </template>

                <!-- Level 3: ID + source citation -->
                <template v-if="editLevel >= 3">
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label class="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">ID</label>
                      <input
                        :value="entry.id ?? ''"
                        type="text"
                        class="w-full border border-red-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-red-400"
                        @input="updateCEntry(idx, { id: ($event.target as HTMLInputElement).value })"
                      />
                    </div>
                    <div>
                      <label class="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Source <span class="font-normal normal-case text-gray-400">— optional citation</span></label>
                      <input
                        :value="entry.source ?? ''"
                        type="text"
                        class="w-full border border-red-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-red-400"
                        placeholder="e.g. GDPR Art. 44; ISO 27001 A.13.2.1"
                        @input="updateCEntry(idx, { source: ($event.target as HTMLInputElement).value || undefined })"
                      />
                    </div>
                  </div>
                </template>

                <!-- Entry actions -->
                <div class="flex items-center justify-end gap-2">
                  <button
                    v-if="isChanged(entry.id)"
                    type="button"
                    class="h-7 px-3 rounded-lg text-[10px] font-medium bg-gray-100 text-gray-500 hover:bg-amber-100 hover:text-amber-700 transition-colors"
                    @click="revertEntry(entry.id)"
                    title="Discard your edits to this entry — restores the original description"
                  >↩ Revert</button>
                  <button
                    type="button"
                    class="h-7 px-4 rounded-lg text-[10px] font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors"
                    @click="doneEntry(entry.id)"
                    :title="isChanged(entry.id) ? 'Keep your edits and collapse this row (Undo restores at any time)' : 'Collapse this row — no edits made'"
                  >{{ isChanged(entry.id) ? '✓ Keep Change' : '▾ Collapse' }}</button>
                </div>
              </div>
            </div>
            <!-- Add Constraint button -->
            <button
              type="button"
              class="w-full flex items-center justify-center gap-2 h-11 rounded-xl border-2 border-dashed
                     text-[11px] font-semibold transition-all hover:opacity-90 mt-1"
              style="border-color:#fca5a5; color:#dc2626; background:#fef2f2"
              @click="handleAddEntry('constraints')"
            >
              <span class="font-mono font-bold text-[10px]">[→O→]</span>
              + Add Constraint
            </button>
          </template>

          <!-- ── SAVED VERSIONS tab ─────────────────────────────────────────── -->
          <template v-if="activeTab === 'versions'">
            <div v-if="editVersions.length === 0" class="text-center py-16">
              <p class="text-gray-400 text-sm">No Edit Versions saved yet.</p>
              <p class="text-gray-500 text-xs mt-2">
                Make changes and click "<span class="inline-flex items-center gap-1 align-middle"><SaveGlyph size="compact" class="inline-block h-3 w-auto -mt-0.5" /> Save Edit Version</span>" to create one.
              </p>
            </div>
            <div
              v-for="version in editVersions"
              :key="version.id"
              class="rounded-xl border border-gray-200 bg-white p-4 space-y-2"
            >
              <div class="flex items-start gap-3">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-semibold text-sm text-gray-900">{{ version.name }}</span>
                    <span class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-indigo-100 text-indigo-700">Level {{ version.level }} — {{ EDIT_LEVEL_LABELS[version.level] }}</span>
                    <span v-if="version.linkedTargetName" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-violet-100 text-violet-700">🎯 {{ version.linkedTargetName }}</span>
                    <span class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-amber-100 text-amber-700">{{ version.changedCount }} edited</span>
                  </div>
                  <p class="text-[10px] text-gray-400 mt-1">
                    Saved {{ new Date(version.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }}
                    — {{ version.spec.functions.length }}F · {{ version.spec.values.length }}V · {{ version.spec.solutions.length }}S
                  </p>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                  <!-- Open this version for further editing -->
                  <button
                    type="button"
                    class="h-7 px-2.5 rounded-lg text-[10px] font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
                    @click="openEditor(version.spec, { level: version.level, mode: 'draft', targetId: version.linkedTargetId, targetName: version.linkedTargetName, name: version.name }); activeTab = 'functions'"
                  >✎ Re-edit</button>
                  <!-- Promote to master -->
                  <button
                    type="button"
                    class="h-7 px-2.5 rounded-lg text-[10px] font-medium bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors"
                    @click="emit('commit-master', version.spec); emit('close')"
                  >📝 → Master</button>
                  <!-- Delete -->
                  <button
                    type="button"
                    class="h-7 w-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                    :aria-label="`Delete ${version.name}`"
                    @click="deleteEditVersion(version.id)"
                  >✕</button>
                </div>
              </div>
            </div>
          </template>
        </div>
      </ScrollContainer>

      <!-- ── "What now?" action bar ────────────────────────────────────────── -->
      <!-- Tom 2026-05-15: "after the edit it is dead, no display of the actual
           edit, no moving in to regen specs, not options, no invite to edit
           else." Visible whenever there are unsaved changes in the entry tabs.
           Surfaces the commit/save action clearly AND reminds the user they can
           keep editing other entries. -->
      <div
        v-if="hasChanges && activeTab !== 'versions'"
        class="shrink-0 flex items-center gap-3 px-5 py-3 bg-indigo-950 border-t border-indigo-800"
      >
        <span class="text-sm font-semibold text-indigo-200 shrink-0 flex items-center gap-1.5"><EditGlyph size="compact" class="h-3.5 w-auto shrink-0" aria-hidden="true" /> {{ changedCount }} {{ changedCount === 1 ? 'entry' : 'entries' }} edited</span>
        <span class="text-indigo-700 shrink-0">·</span>
        <span class="text-[11px] text-indigo-400 hidden sm:inline">
          Click any entry above to keep editing
        </span>
        <div class="flex-1" />
        <button
          type="button"
          class="h-8 px-3 rounded-lg text-[11px] font-medium bg-indigo-900 hover:bg-indigo-800
                 text-indigo-300 border border-indigo-700 transition-colors shrink-0"
          @click="revertAll"
        >↩ Revert All</button>
        <!-- Draft mode: Save Version (snapshot) -->
        <button
          v-if="editMode === 'draft'"
          type="button"
          class="h-8 px-4 rounded-lg text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-500
                 text-white transition-colors inline-flex items-center gap-1.5 shrink-0"
          @click="handleSaveDraft"
        >
          <SaveGlyph size="compact" class="h-3 w-auto" aria-hidden="true" />
          Save Version
        </button>
        <!-- Commit to Master — primary action in both modes -->
        <button
          type="button"
          class="h-8 px-4 rounded-lg text-[11px] font-semibold text-white transition-colors shrink-0"
          :class="editMode === 'master' ? 'bg-rose-600 hover:bg-rose-500' : 'bg-indigo-600 hover:bg-indigo-500'"
          @click="handleCommitMaster"
        ><EditGlyph size="compact" class="h-3.5 w-auto shrink-0" aria-hidden="true" /> Commit {{ changedCount }} change{{ changedCount !== 1 ? 's' : '' }} to Master</button>
      </div>

      <!-- ── Footer ─────────────────────────────────────────────────────────── -->
      <!-- r41 v281 (Tom Gilb 2026-06-22 "dark text unreadable") — was
           text-gray-500 (#6b7280) on bg-gray-900 (#111827) = contrast ratio
           ~4.0:1, fails WCAG AA for body text.  Bumped to text-slate-200
           (#e2e8f0) for ~14:1 contrast — clearly readable.  Dot separators
           bumped too. Composes with DD-017 SUPREME + universal accessibility
           (high contrast wins over fashionable subtlety for every reader). -->
      <div class="shrink-0 flex items-center gap-4 px-5 py-2.5 bg-gray-900 border-t border-gray-800 text-[10px] text-slate-200">
        <!-- r41 v239 (Tom Gilb 2026-06-21 verbatim "click any entry to edit … is not true … there should be a clearer click point").
             Made affordance explicit: each row now ends in a "▸ Click to Edit" pill, and clicking
             anywhere on the row toggles the editor. Bottom legend updated to point at the pill. -->
        <span>Click the <span class="font-semibold text-emerald-300">▸ Click to Edit</span> pill on any row (or anywhere on the row) to expand</span>
        <span class="text-slate-500">·</span>
        <span>Amber border = edited</span>
        <span class="text-slate-500">·</span>
        <span>↩ Revert restores the original</span>
        <div class="flex-1" />
        <span v-if="isLocked" class="text-indigo-200 font-semibold">🔒 Spec locked — unlock below to edit</span>
        <span v-else-if="editMode === 'master'" class="text-rose-300 font-semibold">⚠ MASTER MODE — changes overwrite the live plan</span>
        <span v-else class="text-emerald-300">DRAFT — master plan is safe until you commit</span>
      </div>

      <!-- Standard Done-Changing Close Footer (DD-standard-close-2026-06-09) -->
      <SpecActionFooter
        :change-count="changedCount"
        :last-saved="_lastSaved"
        :is-locked="isLocked"
        @close="handleClose"
        @save-version="editMode === 'master' ? handleCommitMaster() : handleSaveDraft()"
        @toggle-lock="isLocked ? unlock() : lock()"
      />

      <!-- ── Bulk draft review modal ─────────────────────────────────────────── -->
      <Transition
        enter-active-class="transition-all duration-200"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-all duration-150"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="showBulkReview && bulkDraftResults.size > 0"
          class="fixed inset-0 z-[700] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          @click="showBulkReview = false"
        >
          <div
            class="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col overflow-hidden"
            @click.stop
          >
            <!-- Header -->
            <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-violet-50 shrink-0">
              <div>
                <h3 class="text-lg font-bold text-gray-900">Review Draft Results</h3>
                <p class="text-xs text-gray-500 mt-0.5">{{ bulkDraftResults.size }} incomplete {{ bulkDraftResults.size === 1 ? 'value' : 'values' }}</p>
              </div>
              <!-- CloseDot rule: modal close -->
              <CloseDot
                variant="on-light"
                aria-label="Close Review Draft Results"
                title="Close this dialog"
                @click="showBulkReview = false"
              />
            </div>

            <!-- Content — scrollable list of draft results -->
            <ScrollContainer outer-class="flex-1 min-h-0" inner-class="h-full">
              <div class="p-4 space-y-3">
                <div
                  v-for="[entryId, result] of bulkDraftResults"
                  :key="entryId"
                  class="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2"
                >
                  <!-- Entry ID header -->
                  <p class="text-xs font-bold text-gray-700">{{ entryId }}</p>

                  <!-- Per-field row with checkbox -->
                  <div v-for="field of ['scale', 'tolerable', 'wish'] as const" :key="field" class="flex items-center gap-2 py-1.5">
                    <!-- Field label + value -->
                    <div class="flex-1 min-w-0">
                      <p class="text-[10px] font-semibold text-gray-600">{{ field }}</p>
                      <p class="text-xs text-gray-700">{{ result[field] || '—' }}</p>
                    </div>
                    <!-- Checkbox (include in accept) -->
                    <input
                      type="checkbox"
                      :checked="true"
                      class="shrink-0 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </ScrollContainer>

            <!-- Footer — action buttons -->
            <div class="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 shrink-0">
              <!-- Uncertainty toggle -->
              <div class="flex items-center gap-2">
                <span class="text-[10px] font-semibold text-gray-600">Mark uncertain:</span>
                <button
                  type="button"
                  class="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors"
                  :class="activeDraftTab === 'bulk' ? 'bg-amber-100 text-amber-700' : 'bg-gray-200 text-gray-600 hover:bg-amber-100 hover:text-amber-700'"
                  @click="activeDraftTab = activeDraftTab === 'bulk' ? 'bulk' : 'bulk'"
                >?</button>
              </div>
              <!-- Action buttons -->
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="h-9 px-4 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
                  @click="showBulkReview = false"
                >Cancel</button>
                <button
                  type="button"
                  class="h-9 px-4 rounded-lg text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                  @click="acceptAllDrafts(activeDraftTab === 'bulk')"
                >Accept All</button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </Teleport>
</template>
