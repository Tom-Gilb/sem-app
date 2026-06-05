<!-- UNIT_TYPE=Widget -->
<!--
  ExportSpecPin.vue — Single "Export Spec" action surface.

  Tom Gilb 2026-06-05 verbatim:
    "I am tempted to integrate into a single initial pin called 'Export Specs'.
     If we click the export pin then copy to clipboard is automatic, and feedback
     about that is given, if they do nothing for 20 seconds the menu fades, with
     message that the item is in the clipboard"

  Behaviour:
    1. Collapsed: a single button labelled "Export Spec" with keyed glyph [*]→*
       and a subtitle "auto-copies on click".
    2. Click → immediately emits 'copy' (App.vue runs autoCopyPlan()) + expands
       the channel menu + starts a 20-second countdown.
    3. Channel row: Email · Download · Message · Copy for Chat
       — clicking any channel emits the corresponding event and collapses.
    4. 20-second timer expires with no channel chosen → collapses and shows the
       "✓ Spec is in your clipboard" message for 2 seconds before fully hiding.

  MOVE Principle: use at both TOP and BOTTOM of any stage for mirror compliance.
  This component is self-contained (no external toasts during auto-close — App.vue
  shows its own copy toast via the 'copy' emit; the 2-second end-message is local).

  Emits:
    copy        — auto-fires on open; App.vue runs autoCopyPlan()
    email       — user chose Email channel
    download    — user chose Download channel
    message     — user chose Message / iMessage channel
    copyForChat — user chose "Copy for Chat" (plain text for AI chat apps)
-->
<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import GetGlyph     from './icons/GetGlyph.vue'
import CopyGlyph    from './icons/CopyGlyph.vue'
import EmailGlyph   from './icons/EmailGlyph.vue'
import MessageGlyph from './icons/MessageGlyph.vue'

// ── Props ─────────────────────────────────────────────────────────────────────
const props = withDefaults(defineProps<{
  /** Whether a Spec is currently loaded (gates the button). */
  hasSpec?: boolean
  /** Displayed spec name — shown in "Copied: X" feedback line. */
  specName?: string
}>(), {
  hasSpec:  false,
  specName: 'Spec',
})

const emit = defineEmits<{
  copy:        []
  email:       []
  download:    []
  message:     []
  copyForChat: []
}>()

// ── State ─────────────────────────────────────────────────────────────────────
/** 'closed' | 'open' | 'done' (2s end-message before hiding) */
const phase     = ref<'closed' | 'open' | 'done'>('closed')
const countdown = ref(20)
let   _tick:     ReturnType<typeof setInterval> | null = null
let   _doneHide: ReturnType<typeof setTimeout>  | null = null

// ── Derived ───────────────────────────────────────────────────────────────────
const isOpen = computed(() => phase.value === 'open')
const isDone = computed(() => phase.value === 'done')
/** Progress bar width 0→100 % as countdown depletes 20→0 */
const progressPct = computed(() => (countdown.value / 20) * 100)

// ── Lifecycle ─────────────────────────────────────────────────────────────────
onUnmounted(() => { clearTick(); clearDone() })

function clearTick() {
  if (_tick !== null) { clearInterval(_tick); _tick = null }
}
function clearDone() {
  if (_doneHide !== null) { clearTimeout(_doneHide); _doneHide = null }
}

// ── Core actions ──────────────────────────────────────────────────────────────
function openPin() {
  if (!props.hasSpec) return
  phase.value     = 'open'
  countdown.value = 20
  emit('copy')       // App.vue handles clipboard + toast immediately
  clearTick()
  _tick = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) autoClose()
  }, 1000)
}

function autoClose() {
  clearTick()
  phase.value = 'done'   // shows "✓ Spec is in your clipboard" for 2 seconds
  clearDone()
  _doneHide = setTimeout(() => { phase.value = 'closed' }, 2200)
}

function channelChosen(which: 'email' | 'download' | 'message' | 'copyForChat') {
  clearTick(); clearDone()
  phase.value = 'closed'
  emit(which)
}

function dismiss() {
  clearTick(); clearDone()
  phase.value = 'closed'
}
</script>

