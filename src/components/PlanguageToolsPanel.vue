<!-- UNIT_TYPE=Panel -->
<!--
/**
 * PlanguageToolsPanel — modal catalogue of Planguage design tools.
 *
 * Tom Gilb 2026-06-07: "It belongs to the more general class of Planguage Tools
 * (see Design Chapter in CE book). Sharpening is in that category because it
 * generates Designs."
 *
 * Four categories: Design · Sharpening · Analysis · Edit
 * Each tool fires 'tool-activated' with its emitEvent; App.vue dispatches.
 *
 * Rules complied with:
 *   - Single-Surface — App.vue registers planguageToolsOpen with
 *     registerExclusiveSurface so opening this closes other modals.
 *   - ScrollContainer — body wrapped in <ScrollContainer>.
 *   - CloseDot — at END of header flex row.
 *   - Planguage-Glyph-First (DD-011) — header uses <PlSolutionIcon>.
 *   - Interaction Disclosure — every tile button has a :title.
 *   - Banned-Scrum-Vocabulary — all tool names are Planguage-clean.
 *
 * Twin portability: tiles read from planguageTools.ts (pure data registry).
 */
-->
<script setup lang="ts">
import { computed, ref, type Component } from 'vue'
import ScrollContainer from './ScrollContainer.vue'
import CloseDot from './CloseDot.vue'
import PlSolutionIcon    from './icons/PlSolutionIcon.vue'
// ── Glyph components for tool tiles (DD-011: Glob-first, use existing) ────────
import OptimaGlyph       from './icons/OptimaGlyph.vue'
import MultiForksGlyph   from './icons/MultiForksGlyph.vue'
import MultiVisionGlyph  from './icons/MultiVisionGlyph.vue'
import PlValueIcon        from './icons/PlValueIcon.vue'
import PlResourceIcon     from './icons/PlResourceIcon.vue'
import PlConstraintIcon   from './icons/PlConstraintIcon.vue'
import EditGlyph          from './icons/EditGlyph.vue'
import GetGlyph           from './icons/GetGlyph.vue'
// ── New glyphs created for tools without existing components (2026-06-07) ─────
import PentaModelGlyph       from './icons/PentaModelGlyph.vue'
import SharpenKnifeGlyph     from './icons/SharpenKnifeGlyph.vue'
import KissGlyph             from './icons/KissGlyph.vue'
import AnalyzerGlyph         from './icons/AnalyzerGlyph.vue'
import ConflictGlyph         from './icons/ConflictGlyph.vue'
import InternetContextGlyph  from './icons/InternetContextGlyph.vue'
import PlanHealthGlyph       from './icons/PlanHealthGlyph.vue'
import {
  PLANGUAGE_TOOLS,
  PLANGUAGE_TOOL_CATEGORY_META,
  PLANGUAGE_TOOL_STATUS_META,
  PLANGUAGE_TOOL_CATEGORIES_IN_ORDER,
  getPlanguageToolsByCategory,
  type PlanguageTool,
  type PlanguageToolCategory,
} from '../data/planguageTools'

// ── Tool glyph map — tool.id → glyph component ───────────────────────────────
// Each tool gets a visual glyph at the top of its tile.
// Uses existing canonical glyph components where they fit; new ones otherwise.
// Tom Gilb 2026-06-07: "make a beautiful colorful set of glyphs atop each tool,
// either mirroring their display, or with a color artsy glyph."
const TOOL_GLYPHS: Record<string, Component> = {
  'penta':               PentaModelGlyph,       // 5-sector SVERD pinwheel with item dots (mirrors Penta display)
  'auto-dbo':            PlSolutionIcon,        // [*]→  — speculative design solutions
  'optima':              OptimaGlyph,           // threshold lines + dots (mirrors Optima display)
  'multi-vision':        MultiVisionGlyph,      // 3×3 matrix — Values×Solutions impact grid (mirrors display)
  'multi-forks':         MultiForksGlyph,       // Resources→System→Values fork (mirrors display)
  'sharpen':             SharpenKnifeGlyph,     // 🔪 knife — ratified sharpening symbol
  'kiss':                KissGlyph,             // asterisk + 4 radiating arrows (surprise improvement)
  'resources-sharpen':   PlResourceIcon,        // Resource icon — resources being sharpened
  'standards-auditor':   PlConstraintIcon,      // Constraint icon — checking against standards/rules
  'planguage-analyzer':  AnalyzerGlyph,         // 4 arrows converging — 4 knowledge sources
  'conflicts':           ConflictGlyph,         // opposing arrows + spark — tension detection
  'internet-context':    InternetContextGlyph,  // dashed world arc + inward arrow — external fetch
  'plan-health':         PlanHealthGlyph,       // semicircle gauge — PHI health score
  'spec-editor':         EditGlyph,             // [*]→[**] — transform spec contents
  'feed-me':             GetGlyph,              // [*]→* — pull parsed content into spec
}

