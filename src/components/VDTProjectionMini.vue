<!-- UNIT_TYPE=Widget -->
<!--
/**
 * VDTProjectionMini — renders an idea's VDT/IET projection as a compact
 * inline table within an improvement-idea card.
 *
 * Tom Gilb 2026-06-03: *"Give options in terms of VDT/IET"*.
 *
 * Each row = one Value with its projected impact (0-100 normally; Skunkworks
 * ideas may project >100 to signal "blows past the V. Goal").  Footer row
 * shows projected calendar weeks + capital $k — the IET cost line.
 *
 * Reuses the traffic-light colour scheme from utils/impactColour so the
 * mini-VDT visually matches the full V × Step VDT and ImpactEstimationView.
 *
 * Pure prop in, no state, no events.  Twin-portable.
 */
-->
<script setup lang="ts">
import type { VDTProjection } from '../data/evoStepImprovement'
import { getImpactColour } from '../utils/impactColour'

defineProps<{
  projection: VDTProjection
}>()

/** Cell background tint, matching ImpactEstimationView's boldCellBg() logic.
 *  Values >100 (Skunkworks "blows past Goal") get the strongest green tint. */
function cellBg(value: number): string {
  if (value === 0) return '#ffffff'
  if (value < 0) return '#fca5a5'
  if (value >= 100) return '#4ade80'   // bright green — past Goal
  if (value >= 80) return '#86efac'
  if (value >= 60) return '#bbf7d0'
  if (value >= 30) return '#fde68a'
  return '#fecaca'
}

function cellStyle(value: number): string {
  return [
    `background:${cellBg(value)}`,
    'color:#0f172a',
    `border-left:3px solid ${getImpactColour(Math.min(value, 100))}`,
  ].join(';')
}
</script>

<template>
  <div class="my-2 rounded-lg border border-slate-200 bg-slate-50/60 overflow-hidden text-[11px]">
    <header class="px-2.5 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
      <span aria-hidden="true">📊</span>
      <span>VDT / IET projection</span>
    </header>
    <table class="w-full border-collapse">
      <tbody>
        <tr
          v-for="(impact, valueRef) in projection.valueImpacts"
          :key="valueRef"
          class="border-b border-slate-100"
        >
          <td class="px-2.5 py-1 text-slate-700 font-medium">{{ valueRef }}</td>
          <td
            class="px-2.5 py-1 text-right font-bold w-20"
            :style="cellStyle(impact)"
          >{{ impact }}</td>
        </tr>
      </tbody>
      <tfoot class="bg-indigo-50/60">
        <tr>
          <td class="px-2.5 py-1 text-right text-indigo-700 font-semibold text-[10px] uppercase tracking-wide">Calendar (wks)</td>
          <td class="px-2.5 py-1 text-right font-bold text-indigo-800">{{ projection.calendarWeeks }}</td>
        </tr>
        <tr>
          <td class="px-2.5 py-1 text-right text-indigo-700 font-semibold text-[10px] uppercase tracking-wide">Capital ($k)</td>
          <td class="px-2.5 py-1 text-right font-bold text-indigo-800">{{ projection.capitalK }}</td>
        </tr>
      </tfoot>
    </table>
  </div>
</template>
