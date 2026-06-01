<!--
  PlanImporterPanel.vue — Universal Planguage plan converter + improvement loop.

  Full-screen orange panel at z-[600]. Accepts any text (business brief, roadmap,
  strategy doc, rough notes) and converts it to structured Planguage F./V./C./R./S.
  entries via two sequential LLM calls (convert, then analyse). User can then
  improve the plan via AI suggestions or natural-language commands.
  Full version history preserved as PlanVersions.

  UI Rules satisfied:
    ScrollContainer rule  — all scrollable areas wrapped in ScrollContainer.
    CloseDot rule         — CloseDot variant="on-dark" at END of header.
    Single-Surface rule   — caller registers 'planImporter'.
    Define-by-Selection   — no select-none on body content.
    DD-009 Zero-Training  — all buttons have title= attribute.
    z-[600]               — within Major surfaces tier.
    Static Tailwind only  — no runtime class concatenation.
-->
<script setup lang="ts">
// UNIT_TYPE=Panel
import { ref, computed, watch, onUnmounted } from 'vue'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'
import {
  usePlanImporter,
} from '../composables/usePlanImporter'
import type { PlanguagizedEntry, PlanProblem, PlanVersion } from '../composables/usePlanImporter'

const emit = defineEmits<{ close: [] }>()

// ── Composable ────────────────────────────────────────────────────────────────

const {
  plans,
  selectedPlanId,
  selectedPlan,
  currentVersion,
  importAndConvert,
  improveWithCommand,
  applySuggestion,
  removePlan,
  selectPlan,
  loadSampleHotel,
  loadSampleHabit,
} = usePlanImporter()

// ── Import input state ────────────────────────────────────────────────────────

const importText = ref('')
const showImportForm = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

// ── Improvement command ───────────────────────────────────────────────────────

const improveCommand = ref('')

// ── Version selector ──────────────────────────────────────────────────────────

const selectedVersionId = computed<string>(() => {
  const plan = selectedPlan.value
  if (!plan) return ''
  return plan.currentVersionId
})

function selectVersion(versionId: string): void {
  const plan = selectedPlan.value
  if (!plan) return
  const idx = plans.value.findIndex(p => p.id === plan.id)
  if (idx === -1) return
  plans.value[idx] = { ...plans.value[idx], currentVersionId: versionId }
}

// ── File upload ───────────────────────────────────────────────────────────────

function handleFileUpload(evt: Event): void {
  const input = evt.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (e) => {
    const text = e.target?.result as string
    if (text) importText.value = text
  }
  reader.readAsText(file)
}

// ── Import trigger ────────────────────────────────────────────────────────────

let _abortCtl: AbortController | null = null

async function triggerImport(): Promise<void> {
  const text = importText.value.trim()
  if (!text) return
  _abortCtl?.abort()
  _abortCtl = new AbortController()
  showImportForm.value = false
  importText.value = ''
  await importAndConvert(text, _abortCtl.signal)
}

async function triggerImprove(): Promise<void> {
  const plan = selectedPlan.value
  if (!plan) return
  const cmd = improveCommand.value.trim()
  if (!cmd) return
  _abortCtl?.abort()
  _abortCtl = new AbortController()
  const cmdCopy = cmd
  improveCommand.value = ''
  await improveWithCommand(plan.id, cmdCopy, _abortCtl.signal)
}

async function triggerApply(problem: PlanProblem): Promise<void> {
  const plan = selectedPlan.value
  if (!plan || problem.applied) return
  await applySuggestion(plan.id, problem)
}

// ── Quick-command pills ───────────────────────────────────────────────────────

function setQuickCommand(cmd: string): void {
  improveCommand.value = cmd
}

// ── Entry type badge static classes (no runtime concat) ───────────────────────

const ENTRY_TYPE_CLASSES: Record<string, string> = {
  F: 'bg-orange-500 text-white',
  V: 'bg-blue-500 text-white',
  C: 'bg-fuchsia-600 text-white',
  R: 'bg-sky-600 text-white',
  S: 'bg-violet-500 text-white',
}

const ENTRY_CARD_CLASSES: Record<string, string> = {
  F: 'bg-orange-50 border-orange-100',
  V: 'bg-blue-50 border-blue-100',
  C: 'bg-fuchsia-50 border-fuchsia-100',
  R: 'bg-sky-50 border-sky-100',
  S: 'bg-violet-50 border-violet-100',
}

function entryTypeBadge(type: string): string {
  return ENTRY_TYPE_CLASSES[type] ?? 'bg-slate-400 text-white'
}

function entryCardBg(type: string): string {
  return ENTRY_CARD_CLASSES[type] ?? 'bg-slate-50 border-slate-200'
}

