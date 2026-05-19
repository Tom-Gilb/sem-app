<!-- UNIT_TYPE=Widget -->
<!-- Feature #195 — Plan Targets Panel
     Right-side drawer. Defines stakeholder audiences for targeted plan delivery.
     Each Target specifies who receives the plan, what sections they see, and how content is framed.
     "Any Instance" default is always present and non-deletable.
-->
<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import RightPanel from './RightPanel.vue'
import ScrollContainer from './ScrollContainer.vue'
import CloseDot from './CloseDot.vue'
// DD-001 (2026-05-13) — SaveGlyph for the Save Target action.
import SaveGlyph from './icons/SaveGlyph.vue'
import EditGlyph from './icons/EditGlyph.vue'
import {
  usePlanTargets,
  CATEGORY_META,
  FORMAT_LABELS,
  type PlanTarget,
  type TargetCategory,
  type ContentFormat,
  type TargetSections,
} from '../composables/usePlanTargets'
import { useSpecEditor } from '../composables/useSpecEditor'
import { useInputSafetyNet } from '../composables/useInputSafetyNet'

const emit = defineEmits<{
  close: []
  'open-editor': [{ targetId: string; targetName: string }]
}>()

const {
  targets,
  editingId,
  editingTarget,
  addTarget,
  updateTarget,
  applyDefaults,
  removeTarget,
  startEdit,
  cancelEdit,
  commitEdit,
  describeSections,
} = usePlanTargets()

// ── Edit-button 4-state machine ───────────────────────────────────────────────
// idle     → "✏️ Edit This Spec"
// pending  → "⚡ Confirm Your Edit Here"  (unsaved changes exist for this target)
// done     → "✅ Edited"                  (just saved / committed; reverts after 10 s)

const { hasChanges, linkedTargetId, lastCommittedTargetId } = useSpecEditor()

const _doneIds    = ref<Set<string>>(new Set())
const _doneTimers = new Map<string, ReturnType<typeof setTimeout>>()

watch(lastCommittedTargetId, (id) => {
  if (!id) return
  // Clear any existing 10-s countdown for this target
  const existing = _doneTimers.get(id)
  if (existing) clearTimeout(existing)
  // Flip to "done"
  _doneIds.value = new Set([..._doneIds.value, id])
  // Revert to idle after 10 s
  const timer = setTimeout(() => {
    const next = new Set(_doneIds.value)
    next.delete(id)
    _doneIds.value = next
    _doneTimers.delete(id)
  }, 10_000)
  _doneTimers.set(id, timer)
})

onUnmounted(() => {
  _doneTimers.forEach((t) => clearTimeout(t))
  _doneTimers.clear()
})

type BtnState = 'idle' | 'pending' | 'done'

function btnState(target: PlanTarget): BtnState {
  if (_doneIds.value.has(target.id))                                     return 'done'
  if (linkedTargetId.value === target.id && hasChanges.value)            return 'pending'
  return 'idle'
}

// ── Local edit buffer ─────────────────────────────────────────────────────────

const _buf = ref<PlanTarget | null>(null)
const _addMenuOpen = ref(false)

watch(editingTarget, (t) => {
  _buf.value = t ? { ...t, sections: { ...t.sections } } : null
}, { immediate: true })

// ── Input Safety Net (Plan Targets edit buffer) ─────────────────────────────
// Protects the four free-text fields (description, contactInfo, toneNotes,
// customIntro) the user types into when editing a target. Field IDs include
// the target id so each target's draft has its own snapshot ring; when the
// user switches to a different target, the prior target's stale snapshots
// are wiped via clearField.
const _safetyNet = useInputSafetyNet()

