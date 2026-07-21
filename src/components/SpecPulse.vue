<!-- UNIT_TYPE=Widget -->
<!--
  SpecPulse.vue — r41 v321 (Tom Gilb 2026-06-24)

  Source: Tom Gilb 2026-06-24 verbatim: "a miniature of Value Flow (including
  the dot diagram, and the NEAR neighbors, on right or left side of the stage
  work (if space). The objective is to console the planner that the Planguage
  Plan is building up and exists. I also suggested a fee color blocks with
  number of stakeholders, etc. which scales up nicely."

  Phase 1 (this rev) — horizontal banner with 6 color-block tiles showing live
  counts per Planguage type: Stakeholders · Functions · Values · Solutions ·
  Constraints · Resources. Canonical Planguage colours per type (blue / green
  / violet / orange / red / teal). Mounts above main stage work in App.vue;
  always visible whenever currentSpec exists with ≥1 real entry.

  Confidence narrative: the planner sees their plan grow tile-by-tile as they
  add Stakeholders / Values / Solutions. The pulse is the "console" — a constant
  visible reminder that the Planguage Plan is building up and exists.

  Phase 2 (post-demo) — add the miniature value-flow dot strip below the tiles
  (the actual "value flow with near neighbors" visual Tom described). Reuses
  the SpecMiniMap.vue render logic (already shipped 2026-05-16, mounted only
  in SpecDirectRelations.vue today).

  Composes with: AI-Max (every count is a live signal), MOVE Principle (always
  visible at-a-glance, no menu-dive), Spell-out-Type-Names (full English type
  words on each tile), DD-017 colour contrast (each tile uses a light-bg /
  dark-text pairing that passes WCAG AA), Twin portability (pure Vue + props,
  ports verbatim), No-Silent-Removal (the tiles are a permanent surface).
-->

<script setup lang="ts">
import { computed } from 'vue'
import type { SpecBlock } from '../types/spec'

const props = withDefaults(defineProps<{
  spec: SpecBlock | null
  /** r41 v362 — total Evo Steps in confirmedSteps. */
  evoStepsCount?: number
  /** r41 v362 — total Tasks across all tasksByStep arrays. */
  tasksCount?: number
  /** r41 v363 (Tom Gilb 2026-06-25 "THEY ARE ALSO Planguage SPECS AND IT IS
   *  CRITICAL TO KNOW WHEN THEY ARE NOT DONE OR ARE DONE"): done/total
   *  tracking for the two delivery artefacts.  An Evo Step counts as "done"
   *  when ≥1 task exists AND every task in tasksByStep[stepName] has
   *  completed=true (App.vue computes this).  A Task counts as "done"
   *  when its TaskSuggestion.completed === true. */
  evoStepsDone?: number
  tasksDone?: number
}>(), {
  evoStepsCount: 0,
  tasksCount:    0,
  evoStepsDone:  0,
  tasksDone:     0,
})

const emit = defineEmits<{
  /** User clicked a tile — parent decides where to route */
  (e: 'tile-click', type: 'stakeholders' | 'functions' | 'values' | 'solutions' | 'constraints' | 'resources' | 'evosteps' | 'tasks'): void
}>()

// ── Live counts per type ─────────────────────────────────────────────────────
// r41 v334 (Tom Gilb 2026-06-24 "strip says 0 stakeholders, there are 2 below"):
// Stakeholder count uses the SAME two-path logic as App.vue:_stage1StakeholderCount
// + SpecOutput.specStakeholderCards. Structured `stakeholderEntries[]` count
// takes precedence (post-2026-06-09 specs); falls back to deriving from
// `v.wishStakeholder` (pre-2026-06-09 specs / specs whose Stakeholder Mapper
// has not yet run). Without the fallback, SpecPulse falsely showed "0
// Stakeholders" while the SpecOutput section below showed "2 identified".
const counts = computed(() => {
  const s = props.spec
  if (!s) return { stakeholders: 0, functions: 0, values: 0, solutions: 0, constraints: 0, resources: 0, evosteps: props.evoStepsCount, tasks: props.tasksCount }
  // Stakeholders: structured count first, then fallback to derived.
  let stakeholders = s.stakeholderEntries?.length ?? 0
  if (stakeholders === 0) {
    const derived = new Set<string>()
    for (const v of (s.values ?? [])) {
      const w = v.wishStakeholder?.trim()
      if (w && w.length > 0) derived.add(w.toLowerCase())
    }
    stakeholders = derived.size
  }
  return {
    stakeholders,
    functions:    s.functions?.length ?? 0,
    values:       s.values?.length ?? 0,
    solutions:    s.solutions?.length ?? 0,
    constraints:  s.constraints?.length ?? 0,
    resources:    s.resources?.length ?? 0,
    evosteps:     props.evoStepsCount,
    tasks:        props.tasksCount,
  }
})