// ── Score circle colour ───────────────────────────────────────────────────────

const SCORE_BORDER_CLASS: Record<string, string> = {
  blue:    'border-blue-400 bg-blue-50',
  blueMed: 'border-blue-400 bg-blue-50',
  amber:   'border-amber-400 bg-amber-50',
  orange:  'border-orange-400 bg-orange-50',
}
const SCORE_TEXT_CLASS: Record<string, string> = {
  blue:    'text-blue-700',
  blueMed: 'text-blue-700',
  amber:   'text-amber-600',
  orange:  'text-orange-600',
}

function scoreKey(score: number): string {
  if (score >= 75) return 'blue'
  if (score >= 60) return 'blueMed'
  if (score >= 40) return 'amber'
  return 'orange'
}

function scoreBorderClass(score: number): string {
  return SCORE_BORDER_CLASS[scoreKey(score)] ?? SCORE_BORDER_CLASS.orange
}
function scoreTextClass(score: number): string {
  return SCORE_TEXT_CLASS[scoreKey(score)] ?? SCORE_TEXT_CLASS.orange
}

// ── Severity dot classes ──────────────────────────────────────────────────────

const SEVERITY_DOT: Record<string, string> = {
  critical: 'bg-rose-500',
  major: 'bg-orange-400',
  minor: 'bg-amber-400',
  opportunity: 'bg-blue-500',
}
const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-rose-100 text-rose-700',
  major: 'bg-orange-100 text-orange-700',
  minor: 'bg-amber-100 text-amber-700',
  opportunity: 'bg-blue-100 text-blue-700',
}

function severityDot(s: string): string {
  return SEVERITY_DOT[s] ?? 'bg-slate-300'
}
function severityBadge(s: string): string {
  return SEVERITY_BADGE[s] ?? 'bg-slate-100 text-slate-600'
}

// ── Confidence badge ──────────────────────────────────────────────────────────

const CONF_CLASS: Record<string, string> = {
  high: 'bg-blue-100 text-blue-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-orange-100 text-orange-700',
}
function confClass(c: string): string {
  return CONF_CLASS[c] ?? 'bg-slate-100 text-slate-500'
}

// ── Problem-referenced entries (entries with unapplied problems) ───────────────

function entryHasProblem(entry: PlanguagizedEntry, version: PlanVersion | null): boolean {
  if (!version) return false
  return version.problems.some(p => !p.applied && p.entryRef === entry.tag)
}

// ── Version diff indicator ────────────────────────────────────────────────────

function versionDiffLabel(version: PlanVersion, allVersions: PlanVersion[]): string | null {
  const idx = allVersions.findIndex(v => v.id === version.id)
  if (idx <= 0) return null
  const prev = allVersions[idx - 1]
  const added = version.entries.filter(e => !prev.entries.find(pe => pe.tag === e.tag)).length
  const changed = version.entries.filter(e => {
    const pe = prev.entries.find(pe => pe.tag === e.tag)
    return pe && (pe.description !== e.description || pe.details !== e.details)
  }).length
  const removed = prev.entries.filter(pe => !version.entries.find(e => e.tag === pe.tag)).length
  const parts: string[] = []
  if (added > 0) parts.push(`${added} added`)
  if (changed > 0) parts.push(`${changed} changed`)
  if (removed > 0) parts.push(`${removed} removed`)
  return parts.length > 0 ? `↑ ${parts.join(', ')} vs previous version` : null
}

// ── Unapplied problem count for badge ────────────────────────────────────────

const unappliedProblemCount = computed<number>(() => {
  const version = currentVersion.value
  if (!version) return 0
  return version.problems.filter(p => !p.applied).length
})

// ── Rule 8: Loading-state (4-element: spinner + elapsed + progress + amuse) ──

