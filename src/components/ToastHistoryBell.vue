<!-- UNIT_TYPE=Widget
  ToastHistoryBell.vue — 🔔 bell in the title bar (label "Recent messages").
  Shows unread-message count badge.  Click opens a small panel listing the
  last 20 notifications (most recent first) so the user can re-read any
  message that disappeared before they could parse it.

  File and code identifiers retain "Toast" naming for code compatibility
  (per the Banned Word `toast` SUPREME rule's code-identifier exemption,
  same pattern as `tooltip` / `useToast`).  Every USER-VISIBLE LABEL uses
  the plain-English word "message" or "notification" — never "toast".

  Tom Gilb 2026-06-22 verbatim trigger:
    "there was a n 'AI was slow....' message at bottom, far to fast and
     disappeared before I could read."
    "a second , far too fast disappearing message said something about what
     was generated"
    "I have no idea what toast means"

  Composes with:
    • universal accessibility (no reader can parse a multi-sentence
      notification in 2 seconds — recall mechanism prevents one-shot
      info loss for every user)
    • No-Silent-Data-Loss SUPREME (toast messages ARE data; making them
      ephemeral was a silent-loss surface)
    • MOVE Principle (bell visible at all times in title bar)
    • DD-009 Zero-Training UI (HoverHints spell out the bell's purpose +
      panel actions)
    • Icon-Plus-Text SUPREME (🔔 glyph + small "Recent" label / unread
      number badge)
    • CloseDot SUPREME (panel has CloseDot + backdrop-click + Esc)
-->
<template>
  <div class="relative inline-block">
    <button
      type="button"
      class="relative inline-flex items-center gap-1 h-9 px-2.5 rounded-full
             bg-white/10 text-white hover:bg-white/20 ring-1 ring-white/20
             focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300
             transition-colors"
      :title="`🔔 Recent messages (${toastHistory.length}) — click to re-read any notification that disappeared before you could parse it.${unreadCount > 0 ? '  ' + unreadCount + ' new since last open.' : ''}`"
      aria-label="Open recent messages panel"
      @click="open"
    >
      <span aria-hidden="true" class="text-base leading-none">🔔</span>
      <span class="text-[11px] font-semibold leading-none">Recent</span>
      <span
        v-if="unreadCount > 0"
        class="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-400 text-slate-900 text-[10px] font-bold flex items-center justify-center ring-2 ring-slate-900"
        aria-label="`${unreadCount} new since last open`"
      >{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
    </button>

    <!-- Backdrop + panel — Single-Surface compatible (registered if needed) -->
    <Teleport to="body">
      <div
        v-if="panelOpen"
        class="fixed inset-0 z-[700] bg-black/30"
        @click.self="close"
      ></div>
      <div
        v-if="panelOpen"
        class="fixed top-20 right-6 z-[710] w-[420px] max-w-[90vw] max-h-[70vh]
               bg-white rounded-2xl shadow-2xl ring-1 ring-slate-200
               flex flex-col overflow-hidden"
        role="dialog"
        aria-label="Recent notifications"
        @keydown.esc="close"
      >
        <header class="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
          <h3 class="text-sm font-bold text-slate-900 flex items-center gap-2">
            <span aria-hidden="true">🔔</span>
            Recent messages
            <span class="text-xs font-normal text-slate-500">(last {{ toastHistory.length }})</span>
          </h3>
          <div class="flex items-center gap-2">
            <button
              v-if="toastHistory.length > 0"
              type="button"
              class="text-[11px] text-slate-500 hover:text-rose-600 px-2 py-1 rounded transition-colors"
              title="Clear the entire recent-messages history (cannot undo)"
              @click="onClearAll"
            >Clear all</button>
            <button
              type="button"
              class="h-7 w-7 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900"
              title="Close — Esc also closes"
              aria-label="Close recent messages panel"
              @click="close"
            >×</button>
          </div>
        </header>
        <div class="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          <p v-if="toastHistory.length === 0" class="text-xs text-slate-400 italic text-center py-8">
            No recent messages yet.  Brief notifications that appear at the bottom of the screen are recorded here so you can re-read any that disappeared before you finished reading.
          </p>
          <article
            v-for="entry in toastHistory"
            :key="entry.id"
            class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
          >
            <div class="flex items-center justify-between gap-2 mb-1">
              <time class="text-[10px] font-mono text-slate-500" :datetime="new Date(entry.ts).toISOString()">
                {{ formatRelative(entry.ts) }}
              </time>
              <span class="text-[10px] text-slate-400">shown {{ Math.round(entry.durationMs / 1000) }}s</span>
            </div>
            <p class="text-xs text-slate-800 whitespace-pre-wrap leading-snug">{{ entry.message }}</p>
          </article>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useToast } from '../composables/useToast'

const { toastHistory, unreadToastCount, markToastHistoryRead, clearToastHistory } = useToast()

const panelOpen = ref(false)
const unreadCount = computed(() => unreadToastCount.value)

function open(): void {
  panelOpen.value = true
  markToastHistoryRead()
}
function close(): void {
  panelOpen.value = false
}
function onClearAll(): void {
  clearToastHistory()
  panelOpen.value = false
}
function formatRelative(ts: number): string {
  const deltaSec = Math.round((Date.now() - ts) / 1000)
  if (deltaSec < 60) return `${deltaSec}s ago`
  const deltaMin = Math.round(deltaSec / 60)
  if (deltaMin < 60) return `${deltaMin}m ago`
  const deltaHr = Math.round(deltaMin / 60)
  if (deltaHr < 24) return `${deltaHr}h ago`
  return new Date(ts).toLocaleString()
}
</script>