const totalEntries = computed(() => {
  const c = counts.value
  return c.stakeholders + c.functions + c.values + c.solutions + c.constraints + c.resources + c.evosteps + c.tasks
})

// Tiles definition — canonical Planguage colour per type.
// Each tile: bg (light tint) · fg (dark text) · accent (border-left / count colour) · glyph (Planguage keyed notation).
interface Tile {
  type: 'stakeholders' | 'functions' | 'values' | 'solutions' | 'constraints' | 'resources' | 'evosteps' | 'tasks'
  label: string
  glyph: string
  bg: string
  fg: string
  accent: string
}

// r41 v362 (Tom Gilb 2026-06-25 "WE NEED TO ALWAYS KEEP COUNT OF EVO STEPS AND
// TASKS") — added the 7th + 8th tiles: Evo Steps (gold/amber) + Tasks
// (indigo).  Tiles 1-6 are the Planguage entry types (SpecBlock-resident);
// tiles 7-8 are the planning-time artefacts (App.vue's `confirmedSteps` +
// `tasksByStep` refs).  All 8 tiles share the same colour-coded chip pattern.
const TILES: readonly Tile[] = [
  { type: 'stakeholders', label: 'Stakeholders', glyph: '§',     bg: '#dbeafe', fg: '#1e3a8a', accent: '#2563eb' }, // blue
  { type: 'functions',    label: 'Functions',    glyph: '[*]',   bg: '#dcfce7', fg: '#14532d', accent: '#16a34a' }, // green
  { type: 'values',       label: 'Values',       glyph: '[*+*]', bg: '#ede9fe', fg: '#4c1d95', accent: '#7c3aed' }, // violet
  { type: 'solutions',    label: 'Solutions',    glyph: '*→',    bg: '#ffedd5', fg: '#9a3412', accent: '#ea580c' }, // orange
  { type: 'constraints',  label: 'Constraints',  glyph: '!',     bg: '#fee2e2', fg: '#991b1b', accent: '#dc2626' }, // rose / red
  { type: 'resources',    label: 'Resources',    glyph: '[$]',   bg: '#ccfbf1', fg: '#134e4a', accent: '#0d9488' }, // teal / dark-green
  { type: 'evosteps',     label: 'Evo Steps',    glyph: '←→',    bg: '#fef3c7', fg: '#78350f', accent: '#d97706' }, // amber / gold
  { type: 'tasks',        label: 'Tasks',        glyph: '○→•',   bg: '#e0e7ff', fg: '#3730a3', accent: '#4f46e5' }, // indigo
] as const

function onTileClick(type: Tile['type']): void {
  emit('tile-click', type)
}

/** r41 v363 — done-status counts surfaced ONLY on evosteps + tasks tiles. */
const doneCounts = computed(() => ({
  evosteps: props.evoStepsDone,
  tasks:    props.tasksDone,
}))

/** r41 v363 — per-tile HoverHint that includes done/total framing for the
 *  two delivery-tracking tiles, simple-count framing for the rest. */
function tileHoverHint(t: Tile): string {
  if (t.type === 'evosteps') {
    const total = counts.value.evosteps
    const done  = doneCounts.value.evosteps
    if (total === 0) return 'No Evo Steps confirmed yet. Click to open Stage 6 (Generate Evo Steps).'
    if (done === total) return `All ${total} Evo Steps complete. Click to open Stage 6.`
    return `${done} of ${total} Evo Steps done · ${total - done} pending. Click to open Stage 6.`
  }
  if (t.type === 'tasks') {
    const total = counts.value.tasks
    const done  = doneCounts.value.tasks
    if (total === 0) return 'No Tasks defined yet. Click to open Stage 8 (Tasks).'
    if (done === total) return `All ${total} Tasks complete. Click to open Stage 8.`
    return `${done} of ${total} Tasks done · ${total - done} pending. Click to open Stage 8.`
  }
  return `${counts.value[t.type]} ${t.label} in your plan. Click to open the ${t.label} editor / sector view.`
}
</script>

