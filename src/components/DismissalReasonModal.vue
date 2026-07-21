<script setup lang="ts">
/**
 * DismissalReasonModal — Universal Dismissal Audit Trail UI surface.
 *
 * Tom Gilb verbatim 2026-06-14:
 *   "If a fix is dismissed... We need to ask 1. why?, 2. On whose authority
 *    (default, Owner), and then to Log, in the plan documentation, all
 *    dismissals (to learn, man and machine)"
 *
 * Used by every SEM Agent surface that has a Dismiss button — Elon,
 * Incorruptible, Sharpen, Strategy, future agents.  Opens a small modal that
 * captures:
 *   (1) WHY — required free-text reason with AI-suggested quick-pick chips
 *   (2) AUTHORITY — dropdown (Owner default + Planner / Scribe / Stakeholder /
 *       Other), with free-text name field appearing for Stakeholder / Other
 *
 * Emits `confirm({ reason, authority, authorityName })` on submit.
 * Emits `cancel` on Cancel / Esc / backdrop click.
 *
 * Composes with:
 *   - Universal Undo SUPREME (caller wires recordDismissal + undo entry)
 *   - No-Silent-Data-Loss SUPREME (the modal forces explicit reason capture)
 *   - SEM teaches sound planning engineering INCREMENTALLY (the modal teaches
 *     "every No has a Why and an Authority")
 *   - CloseDot rule (red dot at top-right; click-outside; Esc; per rule audit
 *     2026-06-14 — CloseDot emits 'click', not :on-close)
 *   - American English Standard
 *   - HoverHint (not "tooltip")
 *   - DD-009 Interaction Disclosure (every affordance has a title attribute)
 *   - DD-017 Color-on-Background (red text on white; emerald confirm on white)
 *   - Tom's accessibility baseline (text-sm minimum; generous hit targets)
 */

import { ref, computed, watch, nextTick } from 'vue'
import CloseDot from './CloseDot.vue'
import {
  QUICK_PICK_REASONS,
  DISMISSAL_AUTHORITY_META,
  type DismissalAuthority,
} from '../types/dismissal'

interface ConfirmPayload {
  reason: string
  authority: DismissalAuthority
  authorityName: string | undefined
}

const props = withDefaults(defineProps<{
  open: boolean
  /** One-line: what the finding said. Shown at top so user remembers what they're rejecting. */
  findingSummary: string
  /** One-line: what the proposed Planguage fix was. Shown alongside the finding. */
  fixSummary?: string
  /** Default authority pre-selected on open. Tom verbatim: "default, Owner". */
  defaultAuthority?: DismissalAuthority
  /** Optional Plan-Owner name to display under the dropdown for the 'owner' choice. */
  ownerName?: string
}>(), {
  fixSummary: '',
  defaultAuthority: 'owner',
  ownerName: '',
})

const emit = defineEmits<{
  (e: 'confirm', payload: ConfirmPayload): void
  (e: 'cancel'): void
}>()

const reason        = ref('')
const authority     = ref<DismissalAuthority>('owner')
const authorityName = ref('')
const reasonTextarea = ref<HTMLTextAreaElement | null>(null)

const needsAuthorityName = computed(() =>
  authority.value === 'stakeholder' || authority.value === 'other',
)

const canConfirm = computed(() => {
  if (reason.value.trim().length < 3) return false
  if (needsAuthorityName.value && authorityName.value.trim().length < 1) return false
  return true
})

// Reset state every time the modal opens
watch(() => props.open, async (open) => {
  if (open) {
    reason.value        = ''
    authority.value     = props.defaultAuthority
    authorityName.value = ''
    await nextTick()
    reasonTextarea.value?.focus()
  }
})

function onQuickPick(text: string): void {
  // Append (with separator) if the user has already typed something; else replace
  if (reason.value.trim()) {
    reason.value = `${reason.value.trim()} · ${text}`
  } else {
    reason.value = text
  }
  reasonTextarea.value?.focus()
}

function onConfirm(): void {
  if (!canConfirm.value) return
  emit('confirm', {
    reason: reason.value.trim(),
    authority: authority.value,
    authorityName: needsAuthorityName.value ? authorityName.value.trim() : undefined,
  })
}

function onCancel(): void {
  emit('cancel')
}