const _descRef = computed<string>({
  get: () => _buf.value?.description ?? '',
  set: (v: string) => { if (_buf.value) _buf.value.description = v },
})
const _contactRef = computed<string>({
  get: () => _buf.value?.contactInfo ?? '',
  set: (v: string) => { if (_buf.value) _buf.value.contactInfo = v },
})
const _toneRef = computed<string>({
  get: () => _buf.value?.toneNotes ?? '',
  set: (v: string) => { if (_buf.value) _buf.value.toneNotes = v },
})
const _introRef = computed<string>({
  get: () => _buf.value?.customIntro ?? '',
  set: (v: string) => { if (_buf.value) _buf.value.customIntro = v },
})

const _activeWatchers: Array<() => void> = []

watch(() => editingTarget.value?.id ?? null, (newId, oldId) => {
  // 1) Tear down any previous target's watchers.
  while (_activeWatchers.length) _activeWatchers.pop()?.()
  // 2) Drop the previous target's snapshots — they're not portable.
  if (oldId) {
    _safetyNet.clearField(`plan-target-${oldId}-description`)
    _safetyNet.clearField(`plan-target-${oldId}-contactInfo`)
    _safetyNet.clearField(`plan-target-${oldId}-toneNotes`)
    _safetyNet.clearField(`plan-target-${oldId}-customIntro`)
  }
  // 3) Register fresh watchers for the new target.
  if (newId) {
    _activeWatchers.push(_safetyNet.watchField(
      `plan-target-${newId}-description`, _descRef, (t) => { _descRef.value = t },
    ))
    _activeWatchers.push(_safetyNet.watchField(
      `plan-target-${newId}-contactInfo`, _contactRef, (t) => { _contactRef.value = t },
    ))
    _activeWatchers.push(_safetyNet.watchField(
      `plan-target-${newId}-toneNotes`, _toneRef, (t) => { _toneRef.value = t },
    ))
    _activeWatchers.push(_safetyNet.watchField(
      `plan-target-${newId}-customIntro`, _introRef, (t) => { _introRef.value = t },
    ))
  }
}, { immediate: true })

onUnmounted(() => {
  while (_activeWatchers.length) _activeWatchers.pop()?.()
})

function onCategoryChange(cat: TargetCategory): void {
  if (!_buf.value) return
  const meta = CATEGORY_META[cat]
  _buf.value.category = cat
  // Suggest defaults when changing category
  _buf.value.format = meta.defaultFormat
  _buf.value.sections = { ...meta.defaultSections }
  _buf.value.toneNotes = meta.toneHint
}

function save(): void {
  if (!_buf.value || !editingId.value) return
  updateTarget(editingId.value, {
    name:        _buf.value.name,
    category:    _buf.value.category,
    description: _buf.value.description,
    contactInfo: _buf.value.contactInfo,
    sections:    { ..._buf.value.sections },
    format:      _buf.value.format,
    toneNotes:   _buf.value.toneNotes,
    customIntro: _buf.value.customIntro,
  })
  commitEdit()
}

function applyAndFill(): void {
  if (!editingId.value || !_buf.value) return
  applyDefaults(editingId.value)
  // Sync buffer to the freshly-applied defaults
  const fresh = targets.value.find(t => t.id === editingId.value)
  if (fresh) {
    _buf.value.format    = fresh.format
    _buf.value.sections  = { ...fresh.sections }
    _buf.value.toneNotes = fresh.toneNotes
  }
}

const ORDERED_CATEGORIES: TargetCategory[] = [
  'individual', 'position', 'ai-bot', 'public',
  'investor', 'regulator', 'team', 'media',
  'partner', 'procurement', 'academic',
]

const SECTION_LABELS: Record<keyof TargetSections, string> = {
  functions:    '🔧 Functions',
  values:       '📊 Values',
  solutions:    '🔩 Solutions',
  evoSteps:     '🗓️ Evo Steps',
  stakeholders: '👥 Stakeholders',
  vdt:          '📐 VDT',
}

const FORMAT_OPTIONS: ContentFormat[] = [
  'full', 'executive', 'technical', 'narrative', 'investor', 'compliance',
]

