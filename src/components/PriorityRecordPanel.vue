<!-- PriorityRecordPanel.vue — Feature #199: Priority Decision Recording
     Right-drawer panel for recording why a spec entry was prioritised,
     with suggest-menu + free-text fields for every field.
     z-[485]: between ToolInfoPanel (z-490) and SpecCollaborator (z-460). -->

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { Teleport } from 'vue'
import RightPanel from './RightPanel.vue'
import ScrollContainer from './ScrollContainer.vue'
import CloseDot from './CloseDot.vue'
// DD-001 (2026-05-13) — SaveGlyph replaces 💾.
import SaveGlyph from './icons/SaveGlyph.vue'
import type { SpecOwner } from '../composables/usePlanModel'
import { usePriorityRecord, PRIORITY_SUGGESTIONS, type PriorityRecord } from '../composables/usePriorityRecord'

// ── Props + Emits ─────────────────────────────────────────────────────────────

const props = defineProps<{
  planModelId: string
  entryId: string
  entryType: 'F' | 'V' | 'S'
  entryDescription?: string
  specOwners?: SpecOwner[]
}>()

const emit = defineEmits<{
  close: []
}>()

// ── Composable ────────────────────────────────────────────────────────────────

const { getRecord, upsertRecord, removeRecord, hasRecord } = usePriorityRecord(props.planModelId)

// ── Local form state — initialised from stored record or blank ─────────────────

function _init(): PriorityRecord {
  const r = getRecord(props.entryId)
  return r ?? {
    id: '',
    entryId: props.entryId,
    entryType: props.entryType,
    source: '',
    authority: '',
    purposes: '',
    exceptions: '',
    notifyOwners: true,
    notifyExtra: [],
    notifySkip: false,
    impactTiming: '',
    impactCosts: '',
    impactValues: '',
    impactSolutions: '',
    createdAt: '',
    updatedAt: '',
  }
}

const form = ref<PriorityRecord>(_init())
const newNotifyTarget = ref('')
const saved = ref(false)
let _saveTimer: ReturnType<typeof setTimeout> | null = null

// Reinitialise when the target entry changes
watch(() => props.entryId, () => { form.value = _init() })

// ── Auto-save with a short debounce ──────────────────────────────────────────

function _scheduleSave(): void {
  if (_saveTimer) clearTimeout(_saveTimer)
  _saveTimer = setTimeout(_save, 600)
}

function _save(): void {
  upsertRecord(props.entryId, props.entryType, {
    source:         form.value.source,
    authority:      form.value.authority,
    purposes:       form.value.purposes,
    exceptions:     form.value.exceptions,
    notifyOwners:   form.value.notifyOwners,
    notifyExtra:    form.value.notifyExtra,
    notifySkip:     form.value.notifySkip,
    impactTiming:   form.value.impactTiming,
    impactCosts:    form.value.impactCosts,
    impactValues:   form.value.impactValues,
    impactSolutions: form.value.impactSolutions,
  })
  saved.value = true
  setTimeout(() => { saved.value = false }, 2000)
}

// ── SuggestField helpers ──────────────────────────────────────────────────────

/** Append a suggestion chip value to a text field (space-separated if not empty) */
function appendSuggestion(field: keyof Pick<PriorityRecord, 'source' | 'authority' | 'purposes' | 'exceptions'>, suggestion: string): void {
  const current = (form.value[field] as string).trim()
  form.value[field] = current ? `${current}; ${suggestion}` : suggestion as never
  _scheduleSave()
}

// ── Notify Extra helpers ──────────────────────────────────────────────────────

function addNotifyTarget(): void {
  const val = newNotifyTarget.value.trim()
  if (!val) return
  if (!form.value.notifyExtra.includes(val)) {
    form.value.notifyExtra = [...form.value.notifyExtra, val]
    _scheduleSave()
  }
  newNotifyTarget.value = ''
}

function removeNotifyTarget(name: string): void {
  form.value.notifyExtra = form.value.notifyExtra.filter(n => n !== name)
  _scheduleSave()
}

// Spec owner names for the notification section defaults
const ownerNames = computed<string[]>(() =>
  (props.specOwners ?? []).map(o => o.name).filter(Boolean),
)

// ── Keyboard: close on Escape ─────────────────────────────────────────────────

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') emit('close')
}

// ── Entry type colour ─────────────────────────────────────────────────────────