const PLAN_IMPORTER_WISDOM = [
  {
    emoji: '📐',
    title: 'Two-Phase Conversion',
    text: 'Phase 1 extracts F. (Functions), V. (Values), C. (Constraints), R. (Resources), and S. (Stakeholders) from your raw text. Phase 2 analyses the resulting entries for missing measurements, ambiguous scope, and violated Planguage rules.',
    ref: 'Rule_Write_planguage-spec.md — 10.Standard/Standard.Kai-Zen/',
  },
  {
    emoji: '🔢',
    title: 'Values Must Be Measurable',
    text: 'A Value entry (V.) is only complete when it has a Scale (unit of measurement), a Meter (how you measure it), a Goal (the target), and a Tolerable (the minimum acceptable). Without these, a value is a wish — not a specification.',
    ref: 'Template_Write_Values.md — Gilb Planguage Standard',
  },
  {
    emoji: '⚖️',
    title: 'Functions Are Binary',
    text: 'A Function (F.) is WHAT the system DOES — present or absent. Quality, speed, and cost attach as Values, not inside the function. "A fast search function" becomes F. (Search) + V. (Search response time, Goal ≤0.5s).',
    ref: 'DD-004 — SEM Design Decisions, design-decisions.md',
  },
  {
    emoji: '🛑',
    title: 'Constraints Are Non-Negotiable',
    text: 'A Constraint (C.) uses Must / Must not form. It is binary — either respected or violated. No option that violates a constraint is acceptable, regardless of its Value score. Budget, legal, and safety rules are always C. entries.',
    ref: 'Template_Write_Constraint.md — Gilb Planguage Standard',
  },
  {
    emoji: '👥',
    title: 'Stakeholders Include the Inanimate',
    text: 'Data has needs (privacy, integrity). Laws have requirements (compliance). Regulations have enforcement mechanisms. In Planguage, any entity whose needs must be respected is a Stakeholder (S.) — not just people and organisations.',
    ref: 'Tom Gilb, 2026-05-15 — "all data is a stakeholder, it has needs like GDPR"',
  },
  {
    emoji: '💰',
    title: 'Resources Are Budgets, Not Estimates',
    text: 'A Resource entry (R.) defines an allocated budget: time, money, people, compute, or any scarce input. Budgets constrain the solution space. Running out of a resource mid-project is a constraint violation, not a surprise.',
    ref: 'Template_Write_Resource.md — Gilb Planguage Standard',
  },
  {
    emoji: '🔄',
    title: 'Version History Is a Design Record',
    text: 'Every improvement command creates a new plan version. The history is not just undo — it is an audit trail of how your thinking evolved. Future reviewers can trace which problem was fixed in which version and why.',
    ref: 'EVO 2024, Gilb — Step 9: Learn',
  },
  {
    emoji: '🎯',
    title: 'Planguage Precision Reduces Rework',
    text: 'Ambiguous briefs cause expensive late-stage rework when teams discover they built to different assumptions. A Planguage spec converts soft intent into testable, verifiable criteria before a single line of code is written.',
    ref: 'Competitive Engineering, Gilb 2005 — Chapter 1',
  },
] as const

const piElapsed           = ref(0)
const piSimulatedProgress = ref(0)
const piActiveWisdomIdx   = ref(0)

let _piElapsedTimer: ReturnType<typeof setInterval> | null = null
let _piWisdomTimer:  ReturnType<typeof setInterval> | null = null
let _piAnimStart = 0

function _startPlanImportLoadingAnim(): void {
  _piAnimStart = Date.now()
  piElapsed.value = 0; piSimulatedProgress.value = 0
  if (_piElapsedTimer) { clearInterval(_piElapsedTimer); _piElapsedTimer = null }
  if (_piWisdomTimer)  { clearInterval(_piWisdomTimer);  _piWisdomTimer  = null }
  _piElapsedTimer = setInterval(() => {
    const secs = Math.round((Date.now() - _piAnimStart) / 1000)
    piElapsed.value = secs
    piSimulatedProgress.value = Math.round(Math.min(95, (1 - Math.exp(-secs / 45)) * 100))
  }, 250)
  _piWisdomTimer = setInterval(() => {
    piActiveWisdomIdx.value = (piActiveWisdomIdx.value + 1) % PLAN_IMPORTER_WISDOM.length
  }, 8_000)
}

function _stopPlanImportLoadingAnim(): void {
  if (_piElapsedTimer) { clearInterval(_piElapsedTimer); _piElapsedTimer = null }
  if (_piWisdomTimer)  { clearInterval(_piWisdomTimer);  _piWisdomTimer  = null }
  piSimulatedProgress.value = 100
}

watch(
  () =>
    !!selectedPlan.value &&
    (selectedPlan.value.importStatus === 'importing' || selectedPlan.value.importStatus === 'analysing'),
  (nowLoading) => {
    if (nowLoading) { piActiveWisdomIdx.value = 0; _startPlanImportLoadingAnim() }
    else            { _stopPlanImportLoadingAnim() }
  },
)

