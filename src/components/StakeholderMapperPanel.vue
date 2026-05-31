<!--
  StakeholderMapperPanel.vue — AI-Drafted Stakeholder Attribute Profiles.

  Full-screen indigo panel at z-[600]. Left sidebar lists stakeholders;
  right content shows a 10-attribute profile grid for the selected entity.
  Supports inanimate stakeholders (data, regulations) — uses "entities",
  not "people".

  UI Rules satisfied:
    ScrollContainer rule  — all scrollable areas wrapped in ScrollContainer.
    CloseDot rule         — CloseDot variant="on-dark" at END of header.
    Single-Surface rule   — caller registers 'stakeholderMapper'.
    Define-by-Selection   — no select-none on body content.
    DD-009 Zero-Training  — all buttons have title= attribute.
    z-[600]               — within Major surfaces tier; below z-[700] SelectionDefiner.
    Static Tailwind only  — no runtime class concatenation.
    Inanimate support     — UI says "entities", not "people".
-->
<script setup lang="ts">
// UNIT_TYPE=Panel
import { ref, computed } from 'vue'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'
import {
  useStakeholderMapper,
  ATTRIBUTE_DEFS,
} from '../composables/useStakeholderMapper'
import type { MappedStakeholder, StakeholderType, AttributeLevel } from '../composables/useStakeholderMapper'

const emit = defineEmits<{ close: [] }>()

// ── Composable ────────────────────────────────────────────────────────────────

const mapper = useStakeholderMapper()

// ── Navigation / form state ───────────────────────────────────────────────────

const searchQuery    = ref('')
const showAddForm    = ref(false)
const newName        = ref('')
const newRole        = ref('')
const newType        = ref<StakeholderType>('organization')
const newDescription = ref('')

// Attribute inline-edit state
const editingAttrId    = ref<string | null>(null)
const editAttrValue    = ref<number>(3)
const editAttrUrl      = ref('')
const editAttrFact     = ref('')

// ── Derived data ──────────────────────────────────────────────────────────────

const filteredStakeholders = computed<MappedStakeholder[]>(() => {
  const q = searchQuery.value.toLowerCase().trim()
  if (!q) return mapper.stakeholders.value
  return mapper.stakeholders.value.filter(
    s => s.name.toLowerCase().includes(q) || s.role.toLowerCase().includes(q),
  )
})

const selected = computed<MappedStakeholder | null>(() => {
  const id = mapper.selectedId.value
  if (!id) return null
  return mapper.stakeholders.value.find(s => s.id === id) ?? null
})

// ── Type chip helpers (static class map — no runtime concatenation) ───────────

const TYPE_CHIP_CLASS: Record<StakeholderType, string> = {
  organization: 'bg-blue-100 text-blue-700',
  government:   'bg-purple-100 text-purple-700',
  person:       'bg-green-100 text-green-700',
  system:       'bg-amber-100 text-amber-700',
  regulatory:   'bg-red-100 text-red-700',
  inanimate:    'bg-slate-100 text-slate-600',
}

const TYPE_LABEL: Record<StakeholderType, string> = {
  organization: 'Org',
  government:   'Gov',
  person:       'Person',
  system:       'System',
  regulatory:   'Regulatory',
  inanimate:    'Inanimate',
}

// ── Confidence badge (static class map) ───────────────────────────────────────

const CONF_CLASS: Record<string, string> = {
  high:   'bg-blue-100 text-blue-700',
  medium: 'bg-amber-100 text-amber-700',
  low:    'bg-red-100 text-red-700',
}

const CONF_LABEL: Record<string, string> = {
  high:   'High',
  medium: 'Medium',
  low:    'Low',
}

// ── Severity dot colours (static) ─────────────────────────────────────────────
// (not used in this panel but kept for completeness)

// ── Actions ───────────────────────────────────────────────────────────────────

function select(id: string): void {
  mapper.selectStakeholder(id)
  showAddForm.value = false
}

function openAdd(): void {
  showAddForm.value  = true
  newName.value      = ''
  newRole.value      = ''
  newType.value      = 'organization'
  newDescription.value = ''
  mapper.selectStakeholder(null)
}

function cancelAdd(): void {
  showAddForm.value = false
}

