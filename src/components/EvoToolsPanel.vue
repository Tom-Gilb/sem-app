<!-- UNIT_TYPE=Panel -->
<!--
/**
 * EvoToolsPanel — the modal that hosts the Evo Tools catalogue.
 *
 * Tom Gilb 2026-06-03: *"OK Evo Tools: I want to put down a marker, get
 * started on a set of special Evo Tools (sort of like actions, but very
 * specialised on Evo. We already have some starters we can import like the
 * Value Flow and the Evo Video, please help me assemble the team behind a
 * Evo Tools Button"*
 *
 * Design pattern: Actions hub for Evo. Reads from `data/evoTools.ts` (pure
 * data registry) and renders one section per category, one tile per tool.
 * Only 'ready' tiles are clickable; 'wip' / 'planned' show a status badge
 * and are not interactive in v1.
 *
 * Rules complied with:
 *   - Single-Surface — caller (App.vue) registers `evoToolsOpen` with
 *     registerExclusiveSurface so opening this closes other modals.
 *   - ScrollContainer — body wrapped in <ScrollContainer>.
 *   - CloseDot — header uses <CloseDot> at the END (right) of the flex header.
 *   - Planguage-Glyph-First — header uses <PlEvoStepIcon>, no inline SVG.
 *   - Interaction Disclosure — every tile button has a :title.
 *   - Banned-Scrum-Vocabulary — every tool label is Planguage-clean.
 *
 * Events: emits `close` and `tool-activated` (with the tool's emitEvent
 * + emitPayload). App.vue listens to `tool-activated` and dispatches.
 *
 * Twin portability: tiles read from a pure-data registry. Tile UX (grid +
 * tile + badge + click) is replaceable; the data contract stays stable.
 */
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import ScrollContainer from './ScrollContainer.vue'
import CloseDot from './CloseDot.vue'
import PlEvoStepIcon from './icons/PlEvoStepIcon.vue'
import {
  EVO_TOOLS,
  EVO_TOOL_CATEGORY_META,
  EVO_TOOL_STATUS_META,
  EVO_TOOL_CATEGORIES_IN_ORDER,
  getEvoToolsByCategory,
  type EvoTool,
  type EvoToolCategory,
} from '../data/evoTools'

defineEmits<{
  close: []
  'tool-activated': [{ id: string; emitEvent: string; payload?: Record<string, unknown> }]
}>()

// ── Filter state ─────────────────────────────────────────────────────────────
// Simple text filter — searches tool name + description. Empty string → show all.
const filterText = ref('')

const filteredToolsByCategory = computed<Record<EvoToolCategory, EvoTool[]>>(() => {
  const q = filterText.value.trim().toLowerCase()
  const result = {} as Record<EvoToolCategory, EvoTool[]>
  for (const cat of EVO_TOOL_CATEGORIES_IN_ORDER) {
    const tools = getEvoToolsByCategory(cat)
    result[cat] = q === ''
      ? tools
      : tools.filter(t =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q),
        )
  }
  return result
})

/** True when the filter matches zero tools across all categories. */
const noResults = computed<boolean>(() =>
  EVO_TOOL_CATEGORIES_IN_ORDER.every(cat => filteredToolsByCategory.value[cat].length === 0),
)

// ── Stats footer ─────────────────────────────────────────────────────────────
const readyCount = computed<number>(() => EVO_TOOLS.filter(t => t.status === 'ready').length)
const wipCount   = computed<number>(() => EVO_TOOLS.filter(t => t.status === 'wip').length)
const plannedCount = computed<number>(() => EVO_TOOLS.filter(t => t.status === 'planned').length)
</script>

