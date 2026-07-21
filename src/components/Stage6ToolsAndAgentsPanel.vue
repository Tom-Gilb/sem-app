<!-- UNIT_TYPE=Panel -->
<!--
 * Stage6ToolsAndAgentsPanel.vue — Stage 6 sub-step 6.4 "Tools and Agents"
 *
 * Tom Gilb 2026-06-23 (autonomous backlog batch).  Source of truth in
 * /Users/Tomgilbs/Developer/sem-app/src/data/stage6SubSteps.ts:
 *   "Same per-sub-phase toolbox pattern as Stage 4.4 — filtered Tools + Agents
 *    appropriate to Evo Step planning."
 *
 * Filtered palette: only the surfaces a planner uses during Evo Step planning.
 * Tools — Penta, Value Flow, MultiVision, Impact Estimation, OPTIMA.
 * Agents — Evo Critiquer, Evo Sharp, Munger, Maria.
 *
 * Tile click emits one of the canonical 'invoke-*' events.  App.vue maps each
 * to the existing canonical surface (no parallel surfaces invented — composes
 * with Trace-Before-Patch SUPREME).
 *
 * Composes with: rule_stage_6_evo_steps_design.md (Phase 1 build) ·
 * Stage4ToolsAndAgentsTable pattern (v252) · MOVE Principle · DD-009 Zero-
 * Training UI · DD-014 Top-and-Bottom Navigation Mirror · DD-017 R-G colorblind
 * safe · No-Silent-Removal (no surface invented; every tile reaches an existing
 * canonical surface) · CloseDot rule · Spell-out-Type-Names.
 -->
<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'
import CloseDot from './CloseDot.vue'

export type Stage6ToolKey =
  | 'penta'
  | 'multivision'
  | 'value-flow'
  | 'iet'
  | 'optima'
  | 'evo-critiquer'
  | 'evo-sharp'
  | 'munger'
  | 'maria'

interface Tile {
  key:    Stage6ToolKey
  label:  string
  hint:   string
  glyph:  string
  family: 'tool' | 'agent'
  color:  'violet' | 'amber' | 'rose' | 'sky' | 'emerald'
}

const TILES: readonly Tile[] = [
  // Tools
  { key: 'penta',         label: 'Penta',           hint: 'Open the Penta editor — sharpen Solutions feeding each Evo Step',                              glyph: '⬠', family: 'tool',  color: 'violet'  },
  { key: 'multivision',   label: 'MultiVision',     hint: 'Open MultiVision — visualise the Plan model and Evo Step impact rollups',                     glyph: '👁', family: 'tool',  color: 'sky'     },
  { key: 'value-flow',    label: 'Value Flow',      hint: 'Open Value Flow diagram — see how each Evo Step delivers Value across the lifecycle',         glyph: '🌊', family: 'tool',  color: 'sky'     },
  { key: 'iet',           label: 'Impact Estimation', hint: 'Open Impact Estimation Table — review per-step Value × Cost estimates from Stage 4',         glyph: '📊', family: 'tool',  color: 'amber'   },
  { key: 'optima',        label: 'OPTIMA',          hint: 'Open OPTIMA — analyse Resource fit per Evo Step',                                              glyph: '⚖', family: 'tool',  color: 'amber'   },
  // Agents
  { key: 'evo-critiquer', label: 'Evo Critiquer',   hint: 'Invoke the Evo Critiquer agent — adversarial review of the current Evo Plan',                  glyph: '🦅', family: 'agent', color: 'rose'    },
  { key: 'evo-sharp',     label: 'Evo Sharp',       hint: 'Invoke the Evo Sharp agent — sharpening interview for each Evo Step',                          glyph: '✂', family: 'agent', color: 'emerald' },
  { key: 'munger',        label: 'Munger',          hint: 'Invoke the Munger agent — mental-models lens on the Evo Plan',                                 glyph: '🧠', family: 'agent', color: 'emerald' },
  { key: 'maria',         label: 'Maria',           hint: 'Invoke the Maria agent — governance review across the Evo Plan',                               glyph: '🛡', family: 'agent', color: 'emerald' },
] as const

defineProps<{
  specName?: string | null
}>()

const emit = defineEmits<{
  (e: 'invoke', key: Stage6ToolKey): void
  (e: 'close'): void
}>()

