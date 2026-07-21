<!-- UNIT_TYPE=View -->
<!--
  RefineSolutionsView.vue — Stage 5 · Refine Solutions

  Tom Gilb 2026-06-08 verbatim:
    "Refine Solutions Stage 5: this needs a major redesign of interface. It needs
     focus on SOLUTIONS (Designs), it needs a toolbox for analysis tools, editing
     tools, visualization tools, decision making tools. Include a rich set of
     tools including the newer ones (Penta, Vision Optima Kiss etc). Make it very
     clear that the purpose is to find better solutions (ie serving more values
     better, at less costs). We need to help focus by having an overall measure
     of Solution Efficiency (Values / Resources). Please make Stage 5 great again."

  Design:
    1. Mission banner — "Find better Solutions: more Value, less Resource"
    2. Solution Efficiency score (V/C mean across all solutions) — live metric
    3. Solutions quick-grid — compact S. entry cards with V/C badges
    4. Toolbox — 4 categories: Visualize · Analyse · Improve · Decide
    5. Bottom navigation mirror (DD-014: top + bottom nav)

  Rules complied with:
    • Planguage-Glyph-First (DD-011) — existing glyphs used; no inline SVG for new icons
    • No-Generic-Icon-Libraries (DD-012) — only SEM glyph family
    • Interaction Disclosure (DD-009) — every button has a title
    • Color-on-Background Contrast (DD-017) — canonical colours on white/light chips
    • Top-and-Bottom Navigation Mirror (DD-014) — Back + Forward at both ends
    • MOVE Principle — all tool options visible without scroll-hunt
    • Banned-Scrum-Vocabulary — no sprint/backlog/story
    • Claude-Code-as-AI-Layer — no in-app API calls; all computations are deterministic
-->

<script setup lang="ts">
import { computed, markRaw } from 'vue'
import type { Component } from 'vue'
import type { SpecBlock, SEntry } from '../types/spec'
import type { EvoStep } from '../types/evo-plan'
import type { SpecModel } from '../types/spec-model'

// Glyphs (DD-011 — Planguage-Glyph-First)
import MultiVisionGlyph  from './icons/MultiVisionGlyph.vue'
import MultiForksGlyph   from './icons/MultiForksGlyph.vue'
import PentaGlyph        from './icons/PentaGlyph.vue'
import PlValueIcon       from './icons/PlValueIcon.vue'
import KissGlyph         from './icons/KissGlyph.vue'
import OptimaGlyph       from './icons/OptimaGlyph.vue'
import AnalyzeValueGlyph from './icons/AnalyzeValueGlyph.vue'
import PlanHealthGlyph   from './icons/PlanHealthGlyph.vue'
import EditGlyph         from './icons/EditGlyph.vue'
import SharpenKnifeGlyph from './icons/SharpenKnifeGlyph.vue'
import PlResourceIcon    from './icons/PlResourceIcon.vue'
import ComparatorGlyph   from './icons/ComparatorGlyph.vue'
import PriorityTripleGlyph from './icons/PriorityTripleGlyph.vue'
import PlEvoStepIcon     from './icons/PlEvoStepIcon.vue'
import PlSolutionIcon    from './icons/PlSolutionIcon.vue'

// ─── Props & Emits ────────────────────────────────────────────────────────────

const props = defineProps<{
  spec:           SpecBlock | null
  vcRatios:       Record<string, number>
  specModel?:     SpecModel | null
  confirmedSteps?: EvoStep[]
}>()

const emit = defineEmits<{
  'open-visualise':        []
  'open-multi-forks':      []
  'open-penta':            []
  'open-value-flow':       []
  'open-kiss':             []
  'open-optima':           []
  'open-resources-sharpen':   []
  'open-solution-sharpen':    []    // Stage 5 dedicated Solution Sharpening (replaces generic open-sharpen)
  'open-editor':              [payload: { tab: string; entryId?: string }]
  'open-priority-info':    []
  'open-strategy-agent':   []    // Strategy Agent — Strategy Sharpening (Tom 2026-06-09)
  'go-to-impacts':         []
  'go-to-evo-plan':        []
  'go-back':               []
}>()

