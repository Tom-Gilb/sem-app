<!-- ActionsHubPanel.vue — Wide centered modal action hub (11 sections × 4-column grid).
     Opens from the ⚡ Actions button (menuOpen ref in App.vue).

     Layout: centered modal, min(1200px, 92vw), anchored 155px from top.
     4-column section grid. 2-column tile grid inside each section card.
     Filter bar searches tile labels + tips live. Fresh Start red pill in header.

     Thumbnail Reality Rule: T1 LIVE (semMeta) · T2 GLYPH (saveGlyph/priority/edit)
     · T3 REAL plan data. No hand-drawn cartoons.

     Single-Surface: registered as 'actionsHub' via registerExclusiveSurface in App.vue.
     Emits: action(id: string), close.

     Props:
       hasPlan            — any planModel loaded
       hasSpec            — currentSpec exists
       hasConfirmedSteps  — confirmedSteps.length > 0
       hasMultipleModels  — _allPlanModels.length > 0
       hasSpecHistory     — specHistory.length > 0
       hasDashboardEntries— dashboardEntries.length > 0
       dictationActive    — mic currently on
       speaking           — TTS currently active
       startOverPending   — second-click confirm state
-->

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import CloseDot         from './CloseDot.vue'
import ScrollContainer  from './ScrollContainer.vue'
import ActionTileThumb  from './ActionTileThumb.vue'
import type { ThumbType } from './ActionTileThumb.vue'

const props = withDefaults(defineProps<{
  hasPlan:             boolean
  hasSpec:             boolean
  hasConfirmedSteps:   boolean
  hasMultipleModels:   boolean
  hasSpecHistory:      boolean
  hasDashboardEntries: boolean
  dictationActive:     boolean
  speaking:            boolean
  startOverPending:    boolean
}>(), {
  hasPlan: false, hasSpec: false, hasConfirmedSteps: false,
  hasMultipleModels: false, hasSpecHistory: false, hasDashboardEntries: false,
  dictationActive: false, speaking: false, startOverPending: false,
})

const emit = defineEmits<{
  action: [id: string]
  close:  []
}>()

// ── Keyboard: Escape closes ───────────────────────────────────────────────────

function _onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') emit('close')
}
onMounted(()   => window.addEventListener('keydown', _onKey))
onUnmounted(() => window.removeEventListener('keydown', _onKey))

// ── Filter ────────────────────────────────────────────────────────────────────

const filterText = ref('')

// ── Data types ────────────────────────────────────────────────────────────────

interface Tile {
  id:          string
  label:       string
  emoji:       string
  thumb:       ThumbType
  tip:         string
  disabled?:   boolean
  /** Shown instead of tip when the tile is disabled — explains WHY and how to unlock. DD-009. */
  disabledTip?: string
}

interface SectionDef {
  key:   string
  label: string
  blurb: string
  emoji: string
  tiles: Tile[]
}

// ── Section + tile catalogue ──────────────────────────────────────────────────