function onKey(e: KeyboardEvent): void {
  if (!props.open) return
  if (e.key === 'Escape') {
    e.stopPropagation()
    onCancel()
  }
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canConfirm.value) {
    // ⌘+Enter = confirm
    e.preventDefault()
    onConfirm()
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('keydown', onKey, true)
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[1900] bg-slate-900/65 backdrop-blur-sm flex items-center justify-center p-4"
      @click.self="onCancel"
    >
      <div
        class="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden border-2 border-rose-300"
        @click.stop
      >
        <!-- HEADER -->
        <header class="flex items-center gap-3 px-5 py-3 border-b-2 border-rose-200 bg-gradient-to-r from-rose-50 via-amber-50 to-rose-50 shrink-0">
          <span class="text-2xl">✕</span>
          <div class="min-w-0 flex-1">
            <h2 class="text-base font-extrabold text-rose-800 leading-tight">
              Dismiss this finding?
            </h2>
            <p class="text-[11px] text-slate-600 leading-tight mt-0.5">
              Every dismissal is logged with reason + authority for plan documentation —
              <em>to learn, man and machine</em> (Tom Gilb 2026-06-14).
            </p>
          </div>
          <CloseDot size="lg" aria-label="Cancel dismissal" @click="onCancel" />
        </header>

        <!-- BODY -->
        <div class="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">

          <!-- Finding summary -->
          <section class="bg-slate-50 border border-slate-200 rounded-md p-3">
            <div class="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">You are dismissing:</div>
            <div class="text-sm font-semibold text-slate-800">{{ findingSummary }}</div>
            <div v-if="fixSummary" class="text-xs text-slate-600 italic mt-1">Proposed fix: {{ fixSummary }}</div>
          </section>

          <!-- WHY -->
          <section>
            <label class="block text-xs font-bold uppercase tracking-wider text-rose-700 mb-1.5">
              1. Why? <span class="text-rose-500">*</span>
            </label>
            <textarea
              ref="reasonTextarea"
              v-model="reason"
              rows="3"
              class="w-full px-3 py-2 text-sm border-2 border-rose-300 rounded-lg focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-200 bg-white placeholder:text-slate-400"
              placeholder="In your own words — why is this finding being dismissed? (required)"
              title="Capture the reason in your own words. Pick a quick-chip below to autofill common reasons, or type a custom explanation. Required."
            ></textarea>
            <div class="mt-2">
              <div class="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Quick picks (click to autofill)</div>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="r in QUICK_PICK_REASONS"
                  :key="r"
                  type="button"
                  class="text-[11px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 hover:border-rose-400 font-semibold"
                  :title="`Autofill the Why textarea with: '${r}'`"
                  @click="onQuickPick(r)"
                >{{ r }}</button>
              </div>
            </div>
          </section>

          <!-- AUTHORITY -->
          <section>
            <label class="block text-xs font-bold uppercase tracking-wider text-rose-700 mb-1.5">
              2. On whose authority? <span class="text-rose-500">*</span>
            </label>
            <select
              v-model="authority"
              class="w-full px-3 py-2 text-sm border-2 border-rose-300 rounded-lg focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-200 bg-white"
              title="Who is making this call? Tom Gilb 2026-06-14: 'default, Owner'."
            >
              <option
                v-for="a in (['owner','planner','scribe','stakeholder','other'] as const)"
                :key="a"
                :value="a"
              >{{ DISMISSAL_AUTHORITY_META[a].label }}</option>
            </select>
            <p class="text-[11px] text-slate-600 italic mt-1">{{ DISMISSAL_AUTHORITY_META[authority].description }}</p>
            <p v-if="authority === 'owner' && ownerName" class="text-[11px] text-emerald-700 mt-0.5">→ Plan Owner: <strong>{{ ownerName }}</strong></p>

            <!-- Free-text name field for Stakeholder / Other -->
            <div v-if="needsAuthorityName" class="mt-2">
              <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Name <span class="text-rose-500">*</span></label>
              <input
                v-model="authorityName"
                type="text"
                class="w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-200 bg-white"
                :placeholder="authority === 'stakeholder' ? 'Stakeholder name or role' : 'Name of authority'"
                title="Required when authority is Stakeholder or Other"
              />
            </div>
          </section>
        </div>

        <!-- FOOTER -->
        <footer class="flex items-center justify-between gap-3 px-5 py-3 border-t-2 border-rose-200 bg-rose-50 shrink-0">
          <span class="text-[11px] text-slate-600 italic">
            ⌘+Enter to confirm · Esc / outside-click to cancel
          </span>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="px-3 py-1.5 text-sm rounded-md bg-white border border-slate-300 hover:bg-slate-100 font-semibold text-slate-700"
              title="Cancel — finding stays visible, nothing logged"
              @click="onCancel"
            >Cancel</button>
            <button
              type="button"
              class="px-3 py-1.5 text-sm font-bold rounded-md bg-rose-600 text-white hover:bg-rose-700 disabled:bg-slate-300 disabled:cursor-not-allowed shadow"
              :disabled="!canConfirm"
              :title="canConfirm ? 'Confirm dismissal — logs reason + authority to the plan' : 'Fill in the Why (and Name if Stakeholder/Other) to enable'"
              @click="onConfirm"
            >Confirm dismissal</button>
          </div>
        </footer>
      </div>
    </div>
  </Teleport>
</template>