<template>
  <!-- Only render when there's at least one real entry. Hiding on empty spec
       prevents a "0 0 0 0 0 0" wall of empty tiles before the planner has done
       anything — confidence is built BY entries existing, not by counting nothing. -->
  <div
    v-if="totalEntries > 0"
    class="px-4 py-2 bg-slate-50/70 border-y border-slate-200/80"
    role="region"
    aria-label="Spec Pulse — live count of Planguage entries per type"
    title="Spec Pulse — your Planguage Plan as it builds up: live count per type. Click any tile to jump to that type's editor."
  >
    <div class="flex items-center gap-2 flex-wrap">
      <!-- "Planguage Spec Contains:" lead label — provides context for the counts.
           r41 v330 (Tom Gilb 2026-06-24): label refined from "Plan now contains"
           to make the Planguage discipline explicit; the counts represent
           STRUCTURED PLANGUAGE ENTRIES, not raw text content. -->
      <span
        class="text-[10px] uppercase tracking-[0.12em] text-slate-500 font-semibold mr-1 shrink-0"
        title="Live count of every Planguage entry type in your plan.  Evo Steps + Tasks show done/total format because their delivery status is critical to track."
      >
        Planguage Spec Contains:
      </span>

      <!-- 8 tiles — 6 Planguage entry types + Evo Steps + Tasks.
           r41 v363 (Tom Gilb 2026-06-25 "THEY ARE ALSO Planguage SPECS AND
           IT IS CRITICAL TO KNOW WHEN THEY ARE NOT DONE OR ARE DONE"):
           Evo Steps + Tasks tiles render `done / total` so the planner can
           always see delivery status at a glance.  Tiles with all-done
           render a green ✓ chip; tiles with pending work render an amber !
           chip.  Other 6 tile types have no completion concept (Spec entries
           describe WHAT, not WHEN-FINISHED) so they show the simple count. -->
      <button
        v-for="t in TILES"
        :key="t.type"
        type="button"
        class="group flex items-center gap-2 px-3 py-1.5 rounded-md border-l-4 transition-all
               hover:shadow-md hover:scale-[1.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
        :style="{
          background: t.bg,
          color: t.fg,
          borderLeftColor: t.accent,
        }"
        :aria-label="t.type === 'evosteps' ? `${doneCounts.evosteps} of ${counts.evosteps} Evo Steps complete — click to open Stage 6` : t.type === 'tasks' ? `${doneCounts.tasks} of ${counts.tasks} Tasks complete — click to open Stage 8` : `${counts[t.type]} ${t.label} — click to open ${t.label} editor`"
        :title="tileHoverHint(t)"
        @click="onTileClick(t.type)"
      >
        <!-- Planguage keyed glyph (small, monospace) -->
        <span
          class="text-[11px] font-mono font-bold opacity-70 group-hover:opacity-100"
          aria-hidden="true"
        >{{ t.glyph }}</span>

        <!-- Count number — the headline visual.  For evosteps/tasks: `done / total`. -->
        <span class="text-xl font-extrabold leading-none">
          <template v-if="t.type === 'evosteps' || t.type === 'tasks'">
            {{ doneCounts[t.type] }}<span class="text-sm font-bold opacity-70">/{{ counts[t.type] }}</span>
          </template>
          <template v-else>{{ counts[t.type] }}</template>
        </span>

        <!-- Type name in plain English (Spell-out-Type-Names SUPREME) -->
        <span class="text-[11px] font-bold uppercase tracking-wider">{{ t.label }}</span>

        <!-- Done-status indicator on evosteps + tasks tiles -->
        <span
          v-if="(t.type === 'evosteps' || t.type === 'tasks') && counts[t.type] > 0"
          class="shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-px rounded border"
          :class="doneCounts[t.type] === counts[t.type]
            ? 'bg-white border-emerald-400 text-emerald-700'
            : 'bg-white border-amber-400 text-amber-700'"
          :title="doneCounts[t.type] === counts[t.type]
            ? `All ${counts[t.type]} ${t.label} marked done`
            : `${counts[t.type] - doneCounts[t.type]} of ${counts[t.type]} ${t.label} NOT done yet — click to open editor`"
        >{{ doneCounts[t.type] === counts[t.type] ? '✓ done' : '! pending' }}</span>
      </button>

      <!-- Total spec entries — celebratory summary on the right -->
      <span
        class="ml-auto text-[10px] uppercase tracking-[0.12em] text-slate-500 font-semibold shrink-0"
        :title="`Total Planguage entries across all 8 types: ${totalEntries}`"
      >
        {{ totalEntries }} total
      </span>
    </div>
  </div>
</template>
