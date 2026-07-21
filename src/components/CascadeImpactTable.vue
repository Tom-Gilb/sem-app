<!-- UNIT_TYPE=Widget
  CascadeImpactTable.vue — Two-section structured table of cascade changes and consequences.

  Tom Gilb 2026-06-10: "I would love to END UP WITH, 1. A TABLE WITH CHANGES
    AND CONSEQUENCES (HYPOTHETICALLY, AND WHEN CHANGES LOCKED IN)"

  Sections:
    Locked-In    — pendingChanges already applied (not yet versioned), red theme
    Hypothetical — whatIfChanges predicted before Apply Changes, orange theme

  Used inside Cascade Ripple Panel in PentaPanel.vue.
-->
<template>
  <!-- r93m (Tom Gilb 2026-06-11 "5 texts are far too small to be read at all"). Per
       accessibility_tom.md (Tom is 85): text-sm (14px) baseline for body content; chips/labels
       lifted from 8-10px → 11-12px. Column widths bumped to handle the larger glyphs without
       wrapping. -->
  <div class="overflow-x-auto text-[13px]">

    <!-- Locked-In section -->
    <div v-if="pendingImpacts.length > 0" class="mb-3">
      <div class="flex items-center gap-1.5 mb-1.5">
        <span class="relative flex h-2.5 w-2.5 shrink-0">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-70"/>
          <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"/>
        </span>
        <span class="font-bold uppercase tracking-wide text-red-700 text-[12px]">
          Locked-In: {{ pendingChanges.length }} change{{ pendingChanges.length !== 1 ? 's' : '' }}
          → {{ pendingImpacts.length }} consequence{{ pendingImpacts.length !== 1 ? 's' : '' }}
        </span>
      </div>

      <table class="w-full min-w-[760px] border-collapse">
        <thead>
          <tr class="bg-red-100 text-[11px] uppercase tracking-wide text-red-900">
            <th class="px-2 py-1.5 border border-red-200 text-center font-bold w-[44px]" title="Direction of change: + (value went up) · − (down) · ↻ (non-numeric)">±</th>
            <th class="px-2 py-1.5 border border-red-200 text-left font-bold min-w-[120px]">Changed</th>
            <th class="px-2 py-1.5 border border-red-200 text-left font-bold min-w-[140px]">Field · Before → After</th>
            <th class="px-2 py-1.5 border border-red-200 text-left font-bold min-w-[92px]">Order</th>
            <th class="px-2 py-1.5 border border-red-200 text-left font-bold min-w-[140px]">Consequence For</th>
            <th class="px-2 py-1.5 border border-red-200 text-left font-bold">Impact Description</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="impact in pendingImpacts"
            :key="impact.id"
            class="bg-white even:bg-red-50/60 hover:bg-red-100/70 transition-colors"
          >
            <!-- Direction (Tom Gilb 2026-06-11 r92: "+ or -" indicator) -->
            <td class="px-2 py-2 border border-red-100 align-top text-center">
              <span
                class="inline-flex items-center justify-center w-7 h-7 rounded-full font-black text-[16px]"
                :class="dirCellClass(directionFor(impact, pendingChanges))"
                :title="dirTitle(directionFor(impact, pendingChanges))"
              >{{ directionFor(impact, pendingChanges) }}</span>
            </td>
            <!-- Changed entry — r41 v234: render mnemonic Tag, not raw V1/V2 id -->
            <td class="px-2 py-2 border border-red-100 align-top">
              <div class="flex flex-col gap-0.5">
                <span class="text-[11px] font-bold uppercase tracking-wide" :class="typeColor(changeFor(impact, pendingChanges)?.itemType ?? '')">
                  {{ changeFor(impact, pendingChanges)?.itemType ?? '—' }}
                </span>
                <span
                  class="font-semibold text-slate-800 break-all leading-snug text-[13px]"
                  :title="`Tag: ${_tagFor(impact, pendingChanges)} · raw id: ${impact.causeItemId}`"
                >{{ _tagFor(impact, pendingChanges) }}</span>
              </div>
            </td>
            <!-- Field + before → after -->
            <td class="px-2 py-2 border border-red-100 align-top">
              <div class="flex flex-col gap-0.5">
                <span class="font-semibold text-slate-700 capitalize text-[13px]">{{ impact.causeField }}</span>
                <span class="text-[12px] font-mono text-slate-600 break-all leading-snug">
                  {{ clip(changeFor(impact, pendingChanges)?.before ?? '—', 20) }}
                  <span class="text-slate-400 mx-0.5">→</span>
                  {{ clip(changeFor(impact, pendingChanges)?.after ?? '—', 20) }}
                </span>
              </div>
            </td>
            <!-- Order -->
            <td class="px-2 py-2 border border-red-100 align-top">
              <span
                class="inline-flex items-center px-2 py-0.5 rounded-full font-bold text-[11px] whitespace-nowrap"
                :class="orderBadge(impact.order, 'locked')"
                :title="orderExplain(impact.order)"
              >{{ impact.order }}</span>
            </td>
            <!-- Consequence for -->
            <td class="px-2 py-2 border border-red-100 align-top">
              <div class="flex flex-col gap-0.5">
                <span class="text-[11px] font-bold uppercase tracking-wide" :class="typeColor(impact.effectItemType.toLowerCase())">
                  {{ impact.effectItemType }}
                </span>
                <span class="font-mono text-slate-800 break-all leading-snug text-[13px]" :title="impact.effectItemLabel">
                  {{ clip(impact.effectItemLabel, 28) }}
                </span>
              </div>
            </td>
            <!-- Impact description -->
            <td class="px-2 py-2 border border-red-100 align-top text-slate-700 leading-relaxed text-[13px]" :title="impact.impactDescription">
              {{ clip(impact.impactDescription, 120) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Hypothetical section — r93m: same font-size bumps as Locked-In section above. -->
    <div v-if="whatIfImpacts.length > 0">
      <div class="flex items-center gap-1.5 mb-1.5">
        <span class="relative flex h-2.5 w-2.5 shrink-0">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-300 opacity-60"/>
          <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-400"/>
        </span>
        <span class="font-bold uppercase tracking-wide text-orange-700 text-[12px]">
          Hypothetical (if you apply current edits): {{ whatIfChanges.length }} edit{{ whatIfChanges.length !== 1 ? 's' : '' }}
          → {{ whatIfImpacts.length }} predicted consequence{{ whatIfImpacts.length !== 1 ? 's' : '' }}
        </span>
      </div>

      <table class="w-full min-w-[760px] border-collapse">
        <thead>
          <tr class="bg-orange-100 text-[11px] uppercase tracking-wide text-orange-900">
            <th class="px-2 py-1.5 border border-orange-200 text-center font-bold w-[44px]" title="Direction of change: + (value going up) · − (down) · ↻ (non-numeric)">±</th>
            <th class="px-2 py-1.5 border border-orange-200 text-left font-bold min-w-[120px]">Would Change</th>
            <th class="px-2 py-1.5 border border-orange-200 text-left font-bold min-w-[140px]">Field · Before → After</th>
            <th class="px-2 py-1.5 border border-orange-200 text-left font-bold min-w-[92px]">Order</th>
            <th class="px-2 py-1.5 border border-orange-200 text-left font-bold min-w-[140px]">Would Affect</th>
            <th class="px-2 py-1.5 border border-orange-200 text-left font-bold">Predicted Impact</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="impact in whatIfImpacts"
            :key="impact.id"
            class="bg-white even:bg-orange-50/60 hover:bg-orange-100/70 transition-colors"
          >
            <!-- Direction (Tom Gilb 2026-06-11 r92) -->
            <td class="px-2 py-2 border border-orange-100 align-top text-center">
              <span
                class="inline-flex items-center justify-center w-7 h-7 rounded-full font-black text-[16px]"
                :class="dirCellClass(directionFor(impact, whatIfChanges))"
                :title="dirTitle(directionFor(impact, whatIfChanges))"
              >{{ directionFor(impact, whatIfChanges) }}</span>
            </td>
            <td class="px-2 py-2 border border-orange-100 align-top">
              <div class="flex flex-col gap-0.5">
                <span class="text-[11px] font-bold uppercase tracking-wide" :class="typeColor(changeFor(impact, whatIfChanges)?.itemType ?? '')">
                  {{ changeFor(impact, whatIfChanges)?.itemType ?? '—' }}
                </span>
                <span
                  class="font-semibold text-slate-800 break-all leading-snug text-[13px]"
                  :title="`Tag: ${_tagFor(impact, whatIfChanges)} · raw id: ${impact.causeItemId}`"
                >{{ _tagFor(impact, whatIfChanges) }}</span>
              </div>
            </td>
            <td class="px-2 py-2 border border-orange-100 align-top">
              <div class="flex flex-col gap-0.5">
                <span class="font-semibold text-slate-700 capitalize text-[13px]">{{ impact.causeField }}</span>
                <span class="text-[12px] font-mono text-slate-600 break-all leading-snug">
                  {{ clip(changeFor(impact, whatIfChanges)?.before ?? '—', 20) }}
                  <span class="text-slate-400 mx-0.5">→</span>
                  {{ clip(changeFor(impact, whatIfChanges)?.after ?? '—', 20) }}
                </span>
              </div>
            </td>
            <td class="px-2 py-2 border border-orange-100 align-top">
              <span
                class="inline-flex items-center px-2 py-0.5 rounded-full font-bold text-[11px] whitespace-nowrap"
                :class="orderBadge(impact.order, 'whatsif')"
                :title="orderExplain(impact.order)"
              >{{ impact.order }}</span>
            </td>
            <td class="px-2 py-2 border border-orange-100 align-top">
              <div class="flex flex-col gap-0.5">
                <span class="text-[11px] font-bold uppercase tracking-wide" :class="typeColor(impact.effectItemType.toLowerCase())">
                  {{ impact.effectItemType }}
                </span>
                <span class="font-mono text-slate-800 break-all leading-snug text-[13px]" :title="impact.effectItemLabel">
                  {{ clip(impact.effectItemLabel, 28) }}
                </span>
              </div>
            </td>
            <td class="px-2 py-2 border border-orange-100 align-top text-slate-700 leading-relaxed italic text-[13px]" :title="impact.impactDescription">
              {{ clip(impact.impactDescription, 120) }}
            </td>
          </tr>
        </tbody>
      </table>
      <p class="text-[11px] text-orange-700 italic mt-1.5">
        Predictions computed live from current edits — orange rings on the pentagon mark these entries.
      </p>
    </div>

    <!-- Empty -->
    <div v-if="!pendingImpacts.length && !whatIfImpacts.length" class="text-center text-slate-400 italic py-4 text-[13px]">
      No cascade consequences detected.
    </div>

  </div>
</template>

<script setup lang="ts">
import type { PentaFieldChange, CascadeImpact, CascadeOrder } from '../types/pentaGovernance'
// r41 v234 (Tom Gilb 2026-06-20 verbatim "the Tags of the Planguage specs
// seem missin right side?  New Bug") — Mnemonic ID Standard SUPREME: the
// raw `V1`/`V2`/etc. IDs must be displayed via mnemonicLabel(), which
// converts CamelCase → words and falls back to the first 2 significant
// words of the description when the ID is V1/F1-style.  Composes with
// Planguage Mnemonic ID Standard SUPREME (CLAUDE.md).
import { mnemonicLabel } from '../composables/usePenta'

function _tagFor(impact: CascadeImpact, changes: PentaFieldChange[]): string {
  // Prefer the populated label (r41 v234 propagation); fall back to the
  // change.itemLabel from the live change set; final fallback = bare id.
  const lbl = impact.causeItemLabel
    ?? changes.find(c => c.itemId === impact.causeItemId)?.itemLabel
    ?? ''
  return mnemonicLabel(impact.causeItemId, lbl)
}

defineProps<{
  pendingChanges: PentaFieldChange[]
  pendingImpacts: CascadeImpact[]
  whatIfChanges:  PentaFieldChange[]
  whatIfImpacts:  CascadeImpact[]
}>()

function clip(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s
}

function changeFor(impact: CascadeImpact, changes: PentaFieldChange[]): PentaFieldChange | undefined {
  return (
    changes.find(c => c.itemId === impact.causeItemId && c.field === impact.causeField) ??
    changes.find(c => c.itemId === impact.causeItemId)
  )
}

function typeColor(type: string): string {
  const map: Record<string, string> = {
    value: 'text-violet-600', solution: 'text-orange-600',
    resource: 'text-purple-600', function: 'text-green-600', constraint: 'text-red-600',
  }
  return map[type] ?? 'text-slate-500'
}

function orderBadge(order: CascadeOrder, mode: 'locked' | 'whatsif'): string {
  if (mode === 'locked') {
    if (order === 'direct')    return 'bg-red-100 text-red-700'
    if (order === '2nd-order') return 'bg-orange-100 text-orange-700'
    return 'bg-amber-100 text-amber-700'
  }
  if (order === 'direct')    return 'bg-orange-100 text-orange-700'
  if (order === '2nd-order') return 'bg-amber-100 text-amber-700'
  return 'bg-yellow-100 text-yellow-700'
}

function orderExplain(order: CascadeOrder): string {
  if (order === 'direct')    return 'Direct: this entry is immediately affected by the changed field'
  if (order === '2nd-order') return '2nd-order: affected via an intermediate element (e.g. Value change → Solution redesign → Resource cost)'
  return 'nth-order: downstream propagation (e.g. Resource budget cut → Solution descoped → Value delivery at risk)'
}

/** Direction of the change that produced this impact (Tom Gilb 2026-06-11 r92:
 *  "Flashing green look good, what if we added + or - to it?"). + = numeric value
 *  went UP, − = down, ↻ = non-numeric change (Scale unit, Meter method swap). */
function directionFor(impact: CascadeImpact, changes: PentaFieldChange[]): '+' | '−' | '↻' {
  const c = changeFor(impact, changes)
  if (!c) return '↻'
  const b = parseFloat(c.before)
  const a = parseFloat(c.after)
  if (isNaN(b) || isNaN(a)) return '↻'
  if (a > b) return '+'
  if (a < b) return '−'
  return '↻'
}

// r93o (Tom Gilb 2026-06-11: "no I do not like the transition to blue. Emerald is fine for me,
// I am weak RG colorblind, not strong"). REVERTED r93n's blue switch. The lesson to bank:
// R/G colourblindness is a SPECTRUM, not a binary — Tom is on the weak end and can read green
// vs red fine when the badges are large enough + contrasted enough (the r93m size bump from
// 8 px → 11 px badge font + 16 px direction glyph carries the green signal cleanly). For
// STRONG R/G colourblind users, blue/red remains the canonical substitute — but that's a
// future user-config knob, not a hardcoded default. For Tom: emerald-600 (semantic = up =
// positive) is correct AND readable at the post-r93m size. Future Claudians: when adding
// colour-coded state, ask which severity of colourblindness the specific user has BEFORE
// reaching for blue. Don't assume strong R/G. Solid bg + white text + ring still applies
// (the luminance contrast principle from r93d is universal regardless of hue choice).
function dirCellClass(d: '+' | '−' | '↻'): string {
  if (d === '+') return 'bg-emerald-600 text-white ring-1 ring-emerald-800'
  if (d === '−') return 'bg-red-600 text-white ring-1 ring-red-900'
  return 'bg-slate-500 text-white ring-1 ring-slate-700'
}

function dirTitle(d: '+' | '−' | '↻'): string {
  if (d === '+') return 'Value went UP (positive direction) — budget raised, goal increased, status grew, etc.'
  if (d === '−') return 'Value went DOWN (negative direction) — budget cut, goal lowered, status decreased, etc.'
  return 'Non-numeric change (Scale unit or Meter method swap) — direction has no sign'
}
</script>