function tileClick(key: Stage6ToolKey): void {
  emit('invoke', key)
  // Close ourselves — the user is navigating to the tool/agent surface
  emit('close')
}

function handleClose(): void {
  emit('close')
}

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') { handleClose() }
}

onMounted(() => { window.addEventListener('keydown', onKey) })
onBeforeUnmount(() => { window.removeEventListener('keydown', onKey) })

function tileClasses(t: Tile): string {
  const base = 'group rounded-xl border-2 px-4 py-3 text-left transition-all hover:shadow-md cursor-pointer'
  switch (t.color) {
    case 'violet':  return base + ' bg-violet-50  border-violet-200  hover:border-violet-400  hover:bg-violet-100'
    case 'amber':   return base + ' bg-amber-50   border-amber-200   hover:border-amber-400   hover:bg-amber-100'
    case 'rose':    return base + ' bg-rose-50    border-rose-200    hover:border-rose-400    hover:bg-rose-100'
    case 'sky':     return base + ' bg-sky-50     border-sky-200     hover:border-sky-400     hover:bg-sky-100'
    case 'emerald': return base + ' bg-emerald-50 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-100'
  }
}

function labelColor(t: Tile): string {
  switch (t.color) {
    case 'violet':  return 'text-violet-800'
    case 'amber':   return 'text-amber-800'
    case 'rose':    return 'text-rose-800'
    case 'sky':     return 'text-sky-800'
    case 'emerald': return 'text-emerald-800'
  }
}

const toolTiles  = TILES.filter((t) => t.family === 'tool')
const agentTiles = TILES.filter((t) => t.family === 'agent')
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[640] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Stage 6.4 — Tools and Agents for Evo Step planning"
      @click.self="handleClose"
    >
      <div class="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border-2 border-indigo-300 overflow-hidden flex flex-col" style="max-height: 88vh">
        <!-- Header -->
        <header class="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-indigo-700 to-violet-700 text-white">
          <span aria-hidden="true" class="text-base">🧰</span>
          <div class="flex-1 min-w-0">
            <h2 class="text-sm font-bold tracking-wide">6.4 Tools and Agents · Evo-relevant palette</h2>
            <p v-if="specName" class="text-[10px] text-indigo-100 truncate">Spec: {{ specName }} · click a tile to open its canonical surface</p>
          </div>
          <CloseDot variant="on-dark" size="lg" title="Close · Return without choosing" aria-label="Close panel" @click="handleClose" />
        </header>

        <!-- Body -->
        <div class="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-5">
          <!-- Tools -->
          <section>
            <h3 class="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Tools</h3>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <button
                v-for="t in toolTiles"
                :key="t.key"
                type="button"
                :class="tileClasses(t)"
                :title="t.hint"
                @click="tileClick(t.key)"
              >
                <div class="flex items-center gap-2 mb-1">
                  <span aria-hidden="true" class="text-base">{{ t.glyph }}</span>
                  <span :class="['text-xs font-bold', labelColor(t)]">{{ t.label }}</span>
                </div>
                <p class="text-[10px] text-slate-600 leading-snug">{{ t.hint }}</p>
              </button>
            </div>
          </section>

          <!-- Agents -->
          <section>
            <h3 class="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Agents</h3>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <button
                v-for="a in agentTiles"
                :key="a.key"
                type="button"
                :class="tileClasses(a)"
                :title="a.hint"
                @click="tileClick(a.key)"
              >
                <div class="flex items-center gap-2 mb-1">
                  <span aria-hidden="true" class="text-base">{{ a.glyph }}</span>
                  <span :class="['text-xs font-bold', labelColor(a)]">{{ a.label }}</span>
                </div>
                <p class="text-[10px] text-slate-600 leading-snug">{{ a.hint }}</p>
              </button>
            </div>
          </section>

          <p class="text-[10px] text-slate-500 italic leading-relaxed">
            Per-sub-phase toolbox pattern (same as Stage 4.4).  Every tile routes to its
            canonical existing surface — nothing is invented here.  Use any number of
            times, any number of cycles.
          </p>
        </div>

        <!-- Footer (BOTTOM mirror per DD-014) -->
        <footer class="flex items-center justify-end gap-2 px-5 py-3 bg-slate-50 border-t border-slate-200">
          <button
            type="button"
            class="h-9 px-3 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-200 transition-colors"
            title="Close without picking a tool or agent"
            @click="handleClose"
          >Close</button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>
