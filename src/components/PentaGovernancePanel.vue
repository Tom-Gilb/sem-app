<!-- UNIT_TYPE=Panel -->
<!--
 * PentaGovernancePanel — Version governance, approval workflow, and Consequence Cascade
 * tracking for Penta Model (SVERD) field edits.
 *
 * Tom Gilb requirement (2026-06-08):
 *   "We have to go through the same governance here as for all changes, Save the Version,
 *    Get Approval, Decide to Update the Master, Or Not... We also need to deal with
 *    Cascading Changes: if a Value Changes, then Solutions (usually, not always) need to
 *    Change to deliver the New Value or New Value Levels."
 *
 * Three tabs:
 *   Pending   — tracked field changes not yet versioned; Save Version CTA
 *   History   — version list (newest first): approve / integrate / reject / delete / restore
 *   Cascade   — cascade impact analysis for the selected version
 *
 * Rules: CloseDot (all 3 close affordances), Single-Surface (registerExclusiveSurface
 *        via parent PentaPanel), DD-009 (all buttons have title), DD-017 (canonical
 *        colours on white bg), No Scrum vocabulary, Claude-Code-as-AI-Layer (no API calls).
 *
 * Cascade order badges: direct = orange-600, 2nd-order = amber-600, nth-order = slate-500
 * Version status badges: draft = amber, approved = green, integrated = emerald, rejected = red
-->
<script setup lang="ts">
import { ref, computed } from 'vue'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'
import type { SpecBlock } from '../types/spec'
import type { PentaFieldChange, PentaVersion, CascadeImpact } from '../types/pentaGovernance'

const props = defineProps<{
  open: boolean
  planId: string
  spec: SpecBlock | null
  pendingChanges: PentaFieldChange[]
  versions: PentaVersion[]
}>()

const emit = defineEmits<{
  close: []
  'restore-spec': [specSnapshot: object]
  'save-version': [label: string, notes: string]
  'approve': [versionId: string]
  'reject': [versionId: string]
  'integrate': [versionId: string]
  'delete': [versionId: string]
  'declare-not-calculated': [versionId: string]
  'update-impact': [payload: { versionId: string; impactId: string; notes: string }]
  'set-impact-status': [payload: { versionId: string; impactId: string; status: CascadeImpact['status'] }]
}>()

// ── Tabs ─────────────────────────────────────────────────────────────────────
type Tab = 'pending' | 'history' | 'cascade'
const activeTab = ref<Tab>('pending')

// ── Save Version form ────────────────────────────────────────────────────────
const newVersionLabel = ref('')
const newVersionNotes = ref('')

function onSaveVersion(): void {
  if (!props.pendingChanges.length) return
  emit('save-version', newVersionLabel.value, newVersionNotes.value)
  newVersionLabel.value = ''
  newVersionNotes.value = ''
  activeTab.value = 'history'
}

// ── Version selection (for History + Cascade tabs) ───────────────────────────
const selectedVersionId = ref<string | null>(null)

const selectedVersion = computed<PentaVersion | null>(() => {
  if (!selectedVersionId.value) return null
  return props.versions.find((v) => v.id === selectedVersionId.value) ?? null
})

function selectVersion(id: string): void {
  selectedVersionId.value = selectedVersionId.value === id ? null : id
}

function openCascade(versionId: string): void {
  selectedVersionId.value = versionId
  activeTab.value = 'cascade'
}

// ── Restore confirmation ─────────────────────────────────────────────────────
const restoreConfirmId = ref<string | null>(null)

function requestRestore(versionId: string): void {
  restoreConfirmId.value = versionId
}

function confirmRestore(version: PentaVersion): void {
  emit('restore-spec', version.specSnapshot)
  restoreConfirmId.value = null
}

// ── Impact note editing ──────────────────────────────────────────────────────
const editingNoteId = ref<string | null>(null)
const editingNoteText = ref('')

function startEditNote(impact: CascadeImpact): void {
  editingNoteId.value = impact.id
  editingNoteText.value = impact.notes ?? ''
}

