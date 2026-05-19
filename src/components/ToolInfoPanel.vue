<!-- UNIT_TYPE=Widget -->
<!-- ToolInfoPanel — Feature #197
     Right drawer showing auto-derived + manually-entered metadata for the active
     plan model (plan identity bar "ℹ More Info" button).
     Auto-derived: Purposes (from F. entries), Originator (from plan owner).
     Manual: Tag, Description, Deep Insights, Subtle Points, Synonym Names,
             Related Tools, Related Specifications, URLs. -->

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import RightPanel from './RightPanel.vue'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'
import { useToolInfo } from '../composables/useToolInfo'
import type { PlanModel } from '../composables/usePlanModel'
import type { SpecBlock } from '../types/spec'

// ── Props & emits ─────────────────────────────────────────────────────────────

const props = defineProps<{
  planModelId: string
  planModel:   PlanModel | null
  spec:        SpecBlock | null
}>()

const emit = defineEmits<{ close: [] }>()

// ── Composable ────────────────────────────────────────────────────────────────

const {
  getMeta,
  updateMeta,
  addUrl,
  removeUrl,
  addSynonym,
  removeSynonym,
  addRelatedTool,
  removeRelatedTool,
  addRelatedSpec,
  removeRelatedSpec,
} = useToolInfo()

// ── Auto-derived ──────────────────────────────────────────────────────────────

const purposes = computed(() => {
  if (!props.spec?.functions.length) return []
  return props.spec.functions.map(f => f.description).filter(Boolean)
})

const originator = computed(() => {
  const o = props.planModel?.owners?.[0]
  if (!o) return ''
  const parts = [o.name, o.organization].filter(Boolean)
  return parts.join(' · ')
})

// ── Local form state (two-way for text fields) ────────────────────────────────

const meta = computed(() => getMeta(props.planModelId))

const localTag         = ref(meta.value.tag)
const localDescription = ref(meta.value.description)
const localInsights    = ref(meta.value.deepInsights)
const localPoints      = ref(meta.value.subtlePoints)

// Sync when planModelId changes (different plan opened)
watch(
  () => props.planModelId,
  () => {
    const m = getMeta(props.planModelId)
    localTag.value         = m.tag
    localDescription.value = m.description
    localInsights.value    = m.deepInsights
    localPoints.value      = m.subtlePoints
  },
)

function commitText(): void {
  updateMeta(props.planModelId, {
    tag:          localTag.value.trim(),
    description:  localDescription.value.trim(),
    deepInsights: localInsights.value.trim(),
    subtlePoints: localPoints.value.trim(),
  })
}

// ── Add-item inputs ───────────────────────────────────────────────────────────

const newSynonym     = ref('')
const newRelatedTool = ref('')
const newRelatedSpec = ref('')
const newUrl         = ref('')

function submitSynonym(): void {
  addSynonym(props.planModelId, newSynonym.value)
  newSynonym.value = ''
}
function submitRelatedTool(): void {
  addRelatedTool(props.planModelId, newRelatedTool.value)
  newRelatedTool.value = ''
}
function submitRelatedSpec(): void {
  addRelatedSpec(props.planModelId, newRelatedSpec.value)
  newRelatedSpec.value = ''
}
function submitUrl(): void {
  addUrl(props.planModelId, newUrl.value)
  newUrl.value = ''
}
</script>

