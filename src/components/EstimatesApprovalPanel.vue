<!-- UNIT_TYPE=Panel -->
<!--
 * EstimatesApprovalPanel.vue — captures the planner's approval of the current
 * Impact Estimation Table (IET) as a new Estimates Version.
 *
 * Tom Gilb 2026-06-21 verbatim: *"They need to be able to approve it (for the
 * moment, until other data require change). Approval creates an 'Estimates
 * Version', and approval requires identity, date, time, and remarks or
 * Caveats."*
 *
 * Phase 1 ship of Stage 4 sub-step 4.3.  Captures identity + auto-stamped
 * date+time + free-text remarks/caveats + optional nickname; emits 'approve'
 * with the structured EstimatesApproval record so App.vue can persist via the
 * existing useSpecHistory addVersion() infrastructure.
 *
 * Composes with: rule_stage_4_impacts_design.md SUPREME · Universal Undo
 * SUPREME (every approval is reversible) · Stages-are-Cyclic SUPREME (approval
 * is "for the moment, until other data require change") · DD-009 Zero-Training
 * UI · CloseDot SUPREME · No-Silent-Data-Loss SUPREME (auto-save on close).
 -->
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import CloseDot from './CloseDot.vue'

export interface EstimatesApproval {
  identity:  string           // planner name / role
  timestamp: number           // Date.now() at approval moment
  isoDate:   string           // human-readable ISO date
  remarks:   string           // free-text caveats / remarks
  nickname?: string           // optional short nickname (memory aid)
  /** r41 v253 (Tom Gilb 2026-06-21 — Stage 5 design):
   *  approval AUTHORITY level.  'planner' = working-draft approval (Stage 5 5.5
   *  default per Tom verbatim "by Planner, not necessarily other instances like
   *  Owner").  'owner' = organisational-commitment approval.  Future levels:
   *  'stakeholder-council' / 'customer' / 'auditor'.  Phase 2+ adds UI affordance
   *  to escalate from planner to owner. */
  approvalAuthority?: 'planner' | 'owner'
  /** r41 v253 — which artefact kind this approval covers. */
  panelKind?: 'estimates' | 'solutions'
}

const props = defineProps<{
  /** Default identity to pre-fill (e.g. last-used planner name or Spec Owner). */
  defaultIdentity?: string
  /** Spec name shown in the header for context. */
  specName?: string | null
  /** Optional pre-fill of nickname (e.g. derived from current spec version). */
  defaultNickname?: string
  /** r41 v253 — which artefact kind this panel is approving.  'estimates' (Stage 4)
   *  or 'solutions' (Stage 5).  Drives header label + button label + persistence
   *  label.  Default 'estimates' for backward compatibility with v252 callers. */
  panelKind?: 'estimates' | 'solutions'
  /** r41 v253 — which authority level is approving.  Default 'planner'. */
  approvalAuthority?: 'planner' | 'owner'
}>()

// r41 v478 (Tom Gilb 2026-07-04 "continue backlog" — audit-backlog #4 Stage 5
// Refine Phase 2): Planner-vs-Owner escalation.  Tom's verbatim design at
// memory/rule_stage_5_refine_design.md: *"(by Planner, not necessarily other
// instances like Owner)"* — approval defaults to Planner-level but can be
// ESCALATED to Owner-level via a toggle pin.  Declared here (above the
// `authority` computed) so the computed can reference it — Vue setup
// functions require declaration-before-use for TS strict mode.
const localAuthority = ref<'planner' | 'owner'>(props.approvalAuthority ?? 'planner')
function toggleAuthority(): void {
  localAuthority.value = localAuthority.value === 'planner' ? 'owner' : 'planner'
}

const kind = computed<'estimates' | 'solutions'>(() => props.panelKind ?? 'estimates')
// r41 v478 — authority computed now reads localAuthority (so header + note
// update live when the planner clicks Escalate to Owner).
const authority = computed<'planner' | 'owner'>(() => localAuthority.value)
const headerTitle = computed<string>(() => kind.value === 'solutions'
  ? 'Approve Solution Set — Create Solution Set Version'
  : 'Approve Estimates — Create Estimates Version')
const approveButtonLabel = computed<string>(() => kind.value === 'solutions'
  ? '✅ Approve — Create Solution Set Version'
  : '✅ Approve — Create Estimates Version')
