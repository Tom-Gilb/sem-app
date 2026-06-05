<!-- ResourcesSharpenPanel.vue — Stage 10 / Resources sharpening guided panel.
     Tom Gilb 2026-06-04: Phase 0 of the Resources stage beef-up.
     Shows the 9 sharpening dimensions (Calendar Time / Work Hours /
     Specialists / Tech Debt / Future Maintenance / Decommissioning / ROI /
     Efficiency / Tradeoffs), each with guided questions + worked examples
     + Gilb citation per the Conjunction-of-Technologies SUPREME rule.

     Composes WITH:
       • SingleSurface (registerExclusiveSurface) — modal-style overlay.
       • CloseDot rule — close affordance at top-right.
       • ScrollContainer rule — all overflow-y-auto wrapped.
       • DD-009 Interaction Disclosure — every multi-mode element has a title.
       • Conjunction-of-Technologies — each dimension card shows the Gilb cite.

     This v1 is a GUIDE only — does NOT yet write R. entries to the SpecBlock.
     Schema change (REntry type, resources?: REntry[] on SpecBlock) is Phase 1,
     pending Tom's OK. The Claudian-path analysis prompt is exported alongside
     so Tom can already drive an analysis manually via Claudian. -->

<script setup lang="ts">
// UNIT_TYPE=Widget
import { ref, computed } from 'vue'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'
import { RESOURCES_SHARPEN_DIMENSIONS, RESOURCES_ADVANCED_TOOLS, RESOURCES_ANALYSIS_PROMPT } from '../data/resourcesSharpenDimensions'
import type { ResourcesSharpenDimension } from '../data/resourcesSharpenDimensions'
import type { SpecBlock } from '../types/spec'
import { useToast } from '../composables/useToast'
import {
  parseResourcesAnalysis,
  applyApprovedToSpec,
  SOURCE_LAYER_LABELS,
  SOURCE_LAYER_TONES,
  type ResourcesAnalysisOutput,
  type AnalyticalFinding,
  type REntryProposal,
  type SEntryProposal,
  type CEntryProposal,
  type ApprovalSet,
} from '../composables/useResourcesAnalysisParser'
import { useResourcesSharpAnswers, type SelectionMode } from '../composables/useResourcesSharpAnswers'

const props = defineProps<{
  open: boolean
  spec: SpecBlock | null
  planId?: string
  capturedCalendarCosts?: Record<string, number>
  capturedCapitalCosts?:  Record<string, number>
  capturedVCRatios?:      Record<string, number>
}>()

const emit = defineEmits<{
  close: []
  /** Phase 2 (r88): emitted when user approves findings and clicks "Apply".
   *  Payload is the updated SpecBlock; parent merges into `currentSpec.value`. */
  'apply-analysis': [updatedSpec: SpecBlock]
}>()

const { showToast } = useToast()

// ─── Resources sharp answers composable ──────────────────────────────────────
const planIdRef = computed(() => props.planId ?? props.spec?.name ?? 'default')
const {
  getAnswer,
  setTypedAnswer,
  toggleTicked,
  setMode,
  isTicked,
  getEffectiveAnswer,
  answeredInCategory,
} = useResourcesSharpAnswers(planIdRef)

// Selection mode pills — same UX as EvoSharpInterview.
const SELECTION_MODES: Array<{ id: SelectionMode; label: string; title: string }> = [
  { id: 'mixed',       label: 'Mixed',         title: 'Use your typed answer + any ticked suggestions (default)' },
  { id: 'all',         label: 'All',            title: 'Use your typed answer + ALL suggestions regardless of ticks' },
  { id: 'typed-only',  label: 'My answer only', title: 'Use only your typed answer; ignore all suggestions' },
  { id: 'ticked-only', label: 'Ticked only',    title: 'Use only the suggestions you have ticked; ignore your typed answer' },
]

/** Counts answered questions for one dimension (memoised via helper to avoid
 *  repeated inline expression in template). */
function dimAnsweredCount(dim: ResourcesSharpenDimension): number {
  return answeredInCategory(
    dim.id,
    dim.questions.map((_, qi) => ({ id: String(qi), suggestedAnswers: dim.suggestedAnswers?.[qi] })),
  )
}

// Progress counters for the header subtitle.
const totalQuestionsCount = computed(() =>
  RESOURCES_SHARPEN_DIMENSIONS.reduce((s, d) => s + d.questions.length, 0),
)
const totalAnsweredCount = computed(() =>
  RESOURCES_SHARPEN_DIMENSIONS.reduce((s, dim) => s + dimAnsweredCount(dim), 0),
)

// Which dimension card is expanded (single-expand for focus).
const expandedId = ref<string | null>(RESOURCES_SHARPEN_DIMENSIONS[0]?.id ?? null)
const expandedToolId = ref<string | null>(null)

function toggle(id: string): void {
  expandedId.value = expandedId.value === id ? null : id
}
function toggleTool(id: string): void {
  expandedToolId.value = expandedToolId.value === id ? null : id
}

// ─── Phase 2 (r88): Apply Claudian Analysis ──────────────────────────────────
// Paste-back textarea → parse → staged findings → tick-to-approve → emit
// updated SpecBlock to parent.  Per Claude-Code-as-AI-Layer SUPREME rule,
// SEM never calls an external AI; the AI work happens in Claudian (local
// terminal) and the user round-trips the JSON manually.

