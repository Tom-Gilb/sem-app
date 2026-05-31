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
import PrioritisedPlanView from './components/PrioritisedPlanView.vue'
import ClarifyView from './components/ClarifyView.vue'
import ThinkingIndicator from './components/ThinkingIndicator.vue'
import CelebrationEffect from './components/CelebrationEffect.vue'
import ValueCounter from './components/ValueCounter.vue'
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
import PlanModelPanel from './components/PlanModelPanel.vue'
import ModelComparisonView from './components/ModelComparisonView.vue'
import GetAPlanPanel from './components/GetAPlanPanel.vue'
import ContractHub from './components/ContractHub.vue'
import PlanOwnerPanel from './components/PlanOwnerPanel.vue'
import PlanDNAStrip   from './components/PlanDNAStrip.vue'
import SpecOwnersPanel from './components/SpecOwnersPanel.vue'
import PlanTargetsPanel from './components/PlanTargetsPanel.vue'
import SpecEditorPanel from './components/SpecEditorPanel.vue'
import SpecDirectRelations from './components/SpecDirectRelations.vue'
import ToolInfoPanel from './components/ToolInfoPanel.vue'
import PriorityRecordPanel from './components/PriorityRecordPanel.vue'
import GlobalPriorityPanel from './components/GlobalPriorityPanel.vue'
import PriorityInfoPanel from './components/PriorityInfoPanel.vue'
import EditInfoPanel from './components/EditInfoPanel.vue'
import PlanHealthStatusPanel from './components/PlanHealthStatusPanel.vue'
import PlanHealthAdminPanel from './components/PlanHealthAdminPanel.vue'
import PlanHealthBadge from './components/PlanHealthBadge.vue'
import { usePlanHealth, type PlanHealthContext } from './composables/usePlanHealth'
import CopyrightPanel from './components/CopyrightPanel.vue'
import SaveGlyphHistoryPanel from './components/SaveGlyphHistoryPanel.vue'
import SymbolFamilyPanel from './components/SymbolFamilyPanel.vue'
import ActionsHubPanel from './components/ActionsHubPanel.vue'
import AgentMenuPanel from './components/AgentMenuPanel.vue'
import MariaAgentBoard from './components/MariaAgentBoard.vue'
import MariaBoardHub   from './components/MariaBoardHub.vue'
import SemMetadataPanel from './components/SemMetadataPanel.vue'
import ValueFlowPanel from './components/ValueFlowPanel.vue'
import SystemModelDashboard from './components/SystemModelDashboard.vue'
import ModelHistory from './components/ModelHistory.vue'
import GlyphDataPanel from './components/GlyphDataPanel.vue'
import type { PlGlyphType } from './components/icons/PlTypeIcon.vue'
import SaveGlyph from './components/icons/SaveGlyph.vue'
import EditGlyph from './components/icons/EditGlyph.vue'
import PriorityTripleGlyph from './components/icons/PriorityTripleGlyph.vue'
import GetGlyph from './components/icons/GetGlyph.vue'
import ScrollContainer from './components/ScrollContainer.vue'
import {
  usePlanModel,
  initPlanModel,
  bumpPlanVersion,
  clearPlanModel,
  activatePlanModel,
  latestPlanModel,
  getAllPlanModels,
  savePlanSnapshot,
  renamePlanModel,
  updatePlanOwner,
  addOwner,
  addPlanner,
  addScribe,
  exportAllPlanModelsBackup,
  importPlanModelsBackup,
  getDeviceUserName,
  setDeviceUserName,
  setWorkingMode,
  type PlanModel,
} from './composables/usePlanModel'
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
import AmuseMeButton from './components/AmuseMeButton.vue'
import OnboardingTour from './components/OnboardingTour.vue'
import type { SpecBlock } from './types/spec'
import GlobalSearch from './components/GlobalSearch.vue'
import { useGlobalSearch, type SearchEntry } from './composables/useGlobalSearch'
import { useToolInfo } from './composables/useToolInfo'
import { useCopyright } from './composables/useCopyright'
import { useSpecEditor } from './composables/useSpecEditor'
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
const { showToast } = useToast()
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
const { currentModel: planModel, allModels: _allPlanModels } = usePlanModel()

// Live "now" tick for the top bar's save-time label (refreshed every 30 s)
const _topBarNow = ref(Date.now())
const _topBarTimer = setInterval(() => { _topBarNow.value = Date.now() }, 30_000)
onUnmounted(() => clearInterval(_topBarTimer))

