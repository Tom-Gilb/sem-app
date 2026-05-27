<!-- UNIT_TYPE=Widget -->
<!--
/**
 * Renders the AI-suggested Evo Step Plan as an interactive, reorderable list.
 *
 * Features:
 *  - Tab bar: Plan | Timeline | Coverage
 *  - Drag-and-drop reorder via native HTML5 drag API (no external library)
 *  - Up/Down buttons as 44×44px fallback for mobile
 *  - Inline name editing on card click
 *  - Confirm Plan button (disabled until ≥1 step exists and plan is not already confirmed)
 *  - Loading state while the API call is in flight
 *  - Error state if the API call or confirmation fails
 *  - Mobile-first Tailwind layout: full-width cards at 375px base
 *  - ARIA: role="list" on step list, role="listitem" on each card, aria-label on all buttons
 *  - Feature #2: Value Delivery Timeline SVG (Timeline tab)
 *  - Feature #3: Stakeholder Coverage Radial SVG (Coverage tab)
 *  - Feature #5: "What If" Resource Slider (Plan tab, below step list)
 *
 * Spec: S.Evo7.EvoStepPlannerComponent
 */
-->
<script setup lang="ts">
// UNIT_TYPE=Widget
import { ref, computed, watch, onMounted, reactive, nextTick } from 'vue'
import ScrollContainer from './ScrollContainer.vue'
import CloseDot from './CloseDot.vue'
import { useEvoPlan } from '../composables/useEvoPlan'
import { useStepCostEstimator } from '../composables/useStepCostEstimator'
import { useSprintPlanner } from '../composables/useSprintPlanner'
import { useWsjfScorer } from '../composables/useWsjfScorer'
import { useEffortBreakdown } from '../composables/useEffortBreakdown'
import { useConfidenceVote, ringArc } from '../composables/useConfidenceVote'
import { useBubbleChart } from '../composables/useBubbleChart'
import { useStepDoD } from '../composables/useStepDoD'
import { useStepLearning } from '../composables/useStepLearning'
import { useStepMitigation } from '../composables/useStepMitigation'
import { useStepRetro } from '../composables/useStepRetro'
import { useStepReady } from '../composables/useStepReady'
import { useStepPair } from '../composables/useStepPair'
import { useStepMob } from '../composables/useStepMob'
import { useBlockerLog } from '../composables/useBlockerLog'
import type { BlockerSeverity } from '../composables/useBlockerLog'
import { useStepAcceptance } from '../composables/useStepAcceptance'
import { useTimeboxPlanner } from '../composables/useTimeboxPlanner'
import type { TimeboxSize } from '../composables/useTimeboxPlanner'
import { useStepSpike } from '../composables/useStepSpike'
import { useSpikesDetector } from '../composables/useSpikesDetector'
import { useCapacityPlanner } from '../composables/useCapacityPlanner'
import { useWipLimiter } from '../composables/useWipLimiter'
import { useEnergyForecast, useEnergyForecastSpec } from '../composables/useEnergyForecast'
import { useStepKnowledgeGraph } from '../composables/useStepKnowledgeGraph'
import type { KgNode } from '../composables/useStepKnowledgeGraph'
import { useKnowledgeGraph } from '../composables/useKnowledgeGraph'
import { useStepStandup } from '../composables/useStepStandup'
import { useStepAgenda } from '../composables/useStepAgenda'
import { useStandupGenerator } from '../composables/useStandupGenerator'
import { useMeetingAgenda } from '../composables/useMeetingAgenda'
import { useBurnDown } from '../composables/useBurnDown'
import { useRetroThemes } from '../composables/useRetroThemes'
import { useTShapedSkills, spiderPolygonPoints as tSkillsPolygon, spiderSpokes as tSkillsSpokes } from '../composables/useTShapedSkills'
import { useStepMoodTracker } from '../composables/useStepMoodTracker'
import type { MoodEmoji } from '../composables/useStepMoodTracker'
import { useStepTSkills } from '../composables/useStepTSkills'
import { useStepMood } from '../composables/useStepMood'
import { usePairRotation, type PairRotationStep } from '../composables/usePairRotation'
import { useStepCogLoad } from '../composables/useStepCogLoad'
import { useFlowEfficiency } from '../composables/useFlowEfficiency'
import { useUncertaintyCone } from '../composables/useUncertaintyCone'
import { useMoodVelocity } from '../composables/useMoodVelocity'
import { usePairLeaderboard } from '../composables/usePairLeaderboard'
import { useToast } from '../composables/useToast'
import { useDepRiskScore } from '../composables/useDepRiskScore'
import { useSprintReview } from '../composables/useSprintReview'
import { useCycleTime } from '../composables/useCycleTime'
import { useEnergyEffortScatter } from '../composables/useEnergyEffortScatter'
import { useSprintRiskHeatmap } from '../composables/useSprintRiskHeatmap'
import { useBugPrediction } from '../composables/useBugPrediction'
import { useVelocityPredictor } from '../composables/useVelocityPredictor'
import type { SpecBlock } from '../types/spec'
import type { EvoStep } from '../types/evo-plan'
import type { TaskSuggestion } from '../types/task'
import { getProgressEmojis, getProgressLabel } from '../utils/emojiProgress'
import { normaliseGoals } from '../utils/radarGoals'
import { SKILL_CATEGORIES, buildSkillsMatrix, skillCellStyle } from '../utils/skillsMatrix'
import RiskRadar from './RiskRadar.vue'
import EffortRing from './EffortRing.vue'
import LoadingProgress from './LoadingProgress.vue'
import ConceptHint from './ConceptHint.vue'
import { CONCEPT_HINTS } from '../data/conceptHints'
import EditGlyph from './icons/EditGlyph.vue'
import { VIZ_THUMBS, VIZ_STRIP_ITEMS } from '../constants/vizThumbs'
import type { VisualisTab } from '../constants/vizThumbs'

// ── Props and emits ───────────────────────────────────────────────────────────

/** SpecBlock to generate the Evo plan from */
const props = defineProps<{
  /** The spec block whose F./V./S. entries the planner will use */
  specBlock: SpecBlock
  /** Optional map of step name → tasks for Feature #47 emoji progress tracker */
  tasksByStep?: Record<string, TaskSuggestion[]>
  /**
   * Raw SEM input captured at submission time.
   * Used to derive the stakeholder context banner (who benefits, what they need)
   * shown at the top of the Evo Plan view — so the planner always knows WHOSE
   * value each step is moving.
   * Tom 2026-05-15: "THE SPECS DO NOT SHOW STAKEHOLDERS (AND THEIR NEEDS) AT
   * LATER STAGES, this is important to understand and check the plans."
   */
  rawInput?: { stakes: string; ends: string; means: string } | null
}>()

/** Emitted when the user confirms the plan (plan is persisted) */
const emit = defineEmits<{
  /** Fired after the plan is successfully confirmed and persisted.
   *  Payload: the confirmed EvoStep[] so parent can pass them to TaskList / ImpactEstimation.
   */
  confirmed: [steps: import('../types/evo-plan').EvoStep[]]
  /**
   * Fired when the user clicks "Sharpen this plan" (top or bottom of Plan tab).
   * Parent (App.vue) should open the SharpenPanel modal.
   */
  'sharpen-plan': []
  /** Open the global Diagrams & Visuals modal at a specific tab.
   *  Tab defaults to 'flow' if omitted. */
  'open-visualise': [{ tab: VisualisTab }]
  /** Open the full-screen Heat Lane / Swimlane view. */
  'open-heatlane': []
  /** Open the Evo Simulator modal. */
  'open-evo-simulator': []
  /** Open the Spec Editor at a given tab — used by error states to give user a fix path.
   *  Tom 2026-05-15: "there is no action path here" — error states need an escape route. */
  'open-editor': [{ tab: 'functions' | 'values' | 'solutions' | 'constraints' }]
}>()

// ── Composable ────────────────────────────────────────────────────────────────

const {
  plan,
  isConfirmed,
  loading,
  error,
  fetchPlan,
  reorderSteps,
  renameStep,
  removeStep,
  confirmPlan,
} = useEvoPlan()

// ── Tab state ─────────────────────────────────────────────────────────────────

type TabId = 'plan' | 'timeline' | 'coverage' | 'dependencies' | 'gantt' | 'effort' | 'skills' | 'bubble' | 'knowledge'
const activeTab = ref<TabId>('plan')

// ── Local UI state ─────────────────────────────────────────────────────────────

/** Index of the step currently being renamed (-1 = none) */
const editingIndex = ref(-1)
/** Temporary name value while inline editing is active */
const editingName = ref('')
/** Index of the step being dragged (-1 = none) */
const dragSourceIndex = ref(-1)
/** Whether a confirm action is in progress */
const confirming = ref(false)
/** Local error from confirmPlan (separate from fetch error) */
const confirmError = ref('')

// ── Feature #27: Risk Radar ────────────────────────────────────────────────────

/** Index of the step whose risk detail panel is currently expanded (null = none) */
const expandedRiskStep = ref<number | null>(null)

/**
 * Compute the four risk axis scores (0.0–1.0) for a given EvoStep.
 *
 * - complexity: effortPercent / 100
 * - dependencies: proportion of OTHER steps sharing ≥1 linkedValue with this step
 * - resource: same as complexity (effort = resource consumption)
 * - uncertainty: deterministic pseudo-random from step name char-code hash
 */
function computeRisk(
  step: EvoStep,
  allSteps: EvoStep[],
): { complexity: number; dependencies: number; resource: number; uncertainty: number } {
  const complexity = Math.min(1, step.effortPercent / 100)

  const others = allSteps.filter((s) => s !== step)
  const myValues = new Set(step.linkedValues ?? [])
  const sharingCount = others.filter((s) =>
    (s.linkedValues ?? []).some((v) => myValues.has(v)),
  ).length
  const dependencies = allSteps.length > 1
    ? Math.min(1, sharingCount / (allSteps.length - 1))
    : 0

  const resource = complexity

  const hash =
    step.name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 100
  const uncertainty = hash / 100

  return { complexity, dependencies, resource, uncertainty }
}

// ── Feature #5: What If slider ────────────────────────────────────────────────

/** Available hours per week (Feature #5) */
const hoursPerWeek = ref(10)
/** Total effort in person-hours (constant) */
const TOTAL_EFFORT_HOURS = 40

// ── Computed ──────────────────────────────────────────────────────────────────

const steps = computed(() => plan.value?.steps ?? [])

// ── Feature #64: Step cost estimator ─────────────────────────────────────────

/** Map steps to the shape expected by useStepCostEstimator (effort field) */
const stepsForCost = computed(() =>
  steps.value.map((s, i) => ({ id: `step-${i}`, name: s.name, effort: s.effortPercent }))
)

const {
  hourlyRate,
  costPanelOpen,
  stepCosts,
  formattedTotalCost,
  formattedAverageCost,
} = useStepCostEstimator(stepsForCost)

// ── Feature #82: Confidence Vote ─────────────────────────────────────────────

/** Map steps to EvoStep[] shape expected by useConfidenceVote */
const stepsForVotes = computed(() => steps.value)

const { summaries: voteSummaries, setUserVote } = useConfidenceVote(stepsForVotes)

// ── Feature #73: Sprint Planner ───────────────────────────────────────────────

/** Map steps to EvoStep[] shape expected by useSprintPlanner */
const stepsForSprints = computed(() => steps.value)

const { sprintOpen, sprints, copySprintBoard } = useSprintPlanner(stepsForSprints)

// ── Feature #86: WSJF Scorer ──────────────────────────────────────────────────

/** Map steps to EvoStep[] shape expected by useWsjfScorer */
const stepsForWsjf = computed(() => steps.value)

const { wsjfOpen, wsjfEntries, codInputs, setCod, copyWsjfTable } = useWsjfScorer(stepsForWsjf)

// ── Feature #89: Bubble Chart ─────────────────────────────────────────────────

/** Map steps to EvoStep[] shape expected by useBubbleChart */
const stepsForBubble = computed(() => steps.value)

const { bubblePoints, selectedStepId: bubbleSelectedId, selectStep: bubbleSelectStep } = useBubbleChart(stepsForBubble)

// ── Feature #91: Definition of Done ──────────────────────────────────────────

/** Map steps to EvoStep[] shape expected by useStepDoD */
const stepsForDoD = computed(() => steps.value)

const { dodByStep, toggleDod, generateDod: _generateDod, toggleItem: toggleDoDItem, copyDod } = useStepDoD(stepsForDoD, '')

// ── Feature #95: Learning Outcomes ───────────────────────────────────────────

/** Map steps to EvoStep[] shape expected by useStepLearning */
const stepsForLearning = computed(() => steps.value)

const { learningByStep, toggleLearning, generateLearning: _generateLearning, copyLearning } = useStepLearning(stepsForLearning, '')

// ── Feature #106: Risk Mitigation Plan ───────────────────────────────────────

/** Map steps to EvoStep[] shape expected by useStepMitigation */
const stepsForMitigation = computed(() => steps.value)

const { mitigationByStep, toggleMitigation, generateMitigation: _generateMitigation, copyMitigation } = useStepMitigation(stepsForMitigation, '')

// ── Feature #113: Evo Step Retrospective Generator ────────────────────────────

const { retroMap, generateRetro, toggleOpen: toggleRetroOpen, copyRetro } = useStepRetro('')

async function handleRetroToggle(step: EvoStep, index: number): Promise<void> {
  const stepId = `step-${index}`
  const existing = retroMap.value[stepId]
  if (!existing || existing.prompts.length === 0) {
    await generateRetro({ id: stepId, name: step.name, description: step.description })
  }
  toggleRetroOpen(stepId)
}

// ── Feature #116: Definition of Ready ────────────────────────────────────────

const { readyMap, initStep, toggleItem: toggleReadyItem, toggleOpen: toggleReadyOpen, isReady, copyReadiness } = useStepReady()

function handleReadyToggle(stepId: string): void {
  initStep(stepId)
  toggleReadyOpen(stepId)
}

// ── Feature #121: Pair Programming Prompt ─────────────────────────────────────

const { pairMap, generatePlan: generatePairPlan, toggleOpen: togglePairOpen, copyPlan } = useStepPair()

function handlePairToggle(step: EvoStep, index: number): void {
  const id = `step-${index}`
  if (!pairMap.value[id]) {
    generatePairPlan({ id, name: step.name, description: step.description })
  }
  togglePairOpen(id)
}

// ── Feature #135: Mob Programming Planner ────────────────────────────────────

const { mobMap, generateMob, toggleOpen: toggleMobOpen, copyMob } = useStepMob()

function handleMobToggle(step: EvoStep, index: number): void {
  const id = `step-${index}`
  if (!mobMap.value[id]) {
    generateMob({ id, name: step.name, description: step.description })
  }
  toggleMobOpen(id)
}

// ── Traffic light: minimize / fullscreen expand states ───────────────────────
const pairMinimized       = reactive<Record<string, boolean>>({})
const mobMinimized        = reactive<Record<string, boolean>>({})
const retroMinimized      = reactive<Record<string, boolean>>({})
const readyMinimized      = reactive<Record<string, boolean>>({})
const blockerMinimized    = reactive<Record<string, boolean>>({})
const acceptMinimized     = reactive<Record<string, boolean>>({})
const standMinimized      = reactive<Record<string, boolean>>({})
const agendaMinimized     = reactive<Record<string, boolean>>({})
const spikeMinimized      = reactive<Record<string, boolean>>({})

/** Key format: '<type>-step-<index>' — e.g. 'pair-step-2' */
const expandedPanel = ref<string | null>(null)

const _exType = computed(() => expandedPanel.value?.split('-step-')[0] ?? '')
const _exIdx  = computed(() => expandedPanel.value?.split('-step-')[1] ?? '0')
const _exKey  = computed(() => `step-${_exIdx.value}`)

const _exMeta = computed(() => {
  switch (_exType.value) {
    case 'pair':       return { emoji: '👥', title: 'Pair Program Plot',   bg: 'bg-blue-600',   border: 'border-blue-200' }
    case 'mob':        return { emoji: '🖥️',  title: 'Mob Meandering',      bg: 'bg-sky-500',    border: 'border-sky-200' }
    case 'retro':      return { emoji: '🎨',  title: 'Retro Themes',        bg: 'bg-violet-500', border: 'border-violet-200' }
    case 'ready':      return { emoji: '🚦',  title: 'Definition of Ready', bg: 'bg-rose-500',   border: 'border-rose-200' }
    case 'blocker':    return { emoji: '🚫',  title: 'Blocker Log',         bg: 'bg-red-600',    border: 'border-red-200' }
    case 'acceptance': return { emoji: '🧪',  title: 'Acceptance Tests',    bg: 'bg-teal-600',   border: 'border-teal-200' }
    case 'standup':    return { emoji: '📢',  title: 'Daily Standup',       bg: 'bg-green-600',  border: 'border-green-200' }
    case 'agenda':     return { emoji: '📅',  title: 'Meeting Agenda',      bg: 'bg-indigo-600', border: 'border-indigo-200' }
    case 'spike':      return { emoji: '⚡',  title: 'Spike Detector',      bg: 'bg-orange-500', border: 'border-orange-200' }
    default:           return { emoji: '📋',  title: '',                    bg: 'bg-slate-600',  border: 'border-slate-200' }
  }
})

function closeExpanded(): void { expandedPanel.value = null }

// ── Feature #138: Blocker Log ─────────────────────────────────────────────────

const { blockerMap, initStep: initBlockerStep, addBlocker, resolveBlocker, removeBlocker, toggleOpen: toggleBlockerOpen, copyLog } = useBlockerLog()

const newBlockerDesc: Record<string, string> = reactive({})
const newBlockerSeverity: Record<string, BlockerSeverity> = reactive({})

const submitBlocker = (index: number): void => {
  const id = `step-${index}`
  initBlockerStep(id)
  addBlocker(id, newBlockerDesc[id] || 'Blocker', (newBlockerSeverity[id] as BlockerSeverity) || 'P3')
  newBlockerDesc[id] = ''
}

const handleBlockerToggle = (step: EvoStep, index: number): void => {
  initBlockerStep(`step-${index}`)
  toggleBlockerOpen(`step-${index}`)
}

// ── Feature #140: Acceptance Test Generator ──────────────────────────────────

const { acceptanceMap, acceptanceCopied, generate: generateAcceptance, toggleOpen: toggleAcceptanceOpen, copyAcceptance } = useStepAcceptance('')

async function handleAcceptanceToggle(step: EvoStep, index: number): Promise<void> {
  const id = `step-${index}`
  if (!acceptanceMap.value[id] || acceptanceMap.value[id].scenarios.length === 0) {
    await generateAcceptance({ id, name: step.name, description: step.description })
  }
  toggleAcceptanceOpen(id)
}

// ── Feature #145: Daily Standup Generator ────────────────────────────────────

const { standupMap, generateStandup, toggleOpen: toggleStandupOpen, copyStandup } = useStepStandup()

function handleStandupToggle(step: EvoStep, index: number): void {
  const id = `step-${index}`
  if (!standupMap.value[id]) {
    generateStandup({ id, name: step.name })
  }
  toggleStandupOpen(id)
}

// ── Feature #148: Meeting Agenda Generator ───────────────────────────────────

const { agendaMap, generateAgenda, toggleOpen: toggleAgendaOpen, copyAgenda } = useStepAgenda()

function handleAgendaToggle(step: EvoStep, index: number): void {
  const id = `step-${index}`
  if (!agendaMap.value[id]) {
    generateAgenda({ id, name: step.name })
  }
  toggleAgendaOpen(id)
}

// ── Feature #145 v2: Standup Generator (useStandupGenerator) ─────────────────

const stepsForStandup = computed(() =>
  steps.value.map((s, i) => ({ id: `step-${i}`, name: s.name, effort: s.effortPercent }))
)

const {
  standupMap: standupGenMap,
  standupCopied,
  generate: generateStandupEntry,
  toggleOpen: toggleStandupGenOpen,
  copyStandup: copyStandupGen,
} = useStandupGenerator(stepsForStandup)

function handleStandupGenToggle(index: number): void {
  const id = `step-${index}`
  generateStandupEntry(id)
  toggleStandupGenOpen(id)
}

// ── Feature #148 v2: Meeting Agenda (useMeetingAgenda) ───────────────────────

const stepsForAgenda = computed(() =>
  steps.value.map((s, i) => ({ id: `step-${i}`, name: s.name, effort: s.effortPercent }))
)

const {
  agendaMap: agendaGenMap,
  agendaCopied,
  toggleOpen: toggleAgendaGenOpen,
  copyAgenda: copyAgendaGen,
} = useMeetingAgenda(stepsForAgenda)

// ── Feature #150: Burn-Down Estimator ────────────────────────────────────────

const stepsForBurnDown = computed(() =>
  steps.value.map((s, i) => ({ id: `step-${i}`, name: s.name, effort: s.effortPercent }))
)

const {
  burnDownOpen,
  totalEffort: burnTotalEffort,
  burnPoints,
  completionDate: burnCompletionDate,
  isOnTrack: burnIsOnTrack,
  idealPolylinePoints,
  actualPolylinePoints,
  todayX: burnTodayX,
  yTicks: burnYTicks,
  xLabels: burnXLabels,
  SVG_W: BURN_SVG_W,
  SVG_H: BURN_SVG_H,
  PAD_LEFT: BURN_PAD_LEFT,
  PAD_TOP: BURN_PAD_TOP,
  PAD_BOTTOM: BURN_PAD_BOTTOM,
  copyMarkdown: copyBurnDown,
  copied: burnCopied,
} = useBurnDown(stepsForBurnDown)

// ── Feature #153: Retro Themes Aggregator ────────────────────────────────────

const stepsForRetroThemes = computed(() =>
  steps.value.map((s, i) => ({ id: `step-${i}`, name: s.name, effort: s.effortPercent }))
)

const {
  retroThemesOpen,
  themes: retroThemes,
  stepTheme: retroStepTheme,
  copyMarkdown: copyRetroThemes,
  copied: retroThemesCopied,
} = useRetroThemes(stepsForRetroThemes)

// ── Feature #155 new: useStepTSkills ─────────────────────────────────────────

const {
  openSteps: tSkillsOpen,
  toggleOpen: toggleTSkills,
  isOpen: tSkillsIsOpen,
  getProfile: getTSkillProfile,
  buildPolygon: buildTSkillPolygon,
  copyMarkdown: copyTSkillsMarkdown,
} = useStepTSkills()

// ── Feature #158 new: useStepMood ─────────────────────────────────────────────

const {
  toggleOpen: toggleMood,
  isOpen: moodIsOpen,
  getMood,
  setMood: setStepMood,
  dominantMood,
  moodLabel,
  copyMarkdown: copyMoodMd,
  MOODS: moodEmojis,
} = useStepMood()

const moodPanelOpen = ref(false)

// ── Feature #160: Pair Rotation ───────────────────────────────────────────────

const pairRotationStepsRef = computed((): PairRotationStep[] =>
  steps.value.map((s, i) => ({ id: `step-${i}`, name: s.title ?? s.description ?? `Step ${i + 1}` }))
)

const pairRotationOpen = ref(false)
const { allPairs: pairAllPairs, nextRotation: pairNextRotation, pairDebt: pairDebtList, copyMarkdown: copyPairRotation, copied: pairRotationCopied } = usePairRotation(pairRotationStepsRef)

// ── Feature #165: Flow Efficiency ────────────────────────────────────────────

const { open: flowOpen, flowSteps, avgFlowEfficiency, bottleneckCount, copied: flowCopied, copyMarkdown: copyFlowMd } = useFlowEfficiency(() => steps.value.map((s, i) => ({ id: `step-${i}`, title: s.title ?? s.description ?? `Step ${i+1}`, effort: s.effort })))

// ── Feature #168: Uncertainty Cone ───────────────────────────────────────────

const { open: coneOpen, points: conePoints, overallConfidence, copyMarkdown: copyConeMd } = useUncertaintyCone(() => steps.value.map((s, i) => ({ id: `step-${i}`, title: s.title ?? s.description ?? `Step ${i+1}`, completed: s.completed })))

// ── Feature #173: Mood × Velocity Correlation ────────────────────────────────

const {
  open: moodVelocityOpen,
  points: mvPoints,
  correlation: mvCorrelation,
  correlationLabel: mvCorrelationLabel,
  copyMarkdown: copyMvMarkdown,
  copied: mvCopied,
} = useMoodVelocity(() => steps.value.map((s, i) => ({
  id: `step-${i}`,
  title: s.title ?? s.description ?? `Step ${i + 1}`,
  effort: s.effort,
})))

// ── Feature #176: Pair Programming Leaderboard ───────────────────────────────

const {
  open: pairLeaderboardOpen,
  entries: pairLeaderboardEntries,
  topEntry: pairLeaderboardTop,
  copyMarkdown: copyPairLeaderboardMd,
  copied: pairLeaderboardCopied,
} = usePairLeaderboard(() => steps.value.map((s, i) => ({
  id: `step-${i}`,
  title: s.title ?? s.description ?? `Step ${i + 1}`,
  effort: s.effort,
})))

// ── Feature #178: Dependency Risk Score ──────────────────────────────────────

const {
  open: depRiskOpen,
  entries: depRiskEntries,
  criticalCount: depRiskCriticalCount,
  maxRiskScore: depRiskMax,
  copyMarkdown: copyDepRiskMd,
  copied: depRiskCopied,
} = useDepRiskScore(() => steps.value.map((s, i) => ({
  id: `step-${i}`,
  title: s.title ?? s.description ?? `Step ${i + 1}`,
  effort: s.effort,
})))

// ── Feature #180: Sprint Review (per-step) ───────────────────────────────────

const {
  toggleOpen: sprintReviewToggle,
  isOpen: sprintReviewIsOpen,
  getReview: getSprintReview,
  copyReview: copySprintReview,
  copiedSteps: sprintReviewCopied,
} = useSprintReview(() => steps.value.map((s, i) => ({
  id: `step-${i}`,
  title: s.title ?? s.description ?? `Step ${i + 1}`,
})))

// ── Feature #183: Cycle Time (panel-level) ───────────────────────────────────

const {
  open: cycleTimeOpen,
  cycleSteps,
  avgCycleTime,
  bottleneckCount: cycleBottleneckCount,
  copyMarkdown: copyCycleTimeMd,
  copied: cycleTimeCopied,
} = useCycleTime(() => steps.value.map((s, i) => ({
  id: `step-${i}`,
  title: s.title ?? s.description ?? `Step ${i + 1}`,
})))

// ── Feature #185: Energy-Effort Scatter (panel-level) ────────────────────────

const {
  open: energyScatterOpen,
  points: energyScatterPoints,
  dominantQuadrant: energyScatterDominant,
  copyMarkdown: copyEnergyScatterMd,
  copied: energyScatterCopied,
} = useEnergyEffortScatter(() => steps.value.map((s, i) => ({
  id: `step-${i}`,
  title: s.title ?? s.description ?? `Step ${i + 1}`,
  effort: s.effort,
})))

// ── Feature #188: Sprint Risk Heatmap (panel-level) ───────────────────────────

const {
  open: riskHeatmapOpen,
  heatSteps: riskHeatmapSteps,
  highRiskCount: riskHeatmapHighCount,
  copyMarkdown: copyRiskHeatmapMd,
  copied: riskHeatmapCopied,
} = useSprintRiskHeatmap(() => steps.value.map((s, i) => ({
  id: `step-${i}`,
  title: s.title ?? s.description ?? `Step ${i + 1}`,
})))

// ── Feature #190: Bug Prediction (panel-level) ────────────────────────────────

const {
  open: bugPredictionOpen,
  predictions: bugPredictions,
  totalPredicted: bugTotalPredicted,
  criticalCount: bugCriticalCount,
  copyMarkdown: copyBugPredictionMd,
  copied: bugPredictionCopied,
} = useBugPrediction(() => steps.value.map((s, i) => ({
  id: `step-${i}`,
  title: s.title ?? s.description ?? `Step ${i + 1}`,
  effort: s.effort,
})))

// ── Feature #193: Velocity Predictor (panel-level) ───────────────────────────

const {
  open: velocityPredictorOpen,
  points: velocityPoints,
  avgVelocity: velocityAvg,
  trend: velocityTrend,
  copyMarkdown: copyVelocityMd,
  copied: velocityCopied,
} = useVelocityPredictor(() => steps.value.map((s, i) => ({
  id: `step-${i}`,
  title: s.title ?? s.description ?? `Step ${i + 1}`,
  effort: s.effort,
  completed: s.completed,
})))

// ── Feature Organisation Design — Evo Whisper Menu Bar ──────────────────────────

const { toast: evoToast, showToast: showEvoToast } = useToast()

const activeEvoMenu  = ref<string | null>(null)
const hoveredEvoMenu = ref<string | null>(null)
/** "step-{index}:{groupId}" — which per-step dropdown is currently open */
const activeStepMenu = ref<string | null>(null)

function isStepMenuOpen(index: number, groupId: string): boolean {
  return activeStepMenu.value === `step-${index}:${groupId}`
}
function toggleStepMenu(index: number, groupId: string): void {
  const k = `step-${index}:${groupId}`
  activeStepMenu.value = activeStepMenu.value === k ? null : k
}

const EVO_MENU_GROUPS = [
  { id: 'sprint',   emoji: '📅', label: 'Sprint Plan',  items: [
    { emoji: '💰', label: 'Cost Estimate',    toggle: 'costPanelOpen' },
    { emoji: '📅', label: 'Sprint Planner',   toggle: 'sprintOpen' },
    { emoji: '🚦', label: 'WIP Limit',        toggle: 'wipOpen' },
    { emoji: '⚗️', label: 'Capacity',         toggle: 'capacityOpen' },
    { emoji: '⏱️', label: 'Timeboxing',       toggle: 'timeboxOpen' },
  ]},
  { id: 'analyse',  emoji: '📊', label: 'Analyse Plan',  items: [
    { emoji: '🥇', label: 'WSJF Priority',    toggle: 'wsjfOpen' },
    { emoji: '🎨', label: 'Retro Themes',     toggle: 'retroThemesOpen' },
    { emoji: '😊', label: 'Team Mood',        toggle: 'moodPanelOpen' },
    { emoji: '📈', label: 'Mood × Velocity',  toggle: 'moodVelocityOpen' },
    { emoji: '🌊', label: 'Flow Efficiency',  toggle: 'flowOpen' },
    { emoji: '🔺', label: 'Uncertainty Cone', toggle: 'coneOpen' },
    { emoji: '🔥', label: 'Risk Heatmap',     toggle: 'riskHeatmapOpen' },
    { emoji: '🐛', label: 'Bug Prediction',   toggle: 'bugPredictionOpen' },
  ]},
  { id: 'team',     emoji: '👥', label: 'Team Plan',  items: [
    { emoji: '🔄', label: 'Pair Rotation',    toggle: 'pairRotationOpen' },
    { emoji: '🏆', label: 'Pair Leaderboard', toggle: 'pairLeaderboardOpen' },
    { emoji: '🔗', label: 'Dep Risk',         toggle: 'depRiskOpen' },
    { emoji: '🕸️', label: 'Knowledge Graph', toggle: 'kgOpen' },
  ]},
  { id: 'forecast', emoji: '📈', label: 'Forecast Plan', items: [
    { emoji: '📉', label: 'Burn-Down',        toggle: 'burnDownOpen' },
    { emoji: '⚡', label: 'Energy Forecast',  toggle: 'energyForecastOpen' },
    { emoji: '🧠', label: 'Evo Forecast',     toggle: 'forecastOpen' },
    { emoji: '📈', label: 'Velocity',         toggle: 'velocityPredictorOpen' },
    { emoji: '⏱️', label: 'Cycle Time',       toggle: 'cycleTimeOpen' },
    { emoji: '🔵', label: 'Energy Scatter',   toggle: 'energyScatterOpen' },
  ]},
]

// Static metadata for each global feature panel: used for the color bar
// and for scroll-targeting.  The bar color matches the group color.
// All class strings are complete so Tailwind includes them in the bundle.
const PANEL_META: Record<string, { emoji: string; label: string; bar: string }> = {
  // Sprint Plan group (violet)
  costPanelOpen:         { emoji: '💰', label: 'Cost Estimate',    bar: 'bg-violet-500' },
  sprintOpen:            { emoji: '📅', label: 'Sprint Planner',   bar: 'bg-violet-500' },
  wipOpen:               { emoji: '🚦', label: 'WIP Limit',        bar: 'bg-violet-500' },
  capacityOpen:          { emoji: '⚗️', label: 'Capacity',         bar: 'bg-violet-500' },
  timeboxOpen:           { emoji: '⏱️', label: 'Timeboxing',       bar: 'bg-violet-500' },
  // Analyse Plan group (blue)
  wsjfOpen:              { emoji: '🥇', label: 'WSJF Priority',    bar: 'bg-blue-500' },
  retroThemesOpen:       { emoji: '🎨', label: 'Retro Themes',     bar: 'bg-blue-500' },
  moodPanelOpen:         { emoji: '😊', label: 'Team Mood',        bar: 'bg-blue-500' },
  moodVelocityOpen:      { emoji: '📈', label: 'Mood × Velocity',  bar: 'bg-blue-500' },
  flowOpen:              { emoji: '🌊', label: 'Flow Efficiency',  bar: 'bg-blue-500' },
  coneOpen:              { emoji: '🔺', label: 'Uncertainty Cone', bar: 'bg-blue-500' },
  riskHeatmapOpen:       { emoji: '🔥', label: 'Risk Heatmap',     bar: 'bg-blue-500' },
  bugPredictionOpen:     { emoji: '🐛', label: 'Bug Prediction',   bar: 'bg-blue-500' },
  // Team Plan group (emerald)
  pairRotationOpen:      { emoji: '🔄', label: 'Pair Rotation',    bar: 'bg-emerald-500' },
  pairLeaderboardOpen:   { emoji: '🏆', label: 'Pair Leaderboard', bar: 'bg-emerald-500' },
  depRiskOpen:           { emoji: '🔗', label: 'Dep Risk',         bar: 'bg-emerald-500' },
  kgOpen:                { emoji: '🕸️', label: 'Knowledge Graph',  bar: 'bg-emerald-500' },
  // Forecast Plan group (amber)
  burnDownOpen:          { emoji: '📉', label: 'Burn-Down',        bar: 'bg-amber-500' },
  energyForecastOpen:    { emoji: '⚡', label: 'Energy Forecast',  bar: 'bg-amber-500' },
  forecastOpen:          { emoji: '🧠', label: 'Evo Forecast',     bar: 'bg-amber-500' },
  velocityPredictorOpen: { emoji: '📈', label: 'Velocity',         bar: 'bg-amber-500' },
  cycleTimeOpen:         { emoji: '⏱️', label: 'Cycle Time',       bar: 'bg-amber-500' },
  energyScatterOpen:     { emoji: '🔵', label: 'Energy Scatter',   bar: 'bg-amber-500' },
}