// Convenience: count of user-defined (non-default) targets
const userTargets = computed(() => targets.value.filter(t => !t.isDefault))
</script>

<template>
  <!-- Backdrop -->
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[490] bg-black/30 backdrop-blur-sm"
      aria-hidden="true"
      @click="emit('close')"
    />

    <!-- Panel -->
    <RightPanel
      class="w-full max-w-md z-[495] flex flex-col bg-white shadow-2xl"
      role="dialog"
      aria-modal="true"
      aria-label="Plan Targets"
    >
      <!-- ── Header ──────────────────────────────────────────────────────── -->
      <div class="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-indigo-700 to-violet-600 shrink-0">
        <div class="flex-1 min-w-0">
          <h2 class="text-sm font-semibold text-white leading-none">🎯 Plan Targets</h2>
          <p class="text-[10px] text-indigo-200 mt-0.5">Define who receives this plan and how it's tailored for them</p>
        </div>
        <!-- Add Target button -->
        <div class="relative shrink-0">
          <button
            type="button"
            class="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition-colors"
            aria-label="Add a new Plan Target"
            @click="_addMenuOpen = !_addMenuOpen"
          >
            + Add Target
            <svg viewBox="0 0 20 20" fill="currentColor" class="h-3 w-3 opacity-70"><path fill-rule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06z"/></svg>
          </button>
          <!-- Category picker dropdown -->
          <div
            v-if="_addMenuOpen"
            class="absolute right-0 top-full mt-1 w-56 rounded-xl border border-gray-200 bg-white shadow-xl z-10 py-1 overflow-hidden"
          >
            <p class="px-3 pt-2 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Choose target type</p>
            <button
              v-for="cat in ORDERED_CATEGORIES"
              :key="cat"
              type="button"
              class="flex items-center gap-2.5 w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
              @click="_addMenuOpen = false; addTarget(cat)"
            >
              <span class="text-base leading-none w-5 text-center shrink-0">{{ CATEGORY_META[cat].icon }}</span>
              <div class="min-w-0">
                <div class="font-medium">{{ CATEGORY_META[cat].label }}</div>
                <div class="text-[10px] text-gray-400 truncate">{{ CATEGORY_META[cat].examples }}</div>
              </div>
            </button>
          </div>
        </div>
        <!-- Close — universal CloseDot per "Universal Close-Button Rule" -->
        <CloseDot
          variant="on-dark"
          aria-label="Close Plan Targets"
          @click="emit('close')"
        />
      </div>

      <!-- ── How it works strip — always visible ──────────────────────────── -->
      <div class="mx-4 mt-3 mb-1 rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-3 space-y-1.5">
        <p class="text-[11px] font-bold text-indigo-800">How Plan Targets work</p>
        <div class="flex items-start gap-2 text-[10px] text-indigo-700 leading-relaxed">
          <span class="shrink-0 w-4 h-4 rounded-full bg-indigo-200 text-indigo-800 text-[9px] font-bold flex items-center justify-center mt-0.5">1</span>
          <p><strong>Any Instance</strong> (below) is the baseline — it's what everyone receives. Edit it to set your default sections and format.</p>
        </div>
        <div class="flex items-start gap-2 text-[10px] text-indigo-700 leading-relaxed">
          <span class="shrink-0 w-4 h-4 rounded-full bg-indigo-200 text-indigo-800 text-[9px] font-bold flex items-center justify-center mt-0.5">2</span>
          <p>Tap <strong>+ Add Target</strong> (top-right) to define a specific audience — a CEO, an Investor Board, a Regulator, an AI Bot, etc. Each gets its own sections, format, and tone.</p>
        </div>
        <div class="flex items-start gap-2 text-[10px] text-indigo-700 leading-relaxed">
          <span class="shrink-0 w-4 h-4 rounded-full bg-indigo-200 text-indigo-800 text-[9px] font-bold flex items-center justify-center mt-0.5">3</span>
          <p>Tap <strong>✏️ Edit Plan</strong> on any target to open the Spec Editor pre-linked to that audience. Save as a Draft Version or commit directly to the Master Plan.</p>
        </div>
      </div>

      <!-- ── Big CTA when no user targets defined yet ───────────────────────── -->
      <div
        v-if="userTargets.length === 0 && !editingId"
        class="mx-4 mt-2 mb-1"
      >
        <button
          type="button"
          class="w-full flex items-center justify-center gap-2 h-10 rounded-xl
                 border-2 border-dashed border-indigo-300 text-indigo-600
                 hover:border-indigo-500 hover:bg-indigo-50 transition-colors text-sm font-semibold"
          @click="_addMenuOpen = !_addMenuOpen"
        >
          + Add your first specific target (CEO, Investor, AI Bot…)
        </button>
        <!-- Inline category picker when triggered from CTA -->
        <div
          v-if="_addMenuOpen"
          class="mt-1 rounded-xl border border-gray-200 bg-white shadow-xl py-1 overflow-hidden"
        >
          <p class="px-3 pt-2 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Choose target type</p>
          <div class="grid grid-cols-2 gap-0">
            <button
              v-for="cat in ORDERED_CATEGORIES"
              :key="cat"
              type="button"
              class="flex items-center gap-2.5 px-3 py-2 text-left text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
              @click="_addMenuOpen = false; addTarget(cat)"
            >
              <span class="text-base leading-none w-5 text-center shrink-0">{{ CATEGORY_META[cat].icon }}</span>
              <div class="min-w-0">
                <div class="font-medium leading-tight">{{ CATEGORY_META[cat].label }}</div>
                <div class="text-[9px] text-gray-400 truncate">{{ CATEGORY_META[cat].examples }}</div>
              </div>
            </button>
          </div>
        </div>
      </div>

      <!-- ── Target list ────────────────────────────────────────────────────── -->
      <ScrollContainer outer-class="flex-1 min-h-0 relative" inner-class="h-full">
        <div class="divide-y divide-gray-100">

          <!-- Each target row -->
          <div
            v-for="target in targets"
            :key="target.id"
            class="px-4 py-3"
          >
            <!-- Collapsed row (not editing) -->
            <template v-if="editingId !== target.id">
              <div class="flex items-start gap-3">
                <!-- Category icon -->
                <span class="text-xl leading-none mt-0.5 shrink-0">{{ CATEGORY_META[target.category].icon }}</span>

                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-sm font-semibold text-gray-900">{{ target.name }}</span>
                    <!-- Default badge -->
                    <span
                      v-if="target.isDefault"
                      class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-amber-100 text-amber-700 shrink-0"
                    >Baseline — all audiences</span>
                    <!-- Category chip -->
                    <span class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-indigo-100 text-indigo-700 shrink-0">
                      {{ CATEGORY_META[target.category].label }}
                    </span>
                  </div>
                  <!-- Sections summary -->
                  <p class="text-[10px] text-gray-500 mt-0.5">{{ describeSections(target) }}</p>
                  <!-- Format chip -->
                  <span class="inline-flex mt-1 items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-violet-50 text-violet-700">
                    {{ FORMAT_LABELS[target.format] }}
                  </span>
                  <p v-if="target.description" class="text-[10px] text-gray-400 mt-1 italic">{{ target.description }}</p>
                </div>
              </div>

              <!-- Row actions — always visible, not hover-only -->
              <div class="flex items-center gap-1.5 mt-2 ml-8">
                <!-- 4-state edit button -->
                <button
                  type="button"
                  class="h-7 px-2.5 rounded-lg text-[10px] font-semibold transition-all duration-200"
                  :class="{
                    'bg-violet-100 text-violet-700 hover:bg-violet-200':
                      btnState(target) === 'idle',
                    'bg-amber-100 text-amber-800 hover:bg-amber-200 ring-1 ring-amber-300':
                      btnState(target) === 'pending',
                    'bg-emerald-100 text-emerald-700 cursor-default':
                      btnState(target) === 'done',
                  }"
                  :aria-label="`Open Spec Editor for ${target.name}`"
                  :title="btnState(target) === 'pending'
                    ? 'You have unsaved changes — click to go back and save them'
                    : btnState(target) === 'done'
                    ? 'Changes saved!'
                    : `Open the Spec Editor tailored for '${target.name}'`"
                  @click="emit('open-editor', { targetId: target.id, targetName: target.name })"
                >
                  <template v-if="btnState(target) === 'idle'"><EditGlyph size="compact" class="h-3 w-auto shrink-0" aria-hidden="true" /> Edit This Spec</template>
                  <template v-else-if="btnState(target) === 'pending'">⚡ Confirm Your Edit Here</template>
                  <template v-else>✅ Edited</template>
                </button>
                <button
                  type="button"
                  class="h-7 px-2 rounded-lg text-[10px] font-medium bg-gray-100 text-gray-600 hover:bg-indigo-100 hover:text-indigo-700 transition-colors"
                  :aria-label="`Configure ${target.name}`"
                  title="Change sections, format, tone for this target"
                  @click="startEdit(target.id)"
                >⚙ Configure</button>
                <button
                  v-if="!target.isDefault"
                  type="button"
                  class="h-7 px-2 rounded-lg text-[10px] font-medium bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                  :aria-label="`Delete ${target.name}`"
                  @click="removeTarget(target.id)"
                >✕ Remove</button>
              </div>
            </template>

            <!-- ── Edit form ─────────────────────────────────────────────── -->
            <template v-else-if="_buf">
              <div class="space-y-4">
                <!-- Edit form header -->
                <div class="flex items-center gap-2 mb-1">
                  <span class="text-lg">{{ CATEGORY_META[_buf.category].icon }}</span>
                  <p class="text-xs font-semibold text-indigo-700">Editing Target</p>
                  <button
                    type="button"
                    class="ml-auto h-6 px-2 rounded text-[10px] font-medium bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
                    :aria-label="`Restore suggested defaults for ${_buf.category}`"
                    @click="applyAndFill"
                    title="Reset to AI-suggested defaults for this target type"
                  >🤖 Suggest defaults</button>
                </div>

                <!-- Name -->
                <div>
                  <label class="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Name</label>
                  <input
                    v-model="_buf.name"
                    type="text"
                    class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    placeholder="e.g. Sarah Chen — CEO, Investor Board, Compliance Team…"
                  />
                </div>

                <!-- Category -->
                <div>
                  <label class="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Target Type</label>
                  <div class="grid grid-cols-3 gap-1.5">
                    <button
                      v-for="cat in ORDERED_CATEGORIES"
                      :key="cat"
                      type="button"
                      class="flex flex-col items-center gap-0.5 rounded-lg border px-2 py-2 text-[10px] font-medium transition-all"
                      :class="_buf.category === cat
                        ? 'border-indigo-400 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-300'
                        : 'border-gray-200 text-gray-600 hover:border-indigo-200 hover:bg-indigo-50'"
                      @click="onCategoryChange(cat)"
                    >
                      <span class="text-base leading-none">{{ CATEGORY_META[cat].icon }}</span>
                      <span class="leading-tight text-center">{{ CATEGORY_META[cat].label }}</span>
                    </button>
                  </div>
                  <p class="mt-1 text-[10px] text-indigo-600 italic">{{ CATEGORY_META[_buf.category].examples }}</p>
                </div>

                <!-- Content Format -->
                <div>
                  <label class="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Content Format</label>
                  <div class="space-y-1">
                    <label
                      v-for="fmt in FORMAT_OPTIONS"
                      :key="fmt"
                      class="flex items-center gap-2.5 rounded-lg border px-3 py-2 cursor-pointer transition-colors"
                      :class="_buf.format === fmt
                        ? 'border-violet-400 bg-violet-50'
                        : 'border-gray-200 hover:border-violet-200 hover:bg-violet-50/50'"
                    >
                      <input
                        type="radio"
                        :value="fmt"
                        v-model="_buf.format"
                        class="accent-violet-600 shrink-0"
                      />
                      <span class="text-xs text-gray-800">{{ FORMAT_LABELS[fmt] }}</span>
                    </label>
                  </div>
                </div>

                <!-- Sections -->
                <div>
                  <label class="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Sections Included</label>
                  <div class="grid grid-cols-2 gap-1.5">
                    <label
                      v-for="(label, key) in SECTION_LABELS"
                      :key="key"
                      class="flex items-center gap-2 rounded-lg border px-2.5 py-2 cursor-pointer text-xs transition-colors"
                      :class="_buf.sections[key as keyof TargetSections]
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                        : 'border-gray-200 text-gray-500 hover:border-emerald-200'"
                    >
                      <input
                        type="checkbox"
                        v-model="_buf.sections[key as keyof TargetSections]"
                        class="accent-emerald-600 shrink-0"
                      />
                      <span>{{ label }}</span>
                    </label>
                  </div>
                </div>

                <!-- Description + Contact -->
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Context</label>
                    <textarea
                      v-model="_buf.description"
                      rows="2"
                      class="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      placeholder="Who they are, their relationship to this plan…"
                    />
                  </div>
                  <div>
                    <label class="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Contact / Role</label>
                    <textarea
                      v-model="_buf.contactInfo"
                      rows="2"
                      class="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      placeholder="Email, role title, Slack handle…"
                    />
                  </div>
                </div>

                <!-- Tone Notes -->
                <div>
                  <label class="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Tone & Emphasis Notes</label>
                  <textarea
                    v-model="_buf.toneNotes"
                    rows="2"
                    class="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    placeholder="How should the content be framed for this audience?"
                  />
                  <p class="text-[10px] text-gray-400 mt-1">These notes guide the AI when generating a tailored plan for this target.</p>
                </div>

                <!-- Custom Intro -->
                <div>
                  <label class="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Custom Opening Paragraph <span class="font-normal normal-case text-gray-400">(optional)</span></label>
                  <textarea
                    v-model="_buf.customIntro"
                    rows="2"
                    class="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    placeholder="A personalised introduction that appears at the top of their version of the plan…"
                  />
                </div>

                <!-- Save / Cancel -->
                <div class="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    class="flex-1 h-9 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors inline-flex items-center justify-center gap-1.5"
                    @click="save"
                  >
                    <SaveGlyph size="compact" class="h-3 w-auto" aria-hidden="true" />
                    <span>Save Target</span>
                  </button>
                  <button
                    type="button"
                    class="h-9 px-4 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 transition-colors"
                    @click="cancelEdit"
                  >Cancel</button>
                </div>
              </div>
            </template>
          </div>
        </div>
      </ScrollContainer>

      <!-- ── Footer ─────────────────────────────────────────────────────────── -->
      <div class="shrink-0 border-t border-gray-100 px-5 py-3 bg-gray-50 space-y-1">
        <p class="text-[10px] text-gray-600 font-semibold">
          {{ targets.length }} target{{ targets.length !== 1 ? 's' : '' }} defined
          <span v-if="userTargets.length === 0" class="font-normal text-gray-400"> — only the baseline exists so far</span>
        </p>
        <p class="text-[10px] text-gray-400 leading-relaxed">
          After clicking <strong class="text-gray-500">✏️ Edit Plan</strong> for a target, choose your edit level and save a <strong class="text-gray-500">Draft Version</strong> (keeps the master plan untouched) or commit directly to <strong class="text-gray-500">Master Plan</strong>.
          Each saved version is visible in the Spec Editor's Versions tab.
        </p>
      </div>
    </RightPanel>
  </Teleport>
</template>