<template>
  <Teleport to="body">
    <!-- Click-outside backdrop -->
    <div
      class="fixed inset-0 z-[489]"
      aria-hidden="true"
      @click="emit('close')"
    />

    <!-- Drawer -->
    <RightPanel
      class="z-[490] w-96 bg-white shadow-2xl border-l border-indigo-100 flex flex-col overflow-hidden"
      role="dialog"
      aria-label="Tool Info"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-3
                  bg-gradient-to-r from-indigo-700 to-violet-600 text-white shrink-0">
        <div class="flex items-center gap-2">
          <span class="text-base">ℹ</span>
          <span class="text-sm font-semibold">About This Plan</span>
        </div>
        <CloseDot
        variant="on-dark"
        aria-label="Close Tool Info"
        @click="emit('close')"
      />
      </div>

      <!-- Scrollable body -->
      <ScrollContainer outer-class="flex-1 min-h-0 relative" inner-class="h-full px-4 py-4 space-y-5 text-sm text-gray-800">

        <!-- ── Auto-derived: Purposes ───────────────────────────────────────── -->
        <section>
          <p class="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-2">
            Purposes
            <span class="ml-1 text-[9px] font-normal text-gray-400 normal-case tracking-normal">auto-derived</span>
          </p>
          <div v-if="purposes.length" class="space-y-1.5">
            <div
              v-for="(p, i) in purposes"
              :key="i"
              class="flex gap-2 items-start"
            >
              <span class="mt-0.5 shrink-0 w-4 h-4 rounded-full bg-indigo-100 text-indigo-600
                           text-[9px] font-bold flex items-center justify-center">{{ i + 1 }}</span>
              <p class="text-xs text-gray-700 leading-relaxed">{{ p }}</p>
            </div>
          </div>
          <p v-else class="text-xs text-gray-400 italic">
            Add F. (Function) entries to your spec to see purposes here.
          </p>
        </section>

        <!-- ── Auto-derived: Originator ────────────────────────────────────── -->
        <section v-if="originator">
          <p class="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-1">
            Originator
            <span class="ml-1 text-[9px] font-normal text-gray-400 normal-case tracking-normal">auto-derived</span>
          </p>
          <p class="text-xs text-gray-700">{{ originator }}</p>
        </section>

        <hr class="border-gray-100" />

        <!-- ── Tag ─────────────────────────────────────────────────────────── -->
        <section>
          <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Tag</label>
          <input
            v-model="localTag"
            type="text"
            placeholder="e.g. AI Tool, SEM Spec, Methodology…"
            class="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50
                   text-xs placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            @blur="commitText"
          />
        </section>

        <!-- ── Description ──────────────────────────────────────────────────── -->
        <section>
          <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Description</label>
          <textarea
            v-model="localDescription"
            rows="3"
            placeholder="Brief description of what this plan or tool does…"
            class="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50
                   text-xs placeholder-gray-400 resize-none
                   focus:outline-none focus:ring-2 focus:ring-indigo-400"
            @blur="commitText"
          />
        </section>

        <!-- ── Deep Insights ────────────────────────────────────────────────── -->
        <section>
          <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Deep Insights</label>
          <p class="text-[10px] text-gray-400 mb-1">Non-obvious truths about this tool or plan that experts know.</p>
          <textarea
            v-model="localInsights"
            rows="3"
            placeholder="What do power users know that beginners don't…"
            class="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50
                   text-xs placeholder-gray-400 resize-none
                   focus:outline-none focus:ring-2 focus:ring-indigo-400"
            @blur="commitText"
          />
        </section>

        <!-- ── Subtle Points ─────────────────────────────────────────────────── -->
        <section>
          <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Subtle Points</label>
          <p class="text-[10px] text-gray-400 mb-1">Edge cases, caveats, and gotchas worth knowing.</p>
          <textarea
            v-model="localPoints"
            rows="3"
            placeholder="Common misunderstandings, edge cases, important caveats…"
            class="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50
                   text-xs placeholder-gray-400 resize-none
                   focus:outline-none focus:ring-2 focus:ring-indigo-400"
            @blur="commitText"
          />
        </section>

        <hr class="border-gray-100" />

        <!-- ── Synonym Names ────────────────────────────────────────────────── -->
        <section>
          <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Synonym Names</label>
          <div class="flex flex-wrap gap-1.5 mb-2">
            <span
              v-for="(s, i) in meta.synonymNames"
              :key="i"
              class="flex items-center gap-1 px-2 py-0.5 rounded-full
                     bg-indigo-50 text-indigo-700 border border-indigo-100 text-[11px]"
            >
              {{ s }}
              <button
                type="button"
                class="text-indigo-400 hover:text-indigo-700 leading-none"
                :aria-label="`Remove synonym ${s}`"
                @click="removeSynonym(planModelId, i)"
              >✕</button>
            </span>
            <span v-if="!meta.synonymNames.length" class="text-[11px] text-gray-400 italic">None yet</span>
          </div>
          <div class="flex gap-1.5">
            <input
              v-model="newSynonym"
              type="text"
              placeholder="Add synonym…"
              class="flex-1 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50
                     text-xs placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              @keydown.enter.prevent="submitSynonym"
            />
            <button
              type="button"
              class="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium
                     hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400"
              @click="submitSynonym"
            >Add</button>
          </div>
        </section>

        <!-- ── Related Tools ────────────────────────────────────────────────── -->
        <section>
          <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Related Tools</label>
          <div class="flex flex-wrap gap-1.5 mb-2">
            <span
              v-for="(t, i) in meta.relatedTools"
              :key="i"
              class="flex items-center gap-1 px-2 py-0.5 rounded-full
                     bg-violet-50 text-violet-700 border border-violet-100 text-[11px]"
            >
              {{ t }}
              <button
                type="button"
                class="text-violet-400 hover:text-violet-700 leading-none"
                :aria-label="`Remove related tool ${t}`"
                @click="removeRelatedTool(planModelId, i)"
              >✕</button>
            </span>
            <span v-if="!meta.relatedTools.length" class="text-[11px] text-gray-400 italic">None yet</span>
          </div>
          <div class="flex gap-1.5">
            <input
              v-model="newRelatedTool"
              type="text"
              placeholder="Add related tool…"
              class="flex-1 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50
                     text-xs placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              @keydown.enter.prevent="submitRelatedTool"
            />
            <button
              type="button"
              class="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-medium
                     hover:bg-violet-700 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-400"
              @click="submitRelatedTool"
            >Add</button>
          </div>
        </section>

        <!-- ── Related Specifications ───────────────────────────────────────── -->
        <section>
          <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Related Specifications</label>
          <div class="flex flex-wrap gap-1.5 mb-2">
            <span
              v-for="(s, i) in meta.relatedSpecs"
              :key="i"
              class="flex items-center gap-1 px-2 py-0.5 rounded-full
                     bg-amber-50 text-amber-700 border border-amber-100 text-[11px]"
            >
              {{ s }}
              <button
                type="button"
                class="text-amber-400 hover:text-amber-700 leading-none"
                :aria-label="`Remove related spec ${s}`"
                @click="removeRelatedSpec(planModelId, i)"
              >✕</button>
            </span>
            <span v-if="!meta.relatedSpecs.length" class="text-[11px] text-gray-400 italic">None yet</span>
          </div>
          <div class="flex gap-1.5">
            <input
              v-model="newRelatedSpec"
              type="text"
              placeholder="e.g. ISO 25010, RFC 2119…"
              class="flex-1 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50
                     text-xs placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              @keydown.enter.prevent="submitRelatedSpec"
            />
            <button
              type="button"
              class="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-medium
                     hover:bg-amber-700 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400"
              @click="submitRelatedSpec"
            >Add</button>
          </div>
        </section>

        <!-- ── URLs ─────────────────────────────────────────────────────────── -->
        <section>
          <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">URLs</label>
          <div class="space-y-1 mb-2">
            <div
              v-for="(u, i) in meta.urls"
              :key="i"
              class="flex items-center gap-1.5"
            >
              <a
                :href="u"
                target="_blank"
                rel="noopener noreferrer"
                class="flex-1 text-[11px] text-indigo-600 hover:underline truncate"
              >{{ u }}</a>
              <button
                type="button"
                class="shrink-0 text-gray-400 hover:text-red-500 text-xs leading-none"
                :aria-label="`Remove URL ${u}`"
                @click="removeUrl(planModelId, i)"
              >✕</button>
            </div>
            <p v-if="!meta.urls.length" class="text-[11px] text-gray-400 italic">No URLs yet</p>
          </div>
          <div class="flex gap-1.5">
            <input
              v-model="newUrl"
              type="url"
              placeholder="https://…"
              class="flex-1 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50
                     text-xs placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              @keydown.enter.prevent="submitUrl"
            />
            <button
              type="button"
              class="px-3 py-1.5 rounded-lg bg-gray-700 text-white text-xs font-medium
                     hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
              @click="submitUrl"
            >Add</button>
          </div>
        </section>

        <!-- Bottom padding -->
        <div class="h-4" />
      </ScrollContainer>
    </RightPanel>
  </Teleport>
</template>
