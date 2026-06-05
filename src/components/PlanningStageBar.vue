<script setup lang="ts">
// PlanningStageBar.vue — 11-stage visual workflow tile bar.
// Rebuilt 2026-05-27 from screenshot evidence after git reset --hard wiped the
// original (which was never committed to git between 2026-05-19 and 2026-05-27).
//
// Design reference: screenshot from 2026-05-25 02:25 showing 11 dark tiles
// (Stakes → Solutions → Sharpen → Impacts → Refine → Evo Steps → Evo Impact
//  → Tasks → Study-Act → Plan → Export) with connecting teal arrows.
//
// Architecture principles (Architectural Resilience Rule 2026-05-27):
//   - Stages defined as data (not hardcoded in template), trivially extendable
//   - Active state driven by props, no internal navigation state
//   - Emits 'navigate' so App.vue owns all stage-transition logic
//   - Tile icons are inline SVG; no external asset dependency
//   - Horizontal scroll container wraps tiles for narrow windows

const props = defineProps<{
  /** Current planning stage index (1–11). Drives which tile is highlighted. */
  currentStage: number
  /** True once a spec has been parsed — unlocks non-Stakes tiles. */
  hasSpec: boolean
  /** True once an evo plan exists — unlocks later tiles. */
  hasPlan: boolean
}>()

const emit = defineEmits<{
  /** User clicked a tile — parent should navigate to that app stage. */
  navigate: [appStage: number]
}>()

// ── Stage definitions ─────────────────────────────────────────────────────────
// Each stage maps to an appStage (1–5) so the existing App.vue stage system
// is used as the routing layer. Multiple tiles can share an appStage (they
// represent different conceptual moments within the same technical stage).
// `color` = Tailwind bg token for the icon accent ring (inactive tiles).
// `activeGradient` = gradient classes for the active tile background.

// Exported so App.vue's Back/Next pin-pair (and any future stage-navigator)
// can render destination-stage info (label + gradient colors) without
// duplicating this list. Tom 2026-06-03: "buttons should be identical to
// the stage pins". Single-source ensures they stay visually consistent.
export const STAGES = [
  {
    n: 1,
    label: 'Stakes',
    appStage: 1,
    color: 'text-violet-400',
    activeFrom: 'from-violet-700',
    activeTo: 'to-indigo-600',
    icon: 'stakes',
  },
  {
    n: 2,
    label: 'Solutions',
    appStage: 1,
    color: 'text-amber-400',
    activeFrom: 'from-amber-600',
    activeTo: 'to-orange-500',
    icon: 'solutions',
  },
  {
    n: 3,
    label: 'Sharpen',
    appStage: 1,
    color: 'text-sky-400',
    activeFrom: 'from-sky-700',
    activeTo: 'to-blue-600',
    icon: 'sharpen',
  },
  {
    n: 4,
    label: 'Impacts',
    appStage: 3,
    color: 'text-cyan-400',
    activeFrom: 'from-cyan-700',
    activeTo: 'to-teal-600',
    icon: 'impacts',
  },
  {
    n: 5,
    label: 'Refine',
    appStage: 2,
    color: 'text-indigo-400',
    activeFrom: 'from-indigo-700',
    activeTo: 'to-violet-600',
    icon: 'refine',
  },
  {
    n: 6,
    label: 'Evo Steps',
    appStage: 2,
    color: 'text-emerald-400',
    activeFrom: 'from-emerald-700',
    activeTo: 'to-green-600',
    icon: 'evo-steps',
  },
  {
    n: 7,
    label: 'Evo Impact',
    appStage: 3,
    color: 'text-rose-400',
    activeFrom: 'from-rose-700',
    activeTo: 'to-pink-600',
    icon: 'evo-impact',
  },
  {
    n: 8,
    label: 'Tasks',
    appStage: 4,
    color: 'text-pink-400',
    activeFrom: 'from-pink-700',
    activeTo: 'to-rose-600',
    icon: 'tasks',
  },
  {
    n: 9,
    label: 'Study-Act',
    appStage: 2,
    color: 'text-amber-400',
    activeFrom: 'from-amber-700',
    activeTo: 'to-yellow-600',
    icon: 'study-act',
  },
  {
    n: 10,
    label: 'Plan',
    appStage: 2,
    color: 'text-emerald-400',
    activeFrom: 'from-emerald-600',
    activeTo: 'to-green-500',
    icon: 'plan',
  },
  {
    n: 11,
    label: 'Export',
    appStage: 5,
    color: 'text-violet-400',
    activeFrom: 'from-violet-700',
    activeTo: 'to-purple-600',
    icon: 'export',
  },
] as const

