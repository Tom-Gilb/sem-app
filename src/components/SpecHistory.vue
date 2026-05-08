<!-- UNIT_TYPE=Widget -->
<!-- SpecHistory — Feature #29: vertical timeline of saved SpecBlock versions -->
<!-- Feature #56: sparkline quality trend added -->

<script setup lang="ts">
import { computed } from 'vue'
import { useSpecHistory } from '../composables/useSpecHistory'
import { sparklinePoints, trendDirection, trendColour } from '../utils/sparkline'
import type { SpecBlock } from '../types/spec'

const emit = defineEmits<{
  restore: [spec: SpecBlock]
}>()

const { history, restoreVersion } = useSpecHistory()

/** Colour config keyed by label */
const labelColours: Record<string, { dot: string; badge: string }> = {
  Generated: { dot: 'bg-indigo-500', badge: 'bg-indigo-100 text-indigo-700' },
  'Make Ambitious': { dot: 'bg-pink-500', badge: 'bg-pink-100 text-pink-700' },
  'Lean Plan': { dot: 'bg-cyan-500', badge: 'bg-cyan-100 text-cyan-700' },
  Restored: { dot: 'bg-gray-400', badge: 'bg-gray-100 text-gray-600' },
}

function colours(label: string) {
  return labelColours[label] ?? { dot: 'bg-gray-400', badge: 'bg-gray-100 text-gray-600' }
}

// ── Feature #56: Spec quality score + sparkline ───────────────────────────────

/**
 * Approximate quality score for a SpecBlock (0–100).
 * Counts filled required V. fields (scale, meter, goal, tolerable)
 * and F. description fields.
 */
function scoreForVersion(spec: SpecBlock): number {
  let total = 0; let filled = 0
  for (const v of spec.values) {
    total += 4
    if (v.scale) filled++
    if (v.meter) filled++
    if (v.goal) filled++
    if (v.tolerable) filled++
  }
  for (const f of spec.functions) {
    total += 1
    if (f.description) filled++
  }
  return total === 0 ? 0 : Math.round((filled / total) * 100)
}

const historyScores = computed(() => history.value.map(v => scoreForVersion(v.spec)))
const overallTrend  = computed(() => trendDirection(historyScores.value))
const trendEmoji    = computed(() =>
  overallTrend.value === 'up' ? '📈' : overallTrend.value === 'down' ? '📉' : '→',
)

/** Score badge colour classes for a 0–100 quality score. */
function scoreBadgeStyle(score: number): string {
  if (score >= 80) return 'background:#10b981;color:#ffffff'
  if (score >= 60) return 'background:#f59e0b;color:#ffffff'
  return 'background:#ef4444;color:#ffffff'
}

/** Format timestamp: "HH:MM" for today, "DD/MM HH:MM" for older. */
function formatTs(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const time = `${hh}:${mm}`
  if (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  ) {
    return time
  }
  const dd = String(d.getDate()).padStart(2, '0')
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mo} ${time}`
}

function handleRestore(id: string): void {
  const spec = restoreVersion(id)
  if (spec) emit('restore', spec)
}
</script>

<template>
  <div class="max-h-96 overflow-y-auto divide-y divide-gray-100">

    <!-- Feature #56: Trend summary bar -->
    <div
      v-if="historyScores.length >= 2"
      class="flex items-center gap-2 px-4 py-2 bg-slate-50 border-b border-slate-100"
      aria-label="Quality score trend"
    >
      <!-- Sparkline -->
      <svg :width="80" :height="24" viewBox="0 0 80 24" aria-hidden="true">
        <polyline
          :points="sparklinePoints(historyScores, 80, 24)"
          fill="none"
          :stroke="trendColour(overallTrend)"
          stroke-width="1.5"
          stroke-linejoin="round"
          stroke-linecap="round"
        />
      </svg>
      <span class="text-xs text-slate-500">{{ trendEmoji }} Quality trend</span>
      <span
        class="ml-auto text-xs font-mono"
        :class="overallTrend === 'up' ? 'text-emerald-600' : overallTrend === 'down' ? 'text-red-500' : 'text-slate-400'"
      >
        {{ historyScores[0] }}→{{ historyScores[historyScores.length - 1] }}
      </span>
    </div>

    <!-- Empty state -->
    <p
      v-if="history.length === 0"
      class="px-4 py-6 text-sm text-gray-400 text-center"
    >
      No previous versions yet
    </p>

    <!-- Version entries -->
    <div
      v-for="(version, idx) in history"
      :key="version.id"
      class="flex items-start gap-3 px-4 py-3"
    >
      <!-- Coloured dot -->
      <span
        class="mt-1 h-2.5 w-2.5 rounded-full shrink-0"
        :class="colours(version.label).dot"
        aria-hidden="true"
      />

      <!-- Content -->
      <div class="flex-1 min-w-0 space-y-0.5">
        <div class="flex items-center gap-2 flex-wrap">
          <!-- Timestamp -->
          <span class="text-xs text-gray-400 shrink-0">{{ formatTs(version.timestamp) }}</span>
          <!-- Label badge -->
          <span
            class="text-xs rounded-full px-2 py-0.5 font-medium"
            :class="colours(version.label).badge"
          >
            {{ version.label }}
          </span>
        </div>
        <!-- Summary: "3F · 4V · 2S — first function topic" -->
        <template v-if="version.summary.includes(' — ')">
          <p class="text-xs font-mono text-indigo-700 leading-snug">
            {{ version.summary.split(' — ')[0] }}
          </p>
          <p class="text-xs text-gray-500 truncate leading-snug">
            {{ version.summary.split(' — ').slice(1).join(' — ') }}
          </p>
        </template>
        <p v-else class="text-xs font-mono text-indigo-700 leading-snug">{{ version.summary }}</p>
      </div>

      <!-- Feature #56: Quality score badge -->
      <span
        class="shrink-0 self-center inline-flex items-center justify-center rounded-full text-xs font-bold"
        style="min-width:32px;min-height:32px;font-size:10px"
        :style="scoreBadgeStyle(historyScores[idx])"
        :title="`Quality score: ${historyScores[idx]}%`"
        :aria-label="`Quality score ${historyScores[idx]}%`"
      >{{ historyScores[idx] }}</span>

      <!-- Restore button -->
      <button
        type="button"
        class="shrink-0 min-h-[44px] px-2 text-xs text-indigo-600 hover:underline
               focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
        :aria-label="`Restore version from ${formatTs(version.timestamp)}`"
        @click="handleRestore(version.id)"
      >
        Restore
      </button>
    </div>
  </div>
</template>