/** "Saved 4:32 PM" or "Saved 3 min ago" label for the persistent plan bar. */
const planBarSavedLabel = computed((): string => {
  const ts = planModel.value?.updatedAt
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
const planBarUnsaved = computed((): boolean => {
  const ts = planModel.value?.updatedAt
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
  titleDraft.value   = planModel.value?.name ?? ''
  titleEditing.value = true
  nextTick(() => {
    titleInputEl.value?.focus()
    titleInputEl.value?.select()
  })
}
function commitTitleEdit(): void {
  const trimmed = titleDraft.value.trim()
  if (trimmed && planModel.value && trimmed !== planModel.value.name) {
    renamePlanModel(planModel.value.id, trimmed)
  }
  titleEditing.value = false
}
function cancelTitleEdit(): void {
  titleEditing.value = false
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
  renameInputVal.value  = planModel.value?.name ?? ''
  renameOwnerVal.value  = planModel.value?.owners?.[0]?.name ?? ''
  renamePopoverOpen.value = true
}

function submitRename(): void {
  const trimmed = renameInputVal.value.trim()
  if (trimmed && planModel.value) {
    renamePlanModel(planModel.value.id, trimmed)
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

// --- Plan Input (import existing plan) ---
const planInputOpen = ref(false)

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

// --- Plan Owner panel + Spec Owners / Governance panel ---
const planOwnerPanelOpen  = ref(false)
const planPeopleTab       = ref<'owners' | 'planners' | 'scribes'>('owners')
const govPanelOpen        = ref(false)
// --- Plan DNA / Planner Consequences strip ---
const planDNAOpen         = ref(false)
function _togglePlanStory(): void {
  planDNAOpen.value = !planDNAOpen.value
}
// --- Feature #195: Plan Targets ---
const planTargetsOpen     = ref(false)
// --- Agent Menu + Maria panels (2026-05-29 / 2026-05-30) ---
const agentMenuOpen       = ref(false)
const mariaOpen           = ref(false)           // MariaAgentBoard — analysis panel
const mariaBoardOpen      = ref(false)           // MariaBoardHub   — settings + activity log
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
// z-[494/495] — above ModelHistory (492/493). Triggered by interactive PlTypeIcon click.
const glyphPanelType  = ref<PlGlyphType | null>(null)
const glyphPanelOpen  = ref(false)
function openGlyphPanel(type: PlGlyphType): void {
  glyphPanelType.value = type
  glyphPanelOpen.value = true
}

/** True when the active plan model is in 'model' mode (not plan mode). */
const isModelMode = computed(() => planModel.value?.workingMode === 'model')

// --- Feature #202: Plan Health (PHI badge + Status + Administration) ---
// Two sister panels per Tom's design:
//   • Status (read-only) — PHI breakdown + history graph + notifications
//   • Administration — weights, custom aspects, notification policy, snapshots
// Badge click → Status by default. Each panel has a header link to the other.
const planHealthStatusOpen = ref(false)
const planHealthAdminOpen  = ref(false)
/**
 * Live Plan Health Index for the badge on the Plan ID bar.
 * Recomputes whenever spec or governance changes (computed dependency tracking).
 * The PHI is in [-100..+100]; below planHealthThreshold the badge vibrates.
 */
const planHealthCtx = computed<PlanHealthContext>(() => ({
  spec: currentSpec.value ?? { functions: [], values: [], solutions: [] },
  specOwnerCount: planModel.value?.governance?.specOwners?.length ?? 0,
  hasPlanOwner: (planModel.value?.owners?.length ?? 0) > 0,
}))
const planHealthIndexValue = computed<number>(() => {
  if (!planModel.value || !currentSpec.value) return 0
  return usePlanHealth(planModel.value.id).planHealthIndex(planHealthCtx.value)
})
const planHealthThresholdValue = computed<number>(() => {
  if (!planModel.value) return 50
  return usePlanHealth(planModel.value.id).custom.value.threshold
})
/** Pending notification count drives the rose dot on the Plan ID bar badge. */
const planHealthAlertCount = computed<number>(() => {
  if (!planModel.value) return 0
  return usePlanHealth(planModel.value.id).pendingNotifications.value.length
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
function _planOwnerNames(): string[] {
  return planModel.value?.owners?.map(o => o.name).filter(Boolean) ?? []
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
    if (!planModel.value || !currentSpec.value) return
    const ph = usePlanHealth(planModel.value.id)
    if (!ph.custom.value.admin.autoSnapshotOnVersionBump) return
    const v = specHistory.value[0]
    const isFirst = ph.custom.value.snapshots.length === 0
    ph.recordSnapshot(planHealthCtx.value, {
      trigger: isFirst ? 'inception' : 'version-bump',
      planVersion: planModel.value.version ? `v${planModel.value.version}` : '',
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

    // ── Switch (or create) the PlanModel that owns this snapshot ────────────
    const wantedName = planName.trim()
    if (wantedName) {
      const all = getAllPlanModels() as ReadonlyArray<{ id: string; name: string }>
      const match = all.find((m) => m.name === wantedName)
      if (match) {
        // Re-activate the existing model AND sync its stored spec to the
        // restored snapshot so the bar, exports, and search all line up.
        activatePlanModel(match as Parameters<typeof activatePlanModel>[0])
        savePlanSnapshot(spec)
      } else {
        // No saved model with this historical name — start a fresh one so
        // the identity bar shows the correct plan title immediately.
        initPlanModel(spec, wantedName)
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
    if (historyOwners.length > 0 && planModel.value && planModel.value.owners.length === 0) {
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

    addVersion(spec, 'Restored', plan, planModel.value?.name ?? '', _planOwnerNames())
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
  addVersion(spec, 'Make Ambitious', _evoPlan.value as EvoStepPlan | null, planModel.value?.name ?? '', _planOwnerNames())
}

function onLeanSpecSelected(spec: SpecBlock): void {
  currentSpec.value = spec
  addVersion(spec, 'Lean Plan', _evoPlan.value as EvoStepPlan | null, planModel.value?.name ?? '', _planOwnerNames())
}

/** Feature #57b — Whole-spec rewrite saved as a copy version (current spec unchanged). */
function onRewriteCopy(rewritten: SpecBlock): void {
  addVersion(rewritten, 'Rewrite: Copy', _evoPlan.value as EvoStepPlan | null, planModel.value?.name ?? '', _planOwnerNames())
}

/** Feature #57b — Whole-spec rewrite replaces master; old spec saved to history first. */
function onRewriteReplace(rewritten: SpecBlock): void {
  if (currentSpec.value) {
    addVersion(currentSpec.value, 'Pre-Rewrite', _evoPlan.value as EvoStepPlan | null, planModel.value?.name ?? '', _planOwnerNames())
  }
  currentSpec.value = rewritten
  addVersion(rewritten, 'Rewrite: Applied', _evoPlan.value as EvoStepPlan | null, planModel.value?.name ?? '', _planOwnerNames())
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
  addVersion(patched, `Rewrite: ${payload.id}`, _evoPlan.value as EvoStepPlan | null, planModel.value?.name ?? '', _planOwnerNames())
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

/** Called when user clicks a stage pill in ValueCounter. */
function handleStageBarNav(n: number): void {
  if (n >= 2 && !currentSpec.value) {
    showToast('💡 Add a spec at Stakes first to get the most from later stages — but you can always explore ahead', 4000)
  } else if (n >= 7 && confirmedSteps.value.length === 0) {
    showToast('💡 Define Evo Steps (stage 6) first to measure value impact — but feel free to look ahead', 4000)
  }
  planningStage.value = n  // stages never locked (DD-007)

  // Navigate the main view (stage 1–5) to match the clicked planning stage.
  // Pill clicks express navigation intent — not action intent (the CTA button handles actions).
  // handleStageAction calls this first, then fires the action; double-navigation is idempotent.
  switch (n) {
    case 1: case 2: case 3: case 4:
      goToStage1()      // Specify phase (Values / Solutions / Sharpen) → spec entry
      break
    case 5:
      goToImpactStage() // Estimate Impacts → stage 3
      break
    case 6: case 7:
      goToStage2()      // Evo Steps / Evo Simulator → stage 2
      break
    case 8:
      goToTasksStage()  // Plan Tasks → stage 4
      break
    // 9 (Study-Act): no dedicated main stage — toast is sufficient for now
    case 10:
      goToImpactStage() // Resources — V/C cost ratios + resource budgets live in Impact view
      break
    case 11:
      exportFull()      // Export Plan → stage 5, auto-computes matrix if empty
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
    case 8:  return { label: '✅ Plan Tasks',            handler: () => goToTasksStage() }
    case 9:  return { label: '📋 Study Results',        handler: () => showToast('💡 Study-Act: measure actual value delivered vs your Goals, then loop back to update the spec', 4500) }
    case 10: return { label: '📦 Resources',              handler: () => goToImpactStage() }
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
    // Auto-advancing to stage 2 — guarantee planModel is set so the
    // Plan Identity Bar (v-if="planModel") renders correctly.
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
    // Staying at the restored stage — still ensure planModel if spec exists,
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

/** Steps to pass to diagrams — falls back to the suggested (unconfirmed) plan steps
 *  so Value Flow Diagram and Swimlane show content even before the user clicks
 *  "Confirm Plan". Tom 2026-05-16: "the diagram denies [evo steps], please fix."
 *  Suggested steps rendered with a dashed "◌ suggested" indicator in the VFD. */
const _stepsForDiagram = computed<EvoStep[]>(() =>
  confirmedSteps.value.length > 0 ? confirmedSteps.value : (_evoPlan.value?.steps ?? [])
)

// --- Task state ---
// Map from step.name → task list (managed by TaskList component via v-model equivalent)
// Exposed here so exportPrioritisedPlan can read it at export time.
const tasksByStep = ref<Record<string, TaskSuggestion[]>>({})

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
watch(isLoading, (busy) => {
  if (busy) {
    if (_hangWatchdog) clearTimeout(_hangWatchdog)
    _hangWatchdog = setTimeout(() => {
      console.error('[HangWatchdog] Loading state stuck for 100s — force-clearing.', {
        sdkError: sdkError.value,
        stage: stage.value,
      })
      // Hard-cancel the underlying fetch BEFORE clearing loading state.
      // Without this, Safari keeps a stalled TCP connection running in the
      // background even after the UI has been reset, blocking subsequent retries.
      cancelCurrentTranslate()
      _forceClearLoading()
      _doTranslateInFlight = false   // watchdog must also release the in-flight guard
      sdkError.value = 'Generation took too long and was cancelled. Press Generate Spec again to retry, or 🆘 Reset to start fresh.'
      stage1Sub.value = 'form'
      _hangWatchdog = null
    }, 100_000)
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
        try { initPlanModel(spec) } catch { /* non-fatal in demo path */ }
        try {
          addVersion(spec, 'Generated', null, planModel.value?.name ?? '', _planOwnerNames())
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
  planInputOpen.value  = false
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
  planDNAOpen.value          = false   // close Plan Story strip on any stage/overlay change
  menuOpen.value             = false
  renamePopoverOpen.value    = false
  modelsOpen.value           = false
  planOwnerPanelOpen.value   = false
  govPanelOpen.value         = false
  planTargetsOpen.value      = false
  specEditorOpen.value       = false
  sdrOpen.value              = false
  toolInfoPanelOpen.value    = false
  priorityPanelOpen.value    = false
  globalPriorityOpen.value   = false
  priorityInfoOpen.value     = false
  editInfoOpen.value         = false
  planHealthStatusOpen.value = false
  planHealthAdminOpen.value  = false
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
  planInputOpen.value        = false
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
 * Stage 4 (Tasks)      → Export Plan (exportFull)
 * Stage 4              → Export Prioritised Plan
 */
async function goNext(): Promise<void> {
  if (stage.value === 1) {
    if (currentSpec.value) {
      goToPlanStage()
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
    exportFull()
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
  if (stage.value === 3) return 'Plan Tasks'   // Impact (stage 3) → Tasks (stage 4)
  if (stage.value === 4) return 'Export Plan'  // Tasks (stage 4) → Export (stage 5)
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
  const planModelId = planModel.value?.id
  const beforeSpec  = currentSpec.value
  const lastRound   = sharpenRounds.value[sharpenRounds.value.length - 1]
  const inputWords  = lastRound
    ? lastRound.answers.reduce((sum, a) => sum + countWords(a), 0)
    : 0
  const sharpenLabel = lastRound?.category.label

  currentSpec.value = refined
  addVersion(refined, 'Sharpened', _evoPlan.value as EvoStepPlan | null, planModel.value?.name ?? '', _planOwnerNames())
  markdown.value = serialise(refined)
  bumpPlanVersion(refined)   // bump plan model version (0.1 → 0.2 → …) after each sharpen round

  // Record which entries changed — diff silently, no UI impact
  if (planModelId && beforeSpec) {
    recordSharpenProvenance(planModelId, beforeSpec, refined, {
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
  initPlanModel(spec)
  addVersion(spec, 'Imported', null, planModel.value?.name ?? '', _planOwnerNames())
  markdown.value    = serialise(spec)
  planInputOpen.value = false
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
  addVersion(merged, 'Added from import', _evoPlan.value, planModel.value?.name ?? '', _planOwnerNames())
  if (planModel.value) savePlanSnapshot(merged)
  planInputOpen.value = false
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
  if (planModel.value && planModel.value.id !== model.id && currentSpec.value) {
    savePlanSnapshot(currentSpec.value)
  }

  currentSpec.value     = model.spec
  specGeneratedAt.value = model.createdAt ? new Date(model.createdAt) : new Date()
  markdown.value        = serialise(model.spec)
  activatePlanModel(model)
  sharpeningDone.value  = false
  resetSharpen()
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
  planInputOpen.value = false
}

/**
 * Called when GetAPlanPanel "From History" tab emits 'restore-version'.
 * Unwraps the SpecVersion into the existing onHistoryRestore handler,
 * then closes the panel.
 */
function handleGetAPlanRestoreVersion(sv: SpecVersion): void {
  onHistoryRestore(sv.spec, sv.plan, sv.planName ?? '', sv.planOwners ?? [])
  planInputOpen.value = false
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
    savePlanSnapshot(currentSpec.value)
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
  const _specBeforeSubmit = currentSpec.value
  currentSpec.value = null
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
  // put the previous spec back so the user is never left empty-handed.
  if (!currentSpec.value && _specBeforeSubmit) {
    currentSpec.value = _specBeforeSubmit
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
      const _prevOwners   = planModel.value?.owners.map(o => ({ ...o })) ?? []
      const _prevPlanners = planModel.value?.planners.map(p => ({ ...p })) ?? []
      // Non-default scribes only — initPlanModel re-creates the default device-user scribe.
      const _prevScribes  = (planModel.value?.scribes ?? []).filter(s => !s.isDefault).map(s => ({ ...s }))

      initPlanModel(annotatedSpec)         // Plan Model — auto-name from first F. entry, version 0.1

      // Restore team (new IDs generated; all contact + role fields preserved).
      for (const { id: _o, ...ownerData }   of _prevOwners)   addOwner(ownerData)
      for (const { id: _p, ...plannerData } of _prevPlanners) addPlanner(plannerData)
      for (const { id: _s, ...scribeData }  of _prevScribes)  addScribe(scribeData)
      // Phase 1 (Sources of Specs) — record initial AI-generation provenance for all entries
      if (planModel.value?.id) {
        const inputWords = countWords(`${payload.stakes} ${payload.ends} ${payload.means}`)
        initEntriesFromSpec(planModel.value.id, annotatedSpec, {
          actor:           'ai',
          changeType:      'generate',
          humanInputWords: inputWords,
          label:           'initial translation',
        })
      }
      addVersion(annotatedSpec, 'Generated', null, planModel.value?.name ?? '', _planOwnerNames())
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
  if (planModel.value) return            // already active — nothing to do
  const latest = latestPlanModel()
  if (latest) {
    activatePlanModel(latest)            // re-activate the most recent saved model
  } else {
    initPlanModel(spec)                  // no saved models at all — create one
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

/** Called when EvoPlanView emits 'confirmed' — plan is ready, move to tasks stage */
function onPlanConfirmed(steps: EvoStep[]): void {
  confirmedSteps.value = steps
  evoPlanConfirmed.value = true
  if (currentSpec.value) _ensurePlanModel(currentSpec.value) // keep bar visible on stage 3
  stage.value = 3
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
  const modelName = planModel.value?.name ?? 'Planning Spec'
  const version   = planModel.value ? `  v${planModel.value.version}` : ''

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
  const filename = planModel.value
    ? `${safeName}-v${planModel.value.version}-${date}-${hh}${mm}.txt`
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

// ── Auto-copy plan to clipboard on stage 5 entry ──────────────────────────────
// Fires unconditionally when the Prioritised Plan view is reached.
// Copies the full plain-text plan and shows a toast so the user knows it's there.
// No mail client is opened — user can paste wherever they like.
async function autoCopyPlan(): Promise<void> {
  if (!currentSpec.value) return

  const now       = new Date()
  const hh        = now.getHours().toString().padStart(2, '0')
  const mm        = now.getMinutes().toString().padStart(2, '0')
  const modelName = planModel.value?.name ?? 'Planning Spec'
  const version   = planModel.value ? `  v${planModel.value.version}` : ''
  const HR        = '═'.repeat(48)

  const fileHeader = [
    HR,
    `${modelName}${version}`,
    `Exported: ${now.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}  ${hh}:${mm}`,
    HR,
    '',
  ].join('\n')

  const planBody = confirmedSteps.value.length > 0
    ? exportWithTasksPlainText(currentSpec.value, confirmedSteps.value, tasksByStep.value)
    : serialisePlainText(currentSpec.value)

  try {
    await navigator.clipboard.writeText(fileHeader + planBody)
    showToast('📋 Plan copied to clipboard — paste into Mail, Notes, or anywhere', 5000)
  } catch {
    // Clipboard blocked (e.g. permissions) — silent fail; user can still use Email Plan
  }
}

// ── Email entire plan ─────────────────────────────────────────────────────────
// Strategy: build the complete plain-text plan (identical to the downloaded .txt),
// Universal email rule (Tom 2026-05-29): email opens with the plan ALREADY in
// the body as styled HTML — no manual paste required. Downloads a .eml file
// that Mail.app opens as a compose-draft window.
async function emailPlan(): Promise<void> {
  if (!currentSpec.value) return

  // ── Defensive pre-email save (2026-05-17 bug fix) ─────────────────────────
  // The .eml download is synchronous and does NOT trigger page-hide, so this
  // save is belt-and-suspenders — but we keep it to protect against future
  // environment quirks where opening Mail.app can still trigger lifecycle events.
  _saveNow()
  if (planModel.value) savePlanSnapshot(currentSpec.value)

  const now       = new Date()
  const date      = now.toISOString().slice(0, 10)
  const hh        = now.getHours().toString().padStart(2, '0')
  const mm        = now.getMinutes().toString().padStart(2, '0')
  const modelName = planModel.value?.name ?? 'Planning Spec'
  const version   = planModel.value ? ` v${planModel.value.version}` : ''
  const subject   = `Plan: ${modelName}${version}`

  // Build the plan body (plain text) then wrap in styled HTML for the .eml.
  // SpecOutput.vue has a richer colored table; App.vue's email path gets a clean
  // styled pre-formatted view. A future improvement can extract the table builder
  // into a shared composable (tracked in SEM-Design-History.md).
  const plainBody = confirmedSteps.value.length > 0
    ? exportWithTasksPlainText(currentSpec.value, confirmedSteps.value, tasksByStep.value)
    : serialisePlainText(currentSpec.value)

  const htmlTitle = `${modelName}${version} · ${date} ${hh}:${mm}`
  openEml(textToEmailHtml(plainBody, htmlTitle), subject, { plainBody })
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
    'Plan History':               () => { historyOpen.value = true },
    'Get A Plan':                 () => { planInputOpen.value = true },
    'Import':                     () => { planInputOpen.value = true },
    'Compare':                    () => { comparisonMode.value = true },
    'Spec History':               () => { dashboardOpen.value = true },
    'Present':                    () => { if (currentSpec.value) presentationOpen.value = true },
    'Tour':                       () => { tourOpen.value = true },
    'Replay':                     () => { if (confirmedSteps.value.length) startReplay(confirmedSteps.value) },
    // Stage flow
    'Plan Evo Steps':             () => { goToPlanStage() },
    'Confirm Plan':               () => { document.querySelector<HTMLButtonElement>('button[aria-label="Confirm Plan"]:not([disabled])')?.click() },
    'Estimate Impact':            () => { goToImpactStage() },   // navigate to Impact (stage 3)
    'Plan Tasks':                 () => { goToTasksStage() },    // navigate from Impact → Tasks (stage 4)
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
onMounted(() => {
  window.addEventListener('keydown', _onGlobalKeydown)
  // Pre-unload save — fires synchronously before any page reload/kill.
  // Tom 2026-05-18: covers Cmd+R (browser reload) and any other unload event.
  // _saveNow() is a no-op when currentSpec is null, so safe to fire always.
  window.addEventListener('beforeunload', _saveNow)
})
onUnmounted(() => {
  window.removeEventListener('keydown', _onGlobalKeydown)
  window.removeEventListener('beforeunload', _saveNow)
})

/**
 * Full search index — every feature, button, and panel in the app.
 * Closures over reactive state mean disabled flags stay in sync.
 * Add new entries here whenever a new feature is shipped.
 */
const searchEntries = computed((): SearchEntry[] => {
  const hasSpec  = !!currentSpec.value
  const hasModel = !!planModel.value
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
      id: 'history', icon: '🕐', name: 'Plan History',
      description: 'Browse and restore previous spec versions',
      keywords: ['history', 'versions', 'restore', 'undo', 'previous', 'spec history'],
      context: 'Planning', action: () => { historyOpen.value = true },
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
      id: 'plan-targets', icon: '🎯', name: 'Plan Targets',
      description: 'Define who receives this plan and tailor content per audience',
      keywords: ['plan targets', 'audience', 'tailor', 'stakeholder audience', 'ceo', 'public', 'investor', 'delivery'],
      context: 'Planning', action: () => { planTargetsOpen.value = true },
    },
    {
      id: 'global-priority', icon: '❯', name: 'Global Priority',
      description: 'Rank stakeholders, then values·costs·constraints, then solutions — with sources, reasons, and Prioritisation Constraints',
      keywords: ['global priority', 'rank', 'ranking', 'priority', 'prioritise', 'prioritize', 'stakeholders', 'values', 'costs', 'constraints', 'solutions', 'weights', 'order', 'tradeoff'],
      context: 'Planning', action: () => { globalPriorityOpen.value = true },
      disabled: !hasSpec,
    },
    {
      id: 'plan-health-status', icon: '🩺', name: 'Plan Health Status',
      description: 'Live Plan Health Index (-100..+100) with breakdown bars, history graph (Version + Date axis), pending notifications. Read-only.',
      keywords: ['plan health', 'phi', 'health', 'status', 'index', 'breakdown', 'graph', 'history', 'snapshot', 'snapshots', 'notification', 'notifications', 'alert', 'drop', 'circle', 'badge'],
      context: 'Planning', action: () => { planHealthStatusOpen.value = true },
      disabled: !hasSpec,
    },
    {
      id: 'plan-health-admin', icon: '⚙️', name: 'Plan Health Administration',
      description: 'Plan Health Record Administration Specification — aspect & group weights, custom aspects, vibrate threshold, notification frequency, drop-detect threshold, auto-snapshot policy, per-Owner notification subset, full audit log.',
      keywords: ['plan health admin', 'administration', 'phi', 'governance', 'aspects', 'weights', 'defects', 'risks', 'unknowns', 'rule violations', 'inconsistencies', 'coverage', 'audit', 'notification', 'notify', 'snapshot', 'threshold', 'admin spec'],
      context: 'Planning', action: () => { planHealthAdminOpen.value = true },
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
      context: 'Plan Models', action: () => { downloadPlan() },
      disabled: !hasSpec,
    },
    {
      id: 'email-plan', icon: '✉️', name: 'Email Plan',
      description: 'Copy rich HTML to clipboard and open Mail',
      keywords: ['email', 'mail', 'send', 'share', 'clipboard'],
      context: 'Plan Models', action: () => { emailPlan() },
      disabled: !hasSpec,
    },
    {
      id: 'restore-plans', icon: '↑', name: 'Restore Plans',
      description: 'Import a previously saved plan model from a .json file',
      keywords: ['restore', 'import', 'load', 'previous plan', 'json import'],
      context: 'Plan Models', action: () => { openRestorePicker() },
    },
    {
      id: 'previous-plan', icon: '✱', name: 'Start with a Previous Plan',
      description: 'Switch to a different saved plan model',
      keywords: ['previous plan', 'load plan', 'switch plan', 'all models', 'plans'],
      context: 'Plan Models', action: () => { modelsOpen.value = true },
    },
    {
      id: 'backup', icon: '🛡', name: 'Backup SEM App',
      description: 'Download a backup of all saved plan models',
      keywords: ['backup', 'all plans', 'export all', 'archive'],
      context: 'Plan Models', action: () => { backupAllModels() },
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
      id: 'compare', icon: '📊', name: 'Compare Plan Models',
      description: 'Side-by-side A/B comparison of two plan models',
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
      context: 'Nav bar', action: () => { planInputOpen.value = true },
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
      id: 'owner-panel', icon: '🔑', name: 'Plan Owners',
      description: 'Add or edit the people accountable for this plan (approval authority + change sign-off)',
      keywords: ['owner', 'owners', 'contact', 'accountability', 'approval', 'authority', 'responsible'],
      context: 'Plan',
      action: () => { planPeopleTab.value = 'owners'; planOwnerPanelOpen.value = true },
      disabled: !hasModel,
    },
    {
      id: 'planner-panel', icon: '💡', name: 'Plan Planners',
      description: 'Add or edit the people who conceived and directed the plan ideas',
      keywords: ['planner', 'planners', 'author', 'strategist', 'ideas', 'director'],
      context: 'Plan',
      action: () => { planPeopleTab.value = 'planners'; planOwnerPanelOpen.value = true },
      disabled: !hasModel,
    },
    {
      id: 'scribe-panel', icon: '⌨️', name: 'Plan Scribes',
      description: 'Add or edit the people who did the actual keying/dictation to enter ideas into the app',
      keywords: ['scribe', 'scribes', 'typist', 'keyboard', 'dictation', 'mob', 'rotate', 'keying'],
      context: 'Plan',
      action: () => { planPeopleTab.value = 'scribes'; planOwnerPanelOpen.value = true },
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
registerExclusiveSurface('sharpenModal',      sharpenModalOpen)
registerExclusiveSurface('bullock',           bullockOpen)
registerExclusiveSurface('visualise',         visualiseOpen)
registerExclusiveSurface('heatLane',          heatLaneOpen)
registerExclusiveSurface('evoSimulator',      evoSimulatorOpen)
registerExclusiveSurface('conflictAnalysis',  conflictAnalysisOpen)
registerExclusiveSurface('collaborator',      collaboratorOpen)
registerExclusiveSurface('comparison',        comparisonOpen)
registerExclusiveSurface('models',            modelsOpen)
registerExclusiveSurface('planInput',         planInputOpen)
registerExclusiveSurface('tour',              tourOpen)
registerExclusiveSurface('dashboard',         dashboardOpen)
registerExclusiveSurface('wizard',            wizardOpen)
registerExclusiveSurface('planOwnerPanel',    planOwnerPanelOpen)
registerExclusiveSurface('govPanel',          govPanelOpen)
registerExclusiveSurface('planDNA',           planDNAOpen)
registerExclusiveSurface('planTargets',       planTargetsOpen)
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
registerExclusiveSurface('glyphDataPanel',    glyphPanelOpen)
registerExclusiveSurface('planHealthStatus',  planHealthStatusOpen)
registerExclusiveSurface('planHealthAdmin',   planHealthAdminOpen)
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

// ── ActionsHub: route action IDs to panel opens / functions (2026-05-27) ─────
// Replaces the old inline text dropdown. Each tile in ActionsHubPanel emits
// an action ID string; this function opens the corresponding panel or calls
// the relevant function. menuOpen is set to false by the hub emitting 'close'
// BEFORE this handler fires for most actions (startOver is the exception).
function handleAction(id: string): void {
  switch (id) {
    // ── QUALITY ────────────────────────────────────────────────────────────
    case 'planHealthStatus': planHealthStatusOpen.value = true; break
    case 'planHealthAdmin':  planHealthAdminOpen.value  = true; break
    case 'conflicts':        conflictAnalysisOpen.value = true; break
    // ── PLANNING ───────────────────────────────────────────────────────────
    case 'planTargets':      planTargetsOpen.value      = true; break
    case 'globalPriority':   globalPriorityOpen.value   = true; break
    case 'planOwners':       planPeopleTab.value = 'owners';   planOwnerPanelOpen.value = true; break
    case 'planners':         planPeopleTab.value = 'planners'; planOwnerPanelOpen.value = true; break
    case 'scribes':          planPeopleTab.value = 'scribes';  planOwnerPanelOpen.value = true; break
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
    case 'maria':            mariaOpen.value = true;            break
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
    planModel.value?.name ?? '',
    _planOwnerNames(),
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
      title="Illuminate any Planguage term  (⌘I)"
      aria-label="Illuminate a term (Cmd+I)"
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
    v-if="view === 'app' && planModel"
    class="fixed top-0 left-0 right-0 z-[300] flex flex-col px-4 py-1.5
           bg-gradient-to-r from-indigo-800 via-indigo-600 to-violet-600
           text-white shadow-lg ring-1 ring-black/10 select-none"
    aria-label="Plan Crest — active plan"
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
    <div class="flex items-center justify-center h-12 relative">
      <!-- VIEW MODE — big gold-shimmer title centered in the row, click to
           edit in place. The crest stripe + "Plan" eyebrow ride along on the
           left of the title so the whole identity unit stays together when
           centered. -->
      <button
        v-if="!titleEditing"
        type="button"
        class="group inline-flex items-center gap-3 min-w-0 max-w-[90%] pl-2 pr-3 py-1 -my-1 rounded-lg
               hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-amber-300/80 transition-colors"
        :title="`${planModel.name} — click to rename`"
        :aria-label="`Plan: ${planModel.name}. Click to rename in place.`"
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
        <!-- THE TITLE — big, long, gold-shimmer, drop-shadowed -->
        <span
          class="plan-title-shimmer truncate min-w-0
                 text-2xl md:text-[28px] leading-none font-extrabold tracking-tight
                 bg-gradient-to-r from-amber-300 via-yellow-100 via-white to-amber-300
                 bg-clip-text text-transparent
                 drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)]"
        >{{ planModel.name }}</span>
        <svg
          class="h-4 w-4 shrink-0 opacity-0 group-hover:opacity-80 transition-opacity text-amber-200"
          viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
        >
          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
        </svg>
      </button>

      <!-- EDIT MODE — same visual weight as the title, but as a plain
           white editable input on a subtle amber ring (so the user can SEE
           they're editing). Enter saves, Esc cancels, blur saves. Spell-check
           off because plan names are usually proper nouns or acronyms.
           Wrapped with the crest stripe + Plan eyebrow so the centered
           assembly is visually identical to view mode. -->
      <div v-else class="inline-flex items-center gap-3 min-w-0 max-w-[90%] pl-2 pr-3 py-1 -my-1 rounded-lg">
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

      <!-- ── Right pin cluster: SOS · ⚡ Actions · 🤖 Agents ──────────────────
           Absolute-right in Row 1 so they are NEVER clipped by Row 2's
           overflow-x-clip. Control-pins-at-top rule: topmost row, right side.
           Moved here 2026-05-29 — overflow-x-clip on Row 2 was clipping
           these at 1024–1180 px viewport widths. -->
      <div class="absolute right-0 inset-y-0 flex items-center gap-1 pr-0.5">
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
        <!-- 🦾 Agents -->
        <button
          type="button"
          :aria-expanded="agentMenuOpen"
          aria-haspopup="true"
          aria-label="Open Agent Menu"
          title="Agent Menu — Maria (Board Work Parse) · Contracts (Planguage Contract Analysis) — single-click to open"
          data-crest-tip="🦾 Agents — Maria: Board governance analysis · Contracts: Planguage contract conversion"
          class="w-10 h-10 flex items-center justify-center rounded-lg text-3xl
                 select-none transition-all shrink-0
                 focus:outline-none focus:ring-2 focus:ring-emerald-300"
          :class="agentMenuOpen
            ? 'bg-emerald-300 text-emerald-900 ring-2 ring-emerald-200'
            : 'bg-emerald-500/80 text-emerald-950 hover:bg-emerald-500'"
          @click="agentMenuOpen = true"
        ><span aria-hidden="true">🦾</span></button>
      </div>
    </div>

    <!-- ── Row 2: META + CONTROLS ──────────────────────────────────────────
         Plan Health, version, sharpen badge, saved-time, Plan Story toggle,
         People cluster, Save (if dirty), Find / History / New. Compact
         h-10 row — everything that isn't the hero title lives here.
         Tom 2026-05-12 (fourth pass): "the second row the elements spread
         out evenly" → switched from left-cluster + right-cluster (with a
         single `flex-1` spacer pushing actions to the right) to
         `justify-between` so each visual group gets even breathing room
         across the full bar width. -->
    <!-- Row 2: justify-between removed (2026-05-29) — it distributes negative
         free space when the bar overflows, causing elements to OVERLAP and
         intercept each other's clicks (health badge, owner buttons dead).
         Replaced with natural flex flow + a flex-1 spacer that pushes the
         right-side groups to the right without internal overlap. overflow-x-clip
         prevents visual spill beyond the bar's right edge. -->
    <div class="flex items-center gap-2 h-10 overflow-x-clip">

      <!-- Plan Health Index — Vibrates when index < threshold (default 50).
           Rose "!" dot + tooltip when there are pending notifications. Tom
           2026-05-12: "the meaning of the pulsating '1' on the plan quality
           % is not clear" → the dot now shows "!" (universal alert glyph)
           and the descriptive `alert-hint` explains the count in the tooltip
           + aria-label. -->
      <PlanHealthBadge
        v-if="currentSpec"
        :index="planHealthIndexValue"
        :threshold="planHealthThresholdValue"
        :size="36"
        :has-alert="planHealthAlertCount > 0"
        :alert-count="planHealthAlertCount"
        :alert-hint="planHealthAlertCount === 1
          ? '1 Plan Health alert pending — click to review'
          : `${planHealthAlertCount} Plan Health alerts pending — click to review`"
        @click="planHealthStatusOpen = true"
      />
      <span v-else class="text-2xl shrink-0 leading-none" aria-hidden="true">📋</span>

      <!-- Compact meta cluster: version · sharpen · saved -->
      <div class="flex items-center gap-1.5 text-[10px] text-white/70 leading-none shrink-0 min-w-0">
        <span
          class="px-1.5 py-0.5 rounded bg-white/15 ring-1 ring-white/25
                 font-mono font-bold text-white/90 tracking-tight shrink-0"
          :title="`Version ${planModel.version}`"
        >v{{ planModel.version }}</span>
        <!-- Tom 2026-05-12 (Option B — dramatic): "the knife and the stars
             bigger" → "B drama". The sharpen badge previously sat at the
             parent meta-line's text-[10px] (10 px) — barely a footnote. The
             🔪 glyph IS authorship signal (you sharpened this plan N times),
             so it deserves text-base (16 px) reading weight. Pill padding
             bumped px-2 py-1 to give the bigger glyph room to breathe;
             count keeps text-base alongside so the pair reads as a single
             affordance. `inline-flex items-center gap-1` keeps the knife
             visually coupled to the count without crowding. -->
        <span
          v-if="planModel.sharpenRounds > 0"
          class="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-400/90 text-amber-950 font-bold shrink-0"
          :title="`${planModel.sharpenRounds} sharpening round${planModel.sharpenRounds !== 1 ? 's' : ''} applied`"
        ><span class="text-base leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]" aria-hidden="true">🔪</span><span class="text-base leading-none">{{ planModel.sharpenRounds }}</span></span>
        <!-- "Saved N min ago" IS the Save Now button (Tom 2026-05-13).
             Always clickable. The label dual-codes status + action:
               • Idle / fresh save           → muted white, reads as status
               • ≥2 min stale (unsaved)      → amber chrome with 💾 prefix to urge action
               • Just clicked (1.4 s flash)  → emerald "✓ Saved just now"
               • Hover ANY state             → label flips to "💾 Save now"
             Removes the previously-separate "💾 Save" button — one affordance,
             one mental model. ARIA label spells out both halves. -->
        <button
          v-if="planBarSavedLabel || planModel"
          type="button"
          class="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-md
                 text-[11px] font-semibold transition-all duration-150
                 focus:outline-none focus:ring-2 focus:ring-white/80
                 group"
          :class="_saveFlash === 'flash'
            ? 'bg-emerald-400/95 text-emerald-950 ring-1 ring-emerald-200/70'
            : planBarUnsaved
              ? 'bg-amber-400/95 text-amber-950 ring-1 ring-amber-200/70 hover:bg-amber-300 hover:scale-[1.04]'
              : 'bg-white/10 text-white/90 hover:bg-white/25 hover:text-white'"
          :title="_saveFlash === 'flash'
            ? 'Saved!'
            : planBarUnsaved
              ? `${planBarSavedLabel} — click to save now (you have unsaved changes)`
              : `${planBarSavedLabel || 'Not saved yet'} — click to save now`"
          :aria-label="_saveFlash === 'flash'
            ? 'Saved just now'
            : planBarUnsaved
              ? `${planBarSavedLabel}. Click to save now — you have unsaved changes.`
              : `${planBarSavedLabel || 'Not saved yet'}. Click to save now.`"
          @click="savedLabelClick"
        >
          <!-- Three visual modes, swapped via v-show so the layout doesn't jiggle -->
          <template v-if="_saveFlash === 'flash'">
            <span aria-hidden="true">✓</span>
            <span>Saved just now</span>
          </template>
          <template v-else>
            <!-- Idle label visible by default; flips to "[Save-glyph] Save now" on hover.
                 Both spans share the same row so width stays roughly stable;
                 we use opacity + display:none toggle via group-hover utilities.
                 DD-001 (2026-05-13) — the SaveGlyph (`*→[*]`) replaces the
                 floppy disc 💾 as the canonical Save icon across the app. -->
            <span class="inline group-hover:hidden items-center gap-1" aria-hidden="true">
              <SaveGlyph v-if="planBarUnsaved" size="compact" class="inline-block h-3 w-auto mr-1 -mt-0.5" />
              {{ planBarSavedLabel || 'Save plan' }}
            </span>
            <span class="hidden group-hover:inline items-center gap-1" aria-hidden="true">
              <SaveGlyph size="compact" class="inline-block h-3 w-auto mr-1 -mt-0.5" />
              Save now
            </span>
          </template>
        </button>
      </div>

      <!-- Flex spacer — pushes Plan Story + People + Control Shelf to the right
           without justify-between (which causes overlaps when bar overflows). -->
      <span class="flex-1 min-w-0" aria-hidden="true" />

      <!-- ── PLAN STORY button — bright, big, eye-catching ──────────────────
           Toggles the Plan Story strip below. Tom 2026-05-12 (fourth pass):
           "Plan story icon is still bad, cant even see what it is" → swapped
           the cryptic small-detailed 🧬 (DNA double-helix renders poorly at
           14 px on most platforms) for the open-book 📖 glyph — universally
           recognised as "story" — and bumped from text-sm (14 px) to
           text-lg (18 px) with a soft amber drop-shadow so it pops against
           the fuchsia pill. -->
      <button
        type="button"
        :class="[
          'shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
          'text-xs font-bold tracking-wide transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-white/80 shadow-sm',
          planDNAOpen
            ? 'bg-gradient-to-r from-fuchsia-300 to-pink-300 text-fuchsia-950 ring-2 ring-fuchsia-200/90 shadow-md'
            : 'bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white hover:from-fuchsia-400 hover:to-pink-400 hover:shadow-md hover:scale-[1.03] ring-1 ring-fuchsia-200/50',
        ]"
        :title="planDNAOpen
          ? 'Hide Plan Story — origin, hand-tuning, sharpen rounds, stewards, age'
          : 'Show Plan Story — origin, hand-tuning, sharpen rounds, stewards, age'"
        :aria-pressed="planDNAOpen"
        aria-label="Toggle Plan Story (origin, hand-tuning, sharpening, stewards, age)"
        data-testid="plancrest-story-toggle"
        @click="_togglePlanStory()"
      >
        <span class="text-lg leading-none drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]" aria-hidden="true">📖</span>
        <span class="hidden lg:inline">Plan Story</span>
        <span
          class="text-[10px] opacity-90 leading-none font-extrabold"
          aria-hidden="true"
        >{{ planDNAOpen ? '▾' : '▸' }}</span>
      </button>

      <!-- ── PEOPLE cluster: Owner / Planner / Scribe ──────────────────────
           Pill-style chips, each clearly labelled with role + first person's
           name. Empty state shows "+ Add" so it always reads as a button.
           Click toggles the Plan Responsibilities panel on the matching tab. -->
      <div class="hidden xl:flex items-center gap-1 shrink-0">
        <!-- Owner -->
        <button
          type="button"
          :class="[
            'flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-white/60',
            planModel.owners?.length
              ? 'bg-white/15 text-white hover:bg-white/25'
              : 'border border-dashed border-white/40 text-white/80 hover:bg-white/10 hover:border-white/70',
          ]"
          :title="planModel.owners?.length
            ? `Owners: ${planModel.owners.map(o => o.name).join(', ')} — click to edit`
            : 'Add a Plan Owner'"
          aria-label="Plan Owners"
          @click="planPeopleTab = 'owners'; planOwnerPanelOpen = !planOwnerPanelOpen"
        >
          <span aria-hidden="true">🔑</span>
          <span class="text-[9px] uppercase tracking-wider opacity-70">Owner</span>
          <template v-if="planModel.owners?.length">
            <span class="truncate max-w-[90px]">{{ planModel.owners[0].name }}</span>
            <span v-if="planModel.owners.length > 1" class="text-white/70">+{{ planModel.owners.length - 1 }}</span>
          </template>
          <span v-else aria-hidden="true">+</span>
        </button>

        <!-- Planner -->
        <button
          type="button"
          :class="[
            'flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-white/60',
            planModel.planners?.length
              ? 'bg-white/15 text-white hover:bg-white/25'
              : 'border border-dashed border-white/40 text-white/80 hover:bg-white/10 hover:border-white/70',
          ]"
          :title="planModel.planners?.length
            ? `Planners: ${planModel.planners.map(p => p.name).join(', ')} — click to edit`
            : 'Add a Plan Planner'"
          aria-label="Plan Planners"
          @click="planPeopleTab = 'planners'; planOwnerPanelOpen = !planOwnerPanelOpen"
        >
          <span aria-hidden="true">💡</span>
          <span class="text-[9px] uppercase tracking-wider opacity-70">Planner</span>
          <template v-if="planModel.planners?.length">
            <span class="truncate max-w-[90px]">{{ planModel.planners[0].name }}</span>
            <span v-if="planModel.planners.length > 1" class="text-white/70">+{{ planModel.planners.length - 1 }}</span>
          </template>
          <span v-else aria-hidden="true">+</span>
        </button>

        <!-- Scribe -->
        <button
          type="button"
          :class="[
            'flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-white/60',
            planModel.scribes?.length && planModel.scribes[0]?.name
              ? 'bg-white/15 text-white hover:bg-white/25'
              : 'border border-dashed border-white/40 text-white/80 hover:bg-white/10 hover:border-white/70',
          ]"
          :title="!planModel.scribes?.length
            ? 'Add a Plan Scribe'
            : planModel.scribes[0]?.isDefault
              ? `Scribe (default — ${planModel.scribes[0].name || 'tap to set your name'}) — click to edit`
              : `Scribes: ${planModel.scribes.map(s => s.name).join(', ')} — click to edit`"
          aria-label="Plan Scribes"
          @click="planPeopleTab = 'scribes'; planOwnerPanelOpen = !planOwnerPanelOpen"
        >
          <span aria-hidden="true">⌨️</span>
          <span class="text-[9px] uppercase tracking-wider opacity-70">Scribe</span>
          <template v-if="planModel.scribes?.length">
            <span
              v-if="planModel.scribes[0].name"
              class="truncate max-w-[90px]"
            >{{ planModel.scribes[0].name }}</span>
            <!-- "set name" text removed (2026-05-29) — it was long and not critical
                 (Tom 2026-05-29). The tooltip already says "tap to set your name". -->
            <span v-if="planModel.scribes.length > 1" class="text-white/70">+{{ planModel.scribes.length - 1 }}</span>
          </template>
          <span v-else aria-hidden="true">+</span>
        </button>
      </div>

      <!-- (No spacer needed — Row 2 uses `justify-between` so each visual
           group is distributed evenly across the bar width.) -->

      <!-- ── RIGHT: CONTROL SHELF ─────────────────────────────────────────
           Tom 2026-05-12 (fourteenth pass): "maybe the set of controls
           separated from the plan, in a colored rectangle, round corners".
           Wraps Save + Find/History/New into one deliberate "control
           shelf" rectangle so the affordances read as a unified panel
           distinct from the plan-identity stuff to its left (PlanHealth,
           version pill, sharpen badge, Plan Story toggle, people chips).
           Colour: `bg-indigo-950/60` recedes one notch deeper than the
           bar's indigo-800→violet-600 gradient (same family, no clash
           with the gold-shimmer title) with an `amber-200/25` ring that
           ties back to the Plan Crest accent palette. `shadow-inner`
           gives the shelf a slight inset feel — "controls live HERE." -->
      <div class="flex items-center gap-2 shrink-0 px-2 py-1 rounded-xl
                  bg-indigo-950/60 ring-1 ring-amber-200/25 shadow-inner">

        <!-- (Save Now button removed 2026-05-13 — the "Saved N min ago" pill in
             the identity cluster left of this shelf is now itself the Save Now
             button. One affordance, dual-coded status + action. See the
             `savedLabelClick` button above.) -->

        <!-- Action cluster: Edit Plan · Find · History · New — uniform pill styling -->
        <div class="flex items-center gap-2.5 shrink-0">

        <!-- Edit Plan — opens Spec Editor -->
        <button
          v-if="planModel"
          type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold
                 bg-white text-violet-700 hover:bg-violet-50 shadow-sm
                 focus:outline-none focus:ring-2 focus:ring-white/70 transition-colors"
          aria-label="Edit Plan"
          title="Open Spec Editor"
          @click="currentSpec = currentSpec ?? planModel.spec; specEditorOpen = true"
        >Edit Plan</button>
        <!-- Find ⌘F — overrides browser's native Find-in-page because the
             SEM Find palette IS the canonical navigation surface. Tom
             2026-05-12: "Can Search shortcut be cmd F, and named Find
             (shorter, more result oriented)". ⌘K still works as a silent
             alias for users with existing muscle memory. -->
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
          <!-- Text label hidden (2026-05-29) — icon-only to save crest bar width.
               Title attr provides full label. Kbd hint retained — very compact. -->
          <kbd class="inline-flex items-center px-1 rounded bg-white/20 text-white/80 font-mono text-[9px] leading-none py-0.5 ring-1 ring-white/20">⌘F</kbd>
        </button>

        <!-- Illuminate ⌘I — pairs with Find; teaches the keyboard shortcut.
             Tom 2026-05-17: "persistent Define Button available in all edit situations
             and panels. Define button top panel next to Search."
             Renamed to Illuminate 2026-05-18 — the Planguage glossary goes very deep
             from many angles (notes, examples, diagrams, jokes, related concepts);
             Illuminate captures that better than Define.
             Calls openDefineSearch() → SelectionDefiner handles selection-or-search fallback. -->
        <button
          type="button"
          class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold
                 text-white bg-white/10 hover:bg-white/20
                 focus:outline-none focus:ring-2 focus:ring-white/70 transition-colors"
          aria-label="Illuminate a Planguage term (Cmd+I)"
          title="Illuminate any term — select text first, or click to type one  (⌘I)"
          @click="openDefineSearch()"
        >
          <span class="text-sm leading-none" aria-hidden="true">💡</span>
          <!-- Text label hidden (2026-05-29) — icon-only to save crest bar width. -->
          <kbd class="inline-flex items-center px-1 rounded bg-white/20 text-white/80 font-mono text-[9px] leading-none py-0.5 ring-1 ring-white/20">⌘I</kbd>
        </button>

        <!-- History -->
        <div class="relative">
          <button
            type="button"
            class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold
                   text-white bg-white/10 hover:bg-white/20
                   focus:outline-none focus:ring-2 focus:ring-white/70 transition-colors"
            aria-label="Version History"
            title="Version History"
            @click="historyOpen = true"
          ><!-- Text label hidden (2026-05-29) — icon-only to save crest bar width. -->
            <span aria-hidden="true">🕐</span></button>
          <span
            v-if="specHistory.length > 0"
            class="absolute -top-1 -right-1 h-4 min-w-[1rem] rounded-full bg-rose-500 text-white
                   text-[10px] font-bold flex items-center justify-center px-0.5 pointer-events-none ring-2 ring-indigo-700"
            aria-hidden="true"
          >{{ specHistory.length }}</span>
        </div>

        <!-- (SOS moved to Row 1 absolute-right cluster — never clips there) -->

        <!-- ── Control pins — 🎤 Mic · 🔊 Speaker ──────────────────────────────
             ⚡ Actions and 🤖 Agents moved to Row 1 absolute-right cluster so
             they are immune to Row 2 overflow-x-clip at 1024–1180 px viewports.
             Mic and Speaker remain here — they relate to active voice session. -->
        <span class="h-5 w-px bg-white/20 mx-0.5 shrink-0" aria-hidden="true" />
        <!-- P5 (2026-05-27): data-crest-tip wrappers on inline icon-only buttons.
             span.inline-flex needed because DictateButton/SpeakerButton are components
             (can't add data-* to a component root directly from parent). -->
        <span class="inline-flex" data-crest-tip="🎤 Dictate — speak to fill the form (⌘M)">
          <DictateButton
            :active="dictationActive"
            :supported="dictationSupported"
            :compact="true"
            @toggle="toggleDictation()"
          />
        </span>
        <span class="inline-flex" data-crest-tip="🔊 Read Aloud — hear the current plan content">
          <SpeakerButton
            :text="speakerText"
            :compact="true"
            @speak="handleSpeak"
          />
        </span>
        <!-- (⚡ Actions and 🤖 Agents moved to Row 1 absolute-right cluster) -->
        </div>
      </div>
    </div>

    <!-- Row 2: Plan Story strip (toggled by the bright 🧬 Plan Story button) -->
    <PlanDNAStrip
      v-if="planDNAOpen"
      :plan-model="planModel"
      @close="planDNAOpen = false"
      @edit-stewards="planPeopleTab = 'owners'; planOwnerPanelOpen = true"
    />

  </div>

  <!-- Plan Owner Data panel — pinned below the plan bar when open -->
  <PlanOwnerPanel
    v-if="view === 'app' && planModel && planOwnerPanelOpen"
    :initial-tab="planPeopleTab"
    :plan-model="planModel"
    @close="planOwnerPanelOpen = false"
  />

  <!-- Plan Governance / Spec Owners drawer -->
  <SpecOwnersPanel
    v-if="view === 'app' && planModel && govPanelOpen"
    :plan-model="planModel"
    @close="govPanelOpen = false"
  />

  <!-- Feature #195: Plan Targets panel -->
  <PlanTargetsPanel
    v-if="view === 'app' && planTargetsOpen"
    @close="planTargetsOpen = false"
    @open-editor="({ targetId, targetName }) => { planTargetsOpen = false; specEditorOpen = true; _editorTarget = { id: targetId, name: targetName } }"
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
    v-if="view === 'app' && planModel && toolInfoPanelOpen"
    :plan-model-id="planModel.id"
    :plan-model="planModel"
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
    :has-plan="!!planModel"
    :has-spec="!!currentSpec"
    :has-confirmed-steps="confirmedSteps.length > 0"
    :has-multiple-models="_allPlanModels.length > 0"
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
    @select-agent="(id) => { agentMenuOpen = false; if (id === 'maria') mariaBoardOpen = true; if (id === 'maria-analysis') mariaOpen = true; if (id === 'contracts') contractsOpen = true }"
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

  <!-- Feature #199: Priority Record panel — right drawer, z-[485] -->
  <PriorityRecordPanel
    v-if="view === 'app' && planModel && priorityPanelOpen && _priorityEntryId"
    :plan-model-id="planModel.id"
    :entry-id="_priorityEntryId"
    :entry-type="_priorityEntryType"
    :entry-description="_priorityEntryDesc"
    :spec-owners="planModel.governance?.specOwners"
    @close="priorityPanelOpen = false"
  />

  <!-- Feature #201: Global Priority panel — right drawer, z-[493], 3 layers + Review -->
  <GlobalPriorityPanel
    v-if="view === 'app' && planModel && currentSpec && globalPriorityOpen"
    :plan-model-id="planModel.id"
    :spec="currentSpec"
    :spec-owners="planModel.governance?.specOwners ?? []"
    @close="globalPriorityOpen = false"
    @open-priority-info="priorityInfoOpen = true"
  />

  <!-- Feature #202: Plan Health Status — read-only PHI + history graph + notifications -->
  <PlanHealthStatusPanel
    v-if="view === 'app' && planModel && currentSpec && planHealthStatusOpen"
    :plan-model-id="planModel.id"
    :spec="currentSpec"
    :spec-owner-count="planModel.governance?.specOwners?.length ?? 0"
    :has-plan-owner="(planModel.owners?.length ?? 0) > 0"
    :plan-version="planModel.version ? `v${planModel.version}` : ''"
    :by="user?.email ?? 'unknown'"
    :plan-name="planModel.name"
    :plan-owners="planModel.owners ?? []"
    @close="planHealthStatusOpen = false"
    @open-admin="planHealthAdminOpen = true"
  />

  <!-- Feature #202.b: Plan Health Administration — weights, notification policy, audit log -->
  <PlanHealthAdminPanel
    v-if="view === 'app' && planModel && currentSpec && planHealthAdminOpen"
    :plan-model-id="planModel.id"
    :spec="currentSpec"
    :spec-owner-count="planModel.governance?.specOwners?.length ?? 0"
    :has-plan-owner="(planModel.owners?.length ?? 0) > 0"
    :plan-owners="planModel.owners ?? []"
    :plan-version="planModel.version ? `v${planModel.version}` : ''"
    :by="user?.email ?? 'unknown'"
    :plan-name="planModel.name"
    @close="planHealthAdminOpen = false"
    @open-status="planHealthAdminOpen = false; planHealthStatusOpen = true"
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
    v-if="modelDashboardOpen && currentSpec && planModel"
    :spec="currentSpec"
    :model="planModel"
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
       Triggered by ArrowInfoPanel's "open-glyph" emit, or by interactive PlTypeIcon clicks. -->
  <GlyphDataPanel
    v-if="glyphPanelOpen && glyphPanelType"
    :pl-type="glyphPanelType"
    @close="glyphPanelOpen = false"
    @show-glyph="(t) => { glyphPanelType = t }"
  />

  <!-- Spec Direct Relations — right-side drawer (Tom 2026-05-16) -->
  <SpecDirectRelations
    v-if="sdrOpen && currentSpec"
    :spec="currentSpec"
    :evo-steps="confirmedSteps"
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

  <div
    class="min-h-screen bg-gray-50 flex flex-col items-center justify-start pb-16 px-4 md:pr-40
           overflow-x-clip"
    :class="view === 'app' && planModel ? (planDNAOpen ? 'pt-[20rem]' : 'pt-36') : 'pt-8'"
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
           for just this child; the calc widths and -ml-4 then work correctly. -->
      <div class="self-start -ml-4 w-[calc(100%+2rem)] md:w-[calc(100%+11rem)]">
        <ValueCounter
          :current-stage="planningStage"
          @go-to-stage="handleStageBarNav"
          @open-glyph="openGlyphPanel"
          @stage-action="handleStageAction"
        />
      </div>

      <!-- ── Stage navigation breadcrumb ────────────────────────────────────────
           Tom 2026-05-28: "There is a universal rule. We need clear navigation
           back to previous screen, and possibly other origins. There is no back
           (to actions)."
           Two persistent control pins (top rule): ← Back (when not at stage 1)
           + ⚡ Actions shortcut. ← Back decrements planningStage so the user can
           step backwards through the planning cycle without hunting for the right
           pill in the stage bar. ⚡ Actions surfaces the tile hub from anywhere.
           Shown only in 'app' view when a spec exists or the user is active. -->
      <div class="flex items-center gap-2 mb-1 px-0.5 flex-wrap">
        <!-- ← Back to previous stage -->
        <button
          v-if="planningStage > 1"
          type="button"
          class="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5
                 text-sm font-medium text-slate-500 hover:text-slate-800
                 bg-white/60 hover:bg-white border border-slate-200 hover:border-slate-300
                 shadow-sm transition-all duration-150 select-none"
          :title="`Go back to Stage ${planningStage - 1}`"
          :aria-label="`Go back to stage ${planningStage - 1}`"
          @click="handleStageBarNav(planningStage - 1)"
        >
          ← Back
        </button>

        <!-- Stage-specific primary action button (Tom 2026-05-28: "repeat that step / do step actions") -->
        <button
          v-if="planningStageAction"
          type="button"
          class="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5
                 text-sm font-semibold text-white
                 bg-gradient-to-r from-indigo-500 to-violet-500
                 hover:from-indigo-600 hover:to-violet-600
                 shadow-sm hover:shadow-md transition-all duration-150 select-none"
          :title="`${planningStageAction.label} — primary action for Stage ${planningStage}`"
          :aria-label="planningStageAction.label"
          @click="planningStageAction.handler()"
        >
          {{ planningStageAction.label }}
        </button>

        <div class="flex-1" aria-hidden="true" />

        <!-- → Next stage -->
        <button
          v-if="planningStage < 11"
          type="button"
          class="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5
                 text-sm font-medium text-slate-500 hover:text-slate-800
                 bg-white/60 hover:bg-white border border-slate-200 hover:border-slate-300
                 shadow-sm transition-all duration-150 select-none"
          :title="`Go to Stage ${planningStage + 1}`"
          :aria-label="`Go to Stage ${planningStage + 1}`"
          @click="handleStageBarNav(planningStage + 1)"
        >
          Next →
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
          🤖 Agents
        </button>
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
            title="Get A Plan — `[*]→*` from vessel back out"
            @click="planInputOpen = true"
          >
            <GetGlyph size="compact" class="h-3 w-auto" aria-hidden="true" />
            <span>Get A Plan</span>
          </button>
          <!-- Feature #17: Compare button — only visible in stage 1 -->
          <button
            v-if="stage === 1"
            type="button"
            class="h-9 px-2.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-medium
                   hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500
                   transition-colors duration-150 shrink-0"
            aria-label="Compare"
            @click="comparisonMode = true"
          >
            ⇄ Compare
          </button>
          <!-- Plan History — also in the persistent plan identity bar + in Actions menu -->
          <div class="relative shrink-0">
            <button
              type="button"
              class="h-9 px-2.5 rounded-lg bg-indigo-100 text-indigo-700 text-xs font-medium
                     hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500
                     transition-colors duration-150"
              aria-label="Plan History"
              @click="historyOpen = true"
            >
              🕐 History
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
          <!-- ⌘I Illuminate button — pinned next to Find; violet-tinted to signal it is
               the Illuminate feature's entry point. Tom 2026-05-17 discoverability pass.
               Renamed Define → Illuminate 2026-05-18. -->
          <button
            type="button"
            class="h-9 px-2.5 rounded-lg bg-violet-100 text-violet-700 text-xs font-medium
                   hover:bg-violet-200 flex items-center gap-1
                   focus:outline-none focus:ring-2 focus:ring-violet-500 transition-colors duration-150 shrink-0"
            aria-label="Illuminate a Planguage term (Cmd+I)"
            title="Illuminate any term — select text first, or click to type one  (⌘I)"
            @click="openDefineSearch()"
          >
            <span class="text-sm leading-none" aria-hidden="true">💡</span>
            <span class="hidden sm:inline">Illuminate</span>
            <kbd class="hidden sm:inline-flex items-center px-1 rounded bg-violet-200 text-violet-600 font-mono text-[9px] leading-none py-0.5 ring-1 ring-violet-300">⌘I</kbd>
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
          class="bg-indigo-600 text-white rounded-lg px-5 py-3 text-sm font-semibold
                 min-h-[44px] flex items-center gap-2
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
          title="Get A Plan — `[*]→*` from vessel back out"
          @click="planInputOpen = true"
        >
          <GetGlyph size="compact" class="h-3 w-auto" aria-hidden="true" />
          <span>Get A Plan</span>
        </button>
        <!-- Feature #17: Compare button in mock mode -->
        <button
          type="button"
          class="h-9 px-2.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-medium
                 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500
                 transition-colors duration-150 shrink-0"
          aria-label="Compare"
          @click="comparisonMode = true"
        >
          ⇄ Compare
        </button>
        <!-- Plan History — also in the persistent plan identity bar + in Actions menu -->
        <div class="relative shrink-0">
          <button
            type="button"
            class="h-9 px-2.5 rounded-lg bg-indigo-100 text-indigo-700 text-xs font-medium
                   hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500
                   transition-colors duration-150"
            aria-label="Plan History"
            @click="historyOpen = true"
          >
            🕐 History
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
        <!-- ⌘I Illuminate button (mock mode) — violet-tinted, paired with Find.
             Tom 2026-05-17 discoverability pass. Renamed Define → Illuminate 2026-05-18. -->
        <button
          type="button"
          class="h-9 px-2.5 rounded-lg bg-violet-100 text-violet-700 text-xs font-medium
                 hover:bg-violet-200 flex items-center gap-1
                 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-colors duration-150 shrink-0"
          aria-label="Illuminate a Planguage term (Cmd+I)"
          title="Illuminate any term — select text first, or click to type one  (⌘I)"
          @click="openDefineSearch()"
        >
          <span class="text-sm leading-none" aria-hidden="true">💡</span>
          <span class="hidden sm:inline">Illuminate</span>
          <kbd class="hidden sm:inline-flex items-center px-1 rounded bg-violet-200 text-violet-600 font-mono text-[9px] leading-none py-0.5 ring-1 ring-violet-300">⌘I</kbd>
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
              class="h-20 w-20 flex-shrink-0 rounded-2xl shadow-lg"
            />
            <div>
              <h1 class="text-3xl font-bold text-gray-900 tracking-tight leading-tight">SEM App</h1>
              <p class="text-sm text-gray-500 mt-1">Stakes · Ends · Means → Planguage Specification</p>
              <img
                src="/symbol-sem.svg"
                alt="Stakeholder fires means at ends"
                class="mt-2 h-8 opacity-60"
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
            <!-- AmuseMeButton — spec regeneration loading (sdkLoading true while re-generating) -->
            <AmuseMeButton
              :is-loading="sdkLoading"
              :spec-block="currentSpec"
              :planning-stage="planningStage"
              class="w-full max-w-xl"
            />

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
                  — plan version {{ planModel?.version ?? '—' }}
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

            <!-- AmuseMeButton — first spec generation loading (sdkLoading true while generating) -->
            <AmuseMeButton
              :is-loading="sdkLoading"
              :spec-block="currentSpec"
              :planning-stage="planningStage"
              class="w-full max-w-xl"
            />

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
            aria-label="Back to spec"
            @click="goToStage1()"
          >
            <span class="text-xl leading-none" aria-hidden="true">←</span>
            <div class="text-left">
              <div class="text-[10px] font-normal opacity-75 uppercase tracking-wide">Return to</div>
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
            aria-label="Back to plan"
            @click="goToStage2()"
          >
            <span class="text-xl leading-none" aria-hidden="true">←</span>
            <div class="text-left">
              <div class="text-[10px] font-normal opacity-75 uppercase tracking-wide">Return to</div>
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
        </div>
        <ImpactEstimationView
          ref="ietRef"
          :values="currentSpec.values"
          :solutions="currentSpec.solutions"
          :resource-claims="{}"
          @matrix-updated="(matrix, efficiency, cal, cap) => { capturedImpactMatrix.value = matrix; capturedVCRatios.value = efficiency; capturedCalendarCosts.value = cal; capturedCapitalCosts.value = cap }"
        />
        <div class="w-full max-w-2xl mt-4 px-4">
          <button
            type="button"
            class="w-full flex items-center justify-center min-h-[44px] rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            aria-label="Plan Tasks"
            @click="goToTasksStage"
          >
            Plan Tasks <span aria-hidden="true">→</span>
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
            aria-label="Back to impact"
            @click="_closeAllOverlays(); stage = 3"
          >
            <span class="text-xl leading-none" aria-hidden="true">←</span>
            <div class="text-left">
              <div class="text-[10px] font-normal opacity-75 uppercase tracking-wide">Return to</div>
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
            class="flex items-center gap-1.5 px-4 py-2.5 rounded-xl min-h-[44px]
                   bg-white border border-slate-200 text-slate-700 text-sm font-medium
                   hover:bg-slate-50 hover:border-slate-300
                   focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-1
                   transition-all duration-150 shadow-sm"
            aria-label="Copy tasks to clipboard"
            title="Copy tasks to clipboard as plain text"
            @click="autoCopyPlan()"
          >
            <span aria-hidden="true">📋</span>
            <span>Copy</span>
          </button>

          <!-- Email tasks — universal email rule: email wherever copy appears -->
          <button
            v-if="currentSpec && _stepsForDiagram.length > 0"
            type="button"
            class="flex items-center gap-1.5 px-4 py-2.5 rounded-xl min-h-[44px]
                   bg-white border border-indigo-200 text-indigo-700 text-sm font-medium
                   hover:bg-indigo-50 hover:border-indigo-300
                   focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-1
                   transition-all duration-150 shadow-sm"
            aria-label="Email tasks via Mail.app"
            title="Email this task plan — opens Mail.app with the plan pre-filled in the body"
            @click="emailPlan()"
          >
            <span aria-hidden="true">✉️</span>
            <span>Email</span>
          </button>
        </div>
        <!-- _stepsForDiagram = confirmedSteps if confirmed, else plan.value.steps as fallback.
             Prevents "No Evo steps available. Confirm a plan first." when a plan is generated
             but the user hasn't clicked Confirm Plan in EvoPlanView (Tom 2026-05-29). -->
        <TaskList
          :steps="_stepsForDiagram"
          :spec="currentSpec"
          @update:tasks-by-step="tasksByStep = $event"
        />
        <div class="w-full max-w-2xl mt-4">
          <button
            type="button"
            class="w-full flex items-center justify-center min-h-[44px] rounded-lg bg-green-600 px-6 py-3 text-sm font-semibold text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
            aria-label="Export Prioritised Plan"
            @click="exportFull"
          >
            Export Prioritised Plan <span aria-hidden="true">→</span>
          </button>
        </div>
      </template>

      <!-- Stage 5: Exported prioritised plan -->
      <template v-else-if="stage === 5 && currentSpec">
        <div class="w-full max-w-3xl mb-4">
          <button
            type="button"
            class="flex items-center gap-3 px-5 py-3 rounded-2xl min-h-[52px]
                   bg-gradient-to-r from-emerald-500 to-teal-500 text-white
                   font-semibold text-sm shadow-md shadow-emerald-200/70
                   hover:from-emerald-600 hover:to-teal-600 hover:shadow-lg
                   focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2
                   transition-all duration-200 active:scale-[0.98]"
            aria-label="Back to task decomposition"
            @click="_closeAllOverlays(); stage = 4"
          >
            <span class="text-xl leading-none" aria-hidden="true">←</span>
            <div class="text-left">
              <div class="text-[10px] font-normal opacity-75 uppercase tracking-wide">Return to</div>
              <div class="font-bold leading-tight">Task Decomposition</div>
            </div>
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
          :plan-name="planModel?.name"
          :plan-version="planModel?.version"
          :plan-saved-at="planModel?.updatedAt"
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
         Next Step pill sits at left-6 bottom-52 (left side, primary forward action). -->
    <!-- Next Step pill — hidden when PlanOwnerPanel is open to prevent left-side overlap. -->
    <Teleport to="body">
      <button
        v-if="nextActionLabel && !planOwnerPanelOpen"
        type="button"
        :aria-label="nextActionLabel"
        class="fixed bottom-52 left-6 z-[370] flex items-center gap-1.5 px-4 py-2.5
               rounded-full shadow-lg text-sm font-semibold select-none
               bg-indigo-600 text-white
               hover:bg-indigo-700 active:bg-indigo-800
               transition-colors duration-150
               focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-400"
        @click="goNext"
      >
        {{ nextActionLabel }} <span aria-hidden="true">→</span>
      </button>
    </Teleport>

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
      <!-- Design log r08 2026-05-27: Moved outside !planModel guard so the menu
           dropdown renders when planModel exists (compact Plan Crest bar case).
           Previously: cluster was v-if="!planModel" so clicking the compact
           ⚡ button in the Plan Crest bar toggled menuOpen but the dropdown
           never rendered (it was hidden inside the !planModel cluster). Fix:
           allow cluster to render when menuOpen||renamePopoverOpen even if
           planModel exists. Buttons row is v-if="!planModel" to prevent
           duplication (they're already in the Plan Crest bar when plan loaded). -->
      <div
        v-if="view === 'app' && (!planModel || menuOpen || renamePopoverOpen) && !comparisonOpen && !planInputOpen && !modelsOpen && !wizardOpen && !historyOpen && !specEditorOpen"
        :class="['fixed z-[9999] flex flex-col items-end gap-2', planModel ? 'top-10 right-4' : 'top-4 right-4']"
      >

      <!-- 🎤 Mic + 🔊 Speaker + ⚡ Actions + 🆘 SOS — control pins (no-plan state only).
           When planModel exists these buttons live in the Plan Crest bar instead.
           Tom 2026-05-13: "mic and speaker need to be on the surface at all times."
           Tom 2026-05-26: control-pins rule — at TOP, never bottom-left or -right.
           SOS added here 2026-05-29: after startFresh() planModel=null hides the
           Plan Crest, removing the SOS button. Tom was stuck with no escape. SOS
           must always be reachable regardless of plan state. -->
      <div v-if="!planModel" class="flex items-center gap-2">
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
        aria-label="Edit plan name and owner"
      >
        <p class="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Plan Identity</p>

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
         Listens to all text selections; also responds to Cmd+I and voice "Illuminate". -->
    <SelectionDefiner :spec="currentSpec" />

    <!-- 🛟 InputSafetyNetToast — universal draft-loss recovery.
         Watches any field that registers via useInputSafetyNet().watchField(...).
         Raises an Oops toast with Restore / ⌘Z / voice-Yes paths when the user
         drops ≥50 % of a ≥5-word draft. Tom 2026-05-14: never punish a user
         the way Claudian punished him. z-[900] so it sits above all surfaces. -->
    <InputSafetyNetToast />

    <!-- Focus mode — blur backdrop + countdown chip (z-[880], below focused panel z-[920]) -->
    <FocusModeBackdrop />

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
            <!-- Universal Close-Button Rule: <CloseDot> on the right (2026-05-12) -->
            <CloseDot aria-label="Close History" @click="historyOpen = false" />
          </div>
          <!-- Body -->
          <div class="flex-1 overflow-hidden">
            <SpecHistory
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

    <!-- Evo Step 11: Evo Simulator — animated delivery timeline + cumulative value chart -->
    <!-- _stepsForDiagram = confirmedSteps if confirmed, else plan.value.steps as fallback.
         Prevents "No Evo steps available" when a plan exists but hasn't been formally confirmed
         via the Confirm Plan button (Tom 2026-05-29). -->
    <EvoSimulatorView
      v-if="evoSimulatorOpen"
      :steps="_stepsForDiagram"
      :vc-ratios="capturedVCRatios"
      @close="evoSimulatorOpen = false"
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
    <PlanModelPanel
      v-if="modelsOpen"
      @close="modelsOpen = false"
      @load="handleRestoreModel"
    />

    <!-- Model Comparison — full-screen modal triggered from PlanModelBar "📊 Compare" -->
    <ModelComparisonView
      v-if="comparisonOpen"
      :initial-model="planModel ?? undefined"
      @close="comparisonOpen = false"
    />

    <!-- Get A Plan — unified import / history / merge panel -->
    <GetAPlanPanel
      v-if="planInputOpen"
      :has-current-plan="!!currentSpec"
      @imported="handlePlanImported"
      @imported-and-sharpen="handlePlanImportedAndSharpen"
      @add-to="handlePlanAddTo"
      @load-model="handleGetAPlanLoadModel"
      @restore-version="handleGetAPlanRestoreVersion"
      @close="planInputOpen = false"
    />

    <!-- Evo Step 10: In-app confidence survey (2S.V.PlannerConfidence / 2S.V.PlannerPlanningTrust) -->
    <SurveyGateModal
      v-if="view === 'app'"
      :visible="surveyVisible"
      :question="activeSurveyQuestion"
      @rate="survey.submitRating"
      @dismiss="survey.dismissSurvey"
    />

  </div>
</template>

<style>
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
