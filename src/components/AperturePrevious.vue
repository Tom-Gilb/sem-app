<script setup lang="ts">
// UNIT_TYPE=Vue Component
// AperturePrevious — Ultra Light Phase 3 "Previous Plan" dedicated surface.
//
// Tom 2026-05-14: *"Previous Plan Menu: re-open one of your saved plans."*
//
// What you see:
//   • Same full-viewport white canvas as Aperture.vue.
//   • A centered, scrollable list of all saved plan models, newest-first.
//   • Each row: plan name · version badge · last-saved relative time ·
//     "Resume →" button.
//   • Empty state: a gentle message with a "Start one →" link to Plan.
//   • "← Plan" ghost link top-left returns to the naked aperture.
//
// Design notes:
//   • List uses ScrollContainer so the fade-edge cue renders when the list
//     is taller than the visible area.
//   • The row click (anywhere on the row, not just the button) calls 'load'.
//   • Version badge is slate-100 / text-slate-500 — unobtrusive, informative.
//   • Relative date (e.g. "2 days ago") uses a tiny Intl.RelativeTimeFormat
//     helper — no external dependency.
//
// Emits:
//   load      — PlanModel to resume (App.vue calls handleRestoreModel)
//   go-plan   — return to naked aperture

import { computed } from 'vue'
import { useSpecModel, type PlanModel } from '../composables/useSpecModel'
import ScrollContainer from './ScrollContainer.vue'

const emit = defineEmits<{
  load:      [model: PlanModel]
  'go-plan': []
}>()

const { allModels } = useSpecModel()

// ── Relative-time helper ─────────────────────────────────────────────────────
function relativeTime(isoOrDate: string | Date | null | undefined): string {
  if (!isoOrDate) return ''
  try {
    const then  = new Date(isoOrDate as string)
    const nowMs = Date.now()
    const diffS = Math.round((then.getTime() - nowMs) / 1000)
    const rtf   = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

    const abs = Math.abs(diffS)
    if (abs < 60)     return rtf.format(diffS,             'second')
    if (abs < 3600)   return rtf.format(Math.round(diffS / 60),   'minute')
    if (abs < 86400)  return rtf.format(Math.round(diffS / 3600),  'hour')
    if (abs < 604800) return rtf.format(Math.round(diffS / 86400), 'day')
    return then.toLocaleDateString('en', { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

const models = computed<ReadonlyArray<PlanModel>>(() => allModels.value)

function resume(model: PlanModel): void {
  emit('load', model)
}
</script>

<template>
  <!--
    Fixed full-viewport white canvas. z-[350] same tier as Aperture.vue.
  -->
  <div
    class="fixed inset-0 z-[350] bg-white flex flex-col items-center"
    aria-label="Previous Plan — resume a saved plan"
  >
    <!-- ← Plan ghost link top-left -->
    <button
      type="button"
      class="absolute top-4 left-4 text-xs text-slate-400 hover:text-slate-700 transition z-10"
      @click="emit('go-plan')"
      aria-label="Return to Plan aperture"
    >
      ← Plan
    </button>

    <!-- Header (fixed, not inside scroll) -->
    <div class="w-full max-w-lg px-4 pt-16 pb-4 flex-none">
      <p class="text-xl font-light text-slate-700 tracking-tight select-none">Previous Plans</p>
      <p class="mt-1 text-sm text-slate-400 select-none">
        {{ models.length }} saved
        <template v-if="models.length !== 1">plans</template>
        <template v-else>plan</template>
      </p>
    </div>

    <!-- Scrollable list -->
    <div class="w-full max-w-lg flex-1 min-h-0 px-4 pb-8">
      <!-- Empty state -->
      <div
        v-if="models.length === 0"
        class="flex flex-col items-center justify-center h-full gap-4 select-none"
      >
        <p class="text-sm text-slate-400">No saved plans yet.</p>
        <button
          type="button"
          class="text-sm text-slate-500 underline underline-offset-2 hover:text-slate-800 transition"
          @click="emit('go-plan')"
          aria-label="Return to Plan aperture and start a plan"
        >
          Start one →
        </button>
      </div>

      <!-- Plan list -->
      <ScrollContainer
        v-else
        outer-class="relative flex-1 min-h-0 h-full"
        :no-pill="true"
      >
        <ul class="flex flex-col gap-2" role="list">
          <li
            v-for="model in models"
            :key="model.id"
            class="
              flex items-center justify-between gap-4
              px-4 py-3 rounded-xl
              ring-1 ring-slate-200 hover:ring-slate-400
              bg-white hover:bg-slate-50
              transition-all cursor-pointer group
              select-text
            "
            @click="resume(model)"
            role="listitem"
            :aria-label="`Resume plan: ${model.name}`"
          >
            <!-- Left: name + meta -->
            <div class="min-w-0">
              <p class="text-sm font-medium text-slate-800 truncate">{{ model.name || 'Untitled plan' }}</p>
              <div class="flex items-center gap-2 mt-0.5">
                <!-- Version badge -->
                <span
                  class="inline-block px-1.5 py-px rounded text-[10px] font-mono bg-slate-100 text-slate-500 select-none"
                  aria-label="Version"
                >v{{ model.version }}</span>
                <!-- Relative time -->
                <span class="text-[11px] text-slate-400">
                  {{ relativeTime(model.updatedAt ?? model.createdAt) }}
                </span>
                <!-- Owner names if any -->
                <span
                  v-if="model.owners && model.owners.length > 0"
                  class="text-[11px] text-slate-400 truncate"
                >
                  · {{ model.owners.map(o => o.name).filter(Boolean).join(', ') }}
                </span>
              </div>
            </div>

            <!-- Right: Resume button -->
            <button
              type="button"
              class="
                flex-none text-xs font-medium px-3 py-1.5 rounded-full
                ring-1 ring-slate-200 group-hover:ring-slate-800
                text-slate-500 group-hover:text-slate-900
                bg-white group-hover:bg-slate-800 group-hover:text-white
                transition-all
              "
              @click.stop="resume(model)"
              :aria-label="`Resume ${model.name}`"
            >
              Resume →
            </button>
          </li>
        </ul>
      </ScrollContainer>
    </div>
  </div>
</template>