<template>
  <!-- Backdrop -->
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[500] bg-slate-900/70 flex items-stretch justify-center p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="evo-tools-title"
      @click.self="$emit('close')"
    >
      <!-- Modal -->
      <div class="w-full max-w-5xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col">

        <!-- Header — Planguage-Glyph-First (PlEvoStepIcon, no inline SVG) + CloseDot at end -->
        <header class="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white">
          <PlEvoStepIcon size="md" :no-detail-click="true" />
          <div class="flex-1 min-w-0">
            <h2 id="evo-tools-title" class="text-base font-bold">Evo Tools</h2>
            <p class="text-[11px] text-indigo-100 mt-0.5">
              {{ readyCount }} ready · {{ wipCount }} reachable via EvoPlanView · {{ plannedCount }} planned
            </p>
          </div>
          <!-- Filter input -->
          <input
            v-model="filterText"
            type="search"
            placeholder="Filter tools…"
            class="text-sm text-slate-900 placeholder-slate-400 bg-white rounded-lg px-3 py-1.5 w-48 focus:outline-none focus:ring-2 focus:ring-white/50"
            aria-label="Filter Evo Tools by name or description"
          />
          <CloseDot @click="$emit('close')" />
        </header>

        <!-- Body — ScrollContainer wraps the category sections -->
        <ScrollContainer class="flex-1" inner-class="p-5 space-y-6">

          <!-- Empty-state -->
          <div v-if="noResults" class="text-center py-12 text-slate-500">
            <p class="text-sm">No tools match "{{ filterText }}".</p>
            <button
              type="button"
              class="mt-3 text-xs text-indigo-600 hover:text-indigo-800 underline"
              @click="filterText = ''"
            >Clear filter</button>
          </div>

          <!-- One section per category -->
          <section
            v-for="cat in EVO_TOOL_CATEGORIES_IN_ORDER"
            :key="cat"
            v-show="filteredToolsByCategory[cat].length > 0"
          >
            <div
              class="flex items-baseline gap-3 mb-3 pb-2 border-b border-slate-200"
            >
              <div
                class="w-1.5 h-5 rounded-full bg-gradient-to-b"
                :class="EVO_TOOL_CATEGORY_META[cat].accent"
                aria-hidden="true"
              />
              <h3 class="text-sm font-bold text-slate-800">{{ EVO_TOOL_CATEGORY_META[cat].label }}</h3>
              <p class="text-[11px] text-slate-500">{{ EVO_TOOL_CATEGORY_META[cat].tagline }}</p>
            </div>

            <!-- Tile grid — responsive 2/3 cols -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <button
                v-for="tool in filteredToolsByCategory[cat]"
                :key="tool.id"
                type="button"
                class="text-left rounded-xl border p-3 transition-all"
                :class="EVO_TOOL_STATUS_META[tool.status].clickable
                  ? 'border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md hover:bg-indigo-50/30 cursor-pointer'
                  : 'border-slate-100 bg-slate-50 cursor-not-allowed opacity-70'"
                :disabled="!EVO_TOOL_STATUS_META[tool.status].clickable"
                :title="EVO_TOOL_STATUS_META[tool.status].clickable
                  ? `${tool.name} — ${tool.description}. Click to open.`
                  : `${tool.name} — ${tool.description}. Status: ${EVO_TOOL_STATUS_META[tool.status].label}.`"
                @click="EVO_TOOL_STATUS_META[tool.status].clickable && tool.emitEvent
                  ? $emit('tool-activated', { id: tool.id, emitEvent: tool.emitEvent, payload: tool.emitPayload })
                  : null"
              >
                <div class="flex items-start justify-between gap-2 mb-1.5">
                  <h4 class="text-sm font-semibold text-slate-800 leading-tight">{{ tool.name }}</h4>
                  <span
                    class="flex-shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border"
                    :class="EVO_TOOL_STATUS_META[tool.status].badge"
                  >{{ EVO_TOOL_STATUS_META[tool.status].label }}</span>
                </div>
                <p class="text-[11px] text-slate-600 leading-snug">{{ tool.description }}</p>
                <p
                  v-if="tool.source"
                  class="text-[9px] text-slate-400 mt-1.5 font-mono truncate"
                  :title="tool.source"
                >{{ tool.source }}</p>
              </button>
            </div>
          </section>

        </ScrollContainer>

        <!-- Footer — explains the status badges and provides a "Read the marker" link -->
        <footer class="px-5 py-2.5 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-600 flex items-center justify-between flex-wrap gap-2">
          <p>
            <span class="font-semibold text-emerald-700">Ready</span> = click to open ·
            <span class="font-semibold text-amber-700">In EvoPlanView</span> = reachable via per-step menu (will be promoted) ·
            <span class="font-semibold text-slate-500">Planned</span> = roadmap
          </p>
          <p class="text-slate-400">Tom 2026-06-03 — Evo Tools marker. v1 scaffold.</p>
        </footer>

      </div>
    </div>
  </Teleport>
</template>