defineEmits<{
  close: []
  'export-catalog': []
  'tool-activated': [{ id: string; emitEvent: string; payload?: Record<string, unknown> }]
}>()

// ── Filter ────────────────────────────────────────────────────────────────────

const filterText = ref('')

const filteredToolsByCategory = computed<Record<PlanguageToolCategory, PlanguageTool[]>>(() => {
  const q = filterText.value.trim().toLowerCase()
  const result = {} as Record<PlanguageToolCategory, PlanguageTool[]>
  for (const cat of PLANGUAGE_TOOL_CATEGORIES_IN_ORDER) {
    const tools = getPlanguageToolsByCategory(cat)
    result[cat] = q === ''
      ? tools
      : tools.filter(t =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          (t.gilbSource ?? '').toLowerCase().includes(q),
        )
  }
  return result
})

const noResults = computed<boolean>(() =>
  PLANGUAGE_TOOL_CATEGORIES_IN_ORDER.every(cat => filteredToolsByCategory.value[cat].length === 0),
)

// ── Stats ─────────────────────────────────────────────────────────────────────

const readyCount   = computed(() => PLANGUAGE_TOOLS.filter(t => t.status === 'ready').length)
const plannedCount = computed(() => PLANGUAGE_TOOLS.filter(t => t.status === 'planned').length)
</script>

