<script setup lang="ts">
/**
 * IlluminationSessionEmailModal — Phase 5 of the Illumination AI design.
 *
 * Tom Gilb 2026-06-15 verbatim (Phase 5b — pick-which-to-email):
 *   *"EMAIL ME THE FOLLOWING (give a list of those things we looked at to
 *    select from)"*
 *
 * Checklist modal for the planner to tick which session events to include
 * in the email.  Defaults to ALL checked.  Composes the same colourful HTML
 * + plain fallback as "Email everything" but with the filtered subset.
 *
 * Composes with:
 *   - r41 v32 Phase 3 preferences (preferredEmailAddress)
 *   - Colorful HTML Spec Email Rule SUPREME
 *   - SEM Email Body Standard SUPREME (LOUD ⌘V cue, mailto with auto-open Mail)
 *   - Universal Undo SUPREME (email is an external action; non-undoable)
 *   - CloseDot rule (CloseDot + backdrop click + Escape)
 *   - American English Standard
 *   - HoverHint (not "tooltip")
 */

import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import CloseDot from './CloseDot.vue'
import { useToast } from '../composables/useToast'
import {
  useIlluminationSession,
  renderSessionHtml,
  renderSessionPlain,
  type SessionEvent,
} from '../composables/useIlluminationSession'

const props = defineProps<{
  open:           boolean
  recipientEmail: string
  recipientName?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'sent', payload: { count: number }): void
}>()

const { session, events, concept, duration } = useIlluminationSession()
const { showToast } = useToast()

// Which events are ticked.  Defaults to ALL checked each time the modal opens.
const _ticked = ref<Set<number>>(new Set())

watch(() => props.open, (open) => {
  if (open) {
    _ticked.value = new Set(events.value.map((_, i) => i))
  }
})

function isTicked(idx: number): boolean { return _ticked.value.has(idx) }
function toggle(idx: number): void {
  if (_ticked.value.has(idx)) _ticked.value.delete(idx)
  else _ticked.value.add(idx)
  _ticked.value = new Set(_ticked.value)
}
function checkAll(): void  { _ticked.value = new Set(events.value.map((_, i) => i)) }
function checkNone(): void { _ticked.value = new Set() }

const tickedEvents = computed<SessionEvent[]>(() => {
  return events.value.filter((_, i) => _ticked.value.has(i))
})

const tickedCount = computed(() => _ticked.value.size)

