<!-- BullockPanel.vue — Bullock: Audit Trail
     Full-screen modal showing every field-level change since a chosen baseline
     version of the spec. Covers sharpening rounds AND manual transforms
     (Make Ambitious, Lean Plan, Import, etc.) in a single scannable table.
     Use for QC, review, stakeholder sign-off, and change documentation.

     Props:
       spec    — current SpecBlock (live state)
       rounds  — SharpenRound[] from useSharpen
       history — SpecVersion[] from useSpecHistory (for baseline picker)
     Emits:
       close   — user dismissed the panel -->

<script setup lang="ts">
import { ref, computed } from 'vue'
import ScrollContainer from './ScrollContainer.vue'
import PlTypeBadge from './icons/PlTypeBadge.vue'
import CloseDot from './CloseDot.vue'
import { buildBullockRows, fieldLabel, type BullockRow } from '../composables/useBullock'
import { resolveIcon } from '../composables/iconRegistry'
import type { SpecBlock } from '../types/spec'
import type { SpecVersion } from '../composables/useSpecHistory'
import type { SharpenRound } from '../composables/useSharpen'

const props = defineProps<{
  spec:    SpecBlock
  rounds:  SharpenRound[]
  history: SpecVersion[]
}>()

const emit = defineEmits<{ close: [] }>()

// ── Baseline selection ────────────────────────────────────────────────────────
// Default: the oldest non-Sharpened version (i.e. the clean generation baseline).
// User can override via the dropdown.

const AUTO_SKIP_LABELS = new Set(['Sharpened'])

const autoBaselineId = computed<string | null>(() => {
  // Walk from oldest → newest to find the first clean starting point
  const oldest = [...props.history].reverse().find(v => !AUTO_SKIP_LABELS.has(v.label))
  return oldest?.id ?? props.history[props.history.length - 1]?.id ?? null
})

const selectedBaselineId = ref<string | null>(null)

const effectiveBaselineId = computed(() => selectedBaselineId.value ?? autoBaselineId.value)

const baseline = computed<SpecVersion | null>(() =>
  props.history.find(v => v.id === effectiveBaselineId.value) ?? null
)

// ── Audit rows ────────────────────────────────────────────────────────────────

const rows = computed<BullockRow[]>(() => {
  if (!baseline.value) return []
  return buildBullockRows(baseline.value, props.spec, props.rounds)
})

// Summary counts
const counts = computed(() => ({
  total:   rows.value.length,
  sharpen: rows.value.filter(r => r.changeType === 'sharpen').length,
  manual:  rows.value.filter(r => r.changeType === 'manual').length,
  added:   rows.value.filter(r => r.changeType === 'added').length,
  removed: rows.value.filter(r => r.changeType === 'removed').length,
}))

// ── Row styling ───────────────────────────────────────────────────────────────

function rowClass(row: BullockRow): string {
  switch (row.changeType) {
    case 'sharpen': return 'bg-amber-50/60 hover:bg-amber-100/60'
    case 'added':   return 'bg-emerald-50/60 hover:bg-emerald-100/60'
    case 'removed': return 'bg-red-50/60 hover:bg-red-100/60'
    default:        return 'bg-blue-50/40 hover:bg-blue-100/40'
  }
}

function badgeClass(changeType: BullockRow['changeType']): string {
  switch (changeType) {
    case 'sharpen': return 'bg-amber-100 text-amber-800'
    case 'added':   return 'bg-emerald-100 text-emerald-800'
    case 'removed': return 'bg-red-100 text-red-700'
    default:        return 'bg-blue-100 text-blue-800'
  }
}

function entryTypeBadgeClass(t: 'F' | 'V' | 'S'): string {
  if (t === 'F') return 'bg-blue-100 text-blue-700'
  if (t === 'V') return 'bg-purple-100 text-purple-700'
  return 'bg-amber-100 text-amber-700'
}

// ── Date formatting ───────────────────────────────────────────────────────────

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Copy as rich HTML table ───────────────────────────────────────────────────
// Writes text/html (coloured table) + text/plain (TSV) so it pastes beautifully
// in Mac Notes, Pages, Keynote, and Word. No Markdown ever.