<template>
  <!-- Backdrop -->
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[500] bg-slate-900/70 flex items-stretch justify-center p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="planguage-tools-title"
      @click.self="$emit('close')"
    >
      <!-- Modal -->
      <div class="w-full max-w-5xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col">

        <!-- Header -->
        <header class="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white">
          <PlSolutionIcon class="w-7 h-7 shrink-0" :no-detail-click="true" />
          <div class="flex-1 min-w-0">
            <h2 id="planguage-tools-title" class="text-base font-bold">Planguage Tools</h2>
            <p class="text-[11px] text-orange-100 mt-0.5">
              {{ readyCount }} ready · {{ plannedCount }} planned
              <span class="ml-2 opacity-70">· Pre-Evo-Step derivation · CE Design chapter</span>
            </p>
          </div>
          <!-- Filter -->
          <input
            v-model="filterText"
            type="search"
            placeholder="Filter tools…"
            class="text-sm text-slate-900 placeholder-slate-400 bg-white rounded-lg px-3 py-1.5 w-48 focus:outline-none focus:ring-2 focus:ring-white/50"
            aria-label="Filter Planguage Tools by name or description"
          />
          <!-- r41 v170 — Tom Gilb 2026-06-18 "close did not work" — Trace-Before-Patch:
               CloseDot emits `click`, not `close`.  The previous @close handler was
               silently swallowed.  Fixed by listening to the canonical @click. -->
          <button
            type="button"
            aria-label="Export Planguage Tools catalog"
            title="📤 Export — copy the 15-tool catalog to clipboard as HTML + auto-open Mail.app per SEM Email Body Standard (LOUD ⌘V cue)."
            class="h-9 flex items-center justify-center gap-1 px-2.5 rounded-lg
                   bg-white/15 text-white hover:bg-white/25 ring-1 ring-white/30
                   focus:outline-none focus:ring-2 focus:ring-white/50 transition-all"
            @click="$emit('export-catalog')"
          >
            <span class="text-sm leading-none" aria-hidden="true">📤</span>
            <span class="text-[11px] font-bold leading-none">Export</span>
          </button>
          <CloseDot size="lg" variant="on-dark" aria-label="Close Planguage Tools" @click="$emit('close')" />
        </header>

        <!-- Body -->
        <ScrollContainer class="flex-1 min-h-0" inner-class="p-5 space-y-6">

          <!-- Empty state -->
          <div v-if="noResults" class="text-center py-12 text-slate-500">
            <p class="text-sm">No tools match "{{ filterText }}".</p>
            <button
              type="button"
              class="mt-3 text-xs text-orange-600 hover:text-orange-800 underline"
              @click="filterText = ''"
            >Clear filter</button>
          </div>

          <!-- One section per category -->
          <section
            v-for="cat in PLANGUAGE_TOOL_CATEGORIES_IN_ORDER"
            :key="cat"
            v-show="filteredToolsByCategory[cat].length > 0"
          >
            <div class="flex items-baseline gap-3 mb-3 pb-2 border-b border-slate-200">
              <div
                class="w-1.5 h-5 rounded-full bg-gradient-to-b"
                :class="PLANGUAGE_TOOL_CATEGORY_META[cat].accent"
                aria-hidden="true"
              />
              <h3 class="text-sm font-bold text-slate-800">{{ PLANGUAGE_TOOL_CATEGORY_META[cat].label }}</h3>
              <p class="text-[11px] text-slate-500">{{ PLANGUAGE_TOOL_CATEGORY_META[cat].tagline }}</p>
            </div>

            <!-- Tile grid -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <button
                v-for="tool in filteredToolsByCategory[cat]"
                :key="tool.id"
                type="button"
                class="text-left rounded-xl border p-3 transition-all"
                :class="PLANGUAGE_TOOL_STATUS_META[tool.status].clickable
                  ? 'border-slate-200 bg-white hover:border-orange-300 hover:shadow-md hover:bg-orange-50/30 cursor-pointer'
                  : 'border-slate-100 bg-slate-50 cursor-not-allowed opacity-70'"
                :disabled="!PLANGUAGE_TOOL_STATUS_META[tool.status].clickable"
                :title="PLANGUAGE_TOOL_STATUS_META[tool.status].clickable
                  ? `${tool.name} — ${tool.description}. Click to open.`
                  : `${tool.name} — ${tool.description}. Status: ${PLANGUAGE_TOOL_STATUS_META[tool.status].label}.`"
                @click="PLANGUAGE_TOOL_STATUS_META[tool.status].clickable && tool.emitEvent
                  ? $emit('tool-activated', { id: tool.id, emitEvent: tool.emitEvent!, payload: tool.emitPayload })
                  : null"
              >
                <!-- Glyph — fills tile width (readability principle, Tom 2026-06-07).
                     width:100% fills the tile; height:auto preserves the square aspect ratio
                     from each SVG's viewBox="0 0 48 48" (CSS overrides SVG presentation attrs).
                     display:block eliminates the inline-element gap below the SVG.
                     preserveAspectRatio default (xMidYMid meet) centres non-square glyphs. -->
                <div
                  v-if="TOOL_GLYPHS[tool.id]"
                  class="w-full mb-3"
                  aria-hidden="true"
                >
                  <component
                    :is="TOOL_GLYPHS[tool.id]"
                    style="width: 100%; height: auto; display: block;"
                  />
                </div>

                <!-- Name + status badge -->
                <div class="flex items-start justify-between gap-2 mb-1.5">
                  <h4 class="text-sm font-semibold text-slate-800 leading-tight">{{ tool.name }}</h4>
                  <span
                    class="flex-shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border"
                    :class="PLANGUAGE_TOOL_STATUS_META[tool.status].badge"
                  >{{ PLANGUAGE_TOOL_STATUS_META[tool.status].label }}</span>
                </div>

                <!-- Description -->
                <p class="text-[11px] text-slate-600 leading-snug">{{ tool.description }}</p>

                <!-- Gilb source citation -->
                <p
                  v-if="tool.gilbSource"
                  class="text-[9px] text-orange-500 mt-1.5 leading-snug italic"
                  :title="`CE source: ${tool.gilbSource}`"
                >📖 {{ tool.gilbSource }}</p>

                <!-- File source -->
                <p
                  v-else-if="tool.source"
                  class="text-[9px] text-slate-400 mt-1.5 font-mono truncate"
                  :title="tool.source"
                >{{ tool.source }}</p>
              </button>
            </div>
          </section>

        </ScrollContainer>

        <!-- Footer -->
        <footer class="flex items-center justify-between gap-4 border-t border-slate-200 bg-slate-50 px-5 py-2.5">
          <p class="text-[10px] text-slate-400 italic">
            Planguage Tools operate on the spec before Evo Steps are derived.
            Authority: CE Design chapter, Tom Gilb.
          </p>
          <p class="text-[10px] font-mono text-slate-400">
            {{ readyCount }} / {{ PLANGUAGE_TOOLS.length }} tools ready
          </p>
        </footer>

      </div>
    </div>
  </Teleport>
</template>