onUnmounted(() => _stopPlanImportLoadingAnim())
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <div
      class="fixed inset-0 z-[598] bg-black/50 backdrop-blur-sm"
      aria-hidden="true"
      @click="emit('close')"
    />

    <!-- Panel card -->
    <div
      class="fixed inset-0 z-[600] flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="Plan Agent — universal Planguage converter and improvement loop"
    >

      <!-- ORANGE HEADER -->
      <div class="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-orange-700 to-orange-600 shrink-0 select-none">
        <span class="text-xl" aria-hidden="true">📄</span>
        <div class="flex-1 min-w-0">
          <h2 class="text-base font-bold text-white leading-tight tracking-tight">Plan Agent</h2>
          <p class="text-[11px] text-white/60 leading-tight mt-0.5">Universal Planguage Converter &amp; Improvement Loop</p>
        </div>

        <!-- Plan selector (if multiple plans) -->
        <select
          v-if="plans.length > 1"
          :value="selectedPlanId ?? ''"
          class="shrink-0 bg-orange-800/50 text-white text-xs rounded-lg px-2 py-1.5 border border-white/20 focus:outline-none focus:ring-1 focus:ring-white/40 max-w-[180px] truncate"
          title="Switch between imported plans"
          @change="(e) => selectPlan((e.target as HTMLSelectElement).value || null)"
        >
          <option
            v-for="p in plans"
            :key="p.id"
            :value="p.id"
          >
            {{ p.title }}
          </option>
        </select>

        <!-- Add new plan button -->
        <button
          v-if="plans.length > 0"
          type="button"
          class="shrink-0 px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold transition-colors"
          title="Import a new plan — paste text or upload a file to convert to Planguage"
          @click="showImportForm = !showImportForm"
        >
          + Import
        </button>

        <CloseDot
          variant="on-dark"
          title="Close Plan Agent — return to the main planning workspace"
          @click="emit('close')"
        />
      </div>

      <!-- IMPORT FORM (shown when triggered) -->
      <div
        v-if="showImportForm"
        class="shrink-0 border-b border-orange-100 bg-orange-50 px-6 py-4"
      >
        <p class="text-xs font-semibold text-orange-700 mb-2">Import a plan — paste text or upload a file</p>
        <textarea
          v-model="importText"
          rows="4"
          class="w-full text-xs border border-orange-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white placeholder-slate-400"
          placeholder="Paste any strategic plan, business brief, project roadmap, or rough notes here — AI will convert it to Planguage…"
          title="Paste any text to convert to Planguage entries"
        />
        <div class="flex items-center gap-2 mt-2">
          <button
            type="button"
            class="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold transition-colors disabled:opacity-50"
            :disabled="!importText.trim()"
            title="Convert this text to Planguage — runs two AI calls (convert, then analyse). Takes ~30s."
            @click="triggerImport"
          >
            → Convert to Planguage
          </button>
          <label
            class="px-3 py-2 rounded-lg bg-white border border-orange-200 hover:bg-orange-50 text-orange-700 text-xs font-semibold transition-colors cursor-pointer"
            title="Upload a text, markdown, or document file to convert"
          >
            📎 Upload file
            <input
              ref="fileInputRef"
              type="file"
              accept=".txt,.md,.pdf,.docx"
              class="hidden"
              @change="handleFileUpload"
            />
          </label>
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg bg-white border border-orange-200 hover:bg-orange-50 text-orange-700 text-xs transition-colors"
            title="Close import form without converting"
            @click="showImportForm = false"
          >
            Cancel
          </button>
        </div>
      </div>

      <!-- BODY -->
      <div class="flex-1 min-h-0 bg-white">

        <!-- ── MODE A: EMPTY — no plans yet ── -->
        <template v-if="plans.length === 0">
          <div class="h-full flex items-center justify-center px-8">
            <div class="max-w-lg w-full">
              <!-- Upload zone -->
              <div class="border-2 border-dashed border-orange-200 rounded-2xl p-8 bg-orange-50/50 text-center mb-6">
                <div class="text-4xl mb-3" aria-hidden="true">📄</div>
                <p class="text-sm font-semibold text-orange-700 mb-1">Paste or drop any plan text, document, or brief</p>
                <p class="text-xs text-slate-500 mb-4">AI will convert it to full Planguage F./V./C./R./S. entries and analyse for problems</p>

                <textarea
                  v-model="importText"
                  rows="5"
                  class="w-full text-xs border border-orange-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white placeholder-slate-400 mb-3"
                  placeholder="Paste any strategic plan, business brief, project roadmap, or rough notes here — AI will convert it to Planguage…"
                  title="Paste text here to convert to Planguage entries"
                />

                <div class="flex items-center gap-2 justify-center flex-wrap">
                  <button
                    type="button"
                    class="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold transition-colors disabled:opacity-40"
                    :disabled="!importText.trim()"
                    title="Convert pasted text to Planguage — runs AI conversion and analysis (takes ~30 seconds)"
                    @click="triggerImport"
                  >
                    → Convert to Planguage
                  </button>
                  <label
                    class="px-4 py-2.5 rounded-xl bg-white border border-orange-200 hover:bg-orange-50 text-orange-700 text-sm font-semibold transition-colors cursor-pointer"
                    title="Upload a .txt, .md, or document file to convert to Planguage"
                  >
                    📎 Upload File
                    <input
                      type="file"
                      accept=".txt,.md,.pdf,.docx"
                      class="hidden"
                      @change="handleFileUpload"
                    />
                  </label>
                </div>
              </div>

              <!-- Sample buttons -->
              <div class="flex items-center gap-3 justify-center">
                <p class="text-xs text-slate-400">Or try a sample:</p>
                <button
                  type="button"
                  class="px-3 py-1.5 rounded-lg bg-orange-100 hover:bg-orange-200 text-orange-700 text-xs font-semibold transition-colors"
                  title="Load the Hotel CO₂ Reduction Strategy sample — pre-analysed with 3 problems found and score 68/100"
                  @click="loadSampleHotel"
                >
                  🏨 Hotel CO₂ Sample
                </button>
                <button
                  type="button"
                  class="px-3 py-1.5 rounded-lg bg-orange-100 hover:bg-orange-200 text-orange-700 text-xs font-semibold transition-colors"
                  title="Load the Mobile Habit Tracker App Brief sample — pre-analysed with 2 problems and score 74/100"
                  @click="loadSampleHabit"
                >
                  📱 Habit Tracker Sample
                </button>
              </div>
            </div>
          </div>
        </template>

        <!-- ── MODE B: PLAN LOADED ── -->
        <template v-else>

          <!-- Importing/analysing state (Rule 8: spinner + elapsed + progress + wisdom) -->
          <div
            v-if="selectedPlan && (selectedPlan.importStatus === 'importing' || selectedPlan.importStatus === 'analysing')"
            class="h-full flex items-center justify-center px-8"
          >
            <div class="max-w-md w-full text-center">
              <!-- 1. Spinner -->
              <svg class="animate-spin h-10 w-10 text-orange-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <!-- Heading + elapsed -->
              <p class="text-sm font-semibold text-orange-700 mb-0.5">
                {{ selectedPlan.importStatus === 'importing' ? 'Converting to Planguage…' : 'Analysing for problems…' }}
              </p>
              <p class="text-xs text-slate-400 mb-4">{{ piElapsed }}s elapsed — This may take 30–60 seconds</p>
              <!-- 2. Progress bar -->
              <div
                class="w-full bg-orange-100 rounded-full h-2 mb-6"
                role="progressbar"
                :aria-valuenow="piSimulatedProgress"
                aria-valuemin="0"
                aria-valuemax="100"
              >
                <div
                  class="bg-orange-500 h-2 rounded-full transition-all duration-300"
                  :style="{ width: piSimulatedProgress + '%' }"
                />
              </div>
              <!-- 3. Wisdom card -->
              <div class="rounded-2xl bg-orange-50 border border-orange-200 p-5 text-left shadow-sm min-h-[140px]">
                <div class="flex items-start gap-3">
                  <span class="text-2xl shrink-0 mt-0.5" aria-hidden="true">{{ PLAN_IMPORTER_WISDOM[piActiveWisdomIdx].emoji }}</span>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-bold text-orange-800 mb-1.5">{{ PLAN_IMPORTER_WISDOM[piActiveWisdomIdx].title }}</p>
                    <p class="text-xs text-slate-600 leading-relaxed">{{ PLAN_IMPORTER_WISDOM[piActiveWisdomIdx].text }}</p>
                    <p class="text-[10px] text-orange-400 mt-2 italic">{{ PLAN_IMPORTER_WISDOM[piActiveWisdomIdx].ref }}</p>
                  </div>
                </div>
              </div>
              <!-- 4. Dot navigation -->
              <div class="flex items-center justify-center gap-1.5 mt-3" role="tablist" aria-label="Planguage conversion wisdom cards">
                <button
                  v-for="(_, i) in PLAN_IMPORTER_WISDOM"
                  :key="i"
                  type="button"
                  :class="[
                    'h-1.5 rounded-full transition-all duration-200',
                    i === piActiveWisdomIdx ? 'bg-orange-500 w-3' : 'bg-orange-200 hover:bg-orange-300 w-1.5',
                  ]"
                  :aria-label="`Go to wisdom card ${i + 1} of ${PLAN_IMPORTER_WISDOM.length}`"
                  :aria-selected="i === piActiveWisdomIdx"
                  role="tab"
                  @click="piActiveWisdomIdx = i"
                />
              </div>
            </div>
          </div>

          <!-- Error state -->
          <div
            v-else-if="selectedPlan && selectedPlan.importStatus === 'error'"
            class="h-full flex items-center justify-center text-center px-8"
          >
            <div>
              <div class="text-4xl mb-3" aria-hidden="true">⚠️</div>
              <h4 class="text-sm font-semibold text-orange-600 mb-1">Import Failed</h4>
              <p class="text-xs text-slate-500 max-w-sm mb-4">{{ selectedPlan.importError }}</p>
              <button
                type="button"
                class="mr-2 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold transition-colors"
                title="Remove this failed import"
                @click="selectedPlan && removePlan(selectedPlan.id)"
              >
                Remove
              </button>
            </div>
          </div>

          <!-- Main 3-column layout -->
          <div
            v-else-if="selectedPlan && selectedPlan.importStatus === 'done' && currentVersion"
            class="h-full flex"
          >

            <!-- LEFT: Plan list + new import -->
            <div class="w-52 shrink-0 border-r border-slate-200 flex flex-col bg-slate-50">
              <div class="px-3 py-2 border-b border-slate-200 flex items-center justify-between select-none">
                <p class="text-xs font-bold text-slate-600 uppercase tracking-wide">Plans</p>
                <button
                  type="button"
                  class="text-[10px] font-semibold text-orange-600 hover:text-orange-800 transition-colors"
                  title="Import a new plan — paste or upload text to convert to Planguage"
                  @click="showImportForm = !showImportForm"
                >
                  + New
                </button>
              </div>
              <ScrollContainer outer-class="flex-1 min-h-0 relative" inner-class="p-2 space-y-1.5">
                <button
                  v-for="plan in plans"
                  :key="plan.id"
                  type="button"
                  :class="[
                    'w-full text-left p-2 rounded-lg transition-colors border text-xs',
                    plan.id === selectedPlanId
                      ? 'bg-orange-100 border-orange-200 text-orange-800'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100',
                  ]"
                  :title="`Select ${plan.title} — ${plan.versions.length} version(s)`"
                  @click="selectPlan(plan.id)"
                >
                  <p class="font-semibold truncate leading-tight">{{ plan.title }}</p>
                  <div class="flex items-center gap-1.5 mt-0.5">
                    <span
                      v-if="plan.importStatus === 'done' && plan.versions.length > 0"
                      :class="[
                        'text-[9px] font-bold px-1 py-0.5 rounded',
                        plan.versions[plan.versions.length - 1]?.overallScore >= 75 ? 'bg-blue-100 text-blue-700' :
                        plan.versions[plan.versions.length - 1]?.overallScore >= 60 ? 'bg-sky-100 text-sky-700' :
                        'bg-amber-100 text-amber-700',
                      ]"
                    >
                      {{ plan.versions[plan.versions.length - 1]?.overallScore }}/100
                    </span>
                    <span v-if="plan.versions.length > 1" class="text-[9px] text-slate-400">{{ plan.versions.length }} versions</span>
                    <span v-if="plan.importStatus === 'importing' || plan.importStatus === 'analysing'" class="text-[9px] text-orange-600">Loading…</span>
                  </div>
                </button>

                <!-- New plan dashed button -->
                <button
                  type="button"
                  class="w-full p-2 rounded-lg border-2 border-dashed border-orange-200 text-orange-500 hover:bg-orange-50 text-xs font-semibold transition-colors text-center"
                  title="Import another plan — opens the import form"
                  @click="showImportForm = true"
                >
                  + New Plan
                </button>
              </ScrollContainer>
            </div>

            <!-- MIDDLE: Planguage output -->
            <div class="flex-1 min-w-0 flex flex-col border-r border-slate-200">

              <!-- Version header -->
              <div class="shrink-0 px-4 py-2.5 border-b border-slate-200 flex items-center gap-3 bg-white select-none">
                <!-- Plan title -->
                <p class="text-sm font-bold text-slate-800 flex-1 min-w-0 truncate">{{ selectedPlan.title }}</p>

                <!-- Score circle -->
                <div
                  :class="['w-10 h-10 shrink-0 rounded-full border-2 flex flex-col items-center justify-center', scoreBorderClass(currentVersion.overallScore)]"
                >
                  <span :class="['text-sm font-black leading-none', scoreTextClass(currentVersion.overallScore)]">{{ currentVersion.overallScore }}</span>
                </div>

                <!-- Version selector -->
                <select
                  v-if="selectedPlan.versions.length > 1"
                  :value="selectedVersionId"
                  class="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-orange-400 max-w-[180px]"
                  title="Switch between plan versions — each improvement creates a new version"
                  @change="(e) => selectVersion((e.target as HTMLSelectElement).value)"
                >
                  <option
                    v-for="v in [...selectedPlan.versions].reverse()"
                    :key="v.id"
                    :value="v.id"
                  >
                    v{{ v.versionNumber }}: {{ v.label }}
                  </option>
                </select>
              </div>

              <!-- Version diff indicator -->
              <div
                v-if="selectedPlan.versions.length > 1 && versionDiffLabel(currentVersion, selectedPlan.versions)"
                class="shrink-0 px-4 py-1.5 bg-amber-50 border-b border-amber-100 text-xs text-amber-700 font-medium"
              >
                {{ versionDiffLabel(currentVersion, selectedPlan.versions) }}
              </div>

              <!-- Entry list -->
              <ScrollContainer outer-class="flex-1 min-h-0 relative" inner-class="px-4 py-3 space-y-2">
                <div
                  v-for="entry in currentVersion.entries"
                  :key="entry.id"
                  :class="['rounded-xl border p-3 relative', entryCardBg(entry.type)]"
                >
                  <!-- Problem indicator -->
                  <div
                    v-if="entryHasProblem(entry, currentVersion)"
                    class="absolute top-2 right-2 w-2 h-2 rounded-full bg-orange-400"
                    title="This entry has an unapplied problem — see the right column"
                  />
                  <!-- Header row -->
                  <div class="flex items-center gap-2 mb-1.5">
                    <span :class="['text-[10px] font-black px-1.5 py-0.5 rounded', entryTypeBadge(entry.type)]">{{ entry.tag }}</span>
                    <p class="text-xs font-semibold text-slate-800 flex-1 min-w-0">{{ entry.description }}</p>
                    <span :class="['text-[9px] font-semibold px-1.5 py-0.5 rounded', confClass(entry.confidence)]">{{ entry.confidence }}</span>
                  </div>
                  <!-- Details (Scale/Meter/Goal for V, constraint for C, budget for R) -->
                  <p v-if="entry.details" class="text-[11px] text-slate-500 leading-relaxed">{{ entry.details }}</p>
                  <!-- Source text -->
                  <p v-if="entry.sourceText" class="text-[10px] text-slate-400 italic mt-1 leading-relaxed">
                    "{{ entry.sourceText }}"
                  </p>
                </div>

                <!-- Empty state -->
                <div v-if="currentVersion.entries.length === 0" class="text-center py-8 text-slate-400 text-xs">
                  No entries in this version
                </div>
              </ScrollContainer>
            </div>

            <!-- RIGHT: Analysis + improvement -->
            <div class="w-72 shrink-0 flex flex-col bg-white">

              <!-- Problems section -->
              <div class="shrink-0 px-4 pt-3 pb-2 border-b border-slate-100">
                <div class="flex items-center gap-2 mb-2.5 select-none">
                  <p class="text-xs font-bold text-slate-700 uppercase tracking-wide">Problems</p>
                  <span
                    v-if="unappliedProblemCount > 0"
                    class="text-[10px] font-bold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded"
                  >
                    {{ unappliedProblemCount }} {{ unappliedProblemCount === 1 ? 'issue' : 'issues' }} found
                  </span>
                  <span
                    v-else
                    class="text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded"
                  >
                    All resolved
                  </span>
                </div>
              </div>

              <ScrollContainer outer-class="flex-1 min-h-0 relative" inner-class="px-3 py-2 space-y-2">

                <!-- Problem cards -->
                <div
                  v-for="problem in currentVersion.problems"
                  :key="problem.id"
                  :class="['rounded-lg border p-2.5 transition-opacity', problem.applied ? 'opacity-50' : 'opacity-100', 'bg-white border-slate-200']"
                >
                  <!-- Problem header -->
                  <div class="flex items-start gap-1.5 mb-1.5">
                    <span :class="['mt-1 w-2 h-2 rounded-full shrink-0', severityDot(problem.severity)]" :title="`Severity: ${problem.severity}`" />
                    <div class="flex-1 min-w-0 flex items-center gap-1 flex-wrap">
                      <span :class="['text-[9px] font-bold px-1 py-0.5 rounded', severityBadge(problem.severity)]">{{ problem.severity }}</span>
                      <span v-if="problem.entryRef" class="text-[9px] font-mono bg-slate-100 text-slate-600 px-1 py-0.5 rounded">{{ problem.entryRef }}</span>
                      <span v-if="problem.applied" class="text-[9px] font-bold text-blue-600">✓ Applied</span>
                    </div>
                  </div>
                  <!-- Description -->
                  <p class="text-[11px] text-slate-700 leading-relaxed mb-1">{{ problem.description }}</p>
                  <!-- Suggestion -->
                  <p class="text-[11px] text-slate-500 italic leading-relaxed mb-2">Suggestion: {{ problem.suggestion }}</p>
                  <!-- Apply button -->
                  <button
                    v-if="!problem.applied"
                    type="button"
                    class="w-full px-2 py-1 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 text-[10px] font-semibold transition-colors border border-orange-200"
                    :title="`Apply this suggestion: ${problem.suggestion}`"
                    @click="triggerApply(problem)"
                  >
                    Apply ✓
                  </button>
                </div>

                <!-- No problems -->
                <div v-if="currentVersion.problems.length === 0" class="text-center py-4 text-slate-400 text-xs">
                  No issues found in this version
                </div>

                <!-- Divider -->
                <div class="border-t border-slate-200 pt-3">
                  <p class="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2 select-none">Improve with a command</p>

                  <!-- Improvement status -->
                  <div
                    v-if="selectedPlan.improvingStatus === 'improving'"
                    class="flex items-center gap-2 mb-2"
                  >
                    <svg class="animate-spin h-3 w-3 text-orange-500" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <p class="text-xs text-orange-600">Improving plan…</p>
                  </div>

                  <div v-if="selectedPlan.improvingStatus === 'error'" class="mb-2">
                    <p class="text-[11px] text-orange-600">{{ selectedPlan.improvingError }}</p>
                  </div>

                  <!-- Command textarea -->
                  <textarea
                    v-model="improveCommand"
                    rows="3"
                    class="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-orange-400 placeholder-slate-400 mb-2"
                    placeholder="Type an improvement order… e.g. 'simplify all value entries', 'add innovation-focused F. entries', 'make V.1 goal more ambitious', 'add missing constraint for data privacy'"
                    title="Type a natural-language improvement command — AI will apply it and create a new version"
                    :disabled="selectedPlan.improvingStatus === 'improving'"
                  />

                  <!-- Quick-command pills -->
                  <div class="flex flex-wrap gap-1 mb-2">
                    <button
                      type="button"
                      class="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-orange-100 hover:bg-orange-200 text-orange-700 transition-colors"
                      title="Simplify all entries — reduce jargon and tighten descriptions"
                      @click="setQuickCommand('Simplify all entries — reduce jargon and tighten descriptions')"
                    >
                      Simplify
                    </button>
                    <button
                      type="button"
                      class="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-orange-100 hover:bg-orange-200 text-orange-700 transition-colors"
                      title="Innovate — add ambitious new value entries and solution ideas"
                      @click="setQuickCommand('Innovate — add ambitious new value entries and forward-thinking solution ideas')"
                    >
                      Innovate
                    </button>
                    <button
                      type="button"
                      class="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-orange-100 hover:bg-orange-200 text-orange-700 transition-colors"
                      title="Add missing value entries — identify implied values not yet captured"
                      @click="setQuickCommand('Add missing V. entries — identify all implied values not yet captured as explicit Planguage Value entries')"
                    >
                      Add Values
                    </button>
                    <button
                      type="button"
                      class="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-orange-100 hover:bg-orange-200 text-orange-700 transition-colors"
                      title="Tighten constraints — make all C. entries more precise with Must/Must not form"
                      @click="setQuickCommand('Tighten all C. constraints — ensure each uses the Must/Must not form and has a clear scope')"
                    >
                      Tighten Constraints
                    </button>
                    <button
                      type="button"
                      class="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-orange-100 hover:bg-orange-200 text-orange-700 transition-colors"
                      title="Make measurable — add Scale, Meter, Goal, Tolerable to all V. entries that are missing them"
                      @click="setQuickCommand('Make all V. entries fully measurable — add Scale, Meter, Goal, and Tolerable to any V. entry that is missing them')"
                    >
                      Make Measurable
                    </button>
                  </div>

                  <!-- Apply button -->
                  <button
                    type="button"
                    class="w-full px-3 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                    :disabled="!improveCommand.trim() || selectedPlan.improvingStatus === 'improving'"
                    title="Apply the improvement command — AI will update the plan and create a new version"
                    @click="triggerImprove"
                  >
                    ▶ Apply Command
                  </button>

                  <!-- Sample plans (shown at bottom as persistent shortcuts) -->
                  <div class="mt-3 pt-3 border-t border-slate-100">
                    <p class="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1.5 select-none">Load a sample plan</p>
                    <div class="flex gap-1.5">
                      <button
                        type="button"
                        class="flex-1 text-[9px] font-semibold px-1.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                        title="Load the Hotel CO₂ Reduction Strategy sample"
                        @click="loadSampleHotel"
                      >
                        🏨 Hotel CO₂
                      </button>
                      <button
                        type="button"
                        class="flex-1 text-[9px] font-semibold px-1.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                        title="Load the Mobile Habit Tracker App Brief sample"
                        @click="loadSampleHabit"
                      >
                        📱 Habit Tracker
                      </button>
                    </div>
                  </div>

                </div>
              </ScrollContainer>

            </div>
          </div>

        </template>

      </div>
    </div>
  </Teleport>
</template>