const allSections = computed<SectionDef[]>(() => [

  // ── 1. QUALITY ─────────────────────────────────────────────────────────────
  {
    key: 'quality', label: 'QUALITY', emoji: '🩺',
    blurb: 'Monitor spec health, integrity scores and stakeholder tensions.',
    tiles: [
      { id: 'planHealthStatus', label: 'Plan Health Status', emoji: '🩺', thumb: 'planHealthStatus', tip: 'PHI score, history graph and quality notifications',    disabled: !props.hasSpec },
      { id: 'planHealthAdmin',  label: 'Plan Health Admin',  emoji: '⚙️', thumb: 'planHealthAdmin',  tip: 'Aspects, weights and AI expert quality reviews',        disabled: !props.hasSpec },
      { id: 'conflicts',        label: 'Conflicts Detector', emoji: '⚠',  thumb: 'conflicts',        tip: 'Detect hidden stakeholder tensions in the spec',        disabled: !props.hasSpec },
    ],
  },

  // ── 2. ANALYZE ─────────────────────────────────────────────────────────────
  {
    key: 'analyze', label: 'ANALYZE', emoji: '📊',
    blurb: 'Rank priorities against values and constraints. Set delivery targets. Review Evo plan health.',
    tiles: [
      { id: 'planTargets',      label: 'Spec Targets',    emoji: '🎯', thumb: 'planTargets',   tip: 'Set delivery targets and milestones' },
      { id: 'globalPriority',   label: 'Global Priority', emoji: '🏆', thumb: 'priorityGlyph', tip: 'Full plan priority ranking: [A>B>C] across all entries', disabled: !props.hasSpec },
      {
        id: 'evo-step-critique', label: 'Evo Critiquer',  emoji: '🔬', thumb: 'emoji',
        tip: 'AI reviews plan against all 9 Evo cycle steps — scores 10 health dimensions, critiques each step, deep-dives Value Delivery cycle',
        disabled: !props.hasConfirmedSteps,
        disabledTip: 'No confirmed Evo Steps yet. Go to Stage 6 (Evo Steps) and confirm at least one delivery step to unlock Evo Critiquer.',
      },
    ],
  },

  // ── 3. EXPLORE ─────────────────────────────────────────────────────────────
  {
    key: 'explore', label: 'EXPLORE', emoji: '🔭',
    blurb: 'Animate cumulative value delivery and step-by-step Evo sequences.',
    tiles: [
      { id: 'evoSim',  label: 'Evo Value Animation',  emoji: '📈', thumb: 'evoSim',  tip: 'Animate value accumulation across all Evo steps', disabled: !props.hasConfirmedSteps, disabledTip: 'No Evo Steps yet. Go to Stage 6 (Evo Steps) and confirm at least one delivery step to unlock this.' },
      { id: 'replay',  label: 'Evo Step Sequence',    emoji: '🔁', thumb: 'replay',  tip: 'Step-by-step replay of Evo delivery sequence',   disabled: !props.hasConfirmedSteps, disabledTip: 'No Evo Steps yet. Go to Stage 6 (Evo Steps) and confirm at least one delivery step to unlock this.' },
    ],
  },

  // ── 4. VISUALIZE ───────────────────────────────────────────────────────────
  {
    key: 'visualize', label: 'VISUALIZE', emoji: '🗺️',
    blurb: 'Diagrams, system models, heat maps and full-screen presentation.',
    tiles: [
      { id: 'visualise',    label: 'Diagrams & Visuals', emoji: '🗺️', thumb: 'diagrams',     tip: 'Browse all plan diagrams and visual analyses',    disabled: !props.hasSpec },
      { id: 'heatLane',     label: 'Value Stage Map',    emoji: '🌡️', thumb: 'heatLane',     tip: 'Swimlane heatmap of value delivery by stage',    disabled: !props.hasSpec },
      { id: 'systemModel',  label: 'System Model',       emoji: '🕸️', thumb: 'systemModel',  tip: 'System model dashboard view',                     disabled: !props.hasDashboardEntries },
      { id: 'present',      label: 'Present',            emoji: '🖥️', thumb: 'present',      tip: 'Present this plan in full-screen mode',           disabled: !props.hasSpec },
      { id: 'modelHistory', label: 'Model History',      emoji: '🗂️', thumb: 'modelHistory', tip: 'Browse all saved plan model versions' },
    ],
  },

  // ── 5. EDIT ────────────────────────────────────────────────────────────────
  {
    key: 'edit', label: 'EDIT', emoji: '✏️',
    blurb: 'Refine the specification with the spec editor and AI assistance.',
    tiles: [
      { id: 'specEditor', label: 'Spec Editor',          emoji: '📝', thumb: 'specEditor', tip: 'Direct spec editing mode — edit any entry manually',   disabled: !props.hasSpec },
      { id: 'sharpen',    label: 'Sharpen Plan',         emoji: '🔪', thumb: 'sharpen',    tip: 'AI sharpening cycles to improve spec precision',       disabled: !props.hasSpec },
      { id: 'improve',    label: 'Improve This Version', emoji: '✨', thumb: 'improve',    tip: 'Generate an AI-improved version of the current spec', disabled: !props.hasSpec },
    ],
  },

  // ── 6. NAVIGATE ────────────────────────────────────────────────────────────
  {
    key: 'navigate', label: 'NAVIGATE', emoji: '🧭',
    blurb: 'Move between plan versions, spec snapshots and saved models.',
    tiles: [
      { id: 'resumeLast',   label: 'Resume Last',       emoji: '▶',  thumb: 'resumeLast',   tip: 'Reopen the most recently used plan model',             disabled: !props.hasMultipleModels },
      { id: 'previousPlan', label: 'Previous Plan',     emoji: '📋', thumb: 'previousPlan', tip: 'Load an earlier plan model as a starting point',       disabled: !props.hasMultipleModels },
      { id: 'planHistory',  label: 'Spec History',      emoji: '🕐', thumb: 'planHistory',  tip: 'Version history of the current spec' },
      { id: 'specHistory',  label: 'Spec History',      emoji: '📖', thumb: 'specHistory',  tip: 'All snapshots across all spec evolution sessions' },
    ],
  },

  // ── 7. MANAGE ──────────────────────────────────────────────────────────────
  {
    key: 'manage', label: 'MANAGE', emoji: '⚙️',
    blurb: 'Rename the plan, save checkpoints and manage lifecycle resets.',
    tiles: [
      { id: 'renamePlan',     label: 'Rename Plan',     emoji: '✏',  thumb: 'renamePlan',     tip: 'Rename this plan and set its responsible owner', disabled: !props.hasPlan },
      { id: 'saveCheckpoint', label: 'Save Checkpoint', emoji: '💾', thumb: 'saveCheckpoint', tip: 'Save a manual named snapshot of the current spec', disabled: !props.hasSpec },
      {
        id: 'startOver',
        label: props.startOverPending ? '⚠ Confirm Restart?' : 'Restart Afresh',
        emoji: props.startOverPending ? '⚠' : '🔄',
        thumb: 'restart',
        tip: props.startOverPending ? 'Click again to confirm restart' : 'Discard current spec and start fresh',
      },
      { id: 'freshStart', label: 'Fresh Start', emoji: '🆘', thumb: 'freshStart', tip: '4-option graduated reset: blank canvas, save & stop, cancel changes, close stuck UI' },
    ],
  },

  // ── 8. PEOPLE ──────────────────────────────────────────────────────────────
  {
    key: 'people', label: 'PEOPLE', emoji: '👥',
    blurb: 'Assign roles, governance and accountability across the plan.',
    tiles: [
      { id: 'planOwners', label: 'Spec Owners', emoji: '🔑', thumb: 'planOwners', tip: 'Accountable stakeholders for this spec',         disabled: !props.hasPlan },
      { id: 'planners',   label: 'Planners',    emoji: '💡', thumb: 'planners',   tip: 'Planners who conceive the plan ideas',           disabled: !props.hasPlan },
      { id: 'scribes',    label: 'Scribes',     emoji: '⌨️', thumb: 'scribes',    tip: 'Scribes who do the keying (Mob Planning style)', disabled: !props.hasPlan },
      { id: 'specOwners', label: 'Spec Owners', emoji: '👥', thumb: 'specOwners', tip: 'Area-specific spec accountability & governance', disabled: !props.hasPlan },
    ],
  },

  // ── 9. VOICE ───────────────────────────────────────────────────────────────
  {
    key: 'voice', label: 'VOICE', emoji: '🎤',
    blurb: 'Speak ideas and commands directly into the spec.',
    tiles: [
      {
        id: 'dictation',
        label: props.dictationActive ? 'Stop Dictation' : 'Voice Dictation',
        emoji: props.dictationActive ? 'active' : 'idle',
        thumb: 'dictation',
        tip: props.dictationActive ? 'Click to stop voice input' : 'Start voice-to-spec dictation',
      },
    ],
  },

  // ── 10. BACKUP ─────────────────────────────────────────────────────────────
  {
    key: 'backup', label: 'BACKUP', emoji: '🛡',
    blurb: 'Export, import and protect all your plan data and source code.',
    tiles: [
      { id: 'savePlan',      label: 'Save Plan',       emoji: '⬇',  thumb: 'savePlan',     tip: 'Download the current spec as a JSON file',              disabled: !props.hasSpec },
      { id: 'emailPlan',     label: 'Email Plan',      emoji: '✉',  thumb: 'emailPlan',    tip: 'Send the current spec via email',                       disabled: !props.hasSpec },
      { id: 'restorePlans',  label: 'Restore Plans',   emoji: '↑',  thumb: 'restorePlans', tip: 'Import a previously saved JSON backup' },
      { id: 'backup',        label: 'Backup SEM App',  emoji: '🛡',  thumb: 'backup',       tip: 'Backup all plan models to a single JSON file',          disabled: !props.hasMultipleModels },
      { id: 'codeSnapshot',  label: 'Code Snapshot',   emoji: '💻', thumb: 'backup',       tip: 'Copy the Terminal command to ZIP the full source code to your Desktop' },
    ],
  },

  // ── 11. AGENTS ─────────────────────────────────────────────────────────────
  {
    key: 'agents', label: 'AGENTS', emoji: '🦾',
    blurb: 'AI planning agents — call on-demand for deep analysis, governance review, and board-level insight.',
    tiles: [
      {
        id:    'maria',
        label: 'Maria — Board Parse',
        emoji: '🏛',
        thumb: 'maria' as const,
        tip:   'Analyse board documents: classify decisions by governance layer, flag authority gaps, surface governance gaps, identify governance patterns',
      },
      {
        id: 'contracts', label: 'Contracts', emoji: '📋', thumb: 'emoji' as const,
        tip: 'Import any contract — SLA, NDA, service agreement — convert to Planguage clauses, F./V./C. entries, and party obligation matrix',
      },
      {
        id: 'models', label: 'Plan Models', emoji: '🗂️', thumb: 'emoji' as const,
        tip: 'Browse 18 built-in domain models across 6 categories — Organizational, Project, Product, National, International, Software',
      },
      {
        id: 'stakeholder-mapper', label: 'Stakeholder Mapper', emoji: '👥', thumb: 'emoji' as const,
        tip: 'AI drafts all 10 stakeholder attribute levels (Power, Interest, Influence, Support…) with source URLs for any named entity',
        disabled: !props.hasSpec,
        disabledTip: 'Load or create a spec first — the Stakeholder Mapper uses your plan entries as context for attribute profiling.',
      },
      {
        id: 'plan-importer', label: 'Plan Agent', emoji: '📄', thumb: 'emoji' as const,
        tip: 'Paste any text — brief, roadmap, strategy doc, rough notes — AI converts it to full Planguage F./V./C./R./S. entries',
      },
      {
        id: 'decisions', label: 'Decisions', emoji: '🎯', thumb: 'emoji' as const,
        tip: 'Build a scored decision matrix (options × Planguage criteria) and get a ranked recommendation with rationale',
        disabled: !props.hasSpec,
        disabledTip: 'Load or create a spec first — the Decisions agent uses your plan values and constraints as the scoring criteria.',
      },
    ],
  },

  // ── 12. ABOUT ──────────────────────────────────────────────────────────────
  {
    key: 'about', label: 'ABOUT', emoji: '📖',
    blurb: 'Plan metadata, app scoreboard, attribution and Planguage glyph essays.',
    tiles: [
      { id: 'toolInfo',      label: 'Plan Metadata',      emoji: 'ℹ',  thumb: 'toolInfo',      tip: 'Purposes, originator, tags, URLs for this plan', disabled: !props.hasPlan },
      { id: 'semMetadata',   label: 'SEM Metadata',       emoji: '🧬', thumb: 'semMeta',       tip: 'App build stats, component counts and session counters' },
      { id: 'copyright',     label: 'Copyright',          emoji: '©',  thumb: 'copyright',     tip: 'Open-source attributions and Tom Gilb copyright notices' },
      { id: 'saveGlyph',     label: 'The Save Glyph',     emoji: '💾', thumb: 'saveGlyph',     tip: 'Essay: why →[*] replaces the floppy disk icon' },
      { id: 'priorityGlyph', label: 'Priority Glyph',     emoji: '🏆', thumb: 'priorityGlyph', tip: 'Essay: why [A>B>C] beats points and effort scoring' },
      { id: 'editGlyph',     label: 'The Edit Glyph',     emoji: '✏', thumb: 'editGlyph',      tip: 'Essay: the [*]→[**] Planguage improvement notation' },
    ],
  },
])

