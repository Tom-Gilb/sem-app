<!-- ConflictAnalysisPanel.vue — Stakeholder conflict detector panel.
     Spec: 4Sol.S.StakeholderConflictDetector / 3P.F.DetectStakeholderConflicts
     Evo Step 12.

     Takes the current SpecBlock, calls useConflictAnalysis to detect stakeholder
     conflicts, and renders them as dismissible cards with severity badges.

     Props:
       spec     — SpecBlock — current spec to analyse (required)

     Emits:
       close    — user closed the panel -->

<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import { openEml, textToEmailHtml } from '../composables/useEmlExport'
import ScrollContainer from './ScrollContainer.vue'
import CloseDot from './CloseDot.vue'
import { useConflictAnalysis, stakeholderCount } from '../composables/useConflictAnalysis'
import type { SpecBlock } from '../types/spec'
import type { Conflict } from '../composables/useConflictAnalysis'
import AmuseMeButton from './AmuseMeButton.vue'

const props = defineProps<{
  spec: SpecBlock
}>()

const emit = defineEmits<{ close: [] }>()

const { conflicts, loading, error, dismissed, analyse, dismissConflict } = useConflictAnalysis()

// Only surface conflicts that have not been dismissed
const visibleConflicts = computed(() =>
  conflicts.value.filter(c => !dismissed.value.has(c.id)),
)

// ── Severity display helpers ────────────────────────────────────────────────

const SEVERITY_BADGE: Record<string, string> = {
  high:   'bg-red-100 text-red-700 border border-red-200',
  medium: 'bg-amber-100 text-amber-700 border border-amber-200',
  low:    'bg-slate-100 text-slate-600 border border-slate-200',
}
const SEVERITY_LABEL: Record<string, string> = {
  high:   '🔴 High',
  medium: '🟡 Medium',
  low:    '⚪ Low',
}

/** Return initials (≤2 chars) for a stakeholder name, for the avatar chip. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')
}

/** Deterministic background colour for a stakeholder chip (based on name hash). */
function avatarColour(name: string): string {
  const colours = [
    'bg-violet-200 text-violet-800',
    'bg-indigo-200 text-indigo-800',
    'bg-sky-200 text-sky-800',
    'bg-emerald-200 text-emerald-800',
    'bg-rose-200 text-rose-800',
    'bg-amber-200 text-amber-800',
  ]
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return colours[h % colours.length]!
}

// ── Keyboard: Escape closes ────────────────────────────────────────────────

function _onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => {
  window.addEventListener('keydown', _onKey)
  // Auto-run analysis on mount
  analyse(props.spec)
})

// Note: window listener cleaned up by EvoSimulatorView pattern —
// using inline cleanup here avoids a separate onUnmounted import.
import { onUnmounted } from 'vue'
onUnmounted(() => window.removeEventListener('keydown', _onKey))

// ── Wow event placeholder ────────────────────────────────────────────────────

function fireWow(conflict: Conflict): void {
  // Supabase wow_events integration — next increment
  void conflict
}

// ── Copy + Email ──────────────────────────────────────────────────────────────

const copyDone = ref(false)
let _copyTimer: ReturnType<typeof setTimeout> | null = null

