<!-- UNIT_TYPE=Panel -->
<!-- MariaBoardHub.vue — Maria Board Support Hub
     Three-tab panel for managing everything Maria-related beyond the analysis run:
       · Overview  — stats, recent open items, quick actions
       · Members   — board member profiles (editable, localStorage-backed)
       · Activity  — board action-item log (imported from Maria or added manually)

     UI Rules applied:
       - CloseDot at END of header flex row — Universal Close-Button Rule
       - ScrollContainer for all scrollable regions — Universal Scroll Rule
       - z-[493] backdrop / z-[497] card — same tier as MariaAgentBoard;
         mutually exclusive via registerExclusiveSurface in App.vue
       - All <button> elements have title= — DD-009 / Interaction Disclosure Rule
       - No select-none on body content — Define-by-Selection Rule
       - Teal colour scheme (from-teal-800) distinguishes hub from the emerald
         analysis panel while keeping them in the same Maria visual family

     Emits:
       close          — user closed the panel
       open-analysis  — user clicked "Run New Analysis" → App.vue opens MariaAgentBoard
-->

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'
import { useBoardMembers }      from '../composables/useBoardMembers'
import { useBoardActivityLog }  from '../composables/useBoardActivityLog'
import { lastMariaResult }      from '../lib/maria/mariaResultStore'
import { openEml }              from '../composables/useEmlExport'
import type { ActivityStatus, ActivityType } from '../types/board'

const emit = defineEmits<{
  close:           []
  'open-analysis': []
}>()

// ─── Tab navigation ────────────────────────────────────────────────────────────

type HubTab = 'overview' | 'members' | 'activity'

const TABS: Array<{ id: HubTab; label: string; title: string }> = [
  { id: 'overview',  label: 'Overview',  title: 'Overview — stats, recent open items, and quick actions' },
  { id: 'members',   label: 'Members',   title: 'Board Members — view and edit member profiles, contact details, and task preferences' },
  { id: 'activity',  label: 'Activity',  title: 'Activity Log — board action items imported from Maria analyses or added manually, with status and assignment tracking' },
]

const activeTab = ref<HubTab>('overview')

// ─── Composables ───────────────────────────────────────────────────────────────

const {
  members, memberCount,
  addMember, updateMember, removeMember, resetToDefaults,
} = useBoardMembers()

const {
  entries, totalCount, openCount, inProgressCount,
  importFromMaria, addManual, updateEntry, removeEntry,
} = useBoardActivityLog()

// ─── Overview tab computed ─────────────────────────────────────────────────────

const top5Open = computed(() =>
  entries.value.filter(e => e.status === 'open').slice(0, 5),
)

const lastAnalysisDate = computed<string | null>(() => {
  if (lastMariaResult.value) return lastMariaResult.value.generatedAt
  // Fall back to the most recent imported entry's source timestamp
  const sourced = entries.value.find(e => e.source)
  return sourced?.source?.mariaGeneratedAt ?? null
})

const lastAnalysisDisplay = computed<string>(() => {
  if (!lastAnalysisDate.value) return 'No analysis yet'
  const d = new Date(lastAnalysisDate.value)
  return isNaN(d.getTime())
    ? 'Unknown'
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
})

// ─── Members tab state ─────────────────────────────────────────────────────────

/** Which member card is in edit mode. null = display mode for all cards. */
const editingMemberId = ref<string | null>(null)

function startEdit(id: string): void { editingMemberId.value = id }
function doneEdit(): void            { editingMemberId.value = null }

function confirmRemoveMember(id: string, name: string): void {
  if (window.confirm(`Remove board member "${name || 'unnamed'}" from the roster? This cannot be undone.`)) {
    removeMember(id)
    if (editingMemberId.value === id) editingMemberId.value = null
  }
}

function handleAddMember(): void {
  const newId = addMember()
  editingMemberId.value = newId   // open the new card in edit mode immediately
}

function confirmReset(): void {
  if (window.confirm('Reset all board member profiles to the default placeholder data?\n\nAny names, contact details, or preferences you have entered will be LOST.')) {
    resetToDefaults()
    editingMemberId.value = null
  }
}

/** Convert array field to comma-separated string for textarea display. */
function arrayToCSV(arr: string[]): string {
  return arr.join(', ')
}

/** Parse comma-separated textarea value back to a clean string array. */
function csvToArray(csv: string): string[] {
  return csv.split(',').map(s => s.trim()).filter(Boolean)
}

// ── Avatar helpers (same palette as MariaAgentBoard) ──────────────────────────

