<!-- ActionsHubPanel.vue — tile grid action hub. Replaces the old text dropdown.
     Opens as a right-side drawer triggered by the ⚡ Actions button.
     Tiles are grouped into: QUALITY · PLANNING · EXPLORE · MANAGE · ABOUT.
     Each tile has a thumbnail (ActionTileThumb), a label, and a tooltip.
     Emits: action(id: string), close.

     Thumbnail Reality Rule: no hand-drawn cartoons. Every tile mini is
     T1 LIVE (real data) or T2 GLYPH (Planguage glyph) or T3 REAL (plan data).
     Fallback: large emoji (T3 REAL-emoji — the emoji IS the glyph identity).

     Props:
       hasPlan            — true when any planModel is loaded
       hasSpec            — true when a currentSpec exists
       hasConfirmedSteps  — true when confirmedSteps.length > 0
       hasMultipleModels  — true when _allPlanModels.length > 0
       hasSpecHistory     — true when specHistory.length > 0
       hasDashboardEntries— true when dashboardEntries.length > 0
       dictationActive    — current mic state
       speaking           — current speaker state
       startOverPending   — true when startOver 2nd-click confirm is pending
-->

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import RightPanel       from './RightPanel.vue'
import CloseDot         from './CloseDot.vue'
import ScrollContainer  from './ScrollContainer.vue'
import ActionTileThumb  from './ActionTileThumb.vue'
import type { ThumbType } from './ActionTileThumb.vue'