const authorityNote = computed<string>(() => authority.value === 'planner'
  ? 'Planner-level approval (working draft). Tom Gilb 2026-06-21: "by Planner, not necessarily other instances like Owner". Future Owner-level approval can escalate this record.'
  : 'Owner-level approval (organisational commitment). Higher authority than Planner-level.')

const emit = defineEmits<{
  (e: 'approve', record: EstimatesApproval): void
  (e: 'close'): void
}>()

const identity  = ref<string>(props.defaultIdentity ?? '')
const remarks   = ref<string>('')
const nickname  = ref<string>(props.defaultNickname ?? '')
const submitting = ref(false)

const nowIsoLabel = computed<string>(() => {
  const d = new Date()
  return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })
})

const canApprove = computed<boolean>(() => identity.value.trim().length > 0)

function handleApprove(): void {
  if (!canApprove.value || submitting.value) return
  submitting.value = true
  const now = Date.now()
  const record: EstimatesApproval = {
    identity:  identity.value.trim(),
    timestamp: now,
    isoDate:   new Date(now).toISOString(),
    remarks:   remarks.value.trim(),
    nickname:  nickname.value.trim() || undefined,
    panelKind: kind.value,
    // r41 v478 — use the LOCAL authority (possibly escalated in-panel), not
    // the prop default.  If the planner clicked "Escalate to Owner", that
    // choice flows into the recorded approval.
    approvalAuthority: localAuthority.value,
  }
  emit('approve', record)
  // Brief flash then close (parent persists + closes the panel).
  setTimeout(() => { submitting.value = false }, 600)
}

function handleClose(): void {
  emit('close')
}

