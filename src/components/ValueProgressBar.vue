<!-- UNIT_TYPE=Widget -->
<!-- ValueProgressBar — Change 1: inline horizontal progress bar for V. entries -->
<!-- Shows Status → Tolerable → Wish on a single axis with coloured zones. -->
<!-- "Wish" = stakeholder aspiration (Planguage *244); becomes Goal only after approval. -->
<!-- Direction: inferred from values (Status > Wish = lower-is-better). -->
<!-- Zones: red (Status to Tolerable), amber (Tolerable to Wish), violet (beyond Wish). -->
<template>
  <div
    class="space-y-1"
    :aria-label="`Progress: Status ${statusNum !== null ? statusNum : status}, Tolerable ${tolerableNum !== null ? tolerableNum : tolerable || 'n/a'}, Wish ${goalNum !== null ? goalNum : goal}`"
  >
    <!-- Label row -->
    <div class="flex items-center justify-between text-xs text-slate-500">
      <span>Progress</span>
      <span class="text-xs font-medium" :class="directionClass">{{ directionLabel }}</span>
    </div>

    <!-- Bar container -->
    <div
      class="relative h-4 w-full rounded-full bg-slate-100 overflow-hidden"
      role="img"
      :aria-label="ariaLabel"
    >
      <!-- Only render zones when all three are numeric -->
      <template v-if="hasNumeric">
        <!-- Red zone: Status → Tolerable (if lower-is-better: right-to-left portion) -->
        <div
          class="absolute top-0 h-full rounded-full bg-red-400"
          :style="redZoneStyle"
          aria-hidden="true"
        />
        <!-- Amber zone: Tolerable → Goal -->
        <div
          class="absolute top-0 h-full bg-amber-400"
          :style="amberZoneStyle"
          aria-hidden="true"
        />
        <!-- Green zone: beyond Goal -->
        <div
          class="absolute top-0 h-full bg-emerald-400"
          :style="greenZoneStyle"
          aria-hidden="true"
        />

        <!-- Status pin (current position marker) -->
        <div
          class="absolute top-0 h-full w-0.5 bg-slate-700 z-10"
          :style="{ left: `${statusPct}%` }"
          :title="`Status: ${statusNum}`"
          aria-hidden="true"
        />
        <!-- Status label -->
        <span
          class="absolute top-0 h-full flex items-center text-[10px] font-bold text-slate-700 z-10 pl-1"
          :style="{ left: `${Math.min(statusPct, 85)}%` }"
          aria-hidden="true"
        >📍</span>
      </template>

      <!-- Fallback: non-numeric — show a muted bar -->
      <div
        v-else
        class="absolute top-0 left-0 h-full w-full rounded-full bg-slate-200 flex items-center justify-center"
        aria-hidden="true"
      >
        <span class="text-[9px] text-slate-400">non-numeric scale</span>
      </div>
    </div>

    <!-- Marker labels row: Status / Tolerable / Wish -->
    <div v-if="hasNumeric" class="flex justify-between text-[10px] text-slate-500 mt-0.5 px-0.5">
      <span>📍 {{ formatValue(statusNum!) }}</span>
      <span v-if="tolerableNum !== null">🟡 {{ formatValue(tolerableNum) }}</span>
      <span>⭐ {{ formatValue(goalNum!) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * ValueProgressBar
 *
 * Accepts Status, Tolerable (optional), and Goal as raw Planguage strings.
 * Extracts the first number from each string for axis positioning.
 * Infers direction: lower-is-better when Status > Goal; higher-is-better otherwise.
 *
 * Axis: spans from min(0, goalNum) to max(statusNum, tolerableNum, goalNum) × 1.1 for headroom.
 * Zones painted left-to-right regardless of direction — the colour semantics convey direction:
 *   - Red covers the gap between Status and Tolerable (the "must fix" zone)
 *   - Amber covers the gap between Tolerable and Goal (the "improving" zone)
 *   - Green extends beyond Goal (the "achieved" zone)
 */
import { computed } from 'vue'

const props = defineProps<{
  /** Raw Planguage Status string, e.g. "35%" or "Status [2026] 35%" */
  status: string
  /** Raw Planguage Tolerable string (optional) */
  tolerable: string
  /** Raw Planguage Goal string */
  goal: string
}>()

/** Extract the first number (int or decimal) from a Planguage value string. */
function parseNum(s: string): number | null {
  if (!s) return null
  const m = s.match(/[\d]+(?:\.\d+)?/)
  return m ? parseFloat(m[0]) : null
}

/** Format a number for display — strip trailing zeros, max 2 decimals. */
function formatValue(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(2).replace(/\.?0+$/, '')
}

const statusNum = computed(() => parseNum(props.status))
const tolerableNum = computed(() => parseNum(props.tolerable))
const goalNum = computed(() => parseNum(props.goal))

/** True when at least Status and Goal are parseable as numbers. */
const hasNumeric = computed(() =>
  statusNum.value !== null && goalNum.value !== null,
)

/**
 * Direction inference: if Status > Goal, lower values are better (e.g. % late delivery).
 * If Status < Goal, higher values are better (e.g. % on time).
 */
const lowerIsBetter = computed(() => {
  if (!hasNumeric.value) return false
  return statusNum.value! > goalNum.value!
})

const directionLabel = computed(() =>
  lowerIsBetter.value ? '↓ lower is better' : '↑ higher is better',
)

const directionClass = computed(() =>
  lowerIsBetter.value ? 'text-emerald-600' : 'text-blue-600',
)

/** The full axis range: 0 to max value × 1.1 for visual headroom. */
const axisMax = computed(() => {
  if (!hasNumeric.value) return 100
  const vals = [statusNum.value!, goalNum.value!]
  if (tolerableNum.value !== null) vals.push(tolerableNum.value)
  const raw = Math.max(...vals)
  return raw <= 0 ? 100 : raw * 1.1
})

const axisMin = computed(() => 0)

/** Convert a value to a percentage position on the axis (0–100%). */
function toPct(n: number): number {
  const range = axisMax.value - axisMin.value
  if (range === 0) return 0
  return Math.max(0, Math.min(100, ((n - axisMin.value) / range) * 100))
}

const statusPct = computed(() =>
  hasNumeric.value ? toPct(statusNum.value!) : 0,
)
const tolerablePct = computed(() =>
  tolerableNum.value !== null ? toPct(tolerableNum.value) : null,
)
const goalPct = computed(() =>
  hasNumeric.value ? toPct(goalNum.value!) : 0,
)

/**
 * Zone styles.
 * For lower-is-better (e.g. 35% → 15% → 5%):
 *   Red zone:   from goalPct → tolerablePct  (worst end)
 *   Amber zone: from tolerablePct → goalPct  (middle)
 *   Green zone: from 0 → goalPct             (achieved)
 *
 * For higher-is-better (e.g. 35% → 65% → 90%):
 *   Red zone:   from statusPct → tolerablePct (or 0 → statusPct)
 *   Amber zone: from tolerablePct → goalPct
 *   Green zone: from goalPct → 100%
 *
 * Implementation paints zones from left (0%) to right (100%).
 */
const redZoneStyle = computed(() => {
  if (!hasNumeric.value) return {}
  if (lowerIsBetter.value) {
    // Red from the left edge up to tolerablePct (or statusPct if no tolerable)
    const end = tolerablePct.value ?? statusPct.value
    return { left: '0%', width: `${end}%` }
  } else {
    // Red from 0 up to statusPct
    return { left: '0%', width: `${statusPct.value}%` }
  }
})

const amberZoneStyle = computed(() => {
  if (!hasNumeric.value) return {}
  if (lowerIsBetter.value) {
    // Amber from tolerablePct to goalPct (smaller values = better)
    const start = tolerablePct.value ?? goalPct.value
    const width = Math.max(0, start - goalPct.value)
    return { left: `${goalPct.value}%`, width: `${width}%` }
  } else {
    // Amber from statusPct to goalPct
    const width = Math.max(0, goalPct.value - statusPct.value)
    return { left: `${statusPct.value}%`, width: `${width}%` }
  }
})

const greenZoneStyle = computed(() => {
  if (!hasNumeric.value) return {}
  if (lowerIsBetter.value) {
    // Green: 0 to goalPct (the "achieved" left side)
    return {}
    // (no green fill for lower-is-better — goal side is already green by colour context)
  } else {
    // Green from goalPct to 100%
    const width = Math.max(0, 100 - goalPct.value)
    return { left: `${goalPct.value}%`, width: `${width}%` }
  }
})

const ariaLabel = computed(() => {
  if (!hasNumeric.value) return 'Non-numeric scale — no chart available'
  const dir = lowerIsBetter.value ? 'lower is better' : 'higher is better'
  return `Progress bar. ${dir}. Status: ${statusNum.value}, Tolerable: ${tolerableNum.value ?? 'n/a'}, Goal: ${goalNum.value}`
})
</script>