<template>
  <!-- ══════════════════════════════════════════════════════════════════════════
       CLOSED state — single "Export Spec" trigger button
       ══════════════════════════════════════════════════════════════════════════ -->
  <div v-if="phase === 'closed'" class="flex items-center">
    <button
      type="button"
      :disabled="!hasSpec"
      class="flex items-center gap-2.5 px-4 py-2.5 rounded-xl min-h-[44px]
             border-2 text-sm font-semibold transition-all duration-150 shadow-sm
             focus:outline-none focus:ring-2 focus:ring-offset-1"
      :class="hasSpec
        ? 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700 hover:border-slate-600 hover:shadow-md focus:ring-slate-500'
        : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'"
      aria-label="Export this Spec — click to auto-copy and choose a send channel"
      title="EXPORT SPEC — click to auto-copy to clipboard and choose Email · Download · Message · Chat.&#10;Auto-copies immediately on click. Channel menu stays open 20 seconds."
      @click="openPin"
    >
      <!-- Glyph: GetGlyph [*]→* encodes 'pull content out to destination' -->
      <GetGlyph size="compact" class="flex-shrink-0" :class="hasSpec ? 'text-white' : 'text-slate-400'" />
      <span class="flex flex-col items-start leading-tight">
        <span>Export Spec</span>
        <span class="text-[10px] font-normal opacity-70">auto-copies · choose channel</span>
      </span>
    </button>
  </div>

  <!-- ══════════════════════════════════════════════════════════════════════════
       OPEN state — expanded channel menu with countdown
       ══════════════════════════════════════════════════════════════════════════ -->
  <div
    v-else-if="phase === 'open'"
    class="w-full rounded-2xl border-2 border-slate-700 bg-slate-900 shadow-xl overflow-hidden"
  >
    <!-- ── Header bar: copied confirmation + countdown ──────────────────────── -->
    <div class="flex items-center justify-between gap-3 px-4 py-3 bg-slate-800 border-b border-slate-700">
      <!-- Copied confirmation -->
      <div class="flex items-center gap-2">
        <!-- Green check -->
        <span class="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center" aria-hidden="true">
          <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="2,6 5,9 10,3" />
          </svg>
        </span>
        <span class="text-[12px] font-bold text-emerald-400">Copied to clipboard</span>
        <span class="text-[11px] text-slate-400 truncate max-w-[180px]">· {{ specName }}</span>
      </div>
      <!-- Countdown + dismiss -->
      <div class="flex items-center gap-2 flex-shrink-0">
        <span class="text-[11px] font-semibold text-slate-400 tabular-nums">{{ countdown }}s</span>
        <button
          type="button"
          class="text-slate-500 hover:text-slate-300 transition-colors p-0.5 rounded focus:outline-none"
          title="Dismiss — Spec stays in clipboard"
          aria-label="Dismiss export menu"
          @click="dismiss"
        >
          <svg viewBox="0 0 14 14" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="2" y1="2" x2="12" y2="12" /><line x1="12" y1="2" x2="2" y2="12" />
          </svg>
        </button>
      </div>
    </div>

    <!-- ── Channel grid ──────────────────────────────────────────────────────── -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3">

      <!-- Email -->
      <button
        type="button"
        class="flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border-2
               border-blue-700 bg-blue-950 text-blue-300
               hover:bg-blue-900 hover:border-blue-500 hover:text-blue-200
               focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:ring-offset-slate-900
               transition-all duration-150 min-h-[80px]"
        aria-label="Email this Spec — opens Mail.app with colourful HTML ready to paste"
        title="EMAIL — opens Mail.app · colourful HTML goes on clipboard, paste with ⌘V"
        @click="channelChosen('email')"
      >
        <EmailGlyph size="compact" class="flex-shrink-0" />
        <span class="text-[12px] font-bold leading-tight text-center">Email</span>
        <span class="text-[10px] opacity-60 leading-tight text-center">Mail.app · colourful HTML</span>
      </button>

      <!-- Download -->
      <button
        type="button"
        class="flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border-2
               border-slate-600 bg-slate-800 text-slate-300
               hover:bg-slate-700 hover:border-slate-500 hover:text-slate-200
               focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-1 focus:ring-offset-slate-900
               transition-all duration-150 min-h-[80px]"
        aria-label="Download this Spec as a .txt file"
        title="DOWNLOAD — saves spec as .txt file to Downloads folder"
        @click="channelChosen('download')"
      >
        <GetGlyph size="compact" class="flex-shrink-0" />
        <span class="text-[12px] font-bold leading-tight text-center">Download</span>
        <span class="text-[10px] opacity-60 leading-tight text-center">saves .txt file</span>
      </button>

      <!-- Message / iMessage -->
      <button
        type="button"
        class="flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border-2
               border-emerald-700 bg-emerald-950 text-emerald-300
               hover:bg-emerald-900 hover:border-emerald-500 hover:text-emerald-200
               focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 focus:ring-offset-slate-900
               transition-all duration-150 min-h-[80px]"
        aria-label="Send this Spec via Apple Messages / iMessage"
        title="MESSAGE — opens Messages.app with spec in compose field · iMessage or SMS"
        @click="channelChosen('message')"
      >
        <MessageGlyph size="compact" class="flex-shrink-0" />
        <span class="text-[12px] font-bold leading-tight text-center">Message</span>
        <span class="text-[10px] opacity-60 leading-tight text-center">iMessage · SMS</span>
      </button>

      <!-- Copy for Chat -->
      <button
        type="button"
        class="flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border-2
               border-violet-700 bg-violet-950 text-violet-300
               hover:bg-violet-900 hover:border-violet-500 hover:text-violet-200
               focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-1 focus:ring-offset-slate-900
               transition-all duration-150 min-h-[80px]"
        aria-label="Copy plain text for pasting into an AI chat (Claude, ChatGPT, etc.)"
        title="COPY FOR CHAT — plain text · paste into Claude, ChatGPT, or any AI chat"
        @click="channelChosen('copyForChat')"
      >
        <CopyGlyph size="compact" class="flex-shrink-0" />
        <span class="text-[12px] font-bold leading-tight text-center">Copy for Chat</span>
        <span class="text-[10px] opacity-60 leading-tight text-center">plain text · AI / chat</span>
      </button>
    </div>

    <!-- ── Countdown progress bar ────────────────────────────────────────────── -->
    <div class="px-3 pb-3">
      <div class="h-1.5 w-full rounded-full bg-slate-700 overflow-hidden">
        <div
          class="h-full rounded-full bg-slate-500 transition-[width] duration-1000 ease-linear"
          :style="{ width: progressPct + '%' }"
        />
      </div>
      <p class="text-[10px] text-slate-500 mt-1 text-center">
        Auto-closes in {{ countdown }}s · Spec stays in clipboard
      </p>
    </div>
  </div>

  <!-- ══════════════════════════════════════════════════════════════════════════
       DONE state — 2-second "✓ Spec is in your clipboard" closing message
       ══════════════════════════════════════════════════════════════════════════ -->
  <div
    v-else
    class="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2
           border-emerald-600/40 bg-emerald-950/60 text-emerald-400
           text-sm font-semibold"
  >
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor"
         stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="8" cy="8" r="7" />
      <polyline points="4.5,8 7,10.5 11.5,5.5" />
    </svg>
    <span>Spec is in your clipboard</span>
  </div>
</template>