// ── Filtered sections (live search) ──────────────────────────────────────────

const filteredSections = computed<SectionDef[]>(() => {
  const q = filterText.value.trim().toLowerCase()
  if (!q) return allSections.value
  return allSections.value
    .map(s => ({
      ...s,
      tiles: s.tiles.filter(t =>
        t.label.toLowerCase().includes(q) ||
        t.tip.toLowerCase().includes(q)   ||
        s.label.toLowerCase().includes(q)  ||
        s.blurb.toLowerCase().includes(q)
      ),
    }))
    .filter(s => s.tiles.length > 0)
})

// ── Tooltip hover ─────────────────────────────────────────────────────────────

const hoveredId = ref<string | null>(null)

// ── Tile click ────────────────────────────────────────────────────────────────

function handleTile(tile: Tile): void {
  if (tile.disabled) return
  emit('action', tile.id)
  // startOver needs a second click confirm — keep hub open for that
  if (tile.id !== 'startOver') emit('close')
}
</script>

<template>
  <Teleport to="body">

    <!-- ── Click-outside backdrop ─────────────────────────────────────────── -->
    <div
      class="fixed inset-0 z-[479] bg-black/50 backdrop-blur-sm"
      aria-hidden="true"
      @click="emit('close')"
    />

    <!-- ── Modal container ───────────────────────────────────────────────── -->
    <div
      class="fixed z-[480] left-1/2 -translate-x-1/2 flex flex-col
             bg-slate-50 rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
      style="top: 155px; width: min(1200px, 92vw); max-height: calc(100vh - 180px);"
      role="dialog"
      aria-label="Actions Hub"
      aria-modal="true"
    >

      <!-- ── Header ─────────────────────────────────────────────────────── -->
      <div class="flex items-center gap-3 px-4 py-3 shrink-0
                  bg-gradient-to-r from-violet-700 to-indigo-700 text-white">

        <!-- Fresh Start red pill (quick escape hatch, always accessible) -->
        <button
          type="button"
          class="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full
                 bg-red-500 hover:bg-red-400 active:bg-red-600
                 text-white text-xs font-bold transition-colors duration-150
                 focus:outline-none focus:ring-2 focus:ring-red-300"
          @click="emit('action', 'freshStart'); emit('close')"
        >
          🆘 Fresh Start
        </button>

        <!-- Title + subtitle -->
        <div class="shrink-0 leading-tight">
          <p class="text-sm font-bold uppercase tracking-wider">⚡ Actions</p>
          <p class="text-[10px] text-violet-200 mt-0.5">All SEM App actions in one place</p>
        </div>

        <!-- Live filter input -->
        <div class="flex-1 relative min-w-0">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 text-sm pointer-events-none select-none">🔍</span>
          <input
            v-model="filterText"
            type="search"
            placeholder="Filter actions…"
            autocomplete="off"
            class="w-full pl-8 pr-4 py-2 text-sm rounded-xl
                   bg-white/15 border border-white/25 text-white placeholder:text-violet-200
                   focus:outline-none focus:ring-2 focus:ring-white/40 focus:bg-white/20"
          />
        </div>

        <!-- CloseDot at right end of header (CloseDot rule) -->
        <CloseDot variant="on-dark" aria-label="Close Actions Hub" @click="emit('close')" />
      </div>

      <!-- ── Section grid — scrollable body ─────────────────────────────── -->
      <ScrollContainer outer-class="flex-1 min-h-0 relative" inner-class="h-full p-4">

        <!-- 4-column responsive section grid -->
        <div class="grid grid-cols-4 gap-4 auto-rows-min">

          <section
            v-for="section in filteredSections"
            :key="section.key"
            class="flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
          >

            <!-- Section header: label + count badge + blurb -->
            <div class="px-3 pt-3 pb-2 border-b border-slate-100 shrink-0">
              <div class="flex items-center justify-between gap-1 mb-1">
                <p class="text-[11px] font-bold text-slate-600 uppercase tracking-widest leading-none">
                  {{ section.emoji }} {{ section.label }}
                </p>
                <span
                  class="shrink-0 text-[9px] font-semibold bg-slate-100 text-slate-400
                         rounded-full px-1.5 py-0.5 leading-none tabular-nums"
                  :title="`${section.tiles.filter(t => !t.disabled).length} active of ${section.tiles.length}`"
                >
                  {{ section.tiles.filter(t => !t.disabled).length }}/{{ section.tiles.length }}
                </span>
              </div>
              <p class="text-[9px] text-slate-400 leading-snug">{{ section.blurb }}</p>
            </div>

            <!-- 2-column tile grid -->
            <div class="p-2 grid grid-cols-2 gap-1.5">
              <button
                v-for="tile in section.tiles"
                :key="tile.id"
                type="button"
                :disabled="tile.disabled"
                :aria-label="tile.label"
                :title="tile.tip"
                class="relative flex flex-col items-center rounded-lg border transition-all duration-150
                       focus:outline-none focus:ring-2 focus:ring-violet-400"
                :class="[
                  tile.disabled
                    ? 'bg-slate-50 border-slate-100 opacity-60 cursor-default'
                    : tile.id === 'startOver' && startOverPending
                      ? 'bg-red-50 border-red-200 hover:bg-red-100 cursor-pointer'
                      : 'bg-white border-slate-200 hover:border-violet-300 hover:shadow-sm cursor-pointer hover:bg-violet-50/40',
                ]"
                @click="handleTile(tile)"
                @mouseenter="hoveredId = tile.id"
                @mouseleave="hoveredId = null"
              >
                <!-- Thumbnail area -->
                <div class="w-full h-[54px] rounded-t-lg overflow-hidden flex items-center justify-center shrink-0">
                  <ActionTileThumb :thumb="tile.thumb" :emoji="tile.emoji" />
                </div>

                <!-- Label -->
                <div class="px-1 pb-1.5 pt-1 text-center w-full">
                  <span
                    class="text-[10px] font-semibold leading-tight block"
                    :class="tile.id === 'startOver' && startOverPending ? 'text-red-700' : 'text-slate-700'"
                  >{{ tile.label }}</span>
                </div>

                <!-- Tooltip — appears BELOW tile on hover (top-full avoids scroll-container clip).
                     Enabled tiles: dark slate tip. Disabled tiles with disabledTip: amber warning
                     explaining WHY disabled and how to unlock (DD-009 Zero-Training UI). -->
                <Transition
                  enter-active-class="transition-all duration-150"
                  enter-from-class="opacity-0 -translate-y-1"
                  enter-to-class="opacity-100 translate-y-0"
                  leave-active-class="transition-all duration-100"
                  leave-from-class="opacity-100"
                  leave-to-class="opacity-0"
                >
                  <div
                    v-if="hoveredId === tile.id && (!tile.disabled || tile.disabledTip)"
                    class="absolute top-full mt-1 left-1/2 -translate-x-1/2 z-20
                           text-[10px] rounded-lg px-2.5 py-1.5
                           shadow-lg max-w-[200px] text-center whitespace-normal pointer-events-none"
                    :class="tile.disabled
                      ? 'bg-amber-700 text-amber-50'
                      : 'bg-slate-800 text-white'"
                    role="tooltip"
                  >
                    {{ tile.disabled ? tile.disabledTip : tile.tip }}
                  </div>
                </Transition>
              </button>
            </div>
          </section>

          <!-- Empty state: no sections match the filter -->
          <div
            v-if="filteredSections.length === 0"
            class="col-span-4 py-16 flex flex-col items-center gap-3 text-center"
          >
            <span class="text-4xl" aria-hidden="true">🔍</span>
            <p class="text-sm text-slate-500">
              No actions match
              <strong class="text-slate-700">"{{ filterText }}"</strong>
            </p>
            <button
              type="button"
              class="text-xs text-violet-600 hover:text-violet-800 hover:underline transition-colors"
              @click="filterText = ''"
            >
              Clear filter
            </button>
          </div>

        </div><!-- /4-column grid -->

        <div class="h-4" />
      </ScrollContainer>

    </div><!-- /modal -->

  </Teleport>
</template>
