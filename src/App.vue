<script setup lang="ts">
// App.vue — root component with auth guard and view routing
// Spec: S.EvoStep4.InvitationFlow / F.ImplementMultiUserAuthLayer
//       S.Evo7.EvoStepPlannerComponent / S.Evo8.TaskDecompositionComponent
//       S.Evo9.VDTTableComponent / S.Evo9.PrioritisedPlanExport
// Auth views are shown before the SEM entry form when not authenticated.

import { ref, computed, onMounted, onUnmounted, nextTick, watch, type ComponentPublicInstance } from 'vue'
import SEMEntryForm from './components/SEMEntryForm.vue'
import SpecOutput from './components/SpecOutput.vue'
// Ultra Light Phase 3 — "Naked Plan" aperture + single Menu pin.
// Tom 2026-05-14: *"white out everything except the input/output… one
// button which is used to get any more clutter… master Menu button is
// called 'Menu'. We can go back to Plan (the simple circle)."*
// Phase 3 Evo Step: dedicated shells for all 4 stub views.
import Aperture from './components/Aperture.vue'
import ApertureStart from './components/ApertureStart.vue'
import ApertureNovice from './components/ApertureNovice.vue'
import ApertureBasic from './components/ApertureBasic.vue'
import AperturePrevious from './components/AperturePrevious.vue'
import MenuPin from './components/MenuPin.vue'
import { useApertureMode } from './composables/useApertureMode'
import SignInView from './components/SignInView.vue'
import SignUpView from './components/SignUpView.vue'
import InviteAcceptView from './components/InviteAcceptView.vue'
import EvoPlanView from './components/EvoPlanView.vue'
import TaskList from './components/TaskList.vue'
import ImpactEstimationView from './components/ImpactEstimationView.vue'
import ImpactEstimationStepView from './components/ImpactEstimationStepView.vue'
import EvoToolsButton from './components/EvoToolsButton.vue'
import EvoToolsPanel from './components/EvoToolsPanel.vue'
import EvoSharpInterview from './components/EvoSharpInterview.vue'
import EvoStepImprovement from './components/EvoStepImprovement.vue'
import FeedMePanel from './components/FeedMePanel.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import PrioritisedPlanView from './components/PrioritisedPlanView.vue'
import ClarifyView from './components/ClarifyView.vue'
import ThinkingIndicator from './components/ThinkingIndicator.vue'
import CelebrationEffect from './components/CelebrationEffect.vue'
import ValueCounter from './components/ValueCounter.vue'
import { PLANNING_STAGES } from './data/planningStages'
// PlanningStageBar superseded by ValueCounter rebuild 2026-05-27 (design log r37)
// import PlanningStageBar from './components/PlanningStageBar.vue'
import CollaborationCursors from './components/CollaborationCursors.vue'
import FocusModeBackdrop from './components/FocusModeBackdrop.vue'
import ComparisonMode from './components/ComparisonMode.vue'
import SpecHistory from './components/SpecHistory.vue'
import CloseDot from './components/CloseDot.vue'
import ReplayOverlay from './components/ReplayOverlay.vue'
import ProjectDashboard from './components/ProjectDashboard.vue'
import LoadingProgress from './components/LoadingProgress.vue'
import VisualisePanelModal from './components/VisualisePanelModal.vue'
import SpecHeatLane from './components/SpecHeatLane.vue'
import EvoSimulatorView from './components/EvoSimulatorView.vue'
import ConflictAnalysisPanel from './components/ConflictAnalysisPanel.vue'
import SpecCollaboratorPanel from './components/SpecCollaboratorPanel.vue'
import { useSDK, buildMockSpec, cancelCurrentTranslate } from './composables/useSDK'
import { registerExclusiveSurface, closeActiveSurface } from './composables/useExclusiveSurfaces'
import { registerActivityScroll } from './composables/useActivityScroll'
import { useCollaborationCursors } from './composables/useCollaborationCursors'
import { useCollabConflict } from './composables/useCollabConflict'
import { useClarifyingQuestions } from './composables/useClarifyingQuestions'
import { useSpecExport, exportPrioritisedPlan, exportWithTasks, serialisePlainText, exportWithTasksPlainText } from './composables/useSpecExport'
import { openEml, textToEmailHtml } from './composables/useEmlExport'
import { renderColorfulSpecHtml } from './composables/useColorfulSpecHtml'
import { useAuth } from './composables/useAuth'
import { useWorkspace } from './composables/useWorkspace'
import { useLoadingState, _resetLoadingStateForTest as _forceClearLoading } from './composables/useLoadingState'
import { useDemoMode } from './composables/useDemoMode'
import { useSpecHistory, type SpecVersion } from './composables/useSpecHistory'
import { loadPlan as _loadEvoPlan, clearLoadedPlan as _clearEvoPlan, resetPlanForLoad as _resetPlanForLoad, useEvoPlan } from './composables/useEvoPlan'
import { useReplay } from './composables/useReplay'
import { useProjectDashboard } from './composables/useProjectDashboard'
import { useSessionPersist } from './composables/useSessionPersist'
import { useToast } from './composables/useToast'
import { useInputSafetyNet } from './composables/useInputSafetyNet'
import { useAnalyticsEvents } from './composables/useAnalyticsEvents'
import { useSurveyGate } from './composables/useSurveyGate'
import { useDictation } from './composables/useDictation'
import { speak, stopSpeaking, speakerSupported, speaking } from './composables/useSpeaker'
import { useArrowInfoPanel } from './composables/useArrowInfoPanel'
import SurveyGateModal from './components/SurveyGateModal.vue'
import DictateButton from './components/DictateButton.vue'
import SpeakerButton from './components/SpeakerButton.vue'
import SharpenPanel from './components/SharpenPanel.vue'
import SharpenDropdown from './components/SharpenDropdown.vue'
import { cancelSharpen, resetSharpen, startSharpen, useSharpen } from './composables/useSharpen'
import type { SharpenCategory } from './composables/useSharpen'
// PlanModelBar removed from active rendering 2026-05-12 (component file kept
// in src/components/ for reference; no current imports). The persistent
// purple Plan Identity Bar at the top of App.vue subsumes its functionality.
import SpecModelPanel from './components/SpecModelPanel.vue'    // r93 Plan→Spec Phase 2 rename; shim at PlanModelPanel.vue still re-exports for legacy consumers
import ModelComparisonView from './components/ModelComparisonView.vue'
import GetAPlanPanel from './components/GetAPlanPanel.vue'
import ContractHub from './components/ContractHub.vue'
import SpecOwnerPanel from './components/SpecOwnerPanel.vue'
import SpecStoryStrip   from './components/SpecStoryStrip.vue'
import SpecOwnersPanel from './components/SpecOwnersPanel.vue'
import SpecTargetsPanel from './components/SpecTargetsPanel.vue'
import SpecEditorPanel from './components/SpecEditorPanel.vue'
import SpecDirectRelations from './components/SpecDirectRelations.vue'
import ToolInfoPanel from './components/ToolInfoPanel.vue'
import PriorityRecordPanel from './components/PriorityRecordPanel.vue'
import GlobalPriorityPanel from './components/GlobalPriorityPanel.vue'
import PriorityInfoPanel from './components/PriorityInfoPanel.vue'
import EditInfoPanel from './components/EditInfoPanel.vue'
import SpecHealthStatusPanel from './components/SpecHealthStatusPanel.vue'
import SpecHealthAdminPanel from './components/SpecHealthAdminPanel.vue'
import SpecHealthTargetPanel from './components/SpecHealthTargetPanel.vue'
import EvoHealthPanel from './components/EvoHealthPanel.vue'
import HistoryGlyph from './components/icons/HistoryGlyph.vue'
import StandardsAuditorPanel from './components/StandardsAuditorPanel.vue'
import PlanguageAnalyzerPanel from './components/PlanguageAnalyzerPanel.vue'
import InternetContextPanel from './components/InternetContextPanel.vue'
import StudyActDataCollection from './components/StudyActDataCollection.vue'
// Planguage-family glyphs for the Plan Crest people chips — Tom 2026-06-04
// approved set replacing the dated 🔑 / 💡 / ⌨ emojis (per DD-011 / DD-012).
import OwnerGlyph from './components/icons/OwnerGlyph.vue'
import PlanGlyph from './components/icons/PlanGlyph.vue'
import PlannerGlyph from './components/icons/PlannerGlyph.vue'
import ScribeGlyph from './components/icons/ScribeGlyph.vue'
import SpecStoryGlyph from './components/icons/SpecStoryGlyph.vue'
import SpecHealthBadge from './components/SpecHealthBadge.vue'
import { useSpecHealth, type SpecHealthContext, type PlanHealthContext } from './composables/useSpecHealth'
import CopyrightPanel from './components/CopyrightPanel.vue'
import SaveGlyphHistoryPanel from './components/SaveGlyphHistoryPanel.vue'
import SymbolFamilyPanel from './components/SymbolFamilyPanel.vue'
import ActionsHubPanel from './components/ActionsHubPanel.vue'
import AgentMenuPanel from './components/AgentMenuPanel.vue'
import MariaAgentBoard from './components/MariaAgentBoard.vue'
import MariaBoardHub   from './components/MariaBoardHub.vue'
import HistoryPanel from './components/HistoryPanel.vue'
import ModelLibraryPanel from './components/ModelLibraryPanel.vue'
import StakeholderMapperPanel from './components/StakeholderMapperPanel.vue'
import EvoCritiquerPanel from './components/EvoCritiquerPanel.vue'
import SpecImporterPanel from './components/SpecImporterPanel.vue'
import DecisionMapperPanel from './components/DecisionMapperPanel.vue'
import MultiVisionPanel from './components/MultiVisionPanel.vue'
import MultiForksPanel from './components/MultiForksPanel.vue'    // r97 — new system fork diagram
import MultiForksGlyph from './components/icons/MultiForksGlyph.vue' // 2026-06-06 — canonical MultiForks glyph (replaces 🔱 emoji)
import PageScrollPin   from './components/PageScrollPin.vue'      // 2026-06-06 — universal "% shown" pin for page-level scroll
import { useMultiVision } from './composables/useMultiVision'
import SemMetadataPanel from './components/SemMetadataPanel.vue'
import ValueFlowPanel from './components/ValueFlowPanel.vue'
import ValueFlowDiagram from './components/ValueFlowDiagram.vue'
import SystemModelDashboard from './components/SystemModelDashboard.vue'
import ModelHistory from './components/ModelHistory.vue'
import GlyphDataPanel from './components/GlyphDataPanel.vue'
import PlTypeIcon from './components/icons/PlTypeIcon.vue'
import type { PlGlyphType } from './components/icons/PlTypeIcon.vue'
import { GLYPH_PANEL_OPEN_EVENT, GLYPH_PANEL_CLOSE_EVENT, GLYPH_PANEL_NAVIGATE_EVENT, glyphTypeFromDblClick } from './composables/useGlyphPanel'
import SaveGlyph from './components/icons/SaveGlyph.vue'
import EditGlyph from './components/icons/EditGlyph.vue'
import PlResourceIcon from './components/icons/PlResourceIcon.vue'
import ResourceArtsyGlyph from './components/icons/ResourceArtsyGlyph.vue'
import OptimaGlyph from './components/icons/OptimaGlyph.vue'
import ResourceOptimaPanel from './components/ResourceOptimaPanel.vue'
import PriorityTripleGlyph from './components/icons/PriorityTripleGlyph.vue'
import GetGlyph from './components/icons/GetGlyph.vue'
import CopyGlyph from './components/icons/CopyGlyph.vue'
import EmailGlyph from './components/icons/EmailGlyph.vue'
import MessageGlyph from './components/icons/MessageGlyph.vue'
import AnalyzeResourceGlyph    from './components/icons/AnalyzeResourceGlyph.vue'
import AnalyzeGenericGlyph     from './components/icons/AnalyzeGenericGlyph.vue'
import AnalyzeFunctionGlyph    from './components/icons/AnalyzeFunctionGlyph.vue'
import AnalyzeValueGlyph       from './components/icons/AnalyzeValueGlyph.vue'
import AnalyzeStakeholderGlyph from './components/icons/AnalyzeStakeholderGlyph.vue'
import AnalyzeTaskGlyph        from './components/icons/AnalyzeTaskGlyph.vue'
import AnalyzeEvoStepGlyph     from './components/icons/AnalyzeEvoStepGlyph.vue'
import ExportSpecPin from './components/ExportSpecPin.vue'
import AnalyzeTypeIcon         from './components/icons/AnalyzeTypeIcon.vue'
import { useTaskSuggestions } from './composables/useTaskSuggestions'
import ResourcesSharpenPanel from './components/ResourcesSharpenPanel.vue'
import ResourcesKissPanel from './components/ResourcesKissPanel.vue'
import ResourceCostEngineeringPanel from './components/ResourceCostEngineeringPanel.vue'
import BookCoverChip from './components/BookCoverChip.vue'
import ScrollContainer from './components/ScrollContainer.vue'
import {
  useSpecModel,
  initSpecModel,
  bumpSpecVersion,
  clearPlanModel,
  activatePlanModel,
  latestPlanModel,
  getAllPlanModels,
  saveSpecSnapshot,
  renameSpecModel,
  updatePlanOwner,
  addOwner,
  addPlanner,
  addScribe,
  exportAllPlanModelsBackup,
  importPlanModelsBackup,
  getDeviceUserName,
  setDeviceUserName,
  setWorkingMode,
  setDeadline,

  type SpecModel,
  type PlanModel,
} from './composables/useSpecModel'
import { clearComparison } from './composables/useModelComparison'
import SelectionDefiner from './components/SelectionDefiner.vue'
// 2026-05-14 — Fresh Start menu replaces the bare 🆘 Reset pill with a
// graduated 4-option popover (Blank Canvas / Save This and Stop / Cancel
// Recent Changes / Just close stuck UI). See vault Start-Over-Design.md.
import FreshStartMenu from './components/FreshStartMenu.vue'
import InputSafetyNetToast from './components/InputSafetyNetToast.vue'
import { formatBackupTimestamp } from './composables/useFreshStart'
import { defineCurrentSelection, openDefineSearch } from './composables/useDefine'
import SpecWizard from './components/SpecWizard.vue'
import SpecPresentation from './components/SpecPresentation.vue'
import BullockPanel from './components/BullockPanel.vue'
// AmuseMeButton is used inside SpecOutput.vue directly — not imported at App level
import OnboardingTour from './components/OnboardingTour.vue'
import type { SpecBlock } from './types/spec'
import GlobalSearch from './components/GlobalSearch.vue'
import { useGlobalSearch, type SearchEntry } from './composables/useGlobalSearch'
import { useToolInfo } from './composables/useToolInfo'
import { useCopyright } from './composables/useCopyright'
import { useSpecEditor } from './composables/useSpecEditor'
import { backfillSpecKeysFromPlanKeys } from './composables/useSpecKeyMigration'
import { resolveStageNavAction, STAGE_TOAST_MESSAGES, getStageAdvisory } from './composables/useStageNavigation'
import {
  initEntriesFromSpec,
  recordSharpenProvenance,
  countWords,
} from './composables/useEntryProvenance'
import type { EvoStep, EvoStepPlan } from './types/evo-plan'
import type { TaskSuggestion } from './types/task'
import type { ImpactMatrix } from './types/impact'
import { computeMockImpactSnapshot } from './composables/useImpactSuggestions'

// --- Boot diagnostics (2026-05-12) ──────────────────────────────────────────
// Tom reports the app starts but never advances past the loading view, even
// after the 12 s watchdog. To distinguish module-load hangs from setup-body
// hangs from onMounted-never-firing, log a marker at each phase. If the user
// sees "[boot] script-setup start" but not "[boot] script-setup end", the
// hang is in setup. If "[boot] onMounted entered" never appears, Vue mount
// itself failed (template error or sync exception in setup). All logs use
// the "[boot]" prefix so they are trivially greppable in DevTools.
console.log('[boot] script-setup start', new Date().toISOString())

// --- Evo Step 10: Analytics + Survey Gate ------------------------------------
// mountMs captured before any async work so EntryFluency elapsed times are correct.
const _mountMs = Date.now()
const analytics = useAnalyticsEvents(_mountMs)
const survey = useSurveyGate()
// Expose reactive refs for template binding — nested refs inside plain objects
// are NOT auto-unwrapped in Vue 3 templates, so we hoist them to top-level.
const surveyVisible = survey.surveyVisible
const activeSurveyQuestion = survey.activeSurveyQuestion

const { loading: sdkLoading, error: sdkError, translate } = useSDK()
const { questions: clarifyQuestions, loading: clarifyLoading, generateQuestions } = useClarifyingQuestions()
const { serialise } = useSpecExport()
const { user, init, signOut } = useAuth()
const { loadWorkspaces, createWorkspace, selectWorkspace, workspaces, currentWorkspace } = useWorkspace()
// 2026-05-13 — `_forceClearLoading` (aliased from `_resetLoadingStateForTest`)
// is re-purposed as the production panic-clear, called from the 🆘 Reset
// button + the hung-generation watchdog. A stuck loading indicator otherwise
// has no recovery path because every call site uses a try/finally that won't
// fire if the await never resolves (e.g. browser-tab throttled API socket).
const { startLoading, stopLoading, isLoading } = useLoadingState()

// --- Session persistence (crash/eviction recovery) ---
const { save: _saveSession, load: _loadSession, clear: _clearSession, timeAgo } = useSessionPersist()
const { toast: globalToast, showToast } = useToast()
/** True when the current view was restored from a saved session (shows "Start fresh" pill). */
const sessionRestored = ref(false)

// --- Feature #16: Collaboration Cursors ---
// workspaceId is passed as the current workspace id at init time.
// If workspace isn't loaded yet (null), the feature degrades gracefully (isActive stays false).
const { remoteCursors, start: startCursors, stop: stopCursors } = useCollaborationCursors(
  currentWorkspace.value?.id ?? null,
)

// --- Feature #40: Animated Value Delivery Replay ---
const { isReplaying, replayStep, replayValue, startReplay, stopReplay } = useReplay()

// --- Feature #71: Spec Presentation Mode ---
const presentationOpen = ref(false)

// --- Sharpening Cycles ---
// sharpeningDone: true once the planner clicks "Sharp Enough" in Stage 1.
// Resets whenever a new spec is generated so each spec starts unsharped.
const sharpeningDone = ref(false)
// sharpenModalOpen: true when the nav "Sharpen ▾" dropdown opens the modal.
const sharpenModalOpen = ref(false)
// resourcesSharpenOpen: true when Stage 10 · Resources Sharpening panel is open.
const resourcesSharpenOpen = ref(false)
// optimaOpen: true when Stage 10 · OPTIMA Resource Optimization panel is open.
const optimaOpen = ref(false)
// kissOpen: true when Stage 10 · KISS panel is open.
// KISS = Keep Improvement Super Surprising — 5 most cost-effective spec improvements.
const kissOpen = ref(false)
// costEngineeringOpen: true when Stage 10 · Cost Engineering tool is open.
// Tom 2026-06-05: "COST ENGINEERING: THE TOOL, SEPARATE TOOL for Dynamic (Evo Step)
// Design to [Cost, Value, Constraint] and for initial statics upfront."
const costEngineeringOpen = ref(false)


// Tom 2026-06-04 r88 — Phase 2 of Resources beef-up: write-back from
// Claudian analysis.  The panel emits `apply-analysis` with an updated
// SpecBlock after the user ticks per-finding approval.  We replace
// currentSpec.value, persist the snapshot to the active specModel, and
// log a one-line provenance breadcrumb.
function _onResourcesAnalysisApplied(updatedSpec: SpecBlock): void {
  currentSpec.value = updatedSpec
  if (specModel.value) saveSpecSnapshot(updatedSpec)
  console.log('[ResourcesAnalysis] applied — spec now has',
    updatedSpec.resources?.length ?? 0, 'R.,',
    updatedSpec.solutions?.length ?? 0, 'S.,',
    updatedSpec.constraints?.length ?? 0, 'C.')
}
// bullockOpen: true when the Bullock Audit Trail modal is open.
const bullockOpen = ref(false)
// sharpenedEntryIds: reactive list of entry IDs touched by sharpening rounds.
// Passed to SpecOutput so each changed entry shows a 🔪 badge.
const { sharpenedEntryIds, rounds: sharpenRounds, phase: sharpenPhase } = useSharpen()

/** Tracks the moment sharpening last completed — used in the spec header summary line. */
const lastSharpenedAt = ref<Date | null>(null)
watch(sharpenRounds, (rounds) => {
  if (rounds.length) lastSharpenedAt.value = new Date()
})

/** Single-object sharpening summary — total change count + timestamp, passed to SpecOutput. */
const sharpenSummary = computed(() => {
  if (!sharpenRounds.value.length) return null
  const totalChanges = sharpenRounds.value.reduce((sum, r) => sum + r.changes.length, 0)
  return { totalChanges, at: lastSharpenedAt.value }
})

// --- Feature #177: Generated-at timestamp ---
// Set whenever a spec is generated (doTranslate) or restored (session).
// Passed to SpecOutput for display in the spec header.
const specGeneratedAt = ref<Date | null>(null)

// --- Plan Model ---
// Named, versioned model tracking for each spec/plan pair.
// Initialised in doTranslate(); bumped in onSpecSharpened().
const { currentModel: specModel, allModels: _allSpecModels } = useSpecModel()

// Live "now" tick for the top bar's save-time label (refreshed every 30 s)
const _topBarNow = ref(Date.now())
const _topBarTimer = setInterval(() => { _topBarNow.value = Date.now() }, 30_000)
onUnmounted(() => clearInterval(_topBarTimer))

/** "Saved 4:32 PM" or "Saved 3 min ago" label for the persistent plan bar. */
const specBarSavedLabel = computed((): string => {
  const ts = specModel.value?.updatedAt
  if (!ts) return ''
  const elapsed = Math.floor((_topBarNow.value - new Date(ts).getTime()) / 60_000)
  if (elapsed < 1) return 'Saved just now'
  if (elapsed < 60) return `Saved ${elapsed} min ago`
  const d = new Date(ts)
  const h = d.getHours(); const m = d.getMinutes().toString().padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `Saved ${h % 12 || 12}:${m} ${ampm}`
})

/** True when ≥2 minutes have elapsed since the last save — prompts a Save button in the top bar. */
const specBarUnsaved = computed((): boolean => {
  const ts = specModel.value?.updatedAt
  if (!ts) return false
  return Math.floor((_topBarNow.value - new Date(ts).getTime()) / 60_000) >= 2
})

// ── "Saved N min ago" IS the Save Now button ──────────────────────────────
//
// Tom 2026-05-13: "saved n minutes ago is also a save now button, design this".
// The old design had TWO controls side-by-side: a read-only "Saved 3 min ago"
// label + a separate "💾 Save" button (only visible after 2 min of staleness).
// That's two affordances doing one job. Merge them: the label IS the button.
// Always clickable. Hover flips its label to "💾 Save now". After a click it
// flashes "✓ Saved just now" green for 1.4 s, then the relative-time label
// resumes from the new timestamp. When ≥2 min stale, the chrome shifts to
// amber/warning to call attention — the affordance is the same shape, only
// the urgency colouring changes.
const _saveFlash = ref<'idle' | 'flash'>('idle')
let _saveFlashTimer: ReturnType<typeof setTimeout> | null = null
function savedLabelClick(): void {
  savePlanNow()
  _saveFlash.value = 'flash'
  if (_saveFlashTimer) clearTimeout(_saveFlashTimer)
  _saveFlashTimer = setTimeout(() => { _saveFlash.value = 'idle' }, 1400)
}
onUnmounted(() => { if (_saveFlashTimer) clearTimeout(_saveFlashTimer) })

// Feature #197 — Purposes summary line: first 3 F. descriptions joined, truncated to 120 chars
const _purposesSummary = computed((): string => {
  const fns = currentSpec.value?.functions
  if (!fns?.length) return ''
  const text = fns.slice(0, 3).map(f => f.description).filter(Boolean).join(' · ')
  return text.length > 120 ? text.slice(0, 117) + '…' : text
})

// --- Rename / owner popover ---
// Small inline popover for renaming the active plan model and setting its owner.
const renamePopoverOpen  = ref(false)
const renameInputVal     = ref('')
const renameOwnerVal     = ref('')

// --- Inline title edit (Plan Crest hero row) ---
// Tom 2026-05-12: "and can we easily directly edit the title?" — clicking the
// big gold-shimmer plan title flips it in place to an editable input. Enter or
// blur saves; Esc cancels. The popover (which also edits owner) stays
// available from the Detail menu for power-user multi-field edits.
const titleEditing  = ref(false)
const titleDraft    = ref('')
const titleInputEl  = ref<HTMLInputElement | null>(null)

function startTitleEdit(): void {
  titleDraft.value   = specModel.value?.name ?? ''
  titleEditing.value = true
  nextTick(() => {
    titleInputEl.value?.focus()
    titleInputEl.value?.select()
  })
}
function commitTitleEdit(): void {
  const trimmed = titleDraft.value.trim()
  if (trimmed && specModel.value && trimmed !== specModel.value.name) {
    renameSpecModel(specModel.value.id, trimmed)
  }
  titleEditing.value = false
}
function cancelTitleEdit(): void {
  titleEditing.value = false
}

// ── DEADLINE edit handler — Tom 2026-06-06 r98 ──────────────────────────────
// Extracted from the inline @click on the DEADLINE pill because the Vue
// template parser cannot handle the `\\'` escapes inside a quoted attribute
// (Vite parse error: "Expecting Unicode escape sequence"). Named function is
// the canonical fix for any handler containing string literals with
// apostrophes / nested quotes / backslashes.
function editDeadline(): void {
  if (!specModel.value) return
  const examples = [
    String.fromCharCode(39) + '?' + String.fromCharCode(39),
    String.fromCharCode(39) + '2027-Q1' + String.fromCharCode(39),
    String.fromCharCode(39) + '60 days from kickoff' + String.fromCharCode(39),
    String.fromCharCode(39) + 'before EU AI Act enforcement' + String.fromCharCode(39),
  ].join(', ')
  const promptMsg = 'Project DEADLINE — scalar Condition [When]. Free text accepted (e.g. ' + examples + ').'
  const next = window.prompt(promptMsg, specModel.value.deadline || '?')
  if (next !== null) setDeadline(next)
}

// ── Floating ⋯ Menu ────────────────────────────────────────────────────────
// Single toggle that surfaces all secondary actions in a grouped popover.
const menuOpen      = ref(false)
const menuScrollEl  = ref<HTMLElement | null>(null)
const menuHasMore   = ref(false)

function _checkMenuScroll(): void {
  const el = menuScrollEl.value
  if (!el) return
  menuHasMore.value = el.scrollHeight - el.scrollTop - el.clientHeight > 4
}

watch(menuOpen, (open) => {
  if (open) {
    nextTick().then(_checkMenuScroll)
  } else {
    menuHasMore.value = false
  }
})

// De-duplicate using event-object identity: two handlers from the same DOM event
// share the exact same Event instance, so a second call is a no-op.
// This is more reliable than Promise/setTimeout debouncing, especially in Safari.
let _lastMenuEvent: Event | null = null
function toggleMenu(e?: Event): void {
  if (e && e === _lastMenuEvent) return
  _lastMenuEvent = e ?? null
  menuOpen.value = !menuOpen.value
  renamePopoverOpen.value = false
}

// ── Visualise / Heat Lane / Evo Simulator / Conflict Detector / Collaborator ─
const visualiseOpen          = ref(false)
/** Entry ID to amber-highlight in the Value Flow diagram when opening from "🌊 Flow" button.
 *  Tom 2026-05-16: "Show Value Flow Relation" — highlights the origin entry node. */
const _vizHighlightId        = ref('')
/** Pre-select tab when opening VisualisePanelModal from the Visualize gallery on stage 5.
 *  Tom 2026-05-17: redesigned visualize bar on PrioritisedPlanView to a thumbnail gallery
 *  with one card per diagram type — clicking opens the modal at that specific tab. */
const _vizInitialTab         = ref<string>('')
const heatLaneOpen           = ref(false)
const evoSimulatorOpen       = ref(false)
// Tom 2026-06-03 — Evo Tools marker: catalogue of Evo-specialised tools
// (Value Flow, Evo Simulator, V × Step VDT, Critique, etc.) opened via
// EvoToolsButton in the right pin cluster.  Registered as an exclusive
// surface below so opening it closes other modals.
const evoToolsOpen           = ref(false)
// Tom 2026-06-03 — first Evo Tool detailed: "Sharpen Next Step" (the Evo
// Sharp Interview).  12-category structured interview that crystallises
// the next Evo Step before commit.  Tom's 8 categories + 4 PROPOSED.
const evoSharpOpen           = ref(false)
// Tom 2026-06-03 — second Evo Tool detailed: "Evo Step Improvement".  The
// Evo Planner proposes a crazy first shot, critiques it, offers 1–5 better
// ideas, plus a Skunkworks section of Daring and Wild Evo Ideas (2×–10×
// daring shots at higher risk and cost).  File-read pattern; no in-app AI.
const evoStepImprovementOpen = ref(false)
// Tom 2026-06-03 — third Evo Tool detailed: "FEED ME!" (Audrey II nod).
// Feedback + Learning tool: 3 sources (Feedback Base / Evo Base / Last Step
// in Paris) + tough questions for DEV + recommended actions with required
// audit trail (Source + Reason).  File-read pattern.
const feedMeOpen             = ref(false)
// Tom 2026-06-03 — SEM Settings Panel (long-requested, finally ratified).
// Mode (Ultra Light / Pro SEM) + AI Max level + Privacy + Evo defaults +
// Visual + Workflow + Export + Collab + Diagnostics.  v1: panel + persistence;
// component consumption of individual settings ships incrementally.
const settingsOpen           = ref(false)
const conflictAnalysisOpen   = ref(false)
const collaboratorOpen       = ref(false)

// Close menu, rename popover, history, and ArrowInfoPanel on Escape.
// Belt-and-suspenders: _onGlobalKeydown also fires closeActiveSurface() on Escape,
// but that handler is registered later and renamePopoverOpen / openArrowIdx are not
// exclusive surfaces (boolean-ref requirement not met by number|null).
// historyOpen   added 2026-05-28 — bug "history would not close".
// closeArrowInfo added 2026-05-28 — bug "Escape does not work" (ArrowInfoPanel stuck).
const { closeArrow: closeArrowInfo } = useArrowInfoPanel()
function _onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    menuOpen.value = false
    renamePopoverOpen.value = false
    historyOpen.value = false
    closeArrowInfo()   // ArrowInfoPanel uses number|null state — not in exclusive registry
  }
}
onMounted(() => window.addEventListener('keydown', _onKeydown))
onUnmounted(() => window.removeEventListener('keydown', _onKeydown))

function openRenamePopover(): void {
  renameInputVal.value  = specModel.value?.name ?? ''
  renameOwnerVal.value  = specModel.value?.owners?.[0]?.name ?? ''
  renamePopoverOpen.value = true
}

function submitRename(): void {
  const trimmed = renameInputVal.value.trim()
  if (trimmed && specModel.value) {
    renameSpecModel(specModel.value.id, trimmed)
  }
  // Update just the owner name from the quick-rename popover
  // (full contact details are edited via PlanOwnerPanel)
  updatePlanOwner({ name: renameOwnerVal.value.trim() })
  renamePopoverOpen.value = false
}

// --- Security Backup + Restore ---
// Backup: calls exportAllPlanModelsBackup() and shows a toast naming the file.
// Restore: triggers a hidden file input; on file pick, merges models from backup.
const restoreFileInputRef = ref<HTMLInputElement | null>(null)

function backupAllModels(): void {
  const now      = new Date()
  const date     = now.toISOString().slice(0, 10)
  const hh       = now.getHours().toString().padStart(2, '0')
  const mm       = now.getMinutes().toString().padStart(2, '0')
  const filename = `sem-app-backup-${date}-${hh}${mm}.json`
  exportAllPlanModelsBackup()
  showToast(`🛡️ Backup saved · ${filename} · Downloads folder`, 6000)
}

function openRestorePicker(): void {
  restoreFileInputRef.value?.click()
}

/**
 * Code Snapshot — copies a Terminal git archive command to the clipboard and
 * shows a toast so Tom knows exactly how to create a local ZIP of the source code.
 * The code is already committed to GitHub; this provides an extra local backup.
 * Rationale: web apps cannot invoke shell commands directly; the clipboard is the
 * bridge between the browser and the user's Terminal. (2026-05-28)
 */
function showCodeSnapshotTip(): void {
  const today  = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const cmd    = `cd ~/Developer/sem-app && git archive HEAD --format=zip --output=~/Desktop/sem-app-${today}.zip && echo "✅ Saved to Desktop"`
  navigator.clipboard.writeText(cmd).catch(() => {/* clipboard denied — toast still shows */})
  showToast(
    `💻 Command copied to clipboard! Open Terminal → ⌘V → Enter → ZIP saves to Desktop as sem-app-${today}.zip`,
    10_000,
  )
}

function handleRestoreFile(event: Event): void {
  const input = event.target as HTMLInputElement
  const file  = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const data  = JSON.parse(e.target?.result as string)
      const count = importPlanModelsBackup(data)
      if (count === 0) {
        showToast('⚠️ Restore — no new models found (all may already exist)', 5000)
      } else {
        showToast(`✅ Restored · ${count} model${count !== 1 ? 's' : ''} added from backup`, 6000)
      }
    } catch {
      showToast('❌ Restore failed — file could not be read', 5000)
    }
  }
  reader.readAsText(file)
  input.value = ''
}

// --- Model Comparison ---
const comparisonOpen = ref(false)

// --- Models Panel (browse / rename / delete all saved models) ---
const modelsOpen = ref(false)

// --- Spec Input (import existing spec) ---
const specInputOpen = ref(false)

// --- Feature #77: Animated Onboarding Tour ---
// Tour is opt-in only — opens via the "Tour" button or voice command, never automatically.
const tourOpen = ref(false)

// --- Feature #50: Multi-project Dashboard ---
const {
  entries: dashboardEntries,
  addEntry: addToDashboard,
  updateEntry: updateDashboardEntry,
  removeEntry: removeDashboardEntry,
  clearAll: clearDashboard,
} = useProjectDashboard()
const dashboardOpen = ref(false)
/** ID of the Spec History entry for the currently active spec generation session. */
const currentDashboardEntryId = ref<string | null>(null)

// --- Feature #53: Progressive spec wizard ---
const wizardOpen = ref(false)

async function handleWizardSubmit(
  wizardStakes: string,
  wizardEnds: string,
  wizardMeans: string,
  _oneLiner: string,
): Promise<void> {
  wizardOpen.value = false
  await handleSubmit({ stakes: wizardStakes, ends: wizardEnds, means: wizardMeans })
  // After generation the user stays at stage 1 (spec view) so they can see the
  // result before choosing to advance — consistent with the SEMEntryForm flow.
}

// --- Feature #17: Comparison Mode ---
const comparisonMode = ref(false)

// --- Spec Owner panel + Spec Owners / Governance panel ---
const specOwnerPanelOpen  = ref(false)
const specPeopleTab       = ref<'owners' | 'planners' | 'scribes'>('owners')
const govPanelOpen        = ref(false)
// --- Spec Story / Planner Consequences strip ---
const specStoryOpen         = ref(false)
function _togglePlanStory(): void {
  specStoryOpen.value = !specStoryOpen.value
}

// ── Stage bar layout: fixed at top-0, Plan Crest sits below it ───────────────
// Stage bar (ValueCounter) is fixed at the very top of the viewport (top-0)
// when a plan is loaded, so it is always immediately visible above everything
// else. Plan Crest sits below it at fixed top-[STAGE_BAR_H].
// ResizeObserver tracks Plan Crest height so toggling the DNA strip
// automatically adjusts content padding-top — no hardcoded crest height needed.
const STAGE_BAR_H  = 148    // ValueCounter nav: py-3(12px) + pill(120px) + pb-1(4px) + py-3(12px) = 148px
const specCrestEl  = ref<HTMLElement | null>(null)
const specCrestH   = ref(0)
let _specCrestRO: ResizeObserver | null = null
watch(specCrestEl, (el) => {
  _specCrestRO?.disconnect()
  _specCrestRO = null
  if (!el) { specCrestH.value = 0; return }
  _specCrestRO = new ResizeObserver(() => {
    specCrestH.value = Math.round(el.getBoundingClientRect().height)
  })
  _specCrestRO.observe(el)
  specCrestH.value = Math.round(el.getBoundingClientRect().height)
})
onUnmounted(() => _specCrestRO?.disconnect())
// contentTopPad: padding-top on the main content div.
// When plan loaded: stage bar (STAGE_BAR_H) + Plan Crest (live height) cleared.
// When no plan: stage bar is in document flow (not fixed), pt-8 static used.
const contentTopPad = computed(() =>
  (view.value === 'app' && specModel.value)
    ? STAGE_BAR_H + specCrestH.value
    : undefined
)
// --- Feature #195: Spec Targets ---
const specTargetsOpen     = ref(false)
// --- Agent Menu + Maria panels (2026-05-29 / 2026-05-30) ---
const agentMenuOpen       = ref(false)
const mariaOpen           = ref(false)           // MariaAgentBoard — analysis panel
const mariaBoardOpen      = ref(false)           // MariaBoardHub   — settings + activity log
const unifiedHistoryOpen  = ref(false)           // HistoryPanel — unified history across all entities
const modelLibraryOpen    = ref(false)           // ModelLibraryPanel — domain model library
const stakeholderMapperOpen = ref(false)         // StakeholderMapperPanel — AI attribute profiles
const evoCritiquerOpen      = ref(false)         // EvoCritiquerPanel — Evo health check
const specImporterOpen      = ref(false)         // SpecImporterPanel — universal Planguage converter
const decisionMapperOpen    = ref(false)         // DecisionMapperPanel — decision analysis
const { isOpen: multiVisionOpen, openMultiVision } = useMultiVision()
// Tom 2026-06-06 r97 — MultiForks system fork diagram (accessed from MultiVision footer + Visuals panel).
const multiForksOpen = ref(false)
function openMultiForks(): void { multiForksOpen.value = true }
// --- Spec Direct Relations (SDR) ---
const sdrOpen      = ref(false)
const _sdrEntryId  = ref('')
const _sdrEntryTab = ref<'functions' | 'values' | 'solutions' | 'evo-steps'>('values')
/** Which diagram surface opened the SDR — used by "← back to diagram" to reopen the right one. */
const _sdrReturnTo = ref<'valueFlow' | 'visualise'>('valueFlow')

function _openSdr(
  tab:      'functions' | 'values' | 'solutions' | 'evo-steps',
  entryId:  string,
  returnTo: 'valueFlow' | 'visualise' = 'valueFlow',
): void {
  _sdrEntryTab.value  = tab
  _sdrEntryId.value   = entryId
  _sdrReturnTo.value  = returnTo
  sdrOpen.value       = true
}

/** Called by SpecDirectRelations "← back to diagram" — closes SDR and reopens the originating diagram. */
function _sdrBackToDiagram(): void {
  sdrOpen.value = false
  if (_sdrReturnTo.value === 'visualise') {
    visualiseOpen.value = true
  } else {
    valueFlowOpen.value = true
  }
}

/** Called by SDR or ValueFlowPanel when user clicks a Task node / T dot.
 *  Closes any open diagram surface and jumps straight to Task Decomposition. */
function _onGoToTasks(): void {
  sdrOpen.value       = false
  valueFlowOpen.value = false
  stage.value         = 4
}

// --- Feature #196: Spec Editor ---
const specEditorOpen      = ref(false)
const contractsOpen       = ref(false)
const _editorTarget       = ref<{ id: string; name: string }>({ id: '', name: '' })
const _editorTab          = ref<'functions' | 'values' | 'solutions' | 'constraints' | 'versions' | ''>('')
const _editorEntryId      = ref('')
/** Which diagram surface to return to when "Back to Value Flow Diagram" is clicked.
 *  null = editor was NOT opened from the Value Flow (no back strip shown). */
const _editorReturnTo     = ref<'visualise' | 'valueFlow' | null>(null)

/** Handler for SpecEditorPanel's back-to-value-flow emit.
 *  Closes the editor and reopens whichever diagram surface was the origin.
 *  When returnTo is null (editor opened from a non-diagram path), defaults to
 *  opening VisualisePanelModal — so the "Back" button always does something useful.
 *  Tom 2026-05-16: "there is no patch back to the value flow diagram or anything there." */
function _handleBackToValueFlow(): void {
  const returnTo = _editorReturnTo.value
  _closeSpecEditor()
  if (returnTo === 'valueFlow') valueFlowOpen.value  = true
  else                          visualiseOpen.value  = true  // 'visualise' or null → gallery
}

/** Handler for SpecEditorPanel's 'show-in-value-flow' emit.
 *  Closes the editor, sets the highlight target, and opens the Visualise gallery.
 *  An empty entryId ("All in Flow" button) still opens the gallery but clears the highlight.
 *  Tom 2026-05-16: "Show Value Flow Relation, next to Edit button." */
function _handleShowInValueFlow({ entryId }: { tab: string; entryId: string }): void {
  _vizHighlightId.value = entryId
  _closeSpecEditor()
  visualiseOpen.value = true
}

/** Central helper — opens the Spec Editor pre-routed to a tab and/or entry.
 *  Pass `returnTo` when opening from the Value Flow diagram so the editor
 *  shows a "Back to Value Flow Diagram" navigation strip. */
function _openSpecEditor(opts?: {
  tab?:      'functions'|'values'|'solutions'|'constraints'
  entryId?:  string
  /** Which diagram surface to return to when the user hits "Back". */
  returnTo?: 'visualise' | 'valueFlow'
}): void {
  _editorTab.value      = opts?.tab     ?? ''
  _editorEntryId.value  = opts?.entryId ?? ''
  _editorReturnTo.value = opts?.returnTo ?? null
  specEditorOpen.value  = true
}

function _closeSpecEditor(): void {
  specEditorOpen.value  = false
  _editorTarget.value   = { id: '', name: '' }
  _editorTab.value      = ''
  _editorEntryId.value  = ''
  _editorReturnTo.value = null
}
// --- Feature #197: Tool Info ---
const toolInfoPanelOpen   = ref(false)
// --- SEM Metadata scoreboard panel ---
const semMetadataPanelOpen = ref(false)
const { getMeta: _getToolMeta } = useToolInfo()
const { markCommitted: _markSpecCommitted } = useSpecEditor()
// --- Copyright & Attribution ---
const copyrightPanelOpen  = ref(false)
const { shortNotice: _copyrightShortNotice } = useCopyright()
// --- DD-001 · "About the Save Glyph" panel (2026-05-13) ---
// Opens from the Detail-menu "About" group and from the ⌘F palette. Shows
// the ~1500-word essay backing the `*→[*]` / `[*]→*` notation with Copy +
// Email actions. Single source of truth lives in the vault Save-Glyph-History.md
// and is mirrored verbatim into the TS composable so the panel works offline.
const saveGlyphHistoryOpen = ref(false)

// --- Feature #199: Priority Decision Recording ---
const priorityPanelOpen   = ref(false)
const _priorityEntryId    = ref('')
const _priorityEntryType  = ref<'F' | 'V' | 'S'>('F')
const _priorityEntryDesc  = ref('')

// --- Feature #201: Global Priority (Stakeholders / V·C·C / Solutions) ---
const globalPriorityOpen  = ref(false)

// --- About the Priority Glyph (DD-002, 2026-05-13) ---
// Modal opened by the `?` micro-affordance on the Priority button, by the
// ⌘F palette "About the Priority Glyph", or by the Detail-menu About row.
// Mirrors the Save-Glyph-history pattern — same z-tier rules, same Copy +
// Email actions, amber-themed instead of slate. Registered as an exclusive
// surface so it auto-closes any other open full-screen panel.
const priorityInfoOpen = ref(false)

// --- About the Edit Glyph ([*]→[**]) ---
// Modal opened by the `?` micro-affordance on Edit buttons, by the
// ⌘F palette "About the Edit Glyph", or by the Detail-menu About row.
// Same z-tier as priorityInfoOpen (482/483). Slate-themed.
const editInfoOpen = ref(false)

// --- Symbol Family panel (Tom 2026-05-15: "people like that") ---
// Unified exhibit of all 5 Gilb keyed icons with history, semantics, and
// the shared design grammar. z-[484/485] — above priority (482/483).
const symbolFamilyOpen = ref(false)

// Value Flow diagram panel — causal chain:
// Tasks → Evo Steps → Solutions → Values → Functions → Stakeholders.
// 2026-05-15 (Tom Gilb). z-[486/487] — above SymbolFamily.
const valueFlowOpen = ref(false)

// System Model Dashboard — full-screen model health panel.
// Shown when the active PlanModel has workingMode === 'model'.
// z-[488/489] — same tier as ValueFlow (exclusive surface handles mutual exclusion).
const modelDashboardOpen = ref(false)

// P7 (2026-05-27): Model History panel — all PlanModel records (plan + model mode).
// z-[492/493] — above SystemModelDashboard (488/489) and ArrowInfoPanel (490/491).
const modelHistoryOpen = ref(false)

// P2 (2026-05-27): GlyphDataPanel — full reference card for any Planguage glyph.
// z-[650/651] — above all other panels.
//
// DD-013 (2026-06-01): universal double-click rule. PlTypeIcon dispatches a DOM
// CustomEvent ('glyph-panel:open') on dblclick. State lives HERE (App.vue local
// refs), not in useGlyphPanel composable. CustomEvent bus eliminates all module-
// singleton HMR fragility — the document is always the same object, no module
// re-evaluation can create a split. Listener is registered in onMounted below.
const glyphPanelOpen = ref(false)
const glyphPanelType = ref<PlGlyphType | null>(null)

function openGlyphPanel(type: PlGlyphType): void {
  glyphPanelType.value = type
  glyphPanelOpen.value = true
}
function closeGlyphPanel(): void {
  glyphPanelOpen.value = false
}
function navigateGlyphPanel(type: PlGlyphType): void {
  glyphPanelType.value = type
}

/** True when the active plan model is in 'model' mode (not plan mode). */
const isModelMode = computed(() => specModel.value?.workingMode === 'model')

// --- Feature #202: Plan Health (PHI badge + Status + Administration) ---
// Two sister panels per Tom's design:
//   • Status (read-only) — PHI breakdown + history graph + notifications
//   • Administration — weights, custom aspects, notification policy, snapshots
// Badge click → Status by default. Each panel has a header link to the other.
const specHealthStatusOpen = ref(false)
const specHealthAdminOpen  = ref(false)
// Tom 2026-06-03 (decision B for 2026-05-27 Plan Health tile naming WAIT row):
// Spec Health Target — sibling of Status + Admin.  "Target and Administration
// are vital" → both deserve their own tile, distinct from Status.
const specHealthTargetOpen = ref(false)
// Tom 2026-06-03 — EHT (Evo Health Tool): same structure as PHI but focused
// on Evo Steps + short-term scope (Next / Next-5 / All).  v1 scaffold ships
// detector + approval UI; v2 wires real Cure application + email-to-Owner.
const evoHealthOpen        = ref(false)
// Tom 2026-06-03 Conjunction Exploit #1 — Planguage-vs-Standards Auditor
const standardsAuditorOpen = ref(false)
// Tom 2026-06-03 Conjunction Exploit #5 — Planguage Analyzer (unified)
const planguageAnalyzerOpen = ref(false)
// Tom 2026-06-03 Conjunction Exploit #3 + #4 — Internet Context Fetcher (Stakeholder + Industry Benchmark)
const internetContextOpen = ref(false)
/**
 * Live Plan Health Index for the badge on the Plan ID bar.
 * Recomputes whenever spec or governance changes (computed dependency tracking).
 * The PHI is in [-100..+100]; below planHealthThreshold the badge vibrates.
 */
const specHealthCtx = computed<SpecHealthContext>(() => ({
  spec: currentSpec.value ?? { functions: [], values: [], solutions: [] },
  specOwnerCount: specModel.value?.governance?.specOwners?.length ?? 0,
  hasSpecOwner: (specModel.value?.owners?.length ?? 0) > 0,
}))
const specHealthIndexValue = computed<number>(() => {
  if (!specModel.value || !currentSpec.value) return 0
  return useSpecHealth(specModel.value.id).planHealthIndex(specHealthCtx.value)
})
const specHealthThresholdValue = computed<number>(() => {
  if (!specModel.value) return 50
  return useSpecHealth(specModel.value.id).custom.value.threshold
})
/** Pending notification count drives the rose dot on the Plan ID bar badge. */
const specHealthAlertCount = computed<number>(() => {
  if (!specModel.value) return 0
  return useSpecHealth(specModel.value.id).pendingNotifications.value.length
})

// --- Feature #29: Spec Version History ---
const { history: specHistory, addVersion, clearHistory: _clearHistory } = useSpecHistory()
const { dismissOops: _dismissOops } = useInputSafetyNet()
const { plan: _evoPlan, confirmPlan: _confirmEvoPlan, fetchPlan: _fetchEvoPlan } = useEvoPlan()
const historyOpen = ref(false)

// --- Fresh Start menu (2026-05-14) — graduated replacement for the bare
//     🆘 Reset pill. Trigger pill at bottom-left toggles `freshStartOpen`;
//     menu pops upward with 4 options. See vault Start-Over-Design.md. ---
const freshStartOpen = ref(false)

/**
 * Return the current plan model's owner names as a fresh array, suitable for
 * snapshotting onto a new history entry. Returns `[]` when there is no plan
 * model or no owners set. Centralised here so every `addVersion(...)` call
 * site stays one-liner clean and the History search can match owner names.
 */
function _specOwnerNames(): string[] {
  return specModel.value?.owners?.map(o => o.name).filter(Boolean) ?? []
}

// --- Feature #202: Plan Health Auto-Snapshot watcher ---------------------
// Tom's directive: "as automatic as possible, requiring no human intervention".
// Whenever a new spec version lands in history, capture a Plan Health snapshot
// — *if* the admin spec says auto-snapshot-on-version-bump is on. The first
// snapshot for a plan is tagged 'inception' so the Status panel can render it
// as the baseline and the Owner gets a baseline notification.
//
// Idempotency: recordSnapshot() collapses repeated fires for the same
// planVersion into a single row, so this watcher is safe even if specHistory
// emits the same id twice during HMR or restore.
watch(
  () => specHistory.value[0]?.id,
  (newestId, oldId) => {
    if (!newestId || newestId === oldId) return
    if (!specModel.value || !currentSpec.value) return
    const ph = useSpecHealth(specModel.value.id)
    if (!ph.custom.value.admin.autoSnapshotOnVersionBump) return
    const v = specHistory.value[0]
    const isFirst = ph.custom.value.snapshots.length === 0
    ph.recordSnapshot(specHealthCtx.value, {
      trigger: isFirst ? 'inception' : 'version-bump',
      planVersion: specModel.value.version ? `v${specModel.value.version}` : '',
      versionLabel: v?.label ?? '',
    })
  },
  { immediate: false },
)

/**
 * 2026-05-13 fix — Tom reported "could not restore Improve overall or earlier
 * versions". Root cause: `_ensurePlanModel(spec)` returns immediately when ANY
 * plan model is already active, so restoring a different snapshot mid-session
 * silently changed the spec underneath but kept the wrong PlanModel identity in
 * the bar — looked exactly like the restore had failed. Fix: switch the active
 * PlanModel to one matching the snapshot's `planName` (activate if it exists in
 * `getAllPlanModels()`, init a fresh one with the snapshot's name if not), then
 * call `savePlanSnapshot(spec)` so the activated model's stored spec actually
 * matches what we just put on screen.
 */
function onHistoryRestore(
  spec: SpecBlock,
  plan: EvoStepPlan | null,
  planName: string = '',
  historyOwners: string[] = [],
): void {
  // 2026-05-13 (fifth fix) — close History BEFORE doing any restore work.
  // Tom: "it responded to saas users and brought it in then went dead can
  // even close history" — restore loaded the plan but History stayed open
  // and clicks died. The previous fix put `historyOpen = false` in a
  // `finally` block, which is fine in theory but means the drawer stays
  // visible during the (potentially expensive / partially-throwing) restore
  // body — and Vue's reactivity only flushes after the function returns,
  // so any synchronous throw mid-body can leave the user staring at an open
  // drawer for the gap. Close-first removes that whole class of failure:
  // the drawer is gone the moment Restore is clicked, full stop.
  historyOpen.value = false

  // Wrap the rest in try/catch so a malformed snapshot, missing PlanModel
  // field after the recent Plan Story B+C export refactor, or stale
  // localStorage entry doesn't leave the user stranded. History is
  // already closed by the time we get here.
  try {
    currentSpec.value     = spec
    markdown.value        = serialise(spec)
    specGeneratedAt.value = new Date()
    // Tom 2026-06-03: clear stale originalInput so the EvoPlanView "FOR"
    // banner doesn't carry stakeholders from a previously-active plan into
    // the restored snapshot.  Same fix as in _applyLoadedModel.
    originalInput.value = null

    // ── Switch (or create) the PlanModel that owns this snapshot ────────────
    const wantedName = planName.trim()
    if (wantedName) {
      const all = getAllPlanModels() as ReadonlyArray<{ id: string; name: string }>
      const match = all.find((m) => m.name === wantedName)
      if (match) {
        // Re-activate the existing model AND sync its stored spec to the
        // restored snapshot so the bar, exports, and search all line up.
        activatePlanModel(match as Parameters<typeof activatePlanModel>[0])
        saveSpecSnapshot(spec)
      } else {
        // No saved model with this historical name — start a fresh one so
        // the identity bar shows the correct plan title immediately.
        initSpecModel(spec, wantedName)
      }
    } else {
      // Snapshot has no plan name (very old entry) — fall back to legacy behaviour
      _ensurePlanModel(spec)
    }

    // ── Restore owners from the history snapshot if the plan model has none ──
    // Bug fix 2026-05-28: historyOwners was received but never applied, so
    // restoring a snapshot always wiped the team. Now: if the restored plan
    // model has no owners AND the snapshot carried owner names, reinstate them
    // as minimal PlanOwner objects (name only; other fields blank — the user
    // can fill them in via Plan Owner Panel). Guard: never overwrites existing
    // owners so a subsequent load of the same plan name doesn't clobber
    // owners that were manually set after the snapshot was taken.
    if (historyOwners.length > 0 && specModel.value && specModel.value.owners.length === 0) {
      const today = new Date().toISOString().slice(0, 10)
      for (const name of historyOwners) {
        if (name.trim()) {
          addOwner({
            name: name.trim(), email: '', phone: '', organization: '',
            location: '', responsibility: '', startDate: today, endDate: '',
          })
        }
      }
    }

    if (plan) {
      // Pre-load the plan BEFORE changing currentSpec so EvoPlanView's watcher
      // sees _skipNextFetch = true and returns without making an API call.
      _loadEvoPlan(plan)
      stage.value = 2          // go straight to Evo Plan view — plan is ready
    } else {
      // No saved plan — clear any stale pre-loaded plan so a future manual
      // navigation to stage 2 generates a fresh plan cleanly.
      _clearEvoPlan()
      stage.value = 1          // stay at Spec view; user decides when to advance
    }

    addVersion(spec, 'Restored', plan, specModel.value?.name ?? '', _specOwnerNames())
  } catch (err) {
    // Don't swallow silently — log so we can diagnose. History is already
    // closed (we set historyOpen=false at the top of this function), so the
    // user is never stranded staring at a frozen drawer.
    console.error('[onHistoryRestore] failed mid-restore:', err)
  }
}

/**
 * Tom 2026-05-15: "I actually want to be able to load in files which are the
 * final output from this app!" — when the user imports a .md or .txt file
 * that is recognised as a serialised Planguage spec (by useSpecImport), load
 * it directly into SpecOutput without going through the classifier.
 * Uses the same wiring as onHistoryRestore but without the plan / history
 * overhead — a simple "load this spec as the current working spec".
 */
function onSpecFileImport(spec: SpecBlock): void {
  currentSpec.value     = spec
  markdown.value        = serialise(spec)
  specGeneratedAt.value = new Date()
  _ensurePlanModel(spec)
  stage.value = 1  // go to stage 1 so SpecOutput is visible
}

function onAmbitiousSpec(spec: SpecBlock): void {
  currentSpec.value = spec
  addVersion(spec, 'Make Ambitious', _evoPlan.value as EvoStepPlan | null, specModel.value?.name ?? '', _specOwnerNames())
}

function onLeanSpecSelected(spec: SpecBlock): void {
  currentSpec.value = spec
  addVersion(spec, 'Lean Plan', _evoPlan.value as EvoStepPlan | null, specModel.value?.name ?? '', _specOwnerNames())
}

/** Feature #57b — Whole-spec rewrite saved as a copy version (current spec unchanged). */
function onRewriteCopy(rewritten: SpecBlock): void {
  addVersion(rewritten, 'Rewrite: Copy', _evoPlan.value as EvoStepPlan | null, specModel.value?.name ?? '', _specOwnerNames())
}

/** Feature #57b — Whole-spec rewrite replaces master; old spec saved to history first. */
function onRewriteReplace(rewritten: SpecBlock): void {
  if (currentSpec.value) {
    addVersion(currentSpec.value, 'Pre-Rewrite', _evoPlan.value as EvoStepPlan | null, specModel.value?.name ?? '', _specOwnerNames())
  }
  currentSpec.value = rewritten
  addVersion(rewritten, 'Rewrite: Applied', _evoPlan.value as EvoStepPlan | null, specModel.value?.name ?? '', _specOwnerNames())
}

/** Feature #57b — Single entry rewrite accepted; patches description in master spec. */
function onRewriteEntry(payload: { id: string; type: 'F' | 'V' | 'S'; description: string }): void {
  if (!currentSpec.value) return
  const spec = currentSpec.value
  const patched: SpecBlock = {
    ...spec,
    functions: spec.functions.map(f => f.id === payload.id ? { ...f, description: payload.description } : f),
    values:    spec.values.map(v    => v.id === payload.id ? { ...v, description: payload.description } : v),
    solutions: spec.solutions.map(s => s.id === payload.id ? { ...s, description: payload.description } : s),
  }
  addVersion(patched, `Rewrite: ${payload.id}`, _evoPlan.value as EvoStepPlan | null, specModel.value?.name ?? '', _specOwnerNames())
  currentSpec.value = patched
}

/** Load or create a workspace and select it. Called after every successful auth. */
async function initWorkspace(): Promise<void> {
  if (currentWorkspace.value) return          // already selected — nothing to do
  startLoading('workspace:init', 'Loading workspace…')
  try {
    await loadWorkspaces()
    if (workspaces.value.length > 0) {
      selectWorkspace(workspaces.value[0])
    } else {
      // First sign-in — create a default workspace
      const ws = await createWorkspace('My Workspace')
      if (ws) selectWorkspace(ws)
    }
  } finally {
    stopLoading('workspace:init')
  }
}

/**
 * Post-sign-in: race initWorkspace against an 8 s timeout, then open the app.
 * Without the race, a slow Supabase leaves the user stuck on the sign-in
 * spinner indefinitely (same root-cause as the boot-time hang Tom hit on
 * 2026-05-12: "the sem app starts but does not come in after 300 seconds").
 */
async function _initWorkspaceAndOpenApp(): Promise<void> {
  const POST_SIGNIN_WS_TIMEOUT_MS = 8_000
  await Promise.race([
    initWorkspace(),
    new Promise<void>((resolve) => setTimeout(resolve, POST_SIGNIN_WS_TIMEOUT_MS)),
  ])
  view.value = 'app'
  if (user.value) startCursors(user.value.id, user.value.email ?? 'Guest')
}

const markdown = ref('')

// --- Analysis mode ---
// 'quick' = generate immediately; 'precise' = show clarifying questions first
type AnalysisMode = 'quick' | 'precise'
const analysisMode = ref<AnalysisMode>(
  (localStorage.getItem('sem-analysis-mode') as AnalysisMode) ?? 'quick',
)
watch(analysisMode, (m) => localStorage.setItem('sem-analysis-mode', m))

// Sub-stage within Stage 1: 'form' shows the entry form; 'questions' shows ClarifyView
type Stage1Sub = 'form' | 'questions'
const stage1Sub = ref<Stage1Sub>('form')

// The pending SEM payload while the user answers clarifying questions
const pendingPayload = ref<{ stakes: string; ends: string; means: string } | null>(null)

// --- Original input state ---
// The raw Stakes/Ends/Means input captured from SEMEntryForm, passed to Stage 5 export
const originalInput = ref<{ stakes: string; ends: string; means: string } | null>(null)

// --- Change 3 — Wish side-channel ---
// Stashed from the SEMEntryForm submit payload, attached to V. entries after generation.
const pendingWish = ref<{ wish: string; wishStakeholder?: string } | null>(null)

// --- Spec state ---
// The raw SpecBlock generated from the SEM entry (needed for Evo Plan + Impact Estimation)
const currentSpec = ref<SpecBlock | null>(null)

// History is saved explicitly at each meaningful action (Generated, Make Ambitious,
// Lean Plan, Restored) — not via a watch, which would fire on session restore and
// on onHistoryRestore, causing duplicate and mislabelled entries.

// Watch currentSpec — one entry per generation session; sharpen rounds update in place.
// null→spec: new spec generated → add a fresh entry and remember its ID.
// spec→spec: spec was sharpened → update the existing entry (name, score, entryCount).
watch(currentSpec, (spec, prevSpec) => {
  if (!spec) return
  if (!prevSpec) {
    // Brand-new spec — create a fresh Spec History entry
    currentDashboardEntryId.value = addToDashboard(spec)
  } else if (currentDashboardEntryId.value) {
    // Sharpened spec — update the existing entry in place
    updateDashboardEntry(currentDashboardEntryId.value, spec)
  }
})

// --- Feature #51: Spec Collaboration Conflict Detector ---
// activeUserCount = remote cursors + 1 (local user)
const activeUserCount = computed(() => remoteCursors.value.length + 1)
const { conflicts: collabConflicts, clearConflicts: clearCollabConflicts } = useCollabConflict(
  currentSpec,
  activeUserCount,
)

// --- Stage state ---
// CE workflow stages: 1 = spec, 2 = evo plan, 3 = tasks, 4 = impact, 5 = export
type Stage = 1 | 2 | 3 | 4 | 5
const stage = ref<Stage>(1)

// --- Planguage planning bar stage (1–11) ---
// Separate from the 5-stage app machine. ValueCounter uses this for its
// 11-stage display. DD-007: stages are never locked — navigation always proceeds.
const planningStage = ref<number>(1)

/**
 * Previous / next stage descriptors used by the Back / Next pin-pair in the
 * breadcrumb (Tom 2026-06-03: "buttons should be identical to the stage pins").
 * Returns null at the boundaries (stage 1 has no prev; stage 11 has no next)
 * so the corresponding pin can be hidden cleanly via v-if.
 */
const prevStageInfo = computed(() => {
  const n = planningStage.value
  return n > 1 ? (PLANNING_STAGES.find(s => s.stage === n - 1) ?? null) : null
})
/**
 * The PLANNING_STAGES entry for the current planningStage — used by the
 * middle "stage-action" pin so it can render the canonical PlTypeIcon
 * (matching the stage tile above) + the stage number + a "Stage Now"
 * indicator.  Tom 2026-06-04: *"It has a wrong glyph (use the same is in
 * the stage pin above it). And the text needs more info like: '10
 * Resources Stage Now'"*.
 */
const currentStageInfo = computed(() => {
  return PLANNING_STAGES.find(s => s.stage === planningStage.value) ?? null
})

const nextStageInfo = computed(() => {
  const n = planningStage.value
  return n < PLANNING_STAGES.length ? (PLANNING_STAGES.find(s => s.stage === n + 1) ?? null) : null
})

/**
 * Called when user clicks a stage pill in ValueCounter, or navigates via SpecEditorPanel breadcrumb.
 *
 * r19 (2026-06-02): Routing logic extracted to useStageNavigation.resolveStageNavAction()
 * so every branch is unit-tested. This function is now a thin dispatcher — it updates
 * state and calls the right view-transition function based on the resolved action.
 * See src/composables/useStageNavigation.ts for the full routing contract and tests.
 */
function handleStageBarNav(n: number): void {
  planningStage.value = n  // stages never locked (DD-007)

  const { action, toast } = resolveStageNavAction(
    n,
    specEditorOpen.value,
    !!currentSpec.value,
    confirmedSteps.value.length > 0,
  )

  if (toast !== null) {
    // Use per-stage advisory (explicit reason + what to do) — Tom 2026-06-05
    showToast(getStageAdvisory(n, toast), 5500)
  }

  switch (action) {
    case 'editor-stay':
      // Spec editor is actively rendering stages 1–4 — breadcrumb already updated above.
      // Do NOT call goToStage1() which chains to _closeAllOverlays() → closes the editor.
      break
    case 'to-spec':
      goToStage1()
      break
    case 'to-impact':
      goToImpactStage()
      break
    case 'to-evo':
      goToStage2()
      break
    case 'to-tasks':
      goToTasksStage()
      break
    case 'to-export':
      exportFull()
      break
    case 'stay':
      // Stage 9 (Study-Act): no dedicated main-stage view; toast guidance is sufficient.
      break
  }
}

/**
 * Called when user clicks the primary CTA in the ValueCounter drama popover.
 * Navigates to that stage AND executes the stage-specific action.
 * planningStageAction is a computed from planningStage — it updates synchronously
 * after handleStageBarNav sets planningStage.value, so the handler is correct.
 * Fallback: if no action is available (no spec at stage >1), still navigate and
 * explain what the user needs to do — never a silent no-op.
 */
function handleStageAction(stage: number): void {
  handleStageBarNav(stage)
  const action = planningStageAction.value
  if (action) {
    action.handler()
  } else if (stage === 1) {
    goToStage1()   // stage 1 always works — focus the Stakes input
  } else {
    showToast(`💡 Add a spec at Stakes first — then this stage action unlocks`, 3800)
  }
}

/**
 * Primary action for the current planning stage — shown as a pill button in
 * the stage breadcrumb row below the ValueCounter.
 * Tom 2026-05-28: "when I select a step 1-11 it either needs to repeat that step
 * (like generate solutions) or allow you to do step actions like 1. do this step
 * based on current plan, or revert to previous state."
 */
const planningStageAction = computed<{ label: string; handler: () => void } | null>(() => {
  if (!currentSpec.value && planningStage.value > 1) return null
  switch (planningStage.value) {
    case 1:  return { label: '✏️ Enter Stakes',        handler: () => goToStage1() }
    case 2:  return { label: '0→* Edit Values',         handler: () => _openSpecEditor({ tab: 'values' }) }
    case 3:  return { label: '[*] Edit Solutions',      handler: () => _openSpecEditor({ tab: 'solutions' }) }
    case 4:  return { label: '✨ Sharpen Spec',         handler: () => { sharpenModalOpen.value = true } }
    case 5:  return { label: '📊 Estimate Impacts',     handler: () => goToImpactStage() }
    case 6:  return { label: '⚡ Generate Evo Steps',   handler: () => { void _triggerEvoGeneration() } }
    case 7:  return { label: '📈 Evo Simulator',        handler: () => { evoSimulatorOpen.value = true } }
    case 8:  return { label: '✅ Spec Tasks',             handler: () => goToTasksStage() }
    case 9:  return { label: '📋 Study Results',        handler: () => showToast('💡 Study-Act: measure actual value delivered vs your Goals, then loop back to update the spec', 4500) }
    case 10: return { label: 'Sharpen Resources',         handler: () => { resourcesSharpenOpen.value = true } }
    case 11: return { label: '📤 Export Plan',          handler: () => exportFull() }
    default: return null
  }
})

// formResetKey — incremented by startFresh() to force a full SEMEntryForm remount,
// resetting its internal 'input'|'review' sub-stage back to 'input'.
const formResetKey = ref(0)

// formSubStage — mirrors SEMEntryForm's internal stage so App.vue can show the right
// Next Step label. Updated via the 'stage-change' emit from SEMEntryForm.
const formSubStage = ref<'input' | 'review'>('input')

// --- View state ---
// Possible views: 'loading' | 'invite' | 'sign-in' | 'sign-up' | 'confirm' | 'app'
type View = 'loading' | 'invite' | 'sign-in' | 'sign-up' | 'confirm' | 'app'

// Invitation token extracted from URL (present when user follows an invite link)
const inviteToken = ref<string>('')
const inviteType = ref<string>('invite')

// 2026-05-13 DEMO-CRITICAL #6 (Kai demo). Tom: "even reset in log in page did
// nothing like activate wayin / for me we can disable the whole sign in, it is
// just me using app for now". Sign-in / sign-up / confirm flows are now hard-
// disabled at the source: `supabaseConfigured` is forced to `false`, which
// causes `_initialView()` to return 'app' immediately and `onMounted()` to
// short-circuit before touching Supabase. The app boots straight into the
// entry form with no auth gate. To re-enable later (when going multi-user),
// flip SIGN_IN_DISABLED to false.
const SIGN_IN_DISABLED = true
const supabaseConfigured = computed(() => {
  if (SIGN_IN_DISABLED) return false
  return !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
})

// ── Synchronous initial view decision (2026-05-12) ──────────────────────────
// Tom hit a "starts but does not come in after 300 seconds" boot hang. If
// anything in onMounted (or anything that prevents onMounted from firing)
// stalls, the user gets stranded on the spinner forever. To make that class
// of failure UNREACHABLE, decide the initial view SYNCHRONOUSLY at script
// setup time using only data we can read without awaits:
//   • URL-fragment / query invite token  → 'invite'
//   • No Supabase env vars               → 'app'  (offline / mock mode)
//   • Otherwise                          → 'sign-in'  (always renders a UI)
// onMounted then upgrades 'sign-in' → 'app' if it can silently restore a
// Supabase session. If onMounted never runs, the user still sees a sign-in
// form and can sign in by hand — never an infinite spinner.
function _initialView(): View {
  try {
    const hash = window.location.hash.slice(1)
    const hashParams = new URLSearchParams(hash)
    const queryParams = new URLSearchParams(window.location.search)
    if (hashParams.get('access_token') && hashParams.get('type') === 'invite') {
      inviteToken.value = hashParams.get('access_token') ?? ''
      inviteType.value = 'invite'
      return 'invite'
    }
    if (queryParams.get('invite') === 'true' && queryParams.get('token')) {
      inviteToken.value = queryParams.get('token') ?? ''
      inviteType.value = 'invite'
      return 'invite'
    }
  } catch {
    /* ignore — fall through to default */
  }
  // SIGN_IN_DISABLED short-circuit: never land on sign-in.
  if (SIGN_IN_DISABLED) return 'app'
  const hasSupabase = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
  return hasSupabase ? 'sign-in' : 'app'
}
const view = ref<View>(_initialView())

// --- Stage completion analytics (3P.V.EvoStepPlanQuality / 3P.V.WorkflowCompletionRate) ---
// Fires a stage_complete event whenever the user advances to a new CE stage.
// Also scrolls to top so the new stage content is immediately visible.
watch(stage, (newStage, oldStage) => {
  analytics.logStageComplete(newStage as 1 | 2 | 3 | 4 | 5)
  nextTick(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
  // Close every overlay on ANY stage transition — forward or backward.
  // Previously, forward navigation only closed 3 specific modals. This left the
  // ⚡ Actions menu backdrop (z-[375]) and SharpenPanel (z-[400]) alive across
  // stage changes, causing them to block Teleported buttons (Export Plan z-[370],
  // Coach z-[370]) at the next stage. _closeAllOverlays is defined later in the
  // file but is in scope here at call-time (closure).
  _closeAllOverlays()
})

console.log('[boot] script-setup end — onMounted scheduled', new Date().toISOString())

onMounted(async () => {
  // Phase 2 Plan→Spec localStorage key migration: copy sem-plan-* → sem-spec-* on first run.
  // Idempotent: skips any new key that is already populated. Never deletes old keys.
  backfillSpecKeysFromPlanKeys()
  console.log('[boot] onMounted entered', new Date().toISOString())
  // ── Hard watchdog (2026-05-12) ─────────────────────────────────────────────
  // Tom hit a "starts but does not come in after 300 seconds" boot hang.
  // Race-wrapping individual awaits (auth, workspace) wasn't enough because
  // ANY failure mode upstream of those races (corrupt localStorage parse,
  // unhandled rejection in a watcher, Supabase client throwing during
  // construction, an analytics call hanging, etc.) can leave the onMounted
  // function before the awaits even start. So: schedule a hard timer the
  // very FIRST thing — if `view` is still 'loading' 12 s from now, force
  // it to 'sign-in' (or 'app' when Supabase isn't configured) so the user
  // is never stranded on the spinner. The user can always sign in / retry
  // from there. This is a safety net, NOT the primary path.
  const BOOT_WATCHDOG_MS = 8_000
  setTimeout(() => {
    if (view.value === 'loading') {
      console.warn('[boot] watchdog fired — forcing view out of loading state')
      view.value = supabaseConfigured.value ? 'sign-in' : 'app'
    }
  }, BOOT_WATCHDOG_MS)

  // Evo Step 10: log device/viewport metadata (3P.V.MobileUX / 2S.V.PlannerAccessibility)
  analytics.logMobileSession()

  // Check for invitation token in URL hash or query params
  // Supabase sends invite tokens as URL fragments: #access_token=...&type=invite
  const hash = window.location.hash.slice(1)
  const hashParams = new URLSearchParams(hash)
  const queryParams = new URLSearchParams(window.location.search)

  // Handle Supabase invite redirect — token in hash fragment
  const hashToken = hashParams.get('access_token')
  const hashType = hashParams.get('type')

  // Handle custom invite query param (from our invitation email redirect)
  const isInviteQuery = queryParams.get('invite') === 'true'
  const queryToken = queryParams.get('token')

  if (hashToken && hashType === 'invite') {
    inviteToken.value = hashToken
    inviteType.value = hashType
    // Clean the token from the URL so it is not visible after redirect
    window.history.replaceState({}, '', window.location.pathname)
    view.value = 'invite'
    return
  }

  if (isInviteQuery && queryToken) {
    inviteToken.value = queryToken
    inviteType.value = 'invite'
    window.history.replaceState({}, '', window.location.pathname)
    view.value = 'invite'
    return
  }

  // If Supabase is not configured, go straight to the app (no auth needed)
  if (!supabaseConfigured.value) {
    _tryRestoreSession()
    view.value = 'app'
    return
  }

  // Initialise session from Supabase (restores persisted login).
  // Race against 8 s timeout — on a fresh boot the network may not be up yet
  // and a hung getSession() call would leave the app on the loading screen forever.
  const AUTH_TIMEOUT_MS = 8_000
  startLoading('auth:init', 'Restoring session…')
  try {
    await Promise.race([
      init(),
      new Promise<void>((resolve) => setTimeout(resolve, AUTH_TIMEOUT_MS)),
    ])
  } finally {
    stopLoading('auth:init')
  }

  if (user.value) {
    // Race initWorkspace against the same 8 s timeout used for auth init.
    // Without this race, a slow/unreachable Supabase leaves `view` pinned to
    // 'loading' indefinitely — Tom: "the sem app starts but does not come in
    // after 300 seconds" (2026-05-12). The workspace is only required for
    // multi-user features (members list, shared entries); core SEM flows
    // (entry form, generate, sharpen, plan, export) work fine without it,
    // so we surface the app even if the workspace fetch is still in flight.
    await Promise.race([
      initWorkspace(),
      new Promise<void>((resolve) => setTimeout(resolve, AUTH_TIMEOUT_MS)),
    ])
    // Seed device-user name from auth email on first login if not yet stored
    if (!getDeviceUserName() && user.value.email) {
      setDeviceUserName(user.value.email.split('@')[0] ?? user.value.email)
    }
    _tryRestoreSession()
    // Don't clobber a view the user has already navigated to (e.g. clicked
    // "🧙 Guided" or "▶ See a demo" on the sign-in page during the 8 s
    // auth-init race). Only upgrade FROM 'sign-in' or 'loading' — leaving
    // 'app' / 'invite' / 'sign-up' / 'confirm' alone.
    if (view.value === 'sign-in' || view.value === 'loading') view.value = 'app'
    startCursors(user.value.id, user.value.email ?? 'Guest')
  } else {
    // Same guard — if the user clicked Guided/Demo during boot, view is
    // already 'app' and we must NOT force it back to 'sign-in'. Without
    // this guard, late onMounted resolution races the click and the
    // wizard appears momentarily over a sign-in screen instead of over
    // the app, which makes the Guided button feel broken (Tom 2026-05-12).
    if (view.value === 'loading') view.value = 'sign-in'
  }
})



/**
 * One-time migration: converts old prefix-dot-PascalCase tag IDs (e.g. "S.DatabaseRedundancy")
 * to the new natural-words format (e.g. "Database Redundancy").
 * Applied on session restore so existing stored data upgrades silently.
 * Tom 2026-05-17: "Drop the S. type prefix — the Name has a Space between words."
 */
function _migrateTagId(id: string): string {
  if (!id || !/^[A-Z]\.[A-Z]/.test(id)) return id
  const name = id.slice(2)
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')       // camelCase boundary → space
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2') // acronym boundary  → space (e.g. GDPRCompliance → GDPR Compliance)
}
function _migrateTagList(val: string | undefined): string | undefined {
  if (!val) return val
  return val.split(/[,;]+/).map(s => _migrateTagId(s.trim())).filter(Boolean).join(', ')
}
function _migrateImpactText(text: string | undefined): string | undefined {
  if (!text) return text
  // Replace any embedded old-format IDs (e.g. "V.SearchLatencyP95 ~200ms" → "Search Latency P95 ~200ms")
  return text.replace(/\b[A-Z]\.[A-Za-z][A-Za-z0-9]*/g, m => _migrateTagId(m))
}
function _migrateSpecTagFormat(spec: SpecBlock): SpecBlock {
  return {
    ...spec,
    functions: spec.functions.map(f => ({
      ...f,
      id:             _migrateTagId(f.id),
      functionOfValue: _migrateTagList(f.functionOfValue) ?? f.functionOfValue,
    })),
    values: spec.values.map(v => ({
      ...v,
      id:              _migrateTagId(v.id),
      valueOfFunction: _migrateTagList(v.valueOfFunction) ?? v.valueOfFunction,
    })),
    solutions: spec.solutions.map(s => ({
      ...s,
      id:       _migrateTagId(s.id),
      function: _migrateTagId(s.function ?? '') || s.function,
      impact:   _migrateImpactText(s.impact),
    })),
    constraints: (spec.constraints ?? []).map(c => ({
      ...c,
      id: _migrateTagId(c.id),
    })),
  }
}
function _migrateMatrixKeys(
  matrix: Record<string, Record<string, number>>,
): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {}
  for (const [vId, inner] of Object.entries(matrix)) {
    out[_migrateTagId(vId)] = Object.fromEntries(
      Object.entries(inner).map(([sId, v]) => [_migrateTagId(sId), v])
    )
  }
  return out
}
function _migrateRecordKeys(rec: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(rec).map(([k, v]) => [_migrateTagId(k), v]))
}

/**
 * Reads the saved session from localStorage and applies it to the reactive
 * state refs. Called once on mount, just before view transitions to 'app'.
 * Shows a restore toast with a "Start fresh" affordance if a valid session exists.
 */
function _tryRestoreSession(): void {
  const saved = _loadSession()
  if (!saved) return

  // Apply all saved state
  currentSpec.value           = saved.currentSpec ? _migrateSpecTagFormat(saved.currentSpec) : null
  markdown.value              = saved.markdown ?? ''
  originalInput.value         = saved.originalInput ?? null
  // Migrate legacy sessions: EvoStep.linkedSolution (singular string) → linkedSolutions (string[])
  // Also migrate old prefix-dot IDs in linkedValues / linkedSolutions to new tag format.
  confirmedSteps.value = (saved.confirmedSteps ?? []).map((st: EvoStep & { linkedSolution?: string }) => {
    let step = st
    if (!Array.isArray(st.linkedSolutions) || st.linkedSolutions.length === 0) {
      const legacy = st.linkedSolution
      step = { ...st, linkedSolutions: legacy ? [legacy] : [] }
    }
    // Migrate old 3-part Evo step names: S.Evo3.DatabaseRedundancy → Evo 3 — Database Redundancy
    const rawName: string = (step as any).name ?? ''
    const nameMatch = rawName.match(/^S\.Evo(\d+)\.(.+)$/)
    const migratedName = nameMatch
      ? `Evo ${nameMatch[1]} — ${nameMatch[2]
          .replace(/([a-z])([A-Z])/g, '$1 $2')
          .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')}`
      : rawName
    return {
      ...step,
      name:            migratedName,
      linkedValues:    (step.linkedValues    ?? []).map(_migrateTagId),
      linkedSolutions: (step.linkedSolutions ?? []).map(_migrateTagId),
    }
  })
  evoPlanConfirmed.value      = saved.evoPlanConfirmed ?? false
  tasksByStep.value           = saved.tasksByStep ?? {}
  capturedImpactMatrix.value  = _migrateMatrixKeys(saved.capturedImpactMatrix ?? {})
  capturedVCRatios.value      = _migrateRecordKeys(saved.capturedVCRatios ?? {})
  capturedCalendarCosts.value = _migrateRecordKeys(saved.capturedCalendarCosts ?? {})
  capturedCapitalCosts.value  = _migrateRecordKeys(saved.capturedCapitalCosts ?? {})

  // Restore the 11-step Evo planning bar position.
  // Fallback table for sessions saved before planningStage was persisted (version <3):
  //   stage 1 (spec entry)  → planningStage 1  (Stakes)
  //   stage 2 (EvoPlanView) → planningStage 6  (Evo Steps — minimum sensible for this view)
  //   stage 3 (ImpactView)  → planningStage 5  (Estimate Impacts)
  //   stage 4 (TasksView)   → planningStage 8  (Plan Tasks)
  const fallbackPlanningStage: Record<number, number> = { 1: 1, 2: 6, 3: 5, 4: 8, 5: 8 }
  const restoredPlanningStage = (saved as any).planningStage
    ?? fallbackPlanningStage[(saved.stage ?? 1) as number]
    ?? 1
  planningStage.value = restoredPlanningStage

  // If the session was saved while at stage 1 with a spec already generated,
  // advance to stage 2 on restore. The entry form has no persisted text, so
  // showing a blank "What's your project about?" form alongside a ready spec
  // is confusing — the user's intent on returning is to continue planning.
  const restoredStage = (saved.stage ?? 1) as typeof stage.value
  if (restoredStage === 1 && saved.currentSpec) {
    // Auto-advancing to stage 2 — guarantee specModel is set so the
    // Plan Identity Bar (v-if="specModel") renders correctly.
    _ensurePlanModel(saved.currentSpec)
    // Suppress auto-generation: the session was saved with a spec already
    // present. The user's intent on resuming is to continue planning, not to
    // kick off a brand-new AI evo-step generation run. They can trigger that
    // manually via "Generate Evo Steps" inside EvoPlanView.
    _resetPlanForLoad()
    stage.value = 2
    // Sync the planning bar: if it was sitting at a spec-entry stage (1-4),
    // advance it to 6 (Evo Steps) to match the view the user lands on.
    if (planningStage.value < 6) planningStage.value = 6
  } else {
    // Staying at the restored stage — still ensure specModel if spec exists,
    // because the user may have a spec at stage 1 and navigate to stage 2.
    if (saved.currentSpec) _ensurePlanModel(saved.currentSpec)
    // Same protection: if the session was saved at stage 2, EvoPlanView will
    // mount immediately. Without this flag fetchPlan() fires and the app
    // launches an AI call the user never asked for.
    if (restoredStage === 2) _resetPlanForLoad()
    // Stage 5 (Export) does not restore correctly — PrioritisedPlanView's
    // onMounted auto-download races with the first paint, producing a blank view.
    // Drop back to stage 4 (Tasks) so the user lands on a live, working surface;
    // they can click "Export Prioritised Plan" to regenerate the full export.
    // All session data (confirmedSteps, tasksByStep, impactMatrix, etc.) is fully
    // restored so the re-export is one click away.
    stage.value = (restoredStage === 5) ? 4 : restoredStage
  }

  sessionRestored.value = true
  // Evo Step 10: log session_restored event (3P.V.WorkflowResumability)
  analytics.logSessionRestored(saved.version, true)
  const age = timeAgo(saved.savedAt)
  showToast(`↩ Session restored${age ? ' · ' + age : ''} — tap Start fresh to clear`, 5000)
}

// --- Evo plan state ---
// The confirmed Evo steps (set when user confirms the plan in EvoPlanView)
const confirmedSteps = ref<EvoStep[]>([])
const evoPlanConfirmed = ref(false)

/** Steps to pass to diagrams — ALWAYS prefers the live plan as the single source of
 *  truth, falling back to confirmedSteps only when no live plan exists. This ensures:
 *    (a) Re-generated plans appear in the diagram immediately, without re-confirming
 *        (Tom 2026-06-03: "regenerated and got 3 steps, but in the next impact step
 *         the value decision table only had the previous 2 steps" — bug caused by
 *         the old precedence preferring the stale confirmedSteps snapshot).
 *    (b) Edits to plan steps (reorder, rename, link changes) propagate to all
 *        downstream diagrams without requiring re-confirmation.
 *    (c) Empty/unconfirmed plans still render via the original Tom 2026-05-16 fix
 *        ("the diagram denies [evo steps], please fix") — the live plan IS the draft.
 *  confirmedSteps remains as a fallback for the edge case of a session-restore that
 *  has a confirmed snapshot but no live plan instance yet (rare). */
const _stepsForDiagram = computed<EvoStep[]>(() => {
  const raw = _evoPlan.value?.steps?.length ? _evoPlan.value.steps : confirmedSteps.value
  if (!raw?.length) return raw
  // Tom 2026-06-04 verbatim: *"the evo steps table is empty but evo steps
  // exist in the value flow diagram"*.  Root cause: the V × Evo Step view
  // (ImpactEstimationStepView) aggregates impact per step by summing the
  // V × S matrix across `step.linkedSolutions`.  When the LLM-generated
  // plan emits empty / unresolvable linkedSolutions for every step, every
  // aggregated cell shows "–" even with a fully-populated matrix.
  //
  // Fallback: if NO step has any linkedSolutions AND the spec has Solutions
  // entries, fan-out every Solution to every step (charitable assumption:
  // each step touches the whole-of-spec scope) so the V × Evo Step
  // projection has something meaningful to aggregate.  This is a baseline
  // the user can refine — better than a blank grid that doesn't explain
  // itself.  Once any step carries its own linkedSolutions, this fallback
  // is skipped (the per-step user data wins).
  const noStepsHaveLinks = raw.every(s => !s.linkedSolutions || s.linkedSolutions.length === 0)
  if (!noStepsHaveLinks) {
    console.log(`[stepsForDiagram] ${raw.length} steps have their own linkedSolutions — using as-is`)
    return raw
  }
  const allSolutions = currentSpec.value?.solutions ?? []
  if (allSolutions.length === 0) {
    console.log(`[stepsForDiagram] no solutions in spec to fan-out — leaving ${raw.length} steps with empty linkedSolutions`)
    return raw
  }
  const fanned = raw.map(s => ({
    ...s,
    linkedSolutions: [...allSolutions.map(sol => sol.id)],
  }))
  console.log(`[stepsForDiagram] FANNED OUT ${allSolutions.length} solutions to ${fanned.length} steps · sol ids:`, allSolutions.map(s => s.id))
  return fanned
})

// --- Task state ---
// Map from step.name → task list (managed by TaskList component via v-model equivalent)
// Exposed here so exportPrioritisedPlan can read it at export time.
const tasksByStep = ref<Record<string, TaskSuggestion[]>>({})

// ── ValueFlow Task backfill ───────────────────────────────────────────────────
// Tom 2026-06-04 verbatim: *"No Tasks are now visible in the ValueFlow"*.
// Root cause: tasksByStep is only populated when the user actually visits
// Stage 8 (Tasks view) — TaskList.vue's onMounted calls suggestTasks(step)
// for every step.  If the user jumps directly from Stage 6 (Evo Steps) to
// Stage 7 (Evo Impact) or Stage 10 (Resources) via the planning bar — both
// of which embed the ValueFlowDiagram — TaskList never mounted and the
// diagram has no tasks to render.
//
// Fix: when the user enters any view that displays the ValueFlowDiagram
// AND tasksByStep is empty AND steps exist, backfill tasksByStep using
// the same suggestTasks composable TaskList uses.  Idempotent — if tasks
// already exist (user did visit Stage 8), this is a no-op.  User edits
// in TaskList still override these defaults via the @update:tasks-by-step
// event.
const { suggestTasks: _suggestTasksForBackfill } = useTaskSuggestions()
function _backfillTasksByStepIfEmpty(): void {
  const steps = _stepsForDiagram.value
  if (!steps || steps.length === 0) return
  // If any task list is already populated, treat as user-managed and skip.
  const hasAny = Object.values(tasksByStep.value).some(arr => Array.isArray(arr) && arr.length > 0)
  if (hasAny) return
  const filled: Record<string, TaskSuggestion[]> = {}
  for (const step of steps) {
    filled[step.name] = _suggestTasksForBackfill(step)
  }
  tasksByStep.value = filled
}

// Fire the backfill when the user enters any view that embeds the
// ValueFlowDiagram — internal stage===2 (Evo Plan + VFD modal), stage===3
// (Evo Impact / Resources view with embedded VFD), or planningStage===9
// (Study-Act, which the diagram is read-only for).  Idempotent and cheap.
watch([stage, planningStage, _stepsForDiagram], () => {
  if (stage.value === 2 || stage.value === 3 || planningStage.value === 9) {
    _backfillTasksByStepIfEmpty()
  }
}, { immediate: true })

// ── Impact matrix backfill ────────────────────────────────────────────────────
// Tom 2026-06-04 verbatim: *"evo impact tabe not filled out"*.  Root cause:
// `capturedImpactMatrix` defaults to `{}`.  When the user enters Stage 7
// (Evo Impact) without having clicked through a prior path that populated
// it (e.g. jumping from Stage 6 directly via the planning bar), every cell
// shows "—".  The V × Evo Step aggregation above the V × S editor reads
// from this matrix, so it shows nothing too.
//
// Fix: when the user enters stage===3 (Evo Impact view) with an empty
// `capturedImpactMatrix` AND a populated spec, seed it with the same
// deterministic mock snapshot that `exportFull()` already uses at line 2964
// when the user reaches Export without estimating.  This gives the user
// a baseline they can adjust, instead of a blank grid that doesn't explain
// itself.  User edits via @matrix-updated still overwrite these.
function _backfillImpactMatrixIfEmpty(): void {
  if (!currentSpec.value) {
    console.log('[backfillImpactMatrix] skip: no currentSpec')
    return
  }
  const hasData = Object.keys(capturedImpactMatrix.value).length > 0
  if (hasData) {
    console.log(`[backfillImpactMatrix] skip: matrix already populated (${Object.keys(capturedImpactMatrix.value).length} V rows)`)
    return
  }
  const vCount = currentSpec.value.values.length
  const sCount = currentSpec.value.solutions.length
  if (vCount === 0 || sCount === 0) {
    console.log(`[backfillImpactMatrix] skip: empty spec (values=${vCount} solutions=${sCount})`)
    return
  }
  const snap = computeMockImpactSnapshot(currentSpec.value.values, currentSpec.value.solutions)
  capturedImpactMatrix.value  = snap.matrix
  capturedVCRatios.value      = snap.vcRatios
  capturedCalendarCosts.value = snap.calendarCosts
  capturedCapitalCosts.value  = snap.capitalCosts
  console.log(`[backfillImpactMatrix] FILLED matrix with mock data: ${vCount} values × ${sCount} solutions = ${vCount * sCount} cells`)
}

watch([stage, planningStage, currentSpec], () => {
  if (stage.value === 3) _backfillImpactMatrixIfEmpty()
}, { immediate: true })

// Tom 2026-06-04 r87: smart @matrix-updated handler.  Previous handler was a
// raw assignment — when ImpactEstimationView mounted and emitted its
// initial (often empty) matrix, it OVERWROTE the r84 backfill, leaving
// the V × Evo Step table showing dashes again.  This handler:
//   1. Ignores emits where every cell is zero/empty (preserves r84 seed)
//   2. Cell-merges non-empty emits into capturedImpactMatrix so partial
//      IET edits coexist with mock baseline for the cells the user hasn't
//      touched yet
function _onMatrixUpdated(
  matrix:        Record<string, Record<string, number>>,
  efficiency:    Record<string, number>,
  cal:           Record<string, number>,
  cap:           Record<string, number>,
): void {
  // Count non-zero cells in the incoming matrix.
  let nonZero = 0
  for (const row of Object.values(matrix)) {
    for (const cell of Object.values(row)) {
      if (cell !== 0) nonZero++
    }
  }
  const incomingHasData = nonZero > 0
  const currentHasData  = Object.keys(capturedImpactMatrix.value).length > 0
  if (!incomingHasData && currentHasData) {
    console.log('[matrix-updated] ignored empty emit — keeping existing capturedImpactMatrix (likely r84 backfill or prior user edits)')
    return
  }
  if (incomingHasData) {
    // Cell-merge so the user's IET edits don't blow away the mock baseline
    // for cells they haven't touched.  Only cells WITH a value in the
    // incoming matrix replace; zero cells keep whatever was there before.
    const merged: Record<string, Record<string, number>> = { ...capturedImpactMatrix.value }
    for (const [vid, row] of Object.entries(matrix)) {
      merged[vid] = { ...(merged[vid] ?? {}) }
      for (const [sid, cell] of Object.entries(row)) {
        if (cell !== 0) merged[vid][sid] = cell
      }
    }
    capturedImpactMatrix.value = merged
  } else {
    capturedImpactMatrix.value = matrix
  }
  capturedVCRatios.value      = efficiency
  capturedCalendarCosts.value = cal
  capturedCapitalCosts.value  = cap
}

// --- Impact matrix state ---
// Captured from ImpactEstimationView. Populated two ways:
//  1. Synchronously in exportFull() via ietRef.getSnapshot() — the primary path.
//  2. Via matrix-updated events (cell edits, Regenerate) — keeps it fresh if needed.
const capturedImpactMatrix  = ref<ImpactMatrix>({})
const capturedVCRatios      = ref<Record<string, number>>({})
const capturedCalendarCosts = ref<Record<string, number>>({})
const capturedCapitalCosts  = ref<Record<string, number>>({})

// Template ref to the live ImpactEstimationView component — gives us synchronous
// access to the matrix at export time regardless of async API call timing.
const ietRef = ref<(ComponentPublicInstance & { getSnapshot: () => {
  matrix: ImpactMatrix
  efficiency: Record<string, number>
  calendarCosts: Record<string, number>
  capitalCosts: Record<string, number>
} }) | null>(null)

// Template ref to the SpecOutput wrapper — used to scroll into view after ClarifyView
// completes (skip or generate). On mobile the spec renders below the form and is off-screen.
const specOutputEl   = ref<HTMLElement | null>(null)
/** Template ref to SEMEntryForm — used by handleApertureSubmit to trigger Parse */
const semEntryFormRef = ref<{ loadAndParse: (text: string) => void } | null>(null)

/**
 * Text committed from the Apperture that is waiting for SEMEntryForm to mount.
 * Set by handleApertureSubmit; consumed by the watcher below the instant
 * semEntryFormRef becomes non-null (i.e. SEMEntryForm has mounted).
 *
 * Why a watcher instead of a direct nextTick call:
 * If the user was on Stage 2+, SEMEntryForm is not in the DOM. After resetting
 * stage to 1 and awaiting one tick, Vue schedules the mount but it may not have
 * run yet. The watcher fires EXACTLY when the ref is set — no polling, no
 * guesswork, no race condition.
 */
const _pendingApertureText = ref<string | null>(null)
watch(semEntryFormRef, (form) => {
  if (form && _pendingApertureText.value !== null) {
    const t = _pendingApertureText.value
    _pendingApertureText.value = null
    form.loadAndParse(t)
  }
})

/** Scrolls the SpecOutput smoothly into view after a successful generation from ClarifyView. */
function scrollToSpec(): void {
  // nextTick ensures the DOM has updated (stage1Sub = 'form' re-renders the template)
  nextTick(() => {
    specOutputEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

// ── Universal "current activity must be visible" rule (Tom 2026-05-14) ──────
// Tom: "The activity, generating spec, hides below window. We should always
// move window to show current activity (universal rule)."
//
// Every reactive activity flag whose VISIBLE surface could be pushed below
// the fold by surrounding chrome (form length, identity bar, banners) is
// registered with useActivityScroll. The moment a flag flips false→true,
// the composable smoothly scrolls the activity element into view so the
// spinner / streaming content is always seen the instant it starts.
//
// Internal-panel activities (SpecCoach streaming inside its Teleported
// panel, Collaborator inside its drawer) do NOT register here — they
// handle their own intra-panel scroll-to-bottom. This is for activities
// whose home is the front page where the form-then-output stack lives.
registerActivityScroll('spec-gen',     sdkLoading,     () => specOutputEl.value)
registerActivityScroll('spec-error',   sdkError,       () => specOutputEl.value, { activeWhen: (v) => Boolean(v) })
registerActivityScroll('clarify-load', clarifyLoading, () => specOutputEl.value)

// ── Hung-generation watchdog (added 2026-05-13) ─────────────────────────────
// Tom: "hangs on generation after it did gen for a round, BUG". The
// Anthropic client has a 90s timeout (useSDK.ts line 32) so any real network
// hang should self-recover within 90s + parse buffer. But Tom reports a
// hard hang on the second generation attempt — likely Vite HMR leaving the
// useSDK module in a half-stitched state, or browser-tab throttling killing
// the fetch socket without surfacing an error to JS land.
//
// Mitigation: a single watcher that starts a 100-second timer when isLoading
// flips true and cancels it when isLoading flips false. If the timer fires
// (i.e. loading has been stuck for ≥100s) we force-clear the loading state,
// surface a clear error banner, and log a console.error so DevTools shows
// what was hung. Tom can also press 🆘 Reset at any time before the timer
// fires — panicReset() clears the same state instantly.
let _hangWatchdog: ReturnType<typeof setTimeout> | null = null
// Tom 2026-06-06: watchdog window bumped 100s → 180s.  The claude-code adapter
// spawns the local `claude` CLI which can need 30-60s on a cold start before
// it streams tokens; 100s left too thin a margin and caused frequent false
// timeouts.  180s = 3 minutes is still snappy enough that a real hang is
// surfaced to the user within reasonable time.
//
// Tom 2026-06-06 NEW: when the watchdog fires we now FALL BACK to a
// deterministic mock spec built from the user's original stakes/ends/means
// input instead of leaving them stuck at an error.  This realises Claude-
// Code-as-AI-Layer's "the SEM App must work without the AI layer" guarantee:
// even if Claudian is slow / unreachable / hung, the user CAN proceed past
// Stage 1 with a usable Planguage spec drafted from their own typed input.
// They can re-run Sharpening (which is a separate, faster cycle) to refine it.
watch(isLoading, (busy) => {
  if (busy) {
    if (_hangWatchdog) clearTimeout(_hangWatchdog)
    _hangWatchdog = setTimeout(() => {
      console.error('[HangWatchdog] Loading state stuck for 180s — force-clearing.', {
        sdkError: sdkError.value,
        stage: stage.value,
        hasPayload: !!pendingPayload.value,
      })
      // Hard-cancel the underlying fetch BEFORE clearing loading state.
      cancelCurrentTranslate()
      _forceClearLoading()
      _doTranslateInFlight = false   // watchdog must also release the in-flight guard

      // Graceful fallback: if the user had a pending payload, draft a mock
      // spec from it so they can keep moving.  Otherwise show the error.
      const payload = pendingPayload.value
      if (payload && (payload.stakes || payload.ends || payload.means)) {
        try {
          const mockSpec = buildMockSpec(payload.stakes, payload.ends, payload.means)
          currentSpec.value = mockSpec
          stage.value = 2   // jump to Evo Plan view so the user sees their spec
          sdkError.value = ''
          showToast(
            '⚡ AI was slow — drafted a quick local spec from your input.  Press Sharpen on any dimension to refine, or 🆘 Reset to start fresh.',
            8000,
          )
        } catch (err) {
          console.error('[HangWatchdog] buildMockSpec fallback also failed', err)
          sdkError.value = 'Generation took too long and the local fallback also failed. Press Generate Spec again to retry, or 🆘 Reset to start fresh.'
          stage1Sub.value = 'form'
        }
      } else {
        sdkError.value = 'Generation took too long and was cancelled. Press Generate Spec again to retry, or 🆘 Reset to start fresh.'
        stage1Sub.value = 'form'
      }
      _hangWatchdog = null
    }, 180_000)
  } else {
    if (_hangWatchdog) {
      clearTimeout(_hangWatchdog)
      _hangWatchdog = null
    }
  }
})
onUnmounted(() => {
  if (_hangWatchdog) clearTimeout(_hangWatchdog)
})

// --- Demo mode (#8) ---
const { isDemoRunning, demoStage, startDemo, stopDemo, DEMO_STAKES, DEMO_ENDS, DEMO_MEANS } =
  useDemoMode()

const demoProgressPercent = ref(0)
let _demoProgressInterval: ReturnType<typeof setInterval> | null = null

function launchDemo(): void {
  // 2026-05-13 DEMO-CRITICAL #5 (Kai demo, "demo is dead").
  // Root cause of "demo is dead": startDemo's submitForm callback called
  // handleSubmit → doTranslate → translate(), which goes through useSDK.
  // useSDK only returns a spec when EITHER `VITE_MOCK_MODE === 'true'` OR a
  // valid Anthropic API key is configured AND network is reachable. In a
  // production build with no API key (Tom's Kai-demo state) the call hung
  // or threw silently, leaving the demo permanently on stage=1 with the
  // "Translating your plan…" spinner. Demos must NEVER depend on a network
  // call. This rewrite uses the deterministic `buildMockSpec()` helper
  // directly inside the demo callback, so the demo always produces a valid
  // SpecBlock instantly — no API key, no network, no LLM dependency.
  // Real (non-demo) generation in handleSubmit → translate is unchanged.
  demoProgressPercent.value = 0
  const startTime = Date.now()
  _demoProgressInterval = setInterval(() => {
    const elapsed = Date.now() - startTime
    demoProgressPercent.value = Math.min(100, Math.round((elapsed / 60_000) * 100))
    if (demoProgressPercent.value >= 100) _clearDemoInterval()
  }, 200)

  startDemo({
    fillFields: (_s: string, _e: string, _m: string) => {
      // Demo fills the form by directly calling submitForm — no field update needed
    },
    submitForm: () => {
      try {
        // Build a deterministic mock spec INLINE — no LLM, no network, no key.
        const spec = buildMockSpec(DEMO_STAKES, DEMO_ENDS, DEMO_MEANS)
        currentSpec.value = spec
        markdown.value = serialise(spec)
        specGeneratedAt.value = new Date()
        try { initSpecModel(spec) } catch { /* non-fatal in demo path */ }
        try {
          addVersion(spec, 'Generated', null, specModel.value?.name ?? '', _specOwnerNames())
        } catch { /* history is best-effort in demo */ }
        stage.value = 1
        stage1Sub.value = 'form'
        // Make sure no stale loading flag visually freezes the demo
        _doTranslateInFlight = false
        sdkError.value = ''
      } catch (err) {
        console.error('[launchDemo] mock-spec build failed (should never happen):', err)
      }
    },
    advanceStage: (n: number) => {
      if (n === 2 && currentSpec.value) {
        stage.value = 2
      }
    },
  })
}

function handleStopDemo(): void {
  stopDemo()
  _clearDemoInterval()
}

function _clearDemoInterval(): void {
  if (_demoProgressInterval !== null) {
    clearInterval(_demoProgressInterval)
    _demoProgressInterval = null
  }
}

// --- Celebration (#12) ---
const celebrationVisible = ref(false)
let _celebrationResetTimer: ReturnType<typeof setTimeout> | null = null

// --- Export ---
const prioritisedMarkdown = ref('')

// Watch stage → 5: trigger celebration (#12) + auto-copy plan to clipboard
watch(stage, (newStage, _oldStage) => {
  if (newStage === 5 && prioritisedMarkdown.value) {
    celebrationVisible.value = true
    if (_celebrationResetTimer !== null) clearTimeout(_celebrationResetTimer)
    _celebrationResetTimer = setTimeout(() => {
      celebrationVisible.value = false
    }, 3500)
    autoCopyPlan()
  }
})

// Also watch prioritisedMarkdown: if we arrive at stage 5 before markdown is set, catch it
watch(prioritisedMarkdown, (md) => {
  if (stage.value === 5 && md) {
    celebrationVisible.value = true
    if (_celebrationResetTimer !== null) clearTimeout(_celebrationResetTimer)
    _celebrationResetTimer = setTimeout(() => {
      celebrationVisible.value = false
    }, 3500)
    autoCopyPlan()
  }
})

// ── Session auto-save ─────────────────────────────────────────────────────────
// Debounced 500 ms — fires on any meaningful state change.

let _saveTimer: ReturnType<typeof setTimeout> | null = null

function _buildSessionSnapshot() {
  return {
    version: 2 as const,
    savedAt: new Date().toISOString(),
    stage: stage.value,
    planningStage: planningStage.value,   // persist 11-step Evo bar position
    currentSpec: currentSpec.value,
    markdown: markdown.value,
    originalInput: originalInput.value,
    confirmedSteps: confirmedSteps.value,
    evoPlanConfirmed: evoPlanConfirmed.value,
    tasksByStep: tasksByStep.value,
    capturedImpactMatrix: capturedImpactMatrix.value,
    capturedVCRatios: capturedVCRatios.value,
    capturedCalendarCosts: capturedCalendarCosts.value,
    capturedCapitalCosts: capturedCapitalCosts.value,
  }
}

function _scheduleSave(): void {
  if (!currentSpec.value) return  // nothing worth saving yet
  if (_saveTimer) clearTimeout(_saveTimer)
  _saveTimer = setTimeout(() => { _saveSession(_buildSessionSnapshot()) }, 500)
}

function _saveNow(): void {
  if (!currentSpec.value) return
  if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null }
  _saveSession(_buildSessionSnapshot())
}

// Watch key state refs — deep on objects, shallow on primitives
watch([stage, planningStage, currentSpec, markdown, confirmedSteps, evoPlanConfirmed, tasksByStep,
  capturedImpactMatrix, capturedVCRatios, capturedCalendarCosts, capturedCapitalCosts],
  _scheduleSave, { deep: true })

// Immediate save when page is about to be hidden — critical for iOS Safari eviction.
// pagehide fires reliably before tab close / background / zoom eviction.
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', _saveNow)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') _saveNow()
  })
}

// ── Start fresh ───────────────────────────────────────────────────────────────

function startFresh(): void {
  _dismissOops()                // clear any pending Oops offer — fresh start is intentional
  _closeAllOverlays()           // clear any stale backdrop/menu (e.g. Actions z-[375] backdrop)
  formResetKey.value++          // force SEMEntryForm to remount (resets internal sub-stage)
  formSubStage.value = 'input'  // reset the mirrored sub-stage immediately
  _clearSession()
  sessionRestored.value = false
  currentSpec.value = null
  specGeneratedAt.value = null  // Feature #177 — clear timestamp with spec
  sharpeningDone.value = false  // ensure Plan Evo Steps gate resets with the spec
  clearPlanModel()               // clear plan model reference on fresh start
  clearComparison()              // clear any open comparison slots
  comparisonOpen.value = false
  specInputOpen.value  = false
  markdown.value = ''
  originalInput.value = null
  stage.value = 1
  planningStage.value = 1   // reset 11-step bar to the beginning (Enter Stakes)
  confirmedSteps.value = []
  evoPlanConfirmed.value = false
  tasksByStep.value = {}
  capturedImpactMatrix.value = {}
  capturedVCRatios.value = {}
  capturedCalendarCosts.value = {}
  capturedCapitalCosts.value = {}
  // Evo Step 13 — close collaborator panel on reset (conversation is session-scoped)
  collaboratorOpen.value = false
  // Ultra aperture mode — return to the Plan aperture (the circle) on fresh
  // start. Without this, the view stays 'full' after submitting an aperture
  // idea, and a subsequent Fresh Start leaves the user on an empty form
  // instead of the aperture circle. Tom 2026-05-18: "the aperture does not
  // appear" after Fresh Start. All fresh-start paths go through here, so
  // this single call covers _onFreshCanvas, direct startFresh calls, etc.
  if (aperture.enabled.value) aperture.backToPlan()
}

// ── Restart Afresh — double-confirm guard ────────────────────────────────────
// First tap arms a 3-second confirmation window (button pulses red).
// Second tap within the window confirms and calls startFresh().
// Timeout resets the armed state without any action.
// This prevents both accidental mobile taps and misfired voice commands.
const startOverConfirmPending = ref(false)
let _startOverConfirmTimer: ReturnType<typeof setTimeout> | null = null

function requestStartOver(): void {
  if (startOverConfirmPending.value) {
    // Second confirmation — execute
    if (_startOverConfirmTimer !== null) { clearTimeout(_startOverConfirmTimer); _startOverConfirmTimer = null }
    startOverConfirmPending.value = false
    startFresh()
  } else {
    // First tap — arm the confirmation window
    startOverConfirmPending.value = true
    _startOverConfirmTimer = setTimeout(() => {
      startOverConfirmPending.value = false
      _startOverConfirmTimer = null
    }, 3000)
  }
}

// ── Improve This Version ──────────────────────────────────────────────────────
// Returns to Stage 1 (spec review) with the current spec, plan model, and all
// sharpening history intact. The sword icon (🔪) and all editing tools are
// immediately available. No confirm guard needed — nothing is cleared.
//
// goToStage1() is the ONLY entry point for any back-navigation to stage 1.
// It drains every overlay/panel open-state before changing stage so no
// invisible backdrop can persist and intercept clicks after navigation.
// Template refs for the two SharpenDropdown instances (auth nav bar + mock nav bar).
// Only one is ever mounted at a time; the inactive ref is null.
// Used by _closeAllOverlays() to force-close the dropdown on stage navigation,
// preventing its fixed inset-0 z-40 backdrop from blocking clicks after navigation.
const sharpenDropdownAuthRef = ref<{ close(): void } | null>(null)
const sharpenDropdownMockRef = ref<{ close(): void } | null>(null)

/** Drain every overlay/panel open-state so no invisible backdrop persists after
 *  back-navigation.  Call this before changing stage — never set stage directly
 *  in a back-navigation handler. */
function _closeAllOverlays(): void {
  specStoryOpen.value          = false   // close Plan Story strip on any stage/overlay change
  menuOpen.value             = false
  renamePopoverOpen.value    = false
  modelsOpen.value           = false
  specOwnerPanelOpen.value   = false
  govPanelOpen.value         = false
  specTargetsOpen.value      = false
  specEditorOpen.value       = false
  sdrOpen.value              = false
  toolInfoPanelOpen.value    = false
  priorityPanelOpen.value    = false
  globalPriorityOpen.value   = false
  priorityInfoOpen.value     = false
  editInfoOpen.value         = false
  specHealthStatusOpen.value = false
  specHealthAdminOpen.value  = false
  copyrightPanelOpen.value   = false
  saveGlyphHistoryOpen.value = false
  collaboratorOpen.value     = false
  sharpenModalOpen.value     = false
  historyOpen.value          = false
  conflictAnalysisOpen.value = false
  visualiseOpen.value        = false
  heatLaneOpen.value         = false
  valueFlowOpen.value        = false
  evoSimulatorOpen.value     = false
  comparisonOpen.value       = false
  specInputOpen.value        = false
  // Previously missing — all five cause invisible or full-screen overlays:
  presentationOpen.value     = false
  bullockOpen.value          = false
  dashboardOpen.value        = false
  tourOpen.value             = false
  wizardOpen.value           = false
  // Contracts mode is a full-screen z-[600] panel — must be closed so
  // handleSubmit() / stage navigation can reach the spec form beneath it.
  contractsOpen.value        = false
  // SharpenDropdown has internal open state not controlled by the booleans above.
  // Its fixed inset-0 z-40 backdrop blocks all clicks below it (nav bar has no
  // explicit z-index so it sits at z-auto/0 in root context — below z-40).
  sharpenDropdownAuthRef.value?.close()
  sharpenDropdownMockRef.value?.close()
}

/**
 * 🆘 Panic / Reset — STRONGER than _closeAllOverlays.
 *
 * Added 2026-05-13 after Tom: "hangs on generation after it did gen for a
 * round, BUG". The generation-hang failure mode is qualitatively different
 * from "stuck panel" — a hung translate() call leaves the global loading
 * indicator stuck in the spinner state with no panel to close. Tom needs ONE
 * button that returns the app to a known-good state no matter what's hung.
 *
 * What this does on top of `_closeAllOverlays()`:
 * 1. Force-clears every active loading key via `_forceClearLoading()` —
 *    eliminates stuck spinners regardless of whether the originating finally
 *    block ever fires.
 * 2. Surfaces a one-line console.warn so Tom can see in DevTools that the
 *    panic-clear fired (and which keys were active at the moment).
 * 3. Clears `sdkError` so the next Generate attempt isn't blocked by a stale
 *    error banner.
 * 4. Re-asserts `stage1Sub.value = 'form'` so a half-finished precise/clarify
 *    flow drops back to the entry form.
 *
 * Wired to the 🆘 Reset pill in the bottom-left corner.
 */
function panicReset(): void {
  _dismissOops()  // clear any blocking Oops offer immediately
  // Pre-reset save — flush any pending autosave debounce before wiping UI state,
  // so no work is lost regardless of where in the 500ms debounce window we are.
  // Tom 2026-05-18: "attempt a save version whenever any reset options are keyed,
  // before they are acted on." Covers: Esc Tier 2, 🆘 button, FreshStart opt 4.
  _saveNow()

  // Snapshot state BEFORE clearing so the log line is useful
  const wasLoading = isLoading.value
  const wasNonAppView = view.value !== 'app'
  console.warn('[panicReset] User pressed 🆘 Reset.', {
    wasLoading,
    sdkError: sdkError.value,
    stage: stage.value,
    stage1Sub: stage1Sub.value,
    view: view.value,
  })
  // (1) Get the user OUT of any stuck auth/loading view immediately.
  if (view.value !== 'app') view.value = 'app'
  // (2) Close every overlay we know about.
  _closeAllOverlays()
  // (3) Force-clear ALL loading keys regardless of finally blocks.
  _forceClearLoading()
  // (4) Clear stale SDK error so the next Generate isn't blocked visually.
  sdkError.value = ''
  // (5) Drop back to the entry form (sub-stage 'form' renders the SEMEntryForm).
  stage1Sub.value = 'form'
  // (6) Re-anchor stage to 1 so the user lands on the canonical home.
  stage.value = 1
  // (7) Clear in-flight translate guard so a second Generate isn't refused.
  _doTranslateInFlight = false
  // (8) DEMO-EMERGENCY 2026-05-13. Tom mid-Kai-demo: "cant get past sign in
  //     even with reset / disaster I am demo for Kai now". Reset was setting
  //     view='app' but Supabase-stuck users were landing on a blank app
  //     surface with no auth, no spec, no plan model — perceived as "still
  //     stuck". When Reset is pressed from ANY non-app view (sign-in,
  //     sign-up, confirm, invite, loading), auto-launch the scripted demo so
  //     the user lands in a guaranteed-working demo state in one click. They
  //     can still Sign Out from the Actions menu later to return to sign-in.
  if (wasNonAppView && !currentSpec.value) {
    try { launchDemo() } catch (err) {
      console.error('[panicReset] launchDemo failed; user is on home form.', err)
    }
  }
}

function goToStage1(): void {
  _closeAllOverlays()
  stage.value = 1
}

/**
 * Ultra Light — goBack fork handler (Evo Step 3 — 2026-05-16).
 * Called when SEMEntryForm emits 'go-back' — the user pressed the "Go Back"
 * fork while already in the 'input' sub-stage (nothing to undo inside the form).
 *
 * Behaviour:
 *   - Aperture mode ON  → backToPlan() — surfaces the naked Plan aperture,
 *     which is Tom's "go back to home" in the Ultra Light UX.
 *   - Aperture mode OFF → no-op (stage 1 / input is already the beginning;
 *     there is nothing behind it in the normal app flow).
 */
function handleFormGoBack(): void {
  if (aperture.enabled.value) {
    aperture.backToPlan()
  }
}

function goToStage2(): void {
  _closeAllOverlays()
  stage.value = 2
}

/**
 * Navigate to EvoPlanView (stage 2) and trigger a fresh Evo Plan generation.
 * force=true bypasses the identity guard so clicking always regenerates.
 * Called by the stage-6 primary action pin ("⚡ Generate Evo Steps") and
 * handleStageAction(6). Toasts and no-ops when there is no spec yet.
 *
 * Root cause of "Generate Evo Steps pin is dead" (2026-05-29): the previous
 * handler was `() => goToStage2()` which is a no-op when already on
 * EvoPlanView (stage.value === 2 unchanged), so nothing visually happened.
 * Fix r05: navigate first, then fire fetchPlan(force=true) via nextTick so
 * EvoPlanView is guaranteed mounted when the generation starts.
 *
 * Fix r06 (2026-05-29 — double-fetch / silent-no-plan bug):
 *   Calling _resetPlanForLoad() BEFORE goToStage2() sets _skipNextFetch=true
 *   so that EvoPlanView's onMounted auto-fetch is suppressed.  Without this,
 *   mounting EvoPlanView starts one fetch (no force) and the line below starts
 *   a second (force=true), racing each other and corrupting _inFlight state.
 *   Only the single forced fetch below should run per user click.
 */
async function _triggerEvoGeneration(): Promise<void> {
  if (!currentSpec.value) {
    showToast('💡 Add a spec at Stakes first — then Generate Evo Steps unlocks', 3800)
    return
  }
  _resetPlanForLoad()                                 // suppress onMounted auto-fetch
  goToStage2()                                        // ensure EvoPlanView is mounted
  await nextTick()                                    // let Vue flush before fetch starts
  void _fetchEvoPlan(currentSpec.value, true)         // force=true bypasses identity guard
}

function improveCurrentVersion(): void {
  goToStage1()
}

/**
 * Voice / keyboard "Go" / "Next step" / "Continue" command.
 * Fires the primary forward-action button for the current stage.
 *
 * Stage 1 + spec ready  → Plan Evo Steps
 * Stage 1, form in review → Generate Spec (form's own generate button)
 * Stage 2              → Confirm Plan (EvoPlanView)
 * Stage 3 (Impact)     → Plan Tasks (goToTasksStage)
 * Stage 4 (Tasks)      → Study-Act (planning-bar stage 9)
 *
 * Tom 2026-06-03 fix: previously stage 4 went straight to Export, skipping
 * Study-Act (9) and Resources (10) of the 11-stage planning bar.  Tom: *"this
 * jumped over 2 steps... was there a clear next stage option?"*  Next step
 * after Tasks is now Study-Act, matching the planning-bar progression.
 */
async function goNext(): Promise<void> {
  if (stage.value === 1) {
    if (currentSpec.value) {
      // Tom 2026-06-04 r87 BUG fix: was `goToPlanStage()` (no arg) which
      // jumped `planningStage` from 1 → 6 in a single click, skipping
      // Solutions / Sharpen / Impacts / Refine and quickly cascading to
      // Stage 7 if the user pressed Next again.  Tom verbatim:
      // *"it did jump to 7! skipping many steps"*.  Now passes
      // `fromFreshGeneration=true` which keeps `planningStage` at ≥2 only
      // (Solutions review) — user advances stage-by-stage from there.
      goToPlanStage(true)
    } else {
      // SEMEntryForm review stage — click the Generate Spec button.
      // Guard: if the SDK is already generating, clicking again would queue a
      // second translation on top of the first. The button's :disabled blocks
      // real clicks; this guard covers the programmatic path (voice / keyboard).
      if (sdkLoading.value) return
      ;(document.getElementById('sem-generate-btn') as HTMLButtonElement | null)?.click()
    }
  } else if (stage.value === 2) {
    // Directly call confirmPlan() from the composable so this works regardless of
    // whether EvoPlanView's internal button is in the DOM / enabled or not.
    // nextActionLabel hides the button during loading, so this only fires when ready.
    const planSteps = _evoPlan.value?.steps
    if (!planSteps || planSteps.length === 0) return
    try {
      await _confirmEvoPlan()
      onPlanConfirmed(planSteps.map(s => ({ ...s, linkedValues: [...s.linkedValues] })))
    } catch {
      // confirmPlan() sets error state visible in EvoPlanView — no further action needed
    }
  } else if (stage.value === 3) {
    goToTasksStage()
  } else if (stage.value === 4) {
    // Tom 2026-06-03: advance through the 11-stage planning bar (Tasks=8 → Study-Act=9),
    // never skip straight to Export.  Internal `stage` doesn't have a Study-Act slot, so
    // we advance via the planning bar — the user then sees the Study-Act stage view.
    handleStageBarNav(9)
  }
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * The label shown on the floating "Next Step" pill.
 * Reflects the single primary forward action for the current stage + sub-stage.
 * null = no obvious single next step (e.g. still filling the input textarea).
 */
const nextActionLabel = computed<string | null>(() => {
  if (view.value !== 'app') return null
  if (stage.value === 1) {
    if (currentSpec.value)         return 'Plan Evo Steps'
    if (formSubStage.value === 'review') return 'Generate Spec'
    return null   // input sub-stage: user still typing, no single next step
  }
  if (stage.value === 2) {
    // Show "Confirm Plan" only once the plan has loaded with steps.
    // While fetching (plan === null) or on error, the button is hidden —
    // the user sees the EvoPlanView loading/error state and knows to wait.
    if (!_evoPlan.value || _evoPlan.value.steps.length === 0) return null
    return 'Confirm Plan'
  }
  if (stage.value === 3) return 'Spec Tasks'   // Impact (stage 3) → Tasks (stage 4)
  if (stage.value === 4) return 'Study-Act'    // Tasks (8) → Study-Act (9) — Tom 2026-06-03 (no longer skip to Export)
  return null   // stage 5: done
})

// ── Speaker — text-to-read per stage ─────────────────────────────────────────
// Passed to SpeakerButton; what gets read aloud depends on the current stage.

const speakerText = computed<string>(() => {
  if (stage.value === 1 && currentSpec.value) {
    return markdown.value || 'No spec generated yet.'
  }
  if (stage.value === 2 && confirmedSteps.value.length > 0) {
    return confirmedSteps.value
      .map((s, i) => `Step ${i + 1}: ${s.name}. ${s.description ?? ''}`)
      .join('\n')
  }
  if (stage.value === 1 && originalInput.value) {
    const { stakes, ends, means } = originalInput.value
    return `Stakes: ${stakes}. Ends: ${ends}. Means: ${means}.`
  }
  return 'Nothing to read on this screen yet.'
})

function handleSpeak(text: string): void {
  speak(text)
}

// ── Sharpening Cycles ─────────────────────────────────────────────────────────

/**
 * Called when SharpenPanel emits 'sharpened' with a refined SpecBlock.
 * Update currentSpec and markdown in place; record in version history.
 */
function onSpecSharpened(refined: SpecBlock): void {
  // Phase 1 (Sources of Specs) — capture before-spec and round Q&A before state changes
  const specModelId = specModel.value?.id
  const beforeSpec  = currentSpec.value
  const lastRound   = sharpenRounds.value[sharpenRounds.value.length - 1]
  const inputWords  = lastRound
    ? lastRound.answers.reduce((sum, a) => sum + countWords(a), 0)
    : 0
  const sharpenLabel = lastRound?.category.label

  currentSpec.value = refined
  addVersion(refined, 'Sharpened', _evoPlan.value as EvoStepPlan | null, specModel.value?.name ?? '', _specOwnerNames())
  markdown.value = serialise(refined)
  bumpSpecVersion(refined)   // bump spec model version (0.1 → 0.2 → …) after each sharpen round

  // Record which entries changed — diff silently, no UI impact
  if (specModelId && beforeSpec) {
    recordSharpenProvenance(specModelId, beforeSpec, refined, {
      humanInputWords: inputWords,
      label:           sharpenLabel,
    })
  }
}

/**
 * Called when SharpenDropdown (in the nav bar) emits 'open-sharpen'.
 * Opens the SharpenPanel modal and immediately kicks off the chosen category.
 *
 * If a sharpening round is already in flight (`sharpenPhase !== 'idle'`), open
 * the modal *without* starting a new round — the modal will display the current
 * round's state so the planner can see what is happening, rather than the
 * dropdown click silently doing nothing.  The previous early-return caused
 * "menu opens but nothing happens" reports because the click had no visible
 * effect when the singleton phase was stuck non-idle.
 */
async function handleOpenSharpen(cat: SharpenCategory): Promise<void> {
  if (!currentSpec.value) {
    console.warn('[Sharpen] No current spec — cannot start sharpening round')
    return
  }
  // r26 (2026-05-19): Close ALL overlays (especially the SharpenDropdown's z-40
  // teleported backdrop) before mounting the SharpenPanel modal.
  // SharpenDropdown.select() sets open=false synchronously before emitting, but
  // Vue's reactive flush is async — the backdrop is still in the DOM when this
  // function runs. Without _closeAllOverlays() + nextTick, the backdrop can
  // survive into the same render frame as the new modal; when the modal later
  // closes the backdrop lingers at z-40, blocking all page interactions.
  // Pattern mirrors handleSharpenPlan() (r25 fix, 2026-05-18).
  _closeAllOverlays()
  await nextTick()
  // Always open the modal so the user sees feedback for their click.
  sharpenModalOpen.value = true
  // Only start a new round if no round is in flight.  Otherwise the modal
  // surfaces the existing round and the user can finish/cancel it from there.
  if (sharpenPhase.value !== 'idle') return
  await startSharpen(currentSpec.value, cat)
}

/**
 * Called when the SharpenPanel modal emits 'done' (user clicked "Done sharpening"
 * or CloseDot). Closes the modal and shows a toast so the user gets clear
 * confirmation that sharpening was applied — "no feedback" fix (r26, 2026-05-19).
 */
function handleSharpenModalDone(): void {
  sharpenModalOpen.value = false
  const n = sharpenRounds.value.length
  if (n > 0) {
    showToast(`🔪 ${n} sharpening round${n !== 1 ? 's' : ''} applied — plan updated`, 4000)
  }
}

/**
 * Called when EvoPlanView emits 'sharpen-plan' (top or bottom Sharpen button).
 * Opens the SharpenPanel modal in idle state so the user can pick a dimension.
 */
async function handleSharpenPlan(): Promise<void> {
  // 1. Close ALL competing overlays first — this ensures:
  //    a) the ⋯ menu backdrop (z-[375]) is gone before the Sharpen modal (z-[400]) mounts
  //    b) the SharpenDropdown nav-bar backdrop (z-40, teleported) is properly closed via
  //       sharpenDropdownAuthRef/MockRef.close() — without this, the backdrop survives and
  //       freezes the page after the Sharpen modal closes (z-40 blocks all click targets)
  //    c) any other exclusive surface is closed (Single-Surface Rule)
  //    Note: _closeAllOverlays sets sharpenModalOpen = false; we re-open it after nextTick.
  _closeAllOverlays()
  // 2. Reset any stuck singleton phase so the modal always opens on the category picker.
  cancelSharpen()
  // 3. Wait for all closed surfaces to fully unmount from the DOM before mounting the
  //    Sharpen modal. This prevents same-flush ordering races where a closing backdrop
  //    and the new backdrop coexist briefly, which can cause spurious pointer events.
  await nextTick()
  sharpenModalOpen.value = true
}

/**
 * Called when PlanInputPanel emits 'imported'.
 * Treats the parsed spec identically to a generated one: initialise plan model,
 * record version history, serialise markdown, then advance to stage 2 (Evo planning).
 */
function handlePlanImported(spec: SpecBlock): void {
  currentSpec.value      = spec
  specGeneratedAt.value  = new Date()
  initSpecModel(spec)
  addVersion(spec, 'Imported', null, specModel.value?.name ?? '', _specOwnerNames())
  markdown.value    = serialise(spec)
  specInputOpen.value = false
  stage.value       = 2
  scrollToSpec()
}

/**
 * Called when PlanInputPanel emits 'imported-and-sharpen'.
 * Same as handlePlanImported but immediately opens the SharpenPanel modal.
 */
function handlePlanImportedAndSharpen(spec: SpecBlock): void {
  handlePlanImported(spec)
  sharpenModalOpen.value = true
}

/**
 * Called when PlanInputPanel emits 'add-to'.
 * Merges the imported spec's F./V./S. entries into the current live spec.
 * Entries whose id already exists in the current spec are skipped (no overwrites).
 * If there is no current spec, falls back to a full import.
 */
function handlePlanAddTo(imported: SpecBlock): void {
  if (!currentSpec.value) {
    handlePlanImported(imported)
    return
  }

  function mergeById<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
    const existingIds = new Set(existing.map((e) => e.id))
    return [...existing, ...incoming.filter((e) => !existingIds.has(e.id))]
  }

  const merged: SpecBlock = {
    functions: mergeById(currentSpec.value.functions, imported.functions),
    values:    mergeById(currentSpec.value.values,    imported.values),
    solutions: mergeById(currentSpec.value.solutions, imported.solutions),
  }

  currentSpec.value = merged
  markdown.value    = serialise(merged)
  addVersion(merged, 'Added from import', _evoPlan.value, specModel.value?.name ?? '', _specOwnerNames())
  if (specModel.value) saveSpecSnapshot(merged)
  specInputOpen.value = false
  stage.value = 1
  scrollToSpec()
}

/**
 * Shared loader: sets the active Plan Model then clears any stale pre-loaded
 * evo plan (from a prior history restore) so EvoPlanView always generates a
 * fresh plan from the newly loaded spec rather than silently skipping fetch.
 *
 * If a different plan is currently active, it is saved first so no work is
 * lost before the incoming model takes over.
 */
function _applyLoadedModel(model: PlanModel): void {
  // ── Save the outgoing plan before switching ───────────────────────────────
  // Only save when there IS a current model AND it is a different model from
  // the one being loaded (loading the same model again should be a no-op save).
  if (specModel.value && specModel.value.id !== model.id && currentSpec.value) {
    saveSpecSnapshot(currentSpec.value)
  }

  currentSpec.value     = model.spec
  specGeneratedAt.value = model.createdAt ? new Date(model.createdAt) : new Date()
  markdown.value        = serialise(model.spec)
  activatePlanModel(model)
  sharpeningDone.value  = false
  resetSharpen()
  // Tom 2026-06-03: "monitor is contract, but intended for stakeholder group
  // is from another plan."  Root cause: originalInput.stakes (the FOR banner
  // text in EvoPlanView) was NOT being cleared on model switch — it carried
  // over from the previous plan's Stage 1 typed input.  Clear it here so the
  // banner reflects only the CURRENT plan.  The banner falls back to a hidden
  // state when stakes is empty (v-if="rawInput?.stakes?.trim()") — user can
  // re-enter Stage 1 to populate it for the loaded plan if desired.
  originalInput.value = null
  // Suppress auto-generation — when a plan model is loaded/replaced the user
  // should choose when to generate steps, not have it fire automatically on mount.
  _resetPlanForLoad()
}

/**
 * Called when PlanModelBar emits 'load' with a recalled or imported PlanModel.
 * Restores the spec from the model snapshot and advances to the plan view.
 */
function handleLoadPlanModel(model: PlanModel): void {
  _applyLoadedModel(model)
  addVersion(model.spec, `Loaded from ${model.name} v${model.version}`, null, model.name, model.owners?.map(o => o.name).filter(Boolean) ?? [])
  stage.value = 2
}

/**
 * Called when GetAPlanPanel "From History" tab emits 'load-model'.
 * Delegates to the shared loader and closes the panel.
 */
function handleGetAPlanLoadModel(model: PlanModel): void {
  handleLoadPlanModel(model)
  specInputOpen.value = false
}

/**
 * Called when GetAPlanPanel "From History" tab emits 'restore-version'.
 * Unwraps the SpecVersion into the existing onHistoryRestore handler,
 * then closes the panel.
 */
function handleGetAPlanRestoreVersion(sv: SpecVersion): void {
  onHistoryRestore(sv.spec, sv.plan, sv.planName ?? '', sv.planOwners ?? [])
  specInputOpen.value = false
}

/**
 * Load any saved model from the "All Models" drawer and advance to the Evo
 * Plan view so the user lands in the planning workflow, not the spec entry
 * screen.  A fresh plan is always generated from the loaded spec because
 * PlanModel only stores the spec snapshot, not the evo-plan steps.
 */
function handleRestoreModel(model: PlanModel): void {
  _applyLoadedModel(model)
  addVersion(model.spec, `Resumed: ${model.name} v${model.version}`, null, model.name, model.owners?.map(o => o.name).filter(Boolean) ?? [])
  modelsOpen.value = false
  stage.value = 2   // advance to Evo Plan view — user wants to continue planning
  // If Aperture mode is active, exit the plan-circle so the loaded spec is visible.
  if (aperture.enabled.value) aperture.setView('full')
}

/**
 * One-tap "Resume last" — loads the most recently saved model into the Evo Plan view.
 * Only active when a saved model exists.
 */
function resumeLastModel(): void {
  const model = latestPlanModel()
  if (!model) return
  handleRestoreModel(model)
}

/**
 * Explicit save — snapshots the current spec into the active plan model
 * without bumping the version. Triggered by "💾 Save now" in PlanModelBar.
 */
function savePlanNow(): void {
  if (currentSpec.value) {
    saveSpecSnapshot(currentSpec.value)
    showToast('💾 Version checkpoint saved to Plan History', 2500)
  }
}

// ─────────────────────────────────────────────────────────────────────────────

async function handleSubmit(payload: { stakes: string; ends: string; means: string; wish?: string; wishStakeholder?: string }) {
  // Close any open panels/overlays before starting — prevents invisible backdrops
  // from persisting through the generation and blocking all clicks afterward.
  _closeAllOverlays()
  // Dismiss any pending Oops offer — the user is intentionally submitting new
  // content, so the drop-detection that triggered the Oops was a false alarm.
  // Without this the toast lingers through the generation and blocks the UI.
  _dismissOops()
  // Clear any stale SDK error from a previous failed/timed-out generation so it
  // does not persist into the new one (error banner was never cleared on retry).
  sdkError.value = ''
  // Force-reset the in-flight guard on every new top-level generation request.
  // If a previous translate() call is hanging (e.g. network timeout that the
  // 100-second watchdog already fired on), the guard would otherwise block this
  // new attempt silently. The old hung promise will eventually settle and call
  // stopLoading/finally, but by then we have a fresh _doTranslateInFlight=true
  // from the new call — the finally race is harmless (both paths set it false).
  _doTranslateInFlight = false

  // Discard any prior restored session — user is starting a new spec
  _clearSession()
  sessionRestored.value = false
  // Reset dashboard entry ID so the new spec creates a fresh Spec History entry
  currentDashboardEntryId.value = null

  // Reset sharpening state — each new spec starts unsharped
  sharpeningDone.value = false
  resetSharpen()

  markdown.value = ''
  // Snapshot the previous spec before clearing — restored if generation fails so
  // the user is never left with no spec when a re-generation errors or hangs.
  // (Tom 2026-05-29: "all parse lost as I added solutions" — spec cleared before
  //  new generation succeeded, leaving the user with nothing on failure.)
  const _specBeforeSubmit  = currentSpec.value
  const _specModelBeforeSubmit = specModel.value  // for failure-restore symmetry
  currentSpec.value = null
  // Tom 2026-06-04 verbatim: *"I started a new parse but the old project monitor
  // persisted"*.  Root cause: specModel.value held the previous project ("MONITOR
  // CONTRACT — Improve Vessel's Speed Under & Vessel's Speed v0.1") across the
  // new-parse flow.  initPlanModel() runs only AFTER generation completes (line
  // ~2691), so during the 30-60s generation window the title bar still showed
  // the old project's name — Tom rightly read this as "the old project persisted
  // into my new parse".  Fix: clearPlanModel() at parse-start so the title bar
  // reflects "fresh parse" immediately.  Old model is preserved in history (via
  // earlier _upsertHistory calls) so it remains recallable.  On generation
  // FAILURE the spec-restore safety net below also restores specModel so the
  // user isn't left empty-handed.
  clearPlanModel()
  // Tom 2026-06-04 r86: also reset planningStage to 1.  Without this the
  // "What Happens Next" amuse-me card during generation reads the leftover
  // planningStage from the prior project (e.g. 6 — Evo Steps) and tells
  // the user "you are currently at Stage 6 / next is Stage 7" which is
  // wrong when the user just started a fresh parse from the Stakes form.
  planningStage.value = 1
  evoPlanConfirmed.value = false
  confirmedSteps.value = []
  stage.value = 1
  originalInput.value = { stakes: payload.stakes, ends: payload.ends, means: payload.means }

  // Change 3 — stash Wish for post-generation attachment
  pendingWish.value = payload.wish ? { wish: payload.wish, wishStakeholder: payload.wishStakeholder } : null

  if (analysisMode.value === 'precise') {
    // Stash the payload and go to the clarification sub-stage
    pendingPayload.value = { stakes: payload.stakes, ends: payload.ends, means: payload.means }
    stage1Sub.value = 'questions'
    await generateQuestions({ stakes: payload.stakes, ends: payload.ends, means: payload.means })
  } else {
    await doTranslate({ stakes: payload.stakes, ends: payload.ends, means: payload.means })
  }
  // Spec restore safety net: if the generation failed (currentSpec still null),
  // put the previous spec AND its specModel back so the user is never left
  // empty-handed.  Tom 2026-06-04 fix r82: specModel was being cleared at
  // parse-start to fix the "old project persisted" bug; on failure we restore
  // both so the failed parse doesn't ALSO lose the prior project context.
  if (!currentSpec.value && _specBeforeSubmit) {
    currentSpec.value = _specBeforeSubmit
    if (_specModelBeforeSubmit) {
      activatePlanModel(_specModelBeforeSubmit as Parameters<typeof activatePlanModel>[0])
    }
    showToast('⚠️ Generation failed — your previous spec has been restored. Try again.', 5000)
  }
}

// Concurrent-call guard for doTranslate. Added 2026-05-13 after Tom: "hangs
// on generation after it did gen for a round, BUG". If a previous translate()
// call is still in flight when the user clicks Generate again, the second
// call would start a duplicate `sdk:translate` loading key — and if either
// API call hangs, the loading state can never drop to 0 active keys, so the
// global spinner stays up forever. Guarding the entry point means a 2nd
// click while the 1st is in flight is a no-op (the user gets one diagnostic
// console.warn instead of a stuck UI).
let _doTranslateInFlight = false

/** Runs the actual translation, optionally with clarification answers */
async function doTranslate(
  payload: { stakes: string; ends: string; means: string },
  clarifications?: string,
): Promise<void> {
  if (_doTranslateInFlight) {
    console.warn('[doTranslate] Refused — a previous translation is still in flight. Press 🆘 Reset to clear.')
    return
  }
  _doTranslateInFlight = true
  console.info('[doTranslate] starting', { stakes: payload.stakes.slice(0, 60), endsLen: payload.ends.length, hasClarifications: !!clarifications })
  // Evo Step 10: capture start time before the API call for EntryFluency + logSpecGenerated
  const _translateStart = Date.now()
  startLoading('sdk:translate', 'Translating your plan…')
  let succeeded = false
  try {
    const spec = await translate(payload.stakes, payload.ends, payload.means, clarifications)
    if (spec) {
      // Change 3 — attach Wish to all V. entries when the user provided one
      const wish = pendingWish.value
      const annotatedSpec = wish
        ? {
            ...spec,
            values: spec.values.map((v) => ({
              ...v,
              wish: v.wish ?? wish.wish,
              wishStakeholder: v.wishStakeholder ?? wish.wishStakeholder,
            })),
          }
        : spec
      currentSpec.value = annotatedSpec
      specGeneratedAt.value = new Date()   // Feature #177 — capture generation timestamp

      // Preserve stewards across re-generation — Tom 2026-05-28: "save stewards were delete."
      // initPlanModel() creates a blank team (owners:[], planners:[], scribes:[default]).
      // Capture before the call; restore after so the team persists across spec iterations.
      const _prevOwners   = specModel.value?.owners.map(o => ({ ...o })) ?? []
      const _prevPlanners = specModel.value?.planners.map(p => ({ ...p })) ?? []
      // Non-default scribes only — initPlanModel re-creates the default device-user scribe.
      const _prevScribes  = (specModel.value?.scribes ?? []).filter(s => !s.isDefault).map(s => ({ ...s }))

      initSpecModel(annotatedSpec)          // Spec Model — auto-name from first F. entry, version 0.1

      // Restore team (new IDs generated; all contact + role fields preserved).
      for (const { id: _o, ...ownerData }   of _prevOwners)   addOwner(ownerData)
      for (const { id: _p, ...plannerData } of _prevPlanners) addPlanner(plannerData)
      for (const { id: _s, ...scribeData }  of _prevScribes)  addScribe(scribeData)
      // Phase 1 (Sources of Specs) — record initial AI-generation provenance for all entries
      if (specModel.value?.id) {
        const inputWords = countWords(`${payload.stakes} ${payload.ends} ${payload.means}`)
        initEntriesFromSpec(specModel.value.id, annotatedSpec, {
          actor:           'ai',
          changeType:      'generate',
          humanInputWords: inputWords,
          label:           'initial translation',
        })
      }
      addVersion(annotatedSpec, 'Generated', null, specModel.value?.name ?? '', _specOwnerNames())
      markdown.value = serialise(annotatedSpec)
      succeeded = true
      // Stay at stage 1 after spec generation so the user can review the spec,
      // sharpen it, and decide when to advance to Evo Plan (stage 2).
      // Tom 2026-05-29: "normal sem app not working at all beyond parse" — root
      // cause was the previous auto-advance to stage 2 immediately after generation.
      // User arrived at EvoPlanView with "No Evo plan yet" and couldn't interact
      // with the spec or the SharpenPanel — they were bypassed entirely.
      //
      // _resetPlanForLoad() prevents EvoPlanView.onMounted() from auto-generating
      // Evo steps when the user eventually navigates to stage 2 — the user must
      // click "Generate Evo Plan" manually (Tom 2026-05-29: "immediately after
      // generating specs, it jumped to generating evo value steps, with no clicks
      // from me"). Stays correct whether user was at stage 1 or already at stage 2+.
      _resetPlanForLoad()
      scrollToSpec()          // scroll to spec output in current stage
      // Evo Step 10: log spec_generated event (3P.V.EntryFluency / 2S.V.PlannerConfidence)
      const allFieldsPresent = annotatedSpec.values.every(
        (v) => v.scale && v.meter && v.status && v.tolerable && v.goal,
      )
      analytics.logSpecGenerated(annotatedSpec.values.length, allFieldsPresent, Date.now() - _translateStart)
      survey.triggerPostGeneration()
    }
  } finally {
    stopLoading('sdk:translate')
    _doTranslateInFlight = false
    console.info('[doTranslate] finished', { succeeded, elapsedMs: Date.now() - _translateStart, sdkError: sdkError.value })
    // Only leave ClarifyView on success — on failure keep the user's answers visible
    // so they can see the error and retry without losing context.
    if (succeeded || stage1Sub.value === 'form') {
      stage1Sub.value = 'form'
    }
  }
}

/** Called when user submits answers from ClarifyView */
async function handleClarifiedGenerate(answers: string[]): Promise<void> {
  if (!pendingPayload.value) return
  const filled = answers.filter((a) => a.trim())
  const clarifications = filled.length
    ? clarifyQuestions.value
        .map((q, i) => (answers[i]?.trim() ? `Q: ${q}\nA: ${answers[i].trim()}` : ''))
        .filter(Boolean)
        .join('\n\n')
    : undefined
  await doTranslate(pendingPayload.value, clarifications)
  // Only clear pendingPayload on success — if translation failed, keep it so that
  // ClarifyView stays visible (its v-if requires pendingPayload to be non-null).
  // Without this guard, a timeout/network failure on mobile clears pendingPayload,
  // collapses ClarifyView, and drops the user back to the empty entry form.
  if (currentSpec.value) {
    pendingPayload.value = null
    scrollToSpec()
  }
}

/** Called when user skips clarification */
async function handleClarifySkip(): Promise<void> {
  if (!pendingPayload.value) return
  await doTranslate(pendingPayload.value)
  // Same guard as handleClarifiedGenerate — only clear on success.
  if (currentSpec.value) {
    pendingPayload.value = null
    scrollToSpec()
  }
}

/** Called when user goes back from ClarifyView to the form */
function handleClarifyBack(): void {
  stage1Sub.value = 'form'
  pendingPayload.value = null
  currentSpec.value = null
  markdown.value = ''
}

/**
 * Guarantee the Plan Identity Bar has a model to display before entering Stage 2.
 * Uses the most-recently-updated saved model if one exists; otherwise creates a
 * new one from the current spec so the bar is never blank.
 */
function _ensurePlanModel(spec: SpecBlock): void {
  if (specModel.value) return            // already active — nothing to do
  const latest = latestPlanModel()
  if (latest) {
    activatePlanModel(latest)            // re-activate the most recent saved model
  } else {
    initSpecModel(spec)                  // no saved models at all — create one
  }
}

/**
 * Called when user clicks "Plan Evo Steps" in Stage 1, or after fresh spec
 * generation (in which case `fromFreshGeneration` = true).
 *
 * The `fromFreshGeneration` flag controls how the 11-step planning bar is advanced:
 *   false (default — explicit user navigation to Evo Steps):
 *     advance bar to ≥6 so EvoPlanView feels "at home".
 *   true (auto-advance after AI generates first spec):
 *     advance bar to ≥2 (Edit Values) only — do NOT skip the user over Sharpen
 *     (stage 4) and Estimate Impacts (stage 5). The user should visit those stages
 *     before generating Evo Steps. Tom: "it jumped from sharpen (not chosen yet)
 *     to evosteps hopping over intermediate steps!"
 */
function goToPlanStage(fromFreshGeneration = false): void {
  if (currentSpec.value) {
    _closeAllOverlays()          // prevent any stage-1 panel from persisting into stage 2
    _ensurePlanModel(currentSpec.value)
    stage.value = 2
    // Never REGRESS a bar position — if the user was already at stage 7+, keep them there.
    if (fromFreshGeneration) {
      // After AI generates spec: advance bar from stage 1 → 2 (Edit Values).
      // The user still needs to go through Edit Values → Edit Solutions → Sharpen →
      // Estimate Impacts before reaching Evo Steps at stage 6.
      if (planningStage.value < 2) planningStage.value = 2
    } else {
      // Explicit navigation to Evo Steps view: jump bar to stage 6 if not already there.
      if (planningStage.value < 6) planningStage.value = 6
    }
  }
}

/** Called when EvoPlanView emits 'confirmed' — plan is ready, move to Evo Impact stage */
function onPlanConfirmed(steps: EvoStep[]): void {
  confirmedSteps.value = steps
  evoPlanConfirmed.value = true
  if (currentSpec.value) _ensurePlanModel(currentSpec.value) // keep bar visible on stage 3
  stage.value = 3
  // Tom 2026-06-03 — "we are clearly in the stage after evo steps, the impact,
  // but the step indicator has not moved on". The app view advanced (stage=3,
  // renders ImpactEstimationView) but the planning-bar indicator stayed on
  // Stage 6 (Evo Steps). Confirming the Evo Plan logically advances to Stage
  // 7 (Evo Impact, the V × S impact-estimation table — r15 ratified that
  // semantic). Sync the indicator. Only forward-advance — if the user is
  // already past Stage 7 (e.g. came back from Tasks to re-confirm), do not
  // demote them.
  if (planningStage.value < 7) planningStage.value = 7
  // Evo Step 10: log evo_plan_confirmed event (3P.V.EvoStepPlanQuality / 2S.V.PlannerPlanningTrust)
  analytics.logEvoPlanConfirmed(steps.length)
  survey.triggerPostPlanning()
}

/**
 * Navigates to the Impact Estimation stage (stage 3).
 * Called by voice command "Estimate Impact" and from onPlanConfirmed flow.
 */
function goToImpactStage(): void {
  if (currentSpec.value) _ensurePlanModel(currentSpec.value) // guarantee bar shows at stage 3
  stage.value = 3
  // Sync planning bar to stage 5 (Estimate Impacts) if it hasn't been there yet.
  if (planningStage.value < 5) planningStage.value = 5
}

/**
 * Dispatcher for the Evo Tools catalogue (Tom 2026-06-03 marker).
 * EvoToolsPanel emits `tool-activated` with the tool's emitEvent name; this
 * function maps that name to the right surface-open / navigation call.
 *
 * Adding a new 'ready' tool to the registry requires:
 *   (1) flip status to 'ready' in src/data/evoTools.ts
 *   (2) ensure the emitEvent name maps to a case here (or reuse an existing one)
 * No other wiring needed — this dispatcher is the single integration point.
 *
 * Always closes the Evo Tools panel after dispatch so the user lands directly
 * on the tool.
 */
function onEvoToolActivated(payload: { id: string; emitEvent: string; payload?: Record<string, unknown> }): void {
  evoToolsOpen.value = false
  switch (payload.emitEvent) {
    case 'open-value-flow':
      valueFlowOpen.value = true
      break
    case 'open-evo-simulator':
      evoSimulatorOpen.value = true
      break
    case 'open-visualise':
      _vizInitialTab.value = (payload.payload?.tab as string) ?? ''
      visualiseOpen.value = true
      break
    case 'open-heat-lane':
      heatLaneOpen.value = true
      break
    case 'open-evo-critique':
      evoCritiquerOpen.value = true
      break
    case 'open-sharpen-next-step':
      evoSharpOpen.value = true
      break
    case 'open-evo-step-improvement':
      evoStepImprovementOpen.value = true
      break
    case 'open-feed-me':
      feedMeOpen.value = true
      break
    case 'go-to-evo-impact-stage':
      goToImpactStage()
      break
    case 'go-to-evo-steps-stage':
      goToStage2()
      break
    case 'go-to-tasks-stage':
      goToTasksStage()
      break
    default:
      // Unrecognised tool emit — log to console for the dev to wire it up.
      console.warn(`[EvoTools] No dispatcher for emitEvent "${payload.emitEvent}" (tool id: "${payload.id}").`)
  }
}

/**
 * Transitions from Impact Estimation (stage 3) → Task Decomposition (stage 4).
 * Captures the live IET snapshot BEFORE ImpactEstimationView unmounts at stage 3,
 * so exportFull() has current data even if @matrix-updated hasn't fired for all rows.
 */
function goToTasksStage(): void {
  const snapshot = ietRef.value?.getSnapshot?.()
  if (snapshot) {
    capturedImpactMatrix.value  = snapshot.matrix
    capturedVCRatios.value      = snapshot.efficiency
    capturedCalendarCosts.value = snapshot.calendarCosts
    capturedCapitalCosts.value  = snapshot.capitalCosts
  }
  _closeAllOverlays()
  if (currentSpec.value) _ensurePlanModel(currentSpec.value)
  stage.value = 4
  // Sync planning bar to stage 8 (Plan Tasks) if it hasn't reached there yet.
  if (planningStage.value < 8) planningStage.value = 8
}

/** Called when user wants to export the full prioritised plan */
function exportFull(): void {
  if (!currentSpec.value) return

  // Impact data is normally captured via @matrix-updated events or by goToTasksStage()
  // which snapshots the live IET before stage 3 unmounts.
  // If the user skipped Impact Estimation entirely, the matrix is empty — auto-populate
  // with deterministic mock values so the VDT table is never all-zeros on export.
  if (
    Object.keys(capturedImpactMatrix.value).length === 0 &&
    currentSpec.value.values.length > 0 &&
    currentSpec.value.solutions.length > 0
  ) {
    const snap = computeMockImpactSnapshot(
      currentSpec.value.values,
      currentSpec.value.solutions,
    )
    capturedImpactMatrix.value  = snap.matrix
    capturedVCRatios.value      = snap.vcRatios
    capturedCalendarCosts.value = snap.calendarCosts
    capturedCapitalCosts.value  = snap.capitalCosts
  }

  if (currentSpec.value) _ensurePlanModel(currentSpec.value) // keep bar visible on stage 5
  stage.value = 5
  // Tom 2026-06-04 bug fix: also advance the planning bar to Stage 11 ·
  // Export so the canonical bar tile lights up.  Previously exportFull()
  // only set the internal stage (Tom verbatim: *"I pressed the new to
  // export stage button and it did not move to that step"*) — the export
  // CONTENT showed but the bar still highlighted Stage 10.
  if (planningStage.value < 11) planningStage.value = 11
  // Evo Step 10: log impact_estimated event (3P.V.PrioritisationAccuracy)
  analytics.logImpactEstimated(currentSpec.value.values.length)
}

// ── Download entire plan as Markdown ─────────────────────────────────────────
// Captures spec + evo plan + tasks at whatever stage the user is currently at.
function downloadPlan(): void {
  if (!currentSpec.value) return

  const now      = new Date()
  const date     = now.toISOString().slice(0, 10)
  const hh       = now.getHours().toString().padStart(2, '0')
  const mm       = now.getMinutes().toString().padStart(2, '0')
  const modelName = specModel.value?.name ?? 'Planning Spec'
  const version   = specModel.value ? `  v${specModel.value.version}` : ''

  // Plain-text header — no Markdown
  const HR = '═'.repeat(48)
  const header = [
    HR,
    `${modelName}${version}`,
    `Exported: ${now.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}  ${hh}:${mm}`,
    HR,
    '',
  ].join('\n')

  const body = confirmedSteps.value.length > 0
    ? exportWithTasksPlainText(currentSpec.value, confirmedSteps.value, tasksByStep.value)
    : serialisePlainText(currentSpec.value)

  // Filename: human-readable, filesystem-safe, date + time, .txt extension
  const safeName = modelName
    .replace(/[/\\?%*:|"<>]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 40)
  const filename = specModel.value
    ? `${safeName}-v${specModel.value.version}-${date}-${hh}${mm}.txt`
    : `plan-${date}-${hh}${mm}.txt`

  const blob = new Blob([header + body], { type: 'text/plain;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Value Flow SVG download (Evo Impact stage per-diagram export) ─────────────
// Tom 2026-06-05: "each diagram needs copy, email, download buttons."
// Queries the SVG element rendered inside the embedded VF card and serializes it.
const _vfEmbedBodyRef = ref<HTMLElement | null>(null)

function downloadValueFlowSvg(): void {
  const svgEl = _vfEmbedBodyRef.value?.querySelector('svg')
  if (!svgEl) {
    showToast('Value Flow SVG not found — try Enlarge ↗ to render the full diagram first', 3500)
    return
  }
  const svgString = new XMLSerializer().serializeToString(svgEl)
  const date = new Date().toISOString().slice(0, 10)
  const safeName = (specModel.value?.name ?? 'ValueFlow')
    .replace(/[/\\?%*:|"<>]/g, '').replace(/\s+/g, '-').slice(0, 40)
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${safeName}-value-flow-${date}.svg`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  showToast('Value Flow downloaded as SVG', 3000)
}

// ── Per-impact-table export helpers (Tom 2026-06-05) ─────────────────────────
// Tom: "I do not seem to get that evo step table with copy, i get a set of
// planguage specs." — these functions export TABLE-SPECIFIC colorful HTML,
// not the full Planguage spec.  Color scheme mirrors the traffic-light
// scheme used inside ImpactEstimationStepView / ImpactEstimationView.

function _impactCellBg(v: number): string {
  if (v === 0) return '#ffffff'
  if (v < 0)   return '#fca5a5'
  if (v >= 80) return '#86efac'
  if (v >= 60) return '#bbf7d0'
  if (v >= 30) return '#fde68a'
  return '#fecaca'
}
function _impactCellFg(v: number): string { return v === 0 ? '#9ca3af' : '#0f172a' }
function _impactCellText(v: number): string { return v === 0 ? '–' : String(v) }

// ── V × Evo Step HTML builder ─────────────────────────────────────────────────
// Replicates ImpactEstimationStepView's cell aggregation logic as a pure
// function so Copy/Email/Download can export just this table.

function _buildImpactStepTableHtml(): string {
  const spec   = currentSpec.value
  const steps  = _stepsForDiagram.value
  const matrix = capturedImpactMatrix.value
  if (!spec || steps.length === 0) return ''
  const values    = spec.values
  const solutions = spec.solutions

  // Resolve LLM linkedSolution refs → solution.id (mirrors component logic)
  const solLookup = new Map<string, string>()
  for (const sol of solutions) {
    solLookup.set(sol.id, sol.id)
    solLookup.set(sol.description.trim().toLowerCase(), sol.id)
  }
  const resolveRef = (ref: string): string =>
    solLookup.get(ref.trim().toLowerCase()) ?? solLookup.get(ref.trim()) ?? ref
  const stepCell = (valueId: string, step: EvoStep): number => {
    const row = matrix[valueId]
    if (!row) return 0
    return step.linkedSolutions.reduce((s, r) => s + (row[resolveRef(r)] ?? 0), 0)
  }
  const rowTotal = (valueId: string): number =>
    steps.reduce((s, st) => s + stepCell(valueId, st), 0)
  const colTotal = (step: EvoStep): number =>
    values.reduce((s, v) => s + stepCell(v.id, step), 0)

  const date  = new Date().toISOString().slice(0, 10)
  const name  = specModel.value?.name ?? 'Evo Impact'
  const cols  = steps.length + 2
  const H_BG  = '#059669'   // emerald-600 — matches ImpactEstimationStepView header
  const SH_BG = '#e2e8f0'
  const SH_FG = '#374151'

  let h = `<table border="0" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:12px;margin:0 0 14px 0;">`
  h += `<tr><td colspan="${cols}" bgcolor="${H_BG}" style="background:${H_BG};color:#ffffff;font-weight:bold;font-size:13px;padding:10px 14px;">Value × Evo Step Impact — ${name} · ${date}</td></tr>`
  h += `<tr bgcolor="${SH_BG}" style="background:${SH_BG};">`
  h += `<td style="padding:6px 10px;font-weight:bold;color:${SH_FG};border-bottom:2px solid #94a3b8;min-width:160px;">Value \\ Evo Step</td>`
  for (const st of steps) h += `<td style="padding:6px 10px;font-weight:bold;color:${SH_FG};border-bottom:2px solid #94a3b8;min-width:100px;" title="${st.description}">${st.name}</td>`
  h += `<td style="padding:6px 10px;font-weight:bold;color:${SH_FG};border-bottom:2px solid #94a3b8;text-align:right;background:#cbd5e1;">Σ Value</td>`
  h += `</tr>`
  for (const v of values) {
    h += `<tr>`
    h += `<td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;"><span style="font-weight:bold;color:#047857;">${v.id}</span><span style="color:#64748b;margin-left:6px;">${v.description}</span></td>`
    for (const st of steps) {
      const cv = stepCell(v.id, st)
      h += `<td bgcolor="${_impactCellBg(cv)}" style="background:${_impactCellBg(cv)};color:${_impactCellFg(cv)};font-weight:bold;text-align:center;padding:6px 10px;border-bottom:1px solid #e2e8f0;">${_impactCellText(cv)}</td>`
    }
    h += `<td style="background:#f8fafc;font-weight:bold;color:#1e293b;text-align:right;padding:6px 10px;border-bottom:1px solid #e2e8f0;">${_impactCellText(rowTotal(v.id))}</td>`
    h += `</tr>`
  }
  h += `<tr bgcolor="#eef2ff" style="background:#eef2ff;border-top:2px solid #c7d2fe;">`
  h += `<td style="padding:5px 10px;font-weight:600;color:#4338ca;text-align:right;">Effort %</td>`
  for (const st of steps) h += `<td bgcolor="#eef2ff" style="background:#eef2ff;color:#4338ca;font-weight:bold;text-align:center;padding:5px 10px;">${st.effortPercent}%</td>`
  h += `<td bgcolor="#eef2ff" style="background:#eef2ff;"></td></tr>`
  h += `<tr bgcolor="${SH_BG}" style="background:${SH_BG};border-top:2px solid #94a3b8;">`
  h += `<td style="padding:5px 10px;font-weight:bold;color:${SH_FG};text-align:right;">Σ Impact (this step)</td>`
  for (const st of steps) h += `<td bgcolor="${SH_BG}" style="background:${SH_BG};font-weight:800;color:#0f172a;text-align:center;padding:5px 10px;">${_impactCellText(colTotal(st))}</td>`
  h += `<td bgcolor="#94a3b8" style="background:#94a3b8;font-weight:bold;color:#0f172a;text-align:right;padding:5px 10px;">Σ Σ</td></tr>`
  h += `</table>`
  return h
}

// ── V × Solution HTML builder ─────────────────────────────────────────────────
// Reads capturedImpactMatrix directly (keyed by [valueId][solutionId]).

function _buildImpactSolutionTableHtml(): string {
  const spec   = currentSpec.value
  const matrix = capturedImpactMatrix.value
  if (!spec || spec.values.length === 0 || spec.solutions.length === 0) return ''
  const values    = spec.values
  const solutions = spec.solutions

  const cellV    = (vid: string, sid: string): number => matrix[vid]?.[sid] ?? 0
  const rowTotal = (vid: string): number => solutions.reduce((s, sol) => s + cellV(vid, sol.id), 0)
  const colTotal = (sid: string): number => values.reduce((s, v) => s + cellV(v.id, sid), 0)

  const date  = new Date().toISOString().slice(0, 10)
  const name  = specModel.value?.name ?? 'Evo Impact'
  const cols  = solutions.length + 2
  const H_BG  = '#4f46e5'   // indigo-600 — matches V×S panel style
  const SH_BG = '#e2e8f0'
  const SH_FG = '#374151'

  let h = `<table border="0" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:12px;margin:0 0 14px 0;">`
  h += `<tr><td colspan="${cols}" bgcolor="${H_BG}" style="background:${H_BG};color:#ffffff;font-weight:bold;font-size:13px;padding:10px 14px;">Value × Solution Impact — ${name} · ${date}</td></tr>`
  h += `<tr bgcolor="${SH_BG}" style="background:${SH_BG};">`
  h += `<td style="padding:6px 10px;font-weight:bold;color:${SH_FG};border-bottom:2px solid #94a3b8;min-width:160px;">Value \\ Solution</td>`
  for (const sol of solutions) h += `<td style="padding:6px 10px;font-weight:bold;color:${SH_FG};border-bottom:2px solid #94a3b8;min-width:100px;" title="${sol.description}">${sol.id}</td>`
  h += `<td style="padding:6px 10px;font-weight:bold;color:${SH_FG};border-bottom:2px solid #94a3b8;text-align:right;background:#cbd5e1;">Σ Value</td></tr>`
  for (const v of values) {
    h += `<tr>`
    h += `<td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;"><span style="font-weight:bold;color:#6d28d9;">${v.id}</span><span style="color:#64748b;margin-left:6px;">${v.description}</span></td>`
    for (const sol of solutions) {
      const cv = cellV(v.id, sol.id)
      h += `<td bgcolor="${_impactCellBg(cv)}" style="background:${_impactCellBg(cv)};color:${_impactCellFg(cv)};font-weight:bold;text-align:center;padding:6px 10px;border-bottom:1px solid #e2e8f0;">${_impactCellText(cv)}</td>`
    }
    h += `<td style="background:#f8fafc;font-weight:bold;color:#1e293b;text-align:right;padding:6px 10px;border-bottom:1px solid #e2e8f0;">${_impactCellText(rowTotal(v.id))}</td>`
    h += `</tr>`
  }
  h += `<tr bgcolor="${SH_BG}" style="background:${SH_BG};border-top:2px solid #94a3b8;">`
  h += `<td style="padding:5px 10px;font-weight:bold;color:${SH_FG};text-align:right;">Σ Impact (this solution)</td>`
  for (const sol of solutions) h += `<td bgcolor="${SH_BG}" style="background:${SH_BG};font-weight:800;color:#0f172a;text-align:center;padding:5px 10px;">${_impactCellText(colTotal(sol.id))}</td>`
  h += `<td bgcolor="#94a3b8" style="background:#94a3b8;font-weight:bold;color:#0f172a;text-align:right;padding:5px 10px;">Σ Σ</td></tr>`
  h += `</table>`
  return h
}

// ── V × Evo Step — copy / email / download ────────────────────────────────────

async function copyImpactStepTable(): Promise<void> {
  showToast('Building Value × Evo Step table…', 1500)
  try {
    const html = _buildImpactStepTableHtml()
    if (!html) { showToast('No Value × Step data yet — generate an Evo Plan and fill Value × Solution first', 4000); return }
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) {
      await navigator.clipboard.write([new ClipboardItem({
        'text/html':  new Blob([html],                                  { type: 'text/html'  }),
        'text/plain': new Blob(['Value × Evo Step Impact table'],       { type: 'text/plain' }),
      })])
      showToast('📋 Value × Evo Step table copied — paste into Keynote, Mail, or Notes', 5000)
    } else {
      await navigator.clipboard.writeText('Value × Evo Step Impact table — use Email or Download for the colourful version')
      showToast('📋 Copied (plain fallback) — use Email or Download for the colourful table', 5000)
    }
  } catch (err) { showToast(`Copy failed: ${String(err).slice(0, 80)}`, 7000) }
}

async function emailImpactStepTable(): Promise<void> {
  showToast('Building Value × Evo Step email…', 1500)
  try {
    const html = _buildImpactStepTableHtml()
    if (!html) { showToast('No Value × Step data yet — generate an Evo Plan and fill Value × Solution first', 4000); return }
    const date    = new Date().toISOString().slice(0, 10)
    const name    = specModel.value?.name ?? 'Evo Impact'
    const subject = `Value × Evo Step Impact — ${name} · ${date}`
    let clipOk = false
    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) {
        await navigator.clipboard.write([new ClipboardItem({
          'text/html':  new Blob([html],                                  { type: 'text/html'  }),
          'text/plain': new Blob(['Value × Evo Step Impact table'],       { type: 'text/plain' }),
        })])
        clipOk = true
      }
    } catch { /* mail still opens */ }
    const cue  = clipOk ? 'PASTE ⌘V (CMD+V) HERE FOR COLOR VERSION' : '(Auto-copy failed — use Copy first, then ⌘V here.)'
    const HR   = '────────────────────────────────────────────────────────'
    const body = `${cue}\nExported: ${date}\n${HR}\n\nValue × Evo Step Impact — ${name}\nPaste ⌘V above for the colourful table.`
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    showToast('Mail opening — press ⌘V in the body to paste the colourful table, then Send', 6000)
  } catch (err) { showToast(`Email failed: ${String(err).slice(0, 80)}`, 7000) }
}

function downloadImpactStepTable(): void {
  const html = _buildImpactStepTableHtml()
  if (!html) { showToast('No Value × Step data yet — generate an Evo Plan and fill Value × Solution first', 4000); return }
  const date = new Date().toISOString().slice(0, 10)
  const name = specModel.value?.name ?? 'Evo Impact'
  const safe = name.replace(/[/\\?%*:|"<>]/g, '').replace(/\s+/g, '-').slice(0, 40)
  const doc  = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Value × Evo Step Impact — ${name}</title></head><body style="font-family:Arial,sans-serif;padding:20px;">${html}</body></html>`
  const blob = new Blob([doc], { type: 'text/html;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${safe}-impact-step-${date}.html`
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(url)
  showToast('Value × Evo Step table downloaded as HTML', 3000)
}

// ── V × Solution — copy / email / download ────────────────────────────────────

async function copyImpactSolutionTable(): Promise<void> {
  showToast('Building Value × Solution table…', 1500)
  try {
    const html = _buildImpactSolutionTableHtml()
    if (!html) { showToast('No Value × Solution data yet — fill the impact table first', 4000); return }
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) {
      await navigator.clipboard.write([new ClipboardItem({
        'text/html':  new Blob([html],                                  { type: 'text/html'  }),
        'text/plain': new Blob(['Value × Solution Impact table'],       { type: 'text/plain' }),
      })])
      showToast('📋 Value × Solution table copied — paste into Keynote, Mail, or Notes', 5000)
    } else {
      await navigator.clipboard.writeText('Value × Solution Impact table — use Email or Download for the colourful version')
      showToast('📋 Copied (plain fallback) — use Email or Download for the colourful table', 5000)
    }
  } catch (err) { showToast(`Copy failed: ${String(err).slice(0, 80)}`, 7000) }
}

async function emailImpactSolutionTable(): Promise<void> {
  showToast('Building Value × Solution email…', 1500)
  try {
    const html = _buildImpactSolutionTableHtml()
    if (!html) { showToast('No Value × Solution data yet — fill the impact table first', 4000); return }
    const date    = new Date().toISOString().slice(0, 10)
    const name    = specModel.value?.name ?? 'Evo Impact'
    const subject = `Value × Solution Impact — ${name} · ${date}`
    let clipOk = false
    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) {
        await navigator.clipboard.write([new ClipboardItem({
          'text/html':  new Blob([html],                                  { type: 'text/html'  }),
          'text/plain': new Blob(['Value × Solution Impact table'],       { type: 'text/plain' }),
        })])
        clipOk = true
      }
    } catch { /* mail still opens */ }
    const cue  = clipOk ? 'PASTE ⌘V (CMD+V) HERE FOR COLOR VERSION' : '(Auto-copy failed — use Copy first, then ⌘V here.)'
    const HR   = '────────────────────────────────────────────────────────'
    const body = `${cue}\nExported: ${date}\n${HR}\n\nValue × Solution Impact — ${name}\nPaste ⌘V above for the colourful table.`
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    showToast('Mail opening — press ⌘V in the body to paste the colourful table, then Send', 6000)
  } catch (err) { showToast(`Email failed: ${String(err).slice(0, 80)}`, 7000) }
}

function downloadImpactSolutionTable(): void {
  const html = _buildImpactSolutionTableHtml()
  if (!html) { showToast('No Value × Solution data yet — fill the impact table first', 4000); return }
  const date = new Date().toISOString().slice(0, 10)
  const name = specModel.value?.name ?? 'Evo Impact'
  const safe = name.replace(/[/\\?%*:|"<>]/g, '').replace(/\s+/g, '-').slice(0, 40)
  const doc  = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Value × Solution Impact — ${name}</title></head><body style="font-family:Arial,sans-serif;padding:20px;">${html}</body></html>`
  const blob = new Blob([doc], { type: 'text/html;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${safe}-impact-solution-${date}.html`
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(url)
  showToast('Value × Solution table downloaded as HTML', 3000)
}

// ── Auto-copy plan to clipboard on stage 5 entry ──────────────────────────────
// Fires unconditionally when the Prioritised Plan view is reached.
// Copies the full plain-text plan and shows a toast so the user knows it's there.
// No mail client is opened — user can paste wherever they like.
async function autoCopyPlan(): Promise<void> {
  // Tom 2026-06-04 — diagnostic version.  Every step shows a toast so we know
  // exactly where the function dies if anything throws.  Outer try/catch
  // ensures ANY unexpected error surfaces as a visible toast instead of
  // silently disappearing into an unhandled-promise-rejection.
  console.log('[autoCopyPlan] handler entered')
  showToast('Copy clicked — building plan text…', 1800)

  try {
    if (!currentSpec.value) {
      showToast('Nothing to copy yet — load or generate a Spec first', 4000)
      return
    }

    const now       = new Date()
    const hh        = now.getHours().toString().padStart(2, '0')
    const mm        = now.getMinutes().toString().padStart(2, '0')
    const modelName = specModel.value?.name ?? 'Planning Spec'
    const version   = specModel.value ? `  v${specModel.value.version}` : ''
    const HR        = '═'.repeat(48)

    const fileHeader = [
      HR,
      `${modelName}${version}`,
      `Exported: ${now.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}  ${hh}:${mm}`,
      HR,
      '',
    ].join('\n')

    let planBody = ''
    try {
      planBody = confirmedSteps.value.length > 0
        ? exportWithTasksPlainText(currentSpec.value, confirmedSteps.value, tasksByStep.value)
        : serialisePlainText(currentSpec.value)
    } catch (serErr) {
      console.error('[autoCopyPlan] plain-text serialiser threw', serErr)
      showToast(`Copy build failed at serialiser: ${String(serErr).slice(0, 80)}`, 7000)
      return
    }

    const fullText = fileHeader + planBody

    // ALSO build the colourful HTML version — Tom 2026-06-04: *"The copy
    // gives a colored text, but no colored border rectangles, which it does
    // in email copy but not in copy and paste in Keynote"*.  Solution: put
    // BOTH HTML and plain text on the clipboard.  Paste targets pick the
    // richest representation they understand: Keynote takes the HTML table
    // (coloured rectangles!), Notes/Slack/Mail.app HTML-aware takes the
    // HTML, plain-text-only targets fall back to the text.
    let htmlText = ''
    try {
      htmlText = renderColorfulSpecHtml(currentSpec.value, modelName, version.trim() || undefined)
    } catch (rErr) {
      console.warn('[autoCopyPlan] colourful HTML build failed — plain text only', rErr)
    }

    console.log(`[autoCopyPlan] built plain=${fullText.length} html=${htmlText.length} chars`)

    // Primary: ClipboardItem dual-MIME write (text/html + text/plain).
    try {
      if (htmlText && typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html':  new Blob([htmlText],  { type: 'text/html'  }),
            'text/plain': new Blob([fullText],  { type: 'text/plain' }),
          }),
        ])
        showToast(`📋 Spec copied (colourful + plain) — paste into Keynote, Mail, Notes, anywhere`, 5000)
        return
      }
      // No HTML available — fall back to plain-only writeText.
      await navigator.clipboard.writeText(fullText)
      showToast(`📋 Plan copied (${fullText.length.toLocaleString()} chars, plain) — paste anywhere`, 5000)
      return
    } catch (err) {
      console.warn('[autoCopyPlan] navigator.clipboard.write failed, falling back to execCommand', err)
    }

    // Fallback: hidden textarea + execCommand('copy') — plain text only.
    try {
      const ta = document.createElement('textarea')
      ta.value           = fullText
      ta.style.position  = 'fixed'
      ta.style.top       = '-1000px'
      ta.style.opacity   = '0'
      ta.setAttribute('readonly', '')
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      if (ok) {
        showToast(`📋 Plan copied via fallback (${fullText.length.toLocaleString()} chars, plain only)`, 5000)
        return
      }
      showToast('Copy blocked — execCommand returned false', 6000)
    } catch (err) {
      console.error('[autoCopyPlan] execCommand fallback threw', err)
      showToast(`Copy blocked: ${String(err).slice(0, 80)}`, 7000)
    }
  } catch (outerErr) {
    console.error('[autoCopyPlan] outer catch — unexpected throw', outerErr)
    showToast(`Copy crashed: ${String(outerErr).slice(0, 80)} (see Console)`, 8000)
  }
}

// ── Email entire plan ─────────────────────────────────────────────────────────
// Tom 2026-06-04 — TWO SUPREME design rules ratified for ALL SEM App emailing:
//
//   RULE A (Colorful HTML Spec Export):  *"WHEN EMAILING I LIKE always
//          (design rule) to send colorful html version of the spec.  more
//          fun and dramatic, by far."*  Every email body is the COLOURFUL
//          HTML render of the spec — not plain text.  Per-entry-type sections
//          with canonical Planguage colours (Function = green, Value = violet,
//          Solution = orange, Constraint = red, Stakeholder = blue).
//
//   RULE B (Pre-pasted Body — no manual paste):  *"please do the paste into
//          the email for me."*  The user MUST NOT have to manually paste the
//          spec into the email body — it must arrive already pre-filled.
//
// STRATEGY satisfying both rules:
//   The .eml file format is the only mechanism that pre-fills BOTH the
//   subject AND the rich HTML body in the user's mail client.  `mailto:` only
//   supports plain text and length-capped bodies — it FAILS rule A.  A
//   colourful HTML clipboard paste FAILS rule B (manual paste required).
//
//   So: build the colourful HTML via `renderColorfulSpecHtml()`, wrap it in
//   a multipart/alternative .eml with a plain-text fallback for screen
//   readers + ancient mail clients, download the .eml, and Mail.app (or
//   whatever app is registered as the macOS `message/rfc822` handler) opens
//   it as a compose-draft window with the colourful body already in place.
//
//   To prevent Tom's previous "downloaded a file, no Mail opened" surprise,
//   ALSO copy the colourful HTML to the clipboard as text/html (so any rich
//   paste anywhere lands coloured), AND show a prominent toast naming the
//   .eml file so Tom knows what to look for if Mail.app doesn't auto-open.
async function emailPlan(): Promise<void> {
  // Tom 2026-06-04 amendment to the email export rules:
  //   *"It does not go to eail, auto, I have to click on email myself.
  //    I think it should go to emai forme"* + *"email has old -md not the
  //    color stuff"*.
  //
  // Constraint trade-off (web-platform reality):
  //   • mailto:  → reliably auto-opens Mail.app, but body is TEXT-ONLY
  //                (mail clients refuse to render HTML received via mailto)
  //   • .eml     → carries HTML body, but Safari saves to ~/Downloads and
  //                does not auto-open in Mail unless "Open safe files" is on
  //                — Tom hit exactly that and saw an .md-looking blob.
  //
  // Resolution Tom approved:
  //   • Render the colourful HTML once.
  //   • PRIMARY:  put the colourful HTML on the clipboard as text/html
  //     (Apple Mail and most desktop clients accept rich HTML on paste —
  //     pasting lands coloured).
  //   • PRIMARY:  fire mailto: which auto-opens Mail.app's compose window
  //     with the subject pre-filled and a 1-line cue body that says
  //     "Press ⌘V here to paste the colourful Spec."  One keystroke from
  //     Tom; auto-open satisfied; colourful satisfied; no .md confusion.
  //   • The old .eml download path is RETIRED for emailPlan() — it caused
  //     the "old .md" + "no auto-open" problems Tom is reporting.
  console.log('[emailPlan] handler entered')
  showToast('Email clicked — building colourful HTML…', 1800)

  try {
    if (!currentSpec.value) {
      showToast('Nothing to email yet — load or generate a Spec first', 4000)
      return
    }

    _saveNow()
    if (specModel.value) savePlanSnapshot(currentSpec.value)

    const now       = new Date()
    const date      = now.toISOString().slice(0, 10)
    const modelName = specModel.value?.name ?? 'Planning Spec'
    const versTxt   = specModel.value ? `v${specModel.value.version}` : ''
    const subject   = `Spec: ${modelName}${versTxt ? ' ' + versTxt : ''} · ${date}`

    let htmlBody = ''
    try {
      htmlBody = renderColorfulSpecHtml(currentSpec.value, modelName, versTxt || undefined)
      console.log(`[emailPlan] HTML body built — ${htmlBody.length} chars`)
    } catch (rErr) {
      console.error('[emailPlan] renderColorfulSpecHtml threw', rErr)
      showToast(`Email HTML build failed: ${String(rErr).slice(0, 80)}`, 7000)
      return
    }

    let plainBody = ''
    try {
      plainBody = confirmedSteps.value.length > 0
        ? exportWithTasksPlainText(currentSpec.value, confirmedSteps.value, tasksByStep.value)
        : serialisePlainText(currentSpec.value)
    } catch (sErr) {
      console.error('[emailPlan] plain-text serialiser threw', sErr)
      showToast(`Email plain-fallback build failed: ${String(sErr).slice(0, 80)}`, 7000)
      return
    }

    // PRIMARY: put colourful HTML on clipboard as text/html (Apple Mail
    // and most desktop clients render this on paste).
    let clipOk = false
    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html':  new Blob([htmlBody],  { type: 'text/html'  }),
            'text/plain': new Blob([plainBody], { type: 'text/plain' }),
          }),
        ])
        clipOk = true
      } else {
        await navigator.clipboard.writeText(plainBody)
        clipOk = true
      }
    } catch (cErr) {
      console.warn('[emailPlan] clipboard copy failed — mailto will still open', cErr)
    }

    // SEM Email Body Standard (Tom 2026-06-04 — ratified for ALL SEM emails):
    //   Line 1     : the LOUD paste cue (so Tom always sees it at the top)
    //   Line 2     : exported-date stamp
    //   Line 3     : separator
    //   Line 4+    : the FULL plain-text spec inline as the always-present
    //                fallback body — so the email is complete and meaningful
    //                even if Tom does NOT paste.
    //
    // Mailto URL length is browser-capped (~2-8 KB depending on browser/OS).
    // If the encoded URL exceeds 7000 chars we truncate the inline body with
    // a clear marker so the cue + first portion still go through; the colour
    // paste (⌘V) restores the full content.
    const PASTE_HEADER  = clipOk
      ? `PASTE ⌘V (CMD+V) HERE FOR COLOR VERSION`
      : `(Auto-copy failed — use Copy on the Spec page first, then ⌘V here for colour.)`
    const HR            = '────────────────────────────────────────────────────────'
    const stamp         = `Exported: ${date}`
    const fullBody      = `${PASTE_HEADER}\n${stamp}\n${HR}\n\n${plainBody}`

    // Probe encoded length and truncate the INLINE plain text if needed.
    let body = fullBody
    let encoded = encodeURIComponent(body)
    const SAFE_LEN = 7000   // headroom below the 8 KB mailto ceiling Safari enforces
    if (encoded.length > SAFE_LEN) {
      // Reserve space for header + stamp + truncation marker, fill the rest with the plain text.
      const fixed = `${PASTE_HEADER}\n${stamp}\n${HR}\n\n`
      const marker = `\n\n…[plain-text truncated to fit mailto: limit — press ⌘V above for the full colour version]`
      const budget = SAFE_LEN - encodeURIComponent(fixed + marker).length
      // Binary-shrink the inline plain text until the encoded slice fits.
      let lo = 0, hi = plainBody.length, fit = ''
      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2)
        const candidate = plainBody.slice(0, mid)
        if (encodeURIComponent(candidate).length <= budget) {
          fit = candidate
          lo  = mid + 1
        } else {
          hi  = mid - 1
        }
      }
      body    = `${fixed}${fit}${marker}`
      encoded = encodeURIComponent(body)
      console.log(`[emailPlan] inline plain-text truncated ${plainBody.length} → ${fit.length} chars to fit mailto cap`)
    }

    const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encoded}`

    // Fire mailto: — Mail.app (or whatever the default mail client is) opens
    // a compose window automatically.  window.location.href is reliable
    // across Safari, Chrome, Firefox; window.open is sometimes popup-blocked
    // for mailto: in non-gesture contexts.
    window.location.href = mailtoUrl
    console.log('[emailPlan] mailto: fired')

    showToast(
      clipOk
        ? `✉️ Mail opening — click in the body and press ⌘V to paste the colourful Spec, then Send.`
        : `✉️ Mail opening — clipboard copy failed; use Copy first, then paste in the email.`,
      8500,
    )
  } catch (outerErr) {
    console.error('[emailPlan] outer catch — unexpected throw', outerErr)
    showToast(`Email crashed: ${String(outerErr).slice(0, 80)} (see Console)`, 9000)
  }
}

// ── Send entire plan as iMessage / SMS via Messages.app ───────────────────────
// Uses the `sms:` URL scheme which opens Apple Messages on macOS with the body
// pre-filled.  iMessage handles long content; SMS is 160-char per segment but
// Messages.app concatenates — we still cap at ~2 000 chars in the sms: URL to
// stay within browser URL-encoding limits and keep the message readable.
// Keyed icon: [*]→~  (MessageGlyph — informal/instant channel, DD-015 compliant)
function messagePlan(): void {
  if (!currentSpec.value) {
    showToast('Nothing to send — load or generate a Spec first', 4000)
    return
  }

  _saveNow()

  const modelName = specModel.value?.name ?? 'Planning Spec'
  const versTxt   = specModel.value ? ` v${specModel.value.version}` : ''
  const date      = new Date().toISOString().slice(0, 10)

  let body = ''
  try {
    body = serialisePlainText(currentSpec.value)
  } catch {
    body = `${modelName}${versTxt} — Spec export (serialiser unavailable)`
  }

  // Header line — short so it lands visibly in the Messages compose field
  const header  = `Spec: ${modelName}${versTxt} · ${date}\n──────────────────────\n`
  const full    = header + body

  // Cap the sms: URL body at 2 000 URL-encoded chars to stay within OS limits.
  // iMessage delivers the full text in chunks; this cap keeps the URL short.
  const SMS_CAP = 2000
  let encoded   = encodeURIComponent(full)
  let msgBody   = full
  if (encoded.length > SMS_CAP) {
    const truncMarker = '\n…[truncated — see full Spec in the app]'
    const budgetHdr   = encodeURIComponent(header + truncMarker).length
    let lo = 0, hi = body.length, fit = ''
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2)
      const slice = body.slice(0, mid)
      if (encodeURIComponent(header + slice + truncMarker).length <= SMS_CAP - budgetHdr + encodeURIComponent(header + truncMarker).length) {
        fit = slice; lo = mid + 1
      } else {
        hi = mid - 1
      }
    }
    msgBody = header + fit + truncMarker
    encoded = encodeURIComponent(msgBody)
  }

  window.location.href = `sms:?body=${encoded}`
  showToast('Messages opening — paste or edit in the compose field, then Send.', 6000)
}

// ── Copy plain text for AI / chat apps ───────────────────────────────────────
// Companion to ExportSpecPin "Copy for Chat" channel.
// Puts ONLY plain text on the clipboard — no HTML — so pasting into Claude,
// ChatGPT, or any browser chat input gives clean readable text without stray
// HTML tags that some chat UIs surface as literal markup.
async function copyPlanForChat(): Promise<void> {
  if (!currentSpec.value) return
  try {
    const text = serialisePlainText(currentSpec.value)
    await navigator.clipboard.writeText(text)
    showToast('📋 Copied as plain text — paste into Claude, ChatGPT, or any AI chat.', 5000)
  } catch {
    showToast('Copy failed — try the Copy Spec button instead.', 5000)
  }
}

async function handleSignOut() {
  startLoading('auth:signOut', 'Signing out…')
  try {
    stopCursors()
    await signOut()
    _clearSession()
    sessionRestored.value = false
    markdown.value = ''
    currentSpec.value = null
    stage.value = 1
    // SIGN_IN_DISABLED: stay on the app surface; sign-in screen is unreachable.
    view.value = SIGN_IN_DISABLED ? 'app' : 'sign-in'
  } finally {
    stopLoading('auth:signOut')
  }
}

// --- Voice dictation (must be defined after all state refs) ------------------
// Commands map every spoken phrase to an action. Substring matching means
// "Click History", "Push History", and "History" all work.
const { active: dictationActive, supported: dictationSupported, toggle: toggleDictation } =
  useDictation({
    // Navigation
    'History':                    () => { historyOpen.value = true },
    'Spec History':               () => { historyOpen.value = true },
    'Get A Plan':                 () => { specInputOpen.value = true },
    'Import':                     () => { specInputOpen.value = true },
    'Compare':                    () => { comparisonMode.value = true },
    'Spec History':               () => { dashboardOpen.value = true },
    'Present':                    () => { if (currentSpec.value) presentationOpen.value = true },
    'Tour':                       () => { tourOpen.value = true },
    'Replay':                     () => { if (confirmedSteps.value.length) startReplay(confirmedSteps.value) },
    // Stage flow
    'Plan Evo Steps':             () => { goToPlanStage() },
    'Confirm Plan':               () => { document.querySelector<HTMLButtonElement>('button[aria-label="Confirm Plan"]:not([disabled])')?.click() },
    'Estimate Impact':            () => { goToImpactStage() },   // navigate to Impact (stage 3)
    'Spec Tasks':                 () => { goToTasksStage() },    // navigate from Impact → Tasks (stage 4)
    'Export Prioritised Plan':    () => { exportFull() },
    // Back nav
    'Back to spec':               () => { stage.value = 1 },
    'Back to plan':               () => { stage.value = 2 },
    'Back to tasks':              () => { stage.value = 3 },
    'Back to impact':             () => { stage.value = 4 },
    // Session — uses two-tap guard: say phrase twice to confirm, same as button
    'Start fresh':                () => { requestStartOver() },
    'Start over':                 () => { requestStartOver() },
    'Restart afresh':             () => { requestStartOver() },
    // Improve — returns to spec review with everything intact
    'Improve this version':       () => { improveCurrentVersion() },
    'Improve':                    () => { improveCurrentVersion() },
    'Edit plan':                  () => { improveCurrentVersion() },
    'Sign out':                   () => { handleSignOut() },
    // Navigation shorthand — "Go", "Next step", "Continue" all advance the current stage
    'Next step':                  () => { goNext() },
    'Go next':                    () => { goNext() },
    'Continue':                   () => { goNext() },
    'Go':                         () => { goNext() },
    'Next':                       () => { goNext() },
    // Illuminate — illuminates the currently selected text via the glossary.
    // Voice trigger: "Illuminate" or legacy "Define" (kept for muscle-memory compat).
    'Illuminate':                 () => { defineCurrentSelection(currentSpec.value) },
    'Define':                     () => { defineCurrentSelection(currentSpec.value) },
    // Input Safety Net — voice recovery when the Oops toast is visible.
    // These dispatch window events; the useInputSafetyNet composable's
    // event listeners only act when an oopsOffer is actually raised, so
    // saying "Yes" outside a recovery moment is a no-op.
    'Yes':                        () => { window.dispatchEvent(new CustomEvent('safety-net:yes')) },
    'Restore':                    () => { window.dispatchEvent(new CustomEvent('safety-net:yes')) },
    'No':                         () => { window.dispatchEvent(new CustomEvent('safety-net:no')) },
    'I meant to clear':           () => { window.dispatchEvent(new CustomEvent('safety-net:no')) },
    // Glossary
    'Glossary':                   () => { document.querySelector<HTMLButtonElement>('button[aria-label="Open spec glossary"]')?.click() },
    // Demo
    'Demo':                       () => { view.value = 'app'; launchDemo() },
    'Stop demo':                  () => { handleStopDemo() },
    // Analysis mode
    'Just do it':                 () => { analysisMode.value = 'quick' },
    'Ask for precision':          () => { analysisMode.value = 'precise' },
    // Apperture submit — fires when the Apperture is in 'plan' view
    // "Done" / "Submit" → dispatches 'aperture:submit' which Aperture.vue listens for
    'Done':                       () => { if (aperture.view.value === 'plan') window.dispatchEvent(new CustomEvent('aperture:submit')) },
    'Submit':                     () => { if (aperture.view.value === 'plan') window.dispatchEvent(new CustomEvent('aperture:submit')) },
    'Apperture done':             () => { if (aperture.view.value === 'plan') window.dispatchEvent(new CustomEvent('aperture:submit')) },
    // Form submission — triggers Parse and Generate buttons directly
    'Parse my input':             () => { (document.getElementById('sem-parse-btn')    as HTMLButtonElement | null)?.click() },
    'Parse input':                () => { (document.getElementById('sem-parse-btn')    as HTMLButtonElement | null)?.click() },
    'Generate Planguage Spec':    () => { (document.getElementById('sem-generate-btn') as HTMLButtonElement | null ?? document.querySelector<HTMLButtonElement>('button[aria-label="Generate Spec"]:not([disabled])'   ))?.click() },
    'Generate Spec':              () => { (document.getElementById('sem-generate-btn') as HTMLButtonElement | null ?? document.querySelector<HTMLButtonElement>('button[aria-label="Generate Spec"]:not([disabled])'   ))?.click() },
    'Generate':                   () => { (document.getElementById('sem-generate-btn') as HTMLButtonElement | null ?? document.querySelector<HTMLButtonElement>('button[aria-label="Generate Spec"]:not([disabled])'   ))?.click() },
  })

// ── Global Find (⌘F) + Actions Menu (⌘A) ─────────────────────────────────────

const { toggle: _toggleSearch } = useGlobalSearch()

/**
 * True when the event target is a typing surface (input / textarea /
 * contenteditable / select). Used to skip global shortcuts that would
 * conflict with native text-editing behaviour — notably ⌘A = Select All.
 */
function _isTypingTarget(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null
  if (!t) return false
  const tag = t.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (t.isContentEditable) return true
  return false
}

// Global keyboard shortcuts:
//   ⌘F / Ctrl+F  → open Find palette (Tom 2026-05-12 — agreed ⌘F is more
//                  universal muscle memory than ⌘K; deliberately overrides
//                  the browser's native Find-in-page because the SEM Find
//                  palette IS the canonical navigation surface).
//   ⌘K / Ctrl+K  → SILENT ALIAS for ⌘F during the transition period so users
//                  with existing muscle memory aren't broken. Not advertised
//                  in any UI — the Plan Crest, GlobalSearch hint, ⌘K-shortcut
//                  pills all read ⌘F now. Can be removed in a future cleanup.
//   ⌘A / Ctrl+A  → toggle Actions menu. Skipped when the user is in an input
//                  / textarea / contenteditable so native Select-All runs.
function _onGlobalKeydown(e: KeyboardEvent) {
  // ⌘F (primary) and ⌘K (alias) both open the Find palette. We intercept
  // ⌘F everywhere including inside text inputs — the SEM Find palette
  // replaces browser-native Find-in-page across the whole app.
  if ((e.metaKey || e.ctrlKey) && (e.key === 'f' || e.key === 'F' || e.key === 'k' || e.key === 'K')) {
    e.preventDefault()
    _toggleSearch()
    return
  }
  if ((e.metaKey || e.ctrlKey) && (e.key === 'a' || e.key === 'A')) {
    if (_isTypingTarget(e)) return  // let native Select-All run
    e.preventDefault()
    toggleMenu()
  }
  // ── Escape key — two-tier emergency recovery ────────────────────────────
  // Tier 1: close whatever overlay is open.
  //   closeActiveSurface() walks the exclusive-surfaces registry and sets the
  //   first open surface's ref to false — covers ALL registered panels
  //   (history, models, specEditor, planInput, valueFlow, visualise, etc.)
  //   without any per-panel special-casing. 2026-05-19: expanded from
  //   historyOpen-only to universal via closeActiveSurface().
  // Tier 2: nuclear Escape — fires panicReset() when the app is stuck
  //   (loading spinner frozen or a hard error is showing) AND no ordinary
  //   overlay closed in Tier 1. Tom 2026-05-18: "maybe a backup like escape".
  //   Works entirely at window level — no button, no menu, no mouse needed.
  //   Cmd+R remains the ultimate OS-level reset (page reload with session
  //   persistence); Escape covers everything short of that.
  if (e.key === 'Escape') {
    // Tier 1: close whichever registered surface is open
    if (closeActiveSurface()) return  // done — don't also panic-reset
    // Tier 2: app is stuck — fire panicReset without needing the 🆘 menu
    // Condition: loading spinner is hung OR a hard error is on screen.
    // In normal (non-stuck) use Escape does nothing here, so it never
    // interferes with typing or normal interactions.
    if (isLoading.value || sdkError.value) {
      panicReset()
    }
  }
}
// DD-013 (Architecture v3 — capture-phase global listener, 2026-06-02):
// Layer A: document dblclick in CAPTURE phase — fires before any child handler,
// cannot be blocked by stopPropagation on buttons/cells wrapping the icon.
// glyphTypeFromDblClick() walks up the DOM via closest('[data-pl-type]') to
// find whether any PlTypeIcon was double-clicked.
// Layer B: CustomEvent bus — PlTypeIcon's @dblclick also dispatches 'glyph-panel:open'
// (belt-and-suspenders; fires if bubbling reaches the span).
// Both layers call the same local openGlyphPanel(), so double-open is harmless
// (idempotent: type stays the same, panel stays open).
const _onGlyphPanelOpen = (e: Event) => openGlyphPanel((e as CustomEvent<PlGlyphType>).detail)
const _onGlyphPanelClose = () => closeGlyphPanel()
const _onGlyphPanelNavigate = (e: Event) => navigateGlyphPanel((e as CustomEvent<PlGlyphType>).detail)

/** Layer A — capture-phase global handler for PlTypeIcon double-click (DD-013). */
function _onDocumentDblClick(e: MouseEvent): void {
  const type = glyphTypeFromDblClick(e)
  if (type) openGlyphPanel(type)
}

onMounted(() => {
  window.addEventListener('keydown', _onGlobalKeydown)
  // Pre-unload save — fires synchronously before any page reload/kill.
  // Tom 2026-05-18: covers Cmd+R (browser reload) and any other unload event.
  // _saveNow() is a no-op when currentSpec is null, so safe to fire always.
  window.addEventListener('beforeunload', _saveNow)
  // Layer A: capture-phase dblclick — intercepts before any button/cell handler
  document.addEventListener('dblclick', _onDocumentDblClick, true)
  // Layer B: CustomEvent bridge — wired here so state is in App.vue
  document.addEventListener(GLYPH_PANEL_OPEN_EVENT, _onGlyphPanelOpen)
  document.addEventListener(GLYPH_PANEL_CLOSE_EVENT, _onGlyphPanelClose)
  document.addEventListener(GLYPH_PANEL_NAVIGATE_EVENT, _onGlyphPanelNavigate)
})
onUnmounted(() => {
  window.removeEventListener('keydown', _onGlobalKeydown)
  window.removeEventListener('beforeunload', _saveNow)
  document.removeEventListener('dblclick', _onDocumentDblClick, true)
  document.removeEventListener(GLYPH_PANEL_OPEN_EVENT, _onGlyphPanelOpen)
  document.removeEventListener(GLYPH_PANEL_CLOSE_EVENT, _onGlyphPanelClose)
  document.removeEventListener(GLYPH_PANEL_NAVIGATE_EVENT, _onGlyphPanelNavigate)
})

/**
 * Full search index — every feature, button, and panel in the app.
 * Closures over reactive state mean disabled flags stay in sync.
 * Add new entries here whenever a new feature is shipped.
 */
const searchEntries = computed((): SearchEntry[] => {
  const hasSpec  = !!currentSpec.value
  const hasModel = !!specModel.value
  const hasSteps = confirmedSteps.value.length > 0

  return [
    // ── Visualise ─────────────────────────────────────────────────────────
    {
      id: 'present', icon: '🖥️', name: 'Present',
      description: 'Full-screen spec presentation slides',
      keywords: ['slides', 'slide show', 'presentation', 'present', 'fullscreen'],
      context: 'Visualise', action: () => { presentationOpen.value = true },
      disabled: !hasSpec,
    },
    {
      id: 'diagrams', icon: '🗺️', name: 'Diagrams & Visuals',
      description: 'Value flow, radar, architecture, risk, finance charts',
      keywords: ['chart', 'sankey', 'radar', 'svg', 'graph', 'visualize', 'visualise', 'diagrams'],
      context: 'Visualise', action: () => { visualiseOpen.value = true },
      disabled: !hasSpec,
    },
    {
      id: 'swimlane', icon: '🏊', name: 'Swimlane View',
      description: 'Value Stage Map — Functions / Values / Solutions across delivery stages',
      keywords: ['value stage map', 'heat lane', 'swim lane', 'swimlane', 'lanes', 'matrix', 'stages'],
      context: 'Visualise', action: () => { heatLaneOpen.value = true },
      disabled: !hasSpec,
    },
    {
      id: 'evo-simulator', icon: '▶', name: 'Evo Simulator',
      description: 'Animated delivery timeline across 26 weeks',
      keywords: ['simulate', 'simulator', 'animation', 'timeline', 'delivery', 'weeks'],
      context: 'Visualise', action: () => { evoSimulatorOpen.value = true },
      disabled: !hasSteps,
    },
    {
      id: 'replay', icon: '🔁', name: 'Replay',
      description: 'Replay the spec entry and AI generation from the start',
      keywords: ['replay', 'playback', 'demo', 'rerun', 'again'],
      context: 'Visualise', action: () => { if (hasSteps) startReplay(confirmedSteps.value) },
      disabled: !hasSteps,
    },

    // ── Planning ──────────────────────────────────────────────────────────
    {
      id: 'go-plan', icon: '🗺️', name: 'Go to Evo Plan',
      description: 'Navigate to Stage 2 — Evolutionary Step Planner',
      keywords: ['evo plan', 'plan stage', 'stage 2', 'evo steps', 'navigate plan'],
      context: 'Navigation', action: () => { goToStage2() },
      disabled: !hasSpec,
    },
    {
      id: 'go-spec', icon: '📝', name: 'Go to Spec & Sharpening',
      description: 'Navigate back to Stage 1 — spec entry and sharpening',
      keywords: ['spec', 'stage 1', 'entry form', 'back', 'return'],
      context: 'Navigation', action: () => { goToStage1() },
    },
    {
      id: 'history', icon: '🕐', name: 'Spec History',
      description: 'Browse and restore previous spec versions',
      keywords: ['history', 'versions', 'restore', 'undo', 'previous', 'spec history'],
      context: 'Planning', action: () => { historyOpen.value = true },
    },
    {
      id: 'unifiedHistory', icon: '🗂️', name: 'All History',
      description: 'Browse and restore version history for Plans, Models, Contracts, and Maria analyses.',
      keywords: ['history', 'all history', 'versions', 'restore', 'contracts history', 'models history', 'maria history', 'unified history'],
      context: 'Planning', action: () => { unifiedHistoryOpen.value = true },
    },
    {
      id: 'conflicts', icon: '⚠️', name: 'Conflict Analysis',
      description: 'Detect stakeholder conflicts in the spec',
      keywords: ['conflict', 'clash', 'stakeholder', 'analysis', 'compare values'],
      context: 'Planning', action: () => { conflictAnalysisOpen.value = true },
      disabled: !hasSpec,
    },
    {
      id: 'rename', icon: '✏️', name: 'Rename / Set Owner',
      description: 'Rename the plan model and assign an owner',
      keywords: ['rename', 'name', 'owner', 'scribe', 'set owner', 'plan name'],
      context: 'Planning', action: () => { openRenamePopover() },
      disabled: !hasModel,
    },
    {
      id: 'spec-owners', icon: '👥', name: 'Spec Owners & Governance',
      description: 'Assign ownership per spec area; set Wish and Goal levels',
      keywords: ['governance', 'owners', 'ownership', 'stakeholder owners', 'responsibility'],
      context: 'Planning', action: () => { govPanelOpen.value = true },
      disabled: !hasModel,
    },
    {
      id: 'plan-targets', icon: '🎯', name: 'Spec Targets',
      description: 'Define who receives this spec and tailor content per audience',
      keywords: ['spec targets', 'audience', 'tailor', 'stakeholder audience', 'ceo', 'public', 'investor', 'delivery'],
      context: 'Planning', action: () => { specTargetsOpen.value = true },
    },
    {
      id: 'global-priority', icon: '❯', name: 'Global Priority',
      description: 'Rank stakeholders, then values·costs·constraints, then solutions — with sources, reasons, and Prioritisation Constraints',
      keywords: ['global priority', 'rank', 'ranking', 'priority', 'prioritise', 'prioritize', 'stakeholders', 'values', 'costs', 'constraints', 'solutions', 'weights', 'order', 'tradeoff'],
      context: 'Planning', action: () => { globalPriorityOpen.value = true },
      disabled: !hasSpec,
    },
    {
      id: 'plan-health-status', icon: '🩺', name: 'Spec Health Status',
      description: 'Live Spec Health Index (-100..+100) with breakdown bars, history graph (Version + Date axis), pending notifications. Read-only.  (Generic term per Tom 2026-06-04: "Spec Health index = generic, please note.")',
      keywords: ['plan health', 'phi', 'health', 'status', 'index', 'breakdown', 'graph', 'history', 'snapshot', 'snapshots', 'notification', 'notifications', 'alert', 'drop', 'circle', 'badge'],
      context: 'Planning', action: () => { specHealthStatusOpen.value = true },
      disabled: !hasSpec,
    },
    {
      id: 'plan-health-admin', icon: '⚙️', name: 'Spec Health Administration',
      description: 'Spec Health Record Administration Specification — aspect & group weights, custom aspects, vibrate threshold, notification frequency, drop-detect threshold, auto-snapshot policy, per-Owner notification subset, full audit log.',
      keywords: ['plan health admin', 'administration', 'phi', 'governance', 'aspects', 'weights', 'defects', 'risks', 'unknowns', 'rule violations', 'inconsistencies', 'coverage', 'audit', 'notification', 'notify', 'snapshot', 'threshold', 'admin spec'],
      context: 'Planning', action: () => { specHealthAdminOpen.value = true },
      disabled: !hasSpec,
    },
    // Tom 2026-06-03 (decision B for the 2026-05-27 Plan Health tile naming
    // WAIT row): "Target and Administration are vital" — both deserve their
    // own tile, distinct from Status.  Admin already existed; Target ships
    // now as the third sibling.  Answers "where are we aiming + how big is
    // the gap" — read-only target dashboard.
    {
      id: 'plan-health-target', icon: '🎯', name: 'Spec Health Target',
      description: 'Spec Health TARGET dashboard — current SHI vs threshold gap, per-Value target progress (Tolerable / Goal / Wish), aggregate "at Goal / below Tolerable / missing Goal" counts.  Read-only sister of Status (live SHI) and Administration (threshold + weights setter).',
      keywords: ['plan health target', 'target', 'phi target', 'goal', 'tolerable', 'wish', 'threshold', 'gap', 'aim', 'where we want to be', 'planguage target'],
      context: 'Planning', action: () => { specHealthTargetOpen.value = true },
      disabled: !hasSpec,
    },
    // Tom 2026-06-06: MultiVision — VDT-grounded V/R balance sandbox.
    // Sliders for Value ambition + Resource budget; consequences live.
    {
      id: 'multi-vision', icon: '⚡', name: 'MultiVision',
      description: 'Balance Values and Resources interactively. Value ambition sliders (Tolerable → Goal → Wish), Resource budget sliders, live VDT consequences: which solutions are funded, per-Value delivery %, overall vision balance score. Play with the sliders until the balance feels right, then use that as a starting point for solutions, Evo Steps, and tasks.',
      keywords: ['multivision', 'multi vision', 'vdt', 'sliders', 'balance', 'value resource', 'v r', 'budget', 'ambition', 'tolerable goal wish', 'consequences', 'sandbox', 'optima', 'tradeoff', 'trade off', 'planning sliders'],
      context: 'Planning', action: () => { openMultiVision() },
      disabled: !hasSpec,
    },
    // Tom 2026-06-06: MultiForks — paired diagram view of MultiVision.
    {
      id: 'multi-forks', icon: '🔱', name: 'MultiForks',
      description: 'System fork diagram: Resources → System ← Values. Each fork (Value or Resource) has Tolerable / Goal / Wish markers at their real numeric positions, a status colour band (Goal MET / Tolerable Range / VIOLATION), and a status badge. Same Balance score as MultiVision. The diagram-view sibling of the MultiVision slider sandbox.',
      keywords: ['multiforks', 'multi forks', 'multifork', 'fork', 'fork diagram', 'system fork', 'fork view', 'fork chart', 'resources system values', 'system diagram', 'arrows', 'oval', 'visualize', 'visualization', 'diagram'],
      context: 'Visualise', action: () => { openMultiForks() },
      disabled: !hasSpec,
    },
    // Tom 2026-06-03: EHT (Evo Health Tool).  Mirror PHI structure but focused
    // on Evo Steps + short-term scope.  v1 scaffold; v2 wires real Cure flow.
    {
      id: 'evo-health', icon: '🩺', name: 'Evo Health Tool (EHT)',
      description: 'Evo-Step Health — short-term focus (Next Step / Next 5 / All).  Defect detector + Cure proposals with risk ratings (green / orange / red) + per-cure approval audit log.  Mirrors PHI structure for Evo Steps specifically.',
      keywords: ['evo health', 'eht', 'step health', 'defects', 'cure', 'short term', 'evo defects', 'next step health'],
      context: 'Planning', action: () => { evoHealthOpen.value = true },
      disabled: !hasSpec,
    },
    // Tom 2026-06-03 Conjunction-of-Technologies Exploit #1
    {
      id: 'standards-auditor', icon: '📚', name: 'Planguage Standards Auditor',
      description: 'Cross-references the live spec against 10.Standard/Standard.Kai-Zen/ Templates + Rules.  Every finding cites the standard violated (file + section + quote).  Deterministic + Claudian-driven paths.',
      keywords: ['standards', 'auditor', 'planguage standards', 'gilb standards', 'kai-zen', 'compliance', 'violations', 'citations', 'conjunction'],
      context: 'Planning', action: () => { standardsAuditorOpen.value = true },
      disabled: !hasSpec,
    },
    // Tom 2026-06-03 Conjunction-of-Technologies Exploit #5 (the unified panel)
    {
      id: 'planguage-analyzer', icon: '🔬', name: 'Planguage Analyzer (Unified)',
      description: 'ONE panel, ALL knowledge layers.  Aggregates findings from Standards Auditor + Evo Step Improvement + FEED ME! into a filterable view with per-finding source badge (Plan / Gilb / Standards / Internet / LLM / Template).  The flagship Conjunction-of-Technologies surface.',
      keywords: ['analyzer', 'unified', 'conjunction', 'multi-source', 'all findings', 'planguage analyzer', 'aggregate', 'cross-tool'],
      context: 'Planning', action: () => { planguageAnalyzerOpen.value = true },
      disabled: !hasSpec,
    },
    // Tom 2026-06-03 Conjunction Exploit #3 + #4 — Internet Context Fetcher (Stakeholder + Industry Benchmark)
    {
      id: 'internet-context', icon: '🌐', name: 'Internet Context Fetcher',
      description: 'Pull current internet context for stakeholders (GDPR updates, regulatory changes) AND industry benchmarks (Auth0 / Okta / Gartner / vendor SLAs) to propose V./C. updates and Tolerable/Goal/Wish adjustments — every finding cites a real URL.',
      keywords: ['internet', 'stakeholder context', 'industry benchmark', 'url', 'citation', 'gdpr', 'auth0', 'okta', 'gartner', 'sla', 'conjunction', 'web', 'fetch'],
      context: 'Planning', action: () => { internetContextOpen.value = true },
      disabled: !hasSpec,
    },
    {
      id: 'spec-editor', icon: '✏️', name: 'Spec Editor',
      description: 'Edit F./V./S. entries directly — produce Edit Versions or commit to Master',
      keywords: ['editor', 'edit spec', 'edit plan', 'edit entries', 'planguage editor', 'rewrite', 'edit version', 'master'],
      context: 'Planning', action: () => { specEditorOpen.value = true },
      disabled: !hasSpec,
    },
    {
      id: 'tool-info', icon: 'ℹ', name: 'Tool Info',
      description: 'View purposes, insights, synonyms and links about this plan model',
      keywords: ['tool info', 'about', 'purposes', 'insights', 'synonyms', 'related tools', 'more info', 'description', 'tag'],
      context: 'Planning', action: () => { toolInfoPanelOpen.value = true },
      disabled: !hasModel,
    },

    // ── Manage Plan Models ────────────────────────────────────────────────
    {
      id: 'save-plan', icon: '✱', name: 'Save Plan',
      description: 'Export the current plan model as a .json file',
      keywords: ['save', 'export', 'download', 'json', 'backup plan'],
      context: 'Spec Models', action: () => { downloadPlan() },
      disabled: !hasSpec,
    },
    {
      id: 'email-plan', icon: '✉️', name: 'Email Plan',
      description: 'Copy rich HTML to clipboard and open Mail',
      keywords: ['email', 'mail', 'send', 'share', 'clipboard'],
      context: 'Spec Models', action: () => { emailPlan() },
      disabled: !hasSpec,
    },
    {
      id: 'restore-plans', icon: '↑', name: 'Restore Plans',
      description: 'Import a previously saved plan model from a .json file',
      keywords: ['restore', 'import', 'load', 'previous plan', 'json import'],
      context: 'Spec Models', action: () => { openRestorePicker() },
    },
    {
      id: 'previous-plan', icon: '✱', name: 'Start with a Previous Plan',
      description: 'Switch to a different saved plan model',
      keywords: ['previous plan', 'load plan', 'switch plan', 'all models', 'plans'],
      context: 'Spec Models', action: () => { modelsOpen.value = true },
    },
    {
      id: 'backup', icon: '🛡', name: 'Backup SEM App',
      description: 'Download a backup of all saved plan models',
      keywords: ['backup', 'all plans', 'export all', 'archive'],
      context: 'Spec Models', action: () => { backupAllModels() },
      disabled: !hasModel,
    },

    // ── Voice ─────────────────────────────────────────────────────────────
    {
      id: 'dictation', icon: '🎤', name: dictationActive.value ? 'Turn Off Mic' : 'Turn On Mic',
      description: 'Toggle voice dictation into any text field',
      keywords: ['microphone', 'mic', 'voice', 'dictate', 'speech', 'dictation'],
      context: 'Voice', action: () => { toggleDictation() },
      disabled: !dictationSupported.value,
    },
    {
      id: 'speaker', icon: '🔊', name: speaking.value ? 'Stop Reading' : 'Read Aloud',
      description: 'Read the spec aloud using text-to-speech',
      keywords: ['read', 'speak', 'voice', 'tts', 'text to speech', 'aloud', 'speaker'],
      context: 'Voice', action: () => { speaking.value ? stopSpeaking() : handleSpeak(speakerText.value) },
      disabled: !speakerSupported.value,
    },

    // ── Analyse ───────────────────────────────────────────────────────────
    {
      id: 'sharpen', icon: '🔪', name: 'Sharpen Spec',
      description: 'AI refinement across 6 dimensions: constraints, scale, stakeholders…',
      keywords: ['sharpen', 'refine', 'improve spec', 'ai refine', 'dimensions', 'constraints', 'aspects', 'scale'],
      context: 'Analyse', action: () => { sharpenModalOpen.value = true },
      disabled: !hasSpec,
    },
    {
      id: 'compare', icon: '📊', name: 'Compare Spec Models',
      description: 'Side-by-side A/B comparison of two spec models',
      keywords: ['compare', 'comparison', 'a/b', 'side by side', 'diff models'],
      context: 'Analyse', action: () => { comparisonOpen.value = true },
    },
    {
      id: 'collaborate', icon: '🤝', name: 'Collaborate',
      description: 'Invite collaborators and manage real-time editing access',
      keywords: ['collaborate', 'invite', 'team', 'share', 'collaborator', 'rbac'],
      context: 'Analyse', action: () => { collaboratorOpen.value = true },
    },

    // ── Get A Plan ────────────────────────────────────────────────────────
    {
      id: 'get-a-plan', icon: '✱', name: 'Get A Plan',
      description: 'Import a spec from a URL, PDF or HTML file via AI extraction',
      keywords: ['import', 'upload', 'url', 'pdf', 'extract', 'get plan', 'load url'],
      context: 'Nav bar', action: () => { specInputOpen.value = true },
    },

    // ── Backup & Reset ────────────────────────────────────────────────────
    {
      id: 'restart', icon: '🔄', name: 'Restart Afresh',
      description: 'Clear the current spec and start a new planning session',
      keywords: ['restart', 'reset', 'clear', 'start over', 'new session', 'fresh'],
      context: 'Session', action: () => { requestStartOver() },
    },
    {
      id: 'start-fresh', icon: '↺', name: 'Start Fresh',
      description: 'Clear the session and return to the sign-in screen',
      keywords: ['fresh', 'start fresh', 'sign out session', 'clear all'],
      context: 'Session', action: () => { startFresh() },
    },

    // ── Onboarding ────────────────────────────────────────────────────────
    {
      id: 'tour', icon: '?', name: 'Tour',
      description: 'Walk through the onboarding tour of the app',
      keywords: ['tour', 'onboarding', 'help', 'introduction', 'guide', 'walkthrough'],
      context: 'Help', action: () => { tourOpen.value = true },
    },
    {
      id: 'wizard', icon: '🧙', name: 'Guided Wizard',
      description: 'Step-by-step guided spec creation wizard',
      keywords: ['wizard', 'guided', 'guide', 'step by step', 'beginner', 'help'],
      context: 'Help', action: () => { wizardOpen.value = true },
    },
    {
      id: 'coach', icon: '🤝', name: 'Ask Anything',
      description: 'AI collaborator — ask any question about your plan or spec',
      keywords: ['ask anything', 'coach', 'ai help', 'assistant', 'coaching', 'advice', 'hint', 'question', 'collaborator'],
      context: 'Help', action: () => { collaboratorOpen.value = true },
    },

    // ── Owners / Planners / Scribes ────────────────────────────────────────
    {
      id: 'owner-panel', icon: '🔑', name: 'Spec Owners',
      description: 'Add or edit the people accountable for this spec (approval authority + change sign-off)',
      keywords: ['owner', 'owners', 'contact', 'accountability', 'approval', 'authority', 'responsible'],
      context: 'Plan',
      action: () => { specPeopleTab.value = 'owners'; specOwnerPanelOpen.value = true },
      disabled: !hasModel,
    },
    {
      id: 'planner-panel', icon: '💡', name: 'Spec Planners',
      description: 'Add or edit the people who conceived and directed the spec ideas',
      keywords: ['planner', 'planners', 'author', 'strategist', 'ideas', 'director'],
      context: 'Plan',
      action: () => { specPeopleTab.value = 'planners'; specOwnerPanelOpen.value = true },
      disabled: !hasModel,
    },
    {
      id: 'scribe-panel', icon: '⌨️', name: 'Spec Scribes',
      description: 'Add or edit the people who did the actual keying/dictation to enter ideas into the app',
      keywords: ['scribe', 'scribes', 'typist', 'keyboard', 'dictation', 'mob', 'rotate', 'keying'],
      context: 'Plan',
      action: () => { specPeopleTab.value = 'scribes'; specOwnerPanelOpen.value = true },
      disabled: !hasModel,
    },

    // ── About the Save Glyph (DD-001, 2026-05-13) ─────────────────────────
    {
      id: 'save-glyph-history', icon: '✱', name: 'About the Save Glyph',
      description: 'Why the SEM App uses `*→[*]` instead of a floppy disc — full essay with Copy + Email.',
      keywords: ['save', 'get', 'asterisk', 'star', 'glyph', 'icon', 'bliss', 'vessel', 'bracket', '42', 'history', 'about', 'floppy', 'planguage'],
      context: 'Meta',
      action: () => { saveGlyphHistoryOpen.value = true },
    },

    // ── About the Priority Glyph (DD-002, 2026-05-13) ─────────────────────
    {
      id: 'priority-info', icon: '❯?', name: 'About the Priority Glyph',
      description: 'What `[A>B>C]` means: the bounded-system keyed icon for priority. © Tom Gilb 2026.',
      keywords: ['priority glyph', 'about priority', 'priority icon', 'priority symbol', 'bracket', 'bounded system', 'invention', 'copyright', 'planguage', 'tom gilb', '[A>B>C]', 'a>b>c', 'comparator', 'chevron', 'transitivity', 'iet', 'vdt'],
      context: 'Meta',
      action: () => { priorityInfoOpen.value = true },
    },

    // ── About the Edit Glyph ([*]→[**]) ───────────────────────────────────
    {
      id: 'edit-info', icon: '[**]', name: 'About the Edit Glyph',
      description: 'What [*]→[**] means: the vessel stays full, its contents are augmented. Bliss-Gilb keyed-icon family.',
      keywords: ['edit glyph', 'vessel', 'augment', 'transform', 'bliss', 'asterisk', 'keyed icon', 'bracket', 'planguage', 'notation', 'pencil', 'anachronism', '[*]→[**]', 'edit icon', 'edit symbol'],
      context: 'Meta',
      action: () => { editInfoOpen.value = true },
    },

    // ── Symbol Family (Tom 2026-05-15: "people like that") ────────────────
    {
      id: 'symbol-family', icon: '✱', name: 'Symbol Family — all five glyphs',
      description: 'The full Gilb symbol family: Save *→[*], Get [*]→*, Priority [A>B>C], Cancel [*]→[ ], Edit [*]→[**] — history, semantics, grammar.',
      keywords: ['symbol', 'glyph', 'family', 'keyed icon', 'save', 'get', 'cancel', 'edit', 'priority', 'history', 'bliss', 'gilb', 'vessel', 'asterisk', 'bracket', 'planguage', 'augment'],
      context: 'Meta',
      action: () => { symbolFamilyOpen.value = true },
    },

    // ── Search itself ─────────────────────────────────────────────────────
    {
      id: 'search', icon: '🔍', name: 'Find (⌘F)',
      description: 'You found it! Press ⌘F to open this palette any time.',
      keywords: ['search', 'find', 'command', 'palette', 'shortcut', 'lookup'],
      context: 'Meta', action: () => { /* already open */ },
    },
  ]
})

// ── Universal Single-Surface Rule (per vault CLAUDE.md) ────────────────────
// Register every major full-screen surface (modal, drawer, full-window panel,
// dialog) so opening one auto-closes the others. The previous window goes
// away gracefully and the new action replaces it. Internal toggles (menus,
// popovers, inline disclosures, the SEMEntryForm-side panels) are NOT
// registered — they are not full-window surfaces.
//
// To exempt a surface from auto-close (e.g. genuine side-by-side comparison),
// pass `{ exclusive: false }` and document the reason inline.
registerExclusiveSurface('presentation',      presentationOpen)
registerExclusiveSurface('resourcesSharpen',  resourcesSharpenOpen)
registerExclusiveSurface('optima',            optimaOpen)
registerExclusiveSurface('kiss',              kissOpen)
registerExclusiveSurface('costEngineering',   costEngineeringOpen)
registerExclusiveSurface('sharpenModal',      sharpenModalOpen)
registerExclusiveSurface('bullock',           bullockOpen)
registerExclusiveSurface('visualise',         visualiseOpen)
registerExclusiveSurface('heatLane',          heatLaneOpen)
registerExclusiveSurface('evoSimulator',      evoSimulatorOpen)
registerExclusiveSurface('evoTools',          evoToolsOpen)
registerExclusiveSurface('evoSharp',          evoSharpOpen)
registerExclusiveSurface('evoStepImprovement', evoStepImprovementOpen)
registerExclusiveSurface('feedMe',            feedMeOpen)
registerExclusiveSurface('settings',          settingsOpen)
registerExclusiveSurface('conflictAnalysis',  conflictAnalysisOpen)
registerExclusiveSurface('collaborator',      collaboratorOpen)
registerExclusiveSurface('comparison',        comparisonOpen)
registerExclusiveSurface('models',            modelsOpen)
registerExclusiveSurface('planInput',         specInputOpen)
registerExclusiveSurface('tour',              tourOpen)
registerExclusiveSurface('dashboard',         dashboardOpen)
registerExclusiveSurface('wizard',            wizardOpen)
registerExclusiveSurface('planOwnerPanel',    specOwnerPanelOpen)
registerExclusiveSurface('govPanel',          govPanelOpen)
registerExclusiveSurface('planDNA',           specStoryOpen)
registerExclusiveSurface('planTargets',       specTargetsOpen)
registerExclusiveSurface('specEditor',        specEditorOpen)
registerExclusiveSurface('contracts',         contractsOpen)
registerExclusiveSurface('sdr',              sdrOpen)
registerExclusiveSurface('toolInfoPanel',     toolInfoPanelOpen)
registerExclusiveSurface('copyrightPanel',    copyrightPanelOpen)
registerExclusiveSurface('saveGlyphHistory',  saveGlyphHistoryOpen)
registerExclusiveSurface('priorityPanel',     priorityPanelOpen)
registerExclusiveSurface('globalPriority',    globalPriorityOpen)
registerExclusiveSurface('priorityInfo',      priorityInfoOpen)
registerExclusiveSurface('editInfo',          editInfoOpen)
registerExclusiveSurface('symbolFamily',      symbolFamilyOpen)
registerExclusiveSurface('valueFlow',         valueFlowOpen)
registerExclusiveSurface('modelDashboard',    modelDashboardOpen)
registerExclusiveSurface('modelHistory',      modelHistoryOpen)
// GlyphDataPanel is intentionally NOT registered as exclusive surface.
// It is a reference overlay (info card), not a workflow surface — it must
// float on top of ContractHub, MariaAgentBoard, and any other full-screen
// panel without closing them. Registering it caused double-click to
// silently close the parent surface (2026-06-02).
// registerExclusiveSurface('glyphDataPanel', glyphPanelOpen)
registerExclusiveSurface('planHealthStatus',  specHealthStatusOpen)
registerExclusiveSurface('planHealthTarget',  specHealthTargetOpen)
registerExclusiveSurface('evoHealth',         evoHealthOpen)
registerExclusiveSurface('standardsAuditor', standardsAuditorOpen)
registerExclusiveSurface('planguageAnalyzer', planguageAnalyzerOpen)
registerExclusiveSurface('internetContext', internetContextOpen)
registerExclusiveSurface('planHealthAdmin',   specHealthAdminOpen)
registerExclusiveSurface('history',           historyOpen)
// Fresh Start menu — popover. Registered so opening it auto-closes other
// surfaces and vice versa (consistent with the Single-Surface universal rule).
registerExclusiveSurface('freshStart',         freshStartOpen)
registerExclusiveSurface('semMetadataPanel',  semMetadataPanelOpen)
// actionsHub uses menuOpen so it participates in the exclusive surface system
registerExclusiveSurface('actionsHub',        menuOpen)
// Agent Menu + Maria Agent (2026-05-29) — both are full-screen surfaces
registerExclusiveSurface('agentMenu',         agentMenuOpen)
registerExclusiveSurface('mariaAgent',        mariaOpen)
registerExclusiveSurface('mariaBoardHub',     mariaBoardOpen)
registerExclusiveSurface('modelLibrary',      modelLibraryOpen)
registerExclusiveSurface('stakeholderMapper', stakeholderMapperOpen)
registerExclusiveSurface('evoCritiquer',      evoCritiquerOpen)
registerExclusiveSurface('planImporter',      specImporterOpen)
registerExclusiveSurface('decisionMapper',    decisionMapperOpen)
registerExclusiveSurface('multiVision',      multiVisionOpen)
registerExclusiveSurface('multiForks',       multiForksOpen)    // r97
registerExclusiveSurface('unifiedHistory',    unifiedHistoryOpen)

// ── ActionsHub: route action IDs to panel opens / functions (2026-05-27) ─────
// Replaces the old inline text dropdown. Each tile in ActionsHubPanel emits
// an action ID string; this function opens the corresponding panel or calls
// the relevant function. menuOpen is set to false by the hub emitting 'close'
// BEFORE this handler fires for most actions (startOver is the exception).
function handleAction(id: string): void {
  switch (id) {
    // ── QUALITY ────────────────────────────────────────────────────────────
    case 'planHealthStatus': specHealthStatusOpen.value = true; break
    case 'planHealthAdmin':  specHealthAdminOpen.value  = true; break
    case 'planHealthTarget': specHealthTargetOpen.value = true; break  // Tom 2026-06-03 decision B
    case 'evoHealth':        evoHealthOpen.value        = true; break  // Tom 2026-06-03 EHT
    case 'standardsAuditor': standardsAuditorOpen.value = true; break  // Tom 2026-06-03 Conjunction Exploit #1
    case 'planguageAnalyzer': planguageAnalyzerOpen.value = true; break // Tom 2026-06-03 Conjunction Exploit #5
    case 'internetContext': internetContextOpen.value = true; break // Tom 2026-06-03 Conjunction Exploit #3 + #4
    case 'conflicts':        conflictAnalysisOpen.value = true; break
    // ── PLANNING ───────────────────────────────────────────────────────────
    case 'planTargets':      specTargetsOpen.value      = true; break
    case 'globalPriority':   globalPriorityOpen.value   = true; break
    case 'planOwners':       specPeopleTab.value = 'owners';   specOwnerPanelOpen.value = true; break
    case 'planners':         specPeopleTab.value = 'planners'; specOwnerPanelOpen.value = true; break
    case 'scribes':          specPeopleTab.value = 'scribes';  specOwnerPanelOpen.value = true; break
    case 'specOwners':       govPanelOpen.value         = true; break
    // ── EXPLORE ────────────────────────────────────────────────────────────
    case 'evoSim':           evoSimulatorOpen.value     = true; break
    case 'replay':           startReplay(confirmedSteps.value); break
    case 'visualise':        visualiseOpen.value        = true; break
    case 'heatLane':         heatLaneOpen.value         = true; break
    case 'present':          presentationOpen.value     = true; break
    case 'modelHistory':     modelHistoryOpen.value     = true; break
    // ── MANAGE ─────────────────────────────────────────────────────────────
    case 'sharpen':          handleSharpenPlan();               break
    case 'improve':          improveCurrentVersion();            break
    case 'resumeLast':       resumeLastModel();                  break
    case 'previousPlan':     modelsOpen.value = true; renamePopoverOpen.value = false; break
    case 'saveCheckpoint':   savePlanNow();                      break
    case 'planHistory':      historyOpen.value          = true; break
    case 'unifiedHistory':   unifiedHistoryOpen.value   = true; break
    case 'specHistory':      dashboardOpen.value        = true; break
    case 'renamePlan':       openRenamePopover();                break
    case 'startOver':        requestStartOver();                  break
    case 'freshStart':       freshStartOpen.value       = true; break
    case 'savePlan':         downloadPlan();                     break
    case 'emailPlan':        emailPlan();                        break
    case 'restorePlans':     openRestorePicker();                break
    case 'backup':           backupAllModels();                  break
    case 'codeSnapshot':     showCodeSnapshotTip();              break
    // ── ABOUT ──────────────────────────────────────────────────────────────
    case 'toolInfo':         toolInfoPanelOpen.value    = true; break
    case 'semMetadata':      semMetadataPanelOpen.value = true; break
    case 'copyright':        copyrightPanelOpen.value   = true; break
    case 'saveGlyph':        saveGlyphHistoryOpen.value = true; break
    case 'priorityGlyph':    priorityInfoOpen.value     = true; break
    case 'editGlyph':        editInfoOpen.value         = true; break
    // ── VISUALIZE (extra) ──────────────────────────────────────────────────
    case 'systemModel':      modelDashboardOpen.value   = true; break
    // ── EDIT (extra) ───────────────────────────────────────────────────────
    case 'specEditor':       specEditorOpen.value       = true; break
    // ── VOICE ──────────────────────────────────────────────────────────────
    case 'dictation':        toggleDictation();                 break
    // ── AGENTS ─────────────────────────────────────────────────────────────
    case 'maria':              mariaOpen.value            = true; break
    case 'contracts':          contractsOpen.value        = true; break
    case 'models':             modelLibraryOpen.value     = true; break
    case 'stakeholder-mapper': stakeholderMapperOpen.value = true; break
    case 'plan-importer':      specImporterOpen.value     = true; break
    case 'decisions':          decisionMapperOpen.value   = true; break
    case 'multiVision':        openMultiVision();                  break
    // evo-step-critique lives in ANALYZE section; same routing pattern
    case 'evo-step-critique':  evoCritiquerOpen.value     = true; break
  }
}

// ── Fresh Start menu handlers (2026-05-14) ───────────────────────────────────
// The menu emits four discrete actions; App.vue wraps each with a
// safety-backup snapshot (where appropriate) and routes to existing
// app-level functions (startFresh, addVersion, onHistoryRestore, panicReset)
// so no new state plumbing is introduced.

/**
 * Snapshot the current spec into Spec History as a backup copy, tagged so the
 * user can identify and restore it later. Returns silently if no live spec
 * exists (nothing to back up).
 */
function _backupCurrentSpec(reason: string): void {
  if (!currentSpec.value) return
  const ts = formatBackupTimestamp(Date.now())
  addVersion(
    currentSpec.value,
    `${reason} backup at ${ts}`,
    _evoPlan.value ?? null,
    specModel.value?.name ?? '',
    _specOwnerNames(),
  )
}

/** Option 1 — Blank Canvas. Snapshot current as backup, then startFresh(). */
function _onFreshCanvas(): void {
  _backupCurrentSpec('Pre-Blank-Canvas')
  freshStartOpen.value = false
  startFresh()   // startFresh() calls aperture.backToPlan() when enabled
}

/** Option 2 — Save This and Stop. Snapshot current, close menu, idle.
 *  Per Tom's ratification of option A: "least surprising; the user said
 *  'stop,' not 'leave.'" — no clearing, no navigation. */
function _onSaveAndStop(): void {
  _backupCurrentSpec('Save This and Stop')
  freshStartOpen.value = false
}

/**
 * Option 3 — Cancel Recent Changes. Snapshot current as safety backup, then
 * restore the target snapshot (found by FreshStartMenu via
 * findNearestSnapshotAtOrBefore).
 */
function _onRollback(targetTs: number): void {
  const target = specHistory.value.find((v) => v.timestamp === targetTs)
  if (!target) {
    console.warn('[FreshStart] rollback target snapshot not found at ts=', targetTs)
    freshStartOpen.value = false
    return
  }
  _backupCurrentSpec('Pre-rollback')
  freshStartOpen.value = false
  onHistoryRestore(
    JSON.parse(JSON.stringify(target.spec)),
    target.plan ? JSON.parse(JSON.stringify(target.plan)) : null,
    target.planName ?? '',
    target.planOwners ?? [],
  )
}

/** Option 4 — Just close stuck UI. The pre-existing panicReset behaviour.
 *  No data touched. */
function _onCloseStuckUi(): void {
  freshStartOpen.value = false
  panicReset()
}

// ── Ultra Light Phase 3 — Aperture wiring ────────────────────────────────────
// Gated by ?aperture=1. Exposes `aperture.enabled` (overlay on/off) and
// `aperture.view` (which menu mode is active). When view === 'plan' AND
// the aperture is enabled, <Aperture/> covers the underlying app. Any
// other view drops the overlay so the existing surfaces show through.
// <MenuPin/> stays visible whenever the aperture mode is enabled.
const aperture = useApertureMode()

/**
 * Aperture submit — the user typed (or spoke) a single sentence into the
 * naked aperture and hit Enter. Route the text as an Ends payload (it's a
 * "what is important to improve" prompt) and slide off the aperture so the
 * spec stream is visible. The user can return to the naked Plan any time by
 * picking "Plan" from the Menu pin.
 */
/**
 * Apperture 'parse' emit — the user committed text in the oval.
 * Tom 2026-05-15: "we then Parse" — route through SEMEntryForm.loadAndParse()
 * so the user lands on the chip-review stage rather than direct generation.
 *
 * The previous version fell back to direct generation because when the user
 * has an existing plan (Stage 2+), SEMEntryForm is not in the DOM, so
 * semEntryFormRef.value is null after one nextTick. Fix: explicitly reset
 * stage to 1 FIRST so SEMEntryForm mounts, then use _pendingApertureText +
 * the semEntryFormRef watcher (above) to call loadAndParse the instant it does.
 */
async function handleApertureSubmit(text: string): Promise<void> {
  if (!text || !text.trim()) return
  const cleanText = text.trim()

  // (1) Close any open overlays and reset in-flight guard.
  _closeAllOverlays()
  _doTranslateInFlight = false

  // Clear any stale SDK error banner so the Parse review page is not confused.
  sdkError.value = ''

  // (2) Clear spec state so SEMEntryForm's sub-stage renders (not ClarifyView).
  currentSpec.value  = null
  markdown.value     = ''
  evoPlanConfirmed.value = false
  confirmedSteps.value   = []
  stage.value      = 1
  stage1Sub.value  = 'form'

  // (3) Store the text — the _pendingApertureText watcher fires when the form mounts.
  _pendingApertureText.value = cleanText

  // (4) Switch the aperture to 'full' (unmounts the oval overlay).
  aperture.setView('full')

  // (5) Attempt an immediate call on the next tick — succeeds when the form was
  //     already on Stage 1 (ref already set). Otherwise the watcher handles it.
  await nextTick()
  if (semEntryFormRef.value && _pendingApertureText.value !== null) {
    const t = _pendingApertureText.value
    _pendingApertureText.value = null
    semEntryFormRef.value.loadAndParse(t)
  }
  // If _pendingApertureText is still set here, the watcher will fire once
  // SEMEntryForm mounts (next render cycle).
}

/**
 * ApertureStart submit — the user completed all 3 guided steps (Stakes →
 * Ends → Means). Route to handleSubmit with the full triple filled in, then
 * switch to 'full' so the spec stream is visible.
 */
async function handleApertureStartSubmit(payload: { stakes: string; ends: string; means: string }): Promise<void> {
  aperture.setView('full')
  await nextTick()
  await handleSubmit({ stakes: payload.stakes, ends: payload.ends, means: payload.means })
}

/**
 * ApertureNovice "Try this" — the user picked a hardcoded example. Treat
 * it as an Ends-only prompt (same path as the naked aperture's single text).
 */
async function handleApertureExampleSubmit(text: string): Promise<void> {
  if (!text || !text.trim()) return
  // Same pattern as handleApertureSubmit — route through Parse, not direct generation.
  await handleApertureSubmit(text)
}

/**
 * AperturePrevious load — the user picked a saved plan model to resume.
 * Delegates to handleRestoreModel (which applies the model and advances to
 * the plan view) and returns to the 'plan' aperture.
 */
function handleApertureLoadPlan(model: PlanModel): void {
  handleRestoreModel(model)
  // handleRestoreModel already sets stage + closes panels — aperture view
  // becomes 'full' implicitly since the app surface is now visible.
  aperture.setView('full')
}
</script>

<template>
  <!-- Ultra Light Phase 3 — Aperture overlay + single Menu pin.
       Gated by ?aperture=1. When view === 'plan', the white aperture covers
       the underlying app entirely. 'start' / 'novice' / 'basic' / 'previous'
       each render their own dedicated surface (Phase 3 Evo Step). 'full'
       drops the cover so the existing app surface shows through. The Menu
       pin stays visible in all modes so the user can always navigate. -->
  <template v-if="false"><!-- Aperture disabled: experimental feature, not part of main app -->
    <!-- 'plan' — naked aperture (the default home) -->
    <Aperture
      v-if="aperture.view.value === 'plan'"
      :is-generating="sdkLoading"
      @parse="handleApertureSubmit"
    />

    <!-- 'start' — 3-step guided SEM triple wizard -->
    <ApertureStart
      v-else-if="aperture.view.value === 'start'"
      @submit="handleApertureStartSubmit"
      @go-plan="aperture.backToPlan()"
    />

    <!-- 'novice' — hardcoded example plans gallery -->
    <ApertureNovice
      v-else-if="aperture.view.value === 'novice'"
      @try-example="handleApertureExampleSubmit"
      @go-start="aperture.setView('start')"
      @go-plan="aperture.backToPlan()"
    />

    <!-- 'basic' — same well as Plan but with Previous/Save/Full pills -->
    <ApertureBasic
      v-else-if="aperture.view.value === 'basic'"
      @submit="handleApertureSubmit"
      @go-previous="aperture.setView('previous')"
      @save="savePlanNow"
      @go-full="aperture.setView('full')"
      @go-plan="aperture.backToPlan()"
    />

    <!-- 'previous' — inline list of saved plan models -->
    <AperturePrevious
      v-else-if="aperture.view.value === 'previous'"
      @load="handleApertureLoadPlan"
      @go-plan="aperture.backToPlan()"
    />

    <!-- 'full' — existing app shows through (no overlay component mounted) -->

    <!-- Persistent Illuminate entry point for all Ultra aperture views.
         The floating pill only appears on text selection (comes and goes).
         This button is always visible — matches MenuPin styling, sits to
         its left in the top-right cluster.  Tom 2026-05-18: "Illuminate
         comes and goes in Ultra — can we make it stable?" -->
    <button
      type="button"
      title="Illuminate any Planguage term  (⌥I)"
      aria-label="Illuminate a term (Opt+I)"
      class="fixed top-4 right-20 z-[400] p-2 rounded-full text-base leading-none
             text-slate-500 hover:text-slate-900
             bg-white/0 hover:bg-slate-100
             ring-1 ring-transparent hover:ring-slate-200
             transition focus:outline-none focus:ring-2 focus:ring-violet-400"
      @click="openDefineSearch()"
    >
      💡
    </button>

    <MenuPin />
  </template>

  <!-- Global async indicator — always present, visible when any operation is in-flight -->
  <ThinkingIndicator />

  <!-- Feature #12: Celebration confetti overlay -->
  <CelebrationEffect
    :visible="celebrationVisible"
    @done="celebrationVisible = false"
  />

  <!-- ⌘F Global Find palette — always mounted, teleports to body -->
  <GlobalSearch :entries="searchEntries" />

  <!-- Feature #8: Demo progress bar — shown while demo is running -->
  <div
    v-if="isDemoRunning"
    class="fixed top-0 left-0 right-0 z-50 flex items-center gap-3 px-4 py-2 bg-indigo-700 text-white text-xs font-medium"
    role="status"
    aria-live="polite"
  >
    <span class="shrink-0">Demo running</span>
    <div class="flex-1 h-1.5 rounded-full bg-indigo-400 overflow-hidden">
      <div
        class="h-full bg-white rounded-full transition-all duration-200"
        :style="{ width: `${demoProgressPercent}%` }"
      />
    </div>
    <button
      type="button"
      class="shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center text-white hover:text-indigo-200 focus:outline-none focus:ring-2 focus:ring-white rounded"
      aria-label="Stop demo"
      @click="handleStopDemo"
    >
      ✕ Stop demo
    </button>
  </div>

  <!-- ── Plan Crest ────────────────────────────────────────────────────────────
       Persistent top-of-page banner declaring the active plan's identity,
       state, responsibilities, and quick-actions. The "crest" name (heraldic
       top-of-page identity marker) was adopted 2026-05-12 to replace the
       generic "Plan Identity Bar" — short, distinct, and matches what the
       surface actually does: it announces whose plan this is and how it is
       evolving. Two rows: main crest row (always) + Plan Story strip (toggle).
       Renamed "🧬 Planner Consequences" → "🧬 Plan Story" because the strip
       literally tells the story of how the plan grew (provenance, human-touch,
       sharpen rounds, manual edits, days active).
       z-[300] sits above normal content and below the demo bar (z-50+).  -->
  <div
    ref="specCrestEl"
    v-if="view === 'app' && specModel"
    class="fixed top-[148px] left-0 right-0 z-[300] flex flex-col px-4 py-1.5
           bg-gradient-to-r from-indigo-800 via-indigo-600 to-violet-600
           text-white shadow-lg ring-1 ring-black/10 select-none"
    aria-label="Spec Crest — active spec"
  >
    <!-- ── Row 1: HERO TITLE ───────────────────────────────────────────────
         Tom 2026-05-12 (third pass): "the title is still not what I asked
         for, large long color, drama attention, own line if necessary".
         Resolved by promoting the plan name to its OWN dedicated row at
         text-2xl font-extrabold with a slow gold-shimmer gradient
         (amber-300 → yellow-100 → white → amber-300, animated via
         `plan-title-shimmer` keyframes), heavy drop-shadow, and the full
         width of the bar to itself. No meta, no controls, no neighbours
         on this row — only the title. The crown of the app. -->
    <!-- Tom 2026-05-12 (fourth pass): "title can be centered". Row 1 is now a
         single `justify-center` flex with crest stripe + eyebrow + title (or
         input) bundled into one inline group, so the whole assembly reads
         dead-centre in the bar regardless of viewport width. `max-w-[80%]`
         on the title group leaves breathing room either side; `truncate` on
         the title span gracefully clips ultra-long plan names. -->
    <!-- Tom 2026-06-06 — r45 follow-up: "Color Artsy Icons overlp button on word 'PLAN'".
         Root cause: the left + right tool clusters are absolute-positioned over the row.
         The centred title group (amber-stripe + PLAN eyebrow + title button + chips with
         color glyphs) was `justify-center`-ing in the FULL row width, so on viewports
         where the centred content was wider than the gap between the two absolute
         clusters, the LEFTMOST item of the centred group — the PLAN eyebrow — slid
         UNDER the left cluster.  At that point the History glyph (PlTypeIcon for Evo
         Step — a coloured drawn glyph) visually painted over the PLAN button text.
         Fix: reserve horizontal padding on the inner row at md+ widths matching the
         absolute clusters' widths (left ~440px, right ~310px) so centred content has
         guaranteed clear space.  Below md the PLAN eyebrow is hidden anyway. -->
    <div class="flex items-center justify-center h-12 relative md:pl-[440px] md:pr-[310px]">
      <!-- ── Left tool cluster: Edit Plan · Find · Illuminate · History · Next Step · Dictate · Speaker
           Moved from Row 2 (removed 2026-06-01 — dark bar). Sit left-absolute on the title
           row, mirroring the right cluster, so the plan title remains cleanly centred. -->
      <div class="absolute top-1.5 left-1 flex items-center gap-1 pl-0.5">
        <!-- Tom 2026-06-05 r92 — REMOVED "Edit Plan" button.  Tom verbatim:
             *"I guess the edit plan button on upper br is now superflous, if
             u agree, drop it"*.  Confirmed: every Spec-editor entry path is
             now covered by clicking any of Stages 1-5 in the planning bar
             (STAGE_ACTION_MAP[1..5] = 'to-spec' since r83) AND by the various
             stage-action pins on Row 2.  Button was redundant.  No-Silent-
             Removal SUPREME rule honoured by this audit-trail comment +
             SEM-Design-History log r92.  Permanent-surface drop approved by
             Tom in chat. -->
        <!-- (Edit Plan dropped) -->
        <!-- Find ⌘F -->
        <button
          type="button"
          class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold
                 text-white bg-white/10 hover:bg-white/20
                 focus:outline-none focus:ring-2 focus:ring-white/70 transition-colors"
          aria-label="Find features (Cmd+F)"
          title="Find features (⌘F)"
          @click="_toggleSearch()"
        >
          <svg class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clip-rule="evenodd" />
          </svg>
          <kbd class="inline-flex items-center px-1 rounded bg-white/20 text-white/80 font-mono text-[9px] leading-none py-0.5 ring-1 ring-white/20">⌘F</kbd>
        </button>
        <!-- Illuminate ⌥I -->
        <button
          type="button"
          class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold
                 text-white bg-white/10 hover:bg-white/20
                 focus:outline-none focus:ring-2 focus:ring-white/70 transition-colors"
          aria-label="Illuminate a Planguage term (Opt+I)"
          title="Illuminate any term — select text first, or click to type one  (⌥I)"
          @click="openDefineSearch()"
        >
          <span class="text-sm leading-none" aria-hidden="true">💡</span>
          <kbd class="inline-flex items-center px-1 rounded bg-white/20 text-white/80 font-mono text-[9px] leading-none py-0.5 ring-1 ring-white/20">⌥I</kbd>
        </button>
        <!-- History — Evo Step Color Glyph (amber < ->+-> encodes past cycles).
             :no-detail-click per DD-013 (parent owns click for history panel).
             DD-011 fix 2026-06-01: 🕐 emoji removed, Color Glyph applied.
             TOOLTIP FIX (Tom 2026-06-03 — reported twice): PlTypeIcon defaults
             its title to the CANONICAL Evo-Step label ("Evo Step — one
             incremental delivery cycle. Delivers measurable stakeholder
             value...") which appears when the user hovers the inner SVG even
             though the parent button's title is the correct one.  Explicit
             `title="Version History"` override on the inner icon now suppresses
             the misleading canonical label. -->
        <div class="relative">
          <button
            type="button"
            class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold
                   text-white bg-white/10 hover:bg-white/20
                   focus:outline-none focus:ring-2 focus:ring-white/70 transition-colors"
            aria-label="Version History"
            title="History — browse all saved plan versions, model versions, contracts and Maria analyses. Load any previous version back into your workspace."
            @click="historyOpen = true"
          >
            <!-- Tom 2026-06-03: HistoryGlyph [*]→[*] replaces the misleading
                 Evo-Step glyph.  History IS the file-to-file restoration
                 pattern (saved snapshot → working copy) — both sides bracketed. -->
            <HistoryGlyph size="compact" aria-label="Version History" class="shrink-0" style="height: 16px; width: auto;" />
          </button>
          <span
            v-if="specHistory.length > 0"
            class="absolute -top-1 -right-1 h-4 min-w-[1rem] rounded-full bg-rose-500 text-white
                   text-[10px] font-bold flex items-center justify-center px-0.5 pointer-events-none ring-2 ring-indigo-700"
            aria-hidden="true"
          >{{ specHistory.length }}</span>
        </div>
        <!-- Next Step — conditional, shows primary workflow-advance action -->
        <button
          v-if="nextActionLabel"
          type="button"
          :title="`Advance to the next workflow step: ${nextActionLabel}`"
          :aria-label="`Next Step: ${nextActionLabel}`"
          class="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold
                 bg-indigo-500 text-white hover:bg-indigo-400 shadow-sm shrink-0
                 focus:outline-none focus:ring-2 focus:ring-white/70 transition-colors"
          @click="goNext"
        >{{ nextActionLabel }} <span aria-hidden="true">→</span></button>
        <span class="h-5 w-px bg-white/20 mx-0.5 shrink-0" aria-hidden="true" />
        <!-- 🎤 Dictate -->
        <span class="inline-flex" data-crest-tip="🎤 Dictate — speak to fill the form (⌘M)">
          <DictateButton
            :active="dictationActive"
            :supported="dictationSupported"
            :compact="true"
            @toggle="toggleDictation()"
          />
        </span>
        <!-- 🔊 Speaker -->
        <span class="inline-flex" data-crest-tip="🔊 Read Aloud — hear the current plan content">
          <SpeakerButton
            :text="speakerText"
            :compact="true"
            @speak="handleSpeak"
          />
        </span>
      </div>
      <!-- VIEW MODE — big gold-shimmer title centered in the row, click to
           edit in place. The crest stripe + "Plan" eyebrow ride along on the
           left of the title so the whole identity unit stays together when
           centered. -->
      <!-- Tom 2026-06-03: "button overlap, why do I have to report button overlap,
           can't you check that?"  Root cause: max-w-[90%] let very long plan titles
           (e.g., "MONITOR CONTRACT-Improve Vessel's Speed Under & Vessel's Speed")
           consume 90% of the row width, pushing into the 🔑 owner chip + Next-Step
           button + right pin cluster.  Tightened to max-w-[40%] with flex-1 min-w-0
           so the title gets LEFTOVER space and truncates properly via the inner
           span's truncate class.  Title font also dropped from text-2xl/[28px] to
           text-base/lg responsive — the gold shimmer + amber stripe still gives the
           title visual primacy without monopolising the row. -->
      <!-- SHI badge (Spec Health Index) MOVED 2026-06-04 to Row 2 far-left
           anchor position (Tom: *"shi awol"* after seeing it drifted into
           the action cluster of Row 1).  Mirrors the 21 May 18:42 reference
           layout where the +6% PHI was the FIRST visible item on the row.
           Row 1 now has no PHI; Row 2 begins with it. -->

      <button
        v-if="!titleEditing"
        type="button"
        class="group inline-flex items-center gap-3 min-w-0 max-w-[40%] flex-1 pl-2 pr-3 py-1 -my-1 rounded-lg
               hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-amber-300/80 transition-colors"
        :title="`${specModel.name} — click to rename`"
        :aria-label="`Plan: ${specModel.name}. Click to rename in place.`"
        @click="startTitleEdit"
      >
        <!-- Amber crest stripe — gives the title an unmistakable left anchor -->
        <span
          class="shrink-0 h-9 w-1.5 rounded-full bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600 shadow-[0_0_8px_rgba(251,191,36,0.55)]"
          aria-hidden="true"
        ></span>
        <!-- Tiny "PLAN" eyebrow -->
        <span
          class="hidden md:inline text-[10px] uppercase tracking-[0.35em] font-bold text-amber-200/85 leading-none shrink-0"
          aria-hidden="true"
        >Plan</span>
        <!-- THE TITLE — gold-shimmer, drop-shadowed.  Font sizing dropped 2026-06-03
             from text-2xl/[28px] to text-base/lg responsive so long titles don't
             monopolise the row.  Truncate class on this span handles ellipsis. -->
        <span
          class="plan-title-shimmer truncate min-w-0 flex-1
                 text-base md:text-lg leading-tight font-extrabold tracking-tight
                 bg-gradient-to-r from-amber-300 via-yellow-100 via-white to-amber-300
                 bg-clip-text text-transparent
                 drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)]"
        >{{ specModel.name }}</span>
        <svg
          class="h-4 w-4 shrink-0 opacity-0 group-hover:opacity-80 transition-opacity text-amber-200"
          viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
        >
          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
        </svg>
      </button>

      <!-- 🔑 OWNER CHIP — reinstated 2026-06-03 (Tom: *"The Stewards seem to
           have disappeared, please reinstate, why did they disappear?  we can
           simplify stewards to Owner Name on Title, but this is important
           project information"*).
           Casualty of the 2026-06-01 Plan Crest Row 2 removal — the three
           people chips (🔑/💡/⌨️) lived on Row 2 and were dropped when Row 2
           was deleted.  Reinstated as a SINGLE owner-name chip immediately
           after the title (per Tom's "simplify to Owner Name on Title").
           Clicking opens PlanOwnerPanel which still has all three role tabs
           (Owners / Planners / Scribes) — so full Steward access is preserved
           behind one trigger.  When no owner is set yet, the chip prompts. -->
      <button
        v-if="!titleEditing"
        type="button"
        class="group inline-flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-lg
               bg-amber-500/15 hover:bg-amber-500/30 border border-amber-300/40 hover:border-amber-300/80
               text-amber-100 hover:text-white text-xs font-semibold
               focus:outline-none focus:ring-2 focus:ring-amber-300 transition-colors"
        :title="specModel.owners && specModel.owners.length > 0
          ? `🔑 Spec owner: ${specModel.owners[0].name}.  Click to open Spec Stewards panel (Owners / Planners / Scribes — all roles preserved per the original 3-chip design).`
          : `No spec owner set.  Click to open Spec Stewards panel and add owners, planners, and scribes.`"
        :aria-label="specModel.owners && specModel.owners.length > 0
          ? `Spec owner: ${specModel.owners[0].name}. Click for full Stewards panel.`
          : `Add spec owner. Click for Stewards panel.`"
        @click="specPeopleTab = 'owners'; specOwnerPanelOpen = true"
      >
        <!-- OwnerGlyph `[*]!` — Tom 2026-06-04 approved Planguage-family
             replacement for the dated 🔑 emoji. -->
        <OwnerGlyph size="compact" class="h-4 w-auto shrink-0" aria-hidden="true" />
        <span class="truncate max-w-[140px]">
          {{ specModel.owners && specModel.owners.length > 0
            ? specModel.owners[0].name
            : 'Add owner' }}
        </span>
        <!-- Subtle additional-roles hint when planners/scribes also populated -->
        <span
          v-if="specModel.planners && specModel.planners.length > 0 || specModel.scribes && specModel.scribes.length > 0"
          class="text-[10px] text-amber-200/80 font-normal"
          aria-hidden="true"
        >
          +{{ (specModel.planners?.length ?? 0) + (specModel.scribes?.length ?? 0) }}
        </span>
      </button>

      <!-- The 6 reinstated meta chips (Version · Sharpen · Saved · Plan Story
           · Planner · Scribe) MOVED 2026-06-04 to a dedicated Row 2 wrap
           below this row.  Reason: Tom *"overlap.  It is ok if you need an
           extra line at top to organize things intelligibly.  Intelligibility
           and utility have priority over 'lines' of control stuff"*.  Row 1
           kept slim (PHI + title + Owner chip) so the absolute left + right
           clusters don't collide with the centered title group. -->

      <!-- EDIT MODE — same visual weight as the title, but as a plain
           white editable input on a subtle amber ring (so the user can SEE
           they're editing). Enter saves, Esc cancels, blur saves. Spell-check
           off because plan names are usually proper nouns or acronyms.
           Wrapped with the crest stripe + Plan eyebrow so the centered
           assembly is visually identical to view mode. -->
      <!-- v-else → v-if="titleEditing" 2026-06-04: the 6 reinstated title-row
           affordances above sit BETWEEN the title button (v-if="!titleEditing")
           and this edit-mode block, breaking the v-if/v-else adjacency Vue
           requires.  Made the condition explicit so the edit mode still
           toggles correctly without needing sibling adjacency. -->
      <div v-if="titleEditing" class="inline-flex items-center gap-3 min-w-0 max-w-[90%] pl-2 pr-3 py-1 -my-1 rounded-lg">
        <span
          class="shrink-0 h-9 w-1.5 rounded-full bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600 shadow-[0_0_8px_rgba(251,191,36,0.55)]"
          aria-hidden="true"
        ></span>
        <span
          class="hidden md:inline text-[10px] uppercase tracking-[0.35em] font-bold text-amber-200/85 leading-none shrink-0"
          aria-hidden="true"
        >Plan</span>
        <input
          ref="titleInputEl"
          v-model="titleDraft"
          type="text"
          spellcheck="false"
          autocomplete="off"
          maxlength="120"
          class="min-w-0 max-w-full pl-2 pr-3 py-1 -my-1 rounded-lg
                 bg-white/10 ring-2 ring-amber-300/70 focus:ring-amber-300
                 text-white caret-amber-300 placeholder-white/40
                 text-2xl md:text-[28px] leading-none font-extrabold tracking-tight
                 drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)] outline-none text-center"
          placeholder="Plan name"
          aria-label="Edit plan name — Enter saves, Esc cancels"
          @keydown.enter.prevent="commitTitleEdit"
          @keydown.esc.prevent.stop="cancelTitleEdit"
          @blur="commitTitleEdit"
        />
        <span
          class="hidden md:inline text-[10px] uppercase tracking-[0.25em] font-semibold text-amber-200/85 leading-none shrink-0"
          aria-hidden="true"
        >Enter saves · Esc cancels</span>
      </div>

    </div>

    <!-- ── Right pin cluster: 🆘 SOS · ⚡ Actions · 🦾 Agents ─────────────────
         Absolute on the OUTER crest bar (relative), pinned top-right.
         Sits at the very top of the screen — maximum distance from stage bar.
         Control-pins-at-top rule. Moved to outer crest bar 2026-05-31:
         was vertically centred in Row 1 which felt too close to stage buttons. -->
    <div class="absolute top-1.5 right-1 flex items-center gap-1 pr-0.5">
      <!-- ⚙ Settings (Tom 2026-06-03 — long-requested SEM Settings panel).
           Sits first in the cluster so it's adjacent to the SOS escape hatch
           — the two "meta" pins together, separated from the action pins.
           Tom 2026-06-04: *"setting gear is small, could be larger in same pin"*.
           Button enlarged from h-8 w-8 → h-10 w-10 and glyph from text-base
           (16px) → text-2xl (~24px) for clear visibility. -->
      <button
        type="button"
        class="h-10 w-10 flex items-center justify-center rounded-lg text-2xl leading-none
               bg-slate-700/80 text-white hover:bg-slate-600 ring-1 ring-slate-400/60 hover:ring-slate-300
               focus:outline-none focus:ring-2 focus:ring-slate-300 transition-all shrink-0"
        aria-label="Open SEM Settings panel"
        title="⚙ SEM Settings — Mode (Ultra Light / Pro SEM) · AI level · Privacy · Evo defaults · Visual · Workflow · Export · Collab · Diagnostics"
        @click="settingsOpen = true"
      >⚙</button>
      <!-- 🆘 SOS -->
      <button
        type="button"
        class="h-8 w-8 flex items-center justify-center rounded-lg text-base
               bg-red-600/80 text-white hover:bg-red-500 ring-1 ring-red-400/60 hover:ring-red-300
               focus:outline-none focus:ring-2 focus:ring-red-300 transition-all shrink-0"
        aria-label="SOS — open reset menu (Blank Canvas, Save & Stop, Rollback, Close stuck UI)"
        title="🆘 SOS — Blank Canvas / Save & Stop / Cancel Changes / Close stuck UI"
        @click="freshStartOpen = true"
      >🆘</button>
      <!-- ⚡ Actions hub -->
      <button
        type="button"
        :aria-expanded="menuOpen"
        aria-haspopup="true"
        aria-label="Open Actions menu (⌘A)"
        title="Actions menu — press ⌘A from anywhere"
        data-crest-tip="⚡ Actions — plan management, saves, exports & shortcuts (⌘A)"
        class="w-8 h-8 flex items-center justify-center rounded-lg text-lg
               select-none transition-all shrink-0
               focus:outline-none focus:ring-2 focus:ring-amber-300"
        :class="menuOpen
          ? 'bg-amber-300 text-amber-900 ring-2 ring-amber-200'
          : 'bg-amber-400/80 text-amber-900 hover:bg-amber-400'"
        @click="toggleMenu"
      ><span aria-hidden="true" style="filter: brightness(0.1);">⚡</span></button>
      <!-- ⌗ Evo Tools — Tom 2026-06-03 marker: catalogue of Evo-specialised tools
           (Value Flow, Evo Simulator, V × Step VDT, Critique, etc.).  Goes between
           Actions and Agents because Evo Tools are a specialised sibling of Actions,
           and conceptually "below" Agents (tools < AI workers).  Always visible
           per Control-Pins-at-Top rule. -->
      <EvoToolsButton @open="evoToolsOpen = true" />
      <!-- 🦾 Agents -->
      <button
        type="button"
        :aria-expanded="agentMenuOpen"
        aria-haspopup="true"
        aria-label="Open Agent Menu"
        title="Agent Menu — Maria · Contracts · Models — single-click to open"
        data-crest-tip="🦾 Agents — Maria: Board governance · Contracts: Planguage analysis · Models: Plan library"
        class="flex items-center gap-1.5 px-3 h-10 rounded-xl
               select-none transition-all shrink-0
               focus:outline-none focus:ring-2 focus:ring-emerald-300"
        :class="agentMenuOpen
          ? 'bg-emerald-300 text-emerald-900 ring-2 ring-emerald-200'
          : 'bg-emerald-500/80 text-emerald-950 hover:bg-emerald-500'"
        @click="agentMenuOpen = true"
      >
        <span class="text-2xl leading-none" aria-hidden="true">🦾</span>
        <span class="text-sm font-bold leading-none">Agents</span>
      </button>
    </div>



    <!-- ── Row 2: META CHIPS ROW — Tom 2026-06-04 *"It is ok if you need
         an extra line at top to organize things intelligibly. Intelligibility
         and utility have priority over 'lines' of control stuff"*.
         Moved out of Row 1 to stop the cramped-overlap shown in Tom's
         screenshot.  flex-wrap so chips stack on narrow widths instead of
         truncating.  Subtle indigo tint distinguishes meta from the title
         row above. -->
    <div
      v-if="specModel"
      class="flex flex-wrap items-center gap-2 px-4 py-1.5 bg-indigo-900/40 border-t border-white/10"
      aria-label="Plan meta — Spec Health Index, version, sharpening, save status, story toggle, stewards"
    >
      <!-- Spec Health Index badge (SHI, formerly PHI) — Tom 2026-06-04 *"shi
           awol"* — moved here from Row 1 to be the FIRST visible item, the
           anchoring leftmost element of the meta row.  Matches the 21 May
           18:42 reference layout where the PHI sat at the far-left of the
           Plan Crest row.  Click opens Spec Health Status panel. -->
      <SpecHealthBadge
        v-if="currentSpec"
        :index="specHealthIndexValue"
        :threshold="specHealthThresholdValue"
        :size="32"
        :has-alert="specHealthAlertCount > 0"
        :alert-count="specHealthAlertCount"
        :alert-hint="specHealthAlertCount === 1
          ? '1 Spec Health alert pending — click to review'
          : `${specHealthAlertCount} Spec Health alerts pending — click to review`"
        class="shrink-0"
        @click="specHealthStatusOpen = true"
      />

      <!-- Plan / Spec chip — RESTORED 2026-06-04 (silent-drop catch from
           PlanGlyph wiring discussion; default=yes per No-Silent-Removal
           SUPREME rule). Uses the Color Keyed Icon `[*+*+*]` + the literal
           word "Spec" (Tom's confirmed generic term). -->
      <span
        class="shrink-0 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/10 text-white/90 text-[11px] font-semibold"
        title="Plan / Spec — a container of multiple spec entries (Function · Value · Solution · …).  The generic 'Spec' covers Plan, Model, Contract, Meeting Minutes, etc."
      >
        <PlanGlyph size="compact" class="h-3.5 w-auto" aria-hidden="true" />
        <span>Spec</span>
      </span>

      <!-- Version pill (v0.1, v1.0, …) -->
      <span
        v-if="specModel.version"
        class="shrink-0 px-1.5 py-0.5 rounded bg-white/15 ring-1 ring-white/25
               font-mono text-[10px] font-bold text-white/90 tracking-tight"
        :title="`Plan version ${specModel.version}`"
      >v{{ specModel.version }}</span>

      <!-- DEADLINE pill — Tom 2026-06-06 r98: scalar Condition [When] at whole-spec
           level.  Click to edit (uses browser prompt for v1; richer date picker
           is a Phase 2 of the scalar-Conditions rollout).  "?" = not yet articulated. -->
      <button
        v-if="specModel"
        type="button"
        class="shrink-0 px-2 py-0.5 rounded bg-rose-500/30 ring-1 ring-rose-300/50
               font-mono text-[10px] font-bold text-white tracking-tight
               hover:bg-rose-500/50 transition-colors focus:outline-none focus:ring-2 focus:ring-rose-300"
        :title="`Project DEADLINE — currently '${specModel.deadline || '?'}' · click to edit (scalar Condition [When]; Tom 2026-06-06).`"
        @click="editDeadline"
      >⏱ {{ specModel.deadline || '?' }}</button>

      <!-- Sharpen-rounds badge — 🔪 N -->
      <span
        v-if="specModel.sharpenRounds && specModel.sharpenRounds > 0"
        class="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md
               bg-amber-400/90 text-amber-950 text-[11px] font-bold"
        :title="`${specModel.sharpenRounds} sharpening round${specModel.sharpenRounds !== 1 ? 's' : ''} applied`"
      ><span class="text-base leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]" aria-hidden="true">🔪</span><span class="leading-none">{{ specModel.sharpenRounds }}</span></span>

      <!-- "Saved N min ago" pill — IS the Save Now button (dual-coded). -->
      <button
        v-if="specBarSavedLabel || specModel"
        type="button"
        class="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md
               text-[11px] font-semibold transition-all duration-150
               focus:outline-none focus:ring-2 focus:ring-white/80 group"
        :class="_saveFlash === 'flash'
          ? 'bg-emerald-400/95 text-emerald-950 ring-1 ring-emerald-200/70'
          : specBarUnsaved
            ? 'bg-amber-400/95 text-amber-950 ring-1 ring-amber-200/70 hover:bg-amber-300 hover:scale-[1.04]'
            : 'bg-white/10 text-white/90 hover:bg-white/25 hover:text-white'"
        :title="_saveFlash === 'flash'
          ? 'Saved!'
          : specBarUnsaved
            ? `${specBarSavedLabel} — click to save now (you have unsaved changes)`
            : `${specBarSavedLabel || 'Not saved yet'} — click to save now`"
        :aria-label="_saveFlash === 'flash'
          ? 'Saved just now'
          : specBarUnsaved
            ? `${specBarSavedLabel}. Click to save now — you have unsaved changes.`
            : `${specBarSavedLabel || 'Not saved yet'}. Click to save now.`"
        @click="savedLabelClick"
      >
        <template v-if="_saveFlash === 'flash'">
          <span aria-hidden="true">✓</span><span>Saved just now</span>
        </template>
        <template v-else>
          <span class="inline group-hover:hidden" aria-hidden="true">
            <SaveGlyph v-if="specBarUnsaved" size="compact" class="inline-block h-3 w-auto mr-1 -mt-0.5" />{{ specBarSavedLabel || 'Save plan' }}
          </span>
          <span class="hidden group-hover:inline" aria-hidden="true">
            <SaveGlyph size="compact" class="inline-block h-3 w-auto mr-1 -mt-0.5" />Save now
          </span>
        </template>
      </button>

      <!-- 📖 Plan Story — toggles the Plan Story / Plan-DNA strip below. -->
      <button
        type="button"
        :class="[
          'shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg',
          'text-xs font-bold tracking-wide transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-white/80 shadow-sm',
          specStoryOpen
            ? 'bg-gradient-to-r from-fuchsia-300 to-pink-300 text-fuchsia-950 ring-2 ring-fuchsia-200/90 shadow-md'
            : 'bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white hover:from-fuchsia-400 hover:to-pink-400 hover:shadow-md hover:scale-[1.03] ring-1 ring-fuchsia-200/50',
        ]"
        :title="specStoryOpen
          ? 'Hide Spec Story — origin, hand-tuning, sharpen rounds, stewards, age'
          : 'Show Spec Story — origin, hand-tuning, sharpen rounds, stewards, age'"
        :aria-pressed="specStoryOpen"
        aria-label="Toggle Spec Story (origin, hand-tuning, sharpening, stewards, age)"
        data-testid="plancrest-story-toggle"
        @click="_togglePlanStory()"
      >
        <!-- SpecStoryGlyph `[*] ← §` — Tom 2026-06-04 approved replacement
             for 📖 emoji.  Semantic: spec sourced from stakeholder.
             Affordance renamed "Plan Story" → "Spec Story" 2026-06-04
             after Tom confirmed Spec as the generic for Plan/Model/Contract/MM. -->
        <SpecStoryGlyph size="compact" class="h-4 w-auto shrink-0 drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]" aria-hidden="true" />
        <span>Spec Story</span>
        <span class="text-[10px] opacity-90 leading-none font-extrabold" aria-hidden="true">{{ specStoryOpen ? '▾' : '▸' }}</span>
      </button>

      <!-- 💡 Planner chip — distinct from Owner. -->
      <button
        type="button"
        :class="[
          'shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-white/60',
          specModel.planners?.length
            ? 'bg-white/15 text-white hover:bg-white/25'
            : 'border border-dashed border-white/40 text-white/80 hover:bg-white/10 hover:border-white/70',
        ]"
        :title="specModel.planners?.length
          ? `Planners: ${specModel.planners.map(p => p.name).join(', ')} — click to edit`
          : 'Add a Spec Planner'"
        aria-label="Spec Planners"
        @click="specPeopleTab = 'planners'; specOwnerPanelOpen = true"
      >
        <!-- PlannerGlyph `[?]→[*]` — Tom 2026-06-04 approved replacement for 💡. -->
        <PlannerGlyph size="compact" class="h-4 w-auto shrink-0" aria-hidden="true" />
        <span class="text-[9px] uppercase tracking-wider opacity-70">Planner</span>
        <template v-if="specModel.planners?.length">
          <span class="truncate max-w-[90px]">{{ specModel.planners[0].name }}</span>
          <span v-if="specModel.planners.length > 1" class="text-white/70">+{{ specModel.planners.length - 1 }}</span>
        </template>
        <span v-else aria-hidden="true">+</span>
      </button>

      <!-- ⌨️ Scribe chip — distinct from Owner / Planner. -->
      <button
        type="button"
        :class="[
          'shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-white/60',
          specModel.scribes?.length && specModel.scribes[0]?.name
            ? 'bg-white/15 text-white hover:bg-white/25'
            : 'border border-dashed border-white/40 text-white/80 hover:bg-white/10 hover:border-white/70',
        ]"
        :title="!specModel.scribes?.length
          ? 'Add a Spec Scribe'
          : specModel.scribes[0]?.isDefault
            ? `Scribe (default — ${specModel.scribes[0].name || 'tap to set your name'}) — click to edit`
            : `Scribes: ${specModel.scribes.map(s => s.name).join(', ')} — click to edit`"
        aria-label="Spec Scribes"
        @click="specPeopleTab = 'scribes'; specOwnerPanelOpen = true"
      >
        <!-- ScribeGlyph `[ ]→[*]` — Tom 2026-06-04 approved replacement for ⌨. -->
        <ScribeGlyph size="compact" class="h-4 w-auto shrink-0" aria-hidden="true" />
        <span class="text-[9px] uppercase tracking-wider opacity-70">Scribe</span>
        <template v-if="specModel.scribes?.length">
          <span v-if="specModel.scribes[0].name" class="truncate max-w-[90px]">{{ specModel.scribes[0].name }}</span>
          <span v-if="specModel.scribes.length > 1" class="text-white/70">+{{ specModel.scribes.length - 1 }}</span>
        </template>
        <span v-else aria-hidden="true">+</span>
      </button>
    </div>

    <!-- Row 3: Plan Story strip (toggled by the bright 📖 Plan Story button) -->
    <SpecStoryStrip
      v-if="specStoryOpen"
      :plan-model="specModel"
      @close="specStoryOpen = false"
      @edit-stewards="specPeopleTab = 'owners'; specOwnerPanelOpen = true"
    />

  </div>

  <!-- Plan Owner Data panel — pinned below the plan bar when open -->
  <SpecOwnerPanel
    v-if="view === 'app' && specModel && specOwnerPanelOpen"
    :initial-tab="specPeopleTab"
    :plan-model="specModel"
    @close="specOwnerPanelOpen = false"
  />

  <!-- Plan Governance / Spec Owners drawer -->
  <SpecOwnersPanel
    v-if="view === 'app' && specModel && govPanelOpen"
    :plan-model="specModel"
    @close="govPanelOpen = false"
  />

  <!-- Feature #195: Plan Targets panel -->
  <SpecTargetsPanel
    v-if="view === 'app' && specTargetsOpen"
    @close="specTargetsOpen = false"
    @open-editor="({ targetId, targetName }) => { specTargetsOpen = false; specEditorOpen = true; _editorTarget = { id: targetId, name: targetName } }"
  />

  <!-- Feature #196: Spec Editor — full-screen, z-[600] -->
  <SpecEditorPanel
    v-if="view === 'app' && specEditorOpen && currentSpec"
    :spec="currentSpec"
    :initial-target-id="_editorTarget.id"
    :initial-target-name="_editorTarget.name"
    :initial-tab="_editorTab || undefined"
    :initial-entry-id="_editorEntryId || undefined"
    :return-to="_editorReturnTo || undefined"
    :planning-stage="planningStage"
    @close="_closeSpecEditor"
    @commit-master="(editedSpec) => { _markSpecCommitted(); currentSpec = editedSpec; _closeSpecEditor(); showToast('✅ Changes committed to Master Plan', 3000) }"
    @open-global-priority="globalPriorityOpen = true"
    @open-priority-info="priorityInfoOpen = true"
    @open-edit-info="editInfoOpen = true"
    @back-to-value-flow="_handleBackToValueFlow"
    @show-in-value-flow="_handleShowInValueFlow"
    @open-actions="menuOpen = true"
    @navigate-stage="handleStageBarNav"
  />

  <!-- Contracts mode — 3rd major SEM surface (Plans · Models · Contracts). z-[600]. -->
  <ContractHub
    v-if="view === 'app' && contractsOpen"
    @close="contractsOpen = false"
  />

  <!-- Feature #197: Tool Info panel — right drawer, z-[490] -->
  <ToolInfoPanel
    v-if="view === 'app' && specModel && toolInfoPanelOpen"
    :plan-model-id="specModel.id"
    :plan-model="specModel"
    :spec="currentSpec"
    @close="toolInfoPanelOpen = false"
  />

  <!-- SEM Metadata scoreboard — fuchsia/rose right drawer, z-[490] -->
  <SemMetadataPanel
    v-if="view === 'app' && semMetadataPanelOpen"
    @close="semMetadataPanelOpen = false"
  />

  <!-- ActionsHub — tile grid replacing the old text dropdown, z-[380].
       Controlled by menuOpen (same ref as before; toggleMenu() still fires).
       The old inline dropdown block has been removed from the Teleport cluster. -->
  <ActionsHubPanel
    v-if="view === 'app' && menuOpen"
    :has-plan="!!specModel"
    :has-spec="!!currentSpec"
    :has-confirmed-steps="confirmedSteps.length > 0"
    :has-multiple-models="_allSpecModels.length > 0"
    :has-spec-history="specHistory.length > 0"
    :has-dashboard-entries="dashboardEntries.length > 0"
    :dictation-active="dictationActive"
    :speaking="speaking"
    :start-over-pending="startOverConfirmPending"
    @close="menuOpen = false"
    @action="handleAction"
  />

  <!-- Agent Menu (2026-05-29) — grid of agent tiles; Maria is the first agent. z-[490] -->
  <AgentMenuPanel
    v-if="view === 'app' && agentMenuOpen"
    @close="agentMenuOpen = false"
    @select-agent="(id) => { agentMenuOpen = false; if (id === 'maria') mariaBoardOpen = true; if (id === 'maria-analysis') mariaOpen = true; if (id === 'contracts') contractsOpen = true; if (id === 'models') modelLibraryOpen = true; if (id === 'stakeholder-mapper') stakeholderMapperOpen = true; if (id === 'evo-step-critique') evoCritiquerOpen = true; if (id === 'plan-importer') specImporterOpen = true; if (id === 'decisions') decisionMapperOpen = true; if (id === 'history') unifiedHistoryOpen = true }"
  />

  <!-- Maria Agent — Board Work Parse (2026-05-29). z-[497] -->
  <MariaAgentBoard
    v-if="view === 'app' && mariaOpen"
    @close="mariaOpen = false"
  />

  <!-- Maria Board Hub — members, activity log, settings (2026-05-30). z-[497]
       Mutually exclusive with MariaAgentBoard via surface registry.
       "open-analysis" event bounces user from hub to analysis panel. -->
  <MariaBoardHub
    v-if="view === 'app' && mariaBoardOpen"
    @close="mariaBoardOpen = false"
    @open-analysis="mariaBoardOpen = false; mariaOpen = true"
  />

  <!-- Unified History Panel — Plans / Models / Contracts / Maria tabs -->
  <HistoryPanel
    v-if="unifiedHistoryOpen"
    @close="unifiedHistoryOpen = false"
    @load-plan="(planId, versionId) => { unifiedHistoryOpen = false; specImporterOpen = true }"
    @restore-model="(modelId, versionId) => { unifiedHistoryOpen = false }"
    @load-contract="(contractId) => { unifiedHistoryOpen = false; contractsOpen = true }"
    @load-maria="(result) => { unifiedHistoryOpen = false; mariaOpen = true }"
  />

  <!-- Domain Model Library — 18 built-in Planguage models across 6 categories. z-[600] -->
  <ModelLibraryPanel
    v-if="view === 'app' && modelLibraryOpen"
    @close="modelLibraryOpen = false"
    @select-agent="(id) => { modelLibraryOpen = false; if (id === 'stakeholder-mapper') stakeholderMapperOpen = true; if (id === 'evo-step-critique') evoCritiquerOpen = true; if (id === 'plan-importer') specImporterOpen = true; if (id === 'decisions') decisionMapperOpen = true }"
  />

  <!-- Stakeholder Mapper agent panel — AI-drafted 10-attribute profiles. z-[600] -->
  <StakeholderMapperPanel
    v-if="view === 'app' && stakeholderMapperOpen"
    @close="stakeholderMapperOpen = false"
    @open-agents="stakeholderMapperOpen = false; agentMenuOpen = true"
  />

  <!-- Evo Critiquer agent panel — Evo health check + value delivery review. z-[600] -->
  <EvoCritiquerPanel
    v-if="view === 'app' && evoCritiquerOpen"
    @close="evoCritiquerOpen = false"
    @open-agents="evoCritiquerOpen = false; agentMenuOpen = true"
    @open-history="evoCritiquerOpen = false; modelHistoryOpen = true"
  />

  <!-- Plan Importer agent panel — universal Planguage converter. z-[600] -->
  <SpecImporterPanel
    v-if="view === 'app' && specImporterOpen"
    @close="specImporterOpen = false"
  />

  <!-- Decision Mapper agent panel — structured decision analysis. z-[600] -->
  <DecisionMapperPanel
    v-if="view === 'app' && decisionMapperOpen"
    @close="decisionMapperOpen = false"
    @open-agents="decisionMapperOpen = false; agentMenuOpen = true"
  />

  <!-- MultiVision — VDT-grounded V/R balance slider panel (z-[600]) -->
  <MultiVisionPanel
    v-if="view === 'app' && multiVisionOpen"
    @close="multiVisionOpen = false"
    @open-multiforks="openMultiForks"
  />

  <!-- MultiForks — Resources → System ← Values fork diagram (r97, 2026-06-06).
       Accessed from MultiVision footer + Visuals panel.  Reads currentSpec + balanceScore. -->
  <MultiForksPanel
    :open="multiForksOpen"
    :evo-steps-delivered="confirmedSteps.length"
    @close="multiForksOpen = false"
  />

  <!-- Feature #199: Priority Record panel — right drawer, z-[485] -->
  <PriorityRecordPanel
    v-if="view === 'app' && specModel && priorityPanelOpen && _priorityEntryId"
    :plan-model-id="specModel.id"
    :entry-id="_priorityEntryId"
    :entry-type="_priorityEntryType"
    :entry-description="_priorityEntryDesc"
    :spec-owners="specModel.governance?.specOwners"
    @close="priorityPanelOpen = false"
  />

  <!-- Feature #201: Global Priority panel — right drawer, z-[493], 3 layers + Review -->
  <GlobalPriorityPanel
    v-if="view === 'app' && specModel && currentSpec && globalPriorityOpen"
    :plan-model-id="specModel.id"
    :spec="currentSpec"
    :spec-owners="specModel.governance?.specOwners ?? []"
    @close="globalPriorityOpen = false"
    @open-priority-info="priorityInfoOpen = true"
  />

  <!-- Feature #202: Plan Health Status — read-only PHI + history graph + notifications -->
  <SpecHealthStatusPanel
    v-if="view === 'app' && specModel && currentSpec && specHealthStatusOpen"
    :plan-model-id="specModel.id"
    :spec="currentSpec"
    :spec-owner-count="specModel.governance?.specOwners?.length ?? 0"
    :has-spec-owner="(specModel.owners?.length ?? 0) > 0"
    :plan-version="specModel.version ? `v${specModel.version}` : ''"
    :by="user?.email ?? 'unknown'"
    :plan-name="specModel.name"
    :plan-owners="specModel.owners ?? []"
    @close="specHealthStatusOpen = false"
    @open-admin="specHealthAdminOpen = true"
  />

  <!-- Feature #202.b: Plan Health Administration — weights, notification policy, audit log -->
  <SpecHealthAdminPanel
    v-if="view === 'app' && specModel && currentSpec && specHealthAdminOpen"
    :plan-model-id="specModel.id"
    :spec="currentSpec"
    :spec-owner-count="specModel.governance?.specOwners?.length ?? 0"
    :has-spec-owner="(specModel.owners?.length ?? 0) > 0"
    :plan-owners="specModel.owners ?? []"
    :plan-version="specModel.version ? `v${specModel.version}` : ''"
    :by="user?.email ?? 'unknown'"
    :plan-name="specModel.name"
    @close="specHealthAdminOpen = false"
    @open-status="specHealthAdminOpen = false; specHealthStatusOpen = true"
  />

  <!-- Plan Health Target — Tom 2026-06-03 decision B (the 2026-05-27 "Target
       and Administration are vital" WAIT row resolved).  Read-only sibling
       of Status (live PHI) + Admin (threshold setter).  Answers "where are
       we aiming + how big is the gap" via per-V.entry target progress. -->
  <SpecHealthTargetPanel
    v-if="view === 'app' && specModel && currentSpec && specHealthTargetOpen"
    :plan-model-id="specModel.id"
    :spec="currentSpec"
    :spec-owner-count="specModel.owners?.length ?? 0"
    :has-spec-owner="(specModel.owners?.length ?? 0) > 0"
    :plan-name="specModel.name"
    @close="specHealthTargetOpen = false"
    @open-admin="specHealthTargetOpen = false; specHealthAdminOpen = true"
    @open-status="specHealthTargetOpen = false; specHealthStatusOpen = true"
    @open-value-edit="(valueId: string) => { specHealthTargetOpen = false; specEditorOpen = true; _editorTarget = { id: valueId, name: valueId } }"
  />

  <!-- Evo Health Tool (EHT) — Tom 2026-06-03.  Mirror of PHI structure but
       scoped to Evo Steps + short-term focus.  Detector + Cure proposals
       with risk ratings + per-cure approval audit log.  v1 scaffold —
       real Cure application + email-to-Owner ship in v2. -->
  <EvoHealthPanel
    v-if="view === 'app' && evoHealthOpen"
    :steps="_stepsForDiagram"
    :plan-id="specModel?.name ?? 'default'"
    @close="evoHealthOpen = false"
  />

  <!-- Planguage Standards Auditor — Tom 2026-06-03 Conjunction-of-Technologies
       Exploit #1.  Cross-references live spec against 10.Standard/Standard.Kai-Zen/. -->
  <StandardsAuditorPanel
    v-if="view === 'app' && currentSpec && standardsAuditorOpen"
    :spec="currentSpec"
    :plan-id="specModel?.name ?? 'default'"
    @close="standardsAuditorOpen = false"
  />

  <!-- Planguage Analyzer (Unified) — Tom 2026-06-03 Conjunction-of-Technologies
       Exploit #5.  ONE panel, all knowledge layers, source-layer-filtered. -->
  <PlanguageAnalyzerPanel
    v-if="view === 'app' && currentSpec && planguageAnalyzerOpen"
    :spec="currentSpec"
    :plan-id="specModel?.name ?? 'default'"
    :step-names="_stepsForDiagram.map(s => s.name)"
    @close="planguageAnalyzerOpen = false"
  />

  <!-- Internet Context Fetcher — Tom 2026-06-03 Conjunction-of-Technologies
       Exploit #3 (Stakeholder Context) + #4 (Industry Benchmark).
       Two-tab panel; both tabs use Claudian's WebSearch/WebFetch via clipboard
       prompt + paste-back JSON.  Every finding cites a real URL. -->
  <InternetContextPanel
    v-if="view === 'app' && currentSpec && internetContextOpen"
    :spec="currentSpec"
    :plan-id="specModel?.name ?? 'default'"
    @close="internetContextOpen = false"
  />

  <!-- Copyright & Attribution panel — right drawer, z-[475] -->
  <CopyrightPanel
    v-if="copyrightPanelOpen"
    @close="copyrightPanelOpen = false"
  />

  <!-- About the Save Glyph (DD-001 · `*→[*]` / `[*]→*`) — centred modal, z-[480/481] -->
  <SaveGlyphHistoryPanel
    v-if="saveGlyphHistoryOpen"
    @close="saveGlyphHistoryOpen = false"
    @open-symbol-family="saveGlyphHistoryOpen = false; symbolFamilyOpen = true"
  />

  <!-- About the Priority Glyph (DD-002 · `[A>B>C]`) — centred modal, z-[482/483]
       One tier above the Save-Glyph history so the Priority info can open from
       within Global Priority drawer without z-fighting. -->
  <PriorityInfoPanel
    v-if="priorityInfoOpen"
    @close="priorityInfoOpen = false"
    @open-symbol-family="priorityInfoOpen = false; symbolFamilyOpen = true"
  />

  <!-- About the Edit Glyph ([*]→[**]) — centred modal, z-[482/483].
       Same tier as PriorityInfoPanel — these two are never open simultaneously
       (both registered as exclusive surfaces). -->
  <EditInfoPanel
    v-if="editInfoOpen"
    :open="editInfoOpen"
    @close="editInfoOpen = false"
  />

  <!-- Symbol Family panel (Tom 2026-05-15) — all 5 glyphs, z-[484/485]. -->
  <SymbolFamilyPanel
    v-if="symbolFamilyOpen"
    @close="symbolFamilyOpen = false"
  />

  <!-- Value Flow diagram (Tom 2026-05-15) — causal chain z-[486/487]. -->
  <ValueFlowPanel
    v-if="valueFlowOpen && currentSpec"
    :spec="currentSpec"
    :evo-steps="_stepsForDiagram"
    :tasks-by-step="tasksByStep"
    :impact-matrix="capturedImpactMatrix"
    @close="valueFlowOpen = false"
    @open-editor="({ tab, entryId }) => _openSpecEditor({ tab, entryId, returnTo: 'valueFlow' })"
    @node-relations-click="({ tab, entryId }) => _openSdr(tab, entryId, 'valueFlow')"
    @go-to-tasks="_onGoToTasks"
  />

  <!-- System Model Dashboard (2026-05-19) — full-screen model health panel z-[488/489]. -->
  <SystemModelDashboard
    v-if="modelDashboardOpen && currentSpec && specModel"
    :spec="currentSpec"
    :model="specModel"
    @close="modelDashboardOpen = false"
    @derive-plan="(_ids) => { modelDashboardOpen = false; setWorkingMode('plan') }"
    @switch-to-plan="modelDashboardOpen = false; setWorkingMode('plan')"
  />

  <!-- Model History (P7, 2026-05-27) — all PlanModel records, plan + model mode. z-[492/493]. -->
  <ModelHistory
    v-if="modelHistoryOpen"
    @close="modelHistoryOpen = false"
    @load-model="(m) => { modelHistoryOpen = false; handleRestoreModel(m) }"
    @open-model-dashboard="(m) => { modelHistoryOpen = false; handleRestoreModel(m); modelDashboardOpen = true }"
  />

  <!-- GlyphDataPanel (P2, 2026-05-27) — full Planguage glyph reference card. z-[494/495].
       DD-013 (2026-06-01): triggered by double-clicking ANY PlTypeIcon anywhere in the app,
       plus ArrowInfoPanel's "open-glyph" emit. useGlyphPanel composable provides state. -->
  <GlyphDataPanel
    v-if="glyphPanelOpen && glyphPanelType"
    :pl-type="glyphPanelType"
    @close="closeGlyphPanel()"
    @show-glyph="navigateGlyphPanel"
  />

  <!-- Spec Direct Relations — right-side drawer (Tom 2026-05-16) -->
  <!--
    BUG FIX (Tom 2026-06-03 — "the evo steps are in the overview value flow but
    are missing in the near relations view"): used to pass confirmedSteps which
    is empty until the user clicks Confirm Plan. The overview Value Flow already
    falls back to the draft plan via _stepsForDiagram, so the relations were
    visible there but absent in SDR for the same node. Aligned both call sites.
  -->
  <SpecDirectRelations
    v-if="sdrOpen && currentSpec"
    :spec="currentSpec"
    :evo-steps="_stepsForDiagram"
    :tasks-by-step="tasksByStep"
    :impact-matrix="capturedImpactMatrix"
    :entry-id="_sdrEntryId"
    :entry-tab="_sdrEntryTab"
    @close="sdrOpen = false"
    @back-to-diagram="_sdrBackToDiagram"
    @open-editor="({ tab, entryId }) => { sdrOpen = false; _openSpecEditor({ tab, entryId, returnTo: 'valueFlow' }) }"
    @open-edit-info="editInfoOpen = true"
    @go-to-evo="_sdrBackToDiagram"
    @go-to-tasks="_onGoToTasks"
  />

  <!-- Main content wrapper.
       When plan loaded: padding-top = STAGE_BAR_H (148px, stage bar fixed at
       top-0) + specCrestH (live ResizeObserver, tracks Plan Crest including
       DNA strip open/closed so content never starts under either fixed header).
       When no plan: pt-8 static (stage bar is in-flow, not fixed). -->
  <div
    class="min-h-screen bg-gray-50 flex flex-col items-center justify-start pb-16 px-4 md:pr-40
           overflow-x-clip"
    :class="!(view === 'app' && specModel) ? 'pt-8' : ''"
    :style="contentTopPad !== undefined ? { paddingTop: contentTopPad + 'px' } : undefined"
  >

    <!-- Loading state while session is being restored.
         SIGN_IN_DISABLED gate (2026-05-13): when sign-in is disabled, never
         render the loading splash — fall straight through to the app branch
         even if `view` ref still holds 'loading' from a previous HMR boot. -->
    <div
      v-if="view === 'loading' && !SIGN_IN_DISABLED"
      class="flex flex-col items-center justify-center min-h-[40vh] px-8"
    >
      <div class="w-full max-w-xs">
        <LoadingProgress
          :loading="true"
          label="Starting SEM App…"
          :baseline="5"
          color="indigo"
        />
      </div>
    </div>

    <!-- Invitation acceptance — processes token from email deep link -->
    <InviteAcceptView
      v-else-if="view === 'invite'"
      :token="inviteToken"
      :token-type="inviteType"
      @invite-accepted="view = 'app'"
      @invite-failed="view = 'sign-in'"
    />

    <!-- Sign-in view — gated by !SIGN_IN_DISABLED so it cannot render
         while sign-in is disabled (2026-05-13 demo emergency). -->
    <template v-else-if="view === 'sign-in' && !SIGN_IN_DISABLED">
      <SignInView
        @signed-in="_initWorkspaceAndOpenApp()"
        @go-sign-up="view = 'sign-up'"
      />
      <!-- Feature #8: Demo button on sign-in page (subtle link style) -->
      <div class="mt-4 flex items-center justify-center gap-3">
        <button
          type="button"
          aria-label="See a Demo"
          class="text-sm text-indigo-600 hover:text-indigo-800 underline underline-offset-2 min-h-[44px] px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
          @click="view = 'app'; launchDemo()"
        >
          ▶ See a demo
        </button>
        <!-- Feature #53: Guided wizard button on sign-in page -->
        <button
          type="button"
          aria-label="Guided"
          class="h-11 px-4 text-sm font-medium rounded-lg bg-sky-100 text-sky-700 hover:bg-sky-200 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
          @click="view = 'app'; wizardOpen = true"
        >
          🧙 Guided
        </button>
      </div>
    </template>

    <!-- Sign-up view — gated by !SIGN_IN_DISABLED. -->
    <SignUpView
      v-else-if="view === 'sign-up' && !SIGN_IN_DISABLED"
      @signed-up="view = 'confirm'"
      @go-sign-in="view = 'sign-in'"
    />

    <!-- Email confirmation message shown after sign-up — gated by !SIGN_IN_DISABLED. -->
    <div
      v-else-if="view === 'confirm' && !SIGN_IN_DISABLED"
      class="w-full max-w-sm mx-auto px-4 py-12 space-y-4 text-center"
      role="status"
      aria-live="polite"
    >
      <h1 class="text-xl font-semibold text-gray-900">Check your inbox</h1>
      <p class="text-sm text-gray-500">
        We've sent a confirmation link to your email address.
        Click the link to activate your account, then come back to sign in.
      </p>
      <button
        type="button"
        class="min-h-[44px] w-full rounded-lg border border-gray-300 bg-white px-4 py-3
               text-sm font-medium text-gray-700
               hover:bg-gray-50 focus-visible:outline focus-visible:outline-2
               focus-visible:outline-offset-2 focus-visible:outline-blue-600
               transition-colors duration-150"
        aria-label="Back to Sign In"
        @click="view = 'sign-in'"
      >
        Back to sign in
      </button>
    </div>

    <!-- Main SEM App — 2026-05-13 changed from v-else-if="view === 'app'" to
         v-else so this branch is the unconditional fallback when none of the
         upper branches match. With SIGN_IN_DISABLED gating loading/sign-in/
         sign-up/confirm, the app surface always renders even if the in-memory
         `view` ref is stuck on a stale 'sign-in' / 'loading' value from an
         HMR-preserved ref (Tom mid-Kai-demo: even reload didn't drop him out
         of sign-in because HMR kept the old ref alive). -->
    <template v-else>

      <!-- ── 11-stage Planguage planning bar ──────────────────────────────────
           ValueCounter — rebuilt 2026-05-27 with official PlTypeIcon glyphs
           (Planguage Spec Type Glyphs v7, Tom+Kai Gilb+Claudian 2026-05-16).
           96px dark pills with indigo→emerald hue sweep. 10 concave arrows.
           Arrow clicks open ArrowInfoPanel (history + Planguage + fun fact).
           DD-007: stages never locked — navigation always proceeds.
           Breakout wrapper: parent has px-4 md:pr-40 constraints; the bar
           must span full viewport width. -ml-4 + w-[calc(100%+Xrem)] breaks out.
           overflow-x-clip on the parent div prevents page-level scroll. -->
      <!-- self-start (2026-05-29 fix): the parent is flex-col items-center.
           The -ml-4 + calc widths were designed for flex-START alignment:
           child starts at the padding left edge (x=16px), -ml-4 shifts to x=0,
           width = content_width + padding = full viewport. But items-center was
           CENTERING the child first, so -ml-4 was overshooting ~72-88px left,
           hiding stage 1. self-start restores the intended flex-start alignment
           for just this child; the calc widths and -ml-4 then work correctly.
           fixed (2026-06-01 fix): Tom "stage bar blocks scrolled content" — sticky
           cannot prevent blocking; fixed takes the element out of document flow.
           top-0 (2026-06-01 rethink): Tom "wouldn't it be better to put it at the
           very top and everything below it scrolls" — stage bar now always anchors
           at top-0; Plan Crest sits below at top-[124px]. Simpler than the earlier
           specCrestH-driven top offset. z-[250] stays below the Plan Crest z-[300]
           and below all modals/panels (≥z-[380]). -->
      <div
        :class="specModel
          ? 'fixed top-0 left-0 right-0 z-[250]'
          : 'self-start -ml-4 w-[calc(100%+2rem)] md:w-[calc(100%+11rem)]'"
      >
        <ValueCounter
          :current-stage="planningStage"
          :extra-right-pad="!specModel ? 440 : 0"
          @go-to-stage="handleStageBarNav"
          @open-glyph="openGlyphPanel"
          @stage-action="handleStageAction"
        />
      </div>

      <!-- ── Stage navigation breadcrumb ────────────────────────────────────────
           Tom 2026-05-28: "There is a universal rule. We need clear navigation
           back to previous screen, and possibly other origins. There is no back
           (to actions)."
           Persistent control pins (top rule): ← Back pin + stage-action button
           + → Next pin + ⚡ Actions + 🤖 Agents shortcuts. Tom 2026-06-03:
           "Next (and Back) are terribly small, can be missed, but this is a
           major decision point" — Back/Next are now full pin-style buttons
           matching the ValueCounter stage tiles (same number badge + Planguage
           type glyph + label), coloured by the destination stage's glyph. -->
      <div class="flex flex-col gap-1 mb-1 px-0.5">
        <div class="flex items-center gap-2 flex-wrap">

          <!-- ← Back pin — shows the PREVIOUS stage with its glyph + number + label.
               Tom 2026-06-04 (BUG flag, verbatim): *"what is this study act
               button doing in resources stage? BUG"*.  At Stages 10 (Resources)
               and 11 (Export) the "previous" stage in the canonical 11-stage
               cycle is Study-Act (9) and Resources (10) — both reflective /
               post-delivery surfaces that aren't natural "back" targets for
               forward planning flow.  Same reasoning chain as r64/r65 bottom-
               mirror removals.  The stage bar at top of the page IS the
               revisit surface — always visible, always MOVE-compliant.  Hide
               the back pin at Stages 10 and 11. -->
          <button
            v-if="prevStageInfo && planningStage < 10"
            type="button"
            class="group inline-flex items-center gap-2.5 rounded-2xl
                   pl-2.5 pr-4 py-2 select-none
                   bg-white border-2 border-slate-300
                   hover:border-indigo-400 hover:bg-indigo-50 hover:shadow-md
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400
                   transition-all duration-150 active:scale-95"
            :title="`← Back to Stage ${prevStageInfo.stage} · ${prevStageInfo.label} — ${prevStageInfo.title}`"
            :aria-label="`Go back to Stage ${prevStageInfo.stage}: ${prevStageInfo.label}`"
            @click="handleStageBarNav(prevStageInfo.stage)"
          >
            <span class="text-base font-bold text-slate-500 group-hover:text-indigo-700 leading-none" aria-hidden="true">←</span>
            <span class="text-[10px] font-extrabold leading-none bg-slate-700 text-white rounded-md px-1.5 py-1"
                  aria-hidden="true">{{ prevStageInfo.stage }}</span>
            <PlTypeIcon :pl-type="prevStageInfo.plType" size="md" />
            <span class="flex flex-col items-start leading-tight">
              <span class="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Back to</span>
              <span class="text-sm font-bold text-slate-800">{{ prevStageInfo.label }}</span>
            </span>
          </button>

          <!-- Stage-specific primary action button — Tom 2026-06-04
               enlarged + uses canonical PlTypeIcon (matching the stage
               tile above) instead of the dated 📦/📋/etc. emoji that used
               to live in the label string.  Format: [Stage N] [Color glyph]
               [Stage Name] [STAGE NOW indicator] [Action label].
               Stays the visual primary CTA (gradient + enlarged padding +
               larger glyph size).  Falls back to label-only if for some
               reason currentStageInfo is missing. -->
          <button
            v-if="planningStageAction"
            type="button"
            class="group inline-flex items-center gap-3 rounded-2xl
                   pl-3 pr-5 py-3 select-none
                   text-base font-bold text-white
                   bg-gradient-to-r from-indigo-500 to-violet-500
                   hover:from-indigo-600 hover:to-violet-600
                   shadow-lg hover:shadow-xl ring-2 ring-indigo-300/40
                   transition-all duration-150 active:scale-95
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-1"
            :title="currentStageInfo
              ? `Stage ${currentStageInfo.stage} · ${currentStageInfo.label} (current stage) — primary action: ${planningStageAction.label.replace(/^[^\w]+\s*/, '')}`
              : `${planningStageAction.label} — primary action for Stage ${planningStage}`"
            :aria-label="planningStageAction.label"
            @click="planningStageAction.handler()"
          >
            <span v-if="currentStageInfo"
                  class="text-[11px] font-extrabold leading-none bg-black/60 text-white rounded-md px-2 py-1.5"
                  aria-hidden="true">{{ currentStageInfo.stage }}</span>
            <!-- White plate behind the PlTypeIcon so the canonical type colour
                 (dark green Resource, dark red Constraint, blue Stakeholder
                 etc.) has enough contrast against the indigo/violet gradient.
                 Tom 2026-06-04: *"The color artsy icon is visually difficult
                 for me against that background"*. -->
            <span v-if="currentStageInfo"
                  class="shrink-0 inline-flex items-center justify-center bg-white rounded-lg p-1 shadow-sm">
              <PlTypeIcon :pl-type="currentStageInfo.plType" size="lg" />
            </span>
            <span v-if="currentStageInfo" class="flex flex-col items-start leading-tight">
              <span class="text-[9px] font-semibold uppercase tracking-[0.15em] text-indigo-200">Stage Now</span>
              <span class="text-base font-extrabold text-white">{{ currentStageInfo.label }}</span>
            </span>
            <!-- Action label — strip leading emoji.  Hide entirely if it would
                 just repeat the stage name (Tom 2026-06-04: *"the word
                 resources 2x is unnecessary"*).  Case-insensitive comparison
                 so "Resources" vs "resources" both deduplicate. -->
            <template v-if="(() => {
              const action = planningStageAction.label.replace(/^[^\w]+\s*/, '').trim().toLowerCase();
              const stage = (currentStageInfo?.label ?? '').trim().toLowerCase();
              return action && action !== stage;
            })()">
              <span class="text-sm font-semibold text-white/95 border-l border-white/30 pl-3 ml-1">
                {{ planningStageAction.label.replace(/^[^\w]+\s*/, '') }}
              </span>
            </template>
          </button>

          <div class="flex-1" aria-hidden="true" />

          <!-- → Next pin — shows the NEXT stage with its glyph + number + label.
               Gradient emphasises that this is the forward / advance action. -->
          <button
            v-if="nextStageInfo"
            type="button"
            class="group inline-flex items-center gap-2.5 rounded-2xl
                   pl-4 pr-2.5 py-2 select-none
                   bg-gradient-to-r from-indigo-600 to-violet-600 text-white
                   border-2 border-indigo-700
                   hover:from-indigo-700 hover:to-violet-700 hover:shadow-lg
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-1
                   transition-all duration-150 active:scale-95 shadow-md"
            :title="`Next → Stage ${nextStageInfo.stage} · ${nextStageInfo.label} — ${nextStageInfo.title}`"
            :aria-label="`Go to Stage ${nextStageInfo.stage}: ${nextStageInfo.label}`"
            @click="handleStageBarNav(nextStageInfo.stage)"
          >
            <span class="flex flex-col items-end leading-tight">
              <span class="text-[9px] font-semibold uppercase tracking-wider text-indigo-200">Next →</span>
              <span class="text-sm font-bold text-white">{{ nextStageInfo.label }}</span>
            </span>
            <PlTypeIcon :pl-type="nextStageInfo.plType" size="md" />
            <span class="text-[10px] font-extrabold leading-none bg-black/60 text-white rounded-md px-1.5 py-1"
                  aria-hidden="true">{{ nextStageInfo.stage }}</span>
            <span class="text-base font-bold text-white leading-none" aria-hidden="true">→</span>
          </button>

        <!-- ⚡ Actions hub -->
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5
                 text-sm font-medium text-indigo-600 hover:text-indigo-900
                 bg-white/60 hover:bg-indigo-50 border border-indigo-200 hover:border-indigo-300
                 shadow-sm transition-all duration-150 select-none"
          title="Open Actions panel (⌘A)"
          aria-label="Open Actions hub"
          @click="toggleMenu()"
        >
          ⚡ Actions
        </button>

        <!-- 🤖 Agents — also in Plan Crest Row 1 right cluster; duplicated here
             so it is always visible in the breadcrumb bar which Tom uses as his
             primary control row. Click opens the Maria Board Hub. -->
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5
                 text-sm font-medium text-emerald-700 hover:text-emerald-900
                 bg-white/60 hover:bg-emerald-50 border border-emerald-300 hover:border-emerald-400
                 shadow-sm transition-all duration-150 select-none"
          title="Open Agent Menu — Maria analyses board documents for governance intelligence (decisions, authority gaps, patterns)"
          aria-label="Open Agent Menu"
          @click="agentMenuOpen = true"
        >
          🦾 Agents
        </button>
        </div>

        <!-- Tip caption — Tom 2026-06-03: "a text explaining that we can skip
             further back and forth by clicking on the Stage steps". Italic +
             small so it does not compete with the pin buttons above. Hidden
             at the boundaries where neither Back nor Next exist. -->
        <p
          v-if="prevStageInfo || nextStageInfo"
          class="text-[10px] italic text-slate-500 px-1 leading-snug"
        >
          Tip — click any numbered stage tile above to jump anywhere
          in the planning cycle, forward or back.
        </p>
      </div>

      <!-- Session restore banner — shown when no auth nav bar (Supabase not configured) -->
      <div
        v-if="sessionRestored && !supabaseConfigured"
        class="w-full max-w-2xl mx-auto mb-3 flex items-center gap-3 px-4 py-2
               bg-amber-50 border border-amber-200 rounded-lg shadow-sm"
        role="status"
        aria-live="polite"
      >
        <span class="text-amber-600 text-base shrink-0" aria-hidden="true">↩</span>
        <span class="flex-1 text-sm text-amber-800">Session restored from your last visit</span>
        <button
          type="button"
          class="shrink-0 min-h-[44px] px-3 rounded-full border border-amber-300 bg-white
                 text-xs font-medium text-amber-700 hover:bg-amber-100
                 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
                 focus-visible:outline-amber-500 transition-colors"
          aria-label="Start fresh"
          @click="startFresh"
        >
          ↺ Start fresh
        </button>
      </div>

      <!-- Feature #51: Collaboration conflict banner — shown when remote edits conflict -->
      <div
        v-if="collabConflicts.length > 0"
        class="w-full max-w-2xl mx-auto mb-3 flex items-center gap-3 px-4 py-2
               bg-yellow-50 border border-yellow-300 rounded-lg shadow-sm"
        role="alert"
        aria-live="polite"
      >
        <span class="text-yellow-600 text-lg shrink-0 animate-pulse" aria-hidden="true">⚠</span>
        <span class="flex-1 text-sm font-medium text-yellow-800">
          Conflict detected — remote edit conflicts with your spec
        </span>
        <button
          type="button"
          class="min-h-[44px] min-w-[44px] flex items-center justify-center
                 text-yellow-700 hover:text-yellow-900 focus:outline-none focus:ring-2
                 focus:ring-yellow-500 rounded text-lg font-bold"
          aria-label="Dismiss"
          @click="clearCollabConflicts"
        >
          ×
        </button>
      </div>

      <!-- Auth nav bar — only shown when Supabase is configured -->
      <div
        v-if="supabaseConfigured && user"
        class="w-full max-w-2xl mx-auto mb-4 flex items-center gap-3
               px-4 py-2 bg-white rounded-lg shadow-sm border border-gray-200"
      >
        <!-- User identity — shrinks to make room for buttons -->
        <div class="flex flex-col min-w-0 shrink-0">
          <span class="text-[10px] font-bold text-indigo-600 uppercase tracking-widest leading-none mb-0.5">SEM Plan User</span>
          <span class="text-xs text-gray-500 truncate max-w-[120px]">{{ user.email }}</span>
        </div>

        <!-- Buttons row — flex-wrap so they spill to a second line instead of going off-screen -->
        <div class="flex flex-wrap items-center gap-2 flex-1 justify-end">
          <!-- Get A Plan — unified import / history / merge panel.
               DD-001 (2026-05-13) — uses the canonical Get glyph `[*]→*`. -->
          <button
            type="button"
            class="h-9 px-2.5 rounded-lg bg-indigo-100 text-indigo-700 text-xs font-medium
                   hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500
                   transition-colors duration-150 shrink-0 inline-flex items-center gap-1.5"
            aria-label="Get A Plan"
            title="Get A Plan — load a saved Planguage plan into your workspace, or import new planning data"
            @click="specInputOpen = true"
          >
            <!-- DD-011/DD-012: GetGlyph [*]→* is the correct Keyed Action Glyph for "retrieve a plan".
                 SEM App identity icon is brand-only (h-20 hero size); not appropriate as a 12px nav button icon.
                 GetGlyph already imported at top of file. 2026-06-01 fix. -->
            <GetGlyph class="h-3 w-auto shrink-0" aria-hidden="true" />
            <span>Get A Plan</span>
          </button>
          <!-- Feature #17: Compare button — only visible in stage 1 -->
          <button
            v-if="stage === 1"
            type="button"
            class="h-9 px-2.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-medium
                   hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500
                   transition-colors duration-150 shrink-0 inline-flex items-center gap-1.5"
            aria-label="Compare"
            title="Compare — side-by-side view of two plan models. See which solution scores better against your Values and Constraints."
            @click="comparisonMode = true"
          >
            <!-- Color Glyph for 'comparison': Value glyph (violet) — comparison is value-assessment.
                 :no-detail-click per DD-013 (parent owns click for comparison action). -->
            <PlTypeIcon pl-type="value" size="sm" class="shrink-0" />
            <span>Compare</span>
          </button>
          <!-- Plan History — also in the persistent plan identity bar + in Actions menu -->
          <div class="relative shrink-0">
            <button
              type="button"
              class="h-9 px-2.5 rounded-lg bg-indigo-100 text-indigo-700 text-xs font-medium
                     hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500
                     transition-colors duration-150 inline-flex items-center gap-1.5"
              aria-label="Spec History"
              title="History — browse all saved plan versions, model versions, contracts and Maria analyses. Load any previous version back into your workspace."
              @click="historyOpen = true"
            >
              <!-- Color Glyph for 'history': Evo Step glyph (amber) — encodes past cycles via '<' (past anchor).
                   :no-detail-click per DD-013 (parent owns click for history panel).
                   Tom 2026-06-03 — explicit title overrides PlTypeIcon's canonical Evo-Step label. -->
              <PlTypeIcon pl-type="evo-step" size="sm" title="Version History" class="shrink-0" />
              <span>History</span>
            </button>
            <span
              v-if="specHistory.length > 0"
              class="absolute -top-1 -right-1 h-4 min-w-[1rem] rounded-full bg-indigo-500 text-white
                     text-[10px] font-bold flex items-center justify-center px-0.5 pointer-events-none"
              aria-hidden="true"
            >
              {{ specHistory.length }}
            </span>
          </div>
          <!-- Feature #77: Onboarding tour button -->
          <button
            type="button"
            class="h-9 px-2.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-600 text-xs font-medium
                   flex items-center gap-1
                   focus:outline-none focus:ring-2 focus:ring-slate-400 transition-colors duration-150 shrink-0"
            aria-label="Tour"
            @click="tourOpen = true"
          >
            <span aria-hidden="true">?</span> Tour
          </button>
          <!-- Sharpening Cycles — available whenever a spec is loaded -->
          <SharpenDropdown
            ref="sharpenDropdownAuthRef"
            v-if="currentSpec"
            @open-sharpen="handleOpenSharpen"
          />
          <!-- Start fresh — opens FreshStartMenu (4 graduated options) -->
          <button
            type="button"
            :class="[
              'h-9 px-2.5 rounded-full border text-xs font-medium shrink-0 transition-all duration-150',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
              sessionRestored
                ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 focus-visible:outline-amber-500'
                : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-gray-400',
            ]"
            aria-label="Start fresh — open reset options"
            :title="sessionRestored
              ? 'Clear restored session and start with a new blank form'
              : 'Clear everything and start with a blank form'"
            @click="freshStartOpen = true"
          >↺ Start fresh</button>
          <!-- 🧙 Guided Wizard button (auth bar) — hidden at narrow widths to save space -->
          <button
            type="button"
            class="hidden md:flex h-9 px-2.5 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-medium
                   items-center gap-1
                   focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors duration-150 shrink-0"
            aria-label="Guided Wizard"
            title="Step-by-step guided spec creation"
            @click="wizardOpen = true"
          >🧙 Guided</button>
          <!-- ⌘F Find button — pinned; never hidden -->
          <button
            type="button"
            class="h-9 px-2.5 rounded-lg bg-gray-100 text-gray-600 text-xs font-medium
                   hover:bg-gray-200 flex items-center gap-1
                   focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors duration-150 shrink-0"
            aria-label="Find features (Cmd+F)"
            title="Find features (⌘F)"
            @click="_toggleSearch()"
          >
            <svg class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clip-rule="evenodd" />
            </svg>
            <span class="hidden sm:inline">Find</span>
            <kbd class="hidden sm:inline-flex items-center px-1 rounded bg-white text-gray-500 font-mono text-[9px] leading-none py-0.5 ring-1 ring-gray-300">⌘F</kbd>
          </button>
          <!-- ⌥I Illuminate button — pinned next to Find; violet-tinted to signal it is
               the Illuminate feature's entry point. Tom 2026-05-17 discoverability pass.
               Renamed Define → Illuminate 2026-05-18. -->
          <button
            type="button"
            class="h-9 px-2.5 rounded-lg bg-violet-100 text-violet-700 text-xs font-medium
                   hover:bg-violet-200 flex items-center gap-1
                   focus:outline-none focus:ring-2 focus:ring-violet-500 transition-colors duration-150 shrink-0"
            aria-label="Illuminate a Planguage term (Opt+I)"
            title="Illuminate any term — select text first, or click to type one  (⌥I)"
            @click="openDefineSearch()"
          >
            <span class="text-sm leading-none" aria-hidden="true">💡</span>
            <span class="hidden sm:inline">Illuminate</span>
            <kbd class="hidden sm:inline-flex items-center px-1 rounded bg-violet-200 text-violet-600 font-mono text-[9px] leading-none py-0.5 ring-1 ring-violet-300">⌥I</kbd>
          </button>
          <button
            type="button"
            class="h-9 px-2.5 flex items-center justify-center
                   text-xs text-gray-500 hover:text-gray-700
                   focus-visible:outline focus-visible:outline-2
                   focus-visible:outline-offset-2 focus-visible:outline-blue-600
                   transition-colors duration-150 shrink-0"
            aria-label="Sign Out"
            @click="handleSignOut"
          >
            Sign out
          </button>
        </div>
      </div>

      <!-- Feature #8: Prominent demo button in mock mode (no Supabase) -->
      <div
        v-if="!supabaseConfigured && !isDemoRunning && stage === 1 && !currentSpec"
        class="w-full max-w-2xl mx-auto px-4 mb-4 flex items-center gap-3"
      >
        <button
          type="button"
          aria-label="See a Demo"
          class="bg-indigo-600 text-white rounded-lg px-3 py-1.5 text-xs font-medium
                 flex items-center gap-1.5
                 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                 transition-colors duration-150"
          @click="launchDemo"
        >
          ▶ See a demo
        </button>
        <!-- Get A Plan — unified import / history / merge panel (mock mode) -->
        <button
          type="button"
          class="h-9 px-2.5 rounded-lg bg-indigo-100 text-indigo-700 text-xs font-medium
                 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500
                 transition-colors duration-150 shrink-0 inline-flex items-center gap-1.5"
          aria-label="Get A Plan"
          title="Get A Plan — load a saved Planguage plan into your workspace, or import new planning data"
          @click="specInputOpen = true"
        >
          <!-- DD-011/DD-012: GetGlyph [*]→* — same fix as auth mode above. 2026-06-01. -->
          <GetGlyph class="h-3 w-auto shrink-0" aria-hidden="true" />
          <span>Get A Plan</span>
        </button>
        <!-- Feature #17: Compare button in mock mode -->
        <button
          type="button"
          class="h-9 px-2.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-medium
                 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500
                 transition-colors duration-150 shrink-0 inline-flex items-center gap-1.5"
          aria-label="Compare"
          title="Compare — side-by-side view of two plan models. See which solution scores better against your Values and Constraints."
          @click="comparisonMode = true"
        >
          <PlTypeIcon pl-type="value" size="sm" class="shrink-0" />
          <span>Compare</span>
        </button>
        <!-- Plan History — also in the persistent plan identity bar + in Actions menu -->
        <div class="relative shrink-0">
          <button
            type="button"
            class="h-9 px-2.5 rounded-lg bg-indigo-100 text-indigo-700 text-xs font-medium
                   hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500
                   transition-colors duration-150 inline-flex items-center gap-1.5"
            aria-label="Spec History"
            title="History — browse all saved plan versions, model versions, contracts and Maria analyses. Load any previous version back into your workspace."
            @click="historyOpen = true"
          >
            <PlTypeIcon pl-type="evo-step" size="sm" title="Version History" class="shrink-0" />
            <span>History</span>
          </button>
          <span
            v-if="specHistory.length > 0"
            class="absolute -top-1 -right-1 h-4 min-w-[1rem] rounded-full bg-indigo-500 text-white
                   text-[10px] font-bold flex items-center justify-center px-0.5 pointer-events-none"
            aria-hidden="true"
          >
            {{ specHistory.length }}
          </span>
        </div>
        <!-- 🧙 Guided Wizard button (mock mode) — hidden on narrow viewports -->
        <button
          type="button"
          class="hidden md:flex h-9 px-2.5 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-medium
                 items-center gap-1
                 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors duration-150 shrink-0"
          aria-label="Guided Wizard"
          title="Step-by-step guided spec creation"
          @click="wizardOpen = true"
        >🧙 Guided</button>
        <!-- ⌘F Find button (mock mode) — pinned; never hidden -->
        <button
          type="button"
          class="h-9 px-2.5 rounded-lg bg-gray-100 text-gray-600 text-xs font-medium
                 hover:bg-gray-200 flex items-center gap-1
                 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors duration-150 shrink-0"
          aria-label="Find features (Cmd+F)"
          title="Find features (⌘F)"
          @click="_toggleSearch()"
        >
          <svg class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clip-rule="evenodd" />
          </svg>
          <span class="hidden sm:inline">Find</span>
          <kbd class="hidden sm:inline-flex items-center px-1 rounded bg-white text-gray-500 font-mono text-[9px] leading-none py-0.5 ring-1 ring-gray-300">⌘F</kbd>
        </button>
        <!-- ⌥I Illuminate button (mock mode) — violet-tinted, paired with Find.
             Tom 2026-05-17 discoverability pass. Renamed Define → Illuminate 2026-05-18. -->
        <button
          type="button"
          class="h-9 px-2.5 rounded-lg bg-violet-100 text-violet-700 text-xs font-medium
                 hover:bg-violet-200 flex items-center gap-1
                 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-colors duration-150 shrink-0"
          aria-label="Illuminate a Planguage term (Opt+I)"
          title="Illuminate any term — select text first, or click to type one  (⌥I)"
          @click="openDefineSearch()"
        >
          <span class="text-sm leading-none" aria-hidden="true">💡</span>
          <span class="hidden sm:inline">Illuminate</span>
          <kbd class="hidden sm:inline-flex items-center px-1 rounded bg-violet-200 text-violet-600 font-mono text-[9px] leading-none py-0.5 ring-1 ring-violet-300">⌥I</kbd>
        </button>
        <!-- Feature #77: Onboarding tour button in mock mode -->
        <button
          type="button"
          class="bg-slate-200 hover:bg-slate-300 h-9 w-9 rounded-full text-slate-600 font-bold text-sm
                 flex items-center justify-center
                 focus:outline-none focus:ring-2 focus:ring-slate-400 transition-colors duration-150 shrink-0"
          aria-label="Tour"
          @click="tourOpen = true"
        >
          ?
        </button>
        <!-- Sharpening Cycles dropdown — available whenever a spec is loaded -->
        <SharpenDropdown
          ref="sharpenDropdownMockRef"
          v-if="currentSpec"
          @open-sharpen="handleOpenSharpen"
        />
      </div>

      <!-- Feature #15: Workflow progress indicator — replaced by PlanningStageBar (11-stage tile bar).
           ValueCounter kept as import for potential future use in compact contexts. -->

      <!-- Feature #17: Comparison Mode — replaces normal workflow when active -->
      <ComparisonMode
        v-if="comparisonMode"
        @close="comparisonMode = false"
      />

      <!-- Stage 1: SEM Entry Form + generated spec -->
      <template v-else-if="stage === 1 || !currentSpec">

        <!-- ClarifyView sub-stage (precise mode) -->
        <ClarifyView
          v-if="stage1Sub === 'questions' && pendingPayload"
          :payload="pendingPayload"
          :questions="clarifyQuestions"
          :loading="clarifyLoading"
          :generating="sdkLoading"
          @generate="handleClarifiedGenerate"
          @skip="handleClarifySkip"
          @back="handleClarifyBack"
        />

        <!-- Normal form sub-stage -->
        <template v-else>
          <!-- ── Front-page identity header ── -->
          <div class="w-full max-w-2xl mx-auto px-4 mb-6 flex items-center gap-5">
            <img
              src="/icon-sem-app.svg"
              alt="SEM App"
              :title="`SEM App — Keeney three-level hierarchy (Value-Focused Thinking, 1992)\n\n▲ FUNDAMENTAL · amber\n  Objectives given from above — environment, parent org, regulations\n  We operate within these; cannot unilaterally redesign them\n\n● STRATEGIC · violet  ← this level (the hero row)\n  Our own plan — the Ends and Values we own and are accountable for\n\n▼ MEANS · emerald\n  What supports us from below — Functions and Solutions\n  These deliver our Strategic Ends upward to the stakeholder\n\n──────────────────────────────\nperson / §  =  Stakeholder (animate or inanimate)\n←O←         =  End: target that receives and delivers value\nO←          =  Means: source that fires value into the target`"
              class="h-20 w-20 flex-shrink-0 rounded-2xl shadow-lg cursor-help"
            />
            <div>
              <h1 class="text-3xl font-bold text-gray-900 tracking-tight leading-tight">SEM App</h1>
              <p class="text-sm text-gray-500 mt-1">Stakes · Ends · Means → Planguage Specification</p>
              <img
                src="/symbol-sem.svg"
                alt="Stakeholder fires means at ends"
                :title="`S · E · M\nStakeholder · Ends · Means\n\nThe stakeholder fires Means at Ends — value is then delivered to the one who needs it\n\nS  =  person (animate stakeholder)\n   or  §  (inanimate: law, data, standard, contract)\nE  =  ←O←  target — receives value from M, delivers it to S\nM  =  O←   source — fires value into the target\n\nTom Gilb, Competitive Engineering (2005)\nKeeney, Value-Focused Thinking (1992)`"
                class="mt-2 h-8 opacity-60 cursor-help"
              />
            </div>
          </div>

          <!-- ── Spec-review mode: a spec exists — hide the entry form ──────────
               Prevents the confusing state where a blank entry form appears
               alongside a ready spec (e.g. after "Back to spec" from stage 2,
               after wizard flow, or after session restore at stage 1). -->
          <template v-if="currentSpec">
            <div ref="specOutputEl" class="w-full max-w-xl isolate">
              <SpecOutput
                :loading="sdkLoading"
                :error="sdkError"
                :spec="currentSpec"
                :markdown="markdown"
                :raw-input="originalInput"
                :on-ambitious-spec="onAmbitiousSpec"
                :sharpened-entry-ids="sharpenedEntryIds"
                :sharpen-summary="sharpenSummary"
                :generated-at="specGeneratedAt"
                :planning-stage="planningStage"
                @lean-spec-selected="onLeanSpecSelected"
                @open-collaborator="collaboratorOpen = !collaboratorOpen"
                @rewrite-copy="onRewriteCopy"
                @rewrite-replace="onRewriteReplace"
                @rewrite-entry="onRewriteEntry"
                @rewrite-entry-fix="onRewriteEntry"
                @open-editor="({ tab, entryId }) => _openSpecEditor({ tab, entryId })"
                @open-edit-info="editInfoOpen = true"
              />
            </div>
            <!-- AmuseMeButton now lives inside SpecOutput.vue (line 55) so it is not
                 duplicated here. SpecOutput renders it whenever :loading is true. -->

            <!-- Dark `PlanModelBar` removed 2026-05-12 per Tom: it duplicated
                 the persistent purple Plan Identity Bar at the top of the page
                 (same plan name, version, sharpen rounds, 🔑/💡/⌨️ people
                 chips and save state). "We do not need the owner data on 2
                 bars, clutter." All its functions are reachable from the
                 purple bar or the Actions menu / ⌘F Find palette:
                   - Rename plan          → click name in purple bar
                   - Edit version         → renamePopover
                   - People editing       → 🔑/💡/⌨️ chips in purple bar
                   - 📂 Load other plan   → Actions menu · ⌘F "Plan Models"
                   - 📊 Compare           → Actions menu · ⌘F "Compare"
                   - 💾 Export .json      → ⌘F "Export plan model"
                   - 💾 Save now          → already in purple bar -->


            <!-- ── Sharpening Cycles — shown between spec and Plan button.
                 The planner iterates over dimensions until "Sharp Enough" is
                 clicked, which sets sharpeningDone and reveals Plan Evo Steps. -->
            <SharpenPanel
              v-if="!sdkLoading && !sharpeningDone"
              :spec="currentSpec"
              @sharpened="onSpecSharpened"
              @done="sharpeningDone = true"
              @open-global-priority="globalPriorityOpen = true"
              @open-priority-info="priorityInfoOpen = true"
            />

            <!-- Deliberate advance gate — only shown after planner clicks "Sharp Enough".
                 Requires an explicit, named decision to move out of Spec/Sharpen into Evo. -->
            <div v-if="!sdkLoading && sharpeningDone" class="w-full max-w-xl mt-4 space-y-2">
              <!-- Sharpening summary pill so the planner sees what was done -->
              <div class="flex items-center gap-2 px-1">
                <span class="text-amber-500 text-sm" aria-hidden="true">✅</span>
                <span class="text-xs text-slate-500">
                  {{ sharpenRounds.length }} sharpening round{{ sharpenRounds.length !== 1 ? 's' : '' }} complete
                  — plan version {{ specModel?.version ?? '—' }}
                </span>
              </div>

              <!-- Explicit permission button — deliberate label, no abbreviations -->
              <button
                type="button"
                class="w-full flex items-center justify-between gap-3 min-h-[52px] rounded-xl
                       bg-indigo-600 px-5 py-3
                       text-white font-semibold
                       hover:bg-indigo-700 active:bg-indigo-800
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                       transition-colors"
                aria-label="Done Sharpening the Plan — move on to Evo Value Delivery"
                @click="goToPlanStage"
              >
                <span class="text-sm leading-snug text-left">
                  Done Sharpening the Plan<br>
                  <span class="text-indigo-200 font-normal text-xs">move on to Evo Value Delivery</span>
                </span>
                <span class="text-lg shrink-0" aria-hidden="true">→</span>
              </button>

              <!-- Audit Trail — optional review before committing to planning -->
              <button
                v-if="specHistory.length > 0"
                type="button"
                class="w-full flex items-center justify-center gap-2 min-h-[40px] rounded-lg border border-slate-200
                       bg-white text-slate-600 text-sm font-medium
                       hover:bg-slate-50 hover:border-slate-300
                       focus:outline-none focus:ring-2 focus:ring-slate-400 transition-colors"
                aria-label="Open Bullock audit trail — review all changes since last baseline"
                @click="bullockOpen = true"
              >
                <span aria-hidden="true">🗂️</span>
                Audit Trail
              </button>

              <!-- r26 (2026-05-19): "Sharpen more" escape hatch.
                   Once sharpeningDone=true the inline SharpenPanel hides and the
                   planner has no in-page way to resume sharpening without using
                   the nav-bar Sharpen dropdown. This button resets sharpeningDone
                   so the amber sharpening panel re-appears inline. -->
              <button
                type="button"
                class="w-full flex items-center justify-center gap-1.5 min-h-[36px] rounded-lg
                       border border-amber-200 bg-amber-50 text-amber-700 text-sm font-medium
                       hover:bg-amber-100 hover:border-amber-300
                       focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors"
                aria-label="Return to Sharpening Cycles — do more sharpening rounds"
                @click="sharpeningDone = false"
              >
                <span aria-hidden="true">🔪</span>
                Sharpen more
              </button>
            </div>

            <!-- Secondary: discard current spec and start a new one -->
            <div class="w-full max-w-xl mt-3 text-center">
              <button
                type="button"
                class="text-sm text-gray-400 hover:text-gray-600 underline underline-offset-2 min-h-[44px] px-3 focus:outline-none focus:ring-2 focus:ring-indigo-400 rounded"
                aria-label="Start new spec"
                @click="startFresh"
              >
                ↺ Start new spec
              </button>
            </div>
          </template>

          <!-- ── Entry mode: no spec yet — show the form ── -->
          <template v-else>
            <!-- Analysis mode toggle -->
            <div class="w-full max-w-2xl mx-auto px-4 mb-2 flex items-center gap-3">
              <span class="text-xs text-gray-400 font-medium shrink-0">Mode:</span>
              <div
                class="flex rounded-lg border border-gray-200 bg-gray-100 p-0.5"
                role="group"
                aria-label="Analysis mode"
              >
                <button
                  type="button"
                  :class="[
                    'min-h-[32px] px-3 text-xs font-medium rounded-md transition-colors duration-150',
                    analysisMode === 'quick' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  ]"
                  aria-label="Just do it"
                  @click="analysisMode = 'quick'"
                >⚡ Just do it</button>
                <button
                  type="button"
                  :class="[
                    'min-h-[32px] px-3 text-xs font-medium rounded-md transition-colors duration-150',
                    analysisMode === 'precise' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  ]"
                  aria-label="Ask for precision"
                  @click="analysisMode = 'precise'"
                >🎯 Ask for precision</button>
              </div>
              <span v-if="analysisMode === 'precise'" class="text-xs text-blue-500">
                AI will ask 3–5 questions before generating
              </span>
            </div>

            <SEMEntryForm
              ref="semEntryFormRef"
              :key="formResetKey"
              :generating="sdkLoading"
              @submit="handleSubmit"
              @wizard="wizardOpen = true"
              @stage-change="formSubStage = $event"
              @spec-import="onSpecFileImport"
              @go-back="handleFormGoBack"
            />
            <!-- SpecOutput shown here for loading/error feedback while API call is in flight -->
            <div ref="specOutputEl" class="w-full max-w-xl isolate">
              <SpecOutput
                :loading="sdkLoading"
                :error="sdkError"
                :spec="currentSpec"
                :markdown="markdown"
                :raw-input="originalInput"
                :on-ambitious-spec="onAmbitiousSpec"
                :sharpened-entry-ids="sharpenedEntryIds"
                :sharpen-summary="sharpenSummary"
                :generated-at="specGeneratedAt"
                :planning-stage="planningStage"
                @lean-spec-selected="onLeanSpecSelected"
                @open-collaborator="collaboratorOpen = !collaboratorOpen"
                @rewrite-copy="onRewriteCopy"
                @rewrite-replace="onRewriteReplace"
                @rewrite-entry="onRewriteEntry"
                @rewrite-entry-fix="onRewriteEntry"
                @open-editor="({ tab, entryId }) => _openSpecEditor({ tab, entryId })"
                @open-edit-info="editInfoOpen = true"
              />
            </div>

            <!-- AmuseMeButton now lives inside SpecOutput.vue (line 55) so it is not
                 duplicated here. SpecOutput renders it whenever :loading is true. -->

            <!-- Copyright footer — always visible at the bottom of Stage 1 -->
            <div class="w-full max-w-xl mt-8 mb-2 flex justify-center">
              <button
                type="button"
                class="text-[11px] text-gray-400 hover:text-gray-600 transition-colors
                       focus:outline-none focus:ring-1 focus:ring-gray-300 rounded px-1"
                @click="copyrightPanelOpen = true"
              >{{ _copyrightShortNotice }} · Copyright &amp; Attribution</button>
            </div>
          </template>
        </template>

      </template>

      <!-- Stage 2: Evo Step Planner -->
      <template v-else-if="stage === 2 && currentSpec">
        <div class="w-full max-w-2xl mb-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            class="flex items-center gap-3 px-5 py-3 rounded-2xl min-h-[52px]
                   bg-gradient-to-r from-violet-500 to-indigo-500 text-white
                   font-semibold text-sm shadow-md shadow-indigo-200/70
                   hover:from-violet-600 hover:to-indigo-600 hover:shadow-lg
                   focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2
                   transition-all duration-200 active:scale-[0.98]"
            aria-label="Back to Stage 1 · Spec & Sharpening"
            @click="goToStage1()"
          >
            <span class="text-xl leading-none" aria-hidden="true">←</span>
            <div class="text-left">
              <div class="text-[10px] font-normal opacity-75 uppercase tracking-wide">Return to Stage 1</div>
              <div class="font-bold leading-tight">Spec &amp; Sharpening</div>
            </div>
          </button>
          <button
            v-if="currentSpec"
            type="button"
            class="flex items-center gap-2 px-4 py-2.5 rounded-xl min-h-[44px]
                   bg-white border border-indigo-200 text-indigo-700 text-sm font-medium
                   hover:bg-indigo-50 hover:border-indigo-300
                   focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-1
                   transition-all duration-150 shadow-sm"
            aria-label="Open Value Flow Diagram"
            @click="valueFlowOpen = true"
          >
            <!-- VFD 6-column sparkline -->
            <svg width="44" height="20" viewBox="0 0 44 20" fill="none" aria-hidden="true">
              <rect x="0"  y="2" width="5" height="16" rx="1.5" fill="#374151"/>
              <rect x="8"  y="2" width="5" height="16" rx="1.5" fill="#ca8a04"/>
              <rect x="16" y="2" width="5" height="16" rx="1.5" fill="#ea580c"/>
              <rect x="24" y="2" width="5" height="16" rx="1.5" fill="#7c3aed"/>
              <rect x="32" y="2" width="5" height="16" rx="1.5" fill="#16a34a"/>
              <rect x="40" y="2" width="4" height="16" rx="1.5" fill="#2563eb"/>
              <line x1="5"  y1="10" x2="8"  y2="10" stroke="#d1d5db" stroke-width="1"/>
              <line x1="13" y1="10" x2="16" y2="10" stroke="#d1d5db" stroke-width="1"/>
              <line x1="21" y1="10" x2="24" y2="10" stroke="#d1d5db" stroke-width="1"/>
              <line x1="29" y1="10" x2="32" y2="10" stroke="#d1d5db" stroke-width="1"/>
              <line x1="37" y1="10" x2="40" y2="10" stroke="#d1d5db" stroke-width="1"/>
            </svg>
            <span>Value Flow</span>
          </button>
          <!-- MultiVision button — Stage 2 action bar -->
          <button
            v-if="currentSpec"
            type="button"
            class="flex items-center gap-2 px-4 py-2.5 rounded-xl min-h-[44px]
                   text-white text-sm font-semibold
                   hover:opacity-90 hover:shadow-md
                   focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-1
                   transition-all duration-150 shadow-sm"
            style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)"
            aria-label="Open MultiVision — balance Values and Resources"
            title="⚡ MultiVision — slide Value ambition and Resource budget sliders, see consequence live"
            @click="openMultiVision()"
          >
            <span class="text-base" aria-hidden="true">⚡</span>
            <span>MultiVision</span>
          </button>
        </div>
        <!-- Dark `PlanModelBar` removed 2026-05-12 — see note in stage-1
             section above. The purple Plan Identity Bar at top of page
             already provides plan name, version, sharpen rounds, the three
             🔑/💡/⌨️ people chips, save state, history and restart. -->
        <EvoPlanView
          :spec-block="currentSpec"
          :raw-input="originalInput"
          @confirmed="onPlanConfirmed($event)"
          @sharpen-plan="handleSharpenPlan"
          @open-visualise="({ tab }) => { _vizInitialTab = tab; visualiseOpen = true }"
          @open-heatlane="heatLaneOpen = true"
          @open-evo-simulator="evoSimulatorOpen = true"
          @open-editor="({ tab }) => _openSpecEditor({ tab })"
        />
      </template>

      <!-- Stage 10 · Resources — dedicated view (Tom 2026-06-04 verbatim:
           *"I think these need removal, and I am awaiting resource sharpening
           etc, but i cannot see it"*).  Previously Stage 10 in the planning
           bar fell through to the stage===3 (Evo Impact) body which showed
           Value Flow + Evo step task lists — content inappropriate for the
           Resources stage and visually noisy.  This block takes precedence
           over stage===3 when planningStage===10 so the user sees Resources
           content directly: large Stage 10 pin, three cost summary cards
           (Calendar / Capital / V-C ratios from prior stages), prominent CTA
           opening the ResourcesSharpenPanel with its 9 dimensions + 5
           Advanced Tools, status note that R. entry persistence (Phase 1)
           is live and Phase 2 (Claudian write-back) is queued.  Top + bottom
           share mirrors (Copy / Email) + forward → Stage 11 button. -->
      <template v-else-if="planningStage === 10 && currentSpec">
        <!-- Top export bar — single ExportSpecPin (Tom 2026-06-05: "single initial pin called
             'Export Specs'... copy to clipboard is automatic... 20 seconds the menu fades") -->
        <div class="w-full max-w-3xl mb-4">
          <ExportSpecPin
            :has-spec="!!currentSpec"
            :spec-name="specModel?.name || 'Spec'"
            @copy="autoCopyPlan()"
            @email="emailPlan()"
            @download="downloadPlan()"
            @message="messagePlan()"
            @copy-for-chat="copyPlanForChat()"
          />
        </div>

        <div class="w-full max-w-3xl flex flex-col gap-5">
          <!-- Header banner (info only — CTA moved below as large centred button) -->
          <div class="rounded-2xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-50 p-5 shadow-sm">
            <div class="flex items-center gap-3">
              <div class="inline-flex items-center gap-3 rounded-2xl pl-3 pr-5 py-2 select-none
                          bg-gradient-to-r from-emerald-500 to-teal-500 shadow ring-2 ring-emerald-300/40">
                <span class="text-[11px] font-extrabold leading-none bg-black/60 text-white rounded-md px-2 py-1.5"
                      aria-hidden="true">10</span>
                <span class="flex flex-col items-start leading-tight">
                  <span class="text-[9px] font-semibold uppercase tracking-[0.15em] text-emerald-100">Stage Now</span>
                  <span class="text-base font-extrabold text-white">Resources</span>
                </span>
              </div>
              <div>
                <h2 class="text-lg font-extrabold text-emerald-900">Resources Stage</h2>
                <p class="text-[12px] text-emerald-800/80 leading-snug max-w-md">
                  Estimate and allocate Resources (time, people, money, and other budgets).
                  Review Value-to-Resource ratios, assign calendar and capital budgets,
                  confirm all Constraints are respected before Export.
                </p>
              </div>
            </div>
          </div>

          <!-- Cost Engineering reference — hero cover + compact strip -->
          <div class="rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
            <!-- Hero cover — full card width -->
            <!-- object-contain: full cover visible, no crop. No max-height cap — let the
                 natural aspect ratio determine height. Tom 2026-06-06: "Prefer full cover." -->
            <img
              src="https://d2sofvawe08yqg.cloudfront.net/costengineering/s_featured2x?1719929333"
              alt="Cost Engineering book cover — Tom Gilb 2023"
              class="w-full block object-contain"
              loading="lazy"
            />
            <!-- Compact info strip below cover -->
            <div class="flex items-center justify-between gap-2 px-3 py-2 flex-wrap">
              <div class="min-w-0">
                <span class="font-bold text-amber-900 text-sm">Cost Engineering</span>
                <span class="text-amber-700/70 text-[11px] ml-2">Gilb · 2023</span>
              </div>
              <div class="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  class="text-[11px] font-bold text-amber-800 bg-amber-100 border border-amber-300
                         rounded-lg px-2.5 py-1 hover:bg-amber-200 transition-all whitespace-nowrap"
                  title="Open Cost Engineering Tool — Design to Cost / Value / Constraint, static and dynamic (Evo Step) modes"
                  @click="costEngineeringOpen = true"
                >📐 Open Tool →</button>
                <a
                  href="https://www.researchgate.net/publication/406117055_Cost_Engineering_MASTER"
                  target="_blank" rel="noopener noreferrer"
                  class="text-[11px] font-bold text-amber-800 bg-amber-100 border border-amber-300
                         rounded-lg px-2.5 py-1 hover:bg-amber-200 transition-all no-underline whitespace-nowrap"
                  title="Cost Engineering MASTER — free PDF on ResearchGate (Tom Gilb, 2023)"
                >📄 Free PDF ↗</a>
                <a
                  href="https://leanpub.com/costengineering"
                  target="_blank" rel="noopener noreferrer"
                  class="text-[11px] font-bold text-amber-800 bg-amber-100 border border-amber-300
                         rounded-lg px-2.5 py-1 hover:bg-amber-200 transition-all no-underline whitespace-nowrap"
                  title="Cost Engineering on Leanpub — Tom Gilb 2023"
                >Leanpub ↗</a>
              </div>
            </div>
          </div>

          <!-- Resources Stage Tool Pins — Tom 2026-06-05: "clustered pins showing tool options
               … Improve Plan Resources / Analyze Planned Resources / Visualize Planned Resources
               … in a Rectangle with great Pin Icons" -->
          <div class="rounded-2xl border-2 border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-md">
            <div class="flex items-center gap-3 mb-4">
              <!-- Section header icon — bigger, hover + dblclick for glyph panel -->
              <button
                type="button"
                class="flex-none focus:outline-none focus:ring-2 focus:ring-violet-400 rounded-lg"
                title="Planguage type glyph R. — Resource entry (time, people, money, other budgets) · Double-click for glyph history and details"
                @dblclick.stop="openGlyphPanel('resource')"
              >
                <PlResourceIcon class="w-8 h-8" />
              </button>
              <h3 class="text-sm font-extrabold text-slate-700 uppercase tracking-wider">Resources Stage Tools</h3>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">

              <!-- ── Pin 1: Improve Plan Resources ─────────────────────────── -->
              <div class="rounded-xl border-2 border-emerald-300 overflow-hidden shadow-sm">
                <!-- Pin header -->
                <div class="bg-gradient-to-br from-emerald-500 to-teal-600 px-4 py-6 text-white">
                  <!-- EditGlyph [*]→[**] spans full pin width — horizontal glyph designed
                       for wide display, not square. w-full h-12 renders at full card width,
                       48px tall — much more dramatic than a small square icon. -->
                  <button
                    type="button"
                    class="w-full focus:outline-none focus:ring-2 focus:ring-white/60 rounded-lg
                           hover:bg-white/10 transition-colors duration-100 px-1 py-2"
                    title="Planguage keyed action glyph [*]→[**] — existing item transformed to improved version · Improve / Augment / Edit · Double-click for glyph history and details"
                    @dblclick.stop="openGlyphPanel('resource')"
                  >
                    <EditGlyph class="w-full text-white" style="height:48px" />
                  </button>
                  <div class="text-center mt-3">
                    <span class="text-[9px] font-bold uppercase tracking-[0.18em] opacity-80">Improve</span>
                    <div class="text-[14px] font-extrabold leading-tight mt-0.5">Plan Resources</div>
                    <div class="text-[10px] opacity-75 mt-0.5">time · people · money</div>
                  </div>
                </div>
                <!-- Sub-option buttons -->
                <div class="bg-emerald-50 p-2.5 flex flex-col gap-1.5">
                  <button
                    type="button"
                    class="text-left text-[11px] font-semibold text-emerald-900
                           bg-white rounded-lg px-3 py-2 border border-emerald-200
                           hover:border-emerald-500 hover:bg-emerald-50 hover:shadow-sm
                           focus:outline-none focus:ring-2 focus:ring-emerald-400
                           transition-all duration-100"
                    title="Open Resources Sharpening — walk through 9 Gilb-cited analytical dimensions"
                    @click="resourcesSharpenOpen = true"
                  >Sharpen 9 Dimensions</button>
                  <button
                    type="button"
                    class="text-left text-[11px] font-semibold text-emerald-900
                           bg-white rounded-lg px-3 py-2 border border-emerald-200
                           hover:border-emerald-500 hover:bg-emerald-50 hover:shadow-sm
                           focus:outline-none focus:ring-2 focus:ring-emerald-400
                           transition-all duration-100"
                    title="5 generative Advanced Resource Tools"
                    @click="resourcesSharpenOpen = true"
                  >Advanced Tools (5)</button>
                  <button
                    type="button"
                    class="text-left text-[11px] font-semibold text-emerald-900
                           bg-white rounded-lg px-3 py-2 border border-emerald-200
                           hover:border-emerald-500 hover:bg-emerald-50 hover:shadow-sm
                           focus:outline-none focus:ring-2 focus:ring-emerald-400
                           transition-all duration-100"
                    title="Paste Claudian analysis JSON to apply Resource entry improvements"
                    @click="resourcesSharpenOpen = true"
                  >Apply Claudian Analysis</button>
                  <!-- Footer: All Tools + Other Tools -->
                  <div class="border-t border-emerald-200 mt-1.5 pt-1.5 flex gap-1.5">
                    <button
                      type="button"
                      class="flex-1 text-center text-[10px] font-bold px-2 py-1.5 rounded-md border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-400 transition-all"
                      title="Open full Resources Sharpening tool — 9 analytical dimensions + 5 advanced generative tools"
                      @click="resourcesSharpenOpen = true"
                    >📋 All Tools</button>
                    <button
                      type="button"
                      class="flex-1 text-center text-[10px] font-bold px-2 py-1.5 rounded-md border border-slate-300 text-slate-600 bg-white hover:bg-slate-50 hover:border-slate-400 transition-all"
                      title="Other resource tools — OPTIMA optimization, KISS analysis, Value Flow Diagram"
                      @click="optimaOpen = true"
                    >⋯ Other Tools</button>
                  </div>
                </div>
              </div>

              <!-- ── Pin 2: Analyze Planned Resources ──────────────────────── -->
              <div class="rounded-xl border-2 border-blue-300 overflow-hidden shadow-sm">
                <!-- Pin header — [→O]→? compound glyph (2026-06-05):
                     outer slate brackets [  ] + mini Resource →O icon (white) +
                     transformation arrow → (white) + analytical question ? (white/tinted).
                     Replaces the banned [R.]→[?] English-letter abbreviation (DD-015). -->
                <div class="bg-gradient-to-br from-blue-500 to-indigo-600 px-4 py-6 text-white">
                  <!-- [→O]→? compound glyph — the official analyze-Resource keyed form.
                       Displayed at 2× canonical size for a bold, unmistakable pin icon. -->
                  <button
                    type="button"
                    class="w-full flex justify-center focus:outline-none focus:ring-2 focus:ring-white/60
                           rounded-lg hover:bg-white/10 transition-colors duration-100 py-2"
                    title="Planguage compound keyed form [→O]→? — Resource entries analyzed for insights and questions · [→O] = Resource glyph (dashed arrows in, oval boundary) · → = analysis transformation · ? = insight/question result · Double-click for Resource glyph details"
                    @dblclick.stop="openGlyphPanel('resource')"
                  >
                    <svg viewBox="0 0 100 48" width="200" height="96" fill="none"
                         aria-label="Analyze Resource entries — compound glyph [→O]→?" role="img">
                      <!-- Outer container brackets — white on dark background -->
                      <path d="M 8,7 L 3,7 L 3,41 L 8,41" stroke="rgba(255,255,255,0.8)" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
                      <!-- Mini →O Resource glyph — white strokes (canonical color #166534 invisible on blue) -->
                      <line x1="10" y1="17" x2="25" y2="17" stroke="rgba(255,255,255,0.9)" stroke-width="2" stroke-dasharray="3 2" stroke-linecap="round" />
                      <polyline points="22,14 26,17 22,20" stroke="rgba(255,255,255,0.9)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
                      <line x1="10" y1="31" x2="25" y2="31" stroke="rgba(255,255,255,0.9)" stroke-width="2" stroke-dasharray="3 2" stroke-linecap="round" />
                      <polyline points="22,28 26,31 22,34" stroke="rgba(255,255,255,0.9)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
                      <ellipse cx="40" cy="24" rx="12" ry="9" stroke="rgba(255,255,255,0.9)" stroke-width="2.2" />
                      <!-- Right bracket -->
                      <path d="M 57,7 L 62,7 L 62,41 L 57,41" stroke="rgba(255,255,255,0.8)" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
                      <!-- Transformation arrow — slightly brighter white -->
                      <line x1="65" y1="24" x2="76" y2="24" stroke="rgba(255,255,255,0.95)" stroke-width="2.2" stroke-linecap="round" />
                      <polyline points="73,21 78,24 73,27" stroke="rgba(255,255,255,0.95)" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
                      <!-- Analytical question mark — pure white, slightly bold -->
                      <text x="82" y="32" font-size="17" font-family="Georgia,serif" font-weight="bold" fill="rgba(255,255,255,0.97)">?</text>
                    </svg>
                  </button>
                  <div class="text-center mt-3">
                    <span class="text-[9px] font-bold uppercase tracking-[0.18em] opacity-80">Analyze</span>
                    <div class="text-[14px] font-extrabold leading-tight mt-0.5">Planned Resources</div>
                    <div class="text-[10px] opacity-75 mt-0.5">dimensions · ratios · budgets</div>
                  </div>
                </div>
                <!-- Sub-option buttons -->
                <div class="bg-blue-50 p-2.5 flex flex-col gap-1.5">
                  <button
                    type="button"
                    class="text-left text-[11px] font-semibold text-blue-900
                           bg-white rounded-lg px-3 py-2 border border-blue-200
                           hover:border-blue-500 hover:bg-blue-50 hover:shadow-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-400
                           transition-all duration-100"
                    title="Walk through 9 Gilb-cited resource analytical dimensions"
                    @click="resourcesSharpenOpen = true"
                  >9 Gilb Dimensions</button>
                  <button
                    type="button"
                    class="text-left text-[11px] font-semibold text-blue-900
                           bg-white rounded-lg px-3 py-2 border border-blue-200
                           hover:border-blue-500 hover:bg-blue-50 hover:shadow-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-400
                           transition-all duration-100"
                    title="Review calendar and capital cost estimates from the Impact stage — opens Cost Engineering Tool"
                    @click="costEngineeringOpen = true"
                  >Calendar &amp; Capital Cost</button>
                  <button
                    type="button"
                    class="text-left text-[11px] font-semibold text-blue-900
                           bg-white rounded-lg px-3 py-2 border border-blue-200
                           hover:border-blue-500 hover:bg-blue-50 hover:shadow-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-400
                           transition-all duration-100"
                    title="Value-to-Resource ratio analysis — how much Value each Resource budget delivers per Evo Step — opens OPTIMA"
                    @click="optimaOpen = true"
                  >Value / Resource Ratio Analysis</button>
                  <!-- Footer: All Tools + Other Tools -->
                  <div class="border-t border-blue-200 mt-1.5 pt-1.5 flex gap-1.5">
                    <button
                      type="button"
                      class="flex-1 text-center text-[10px] font-bold px-2 py-1.5 rounded-md border border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 hover:border-blue-400 transition-all"
                      title="Open full Resources Sharpening tool — 9 analytical dimensions + 5 advanced generative tools"
                      @click="resourcesSharpenOpen = true"
                    >📋 All Tools</button>
                    <button
                      type="button"
                      class="flex-1 text-center text-[10px] font-bold px-2 py-1.5 rounded-md border border-slate-300 text-slate-600 bg-white hover:bg-slate-50 hover:border-slate-400 transition-all"
                      title="Other resource tools — OPTIMA optimization, KISS analysis, Value Flow Diagram"
                      @click="optimaOpen = true"
                    >⋯ Other Tools</button>
                  </div>
                </div>
              </div>

              <!-- ── Pin 3: Visualize Planned Resources ────────────────────── -->
              <div class="rounded-xl border-2 border-violet-300 overflow-hidden shadow-sm">
                <!-- Pin header -->
                <div class="bg-gradient-to-br from-violet-500 to-purple-700 px-4 py-6 text-white">
                  <!-- Official PlResourceIcon at 2xl (72×96) with white strokes
                       so it is visible on the violet/purple gradient.
                       color prop added 2026-06-05 — canonical dark green is the default;
                       white is the override for dark/coloured backgrounds. -->
                  <button
                    type="button"
                    class="w-full flex justify-center focus:outline-none focus:ring-2 focus:ring-white/60
                           rounded-lg hover:bg-white/10 transition-colors duration-100 py-2"
                    title="Planguage type glyph →O — Resource entry (time, people, money, other budgets) · Scale / Meter / Tolerable / Goal define your resource targets · Double-click for glyph history and details"
                    @dblclick.stop="openGlyphPanel('resource')"
                  >
                    <PlResourceIcon size="2xl" color="rgba(255,255,255,0.9)" />
                  </button>
                  <div class="text-center mt-3">
                    <span class="text-[9px] font-bold uppercase tracking-[0.18em] opacity-80">Visualize</span>
                    <div class="text-[14px] font-extrabold leading-tight mt-0.5">Planned Resources</div>
                    <div class="text-[10px] opacity-75 mt-0.5">entries · budgets · charts</div>
                  </div>
                </div>
                <!-- Sub-option buttons -->
                <div class="bg-violet-50 p-2.5 flex flex-col gap-1.5">
                  <!-- MultiForks — Tom 2026-06-06: "multifork needs to appear
                       in resource menu (at least) under visualization and also
                       multivision".  Placed FIRST in the Visualize sub-options
                       because it's the most condensed single-frame view of the
                       whole Resources → System ← Values fork pattern. -->
                  <button
                    type="button"
                    class="text-left text-[11px] font-semibold text-violet-900
                           bg-white rounded-lg px-3 py-2 border-2 border-indigo-300
                           hover:border-indigo-500 hover:bg-indigo-50 hover:shadow-sm
                           focus:outline-none focus:ring-2 focus:ring-indigo-400
                           transition-all duration-100"
                    title="🔱 MultiForks — Resources → System ← Values fork diagram with status colour bands, real numeric marker positions, and live Balance score."
                    @click="openMultiForks()"
                  >
                    <MultiForksGlyph size="sm" class="inline-block align-middle mr-1" />
                    MultiForks · System Fork Diagram
                  </button>
                  <button
                    type="button"
                    class="text-left text-[11px] font-semibold text-violet-900
                           bg-white rounded-lg px-3 py-2 border border-violet-200
                           hover:border-violet-500 hover:bg-violet-50 hover:shadow-sm
                           focus:outline-none focus:ring-2 focus:ring-violet-400
                           transition-all duration-100"
                    title="Open the Value Flow Diagram — see how Resources connect to Value delivery"
                    @click="valueFlowOpen = true"
                  >Value Flow Diagram</button>
                  <button
                    type="button"
                    class="text-left text-[11px] font-semibold text-violet-900
                           bg-white rounded-lg px-3 py-2 border border-violet-200
                           hover:border-violet-500 hover:bg-violet-50 hover:shadow-sm
                           focus:outline-none focus:ring-2 focus:ring-violet-400
                           transition-all duration-100"
                    title="Open Resource Spec entries — view and sharpen all R. entries in the Spec"
                    @click="resourcesSharpenOpen = true"
                  >Spec Resource Entries</button>
                  <button
                    type="button"
                    class="text-left text-[11px] font-semibold text-violet-900
                           bg-white rounded-lg px-3 py-2 border border-violet-200
                           hover:border-violet-500 hover:bg-violet-50 hover:shadow-sm
                           focus:outline-none focus:ring-2 focus:ring-violet-400
                           transition-all duration-100"
                    title="Walk through all 9 Gilb-cited analytical sharpening dimensions for Resource entries"
                    @click="resourcesSharpenOpen = true"
                  >9 Sharpen Dimensions</button>
                  <button
                    type="button"
                    class="text-left text-[11px] font-semibold text-violet-900
                           bg-white rounded-lg px-3 py-2 border border-violet-200
                           hover:border-violet-500 hover:bg-violet-50 hover:shadow-sm
                           focus:outline-none focus:ring-2 focus:ring-violet-400
                           transition-all duration-100"
                    title="OPTIMA Optimization — balance resource tradeoffs using VDT sliders"
                    @click="optimaOpen = true"
                  >OPTIMA Optimization</button>
                  <button
                    type="button"
                    class="text-left text-[11px] font-semibold text-violet-900
                           bg-white rounded-lg px-3 py-2 border border-violet-200
                           hover:border-violet-500 hover:bg-violet-50 hover:shadow-sm
                           focus:outline-none focus:ring-2 focus:ring-violet-400
                           transition-all duration-100"
                    title="KISS Analysis — Keep Improvement Super Surprising · 5 most cost-effective spec improvements"
                    @click="kissOpen = true"
                  >KISS Analysis</button>
                  <!-- Footer: All Tools + Other Tools -->
                  <div class="border-t border-violet-200 mt-1.5 pt-1.5 flex gap-1.5">
                    <button
                      type="button"
                      class="flex-1 text-center text-[10px] font-bold px-2 py-1.5 rounded-md border border-violet-300 text-violet-700 bg-violet-50 hover:bg-violet-100 hover:border-violet-400 transition-all"
                      title="Open full Resources Sharpening tool — 9 analytical dimensions + 5 advanced generative tools"
                      @click="resourcesSharpenOpen = true"
                    >📋 All Tools</button>
                    <button
                      type="button"
                      class="flex-1 text-center text-[10px] font-bold px-2 py-1.5 rounded-md border border-slate-300 text-slate-600 bg-white hover:bg-slate-50 hover:border-slate-400 transition-all"
                      title="Other resource tools — OPTIMA optimization, KISS analysis, Value Flow Diagram"
                      @click="optimaOpen = true"
                    >⋯ Other Tools</button>
                  </div>
                </div>
              </div>

              <!-- ── Pin 4: MultiVision — SINGLE-action pin ──────────────────
                   Tom 2026-06-06 (r05): "there is only 1 multivision tool, this
                   has 4 or o pins different names all leading to same tool".
                   Earlier r03 design used the 3-sub-button layout common to the
                   other Resources pins (IMPROVE / ANALYZE / VISUALIZE) which has
                   3 GENUINELY different sub-tools each.  MultiVision is ONE tool
                   with multiple internal sections — the 4 buttons that all opened
                   MultiVision misled the user that there were 4 separate tools.
                   New design: ONE hero CTA + a non-clickable feature list ("What
                   you get inside") so the pin reads honestly as a single portal
                   into ONE tool.  No fake sub-buttons. -->
              <div class="rounded-xl border-2 border-indigo-400 overflow-hidden shadow-md ring-1 ring-violet-300/40">
                <div
                  class="px-4 py-6 text-white"
                  style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)"
                >
                  <button
                    type="button"
                    class="w-full flex flex-col items-center justify-center gap-1
                           focus:outline-none focus:ring-2 focus:ring-white/60
                           rounded-lg hover:bg-white/10 transition-colors duration-100 py-2"
                    title="⚡ MultiVision — interactive Value ambition + Resource budget sliders · live VDT consequences (funded solutions, per-Value delivery %, balance score, tradeoff insights) · play with the sliders until the balance feels right, then use it as the starting point for solutions, Evo Steps, and tasks · Tom Gilb 2026-06-06: VDT-grounded · click to open"
                    @click="openMultiVision()"
                  >
                    <!-- Custom slider-pair glyph: two horizontal slider tracks with thumbs -->
                    <svg width="64" height="48" viewBox="0 0 64 48" fill="none" aria-hidden="true">
                      <rect x="4" y="10" width="20" height="6" rx="3" fill="#fbbf24" />
                      <rect x="22" y="10" width="20" height="6" rx="3" fill="#10b981" />
                      <rect x="40" y="10" width="20" height="6" rx="3" fill="#a78bfa" />
                      <circle cx="34" cy="13" r="5" fill="white" stroke="#4338ca" stroke-width="2" />
                      <text x="4" y="6" fill="white" font-size="6" font-weight="700" font-family="sans-serif" opacity="0.85">VALUE</text>
                      <rect x="4" y="32" width="56" height="6" rx="3" fill="rgba(255,255,255,0.25)" />
                      <rect x="4" y="32" width="38" height="6" rx="3" fill="rgba(255,255,255,0.9)" />
                      <circle cx="42" cy="35" r="5" fill="white" stroke="#7c3aed" stroke-width="2" />
                      <text x="4" y="28" fill="white" font-size="6" font-weight="700" font-family="sans-serif" opacity="0.85">RESOURCE</text>
                    </svg>
                  </button>
                  <div class="text-center mt-3">
                    <span class="text-[9px] font-bold uppercase tracking-[0.18em] opacity-85">⚡ Balance</span>
                    <div class="text-[14px] font-extrabold leading-tight mt-0.5">MultiVision</div>
                    <div class="text-[10px] opacity-80 mt-0.5">Value ambition · Resource budget · live VDT</div>
                  </div>
                </div>
                <!-- Single-tool body: non-interactive feature list + one hero CTA -->
                <div class="bg-indigo-50 p-3 flex flex-col gap-2">
                  <!-- "What you get inside" — descriptors, NOT buttons -->
                  <div class="text-[10px] font-bold text-indigo-700 uppercase tracking-wide">
                    Inside this one tool
                  </div>
                  <ul class="space-y-1 text-[11px] text-indigo-900 leading-tight">
                    <li class="flex items-start gap-1.5">
                      <span class="text-indigo-500 mt-0.5" aria-hidden="true">●</span>
                      <span>Value × Resource sliders with 3-zone ambition (Tolerable / Goal / Wish)</span>
                    </li>
                    <li class="flex items-start gap-1.5">
                      <span class="text-indigo-500 mt-0.5" aria-hidden="true">●</span>
                      <span>Funded solutions preview · ranked by Value-per-Cost</span>
                    </li>
                    <li class="flex items-start gap-1.5">
                      <span class="text-indigo-500 mt-0.5" aria-hidden="true">●</span>
                      <span>Balance score gauge + green / amber / red breakdown</span>
                    </li>
                    <li class="flex items-start gap-1.5">
                      <span class="text-indigo-500 mt-0.5" aria-hidden="true">●</span>
                      <span>Tradeoff insights — "lower Wish on X to fund Y"</span>
                    </li>
                    <li class="flex items-start gap-1.5">
                      <MultiForksGlyph size="sm" class="shrink-0 mt-0.5" />
                      <span>MultiForks · paired system fork diagram</span>
                    </li>
                  </ul>
                  <!-- ONE hero CTA — full width -->
                  <button
                    type="button"
                    class="w-full text-center text-[12px] font-extrabold py-2.5 mt-1
                           rounded-lg text-white shadow-md
                           transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]
                           focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    style="background: linear-gradient(135deg, #4f46e5, #7c3aed)"
                    title="Open MultiVision — the single Value × Resource balance sandbox"
                    @click="openMultiVision()"
                  >⚡ Open MultiVision</button>
                  <!-- MultiForks secondary CTA — Tom 2026-06-06: "multifork
                       needs to appear in resource menu under visualization and
                       also multivision".  Inside the MultiVision pin so users
                       see MultiForks is the paired-view sibling. -->
                  <button
                    type="button"
                    class="w-full text-center text-[11px] font-bold py-2 rounded-lg
                           bg-white text-indigo-700 border-2 border-indigo-300
                           hover:bg-indigo-50 hover:border-indigo-500 shadow-sm
                           transition-all duration-150
                           focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    title="MultiForks — paired Resources → System ← Values fork diagram. Marker positions reflect the real numeric thresholds you've specified. Status colour bands. Same Balance score as MultiVision."
                    @click="openMultiForks()"
                  >
                    <MultiForksGlyph size="sm" class="inline-block align-middle mr-1" />
                    Open MultiForks
                  </button>
                  <!-- Smaller secondary link -->
                  <button
                    type="button"
                    class="text-center text-[10px] font-semibold text-slate-600
                           hover:text-slate-900 hover:underline focus:outline-none
                           focus-visible:ring-2 focus-visible:ring-slate-400 rounded"
                    title="Other resource tools — OPTIMA optimization, KISS analysis, Value Flow Diagram"
                    @click="optimaOpen = true"
                  >⋯ Other resource tools</button>
                </div>
              </div>

              <!-- ── Pin 5: Potential Resource Optimization (OPTIMA) ──────── -->
              <div class="rounded-xl border-2 border-amber-300 overflow-hidden shadow-sm">
                <!-- Pin header — OptimaGlyph (dots + threshold lines + yellow circle) -->
                <div class="bg-gradient-to-br from-amber-400 to-orange-600 px-4 py-6 text-white">
                  <button
                    type="button"
                    class="w-full flex justify-center focus:outline-none focus:ring-2 focus:ring-white/60
                           rounded-lg hover:bg-white/10 transition-colors duration-100 py-2"
                    title="OPTIMA — Potential Resource Optimization · Balancing Critical Values (Optima book, Tom Gilb 2024) · VDT sliders show multi-factor tradeoffs · green = Goal met · orange = Tolerable risk · red = Constraint Violation · DEEP Planguage theory: a resource can be increased to buy more value while others decrease · Double-click for Optima glyph details"
                    @dblclick.stop="optimaOpen = true"
                    @click="optimaOpen = true"
                  >
                    <OptimaGlyph size="xl" />
                  </button>
                  <div class="text-center mt-3">
                    <span class="text-[9px] font-bold uppercase tracking-[0.18em] opacity-80">Potential</span>
                    <div class="text-[14px] font-extrabold leading-tight mt-0.5">Resource Optimization</div>
                    <div class="text-[10px] opacity-75 mt-0.5">balance · tradeoffs · OPTIMA</div>
                  </div>
                </div>
                <!-- Sub-option buttons -->
                <div class="bg-amber-50 p-2.5 flex flex-col gap-1.5">
                  <button
                    type="button"
                    class="text-left text-[11px] font-semibold text-amber-900
                           bg-white rounded-lg px-3 py-2 border border-amber-200
                           hover:border-amber-500 hover:bg-amber-50 hover:shadow-sm
                           focus:outline-none focus:ring-2 focus:ring-amber-400
                           transition-all duration-100"
                    title="Open OPTIMA VDT sliders — adjust resources and see value tradeoffs in real time"
                    @click="optimaOpen = true"
                  >OPTIMA Tool — VDT Sliders</button>
                  <button
                    type="button"
                    class="text-left text-[11px] font-semibold text-amber-900
                           bg-white rounded-lg px-3 py-2 border border-amber-200
                           hover:border-amber-500 hover:bg-amber-50 hover:shadow-sm
                           focus:outline-none focus:ring-2 focus:ring-amber-400
                           transition-all duration-100"
                    title="DEEP theory: a resource can be increased while others decrease to unlock value — the OPTIMA is not cheapest/fastest but maximises Goal achievement"
                    @click="optimaOpen = true"
                  >DEEP Theory — Resource Trade-offs</button>
                  <button
                    type="button"
                    class="text-left text-[11px] font-semibold text-amber-900
                           bg-white rounded-lg px-3 py-2 border border-amber-200
                           hover:border-amber-500 hover:bg-amber-50 hover:shadow-sm
                           focus:outline-none focus:ring-2 focus:ring-amber-400
                           transition-all duration-100"
                    title="Constraint Violation Analysis — find which resource constraints are blocking Value Goals"
                    @click="optimaOpen = true"
                  >Constraint Violation Analysis</button>
                  <!-- Footer: All Tools + Other Tools -->
                  <div class="border-t border-amber-200 mt-1.5 pt-1.5 flex gap-1.5">
                    <button
                      type="button"
                      class="flex-1 text-center text-[10px] font-bold px-2 py-1.5 rounded-md border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 hover:border-amber-400 transition-all"
                      title="Open full Resources Sharpening tool — 9 analytical dimensions + 5 advanced generative tools"
                      @click="resourcesSharpenOpen = true"
                    >📋 All Tools</button>
                    <button
                      type="button"
                      class="flex-1 text-center text-[10px] font-bold px-2 py-1.5 rounded-md border border-slate-300 text-slate-600 bg-white hover:bg-slate-50 hover:border-slate-400 transition-all"
                      title="Other resource tools — OPTIMA optimization, KISS analysis, Value Flow Diagram"
                      @click="optimaOpen = true"
                    >⋯ Other Tools</button>
                  </div>
                </div>
              </div>

              <!-- ── Pin 5: KISS — Keep Improvement Super Surprising ─────────── -->
              <!-- Tom 2026-06-05 verbatim: "BLOW OUR mind with KISSES. KISS: Keep Improvement Super Surprising" -->
              <div class="rounded-xl border-2 border-violet-400 overflow-hidden shadow-sm ring-1 ring-violet-300">
                <div class="bg-gradient-to-br from-violet-900 via-indigo-900 to-slate-900 px-4 py-6 text-white">
                  <button
                    type="button"
                    class="w-full flex flex-col items-center justify-center gap-2
                           focus:outline-none focus:ring-2 focus:ring-white/60
                           rounded-lg hover:bg-white/10 transition-colors duration-100 py-2"
                    title="KISS — Keep Improvement Super Surprising · 5 most cost-effective spec improvements for dramatic resource gains · Change Differential Diagram shows before/after using VDT logic · 4 alternative approaches per improvement · Click to open"
                    @click="kissOpen = true"
                  >
                    <!-- KISS acronym block — dramatic visual -->
                    <div class="grid grid-cols-2 gap-x-2 gap-y-0.5 text-center select-none">
                      <span class="text-[22px] font-black text-yellow-300 leading-none">K</span>
                      <span class="text-[10px] font-semibold text-yellow-200/80 leading-tight self-center text-left">Keep</span>
                      <span class="text-[22px] font-black text-emerald-300 leading-none">I</span>
                      <span class="text-[10px] font-semibold text-emerald-200/80 leading-tight self-center text-left">Improvement</span>
                      <span class="text-[22px] font-black text-cyan-300 leading-none">S</span>
                      <span class="text-[10px] font-semibold text-cyan-200/80 leading-tight self-center text-left">Super</span>
                      <span class="text-[22px] font-black text-pink-300 leading-none">S</span>
                      <span class="text-[10px] font-semibold text-pink-200/80 leading-tight self-center text-left">Surprising</span>
                    </div>
                  </button>
                  <div class="text-center mt-3">
                    <span class="text-[9px] font-bold uppercase tracking-[0.18em] opacity-80">5 Top Improvements</span>
                    <div class="text-[14px] font-extrabold leading-tight mt-0.5">KISS Analysis</div>
                    <div class="text-[10px] opacity-75 mt-0.5">change diff · VDT · tradeoffs</div>
                  </div>
                </div>
                <!-- Sub-option buttons -->
                <div class="bg-violet-950/10 p-2.5 flex flex-col gap-1.5">
                  <button
                    type="button"
                    class="text-left text-[11px] font-semibold text-violet-900
                           bg-white rounded-lg px-3 py-2 border border-violet-200
                           hover:border-violet-500 hover:bg-violet-50 hover:shadow-sm
                           focus:outline-none focus:ring-2 focus:ring-violet-400
                           transition-all duration-100"
                    title="KISS: 5 most cost-effective improvements with Change Differential Diagrams and 4 alternatives each"
                    @click="kissOpen = true"
                  >Change Differential Diagrams</button>
                  <button
                    type="button"
                    class="text-left text-[11px] font-semibold text-violet-900
                           bg-white rounded-lg px-3 py-2 border border-violet-200
                           hover:border-violet-500 hover:bg-violet-50 hover:shadow-sm
                           focus:outline-none focus:ring-2 focus:ring-violet-400
                           transition-all duration-100"
                    title="Constraint relaxation options — binary constraint, regulatory, policy, contract deferral"
                    @click="kissOpen = true"
                  >Constraint Relaxation Options</button>
                  <button
                    type="button"
                    class="text-left text-[11px] font-semibold text-violet-900
                           bg-white rounded-lg px-3 py-2 border border-violet-200
                           hover:border-violet-500 hover:bg-violet-50 hover:shadow-sm
                           focus:outline-none focus:ring-2 focus:ring-violet-400
                           transition-all duration-100"
                    title="VDT-ranked priority alternatives — 4 ranked alternatives per improvement with resource deltas"
                    @click="kissOpen = true"
                  >4 Alternatives per Improvement</button>
                  <!-- Footer: All Tools + Other Tools -->
                  <div class="border-t border-violet-200 mt-1.5 pt-1.5 flex gap-1.5">
                    <button
                      type="button"
                      class="flex-1 text-center text-[10px] font-bold px-2 py-1.5 rounded-md border border-violet-300 text-violet-700 bg-violet-50 hover:bg-violet-100 hover:border-violet-400 transition-all"
                      title="Open full Resources Sharpening tool — 9 analytical dimensions + 5 advanced generative tools"
                      @click="resourcesSharpenOpen = true"
                    >📋 All Tools</button>
                    <button
                      type="button"
                      class="flex-1 text-center text-[10px] font-bold px-2 py-1.5 rounded-md border border-slate-300 text-slate-600 bg-white hover:bg-slate-50 hover:border-slate-400 transition-all"
                      title="Other resource tools — Resources Sharpening, OPTIMA optimization, Value Flow Diagram"
                      @click="resourcesSharpenOpen = true"
                    >⋯ Other Tools</button>
                  </div>
                </div>
              </div>

              <!-- ── Pin 6: Cost Engineering ─────────────────────────────────── -->
              <!-- Tom 2026-06-05: "COST ENGINEERING: THE TOOL, SEPARATE TOOL for Dynamic
                   (Evo Step) Design to [Cost, Value, Constraint] and for initial statics
                   upfront Design to [Cost, Value, Constraint]." -->
              <div class="rounded-xl border-2 border-amber-600 overflow-hidden shadow-sm ring-1 ring-amber-400/50">
                <div class="bg-gradient-to-br from-slate-900 via-amber-950 to-slate-900 px-4 py-6 text-white">
                  <button
                    type="button"
                    class="w-full flex flex-col items-center justify-center gap-1.5
                           focus:outline-none focus:ring-2 focus:ring-amber-400/60
                           rounded-lg hover:bg-white/10 transition-colors duration-100 py-2"
                    title="Cost Engineering Tool — Design to Cost / Value / Constraint · Static (upfront) + Dynamic (Evo Step) modes · Based on Tom Gilb's Cost Engineering book"
                    @click="costEngineeringOpen = true"
                  >
                    <!-- [$→*] keyed icon — cost/budget to output (international, DD-015) -->
                    <svg viewBox="0 0 64 48" width="96" height="72" fill="none"
                         aria-label="Cost Engineering — budget transforms to value" role="img">
                      <!-- Left bracket [ -->
                      <path d="M 12,8 L 7,8 L 7,40 L 12,40" stroke="rgba(251,191,36,0.9)" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                      <!-- $ symbol (cost/resource) -->
                      <text x="15" y="32" font-size="20" font-family="Georgia,serif" font-weight="bold" fill="rgba(251,191,36,0.95)">$</text>
                      <!-- Right bracket ] -->
                      <path d="M 32,8 L 37,8 L 37,40 L 32,40" stroke="rgba(251,191,36,0.9)" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                      <!-- → transformation arrow -->
                      <line x1="40" y1="24" x2="52" y2="24" stroke="rgba(255,255,255,0.9)" stroke-width="2.5" stroke-linecap="round"/>
                      <polyline points="49,20 54,24 49,28" stroke="rgba(255,255,255,0.9)" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                      <!-- * output star -->
                      <text x="56" y="30" font-size="18" font-family="Georgia,serif" font-weight="bold" fill="rgba(52,211,153,0.95)">*</text>
                    </svg>
                    <div class="text-center mt-1">
                      <span class="text-[9px] font-bold uppercase tracking-[0.18em] opacity-80">Design to</span>
                      <div class="text-[13px] font-extrabold leading-tight mt-0.5">Cost Engineering</div>
                      <div class="text-[10px] opacity-75 mt-0.5">static · dynamic · Evo Steps</div>
                    </div>
                  </button>
                </div>
                <!-- Sub-option buttons -->
                <div class="bg-amber-50 p-2.5 flex flex-col gap-1.5">
                  <button
                    type="button"
                    class="text-left text-[11px] font-semibold text-amber-900
                           bg-white rounded-lg px-3 py-2 border border-amber-200
                           hover:border-amber-500 hover:bg-amber-50 hover:shadow-sm
                           focus:outline-none focus:ring-2 focus:ring-amber-400
                           transition-all duration-100"
                    title="Static upfront Design-to-Cost — set cost targets for whole plan, see which Solutions fit within budget"
                    @click="costEngineeringOpen = true"
                  >Static — Upfront Design-to-Cost</button>
                  <button
                    type="button"
                    class="text-left text-[11px] font-semibold text-amber-900
                           bg-white rounded-lg px-3 py-2 border border-amber-200
                           hover:border-amber-500 hover:bg-amber-50 hover:shadow-sm
                           focus:outline-none focus:ring-2 focus:ring-amber-400
                           transition-all duration-100"
                    title="Dynamic Evo Step Design-to-Cost — per step: planned cost vs value delivered vs constraints"
                    @click="costEngineeringOpen = true"
                  >Dynamic — Evo Step Cost Tracking</button>
                  <button
                    type="button"
                    class="text-left text-[11px] font-semibold text-amber-900
                           bg-white rounded-lg px-3 py-2 border border-amber-200
                           hover:border-amber-500 hover:bg-amber-50 hover:shadow-sm
                           focus:outline-none focus:ring-2 focus:ring-amber-400
                           transition-all duration-100"
                    title="Value/Cost ratio ranking — which Solutions and Evo Steps give the best V/C ratio"
                    @click="costEngineeringOpen = true"
                  >V/C Ratio Ranking</button>
                  <!-- Footer: All Tools + Other Tools -->
                  <div class="border-t border-amber-200 mt-1.5 pt-1.5 flex gap-1.5">
                    <button
                      type="button"
                      class="flex-1 text-center text-[10px] font-bold px-2 py-1.5 rounded-md border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 hover:border-amber-400 transition-all"
                      title="Open full Resources Sharpening tool — 9 analytical dimensions + 5 advanced generative tools"
                      @click="resourcesSharpenOpen = true"
                    >📋 All Tools</button>
                    <button
                      type="button"
                      class="flex-1 text-center text-[10px] font-bold px-2 py-1.5 rounded-md border border-slate-300 text-slate-600 bg-white hover:bg-slate-50 hover:border-slate-400 transition-all"
                      title="Other resource tools — KISS analysis, OPTIMA optimization, Value Flow Diagram"
                      @click="kissOpen = true"
                    >⋯ Other Tools</button>
                  </div>
                </div>
              </div>

            </div>
          </div>

          <!-- Cost summary cards (derived from prior stages) -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div class="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-3">
              <div class="text-[10px] uppercase font-bold text-emerald-700 tracking-wider">Calendar Cost</div>
              <div class="text-2xl font-extrabold text-emerald-900 mt-1">
                {{ Object.values(capturedCalendarCosts).reduce((s, v) => s + (v || 0), 0).toLocaleString() }}
                <span class="text-xs font-normal text-emerald-700/80 ml-1">days</span>
              </div>
              <div class="text-[10px] text-emerald-700/70 mt-1 italic">from prior Impact Estimation stage</div>
            </div>
            <div class="rounded-xl border-2 border-violet-200 bg-violet-50 p-3">
              <div class="text-[10px] uppercase font-bold text-violet-700 tracking-wider">Capital Cost</div>
              <div class="text-2xl font-extrabold text-violet-900 mt-1">
                ${{ Object.values(capturedCapitalCosts).reduce((s, v) => s + (v || 0), 0).toLocaleString() }}
              </div>
              <div class="text-[10px] text-violet-700/70 mt-1 italic">from prior Impact Estimation stage</div>
            </div>
            <div class="rounded-xl border-2 border-blue-200 bg-blue-50 p-3">
              <div class="text-[10px] uppercase font-bold text-blue-700 tracking-wider">Top Value / Resource ratios (efficiency)</div>
              <ul class="text-[11px] text-blue-900 mt-1 space-y-0.5">
                <li
                  v-for="[k, v] in Object.entries(capturedVCRatios).sort((a, b) => b[1] - a[1]).slice(0, 4)"
                  :key="k"
                ><b>{{ k }}</b>: {{ v.toFixed(2) }}</li>
                <li v-if="Object.keys(capturedVCRatios).length === 0" class="italic opacity-70">No Value / Resource ratio data yet — complete Impact Estimation first.</li>
              </ul>
            </div>
          </div>

          <!-- R. entry display (Phase 1 schema, r77) -->
          <div class="rounded-xl border-2 border-teal-200 bg-teal-50/40 p-4">
            <div class="flex items-center justify-between mb-2">
              <div>
                <h3 class="text-sm font-extrabold text-teal-900">R. entries in this Spec</h3>
                <p class="text-[11px] text-teal-700/80">
                  Phase 1 schema live (r77) — entries persist in <code>SpecBlock.resources</code>.
                  Phase 2 (Claudian write-back from the Sharpening panel) is queued.
                </p>
              </div>
              <span class="text-2xl font-extrabold text-teal-700">{{ (currentSpec.resources ?? []).length }}</span>
            </div>
            <ul v-if="(currentSpec.resources ?? []).length > 0" class="space-y-1 mt-2">
              <li
                v-for="r in (currentSpec.resources ?? [])"
                :key="r.id"
                class="text-[12px] text-slate-800 bg-white rounded px-3 py-1.5 border border-teal-100"
              >
                <b class="text-teal-700">{{ r.id }}</b> — {{ r.description }}
                <span v-if="r.goal" class="text-[11px] text-emerald-700 ml-2">Goal: {{ r.goal }}</span>
              </li>
            </ul>
            <div v-else class="text-[12px] text-teal-800/70 italic mt-2">
              No R. entries yet.  Use the Sharpening panel above to walk through the 9 Gilb-cited dimensions
              + 5 generative Advanced Tools; copy the prompt + spec to Claudian to draft R. entries grounded in CE, Cost Engineering, SEA, Optima.
            </div>
          </div>
        </div>

        <!-- Bottom mirror — ExportSpecPin (DD-014 Top-and-Bottom mirror) + Next → Stage 11 -->
        <div class="w-full max-w-3xl mt-8 pt-4 border-t border-slate-200">
          <!-- Stage identity badge -->
          <div class="flex flex-wrap items-center gap-3 mb-3">
            <div class="inline-flex items-center gap-3 rounded-2xl pl-3 pr-5 py-3 select-none
                        text-base font-bold text-white
                        bg-gradient-to-r from-emerald-500 to-teal-500
                        shadow-lg ring-2 ring-emerald-300/40">
              <span class="text-[11px] font-extrabold leading-none bg-black/60 text-white rounded-md px-2 py-1.5"
                    aria-hidden="true">10</span>
              <span class="flex flex-col items-start leading-tight">
                <span class="text-[9px] font-semibold uppercase tracking-[0.15em] text-emerald-100">Stage Now</span>
                <span class="text-base font-extrabold text-white">Resources</span>
              </span>
            </div>
          </div>
          <!-- Export pin mirror -->
          <ExportSpecPin
            :has-spec="!!currentSpec"
            :spec-name="specModel?.name || 'Spec'"
            @copy="autoCopyPlan()"
            @email="emailPlan()"
            @download="downloadPlan()"
            @message="messagePlan()"
            @copy-for-chat="copyPlanForChat()"
          />
          <!-- Next → Stage 11 (on its own row below the export pin) -->
          <!-- Tom 2026-06-04 r83 — STAGE-AWARE forward button. -->
          <div v-if="currentSpec && nextStageInfo" class="flex justify-end mt-3">
            <button
              type="button"
              class="flex items-center gap-3 px-5 py-3 rounded-2xl min-h-[52px]
                     bg-gradient-to-r from-amber-500 to-orange-500 text-white
                     font-bold text-sm shadow-md shadow-amber-200/70
                     hover:from-amber-600 hover:to-orange-600 hover:shadow-lg
                     focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2
                     transition-all duration-200 active:scale-[0.98]"
              :aria-label="`Next: Stage ${nextStageInfo.stage} · ${nextStageInfo.label}`"
              :title="`Advance to Stage ${nextStageInfo.stage} · ${nextStageInfo.label} — ${nextStageInfo.title}`"
              @click="nextStageInfo.stage === 11 ? exportFull() : handleStageBarNav(nextStageInfo.stage)"
            >
              <div class="text-right leading-tight">
                <div class="text-[10px] font-normal opacity-85 uppercase tracking-wide">Next → Stage {{ nextStageInfo.stage }}</div>
                <div class="font-extrabold leading-tight">{{ nextStageInfo.label }}</div>
              </div>
              <span class="text-xl leading-none" aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </template>

      <!-- Stage 3: Impact Estimation VDT — estimate value/solution impact to prioritise evo steps -->
      <template v-else-if="stage === 3 && currentSpec">
        <div class="w-full max-w-2xl mb-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            class="flex items-center gap-3 px-5 py-3 rounded-2xl min-h-[52px]
                   bg-gradient-to-r from-cyan-500 to-blue-500 text-white
                   font-semibold text-sm shadow-md shadow-cyan-200/70
                   hover:from-cyan-600 hover:to-blue-600 hover:shadow-lg
                   focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2
                   transition-all duration-200 active:scale-[0.98]"
            aria-label="Back to Stage 6 · Evo Steps (Evo Plan view)"
            @click="goToStage2()"
          >
            <span class="text-xl leading-none" aria-hidden="true">←</span>
            <div class="text-left">
              <div class="text-[10px] font-normal opacity-75 uppercase tracking-wide">Return to Stage 6</div>
              <div class="font-bold leading-tight">Evo Plan</div>
            </div>
          </button>
          <button
            v-if="currentSpec"
            type="button"
            class="flex items-center gap-2 px-4 py-2.5 rounded-xl min-h-[44px]
                   bg-white border border-indigo-200 text-indigo-700 text-sm font-medium
                   hover:bg-indigo-50 hover:border-indigo-300
                   focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-1
                   transition-all duration-150 shadow-sm"
            aria-label="Open Value Flow Diagram"
            @click="valueFlowOpen = true"
          >
            <svg width="44" height="20" viewBox="0 0 44 20" fill="none" aria-hidden="true">
              <rect x="0"  y="2" width="5" height="16" rx="1.5" fill="#374151"/>
              <rect x="8"  y="2" width="5" height="16" rx="1.5" fill="#ca8a04"/>
              <rect x="16" y="2" width="5" height="16" rx="1.5" fill="#ea580c"/>
              <rect x="24" y="2" width="5" height="16" rx="1.5" fill="#7c3aed"/>
              <rect x="32" y="2" width="5" height="16" rx="1.5" fill="#16a34a"/>
              <rect x="40" y="2" width="4" height="16" rx="1.5" fill="#2563eb"/>
              <line x1="5"  y1="10" x2="8"  y2="10" stroke="#d1d5db" stroke-width="1"/>
              <line x1="13" y1="10" x2="16" y2="10" stroke="#d1d5db" stroke-width="1"/>
              <line x1="21" y1="10" x2="24" y2="10" stroke="#d1d5db" stroke-width="1"/>
              <line x1="29" y1="10" x2="32" y2="10" stroke="#d1d5db" stroke-width="1"/>
              <line x1="37" y1="10" x2="40" y2="10" stroke="#d1d5db" stroke-width="1"/>
            </svg>
            <span>Value Flow</span>
          </button>

          <!-- MultiVision button — Stage 3 action bar -->
          <button
            v-if="currentSpec"
            type="button"
            class="flex items-center gap-2 px-4 py-2.5 rounded-xl min-h-[44px]
                   text-white text-sm font-semibold
                   hover:opacity-90 hover:shadow-md
                   focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-1
                   transition-all duration-150 shadow-sm"
            style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)"
            aria-label="Open MultiVision — balance Values and Resources"
            title="⚡ MultiVision — slide Value ambition and Resource budget sliders, see consequence live"
            @click="openMultiVision()"
          >
            <span class="text-base" aria-hidden="true">⚡</span>
            <span>MultiVision</span>
          </button>

          <!-- Copy + Email at TOP — Tom 2026-06-04 DD-014 application:
               sharable content (Value Flow + Impact Estimation) needs top + bottom share pins. -->
          <button
            v-if="currentSpec"
            type="button"
            class="flex items-center gap-2 px-4 py-2.5 rounded-xl min-h-[44px]
                   bg-emerald-50 border-2 border-emerald-400 text-emerald-700 text-sm font-semibold
                   hover:bg-emerald-100 hover:border-emerald-500 hover:shadow-md
                   focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-1
                   transition-all duration-150 shadow-sm"
            aria-label="Copy plan to clipboard"
            title="COPY — duplicate this Spec to your clipboard.&#10;Paste into Notes, Mail, Slack, or anywhere.&#10;&#10;Planguage glyph [*]=[*] reads &quot;vessel equals vessel&quot;:&#10;the Spec is duplicated, both copies are identical."
            @click="autoCopyPlan()"
          >
            <CopyGlyph size="standard" />
            <span>Copy</span>
          </button>
          <button
            v-if="currentSpec"
            type="button"
            class="flex items-center gap-2 px-4 py-2.5 rounded-xl min-h-[44px]
                   bg-blue-50 border-2 border-blue-400 text-blue-700 text-sm font-semibold
                   hover:bg-blue-100 hover:border-blue-500 hover:shadow-md
                   focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1
                   transition-all duration-150 shadow-sm"
            aria-label="Email plan via Mail.app"
            title="EMAIL — open your default mail client with the Spec ready to paste.&#10;The full Spec is auto-copied to your clipboard;&#10;paste it into the email body, then send.&#10;&#10;Planguage glyph [*]→@ reads &quot;vessel sent to address&quot;:&#10;the Spec is sent to a remote recipient at an @ address."
            @click="emailPlan()"
          >
            <EmailGlyph size="standard" />
            <span>Email</span>
          </button>
        </div>
        <!-- ── Embedded Value Flow (Tom 2026-06-03) ────────────────────────────
             "WHAT IF, AT THIS STAGE (EVO JUST DONE) WE COULD ALSO DISPLAY THE
             STAGE OF EVO AS IN VALUE FLOW, JUST SIMLY INSERT THE MAIN VALUE
             FLOW ON THAT PAGE, THAT WOULD BE VISUALLY EXCITING AND DARAMATIC
             AND INFORMATIVE, PLEASE MAKE IT SO". Embeds the 6-column causal
             diagram (T → Evo → S → V → F → K) inline above the IET so the
             user sees what they just designed at the very moment they start
             estimating impact. The "Value Flow" button above still opens the
             full-screen modal for deeper inspection. Uses _stepsForDiagram
             (same source as the modal) so confirmed-or-draft steps both show.
        -->
        <!-- Tom 2026-06-03: "Enlarge the value flow map".  Container widened
             max-w-5xl → max-w-7xl (+25% horizontal), inner switched to
             fit-container mode with min-h-[640px] so the SVG scales to the
             allotted box instead of rendering at its fixed pixel size.
             Padding reduced p-4 → p-2 to reclaim diagram space at the edges.
             The legend bar (hidden in fit-container mode) is acceptable to drop
             on this embedded view because the full-screen "Expand ↗" still shows it. -->
        <div
          v-if="currentSpec"
          class="w-full max-w-none mb-6 rounded-2xl border-2 border-indigo-200
                 bg-gradient-to-br from-white to-indigo-50/30 shadow-lg overflow-hidden"
        >
          <div class="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-indigo-600 to-violet-600">
            <div>
              <h3 class="text-sm font-bold text-white flex items-center gap-2">
                <span aria-hidden="true">⛢</span> Value Flow — what you just designed
              </h3>
              <p class="text-[11px] text-indigo-100 mt-0.5">
                Tasks → Evo Steps → Solutions → Values → Functions → Stakeholders ·
                click any node for relations · click ⬢ Value Flow above for full-screen
              </p>
            </div>
            <button
              type="button"
              class="text-[11px] font-semibold text-white/90 bg-white/15 hover:bg-white/25
                     border border-white/30 rounded-lg px-3 py-1.5 transition-colors"
              title="Open the full-screen Value Flow diagram"
              @click="valueFlowOpen = true"
            >Enlarge The Value Flow Diagram ↗</button>
          </div>
          <!-- Tom 2026-06-03: fit-container=true rendered blank because the
               SVG h-full needed an explicit parent height to resolve, and
               min-h-[640px] only sets a MINIMUM (flex child resolved to 0
               natural height).  Reverted to natural SVG sizing in a wider
               container so the diagram renders at its native pixel size.
               If we want auto-fit again, the parent needs `h-[640px]` (fixed),
               not min-h — a v2 follow-on. -->
          <div ref="_vfEmbedBodyRef" class="p-3 bg-white overflow-x-auto">
            <ValueFlowDiagram
              :spec="currentSpec"
              :evo-steps="_stepsForDiagram"
              :tasks-by-step="tasksByStep"
              :impact-matrix="capturedImpactMatrix"
              @open-editor="({ tab, entryId }) => _openSpecEditor({ tab, entryId, returnTo: 'valueFlow' })"
              @node-relations-click="({ tab, entryId }) => _openSdr(tab, entryId, 'valueFlow')"
            />
          </div>
          <!-- Footer: Copy + Email + Download SVG + Enlarge — DD-014 bottom mirror.
               Tom 2026-06-05: "each diagram needs copy, email, download buttons" +
               "the enlarge button now needs to be visible when we scroll down." -->
          <div class="flex items-center flex-wrap gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 border-t border-indigo-500/40">
            <!-- Copy -->
            <button
              type="button"
              class="flex items-center gap-1.5 text-[11px] font-semibold text-white/90
                     bg-white/15 hover:bg-white/25 border border-white/30
                     rounded-lg px-3 py-1.5 transition-colors"
              title="Copy the full Spec as colourful HTML to clipboard (⌘V to paste)"
              @click="autoCopyPlan()"
            ><CopyGlyph size="compact" />Copy</button>
            <!-- Email -->
            <button
              type="button"
              class="flex items-center gap-1.5 text-[11px] font-semibold text-white/90
                     bg-white/15 hover:bg-white/25 border border-white/30
                     rounded-lg px-3 py-1.5 transition-colors"
              title="Email the Spec — opens Mail, ⌘V to paste the colourful version"
              @click="emailPlan()"
            ><EmailGlyph size="compact" />Email</button>
            <!-- Download SVG -->
            <button
              type="button"
              class="flex items-center gap-1.5 text-[11px] font-semibold text-white/90
                     bg-white/15 hover:bg-white/25 border border-white/30
                     rounded-lg px-3 py-1.5 transition-colors"
              title="Download the Value Flow diagram as an SVG file"
              @click="downloadValueFlowSvg()"
            ><GetGlyph size="compact" />Download SVG</button>
            <!-- Enlarge (spacer + right-aligned) -->
            <span class="flex-1" />
            <button
              type="button"
              class="text-[11px] font-semibold text-white/90 bg-white/15 hover:bg-white/25
                     border border-white/30 rounded-lg px-3 py-1.5 transition-colors"
              title="Open the full-screen Value Flow diagram"
              @click="valueFlowOpen = true"
            >Enlarge ↗</button>
          </div>
        </div>

        <!-- ── V × Evo Step VDT (PRIMARY for this stage, 2026-06-03) ──────────
             Tom 2026-06-03: "I expected want the VDT columns to be Evo Steps
             (V × Step) instead of Solutions (V × S)? at that stage, just after Evo".
             The Evo Step IS the unit of value delivery — V × Step is the canonical
             Planguage Impact Table at this stage. The V × S editor below feeds
             cell values via each step's linkedSolutions aggregation (v1 derives;
             v2 will add direct per-step editing + costs). When _stepsForDiagram
             is empty (no plan generated yet), the step view shows an empty-state
             hint and the V × S editor below is the only impact table the user sees.
        -->
        <ImpactEstimationStepView
          v-if="_stepsForDiagram.length > 0"
          :values="currentSpec.values"
          :steps="_stepsForDiagram"
          :solutions="currentSpec.solutions"
          :impact-matrix="capturedImpactMatrix"
        />
        <!-- V × Evo Step table actions — Tom 2026-06-05: "each diagram needs copy, email, download buttons"
             These buttons export THIS TABLE specifically, not the full Planguage spec. -->
        <div
          v-if="_stepsForDiagram.length > 0 && currentSpec"
          class="flex flex-wrap items-center gap-2 px-4 py-2.5 mb-6 rounded-b-xl
                 bg-amber-50 border border-t-0 border-amber-200"
        >
          <span class="text-[11px] text-amber-700 font-semibold mr-auto">Value × Evo Step Impact</span>
          <button
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                   bg-emerald-50 border border-emerald-400 text-emerald-700
                   hover:bg-emerald-100 transition-colors"
            title="Copy this Value × Evo Step table as colourful HTML — paste into Keynote, Mail, or Notes"
            @click="copyImpactStepTable()"
          ><CopyGlyph size="compact" />Copy</button>
          <button
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                   bg-blue-50 border border-blue-400 text-blue-700
                   hover:bg-blue-100 transition-colors"
            title="Email this Value × Evo Step table — opens Mail, ⌘V to paste colourful version"
            @click="emailImpactStepTable()"
          ><EmailGlyph size="compact" />Email</button>
          <button
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                   bg-violet-50 border border-violet-400 text-violet-700
                   hover:bg-violet-100 transition-colors"
            title="Download this Value × Evo Step table as an HTML file"
            @click="downloadImpactStepTable()"
          ><GetGlyph size="compact" />Download</button>
        </div>

        <!-- ── V × Solution editor (SECONDARY here — feeds the V × Step view above)
             Kept on this page so users can sharpen the underlying V × S estimates
             and watch the V × Step aggregations update reactively above. -->
        <ImpactEstimationView
          ref="ietRef"
          :values="currentSpec.values"
          :solutions="currentSpec.solutions"
          :resource-claims="{}"
          @matrix-updated="(matrix, efficiency, cal, cap) => _onMatrixUpdated(matrix, efficiency, cal, cap)"
        />
        <!-- V × Solution table actions — Tom 2026-06-05: "each diagram needs copy, email, download buttons"
             These buttons export THIS TABLE specifically, not the full Planguage spec. -->
        <div
          v-if="currentSpec"
          class="flex flex-wrap items-center gap-2 px-4 py-2.5 mb-6 rounded-b-xl
                 bg-indigo-50 border border-t-0 border-indigo-200"
        >
          <span class="text-[11px] text-indigo-700 font-semibold mr-auto">Value × Solution Impact</span>
          <button
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                   bg-emerald-50 border border-emerald-400 text-emerald-700
                   hover:bg-emerald-100 transition-colors"
            title="Copy this Value × Solution table as colourful HTML — paste into Keynote, Mail, or Notes"
            @click="copyImpactSolutionTable()"
          ><CopyGlyph size="compact" />Copy</button>
          <button
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                   bg-blue-50 border border-blue-400 text-blue-700
                   hover:bg-blue-100 transition-colors"
            title="Email this Value × Solution table — opens Mail, ⌘V to paste colourful version"
            @click="emailImpactSolutionTable()"
          ><EmailGlyph size="compact" />Email</button>
          <button
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                   bg-violet-50 border border-violet-400 text-violet-700
                   hover:bg-violet-100 transition-colors"
            title="Download this Value × Solution table as an HTML file"
            @click="downloadImpactSolutionTable()"
          ><GetGlyph size="compact" />Download</button>
        </div>
        <!-- Bottom mirror — Tom 2026-06-04 DD-014 (Top-and-Bottom Navigation
             Mirror): top has Return + Value Flow + Copy + Email; bottom
             mirrors with the LARGE current-stage pin + Return + Copy + Email
             + forward action.  Tom 2026-06-04: "include the large pin with
             current stage … at top" — the user finishes work at the bottom
             and must still know what stage they are in without scrolling up.
             Separated from body by `border-t pt-4 mt-8` so it reads as the
             closing handshake of this work block. -->
        <div class="w-full max-w-2xl mt-8 pt-4 border-t border-slate-200 flex flex-wrap items-center gap-3">
          <!-- LARGE current-stage pin (mirror of the one at top, lines ~5133-5179) -->
          <div
            v-if="currentStageInfo"
            class="inline-flex items-center gap-3 rounded-2xl pl-3 pr-5 py-3 select-none
                   text-base font-bold text-white
                   bg-gradient-to-r from-indigo-500 to-violet-500
                   shadow-lg ring-2 ring-indigo-300/40"
            :title="`Stage ${currentStageInfo.stage} · ${currentStageInfo.label} (current stage)`"
            :aria-label="`Stage ${currentStageInfo.stage} · ${currentStageInfo.label}`"
          >
            <span class="text-[11px] font-extrabold leading-none bg-black/60 text-white rounded-md px-2 py-1.5"
                  aria-hidden="true">{{ currentStageInfo.stage }}</span>
            <span class="shrink-0 inline-flex items-center justify-center bg-white rounded-lg p-1 shadow-sm">
              <PlTypeIcon :pl-type="currentStageInfo.plType" size="lg" />
            </span>
            <span class="flex flex-col items-start leading-tight">
              <span class="text-[9px] font-semibold uppercase tracking-[0.15em] text-indigo-200">Stage Now</span>
              <span class="text-base font-extrabold text-white">{{ currentStageInfo.label }}</span>
            </span>
          </div>
          <!-- Tom 2026-06-04 — REMOVED the "Return to Evo Plan" backward
               button.  Reason (Tom verbatim, same message that approved the
               Plan Tasks removal): *"same with the return to evo plan, drop"*.
               At Stage 10 (Resources) the Evo Plan is upstream by 4 stages;
               a backward link here implies the user needs to revisit, which
               contradicts the forward flow.  Stage bar at top remains the
               navigation surface for jumping anywhere.  Permanent-surface
               drop approved by Tom in chat. -->
          <button
            v-if="currentSpec"
            type="button"
            class="flex items-center gap-2 px-4 py-2.5 rounded-xl min-h-[44px]
                   bg-emerald-50 border-2 border-emerald-400 text-emerald-700 text-sm font-semibold
                   hover:bg-emerald-100 hover:border-emerald-500 hover:shadow-md
                   focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-1
                   transition-all duration-150 shadow-sm"
            aria-label="Copy plan to clipboard (bottom)"
            title="COPY — duplicate this Spec to your clipboard.&#10;Paste into Notes, Mail, Slack, or anywhere.&#10;&#10;Planguage glyph [*]=[*] reads &quot;vessel equals vessel&quot;:&#10;the Spec is duplicated, both copies are identical."
            @click="autoCopyPlan()"
          >
            <CopyGlyph size="standard" />
            <span>Copy</span>
          </button>
          <button
            v-if="currentSpec"
            type="button"
            class="flex items-center gap-2 px-4 py-2.5 rounded-xl min-h-[44px]
                   bg-blue-50 border-2 border-blue-400 text-blue-700 text-sm font-semibold
                   hover:bg-blue-100 hover:border-blue-500 hover:shadow-md
                   focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1
                   transition-all duration-150 shadow-sm"
            aria-label="Email plan via Mail.app (bottom)"
            title="EMAIL — open your default mail client with the Spec ready to paste.&#10;The full Spec is auto-copied to your clipboard;&#10;paste it into the email body, then send.&#10;&#10;Planguage glyph [*]→@ reads &quot;vessel sent to address&quot;:&#10;the Spec is sent to a remote recipient at an @ address."
            @click="emailPlan()"
          >
            <EmailGlyph size="standard" />
            <span>Email</span>
          </button>
          <!-- Tom 2026-06-04 — REMOVED the "Plan Tasks →" forward button from
               this bottom mirror.  Reason (Tom verbatim): *"it is not clear
               why this is here at all, they should be done now, is it a sign
               they are not here ? … I think we drop it, right"*.  At Stage 10
               (Resources) Tasks are expected to be DONE, so a forward link to
               Tasks here implies the opposite and confuses the flow. -->

          <!-- Forward → Stage 11 Export.  Tom 2026-06-04 verbatim: *"But there
               is no forward button to next export dtag"*.  Stage 11 IS the
               natural next-stage after Resources (10), so a single forward
               affordance leads cleanly into Export.  Pushed to far right
               with `ml-auto` to read as "complete this stage and proceed". -->
          <!-- Tom 2026-06-04 r83 — STAGE-AWARE forward button.  The stage===3
               body renders for several planningStages (5 Refine routed via
               STAGE_ACTION_MAP[5]='to-impact'; 7 Evo Impact; 10 Resources via
               legacy routing — though planningStage===10 now has its own
               template that takes precedence).  The previous hardcoded
               "Next → Stage 11 · Export" was correct ONLY at Stage 10.  At
               Stage 5 it should advance to Stage 6 Evo Steps, at Stage 7 to
               Stage 8 Tasks, etc.  Now nextStageInfo drives both label and
               click target: when nextStageInfo.stage===11 fire exportFull()
               (the only stage with a side-effect, not a pure navigation);
               otherwise handleStageBarNav(nextStageInfo.stage). -->
          <button
            v-if="currentSpec && nextStageInfo"
            type="button"
            class="ml-auto flex items-center gap-3 px-5 py-3 rounded-2xl min-h-[52px]
                   bg-gradient-to-r from-amber-500 to-orange-500 text-white
                   font-bold text-sm shadow-md shadow-amber-200/70
                   hover:from-amber-600 hover:to-orange-600 hover:shadow-lg
                   focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2
                   transition-all duration-200 active:scale-[0.98]"
            :aria-label="`Next: Stage ${nextStageInfo.stage} · ${nextStageInfo.label}`"
            :title="`Advance to Stage ${nextStageInfo.stage} · ${nextStageInfo.label} — ${nextStageInfo.title}`"
            @click="nextStageInfo.stage === 11 ? exportFull() : handleStageBarNav(nextStageInfo.stage)"
          >
            <div class="text-right leading-tight">
              <div class="text-[10px] font-normal opacity-85 uppercase tracking-wide">Next → Stage {{ nextStageInfo.stage }}</div>
              <div class="font-extrabold leading-tight">{{ nextStageInfo.label }}</div>
            </div>
            <span class="text-xl leading-none" aria-hidden="true">→</span>
          </button>
        </div>
      </template>

      <!-- Planning-bar stage 9: Study-Act data collection.  Tom 2026-06-03 *"EVO STEP
           DATA COLLECTION: Stage 9 study, act. There is nothing there, so lets put
           something in place. A Frame for Evo Step Data Collection."*  This block wins
           over the stage===4 Tasks view BECAUSE the planning bar's stage 9 sets
           planningStage=9 while leaving internal stage at 4 (no internal slot exists
           for Study-Act).  Order in the v-else-if chain matters — first match wins. -->
      <template v-else-if="planningStage === 9 && currentSpec">
        <div class="w-full max-w-2xl mb-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            class="flex items-center gap-3 px-5 py-3 rounded-2xl min-h-[52px]
                   bg-gradient-to-r from-blue-500 to-violet-500 text-white
                   font-semibold text-sm shadow-md shadow-blue-200/70
                   hover:from-blue-600 hover:to-violet-600 hover:shadow-lg
                   focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2
                   transition-all duration-200 active:scale-[0.98]"
            aria-label="Back to Stage 8 · Tasks"
            @click="handleStageBarNav(8)"
          >
            <span class="text-xl leading-none" aria-hidden="true">←</span>
            <div class="text-left">
              <div class="text-[10px] font-normal opacity-75 uppercase tracking-wide">Return to Stage 8</div>
              <div class="font-bold leading-tight">Tasks</div>
            </div>
          </button>
          <button
            type="button"
            class="flex items-center gap-3 px-5 py-3 rounded-2xl min-h-[52px]
                   bg-gradient-to-r from-amber-500 to-orange-500 text-white
                   font-semibold text-sm shadow-md shadow-amber-200/70
                   hover:from-amber-600 hover:to-orange-600 hover:shadow-lg
                   focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2
                   transition-all duration-200 active:scale-[0.98]"
            aria-label="Next: Stage 10 · Resources"
            @click="handleStageBarNav(10)"
          >
            <div class="text-right">
              <div class="text-[10px] font-normal opacity-75 uppercase tracking-wide">Next → Stage 10</div>
              <div class="font-bold leading-tight">Resources</div>
            </div>
            <span class="text-xl leading-none" aria-hidden="true">→</span>
          </button>
        </div>
        <StudyActDataCollection
          :spec="currentSpec"
          :steps="_stepsForDiagram"
          :plan-id="specModel?.name ?? 'default'"
          @close="handleStageBarNav(8)"
        />

        <!-- Bottom-mirror of the top stage nav.  Tom 2026-06-04 Rule 12
             (Top-and-Bottom Navigation Mirror, DD-014): when the user finishes
             a long sequence of work they are at the bottom — they should not
             have to scroll back up to find Return / Next.  Tom 2026-06-04
             also: "include the large pin with current stage … at top" —
             so the bottom mirror leads with the same big current-stage pin. -->
        <div class="w-full max-w-2xl mt-8 pt-4 border-t border-slate-200 flex flex-wrap items-center gap-3">
          <!-- LARGE current-stage pin (mirror of top, lines ~5133-5179) -->
          <div
            v-if="currentStageInfo"
            class="inline-flex items-center gap-3 rounded-2xl pl-3 pr-5 py-3 select-none
                   text-base font-bold text-white
                   bg-gradient-to-r from-indigo-500 to-violet-500
                   shadow-lg ring-2 ring-indigo-300/40"
            :title="`Stage ${currentStageInfo.stage} · ${currentStageInfo.label} (current stage)`"
            :aria-label="`Stage ${currentStageInfo.stage} · ${currentStageInfo.label}`"
          >
            <span class="text-[11px] font-extrabold leading-none bg-black/60 text-white rounded-md px-2 py-1.5"
                  aria-hidden="true">{{ currentStageInfo.stage }}</span>
            <span class="shrink-0 inline-flex items-center justify-center bg-white rounded-lg p-1 shadow-sm">
              <PlTypeIcon :pl-type="currentStageInfo.plType" size="lg" />
            </span>
            <span class="flex flex-col items-start leading-tight">
              <span class="text-[9px] font-semibold uppercase tracking-[0.15em] text-indigo-200">Stage Now</span>
              <span class="text-base font-extrabold text-white">{{ currentStageInfo.label }}</span>
            </span>
          </div>
          <button
            type="button"
            class="flex items-center gap-3 px-5 py-3 rounded-2xl min-h-[52px]
                   bg-gradient-to-r from-blue-500 to-violet-500 text-white
                   font-semibold text-sm shadow-md shadow-blue-200/70
                   hover:from-blue-600 hover:to-violet-600 hover:shadow-lg
                   focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2
                   transition-all duration-200 active:scale-[0.98]"
            aria-label="Back to Stage 8 · Tasks"
            @click="handleStageBarNav(8)"
          >
            <span class="text-xl leading-none" aria-hidden="true">←</span>
            <div class="text-left">
              <div class="text-[10px] font-normal opacity-75 uppercase tracking-wide">Return to Stage 8</div>
              <div class="font-bold leading-tight">Tasks</div>
            </div>
          </button>
          <button
            type="button"
            class="flex items-center gap-3 px-5 py-3 rounded-2xl min-h-[52px]
                   bg-gradient-to-r from-amber-500 to-orange-500 text-white
                   font-semibold text-sm shadow-md shadow-amber-200/70
                   hover:from-amber-600 hover:to-orange-600 hover:shadow-lg
                   focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2
                   transition-all duration-200 active:scale-[0.98]"
            aria-label="Next: Stage 10 · Resources"
            @click="handleStageBarNav(10)"
          >
            <div class="text-right">
              <div class="text-[10px] font-normal opacity-75 uppercase tracking-wide">Next → Stage 10</div>
              <div class="font-bold leading-tight">Resources</div>
            </div>
            <span class="text-xl leading-none" aria-hidden="true">→</span>
          </button>
        </div>
      </template>

      <!-- Stage 4: Task Decomposition — decompose prioritised evo steps into concrete tasks -->
      <template v-else-if="stage === 4">
        <div class="w-full max-w-2xl mb-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            class="flex items-center gap-3 px-5 py-3 rounded-2xl min-h-[52px]
                   bg-gradient-to-r from-blue-500 to-violet-500 text-white
                   font-semibold text-sm shadow-md shadow-blue-200/70
                   hover:from-blue-600 hover:to-violet-600 hover:shadow-lg
                   focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2
                   transition-all duration-200 active:scale-[0.98]"
            aria-label="Back to Stage 7 · Evo Impact (Impact Estimation)"
            @click="_closeAllOverlays(); stage = 3"
          >
            <span class="text-xl leading-none" aria-hidden="true">←</span>
            <div class="text-left">
              <div class="text-[10px] font-normal opacity-75 uppercase tracking-wide">Return to Stage 7</div>
              <div class="font-bold leading-tight">Impact Estimation</div>
            </div>
          </button>
          <button
            v-if="currentSpec"
            type="button"
            class="flex items-center gap-2 px-4 py-2.5 rounded-xl min-h-[44px]
                   bg-white border border-indigo-200 text-indigo-700 text-sm font-medium
                   hover:bg-indigo-50 hover:border-indigo-300
                   focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-1
                   transition-all duration-150 shadow-sm"
            aria-label="Open Value Flow Diagram"
            title="Open Value Flow Diagram"
            @click="valueFlowOpen = true"
          >
            <svg width="44" height="20" viewBox="0 0 44 20" fill="none" aria-hidden="true">
              <rect x="0"  y="2" width="5" height="16" rx="1.5" fill="#374151"/>
              <rect x="8"  y="2" width="5" height="16" rx="1.5" fill="#ca8a04"/>
              <rect x="16" y="2" width="5" height="16" rx="1.5" fill="#ea580c"/>
              <rect x="24" y="2" width="5" height="16" rx="1.5" fill="#7c3aed"/>
              <rect x="32" y="2" width="5" height="16" rx="1.5" fill="#16a34a"/>
              <rect x="40" y="2" width="4" height="16" rx="1.5" fill="#2563eb"/>
              <line x1="5"  y1="10" x2="8"  y2="10" stroke="#d1d5db" stroke-width="1"/>
              <line x1="13" y1="10" x2="16" y2="10" stroke="#d1d5db" stroke-width="1"/>
              <line x1="21" y1="10" x2="24" y2="10" stroke="#d1d5db" stroke-width="1"/>
              <line x1="29" y1="10" x2="32" y2="10" stroke="#d1d5db" stroke-width="1"/>
              <line x1="37" y1="10" x2="40" y2="10" stroke="#d1d5db" stroke-width="1"/>
            </svg>
            <span>Value Flow</span>
          </button>

          <!-- Copy tasks to clipboard — universal copy rule (Tom 2026-05-29:
               "email everywhere we find copy") -->
          <button
            v-if="currentSpec && _stepsForDiagram.length > 0"
            type="button"
            class="flex items-center gap-2 px-4 py-2.5 rounded-xl min-h-[44px]
                   bg-emerald-50 border-2 border-emerald-400 text-emerald-700 text-sm font-semibold
                   hover:bg-emerald-100 hover:border-emerald-500 hover:shadow-md
                   focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-1
                   transition-all duration-150 shadow-sm"
            aria-label="Copy tasks to clipboard"
            title="COPY — duplicate this task plan to your clipboard.&#10;Paste into Notes, Mail, Slack, or anywhere.&#10;&#10;Planguage glyph [*]=[*] reads &quot;vessel equals vessel&quot;:&#10;the Spec is duplicated, both copies are identical."
            @click="autoCopyPlan()"
          >
            <CopyGlyph size="standard" />
            <span>Copy</span>
          </button>

          <!-- Email tasks — universal email rule: email wherever copy appears -->
          <button
            v-if="currentSpec && _stepsForDiagram.length > 0"
            type="button"
            class="flex items-center gap-2 px-4 py-2.5 rounded-xl min-h-[44px]
                   bg-blue-50 border-2 border-blue-400 text-blue-700 text-sm font-semibold
                   hover:bg-blue-100 hover:border-blue-500 hover:shadow-md
                   focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1
                   transition-all duration-150 shadow-sm"
            aria-label="Email tasks via Mail.app"
            title="EMAIL — open your default mail client with this task plan ready to paste.&#10;The full Spec is auto-copied to your clipboard;&#10;paste it into the email body, then send.&#10;&#10;Planguage glyph [*]→@ reads &quot;vessel sent to address&quot;:&#10;the Spec is sent to a remote recipient at an @ address."
            @click="emailPlan()"
          >
            <EmailGlyph size="standard" />
            <span>Email</span>
          </button>
        </div>
        <!-- _stepsForDiagram = live plan steps (preferred), or confirmedSteps as legacy fallback.
             Precedence reversed 2026-06-03 so re-generated plans appear without re-confirming
             (Tom: "regenerated and got 3 steps, but the next step had only the previous 2").
             Still prevents "No Evo steps available" before any plan generation (Tom 2026-05-29). -->
        <TaskList
          :steps="_stepsForDiagram"
          :spec="currentSpec"
          @update:tasks-by-step="tasksByStep = $event"
        />
        <!-- DD-014 bottom nav mirror — Tasks (stage 4) → Study-Act (stage 9).
             Bug fixed 2026-06-05: was "NEXT → STAGE 11 · Export" calling exportFull(),
             which skipped Study-Act (9) and Resources (10).  Correct next step from
             Tasks is Stage 9 (Study-Act), matching the primaryActionLabel logic at
             stage===4 above (handleStageBarNav(9)). -->
        <div class="w-full max-w-2xl mt-4">
          <button
            type="button"
            class="w-full flex items-center justify-center gap-2 min-h-[52px] rounded-lg bg-green-600 px-6 py-3 text-sm font-bold text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
            aria-label="Next: Stage 9 · Study-Act — measure delivered value and learn"
            title="Advance to Stage 9 · Study-Act — deliver the Evo Step, measure actual value, loop back to update the spec"
            @click="handleStageBarNav(9)"
          >
            <span class="text-[10px] font-semibold uppercase tracking-[0.15em] opacity-85">Next → Stage 9</span>
            <span>· Study-Act →</span>
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </template>

      <!-- Stage 5 / planningStage 11: Exported prioritised plan.
           Tom 2026-06-04: *"at that last export step, we need at both top and
           bottom copy email and download buttons, and then buttons for stop
           and save, or go back to any stage (click on stage button) or list
           those buttons at bottom (what is best??)"*.
           Tom-approved design A: TOP + BOTTOM mirrors with Copy / Email /
           Download / Save, plus a small "↑ Click any stage above to revisit"
           hint at the bottom pointing back to the always-visible stage bar
           (which IS the canonical "go to any stage" surface — MOVE-compliant,
           always visible in the sticky header). No 11-button row at the
           bottom — that would duplicate the stage bar and add clutter. -->
      <template v-else-if="stage === 5 && currentSpec">
        <!-- ── TOP action bar — Copy + Email + Download + Save ──────────── -->
        <div class="w-full max-w-3xl mb-4 flex flex-wrap items-center gap-3">
          <button
            v-if="currentSpec"
            type="button"
            class="flex items-center gap-2 px-4 py-2.5 rounded-xl min-h-[44px]
                   bg-emerald-50 border-2 border-emerald-400 text-emerald-700 text-sm font-semibold
                   hover:bg-emerald-100 hover:border-emerald-500 hover:shadow-md
                   focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-1
                   transition-all duration-150 shadow-sm"
            aria-label="Copy Spec to clipboard"
            title="COPY — duplicate this Spec to your clipboard.&#10;Paste into Notes, Mail, Keynote, anywhere.&#10;&#10;Planguage glyph [*]=[*] reads &quot;vessel equals vessel&quot;."
            @click="autoCopyPlan()"
          >
            <CopyGlyph size="standard" />
            <span>Copy</span>
          </button>
          <button
            v-if="currentSpec"
            type="button"
            class="flex items-center gap-2 px-4 py-2.5 rounded-xl min-h-[44px]
                   bg-blue-50 border-2 border-blue-400 text-blue-700 text-sm font-semibold
                   hover:bg-blue-100 hover:border-blue-500 hover:shadow-md
                   focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1
                   transition-all duration-150 shadow-sm"
            aria-label="Email Spec via default mail client"
            title="EMAIL — open your default mail client with the colourful Spec ready to paste.&#10;Press ⌘V in the body to paste, then Send."
            @click="emailPlan()"
          >
            <EmailGlyph size="standard" />
            <span>Email</span>
          </button>
          <button
            v-if="currentSpec"
            type="button"
            class="flex items-center gap-2 px-4 py-2.5 rounded-xl min-h-[44px]
                   bg-violet-50 border-2 border-violet-400 text-violet-700 text-sm font-semibold
                   hover:bg-violet-100 hover:border-violet-500 hover:shadow-md
                   focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-1
                   transition-all duration-150 shadow-sm"
            aria-label="Download Spec as a text file"
            title="DOWNLOAD — save the Spec as a .txt file to your Downloads folder."
            @click="downloadPlan()"
          >
            <GetGlyph size="standard" />
            <span>Download</span>
          </button>
          <button
            type="button"
            class="flex items-center gap-2 px-4 py-2.5 rounded-xl min-h-[44px]
                   bg-slate-50 border-2 border-slate-400 text-slate-700 text-sm font-semibold
                   hover:bg-slate-100 hover:border-slate-500 hover:shadow-md
                   focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1
                   transition-all duration-150 shadow-sm"
            aria-label="Save Spec now (snapshot to local storage)"
            title="SAVE — snapshot the current Spec now.&#10;Planguage glyph *→[*] reads &quot;asterisk to vessel&quot;: content stored."
            @click="_saveNow(); currentSpec && specModel && saveSpecSnapshot(currentSpec); showToast('💾 Spec saved', 3000)"
          >
            <SaveGlyph size="standard" />
            <span>Save</span>
          </button>
        </div>

        <PrioritisedPlanView
          :spec="currentSpec"
          :original-input="originalInput"
          :evo-steps="confirmedSteps"
          :tasks-by-step="tasksByStep"
          :impact-matrix="capturedImpactMatrix"
          :vc-ratios="capturedVCRatios"
          :calendar-costs="capturedCalendarCosts"
          :capital-costs="capturedCapitalCosts"
          :plan-name="specModel?.name"
          :plan-version="specModel?.version"
          :plan-saved-at="specModel?.updatedAt"
          :sharpened-entry-ids="sharpenedEntryIds"
          :sharpen-summary="sharpenSummary"
          :is-model-mode="isModelMode"
          @start-over="stage = 1"
          @email="emailPlan"
          @open-editor="({ tab, entryId }) => _openSpecEditor({ tab, entryId })"
          @open-priority="({ entryId, entryType, description }) => { _priorityEntryId = entryId; _priorityEntryType = entryType; _priorityEntryDesc = description ?? ''; priorityPanelOpen = true }"
          @open-priority-info="priorityInfoOpen = true"
          @open-edit-info="editInfoOpen = true"
          @open-value-flow="valueFlowOpen = true"
          @open-visualise="({ tab }) => { _vizInitialTab = tab; visualiseOpen = true }"
          @go-to-tasks="stage = 4"
          @open-model-dashboard="modelDashboardOpen = true"
        />

        <!-- ── BOTTOM MIRROR — Tom 2026-06-04 DD-014 + MOVE: Copy / Email /
             Download / Save mirrored here so user reaching end-of-export
             never has to scroll back up.  LARGE current-stage pin leads
             (Stage Now · 11 · Export) so user knows they're at Export.
             Small "↑ Click any stage above to revisit" hint points to the
             always-visible stage bar (the canonical "go anywhere" surface).
             Tom's question answered: option A wins — don't duplicate the
             11 stage buttons here; the stage bar IS the revisit surface. -->
        <div class="w-full max-w-3xl mt-8 pt-4 border-t border-slate-200 flex flex-wrap items-center gap-3">
          <div
            v-if="currentStageInfo"
            class="inline-flex items-center gap-3 rounded-2xl pl-3 pr-5 py-3 select-none
                   text-base font-bold text-white
                   bg-gradient-to-r from-emerald-500 to-teal-500
                   shadow-lg ring-2 ring-emerald-300/40"
            :title="`Stage ${currentStageInfo.stage} · ${currentStageInfo.label} (current stage)`"
            :aria-label="`Stage ${currentStageInfo.stage} · ${currentStageInfo.label}`"
          >
            <span class="text-[11px] font-extrabold leading-none bg-black/60 text-white rounded-md px-2 py-1.5"
                  aria-hidden="true">{{ currentStageInfo.stage }}</span>
            <span class="shrink-0 inline-flex items-center justify-center bg-white rounded-lg p-1 shadow-sm">
              <PlTypeIcon :pl-type="currentStageInfo.plType" size="lg" />
            </span>
            <span class="flex flex-col items-start leading-tight">
              <span class="text-[9px] font-semibold uppercase tracking-[0.15em] text-emerald-100">Stage Now</span>
              <span class="text-base font-extrabold text-white">{{ currentStageInfo.label }}</span>
            </span>
          </div>
          <button
            v-if="currentSpec"
            type="button"
            class="flex items-center gap-2 px-4 py-2.5 rounded-xl min-h-[44px]
                   bg-emerald-50 border-2 border-emerald-400 text-emerald-700 text-sm font-semibold
                   hover:bg-emerald-100 hover:border-emerald-500 hover:shadow-md
                   focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-1
                   transition-all duration-150 shadow-sm"
            aria-label="Copy Spec to clipboard (bottom)"
            title="COPY — duplicate this Spec to your clipboard.&#10;Paste into Notes, Mail, Keynote, anywhere."
            @click="autoCopyPlan()"
          >
            <CopyGlyph size="standard" />
            <span>Copy</span>
          </button>
          <button
            v-if="currentSpec"
            type="button"
            class="flex items-center gap-2 px-4 py-2.5 rounded-xl min-h-[44px]
                   bg-blue-50 border-2 border-blue-400 text-blue-700 text-sm font-semibold
                   hover:bg-blue-100 hover:border-blue-500 hover:shadow-md
                   focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1
                   transition-all duration-150 shadow-sm"
            aria-label="Email Spec via default mail client (bottom)"
            title="EMAIL — open your default mail client with the colourful Spec ready to paste."
            @click="emailPlan()"
          >
            <EmailGlyph size="standard" />
            <span>Email</span>
          </button>
          <button
            v-if="currentSpec"
            type="button"
            class="flex items-center gap-2 px-4 py-2.5 rounded-xl min-h-[44px]
                   bg-violet-50 border-2 border-violet-400 text-violet-700 text-sm font-semibold
                   hover:bg-violet-100 hover:border-violet-500 hover:shadow-md
                   focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-1
                   transition-all duration-150 shadow-sm"
            aria-label="Download Spec as a text file (bottom)"
            title="DOWNLOAD — save the Spec as a .txt file to your Downloads folder."
            @click="downloadPlan()"
          >
            <GetGlyph size="standard" />
            <span>Download</span>
          </button>
          <button
            type="button"
            class="flex items-center gap-2 px-4 py-2.5 rounded-xl min-h-[44px]
                   bg-slate-50 border-2 border-slate-400 text-slate-700 text-sm font-semibold
                   hover:bg-slate-100 hover:border-slate-500 hover:shadow-md
                   focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1
                   transition-all duration-150 shadow-sm"
            aria-label="Save Spec now (bottom)"
            title="SAVE — snapshot the current Spec now."
            @click="_saveNow(); currentSpec && specModel && saveSpecSnapshot(currentSpec); showToast('💾 Spec saved', 3000)"
          >
            <SaveGlyph size="standard" />
            <span>Save</span>
          </button>
          <div class="basis-full"></div>
          <div class="text-[11px] text-slate-500 italic flex items-center gap-1">
            <span aria-hidden="true">↑</span>
            Click any stage in the bar above to revisit it — the stage bar is your "go anywhere" surface.
          </div>
        </div>
      </template>
    </template>

    <!-- Feature #16: Collaboration Cursors overlay — active when in app view with a user -->
    <CollaborationCursors
      v-if="view === 'app' && user"
      :cursors="remoteCursors"
    />

    <!-- ── Next Step — the only always-visible right-side action button.
         Primary forward action. Disappears when there is no obvious next step.
         Teleported to <body> to guarantee it renders in the root stacking context
         and can never be obscured by any ancestor's stacking context.
         Button layout: ⚡ Actions + Mic + Speaker sit at top-4 right-4 (control-pins rule
         2026-05-26 — all control pins at TOP, never floating bottom).
         Next Step pill MOVED 2026-05-31 — was bottom-52 left-6 (violation); now lives
         in the plan identity bar action cluster. -->

    <!-- 🆘 Fresh Start pill REMOVED 2026-05-27 — control-pins rule ("ALL CONTROL PINS
         ARE AT TOP LINES, NEVER FLOATING BOTTOM LEFT OR RIGHT", Tom 2026-05-26).
         Fresh Start is now accessible via ⚡ Actions menu → Planning → 🆘 Fresh Start.
         Panic-reset (Tier 2 Esc) remains as keyboard-only fallback for stuck-UI cases. -->

    <!-- Fresh Start menu (2026-05-14) — opened from ⚡ Actions menu entry.
         Registered as an exclusive surface so opening it auto-closes all other panels. -->
    <FreshStartMenu
      :open="freshStartOpen"
      :history="specHistory"
      @close="freshStartOpen = false"
      @fresh-canvas="_onFreshCanvas"
      @save-and-stop="_onSaveAndStop"
      @rollback="_onRollback"
      @close-stuck-ui="_onCloseStuckUi"
    />

    <!-- Hidden file input for Restore — triggered by menu Restore Plans item -->
    <input
      ref="restoreFileInputRef"
      type="file"
      accept=".json,application/json"
      class="sr-only"
      aria-hidden="true"
      @change="handleRestoreFile"
    />

    <!-- Click-outside backdrop + ⋯ Actions Menu — teleported to <body> so both
         always sit in the root stacking context and can never be blocked by any
         ancestor stacking context inside the page. -->
    <Teleport to="body">
      <!-- Click-outside backdrop for rename popover ONLY.
           2026-05-29: removed menuOpen from this condition — ActionsHubPanel
           (z-[600]) now has its own z-[479] backdrop that handles click-outside
           for the Actions hub. The old z-[375] backdrop was covering the Plan
           Crest (z-[300]) whenever the Actions hub was open, killing SOS and
           all other Plan Crest buttons. menuOpen click-outside is fully handled
           by ActionsHubPanel's backdrop. This backdrop now only serves the
           rename popover (which has no backdrop of its own). -->
      <div
        v-if="view === 'app' && renamePopoverOpen"
        class="fixed inset-0 z-[375]"
        aria-hidden="true"
        @click="renamePopoverOpen = false"
      />

      <!-- ── Control Pins cluster — ⚡ Actions / 🎤 Mic / 🔊 Speaker.
           Control-pins rule 2026-05-26: ALL control pins live at TOP, never floating
           bottom-left or bottom-right (Tom: "ALL CONTROL PINS ARE AT TOP LINES").
           Buttons row appears first; popovers (menu, rename) drop DOWN below the row.
           Container sits at z-[9999] — above the z-[375] click-outside backdrop.
           Hidden when any full-screen modal is open (comparison, plan-input, plan-models). -->
      <!-- Design log r08 2026-05-27: Moved outside !specModel guard so the menu
           dropdown renders when specModel exists (compact Plan Crest bar case).
           Previously: cluster was v-if="!specModel" so clicking the compact
           ⚡ button in the Plan Crest bar toggled menuOpen but the dropdown
           never rendered (it was hidden inside the !specModel cluster). Fix:
           allow cluster to render when menuOpen||renamePopoverOpen even if
           specModel exists. Buttons row is v-if="!specModel" to prevent
           duplication (they're already in the Plan Crest bar when plan loaded). -->
      <div
        v-if="view === 'app' && (!specModel || menuOpen || renamePopoverOpen) && !comparisonOpen && !specInputOpen && !modelsOpen && !wizardOpen && !historyOpen && !specEditorOpen"
        :class="['fixed z-[9999] flex flex-col items-end gap-2', specModel ? 'top-10 right-4' : 'top-4 right-4']"
      >

      <!-- 🎤 Mic + 🔊 Speaker + ⚡ Actions + 🆘 SOS — control pins (no-plan state only).
           When specModel exists these buttons live in the Plan Crest bar instead.
           Tom 2026-05-13: "mic and speaker need to be on the surface at all times."
           Tom 2026-05-26: control-pins rule — at TOP, never bottom-left or -right.
           SOS added here 2026-05-29: after startFresh() specModel=null hides the
           Plan Crest, removing the SOS button. Tom was stuck with no escape. SOS
           must always be reachable regardless of plan state. -->
      <div v-if="!specModel" class="flex items-center gap-2">
        <!-- 🆘 SOS — always red, always present even with no plan loaded -->
        <button
          type="button"
          class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-extrabold transition-all
                 bg-red-600/90 text-white hover:bg-red-500 ring-1 ring-red-400/60 hover:ring-red-300
                 focus:outline-none focus:ring-2 focus:ring-red-300 shadow-md"
          aria-label="SOS — open reset menu"
          title="🆘 SOS — click to open reset options"
          @click="freshStartOpen = true"
        >🆘</button>
        <DictateButton
          :active="dictationActive"
          :supported="dictationSupported"
          @toggle="toggleDictation()"
        />
        <SpeakerButton
          :text="speakerText"
          @speak="handleSpeak"
        />
        <button
          type="button"
          :aria-expanded="menuOpen"
          aria-haspopup="true"
          aria-label="Open Actions menu (⌘A)"
          title="Actions menu — press ⌘A from anywhere"
          :class="[
            'flex items-center gap-2 px-4 py-2.5 rounded-2xl shadow-xl select-none',
            'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-400 transition-all duration-200',
            menuOpen
              ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-violet-300/60 scale-105'
              : 'bg-gradient-to-br from-violet-500 to-indigo-500 text-white hover:from-violet-600 hover:to-indigo-600 hover:scale-105 shadow-violet-300/40'
          ]"
          @click="toggleMenu"
        >
          <span aria-hidden="true" class="text-lg leading-none transition-transform duration-200" :class="menuOpen ? 'rotate-90' : ''">⚡</span>
          <span class="text-sm font-bold tracking-wide">Actions</span>
          <kbd class="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded
                      bg-white/20 text-white/90 font-mono text-[10px] leading-none
                      ring-1 ring-white/30">⌘A</kbd>
          <span aria-hidden="true" class="text-xs opacity-70 transition-transform duration-200" :class="menuOpen ? 'rotate-180' : ''">▾</span>
        </button>
      </div>

      <!-- Rename / Owner popover — opens below the control pins row -->
      <div
        v-if="renamePopoverOpen"
        class="w-72 rounded-xl bg-white shadow-2xl border border-indigo-100 p-3 space-y-2"
        role="dialog"
        aria-label="Edit spec name and owner"
      >
        <p class="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Spec Identity</p>

        <!-- Plan name -->
        <div class="space-y-0.5">
          <label class="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Name</label>
          <input
            v-model="renameInputVal"
            type="text"
            class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900
                   focus:outline-none focus:ring-2 focus:ring-indigo-400"
            placeholder="Plan name…"
            aria-label="New plan name"
            @keydown.enter="submitRename"
            @keydown.escape="renamePopoverOpen = false"
          />
        </div>

        <!-- Responsible owner (Planguage concept) -->
        <div class="space-y-0.5">
          <label class="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Owner</label>
          <input
            v-model="renameOwnerVal"
            type="text"
            class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900
                   focus:outline-none focus:ring-2 focus:ring-indigo-400"
            placeholder="Responsible owner…"
            aria-label="Plan owner name"
            @keydown.enter="submitRename"
            @keydown.escape="renamePopoverOpen = false"
          />
          <p class="text-[10px] text-gray-400 leading-tight pl-0.5">
            Planguage "responsible" — who is accountable for this plan
          </p>
        </div>

        <div class="flex gap-2">
          <button
            type="button"
            class="flex-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white
                   hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors"
            @click="submitRename"
          >
            <span class="inline-flex items-center gap-1.5">
              <SaveGlyph size="compact" class="h-3 w-auto" aria-hidden="true" />
              <span>Save</span>
            </span>
          </button>
          <button
            type="button"
            class="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600
                   hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-colors"
            @click="renamePopoverOpen = false"
          >Cancel</button>
        </div>
      </div>

      <!-- ActionsHubPanel tile grid is mounted separately (registered in template near ToolInfoPanel). -->

      </div><!-- /control-pins + dropdowns container -->
    </Teleport>

    <!-- 💡 SelectionDefiner — global floating "Illuminate" pill + result panel.
         Listens to all text selections; also responds to Opt+I and voice "Illuminate". -->
    <SelectionDefiner :spec="currentSpec" />

    <!-- 🛟 InputSafetyNetToast — universal draft-loss recovery.
         Watches any field that registers via useInputSafetyNet().watchField(...).
         Raises an Oops toast with Restore / ⌘Z / voice-Yes paths when the user
         drops ≥50 % of a ≥5-word draft. Tom 2026-05-14: never punish a user
         the way Claudian punished him. z-[900] so it sits above all surfaces. -->
    <InputSafetyNetToast />

    <!-- Focus mode — blur backdrop + countdown chip (z-[880], below focused panel z-[920]) -->
    <FocusModeBackdrop />

    <!-- Universal page-level scroll pin — Tom 2026-06-06: "the resources stage
         window, and all other stage windows that scroll need the scroll pin
         with % and arrows".  Watches window.scrollY and renders the same
         "% shown" pill ScrollContainer renders inside scrollable panels — but
         at the VIEWPORT level, so every stage view (Stage 1 entry, Stage 2
         Evo Plan, Stage 3 Impact, Stage 10 Resources, Study-Act etc.) gets
         the indicator automatically without per-stage wiring.  Naturally
         covered by any modal backdrop (z-[400+]) — no explicit suppress
         needed since the pin sits at z-[60]. -->
    <PageScrollPin />

<!-- Feature #40: Value Delivery Replay overlay -->
    <ReplayOverlay
      :steps="confirmedSteps"
      :replay-step="replayStep"
      :replay-value="replayValue"
      :is-replaying="isReplaying"
      @stop="stopReplay"
    />

    <!-- Feature #29: Version History drawer.
         (2026-05-13 third fix) Tom: "frozen history and close still does not
         work" — drawer renders but clicks land on nothing, including the
         CloseDot in its own header. Z-bumps (310 → 497) didn't help, which
         means the eater isn't a transparent layer at z 300-495 — it's higher.
         Confirmed: the persistent ⋯ Actions FAB container is
         `fixed top-4 right-4 z-[9999]` (moved from bottom-right 2026-05-27) and
         stays mounted while History is open (its `v-if` only excludes comparison /
         plan-input / models / wizard — not historyOpen). The FAB cluster's `<Teleport>` is
         declared BEFORE History in App.vue, but z-9999 > z-497 so the
         cluster's bounding box wins the hit-test in the right edge of the
         viewport — and any rename / owner popover inside that cluster, plus
         every nested click-outside backdrop the cluster's children may
         mount, can catch clicks that should have reached the drawer.
         (Plus possible Teleport+`<template v-if>` fragment quirks where
         the two-sibling backdrop/panel pair leaks one of them under a
         stacking ancestor.) **Fix — three things at once:**
         1. Single root `<div v-if>` inside the Teleport (no `<template>`
            fragment) so the backdrop + panel always mount/unmount as one
            DOM subtree.
         2. Panel z bumped to z-[10000] — strictly ABOVE the FAB container
            (z-9999) and every other clamp in the codebase.
         3. Explicit `pointer-events-auto` on the panel + a top-layer
            wrapper that itself has `pointer-events-none` so the wrapper
            never blocks anything outside the drawer's actual rectangles. -->
    <Teleport to="body">
      <template v-if="view === 'app' && historyOpen">
        <!-- Backdrop — z-[10200] sits above SelectionDefiner pill+panel (z-[10100])
             so the pill cannot intercept clicks on the history CloseDot.
             FAB container is z-[9999]; history always wins. -->
        <div
          class="fixed inset-0 z-[10200] bg-black/30"
          aria-hidden="true"
          @click="historyOpen = false"
        />
        <!-- Drawer panel — z-[10201], one above the backdrop. -->
        <div
          class="fixed right-0 top-[112px] h-[calc(100%-112px)] w-80 bg-white shadow-xl z-[10201] flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-label="Version History"
        >
          <!-- Header -->
          <div class="flex items-center justify-between px-4 border-b border-gray-100 min-h-[56px]">
            <h2 class="text-sm font-semibold text-gray-900">Version History</h2>
            <!-- Universal Close-Button Rule: <CloseDot> on the right.
                 Tom 2026-06-03 reported "no close button on stewards" — looking
                 at the Version History panel.  CloseDot was present but the
                 default 20px md size was too small for Tom to spot at a glance.
                 Bumped to size="lg" (32px) — Tom's standing directive 2026-05-12
                 "I would not mind if close button were larger and redder" applied
                 to this surface too.  Backdrop click-outside still works (line
                 ~6029 in App.vue). -->
            <CloseDot
              size="lg"
              aria-label="Close Version History"
              title="Close Version History  [->"
              @click="historyOpen = false"
            />
          </div>
          <!-- Body -->
          <div class="flex-1 overflow-hidden">
            <SpecHistory
              :current-plan-owners="specModel?.owners?.map(o => o.name) ?? []"
              :current-plan-name="specModel?.name ?? ''"
              @restore="onHistoryRestore"
              @open-save-glyph-history="saveGlyphHistoryOpen = true"
              @load-plan="(model) => { handleRestoreModel(model); historyOpen = false }"
            />
          </div>
        </div>
      </template>
    </Teleport>

    <!-- Feature #50: Project Dashboard slide-in panel -->
    <ProjectDashboard
      v-if="view === 'app' && dashboardOpen"
      :entries="dashboardEntries"
      :on-restore="(spec: SpecBlock) => { currentSpec = spec; dashboardOpen = false }"
      :on-remove="removeDashboardEntry"
      :on-close="() => { dashboardOpen = false }"
      @clear-all="clearDashboard"
    />

    <!-- Feature #53: Progressive spec wizard — Teleport ensures z-[600] is root-relative -->
    <Teleport to="body">
      <SpecWizard
        v-if="wizardOpen"
        :on-submit="handleWizardSubmit"
        :on-close="() => { wizardOpen = false }"
      />
    </Teleport>

    <!-- Feature #71: Spec Presentation Mode -->
    <SpecPresentation
      :spec="currentSpec"
      :open="presentationOpen"
      @close="presentationOpen = false"
    />

    <!-- Feature #77: Animated Onboarding Tour -->
    <OnboardingTour
      v-if="tourOpen"
      @close="tourOpen = false"
    />

    <!-- Stage 10 · Resources Sharpening — opens from the case-10 stage-action pin,
         or auto-opens when the user navigates to planningStage 10.  Tom 2026-06-04
         Phase 0 of Resources stage beef-up.  Gilb-cited 9-dimension guide;
         no schema changes yet — Phase 1 adds R. entry persistence after Tom OK. -->
    <ResourcesSharpenPanel
      :open="resourcesSharpenOpen"
      :spec="currentSpec"
      :captured-calendar-costs="capturedCalendarCosts"
      :captured-capital-costs="capturedCapitalCosts"
      :captured-v-c-ratios="capturedVCRatios"
      @close="resourcesSharpenOpen = false"
      @apply-analysis="_onResourcesAnalysisApplied"
    />

    <!-- Stage 10 · OPTIMA Resource Optimization — VDT sliders + threshold visualization
         Based on Optima book (Tom Gilb 2024: "Balancing Critical Values").
         Adjusting a resource slider propagates impact to all Value entries;
         top-3 impacted vibrate, violations shake red. -->
    <ResourceOptimaPanel
      v-if="view === 'app' && optimaOpen"
      :spec="currentSpec"
      :vc-ratios="capturedVCRatios"
      @close="optimaOpen = false"
    />

    <!-- Stage 10 · KISS — Keep Improvement Super Surprising
         Tom 2026-06-05: "5 most cost-effective spec improvements… Change Differential Diagram…
         BLOW OUR mind with KISSES" — constraint relaxation, solution-add, value-goal-relax,
         resource reallocation, stakeholder power — each with VDT-ranked Change Differential
         Diagram and 4 alternative approaches. -->
    <ResourcesKissPanel
      :open="view === 'app' && kissOpen"
      :spec="currentSpec"
      @close="kissOpen = false"
    />

    <!-- Stage 10 · Cost Engineering Tool — Static upfront Design-to-Cost + Dynamic Evo Step tracking.
         Tom 2026-06-05: "COST ENGINEERING: THE TOOL, SEPARATE TOOL for Dynamic (Evo Step)
         Design to [Cost, Value, Constraint] and for initial statics upfront Design to
         [Cost, Value, Constraint]. Based on ideas in Cost Engineering."
         [$→*] international keyed icon: resource-to-output transformation. -->
    <ResourceCostEngineeringPanel
      :open="view === 'app' && costEngineeringOpen"
      :spec="currentSpec"
      @close="costEngineeringOpen = false"
    />

    <!-- Sharpening Cycles modal — triggered from nav "Sharpen ▾" when spec exists -->
    <SharpenPanel
      v-if="sharpenModalOpen && currentSpec"
      :spec="currentSpec"
      :modal="true"
      @sharpened="onSpecSharpened"
      @done="handleSharpenModalDone"
      @open-visualise="handleSharpenModalDone(); visualiseOpen = true"
      @open-global-priority="handleSharpenModalDone(); globalPriorityOpen = true"
      @open-priority-info="handleSharpenModalDone(); priorityInfoOpen = true"
    />

    <!-- Visualise diagram gallery modal -->
    <VisualisePanelModal
      v-if="visualiseOpen"
      :spec="currentSpec"
      :confirmed-steps="_stepsForDiagram"
      :tasks-by-step="tasksByStep"
      :impact-matrix="capturedImpactMatrix"
      :vc-ratios="capturedVCRatios"
      :calendar-costs="capturedCalendarCosts"
      :capital-costs="capturedCapitalCosts"
      :highlighted-entry-id="_vizHighlightId || undefined"
      :initial-tab="_vizInitialTab || undefined"
      @close="visualiseOpen = false; _vizHighlightId = ''; _vizInitialTab = ''"
      @open-heatlane="visualiseOpen = false; heatLaneOpen = true"
      @open-evo-simulator="visualiseOpen = false; evoSimulatorOpen = true"
      @open-multiforks="visualiseOpen = false; openMultiForks()"
      @open-value-flow="visualiseOpen = false; valueFlowOpen = true"
      @open-editor="({ tab, entryId }) => _openSpecEditor({ tab, entryId, returnTo: 'visualise' })"
      @node-relations-click="({ tab, entryId }) => _openSdr(tab, entryId, 'visualise')"
      @go-to-tasks="() => { visualiseOpen = false; stage = 4 }"
    />

    <!-- Heat Lane full-screen swimlane -->
    <SpecHeatLane
      v-if="heatLaneOpen && currentSpec"
      :spec="currentSpec"
      :confirmed-steps="_stepsForDiagram"
      :tasks-by-step="tasksByStep"
      :on-close="() => heatLaneOpen = false"
    />

    <!-- Evo Simulator — Tom 2026-06-03: *"evo simulator dead, remove it fro
         here, it is now in the evo tools"*.  The component was rendering
         INLINE on the page (just a `<div>` with `h-full bg-white`) — it
         appeared as a tall purple block stuck below the Stage 7 V × Step VDT.
         Now wrapped in a proper Teleported modal: fixed full-screen overlay
         + backdrop click-outside + bounded panel.  Only opens when toggled
         from the Evo Tools catalogue (or any other emit-open-evo-simulator
         caller).  Same z-index pattern as the other Teleported modals. -->
    <Teleport to="body">
      <div
        v-if="evoSimulatorOpen"
        class="fixed inset-0 z-[500] bg-slate-900/70 flex items-stretch justify-center p-4 sm:p-8"
        role="dialog"
        aria-modal="true"
        aria-label="Evo Simulator"
        @click.self="evoSimulatorOpen = false"
      >
        <div class="w-full max-w-5xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col">
          <EvoSimulatorView
            :steps="_stepsForDiagram"
            :vc-ratios="capturedVCRatios"
            :cycle-length="specModel?.evoCycleLength ?? 'week'"
            @close="evoSimulatorOpen = false"
          />
        </div>
      </div>
    </Teleport>

    <!-- Evo Tools catalogue (Tom 2026-06-03 marker) — full-screen modal listing
         all Evo-specialised tools, organised by category, with status badges.
         Click a 'ready' tile → dispatched via onEvoToolActivated → opens the
         tool's existing surface.  Data registry lives in src/data/evoTools.ts. -->
    <EvoToolsPanel
      v-if="evoToolsOpen"
      @close="evoToolsOpen = false"
      @tool-activated="onEvoToolActivated"
    />

    <!-- Sharpen Next Step (Evo Sharp Interview) — Tom 2026-06-03 first detailed
         Evo Tool.  12-category structured interview (Tom's 8 + 4 PROPOSED) that
         crystallises the next Evo Step before commit.  Persists per (plan, step)
         via localStorage.  Data: src/data/evoSharpInterview.ts. -->
    <EvoSharpInterview
      v-if="evoSharpOpen"
      :steps="_stepsForDiagram"
      :plan-id="specModel?.name ?? 'default'"
      @close="evoSharpOpen = false"
    />

    <!-- Evo Step Improvement — Tom 2026-06-03 second detailed Evo Tool.
         The Evo Planner proposes a crazy first shot, critiques it, offers 1–5
         better ideas, plus a Skunkworks section of Daring and Wild Evo Ideas
         (2×–10× daring shots at higher risk and cost).
         File-read pattern (per Claude-Code-as-AI-Layer rule): no in-app API call.
         Ideas come from Claudian (clipboard prompt → JSON paste-back) or from a
         mock seed for first-look demo.  Data: src/data/evoStepImprovement.ts. -->
    <EvoStepImprovement
      v-if="evoStepImprovementOpen"
      :steps="_stepsForDiagram"
      :plan-id="specModel?.name ?? 'default'"
      @close="evoStepImprovementOpen = false"
    />

    <!-- FEED ME! — Tom 2026-06-03 third detailed Evo Tool.
         Audrey II nod (Little Shop of Horrors).  Feedback + Learning agent
         covering 3 sources (Feedback Base / Evo Base / Last Step in Paris)
         + tough questions to DEV with AI-suggested answers + recommended
         actions with REQUIRED audit trail (Source + Reason at the type level).
         File-read pattern (no in-app AI).  Data: src/data/feedMe.ts. -->
    <FeedMePanel
      v-if="feedMeOpen"
      :steps="_stepsForDiagram"
      :plan-id="specModel?.name ?? 'default'"
      @close="feedMeOpen = false"
    />

    <!-- SEM Settings Panel — Tom 2026-06-03 long-requested.
         Mode (Ultra Light / Pro SEM, default Pro SEM) + AI Max level
         (default Maximum) + Privacy/Telemetry (default None) + Evo defaults
         + Visualisation + Workflow + Export + Collaboration + Diagnostics.
         v1: panel UI + persistence work.  Component consumption of individual
         settings ships incrementally — each setting gets the "live" badge when
         its consumer is wired.  Data: src/data/settings.ts. -->
    <SettingsPanel
      v-if="settingsOpen"
      @close="settingsOpen = false"
    />

    <!-- Evo Step 12: Stakeholder Conflict Detector — surfaces hidden stakeholder tensions -->
    <ConflictAnalysisPanel
      v-if="conflictAnalysisOpen && currentSpec"
      :spec="currentSpec"
      @close="conflictAnalysisOpen = false"
    />

    <!-- Evo Step 13: AI Spec Collaborator — streaming conversational spec assistant -->
    <SpecCollaboratorPanel
      v-if="collaboratorOpen && currentSpec"
      :spec="currentSpec"
      :stage="stage"
      @close="collaboratorOpen = false"
      @apply-proposal="(updated) => { currentSpec = updated }"
    />

    <!-- Bullock Audit Trail — triggered from "🗂️ Audit Trail" button when sharpeningDone -->
    <BullockPanel
      v-if="bullockOpen && currentSpec"
      :spec="currentSpec"
      :rounds="sharpenRounds"
      :history="specHistory"
      @close="bullockOpen = false"
    />

    <!-- Planning Models panel — browse, rename, delete, restore saved models -->
    <SpecModelPanel
      v-if="modelsOpen"
      @close="modelsOpen = false"
      @load="handleRestoreModel"
    />

    <!-- Model Comparison — full-screen modal triggered from PlanModelBar "📊 Compare" -->
    <ModelComparisonView
      v-if="comparisonOpen"
      :initial-model="specModel ?? undefined"
      @close="comparisonOpen = false"
    />

    <!-- Get A Plan — unified import / history / merge panel -->
    <GetAPlanPanel
      v-if="specInputOpen"
      :has-current-plan="!!currentSpec"
      @imported="handlePlanImported"
      @imported-and-sharpen="handlePlanImportedAndSharpen"
      @add-to="handlePlanAddTo"
      @load-model="handleGetAPlanLoadModel"
      @restore-version="handleGetAPlanRestoreVersion"
      @close="specInputOpen = false"
    />

    <!-- Evo Step 10: In-app confidence survey (2S.V.PlannerConfidence / 2S.V.PlannerPlanningTrust) -->
    <SurveyGateModal
      v-if="view === 'app'"
      :visible="surveyVisible"
      :question="activeSurveyQuestion"
      @rate="survey.submitRating"
      @dismiss="survey.dismissSurvey"
    />

    <!-- Global toast — Tom 2026-06-04 fix: showToast() updates a module-level
         singleton, but the only renderer used to live INSIDE EvoPlanView.
         That meant toasts fired from Stage 10 / Stage 3 / any view where
         EvoPlanView was NOT mounted were invisible — Tom rightly perceived
         "Copy dead / Email dead" because the action ran but no feedback
         appeared.  Mounting the renderer here at App.vue root guarantees
         every showToast() call is visible on every surface. -->
    <Transition name="global-toast">
      <div
        v-if="globalToast"
        :key="globalToast.id"
        class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] rounded-full bg-slate-800 text-white text-sm font-medium px-5 py-3 shadow-2xl pointer-events-none select-none max-w-[90vw] text-center"
        aria-live="polite"
      >{{ globalToast.message }}</div>
    </Transition>

  </div>
</template>

<style>
/* Global toast slide-up animation (Tom 2026-06-04 fix — toast renderer moved
   to App.vue root so every stage shows feedback). */
.global-toast-enter-active { animation: global-toast-in 320ms cubic-bezier(0.22, 1, 0.36, 1) both; }
.global-toast-leave-active { transition: opacity 180ms ease, transform 180ms ease; }
.global-toast-leave-to     { opacity: 0; transform: translateX(-50%) translateY(-4px); }
@keyframes global-toast-in {
  from { opacity: 0; transform: translateX(-50%) translateY(14px); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0); }
}

/* Plan Crest hero-title shimmer — slow gold sweep across the gradient.
   Tom 2026-05-12 asked for "large long color, drama attention" on the
   plan name. The gradient is amber-300 → yellow-100 → white → amber-300
   stretched to 200 % of the text width, and the background-position is
   animated so the bright band slides slowly L→R→L every 9 s. Tasteful,
   never gaudy. Respects prefers-reduced-motion. */
.plan-title-shimmer {
  background-size: 200% 100%;
  background-position: 0% 50%;
  animation: plan-title-shimmer 9s ease-in-out infinite;
}
@keyframes plan-title-shimmer {
  0%, 100% { background-position: 0% 50%; }
  50%      { background-position: 100% 50%; }
}
@media (prefers-reduced-motion: reduce) {
  .plan-title-shimmer { animation: none; }
}

/* ── Crest Tip — CSS-only tooltip system for Plan Crest elements. ─────────────
   P5 (2026-05-27): any element with data-crest-tip="..." shows a styled
   tooltip below on hover/focus. No JS, no event handlers — pure CSS.
   Usage: <span data-crest-tip="Tooltip text goes here">button label</span>
   Design: dark slate-800 panel, indigo border, downward from crest bar.
   The Plan Crest sits at z-[300]; tooltip at z-[400] clears it.
   Arrow (::before) points up toward the triggering element. */
[data-crest-tip] {
  position: relative;
}
[data-crest-tip]::after {
  content: attr(data-crest-tip);
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  max-width: 260px;
  white-space: normal;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.45;
  color: #e2e8f0;
  background: #1e293b;
  border: 1px solid rgba(99, 102, 241, 0.35);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.45);
  z-index: 400;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
  text-align: center;
}
[data-crest-tip]::before {
  content: '';
  position: absolute;
  top: calc(100% + 2px);
  left: 50%;
  transform: translateX(-50%);
  border: 5px solid transparent;
  border-bottom-color: #1e293b;
  z-index: 401;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}
[data-crest-tip]:hover::after,
[data-crest-tip]:hover::before,
[data-crest-tip]:focus-visible::after,
[data-crest-tip]:focus-visible::before {
  opacity: 1;
}
@media (prefers-reduced-motion: reduce) {
  [data-crest-tip]::after,
  [data-crest-tip]::before { transition: none; }
}
</style>