// ─── Solution Efficiency ──────────────────────────────────────────────────────

/** All V/C ratios supplied from the Impact Estimation stage. */
const ratioValues = computed(() => Object.values(props.vcRatios))

/** Mean V/C ratio across all solutions with data. null when no data yet. */
const solutionEfficiency = computed<number | null>(() => {
  const r = ratioValues.value
  if (r.length === 0) return null
  return r.reduce((s, v) => s + v, 0) / r.length
})

interface EfficiencyGrade {
  label:       string
  description: string
  textColor:   string
  bgClass:     string
  borderClass: string
}

const efficiencyGrade = computed<EfficiencyGrade | null>(() => {
  const e = solutionEfficiency.value
  if (e === null) return null
  if (e >= 2.0) return {
    label: 'Excellent', description: 'Solutions deliver far more Value than Resource cost',
    textColor: '#10b981', bgClass: 'bg-emerald-50', borderClass: 'border-emerald-300',
  }
  if (e >= 1.2) return {
    label: 'Good', description: 'Value exceeds Resource cost — on track',
    textColor: '#06b6d4', bgClass: 'bg-cyan-50', borderClass: 'border-cyan-300',
  }
  if (e >= 0.7) return {
    label: 'Acceptable', description: 'Borderline — some Solutions not covering their cost',
    textColor: '#f59e0b', bgClass: 'bg-amber-50', borderClass: 'border-amber-300',
  }
  return {
    label: 'Poor', description: 'Resource cost exceeds Value delivered — redesign needed',
    textColor: '#ef4444', bgClass: 'bg-red-50', borderClass: 'border-red-300',
  }
})

// ─── Solutions quick-grid ─────────────────────────────────────────────────────

const solutions = computed<SEntry[]>(() => props.spec?.solutions ?? [])

/** V/C ratio for a solution entry, or null. */
function solutionRatio(s: SEntry): number | null {
  return props.vcRatios[s.id] ?? null
}

function ratioBadgeClass(ratio: number): string {
  if (ratio >= 2.0) return 'bg-emerald-100 text-emerald-700 border-emerald-300'
  if (ratio >= 1.2) return 'bg-cyan-100 text-cyan-700 border-cyan-300'
  if (ratio >= 0.7) return 'bg-amber-100 text-amber-700 border-amber-300'
  return 'bg-red-100 text-red-700 border-red-300'
}

// ─── Toolbox definition ───────────────────────────────────────────────────────

interface ToolDef {
  id:       string
  name:     string
  tagline:  string
  glyph:    Component
  action:   () => void
  accentBg: string   // Tailwind bg class for the glyph well
  border:   string   // Tailwind border + hover border
  badge?:   string   // optional status badge text
}

interface ToolCategory {
  id:       string
  label:    string
  purpose:  string
  color:    string   // header text color
  bg:       string   // header bg class
  tools:    ToolDef[]
}

