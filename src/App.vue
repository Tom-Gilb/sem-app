<script setup lang="ts">
// App.vue — root component with auth guard and view routing
// Spec: S.EvoStep4.InvitationFlow / F.ImplementMultiUserAuthLayer
//       S.Evo7.EvoStepPlannerComponent / S.Evo8.TaskDecompositionComponent
//       S.Evo9.VDTTableComponent / S.Evo9.PrioritisedPlanExport
// Auth views are shown before the SEM entry form when not authenticated.

import { ref, computed, onMounted, nextTick, watch, type ComponentPublicInstance } from 'vue'
import SEMEntryForm from './components/SEMEntryForm.vue'
import SpecOutput from './components/SpecOutput.vue'
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
import CollaborationCursors from './components/CollaborationCursors.vue'
import SpecCoach from './components/SpecCoach.vue'
import ComparisonMode from './components/ComparisonMode.vue'
import SpecHistory from './components/SpecHistory.vue'
import ReplayOverlay from './components/ReplayOverlay.vue'
import ProjectDashboard from './components/ProjectDashboard.vue'
import { useSDK } from './composables/useSDK'
import { useCollaborationCursors } from './composables/useCollaborationCursors'
import { useCollabConflict } from './composables/useCollabConflict'
import { useClarifyingQuestions } from './composables/useClarifyingQuestions'
import { useSpecExport, exportPrioritisedPlan, exportWithTasks, serialisePlainText, exportWithTasksPlainText } from './composables/useSpecExport'
import { useAuth } from './composables/useAuth'
import { useWorkspace } from './composables/useWorkspace'
import { useLoadingState } from './composables/useLoadingState'
import { useDemoMode } from './composables/useDemoMode'
import { useSpecHistory } from './composables/useSpecHistory'
import { useReplay } from './composables/useReplay'
import { useProjectDashboard } from './composables/useProjectDashboard'
import { useSessionPersist } from './composables/useSessionPersist'
import { useToast } from './composables/useToast'
import { useAnalyticsEvents } from './composables/useAnalyticsEvents'
import { useSurveyGate } from './composables/useSurveyGate'
import { useDictation } from './composables/useDictation'
import { speak, stopSpeaking } from './composables/useSpeaker'
import SurveyGateModal from './components/SurveyGateModal.vue'
import DictateButton from './components/DictateButton.vue'
import SpeakerButton from './components/SpeakerButton.vue'
import SharpenPanel from './components/SharpenPanel.vue'
import SharpenDropdown from './components/SharpenDropdown.vue'
import { resetSharpen, startSharpen, useSharpen } from './composables/useSharpen'
import type { SharpenCategory } from './composables/useSharpen'
import PlanModelBar from './components/PlanModelBar.vue'
import PlanModelPanel from './components/PlanModelPanel.vue'
import ModelComparisonView from './components/ModelComparisonView.vue'
import PlanInputPanel from './components/PlanInputPanel.vue'
import {
  usePlanModel,
  initPlanModel,
  bumpPlanVersion,
  clearPlanModel,
  activatePlanModel,
  latestPlanModel,
  savePlanSnapshot,
  renamePlanModel,
  type PlanModel,
} from './composables/usePlanModel'
import { clearComparison } from './composables/useModelComparison'
import SelectionDefiner from './components/SelectionDefiner.vue'
import { defineCurrentSelection } from './composables/useDefine'
import SpecWizard from './components/SpecWizard.vue'
import SpecPresentation from './components/SpecPresentation.vue'
import BullockPanel from './components/BullockPanel.vue'
import OnboardingTour from './components/OnboardingTour.vue'
import type { SpecBlock } from './types/spec'
import type { EvoStep } from './types/evo-plan'
import type { TaskSuggestion } from './types/task'
import type { ImpactMatrix } from './types/impact'

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
const { startLoading, stopLoading } = useLoadingState()

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
const { sharpenedEntryIds, rounds: sharpenRounds } = useSharpen()

// --- Feature #177: Generated-at timestamp ---
// Set whenever a spec is generated (doTranslate) or restored (session).
// Passed to SpecOutput for display in the spec header.
const specGeneratedAt = ref<Date | null>(null)

// --- Plan Model ---
// Named, versioned model tracking for each spec/plan pair.
// Initialised in doTranslate(); bumped in onSpecSharpened().
const { currentModel: planModel, allModels: _allPlanModels } = usePlanModel()

// --- Rename popover ---
// Small inline popover that lifts above the Rename pill button on the left.
const renamePopoverOpen  = ref(false)
const renameInputVal     = ref('')

function openRenamePopover(): void {
  renameInputVal.value  = planModel.value?.name ?? ''
  renamePopoverOpen.value = true
}

function submitRename(): void {
  const trimmed = renameInputVal.value.trim()
  if (trimmed && planModel.value) {
    renamePlanModel(planModel.value.id, trimmed)
  }
  renamePopoverOpen.value = false
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
  removeEntry: removeDashboardEntry,
  clearAll: clearDashboard,
} = useProjectDashboard()
const dashboardOpen = ref(false)

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

// --- Feature #29: Spec Version History ---
const { history: specHistory, addVersion, clearHistory: _clearHistory } = useSpecHistory()
const historyOpen = ref(false)

function onHistoryRestore(spec: SpecBlock): void {
  currentSpec.value = spec
  historyOpen.value = false
  addVersion(spec, 'Restored')
}

function onAmbitiousSpec(spec: SpecBlock): void {
  currentSpec.value = spec
  addVersion(spec, 'Make Ambitious')
}