type StageIcon = typeof STAGES[number]['icon']

function isActive(s: typeof STAGES[number]): boolean {
  // r17 fix (2026-06-02): compare planning stage index (1–11) not appStage (1–5).
  // Using appStage caused ALL tiles sharing the same appStage to highlight together.
  return s.n === props.currentStage
}

function isReachable(s: typeof STAGES[number]): boolean {
  if (s.appStage === 1) return true
  if (!props.hasSpec) return false
  if (s.appStage > 2 && !props.hasPlan) return false
  return true
}
</script>

<template>
  <!-- Outer wrapper: full-width, scroll hidden behind fade edges on narrow screens. -->
  <div
    class="w-full bg-slate-900 border-b border-slate-700 px-3 py-2.5 overflow-x-auto
           scrollbar-none"
    role="navigation"
    aria-label="Planning workflow stages"
  >
    <div class="flex items-center gap-0 min-w-max mx-auto">

      <template v-for="(s, idx) in STAGES" :key="s.n">

        <!-- ── Connecting arrow (between tiles) ────────────────────────── -->
        <div
          v-if="idx > 0"
          class="flex items-center px-1 shrink-0"
          aria-hidden="true"
        >
          <svg
            class="w-4 h-4 transition-colors duration-300"
            :class="isActive(s) ? 'text-teal-300' : 'text-slate-600'"
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <path d="M3 8h8M8 4l4 4-4 4" stroke="currentColor" stroke-width="1.5"
                  stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          </svg>
        </div>

        <!-- ── Stage tile ─────────────────────────────────────────────── -->
        <button
          type="button"
          :disabled="!isReachable(s)"
          :aria-label="`Stage ${s.n}: ${s.label}${isActive(s) ? ' (current)' : ''}`"
          :aria-current="isActive(s) ? 'step' : undefined"
          :title="isReachable(s) ? `Go to ${s.label}` : `${s.label} — complete earlier stages first`"
          class="relative flex flex-col items-center justify-between
                 w-[78px] h-[88px] rounded-xl px-1.5 py-2
                 transition-all duration-300 shrink-0
                 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900"
          :class="[
            isActive(s)
              ? `bg-gradient-to-b ${s.activeFrom} ${s.activeTo} shadow-lg shadow-black/40
                 ring-0 focus:ring-white/60 scale-105`
              : isReachable(s)
                ? 'bg-slate-800 hover:bg-slate-700 focus:ring-slate-500 cursor-pointer'
                : 'bg-slate-800/50 cursor-not-allowed opacity-50',
          ]"
          @click="isReachable(s) && emit('navigate', s.n)"
        >
          <!-- Stage number badge (top-left) — Tom 2026-06-04: was illegible
               (text-white/80 on light active gradients washed out, text-
               slate-300 on dark inactive tiles low-contrast).  Now uses
               the universal dark-plate treatment: bg-black/70 + white text
               + tight padding — readable on every active/inactive gradient. -->
          <span
            class="absolute top-1 left-1 text-[11px] font-extrabold leading-none
                   bg-black/70 text-white rounded-md px-1.5 py-1 shadow-sm"
            aria-hidden="true"
          >{{ s.n }}</span>

          <!-- ── Icon (center) ────────────────────────────────────────── -->
          <div class="flex-1 flex items-center justify-center w-full mt-2" aria-hidden="true">

            <!-- Stakes icon: stakeholder circle + goal arrow -->
            <svg v-if="s.icon === 'stakes'" viewBox="0 0 40 40" class="w-10 h-10">
              <circle cx="14" cy="12" r="5" :fill="isActive(s) ? '#c4b5fd' : '#a78bfa'" opacity="0.9"/>
              <path d="M6 28c0-5 4-8 8-8h5" stroke="#c4b5fd" stroke-width="2" stroke-linecap="round" fill="none"/>
              <circle cx="28" cy="20" r="7" fill="none" :stroke="isActive(s) ? '#fde68a' : '#fbbf24'" stroke-width="2"/>
              <path d="M24 20h8M28 16v8" :stroke="isActive(s) ? '#fde68a' : '#fbbf24'" stroke-width="2" stroke-linecap="round"/>
            </svg>

            <!-- Solutions icon: bracket with forward arrow [→] -->
            <svg v-else-if="s.icon === 'solutions'" viewBox="0 0 40 40" class="w-10 h-10">
              <path d="M8 8v5c0 3 3 3 3 7s-3 4-3 7v5" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" fill="none"/>
              <path d="M32 8v5c0 3-3 3-3 7s3 4 3 7v5" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" fill="none"/>
              <path d="M15 20h10M21 15l5 5-5 5" :stroke="isActive(s) ? '#fcd34d' : '#fbbf24'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            </svg>

            <!-- Sharpen icon: two arrows converging to a point -->
            <svg v-else-if="s.icon === 'sharpen'" viewBox="0 0 40 40" class="w-10 h-10">
              <path d="M8 10l12 10" :stroke="isActive(s) ? '#7dd3fc' : '#38bdf8'" stroke-width="2.5" stroke-linecap="round"/>
              <path d="M8 30l12-10" :stroke="isActive(s) ? '#7dd3fc' : '#38bdf8'" stroke-width="2.5" stroke-linecap="round"/>
              <circle cx="22" cy="20" r="3" :fill="isActive(s) ? '#38bdf8' : '#7dd3fc'"/>
              <path d="M25 20h7" :stroke="isActive(s) ? '#bae6fd' : '#bae6fd'" stroke-width="2" stroke-linecap="round"/>
            </svg>

            <!-- Impacts icon: arrows hitting target -->
            <svg v-else-if="s.icon === 'impacts'" viewBox="0 0 40 40" class="w-10 h-10">
              <path d="M8 14l8 6" :stroke="isActive(s) ? '#67e8f9' : '#22d3ee'" stroke-width="2.5" stroke-linecap="round"/>
              <path d="M8 26l8-6" :stroke="isActive(s) ? '#67e8f9' : '#22d3ee'" stroke-width="2.5" stroke-linecap="round"/>
              <path d="M16 20h8" :stroke="isActive(s) ? '#a5f3fc' : '#67e8f9'" stroke-width="2.5" stroke-linecap="round"/>
              <circle cx="26" cy="20" r="6" fill="none" :stroke="isActive(s) ? '#a5f3fc' : '#67e8f9'" stroke-width="2"/>
              <circle cx="26" cy="20" r="2.5" :fill="isActive(s) ? '#a5f3fc' : '#22d3ee'"/>
            </svg>

            <!-- Refine icon: funnel / narrowing brackets -->
            <svg v-else-if="s.icon === 'refine'" viewBox="0 0 40 40" class="w-10 h-10">
              <path d="M8 10h24l-9 12v8l-6-3V22z" :fill="isActive(s) ? '#a5b4fc' : '#818cf8'" opacity="0.85"/>
              <path d="M8 10h24l-9 12v8l-6-3V22z" stroke="#c7d2fe" stroke-width="1" stroke-linejoin="round" fill="none"/>
            </svg>

            <!-- Evo Steps icon: cycling arrows -->
            <svg v-else-if="s.icon === 'evo-steps'" viewBox="0 0 40 40" class="w-10 h-10">
              <path d="M20 8a12 12 0 0 1 12 12" stroke="#34d399" stroke-width="2.5" stroke-linecap="round" fill="none"/>
              <path d="M32 20a12 12 0 0 1-12 12" stroke="#fbbf24" stroke-width="2.5" stroke-linecap="round" fill="none"/>
              <path d="M20 32a12 12 0 0 1-12-12" stroke="#f87171" stroke-width="2.5" stroke-linecap="round" fill="none"/>
              <path d="M8 20a12 12 0 0 1 12-12" stroke="#60a5fa" stroke-width="2.5" stroke-linecap="round" fill="none"/>
              <!-- Arrowheads -->
              <path d="M29 14l3 6-3 0" fill="#34d399"/>
              <path d="M14 31l-3-6 3 0" fill="#fbbf24"/>
            </svg>

            <!-- Evo Impact icon: crossed measurement arrows -->
            <svg v-else-if="s.icon === 'evo-impact'" viewBox="0 0 40 40" class="w-10 h-10">
              <path d="M10 30l20-20" :stroke="isActive(s) ? '#fda4af' : '#fb7185'" stroke-width="2.5" stroke-linecap="round"/>
              <path d="M10 10l20 20" :stroke="isActive(s) ? '#fda4af' : '#fb7185'" stroke-width="2.5" stroke-linecap="round"/>
              <circle cx="20" cy="20" r="5" fill="none" :stroke="isActive(s) ? '#fb7185' : '#fda4af'" stroke-width="2"/>
              <path d="M20 8v4M20 28v4M8 20h4M28 20h4" :stroke="isActive(s) ? '#fecdd3' : '#fecdd3'" stroke-width="1.5" stroke-linecap="round"/>
            </svg>

            <!-- Tasks icon: stacked checklist rows -->
            <svg v-else-if="s.icon === 'tasks'" viewBox="0 0 40 40" class="w-10 h-10">
              <rect x="8" y="10" width="24" height="5" rx="2" :fill="isActive(s) ? '#f9a8d4' : '#f472b6'" opacity="0.9"/>
              <rect x="8" y="18" width="18" height="5" rx="2" :fill="isActive(s) ? '#f9a8d4' : '#f472b6'" opacity="0.7"/>
              <rect x="8" y="26" width="22" height="5" rx="2" :fill="isActive(s) ? '#f9a8d4' : '#f472b6'" opacity="0.5"/>
              <path d="M34 19l-4 4-2-2" :stroke="isActive(s) ? '#fce7f3' : '#fce7f3'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            </svg>

            <!-- Study-Act icon: Deming cycle (circular arrows with book) -->
            <svg v-else-if="s.icon === 'study-act'" viewBox="0 0 40 40" class="w-10 h-10">
              <circle cx="20" cy="20" r="12" fill="none" :stroke="isActive(s) ? '#fcd34d' : '#fbbf24'" stroke-width="2"/>
              <path d="M20 8v4M32 20h-4M20 32v-4M8 20h4" :stroke="isActive(s) ? '#fde68a' : '#fcd34d'" stroke-width="1.5" stroke-linecap="round"/>
              <path d="M14 14h12v8H14z" :fill="isActive(s) ? '#fef3c7' : '#fef3c7'" opacity="0.8"/>
              <path d="M20 14v8" :stroke="isActive(s) ? '#d97706' : '#d97706'" stroke-width="1.5"/>
              <!-- Arrow at top indicating cycle -->
              <path d="M16 9l4-3 4 3" :stroke="isActive(s) ? '#fcd34d' : '#fbbf24'" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>

            <!-- Plan icon: upward growth chart -->
            <svg v-else-if="s.icon === 'plan'" viewBox="0 0 40 40" class="w-10 h-10">
              <path d="M8 32V24l6-4 6 2 6-8 6-4" :stroke="isActive(s) ? '#6ee7b7' : '#34d399'" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
              <circle cx="14" cy="20" r="2.5" :fill="isActive(s) ? '#6ee7b7' : '#34d399'"/>
              <circle cx="20" cy="22" r="2.5" :fill="isActive(s) ? '#6ee7b7' : '#34d399'"/>
              <circle cx="26" cy="14" r="2.5" :fill="isActive(s) ? '#6ee7b7' : '#34d399'"/>
              <circle cx="32" cy="10" r="2.5" :fill="isActive(s) ? '#6ee7b7' : '#34d399'"/>
              <path d="M8 32h24" stroke="#64748b" stroke-width="1.5" stroke-linecap="round"/>
            </svg>

            <!-- Export icon: box with outward arrow -->
            <svg v-else-if="s.icon === 'export'" viewBox="0 0 40 40" class="w-10 h-10">
              <rect x="8" y="18" width="16" height="14" rx="3" :fill="isActive(s) ? '#a78bfa' : '#8b5cf6'" opacity="0.85"/>
              <path d="M20 10h10M25 6l5 4-5 4" :stroke="isActive(s) ? '#ddd6fe' : '#c4b5fd'" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
              <path d="M20 24h4" stroke="#ddd6fe" stroke-width="1.5" stroke-linecap="round"/>
            </svg>

          </div>

          <!-- Stage label (bottom) -->
          <span
            class="text-[10px] font-bold leading-none text-center px-0.5 truncate w-full"
            :class="isActive(s) ? 'text-white' : 'text-slate-200'"
          >
            <span v-if="isActive(s)" class="opacity-70" aria-hidden="true">▶ </span>{{ s.label }}
          </span>
        </button>

      </template>
    </div>
  </div>
</template>