function submitAdd(): void {
  if (!newName.value.trim()) return
  const sh = mapper.addStakeholder(
    newName.value,
    newRole.value,
    newType.value,
    newDescription.value,
  )
  showAddForm.value = false
  mapper.selectStakeholder(sh.id)
}

function analyze(id: string): void {
  void mapper.draftAttributes(id)
}

function removeSelected(): void {
  if (!selected.value) return
  mapper.removeStakeholder(selected.value.id)
}

// ── Attribute inline edit ─────────────────────────────────────────────────────

function startEdit(attrId: string, attr: AttributeLevel | undefined): void {
  editingAttrId.value = attrId
  editAttrValue.value = attr?.value ?? 3
  editAttrUrl.value   = attr?.sourceUrl ?? ''
  editAttrFact.value  = attr?.sourceFact ?? ''
}

function saveEdit(): void {
  if (!selected.value || !editingAttrId.value) return
  const id     = selected.value.id
  const attrId = editingAttrId.value
  const def    = ATTRIBUTE_DEFS.find(a => a.id === attrId)
  if (!def) return
  const levelDef = def.levels[editAttrValue.value - 1]

  const updated = {
    ...selected.value.attributes,
    [attrId]: {
      value:       editAttrValue.value,
      levelLabel:  levelDef.label,
      confidence:  'high' as const,
      sourceUrl:   editAttrUrl.value.trim(),
      sourceFact:  editAttrFact.value.trim(),
      aiRationale: '',
      lastUpdated: new Date().toISOString(),
    } satisfies AttributeLevel,
  }
  mapper.updateStakeholder(id, { attributes: updated })
  editingAttrId.value = null
}

function cancelEdit(): void {
  editingAttrId.value = null
}

// ── URL display helper ────────────────────────────────────────────────────────

function truncateUrl(url: string, maxLen = 40): string {
  if (!url) return ''
  try {
    const u = new URL(url)
    const display = u.hostname + u.pathname
    return display.length > maxLen ? display.slice(0, maxLen - 1) + '…' : display
  } catch {
    return url.length > maxLen ? url.slice(0, maxLen - 1) + '…' : url
  }
}

// ── Summary score (average of all 10 attributes) ──────────────────────────────