const toolCategories = computed<ToolCategory[]>(() => [
  {
    id:      'visualize',
    label:   'Visualize Solutions',
    purpose: 'See how Solutions map to Values and Resources in multiple live views',
    color:   'text-cyan-700',
    bg:      'bg-gradient-to-r from-cyan-50 to-teal-50 border-b border-cyan-200',
    tools: [
      {
        id: 'multivision', name: 'MultiVision',
        tagline: 'Values × Solutions matrix — see which Solutions serve which Values',
        glyph: markRaw(MultiVisionGlyph),
        action: () => emit('open-visualise'),
        accentBg: 'bg-indigo-50', border: 'border-indigo-200 hover:border-indigo-400',
      },
      {
        id: 'multiforks', name: 'MultiForks',
        tagline: 'Resources → Solutions → Values live diagram',
        glyph: markRaw(MultiForksGlyph),
        action: () => emit('open-multi-forks'),
        accentBg: 'bg-teal-50', border: 'border-teal-200 hover:border-teal-400',
      },
      {
        id: 'penta', name: 'Penta Model',
        tagline: 'SVERD sharpening: Stakeholders · Values · Efficiency · Resources · Design',
        glyph: markRaw(PentaGlyph),
        action: () => emit('open-penta'),
        accentBg: 'bg-violet-50', border: 'border-violet-200 hover:border-violet-400',
        badge: 'SVERD',
      },
      {
        id: 'valueflow', name: 'Value Flow',
        tagline: 'Trace how each Value originates from Solutions and Functions',
        glyph: markRaw(PlValueIcon),
        action: () => emit('open-value-flow'),
        accentBg: 'bg-green-50', border: 'border-green-200 hover:border-green-400',
      },
    ],
  },
  {
    id:      'analyse',
    label:   'Analyse Solutions',
    purpose: 'Measure efficiency — which Solutions deliver the most Value per Resource unit',
    color:   'text-violet-700',
    bg:      'bg-gradient-to-r from-violet-50 to-indigo-50 border-b border-violet-200',
    tools: [
      {
        id: 'kiss', name: 'KISS Analysis',
        tagline: '5 most cost-effective spec improvements for immediate Resource gains',
        glyph: markRaw(KissGlyph),
        action: () => emit('open-kiss'),
        accentBg: 'bg-violet-50', border: 'border-violet-200 hover:border-violet-400',
        badge: 'KISS',
      },
      {
        id: 'optima', name: 'OPTIMA',
        tagline: 'Multi-dimensional Value optimisation: balance Goals vs Resource limits',
        glyph: markRaw(OptimaGlyph),
        action: () => emit('open-optima'),
        accentBg: 'bg-amber-50', border: 'border-amber-200 hover:border-amber-400',
      },
      {
        id: 'impact', name: 'Impact Estimation',
        tagline: 'V/C ratio table: quantify the impact of each Solution on each Value',
        glyph: markRaw(AnalyzeValueGlyph),
        action: () => emit('go-to-impacts'),
        accentBg: 'bg-blue-50', border: 'border-blue-200 hover:border-blue-400',
      },
      {
        id: 'planhealth', name: 'Plan Health',
        tagline: 'PHI score: overall plan quality across 7 Planguage dimensions',
        glyph: markRaw(PlanHealthGlyph),
        action: () => emit('open-visualise'),
        accentBg: 'bg-rose-50', border: 'border-rose-200 hover:border-rose-400',
      },
    ],
  },
  {
    id:      'improve',
    label:   'Improve Solutions',
    purpose: 'Edit, sharpen and optimise — make each Solution serve more Values at lower cost',
    color:   'text-orange-700',
    bg:      'bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-200',
    tools: [
      {
        id: 'editsolutions', name: 'Edit Solutions',
        tagline: 'Add, modify or remove Solution entries — direct Planguage spec editing',
        glyph: markRaw(EditGlyph),
        action: () => emit('open-editor', { tab: 'solutions' }),
        accentBg: 'bg-orange-50', border: 'border-orange-200 hover:border-orange-400',
      },
      {
        id: 'sharpen', name: 'Solution Sharpening',
        tagline: '26-theme interview: find better Solutions, new Values, improved designs',
        glyph: markRaw(SharpenKnifeGlyph),
        action: () => emit('open-solution-sharpen'),
        accentBg: 'bg-yellow-50', border: 'border-yellow-200 hover:border-yellow-400',
        badge: '26 themes',
      },
      {
        id: 'resources', name: 'Resources Sharpen',
        tagline: 'Optimise Resource entries across 9 Gilb efficiency dimensions',
        glyph: markRaw(PlResourceIcon),
        action: () => emit('open-resources-sharpen'),
        accentBg: 'bg-amber-50', border: 'border-amber-200 hover:border-amber-400',
      },
      {
        id: 'strategy-sharpen', name: 'Strategy Sharpening',
        tagline: '10-dimension Gilb strategy audit: value traceability, goal coverage, dependency order & more',
        glyph: markRaw(AnalyzeValueGlyph),
        action: () => emit('open-strategy-agent'),
        accentBg: 'bg-orange-100', border: 'border-orange-300 hover:border-orange-500',
        badge: '10 dims',
      },
      {
        id: 'editspec', name: 'Full Spec Editor',
        tagline: 'Edit any spec entry type — Values, Functions, Constraints, Resources',
        glyph: markRaw(EditGlyph),
        action: () => emit('open-editor', { tab: 'values' }),
        accentBg: 'bg-slate-50', border: 'border-slate-200 hover:border-slate-400',
      },
    ],
  },
  {
    id:      'decide',
    label:   'Prioritise Solutions',
    purpose: 'Rank Solutions by Value-per-Resource — decide which to invest in before deriving Evo Steps',
    color:   'text-emerald-700',
    bg:      'bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-200',
    tools: [
      {
        id: 'priority', name: 'Priority Analysis',
        tagline: 'Rank Solutions by V/C ratio × stakeholder impact weight',
        glyph: markRaw(PriorityTripleGlyph),
        action: () => emit('open-priority-info'),
        accentBg: 'bg-emerald-50', border: 'border-emerald-200 hover:border-emerald-400',
      },
      {
        id: 'comparator', name: 'Comparator',
        tagline: 'Pair-wise Solution comparison: which serves more Values at lower cost?',
        glyph: markRaw(ComparatorGlyph),
        action: () => emit('open-editor', { tab: 'solutions' }),
        accentBg: 'bg-teal-50', border: 'border-teal-200 hover:border-teal-400',
      },
    ],
  },
])
</script>