function toggleEvoPanel(toggle: string): void {
  const map: Record<string, { value: boolean }> = {
    costPanelOpen, sprintOpen, wipOpen, capacityOpen, timeboxOpen,
    wsjfOpen, retroThemesOpen, moodPanelOpen, moodVelocityOpen,
    flowOpen, coneOpen, riskHeatmapOpen, bugPredictionOpen,
    pairRotationOpen, pairLeaderboardOpen, depRiskOpen, kgOpen,
    burnDownOpen, energyForecastOpen, forecastOpen, velocityPredictorOpen,
    cycleTimeOpen, energyScatterOpen,
  }
  const r = map[toggle]
  if (!r) return
  r.value = !r.value
  // When opening, scroll the panel into view after Vue renders it.
  // We use manual window.scrollTo instead of scrollIntoView so we can subtract
  // the 56px fixed Plan Identity Bar height and not have the panel hidden behind it.
  if (r.value) {
    // Wait for Vue's DOM update, then wait for the browser's layout/paint cycle
    // before measuring position. Without requestAnimationFrame, getBoundingClientRect()
    // can return stale zeros on newly-shown v-if / v-show elements.
    // scrollMarginTop tells the browser to leave 60px above the element (plan bar height)
    // so scrollIntoView never hides the panel behind the fixed header.
    nextTick(() => {
      requestAnimationFrame(() => {
        const el = document.querySelector<HTMLElement>(`[data-panel="${toggle}"]`)
        if (!el) return
        el.style.scrollMarginTop = '60px'
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    })
  }
}

/** Calls an action and fires the step-level toast with "see below ↓". */
function stepToggleWithToast(action: () => void, label: string): void {
  action()
  showEvoToast(label + ' · see below ↓')
}

// ── Per-step action dropdown groups ──────────────────────────────────────────

type StepActionItem = {
  label: string
  emoji: string
  testid?: string
  isActive: () => boolean
  onClick: () => void
  badge?: () => number
}

/**
 * Returns the four labelled dropdown groups that replace the flat icon strip
 * under each Evo step card. Groups: Analyze · Presentation · Visualize · Simplify · Criticize
 * (Financial is reserved for future per-step cost features).
 * All refs are accessed with .value here — Vue auto-unwraps only in templates.
 */
function stepActionGroups(step: EvoStep, index: number): Array<{ id: string; emoji: string; label: string; items: StepActionItem[] }> {
  const key = `step-${index}`
  return [
    {
      id: 'analyze', emoji: '🔍', label: 'Analyze Spec',
      items: [
        { label: 'Definition of Done',  emoji: '✅', testid: `dod-toggle-${index}`,
          isActive: () => dodByStep.value[key]?.open ?? false,
          onClick:  () => stepToggleWithToast(() => toggleDod(key), 'Definition of Done') },
        { label: 'Definition of Ready', emoji: '🚦', testid: `ready-toggle-${index}`,
          isActive: () => readyMap.value[key]?.open ?? false,
          onClick:  () => stepToggleWithToast(() => handleReadyToggle(key), 'Definition of Ready') },
        { label: 'Acceptance Tests',    emoji: '🧪',
          isActive: () => acceptanceMap.value[key]?.open ?? false,
          onClick:  () => stepToggleWithToast(() => handleAcceptanceToggle(step, index), 'Acceptance Tests') },
        { label: 'Learning Outcomes',   emoji: '🎓', testid: `learning-toggle-${index}`,
          isActive: () => learningByStep.value[key]?.open ?? false,
          onClick:  () => stepToggleWithToast(() => toggleLearning(key), 'Learning Outcomes') },
        { label: 'T-Shaped Skills',     emoji: '🔱', testid: `tskills-toggle-${index}`,
          isActive: () => isTSkillOpen(key),
          onClick:  () => stepToggleWithToast(() => toggleTSkillOpen(key), 'T-Shaped Skills') },
        { label: 'Cognitive Load',      emoji: '🧠',
          isActive: () => cogLoadIsOpen(key),
          onClick:  () => stepToggleWithToast(() => toggleCogLoad(key), 'Cognitive Load') },
      ],
    },
    {
      id: 'presentation', emoji: '🖥️', label: 'Presentation',
      items: [
        { label: 'Daily Standup',  emoji: '📢', testid: `standup-gen-toggle-${index}`,
          isActive: () => standupGenMap.value[key]?.isOpen ?? false,
          onClick:  () => stepToggleWithToast(() => handleStandupGenToggle(index), 'Daily Standup') },
        { label: 'Meeting Agenda', emoji: '📅', testid: `agenda-gen-toggle-${index}`,
          isActive: () => agendaGenMap.value[key]?.isOpen ?? false,
          onClick:  () => stepToggleWithToast(() => toggleAgendaGenOpen(key), 'Meeting Agenda') },
        { label: 'Sprint Review',  emoji: '📋', testid: `sprint-review-toggle-${index}`,
          isActive: () => sprintReviewIsOpen(key),
          onClick:  () => stepToggleWithToast(() => sprintReviewToggle(key), 'Sprint Review') },
        { label: 'Team Mood',      emoji: '😊', testid: `mood-toggle-${index}`,
          isActive: () => moodMap.value[key]?.isOpen ?? false,
          onClick:  () => stepToggleWithToast(() => toggleMoodOpen(key), 'Team Mood') },
      ],
    },
    {
      id: 'visualize', emoji: '🗺️', label: 'Visualize',
      items: [
        { label: 'Diagrams & Visuals', emoji: '📊',
          isActive: () => false,
          onClick:  () => emit('open-visualise', { tab: 'flow' }) },
        { label: 'Swimlane View',      emoji: '🏊',
          isActive: () => false,
          onClick:  () => emit('open-heatlane') },
        { label: 'Evo Simulator',      emoji: '▶',
          isActive: () => false,
          onClick:  () => emit('open-evo-simulator') },
      ],
    },
    {
      id: 'simplify', emoji: '✨', label: 'Plan Team Steps Detail',
      items: [
        { label: 'Pair Programming', emoji: '👥',
          isActive: () => pairMap.value[key]?.open ?? false,
          onClick:  () => stepToggleWithToast(() => handlePairToggle(step, index), 'Pair Programming') },
        { label: 'Mob Programming',  emoji: '🖥️',
          isActive: () => mobMap.value[key]?.open ?? false,
          onClick:  () => stepToggleWithToast(() => handleMobToggle(step, index), 'Mob Programming') },
      ],
    },
    {
      id: 'criticize', emoji: '🎯', label: 'Criticize Spec',
      items: [
        { label: 'Risk Mitigation', emoji: '⚠️', testid: `mitigation-toggle-${index}`,
          isActive: () => mitigationByStep.value[key]?.open ?? false,
          onClick:  () => stepToggleWithToast(() => toggleMitigation(key), 'Risk Mitigation') },
        { label: 'Blockers', emoji: '🚫', testid: `blocker-toggle-${index}`,
          isActive: () => blockerMap.value[key]?.open ?? false,
          badge:    () => blockerMap.value[key]?.activeCount ?? 0,
          onClick:  () => stepToggleWithToast(() => handleBlockerToggle(step, index), 'Blockers') },
        { label: 'Retrospective', emoji: '🔄', testid: `retro-toggle-${index}`,
          isActive: () => retroMap.value[key]?.open ?? false,
          onClick:  () => stepToggleWithToast(() => handleRetroToggle(step, index), 'Retrospective') },
        ...(spikeMap.value[key]?.flagged
          ? [{ label: 'Technical Spike', emoji: '⚡',
               isActive: () => spikeMap.value[key]?.open ?? false,
               badge:    () => spikeMap.value[key]?.flags?.length ?? 0,
               onClick:  () => stepToggleWithToast(() => toggleSpikeOpen(key), 'Technical Spike') }]
          : []),
      ],
    },
  ]
}

// ── Feature #163: Cognitive Load per step ────────────────────────────────────

const { toggleOpen: toggleCogLoad, isOpen: cogLoadIsOpen, getProfile: getCogProfile, cogBarWidth } = useStepCogLoad()

// ── Feature #155: T-Shaped Skills Visualiser ─────────────────────────────────

const stepsForTSkills = computed(() =>
  steps.value.map((s, i) => ({ id: `step-${i}`, name: s.name }))
)

const {
  entries: tSkillEntries,
  toggleOpen: toggleTSkillOpen,
  isOpen: isTSkillOpen,
  copyMarkdown: copyTSkills,
  copied: tSkillsCopied,
} = useTShapedSkills(stepsForTSkills)

// ── Feature #158: Step Mood Tracker ──────────────────────────────────────────

const stepsForMood = computed(() =>
  steps.value.map((s, i) => ({ id: `step-${i}`, name: s.name }))
)

const {
  moodMap,
  setMood,
  toggleOpen: toggleMoodOpen,
  aggregateMood,
  copyMarkdown: copyMoodMarkdown,
  moodCopied,
} = useStepMoodTracker(stepsForMood)

// ── Feature #143: Timeboxing Planner ─────────────────────────────────────────

const timeboxOpen = ref(false)

const stepsForTimebox = computed(() =>
  steps.value.map((s, i) => ({ id: `step-${i}`, name: s.name }))
)

const {
  entries: timeboxEntries,
  setTimebox,
  updateTimebox,
  totalMinutes: timeboxTotalMinutes,
  totalHours: timeboxTotalHours,
  overloadWarning: timeboxOverload,
  totalFormatted,
  overLimitSteps,
  copyMarkdown: copyTimeboxMarkdown,
  copied: timeboxCopied,
} = useTimeboxPlanner(stepsForTimebox)

// ── Feature #125: Step Spike Detector ────────────────────────────────────────

const { spikeMap, analyseStep, toggleOpen: toggleSpikeOpen, copySpike, totalFlaggedCount } = useStepSpike()

onMounted(() => {
  steps.value.forEach((step, i) => analyseStep({ id: `step-${i}`, name: step.name, description: step.description }))
})

// ── Feature #125b: Spike Detector (useSpikesDetector) ─────────────────────────
const stepsForSpikes = computed(() =>
  steps.value.map((s, i) => ({ id: `step-${i}`, name: s.name, description: s.description }))
)
const { spikeMap: spikeDetectorMap } = useSpikesDetector(stepsForSpikes.value)

// ── Feature #101: Capacity Planner ───────────────────────────────────────────

/** Map steps to EvoStep[] shape expected by useCapacityPlanner */
const stepsForCapacity = computed(() => steps.value)

const { capacityOpen, hrPerWeek, weeks: capacityWeeks, overCapacityCount, copyCapacityPlan } = useCapacityPlanner(stepsForCapacity)

// ── Feature #128: WIP Limit Enforcer ─────────────────────────────────────────

/** Map steps to the shape expected by useWipLimiter */
const stepsForWip = computed(() => steps.value)

const wipOpen = ref(false)
const { status, wipLimit, increaseLimit, decreaseLimit, copyMarkdown: copyWip, copied: wipCopied } = useWipLimiter(stepsForWip)

// ── Feature #130: Energy Forecast ────────────────────────────────────────────

const energyForecastOpen = ref(false)
const {
  forecastPoints: energyForecastPoints,
  warningStepIndices: energyWarningIndices,
  hasWarning: hasEnergyWarning,
  svgPolylinePoints: energySvgPoints,
} = useEnergyForecast(steps.value)

// ── Feature #133: Knowledge Graph ─────────────────────────────────────────────

const kgOpen = ref(false)

/** V. blocks from the spec block for the knowledge graph */
const kgValueBlocks = computed(() =>
  props.specBlock.values.map((v) => ({
    id: v.id,
    name: v.id,
    description: v.description,
  }))
)

const { nodes: kgNodes, edges: kgEdges } = useStepKnowledgeGraph(steps.value, kgValueBlocks.value)

const kgNodeMap = computed<Record<string, KgNode>>(() => {
  const map: Record<string, KgNode> = {}
  for (const node of kgNodes.value) {
    map[node.id] = node
  }
  return map
})

// ── Feature #130 spec panel — Energy Forecast (spec-compliant) ────────────────

const forecastOpen = ref(false)
const stepsForForecast = computed(() => steps.value.map((s, i) => ({ id: `step-${i}`, name: s.name })))
const {
  forecastPoints,
  warnSteps,
  hasWarning,
  svgPoints,
  svgWidth,
  svgHeight,
  yForLevel,
  copyMarkdown: copyForecast,
  copied: forecastCopied,
} = useEnergyForecastSpec(stepsForForecast)

// ── Feature #133 spec panel — Knowledge Graph (spec-compliant) ────────────────

const kgSpecValueBlocks = computed(() =>
  props.specBlock.values.map((v) => ({
    id: v.id,
    name: v.id,
    description: v.description ?? '',
  }))
)
const kgSpecSteps = computed(() =>
  steps.value.map((s, i) => ({
    id: `step-${i}`,
    name: s.name,
    linkedValues: s.linkedValues,
  }))
)
const {
  nodes: kgSpecNodes,
  edges: kgSpecEdges,
  selectedId: kgSelectedId,
  select: kgSelect,
  isHighlighted: kgIsHighlighted,
  svgWidth: kgSvgWidth,
} = useKnowledgeGraph(kgSpecSteps.value, kgSpecValueBlocks.value)

/** Confirm button is disabled until at least one step exists and plan is unconfirmed */
const canConfirm = computed(
  () => steps.value.length > 0 && !isConfirmed.value && !confirming.value,
)

/** Whether the What If slider section should be visible */
const showWhatIf = computed(
  () => isConfirmed.value && steps.value.length >= 1,
)

// ── Feature #5: date computation helpers ─────────────────────────────────────

/**
 * Returns the next Monday from today as a Date object.
 */
function nextMonday(): Date {
  const today = new Date()
  // getDay(): 0=Sun,1=Mon,2=Tue,...,6=Sat
  const dayOfWeek = today.getDay()
  // Days until next Monday: if today is Monday (1) → 7, otherwise (8 - dayOfWeek) % 7
  const daysUntilMonday = dayOfWeek === 1 ? 7 : (8 - dayOfWeek) % 7
  const monday = new Date(today)
  monday.setDate(today.getDate() + daysUntilMonday)
  monday.setHours(0, 0, 0, 0)
  return monday
}

/**
 * Adds weeks to a Date and returns a new Date.
 */
function addWeeks(date: Date, weeks: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + weeks * 7)
  return result
}

/**
 * Formats a Date as "Mon DD/MM" (e.g. "Mon 12/05").
 */
function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `Mon ${day}/${month}`
}

/** Per-step projected end dates based on hoursPerWeek (Feature #5) */
const whatIfRows = computed(() => {
  const start = nextMonday()
  let cursor = new Date(start)
  return steps.value.map((step) => {
    const weeks = Math.ceil((step.effortPercent / 100) * (TOTAL_EFFORT_HOURS / hoursPerWeek.value))
    cursor = addWeeks(cursor, weeks)
    return { name: step.name, endDate: formatDate(cursor), weeks }
  })
})

/** Summary end date for What If slider (last step's end date) */
const whatIfSummaryDate = computed(() => {
  if (whatIfRows.value.length === 0) return ''
  return whatIfRows.value[whatIfRows.value.length - 1].endDate
})

// ── Feature #2: Timeline SVG computations ─────────────────────────────────────

const TIMELINE_VIEW_WIDTH = 620
const TIMELINE_VIEW_HEIGHT = 280
const TIMELINE_PADDING_LEFT = 50
const TIMELINE_PADDING_RIGHT = 30
const TIMELINE_PADDING_TOP = 30
const TIMELINE_PADDING_BOTTOM = 60

const timelineChartWidth = TIMELINE_VIEW_WIDTH - TIMELINE_PADDING_LEFT - TIMELINE_PADDING_RIGHT
const timelineChartHeight = TIMELINE_VIEW_HEIGHT - TIMELINE_PADDING_TOP - TIMELINE_PADDING_BOTTOM

/** Whether Timeline/Coverage should show placeholder */
const showTimelinePlaceholder = computed(
  () => !isConfirmed.value || steps.value.length === 0,
)

/** Cumulative value points: after each step completes, value rises by effortPercent */
const valueCurvePoints = computed(() => {
  const n = steps.value.length
  if (n === 0) return []
  const xStep = timelineChartWidth / (n - 1 || 1)
  let cumulative = 0
  return steps.value.map((step, i) => {
    cumulative = Math.min(100, cumulative + step.effortPercent)
    const x = TIMELINE_PADDING_LEFT + i * xStep
    const y = TIMELINE_PADDING_TOP + timelineChartHeight * (1 - cumulative / 100)
    return { x, y, cumulative, step, i }
  })
})

/** Cumulative cost points: same x-axis, y-axis = cumulative effort */
const costCurvePoints = computed(() => {
  const n = steps.value.length
  if (n === 0) return []
  const xStep = timelineChartWidth / (n - 1 || 1)
  let cumulative = 0
  return steps.value.map((step, i) => {
    cumulative = Math.min(100, cumulative + step.effortPercent)
    const x = TIMELINE_PADDING_LEFT + i * xStep
    const y = TIMELINE_PADDING_TOP + timelineChartHeight * (1 - cumulative / 100)
    return { x, y, cumulative, step, i }
  })
})

/** SVG polyline points string for value curve */
const valuePolylinePoints = computed(() =>
  valueCurvePoints.value.map(p => `${p.x},${p.y}`).join(' '),
)

/** SVG polyline points string for cost curve — cost increases linearly by effort% */
const costPolylinePoints = computed(() => {
  const n = steps.value.length
  if (n === 0) return ''
  const xStep = timelineChartWidth / (n - 1 || 1)
  let cumulative = 0
  return steps.value.map((step, i) => {
    cumulative = Math.min(100, cumulative + step.effortPercent)
    const x = TIMELINE_PADDING_LEFT + i * xStep
    const y = TIMELINE_PADDING_TOP + timelineChartHeight * (1 - cumulative / 100)
    return `${x},${y}`
  }).join(' ')
})

/** X-axis labels for timeline */
const timelineXLabels = computed(() => {
  const n = steps.value.length
  if (n === 0) return []
  const xStep = timelineChartWidth / (n - 1 || 1)
  return steps.value.map((step, i) => ({
    x: TIMELINE_PADDING_LEFT + i * xStep,
    label: step.name.length > 10 ? step.name.slice(0, 10) + '…' : step.name,
  }))
})

/** Y-axis grid lines at 25/50/75% */
const timelineGridLines = [25, 50, 75, 100].map(pct => ({
  pct,
  y: TIMELINE_PADDING_TOP + timelineChartHeight * (1 - pct / 100),
}))

/** Projected dates below each step for timeline (Feature #2) */
const timelineProjectedDates = computed(() => {
  const n = steps.value.length
  if (n === 0) return []
  const xStep = timelineChartWidth / (n - 1 || 1)
  const start = nextMonday()
  let cursor = new Date(start)
  return steps.value.map((step, i) => {
    const weeks = Math.ceil((step.effortPercent / 100) * 12)
    cursor = addWeeks(cursor, weeks)
    return {
      x: TIMELINE_PADDING_LEFT + i * xStep,
      date: formatDate(cursor),
    }
  })
})

// ── Feature #3: Coverage Radial SVG computations ──────────────────────────────

const RADIAL_CX = 220
const RADIAL_CY = 220
const RADIAL_OUTER = 180
const RADIAL_PALETTE = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#3b82f6']

/** All unique linked values across all steps */
const uniqueValues = computed(() => {
  const seen = new Set<string>()
  for (const step of steps.value) {
    for (const v of step.linkedValues) {
      seen.add(v)
    }
  }
  return Array.from(seen)
})

const showCoveragePlaceholder = computed(
  () => !isConfirmed.value || steps.value.length === 0,
)

const showRadialFallback = computed(
  () => isConfirmed.value && steps.value.length > 0 && uniqueValues.value.length < 3,
)

/**
 * For a given spoke index and total spoke count, return (x, y) at radius r
 * starting from top (−90°), going clockwise.
 */
function spokePoint(spokeIndex: number, totalSpokes: number, radius: number): { x: number; y: number } {
  const angle = (spokeIndex / totalSpokes) * 2 * Math.PI - Math.PI / 2
  return {
    x: RADIAL_CX + radius * Math.cos(angle),
    y: RADIAL_CY + radius * Math.sin(angle),
  }
}

/** Spoke tip positions (at RADIAL_OUTER) */
const spokeTips = computed(() =>
  uniqueValues.value.map((_, i) => spokePoint(i, uniqueValues.value.length, RADIAL_OUTER)),
)

/** Spoke label positions (slightly beyond RADIAL_OUTER) */
const spokeLabels = computed(() =>
  uniqueValues.value.map((val, i) => {
    const pt = spokePoint(i, uniqueValues.value.length, RADIAL_OUTER + 18)
    const truncated = val.length > 14 ? val.slice(0, 14) + '…' : val
    return { x: pt.x, y: pt.y, label: truncated }
  }),
)

/** Ring positions at 33% and 67% */
const radialRings = [33, 67].map(pct => ({
  pct,
  r: (pct / 100) * RADIAL_OUTER,
}))

/**
 * For a step, compute a polygon path around the spokes.
 * Spoke is full-length if step.linkedValues includes that value; else centre.
 */
function stepPolygonPoints(stepIndex: number): string {
  const step = steps.value[stepIndex]
  if (!step) return ''
  const n = uniqueValues.value.length
  const pts = uniqueValues.value.map((val, i) => {
    const r = step.linkedValues.includes(val) ? RADIAL_OUTER : 0
    return spokePoint(i, n, r)
  })
  return pts.map(p => `${p.x},${p.y}`).join(' ')
}

/** Per-step colour from cycling palette */
const stepColours = computed(() =>
  steps.value.map((_, i) => RADIAL_PALETTE[i % RADIAL_PALETTE.length]),
)

// ── Feature #55: Goals radar overlay ─────────────────────────────────────────

/**
 * Normalised goal ratios (0–1) for each unique value axis, derived from
 * the spec's V. entry Goal fields.  Index order matches uniqueValues.
 */
const goalsOverlayNorm = computed(() => {
  const vEntries = props.specBlock.values
  // Map each axis (uniqueValues) to the matching spec V. entry goal
  const goals = uniqueValues.value.map(axisId => {
    const entry = vEntries.find(v => v.id === axisId || v.id.endsWith(axisId) || axisId.endsWith(v.id))
    return entry?.goal
  })
  return normaliseGoals(goals)
})

/** Whether to show the Goals overlay (spec has V. entries with parseable goals) */
const showGoalsOverlay = computed(() =>
  props.specBlock.values.length > 0 &&
  goalsOverlayNorm.value.some(r => r > 0),
)

/**
 * SVG polygon points string for the Goals overlay — same coordinate system
 * as stepPolygonPoints(), using normalised goal ratio as the radial fraction.
 */
const goalsOverlayPoints = computed((): string => {
  const n = uniqueValues.value.length
  if (n === 0) return ''
  const pts = uniqueValues.value.map((_val, i) => {
    const r = goalsOverlayNorm.value[i] * RADIAL_OUTER
    return spokePoint(i, n, r)
  })
  return pts.map(p => `${p.x},${p.y}`).join(' ')
})

// ── Feature #21: Dependency Visualiser ───────────────────────────────────────

/** Whether to show the dependency placeholder (unconfirmed or no steps) */
const showDepPlaceholder = computed(
  () => !isConfirmed.value || steps.value.length === 0,
)

/** Whether to show the single-step fallback */
const showDepFallback = computed(
  () => isConfirmed.value && steps.value.length === 1,
)

interface DepEdge { from: number; to: number }

/**
 * Infer dependency edges from shared linkedValues across steps.
 * Step B depends on step A if B appears later in the plan AND shares ≥1
 * linkedValue with any preceding step (A). Falls back to a linear chain when
 * no shared values are found.
 */
const depEdges = computed((): DepEdge[] => {
  const n = steps.value.length
  if (n < 2) return []

  const edges: DepEdge[] = []
  // For each step (from index 1 onward) check if it shares a value with any prior step
  for (let b = 1; b < n; b++) {
    const bVals = new Set(steps.value[b].linkedValues ?? [])
    for (let a = 0; a < b; a++) {
      const shared = (steps.value[a].linkedValues ?? []).some(v => bVals.has(v))
      if (shared) {
        edges.push({ from: a, to: b })
        break // only one edge per "to" step (first matching predecessor)
      }
    }
  }

  // Fallback: linear chain if nothing was found
  if (edges.length === 0) {
    for (let i = 0; i < n - 1; i++) {
      edges.push({ from: i, to: i + 1 })
    }
  }
  return edges
})

/** SVG viewBox string — 1 row for ≤6 steps, 2 rows otherwise */
const depViewBox = computed(() =>
  steps.value.length <= 6 ? '0 0 700 160' : '0 0 700 280',
)

const DEP_NODE_W = 120
const DEP_NODE_H = 44

/**
 * Unique marker ID generated at setup time.
 * A fresh random suffix prevents browsers from reusing a stale cached
 * url(#arrow) reference when the dependencies SVG is unmounted and remounted
 * via v-if (switching tabs).
 */
const depArrowMarkerId = `dep-arrow-${Math.random().toString(36).slice(2, 8)}`

/**
 * Compute the (cx, cy) centre for node at index i.
 * ≤6 steps: single row at y=80, equally spaced across 700px.
 * >6 steps: first 6 in top row (y=80), remainder in bottom row (y=200).
 */
function depNodeCenter(index: number, total: number): { cx: number; cy: number } {
  const topCount = Math.min(total, 6)
  const botCount = total - topCount

  if (index < topCount) {
    // Top row
    const spacing = 700 / topCount
    return { cx: spacing * index + spacing / 2, cy: 80 }
  } else {
    // Bottom row
    const bi = index - topCount
    const spacing = 700 / botCount
    return { cx: spacing * bi + spacing / 2, cy: 200 }
  }
}

/** Precomputed node centres for the dependency graph */
const depNodes = computed(() =>
  steps.value.map((step, i) => {
    const { cx, cy } = depNodeCenter(i, steps.value.length)
    return {
      cx,
      cy,
      x: cx - DEP_NODE_W / 2,
      y: cy - DEP_NODE_H / 2,
      label: step.name.length > 14 ? step.name.slice(0, 14) + '…' : step.name,
    }
  }),
)

/** Cubic bezier path from right edge of "from" node to left edge of "to" node */
function depArrowPath(from: number, to: number): string {
  const f = depNodes.value[from]
  const t = depNodes.value[to]
  if (!f || !t) return ''
  const x1 = f.cx + DEP_NODE_W / 2
  const y1 = f.cy
  const x2 = t.cx - DEP_NODE_W / 2
  const y2 = t.cy
  const cpx = (x1 + x2) / 2
  return `M ${x1} ${y1} C ${cpx} ${y1} ${cpx} ${y2} ${x2} ${y2}`
}

// ── Feature #36: Effort Breakdown Doughnut ────────────────────────────────────

const { breakdown: computeBreakdown, slicePaths: computeSlicePaths } = useEffortBreakdown(40)

/** Whether the Effort tab should show a placeholder */
const showEffortPlaceholder = computed(
  () => !isConfirmed.value || steps.value.length === 0,
)

/** Per-step doughnut data: slices + path strings */
const effortBreakdowns = computed(() => {
  const entries = computeBreakdown(steps.value)
  return entries.map((entry) => ({
    ...entry,
    paths: computeSlicePaths(entry, 44, 44, 38, 20),
  }))
})

// ── Feature #32: Gantt SVG computations ──────────────────────────────────────

/** Bar colour palette — cycle by step index */
const GANTT_PALETTE = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6']

/** Whether the Gantt tab should show a placeholder */
const showGanttPlaceholder = computed(
  () => !isConfirmed.value || steps.value.length === 0,
)

/** SVG total height: rows * 50 + 60 */
const ganttSvgHeight = computed(() => steps.value.length * 50 + 60)

/** SVG viewBox string — dynamic height */
const ganttViewBox = computed(() => `0 0 700 ${ganttSvgHeight.value}`)

/** Total project duration in weeks */
const ganttTotalWeeks = computed(() => {
  return steps.value.reduce((sum, step) => sum + Math.ceil(step.effortPercent / 100 * 12), 0)
})

/** Width of the chart area (excluding left label margin) */
const GANTT_LABEL_W = 90
const GANTT_CHART_W = 700 - GANTT_LABEL_W - 10

/** Pixels per week */
const ganttPxPerWeek = computed(() => {
  const total = ganttTotalWeeks.value || 1
  return GANTT_CHART_W / total
})

/** Format Date as "DD/MM" */
function formatShortDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${day}/${month}`
}

/** Format Date as "Mon DD/MM" for axis tick */
function formatAxisDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${day}/${month}`
}

interface GanttRow {
  step: (typeof steps.value)[0]
  index: number
  startWeek: number
  durationWeeks: number
  endWeek: number
  startX: number
  barWidth: number
  endX: number
  y: number        // top of row
  barY: number     // y of bar (centred in row, height=24, row=50)
  colour: string
  labelText: string
  endDateLabel: string
}

/** Per-step Gantt row data */
const ganttRows = computed((): GanttRow[] => {
  const start = nextMonday()
  let weekCursor = 0
  const pxW = ganttPxPerWeek.value
  return steps.value.map((step, i) => {
    const dur = Math.ceil(step.effortPercent / 100 * 12)
    const rowY = 60 + i * 50  // top of row; axis starts at y=60
    const barH = 24
    const startX = GANTT_LABEL_W + weekCursor * pxW
    const barWidth = Math.max(4, dur * pxW)
    const endX = startX + barWidth
    const endDate = addWeeks(start, weekCursor + dur)
    const label = step.name.length > 12 ? step.name.slice(0, 12) : step.name
    const row: GanttRow = {
      step,
      index: i,
      startWeek: weekCursor,
      durationWeeks: dur,
      endWeek: weekCursor + dur,
      startX,
      barWidth,
      endX,
      y: rowY,
      barY: rowY + (50 - barH) / 2,
      colour: GANTT_PALETTE[i % GANTT_PALETTE.length],
      labelText: label,
      endDateLabel: formatShortDate(endDate),
    }
    weekCursor += dur
    return row
  })
})

/** Week-number axis ticks: one per week from 0..totalWeeks */
const ganttAxisTicks = computed(() => {
  const start = nextMonday()
  const ticks: { x: number; label: string }[] = []
  const total = ganttTotalWeeks.value
  for (let w = 0; w <= total; w++) {
    const x = GANTT_LABEL_W + w * ganttPxPerWeek.value
    const d = addWeeks(start, w)
    ticks.push({ x, label: formatAxisDate(d) })
  }
  return ticks
})

/** Today's x position in the Gantt (null if outside project range) */
const ganttTodayX = computed((): number | null => {
  const start = nextMonday()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const msPerWeek = 7 * 24 * 60 * 60 * 1000
  const weeksFromStart = (today.getTime() - start.getTime()) / msPerWeek
  if (weeksFromStart < 0 || weeksFromStart > ganttTotalWeeks.value) return null
  return GANTT_LABEL_W + weeksFromStart * ganttPxPerWeek.value
})

// ── Feature #58: Skills matrix ────────────────────────────────────────────────

/** Skills × steps 2D array of SkillLevel (0–3) */
const skillsMatrix = computed(() =>
  buildSkillsMatrix(steps.value, props.specBlock),
)

// ── Auto-fetch on mount or when specBlock changes ─────────────────────────────
//
// We deliberately avoid `{ immediate: true }`.  EvoPlanView unmounts every time
// the user navigates to a different stage and remounts on return — with
// immediate-fire the watcher would re-call fetchPlan() on every return, and
// inside useEvoPlan that path (a) cleared `plan.value = null` before awaiting
// the AI and (b) cost a full AI round-trip even though the plan was already
// in the module-level singleton.  Now we manually decide on mount: only fetch
// if no plan exists yet for the current spec.

onMounted(() => {
  // If a plan is already loaded from a prior mount (or from version-history
  // restore via loadPlan), do NOT regenerate.  The module-level singletons
  // _lastFetchedSpec and _inFlight in useEvoPlan would also catch a duplicate,
  // but checking here avoids the network round-trip entirely.
  if (plan.value) return
  if (props.specBlock) {
    void fetchPlan(props.specBlock)
  }
})

// Real spec change (sharpen, rewrite, model swap, etc.) — currentSpec.value
// gets reassigned to a new object reference, watcher fires (not immediate),
// fetchPlan is called.  useEvoPlan's _lastFetchedSpec identity guard still
// short-circuits if the new spec is somehow === the old one.
watch(
  () => props.specBlock,
  async (block, prev) => {
    if (block && block !== prev) {
      await fetchPlan(block)
    }
  },
)

// ── Inline editing ─────────────────────────────────────────────────────────────

function startEdit(index: number): void {
  editingIndex.value = index
  editingName.value = steps.value[index]?.name ?? ''
}

function commitEdit(): void {
  if (editingIndex.value >= 0 && editingName.value.trim()) {
    renameStep(editingIndex.value, editingName.value.trim())
  }
  editingIndex.value = -1
  editingName.value = ''
}

function cancelEdit(): void {
  editingIndex.value = -1
  editingName.value = ''
}

// ── Drag-and-drop (native HTML5 drag API) ─────────────────────────────────────

function onDragStart(event: DragEvent, index: number): void {
  dragSourceIndex.value = index
  event.dataTransfer?.setData('text/plain', String(index))
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
  }
}

function onDragOver(event: DragEvent): void {
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
}

function onDrop(event: DragEvent, targetIndex: number): void {
  event.preventDefault()
  if (dragSourceIndex.value < 0 || dragSourceIndex.value === targetIndex) {
    dragSourceIndex.value = -1
    return
  }
  reorderSteps(dragSourceIndex.value, targetIndex)
  dragSourceIndex.value = -1
}

function onDragEnd(): void {
  dragSourceIndex.value = -1
}

// ── Up/Down button reorder (mobile fallback) ──────────────────────────────────

function moveUp(index: number): void {
  if (index > 0) reorderSteps(index, index - 1)
}

function moveDown(index: number): void {
  if (index < steps.value.length - 1) reorderSteps(index, index + 1)
}

// ── Feature #47: Emoji progress tracker helpers ───────────────────────────────

function stepCompletedCount(stepName: string): number {
  return (props.tasksByStep?.[stepName] ?? []).filter(t => t.completed).length
}

function stepTotalCount(stepName: string): number {
  return (props.tasksByStep?.[stepName] ?? []).length
}

// ── Confirm plan ──────────────────────────────────────────────────────────────

async function handleConfirm(): Promise<void> {
  confirmError.value = ''
  confirming.value = true
  try {
    await confirmPlan()
    emit('confirmed', steps.value.map(s => ({ ...s, linkedValues: [...s.linkedValues] })))
  } catch (err) {
    confirmError.value = err instanceof Error ? err.message : String(err)
  } finally {
    confirming.value = false
  }
}

// ── Per-step card copy ────────────────────────────────────────────────────────
// Keyed by step index so each card has independent copied feedback.
// Uses execCommand('copy') on a hidden contenteditable div so the HTML table
// lands on the clipboard and pastes as a real grid in Notes / Keynote / Mail.
const stepCardCopied = ref<Record<number, boolean>>({})
let _stepCopyTimer: Record<number, number> = {}

