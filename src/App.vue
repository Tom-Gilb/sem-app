<script setup lang="ts">
// App.vue — root component with auth guard and view routing
// Spec: S.EvoStep4.InvitationFlow / F.ImplementMultiUserAuthLayer
//       S.Evo7.EvoStepPlannerComponent / S.Evo8.TaskDecompositionComponent
//       S.Evo9.VDTTableComponent / S.Evo9.PrioritisedPlanExport
// Auth views are shown before the SEM entry form when not authenticated.

import { ref, customRef, computed, onMounted, onUnmounted, nextTick, watch, type ComponentPublicInstance } from 'vue'
import SEMEntryForm from './components/SEMEntryForm.vue'
// r41 v164 — Demos Menu catalog (Tom Gilb 2026-06-17 "MAKE THIS A GENERIC MENU").
import DemosMenu from './components/DemosMenu.vue'
// r41 v168 — Demo Player (renders Tolerable-tier clip + source citation).
import DemoPlayer from './components/DemoPlayer.vue'
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
// r41 v49 — Top-level Mode pin + popover + governance dialog (Tom Gilb 2026-06-16).
import ActiveModeButton from './components/ActiveModeButton.vue'
import ActiveModePopover from './components/ActiveModePopover.vue'
import ModeSwitchGovernanceDialog from './components/ModeSwitchGovernanceDialog.vue'
import { useActiveMode, type ActiveMode, type ModeSwitchChoice } from './composables/useActiveMode'
import TwinChip from './components/TwinChip.vue'
import PrioritisedPlanView from './components/PrioritisedPlanView.vue'
import RefineSolutionsView from './components/RefineSolutionsView.vue'
import ClarifyView from './components/ClarifyView.vue'
import ThinkingIndicator from './components/ThinkingIndicator.vue'
import CelebrationEffect from './components/CelebrationEffect.vue'
import ValueCounter from './components/ValueCounter.vue'
import { PLANNING_STAGES } from './data/planningStages'
// PlanningStageBar superseded by ValueCounter rebuild 2026-05-27 (design log r37)
// import PlanningStageBar from './components/PlanningStageBar.vue'
import CollaborationCursors from './components/CollaborationCursors.vue'
import FocusModeBackdrop from './components/FocusModeBackdrop.vue'
import ToastHistoryBell from './components/ToastHistoryBell.vue'  // r41 v277 — 🔔 recall any toast that disappeared too fast
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
import { renderColorfulSpecHtml } from './composables/useColorfulSpecHtml'
import { exportCopy, exportEmail, exportDownload, getLastClipboardResult } from './composables/useExportShared'
import { useExportBanner } from './composables/useExportBanner'
import { useAuth } from './composables/useAuth'
import { useWorkspace } from './composables/useWorkspace'
import { useLoadingState, _resetLoadingStateForTest as _forceClearLoading } from './composables/useLoadingState'
import { useDemoMode } from './composables/useDemoMode'
import { useSpecHistory, type SpecVersion } from './composables/useSpecHistory'
// v514 — Resources envelope: captures the full state of the 4 resource
// composables (useResourceEstimations + useIetResourceSnapshot +
// usePlanScopeFramework + useResourcesAgent) so it travels with every
// SpecVersion + spec export.  Tom Gilb 2026-07-21 "can you promise me that
// all running estimation data is saved and restored with any version of the
// spec?" — the answer is YES from v514 forward.
import { useResourcesEnvelope, type ResourcesEnvelope } from './composables/useResourcesEnvelope'
import { loadPlan as _loadEvoPlan, clearLoadedPlan as _clearEvoPlan, resetPlanForLoad as _resetPlanForLoad, useEvoPlan } from './composables/useEvoPlan'
import { useReplay } from './composables/useReplay'
import { useProjectDashboard } from './composables/useProjectDashboard'
import { useSessionPersist } from './composables/useSessionPersist'
import { useLastEffortMirror, mirrorAgeLabel } from './composables/useLastEffortMirror'
import { useToast } from './composables/useToast'
import { useStrategyMode } from './composables/useStrategyMode'
import { useSettings } from './composables/useSettings'
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
// r41 v295 (Tom Gilb 2026-06-22 "always continue · research and innovation")
// — Stage 9 Study-Act focused actuals-capture modal. Triage banner above the
// existing sub-step strip auto-detects three states and routes the planner to
// either Skip → Stage 10, Capture Actuals (opens this panel), or Compare to
// Estimates.
import Stage9ActualsPanel from './components/Stage9ActualsPanel.vue'
// Planguage-family glyphs for the Plan Crest people chips — Tom 2026-06-04
// approved set replacing the dated 🔑 / 💡 / ⌨ emojis (per DD-011 / DD-012).
import OwnerGlyph from './components/icons/OwnerGlyph.vue'
import PlanGlyph from './components/icons/PlanGlyph.vue'
import PlannerGlyph from './components/icons/PlannerGlyph.vue'
import ScribeGlyph from './components/icons/ScribeGlyph.vue'
import SpecStoryGlyph from './components/icons/SpecStoryGlyph.vue'
import SpecHealthBadge from './components/SpecHealthBadge.vue'
// r41 v116 — IdentityStrip (Group 3 identity) + StageToolsStrip (Group 2)
// per Tom Gilb 2026-06-17 redesign mandate ("organize into clear groups").
import IdentityStrip from './components/IdentityStrip.vue'
// r41 v415 (Tom Gilb 2026-07-01 verbatim "Can you put a word or symbol telling
// me exactly which agent we are using for running SEM, on the sem surface,
// especially llama.  Is this something I can adjust in my settings?") —
// persistent chip in the IdentityStrip #end slot spells out which AI
// provider + model is answering SEM's API calls (Claude Sonnet vs. local
// Ollama Llama).  Composes with MOVE Principle + Icon-Plus-Text + DD-009
// Zero-Training UI + Model Selection SUPREME (2026-05-30 Haiku lesson).
import ActiveModelChip from './components/ActiveModelChip.vue'
// r41 v417 (Tom Gilb 2026-07-01 "please continue backlog" — audit-backlog
// #2: Stage 1 task-centric workspace per Stage-Has-A-Purpose SUPREME).
// This generic reusable component surfaces the TASK shape of each stage as
// prominent action pins (Capture / Generate / Import / Sharpen / Edit for
// Stage 1); items #5-9 (Stages 6/7/8/9/10) will inherit this component
// with their own action registries in later rev.
import StageTaskWorkspace from './components/StageTaskWorkspace.vue'
import StageToolsStrip from './components/StageToolsStrip.vue'
// r41 v123 — Level 3 · Agents as its own component (Tom Gilb 2026-06-17
// "ship phase 2 — I want all 3 new groups asap").
import AgentsStrip from './components/AgentsStrip.vue'
// r41 v321 (Tom Gilb 2026-06-24) — SpecPulse: persistent 6-tile color-block banner
// showing live counts of Stakeholders / Functions / Values / Solutions / Constraints
// / Resources.  Mounts between AgentsStrip and main stage work.  Tom: "console the
// planner that the Planguage Plan is building up and exists".
import SpecPulse from './components/SpecPulse.vue'
// r41 v335 (Tom Gilb 2026-06-24 "go diagnostics") — in-app console-error capture
// surface for the PWA window where Safari Web Inspector is awkward to reach.
import DiagnosticsPanel from './components/DiagnosticsPanel.vue'
import { useDiagnostics } from './composables/useDiagnostics'
// r41 v141 — Level 1 · Process Tools as its own component (Tom Gilb 2026-06-17
// "keep working, real progress").  Achieves full Level-1/2/3 architectural
// parity; removes ~200 LOC of inline cluster markup × 2 from App.vue.
import ProcessToolsStrip from './components/ProcessToolsStrip.vue'
import { useSpecHealth, type SpecHealthContext, type PlanHealthContext } from './composables/useSpecHealth'
// r41 v200 (Tom Gilb 2026-06-19) — stage-readiness gates fire a toast when
// the current stage's exit-postcondition is unmet at forward-advance time.
// Replaces the historic "skip ahead and do not function" silent-bug class.
import { checkStageExit, STAGE_GATES } from './composables/useStageGates'
// r41 v202 (Tom Gilb 2026-06-19 verbatim "Stage 1:Steps: As you did well
// at a later stage, lets divide into clear steps call them 1.1 Spec
// Entry, 1.2 Spec Parsing, Step 1.3 Parse Implied Sharpening, 1.4
// Planguage Generation, 1.5 Planguage Edit").  Stage 1 sub-step strip
// surfaces the five sub-stages at the top of the Stage 1 view, so the
// planner sees the explicit progression instead of one undifferentiated
// "Stage 1" surface.
import Stage1SubStepStrip from './components/Stage1SubStepStrip.vue'
// r41 v243 (Tom Gilb 2026-06-21 — Stage 2 sub-phase architecture).
import Stage2SubStepStrip from './components/Stage2SubStepStrip.vue'
// r41 v251 (Tom Gilb 2026-06-21 — Stage 4 sub-phase architecture · Reasonable Balance).
import Stage4SubStepStrip from './components/Stage4SubStepStrip.vue'
// r41 v252 (Tom Gilb 2026-06-21 — Stage 4 Phase 2 ship: Estimates Approval + Tools/Agents).
import EstimatesApprovalPanel, { type EstimatesApproval } from './components/EstimatesApprovalPanel.vue'
// r41 v477 (Tom Gilb 2026-07-04 "continue backlog" — audit-backlog #3
// Stage 4 Impacts Phase 2).  IET Settings Panel — local Stage-4 settings
// drawer (Conservatism · Credibility Threshold · Auto-Assumption Strength).
// Composes with rule_stage_4_impacts_design.md SUPREME.
import IetSettingsPanel from './components/IetSettingsPanel.vue'
// r41 v478 (Tom Gilb 2026-07-04 "continue backlog" — audit-backlog #4
// Stage 5 Refine Phase 2).  Solution Set + Changes-List deliverable panel
// (5.5.1 + 5.5.2).  Composes with rule_stage_5_refine_design.md SUPREME.
import SolutionSetDeliverablePanel from './components/SolutionSetDeliverablePanel.vue'
import Stage4ToolsAndAgentsTable, { type Stage4ToolKey } from './components/Stage4ToolsAndAgentsTable.vue'
// r41 v253 (Tom Gilb 2026-06-21 — Stage 5 Refine sub-phase architecture).
import Stage5SubStepStrip from './components/Stage5SubStepStrip.vue'
// r41 v302 (Tom Gilb 2026-06-23 — Stage 6 sub-step surfaces 6.2 / 6.3 / 6.4).
import Stage6PrioritisePanel from './components/Stage6PrioritisePanel.vue'
import Stage6SharpenStepsPanel from './components/Stage6SharpenStepsPanel.vue'
import Stage6ToolsAndAgentsPanel, { type Stage6ToolKey } from './components/Stage6ToolsAndAgentsPanel.vue'
// r41 v254 (Tom Gilb 2026-06-21 mandate "plough through and do as much as possible") —
// Stages 3 / 6 / 8 / 9 sub-step strips via the new generic strip component.
import GenericStageSubStepStrip from './components/GenericStageSubStepStrip.vue'
import { STAGE3_SUBSTEPS, type Stage3SubStepKey } from './data/stage3SubSteps'
import { STAGE6_SUBSTEPS, type Stage6SubStepKey } from './data/stage6SubSteps'
import { STAGE8_SUBSTEPS, type Stage8SubStepKey } from './data/stage8SubSteps'
import { STAGE9_SUBSTEPS, type Stage9SubStepKey } from './data/stage9SubSteps'
// r41 v246 (Tom Gilb 2026-06-21 — global Spec Title anchor when main crest is off-screen).
import SpecTitleAnchor from './components/SpecTitleAnchor.vue'
// Sub-step registry + key type lives in a plain .ts module because Vue 3
// `<script setup>` does NOT allow top-level `export` declarations
// (crashes Vite with "Importing a module script failed").  Same pattern
// as `planningStages.ts` (2026-06-03).
import type { Stage1SubStepKey } from './data/stage1SubSteps'
import type { Stage2SubStepKey } from './data/stage2SubSteps'
import type { Stage4SubStepKey } from './data/stage4SubSteps'
import type { Stage5SubStepKey } from './data/stage5SubSteps'
// 1.3 Parse Implied Sharpening — review + accept/reject inferred entries.
import ParseImpliedSharpeningPanel from './components/ParseImpliedSharpeningPanel.vue'
// r41 v206 — universal typing journal: every keystroke into any input or
// textarea is captured to localStorage so accidental text loss can be
// recovered from Safari DevTools.  Wired into onMounted below.
import { installTypingJournal } from './composables/useTypingJournal'
// r41 v208 — initial-input capture: stage from GetAPlanPanel, commit to
// the spec-model id here in the import handler so the planner can always
// recover / compare with what they originally pasted/fetched/uploaded.
import { commitPendingInitialInput, getInitialInput, type InitialInputSnapshot } from './composables/useInitialInput'
import InitialInputPanel from './components/InitialInputPanel.vue'
// r41 v204 (Tom Gilb 2026-06-19 verbatim "am I being premature? I keep on
// seeing v0.1 and nothing in the spec library at all for Indianapolis").
// EmptySpecCallout sits at the top of every Stage 2-11 view when the spec
// is null or has zero real entries — the planner gets a CLEAR diagnostic
// + one-click jump back to 1.2 Spec Parsing instead of staring at an
// inexplicably-empty downstream stage.
import EmptySpecCallout from './components/EmptySpecCallout.vue'
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
import GilbIllustrationPicker from './components/GilbIllustrationPicker.vue' // 2026-06-12 r93qqq — TwinPod illustration catalog picker
// r41 v42 — BookKaleidoscope import REMOVED from App.vue (Tom Gilb 2026-06-16:
// "I did never intend the kaliadeobooks would be on normal pages, for now only
// when cmnd i").  The component is still used inside GilbIllustrationPicker's
// 📚 Books tab — that's its only mounting point now.
import IlluminationGlyph from './components/icons/IlluminationGlyph.vue'    // 2026-06-13 r93qqq — canonical ⌘I pin glyph
import PlanguageOntologyDiagram from './components/PlanguageOntologyDiagram.vue' // 2026-06-13 r93qqq r23 — 663-concept clickable ontology tree
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
import AutoDboPanel from './components/AutoDboPanel.vue'       // Auto-DBO — Design By Objectives (Tom 2026-06-07)
import PlanguageToolsButton from './components/PlanguageToolsButton.vue'  // Planguage Tools pin (Tom 2026-06-07)
import PlanguageToolsPanel  from './components/PlanguageToolsPanel.vue'   // Planguage Tools catalogue
import PentaPanel from './components/PentaPanel.vue'           // Penta Model — Gilb-Shalloway 2022 SVERD pinwheel
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
import ResourcesAgent from './components/ResourcesAgent.vue'   // v509 — ESTIMATION 8
import ResourcesKissPanel from './components/ResourcesKissPanel.vue'
import ResourceCostEngineeringPanel from './components/ResourceCostEngineeringPanel.vue'
import SolutionSharpenPanel from './components/SolutionSharpenPanel.vue'
import StrategyAgentPanel from './components/StrategyAgentPanel.vue'
import IncorruptiblePanel from './components/IncorruptiblePanel.vue'  // Eric Ries 2026 — strategic resilience agent
import ValueAspectsPanel from './components/ValueAspectsPanel.vue'    // Tom Gilb 2026-06-11 22:45 CET — Value Aspects Articulation Tool
import type { PentaItem } from './types/penta'
import IncorruptibleSharpeningPanel from './components/IncorruptibleSharpeningPanel.vue'  // r93aa Q&A flow
import { applyIncorruptibleFix, generateIncorruptibleReport } from './composables/useIncorruptibleFindings'
import type { IncorruptibleFinding } from './types/incorruptible'
// Elon Agent (Tom Gilb 2026-06-12 — Musk's Methods book + Dove et al. Pace-of-Innovation paper):
//   plan check + sharpening. Mirrors the Incorruptible pattern exactly. Pace-of-Innovation is
//   the DOMINANT Requirement per Dove et al. (cited by Tom Gilb).
import ElonPanel from './components/ElonPanel.vue'
// r41 v225 (Tom Gilb 2026-06-20) — Munger Agent (Charlie Munger's 12 prompts of
// analytical rigor — Inversion, Second-Order, Circle of Competence, Bias Audit,
// Lollapalooza, Opportunity Cost, Fat Pitch, Incentive Map, Simplicity Filter,
// Destroy-Your-Own-Idea, Long Game, Deathbed). Mirrors Elon/Incorruptible plumbing.
import MungerPanel from './components/MungerPanel.vue'
// r41 v254 (Tom Gilb 2026-06-22) — Heilmeier Agent (DARPA's 9-question Catechism +
// IEEE 2025 "Who is left out?" extension; mapped to Planguage per Tom's comparison PDF)
import HeilmeierPanel from './components/HeilmeierPanel.vue'
// r41 v385 (Tom Gilb 2026-06-26) — Feynman Agent (Cargo Cult Science 1974 + Challenger
// Appendix F 1986 + "What I cannot create, I do not understand" 1988 + Tom-dropped
// 10 Feynman prompts PDF @aigleeson 2026-06-26).  Six lenses: cargo-cult ·
// estimate-gap · cannot-create · jargon-curtain · unexamined-assumption ·
// notebook-confession.  Mirrors Munger / Heilmeier panel pattern.
import FeynmanPanel from './components/FeynmanPanel.vue'
import type { FeynmanFinding } from './types/feynman'
import { applyFeynmanFix as _applyFeynmanFixImpl } from './composables/useFeynmanFindings'
// r41 v305 (Tom Gilb 2026-06-23) — Role Agent (MAJOR REDESIGN: 13 deterministic
// detectors covering Stakeholder + Role compliance per Tom's 14-point directive).
// Role IS Stakeholder (Tom #8/9) — fixes mutate StakeholderEntry records.
import RoleAgentPanel from './components/RoleAgentPanel.vue'
// r41 v312 (Tom Gilb 2026-06-23) — Phase 2 of Roles redesign: Role Health
// Dashboard (per-Stakeholder Health Score + RACI Matrix + PHI roll-up).
import RoleHealthDashboard from './components/RoleHealthDashboard.vue'
import RoleFlowDiagram from './components/RoleFlowDiagram.vue'
import RoleRoutingRulesPanel from './components/RoleRoutingRulesPanel.vue'
import { applyRoutingRules as _applyRoleRoutingRulesImpl } from './composables/useRoleRoutingRules'
// r41 v231 (Tom Gilb 2026-06-20 verbatim "I think we need only one agent,
// not 2 as you have constructed, in th mene, but we can choose various
// agent modes") — single-pin-per-agent + mode dispatcher.
import AgentModePicker from './components/AgentModePicker.vue'
import { normalizeSpecBlock as _normalizeSpecBlock } from './utils/normalizeSpec'
type AgentModeKey = 'principles' | 'analysis' | 'improvement' | 'sharpening' | 'create-optional'
import { applyMungerFix as _applyMungerFixImpl } from './composables/useMungerFindings'
import type { MungerFinding } from './types/munger'
import { applyHeilmeierFix as _applyHeilmeierFixImpl } from './composables/useHeilmeierFindings'
import type { HeilmeierFinding } from './types/heilmeier'
import { applyRoleFix as _applyRoleFixImpl } from './composables/useRoleFindings'
import type { RoleFinding } from './types/role'
import ElonSharpeningPanel from './components/ElonSharpeningPanel.vue'
import { applyElonFix, generateElonReport } from './composables/useElonFindings'
import type { ElonFinding } from './types/elon'
// Universal Undo System (Tom Gilb SUPREME rule 2026-06-11 r93v).
import { useUndoHistory, registerUndoSpecRestorer } from './composables/useUndoHistory'
// r41 v352 — Stage 2.2 auto-generate-Solutions wiring.
import { useGenerateSolutions } from './composables/useGenerateSolutions'
import PlanguageProgressWindow from './components/PlanguageProgressWindow.vue'
// r41 v373 — Stage 3.3 Add Qualifiers flow.
import AddQualifiersFlow from './components/AddQualifiersFlow.vue'
import type { ConditionSet } from './types/spec'
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
  updateSpecModelGenesis,

  type SpecModel,
  type PlanModel,
} from './composables/useSpecModel'
import { clearComparison } from './composables/useModelComparison'
// r41 2026-06-20 — plan-scoped contract memory (Tom Gilb option B).
import { useContractStore } from './composables/useContractStore'
// 2026-07-14 bug fix — Contract → Spec bridge (see watcher below for context).
import { contractEntriesToSpec } from './composables/useSpecFromContract'
import SelectionDefiner from './components/SelectionDefiner.vue'
// 2026-05-14 — Fresh Start menu replaces the bare 🆘 Reset pill with a
// graduated 4-option popover (Blank Canvas / Save This and Stop / Cancel
// Recent Changes / Just close stuck UI). See vault Start-Over-Design.md.
import FreshStartMenu from './components/FreshStartMenu.vue'
import InputSafetyNetToast from './components/InputSafetyNetToast.vue'
import { formatBackupTimestamp } from './composables/useFreshStart'
import { defineCurrentSelection, openDefineSearch, defineTerm, closeDefine, useDefine as _useDefineForPickerSuppress } from './composables/useDefine'
// r41 v365 — SpecWizard import REMOVED (component dead code in app shell).
import SpecPresentation from './components/SpecPresentation.vue'
import BullockPanel from './components/BullockPanel.vue'
// AmuseMeButton is used inside SpecOutput.vue directly — not imported at App level
import OnboardingTour from './components/OnboardingTour.vue'
import type { SpecBlock, FieldSource, VEntry, FEntry, CEntry, REntry, SEntry } from './types/spec'
// ModelLibraryEntry needed for the Incorruptible Model-mode converter (r93q).
import type { ModelLibraryEntry } from './composables/useModelLibrary'
import { useModelLibrary } from './composables/useModelLibrary'
import { rBudget, rBudgetLabel } from './types/spec'
import { stampEntry } from './utils/sourceStamp'
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

const { loading: sdkLoading, error: sdkError, translate, translateStream } = useSDK()

// r41 v352 (Tom Gilb 2026-06-25 "the developed Planguage numbers are still zero"):
// reactive accumulator for streamed JSON from translateStream — drives
// PlanguageProgressWindow's live counts during generation. Without streaming,
// the spec lands in one shot at the very end and tiles stay at 0 the whole way.
const streamingText = ref<string>('')
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
const { toast: globalToast, showToast, dismissToast } = useToast()
const { termFor: strategyTermFor, isStrategyMode, setStrategyMode } = useStrategyMode()
const { bannerVisible: exportBannerVisible, bannerLabel: exportBannerLabel, hideExportEmailBanner } = useExportBanner()
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
// changesListOpen: whether the post-sharpening "changes to Planguage model"
// panel is expanded in the sharpeningDone block.
const changesListOpen = ref(true)
// sharpenModalOpen: true when the nav "Sharpen ▾" dropdown opens the modal.
const sharpenModalOpen = ref(false)

// r41 v373 — Stage 3.3 Add Qualifiers Flow visibility + apply handler.
const addQualifiersFlowOpen = ref(false)

function onAddQualifiersApply(defaultsMap: Map<string, ConditionSet>): void {
  if (!currentSpec.value || defaultsMap.size === 0) {
    addQualifiersFlowOpen.value = false
    return
  }
  // Deep-clone for Universal Undo (prev/next must be independent objects).
  const prevSpec: SpecBlock = JSON.parse(JSON.stringify(currentSpec.value)) as SpecBlock
  const nextSpec: SpecBlock = JSON.parse(JSON.stringify(currentSpec.value)) as SpecBlock
  let applied = 0
  // Apply to Values
  if (nextSpec.values) {
    for (const v of nextSpec.values) {
      const set = defaultsMap.get(v.id)
      if (set) {
        v.conditionSets = [set]   // single-set this round; multi-set is Round 3
        applied++
      }
    }
  }
  // Apply to Resources
  if (nextSpec.resources) {
    for (const r of nextSpec.resources) {
      const set = defaultsMap.get(r.id)
      if (set) {
        r.conditionSets = [set]
        applied++
      }
    }
  }
  if (applied === 0) {
    showToast('No matching V/R entries to update.', 4000)
    addQualifiersFlowOpen.value = false
    return
  }
  undoHistory.record({
    label:    `Stage 3.3 Add Qualifiers · ${applied} entr${applied === 1 ? 'y' : 'ies'}`,
    source:   'Stage33AddQualifiers',
    prevSpec,
    nextSpec,
    affectedFields: ['values[].conditionSets', 'resources[].conditionSets'],
  })
  currentSpec.value = nextSpec
  if (specModel.value) saveSpecSnapshot(nextSpec)
  showToast(`Stage 3.3 — Qualifiers applied to ${applied} entr${applied === 1 ? 'y' : 'ies'}.`, 5000)
  addQualifiersFlowOpen.value = false
}
// resourcesSharpenOpen: true when Stage 10 · Resources Sharpening panel is open.
const resourcesSharpenOpen = ref(false)
// v509 — ESTIMATION 8: Resources Agent full-screen hub.
const resourcesAgentOpen = ref(false)
const _resourcesAgentPlanIdRef = computed(() => (currentSpec.value as { name?: string } | null)?.name ?? 'default')

// v514 — Resources envelope orchestrator: single instance keyed by the same
// planId all 4 resource composables use.  captureEnvelope() gathers the full
// state on every SpecVersion save; hydrateEnvelope() restores on SpecVersion
// load.  Also drives spec-export appendix + spec-import extraction.
const _resourcesEnvelope = useResourcesEnvelope(_resourcesAgentPlanIdRef)

// v511b (2026-07-21) — Tom Gilb: "The 3 top edit do not work at all".  The
// Plan Scope Framework strip's Edit buttons now navigate to Stage 10 +
// open ResourcesSharpenPanel — the canonical home of the framework editor.
// Section param carried through for future scroll-to-section wiring (v512+).
function onOpenScopeEditorFromStage1(section: 'deadline' | 'startEvents' | 'budget'): void {
  planningStage.value = 10
  resourcesSharpenOpen.value = true
  const label = section === 'deadline' ? 'Deadline' : section === 'startEvents' ? 'Project Start Events' : 'Budget'
  showToast(`📐 Opening Plan Scope Framework — ${label} section`, 'info')
}
// optimaOpen: true when Stage 10 · OPTIMA Resource Optimization panel is open.
const optimaOpen  = ref(false)
const autoDboOpen          = ref(false)     // Auto-DBO — Design By Objectives (Tom 2026-06-07)
const planguageToolsOpen   = ref(false)     // Planguage Tools catalogue (Tom 2026-06-07)
const pentaOpen            = ref(false)     // Penta Model — Gilb-Shalloway 2022 SVERD pinwheel
// kissOpen: true when Stage 10 · KISS panel is open.
// KISS = Keep Improvement Super Surprising — 5 most cost-effective spec improvements.
const kissOpen = ref(false)
// costEngineeringOpen: true when Stage 10 · Cost Engineering tool is open.
// Tom 2026-06-05: "COST ENGINEERING: THE TOOL, SEPARATE TOOL for Dynamic (Evo Step)
// Design to [Cost, Value, Constraint] and for initial statics upfront."
const costEngineeringOpen = ref(false)
// r41 v295 (Tom Gilb 2026-06-22 "always continue · research and innovation")
// — stage9ActualsOpen: true when the Stage 9 Study-Act Capture Actuals
// focused modal is open. Mounted via the triage banner state-2 action pin.
const stage9ActualsOpen = ref(false)


// Tom 2026-06-04 r88 — Phase 2 of Resources beef-up: write-back from
// Claudian analysis.  The panel emits `apply-analysis` with an updated
// SpecBlock after the user ticks per-finding approval.  We replace
// currentSpec.value, persist the snapshot to the active specModel, and
// log a one-line provenance breadcrumb.
function _onResourcesAnalysisApplied(updatedSpec: SpecBlock): void {
  // r93x — Universal Undo P2 sweep: record before mutation
  if (currentSpec.value) {
    undoHistory.record({
      label:    'Resources Analysis Applied',
      source:   'ResourcesAnalysis',
      prevSpec: JSON.parse(JSON.stringify(currentSpec.value)) as SpecBlock,
      nextSpec: JSON.parse(JSON.stringify(updatedSpec))       as SpecBlock,
    })
  }
  currentSpec.value = updatedSpec
  if (specModel.value) saveSpecSnapshot(updatedSpec)
  console.log('[ResourcesAnalysis] applied — spec now has',
    updatedSpec.resources?.length ?? 0, 'R.,',
    updatedSpec.solutions?.length ?? 0, 'S.,',
    updatedSpec.constraints?.length ?? 0, 'C.')
}
// ── Incorruptible Agent: Model-mode launch + ModelLibraryEntry → SpecBlock converter ────
//
// Tom Gilb 2026-06-11: "for sure also a tool in the Model mode, so duplicate it there".
// ModelLibraryEntry is a slim shape (ModelEntry[] with type + description + details), not a
// full SpecBlock. To run the Incorruptible deterministic engine on it, we convert each
// ModelEntry to the corresponding V/F/C/R/S entry with best-effort field mapping. The
// details field is parsed for Goal / Tolerable / Wish / Scale fragments where present.
function _modelEntryToSpec(entry: ModelLibraryEntry): SpecBlock {
  const values: VEntry[]         = []
  const functions: FEntry[]      = []
  const constraints: CEntry[]    = []
  const resources: REntry[]      = []
  const solutions: SEntry[]      = []

  for (const me of entry.entries ?? []) {
    const id = me.description.split(/[.,;:]/)[0].slice(0, 40).trim() || `${me.type}-entry`

    const parseDetail = (label: string): string => {
      // Tolerant match — "Goal: 99.9" or "Goal 99.9" or "Goal=99.9"
      const re = new RegExp(`${label}\\s*[:=]?\\s*([^·|;]+)`, 'i')
      const m  = (me.details ?? '').match(re)
      return m ? m[1].trim().split(/\s*·\s*/)[0].trim() : ''
    }

    switch (me.type) {
      case 'V':
        values.push({
          id, type: 'Value', level: 'Business',
          description:    me.description,
          scale:          parseDetail('Scale')     || '',
          meter:          parseDetail('Meter')     || '',
          status:         parseDetail('Status')    || '',
          tolerable:      parseDetail('Tolerable') || '',
          goal:           parseDetail('Goal')      || '',
          wish:           parseDetail('Wish')      || '',
          valueOfFunction: '',
        } as VEntry)
        break
      case 'F':
        functions.push({
          id, type: 'Function', level: 'Business',
          description:   me.description,
          presenceTest:  me.details ?? '',
        } as FEntry)
        break
      case 'C':
        constraints.push({
          id, type: 'Constraint', level: 'Business',
          description:  me.description,
          scope:        'plan-level',
          rationale:    me.details ?? '',
        } as CEntry)
        break
      case 'R':
        resources.push({
          id, type: 'Resource', level: 'Business',
          description:  me.description,
          budget:       parseDetail('Budget') || parseDetail('Goal') || '',
          scale:        parseDetail('Scale')  || '',
          meter:        parseDetail('Meter')  || '',
        } as REntry)
        break
      case 'S':
        solutions.push({
          id, type: 'Solution', level: 'Business',
          description:  me.description,
        } as SEntry)
        break
    }
  }

  // r41 v220 (2026-06-20 producer-stamp sweep) — every entry built from the
  // ModelLibraryEntry source is stamped with its origin so the Incorruptible
  // engine + colorful HTML export show the Source chip lit up.
  // r41 v415 (Source Attribution SUPREME sweep) — Class B (from library).
  const stampOpts = {
    generator:  'Model Library → Spec',
    planName:   entry.name || entry.id,
    sourceType: 'system' as const,
    tool:       '_modelEntryToSpec',
    stage:      'model-library',
  }
  return {
    functions:   functions.map(e => stampEntry(e, stampOpts)),
    values:      values.map(e => stampEntry(e, stampOpts)),
    solutions:   solutions.map(e => stampEntry(e, stampOpts)),
    constraints: constraints.map(e => stampEntry(e, stampOpts)),
    resources:   resources.map(e => stampEntry(e, stampOpts)),
    stakes: (entry.stakeholders ?? []).join(', '),
    stakeholderEntries: (entry.stakeholders ?? []).map(name => stampEntry({
      id: name,
      type: 'Stakeholder',
      definition: '',
      description: '',
    }, stampOpts)),
  } as SpecBlock
}

/** Local library instance — shares module-level state with ModelLibraryPanel via the
 *  composable pattern (refs wrap module-level _userEntries / _activeModelId etc.). */
const _incorruptibleLibrary = useModelLibrary()

/** Launch Incorruptible in MODEL MODE against the currently active Library entry. */
function _launchIncorruptibleOnActiveModel(): void {
  const entry = _incorruptibleLibrary.activeModel.value
  if (!entry) {
    showToast('⚖️ Incorruptible — no active model. Select one in Model Library first.', 5000)
    return
  }
  incorruptibleTargetSpec.value  = _modelEntryToSpec(entry)
  incorruptibleTargetTitle.value = `Model: ${entry.title}`
  incorruptibleIsModel.value     = true
  incorruptibleOpen.value        = true
}

// ── Incorruptible Agent: Accept Fix (Sharpen capability) ───────────────────
// Tom Gilb 2026-06-11: "we should be able to use it health check and sharpen
//   (it needs both capabilities) on any plan or organizational model"
//
// Accept Fix takes a finding + applies its suggestedFix to the bound target spec.
// Two routing modes:
//   (a) Library-model mode (incorruptibleIsModel = true) — mutations are not persisted
//       to the user's plan; we just show a toast explaining why and pointing to the
//       Phase 2 "Save as Custom Model" workflow.
//   (b) Current-plan mode (incorruptibleIsModel = false) — fix is applied to currentSpec
//       via the standard pattern (set + snapshot). Toast names the affected entry.
function onIncorruptibleAcceptFix(finding: IncorruptibleFinding): void {
  const target = incorruptibleTargetSpec.value ?? currentSpec.value
  if (!target) {
    showToast('⚖️ Incorruptible — no plan bound. Open a plan first.', 4000)
    return
  }

  const result = applyIncorruptibleFix(finding, target)
  if (!result) {
    // Phase 1 cannot apply this fix type (e.g. add-evo-step). Inform user.
    showToast(
      `⚖️ Incorruptible — fix type "${finding.suggestedFix.type}" pending Phase 2. ` +
      `Use the suggested Planguage manually for now.`,
      6000,
    )
    return
  }

  // r93u: snapshot the PRE-FIX target spec so Undo can restore it. Deep-clone via JSON
  // round-trip — same approach applyIncorruptibleFix itself uses internally.
  const preFixSnapshot: SpecBlock = JSON.parse(JSON.stringify(target))
  _incorruptibleUndoSnapshots.value.set(finding.id, preFixSnapshot)
  // Mark this finding as accepted (drives the "Fix Is Accepted" button state)
  const nextAccepted = new Set(incorruptibleAcceptedIds.value)
  nextAccepted.add(finding.id)
  incorruptibleAcceptedIds.value = nextAccepted

  // Library-model mode: preview only — show toast but DO NOT write back to currentSpec.
  // The preview state lives in incorruptibleTargetSpec so the panel re-renders findings
  // against the post-fix model.
  if (incorruptibleIsModel.value) {
    incorruptibleTargetSpec.value = result.newSpec
    showToast(
      `⚖️ Incorruptible — model preview applied. ` +
      `${result.summary} (not saved to library — Phase 2 will add "Save as Custom Model")`,
      8000,
    )
    return
  }

  // Current-plan mode: persist via the standard write-back path + record on undo stack.
  // r93v: every Incorruptible fix is now on the universal undo stack — ⌘Z works at the
  // global level. The per-finding Undo Fix button (r93u) still works for selective undo
  // of a specific finding without affecting more-recent unrelated actions.
  undoHistory.record({
    label:          `Incorruptible Fix · ${finding.principleViolated}`,
    source:         'Incorruptible',
    prevSpec:       preFixSnapshot,
    nextSpec:       JSON.parse(JSON.stringify(result.newSpec)) as SpecBlock,
    affectedFields: [`${result.affectedItemType}.${result.affectedItemId}`],
    principle:      finding.principleViolated,
  })
  currentSpec.value = result.newSpec
  if (specModel.value) saveSpecSnapshot(result.newSpec)
  // r93x — Universal Undo P2: toast now carries [Undo] action that triggers global undo
  showToast(`⚖️ Incorruptible — ${result.summary}`, 7000, { label: '[Undo]', handler: handleGlobalUndo })
  console.log('[Incorruptible] fix applied:', finding.suggestedFix.type, '→', result.affectedItemType, result.affectedItemId)
}

/** r93aa — Synthesise & Apply: when the Sharpening panel emits findings, route each through
 *  onIncorruptibleAcceptFix to get the full pipeline (source-stamping + undo + cascade).
 *  r93ff — capture before/after Incorruptibility Score so the toast can name the delta. */
function onIncorruptibleSynthesiseFindings(findings: IncorruptibleFinding[]): void {
  if (findings.length === 0) return
  // Compute BEFORE score (against currentSpec OR target-spec for model mode)
  const beforeSpec = incorruptibleIsModel.value
    ? incorruptibleTargetSpec.value
    : currentSpec.value
  const beforeScore = beforeSpec
    ? generateIncorruptibleReport(beforeSpec, specModel.value?.name ?? '').incorruptibilityScore
    : null
  for (const f of findings) {
    onIncorruptibleAcceptFix(f)
  }
  // Compute AFTER score on the post-fix spec
  const afterSpec = incorruptibleIsModel.value
    ? incorruptibleTargetSpec.value
    : currentSpec.value
  const afterScore = afterSpec
    ? generateIncorruptibleReport(afterSpec, specModel.value?.name ?? '').incorruptibilityScore
    : null
  const delta = (beforeScore !== null && afterScore !== null) ? afterScore - beforeScore : null
  const deltaStr = delta !== null
    ? ` · Score ${beforeScore} → ${afterScore} (${delta >= 0 ? '+' : ''}${delta})`
    : ''
  showToast(
    `🔪 Incorruptible Sharpening — synthesised ${findings.length} fix${findings.length === 1 ? '' : 'es'} from your answers${deltaStr}.`,
    8000,
    { label: '[Undo]', handler: handleGlobalUndo },
  )
  // Close the Sharpening panel so the user sees the resulting findings in the health-check panel
  incorruptibleSharpeningOpen.value = false
  incorruptibleOpen.value           = true
}

/** Launch helpers for Incorruptible Sharpening — r93aa three access paths. */
function _launchIncorruptibleSharpeningOnCurrentPlan(): void {
  incorruptibleTargetSpec.value  = null   // null = use currentSpec via ?? in panel
  incorruptibleTargetTitle.value = ''
  incorruptibleIsModel.value     = false
  incorruptibleSharpeningOpen.value = true
}
function _launchIncorruptibleSharpeningOnActiveModel(): void {
  const entry = _incorruptibleLibrary.activeModel.value
  if (!entry) {
    showToast('🔪 Incorruptible Sharpening — no active model. Select one in Model Library first.', 5000)
    return
  }
  incorruptibleTargetSpec.value  = _modelEntryToSpec(entry)
  incorruptibleTargetTitle.value = `Model: ${entry.title}`
  incorruptibleIsModel.value     = true
  incorruptibleSharpeningOpen.value = true
}

/** r93u — Undo Fix: restore the pre-fix snapshot taken at accept-time. */
function onIncorruptibleUndoFix(finding: IncorruptibleFinding): void {
  const snapshot = _incorruptibleUndoSnapshots.value.get(finding.id)
  if (!snapshot) {
    showToast('⚖️ Incorruptible — no undo snapshot found (was the fix applied this session?)', 5000)
    return
  }

  if (incorruptibleIsModel.value) {
    // Model mode: restore the target preview spec; currentSpec untouched
    incorruptibleTargetSpec.value = snapshot
    showToast(`⚖️ Incorruptible — model fix undone (preview restored).`, 5000)
  } else {
    // Current-plan mode: restore currentSpec + snapshot
    currentSpec.value = snapshot
    if (specModel.value) saveSpecSnapshot(snapshot)
    showToast(`⚖️ Incorruptible — fix undone for ${finding.triggeredBy}. Plan restored.`, 6000)
  }

  // Remove from accepted set + clear snapshot
  const nextAccepted = new Set(incorruptibleAcceptedIds.value)
  nextAccepted.delete(finding.id)
  incorruptibleAcceptedIds.value = nextAccepted
  const nextSnapshots = new Map(_incorruptibleUndoSnapshots.value)
  nextSnapshots.delete(finding.id)
  _incorruptibleUndoSnapshots.value = nextSnapshots

  console.log('[Incorruptible] fix undone:', finding.id)
}

// ── Elon Agent: Model-mode launch + Accept Fix + Undo Fix + Synthesise ────
//
// Tom Gilb 2026-06-12: "OK Major new Agent: 'Elon': will be based on my Musks Methods
//   book... The pattern is Incorruptible (based on Ries). Just make it."
//
// Plumbing mirrors Incorruptible exactly. Pace-of-Innovation is the DOMINANT Requirement;
// the panel + synthesis honour it (cyan accent, 2× score weight, sorts first).

function _launchElonOnActiveModel(): void {
  const entry = _incorruptibleLibrary.activeModel.value
  if (!entry) {
    showToast('⚡ Elon — no active model. Select one in Model Library first.', 5000)
    return
  }
  elonTargetSpec.value  = _modelEntryToSpec(entry)
  elonTargetTitle.value = `Model: ${entry.title}`
  elonIsModel.value     = true
  elonOpen.value        = true
}

function _launchElonSharpeningOnCurrentPlan(): void {
  elonTargetSpec.value  = null   // null = use currentSpec via ?? in panel
  elonTargetTitle.value = ''
  elonIsModel.value     = false
  elonSharpeningOpen.value = true
}

function _launchElonSharpeningOnActiveModel(): void {
  const entry = _incorruptibleLibrary.activeModel.value
  if (!entry) {
    showToast('⚡ Elon Sharpening — no active model. Select one in Model Library first.', 5000)
    return
  }
  elonTargetSpec.value  = _modelEntryToSpec(entry)
  elonTargetTitle.value = `Model: ${entry.title}`
  elonIsModel.value     = true
  elonSharpeningOpen.value = true
}

function onElonAcceptFix(finding: ElonFinding): void {
  const target = elonTargetSpec.value ?? currentSpec.value
  if (!target) {
    showToast('⚡ Elon — no plan bound. Open a plan first.', 4000)
    return
  }

  const result = applyElonFix(finding, target)
  if (!result) {
    showToast(
      `⚡ Elon — fix type "${finding.suggestedFix.type}" pending Phase 2. ` +
      `Use the suggested Planguage manually for now.`,
      6000,
    )
    return
  }

  // Snapshot pre-fix spec for per-finding Undo Fix
  const preFixSnapshot: SpecBlock = JSON.parse(JSON.stringify(target))
  _elonUndoSnapshots.value.set(finding.id, preFixSnapshot)
  const nextAccepted = new Set(elonAcceptedIds.value)
  nextAccepted.add(finding.id)
  elonAcceptedIds.value = nextAccepted

  // Library-model mode: preview only
  if (elonIsModel.value) {
    elonTargetSpec.value = result.newSpec
    showToast(
      `⚡ Elon — model preview applied. ` +
      `${result.summary} (not saved to library — Phase 2 will add "Save as Custom Model")`,
      8000,
    )
    return
  }

  // Current-plan mode: persist via standard path + universal undo stack
  undoHistory.record({
    label:          `Elon Fix · ${finding.principleViolated}`,
    source:         'Elon',
    prevSpec:       preFixSnapshot,
    nextSpec:       JSON.parse(JSON.stringify(result.newSpec)) as SpecBlock,
    affectedFields: [`${result.affectedItemType}.${result.affectedItemId}`],
    principle:      finding.principleViolated,
  })
  currentSpec.value = result.newSpec
  if (specModel.value) saveSpecSnapshot(result.newSpec)
  showToast(`⚡ Elon — ${result.summary}`, 7000, { label: '[Undo]', handler: handleGlobalUndo })
  console.log('[Elon] fix applied:', finding.suggestedFix.type, '→', result.affectedItemType, result.affectedItemId)
}

// r41 v225 (Tom Gilb 2026-06-20) — Munger Accept-Fix handler.
// Mirrors onElonAcceptFix but trimmed (no library-model branch, no per-finding
// snapshot Map — relies on Universal Undo only).
function onMungerAcceptFix(finding: MungerFinding): void {
  const target = currentSpec.value
  if (!target) {
    showToast('🧠 Munger — no plan bound. Open a plan first.', 4000)
    return
  }
  const result = _applyMungerFixImpl(finding, target)
  if (!result) {
    showToast(
      `🧠 Munger — fix type "${finding.suggestedFix.type}" pending Phase 2. ` +
      `Use the suggested Planguage manually for now.`,
      6000,
    )
    return
  }
  const preFixSnapshot: SpecBlock = JSON.parse(JSON.stringify(target))
  undoHistory.record({
    label:          `Munger Fix · ${finding.principleViolated}`,
    source:         'Munger',
    prevSpec:       preFixSnapshot,
    nextSpec:       JSON.parse(JSON.stringify(result.newSpec)) as SpecBlock,
    affectedFields: [`${result.affectedItemType}.${result.affectedItemId}`],
    principle:      finding.principleViolated,
  })
  currentSpec.value = result.newSpec
  if (specModel.value) saveSpecSnapshot(result.newSpec)
  showToast(`🧠 Munger — ${result.summary}`, 7000, { label: '[Undo]', handler: handleGlobalUndo })
  console.log('[Munger] fix applied:', finding.suggestedFix.type, '→', result.affectedItemType, result.affectedItemId)
}

/**
 * r41 v404 (Tom Gilb 2026-06-28 verbatim "A clear messge: YOU HAVE ACCEPTS
 * 11 FIXES. CLICK HERE TO CONFIRM AND TO SEE THE CONSEQUENCES IN YOUR PLAN
 * NOW"): handler for the prominent "see consequences" CTA in MungerPanel.
 * Closes the Munger panel + opens the Spec Editor on the Solutions tab so
 * the planner sees the updated spec immediately (Munger fixes apply on
 * each Accept Fix click; the Spec Editor surfaces the per-field results).
 * Confirmation toast names the count so the planner has a durable record
 * of "11 fixes applied — viewing updated spec".
 */
/**
 * r41 v404 → v408 (Tom Gilb 2026-06-28: "I would like the per agent
 * breakdown.  And in all cases I want consolation that the exact source of
 * the change is attached to the spec"): unified confirm-and-view handler
 * for every agent panel.  Closes the agent modal + opens the Spec Editor
 * + bumps spec version with per-agent count tracking (agentRoundCounts +
 * agentFixCounts) + shows toast with Source-attribution confirmation.
 * Replaces the v407 per-agent handler bodies with a single dispatcher;
 * each `handle*ConfirmAndView` is now a one-line call.
 */
interface AgentConfirmContext {
  /** v-if open ref to close. */
  closeFlag: { value: boolean }
  /** Agent emoji + name for the toast headline + Source attribution string. */
  displayName: string
  /** Stable key for agentRoundCounts / agentFixCounts.  Stage 3 banner reads these. */
  agentKey: 'munger' | 'heilmeier' | 'feynman' | 'elon' | 'incorruptible' | 'role'
}
function _agentConfirmAndView(ctx: AgentConfirmContext, acceptedCount: number): void {
  ctx.closeFlag.value = false
  _openSpecEditor({ tab: 'solutions' })
  if (currentSpec.value && acceptedCount > 0) {
    try {
      bumpSpecVersion(currentSpec.value, { agentKey: ctx.agentKey, acceptedFixCount: acceptedCount })
    } catch (err) { console.warn(`[${ctx.agentKey}ConfirmAndView] bumpSpecVersion failed:`, err) }
  }
  const noun = acceptedCount === 1 ? 'fix' : 'fixes'
  showToast(
    `${ctx.displayName} — ${acceptedCount} ${noun} applied · viewing updated spec\n✓ Source: ${ctx.displayName} attached to each mutated field`,
    7000,
    { label: '[Undo]', handler: handleGlobalUndo },
  )
}
function handleMungerConfirmAndView(acceptedCount: number): void {
  _agentConfirmAndView({ closeFlag: mungerOpen,        displayName: '🧠 Munger',        agentKey: 'munger' },        acceptedCount)
}
function handleHeilmeierConfirmAndView(acceptedCount: number): void {
  _agentConfirmAndView({ closeFlag: heilmeierOpen,     displayName: '🎯 Heilmeier',     agentKey: 'heilmeier' },     acceptedCount)
}
function handleFeynmanConfirmAndView(acceptedCount: number): void {
  _agentConfirmAndView({ closeFlag: feynmanOpen,       displayName: '⚛ Feynman',        agentKey: 'feynman' },       acceptedCount)
}
function handleElonConfirmAndView(acceptedCount: number): void {
  _agentConfirmAndView({ closeFlag: elonOpen,          displayName: '⚡ Elon',           agentKey: 'elon' },          acceptedCount)
}
function handleIncorruptibleConfirmAndView(acceptedCount: number): void {
  _agentConfirmAndView({ closeFlag: incorruptibleOpen, displayName: '🛡️ Incorruptible', agentKey: 'incorruptible' }, acceptedCount)
}
function handleRoleAgentConfirmAndView(acceptedCount: number): void {
  _agentConfirmAndView({ closeFlag: roleAgentOpen,     displayName: '🎭 Role Agent',    agentKey: 'role' },          acceptedCount)
}

// r41 v385 (Tom Gilb 2026-06-26) — Feynman Accept-Fix handler.
// Mirrors onMungerAcceptFix verbatim — same Universal Undo wiring + same
// notification + Undo affordance.  Phase 1: simple stamp-fix types route
// here; complex fix types (add-evo-step / strip-jargon / etc.) return null
// from applyFeynmanFix and surface a "use manually for now" notification.
function onFeynmanAcceptFix(finding: FeynmanFinding): void {
  const target = currentSpec.value
  if (!target) {
    showToast('⚛ Feynman — no plan bound. Open a plan first.', 4000)
    return
  }
  const result = _applyFeynmanFixImpl(finding, target)
  if (!result) {
    showToast(
      `⚛ Feynman — fix type "${finding.suggestedFix.type}" is Phase 2. ` +
      `Use the proposed Planguage edit manually until then.`,
      6000,
    )
    return
  }
  const preFixSnapshot: SpecBlock = JSON.parse(JSON.stringify(target))
  undoHistory.record({
    label:          `Feynman Fix · ${finding.principleViolated}`,
    source:         'Feynman',
    prevSpec:       preFixSnapshot,
    nextSpec:       JSON.parse(JSON.stringify(result.newSpec)) as SpecBlock,
    affectedFields: [`${result.affectedItemType}.${result.affectedItemId}`],
    principle:      finding.principleViolated,
  })
  currentSpec.value = result.newSpec
  if (specModel.value) saveSpecSnapshot(result.newSpec)
  showToast(`⚛ Feynman — ${result.summary}`, 7000, { label: '[Undo]', handler: handleGlobalUndo })
  console.log('[Feynman] fix applied:', finding.suggestedFix.type, '→', result.affectedItemType, result.affectedItemId)
}

// r41 v254 (Tom Gilb 2026-06-22) — Heilmeier Accept-Fix handler.
// Mirrors onMungerAcceptFix verbatim (substitution of names) — same Universal
// Undo wiring, same notification + Undo affordance.
function onHeilmeierAcceptFix(finding: HeilmeierFinding): void {
  const target = currentSpec.value
  if (!target) {
    showToast('🎯 Heilmeier — no plan bound. Open a plan first.', 4000)
    return
  }
  const result = _applyHeilmeierFixImpl(finding, target)
  if (!result) {
    showToast(
      `🎯 Heilmeier — fix type "${finding.suggestedFix.type}" pending Phase 2. ` +
      `Use the suggested Planguage manually for now.`,
      6000,
    )
    return
  }
  const preFixSnapshot: SpecBlock = JSON.parse(JSON.stringify(target))
  undoHistory.record({
    label:          `Heilmeier Fix · ${finding.principleViolated}`,
    source:         'Heilmeier',
    prevSpec:       preFixSnapshot,
    nextSpec:       JSON.parse(JSON.stringify(result.newSpec)) as SpecBlock,
    affectedFields: [`${result.affectedItemType}.${result.affectedItemId}`],
    principle:      finding.principleViolated,
  })
  currentSpec.value = result.newSpec
  if (specModel.value) saveSpecSnapshot(result.newSpec)
  showToast(`🎯 Heilmeier — ${result.summary}`, 7000, { label: '[Undo]', handler: handleGlobalUndo })
  console.log('[Heilmeier] fix applied:', finding.suggestedFix.type, '→', result.affectedItemType, result.affectedItemId)
}

// r41 v305 (Tom Gilb 2026-06-23) — Role Agent Accept-Fix handler.
// Mirrors onHeilmeierAcceptFix verbatim — Role IS Stakeholder (Tom #8/9), so
// fixes mutate StakeholderEntry records using role fields from spec.ts v305.
function onRoleAcceptFix(finding: RoleFinding): void {
  const target = currentSpec.value
  if (!target) {
    showToast('Role Agent — no plan bound. Open a plan first.', 4000)
    return
  }
  const result = _applyRoleFixImpl(finding, target)
  if (!result) {
    showToast(
      `Role Agent — fix type "${finding.suggestedFix.type}" could not be applied automatically. ` +
      `Use the suggested Planguage manually for now.`,
      6000,
    )
    return
  }
  const preFixSnapshot: SpecBlock = JSON.parse(JSON.stringify(target))
  undoHistory.record({
    label:          `Role Agent · ${finding.principleViolated}`,
    source:         'Role Agent',
    prevSpec:       preFixSnapshot,
    nextSpec:       JSON.parse(JSON.stringify(result.newSpec)) as SpecBlock,
    affectedFields: [`${result.affectedItemType}.${result.affectedItemId}`],
    principle:      finding.principleViolated,
  })
  currentSpec.value = result.newSpec
  if (specModel.value) saveSpecSnapshot(result.newSpec)
  showToast(`Role Agent — ${result.summary}`, 7000, { label: '[Undo]', handler: handleGlobalUndo })
  console.log('[Role] fix applied:', finding.suggestedFix.type, '→', result.affectedItemType, result.affectedItemId)
}

/** r41 v313 — Route Role Flow Diagram node clicks (Tom Gilb 2026-06-23
 *  Phase 3 of Roles redesign).  Solution / Value nodes → Spec Editor;
 *  Role / Person nodes → Role Agent panel; Resource nodes → functions
 *  fallback for now (the Spec Editor's tab union has no 'resources' slot
 *  in Phase 3 MVP — Phase 3.1 will add it). */
function onRoleFlowOpenEditor(payload: {
  kind: 'role' | 'person' | 'solution' | 'value' | 'resource'
  entryId: string
}): void {
  roleFlowOpen.value = false
  if (payload.kind === 'solution') {
    _openSpecEditor({ tab: 'solutions', entryId: payload.entryId })
    return
  }
  if (payload.kind === 'value') {
    _openSpecEditor({ tab: 'values', entryId: payload.entryId })
    return
  }
  if (payload.kind === 'role' || payload.kind === 'person') {
    roleAgentOpen.value = true
    return
  }
  // resource — Phase 3.1 will add a dedicated tab; fall back to the editor.
  _openSpecEditor({})
}

/** r41 v314 — Phase 4 FINAL: apply routing rules to currentSpec via
 *  Universal Undo SUPREME.  RoleRoutingRulesPanel emits the
 *  pre-previewed result; this handler records the Undo entry BEFORE
 *  mutating currentSpec. */
function onApplyRoleRouting(payload: {
  rules: import('./composables/useRoleRoutingRules').RoutingRule[]
  result: import('./composables/useRoleRoutingRules').RoutingApplyResult
}): void {
  const target = currentSpec.value
  if (!target) {
    showToast('Role Routing — no plan bound. Open a plan first.', 4000)
    return
  }
  if (payload.result.matchedEntries.length === 0) {
    showToast('Role Routing — no changes to apply.', 3500)
    return
  }
  // Re-run apply NON-dry so we get the actual mutated spec.
  const { newSpec, result } = _applyRoleRoutingRulesImpl(target, payload.rules, { respectExisting: true, dryRun: false })
  const preFixSnapshot: SpecBlock = JSON.parse(JSON.stringify(target))
  undoHistory.record({
    label:          `Role Routing · ${result.matchedEntries.length} change${result.matchedEntries.length === 1 ? '' : 's'}`,
    source:         'Role Routing',
    prevSpec:       preFixSnapshot,
    nextSpec:       JSON.parse(JSON.stringify(newSpec)) as SpecBlock,
    affectedFields: result.matchedEntries.map(c => `${c.entryType}.${c.entryId}.${c.field}`),
    principle:      'Default Responsibility for defined Roles (Tom 10-point Roles framework #5)',
  })
  currentSpec.value = newSpec
  if (specModel.value) saveSpecSnapshot(newSpec)
  showToast(
    `🎯 Role Routing — ${result.matchedEntries.length} auto-fill${result.matchedEntries.length === 1 ? '' : 's'} applied`,
    7000,
    { label: '[Undo]', handler: handleGlobalUndo },
  )
}

/** r41 v314 — Phase 4 FINAL: promote a placeholder Stakeholder's
 *  personName via Universal Undo SUPREME.  Stamps fieldSources on the
 *  personName change per No-Silent-Data-Loss SUPREME. */
function onPromoteRolePlaceholder(payload: {
  stakeholderId: string
  candidate: import('./composables/useRolePlaceholderResolver').PlaceholderCandidate
}): void {
  const target = currentSpec.value
  if (!target) {
    showToast('Placeholder Resolver — no plan bound. Open a plan first.', 4000)
    return
  }
  const stakeholders = target.stakeholderEntries ?? []
  const idx = stakeholders.findIndex(s => s.id === payload.stakeholderId)
  if (idx < 0) {
    showToast(`Placeholder Resolver — Stakeholder ${payload.stakeholderId} not found.`, 4000)
    return
  }
  if (payload.candidate.source === 'generic-template') {
    showToast('Placeholder Resolver — generic template cannot be auto-promoted; type a name in the Spec Editor.', 5000)
    return
  }
  const nowIso = new Date().toISOString()
  const preFixSnapshot: SpecBlock = JSON.parse(JSON.stringify(target))
  const newSpec: SpecBlock = JSON.parse(JSON.stringify(target))
  const sh = (newSpec.stakeholderEntries ?? [])[idx]
  sh.personName = payload.candidate.personName
  sh.isPlaceholder = false
  const fs = sh.fieldSources ?? {}
  fs.personName = {
    source:     'Placeholder Resolver',
    sourceType: 'system',
    timestamp:  nowIso,
    tool:       'useRolePlaceholderResolver',
  }
  fs.isPlaceholder = fs.personName
  sh.fieldSources = fs
  undoHistory.record({
    label:          `Placeholder Promote · ${payload.stakeholderId} → ${payload.candidate.personName}`,
    source:         'Placeholder Resolver',
    prevSpec:       preFixSnapshot,
    nextSpec:       JSON.parse(JSON.stringify(newSpec)) as SpecBlock,
    affectedFields: [`Stakeholder.${payload.stakeholderId}.personName`, `Stakeholder.${payload.stakeholderId}.isPlaceholder`],
    principle:      'Musk Responsibility Principle 1 — specific named individuals',
  })
  currentSpec.value = newSpec
  if (specModel.value) saveSpecSnapshot(newSpec)
  showToast(
    `🎯 Placeholder Resolver — ${payload.stakeholderId} → ${payload.candidate.personName}`,
    7000,
    { label: '[Undo]', handler: handleGlobalUndo },
  )
}

function onElonSynthesiseFindings(findings: ElonFinding[]): void {
  if (findings.length === 0) return
  // Compute BEFORE Velocity Score
  const beforeSpec = elonIsModel.value ? elonTargetSpec.value : currentSpec.value
  const beforeScore = beforeSpec
    ? generateElonReport(beforeSpec, specModel.value?.name ?? '').velocityScore
    : null
  for (const f of findings) {
    onElonAcceptFix(f)
  }
  const afterSpec = elonIsModel.value ? elonTargetSpec.value : currentSpec.value
  const afterScore = afterSpec
    ? generateElonReport(afterSpec, specModel.value?.name ?? '').velocityScore
    : null
  const delta = (beforeScore !== null && afterScore !== null) ? afterScore - beforeScore : null
  const deltaStr = delta !== null
    ? ` · Velocity ${beforeScore} → ${afterScore} (${delta >= 0 ? '+' : ''}${delta})`
    : ''
  showToast(
    `🔪 Elon Sharpening — synthesised ${findings.length} fix${findings.length === 1 ? '' : 'es'} from your answers${deltaStr}.`,
    8000,
    { label: '[Undo]', handler: handleGlobalUndo },
  )
  elonSharpeningOpen.value = false
  elonOpen.value           = true
}

function onElonUndoFix(finding: ElonFinding): void {
  const snapshot = _elonUndoSnapshots.value.get(finding.id)
  if (!snapshot) {
    showToast('⚡ Elon — no undo snapshot found (was the fix applied this session?)', 5000)
    return
  }

  if (elonIsModel.value) {
    elonTargetSpec.value = snapshot
    showToast(`⚡ Elon — model fix undone (preview restored).`, 5000)
  } else {
    currentSpec.value = snapshot
    if (specModel.value) saveSpecSnapshot(snapshot)
    showToast(`⚡ Elon — fix undone for ${finding.triggeredBy}. Plan restored.`, 6000)
  }

  const nextAccepted = new Set(elonAcceptedIds.value)
  nextAccepted.delete(finding.id)
  elonAcceptedIds.value = nextAccepted
  const nextSnapshots = new Map(_elonUndoSnapshots.value)
  nextSnapshots.delete(finding.id)
  _elonUndoSnapshots.value = nextSnapshots

  console.log('[Elon] fix undone:', finding.id)
}

// ── Penta Model: spec write-back ──────────────────────────────────────────────
// PentaPanel emits 'update-spec' when the user applies edits in the detail panel
// or applies a Claudian response from PentaOptima. We set currentSpec and persist.
// r93v: record on the universal undo stack BEFORE mutation per the Universal Undo Rule.
function onPentaUpdateSpec(updatedSpec: SpecBlock): void {
  if (currentSpec.value) {
    undoHistory.record({
      label:    'Penta Apply Edits',
      source:   'PentaPanel',
      prevSpec: JSON.parse(JSON.stringify(currentSpec.value)) as SpecBlock,
      nextSpec: JSON.parse(JSON.stringify(updatedSpec)) as SpecBlock,
    })
  }
  currentSpec.value = updatedSpec
  if (specModel.value) saveSpecSnapshot(updatedSpec)
  console.log('[PentaPanel] update-spec applied —',
    updatedSpec.values?.length ?? 0, 'V.,',
    updatedSpec.resources?.length ?? 0, 'R.,',
    updatedSpec.solutions?.length ?? 0, 'S.')
}

// r41 v295 (Tom Gilb 2026-06-22 "always continue · research and innovation").
// Stage 9 Study-Act Capture Actuals apply handler. Routes through Universal
// Undo SUPREME (record BEFORE mutation), persists via saveSpecSnapshot,
// closes the modal, and surfaces a confirmation notification (banned word
// "toast" — using "notification" per CLAUDE.md SUPREME rule).
function onStage9ActualsApply(updatedSpec: SpecBlock): void {
  if (currentSpec.value) {
    undoHistory.record({
      label:    'Stage 9 Capture Actuals',
      source:   'Stage9ActualsPanel',
      prevSpec: JSON.parse(JSON.stringify(currentSpec.value)) as SpecBlock,
      nextSpec: JSON.parse(JSON.stringify(updatedSpec))       as SpecBlock,
    })
  }
  // Count what changed for the notification.
  const prev = currentSpec.value
  let valuesUpdated    = 0
  let resourcesUpdated = 0
  if (prev) {
    const prevValues = new Map((prev.values ?? []).map(v => [v.id, v.status ?? '']))
    const prevRes    = new Map((prev.resources ?? []).map(r => [r.id, r.status ?? '']))
    for (const v of updatedSpec.values ?? []) {
      if ((prevValues.get(v.id) ?? '') !== (v.status ?? '')) valuesUpdated++
    }
    for (const r of updatedSpec.resources ?? []) {
      if ((prevRes.get(r.id) ?? '') !== (r.status ?? '')) resourcesUpdated++
    }
  }
  currentSpec.value = updatedSpec
  if (specModel.value) saveSpecSnapshot(updatedSpec)
  stage9ActualsOpen.value = false
  showToast(
    `📥 Study-Act actuals captured — ${valuesUpdated} Value${valuesUpdated === 1 ? '' : 's'}, ${resourcesUpdated} Resource${resourcesUpdated === 1 ? '' : 's'} updated`,
    5000,
  )
  console.log('[Stage9Actuals] applied — values updated:', valuesUpdated, '· resources updated:', resourcesUpdated)
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

/**
 * r41 v408 (Tom Gilb 2026-06-28 verbatim: "I would like the per agent
 * breakdown. And in all cases I want consolation that the exact source
 * of the change is attached to the spec").
 *
 * Per-agent breakdown for the Stage 3 banner.  Reads `specModel.agentFixCounts`
 * (the cumulative per-agent accepted-fix counter populated by
 * `_agentConfirmAndView` → `bumpSpecVersion({ agentKey, acceptedFixCount })`).
 *
 * Returns an ordered array of chip-ready records the template renders as
 * an indigo chip row beneath the "N sharpening rounds complete" pill.
 * Each chip shows the agent's display name + fix count, doubling as the
 * "consolation that the exact Source of the change is attached to the
 * spec" (since each chip exists ONLY because the agent's confirm-and-view
 * stamped fieldSources on every mutated field with that agent's name).
 *
 * Per-agent breakdown is intentionally separate from `sharpenRounds`
 * (which lives in `useSharpen()` and carries the CANONICAL Sharpen Panel
 * activity) — agent panels (Munger / Heilmeier / Feynman / Elon /
 * Incorruptible / Role) do NOT push into sharpenRounds, they bump
 * `agentFixCounts` directly via _agentConfirmAndView.  Composes with
 * Done/You-Can/Continue SUPREME (banner is the DONE state) + Source
 * attribution audit trail.
 */
const AGENT_DISPLAY_NAMES: Record<string, string> = {
  munger:        'Munger',
  heilmeier:     'Heilmeier',
  feynman:       'Feynman',
  elon:          'Elon',
  incorruptible: 'Incorruptible',
  role:          'Role Agent',
  'sharpen-panel': 'Sharpen Panel',
}
const agentFixBreakdown = computed<{ key: string; label: string; count: number }[]>(() => {
  const raw = specModel.value?.agentFixCounts
  if (!raw) return []
  const entries = Object.entries(raw)
    .filter(([, n]) => typeof n === 'number' && n > 0)
    .map(([key, n]) => ({
      key,
      label: AGENT_DISPLAY_NAMES[key] ?? (key.charAt(0).toUpperCase() + key.slice(1)),
      count: n as number,
    }))
  // Sort by descending count, then alpha by label for stable order.
  entries.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
  return entries
})
const totalAgentFixes = computed<number>(() =>
  agentFixBreakdown.value.reduce((sum, e) => sum + e.count, 0),
)

// --- Feature #177: Generated-at timestamp ---
// Set whenever a spec is generated (doTranslate) or restored (session).
// Passed to SpecOutput for display in the spec header.
const specGeneratedAt = ref<Date | null>(null)

// r41 v277 (Tom Gilb 2026-06-22 "AI was slow message disappeared before I
// could read" + "a second far too fast disappearing message said something
// about what was generated") — persistent post-generation BANNER state.
// The toast tells the in-flight story; the banner is the durable record
// the user actually sees when they land on Stage 2.  Survives until the
// user dismisses it OR a new generation overwrites it.  Composes with
// universal accessibility (important notifications must persist for every reader; ephemeral = silent data loss) + No-Silent-Data-
// Loss SUPREME + MOVE Principle (visible at-a-glance on the destination).
interface GenerationReport {
  ts: number               // Date.now() of generation completion
  kind: 'success' | 'slow-fallback' | 'failure'
  headline: string         // short single-sentence label
  detail: string           // full multi-sentence message (same as the toast text)
}
const lastGenerationReport = ref<GenerationReport | null>(null)
function dismissGenerationReport(): void { lastGenerationReport.value = null }

// --- Plan Model ---
// Named, versioned model tracking for each spec/plan pair.
// Initialised in doTranslate(); bumped in onSpecSharpened().
const { currentModel: specModel, allModels: _allSpecModels } = useSpecModel()

// r41 2026-06-20 (Tom Gilb verbatim picked option B "per-plan contract
// memory" after the Monitor-sticky-on-Indianapolis bug) — wire the active
// SpecModel id into the contract store so switching plans hydrates the
// Contracts agent from that plan's remembered contract slot.  Migration
// shim inside `applyPlanSwitch` hoists any legacy global current-contract
// id to the first-seen plan slot.  Composes with No-Silent-Data-Loss
// SUPREME (no contract state silently dropped on plan switch — parked
// under the prev-plan key + still in the contracts list) + Universal
// Undo SUPREME (every plan↔contract pairing is reversible by switching
// back) + Architectural Resilience SUPREME (plan-scoped active-state is
// the portable pattern other agents will inherit).
const _contractsStoreForPlanSwitch = useContractStore()
watch(
  () => specModel.value?.id ?? null,
  (id) => { _contractsStoreForPlanSwitch.applyPlanSwitch(id) },
  { immediate: true },
)

// r41 v420 → v422 → v425 evolution of the SpecTitleAnchor content binding:
//
// v420 (Tom Gilb 2026-07-01 *"I tried switch contract and got the title up
//       there but under it the older monitor contract"*) — made the anchor
//       show the CONTRACT title in Contracts mode instead of the stale plan
//       name.
// v422 (Tom Gilb 2026-07-01 *"I have not yet focussed on models, but good to
//       try to clean suspected bugs eary"*) — extended to Model Library.
// v425 (Tom Gilb 2026-07-01 *"the blue contracts return pin does n ot work,
//       and it overlaps other text"*) — REVISED: both v420 and v422 tried
//       to render a DUPLICATE title chip on top of overlays that already
//       have their own titles inline in their headers.  The result:
//       (a) collision — the anchor pill at `top-2 left-3` overlapped
//       ContractHub's own "← Your Contracts" pill;  (b) broken click —
//       the click handler calls `window.scrollTo`, but ContractHub is a
//       `fixed inset-0 z-[600]` full-screen dialog; scrolling the window
//       does nothing because the dialog's internal scroll containers are
//       separate.
//
// Correct architecture: mode-level overlays (Contracts, Models) OWN their
// context anchors inside their own headers.  The global SpecTitleAnchor
// exists to surface the ACTIVE PLAN title when plan-side tool overlays
// (Penta, Sharpen, EHT, etc.) cover the main Spec Crest — those tool
// overlays don't display a plan-context header inline.  Fix: pass `null`
// for the anchor's specName whenever a mode-level overlay is open, which
// the anchor's own `visible` computed already handles by hiding cleanly.
// No collision.  No broken click (the anchor doesn't render at all).
//
// Composes with No-Silent-Removal SUPREME (anchor still surfaces in every
// other context — only hides where a duplicate would collide with the
// overlay's own title), MOVE Principle SUPREME (one title per surface, not
// two), Tom-Repeats-Himself SUPREME (this class-bug family: two anchors
// competing for the same viewport corner — solved by ownership),
// Architectural Resilience SUPREME (clean separation: mode overlays own
// their titles; global anchor covers the gap for tool overlays), Trace-
// Before-Patch SUPREME (v420 + v422 tried to patch by REPLACING content;
// v425 sees the real problem was DUPLICATION and hides accordingly).
const _specTitleAnchorName = computed<string | null>(() => {
  // Mode-level overlays own their own title in their header — do NOT render
  // a second one on top.  Anchor auto-hides when name is null.
  if (contractsOpen.value)    return null
  if (modelLibraryOpen.value) return null
  return specModel.value?.name ?? null
})
const _specTitleAnchorVersion = computed<string | null>(() => {
  if (contractsOpen.value)    return null
  if (modelLibraryOpen.value) return null
  return specModel.value?.version ? `v${specModel.value.version}` : null
})

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
const solutionSharpenOpen    = ref(false)  // Stage 5 · Solution Sharpening Interview (Tom 2026-06-08)
const strategyAgentOpen      = ref(false)  // Strategy Agent — Strategy Sharpening (Tom 2026-06-09)
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
// r41 v335 — Diagnostics Panel open ref + early useDiagnostics() call to
// install the console.error / window.error / unhandledrejection listeners
// AS EARLY AS POSSIBLE in App.vue setup so even mount-time errors get caught.
const diagnosticsOpen        = ref(false)
const { errorCount: diagnosticsErrorCount } = useDiagnostics()
// r41 v112 (Tom Gilb 2026-06-17 verbatim "owner button does not open, and
// where is Stewards?") — pre-spec Stewards manager.  Lets the planner add
// Owners / Planners / Scribes BEFORE the first generation; the list is
// persisted in localStorage + applied to the Plan Model at generation time.
const preSpecStewardsOpen    = ref(false)
interface PreSpecSteward { name: string; role: 'Owner' | 'Planner' | 'Scribe' }
const preSpecStewards        = ref<PreSpecSteward[]>([])
const preSpecStewardDraft    = ref<PreSpecSteward>({ name: '', role: 'Owner' })
const PRESPEC_STEWARDS_KEY   = 'sem-prespec-stewards-v1'
function _loadPreSpecStewards(): void {
  try {
    const raw = localStorage.getItem(PRESPEC_STEWARDS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) preSpecStewards.value = parsed as PreSpecSteward[]
    }
  } catch (err) {
    console.warn('[preSpecStewards] load failed', err)
  }
}
function _savePreSpecStewards(): void {
  try {
    localStorage.setItem(PRESPEC_STEWARDS_KEY, JSON.stringify(preSpecStewards.value))
  } catch (err) {
    console.warn('[preSpecStewards] save failed', err)
  }
}
function addPreSpecSteward(): void {
  const name = preSpecStewardDraft.value.name.trim()
  if (!name) return
  preSpecStewards.value.push({ name, role: preSpecStewardDraft.value.role })
  preSpecStewardDraft.value = { name: '', role: preSpecStewardDraft.value.role }
  _savePreSpecStewards()
}
function removePreSpecSteward(idx: number): void {
  preSpecStewards.value.splice(idx, 1)
  _savePreSpecStewards()
}

// r41 v49 — Top-level Mode pin state (Tom Gilb 2026-06-16).
const activeModePopoverOpen = ref(false)
const modeSwitchGovOpen     = ref(false)
const { activeMode: _activeMode, pendingSwitch: _pendingModeSwitch, requestSwitch: _requestModeSwitch, resolveSwitch: _resolveModeSwitch, cancelSwitch: _cancelModeSwitch } = useActiveMode()

// r41 v50 (Tom Gilb 2026-06-16 "strategy mode needs to be a part of the set
// of modes, not a separate function") — auto-sync the existing
// `Settings.strategyMode` boolean with the new top-level `activeMode ===
// 'strategy'`.  Every consumer of `useStrategyMode` continues to work without
// any re-plumbing — terminology overrides (Values → Strategic Objectives etc.)
// take effect across the entire app whenever the user switches to Strategy
// Mode via the title-bar Mode pin.  Two-way: changing the boolean directly
// in Settings also flips the activeMode (preserves the existing settings UX
// alongside the new top-level Mode pin).
import { useSettings as _useSettingsForStrategySync } from './composables/useSettings'
const { settings: _strategySyncSettings, setOne: _strategySyncSetOne } = _useSettingsForStrategySync()
// r41 v58 — Top-level settings ref for the export-format choice (Tom Gilb
// 2026-06-16).  Singleton via useSettings; alias for clarity at the 3 export
// call sites that need `appSettings.value.specExportFormat`.
const appSettings = _strategySyncSettings
watch(_activeMode, (mode) => {
  const shouldBeStrategy = mode === 'strategy'
  if (_strategySyncSettings.value.strategyMode !== shouldBeStrategy) {
    _strategySyncSetOne('strategyMode', shouldBeStrategy)
  }
}, { immediate: true })
watch(() => _strategySyncSettings.value.strategyMode, (isStrategy) => {
  const wantedMode: ActiveMode = isStrategy ? 'strategy' : 'plan'
  if (_activeMode.value !== wantedMode && !isStrategy && _activeMode.value === 'strategy') {
    // Settings turned strategy OFF while in Strategy mode → drop back to Plan
    // without firing the governance dialog (this is a user-explicit settings
    // change, not a mode-pin click, so the user already consented).
    useActiveMode()._setForce('plan')
  } else if (isStrategy && _activeMode.value !== 'strategy') {
    // Settings turned strategy ON while in a different mode → switch to
    // Strategy without governance (same user-consent reasoning).
    useActiveMode()._setForce('strategy')
  }
})

function _onModeSwitchRequest(target: ActiveMode): void {
  _requestModeSwitch(target)
  activeModePopoverOpen.value = false
  modeSwitchGovOpen.value     = true
}
function _onModeSwitchResolve(choice: ModeSwitchChoice): void {
  // r41 v49 — Auto-save the outgoing mode's current artifact to the right
  // history BEFORE switching.  Per Tom Gilb 2026-06-16 verbatim "there must
  // be a governance of auto save of the version, in the right history".
  // For now we record a version of the current spec to the existing spec
  // history (Plan + Model both use it).  Contract history is per-contract +
  // already auto-saves on every parse; nothing extra needed here.
  try {
    if (currentSpec.value) {
      const fromMode = _pendingModeSwitch.value?.fromMode ?? 'plan'
      addVersion(currentSpec.value, `Mode switch · ${fromMode} → ${_pendingModeSwitch.value?.toMode ?? 'plan'}`, null, specModel.value?.name ?? '', _specOwnerNames())
    }
  } catch (err) {
    console.warn('[mode-switch] auto-save failed', err)
  }
  // 'fresh' = start blank in new mode.  'reuse' = keep currentSpec across.
  if (choice === 'fresh') {
    currentSpec.value     = null
    specGeneratedAt.value = null
    stage.value           = 1
    planningStage.value   = 1
  }
  _resolveModeSwitch(choice)
  modeSwitchGovOpen.value = false
}
function _onModeSwitchCancel(): void {
  _cancelModeSwitch()
  modeSwitchGovOpen.value = false
}
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
// r41 v164 — Demos Menu (Tom Gilb 2026-06-17 verbatim "MAKE THIS A
// GENERIC MENU TO A SET OF DEMOS, ON EACH STAGE, EACH TOOL, EACH AGENT").
const demosMenuOpen = ref(false)
// r41 v168 — currently-playing demo (id + display title/subtitle).
const playingDemo = ref<{ id: string; title: string; subtitle: string } | null>(null)

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

// r41 v365 (Tom Gilb 2026-06-25 "remove what is not in use") — Feature #53
// SpecWizard fully removed.  `wizardOpen` ref kept as permanent `false` so
// the few remaining safety-net references (registerExclusiveSurface + the
// v-if guard at line ~13271 + _closeAllOverlays' defensive reset) still
// compile.  No code path can set it to true anymore — wizard cannot surface.
const wizardOpen = ref(false)

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
// r41 v229 (Tom Gilb 2026-06-20 verbatim "menus do not disappear, they
// scroll up, out of the way") — Plan Crest is now IN-FLOW with mt-[148px]
// to clear the fixed stage bar.  Main content sits NATURALLY below the
// Plan Crest in the document, so it no longer needs padding-top to clear
// a fixed crest.  The Plan Crest's own mt-[148px] handles stage-bar
// clearance for the page top; main content has zero structural padding.
// `contentTopPad` retained as `undefined` so the existing :style binding
// is a no-op.  specCrestH ResizeObserver retained for any future widget
// that needs the crest height.
const contentTopPad = computed(() =>
  view.value === 'app'
    ? undefined  // Plan Crest is in-flow now; no padding needed.
    : undefined
)
// --- Feature #195: Spec Targets ---
const specTargetsOpen     = ref(false)
// --- Agent Menu + Maria panels (2026-05-29 / 2026-05-30) ---
const agentMenuOpen       = ref(false)
const mariaOpen           = ref(false)           // MariaAgentBoard — analysis panel
const mariaBoardOpen      = ref(false)           // MariaBoardHub   — settings + activity log
// Incorruptible Agent (Tom Gilb 2026-06-11 — Eric Ries 2026 book): strategic-resilience check.
// Tom 2026-06-11 (Phase 1.1): "we should be able to use it health check and sharpen ... on any
// plan or organizational model (for sure also a tool in the Model mode, so duplicate it there)".
// Tom 2026-06-11 (r93u): "after click accept fix, the button need change to 'Fix Is Accepted',
// maybe with an Undo Fix button" — accept/undo state tracked at App level so we can snapshot
// the pre-fix spec for undo restore.
const incorruptibleOpen        = ref(false)
const incorruptibleTargetSpec  = ref<SpecBlock | null>(null)
const incorruptibleTargetTitle = ref<string>('')
/** True when Incorruptible is checking a Library model (not the user's current plan) —
 *  Accept Fix in that mode just shows toast (model mutation is library-level concern). */
const incorruptibleIsModel     = ref<boolean>(false)
/** Finding-ids the user has accepted in this session — drives the "Fix Is Accepted" button
 *  state in IncorruptiblePanel. Cleared on panel close. */
const incorruptibleAcceptedIds = ref<Set<string>>(new Set())
/** Pre-fix spec snapshots, keyed by finding-id — Undo Fix restores from these.
 *  In model-mode we snapshot the target spec; in current-plan mode we snapshot currentSpec.
 *  Map is in-memory only (per-session); cleared on panel close. */
const _incorruptibleUndoSnapshots = ref<Map<string, SpecBlock>>(new Map())

/** Incorruptible Sharpening panel (r93aa) — Q&A-driven sharpening tool. Inherits the same
 *  target-spec + model-mode refs as the health-check panel. */
const incorruptibleSharpeningOpen = ref(false)

// Elon Agent (Tom Gilb 2026-06-12 — Musk's Methods + Dove et al. Pace-of-Innovation paper).
//   Mirrors Incorruptible plumbing 1:1: target-spec, model-mode flag, accepted-id set,
//   undo-snapshot map. Pace-of-Innovation is the DOMINANT Requirement; UI + scoring respect it.
const elonOpen        = ref(false)
// r41 v225 — Munger Agent open flag
const mungerOpen      = ref(false)
// r41 v254 (Tom Gilb 2026-06-22) — Heilmeier Agent open flag
const heilmeierOpen   = ref(false)
// r41 v385 (Tom Gilb 2026-06-26) — Feynman Agent open flag
const feynmanOpen     = ref(false)
// r41 v305 (Tom Gilb 2026-06-23) — Role Agent open flag (MAJOR REDESIGN)
const roleAgentOpen   = ref(false)
// r41 v312 (Tom Gilb 2026-06-23) — Phase 2: Role Health Dashboard open flag.
const roleHealthOpen  = ref(false)
// r41 v313 (Tom Gilb 2026-06-23) — Phase 3: Role Flow Diagram open flag
// (Tom 14-point spec #10: "We should be able to generate a Role diagram
//  with all stakeholders, and how they relate to all Planguage specs").
const roleFlowOpen    = ref(false)
// r41 v314 (Tom Gilb 2026-06-23) — Phase 4 FINAL: Role Routing Rules &
// Placeholder Resolver Panel open flag (Tom 14-point spec #14 + Tom
// 10-point Roles framework #5 + #8 — maximum automation of Role management).
const roleRoutingOpen = ref(false)

// r41 v231 — Agent Mode Picker.  One pin per agent in AgentsStrip; clicking
// opens this picker for the planner to choose Principles / Analysis /
// Improvement / Sharpening / Create Optional Version.  Dispatches to the
// existing panel/handler.
const modePickerOpen     = ref(false)
const modePickerAgentId  = ref<AgentRegistryId | null>(null)
function onOpenModePicker(agentId: AgentRegistryId): void {
  modePickerAgentId.value = agentId
  modePickerOpen.value    = true
}
function onModeSelect(mode: AgentModeKey): void {
  const id = modePickerAgentId.value
  modePickerOpen.value    = false
  if (!id) return
  // Dispatch — most modes route to the agent's existing panel.  Create
  // Optional Version is Phase 2 for non-AutoDBO agents; show a toast.
  switch (mode) {
    case 'principles':
      // Read-only info — open the AgentMenuPanel's per-agent rich tile.
      // For now, route to the same panel as analysis but the planner sees
      // the agent's identity card with NO action buttons engaged.  Phase 2
      // can route to a dedicated Principles popover.
      agentMenuOpen.value = true
      break
    case 'analysis':
    case 'improvement':
      // Both modes open the existing analysis panel; Accept-Fix is available
      // in both (Analysis-only = "don't apply"; Improvement = "use Accept").
      // Phase 2 can gate Accept-Fix on the mode if Tom asks.
      if (id === 'munger')        mungerOpen.value        = true
      if (id === 'heilmeier')     heilmeierOpen.value     = true
      if (id === 'feynman')       feynmanOpen.value       = true
      if (id === 'roles')         roleAgentOpen.value     = true
      if (id === 'elon')          elonOpen.value          = true
      if (id === 'incorruptible') incorruptibleOpen.value = true
      break
    case 'sharpening':
      // Open the sharpening Q&A panel (Elon/Incorruptible have one;
      // Munger sharpening is Phase 2 — toast.).
      if (id === 'munger') {
        showToast('🔪 Munger Sharpening Q&A — Phase 2 build pending.  Run Analysis mode for the deterministic check now.', 5000)
      }
      if (id === 'feynman') {
        showToast('⚛ Feynman Sharpening Q&A — Phase 2 build pending.  Run Analysis mode for the deterministic check now.', 5000)
      }
      if (id === 'elon')          _launchElonSharpeningOnCurrentPlan()
      if (id === 'incorruptible') _launchIncorruptibleSharpeningOnCurrentPlan()
      break
    case 'create-optional':
      showToast('🌱 Create Optional Version — Phase 2 build pending.  Use Auto-DBO directly for spec-version branching now.', 5500)
      break
  }
}

// r41 v229 (Tom Gilb 2026-06-20 refinement: "menus do not disappear, they
// scroll up, out of the way, but we inituitively know that and can bring
// them down by a simple scroll") — Focus Mode toggle DROPPED.  The Plan
// Crest is now in-flow (see specCrestEl mt-[148px] above) and scrolls up
// out of view as the page scrolls down.  Scrolling up brings the menus
// back into view — natural, no toggle, no keyboard combo, no localStorage
// state.  Composes with No-Silent-Removal (menus always in DOM, just
// above the viewport when scrolled past).
// `focusModeActive` stub kept as a const false so any descendant template
// references still type-check; can be removed in a follow-up sweep.
const focusModeActive = ref(false)
function focusModeToggle(): void { /* no-op — r41 v229 dropped Focus Mode in favour of natural scroll. */ }
const elonTargetSpec  = ref<SpecBlock | null>(null)
const elonTargetTitle = ref<string>('')
const elonIsModel     = ref<boolean>(false)
const elonAcceptedIds = ref<Set<string>>(new Set())
const _elonUndoSnapshots = ref<Map<string, SpecBlock>>(new Map())
const elonSharpeningOpen = ref(false)

/** r93qq — Value Aspects Articulation Tool (Tom Gilb 2026-06-11 22:45 CET) */
const valueAspectsOpen   = ref(false)
const valueAspectsTarget = ref<PentaItem | null>(null)

function onOpenValueAspects(item: PentaItem): void {
  valueAspectsTarget.value = item
  valueAspectsOpen.value   = true
}

/** When the planner clicks Apply in Value Aspects, route the Aspects through to a record on
 *  the Universal Undo stack and show a toast. Full spec-write integration (storing aspects[]
 *  on the V. entry) is queued for Phase 2; Phase 1 emits the locked set + toasts confirmation.
 *
 *  r93sss — payload now carries Tom Gilb's apply-mode choice ('keep-and-add' default, or
 *  'replace') + the Umbrella Tag + the parent Value identity. Phase-2 spec-write integration
 *  will honor the mode: 'keep-and-add' preserves the original V entry and re-tags it as
 *  `<Umbrella>.<original>` while adding new V entries for each Aspect; 'replace' deletes the
 *  original V entry first then adds the new V entries. The toast confirms which mode fired
 *  so the planner can ⌘Z if it was the wrong choice (Universal Undo SUPREME).
 */
function onApplyValueAspects(payload: {
  setId: string
  aspects: unknown[]
  umbrellaTag?: string
  applyMode?: 'keep-and-add' | 'replace'
  parentValueId?: string
  parentValueName?: string
}): void {
  const modeLabel = payload.applyMode === 'replace' ? '⚡ REPLACED' : 'KEPT + ADDED'
  const parentName = payload.parentValueName || payload.parentValueId || '(unknown)'
  const umbrella = payload.umbrellaTag || '(unknown set)'
  showToast(
    `🧬 ${modeLabel}: "${parentName}" → "${umbrella}" set. ${payload.aspects.length} Aspect(s) locked. (Phase 2 will persist to Value entries; ⌘Z to undo.)`,
    8000,
    { label: '[Undo]', handler: handleGlobalUndo },
  )
  console.log('[ValueAspects] Apply', { mode: payload.applyMode, umbrella, parent: parentName, aspects: payload.aspects.length })
}

// ── Universal Undo System (Tom Gilb SUPREME rule 2026-06-11, r93v) ────────
// Singleton stack — every spec-mutating tool routes through this. App.vue:
//   1. Registers the spec-restorer callback ONCE at startup
//   2. Calls undoHistory.record() before every currentSpec mutation
//   3. Renders the global Undo button + handles ⌘Z / ⌘⇧Z keyboard shortcuts
const undoHistory = useUndoHistory()
// Register the restorer — undo() / redo() invoke this to write the spec back.
registerUndoSpecRestorer((spec: SpecBlock) => {
  currentSpec.value = spec
  if (specModel.value) saveSpecSnapshot(spec)
})

/** Global Undo handler — ⌘Z + button click both route here. */
function handleGlobalUndo(): void {
  const entry = undoHistory.undo()
  if (entry) {
    showToast(`↶ Undone: ${entry.label} (${entry.source})`, 4000)
  } else {
    showToast('Nothing to undo.', 2000)
  }
}

/** Global Redo handler — ⌘⇧Z. */
function handleGlobalRedo(): void {
  const entry = undoHistory.redo()
  if (entry) {
    showToast(`↷ Redone: ${entry.label} (${entry.source})`, 4000)
  } else {
    showToast('Nothing to redo.', 2000)
  }
}

// ⌘Z / ⌘⇧Z keyboard shortcuts. Skip if user is inside an input/textarea/contenteditable —
// browsers handle ⌘Z natively in text fields and we don't want to fight that.
// NOTE: `_isTypingTarget` is declared further down in this file (line ~4624 region) as a
// shared utility used by Global Find + Actions Menu. We use the SAME function via hoisting
// (function declarations are hoisted; const/let are not) — do NOT redeclare it here or the
// SFC compiler errors with "Identifier '_isTypingTarget' has already been declared".
function _onUndoKeydown(e: KeyboardEvent): void {
  // ⌘Z = undo · ⌘⇧Z = redo (Mac convention)
  if (!e.metaKey || e.key.toLowerCase() !== 'z') return
  if (_isTypingTarget(e)) return  // let text fields handle their own undo
  e.preventDefault()
  if (e.shiftKey) handleGlobalRedo()
  else            handleGlobalUndo()
}
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', _onUndoKeydown)
}
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

// r93qqq 2026-06-12 — TwinPod illustration catalog picker.
// Searches every illustration across every public Tom Gilb book pod
// (e.g. competitiveengineering.gilb.com/public/<Book>/_images/), pairs
// each one with its caption from the chapter MD frontmatter, and
// inserts (via clipboard) into any SEM surface that accepts paste.
// Composes with Conjunction-of-Technologies SUPREME (every insert carries
// a citation) and r93ppp Twin promotional discipline (citation links to
// the paid Tom Gilb Consultant Twin).
const gilbIllustrationsOpen = ref(false)
// r41 v27 — Tom Gilb 2026-06-15 verbatim "i cannot see how to get to
// bookkaleidoscope, and anyway maybe it needs a surface tool button" — new
// 📚 Books title-bar pin opens the picker pre-selected on the Books tab.
// Also allows the picker to default to its last-used tab on a plain ⌘I open.
import type { IlluminateTab } from './components/GilbIllustrationPicker.vue'
const gilbIllustrationsInitialTab = ref<IlluminateTab | undefined>(undefined)
function openGilbIllustrations(): void {
  gilbIllustrationsInitialTab.value = undefined  // respect last-used tab
  gilbIllustrationsOpen.value = true
}
function openBookKaleidoscope(): void {
  gilbIllustrationsInitialTab.value = 'books'
  gilbIllustrationsOpen.value = true
}

// r41 (Tom Gilb 2026-06-14 verbatim: "the illuminate any term box at right is
// blocking and i did not ask for it") — when the GilbIllustrationPicker is
// open, suppress the always-mounted SelectionDefiner side aperture so it
// doesn't compete for attention or block content. Cause: ⌘I fires BOTH
// openGilbIllustrations() AND SelectionDefiner's own keydown handler that
// opens its term-search aperture. The two race; the aperture loses but stays
// visible to the right of the picker. Fix: watch gilbIllustrationsOpen → close
// the SelectionDefiner panel + aperture immediately and on re-open.
const _defineState = _useDefineForPickerSuppress()
watch(gilbIllustrationsOpen, (open) => {
  if (open) {
    closeDefine()
    _defineState.defineSearchOpen.value = false
  }
})

// r93qqq r23 — Tom Gilb 2026-06-13: "I want all diagrams clickable. But I
// was only referring to the diagram with ontologies in almost all glossary
// terms, the 700".  663-concept clickable ontology tree.  Sourced from
// 10.Standard/2.Glossary/PlanguageGlossary/.  Every concept node opens in
// the Tom Gilb Consultant Twin (free, r93ppp aligned).
const ontologyDiagramOpen = ref(false)
function openOntologyDiagram(): void { ontologyDiagramOpen.value = true }
async function onGilbIllustrationInsert(payload: { illustration: { id: string, bookTitle: string, page: number | null } | null, html: string, markdown: string }): Promise<void> {
  // r93qqq 2026-06-13 — payload is either an illustration OR a text card
  // (Planguage Glossary entry / chapter excerpt).  Both carry .html + .markdown.
  // Clipboard carries BOTH formats (rich HTML + plain markdown) so ⌘V into any
  // target — Mail / Notes / Keynote / spec rich field / code editor — works.
  try {
    await exportCopy(payload.html, payload.markdown)
    if (payload.illustration) {
      const where = `${payload.illustration.bookTitle}${payload.illustration.page ? ` p.${payload.illustration.page}` : ''}`
      showToast(`📖 Illustration on clipboard — ${where}. ⌘V into your spec field.`, 7000)
    } else {
      showToast(`💡 Text on clipboard. ⌘V into your spec field.`, 6000)
    }
  } catch (e) {
    showToast(`Could not copy: ${(e as Error).message}`, 5000)
  }
}
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

// r41 v321 — SpecPulse tile-click router (Tom Gilb 2026-06-24).  Each tile in the
// 6-tile color-block banner routes to the appropriate detail surface for that
// Planguage type.  Spec Editor handles functions / values / solutions / constraints;
// r41 v363 (Tom Gilb 2026-06-25 "THEY ARE ALSO Planguage SPECS AND IT IS
// CRITICAL TO KNOW WHEN THEY ARE NOT DONE OR ARE DONE"): live done/total
// tracking for the SpecPulse Evo Steps + Tasks tiles.  A Task is "done"
// when its TaskSuggestion.completed === true.  An Evo Step is "done" when
// it has at least one task AND every task on that step is completed.  A
// step with ZERO tasks counts as NOT-done (you haven't planned its work
// yet, so you can't claim it as delivered).
const specPulseStepStats = computed(() => {
  const steps = confirmedSteps.value
  const tasksMap = tasksByStep.value
  const totalSteps = steps.length
  let totalTasks = 0
  let doneTasks  = 0
  let doneSteps  = 0
  for (const step of steps) {
    const stepTasks = tasksMap[step.name] ?? []
    const taskTotal = Array.isArray(stepTasks) ? stepTasks.length : 0
    const taskDone  = Array.isArray(stepTasks) ? stepTasks.filter(t => t.completed === true).length : 0
    totalTasks += taskTotal
    doneTasks  += taskDone
    if (taskTotal > 0 && taskDone === taskTotal) doneSteps++
  }
  return { totalSteps, totalTasks, doneSteps, doneTasks }
})

// r41 v375 (Tom Gilb 2026-06-25 "the generation loop went on and on so i
// went away from it") — visible Cancel button during loading routes through
// here.  Aborts the in-flight API request, clears loading state, restores
// the previous spec (if any) via the existing safety-net pattern, and
// surfaces a toast naming what happened so the planner isn't confused.
function onCancelGeneration(): void {
  console.warn('[onCancelGeneration] Planner cancelled generation', { elapsedMs: Date.now() - (_lastTranslateStart ?? Date.now()), sdkLoading: sdkLoading.value })
  cancelCurrentTranslate()  // aborts the AbortController inside useSDK
  _forceClearLoading()       // clears all loading keys regardless of finally blocks
  _activeTranslateCallId = 0 // S3 sweep 2026-06-26 — release the in-flight guard
  // Drop back to the entry form so the planner can edit and retry.
  stage1Sub.value = 'form'
  stage.value     = 1
  showToast('❌ Generation cancelled — your input is preserved.  Edit and Generate again when ready.', 6000)
}
let _lastTranslateStart: number | null = null

// stakeholders routes to Stakeholder Mapper agent; resources routes to Resources
// Sharpening panel.  Composes with MOVE Principle (one click = the right destination).
function onSpecPulseTileClick(
  type: 'stakeholders' | 'functions' | 'values' | 'solutions' | 'constraints' | 'resources' | 'evosteps' | 'tasks',
): void {
  switch (type) {
    case 'stakeholders':
      stakeholderMapperOpen.value = true
      return
    case 'resources':
      resourcesSharpenOpen.value = true
      return
    case 'functions':
    case 'values':
    case 'solutions':
    case 'constraints':
      _openSpecEditor({ tab: type })
      return
    case 'evosteps':
      // r41 v362 — jump to Stage 6 (Generate Evo Steps) where confirmedSteps live.
      goToStage(6)
      return
    case 'tasks':
      // r41 v362 — jump to Stage 8 (Tasks) where tasksByStep is edited.
      goToStage(8)
      return
  }
}

function _closeSpecEditor(): void {
  specEditorOpen.value  = false
  _editorTarget.value   = { id: '', name: '' }
  _editorTab.value      = ''
  _editorEntryId.value  = ''
  _editorReturnTo.value = null
}

// r41 v298 (Tom Gilb 2026-06-23 verbatim "stages row and others not present").
// Router from SpecEditorPanel's embedded AgentsStrip pin click to the matching
// agent panel open-ref.  Mirrors the canvas-level AgentsStrip wiring.  Called
// after _closeSpecEditor() (the spec editor saves + unmounts first per
// No-Silent-Data-Loss SUPREME).
function _openAgentFromEditor(agentId: string): void {
  switch (agentId) {
    case 'maria':                 mariaOpen.value = true; break
    case 'contracts':             contractsOpen.value = true; break
    case 'models':                modelLibraryOpen.value = true; break
    case 'stakeholder-mapper':    stakeholderMapperOpen.value = true; break
    case 'evo-step-critique':     evoCritiquerOpen.value = true; break
    case 'plan-importer':         specImporterOpen.value = true; break
    case 'decisions':             decisionMapperOpen.value = true; break
    case 'strategy-agent':        strategyAgentOpen.value = true; break
    case 'incorruptible':         incorruptibleOpen.value = true; break
    case 'incorruptible-sharpen': _launchIncorruptibleSharpeningOnCurrentPlan(); break
    case 'elon':                  elonOpen.value = true; break
    case 'elon-sharpen':          _launchElonSharpeningOnCurrentPlan(); break
    case 'munger':                mungerOpen.value = true; break
    case 'heilmeier':             heilmeierOpen.value = true; break
    case 'feynman':               feynmanOpen.value = true; break
    case 'roles':                 roleAgentOpen.value = true; break
    case 'autoDbo':               autoDboOpen.value = true; break
    default:
      // mode-picker routes through AgentModePicker for multi-mode agents
      // (incorruptible / elon / munger).  Re-use the existing handler.
      onOpenModePicker(agentId as Parameters<typeof onOpenModePicker>[0])
  }
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
const { history: specHistory, addVersion: _addVersionRaw, clearHistory: _clearHistory } = useSpecHistory()

// v514 — Local wrapper: every addVersion call captures the Resources envelope
// alongside the SpecBlock so the resource subsystem travels with the spec.
// Tom Gilb 2026-07-21: "can you promise me that all running estimation data
// is saved and restored with any version of the spec?" — this wrapper closes
// that promise for all 14 in-app call sites transparently.
function addVersion(
  spec: import('./types/spec').SpecBlock,
  label: string,
  plan: import('./types/evo-plan').EvoStepPlan | null = null,
  specName: string = '',
  specOwners: string[] = [],
): void {
  let envelope: ResourcesEnvelope | null = null
  try { envelope = _resourcesEnvelope.captureEnvelope() } catch (err) {
    console.warn('[App.vue addVersion] captureEnvelope failed — SpecVersion saved without resources envelope', err)
  }
  _addVersionRaw(spec, label, plan, specName, specOwners, envelope)
}
const { dismissOops: _dismissOops } = useInputSafetyNet()
const { plan: _evoPlan, confirmPlan: _confirmEvoPlan, fetchPlan: _fetchEvoPlan, loading: _evoPlanLoading, error: _evoPlanError } = useEvoPlan()
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

/**
 * r41 v394 (Tom Gilb 2026-06-27 verbatim "the logged source of these is the
 * 'Suggested Additions' selected by [Whoever is Planner, default Scribe,]
 * Date and Time"): resolve the actor name to stamp on FieldSource records
 * for chips accepted from the Suggested Additions panel.
 *
 * Resolution chain:
 *   1. First Planner with a non-empty name
 *   2. Else first Scribe (default-device-user OR named replacement)
 *   3. Else 'Default User' fallback
 *
 * Passed to SEMEntryForm as the `acceptedSuggestionActor` prop and used by
 * `onImpliedAdd` to build the FieldSource.acceptedBy field.  Reactive — if
 * Tom adds a Planner mid-session, future accepts use the new actor.
 */
const acceptedSuggestionActor = computed<string>(() => {
  const sm = specModel.value
  const planner = sm?.planners?.find(p => p.name?.trim())?.name?.trim()
  if (planner) return planner
  const scribe = sm?.scribes?.find(s => s.name?.trim())?.name?.trim()
  if (scribe) return scribe
  return 'Default User'
})

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
  /** v514 — Resources envelope from the restored SpecVersion.  Optional for
   *  backwards-compat with pre-v514 saved versions (null → resource subsystem
   *  stays at its current state; no silent wipe). */
  resourcesEnvelope: unknown = null,
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

    // v514 — Hydrate the Resources envelope BEFORE addVersion so the new
    // "Restored" SpecVersion captures the just-restored envelope (round-trip
    // fidelity: restore then re-save = same state).  Guarded — hydrate only
    // when the envelope is present + shaped as expected (backwards-compat).
    if (resourcesEnvelope) {
      try {
        _resourcesEnvelope.hydrateEnvelope(resourcesEnvelope as ResourcesEnvelope)
      } catch (envErr) {
        console.warn('[onHistoryRestore] Resources envelope hydrate failed — spec loaded but resource subsystem stayed at current state', envErr)
      }
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
 * Unified History Panel — load a SpecVersion snapshot (sem-spec-history-v1).
 * Called when the user clicks "Load" on a Session Spec row in HistoryPanel.
 * Closes unifiedHistoryOpen, then delegates to onHistoryRestore (which handles
 * currentSpec, markdown, plan model switching, owner reinstatement, and stage).
 * The historyOpen.value = false call inside onHistoryRestore is harmless (it's
 * a different ref — the slide-out history drawer, not the unified panel).
 */
function onUnifiedHistoryLoadSpec(version: SpecVersion): void {
  unifiedHistoryOpen.value = false
  onHistoryRestore(
    version.spec,
    version.plan,
    version.specName ?? (version as unknown as Record<string, string>).planName ?? '',
    version.specOwners ?? (version as unknown as Record<string, string[]>).planOwners ?? [],
    // v514 — envelope round-trip
    version.resourcesEnvelope,
  )
}

/**
 * Tom 2026-05-15: "I actually want to be able to load in files which are the
 * final output from this app!" — when the user imports a .md or .txt file
 * that is recognised as a serialised Planguage spec (by useSpecImport), load
 * it directly into SpecOutput without going through the classifier.
 * Uses the same wiring as onHistoryRestore but without the plan / history
 * overhead — a simple "load this spec as the current working spec".
 */
function onSpecFileImport(spec: SpecBlock, rawMarkdown?: string): void {
  currentSpec.value     = spec
  markdown.value        = serialise(spec)
  specGeneratedAt.value = new Date()
  _ensurePlanModel(spec)
  // v514 — extract + hydrate Resources envelope from the imported markdown
  // (if present).  Envelope is a base64-encoded HTML-comment block; absence
  // is fine (pre-v514 files or bare markdown).  Envelope is hydrated AFTER
  // _ensurePlanModel so planId (derived from spec.name) is stable when the
  // resource composables initialise their per-plan storage keys.
  if (rawMarkdown) {
    try {
      const env = _resourcesEnvelope.extractEnvelopeFromMarkdown(rawMarkdown)
      if (env) {
        _resourcesEnvelope.hydrateEnvelope(env)
        console.info('[onSpecFileImport] Resources envelope hydrated from imported markdown', { estimations: env.estimations?.estimations.length ?? 0 })
      }
    } catch (err) {
      console.warn('[onSpecFileImport] Resources envelope extract/hydrate failed — spec imported without resources', err)
    }
  }
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
    // r93x — Universal Undo P2 sweep: record before mutation
    undoHistory.record({
      label:    'Spec Rewrite: Replaced full spec',
      source:   'SpecImporter',
      prevSpec: JSON.parse(JSON.stringify(currentSpec.value)) as SpecBlock,
      nextSpec: JSON.parse(JSON.stringify(rewritten))         as SpecBlock,
    })
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
  // r93x — Universal Undo P2 sweep: record before mutation
  undoHistory.record({
    label:          `Spec Rewrite: ${payload.id}`,
    source:         'SpecEditor',
    prevSpec:       JSON.parse(JSON.stringify(spec))    as SpecBlock,
    nextSpec:       JSON.parse(JSON.stringify(patched)) as SpecBlock,
    affectedFields: [`${payload.type}.${payload.id}.description`],
  })
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

// --- Plan name + owner name side-channel (Tom 2026-06-08) ---
// Collected upfront in SEMEntryForm; applied in doTranslate after initSpecModel.
const pendingPlanName  = ref<string | null>(null)
const pendingOwnerName = ref<string | null>(null)

// --- Genesis re-parse side-channel (Tom 2026-06-09) ---
// When user clicks "Edit & Re-parse" in SpecOutput, the genesis values are stored here
// so SEMEntryForm can pre-fill them. Cleared once consumed by the form.
const pendingGenesisRepopulate = ref<{ stakes: string; ends: string; means: string } | null>(null)

// --- App session stamp — discrete CET date/time on Plan Crest Row 2 (Tom 2026-06-08) ---
// Computed once at app load; shows when this browser session started.
const appLoadedStamp: string = (() => {
  const d = new Date()
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
    timeZoneName: 'short',
  }).formatToParts(d)
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')} · ${get('hour')}:${get('minute')} ${get('timeZoneName')}`
})()

// --- Spec state ---
// The raw SpecBlock generated from the SEM entry (needed for Evo Plan + Impact Estimation)
//
// r41 v287 (Tom Gilb 2026-06-22 verbatim *"and I dream that you develop tests
// to detect it wonk work at all"* — after THREE consecutive mount crashes
// from the same class.  v232 banked a post-flush watcher; v286 fixed the
// normalizer's no-op bug; v287 closes the remaining race: the watcher fires
// AFTER child components' `watchEffect` + computeds have already dereferenced
// the dirty value during synchronous mount.  Solution: replace `ref` with a
// `customRef` that normalizes SYNCHRONOUSLY at set-time.  Every one of the
// ~30 `currentSpec.value = X` assignment sites in App.vue now writes
// pre-normalized data through this ref — there is no dirty intermediate
// state for any reader to observe.  Idempotent: `_normalizeSpecBlock` is
// safe to call on already-normalized input (returns identical shape).
// Composes with: Trace-Before-Patch SUPREME (v285 patched 4 sites; v286
// fixed the normalizer; v287 fixes the race — three iterations because
// each named one part of the system, not the system); Architectural
// Resilience SUPREME (one set-time gate beats N read-site guards);
// No-Silent-Data-Loss SUPREME (toStr defaults; real values pass through);
// Feature-Invariants-Smoke-Test SUPREME (new invariant locks the customRef
// in place + new mount-smoke pass loads a real-shape stored spec).
const currentSpec = customRef<SpecBlock | null>((track, trigger) => {
  let value: SpecBlock | null = null
  return {
    get() { track(); return value },
    set(v: SpecBlock | null) {
      // Coerce on every assignment — synchronous, before any consumer reads.
      value = v ? _normalizeSpecBlock(v) : null
      trigger()
    },
  }
})

// r41 v39 — Tom Gilb 2026-06-15 "penta did not catch the planguage stuff" —
// `currentSpec` (the App.vue local ref) and `specModel.spec` (the persisted
// SpecModel via useSpecModel composable) can drift apart.  MultiForks /
// useMultiVision read from specModel directly; PentaPanel / many other
// surfaces read from currentSpec through props.  If one is populated and the
// other null, surfaces disagree about whether a spec exists at all.
//
// Reconciliation watcher: whenever the persisted specModel has a spec but
// currentSpec is null, hydrate currentSpec from it.  Non-destructive — only
// fires when one side is empty.  Declared AFTER both refs to avoid a TDZ.
watch([currentSpec, () => specModel.value?.spec], ([curSpec, modelSpec]) => {
  if (!curSpec && modelSpec) {
    console.log('[spec-sync] hydrating currentSpec from specModel.spec')
    currentSpec.value = modelSpec
  }
}, { immediate: true })

// ── Contract → Spec bridge (2026-07-14 bug fix, Tom Gilb verbatim: "I have
//    the indianapolis contract in clearly but when I go to penta no data from
//    a project registers, this is true for some other sub apps").
//
// Contracts mode stores entries in useContractStore (via allEntries derived
// from the active contract's clauses).  PentaPanel / MultiVisionPanel /
// ResourceOptimaPanel — and every other component receiving :spec=
// "currentSpec ?? specModel?.spec" — reads currentSpec, which was NEVER
// populated from the contract store.  ContractHub + HistoryPanel read the
// store directly and worked fine; every other sub-app saw an empty spec.
//
// Direction 1 fix (Tom-approved): watch contractStore.allEntries.  When it
// changes to a non-empty list, shape-convert via contractEntriesToSpec() and
// hydrate currentSpec.  Empty list = no active contract = leave currentSpec
// alone (do not clobber a manually-entered plan spec).  When BOTH a manual
// spec AND a contract are present, the contract wins for now — this matches
// the existing architecture where Contracts mode is the source of truth for
// contract-mode plans.  If Tom needs a merge instead of overwrite, we'll add
// it in a follow-up (the migration path is additive).
//
// No-Silent-Data-Loss: currentSpec is written via App.vue's set-time
// customRef normalizer, so shape drift is impossible; Universal Undo already
// records any watcher-driven mutation IF it flows through the recording
// wrapper — this direct assignment is a system-level hydration, not a user
// edit, so it intentionally skips undo (mirrors the specModel hydration
// watcher above).
// r41 v? (2026-07-14 second-pass fix, Tom Gilb verbatim: "I did cmnd R,
// Indianapolis was in, penta showed no data").  The first-pass watcher above
// keyed on `allEntries` — which is derived from `currentContract` — which is
// null whenever `_currentId` doesn't point at a stored contract.  That happens
// on plan switches when `_planContractMap[planId]` is unset: `applyPlanSwitch`
// nulls `_currentId` and Indianapolis stays visible in ContractHub (which
// reads the raw `contracts` list) but Penta sees an empty spec.
//
// Second-pass fix: read the raw `contracts` list too.  Prefer the "current"
// contract when set; otherwise fall back to the most recently stored contract
// that actually has entries.  This means "if anything is loaded, Penta shows
// it" — which matches Tom's mental model ("I have Indianapolis in").
watch(
  () => {
    const cur = _contractsStoreForPlanSwitch.currentContract.value
    if (cur && cur.clauses.some(cl => cl.entries.length > 0)) return cur
    return _contractsStoreForPlanSwitch.contracts.value.find(
      c => c.clauses.some(cl => cl.entries.length > 0),
    ) ?? null
  },
  (contract) => {
    if (!contract) return
    const entries = contract.clauses.flatMap(cl => cl.entries)
    if (entries.length === 0) return
    console.log(`[contract→spec] hydrating currentSpec from contract "${contract.title}" (${entries.length} entries)`)
    currentSpec.value = contractEntriesToSpec(entries)
  },
  { immediate: true, deep: true },   // deep — pick up newly-parsed clauses/entries
)

// History is saved explicitly at each meaningful action (Generated, Make Ambitious,
// Lean Plan, Restored) — not via a watch, which would fire on session restore and
// on onHistoryRestore, causing duplicate and mislabelled entries.

// Watch currentSpec — one entry per generation session; sharpen rounds update in place.
// null→spec: new spec generated → add a fresh entry and remember its ID.
// spec→spec: spec was sharpened → update the existing entry (name, score, entryCount).
watch(currentSpec, (spec, prevSpec) => {
  if (!spec) {
    // r41 v272 (Tom Gilb 2026-06-22 "after I had loaded with the indy pdf it
    // reverted back to this begining by itself" + "the input window jump and
    // disappears after a small time 10 seconds") — DEFENSIVE BREADCRUMB on
    // currentSpec → null transitions.  Tom can NOT see the stack trace because
    // he doesn't open DevTools (per Do-Not-Outsource-Investigation SUPREME), but
    // the next session/Playwright probe CAN read these breadcrumbs.  Stores last
    // 20 transitions in window._semStateLog so the next investigation has a
    // history of WHEN spec went null + the JS stack of WHO did it.
    if (prevSpec) {
      try {
        const err = new Error('currentSpec → null transition (breadcrumb only)')
        const stack = err.stack ?? '(no stack)'
        const entry = {
          ts: new Date().toISOString(),
          event: 'currentSpec→null',
          prevSpecName: (prevSpec as { plan?: { name?: string } }).plan?.name ?? '(unknown)',
          planningStageAtTransition: planningStage.value,
          stackTop16: stack.split('\n').slice(0, 16).join('\n'),
          isLoading: isLoading.value,
          sdkError: sdkError.value,
        }
        const w = window as unknown as { _semStateLog?: Array<typeof entry> }
        if (!w._semStateLog) w._semStateLog = []
        w._semStateLog.push(entry)
        if (w._semStateLog.length > 20) w._semStateLog.shift()
        // v514 (2026-07-21) — Tom Gilb: "reverted to the beginning without any input, BUG".
        // Persist the last 20 breadcrumbs to localStorage so we can retro-diagnose
        // AFTER refresh (per-tab window._semStateLog is lost on ⌘R).  Tom does not
        // open DevTools (Do-Not-Outsource-Investigation SUPREME) — this makes the
        // stack trace grep-able from Claudian's shell after the fact.  Storage cost
        // is tiny (20 × ~2 KB = 40 KB); silent-fail on quota is fine — the primary
        // window._semStateLog is still live for same-session inspection.
        try { localStorage.setItem('sem-state-log-v1', JSON.stringify(w._semStateLog)) } catch { /* quota */ }
        // Also log to console for live-debugging sessions.
        console.warn('[sem:state] currentSpec → null', entry)
      } catch { /* noop */ }
    }
    return
  }
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
  // Guard: never navigate into Evo stages (≥6) while a sharpening round is active.
  // Sharpening phases 'questions'/'answering'/'refining' mean the AI is working or the
  // user is mid-answer. Jumping to Evo Steps mid-round would lose the in-progress answers
  // and leave the phase stuck. Tom 2026-06-07: "I was in middle of stage 2 sharpening,
  // answered 2 questions, and it jumped to evo stage" — caused by the new single-click
  // stage navigation being too eager during an active sharpen session.
  // Allow stages 1-5 freely (spec stages — reviewing your spec while sharpening is normal).
  if (sharpenPhase.value !== 'idle' && n >= 6) {
    showToast(
      '⚠️ A sharpening round is in progress — finish or cancel it before advancing to Evo Steps.',
      4500,
    )
    return
  }

  // Stage-readiness gate (Tom Gilb 2026-06-19 verbatim: "I am tired of
  // several times a week having to push an example through the stages
  // that skip ahead and do not function").  When the user is advancing
  // FORWARD past a stage whose exit postcondition is unmet, surface a
  // toast naming the missing data.  Warning only — never blocks
  // navigation (DD-007 stages-never-locked) — but the user can no longer
  // advance silently into a downstream stage that will display nothing.
  if (n > planningStage.value) {
    const fromStage = planningStage.value
    const gateReason = checkStageExit(fromStage, currentSpec.value)
    if (gateReason) {
      const fromLabel = STAGE_GATES.find(g => g.stage === fromStage)?.label ?? `Stage ${fromStage}`
      showToast(
        `⚠ Stage ${fromStage} (${fromLabel}) is not complete: ${gateReason}.  Advancing anyway — the next stage may appear empty.`,
        6000,
      )
    }
  }

  planningStage.value = n  // stages never locked (DD-007)

  // r41 v82 (Tom Gilb 2026-06-16 "tried to go st 2, msg stakeholders not
  // defined, but we know that are, please fix bug") — pass actual V. entry
  // count so Stage 3 fires 'values-missing' (honest) instead of 'spec-
  // missing' (which claimed "needs a Spec" even when Tom can SEE his spec
  // on screen).  Defensive diagnostic so we can verify in DevTools what
  // resolveStageNavAction is seeing at click-time vs what Tom is seeing
  // visually.
  const _vCount = currentSpec.value?.values?.length ?? 0
  console.info('[goToStage] n=', n, '· hasCurrentSpec=', !!currentSpec.value, '· valuesCount=', _vCount, '· hasEvoSteps=', confirmedSteps.value.length > 0)
  const { action, toast } = resolveStageNavAction(
    n,
    specEditorOpen.value,
    !!currentSpec.value,
    confirmedSteps.value.length > 0,
    _vCount,
  )

  if (toast !== null) {
    // Use per-stage advisory (explicit reason + what to do) — Tom 2026-06-05
    showToast(getStageAdvisory(n, toast), 5500)
  } else {
    // r41 v241 (Tom Gilb 2026-06-21 verbatim "I moved to stage 2 solutions, and nothing
    // happened, no new solutions generate, no report of completion, There was a sharpening
    // opportunity if I were to take it").  Stage navigation that previously fired NO toast
    // (because the stage was reachable + spec was ready) left Tom looking at unchanged
    // content with no orientation cue.  Now: always announce arrival with a status line +
    // primary-action hint, so the planner has a Report-of-Completion-or-State on every
    // stage hop.  Composes with MOVE Principle SUPREME (visible options) + AI-Max SUPREME
    // (suggest action at every blank moment) + DD-009 Zero-Training UI.
    const stageMeta = PLANNING_STAGES.find(s => s.stage === n)
    if (stageMeta && currentSpec.value) {
      const spec = currentSpec.value
      const fCount = spec.functions?.length ?? 0
      const vCount = spec.values?.length ?? 0
      const sCount = spec.solutions?.length ?? 0
      const cCount = spec.constraints?.length ?? 0
      const summary =
        n === 1 ? `${vCount} Value${vCount !== 1 ? 's' : ''}, ${fCount} Function${fCount !== 1 ? 's' : ''} so far` :
        n === 2 ? `${sCount} Solution${sCount !== 1 ? 's' : ''} for ${vCount} Value${vCount !== 1 ? 's' : ''}` :
        n === 3 ? `${fCount} Function${fCount !== 1 ? 's' : ''} to sharpen` :
        n === 4 ? `${vCount} Value${vCount !== 1 ? 's' : ''} ready to score for impact` :
        n === 5 ? `${cCount} Constraint${cCount !== 1 ? 's' : ''} to refine` :
        n === 6 ? `${sCount} Solution${sCount !== 1 ? 's' : ''}, ${confirmedSteps.value.length} Evo Step${confirmedSteps.value.length !== 1 ? 's' : ''} confirmed` :
        `${fCount + vCount + sCount + cCount} total spec entries`
      const action = planningStageAction.value
      const actionHint = action ? ` · primary action: ${action.label}` : ''
      showToast(`📐 Stage ${n}: ${stageMeta.label} — ${summary}${actionHint}`, 5000)
    }
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
    // r41 v241 (Tom 2026-06-21 "I moved to stage 2 solutions, and nothing happened, no new
    // solutions generate") — Stage 2 IS Solutions per planningStages.ts; previous mapping
    // said "Edit Values" which was stale. Primary action now opens the SpecEditor focused on
    // the Solutions tab so Tom can review / add / sharpen Solutions immediately.
    case 2:  return { label: '[*]→ Open Solutions Editor', handler: () => _openSpecEditor({ tab: 'solutions' }) }
    case 3:  return { label: '✨ Sharpen Spec',         handler: () => { sharpenModalOpen.value = true } }
    case 4:  return { label: '📊 Estimate Impacts',     handler: () => goToImpactStage() }
    case 5:  return { label: '[*] Refine Solutions',    handler: () => _openSpecEditor({ tab: 'solutions' }) }
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

// ── Stage 1 sub-step strip (Tom Gilb 2026-06-19) ─────────────────────────────
// 1.1 Spec Entry → 1.2 Spec Parsing → 1.3 Parse Implied Sharpening →
// 1.4 Planguage Generation → 1.5 Planguage Edit.
// `stage1SubStep` is the CURRENT highlighted step.  `stage1DoneSteps`
// computed from spec / parse state — completed steps render with the
// green ✓ badge in the strip.
const stage1SubStep = ref<Stage1SubStepKey>('1.1')

// r41 v400 (Tom Gilb 2026-06-28 "fix 1.3 and 3.2 and be done"): explicit
// user-intent flag for substep 1.3 (Parse Implied Sharpening).  Same shape
// as v399's `stage2_3UserMarkedDone` — captures the "Done sharpening" click
// regardless of whether any Apply landed inside the panel.  Watcher on
// `parseImpliedSharpeningOpen` is declared AFTER that ref (further down
// the script) because script-setup evaluates top-to-bottom.
const stage1_3UserMarkedDone = ref<boolean>(false)

// r41 v336 (Tom Gilb 2026-06-24 "the yellow for phase 1.1 is still on and we
// are in 1.4 or 1.5"): auto-advance the CURRENT (yellow) sub-step marker as
// the workflow progresses.  Before v336, the marker was stuck at the default
// '1.1' until the planner manually clicked a pill in the strip.  Post-generate
// state showed 1.1 yellow + 1.2 + 1.4 green-done — confusing because the
// planner is clearly past 1.1.  Auto-advance: when a NEW done-step lands AND
// it is LATER in the canonical order than current, move current forward.
// Manual navigation (onStage1SubStepGo) still wins for explicit backward jumps. */
const STAGE1_ORDER: readonly Stage1SubStepKey[] = ['1.1', '1.2', '1.3', '1.4', '1.5'] as const
const stage1DoneSteps = computed<Stage1SubStepKey[]>(() => {
  const done: Stage1SubStepKey[] = []
  // 1.1 Spec Entry — done once a draft text/URL/file has been accepted OR a
  // currentSpec is loaded (the simplest test: anything is in the workspace).
  const hasInput = formSubStage.value === 'review' || !!currentSpec.value
  if (hasInput) done.push('1.1')
  // 1.2 Spec Parsing — done once the parser has produced ANY entries.
  const entryTotal =
    (currentSpec.value?.functions?.length ?? 0) +
    (currentSpec.value?.values?.length ?? 0) +
    (currentSpec.value?.solutions?.length ?? 0) +
    (currentSpec.value?.constraints?.length ?? 0) +
    (currentSpec.value?.resources?.length ?? 0)
  if (entryTotal > 0) done.push('1.2')
  // 1.3 Parse Implied Sharpening — done if the planner has run at least one
  // sharpening round in this session (sharpenRounds counter on the model)
  // OR if the planner explicitly marked 1.3 done by closing the panel.
  // r41 v400 (Tom Gilb 2026-06-28 "fix 1.3 and 3.2 and be done"): propagates
  // the v399 "honour user intent on Done click" pattern to this substep.
  if ((specModel.value?.sharpenRounds ?? 0) > 0 || stage1_3UserMarkedDone.value) done.push('1.3')
  // 1.4 Planguage Generation — done when the spec has REAL F./V./S./C./R.
  // entries (not just the fallback V.ImportedText placeholder).
  const hasReal =
    (currentSpec.value?.functions?.length ?? 0) > 0 ||
    (currentSpec.value?.solutions?.length ?? 0) > 0 ||
    ((currentSpec.value?.values?.length ?? 0) > 0 &&
      !currentSpec.value?.values?.every(v => v.id === 'V.ImportedText'))
  if (hasReal) done.push('1.4')
  // 1.5 Planguage Edit — done once the planner has opened the Spec Editor
  // at least once (specEditorOpen has been true) — proxied here by
  // manualEditCount > 0 on the spec model.
  if ((specModel.value?.manualEditCount ?? 0) > 0) done.push('1.5')
  return done
})

// r41 v336 (Tom Gilb 2026-06-24 "the yellow for phase 1.1 is still on and we
// are in 1.4 or 1.5"): auto-advance the CURRENT (yellow) sub-step marker as
// the workflow progresses.  Before v336, the marker was stuck at the default
// '1.1' until the planner manually clicked a pill in the strip.  Post-generate
// state showed 1.1 yellow + 1.2 + 1.4 green-done — confusing because the
// planner is clearly past 1.1.  Auto-advance: when a NEW done-step lands AND
// it is LATER in the canonical order than current, move current forward.
// Manual navigation (onStage1SubStepGo) still wins for explicit backward jumps.
// MUST be placed AFTER stage1DoneSteps is declared (v336.1 fix — the watcher
// initially landed before the computed, triggering ReferenceError on mount).
watch(() => stage1DoneSteps.value, (done) => {
  if (done.length === 0) return
  let latestDone: Stage1SubStepKey | null = null
  for (const k of STAGE1_ORDER) {
    if (done.includes(k)) latestDone = k
  }
  if (!latestDone) return
  const latestIdx = STAGE1_ORDER.indexOf(latestDone)
  const targetIdx = Math.min(latestIdx + 1, STAGE1_ORDER.length - 1)
  const target = STAGE1_ORDER[targetIdx]
  const currentIdx = STAGE1_ORDER.indexOf(stage1SubStep.value)
  if (targetIdx > currentIdx) {
    stage1SubStep.value = target
  }
  // r41 v338 (Tom Gilb 2026-06-24 "the yellow marker did not work at all"):
  // `immediate: true` is essential — when the page loads with a hydrated
  // spec from localStorage, `stage1DoneSteps` is ALREADY populated at mount
  // and the watch otherwise never fires until the planner mutates the spec.
  // Without immediate, the yellow marker is stuck on '1.1' across refreshes
  // even though done-steps clearly show 1.4/1.5 reached. v336 shipped the
  // logic; v338 actually makes it run.
}, { deep: false, flush: 'post', immediate: true })

/** r41 v303/v304 — Stage 1 stakeholder count helper.
 *
 *  v304 bug fix (Tom Gilb 2026-06-23 "no stakeholders in message but 2
 *  stakeholders just below"): the SpecOutput "N identified" badge counts
 *  stakeholders from TWO paths — structured `spec.stakeholderEntries`
 *  (post-2026-06-09 specs) AND derived from `v.wishStakeholder` (pre-
 *  2026-06-09 fallback / specs whose Stakeholder Mapper has not yet run).
 *  My v303 computeds only checked the structured path, so a Tom-shaped spec
 *  with derived-only stakeholders falsely showed "No Stakeholders" in the
 *  banner while the section below showed "2 identified".  Fix: count the
 *  union via the same two-path logic SpecOutput uses. */
function _stage1StakeholderCount(): number {
  const spec = currentSpec.value
  if (!spec) return 0
  const structuredCount = spec.stakeholderEntries?.length ?? 0
  if (structuredCount > 0) return structuredCount
  // Fallback: count unique non-empty `wishStakeholder` values across Values.
  // Matches SpecOutput.specStakeholderCards' fallback branch exactly.
  const derived = new Set<string>()
  for (const v of (spec.values ?? [])) {
    const w = v.wishStakeholder?.trim()
    if (w && w.length > 0) derived.add(w.toLowerCase())
  }
  return derived.size
}

/** r41 v303 (Tom Gilb 2026-06-23 verbatim "i cannot see here what is done,
 *  what to do, how to move on") — Stage 1 status banner: counts what's in
 *  the spec so the planner sees progress at a glance. */
const _stage1ProgressSentence = computed<string>(() => {
  const spec = currentSpec.value
  if (!spec) return 'No spec yet — paste text, a URL, or upload a file via 1.1 Capture Spec Input to begin.'
  const shCount = _stage1StakeholderCount()
  const vCount  = spec.values?.length ?? 0
  const fCount  = spec.functions?.length ?? 0
  const sCount  = spec.solutions?.length ?? 0
  const cCount  = spec.constraints?.length ?? 0
  const rCount  = spec.resources?.length ?? 0
  const parts: string[] = []
  if (shCount > 0) parts.push(`${shCount} Stakeholder${shCount === 1 ? '' : 's'}`)
  if (vCount  > 0) parts.push(`${vCount} Value${vCount === 1 ? '' : 's'}`)
  if (fCount  > 0) parts.push(`${fCount} Function${fCount === 1 ? '' : 's'}`)
  if (sCount  > 0) parts.push(`${sCount} Solution${sCount === 1 ? '' : 's'}`)
  if (cCount  > 0) parts.push(`${cCount} Constraint${cCount === 1 ? '' : 's'}`)
  if (rCount  > 0) parts.push(`${rCount} Resource${rCount === 1 ? '' : 's'}`)
  if (parts.length === 0) return 'Spec exists but no entries parsed yet.'
  return `✅ ${parts.join(' · ')} captured.`
})

/** r41 v303/v304 — Stage 1 next-action sentence: names ONE concrete next step. */
const _stage1NextActionSentence = computed<string>(() => {
  const spec = currentSpec.value
  if (!spec) return 'Use the entry form below to paste text, drop a URL, or upload a file.'
  const vCount = spec.values?.length ?? 0
  const fCount = spec.functions?.length ?? 0
  const shCount = _stage1StakeholderCount()
  if (vCount === 0 && fCount === 0) {
    return 'Spec is empty of Values + Functions — open the Spec Editor to add them, or re-parse the source.'
  }
  if (shCount === 0) {
    return 'No Stakeholders identified yet — derive them from your Values via the Stakeholder Mapper agent, or add manually in the Spec Editor.'
  }
  if (vCount > 0 && spec.values?.every(v => !v.goal || v.goal.trim().length === 0)) {
    return 'Values have no Goal level set — open the Spec Editor (Values tab) and quantify each Value with Scale + Meter + Goal.'
  }
  return 'Stakes captured — advance to Stage 2 Solutions to generate / sharpen Solutions that deliver these Values.'
})

/** Stage 1.3 Parse Implied Sharpening panel open flag. */
const parseImpliedSharpeningOpen = ref(false)

// r41 v400 — Watcher for 1.3 panel close: same shape as v399's handleSharpenModalDone
// for the 2.3/3.2 surfaces.  Closing the 1.3 panel IS the explicit Done signal —
// captures user intent + advances stage1SubStep to 1.4 + acknowledges via toast.
// Composes with No-Silent-Data-Loss SUPREME (flow-state acknowledgement) + MOVE
// Principle SUPREME (NEXT pointer advances visibly).
watch(parseImpliedSharpeningOpen, (isOpen, wasOpen) => {
  if (wasOpen && !isOpen && planningStage.value === 1 && stage1SubStep.value === '1.3') {
    stage1_3UserMarkedDone.value = true
    stage1SubStep.value = '1.4'
    const n = sharpenRounds.value.length
    if (n > 0) {
      showToast(`🔪 ${n} sharpening round${n !== 1 ? 's' : ''} applied — Stage 1.3 done · advanced to 1.4`, 6000, { label: '[Undo]', handler: handleGlobalUndo })
    } else {
      showToast('🔪 No changes applied this round — Stage 1.3 marked done · advanced to 1.4', 5000)
    }
  }
})

/** Initial Input viewer panel — Tom Gilb 2026-06-19 INITIAL SPECS request. */
const initialInputPanelOpen = ref(false)
const currentInitialInput = computed<InitialInputSnapshot | null>(() => {
  const id = specModel.value?.id
  if (!id) return null
  return getInitialInput(id)
})
function openInitialInputPanel(): void {
  initialInputPanelOpen.value = true
}

// ── Stage 2 sub-step state (Tom Gilb 2026-06-21) ─────────────────────────────
// 2.1 Read In Specs → 2.2 Generate Solutions → 2.3 Sharpen Spec → 2.4 Tools and Agents.
// Mirrors Stage 1 sub-step pattern.  Composes with Stage-Has-A-Purpose SUPREME.
const stage2SubStep = ref<Stage2SubStepKey>('2.1')

// r41 v352 — Stage 2.2 auto-generate-Solutions wiring.  Tom Gilb 2026-06-25
// *"2.2 did not clearly generate solutions, and we need the proof of that
// with the same window we just developed for stage 2 (Name = Planguage
// Progress window)"*.  The handler `runStage22GenerateSolutions` mounts
// the PlanguageProgressWindow modal as the visible receipt while the AI
// drafts one Solution per unaddressed Value (per Solution Parameters
// SUPREME 7-Tier-1 minimum field set), then lands the result via
// Universal Undo.  Composable: `useGenerateSolutions(currentSpec)`.
const _genSolutions = useGenerateSolutions(currentSpec)
const stage22ProgressWindowOpen = ref(false)

async function runStage22GenerateSolutions(): Promise<void> {
  if (!currentSpec.value) {
    showToast('No spec loaded — generate a spec at Stage 1 first.', 4000)
    return
  }
  const targetCount = _genSolutions.unaddressedCount.value
  if (targetCount === 0) {
    showToast('All Values already have at least one linked Solution — nothing to generate.  Open Sharpen (2.3) to refine existing Solutions.', 6000)
    return
  }
  stage22ProgressWindowOpen.value = true
  showToast(`Generating ${targetCount} Solution${targetCount === 1 ? '' : 's'} for unaddressed Value${targetCount === 1 ? '' : 's'}…`, 3000)
  try {
    const generated = await _genSolutions.generate()
    if (generated.length === 0) {
      const errMsg = _genSolutions.error.value || 'Generation produced no Solutions.'
      showToast(`Stage 2.2 — ${errMsg}`, 7000)
      return
    }
    // Merge generated Solutions into the spec via Universal Undo.
    const prevSpec = JSON.parse(JSON.stringify(currentSpec.value)) as SpecBlock
    const nextSpec: SpecBlock = JSON.parse(JSON.stringify(currentSpec.value)) as SpecBlock
    nextSpec.solutions = [...(nextSpec.solutions ?? []), ...generated]
    undoHistory.record({
      label:    `Stage 2.2 Auto-Generate · ${generated.length} Solution${generated.length === 1 ? '' : 's'}`,
      source:   'Stage22GenerateSolutions',
      prevSpec,
      nextSpec,
      affectedFields: generated.map(s => `solutions.${s.id}`),
    })
    currentSpec.value = nextSpec
    if (specModel.value) saveSpecSnapshot(nextSpec)
    showToast(`Stage 2.2 — Generated ${generated.length} Solution${generated.length === 1 ? '' : 's'} for unaddressed Value${generated.length === 1 ? '' : 's'}.`, 6000)
  } finally {
    // Keep the window open briefly so the final count is visible before
    // dismissing (the planner sees the counter tile update to the new
    // total).  3s — enough to register; short enough not to block.
    setTimeout(() => { stage22ProgressWindowOpen.value = false }, 3000)
  }
}
// r41 v399 (Tom Gilb 2026-06-28 verbatim "I said done sharpening, then it
// should have move to show me results of sharpening, but it want to
// sharpening"): explicit user-intent flag for 2.3.  Previously 2.3 was only
// marked done when `specModel.sharpenRounds > 0` — that increments per
// APPLY action inside the modal, NOT on "Done sharpening" click.  If Tom
// reviews the spec, decides nothing needs sharpening, and clicks Done, the
// substep stayed marked active because no Apply fired.  Tom's mental model:
// "Done sharpening" = "I'm done with 2.3" regardless of changes.  This flag
// captures that intent immediately; `stage2DoneSteps` honours it; the NEXT
// pointer advances to 2.4.
const stage2_3UserMarkedDone = ref<boolean>(false)

const stage2DoneSteps = computed<Stage2SubStepKey[]>(() => {
  const done: Stage2SubStepKey[] = []
  const spec = currentSpec.value
  if (!spec) return done
  // 2.1 done — Spec exists in workspace (planner can read it).
  done.push('2.1')
  // 2.2 done — at least one Solution exists in the spec (the work of Stage 2).
  if ((spec.solutions?.length ?? 0) > 0) done.push('2.2')
  // 2.3 done — at least one sharpen round has run OR user explicitly marked
  // 2.3 done via "Done sharpening" click (Tom 2026-06-28 — v399).
  if ((specModel.value?.sharpenRounds ?? 0) > 0 || stage2_3UserMarkedDone.value) done.push('2.3')
  // 2.4 Tools — never tracked as "done"; zero-or-more cycles, always available
  //   as an OPTIONAL action per the Done/You Can/Continue SUPREME rule.
  // 2.5 Agents — same; v404 split per Tom Gilb 2026-06-28.  Both Tools and
  //   Agents stay in the YOU CAN list permanently until the planner clicks
  //   Continue to Stage 3 (skip).  Composes with Stages-are-Cyclic SUPREME.
  return done
})

function onStage2SubStepGo(target: Stage2SubStepKey): void {
  stage2SubStep.value = target
  switch (target) {
    case '2.1':
      // Read In Specs — open the Spec Editor on the Solutions tab so the
      // planner sees what is currently in the plan (the "review the spec"
      // entry point Tom asked for).
      _openSpecEditor({ tab: 'solutions' })
      showToast('2.1 — Read In Specs · Spec Editor open on Solutions tab', 2800)
      break
    case '2.2':
      // r41 v352 (Tom Gilb 2026-06-25 *"2.2 did not clearly generate
      // solutions, and we need the proof of that with the same window we
      // just developed for stage 2 (Name = Planguage Progress window)"*):
      // 2.2 now ACTUALLY generates Solutions via useGenerateSolutions.
      // The PlanguageProgressWindow opens as the visible receipt; the AI
      // drafts one Solution per unaddressed Value with Tier-1 26-parameter
      // fields populated; results merge through Universal Undo.  The
      // Sharpen modal remains available at 2.3 for the deeper Q&A path.
      void runStage22GenerateSolutions()
      break
    case '2.3':
      // Sharpen Spec — open the Sharpen modal (full-spec scope).
      sharpenModalOpen.value = true
      showToast('2.3 — Sharpen the entire set of specs', 2800)
      break
    case '2.4':
      // r41 v404 (Tom Gilb 2026-06-28 "agents were not a group in the menu"):
      // 2.4 is now TOOLS ONLY (Penta, Multivision, Value Flow).  Opens the
      // Actions menu pointed at the Tools section.  Agents moved to 2.5.
      menuOpen.value = true
      showToast('2.4 — Apply visualisation Tools (Penta, Multivision, Value Flow). Agents are at 2.5.', 3500)
      break
    case '2.5':
      // r41 v404 — NEW. Agents as a distinct group per Tom.  Opens the
      // Actions menu where the planner can pick from Munger / Heilmeier /
      // Feynman / Elon / Incorruptible / Roles / Auto-DBO.  The Agents
      // Strip pin cluster at the top of the page also exposes every Agent
      // for one-click access.
      menuOpen.value = true
      showToast('2.5 — Apply analytical Agents (Munger, Heilmeier, Feynman, Elon, Incorruptible, Roles, Auto-DBO). The Agents Strip above also has every agent one-click.', 4500)
      break
  }
}

function onStage2ContinueToStage3(): void {
  // Tom Gilb 2026-06-21 verbatim: "allow the option of MOving to the next
  // stage (we can come back here, and we can refine with tools and agents
  // at later stages)".  Advances planningStage to 3 (Sharpen).
  handleStageBarNav(3)
}

// ── Stage 4 sub-step state (Tom Gilb 2026-06-21 — Reasonable Balance) ────────
// 4.1 Look at Estimates → 4.2 Adjust → 4.3 Approve → 4.4 Tools and Agents → 4.5 Move to Stage 5.
// Mirrors Stage 2 sub-step pattern.  Composes with rule_stage_4_impacts_design.md SUPREME.
// Phase 1 implementation: routes each sub-step to its existing canonical surface;
// Phase 2+ builds the Evidence/Source/Credibility data model + Estimates Approval flow +
// Tools-and-Agents table + IET Settings Panel.
const stage4SubStep = ref<Stage4SubStepKey>('4.1')
// r41 v252 — declared BEFORE stage4DoneSteps because the computed references it.
// (Vue 3 <script setup> evaluates declarations top-down; a computed that closes over a
// later-declared ref will hit ReferenceError at first access.  Move-not-mirror.)
const estimatesApprovalCount = ref(0)  // count of Estimates Versions approved this session
const stage4DoneSteps = computed<Stage4SubStepKey[]>(() => {
  const done: Stage4SubStepKey[] = []
  if (!currentSpec.value) return done
  // 4.1 done — Spec + IET exist (planner can look).
  if ((currentSpec.value.solutions?.length ?? 0) > 0 && (currentSpec.value.values?.length ?? 0) > 0) {
    done.push('4.1')
  }
  // 4.2 done — at least one Estimate has been recorded (impactMatrix has entries).
  //  (impactMatrix telemetry available in Phase 2 — for now, mark when planner has visited 4.2)
  // 4.3 done — at least one Estimates Version approved this session (v252).
  if (estimatesApprovalCount.value > 0) done.push('4.3')
  // 4.4 — Tools / Agents — no precise tracking yet (Phase 2 telemetry).
  return done
})

// ── Stage 4 Phase 2 modal state (Tom Gilb 2026-06-21) ────────────────────────
// 4.3 Estimates Approval Panel; 4.4 Tools-and-Agents Table.  Phase 2+ build of
// rule_stage_4_impacts_design.md SUPREME.  Note: estimatesApprovalCount is
// hoisted above to be declared BEFORE stage4DoneSteps that references it.
const estimatesApprovalOpen = ref(false)
const stage4ToolsTableOpen  = ref(false)

// ── Stage 6 sub-step modal state (Tom Gilb 2026-06-23 — r41 v302) ────────────
// 6.2 Prioritise · 6.3 Sharpen Steps · 6.4 Tools and Agents.
const stage6PrioritiseOpen      = ref(false)
const stage6SharpenStepsOpen    = ref(false)
const stage6ToolsAndAgentsOpen  = ref(false)

// r41 v256 — scroll the IET into view after Stage 4 navigation.  Tom Gilb 2026-06-21
// verbatim "look at estimates, except they are not here now" — IET was rendering off-
// screen; scrollIntoView({behavior:'smooth', block:'start'}) brings it into the
// viewport.  Wrapped in nextTick + small delay so the v-if reactively mounts the IET
// before the scroll fires.
function scrollIetIntoView(): void {
  nextTick(() => {
    setTimeout(() => {
      const el = ietWrapperEl.value
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 80)
  })
}

// r41 v262 — scroll the EvoPlanView into view after Stage 6 navigation (mirrors v256 IET).
function scrollEvoPlanIntoView(): void {
  nextTick(() => {
    setTimeout(() => {
      const el = evoPlanWrapperEl.value
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 120)  // longer delay than IET because EvoPlanView often kicks an async fetch on mount
  })
}

function onStage4SubStepGo(target: Stage4SubStepKey): void {
  stage4SubStep.value = target
  switch (target) {
    case '4.1':
      // Look at Estimates + Evidence — open the IET via the canonical action,
      // then scroll it into view (the v255 strip is visible at top but the IET
      // was rendering below the fold; Tom Gilb 2026-06-21 "they are not here now").
      goToImpactStage()
      scrollIetIntoView()
      showToast('4.1 — Look at Estimates · Evidence + Source + Credibility', 2800)
      break
    case '4.2':
      // Adjust — same IET surface; edits inline.
      goToImpactStage()
      scrollIetIntoView()
      showToast('4.2 — Adjust individual + total estimates', 2800)
      break
    case '4.3':
      // r41 v252 — Approve Estimates: open EstimatesApprovalPanel.  Creates an
      // Estimates Version with identity + date + time + remarks/caveats per Tom
      // Gilb 2026-06-21 verbatim.  Composes with Universal Undo + useSpecHistory.
      estimatesApprovalOpen.value = true
      break
    case '4.4':
      // r41 v252 — Tools and Agents: open the dedicated Stage 4 table panel
      // (Penta / Multivision / Value Flow / Compare / Spec Health / Munger /
      // Maria / Elon / Incorruptible / Spec Agent — with how-this-helps).
      stage4ToolsTableOpen.value = true
      break
    case '4.5':
      // Move to Stage 5 (Refine).  You can return to Stage 4 anytime.
      handleStageBarNav(5)
      break
  }
}

// r41 v252 — Approve estimates → persist as Estimates Version via useSpecHistory.
function onEstimatesApproved(record: EstimatesApproval): void {
  if (!currentSpec.value) {
    showToast('⚠ No spec to approve — generate at Stage 1 first.', 3500)
    estimatesApprovalOpen.value = false
    return
  }
  const nickname = record.nickname ? ` "${record.nickname}"` : ''
  const remarks  = record.remarks  ? ` · ${record.remarks.slice(0, 80)}${record.remarks.length > 80 ? '…' : ''}` : ''
  const label    = `Estimates Approved · ${record.identity}${nickname}${remarks}`
  try {
    addVersion(
      currentSpec.value,
      label,
      _evoPlan.value as EvoStepPlan | null,
      specModel.value?.name ?? '',
      _specOwnerNames(),
    )
    estimatesApprovalCount.value++
    estimatesApprovalOpen.value = false
    showToast(`✅ Estimates Version approved by ${record.identity} — saved to history`, 4500)
  } catch (err) {
    console.warn('[onEstimatesApproved] addVersion failed:', err)
    showToast(`⚠ Approval saved in-session but persistence failed — ${err instanceof Error ? err.message : 'localStorage may be full'}`, 5500)
  }
}

// ── Stage 5 sub-step state (Tom Gilb 2026-06-21 — Refine Re-design) ──────────
// 5.1 Reduce Resources → 5.2 More Value Same Cost → 5.3 Reduce Risks →
// 5.4 Relax Constraints → 5.5 Approve Solution Set (Exit Process).
// Phase 1: 5.1-5.4 route to existing Sharpen modal (placeholder until per-sub-
// phase toolbox lands in Phase 2); 5.5 opens the approval panel with
// panelKind="solutions" (reuses v252 EstimatesApprovalPanel).
// solutionSetApprovalCount declared BEFORE stage5DoneSteps per the v252 lesson
// (Vue 3 <script setup> evaluates top-down; computed closing over a later-
// declared ref hits ReferenceError at first access).
const solutionSetApprovalCount = ref(0)
const stage5SubStep = ref<Stage5SubStepKey>('5.1')
const stage5DoneSteps = computed<Stage5SubStepKey[]>(() => {
  const done: Stage5SubStepKey[] = []
  if (!currentSpec.value) return done
  // 5.1-5.4 — no precise telemetry yet; Phase 2 adds per-sub-phase tracking.
  // 5.5 done — at least one Solution Set Version approved this session (v253).
  if (solutionSetApprovalCount.value > 0) done.push('5.5')
  return done
})

const solutionSetApprovalOpen = ref(false)

function onStage5SubStepGo(target: Stage5SubStepKey): void {
  stage5SubStep.value = target
  switch (target) {
    case '5.1':
      // Reduce Resources — Phase 1 routes to Sharpen modal; Phase 2 adds the
      // per-sub-phase resource-reduction tool palette.
      sharpenModalOpen.value = true
      showToast('5.1 — Reduce Resources by re-design · Re-design = change · delete · add', 3500)
      break
    case '5.2':
      sharpenModalOpen.value = true
      showToast('5.2 — More Value at same cost · re-designs that lift Value/Cost ratio', 3500)
      break
    case '5.3':
      sharpenModalOpen.value = true
      showToast('5.3 — Reduce Risks · iterate on Solution Tier-2 risks + sideEffects', 3500)
      break
    case '5.4':
      sharpenModalOpen.value = true
      showToast('5.4 — Relax Constraints + Qualifiers (when / where / who) — temporary or permanent', 3800)
      break
    case '5.5':
      // Approve Solution Set — opens the approval panel with panelKind="solutions".
      // Per Tom 2026-06-21 verbatim: approval is PLANNER-level (not Owner-level).
      solutionSetApprovalOpen.value = true
      break
  }
}

// r41 v253 — Approve Solution Set → persist as Solution Set Version via useSpecHistory.
function onSolutionSetApproved(record: EstimatesApproval): void {
  if (!currentSpec.value) {
    showToast('⚠ No spec to approve — generate at Stage 1 first.', 3500)
    solutionSetApprovalOpen.value = false
    return
  }
  const nickname = record.nickname ? ` "${record.nickname}"` : ''
  const remarks  = record.remarks  ? ` · ${record.remarks.slice(0, 80)}${record.remarks.length > 80 ? '…' : ''}` : ''
  const authority = record.approvalAuthority ?? 'planner'
  const label = `Solution Set Approved (${authority}) · ${record.identity}${nickname}${remarks}`
  try {
    addVersion(
      currentSpec.value,
      label,
      _evoPlan.value as EvoStepPlan | null,
      specModel.value?.name ?? '',
      _specOwnerNames(),
    )
    solutionSetApprovalCount.value++
    solutionSetApprovalOpen.value = false
    showToast(`✅ Solution Set Version approved by ${record.identity} (${authority}-level) — saved to history`, 4500)
  } catch (err) {
    console.warn('[onSolutionSetApproved] addVersion failed:', err)
    showToast(`⚠ Approval saved in-session but persistence failed — ${err instanceof Error ? err.message : 'localStorage may be full'}`, 5500)
  }
}

// ── Stages 3 / 6 / 8 / 9 sub-step state (Tom Gilb 2026-06-21 "plough through") ─
// Per the v254 generic strip pattern, each new stage gets a current+done state +
// a handler that routes each sub-step to its existing canonical surface.  Phase 2+
// builds per-sub-phase toolboxes + the AI-driven flows promised in each long-hint.
const stage3SubStep = ref<Stage3SubStepKey>('3.1')
// r41 v400 (Tom Gilb 2026-06-28 "fix 1.3 and 3.2 and be done"): v399 pattern
// propagated — explicit user-intent flag for 3.2 so the substep advances on
// "Done sharpening" click even when no Apply landed inside the modal.
const stage3_2UserMarkedDone = ref<boolean>(false)
const stage3DoneSteps = computed<Stage3SubStepKey[]>(() => {
  const done: Stage3SubStepKey[] = []
  if (!currentSpec.value) return done
  if ((specModel.value?.sharpenRounds ?? 0) > 0 || stage3_2UserMarkedDone.value) done.push('3.2')
  return done
})
function onStage3SubStepGo(target: Stage3SubStepKey): void {
  stage3SubStep.value = target
  switch (target) {
    case '3.1': specHealthStatusOpen.value = true; showToast('3.1 — Inventory gaps via Plan Health audit', 3000); break
    case '3.2': sharpenModalOpen.value = true;     showToast('3.2 — Sharpen Entries · AI-assisted interview', 3000); break
    case '3.3':
      // r41 v373 (Tom Gilb 2026-06-27 *"the add qualifiers stage does not
      // offer any process for doing that. I suggest 2 rounds. 1. A default
      // set of qualifiers for everything..."*): Stage 3.3 now opens the
      // Add Qualifiers Flow modal — Round 1 (mechanical defaults shown
      // instantly + AI refines per-entry from plan context in background)
      // + Round 2 (per-entry edit).  Round 3 (multi-set additional Levels
      // per r93kkk) banked for next session.  Sharpen modal still reachable
      // at 3.2 for the deeper Q&A path.
      addQualifiersFlowOpen.value = true
      showToast('3.3 — Add Qualifiers · mechanical defaults shown; AI refines from your plan context', 3500)
      break
    case '3.4': sharpenModalOpen.value = true;     showToast('3.4 — Review + Apply sharpening proposals', 3000); break
    case '3.5': handleStageBarNav(4); break
  }
}

const stage6SubStep = ref<Stage6SubStepKey>('6.1')
const stage6DoneSteps = computed<Stage6SubStepKey[]>(() => {
  const done: Stage6SubStepKey[] = []
  if (!currentSpec.value) return done
  if (confirmedSteps.value.length > 0) { done.push('6.1', '6.5') }
  return done
})
function onStage6SubStepGo(target: Stage6SubStepKey): void {
  stage6SubStep.value = target
  switch (target) {
    // r41 v262 (Tom Gilb 2026-06-21 "where is it? how do we proceed? why can it just do it
    // and announce it is done") — 6.1 now AUTO-FIRES generation + scrolls EvoPlanView into
    // view + announces completion via toast.  No hunt for the EvoPlanner — clicking 6.1 IS
    // the EvoPlanner invocation.  Composes with AI-Max SUPREME + MOVE Principle + Stage-
    // Has-A-Purpose SUPREME.
    case '6.1':
      showToast('⚡ 6.1 — Generating Evo Steps from your Solution Set… (Claudian working; result will appear below)', 5000)
      void _triggerEvoGeneration()
      scrollEvoPlanIntoView()
      break
    // r41 v302 (Tom Gilb 2026-06-23 autonomous backlog) — Stage 6 sub-step
    // surfaces 6.2 / 6.3 / 6.4 mounted as focused modal panels.  When an Evo
    // plan exists, clicking the sub-step OPENS the matching panel.  When no
    // plan exists, the legacy navigation + notification path runs so the
    // planner is guided to Stage 6.1 first.
    case '6.2':
      if (confirmedSteps.value.length > 0) {
        stage6PrioritiseOpen.value = true
      } else {
        goToStage2(); scrollEvoPlanIntoView()
        showToast('6.2 — Generate Evo Steps first (6.1) so you have something to prioritise.', 3500)
      }
      break
    case '6.3':
      if (confirmedSteps.value.length > 0) {
        stage6SharpenStepsOpen.value = true
      } else {
        goToStage2(); scrollEvoPlanIntoView()
        showToast('6.3 — Generate Evo Steps first (6.1), then sharpen each one.', 3500)
      }
      break
    case '6.4':
      stage6ToolsAndAgentsOpen.value = true
      break
    case '6.5': handleStageBarNav(7); break
  }
}

const stage8SubStep = ref<Stage8SubStepKey>('8.1')
const stage8DoneSteps = computed<Stage8SubStepKey[]>(() => {
  const done: Stage8SubStepKey[] = []
  if (!currentSpec.value) return done
  if (confirmedSteps.value.length > 0) done.push('8.1')
  return done
})
function onStage8SubStepGo(target: Stage8SubStepKey): void {
  stage8SubStep.value = target
  switch (target) {
    case '8.1': goToTasksStage(); showToast('8.1 — Decompose each Evo Step into Tasks', 3000); break
    case '8.2': goToTasksStage(); showToast('8.2 — Estimate Task effort in hours/days (no story points — banned)', 3500); break
    case '8.3': goToTasksStage(); showToast('8.3 — Assign + sequence Tasks per Implementation Responsible', 3500); break
    case '8.4': handleStageBarNav(9); break
  }
}

const stage9SubStep = ref<Stage9SubStepKey>('9.1')
const stage9DoneSteps = computed<Stage9SubStepKey[]>(() => {
  // Phase 2 — telemetry on actuals capture + estimate-diff + spec-update events.
  return []
})
function onStage9SubStepGo(target: Stage9SubStepKey): void {
  stage9SubStep.value = target
  switch (target) {
    case '9.1': showToast('9.1 — Measure Actuals · record real Values + Costs from latest delivery (Phase 2 deep build)', 4500); break
    case '9.2': showToast('9.2 — Compare actuals vs Stage 4 Estimates Version (Phase 2)', 4500); break
    case '9.3': _openSpecEditor({}); showToast('9.3 — Update real Values + Costs in spec (every change is Undo-able)', 4500); break
    case '9.4': showToast('9.4 — Decide next cycle: continue Evo / return to Stage 4 (re-estimate) / return to Stage 5 (re-design)', 5000); break
    case '9.5': handleStageBarNav(10); break
  }
}

// r41 v252 — Tools-and-Agents table dispatcher.  Maps each tool key to its
// existing canonical surface so Stage 4 sub-step 4.4 wires into the rest of
// the app without inventing new surfaces.
function onStage4ToolInvoke(key: Stage4ToolKey): void {
  stage4ToolsTableOpen.value = false
  switch (key) {
    case 'penta':         menuOpen.value = true; showToast('Penta — open via Actions palette', 2400); break
    case 'multivision':   multiVisionOpen.value = true; break
    case 'value-flow':    visualiseOpen.value = true; break
    case 'compare':       comparisonMode.value = true; break
    case 'spec-health':   specHealthStatusOpen.value = true; break
    case 'munger':        showToast('Munger agent — invoke via the Agents row at the top (Munger pin).', 3500); break
    case 'heilmeier':     showToast('Heilmeier agent — invoke via the Agents row at the top (Heilmeier pin).', 3500); break
    case 'roles':         showToast('Role agent — invoke via the Agents row at the top (Roles pin).', 3500); break
    case 'maria':         showToast('Maria agent — invoke via the Agents row at the top (Maria pin).', 3500); break
    case 'elon':          showToast('Elon agent — invoke via the Agents row at the top (Elon pin).', 3500); break
    case 'incorruptible': showToast('Incorruptible agent — invoke via the Agents row at the top (Incorrupt pin).', 3500); break
    case 'spec-agent':    showToast('Spec Agent — invoke via the Agents row at the top (Spec Agent pin).', 3500); break
  }
}

// r41 v302 (Tom Gilb 2026-06-23 autonomous backlog) — Stage 6 sub-step handlers.
// Apply paths record undoHistory BEFORE mutation per Universal Undo SUPREME.

function onStage6PrioritiseApply(newOrder: EvoStep[]): void {
  undoHistory.record({
    label:     'Stage 6.2 — Prioritise Evo Steps',
    source:    'Stage6PrioritisePanel',
    prevSpec:  currentSpec.value ? structuredClone(currentSpec.value) : null,
    nextSpec:  currentSpec.value ? structuredClone(currentSpec.value) : null,
  })
  confirmedSteps.value = newOrder
  stage6PrioritiseOpen.value = false
  showToast('✅ 6.2 — Evo Step priority order applied (⌘Z to undo)', 3500)
}

function onStage6SharpenStepsApply(updated: EvoStep[]): void {
  undoHistory.record({
    label:     'Stage 6.3 — Sharpen Evo Steps',
    source:    'Stage6SharpenStepsPanel',
    prevSpec:  currentSpec.value ? structuredClone(currentSpec.value) : null,
    nextSpec:  currentSpec.value ? structuredClone(currentSpec.value) : null,
  })
  confirmedSteps.value = updated
  stage6SharpenStepsOpen.value = false
  showToast('✅ 6.3 — Evo Step sharpening applied (⌘Z to undo)', 3500)
}

function onStage6ToolInvoke(key: Stage6ToolKey): void {
  stage6ToolsAndAgentsOpen.value = false
  switch (key) {
    case 'penta':         menuOpen.value = true; showToast('Penta — open via Actions palette', 2400); break
    case 'multivision':   multiVisionOpen.value = true; break
    case 'value-flow':    visualiseOpen.value = true; break
    case 'iet':           handleStageBarNav(4); showToast('Stage 4 Impact Estimation Table — review per-step Value × Cost estimates', 3500); break
    case 'optima':        optimaOpen.value = true; break
    case 'evo-critiquer': evoCritiquerOpen.value = true; break
    case 'evo-sharp':     evoSharpOpen.value = true; break
    case 'munger':        showToast('Munger agent — invoke via the Agents row at the top (Munger pin).', 3500); break
    case 'maria':         showToast('Maria agent — invoke via the Agents row at the top (Maria pin).', 3500); break
  }
}

function onStage1SubStepGo(target: Stage1SubStepKey): void {
  stage1SubStep.value = target
  // Route the planner to the canonical surface for the chosen sub-step.
  // Each branch resolves to the existing primary affordance — the strip
  // becomes a real navigator instead of just a status indicator.
  switch (target) {
    case '1.1':
      // Spec Entry — open the Get-A-Spec import panel (Read In tab).
      specInputOpen.value = true
      showToast('1.1 — Capture Spec Input · paste, fetch a URL, or upload a file', 2200)
      break
    case '1.2':
      // Spec Parsing — same panel; the Parse button is the primary action.
      specInputOpen.value = true
      showToast('1.2 — Parse to S·E·M · click 🔍 Parse as Planguage Spec', 2500)
      break
    case '1.3':
      // Parse Implied Sharpening — open the dedicated review panel.
      if (!currentSpec.value) {
        showToast('1.3 — needs entries first.  Run 1.1 + 1.2.', 3000)
        specInputOpen.value = true
        break
      }
      parseImpliedSharpeningOpen.value = true
      break
    case '1.4':
      // Planguage Generation — focus the result banner in the import panel.
      specInputOpen.value = true
      showToast('1.4 — Generate Planguage Spec · review the result banner', 2500)
      break
    case '1.5':
      // Planguage Edit — open the Spec Editor.
      if (!currentSpec.value) {
        showToast('1.5 — needs a spec first.  Run 1.1 → 1.4.', 3000)
        specInputOpen.value = true
        break
      }
      specEditorOpen.value = true
      break
  }
}

/**
 * r41 v417 (Tom Gilb 2026-07-01 "please continue backlog" — audit-backlog
 * item #2: Stage 1 task-centric workspace per Stage-Has-A-Purpose SUPREME):
 * action handler for the StageTaskWorkspace pins.  Routes each action key
 * to the CANONICAL existing surface (import panel / spec editor / sharpen
 * flow / etc.).  No new surfaces built — this workspace surfaces the
 * task-shape of Stage 1 while every action delegates to the affordance
 * that already exists (No-Silent-Removal SUPREME).  Composes with
 * onStage1SubStepGo (sub-step routing) — the workspace ships alongside
 * the sub-step strip, not replacing it.
 */
function onStage1WorkspaceAction(key: 'capture' | 'generate-spec' | 'import-contract' | 'sharpen' | 'edit'): void {
  switch (key) {
    case 'capture':
      // Capture: open the Get-A-Spec import panel on the paste tab
      specInputOpen.value = true
      showToast('Capture — paste, fetch a URL, or upload a file with your stakes / ends / means input', 2500)
      break
    case 'generate-spec':
      // Generate Planguage spec — same panel, focus the generation banner
      specInputOpen.value = true
      showToast('Generate Spec — click 🔍 Parse as Planguage Spec inside the panel to generate F./V./S./C./R. entries', 3000)
      break
    case 'import-contract':
      // Import contract — open the Contracts agent (pre-existing surface)
      _openAgentByKey('contracts')
      break
    case 'sharpen':
      // Sharpen — canonical Sharpen Plan flow
      if (!currentSpec.value) {
        showToast('Sharpen needs entries first.  Try Capture or Generate first.', 3000)
        specInputOpen.value = true
        break
      }
      handleSharpenPlan()
      break
    case 'edit':
      // View / Edit spec — Spec Editor (under-the-hood surfaced explicitly)
      if (!currentSpec.value) {
        showToast('The Spec Editor opens once entries exist.  Try Capture or Generate first.', 3000)
        specInputOpen.value = true
        break
      }
      _openSpecEditor({})
      break
  }
}

/**
 * r41 v417 — Stage 1 action registry consumed by StageTaskWorkspace.
 * Ordered by expected planner flow: Capture → Generate → Sharpen → Edit
 * (Import Contract is the alternate first-step for planners who have a
 * contract to work from).  Registry lives in App.vue rather than a data
 * module because the disabled-reason strings need currentSpec reactivity —
 * data modules can't hold reactive state.
 */
const stage1WorkspaceActions = computed(() => {
  const hasSpec = !!currentSpec.value
  const hasEntries =
    (currentSpec.value?.values?.length ?? 0) +
    (currentSpec.value?.functions?.length ?? 0) +
    (currentSpec.value?.solutions?.length ?? 0) > 0
  return [
    {
      key: 'capture' as const,
      glyph: '📥',
      label: 'Capture Input',
      shortHint: 'Paste stakes / ends / means text — the starting point',
      longHint: 'Opens the Get-A-Spec import panel where you paste, fetch a URL, or upload a file.  This is the FIRST action of Stage 1 — Stakes / Ends / Means text is what the spec is generated FROM.',
      tone: hasEntries ? 'secondary' as const : 'primary' as const,
      badge: hasEntries ? '✓ Done' : undefined,
    },
    {
      key: 'generate-spec' as const,
      glyph: '⚡',
      label: 'Generate Spec',
      shortHint: 'AI turns your text into Planguage F./V./S./C./R. entries',
      longHint: 'Runs the Planguage generation pipeline over your captured input.  Produces Stakeholders + Values + Functions + Solutions + Constraints as structured entries.  Every entry is Undo-able.',
      tone: hasSpec ? 'secondary' as const : 'ai' as const,
      badge: hasSpec ? `${(currentSpec.value?.values?.length ?? 0)}V·${(currentSpec.value?.functions?.length ?? 0)}F·${(currentSpec.value?.solutions?.length ?? 0)}S` : undefined,
      disabled: !hasSpec && !originalInput.value,
      disabledReason: 'Capture Input first — the AI needs your stakes / ends / means text to generate a spec.',
    },
    {
      key: 'import-contract' as const,
      glyph: '📄',
      label: 'Import Contract',
      shortHint: 'Parse a contract into a Planguage spec (Contracts Agent)',
      longHint: 'Opens the Contracts Agent — parses a contract document (PDF or text) into structured Planguage entries + remembers the contract for later reruns.  Alternative first-step when you have a contract, not free-form text.',
      tone: 'secondary' as const,
    },
    {
      key: 'sharpen' as const,
      glyph: '🔪',
      label: 'Sharpen Existing',
      shortHint: 'Ask category-scoped questions that refine entries',
      longHint: 'Opens the canonical Sharpen Plan flow.  Pick a category (Risks / Innovation / Governance / etc.); the AI proposes questions; your answers refine the affected entries.  Every fix is Source-stamped + Undo-able.',
      tone: 'secondary' as const,
      disabled: !hasEntries,
      disabledReason: 'Sharpening needs entries — Capture + Generate first.',
    },
    {
      key: 'edit' as const,
      glyph: '✎',
      label: 'View / Edit Spec',
      shortHint: 'Open the Spec Editor — the under-the-hood surface',
      longHint: 'Opens the Spec Editor — the full structured Planguage view.  Add, edit, delete any F./V./S./C./R./Stakeholder entry manually.  The Planguage spec is INFRASTRUCTURE — this is where you drop when you want to see it.',
      tone: 'secondary' as const,
      disabled: !hasSpec,
      disabledReason: 'The Spec Editor opens once entries exist.',
    },
  ]
})

// r41 v477 — IET Settings drawer open state.  Toggled by an ⚙ pin surfaced
// on the Stage 4 task-centric workspace + from the Actions palette.
const ietSettingsOpen = ref(false)

// r41 v478 — Solution Set + Changes-List deliverable panel open state.
// Toggled by a 📦 pin on the Stage 5 task-centric workspace (5.5.1 + 5.5.2).
const solutionSetDeliverableOpen = ref(false)

// r41 v478 — deliverable panel Copy + Email handlers (extracted from template
// per r41 v258 no-inline-window-in-vue-template-handlers invariant).
function onSolutionSetDeliverableCopy(text: string): void {
  navigator.clipboard?.writeText(text)
  showToast('📋 Copied to clipboard', 2500)
}
function onSolutionSetDeliverableEmail(text: string): void {
  const subject = 'Solution Set deliverable · ' + (specModel.value?.name ?? '')
  const body    = text.slice(0, 2000)
  window.location.href = 'mailto:?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body)
  showToast('✉ Opening Mail (⌘V to paste full text)', 3000)
}

function _openAgentByKey(k: string): void {
  // Route to the canonical agent-open path — Contracts opens the ContractHub.
  if (k === 'contracts') {
    contractsOpen.value = true
    return
  }
  // Fallback — open the agent menu so the planner can pick manually.
  agentMenuOpen.value = true
}

// ─── v476 — Task-centric workspaces for Stages 6-10 ─────────────────────────
// r41 v476 (Tom Gilb 2026-07-01 "continue backlog") — audit-backlog items
// #5-#9 (Stages 6, 7, 8, 9, 10 task-centric workspaces) all shipped via the
// generic StageTaskWorkspace.vue component built in v417.  Every stage:
//   - Purpose sentence names the stage's PRIMARY job
//   - Action registry (computed, state-aware badges + disabled reasons)
//   - Handler routes each key to the CANONICAL existing surface
// (No-Silent-Removal SUPREME — no new pipelines; every action delegates to
// an already-shipped affordance.)  Composes with Stage-Has-A-Purpose SUPREME
// + Done/You-Can/Continue SUPREME + Stages-are-Cyclic SUPREME + MOVE + AI-Max.

// ─── Stage 5 — Refine (v478 Phase 2a workspace) ────────────────────────────
function onStage5WorkspaceAction(
  key: 'reduce-resources' | 'more-value' | 'reduce-risks' | 'relax-constraints' | 'deliverables' | 'approve' | 'continue',
): void {
  switch (key) {
    case 'reduce-resources':  onStage5SubStepGo('5.1'); break
    case 'more-value':        onStage5SubStepGo('5.2'); break
    case 'reduce-risks':      onStage5SubStepGo('5.3'); break
    case 'relax-constraints': onStage5SubStepGo('5.4'); break
    case 'deliverables':      solutionSetDeliverableOpen.value = true; break
    case 'approve':           solutionSetApprovalOpen.value = true; break
    case 'continue':          handleStageBarNav(6); break
  }
}
const stage5WorkspaceActions = computed(() => {
  const hasSpec = !!currentSpec.value
  const nSolutions = currentSpec.value?.solutions?.length ?? 0
  return [
    {
      key: 'reduce-resources' as const, glyph: '📉', label: 'Reduce Resources',
      shortHint: '5.1 · Trim resource consumption by re-design',
      longHint: 'Explore potential resource reductions through re-design.  Change · delete · add design solutions that lower resource claims without sacrificing Value delivery.',
      tone: 'secondary' as const,
      disabled: !hasSpec, disabledReason: 'Generate a spec first.',
    },
    {
      key: 'more-value' as const, glyph: '📈', label: 'More Value, Same Cost',
      shortHint: '5.2 · Lift Value/Cost ratio by re-design',
      longHint: 'Explore re-designs that give more value at about the same costs.  Find solutions where marginal Value uplift is achievable inside existing Resource budgets.',
      tone: 'secondary' as const,
      disabled: !hasSpec, disabledReason: 'Generate a spec first.',
    },
    {
      key: 'reduce-risks' as const, glyph: '⚠', label: 'Reduce Risks',
      shortHint: '5.3 · Lower failure-mode exposure',
      longHint: 'Explore re-designs that reduce risks.  Iterate on Solution Tier-2 risks + sideEffects fields; propose alternates that hedge failure modes.',
      tone: 'secondary' as const,
      disabled: !hasSpec, disabledReason: 'Generate a spec first.',
    },
    {
      key: 'relax-constraints' as const, glyph: '🔓', label: 'Relax Constraints',
      shortHint: '5.4 · Loosen Constraints + Qualifiers (temporary or permanent)',
      longHint: 'Explore temporary or permanent relaxation of Constraints and Qualifiers (when / where / who) to improve overall solution efficiency — WITHOUT triggering the Infinity Trap (r93mmm).',
      tone: 'secondary' as const,
      disabled: !hasSpec, disabledReason: 'Generate a spec first.',
    },
    {
      key: 'deliverables' as const, glyph: '📦', label: 'View Deliverables',
      shortHint: '5.5.1 Solution Set · 5.5.2 Changes-List',
      longHint: 'Opens the Solution Set (Tier-1 canonical parameters with sources + impacts) and the Changes-List (implied additions/sharpenings to Stakeholder/Value/Constraint/Resource/Function specs).  Copy + Email exports.',
      tone: nSolutions > 0 ? 'ai' as const : 'secondary' as const,
      badge: nSolutions > 0 ? `${nSolutions} S.` : undefined,
      disabled: !hasSpec || nSolutions === 0,
      disabledReason: 'No solutions in the current spec yet — return to Stage 2 to generate them.',
    },
    {
      key: 'approve' as const, glyph: '✅', label: 'Approve Solution Set',
      shortHint: '5.5 · Planner-only approval (Solution Set Version)',
      longHint: 'Opens the approval panel.  Captures planner identity + auto-stamped date/time + free-text caveats + optional nickname.  Per Tom Gilb: "by Planner, not necessarily other instances like Owner" — approval is PLANNER-level here; escalate to Owner-level via the panel\'s approvalAuthority pin.',
      tone: 'secondary' as const,
      disabled: !hasSpec, disabledReason: 'Generate a spec first.',
    },
    {
      key: 'continue' as const, glyph: '➜', label: 'Continue → Stage 6',
      shortHint: '5.5.3 · Move on to Evo Steps (return anytime)',
      longHint: 'Advance to Stage 6 (Evo Steps) — generate small, valuable, deliverable increments from the approved Solution Set.  Per Tom: "not revoking the right to go back to this step and improve solutions further" (Stages-are-Cyclic SUPREME).',
      tone: 'secondary' as const,
      disabled: !hasSpec, disabledReason: 'Generate a spec first.',
    },
  ]
})

// ─── Stage 4 — Impacts (v477 Phase 2a workspace) ───────────────────────────
function onStage4WorkspaceAction(
  key: 'iet' | 'settings' | 'approve' | 'tools' | 'continue',
): void {
  switch (key) {
    case 'iet':      goToImpactStage(); showToast('Open IET — review each Solution × Value estimate.  Evidence + Source + Credibility per cell (Phase 2b UI wiring).', 4500); break
    case 'settings': ietSettingsOpen.value = true; break
    case 'approve':  estimatesApprovalOpen.value = true; break
    case 'tools':    stage4ToolsTableOpen.value = true; break
    case 'continue': handleStageBarNav(5); break
  }
}
const stage4WorkspaceActions = computed(() => {
  const hasSpec = !!currentSpec.value
  return [
    {
      key: 'iet' as const, glyph: '📊', label: 'Look at Estimates',
      shortHint: 'Open the IET — Solution × Value grid',
      longHint: 'Opens the Impact Estimation Table.  Each cell is one Solution × Value estimate — percent impact + Evidence + Source + Credibility (0.0-1.0 CE-book scale).',
      tone: 'primary' as const,
      disabled: !hasSpec, disabledReason: 'Generate a spec first (Stage 1) to have Solutions × Values to estimate.',
    },
    {
      key: 'settings' as const, glyph: '⚙', label: 'IET Settings',
      shortHint: 'Conservative-vs-Risky slider + Credibility threshold',
      longHint: 'Opens the IET Settings drawer — Conservatism (0-100), Credibility Threshold (0-100% CE-book), Auto-Assumption Strength (0-100%).  Drives the auto-conservative-assumption generator + the "needs evidence" flag on IET cells.',
      tone: 'secondary' as const,
    },
    {
      key: 'approve' as const, glyph: '✅', label: 'Approve Estimates',
      shortHint: 'Create an Estimates Version (identity + date + remarks + nickname)',
      longHint: 'Opens the Estimates Approval panel.  Captures planner identity + auto-stamped date/time + free-text caveats + optional short nickname.  Creates a versioned snapshot in spec history — reversible per Universal Undo SUPREME.',
      tone: 'secondary' as const,
      disabled: !hasSpec, disabledReason: 'Estimates need a spec first.',
    },
    {
      key: 'tools' as const, glyph: '🧰', label: 'Tools + Agents',
      shortHint: 'Optional Tools + Agents menu (Penta / Munger / …)',
      longHint: 'Opens the Stage 4 Tools + Agents table — each row describes one tool/agent + one-sentence "how this helps at Stage 4".  Any number of tools, any number of times, until you choose to Move Ahead.',
      tone: 'secondary' as const,
    },
    {
      key: 'continue' as const, glyph: '➜', label: 'Continue → Stage 5',
      shortHint: 'Move on to Refine Attributes',
      longHint: 'Advance to Stage 5 (Refine Attributes) — reduce resources, more value same cost, reduce risks, relax constraints, approve Solution Set.  Stages are cyclic — you can return to Stage 4 anytime.',
      tone: 'secondary' as const,
    },
  ]
})

// ─── Stage 6 — Evo Steps ────────────────────────────────────────────────────
function onStage6WorkspaceAction(
  key: 'generate' | 'prioritise' | 'sharpen' | 'tools' | 'continue',
): void {
  switch (key) {
    case 'generate':
      showToast('⚡ Generating Evo Steps from your Solution Set…', 4500)
      void _triggerEvoGeneration()
      scrollEvoPlanIntoView()
      break
    case 'prioritise':
      if (confirmedSteps.value.length > 0) stage6PrioritiseOpen.value = true
      else showToast('Generate Evo Steps first — nothing to prioritise yet.', 3200)
      break
    case 'sharpen':
      if (confirmedSteps.value.length > 0) stage6SharpenStepsOpen.value = true
      else showToast('Generate Evo Steps first — nothing to sharpen yet.', 3200)
      break
    case 'tools':
      stage6ToolsAndAgentsOpen.value = true
      break
    case 'continue':
      handleStageBarNav(7)
      break
  }
}
const stage6WorkspaceActions = computed(() => {
  const nSteps = confirmedSteps.value.length
  const hasSpec = !!currentSpec.value
  return [
    {
      key: 'generate' as const, glyph: '⚡', label: 'Generate Evo Steps',
      shortHint: 'AI proposes Evo Steps from your Solution Set',
      longHint: 'Runs the EvoPlanner over your confirmed Solutions.  Produces an ordered list of Evo Steps (each has a name + which Solutions it delivers).  Every step is Undo-able.',
      tone: nSteps === 0 ? 'ai' as const : 'secondary' as const,
      badge: nSteps > 0 ? `${nSteps} step${nSteps === 1 ? '' : 's'}` : undefined,
      disabled: !hasSpec, disabledReason: 'Generate a spec first (Stage 1) so there are Solutions to base Evo Steps on.',
    },
    {
      key: 'prioritise' as const, glyph: '⚖', label: 'Prioritise Steps',
      shortHint: 'Order Evo Steps by Value ÷ Cost',
      longHint: 'Opens the Stage 6.2 Prioritise panel where you rank Evo Steps by projected value delivery divided by resource cost.  Highest ratios first = maximum learning per cycle.',
      tone: 'secondary' as const,
      disabled: nSteps === 0, disabledReason: 'Generate Evo Steps first — nothing to prioritise yet.',
    },
    {
      key: 'sharpen' as const, glyph: '🔪', label: 'Sharpen Steps',
      shortHint: 'Refine each Evo Step\'s name + success criteria',
      longHint: 'Opens the Stage 6.3 Sharpen Steps panel where you refine each Evo Step\'s name, which Values it moves, and the success criteria the next Study-Act cycle will measure.',
      tone: 'secondary' as const,
      disabled: nSteps === 0, disabledReason: 'Generate Evo Steps first.',
    },
    {
      key: 'tools' as const, glyph: '🧰', label: 'Tools + Agents',
      shortHint: 'Apply supporting tools + agents to this stage',
      longHint: 'Opens Stage 6.4 Tools and Agents — routes to Munger, Heilmeier, Roles, Elon, Incorruptible, and other agents that can sharpen Evo Step planning.',
      tone: 'secondary' as const,
    },
    {
      key: 'continue' as const, glyph: '➜', label: 'Continue → Stage 7',
      shortHint: 'Move on to Evo Impact estimation',
      longHint: 'Advance to Stage 7 (Evo Impact) — where each Evo Step\'s impact on the Value entries is estimated + tabulated in the VDT.',
      tone: 'secondary' as const,
      disabled: nSteps === 0, disabledReason: 'Generate at least one Evo Step first.',
    },
  ]
})

// ─── Stage 7 — Evo Impact ───────────────────────────────────────────────────
function onStage7WorkspaceAction(
  key: 'vdt' | 'multivision' | 'optima' | 'value-flow' | 'continue',
): void {
  switch (key) {
    case 'vdt':          menuOpen.value = true; showToast('Open Actions → VDT to run Value÷Cost ranking across every Evo Step.', 3200); break
    case 'multivision':  multiVisionOpen.value = true; break
    case 'optima':       optimaOpen.value = true; break
    case 'value-flow':   visualiseOpen.value = true; break
    case 'continue':     handleStageBarNav(8); break
  }
}
const stage7WorkspaceActions = computed(() => {
  const nSteps = confirmedSteps.value.length
  return [
    {
      key: 'vdt' as const, glyph: '📊', label: 'Run VDT Ranking',
      shortHint: 'Value ÷ Cost ranking across every Evo Step',
      longHint: 'Opens the Value Delivery Table (VDT) — each row is an Evo Step, each column is a Value/Cost cell.  Cells populate with delivery percentages; the sum is the ranking metric.',
      tone: nSteps > 0 ? 'ai' as const : 'secondary' as const,
      disabled: nSteps === 0, disabledReason: 'Generate Evo Steps first (Stage 6).',
    },
    {
      key: 'multivision' as const, glyph: '🎚', label: 'MultiVision Sliders',
      shortHint: 'Interactive Value ambition + Resource budget sliders',
      longHint: 'Opens MultiVision — Value ambition sliders (Tolerable → Goal → Wish), Resource budget sliders, live VDT consequences: which Solutions are funded, per-Value delivery %, overall vision balance score.',
      tone: 'secondary' as const,
    },
    {
      key: 'optima' as const, glyph: '🎯', label: 'OPTIMA Sliders',
      shortHint: 'Balance critical Values via VDT sliders (Optima book)',
      longHint: 'Opens the Resource OPTIMA panel — adjust one Resource slider to see impact propagate across all Value entries.  Green = Goal met, orange = Tolerable risk, red = Constraint violation.',
      tone: 'secondary' as const,
    },
    {
      key: 'value-flow' as const, glyph: '🌊', label: 'Value Flow',
      shortHint: 'Visualise how Values flow through Evo Steps',
      longHint: 'Opens the Value Flow visualisation — shows how each Value entry accumulates delivery over the sequence of Evo Steps.  Highlights bottlenecks and dead ends.',
      tone: 'secondary' as const,
    },
    {
      key: 'continue' as const, glyph: '➜', label: 'Continue → Stage 8',
      shortHint: 'Move on to Task decomposition',
      longHint: 'Advance to Stage 8 (Tasks) — decompose each Evo Step into concrete Tasks with estimates + assignments.',
      tone: 'secondary' as const,
    },
  ]
})

// ─── Stage 8 — Tasks ────────────────────────────────────────────────────────
function onStage8WorkspaceAction(
  key: 'decompose' | 'estimate' | 'assign' | 'continue',
): void {
  switch (key) {
    case 'decompose': goToTasksStage(); showToast('Decompose each Evo Step into concrete Tasks.', 3200); break
    case 'estimate':  goToTasksStage(); showToast('Estimate Task effort in hours/days (story-points is banned).', 3600); break
    case 'assign':    goToTasksStage(); showToast('Assign + sequence Tasks per Implementation Responsible.', 3600); break
    case 'continue':  handleStageBarNav(9); break
  }
}
const stage8WorkspaceActions = computed(() => {
  const nSteps = confirmedSteps.value.length
  return [
    {
      key: 'decompose' as const, glyph: '🧩', label: 'Decompose Tasks',
      shortHint: 'Break each Evo Step into named Tasks',
      longHint: 'Opens the Tasks stage — each Evo Step becomes a parent; add child Tasks with a name + brief description.  Tasks are what the delivery team actually does.',
      tone: nSteps > 0 ? 'primary' as const : 'secondary' as const,
      disabled: nSteps === 0, disabledReason: 'Generate Evo Steps first (Stage 6).',
    },
    {
      key: 'estimate' as const, glyph: '⏱', label: 'Estimate Effort',
      shortHint: 'Hours + days per Task (no story-points)',
      longHint: 'Estimate effort per Task in concrete units — hours, days, or weeks.  Story-point vocabulary is BANNED per Banned Scrum Vocabulary SUPREME.',
      tone: 'secondary' as const,
    },
    {
      key: 'assign' as const, glyph: '👥', label: 'Assign + Sequence',
      shortHint: 'Route Tasks to Implementation Responsible people',
      longHint: 'Assign each Task to a named Implementation Responsible person.  Sequence Tasks within their Evo Step so parallel + serial dependencies are explicit.',
      tone: 'secondary' as const,
    },
    {
      key: 'continue' as const, glyph: '➜', label: 'Continue → Stage 9',
      shortHint: 'Move on to Study-Act (measure actuals)',
      longHint: 'Advance to Stage 9 (Study-Act) — after delivery, measure real Value change and real Resource cost.  Compare against Stage 4 estimates.',
      tone: 'secondary' as const,
    },
  ]
})

// ─── Stage 9 — Study-Act ────────────────────────────────────────────────────
function onStage9WorkspaceAction(
  key: 'measure' | 'compare' | 'update' | 'decide' | 'continue',
): void {
  switch (key) {
    case 'measure': showToast('Record real Values + Costs from the latest Evo delivery cycle.', 4500); break
    case 'compare': showToast('Compare measured actuals against Stage 4 Estimates Version.', 4500); break
    case 'update':  _openSpecEditor({}); showToast('Update Values + Costs in the spec (Undo-able).', 4500); break
    case 'decide':  showToast('Decide next cycle — Continue Evo · Return to Stage 4 (re-estimate) · Return to Stage 5 (re-design).', 5000); break
    case 'continue': handleStageBarNav(10); break
  }
}
const stage9WorkspaceActions = computed(() => {
  return [
    {
      key: 'measure' as const, glyph: '📏', label: 'Measure Actuals',
      shortHint: 'Record real Value change + Resource cost',
      longHint: 'Capture the actuals from the delivery cycle just completed: real Value entries\' Status, real Resource usage, real Task completion times.',
      tone: 'ai' as const,
    },
    {
      key: 'compare' as const, glyph: '⚖', label: 'Compare vs Estimates',
      shortHint: 'Actuals vs Stage 4 Estimates Version',
      longHint: 'Compare measured actuals against the Estimates Version approved in Stage 4.  Surface the diff so learnings feed the next cycle.',
      tone: 'secondary' as const,
    },
    {
      key: 'update' as const, glyph: '✎', label: 'Update Spec',
      shortHint: 'Write real Values + Costs into the spec',
      longHint: 'Open the Spec Editor to record real Values, Costs, and Constraints discovered from the delivery cycle.  Every edit is Undo-able + Source-stamped.',
      tone: 'secondary' as const,
    },
    {
      key: 'decide' as const, glyph: '🧭', label: 'Decide Next Cycle',
      shortHint: 'Continue Evo · Re-estimate · Re-design',
      longHint: 'Explicit decision point: Continue Evo (all good — proceed to next Evo Step) OR Return to Stage 4 (re-estimate with new actuals) OR Return to Stage 5 (re-design because Value targets are unmet).',
      tone: 'secondary' as const,
    },
    {
      key: 'continue' as const, glyph: '➜', label: 'Continue → Stage 10',
      shortHint: 'Move on to Resource optimization',
      longHint: 'Advance to Stage 10 (Resources) — audit Resource allocation with OPTIMA + MultiVision now that you have real actuals to feed into the sliders.',
      tone: 'secondary' as const,
    },
  ]
})

// ─── Stage 10 — Resources ───────────────────────────────────────────────────
function onStage10WorkspaceAction(
  key: 'optima' | 'multivision' | 'edit-resources' | 'compare' | 'continue',
): void {
  switch (key) {
    case 'optima':          optimaOpen.value = true; break
    case 'multivision':     multiVisionOpen.value = true; break
    case 'edit-resources':  _openSpecEditor({ tab: 'solutions' }); showToast('Open the Spec Editor to add / edit R. Resource entries.', 3200); break
    case 'compare':         comparisonMode.value = true; break
    case 'continue':        handleStageBarNav(11); break
  }
}
const stage10WorkspaceActions = computed(() => {
  const nR = (currentSpec.value?.resources?.length ?? 0)
  return [
    {
      key: 'optima' as const, glyph: '🎯', label: 'OPTIMA Sliders',
      shortHint: 'Balance critical Values via Resource sliders (Optima book)',
      longHint: 'Opens Resource OPTIMA — Tom Gilb\'s book on Balancing Critical Values.  Adjust a Resource slider to see impact propagate: green = Goal met, orange = Tolerable risk, red = Constraint violation.',
      tone: 'primary' as const,
      badge: nR > 0 ? `${nR} R.` : undefined,
    },
    {
      key: 'multivision' as const, glyph: '🎚', label: 'MultiVision Sliders',
      shortHint: 'Value ambition + Resource budget interactive sandbox',
      longHint: 'Opens MultiVision — Value ambition sliders (Tolerable / Goal / Wish) + Resource budget sliders.  Live VDT consequences show which Solutions are funded, per-Value delivery %, and the vision-balance score.',
      tone: 'secondary' as const,
    },
    {
      key: 'edit-resources' as const, glyph: '✎', label: 'Edit Resources',
      shortHint: 'Add or edit R. Resource entries in the spec',
      longHint: 'Opens the Spec Editor to add or refine Resource entries (people, money, time, materials).  Every R. entry can carry its own Scale + Meter + Tolerable + Goal + Wish + Qualifiers.',
      tone: 'secondary' as const,
    },
    {
      key: 'compare' as const, glyph: '⚖', label: 'Compare Scenarios',
      shortHint: 'Side-by-side comparison across Resource allocations',
      longHint: 'Opens the Comparison mode — pin two or more Resource-allocation scenarios and see their VDT + Value-delivery consequences side by side.',
      tone: 'secondary' as const,
    },
    {
      key: 'continue' as const, glyph: '➜', label: 'Continue → Stage 11',
      shortHint: 'Move on to Export',
      longHint: 'Advance to Stage 11 (Export) — export the full spec + Evo plan + estimates + actuals to email / clipboard / .eml / PDF.',
      tone: 'secondary' as const,
    },
  ]
})

/** Hold the most recent refinement hint from 1.3 in a ref so a follow-up
 *  rev can prepend it to the next direct-Anthropic re-extraction pass.
 *  No Claudian round-trip is involved — this is the Option A path Tom
 *  approved 2026-06-19. */
const stage13RefinementHint = ref<string>('')
function onStage13RefinementHint(text: string): void {
  stage13RefinementHint.value = text
  showToast(`✓ Hint noted (${text.length} chars) — re-extract wiring lands in the next rev.`, 3500)
}
function onStage13RejectEntry(id: string): void {
  // Soft-reject only for this rev — full removal-through-Undo lands later.
  console.info('[ParseImpliedSharpening] entry soft-rejected:', id)
}

/** r41 v211 — snapshot the parent passes into GetAPlanPanel so the
 *  previous initial input can be restored on a recovery-flow open.  Set
 *  immediately before opening; cleared after the panel consumes it via
 *  its watcher. */
const restoreSnapshotForGetAPlan = ref<{ text: string; mode: 'text'|'url'|'file'; source?: string } | null>(null)

/** Wired into EmptySpecCallout — routes the planner back to Stage 1.
 *  Tom Gilb 2026-06-19 "it goes back to 1.2 but there is no input so it
 *  should go to 1.1 and ideally it would keep or refresh the previous
 *  input, or offer to do that if we do not override".  Logic:
 *    1. If we have a captured initial-input snapshot for the current
 *       spec model, stage it into `restoreSnapshotForGetAPlan` so the
 *       panel auto-pre-fills the matching tab + field.  Sub-step is
 *       1.2 (input is ready to parse).
 *    2. If no snapshot exists, route to 1.1 (Spec Entry) — the planner
 *       genuinely has nothing to parse yet. */
function onEmptySpecCalloutGoToParsing(): void {
  handleStageBarNav(1)
  const snapshot = specModel.value?.id ? getInitialInput(specModel.value.id) : null
  if (snapshot && snapshot.text) {
    restoreSnapshotForGetAPlan.value = {
      text:   snapshot.text,
      mode:   snapshot.mode,
      source: snapshot.source,
    }
    // r41 v212 (Tom Gilb 2026-06-19 "no change, went to 1.2") — sub-step
    // depends on whether the input is GENUINELY ready to parse:
    //   • text / url snapshots auto-restore the field → 1.2 (Parsing) is right.
    //   • file snapshots can ONLY restore the file NAME (browsers refuse to
    //     let JavaScript re-attach a File object from a path), so the file
    //     picker is still empty.  Route to 1.1 (Spec Entry) so the planner
    //     re-selects the file before they hit Parse.  The watcher's toast
    //     already names the previous file so they know which one to pick.
    stage1SubStep.value = snapshot.mode === 'file' ? '1.1' : '1.2'
    specInputOpen.value = true
    // GetAPlanPanel's watcher fires the restore toast.
  } else {
    restoreSnapshotForGetAPlan.value = null
    stage1SubStep.value = '1.1'
    specInputOpen.value = true
    showToast('1.1 Capture Spec Input — paste text, URL, or upload a file to begin.', 3500)
  }
}

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
  // r41 v38 — Tom Gilb 2026-06-15 verbatim "said failed to complete generating"
  // — a "Could not generate spec" error from a TIMED-OUT earlier Stage 1
  // attempt was still showing AFTER the user had advanced to Stage 2 (visible
  // in his screenshot: Stage 2 active, sharpening panel rendered, but the red
  // banner persisted).  Fix: clear sdkError on any stage transition AWAY from
  // Stage 1.  The error is Stage-1-scoped (generate from form) and stale once
  // the user has a spec and is past it.  Composes with No-Silent-Data-Loss
  // (the error is informational, not data — clearing it is safe).
  if (newStage !== 1 && oldStage === 1 && sdkError.value) {
    console.log('[stage-watch] clearing stale sdkError on stage 1 → ', newStage)
    sdkError.value = ''
  }
})

console.log('[boot] script-setup end — onMounted scheduled', new Date().toISOString())

onMounted(async () => {
  // r41 v206 (Tom Gilb 2026-06-19 verbatim "DAMN TEXT DISAPPEARED" — text
  // loss reproducibly happens in SEM App but not in Notes/Keynote, so the
  // cause is SEM-App-specific.  Universal safety net: a document-level
  // keystroke journal captures every `<input>` / `<textarea>` edit to
  // localStorage in real time so accidental wipes are recoverable from
  // Safari DevTools via `window.semTypingJournal()` /
  // `window.semFindTyping('your phrase')`.  Installs ONCE at mount; safe
  // on hot-reload (the install fn is idempotent). */
  installTypingJournal()
  // r41 v208 — convenience dev hook so Tom can read the captured initial
  // input for the current spec from Safari DevTools without opening the
  // panel.  `window.semInitialInput()` returns the snapshot for the
  // active spec; `window.semInitialInput('<specId>')` reads any.
  ;(window as unknown as { semInitialInput?: (specId?: string) => InitialInputSnapshot | null }).semInitialInput =
    (specId?: string) => getInitialInput(specId ?? (specModel.value?.id ?? ''))
  // Phase 2 Plan→Spec localStorage key migration: copy sem-plan-* → sem-spec-* on first run.
  // Idempotent: skips any new key that is already populated. Never deletes old keys.
  backfillSpecKeysFromPlanKeys()
  // r41 v111 — restore pre-spec draft (typed Plan Name / Owner / Specifications)
  // BEFORE the form mounts so the pendingPlanName / pendingOwnerName /
  // pendingGenesisRepopulate refs are populated for SEMEntryForm to pick up.
  // Only kicks in when there's no currentSpec to load.
  if (!currentSpec.value) _restorePreSpecDraft()
  if (!currentSpec.value) _loadPreSpecStewards()
  console.log('[boot] onMounted entered', new Date().toISOString())
  // r41 v390 (Tom Gilb 2026-07-01 verbatim "after a while in contracts agent it
  // suddenly jumped to this" — screenshot showed Stage 1 Stakes after being in
  // ContractHub) — hydrate the mode-specific top-level panel from `activeMode`.
  // `activeMode` persists to localStorage but the per-panel `contractsOpen` /
  // `modelLibraryOpen` open-refs are session-only.  Result: after a page refresh
  // (which the analysis-failed toast literally suggested) `activeMode` restored
  // to 'contract' but the hub was closed, so the user landed on the underlying
  // Plan Stage 1 surface — looking like the app had "jumped".
  // Fix: on mount, if activeMode is 'contract' or 'model', open the matching
  // panel so the user sees the mode's canonical surface.
  // Composes with No-Silent-Removal-of-Permanent-Surfaces SUPREME (the ContractHub
  // is the permanent surface for Contract mode; a refresh should not silently
  // remove it), Tom-Repeats-Himself SUPREME (Tom flagged the "jumped" symptom;
  // fixing the mode-hydration prevents the same class of report), Architectural
  // Resilience SUPREME (mode + open-ref stay in sync automatically).
  try {
    const restoredMode = _activeMode.value
    if (restoredMode === 'contract' && view.value === 'app') {
      contractsOpen.value = true
    } else if (restoredMode === 'model' && view.value === 'app') {
      modelLibraryOpen.value = true
    }
  } catch { /* activeMode wiring unavailable — non-fatal */ }
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
  // r41 v296 (Tom Gilb 2026-06-22): restore the in-memory Evo plan so the
  // EvoPlanView shows the real plan on Stage 6 entry instead of the empty-
  // state "No Evo plan yet" placeholder.  _loadEvoPlan() also sets
  // _skipNextFetch=true so EvoPlanView's mount watcher does NOT trigger a
  // wasteful fresh AI generation.  Falls back to _clearEvoPlan() if the
  // saved session predates v296 OR was saved with no plan.
  const savedEvoPlan = (saved as { evoPlan?: EvoStepPlan | null }).evoPlan
  if (savedEvoPlan && Array.isArray(savedEvoPlan.steps) && savedEvoPlan.steps.length > 0) {
    _loadEvoPlan(savedEvoPlan)
    console.log('[session] restored Evo plan with', savedEvoPlan.steps.length, 'steps')
  } else {
    _clearEvoPlan()
  }
  tasksByStep.value           = saved.tasksByStep ?? {}
  capturedImpactMatrix.value  = _migrateMatrixKeys(saved.capturedImpactMatrix ?? {})
  capturedVCRatios.value      = _migrateRecordKeys(saved.capturedVCRatios ?? {})
  capturedCalendarCosts.value = _migrateRecordKeys(saved.capturedCalendarCosts ?? {})
  capturedCapitalCosts.value  = _migrateRecordKeys(saved.capturedCapitalCosts ?? {})

  // Restore the 11-step Evo planning bar position.
  // Fallback table for sessions saved before planningStage was persisted (version <3).
  // 2026-06-07 fix: stage 2 (EvoPlanView) was mapped → planningStage 6 (Evo Steps) which
  // was wrong — EvoPlanView is where the user GENERATES Evo Steps, not where they've already
  // completed Sharpen/Impacts/Refine.  Corrected to planningStage 2 (spec entered, Evo plan
  // not yet generated). This stops the bar jumping to stage 6 on every session restore.
  //   stage 1 (spec entry)  → planningStage 1  (Stakes)
  //   stage 2 (EvoPlanView) → planningStage 2  (Solutions — user is about to plan Evo Steps)
  //   stage 3 (ImpactView)  → planningStage 5  (Estimate Impacts)
  //   stage 4 (TasksView)   → planningStage 8  (Plan Tasks)
  const fallbackPlanningStage: Record<number, number> = { 1: 1, 2: 2, 3: 5, 4: 8, 5: 8 }
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
    // Sync the planning bar to at least stage 2. Do NOT jump to 6 — the user
    // has a spec but has not yet been through Sharpen (3) → Impacts (4) →
    // Refine (5) → Evo Steps (6). Forcing planningStage=6 made the bar show
    // "Evo Steps" on every session restore, confusing the planning journey.
    // 2026-06-07 fix: was `if (planningStage.value < 6) planningStage.value = 6`
    if (planningStage.value < 2) planningStage.value = 2
    // r14 2026-06-09: if the restored model was already sharpened (specModel has
    // sharpenRounds > 0) advance the bar to at least 3 (Sharpen) so the bar
    // reflects actual progress after a page reload. sharpenRounds is in-memory
    // only (not in the session snapshot) so the 0→>0 watcher never fires on
    // restore. specModel is available here because _ensurePlanModel ran above.
    const restoredSharpenRounds = specModel.value?.sharpenRounds ?? 0
    if (restoredSharpenRounds > 0 && planningStage.value < 3) planningStage.value = 3
  } else {
    // Staying at the restored stage — still ensure specModel if spec exists,
    // because the user may have a spec at stage 1 and navigate to stage 2.
    if (saved.currentSpec) _ensurePlanModel(saved.currentSpec)
    // r14 2026-06-09: same sharpenRounds floor for the non-auto-advance path.
    const restoredSharpenRoundsB = specModel.value?.sharpenRounds ?? 0
    if (restoredSharpenRoundsB > 0 && planningStage.value < 3) planningStage.value = 3
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

  // r93qqq 2026-06-12 — defensive clamp after session restore.
  // Tom report: opened SEM with prior session ending at Stage 9 (Study-Act),
  // navigated to Stage 2 Solutions and clicked Next, but the view immediately
  // showed Stage 9 again — Stage 9 is a dead-end when no Evo Steps exist
  // (the body just says "No Evo Steps yet" and offers no work).
  // Rule: if restored to Stage 9+ but no confirmed steps exist, drop back to
  // Stage 5 (Refine).  The user lands on something they can actually DO.
  // The session payload is fully retained — only the bar position changes.
  if (planningStage.value >= 9 && (saved.confirmedSteps?.length ?? 0) === 0) {
    const clampedFrom = planningStage.value
    planningStage.value = 5
    console.log(`[stage-restore-clamp] ${clampedFrom} → 5 (no confirmed steps on restore)`)
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
// r41 v295 (Tom Gilb 2026-06-22 "always continue · research and innovation").
// Stage 9 Study-Act triage — auto-detect ONE of three states from the spec +
// tasksByStep + confirmedSteps refs. Drives the triage banner that mounts at
// the top of the Stage 9 content area.
//   • 'no-evo'      — no Evo step delivered yet → "Skip to Stage 10".
//   • 'no-actuals'  — Evo step delivered but no actuals captured → "Capture Actuals".
//   • 'actuals-in'  — actuals already captured this cycle → "Compare to Estimates".
// Composes with Stage-Has-A-Purpose SUPREME (Stage 9's job = measure actuals,
// compare to estimates, decide next cycle), MOVE Principle (banner visible
// at top), DD-009 Zero-Training UI (every pin has a title=).
type Stage9TriageState = 'no-evo' | 'no-actuals' | 'actuals-in'
const stage9TriageState = computed<Stage9TriageState>(() => {
  const steps = confirmedSteps.value ?? []
  if (steps.length === 0) return 'no-evo'
  // Look for any Value.status carrying the Study-Act provenance stamp this
  // panel writes. (Stamp format: "Source: Study-Act actuals · YYYY-MM-DD · …")
  const spec = currentSpec.value
  if (!spec) return 'no-evo'
  const hasActuals =
    (spec.values ?? []).some(v => /Study-Act actuals/i.test(v.status ?? '')) ||
    (spec.resources ?? []).some(r => /Study-Act actuals/i.test(r.status ?? ''))
  return hasActuals ? 'actuals-in' : 'no-actuals'
})
const stage9ActualsCounts = computed(() => {
  const spec = currentSpec.value
  if (!spec) return { v: 0, r: 0 }
  const v = (spec.values ?? []).filter(x => /Study-Act actuals/i.test(x.status ?? '')).length
  const r = (spec.resources ?? []).filter(x => /Study-Act actuals/i.test(x.status ?? '')).length
  return { v, r }
})

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

// r93qqq 2026-06-12 — diagnostic trace for non-adjacent stage jumps.
// Tom 2026-06-12 report: stage bar jumped from 2 (Solutions) → 9 (Study-Act)
// on a single Next click — no intermediate steps.  No single function in the
// codebase advances planningStage by more than 1 explicitly, so the cause must
// be a watcher-cascade or a race condition.  This trace fires a toast whenever
// the stage changes by more than 1 in either direction, naming the JS call
// stack — so the next time it happens, the trace points at the culprit.
// Surgical: passive, no behaviour change, can be removed after root cause is found.
// r41 v37 — better stage-jump diagnostic (Tom Gilb 2026-06-15 "export plan
// stage 11 not working" — log showed `11 → 9` with Vue's flushJobs stack only,
// which doesn't name the actual write site).  New approach: log EVERY
// planningStage change with its delta, plus a debounced toast for jumps > 1.
// The console.warn fires synchronously on the next microtask after the write,
// but the stack trace it captures will still be Vue's reactive system — the
// real fix is to instrument _setPlanningStage at the source (next step).
watch(planningStage, (newStage, oldStage) => {
  const delta = newStage - oldStage
  console.log(`[planningStage] ${oldStage} → ${newStage} (Δ${delta >= 0 ? '+' : ''}${delta})`)
  if (Math.abs(delta) > 1) {
    const stack = new Error().stack?.split('\n').slice(1, 8).join(' | ') ?? ''
    console.warn(`[stage-jump] ${oldStage} → ${newStage}`, { stack })
    showToast(`⚠️ Stage jumped ${oldStage} → ${newStage} (more than 1 step). Investigating — please screenshot this toast.`, 8000)
  }
})

// r41 v37 — Synchronous instrumentation of every planningStage write so we
// can see the JS call site (not just the Vue watcher microtask).  Wraps the
// ref's setter via a Proxy-like indirection: any code that touches
// `planningStage.value = X` now lands here.  Console output names the source
// function via Error().stack inspection AT THE WRITE TIME, before any
// reactive flush.  Tom 2026-06-15 "export plan stage 11 not working" — this
// will name the watcher / handler that pulls 11 back to 9.
const _planningStageRaw = planningStage
const _origPlanningStageSet = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(_planningStageRaw),
  'value',
)
if (_origPlanningStageSet?.set) {
  const _origSet = _origPlanningStageSet.set
  const _origGet = _origPlanningStageSet.get!
  Object.defineProperty(_planningStageRaw, 'value', {
    get: function () { return _origGet.call(this) },
    set: function (newVal: number) {
      const cur = _origGet.call(this)
      if (cur !== newVal) {
        const stack = new Error().stack?.split('\n').slice(2, 7).map(s => s.trim()).join(' | ') ?? ''
        console.log(`[planningStage.SET] ${cur} → ${newVal}  via: ${stack.slice(0, 280)}`)
        // r41 v242 (Tom Gilb 2026-06-21 verbatim "it moved by itself after stg 2 sharpening
        // back to stage 1").  Tom does not open DevTools — the silent console.log is invisible
        // to him.  Surface backward stage moves AND non-adjacent jumps as user-visible toasts
        // naming the suspected source from the call stack.  Composes with Do-Not-Outsource-
        // Investigation SUPREME — Claudian gets the diagnostic info without asking Tom to open
        // an inspector; Tom just sees a toast he can screenshot.
        const delta = newVal - cur
        const isBackward = delta < 0 && newVal < cur
        const isBigJump = Math.abs(delta) > 1
        if (isBackward || isBigJump) {
          const culpritLine = stack.split('|').find(s => /\.vue|\.ts/.test(s) && !/_planningStageRaw|defineProperty/.test(s)) ?? 'unknown'
          const suspected = culpritLine.trim().slice(0, 120)
          showToast(
            `⚠ Stage ${cur} → ${newVal} (unexpected ${isBackward ? 'BACKWARD' : 'jump'}).  Source: ${suspected}.  If you did not click Stage ${newVal}, screenshot this notification.`,
            9000,
          )
          // r41 v292 (Tom Gilb 2026-06-22 verbatim "working on resources stage
          // questions and it jumped back to refine solutions") — second
          // recurrence of the stage-jump bug class.  Adding a PERSISTENT
          // breadcrumb so even if Tom misses the live notification we have an
          // audit trail.  Pushes the last 20 jumps to localStorage and to
          // window._semStageJumpLog for next-session forensics.  Tom does NOT
          // open DevTools (Do-Not-Outsource-Investigation SUPREME); the log is
          // for Claudian's next read of the screen + Playwright probes.
          _persistStageJump('planningStage', cur, newVal, suspected, stack)
        }
      }
      _origSet.call(this, newVal)
    },
    configurable: true,
  })
}

/** r41 v292 — shared persistent breadcrumb for unexpected stage jumps.
 *  Stores the last 20 jumps in localStorage under `sem-stage-jump-log` AND on
 *  window._semStageJumpLog (in-memory mirror).  Wraps in try/catch so a quota
 *  / private-mode failure cannot break the instrumented stage setter. */
function _persistStageJump(
  stageType: 'planningStage' | 'stage',
  cur: number,
  newVal: number,
  suspected: string,
  fullStack: string,
): void {
  try {
    const KEY = 'sem-stage-jump-log'
    const entry = {
      ts: new Date().toISOString(),
      stageType,
      from: cur,
      to: newVal,
      direction: newVal < cur ? 'backward' : (Math.abs(newVal - cur) > 1 ? 'big-jump' : 'forward'),
      suspected,
      fullStack: fullStack.slice(0, 800),
      planName: specModel.value?.name ?? '(none)',
      version:  specModel.value?.version ?? null,
    }
    // In-memory ring
    const w = window as unknown as { _semStageJumpLog?: typeof entry[] }
    if (!w._semStageJumpLog) w._semStageJumpLog = []
    w._semStageJumpLog.push(entry)
    if (w._semStageJumpLog.length > 20) w._semStageJumpLog.shift()
    // localStorage ring
    const raw = localStorage.getItem(KEY)
    const arr: typeof entry[] = raw ? JSON.parse(raw) : []
    arr.push(entry)
    while (arr.length > 20) arr.shift()
    localStorage.setItem(KEY, JSON.stringify(arr))
  } catch { /* quota / SSR / private-mode safe */ }
}

// r41 v291 (Tom Gilb 2026-06-22 verbatim "from tasks I mailed and got, not tasks
// but whole Planguage plan, then it jumped back to stage 2") — Synchronous
// instrumentation of every `stage` (view-level) write.  Mirrors the existing
// planningStage instrumentation above so when Tom's stage flips unexpectedly
// (e.g. after a Mail action steals focus to Mail.app and some focus / watcher /
// snapshot path resets `stage`) the source call-site is named on screen via a
// notification.  Composes with Do-Not-Outsource-Investigation SUPREME — Tom
// does not open DevTools; the notification IS the diagnostic.
//
// Why only on backward / non-adjacent jumps: forward step-by-step navigation
// is the normal case and would spam Tom with notifications.  We only fire on
// surprising motions (Δ < 0 OR |Δ| > 1) which is the exact failure mode
// "it jumped back to stage 2" describes.
const _stageRaw = stage
const _origStageDesc = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(_stageRaw),
  'value',
)
if (_origStageDesc?.set && _origStageDesc?.get) {
  const _origSet = _origStageDesc.set
  const _origGet = _origStageDesc.get
  Object.defineProperty(_stageRaw, 'value', {
    get: function () { return _origGet.call(this) },
    set: function (newVal: number) {
      const cur = _origGet.call(this)
      if (cur !== newVal) {
        const stack = new Error().stack?.split('\n').slice(2, 8).map(s => s.trim()).join(' | ') ?? ''
        console.log(`[stage.SET] ${cur} → ${newVal}  via: ${stack.slice(0, 320)}`)
        const delta = newVal - cur
        const isBackward = delta < 0 && newVal < cur
        const isBigJump = Math.abs(delta) > 1
        if (isBackward || isBigJump) {
          const culpritLine = stack.split('|').find(s => /\.vue|\.ts/.test(s) && !/_stageRaw|defineProperty/.test(s)) ?? 'unknown'
          const suspected = culpritLine.trim().slice(0, 140)
          showToast(
            `⚠ View-stage ${cur} → ${newVal} (unexpected ${isBackward ? 'BACKWARD' : 'jump'}).  Source: ${suspected}.  If you did not click Stage ${newVal}, screenshot this notification.`,
            10000,
          )
          _persistStageJump('stage', cur, newVal, suspected, stack)
        }
      }
      _origSet.call(this, newVal)
    },
    configurable: true,
  })
}

// Auto-advance to Solutions stage (planningStage 2) when the first solutions
// appear in the spec while the user is still on the Stakes stage (1).
// Tom 2026-06-09: "I think the stage should move on to solutions as soon as the
// first solutions are generated."
// Only fires on the 0→>0 transition so it never interrupts a user who has
// already manually navigated past Stage 1.
watch(
  () => currentSpec.value?.solutions?.length ?? 0,
  (newCount, oldCount) => {
    if (newCount > 0 && oldCount === 0 && planningStage.value === 1) {
      planningStage.value = 2
    }
  }
)

// Auto-advance to Sharpen stage (planningStage 3) when the first sharpening
// round completes.  Tom 2026-06-09: "we should be in stage 3 sharpening."
// Only advances forward — never pulls the user back to 3 if already past it.
watch(
  () => sharpenRounds.value.length,
  (n, prev) => {
    if (n > 0 && prev === 0 && planningStage.value < 3) {
      planningStage.value = 3
    }
  }
)

// NOTE: the "Done Sharpening → Continue to Evo Steps" button (below, in the
// sharpeningDone block) handles the planningStage 3 → 6 advance when the user
// explicitly clicks "Continue".  No watcher needed here — a watcher firing
// automatically on sharpeningDone=true was causing the "Done Sharpening →
// Continue" button to call handleStageBarNav(planningStage+1) = (4+1)=5, which
// resolves to 'to-impact' → stage.value=3 (Evo Impact view) — an unexpected
// jump.  Removed 2026-06-09 per Tom's circular-navigation bug report.

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
/** r41 v256 (Tom Gilb 2026-06-21 "look at estimates, except they are not here now") —
 *  template ref on the IET wrapper div so the Stage 4 sub-step handlers can scroll the
 *  table into view after navigation.  The IET was rendering correctly post-v255 but
 *  positioned far below the visible viewport — Tom clicked 4.1, state updated, but the
 *  content was off-screen. */
const ietWrapperEl = ref<HTMLElement | null>(null)
/** r41 v262 — template ref on the EvoPlanView wrapper so Stage 6.1 can scroll it into view. */
const evoPlanWrapperEl = ref<HTMLElement | null>(null)
const ietRef = ref<(ComponentPublicInstance & { getSnapshot: () => {
  matrix: ImpactMatrix
  efficiency: Record<string, number>
  calendarCosts: Record<string, number>
  capitalCosts: Record<string, number>
} }) | null>(null)

// Template ref to the SpecOutput wrapper — used to scroll into view after ClarifyView
// completes (skip or generate). On mobile the spec renders below the form and is off-screen.
const specOutputEl   = ref<HTMLElement | null>(null)
/** Template ref to SEMEntryForm — used by handleApertureSubmit to trigger Parse and genesis re-parse */
const semEntryFormRef = ref<{ loadAndParse: (text: string) => void; prefillGenesis: (genesis: { stakes: string; ends: string; means: string }) => void } | null>(null)

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
  // Genesis re-parse: when the form mounts after handleReParse() set stage = 1,
  // pre-fill it with the saved genesis input so the planner can edit and regenerate.
  if (form && pendingGenesisRepopulate.value !== null) {
    const genesis = pendingGenesisRepopulate.value
    pendingGenesisRepopulate.value = null
    form.prefillGenesis(genesis)
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
// r41 v61 (Tom Gilb 2026-06-16 screenshot "timedout, but did work a moment
// ago"): 180s bumped to 300s = 5 minutes.  Tom's screenshot showed a real
// generation completing at 245s WITH a "Could not generate spec" error
// banner already painted by the watchdog at 180s — false-positive timeout.
// Sonnet + larger inputs (≥800 words across Stakes / Ends / Means) routinely
// take 200-280s; 300s gives comfortable headroom while still surfacing a
// real hang within reasonable time.  Composes with the late-success
// stale-error clear added at line 4117 — if the watchdog DOES still false-
// trigger and the real spec lands afterwards, the error banner clears on
// `currentSpec.value` assignment so the user is never shown a contradictory
// "error + success" pair.
//
// r41 v384 (Tom Gilb 2026-06-26 — Option C of the S3-revised pair):
// 300_000 bumped to 350_000.  S3 (v383) set SDK timeout to 240_000 but
// that aborted legitimate 4-5 min generations before the honest loading-
// hint copy ("typically 60-180s; large or complex inputs can take 3-5
// minutes") promised the user it could take.  v384 raises SDK timeout
// to 320_000 (320 s, comfortably over the honest upper band) and
// bumps the watchdog to 350_000 (350 s = 5:50) so the SDK abort fires
// first with 30 s headroom for the catch+finally chain before the
// watchdog becomes the safety net.  Net mental model: a request takes
// up to ~5 min before the SDK gives up; the safety net is 30 s after
// that.  No silent retries (maxRetries: 0 in useSDK.ts:65) so the
// 320 s is the WHOLE wait — not the per-attempt wait.
const _HANG_WATCHDOG_MS = 350_000
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
      console.error(`[HangWatchdog] Loading state stuck for ${_HANG_WATCHDOG_MS / 1000}s — force-clearing.`, {
        sdkError: sdkError.value,
        stage: stage.value,
        hasPayload: !!pendingPayload.value,
      })
      // Hard-cancel the underlying fetch BEFORE clearing loading state.
      cancelCurrentTranslate()
      _forceClearLoading()
      _activeTranslateCallId = 0     // watchdog must also release the in-flight guard (S3 sweep 2026-06-26 — was _doTranslateInFlight)

      // Graceful fallback: if the user had a pending payload, draft a mock
      // spec from it so they can keep moving.  Otherwise show the error.
      // r41 v38 — Tom Gilb 2026-06-15 "said failed to complete generating" —
      // when the user typed ONLY a plan name (no stakes/ends/means) and
      // generation timed out, the previous code fell through to the bare
      // error message with no escape hatch.  Now we ALSO accept a plan-name-
      // only fallback: build a generic seed spec keyed off the plan title so
      // the user can at least START working + sharpen the rest.
      //
      // r41 v401 (Tom Gilb 2026-06-28 verbatim "retrograde, gigantic first
      // stakeholder, and 4 columns of parse disappeared"): apply the SAME
      // ≤200-char input gate the doTranslate-failure path got at v44
      // (App.vue:6520).  Without the gate, the watchdog dumped Tom's verbose
      // Indianapolis contract input into buildMockSpec — which `.split(/[,;]/)`s
      // the stakes string into comma fragments, producing a silly spec with
      // a gigantic first stakeholder containing the rest of the contract
      // text.  v44 quoted Tom verbatim "BETTER BEFORE": red-error-banner +
      // Retry beats a silly auto-mock for verbose input.  The watchdog path
      // had been firing the same silly path for ~12 days because the v44
      // gate was only applied to the doTranslate-failure path, not the
      // watchdog path.  v401 closes the gap.
      const payload = pendingPayload.value
      const planTitle = (specModel.value?.name ?? 'New Plan').trim()
      const hasPayloadContent = !!(payload && (payload.stakes || payload.ends || payload.means))
      const hasPlanName = planTitle.length > 0 && planTitle !== 'New Plan'
      const payloadCharCount = (payload?.stakes?.length ?? 0) + (payload?.ends?.length ?? 0) + (payload?.means?.length ?? 0)
      const inputIsShortEnough = payloadCharCount <= 200  // verbose → don't mock (v44 gate)
      // Fallback fires for plan-name-only OR very-short-payload — same shape
      // as the v44 doTranslate-failure path.
      const shouldRunFallback = hasPayloadContent
        ? inputIsShortEnough
        : hasPlanName
      if (shouldRunFallback) {
        try {
          // Prefer the user's own stakes/ends/means if present, otherwise seed
          // from the plan title so the spec is at least named correctly.
          // r41 v401 — also fixed precedence bug in the original seed
          // assignments: `a || b ? c : d` parses as `(a || b) ? c : d`, NOT
          // `a || (b ? c : d)`.  When payload.stakes existed AND hasPlanName,
          // the OLD code used planTitle instead of payload.stakes — burying
          // the user's actual input.  Parentheses added for clarity.
          const seedStakes = payload?.stakes || (hasPlanName ? planTitle : '')
          const seedEnds   = payload?.ends   || (hasPlanName ? `Successful delivery of ${planTitle}` : '')
          const seedMeans  = payload?.means  || ''
          const mockSpec = buildMockSpec(seedStakes, seedEnds, seedMeans)
          currentSpec.value = mockSpec
          stage.value = 2   // jump to Evo Plan view so the user sees their spec
          sdkError.value = ''
          const _slowMsg = hasPayloadContent
            ? '⚡ AI was slow — drafted a quick local spec from your input.  Press Sharpen on any dimension to refine, or 🆘 Reset to start fresh.'
            : `⚡ AI was slow — drafted a starter spec for "${planTitle}".  Sharpen any dimension to refine, or 🆘 Reset to start fresh.`
          showToast(_slowMsg, /* r41 v277 — 8s → 20s; important notifications must persist long enough for any reader to parse a multi-sentence message (Tom Gilb 2026-06-22 "be careful who you insult … no reason to disappear important messages that fast for anyone") */ 20000)
          // r41 v277 — also push to the persistent generation banner so Tom sees it on Stage 2 even after the toast dismisses
          lastGenerationReport.value = {
            ts:       Date.now(),
            kind:     'slow-fallback',
            headline: '⚡ AI was slow — local fallback spec drafted',
            detail:   _slowMsg,
          }
        } catch (err) {
          console.error('[HangWatchdog] buildMockSpec fallback also failed', err)
          sdkError.value = 'Generation took too long and the local fallback also failed. Press Generate Spec again to retry, or 🆘 Reset to start fresh.'
          stage1Sub.value = 'form'
        }
      } else if (hasPayloadContent && !inputIsShortEnough) {
        // r41 v401 — Verbose input + watchdog timeout: keep user at Stage 1
        // with the 4-column parse-review STILL VISIBLE, show retry-eligible
        // error banner.  Pre-v44 behaviour Tom preferred over the silly mock.
        sdkError.value = 'Generation took too long for your input size — press Generate Spec again to retry, or edit your input and re-parse.  Your 4-column parse review is preserved above.'
        stage1Sub.value = 'review'  // KEEP the chip view, don't reset to form
        console.info('[HangWatchdog] skipping local-fallback for verbose input — pre-v44 retry flow active', { chars: payloadCharCount })
      } else {
        sdkError.value = 'Generation took too long and was cancelled. Press Generate Spec again to retry, or 🆘 Reset to start fresh.'
        stage1Sub.value = 'form'
      }
      _hangWatchdog = null
    }, _HANG_WATCHDOG_MS)
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
        _activeTranslateCallId = 0  // S3 sweep 2026-06-26 — was _doTranslateInFlight
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
    // r41 v296 (Tom Gilb 2026-06-22 verbatim "it say no evo plan but i know
    // there is one, I have a copy"): persist the active in-memory Evo plan in
    // the session snapshot so it survives page reload.  Previously only
    // confirmedSteps (the EvoStep[] array) and the confirmation flag were
    // saved; the EvoStepPlan object itself (which EvoPlanView reads via
    // `plan.value?.steps`) lived in module-level state in useEvoPlan and reset
    // to null on every page reload — leaving the view stuck on "No Evo plan
    // yet" until the user manually re-generated OR restored a version from
    // history.  Pairing _saveSession with _loadEvoPlan() in _tryRestoreSession
    // below closes the loop: the plan that the planner generated stays loaded
    // across reloads automatically.
    evoPlan: _evoPlan.value,
  }
}

function _scheduleSave(): void {
  if (!currentSpec.value) return  // nothing worth saving yet
  if (_saveTimer) clearTimeout(_saveTimer)
  _saveTimer = setTimeout(() => { _saveSession(_buildSessionSnapshot()) }, 500)
  // v515 (2026-07-21) — Last-Effort Mirror: also schedule the IDB mirror flush
  // (30 s debounced).  Belt-and-braces to useSessionPersist: mirror survives
  // localStorage quota exhaustion because it lives in IDB (idbKv, Portfolio #1).
  _lastEffortMirror.scheduleFlush()
}

function _saveNow(): void {
  if (!currentSpec.value) return
  if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null }
  _saveSession(_buildSessionSnapshot())
  // v515 — flush the mirror immediately too (pagehide / visibilitychange /
  // beforeunload paths all reach here).  Non-blocking; runs in background.
  void _lastEffortMirror.flushNow()
}

// v515 (2026-07-21) — Last-Effort Mirror composable instance.
// Snapshot builder shares the useSessionPersist shape + adds view/planningStage
// explicitly (they were already there; kept for clarity).  IDB writes are async
// and non-blocking; failure is silent-logged (no user-visible banner) because
// the localStorage write via _saveSession above is the primary save path — the
// mirror is the survivor when the primary fails.
const _lastEffortMirror = useLastEffortMirror(() => ({
  planName: specModel.value?.spec?.plan?.name ?? currentSpec.value?.plan?.name,
  planningStage: planningStage.value,
  stage: stage.value,
  view: view.value,
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
}))

// v515 — mount-time restore-offer state.  On App.vue mount we check whether
// the IDB mirror is strictly newer than the localStorage session (via savedAt
// timestamps).  If yes, show a small non-blocking banner offering to restore
// the mirror.  User picks Restore, Dismiss, or ignores it — either way the
// choice is one click.  The banner does NOT auto-restore because silent
// state-replacement would violate No-Silent-Data-Loss SUPREME in reverse.
const mirrorRestoreOffered = ref(false)
const mirrorRestoreAgeLabel = ref('')
async function _checkMirrorAtMount(): Promise<void> {
  try {
    const sessionRaw = localStorage.getItem('sem-session-v2')
    const sessionSavedAt = sessionRaw
      ? (JSON.parse(sessionRaw) as { savedAt?: string }).savedAt ?? null
      : null
    const isNewer = await _lastEffortMirror.hasNewerMirror(sessionSavedAt)
    if (isNewer) {
      const m = await _lastEffortMirror.readMirror()
      if (m) {
        mirrorRestoreAgeLabel.value = mirrorAgeLabel(m.savedAt)
        mirrorRestoreOffered.value = true
      }
    }
  } catch (err) {
    console.warn('[last-effort-mirror] mount check failed', err)
  }
}
async function restoreFromMirror(): Promise<void> {
  const m = await _lastEffortMirror.readMirror()
  if (!m) { mirrorRestoreOffered.value = false; return }
  try {
    // Apply the mirror to current app state.  Field-by-field parity with
    // useSessionPersist's restore path (App.vue _tryRestoreSession) so the app
    // reaches an identical post-restore state regardless of which layer wins.
    if (m.currentSpec)       currentSpec.value = m.currentSpec
    if (m.markdown)          markdown.value = m.markdown
    if (m.originalInput)     originalInput.value = m.originalInput
    if (m.confirmedSteps)    confirmedSteps.value = m.confirmedSteps
    if (typeof m.evoPlanConfirmed === 'boolean') evoPlanConfirmed.value = m.evoPlanConfirmed
    if (m.tasksByStep)       tasksByStep.value = m.tasksByStep
    if (m.capturedImpactMatrix)  capturedImpactMatrix.value = m.capturedImpactMatrix
    if (m.capturedVCRatios)      capturedVCRatios.value = m.capturedVCRatios
    if (m.capturedCalendarCosts) capturedCalendarCosts.value = m.capturedCalendarCosts
    if (m.capturedCapitalCosts)  capturedCapitalCosts.value = m.capturedCapitalCosts
    // Stage refs — restore both the 11-step planning stage AND the inner stage
    if (typeof m.planningStage === 'number') planningStage.value = m.planningStage
    if (typeof m.stage === 'number')         stage.value = m.stage
    showToast(`✓ Restored last effort — ${mirrorRestoreAgeLabel.value}`, 4500)
  } catch (err) {
    console.warn('[last-effort-mirror] restore failed', err)
    showToast('Restore from last-effort mirror failed — see console.', 5000)
  } finally {
    mirrorRestoreOffered.value = false
  }
}
function dismissMirrorRestore(): void {
  // Do NOT clear the mirror — the auto-save watcher will overwrite it on next
  // state change anyway, and keeping it as a fallback until then is safer.
  mirrorRestoreOffered.value = false
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

// ── Pre-spec Save Draft (r41 v111) ─────────────────────────────────────────
// Tom Gilb 2026-06-17 verbatim "i think a whole line of actions like save
// are missing".  The Plan Crest v-if-gates on specModel; before the first
// generation there's no persistent save surface.  This pre-spec draft saves
// the planner's typed Plan Name / Owner Name / Specifications into
// localStorage so a browser reload doesn't lose typed work.  Auto-restored
// at mount when no specModel exists.
const PRESPEC_DRAFT_KEY = 'sem-prespec-draft-v1'

interface PreSpecDraft {
  planName?: string
  ownerName?: string
  specifications?: string
  savedAt?: string
}

function savePreSpecDraft(): void {
  try {
    // Read visible inputs from the DOM — the form may have multiple input
    // fields; we use aria-label / placeholder selectors to find them robustly.
    const planEl = (document.querySelector('input[placeholder*="Improve Crew" i], input[placeholder*="Plan" i][placeholder*="Name" i]') as HTMLInputElement | null)
    const ownerEl = (document.querySelector('input[placeholder*="Tom Gilb" i], input[placeholder*="Owner" i]') as HTMLInputElement | null)
    const specEl = (document.querySelector('textarea[placeholder*="specifications" i], textarea[placeholder*="reduce churn" i]') as HTMLTextAreaElement | null)
    const draft: PreSpecDraft = {
      planName:       planEl?.value  ?? '',
      ownerName:      ownerEl?.value ?? '',
      specifications: specEl?.value  ?? '',
      savedAt:        new Date().toISOString(),
    }
    localStorage.setItem(PRESPEC_DRAFT_KEY, JSON.stringify(draft))
    const wordCount = (draft.specifications ?? '').trim().split(/\s+/).filter(Boolean).length
    const summary = [
      draft.planName ? `Plan: "${draft.planName}"` : '',
      draft.ownerName ? `Owner: ${draft.ownerName}` : '',
      wordCount > 0 ? `${wordCount} ${wordCount === 1 ? 'word' : 'words'} of specifications` : '',
    ].filter(Boolean).join(' · ')
    showToast(`💾 Draft saved · ${summary || '(empty)'} — restored on next visit`, 5000)
    console.info('[savePreSpecDraft]', draft)
  } catch (err) {
    console.error('[savePreSpecDraft] failed', err)
    showToast('⚠ Draft save failed — see DevTools', 4500)
  }
}

/**
 * Restore the pre-spec draft into the form on mount when no spec is loaded.
 * Sets the pending-* refs (which the SEMEntryForm reads on mount via the
 * existing prepopulate pathway).  Safe: if the draft is empty or malformed
 * the fields stay blank.
 */
function _restorePreSpecDraft(): void {
  try {
    const raw = localStorage.getItem(PRESPEC_DRAFT_KEY)
    if (!raw) return
    const draft = JSON.parse(raw) as PreSpecDraft
    if (draft.planName)  pendingPlanName.value  = draft.planName
    if (draft.ownerName) pendingOwnerName.value = draft.ownerName
    if (draft.specifications) pendingGenesisRepopulate.value = {
      stakes: draft.specifications,
      ends:   '',
      means:  '',
    }
    if (draft.planName || draft.ownerName || draft.specifications) {
      const stamp = draft.savedAt ? new Date(draft.savedAt).toLocaleString() : 'earlier'
      showToast(`📂 Draft restored from ${stamp} — clear with 🆘 Reset if you want to start over`, 5500)
      console.info('[restorePreSpecDraft]', draft)
    }
  } catch (err) {
    console.warn('[restorePreSpecDraft] failed', err)
  }
}

// ── Start fresh ───────────────────────────────────────────────────────────────

function startFresh(opts?: { force?: boolean }): void {
  // v520 (2026-07-21) — Tom Gilb "I clicked edit and saw all previous data
  // gone. I started filling out deadline, and it suddenly on its own jumped
  // back to stage 1".  Another silent Stage 10 → Stage 1 reset while Tom was
  // ACTIVELY TYPING.  v514's guard covered ONLY the Escape-key path; other
  // callers of startFresh() (2-tap-confirm at line 6187, search-palette
  // command at 9155, Blank Canvas option at 9471, goToStage1() at 6441) can
  // still nuke Stage 6-11 work with no user consent.  HARD GUARD: when
  // planningStage >= 6 AND currentSpec exists AND caller did NOT pass
  // {force: true}, refuse + toast + log the caller stack for retro-diagnosis
  // (persisted via v514 breadcrumb pattern).  Legitimate resets (user pressed
  // 🆘 SOS explicitly, Blank Canvas, etc.) pass {force: true}.
  const stageAtEntry = planningStage.value
  if (!opts?.force && stageAtEntry >= 6 && currentSpec.value) {
    try {
      const err = new Error('startFresh suppressed at Stage ' + stageAtEntry)
      const stack = (err.stack ?? '').split('\n').slice(0, 12).join('\n')
      const entry = {
        ts: new Date().toISOString(),
        event: 'startFresh-suppressed',
        planningStage: stageAtEntry,
        specPresent: !!currentSpec.value,
        stack,
      }
      const w = window as unknown as { _semStateLog?: Array<typeof entry> }
      if (!w._semStateLog) w._semStateLog = []
      w._semStateLog.push(entry)
      if (w._semStateLog.length > 20) w._semStateLog.shift()
      try { localStorage.setItem('sem-state-log-v1', JSON.stringify(w._semStateLog)) } catch { /* quota */ }
      console.warn('[startFresh guard] suppressed at Stage', stageAtEntry, entry)
    } catch { /* diag noop */ }
    showToast(
      `⚠ Reset suppressed at Stage ${stageAtEntry} — press 🆘 SOS in the title bar to reset explicitly, or refresh Safari to keep working.`,
      8000,
    )
    return
  }
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
    // Second confirmation — execute.  User has explicitly confirmed via 2-tap
    // sequence so v520 stage-guard is bypassed (force: true).
    if (_startOverConfirmTimer !== null) { clearTimeout(_startOverConfirmTimer); _startOverConfirmTimer = null }
    startOverConfirmPending.value = false
    startFresh({ force: true })
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
  //
  // r41 v421 (Tom Gilb 2026-07-01 verbatim *"i was in contracts trying to load
  // Indianapolis and it jumped back here"*) — STRUCTURAL fix, third strike on
  // the "Contracts overlay yanked from under the user" class-bug (v390
  // refresh-side hydration, v416 parse-time stage watcher, v421 load-contract
  // stage cascade).  The prior v416 guard checked `_activeMode.value` — but
  // `_activeMode` is set only via the mode-picker governance dialog; most
  // paths that open Contracts (agents strip, contract card, deep-link, session
  // restore) set `contractsOpen = true` without touching `_activeMode`.  So
  // `_activeMode` stayed `'plan'`, matched `!== 'contract'`, and the guard
  // closed Contracts anyway.  Structural fix: use `contractsOpen.value` ITSELF
  // as the guard.  If the Contracts overlay is currently open, the user IS
  // inside Contracts — regardless of what `_activeMode` claims — and stage-
  // side cascades must NOT yank it out from under them.  The overlay's own
  // legitimate close paths remain intact: CloseDot in ContractHub's header
  // (`@close="contractsOpen = false"`), the mode-switch governance dialog,
  // Panic SOS reset (see `panicReset` below which closes it unconditionally),
  // and explicit user actions.  Composes with No-Silent-Removal SUPREME
  // (Contracts is a permanent surface for the mode; stage cascade is NOT a
  // legitimate remove authority), Tom-Repeats-Himself SUPREME (third strike
  // → structural fix, not another conditional patch), Trace-Before-Patch
  // SUPREME (root cause was `_activeMode` being the wrong signal; the
  // right signal is the overlay's own visibility).  Same reasoning applies
  // to model mode; but modelLibraryOpen currently doesn't participate in
  // this close, so it stays out of the guard until a matching Tom report.
  if (!contractsOpen.value) {
    // Overlay not open — nothing to preserve.
  } else {
    // Overlay IS open — user is inside Contracts.  Do NOT close from a
    // stage-side cascade.  Legitimate close paths (CloseDot, governance,
    // Panic SOS) still work because they call `contractsOpen = false`
    // directly, not through this helper.
  }
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
function panicReset(opts?: { force?: boolean }): void {
  // v520 (2026-07-21) — hard guard on all panicReset callers, not just Escape.
  // Tom Gilb 2026-07-21 verbatim (after v514 Escape-guard was already live):
  // "I clicked edit and saw all previous data gone. I started filling out
  // deadline, and it suddenly on its own jumped back to stage 1".  Another
  // silent Stage 10 → Stage 1 reset WHILE TYPING.  v514 guarded ONLY the
  // Escape-key path.  Any other caller (search palette, FreshStart Opt 4,
  // 🆘 button, whatever fires panicReset next) can still nuke Stage 6-11
  // work with no consent.  Same guard shape as startFresh(): stageAtEntry
  // >= 6 && currentSpec && !force → refuse + toast + log the caller stack.
  const stageAtEntry = planningStage.value
  if (!opts?.force && stageAtEntry >= 6 && currentSpec.value) {
    try {
      const err = new Error('panicReset suppressed at Stage ' + stageAtEntry)
      const stack = (err.stack ?? '').split('\n').slice(0, 12).join('\n')
      const entry = {
        ts: new Date().toISOString(),
        event: 'panicReset-suppressed',
        planningStage: stageAtEntry,
        specPresent: !!currentSpec.value,
        stack,
      }
      const w = window as unknown as { _semStateLog?: Array<typeof entry> }
      if (!w._semStateLog) w._semStateLog = []
      w._semStateLog.push(entry)
      if (w._semStateLog.length > 20) w._semStateLog.shift()
      try { localStorage.setItem('sem-state-log-v1', JSON.stringify(w._semStateLog)) } catch { /* quota */ }
      console.warn('[panicReset guard] suppressed at Stage', stageAtEntry, entry)
    } catch { /* diag noop */ }
    showToast(
      `⚠ Reset suppressed at Stage ${stageAtEntry} — press 🆘 SOS in the title bar to reset explicitly, or refresh Safari to keep working.`,
      8000,
    )
    return
  }
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
    hasSpec: !!currentSpec.value,
  })
  // (1) Get the user OUT of any stuck auth/loading view immediately.
  if (view.value !== 'app') view.value = 'app'
  // (2) Close every overlay we know about.
  _closeAllOverlays()
  // r41 v421 — _closeAllOverlays no longer touches `contractsOpen` (structural
  // fix so stage-side cascades can't yank the user out of Contracts).  Panic
  // SOS IS a legitimate authority to close every overlay including Contracts,
  // so we do it explicitly here.  Same for modelLibraryOpen if needed later.
  contractsOpen.value = false
  // (3) Force-clear ALL loading keys regardless of finally blocks.
  _forceClearLoading()
  // (4) Clear stale SDK error so the next Generate isn't blocked visually.
  sdkError.value = ''

  // r41 v364 (Tom Gilb 2026-06-25 screenshot showing the entry form
  // PRE-POPULATED with "15 Light Cruisers Build" + "President of the United
  // States" + contract text AFTER pressing 🆘 SOS): panicReset previously
  // only handled stuck-loading-state recovery and DID NOT wipe the spec /
  // form data.  Tom's expectation (and what 🆘 SOS visually promises): a
  // FULL reset to a blank workspace.  This block wipes every data ref that
  // would otherwise persist into the next session — mirrors startFresh()'s
  // data-wipe responsibilities exactly so the two reset paths converge on
  // the same end state.
  formResetKey.value++           // force SEMEntryForm to remount (clears its internal rawInput / planName / ownerName)
  formSubStage.value = 'input'   // reset mirrored sub-stage
  _clearSession()                // wipe persisted session blob
  sessionRestored.value = false
  currentSpec.value = null
  specGeneratedAt.value = null
  sharpeningDone.value = false
  clearPlanModel()
  clearComparison()
  comparisonOpen.value = false
  specInputOpen.value  = false
  markdown.value = ''
  originalInput.value = null
  planningStage.value = 1
  confirmedSteps.value = []
  evoPlanConfirmed.value = false
  tasksByStep.value = {}
  capturedImpactMatrix.value = {}
  capturedVCRatios.value = {}
  capturedCalendarCosts.value = {}
  capturedCapitalCosts.value = {}
  collaboratorOpen.value = false
  streamingText.value = ''       // v352 streaming accumulator
  // v364 — clear Safety Net drafts so SEMEntryForm's onMounted auto-restore
  // (v332 — `if (!rawInput.value && getLatestDraft('sem-home-input'))`) does
  // NOT re-hydrate the just-wiped form on its next remount.  Without this,
  // formResetKey++ remounts the form, onMounted fires, getLatestDraft sees
  // the previous session's contract text in localStorage, and pre-populates
  // rawInput — exactly the bug Tom screenshotted.  Direct localStorage
  // delete is the cleanest reset path; the composable's STORAGE_KEY constant
  // is internal so we use the literal key (kept in sync with the file).
  try {
    localStorage.removeItem('sem-app:input-safety-net:v1')
    localStorage.removeItem('sem-app:input-safety-net:dismissed:v1')
  } catch { /* localStorage may be blocked; SOS reset must never throw */ }
  // Aperture mode reset (parity with startFresh)
  if (aperture.enabled.value) aperture.backToPlan()

  // (5) Drop back to the entry form (sub-stage 'form' renders the SEMEntryForm).
  stage1Sub.value = 'form'
  // (6) Re-anchor stage to 1 so the user lands on the canonical home.
  stage.value = 1
  // (7) Clear in-flight translate guard so a second Generate isn't refused.
  _activeTranslateCallId = 0  // S3 sweep 2026-06-26 — was _doTranslateInFlight
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
  // r41 v102 (Tom Gilb 2026-06-16 verbatim "total failure to go to stage 2
  // even after successful stage 1") — root cause: this function was firing
  // startFresh() (which wipes currentSpec) whenever called with stage.value
  // === 1 && currentSpec.value, regardless of WHY it was called.  But the
  // stage-bar handler routes EVERY click on stages 1-4 through 'to-spec'
  // → goToStage1() because all four spec-editor stages share the same
  // underlying view (stage.value = 1).  So when Tom clicked stage 2 with a
  // generated spec already showing, this fired startFresh() and bounced
  // him back to a blank form — total nav failure.
  //
  // Fix: only trigger startFresh()-and-repopulate when the breadcrumb
  // explicitly TARGETS stage 1 (planningStage.value === 1).  Otherwise
  // just close overlays + set stage.value = 1 silently (the spec editor
  // for stages 2, 3, 4 navigates within stage.value=1 with the breadcrumb
  // marking the conceptual stage 2/3/4).  The r16 "press Stage 1 from
  // Stage 1 review = start fresh" behaviour is preserved — it only fires
  // when the user actually clicks Stage 1.
  const goingToStage1 = planningStage.value === 1
  if (goingToStage1 && stage.value === 1 && currentSpec.value) {
    // r16 2026-06-09: user pressed Stage 1 bar while already reviewing a spec — they want
    // to go back and re-generate ("unhappy with volume, pressed stage 1 button, nothing").
    // Fix: stash originalInput, then startFresh() (which clears currentSpec + calls
    // _closeAllOverlays internally) so the entry form mounts pre-filled for easy retry.
    const genesis = originalInput.value
    startFresh()
    if (genesis) pendingGenesisRepopulate.value = genesis
  } else {
    _closeAllOverlays()
    stage.value = 1
  }
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
      // Tom 2026-06-07 r26: Sequential one-at-a-time stage navigation —
      // advance planningStage by exactly 1 each click (1→2→3→4→5→6→…).
      // handleStageBarNav resolves the correct internal stage view transition
      // (spec view for stages 1–5, EvoPlanView for stage 6, etc.)
      // and enforces the sharpening-round guard before jumping to Evo stages.
      handleStageBarNav(planningStage.value + 1)
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
    if (currentSpec.value) {
      // r26 (2026-06-07): sequential label — shows the name of the NEXT planning
      // stage so the user knows exactly where Next will take them (never "Plan Evo
      // Steps" when still in spec stages 1-4).
      const nextStageLabels: Record<number, string> = {
        1: 'Edit Solutions', 2: 'Sharpen Spec', 3: 'Estimate Impacts',
        4: 'Refine Spec',    5: 'Plan Evo Steps',
      }
      return nextStageLabels[planningStage.value] ?? 'Plan Evo Steps'
    }
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
  // r41 v226 (Tom Gilb 2026-06-19 verbatim "sharpening risks worked 5
  // answerds, it added several solutions, then it bombbed out of the
  // window") — apply succeeded (solutions were added) but a downstream
  // step crashed silently and closed the panel.  Wrap every post-apply
  // side-effect in its own try/catch so ONE failed step (serialise,
  // addVersion / localStorage quota, bumpSpecVersion, provenance write)
  // does NOT cascade into closing the panel and looking like an unrelated
  // bomb-out.  Each failure surfaces as a console.warn + non-blocking
  // toast so Tom can see WHICH step failed next time and bank the trace.
  // Composes with: No-Dodging-Ambiguous-Bugs SUPREME (no more silent
  // throws bombing the UI), No-Silent-Data-Loss SUPREME (the spec mutation
  // ALWAYS lands even if a downstream step fails; the user keeps their
  // sharpened result), Universal Undo SUPREME (undo.record is in its own
  // guard so a failure there doesn't lose the spec change).
  const specModelId = specModel.value?.id
  const beforeSpec  = currentSpec.value
  const lastRound   = sharpenRounds.value[sharpenRounds.value.length - 1]
  const inputWords  = lastRound
    ? lastRound.answers.reduce((sum, a) => sum + countWords(a), 0)
    : 0
  const sharpenLabel = lastRound?.category.label

  // 1. Universal Undo — record BEFORE mutation.  Failure here is non-fatal:
  //    the spec change still applies; only the Undo entry is missing.
  if (beforeSpec) {
    try {
      undoHistory.record({
        label:    sharpenLabel ? `Sharpened: ${sharpenLabel}` : 'Sharpened',
        source:   'Sharpen',
        prevSpec: JSON.parse(JSON.stringify(beforeSpec)) as SpecBlock,
        nextSpec: JSON.parse(JSON.stringify(refined))    as SpecBlock,
      })
    } catch (err) {
      console.warn('[onSpecSharpened] Undo.record failed:', err)
      showToast(`⚠ Undo entry skipped — ${err instanceof Error ? err.message : 'serialisation failure'}`, 5000)
    }
  }

  // 2. Apply the refined spec — this is the critical step.  Always commit.
  currentSpec.value = refined

  // 3. Past Versions — addVersion writes to sem-spec-history-v1 localStorage.
  //    Quota-exceeded throws here would previously bomb the panel; now
  //    surfaces as a toast and the live spec stays applied.
  try {
    addVersion(refined, 'Sharpened', _evoPlan.value as EvoStepPlan | null, specModel.value?.name ?? '', _specOwnerNames())
  } catch (err) {
    console.warn('[onSpecSharpened] addVersion failed:', err)
    showToast(`⚠ Past Versions write failed — ${err instanceof Error ? err.message : 'localStorage may be full'}`, 5000)
  }

  // 4. Markdown serialise — if a refined entry is malformed (missing required
  //    field), serialise might throw.  Don't let that close the panel.
  try {
    markdown.value = serialise(refined)
  } catch (err) {
    console.warn('[onSpecSharpened] serialise failed:', err)
    showToast(`⚠ Markdown render skipped — ${err instanceof Error ? err.message : 'malformed entry'}`, 5000)
  }

  // 5. Bump spec model version (0.1 → 0.2 → …)
  try {
    bumpSpecVersion(refined)
  } catch (err) {
    console.warn('[onSpecSharpened] bumpSpecVersion failed:', err)
  }

  // 6. Sharpen provenance — diff silently, no UI impact.  Failure here is
  //    purely a missing audit-trail entry; spec stays applied.
  if (specModelId && beforeSpec) {
    try {
      recordSharpenProvenance(specModelId, beforeSpec, refined, {
        humanInputWords: inputWords,
        label:           sharpenLabel,
      })
    } catch (err) {
      console.warn('[onSpecSharpened] recordSharpenProvenance failed:', err)
    }
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
 * Apply approved StrategyAgent improvements back into the spec.
 * Each improvement carries a targetEntryId (S. entry) + newFieldValues.
 * After patching, routes through onSpecSharpened for versioning + history.
 * Tom Gilb 2026-06-09 — Strategy Agent Tool.
 */
function applyStrategyImprovements(
  improvements: import('./data/strategySharpenDimensions').StrategyImprovement[]
): void {
  if (!currentSpec.value || improvements.length === 0) return
  const updated = JSON.parse(JSON.stringify(currentSpec.value)) as typeof currentSpec.value
  let changed = 0
  for (const imp of improvements) {
    if (!imp.targetEntryId || !imp.newFieldValues) continue
    // Find matching solution entry (match on id field)
    const sol = updated.solutions?.find((s: { id: string }) => s.id === imp.targetEntryId)
    if (sol) {
      Object.assign(sol, imp.newFieldValues)
      changed++
    }
  }
  if (changed > 0) {
    onSpecSharpened(updated)
    // r93x — Universal Undo P2: toast-level [Undo] action
    showToast(`✓ ${changed} strategy improvement(s) applied to spec.`, 5000, { label: '[Undo]', handler: handleGlobalUndo })
  }
}

/**
 * r41 v91 (Tom Gilb 2026-06-16) — Strategy Agent history-picker handler.
 * The panel emits `select-history` with a SpecVersion id; we look it up via
 * useSpecHistory.restoreVersion (deep-cloned spec + plan), then route it
 * through the existing onHistoryRestore flow so the spec model + plan +
 * sharpen rounds all swap together exactly the way the global History panel
 * does.  Strategy Agent stays open (does NOT auto-close) — Tom can immediately
 * re-analyze the newly-loaded plan.
 */
function handleStrategyAgentHistoryPick(versionId: string): void {
  const sv = specHistory.value.find((v) => v.id === versionId)
  if (!sv) return
  onHistoryRestore(
    JSON.parse(JSON.stringify(sv.spec)),
    sv.plan ? JSON.parse(JSON.stringify(sv.plan)) : null,
    sv.specName ?? sv.planName ?? '',
    sv.specOwners ?? sv.planOwners ?? [],
    // v514 — envelope round-trip
    sv.resourcesEnvelope ? JSON.parse(JSON.stringify(sv.resourcesEnvelope)) : null,
  )
}

/**
 * Called when the SharpenPanel modal emits 'done' (user clicked "Done sharpening"
 * or CloseDot). Closes the modal and shows a toast so the user gets clear
 * confirmation that sharpening was applied — "no feedback" fix (r26, 2026-05-19).
 *
 * r41 v399 (Tom Gilb 2026-06-28 verbatim "I said done sharpening, then it
 * should have move to show me results of sharpening, but it want to
 * sharpening"): three behaviour upgrades on Done click —
 *   1. Mark Stage 2.3 done via the explicit user-intent flag so the substep
 *      strip shows ✓ and the NEXT pointer advances, even when no Apply fired
 *      inside the modal (e.g. planner reviewed and decided nothing needed
 *      sharpening this round).
 *   2. Auto-advance `stage2SubStep` from '2.3' to '2.4' so the next-step
 *      indicator reflects forward motion immediately.
 *   3. Always show a results toast — when N > 0, "N rounds applied" with
 *      Undo; when N === 0, "No changes applied this round — 2.3 marked
 *      done" so the planner sees an explicit acknowledgement instead of
 *      a silent close (No-Silent-Data-Loss SUPREME applied to flow state).
 */
function handleSharpenModalDone(): void {
  sharpenModalOpen.value = false
  // r41 v399 — honour Tom's explicit "Done" intent regardless of changes.
  // r41 v400 — same pattern extended to Stage 3.2 (also opens this same
  // SharpenPanel modal at App.vue:3625 — onStage3SubStepGo case '3.2').
  let advancedLabel = ''  // empty → no substep advance happened
  if (planningStage.value === 2 && stage2SubStep.value === '2.3') {
    stage2_3UserMarkedDone.value = true
    stage2SubStep.value = '2.4'
    advancedLabel = 'Stage 2.3 done · advanced to 2.4'
  } else if (planningStage.value === 3 && stage3SubStep.value === '3.2') {
    stage3_2UserMarkedDone.value = true
    // Stage 3 only has 3.1 → 3.2 → 3.3 — advance to 3.3.
    stage3SubStep.value = '3.3'
    advancedLabel = 'Stage 3.2 done · advanced to 3.3'
  }
  const n = sharpenRounds.value.length
  if (n > 0) {
    // r93x — Universal Undo P2: toast-level [Undo] action
    const suffix = advancedLabel ? ` — ${advancedLabel}` : ''
    showToast(`🔪 ${n} sharpening round${n !== 1 ? 's' : ''} applied${suffix}`, 6000, { label: '[Undo]', handler: handleGlobalUndo })
  } else if (advancedLabel) {
    showToast(`🔪 No changes applied this round — ${advancedLabel.replace(' done · advanced to ', ' marked done · advanced to ')}`, 5000)
  }
  // If neither Stage 2.3 nor Stage 3.2 was the active context (rare — e.g.
  // Sharpen opened from a navbar dropdown outside the substep flow), the
  // toast only fires when changes were applied; no substep advance happens.
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
  // r41 v208 — commit the pending raw-initial-input snapshot to the new
  // spec model's per-id key.  Stage happens in GetAPlanPanel before the
  // import; this transfer completes the bridge so the planner can ALWAYS
  // come back to "what I gave it" via the per-spec storage key.
  if (specModel.value?.id) commitPendingInitialInput(specModel.value.id)
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
 * Called when GetAPlanPanel emits 'imported-with-meta' (r25, Tom 2026-06-07).
 * Imports the spec then immediately applies the user-supplied plan name and/or
 * owner name. Supports "name a project early, before input and parsing".
 */
function handlePlanImportedWithMeta(
  spec: SpecBlock,
  meta: { planName: string; ownerName: string },
): void {
  handlePlanImported(spec)
  if (meta.planName && specModel.value) {
    renameSpecModel(specModel.value.id, meta.planName)
  }
  if (meta.ownerName) {
    const today = new Date().toISOString().slice(0, 10)
    addOwner({
      name: meta.ownerName, email: '', phone: '', organization: '',
      location: '', responsibility: '', startDate: today, endDate: '',
    })
  }
}

/**
 * Called when GetAPlanPanel emits 'imported-and-sharpen-with-meta' (r25).
 * Same as handlePlanImportedWithMeta but opens the SharpenPanel immediately.
 */
function handlePlanImportedAndSharpenWithMeta(
  spec: SpecBlock,
  meta: { planName: string; ownerName: string },
): void {
  handlePlanImportedWithMeta(spec, meta)
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

  // r93x — Universal Undo P2 sweep: record before mutation
  undoHistory.record({
    label:    `Spec Import: merged ${imported.functions?.length ?? 0} F. / ${imported.values?.length ?? 0} V. / ${imported.solutions?.length ?? 0} S.`,
    source:   'SpecImporter',
    prevSpec: JSON.parse(JSON.stringify(currentSpec.value)) as SpecBlock,
    nextSpec: JSON.parse(JSON.stringify(merged))            as SpecBlock,
  })
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
  // Restore genesis input so Stage 1 "What you wrote" reflects THIS plan's original input.
  // Tom 2026-06-09: genesis is now persisted in the SpecModel so it survives across sessions.
  originalInput.value = model.genesis
    ? { stakes: model.genesis.stakes, ends: model.genesis.ends, means: model.genesis.means }
    : null
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
  // v514 — pass the SpecVersion's Resources envelope through so
  // handleGetAPlan restore paths keep full round-trip fidelity.
  onHistoryRestore(sv.spec, sv.plan, sv.planName ?? '', sv.planOwners ?? [], sv.resourcesEnvelope)
  specInputOpen.value = false
}

/**
 * Called when SpecOutput emits 'reparse' — user wants to edit the genesis
 * Stakes/Ends/Means and regenerate the spec.  Pre-fills SEMEntryForm and
 * scrolls back to stage 1.
 * Tom Gilb 2026-06-09: "initial input specs she got parsed were gone — go back to the genesis."
 */
function handleReParse(genesis: { stakes: string; ends: string; means: string }): void {
  if (semEntryFormRef.value) {
    // Form is already mounted (we're already on Stage 1 with both form and spec visible).
    semEntryFormRef.value.prefillGenesis(genesis)
  } else {
    // Form not yet in DOM — stash and the semEntryFormRef watcher will apply on mount.
    pendingGenesisRepopulate.value = genesis
  }
  stage.value = 1
  window.scrollTo({ top: 0, behavior: 'smooth' })
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

async function handleSubmit(payload: { stakes: string; ends: string; means: string; wish?: string; wishStakeholder?: string; planName?: string; ownerName?: string }) {
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
  // 350-second watchdog already fired on; v384 — was 300s prior to v384), the
  // guard would otherwise block this new attempt silently.
  // S3 sweep 2026-06-26 — Tom "do stability first":
  // the OLD comment said "the finally race is harmless (both paths set it
  // false)" but it was NOT harmless: an old promise's late finally could
  // clobber a NEW call's guard, opening a window for two concurrent
  // Anthropic calls (token spend doubled).  Monotonic call-ID architecture
  // (`_activeTranslateCallId` + per-call `_myCallId` capture) closes that
  // window: each finally only resets if it's still the active call.  Force-
  // clear here remains correct — we WANT to nuke any stale state on a
  // fresh top-level Generate.
  _activeTranslateCallId = 0

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

  // Stash plan name + owner name for post-generation application (Tom 2026-06-08)
  pendingPlanName.value  = payload.planName  ?? null
  pendingOwnerName.value = payload.ownerName ?? null

  // r41 v70 (Tom Gilb 2026-06-16 screenshot "I started generating and 2x it
  // aborted and jumped back here to start") — pendingPayload was only being
  // stashed in PRECISE mode.  In "Just do it" mode (the path Tom uses), it
  // was never set, so when the HangWatchdog fired it saw `hasPayload: false`
  // and dropped Tom back to the empty form instead of building the safety-
  // net mock spec from his input.  Fix: stash pendingPayload UNCONDITIONALLY
  // so the watchdog (and any other recovery path) can always recover.
  pendingPayload.value = { stakes: payload.stakes, ends: payload.ends, means: payload.means }
  if (analysisMode.value === 'precise') {
    // Stash the payload and go to the clarification sub-stage
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

// ── Generation-time fieldSources stamping ────────────────────────────────────
// Tom Gilb 2026-06-09: "when we now generate specs, and spec parameters like
// Scale, is the logic there to append the source (ideally, like this:
// SEM, Stage 1, Based on User Script, 9June26 19:04)"

/** Format a date as Tom's preferred short form: "9Jun26 19:04" */
function _formatShortDate(d: Date): string {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const day = d.getDate()
  const mon = months[d.getMonth()]
  const yr  = String(d.getFullYear()).slice(2)
  const hh  = String(d.getHours()).padStart(2, '0')
  const mm  = String(d.getMinutes()).padStart(2, '0')
  return `${day}${mon}${yr} ${hh}:${mm}`
}

/**
 * Stamp per-field `fieldSources` on every entry of a freshly generated SpecBlock.
 * Only stamps non-empty string fields — leaves empty/undefined fields un-attributed.
 * Pure function: returns a new SpecBlock, does not mutate input.
 *
 * Source label follows Tom's preferred format:
 *   "SEM Stage 1, Based on User Script, 9Jun26 19:04"
 */
function stampGenerationFieldSources(spec: SpecBlock, generatedAt: Date): SpecBlock {
  // r41 v415 (Source Attribution SUPREME sweep) — Stage 1 LLM generation is
  // Class A (raw-text sourced from planner's typed stakes / brief).
  const fs: FieldSource = {
    source:     `SEM Stage 1, Based on User Script, ${_formatShortDate(generatedAt)}`,
    sourceType: 'ai',
    timestamp:  generatedAt.toISOString(),
    tool:       'SEM LLM Parser',
    stage:      'plan-stage-1-input',
  }

  /** Stamp every non-empty string field in `fields` with the generation FieldSource. */
  function stampEntry<T extends { fieldSources?: Record<string, FieldSource> }>(
    entry: T,
    fields: (keyof T & string)[],
  ): T {
    const merged: Record<string, FieldSource> = { ...(entry.fieldSources ?? {}) }
    for (const f of fields) {
      const v = entry[f]
      if (typeof v === 'string' && v.trim()) merged[f] = fs
    }
    return { ...entry, fieldSources: merged }
  }

  return {
    ...spec,
    functions:   (spec.functions   ?? []).map(e => stampEntry(e, ['description', 'presenceTest', 'functionOfValue', 'level', 'stakeholders'])),
    values:      (spec.values      ?? []).map(e => stampEntry(e, ['description', 'scale', 'meter', 'status', 'tolerable', 'goal', 'wish', 'wishStakeholder', 'valueOfFunction', 'level', 'stakeholders', 'forecast', 'statusWhen', 'tolerableWhen', 'goalWhen', 'wishWhen'])),
    solutions:   (spec.solutions   ?? []).map(e => stampEntry(e, ['description', 'impact', 'function', 'impactsValues', 'impactsCosts', 'level', 'stakeholders'])),
    constraints: (spec.constraints ?? []).map(e => stampEntry(e, ['description', 'scope', 'rationale', 'source', 'level', 'stakeholders'])),
    resources:   (spec.resources   ?? []).map(e => stampEntry(e, ['description', 'scale', 'meter', 'status', 'tolerable', 'goal', 'budget', 'wish', 'wishStakeholder', 'level', 'stakeholders', 'forecast'])),
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
//
// 2026-06-26 S3 stability sweep — Tom: "do stability first" after the
// 292s "endless generation" report.  Replaced boolean guard with monotonic
// call-ID so a LATE-arriving finally from an old promise (one that the
// watchdog already cleared at 350s — v384; was 300s — but that Anthropic
// eventually settles later) cannot clear the guard of a NEW call in flight.
// The
// old `_doTranslateInFlight = false` in the late finally would have
// opened a window for two concurrent Anthropic calls — token spend
// doubled, loading state corrupt.  Now each doTranslate captures its
// own `_myCallId` and the finally only resets the active ID iff it's
// still the active call (i.e. nothing has taken over).  Force-clear
// reset paths (SOS / hardReset / launchDemo / watchdog / etc.) set the
// active ID to 0 unconditionally — same semantic as before.
let _activeTranslateCallId = 0
let _nextTranslateCallId   = 1

/** Runs the actual translation, optionally with clarification answers */
async function doTranslate(
  payload: { stakes: string; ends: string; means: string },
  clarifications?: string,
): Promise<void> {
  if (_activeTranslateCallId !== 0) {
    console.warn('[doTranslate] Refused — a previous translation is still in flight. Press 🆘 Reset to clear.', { activeCallId: _activeTranslateCallId })
    return
  }
  const _myCallId = _nextTranslateCallId++
  _activeTranslateCallId = _myCallId
  console.info('[doTranslate] starting', { callId: _myCallId, stakes: payload.stakes.slice(0, 60), endsLen: payload.ends.length, hasClarifications: !!clarifications })
  // Evo Step 10: capture start time before the API call for EntryFluency + logSpecGenerated
  const _translateStart = Date.now()
  startLoading('sdk:translate', 'Translating your plan…')
  let succeeded = false
  try {
    // r41 v372 (Tom Gilb 2026-06-25 — Diagnostics confirmed translateStream
    // hangs the FULL 5-min watchdog timeout in Safari PWA with large inputs
    // [userContentLen:63225, systemLen:69767]; no STAGE: post-create EVER
    // logged → `await client.beta.messages.create({stream:true})` never
    // resolved).  The translateStream path is BLOCKING — watchdog fires
    // before translate() fallback can run.  Reverted to translate() ONLY
    // (v357 pattern).  v371's time-keyed animation provides the "dynamic
    // count during generation" UX without depending on streaming.  When
    // Safari PWA SSE works (future SDK version / browser version), restore
    // translateStream by re-introducing the dual-path fallback here.
    streamingText.value = ''
    const spec = await translate(payload.stakes, payload.ends, payload.means, clarifications)
    if (spec) {
      // Change 3 — attach Wish to all V. entries when the user provided one
      const wish = pendingWish.value
      const _wishAnnotated = wish
        ? {
            ...spec,
            values: spec.values.map((v) => ({
              ...v,
              wish: v.wish ?? wish.wish,
              wishStakeholder: v.wishStakeholder ?? wish.wishStakeholder,
            })),
          }
        : spec
      // Stamp per-field fieldSources for all generated entries.
      // Tom Gilb 2026-06-09: "when we now generate specs, and spec parameters like
      // Scale, is the logic there to append the source (ideally, like this:
      // SEM, Stage 1, Based on User Script, 9June26 19:04)"
      const _generatedAt  = new Date()
      const annotatedSpec = stampGenerationFieldSources(_wishAnnotated, _generatedAt)
      currentSpec.value   = annotatedSpec
      specGeneratedAt.value = _generatedAt   // Feature #177 — capture generation timestamp
      // r41 v61 (Tom Gilb 2026-06-16 screenshot "timedout, but did work a moment ago"):
      // if the HangWatchdog already false-fired and painted the red "Could not
      // generate spec" banner, the late real success would land alongside it —
      // user sees a contradictory error + success pair.  Defensive clear: when
      // a real generation succeeds, ALWAYS wipe any stale error first so the
      // banner can't outlive the success.
      if (sdkError.value) {
        console.info('[doTranslate] Late success arrived after a prior error banner — clearing stale error.', { stale: sdkError.value })
        sdkError.value = ''
      }

      // Preserve stewards across re-generation — Tom 2026-05-28: "save stewards were delete."
      // initPlanModel() creates a blank team (owners:[], planners:[], scribes:[default]).
      // Capture before the call; restore after so the team persists across spec iterations.
      const _prevOwners   = specModel.value?.owners.map(o => ({ ...o })) ?? []
      const _prevPlanners = specModel.value?.planners.map(p => ({ ...p })) ?? []
      // Non-default scribes only — initPlanModel re-creates the default device-user scribe.
      const _prevScribes  = (specModel.value?.scribes ?? []).filter(s => !s.isDefault).map(s => ({ ...s }))

      // Pass user-supplied plan name to initSpecModel; falls back to auto-derive when null/empty.
      // Tom 2026-06-08: "reminder I wnt plan name and owner name up front from new plans"
      initSpecModel(annotatedSpec, pendingPlanName.value || undefined)

      // Record genesis so Stage 1 always shows original input when this plan is reloaded.
      // Tom Gilb 2026-06-09: "initial input specs she got parsed were gone."
      if (payload.stakes || payload.ends || payload.means) {
        updateSpecModelGenesis({ stakes: payload.stakes, ends: payload.ends, means: payload.means, generatedAt: new Date().toISOString() })
      }

      // If the user supplied an owner name upfront, add them before restoring previous owners.
      if (pendingOwnerName.value) {
        addOwner({ name: pendingOwnerName.value, email: '', phone: '', organization: '', location: '', responsibility: '' })
      }
      // r41 v112 — apply pre-spec Stewards collected via the pre-spec Stewards
      // manager (preSpecStewardsOpen modal).  Each role routes to the
      // appropriate addOwner / addPlanner / addScribe call so the Plan Crest
      // chips light up on first generation with the planner's pre-spec choices.
      if (preSpecStewards.value.length > 0) {
        for (const s of preSpecStewards.value) {
          const data = { name: s.name, email: '', phone: '', organization: '', location: '', responsibility: '' }
          try {
            if      (s.role === 'Owner')   addOwner(data)
            else if (s.role === 'Planner') addPlanner(data)
            else if (s.role === 'Scribe')  addScribe(data)
          } catch (err) {
            console.warn('[preSpecStewards] addSteward failed', { s, err })
          }
        }
        // Clear the pre-spec list so it doesn't re-apply on next generation.
        preSpecStewards.value = []
        try { localStorage.removeItem(PRESPEC_STEWARDS_KEY) } catch { /* best-effort */ }
      }
      // Clear so they don't bleed into a future re-generate.
      pendingPlanName.value  = null
      pendingOwnerName.value = null

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
      // r41 v52 (Tom Gilb 2026-06-16 "give a narrative about which phase it
      // is in and how many of each type of spec it has generated") —
      // post-generation count summary toast.  Names exactly what the AI
      // produced so the user has a concrete report instead of an opaque
      // "your spec is ready" message.
      const _gCounts = {
        f: annotatedSpec.functions?.length   ?? 0,
        v: annotatedSpec.values?.length      ?? 0,
        s: annotatedSpec.solutions?.length   ?? 0,
        c: annotatedSpec.constraints?.length ?? 0,
        r: (annotatedSpec as { resources?: unknown[] }).resources?.length ?? 0,
      }
      const _gElapsedSec = Math.round((Date.now() - _translateStart) / 1000)
      const _genMsg = `✓ Spec generated in ${_gElapsedSec}s — ${_gCounts.f} Function${_gCounts.f === 1 ? '' : 's'} · ${_gCounts.v} Value${_gCounts.v === 1 ? '' : 's'} · ${_gCounts.s} Solution${_gCounts.s === 1 ? '' : 's'} · ${_gCounts.c} Constraint${_gCounts.c === 1 ? '' : 's'}${_gCounts.r > 0 ? ` · ${_gCounts.r} Resource${_gCounts.r === 1 ? '' : 's'}` : ''}. ${allFieldsPresent ? 'All measurement fields present.' : 'Some Value fields are blank — Sharpen panel will help.'}`
      showToast(_genMsg, /* r41 v277 — 9s → 20s; important notifications must persist for any reader to parse multi-sentence content */ 20000)
      // r41 v277 — also push to the persistent generation banner so Tom sees the same info on Stage 2 after the toast dismisses
      lastGenerationReport.value = {
        ts:       Date.now(),
        kind:     'success',
        headline: `✓ Spec generated in ${_gElapsedSec}s — ${_gCounts.f}F · ${_gCounts.v}V · ${_gCounts.s}S · ${_gCounts.c}C${_gCounts.r > 0 ? ` · ${_gCounts.r}R` : ''}`,
        detail:   _genMsg,
      }
    }
  } finally {
    // 2026-06-26 S3 sweep — Tom "do stability first":
    // (F2) reset guard BEFORE stopLoading so a future change that lands a
    //      throw inside stopLoading can never trap the guard true forever.
    // (F3) only reset the active call ID iff it's still MY call — protects
    //      against late-arriving old promise clobbering a fresh in-flight call.
    if (_activeTranslateCallId === _myCallId) {
      _activeTranslateCallId = 0
    }
    stopLoading('sdk:translate')
    const elapsedMs = Date.now() - _translateStart
    console.info('[doTranslate] finished', { callId: _myCallId, succeeded, elapsedMs, sdkError: sdkError.value })
    // r41 v52 (Tom Gilb 2026-06-16 "started generating, then after 10 sec
    // went back to this state") — if generation failed fast (<30 s) the
    // visible toast names WHY so the user can see the cause + retry path
    // instead of just bouncing back to the form silently.  Common 10-15 s
    // failure modes: rate-limit (429), credit exhausted (402), auth (401),
    // overloaded (529), local-model unreachable, prompt validation reject.
    if (!succeeded && elapsedMs < 30_000 && sdkError.value) {
      const reason = sdkError.value.slice(0, 200)
      showToast(`⚠ AI generation failed after ${Math.round(elapsedMs / 1000)}s — ${reason}.  Press Generate Spec to retry.`, 9000)
      console.warn('[doTranslate] fast-fail diagnostic', { elapsedMs, reason })
    }
    // r41 v40 — Tom Gilb 2026-06-15 "failed to parse" — when translate()
    // returned null (parse failure, API error, etc.) the user was previously
    // stranded with a red error banner and no way to continue working.
    // Architectural Resilience + AI-Max + Claude-Code-as-AI-Layer all say
    // the SEM App must keep working when AI fails.  Fix: if generation
    // failed AND we have user input (payload.stakes/ends/means OR plan
    // name), auto-fall-back to buildMockSpec — same recovery path as the
    // HangWatchdog timeout — so the user gets a starter spec they can
    // sharpen instead of a dead end.
    // r41 v44 (Tom Gilb 2026-06-16 verbatim "THIS SPECS GENERATED IS JUST
    // SILLY SOMETHING VERY WRONG, BETTER BEFORE") — narrowed the r41 v40
    // auto-fallback.  Original v40 fired on ANY translate() failure +
    // payload-or-plan-name, then ran buildMockSpec on whatever input Tom had
    // typed.  Problem: when Tom pastes verbose source material (a 1635 ship
    // contract, a long brief, a multi-paragraph history), `buildMockSpec`
    // splits on commas and turns "flat of the floor — 13 ft 0 in" into a
    // stakeholder name and URL fragments into "HttpsWww" CamelCase IDs.
    // The result is the "silly spec" Tom called out.  Pre-v40 behaviour was
    // better: red error banner + ⟳ Generate Spec retry button.  Fix: ONLY
    // run the local fallback when the input is SHORT enough that the mock
    // builder won't choke (≤ 200 chars total across stakes/ends/means).
    // That preserves the v38/v40 plan-name-only escape hatch (Tom typed
    // just "UK Ship Contract" → buildMockSpec produces "F.UkShip…" which
    // is reasonable) but skips the fallback for verbose input — Tom gets
    // back the original error + retry flow that he preferred.
    if (!succeeded && sdkError.value) {
      const planTitle = (specModel.value?.name ?? 'New Plan').trim()
      const payloadCharCount = (payload.stakes?.length ?? 0) + (payload.ends?.length ?? 0) + (payload.means?.length ?? 0)
      const hasPlanName = planTitle.length > 0 && planTitle !== 'New Plan'
      const inputIsShortEnough = payloadCharCount <= 200  // verbose input → don't mock
      // Auto-fallback only fires for the plan-name-only OR very-short-payload case.
      // For verbose input the error banner + ⟳ Retry stays — pre-r41-v40 behaviour.
      const shouldRunFallback = inputIsShortEnough && (hasPlanName || payloadCharCount > 0)
      if (shouldRunFallback) {
        try {
          const seedStakes = payload.stakes || (hasPlanName ? planTitle : '')
          const seedEnds   = payload.ends   || (hasPlanName ? `Successful delivery of ${planTitle}` : '')
          const seedMeans  = payload.means  || ''
          const mockSpec = buildMockSpec(seedStakes, seedEnds, seedMeans)
          const _generatedAt = new Date()
          const annotatedSpec = stampGenerationFieldSources(mockSpec, _generatedAt)
          currentSpec.value = annotatedSpec
          specGeneratedAt.value = _generatedAt
          initSpecModel(annotatedSpec, pendingPlanName.value || undefined)
          if (payload.stakes || payload.ends || payload.means) {
            updateSpecModelGenesis({ stakes: payload.stakes, ends: payload.ends, means: payload.means, generatedAt: _generatedAt.toISOString() })
          }
          addVersion(annotatedSpec, 'Generated-LocalFallback', null, specModel.value?.name ?? '', _specOwnerNames())
          markdown.value = serialise(annotatedSpec)
          sdkError.value = ''  // clear the parse-failure banner — user has a usable spec
          showToast(
            `⚡ AI was unavailable — built a local starter spec for "${planTitle}".  Sharpen any dimension to refine, or 🆘 Reset to start fresh.`,
            8000,
          )
          succeeded = true
          console.info('[doTranslate] local-fallback recovery applied (short input only)')
        } catch (err) {
          console.error('[doTranslate] local-fallback also failed', err)
        }
      } else if (payloadCharCount > 200) {
        // Verbose input + AI failure → keep the original error visible so
        // Tom can press ⟳ Generate Spec to retry the AI call.  No silly
        // auto-mock.  Tom 2026-06-16 verbatim: "BETTER BEFORE".
        console.info('[doTranslate] skipping local-fallback for verbose input — pre-v40 retry flow active', { chars: payloadCharCount })
      }
    }
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
      // After AI generates spec: reset bar to stage 2 (Edit Values / Solutions).
      // A fresh generation means the user has a NEW spec and hasn't yet been through
      // Sharpen (3), Impacts (4), Refine (5) — so the bar must not sit above 2 even
      // if a previous session had advanced it to 6+.  Hard-set to 2 (not just advance
      // from <2) so a session-restore that pre-set planningStage=6 is correctly reset.
      planningStage.value = Math.min(planningStage.value, 2)
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
/**
 * r41 v258 (Tom Gilb 2026-06-21 verbatim "refresh button not working, probably others") —
 * Page-reload handler for the toolbar Refresh pin.  Was an inline arrow on `@refresh`:
 *   `@refresh="() => { window.location.href = window.location.pathname + '?reload=' + Date.now() }"`
 * which threw `Cannot read properties of undefined (reading 'location')` because Vue 3
 * templates do NOT expose the global `window` object — template scope is intentionally
 * restricted to the component's own bindings + a small allowlist.  The error was silent
 * to Tom (no console open) so the button "appeared dead".
 *
 * Lesson banked: **never reference `window` / `document` / other browser globals from a
 * Vue template inline expression — move the handler to <script setup> where the JS
 * runtime scope provides them naturally.**
 */
function handlePageRefresh(): void {
  window.location.href = window.location.pathname + '?reload=' + Date.now()
}

/** r41 v258 — same bug class: `window` is not in Vue template scope. */
function handleJumpToTop(): void {
  try { window.scrollTo({ top: 0, behavior: 'smooth' }) } catch { /* noop */ }
}

function goToImpactStage(): void {
  if (currentSpec.value) _ensurePlanModel(currentSpec.value) // guarantee bar shows at stage 3
  stage.value = 3
  // r41 v254 (Tom Gilb 2026-06-21 verbatim "Bug: I clicked 4.1 and it jumped to
  // stage 5") — was `if (planningStage.value < 5) planningStage.value = 5`, but
  // Stage 4 IS Impacts per the canonical data/planningStages.ts (Stage 5 is
  // Refine).  Stale numbering from when stages were ordered differently — same
  // class of bug as the v241 case-2 mismatch fix.  Now syncs to Stage 4 (the
  // correct Impacts stage), not Stage 5.
  if (planningStage.value < 4) planningStage.value = 4
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
/** Auto-DBO: user approved a Solution Version — apply its snapshot to the master spec. */
function onAutoDboApproveToMaster(snapshot: import('./types/spec').SpecBlock): void {
  currentSpec.value = snapshot
  bumpSpecVersion(snapshot)
}

/**
 * Auto-DBO: user chose "Save as New Plan" — load the Design Version's spec snapshot
 * as a fresh independent plan with the specified title and stewards, then close DBO.
 * Tom 2026-06-07: "I suspect that we need an option to store a design version as a
 * distinct new plan with different title and stewards."
 */
function onAutoDboSaveAsNewPlan(payload: { spec: import('./types/spec').SpecBlock; planName: string; planOwners: string[] }): void {
  autoDboOpen.value = false
  onHistoryRestore(payload.spec, null, payload.planName, payload.planOwners)
}

/**
 * PlanguageToolsPanel emits 'tool-activated' with the tool's emitEvent name.
 * Maps to the same handleAction / openX handlers used everywhere else.
 * Tom Gilb 2026-06-07: Planguage Tools are pre-Evo-Step-derivation design tools.
 */
function onPlanguageToolActivated(payload: { id: string; emitEvent: string; payload?: Record<string, unknown> }): void {
  planguageToolsOpen.value = false
  switch (payload.emitEvent) {
    case 'open-auto-dbo':            autoDboOpen.value          = true; break
    case 'open-penta':               pentaOpen.value             = true; break
    case 'open-optima':              optimaOpen.value            = true; break
    case 'open-multi-vision':        openMultiVision();                  break
    case 'open-multi-forks':         multiForksOpen.value        = true; break
    case 'open-sharpen':             handleSharpenPlan();                break
    case 'open-kiss':                kissOpen.value              = true; break
    case 'open-resources-sharpen':   resourcesSharpenOpen.value  = true; break
    case 'open-standards-auditor':   standardsAuditorOpen.value  = true; break
    case 'open-planguage-analyzer':  planguageAnalyzerOpen.value = true; break
    case 'open-conflicts':           conflictAnalysisOpen.value  = true; break
    case 'open-internet-context':    internetContextOpen.value   = true; break
    case 'open-plan-health':         specHealthStatusOpen.value  = true; break
    case 'open-spec-editor':         specEditorOpen.value        = true; break
    case 'open-feed-me-planguage':   feedMeOpen.value            = true; break
    default:
      console.warn(`[PlanguageTools] No dispatcher for emitEvent "${payload.emitEvent}" (tool id: "${payload.id}").`)
  }
}

/**
 * r41 v170 — Tom Gilb 2026-06-18 verbatim "no close or export, scroll on this:
 * universal rule!".  Export pin added to PlanguageToolsPanel header per the
 * Universal Export rule (Export button on all windows).  Builds a colourful
 * HTML catalogue of all 15 tools grouped by category, copies to clipboard,
 * auto-opens Mail.app per SEM Email Body Standard.
 */
async function exportPlanguageToolsCatalog(): Promise<void> {
  const mod = await import('./data/planguageTools')
  const { PLANGUAGE_TOOLS, PLANGUAGE_TOOL_CATEGORY_META, PLANGUAGE_TOOL_CATEGORIES_IN_ORDER, getPlanguageToolsByCategory } = mod
  const today = new Date().toISOString().slice(0, 10)
  const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const rows: string[] = []
  rows.push('<table cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;width:100%;max-width:780px;margin:0 0 14px 0;">')
  rows.push(`<tr><td bgcolor="#ea580c" style="background:#ea580c;color:#ffffff;padding:14px 18px;font-size:18px;font-weight:800;line-height:1.4;">Planguage Tools Catalogue</td></tr>`)
  rows.push(`<tr><td bgcolor="#fff7ed" style="background:#fff7ed;color:#9a3412;padding:6px 18px;font-size:11px;font-style:italic;">${PLANGUAGE_TOOLS.length} tools across ${PLANGUAGE_TOOL_CATEGORIES_IN_ORDER.length} categories · CE Design chapter authority · Exported ${today}</td></tr>`)
  for (const cat of PLANGUAGE_TOOL_CATEGORIES_IN_ORDER) {
    const tools = getPlanguageToolsByCategory(cat)
    if (tools.length === 0) continue
    const meta = PLANGUAGE_TOOL_CATEGORY_META[cat]
    rows.push(`<tr><td bgcolor="#fef3c7" style="background:#fef3c7;color:#78350f;padding:12px 18px 4px 18px;font-size:14px;font-weight:700;">${escapeHtml(meta.label)}</td></tr>`)
    rows.push(`<tr><td bgcolor="#fef3c7" style="background:#fef3c7;color:#92400e;padding:0 18px 10px 18px;font-size:11px;font-style:italic;">${escapeHtml(meta.tagline)}</td></tr>`)
    for (const t of tools) {
      rows.push(`<tr><td bgcolor="#ffffff" style="background:#ffffff;color:#0f172a;padding:8px 18px;font-size:13px;font-weight:600;border-top:1px solid #e2e8f0;">${escapeHtml(t.name)} <span style="color:#64748b;font-weight:400;font-size:11px;">— ${escapeHtml(t.status)}</span></td></tr>`)
      rows.push(`<tr><td bgcolor="#ffffff" style="background:#ffffff;color:#475569;padding:0 18px 6px 18px;font-size:12px;line-height:1.5;">${escapeHtml(t.description)}</td></tr>`)
      if (t.gilbSource) rows.push(`<tr><td bgcolor="#ffffff" style="background:#ffffff;color:#c2410c;padding:0 18px 8px 18px;font-size:11px;font-style:italic;">Source: ${escapeHtml(t.gilbSource)}</td></tr>`)
    }
  }
  rows.push('</table>')
  const html = rows.join('')
  const ok = await exportCopy(html, `Planguage Tools Catalogue (${PLANGUAGE_TOOLS.length} tools) — paste colourful HTML via ⌘V`)
  if (ok) showToast(`📤 ${PLANGUAGE_TOOLS.length}-tool catalogue copied — ⌘V into Mail / Notes / Keynote`, 3500)
}

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
    case 'open-auto-dbo':
      autoDboOpen.value = true
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
// All three use the shared exportCopy / exportEmail / exportDownload primitives
// (Tom 2026-06-06: "this design applies for all export in sem").

async function copyImpactStepTable(): Promise<void> {
  const html = _buildImpactStepTableHtml()
  if (!html) { showToast('No Value × Step data yet — generate an Evo Plan and fill Value × Solution first', 4000); return }
  const ok = await exportCopy(html, 'Value × Evo Step Impact table')
  showToast(ok ? '[*]=[*] Value × Evo Step table copied' : 'Copy failed — check browser clipboard permissions', ok ? 4000 : 7000)
}

async function emailImpactStepTable(): Promise<void> {
  const html = _buildImpactStepTableHtml()
  if (!html) { showToast('No Value × Step data yet — generate an Evo Plan and fill Value × Solution first', 4000); return }
  const date    = new Date().toISOString().slice(0, 10)
  const name    = specModel.value?.name ?? 'Evo Impact'
  const subject = `Value × Evo Step Impact — ${name} · ${date}`
  await exportEmail(html, subject, 'Value × Evo Step table')
  showToast('📨 Mail opening — press ⌘V to paste the colour table, then Send.', 5000)
}

function downloadImpactStepTable(): void {
  const html = _buildImpactStepTableHtml()
  if (!html) { showToast('No Value × Step data yet — generate an Evo Plan and fill Value × Solution first', 4000); return }
  const name = specModel.value?.name?.replace(/[/\\?%*:|"<>]/g, '').replace(/\s+/g, '-').slice(0, 40) ?? 'evo-impact'
  const date = new Date().toISOString().slice(0, 10)
  exportDownload(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Value × Evo Step Impact</title></head><body style="font-family:Arial,sans-serif;padding:20px;">${html}</body></html>`,
    `${name}-impact-step-${date}`,
  )
  showToast('Value × Evo Step table downloaded as HTML', 3000)
}

// ── V × Solution — copy / email / download ────────────────────────────────────

async function copyImpactSolutionTable(): Promise<void> {
  const html = _buildImpactSolutionTableHtml()
  if (!html) { showToast('No Value × Solution data yet — fill the impact table first', 4000); return }
  const ok = await exportCopy(html, 'Value × Solution Impact table')
  showToast(ok ? '[*]=[*] Value × Solution table copied' : 'Copy failed — check browser clipboard permissions', ok ? 4000 : 7000)
}

async function emailImpactSolutionTable(): Promise<void> {
  const html = _buildImpactSolutionTableHtml()
  if (!html) { showToast('No Value × Solution data yet — fill the impact table first', 4000); return }
  const date    = new Date().toISOString().slice(0, 10)
  const name    = specModel.value?.name ?? 'Evo Impact'
  const subject = `Value × Solution Impact — ${name} · ${date}`
  await exportEmail(html, subject, 'Value × Solution table')
  showToast('📨 Mail opening — press ⌘V to paste the colour table, then Send.', 5000)
}

function downloadImpactSolutionTable(): void {
  const html = _buildImpactSolutionTableHtml()
  if (!html) { showToast('No Value × Solution data yet — fill the impact table first', 4000); return }
  const name = specModel.value?.name?.replace(/[/\\?%*:|"<>]/g, '').replace(/\s+/g, '-').slice(0, 40) ?? 'evo-impact'
  const date = new Date().toISOString().slice(0, 10)
  exportDownload(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Value × Solution Impact</title></head><body style="font-family:Arial,sans-serif;padding:20px;">${html}</body></html>`,
    `${name}-impact-solution-${date}`,
  )
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
      // r41 v77 — hard-force 'full' (see emailPlan comment) so the Copy flow
      // matches Tom's in-app card detail with no chance of mode drift.
      htmlText = renderColorfulSpecHtml(
        currentSpec.value,
        modelName,
        version.trim() || undefined,
        { mode: 'full' },
      )
    } catch (rErr) {
      console.warn('[autoCopyPlan] colourful HTML build failed — plain text only', rErr)
    }

    console.log(`[autoCopyPlan] mode=full · built plain=${fullText.length} html=${htmlText.length} chars · sample (first 800):`, htmlText.slice(0, 800))

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
// Auto-Open Email Rule (SUPREME, CLAUDE.md): mailto: + clipboard replaces .eml download.
// .eml silently lands in Downloads without opening Mail (Tom's browser config 2026-06-07).
// mailto: auto-opens Mail.app; colourful HTML on clipboard → one ⌘V paste.
async function emailPlan(): Promise<void> {
  if (!currentSpec.value) { showToast('Nothing to email yet — load or generate a Spec first', 4000); return }
  _saveNow()
  if (specModel.value) saveSpecSnapshot(currentSpec.value)
  const date      = new Date().toISOString().slice(0, 10)
  const modelName = specModel.value?.name ?? 'Planning Spec'
  const versTxt   = specModel.value ? `v${specModel.value.version}` : ''
  let htmlBody  = ''
  let plainBody = ''
  // r41 v77 (Tom Gilb 2026-06-16 "for the 3rd time today the email paste is
  // not the detaied spec in my mac pleaseeeee") — HARD-FORCE 'full' mode at
  // the call site so even if Settings.specExportFormat got corrupted to
  // 'condensed' / 'table' / undefined via a stale localStorage record from
  // before r41 v58 shipped, the email export ALWAYS carries the rich detail
  // Tom sees in-app: Ambition Level + Source + Rationale + Justification +
  // Risks + Assumptions + fieldSources + Stakeholder Source row.  Defensive
  // diagnostic console.info so Tom can verify in DevTools what's actually
  // being put on the clipboard.
  const exportMode = 'full' as const
  try {
    htmlBody  = renderColorfulSpecHtml(currentSpec.value, modelName, versTxt || undefined, { mode: exportMode })
    plainBody = serialisePlainText(currentSpec.value)
  } catch (rErr) {
    showToast(`Email build failed: ${String(rErr).slice(0, 80)}`, 7000)
    return
  }
  console.info('[emailPlan] mode=', exportMode, '· html size:', htmlBody.length, 'chars · sample (first 800):', htmlBody.slice(0, 800))
  const subject = `Spec: ${modelName}${versTxt ? ' ' + versTxt : ''} · ${date}`
  // r41 v113 (Tom Gilb 2026-06-17 verbatim "I think the owner email, or
  // default tom@gilb.com (default scribe) should already be there, others
  // can be added, but the paste should only end up in the top of the
  // text") — SUPERSEDES the r41 v80 Mailto-No-Self-To rule.  Pre-fill the
  // To: field so ⌘V lands in the body, not the empty To: slot.  Pass
  // `undefined` so exportEmail's `to = 'Tom@Gilb.com'` default kicks in.
  // Per-Owner email override pending plan-model wiring.
  await exportEmail(htmlBody, subject, 'Planguage Spec', undefined, plainBody)
  // r41 v81 — surface the TRUTH about what landed on clipboard so Tom isn't
  // misled when the HTML write silently fails.
  const result = getLastClipboardResult()
  if (result === 'html+plain') {
    showToast('📨 Mail opening — type recipient + ⌘V to paste the COLOUR Spec.  ✓ Colour HTML written to clipboard.  If paste lands plain anyway: Mail → Format → Make Rich Text.', 9000)
  } else if (result === 'plain-fallback') {
    showToast('⚠ Colour HTML write FAILED — Mail will open with plain-text-only on clipboard.  Open Safari DevTools → Console for the real error.  Common fix: click somewhere in the SEM App first, then click Email again (document focus is required for clipboard).', 12000)
  } else {
    showToast('⚠ Clipboard write FAILED entirely.  Mail will open but nothing will paste.  Open Console for the error.', 12000)
  }
}

// ── Stage 7 (Evo Impact) Export — split-button pattern ───────────────────────
// Tom Gilb, 2026-06-06 (clarification):
//   "the agreement was, one click, copied, and then download or email are menu options.
//    what was copied was NOT the tables and charts on the main page.
//    When we go to email, we want the HTML, not boring text."
//
// Pattern:
//   • Primary button → copyStage7()  : copies colourful HTML (spec + IET tables) to clipboard
//   • ▼ dropdown → two options:
//       – emailStage7()         : opens mailto:Tom@Gilb.com with MINIMAL body (paste cue only)
//       – downloadStage7Html()  : saves the HTML file
//
// The email body is intentionally MINIMAL — just the paste cue so ⌘V fills the whole body
// with HTML. No boring plain-text dump below the paste.

// Stage 7 email uses the shared useExportBanner singleton — no local banner state needed.

/** Build the full Stage 7 HTML export: IET grid first (primary Stage 7 artefact),
 *  then the colourful Planguage Spec for reference.
 *
 *  Layout rationale (Tom 2026-06-06: "does not give us the actual table but a series of
 *  table components and their impacts"):
 *  — The IET (Values × Solutions percentage grid) is Stage 7's PRIMARY output. It goes FIRST
 *    so paste-to-Keynote puts the grid at the top slide / first table seen.
 *  — SVG is NOT included in the clipboard HTML. When serialized SVG is pasted into Keynote
 *    the diagram nodes (boxes for Tasks/Solutions/Values) render as "table components" and
 *    the arrows read as "impacts" — exactly the confusion Tom reported. SVG stays in the
 *    dedicated Download SVG button only.
 *  — Colourful Planguage Spec follows the IET as secondary context.
 *  — Every IET cell uses BOTH bgcolor= attribute (Keynote) AND inline style background (Mail/HTML).
 */
function _buildStage7Html(): string {
  if (!currentSpec.value) return ''
  const modelName = specModel.value?.name ?? 'Evo Impact'
  const versTxt   = specModel.value ? `v${specModel.value.version}` : ''
  const date      = new Date().toISOString().slice(0, 10)

  // 1. IET table — Values (rows) × Solutions (columns) with % impact cells.
  //    PRIMARY export artefact for Stage 7. Uses both bgcolor= (Keynote) + style background (HTML).
  const vals   = currentSpec.value.values
  const sols   = currentSpec.value.solutions
  const matrix = capturedImpactMatrix.value
  let ietHtml  = ''
  if (vals.length > 0 && sols.length > 0 && Object.keys(matrix).length > 0) {
    const cellBase   = 'padding:8px 12px;border:1px solid #cbd5e1;font-size:12px;'
    const bgHeader   = '#1e293b'; const fgHeader = '#ffffff'
    const bgValueCol = '#4c1d95'; const fgValueCol = '#ffffff'
    const bgHigh     = '#dcfce7'; const bgMid = '#fef9c3'
    const bgLow      = '#fee2e2'; const bgNone = '#f8fafc'

    // Solution column headers — show name (truncated) not just ID.
    const hdrs = sols.map((s) =>
      `<td bgcolor="${bgHeader}" style="${cellBase}background:${bgHeader};color:${fgHeader};font-weight:700;text-align:center">` +
      `${s.id}<br><span style="font-size:10px;font-weight:400">${(s.description ?? '').slice(0, 28)}</span></td>`
    ).join('')

    let rows = ''
    for (const v of vals) {
      const cells = sols.map((s) => {
        const pct = matrix[v.id]?.[s.id] ?? 0
        const bg  = pct >= 70 ? bgHigh : pct >= 30 ? bgMid : pct > 0 ? bgLow : bgNone
        const fg  = '#1e293b'
        const lbl = pct > 0 ? `${pct}%` : '—'
        return `<td bgcolor="${bg}" style="${cellBase}background:${bg};color:${fg};text-align:center;font-weight:${pct >= 70 ? '700' : '400'}">${lbl}</td>`
      }).join('')
      rows += `<tr>
        <td bgcolor="${bgValueCol}" style="${cellBase}background:${bgValueCol};color:${fgValueCol};font-weight:700">
          ${v.id}<br><span style="font-size:10px;font-weight:400">${(v.description ?? '').slice(0, 40)}</span>
        </td>${cells}</tr>`
    }

    ietHtml = `
      <table cellpadding="0" cellspacing="0" border="0"
             style="border-collapse:collapse;width:100%;margin-bottom:32px">
        <tr>
          <td colspan="${sols.length + 1}" bgcolor="${bgHeader}"
              style="background:${bgHeader};color:${fgHeader};padding:12px 16px;
                     font-size:14px;font-weight:700;letter-spacing:.02em">
            ⊕ Impact Estimation Table · Values × Solutions · ${modelName} ${versTxt} · ${date}
          </td>
        </tr>
        <tr>
          <td bgcolor="${bgHeader}" style="${cellBase}background:${bgHeader};color:${fgHeader};font-weight:700">
            Values ↓ / Solutions →
          </td>
          ${hdrs}
        </tr>
        ${rows}
        <tr>
          <td colspan="${sols.length + 1}" style="padding:6px 12px;font-size:10px;color:#64748b">
            Green ≥70% high impact · Yellow 30–69% partial · Red 1–29% low · — no impact recorded
          </td>
        </tr>
      </table>`
  } else {
    ietHtml = `<p style="color:#64748b;font-size:13px;margin-bottom:24px">
      No Impact Estimation data yet — open the Value × Solution table on Stage 7 and enter impact percentages.</p>`
  }

  // 2. Colourful Planguage Spec — canonical entry-type colours, secondary reference context.
  let specHtml = ''
  // r41 v77 — hard-force 'full' mode (see emailPlan comment).
  try { specHtml = renderColorfulSpecHtml(currentSpec.value, modelName, versTxt || undefined, { mode: 'full' }) }
  catch { specHtml = '<p style="color:red">Spec HTML build failed</p>' }

  // 3. Wrap in page shell. IET first, spec second.
  return `<!doctype html><html><head><meta charset="utf-8">
    <title>Stage 7 · Evo Impact — ${modelName} ${versTxt} · ${date}</title>
    <style>body{margin:0;padding:24px;font-family:system-ui,sans-serif;background:#f8fafc}</style>
    </head><body>
      <h2 style="font-size:14px;color:#0f172a;margin:0 0 16px 0;font-family:system-ui,sans-serif">
        Stage 7 · Evo Impact Export — ${modelName} ${versTxt} · ${date}
      </h2>
      ${ietHtml}
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0 24px">
      <p style="font-size:11px;color:#64748b;margin:0 0 16px">Planguage Spec — full entry reference</p>
      ${specHtml}
    </body></html>`
}

/** Copy Stage 7 colourful HTML (IET grid first, then full Spec) to clipboard.
 *  IET is the PRIMARY Stage 7 artefact — it appears first so paste-to-Keynote
 *  puts the grid at the top.  SVG is kept in the Download button only (not clipboard). */
async function copyStage7(): Promise<void> {
  if (!currentSpec.value) { showToast('Nothing to copy — generate a Spec first', 4000); return }
  const ok = await exportCopy(_buildStage7Html(), 'Stage 7 · Evo Impact — paste colourful HTML via ⌘V')
  showToast(ok ? '[*]=[*] Copied Stage 7 — IET grid + Spec on clipboard (⌘V to paste)' : 'Copy failed — check browser clipboard permissions', ok ? 4000 : 7000)
}

/** Email Stage 7 — mailto: + clipboard pattern (Auto-Open Email Rule, CLAUDE.md).
 *  IET grid + Spec HTML on clipboard (⌘V); Mail opens automatically via mailto:. */
async function emailStage7(): Promise<void> {
  if (!currentSpec.value) { showToast('Nothing to email', 4000); return }
  const modelName = specModel.value?.name ?? 'Evo Impact'
  const versTxt   = specModel.value ? `v${specModel.value.version}` : ''
  const date      = new Date().toISOString().slice(0, 10)
  const html    = _buildStage7Html()
  const subject = `Stage 7 · Evo Impact — ${modelName}${versTxt ? ' ' + versTxt : ''} · ${date}`
  await exportEmail(html, subject, 'Stage 7 Evo Impact')
  showToast('📨 Mail opening — press ⌘V to paste the colour IET + Spec, then Send.', 6000)
}

/** Download Stage 7 HTML as a standalone file. */
function downloadStage7Html(): void {
  if (!currentSpec.value) { showToast('Nothing to download', 4000); return }
  const modelName = specModel.value?.name?.replace(/[^a-z0-9]/gi, '-') ?? 'evo-impact'
  const date      = new Date().toISOString().slice(0, 10)
  exportDownload(_buildStage7Html(), `stage7-evo-impact-${modelName}-${date}`)
  showToast('⬇ Stage 7 HTML downloaded', 4000)
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
  // r41 v78 (Tom Gilb 2026-06-16 verbatim "why cant chat be color and
  // detail????") — was plain-text-only.  Chat now gets the same dual-MIME
  // ClipboardItem treatment as Email/Copy: full colourful HTML on
  // `text/html` + markdown fallback on `text/plain`.  Chat apps that
  // support rich paste (Claude.ai, ChatGPT Web, Notion, Obsidian, Linear,
  // …) will use the colour version; plain-only targets get markdown.
  const modelName = specModel.value?.name ?? 'Planning Spec'
  const versTxt   = specModel.value ? `v${specModel.value.version}` : ''
  const plain     = serialisePlainText(currentSpec.value)
  let html = ''
  try {
    html = renderColorfulSpecHtml(currentSpec.value, modelName, versTxt || undefined, { mode: 'full' })
  } catch (err) {
    console.warn('[copyPlanForChat] colourful HTML build failed — plain only', err)
  }
  console.info('[copyPlanForChat] mode=full · html size:', html.length, 'chars · plain size:', plain.length)
  try {
    if (html && typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html':  new Blob([html],  { type: 'text/html'  }),
          'text/plain': new Blob([plain], { type: 'text/plain' }),
        }),
      ])
      showToast('📋 Copied (colour + plain) — paste into Claude, ChatGPT, Notion, or any AI chat.', 5000)
      return
    }
    await navigator.clipboard.writeText(plain)
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
    // r41 2026-06-20 — Fork-action labels relabeled to match the Stage 1
    // mode-toggle buttons.  Tom Gilb verbatim: "Analyze As Is" + "Answer
    // Some Questions, for better Analysis".  Old labels kept as searchable
    // aliases below so muscle memory + the command-palette fuzzy search
    // still find them.
    'Analyze As Is':              () => { analysisMode.value = 'quick' },
    'Answer Some Questions, for better Analysis': () => { analysisMode.value = 'precise' },
    // Back-compat aliases — fork actions are identified by their string key,
    // so users / scripts referencing the old names still resolve.  No
    // Silent-Removal SUPREME: nothing's silently lost.
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
  // ⌘I — Illumination · Information · Illustrations (Tom 2026-06-13, r93qqq + r17).
  // Tom verbatim r17: "TELL ME WHEN YOU HAVE FIXED THE TOTAL FAILURE OF THE I SEARCH"
  //   Root cause discovered: previous version SKIPPED text inputs ("let native
  //   Italic run inside text inputs") which meant ⌘I from a spec editor (where
  //   Tom's focus almost always lives) silently triggered native italic instead
  //   of opening the picker.  Native italic is a no-op in SEM textareas (no rich
  //   text rendering), so the skip cost Tom the keyboard path for ZERO benefit.
  //   Fix: ALWAYS open the picker on ⌘I, including inside text inputs.
  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key === 'i' || e.key === 'I')) {
    e.preventDefault()
    openGilbIllustrations()
    return
  }
  // ⌘⇧H — Role Health Dashboard (r41 v312, Tom Gilb 2026-06-23 Phase 2 of
  // Roles redesign). Cmd-Shift-H opens the dashboard so the planner can
  // see per-Stakeholder Health Score + RACI Matrix without menu-dive.
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'h' || e.key === 'H')) {
    e.preventDefault()
    roleHealthOpen.value = true
    return
  }
  // ⌘⇧R — Role Flow Diagram (r41 v313, Tom Gilb 2026-06-23 Phase 3 of
  // Roles redesign). Cmd-Shift-R opens the 5-column Stakeholder-centric
  // flow (Roles · People · Solutions · Values · Resources) so the planner
  // can see how every Stakeholder relates to every Planguage spec.
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'r' || e.key === 'R')) {
    e.preventDefault()
    roleFlowOpen.value = true
    return
  }
  // ⌘⇧X — Role Routing & Placeholder Resolver Panel (r41 v314, Tom Gilb
  // 2026-06-23 Phase 4 FINAL of Roles redesign). Cmd-Shift-X opens the
  // routing rules editor + placeholder resolver — "X" mnemonic = automation.
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'x' || e.key === 'X')) {
    e.preventDefault()
    roleRoutingOpen.value = true
    return
  }
  // ⌘, — SEM Settings (Tom Gilb 2026-06-16 verbatim "I CANT FIND SETTINGS
  // ANYWHERE").  Mac convention is ⌘, for app settings/preferences.
  if ((e.metaKey || e.ctrlKey) && e.key === ',') {
    e.preventDefault()
    settingsOpen.value = true
    return
  }
  // ⌘S — Save Draft pre-spec (Tom Gilb 2026-06-17 "i think a whole line of
  // actions like save are missing"). r41 v111.  Pre-spec drafts only fire
  // when there's no specModel yet; with a spec loaded ⌘S falls through to
  // the auto-save pathway that's already in place per the No-Silent-Data-
  // Loss Rule.
  if ((e.metaKey || e.ctrlKey) && e.key === 's' && !specModel.value) {
    e.preventDefault()
    savePreSpecDraft()
    return
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
    //
    // v514 (2026-07-21) — Tom Gilb: silent Stage 10 → Stage 1 reset while
    // reading + scrolling.  Root-cause hypothesis: v504-v513 estimation
    // subsystem left `isLoading` stuck true after a failed background
    // estimation, and a stray Escape key press (Tom scrolling with keyboard)
    // fired panicReset silently.  DEFENSIVE FIX: when the user is deep in
    // the workflow (planningStage >= 6 — Evo Steps onwards) AND has a spec,
    // demand explicit confirmation via a toast prompt rather than nuking
    // Stage-6+ work silently.  For planningStage < 6 the old behaviour is
    // preserved — the reset is cheap to redo from an empty/early spec.
    if (isLoading.value || sdkError.value) {
      const deepInWorkflow = planningStage.value >= 6 && !!currentSpec.value
      if (deepInWorkflow) {
        // No-Silent-Data-Loss SUPREME: never silently discard Stage 6+ work
        console.warn('[esc-guard] Escape+stuck at Stage', planningStage.value,
          '— reset SUPPRESSED; user must click 🆘 SOS explicitly.')
        showToast(
          `⚠ Reset suppressed at Stage ${planningStage.value} — press 🆘 SOS in the title bar to reset explicitly, or refresh Safari to keep working.`,
          8000,
        )
        return
      }
      panicReset({ force: true })  // v520 — Escape already passed the v514 stage-guard above
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
  // v515 (2026-07-21) — Last-Effort Mirror mount check.  Non-blocking: if
  // an IDB mirror exists that's newer than the localStorage session, the
  // banner appears at the top of the app.  User clicks Restore or Dismiss.
  void _checkMirrorAtMount()
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
      context: 'Visualize', action: () => { presentationOpen.value = true },
      disabled: !hasSpec,
    },
    {
      id: 'diagrams', icon: '🗺️', name: 'Diagrams & Visuals',
      description: 'Value flow, radar, architecture, risk, finance charts',
      keywords: ['chart', 'sankey', 'radar', 'svg', 'graph', 'visualize', 'visualise', 'diagrams'],
      context: 'Visualize', action: () => { visualiseOpen.value = true },
      disabled: !hasSpec,
    },
    {
      id: 'swimlane', icon: '🏊', name: 'Swimlane View',
      description: 'Value Stage Map — Functions / Values / Solutions across delivery stages',
      keywords: ['value stage map', 'heat lane', 'swim lane', 'swimlane', 'lanes', 'matrix', 'stages'],
      context: 'Visualize', action: () => { heatLaneOpen.value = true },
      disabled: !hasSpec,
    },
    {
      id: 'evo-simulator', icon: '▶', name: 'Evo Simulator',
      description: 'Animated delivery timeline across 26 weeks',
      keywords: ['simulate', 'simulator', 'animation', 'timeline', 'delivery', 'weeks'],
      context: 'Visualize', action: () => { evoSimulatorOpen.value = true },
      disabled: !hasSteps,
    },
    {
      id: 'replay', icon: '🔁', name: 'Replay',
      description: 'Replay the spec entry and AI generation from the start',
      keywords: ['replay', 'playback', 'demo', 'rerun', 'again'],
      context: 'Visualize', action: () => { if (hasSteps) startReplay(confirmedSteps.value) },
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
      context: 'Visualize', action: () => { openMultiForks() },
      disabled: !hasSpec,
    },
    // r93qqq 2026-06-12 — Gilb Illustration Picker.
    // Tom: "I want you to be able to find and bring into sem the illustrations
    // in my books, kai says I should just ask".  Public TwinPod containers
    // expose /public/<Book>/_images/ folders openly (no Solid OAuth needed for
    // GET — only HEAD trips the 401).  Catalog covers every book in
    // twinPodBooksRegistry.ts, paired with chapter MD captions.  Insertion
    // copies HTML + markdown to clipboard with citation footer per the
    // Conjunction-of-Technologies SUPREME rule + r93ppp Twin promo discipline.
    {
      id: 'gilb-illustrations', icon: '💡', name: 'Illumination · Information · Illustrations  (⌘I)',
      description: 'Unified Tom Gilb knowledge finder.  ONE search box — TEXT column (Planguage Glossary definitions + chapter titles + captions) AND IMAGES column (4,363 illustrations across 61 books).  Pick either side → ⌘V into any spec field with citation.  Keyboard: ⌘I (outside text inputs).',
      keywords: ['illumination', 'information', 'illustration', 'illustrations', 'figure', 'figures', 'picture', 'pictures', 'diagram', 'diagrams', 'image', 'images', 'gilb book', 'tom gilb book', 'twinpod', 'twin pod', 'picker', 'insert image', 'embed', 'catalog', 'visual', 'planguage illustrations', 'glossary', 'definitions', 'knowledge', 'cmd i', 'shortcut'],
      context: 'Reference', action: () => { openGilbIllustrations() },
    },
    // r93qqq r23 2026-06-13 — Planguage Ontology Diagram (663 concepts).
    {
      id: 'ontology-diagram', icon: '🌳', name: 'Planguage Ontology — Clickable Concept Tree',
      description: '663-concept Planguage Glossary as a collapsible hierarchical tree.  Every concept node opens in Tom Gilb Consultant Twin (free, no login).  Live filter + expand/collapse all.  Source: 10.Standard/2.Glossary/PlanguageGlossary/.',
      keywords: ['ontology', 'ontologies', 'planguage ontology', 'concept tree', 'glossary tree', 'glossary hierarchy', 'class hierarchy', 'parent class', 'tree', 'taxonomy', '663 concepts', '700 concepts', 'clickable tree', 'concept browser', 'gilb glossary', 'twin'],
      context: 'Reference', action: () => { openOntologyDiagram() },
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
      description: 'Edit Function / Value / Solution entries directly — produce Edit Versions or commit to Master',
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

    // ── App-level utilities — r41 v113 (Tom Gilb 2026-06-17 "all the buttons
    //    at the top are getting messy. Time to reorganize") — items that
    //    used to live in the title-bar right pin cluster but get demoted to
    //    the Actions menu (⌘A) as part of the aggressive cleanup.  Reachable
    //    via ⌘A → type "Reload" / "Twin" / "Mode" / etc.
    {
      id: 'force-reload', icon: '🔄', name: 'Force Fresh Reload',
      description: 'Equivalent to ⌘R — reloads the SEM App with a cache-bust query so no stale Vue HMR state survives. Useful when the UI feels off and a clean refresh is needed.',
      keywords: ['reload', 'refresh', 'fresh', 'hard refresh', 'cache bust', 'cmd r'],
      context: 'App', action: () => { window.location.href = window.location.pathname + '?reload=' + Date.now() },
    },
    {
      id: 'twin-link', icon: '🔗', name: 'Open Tom Gilb Consultant Twin',
      description: 'Opens Tom Gilb Consultant Twin (gilb.com/tomtwin) in a new tab — Tom Gilb knowledge consultant built by Kai Gilb.',
      keywords: ['twin', 'tt', 'tom', 'gilb', 'consultant', 'kai'],
      context: 'App', action: () => { window.open('https://www.gilb.com/tomtwin', '_blank', 'noopener') },
    },
    {
      id: 'active-mode-switch', icon: '🎚', name: 'Switch Active Mode',
      description: 'Switch between Ultra Light / Pro SEM / Plan / Contract / Model / Maria modes. Opens the Active Mode popover so you can review the current rich-config summary and pick a different mode.',
      keywords: ['mode', 'switch', 'ultra light', 'pro sem', 'plan', 'contract', 'model', 'maria'],
      context: 'App', action: () => { activeModePopoverOpen.value = true },
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
      context: 'Analyze', action: () => { sharpenModalOpen.value = true },
      disabled: !hasSpec,
    },
    {
      id: 'compare', icon: '📊', name: 'Compare Spec Models',
      description: 'Side-by-side A/B comparison of two spec models',
      keywords: ['compare', 'comparison', 'a/b', 'side by side', 'diff models'],
      context: 'Analyze', action: () => { comparisonOpen.value = true },
    },
    {
      id: 'collaborate', icon: '🤝', name: 'Collaborate',
      description: 'Invite collaborators and manage real-time editing access',
      keywords: ['collaborate', 'invite', 'team', 'share', 'collaborator', 'rbac'],
      context: 'Analyze', action: () => { collaboratorOpen.value = true },
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
      context: 'Session', action: () => { startFresh({ force: true }) },  // user explicitly invoked from search palette
    },

    // ── Onboarding ────────────────────────────────────────────────────────
    {
      id: 'tour', icon: '?', name: 'Tour',
      description: 'Walk through the onboarding tour of the app',
      keywords: ['tour', 'onboarding', 'help', 'introduction', 'guide', 'walkthrough'],
      context: 'Help', action: () => { tourOpen.value = true },
    },
    // r41 v365 (Tom Gilb 2026-06-25 "remove what is not in use") — Wizard
    // entry REMOVED from the Actions catalog.  SpecWizard.vue dead code.
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
// r41 v302 (Tom Gilb 2026-06-23) — Stage 6 sub-step panels.
registerExclusiveSurface('stage6Prioritise',     stage6PrioritiseOpen)
registerExclusiveSurface('stage6SharpenSteps',   stage6SharpenStepsOpen)
registerExclusiveSurface('stage6ToolsAndAgents', stage6ToolsAndAgentsOpen)
registerExclusiveSurface('presentation',      presentationOpen)
registerExclusiveSurface('resourcesSharpen',  resourcesSharpenOpen)
registerExclusiveSurface('resourcesAgent',    resourcesAgentOpen)   // v509
registerExclusiveSurface('stage9Actuals',     stage9ActualsOpen)
registerExclusiveSurface('optima',            optimaOpen)
registerExclusiveSurface('autoDbo',           autoDboOpen)
registerExclusiveSurface('planguageTools',    planguageToolsOpen)
registerExclusiveSurface('penta',             pentaOpen)
registerExclusiveSurface('parseImpliedSharp', parseImpliedSharpeningOpen)
registerExclusiveSurface('initialInput',      initialInputPanelOpen)
registerExclusiveSurface('kiss',              kissOpen)
registerExclusiveSurface('costEngineering',   costEngineeringOpen)
registerExclusiveSurface('sharpenModal',      sharpenModalOpen)
registerExclusiveSurface('bullock',           bullockOpen)
registerExclusiveSurface('visualise',         visualiseOpen)
registerExclusiveSurface('heatLane',          heatLaneOpen)
registerExclusiveSurface('evoSimulator',      evoSimulatorOpen)
registerExclusiveSurface('evoTools',          evoToolsOpen)
registerExclusiveSurface('evoSharp',          evoSharpOpen)
registerExclusiveSurface('solutionSharpen',   solutionSharpenOpen)
registerExclusiveSurface('strategyAgent',     strategyAgentOpen)
registerExclusiveSurface('evoStepImprovement', evoStepImprovementOpen)
registerExclusiveSurface('feedMe',            feedMeOpen)
registerExclusiveSurface('settings',          settingsOpen)
// r41 v335 — Diagnostics Panel registered as exclusive surface so other panels
// close when it opens (Single-Surface SUPREME).
registerExclusiveSurface('diagnostics',       diagnosticsOpen)
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
registerExclusiveSurface('incorruptible',     incorruptibleOpen)
registerExclusiveSurface('incorruptibleSharp', incorruptibleSharpeningOpen)
registerExclusiveSurface('elon',              elonOpen)
registerExclusiveSurface('munger',            mungerOpen)
registerExclusiveSurface('heilmeier',         heilmeierOpen)
registerExclusiveSurface('feynman',           feynmanOpen)
registerExclusiveSurface('roleAgent',         roleAgentOpen)
registerExclusiveSurface('roleHealth',        roleHealthOpen)
registerExclusiveSurface('roleFlow',          roleFlowOpen)
registerExclusiveSurface('roleRouting',       roleRoutingOpen)
registerExclusiveSurface('elonSharp',         elonSharpeningOpen)
registerExclusiveSurface('modelLibrary',      modelLibraryOpen)
registerExclusiveSurface('stakeholderMapper', stakeholderMapperOpen)
registerExclusiveSurface('evoCritiquer',      evoCritiquerOpen)
registerExclusiveSurface('planImporter',      specImporterOpen)
registerExclusiveSurface('decisionMapper',    decisionMapperOpen)
registerExclusiveSurface('multiVision',      multiVisionOpen)
registerExclusiveSurface('multiForks',       multiForksOpen)    // r97
registerExclusiveSurface('gilbIllustrations',gilbIllustrationsOpen) // r93qqq 2026-06-12
registerExclusiveSurface('ontologyDiagram',  ontologyDiagramOpen)   // r93qqq r23 2026-06-13
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
    // r41 v29 (Tom Gilb 2026-06-15 "To Actions menu: 'Illumination AI'") —
    // routes to the same picker the ⌘I shortcut opens, no preset tab so the
    // planner lands on their last-used tab (default: Define glance).
    case 'illuminationAI':   openGilbIllustrations();             break
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
    // r41 v43 (Tom Gilb 2026-06-16 "I CANT FIND SETTINGS ANYWHERE") —
    // route the new Settings tile in the ABOUT section to the existing
    // settingsOpen ref so all three entry points (title-bar pin, ⌘,
    // shortcut, this Actions tile) land on the same SettingsPanel.
    case 'settings':         settingsOpen.value         = true; break
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
    // ── PLANGUAGE DESIGN TOOLS ─────────────────────────────────────────────
    // Tom 2026-06-07: "Auto-DBO belongs to the more general class of Planguage Tools,
    // not Evo Tools. Pre-Evo step derivation. Available at any stage."
    case 'autoDbo':            autoDboOpen.value          = true; break
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
  startFresh({ force: true })   // user explicitly picked Blank Canvas — v520 stage-guard bypassed
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
 *  No data touched.  v520: user picked from the 🆘 SOS FreshStart menu →
 *  explicit reset → force through the stage-guard. */
function _onCloseStuckUi(): void {
  freshStartOpen.value = false
  panicReset({ force: true })
}

// ── Ultra Light Phase 3 — Aperture wiring ────────────────────────────────────
// Gated by ?aperture=1. Exposes `aperture.enabled` (overlay on/off) and
// `aperture.view` (which menu mode is active). When view === 'plan' AND
// the aperture is enabled, <Aperture/> covers the underlying app. Any
// other view drops the overlay so the existing surfaces show through.
// <MenuPin/> stays visible whenever the aperture mode is enabled.
const aperture = useApertureMode()

// Bridge: keep aperture enabled-state in sync with Settings mode.
// Bug 2026-06-09: _readEnabled() was patched to read semSettings:v1 on
// refresh (covers F5/hard-reload). This watcher covers the LIVE case —
// when the user changes Settings mode without reloading.
//   ultra-light → enable aperture + reset to Plan view
//   pro-sem     → disable aperture
// Uses { immediate: false } because _readEnabled() already sets the initial
// value correctly from localStorage; firing immediately would be redundant.
{
  const { settings: _appSettings } = useSettings()
  watch(() => _appSettings.value.mode, (mode) => {
    if (mode === 'ultra-light') {
      aperture.setEnabled(true)
      aperture.setView('plan')   // always land on the naked Plan circle
    } else {
      aperture.setEnabled(false)
    }
  })
}

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
  _activeTranslateCallId = 0  // S3 sweep 2026-06-26 — was _doTranslateInFlight

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
  <!-- v515 (2026-07-21) — Last-Effort Mirror restore banner.
       Non-blocking; sits at the TOP of the app so it's the first thing the
       user sees when returning to a session where the IDB mirror is newer
       than the localStorage session (typically because the session blob was
       lost to a quota-fail or a silent reset).  Two explicit actions —
       Restore or Dismiss — nothing auto-fires (No-Silent-Data-Loss SUPREME
       in both directions: never lose work, never silently replace work). -->
  <div
    v-if="mirrorRestoreOffered"
    class="fixed top-0 inset-x-0 z-[9500] bg-amber-50 border-b-2 border-amber-500 shadow-sm"
    role="status"
    aria-live="polite"
    data-test="last-effort-mirror-banner"
  >
    <div class="max-w-6xl mx-auto flex items-center gap-3 px-4 py-2.5 text-sm">
      <span class="text-lg" aria-hidden="true">🔄</span>
      <div class="flex-1 min-w-0">
        <div class="font-semibold text-amber-900">
          Restore last effort? (from {{ mirrorRestoreAgeLabel }})
        </div>
        <div class="text-xs text-amber-800/80 truncate">
          The Last-Effort Mirror (IndexedDB) has a newer session snapshot than
          the browser session. Restore keeps your work; Dismiss keeps the current view.
        </div>
      </div>
      <button
        type="button"
        class="shrink-0 px-3 py-1.5 rounded-md bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        title="Load the newer snapshot from the Last-Effort Mirror into this session"
        @click="restoreFromMirror"
      >Restore</button>
      <button
        type="button"
        class="shrink-0 px-3 py-1.5 rounded-md bg-white text-amber-900 text-sm font-semibold border border-amber-300 hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        title="Keep the current view; mirror stays available until the next auto-save overwrites it"
        @click="dismissMirrorRestore"
      >Dismiss</button>
    </div>
  </div>

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
      title="Illuminate any Planguage term  (⌘I or ⌥I)"
      aria-label="Illuminate a term (Cmd+I or Opt+I)"
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
  <!-- r41 v229 (Tom Gilb 2026-06-20 verbatim refinement: "I like the idea
       that the menus do not disappear, they scroll up, out of the way, but
       we inituitively know that and can bring them down by a simple scroll")
       — Plan Crest is now IN-FLOW (mt-[148px] to clear the fixed stage bar,
       relative positioning, NO fixed/sticky).  Scrolling the page UP brings
       the menus down into view; scrolling DOWN sends them up out of the
       viewport.  No toggle needed — scrolling IS the mechanism.
       Drops r41 v228's max-h collapse + restore strip + focus-mode CSS
       (replaced by the natural scroll behavior).
       Composes with: No-Silent-Removal (menus still always in DOM, just
       above the viewport when scrolled), MOVE Principle (scroll up = menus
       visible — the user always knows where they are), accessibility_tom.md
       (no keyboard combo to learn — just scroll). -->
  <div
    ref="specCrestEl"
    v-if="view === 'app'"
    class="relative mt-[148px] z-[300] flex flex-col px-4 py-1.5
           bg-gradient-to-r from-indigo-800 via-indigo-600 to-violet-600
           text-white shadow-lg ring-1 ring-black/10 select-none"
    aria-label="Spec Crest — active spec"
  >
    <!-- r41 v140 — wrapper-level specModel gate dropped (Tom Gilb 2026-06-17
         verbatim "not bars back after c r" — Trace-Before-Patch revealed
         the v139 inner-gate removal was masked by THIS outer wrapper gate).
         Row 1 hero content now wrapped with its OWN <template v-if="specModel">
         so the gradient bar + the 3 Level strips render in pre-spec state
         while specModel-dependent hero markup stays gated. -->
    <template v-if="specModel">
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
    <!-- Tom Gilb 2026-06-19 "title collision" — left cluster grew past the
         original 440 px reservation once Find / Illuminate / Past Versions
         gained text labels and Dictate / Speaker dropped compact mode.
         Reservation bumped to 720 px so the centred title no longer
         overlaps the right edge of the left cluster (the gold
         "Indianapolis Contract" text was visibly painting over the
         "Turn On Mic" pin).  Right cluster unchanged. -->
    <!-- r41 v263 (Tom Gilb 2026-06-21 verbatim "this collision will persist until you design it
         better") — Tom-Repeats-Himself SUPREME: this is the THIRD or FOURTH report of title-vs-
         button overlap in this row.  Root cause: the LEFT absolute cluster reserves md:pl-[720px]
         of horizontal space, but with Mic ("Turn On Mic") + Read ("Read aloud") pins rendered
         with FULL TEXT LABELS (compact=false per Icon-Plus-Text SUPREME), the cluster's actual
         width is ~860-900px on desktop — overflows the reservation + visually overlaps the
         centered title.  v263 fix: (a) bump padding-left reservation to 920px so the cluster
         has hard-guaranteed room with margin; (b) tighten title `max-w-[60%]` → `max-w-[35%]`
         so the title truncates earlier and CANNOT extend into the cluster zone even if the
         cluster overflows again.  Defense-in-depth: even if Tom adds another full-text pin to
         the cluster, the title's max-w-35% still keeps it clear.  Composes with: Tom-Repeats-
         Himself SUPREME (4th instance of overlap), Icon-Plus-Text SUPREME (preserves text
         labels on Mic+Read — the labels are required for accessibility, can't make compact),
         accessibility_tom.md (no overlap = no friction). -->
    <div class="flex items-center justify-center h-12 relative md:pl-[920px] md:pr-[310px]">
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
        <!-- Find ⌘F — Icon-Plus-Text rule (Tom Gilb 2026-06-18 second-ask:
             "Rules: Text under the pins required").  Inline "Find" label
             added between the glyph and the shortcut kbd so the pin
             self-identifies at a glance. -->
        <button
          type="button"
          class="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold
                 text-white bg-white/10 hover:bg-white/20
                 focus:outline-none focus:ring-2 focus:ring-white/70 transition-colors"
          aria-label="Find features (Cmd+F)"
          title="Find features (⌘F)"
          @click="_toggleSearch()"
        >
          <svg class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clip-rule="evenodd" />
          </svg>
          <span class="text-[10px] font-bold tracking-wide">Find</span>
          <kbd class="inline-flex items-center px-1 rounded bg-white/20 text-white/80 font-mono text-[9px] leading-none py-0.5 ring-1 ring-white/20">⌘F</kbd>
        </button>
        <!-- Illuminate ⌘I — Icon-Plus-Text rule (inline "Illuminate" label) -->
        <button
          type="button"
          class="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold
                 text-white bg-white/10 hover:bg-white/20
                 focus:outline-none focus:ring-2 focus:ring-white/70 transition-colors"
          aria-label="Illuminate a Planguage term (Cmd+I or Opt+I)"
          title="Illuminate any term — select text first, or click to type one  (⌘I or ⌥I)"
          @click="openDefineSearch()"
        >
          <span class="text-sm leading-none" aria-hidden="true">💡</span>
          <span class="text-[10px] font-bold tracking-wide">Illuminate</span>
          <kbd class="inline-flex items-center px-1 rounded bg-white/20 text-white/80 font-mono text-[9px] leading-none py-0.5 ring-1 ring-white/20">⌘I</kbd>
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
        <!-- Past Versions — Icon-Plus-Text rule.  Tom Gilb 2026-06-19 verbatim:
             "I hope, as requested above we are getting rid of the term history
             everywhere, in hover info and menus."  Label was "History"; the
             panel actually lists PAST VERSIONS of saved specs / models /
             contracts / agent reports, so "Past Versions" is both literal and
             unambiguous.  Code identifiers (HistoryGlyph, unifiedHistoryOpen,
             useSpecHistory) are exempt per the Spell-out-Type-Names rule's
             code-identifier carve-out — only the rendered text changed. -->
        <div class="relative">
          <button
            type="button"
            class="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold
                   text-white bg-white/10 hover:bg-white/20
                   focus:outline-none focus:ring-2 focus:ring-white/70 transition-colors"
            aria-label="Past Versions — saved specs, models, contracts, agent reports"
            title="Past Versions — browse saved Specs, Imported Plans, Models, Contracts and agent reports.  Load any past version back into your workspace.  Single-click to open."
            @click="unifiedHistoryOpen = true"
          >
            <!-- HistoryGlyph component name retained (code identifier exemption);
                 the glyph shape [*]→[*] reads "past saved snapshot → working
                 copy" — still correct for Past Versions. -->
            <HistoryGlyph size="compact" aria-label="Past Versions" class="shrink-0" style="height: 16px; width: auto;" />
            <span class="text-[10px] font-bold tracking-wide">Past Versions</span>
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
        <!-- 🎤 Dictate — Icon-Plus-Text rule (Tom Gilb 2026-06-18 second-ask:
             "Rules: Text under the pins required").  compact=false so the
             built-in "Turn On Mic" / "Mic Off" label renders next to the glyph. -->
        <span class="inline-flex" data-crest-tip="🎤 Dictate — speak to fill the form (⌘M)">
          <DictateButton
            :active="dictationActive"
            :supported="dictationSupported"
            :compact="false"
            @toggle="toggleDictation()"
          />
        </span>
        <!-- 🔊 Speaker — Icon-Plus-Text rule (built-in "Read aloud" / "Stop" label) -->
        <span class="inline-flex" data-crest-tip="🔊 Read Aloud — hear the current plan content">
          <SpeakerButton
            :text="speakerText"
            :compact="false"
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
        class="group inline-flex items-center gap-3 min-w-0 max-w-[35%] flex-1 pl-2 pr-3 py-1 -my-1 rounded-lg
               hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-amber-300/80 transition-colors"
        :title="`Title: ${specModel.name} — click to rename`"
        :aria-label="`Title: ${specModel.name}. Click to rename in place.`"
        @click="startTitleEdit"
      >
        <!-- Amber crest stripe — gives the title an unmistakable left anchor -->
        <span
          class="shrink-0 h-9 w-1.5 rounded-full bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600 shadow-[0_0_8px_rgba(251,191,36,0.55)]"
          aria-hidden="true"
        ></span>
        <!-- "TITLE" eyebrow — Tom Gilb 2026-06-19 verbatim: "Plan = obsolete.
             Use 'Title' (generic for any plan, spec, contract, model etc)". -->
        <span
          class="hidden md:inline text-[10px] uppercase tracking-[0.35em] font-bold text-amber-200/85 leading-none shrink-0"
          aria-hidden="true"
        >Title</span>
        <!-- THE TITLE — gold-shimmer, drop-shadowed.  Tom Gilb 2026-06-19:
             "Make the Title name much better and dominant".  Restored the
             dramatic font sizing dropped 2026-06-03 — long titles are now
             allowed to dominate the row (the IdentityStrip below carries the
             secondary metadata; the row no longer needs to share with the
             duplicate Owner chip that was dropped 2026-06-18). -->
        <span
          class="plan-title-shimmer truncate min-w-0 flex-1
                 text-xl md:text-2xl lg:text-3xl leading-tight font-black tracking-tight
                 bg-gradient-to-r from-amber-300 via-yellow-100 via-white to-amber-300
                 bg-clip-text text-transparent
                 drop-shadow-[0_2px_6px_rgba(0,0,0,0.55)]"
        >{{ specModel.name }}</span>
        <svg
          class="h-4 w-4 shrink-0 opacity-0 group-hover:opacity-80 transition-opacity text-amber-200"
          viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
        >
          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
        </svg>
      </button>

      <!-- 🔑 OWNER CHIP — REMOVED 2026-06-18 (Tom Gilb verbatim: "remove
           repitition").  This top-bar owner chip was a pure duplicate of the
           Spec: Owner Planner Scribe Owner chip in the IdentityStrip (same
           glyph, same name display, same click action — both open the
           SpecOwnerPanel on the Owners tab).  Tom's 2026-06-03 reinstate
           request was satisfied at the time by putting an owner chip on the
           title row; the 2026-06-09 → 2026-06-18 IdentityStrip rework
           moved the owner chip into the canonical Spec: Owner Planner Scribe
           cluster, making this top-row copy redundant.  Function preserved
           (the IdentityStrip chip has identical click + display); only the
           duplicate visual is dropped per Tom's explicit ask. -->
      <!-- (top-bar Owner chip dropped — see Spec: Owner Planner Scribe in
           IdentityStrip for the canonical owner affordance) -->

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
        >Title</span>
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
          placeholder="Title (Plan, Spec, Contract, Model, …)"
          aria-label="Edit Title — Enter saves, Esc cancels"
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

    <!-- ── Right pin cluster — r41 v113 (Tom Gilb 2026-06-17 verbatim "all
         the buttons at the top are getting messy. Time to reorganize, first
         cut, a box of the permanent buttons. then a box for the phase
         relevant buttons, then a tools box?  help me with great redesign,
         and with much better icons and buttons, a consistent pattern").
         Approved Option B (two rows) + aggressive demotion.
         FIRST CUT: Row 1 right pin cluster becomes TWO clean groups —
         CONTROLS (search + undo/redo + illuminate + settings + SOS) and
         TOOLS (agents + books + actions).  All h-10 uniform height.  All
         glyph + text label per Icon-Plus-Text SUPREME.  Thin vertical
         separator between groups.  DEMOTED to Actions menu (each one is
         now in the Actions catalog with a search keyword set so they
         remain one-click reachable via ⌘A): 🔄 Reload · 🔗 Twin · 🎚 Mode
         switch.  No-Silent-Removal SUPREME: every demoted button is
         registered in the Actions catalog above (r41 v113 entries).
         Plan Crest Row 2 (PHI · Spec · Version · Stewards · Story · Tools)
         is a SECOND PASS — left alone in this first cut.  Composes with:
         Icon-Plus-Text SUPREME, MOVE Principle (every button visible at-a-
         glance), DD-009 (HoverHints on every button), Trace-Before-Patch
         SUPREME (audited before refactor; every removed surface accounted
         for). -->
    </template>
    <!-- r41 v146 — Process Tools mount MOVED OUTSIDE the specModel-gated
         template so it ALSO renders pre-spec.  Variant is bound to the
         specModel state so each variant gets the right buttons (post-spec:
         Undo/Redo/Books/Agents; pre-spec: Mic/Read).  Replaces the legacy
         floating fixed-z9999 cluster at line ~10561 that was overlapping
         the stage bar (Tom Gilb 2026-06-17 verbatim "you are joking?"
         screenshot showed Find/Search Term/Settings/SOS/Mic/Read/Actions
         pasted on top of stages 8/9/10/11). -->
    <!-- r41 v147 — ProcessToolsStrip MOVED into IdentityStrip's `end` slot
         (see below) per Tom Gilb 2026-06-17 verbatim "inside one of 3 bars
         top one".  Standalone mount here removed; the strip now sits at
         the right edge of the top Plan Identity bar via slot composition. -->

    <!-- ── Row 2: GROUP 3 · IDENTITY STRIP + GROUP 2 · STAGE TOOLS STRIP ──
         r41 v116 (Tom Gilb 2026-06-17 verbatim "I want all pins or buttons
         to be organized into clear groups. 1. The permanent, always there
         pins., 2. Tools for use at this stage (likePenta) and 3. Specific
         Pins for this particular stage").  Replaces the chaotic Plan Crest
         Row 2 (PHI + Spec + Version + Deadline + Sharpen + Saved + Spec
         Story + Planner + Scribe + EvoTools + SpecTools all mashed
         together) with TWO clean components, each owning its group:

           <IdentityStrip>    → Group 3 (identity for THIS spec)
             PHI · Plan · Version · Deadline · Sharpen rounds · Owner ·
             Planner · Scribe · Saved · Spec Story toggle

           <StageToolsStrip>  → Group 2 (tools relevant at THIS stage)
             reactive on planningStage — Penta, Sharpen, IET, MultiVision,
             EvoPlan, Tasks, Resources, Export… etc., plus 🦾 Agents

         Group 1 (permanent: Find, Undo, Redo, Illuminate, Settings, SOS,
         Mic, Read, Actions) lives in v113/v114 pin cluster — unchanged.
         All handlers preserved; old markup KEPT below as `v-if="false"`
         (No-Silent-Removal SUPREME) so any caller that still references
         the old structure can be traced and migrated.  Delete after one
         clean session of verified parity. -->
    <!-- r41 v139 — null-safe prop bindings so the IdentityStrip renders in
         the pre-spec / empty-form state too (Tom Gilb 2026-06-17 "retro
         all the new menu bars disappeared").  Optional chaining + sensible
         empty-string fallbacks. -->
    <IdentityStrip
      :plan-name="specModel?.name ?? '(no plan loaded)'"
      :plan-version="specModel?.version ?? ''"
      :phi-score="currentSpec ? specHealthIndexValue : undefined"
      :phi-threshold="specHealthThresholdValue"
      :phi-alert-count="specHealthAlertCount"
      :owners="specModel?.owners ?? []"
      :planners="specModel?.planners ?? []"
      :scribes="specModel?.scribes ?? []"
      :planner-count="specModel?.planners?.length ?? 0"
      :scribe-count="specModel?.scribes?.length ?? 0"
      :architect-count="specModel?.architects?.length ?? 0"
      :cto-count="specModel?.ctos?.length ?? 0"
      :saved-label="specBarSavedLabel"
      :unsaved="specBarUnsaved"
      :save-flash="_saveFlash"
      :spec-story-open="specStoryOpen"
      :deadline="specModel?.deadline ?? ''"
      :sharpen-rounds="specModel?.sharpenRounds ?? 0"
      @open-phi="specHealthStatusOpen = true"
      @open-spec="modelsOpen = true"
      @open-history="unifiedHistoryOpen = true"
      @open-owners="specPeopleTab = 'owners'; specOwnerPanelOpen = true"
      @open-planners="specPeopleTab = 'planners'; specOwnerPanelOpen = true"
      @open-scribes="specPeopleTab = 'scribes'; specOwnerPanelOpen = true"
      @save-now="savedLabelClick"
      @toggle-spec-story="_togglePlanStory()"
      @edit-deadline="editDeadline"
      @open-mode-picker="activeModePopoverOpen = true"
    >
      <!-- r41 v147 — ProcessToolsStrip slotted into IdentityStrip's `end` slot
           so Level 1 sits AT the right edge of the top Plan Identity bar,
           not floating as a separate cluster overlaying the stage tiles. -->
      <template #end>
        <!-- r41 v415 — persistent AI-model chip.  Sits IMMEDIATELY BEFORE the
             ProcessToolsStrip so it's on the top identity row (Control-Pins-
             at-Top SUPREME), adjacent to the Settings pin the HoverHint
             instructs the planner to open for Phase 2 runtime toggle. -->
        <ActiveModelChip />
        <ProcessToolsStrip
          :variant="specModel ? 'post-spec' : 'pre-spec'"
          :can-undo="undoHistory.canUndo.value"
          :can-redo="undoHistory.canRedo.value"
          :undo-label="undoHistory.lastEntry.value?.label ?? ''"
          :undo-source="undoHistory.lastEntry.value?.source ?? ''"
          :undo-time="undoHistory.lastEntry.value?.timestamp.slice(11, 19) ?? ''"
          :dictation-active="dictationActive"
          :dictation-supported="dictationSupported"
          :speaking="speaking"
          :speaker-supported="speakerSupported"
          :agent-menu-open="agentMenuOpen"
          :menu-open="menuOpen"
          :can-export="!!specModel"
          :focus-mode-active="focusModeActive"
          @open-find="toggleMenu()"
          @undo="handleGlobalUndo"
          @redo="handleGlobalRedo"
          @open-search-term="openGilbIllustrations()"
          @open-settings="settingsOpen = true"
          @refresh="handlePageRefresh"
          @open-sos="freshStartOpen = true"
          @open-mic="toggleDictation()"
          @open-read="speaking ? stopSpeaking() : handleSpeak(speakerText)"
          @open-books="openBookKaleidoscope()"
          @open-agents="agentMenuOpen = true"
          @open-resources="resourcesAgentOpen = true"
          @open-actions="toggleMenu"
          @open-demos="demosMenuOpen = true"
          @open-export="emailPlan()"
          @toggle-focus="focusModeToggle"
          :resource-implying-count="(currentSpec?.values?.length ?? 0) + (currentSpec?.solutions?.length ?? 0)"
        />
      </template>
    </IdentityStrip>
    <!-- r41 v139 — Tom Gilb 2026-06-17 verbatim "retro all the new menu bars
         disappeared" — v-if="specModel" gate dropped so Stage Tools is
         visible in the pre-spec / empty-form state too.  StageToolsStrip
         reads `planning-stage` only; works for any stage including 1. -->
    <!-- r41 v153 — specPresence map drives per-tool availability gating
         per rule_stage_tools_dependency_logic.md.  Tom Gilb 2026-06-17:
         "the method you have used with tools earlier to grey out and
         inactivate an invalid tool is good, but please also give a clear
         reaction message ('Invalid Tool' (at this point))".  Each artefact
         flag = TRUE when at least one entry of that type exists. -->
    <StageToolsStrip
      :planning-stage="planningStage"
      :has-spec="!!currentSpec"
      :spec-presence="{
        spec:            !!currentSpec,
        stakeholders:    (currentSpec?.stakeholders?.length ?? 0) > 0,
        values:          (currentSpec?.values?.length ?? 0) > 0,
        functions:       (currentSpec?.functions?.length ?? 0) > 0,
        solutions:       (currentSpec?.solutions?.length ?? 0) > 0,
        impactEstimates: ((currentSpec as { impactEstimates?: unknown[] } | null)?.impactEstimates?.length ?? 0) > 0,
        evoSteps:        ((currentSpec as { evoSteps?: unknown[] } | null)?.evoSteps?.length ?? 0) > 0,
        tasks:           ((currentSpec as { tasks?: unknown[] } | null)?.tasks?.length ?? 0) > 0,
        resources:       (currentSpec?.resources?.length ?? 0) > 0,
      }"
      @tool-invalid="(p) => showToast(`⚠ Invalid Tool — ${p.label} cannot be used yet.  ${p.reason}`, 5000)"
      @open-penta="pentaOpen = true"
      @open-get-a-plan="specInputOpen = true"
      @open-compare="comparisonMode = true"
      @open-templates="modelLibraryOpen = true"
      @open-initial-input="openInitialInputPanel"
      @open-sharpen-tools="planguageToolsOpen = true"
      @open-sharpen-spec="sharpenModalOpen = true"
      @open-standards-auditor="standardsAuditorOpen = true"
      @open-phi-dashboard="specHealthStatusOpen = true"
      @open-iet="planningStage = 7"
      @open-multivision="openMultiVision()"
      @open-impact-estimator="planningStage = 4"
      @open-refine-solutions="planningStage = 5"
      @open-evo-plan="planningStage = 6"
      @open-evo-critiquer="evoCritiquerOpen = true"
      @open-evo-tools="evoToolsOpen = true"
      @open-spec-tools="planguageToolsOpen = true"
      @open-spec-editor="specEditorOpen = true"
      @open-tasks="planningStage = 8"
      @open-study-act="planningStage = 9"
      @open-resources-sharpening="resourcesSharpenOpen = true"
      @open-optima="planningStage = 10"
      @open-export="planningStage = 11"
    />

    <!-- r41 v123 — LEVEL 3 · AGENTS strip (Tom Gilb 2026-06-17 "ship phase
         2 — I want all 3 new groups asap").  Extracted from StageToolsStrip
         for architectural separation matching its conceptual rank on the
         autonomy axis.  Five direct-launch agent pins (Maria / Contracts /
         Strategy / Stakeholder / Incorruptible) + More ▾ fallback for the
         remaining 4 (Models / Decision Mapper / Spec Importer / Elon).
         Per MOVE Principle: the emerging category is visibly growing. -->
    <!-- r41 v139 — v-if="specModel" gate dropped so Agents is visible in
         the pre-spec / empty-form state too. -->
    <AgentsStrip
      :has-spec="!!currentSpec"
      :spec-presence="{
        spec:            !!currentSpec,
        stakeholders:    (currentSpec?.stakeholders?.length ?? 0) > 0,
        values:          (currentSpec?.values?.length ?? 0) > 0,
        functions:       (currentSpec?.functions?.length ?? 0) > 0,
        solutions:       (currentSpec?.solutions?.length ?? 0) > 0,
        impactEstimates: ((currentSpec as { impactEstimates?: unknown[] } | null)?.impactEstimates?.length ?? 0) > 0,
        evoSteps:        ((currentSpec as { evoSteps?: unknown[] } | null)?.evoSteps?.length ?? 0) > 0,
        tasks:           ((currentSpec as { tasks?: unknown[] } | null)?.tasks?.length ?? 0) > 0,
        resources:       (currentSpec?.resources?.length ?? 0) > 0,
      }"
      @tool-invalid="(p) => showToast(`⚠ Invalid Agent — ${p.label} cannot be used yet.  ${p.reason}`, 5000)"
      @open-mode-picker="onOpenModePicker"
      @open-maria="mariaOpen = true"
      @open-contracts="contractsOpen = true"
      @open-models="modelLibraryOpen = true"
      @open-stakeholder-mapper="stakeholderMapperOpen = true"
      @open-evo-critiquer="evoCritiquerOpen = true"
      @open-spec-importer="specImporterOpen = true"
      @open-decisions="decisionMapperOpen = true"
      @open-strategy="strategyAgentOpen = true"
      @open-incorruptible="incorruptibleOpen = true"
      @open-incorruptible-sharpen="_launchIncorruptibleSharpeningOnCurrentPlan()"
      @open-elon="elonOpen = true"
      @open-elon-sharpen="_launchElonSharpeningOnCurrentPlan()"
      @open-munger="mungerOpen = true"
      @open-munger-sharpen="showToast('Munger Sharpening Q&A interview — Phase 2 build pending.  MVP analysis-only Munger Agent ships first; click the Munger pin to use it.', 5000)"
      @open-heilmeier="heilmeierOpen = true"
      @open-feynman="feynmanOpen = true"
      @open-roles="roleAgentOpen = true"
      @open-auto-dbo="autoDboOpen = true"
      @open-resources="resourcesAgentOpen = true"
    />

    <!-- r41 v321 (Tom Gilb 2026-06-24): Spec Pulse — persistent 6-tile color-block
         banner showing live count of Planguage entries (Stakeholders · Functions ·
         Values · Solutions · Constraints · Resources).  Tom verbatim: "console the
         planner that the Planguage Plan is building up and exists … a few color
         blocks with number of stakeholders, etc. which scales up nicely."  Hidden
         when spec has zero entries (the empty-state confidence comes from getting
         the first entry IN, not from staring at 0/0/0/0/0/0).  Each tile clickable
         to jump to that type's editor / agent. -->
    <SpecPulse
      :spec="currentSpec"
      :evo-steps-count="specPulseStepStats.totalSteps"
      :tasks-count="specPulseStepStats.totalTasks"
      :evo-steps-done="specPulseStepStats.doneSteps"
      :tasks-done="specPulseStepStats.doneTasks"
      @tile-click="onSpecPulseTileClick"
    />

    <!-- ── LEGACY META CHIPS ROW (~228 lines) deleted in r41 v118 — v116/v117 IdentityStrip + StageToolsStrip verified producing parity output.  All handlers preserved via the new component emits.  See SEM-Design-History.md r41 v116 / v117 / v118 rows for the migration audit.  Removed per No-Silent-Removal SUPREME (every demoted affordance lives in the new component or the ⌘A Actions catalog). -->

    <!-- Row 3: Spec Story strip (toggled by the Spec Story button in the
         top Spec Identity bar).  r41 v148 — gate strengthened from
         `specStoryOpen` to `specStoryOpen && specModel` per Tom Gilb
         2026-06-17 verbatim "spec story does not work": SpecStoryStrip's
         planModel prop is REQUIRED non-null, but pre-spec specModel is
         null, so the strip threw silently on click. -->
    <SpecStoryStrip
      v-if="specStoryOpen && specModel"
      :plan-model="specModel"
      @close="specStoryOpen = false"
      @edit-stewards="specPeopleTab = 'owners'; specOwnerPanelOpen = true"
    />
    <!-- r41 v148 — when no plan is loaded, clicking Spec Story shows a
         tiny placeholder helping the planner discover they need a plan
         first.  No-Silent-Removal SUPREME: the click no longer "does
         nothing"; it tells the planner what's needed. -->
    <div
      v-else-if="specStoryOpen && !specModel"
      class="fixed top-[260px] left-1/2 -translate-x-1/2 z-[400] max-w-md rounded-xl bg-fuchsia-50 ring-2 ring-fuchsia-300 shadow-2xl p-4 text-fuchsia-900"
      role="status"
    >
      <div class="flex items-start gap-2">
        <span class="text-xl shrink-0" aria-hidden="true">📖</span>
        <div class="flex-1">
          <p class="text-sm font-bold mb-1">Spec Story is empty</p>
          <p class="text-xs leading-relaxed mb-2">A Spec Story appears once you have generated or loaded a spec.  It shows the origin, hand-tuning, sharpen rounds, stewards, and age of the active spec.</p>
          <button
            type="button"
            class="text-xs font-bold underline hover:no-underline"
            @click="specStoryOpen = false"
          >Got it · close</button>
        </div>
      </div>
    </div>

  </div>

  <!-- Plan Owner Data panel — pinned below the plan bar when open.
       topOffset = contentTopPad (stage bar 148px + plan crest live height) so the
       panel always clears both fixed headers regardless of DNA strip state. -->
  <SpecOwnerPanel
    v-if="view === 'app' && specModel && specOwnerPanelOpen"
    :initial-tab="specPeopleTab"
    :plan-model="specModel"
    :top-offset="contentTopPad"
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
    :spec-presence="{
      spec:            !!currentSpec,
      stakeholders:    (currentSpec?.stakeholders?.length ?? 0) > 0,
      values:          (currentSpec?.values?.length ?? 0) > 0,
      functions:       (currentSpec?.functions?.length ?? 0) > 0,
      solutions:       (currentSpec?.solutions?.length ?? 0) > 0,
      impactEstimates: ((currentSpec as { impactEstimates?: unknown[] } | null)?.impactEstimates?.length ?? 0) > 0,
      evoSteps:        ((currentSpec as { evoSteps?: unknown[] } | null)?.evoSteps?.length ?? 0) > 0,
      tasks:           ((currentSpec as { tasks?: unknown[] } | null)?.tasks?.length ?? 0) > 0,
      resources:       (currentSpec?.resources?.length ?? 0) > 0,
    }"
    :stage2-sub-step="stage2SubStep"
    :stage2-done-steps="stage2DoneSteps"
    :has-plan="!!_evoPlan"
    @close="_closeSpecEditor"
    @commit-master="(editedSpec) => { _markSpecCommitted(); currentSpec = editedSpec; _closeSpecEditor(); showToast('✅ Changes committed to Master Plan', 3000) }"
    @open-global-priority="globalPriorityOpen = true"
    @open-priority-info="priorityInfoOpen = true"
    @open-edit-info="editInfoOpen = true"
    @back-to-value-flow="_handleBackToValueFlow"
    @show-in-value-flow="_handleShowInValueFlow"
    @open-actions="menuOpen = true"
    @navigate-stage="(n) => { _closeSpecEditor(); handleStageBarNav(n) }"
    @export-spec="(_) => emailPlan()"
    @open-agent="(agentId) => { _closeSpecEditor(); _openAgentFromEditor(agentId) }"
    @go-stage2-substep="(target) => { _closeSpecEditor(); onStage2SubStepGo(target) }"
    @continue-stage2="() => { _closeSpecEditor(); onStage2ContinueToStage3() }"
  />

  <!-- r41 v252 (Tom Gilb 2026-06-21 — Stage 4 Phase 2 ship).  EstimatesApprovalPanel +
       Stage4ToolsAndAgentsTable.  Both Teleport to body; mount conditionally via their
       open refs.  Composes with rule_stage_4_impacts_design.md SUPREME. -->
  <!-- r41 v477 — IET Settings Panel (Phase 2a data-shape + Settings ship). -->
  <IetSettingsPanel :open="ietSettingsOpen" @close="ietSettingsOpen = false" />

  <!-- r41 v478 — Solution Set + Changes-List deliverable panel
       (Stage 5 sub-steps 5.5.1 + 5.5.2, audit-backlog #4). -->
  <SolutionSetDeliverablePanel
    :open="solutionSetDeliverableOpen && !!currentSpec"
    :spec="currentSpec"
    :plan-name="specModel?.name ?? ''"
    :plan-version="specModel?.version ?? ''"
    @close="solutionSetDeliverableOpen = false"
    @copy="onSolutionSetDeliverableCopy"
    @email="onSolutionSetDeliverableEmail"
  />
  <EstimatesApprovalPanel
    v-if="estimatesApprovalOpen && currentSpec"
    :spec-name="specModel?.name ?? null"
    :default-identity="_specOwnerNames().join(', ')"
    :default-nickname="specModel?.version ? `v${specModel.version} estimates` : ''"
    @approve="onEstimatesApproved"
    @close="estimatesApprovalOpen = false"
  />
  <!-- r41 v253 (Tom Gilb 2026-06-21 — Stage 5 sub-step 5.5 Approve Solution Set).
       Same component as Estimates approval, configured with panelKind="solutions"
       + approvalAuthority="planner" per Tom verbatim "by Planner, not necessarily
       other instances like Owner". -->
  <EstimatesApprovalPanel
    v-if="solutionSetApprovalOpen && currentSpec"
    :spec-name="specModel?.name ?? null"
    :default-identity="_specOwnerNames().join(', ')"
    :default-nickname="specModel?.version ? `v${specModel.version} solutions` : ''"
    panel-kind="solutions"
    approval-authority="planner"
    @approve="onSolutionSetApproved"
    @close="solutionSetApprovalOpen = false"
  />
  <Stage4ToolsAndAgentsTable
    :open="stage4ToolsTableOpen"
    @invoke="onStage4ToolInvoke"
    @close="stage4ToolsTableOpen = false"
    @continue="() => { stage4ToolsTableOpen = false; handleStageBarNav(5) }"
  />

  <!-- r41 v302 (Tom Gilb 2026-06-23 autonomous backlog) — Stage 6 sub-step panels.
       6.2 Prioritise · 6.3 Sharpen Steps · 6.4 Tools and Agents.  Each mounts via
       its open ref; closing via CloseDot / Escape / click-outside / Cancel. -->
  <Stage6PrioritisePanel
    v-if="stage6PrioritiseOpen && confirmedSteps.length > 0"
    :steps="confirmedSteps"
    :calendar-costs="capturedCalendarCosts"
    :capital-costs="capturedCapitalCosts"
    :spec-name="specModel?.name ?? null"
    @apply="onStage6PrioritiseApply"
    @close="stage6PrioritiseOpen = false"
  />
  <Stage6SharpenStepsPanel
    v-if="stage6SharpenStepsOpen && confirmedSteps.length > 0"
    :steps="confirmedSteps"
    :spec-name="specModel?.name ?? null"
    @apply="onStage6SharpenStepsApply"
    @close="stage6SharpenStepsOpen = false"
  />
  <Stage6ToolsAndAgentsPanel
    v-if="stage6ToolsAndAgentsOpen"
    :spec-name="specModel?.name ?? null"
    @invoke="onStage6ToolInvoke"
    @close="stage6ToolsAndAgentsOpen = false"
  />

  <!-- r41 v246 (Tom Gilb 2026-06-21 verbatim "The Spec Title should be on any and all
       windows when the Main title is out of Device window sight.  Easy, right?") —
       global Spec Title anchor chip.  Mounts once at App.vue level; uses IntersectionObserver
       on the canonical Spec Crest (aria-label="Spec Crest — active spec") + Teleports a small
       fixed chip to body so it sits ABOVE any open modal / panel / drawer at every z-index
       when the main crest scrolls out of viewport.  Composes with MOVE Principle SUPREME
       (context visible at-a-glance, every window) + DD-009 Zero-Training UI + accessibility_
       tom.md (Tom 85, context anchor reduces cognitive load). -->
  <SpecTitleAnchor
    :spec-name="_specTitleAnchorName"
    :spec-version="_specTitleAnchorVersion"
    @jump-to-top="handleJumpToTop"
  />

  <!-- Contracts mode — 3rd major SEM surface (Plans · Models · Contracts). z-[600]. -->
  <ContractHub
    v-if="view === 'app' && contractsOpen"
    :plan-name="specModel?.name ?? ''"
    :plan-owner="_specOwnerNames().join(', ')"
    :plan-version="specModel?.version ? `v${specModel.version}` : ''"
    :generated-at="(currentSpec as { generatedAt?: string } | null)?.generatedAt ?? ''"
    @close="contractsOpen = false"
    @select-history="handleStrategyAgentHistoryPick"
    @open-settings="() => {
      // r41 v47 — ContractHub's header chip opens Settings so the planner can
      // adjust the Contracts Mode 4-axis config.  SettingsPanel opens on its
      // last-used section; the planner clicks Contracts Mode in the side nav.
      // (A future enhancement could deep-link via a prop; not needed today.)
      settingsOpen = true
      contractsOpen = false
    }"
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
  <!-- r41 v164 — Demos Menu catalog (Tom Gilb 2026-06-17 vision: per-stage,
       per-tool, per-agent demos).  Initial ship: catalog SHELL with all
       entries; recordings get wired incrementally per Tom + team.  Click on
       a "coming soon" demo surfaces a HoverHint reaction message. -->
  <DemosMenu
    v-if="view === 'app' && demosMenuOpen"
    @close="demosMenuOpen = false"
    @play-demo="(p) => {
      // r41 v168 — open the DemoPlayer with Tolerable-tier content.  E2E
      // demo still routes to the legacy launchDemo() for the in-app replay.
      demosMenuOpen = false
      if (p.id === 'e2e') { launchDemo(); return }
      playingDemo = { id: p.id, title: p.title, subtitle: p.subtitle }
    }"
  />

  <!-- r41 v168 — Tolerable-tier Demo Player: renders the registry clip +
       source citation.  Goal-tier event-script replay comes next pass. -->
  <DemoPlayer
    v-if="view === 'app' && playingDemo"
    :demo-id="playingDemo.id"
    :title="playingDemo.title"
    :subtitle="playingDemo.subtitle"
    @close="playingDemo = null"
  />

  <AgentMenuPanel
    v-if="view === 'app' && agentMenuOpen"
    @close="agentMenuOpen = false"
    @select-agent="(id) => { agentMenuOpen = false; if (id === 'maria') mariaBoardOpen = true; if (id === 'maria-analysis') mariaOpen = true; if (id === 'contracts') contractsOpen = true; if (id === 'models') modelLibraryOpen = true; if (id === 'stakeholder-mapper') stakeholderMapperOpen = true; if (id === 'evo-step-critique') evoCritiquerOpen = true; if (id === 'plan-importer') specImporterOpen = true; if (id === 'decisions') decisionMapperOpen = true; if (id === 'history') unifiedHistoryOpen = true; if (id === 'strategy-agent') strategyAgentOpen = true; if (id === 'incorruptible') incorruptibleOpen = true; if (id === 'incorruptible-sharpen') _launchIncorruptibleSharpeningOnCurrentPlan(); if (id === 'elon') elonOpen = true; if (id === 'elon-sharpen') _launchElonSharpeningOnCurrentPlan(); if (id === 'munger') mungerOpen = true; if (id === 'heilmeier') heilmeierOpen = true; if (id === 'feynman') feynmanOpen = true; if (id === 'autoDbo') autoDboOpen = true }"
  />

  <!-- Maria Agent — Board Work Parse (2026-05-29). z-[497] -->
  <MariaAgentBoard
    v-if="view === 'app' && mariaOpen"
    :plan-name="specModel?.name ?? ''"
    :plan-owner="_specOwnerNames().join(', ')"
    :plan-version="specModel?.version ? `v${specModel.version}` : ''"
    :generated-at="(currentSpec as { generatedAt?: string } | null)?.generatedAt ?? ''"
    @close="mariaOpen = false"
    @select-history="handleStrategyAgentHistoryPick"
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
    @load-spec-version="onUnifiedHistoryLoadSpec"
    @restore-model="(modelId, versionId) => { unifiedHistoryOpen = false }"
    @load-contract="(contractId) => { unifiedHistoryOpen = false; contractsOpen = true }"
    @load-maria="(result) => { unifiedHistoryOpen = false; mariaOpen = true }"
  />

  <!-- Domain Model Library — 18 built-in Planguage models across 6 categories. z-[600] -->
  <ModelLibraryPanel
    v-if="view === 'app' && modelLibraryOpen"
    @close="modelLibraryOpen = false"
    @select-agent="(id) => { modelLibraryOpen = false; if (id === 'stakeholder-mapper') stakeholderMapperOpen = true; if (id === 'evo-step-critique') evoCritiquerOpen = true; if (id === 'plan-importer') specImporterOpen = true; if (id === 'decisions') decisionMapperOpen = true; if (id === 'incorruptible-model') _launchIncorruptibleOnActiveModel(); if (id === 'incorruptible-sharpen-model') _launchIncorruptibleSharpeningOnActiveModel(); if (id === 'elon-model') _launchElonOnActiveModel(); if (id === 'elon-sharpen-model') _launchElonSharpeningOnActiveModel() }"
  />

  <!-- Stakeholder Mapper agent panel — AI-drafted 10-attribute profiles. z-[600] -->
  <StakeholderMapperPanel
    v-if="view === 'app' && stakeholderMapperOpen"
    :plan-name="specModel?.name ?? ''"
    :plan-owner="_specOwnerNames().join(', ')"
    :plan-version="specModel?.version ? `v${specModel.version}` : ''"
    :generated-at="(currentSpec as { generatedAt?: string } | null)?.generatedAt ?? ''"
    @close="stakeholderMapperOpen = false"
    @open-agents="stakeholderMapperOpen = false; agentMenuOpen = true"
    @select-history="handleStrategyAgentHistoryPick"
  />

  <!-- Evo Critiquer agent panel — Evo health check + value delivery review. z-[600] -->
  <EvoCritiquerPanel
    v-if="view === 'app' && evoCritiquerOpen"
    @close="evoCritiquerOpen = false"
    @open-agents="evoCritiquerOpen = false; agentMenuOpen = true"
    @open-history="evoCritiquerOpen = false; modelHistoryOpen = true"
    @select-history="handleStrategyAgentHistoryPick"
  />

  <!-- Plan Importer agent panel — universal Planguage converter. z-[600] -->
  <SpecImporterPanel
    v-if="view === 'app' && specImporterOpen"
    :plan-name="specModel?.name ?? ''"
    :plan-owner="_specOwnerNames().join(', ')"
    :plan-version="specModel?.version ? `v${specModel.version}` : ''"
    :generated-at="(currentSpec as { generatedAt?: string } | null)?.generatedAt ?? ''"
    @close="specImporterOpen = false"
    @select-history="handleStrategyAgentHistoryPick"
  />

  <!-- Decision Mapper agent panel — structured decision analysis. z-[600] -->
  <DecisionMapperPanel
    v-if="view === 'app' && decisionMapperOpen"
    :plan-name="specModel?.name ?? ''"
    :plan-owner="_specOwnerNames().join(', ')"
    :plan-version="specModel?.version ? `v${specModel.version}` : ''"
    :generated-at="(currentSpec as { generatedAt?: string } | null)?.generatedAt ?? ''"
    @close="decisionMapperOpen = false"
    @open-agents="decisionMapperOpen = false; agentMenuOpen = true"
    @select-history="handleStrategyAgentHistoryPick"
  />

  <!-- MultiVision — VDT-grounded V/R balance slider panel (z-[600]) -->
  <MultiVisionPanel
    v-if="view === 'app' && multiVisionOpen"
    :planning-stage="planningStage"
    :spec-presence="{
      spec:            !!currentSpec,
      stakeholders:    (currentSpec?.stakeholders?.length ?? 0) > 0,
      values:          (currentSpec?.values?.length ?? 0) > 0,
      functions:       (currentSpec?.functions?.length ?? 0) > 0,
      solutions:       (currentSpec?.solutions?.length ?? 0) > 0,
      resources:       (currentSpec?.resources?.length ?? 0) > 0,
    }"
    :stage2-sub-step="stage2SubStep"
    :stage2-done-steps="stage2DoneSteps"
    :has-plan="!!_evoPlan"
    :has-spec="!!currentSpec"
    @close="multiVisionOpen = false"
    @open-multiforks="openMultiForks"
    @navigate-stage="(n) => { multiVisionOpen = false; handleStageBarNav(n) }"
    @open-agent="(agentId) => { multiVisionOpen = false; _openAgentFromEditor(agentId) }"
    @go-stage2-substep="(target) => { multiVisionOpen = false; onStage2SubStepGo(target) }"
    @continue-stage2="() => { multiVisionOpen = false; onStage2ContinueToStage3() }"
  />

  <!-- MultiForks — Resources → System ← Values fork diagram (r97, 2026-06-06).
       Accessed from MultiVision footer + Visuals panel.  Reads currentSpec + balanceScore. -->
  <MultiForksPanel
    :open="multiForksOpen"
    :evo-steps-delivered="confirmedSteps.length"
    @close="multiForksOpen = false"
  />

  <!-- Gilb Illustration Picker — TwinPod catalog of every Tom Gilb book figure (r93qqq, 2026-06-12).
       Tom: "find and bring into sem the illustrations in my books, kai says I should just ask".
       Reads /public/gilb-illustrations-index.json built by
       0 - TOMS BOOKS/twinpod-illustrations/build-index.py.  Insertion → clipboard
       (HTML+markdown w/ citation footer) → toast → user ⌘V into target field. -->
  <GilbIllustrationPicker
    :open="gilbIllustrationsOpen"
    :initial-tab="gilbIllustrationsInitialTab"
    :plan-id="specModel?.id ?? specModel?.name ?? 'no-plan'"
    :owner-name="specModel?.owners?.[0]?.name ?? 'default-owner'"
    @close="gilbIllustrationsOpen = false"
    @insert="onGilbIllustrationInsert"
    @illuminate-term="(p) => {
      // r29 (Tom 2026-06-13: 'use them first to illuminate') — close the
      // picker and fire the full SelectionDefiner Illuminate flow for the
      // named term.  Tier 1 = local vault Glossary via /api/glossary
      // (currently serving 663 entries from 10.Standard/2.Glossary/PlanguageGlossary/).
      gilbIllustrationsOpen = false
      defineTerm(p.term, currentSpec)
    }"
    @open-ontology="() => {
      // r31 (Tom 2026-06-13: 'missing the ontology diagram') — open the
      // 663-concept clickable Planguage Ontology tree (r23).  Picker closes
      // first (handled by the picker emitting close alongside).
      ontologyDiagramOpen = true
    }"
  />

  <!-- 🌳 Planguage Ontology Diagram — 663 concepts in 106 categories, clickable
       tree (r93qqq r23, Tom Gilb 2026-06-13: "the diagram with ontologies in
       almost all glossary terms, the 700"). -->
  <PlanguageOntologyDiagram
    :open="ontologyDiagramOpen"
    @close="ontologyDiagramOpen = false"
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
    :plan-name="specModel?.name ?? 'Current Spec'"
    :plan-version="specModel?.version ? 'v' + specModel.version : undefined"
    @close="standardsAuditorOpen = false"
  />

  <!-- Planguage Analyzer (Unified) — Tom 2026-06-03 Conjunction-of-Technologies
       Exploit #5.  ONE panel, all knowledge layers, source-layer-filtered. -->
  <PlanguageAnalyzerPanel
    v-if="view === 'app' && currentSpec && planguageAnalyzerOpen"
    :spec="currentSpec"
    :plan-id="specModel?.name ?? 'default'"
    :step-names="_stepsForDiagram.map(s => s.name)"
    :plan-name="specModel?.name ?? 'Current Spec'"
    :plan-version="specModel?.version ? 'v' + specModel.version : undefined"
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
    :plan-name="specModel?.name ?? ''"
    :version-label="specModel ? `v${specModel.version}` : ''"
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
    class="min-h-screen bg-gray-50 flex flex-col items-center justify-start pb-56 px-4 md:pr-40"
    :class="!(view === 'app' && specModel) ? 'pt-8 overflow-x-clip' : ''"
    :style="contentTopPad !== undefined ? { paddingTop: contentTopPad + 'px' } : undefined"
  >
    <!--
      overflow-x-clip is applied ONLY when no plan is loaded (no specModel).
      When no plan: the ValueCounter stage bar is in-flow (-ml-4 + wide calc width)
      and extends beyond the padding box → clip prevents a horizontal scrollbar.
      When plan IS loaded: the stage bar is position:fixed (top-0 left-0 right-0)
      and does NOT overflow, so overflow-x-clip is not needed.
      Without it, the overflow-x:clip → overflow-y:auto cascade (CSS spec §2.1)
      does NOT apply when plan is loaded, so document vertical scroll works
      correctly at Stage 10 and other long-content stages.
      Tom 2026-06-07: "the main window does not scroll".
    -->

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
        <!-- r41 v164 — sign-in page Demo button also reframed as Demos catalog entry. -->
        <button
          type="button"
          aria-label="Demos — catalog"
          title="🎬 Demos — opens the Demos catalog (per Stage, per Tool, per Agent).  Demo = PASSIVE replay.  Use 🧙 Guided for interactive wizard."
          class="text-sm text-indigo-600 hover:text-indigo-800 underline underline-offset-2 min-h-[44px] px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
          @click="view = 'app'; demosMenuOpen = true"
        >
          🎬 Demos
        </button>
        <!-- r41 v365 (Tom Gilb 2026-06-25) — Feature #53 🧙 Guided sign-in
             button REMOVED.  Last of 5 SpecWizard trigger sites swept. -->
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
      <!-- r41 v145 — stage bar now ALWAYS fixed at top:0 regardless of
           specModel.  Tom Gilb 2026-06-17 verbatim "did you get the idea of
           fixing these menu bars?" — the pre-spec in-flow variant of the
           stage bar was causing the v140 Spec Crest wrapper (fixed at top:
           148) to overlap whatever in-flow content happened to be at that
           y position.  Fix: stage bar is ALWAYS fixed top:0, wrapper sits
           cleanly below at top:148. -->
      <div class="fixed top-0 left-0 right-0 z-[250]">
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

        <!-- 🔔 Toast history bell — r41 v277 (Tom 2026-06-22 "AI was slow message
             disappeared before I could read") — re-read any toast that
             disappeared before parsing completed.  Composes with accessibility_
             tom.md + No-Silent-Data-Loss SUPREME + MOVE Principle. -->
        <ToastHistoryBell />

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
          title="Start fresh — wipe the restored session and begin with a blank canvas.  Use this if you want to ignore last visit's draft."
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
          title="Dismiss the conflict banner — accept the latest remote state.  You can review and reconcile via Past Versions."
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
          <!-- r41 v162 — body "Get A Plan" button DELETED per Tom Gilb 2026-06-17
               verbatim "if already there, delete".  Already in Stage Tools
               IMPORT sub-pill (always-visible per stage). -->
          <!-- r41 v162 — body "Compare" button DELETED per Tom Gilb 2026-06-17
               v152 "what is that, drop it" — Compare at Stage 1 makes no
               sense (nothing to compare yet); preserved at later stages
               via Stage Tools. -->
          <!-- Past Versions — also in the persistent spec identity bar + in Actions menu -->
          <div class="relative shrink-0">
            <button
              type="button"
              class="h-9 px-2.5 rounded-lg bg-indigo-100 text-indigo-700 text-xs font-medium
                     hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500
                     transition-colors duration-150 inline-flex items-center gap-1.5"
              aria-label="Past Versions"
              title="Past Versions — browse all saved spec versions, model versions, contracts and agent reports.  Load any past version back into your workspace."
              @click="historyOpen = true"
            >
              <!-- Color Glyph: Evo Step glyph (amber) — '<' anchor reads "past cycle".
                   :no-detail-click per DD-013 (parent owns click for the panel).
                   Tom 2026-06-03 — explicit title overrides PlTypeIcon's canonical
                   Evo-Step label so the HoverHint says "Past Versions". -->
              <PlTypeIcon pl-type="evo-step" size="sm" title="Past Versions" class="shrink-0" />
              <span>Past Versions</span>
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
            title="? Tour — start the SEM App onboarding tour: a 9-step walkthrough of the 11 planning stages, agents, and key affordances (about 4 minutes).  Use this once when you're new; the rest of the time it's a refresher."
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
          <!-- r41 v365 — 🧙 Guided Wizard button (auth bar) REMOVED. -->
        <!-- r41 v144 — Find / Illuminate body button removed; duplicate of Process Tools cluster (Tom Gilb 2026-06-17 cleanup). -->
        <!-- r41 v144 — Find / Illuminate body button removed; duplicate of Process Tools cluster (Tom Gilb 2026-06-17 cleanup). -->
          <button
            type="button"
            class="h-9 px-2.5 flex items-center justify-center
                   text-xs text-gray-500 hover:text-gray-700
                   focus-visible:outline focus-visible:outline-2
                   focus-visible:outline-offset-2 focus-visible:outline-blue-600
                   transition-colors duration-150 shrink-0"
            aria-label="Sign Out"
            title="Sign out — log out of your SEM App account.  Your work is saved automatically; signing back in restores everything."
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
        <!-- r41 v164 — Tom Gilb 2026-06-17 verbatim "MAKE THIS A GENERIC
             MENU TO A SET OF DEMOS, ON EACH STAGE, EACH TOOL, EACH AGENT".
             Renamed "See a demo" → "Demos"; opens the DemosMenu catalog. -->
        <button
          type="button"
          aria-label="Demos — catalog of per-stage / per-tool / per-agent recorded replays"
          title="🎬 Demos — opens the Demos catalog: pick a Stage, a Tool, or an Agent and watch a recorded replay of it in action.  (Demo = PASSIVE replay.  For an interactive learn-by-doing experience use 🧙 Guided.  For an UI walkthrough use ? Tour.)"
          class="bg-indigo-600 text-white rounded-lg px-3 py-1.5 text-xs font-medium
                 flex items-center gap-1.5
                 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                 transition-colors duration-150"
          @click="demosMenuOpen = true"
        >
          🎬 Demos
        </button>
        <!-- r41 v162 — body "Get A Plan" (mock mode) DELETED per Tom Gilb
             2026-06-17 verbatim "if already there, delete".  Already in
             Stage Tools IMPORT sub-pill at every stage. -->
        <!-- r41 v162 — body "Compare" button (mock mode) DELETED — same
             reasoning as auth-mode Compare above. -->
        <!-- Plan History — also in the persistent plan identity bar + in Actions menu -->
        <div class="relative shrink-0">
          <button
            type="button"
            class="h-9 px-2.5 rounded-lg bg-indigo-100 text-indigo-700 text-xs font-medium
                   hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500
                   transition-colors duration-150 inline-flex items-center gap-1.5"
            aria-label="Past Versions — saved Specs, Models, Contracts and agent reports"
            title="Past Versions — browse saved Specs, Imported Plans, Models, Contracts and agent reports. Load any previous version back into your workspace."
            @click="historyOpen = true"
          >
            <!-- r41 v218 (Tom Gilb 2026-06-19 "I have asked at least 2x to rename
                 [History]") — sweep continuation of the r41 v??-era rename
                 ("getting rid of the term history everywhere, in hover info
                 and menus").  The previous rename pass missed this Stage-Tools
                 button + the Version History drawer below.  Code identifiers
                 (HistoryGlyph, historyOpen, SpecHistory, specHistory) are
                 exempt per Spell-out-Type-Names rule's code-identifier carve-
                 out — only the rendered text + aria-label + title attributes
                 changed. -->
            <PlTypeIcon pl-type="evo-step" size="sm" title="Past Versions" class="shrink-0" />
            <span>Past Versions</span>
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
          class="hidden"
          aria-hidden="true"
          tabindex="-1"
          style="display:none"
        ><!-- r41 v365 — 🧙 Guided Wizard button (mock bar duplicate) REMOVED. Empty button kept as placeholder to avoid template parser issues; CSS forces no render. --></button>
        <!-- r41 v144 — Find / Illuminate body button removed; duplicate of Process Tools cluster (Tom Gilb 2026-06-17 cleanup). -->
        <!-- r41 v144 — Find / Illuminate body button removed; duplicate of Process Tools cluster (Tom Gilb 2026-06-17 cleanup). -->
        <!-- Feature #77: Onboarding tour button in mock mode -->
        <button
          type="button"
          class="bg-slate-200 hover:bg-slate-300 h-9 w-9 rounded-full text-slate-600 font-bold text-sm
                 flex items-center justify-center
                 focus:outline-none focus:ring-2 focus:ring-slate-400 transition-colors duration-150 shrink-0"
          aria-label="Tour"
          title="? Tour — start the SEM App onboarding tour: a 9-step walkthrough of the 11 planning stages, agents, and key affordances (about 4 minutes).  Use this once when you're new."
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

      <!-- Strategy Mode persistent banner — Tom Gilb 2026-06-09:
           "announce it clearly at each stage, close button to turn it off there!"
           Visible at every planning stage while Strategy Mode is active.
           Turn-off button lets user exit Strategy Mode without opening Settings. -->
      <Transition
        enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="opacity-0 -translate-y-2"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition-all duration-200 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 -translate-y-2"
      >
        <div
          v-if="isStrategyMode && !comparisonMode"
          class="w-full flex items-center gap-3 px-5 py-2.5 bg-blue-700"
          role="status"
          aria-live="polite"
          aria-label="Strategy Mode is active"
        >
          <!-- [→*] = Strategy / Solution keyed glyph (DD-011 / DD-015) -->
          <span
            class="font-mono font-bold text-blue-200 shrink-0 select-none"
            style="font-size:13px;"
            aria-hidden="true"
          >[→*]</span>

          <!-- Mode label -->
          <span class="flex-1 flex items-baseline gap-2 flex-wrap min-w-0">
            <span class="text-sm font-bold text-white leading-none">Planning is in Strategy Mode</span>
            <span class="text-[11px] text-blue-200 leading-none whitespace-nowrap">
              {{ strategyTermFor('Values') }} · {{ strategyTermFor('Solutions') }} · {{ strategyTermFor('Evo Steps') }}
            </span>
          </span>

          <!-- Turn off button — inline, no Settings required -->
          <button
            type="button"
            class="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold
                   bg-blue-900 hover:bg-blue-950 text-white border border-blue-500 transition-colors
                   focus:outline-none focus:ring-2 focus:ring-white/50"
            title="Turn off Strategy Mode — returns all labels to standard Planguage terminology (Value / Solution / Evo Step)"
            @click="setStrategyMode(false)"
          >
            Turn off  ×
          </button>
        </div>
      </Transition>

      <!-- Empty-Spec Callout — visible at the top of every Stage 2-11 view
           whenever currentSpec is null or has zero real entries.  Self-gates
           via its own internal v-if (component does not render on Stage 1
           or when entries exist), so it sits OUTSIDE the v-if/v-else-if
           chain below without affecting it.  Tom Gilb 2026-06-19:
           "I keep on seeing v0.1 and nothing in the spec library at all
           for Indianapolis". -->
      <EmptySpecCallout
        :spec="currentSpec"
        :stage="stage"
        @go-to-spec-parsing="onEmptySpecCalloutGoToParsing"
      />

      <!-- Feature #17: Comparison Mode — replaces normal workflow when active -->
      <ComparisonMode
        v-if="comparisonMode"
        @close="comparisonMode = false"
      />

      <!-- r41 v257 (Tom Gilb 2026-06-21 "4.1 NO table visible") — CRITICAL ROOT CAUSE
           FIX of v255: the v255 fix wrapped the strips in `<template v-if="...">` which
           Vue treated as the OPENING v-if of the surrounding chain.  When this v-if was
           true (stage !== 1), the SUBSEQUENT v-else-if branches at lines 9902 / 10854 /
           10878 (IET!) / 11262 / 11371 / 11493 ALL SKIPPED — because in a v-if/v-else-if
           chain only ONE branch renders.  Tom's IET vanished post-v255 because my v-if
           was eating the chain.
           FIX: removed the wrapping `<template v-if>` entirely.  Each strip now carries
           its FULL gate (`v-if="view === 'app' && currentSpec && stage !== 1 && planning-
           Stage === N"`) as an independent statement.  Each strip is a SIBLING node, not
           a v-if-chain participant — so the surrounding v-else-if chain at line 9254+
           continues unbroken.
           Process lesson re-banked inline: **never wrap conditional siblings in
           `<template v-if>` when they appear before a v-else-if chain — that v-if becomes
           the chain's opening clause and eats every subsequent v-else-if.  Use independent
           v-ifs on each child OR a `<div>` (not `<template>`) wrapper.** -->
      <Stage2SubStepStrip
        v-if="view === 'app' && currentSpec && stage !== 1 && planningStage === 2"
        :current="stage2SubStep"
        :done="stage2DoneSteps"
        @go="onStage2SubStepGo"
        @continue="onStage2ContinueToStage3"
      />
      <GenericStageSubStepStrip
        v-if="view === 'app' && currentSpec && stage !== 1 && planningStage === 3"
        :stage-num="3"
        :steps="STAGE3_SUBSTEPS"
        :current="stage3SubStep"
        :done="stage3DoneSteps"
        tagline="<span class='not-italic font-semibold text-white/70'>Sharpen</span> = inventory · interview · qualify · review."
        @go="onStage3SubStepGo"
      />
      <Stage4SubStepStrip
        v-if="view === 'app' && currentSpec && stage !== 1 && planningStage === 4"
        :current="stage4SubStep"
        :done="stage4DoneSteps"
        @go="onStage4SubStepGo"
      />
      <Stage5SubStepStrip
        v-if="view === 'app' && currentSpec && stage !== 1 && planningStage === 5"
        :current="stage5SubStep"
        :done="stage5DoneSteps"
        @go="onStage5SubStepGo"
      />
      <GenericStageSubStepStrip
        v-if="view === 'app' && currentSpec && stage !== 1 && planningStage === 6"
        :stage-num="6"
        :steps="STAGE6_SUBSTEPS"
        :current="stage6SubStep"
        :done="stage6DoneSteps"
        tagline="<span class='not-italic font-semibold text-white/70'>Evo Steps</span> = generate · prioritise · sharpen · confirm."
        @go="onStage6SubStepGo"
      />

      <!-- v497 (2026-07-21) — Tom "I may have missed it. Maybe the event can be
           more clearly marked in the screen".  Persistent visible marker for
           the Evo Steps generation event, mounted directly under the Stage 6
           sub-step strip so it lands in Tom's line of sight when he clicks 6.1
           (previously the only feedback was a 5-second toast + a banner INSIDE
           the internal stage-2 EvoPlanView block that Tom needed to scroll to
           find).  Three states:
             loading  → amber pulsing "⚡ Generating Evo Steps..." + spinner
             success  → green "✓ N Evo Steps generated" + "Review below" jump pin
             error    → red banner + retry pin
           STAYS visible until user acts or a new generation starts. -->
      <div
        v-if="view === 'app' && currentSpec && stage !== 1 && planningStage === 6 && (_evoPlanLoading || confirmedSteps.length > 0 || _evoPlanError)"
        class="w-full max-w-3xl mx-auto my-3 rounded-2xl px-4 py-3 ring-2 shadow-md flex items-center gap-3"
        :class="_evoPlanLoading
          ? 'bg-amber-50 ring-amber-300 text-amber-900 animate-pulse'
          : _evoPlanError
            ? 'bg-rose-50 ring-rose-300 text-rose-900'
            : 'bg-emerald-50 ring-emerald-300 text-emerald-900'"
        role="status"
        aria-live="polite"
      >
        <span v-if="_evoPlanLoading" aria-hidden="true" class="text-xl">⚡</span>
        <span v-else-if="_evoPlanError" aria-hidden="true" class="text-xl">⚠</span>
        <span v-else aria-hidden="true" class="text-xl">✓</span>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-bold leading-tight">
            <template v-if="_evoPlanLoading">Generating Evo Steps…</template>
            <template v-else-if="_evoPlanError">Evo Step generation failed</template>
            <template v-else>{{ confirmedSteps.length }} Evo Step{{ confirmedSteps.length === 1 ? '' : 's' }} generated</template>
          </p>
          <p class="text-xs leading-snug mt-0.5">
            <template v-if="_evoPlanLoading">
              Claudian is composing the Evo Step sequence from your Solutions.  Typically 60–180 seconds.  Result will appear in the Evo Planner below — scroll to watch it stream, or wait here for completion.
            </template>
            <template v-else-if="_evoPlanError">
              {{ _evoPlanError }}
            </template>
            <template v-else>
              The Evo Planner below shows each step.  Prioritise them (6.2), sharpen each (6.3), then confirm the plan (6.5).
            </template>
          </p>
        </div>
        <button
          v-if="!_evoPlanLoading"
          type="button"
          class="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
          :class="_evoPlanError
            ? 'bg-rose-600 hover:bg-rose-700 text-white'
            : 'bg-emerald-600 hover:bg-emerald-700 text-white'"
          :title="_evoPlanError
            ? 'Retry — re-run the Evo Step generation from your Solutions'
            : 'Scroll to the Evo Planner to review the generated steps'"
          @click="_evoPlanError
            ? _triggerEvoGeneration()
            : scrollEvoPlanIntoView()"
        >
          <span aria-hidden="true">{{ _evoPlanError ? '↻' : '↓' }}</span>
          <span>{{ _evoPlanError ? 'Retry' : 'Review below' }}</span>
        </button>
      </div>
      <GenericStageSubStepStrip
        v-if="view === 'app' && currentSpec && stage !== 1 && planningStage === 8"
        :stage-num="8"
        :steps="STAGE8_SUBSTEPS"
        :current="stage8SubStep"
        :done="stage8DoneSteps"
        tagline="<span class='not-italic font-semibold text-white/70'>Tasks</span> = decompose · estimate · assign · proceed."
        @go="onStage8SubStepGo"
      />
      <GenericStageSubStepStrip
        v-if="view === 'app' && currentSpec && stage !== 1 && planningStage === 9"
        :stage-num="9"
        :steps="STAGE9_SUBSTEPS"
        :current="stage9SubStep"
        :done="stage9DoneSteps"
        tagline="<span class='not-italic font-semibold text-white/70'>Study-Act</span> = measure · compare · update · decide · cycle."
        @go="onStage9SubStepGo"
      />

      <!-- r41 v478 — Stage 5 task-centric workspace (audit-backlog #4 Phase 2a).
           Composes with rule_stage_5_refine_design.md SUPREME. -->
      <StageTaskWorkspace
        v-if="view === 'app' && currentSpec && stage !== 1 && planningStage === 5"
        :stage-num="5"
        stage-name="Refine (Re-design)"
        purpose="Re-design solutions — change · delete · add — via four lenses: reduce resources, more value / same cost, reduce risks, relax constraints."
        subtitle="Stage-Has-A-Purpose SUPREME · Tom Gilb 2026-06-21: 'Re-design is any change to existing designs, deleting current designs, adding new design solutions.'"
        :actions="stage5WorkspaceActions"
        @action="onStage5WorkspaceAction"
      />

      <!-- r41 v477 — Stage 4 task-centric workspace (audit-backlog #3 Phase 2a).
           Composes with rule_stage_4_impacts_design.md SUPREME. -->
      <StageTaskWorkspace
        v-if="view === 'app' && currentSpec && stage !== 1 && planningStage === 4"
        :stage-num="4"
        stage-name="Impacts"
        purpose="Reach reasonable balance — enough solutions to reach Target levels of all our Values, with Evidence + Source + Credibility per estimate."
        subtitle="Stage-Has-A-Purpose SUPREME · only actual Evo delivery can prove balance is true."
        :actions="stage4WorkspaceActions"
        @action="onStage4WorkspaceAction"
      />

      <!-- r41 v476 (Tom Gilb 2026-07-01 "continue backlog" — audit-backlog
           items #5-9: Stages 6/7/8/9/10 task-centric workspaces per
           Stage-Has-A-Purpose SUPREME).  All five inherit the same
           StageTaskWorkspace.vue generic component built in v417.  Each
           renders only at its stage; each routes its actions to CANONICAL
           existing surfaces (No-Silent-Removal SUPREME — no new pipelines).
           Gated on the same guard as the sibling sub-step strips
           (`view === 'app' && currentSpec && stage !== 1`) so they only
           appear once the planner has left Stage 1 and has a spec. -->
      <StageTaskWorkspace
        v-if="view === 'app' && currentSpec && stage !== 1 && planningStage === 6"
        :stage-num="6"
        stage-name="Evo Steps"
        purpose="Generate + prioritise + sharpen Evo Steps — small, valuable, deliverable increments (Musk's velocity of learning)."
        subtitle="Stage-Has-A-Purpose SUPREME · every Evo Step is one learning cycle."
        :actions="stage6WorkspaceActions"
        @action="onStage6WorkspaceAction"
      />
      <StageTaskWorkspace
        v-if="view === 'app' && currentSpec && stage !== 1 && planningStage === 7"
        :stage-num="7"
        stage-name="Evo Impact"
        purpose="Estimate each Evo Step's impact on Values + Resources — populate the VDT so priorities become visible."
        subtitle="Stage-Has-A-Purpose SUPREME · Value ÷ Cost drives the ranking."
        :actions="stage7WorkspaceActions"
        @action="onStage7WorkspaceAction"
      />
      <StageTaskWorkspace
        v-if="view === 'app' && currentSpec && stage !== 1 && planningStage === 8"
        :stage-num="8"
        stage-name="Tasks"
        purpose="Decompose each Evo Step into concrete Tasks — estimate + assign so the delivery team can run."
        subtitle="Stage-Has-A-Purpose SUPREME · Tasks are what the team actually does."
        :actions="stage8WorkspaceActions"
        @action="onStage8WorkspaceAction"
      />
      <StageTaskWorkspace
        v-if="view === 'app' && currentSpec && stage !== 1 && planningStage === 9"
        :stage-num="9"
        stage-name="Study-Act"
        purpose="Measure real actuals · compare vs estimates · decide next cycle (continue · re-estimate · re-design)."
        subtitle="Stage-Has-A-Purpose SUPREME · every cycle feeds the next."
        :actions="stage9WorkspaceActions"
        @action="onStage9WorkspaceAction"
      />
      <StageTaskWorkspace
        v-if="view === 'app' && currentSpec && stage !== 1 && planningStage === 10"
        :stage-num="10"
        stage-name="Resources"
        purpose="Balance critical Values via OPTIMA + MultiVision sliders — real actuals feed real re-allocation."
        subtitle="Stage-Has-A-Purpose SUPREME · Optima book (Tom Gilb 2024) · every Resource has consequences."
        :actions="stage10WorkspaceActions"
        @action="onStage10WorkspaceAction"
      />

      <!-- Stage 1: SEM Entry Form + generated spec -->
      <template v-else-if="stage === 1 || !currentSpec">

        <!-- r41 v417 (Tom Gilb 2026-07-01 "please continue backlog" —
             audit-backlog #2: Stage 1 task-centric workspace per
             Stage-Has-A-Purpose SUPREME) — Stage 1 task-centric workspace.
             Renders BEFORE the sub-step strip so it's the FIRST thing
             planners see at Stage 1.  Five action pins: Capture Input,
             Generate Spec, Import Contract, Sharpen Existing, View/Edit
             Spec.  Each pin routes to the CANONICAL existing surface via
             onStage1WorkspaceAction (No-Silent-Removal SUPREME — no
             affordance replaced, only surfaced more prominently).  Only
             renders while at planningStage 1 — component unmounts
             cleanly on stage advance. -->
        <StageTaskWorkspace
          v-if="planningStage === 1"
          :stage-num="1"
          stage-name="Stakes"
          purpose="Capture stakeholders, values, functions, and constraints — so Stage 2 can propose solutions that deliver them."
          subtitle="Stage-Has-A-Purpose SUPREME: task-centric workspace.  Your Planguage spec is under the hood — this is where you DO the stage's job."
          :actions="stage1WorkspaceActions"
          @action="onStage1WorkspaceAction"
        />

        <!-- Stage 1 sub-step strip — five sub-stages (Tom Gilb 2026-06-19):
             1.1 Capture Spec Input · 1.2 Parse to S·E·M · 1.3 Add Implied Optional
             · 1.4 Generate Planguage Spec · 1.5 Edit & Refine.
             Sits at the top so the planner always sees the progression.

             r41 v235 (Tom Gilb 2026-06-21 verbatim "this is very confused it
             is at Stage 4 or so abd aksi in Phase 1.2 Please sort out, there
             is a logical sequence") — STRIP GATED on planningStage === 1.
             Two separate stage refs existed: 5-stage `stage` (spec-flow
             state, e.g. spec / evo plan / tasks / impact / export) and
             11-stage `planningStage` (Stakes → Solutions → Sharpen → Impacts
             → Refine → Evo Steps → … → Export).  This strip belongs to
             Stage 1 of the 11-stage planning bar; the outer template at
             line 8810 fires on the 5-stage `stage` ref, which is true on
             the spec view regardless of planning-bar position.  The extra
             `v-if="planningStage === 1"` ensures the Sub-Step strip is
             hidden when the planner is on Solutions / Sharpen / Impacts /
             … / Export.  No-Silent-Removal: strip still renders correctly
             at Stage 1 — verified by feature-smoke test PASS_2. -->
        <Stage1SubStepStrip
          v-if="planningStage === 1"
          :current="stage1SubStep"
          :done="stage1DoneSteps"
          @go="onStage1SubStepGo"
        />

        <!-- r41 v303 (Tom Gilb 2026-06-23 verbatim "i cannot see here what is
             done, what to do, how to move on") — Stage 1 status + next-action
             banner.  Mirrors the v295 Stage 9 triage banner / v298 SpecEditor
             guidance bar pattern.  Shows progress counts (Stakeholders /
             Values / Functions / Solutions / Constraints / Resources) + a
             plain-English next-action sentence + a prominent Continue →
             Stage 2 Solutions CTA.  Gated on planningStage === 1 AND a
             currentSpec exists — pre-spec state already has its own welcome
             card so a duplicate banner would be noise. -->
        <div
          v-if="planningStage === 1 && currentSpec"
          class="w-full max-w-3xl mx-auto mt-3 mb-4 rounded-xl ring-1 ring-amber-300/70 bg-gradient-to-br from-amber-50 to-orange-50 px-4 py-3 shadow-sm"
          role="region"
          aria-label="Stage 1 progress and next action"
        >
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <div class="flex-1 min-w-[280px]">
              <p class="text-[11px] font-bold text-amber-900 uppercase tracking-[0.14em] mb-1.5">
                Stage 1 · Stakes — Progress
              </p>
              <p class="text-sm text-slate-800 leading-relaxed">
                <span class="font-semibold">{{ _stage1ProgressSentence }}</span>
              </p>
              <p class="text-xs text-slate-600 mt-1.5 leading-relaxed">
                <span class="font-bold text-amber-700">Next:</span>
                {{ _stage1NextActionSentence }}
              </p>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              <button
                v-if="(currentSpec.values?.length ?? 0) === 0 && (currentSpec.functions?.length ?? 0) === 0"
                type="button"
                class="px-3 py-2 rounded-lg text-xs font-semibold text-amber-900
                       bg-white border border-amber-300 hover:bg-amber-50
                       hover:border-amber-400 shadow-sm transition-colors
                       focus:outline-none focus:ring-2 focus:ring-amber-400"
                title="Open the Spec Editor to add Values, Functions, Solutions, Constraints, or Resources by hand"
                aria-label="Open Spec Editor to add entries"
                @click="_openSpecEditor()"
              >
                ✎ Edit Spec
              </button>
              <button
                type="button"
                class="px-4 py-2 rounded-lg text-xs font-bold text-white
                       bg-gradient-to-r from-indigo-600 to-violet-600
                       hover:from-indigo-700 hover:to-violet-700
                       shadow-md hover:shadow-lg transition-all
                       focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1"
                title="Advance to Stage 2 · Solutions — generate more or better Solutions to deliver the Values you've captured.  Stages-are-Cyclic SUPREME: you can return to Stage 1 anytime."
                aria-label="Continue to Stage 2 Solutions"
                @click="handleStageBarNav(2)"
              >
                Continue → Stage 2 Solutions
              </button>
            </div>
          </div>
        </div>

        <!-- r41 v243 (Tom Gilb 2026-06-21 verbatim "I think we need to organize
             Stage 2 like the others in phases. 2.1 Read in The Planguage
             Specifications, 2.2 Generate Better or additional, or delete,
             solutions to match the Value Targets primarily, within resources
             and other constraints, 2.3 Give Planner opportunity to Sharpen,
             the entire set of spects, 2.4 Give the planner the opportunity to
             Apply Tools … and Agents …").  Stage 2 sub-step strip — mirrors
             Stage 1 strip pattern.  Composes with Stage-Has-A-Purpose SUPREME. -->
        <Stage2SubStepStrip
          v-if="planningStage === 2"
          :current="stage2SubStep"
          :done="stage2DoneSteps"
          @go="onStage2SubStepGo"
          @continue="onStage2ContinueToStage3"
        />

        <!-- r41 v251 (Tom Gilb 2026-06-21 — Stage 4 Reasonable Balance + sub-phase
             architecture).  Full design at memory/rule_stage_4_impacts_design.md.
             Sub-steps: 4.1 Look · 4.2 Adjust · 4.3 Approve · 4.4 Tools and Agents ·
             4.5 Move to Stage 5.  Composes with Stage-Has-A-Purpose SUPREME +
             Stages-are-Cyclic SUPREME. -->
        <Stage4SubStepStrip
          v-if="planningStage === 4"
          :current="stage4SubStep"
          :done="stage4DoneSteps"
          @go="onStage4SubStepGo"
        />

        <!-- r41 v253 (Tom Gilb 2026-06-21 — Stage 5 Refine Re-design architecture).
             Full design at memory/rule_stage_5_refine_design.md.  Sub-steps:
             5.1 Reduce Resources · 5.2 More Value Same Cost · 5.3 Reduce Risks ·
             5.4 Relax Constraints · 5.5 Approve Solution Set (Exit Process). -->
        <Stage5SubStepStrip
          v-if="planningStage === 5"
          :current="stage5SubStep"
          :done="stage5DoneSteps"
          @go="onStage5SubStepGo"
        />

        <!-- r41 v254 (Tom Gilb 2026-06-21 "plough through") — Stages 3, 6, 8, 9
             sub-step strips via the new generic component.  Each renders only
             when planningStage matches; same task-centric pattern as Stage 4/5. -->
        <GenericStageSubStepStrip
          v-if="planningStage === 3"
          :stage-num="3"
          :steps="STAGE3_SUBSTEPS"
          :current="stage3SubStep"
          :done="stage3DoneSteps"
          tagline="<span class='not-italic font-semibold text-white/70'>Sharpen</span> = inventory · interview · qualify · review."
          @go="onStage3SubStepGo"
        />
        <GenericStageSubStepStrip
          v-if="planningStage === 6"
          :stage-num="6"
          :steps="STAGE6_SUBSTEPS"
          :current="stage6SubStep"
          :done="stage6DoneSteps"
          tagline="<span class='not-italic font-semibold text-white/70'>Evo Steps</span> = generate · prioritise · sharpen · confirm."
          @go="onStage6SubStepGo"
        />
        <GenericStageSubStepStrip
          v-if="planningStage === 8"
          :stage-num="8"
          :steps="STAGE8_SUBSTEPS"
          :current="stage8SubStep"
          :done="stage8DoneSteps"
          tagline="<span class='not-italic font-semibold text-white/70'>Tasks</span> = decompose · estimate · assign · proceed."
          @go="onStage8SubStepGo"
        />
        <GenericStageSubStepStrip
          v-if="planningStage === 9"
          :stage-num="9"
          :steps="STAGE9_SUBSTEPS"
          :current="stage9SubStep"
          :done="stage9DoneSteps"
          tagline="<span class='not-italic font-semibold text-white/70'>Study-Act</span> = measure · compare · update · decide · cycle."
          @go="onStage9SubStepGo"
        />

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
          <!-- ── Front-page identity header ──────────────────────────────────
               r41 v42 (Tom Gilb 2026-06-16 verbatim: "I did never intend the
               kaliadeobooks would be on normal pages, for now only when cmnd i")
               — BookKaleidoscope removed from the welcome page.  It now lives
               exclusively inside the ⌘I picker → 📚 Books tab (r41 v27) and is
               reachable via the title-bar 📚 Books pin which routes to the
               same surface.  Welcome page returns to a simple identity header
               (Keeney 3-level icon + SEM App title) — no hero kaleidoscope. -->
          <div class="w-full max-w-2xl mx-auto px-4 mb-6">
            <div class="flex items-center gap-3">
              <img
                src="/icon-sem-app.svg"
                alt="SEM App"
                :title="`SEM App — Keeney three-level hierarchy (Value-Focused Thinking, 1992)\n\n▲ FUNDAMENTAL · amber\n  Objectives given from above — environment, parent org, regulations\n  We operate within these; cannot unilaterally redesign them\n\n● STRATEGIC · violet  ← this level (the hero row)\n  Our own plan — the Ends and Values we own and are accountable for\n\n▼ MEANS · emerald\n  What supports us from below — Functions and Solutions\n  These deliver our Strategic Ends upward to the stakeholder\n\n──────────────────────────────\nperson / §  =  Stakeholder (animate or inanimate)\n←O←         =  End: target that receives and delivers value\nO←          =  Means: source that fires value into the target`"
                class="h-12 w-12 flex-shrink-0 rounded-xl shadow-sm cursor-help"
              />
              <div>
                <h1 class="text-2xl font-bold text-gray-900 tracking-tight leading-tight">SEM App</h1>
                <p class="text-xs text-gray-500">Stakes · Ends · Means → Planguage Specification</p>
              </div>
            </div>
          </div>

          <!-- ── Spec-review mode: a spec exists — hide the entry form ──────────
               Prevents the confusing state where a blank entry form appears
               alongside a ready spec (e.g. after "Back to spec" from stage 2,
               after wizard flow, or after session restore at stage 1). -->
          <template v-if="currentSpec">
            <!-- r41 v249 (Tom Gilb 2026-06-21 verbatim "OK stage 4 impacts. The Planguage
                 set of artifacts is listed there. I said that it is not clear why and can
                 be deleted, there and earlier stages. As I said we have plenty tools to
                 analyze it under the hood") — per Stage-Has-A-Purpose SUPREME the raw spec
                 card list is INFRASTRUCTURE, not the primary surface of any stage past
                 Stage 1.  Hide the inline SpecOutput at planningStage >= 2; show a small
                 banner pointing the planner at the canonical Spec Editor tool above.
                 Stage 1 keeps the inline view because the planner is still reviewing what
                 was generated (sub-step 1.5 Planguage Edit).  No-Silent-Removal honoured:
                 the spec is hidden, not deleted — fully accessible via Spec Editor in the
                 toolbar (also linked from the banner below). -->
            <!-- r41 v250 (Tom Gilb 2026-06-21 follow-up: "at impacts stage the main idea
                 was to look at an impact estimation table, and that is not there at all
                 (it was before) so it has gone missing") — v249 banner only mentioned the
                 Spec Editor, which BURIED Stage 4's Impact Estimation Table (the actual
                 work of Stage 4 — gated by stage.value===3 + only reachable through
                 goToImpactStage()).  Banner is now STAGE-AWARE: shows the stage label +
                 the planningStageAction primary CTA prominently + a smaller Spec Editor
                 secondary link.  Composes with Stage-Has-A-Purpose SUPREME + No-Silent-
                 Removal (IET is now reachable in one click again) + MOVE Principle. -->
            <div
              v-if="planningStage >= 2"
              class="w-full max-w-xl rounded-xl border-2 border-indigo-300 bg-indigo-50/60 px-5 py-4 mb-4 text-slate-700 text-sm leading-relaxed shadow-sm"
              role="status"
              aria-label="Stage primary task"
            >
              <p class="font-semibold text-indigo-900 text-[11px] uppercase tracking-wider mb-2">
                Stage {{ planningStage }}: {{ (PLANNING_STAGES.find(s => s.stage === planningStage)?.label ?? '—') }} — primary task
              </p>
              <!-- r41 v251 (Tom Gilb 2026-06-21 "Purpose of Stage 4 Impacts: …reach reasonable
                   balance with the plan").  Stage-4-specific purpose announcement.  Composes
                   with rule_stage_4_impacts_design.md SUPREME + Stage-Has-A-Purpose SUPREME. -->
              <p v-if="planningStage === 4" class="text-[12px] text-indigo-800 mb-2 leading-snug italic">
                The purpose of this stage is to help the planner to reach
                <span class="not-italic font-bold">reasonable balance</span> with the plan —
                <span class="not-italic">"we seem to have enough solutions to reach Target levels of all our Values"</span>
                (only actual Evo delivery can prove this is true or not).
                <span class="not-italic text-[10px] text-indigo-600 block mt-0.5">— Tom Gilb, 21 June 2026</span>
              </p>
              <!-- r41 v253 (Tom Gilb 2026-06-21 — Stage 5 Refine Re-design purpose).
                   Reframed 2026-06-25 (Tom verbatim: "[Stage 5] is now about refining
                   a variety of different attributes. Best generalized as 'Refine
                   Attributes'") — constraint-only framing was obsolete; the four
                   sub-step lenses (resources · value · risks · constraints+qualifiers)
                   already span the attribute set. -->
              <p v-if="planningStage === 5" class="text-[12px] text-indigo-800 mb-2 leading-snug italic">
                The purpose of this stage is
                <span class="not-italic font-bold">refining attributes</span> by
                <span class="not-italic font-bold">re-design</span> —
                <span class="not-italic">"any change to existing designs, deleting current designs, adding new design solutions"</span>
                — across four attribute lenses (resources · value · risks · constraints + qualifiers), exiting with a
                <span class="not-italic font-bold">Planner-approved Solution Set</span>.
                <span class="not-italic text-[10px] text-indigo-600 block mt-0.5">— Tom Gilb, 21 + 25 June 2026</span>
              </p>
              <button
                v-if="planningStageAction"
                type="button"
                class="w-full flex items-center justify-between gap-3 min-h-[48px] rounded-xl bg-indigo-600 px-5 py-3 text-white font-semibold hover:bg-indigo-700 active:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
                :aria-label="`Stage ${planningStage} primary action: ${planningStageAction.label}`"
                :title="`Stage ${planningStage} primary action — ${planningStageAction.label}. Each stage has ONE primary task; the spec is infrastructure (Stage-Has-A-Purpose SUPREME, Tom Gilb 2026-06-21).`"
                @click="planningStageAction.handler()"
              >
                <span class="text-sm leading-snug text-left">{{ planningStageAction.label }}</span>
                <span class="text-lg shrink-0" aria-hidden="true">→</span>
              </button>
              <p class="text-[11px] text-slate-500 mt-2 leading-relaxed">
                The Planguage spec is under the hood at this stage. Use the
                <button
                  type="button"
                  class="underline font-semibold text-indigo-700 hover:text-indigo-900"
                  title="Open the Spec Editor — view + edit all Functions / Values / Solutions / Constraints / Resources / Stakeholders"
                  @click="_openSpecEditor({})"
                >Spec Editor</button>
                in the toolbar above to view or edit any entries.
                <span class="block mt-1 italic text-slate-400">
                  Tom Gilb 2026-06-21: "we have plenty tools to analyze it under the hood" + "the main idea [at Stage 4 Impacts] was to look at an impact estimation table".
                </span>
              </p>
            </div>
            <div v-else ref="specOutputEl" class="w-full max-w-5xl isolate">
              <SpecOutput
                :loading="sdkLoading"
                :error="sdkError"
                :spec="currentSpec"
                :markdown="markdown"
                :streaming-text="streamingText"
                :raw-input="originalInput"
                @cancel-generation="onCancelGeneration"
                :on-ambitious-spec="onAmbitiousSpec"
                :sharpened-entry-ids="sharpenedEntryIds"
                :sharpen-summary="sharpenSummary"
                :generated-at="specGeneratedAt"
                :planning-stage="planningStage"
                :plan-name="specModel?.name ?? 'Current Spec'"
                :plan-version="specModel?.version ? 'v' + specModel.version : undefined"
                @lean-spec-selected="onLeanSpecSelected"
                @open-collaborator="collaboratorOpen = !collaboratorOpen"
                @rewrite-copy="onRewriteCopy"
                @rewrite-replace="onRewriteReplace"
                @rewrite-entry="onRewriteEntry"
                @rewrite-entry-fix="onRewriteEntry"
                @open-editor="({ tab, entryId }) => _openSpecEditor({ tab, entryId })"
                @open-edit-info="editInfoOpen = true"
                @reparse="handleReParse"
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
              :plan-name="specModel?.name"
              :plan-version="specModel ? `v${specModel.version}` : undefined"
              @sharpened="onSpecSharpened"
              @done="sharpeningDone = true"
              @open-global-priority="globalPriorityOpen = true"
              @open-priority-info="priorityInfoOpen = true"
            />

            <!-- Deliberate advance gate — only shown after planner clicks "Sharp Enough".
                 Requires an explicit, named decision to move out of Spec/Sharpen into Evo.

                 r41 v236 (Tom Gilb 2026-06-21 verbatim "bad stage logic again, skip
                 suggested from stg 1 to 4") — added `planningStage === 3` to the
                 gate.  Was previously firing whenever sharpeningDone was true,
                 which leaked the "Plan Evo Steps" (Stage 6) CTA into Stage 1
                 (Stakes), Stage 2 (Solutions), Stage 4 (Impacts), and Stage 5
                 (Refine).  Suggesting Stage 6 from Stage 1 is a logical-sequence
                 violation — natural next from Stage 1 is Stage 2, not Stage 6.
                 The Sharpening-Complete-→-Evo-Steps semantic belongs to Stage 3
                 ONLY.  Other stages get their own contextual next-action via
                 nextActionLabel / planningStageAction.  Banked as a feature
                 invariant in scripts/feature-smoke-test.mjs so it cannot drift
                 again. -->
            <div v-if="!sdkLoading && sharpeningDone && planningStage === 3" class="w-full max-w-xl mt-4 space-y-2">
              <!-- Sharpening summary pill so the planner sees what was done -->
              <div class="flex items-center gap-2 px-1">
                <span class="text-amber-500 text-sm" aria-hidden="true">✅</span>
                <span class="text-xs text-slate-500">
                  {{ sharpenRounds.length }} sharpening round{{ sharpenRounds.length !== 1 ? 's' : '' }} complete
                  — plan version {{ specModel?.version ?? '—' }}
                </span>
              </div>

              <!-- r41 v408 (Tom Gilb 2026-06-28 verbatim: "I would like the per
                   agent breakdown.  And in all cases I want consolation that
                   the exact source of the change is attached to the spec") —
                   Per-agent contribution chips + Source-attribution
                   confirmation strip.  Each chip is the planner's at-a-glance
                   answer to "which agents did the work, and is the Source
                   attached?".  The footnote line is the explicit consolation:
                   *every* fix accepted via an agent panel stamps the agent's
                   name into the affected field's `fieldSources` entry (see
                   useFeynmanFindings _buildFeynmanSource + the symmetrical
                   helpers in Munger / Heilmeier / Elon / Incorruptible / Role
                   composables).  Composes with Done/You-Can/Continue SUPREME
                   (banner IS the DONE state) + Spec Sources design + AI-Max +
                   Conjunction-of-Technologies SUPREME source-layer audit. -->
              <div
                v-if="agentFixBreakdown.length > 0"
                class="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 space-y-1"
                :aria-label="`Per-agent breakdown: ${totalAgentFixes} fixes accepted across ${agentFixBreakdown.length} agent${agentFixBreakdown.length !== 1 ? 's' : ''}`"
              >
                <div class="flex flex-wrap items-center gap-1.5">
                  <span class="text-[10px] font-bold uppercase tracking-wider text-indigo-700 mr-1">
                    Per-agent breakdown
                  </span>
                  <span
                    v-for="entry in agentFixBreakdown"
                    :key="entry.key"
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-indigo-300 text-[11px] font-semibold text-indigo-900"
                    :title="`${entry.count} fix${entry.count !== 1 ? 'es' : ''} accepted from the ${entry.label} agent — Source: ${entry.label} attached to each mutated field`"
                  >
                    <span class="text-indigo-600">{{ entry.label }}</span>
                    <span class="tabular-nums">{{ entry.count }}</span>
                    <span class="text-indigo-400 text-[9px] uppercase tracking-wider">{{ entry.count === 1 ? 'fix' : 'fixes' }}</span>
                  </span>
                </div>
                <!-- The "consolation" footnote — explicit Source-attached
                     audit confirmation for every fix above. -->
                <p class="text-[11px] text-indigo-700 leading-snug flex items-start gap-1">
                  <span aria-hidden="true">✓</span>
                  <span>
                    <span class="font-semibold">Source attached.</span>
                    Each of the {{ totalAgentFixes }} fix{{ totalAgentFixes !== 1 ? 'es' : '' }}
                    above stamped its agent name into the affected field's
                    <code class="text-[10px] font-mono bg-white/70 px-1 rounded">fieldSources</code>
                    entry — visible in the Spec Editor and every export.
                  </span>
                </p>
              </div>

              <!-- Changes to Planguage Model — Tom 2026-06-09: "at the end of any and all
                   sharpenings we need to be able to see that list of changes in detail to
                   the Planguage model."  Renders all rounds' SharpenChangedEntry records
                   inline so the list persists after "Sharp Enough" is clicked. -->
              <div
                v-if="sharpenRounds.length > 0"
                class="rounded-lg border border-amber-200 bg-amber-50 overflow-hidden"
              >
                <!-- Collapsible header -->
                <button
                  type="button"
                  class="w-full flex items-center justify-between gap-2 px-3 py-2
                         text-xs font-semibold text-amber-800
                         hover:bg-amber-100 transition-colors"
                  :aria-expanded="changesListOpen"
                  :title="changesListOpen ? 'Collapse changes list' : 'Expand changes list'"
                  @click="changesListOpen = !changesListOpen"
                >
                  <span>
                    🔪 Changes to Planguage Model
                    ({{ sharpenRounds.reduce((n, r) => n + r.changes.length, 0) }} entries
                    across {{ sharpenRounds.length }} round{{ sharpenRounds.length !== 1 ? 's' : '' }})
                  </span>
                  <span class="text-amber-600">{{ changesListOpen ? '▲' : '▼' }}</span>
                </button>

                <div v-show="changesListOpen" class="divide-y divide-amber-100">
                  <div
                    v-for="(round, ri) in sharpenRounds"
                    :key="ri"
                  >
                    <!-- Round header -->
                    <div class="px-3 py-1 bg-amber-100/70 text-[10px] font-semibold text-amber-700 uppercase tracking-wide">
                      Round {{ ri + 1 }} — {{ round.category }}
                      · {{ round.changes.length }} change{{ round.changes.length !== 1 ? 's' : '' }}
                    </div>
                    <!-- Entry rows -->
                    <div
                      v-for="ch in round.changes"
                      :key="ch.id"
                      class="flex items-start gap-2 px-3 py-1.5 text-xs"
                    >
                      <!-- Type badge -->
                      <span
                        class="shrink-0 inline-block px-1.5 py-0.5 rounded text-[10px] font-bold leading-none mt-0.5"
                        :class="{
                          'bg-green-100 text-green-800': ch.entryType === 'F',
                          'bg-violet-100 text-violet-800': ch.entryType === 'V',
                          'bg-orange-100 text-orange-800': ch.entryType === 'S',
                        }"
                        :title="ch.entryType === 'F' ? 'Function' : ch.entryType === 'V' ? 'Value' : 'Solution'"
                      >{{ ch.entryType === 'F' ? 'Function' : ch.entryType === 'V' ? 'Value' : 'Solution' }}</span>
                      <!-- Entry ID + status + changed fields -->
                      <div class="flex-1 min-w-0">
                        <span class="font-semibold text-slate-800">{{ ch.id }}</span>
                        <span
                          class="ml-1.5 text-[10px] px-1 py-0.5 rounded"
                          :class="ch.status === 'added' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'"
                        >{{ ch.status }}</span>
                        <div v-if="ch.changedFields.length" class="text-slate-500 mt-0.5">
                          Changed: {{ ch.changedFields.join(' · ') }}
                        </div>
                        <!-- After values for key fields -->
                        <div
                          v-if="ch.after.description"
                          class="text-slate-600 mt-0.5 italic line-clamp-2"
                        >{{ ch.after.description }}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Advance to Impacts (next stage in sequence) — Tom Gilb 2026-06-21
                   verbatim: "after stg 3 sharpening complete, it jumped to stg 6, hopping
                   over impact etc".  Previous design jumped 3→6 directly (skipping 4
                   Impacts + 5 Refine).  Now goes to Stage 4 — the IMMEDIATE next stage in
                   the canonical sequence per Stage-Has-A-Purpose SUPREME + Stages-are-
                   Cyclic SUPREME (no silent stage skipping; user can always jump further
                   via the stage strip).  Secondary link below preserves the previous
                   direct-to-Evo-Steps path for advanced users who explicitly want to skip
                   the Impacts/Refine stages.  Tom 2026-06-09 quote "if 'enough' we should
                   be leaving that stage" is honoured — we ARE leaving Stage 3; we're going
                   to Stage 4 next, not jumping over it. -->
              <button
                type="button"
                class="w-full flex items-center justify-between gap-3 min-h-[52px] rounded-xl
                       bg-indigo-600 px-5 py-3
                       text-white font-semibold
                       hover:bg-indigo-700 active:bg-indigo-800
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                       transition-colors"
                aria-label="Done Sharpening — Continue to Stage 4 Impacts"
                @click="handleStageBarNav(4)"
              >
                <span class="text-sm leading-snug text-left">
                  Sharpening Complete — Continue to Stage 4: Impacts<br>
                  <span class="text-indigo-200 font-normal text-xs">Estimate impact of each Solution against each Value (the next stage in sequence)</span>
                </span>
                <span class="text-lg shrink-0" aria-hidden="true">→</span>
              </button>
              <!-- Secondary: explicit skip-to-Evo-Steps for advanced users.  Tom Gilb
                   2026-06-21 — "Stages are cyclic"; we never SILENTLY skip stages, but
                   the planner can EXPLICITLY skip if they know what they're doing. -->
              <button
                type="button"
                class="w-full mt-1.5 flex items-center justify-center gap-2 min-h-[36px] rounded-lg
                       bg-white border border-indigo-200 px-4 py-2 text-indigo-700 text-xs
                       hover:bg-indigo-50 hover:border-indigo-400 transition-colors"
                aria-label="Advanced: skip Impacts and Refine — jump directly to Stage 6 Evo Steps"
                title="Advanced: skip the Impacts (Stage 4) + Refine (Stage 5) stages and go directly to Evo Steps planning. You can always return to 4 / 5 later — Stages are cyclic (Tom Gilb 2026-06-21)."
                @click="handleStageBarNav(6)"
              >
                <span aria-hidden="true">⏭</span>
                <span>Skip directly to Evo Steps (Stage 6) — advanced</span>
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

            <!-- Strategy Agent — Strategy Sharpening button (Tom 2026-06-09).
                 Available in Sharpening stage regardless of Strategy Mode. -->
            <div class="w-full max-w-xl mt-2">
              <button
                type="button"
                class="w-full flex items-center justify-center gap-1.5 min-h-[36px] rounded-lg
                       border border-orange-300 bg-orange-50 text-orange-700 text-sm font-medium
                       hover:bg-orange-100 hover:border-orange-400
                       focus:outline-none focus:ring-2 focus:ring-orange-400 transition-colors"
                aria-label="Open Strategy Sharpening — 10-dimension strategy analysis"
                title="Strategy Sharpening — 10 dimensions: Value Traceability, Impact Quantification, Constraint Compliance, Goal Coverage, Resource Feasibility, Solution Specificity, Redundancy Detection, Dependency Ordering, Past Sharpening Patterns, Strategy Completeness"
                @click="strategyAgentOpen = true"
              >
                <span class="font-mono font-bold text-xs">[→*]</span>
                Strategy Sharpening
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
            <!-- r41 v162 — Tom Gilb 2026-06-17 verbatim "time to organize into
                 a 'Stage [N] [Name, like Spec Draft] Menu' (in this case all
                 stuff to capture the Spec Draft. Call it Spec Draft Menu.
                 The other stuff, move up or if already there, delete".
                 Stage 1's body content (mode toggle + entry form + SpecOutput
                 loading frame) is wrapped in a labeled "Spec Draft Menu"
                 container so the planner sees ONE clear menu at Stage 1
                 instead of scattered controls.  Get A Plan / Compare body
                 duplicates DELETED above. -->
            <!-- r41 2026-06-20 (Tom Gilb verbatim "MAKE THE WINDOW MUCH
                 BROADER") — outer wrapper widens to max-w-5xl when an
                 imported document is loaded (matching the inner SEMEntryForm
                 form container's conditional width).  Default max-w-2xl
                 keeps the fresh-typing UX focused.  Without this, the
                 outer max-w-2xl was constraining the inner max-w-5xl to
                 672 px and Tom's earlier wider-window ask wasn't actually
                 taking effect.  Composes with accessibility_tom.md
                 (Tom 85 — wider reading area for long contracts) + MOVE
                 Principle (import event auto-widens, no menu-dive). -->
            <!-- r41 2026-06-20 (Tom Gilb verbatim "the input window should be
                 much broader") — bumped further from max-w-5xl (1024 px) to
                 max-w-7xl (1280 px).  Composes with accessibility_tom.md
                 (Tom 85 — wider reading area). -->
            <!-- r41 v342 (Tom Gilb 2026-06-25 screenshot + verbatim "retro
                 thin unreadable columns (use whole screen! Breadth)"): the
                 Spec Draft Menu card was capped at max-w-7xl (1280 px) which
                 clamped the inner SEMEntryForm's own max-w-[1800px] at
                 review stage to ~1212 px — squeezing the 4-column grid into
                 ~283 px per column.  Now widens to max-w-[1800px] at review
                 stage so the form can use the screen breadth Tom asked for.
                 Input stage keeps max-w-7xl so the typing experience stays
                 focused. formSubStage is already kept in sync via the
                 @stage-change emit (line ~10926). -->
            <div
              class="w-full mx-auto mb-3 px-4"
              :class="formSubStage === 'review' ? 'max-w-[1800px]' : 'max-w-7xl'"
            >
              <div class="rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 via-violet-50 to-indigo-50 shadow-sm overflow-hidden">
                <!-- Spec Draft Menu header -->
                <div class="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white flex items-center gap-2">
                  <span class="text-[10px] font-bold uppercase tracking-widest opacity-80">Stage 1</span>
                  <span class="text-[9px] opacity-60" aria-hidden="true">·</span>
                  <span class="text-sm font-extrabold tracking-tight">Spec Draft Menu</span>
                  <span class="ml-auto text-[10px] font-medium opacity-80">capture the initial Spec</span>
                </div>
                <div class="px-4 py-3">


            <!-- r41 2026-06-20 (Tom Gilb verbatim "the just do it seemed dead
                 when i clicked, Need a more specific text for it 'Analyze As
                 Is'. and 'Answer Some Questions, for better Analysis'") —
                 Mode toggle relabeled per Tom's exact phrasing.  The "dead-
                 click" symptom: "Just do it" was the DEFAULT mode, so
                 clicking it when already selected did nothing visible.
                 Added a clear active-state ring + a tiny "currently active"
                 caption so the selection is unambiguous on every click.
                 Composes with: DD-009 Zero-Training UI (button text spells
                 out the actual behaviour, no jargon), Spell-out-Type-Names
                 SUPREME spirit (descriptive labels over snappy slogans),
                 No-Silent-Action (visible click-feedback ring + active
                 caption), accessibility_tom.md (Tom 85 — readable button
                 text + clear active-state). -->
            <div class="w-full max-w-2xl mx-auto px-4 mb-2 flex items-center gap-3 flex-wrap">
              <span class="text-xs text-gray-400 font-medium shrink-0">Analysis:</span>
              <div
                class="flex rounded-lg border border-gray-200 bg-gray-100 p-0.5"
                role="group"
                aria-label="Analysis approach"
              >
                <!-- r41 2026-06-20 (Tom Gilb verbatim "analyze as is is dead")
                     — clicked the already-selected default button still felt
                     dead.  Added a CSS-keyframe click animation
                     (`mode-click-pulse`) that runs on EVERY mousedown,
                     regardless of whether state actually changes.  Brief
                     scale + ring pulse so the planner always sees the
                     button acknowledge the click.  Composes with: DD-009
                     Zero-Training UI (every click confirmed), accessibility
                     _tom.md (Tom 85 — clear button feedback). -->
                <button
                  type="button"
                  :class="[
                    'min-h-[32px] px-3 text-xs font-bold rounded-md transition-all duration-150',
                    'active:scale-[0.96] active:ring-4 active:ring-indigo-500',
                    analysisMode === 'quick'
                      ? 'bg-white text-indigo-900 shadow-sm ring-2 ring-indigo-400'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-white/60'
                  ]"
                  aria-label="Analyze As Is — generate spec without clarifying questions"
                  title="⚡ Analyze As Is — after you parse + click Generate Spec, the AI generates without asking clarifying questions.  Fastest path.  (Default — already active.)"
                  @click="analysisMode = 'quick'"
                >⚡ Analyze As Is</button>
                <button
                  type="button"
                  :class="[
                    'min-h-[32px] px-3 text-xs font-bold rounded-md transition-all duration-150',
                    'active:scale-[0.96] active:ring-4 active:ring-indigo-500',
                    analysisMode === 'precise'
                      ? 'bg-white text-indigo-900 shadow-sm ring-2 ring-indigo-400'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-white/60'
                  ]"
                  aria-label="Answer Some Questions, for better Analysis — the AI asks 3 to 5 clarifying questions before generating the spec"
                  title="🎯 Answer Some Questions, for better Analysis — the AI asks 3 to 5 clarifying questions to sharpen its understanding, then generates a more precise spec."
                  @click="analysisMode = 'precise'"
                >🎯 Answer Some Questions, for better Analysis</button>
              </div>
              <!-- Live caption — explicitly names the active choice so the
                   planner always sees confirmation of what was clicked. -->
              <span class="text-[11px] text-indigo-700 italic">
                <template v-if="analysisMode === 'quick'">
                  → No clarifying questions before generation.
                </template>
                <template v-else>
                  → AI will ask 3–5 questions before generating.
                </template>
              </span>
            </div>

            <SEMEntryForm
              ref="semEntryFormRef"
              :key="formResetKey"
              :generating="sdkLoading"
              :show-sticky-bars="planningStage === 1"
              :accepted-suggestion-actor="acceptedSuggestionActor"
              @submit="handleSubmit"
              @stage-change="formSubStage = $event"
              @spec-import="onSpecFileImport"
              @go-back="handleFormGoBack"
              @open-scope-editor="onOpenScopeEditorFromStage1"
            />
            <!-- SpecOutput shown here for loading/error feedback while API call is in flight -->
            <div ref="specOutputEl" class="w-full max-w-5xl isolate">
              <SpecOutput
                :loading="sdkLoading"
                :error="sdkError"
                :spec="currentSpec"
                :markdown="markdown"
                :streaming-text="streamingText"
                :raw-input="originalInput"
                @cancel-generation="onCancelGeneration"
                :on-ambitious-spec="onAmbitiousSpec"
                :sharpened-entry-ids="sharpenedEntryIds"
                :sharpen-summary="sharpenSummary"
                :generated-at="specGeneratedAt"
                :planning-stage="planningStage"
                :plan-name="specModel?.name ?? 'Current Spec'"
                :plan-version="specModel?.version ? 'v' + specModel.version : undefined"
                @lean-spec-selected="onLeanSpecSelected"
                @open-collaborator="collaboratorOpen = !collaboratorOpen"
                @rewrite-copy="onRewriteCopy"
                @rewrite-replace="onRewriteReplace"
                @rewrite-entry="onRewriteEntry"
                @rewrite-entry-fix="onRewriteEntry"
                @open-editor="({ tab, entryId }) => _openSpecEditor({ tab, entryId })"
                @open-edit-info="editInfoOpen = true"
                @reparse="handleReParse"
              />
            </div>

            <!-- AmuseMeButton now lives inside SpecOutput.vue (line 55) so it is not
                 duplicated here. SpecOutput renders it whenever :loading is true. -->
                </div><!-- /Spec Draft Menu body -->
              </div><!-- /Spec Draft Menu card -->
            </div><!-- /Spec Draft Menu outer container -->

            <!-- Copyright footer — always visible at the bottom of Stage 1 -->
            <div class="w-full max-w-xl mt-8 mb-2 mx-auto flex justify-center">
              <button
                type="button"
                class="text-[11px] text-gray-400 hover:text-gray-600 transition-colors
                       focus:outline-none focus:ring-1 focus:ring-gray-300 rounded px-1"
                title="Copyright & Attribution — open the legal notice + credits panel."
                @click="copyrightPanelOpen = true"
              >{{ _copyrightShortNotice }} · Copyright &amp; Attribution</button>
            </div>
          </template>
        </template>

      </template>

      <!-- Stage 2: Evo Step Planner -->
      <template v-else-if="stage === 2 && currentSpec">
        <!-- r41 v277 (Tom Gilb 2026-06-22 "AI was slow message disappeared
             before I could read… a second far too fast disappearing message
             said something about what was generated… moved to stage 2 but I
             was not properly informed of success or failure or what
             happened now!") — PERSISTENT post-generation banner.  Mirrors
             the toast content but stays visible UNTIL Tom dismisses it.
             Composes with: accessibility_tom.md (Tom 85 — no one-shot info
             loss), No-Silent-Data-Loss SUPREME, MOVE Principle (visible
             at-a-glance on the destination stage), DD-009 Zero-Training UI
             (✕ dismiss + colour code by kind).  Cleared on next generation
             OR on user dismiss. -->
        <div
          v-if="lastGenerationReport"
          class="w-full max-w-2xl mb-4 rounded-2xl px-4 py-3 ring-2 shadow-md flex items-start gap-3"
          :class="lastGenerationReport.kind === 'success'
            ? 'bg-emerald-50 ring-emerald-300 text-emerald-900'
            : lastGenerationReport.kind === 'slow-fallback'
              ? 'bg-amber-50 ring-amber-300 text-amber-900'
              : 'bg-rose-50 ring-rose-300 text-rose-900'"
          role="status"
          aria-live="polite"
        >
          <div class="flex-1 min-w-0">
            <p class="text-sm font-bold mb-0.5">{{ lastGenerationReport.headline }}</p>
            <p class="text-xs leading-snug whitespace-pre-wrap">{{ lastGenerationReport.detail }}</p>
          </div>
          <button
            type="button"
            class="shrink-0 h-7 w-7 flex items-center justify-center rounded-full bg-white/60 hover:bg-white text-slate-600 hover:text-slate-900 ring-1 ring-current/20"
            title="Dismiss this generation report (recall via 🔔 bell in title bar)"
            aria-label="Dismiss generation report"
            @click="dismissGenerationReport"
          >×</button>
        </div>

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
        <!-- r41 v262 (Tom Gilb 2026-06-21 "it says use evo planner, but where is it? how do
             we proceed? why can it just do it and announce it is done") — wrapper div with
             ref + aria-label so the Stage 6.1 sub-step handler can scroll EvoPlanView into
             view after auto-firing generation.  Mirrors the v256 IET-scrollIntoView pattern. -->
        <div ref="evoPlanWrapperEl" aria-label="Evo Planner — Stage 6 primary surface">
        <EvoPlanView
          :spec-block="currentSpec"
          :raw-input="originalInput"
          :planning-stage="planningStage"
          @confirmed="onPlanConfirmed($event)"
          @sharpen-plan="handleSharpenPlan"
          @open-visualise="({ tab }) => { _vizInitialTab = tab; visualiseOpen = true }"
          @open-heatlane="heatLaneOpen = true"
          @open-evo-simulator="evoSimulatorOpen = true"
          @open-editor="({ tab }) => _openSpecEditor({ tab })"
          @open-penta="pentaOpen = true"
          @open-multi-vision="openMultiVision()"
          @open-optima="optimaOpen = true"
          @open-kiss="kissOpen = true"
          @open-solution-sharpen="solutionSharpenOpen = true"
          @open-multi-forks="openMultiForks()"
          @open-value-flow="valueFlowOpen = true"
          @advance-substep="onStage6SubStepGo($event)"
        />
        </div>
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
                title="Planguage type glyph R. — Resource entry (time, people, money, other budgets) · Double-click for glyph lineage and details"
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
                    title="Planguage keyed action glyph [*]→[**] — existing item transformed to improved version · Improve / Augment / Edit · Double-click for glyph lineage and details"
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
                    title="Planguage type glyph →O — Resource entry (time, people, money, other budgets) · Scale / Meter / Tolerable / Goal define your resource targets · Double-click for glyph lineage and details"
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
                    title="Open Resource Spec entries — view and sharpen all Resource entries in the Spec"
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
          <!-- Show "—" when no Impact Estimation data has been captured yet, not "0"
               which looks like a bug. capturedCalendar/CapitalCosts start as {} and
               are only populated when the user commits data in Stage 3 (IET).       -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div class="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-3">
              <div class="text-[10px] uppercase font-bold text-emerald-700 tracking-wider">Calendar Cost</div>
              <div class="text-2xl font-extrabold text-emerald-900 mt-1">
                <template v-if="Object.keys(capturedCalendarCosts).length > 0">
                  {{ Object.values(capturedCalendarCosts).reduce((s, v) => s + (v || 0), 0).toLocaleString() }}
                  <span class="text-xs font-normal text-emerald-700/80 ml-1">days</span>
                </template>
                <span v-else class="text-slate-400 font-normal text-base">— no data yet</span>
              </div>
              <div class="text-[10px] text-emerald-700/70 mt-1 italic">
                {{ Object.keys(capturedCalendarCosts).length > 0 ? 'from prior Impact Estimation stage' : 'complete Stage 3 · Impact Estimation to populate' }}
              </div>
            </div>
            <div class="rounded-xl border-2 border-violet-200 bg-violet-50 p-3">
              <div class="text-[10px] uppercase font-bold text-violet-700 tracking-wider">Capital Cost</div>
              <div class="text-2xl font-extrabold text-violet-900 mt-1">
                <template v-if="Object.keys(capturedCapitalCosts).length > 0">
                  ${{ Object.values(capturedCapitalCosts).reduce((s, v) => s + (v || 0), 0).toLocaleString() }}
                </template>
                <span v-else class="text-slate-400 font-normal text-base">— no data yet</span>
              </div>
              <div class="text-[10px] text-violet-700/70 mt-1 italic">
                {{ Object.keys(capturedCapitalCosts).length > 0 ? 'from prior Impact Estimation stage' : 'complete Stage 3 · Impact Estimation to populate' }}
              </div>
            </div>
            <div class="rounded-xl border-2 border-blue-200 bg-blue-50 p-3">
              <div class="text-[10px] uppercase font-bold text-blue-700 tracking-wider">Top Value / Resource ratios (efficiency)</div>
              <ul class="text-[11px] text-blue-900 mt-1 space-y-0.5">
                <li
                  v-for="[k, v] in Object.entries(capturedVCRatios).sort((a, b) => b[1] - a[1]).slice(0, 4)"
                  :key="k"
                ><b>{{ k }}</b>: {{ v.toFixed(2) }}</li>
                <li v-if="Object.keys(capturedVCRatios).length === 0" class="italic opacity-70">No data yet — complete Stage 3 · Impact Estimation first.</li>
              </ul>
            </div>
          </div>

          <!-- R. entry display (Phase 1 schema, r77) -->
          <div class="rounded-xl border-2 border-teal-200 bg-teal-50/40 p-4">
            <div class="flex items-center justify-between mb-2">
              <div>
                <h3 class="text-sm font-extrabold text-teal-900">Resource entries in this Spec</h3>
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
                <span v-if="rBudget(r)" class="text-[11px] text-emerald-700 ml-2">{{ rBudgetLabel(r) }}: {{ rBudget(r) }}</span>
              </li>
            </ul>
            <div v-else class="text-[12px] text-teal-800/70 italic mt-2">
              No Resource entries yet.  Use the Sharpening panel above to walk through the 9 Gilb-cited dimensions
              + 5 generative Advanced Tools; copy the prompt + spec to Claudian to draft Resource entries grounded in CE, Cost Engineering, SEA, Optima.
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

      <!-- Stage 5 · Refine Solutions — dedicated view (Tom 2026-06-08 major redesign).
           Routing: STAGE_ACTION_MAP[5] = 'to-impact' → goToImpactStage() sets stage=3.
           This block takes precedence over the generic stage===3 block below, so the
           new RefineSolutionsView renders when planningStage===5 (same pattern as
           planningStage===10 for Resources). -->
      <template v-else-if="planningStage === 5 && currentSpec">
        <RefineSolutionsView
          :spec="currentSpec"
          :vc-ratios="capturedVCRatios"
          :spec-model="specModel"
          :confirmed-steps="confirmedSteps"
          @open-visualise="visualiseOpen = true"
          @open-multi-forks="multiForksOpen = true"
          @open-penta="pentaOpen = true"
          @open-value-flow="valueFlowOpen = true"
          @open-kiss="kissOpen = true"
          @open-optima="optimaOpen = true"
          @open-resources-sharpen="resourcesSharpenOpen = true"
          @open-solution-sharpen="solutionSharpenOpen = true"
          @open-strategy-agent="strategyAgentOpen = true"
          @open-editor="({ tab, entryId }) => _openSpecEditor({ tab, entryId })"
          @open-priority-info="priorityInfoOpen = true"
          @go-to-impacts="handleStageBarNav(7)"
          @go-to-evo-plan="handleStageBarNav(6)"
          @go-back="handleStageBarNav(4)"
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

          <!-- Stage 7 export — ExportSpecPin (Tom 2026-06-06: "I want one button EXPORT to avoid
               clutter, and when clicked it copies and exposes the other choices email/download/messages").
               Auto-copies on click, 20-second countdown channel menu, collapses to clipboard confirm.
               Rule: rule_export_button_on_all_windows.md (SUPREME). -->
          <ExportSpecPin
            v-if="currentSpec"
            :has-spec="!!currentSpec"
            :spec-name="specModel?.name ? specModel.name + ' · Evo Impact' : 'Evo Impact'"
            @copy="copyStage7()"
            @email="emailStage7()"
            @download="downloadStage7Html()"
            @message="messagePlan()"
            @copy-for-chat="copyPlanForChat()"
          />
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
          class="w-full max-w-none mb-6 rounded-2xl border-2 border-indigo-500
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
               Tom 2026-06-05: "each diagram needs copy, email, download buttons"
               Tom 2026-06-06: "put the name of exactly what is being copied in the bar" -->
          <div class="flex items-center flex-wrap gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 border-t border-indigo-500/40">
            <!-- Section label — tells user WHAT the footer acts on -->
            <span class="text-[10px] font-bold text-indigo-200 uppercase tracking-wider mr-1">Value Flow Diagram</span>
            <span class="text-indigo-400/60 text-xs">·</span>
            <!-- Copy Full Spec (NOT just the diagram — autoCopyPlan copies whole Planguage Spec) -->
            <button
              type="button"
              class="flex items-center gap-1.5 text-[11px] font-semibold text-white/90
                     bg-white/15 hover:bg-white/25 border border-white/30
                     rounded-lg px-3 py-1.5 transition-colors"
              title="Copy the FULL Planguage Spec as colourful HTML to clipboard (⌘V to paste) — this copies the whole spec, not only the diagram"
              @click="autoCopyPlan()"
            ><CopyGlyph size="compact" />Copy Full Spec</button>
            <!-- Email Full Spec -->
            <button
              type="button"
              class="flex items-center gap-1.5 text-[11px] font-semibold text-white/90
                     bg-white/15 hover:bg-white/25 border border-white/30
                     rounded-lg px-3 py-1.5 transition-colors"
              title="Email the FULL Planguage Spec — opens Mail, ⌘V to paste the colourful version"
              @click="emailPlan()"
            ><EmailGlyph size="compact" />Email Full Spec</button>
            <!-- Download Value Flow SVG -->
            <button
              type="button"
              class="flex items-center gap-1.5 text-[11px] font-semibold text-white/90
                     bg-white/15 hover:bg-white/25 border border-white/30
                     rounded-lg px-3 py-1.5 transition-colors"
              title="Download this Value Flow Diagram as an SVG file"
              @click="downloadValueFlowSvg()"
            ><GetGlyph size="compact" />Download Value Flow SVG</button>
            <!-- Enlarge (spacer + right-aligned) -->
            <span class="flex-1" />
            <button
              type="button"
              class="text-[11px] font-semibold text-white/90 bg-white/15 hover:bg-white/25
                     border border-white/30 rounded-lg px-3 py-1.5 transition-colors"
              title="Open the full-screen Value Flow diagram"
              @click="valueFlowOpen = true"
            >Enlarge The Value Flow Diagram ↗</button>
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
        <!-- Tom 2026-06-06: "make the weak blue lines around these tools much clearer"
             + "put the term ABOVE AS APPROPRIATE" — strong teal border + label banner above -->
        <div
          v-if="_stepsForDiagram.length > 0"
          class="w-full mb-6 rounded-2xl border-2 border-teal-500 shadow-md overflow-hidden"
        >
          <!-- Label banner ABOVE the table -->
          <div class="flex items-center gap-3 px-5 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600">
            <span class="text-sm font-bold text-white">Impact Estimation — Values × Evo Steps</span>
            <span class="text-[11px] text-teal-100 ml-1">IET · one column per Evo Step (unit of value delivery)</span>
          </div>
          <ImpactEstimationStepView
            :values="currentSpec.values"
            :steps="_stepsForDiagram"
            :solutions="currentSpec.solutions"
            :impact-matrix="capturedImpactMatrix"
          />
          <!-- V × Evo Step table actions — ExportSpecPin (Tom 2026-06-06: one-button export design) -->
          <div
            v-if="currentSpec"
            class="flex flex-col gap-2 px-4 py-2.5
                   bg-teal-50 border-t border-teal-300"
          >
            <span class="text-[10px] text-teal-700 font-bold uppercase tracking-wider">Value × Evo Step Impact Table</span>
            <ExportSpecPin
              :has-spec="!!currentSpec"
              spec-name="Value × Evo Step Impact Table"
              @copy="copyImpactStepTable()"
              @email="emailImpactStepTable()"
              @download="downloadImpactStepTable()"
              @message="messagePlan()"
              @copy-for-chat="copyPlanForChat()"
            />
          </div>
        </div>

        <!-- ── V × Solution editor (SECONDARY here — feeds the V × Step view above)
             Kept on this page so users can sharpen the underlying V × S estimates
             and watch the V × Step aggregations update reactively above.
             Tom 2026-06-06: strong border + label banner above. -->
        <div
          v-if="currentSpec"
          ref="ietWrapperEl"
          aria-label="Impact Estimation Table — Stage 4 primary surface"
          class="w-full mb-6 rounded-2xl border-2 border-indigo-500 shadow-md overflow-hidden"
        >
          <!-- Label banner ABOVE the table -->
          <div class="flex items-center gap-3 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600">
            <span class="text-sm font-bold text-white">Impact Estimation — Values × Solutions</span>
            <span class="text-[11px] text-indigo-100 ml-1">IET · edit here to feed the Evo Step table above</span>
          </div>
          <ImpactEstimationView
            ref="ietRef"
            :values="currentSpec.values"
            :solutions="currentSpec.solutions"
            :resource-claims="{}"
            @matrix-updated="(matrix, efficiency, cal, cap) => _onMatrixUpdated(matrix, efficiency, cal, cap)"
          />
          <!-- V × Solution table actions — ExportSpecPin (Tom 2026-06-06: one-button export design) -->
          <div
            class="flex flex-col gap-2 px-4 py-2.5
                   bg-indigo-50 border-t border-indigo-300"
          >
            <span class="text-[10px] text-indigo-700 font-bold uppercase tracking-wider">Value × Solution Impact Table</span>
            <ExportSpecPin
              :has-spec="!!currentSpec"
              spec-name="Value × Solution Impact Table"
              @copy="copyImpactSolutionTable()"
              @email="emailImpactSolutionTable()"
              @download="downloadImpactSolutionTable()"
              @message="messagePlan()"
              @copy-for-chat="copyPlanForChat()"
            />
          </div>
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
        <!-- r41 v295 (Tom Gilb 2026-06-22 "we need a clear skip over this step
             is there are no evo results yet. and if there are we need a clear
             input capture into Values and resources").  Stage 9 Study-Act
             triage banner — auto-detects three states and routes the planner
             explicitly.  Mounts ABOVE the existing top stage-nav row so it is
             the first thing the planner sees; the existing sub-step strip
             (lower down) stays for power-users per MOVE Principle. -->
        <div
          class="w-full max-w-2xl mb-4 rounded-2xl border-2 shadow-sm transition-colors"
          :class="stage9TriageState === 'no-evo'
            ? 'border-emerald-300 bg-emerald-50/70'
            : stage9TriageState === 'no-actuals'
              ? 'border-violet-300 bg-violet-50/70'
              : 'border-indigo-300 bg-indigo-50/70'"
          aria-label="Stage 9 Study-Act triage"
          data-stage9-triage="true"
        >
          <div class="px-5 py-4">
            <p class="text-[12px] font-bold uppercase tracking-[0.14em] mb-1.5"
               :class="stage9TriageState === 'no-evo' ? 'text-emerald-700'
                       : stage9TriageState === 'no-actuals' ? 'text-violet-700'
                       : 'text-indigo-700'">
              Stage 9 · Study-Act ·
              <template v-if="stage9TriageState === 'no-evo'">No Evo delivery yet</template>
              <template v-else-if="stage9TriageState === 'no-actuals'">Actuals not captured</template>
              <template v-else>Actuals ready for analysis</template>
            </p>
            <p class="text-[13px] text-slate-800 leading-relaxed">
              <template v-if="stage9TriageState === 'no-evo'">
                No Evo delivery yet — Study-Act needs actual measurements from a delivered cycle to compare against estimates. You can skip to Stage 10 Resources, or click on a completed Evo step first.
              </template>
              <template v-else-if="stage9TriageState === 'no-actuals'">
                <strong>{{ confirmedSteps.length }} Evo Step{{ confirmedSteps.length === 1 ? '' : 's' }} delivered</strong> — no actuals captured yet. Capture measurements into Values + Resources to enable variance analysis.
              </template>
              <template v-else>
                Actuals captured for <strong>{{ stage9ActualsCounts.v }} Value{{ stage9ActualsCounts.v === 1 ? '' : 's' }}</strong>
                / <strong>{{ stage9ActualsCounts.r }} Resource{{ stage9ActualsCounts.r === 1 ? '' : 's' }}</strong> —
                variance analysis ready. Continue to 9.2 Compare to Estimates.
              </template>
            </p>
            <div class="mt-3 flex flex-wrap items-center gap-2">
              <button
                v-if="stage9TriageState === 'no-evo'"
                type="button"
                class="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-bold text-white shadow-md
                       bg-gradient-to-r from-emerald-500 to-teal-500
                       hover:from-emerald-600 hover:to-teal-600
                       focus:outline-none focus:ring-2 focus:ring-emerald-400
                       animate-pulse"
                title="Skip Stage 9 · Study-Act has no work to do until an Evo Step delivers actual measurements. Jump to Stage 10 · Resources."
                aria-label="Skip to Stage 10 · no actuals yet"
                @click="handleStageBarNav(10)"
              >
                <span>⏭</span><span>Skip to Stage 10 · no actuals yet</span>
              </button>
              <button
                v-else-if="stage9TriageState === 'no-actuals'"
                type="button"
                class="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-bold text-white shadow-md
                       bg-gradient-to-r from-violet-500 to-indigo-500
                       hover:from-violet-600 hover:to-indigo-600
                       focus:outline-none focus:ring-2 focus:ring-violet-400
                       animate-pulse"
                title="Open the Capture Actuals panel · type measured Value + Resource numbers from the delivered Evo Step. Reversible via global Undo (⌘Z)."
                aria-label="Capture Actuals · open focused input panel"
                @click="stage9ActualsOpen = true"
              >
                <span>📥</span><span>Capture Actuals</span>
              </button>
              <button
                v-else
                type="button"
                class="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-bold text-white shadow-md
                       bg-gradient-to-r from-indigo-500 to-blue-500
                       hover:from-indigo-600 hover:to-blue-600
                       focus:outline-none focus:ring-2 focus:ring-indigo-400"
                title="Continue to 9.2 · compare captured actuals against the Goal estimates committed in Stage 4"
                aria-label="Continue to 9.2 · Compare to Estimates"
                @click="stage9ActualsOpen = true"
              >
                <span>→</span><span>9.2 · Compare to Estimates</span>
              </button>
              <!-- Additional Capture pin always visible (re-capture flow) once actuals exist. -->
              <button
                v-if="stage9TriageState === 'actuals-in'"
                type="button"
                class="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-semibold
                       border border-violet-300 bg-white text-violet-700 hover:bg-violet-50
                       focus:outline-none focus:ring-2 focus:ring-violet-400"
                title="Re-open the Capture Actuals panel to add or update measurements"
                @click="stage9ActualsOpen = true"
              >
                📥 Capture more
              </button>
            </div>
          </div>
        </div>
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
        <!-- ── Stage 11 Final-Pass cluster (r93qqq, Tom 2026-06-12) ──────
             Tom verbatim: "stage 11, there is a new category of tools to add,
             Visualize, Edit, and Recalculate Impacts, (MultiVision, Optima,
             and the other ones made recently)".
             Last chance for the planner to refine the plan before export.
             Three sub-groups (Visualize / Edit / Recalculate Impacts), each
             with the recently-shipped tools that do that activity.  All
             changes round-trip into the live Spec; the PrioritisedPlanView
             below re-renders on save. -->
        <section class="w-full max-w-3xl mb-4 p-4 rounded-xl bg-gradient-to-br from-violet-50 via-amber-50 to-emerald-50 border-2 border-violet-200 shadow-sm">
          <header class="flex items-center justify-between mb-2 flex-wrap gap-2">
            <h3 class="text-sm font-bold text-slate-800 leading-tight">
              🔧 Final Pass — Visualize, Edit, &amp; Recalculate Impacts
            </h3>
            <span class="text-[10px] text-slate-500 italic">
              All edits round-trip into the export below
            </span>
          </header>
          <p class="text-xs text-slate-600 mb-3 leading-snug">
            Reopen any tool to refine the plan one last time before exporting.  Changes are reflected automatically in the prioritised plan and every export format.
          </p>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">

            <!-- VISUALIZE -->
            <div class="bg-white rounded-lg p-2.5 border border-violet-200">
              <div class="text-[10px] uppercase tracking-wide text-violet-700 font-bold mb-1.5 flex items-center gap-1">
                <span>👁</span><span>Visualize</span>
              </div>
              <div class="flex flex-col gap-1.5">
                <button type="button" class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-semibold text-violet-800 bg-violet-50 hover:bg-violet-100 border border-violet-200 transition"
                  title="MultiVision — V/R balance slider sandbox.  Move Tolerable + Wish thumbs per Value; Goal emerges from OPTIMA balancing."
                  @click="openMultiVision()"><span>⚡</span><span>MultiVision</span></button>
                <button type="button" class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-semibold text-violet-800 bg-violet-50 hover:bg-violet-100 border border-violet-200 transition"
                  title="MultiForks — system fork diagram.  Resources → System ← Values with status colour bands."
                  @click="openMultiForks()"><MultiForksGlyph size="sm" class="shrink-0" /><span>MultiForks</span></button>
                <button type="button" class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-semibold text-violet-800 bg-violet-50 hover:bg-violet-100 border border-violet-200 transition"
                  title="Penta Model — SVERD pinwheel: Stakeholders → Values → Functions → Solutions → Resources with Cascade Ripple impact rings."
                  @click="pentaOpen = true"><span>⭐</span><span>Penta Model</span></button>
                <button type="button" class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-semibold text-violet-800 bg-violet-50 hover:bg-violet-100 border border-violet-200 transition"
                  title="Diagrams &amp; Visuals — catalog of all diagram views available for this plan."
                  @click="visualiseOpen = true"><span>🗺️</span><span>Diagrams &amp; Visuals</span></button>
                <button type="button" class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-semibold text-violet-800 bg-violet-50 hover:bg-violet-100 border border-violet-200 transition"
                  title="Swimlane / Value Stage Map — Functions / Values / Solutions across delivery stages."
                  @click="heatLaneOpen = true"><span>🏊</span><span>Swimlane</span></button>
                <button type="button" class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-semibold text-violet-800 bg-violet-50 hover:bg-violet-100 border border-violet-200 transition"
                  title="Compare Spec Models — A/B side-by-side comparison of two saved models."
                  @click="comparisonOpen = true"><span>📊</span><span>Compare Models</span></button>
                <button type="button" class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-semibold text-violet-800 bg-violet-50 hover:bg-violet-100 border border-violet-200 transition"
                  title="Present — full-screen spec presentation slides."
                  @click="presentationOpen = true"><span>🖥️</span><span>Present</span></button>
                <button type="button" class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-semibold text-violet-800 bg-violet-50 hover:bg-violet-100 border border-violet-200 transition"
                  title="Evo Simulator — animated replay of the Evo Step sequence with impact accumulation."
                  @click="evoSimulatorOpen = true"><span>▶</span><span>Evo Simulator</span></button>
                <button type="button" class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-semibold text-violet-800 bg-violet-50 hover:bg-violet-100 border border-violet-200 transition"
                  title="Plan Story — narrative arc of the spec from Stakes → Export."
                  @click="_togglePlanStory()"><span>📖</span><span>Plan Story</span></button>
              </div>
            </div>

            <!-- EDIT -->
            <div class="bg-white rounded-lg p-2.5 border border-amber-200">
              <div class="text-[10px] uppercase tracking-wide text-amber-700 font-bold mb-1.5 flex items-center gap-1">
                <span>✏️</span><span>Edit</span>
              </div>
              <div class="flex flex-col gap-1.5">
                <button type="button" class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition"
                  title="Spec Editor — edit any Value / Function / Solution / Constraint / Resource entry directly."
                  @click="_openSpecEditor()"><EditGlyph size="standard" class="shrink-0" /><span>Spec Editor</span></button>
                <button type="button" class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition"
                  title="Sharpen Spec — AI refinement across 6 dimensions: constraints, scale, stakeholders, etc."
                  @click="sharpenModalOpen = true"><span>🔪</span><span>Sharpen Spec</span></button>
                <button type="button" class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition"
                  title="⌘I — Illumination · Information · Illustrations — Planguage Glossary + 4,363 illustrations.  ⌘V into any spec field."
                  @click="openGilbIllustrations()"><span>💡</span><span>Insert Knowledge (⌘I)</span></button>
                <button type="button" class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition"
                  title="Incorruptible — defect-fix Accept flow.  Every fix records an Undo entry."
                  @click="incorruptibleOpen = true"><span>⚖️</span><span>Incorruptible</span></button>
                <button type="button" class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition"
                  title="Decision Mapper — structured decision analysis with named alternatives + criteria."
                  @click="decisionMapperOpen = true"><span>🗂️</span><span>Decision Mapper</span></button>
                <button type="button" class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition"
                  title="Stakeholder Mapper — edit stakeholder roles, needs, influence."
                  @click="stakeholderMapperOpen = true"><span>🧑‍🤝‍🧑</span><span>Stakeholder Mapper</span></button>
                <button type="button" class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition"
                  title="Strategy Agent — propose strategic shifts to the plan based on context."
                  @click="strategyAgentOpen = true"><span>♟️</span><span>Strategy Agent</span></button>
                <button type="button" class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition"
                  title="Spec Targets — set explicit Tolerable / Goal / Wish targets across all Values."
                  @click="specTargetsOpen = true"><span>🎯</span><span>Spec Targets</span></button>
                <button type="button" class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition"
                  title="Spec Owners — edit Owner / Planner / Scribe roles for the spec."
                  @click="specPeopleTab = 'owners'; specOwnerPanelOpen = true"><span>🔑</span><span>Owners &amp; Roles</span></button>
              </div>
            </div>

            <!-- RECALCULATE IMPACTS -->
            <div class="bg-white rounded-lg p-2.5 border border-emerald-200">
              <div class="text-[10px] uppercase tracking-wide text-emerald-700 font-bold mb-1.5 flex items-center gap-1">
                <span>🔄</span><span>Recalculate Impacts</span>
              </div>
              <div class="flex flex-col gap-1.5">
                <button type="button" class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition"
                  title="OPTIMA — Resource Optimization balancer.  Finds the Pareto-efficient trade-off across all Values within all Constraints."
                  @click="optimaOpen = true"><span>⚖️</span><span>OPTIMA</span></button>
                <button type="button" class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition"
                  title="Spec Health (PHI) — live Spec Health Index (-100..+100) with breakdown bars and history graph."
                  @click="specHealthStatusOpen = true"><span>🩺</span><span>Spec Health (PHI)</span></button>
                <button type="button" class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition"
                  title="Evo Health Tool (EHT) — short-term Evo Step health: defect detector + Cure proposals with risk ratings."
                  @click="evoHealthOpen = true"><span>🩺</span><span>Evo Health (EHT)</span></button>
                <button type="button" class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition"
                  title="Global Priority — recompute priority across all Wishes within all Constraints + remaining-resources."
                  @click="globalPriorityOpen = true"><span>❯</span><span>Global Priority</span></button>
                <button type="button" class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition"
                  title="Planguage Standards Auditor — cross-references spec against 10.Standard/Standard.Kai-Zen/ Templates + Rules.  Cites each violation."
                  @click="standardsAuditorOpen = true"><span>📚</span><span>Standards Auditor</span></button>
                <button type="button" class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition"
                  title="Planguage Analyzer (Unified) — Conjunction-of-Technologies: current plan + Gilb corpus + LLM + Internet, all in one analysis with source-layer badges."
                  @click="planguageAnalyzerOpen = true"><span>🔬</span><span>Planguage Analyzer</span></button>
                <button type="button" class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition"
                  title="Conflict Analysis — detect Value/Resource/Constraint conflicts in the spec."
                  @click="conflictAnalysisOpen = true"><span>⚠️</span><span>Conflict Analysis</span></button>
                <button type="button" class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition"
                  title="Internet Context Fetcher — pull current industry benchmarks + stakeholder context from the web to inform impact calculations."
                  @click="internetContextOpen = true"><span>🌐</span><span>Internet Context</span></button>
                <button type="button" class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition"
                  title="Cascade Ripple — show downstream impacts of pending edits before they are applied."
                  @click="pentaOpen = true"><span>💧</span><span>Cascade Ripple (in Penta)</span></button>
              </div>
            </div>
          </div>
        </section>

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
      <!-- r41 v146 — legacy floating wrapper kept ONLY for the Rename
           popover; ProcessToolsStrip mount moved to the Spec Crest wrapper.
           v-if condition restricted to ONLY renamePopoverOpen (was also
           handling !specModel which is now obsolete). -->
      <div
        v-if="view === 'app' && renamePopoverOpen && !comparisonOpen && !specInputOpen && !modelsOpen && !wizardOpen && !historyOpen && !specEditorOpen"
        class="fixed z-[9999] flex flex-col items-end gap-2 top-[200px] right-4"
      >

      <!-- ── PRE-SPEC pin cluster — r41 v114 (Tom Gilb 2026-06-17 verbatim
           "no change at all, and did you bring the 4 pins at top (sos etc)
           into this?").  v113 reorganized the POST-spec right-pin cluster
           in the Plan Crest (line 6896-7110ish), but Tom was on the empty
           entry form where `specModel === null` so the Plan Crest doesn't
           render — meaning v113 was invisible.  v114 ports the SAME
           two-group consistent-pattern design to the pre-spec cluster
           HERE so the redesign actually shows.  Two groups, each h-10
           uniform, glyph + text label.
           GROUP B · CONTROLS: 🔍 Find · 💡 Illuminate · ⚙ Settings · 🆘 SOS
              (no Undo / Redo pre-spec because there's no spec to undo)
           GROUP D · TOOLS: 🎤 Mic · 🔊 Speaker · ⚡ Actions ⌘A
              (Mic + Speaker stay here because they're accessibility-critical
              per Tom 2026-05-13; they fold into Actions menu only via search) -->
      <!-- r41 v141 — Level 1 · Process Tools (pre-spec variant: shows
           Find · Search Term · Settings · SOS + Mic · Speaker · Actions).
           No Undo/Redo (nothing to undo yet); Mic + Speaker accessibility-
           critical per Tom 2026-05-13.  Wrapped in non-absolute container
           since this version inherits parent positioning. -->
      <!-- r41 v146 — duplicate pre-spec ProcessToolsStrip mount REMOVED.
           The single Process Tools mount now lives in the Spec Crest wrapper
           (line ~6940) with `:variant="specModel ? 'post-spec' : 'pre-spec'"`
           so it renders correctly in BOTH states from one location. -->

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

    <!-- 📬 Universal Export Email Banner — unmissable ⌘V instruction that appears
         whenever ANY exportEmail() call fires (Stage 7, IET tables, Spec Output, etc.).
         Shared singleton via useExportBanner — one banner for the whole app.
         z-[10050] sits above all panels (below SelectionDefiner z-[10100]).
         Tom 2026-06-06: "this design applies for all export in sem." -->
    <Transition
      enter-active-class="transition-all duration-300 ease-out"
      enter-from-class="-translate-y-full opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition-all duration-200 ease-in"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="-translate-y-full opacity-0"
    >
      <div
        v-if="exportBannerVisible"
        class="fixed top-0 left-0 right-0 z-[10050] flex items-center gap-4 px-6 py-4 shadow-2xl"
        style="background: linear-gradient(135deg, #7c3aed 0%, #059669 100%)"
        role="status"
        aria-live="assertive"
      >
        <EmailGlyph size="standard" class="shrink-0 text-white" />
        <div class="flex-1 min-w-0">
          <p class="text-white text-lg font-black leading-tight tracking-tight">
            Mail is opening — press <kbd class="bg-white/20 text-white rounded px-2 py-0.5 font-mono text-base">⌘V</kbd> in the Mail body to paste the colourful HTML
          </p>
          <p class="text-white/80 text-sm mt-0.5">
            {{ exportBannerLabel }} is on your clipboard · Tom@Gilb.com · auto-dismisses in 25 s
          </p>
        </div>
        <!-- CloseDot rule — never ✕ on any dismiss/close affordance -->
        <CloseDot
          variant="on-dark"
          size="md"
          aria-label="Dismiss email instruction"
          @click="hideExportEmailBanner()"
        />
      </div>
    </Transition>

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
         needed since the pin sits at z-[60].

         r41 v274 (Tom Gilb 2026-06-22 — SEVENTH "bottom collision" report this
         session, after I mis-targeted fixes v272/v273): the REAL collision is
         this pin overlapping the Parse-my-input sticky button band (SEMEntryForm
         line 2909, fixed inset-x-0 bottom-4 z-30 bg-indigo-600).  Both widgets
         are fixed-bottom; pin z-100 floats ON TOP of the indigo Parse band,
         hiding the "Parse my input" text and bleeding the indigo bg around the
         pin.  Two fixed-bottom widgets in the same Y-coord with no z-coordination.
         Fix: pass :suppress when the Parse band is showing (view==='app' AND
         planningStage===1 AND !currentSpec — same condition that mounts the
         Parse band per showStickyBars).  Composes with: v272 layout-reservation
         lesson + v273 layout-slot lesson — third application of the same
         "fixed-bottom widgets need coordination" rule.  Feature-smoke invariant
         `page-scroll-pin-suppressed-when-parse-band-visible` prevents regression. -->
    <PageScrollPin :suppress="view === 'app' && planningStage === 1 && !currentSpec" />

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
          aria-label="Past Versions drawer"
        >
          <!-- Header -->
          <div class="flex items-center justify-between px-4 border-b border-gray-100 min-h-[56px]">
            <h2 class="text-sm font-semibold text-gray-900">Past Versions</h2>
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
              aria-label="Close Past Versions drawer"
              title="Close Past Versions  [->"
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

    <!-- r41 v365 (Tom Gilb 2026-06-25 "remove what is not in use") — Feature
         #53 SpecWizard Teleport mount REMOVED.  All 5 trigger sites swept
         (Start with your goal pill + 3× Guided buttons + Actions catalog
         entry + @wizard event listener).  Component file SpecWizard.vue
         retained for any tests that import it; dead code in the app shell. -->

    <!-- r41 v352 — Stage 2.2 Planguage Progress Window modal.  Visible
         while `runStage22GenerateSolutions` is in flight + for ~3s after
         completion so the final count is registered.  Tom Gilb 2026-06-25
         *"Name = Planguage Progress window"*. -->
    <Teleport to="body">
      <div
        v-if="stage22ProgressWindowOpen"
        class="fixed inset-0 z-[700] flex items-center justify-center bg-black/40 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stage22-progress-heading"
      >
        <div class="w-[420px] max-w-[92vw] bg-white rounded-2xl shadow-2xl overflow-hidden border-2 border-orange-300">
          <div class="px-5 py-3 bg-gradient-to-r from-orange-100 via-amber-100 to-orange-100 border-b border-orange-200">
            <h2 id="stage22-progress-heading" class="text-sm font-extrabold text-orange-900">
              Stage 2.2 — Generating Solutions
            </h2>
            <p class="text-[11px] text-orange-700 mt-0.5">
              {{ _genSolutions.isGenerating.value
                  ? `Drafting ${_genSolutions.unaddressedCount.value} Solution${_genSolutions.unaddressedCount.value === 1 ? '' : 's'} for unaddressed Value${_genSolutions.unaddressedCount.value === 1 ? '' : 's'}… (${_genSolutions.elapsed.value}s)`
                  : `Generated ${_genSolutions.lastGeneratedCount.value} Solution${_genSolutions.lastGeneratedCount.value === 1 ? '' : 's'} — window closes shortly.` }}
            </p>
          </div>
          <div class="p-3">
            <PlanguageProgressWindow
              :spec="currentSpec"
              :loading="_genSolutions.isGenerating.value"
              :loading-elapsed="_genSolutions.elapsed.value"
              schedule="solutions-only"
              header-text="Stage 2.2 · Solutions Being Generated"
              caption="Solutions count ticks up when generation completes · other tile counts remain unchanged (untouched by Stage 2.2)"
            />
          </div>
        </div>
      </div>
    </Teleport>

    <!-- r41 v373 — Stage 3.3 Add Qualifiers Flow modal. -->
    <AddQualifiersFlow
      :open="addQualifiersFlowOpen"
      :spec="currentSpec"
      @apply="onAddQualifiersApply"
      @close="addQualifiersFlowOpen = false"
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
      :plan-name="specModel?.name ?? ''"
      :plan-owner="_specOwnerNames().join(', ')"
      :plan-version="specModel?.version ? `v${specModel.version}` : ''"
      :generated-at="(currentSpec as { generatedAt?: string } | null)?.generatedAt ?? ''"
      @close="resourcesSharpenOpen = false"
      @apply-analysis="_onResourcesAnalysisApplied"
      @select-history="handleStrategyAgentHistoryPick"
      @open-resources-agent="resourcesAgentOpen = true"
    />

    <!-- v509 — ESTIMATION 8: Resources Agent.  Specialised full-screen hub
         for the 5-resource subsystem: Overview + Time-Series + Extrapolation +
         Standards + Contract/RFP References + Settings + Sharpening entry.
         Tom Gilb 2026-07-21: "specialized Agent called 'Resources' ..." -->
    <ResourcesAgent
      :open="resourcesAgentOpen"
      :plan-id-ref="_resourcesAgentPlanIdRef"
      @close="resourcesAgentOpen = false"
      @open-sharpening="(r) => { /* v513: Agent now opens the SharpeningDialog internally per resource; this emit stays for back-compat but is not fired by default */ }"
    />

    <!-- r41 v295 (Tom Gilb 2026-06-22 "always continue · research and innovation").
         Stage 9 · Study-Act Capture Actuals focused modal.  Mounted via the
         triage banner state-2 ("Capture Actuals") action pin.  Apply event
         routes through onStage9ActualsApply which records Undo BEFORE mutation
         (Universal Undo SUPREME), persists via saveSpecSnapshot (No-Silent-
         Data-Loss SUPREME), and notifies via showToast (banned-word "toast"
         replaced by "notification" in the UI text). -->
    <Stage9ActualsPanel
      :open="stage9ActualsOpen"
      :spec="currentSpec"
      :confirmed-steps="confirmedSteps"
      :plan-id="currentSpec?.name ?? 'default'"
      @close="stage9ActualsOpen = false"
      @apply="onStage9ActualsApply"
      @estimations-updated="(count) => showToast(`✅ ${count} resource estimation${count === 1 ? '' : 's'} recorded from Evo Step actuals (IBM Cleanroom auto-trigger; see Stage 10 Resources)`, 'success')"
    />

    <!-- Stage 10 · OPTIMA Resource Optimization — VDT sliders + threshold visualization
         Based on Optima book (Tom Gilb 2024: "Balancing Critical Values").
         Adjusting a resource slider propagates impact to all Value entries;
         top-3 impacted vibrate, violations shake red. -->
    <ResourceOptimaPanel
      v-if="view === 'app' && optimaOpen"
      :spec="currentSpec"
      :vc-ratios="capturedVCRatios"
      :planning-stage="planningStage"
      :spec-presence="{
        spec:            !!currentSpec,
        stakeholders:    (currentSpec?.stakeholders?.length ?? 0) > 0,
        values:          (currentSpec?.values?.length ?? 0) > 0,
        functions:       (currentSpec?.functions?.length ?? 0) > 0,
        solutions:       (currentSpec?.solutions?.length ?? 0) > 0,
        resources:       (currentSpec?.resources?.length ?? 0) > 0,
      }"
      :stage2-sub-step="stage2SubStep"
      :stage2-done-steps="stage2DoneSteps"
      :has-plan="!!_evoPlan"
      @close="optimaOpen = false"
      @navigate-stage="(n) => { optimaOpen = false; handleStageBarNav(n) }"
      @open-agent="(agentId) => { optimaOpen = false; _openAgentFromEditor(agentId) }"
      @go-stage2-substep="(target) => { optimaOpen = false; onStage2SubStepGo(target) }"
      @continue-stage2="() => { optimaOpen = false; onStage2ContinueToStage3() }"
    />

    <!-- Auto-DBO — Design By Objectives
         Tom Gilb 2026-06-07: "I want to create a new tool, which is specialised
         in Design, finding Solutions. The designs will not immediately be adopted
         in the Master Planguage specs. They must be approved and saved."
         Named after Lech Krzanik's Apple II Forth tool, circa 1978. -->
    <AutoDboPanel
      :open="view === 'app' && autoDboOpen"
      :master-spec="currentSpec"
      @close="autoDboOpen = false"
      @approve-to-master="onAutoDboApproveToMaster"
      @save-as-new-plan="onAutoDboSaveAsNewPlan"
    />

    <!-- Penta Model — Gilb-Shalloway 2022 SVERD (sword) sharpening framework + PentaOptima command engine.
         5-sector: Stakeholders · Values · Efficiency · Resources · Design.
         PentaOptima: Claude-Code-as-AI-Layer pattern — builds Claudian prompts, never calls API. -->
    <PentaPanel
      :open="view === 'app' && pentaOpen"
      :spec="currentSpec ?? specModel?.spec ?? null"
      :evo-steps="confirmedSteps"
      :tasks-by-step="tasksByStep"
      :planning-stage="planningStage"
      :spec-presence="{
        spec:            !!currentSpec,
        stakeholders:    (currentSpec?.stakeholders?.length ?? 0) > 0,
        values:          (currentSpec?.values?.length ?? 0) > 0,
        functions:       (currentSpec?.functions?.length ?? 0) > 0,
        solutions:       (currentSpec?.solutions?.length ?? 0) > 0,
        resources:       (currentSpec?.resources?.length ?? 0) > 0,
      }"
      :stage2-sub-step="stage2SubStep"
      :stage2-done-steps="stage2DoneSteps"
      :has-plan="!!_evoPlan"
      @close="pentaOpen = false"
      @update-spec="onPentaUpdateSpec"
      @open-value-aspects="onOpenValueAspects"
      @navigate-stage="(n) => { pentaOpen = false; handleStageBarNav(n) }"
      @open-agent="(agentId) => { pentaOpen = false; _openAgentFromEditor(agentId) }"
      @go-stage2-substep="(target) => { pentaOpen = false; onStage2SubStepGo(target) }"
      @continue-stage2="() => { pentaOpen = false; onStage2ContinueToStage3() }"
    /><!-- r41 v39 — Tom Gilb 2026-06-15 "penta did not catch the planguage stuff"
         — PentaPanel was receiving null when currentSpec was empty but specModel
         had the real generated spec (MultiForks read from specModel directly via
         useMultiVision composable, so it showed the rich UK Ship Contract data
         while Penta showed nothing).  Falling back to specModel.spec keeps
         Penta in sync with the actually-persisted spec. -->

    <!-- r93qq — Value Aspects Articulation Tool (Tom Gilb 2026-06-11 22:45 CET) -->
    <ValueAspectsPanel
      v-if="valueAspectsOpen && valueAspectsTarget"
      :parent-value-id="valueAspectsTarget.id"
      :parent-value-name="valueAspectsTarget.label"
      :parent-scale="String((valueAspectsTarget as { scale?: unknown }).scale ?? '')"
      :parent-tolerable="String((valueAspectsTarget as { tolerable?: unknown }).tolerable ?? '')"
      :parent-goal="String((valueAspectsTarget as { goal?: unknown }).goal ?? '')"
      :parent-wish="String((valueAspectsTarget as { wish?: unknown }).wish ?? '')"
      @close="valueAspectsOpen = false; valueAspectsTarget = null"
      @apply-aspects="onApplyValueAspects"
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
      :plan-name="specModel?.name"
      :plan-version="specModel ? `v${specModel.version}` : undefined"
      :plan-owner="_specOwnerNames().join(', ')"
      :generated-at="(currentSpec as { generatedAt?: string } | null)?.generatedAt ?? ''"
      @sharpened="onSpecSharpened"
      @done="handleSharpenModalDone"
      @open-visualise="handleSharpenModalDone(); visualiseOpen = true"
      @open-global-priority="handleSharpenModalDone(); globalPriorityOpen = true"
      @open-priority-info="handleSharpenModalDone(); priorityInfoOpen = true"
      @select-history="handleStrategyAgentHistoryPick"
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

    <!-- Planguage Tools catalogue — Tom Gilb 2026-06-07: pre-Evo-Step-derivation
         design and analysis tools (CE Design chapter). Peer of EvoToolsPanel. -->
    <PlanguageToolsPanel
      v-if="planguageToolsOpen"
      @close="planguageToolsOpen = false"
      @tool-activated="onPlanguageToolActivated"
      @export-catalog="exportPlanguageToolsCatalog"
    />

    <!-- Solution Sharpening Interview — Tom 2026-06-08 Stage 5 dedicated tool.
         26 themes × 2 questions × 3 AI suggestions (52 Q, 156 suggestions).
         Output: new S. entries, improved S. entries, new V. requirements.
         Replaces the generic SharpenPanel in Stage 5 Refine Solutions.
         Data: src/data/solutionSharpInterview.ts. -->
    <SolutionSharpenPanel
      v-if="solutionSharpenOpen && currentSpec"
      :spec="currentSpec"
      :plan-id="specModel?.name ?? 'default'"
      @close="solutionSharpenOpen = false"
      @sharpen-complete="solutionSharpenOpen = false"
    />

    <!-- Strategy Agent — Strategy Sharpening (Tom 2026-06-09)
         10 dimensions: Value Traceability, Impact Quantification, Constraint Compliance,
         Goal Coverage, Resource Feasibility, Solution Specificity, Redundancy Detection,
         Dependency Ordering, Past Sharpening Patterns, Strategy Completeness.
         Available from Solutions stage (planningStage 5) AND Sharpening stage (planningStage 3).
         Works regardless of Strategy Mode (by design). -->
    <StrategyAgentPanel
      v-if="strategyAgentOpen"
      :open="strategyAgentOpen"
      :spec="currentSpec"
      :sharpen-rounds="sharpenRounds"
      :plan-name="specModel?.name ?? ''"
      :plan-version="specModel?.version ? `v${specModel.version}` : ''"
      :plan-owner="_specOwnerNames().join(', ')"
      :generated-at="(currentSpec as { generatedAt?: string } | null)?.generatedAt ?? ''"
      @close="strategyAgentOpen = false"
      @apply-improvements="applyStrategyImprovements"
      @select-history="handleStrategyAgentHistoryPick"
    />

    <!-- Incorruptible Agent — Eric Ries 2026 strategic-resilience check (Tom 2026-06-11 r93p).
         Six categories: Quarterly Tyranny / Stakeholder Monoculture / Mission Drift /
         Founder-Vision Erosion / Innovation-Budget Predation / Governance Hole.
         Phase 1 = deterministic engine; Phase 2 will stamp Ries-book citations later. -->
    <IncorruptiblePanel
      v-if="incorruptibleOpen"
      :spec="incorruptibleTargetSpec ?? currentSpec"
      :plan-title="incorruptibleTargetTitle || specModel?.name || 'Untitled Plan'"
      :is-model="incorruptibleIsModel"
      :accepted-finding-ids="incorruptibleAcceptedIds"
      :plan-owner="_specOwnerNames().join(', ')"
      :plan-version="specModel?.version ? `v${specModel.version}` : ''"
      :generated-at="(currentSpec as { generatedAt?: string } | null)?.generatedAt ?? ''"
      @close="incorruptibleOpen = false; incorruptibleTargetSpec = null; incorruptibleTargetTitle = ''; incorruptibleIsModel = false; incorruptibleAcceptedIds = new Set(); _incorruptibleUndoSnapshots = new Map()"
      @open-agents="incorruptibleOpen = false; incorruptibleTargetSpec = null; incorruptibleTargetTitle = ''; incorruptibleIsModel = false; incorruptibleAcceptedIds = new Set(); _incorruptibleUndoSnapshots = new Map(); agentMenuOpen = true"
      @open-sharpening="incorruptibleOpen = false; incorruptibleSharpeningOpen = true"
      @accept-fix="onIncorruptibleAcceptFix"
      @undo-fix="onIncorruptibleUndoFix"
      @select-history="handleStrategyAgentHistoryPick"
      @confirm-and-view="handleIncorruptibleConfirmAndView"
    />

    <!-- r93aa — Incorruptible Sharpening panel (Q&A flow).
         Tom Gilb 2026-06-11: "Incorruptible Sharpening: is name of the tool within the agent
         and available outside" — three access paths wired:
         (a) Inside the Agent header (IncorruptiblePanel emits 'open-sharpening')
         (b) Agents Menu standalone tile (select-agent 'incorruptible-sharpen')
         (c) Model Library per-model action button (select-agent 'incorruptible-sharpen-model'). -->
    <IncorruptibleSharpeningPanel
      v-if="incorruptibleSharpeningOpen"
      :spec="incorruptibleTargetSpec ?? currentSpec"
      :plan-title="incorruptibleTargetTitle || specModel?.name || 'Untitled Plan'"
      :is-model="incorruptibleIsModel"
      @close="incorruptibleSharpeningOpen = false"
      @synthesise-findings="onIncorruptibleSynthesiseFindings"
    />

    <!-- Elon Agent — Musk's Methods + Dove et al. Pace-of-Innovation paper.
         Tom Gilb 2026-06-12: "OK Major new Agent: 'Elon': will be based on my Musks Methods
         book... The pattern is Incorruptible (based on Ries). Just make it." 9 categories with
         Pace-of-Innovation DOMINANT per Dove et al. Mirrors Incorruptible plumbing 1:1. -->
    <ElonPanel
      v-if="elonOpen"
      :spec="elonTargetSpec ?? currentSpec"
      :plan-title="elonTargetTitle || specModel?.name || 'Untitled Plan'"
      :is-model="elonIsModel"
      :accepted-finding-ids="elonAcceptedIds"
      :plan-owner="_specOwnerNames().join(', ')"
      :plan-version="specModel?.version ? `v${specModel.version}` : ''"
      :generated-at="(currentSpec as { generatedAt?: string } | null)?.generatedAt ?? ''"
      @close="elonOpen = false; elonTargetSpec = null; elonTargetTitle = ''; elonIsModel = false; elonAcceptedIds = new Set(); _elonUndoSnapshots = new Map()"
      @open-agents="elonOpen = false; elonTargetSpec = null; elonTargetTitle = ''; elonIsModel = false; elonAcceptedIds = new Set(); _elonUndoSnapshots = new Map(); agentMenuOpen = true"
      @open-sharpening="elonOpen = false; elonSharpeningOpen = true"
      @accept-fix="onElonAcceptFix"
      @undo-fix="onElonUndoFix"
      @select-history="handleStrategyAgentHistoryPick"
      @confirm-and-view="handleElonConfirmAndView"
    />

    <!-- ── Munger Agent panel (r41 v225, Tom Gilb 2026-06-20) ──────────────
         Charlie Munger's 12 analytical prompts (Inversion → Deathbed) run as
         a deterministic rule engine over the spec.  Mirrors the Elon /
         Incorruptible pattern: panel + accept-fix + dismiss + score. -->
    <MungerPanel
      v-if="mungerOpen"
      :spec="currentSpec"
      :plan-title="specModel?.name || 'Untitled Plan'"
      @close="mungerOpen = false"
      @accept-fix="onMungerAcceptFix"
      @confirm-and-view="handleMungerConfirmAndView"
    />

    <!-- ── Feynman Agent panel (r41 v385, Tom Gilb 2026-06-26) ─────────────
         "now I want a Feynman Agent. See folder in assets and seach internet.
          How would Richard evaluate a plan?" — 6 lenses, deterministic detector
         engine over the spec.  Mirrors Munger / Heilmeier pattern.  Sources:
         Tom-dropped 10-prompts PDF (Louis Gleeson @aigleeson) + Feynman 1974
         Cargo Cult Science + Feynman 1986 Challenger Appendix F + Feynman
         blackboard "What I cannot create, I do not understand" (1988). -->
    <FeynmanPanel
      v-if="feynmanOpen"
      :spec="currentSpec"
      :plan-title="specModel?.name || 'Untitled Plan'"
      @close="feynmanOpen = false"
      @accept-fix="onFeynmanAcceptFix"
      @confirm-and-view="handleFeynmanConfirmAndView"
    />

    <!-- ── Heilmeier Agent panel (r41 v254, Tom Gilb 2026-06-22) ────────────
         DARPA's 9-question Catechism (Heilmeier 1965-1977) + IEEE 2025
         "Who is left out?" extension (Butler/Kohno et al.), mapped to
         Planguage per Tom's comparison PDF.  Mirrors the Munger pattern:
         panel + accept-fix + dismiss + Clarity Score. -->
    <HeilmeierPanel
      v-if="heilmeierOpen"
      :spec="currentSpec"
      :plan-title="specModel?.name || 'Untitled Plan'"
      @close="heilmeierOpen = false"
      @accept-fix="onHeilmeierAcceptFix"
      @confirm-and-view="handleHeilmeierConfirmAndView"
    />

    <!-- Role Agent panel (r41 v305, Tom Gilb 2026-06-23 MAJOR REDESIGN
         "PLEASE DO A MAJOR REDESIGN TO FOCUS ON ROLES AND RESPONSIBILITY").
         13 detectors · Role IS Stakeholder (Tom #8/9) · Musk principle (#14).
         Mirrors the Heilmeier panel pattern: panel + accept-fix + dismiss
         + Compliance Score. -->
    <RoleAgentPanel
      v-if="roleAgentOpen"
      :spec="currentSpec"
      :plan-title="specModel?.name || 'Untitled Plan'"
      @close="roleAgentOpen = false"
      @accept-fix="onRoleAcceptFix"
      @confirm-and-view="handleRoleAgentConfirmAndView"
    />

    <!-- Role Health Dashboard (r41 v312, Tom Gilb 2026-06-23 Phase 2 of
         Roles redesign: per-Stakeholder Health Score + RACI Matrix + PHI
         roll-up). Opens from the Cmd-Shift-H shortcut OR from any in-canvas
         affordance that exposes Plan Health for the Role lineage. -->
    <RoleHealthDashboard
      v-if="roleHealthOpen"
      :spec="currentSpec"
      :evo-steps="confirmedSteps"
      :plan-title="specModel?.name || 'Untitled Plan'"
      @close="roleHealthOpen = false"
    />

    <!-- Role Flow Diagram (r41 v313, Tom Gilb 2026-06-23 Phase 3 of Roles
         redesign; 14-point spec #10 "We should be able to generate a Role
         diagram with all stakeholders, and how they relate to all
         Planguage specs"). Opens from ⌘⇧R. Click a node to open the
         matching Spec Editor tab. -->
    <RoleFlowDiagram
      v-if="roleFlowOpen"
      :spec="currentSpec"
      :evo-steps="confirmedSteps"
      :plan-title="specModel?.name || 'Untitled Plan'"
      @close="roleFlowOpen = false"
      @open-editor="onRoleFlowOpenEditor"
    />

    <!-- Role Routing & Placeholder Resolver (r41 v314, Tom Gilb 2026-06-23
         Phase 4 FINAL of Roles redesign; 14-point #14 + Tom 10-point Roles
         framework #5 + #8). Opens from ⌘⇧X. Applies routing rules + promotes
         placeholders via Universal Undo SUPREME. -->
    <RoleRoutingRulesPanel
      v-if="roleRoutingOpen"
      :spec="currentSpec"
      :plan-title="specModel?.name || 'Untitled Plan'"
      @close="roleRoutingOpen = false"
      @apply-routing="onApplyRoleRouting"
      @promote-placeholder="onPromoteRolePlaceholder"
    />

    <!-- ── Agent Mode Picker (r41 v231, Tom Gilb 2026-06-20) ───────────────
         One pin per agent in the AgentsStrip; clicking opens this picker;
         the planner picks Principles / Analysis / Improvement / Sharpening
         Q&A / Create Optional Version, and the picker dispatches to the
         existing panel/handler.  Replaces the pair-of-pins (e.g. Elon +
         Elon Sharp) pattern with a single pin + mode selector. -->
    <AgentModePicker
      v-if="modePickerOpen && modePickerAgentId"
      :agent-id="modePickerAgentId"
      @close="modePickerOpen = false"
      @select-mode="onModeSelect"
    />

    <!-- Elon Sharpening panel (Q&A flow) — three access paths:
         (a) Inside the Agent header (ElonPanel emits 'open-sharpening')
         (b) Agents Menu standalone tile (select-agent 'elon-sharpen')
         (c) Model Library per-model action button (select-agent 'elon-sharpen-model') -->
    <ElonSharpeningPanel
      v-if="elonSharpeningOpen"
      :spec="elonTargetSpec ?? currentSpec"
      :plan-title="elonTargetTitle || specModel?.name || 'Untitled Plan'"
      :is-model="elonIsModel"
      @close="elonSharpeningOpen = false"
      @synthesise-findings="onElonSynthesiseFindings"
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
    <!-- r41 v112 — Pre-spec Stewards manager modal.  Lets the planner add
         Owners / Planners / Scribes BEFORE the first generation.  The list
         is persisted to localStorage + applied to the Plan Model at the
         first successful translate() in doTranslate (see line ~4218).
         Composes with: No-Silent-Removal SUPREME (the post-spec Plan Crest
         Stewards chips are gated on specModel — this modal restores the
         capability for the pre-spec phase), Universal Undo (additions go
         through standard add/remove which compose with the Plan Crest's
         existing undo wiring once the spec is generated), accessibility_tom.md
         (high-contrast modal, large hit targets, plain English labels). -->
    <Teleport v-if="preSpecStewardsOpen" to="body">
      <div
        class="fixed inset-0 z-[610] bg-black/40 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Pre-spec Stewards manager"
        @click.self="preSpecStewardsOpen = false"
      >
        <div class="w-full max-w-lg rounded-2xl bg-white shadow-2xl border-2 border-amber-300 overflow-hidden">
          <!-- Header -->
          <div class="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-amber-600 to-orange-500 text-white">
            <span class="text-xl" aria-hidden="true">👥</span>
            <div class="flex-1 min-w-0">
              <h2 class="text-base font-extrabold leading-tight">Stewards · Pre-spec</h2>
              <p class="text-[11px] text-amber-100 leading-tight">Add Owners, Planners, Scribes before generation. Persist across reload.</p>
            </div>
            <CloseDot variant="on-dark" size="lg" aria-label="Close Stewards manager" @click="preSpecStewardsOpen = false" />
          </div>
          <!-- Body -->
          <ScrollContainer outer-class="max-h-[60vh]" inner-class="px-5 py-4 space-y-4">
            <!-- Existing stewards list -->
            <div v-if="preSpecStewards.length > 0" class="space-y-2">
              <p class="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Current stewards ({{ preSpecStewards.length }})</p>
              <div
                v-for="(s, i) in preSpecStewards"
                :key="i"
                class="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-200 bg-amber-50"
              >
                <span
                  class="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide"
                  :class="s.role === 'Owner' ? 'bg-amber-200 text-amber-900' : s.role === 'Planner' ? 'bg-yellow-200 text-yellow-900' : 'bg-slate-200 text-slate-800'"
                  :title="s.role === 'Owner' ? '🔑 Owner — primary accountability' : s.role === 'Planner' ? '💡 Planner — authoring the spec' : '⌨️ Scribe — typing it into SEM'"
                >
                  <span aria-hidden="true">{{ s.role === 'Owner' ? '🔑' : s.role === 'Planner' ? '💡' : '⌨️' }}</span>
                  <span>{{ s.role }}</span>
                </span>
                <span class="flex-1 text-sm font-medium text-slate-800 truncate">{{ s.name }}</span>
                <button
                  type="button"
                  class="shrink-0 h-7 w-7 rounded-full text-amber-700 hover:bg-amber-200 transition-colors text-base"
                  :aria-label="`Remove ${s.name} (${s.role})`"
                  :title="`Remove ${s.name} (${s.role})`"
                  @click="removePreSpecSteward(i)"
                >×</button>
              </div>
            </div>
            <p v-else class="text-sm text-slate-500 italic px-1">
              No stewards added yet. Use the form below to add Owners, Planners, or Scribes.
            </p>
            <!-- Add form -->
            <div class="space-y-2 pt-3 border-t border-amber-200">
              <p class="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Add a steward</p>
              <div class="flex flex-wrap gap-2 items-center">
                <select
                  v-model="preSpecStewardDraft.role"
                  class="h-9 px-2 rounded-lg border border-amber-300 text-sm font-semibold text-amber-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                  aria-label="Role"
                >
                  <option value="Owner">🔑 Owner</option>
                  <option value="Planner">💡 Planner</option>
                  <option value="Scribe">⌨️ Scribe</option>
                </select>
                <input
                  v-model="preSpecStewardDraft.name"
                  type="text"
                  placeholder="Name (e.g. Tom Gilb)"
                  class="flex-1 min-w-[200px] h-9 px-3 rounded-lg border border-amber-300 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  aria-label="Steward name"
                  @keydown.enter="addPreSpecSteward"
                />
                <button
                  type="button"
                  class="h-9 px-4 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold transition-colors disabled:bg-amber-300 disabled:cursor-not-allowed"
                  :disabled="!preSpecStewardDraft.name.trim()"
                  title="Add this steward"
                  @click="addPreSpecSteward"
                >＋ Add</button>
              </div>
              <p class="text-[10px] text-slate-500 italic">
                Roles: 🔑 Owner = primary accountability · 💡 Planner = authoring the spec · ⌨️ Scribe = typing it into SEM.
                Multiple of each role allowed.
              </p>
            </div>
            <!-- Explanation -->
            <div class="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-[11px] text-indigo-900 leading-relaxed">
              <p class="font-semibold">What happens to these stewards?</p>
              <p class="mt-1">
                They're saved in your browser. When you press <strong>Parse my input</strong> on the form,
                the spec is generated AND every steward you added here is registered on the new Plan Model.
                The Plan Crest's 🔑 / 💡 / ⌨️ chips will reflect them immediately.
              </p>
            </div>
          </ScrollContainer>
          <!-- Footer -->
          <div class="flex items-center gap-2 px-5 py-3 border-t border-amber-200 bg-amber-50">
            <span class="text-[11px] text-slate-500">{{ preSpecStewards.length }} {{ preSpecStewards.length === 1 ? 'steward' : 'stewards' }} pending</span>
            <button
              type="button"
              class="ml-auto h-9 px-4 rounded-lg bg-white border border-amber-300 text-amber-700 text-sm font-bold hover:bg-amber-100 transition-colors"
              title="Close Stewards manager — additions are saved automatically"
              @click="preSpecStewardsOpen = false"
            >Done</button>
          </div>
        </div>
      </div>
    </Teleport>

    <SettingsPanel
      v-if="settingsOpen"
      @close="settingsOpen = false"
      @activate-contract-agent="() => {
        // r41 v48 — Tom Gilb 2026-06-16 verbatim 'IN CONTRACT MODE, THE
        // CONTRACT AGENT IS ACTIVATED'.  Close Settings, open ContractHub.
        // The active 4-axis Contracts Mode config is read inside the parser
        // automatically (no payload needed here).
        settingsOpen = false
        contractsOpen = true
      }"
    />

    <!-- r41 v335 — Diagnostics Panel: in-app console-error capture surface.
         Replaces "open Safari Web Inspector" for the PWA window. -->
    <DiagnosticsPanel
      :open="diagnosticsOpen"
      @close="diagnosticsOpen = false"
    />

    <!-- r41 v335 — Diagnostics floating button.  Top-right of viewport per the
         Control-Pins-at-Top SUPREME rule.  Fixed position so always available
         even during long scrolls / panels open / etc.  Red badge with error
         count when there are uncaught errors; subdued grey when zero. -->
    <button
      type="button"
      class="fixed top-2 right-2 z-[300] flex items-center gap-1.5 px-2.5 py-1.5 rounded-full
             text-xs font-semibold shadow-lg ring-1
             focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 transition-colors"
      :class="diagnosticsErrorCount > 0
        ? 'bg-rose-100 text-rose-900 ring-rose-300 hover:bg-rose-200 animate-pulse'
        : 'bg-slate-100/80 text-slate-600 ring-slate-300/60 hover:bg-slate-200'"
      :title="diagnosticsErrorCount === 0
        ? 'Diagnostics — no errors captured this session. Click to view the panel.'
        : `Diagnostics — ${diagnosticsErrorCount} error${diagnosticsErrorCount === 1 ? '' : 's'} captured this session. Click to view + dismiss.`"
      :aria-label="`Open Diagnostics panel (${diagnosticsErrorCount} captured ${diagnosticsErrorCount === 1 ? 'error' : 'errors'})`"
      @click="diagnosticsOpen = true"
    >
      <span aria-hidden="true">🔍</span>
      <span class="font-mono">{{ diagnosticsErrorCount }}</span>
    </button>

    <!-- r41 v49 (Tom Gilb 2026-06-16) — Top-level Mode pin popover + governance dialog. -->
    <ActiveModePopover
      :open="activeModePopoverOpen"
      @close="activeModePopoverOpen = false"
      @open-settings="(sectionId) => {
        activeModePopoverOpen = false
        settingsOpen = true
        // SettingsPanel opens on its last-used section; planner clicks the
        // section in the side nav.  (Deep-link via prop is a future enhancement.)
        void sectionId
      }"
      @request-switch="_onModeSwitchRequest"
    />
    <ModeSwitchGovernanceDialog
      :open="modeSwitchGovOpen"
      @cancel="_onModeSwitchCancel"
      @resolve="_onModeSwitchResolve"
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
      @apply-proposal="(updated) => {
        if (currentSpec) {
          undoHistory.record({
            label:    'Spec Collaborator Proposal Applied',
            source:   'SpecCollaborator',
            prevSpec: JSON.parse(JSON.stringify(currentSpec)),
            nextSpec: JSON.parse(JSON.stringify(updated)),
          });
        }
        currentSpec = updated;
      }"
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

    <!-- Stage 1.3 — Parse Implied Sharpening panel -->
    <ParseImpliedSharpeningPanel
      :open="parseImpliedSharpeningOpen"
      :spec="currentSpec"
      @close="parseImpliedSharpeningOpen = false"
      @reject-entry="onStage13RejectEntry"
      @refine-with-context="onStage13RefinementHint"
    />

    <!-- Initial Input viewer — Tom Gilb 2026-06-19 INITIAL SPECS request -->
    <InitialInputPanel
      :open="initialInputPanelOpen"
      :snapshot="currentInitialInput"
      @close="initialInputPanelOpen = false"
    />

    <!-- Get A Plan — unified import / history / merge panel -->
    <GetAPlanPanel
      v-if="specInputOpen"
      :has-current-plan="!!currentSpec"
      :restore-snapshot="restoreSnapshotForGetAPlan"
      @imported="handlePlanImported"
      @imported-and-sharpen="handlePlanImportedAndSharpen"
      @imported-with-meta="handlePlanImportedWithMeta"
      @imported-and-sharpen-with-meta="handlePlanImportedAndSharpenWithMeta"
      @add-to="handlePlanAddTo"
      @load-model="handleGetAPlanLoadModel"
      @restore-version="handleGetAPlanRestoreVersion"
      @close="specInputOpen = false"
      @open-contracts-agent="() => { specInputOpen = false; contractsOpen = true }"
    />

    <!-- r41 v237 (Tom Gilb 2026-06-21 verbatim "the 'how credible..' is junk
         i never asked for and got rid of long ago, why is it popping up
         here?") — SurveyGateModal mount permanently DISABLED via v-if="false".
         Triggers in useSurveyGate.ts are also no-ops; this is the
         belt-and-braces second layer so even if a future caller bypasses
         the composable, the modal cannot render.  Feature invariant
         `no-credibility-prompt` in scripts/feature-smoke-test.mjs locks
         the regression. -->
    <SurveyGateModal
      v-if="false"
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
        class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] rounded-full bg-slate-800 text-white text-sm font-medium px-5 py-3 shadow-2xl select-none max-w-[90vw] text-center flex items-center gap-3"
        :class="globalToast.action ? 'pointer-events-auto' : 'pointer-events-none'"
        aria-live="polite"
      >
        <span>{{ globalToast.message }}</span>
        <!-- r93x — Universal Undo P2: toast-level action button (typically [Undo]).
             Clicking fires the handler AND dismisses the toast. Pill becomes
             pointer-events-auto only when an action is present. -->
        <button
          v-if="globalToast.action"
          type="button"
          class="px-3 py-1 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-900 text-xs font-bold ring-1 ring-amber-700 transition-colors"
          :title="`${globalToast.action.label} — undoes the action this toast is reporting`"
          @click="(() => { const h = globalToast.action!.handler; dismissToast(); h() })()"
        >{{ globalToast.action.label }}</button>
      </div>
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

/* ── Crest Tip — CSS-only HoverHint system for Plan Crest elements. ─────────────
   P5 (2026-05-27): any element with data-crest-tip="..." shows a styled
   HoverHint below on hover/focus. No JS, no event handlers — pure CSS.
   Usage: <span data-crest-tip="HoverHint text goes here">button label</span>
   Design: dark slate-800 panel, indigo border, downward from crest bar.
   The Plan Crest sits at z-[300]; HoverHint at z-[400] clears it.
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
