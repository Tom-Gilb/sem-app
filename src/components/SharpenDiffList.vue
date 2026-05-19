<!-- SharpenDiffList.vue — Renders the before/after diff for one or more sharpening rounds.
     Used by SharpenPanel in both its inline and modal variants to avoid template duplication.

     For each round it shows:
       • Category emoji + label + entry count (the sharpening source)
       • Per changed entry:
           - Entry type badge (F. / V. / S.) + ID + NEW or CHANGED status badge
           - Added entries: all fields shown in emerald
           - Modified entries: only changed fields, each with old text (struck) → new text (amber) -->

<script setup lang="ts">
import type { SharpenRound } from '../composables/useSharpen'

defineProps<{
  rounds: SharpenRound[]
}>()

// Human-readable labels for content fields only.
// Implementation/linking fields (id, type, level, *OfValue, function) are
// intentionally excluded — they are metadata not useful to the user in a diff.
const FIELD_LABELS: Record<string, string> = {
  description:     'Description',
  successCriteria: 'Success criteria',
  scale:           'Scale',
  meter:           'Meter',
  status:          'Status',
  tolerable:       'Tolerable',
  goal:            'Goal',
  impact:          'Impact',
  wish:            'Wish',
}

// Fields that should never appear in the diff — metadata and linking fields.
const SKIP_FIELDS = new Set(['id', 'type', 'level', 'functionOfValue', 'valueOfFunction', 'function'])

function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key
}
</script>

<template>
  <div
    v-for="r in rounds"
    :key="r.category.key + '-diff'"
    class="px-3 pt-3 pb-2"
  >
    <!-- Round header: source of sharpening -->
    <p class="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1.5 flex-wrap">
      <span aria-hidden="true">{{ r.category.emoji }}</span>
      <span>{{ r.category.label }}</span>
      <span class="text-amber-300" aria-hidden="true">·</span>
      <span class="font-normal text-amber-500">
        <template v-if="r.changes.length === 0">no changes detected</template>
        <template v-else>
          {{ r.changes.length }} {{ r.changes.length === 1 ? 'entry' : 'entries' }} changed
        </template>
      </span>
    </p>

    <p
      v-if="r.changes.length === 0"
      class="text-xs text-slate-400 italic mb-1"
    >
      The spec was not structurally changed by this round.
    </p>

    <ul v-else class="space-y-2">
      <li
        v-for="c in r.changes"
        :key="c.id"
        class="rounded-lg border overflow-hidden text-xs"
        :class="c.status === 'added' ? 'border-emerald-200' : 'border-amber-200'"
      >
        <!-- Entry header row -->
        <div
          class="flex items-center gap-2 px-2.5 py-1.5"
          :class="c.status === 'added' ? 'bg-emerald-50' : 'bg-amber-50'"
        >
          <!-- F. / V. / S. type badge -->
          <span
            class="flex-shrink-0 font-mono text-[9px] font-black px-1.5 py-0.5 rounded leading-none"
            :class="{
              'bg-blue-100 text-blue-700':     c.entryType === 'F',
              'bg-purple-100 text-purple-700': c.entryType === 'V',
              'bg-amber-100 text-amber-700':   c.entryType === 'S',
            }"
            :aria-label="`${c.entryType === 'F' ? 'Function' : c.entryType === 'V' ? 'Value' : 'Solution'} entry`"
          >{{ c.entryType }}.</span>

          <!-- Entry ID -->
          <span class="font-mono font-semibold text-slate-700 truncate flex-1 min-w-0">{{ c.id }}</span>

          <!-- Cause / sharpening dimension badge -->
          <span
            class="flex-shrink-0 flex items-center gap-0.5 text-[9px] font-semibold text-slate-500 bg-slate-100 rounded px-1.5 py-0.5 leading-none whitespace-nowrap"
            :title="`Sharpening cause: ${r.category.label}`"
            :aria-label="`Caused by ${r.category.label} sharpening`"
          >
            <span aria-hidden="true">{{ r.category.emoji }}</span>
            <span>{{ r.category.label }}</span>
          </span>

          <!-- Status badge -->
          <span
            class="flex-shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded leading-none uppercase tracking-wide"
            :class="c.status === 'added'
              ? 'bg-emerald-600 text-white'
              : 'bg-amber-500 text-white'"
          >{{ c.status === 'added' ? 'New' : 'Changed' }}</span>
        </div>

        <!-- ── Added entry: show content fields in emerald (metadata fields skipped) ── -->
        <div
          v-if="c.status === 'added'"
          class="px-2.5 py-2 space-y-2 bg-white"
        >
          <div
            v-for="(val, field) in c.after"
            v-show="!SKIP_FIELDS.has(String(field))"
            :key="field"
          >
            <p class="text-[9px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5">
              {{ fieldLabel(field) }}
            </p>
            <p class="bg-emerald-50 text-emerald-800 rounded px-2 py-1.5 leading-snug">
              {{ val || '—' }}
            </p>
          </div>
        </div>

        <!-- ── Modified entry: only changed content fields (metadata fields skipped) ── -->
        <div
          v-else-if="c.changedFields.filter(f => !SKIP_FIELDS.has(f)).length > 0"
          class="px-2.5 py-2 space-y-3 bg-white"
        >
          <div
            v-for="field in c.changedFields.filter(f => !SKIP_FIELDS.has(f))"
            :key="field"
          >
            <p class="text-[9px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
              {{ fieldLabel(field) }}
            </p>
            <!-- Before (old wording) -->
            <p
              class="bg-slate-100 text-slate-400 rounded px-2 py-1.5 leading-snug line-through mb-1"
              :aria-label="`Previous ${fieldLabel(field)}`"
            >
              {{ c.before?.[field] || '—' }}
            </p>
            <!-- After (new wording) -->
            <p
              class="bg-amber-50 text-amber-800 font-medium rounded px-2 py-1.5 leading-snug"
              :aria-label="`Updated ${fieldLabel(field)}`"
            >
              {{ c.after[field] || '—' }}
            </p>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>