function saveNote(versionId: string, impactId: string): void {
  emit('update-impact', { versionId, impactId, notes: editingNoteText.value })
  editingNoteId.value = null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function versionStatusBadgeClass(status: PentaVersion['status']): string {
  switch (status) {
    case 'approved':   return 'bg-green-100 text-green-800 border-green-300'
    case 'integrated': return 'bg-emerald-100 text-emerald-800 border-emerald-300'
    case 'rejected':   return 'bg-red-100 text-red-800 border-red-300'
    default:           return 'bg-amber-100 text-amber-800 border-amber-300' // draft
  }
}

function cascadeStatusBadgeClass(status: PentaVersion['cascadeStatus']): string {
  switch (status) {
    case 'complete':               return 'bg-green-100 text-green-800 border-green-300'
    case 'partial':                return 'bg-amber-100 text-amber-800 border-amber-300'
    case 'declared-not-calculated': return 'bg-slate-100 text-slate-700 border-slate-300'
    default:                        return 'bg-red-100 text-red-800 border-red-300' // not-analyzed
  }
}

function cascadeStatusLabel(status: PentaVersion['cascadeStatus']): string {
  switch (status) {
    case 'complete':               return 'Cascade: Complete'
    case 'partial':                return 'Cascade: Partial'
    case 'declared-not-calculated': return 'Cascade: Declared Not Calculated'
    default:                        return 'Cascade: Not Analyzed'
  }
}

function orderBadgeClass(order: CascadeImpact['order']): string {
  switch (order) {
    case 'direct':    return 'bg-orange-600 text-white'
    case '2nd-order': return 'bg-amber-600 text-white'
    default:          return 'bg-slate-500 text-white' // nth-order
  }
}

function impactStatusBadgeClass(status: CascadeImpact['status']): string {
  switch (status) {
    case 'no-impact':               return 'bg-green-100 text-green-800'
    case 'change-required':         return 'bg-red-100 text-red-800'
    case 'change-applied':          return 'bg-emerald-100 text-emerald-800'
    case 'declared-not-calculated': return 'bg-slate-100 text-slate-700'
    default:                        return 'bg-amber-100 text-amber-800' // unanalyzed
  }
}

function fieldLabel(field: string): string {
  switch (field) {
    case 'goal':      return 'Goal'
    case 'tolerable': return 'Tolerable'
    case 'status':    return 'Status'
    case 'budget':    return 'Budget'
    case 'consumed':  return 'Consumed'
    default:          return field
  }
}

// Group cascade impacts by order for display
const directImpacts = computed(() =>
  (selectedVersion.value?.cascadeImpacts ?? []).filter((i) => i.order === 'direct'),
)
const secondOrderImpacts = computed(() =>
  (selectedVersion.value?.cascadeImpacts ?? []).filter((i) => i.order === '2nd-order'),
)
const nthOrderImpacts = computed(() =>
  (selectedVersion.value?.cascadeImpacts ?? []).filter((i) => i.order === 'nth-order'),
)

const hasCascadeWarning = computed(() =>
  selectedVersion.value?.cascadeStatus === 'not-analyzed' ||
  selectedVersion.value?.cascadeStatus === 'partial',
)
</script>

<template>
  <Teleport to="body">
    <template v-if="open">
      <!-- Backdrop — click-outside to dismiss (CloseDot rule) -->
      <div
        class="fixed inset-0 bg-black/50 z-[610]"
        @click="emit('close')"
      />

      <!-- Panel — overlays the Penta panel (z-index above it) -->
      <div
        class="fixed inset-x-4 inset-y-4 z-[615] flex flex-col bg-white shadow-2xl rounded-xl overflow-hidden"
        role="dialog"
        aria-label="Penta Governance — version control and cascade analysis"
        aria-modal="true"
        @click.stop
      >
        <!-- ── Header ──────────────────────────────────────────────────────── -->
        <header class="flex items-center gap-3 px-5 py-3 bg-slate-800 shrink-0">
          <span class="text-xl select-none" aria-hidden="true">📋</span>
          <div class="flex-1 min-w-0">
            <h2 class="text-white font-bold text-base leading-tight">Penta Governance</h2>
            <p class="text-slate-400 text-xs leading-tight">
              Version control · Approval workflow · Consequence Cascade
            </p>
          </div>
          <!-- Pending count badge -->
          <div
            v-if="pendingChanges.length > 0"
            class="shrink-0 px-2.5 py-1 rounded-full bg-amber-500 text-white text-xs font-bold"
            title="Pending field changes not yet saved as a version"
          >
            {{ pendingChanges.length }} pending
          </div>
          <!-- CloseDot — on-dark, size lg (CloseDot rule) -->
          <CloseDot
            variant="on-dark"
            size="lg"
            aria-label="Close Penta Governance panel"
            @click="emit('close')"
          />
        </header>

        <!-- ── Tab strip ──────────────────────────────────────────────────── -->
        <div class="flex border-b border-slate-200 shrink-0 bg-slate-50">
          <button
            v-for="tab in (['pending', 'history', 'cascade'] as const)"
            :key="tab"
            :class="[
              'flex-1 py-2.5 text-sm font-semibold transition-colors capitalize',
              activeTab === tab
                ? 'border-b-2 border-indigo-600 text-indigo-700 bg-white'
                : 'text-slate-500 hover:text-slate-700',
            ]"
            :title="tab === 'pending' ? 'Pending field changes — save as a named version'
                   : tab === 'history' ? 'Version history — approve, integrate, reject, or restore'
                   : 'Cascade analysis — track 1st/2nd/nth-order consequence impacts'"
            @click="activeTab = tab"
          >
            {{ tab }}
            <span
              v-if="tab === 'pending' && pendingChanges.length > 0"
              class="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-bold"
            >{{ pendingChanges.length }}</span>
            <span
              v-else-if="tab === 'history' && versions.length > 0"
              class="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-400 text-white text-[10px] font-bold"
            >{{ versions.length }}</span>
          </button>
        </div>

        <!-- ── Tab content ────────────────────────────────────────────────── -->
        <ScrollContainer
          outer-class="flex-1 min-h-0"
          inner-class="p-5 space-y-4"
          fade-from="white"
        >

          <!-- ─── PENDING TAB ────────────────────────────────────────────── -->
          <template v-if="activeTab === 'pending'">
            <template v-if="pendingChanges.length === 0">
              <div class="text-center py-10">
                <div class="text-4xl mb-3 select-none">📋</div>
                <p class="text-slate-500 text-sm">No pending changes.</p>
                <p class="text-slate-400 text-xs mt-1">Make edits in the Penta panel first, then come back here to save a named version.</p>
              </div>
            </template>

            <template v-else>
              <!-- Pending changes list -->
              <div>
                <h3 class="text-sm font-semibold text-slate-700 mb-2">
                  {{ pendingChanges.length }} field change(s) pending — not yet versioned
                </h3>
                <div class="space-y-2">
                  <div
                    v-for="change in pendingChanges"
                    :key="change.id"
                    class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2"
                  >
                    <div class="flex items-center gap-2 mb-1">
                      <span class="text-xs font-mono text-slate-500">{{ change.itemId }}</span>
                      <span class="text-xs px-1.5 py-0.5 rounded border border-amber-300 bg-white text-amber-800 font-medium">
                        {{ fieldLabel(change.field) }}
                      </span>
                    </div>
                    <p class="text-xs text-slate-600 mb-1">{{ change.itemLabel }}</p>
                    <div class="flex items-center gap-2 text-xs">
                      <span class="bg-red-50 border border-red-200 text-red-700 rounded px-1.5 py-0.5">
                        Before: {{ change.before || '—' }}
                      </span>
                      <span class="text-slate-400">→</span>
                      <span class="bg-green-50 border border-green-200 text-green-700 rounded px-1.5 py-0.5">
                        After: {{ change.after || '—' }}
                      </span>
                    </div>
                    <p class="text-[10px] text-slate-400 mt-1">{{ formatDate(change.changedAt) }}</p>
                  </div>
                </div>
              </div>

              <!-- Save Version form -->
              <div class="border border-indigo-200 rounded-xl bg-indigo-50 p-4 space-y-3">
                <h3 class="text-sm font-bold text-indigo-800">Save as Named Version</h3>
                <div>
                  <label class="block text-xs font-semibold text-slate-600 mb-1">
                    Version name
                  </label>
                  <input
                    v-model="newVersionLabel"
                    type="text"
                    class="w-full text-sm border border-slate-300 rounded px-2 py-1.5 focus:ring-2 focus:ring-indigo-300 focus:outline-none bg-white"
                    placeholder="e.g. Raised Customer Satisfaction Goal to 95"
                    title="Give this version a descriptive name"
                  />
                </div>
                <div>
                  <label class="block text-xs font-semibold text-slate-600 mb-1">
                    Rationale / explanation
                  </label>
                  <textarea
                    v-model="newVersionNotes"
                    rows="3"
                    class="w-full text-sm border border-slate-300 rounded px-2 py-1.5 focus:ring-2 focus:ring-indigo-300 focus:outline-none bg-white resize-none"
                    placeholder="Why were these changes made? What is the expected impact?"
                    title="Record the rationale for these changes — for governance audit trail"
                  />
                </div>
                <button
                  class="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                  title="Save these changes as a named draft version — you can approve and integrate later"
                  @click="onSaveVersion"
                >
                  <span>💾</span>
                  <span>Save Version</span>
                </button>
              </div>
            </template>
          </template>

          <!-- ─── HISTORY TAB ────────────────────────────────────────────── -->
          <template v-else-if="activeTab === 'history'">
            <template v-if="versions.length === 0">
              <div class="text-center py-10">
                <div class="text-4xl mb-3 select-none">📚</div>
                <p class="text-slate-500 text-sm">No saved versions yet.</p>
                <p class="text-slate-400 text-xs mt-1">Save a version from the Pending tab after making edits.</p>
              </div>
            </template>

            <template v-else>
              <div class="space-y-3">
                <div
                  v-for="version in versions"
                  :key="version.id"
                  class="rounded-xl border bg-white overflow-hidden"
                  :class="selectedVersionId === version.id ? 'border-indigo-300 shadow-md' : 'border-slate-200'"
                >
                  <!-- Version card header -->
                  <div
                    class="flex items-start gap-3 p-3 cursor-pointer hover:bg-slate-50 transition-colors"
                    :title="`${version.label} — click to expand`"
                    @click="selectVersion(version.id)"
                  >
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="font-semibold text-sm text-slate-800 truncate">{{ version.label }}</span>
                        <span
                          :class="['text-xs px-1.5 py-0.5 rounded border font-medium', versionStatusBadgeClass(version.status)]"
                        >
                          {{ version.status.charAt(0).toUpperCase() + version.status.slice(1) }}
                        </span>
                        <span
                          :class="['text-xs px-1.5 py-0.5 rounded border font-medium', cascadeStatusBadgeClass(version.cascadeStatus)]"
                        >
                          {{ cascadeStatusLabel(version.cascadeStatus) }}
                        </span>
                      </div>
                      <p class="text-xs text-slate-500 mt-0.5">
                        {{ formatDate(version.savedAt) }} ·
                        {{ version.changes.length }} change(s) ·
                        {{ version.cascadeImpacts.length }} cascade item(s)
                      </p>
                      <!-- Cascade warning badge -->
                      <div
                        v-if="version.cascadeStatus === 'not-analyzed' || version.cascadeStatus === 'partial'"
                        class="mt-1 flex items-center gap-1 text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded px-2 py-0.5 w-fit"
                      >
                        <span>⚠️</span>
                        <span>Consequence Cascade not yet fully calculated</span>
                      </div>
                    </div>
                    <span class="text-slate-400 text-sm mt-0.5 shrink-0">
                      {{ selectedVersionId === version.id ? '▲' : '▼' }}
                    </span>
                  </div>

                  <!-- Expanded version detail -->
                  <template v-if="selectedVersionId === version.id">
                    <div class="border-t border-slate-100 px-3 pb-3 space-y-3">

                      <!-- Notes -->
                      <div v-if="version.notes" class="mt-3">
                        <label class="block text-xs font-semibold text-slate-500 mb-1">Rationale</label>
                        <p class="text-sm text-slate-700 bg-slate-50 rounded border border-slate-100 px-2 py-1.5">{{ version.notes }}</p>
                      </div>

                      <!-- Approval info -->
                      <div v-if="version.approvedBy" class="text-xs text-green-700 bg-green-50 rounded border border-green-200 px-2 py-1">
                        Approved by {{ version.approvedBy }} · {{ formatDate(version.approvedAt ?? '') }}
                      </div>
                      <div v-if="version.integratedAt" class="text-xs text-emerald-700 bg-emerald-50 rounded border border-emerald-200 px-2 py-1">
                        Integrated into master · {{ formatDate(version.integratedAt) }}
                      </div>

                      <!-- Change list -->
                      <div>
                        <label class="block text-xs font-semibold text-slate-500 mb-1">Field changes ({{ version.changes.length }})</label>
                        <div class="space-y-1">
                          <div
                            v-for="change in version.changes"
                            :key="change.id"
                            class="flex items-center gap-2 text-xs bg-slate-50 rounded border border-slate-100 px-2 py-1"
                          >
                            <span class="font-mono text-slate-500 shrink-0">{{ change.itemId }}</span>
                            <span class="text-slate-600 shrink-0">{{ fieldLabel(change.field) }}</span>
                            <span class="text-red-600 shrink-0">{{ change.before || '—' }}</span>
                            <span class="text-slate-400">→</span>
                            <span class="text-green-700 shrink-0">{{ change.after || '—' }}</span>
                          </div>
                        </div>
                      </div>

                      <!-- Action buttons -->
                      <div class="flex flex-wrap gap-2 pt-1">
                        <!-- Approve (only if draft) -->
                        <button
                          v-if="version.status === 'draft'"
                          class="px-3 py-1.5 text-xs rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold transition-colors"
                          title="Approve this version — mark as approved and ready for integration"
                          @click="emit('approve', version.id)"
                        >
                          ✓ Approve
                        </button>

                        <!-- Integrate (only if approved) -->
                        <button
                          v-if="version.status === 'approved'"
                          class="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors"
                          title="Integrate this version into the master plan — mark as integrated"
                          @click="emit('integrate', version.id)"
                        >
                          Integrate → Master
                        </button>

                        <!-- Reject (only if draft or approved) -->
                        <button
                          v-if="version.status === 'draft' || version.status === 'approved'"
                          class="px-3 py-1.5 text-xs rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors"
                          title="Reject this version — mark as rejected"
                          @click="emit('reject', version.id)"
                        >
                          Reject
                        </button>

                        <!-- View Cascade -->
                        <button
                          v-if="version.cascadeImpacts.length > 0"
                          class="px-3 py-1.5 text-xs rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold transition-colors"
                          title="Open the Cascade tab to analyze consequence impacts for this version"
                          @click="openCascade(version.id)"
                        >
                          ⚡ View Cascade ({{ version.cascadeImpacts.length }})
                        </button>

                        <!-- Declare not calculated -->
                        <button
                          v-if="version.cascadeStatus === 'not-analyzed' || version.cascadeStatus === 'partial'"
                          class="px-3 py-1.5 text-xs rounded-lg bg-slate-500 hover:bg-slate-600 text-white font-semibold transition-colors"
                          title="Declare that cascade impacts for this version have not been calculated — acknowledges but defers analysis"
                          @click="emit('declare-not-calculated', version.id)"
                        >
                          ⚠️ Declare Not Calculated
                        </button>

                        <!-- Restore spec snapshot -->
                        <template v-if="restoreConfirmId === version.id">
                          <span class="text-xs text-red-600 font-semibold self-center">Restore spec to this version?</span>
                          <button
                            class="px-3 py-1.5 text-xs rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors"
                            title="Confirm: restore spec to this saved snapshot (overwrites current spec)"
                            @click="confirmRestore(version)"
                          >
                            Yes, restore
                          </button>
                          <button
                            class="px-3 py-1.5 text-xs rounded-lg bg-slate-300 hover:bg-slate-400 text-slate-800 font-semibold transition-colors"
                            title="Cancel restore"
                            @click="restoreConfirmId = null"
                          >
                            Cancel
                          </button>
                        </template>
                        <button
                          v-else
                          class="px-3 py-1.5 text-xs rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold transition-colors"
                          title="Restore the spec to this saved snapshot — useful for rolling back"
                          @click="requestRestore(version.id)"
                        >
                          ↩ Restore Spec
                        </button>

                        <!-- Delete -->
                        <button
                          class="px-3 py-1.5 text-xs rounded-lg bg-slate-100 hover:bg-red-100 text-slate-500 hover:text-red-700 font-semibold transition-colors"
                          title="Delete this version permanently from history"
                          @click="emit('delete', version.id)"
                        >
                          🗑 Delete
                        </button>
                      </div>
                    </div>
                  </template>
                </div>
              </div>
            </template>
          </template>

          <!-- ─── CASCADE TAB ────────────────────────────────────────────── -->
          <template v-else-if="activeTab === 'cascade'">

            <!-- Version selector -->
            <div v-if="versions.length > 0" class="mb-2">
              <label class="block text-xs font-semibold text-slate-600 mb-1">
                Analyzing version:
              </label>
              <select
                :value="selectedVersionId ?? ''"
                class="w-full text-sm border border-slate-300 rounded px-2 py-1.5 focus:ring-2 focus:ring-indigo-300 focus:outline-none bg-white"
                title="Select a version to analyze its cascade impacts"
                @change="selectedVersionId = ($event.target as HTMLSelectElement).value || null"
              >
                <option value="">— select a version —</option>
                <option
                  v-for="v in versions"
                  :key="v.id"
                  :value="v.id"
                >{{ v.label }} ({{ formatDate(v.savedAt) }})</option>
              </select>
            </div>

            <template v-if="!selectedVersion">
              <div class="text-center py-10">
                <div class="text-4xl mb-3 select-none">⚡</div>
                <p class="text-slate-500 text-sm">
                  {{ versions.length === 0
                    ? 'No saved versions yet. Save a version from the Pending tab first.'
                    : 'Select a version above to see its cascade impacts.' }}
                </p>
              </div>
            </template>

            <template v-else>
              <!-- Cascade status banner -->
              <div
                :class="[
                  'rounded-xl border px-4 py-3 mb-2',
                  hasCascadeWarning
                    ? 'bg-orange-50 border-orange-200'
                    : 'bg-green-50 border-green-200',
                ]"
              >
                <div class="flex items-center gap-2">
                  <span class="text-xl select-none">{{ hasCascadeWarning ? '⚠️' : '✅' }}</span>
                  <div>
                    <p
                      :class="['font-bold text-sm', hasCascadeWarning ? 'text-orange-800' : 'text-green-800']"
                    >
                      {{ hasCascadeWarning
                        ? 'Consequence Cascade not yet fully calculated'
                        : 'Cascade analysis complete' }}
                    </p>
                    <p
                      :class="['text-xs', hasCascadeWarning ? 'text-orange-700' : 'text-green-700']"
                    >
                      {{ selectedVersion.cascadeImpacts.length }} potential impact(s) identified
                      · {{ cascadeStatusLabel(selectedVersion.cascadeStatus) }}
                    </p>
                  </div>
                  <!-- Declare not calculated button (prominent when unanalyzed) -->
                  <button
                    v-if="hasCascadeWarning"
                    class="ml-auto px-3 py-1.5 text-xs rounded-lg bg-slate-600 hover:bg-slate-700 text-white font-semibold transition-colors shrink-0"
                    title="Formally declare that cascade impacts for this version have not yet been calculated — Planguage: explicit uncertainty declaration"
                    @click="emit('declare-not-calculated', selectedVersion.id)"
                  >
                    ⚠️ Declare All Not Calculated
                  </button>
                </div>
              </div>

              <!-- No impacts -->
              <div
                v-if="selectedVersion.cascadeImpacts.length === 0"
                class="text-center py-6 text-slate-400 text-sm"
              >
                No cascade impacts detected for this version (no Solutions or Resources referenced).
              </div>

              <!-- Direct impacts group -->
              <template v-if="directImpacts.length > 0">
                <h3 class="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <span class="px-2 py-0.5 rounded text-xs font-bold bg-orange-600 text-white">Direct</span>
                  1st-order impacts ({{ directImpacts.length }})
                </h3>
                <p class="text-xs text-slate-500 -mt-2 mb-2">
                  Direct effects: if a Value target changes, the Solutions delivering it may need redesign.
                </p>
                <div class="space-y-2">
                  <div
                    v-for="impact in directImpacts"
                    :key="impact.id"
                    class="rounded-lg border border-orange-200 bg-orange-50 p-3"
                  >
                    <div class="flex items-start gap-2 mb-2">
                      <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-600 text-white shrink-0 mt-0.5">Direct</span>
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-1 text-xs text-slate-600 flex-wrap">
                          <span class="font-mono bg-white border border-slate-200 rounded px-1">{{ impact.causeItemId }}</span>
                          <span class="text-slate-400">{{ impact.causeField }}</span>
                          <span class="text-slate-400">→</span>
                          <span class="font-mono bg-white border border-slate-200 rounded px-1">{{ impact.effectItemId }}</span>
                          <span class="text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 border border-orange-200">{{ impact.effectItemType }}</span>
                        </div>
                        <p class="text-xs text-slate-700 mt-1">{{ impact.impactDescription }}</p>
                      </div>
                    </div>
                    <div class="flex items-center gap-2 flex-wrap">
                      <label class="text-xs text-slate-500 font-semibold shrink-0">Status:</label>
                      <select
                        :value="impact.status"
                        class="text-xs border border-slate-300 rounded px-2 py-0.5 bg-white focus:ring-2 focus:ring-indigo-300 focus:outline-none"
                        :title="`Set cascade impact status for ${impact.effectItemId}`"
                        @change="emit('set-impact-status', { versionId: selectedVersion!.id, impactId: impact.id, status: ($event.target as HTMLSelectElement).value as CascadeImpact['status'] })"
                      >
                        <option value="unanalyzed">Unanalyzed</option>
                        <option value="no-impact">No Impact</option>
                        <option value="change-required">Change Required</option>
                        <option value="change-applied">Change Applied</option>
                        <option value="declared-not-calculated">Declared Not Calculated</option>
                      </select>
                      <span :class="['text-xs px-1.5 py-0.5 rounded font-medium', impactStatusBadgeClass(impact.status)]">
                        {{ impact.status.replace(/-/g, ' ') }}
                      </span>
                    </div>
                    <!-- Notes -->
                    <div class="mt-2">
                      <template v-if="editingNoteId === impact.id">
                        <textarea
                          v-model="editingNoteText"
                          rows="2"
                          class="w-full text-xs border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-indigo-300 focus:outline-none resize-none"
                          title="Add notes about this cascade impact"
                        />
                        <div class="flex gap-2 mt-1">
                          <button
                            class="text-xs px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white"
                            title="Save note"
                            @click="saveNote(selectedVersion!.id, impact.id)"
                          >Save note</button>
                          <button
                            class="text-xs px-2 py-0.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-700"
                            title="Cancel editing"
                            @click="editingNoteId = null"
                          >Cancel</button>
                        </div>
                      </template>
                      <template v-else>
                        <p v-if="impact.notes" class="text-xs text-slate-600 italic mb-1">{{ impact.notes }}</p>
                        <button
                          class="text-[11px] text-indigo-500 hover:text-indigo-700"
                          :title="impact.notes ? 'Edit note for this cascade impact' : 'Add a note for this cascade impact'"
                          @click="startEditNote(impact)"
                        >{{ impact.notes ? '✏️ Edit note' : '+ Add note' }}</button>
                      </template>
                    </div>
                  </div>
                </div>
              </template>

              <!-- 2nd-order impacts group -->
              <template v-if="secondOrderImpacts.length > 0">
                <h3 class="text-sm font-bold text-slate-700 flex items-center gap-2 mt-4">
                  <span class="px-2 py-0.5 rounded text-xs font-bold bg-amber-600 text-white">2nd-order</span>
                  2nd-order impacts ({{ secondOrderImpacts.length }})
                </h3>
                <p class="text-xs text-slate-500 -mt-2 mb-2">
                  If Solutions change, Resource costs may change (redesign = different budget).
                </p>
                <div class="space-y-2">
                  <div
                    v-for="impact in secondOrderImpacts"
                    :key="impact.id"
                    class="rounded-lg border border-amber-200 bg-amber-50 p-3"
                  >
                    <div class="flex items-start gap-2 mb-2">
                      <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-600 text-white shrink-0 mt-0.5">2nd</span>
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-1 text-xs text-slate-600 flex-wrap">
                          <span class="font-mono bg-white border border-slate-200 rounded px-1">{{ impact.causeItemId }}</span>
                          <span class="text-slate-400">→ Solutions →</span>
                          <span class="font-mono bg-white border border-slate-200 rounded px-1">{{ impact.effectItemId }}</span>
                          <span class="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">{{ impact.effectItemType }}</span>
                        </div>
                        <p class="text-xs text-slate-700 mt-1">{{ impact.impactDescription }}</p>
                      </div>
                    </div>
                    <div class="flex items-center gap-2 flex-wrap">
                      <label class="text-xs text-slate-500 font-semibold shrink-0">Status:</label>
                      <select
                        :value="impact.status"
                        class="text-xs border border-slate-300 rounded px-2 py-0.5 bg-white focus:ring-2 focus:ring-indigo-300 focus:outline-none"
                        :title="`Set cascade impact status for ${impact.effectItemId}`"
                        @change="emit('set-impact-status', { versionId: selectedVersion!.id, impactId: impact.id, status: ($event.target as HTMLSelectElement).value as CascadeImpact['status'] })"
                      >
                        <option value="unanalyzed">Unanalyzed</option>
                        <option value="no-impact">No Impact</option>
                        <option value="change-required">Change Required</option>
                        <option value="change-applied">Change Applied</option>
                        <option value="declared-not-calculated">Declared Not Calculated</option>
                      </select>
                      <span :class="['text-xs px-1.5 py-0.5 rounded font-medium', impactStatusBadgeClass(impact.status)]">
                        {{ impact.status.replace(/-/g, ' ') }}
                      </span>
                    </div>
                    <div class="mt-2">
                      <template v-if="editingNoteId === impact.id">
                        <textarea
                          v-model="editingNoteText"
                          rows="2"
                          class="w-full text-xs border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-indigo-300 focus:outline-none resize-none"
                          title="Add notes about this cascade impact"
                        />
                        <div class="flex gap-2 mt-1">
                          <button
                            class="text-xs px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white"
                            title="Save note"
                            @click="saveNote(selectedVersion!.id, impact.id)"
                          >Save note</button>
                          <button
                            class="text-xs px-2 py-0.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-700"
                            title="Cancel editing"
                            @click="editingNoteId = null"
                          >Cancel</button>
                        </div>
                      </template>
                      <template v-else>
                        <p v-if="impact.notes" class="text-xs text-slate-600 italic mb-1">{{ impact.notes }}</p>
                        <button
                          class="text-[11px] text-indigo-500 hover:text-indigo-700"
                          :title="impact.notes ? 'Edit note' : 'Add a note'"
                          @click="startEditNote(impact)"
                        >{{ impact.notes ? '✏️ Edit note' : '+ Add note' }}</button>
                      </template>
                    </div>
                  </div>
                </div>
              </template>

              <!-- nth-order impacts group -->
              <template v-if="nthOrderImpacts.length > 0">
                <h3 class="text-sm font-bold text-slate-700 flex items-center gap-2 mt-4">
                  <span class="px-2 py-0.5 rounded text-xs font-bold bg-slate-500 text-white">nth-order</span>
                  nth-order impacts ({{ nthOrderImpacts.length }})
                </h3>
                <p class="text-xs text-slate-500 -mt-2 mb-2">
                  If Resources change, Values' delivery may be affected (resource constraints ripple across all Values).
                </p>
                <div class="space-y-2">
                  <div
                    v-for="impact in nthOrderImpacts"
                    :key="impact.id"
                    class="rounded-lg border border-slate-200 bg-slate-50 p-3"
                  >
                    <div class="flex items-start gap-2 mb-2">
                      <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-500 text-white shrink-0 mt-0.5">nth</span>
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-1 text-xs text-slate-600 flex-wrap">
                          <span class="font-mono bg-white border border-slate-200 rounded px-1">{{ impact.causeItemId }}</span>
                          <span class="text-slate-400">→ ... →</span>
                          <span class="font-mono bg-white border border-slate-200 rounded px-1">{{ impact.effectItemId }}</span>
                          <span class="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">{{ impact.effectItemType }}</span>
                        </div>
                        <p class="text-xs text-slate-700 mt-1">{{ impact.impactDescription }}</p>
                      </div>
                    </div>
                    <div class="flex items-center gap-2 flex-wrap">
                      <label class="text-xs text-slate-500 font-semibold shrink-0">Status:</label>
                      <select
                        :value="impact.status"
                        class="text-xs border border-slate-300 rounded px-2 py-0.5 bg-white focus:ring-2 focus:ring-indigo-300 focus:outline-none"
                        :title="`Set cascade impact status for ${impact.effectItemId}`"
                        @change="emit('set-impact-status', { versionId: selectedVersion!.id, impactId: impact.id, status: ($event.target as HTMLSelectElement).value as CascadeImpact['status'] })"
                      >
                        <option value="unanalyzed">Unanalyzed</option>
                        <option value="no-impact">No Impact</option>
                        <option value="change-required">Change Required</option>
                        <option value="change-applied">Change Applied</option>
                        <option value="declared-not-calculated">Declared Not Calculated</option>
                      </select>
                      <span :class="['text-xs px-1.5 py-0.5 rounded font-medium', impactStatusBadgeClass(impact.status)]">
                        {{ impact.status.replace(/-/g, ' ') }}
                      </span>
                    </div>
                    <div class="mt-2">
                      <template v-if="editingNoteId === impact.id">
                        <textarea
                          v-model="editingNoteText"
                          rows="2"
                          class="w-full text-xs border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-indigo-300 focus:outline-none resize-none"
                          title="Add notes about this cascade impact"
                        />
                        <div class="flex gap-2 mt-1">
                          <button
                            class="text-xs px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white"
                            title="Save note"
                            @click="saveNote(selectedVersion!.id, impact.id)"
                          >Save note</button>
                          <button
                            class="text-xs px-2 py-0.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-700"
                            title="Cancel editing"
                            @click="editingNoteId = null"
                          >Cancel</button>
                        </div>
                      </template>
                      <template v-else>
                        <p v-if="impact.notes" class="text-xs text-slate-600 italic mb-1">{{ impact.notes }}</p>
                        <button
                          class="text-[11px] text-indigo-500 hover:text-indigo-700"
                          :title="impact.notes ? 'Edit note' : 'Add a note'"
                          @click="startEditNote(impact)"
                        >{{ impact.notes ? '✏️ Edit note' : '+ Add note' }}</button>
                      </template>
                    </div>
                  </div>
                </div>
              </template>

            </template>
          </template>

        </ScrollContainer>

        <!-- ── Footer ─────────────────────────────────────────────────────── -->
        <footer class="flex items-center gap-3 px-5 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 shrink-0 flex-wrap">
          <span class="text-slate-600 font-medium">Penta Governance · Version Control + Consequence Cascade</span>
          <span>·</span>
          <span>{{ versions.length }} version(s)</span>
          <span>·</span>
          <span :class="pendingChanges.length > 0 ? 'text-amber-600 font-semibold' : ''">
            {{ pendingChanges.length }} pending
          </span>
          <span>·</span>
          <span>Plan: {{ planId }}</span>
        </footer>

      </div>
    </template>
  </Teleport>
</template>
