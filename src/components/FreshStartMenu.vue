<!--
  FreshStartMenu.vue — graduated reset menu (formerly "Start Over").

  Replaces the bare 🆘 Reset pill at bottom-left with a 4-option popover so
  the user picks the level of "starting over" they actually want. Without
  this menu the single button reads as "total reset and delete" even though
  panicReset() actually does something much milder; users hesitate to press
  it.

  Tom 2026-05-14 ratified the design (see vault Start-Over-Design.md):
    1. 🆕 Blank Canvas             — back up current, clear live spec, home form
    2. *→[*] Save This and Stop    — snapshot current, idle (no clearing)
       (option 2 specifically uses the SaveGlyph keyed icon per Tom: "No
        floppy icon, use new save icon")
    3. [*]→[ ] Cancel Recent Changes › — rollback with time-bound sub-card
       (option 3 uses the new CancelEmptyGlyph that Tom suggested:
        "Cancel symbol suggestion [*] -> [ ]")
    4. 🚪 Just close stuck UI       — today's panicReset() (no data touched)

  Trigger pill stays 🆘 in all states per Tom: "keep the sos".

  Universal rules honoured:
    • CloseDot at END of menu header
    • ScrollContainer wraps any region that could overflow (the time-bound
      sub-card's body)
    • Single-surface: registered exclusive via App.vue
    • Pops UPWARD from the trigger pill (Tom: "Up sounds ok, try")
    • Define-by-Selection works on all text inside (no select-none on body,
      no pointer-events-none blanket, modal z-tier = 480 < SelectionDefiner
      z-700)

  Emits (App.vue handles them inline using existing functions):
    fresh-canvas    — back up current, clear live spec, go to home form
    save-and-stop   — snapshot current, idle (close menu, do nothing else)
    rollback        — emits {ts: number} of the target snapshot timestamp
    close-stuck-ui  — call existing panicReset()
    close           — user dismissed the menu without choosing
-->
<script setup lang="ts">
import { ref, computed } from 'vue'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'
import SaveGlyph from './icons/SaveGlyph.vue'
import CancelEmptyGlyph from './icons/CancelEmptyGlyph.vue'
import type { SpecVersion } from '../composables/useSpecHistory'
import {
  sessionStartedAt,
  countChangesSince,
  findNearestSnapshotAtOrBefore,
  formatChangeCount,
} from '../composables/useFreshStart'

const props = defineProps<{
  /** Reactive ref of the Spec History list — used to size the change counts
   *  and to map "Last hour / This session / Very beginning" to a concrete
   *  rollback target snapshot. */
  history: ReadonlyArray<SpecVersion>
  /** True when the menu should be visible. Parent owns the open/close ref
   *  so the menu can register with the exclusive-surface rule. */
  open: boolean
}>()

const emit = defineEmits<{
  'fresh-canvas': []
  'save-and-stop': []
  /** Target snapshot timestamp. App.vue's rollback handler should:
   *    (1) snapshot current spec as "Pre-rollback at HH:MM" backup copy,
   *    (2) call onHistoryRestore() on the snapshot at this timestamp. */
  rollback: [ts: number]
  /** Wraps existing panicReset(): close panels + clear stuck spinners. */
  'close-stuck-ui': []
  close: []
}>()

// Two-card flow: the main 4-option list, or the Cancel Recent Changes sub-card.
const view = ref<'main' | 'cancel'>('main')

// Selected time bound in the sub-card.
type TimeBound = 'hour' | 'session' | 'beginning'
const selectedBound = ref<TimeBound>('hour')

// Compute the ms-epoch threshold for each bound.
const hourAgoTs = computed(() => Date.now() - 60 * 60 * 1000)
const sessionTs = computed(() => sessionStartedAt)
const beginningTs = computed(() => 0)  // 0 = match every history entry

function thresholdFor(b: TimeBound): number {
  if (b === 'hour') return hourAgoTs.value
  if (b === 'session') return sessionTs.value
  return beginningTs.value
}

// Change counts shown next to each radio.
const changesLastHour = computed(() => countChangesSince(hourAgoTs.value, props.history))
const changesThisSession = computed(() => countChangesSince(sessionTs.value, props.history))
const changesAll = computed(() => countChangesSince(beginningTs.value, props.history))

// The target snapshot the chosen bound would roll back to.
const targetSnapshot = computed(() =>
  findNearestSnapshotAtOrBefore(thresholdFor(selectedBound.value), props.history),
)

function close(): void {
  view.value = 'main'
  emit('close')
}

function pickFreshCanvas(): void {
  emit('fresh-canvas')
  view.value = 'main'
}

function pickSaveAndStop(): void {
  emit('save-and-stop')
  view.value = 'main'
}

function openCancelSubcard(): void {
  view.value = 'cancel'
}

function pickStuckUi(): void {
  emit('close-stuck-ui')
  view.value = 'main'
}

function confirmRollback(): void {
  if (!targetSnapshot.value) return
  emit('rollback', targetSnapshot.value.timestamp)
  view.value = 'main'
}
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop — transparent click target. Pressing it closes the menu.
         z-[479] sits BELOW the menu card (z-[480]) but above other surfaces
         so a wayward click outside the menu doesn't pass through to a panel
         underneath. -->
    <div
      v-if="open"
      class="fixed inset-0 z-[619] bg-black/0"
      aria-hidden="true"
      @click="close"
    />

    <!-- Menu card — anchored top-right, drops DOWN from the 🆘 SOS button
         in the Plan Crest bar (which is now in the Row 1 absolute-right
         cluster). The crest bar is ~100px; we open at top-[110px] so the
         card appears just below the bar with a small gap. -->
    <div
      v-if="open"
      class="fixed right-4 top-[110px] z-[620] w-[20rem]
             rounded-2xl bg-white shadow-2xl ring-1 ring-black/10
             overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Fresh Start menu"
    >
      <!-- ── Header (red gradient — emergency-exit identity) ────────────── -->
      <div
        class="flex items-center gap-2 px-4 py-3
               bg-gradient-to-r from-red-600 via-red-700 to-rose-700 text-white"
      >
        <!-- Back arrow appears only on the sub-card. -->
        <button
          v-if="view === 'cancel'"
          type="button"
          class="text-white/80 hover:text-white text-base font-bold leading-none px-1 -ml-1
                 focus:outline-none focus:ring-2 focus:ring-white/70 rounded"
          aria-label="Back to Fresh Start menu"
          title="Back"
          @click="view = 'main'"
        >‹</button>
        <span class="text-sm" aria-hidden="true">🆘</span>
        <span class="flex-1 text-sm font-bold tracking-wide">
          {{ view === 'main' ? 'Fresh Start' : 'Cancel Recent Changes' }}
        </span>
        <CloseDot
          variant="on-dark"
          aria-label="Close Fresh Start menu"
          @click="close"
        />
      </div>

      <!-- ── Body: MAIN — 4 graduated options ───────────────────────────── -->
      <ScrollContainer
        v-if="view === 'main'"
        outer-class="relative"
        inner-class="divide-y divide-slate-100"
        inner-style="max-height: 60vh"
        :no-pill="true"
      >
        <!-- 1. Blank Canvas -->
        <button
          type="button"
          class="w-full flex items-start gap-3 px-4 py-3 text-left
                 hover:bg-emerald-50 focus:bg-emerald-50 focus:outline-none
                 transition-colors"
          @click="pickFreshCanvas"
        >
          <span class="text-xl leading-none mt-0.5 shrink-0" aria-hidden="true">🆕</span>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-slate-800">Blank Canvas</p>
            <p class="text-[11px] text-slate-500 leading-snug mt-0.5">
              Save the current plan to History as a backup copy, then clear
              the live spec and return to the empty home form. Your old work
              is preserved.
            </p>
          </div>
        </button>

        <!-- 2. Save This and Stop (uses SaveGlyph per Tom: "No floppy icon
             use new save icon") -->
        <button
          type="button"
          class="w-full flex items-start gap-3 px-4 py-3 text-left
                 hover:bg-amber-50 focus:bg-amber-50 focus:outline-none
                 transition-colors"
          @click="pickSaveAndStop"
        >
          <span class="mt-0.5 shrink-0 text-amber-700" aria-hidden="true">
            <SaveGlyph size="compact" class="h-4 w-auto" />
          </span>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-slate-800">Save This and Stop</p>
            <p class="text-[11px] text-slate-500 leading-snug mt-0.5">
              Take a backup copy of the current plan into History, then leave
              the app idle. Nothing is cleared — your spec stays on screen,
              ready when you come back.
            </p>
          </div>
        </button>

        <!-- 3. Cancel Recent Changes — opens sub-card (uses CancelEmptyGlyph
             per Tom: "Cancel symbol suggestion [*] -> [ ]") -->
        <button
          type="button"
          class="w-full flex items-start gap-3 px-4 py-3 text-left
                 hover:bg-violet-50 focus:bg-violet-50 focus:outline-none
                 transition-colors"
          @click="openCancelSubcard"
        >
          <span class="mt-0.5 shrink-0 text-violet-700" aria-hidden="true">
            <CancelEmptyGlyph size="compact" class="h-4 w-auto" />
          </span>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-2">
              <p class="text-sm font-semibold text-slate-800">Cancel Recent Changes</p>
              <span class="text-slate-300 text-sm" aria-hidden="true">›</span>
            </div>
            <p class="text-[11px] text-slate-500 leading-snug mt-0.5">
              Roll the live spec back to an earlier snapshot. A backup copy
              of the current spec is saved first, so this is always undoable.
            </p>
          </div>
        </button>

        <!-- 4. Just close stuck UI — today's panicReset behaviour -->
        <button
          type="button"
          class="w-full flex items-start gap-3 px-4 py-3 text-left
                 hover:bg-slate-100 focus:bg-slate-100 focus:outline-none
                 transition-colors"
          @click="pickStuckUi"
        >
          <span class="text-xl leading-none mt-0.5 shrink-0" aria-hidden="true">🚪</span>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-slate-800">Just close stuck UI</p>
            <p class="text-[11px] text-slate-500 leading-snug mt-0.5">
              Emergency exit: close every open panel and clear any stuck
              spinner. <strong>No data is touched.</strong> Press this if
              the UI is frozen.
            </p>
          </div>
        </button>
      </ScrollContainer>

      <!-- ── Body: CANCEL sub-card — time-bound picker ──────────────────── -->
      <div v-else class="px-4 py-4">
        <p class="text-[12px] text-slate-700 leading-relaxed mb-3">
          Discard <strong>every</strong> change made after the chosen moment.
          Your current spec will be replaced with the one from that moment.
          <strong>A backup copy of your current spec is saved first</strong>,
          so this rollback can itself be undone from History.
        </p>

        <fieldset class="space-y-2.5">
          <legend class="sr-only">Roll back to</legend>

          <!-- Last hour -->
          <label
            class="flex items-start gap-2.5 px-3 py-2 rounded-lg cursor-pointer
                   border transition-colors"
            :class="selectedBound === 'hour'
              ? 'bg-violet-50 border-violet-300'
              : 'bg-white border-slate-200 hover:bg-slate-50'"
          >
            <input
              v-model="selectedBound"
              type="radio"
              value="hour"
              class="mt-1 accent-violet-600"
              aria-label="Roll back to one hour ago"
            />
            <div class="flex-1 min-w-0">
              <p class="text-[13px] font-semibold text-slate-800">Last hour</p>
              <p class="text-[11px] text-slate-500 leading-snug">
                {{ formatChangeCount(changesLastHour) }} since
                {{ new Date(hourAgoTs).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) }}
              </p>
            </div>
          </label>

          <!-- This session -->
          <label
            class="flex items-start gap-2.5 px-3 py-2 rounded-lg cursor-pointer
                   border transition-colors"
            :class="selectedBound === 'session'
              ? 'bg-violet-50 border-violet-300'
              : 'bg-white border-slate-200 hover:bg-slate-50'"
          >
            <input
              v-model="selectedBound"
              type="radio"
              value="session"
              class="mt-1 accent-violet-600"
              aria-label="Roll back to the start of this session"
            />
            <div class="flex-1 min-w-0">
              <p class="text-[13px] font-semibold text-slate-800">This session</p>
              <p class="text-[11px] text-slate-500 leading-snug">
                {{ formatChangeCount(changesThisSession) }} since you opened
                the app
              </p>
            </div>
          </label>

          <!-- Very beginning -->
          <label
            class="flex items-start gap-2.5 px-3 py-2 rounded-lg cursor-pointer
                   border transition-colors"
            :class="selectedBound === 'beginning'
              ? 'bg-violet-50 border-violet-300'
              : 'bg-white border-slate-200 hover:bg-slate-50'"
          >
            <input
              v-model="selectedBound"
              type="radio"
              value="beginning"
              class="mt-1 accent-violet-600"
              aria-label="Roll back to the very beginning"
            />
            <div class="flex-1 min-w-0">
              <p class="text-[13px] font-semibold text-slate-800">Very beginning</p>
              <p class="text-[11px] text-slate-500 leading-snug">
                {{ formatChangeCount(changesAll) }} stored in this plan's
                history
              </p>
            </div>
          </label>
        </fieldset>

        <!-- Target snapshot preview / not-found message -->
        <div v-if="targetSnapshot" class="mt-3 px-3 py-2 rounded-lg bg-slate-50 ring-1 ring-slate-200">
          <p class="text-[11px] text-slate-500 leading-snug">
            Will restore: <strong class="text-slate-800">{{ targetSnapshot.planName || targetSnapshot.label || 'snapshot' }}</strong>
            from {{ new Date(targetSnapshot.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) }}
          </p>
        </div>
        <div v-else class="mt-3 px-3 py-2 rounded-lg bg-amber-50 ring-1 ring-amber-200">
          <p class="text-[11px] text-amber-700 leading-snug">
            No snapshot exists at or before this moment. Save a version first
            (Save This and Stop, or use the History panel's Save button)
            before attempting a rollback.
          </p>
        </div>

        <!-- Actions -->
        <div class="mt-4 flex items-center gap-2 justify-end">
          <button
            type="button"
            class="px-3 py-2 rounded-lg text-[12px] font-semibold text-slate-600
                   hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400"
            @click="view = 'main'"
          >
            Back
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg
                   text-[12px] font-semibold transition-colors
                   bg-violet-600 text-white hover:bg-violet-700
                   focus:outline-none focus:ring-2 focus:ring-violet-400
                   disabled:opacity-40 disabled:cursor-not-allowed"
            :disabled="!targetSnapshot"
            @click="confirmRollback"
          >
            <CancelEmptyGlyph size="compact" class="h-3.5 w-auto" />
            <span>Roll back</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