function copyStepCard(step: { name: string; description?: string; linkedValues: string[]; effortPercent: number }, index: number): void {
  const rows = [
    ['Field', 'Value'],
    ['Step',     step.name],
    ['Impacts',  step.linkedValues.join(', ') || '—'],
    ['Effort',   step.effortPercent + '% of total build'],
    ['Details',  step.description ?? '—'],
  ]

  const TH = (s: string) =>
    `<th style="padding:6px 12px;border:1px solid #cbd5e1;background:#f1f5f9;font-weight:600;text-align:left;white-space:normal">${s}</th>`
  const TD = (s: string) =>
    `<td style="padding:6px 12px;border:1px solid #cbd5e1;vertical-align:top;white-space:normal">${s}</td>`
  const html = `<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px">
    <thead><tr>${rows[0].map(TH).join('')}</tr></thead>
    <tbody>${rows.slice(1).map(r => `<tr>${r.map(TD).join('')}</tr>`).join('')}</tbody>
  </table>`

  const div = document.createElement('div')
  div.setAttribute('contenteditable', 'true')
  div.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none;z-index:-1'
  div.innerHTML = html
  document.body.appendChild(div)
  const sel = window.getSelection()!
  const range = document.createRange()
  range.selectNodeContents(div)
  sel.removeAllRanges()
  sel.addRange(range)
  let ok = false
  try { ok = document.execCommand('copy') } catch { ok = false }
  sel.removeAllRanges()
  document.body.removeChild(div)
  if (!ok) navigator.clipboard.writeText(rows.slice(1).map(r => r.join('\t')).join('\n'))

  stepCardCopied.value = { ...stepCardCopied.value, [index]: true }
  clearTimeout(_stepCopyTimer[index])
  _stepCopyTimer[index] = window.setTimeout(() => {
    stepCardCopied.value = { ...stepCardCopied.value, [index]: false }
  }, 2000)
}
</script>