const pastedAnalysisText = ref('')
const parsedAnalysis     = ref<ResourcesAnalysisOutput | null>(null)
const parseErrors        = ref<string[]>([])
const parseWarnings      = ref<string[]>([])

/** Set of stage-keys that are TICKED to approve.  Key format depends on type:
 *    `findingApprovalKey()` for analytical findings
 *    `proposalApprovalKey()` for generative tool proposals
 *  Removing a key = un-tick. */
const approvedKeys = ref<Set<string>>(new Set())

function parsePastedAnalysis(): void {
  const result = parseResourcesAnalysis(pastedAnalysisText.value)
  parsedAnalysis.value = result.data ?? null
  parseErrors.value    = result.errors
  parseWarnings.value  = result.warnings
  // Don't auto-tick anything — user must explicitly approve.
  approvedKeys.value = new Set()
  if (result.ok) {
    const aCount = Object.values(result.data?.partA ?? {}).reduce((s, arr) => s + arr.length, 0)
    const bCount = Object.values(result.data?.partB ?? {}).reduce((s, tool) => {
      return s + (tool.proposedREntries?.length ?? 0)
               + (tool.proposedSEntries?.length ?? 0)
               + (tool.proposedCEntries?.length ?? 0)
               + (tool.proposedFieldEdits?.length ?? 0)
    }, 0)
    showToast(`Parsed ${aCount} analytical findings + ${bCount} generative proposals — tick to approve`, 5000)
  } else {
    showToast(`Parse failed — ${result.errors.length} errors; fix the JSON and try again`, 6000)
  }
}