const copied = ref(false)

async function copyRich(): Promise<void> {
  if (!baseline.value || rows.value.length === 0) return

  const TBL  = 'font-family:system-ui,-apple-system,sans-serif;font-size:12px;border-collapse:collapse;width:100%'
  const TH   = 'background:#1f2937;color:#fff;padding:5px 10px;text-align:left;font-size:11px;white-space:nowrap'
  const TD   = 'padding:5px 10px;border:1px solid #e5e7eb;font-size:12px;vertical-align:top'
  const TYPE_COLOUR: Record<string, string> = {
    sharpen: '#eff6ff', manual: '#f9fafb', added: '#f0fdf4', removed: '#fff1f2',
  }

  let html = `<table style="${TBL}"><thead><tr>`
  for (const h of ['#', 'Entry', 'Field', 'Before', 'After', 'Source']) {
    html += `<th style="${TH}">${h}</th>`
  }
  html += `</tr></thead><tbody>`

  const tsvRows: string[][] = [['#', 'Entry', 'Field', 'Before', 'After', 'Source']]

  for (const r of rows.value) {
    const bg = TYPE_COLOUR[r.changeType] ?? '#ffffff'
    const cells = [
      String(r.seq),
      `${r.entryId}`,
      fieldLabel(r.field),
      r.before,
      r.after,
      `${r.sourceEmoji} ${r.source}`,
    ]
    html += `<tr style="background:${bg}">`
    for (const c of cells) html += `<td style="${TD}">${c}</td>`
    html += `</tr>`
    tsvRows.push(cells)
  }
  html += `</tbody></table>`
  const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`
  const tsv = tsvRows.map(r => r.join('\t')).join('\n')

  try {
    if (typeof ClipboardItem !== 'undefined') {
      await navigator.clipboard.write([new ClipboardItem({
        'text/html':  new Blob([fullHtml], { type: 'text/html' }),
        'text/plain': new Blob([tsv],      { type: 'text/plain' }),
      })])
    } else {
      await navigator.clipboard.writeText(tsv)
    }
  } catch { try { await navigator.clipboard.writeText(tsv) } catch { /* silent */ } }
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}

// ── Expanded cell state (click to expand long text) ───────────────────────────

/** Track which `seq::before|after` cells are expanded. */
const expanded = ref(new Set<string>())

function toggleExpand(key: string): void {
  if (expanded.value.has(key)) expanded.value.delete(key)
  else expanded.value.add(key)
  // Trigger reactivity
  expanded.value = new Set(expanded.value)
}

function isExpanded(key: string): boolean {
  return expanded.value.has(key)
}

function truncate(text: string, len = 80): string {
  if (text.length <= len) return text
  return text.slice(0, len - 1) + '…'
}
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <div
      class="fixed inset-0 z-[550] bg-black/40 backdrop-blur-sm"
      aria-hidden="true"
      @click="emit('close')"
    />

    <!-- Panel -->
    <div
      class="fixed inset-0 z-[560] flex flex-col overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Bullock Audit Trail"
    >
      <div class="flex flex-col h-full w-full max-w-5xl mx-auto bg-white shadow-2xl sm:my-4 sm:rounded-2xl overflow-hidden">

        <!-- ── Header ──────────────────────────────────────────────────────── -->
        <div class="flex items-center justify-between px-5 py-3.5 bg-slate-800 flex-shrink-0">
          <div class="flex items-center gap-2.5">
            <span class="text-lg" aria-hidden="true">🗂️</span>
            <div>
              <h2 class="text-sm font-bold text-white tracking-wide">Bullock — Audit Trail</h2>
              <p class="text-[11px] text-slate-400">All field changes since the chosen baseline version</p>
            </div>
          </div>
          <CloseDot
        variant="on-dark"
        title="Close"
        aria-label="Close audit trail"
        @click="emit('close')"
      />
        </div>

        <!-- ── Baseline selector + summary bar ────────────────────────────── -->
        <div class="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-3 bg-slate-50 border-b border-slate-200 flex-shrink-0">

          <!-- Baseline picker -->
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-xs font-semibold text-slate-500 shrink-0">Since:</span>
            <select
              :value="effectiveBaselineId ?? ''"
              class="text-xs rounded-lg border border-slate-200 bg-white px-2.5 py-1.5
                     text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-slate-400
                     min-w-0 max-w-[260px] truncate"
              aria-label="Choose baseline version"
              @change="selectedBaselineId = ($event.target as HTMLSelectElement).value || null"
            >
              <option
                v-for="v in [...history].sort((a, b) => a.timestamp - b.timestamp)"
                :key="v.id"
                :value="v.id"
              >
                {{ v.label }} — {{ formatDate(v.timestamp) }}
              </option>
            </select>
          </div>

          <!-- Summary counts -->
          <div v-if="baseline" class="flex flex-wrap items-center gap-2 sm:ml-auto">
            <span
              v-if="counts.total === 0"
              class="text-xs text-slate-400 italic"
            >No changes since this baseline</span>
            <template v-else>
              <span class="text-xs text-slate-500 font-medium">{{ counts.total }} changes:</span>
              <span v-if="counts.sharpen" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-medium">
                🔪 {{ counts.sharpen }} sharpened
              </span>
              <span v-if="counts.added" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-medium">
                ➕ {{ counts.added }} added
              </span>
              <span v-if="counts.manual" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[11px] font-medium">
                ✏️ {{ counts.manual }} manual
              </span>
              <span v-if="counts.removed" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[11px] font-medium">
                🗑️ {{ counts.removed }} removed
              </span>
            </template>
          </div>
        </div>

        <!-- ── No-history guard ────────────────────────────────────────────── -->
        <div
          v-if="history.length === 0"
          class="flex-1 flex items-center justify-center px-8 py-12 text-center"
        >
          <div>
            <p class="text-3xl mb-3" aria-hidden="true">📭</p>
            <p class="text-sm font-medium text-slate-600">No version history yet</p>
            <p class="text-xs text-slate-400 mt-1">Generate a spec first — Bullock needs a baseline to compare against.</p>
          </div>
        </div>

        <!-- ── No-changes state ────────────────────────────────────────────── -->
        <div
          v-else-if="rows.length === 0"
          class="flex-1 flex items-center justify-center px-8 py-12 text-center"
        >
          <div>
            <p class="text-3xl mb-3" aria-hidden="true">✅</p>
            <p class="text-sm font-medium text-slate-600">No changes since this baseline</p>
            <p class="text-xs text-slate-400 mt-1">Try selecting an earlier version, or sharpen / transform the spec first.</p>
          </div>
        </div>

        <!-- ── Audit table ─────────────────────────────────────────────────── -->
        <ScrollContainer v-else outer-class="flex-1 min-h-0 relative" inner-class="h-full">
          <table class="w-full text-xs border-collapse">

            <!-- Sticky table header -->
            <thead class="sticky top-0 z-10">
              <tr class="bg-slate-700 text-slate-200">
                <th class="px-3 py-2.5 text-left font-semibold w-8 text-center">#</th>
                <th class="px-3 py-2.5 text-left font-semibold w-28">Change</th>
                <th class="px-3 py-2.5 text-left font-semibold w-32">Source</th>
                <th class="px-3 py-2.5 text-left font-semibold w-40">Entry</th>
                <th class="px-3 py-2.5 text-left font-semibold w-32">Field</th>
                <th class="px-3 py-2.5 text-left font-semibold">Before</th>
                <th class="px-3 py-2.5 text-left font-semibold">After</th>
              </tr>
            </thead>

            <tbody class="divide-y divide-slate-100">
              <tr
                v-for="row in rows"
                :key="row.seq"
                :class="rowClass(row)"
              >
                <!-- Seq # -->
                <td class="px-3 py-2 text-center text-slate-400 font-mono font-medium tabular-nums">
                  {{ row.seq }}
                </td>

                <!-- Change type badge -->
                <td class="px-3 py-2">
                  <span
                    :class="['inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide text-[10px] leading-none', badgeClass(row.changeType)]"
                  >
                    <component v-if="resolveIcon(row.sourceEmoji)" :is="resolveIcon(row.sourceEmoji)" size="compact" aria-hidden="true" />
                    <span v-else aria-hidden="true">{{ row.sourceEmoji }}</span>
                    {{ row.changeType }}
                  </span>
                </td>

                <!-- Source (category / transform label) -->
                <td class="px-3 py-2 text-slate-600 font-medium">
                  {{ row.source }}
                </td>

                <!-- Entry ID with type badge -->
                <td class="px-3 py-2">
                  <div class="flex items-center gap-1.5 min-w-0">
                    <!-- DD-010: colour glyph replaces text letter badge -->
                    <PlTypeBadge :entry-type="row.entryType" class="shrink-0" />
                    <span class="font-mono text-slate-700 truncate" :title="row.entryId">
                      {{ row.entryId.replace(/^[FVS]\./, '') }}
                    </span>
                  </div>
                </td>

                <!-- Field name -->
                <td class="px-3 py-2 text-slate-500 font-medium">
                  {{ fieldLabel(row.field) }}
                </td>

                <!-- Before -->
                <td class="px-3 py-2 max-w-[220px]">
                  <template v-if="row.before === '(new entry)'">
                    <span class="text-slate-300 italic">—</span>
                  </template>
                  <template v-else>
                    <button
                      type="button"
                      class="text-left text-slate-400 leading-snug hover:text-slate-600 transition-colors"
                      :aria-label="`Before: ${row.before}`"
                      @click="toggleExpand(`${row.seq}::before`)"
                    >
                      <span class="line-through decoration-slate-300">
                        {{ isExpanded(`${row.seq}::before`) ? row.before : truncate(row.before) }}
                      </span>
                      <span
                        v-if="row.before.length > 80 && !isExpanded(`${row.seq}::before`)"
                        class="ml-1 text-[10px] text-slate-400 no-underline"
                        aria-hidden="true"
                      >▸</span>
                    </button>
                  </template>
                </td>

                <!-- After -->
                <td class="px-3 py-2 max-w-[220px]">
                  <template v-if="row.after === '(removed)'">
                    <span class="text-red-400 italic font-medium">removed</span>
                  </template>
                  <template v-else>
                    <button
                      type="button"
                      class="text-left text-slate-800 font-medium leading-snug hover:text-slate-900 transition-colors"
                      :aria-label="`After: ${row.after}`"
                      @click="toggleExpand(`${row.seq}::after`)"
                    >
                      {{ isExpanded(`${row.seq}::after`) ? row.after : truncate(row.after) }}
                      <span
                        v-if="row.after.length > 80 && !isExpanded(`${row.seq}::after`)"
                        class="ml-1 text-[10px] text-slate-400"
                        aria-hidden="true"
                      >▸</span>
                    </button>
                  </template>
                </td>

              </tr>
            </tbody>
          </table>
        </ScrollContainer>

        <!-- ── Footer ──────────────────────────────────────────────────────── -->
        <div class="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex-shrink-0">
          <p class="text-[11px] text-slate-400">
            Click any Before / After cell to expand the full text. ▸ = truncated.
          </p>
          <div class="flex gap-2 flex-shrink-0">
            <!-- Copy as Markdown -->
            <button
              v-if="rows.length > 0"
              type="button"
              class="flex items-center gap-1.5 min-h-[36px] px-4 rounded-lg border border-slate-200
                     text-xs font-medium text-slate-600 bg-white hover:bg-slate-100
                     focus:outline-none focus:ring-2 focus:ring-slate-400 transition-colors"
              :aria-label="copied ? 'Copied!' : 'Copy audit trail — pastes as coloured table'"
              @click="copyRich"
            >
              <span aria-hidden="true">{{ copied ? '✅' : '📋' }}</span>
              {{ copied ? 'Copied!' : 'Copy' }}
            </button>
            <!-- Close — universal CloseDot per "Universal Close-Button Rule" -->
            <CloseDot
              aria-label="Close audit trail"
              @click="emit('close')"
            />
          </div>
        </div>

      </div>
    </div>
  </Teleport>
</template>