function onLeanSpecSelected(spec: SpecBlock): void {
  currentSpec.value = spec
  addVersion(spec, 'Lean Plan')
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

// Watch currentSpec — add to dashboard whenever a new spec is generated
watch(currentSpec, (spec) => {
  if (spec) addToDashboard(spec)
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

// formResetKey — incremented by startFresh() to force a full SEMEntryForm remount,
// resetting its internal 'input'|'review' sub-stage back to 'input'.
const formResetKey = ref(0)

// formSubStage — mirrors SEMEntryForm's internal stage so App.vue can show the right
// Next Step label. Updated via the 'stage-change' emit from SEMEntryForm.
const formSubStage = ref<'input' | 'review'>('input')

// --- View state ---
// Possible views: 'loading' | 'invite' | 'sign-in' | 'sign-up' | 'confirm' | 'app'
type View = 'loading' | 'invite' | 'sign-in' | 'sign-up' | 'confirm' | 'app'
const view = ref<View>('loading')

// Invitation token extracted from URL (present when user follows an invite link)
const inviteToken = ref<string>('')
const inviteType = ref<string>('invite')

// Whether Supabase is configured at all — if not, skip auth entirely
const supabaseConfigured = computed(() => {
  return !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
})

// --- Stage completion analytics (3P.V.EvoStepPlanQuality / 3P.V.WorkflowCompletionRate) ---
// Fires a stage_complete event whenever the user advances to a new CE stage.
// Also scrolls to top so the new stage content is immediately visible.
watch(stage, (newStage) => {
  analytics.logStageComplete(newStage as 1 | 2 | 3 | 4 | 5)
  nextTick(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
})

onMounted(async () => {
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

  // Initialise session from Supabase (restores persisted login)
  startLoading('auth:init', 'Restoring session…')
  try {
    await init()
  } finally {
    stopLoading('auth:init')
  }

  if (user.value) {
    await initWorkspace()
    _tryRestoreSession()
    view.value = 'app'
    startCursors(user.value.id, user.value.email ?? 'Guest')
  } else {
    view.value = 'sign-in'
  }
})

/**
 * Reads the saved session from localStorage and applies it to the reactive
 * state refs. Called once on mount, just before view transitions to 'app'.
 * Shows a restore toast with a "Start fresh" affordance if a valid session exists.
 */
function _tryRestoreSession(): void {
  const saved = _loadSession()
  if (!saved) return

  // Apply all saved state
  currentSpec.value           = saved.currentSpec
  markdown.value              = saved.markdown ?? ''
  originalInput.value         = saved.originalInput ?? null
  confirmedSteps.value        = saved.confirmedSteps ?? []
  evoPlanConfirmed.value      = saved.evoPlanConfirmed ?? false
  tasksByStep.value           = saved.tasksByStep ?? {}
  capturedImpactMatrix.value  = saved.capturedImpactMatrix ?? {}
  capturedVCRatios.value      = saved.capturedVCRatios ?? {}
  capturedCalendarCosts.value = saved.capturedCalendarCosts ?? {}
  capturedCapitalCosts.value  = saved.capturedCapitalCosts ?? {}

  // If the session was saved while at stage 1 with a spec already generated,
  // advance to stage 2 on restore. The entry form has no persisted text, so
  // showing a blank "What's your project about?" form alongside a ready spec
  // is confusing — the user's intent on returning is to continue planning.
  const restoredStage = (saved.stage ?? 1) as typeof stage.value
  stage.value = (restoredStage === 1 && saved.currentSpec) ? 2 : restoredStage

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
const specOutputEl = ref<HTMLElement | null>(null)

/** Scrolls the SpecOutput smoothly into view after a successful generation from ClarifyView. */
function scrollToSpec(): void {
  // nextTick ensures the DOM has updated (stage1Sub = 'form' re-renders the template)
  nextTick(() => {
    specOutputEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

// --- Demo mode (#8) ---
const { isDemoRunning, demoStage, startDemo, stopDemo, DEMO_STAKES, DEMO_ENDS, DEMO_MEANS } =
  useDemoMode()

const demoProgressPercent = ref(0)
let _demoProgressInterval: ReturnType<typeof setInterval> | null = null

function launchDemo(): void {
  demoProgressPercent.value = 0
  const startTime = Date.now()
  _demoProgressInterval = setInterval(() => {
    const elapsed = Date.now() - startTime
    demoProgressPercent.value = Math.min(100, Math.round((elapsed / 60_000) * 100))
    if (demoProgressPercent.value >= 100) _clearDemoInterval()
  }, 200)

  startDemo({
    fillFields: (_s: string, _e: string, _m: string) => {
      // Demo fills the form by directly calling handleSubmit — no need to update form fields
    },
    submitForm: () => {
      handleSubmit({ stakes: DEMO_STAKES, ends: DEMO_ENDS, means: DEMO_MEANS })
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

// Watch stage → 5: trigger celebration (#12)
watch(stage, (newStage, _oldStage) => {
  if (newStage === 5 && prioritisedMarkdown.value) {
    celebrationVisible.value = true
    if (_celebrationResetTimer !== null) clearTimeout(_celebrationResetTimer)
    _celebrationResetTimer = setTimeout(() => {
      celebrationVisible.value = false
    }, 3500)
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
  }
})

// ── Session auto-save ─────────────────────────────────────────────────────────
// Debounced 500 ms — fires on any meaningful state change.

let _saveTimer: ReturnType<typeof setTimeout> | null = null

function _buildSessionSnapshot() {
  return {
    version: 1 as const,
    savedAt: new Date().toISOString(),
    stage: stage.value,
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
watch([stage, currentSpec, markdown, confirmedSteps, evoPlanConfirmed, tasksByStep,
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
  confirmedSteps.value = []
  evoPlanConfirmed.value = false
  tasksByStep.value = {}
  capturedImpactMatrix.value = {}
  capturedVCRatios.value = {}
  capturedCalendarCosts.value = {}
  capturedCapitalCosts.value = {}
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
function improveCurrentVersion(): void {
  stage.value = 1
}

/**
 * Voice / keyboard "Go" / "Next step" / "Continue" command.
 * Fires the primary forward-action button for the current stage.
 *
 * Stage 1 + spec ready  → Plan Evo Steps
 * Stage 1, form in review → Generate Spec (form's own generate button)
 * Stage 2              → Confirm Plan (EvoPlanView)
 * Stage 3              → Estimate Impact & Prioritise
 * Stage 4              → Export Prioritised Plan
 */
function goNext(): void {
  if (stage.value === 1) {
    if (currentSpec.value) {
      goToPlanStage()
    } else {
      // SEMEntryForm review stage — click the Generate Spec button
      ;(document.getElementById('sem-generate-btn') as HTMLButtonElement | null)?.click()
    }
  } else if (stage.value === 2) {
    // Confirm Plan button inside EvoPlanView — find it by aria-label
    const btn = document.querySelector<HTMLButtonElement>('button[aria-label="Confirm Plan"]:not([disabled])')
    btn?.click()
  } else if (stage.value === 3) {
    goToImpactStage()
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
  if (stage.value === 2) return 'Confirm Plan'
  if (stage.value === 3) return 'Estimate Impact'
  if (stage.value === 4) return 'Export Plan'
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
  currentSpec.value = refined
  addVersion(refined, 'Sharpened')
  markdown.value = serialise(refined)
  bumpPlanVersion(refined)   // bump plan model version (0.1 → 0.2 → …) after each sharpen round
}

/**
 * Called when SharpenDropdown (in the nav bar) emits 'open-sharpen'.
 * Opens the SharpenPanel modal and immediately kicks off the chosen category.
 */
async function handleOpenSharpen(cat: SharpenCategory): Promise<void> {
  if (!currentSpec.value) return
  sharpenModalOpen.value = true
  await startSharpen(currentSpec.value, cat)
}

/**
 * Called when EvoPlanView emits 'sharpen-plan' (top or bottom Sharpen button).
 * Opens the SharpenPanel modal in idle state so the user can pick a dimension.
 */
function handleSharpenPlan(): void {
  sharpenModalOpen.value = true
}

/**
 * Called when PlanInputPanel emits 'imported'.
 * Treats the parsed spec identically to a generated one: initialise plan model,
 * record version history, serialise markdown, stay at stage 1 for review.
 */
function handlePlanImported(spec: SpecBlock): void {
  currentSpec.value      = spec
  specGeneratedAt.value  = new Date()
  initPlanModel(spec)
  addVersion(spec, 'Imported')
  markdown.value    = serialise(spec)
  planInputOpen.value = false
  stage.value       = 1
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
  addVersion(merged, 'Added from import')
  if (planModel.value) savePlanSnapshot(merged)
  planInputOpen.value = false
  stage.value = 1
  scrollToSpec()
}

/**
 * Called when PlanModelBar emits 'load' with a recalled or imported PlanModel.
 * Restores the spec from the model snapshot and advances to the plan view.
 */
function handleLoadPlanModel(model: PlanModel): void {
  currentSpec.value = model.spec
  specGeneratedAt.value = model.createdAt ? new Date(model.createdAt) : new Date()
  markdown.value = serialise(model.spec)
  addVersion(model.spec, `Loaded from ${model.name} v${model.version}`)
  activatePlanModel(model)
  stage.value = 2
}

/**
 * Restore a model's spec into stage 1 (spec-review view) without advancing to plan.
 * Called from the PlanModelBar in stage 1 and from PlanModelPanel.
 */
function handleRestoreModel(model: PlanModel): void {
  currentSpec.value = model.spec
  specGeneratedAt.value = model.createdAt ? new Date(model.createdAt) : new Date()
  markdown.value = serialise(model.spec)
  addVersion(model.spec, `Resumed: ${model.name} v${model.version}`)
  activatePlanModel(model)
  sharpeningDone.value = false
  resetSharpen()
  stage.value = 1
  modelsOpen.value = false
}

/**
 * One-tap "Resume last" — loads the most recently saved model back to spec view.
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
  if (currentSpec.value) savePlanSnapshot(currentSpec.value)
}

// ─────────────────────────────────────────────────────────────────────────────

async function handleSubmit(payload: { stakes: string; ends: string; means: string; wish?: string; wishStakeholder?: string }) {
  // Discard any prior restored session — user is starting a new spec
  _clearSession()
  sessionRestored.value = false

  // Reset sharpening state — each new spec starts unsharped
  sharpeningDone.value = false
  resetSharpen()

  markdown.value = ''
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
}

/** Runs the actual translation, optionally with clarification answers */
async function doTranslate(
  payload: { stakes: string; ends: string; means: string },
  clarifications?: string,
): Promise<void> {
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
      initPlanModel(annotatedSpec)         // Plan Model — auto-name from first F. entry, version 0.1
      addVersion(annotatedSpec, 'Generated')
      markdown.value = serialise(annotatedSpec)
      succeeded = true
      scrollToSpec()
      // Evo Step 10: log spec_generated event (3P.V.EntryFluency / 2S.V.PlannerConfidence)
      const allFieldsPresent = annotatedSpec.values.every(
        (v) => v.scale && v.meter && v.status && v.tolerable && v.goal,
      )
      analytics.logSpecGenerated(annotatedSpec.values.length, allFieldsPresent, Date.now() - _translateStart)
      survey.triggerPostGeneration()
    }
  } finally {
    stopLoading('sdk:translate')
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

/** Called when user clicks "Plan Evo Steps" in Stage 1 */
function goToPlanStage(): void {
  if (currentSpec.value) {
    stage.value = 2
  }
}

/** Called when EvoPlanView emits 'confirmed' — plan is ready, move to tasks stage */
function onPlanConfirmed(steps: EvoStep[]): void {
  confirmedSteps.value = steps
  evoPlanConfirmed.value = true
  stage.value = 3
  // Evo Step 10: log evo_plan_confirmed event (3P.V.EvoStepPlanQuality / 2S.V.PlannerPlanningTrust)
  analytics.logEvoPlanConfirmed(steps.length)
  survey.triggerPostPlanning()
}

/** Called when user is ready to move from tasks to impact estimation */
function goToImpactStage(): void {
  stage.value = 4
}

/** Called when user wants to export the full prioritised plan */
function exportFull(): void {
  if (!currentSpec.value) return

  // Snapshot the live IET synchronously before stage = 5 unmounts the component.
  // This guarantees we have current data even if the matrix-updated event hasn't
  // fired yet (e.g. the Anthropic API call is still in flight when the user clicks).
  const snapshot = ietRef.value?.getSnapshot?.()
  if (snapshot) {
    capturedImpactMatrix.value  = snapshot.matrix
    capturedVCRatios.value      = snapshot.efficiency
    capturedCalendarCosts.value = snapshot.calendarCosts
    capturedCapitalCosts.value  = snapshot.capitalCosts
  }

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

// ── Email entire plan ─────────────────────────────────────────────────────────
// Strategy: build the complete plain-text plan (identical to the downloaded .txt),
// copy it to the clipboard, then open a mailto: draft with a short instruction body.
// This bypasses the ~2 kB mailto: URL limit while delivering the full plan — no
// truncation, no Markdown, works with Apple Mail, Gmail, and any macOS mail client.
async function emailPlan(): Promise<void> {
  if (!currentSpec.value) return

  const now       = new Date()
  const date      = now.toISOString().slice(0, 10)
  const hh        = now.getHours().toString().padStart(2, '0')
  const mm        = now.getMinutes().toString().padStart(2, '0')
  const modelName = planModel.value?.name ?? 'Planning Spec'
  const version   = planModel.value ? `  v${planModel.value.version}` : ''
  const subject   = `Plan: ${modelName}${version ? ' ' + version.trim() : ''}`

  // Build identical content to the downloaded .txt — full plain-text spec + evo steps
  const HR = '═'.repeat(48)
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

  const fullText = fileHeader + planBody

  // Copy full plan to clipboard — paste into email body with Cmd+V
  try {
    await navigator.clipboard.writeText(fullText)
  } catch {
    // Clipboard write blocked (permissions) — mailto draft still opens
  }

  // Open mail client; short body instructs user to paste the clipboard content
  const mailBody = [
    `${modelName}${version}`,
    `─`.repeat(40),
    `Your full plan has been copied to the clipboard.`,
    `Paste it here with Cmd+V.`,
    ``,
    `(Exported: ${date} ${hh}:${mm})`,
  ].join('\n')

  const a = document.createElement('a')
  a.href  = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(mailBody)}`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
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
    view.value = 'sign-in'
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
    'Compare':                    () => { comparisonMode.value = true },
    'Dashboard':                  () => { dashboardOpen.value = true },
    'Present':                    () => { if (currentSpec.value) presentationOpen.value = true },
    'Tour':                       () => { tourOpen.value = true },
    'Replay':                     () => { if (confirmedSteps.value.length) startReplay(confirmedSteps.value) },
    // Stage flow
    'Plan Evo Steps':             () => { goToPlanStage() },
    'Confirm Plan':               () => { document.querySelector<HTMLButtonElement>('button[aria-label="Confirm Plan"]:not([disabled])')?.click() },
    'Estimate Impact':            () => { goToImpactStage() },
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
    // Define — looks up the currently selected text in the browser
    // Works for "Define", "Define this", "Define the term", "Define selection", etc.
    'Define':                     () => { defineCurrentSelection(currentSpec.value) },
    // Glossary
    'Glossary':                   () => { document.querySelector<HTMLButtonElement>('button[aria-label="Open spec glossary"]')?.click() },
    // Demo
    'Demo':                       () => { view.value = 'app'; launchDemo() },
    'Stop demo':                  () => { handleStopDemo() },
    // Analysis mode
    'Just do it':                 () => { analysisMode.value = 'quick' },
    'Ask for precision':          () => { analysisMode.value = 'precise' },
    // Form submission — triggers Parse and Generate buttons directly
    'Parse my input':             () => { (document.getElementById('sem-parse-btn')    as HTMLButtonElement | null)?.click() },
    'Parse input':                () => { (document.getElementById('sem-parse-btn')    as HTMLButtonElement | null)?.click() },
    'Generate Planguage Spec':    () => { (document.getElementById('sem-generate-btn') as HTMLButtonElement | null ?? document.querySelector<HTMLButtonElement>('button[aria-label="Generate Spec"]:not([disabled])'   ))?.click() },
    'Generate Spec':              () => { (document.getElementById('sem-generate-btn') as HTMLButtonElement | null ?? document.querySelector<HTMLButtonElement>('button[aria-label="Generate Spec"]:not([disabled])'   ))?.click() },
    'Generate':                   () => { (document.getElementById('sem-generate-btn') as HTMLButtonElement | null ?? document.querySelector<HTMLButtonElement>('button[aria-label="Generate Spec"]:not([disabled])'   ))?.click() },
  })
</script>

<template>
  <!-- Global async indicator — always present, visible when any operation is in-flight -->
  <ThinkingIndicator />

  <!-- Feature #12: Celebration confetti overlay -->
  <CelebrationEffect
    :visible="celebrationVisible"
    @done="celebrationVisible = false"
  />

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

  <div class="min-h-screen bg-gray-50 flex flex-col items-center justify-start pt-8 pb-16 px-4 md:pr-40">

    <!-- Loading state while session is being restored -->
    <div
      v-if="view === 'loading'"
      class="flex flex-col items-center justify-center min-h-[40vh] space-y-3"
      role="status"
      aria-live="polite"
    >
      <div
        class="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"
        aria-hidden="true"
      />
      <p class="text-sm text-gray-500">Loading…</p>
    </div>

    <!-- Invitation acceptance — processes token from email deep link -->
    <InviteAcceptView
      v-else-if="view === 'invite'"
      :token="inviteToken"
      :token-type="inviteType"
      @invite-accepted="view = 'app'"
      @invite-failed="view = 'sign-in'"
    />

    <!-- Sign-in view -->
    <template v-else-if="view === 'sign-in'">
      <SignInView
        @signed-in="initWorkspace().then(() => { view = 'app'; if (user) startCursors(user.id, user.email ?? 'Guest') })"
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

    <!-- Sign-up view -->
    <SignUpView
      v-else-if="view === 'sign-up'"
      @signed-up="view = 'confirm'"
      @go-sign-in="view = 'sign-in'"
    />

    <!-- Email confirmation message shown after sign-up -->
    <div
      v-else-if="view === 'confirm'"
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

    <!-- Main SEM App — shown when authenticated (or Supabase not configured) -->
    <template v-else-if="view === 'app'">

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
        class="w-full max-w-2xl mx-auto mb-4 flex items-center justify-between
               px-4 py-2 bg-white rounded-lg shadow-sm border border-gray-200"
      >
        <span class="text-sm text-gray-600 truncate max-w-[200px]">
          {{ user.email }}
        </span>
        <div class="flex items-center gap-2">
          <!-- Feature #40: Replay button — only when confirmed steps exist -->
          <button
            v-if="confirmedSteps.length > 0 && view === 'app'"
            type="button"
            class="h-11 px-3 rounded-lg bg-emerald-100 text-emerald-700 text-sm font-medium
                   hover:bg-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-500
                   transition-colors duration-150"
            aria-label="Replay"
            @click="startReplay(confirmedSteps)"
          >
            ▶ Replay
          </button>
          <!-- Plan Input — import any existing plan document -->
          <button
            type="button"
            class="h-11 px-3 rounded-lg bg-indigo-100 text-indigo-700 text-sm font-medium
                   hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500
                   transition-colors duration-150"
            aria-label="Import Planning Data"
            @click="planInputOpen = true"
          >
            📥 Import
          </button>
          <!-- Feature #17: Compare button — only visible in stage 1 -->
          <button
            v-if="stage === 1"
            type="button"
            class="h-11 px-3 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium
                   hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500
                   transition-colors duration-150"
            aria-label="Compare"
            @click="comparisonMode = true"
          >
            ⇄ Compare
          </button>
          <!-- Feature #29: History button — only visible in stage 1 -->
          <div v-if="stage === 1" class="relative">
            <button
              type="button"
              class="h-11 px-3 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium
                     hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500
                     transition-colors duration-150"
              aria-label="History"
              @click="historyOpen = true"
            >
              🕐 History
            </button>
            <!-- Badge count -->
            <span
              v-if="specHistory.length > 0"
              class="absolute -top-1 -right-1 h-4 min-w-[1rem] rounded-full bg-red-500 text-white
                     text-[10px] font-bold flex items-center justify-center px-0.5 pointer-events-none"
              aria-hidden="true"
            >
              {{ specHistory.length }}
            </span>
          </div>
          <!-- Feature #50: Dashboard button -->
          <div class="relative">
            <button
              type="button"
              class="h-11 px-3 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium
                     hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-500
                     transition-colors duration-150"
              aria-label="Dashboard"
              @click="dashboardOpen = true"
            >
              📊 Dashboard
            </button>
            <span
              v-if="dashboardEntries.length > 0"
              class="absolute -top-1 -right-1 h-4 min-w-[1rem] rounded-full bg-slate-500 text-white
                     text-[10px] font-bold flex items-center justify-center px-0.5 pointer-events-none"
              aria-hidden="true"
            >
              {{ dashboardEntries.length }}
            </span>
          </div>
          <!-- Feature #71: Present button — only when a spec is loaded -->
          <button
            v-if="currentSpec"
            type="button"
            class="bg-slate-700 hover:bg-slate-600 text-white h-11 px-3 text-sm rounded
                   focus:outline-none focus:ring-2 focus:ring-slate-500 transition-colors duration-150"
            aria-label="Present"
            @click="presentationOpen = true"
          >
            ▶ Present
          </button>
          <!-- Feature #77: Onboarding tour button -->
          <button
            type="button"
            class="h-11 px-3 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-600 text-sm font-medium
                   flex items-center gap-1.5
                   focus:outline-none focus:ring-2 focus:ring-slate-400 transition-colors duration-150"
            aria-label="Tour"
            @click="tourOpen = true"
          >
            <span aria-hidden="true">?</span> Tour
          </button>
          <!-- Sharpening Cycles — available whenever a spec is loaded -->
          <SharpenDropdown
            v-if="currentSpec"
            @open-sharpen="handleOpenSharpen"
          />
          <!-- Session restore pill — shown after an automatic session restore -->
          <button
            v-if="sessionRestored"
            type="button"
            class="min-h-[44px] px-3 rounded-full border border-amber-300 bg-amber-50
                   text-xs font-medium text-amber-700 hover:bg-amber-100
                   focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
                   focus-visible:outline-amber-500 transition-colors duration-150"
            aria-label="Start fresh"
            title="Clear restored session and start with a new blank form"
            @click="startFresh"
          >
            ↺ Start fresh
          </button>
          <button
            type="button"
            class="min-h-[44px] min-w-[44px] flex items-center justify-center px-3
                   text-sm text-gray-500 hover:text-gray-700
                   focus-visible:outline focus-visible:outline-2
                   focus-visible:outline-offset-2 focus-visible:outline-blue-600
                   transition-colors duration-150"
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
        <!-- Feature #40: Replay button in mock mode — only when confirmed steps exist -->
        <button
          v-if="confirmedSteps.length > 0"
          type="button"
          class="h-11 px-3 rounded-lg bg-emerald-100 text-emerald-700 text-sm font-medium
                 hover:bg-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-500
                 transition-colors duration-150"
          aria-label="Replay"
          @click="startReplay(confirmedSteps)"
        >
          ▶ Replay
        </button>
        <!-- Plan Input — import any existing plan document (mock mode) -->
        <button
          type="button"
          class="h-11 px-3 rounded-lg bg-indigo-100 text-indigo-700 text-sm font-medium
                 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500
                 transition-colors duration-150"
          aria-label="Import Planning Data"
          @click="planInputOpen = true"
        >
          📥 Import
        </button>
        <!-- Feature #17: Compare button in mock mode -->
        <button
          type="button"
          class="h-11 px-3 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium
                 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500
                 transition-colors duration-150"
          aria-label="Compare"
          @click="comparisonMode = true"
        >
          ⇄ Compare
        </button>
        <!-- Feature #29: History button in mock mode -->
        <div class="relative">
          <button
            type="button"
            class="h-11 px-3 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium
                   hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500
                   transition-colors duration-150"
            aria-label="History"
            @click="historyOpen = true"
          >
            🕐 History
          </button>
          <span
            v-if="specHistory.length > 0"
            class="absolute -top-1 -right-1 h-4 min-w-[1rem] rounded-full bg-red-500 text-white
                   text-[10px] font-bold flex items-center justify-center px-0.5 pointer-events-none"
            aria-hidden="true"
          >
            {{ specHistory.length }}
          </span>
        </div>
        <!-- Feature #50: Dashboard button in mock mode -->
        <div class="relative">
          <button
            type="button"
            class="h-11 px-3 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium
                   hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-500
                   transition-colors duration-150"
            aria-label="Dashboard"
            @click="dashboardOpen = true"
          >
            📊 Dashboard
          </button>
          <span
            v-if="dashboardEntries.length > 0"
            class="absolute -top-1 -right-1 h-4 min-w-[1rem] rounded-full bg-slate-500 text-white
                   text-[10px] font-bold flex items-center justify-center px-0.5 pointer-events-none"
            aria-hidden="true"
          >
            {{ dashboardEntries.length }}
          </span>
        </div>
        <!-- Feature #53: wizard moved into SEMEntryForm toolbar ("🎯 Start with your goal") -->
        <!-- Feature #71: Present button in mock mode — only when a spec is loaded -->
        <button
          v-if="currentSpec"
          type="button"
          class="bg-slate-700 hover:bg-slate-600 text-white h-11 px-3 text-sm rounded
                 focus:outline-none focus:ring-2 focus:ring-slate-500 transition-colors duration-150"
          aria-label="Present"
          @click="presentationOpen = true"
        >
          ▶ Present
        </button>
        <!-- Feature #77: Onboarding tour button in mock mode -->
        <button
          type="button"
          class="bg-slate-200 hover:bg-slate-300 h-9 w-9 rounded-full text-slate-600 font-bold text-sm
                 flex items-center justify-center
                 focus:outline-none focus:ring-2 focus:ring-slate-400 transition-colors duration-150"
          aria-label="Tour"
          @click="tourOpen = true"
        >
          ?
        </button>
        <!-- Sharpening Cycles dropdown — available whenever a spec is loaded -->
        <SharpenDropdown
          v-if="currentSpec"
          @open-sharpen="handleOpenSharpen"
        />
      </div>

      <!-- Feature #15: Value counter strip — visible in app view stages 2+ -->
      <ValueCounter
        :confirmed-steps="confirmedSteps"
        :current-stage="stage"
        :prioritised-exported="!!prioritisedMarkdown"
      />

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
            <div ref="specOutputEl" class="w-full max-w-xl">
              <SpecOutput
                :loading="sdkLoading"
                :error="sdkError"
                :spec="currentSpec"
                :markdown="markdown"
                :raw-input="originalInput"
                :on-ambitious-spec="onAmbitiousSpec"
                :sharpened-entry-ids="sharpenedEntryIds"
                :generated-at="specGeneratedAt"
                @lean-spec-selected="onLeanSpecSelected"
              />
            </div>

            <!-- Plan Model identity strip — visible in stage 1 when a model is active.
                 Lets users rename and version the model before advancing to planning.
                 Uses 'restore' handler so loading a model stays in stage 1. -->
            <div v-if="planModel" class="w-full max-w-xl mt-2">
              <PlanModelBar
                @load="handleRestoreModel"
                @compare="comparisonOpen = true"
                @save="savePlanNow"
              />
            </div>

            <!-- ── Sharpening Cycles — shown between spec and Plan button.
                 The planner iterates over dimensions until "Sharp Enough" is
                 clicked, which sets sharpeningDone and reveals Plan Evo Steps. -->
            <SharpenPanel
              v-if="!sdkLoading && !sharpeningDone"
              :spec="currentSpec"
              @sharpened="onSpecSharpened"
              @done="sharpeningDone = true"
            />

            <!-- Plan Evo Steps + Audit Trail — revealed only after "Sharp Enough" -->
            <div v-if="!sdkLoading && sharpeningDone" class="w-full max-w-xl mt-4 space-y-2">
              <button
                type="button"
                class="w-full flex items-center justify-center min-h-[44px] rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                aria-label="Plan Evo Steps"
                @click="goToPlanStage"
              >
                Plan Evo Steps <span aria-hidden="true">→</span>
              </button>
              <!-- Bullock: review all changes before committing to planning -->
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
              :key="formResetKey"
              @submit="handleSubmit"
              @wizard="wizardOpen = true"
              @stage-change="formSubStage = $event"
            />
            <!-- SpecOutput shown here for loading/error feedback while API call is in flight -->
            <div ref="specOutputEl" class="w-full max-w-xl">
              <SpecOutput
                :loading="sdkLoading"
                :error="sdkError"
                :spec="currentSpec"
                :markdown="markdown"
                :raw-input="originalInput"
                :on-ambitious-spec="onAmbitiousSpec"
                :sharpened-entry-ids="sharpenedEntryIds"
                :generated-at="specGeneratedAt"
                @lean-spec-selected="onLeanSpecSelected"
              />
            </div>
          </template>
        </template>

      </template>

      <!-- Stage 2: Evo Step Planner -->
      <template v-else-if="stage === 2 && currentSpec">
        <div class="w-full max-w-2xl mb-4">
          <button
            type="button"
            class="flex items-center min-h-[44px] px-3 text-sm text-gray-500 hover:text-gray-700 focus:outline-none focus:underline"
            aria-label="Back to spec"
            @click="stage = 1"
          >
            <span aria-hidden="true">←</span> Back to spec
          </button>
        </div>
        <!-- Plan Model identity bar — name, version, export, load, compare -->
        <PlanModelBar @load="handleLoadPlanModel" @compare="comparisonOpen = true" @save="savePlanNow" />
        <EvoPlanView
          :spec-block="currentSpec"
          @confirmed="onPlanConfirmed($event)"
          @sharpen-plan="handleSharpenPlan"
        />
      </template>

      <!-- Stage 3: Task Decomposition -->
      <template v-else-if="stage === 3">
        <div class="w-full max-w-2xl mb-4">
          <button
            type="button"
            class="flex items-center min-h-[44px] px-3 text-sm text-gray-500 hover:text-gray-700 focus:outline-none focus:underline"
            aria-label="Back to plan"
            @click="stage = 2"
          >
            <span aria-hidden="true">←</span> Back to plan
          </button>
        </div>
        <TaskList :steps="confirmedSteps" />
        <div class="w-full max-w-2xl mt-4">
          <button
            type="button"
            class="w-full flex items-center justify-center min-h-[44px] rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            aria-label="Estimate Impact and Prioritise"
            @click="goToImpactStage"
          >
            Estimate Impact &amp; Prioritise <span aria-hidden="true">→</span>
          </button>
        </div>
      </template>

      <!-- Stage 4: Impact Estimation VDT -->
      <template v-else-if="stage === 4 && currentSpec">
        <div class="w-full max-w-2xl mb-4">
          <button
            type="button"
            class="flex items-center min-h-[44px] px-3 text-sm text-gray-500 hover:text-gray-700 focus:outline-none focus:underline"
            aria-label="Back to tasks"
            @click="stage = 3"
          >
            <span aria-hidden="true">←</span> Back to tasks
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
            class="flex items-center min-h-[44px] px-3 text-sm text-gray-500 hover:text-gray-700 focus:outline-none focus:underline"
            aria-label="Back to impact estimation"
            @click="stage = 4"
          >
            <span aria-hidden="true">←</span> Back to impact estimation
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
          @start-over="stage = 1"
        />
      </template>
    </template>

    <!-- Feature #16: Collaboration Cursors overlay — active when in app view with a user -->
    <CollaborationCursors
      v-if="view === 'app' && user"
      :cursors="remoteCursors"
    />

    <!-- Next Step — dynamic label shows the primary forward action for the current stage.
         Sits at the top of the right pill stack. Disappears when there is no single
         obvious next step (e.g. user is still filling the input textarea). -->
    <button
      v-if="nextActionLabel"
      type="button"
      :aria-label="nextActionLabel"
      class="fixed bottom-80 right-6 z-[370] flex items-center gap-1.5 px-3 py-2
             rounded-full shadow-lg text-sm font-semibold select-none
             bg-indigo-600 text-white
             hover:bg-indigo-700 active:bg-indigo-800
             transition-colors duration-150
             focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-400"
      @click="goNext"
    >
      {{ nextActionLabel }} <span aria-hidden="true">→</span>
    </button>

    <!-- Resume last — standalone pill above Start Over. Text hidden on narrow viewports
         so it collapses to an icon and stops overlapping the plan content. -->
    <button
      v-if="view === 'app' && _allPlanModels.length > 0"
      type="button"
      class="fixed bottom-60 right-6 z-[370] flex items-center gap-1.5 px-2.5 py-2
             rounded-full shadow-lg text-sm font-medium select-none
             bg-white text-indigo-600 border border-indigo-200
             hover:bg-indigo-50 hover:border-indigo-400
             focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-400
             transition-all duration-150"
      aria-label="Resume most recently saved planning model"
      @click="resumeLastModel"
    >
      <span aria-hidden="true">📂</span>
      <span class="hidden sm:inline">Resume last</span>
    </button>

    <!-- All Models — separate pill one slot above Resume last. Full labeled text so
         the purpose is clear. Opens the Planning Models management drawer. -->
    <button
      v-if="view === 'app' && _allPlanModels.length > 0"
      type="button"
      class="fixed bottom-72 right-6 z-[370] flex items-center gap-1.5 px-2.5 py-2
             rounded-full shadow-lg text-sm font-medium select-none
             bg-white text-gray-600 border border-gray-200
             hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200
             focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-400
             transition-all duration-150"
      aria-label="Browse and manage all planning models"
      @click="modelsOpen = true"
    >
      <svg class="h-4 w-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
      </svg>
      <span class="hidden sm:inline">All Models</span>
    </button>

    <!-- Restart Afresh — fixed pill, always visible in app view.
         Two-tap confirmation guard: first tap arms a 3-second window (button pulses
         red + label changes); second tap confirms and clears everything. -->
    <button
      v-if="view === 'app'"
      type="button"
      :aria-label="startOverConfirmPending ? 'Confirm Restart Afresh' : 'Restart Afresh'"
      :class="[
        'fixed bottom-48 right-6 z-[370] flex items-center gap-1.5 px-3 py-2',
        'rounded-full shadow-lg text-sm font-medium select-none',
        'transition-all duration-150',
        'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-400',
        startOverConfirmPending
          ? 'bg-red-600 text-white border border-red-700 animate-pulse'
          : 'bg-white text-gray-500 border border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
      ]"
      @click="requestStartOver"
    >
      <span aria-hidden="true">🔄</span>
      {{ startOverConfirmPending ? 'Confirm?' : 'Restart Afresh' }}
    </button>

    <!-- Improve This Version — returns to Stage 1 spec-review with everything intact.
         All sharpening (🔪), editing, and whisper-menu actions are available there.
         Only shown when a spec is loaded and not already at Stage 1. -->
    <button
      v-if="view === 'app' && currentSpec && stage !== 1"
      type="button"
      class="fixed bottom-36 right-6 z-[370] flex items-center gap-1.5 px-3 py-2
             rounded-full shadow-lg text-sm font-medium select-none
             bg-white text-indigo-600 border border-indigo-200
             hover:bg-indigo-50 hover:border-indigo-400
             focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-400
             transition-all duration-150"
      aria-label="Improve this version"
      title="Go back to spec review to edit, sharpen, or refine this plan"
      @click="improveCurrentVersion"
    >
      <svg class="h-4 w-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
      </svg>
      Improve This Version
    </button>

    <!-- ── Rename model — left side, always visible when a model exists.
         Sits at bottom-48 left-6, above the Save Plan / Email Plan pills.
         Opens a small popover with a pre-filled name input. -->
    <template v-if="view === 'app' && planModel">

      <!-- Rename popover — lifts above the Rename button -->
      <div
        v-if="renamePopoverOpen"
        class="fixed bottom-[14.5rem] left-6 z-[380] w-64 rounded-xl bg-white shadow-2xl border border-indigo-100 p-3 space-y-2"
        role="dialog"
        aria-label="Rename plan model"
      >
        <p class="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Rename Plan</p>
        <input
          v-model="renameInputVal"
          type="text"
          class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          placeholder="Plan name…"
          aria-label="New plan name"
          @keydown.enter="submitRename"
          @keydown.escape="renamePopoverOpen = false"
        />
        <div class="flex gap-2">
          <button
            type="button"
            class="flex-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors"
            aria-label="Save new plan name"
            @click="submitRename"
          >Save</button>
          <button
            type="button"
            class="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-colors"
            aria-label="Cancel rename"
            @click="renamePopoverOpen = false"
          >Cancel</button>
        </div>
      </div>

      <!-- Rename pill button -->
      <button
        type="button"
        class="fixed bottom-48 left-6 z-[370] flex items-center gap-1.5 px-3 py-2
               rounded-full shadow-lg text-sm font-medium select-none
               bg-white text-indigo-600 border border-indigo-200
               hover:bg-indigo-50 hover:border-indigo-400
               focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-400
               transition-all duration-150"
        aria-label="Rename plan model"
        title="Rename this plan"
        @click="openRenamePopover"
      >
        <svg class="h-4 w-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
        </svg>
        Rename
      </button>

    </template>

    <!-- ── Plan export actions — left side, mirroring the right pill stack.
         Only visible when a spec is loaded. Download saves .md to Downloads;
         Email opens the system mail client with a plan summary pre-filled. -->
    <template v-if="view === 'app' && currentSpec">
      <!-- ⬇ Download plan -->
      <button
        type="button"
        class="fixed bottom-36 left-6 z-[370] flex items-center gap-1.5 px-3 py-2
               rounded-full shadow-lg text-sm font-medium select-none
               bg-white text-gray-600 border border-gray-200
               hover:bg-green-50 hover:text-green-700 hover:border-green-300
               focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-400
               transition-all duration-150"
        aria-label="Download full plan as Markdown"
        title="Download plan (.md)"
        @click="downloadPlan"
      >
        <svg class="h-4 w-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
        Save Plan
      </button>

      <!-- ↑ Email plan -->
      <button
        type="button"
        class="fixed bottom-24 left-6 z-[370] flex items-center gap-1.5 px-3 py-2
               rounded-full shadow-lg text-sm font-medium select-none
               bg-white text-gray-600 border border-gray-200
               hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300
               focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400
               transition-all duration-150"
        aria-label="Email full plan"
        title="Send plan by email"
        @click="emailPlan"
      >
        <svg class="h-4 w-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
        </svg>
        Email Plan
      </button>
    </template>

    <!-- 🎤 Voice dictation — input. Always visible, sits above the Coach bubble (right side) -->
    <DictateButton
      :active="dictationActive"
      :supported="dictationSupported"
      @toggle="toggleDictation"
    />

    <!-- 🔊 Text-to-speech — output. Always visible, mirrors mic on the left side -->
    <SpeakerButton
      :text="speakerText"
      @speak="handleSpeak"
    />

    <!-- 📖 SelectionDefiner — global floating "Define" pill + result panel.
         Listens to all text selections; also responds to Cmd+D and voice "Define". -->
    <SelectionDefiner :spec="currentSpec" />

    <!-- Feature #35: AI Spec Coach — floating chat bubble when a spec is generated -->
    <SpecCoach :spec="currentSpec" :visible="!!currentSpec && view === 'app'" />

    <!-- Feature #40: Value Delivery Replay overlay -->
    <ReplayOverlay
      :steps="confirmedSteps"
      :replay-step="replayStep"
      :replay-value="replayValue"
      :is-replaying="isReplaying"
      @stop="stopReplay"
    />

    <!-- Feature #29: Version History drawer -->
    <template v-if="view === 'app' && historyOpen">
      <!-- Backdrop -->
      <div
        class="fixed inset-0 z-[150] bg-black/30"
        aria-hidden="true"
        @click="historyOpen = false"
      />
      <!-- Drawer panel -->
      <div
        class="fixed right-0 top-0 h-full w-80 bg-white shadow-xl z-[200] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label="Version History"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-4 border-b border-gray-100 min-h-[56px]">
          <h2 class="text-sm font-semibold text-gray-900">Version History</h2>
          <button
            type="button"
            class="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400
                   hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
            aria-label="Close History"
            @click="historyOpen = false"
          >
            ×
          </button>
        </div>
        <!-- Body -->
        <div class="flex-1 overflow-hidden">
          <SpecHistory @restore="onHistoryRestore" />
        </div>
      </div>
    </template>

    <!-- Feature #50: Project Dashboard slide-in panel -->
    <ProjectDashboard
      v-if="view === 'app' && dashboardOpen"
      :entries="dashboardEntries"
      :on-restore="(spec: SpecBlock) => { currentSpec = spec; dashboardOpen = false }"
      :on-remove="removeDashboardEntry"
      :on-close="() => { dashboardOpen = false }"
      @clear-all="clearDashboard"
    />

    <!-- Feature #53: Progressive spec wizard -->
    <SpecWizard
      v-if="wizardOpen"
      :on-submit="handleWizardSubmit"
      :on-close="() => { wizardOpen = false }"
    />

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
      @done="sharpenModalOpen = false"
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

    <!-- Plan Input — import any existing plan and parse it as Planguage -->
    <PlanInputPanel
      v-if="planInputOpen"
      :has-current-plan="!!currentSpec"
      @imported="handlePlanImported"
      @imported-and-sharpen="handlePlanImportedAndSharpen"
      @add-to="handlePlanAddTo"
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