function avgScore(sh: MappedStakeholder): number | null {
  const vals = ATTRIBUTE_DEFS.map(a => sh.attributes[a.id]?.value).filter(v => v != null) as number[]
  if (vals.length === 0) return null
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10
}
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <div
      class="fixed inset-0 z-[598] bg-black/50 backdrop-blur-sm"
      aria-hidden="true"
      @click="emit('close')"
    />

    <!-- Panel card -->
    <div
      class="fixed inset-0 z-[600] flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="Stakeholder Mapper — AI-drafted attribute profiles"
    >
      <!-- INDIGO HEADER -->
      <div class="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-indigo-800 to-indigo-700 shrink-0 select-none">
        <span class="text-xl" aria-hidden="true">👥</span>
        <div class="flex-1 min-w-0">
          <h2 class="text-base font-bold text-white leading-tight tracking-tight">Stakeholder Mapper</h2>
          <p class="text-[11px] text-white/60 leading-tight mt-0.5">AI-Drafted Attribute Profiles — supports inanimate entities</p>
        </div>
        <!-- Add button -->
        <button
          type="button"
          class="shrink-0 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
          title="Add a new stakeholder entity — opens the add form"
          @click="openAdd"
        >
          + Add Entity
        </button>
        <CloseDot
          variant="on-dark"
          title="Close Stakeholder Mapper — return to main planning workspace"
          @click="emit('close')"
        />
      </div>

      <!-- BODY: sidebar + content -->
      <div class="flex flex-1 min-h-0 bg-white">

        <!-- LEFT SIDEBAR -->
        <div class="w-72 shrink-0 flex flex-col border-r border-indigo-100 bg-indigo-50/40">
          <!-- Search -->
          <div class="p-3 border-b border-indigo-100 shrink-0">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search entities…"
              class="w-full px-3 py-2 rounded-lg border border-indigo-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder-slate-400"
              aria-label="Filter stakeholders by name or role"
            />
          </div>

          <!-- Stakeholder list -->
          <ScrollContainer
            outer-class="flex-1 min-h-0 relative"
            inner-class="p-2 space-y-1"
          >
            <!-- Add form (inline) -->
            <div
              v-if="showAddForm"
              class="rounded-xl bg-white ring-2 ring-indigo-400 p-3 mb-2 flex flex-col gap-2"
            >
              <p class="text-xs font-semibold text-indigo-700">New Stakeholder Entity</p>
              <input
                v-model="newName"
                type="text"
                placeholder="Name (e.g. Google LLC, GDPR)"
                class="w-full px-2 py-1.5 rounded-md border border-indigo-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
                aria-label="Stakeholder name"
              />
              <input
                v-model="newRole"
                type="text"
                placeholder="Role (e.g. Regulatory Body)"
                class="w-full px-2 py-1.5 rounded-md border border-indigo-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
                aria-label="Stakeholder role"
              />
              <select
                v-model="newType"
                class="w-full px-2 py-1.5 rounded-md border border-indigo-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                aria-label="Stakeholder type"
              >
                <option value="person">Person</option>
                <option value="organization">Organization</option>
                <option value="government">Government</option>
                <option value="system">System</option>
                <option value="regulatory">Regulatory</option>
                <option value="inanimate">Inanimate (data, regulation, etc.)</option>
              </select>
              <textarea
                v-model="newDescription"
                placeholder="Brief description (optional)"
                class="w-full px-2 py-1.5 rounded-md border border-indigo-200 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
                rows="2"
                aria-label="Stakeholder description"
              />
              <div class="flex gap-2">
                <button
                  type="button"
                  class="flex-1 px-2 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors"
                  title="Save new stakeholder and trigger AI attribute analysis"
                  @click="submitAdd"
                >
                  Save &amp; Analyze
                </button>
                <button
                  type="button"
                  class="px-2 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium transition-colors"
                  title="Cancel — discard new entity"
                  @click="cancelAdd"
                >
                  Cancel
                </button>
              </div>
            </div>

            <!-- Stakeholder list items -->
            <button
              v-for="sh in filteredStakeholders"
              :key="sh.id"
              type="button"
              :class="[
                'w-full text-left rounded-lg px-3 py-2.5 transition-colors flex items-start gap-2',
                mapper.selectedId.value === sh.id
                  ? 'bg-indigo-600 text-white ring-2 ring-indigo-400'
                  : 'bg-white hover:bg-indigo-50 text-slate-800 ring-1 ring-slate-100',
              ]"
              :title="`Select ${sh.name} — ${sh.role} (${sh.type})`"
              @click="select(sh.id)"
            >
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="text-xs font-semibold leading-tight truncate">{{ sh.name }}</span>
                  <span
                    :class="[
                      'shrink-0 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded',
                      mapper.selectedId.value === sh.id ? 'bg-white/20 text-white' : TYPE_CHIP_CLASS[sh.type],
                    ]"
                  >
                    {{ TYPE_LABEL[sh.type] }}
                  </span>
                </div>
                <p
                  :class="[
                    'text-[10px] leading-tight mt-0.5 truncate',
                    mapper.selectedId.value === sh.id ? 'text-white/70' : 'text-slate-500',
                  ]"
                >
                  {{ sh.role }}
                </p>
                <!-- Draft status indicator -->
                <div class="flex items-center gap-1 mt-1">
                  <span
                    v-if="sh.draftStatus === 'drafting'"
                    :class="['text-[9px]', mapper.selectedId.value === sh.id ? 'text-white/80' : 'text-indigo-500']"
                  >
                    ⟳ Analyzing…
                  </span>
                  <span
                    v-else-if="sh.draftStatus === 'done'"
                    :class="['text-[9px]', mapper.selectedId.value === sh.id ? 'text-white/70' : 'text-emerald-600']"
                  >
                    ✓ Analyzed
                  </span>
                  <span
                    v-else-if="sh.draftStatus === 'error'"
                    :class="['text-[9px]', mapper.selectedId.value === sh.id ? 'text-red-200' : 'text-red-500']"
                  >
                    ✕ Error
                  </span>
                  <span
                    v-else
                    :class="['text-[9px]', mapper.selectedId.value === sh.id ? 'text-white/50' : 'text-slate-400']"
                  >
                    Not yet analyzed
                  </span>
                </div>
              </div>
            </button>

            <!-- Empty search state -->
            <div
              v-if="filteredStakeholders.length === 0"
              class="text-center text-xs text-slate-400 py-6"
            >
              No entities match "{{ searchQuery }}"
            </div>
          </ScrollContainer>
        </div>

        <!-- RIGHT CONTENT -->
        <div class="flex-1 min-w-0 flex flex-col">
          <!-- No selection state -->
          <div
            v-if="!selected && !showAddForm"
            class="flex-1 flex items-center justify-center text-center px-8"
          >
            <div>
              <div class="text-5xl mb-4" aria-hidden="true">👥</div>
              <h3 class="text-lg font-semibold text-slate-700 mb-2">Select a Stakeholder Entity</h3>
              <p class="text-sm text-slate-500 max-w-sm leading-relaxed">
                Choose an entity from the left panel to view its 10-attribute profile,
                or add a new entity (person, organisation, government, system, regulation,
                or inanimate subject such as data or a law).
              </p>
              <button
                type="button"
                class="mt-5 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
                title="Add a new stakeholder entity — opens the add form in the sidebar"
                @click="openAdd"
              >
                + Add First Entity
              </button>
            </div>
          </div>

          <!-- Selected entity detail -->
          <template v-if="selected">
            <!-- Entity header bar -->
            <div class="shrink-0 px-6 py-4 border-b border-slate-100 bg-white flex items-start gap-4">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <h3 class="text-lg font-bold text-slate-800">{{ selected.name }}</h3>
                  <span :class="['text-[10px] font-bold uppercase px-2 py-0.5 rounded', TYPE_CHIP_CLASS[selected.type]]">
                    {{ selected.type }}
                  </span>
                </div>
                <p class="text-sm text-indigo-600 font-medium mt-0.5">{{ selected.role }}</p>
                <p class="text-xs text-slate-500 mt-1 leading-relaxed">{{ selected.description }}</p>
                <p v-if="selected.lastAnalyzed" class="text-[10px] text-slate-400 mt-1">
                  Last analyzed: {{ new Date(selected.lastAnalyzed).toLocaleString() }}
                </p>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <!-- Analyze button -->
                <button
                  v-if="selected.draftStatus === 'idle' || selected.draftStatus === 'error'"
                  type="button"
                  class="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors flex items-center gap-1.5"
                  title="Run AI analysis — drafts all 10 attribute levels with sources"
                  @click="analyze(selected.id)"
                >
                  🤖 Analyze Attributes
                </button>
                <button
                  v-else-if="selected.draftStatus === 'done'"
                  type="button"
                  class="px-3 py-1.5 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-xs font-semibold transition-colors"
                  title="Re-run AI analysis — overwrites existing attribute levels"
                  @click="analyze(selected.id)"
                >
                  🔄 Re-analyze
                </button>
                <div
                  v-else-if="selected.draftStatus === 'drafting'"
                  class="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-400 text-xs font-medium flex items-center gap-1.5"
                >
                  <svg class="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Analyzing…
                </div>
                <!-- Delete button -->
                <button
                  type="button"
                  class="px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold transition-colors"
                  title="Remove this stakeholder entity permanently"
                  @click="removeSelected"
                >
                  Remove
                </button>
              </div>
            </div>

            <ScrollContainer
              outer-class="flex-1 min-h-0 relative"
              inner-class="px-6 py-4"
            >
              <!-- Summary grid (when attributes are loaded) -->
              <div
                v-if="selected.draftStatus === 'done' && Object.keys(selected.attributes).length > 0"
                class="mb-6"
              >
                <h4 class="text-sm font-bold text-slate-700 mb-3">Stakeholder Profile Summary</h4>
                <div class="grid grid-cols-5 gap-2">
                  <div
                    v-for="def in ATTRIBUTE_DEFS"
                    :key="def.id"
                    class="rounded-lg bg-indigo-50 border border-indigo-100 p-2 text-center"
                  >
                    <p class="text-[10px] font-semibold text-indigo-700 mb-1">{{ def.name }}</p>
                    <!-- Level dots -->
                    <div class="flex items-center justify-center gap-0.5 mb-1" aria-hidden="true">
                      <span
                        v-for="n in 5"
                        :key="n"
                        :class="[
                          'w-2 h-2 rounded-full inline-block',
                          (selected.attributes[def.id]?.value ?? 0) >= n ? 'bg-indigo-500' : 'bg-indigo-200',
                        ]"
                      />
                    </div>
                    <p class="text-[9px] text-slate-600 leading-tight">
                      {{ selected.attributes[def.id]?.levelLabel ?? '—' }}
                    </p>
                  </div>
                </div>
                <p v-if="avgScore(selected) !== null" class="text-xs text-slate-500 mt-2">
                  Average score: {{ avgScore(selected) }}/5
                </p>
              </div>

              <!-- Drafting state -->
              <div
                v-if="selected.draftStatus === 'drafting'"
                class="flex flex-col items-center justify-center py-16 text-center"
              >
                <svg class="animate-spin h-8 w-8 text-indigo-500 mb-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p class="text-sm font-medium text-indigo-600">Drafting attribute levels from AI knowledge…</p>
                <p class="text-xs text-slate-400 mt-1">This may take 15–30 seconds</p>
              </div>

              <!-- Idle state (not yet analyzed) -->
              <div
                v-else-if="selected.draftStatus === 'idle'"
                class="flex flex-col items-center justify-center py-16 text-center"
              >
                <div class="text-4xl mb-4" aria-hidden="true">🤖</div>
                <h4 class="text-base font-semibold text-slate-700 mb-2">Attributes Not Yet Analyzed</h4>
                <p class="text-sm text-slate-500 max-w-sm leading-relaxed mb-5">
                  Click "Analyze Attributes" to have AI draft all 10 attribute levels
                  with source URLs and specific facts for <strong>{{ selected.name }}</strong>.
                </p>
                <button
                  type="button"
                  class="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
                  title="Run AI analysis — drafts all 10 attribute levels with sources"
                  @click="analyze(selected.id)"
                >
                  🤖 Analyze Attributes
                </button>
              </div>

              <!-- Error state -->
              <div
                v-else-if="selected.draftStatus === 'error'"
                class="flex flex-col items-center justify-center py-12 text-center"
              >
                <div class="text-4xl mb-3" aria-hidden="true">⚠️</div>
                <h4 class="text-sm font-semibold text-red-600 mb-1">Analysis Failed</h4>
                <p class="text-xs text-slate-500 max-w-sm mb-4">{{ selected.draftError ?? 'Unknown error' }}</p>
                <button
                  type="button"
                  class="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors"
                  title="Retry AI attribute analysis"
                  @click="analyze(selected.id)"
                >
                  Retry Analysis
                </button>
              </div>

              <!-- Attribute detail rows -->
              <div
                v-else-if="selected.draftStatus === 'done'"
                class="space-y-4"
              >
                <h4 class="text-sm font-bold text-slate-700">Attribute Detail</h4>

                <div
                  v-for="def in ATTRIBUTE_DEFS"
                  :key="def.id"
                  class="rounded-xl border border-slate-200 bg-white p-4"
                >
                  <!-- Attribute header -->
                  <div class="flex items-start gap-3 mb-2">
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-sm font-bold text-slate-800">{{ def.name }}</span>
                        <!-- Level dots -->
                        <div class="flex items-center gap-0.5" aria-hidden="true">
                          <span
                            v-for="n in 5"
                            :key="n"
                            :class="[
                              'w-2.5 h-2.5 rounded-full inline-block',
                              (selected.attributes[def.id]?.value ?? 0) >= n ? 'bg-indigo-500' : 'bg-slate-200',
                            ]"
                          />
                        </div>
                        <!-- Level label + value -->
                        <span class="text-xs font-semibold text-indigo-700">
                          {{ selected.attributes[def.id]?.levelLabel ?? '—' }}
                          <span class="text-slate-400 font-normal">
                            — {{ selected.attributes[def.id]?.value ?? '?' }}/5
                          </span>
                        </span>
                        <!-- Confidence badge -->
                        <span
                          v-if="selected.attributes[def.id]"
                          :class="['text-[10px] font-bold px-1.5 py-0.5 rounded', CONF_CLASS[selected.attributes[def.id].confidence] ?? 'bg-slate-100 text-slate-500']"
                        >
                          {{ CONF_LABEL[selected.attributes[def.id].confidence] ?? selected.attributes[def.id].confidence }}
                        </span>
                      </div>
                      <p class="text-[11px] text-slate-400 mt-0.5 leading-tight">{{ def.description }}</p>
                    </div>

                    <!-- Edit button -->
                    <button
                      type="button"
                      class="shrink-0 text-xs px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                      :title="`Edit ${def.name} attribute level, source URL, and fact manually`"
                      @click="startEdit(def.id, selected.attributes[def.id])"
                    >
                      ✏️ Edit
                    </button>
                  </div>

                  <!-- Source URL + fact + rationale (when not editing) -->
                  <template v-if="editingAttrId !== def.id">
                    <div
                      v-if="selected.attributes[def.id]"
                      class="space-y-1"
                    >
                      <!-- Source URL -->
                      <div class="flex items-center gap-1.5 text-[11px]">
                        <span class="text-slate-400">📎</span>
                        <a
                          v-if="selected.attributes[def.id].sourceUrl"
                          :href="selected.attributes[def.id].sourceUrl"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="text-indigo-600 hover:underline truncate"
                          :title="`Open source: ${selected.attributes[def.id].sourceUrl}`"
                        >
                          {{ truncateUrl(selected.attributes[def.id].sourceUrl) }}
                        </a>
                        <span v-else class="text-slate-300 italic">No source URL</span>
                      </div>
                      <!-- Source fact -->
                      <p
                        v-if="selected.attributes[def.id].sourceFact"
                        class="text-[11px] text-slate-500 italic leading-snug"
                      >
                        "{{ selected.attributes[def.id].sourceFact }}"
                      </p>
                      <!-- AI rationale -->
                      <p
                        v-if="selected.attributes[def.id].aiRationale"
                        class="text-[11px] text-slate-400 leading-snug"
                      >
                        {{ selected.attributes[def.id].aiRationale }}
                      </p>
                    </div>
                    <div v-else class="text-[11px] text-slate-300 italic">
                      No data for this attribute — re-run analysis or edit manually.
                    </div>
                  </template>

                  <!-- Inline edit form -->
                  <div
                    v-else
                    class="mt-2 space-y-2 p-3 rounded-lg bg-indigo-50 border border-indigo-200"
                  >
                    <div>
                      <label class="text-[11px] font-semibold text-indigo-700 block mb-1">
                        Level (1={{ def.levels[0].label }}, 5={{ def.levels[4].label }})
                      </label>
                      <div class="flex items-center gap-2">
                        <input
                          v-model.number="editAttrValue"
                          type="range"
                          min="1"
                          max="5"
                          step="1"
                          class="flex-1"
                          :aria-label="`${def.name} level slider`"
                        />
                        <span class="text-sm font-bold text-indigo-700 w-8 text-center">
                          {{ editAttrValue }}/5
                        </span>
                        <span class="text-xs text-slate-500">{{ def.levels[editAttrValue - 1]?.label }}</span>
                      </div>
                    </div>
                    <div>
                      <label class="text-[11px] font-semibold text-indigo-700 block mb-1">Source URL</label>
                      <input
                        v-model="editAttrUrl"
                        type="url"
                        placeholder="https://..."
                        class="w-full px-2 py-1.5 rounded border border-indigo-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        aria-label="Source URL for this attribute level"
                      />
                    </div>
                    <div>
                      <label class="text-[11px] font-semibold text-indigo-700 block mb-1">Source Fact</label>
                      <input
                        v-model="editAttrFact"
                        type="text"
                        placeholder="Specific fact that justifies this level"
                        class="w-full px-2 py-1.5 rounded border border-indigo-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        aria-label="Specific fact backing this attribute level"
                      />
                    </div>
                    <div class="flex gap-2">
                      <button
                        type="button"
                        class="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors"
                        title="Save manual edit — sets confidence to High (user-verified)"
                        @click="saveEdit"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        class="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium transition-colors"
                        title="Cancel edit — discard changes"
                        @click="cancelEdit"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>

            </ScrollContainer>
          </template>

        </div>
      </div>
    </div>
  </Teleport>
</template>