<template>
  <div class="w-full max-w-5xl mx-auto pb-16">

    <!-- ── Mission Banner ──────────────────────────────────────────────────── -->
    <div class="rounded-2xl overflow-hidden shadow-lg mb-6
                bg-gradient-to-r from-indigo-700 via-violet-700 to-indigo-800
                border border-indigo-600/50">
      <div class="px-6 py-5 flex items-center justify-between gap-6 flex-wrap">

        <!-- Left: stage badge + mission text -->
        <div class="flex items-center gap-4">
          <div class="shrink-0 rounded-xl bg-white/10 border border-white/20 p-3">
            <PlSolutionIcon class="w-8 h-8 text-white" :no-detail-click="true" />
          </div>
          <div>
            <div class="flex items-center gap-2 mb-0.5">
              <span class="text-indigo-200 text-[11px] font-bold uppercase tracking-widest">Stage 5</span>
              <span class="text-white/30">·</span>
              <span class="text-white text-lg font-extrabold tracking-tight">Refine Solutions</span>
            </div>
            <p class="text-indigo-200 text-sm leading-snug max-w-lg">
              Find better Solutions: serve more Values at less Resource cost.
              Each Solution (Design) must justify its Resource spend with measurable Value delivery.
            </p>
            <p class="text-indigo-300/70 text-[11px] mt-1 italic">
              Planguage: S. entry = a design decision. Better design = higher V/C ratio.
            </p>
          </div>
        </div>

        <!-- Right: Solution Efficiency gauge -->
        <div class="shrink-0">
          <div v-if="efficiencyGrade && solutionEfficiency !== null"
               class="rounded-xl border-2 px-5 py-3 text-center min-w-[140px]"
               :class="[efficiencyGrade.bgClass, efficiencyGrade.borderClass]">
            <div class="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">
              Solution Efficiency
            </div>
            <div class="text-3xl font-black leading-none mb-1"
                 :style="{ color: efficiencyGrade.textColor }">
              {{ solutionEfficiency.toFixed(2) }}×
            </div>
            <div class="text-xs font-bold" :style="{ color: efficiencyGrade.textColor }">
              {{ efficiencyGrade.label }}
            </div>
            <div class="text-[9px] text-slate-500 mt-1 leading-tight max-w-[130px]">
              {{ efficiencyGrade.description }}
            </div>
          </div>
          <!-- No data yet -->
          <div v-else
               class="rounded-xl border-2 border-slate-200 bg-white/80 px-5 py-3 text-center min-w-[140px]">
            <div class="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
              Solution Efficiency
            </div>
            <div class="text-slate-400 text-sm font-semibold mb-1">No data yet</div>
            <button
              class="text-[10px] text-violet-500 hover:text-violet-700 underline underline-offset-2"
              title="Go to Impact Estimation (Stage 7) to compute V/C ratios"
              @click="emit('go-to-impacts')"
            >Run Impact Estimation →</button>
          </div>
        </div>

      </div>

      <!-- Solutions count strip -->
      <div class="px-6 py-2 bg-black/20 flex items-center gap-4 flex-wrap border-t border-white/10">
        <span class="text-indigo-200 text-xs">
          <span class="font-bold text-white">{{ solutions.length }}</span>
          Solution entr{{ solutions.length !== 1 ? 'ies' : 'y' }} in spec
        </span>
        <span v-if="ratioValues.length > 0" class="text-indigo-200 text-xs">
          <span class="font-bold text-white">{{ ratioValues.length }}</span>
          with V/C ratio data
        </span>
        <button
          class="ml-auto text-indigo-300 text-xs hover:text-white transition-colors underline underline-offset-2"
          title="Open Spec Editor → Solutions tab to add or edit Solution entries"
          @click="emit('open-editor', { tab: 'solutions' })"
        >+ Edit Solutions</button>
      </div>
    </div>

    <!-- ── Solutions Quick-Grid ────────────────────────────────────────────── -->
    <div v-if="solutions.length > 0" class="mb-6">
      <h2 class="text-slate-600 text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
        <PlSolutionIcon class="w-4 h-4 text-orange-500" :no-detail-click="true" />
        Current Solutions
      </h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div
          v-for="s in solutions"
          :key="s.id"
          class="bg-white rounded-xl border border-orange-100 shadow-sm px-4 py-3
                 hover:border-orange-300 hover:shadow-md transition-all duration-150 cursor-pointer group"
          :title="`Open Solution ${s.id} in the Spec Editor`"
          @click="emit('open-editor', { tab: 'solutions', entryId: s.id })"
        >
          <div class="flex items-start justify-between gap-2 mb-1.5">
            <!-- Solution ID -->
            <span class="shrink-0 text-[11px] font-extrabold font-mono text-orange-600
                         bg-orange-50 border border-orange-200 rounded px-1.5 py-0.5">
              {{ s.id }}
            </span>
            <!-- V/C ratio badge -->
            <span
              v-if="solutionRatio(s) !== null"
              class="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border"
              :class="ratioBadgeClass(solutionRatio(s)!)"
              :title="`V/C ratio: ${solutionRatio(s)!.toFixed(2)} — Value delivered per Resource unit`"
            >
              V/C {{ solutionRatio(s)!.toFixed(1) }}×
            </span>
            <span v-else class="text-[10px] text-slate-300 italic">no V/C data</span>
          </div>
          <!-- Description -->
          <p class="text-slate-700 text-xs leading-snug line-clamp-2 group-hover:text-slate-900">
            {{ s.description || '(no description)' }}
          </p>
          <!-- Linked values count -->
          <div v-if="s.linkedValues && s.linkedValues.length > 0"
               class="mt-2 text-[10px] text-slate-400">
            Serves {{ s.linkedValues.length }} Value{{ s.linkedValues.length !== 1 ? 's' : '' }}
          </div>
        </div>
      </div>
    </div>

    <!-- Empty-state: no solutions yet -->
    <div v-else
         class="mb-6 rounded-xl border-2 border-dashed border-orange-200 bg-orange-50/50 px-6 py-8 text-center">
      <PlSolutionIcon class="w-10 h-10 text-orange-300 mx-auto mb-3" :no-detail-click="true" />
      <p class="text-orange-700 font-semibold text-sm mb-1">No Solution entries yet</p>
      <p class="text-slate-500 text-xs mb-4">
        Add Solution entries to your Planguage spec — each Solution is a design decision
        that delivers Value within Resource constraints.
      </p>
      <button
        class="bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl
               shadow transition-all"
        title="Open Spec Editor → Solutions tab to add your first Solution entry"
        @click="emit('open-editor', { tab: 'solutions' })"
      >
        + Add First Solution
      </button>
    </div>

    <!-- ── Toolbox ─────────────────────────────────────────────────────────── -->
    <h2 class="text-slate-600 text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
      <span class="w-4 h-4 text-indigo-500 text-base leading-none">⚙</span>
      Solution Refinement Toolbox
    </h2>

    <div class="space-y-4">
      <div
        v-for="cat in toolCategories"
        :key="cat.id"
        class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
      >
        <!-- Category header -->
        <div class="px-5 py-3 flex items-center gap-3" :class="cat.bg">
          <div>
            <h3 class="font-bold text-sm leading-tight" :class="cat.color">{{ cat.label }}</h3>
            <p class="text-slate-500 text-[11px] mt-0.5 leading-snug">{{ cat.purpose }}</p>
          </div>
        </div>

        <!-- Tool cards grid -->
        <div class="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <button
            v-for="tool in cat.tools"
            :key="tool.id"
            type="button"
            class="relative flex flex-col items-center text-center rounded-xl border-2 px-3 py-4 gap-2
                   bg-white transition-all duration-150
                   hover:shadow-md hover:-translate-y-0.5 active:scale-[0.97]
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            :class="tool.border"
            :title="`${tool.name} — ${tool.tagline}`"
            @click="tool.action()"
          >
            <!-- Status badge (top-right) -->
            <span
              v-if="tool.badge"
              class="absolute top-1.5 right-1.5 text-[8px] font-extrabold uppercase tracking-wide
                     bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full border border-slate-200"
            >{{ tool.badge }}</span>

            <!-- Glyph well -->
            <div class="rounded-lg p-2.5 mb-0.5" :class="tool.accentBg">
              <component :is="tool.glyph" class="w-9 h-9" :no-detail-click="true" />
            </div>

            <!-- Name + tagline -->
            <span class="text-slate-800 text-[12px] font-bold leading-tight">{{ tool.name }}</span>
            <span class="text-slate-400 text-[9px] leading-tight">{{ tool.tagline }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ── Bottom Navigation Mirror (DD-014 — Top + Bottom rule) ─────────── -->
    <div class="mt-10 pt-5 border-t border-slate-200 flex items-center justify-between gap-4 flex-wrap">

      <!-- Back to Impacts -->
      <button
        type="button"
        class="flex items-center gap-2 px-5 py-3 rounded-2xl min-h-[48px]
               bg-white border-2 border-slate-300 text-slate-600 text-sm font-semibold
               hover:border-slate-400 hover:bg-slate-50 hover:shadow-sm
               focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400
               transition-all duration-150 active:scale-[0.98]"
        title="Return to Stage 4 · Impacts — review Impact Estimation Table and V/C ratios"
        @click="emit('go-back')"
      >
        <span class="text-lg leading-none">←</span>
        <div class="text-left">
          <div class="text-[10px] font-normal text-slate-400 uppercase tracking-wide">Return to Stage 4</div>
          <div class="font-bold leading-tight">Impacts</div>
        </div>
      </button>

      <!-- Centre: stage badge -->
      <div class="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-700 to-violet-700
                  text-white px-4 py-2 shadow-md">
        <PlSolutionIcon class="w-5 h-5 text-white/80" :no-detail-click="true" />
        <div>
          <div class="text-[9px] uppercase tracking-widest text-indigo-200 font-semibold">Stage Now</div>
          <div class="text-sm font-extrabold leading-tight">5 · Refine Solutions</div>
        </div>
      </div>

      <!-- Forward to Evo Steps -->
      <button
        type="button"
        class="flex items-center gap-2 px-5 py-3 rounded-2xl min-h-[48px]
               bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-bold
               shadow-md shadow-indigo-200/60
               hover:from-indigo-700 hover:to-violet-700 hover:shadow-lg
               focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400
               transition-all duration-150 active:scale-[0.98]"
        title="Proceed to Stage 6 · Evo Steps — derive your Evo delivery plan from prioritised Solutions"
        @click="emit('go-to-evo-plan')"
      >
        <div class="text-left">
          <div class="text-[10px] font-normal text-indigo-200 uppercase tracking-wide">Continue to Stage 6</div>
          <div class="font-bold leading-tight">Evo Steps →</div>
        </div>
        <PlEvoStepIcon class="w-5 h-5 text-white/80" :no-detail-click="true" />
      </button>

    </div>

  </div>
</template>