function _onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape' && props.open) {
    const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase()
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return
    emit('close')
  }
}
onMounted(() => document.addEventListener('keydown', _onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', _onKey))

// ── Send action ─────────────────────────────────────────────────────────────

async function sendNow(): Promise<void> {
  const picked = tickedEvents.value
  if (picked.length === 0) {
    showToast('Tick at least one item to email.', 3000)
    return
  }
  await sendIlluminationSessionEmail({
    events:        picked,
    conceptName:   concept.value,
    startedAt:     session.value.startedAt,
    endedAt:       session.value.endedAt,
    classification: session.value.classification,
    recipientEmail: props.recipientEmail,
    recipientName:  props.recipientName,
  })
  emit('sent', { count: picked.length })
  emit('close')
}
</script>

<script lang="ts">
/**
 * Shared send routine — also called from the picker's "📧 Email everything"
 * button (Phase 5a).  Defined OUTSIDE setup so it can be imported by any
 * caller.  Honours the SEM Email Body Standard:
 *   1. Build colourful HTML body via renderSessionHtml().
 *   2. Build plain-text fallback via renderSessionPlain().
 *   3. Write BOTH to clipboard (`text/html` + `text/plain` ClipboardItem).
 *   4. Open mailto with subject + the LOUD ⌘V cue body.
 *   5. Toast confirmation.
 */
import {
  renderSessionHtml as _renderSessionHtml,
  renderSessionPlain as _renderSessionPlain,
  type SessionEvent as _SessionEvent,
} from '../composables/useIlluminationSession'

export async function sendIlluminationSessionEmail(opts: {
  events:         _SessionEvent[]
  conceptName:    string | null
  startedAt:      number
  endedAt:        number | null
  classification: { primaryArea: string | null; suggestedTab: string | null; confidence: number } | null
  recipientEmail: string
  recipientName?: string
}): Promise<void> {
  const htmlText  = _renderSessionHtml({
    conceptName:    opts.conceptName,
    startedAt:      opts.startedAt,
    endedAt:        opts.endedAt,
    classification: opts.classification,
    events:         opts.events,
    recipientName:  opts.recipientName,
  })
  const plainText = _renderSessionPlain({
    conceptName:    opts.conceptName,
    startedAt:      opts.startedAt,
    endedAt:        opts.endedAt,
    classification: opts.classification,
    events:         opts.events,
    recipientName:  opts.recipientName,
  })

  const conceptDisplay = opts.conceptName || '(concept not named)'
  const isoDate = new Date(opts.startedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
  const subject = `💡 Illumination Session: ${conceptDisplay} · ${opts.events.length} events · ${isoDate}`
  const separator = '─'.repeat(56)
  const mailtoBody = [
    'PASTE ⌘V (CMD+V) HERE FOR COLOR VERSION',
    `Exported: ${isoDate}`,
    separator,
    '',
    `[Add a brief note here if you like — or just ⌘V to paste the colour version above the line.]`,
  ].join('\n')

  // Clipboard write (HTML + plain).
  let clipboardOK = false
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([new ClipboardItem({
        'text/html':  new Blob([htmlText],  { type: 'text/html'  }),
        'text/plain': new Blob([plainText], { type: 'text/plain' }),
      })])
      clipboardOK = true
    } catch (err) {
      console.warn('[IlluminationSession email] clipboard.write failed', err)
    }
  }
  if (!clipboardOK) {
    try { await navigator.clipboard.writeText(plainText); clipboardOK = true } catch { /* continue */ }
  }

  // Preview window — 100% of the model immediately (per Export-on-all-windows rule).
  try {
    const w = window.open('', '_blank', 'width=900,height=720,scrollbars=yes')
    if (w) { w.document.open(); w.document.write(htmlText); w.document.close() }
  } catch (err) {
    console.warn('[IlluminationSession email] preview window failed', err)
  }

  // mailto: open Mail
  const recipient = opts.recipientEmail || 'Tom@Gilb.com'
  const href = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(mailtoBody)}`
  window.location.href = href
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[2100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ill-session-email-title"
    >
      <!-- Backdrop -->
      <div
        class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        @click="emit('close')"
      ></div>

      <!-- Modal -->
      <div
        class="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden border-2 border-violet-200"
        @click.stop
      >
        <!-- Header -->
        <header class="px-5 py-3 border-b-2 border-violet-200 bg-gradient-to-r from-violet-50 via-amber-50 to-orange-50 flex items-center gap-2 shrink-0">
          <span class="text-2xl">📧</span>
          <div class="flex-1 min-w-0">
            <h2 id="ill-session-email-title" class="text-base font-extrabold text-slate-800 leading-tight">
              Email the following…
            </h2>
            <p class="text-[11px] text-slate-600 leading-tight mt-0.5 truncate">
              Tick which session items to include in the email to <strong>{{ recipientEmail }}</strong> · {{ events.length }} total events captured for <strong>"{{ concept || '(concept not named)' }}"</strong>
            </p>
          </div>
          <CloseDot size="lg" aria-label="Close Email-the-following modal" @click="emit('close')" />
        </header>

        <!-- Action bar -->
        <div class="px-5 py-2 border-b border-slate-200 bg-slate-50 shrink-0 flex items-center gap-2 flex-wrap">
          <button
            type="button"
            class="px-2 py-1 text-[11px] rounded bg-white border border-slate-300 hover:bg-slate-100"
            title="Tick all events — same as 📧 Email everything"
            @click="checkAll"
          >✓ All</button>
          <button
            type="button"
            class="px-2 py-1 text-[11px] rounded bg-white border border-slate-300 hover:bg-slate-100"
            title="Untick all events — manually pick which to include"
            @click="checkNone"
          >☐ None</button>
          <span class="text-[11px] text-slate-600 ml-2">
            <strong>{{ tickedCount }}</strong> of <strong>{{ events.length }}</strong> selected
          </span>
        </div>

        <!-- Event list -->
        <div class="flex-1 min-h-0 overflow-y-auto px-5 py-3 space-y-1">
          <div v-if="events.length === 0" class="text-center py-12 text-sm text-slate-500 italic">
            No session events captured yet.  Open ⌘I, type a concept, explore a few tabs — then return here.
          </div>
          <label
            v-for="(ev, idx) in events"
            :key="idx"
            class="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-violet-50 cursor-pointer border border-transparent hover:border-violet-200"
          >
            <input
              type="checkbox"
              :checked="isTicked(idx)"
              class="mt-0.5"
              :title="`Tick to include this event in the email to ${recipientEmail}`"
              @change="toggle(idx)"
            />
            <div class="flex-1 min-w-0">
              <div class="text-xs font-bold text-slate-800 truncate">{{ ev.label }}</div>
              <div class="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5 flex-wrap">
                <span class="font-mono">{{ Math.floor(ev.timestamp / 60000) }}:{{ String(Math.floor((ev.timestamp / 1000) % 60)).padStart(2, '0') }}</span>
                <span class="text-violet-700 font-semibold">{{ ev.kind }}</span>
                <a
                  v-if="ev.twinUrl"
                  :href="ev.twinUrl"
                  target="_blank"
                  rel="noopener"
                  class="text-violet-700 hover:underline"
                  title="Open this concept on Tom Gilb Consultant Twin"
                  @click.stop
                >↗ Twin</a>
              </div>
            </div>
          </label>
        </div>

        <!-- Footer -->
        <footer class="px-5 py-3 border-t border-slate-200 bg-slate-50 shrink-0 flex items-center gap-2 flex-wrap">
          <span class="text-[10px] text-slate-500 italic flex-1">
            Session duration so far: <strong>{{ Math.floor(duration / 60000) }}:{{ String(Math.floor((duration / 1000) % 60)).padStart(2, '0') }}</strong>
          </span>
          <button
            type="button"
            class="px-3 py-1 rounded-md text-[12px] font-semibold text-slate-700 hover:bg-slate-100 border border-slate-300 bg-white"
            title="Close without sending"
            @click="emit('close')"
          >Cancel</button>
          <button
            type="button"
            class="px-3 py-1.5 rounded-md text-[12px] font-bold text-white bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 disabled:cursor-not-allowed shadow"
            :disabled="tickedCount === 0"
            :title="tickedCount === 0 ? 'Tick at least one event to send.' : `Send ${tickedCount} event${tickedCount === 1 ? '' : 's'} as a colourful HTML email to ${recipientEmail} — SEM Email Body Standard.`"
            @click="sendNow"
          >📧 Send {{ tickedCount }} event{{ tickedCount === 1 ? '' : 's' }}</button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>