onMounted(() => {
  // Focus the identity field if empty so the planner lands at the first required field.
  if (!identity.value) {
    const el = document.getElementById('estimates-approval-identity')
    if (el && typeof (el as HTMLInputElement).focus === 'function') {
      (el as HTMLInputElement).focus()
    }
  }
})
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[600] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Approve Estimates"
      @click.self="handleClose"
    >
      <div
        class="w-full max-w-lg bg-white rounded-2xl shadow-2xl border-2 border-indigo-300 overflow-hidden"
      >
        <!-- Header -->
        <header class="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-indigo-700 to-violet-700 text-white">
          <span aria-hidden="true" class="text-base">✅</span>
          <div class="flex-1 min-w-0">
            <h2 class="text-sm font-bold tracking-wide">{{ headerTitle }}</h2>
            <p v-if="specName" class="text-[10px] text-indigo-100 truncate">Spec: {{ specName }} · authority: {{ authority }}</p>
          </div>
          <CloseDot variant="on-dark" size="lg" title="Cancel approval" aria-label="Cancel approval" @click="handleClose" />
        </header>

        <!-- Body -->
        <div class="px-5 py-4 space-y-3 text-sm">
          <!-- Identity (REQUIRED) -->
          <div>
            <label for="estimates-approval-identity" class="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Identity <span class="text-rose-500 font-bold" aria-label="required">*</span>
            </label>
            <input
              id="estimates-approval-identity"
              v-model="identity"
              type="text"
              required
              class="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="Your name or role (required) — e.g. Tom, Product Lead, CTO"
              title="Tom Gilb 2026-06-21: 'approval requires identity'.  Type your name or role."
            />
            <p class="text-[10px] text-slate-500 mt-0.5 italic">Required per Tom Gilb 2026-06-21: "approval requires identity, date, time, and remarks or Caveats."</p>
          </div>

          <!-- Date + Time (AUTO) -->
          <div>
            <label class="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Date + Time (auto-stamped at approval)
            </label>
            <div class="h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 flex items-center text-[12px] font-mono">
              {{ nowIsoLabel }}
            </div>
          </div>

          <!-- r41 v478 — Planner-vs-Owner escalation pin.
               Tom Gilb 2026-06-21 verbatim: "(by Planner, not necessarily other
               instances like Owner)".  Approval defaults to Planner-level;
               clicking the pin escalates to Owner-level (organisational
               commitment) for THIS approval.  The recorded EstimatesApproval
               carries the chosen authority in .approvalAuthority. -->
          <div>
            <label class="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Approval Authority
            </label>
            <div class="flex items-center gap-2">
              <button
                type="button"
                :class="[
                  'flex-1 h-9 rounded-lg text-[12px] font-bold ring-2 transition-colors',
                  localAuthority === 'planner'
                    ? 'bg-indigo-600 text-white ring-indigo-300 shadow-sm'
                    : 'bg-white text-indigo-700 ring-indigo-200 hover:bg-indigo-50',
                ]"
                title="Planner-level approval (working-draft authority).  Per Tom Gilb 2026-06-21 verbatim: 'by Planner, not necessarily other instances like Owner'.  This is the default for Stage 5 5.5 exit-process approval."
                @click="localAuthority = 'planner'"
              >🧭 Planner-level</button>
              <button
                type="button"
                :class="[
                  'flex-1 h-9 rounded-lg text-[12px] font-bold ring-2 transition-colors',
                  localAuthority === 'owner'
                    ? 'bg-emerald-700 text-white ring-emerald-300 shadow-sm'
                    : 'bg-white text-emerald-800 ring-emerald-200 hover:bg-emerald-50',
                ]"
                title="Owner-level approval (organisational commitment authority).  Higher than Planner-level.  Use this when the Spec Owner is signing off — the recorded EstimatesApproval will be tagged with approvalAuthority='owner' so downstream flows can distinguish it from working-draft approvals."
                @click="localAuthority = 'owner'"
              >🔑 Escalate to Owner</button>
            </div>
            <p class="text-[10px] text-slate-500 mt-1 italic leading-snug">
              {{ localAuthority === 'planner'
                ? '🧭 Planner-level: working-draft authority.  Default per Tom Gilb 2026-06-21.'
                : '🔑 Owner-level: organisational commitment.  Higher authority than Planner.' }}
            </p>
          </div>

          <!-- Remarks / Caveats -->
          <div>
            <label for="estimates-approval-remarks" class="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Remarks / Caveats
            </label>
            <textarea
              id="estimates-approval-remarks"
              v-model="remarks"
              rows="3"
              class="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 placeholder-slate-400 text-[12px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y"
              placeholder="Any caveats, assumptions, or remarks about this estimates set.  E.g. 'NVDA impact estimates use Q4-2025 financial reports; recompute after Q1-2026 results.'"
              title="Free-text remarks or caveats about this Estimates Version — what should the next reviewer (or future-you) know?"
            ></textarea>
          </div>

          <!-- Nickname (OPTIONAL) -->
          <div>
            <label for="estimates-approval-nickname" class="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Nickname <span class="text-slate-400 font-normal normal-case">(optional — memory aid)</span>
            </label>
            <input
              id="estimates-approval-nickname"
              v-model="nickname"
              type="text"
              class="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white text-slate-800 placeholder-slate-400 text-[12px] focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="Short label, e.g. 'Pre-NVDA-Q1', 'Conservative baseline', 'Board-deck-Mar26'"
              title="Tom Gilb 2026-06-21: 'Nickname any Versions (as aid to remember purpose of version)'"
            />
          </div>

          <!-- r41 v253 — authority note (Planner-vs-Owner) -->
          <div class="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
            <p class="text-[10px] text-slate-600 leading-relaxed italic">
              {{ authorityNote }}
            </p>
          </div>

          <!-- Cyclic-approval reminder -->
          <div class="rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-2">
            <p class="text-[11px] text-indigo-800 leading-relaxed italic">
              Approval is for the moment, until other data require change. You can always
              return to this stage and create a new
              {{ kind === 'solutions' ? 'Solution Set Version' : 'Estimates Version' }}
              after later-stage changes uncover new evidence.
              <span class="not-italic font-semibold">(Stages are Cyclic — Tom Gilb, 21 June 2026)</span>
            </p>
          </div>
        </div>

        <!-- Footer actions -->
        <footer class="flex items-center justify-end gap-2 px-5 py-3 bg-slate-50 border-t border-slate-200">
          <button
            type="button"
            class="h-9 px-3 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-200 transition-colors"
            @click="handleClose"
          >Cancel</button>
          <button
            type="button"
            :disabled="!canApprove || submitting"
            :class="[
              'h-9 px-4 rounded-lg text-xs font-bold transition-colors',
              canApprove && !submitting
                ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed',
            ]"
            :title="canApprove ? 'Approve estimates and create a new Estimates Version' : 'Identity required to approve'"
            @click="handleApprove"
          >
            <span v-if="submitting" class="inline-flex items-center gap-1.5">
              <span class="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
              <span>Approving…</span>
            </span>
            <span v-else>{{ approveButtonLabel }}</span>
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>
