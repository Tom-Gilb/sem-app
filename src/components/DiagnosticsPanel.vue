<!-- UNIT_TYPE=Panel -->
<!--
  DiagnosticsPanel.vue — r41 v335 (Tom Gilb 2026-06-24)

  In-app diagnostic surface for the PWA window where Safari Web Inspector is
  awkward to reach.  Lists every captured console.error / window.error /
  unhandledrejection with timestamp + message + collapsible stacktrace.

  Composes with CloseDot SUPREME · Single-Surface (registered via
  registerExclusiveSurface in App.vue) · ScrollContainer SUPREME · DD-009
  Zero-Training UI · No-Silent-Removal (every captured error stays until the
  planner explicitly dismisses).
-->

<script setup lang="ts">
import { ref } from 'vue'
import { useDiagnostics, type DiagnosticError } from '../composables/useDiagnostics'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const { errors, clear, dismissOne } = useDiagnostics()

function fmtTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString()
}

function typeChipClass(t: DiagnosticError['type']): string {
  switch (t) {
    case 'console.error':      return 'bg-rose-100 text-rose-800 border-rose-300'
    case 'window.error':       return 'bg-red-100 text-red-800 border-red-300'
    case 'unhandledrejection': return 'bg-amber-100 text-amber-800 border-amber-300'
  }
}

function typeLabel(t: DiagnosticError['type']): string {
  switch (t) {
    case 'console.error':      return 'console.error'
    case 'window.error':       return 'window error'
    case 'unhandledrejection': return 'promise rejection'
  }
}

// Track which stack traces are expanded (per-error toggle)
const expanded = ref<Record<string, boolean>>({})
function toggleStack(id: string): void {
  expanded.value[id] = !expanded.value[id]
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[491] flex items-start justify-center pt-3 sm:pt-6"
      aria-modal="true"
      role="dialog"
      aria-labelledby="diagnostics-panel-title"
    >
      <!-- Backdrop -->
      <div
        class="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
        @click="emit('close')"
      />

      <!-- Panel card -->
      <div
        class="relative w-full max-w-3xl max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl ring-1 ring-slate-300/60 overflow-hidden"
      >
        <!-- Header -->
        <div
          class="flex items-start gap-3 px-5 py-3 border-b border-slate-200
                 bg-gradient-to-r from-slate-700 via-slate-800 to-slate-900 text-white shrink-0"
        >
          <span class="text-xl shrink-0 mt-0.5" aria-hidden="true">🔍</span>
          <div class="flex-1 min-w-0">
            <h2 id="diagnostics-panel-title" class="text-base font-bold leading-tight">
              Diagnostics — In-App Error Console
            </h2>
            <p class="text-[11px] text-slate-200 mt-0.5">
              {{ errors.length }} {{ errors.length === 1 ? 'error' : 'errors' }} captured this session
              <span v-if="errors.length > 0"> · most recent first · persisted across page reloads</span>
            </p>
          </div>
          <button
            v-if="errors.length > 0"
            type="button"
            class="shrink-0 px-2.5 py-1 rounded-md bg-slate-700/40 hover:bg-slate-700/70
                   text-[11px] font-semibold border border-white/20
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
            title="Clear all captured diagnostic errors. Cannot be undone."
            @click="clear"
          >
            Clear All
          </button>
          <CloseDot size="lg" @close="emit('close')" />
        </div>

        <!-- Empty state -->
        <div
          v-if="errors.length === 0"
          class="flex-1 flex items-center justify-center p-10 text-slate-500 text-sm"
        >
          <div class="text-center max-w-md">
            <div class="text-4xl mb-3" aria-hidden="true">✓</div>
            <p class="font-semibold text-slate-700">No errors captured this session.</p>
            <p class="text-[12px] mt-2 text-slate-500 leading-relaxed">
              The Diagnostics panel listens for <code class="text-[11px] bg-slate-100 px-1 rounded">console.error</code>,
              <code class="text-[11px] bg-slate-100 px-1 rounded">window 'error'</code> events,
              and unhandled promise rejections.  All captured errors are persisted
              to localStorage (last 50 retained) and survive page reload.
            </p>
          </div>
        </div>

        <!-- Error list -->
        <ScrollContainer
          v-else
          outer-class="flex-1 min-h-0"
          inner-class="p-4 space-y-3"
        >
          <article
            v-for="err in errors"
            :key="err.id"
            class="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
          >
            <!-- Top row: type chip · timestamp · dismiss -->
            <header class="flex items-center gap-2 mb-2 flex-wrap">
              <span
                :class="[
                  'shrink-0 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border',
                  typeChipClass(err.type),
                ]"
              >{{ typeLabel(err.type) }}</span>
              <span class="text-[11px] text-slate-500 font-mono shrink-0">
                {{ fmtTime(err.timestamp) }}
              </span>
              <span class="text-[10px] text-slate-400 shrink-0">
                {{ fmtDate(err.timestamp) }}
              </span>
              <button
                type="button"
                class="ml-auto shrink-0 w-5 h-5 flex items-center justify-center rounded-full
                       text-slate-400 hover:text-slate-700 hover:bg-slate-100 text-xs
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                :title="`Dismiss this error from the diagnostics list`"
                :aria-label="`Dismiss error: ${err.message.substring(0, 60)}`"
                @click="dismissOne(err.id)"
              >✕</button>
            </header>

            <!-- Message body -->
            <p class="text-slate-800 font-mono text-[12px] break-words whitespace-pre-wrap leading-relaxed">
              {{ err.message }}
            </p>

            <!-- Source path (if window error) -->
            <p
              v-if="err.source"
              class="text-[10px] text-slate-500 font-mono mt-1 break-all"
            >
              at {{ err.source }}
            </p>

            <!-- Stack trace (collapsible) -->
            <div v-if="err.stack" class="mt-2">
              <button
                type="button"
                class="text-[11px] text-indigo-600 hover:underline focus:outline-none focus-visible:underline"
                :aria-expanded="!!expanded[err.id]"
                @click="toggleStack(err.id)"
              >
                {{ expanded[err.id] ? '▾ Hide stack trace' : '▸ Show stack trace' }}
              </button>
              <pre
                v-if="expanded[err.id]"
                class="mt-1 p-2 bg-slate-50 rounded text-[10px] text-slate-700 overflow-x-auto whitespace-pre border border-slate-200"
              >{{ err.stack }}</pre>
            </div>
          </article>
        </ScrollContainer>

        <!-- Footer hint -->
        <footer
          class="px-5 py-2 border-t border-slate-200 bg-slate-50 text-[10px] text-slate-500 shrink-0"
        >
          Captured types: console.error · window.error · unhandledrejection ·
          Last 50 retained · localStorage key
          <code class="bg-slate-100 px-1 rounded">sem-app:diagnostics:v1</code>
        </footer>
      </div>
    </div>
  </Teleport>
</template>