const props = withDefaults(defineProps<{
  hasPlan:              boolean
  hasSpec:              boolean
  hasConfirmedSteps:    boolean
  hasMultipleModels:    boolean
  hasSpecHistory:       boolean
  hasDashboardEntries:  boolean
  dictationActive:      boolean
  speaking:             boolean
  startOverPending:     boolean
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

// ── Tile type ─────────────────────────────────────────────────────────────────

interface Tile {
  id:       string
  label:    string
  emoji:    string
  thumb:    ThumbType
  tip:      string
  /** When true the tile is greyed out (but still clickable so it can show an appropriate message). */
  disabled?: boolean
}

interface Section {
  key:    string
  label:  string
  tiles:  Tile[]
}

// ── Section + tile definitions ────────────────────────────────────────────────

const sections = computed<Section[]>(() => [
  // ── QUALITY ──────────────────────────────────────────────────────────────
  {
    key: 'quality', label: 'QUALITY',
    tiles: [
      { id: 'planHealthStatus', label: 'Plan Health Status',         emoji: '🩺', thumb: 'emoji', tip: 'View PHI score, history graph and notifications',    disabled: !props.hasSpec },
      { id: 'planHealthAdmin',  label: 'Plan Health Administration', emoji: '⚙️', thumb: 'emoji', tip: 'Edit aspects, weights and run AI expert reviews',     disabled: !props.hasSpec },
      { id: 'conflicts',        label: 'Conflicts',                  emoji: '⚠',  thumb: 'emoji', tip: 'Detect hidden stakeholder tensions in the spec',      disabled: !props.hasSpec },
    ],
  },
  // ── PLANNING ─────────────────────────────────────────────────────────────
  {
    key: 'planning', label: 'PLANNING',
    tiles: [
      { id: 'planTargets',      label: 'Plan Targets',               emoji: '🎯', thumb: 'emoji', tip: 'Set delivery targets and milestones' },
      { id: 'globalPriority',   label: 'Global Priority',            emoji: '🏆', thumb: 'priorityGlyph', tip: 'Run and review full plan priority ranking',        disabled: !props.hasSpec },
      { id: 'planOwners',       label: 'Plan Owners',                emoji: '🔑', thumb: 'emoji', tip: 'Manage accountable stakeholders for this plan',     disabled: !props.hasPlan },
      { id: 'planners',         label: 'Planners',                   emoji: '💡', thumb: 'emoji', tip: 'Manage planners who conceive the plan ideas',        disabled: !props.hasPlan },
      { id: 'scribes',          label: 'Scribes',                    emoji: '⌨️', thumb: 'emoji', tip: 'Manage scribes who do the keying (Mob Planning)',    disabled: !props.hasPlan },
      { id: 'specOwners',       label: 'Spec Owners & Governance',   emoji: '👥', thumb: 'emoji', tip: 'Assign area-specific spec accountability',           disabled: !props.hasPlan },
    ],
  },
  // ── EXPLORE ──────────────────────────────────────────────────────────────
  {
    key: 'explore', label: 'EXPLORE',
    tiles: [
      { id: 'evoSim',       label: 'Evo Value Animation',            emoji: '📈', thumb: 'emoji', tip: 'Animate cumulative value delivery across 26 weeks',  disabled: !props.hasConfirmedSteps },
      { id: 'replay',       label: 'Evo Step Sequence Animation',    emoji: '🔁', thumb: 'emoji', tip: 'Step-by-step replay of your Evo delivery sequence',  disabled: !props.hasConfirmedSteps },
      { id: 'visualise',    label: 'Diagrams & Visuals',             emoji: '🗺️', thumb: 'emoji', tip: 'Browse all plan diagrams and visual analyses',       disabled: !props.hasSpec },
      { id: 'heatLane',     label: 'Value Stage Map',                emoji: '🌡️', thumb: 'emoji', tip: 'Swimlane heatmap of value delivery by stage',        disabled: !props.hasSpec },
      { id: 'present',      label: 'Present',                        emoji: '🖥️', thumb: 'emoji', tip: 'Present this plan full-screen',                      disabled: !props.hasSpec },
      { id: 'modelHistory', label: 'Model History',                  emoji: '🗂️', thumb: 'emoji', tip: 'Browse all saved plan models' },
    ],
  },
  // ── MANAGE ───────────────────────────────────────────────────────────────
  {
    key: 'manage', label: 'MANAGE',
    tiles: [
      { id: 'sharpen',         label: 'Sharpen Plan',                emoji: '🔪', thumb: 'emoji', tip: 'Run AI sharpening cycles to improve the spec',          disabled: !props.hasSpec },
      { id: 'improve',         label: 'Improve This Version',        emoji: '⚙',  thumb: 'emoji', tip: 'Generate an improved version of the current spec',      disabled: !props.hasSpec },
      { id: 'resumeLast',      label: 'Resume Last',                 emoji: '▶',  thumb: 'emoji', tip: 'Reopen the most recently used plan model',               disabled: !props.hasMultipleModels },
      { id: 'previousPlan',    label: 'Start with Previous Plan',    emoji: '📋', thumb: 'emoji', tip: 'Load an earlier plan as a starting point',              disabled: !props.hasMultipleModels },
      { id: 'saveCheckpoint',  label: 'Save Version Checkpoint',     emoji: '💾', thumb: 'saveGlyph', tip: 'Save a manual snapshot of the current spec',        disabled: !props.hasSpec },
      { id: 'planHistory',     label: 'Plan History',                emoji: '🕐', thumb: 'emoji', tip: `Version history (${props.hasSpecHistory ? 'has versions' : 'empty'})` },
      { id: 'specHistory',     label: 'Spec History',                emoji: '📋', thumb: 'emoji', tip: 'All snapshots across all spec evolution sessions' },
      { id: 'renamePlan',      label: 'Rename Plan',                 emoji: '✏',  thumb: 'editGlyph', tip: 'Rename this plan and set its responsible owner',   disabled: !props.hasPlan },
      { id: 'startOver',       label: props.startOverPending ? '⚠ Confirm Restart?' : 'Restart Afresh', emoji: props.startOverPending ? '⚠' : '🔄', thumb: 'emoji', tip: props.startOverPending ? 'Click again to confirm restart' : 'Discard current spec and start fresh' },
      { id: 'freshStart',      label: 'Fresh Start',                 emoji: '🆘', thumb: 'emoji', tip: '4-option graduated reset: blank canvas, save & stop, cancel changes, close stuck UI' },
      { id: 'savePlan',        label: 'Save Plan',                   emoji: '⬇',  thumb: 'emoji', tip: 'Download the current spec as a JSON file',              disabled: !props.hasSpec },
      { id: 'emailPlan',       label: 'Email Plan',                  emoji: '✉',  thumb: 'emoji', tip: 'Send the current spec via email',                       disabled: !props.hasSpec },
      { id: 'restorePlans',    label: 'Restore Plans',               emoji: '↑',  thumb: 'emoji', tip: 'Import a previously saved JSON backup' },
      { id: 'backup',          label: 'Backup SEM App',              emoji: '🛡',  thumb: 'emoji', tip: 'Backup all plan models to a single JSON file',           disabled: !props.hasMultipleModels },
    ],
  },
  // ── ABOUT ────────────────────────────────────────────────────────────────
  {
    key: 'about', label: 'ABOUT',
    tiles: [
      { id: 'toolInfo',      label: 'Current Plan Metadata',         emoji: 'ℹ',  thumb: 'emoji', tip: 'Purposes, originator, tags, URLs and deep insights for this plan', disabled: !props.hasPlan },
      { id: 'semMetadata',   label: 'SEM Metadata',                  emoji: '🧬', thumb: 'semMeta', tip: 'SEM App build stats, component counts, and session counters' },
      { id: 'copyright',     label: 'Copyright & Attribution',       emoji: '©',  thumb: 'emoji', tip: 'Open-source attributions and Tom Gilb copyright notices' },
      { id: 'saveGlyph',     label: 'About the Save Glyph',          emoji: '💾', thumb: 'saveGlyph', tip: 'The essay behind *→[*] — why the floppy disk is wrong' },
      { id: 'priorityGlyph', label: 'About the Priority Glyph',      emoji: '🏆', thumb: 'priorityGlyph', tip: 'Why [A>B>C] beats points and effort scoring' },
      { id: 'editGlyph',     label: 'About the Edit Glyph',          emoji: '✏',  thumb: 'editGlyph', tip: 'The [*]→[**] mark — Planguage improvement notation' },
    ],
  },
])

// ── Tooltip ───────────────────────────────────────────────────────────────────

const hoveredId = ref<string | null>(null)

// ── Handle tile click ─────────────────────────────────────────────────────────

function handleTile(tile: Tile): void {
  if (tile.disabled) return
  emit('action', tile.id)
  // Keep hub open for startOver (needs 2-click confirm)
  if (tile.id !== 'startOver') emit('close')
}
</script>

<template>
  <Teleport to="body">
    <!-- Click-outside backdrop -->
    <div
      class="fixed inset-0 z-[379]"
      aria-hidden="true"
      @click="emit('close')"
    />

    <!-- Right drawer -->
    <RightPanel
      class="z-[380] w-80 bg-slate-50 shadow-2xl border-l border-slate-200 flex flex-col overflow-hidden"
      role="dialog"
      aria-label="Actions Hub"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-3 shrink-0
                  bg-gradient-to-r from-violet-700 to-indigo-600 text-white">
        <div>
          <p class="text-sm font-bold uppercase tracking-wider">⚡ Actions</p>
          <p class="text-[10px] text-violet-200 mt-0.5">All SEM App actions in one place</p>
        </div>
        <CloseDot variant="on-dark" aria-label="Close Actions Hub" @click="emit('close')" />
      </div>

      <!-- Tile grid, scrollable -->
      <ScrollContainer outer-class="flex-1 min-h-0 relative" inner-class="h-full py-3 space-y-4">

        <section
          v-for="section in sections"
          :key="section.key"
          class="px-3"
        >
          <!-- Section header -->
          <p class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">
            {{ section.label }}
            <span class="ml-1 text-[10px] font-semibold bg-slate-200 text-slate-500 rounded-full px-1.5 py-0.5">
              {{ section.tiles.filter(t => !t.disabled).length }}
            </span>
          </p>

          <!-- Tiles: 3-column grid -->
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="tile in section.tiles"
              :key="tile.id"
              type="button"
              :disabled="tile.disabled"
              :aria-label="tile.label"
              :title="tile.tip"
              class="relative flex flex-col items-center rounded-xl border transition-all
                     focus:outline-none focus:ring-2 focus:ring-violet-400 duration-150"
              :class="tile.disabled
                ? 'bg-slate-100 border-slate-200 opacity-40 cursor-not-allowed'
                : tile.id === 'startOver' && startOverPending
                  ? 'bg-red-50 border-red-200 hover:bg-red-100 cursor-pointer'
                  : 'bg-white border-slate-200 hover:border-violet-300 hover:shadow-sm cursor-pointer hover:bg-violet-50/40'"
              @click="handleTile(tile)"
              @mouseenter="hoveredId = tile.id"
              @mouseleave="hoveredId = null"
            >
              <!-- Thumbnail area -->
              <div class="w-full h-[68px] rounded-t-xl overflow-hidden bg-slate-50 flex items-center justify-center">
                <ActionTileThumb
                  :thumb="tile.thumb"
                  :emoji="tile.emoji"
                />
              </div>

              <!-- Label -->
              <div class="px-1.5 pb-2 pt-1 text-center w-full">
                <span
                  class="text-sm font-semibold leading-tight block"
                  :class="tile.id === 'startOver' && startOverPending
                    ? 'text-red-700'
                    : 'text-slate-800'"
                >{{ tile.label }}</span>
              </div>

              <!-- Tooltip -->
              <Transition
                enter-active-class="transition-all duration-150"
                enter-from-class="opacity-0 translate-y-1"
                enter-to-class="opacity-100 translate-y-0"
                leave-active-class="transition-all duration-100"
                leave-from-class="opacity-100"
                leave-to-class="opacity-0"
              >
                <div
                  v-if="hoveredId === tile.id && !tile.disabled"
                  class="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-10
                         bg-slate-800 text-white text-[10px] rounded-lg px-2.5 py-1.5
                         shadow-lg max-w-[200px] text-center whitespace-normal pointer-events-none"
                  role="tooltip"
                >
                  {{ tile.tip }}
                </div>
              </Transition>
            </button>
          </div>
        </section>

        <div class="h-4" />
      </ScrollContainer>
    </RightPanel>
  </Teleport>
</template>