function findingApprovalKey(dimensionId: string, idx: number): string {
  return `A:${dimensionId}:${idx}`
}
function proposalApprovalKey(toolId: string, kind: 'R'|'S'|'C'|'F', idx: number): string {
  return `B:${toolId}:${kind}:${idx}`
}
function toggleApproval(key: string): void {
  const next = new Set(approvedKeys.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  approvedKeys.value = next
}

const approvalCount = computed(() => approvedKeys.value.size)

/** Walk the parsed analysis + the approvedKeys set and build the ApprovalSet
 *  shape the apply-handler consumes. */
function buildApprovalSet(): ApprovalSet {
  const out: ApprovalSet = { rEntries: [], sEntries: [], cEntries: [], fieldEdits: [] }
  if (!parsedAnalysis.value) return out
  // Part A — each finding may have a proposedREntry that gets approved if the
  // FINDING is ticked (the tradeoff field is informational only — applies on its own row).
  for (const [dimId, findings] of Object.entries(parsedAnalysis.value.partA ?? {})) {
    findings.forEach((f, i) => {
      if (!approvedKeys.value.has(findingApprovalKey(dimId, i))) return
      if (f.proposedREntry) out.rEntries.push(f.proposedREntry)
    })
  }
  // Part B — per tool, walk proposal arrays and include only the ticked.
  for (const [toolId, tool] of Object.entries(parsedAnalysis.value.partB ?? {})) {
    ;(tool.proposedREntries ?? []).forEach((p, i) => {
      if (approvedKeys.value.has(proposalApprovalKey(toolId, 'R', i))) out.rEntries.push(p)
    })
    ;(tool.proposedSEntries ?? []).forEach((p, i) => {
      if (approvedKeys.value.has(proposalApprovalKey(toolId, 'S', i))) out.sEntries.push(p)
    })
    ;(tool.proposedCEntries ?? []).forEach((p, i) => {
      if (approvedKeys.value.has(proposalApprovalKey(toolId, 'C', i))) out.cEntries.push(p)
    })
    ;(tool.proposedFieldEdits ?? []).forEach((p, i) => {
      if (approvedKeys.value.has(proposalApprovalKey(toolId, 'F', i))) {
        out.fieldEdits.push({ entryId: p.entryId, field: p.field, proposedValue: p.proposedValue })
      }
    })
  }
  return out
}

function applyApproved(): void {
  if (!props.spec) {
    showToast('No Spec loaded — nothing to write findings into', 4000)
    return
  }
  if (approvalCount.value === 0) {
    showToast('Tick at least one finding before applying', 3500)
    return
  }
  const approvals = buildApprovalSet()
  const updatedSpec = applyApprovedToSpec(props.spec, approvals)
  emit('apply-analysis', updatedSpec)
  const summary = [
    approvals.rEntries.length   ? `${approvals.rEntries.length} R.` : null,
    approvals.sEntries.length   ? `${approvals.sEntries.length} S.` : null,
    approvals.cEntries.length   ? `${approvals.cEntries.length} C.` : null,
    approvals.fieldEdits.length ? `${approvals.fieldEdits.length} field edit${approvals.fieldEdits.length !== 1 ? 's' : ''}` : null,
  ].filter(Boolean).join(' + ')
  showToast(`✓ Applied ${summary} — spec updated`, 5500)
  // Reset staging so the user can paste a fresh analysis if they want another round.
  approvedKeys.value = new Set()
}

// Cost-data summary panels — derived from prior-stage captured data.
const totalCalendarCost = computed(() =>
  Object.values(props.capturedCalendarCosts ?? {}).reduce((sum, v) => sum + (v || 0), 0)
)
const totalCapitalCost = computed(() =>
  Object.values(props.capturedCapitalCosts ?? {}).reduce((sum, v) => sum + (v || 0), 0)
)
const topVCRatios = computed(() => {
  const entries = Object.entries(props.capturedVCRatios ?? {})
  return entries.sort((a, b) => b[1] - a[1]).slice(0, 5)
})

// Copy the Claudian analysis prompt + spec to clipboard for the AI-assist path.
async function copyAnalysisRequest(): Promise<void> {
  const payload = [
    RESOURCES_ANALYSIS_PROMPT,
    '',
    'INPUT_SPEC_JSON:',
    JSON.stringify(props.spec ?? {}, null, 2),
    '',
    'CAPTURED_COSTS:',
    JSON.stringify({
      calendarCosts: props.capturedCalendarCosts ?? {},
      capitalCosts:  props.capturedCapitalCosts  ?? {},
      vcRatios:      props.capturedVCRatios      ?? {},
    }, null, 2),
  ].join('\n')

  try {
    await navigator.clipboard.writeText(payload)
    showToast('📋 Resources analysis prompt + spec copied — paste into Claudian to run analysis', 6000)
  } catch (err) {
    showToast('Copy blocked — see Console', 5000)
    console.error('[ResourcesSharpenPanel] clipboard copy failed', err)
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="resources-panel">
      <div v-if="open" class="fixed inset-0 z-[700]">
        <!-- Backdrop (CloseDot rule: click-outside closes) -->
        <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" @click="emit('close')" />

        <!-- Panel -->
        <section
          class="absolute inset-4 md:inset-10 lg:inset-16 rounded-2xl bg-white shadow-2xl
                 ring-1 ring-slate-200 flex flex-col overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Stage 10 · Resources Sharpening"
        >
          <!-- Header -->
          <header class="flex items-start justify-between px-6 py-4 bg-gradient-to-br from-emerald-50 to-teal-50 border-b border-emerald-200">
            <div class="flex items-center gap-4">
              <div class="inline-flex items-center gap-3 rounded-2xl pl-3 pr-5 py-2 select-none
                          bg-gradient-to-r from-emerald-500 to-teal-500
                          shadow-lg ring-2 ring-emerald-300/40">
                <span class="text-[11px] font-extrabold leading-none bg-black/60 text-white rounded-md px-2 py-1.5"
                      aria-hidden="true">10</span>
                <span class="flex flex-col items-start leading-tight">
                  <span class="text-[9px] font-semibold uppercase tracking-[0.15em] text-emerald-100">Stage Now</span>
                  <span class="text-base font-extrabold text-white">Resources</span>
                </span>
              </div>
              <div>
                <h2 class="text-lg font-bold text-emerald-900">Resources Sharpening</h2>
                <p class="text-[12px] text-emerald-700/80">
                  9 dimensions · {{ totalAnsweredCount }} / {{ totalQuestionsCount }} questions answered · Conjunction-of-Technologies: every finding traces to a Gilb source.
                </p>
              </div>
            </div>
            <CloseDot size="lg" @click="emit('close')" />
          </header>

          <!-- Body — ScrollContainer rule: outer must have min-h-0 (flex child can't
               shrink below content-size without it) + relative (absolute overlay
               indicator needs a positioning context); inner gets h-full so the
               overflow-y-auto div is height-constrained and actually scrolls.
               Padding lives on inner-class so it's inside the scroll area. -->
          <ScrollContainer class="flex-1 min-h-0 relative" inner-class="h-full px-6 py-5">
            <!-- Derived cost summary -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
              <div class="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-3">
                <div class="text-[10px] uppercase font-bold text-emerald-700 tracking-wider">Calendar Cost (from prior stages)</div>
                <div class="text-2xl font-extrabold text-emerald-900 mt-1">
                  {{ totalCalendarCost.toLocaleString() }}
                  <span class="text-xs font-normal text-emerald-700/80 ml-1">days</span>
                </div>
              </div>
              <div class="rounded-xl border-2 border-violet-200 bg-violet-50 p-3">
                <div class="text-[10px] uppercase font-bold text-violet-700 tracking-wider">Capital Cost (captured)</div>
                <div class="text-2xl font-extrabold text-violet-900 mt-1">
                  ${{ totalCapitalCost.toLocaleString() }}
                </div>
              </div>
              <div class="rounded-xl border-2 border-blue-200 bg-blue-50 p-3">
                <div class="text-[10px] uppercase font-bold text-blue-700 tracking-wider">Top V/C ratios (efficiency)</div>
                <ul class="text-[11px] text-blue-900 mt-1 space-y-0.5">
                  <li v-for="[k, v] in topVCRatios" :key="k">
                    <b>{{ k }}</b>: {{ v.toFixed(2) }}
                  </li>
                  <li v-if="topVCRatios.length === 0" class="italic opacity-70">No V/C data yet — complete Impact Estimation first.</li>
                </ul>
              </div>
            </div>

            <!-- AI-assist CTA -->
            <div class="mb-6 rounded-xl border-2 border-amber-300 bg-amber-50 p-4 flex items-start gap-3">
              <span class="text-2xl" aria-hidden="true">🧠</span>
              <div class="flex-1">
                <div class="font-bold text-amber-900">AI-assist via Claudian (local — per Claude-Code-as-AI-Layer rule)</div>
                <div class="text-[12px] text-amber-800 mt-1 leading-relaxed">
                  Copy the analysis prompt + current spec to your clipboard, paste into Claudian,
                  and Claudian writes a structured JSON analysis (one finding per dimension, with Gilb citations).
                  No external API call from the SEM App — the AI work happens in your local Claude Code session.
                </div>
              </div>
              <button
                type="button"
                class="shrink-0 px-4 py-2 rounded-lg bg-amber-600 text-white font-bold text-sm
                       hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
                title="Copy the analysis prompt + current SpecBlock JSON to clipboard, ready to paste into Claudian"
                @click="copyAnalysisRequest()"
              >📋 Copy prompt + spec</button>
            </div>

            <!-- Dimension cards -->
            <ol class="space-y-3">
              <li
                v-for="(dim, idx) in RESOURCES_SHARPEN_DIMENSIONS"
                :key="dim.id"
                class="rounded-xl border-2 transition-all duration-150"
                :class="expandedId === dim.id
                  ? 'border-emerald-400 bg-white shadow-md'
                  : 'border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300'"
              >
                <button
                  type="button"
                  class="w-full flex items-start gap-3 p-4 text-left
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-xl"
                  :aria-expanded="expandedId === dim.id"
                  :aria-controls="`dim-body-${dim.id}`"
                  :title="`${dim.label} — ${dim.summary}`"
                  @click="toggle(dim.id)"
                >
                  <span class="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full
                               bg-emerald-100 text-emerald-700 font-extrabold text-sm">
                    {{ idx + 1 }}
                  </span>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1">
                      <span class="font-bold text-slate-900 text-[15px]">{{ dim.label }}</span>
                      <span
                        class="shrink-0 text-[9px] font-mono px-1 py-px rounded ml-1"
                        :class="dimAnsweredCount(dim) === dim.questions.length
                          ? 'bg-emerald-100 text-emerald-700'
                          : dimAnsweredCount(dim) > 0
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-100 text-slate-400'"
                      >{{ dimAnsweredCount(dim) }}/{{ dim.questions.length }}</span>
                    </div>
                    <div class="text-[12px] text-slate-600 mt-0.5">{{ dim.summary }}</div>
                  </div>
                  <span class="shrink-0 text-slate-400 text-xs mt-1" aria-hidden="true">
                    {{ expandedId === dim.id ? '▼' : '▶' }}
                  </span>
                </button>
                <div
                  v-if="expandedId === dim.id"
                  :id="`dim-body-${dim.id}`"
                  class="px-4 pb-4 pt-1 border-t border-emerald-100"
                >
                  <!-- Why it matters -->
                  <div class="mb-3 px-3 py-2 rounded-md bg-amber-50 border-l-4 border-amber-400">
                    <span class="text-[11px] uppercase font-bold text-amber-700 tracking-wider mr-2">Why this matters</span>
                    <span class="text-[12px] text-amber-900">{{ dim.whyItMatters }}</span>
                  </div>
                  <!-- Interactive per-question blocks (EvoSharpInterview-style UX) -->
                  <div class="mb-4 space-y-4">
                    <div class="text-[11px] uppercase font-bold text-slate-600 tracking-wider mb-2">Guided questions</div>
                    <div
                      v-for="(q, qi) in dim.questions"
                      :key="qi"
                      class="space-y-2 pb-3 border-b border-slate-100 last:border-b-0"
                    >
                      <!-- Question -->
                      <label class="block">
                        <span class="text-sm font-semibold text-slate-800">{{ q }}</span>
                      </label>

                      <!-- Planner textarea -->
                      <div>
                        <p class="text-[10px] font-bold uppercase tracking-wide text-emerald-700 mb-0.5">Planner's answer</p>
                        <textarea
                          :value="getAnswer(dim.id, String(qi)).typed"
                          placeholder="Your answer…"
                          rows="2"
                          class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800
                                 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400
                                 transition-colors resize-y"
                          :aria-label="`Your answer to: ${q}`"
                          @input="(e) => setTypedAnswer(dim.id, String(qi), (e.target as HTMLTextAreaElement).value)"
                        />
                      </div>

                      <!-- Suggested answers chips -->
                      <div v-if="dim.suggestedAnswers?.[qi]?.length" class="space-y-1.5">
                        <p class="text-[10px] font-bold uppercase tracking-wide text-indigo-700 mb-0.5">Suggested answers — tick any to approve</p>
                        <label
                          v-for="(sugg, si) in dim.suggestedAnswers![qi]"
                          :key="si"
                          class="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 hover:bg-emerald-50/40 cursor-pointer transition-colors"
                          :class="isTicked(dim.id, String(qi), si) ? 'border-emerald-300 bg-emerald-50/60' : ''"
                          :title="`Suggestion ${si + 1} — click to ${isTicked(dim.id, String(qi), si) ? 'remove from' : 'add to'} effective answer (Mixed mode)`"
                        >
                          <input
                            type="checkbox"
                            :checked="isTicked(dim.id, String(qi), si)"
                            class="mt-0.5 flex-shrink-0 accent-emerald-600 cursor-pointer"
                            :aria-label="`Tick suggestion ${si + 1} for question: ${q}`"
                            @change="toggleTicked(dim.id, String(qi), si)"
                          />
                          <span class="text-xs text-slate-700 leading-snug flex-1">
                            <span class="text-[9px] font-mono font-bold text-emerald-600 mr-1">#{{ si + 1 }}</span>{{ sugg }}
                          </span>
                        </label>
                      </div>

                      <!-- Mode pills -->
                      <div class="flex items-center gap-1.5 flex-wrap">
                        <span class="text-[10px] font-bold uppercase tracking-wide text-slate-500 mr-1">Use:</span>
                        <button
                          v-for="m in SELECTION_MODES"
                          :key="m.id"
                          type="button"
                          class="text-[10px] font-semibold px-2 py-0.5 rounded border transition-colors"
                          :class="getAnswer(dim.id, String(qi)).mode === m.id
                            ? 'bg-emerald-600 text-white border-emerald-700'
                            : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'"
                          :title="m.title"
                          @click="setMode(dim.id, String(qi), m.id)"
                        >{{ m.label }}</button>
                      </div>

                      <!-- Effective answer preview -->
                      <div class="rounded-lg bg-emerald-50/60 border border-emerald-200 px-2.5 py-1.5">
                        <p class="text-[10px] font-bold uppercase tracking-wide text-emerald-700 mb-0.5">Effective answer (what will export)</p>
                        <p
                          v-if="getEffectiveAnswer(dim.id, String(qi), dim.suggestedAnswers?.[qi] ?? []).trim().length > 0"
                          class="text-[11px] text-slate-800 whitespace-pre-wrap leading-snug"
                        >{{ getEffectiveAnswer(dim.id, String(qi), dim.suggestedAnswers?.[qi] ?? []) }}</p>
                        <p v-else class="text-[11px] text-slate-400 italic">
                          (empty — type an answer or tick a suggestion to populate)
                        </p>
                      </div>
                    </div>
                  </div>
                  <!-- Examples -->
                  <div class="mb-3">
                    <div class="text-[11px] uppercase font-bold text-slate-600 tracking-wider mb-1">Worked examples</div>
                    <ul class="space-y-1.5">
                      <li
                        v-for="(ex, ei) in dim.examples"
                        :key="ei"
                        class="font-mono text-[11.5px] text-slate-700 bg-slate-100 rounded px-2 py-1.5"
                      >{{ ex }}</li>
                    </ul>
                  </div>
                  <!-- Gilb citation -->
                  <div class="px-3 py-2 rounded-md bg-violet-50 border-l-4 border-violet-400">
                    <span class="text-[11px] uppercase font-bold text-violet-700 tracking-wider mr-2">Cited from Gilb</span>
                    <span class="text-[12px] text-violet-900 italic">{{ dim.gilbCite }}</span>
                  </div>
                  <!-- Standard link if any -->
                  <div v-if="dim.standardRef" class="mt-2 text-[11px] text-slate-500">
                    Canonical: <code class="text-slate-700">{{ dim.standardRef }}</code>
                  </div>
                </div>
              </li>
            </ol>

            <!-- ── Advanced Tools section ─────────────────────────────────────
                 Tom 2026-06-04 extension: 5 GENERATIVE tools (vs the 9
                 analytical dimensions above).  Each tool, when run via
                 Claudian, produces NEW spec content — proposed R. entry
                 tightenings, sharpened Scales+Meters, new S. strategies,
                 new C. binary constraints, and Scale Qualifier audits. -->
            <div class="mt-8 pt-6 border-t-2 border-emerald-200">
              <div class="flex items-center gap-3 mb-3">
                <span class="inline-flex items-center justify-center w-8 h-8 rounded-full
                             bg-violet-600 text-white font-extrabold text-sm" aria-hidden="true">⚙</span>
                <div>
                  <h3 class="text-base font-extrabold text-violet-900">Advanced Resource Tools</h3>
                  <p class="text-[12px] text-violet-700/80">
                    Generative tools — produce sharpened or new spec content.  Run any tool via Claudian using
                    the prompt + spec copy button above.  This is advanced Planguage —
                    cite Competitive Engineering (CE 2005), Cost Engineering, Optima, and Systems Enterprise Architecture (SEA).
                  </p>
                </div>
              </div>
              <ol class="space-y-3">
                <li
                  v-for="(tool, idx) in RESOURCES_ADVANCED_TOOLS"
                  :key="tool.id"
                  class="rounded-xl border-2 transition-all duration-150"
                  :class="expandedToolId === tool.id
                    ? 'border-violet-400 bg-white shadow-md'
                    : 'border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300'"
                >
                  <button
                    type="button"
                    class="w-full flex items-start gap-3 p-4 text-left
                           focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 rounded-xl"
                    :aria-expanded="expandedToolId === tool.id"
                    :aria-controls="`tool-body-${tool.id}`"
                    :title="`${tool.label} — ${tool.summary}`"
                    @click="toggleTool(tool.id)"
                  >
                    <span class="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full
                                 bg-violet-100 text-violet-700 font-extrabold text-sm">
                      {{ idx + 1 }}
                    </span>
                    <div class="flex-1 min-w-0">
                      <div class="font-bold text-slate-900 text-[15px]">{{ tool.label }}</div>
                      <div class="text-[12px] text-slate-600 mt-0.5">{{ tool.summary }}</div>
                    </div>
                    <span class="shrink-0 text-slate-400 text-xs mt-1" aria-hidden="true">
                      {{ expandedToolId === tool.id ? '▼' : '▶' }}
                    </span>
                  </button>
                  <div
                    v-if="expandedToolId === tool.id"
                    :id="`tool-body-${tool.id}`"
                    class="px-4 pb-4 pt-1 border-t border-violet-100"
                  >
                    <div class="mb-3 px-3 py-2 rounded-md bg-blue-50 border-l-4 border-blue-400">
                      <span class="text-[11px] uppercase font-bold text-blue-700 tracking-wider mr-2">When to use</span>
                      <span class="text-[12px] text-blue-900">{{ tool.whenToUse }}</span>
                    </div>
                    <div class="mb-3">
                      <div class="text-[11px] uppercase font-bold text-slate-600 tracking-wider mb-1">Output shape (what Claudian produces)</div>
                      <div class="font-mono text-[11.5px] text-slate-700 bg-slate-100 rounded px-2 py-1.5 whitespace-pre-wrap">{{ tool.outputShape }}</div>
                    </div>
                    <div class="mb-3">
                      <div class="text-[11px] uppercase font-bold text-slate-600 tracking-wider mb-1">Worked examples</div>
                      <ul class="space-y-1.5">
                        <li
                          v-for="(ex, ei) in tool.examples"
                          :key="ei"
                          class="font-mono text-[11.5px] text-slate-700 bg-slate-100 rounded px-2 py-1.5"
                        >{{ ex }}</li>
                      </ul>
                    </div>
                    <div class="px-3 py-2 rounded-md bg-violet-50 border-l-4 border-violet-400">
                      <span class="text-[11px] uppercase font-bold text-violet-700 tracking-wider mr-2">Cited from Gilb</span>
                      <span class="text-[12px] text-violet-900 italic">{{ tool.gilbCite }}</span>
                    </div>
                    <div v-if="tool.standardRef" class="mt-2 text-[11px] text-slate-500">
                      Canonical: <code class="text-slate-700">{{ tool.standardRef }}</code>
                    </div>
                  </div>
                </li>
              </ol>
            </div>

            <!-- ── Phase 2 (r88): Apply Claudian Analysis ──────────────────────
                 Paste-back textarea → parser → staged findings list → tick-to-
                 approve per finding → "Apply Approved" emits updated SpecBlock.
                 Per AI-Max rule: nothing is imposed; every proposal is opt-in
                 with a visible source-layer badge so the user knows where it
                 came from (derived-from-plan / cited-from-gilb / etc.). -->
            <div class="mt-8 pt-6 border-t-2 border-slate-300">
              <div class="flex items-center gap-3 mb-3">
                <span class="inline-flex items-center justify-center w-8 h-8 rounded-full
                             bg-emerald-700 text-white font-extrabold text-sm" aria-hidden="true">⇩</span>
                <div class="flex-1">
                  <h3 class="text-base font-extrabold text-emerald-900">Apply Claudian Analysis</h3>
                  <p class="text-[12px] text-emerald-700/80">
                    Paste the JSON Claudian emitted after running the prompt above.  Each finding shows its source-layer
                    badge.  Tick to approve, then click <b>Apply Approved Findings</b> — proposed R./S./C. entries land
                    in <code>SpecBlock</code>.
                  </p>
                </div>
              </div>

              <textarea
                v-model="pastedAnalysisText"
                rows="6"
                placeholder='Paste Claudian JSON here, e.g. { "schemaVersion": "1", "partA": { … }, "partB": { … } }'
                class="w-full font-mono text-[12px] text-slate-900 bg-slate-50 border-2 border-slate-300 rounded-lg
                       p-3 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
              />
              <div class="flex items-center gap-3 mt-2">
                <button
                  type="button"
                  class="px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold text-sm
                         hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition"
                  :disabled="!pastedAnalysisText.trim()"
                  @click="parsePastedAnalysis()"
                >Parse</button>
                <button
                  v-if="parsedAnalysis"
                  type="button"
                  class="px-4 py-2 rounded-lg bg-slate-200 text-slate-700 font-semibold text-sm
                         hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400 transition"
                  @click="pastedAnalysisText = ''; parsedAnalysis = null; parseErrors = []; parseWarnings = []; approvedKeys = new Set()"
                >Clear</button>
                <span v-if="parsedAnalysis" class="text-[12px] text-emerald-700 italic ml-auto">
                  {{ approvalCount }} tick{{ approvalCount === 1 ? '' : 's' }} approved
                </span>
              </div>

              <!-- Parse errors / warnings -->
              <div v-if="parseErrors.length > 0" class="mt-3 px-3 py-2 rounded-md bg-red-50 border-l-4 border-red-500">
                <div class="text-[11px] uppercase font-bold text-red-700 tracking-wider mb-1">Parse errors ({{ parseErrors.length }})</div>
                <ul class="list-disc pl-5 text-[12px] text-red-900 space-y-0.5">
                  <li v-for="(e, i) in parseErrors" :key="i" class="font-mono">{{ e }}</li>
                </ul>
              </div>
              <div v-if="parseWarnings.length > 0" class="mt-2 px-3 py-2 rounded-md bg-amber-50 border-l-4 border-amber-400">
                <div class="text-[11px] uppercase font-bold text-amber-700 tracking-wider mb-1">Warnings ({{ parseWarnings.length }})</div>
                <ul class="list-disc pl-5 text-[12px] text-amber-900 space-y-0.5">
                  <li v-for="(w, i) in parseWarnings" :key="i" class="font-mono">{{ w }}</li>
                </ul>
              </div>

              <!-- Staged findings — Part A analytical -->
              <div v-if="parsedAnalysis?.partA && Object.keys(parsedAnalysis.partA).length > 0" class="mt-5">
                <div class="text-[11px] uppercase font-bold text-slate-600 tracking-wider mb-2">Analytical findings (Part A)</div>
                <div v-for="(findings, dimId) in parsedAnalysis.partA" :key="dimId" class="mb-4">
                  <div class="text-[11px] font-bold text-emerald-800 mb-1">{{ dimId }}</div>
                  <ul class="space-y-2">
                    <li
                      v-for="(f, i) in (findings as AnalyticalFinding[])"
                      :key="i"
                      class="rounded-lg border-2 border-slate-200 bg-white px-3 py-2.5"
                    >
                      <div class="flex items-start gap-3">
                        <input
                          type="checkbox"
                          class="mt-1 w-4 h-4 accent-emerald-600 cursor-pointer"
                          :checked="approvedKeys.has(findingApprovalKey(dimId, i))"
                          @change="toggleApproval(findingApprovalKey(dimId, i))"
                        />
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center gap-2 flex-wrap mb-1">
                            <span
                              class="text-[10px] uppercase font-bold rounded px-1.5 py-0.5"
                              :style="{
                                backgroundColor: SOURCE_LAYER_TONES[f.source].bg,
                                color: SOURCE_LAYER_TONES[f.source].text,
                                borderLeft: `3px solid ${SOURCE_LAYER_TONES[f.source].border}`,
                              }"
                            >{{ SOURCE_LAYER_LABELS[f.source] }}</span>
                            <span class="text-[10px] uppercase font-bold text-slate-500">{{ f.severity }}</span>
                          </div>
                          <div class="font-bold text-[13px] text-slate-900">{{ f.title }}</div>
                          <div class="text-[12px] text-slate-700 mt-0.5">{{ f.description }}</div>
                          <div v-if="f.gilbCite" class="text-[11px] text-violet-700 italic mt-1">{{ f.gilbCite }}</div>
                          <div v-if="f.proposedREntry" class="mt-2 px-2 py-1.5 rounded bg-teal-50 border-l-3 border-teal-500 text-[11.5px] font-mono text-teal-900">
                            <b>Proposed R. entry:</b> {{ f.proposedREntry.id }} · Goal: {{ f.proposedREntry.goal }} · Tolerable: {{ f.proposedREntry.tolerable }}
                          </div>
                          <div v-if="f.tradeoff" class="mt-1 px-2 py-1.5 rounded bg-orange-50 border-l-3 border-orange-500 text-[11.5px] text-orange-900">
                            <b>Tradeoff:</b> give "{{ f.tradeoff.give }}", save "{{ f.tradeoff.save }}" — needs approval from {{ f.tradeoff.approvedBy || 'stakeholders' }}
                          </div>
                        </div>
                      </div>
                    </li>
                  </ul>
                </div>
              </div>

              <!-- Staged proposals — Part B generative -->
              <div v-if="parsedAnalysis?.partB && Object.keys(parsedAnalysis.partB).length > 0" class="mt-5">
                <div class="text-[11px] uppercase font-bold text-slate-600 tracking-wider mb-2">Generative proposals (Part B)</div>
                <div v-for="(tool, toolId) in parsedAnalysis.partB" :key="toolId" class="mb-4">
                  <div class="text-[11px] font-bold text-violet-800 mb-1">{{ toolId }}</div>
                  <!-- New R. entries -->
                  <ul v-if="(tool.proposedREntries ?? []).length > 0" class="space-y-1.5 mb-2">
                    <li
                      v-for="(p, i) in (tool.proposedREntries as REntryProposal[])"
                      :key="`R${i}`"
                      class="rounded-lg border-2 border-teal-200 bg-teal-50/50 px-3 py-2"
                    >
                      <div class="flex items-start gap-3">
                        <input
                          type="checkbox"
                          class="mt-1 w-4 h-4 accent-teal-600 cursor-pointer"
                          :checked="approvedKeys.has(proposalApprovalKey(toolId as string, 'R', i))"
                          @change="toggleApproval(proposalApprovalKey(toolId as string, 'R', i))"
                        />
                        <div class="flex-1 font-mono text-[11.5px] text-slate-900">
                          <b class="text-teal-800">NEW R. {{ p.id }}</b><br>
                          Scale: {{ p.scale }}<br>
                          Tolerable: {{ p.tolerable }} · Goal: {{ p.goal }}
                        </div>
                      </div>
                    </li>
                  </ul>
                  <!-- New S. entries -->
                  <ul v-if="(tool.proposedSEntries ?? []).length > 0" class="space-y-1.5 mb-2">
                    <li
                      v-for="(p, i) in (tool.proposedSEntries as SEntryProposal[])"
                      :key="`S${i}`"
                      class="rounded-lg border-2 border-orange-200 bg-orange-50/50 px-3 py-2"
                    >
                      <div class="flex items-start gap-3">
                        <input
                          type="checkbox"
                          class="mt-1 w-4 h-4 accent-orange-600 cursor-pointer"
                          :checked="approvedKeys.has(proposalApprovalKey(toolId as string, 'S', i))"
                          @change="toggleApproval(proposalApprovalKey(toolId as string, 'S', i))"
                        />
                        <div class="flex-1 font-mono text-[11.5px] text-slate-900">
                          <b class="text-orange-800">NEW S. {{ p.id }}</b><br>
                          {{ p.description }}<br>
                          Impact: {{ p.impact }}
                        </div>
                      </div>
                    </li>
                  </ul>
                  <!-- New C. entries -->
                  <ul v-if="(tool.proposedCEntries ?? []).length > 0" class="space-y-1.5 mb-2">
                    <li
                      v-for="(p, i) in (tool.proposedCEntries as CEntryProposal[])"
                      :key="`C${i}`"
                      class="rounded-lg border-2 border-red-200 bg-red-50/50 px-3 py-2"
                    >
                      <div class="flex items-start gap-3">
                        <input
                          type="checkbox"
                          class="mt-1 w-4 h-4 accent-red-600 cursor-pointer"
                          :checked="approvedKeys.has(proposalApprovalKey(toolId as string, 'C', i))"
                          @change="toggleApproval(proposalApprovalKey(toolId as string, 'C', i))"
                        />
                        <div class="flex-1 font-mono text-[11.5px] text-slate-900">
                          <b class="text-red-800">NEW C. {{ p.id }}</b><br>
                          {{ p.description }}<br>
                          <span v-if="p.scope" class="text-slate-700">Scope: {{ p.scope }}</span>
                        </div>
                      </div>
                    </li>
                  </ul>
                  <!-- Field edits (modify existing entries) -->
                  <ul v-if="(tool.proposedFieldEdits ?? []).length > 0" class="space-y-1.5">
                    <li
                      v-for="(p, i) in (tool.proposedFieldEdits ?? [])"
                      :key="`F${i}`"
                      class="rounded-lg border-2 border-violet-200 bg-violet-50/50 px-3 py-2"
                    >
                      <div class="flex items-start gap-3">
                        <input
                          type="checkbox"
                          class="mt-1 w-4 h-4 accent-violet-600 cursor-pointer"
                          :checked="approvedKeys.has(proposalApprovalKey(toolId as string, 'F', i))"
                          @change="toggleApproval(proposalApprovalKey(toolId as string, 'F', i))"
                        />
                        <div class="flex-1 font-mono text-[11.5px] text-slate-900">
                          <b class="text-violet-800">EDIT {{ p.entryId }}.{{ p.field }}</b><br>
                          <span class="text-slate-500 line-through" v-if="p.currentValue">{{ p.currentValue }}</span><br>
                          <span class="text-violet-900">→ {{ p.proposedValue }}</span>
                          <div v-if="p.gilbCite" class="text-violet-700 italic mt-1">{{ p.gilbCite }}</div>
                        </div>
                      </div>
                    </li>
                  </ul>
                </div>
              </div>

              <!-- Apply CTA -->
              <div v-if="parsedAnalysis && approvalCount > 0" class="mt-5 flex items-center gap-3">
                <button
                  type="button"
                  class="px-5 py-3 rounded-lg bg-emerald-600 text-white font-extrabold text-sm shadow
                         hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition"
                  @click="applyApproved()"
                >Apply {{ approvalCount }} Approved Finding{{ approvalCount === 1 ? '' : 's' }} → SpecBlock</button>
                <span class="text-[11px] text-slate-500 italic">
                  Writes to <code>spec.resources / solutions / constraints</code>; existing entries with same id are replaced (upsert).
                </span>
              </div>
            </div>
          </ScrollContainer>

          <!-- Footer -->
          <footer class="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <div class="text-[11px] text-slate-500 italic">
              Phase 2 shipped (r88) — paste Claudian JSON above, tick approvals, Apply writes to SpecBlock.  Phase 3 (Tradeoff Opportunities engine) is the next milestone.
            </div>
            <button
              type="button"
              class="px-4 py-2 rounded-lg bg-slate-700 text-white font-semibold text-sm hover:bg-slate-800
                     focus:outline-none focus:ring-2 focus:ring-slate-400"
              @click="emit('close')"
            >Done</button>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.resources-panel-enter-active { animation: resources-panel-in 220ms cubic-bezier(0.22, 1, 0.36, 1) both; }
.resources-panel-leave-active { animation: resources-panel-in 180ms cubic-bezier(0.7, 0, 0.84, 0) reverse both; }
@keyframes resources-panel-in {
  from { opacity: 0; transform: scale(0.98); }
  to   { opacity: 1; transform: scale(1); }
}
</style>