const typeColour = computed<string>(() => ({
  F: 'bg-green-600',
  V: 'bg-violet-600',
  S: 'bg-orange-600',
}[props.entryType] ?? 'bg-gray-600'))

const typeLabel = computed<string>(() => ({
  F: 'Function',
  V: 'Value',
  S: 'Solution',
}[props.entryType] ?? ''))

// ── Clear all ────────────────────────────────────────────────────────────────

function clearAll(): void {
  const existing = getRecord(props.entryId)
  if (existing) removeRecord(existing.id)
  form.value = _init()
}
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <div
      class="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-[484]"
      @click="emit('close')"
      @keydown="onKeydown"
    />

    <!-- Drawer -->
    <RightPanel
      class="w-[480px] max-w-[96vw] bg-white shadow-2xl flex flex-col z-[485] overflow-hidden"
      role="dialog"
      aria-modal="true"
      :aria-label="`Priority record for ${entryId}`"
      @keydown="onKeydown"
    >
      <!-- Header -->
      <div :class="[typeColour, 'px-5 py-3.5 flex items-center gap-3 shrink-0']">
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <span class="text-[11px] font-bold text-white/70 uppercase tracking-wide">{{ typeLabel }}</span>
          <span class="text-sm font-bold text-white truncate">{{ entryId }}</span>
        </div>
        <span v-if="saved" class="text-[10px] font-semibold text-white/80 shrink-0">✓ Saved</span>
        <!-- Close — universal CloseDot per "Universal Close-Button Rule" -->
        <CloseDot
          variant="on-dark"
          aria-label="Close priority record"
          @click="emit('close')"
        />
      </div>

      <!-- Sub-header: entry description -->
      <div v-if="entryDescription" class="px-5 py-2.5 bg-gray-50 border-b border-gray-100 shrink-0">
        <p class="text-xs text-gray-600 leading-relaxed line-clamp-2">{{ entryDescription }}</p>
      </div>

      <!-- Title row -->
      <div class="px-5 pt-4 pb-2 shrink-0 flex items-center justify-between">
        <div>
          <h2 class="text-sm font-bold text-gray-900">⚖️ Priority Decision</h2>
          <p class="text-[10px] text-gray-400 mt-0.5">Record why this entry has been prioritised</p>
        </div>
        <button
          v-if="hasRecord(entryId)"
          class="text-[10px] text-red-400 hover:text-red-600 transition-colors"
          title="Clear all priority data for this entry"
          @click="clearAll"
        >Clear all</button>
      </div>

      <!-- Scrollable body -->
      <ScrollContainer outer-class="flex-1 min-h-0 relative" inner-class="h-full px-5 pb-8 space-y-5">

        <!-- ── Priority Source ─────────────────────────────────────────────── -->
        <div class="space-y-1.5">
          <label class="block text-[11px] font-bold text-gray-700 uppercase tracking-wide">
            Priority Source
          </label>
          <p class="text-[10px] text-gray-400">What drove this prioritisation decision?</p>
          <textarea
            v-model="form.source"
            rows="2"
            placeholder="e.g. Customer feedback from Q1 review"
            class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800
                   placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-300
                   focus:border-orange-300 resize-none leading-relaxed"
            @input="_scheduleSave()"
          />
          <div class="flex flex-wrap gap-1.5 pt-0.5">
            <button
              v-for="s in PRIORITY_SUGGESTIONS.source"
              :key="s"
              type="button"
              class="px-2 py-0.5 rounded-full text-[10px] font-medium
                     bg-orange-50 text-orange-700 border border-orange-200
                     hover:bg-orange-100 transition-colors"
              @click="appendSuggestion('source', s)"
            >+ {{ s }}</button>
          </div>
        </div>

        <!-- ── Priority Authority ──────────────────────────────────────────── -->
        <div class="space-y-1.5">
          <label class="block text-[11px] font-bold text-gray-700 uppercase tracking-wide">
            Priority Authority
          </label>
          <p class="text-[10px] text-gray-400">Who has the authority to make this priority call?</p>
          <textarea
            v-model="form.authority"
            rows="2"
            placeholder="e.g. Product Owner with steering committee approval"
            class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800
                   placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-300
                   focus:border-orange-300 resize-none leading-relaxed"
            @input="_scheduleSave()"
          />
          <div class="flex flex-wrap gap-1.5 pt-0.5">
            <button
              v-for="s in PRIORITY_SUGGESTIONS.authority"
              :key="s"
              type="button"
              class="px-2 py-0.5 rounded-full text-[10px] font-medium
                     bg-orange-50 text-orange-700 border border-orange-200
                     hover:bg-orange-100 transition-colors"
              @click="appendSuggestion('authority', s)"
            >+ {{ s }}</button>
          </div>
        </div>

        <!-- ── Priority Purposes ───────────────────────────────────────────── -->
        <div class="space-y-1.5">
          <label class="block text-[11px] font-bold text-gray-700 uppercase tracking-wide">
            Priority Purposes
          </label>
          <p class="text-[10px] text-gray-400">What goals does this prioritisation serve?</p>
          <textarea
            v-model="form.purposes"
            rows="2"
            placeholder="e.g. Align with strategic plan; reduce delivery risk"
            class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800
                   placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-300
                   focus:border-orange-300 resize-none leading-relaxed"
            @input="_scheduleSave()"
          />
          <div class="flex flex-wrap gap-1.5 pt-0.5">
            <button
              v-for="s in PRIORITY_SUGGESTIONS.purposes"
              :key="s"
              type="button"
              class="px-2 py-0.5 rounded-full text-[10px] font-medium
                     bg-orange-50 text-orange-700 border border-orange-200
                     hover:bg-orange-100 transition-colors"
              @click="appendSuggestion('purposes', s)"
            >+ {{ s }}</button>
          </div>
        </div>

        <!-- ── Exceptions ──────────────────────────────────────────────────── -->
        <div class="space-y-1.5">
          <label class="block text-[11px] font-bold text-gray-700 uppercase tracking-wide">
            Exceptions to This Priority
          </label>
          <p class="text-[10px] text-gray-400">When or how can this priority be overridden?</p>
          <textarea
            v-model="form.exceptions"
            rows="2"
            placeholder="e.g. Emergency regulatory change; board approval required"
            class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800
                   placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-300
                   focus:border-orange-300 resize-none leading-relaxed"
            @input="_scheduleSave()"
          />
          <div class="flex flex-wrap gap-1.5 pt-0.5">
            <button
              v-for="s in PRIORITY_SUGGESTIONS.exceptions"
              :key="s"
              type="button"
              class="px-2 py-0.5 rounded-full text-[10px] font-medium
                     bg-orange-50 text-orange-700 border border-orange-200
                     hover:bg-orange-100 transition-colors"
              @click="appendSuggestion('exceptions', s)"
            >+ {{ s }}</button>
          </div>
        </div>

        <!-- ── Divider ─────────────────────────────────────────────────────── -->
        <div class="border-t border-gray-100" />

        <!-- ── Send Notification To ───────────────────────────────────────── -->
        <div class="space-y-2">
          <label class="block text-[11px] font-bold text-gray-700 uppercase tracking-wide">
            Send Notification To
          </label>
          <p class="text-[10px] text-gray-400">
            Who should be notified of this priority decision?
          </p>

          <!-- Spec Owners default -->
          <div class="rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 space-y-2">
            <label class="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                v-model="form.notifyOwners"
                class="mt-0.5 accent-orange-500"
                @change="_scheduleSave()"
              />
              <div class="flex-1 min-w-0">
                <span class="text-xs font-semibold text-gray-800">Spec Owner(s)</span>
                <span class="text-[10px] text-gray-400 ml-1">(default)</span>
                <div v-if="ownerNames.length" class="flex flex-wrap gap-1 mt-1">
                  <span
                    v-for="name in ownerNames"
                    :key="name"
                    class="inline-block px-1.5 py-0.5 rounded-full text-[9px] font-medium
                           bg-orange-100 text-orange-700"
                  >{{ name }}</span>
                </div>
                <p v-else class="text-[10px] text-gray-400 mt-0.5 italic">
                  Set Spec Owners in Plan Governance to populate names
                </p>
              </div>
            </label>

            <!-- Not this time -->
            <label class="flex items-center gap-2.5 cursor-pointer pt-1 border-t border-gray-200">
              <input
                type="checkbox"
                v-model="form.notifySkip"
                class="accent-gray-400"
                @change="_scheduleSave()"
              />
              <span class="text-xs text-gray-600">Not this time — skip notification for this record</span>
            </label>
          </div>

          <!-- Additional notify targets -->
          <div class="space-y-1.5">
            <p class="text-[10px] text-gray-500 font-medium">Additional stakeholders:</p>
            <div class="flex gap-1.5">
              <input
                v-model="newNotifyTarget"
                type="text"
                placeholder="Stakeholder name…"
                class="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-800
                       placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-300
                       focus:border-orange-300"
                @keydown.enter.prevent="addNotifyTarget"
              />
              <button
                type="button"
                class="px-3 py-1.5 rounded-lg bg-orange-500 text-white text-xs font-semibold
                       hover:bg-orange-600 transition-colors focus:outline-none focus:ring-2
                       focus:ring-orange-300 shrink-0"
                @click="addNotifyTarget"
              >Add</button>
            </div>
            <div v-if="form.notifyExtra.length" class="flex flex-wrap gap-1.5 pt-0.5">
              <span
                v-for="name in form.notifyExtra"
                :key="name"
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                       bg-orange-100 text-orange-800 text-[10px] font-medium border border-orange-200"
              >
                {{ name }}
                <button
                  type="button"
                  class="text-orange-500 hover:text-orange-700 leading-none focus:outline-none"
                  :title="`Remove ${name}`"
                  @click="removeNotifyTarget(name)"
                >✕</button>
              </span>
            </div>
          </div>
        </div>

        <!-- ── Divider ─────────────────────────────────────────────────────── -->
        <div class="border-t border-gray-100" />

        <!-- ── Potential Impacts ──────────────────────────────────────────── -->
        <div class="space-y-3">
          <div>
            <h3 class="text-[11px] font-bold text-gray-700 uppercase tracking-wide">
              Potential Impacts
            </h3>
            <p class="text-[10px] text-gray-400 mt-0.5">
              Preliminary notes — full analysis computed in VDTs
            </p>
          </div>

          <!-- Timing -->
          <div class="space-y-1">
            <label class="block text-[10px] font-semibold text-gray-600">⏱ Timing</label>
            <textarea
              v-model="form.impactTiming"
              rows="2"
              placeholder="Delivery schedule changes, deadlines affected…"
              class="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-800
                     placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-300
                     focus:border-orange-300 resize-none"
              @input="_scheduleSave()"
            />
          </div>

          <!-- Costs -->
          <div class="space-y-1">
            <label class="block text-[10px] font-semibold text-gray-600">💰 Costs</label>
            <textarea
              v-model="form.impactCosts"
              rows="2"
              placeholder="Budget implications, resource requirements…"
              class="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-800
                     placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-300
                     focus:border-orange-300 resize-none"
              @input="_scheduleSave()"
            />
          </div>

          <!-- Values -->
          <div class="space-y-1">
            <label class="block text-[10px] font-semibold text-gray-600">📊 Values</label>
            <textarea
              v-model="form.impactValues"
              rows="2"
              placeholder="Value metrics affected, V/C ratio shifts expected…"
              class="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-800
                     placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-300
                     focus:border-orange-300 resize-none"
              @input="_scheduleSave()"
            />
          </div>

          <!-- Solutions -->
          <div class="space-y-1">
            <label class="block text-[10px] font-semibold text-gray-600">💡 Solutions</label>
            <textarea
              v-model="form.impactSolutions"
              rows="2"
              placeholder="Which solutions are affected, re-ranking expected…"
              class="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-800
                     placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-300
                     focus:border-orange-300 resize-none"
              @input="_scheduleSave()"
            />
          </div>
        </div>

      </ScrollContainer><!-- end scrollable body -->

      <!-- Footer save button -->
      <div class="shrink-0 px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
        <p class="text-[10px] text-gray-400">Auto-saved as you type · full impact in VDTs</p>
        <button
          type="button"
          class="px-4 py-2 rounded-lg bg-orange-500 text-white text-xs font-bold
                 hover:bg-orange-600 transition-colors focus:outline-none
                 focus:ring-2 focus:ring-orange-300 shrink-0"
          @click="_save()"
        >
          <span v-if="saved">✓ Saved</span>
          <span v-else class="inline-flex items-center gap-1.5">
            <SaveGlyph size="compact" class="h-3 w-auto" aria-hidden="true" />
            <span>Save Now</span>
          </span>
        </button>
      </div>

    </RightPanel>
  </Teleport>
</template>