const _AVATAR_PALETTE = [
  'bg-emerald-600', 'bg-blue-600', 'bg-violet-600', 'bg-rose-600',
  'bg-amber-600',   'bg-teal-600', 'bg-indigo-600', 'bg-pink-600',
]

function memberAvatarColor(id: string): string {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return _AVATAR_PALETTE[h % _AVATAR_PALETTE.length]
}

function memberInitials(name: string): string {
  return name
    .replace(/\[.*?\]/g, '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '?')
    .join('') || '?'
}

// ─── Activity tab state ────────────────────────────────────────────────────────

const activityFilter = ref<ActivityStatus | 'all'>('all')
const expandedEntryId = ref<string | null>(null)

/** Flash count shown after a Maria import. null = no flash. */
const importFlash = ref<number | null>(null)
let _importFlashTimer: ReturnType<typeof setTimeout> | null = null

function toggleExpand(id: string): void {
  expandedEntryId.value = expandedEntryId.value === id ? null : id
}

const filteredEntries = computed(() => {
  if (activityFilter.value === 'all') return entries.value
  return entries.value.filter(e => e.status === activityFilter.value)
})

function handleImportFromMaria(): void {
  if (!lastMariaResult.value) return
  const count = importFromMaria(lastMariaResult.value)
  importFlash.value = count
  if (_importFlashTimer) clearTimeout(_importFlashTimer)
  _importFlashTimer = setTimeout(() => { importFlash.value = null }, 4000)
}

function handleAddManual(): void {
  const newId = addManual()
  expandedEntryId.value = newId   // open newly created item immediately
  activityFilter.value  = 'all'   // ensure it's visible
}

function confirmRemoveEntry(id: string, title: string): void {
  if (window.confirm(`Remove activity item "${title || 'untitled'}"? This cannot be undone.`)) {
    removeEntry(id)
    if (expandedEntryId.value === id) expandedEntryId.value = null
  }
}

function toggleAssignee(entryId: string, memberId: string, currentIds: string[]): void {
  const updated = currentIds.includes(memberId)
    ? currentIds.filter(id => id !== memberId)
    : [...currentIds, memberId]
  updateEntry(entryId, { assignedMemberIds: updated })
}

// ─── Type + status display helpers ────────────────────────────────────────────

const TYPE_META: Record<ActivityType, { emoji: string; label: string; badge: string }> = {
  'governance-gap':  { emoji: '📋', label: 'Governance Gap',  badge: 'bg-amber-100 text-amber-800 ring-1 ring-amber-200' },
  'authority-gap':   { emoji: '⚑',  label: 'Authority Gap',   badge: 'bg-indigo-100 text-indigo-800 ring-1 ring-indigo-200' },
  'pattern-action':  { emoji: '🔮', label: 'Pattern Action',  badge: 'bg-violet-100 text-violet-800 ring-1 ring-violet-200' },
  'manual':          { emoji: '✏️', label: 'Manual',           badge: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200' },
}

const STATUS_META: Record<ActivityStatus, { label: string; badge: string; dot: string }> = {
  'open':        { label: 'Open',        badge: 'bg-amber-100 text-amber-800',   dot: 'bg-amber-400' },
  'in-progress': { label: 'In Progress', badge: 'bg-blue-100 text-blue-800',     dot: 'bg-blue-400' },
  'done':        { label: 'Done',        badge: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-400' },
}

function memberName(id: string): string {
  return members.value.find(m => m.id === id)?.name || id
}

// ─── Email Board Report ────────────────────────────────────────────────────────

function buildReportHtml(): string {
  const openItems = entries.value.filter(e => e.status === 'open' || e.status === 'in-progress')
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  const membersRows = members.value.map(m => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#134e4a">${m.name || '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#0f766e">${m.role || '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#334155">${m.email || '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#334155">${m.phone || '—'}</td>
    </tr>`).join('')

  const activityRows = openItems.map(e => {
    const meta = TYPE_META[e.type]
    const statusMeta = STATUS_META[e.status]
    const assignees = e.assignedMemberIds.map(memberName).join(', ') || 'Unassigned'
    const due = e.dueDate || '—'
    return `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">${meta.emoji} ${e.title || '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#0f766e;font-weight:600">${meta.label}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-weight:600">${statusMeta.label}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#334155">${assignees}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#64748b">${due}</td>
    </tr>`}).join('')

  return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;max-width:800px;margin:0 auto;padding:24px;color:#1e293b">
<h1 style="font-size:22px;font-weight:800;color:#134e4a;margin-bottom:4px">🏛 Maria — Board Support Report</h1>
<p style="color:#64748b;margin-top:0;margin-bottom:24px">${today}</p>

<h2 style="font-size:15px;font-weight:700;color:#0f766e;border-bottom:2px solid #99f6e4;padding-bottom:4px;margin-bottom:12px">👥 Board Members</h2>
<table style="width:100%;border-collapse:collapse;margin-bottom:28px;font-size:13px">
  <thead>
    <tr style="background:#f0fdf4">
      <th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#0f766e">Name</th>
      <th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#0f766e">Role</th>
      <th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#0f766e">Email</th>
      <th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#0f766e">Phone</th>
    </tr>
  </thead>
  <tbody>${membersRows}</tbody>
</table>

<h2 style="font-size:15px;font-weight:700;color:#92400e;border-bottom:2px solid #fcd34d;padding-bottom:4px;margin-bottom:12px">📋 Open &amp; In-Progress Action Items (${openItems.length})</h2>
${openItems.length === 0
  ? '<p style="color:#64748b;font-size:13px">No open items at this time.</p>'
  : `<table style="width:100%;border-collapse:collapse;margin-bottom:28px;font-size:13px">
  <thead>
    <tr style="background:#fffbeb">
      <th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#92400e">Item</th>
      <th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#92400e">Type</th>
      <th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#92400e">Status</th>
      <th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#92400e">Assigned To</th>
      <th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#92400e">Due</th>
    </tr>
  </thead>
  <tbody>${activityRows}</tbody>
</table>`}

<p style="font-size:11px;color:#94a3b8;margin-top:32px;border-top:1px solid #e2e8f0;padding-top:12px">
  Generated by Maria Board Support Hub · SEM App · ${new Date().toISOString()}
</p>
</body></html>`
}

function sendBoardReport(): void {
  const html = buildReportHtml()
  openEml(html, '🏛 Maria — Board Support Report', { to: [] })
}

function copyBoardReport(): void {
  const html = buildReportHtml()
  const blob  = new Blob([html], { type: 'text/html' })
  const item  = new ClipboardItem({ 'text/html': blob })
  navigator.clipboard.write([item]).catch(() => {
    // Plain-text fallback
    const text = `Maria Board Report — ${new Date().toLocaleDateString()}\n\nMembers: ${memberCount.value}\nOpen items: ${openCount.value}`
    navigator.clipboard.writeText(text)
  })
}
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <div
      class="fixed inset-0 z-[493] bg-black/60 backdrop-blur-sm"
      aria-hidden="true"
      @click="emit('close')"
    />

    <!-- Panel card -->
    <div
      class="fixed inset-0 z-[497] flex items-center justify-center p-4 pointer-events-none"
      role="dialog"
      aria-modal="true"
      aria-label="Maria Board Support Hub"
    >
      <div class="pointer-events-auto w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden bg-white ring-1 ring-black/10">

        <!-- ── Header ── -->
        <div class="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-teal-800 to-teal-700 shrink-0">
          <span class="text-2xl" aria-hidden="true">🏛</span>
          <div class="flex-1 min-w-0">
            <h2 class="text-base font-bold text-white leading-tight tracking-tight">Maria — Board Support Hub</h2>
            <p class="text-[11px] text-white/60 leading-tight mt-0.5">
              Members · Activity log · Analysis
            </p>
          </div>

          <!-- Tab pills — inside header, before CloseDot -->
          <div class="flex gap-1">
            <button
              v-for="tab in TABS"
              :key="tab.id"
              type="button"
              :title="tab.title"
              :aria-label="tab.title"
              :aria-pressed="activeTab === tab.id"
              class="text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all focus:outline-none focus:ring-1 focus:ring-white/50"
              :class="activeTab === tab.id
                ? 'bg-white text-teal-800 font-bold shadow-sm'
                : 'text-white/70 hover:text-white hover:bg-white/20'"
              @click="activeTab = tab.id"
            >{{ tab.label }}</button>
          </div>

          <CloseDot
            variant="on-dark"
            aria-label="Close Maria Board Hub"
            title="Close Maria Board Hub — return to the main workspace"
            @click="emit('close')"
          />
        </div>

        <!-- ── Body ── -->
        <ScrollContainer
          outer-class="flex-1 min-h-0 relative"
          inner-class="p-5"
        >

          <!-- ════════════════════════════════════════ OVERVIEW TAB ══ -->
          <div v-if="activeTab === 'overview'">

            <!-- Stat cards -->
            <div class="grid grid-cols-3 gap-3 mb-5">
              <button
                type="button"
                title="Board Members — single-click to open the Members tab and view or edit member profiles"
                class="rounded-xl bg-teal-50 border border-teal-200 p-4 text-center cursor-pointer hover:bg-teal-100 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-400"
                @click="activeTab = 'members'"
              >
                <div class="text-2xl font-black text-teal-700">{{ memberCount }}</div>
                <div class="text-[10px] text-teal-600 font-bold uppercase tracking-wide mt-0.5">Members</div>
                <div class="text-[9px] text-teal-500 mt-0.5">View profiles →</div>
              </button>
              <button
                type="button"
                title="Open Activity Items — single-click to open the Activity tab and manage open board action items"
                class="rounded-xl bg-amber-50 border border-amber-200 p-4 text-center cursor-pointer hover:bg-amber-100 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400"
                @click="activeTab = 'activity'"
              >
                <div class="text-2xl font-black text-amber-700">{{ openCount }}</div>
                <div class="text-[10px] text-amber-600 font-bold uppercase tracking-wide mt-0.5">Open Items</div>
                <div class="text-[9px] text-amber-500 mt-0.5">{{ inProgressCount }} in progress</div>
              </button>
              <div class="rounded-xl bg-slate-50 border border-slate-200 p-4 text-center">
                <div class="text-sm font-black text-slate-600 leading-snug">{{ lastAnalysisDisplay }}</div>
                <div class="text-[10px] text-slate-500 font-bold uppercase tracking-wide mt-0.5">Last Analysis</div>
                <div class="text-[9px] text-slate-400 mt-0.5">{{ totalCount }} items total</div>
              </div>
            </div>

            <!-- Recent open items (top 5) -->
            <div class="rounded-xl border border-slate-200 overflow-hidden mb-5">
              <div class="px-4 py-3 bg-slate-50 border-b border-slate-200">
                <span class="text-sm font-bold text-slate-700">Recent Open Items</span>
                <span class="text-xs text-slate-400 ml-2">top {{ Math.min(5, top5Open.length) }} of {{ openCount }}</span>
              </div>
              <div v-if="top5Open.length === 0" class="px-4 py-6 text-center">
                <p class="text-sm text-slate-400 mb-2">No open items yet.</p>
                <p class="text-xs text-slate-400">Run an analysis and import results, or add items manually in the Activity tab.</p>
              </div>
              <div v-else class="divide-y divide-slate-100">
                <div
                  v-for="entry in top5Open"
                  :key="entry.id"
                  class="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors cursor-pointer"
                  :title="`${TYPE_META[entry.type].label}: ${entry.title} — single-click to view in Activity tab`"
                  @click="activeTab = 'activity'; expandedEntryId = entry.id"
                >
                  <span class="text-base shrink-0" aria-hidden="true">{{ TYPE_META[entry.type].emoji }}</span>
                  <p class="text-xs text-slate-700 flex-1 truncate font-medium">{{ entry.title || 'Untitled item' }}</p>
                  <span
                    v-if="entry.assignedMemberIds.length"
                    class="text-[9px] text-teal-700 bg-teal-50 border border-teal-200 rounded-full px-2 py-0.5 font-semibold shrink-0"
                  >{{ entry.assignedMemberIds.map(memberName).join(', ') }}</span>
                  <span v-if="entry.dueDate" class="text-[9px] text-slate-400 shrink-0">{{ entry.dueDate }}</span>
                </div>
              </div>
            </div>

            <!-- Action buttons row -->
            <div class="flex flex-wrap gap-3">
              <button
                type="button"
                title="Run New Analysis — single-click to open the Maria analysis panel and paste a new board document for analysis"
                class="flex-1 min-w-[160px] rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold py-3 px-4 transition-all shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
                @click="emit('open-analysis')"
              >📊 Run New Analysis</button>
              <button
                type="button"
                title="Email Board Report — single-click to open a pre-formatted board report email with member list and open action items in Mail.app"
                class="flex-1 min-w-[160px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold py-3 px-4 transition-all shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                @click="sendBoardReport"
              >📧 Email Board Report</button>
              <button
                type="button"
                title="Copy Board Report — single-click to copy the board report as formatted HTML to the clipboard (paste into any email client or document)"
                class="rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold py-3 px-4 transition-all focus:outline-none focus:ring-2 focus:ring-slate-400"
                @click="copyBoardReport"
              >📋 Copy</button>
            </div>
          </div>

          <!-- ════════════════════════════════════════ MEMBERS TAB ══ -->
          <div v-else-if="activeTab === 'members'">

            <!-- Toolbar -->
            <div class="flex items-center justify-between mb-4">
              <p class="text-xs text-slate-500 leading-relaxed max-w-lg">
                Edit member profiles — changes save automatically and power the auto-suggest chips in Maria analysis results.
                Array fields (interests, abilities, etc.) use comma-separated values.
              </p>
              <div class="flex gap-2 shrink-0 ml-3">
                <button
                  type="button"
                  title="Add Member — single-click to add a new blank board member card"
                  class="text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg px-3 py-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-400"
                  @click="handleAddMember"
                >+ Add Member</button>
                <button
                  type="button"
                  title="Reset to Defaults — single-click to reset all profiles to the initial placeholder data. WARNING: any real names or contact details you have entered will be lost."
                  class="text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg px-3 py-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-rose-400"
                  @click="confirmReset"
                >Reset to defaults</button>
              </div>
            </div>

            <!-- Member card grid -->
            <div class="grid grid-cols-2 gap-3">
              <div
                v-for="member in members"
                :key="member.id"
                class="rounded-xl border border-slate-200 overflow-hidden"
              >
                <!-- ── Display mode ── -->
                <div v-if="editingMemberId !== member.id" class="bg-slate-50 p-3">
                  <div class="flex items-center gap-2 mb-2">
                    <div
                      class="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-black text-white"
                      :class="memberAvatarColor(member.id)"
                      aria-hidden="true"
                    >{{ memberInitials(member.name) }}</div>
                    <div class="min-w-0 flex-1">
                      <p class="text-xs font-bold text-slate-800 truncate">{{ member.name || '(no name)' }}</p>
                      <p class="text-[10px] text-slate-500">{{ member.role || '(no role)' }}</p>
                    </div>
                    <button
                      type="button"
                      :title="`Edit ${member.name || 'member'} — single-click to edit name, contact, and preferences`"
                      class="shrink-0 text-[10px] font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg px-2.5 py-1 transition-colors focus:outline-none focus:ring-1 focus:ring-teal-400"
                      @click="startEdit(member.id)"
                    >Edit</button>
                  </div>
                  <div v-if="member.email || member.phone" class="mb-2 space-y-0.5">
                    <p v-if="member.email" class="text-[9px] text-slate-500 truncate">✉ {{ member.email }}</p>
                    <p v-if="member.phone" class="text-[9px] text-slate-500">📞 {{ member.phone }}</p>
                  </div>
                  <div v-if="member.specialInterests.length" class="flex flex-wrap gap-1">
                    <span v-for="i in member.specialInterests.slice(0, 4)" :key="i"
                      class="text-[8px] bg-blue-50 border border-blue-200 text-blue-700 rounded-full px-1.5 py-0.5">{{ i }}</span>
                    <span v-if="member.specialInterests.length > 4" class="text-[8px] text-slate-400">+{{ member.specialInterests.length - 4 }}</span>
                  </div>
                </div>

                <!-- ── Edit mode ── -->
                <div v-else class="bg-white p-3 space-y-2">
                  <!-- Name + Role -->
                  <div class="grid grid-cols-2 gap-2">
                    <div>
                      <label class="text-[9px] font-bold uppercase tracking-wide text-slate-400 block mb-0.5">Name</label>
                      <input
                        type="text"
                        :value="member.name"
                        placeholder="Full name"
                        class="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-500 bg-white"
                        :title="`Name — full display name for ${member.name || 'this member'}`"
                        @blur="updateMember(member.id, { name: ($event.target as HTMLInputElement).value })"
                      />
                    </div>
                    <div>
                      <label class="text-[9px] font-bold uppercase tracking-wide text-slate-400 block mb-0.5">Role</label>
                      <input
                        type="text"
                        :value="member.role"
                        placeholder="Board Chair"
                        class="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-500 bg-white"
                        title="Role — board title or position"
                        @blur="updateMember(member.id, { role: ($event.target as HTMLInputElement).value })"
                      />
                    </div>
                  </div>
                  <!-- Contact -->
                  <div>
                    <label class="text-[9px] font-bold uppercase tracking-wide text-slate-400 block mb-0.5">Email</label>
                    <input type="email" :value="member.email" placeholder="email@board.org"
                      class="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-500 bg-white"
                      title="Email address for pre-populated board report emails"
                      @blur="updateMember(member.id, { email: ($event.target as HTMLInputElement).value })" />
                  </div>
                  <div class="grid grid-cols-2 gap-2">
                    <div>
                      <label class="text-[9px] font-bold uppercase tracking-wide text-slate-400 block mb-0.5">Phone</label>
                      <input type="tel" :value="member.phone" placeholder="+1 (555) 000-0000"
                        class="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-500 bg-white"
                        title="Direct phone number"
                        @blur="updateMember(member.id, { phone: ($event.target as HTMLInputElement).value })" />
                    </div>
                    <div>
                      <label class="text-[9px] font-bold uppercase tracking-wide text-slate-400 block mb-0.5">Address</label>
                      <input type="text" :value="member.address" placeholder="City, State"
                        class="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-500 bg-white"
                        title="Mailing or home address"
                        @blur="updateMember(member.id, { address: ($event.target as HTMLInputElement).value })" />
                    </div>
                  </div>
                  <!-- Array fields -->
                  <div>
                    <label class="text-[9px] font-bold uppercase tracking-wide text-blue-400 block mb-0.5">Special Interests (comma-separated)</label>
                    <textarea :value="arrayToCSV(member.specialInterests)" rows="2" placeholder="finance, governance, education policy"
                      class="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white resize-none"
                      title="Special interests — domains and topics this member cares about. Matched against Maria's analysis output for auto-suggest."
                      @blur="updateMember(member.id, { specialInterests: csvToArray(($event.target as HTMLTextAreaElement).value) })" />
                  </div>
                  <div>
                    <label class="text-[9px] font-bold uppercase tracking-wide text-emerald-500 block mb-0.5">Special Abilities (comma-separated)</label>
                    <textarea :value="arrayToCSV(member.specialAbilities)" rows="2" placeholder="legal review, financial analysis"
                      class="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-white resize-none"
                      title="Special abilities — skills and expertise this member brings. Weighted highest (+3) in auto-suggest scoring."
                      @blur="updateMember(member.id, { specialAbilities: csvToArray(($event.target as HTMLTextAreaElement).value) })" />
                  </div>
                  <div>
                    <label class="text-[9px] font-bold uppercase tracking-wide text-teal-500 block mb-0.5">Volunteers For (comma-separated)</label>
                    <textarea :value="arrayToCSV(member.volunteersFor)" rows="2" placeholder="budget review, committee chair"
                      class="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-400 bg-white resize-none"
                      title="Volunteers for — types of tasks this member steps up to own (+2 in auto-suggest scoring)"
                      @blur="updateMember(member.id, { volunteersFor: csvToArray(($event.target as HTMLTextAreaElement).value) })" />
                  </div>
                  <div>
                    <label class="text-[9px] font-bold uppercase tracking-wide text-rose-400 block mb-0.5">Dislikes Tasks (comma-separated)</label>
                    <textarea :value="arrayToCSV(member.dislikesTasks)" rows="2" placeholder="fundraising calls, event logistics"
                      class="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-rose-400 bg-white resize-none"
                      title="Dislikes tasks — work this member tends to avoid (−2 in auto-suggest scoring, steers away from those tasks)"
                      @blur="updateMember(member.id, { dislikesTasks: csvToArray(($event.target as HTMLTextAreaElement).value) })" />
                  </div>
                  <div class="grid grid-cols-2 gap-2">
                    <div>
                      <label class="text-[9px] font-bold uppercase tracking-wide text-slate-400 block mb-0.5">Availability</label>
                      <input type="text" :value="member.availability" placeholder="Not July–August"
                        class="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-500 bg-white"
                        title="Availability constraints or scheduling notes"
                        @blur="updateMember(member.id, { availability: ($event.target as HTMLInputElement).value })" />
                    </div>
                    <div>
                      <label class="text-[9px] font-bold uppercase tracking-wide text-slate-400 block mb-0.5">Notes</label>
                      <input type="text" :value="member.notes" placeholder="Any other context"
                        class="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-500 bg-white"
                        title="Additional context for assignment decisions"
                        @blur="updateMember(member.id, { notes: ($event.target as HTMLInputElement).value })" />
                    </div>
                  </div>
                  <!-- Edit mode action row -->
                  <div class="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      title="Remove Member — single-click to permanently remove this board member from the roster"
                      class="text-[10px] font-bold text-rose-600 hover:text-rose-800 transition-colors focus:outline-none"
                      @click="confirmRemoveMember(member.id, member.name)"
                    >Remove member</button>
                    <button
                      type="button"
                      title="Done editing — single-click to close edit mode and return to card view (all changes are already saved)"
                      class="text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg px-3 py-1.5 transition-colors focus:outline-none focus:ring-1 focus:ring-teal-400"
                      @click="doneEdit"
                    >Done ✓</button>
                  </div>
                </div>
              </div>
            </div>

          </div>

          <!-- ════════════════════════════════════════ ACTIVITY TAB ══ -->
          <div v-else>

            <!-- Filter + action bar -->
            <div class="flex items-center gap-3 mb-4 flex-wrap">
              <!-- Status filter pills -->
              <div class="flex gap-1">
                <button v-for="f in (['all', 'open', 'in-progress', 'done'] as const)" :key="f"
                  type="button"
                  :title="`Show ${f === 'all' ? 'all' : f} activity items`"
                  class="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all focus:outline-none focus:ring-1 focus:ring-slate-400"
                  :class="activityFilter === f
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
                  @click="activityFilter = f"
                >{{ f === 'all' ? `All (${totalCount})` : f === 'open' ? `Open (${openCount})` : f === 'in-progress' ? `In Progress (${inProgressCount})` : 'Done' }}</button>
              </div>

              <div class="flex gap-2 ml-auto">
                <!-- Import from Maria -->
                <button
                  type="button"
                  :disabled="!lastMariaResult"
                  :title="lastMariaResult
                    ? 'Import from Last Analysis — single-click to import all governance gaps, authority gaps, and pattern concerns from the most recent Maria analysis into the activity log (duplicate items are skipped automatically)'
                    : 'Import from Last Analysis — run a Maria analysis first to enable this button'"
                  class="text-xs font-bold rounded-lg px-3 py-1.5 transition-all focus:outline-none focus:ring-1"
                  :class="lastMariaResult
                    ? 'text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 focus:ring-teal-400'
                    : 'text-slate-400 bg-slate-50 border border-slate-200 cursor-not-allowed'"
                  @click="handleImportFromMaria"
                >
                  <span v-if="importFlash !== null" class="text-emerald-700">
                    ✓ {{ importFlash }} item{{ importFlash !== 1 ? 's' : '' }} imported
                  </span>
                  <span v-else>⬇ Import from last analysis</span>
                </button>

                <!-- Add manual -->
                <button
                  type="button"
                  title="Add Manual Item — single-click to add a new blank board action item not linked to a Maria analysis"
                  class="text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg px-3 py-1.5 transition-all focus:outline-none focus:ring-1 focus:ring-slate-400"
                  @click="handleAddManual"
                >+ Add manual item</button>
              </div>
            </div>

            <!-- Empty state -->
            <div v-if="filteredEntries.length === 0" class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-10 text-center">
              <p class="text-sm text-slate-400 mb-1">
                {{ activityFilter === 'all' ? 'No activity items yet.' : `No ${activityFilter} items.` }}
              </p>
              <p class="text-xs text-slate-400">
                {{ activityFilter === 'all'
                  ? 'Run a Maria analysis and click "Import from last analysis", or add items manually above.'
                  : 'Switch to "All" to see items in other statuses.' }}
              </p>
            </div>

            <!-- Entry list -->
            <div v-else class="space-y-2">
              <div
                v-for="entry in filteredEntries"
                :key="entry.id"
                class="rounded-xl border overflow-hidden transition-all"
                :class="entry.status === 'done' ? 'border-slate-200 opacity-70' : 'border-slate-200'"
              >
                <!-- Row summary (always visible) -->
                <button
                  type="button"
                  class="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-slate-50 transition-colors text-left focus:outline-none focus:ring-1 focus:ring-inset focus:ring-teal-400"
                  :title="`${TYPE_META[entry.type].label}: ${entry.title || 'Untitled'} — single-click to expand for full detail, status controls, and assignee selection`"
                  @click="toggleExpand(entry.id)"
                >
                  <!-- Status dot -->
                  <span
                    class="w-2.5 h-2.5 rounded-full shrink-0"
                    :class="STATUS_META[entry.status].dot"
                    :title="`Status: ${STATUS_META[entry.status].label}`"
                  />
                  <!-- Type emoji -->
                  <span class="text-base shrink-0" aria-hidden="true">{{ TYPE_META[entry.type].emoji }}</span>
                  <!-- Title -->
                  <p class="text-xs font-semibold text-slate-800 flex-1 truncate">{{ entry.title || 'Untitled item' }}</p>
                  <!-- Type badge -->
                  <span class="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0" :class="TYPE_META[entry.type].badge">
                    {{ TYPE_META[entry.type].label }}
                  </span>
                  <!-- Assignees -->
                  <span
                    v-if="entry.assignedMemberIds.length"
                    class="text-[9px] text-teal-700 bg-teal-50 border border-teal-200 rounded-full px-2 py-0.5 font-semibold shrink-0 max-w-[120px] truncate"
                    :title="entry.assignedMemberIds.map(memberName).join(', ')"
                  >{{ entry.assignedMemberIds.map(memberName).join(', ') }}</span>
                  <!-- Due date -->
                  <span v-if="entry.dueDate" class="text-[9px] text-slate-400 shrink-0">{{ entry.dueDate }}</span>
                  <!-- Expand chevron -->
                  <span class="text-slate-300 text-xs ml-1 shrink-0">{{ expandedEntryId === entry.id ? '▲' : '▼' }}</span>
                </button>

                <!-- Expanded detail -->
                <div v-if="expandedEntryId === entry.id" class="px-4 pb-4 bg-slate-50 border-t border-slate-100 space-y-3">

                  <!-- Title edit -->
                  <div class="pt-3">
                    <label class="text-[9px] font-bold uppercase tracking-wide text-slate-400 block mb-1">Title</label>
                    <input
                      type="text"
                      :value="entry.title"
                      placeholder="Brief action item title"
                      class="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-teal-500 bg-white"
                      title="Title — one-sentence summary of this board action item"
                      @blur="updateEntry(entry.id, { title: ($event.target as HTMLInputElement).value })"
                    />
                  </div>

                  <!-- Detail text -->
                  <div>
                    <label class="text-[9px] font-bold uppercase tracking-wide text-slate-400 block mb-1">Detail</label>
                    <textarea
                      :value="entry.detail"
                      rows="3"
                      placeholder="Full context, significance, and opportunity…"
                      class="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-teal-500 bg-white resize-none"
                      title="Detail — full text of the significance and opportunity for board action"
                      @blur="updateEntry(entry.id, { detail: ($event.target as HTMLTextAreaElement).value })"
                    />
                  </div>

                  <!-- Status + Due date row -->
                  <div class="flex gap-3">
                    <div class="flex-1">
                      <label class="text-[9px] font-bold uppercase tracking-wide text-slate-400 block mb-1">Status</label>
                      <select
                        :value="entry.status"
                        class="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-teal-500 bg-white"
                        title="Status — single-click to change the lifecycle status of this action item"
                        @change="updateEntry(entry.id, { status: ($event.target as HTMLSelectElement).value as ActivityStatus })"
                      >
                        <option value="open">Open</option>
                        <option value="in-progress">In Progress</option>
                        <option value="done">Done</option>
                      </select>
                    </div>
                    <div class="flex-1">
                      <label class="text-[9px] font-bold uppercase tracking-wide text-slate-400 block mb-1">Due Date</label>
                      <input
                        type="date"
                        :value="entry.dueDate ?? ''"
                        class="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-teal-500 bg-white"
                        title="Due date — target date for completing this action item"
                        @change="updateEntry(entry.id, { dueDate: ($event.target as HTMLInputElement).value || undefined })"
                      />
                    </div>
                  </div>

                  <!-- Assign to members -->
                  <div>
                    <label class="text-[9px] font-bold uppercase tracking-wide text-slate-400 block mb-1.5">Assigned To</label>
                    <div class="flex flex-wrap gap-1.5">
                      <button
                        v-for="member in members"
                        :key="member.id"
                        type="button"
                        :title="`${member.name} (${member.role}) — single-click to toggle assignment of this action item`"
                        class="text-[10px] font-semibold rounded-full px-2.5 py-1 border transition-all focus:outline-none focus:ring-1"
                        :class="entry.assignedMemberIds.includes(member.id)
                          ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-300 hover:border-teal-400 hover:text-teal-700'"
                        @click="toggleAssignee(entry.id, member.id, entry.assignedMemberIds)"
                      >
                        <span :class="memberAvatarColor(member.id)" class="inline-block w-3.5 h-3.5 rounded-full text-[7px] font-black text-white leading-3.5 text-center mr-1">{{ memberInitials(member.name) }}</span>{{ member.name || '(unnamed)' }}
                      </button>
                    </div>
                  </div>

                  <!-- Source traceability -->
                  <p v-if="entry.source" class="text-[9px] text-slate-400">
                    📎 Imported from Maria analysis of {{ new Date(entry.source.mariaGeneratedAt).toLocaleDateString('en-GB') }}
                    · item {{ entry.source.itemId }}
                  </p>

                  <!-- Remove button -->
                  <div class="flex justify-end pt-1">
                    <button
                      type="button"
                      :title="`Remove this action item — single-click to permanently delete '${entry.title || 'this item'}' from the activity log`"
                      class="text-[10px] font-bold text-rose-600 hover:text-rose-800 transition-colors focus:outline-none"
                      @click="confirmRemoveEntry(entry.id, entry.title)"
                    >Remove item</button>
                  </div>

                </div>
              </div>
            </div>

          </div>

        </ScrollContainer>
      </div>
    </div>
  </Teleport>
</template>