function buildPlainText(): string {
  const lines: string[] = [
    `Stakeholder Conflict Analysis — ${new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    '',
  ]
  visibleConflicts.value.forEach((c, i) => {
    lines.push(`CONFLICT ${i + 1}: ${c.attribute} — ${c.severity.toUpperCase()} severity`)
    lines.push(`Stakeholders: ${c.stakeholders.join(', ')}`)
    Object.entries(c.positions).forEach(([s, p]) => lines.push(`  ${s}: ${p}`))
    lines.push(`Resolution: ${c.resolution}`)
    lines.push('')
  })
  return lines.join('\n').trim()
}

async function copyAll(): Promise<void> {
  try {
    await navigator.clipboard.writeText(buildPlainText())
  } catch {
    // Clipboard API blocked — silently ignore (button still reveals Email pin)
  }
  copyDone.value = true
  if (_copyTimer) clearTimeout(_copyTimer)
  _copyTimer = setTimeout(() => { copyDone.value = false }, 12000)
}

function emailAll(): void {
  const subject = 'Stakeholder Conflict Analysis'
  const text    = buildPlainText()
  openEml(textToEmailHtml(text, subject), subject, { plainBody: text })
}
</script>

<template>
  <!-- Backdrop + modal -->
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[450] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      :aria-label="`Stakeholder Conflict Detector — ${visibleConflicts.length} conflict${visibleConflicts.length !== 1 ? 's' : ''} found`"
    >
      <!-- Backdrop -->
      <div
        class="fixed inset-0 bg-black/60 backdrop-blur-sm"
        aria-hidden="true"
        @click="emit('close')"
      />

      <!-- Panel -->
      <div
        class="relative w-full sm:max-w-2xl max-h-[95dvh]
               bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl
               border border-amber-200 flex flex-col overflow-hidden"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-amber-600 to-orange-500 flex-shrink-0 rounded-t-2xl sm:rounded-t-2xl">
          <div>
            <h2 class="text-base font-bold text-white flex items-center gap-2">
              <span aria-hidden="true">⚠</span> Stakeholder Conflict Detector
            </h2>
            <p class="text-xs text-amber-100 mt-0.5">Surfaces hidden tensions between stakeholders in your spec</p>
          </div>
          <CloseDot
        variant="on-dark"
        title="Close"
        aria-label="Close Conflict Detector"
        @click="emit('close')"
      />
        </div>

        <ScrollContainer outer-class="flex-1 min-h-0 relative" inner-class="h-full">
        <!-- Loading state -->
        <div v-if="loading" class="px-5 py-12 flex flex-col items-center gap-3" aria-live="polite" aria-busy="true">
          <div class="w-8 h-8 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin" aria-hidden="true" />
          <p class="text-sm font-medium text-slate-600">Analysing stakeholder tensions…</p>
          <p class="text-xs text-slate-400">This takes a few seconds</p>
          <!-- AmuseMeButton: conflict analysis can take 20–45s -->
          <AmuseMeButton :is-loading="loading" class="w-full mt-2" />
        </div>

        <!-- Error state -->
        <div v-else-if="error" class="px-5 py-8 flex flex-col items-center gap-3 text-center" role="alert">
          <span class="text-3xl" aria-hidden="true">⚠️</span>
          <p class="text-sm font-semibold text-red-700">Analysis failed</p>
          <p class="text-xs text-red-500">{{ error }}</p>
          <button
            type="button"
            class="mt-2 px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-semibold
                   hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors"
            @click="analyse(spec)"
          >Try again</button>
        </div>

        <!-- No conflicts state -->
        <div
          v-else-if="!loading && conflicts.length === 0"
          class="px-5 py-12 flex flex-col items-center gap-3 text-center"
        >
          <span class="text-4xl" aria-hidden="true">✅</span>
          <p class="text-sm font-semibold text-slate-700">No conflicts detected</p>
          <p class="text-xs text-slate-400">Your stakeholders appear aligned on all measured values.</p>
        </div>

        <!-- All conflicts dismissed -->
        <div
          v-else-if="!loading && conflicts.length > 0 && visibleConflicts.length === 0"
          class="px-5 py-12 flex flex-col items-center gap-3 text-center"
        >
          <span class="text-4xl" aria-hidden="true">🙈</span>
          <p class="text-sm font-semibold text-slate-700">All conflicts dismissed</p>
          <p class="text-xs text-slate-400">Refresh the spec to re-run analysis and see fresh results.</p>
        </div>

        <!-- Conflict cards -->
        <template v-else-if="!loading">
          <div class="px-5 pt-4 pb-2">
            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {{ visibleConflicts.length }} Conflict{{ visibleConflicts.length !== 1 ? 's' : '' }} Detected
            </p>
          </div>

          <div class="px-5 pb-5 space-y-4" role="list" aria-label="Stakeholder conflicts">
            <div
              v-for="conflict in visibleConflicts"
              :key="conflict.id"
              class="border border-slate-200 rounded-2xl bg-slate-50 overflow-hidden"
              role="listitem"
            >
              <!-- Card header: severity + stakeholder avatars + attribute -->
              <div class="flex items-center justify-between gap-3 px-4 pt-4 pb-3 border-b border-slate-100">
                <div class="flex items-center gap-2 flex-wrap min-w-0">
                  <!-- Severity badge -->
                  <span
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0"
                    :class="SEVERITY_BADGE[conflict.severity]"
                  >{{ SEVERITY_LABEL[conflict.severity] }}</span>

                  <!-- Stakeholder avatar chips -->
                  <span
                    v-for="name in conflict.stakeholders"
                    :key="name"
                    class="inline-flex items-center justify-center w-6 h-6 rounded-full text-[9px] font-bold flex-shrink-0"
                    :class="avatarColour(name)"
                    :title="name"
                    :aria-label="name"
                  >{{ initials(name) }}</span>

                  <!-- Attribute name -->
                  <span class="text-xs font-mono text-violet-700 truncate">{{ conflict.attribute }}</span>
                </div>

                <!-- Wow + Dismiss buttons -->
                <div class="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    class="text-lg focus:outline-none focus:ring-2 focus:ring-amber-400 rounded"
                    aria-label="This conflict is interesting"
                    title="Wow — this is insightful!"
                    @click="fireWow(conflict)"
                  >👏</button>
                  <button
                    type="button"
                    class="px-2 py-0.5 rounded-lg text-[10px] font-semibold text-slate-500 bg-slate-100
                           hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300 transition-colors"
                    :aria-label="`Dismiss conflict on ${conflict.attribute}`"
                    @click="dismissConflict(conflict.id)"
                  >Dismiss</button>
                </div>
              </div>

              <!-- Stakeholder positions (expandable) -->
              <details class="px-4 py-3">
                <summary
                  class="text-xs font-semibold text-slate-600 cursor-pointer select-none
                         hover:text-slate-800 focus:outline-none focus:text-slate-800 transition-colors list-none flex items-center gap-1"
                >
                  <span aria-hidden="true">▸</span> Positions
                </summary>
                <ul class="mt-2 space-y-2">
                  <li
                    v-for="(position, stakeholder) in conflict.positions"
                    :key="stakeholder"
                    class="flex gap-2"
                  >
                    <span
                      class="inline-flex items-center justify-center w-6 h-6 rounded-full text-[9px] font-bold flex-shrink-0 mt-0.5"
                      :class="avatarColour(stakeholder)"
                      :aria-label="stakeholder"
                    >{{ initials(stakeholder) }}</span>
                    <div>
                      <p class="text-[11px] font-semibold text-slate-700">{{ stakeholder }}</p>
                      <p class="text-xs text-slate-500 mt-0.5">{{ position }}</p>
                    </div>
                  </li>
                </ul>
              </details>

              <!-- Resolution -->
              <div class="px-4 pb-4">
                <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Proposed Resolution</p>
                <p class="text-xs text-slate-700 leading-relaxed">{{ conflict.resolution }}</p>
              </div>
            </div>
          </div>
        </template>

        <!-- Footer: copy / email / re-analyse -->
        <div
          v-if="!loading"
          class="px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap"
        >
          <p class="text-[10px] text-slate-400">
            {{ stakeholderCount(spec) }} stakeholder-level entr{{ stakeholderCount(spec) !== 1 ? 'ies' : 'y' }} in spec
          </p>

          <div class="flex items-center gap-2 flex-wrap">
            <!-- Copy button -->
            <button
              v-if="visibleConflicts.length > 0"
              type="button"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold
                     focus:outline-none focus:ring-2 focus:ring-slate-300 transition-colors"
              :class="copyDone
                ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'"
              :aria-label="copyDone ? 'Copied to clipboard' : 'Copy all conflicts to clipboard'"
              @click="copyAll"
            >
              <span aria-hidden="true">{{ copyDone ? '✓' : '📋' }}</span>
              {{ copyDone ? 'Copied' : 'Copy' }}
            </button>

            <!-- Email this — appears after copy -->
            <button
              v-if="copyDone"
              type="button"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-300
                     bg-indigo-50 text-indigo-700 text-xs font-semibold
                     hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors"
              aria-label="Email the conflict analysis"
              @click="emailAll"
            >
              <span aria-hidden="true">📧</span> Email this
            </button>

            <!-- Re-analyse -->
            <button
              type="button"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 text-xs
                     hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 transition-colors"
              aria-label="Re-analyse spec for conflicts"
              @click="analyse(spec)"
            >↺ Re-analyse</button>
          </div>
        </div>
        </ScrollContainer>
      </div>
    </div>
  </Teleport>
</template>