<template>
  <section class="w-full max-w-7xl mx-auto px-4 py-6">

    <!-- ── Stakeholder context banner (Tom 2026-05-15) ─────────────────────── -->
    <!-- Shows who this plan benefits so the planner never loses sight of the
         stakeholder during Evo step review. Amber = stakes/stakeholder colour.
         Only shown when rawInput.stakes is non-empty. -->
    <div
      v-if="rawInput?.stakes?.trim()"
      class="flex items-center gap-2 mb-3 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 flex-wrap"
      aria-label="Stakeholders this plan is for"
    >
      <span class="text-[10px] font-bold text-amber-700 uppercase tracking-wide shrink-0">👤§ For</span>
      <span class="text-xs text-amber-900 italic">{{ rawInput.stakes }}</span>
      <template v-if="(specBlock.constraints ?? []).length > 0">
        <span class="text-amber-300 select-none">·</span>
        <span class="text-[10px] text-red-700 font-mono shrink-0">
          {{ (specBlock.constraints ?? []).length }}C must be respected
        </span>
      </template>
    </div>

    <!-- ── Visualise strip — one pill per diagram type, each with mini SVG thumbnail ── -->
    <div class="flex items-center gap-0.5 mb-2 -mt-1 flex-wrap">
      <button
        v-for="item in VIZ_STRIP_ITEMS"
        :key="item.tab"
        type="button"
        class="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5
               text-slate-400 hover:text-slate-700 hover:bg-slate-50
               transition-colors duration-100"
        :aria-label="`Open ${item.label} diagram`"
        @click="emit('open-visualise', { tab: item.tab })"
      >
        <span class="block w-7 h-[15px] flex-shrink-0" v-html="VIZ_THUMBS[item.tab]" />
        <span class="text-xs font-semibold tracking-wide whitespace-nowrap">{{ item.label }}</span>
      </button>
      <span class="w-px h-4 bg-slate-200 mx-1 flex-shrink-0" aria-hidden="true" />
      <button
        type="button"
        class="inline-flex items-center gap-1 rounded-lg px-2 py-1.5
               text-slate-400 hover:text-green-700 hover:bg-green-50
               transition-colors duration-100"
        aria-label="Open Evo Value Animation"
        @click="emit('open-evo-simulator')"
      >
        <span class="text-sm leading-none">📈</span>
        <span class="text-xs font-semibold tracking-wide">Simulate</span>
      </button>
    </div>

    <!-- ── Evo Whisper Feature Menu Bar ─────────────────────────────────────── -->
    <div class="flex items-center gap-0.5 mb-4 -mt-2">
      <div v-if="activeEvoMenu !== null" class="fixed inset-0 z-30" aria-hidden="true" @click="activeEvoMenu = null" />
      <div v-for="group in EVO_MENU_GROUPS" :key="group.id" class="relative">
        <button
          type="button"
          :aria-haspopup="true"
          :aria-expanded="activeEvoMenu === group.id"
          :aria-label="group.label"
          class="inline-flex items-center rounded-lg px-2 py-1.5 transition-colors duration-100"
          :class="activeEvoMenu === group.id
            ? 'text-slate-700 bg-slate-100'
            : 'text-slate-300 hover:text-slate-600 hover:bg-slate-50'"
          @mouseenter="hoveredEvoMenu = group.id"
          @mouseleave="hoveredEvoMenu = null"
          @click="activeEvoMenu = activeEvoMenu === group.id ? null : group.id"
        >
          <span class="text-sm leading-none select-none">{{ group.emoji }}</span>
          <span class="text-xs font-semibold tracking-wide ml-1 whitespace-nowrap">{{ group.label }}</span>
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
            style="height:0.6rem;width:0.6rem;flex-shrink:0;opacity:0.4;margin-left:0.1rem"
          ><path fill-rule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06z" /></svg>
        </button>
        <div
          v-show="activeEvoMenu === group.id"
          class="absolute left-0 top-full z-40 mt-1 min-w-[11rem] rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl"
        >
          <button
            v-for="item in group.items"
            :key="item.toggle"
            type="button"
            class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 transition-colors"
            @click="toggleEvoPanel(item.toggle); activeEvoMenu = null; showEvoToast(item.label + ' · see below ↓')"
          >
            <span class="shrink-0 w-5 text-center" aria-hidden="true">{{ item.emoji }}</span>
            {{ item.label }}
          </button>
        </div>
      </div>
    </div>

    <!-- Feature #125 — Spike summary line -->
    <div v-if="totalFlaggedCount > 0" class="text-sm text-orange-600 font-medium mt-2">
      ⚡ {{ totalFlaggedCount }} step(s) flagged for spike investigation
    </div>

    <!-- Feature #64 — Cost estimator panel -->
    <div v-if="steps.length > 0" class="mt-2 mb-4">
      <!-- Expanded panel -->
      <div v-show="costPanelOpen" data-panel="costPanelOpen" class="mt-2 rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <div class="-mx-4 -mt-4 mb-3 flex items-center gap-1.5 px-4 py-2 bg-violet-500 rounded-t-xl">
          <span aria-hidden="true">💰</span>
          <span class="text-xs font-semibold text-white flex-1">Cost Estimate</span>
          <button type="button" aria-label="Collapse Cost" class="text-white/60 hover:text-white text-[10px]" @click="costPanelOpen = false">▲</button>
        </div>
        <!-- Hourly rate input -->
        <div class="flex items-center gap-3">
          <label class="text-xs text-slate-600 whitespace-nowrap">Hourly rate ($/hr)</label>
          <div class="relative flex-1 max-w-[120px]">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
            <input
              v-model.number="hourlyRate"
              type="number"
              min="1"
              max="10000"
              step="10"
              class="w-full pl-7 pr-3 h-10 rounded-lg border border-slate-200 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              aria-label="Hourly rate in dollars"
            />
          </div>
        </div>

        <!-- Per-step cost rows -->
        <div class="space-y-1">
          <div
            v-for="sc in stepCosts"
            :key="sc.stepId"
            class="flex items-center justify-between text-xs"
          >
            <span class="text-slate-600 truncate max-w-[180px]" :title="sc.stepName">{{ sc.stepName }}</span>
            <div class="flex items-center gap-3 shrink-0">
              <span class="text-slate-400">{{ sc.estimatedHours }}h</span>
              <span class="font-mono font-medium text-emerald-700 min-w-[60px] text-right">{{ sc.formattedCost }}</span>
            </div>
          </div>
        </div>

        <!-- Summary banner -->
        <div class="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
          <span class="text-slate-500">Total · {{ stepCosts.length }} steps · avg {{ formattedAverageCost }}/step</span>
          <span class="font-mono font-bold text-emerald-700 text-sm">{{ formattedTotalCost }}</span>
        </div>
      </div>
    </div>

    <!-- Feature #73 — Sprint planner panel -->
    <div v-if="steps.length > 0" class="mt-2 mb-4">
      <!-- Expanded sprint panel -->
      <div v-if="sprintOpen" data-panel="sprintOpen" class="mt-2 rounded-xl border border-violet-200 bg-white p-4 space-y-3">
        <div class="-mx-4 -mt-4 mb-3 flex items-center gap-1.5 px-4 py-2 bg-violet-500 rounded-t-xl">
          <span aria-hidden="true">📅</span>
          <span class="text-xs font-semibold text-white flex-1">Sprint Planner</span>
          <button type="button" aria-label="Collapse Sprint" class="text-white/60 hover:text-white text-[10px]" @click="sprintOpen = false">▲</button>
        </div>
        <!-- Empty state -->
        <div
          v-if="sprints.length === 0"
          class="text-center text-slate-400 text-sm py-4"
          data-testid="sprint-empty"
        >
          No steps planned yet
        </div>

        <!-- Sprint table -->
        <template v-else>
          <div class="overflow-x-auto">
            <table class="w-full text-xs border-collapse">
              <thead>
                <tr class="border-b border-slate-100">
                  <th class="text-left py-2 pr-3 text-slate-500 font-semibold">Sprint</th>
                  <th class="text-left py-2 pr-3 text-slate-500 font-semibold">Dates</th>
                  <th class="text-left py-2 pr-3 text-slate-500 font-semibold">Steps</th>
                  <th class="text-right py-2 text-slate-500 font-semibold">Total Effort</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="sprint in sprints"
                  :key="sprint.sprintNumber"
                  class="border-b border-slate-50"
                >
                  <!-- Sprint name -->
                  <td class="py-2 pr-3 font-semibold text-violet-700 whitespace-nowrap">
                    {{ sprint.name }}
                  </td>
                  <!-- Date range: "Mon DD MMM – Sun DD MMM" -->
                  <td class="py-2 pr-3 text-slate-500 whitespace-nowrap">
                    {{ sprint.startDate.split(' ').slice(0, 3).join(' ') }}
                    –
                    {{ sprint.endDate.split(' ').slice(0, 3).join(' ') }}
                  </td>
                  <!-- Step titles (truncate if >3: "Step A, Step B, +2 more") -->
                  <td class="py-2 pr-3 text-slate-600">
                    <template v-if="sprint.steps.length <= 3">
                      {{ sprint.steps.map(s => s.title).join(', ') }}
                    </template>
                    <template v-else>
                      {{ sprint.steps.slice(0, 3).map(s => s.title).join(', ') }}, +{{ sprint.steps.length - 3 }} more
                    </template>
                  </td>
                  <!-- Total effort -->
                  <td class="py-2 text-right font-mono font-medium text-violet-700 whitespace-nowrap">
                    {{ sprint.totalEffort }} hrs
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Summary row -->
          <div class="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
            <span>{{ sprints.length }} sprint{{ sprints.length !== 1 ? 's' : '' }} · {{ sprints.length * 2 }} weeks total</span>
          </div>

          <!-- Copy button -->
          <div class="flex justify-end">
            <button
              type="button"
              class="flex items-center gap-2 h-11 px-4 text-sm rounded-lg border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors"
              @click="copySprintBoard"
              aria-label="Copy Sprint Board"
            >
              📋 Copy Sprint Board
            </button>
          </div>
        </template>
      </div>
    </div>

    <!-- Feature #150 — Burn-Down Estimator panel -->
    <div v-if="steps.length > 0" class="mt-2 mb-4">
      <div v-if="burnDownOpen" data-panel="burnDownOpen" class="mt-2 rounded-xl border border-indigo-200 bg-white p-4 space-y-3">
        <div class="-mx-4 -mt-4 mb-3 flex items-center gap-1.5 px-4 py-2 bg-amber-500 rounded-t-xl">
          <span aria-hidden="true">📉</span>
          <span class="text-xs font-semibold text-white flex-1">Burn-Down</span>
          <button type="button" aria-label="Collapse Burn Down" class="text-white/60 hover:text-white text-[10px]" @click="burnDownOpen = false">▲</button>
        </div>
        <!-- SVG Burn-Down Chart -->
        <svg
          :viewBox="`0 0 ${BURN_SVG_W} ${BURN_SVG_H}`"
          :width="BURN_SVG_W"
          :height="BURN_SVG_H"
          class="w-full"
          aria-label="Burn-down chart"
          role="img"
        >
          <!-- Y-axis ticks -->
          <g v-for="tick in burnYTicks" :key="tick.value">
            <line
              :x1="BURN_PAD_LEFT"
              :y1="tick.y"
              :x2="BURN_SVG_W - 16"
              :y2="tick.y"
              stroke="#e2e8f0"
              stroke-width="1"
              stroke-dasharray="3 3"
            />
            <text
              :x="BURN_PAD_LEFT - 4"
              :y="tick.y + 4"
              font-size="9"
              text-anchor="end"
              fill="#94a3b8"
            >{{ tick.label }}</text>
          </g>

          <!-- X-axis step labels (rotated -45°) -->
          <g v-for="lbl in burnXLabels" :key="lbl.index">
            <text
              :x="lbl.x"
              :y="BURN_SVG_H - BURN_PAD_BOTTOM + 12"
              font-size="8"
              text-anchor="end"
              fill="#64748b"
              :transform="`rotate(-45, ${lbl.x}, ${BURN_SVG_H - BURN_PAD_BOTTOM + 12})`"
            >{{ lbl.label.length > 10 ? lbl.label.slice(0, 10) + '…' : lbl.label }}</text>
          </g>

          <!-- Today vertical line at x=0 -->
          <line
            :x1="burnTodayX"
            :y1="BURN_PAD_TOP"
            :x2="burnTodayX"
            :y2="BURN_SVG_H - BURN_PAD_BOTTOM"
            stroke="#ef4444"
            stroke-width="1.5"
            stroke-dasharray="4 3"
          />

          <!-- Ideal line (dashed, slate-400) -->
          <polyline
            v-if="idealPolylinePoints"
            :points="idealPolylinePoints"
            fill="none"
            stroke="#94a3b8"
            stroke-width="1.5"
            stroke-dasharray="5 3"
            stroke-linejoin="round"
          />

          <!-- Actual burn-down line (solid, indigo-600) -->
          <polyline
            v-if="actualPolylinePoints"
            :points="actualPolylinePoints"
            fill="none"
            stroke="#4f46e5"
            stroke-width="2"
            stroke-linejoin="round"
            stroke-linecap="round"
          />

          <!-- Axes -->
          <line
            :x1="BURN_PAD_LEFT"
            :y1="BURN_PAD_TOP"
            :x2="BURN_PAD_LEFT"
            :y2="BURN_SVG_H - BURN_PAD_BOTTOM"
            stroke="#cbd5e1"
            stroke-width="1"
          />
          <line
            :x1="BURN_PAD_LEFT"
            :y1="BURN_SVG_H - BURN_PAD_BOTTOM"
            :x2="BURN_SVG_W - 16"
            :y2="BURN_SVG_H - BURN_PAD_BOTTOM"
            stroke="#cbd5e1"
            stroke-width="1"
          />
        </svg>

        <!-- Legend -->
        <div class="flex gap-4 text-xs text-slate-500">
          <span class="flex items-center gap-1">
            <svg width="20" height="8" aria-hidden="true"><line x1="0" y1="4" x2="20" y2="4" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="5 3"/></svg>
            Ideal
          </span>
          <span class="flex items-center gap-1">
            <svg width="20" height="8" aria-hidden="true"><line x1="0" y1="4" x2="20" y2="4" stroke="#4f46e5" stroke-width="2"/></svg>
            Actual
          </span>
          <span class="flex items-center gap-1">
            <svg width="20" height="8" aria-hidden="true"><line x1="10" y1="0" x2="10" y2="8" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="4 2"/></svg>
            Today
          </span>
        </div>

        <!-- Completion date -->
        <div class="flex items-center justify-between text-xs text-slate-600 border-t border-slate-100 pt-2">
          <span>Total effort: <strong class="text-indigo-700">{{ burnTotalEffort }}</strong> points</span>
          <span>Projected completion: <strong class="text-indigo-700">{{ burnCompletionDate }}</strong></span>
          <span :class="burnIsOnTrack ? 'text-emerald-600' : 'text-red-600'" class="font-medium">
            {{ burnIsOnTrack ? '✅ On track' : '⚠️ Off track' }}
          </span>
        </div>

        <!-- Copy button -->
        <div class="flex justify-end">
          <button
            type="button"
            class="flex items-center gap-2 h-11 px-4 text-sm rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
            @click="copyBurnDown"
            aria-label="Copy Burn-Down"
          >
            {{ burnCopied ? '✅ Copied!' : '📋 Copy Burn-Down' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Feature #153 — Retro Themes panel -->
    <div v-if="steps.length > 0" class="mt-2 mb-4">
      <div v-if="retroThemesOpen" data-panel="retroThemesOpen" class="mt-2 rounded-xl border border-pink-200 bg-white p-4 space-y-3">
        <div class="-mx-4 -mt-4 mb-3 flex items-center gap-1.5 px-4 py-2 bg-blue-500 rounded-t-xl">
          <span aria-hidden="true">🎨</span>
          <span class="text-xs font-semibold text-white flex-1">Retro Themes</span>
          <button type="button" aria-label="Collapse Retro Themes" class="text-white/60 hover:text-white text-[10px]" @click="retroThemesOpen = false">▲</button>
        </div>
        <!-- Theme cards -->
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div
            v-for="theme in retroThemes"
            :key="theme.name"
            class="rounded-lg border border-slate-100 bg-slate-50 p-3 space-y-1.5"
          >
            <!-- Theme name badge + count -->
            <div class="flex items-center gap-2">
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-pink-100 text-pink-700 capitalize">
                {{ theme.name }}
              </span>
              <span class="text-xs text-slate-400">{{ theme.count }} step{{ theme.count !== 1 ? 's' : '' }}</span>
            </div>
            <!-- Top prompt -->
            <p class="text-xs text-slate-500 italic">{{ theme.topPrompt }}</p>
            <!-- Step list -->
            <ul v-if="theme.steps.length > 0" class="space-y-0.5">
              <li
                v-for="stepName in theme.steps"
                :key="stepName"
                class="text-xs text-slate-700 truncate"
              >• {{ stepName }}</li>
            </ul>
            <p v-else class="text-xs text-slate-300 italic">No steps assigned</p>
          </div>
        </div>

        <!-- Copy button -->
        <div class="flex justify-end border-t border-slate-100 pt-2">
          <button
            type="button"
            class="flex items-center gap-2 h-11 px-4 text-sm rounded-lg border border-pink-200 bg-pink-50 text-pink-700 hover:bg-pink-100 transition-colors"
            @click="copyRetroThemes"
            aria-label="Copy Themes"
          >
            {{ retroThemesCopied ? '✅ Copied!' : '📋 Copy Themes' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Feature #158 (new) — Team Mood Summary panel -->
    <div v-if="steps.length > 0" class="mt-2 mb-4">
      <div v-if="moodPanelOpen" data-panel="moodPanelOpen" data-testid="team-mood-panel" class="mt-2 rounded-xl border border-orange-200 bg-white p-4 space-y-3">
        <div class="-mx-4 -mt-4 mb-3 flex items-center gap-1.5 px-4 py-2 bg-blue-500 rounded-t-xl">
          <span aria-hidden="true">😊</span>
          <span class="text-xs font-semibold text-white flex-1">Team Mood</span>
          <button type="button" aria-label="Collapse Mood" class="text-white/60 hover:text-white text-[10px]" @click="moodPanelOpen = false">▲</button>
        </div>
        <!-- 4 emoji columns with step counts -->
        <div class="grid grid-cols-4 gap-2">
          <div
            v-for="emoji in moodEmojis"
            :key="emoji"
            class="flex flex-col items-center p-2 rounded-lg border"
            :class="emoji === dominantMood ? 'border-indigo-300 bg-indigo-50' : 'border-slate-100 bg-slate-50'"
            :data-testid="`team-mood-col-${emoji}`"
          >
            <span class="text-2xl leading-none mb-1">{{ emoji }}</span>
            <span class="text-xs font-semibold text-slate-700">
              {{ steps.filter((_, i) => getMood(`step-${i}`, steps[i].title ?? steps[i].name) === emoji).length }}
            </span>
            <span class="text-xs text-slate-400">{{ moodLabel(emoji) }}</span>
          </div>
        </div>

        <!-- Copy markdown button -->
        <div class="flex justify-end border-t border-slate-100 pt-2">
          <button
            type="button"
            class="flex items-center gap-2 h-11 px-4 text-sm rounded-lg border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors"
            aria-label="Copy Mood Markdown"
            data-testid="team-mood-copy"
            @click="() => { const md = copyMoodMd(steps.map((s, i) => ({ id: `step-${i}`, title: s.title ?? s.name }))); if (typeof navigator !== 'undefined' && navigator.clipboard) { navigator.clipboard.writeText(md).catch(() => {}) } }"
          >
            📋 Copy Mood Markdown
          </button>
        </div>
      </div>
    </div>

    <!-- Feature #160 — Pair Rotation panel -->
    <div v-if="steps.length > 0" class="mt-2 mb-4">
      <div v-show="pairRotationOpen" data-panel="pairRotationOpen" class="border border-slate-200 rounded-lg overflow-hidden">
        <div v-if="pairRotationOpen" class="p-4 bg-white space-y-3">
          <div class="-mx-4 -mt-4 mb-3 flex items-center gap-1.5 px-4 py-2 bg-emerald-500"><span aria-hidden="true">🔄</span><span class="text-xs font-semibold text-white flex-1">Pair Rotation</span><button type="button" aria-label="Collapse Pair Rotation" class="text-white/60 hover:text-white text-[10px]" @click="pairRotationOpen = false">▲</button></div>
          <!-- Next rotation suggestion -->
          <div v-if="pairNextRotation.length > 0" class="rounded-lg bg-teal-50 border border-teal-200 p-3">
            <p class="text-xs font-semibold text-teal-700 mb-1">🔁 Next rotation:</p>
            <div v-for="pair in pairNextRotation" :key="pair.stepA + pair.stepB" class="text-xs text-teal-600">
              {{ pair.stepAName }} ↔ {{ pair.stepBName }}
            </div>
          </div>
          <!-- All pairs table -->
          <div class="overflow-x-auto">
            <table class="w-full text-xs text-slate-700">
              <thead><tr class="border-b text-left"><th class="py-1 pr-2 font-semibold">Step A</th><th class="py-1 pr-2 font-semibold">Step B</th><th class="py-1 font-semibold">Count</th></tr></thead>
              <tbody>
                <tr v-for="pair in pairAllPairs" :key="pair.stepA + pair.stepB" class="border-b last:border-0">
                  <td class="py-1.5 pr-2">{{ pair.stepAName }}</td>
                  <td class="py-1.5 pr-2">{{ pair.stepBName }}</td>
                  <td class="py-1.5">{{ pair.pairCount }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <!-- Pair debt -->
          <div v-if="pairDebtList.length > 0">
            <p class="text-xs font-semibold text-slate-600 mb-1">Pair Debt</p>
            <div class="space-y-1">
              <div v-for="d in pairDebtList" :key="d.stepId" class="flex items-center gap-2 text-xs">
                <span class="flex-1 text-slate-700">{{ d.stepName }}</span>
                <span v-if="d.leastRecentlyPaired" class="text-xs bg-amber-100 text-amber-700 rounded px-2 py-0.5">⚠ Due</span>
                <span v-else class="text-xs bg-slate-100 text-slate-500 rounded px-2 py-0.5">OK</span>
              </div>
            </div>
          </div>
          <button aria-label="Copy Pair Rotation" @click="copyPairRotation()" class="text-xs text-slate-500 hover:underline mt-1">{{ pairRotationCopied ? '✅ Copied!' : '📋 Copy Markdown' }}</button>
        </div>
      </div>
    </div>

    <!-- Feature #165 — Flow Efficiency panel -->
    <div v-if="steps.length > 0" class="mt-2 mb-4">
      <div v-show="flowOpen" data-panel="flowOpen" class="border border-slate-200 rounded-lg overflow-hidden">
        <div v-if="flowOpen" class="p-4 bg-white space-y-3">
          <div class="-mx-4 -mt-4 mb-3 flex items-center gap-1.5 px-4 py-2 bg-blue-500"><span aria-hidden="true">🌊</span><span class="text-xs font-semibold text-white flex-1">Flow Efficiency</span><button type="button" aria-label="Collapse Flow" class="text-white/60 hover:text-white text-[10px]" @click="flowOpen = false">▲</button></div>
          <!-- Summary -->
          <p class="text-sm" :class="bottleneckCount > 0 ? 'text-amber-600 font-medium' : 'text-slate-600'">
            Average: {{ avgFlowEfficiency }}% | ⚠ {{ bottleneckCount }} bottleneck{{ bottleneckCount !== 1 ? 's' : '' }}
          </p>
          <!-- Stacked bar chart -->
          <svg viewBox="0 0 480 200" class="w-full" aria-label="Flow efficiency chart">
            <g v-for="(s, i) in flowSteps" :key="s.stepId">
              <!-- Step label -->
              <text :x="0" :y="20 * (i + 1)" text-anchor="start" font-size="8" fill="#475569">{{ s.stepTitle.slice(0, 10) }}</text>
              <!-- Active bar (emerald) -->
              <rect
                :x="40"
                :y="20 * (i + 1) - 7"
                :width="(s.effort / (s.effort + s.idleTime)) * 400"
                height="8"
                fill="#10b981"
              />
              <!-- Idle bar (red, opacity 0.7) -->
              <rect
                :x="40 + (s.effort / (s.effort + s.idleTime)) * 400"
                :y="20 * (i + 1) - 7"
                :width="(s.idleTime / (s.effort + s.idleTime)) * 400"
                height="8"
                fill="#ef4444"
                opacity="0.7"
              />
              <!-- Efficiency % label -->
              <text
                :x="40 + 400 + 4"
                :y="20 * (i + 1)"
                text-anchor="start"
                font-size="8"
                fill="#475569"
              >{{ s.flowEfficiency }}%</text>
              <!-- Bottleneck marker -->
              <text v-if="s.isBottleneck" x="445" :y="20 * (i + 1)" font-size="10">⚠️</text>
            </g>
            <!-- Legend -->
            <rect x="40" :y="20 * (flowSteps.length + 1) + 2" width="10" height="8" fill="#10b981" />
            <text :x="53" :y="20 * (flowSteps.length + 1) + 9" font-size="8" fill="#475569">Active</text>
            <rect x="90" :y="20 * (flowSteps.length + 1) + 2" width="10" height="8" fill="#ef4444" opacity="0.7" />
            <text :x="103" :y="20 * (flowSteps.length + 1) + 9" font-size="8" fill="#475569">Idle</text>
          </svg>
          <!-- Copy button -->
          <button aria-label="Copy Flow" @click="copyFlowMd()" class="text-xs text-slate-500 hover:underline mt-1">{{ flowCopied ? '✅ Copied!' : '📋 Copy Markdown' }}</button>
        </div>
      </div>
    </div>

    <!-- Feature #168 — Uncertainty Cone panel -->
    <div v-if="steps.length > 0" class="mt-2 mb-4">
      <div v-show="coneOpen" data-panel="coneOpen" class="border border-slate-200 rounded-lg overflow-hidden">
        <div v-if="coneOpen" class="p-4 bg-white space-y-3">
          <div class="-mx-4 -mt-4 mb-3 flex items-center gap-1.5 px-4 py-2 bg-blue-500"><span aria-hidden="true">🔺</span><span class="text-xs font-semibold text-white flex-1">Uncertainty Cone</span><button type="button" aria-label="Collapse Cone" class="text-white/60 hover:text-white text-[10px]" @click="coneOpen = false">▲</button></div>
          <!-- Overall confidence -->
          <p class="text-2xl font-bold"
            :class="overallConfidence >= 70 ? 'text-emerald-600' : overallConfidence >= 40 ? 'text-amber-600' : 'text-red-600'"
          >
            Overall confidence: {{ overallConfidence }}%
          </p>
          <!-- Cone SVG chart -->
          <svg viewBox="0 0 480 240" class="w-full" aria-label="Uncertainty cone chart">
            <!-- Filled cone area -->
            <polygon
              v-if="conePoints.length > 0"
              :points="[
                ...conePoints.map((p, i) => `${20 + i * (420 / Math.max(conePoints.length - 1, 1))},${120 - p.upperBound * 2}`),
                ...conePoints.slice().reverse().map((p, ri) => {
                  const i = conePoints.length - 1 - ri
                  return `${20 + i * (420 / Math.max(conePoints.length - 1, 1))},${120 + p.lowerBound * 2}`
                })
              ].join(' ')"
              fill="#fef3c7"
              opacity="0.5"
            />
            <!-- Midline -->
            <line x1="20" y1="120" x2="460" y2="120" stroke="#94a3b8" stroke-dasharray="4 2" />
            <!-- Upper cone edge -->
            <polyline
              v-if="conePoints.length > 0"
              :points="conePoints.map((p, i) => `${20 + i * (420 / Math.max(conePoints.length - 1, 1))},${120 - p.upperBound * 2}`).join(' ')"
              fill="none"
              stroke="#d97706"
              stroke-dasharray="4 2"
              stroke-width="1.5"
            />
            <!-- Lower cone edge -->
            <polyline
              v-if="conePoints.length > 0"
              :points="conePoints.map((p, i) => `${20 + i * (420 / Math.max(conePoints.length - 1, 1))},${120 + p.lowerBound * 2}`).join(' ')"
              fill="none"
              stroke="#d97706"
              stroke-dasharray="4 2"
              stroke-width="1.5"
            />
            <!-- Per-step markers and labels -->
            <g v-for="(p, i) in conePoints" :key="p.stepIndex">
              <!-- Completed step: solid emerald vertical line -->
              <line
                v-if="p.completed"
                :x1="20 + i * (420 / Math.max(conePoints.length - 1, 1))"
                y1="80"
                :x2="20 + i * (420 / Math.max(conePoints.length - 1, 1))"
                y2="160"
                stroke="#10b981"
                stroke-width="1.5"
              />
              <!-- Confidence % above upper point -->
              <text
                :x="20 + i * (420 / Math.max(conePoints.length - 1, 1))"
                :y="120 - p.upperBound * 2 - 4"
                text-anchor="middle"
                font-size="8"
                fill="#475569"
              >{{ p.confidence }}%</text>
              <!-- Step label at bottom -->
              <text
                :x="20 + i * (420 / Math.max(conePoints.length - 1, 1))"
                y="235"
                text-anchor="middle"
                font-size="8"
                fill="#475569"
                :transform="`rotate(-30, ${20 + i * (420 / Math.max(conePoints.length - 1, 1))}, 235)`"
              >{{ p.stepTitle }}</text>
            </g>
            <!-- Legend -->
            <line x1="20" y1="215" x2="40" y2="215" stroke="#d97706" stroke-dasharray="4 2" stroke-width="1.5" />
            <text x="44" y="219" font-size="8" fill="#475569">Uncertainty range</text>
            <line x1="160" y1="210" x2="160" y2="220" stroke="#10b981" stroke-width="1.5" />
            <text x="164" y="219" font-size="8" fill="#475569">Completed</text>
          </svg>
          <!-- Copy button -->
          <button aria-label="Copy Cone" @click="() => { const md = copyConeMd(); navigator.clipboard?.writeText(md) }" class="text-xs text-slate-500 hover:underline mt-1">📋 Copy Markdown</button>
        </div>
      </div>
    </div>

    <!-- Feature #173 — Mood × Velocity Correlation panel -->
    <div v-if="steps.length > 0" class="mt-2 mb-4">
      <div v-show="moodVelocityOpen" data-panel="moodVelocityOpen" class="border border-slate-200 rounded-lg overflow-hidden">
        <div v-if="moodVelocityOpen" class="p-4 bg-white space-y-3">
          <div class="-mx-4 -mt-4 mb-3 flex items-center gap-1.5 px-4 py-2 bg-blue-500"><span aria-hidden="true">📈</span><span class="text-xs font-semibold text-white flex-1">Mood Velocity</span><button type="button" aria-label="Collapse Mood Velocity" class="text-white/60 hover:text-white text-[10px]" @click="moodVelocityOpen = false">▲</button></div>
          <!-- Scatter plot SVG -->
          <svg viewBox="0 0 320 220" class="w-full" aria-label="Mood vs velocity scatter plot">
            <!-- Y-axis label -->
            <text x="10" y="115" font-size="9" fill="#64748b" text-anchor="middle" transform="rotate(-90,10,115)">Velocity</text>
            <!-- X-axis ticks and emoji labels (mood 1–4) -->
            <g v-for="m in [1, 2, 3, 4]" :key="m">
              <line
                :x1="40 + (m - 1) * 60"
                y1="190"
                :x2="40 + (m - 1) * 60"
                y2="195"
                stroke="#94a3b8"
                stroke-width="1"
              />
              <text
                :x="40 + (m - 1) * 60"
                y="210"
                text-anchor="middle"
                font-size="12"
              >{{ m === 1 ? '😰' : m === 2 ? '😐' : m === 3 ? '😊' : '🤩' }}</text>
            </g>
            <!-- Y-axis ticks (0, 2, 4, 6, 8, 10) -->
            <g v-for="v in [0, 2, 4, 6, 8, 10]" :key="v">
              <line
                x1="35"
                :y1="185 - v * 17"
                x2="40"
                :y2="185 - v * 17"
                stroke="#94a3b8"
                stroke-width="1"
              />
              <text
                x="32"
                :y="185 - v * 17 + 3"
                text-anchor="end"
                font-size="8"
                fill="#64748b"
              >{{ v }}</text>
            </g>
            <!-- Axis lines -->
            <line x1="40" y1="15" x2="40" y2="190" stroke="#94a3b8" stroke-width="1" />
            <line x1="40" y1="190" x2="300" y2="190" stroke="#94a3b8" stroke-width="1" />
            <!-- Regression line (amber-400) -->
            <line
              v-if="mvPoints.length >= 2"
              :x1="40 + (1 - 1) * 60"
              :y1="185 - (mvPoints.reduce((s,p)=>s+p.velocity,0)/mvPoints.length - mvCorrelation * (Math.sqrt(mvPoints.reduce((s,p)=>s+(p.velocity-mvPoints.reduce((ss,pp)=>ss+pp.velocity,0)/mvPoints.length)**2,0)/mvPoints.length) / Math.sqrt(mvPoints.reduce((s,p)=>s+(p.mood-mvPoints.reduce((ss,pp)=>ss+pp.mood,0)/mvPoints.length)**2,0)/mvPoints.length)) * (1 - mvPoints.reduce((s,p)=>s+p.mood,0)/mvPoints.length)) * 17"
              :x2="40 + (4 - 1) * 60"
              :y2="185 - (mvPoints.reduce((s,p)=>s+p.velocity,0)/mvPoints.length - mvCorrelation * (Math.sqrt(mvPoints.reduce((s,p)=>s+(p.velocity-mvPoints.reduce((ss,pp)=>ss+pp.velocity,0)/mvPoints.length)**2,0)/mvPoints.length) / Math.sqrt(mvPoints.reduce((s,p)=>s+(p.mood-mvPoints.reduce((ss,pp)=>ss+pp.mood,0)/mvPoints.length)**2,0)/mvPoints.length)) * (4 - mvPoints.reduce((s,p)=>s+p.mood,0)/mvPoints.length)) * 17"
              stroke="#fbbf24"
              stroke-width="1.5"
              stroke-dasharray="4 2"
            />
            <!-- Data points -->
            <g v-for="pt in mvPoints" :key="pt.stepId">
              <circle
                :cx="40 + (pt.mood - 1) * 60"
                :cy="185 - pt.velocity * 17"
                r="6"
                fill="#6366f1"
                opacity="0.85"
              >
                <title>{{ pt.stepTitle }}</title>
              </circle>
            </g>
          </svg>
          <!-- Correlation badge -->
          <div class="flex items-center gap-2 flex-wrap">
            <span
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
              :class="mvCorrelation > 0.3 ? 'bg-emerald-100 text-emerald-700' : mvCorrelation < -0.3 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'"
            >
              r = {{ mvCorrelation }}
            </span>
            <span class="text-xs text-slate-600">{{ mvCorrelationLabel }}</span>
          </div>
          <!-- Copy button -->
          <button
            type="button"
            aria-label="Copy Mood Velocity"
            class="text-xs text-slate-500 hover:underline mt-1"
            @click="copyMvMarkdown()"
          >
            {{ mvCopied ? '✅ Copied!' : '📋 Copy Markdown' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Feature #86 — WSJF Scorer panel -->
    <div v-if="steps.length > 0" class="mt-2 mb-4">
      <!-- Toggle button -->
      <!-- Expanded WSJF panel -->
      <div v-if="wsjfOpen" data-panel="wsjfOpen" class="mt-2 rounded-xl border border-orange-200 bg-white p-4 space-y-3">
        <div class="-mx-4 -mt-4 mb-3 flex items-center gap-1.5 px-4 py-2 bg-blue-500 rounded-t-xl"><span aria-hidden="true">🥇</span><span class="text-xs font-semibold text-white flex-1">WSJF Priority</span><button type="button" aria-label="Collapse WSJF" class="text-white/60 hover:text-white text-[10px]" @click="wsjfOpen = false">▲</button></div>
        <!-- Header -->
        <h3 class="text-sm font-semibold text-slate-700">WSJF Prioritisation — Cost of Delay ÷ Job Duration</h3>

        <!-- Empty state -->
        <div
          v-if="wsjfEntries.length === 0"
          class="text-center text-slate-400 text-sm py-4"
          data-testid="wsjf-empty"
        >
          No steps planned yet
        </div>

        <!-- WSJF table -->
        <template v-else>
          <div class="overflow-x-auto">
            <table class="w-full text-xs border-collapse">
              <thead>
                <tr class="border-b border-slate-100">
                  <th class="text-left py-2 pr-3 text-slate-500 font-semibold">Rank</th>
                  <th class="text-left py-2 pr-3 text-slate-500 font-semibold">Step</th>
                  <th class="text-left py-2 pr-3 text-slate-500 font-semibold">CoD</th>
                  <th class="text-left py-2 pr-3 text-slate-500 font-semibold">Duration (weeks)</th>
                  <th class="text-right py-2 text-slate-500 font-semibold">WSJF</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="entry in wsjfEntries"
                  :key="entry.stepId"
                  class="border-b border-slate-50"
                >
                  <!-- Rank -->
                  <td class="py-2 pr-3 font-semibold text-orange-700 whitespace-nowrap">
                    {{ entry.rank }}
                  </td>
                  <!-- Step title (truncated) -->
                  <td class="py-2 pr-3 text-slate-700 max-w-[140px] truncate" :title="entry.title">
                    {{ entry.title.length > 22 ? entry.title.slice(0, 22) + '…' : entry.title }}
                    <span
                      v-if="entry.rank === 1"
                      class="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-700"
                    >→ Next</span>
                  </td>
                  <!-- CoD input -->
                  <td class="py-2 pr-3">
                    <input
                      type="number"
                      min="1"
                      max="10"
                      :value="codInputs[entry.stepId]"
                      class="h-8 w-16 rounded border border-slate-200 px-2 text-xs text-slate-700 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
                      :aria-label="`Cost of Delay for ${entry.title}`"
                      :data-testid="`wsjf-cod-${entry.stepId}`"
                      @change="setCod(entry.stepId, Number(($event.target as HTMLInputElement).value))"
                    />
                  </td>
                  <!-- Duration -->
                  <td class="py-2 pr-3 text-slate-400 whitespace-nowrap">
                    {{ entry.jobDuration.toFixed(1) }}
                  </td>
                  <!-- WSJF score with colour coding -->
                  <td class="py-2 text-right font-bold whitespace-nowrap"
                    :class="entry.wsjf >= 3
                      ? 'text-emerald-600'
                      : entry.wsjf >= 1.5
                        ? 'text-amber-500'
                        : 'text-red-500'"
                  >
                    {{ entry.wsjf }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Summary banner: rank-1 step -->
          <div class="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700">
            <span class="font-semibold">Start with:</span>
            <span>{{ wsjfEntries[0]?.title }}</span>
          </div>

          <!-- Copy button -->
          <div class="flex justify-end">
            <button
              type="button"
              class="flex items-center gap-2 h-11 px-4 text-sm rounded-lg border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors"
              @click="copyWsjfTable"
              aria-label="Copy WSJF Table"
            >
              📋 Copy WSJF Table
            </button>
          </div>
        </template>
      </div>
    </div>

    <!-- Feature #101 — Capacity Planner panel -->
    <div v-if="steps.length > 0" class="mt-2 mb-4">
      <!-- Toggle button -->
      <!-- Expanded capacity panel -->
      <div v-if="capacityOpen" data-panel="capacityOpen" class="mt-2 rounded-xl border border-rose-200 bg-white p-4 space-y-3">
        <div class="-mx-4 -mt-4 mb-3 flex items-center gap-1.5 px-4 py-2 bg-violet-500 rounded-t-xl"><span aria-hidden="true">⚗️</span><span class="text-xs font-semibold text-white flex-1">Capacity</span><button type="button" aria-label="Collapse Capacity" class="text-white/60 hover:text-white text-[10px]" @click="capacityOpen = false">▲</button></div>
        <!-- Header row: capacity input + over-capacity warning -->
        <div class="flex flex-wrap items-center gap-3">
          <label class="text-xs text-slate-600 whitespace-nowrap">Team capacity:</label>
          <input
            v-model.number="hrPerWeek"
            type="number"
            min="1"
            max="160"
            class="h-8 w-20 rounded border border-slate-200 px-2 text-xs text-slate-700 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200"
            aria-label="Team capacity in hours per week"
          />
          <span class="text-xs text-slate-600">hrs/week</span>
          <span
            v-if="overCapacityCount > 0"
            class="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-100 border border-red-300 text-red-700 text-xs font-semibold"
            role="alert"
            data-testid="over-capacity-warning"
          >
            ⚠ {{ overCapacityCount }} week{{ overCapacityCount !== 1 ? 's' : '' }} over capacity
          </span>
        </div>

        <!-- Empty state -->
        <div
          v-if="capacityWeeks.every(w => w.required === 0)"
          class="text-center text-slate-400 text-sm py-4"
          data-testid="capacity-empty"
        >
          No steps planned yet
        </div>

        <!-- SVG bar chart -->
        <template v-else>
          <div class="overflow-x-auto">
            <svg
              viewBox="0 0 480 200"
              width="480"
              height="200"
              aria-label="Weekly capacity bar chart"
              role="img"
            >
              <!-- Y-axis labels: 0, 20, 40 hrs (scaled to chart area height 160) -->
              <!-- Chart area: x=32..480, y=8..168 (height=160, width=448) -->
              <text x="28" y="172" font-size="9" text-anchor="end" fill="#94a3b8">0</text>
              <text x="28" y="118" font-size="9" text-anchor="end" fill="#94a3b8">20</text>
              <text x="28" y="63" font-size="9" text-anchor="end" fill="#94a3b8">40</text>

              <!-- Y-axis grid lines -->
              <line x1="32" y1="168" x2="476" y2="168" stroke="#e2e8f0" stroke-width="1"/>
              <line x1="32" y1="115" x2="476" y2="115" stroke="#e2e8f0" stroke-width="0.5" stroke-dasharray="3,3"/>
              <line x1="32" y1="62" x2="476" y2="62" stroke="#e2e8f0" stroke-width="0.5" stroke-dasharray="3,3"/>

              <!-- Per-week columns: 8 columns × (50px wide + 8px gap) = 464px total -->
              <!-- Column x positions: 32 + i*(50+8) -->
              <g v-for="(week, i) in capacityWeeks" :key="week.weekLabel">
                <!-- Column x = 32 + i*58; chart base y=168; max chart height=160 -->
                <!-- Available bar (full hrPerWeek height) -->
                <!-- Scale: 40 hrs → 160px; so 1hr = 4px. Chart max = 160px at y=8 -->
                <!-- Bar height for available = min(hrPerWeek, 40) / 40 * 160 (cap visual at 40) -->
                <rect
                  :x="32 + i * 58"
                  :y="168 - Math.min(week.available, 40) / 40 * 160"
                  width="50"
                  :height="Math.min(week.available, 40) / 40 * 160"
                  :fill="week.overCapacity ? '#fecaca' : '#e2e8f0'"
                  :stroke="week.overCapacity ? '#f87171' : 'none'"
                  stroke-width="1"
                  rx="2"
                />

                <!-- Required bars: stacked slices per step contribution -->
                <g v-if="week.required > 0">
                  <!-- Stack from bottom; track cumulative offset -->
                  <rect
                    v-for="(contrib, ci) in week.stepContributions"
                    :key="ci"
                    :x="32 + i * 58"
                    :y="168 - Math.min(week.stepContributions.slice(0, ci + 1).reduce((s, c) => s + c.hours, 0), 40) / 40 * 160"
                    width="50"
                    :height="Math.min(contrib.hours, Math.max(0, 40 - week.stepContributions.slice(0, ci).reduce((s, c) => s + c.hours, 0))) / 40 * 160"
                    :fill="contrib.colour"
                    :opacity="week.overCapacity ? 0.85 : 0.75"
                    rx="2"
                  />
                </g>

                <!-- Week label below column -->
                <text
                  :x="32 + i * 58 + 25"
                  y="186"
                  font-size="9"
                  text-anchor="middle"
                  fill="#64748b"
                >{{ week.weekLabel }}</text>
              </g>
            </svg>
          </div>

          <!-- Copy button -->
          <div class="flex justify-end">
            <button
              type="button"
              class="flex items-center gap-2 h-11 px-4 text-sm rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors"
              @click="copyCapacityPlan"
              aria-label="Copy Capacity Plan"
            >
              📋 Copy Capacity Plan
            </button>
          </div>
        </template>
      </div>
    </div>

    <!-- Feature #128 — WIP Limit panel -->
    <div v-if="steps.length > 0" class="mt-2 mb-4">
      <div v-show="wipOpen" data-panel="wipOpen" class="border border-slate-200 rounded-lg overflow-hidden">
        <div v-if="wipOpen" class="p-4 space-y-3 bg-white">
          <div class="-mx-4 -mt-4 mb-3 flex items-center gap-1.5 px-4 py-2 bg-violet-500"><span aria-hidden="true">🚦</span><span class="text-xs font-semibold text-white flex-1">WIP Limit</span><button type="button" aria-label="Collapse WIP" class="text-white/60 hover:text-white text-[10px]" @click="wipOpen = false">▲</button></div>
          <div class="flex items-center gap-3">
            <span class="text-xs text-slate-600">Limit:</span>
            <button aria-label="Decrease Limit" @click="decreaseLimit" class="h-8 w-8 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold">−</button>
            <span class="text-sm font-semibold w-4 text-center">{{ wipLimit }}</span>
            <button aria-label="Increase Limit" @click="increaseLimit" class="h-8 w-8 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold">+</button>
          </div>
          <div v-if="status.overLimit" class="rounded-lg bg-red-50 border border-red-200 p-3 text-sm">
            <p class="font-semibold text-red-700 mb-1">⚠️ WIP limit exceeded by {{ status.activeCount - wipLimit }}</p>
            <p class="text-xs text-red-600 mb-2">Suggested steps to pause (lowest priority):</p>
            <ul class="space-y-0.5">
              <li v-for="name in status.pauseSuggestions" :key="name" class="text-xs text-red-700">• {{ name }}</li>
            </ul>
          </div>
          <div v-else class="text-sm text-emerald-700">✅ Within WIP limit</div>
          <button aria-label="Copy WIP Status" @click="copyWip" class="text-xs text-slate-500 hover:text-slate-700 hover:underline">
            {{ wipCopied ? '✅ Copied!' : '📋 Copy status' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Feature #130 — Energy Forecast panel -->
    <div class="mt-3">
      <div v-if="energyForecastOpen" data-panel="energyForecastOpen" class="mt-2 p-4 bg-white border border-orange-200 rounded-lg">
        <div class="-mx-4 -mt-4 mb-3 flex items-center gap-1.5 px-4 py-2 bg-amber-500 rounded-t-lg"><span aria-hidden="true">⚡</span><span class="text-xs font-semibold text-white flex-1">Energy Forecast</span><button type="button" aria-label="Collapse Energy Forecast" class="text-white/60 hover:text-white text-[10px]" @click="energyForecastOpen = false">▲</button></div>
        <svg width="500" height="140" viewBox="0 30 500 140" class="w-full">
          <!-- Y-axis labels -->
          <text x="5" y="25" class="text-xs fill-emerald-600" font-size="10">🔥 High</text>
          <text x="5" y="65" class="text-xs fill-amber-500" font-size="10">😐 Mid</text>
          <text x="5" y="105" class="text-xs fill-red-400" font-size="10">😴 Low</text>
          <!-- Grid lines -->
          <line x1="30" y1="20" x2="490" y2="20" stroke="#d1fae5" stroke-width="1" stroke-dasharray="4"/>
          <line x1="30" y1="60" x2="490" y2="60" stroke="#fef3c7" stroke-width="1" stroke-dasharray="4"/>
          <line x1="30" y1="100" x2="490" y2="100" stroke="#fee2e2" stroke-width="1" stroke-dasharray="4"/>
          <!-- Forecast line -->
          <polyline
            :points="energySvgPoints"
            fill="none"
            stroke="#f97316"
            stroke-width="2.5"
            stroke-linejoin="round"
          />
          <!-- Data points -->
          <circle
            v-for="pt in energyForecastPoints"
            :key="pt.stepIndex"
            :cx="30 + pt.stepIndex * (460 / Math.max(energyForecastPoints.length - 1, 1))"
            :cy="pt.svgY"
            r="5"
            :fill="pt.forecastLevel === 'high' ? '#10b981' : pt.forecastLevel === 'mid' ? '#f59e0b' : '#ef4444'"
          />
        </svg>
        <!-- Warning -->
        <div v-if="hasEnergyWarning" class="mt-2 text-sm text-orange-700 bg-orange-50 border border-orange-200 rounded p-2">
          ⚠️ Energy forecast dips to low at step(s): {{ energyWarningIndices.map(i => steps[i]?.name ?? `Step ${i+1}`).join(', ') }}. Consider scheduling a buffer or retrospective.
        </div>
        <!-- Legend -->
        <div class="flex gap-4 mt-2 text-xs text-gray-500">
          <span>🔥 High energy</span>
          <span>😐 Mid energy</span>
          <span>😴 Low energy</span>
        </div>
      </div>
    </div>

    <!-- Feature #133 — Knowledge Graph panel -->
    <div class="mt-3">
      <div v-if="kgOpen" data-panel="kgOpen" class="mt-2 p-4 bg-white border border-purple-200 rounded-lg overflow-x-auto">
        <div class="-mx-4 -mt-4 mb-3 flex items-center gap-1.5 px-4 py-2 bg-emerald-500 rounded-t-lg"><span aria-hidden="true">🕸️</span><span class="text-xs font-semibold text-white flex-1">Knowledge Graph</span><button type="button" aria-label="Collapse Knowledge Graph" class="text-white/60 hover:text-white text-[10px]" @click="kgOpen = false">▲</button></div>
        <svg width="520" height="320" viewBox="0 0 520 320">
          <!-- Edges -->
          <line
            v-for="(edge, ei) in kgEdges"
            :key="ei"
            :x1="kgNodeMap[edge.from]?.x ?? 0"
            :y1="kgNodeMap[edge.from]?.y ?? 0"
            :x2="kgNodeMap[edge.to]?.x ?? 0"
            :y2="kgNodeMap[edge.to]?.y ?? 0"
            stroke="#c4b5fd"
            stroke-width="1.5"
          />
          <!-- Nodes -->
          <g v-for="node in kgNodes" :key="node.id">
            <circle
              :cx="node.x" :cy="node.y" :r="node.radius"
              :fill="node.type === 'step' ? '#7c3aed' : '#10b981'"
              opacity="0.85"
            />
            <text
              :x="node.x" :y="node.y + 4"
              text-anchor="middle"
              font-size="8"
              fill="white"
              class="select-none"
            >{{ node.label }}</text>
          </g>
        </svg>
        <!-- Legend -->
        <div class="flex gap-4 mt-2 text-xs text-gray-500">
          <span><span class="inline-block w-3 h-3 rounded-full bg-violet-700 mr-1"></span>Evo step</span>
          <span><span class="inline-block w-3 h-3 rounded-full bg-emerald-500 mr-1"></span>V. entry</span>
        </div>
      </div>
    </div>

    <!-- Feature #130 spec — Energy Forecast panel (spec-compliant collapsible) -->
    <div v-if="steps.length > 0" class="mt-2 mb-4">
      <div v-show="forecastOpen" data-panel="forecastOpen" class="border border-slate-200 rounded-lg overflow-hidden">
        <div v-if="forecastOpen" class="p-4 bg-white space-y-3">
          <div class="-mx-4 -mt-4 mb-3 flex items-center gap-1.5 px-4 py-2 bg-amber-500"><span aria-hidden="true">🧠</span><span class="text-xs font-semibold text-white flex-1">Forecast</span><button type="button" aria-label="Collapse Forecast" class="text-white/60 hover:text-white text-[10px]" @click="forecastOpen = false">▲</button></div>
          <!-- SVG trend line -->
          <svg
            :viewBox="`0 0 ${svgWidth} ${svgHeight}`"
            :width="svgWidth"
            :height="svgHeight"
            class="w-full"
            aria-hidden="true"
          >
            <!-- Grid lines -->
            <line x1="0" y1="16" :x2="svgWidth" y2="16" stroke="#6ee7b7" stroke-width="1" stroke-dasharray="4 2" opacity="0.5"/>
            <line x1="0" y1="40" :x2="svgWidth" y2="40" stroke="#fbbf24" stroke-width="1" stroke-dasharray="4 2" opacity="0.5"/>
            <line x1="0" y1="64" :x2="svgWidth" y2="64" stroke="#f87171" stroke-width="1" stroke-dasharray="4 2" opacity="0.5"/>
            <!-- Labels -->
            <text x="4" y="14" font-size="9" fill="#059669">🔥</text>
            <text x="4" y="38" font-size="9" fill="#d97706">😐</text>
            <text x="4" y="62" font-size="9" fill="#dc2626">😴</text>
            <!-- Forecast polyline -->
            <polyline
              :points="svgPoints"
              fill="none"
              stroke="#6366f1"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <!-- Data points -->
            <circle
              v-for="(pt, i) in forecastPoints"
              :key="i"
              :cx="i * 60 + 30"
              :cy="yForLevel(pt.forecastLevel)"
              r="4"
              :fill="pt.numericValue <= 1.2 ? '#ef4444' : pt.numericValue >= 2.5 ? '#10b981' : '#f59e0b'"
            />
          </svg>
          <!-- Step list with forecast -->
          <ScrollContainer outer-class="relative" inner-class="space-y-1" inner-style="max-height: 10rem" :no-pill="true">
            <div
              v-for="pt in forecastPoints"
              :key="pt.stepIndex"
              class="flex items-center gap-2 text-xs"
            >
              <span class="text-base">{{ pt.forecastLevel }}</span>
              <span :class="pt.numericValue <= 1.2 ? 'text-red-600 font-medium' : 'text-slate-600'" class="truncate flex-1">{{ pt.stepName }}</span>
            </div>
          </ScrollContainer>
          <button aria-label="Copy Forecast" @click="copyForecast" class="text-xs text-slate-500 hover:text-slate-700 hover:underline">
            {{ forecastCopied ? '✅ Copied!' : '📋 Copy forecast' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Feature #143 — Timeboxing Planner panel -->
    <div v-if="steps.length > 0" class="mt-2 mb-4">
      <div v-show="timeboxOpen" data-panel="timeboxOpen" class="border border-slate-200 rounded-lg overflow-hidden">
        <div v-if="timeboxOpen" class="p-4 bg-white space-y-2">
          <div class="-mx-4 -mt-4 mb-3 flex items-center gap-1.5 px-4 py-2 bg-violet-500"><span aria-hidden="true">⏱️</span><span class="text-xs font-semibold text-white flex-1">Timebox</span><button type="button" aria-label="Collapse Timebox" class="text-white/60 hover:text-white text-[10px]" @click="timeboxOpen = false">▲</button></div>
          <div v-for="entry in timeboxEntries" :key="entry.stepId" class="flex items-center gap-2">
            <span class="text-xs text-slate-600 flex-1 truncate">{{ entry.stepName }}</span>
            <div class="flex gap-0.5">
              <button
                v-for="size in (['1hr', '2hr', '4hr', 'full-day'] as TimeboxSize[])"
                :key="size"
                @click="setTimebox(entry.stepId, size)"
                :class="entry.timebox === size ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
                class="px-2 h-7 text-xs rounded transition-colors"
              >{{ size }}</button>
            </div>
          </div>
          <div v-if="overLimitSteps.length > 0" class="text-xs text-amber-600 mt-1">
            ⚠️ {{ overLimitSteps.length }} full-day step(s) — consider breaking down
          </div>
          <button aria-label="Copy Timebox" @click="copyTimebox" class="text-xs text-slate-500 hover:underline mt-1">
            {{ timeboxCopied ? '✅ Copied!' : '📋 Copy plan' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ── Loading state ──────────────────────────────────────────────────── -->
    <div v-if="loading" class="py-10 px-2">
      <LoadingProgress
        :loading="loading"
        label="Generating Evo Value Delivery Steps…"
        :baseline="30"
        hint="Each Evo step delivers incremental value from your Solutions · can take up to 60s on slow networks"
        color="indigo"
      />
    </div>

    <!-- ── Error state (fetch) ─────────────────────────────────────────────
         Tom 2026-05-15: "there is no action path here" — dead red box replaced
         with Retry + Go-fix-it buttons so user always has an escape route. -->
    <div
      v-else-if="error"
      class="rounded-xl bg-red-50 border border-red-200 p-5 space-y-3"
      role="alert"
    >
      <div class="flex items-start gap-3">
        <span class="text-red-400 text-xl shrink-0" aria-hidden="true">⚠️</span>
        <div class="min-w-0">
          <p class="text-red-700 text-sm font-semibold">Could not generate Evo plan</p>
          <p class="text-red-600 text-xs mt-1 break-words leading-relaxed">{{ error }}</p>
        </div>
      </div>
      <div class="flex flex-wrap gap-2 pt-1">
        <!-- Retry: re-run the planner with the same spec — force=true bypasses
             the identity guard and any pending skip flag so the user always
             gets a fresh generation regardless of cached / pre-loaded state. -->
        <button
          type="button"
          class="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold
                 bg-indigo-600 text-white hover:bg-indigo-700
                 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors"
          @click="fetchPlan(props.specBlock, true)"
        >
          <span aria-hidden="true">↻</span> Retry
        </button>
        <!-- Open the Spec Editor to fix Solutions / Values that are missing -->
        <button
          type="button"
          class="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold
                 bg-white border border-red-300 text-red-700
                 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400
                 transition-colors"
          @click="emit('open-editor', { tab: 'solutions' })"
        >
          <EditGlyph size="compact" class="h-3 w-auto shrink-0" aria-hidden="true" /> Fix Solutions in Spec Editor
        </button>
      </div>
      <p class="text-xs text-red-400 italic">
        Tip: every Evo step needs at least one S. entry. Open the Spec Editor
        to add Solutions, then Retry.
      </p>
    </div>

    <!-- ── Tab panels (plan loaded) ──────────────────────────────────────── -->
    <template v-else-if="plan">

      <!-- ══ PLAN TAB ═══════════════════════════════════════════════════════ -->
      <!-- Tab bar removed: plan content is now always visible.
           Diagrams/charts are in VisualisePanelModal (📊 Diagrams button above). -->
      <div>
        <h2 class="text-lg font-semibold text-gray-900 mb-2">Suggested Evo Steps</h2>
        <ConceptHint
          v-bind="CONCEPT_HINTS['evo-step']"
          :spec="props.specBlock"
          class="mb-4 rounded-lg"
        />

        <!-- Confirmed banner -->
        <div
          v-if="isConfirmed"
          class="mb-4 rounded-lg bg-green-50 border border-green-200 p-3"
          role="status"
          aria-live="polite"
        >
          <p class="text-green-700 text-sm font-medium">Plan confirmed and saved.</p>
        </div>

        <!-- Step list -->
        <ol
          role="list"
          aria-label="Evo step plan"
          class="space-y-3"
        >
          <li
            v-for="(step, index) in steps"
            :key="`step-${index}`"
            role="listitem"
            :aria-label="`Evo step ${index + 1}: ${step.name}`"
            :draggable="!isConfirmed"
            class="rounded-lg border border-gray-200 bg-white shadow-sm transition-opacity"
            :class="{ 'opacity-50': dragSourceIndex === index }"
            @dragstart="onDragStart($event, index)"
            @dragover="onDragOver($event)"
            @drop="onDrop($event, index)"
            @dragend="onDragEnd"
          >
            <div class="flex items-start gap-2 p-3">
              <!-- Drag handle (hidden on confirmed plan) -->
              <span
                v-if="!isConfirmed"
                class="flex items-center justify-center min-w-[44px] min-h-[44px] cursor-grab active:cursor-grabbing text-gray-400 select-none"
                aria-hidden="true"
              >
                ⠿
              </span>

              <!-- Step content -->
              <div class="flex-1 min-w-0">
                <!-- Step name — click to edit -->
                <div v-if="editingIndex === index">
                  <label :for="`step-name-${index}`" class="sr-only">
                    Step name
                  </label>
                  <input
                    :id="`step-name-${index}`"
                    v-model="editingName"
                    type="text"
                    class="w-full rounded border border-blue-400 px-2 py-1 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                    :aria-label="`Edit name for step ${index + 1}`"
                    @keydown.enter="commitEdit"
                    @keydown.escape="cancelEdit"
                    @blur="commitEdit"
                  />
                </div>
                <button
                  v-else
                  type="button"
                  class="text-left text-sm font-medium text-gray-900 hover:text-blue-700 focus:outline-none focus:underline"
                  :disabled="isConfirmed"
                  :aria-label="`Edit name for step ${index + 1}: ${step.name}`"
                  @click="!isConfirmed && startEdit(index)"
                >
                  {{ step.name }}
                </button>

                <!-- Linked values — shown as "Impacts → V.xxx, V.yyy" -->
                <p class="text-xs text-gray-500 mt-1">
                  <span class="inline-flex items-center gap-1 font-medium text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">Impacts →</span>
                  {{ step.linkedValues.join(', ') }}
                </p>

                <!-- Step meta strip — effort + task progress in one compact line -->
                <div class="flex items-center gap-2 mt-1 flex-wrap text-xs text-gray-500">
                  <span>{{ step.effortPercent }}% of total build effort</span>
                  <span aria-hidden="true">·</span>
                  <!-- Task progress: only shown once tasks have been added -->
                  <template v-if="stepTotalCount(step.name) > 0">
                    <span
                      class="flex items-center gap-0.5"
                      :aria-label="getProgressLabel(stepCompletedCount(step.name), stepTotalCount(step.name))"
                    >
                      <span
                        v-for="(emoji, i) in getProgressEmojis(stepCompletedCount(step.name), stepTotalCount(step.name))"
                        :key="i"
                        class="leading-none select-none"
                        aria-hidden="true"
                      >{{ emoji }}</span>
                      <span class="ml-1">{{ stepCompletedCount(step.name) }}/{{ stepTotalCount(step.name) }} tasks</span>
                    </span>
                  </template>
                  <template v-else>
                    <span class="italic text-gray-400">Step not implemented yet.</span>
                  </template>
                </div>

                <!-- Feature #155 (new) — T-Skills toggle -->
                <div class="hidden">
                  <button
                    type="button"
                    class="h-8 px-2 rounded text-xs bg-indigo-100 hover:bg-indigo-200 text-indigo-800 transition-colors"
                    :aria-label="`Toggle T-shaped skills visualiser for ${step.name}`"
                    :data-testid="`new-tskills-toggle-${index}`"
                    @click="toggleTSkills(`step-${index}`)"
                  >
                    🔱 T-Skills
                  </button>
                </div>

                <!-- Feature #155 (new) — T-Skills expanded panel -->
                <div
                  v-if="tSkillsIsOpen(`step-${index}`)"
                  class="mt-1 p-2 rounded border border-indigo-100 bg-indigo-50 space-y-2"
                  :data-testid="`new-tskills-panel-${index}`"
                >
                  <!-- Badge + scores row -->
                  <div class="flex items-center gap-2 flex-wrap">
                    <span
                      class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                      :class="getTSkillProfile(`step-${index}`, step.title ?? step.name).badge === 'π-shaped'
                        ? 'bg-violet-100 text-violet-700'
                        : getTSkillProfile(`step-${index}`, step.title ?? step.name).badge === 'I-shaped'
                          ? 'bg-slate-100 text-slate-600'
                          : 'bg-indigo-100 text-indigo-700'"
                    >{{ getTSkillProfile(`step-${index}`, step.title ?? step.name).badge }}</span>
                    <span class="text-xs text-slate-600">
                      Depth <strong class="text-indigo-700">{{ getTSkillProfile(`step-${index}`, step.title ?? step.name).depthScore }}%</strong>
                    </span>
                    <span class="text-xs text-slate-600">
                      Breadth <strong class="text-indigo-700">{{ getTSkillProfile(`step-${index}`, step.title ?? step.name).breadthScore }}%</strong>
                    </span>
                  </div>

                  <!-- Mini SVG radar (viewBox 0 0 100 100) -->
                  <svg viewBox="0 0 100 100" width="100" height="100" aria-hidden="true" class="shrink-0">
                    <!-- Concentric rings at r=13, 26, 40 -->
                    <circle cx="50" cy="50" r="13" fill="none" stroke="#e5e7eb" stroke-dasharray="3 2" stroke-width="1"/>
                    <circle cx="50" cy="50" r="26" fill="none" stroke="#e5e7eb" stroke-dasharray="3 2" stroke-width="1"/>
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" stroke-dasharray="3 2" stroke-width="1"/>
                    <!-- 5 spoke lines (centre to ring edge) -->
                    <line
                      v-for="(domainName, di) in (['frontend','backend','data','devops','product'] as const)"
                      :key="`spoke-${di}`"
                      x1="50" y1="50"
                      :x2="50 + 40 * Math.cos((Math.PI * 2 * di) / 5 - Math.PI / 2)"
                      :y2="50 + 40 * Math.sin((Math.PI * 2 * di) / 5 - Math.PI / 2)"
                      :stroke="domainName === getTSkillProfile(`step-${index}`, step.title ?? step.name).deepSkill ? '#6366f1' : '#d1d5db'"
                      :stroke-width="domainName === getTSkillProfile(`step-${index}`, step.title ?? step.name).deepSkill ? 2 : 1"
                    />
                    <!-- Filled polygon -->
                    <polygon
                      :points="buildTSkillPolygon(`step-${index}`, step.title ?? step.name)"
                      fill="rgba(99,102,241,0.3)"
                      stroke="#6366f1"
                      stroke-width="1.5"
                    />
                    <!-- Domain labels at r=48 -->
                    <text
                      v-for="(domainLabel, di) in (['frontend','backend','data','devops','product'] as const)"
                      :key="`lbl-${di}`"
                      :x="50 + 48 * Math.cos((Math.PI * 2 * di) / 5 - Math.PI / 2)"
                      :y="50 + 48 * Math.sin((Math.PI * 2 * di) / 5 - Math.PI / 2) + 3"
                      font-size="7"
                      text-anchor="middle"
                      fill="#64748b"
                      class="select-none"
                    >{{ domainLabel.slice(0, 4) }}</text>
                  </svg>

                  <!-- Copy markdown button -->
                  <button
                    type="button"
                    class="text-xs text-indigo-600 hover:underline"
                    :aria-label="`Copy T-Skills markdown`"
                    @click="() => { const md = copyTSkillsMarkdown(steps.map((s, i) => ({ id: `step-${i}`, title: s.title ?? s.name }))); if (typeof navigator !== 'undefined' && navigator.clipboard) { navigator.clipboard.writeText(md).catch(() => {}) } }"
                  >📋 Copy Markdown</button>
                </div>

                <!-- Feature #158 (new) — Mood row: always visible header + toggle -->
                <div class="hidden">
                  <span class="text-base leading-none select-none">{{ getMood(`step-${index}`, step.title ?? step.name) }}</span>
                  <button
                    type="button"
                    class="h-8 px-2 rounded text-xs bg-orange-50 hover:bg-orange-100 text-orange-700 transition-colors"
                    :aria-label="`Toggle mood for ${step.name}`"
                    :data-testid="`new-mood-toggle-${index}`"
                    @click="toggleMood(`step-${index}`)"
                  >
                    😊 Mood
                  </button>
                </div>

                <!-- Feature #158 (new) — Mood expanded panel -->
                <div
                  v-if="moodIsOpen(`step-${index}`)"
                  class="mt-1 p-2 rounded border border-orange-100 bg-orange-50 space-y-2"
                  :data-testid="`new-mood-panel-${index}`"
                >
                  <!-- Emoji buttons row -->
                  <div class="flex items-center gap-1">
                    <button
                      v-for="emoji in moodEmojis"
                      :key="emoji"
                      type="button"
                      class="h-10 w-10 flex items-center justify-center text-xl rounded-full transition-all"
                      :class="getMood(`step-${index}`, step.title ?? step.name) === emoji
                        ? 'ring-2 ring-indigo-400 bg-indigo-50'
                        : 'hover:bg-slate-100'"
                      :aria-label="`Set mood ${emoji} for ${step.name}`"
                      :data-testid="`new-mood-btn-${index}-${emoji}`"
                      @click="setStepMood(`step-${index}`, emoji)"
                    >{{ emoji }}</button>
                  </div>
                  <!-- Label below emoji row -->
                  <p class="text-xs text-slate-600">{{ moodLabel(getMood(`step-${index}`, step.title ?? step.name)) }}</p>
                </div>

                <!-- Feature #158 — Mood badge (always visible) + toggle -->
                <div class="hidden">
                  <span class="text-base leading-none select-none" :title="`Current mood: ${moodMap[`step-${index}`]?.mood ?? '😐'}`">
                    {{ moodMap[`step-${index}`]?.mood ?? '😐' }}
                  </span>
                  <button
                    type="button"
                    class="h-8 px-2 rounded text-xs border border-pink-600 text-pink-600 hover:bg-pink-50 transition-colors"
                    :aria-label="`Toggle mood for ${step.name}`"
                    :data-testid="`mood-toggle-${index}`"
                    @click="toggleMoodOpen(`step-${index}`)"
                  >
                    😊 Mood
                    <span class="ml-1">{{ moodMap[`step-${index}`]?.isOpen ? '▲' : '▼' }}</span>
                  </button>
                  <button
                    v-if="moodMap[`step-${index}`]?.isOpen"
                    type="button"
                    class="h-8 px-2 rounded text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                    :aria-label="`Copy mood table for ${step.name}`"
                    :data-testid="`mood-copy-${index}`"
                    @click="copyMoodMarkdown"
                  >{{ moodCopied ? '✅ Copied!' : '📋 Copy' }}</button>
                </div>
                <!-- Mood emoji selector (when open) -->
                <div
                  v-if="moodMap[`step-${index}`]?.isOpen"
                  class="flex items-center gap-1 mt-1"
                  :data-testid="`mood-panel-${index}`"
                >
                  <button
                    v-for="emoji in (['😰','😐','😊','🤩'] as MoodEmoji[])"
                    :key="emoji"
                    type="button"
                    class="h-9 w-9 flex items-center justify-center text-xl rounded transition-all"
                    :class="moodMap[`step-${index}`]?.mood === emoji
                      ? 'ring-2 ring-pink-500 bg-pink-50'
                      : 'hover:bg-slate-100'"
                    :aria-label="`Set mood ${emoji} for ${step.name}`"
                    :data-testid="`mood-btn-${index}-${emoji}`"
                    @click="setMood(`step-${index}`, emoji)"
                  >{{ emoji }}</button>
                </div>
                <!-- Feature #155 — T-Skills toggle -->
                <div class="hidden">
                  <button
                    type="button"
                    class="h-8 px-2 rounded text-xs border border-indigo-700 text-indigo-700 hover:bg-indigo-50 transition-colors"
                    :aria-label="`Toggle T-shaped skills for ${step.name}`"
                    :data-testid="`tskills-toggle-${index}`"
                    @click="toggleTSkillOpen(`step-${index}`)"
                  >
                    🔱 T-Skills
                    <span class="ml-1">{{ isTSkillOpen(`step-${index}`) ? '▲' : '▼' }}</span>
                  </button>
                  <button
                    v-if="isTSkillOpen(`step-${index}`)"
                    type="button"
                    class="h-8 px-2 rounded text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                    :aria-label="`Copy T-Skills for ${step.name}`"
                    :data-testid="`tskills-copy-${index}`"
                    @click="copyTSkills"
                  >{{ tSkillsCopied ? '✅ Copied!' : '📋 Copy' }}</button>
                </div>
                <!-- T-Skills panel (when open) -->
                <div
                  v-if="isTSkillOpen(`step-${index}`)"
                  class="mt-1 flex items-start gap-3"
                  :data-testid="`tskills-panel-${index}`"
                >
                  <!-- Spider chart SVG 80×80 -->
                  <svg
                    width="80"
                    height="80"
                    viewBox="0 0 80 80"
                    aria-hidden="true"
                    class="shrink-0"
                  >
                    <!-- Spoke lines (slate-300) -->
                    <line
                      v-for="spoke in tSkillsSpokes(40, 40, 40)"
                      :key="spoke.label"
                      :x1="spoke.x1" :y1="spoke.y1"
                      :x2="spoke.x2" :y2="spoke.y2"
                      stroke="#cbd5e1"
                      stroke-width="1"
                    />
                    <!-- Polygon fill -->
                    <polygon
                      v-if="tSkillEntries[index]"
                      :points="tSkillsPolygon(tSkillEntries[index], 40, 40, 40)"
                      fill="#6366f1"
                      fill-opacity="0.3"
                      stroke="#6366f1"
                      stroke-width="1"
                    />
                    <!-- Axis labels (8px) -->
                    <text
                      v-for="spoke in tSkillsSpokes(40, 40, 44)"
                      :key="`lbl-${spoke.label}`"
                      :x="spoke.x2"
                      :y="spoke.y2"
                      font-size="8"
                      text-anchor="middle"
                      fill="#64748b"
                      class="select-none"
                    >{{ spoke.label.slice(0, 2) }}</text>
                  </svg>
                  <!-- Labels -->
                  <div v-if="tSkillEntries[index]" class="text-xs space-y-1 min-w-0">
                    <p class="text-indigo-700 font-medium truncate">
                      Depth: {{ tSkillEntries[index].depthDomain }} {{ tSkillEntries[index].depthScore }}%
                    </p>
                    <p class="text-slate-500 truncate">
                      Breadth: {{ tSkillEntries[index].breadthDomains.join(', ') }} {{ tSkillEntries[index].broadScore }}%
                    </p>
                  </div>
                </div>
                <button
                  v-if="isTSkillOpen(`step-${index}`)"
                  type="button"
                  class="text-xs text-indigo-600 hover:underline mt-1"
                  :aria-label="`Copy T-Skills for ${step.name}`"
                  :data-testid="`tskills-copy-${index}`"
                  @click="copyTSkills"
>{{ tSkillsCopied ? '✅ Copied!' : '📋 Copy T-Skills' }}</button>

                <!-- Feature #163 — Cognitive Load -->
                <div class="mt-1">
                  <button
                    type="button"
                    class="hidden"
                    :aria-label="`Cognitive load for ${step.title ?? 'step'}`"
                    @click="toggleCogLoad(`step-${index}`)"
                  >
                    🧠 Cog. Load
                    <span
                      class="text-xs rounded px-1.5 py-0.5 font-medium"
                      :class="{
                        'bg-emerald-100 text-emerald-700': getCogProfile(`step-${index}`, step.title ?? '').level === 'Low',
                        'bg-amber-100 text-amber-700': getCogProfile(`step-${index}`, step.title ?? '').level === 'Medium',
                        'bg-red-100 text-red-700': getCogProfile(`step-${index}`, step.title ?? '').level === 'High',
                        'bg-red-200 text-red-900 ring-1 ring-red-400': getCogProfile(`step-${index}`, step.title ?? '').level === 'Critical',
                      }"
                    >{{ getCogProfile(`step-${index}`, step.title ?? '').level }}</span>
                  </button>
                  <div v-if="cogLoadIsOpen(`step-${index}`)" class="mt-2 pl-2 space-y-2">
                    <!-- Total score -->
                    <p class="text-xs font-medium text-slate-700">
                      Load: {{ getCogProfile(`step-${index}`, step.title ?? '').total }}/100 —
                      <span :class="{
                        'text-emerald-700': getCogProfile(`step-${index}`, step.title ?? '').level === 'Low',
                        'text-amber-700': getCogProfile(`step-${index}`, step.title ?? '').level === 'Medium',
                        'text-red-700': ['High','Critical'].includes(getCogProfile(`step-${index}`, step.title ?? '').level),
                      }">{{ getCogProfile(`step-${index}`, step.title ?? '').level }}</span>
                    </p>
                    <!-- Simplify suggestion -->
                    <p class="text-xs text-amber-700 bg-amber-50 rounded p-2 italic">{{ getCogProfile(`step-${index}`, step.title ?? '').simplify }}</p>
                    <!-- 5-axis bars -->
                    <div class="space-y-1">
                      <div
                        v-for="axis in (['complexity','integration','team','timeline','risk'] as const)"
                        :key="axis"
                        class="flex items-center gap-2 text-xs"
                      >
                        <span class="w-20 text-slate-500 capitalize flex-none">{{ axis }}</span>
                        <div class="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            class="h-full rounded-full"
                            :class="{
                              'bg-emerald-400': getCogProfile(`step-${index}`, step.title ?? '').scores[axis] < 40,
                              'bg-amber-400': getCogProfile(`step-${index}`, step.title ?? '').scores[axis] >= 40 && getCogProfile(`step-${index}`, step.title ?? '').scores[axis] < 70,
                              'bg-red-400': getCogProfile(`step-${index}`, step.title ?? '').scores[axis] >= 70,
                            }"
                            :style="{ width: cogBarWidth(getCogProfile(`step-${index}`, step.title ?? '').scores[axis]) + '%' }"
                          ></div>
                        </div>
                        <span class="text-slate-400 flex-none w-8 text-right">{{ getCogProfile(`step-${index}`, step.title ?? '').scores[axis] }}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Feature #82 — Confidence Vote row -->
                <div
                  class="flex items-center gap-2 mt-1 flex-wrap"
                  :data-testid="`vote-row-${index}`"
                  :aria-label="`Confidence vote for ${step.name}`"
                >
                  <span class="text-xs text-gray-500 shrink-0">My confidence:</span>
                  <!-- 5 star buttons -->
                  <div class="flex items-center gap-0.5">
                    <button
                      v-for="star in [1, 2, 3, 4, 5]"
                      :key="star"
                      type="button"
                      class="h-7 w-7 flex items-center justify-center text-sm leading-none focus:outline-none focus:ring-1 focus:ring-yellow-400 rounded"
                      :class="(voteSummaries[step.name]?.userVote ?? 0) >= star
                        ? 'text-yellow-400'
                        : 'text-slate-300'"
                      :aria-label="`Rate confidence in ${step.name}: ${star} out of 5`"
                      :data-testid="`vote-star-${index}-${star}`"
                      @click="setUserVote(step.name, star)"
                    >{{ (voteSummaries[step.name]?.userVote ?? 0) >= star ? '★' : '☆' }}</button>
                  </div>

                  <!-- Team average — only shown when a vote exists -->
                  <span
                    v-if="voteSummaries[step.name]?.avg"
                    class="text-xs text-slate-400 tabular-nums"
                    :data-testid="`vote-avg-${index}`"
                  >Team avg: {{ voteSummaries[step.name]?.avg?.toFixed(1) }}</span>

                  <!-- Outlier flag -->
                  <span
                    v-if="voteSummaries[step.name]?.hasOutlier"
                    class="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-1 py-0.5"
                    :data-testid="`vote-outlier-${index}`"
                  >⚠ Team not aligned</span>
                </div>

                <!-- ── Per-step action strip — grouped dropdown menus ──── -->
                <div class="flex flex-wrap gap-1 mt-2 pt-1.5 border-t border-slate-100">
                  <!-- Backdrop: dismiss open step-menu on outside click -->
                  <div
                    v-if="activeStepMenu !== null"
                    class="fixed inset-0 z-10"
                    aria-hidden="true"
                    @click="activeStepMenu = null"
                  />
                  <!-- Analyze · Presentation · Visualize · Simplify · Criticize -->
                  <div v-for="group in stepActionGroups(step, index)" :key="group.id" class="relative">
                    <!-- Group trigger button -->
                    <button
                      type="button"
                      :aria-label="group.label"
                      :aria-haspopup="true"
                      :aria-expanded="isStepMenuOpen(index, group.id)"
                      class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors duration-100"
                      :class="isStepMenuOpen(index, group.id)
                        ? 'bg-slate-100 text-slate-700'
                        : group.items.some(i => i.isActive())
                          ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'
                          : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'"
                      @click.stop="toggleStepMenu(index, group.id)"
                    >
                      <span aria-hidden="true">{{ group.emoji }}</span>
                      <span>{{ group.label }}</span>
                      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
                        style="height:0.6rem;width:0.6rem;flex-shrink:0;opacity:0.4;margin-left:0.1rem"
                      ><path fill-rule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06z" /></svg>
                    </button>
                    <!-- Dropdown panel -->
                    <div
                      v-show="isStepMenuOpen(index, group.id)"
                      class="absolute left-0 top-full z-20 mt-1 min-w-[12rem] rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl"
                    >
                      <button
                        v-for="item in group.items"
                        :key="item.label"
                        type="button"
                        :aria-label="`${item.label} for ${step.name}`"
                        :data-testid="item.testid"
                        class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors"
                        :class="item.isActive()
                          ? 'text-slate-800 font-semibold bg-slate-50'
                          : 'text-slate-500 hover:bg-slate-50'"
                        @click.stop="item.onClick(); activeStepMenu = null"
                      >
                        <span class="shrink-0 w-5 text-center" aria-hidden="true">{{ item.emoji }}</span>
                        <span class="flex-1">{{ item.label }}</span>
                        <!-- Active indicator dot -->
                        <span
                          v-if="item.isActive()"
                          class="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0"
                          aria-hidden="true"
                        />
                        <!-- Count badge (Blockers / Spike) -->
                        <span
                          v-if="item.badge && item.badge() > 0"
                          class="h-4 min-w-[1rem] px-1 flex items-center justify-center text-[9px] bg-red-500 text-white rounded-full shrink-0"
                        >{{ item.badge() }}</span>
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Feature #91 — Definition of Done row -->
                <div class="hidden" :data-testid="`dod-row-${index}`">
                  <!-- Toggle button -->
                  <button
                    type="button"
                    class="h-8 px-2 rounded text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors"
                    :aria-expanded="dodByStep[`step-${index}`]?.open ?? false"
                    :aria-label="`Toggle definition of done for ${step.name}`"
                    :data-testid="`dod-toggle-${index}`"
                    @click="toggleDod(`step-${index}`)"
                  >
                    ✅ DoD
                    <span class="ml-1">{{ (dodByStep[`step-${index}`]?.open) ? '▲' : '▼' }}</span>
                  </button>

                  <!-- Copy button (shown when items loaded) -->
                  <button
                    v-if="dodByStep[`step-${index}`]?.open && (dodByStep[`step-${index}`]?.items?.length ?? 0) > 0"
                    type="button"
                    class="h-8 px-2 rounded text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                    :aria-label="`Copy definition of done for ${step.name}`"
                    :data-testid="`dod-copy-${index}`"
                    @click="copyDod(`step-${index}`)"
                  >
                    📋 Copy
                  </button>
                </div>

                <!-- DoD expandable checklist -->
                <div
                  v-if="dodByStep[`step-${index}`]?.open"
                  class="mt-1"
                  :data-testid="`dod-panel-${index}`"
                >
                  <!-- Loading skeleton -->
                  <div
                    v-if="dodByStep[`step-${index}`]?.loading"
                    class="space-y-1.5"
                    :data-testid="`dod-loading-${index}`"
                  >
                    <div class="h-4 bg-slate-100 rounded animate-pulse w-4/5" />
                    <div class="h-4 bg-slate-100 rounded animate-pulse w-3/5" />
                    <div class="h-4 bg-slate-100 rounded animate-pulse w-4/5" />
                  </div>

                  <!-- Checklist items -->
                  <ul
                    v-else
                    class="space-y-1 mt-1"
                    :data-testid="`dod-list-${index}`"
                  >
                    <li
                      v-for="(item, itemIdx) in dodByStep[`step-${index}`]?.items ?? []"
                      :key="itemIdx"
                      class="flex items-start gap-1.5"
                      :data-testid="`dod-item-${index}-${itemIdx}`"
                    >
                      <input
                        type="checkbox"
                        :id="`dod-check-${index}-${itemIdx}`"
                        :checked="item.checked"
                        class="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-400 shrink-0"
                        :aria-label="item.text"
                        @change="toggleDoDItem(`step-${index}`, itemIdx)"
                      />
                      <label
                        :for="`dod-check-${index}-${itemIdx}`"
                        class="text-xs text-slate-600 leading-snug cursor-pointer select-none"
                        :class="{ 'line-through text-slate-400': item.checked }"
                      >{{ item.text }}</label>
                    </li>
                  </ul>
                  <button v-if="(dodByStep[`step-${index}`]?.items?.length ?? 0) > 0"
                    type="button"
                    class="text-xs text-emerald-600 hover:underline mt-1"
                    :aria-label="`Copy definition of done for ${step.name}`"
                    :data-testid="`dod-copy-${index}`"
                    @click="copyDod(`step-${index}`)"
                  >📋 Copy DoD</button>
                </div>

                <!-- Feature #95 — Learning Outcomes row -->
                <div class="hidden" :data-testid="`learning-row-${index}`">
                  <!-- Toggle button -->
                  <button
                    type="button"
                    class="h-8 px-2 rounded text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 transition-colors"
                    :aria-expanded="learningByStep[`step-${index}`]?.open ?? false"
                    :aria-label="`Toggle learning outcomes for ${step.name}`"
                    :data-testid="`learning-toggle-${index}`"
                    @click="toggleLearning(`step-${index}`)"
                  >
                    🎓 Learn
                    <span class="ml-1">{{ (learningByStep[`step-${index}`]?.open) ? '▲' : '▼' }}</span>
                  </button>

                  <!-- Copy button (shown when outcomes loaded) -->
                  <button
                    v-if="learningByStep[`step-${index}`]?.open && (learningByStep[`step-${index}`]?.outcomes?.length ?? 0) > 0"
                    type="button"
                    class="h-8 px-2 rounded text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                    :aria-label="`Copy learning outcomes for ${step.name}`"
                    :data-testid="`learning-copy-${index}`"
                    @click="copyLearning(`step-${index}`)"
                  >
                    📋 Copy
                  </button>
                </div>

                <!-- Learning outcomes expandable list -->
                <div
                  v-if="learningByStep[`step-${index}`]?.open"
                  class="mt-1"
                  :data-testid="`learning-panel-${index}`"
                >
                  <!-- Loading skeleton -->
                  <div
                    v-if="learningByStep[`step-${index}`]?.loading"
                    class="space-y-1.5"
                    :data-testid="`learning-loading-${index}`"
                  >
                    <div class="h-4 bg-slate-100 rounded animate-pulse w-4/5" />
                    <div class="h-4 bg-slate-100 rounded animate-pulse w-3/5" />
                  </div>

                  <!-- Outcome items -->
                  <ul
                    v-else
                    class="space-y-1 mt-1"
                    :data-testid="`learning-list-${index}`"
                  >
                    <li
                      v-for="(outcome, outcomeIdx) in learningByStep[`step-${index}`]?.outcomes ?? []"
                      :key="outcomeIdx"
                      class="flex items-start gap-1"
                      :data-testid="`learning-item-${index}-${outcomeIdx}`"
                    >
                      <span class="shrink-0 text-sm">🔹</span>
                      <span class="text-sm text-slate-600 leading-snug">{{ outcome.text }}</span>
                    </li>
                  </ul>
                  <button v-if="(learningByStep[`step-${index}`]?.outcomes?.length ?? 0) > 0"
                    type="button"
                    class="text-xs text-purple-600 hover:underline mt-1"
                    :aria-label="`Copy learning outcomes for ${step.name}`"
                    :data-testid="`learning-copy-${index}`"
                    @click="copyLearning(`step-${index}`)"
                  >📋 Copy Outcomes</button>
                </div>

                <!-- Feature #106 — Risk Mitigation row -->
                <div class="hidden" :data-testid="`mitigation-row-${index}`">
                  <!-- Toggle button -->
                  <button
                    type="button"
                    class="h-8 px-2 rounded text-xs bg-orange-50 hover:bg-orange-100 text-orange-700 transition-colors"
                    :aria-expanded="mitigationByStep[`step-${index}`]?.open ?? false"
                    :aria-label="`Toggle risk mitigation for ${step.name}`"
                    :data-testid="`mitigation-toggle-${index}`"
                    @click="toggleMitigation(`step-${index}`)"
                  >
                    ⚠️ Mitigate
                    <span class="ml-1">{{ (mitigationByStep[`step-${index}`]?.open) ? '▲' : '▼' }}</span>
                  </button>

                  <!-- Copy button (shown when strategies loaded) -->
                  <button
                    v-if="mitigationByStep[`step-${index}`]?.open && (mitigationByStep[`step-${index}`]?.strategies?.length ?? 0) > 0"
                    type="button"
                    class="h-8 px-2 rounded text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                    :aria-label="`Copy risk mitigation for ${step.name}`"
                    :data-testid="`mitigation-copy-${index}`"
                    @click="copyMitigation(`step-${index}`)"
                  >
                    📋 Copy
                  </button>
                </div>

                <!-- Mitigation expandable panel -->
                <div
                  v-if="mitigationByStep[`step-${index}`]?.open"
                  class="mt-1"
                  :data-testid="`mitigation-panel-${index}`"
                >
                  <!-- Loading skeleton -->
                  <div
                    v-if="mitigationByStep[`step-${index}`]?.loading"
                    class="space-y-1.5"
                    :data-testid="`mitigation-loading-${index}`"
                  >
                    <div class="h-4 bg-slate-100 rounded animate-pulse w-4/5" />
                    <div class="h-4 bg-slate-100 rounded animate-pulse w-3/5" />
                  </div>
                  <!-- Strategy items -->
                  <div
                    v-else
                    class="space-y-2 mt-1"
                    :data-testid="`mitigation-list-${index}`"
                  >
                    <div
                      v-for="strategy in mitigationByStep[`step-${index}`]?.strategies ?? []"
                      :key="strategy.type"
                      class="flex items-start gap-1"
                      :data-testid="`mitigation-strategy-${index}-${strategy.type}`"
                    >
                      <span class="shrink-0 text-xs font-medium text-slate-500">
                        {{ strategy.type === 'preventive' ? '🛡 Preventive:' : '🔥 Contingent:' }}
                      </span>
                      <span class="text-sm text-slate-600 leading-snug">{{ strategy.text }}</span>
                    </div>
                  </div>
                  <button v-if="(mitigationByStep[`step-${index}`]?.strategies?.length ?? 0) > 0"
                    type="button"
                    class="text-xs text-orange-600 hover:underline mt-1"
                    :aria-label="`Copy risk mitigation for ${step.name}`"
                    :data-testid="`mitigation-copy-${index}`"
                    @click="copyMitigation(`step-${index}`)"
                  >📋 Copy Mitigation</button>
                </div>

                <!-- Retro row (Feature #113) -->
                <div class="hidden">
                  <button
                    @click="handleRetroToggle(step, index)"
                    class="h-11 px-3 text-sm rounded bg-violet-600 hover:bg-violet-700 text-white flex items-center gap-1"
                    :aria-label="`Toggle retrospective for ${step.name}`"
                    :data-testid="`retro-toggle-${index}`"
                  >
                    🔄 Retro
                  </button>
                  <span v-if="retroMap[`step-${index}`]?.loading" class="text-xs text-gray-400">Generating…</span>
                </div>
                <div v-if="retroMap[`step-${index}`]?.open" class="mt-2 ml-1 border-l-2 border-violet-300 pl-3 space-y-1">
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-[10px] font-semibold text-violet-500 uppercase tracking-wide">🎨 Retro Themes</span>
                    <div class="flex items-center gap-1">
                      <button type="button" title="Close" class="group w-3 h-3 flex items-center justify-center rounded-full bg-[#ff5f57] hover:bg-[#ff3b30] ring-1 ring-rose-900/20 transition-all duration-150 hover:scale-125 focus:outline-none" :aria-label="`Close Retro for ${step.name}`" @click="toggleRetroOpen(`step-${index}`)"><span class="opacity-0 group-hover:opacity-100 transition-opacity duration-100 text-[#5c0000] text-[6px] font-black leading-none select-none">⊖</span></button>
                      <button type="button" title="Minimize" class="group w-3 h-3 flex items-center justify-center rounded-full bg-[#febc2e] hover:bg-[#f0a000] ring-1 ring-black/20 transition-all duration-150 hover:scale-125 focus:outline-none" :aria-label="`Minimize Retro for ${step.name}`" @click="retroMinimized[`step-${index}`] = !retroMinimized[`step-${index}`]"><span class="opacity-0 group-hover:opacity-100 transition-opacity duration-100 text-[#7e5000] text-[6px] font-black leading-none select-none">–</span></button>
                      <button type="button" title="Expand" class="group w-3 h-3 flex items-center justify-center rounded-full bg-[#28c840] hover:bg-[#20a832] ring-1 ring-black/20 transition-all duration-150 hover:scale-125 focus:outline-none" :aria-label="`Expand Retro for ${step.name}`" @click="expandedPanel = `retro-step-${index}`"><span class="opacity-0 group-hover:opacity-100 transition-opacity duration-100 text-[#006e1c] text-[6px] font-black leading-none select-none">+</span></button>
                    </div>
                  </div>
                  <template v-if="!retroMinimized[`step-${index}`]">
                  <div v-for="p in retroMap[`step-${index}`]?.prompts ?? []" :key="p.category" class="text-sm">
                    <span class="font-medium capitalize">{{ p.category.replace('-', ' ') }}:</span>
                    <span class="ml-1 text-gray-700">{{ p.prompt }}</span>
                  </div>
                  <button
                    v-if="retroMap[`step-${index}`]?.prompts?.length"
                    @click="copyRetro(`step-${index}`)"
                    class="text-xs text-violet-600 hover:underline mt-1"
                    :aria-label="`Copy retrospective for ${step.name}`"
                    :data-testid="`retro-copy-${index}`"
                  >📋 Copy</button>
                  </template>
                </div>

                <!-- Feature #125 — Spike Detector badge -->
                <div v-if="spikeDetectorMap[`step-${index}`]" class="mt-1 flex items-center gap-1.5">
                  <span :class="spikeDetectorMap[`step-${index}`].riskLevel === 'high' ? 'bg-red-100 text-red-700' : spikeDetectorMap[`step-${index}`].riskLevel === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'"
                        class="text-xs px-2 py-0.5 rounded-full font-medium">
                    📍 Spike: {{ spikeDetectorMap[`step-${index}`].riskLevel }}
                  </span>
                  <span class="text-xs text-slate-500 truncate flex-1">{{ spikeDetectorMap[`step-${index}`].suggestion }}</span>
                </div>

                <!-- Definition of Ready row (Feature #116) -->
                <div class="hidden">
                  <button
                    @click="handleReadyToggle(`step-${index}`)"
                    :class="isReady(`step-${index}`) ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'"
                    class="h-11 px-3 text-sm rounded text-white flex items-center gap-1"
                    :aria-label="`Toggle definition of ready for ${step.name}`"
                    :data-testid="`ready-toggle-${index}`"
                  >
                    🚦 Ready? <span v-if="!isReady(`step-${index}`) && readyMap[`step-${index}`]" class="ml-1 text-xs">({{ readyMap[`step-${index}`].blockedCount }} blocking)</span>
                  </button>
                  <span v-if="isReady(`step-${index}`) && readyMap[`step-${index}`]?.items?.length" class="text-xs text-emerald-600 font-medium">✅ Ready to start</span>
                </div>
                <div v-if="readyMap[`step-${index}`]?.open" class="mt-2 ml-1 border-l-2 border-rose-300 pl-3 space-y-1">
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-[10px] font-semibold text-rose-500 uppercase tracking-wide">🚦 Definition of Ready</span>
                    <div class="flex items-center gap-1">
                      <button type="button" title="Close" class="group w-3 h-3 flex items-center justify-center rounded-full bg-[#ff5f57] hover:bg-[#ff3b30] ring-1 ring-rose-900/20 transition-all duration-150 hover:scale-125 focus:outline-none" :aria-label="`Close Readiness for ${step.name}`" @click="toggleReadyOpen(`step-${index}`)"><span class="opacity-0 group-hover:opacity-100 transition-opacity duration-100 text-[#5c0000] text-[6px] font-black leading-none select-none">⊖</span></button>
                      <button type="button" title="Minimize" class="group w-3 h-3 flex items-center justify-center rounded-full bg-[#febc2e] hover:bg-[#f0a000] ring-1 ring-black/20 transition-all duration-150 hover:scale-125 focus:outline-none" :aria-label="`Minimize Readiness for ${step.name}`" @click="readyMinimized[`step-${index}`] = !readyMinimized[`step-${index}`]"><span class="opacity-0 group-hover:opacity-100 transition-opacity duration-100 text-[#7e5000] text-[6px] font-black leading-none select-none">–</span></button>
                      <button type="button" title="Expand" class="group w-3 h-3 flex items-center justify-center rounded-full bg-[#28c840] hover:bg-[#20a832] ring-1 ring-black/20 transition-all duration-150 hover:scale-125 focus:outline-none" :aria-label="`Expand Readiness for ${step.name}`" @click="expandedPanel = `ready-step-${index}`"><span class="opacity-0 group-hover:opacity-100 transition-opacity duration-100 text-[#006e1c] text-[6px] font-black leading-none select-none">+</span></button>
                    </div>
                  </div>
                  <template v-if="!readyMinimized[`step-${index}`]">
                  <div v-for="item in readyMap[`step-${index}`]?.items ?? []" :key="item.id" class="flex items-center gap-2">
                    <button
                      @click="toggleReadyItem(`step-${index}`, item.id)"
                      :class="item.checked ? 'bg-emerald-500' : 'bg-gray-200'"
                      class="w-5 h-5 rounded flex items-center justify-center text-white text-xs flex-shrink-0"
                      :aria-label="`Toggle ${item.label} for ${step.name}`"
                      :data-testid="`ready-item-${index}-${item.id}`"
                    >{{ item.checked ? '✓' : '' }}</button>
                    <span :class="item.checked ? 'line-through text-gray-400' : 'text-gray-700'" class="text-sm">{{ item.label }}</span>
                  </div>
                  <button
                    v-if="readyMap[`step-${index}`]?.items?.length"
                    @click="copyReadiness(`step-${index}`)"
                    class="text-xs text-rose-600 hover:underline mt-1"
                    :aria-label="`Copy definition of ready for ${step.name}`"
                    :data-testid="`ready-copy-${index}`"
                  >📋 Copy</button>
                  </template>
                </div>

                <!-- Pair Programming row (Feature #121) -->
                <div class="hidden">
                  <button
                    @click="handlePairToggle(step, index)"
                    class="h-11 px-3 text-sm rounded bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1"
                  >
                    👥 Pair
                  </button>
                </div>
                <div v-if="pairMap[`step-${index}`]?.open" class="mt-2 rounded-lg overflow-hidden border border-blue-200">
                  <div class="flex items-center gap-2 px-3 py-2 bg-blue-600">
                    <div class="flex items-center gap-1.5">
                      <button type="button" title="Close"
                        class="group w-3.5 h-3.5 flex items-center justify-center rounded-full bg-[#ff5f57] hover:bg-[#ff3b30] ring-1 ring-black/25 transition-all duration-150 hover:scale-125 focus:outline-none"
                        :aria-label="`Close Pair Program Plot for ${step.name}`"
                        @click="handlePairToggle(step, index)"
                      ><span class="opacity-0 group-hover:opacity-100 transition-opacity duration-100 text-[#5c0000] text-[7px] font-black leading-none select-none">⊖</span></button>
                      <button type="button" title="Minimize"
                        class="group w-3.5 h-3.5 flex items-center justify-center rounded-full bg-[#febc2e] hover:bg-[#f0a000] ring-1 ring-black/20 transition-all duration-150 hover:scale-125 focus:outline-none"
                        :aria-label="`Minimize Pair Program Plot for ${step.name}`"
                        @click="pairMinimized[`step-${index}`] = !pairMinimized[`step-${index}`]"
                      ><span class="opacity-0 group-hover:opacity-100 transition-opacity duration-100 text-[#7e5000] text-[7px] font-black leading-none select-none">–</span></button>
                      <button type="button" title="Expand"
                        class="group w-3.5 h-3.5 flex items-center justify-center rounded-full bg-[#28c840] hover:bg-[#20a832] ring-1 ring-black/20 transition-all duration-150 hover:scale-125 focus:outline-none"
                        :aria-label="`Expand Pair Program Plot for ${step.name}`"
                        @click="expandedPanel = `pair-step-${index}`"
                      ><span class="opacity-0 group-hover:opacity-100 transition-opacity duration-100 text-[#006e1c] text-[7px] font-black leading-none select-none">+</span></button>
                    </div>
                    <span class="text-base leading-none">👥</span>
                    <span class="text-xs font-semibold text-white tracking-wide uppercase">Pair Program Plot</span>
                  </div>
                  <div v-if="!pairMinimized[`step-${index}`]" class="px-3 pb-3 pt-2 space-y-1">
                  <p class="text-xs text-gray-500 italic">{{ pairMap[`step-${index}`]?.contextBrief }}</p>
                  <div v-for="b in pairMap[`step-${index}`]?.blocks ?? []" :key="b.blockNumber" class="text-sm flex gap-2">
                    <span class="font-medium text-blue-700 w-24 flex-shrink-0">Block {{ b.blockNumber }} ({{ b.role }}):</span>
                    <span class="text-gray-700">{{ b.focus }}</span>
                  </div>
                  <p class="text-xs text-amber-600 mt-1">⇄ {{ pairMap[`step-${index}`]?.swapNote }}</p>
                  <button
                    v-if="pairMap[`step-${index}`]?.blocks?.length"
                    @click="copyPlan(`step-${index}`)"
                    class="text-xs text-blue-600 hover:underline mt-1"
                  >📋 Copy</button>
                  </div><!-- /inner padding -->
                </div>

                <!-- Mob Programming row (Feature #135) -->
                <div class="hidden">
                  <button
                    @click="handleMobToggle(step, index)"
                    class="h-11 px-3 text-sm rounded bg-sky-600 hover:bg-sky-700 text-white flex items-center gap-1"
                  >
                    🖥️ Mob
                  </button>
                </div>
                <div v-if="mobMap[`step-${index}`]?.open" class="mt-2 rounded-lg overflow-hidden border border-sky-200">
                  <div class="flex items-center gap-2 px-3 py-2 bg-sky-500">
                    <div class="flex items-center gap-1.5">
                      <button type="button" title="Close"
                        class="group w-3.5 h-3.5 flex items-center justify-center rounded-full bg-[#ff5f57] hover:bg-[#ff3b30] ring-1 ring-black/25 transition-all duration-150 hover:scale-125 focus:outline-none"
                        :aria-label="`Close Mob Meandering for ${step.name}`"
                        @click="handleMobToggle(step, index)"
                      ><span class="opacity-0 group-hover:opacity-100 transition-opacity duration-100 text-[#5c0000] text-[7px] font-black leading-none select-none">⊖</span></button>
                      <button type="button" title="Minimize"
                        class="group w-3.5 h-3.5 flex items-center justify-center rounded-full bg-[#febc2e] hover:bg-[#f0a000] ring-1 ring-black/20 transition-all duration-150 hover:scale-125 focus:outline-none"
                        :aria-label="`Minimize Mob Meandering for ${step.name}`"
                        @click="mobMinimized[`step-${index}`] = !mobMinimized[`step-${index}`]"
                      ><span class="opacity-0 group-hover:opacity-100 transition-opacity duration-100 text-[#7e5000] text-[7px] font-black leading-none select-none">–</span></button>
                      <button type="button" title="Expand"
                        class="group w-3.5 h-3.5 flex items-center justify-center rounded-full bg-[#28c840] hover:bg-[#20a832] ring-1 ring-black/20 transition-all duration-150 hover:scale-125 focus:outline-none"
                        :aria-label="`Expand Mob Meandering for ${step.name}`"
                        @click="expandedPanel = `mob-step-${index}`"
                      ><span class="opacity-0 group-hover:opacity-100 transition-opacity duration-100 text-[#006e1c] text-[7px] font-black leading-none select-none">+</span></button>
                    </div>
                    <span class="text-base leading-none">🖥️</span>
                    <span class="text-xs font-semibold text-white tracking-wide uppercase">Mob Meandering</span>
                  </div>
                  <div v-if="!mobMinimized[`step-${index}`]" class="px-3 pb-3 pt-2 space-y-1">
                  <p class="text-xs text-gray-500 italic">{{ mobMap[`step-${index}`]?.sessionGoal }}</p>
                  <p class="text-xs text-sky-600">Team: {{ mobMap[`step-${index}`]?.teamSize }} | 10 min/rotation | {{ mobMap[`step-${index}`]?.totalMinutes }} min total</p>
                  <div v-for="r in mobMap[`step-${index}`]?.rotations ?? []" :key="r.rotationNumber" class="text-sm">
                    <span class="font-medium text-sky-700 w-20 inline-block">Rotation {{ r.rotationNumber }}:</span>
                    <span class="text-gray-700">{{ r.focus }}</span>
                  </div>
                  <button
                    v-if="mobMap[`step-${index}`]?.rotations?.length"
                    @click="copyMob(`step-${index}`)"
                    class="text-xs text-sky-600 hover:underline mt-1"
                  >📋 Copy</button>
                  </div><!-- /inner padding -->
                </div>

                <!-- Blocker Log row (Feature #138) -->
                <div class="hidden">
                  <button
                    @click="handleBlockerToggle(step, index)"
                    class="h-11 px-3 text-sm rounded bg-red-700 hover:bg-red-800 text-white flex items-center gap-1"
                  >
                    🚫 Blockers
                    <span v-if="(blockerMap[`step-${index}`]?.activeCount ?? 0) > 0" class="ml-1 text-xs bg-white text-red-700 rounded px-1">{{ blockerMap[`step-${index}`]?.activeCount }}</span>
                  </button>
                </div>
                <div v-if="blockerMap[`step-${index}`]?.open" class="mt-2 ml-1 border-l-2 border-red-300 pl-3 space-y-2">
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-[10px] font-semibold text-red-500 uppercase tracking-wide">🚫 Blocker Log</span>
                    <div class="flex items-center gap-1">
                      <button type="button" title="Close" class="group w-3 h-3 flex items-center justify-center rounded-full bg-[#ff5f57] hover:bg-[#ff3b30] ring-1 ring-rose-900/20 transition-all duration-150 hover:scale-125 focus:outline-none" :aria-label="`Close Blockers for ${step.name}`" @click="toggleBlockerOpen(`step-${index}`)"><span class="opacity-0 group-hover:opacity-100 transition-opacity duration-100 text-[#5c0000] text-[6px] font-black leading-none select-none">⊖</span></button>
                      <button type="button" title="Minimize" class="group w-3 h-3 flex items-center justify-center rounded-full bg-[#febc2e] hover:bg-[#f0a000] ring-1 ring-black/20 transition-all duration-150 hover:scale-125 focus:outline-none" :aria-label="`Minimize Blockers for ${step.name}`" @click="blockerMinimized[`step-${index}`] = !blockerMinimized[`step-${index}`]"><span class="opacity-0 group-hover:opacity-100 transition-opacity duration-100 text-[#7e5000] text-[6px] font-black leading-none select-none">–</span></button>
                      <button type="button" title="Expand" class="group w-3 h-3 flex items-center justify-center rounded-full bg-[#28c840] hover:bg-[#20a832] ring-1 ring-black/20 transition-all duration-150 hover:scale-125 focus:outline-none" :aria-label="`Expand Blockers for ${step.name}`" @click="expandedPanel = `blocker-step-${index}`"><span class="opacity-0 group-hover:opacity-100 transition-opacity duration-100 text-[#006e1c] text-[6px] font-black leading-none select-none">+</span></button>
                    </div>
                  </div>
                  <template v-if="!blockerMinimized[`step-${index}`]">
                  <!-- Add blocker form -->
                  <div class="flex gap-2 items-center">
                    <input
                      v-model="newBlockerDesc[`step-${index}`]"
                      type="text"
                      placeholder="Describe blocker…"
                      class="flex-1 h-9 border rounded px-2 text-sm"
                    />
                    <select v-model="newBlockerSeverity[`step-${index}`]" class="h-9 border rounded px-2 text-sm">
                      <option>P1</option><option>P2</option><option selected>P3</option>
                    </select>
                    <button @click="submitBlocker(index)" class="h-9 px-3 bg-red-600 text-white text-sm rounded hover:bg-red-700">Add</button>
                  </div>
                  <!-- Blocker list -->
                  <div v-for="b in blockerMap[`step-${index}`]?.blockers ?? []" :key="b.id" class="flex items-start gap-2 text-sm">
                    <span :class="b.severity === 'P1' ? 'bg-red-600' : b.severity === 'P2' ? 'bg-orange-500' : 'bg-yellow-500'" class="text-white text-xs rounded px-1.5 py-0.5 flex-shrink-0 mt-0.5">{{ b.severity }}</span>
                    <span :class="b.resolved ? 'line-through text-gray-400' : 'text-gray-700'">{{ b.description }}</span>
                    <div class="ml-auto flex gap-1 flex-shrink-0">
                      <button v-if="!b.resolved" @click="resolveBlocker(`step-${index}`, b.id)" class="text-xs text-emerald-600 hover:underline">✓ Resolve</button>
                      <button @click="removeBlocker(`step-${index}`, b.id)" class="text-xs text-red-400 hover:underline">✕</button>
                    </div>
                  </div>
                  <p v-if="!blockerMap[`step-${index}`]?.blockers?.length" class="text-xs text-gray-400 italic">No blockers logged</p>
                  <button v-if="blockerMap[`step-${index}`]?.blockers?.length" @click="copyLog(`step-${index}`)" class="text-xs text-red-600 hover:underline">📋 Copy Log</button>
                  </template>
                </div>

                <!-- Feature #140 — Acceptance Tests -->
                <div class="hidden">
                  <button
                    @click="handleAcceptanceToggle(step, index)"
                    class="h-11 px-3 text-sm rounded bg-teal-600 hover:bg-teal-700 text-white flex items-center gap-1"
                    title="Generate Gherkin acceptance test scenarios"
                  >
                    🧪 Acceptance Tests
                  </button>
                  <span v-if="acceptanceMap[`step-${index}`]?.loading" class="text-xs text-gray-400">Generating…</span>
                </div>
                <div v-if="acceptanceMap[`step-${index}`]?.open" class="mt-2 ml-1 border-l-2 border-teal-300 pl-3 space-y-2">
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-[10px] font-semibold text-teal-600 uppercase tracking-wide">🧪 Acceptance Tests</span>
                    <div class="flex items-center gap-1">
                      <button type="button" title="Close" class="group w-3 h-3 flex items-center justify-center rounded-full bg-[#ff5f57] hover:bg-[#ff3b30] ring-1 ring-rose-900/20 transition-all duration-150 hover:scale-125 focus:outline-none" :aria-label="`Close Acceptance for ${step.name}`" @click="toggleAcceptanceOpen(`step-${index}`)"><span class="opacity-0 group-hover:opacity-100 transition-opacity duration-100 text-[#5c0000] text-[6px] font-black leading-none select-none">⊖</span></button>
                      <button type="button" title="Minimize" class="group w-3 h-3 flex items-center justify-center rounded-full bg-[#febc2e] hover:bg-[#f0a000] ring-1 ring-black/20 transition-all duration-150 hover:scale-125 focus:outline-none" :aria-label="`Minimize Acceptance for ${step.name}`" @click="acceptMinimized[`step-${index}`] = !acceptMinimized[`step-${index}`]"><span class="opacity-0 group-hover:opacity-100 transition-opacity duration-100 text-[#7e5000] text-[6px] font-black leading-none select-none">–</span></button>
                      <button type="button" title="Expand" class="group w-3 h-3 flex items-center justify-center rounded-full bg-[#28c840] hover:bg-[#20a832] ring-1 ring-black/20 transition-all duration-150 hover:scale-125 focus:outline-none" :aria-label="`Expand Acceptance for ${step.name}`" @click="expandedPanel = `acceptance-step-${index}`"><span class="opacity-0 group-hover:opacity-100 transition-opacity duration-100 text-[#006e1c] text-[6px] font-black leading-none select-none">+</span></button>
                    </div>
                  </div>
                  <template v-if="!acceptMinimized[`step-${index}`]">
                  <div
                    v-for="(sc, i) in acceptanceMap[`step-${index}`]?.scenarios ?? []"
                    :key="i"
                    class="text-xs bg-teal-50 border border-teal-200 rounded p-2 space-y-0.5"
                  >
                    <p class="font-medium text-teal-800">Scenario: {{ sc.title }}</p>
                    <p class="text-slate-600"><span class="font-medium">Given</span> {{ sc.given }}</p>
                    <p class="text-slate-600"><span class="font-medium">When</span> {{ sc.when }}</p>
                    <p class="text-slate-600"><span class="font-medium">Then</span> {{ sc.then }}</p>
                  </div>
                  <button
                    v-if="acceptanceMap[`step-${index}`]?.scenarios?.length"
                    @click="copyAcceptance(`step-${index}`)"
                    class="text-xs text-teal-600 hover:underline"
                  >{{ acceptanceCopied[`step-${index}`] ? '✅ Copied!' : '📋 Copy' }}</button>
                  </template>
                </div>

                <!-- Daily Standup row (Feature #145) -->
                <div class="hidden">
                  <button
                    @click="handleStandupToggle(step, index)"
                    class="h-11 px-3 text-sm rounded bg-green-700 hover:bg-green-800 text-white flex items-center gap-1"
                  >
                    📢 Standup
                  </button>
                </div>
                <div v-if="standupMap[`step-${index}`]?.open" class="mt-2 ml-1 border-l-2 border-green-300 pl-3 space-y-1 text-sm">
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-[10px] font-semibold text-green-600 uppercase tracking-wide">📢 Daily Standup</span>
                    <div class="flex items-center gap-1">
                      <button type="button" title="Close" class="group w-3 h-3 flex items-center justify-center rounded-full bg-[#ff5f57] hover:bg-[#ff3b30] ring-1 ring-rose-900/20 transition-all duration-150 hover:scale-125 focus:outline-none" :aria-label="`Close Standup for ${step.name}`" @click="toggleStandupOpen(`step-${index}`)"><span class="opacity-0 group-hover:opacity-100 transition-opacity duration-100 text-[#5c0000] text-[6px] font-black leading-none select-none">⊖</span></button>
                      <button type="button" title="Minimize" class="group w-3 h-3 flex items-center justify-center rounded-full bg-[#febc2e] hover:bg-[#f0a000] ring-1 ring-black/20 transition-all duration-150 hover:scale-125 focus:outline-none" :aria-label="`Minimize Standup for ${step.name}`" @click="standMinimized[`step-${index}`] = !standMinimized[`step-${index}`]"><span class="opacity-0 group-hover:opacity-100 transition-opacity duration-100 text-[#7e5000] text-[6px] font-black leading-none select-none">–</span></button>
                      <button type="button" title="Expand" class="group w-3 h-3 flex items-center justify-center rounded-full bg-[#28c840] hover:bg-[#20a832] ring-1 ring-black/20 transition-all duration-150 hover:scale-125 focus:outline-none" :aria-label="`Expand Standup for ${step.name}`" @click="expandedPanel = `standup-step-${index}`"><span class="opacity-0 group-hover:opacity-100 transition-opacity duration-100 text-[#006e1c] text-[6px] font-black leading-none select-none">+</span></button>
                    </div>
                  </div>
                  <template v-if="!standMinimized[`step-${index}`]">
                  <p><span class="font-medium text-green-700">Yesterday:</span> {{ standupMap[`step-${index}`]?.yesterday }}</p>
                  <p><span class="font-medium text-green-700">Today:</span> {{ standupMap[`step-${index}`]?.today }}</p>
                  <p><span :class="(standupMap[`step-${index}`]?.blockers ?? 'None') === 'None identified' ? 'text-gray-400' : 'text-red-600'" class="font-medium">Blockers:</span> {{ standupMap[`step-${index}`]?.blockers }}</p>
                  <button
                    v-if="standupMap[`step-${index}`]?.yesterday"
                    @click="copyStandup(`step-${index}`)"
                    class="text-xs text-green-600 hover:underline mt-1"
                  >📋 Copy</button>
                  </template>
                </div>

                <!-- Meeting Agenda row (Feature #148) -->
                <div class="hidden">
                  <button
                    @click="handleAgendaToggle(step, index)"
                    class="h-11 px-3 text-sm rounded bg-indigo-700 hover:bg-indigo-800 text-white flex items-center gap-1"
                  >
                    📅 Agenda
                  </button>
                </div>
                <div v-if="agendaMap[`step-${index}`]?.open" class="mt-2 ml-1 border-l-2 border-indigo-300 pl-3 space-y-2">
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-[10px] font-semibold text-indigo-600 uppercase tracking-wide">📅 Meeting Agenda</span>
                    <div class="flex items-center gap-1">
                      <button type="button" title="Close" class="group w-3 h-3 flex items-center justify-center rounded-full bg-[#ff5f57] hover:bg-[#ff3b30] ring-1 ring-rose-900/20 transition-all duration-150 hover:scale-125 focus:outline-none" :aria-label="`Close Agenda for ${step.name}`" @click="toggleAgendaOpen(`step-${index}`)"><span class="opacity-0 group-hover:opacity-100 transition-opacity duration-100 text-[#5c0000] text-[6px] font-black leading-none select-none">⊖</span></button>
                      <button type="button" title="Minimize" class="group w-3 h-3 flex items-center justify-center rounded-full bg-[#febc2e] hover:bg-[#f0a000] ring-1 ring-black/20 transition-all duration-150 hover:scale-125 focus:outline-none" :aria-label="`Minimize Agenda for ${step.name}`" @click="agendaMinimized[`step-${index}`] = !agendaMinimized[`step-${index}`]"><span class="opacity-0 group-hover:opacity-100 transition-opacity duration-100 text-[#7e5000] text-[6px] font-black leading-none select-none">–</span></button>
                      <button type="button" title="Expand" class="group w-3 h-3 flex items-center justify-center rounded-full bg-[#28c840] hover:bg-[#20a832] ring-1 ring-black/20 transition-all duration-150 hover:scale-125 focus:outline-none" :aria-label="`Expand Agenda for ${step.name}`" @click="expandedPanel = `agenda-step-${index}`"><span class="opacity-0 group-hover:opacity-100 transition-opacity duration-100 text-[#006e1c] text-[6px] font-black leading-none select-none">+</span></button>
                    </div>
                  </div>
                  <template v-if="!agendaMinimized[`step-${index}`]">
                  <p class="text-xs text-gray-500">45-minute structured meeting — {{ agendaMap[`step-${index}`]?.stepName }}</p>
                  <div v-for="s in agendaMap[`step-${index}`]?.sections ?? []" :key="s.title" class="text-sm">
                    <span class="font-medium text-indigo-700">{{ s.title }}</span>
                    <span class="text-xs text-gray-400 ml-1">({{ s.durationMinutes }} min)</span>
                    <p class="text-gray-600 text-xs mt-0.5">{{ s.content }}</p>
                  </div>
                  <button
                    v-if="agendaMap[`step-${index}`]?.sections?.length"
                    @click="copyAgenda(`step-${index}`)"
                    class="text-xs text-indigo-600 hover:underline"
                  >📋 Copy Agenda</button>
                  </template>
                </div>

                <!-- Spike detector row (Feature #125) -->
                <div class="hidden" v-if="spikeMap[`step-${index}`]?.flagged">
                  <button
                    @click="toggleSpikeOpen(`step-${index}`)"
                    class="h-11 px-3 text-sm rounded bg-orange-600 hover:bg-orange-700 text-white flex items-center gap-1"
                  >
                    ⚡ Spike <span class="ml-1 text-xs bg-white text-orange-600 rounded px-1">{{ spikeMap[`step-${index}`]?.flags?.length }}</span>
                  </button>
                </div>
                <div v-if="spikeMap[`step-${index}`]?.open" class="mt-2 ml-1 border-l-2 border-orange-300 pl-3 space-y-2">
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-[10px] font-semibold text-orange-500 uppercase tracking-wide">⚡ Spike Detector</span>
                    <div class="flex items-center gap-1">
                      <button type="button" title="Close" class="group w-3 h-3 flex items-center justify-center rounded-full bg-[#ff5f57] hover:bg-[#ff3b30] ring-1 ring-rose-900/20 transition-all duration-150 hover:scale-125 focus:outline-none" :aria-label="`Close Spike for ${step.name}`" @click="toggleSpikeOpen(`step-${index}`)"><span class="opacity-0 group-hover:opacity-100 transition-opacity duration-100 text-[#5c0000] text-[6px] font-black leading-none select-none">⊖</span></button>
                      <button type="button" title="Minimize" class="group w-3 h-3 flex items-center justify-center rounded-full bg-[#febc2e] hover:bg-[#f0a000] ring-1 ring-black/20 transition-all duration-150 hover:scale-125 focus:outline-none" :aria-label="`Minimize Spike for ${step.name}`" @click="spikeMinimized[`step-${index}`] = !spikeMinimized[`step-${index}`]"><span class="opacity-0 group-hover:opacity-100 transition-opacity duration-100 text-[#7e5000] text-[6px] font-black leading-none select-none">–</span></button>
                      <button type="button" title="Expand" class="group w-3 h-3 flex items-center justify-center rounded-full bg-[#28c840] hover:bg-[#20a832] ring-1 ring-black/20 transition-all duration-150 hover:scale-125 focus:outline-none" :aria-label="`Expand Spike for ${step.name}`" @click="expandedPanel = `spike-step-${index}`"><span class="opacity-0 group-hover:opacity-100 transition-opacity duration-100 text-[#006e1c] text-[6px] font-black leading-none select-none">+</span></button>
                    </div>
                  </div>
                  <template v-if="!spikeMinimized[`step-${index}`]">
                  <div v-for="(flag, fi) in spikeMap[`step-${index}`]?.flags ?? []" :key="fi" class="text-sm">
                    <span :class="flag.severity === 'high' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'" class="text-xs font-medium px-2 py-0.5 rounded mr-2">{{ flag.severity }}</span>
                    <span class="text-gray-700">{{ flag.reason }}</span>
                    <p class="text-xs text-orange-600 mt-1 italic">→ {{ flag.spikeTask }} ({{ flag.suggestedDuration }})</p>
                  </div>
                  <button
                    v-if="spikeMap[`step-${index}`]?.flags?.length"
                    @click="copySpike(`step-${index}`)"
                    class="text-xs text-orange-600 hover:underline"
                  >📋 Copy</button>
                  </template>
                </div>

                <!-- Feature #145 v2 — Standup Generator row -->
                <div class="hidden">
                  <button
                    type="button"
                    class="h-8 px-2 rounded text-xs border border-indigo-600 text-indigo-600 hover:bg-indigo-50 transition-colors"
                    :aria-label="`Toggle standup for ${step.name}`"
                    :data-testid="`standup-gen-toggle-${index}`"
                    @click="handleStandupGenToggle(index)"
                  >
                    📢 Standup
                    <span class="ml-1">{{ standupGenMap[`step-${index}`]?.isOpen ? '▲' : '▼' }}</span>
                  </button>
                  <button
                    v-if="standupGenMap[`step-${index}`]?.isOpen"
                    type="button"
                    class="h-8 px-2 rounded text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                    :aria-label="`Copy standup for ${step.name}`"
                    :data-testid="`standup-gen-copy-${index}`"
                    @click="copyStandupGen(`step-${index}`)"
                  >{{ standupCopied === `step-${index}` ? '✅ Copied!' : '📋 Copy' }}</button>
                </div>
                <div
                  v-if="standupGenMap[`step-${index}`]?.isOpen"
                  class="mt-1 ml-1 border-l-2 border-indigo-200 pl-3 space-y-1 text-xs"
                  :data-testid="`standup-gen-panel-${index}`"
                >
                  <p><span class="font-medium text-indigo-700">Yesterday:</span> {{ standupGenMap[`step-${index}`]?.yesterday }}</p>
                  <p><span class="font-medium text-indigo-700">Today:</span> {{ standupGenMap[`step-${index}`]?.today }}</p>
                  <p><span class="font-medium text-indigo-700">Blockers:</span> {{ standupGenMap[`step-${index}`]?.blockers }}</p>
                  <button type="button"
                    class="text-xs text-indigo-600 hover:underline mt-1"
                    :aria-label="`Copy standup for ${step.name}`"
                    :data-testid="`standup-gen-copy-${index}`"
                    @click="copyStandupGen(`step-${index}`)"
                  >{{ standupCopied === `step-${index}` ? '✅ Copied!' : '📋 Copy Standup' }}</button>
                </div>

                <!-- Feature #148 v2 — Meeting Agenda Generator row -->
                <div class="hidden">
                  <button
                    type="button"
                    class="h-8 px-2 rounded text-xs border border-violet-600 text-violet-600 hover:bg-violet-50 transition-colors"
                    :aria-label="`Toggle agenda for ${step.name}`"
                    :data-testid="`agenda-gen-toggle-${index}`"
                    @click="toggleAgendaGenOpen(`step-${index}`)"
                  >
                    📅 Agenda
                    <span class="ml-1">{{ agendaGenMap[`step-${index}`]?.isOpen ? '▲' : '▼' }}</span>
                  </button>
                  <button
                    v-if="agendaGenMap[`step-${index}`]?.isOpen"
                    type="button"
                    class="h-8 px-2 rounded text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                    :aria-label="`Copy agenda for ${step.name}`"
                    :data-testid="`agenda-gen-copy-${index}`"
                    @click="copyAgendaGen(`step-${index}`)"
                  >{{ agendaCopied === `step-${index}` ? '✅ Copied!' : '📋 Copy' }}</button>
                </div>
                <div
                  v-if="agendaGenMap[`step-${index}`]?.isOpen"
                  class="mt-1 ml-1 border-l-2 border-violet-200 pl-3 space-y-2"
                  :data-testid="`agenda-gen-panel-${index}`"
                >
                  <div
                    v-for="section in agendaGenMap[`step-${index}`]?.sections ?? []"
                    :key="section.title"
                    class="rounded border border-violet-100 bg-violet-50 px-2 py-1 text-xs"
                  >
                    <p class="font-medium text-violet-700">{{ section.title }} <span class="font-normal text-slate-400">({{ section.duration }} min)</span></p>
                    <p class="text-slate-600 mt-0.5">{{ section.content }}</p>
                  </div>
                  <button type="button"
                    class="text-xs text-violet-600 hover:underline mt-1"
                    :aria-label="`Copy agenda for ${step.name}`"
                    :data-testid="`agenda-gen-copy-${index}`"
                    @click="copyAgendaGen(`step-${index}`)"
                  >{{ agendaCopied === `step-${index}` ? '✅ Copied!' : '📋 Copy Agenda' }}</button>
                </div>

                <!-- Feature #180 — Sprint Review row -->
                <div class="mt-1">
                  <button
                    type="button"
                    class="hidden"
                    :aria-label="`Toggle sprint review for ${step.title ?? 'step'}`"
                    :data-testid="`sprint-review-toggle-${index}`"
                    @click="sprintReviewToggle(`step-${index}`)"
                  >
                    📋 Sprint Review
                  </button>
                  <div
                    v-if="sprintReviewIsOpen(`step-${index}`)"
                    class="mt-2 ml-1 border-l-2 border-stone-300 pl-3 space-y-2"
                    :data-testid="`sprint-review-panel-${index}`"
                  >
                    <div
                      v-for="section in getSprintReview(`step-${index}`, step.title ?? step.description ?? `Step ${index + 1}`).sections"
                      :key="section.title"
                      class="rounded border border-stone-200 bg-stone-50 px-2 py-2 text-xs"
                    >
                      <p class="font-medium text-stone-700 mb-1">{{ section.title }}</p>
                      <ul class="space-y-0.5">
                        <li v-for="item in section.items" :key="item" class="text-slate-600 before:content-['•'] before:mr-1">{{ item }}</li>
                      </ul>
                    </div>
                    <button
                      type="button"
                      class="text-xs text-slate-500 hover:underline mt-1"
                      :aria-label="`Copy sprint review for ${step.title ?? 'step'}`"
                      :data-testid="`sprint-review-copy-${index}`"
                      @click="copySprintReview(`step-${index}`)"
                    >
                      {{ sprintReviewCopied.has(`step-${index}`) ? '✅ Copied!' : '📋 Copy Review' }}
                    </button>
                  </div>
                </div>
              </div>

              <!-- Up/Down buttons (mobile fallback) -->
              <div v-if="!isConfirmed" class="flex flex-col gap-1 shrink-0">
                <button
                  type="button"
                  class="flex items-center justify-center min-w-[44px] min-h-[44px] rounded border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 disabled:opacity-40"
                  :disabled="index === 0"
                  :aria-label="`Move step ${index + 1} up`"
                  @click="moveUp(index)"
                >
                  ↑
                </button>
                <button
                  type="button"
                  class="flex items-center justify-center min-w-[44px] min-h-[44px] rounded border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 disabled:opacity-40"
                  :disabled="index === steps.length - 1"
                  :aria-label="`Move step ${index + 1} down`"
                  @click="moveDown(index)"
                >
                  ↓
                </button>
              </div>

              <!-- Remove button -->
              <button
                v-if="!isConfirmed"
                type="button"
                class="flex items-center justify-center min-w-[44px] min-h-[44px] rounded border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 shrink-0"
                :aria-label="`Remove step ${index + 1}: ${step.name}`"
                @click="removeStep(index)"
              >
                ✕
              </button>

              <!-- Copy step — admin action; separated from plan content -->
              <button
                type="button"
                class="flex items-center justify-center min-w-[44px] min-h-[44px] rounded border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700 shrink-0 transition-colors"
                :aria-label="`Copy step ${index + 1} details`"
                :data-testid="`step-copy-${index}`"
                :title="stepCardCopied[index] ? 'Copied!' : 'Copy step details'"
                @click="copyStepCard(step, index)"
              >{{ stepCardCopied[index] ? '✅' : '📋' }}</button>

              <!-- Feature #27: Risk expand button — dramatic colour-coded pill -->
              <button
                type="button"
                class="flex flex-col items-center justify-center gap-0.5 shrink-0 rounded-xl
                       min-w-[52px] min-h-[52px] border-2 font-bold transition-all duration-150
                       focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-400"
                :class="expandedRiskStep === index
                  ? 'scale-110 shadow-lg ring-2 ring-offset-1 bg-indigo-600 border-indigo-500 text-white ring-indigo-400'
                  : computeRisk(step, steps).complexity + computeRisk(step, steps).dependencies
                    + computeRisk(step, steps).resource  + computeRisk(step, steps).uncertainty > 2
                      ? 'bg-red-100 border-red-400 text-red-700 hover:bg-red-200 hover:scale-105 hover:shadow-md'
                      : computeRisk(step, steps).complexity + computeRisk(step, steps).dependencies
                        + computeRisk(step, steps).resource  + computeRisk(step, steps).uncertainty > 1
                          ? 'bg-amber-100 border-amber-400 text-amber-700 hover:bg-amber-200 hover:scale-105 hover:shadow-md'
                          : 'bg-emerald-100 border-emerald-400 text-emerald-700 hover:bg-emerald-200 hover:scale-105 hover:shadow-md'"
                :aria-label="`View risk detail for ${step.name}`"
                :data-testid="`risk-btn-${index}`"
                @click="expandedRiskStep = expandedRiskStep === index ? null : index"
              >
                <span class="text-xl leading-none" aria-hidden="true">{{
                  expandedRiskStep === index ? '🔬' :
                  computeRisk(step, steps).complexity + computeRisk(step, steps).dependencies
                  + computeRisk(step, steps).resource  + computeRisk(step, steps).uncertainty > 2
                    ? '🔴' : computeRisk(step, steps).complexity + computeRisk(step, steps).dependencies
                    + computeRisk(step, steps).resource  + computeRisk(step, steps).uncertainty > 1
                      ? '🟡' : '🟢'
                }}</span>
                <span class="text-[9px] uppercase tracking-wider leading-none">{{
                  expandedRiskStep === index ? 'close' : 'risk'
                }}</span>
              </button>
            </div>

            <!-- Feature #27: Expanded risk detail panel (shown below card when expanded) -->
            <div
              v-if="expandedRiskStep === index"
              class="border-t border-gray-100 px-4 py-4 bg-gray-50 rounded-b-lg"
              :data-testid="`risk-panel-${index}`"
            >
              <div class="flex items-center gap-6">
                <RiskRadar
                  :scores="computeRisk(step, steps)"
                  :size="180"
                  :expanded="true"
                />
                <div class="flex-1 min-w-0">
                  <!-- Four score rows -->
                  <ul class="space-y-1 text-sm text-gray-700">
                    <li>
                      <span class="font-medium">Complexity</span>
                      {{ Math.round(computeRisk(step, steps).complexity * 100) }}%
                      ·
                      <span class="font-medium">Dependencies</span>
                      {{ Math.round(computeRisk(step, steps).dependencies * 100) }}%
                      ·
                      <span class="font-medium">Resource</span>
                      {{ Math.round(computeRisk(step, steps).resource * 100) }}%
                      ·
                      <span class="font-medium">Uncertainty</span>
                      {{ Math.round(computeRisk(step, steps).uncertainty * 100) }}%
                    </li>
                  </ul>
                  <p class="mt-2 text-xs text-gray-400 italic">
                    Risk score based on effort %, shared value dependencies, and name-hash uncertainty estimate
                  </p>
                </div>
              </div>
              <!-- Close button -->
              <div class="mt-3 flex justify-end">
                <button
                  type="button"
                  class="flex items-center justify-center min-h-[44px] min-w-[44px] rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 text-lg"
                  :aria-label="`Close risk detail for ${step.name}`"
                  :data-testid="`risk-close-${index}`"
                  @click="expandedRiskStep = null"
                >
                  ×
                </button>
              </div>
            </div>
          </li>
        </ol>

        <!-- Confirm Plan button -->
        <div class="mt-6">
          <div
            v-if="confirmError"
            class="mb-3 rounded-lg bg-red-50 border border-red-200 p-3"
            role="alert"
          >
            <p class="text-red-700 text-sm">{{ confirmError }}</p>
          </div>

          <button
            type="button"
            class="w-full flex items-center justify-center min-h-[44px] rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-300 disabled:cursor-not-allowed"
            :disabled="!canConfirm"
            aria-label="Confirm Plan"
            @click="handleConfirm"
          >
            <span v-if="confirming">Saving plan…</span>
            <span v-else-if="isConfirmed">Plan Confirmed</span>
            <span v-else>Confirm Plan</span>
          </button>
        </div>

        <!-- ── Sharpen this plan — bottom strip ───────────────────────────── -->
        <div class="flex items-center justify-between mt-4 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200">
          <p class="text-xs text-amber-700 font-medium">
            Not quite right? Sharpen the spec and regenerate.
          </p>
          <button
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-full
                   bg-amber-500 text-white text-xs font-semibold
                   hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-1
                   transition-colors flex-shrink-0"
            @click="emit('sharpen-plan')"
          >
            🔪 Sharpen this plan
          </button>
        </div>

        <!-- ── Evo Simulator CTA — bottom of steps list ───────────────────── -->
        <div class="flex items-center justify-between mt-3 px-3 py-2 rounded-xl bg-green-50 border border-green-200">
          <p class="text-xs text-green-700 font-medium">
            Watch value accumulate across your steps — animated delivery timeline.
          </p>
          <button
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-full
                   bg-green-600 text-white text-xs font-semibold
                   hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-1
                   transition-colors flex-shrink-0"
            aria-label="Open Evo Simulator"
            @click="emit('open-evo-simulator')"
          >
            ▶ Evo Simulator
          </button>
        </div>

        <!-- ── Feature #5: What If Resource Slider ─────────────────────────── -->
        <div
          v-if="showWhatIf"
          class="mt-8"
          data-testid="whatif-slider"
          aria-label="What If resource slider"
        >
          <h3 class="text-base font-semibold text-gray-900 mb-3">What If Resource Planning</h3>

          <!-- Slider -->
          <div class="flex items-center gap-4 mb-4">
            <label for="hours-slider" class="text-sm text-gray-700 whitespace-nowrap font-medium">
              Available hours / week
            </label>
            <input
              id="hours-slider"
              v-model.number="hoursPerWeek"
              type="range"
              min="1"
              max="40"
              step="1"
              class="flex-1 h-2 accent-blue-600"
              aria-label="Available hours per week"
              aria-valuemin="1"
              aria-valuemax="40"
              :aria-valuenow="hoursPerWeek"
            />
            <span class="text-sm font-semibold text-blue-700 w-8 text-right">{{ hoursPerWeek }}</span>
          </div>

          <!-- Per-step rows -->
          <ul class="space-y-1 mb-4">
            <li
              v-for="row in whatIfRows"
              :key="row.name"
              class="flex justify-between text-sm text-gray-700"
            >
              <span class="truncate max-w-[60%]">{{ row.name }}</span>
              <span class="text-gray-500">ends {{ row.endDate }}</span>
            </li>
          </ul>

          <!-- Summary banner -->
          <div
            class="rounded-lg bg-blue-50 border border-blue-200 px-4 py-2 text-sm text-blue-800"
            data-testid="whatif-summary"
          >
            At {{ hoursPerWeek }} hrs/week — all steps complete by {{ whatIfSummaryDate }}
          </div>
        </div>
      </div>

      <!-- ══ TIMELINE TAB — retired: charts now in 📊 VisualisePanelModal ═════ -->
      <div v-if="false" id="tabpanel-timeline">
        <!-- Placeholder when not confirmed or no steps -->
        <div
          v-if="showTimelinePlaceholder"
          class="rounded-lg bg-gray-100 border border-gray-200 p-10 text-center text-gray-500 text-sm"
          data-testid="timeline-placeholder"
        >
          Confirm the Evo plan to see the timeline diagram
        </div>

        <!-- SVG Timeline chart -->
        <template v-else>
          <h2 class="text-lg font-semibold text-gray-900 mb-4">Value Delivery Timeline</h2>
          <svg
            :viewBox="`0 0 ${TIMELINE_VIEW_WIDTH} ${TIMELINE_VIEW_HEIGHT}`"
            width="100%"
            height="auto"
            aria-label="Value Delivery Timeline chart"
            role="img"
          >
            <!-- Y-axis grid lines -->
            <g v-for="line in timelineGridLines" :key="line.pct">
              <line
                :x1="TIMELINE_PADDING_LEFT"
                :y1="line.y"
                :x2="TIMELINE_VIEW_WIDTH - TIMELINE_PADDING_RIGHT"
                :y2="line.y"
                stroke="#e5e7eb"
                stroke-width="1"
                stroke-dasharray="4,4"
              />
              <text
                :x="TIMELINE_PADDING_LEFT - 6"
                :y="line.y + 4"
                fill="#9ca3af"
                font-size="10"
                text-anchor="end"
              >{{ line.pct }}%</text>
            </g>

            <!-- X-axis step labels -->
            <g v-for="lbl in timelineXLabels" :key="lbl.label">
              <text
                :x="lbl.x"
                :y="TIMELINE_VIEW_HEIGHT - TIMELINE_PADDING_BOTTOM + 16"
                fill="#6b7280"
                font-size="9"
                text-anchor="middle"
              >{{ lbl.label }}</text>
            </g>

            <!-- Projected dates below x-axis labels -->
            <g v-for="(d, di) in timelineProjectedDates" :key="`date-${di}`">
              <text
                :x="d.x"
                :y="TIMELINE_VIEW_HEIGHT - TIMELINE_PADDING_BOTTOM + 30"
                fill="#9ca3af"
                font-size="8"
                text-anchor="middle"
              >{{ d.date }}</text>
            </g>

            <!-- Cost curve (amber) -->
            <polyline
              v-if="costPolylinePoints"
              :points="costPolylinePoints"
              fill="none"
              stroke="#f59e0b"
              stroke-width="2"
              stroke-linejoin="round"
              stroke-linecap="round"
            />
            <!-- Cost dots -->
            <circle
              v-for="(pt, pi) in valueCurvePoints"
              :key="`cost-dot-${pi}`"
              :cx="pt.x"
              :cy="TIMELINE_PADDING_TOP + timelineChartHeight * (1 - Math.min(100, steps.slice(0, pi + 1).reduce((s, st) => s + st.effortPercent, 0)) / 100)"
              r="4"
              fill="#f59e0b"
            />

            <!-- Value curve (emerald) -->
            <polyline
              v-if="valuePolylinePoints"
              :points="valuePolylinePoints"
              fill="none"
              stroke="#10b981"
              stroke-width="2"
              stroke-linejoin="round"
              stroke-linecap="round"
            />
            <!-- Value dots -->
            <circle
              v-for="(pt, pi) in valueCurvePoints"
              :key="`value-dot-${pi}`"
              :cx="pt.x"
              :cy="pt.y"
              r="4"
              fill="#10b981"
            />

            <!-- Legend top-right -->
            <g>
              <circle cx="490" cy="18" r="5" fill="#10b981" />
              <text x="500" y="22" fill="#10b981" font-size="11" font-weight="600">Value</text>
              <circle cx="550" cy="18" r="5" fill="#f59e0b" />
              <text x="560" y="22" fill="#f59e0b" font-size="11" font-weight="600">Cost</text>
            </g>

            <!-- Axes -->
            <!-- Y axis -->
            <line
              :x1="TIMELINE_PADDING_LEFT"
              :y1="TIMELINE_PADDING_TOP"
              :x2="TIMELINE_PADDING_LEFT"
              :y2="TIMELINE_PADDING_TOP + timelineChartHeight"
              stroke="#d1d5db"
              stroke-width="1"
            />
            <!-- X axis -->
            <line
              :x1="TIMELINE_PADDING_LEFT"
              :y1="TIMELINE_PADDING_TOP + timelineChartHeight"
              :x2="TIMELINE_VIEW_WIDTH - TIMELINE_PADDING_RIGHT"
              :y2="TIMELINE_PADDING_TOP + timelineChartHeight"
              stroke="#d1d5db"
              stroke-width="1"
            />
          </svg>
        </template>
      </div>

      <!-- ══ COVERAGE TAB (Feature #3) ════════════════════════════════════════ -->
      <div v-if="false" id="tabpanel-coverage"
        data-testid="coverage-section"
      >
        <!-- Placeholder when not confirmed or no steps -->
        <div
          v-if="showCoveragePlaceholder"
          class="rounded-lg bg-gray-100 border border-gray-200 p-10 text-center text-gray-500 text-sm"
          data-testid="coverage-placeholder"
        >
          Confirm the Evo plan to see stakeholder coverage
        </div>

        <!-- Fallback: not enough linked values -->
        <div
          v-else-if="showRadialFallback"
          class="rounded-lg bg-amber-50 border border-amber-200 p-10 text-center text-amber-700 text-sm"
          data-testid="coverage-fallback"
        >
          Not enough linked values to draw radial chart (need ≥3)
        </div>

        <!-- SVG Radial chart -->
        <template v-else>
          <h2 class="text-lg font-semibold text-gray-900 mb-4">Stakeholder Coverage</h2>
          <svg
            viewBox="0 0 440 440"
            width="100%"
            height="auto"
            aria-label="Stakeholder coverage radial chart"
            role="img"
          >
            <!-- Background rings -->
            <circle
              v-for="ring in radialRings"
              :key="ring.pct"
              :cx="RADIAL_CX"
              :cy="RADIAL_CY"
              :r="ring.r"
              fill="none"
              stroke="#d1d5db"
              stroke-width="1"
              stroke-dasharray="4,4"
            />

            <!-- Spokes -->
            <line
              v-for="(tip, si) in spokeTips"
              :key="`spoke-${si}`"
              :x1="RADIAL_CX"
              :y1="RADIAL_CY"
              :x2="tip.x"
              :y2="tip.y"
              stroke="#e5e7eb"
              stroke-width="1"
            />

            <!-- Step polygons -->
            <polygon
              v-for="(step, si) in steps"
              :key="`poly-${si}`"
              :points="stepPolygonPoints(si)"
              :fill="stepColours[si]"
              fill-opacity="0.18"
              :stroke="stepColours[si]"
              stroke-width="1.5"
            />

            <!-- Spoke labels -->
            <text
              v-for="(lbl, li) in spokeLabels"
              :key="`lbl-${li}`"
              :x="lbl.x"
              :y="lbl.y"
              fill="#374151"
              font-size="10"
              text-anchor="middle"
              dominant-baseline="middle"
            >{{ lbl.label }}</text>

            <!-- Feature #55: Goals overlay polygon — amber dashed, normalised goal values -->
            <polygon
              v-if="showGoalsOverlay"
              :points="goalsOverlayPoints"
              fill="rgba(251,191,36,0.12)"
              stroke="#f59e0b"
              stroke-width="1.5"
              stroke-dasharray="4 3"
              data-testid="goals-overlay-polygon"
            />
          </svg>

          <!-- Legend below chart -->
          <ul class="mt-4 flex flex-wrap gap-3">
            <li
              v-for="(step, si) in steps"
              :key="`legend-${si}`"
              class="flex items-center gap-1.5 text-xs text-gray-700"
            >
              <span
                class="inline-block w-3 h-3 rounded-full shrink-0"
                :style="{ backgroundColor: stepColours[si] }"
                aria-hidden="true"
              />
              {{ step.name }}
            </li>
            <!-- Feature #55: Goals overlay legend entry -->
            <li
              v-if="showGoalsOverlay"
              class="flex items-center gap-1.5 text-xs text-gray-700"
              data-testid="goals-overlay-legend"
            >
              <svg width="20" height="10" aria-hidden="true">
                <line x1="0" y1="5" x2="20" y2="5" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="4 3" />
              </svg>
              &#9678; Value Goals
            </li>
          </ul>
        </template>
      </div>
      <!-- ══ DEPENDENCIES TAB — retired ═════════════════════════════════════ -->
      <div v-if="false" id="tabpanel-dependencies">
        <!-- Placeholder: plan not confirmed or no steps -->
        <div
          v-if="showDepPlaceholder"
          class="py-16 text-center text-gray-400 text-sm"
          data-testid="dependencies-placeholder"
        >
          Confirm the Evo plan to see the dependency graph
        </div>

        <!-- Fallback: only 1 step -->
        <div
          v-else-if="showDepFallback"
          class="py-8 text-center text-gray-500 text-sm"
          data-testid="dependencies-fallback"
        >
          Add more Evo steps to see dependencies
        </div>

        <!-- SVG dependency graph -->
        <template v-else>
          <h2 class="text-lg font-semibold text-gray-900 mb-4">Evo Step Dependencies</h2>

          <svg
            :viewBox="depViewBox"
            width="100%"
            height="auto"
            aria-label="Evo step dependency graph"
            role="img"
            data-testid="dependencies-svg"
          >
            <defs>
              <!-- Arrowhead marker — ID is unique per mount to avoid browser
                   caching bugs when the SVG is destroyed/recreated via v-if -->
              <marker
                :id="depArrowMarkerId"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#818cf8" />
              </marker>
            </defs>

            <!-- Dependency arrows -->
            <path
              v-for="(edge, ei) in depEdges"
              :key="`edge-${ei}`"
              :d="depArrowPath(edge.from, edge.to)"
              fill="none"
              stroke="#818cf8"
              stroke-width="1.5"
              :marker-end="`url(#${depArrowMarkerId})`"
              :data-testid="`dep-arrow-${ei}`"
            />

            <!-- Step nodes -->
            <g
              v-for="(node, ni) in depNodes"
              :key="`node-${ni}`"
              :data-testid="`dep-node-${ni}`"
            >
              <rect
                :x="node.x"
                :y="node.y"
                :width="DEP_NODE_W"
                :height="DEP_NODE_H"
                rx="8"
                fill="white"
                stroke="#818cf8"
                stroke-width="2"
              />
              <text
                :x="node.cx"
                :y="node.cy + 1"
                text-anchor="middle"
                dominant-baseline="middle"
                font-size="11"
                fill="#312e81"
              >{{ node.label }}</text>
            </g>
          </svg>

          <!-- ── What If Resource Slider (same as Plan tab) ─────────────────── -->
          <div
            v-if="showWhatIf"
            class="mt-8"
            data-testid="dep-whatif-slider"
            aria-label="What If resource slider"
          >
            <h3 class="text-base font-semibold text-gray-900 mb-3">What If Resource Planning</h3>

            <!-- Slider -->
            <div class="flex items-center gap-4 mb-4">
              <label for="hours-slider-dep" class="text-sm text-gray-700 whitespace-nowrap font-medium">
                Available hours / week
              </label>
              <input
                id="hours-slider-dep"
                v-model.number="hoursPerWeek"
                type="range"
                min="1"
                max="40"
                step="1"
                class="flex-1 h-2 accent-blue-600"
                aria-label="Available hours per week"
                aria-valuemin="1"
                aria-valuemax="40"
                :aria-valuenow="hoursPerWeek"
              />
              <span class="text-sm font-semibold text-blue-700 w-8 text-right">{{ hoursPerWeek }}</span>
            </div>

            <!-- Per-step rows -->
            <ul class="space-y-1 mb-4">
              <li
                v-for="row in whatIfRows"
                :key="row.name"
                class="flex justify-between text-sm text-gray-700"
              >
                <span class="truncate max-w-[60%]">{{ row.name }}</span>
                <span class="text-gray-500">ends {{ row.endDate }}</span>
              </li>
            </ul>

            <!-- Summary banner -->
            <div
              class="rounded-lg bg-blue-50 border border-blue-200 px-4 py-2 text-sm text-blue-800"
              data-testid="dep-whatif-summary"
            >
              At {{ hoursPerWeek }} hrs/week — all steps complete by {{ whatIfSummaryDate }}
            </div>
          </div>
        </template>
      </div>

      <!-- ══ GANTT TAB — retired ══════════════════════════════════════════════ -->
      <div v-if="false" id="tabpanel-gantt">
        <!-- Placeholder when not confirmed or no steps -->
        <div
          v-if="showGanttPlaceholder"
          class="rounded-lg bg-gray-100 border border-gray-200 p-10 text-center text-gray-500 text-sm"
          data-testid="gantt-placeholder"
        >
          Confirm the Evo plan to see the Gantt chart
        </div>

        <!-- SVG Gantt chart -->
        <template v-else>
          <h2 class="text-lg font-semibold text-gray-900 mb-4">Milestone / Gantt Chart</h2>
          <svg
            :viewBox="ganttViewBox"
            width="100%"
            height="auto"
            aria-label="Gantt chart showing Evo step schedule"
            role="img"
            data-testid="gantt-svg"
          >
            <!-- Top axis: date labels, one tick per week -->
            <!-- Show a subset of ticks to avoid clutter (every 1 or 2 weeks) -->
            <g data-testid="gantt-axis">
              <line
                :x1="GANTT_LABEL_W"
                y1="50"
                :x2="700"
                y2="50"
                stroke="#d1d5db"
                stroke-width="1"
              />
              <g
                v-for="(tick, ti) in ganttAxisTicks"
                :key="`tick-${ti}`"
              >
                <line
                  :x1="tick.x"
                  y1="44"
                  :x2="tick.x"
                  y2="50"
                  stroke="#9ca3af"
                  stroke-width="1"
                />
                <!-- Show label every 2 weeks to avoid overlap -->
                <text
                  v-if="ti % 2 === 0"
                  :x="tick.x"
                  y="40"
                  fill="#6b7280"
                  font-size="8"
                  text-anchor="middle"
                >{{ tick.label }}</text>
              </g>
            </g>

            <!-- Today vertical line (dashed red, only if today is within project range) -->
            <line
              v-if="ganttTodayX !== null"
              :x1="ganttTodayX"
              y1="44"
              :x2="ganttTodayX"
              :y2="ganttSvgHeight - 10"
              stroke="#ef4444"
              stroke-width="1.5"
              stroke-dasharray="4,3"
              data-testid="gantt-today-line"
            />

            <!-- Per-step bars -->
            <g
              v-for="row in ganttRows"
              :key="`gantt-row-${row.index}`"
              :data-testid="`gantt-row-${row.index}`"
            >
              <!-- Bar -->
              <rect
                :x="row.startX"
                :y="row.barY"
                :width="row.barWidth"
                height="24"
                rx="4"
                :fill="row.colour"
                :data-testid="`gantt-bar-${row.index}`"
              />

              <!-- Step name label — left of bar, truncated 12 chars -->
              <text
                :x="GANTT_LABEL_W - 6"
                :y="row.barY + 16"
                fill="#374151"
                font-size="10"
                text-anchor="end"
                :data-testid="`gantt-label-${row.index}`"
              >{{ row.labelText }}</text>

              <!-- End date label — right of bar -->
              <text
                :x="row.endX + 4"
                :y="row.barY + 16"
                fill="#6b7280"
                font-size="9"
                text-anchor="start"
                :data-testid="`gantt-enddate-${row.index}`"
              >{{ row.endDateLabel }}</text>
            </g>

            <!-- Dependency arrows: thin gray lines from right edge of A to left edge of B -->
            <line
              v-for="(edge, ei) in depEdges"
              :key="`gantt-dep-${ei}`"
              :x1="ganttRows[edge.from]?.endX ?? 0"
              :y1="(ganttRows[edge.from]?.barY ?? 0) + 12"
              :x2="ganttRows[edge.to]?.startX ?? 0"
              :y2="(ganttRows[edge.to]?.barY ?? 0) + 12"
              stroke="#9ca3af"
              stroke-width="1"
              :data-testid="`gantt-dep-arrow-${ei}`"
            />
          </svg>
        </template>
      </div>

      <!-- ══ EFFORT BREAKDOWN TAB — retired ════════════════════════════════════ -->
      <div v-if="false" id="tabpanel-effort">
        <!-- Placeholder when not confirmed or no steps -->
        <div
          v-if="showEffortPlaceholder"
          class="rounded-lg bg-gray-100 border border-gray-200 p-10 text-center text-gray-500 text-sm"
          data-testid="effort-placeholder"
        >
          Confirm the Evo plan to see the effort breakdown
        </div>

        <!-- Per-step doughnut grid -->
        <template v-else>
          <h2 class="text-lg font-semibold text-gray-900 mb-1">Effort Breakdown by Step</h2>
          <p class="text-sm text-gray-500 mb-5">
            Each doughnut shows the estimated time split across F. (function), V. (value), and S. (solution) work.
          </p>

          <div class="grid grid-cols-2 gap-4" data-testid="effort-grid">
            <div
              v-for="(entry, ei) in effortBreakdowns"
              :key="`effort-${ei}`"
              class="rounded-lg border border-gray-200 bg-white shadow-sm p-4 flex flex-col items-center gap-2"
              :data-testid="`effort-card-${ei}`"
            >
              <!-- Step name -->
              <p class="text-xs font-semibold text-gray-800 text-center truncate w-full">
                {{ entry.step.name }}
              </p>

              <!-- Doughnut SVG -->
              <svg
                viewBox="0 0 88 88"
                width="88"
                height="88"
                :aria-label="`Effort breakdown doughnut for ${entry.step.name}`"
                role="img"
                :data-testid="`effort-doughnut-${ei}`"
              >
                <path
                  v-for="(slice, si) in entry.paths"
                  :key="`slice-${si}`"
                  :d="slice.path"
                  :fill="slice.colour"
                  :data-testid="`effort-slice-${ei}-${si}`"
                />
                <!-- Centre label: total hours -->
                <text
                  x="44"
                  y="40"
                  text-anchor="middle"
                  dominant-baseline="middle"
                  font-size="11"
                  font-weight="700"
                  fill="#1f2937"
                >{{ entry.totalHours }}h</text>
                <text
                  x="44"
                  y="53"
                  text-anchor="middle"
                  dominant-baseline="middle"
                  font-size="7"
                  fill="#6b7280"
                >total</text>
              </svg>

              <!-- Slice legend -->
              <ul class="w-full space-y-1">
                <li
                  v-for="(slice, si) in entry.paths"
                  :key="`legend-${si}`"
                  class="flex items-center justify-between text-xs text-gray-700"
                >
                  <span class="flex items-center gap-1">
                    <span
                      class="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                      :style="{ backgroundColor: slice.colour }"
                      aria-hidden="true"
                    />
                    {{ slice.label }}
                  </span>
                  <span class="font-medium">{{ slice.hours }}h</span>
                </li>
              </ul>
            </div>
          </div>

          <!-- Summary legend -->
          <div class="mt-6 flex flex-wrap gap-4 text-xs text-gray-600" data-testid="effort-legend">
            <span class="flex items-center gap-1.5">
              <span class="w-3 h-3 rounded-sm bg-indigo-500 inline-block" aria-hidden="true" />
              F. Work — function delivery
            </span>
            <span class="flex items-center gap-1.5">
              <span class="w-3 h-3 rounded-sm bg-emerald-500 inline-block" aria-hidden="true" />
              V. Work — value measurement
            </span>
            <span class="flex items-center gap-1.5">
              <span class="w-3 h-3 rounded-sm bg-amber-400 inline-block" aria-hidden="true" />
              S. Work — solution implementation
            </span>
          </div>
        </template>
      </div>

      <!-- ══ SKILLS TAB — retired ═════════════════════════════════════════════ -->
      <div v-if="false" id="tabpanel-skills">
        <!-- Feature #58 — Team Skills Matrix -->
        <div class="mt-4">
          <p class="text-xs text-slate-500 mb-3">Skill demand inferred from Evo step descriptions. 0 = none, 3 = high.</p>

          <div v-if="steps.length === 0 || !isConfirmed" class="text-sm text-slate-400 text-center py-8" data-testid="skills-placeholder">
            Confirm a plan to see the skills matrix
          </div>

          <div v-else class="overflow-x-auto" data-testid="skills-matrix">
            <table class="text-xs border-collapse min-w-full">
              <!-- Column headers: Evo step names (truncated) -->
              <thead>
                <tr>
                  <th class="text-left pr-3 py-1 text-slate-400 font-normal min-w-[80px]">Skill</th>
                  <th
                    v-for="step in steps"
                    :key="step.name"
                    class="text-center py-1 px-2 text-slate-500 font-normal max-w-[80px] truncate"
                    :title="step.name"
                  >
                    {{ step.name.slice(0, 8) }}…
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(skill, si) in SKILL_CATEGORIES" :key="skill.name">
                  <td class="pr-3 py-1.5 whitespace-nowrap">
                    <span class="inline-flex items-center gap-1">
                      <span class="inline-block w-2 h-2 rounded-full" :style="{ backgroundColor: skill.colour }" />
                      {{ skill.name }}
                    </span>
                  </td>
                  <td
                    v-for="(level, ti) in skillsMatrix[si]"
                    :key="ti"
                    class="text-center py-1.5 px-2 rounded"
                    :style="skillCellStyle(level, skill.colour)"
                    :title="`${skill.name} × ${steps[ti]?.name}: ${['none','low','med','high'][level]}`"
                  >
                    <span v-if="level > 0" class="font-mono">{{ level }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Legend -->
          <div class="flex items-center gap-3 mt-3 text-xs text-slate-400">
            <span>Level:</span>
            <span class="flex items-center gap-1"><span class="inline-block w-3 h-3 rounded bg-slate-100" />0 none</span>
            <span class="flex items-center gap-1"><span class="inline-block w-3 h-3 rounded bg-blue-200" />1 low</span>
            <span class="flex items-center gap-1"><span class="inline-block w-3 h-3 rounded bg-blue-400" />2 med</span>
            <span class="flex items-center gap-1"><span class="inline-block w-3 h-3 rounded bg-blue-600 opacity-85" />3 high</span>
          </div>
        </div>
      </div>

      <!-- ══ BUBBLE TAB — retired ══════════════════════════════════════════════ -->
      <div v-if="false" id="tabpanel-bubble">
        <!-- Placeholder when no steps -->
        <div
          v-if="steps.length === 0"
          class="rounded-lg bg-gray-100 border border-gray-200 p-10 text-center text-gray-500 text-sm"
          data-testid="bubble-placeholder"
        >
          Add Evo steps to see the Impact vs Effort chart
        </div>

        <!-- Bubble chart -->
        <template v-else>
          <h2 class="text-lg font-semibold text-gray-900 mb-2">Impact vs Effort</h2>
          <p class="text-xs text-slate-500 mb-4">
            Each bubble is an Evo step. X = effort %, Y = estimated impact (rank-derived). Bubble size = effort scale.
          </p>

          <!-- SVG scatter plot -->
          <svg
            viewBox="0 0 500 320"
            width="100%"
            height="auto"
            aria-label="Impact vs Effort bubble chart"
            role="img"
            data-testid="bubble-svg"
          >
            <!-- ── Grid lines at 25% intervals ── -->
            <!-- Horizontal grid lines (y axis) -->
            <line v-for="pct in [25, 50, 75, 100]" :key="`hgrid-${pct}`"
              :x1="40" :y1="20 + (270 * (1 - pct / 100))"
              :x2="480" :y2="20 + (270 * (1 - pct / 100))"
              stroke="#f1f5f9" stroke-width="1"
            />
            <!-- Vertical grid lines (x axis) -->
            <line v-for="pct in [25, 50, 75, 100]" :key="`vgrid-${pct}`"
              :x1="40 + (440 * pct / 100)" :y1="20"
              :x2="40 + (440 * pct / 100)" :y2="290"
              stroke="#f1f5f9" stroke-width="1"
            />

            <!-- ── Y axis ── -->
            <line x1="40" y1="20" x2="40" y2="290" stroke="#d1d5db" stroke-width="1" />
            <!-- Y axis ticks and labels -->
            <g v-for="pct in [0, 25, 50, 75, 100]" :key="`ytick-${pct}`">
              <line
                x1="35" :y1="20 + 270 * (1 - pct / 100)"
                x2="40" :y2="20 + 270 * (1 - pct / 100)"
                stroke="#9ca3af" stroke-width="1"
              />
              <text
                x="32" :y="20 + 270 * (1 - pct / 100) + 4"
                fill="#9ca3af" font-size="9" text-anchor="end"
              >{{ pct }}%</text>
            </g>
            <!-- Y axis label (rotated) -->
            <text
              x="10" y="155"
              fill="#6b7280" font-size="10" text-anchor="middle"
              transform="rotate(-90 10 155)"
            >Impact %</text>

            <!-- ── X axis ── -->
            <line x1="40" y1="290" x2="480" y2="290" stroke="#d1d5db" stroke-width="1" />
            <!-- X axis ticks and labels -->
            <g v-for="pct in [0, 25, 50, 75, 100]" :key="`xtick-${pct}`">
              <line
                :x1="40 + 440 * pct / 100" y1="290"
                :x2="40 + 440 * pct / 100" y2="295"
                stroke="#9ca3af" stroke-width="1"
              />
              <text
                :x="40 + 440 * pct / 100" y="306"
                fill="#9ca3af" font-size="9" text-anchor="middle"
              >{{ pct }}%</text>
            </g>
            <!-- X axis label -->
            <text
              x="260" y="318"
              fill="#6b7280" font-size="10" text-anchor="middle"
            >Effort %</text>

            <!-- ── Bubbles ── -->
            <g
              v-for="point in bubblePoints"
              :key="point.stepId"
              style="cursor:pointer"
              :data-testid="`bubble-point-${point.stepId}`"
              @click="bubbleSelectStep(point.stepId === bubbleSelectedId ? null : point.stepId)"
            >
              <!-- Circle -->
              <circle
                :cx="40 + 440 * point.x / 100"
                :cy="20 + 270 * (1 - point.y / 100)"
                :r="point.radius"
                :fill="point.colour"
                :fill-opacity="point.selected ? 1 : 0.7"
                :stroke="point.selected ? '#374151' : 'none'"
                :stroke-width="point.selected ? 2 : 0"
              />
              <!-- Label below bubble -->
              <text
                :x="40 + 440 * point.x / 100"
                :y="20 + 270 * (1 - point.y / 100) + point.radius + 12"
                fill="#374151" font-size="10" text-anchor="middle"
              >{{ point.title }}</text>
            </g>

            <!-- ── Tooltip for selected bubble ── -->
            <g
              v-if="bubbleSelectedId && bubblePoints.find(p => p.stepId === bubbleSelectedId)"
              data-testid="bubble-tooltip"
            >
              <!-- Compute tooltip position based on selected point -->
              <rect
                v-if="bubblePoints.find(p => p.stepId === bubbleSelectedId)"
                :x="Math.min(360, 40 + 440 * (bubblePoints.find(p => p.stepId === bubbleSelectedId)!.x) / 100 + 10)"
                :y="Math.max(10, 20 + 270 * (1 - (bubblePoints.find(p => p.stepId === bubbleSelectedId)!.y) / 100) - 36)"
                width="130" height="36"
                rx="4" fill="white"
                stroke="#e2e8f0" stroke-width="1"
              />
              <text
                v-if="bubblePoints.find(p => p.stepId === bubbleSelectedId)"
                :x="Math.min(365, 40 + 440 * (bubblePoints.find(p => p.stepId === bubbleSelectedId)!.x) / 100 + 15)"
                :y="Math.max(24, 20 + 270 * (1 - (bubblePoints.find(p => p.stepId === bubbleSelectedId)!.y) / 100) - 22)"
                fill="#374151" font-size="9" font-weight="600"
              >{{ bubblePoints.find(p => p.stepId === bubbleSelectedId)!.title }}</text>
              <text
                v-if="bubblePoints.find(p => p.stepId === bubbleSelectedId)"
                :x="Math.min(365, 40 + 440 * (bubblePoints.find(p => p.stepId === bubbleSelectedId)!.x) / 100 + 15)"
                :y="Math.max(36, 20 + 270 * (1 - (bubblePoints.find(p => p.stepId === bubbleSelectedId)!.y) / 100) - 10)"
                fill="#6b7280" font-size="9"
              >Effort: {{ Math.round(bubblePoints.find(p => p.stepId === bubbleSelectedId)!.x) }}%, Impact: ~{{ Math.round(bubblePoints.find(p => p.stepId === bubbleSelectedId)!.y) }}%</text>
            </g>
          </svg>
        </template>
      </div>

      <!-- ══ KNOWLEDGE GRAPH TAB — retired ════════════════════════════════════ -->
      <div v-if="false" id="tabpanel-knowledge">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Knowledge Graph</h2>
        <div class="overflow-x-auto">
          <svg
            :viewBox="`0 0 ${kgSvgWidth} 320`"
            :width="kgSvgWidth"
            height="320"
            class="w-full"
            aria-label="Knowledge graph of evo steps and value entries"
          >
            <!-- Edges -->
            <line
              v-for="(edge, ei) in kgSpecEdges"
              :key="ei"
              :x1="kgSpecNodes.find(n => n.id === edge.fromId)?.x ?? 0"
              :y1="kgSpecNodes.find(n => n.id === edge.fromId)?.y ?? 0"
              :x2="kgSpecNodes.find(n => n.id === edge.toId)?.x ?? 0"
              :y2="kgSpecNodes.find(n => n.id === edge.toId)?.y ?? 0"
              stroke="#a5b4fc"
              :stroke-width="edge.weight === 1 ? 1 : edge.weight === 2 ? 1.5 : 2.5"
              opacity="0.6"
            />
            <!-- Nodes -->
            <g
              v-for="node in kgSpecNodes"
              :key="node.id"
              style="cursor: pointer"
              @click="kgSelectedId === node.id ? kgSelect(null) : kgSelect(node.id)"
            >
              <circle
                :cx="node.x"
                :cy="node.y"
                :r="node.radius"
                :fill="node.type === 'step' ? '#6366f1' : '#10b981'"
                :opacity="kgIsHighlighted(node.id) ? 1 : 0.3"
              />
              <text
                :x="node.x"
                :y="node.y + node.radius + 11"
                text-anchor="middle"
                font-size="9"
                fill="#374151"
                :opacity="kgIsHighlighted(node.id) ? 1 : 0.3"
                class="select-none"
              >{{ node.label.length > 12 ? node.label.slice(0, 12) : node.label }}</text>
            </g>
          </svg>
        </div>
        <!-- Legend -->
        <div class="flex gap-4 mt-3 text-xs text-gray-500">
          <span class="flex items-center gap-1.5">
            <span class="inline-block w-3 h-3 rounded-full bg-indigo-500"></span>Steps
          </span>
          <span class="flex items-center gap-1.5">
            <span class="inline-block w-3 h-3 rounded-full bg-emerald-500"></span>Values
          </span>
        </div>
      </div>

    <!-- Feature #176 — Pair Programming Leaderboard panel -->
    <div v-if="steps.length > 0" class="mt-2 mb-4">
      <div v-show="pairLeaderboardOpen" data-panel="pairLeaderboardOpen" class="border border-slate-200 rounded-lg overflow-hidden">
        <div v-if="pairLeaderboardOpen" class="p-4 bg-white space-y-3">
          <div class="-mx-4 -mt-4 mb-3 flex items-center gap-1.5 px-4 py-2 bg-emerald-500"><span aria-hidden="true">🏆</span><span class="text-xs font-semibold text-white flex-1">Pair Leaderboard</span><button type="button" aria-label="Collapse Pair Leaderboard" class="text-white/60 hover:text-white text-[10px]" @click="pairLeaderboardOpen = false">▲</button></div>
          <!-- Horizontal bar chart SVG -->
          <svg
            :viewBox="`0 0 480 ${Math.max(pairLeaderboardEntries.length * 40, 120)}`"
            class="w-full"
            aria-label="Pair programming leaderboard bar chart"
          >
            <g
              v-for="(entry, idx) in pairLeaderboardEntries"
              :key="entry.stepId"
              :transform="`translate(0, ${idx * 40})`"
            >
              <!-- Bar -->
              <rect
                x="80"
                y="8"
                :width="pairLeaderboardEntries.length > 0
                  ? Math.max(...pairLeaderboardEntries.map(e => e.productivity)) > 0
                    ? 400 * (entry.productivity / Math.max(...pairLeaderboardEntries.map(e => e.productivity)))
                    : 0
                  : 0"
                height="24"
                :fill="entry.rank === 1 ? '#fbbf24' : entry.rank === 2 ? '#d1d5db' : entry.rank === 3 ? '#fde68a' : '#e5e7eb'"
                rx="3"
              />
              <!-- Label: badge + truncated title -->
              <text x="4" y="24" font-size="11" fill="#374151" class="select-none">
                {{ entry.badge || entry.rank }}
              </text>
              <text x="24" y="24" font-size="10" fill="#374151" class="select-none">
                {{ (entry.stepTitle.length > 20 ? entry.stepTitle.slice(0, 20) + '…' : entry.stepTitle) }}
              </text>
              <!-- Productivity score right-aligned -->
              <text x="476" y="24" font-size="10" fill="#374151" text-anchor="end" class="select-none">
                {{ entry.productivity }}
              </text>
            </g>
          </svg>
          <!-- Top step emerald banner -->
          <div
            v-if="pairLeaderboardTop"
            class="rounded px-3 py-2 bg-emerald-100 text-emerald-800 text-sm font-medium"
          >
            🏆 Top Step: {{ pairLeaderboardTop.stepTitle }}
          </div>
          <!-- Copy button -->
          <button
            type="button"
            class="text-xs text-slate-500 hover:underline mt-1"
            @click="copyPairLeaderboardMd()"
          >
            {{ pairLeaderboardCopied ? '✅ Copied!' : '📋 Copy Markdown' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Feature #178 — Dependency Risk Score panel -->
    <div v-if="steps.length > 0" class="mt-2 mb-4">
      <div v-show="depRiskOpen" data-panel="depRiskOpen" class="border border-slate-200 rounded-lg overflow-hidden">
        <div v-if="depRiskOpen" class="p-4 bg-white space-y-3">
          <div class="-mx-4 -mt-4 mb-3 flex items-center gap-1.5 px-4 py-2 bg-emerald-500"><span aria-hidden="true">🔗</span><span class="text-xs font-semibold text-white flex-1">Dep Risk</span><button type="button" aria-label="Collapse Dep Risk" class="text-white/60 hover:text-white text-[10px]" @click="depRiskOpen = false">▲</button></div>
          <!-- Summary badge -->
          <div
            class="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium"
            :class="depRiskCriticalCount > 0 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'"
          >
            ⚠️ {{ depRiskCriticalCount }} critical step{{ depRiskCriticalCount === 1 ? '' : 's' }}
          </div>
          <!-- Per-entry rows -->
          <div class="space-y-1">
            <div
              v-for="entry in depRiskEntries"
              :key="entry.stepId"
              class="flex items-center gap-2 rounded px-2 py-1.5 text-xs"
              :class="entry.isCritical ? 'border-l-4 border-rose-500 bg-rose-50' : 'bg-slate-50'"
            >
              <!-- Step title -->
              <span class="flex-1 truncate text-slate-700 font-medium">{{ entry.stepTitle }}</span>
              <!-- Risk score -->
              <span class="text-slate-500 whitespace-nowrap">Score: {{ entry.riskScore }}</span>
              <!-- Tier badge -->
              <span
                class="px-1.5 py-0.5 rounded font-semibold"
                :class="entry.riskTier === 'High' ? 'text-rose-500 bg-rose-50' : entry.riskTier === 'Medium' ? 'text-amber-500 bg-amber-50' : 'text-emerald-500 bg-emerald-50'"
              >{{ entry.riskTier }}</span>
              <!-- Bar -->
              <div class="w-[200px] bg-slate-200 rounded-full h-2 overflow-hidden flex-shrink-0">
                <div
                  class="h-2 rounded-full"
                  :class="entry.isCritical ? 'bg-rose-400' : entry.riskTier === 'Medium' ? 'bg-amber-400' : 'bg-emerald-400'"
                  :style="{ width: depRiskMax > 0 ? `${(entry.riskScore / depRiskMax) * 100}%` : '0%' }"
                ></div>
              </div>
            </div>
          </div>
          <!-- Copy button -->
          <button
            type="button"
            class="text-xs text-slate-500 hover:underline mt-1"
            @click="copyDepRiskMd()"
          >
            {{ depRiskCopied ? '✅ Copied!' : '📋 Copy Markdown' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Feature #183 — Cycle Time panel -->
    <div v-if="steps.length > 0" class="mt-2 mb-4">
      <div v-show="cycleTimeOpen" data-panel="cycleTimeOpen" class="border border-slate-200 rounded-lg overflow-hidden">
        <div v-if="cycleTimeOpen" class="p-4 bg-white space-y-3">
          <div class="-mx-4 -mt-4 mb-3 flex items-center gap-1.5 px-4 py-2 bg-amber-500"><span aria-hidden="true">⏱️</span><span class="text-xs font-semibold text-white flex-1">Cycle Time</span><button type="button" aria-label="Collapse Cycle Time" class="text-white/60 hover:text-white text-[10px]" @click="cycleTimeOpen = false">▲</button></div>
          <!-- Avg cycle time banner -->
          <div class="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-teal-100 text-teal-800">
            Avg cycle time: {{ avgCycleTime.toFixed(1) }} days · {{ cycleBottleneckCount }} bottleneck{{ cycleBottleneckCount === 1 ? '' : 's' }}
          </div>
          <!-- Waterfall SVG chart -->
          <svg
            :width="520"
            :height="Math.max(cycleSteps.length * 36 + 60, 120)"
            :viewBox="`0 0 520 ${Math.max(cycleSteps.length * 36 + 60, 120)}`"
            class="w-full"
            aria-label="Cycle time waterfall chart"
          >
            <g v-for="(cs, ri) in cycleSteps" :key="cs.stepId">
              <!-- Row background for bottleneck steps -->
              <rect
                v-if="cs.isBottleneck"
                x="0"
                :y="ri * 36"
                width="520"
                height="36"
                fill="#ffe4e6"
              />
              <!-- Step title label (left, truncated 18 chars) -->
              <text
                x="4"
                :y="ri * 36 + 22"
                font-size="11"
                fill="#334155"
              >{{ cs.stepTitle.length > 18 ? cs.stepTitle.slice(0, 18) + '…' : cs.stepTitle }}</text>
              <!-- Bars: lead (gray-200), active (emerald-400), wait (amber-400) -->
              <g>
                <!-- compute max total across all steps for normalization -->
                <rect
                  :x="148"
                  :y="ri * 36 + 8"
                  :width="cycleSteps.length ? (cs.leadTime / Math.max(...cycleSteps.map(s => s.leadTime + s.activeTime + s.waitTime))) * 320 : 0"
                  height="10"
                  fill="#e5e7eb"
                  rx="2"
                />
                <rect
                  :x="148 + (cycleSteps.length ? (cs.leadTime / Math.max(...cycleSteps.map(s => s.leadTime + s.activeTime + s.waitTime))) * 320 : 0)"
                  :y="ri * 36 + 8"
                  :width="cycleSteps.length ? (cs.activeTime / Math.max(...cycleSteps.map(s => s.leadTime + s.activeTime + s.waitTime))) * 320 : 0"
                  height="10"
                  fill="#34d399"
                  rx="2"
                />
                <rect
                  :x="148 + (cycleSteps.length ? ((cs.leadTime + cs.activeTime) / Math.max(...cycleSteps.map(s => s.leadTime + s.activeTime + s.waitTime))) * 320 : 0)"
                  :y="ri * 36 + 8"
                  :width="cycleSteps.length ? (cs.waitTime / Math.max(...cycleSteps.map(s => s.leadTime + s.activeTime + s.waitTime))) * 320 : 0"
                  height="10"
                  fill="#fbbf24"
                  rx="2"
                />
              </g>
              <!-- Cycle time label (right) -->
              <text
                x="476"
                :y="ri * 36 + 22"
                font-size="11"
                fill="#334155"
                text-anchor="end"
              >{{ cs.cycleTime }}d</text>
            </g>
            <!-- Legend below rows -->
            <g :transform="`translate(4, ${cycleSteps.length * 36 + 8})`">
              <rect x="0" y="0" width="12" height="10" fill="#e5e7eb" rx="2" />
              <text x="16" y="9" font-size="10" fill="#64748b">Lead</text>
              <rect x="60" y="0" width="12" height="10" fill="#34d399" rx="2" />
              <text x="76" y="9" font-size="10" fill="#64748b">Active</text>
              <rect x="128" y="0" width="12" height="10" fill="#fbbf24" rx="2" />
              <text x="144" y="9" font-size="10" fill="#64748b">Wait</text>
            </g>
          </svg>
          <!-- Copy button -->
          <button
            type="button"
            class="text-xs text-slate-500 hover:underline mt-1"
            @click="copyCycleTimeMd()"
          >
            {{ cycleTimeCopied ? '✅ Copied!' : '📋 Copy Markdown' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Feature #185 — Energy-Effort Scatter panel -->
    <div v-if="steps.length > 0" class="mt-2 mb-4">
      <div v-show="energyScatterOpen" data-panel="energyScatterOpen" class="border border-slate-200 rounded-lg overflow-hidden">
        <div v-if="energyScatterOpen" class="p-4 bg-white space-y-3">
          <div class="-mx-4 -mt-4 mb-3 flex items-center gap-1.5 px-4 py-2 bg-amber-500"><span aria-hidden="true">🔵</span><span class="text-xs font-semibold text-white flex-1">Energy Scatter</span><button type="button" aria-label="Collapse Energy Scatter" class="text-white/60 hover:text-white text-[10px]" @click="energyScatterOpen = false">▲</button></div>
          <!-- Dominant quadrant badge -->
          <div
            v-if="energyScatterDominant"
            class="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium"
            :class="{
              'bg-emerald-100 text-emerald-800': energyScatterDominant === 'Focus',
              'bg-amber-100 text-amber-800': energyScatterDominant === 'Grind',
              'bg-blue-100 text-blue-800': energyScatterDominant === 'Coast',
              'bg-rose-100 text-rose-800': energyScatterDominant === 'Waste',
            }"
          >
            {{ energyScatterDominant }}: {{ energyScatterPoints.filter(p => p.quadrant === energyScatterDominant).length }} step{{ energyScatterPoints.filter(p => p.quadrant === energyScatterDominant).length === 1 ? '' : 's' }}
          </div>
          <!-- Scatter SVG 360×280 -->
          <svg
            width="360"
            height="280"
            viewBox="0 0 360 280"
            class="w-full"
            aria-label="Energy-effort scatter chart"
          >
            <!-- Quadrant background rects -->
            <!-- Focus: energy>2 (top half y<140) && effort<=5 (left half x<180) = top-left -->
            <rect x="40" y="20" width="140" height="120" fill="#ecfdf5" />
            <!-- Grind: energy>2 && effort>5 = top-right -->
            <rect x="180" y="20" width="140" height="120" fill="#fffbeb" />
            <!-- Coast: energy<=2 && effort<=5 = bottom-left -->
            <rect x="40" y="140" width="140" height="120" fill="#eff6ff" />
            <!-- Waste: energy<=2 && effort>5 = bottom-right -->
            <rect x="180" y="140" width="140" height="120" fill="#fff1f2" />

            <!-- Axis lines -->
            <line x1="40" y1="20" x2="40" y2="260" stroke="#94a3b8" stroke-width="1" />
            <line x1="40" y1="260" x2="320" y2="260" stroke="#94a3b8" stroke-width="1" />

            <!-- Y-axis labels (energy 0–4) -->
            <text x="36" y="264" font-size="9" fill="#64748b" text-anchor="end">0</text>
            <text x="36" y="200" font-size="9" fill="#64748b" text-anchor="end">1</text>
            <text x="36" y="140" font-size="9" fill="#64748b" text-anchor="end">2</text>
            <text x="36" y="80"  font-size="9" fill="#64748b" text-anchor="end">3</text>
            <text x="36" y="24"  font-size="9" fill="#64748b" text-anchor="end">4</text>
            <text x="8"  y="144" font-size="9" fill="#64748b" transform="rotate(-90,8,144)" text-anchor="middle">Energy</text>

            <!-- X-axis labels (effort 0–10) -->
            <text x="40"  y="272" font-size="9" fill="#64748b" text-anchor="middle">0</text>
            <text x="96"  y="272" font-size="9" fill="#64748b" text-anchor="middle">2</text>
            <text x="152" y="272" font-size="9" fill="#64748b" text-anchor="middle">4</text>
            <text x="208" y="272" font-size="9" fill="#64748b" text-anchor="middle">6</text>
            <text x="264" y="272" font-size="9" fill="#64748b" text-anchor="middle">8</text>
            <text x="320" y="272" font-size="9" fill="#64748b" text-anchor="middle">10</text>
            <text x="180" y="282" font-size="9" fill="#64748b" text-anchor="middle">Effort</text>

            <!-- Quadrant corner labels -->
            <text x="44"  y="36"  font-size="10" fill="#059669" font-weight="600">🎯 Focus</text>
            <text x="184" y="36"  font-size="10" fill="#d97706" font-weight="600">💪 Grind</text>
            <text x="44"  y="152" font-size="10" fill="#2563eb" font-weight="600">🏖️ Coast</text>
            <text x="184" y="152" font-size="10" fill="#e11d48" font-weight="600">🗑️ Waste</text>

            <!-- Data points: x = 40 + (effort/10)*280, y = 260 - (energy/4)*240 -->
            <g v-for="p in energyScatterPoints" :key="p.stepId">
              <circle
                :cx="40 + (p.effort / 10) * 280"
                :cy="260 - (p.energy / 4) * 240"
                r="8"
                :fill="p.quadrant === 'Focus' ? '#10b981' : p.quadrant === 'Grind' ? '#f59e0b' : p.quadrant === 'Coast' ? '#3b82f6' : '#f43f5e'"
                opacity="0.85"
              >
                <title>{{ p.stepTitle }}&#10;{{ p.quadrant }}</title>
              </circle>
            </g>
          </svg>
          <!-- Copy button -->
          <button
            type="button"
            class="text-xs text-slate-500 hover:underline mt-1"
            @click="copyEnergyScatterMd()"
          >
            {{ energyScatterCopied ? '✅ Copied!' : '📋 Copy Markdown' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Feature #188 — Sprint Risk Heatmap panel -->
    <div v-if="steps.length > 0" class="mt-2 mb-4">
      <!-- overflow-hidden removed: Safari clips pointer-event hit-testing at border-radius corners,
           making the close button unreachable. rounded-t-lg applied to header instead. -->
      <div v-show="riskHeatmapOpen" data-panel="riskHeatmapOpen" class="border border-slate-200 rounded-lg">
        <div v-if="riskHeatmapOpen" class="p-4 bg-white space-y-3">
          <div class="-mx-4 -mt-4 mb-3 flex items-center gap-1.5 px-4 py-2 bg-blue-500 rounded-t-lg">
            <span aria-hidden="true">🔥</span>
            <span class="text-xs font-semibold text-white flex-1">Risk Heatmap</span>
            <CloseDot
        variant="on-dark"
        aria-label="Close Risk Heatmap"
        @click="riskHeatmapOpen = false"
      />
          </div>
          <!-- High risk count badge -->
          <div class="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-rose-100 text-rose-800">
            {{ riskHeatmapHighCount }} High-risk step{{ riskHeatmapHighCount === 1 ? '' : 's' }}
          </div>
          <!-- Heatmap SVG: 3 rows × N cols -->
          <svg
            :width="Math.max(riskHeatmapSteps.length * 60 + 80, 200)"
            height="200"
            :viewBox="`0 0 ${Math.max(riskHeatmapSteps.length * 60 + 80, 200)} 200`"
            class="w-full"
            aria-label="Sprint risk heatmap"
          >
            <!-- Row labels on left -->
            <text x="4"  y="45"  font-size="10" fill="#334155">Complexity</text>
            <text x="4"  y="95"  font-size="10" fill="#334155">Dep Risk</text>
            <text x="4"  y="145" font-size="10" fill="#334155">Pair Cov ↓</text>

            <!-- Column headers + cells -->
            <g v-for="(hs, ci) in riskHeatmapSteps" :key="hs.stepId">
              <!-- Column header: step title truncated to 8 chars -->
              <text
                :x="80 + ci * 60 + 27"
                y="14"
                font-size="9"
                fill="#334155"
                text-anchor="middle"
              >{{ hs.stepTitle.length > 8 ? hs.stepTitle.slice(0, 8) : hs.stepTitle }}</text>

              <!-- Complexity cell -->
              <rect
                :x="80 + ci * 60"
                y="20"
                width="55"
                height="50"
                :fill="hs.complexity === 1 ? '#d1fae5' : hs.complexity === 2 ? '#fef3c7' : hs.complexity === 3 ? '#fde68a' : hs.complexity === 4 ? '#fca5a5' : '#ef4444'"
                rx="3"
              />
              <text :x="80 + ci * 60 + 27" y="49" font-size="12" fill="#1e293b" text-anchor="middle" font-weight="600">{{ hs.complexity }}</text>

              <!-- Dep Risk cell -->
              <rect
                :x="80 + ci * 60"
                y="75"
                width="55"
                height="50"
                :fill="hs.depRisk === 1 ? '#d1fae5' : hs.depRisk === 2 ? '#fef3c7' : hs.depRisk === 3 ? '#fde68a' : hs.depRisk === 4 ? '#fca5a5' : '#ef4444'"
                rx="3"
              />
              <text :x="80 + ci * 60 + 27" y="104" font-size="12" fill="#1e293b" text-anchor="middle" font-weight="600">{{ hs.depRisk }}</text>

              <!-- Pair Coverage cell -->
              <rect
                :x="80 + ci * 60"
                y="130"
                width="55"
                height="50"
                :fill="hs.pairCoverage === 1 ? '#d1fae5' : hs.pairCoverage === 2 ? '#fef3c7' : hs.pairCoverage === 3 ? '#fde68a' : hs.pairCoverage === 4 ? '#fca5a5' : '#ef4444'"
                rx="3"
              />
              <text :x="80 + ci * 60 + 27" y="159" font-size="12" fill="#1e293b" text-anchor="middle" font-weight="600">{{ hs.pairCoverage }}</text>

              <!-- Overall risk tier badge below column -->
              <rect
                :x="80 + ci * 60"
                y="183"
                width="55"
                height="14"
                :fill="hs.riskTier === 'High' ? '#fecdd3' : hs.riskTier === 'Medium' ? '#fef3c7' : '#d1fae5'"
                rx="3"
              />
              <text
                :x="80 + ci * 60 + 27"
                y="193"
                font-size="8"
                :fill="hs.riskTier === 'High' ? '#be123c' : hs.riskTier === 'Medium' ? '#92400e' : '#065f46'"
                text-anchor="middle"
                font-weight="600"
              >{{ hs.riskTier }}</text>
            </g>
          </svg>
          <!-- Copy button -->
          <button
            type="button"
            class="text-xs text-slate-500 hover:underline mt-1"
            @click="copyRiskHeatmapMd()"
          >
            {{ riskHeatmapCopied ? '✅ Copied!' : '📋 Copy Markdown' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Feature #190 — Bug Prediction panel -->
    <div v-if="steps.length > 0" class="mt-2 mb-4">
      <div v-show="bugPredictionOpen" data-panel="bugPredictionOpen" class="border border-slate-200 rounded-lg overflow-hidden">
        <div v-if="bugPredictionOpen" class="p-4 bg-white space-y-3">
          <div class="-mx-4 -mt-4 mb-3 flex items-center gap-1.5 px-4 py-2 bg-blue-500"><span aria-hidden="true">🐛</span><span class="text-xs font-semibold text-white flex-1">Bug Prediction</span><button type="button" aria-label="Collapse Bug Prediction" class="text-white/60 hover:text-white text-[10px]" @click="bugPredictionOpen = false">▲</button></div>
          <!-- Summary banner -->
          <div class="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-orange-100 text-orange-800">
            🐛 {{ bugTotalPredicted }} bugs predicted — {{ bugCriticalCount }} critical
          </div>
          <!-- Bar chart SVG -->
          <svg
            width="480"
            :height="Math.max(bugPredictions.length * 36 + 60, 120)"
            :viewBox="`0 0 480 ${Math.max(bugPredictions.length * 36 + 60, 120)}`"
            class="w-full"
            aria-label="Bug prediction bar chart"
          >
            <g v-for="(bp, bi) in bugPredictions" :key="bp.stepId">
              <!-- Label -->
              <text
                :x="0"
                :y="40 + bi * 36 + 14"
                font-size="12"
                fill="#334155"
                dominant-baseline="middle"
              >{{ bp.bugEmoji }} {{ bp.stepTitle.slice(0, 18) }}</text>
              <!-- Bar -->
              <rect
                :x="160"
                :y="40 + bi * 36"
                :width="Math.min(Math.round(bp.predictedBugs / Math.max(bugTotalPredicted / Math.max(bugPredictions.length, 1) * 3, 1) * 360), 360)"
                height="24"
                :fill="bp.tier === 'Critical' ? '#f43f5e' : bp.tier === 'High' ? '#fb923c' : bp.tier === 'Medium' ? '#fbbf24' : '#34d399'"
                rx="3"
              />
              <!-- Count label -->
              <text
                :x="164 + Math.min(Math.round(bp.predictedBugs / Math.max(bugTotalPredicted / Math.max(bugPredictions.length, 1) * 3, 1) * 360), 360) + 4"
                :y="40 + bi * 36 + 14"
                font-size="11"
                fill="#475569"
                dominant-baseline="middle"
              >{{ bp.predictedBugs }}</text>
            </g>
          </svg>
          <!-- Copy button -->
          <button
            type="button"
            class="text-xs text-slate-500 hover:underline mt-1"
            @click="copyBugPredictionMd()"
          >
            {{ bugPredictionCopied ? '✅ Copied!' : '📋 Copy Markdown' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Feature #193 — Velocity Forecast panel -->
    <div v-if="steps.length > 0" class="mt-2 mb-4">
      <div v-show="velocityPredictorOpen" data-panel="velocityPredictorOpen" class="border border-slate-200 rounded-lg overflow-hidden">
        <div v-if="velocityPredictorOpen" class="p-4 bg-white space-y-3">
          <div class="-mx-4 -mt-4 mb-3 flex items-center gap-1.5 px-4 py-2 bg-amber-500"><span aria-hidden="true">📈</span><span class="text-xs font-semibold text-white flex-1">Velocity Forecast</span><button type="button" aria-label="Collapse Velocity Forecast" class="text-white/60 hover:text-white text-[10px]" @click="velocityPredictorOpen = false">▲</button></div>
          <!-- Trend badge -->
          <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800">
            <span>{{ velocityTrend === 'increasing' ? '📈' : velocityTrend === 'decreasing' ? '📉' : '→' }}</span>
            <span>Avg velocity: {{ avgVelocity.toFixed !== undefined ? velocityAvg.toFixed(1) : velocityAvg }} — {{ velocityTrend }}</span>
          </div>
          <!-- Line chart SVG (480×240) -->
          <svg
            width="480"
            height="240"
            viewBox="0 0 480 240"
            class="w-full"
            aria-label="Velocity forecast line chart"
          >
            <!-- Axes -->
            <line x1="40" y1="10" x2="40" y2="210" stroke="#94a3b8" stroke-width="1"/>
            <line x1="40" y1="210" x2="470" y2="210" stroke="#94a3b8" stroke-width="1"/>

            <!-- Confidence band for forecast steps -->
            <polygon
              v-if="velocityPoints.filter(p => !p.isCompleted).length >= 2"
              :points="[
                ...velocityPoints.filter(p => !p.isCompleted).map(p => {
                  const maxV = Math.max(...velocityPoints.map(vp => vp.velocity), 1)
                  const xStep = velocityPoints.length > 1 ? 430 / (velocityPoints.length - 1) : 430
                  const x = 40 + p.stepIndex * xStep
                  const ub = p.upperBound ?? 0
                  const y = 210 - (ub / (maxV + 2)) * 200
                  return `${x},${y}`
                }),
                ...velocityPoints.filter(p => !p.isCompleted).slice().reverse().map(p => {
                  const maxV = Math.max(...velocityPoints.map(vp => vp.velocity), 1)
                  const xStep = velocityPoints.length > 1 ? 430 / (velocityPoints.length - 1) : 430
                  const x = 40 + p.stepIndex * xStep
                  const lb = p.lowerBound ?? 0
                  const y = 210 - (lb / (maxV + 2)) * 200
                  return `${x},${y}`
                })
              ].join(' ')"
              fill="#fef3c7"
              opacity="0.7"
            />

            <!-- Dashed forecast line -->
            <polyline
              v-if="velocityPoints.some(p => !p.isCompleted && p.forecast !== null)"
              :points="velocityPoints.filter(p => !p.isCompleted).map(p => {
                const maxV = Math.max(...velocityPoints.map(vp => vp.velocity), 1)
                const xStep = velocityPoints.length > 1 ? 430 / (velocityPoints.length - 1) : 430
                const x = 40 + p.stepIndex * xStep
                const y = 210 - ((p.forecast ?? 0) / (maxV + 2)) * 200
                return `${x},${y}`
              }).join(' ')"
              fill="none"
              stroke="#fbbf24"
              stroke-width="2"
              stroke-dasharray="5 4"
            />

            <!-- Solid completed line -->
            <polyline
              v-if="velocityPoints.filter(p => p.isCompleted).length >= 2"
              :points="velocityPoints.filter(p => p.isCompleted).map(p => {
                const maxV = Math.max(...velocityPoints.map(vp => vp.velocity), 1)
                const xStep = velocityPoints.length > 1 ? 430 / (velocityPoints.length - 1) : 430
                const x = 40 + p.stepIndex * xStep
                const y = 210 - (p.velocity / (maxV + 2)) * 200
                return `${x},${y}`
              }).join(' ')"
              fill="none"
              stroke="#6366f1"
              stroke-width="2"
            />

            <!-- Dots -->
            <g v-for="vp in velocityPoints" :key="vp.stepId">
              <circle
                v-if="vp.isCompleted"
                :cx="40 + vp.stepIndex * (velocityPoints.length > 1 ? 430 / (velocityPoints.length - 1) : 430)"
                :cy="210 - (vp.velocity / (Math.max(...velocityPoints.map(p => p.velocity), 1) + 2)) * 200"
                r="5"
                fill="#4338ca"
              >
                <title>{{ vp.stepTitle }}: {{ vp.velocity }}</title>
              </circle>
              <circle
                v-else
                :cx="40 + vp.stepIndex * (velocityPoints.length > 1 ? 430 / (velocityPoints.length - 1) : 430)"
                :cy="210 - ((vp.forecast ?? vp.velocity) / (Math.max(...velocityPoints.map(p => p.velocity), 1) + 2)) * 200"
                r="5"
                fill="white"
                stroke="#f59e0b"
                stroke-width="2"
              >
                <title>{{ vp.stepTitle }}: {{ vp.forecast }}</title>
              </circle>
              <!-- x-axis label -->
              <text
                :x="40 + vp.stepIndex * (velocityPoints.length > 1 ? 430 / (velocityPoints.length - 1) : 430)"
                y="226"
                font-size="9"
                fill="#64748b"
                text-anchor="middle"
              >{{ vp.stepIndex }}</text>
            </g>

            <!-- y-axis label -->
            <text x="4" y="110" font-size="9" fill="#64748b" transform="rotate(-90 4 110)">velocity</text>
          </svg>
          <!-- Copy button -->
          <button
            type="button"
            class="text-xs text-slate-500 hover:underline mt-1"
            @click="copyVelocityMd()"
          >
            {{ velocityCopied ? '✅ Copied!' : '📋 Copy Markdown' }}
          </button>
        </div>
      </div>
    </div>

    </template>

    <!-- ── Empty state (no plan yet) ─────────────────────────────────────── -->
    <div
      v-else
      class="py-16 flex flex-col items-center gap-5"
      role="status"
    >
      <!-- Icon -->
      <div class="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center text-3xl shadow-sm"
           aria-hidden="true">🗺️</div>

      <!-- Message -->
      <div class="text-center space-y-1.5 max-w-sm">
        <p class="text-base font-semibold text-gray-700">No Evo plan yet</p>
        <p class="text-sm text-gray-400 leading-relaxed">
          Generate AI-suggested Evo steps from your spec — each step delivers
          measurable value and moves the stakeholder goal closer to its target.
        </p>
      </div>

      <!-- Primary CTA — Generate — force=true bypasses the identity guard
           and any pending skip flag (set by loadPlan on history restore)
           so the button always triggers a fresh AI generation on click. -->
      <button
        type="button"
        class="flex items-center gap-2.5 px-6 py-3 rounded-2xl
               bg-gradient-to-r from-indigo-500 to-violet-500 text-white
               font-semibold text-sm shadow-md shadow-indigo-200/60
               hover:from-indigo-600 hover:to-violet-600 hover:shadow-lg
               focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2
               transition-all duration-200 active:scale-[0.98] min-h-[44px]"
        aria-label="Generate Evo Plan"
        @click="fetchPlan(props.specBlock, true)"
      >
        <svg class="h-4 w-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
        </svg>
        Generate Evo Plan
      </button>

      <p class="text-[11px] text-gray-400">Takes 10–60s depending on your AI backend</p>
    </div>

  <!-- Fullscreen panel expand (green dot) -->
  <Teleport to="body">
    <Transition name="panel-expand">
      <div v-if="expandedPanel" class="fixed inset-0 z-[850] flex flex-col bg-white shadow-2xl overflow-hidden">
        <!-- Titlebar — close pin lives on the RIGHT per universal UX rule.
             The previous design mimicked the macOS traffic-light triplet
             on the left (red CloseDot + decorative yellow + green dots);
             yellow/green dots were non-functional placeholders. Removed
             them and moved the CloseDot to the right edge for consistency
             with every other panel header. -->
        <div :class="_exMeta.bg" class="flex items-center gap-3 px-4 py-3 flex-shrink-0 select-none">
          <span class="text-xl leading-none">{{ _exMeta.emoji }}</span>
          <span class="text-sm font-semibold text-white uppercase tracking-wide flex-1">{{ _exMeta.title }}</span>
          <CloseDot
            variant="on-dark"
            title="Close"
            aria-label="Close expanded panel"
            @click="closeExpanded"
          />
        </div>
        <!-- Scrollable body -->
        <ScrollContainer outer-class="flex-1 min-h-0 relative" inner-class="h-full p-8 space-y-5 text-base">
          <template v-if="_exType === 'pair' && pairMap[_exKey]">
            <p class="text-gray-500 italic text-sm">{{ pairMap[_exKey]?.contextBrief }}</p>
            <div v-for="b in pairMap[_exKey]?.blocks ?? []" :key="b.blockNumber" class="flex gap-4">
              <span class="font-semibold text-blue-700 w-36 flex-shrink-0">Block {{ b.blockNumber }} ({{ b.role }}):</span>
              <span class="text-gray-700">{{ b.focus }}</span>
            </div>
            <p class="text-amber-600 text-sm">⇄ {{ pairMap[_exKey]?.swapNote }}</p>
          </template>
          <template v-else-if="_exType === 'mob' && mobMap[_exKey]">
            <p class="text-gray-500 italic text-sm">{{ mobMap[_exKey]?.sessionGoal }}</p>
            <p class="text-sky-600 text-sm">Team: {{ mobMap[_exKey]?.teamSize }} | 10 min/rotation | {{ mobMap[_exKey]?.totalMinutes }} min total</p>
            <div v-for="r in mobMap[_exKey]?.rotations ?? []" :key="r.rotationNumber" class="flex gap-4">
              <span class="font-semibold text-sky-700 w-28 flex-shrink-0">Rotation {{ r.rotationNumber }}:</span>
              <span class="text-gray-700">{{ r.focus }}</span>
            </div>
          </template>
          <template v-else-if="_exType === 'retro' && retroMap[_exKey]">
            <div v-for="p in retroMap[_exKey]?.prompts ?? []" :key="p.category">
              <span class="font-semibold capitalize text-violet-700">{{ p.category.replace('-', ' ') }}:</span>
              <span class="ml-2 text-gray-700">{{ p.prompt }}</span>
            </div>
          </template>
          <template v-else-if="_exType === 'ready' && readyMap[_exKey]">
            <div v-for="item in readyMap[_exKey]?.items ?? []" :key="item.id" class="flex items-center gap-3">
              <button @click="toggleReadyItem(_exKey, item.id)"
                :class="item.checked ? 'bg-emerald-500' : 'bg-gray-200'"
                class="w-6 h-6 rounded flex items-center justify-center text-white flex-shrink-0"
              >{{ item.checked ? '✓' : '' }}</button>
              <span :class="item.checked ? 'line-through text-gray-400' : 'text-gray-700'">{{ item.label }}</span>
            </div>
          </template>
          <template v-else-if="_exType === 'blocker' && blockerMap[_exKey]">
            <div class="flex gap-2 items-center">
              <input v-model="newBlockerDesc[_exKey]" type="text" placeholder="Describe blocker…" class="flex-1 h-10 border rounded px-3 text-sm"/>
              <select v-model="newBlockerSeverity[_exKey]" class="h-10 border rounded px-2 text-sm"><option>P1</option><option>P2</option><option selected>P3</option></select>
              <button @click="submitBlocker(parseInt(_exIdx))" class="h-10 px-4 bg-red-600 text-white text-sm rounded hover:bg-red-700">Add</button>
            </div>
            <div v-for="b in blockerMap[_exKey]?.blockers ?? []" :key="b.id" class="flex items-start gap-3">
              <span :class="b.severity === 'P1' ? 'bg-red-600' : b.severity === 'P2' ? 'bg-orange-500' : 'bg-yellow-500'" class="text-white text-xs rounded px-2 py-0.5 flex-shrink-0 mt-0.5">{{ b.severity }}</span>
              <span :class="b.resolved ? 'line-through text-gray-400' : 'text-gray-700'">{{ b.description }}</span>
              <div class="ml-auto flex gap-2 flex-shrink-0">
                <button v-if="!b.resolved" @click="resolveBlocker(_exKey, b.id)" class="text-sm text-emerald-600 hover:underline">✓ Resolve</button>
                <button @click="removeBlocker(_exKey, b.id)" class="text-sm text-red-400 hover:underline">✕</button>
              </div>
            </div>
            <p v-if="!blockerMap[_exKey]?.blockers?.length" class="text-sm text-gray-400 italic">No blockers logged</p>
          </template>
          <template v-else-if="_exType === 'acceptance' && acceptanceMap[_exKey]">
            <div v-for="(sc, i) in acceptanceMap[_exKey]?.scenarios ?? []" :key="i" class="bg-teal-50 border border-teal-200 rounded-lg p-4 space-y-1">
              <p class="font-semibold text-teal-800">Scenario: {{ sc.title }}</p>
              <p class="text-gray-600"><span class="font-medium">Given</span> {{ sc.given }}</p>
              <p class="text-gray-600"><span class="font-medium">When</span> {{ sc.when }}</p>
              <p class="text-gray-600"><span class="font-medium">Then</span> {{ sc.then }}</p>
            </div>
          </template>
          <template v-else-if="_exType === 'standup' && standupMap[_exKey]">
            <p><span class="font-semibold text-green-700">Yesterday:</span> {{ standupMap[_exKey]?.yesterday }}</p>
            <p><span class="font-semibold text-green-700">Today:</span> {{ standupMap[_exKey]?.today }}</p>
            <p><span :class="(standupMap[_exKey]?.blockers ?? '') === 'None identified' ? 'text-gray-500' : 'text-red-600'" class="font-semibold">Blockers:</span> {{ standupMap[_exKey]?.blockers }}</p>
          </template>
          <template v-else-if="_exType === 'agenda' && agendaMap[_exKey]">
            <p class="text-sm text-gray-500">45-minute structured meeting — {{ agendaMap[_exKey]?.stepName }}</p>
            <div v-for="s in agendaMap[_exKey]?.sections ?? []" :key="s.title">
              <span class="font-semibold text-indigo-700">{{ s.title }}</span>
              <span class="text-sm text-gray-400 ml-2">({{ s.durationMinutes }} min)</span>
              <p class="text-gray-600 text-sm mt-1">{{ s.content }}</p>
            </div>
          </template>
          <template v-else-if="_exType === 'spike' && spikeMap[_exKey]">
            <div v-for="(flag, fi) in spikeMap[_exKey]?.flags ?? []" :key="fi">
              <span :class="flag.severity === 'high' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'" class="text-sm font-medium px-2 py-0.5 rounded mr-2">{{ flag.severity }}</span>
              <span class="text-gray-700">{{ flag.reason }}</span>
              <p class="text-sm text-orange-600 mt-1 italic">→ {{ flag.spikeTask }} ({{ flag.suggestedDuration }})</p>
            </div>
          </template>
        </ScrollContainer>
      </div>
    </Transition>
  </Teleport>

  <!-- Toast notification -->
  <Transition name="evo-toast">
    <div
      v-if="evoToast"
      :key="evoToast.id"
      class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] rounded-full bg-slate-800 text-white text-xs px-4 py-2 shadow-lg pointer-events-none select-none"
      aria-live="polite"
    >{{ evoToast.message }}</div>
  </Transition>
  </section>
</template>

<style scoped>
/* Panel fullscreen expand — zoom in/out like macOS green dot */
.panel-expand-enter-active { animation: panel-expand-in 200ms cubic-bezier(0.16, 1, 0.3, 1) both; }
.panel-expand-leave-active  { animation: panel-expand-in 150ms cubic-bezier(0.7, 0, 0.84, 0) reverse both; }
@keyframes panel-expand-in {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}

/* Evo toast slide-up + bounce */
.evo-toast-enter-active { animation: evo-toast-in 320ms cubic-bezier(0.22, 1, 0.36, 1) both; }
.evo-toast-leave-active  { transition: opacity 180ms ease, transform 180ms ease; }
.evo-toast-leave-to      { opacity: 0; transform: translateX(-50%) translateY(-4px); }
@keyframes evo-toast-in {
  0%   { opacity: 0; transform: translateX(-50%) translateY(8px) scale(0.92); }
  60%  { opacity: 1; transform: translateX(-50%) translateY(-3px) scale(1.04); }
  80%  { transform: translateX(-50%) translateY(1px) scale(0.99); }
  100% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
}

@keyframes drawLine {
  from { stroke-dashoffset: 300; }
  to   { stroke-dashoffset: 0; }
}
@keyframes nodeIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
</style>
