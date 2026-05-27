<!-- UNIT_TYPE=Widget -->
<!-- SpecOwnersPanel — Plan Governance drawer.
     Manages "The Plan Itself as Stakeholder": Wish/Goal levels (the plan's own
     needs and commitments) and the list of Spec Owners (area-specific
     accountability assignments such as Product, Quality, Financials, etc.). -->

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import RightPanel from './RightPanel.vue'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'
import {
  updateGovernance,
  addSpecOwner,
  updateSpecOwner,
  removeSpecOwner,
} from '../composables/usePlanModel'
import type { PlanModel, SpecOwner } from '../composables/usePlanModel'

const props = defineProps<{
  planModel: PlanModel
}>()

const emit = defineEmits<{
  close: []
}>()

// ── Governance text (auto-save on blur) ───────────────────────────────────────

const wishLevel = ref(props.planModel.governance.wishLevel)
const goalLevel = ref(props.planModel.governance.goalLevel)

watch(
  () => props.planModel.governance,
  (g) => {
    wishLevel.value = g.wishLevel
    goalLevel.value = g.goalLevel
  },
  { deep: true },
)

function saveGovernanceText(): void {
  updateGovernance({ wishLevel: wishLevel.value, goalLevel: goalLevel.value })
}

// ── Spec Owners ────────────────────────────────────────────────────────────────

const specOwners = computed(() => props.planModel.governance.specOwners)

/** Suggested area names — user can type anything else */
const AREA_SUGGESTIONS = [
  'Product', 'Quality', 'Financials', 'Innovation',
  'Technical', 'Delivery', 'Risk', 'Compliance',
  'Legal', 'HR', 'Security', 'Customer Experience',
]

// Edit / add form state
const showForm  = ref(false)
const editingId = ref<string | null>(null)

const EMPTY_FORM = (): Omit<SpecOwner, 'id'> => ({
  area:           '',
  name:           '',
  email:          '',
  phone:          '',
  organization:   '',
  location:       '',
  responsibility: '',
})

const form = reactive<Omit<SpecOwner, 'id'>>(EMPTY_FORM())

function openAddForm(): void {
  editingId.value = null
  Object.assign(form, EMPTY_FORM())
  showForm.value = true
}

function openEditForm(owner: SpecOwner): void {
  editingId.value        = owner.id
  form.area              = owner.area
  form.name              = owner.name
  form.email             = owner.email
  form.phone             = owner.phone
  form.organization      = owner.organization
  form.location          = owner.location
  form.responsibility    = owner.responsibility
  showForm.value         = true
}

function cancelForm(): void {
  showForm.value  = false
  editingId.value = null
}

function saveForm(): void {
  if (!form.area.trim() || !form.name.trim()) return
  if (editingId.value) {
    updateSpecOwner(editingId.value, { ...form })
  } else {
    addSpecOwner({ ...form })
  }
  cancelForm()
}

function deleteOwner(id: string): void {
  removeSpecOwner(id)
}

// Area colour chips for visual differentiation
const AREA_COLOURS: Record<string, string> = {
  Product:             'bg-indigo-100 text-indigo-700',
  Quality:             'bg-violet-100 text-violet-700',
  Financials:          'bg-emerald-100 text-emerald-700',
  Innovation:          'bg-pink-100 text-pink-700',
  Technical:           'bg-cyan-100 text-cyan-700',
  Delivery:            'bg-amber-100 text-amber-700',
  Risk:                'bg-red-100 text-red-700',
  Compliance:          'bg-orange-100 text-orange-700',
  Legal:               'bg-yellow-100 text-yellow-700',
  HR:                  'bg-teal-100 text-teal-700',
  Security:            'bg-slate-100 text-slate-700',
  'Customer Experience': 'bg-rose-100 text-rose-700',
}

function areaChip(area: string): string {
  return AREA_COLOURS[area] ?? 'bg-gray-100 text-gray-700'
}
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <div
      class="fixed inset-0 z-[150] bg-black/30"
      aria-hidden="true"
      @click="emit('close')"
    />

    <!-- Drawer -->
    <RightPanel
      class="w-[26rem] bg-white shadow-2xl z-[200] flex flex-col"
      role="dialog"
      aria-label="Plan Governance — Spec Owners"
    >
      <!-- Header -->
      <div
        class="flex items-center justify-between px-5 border-b border-gray-100 min-h-[56px]
               bg-gradient-to-r from-indigo-50 to-violet-50"
      >
        <div>
          <h2 class="text-sm font-bold text-gray-900">Plan Governance</h2>
          <p class="text-[10px] text-indigo-500 font-medium">Plan as Stakeholder · Spec Owners</p>
        </div>
        <CloseDot
        title="Close"
        aria-label="Close"
        @click="emit('close')"
      />
      </div>

      <!-- Scrollable content -->
      <ScrollContainer outer-class="flex-1 min-h-0 relative" inner-class="h-full">

        <!-- ── Plan as Stakeholder ──────────────────────────────────────── -->
        <section class="px-5 py-4 border-b border-gray-100">
          <div class="flex items-center gap-2 mb-3">
            <span class="text-base" aria-hidden="true">📋</span>
            <h3 class="text-xs font-bold text-gray-800 uppercase tracking-widest">Plan as Stakeholder</h3>
          </div>
          <p class="text-[11px] text-gray-500 mb-3 leading-snug">
            The Plan Itself is a stakeholder — it expresses all known and acknowledged
            stakeholder needs (Wish Level) and project commitments (Goal Level).
          </p>

          <!-- Wish Level -->
          <div class="space-y-1 mb-3">
            <label class="block text-[10px] font-semibold text-indigo-500 uppercase tracking-wider">
              Wish Level — Stakeholder Needs
            </label>
            <textarea
              v-model="wishLevel"
              rows="3"
              placeholder="State all known stakeholder wishes here… e.g. 'Stakeholders wish for faster plan creation…'"
              class="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-800
                     placeholder:text-gray-300 resize-none
                     focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
              @blur="saveGovernanceText"
            />
          </div>

          <!-- Goal Level -->
          <div class="space-y-1">
            <label class="block text-[10px] font-semibold text-violet-500 uppercase tracking-wider">
              Goal Level — Project Commitments
            </label>
            <textarea
              v-model="goalLevel"
              rows="3"
              placeholder="State measurable project commitments here… e.g. 'The plan commits to 95% on-time delivery…'"
              class="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-800
                     placeholder:text-gray-300 resize-none
                     focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
              @blur="saveGovernanceText"
            />
          </div>
        </section>

        <!-- ── Spec Owners list ────────────────────────────────────────── -->
        <section class="px-5 py-4">
          <div class="flex items-center justify-between mb-3">
            <div>
              <h3 class="text-xs font-bold text-gray-800 uppercase tracking-widest">Spec Owners</h3>
              <p class="text-[10px] text-gray-400 mt-0.5">
                Accountable for specific Specification Areas
              </p>
            </div>
            <button
              v-if="!showForm"
              type="button"
              class="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg
                     bg-indigo-600 text-white text-xs font-semibold
                     hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500
                     transition-colors"
              @click="openAddForm"
            >+ Add</button>
          </div>

          <!-- Empty state -->
          <p
            v-if="specOwners.length === 0 && !showForm"
            class="text-xs text-gray-400 text-center py-6 border border-dashed border-gray-200 rounded-lg"
          >
            No Spec Owners yet.<br>
            <span class="text-gray-300 text-[11px]">Add owners for Product, Quality, Financials…</span>
          </p>

          <!-- Spec Owner cards -->
          <div
            v-for="owner in specOwners"
            :key="owner.id"
            class="mb-2 rounded-xl border border-gray-100 bg-gray-50 p-3"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="flex-1 min-w-0">
                <!-- Area badge + name -->
                <div class="flex items-center gap-2 flex-wrap mb-1">
                  <span
                    class="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    :class="areaChip(owner.area)"
                  >{{ owner.area }}</span>
                  <span class="text-sm font-semibold text-gray-900 truncate">{{ owner.name }}</span>
                </div>
                <!-- Contact details -->
                <div class="space-y-0.5">
                  <p v-if="owner.email" class="text-sm text-gray-500 truncate">
                    ✉ {{ owner.email }}
                  </p>
                  <p v-if="owner.phone" class="text-sm text-gray-500">
                    ☎ {{ owner.phone }}
                  </p>
                  <p v-if="owner.organization || owner.location" class="text-sm text-gray-500 truncate">
                    <span v-if="owner.organization">{{ owner.organization }}</span>
                    <span v-if="owner.organization && owner.location"> · </span>
                    <span v-if="owner.location">{{ owner.location }}</span>
                  </p>
                  <p v-if="owner.responsibility" class="text-sm text-gray-600 mt-1 italic leading-snug">
                    "{{ owner.responsibility }}"
                  </p>
                </div>
              </div>
              <!-- Actions -->
              <div class="shrink-0 flex flex-col gap-1">
                <button
                  type="button"
                  class="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg
                         text-gray-400 hover:text-indigo-600 hover:bg-indigo-50
                         focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors text-sm"
                  :aria-label="`Edit ${owner.name}`"
                  @click="openEditForm(owner)"
                >✏</button>
                <button
                  type="button"
                  class="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg
                         text-gray-400 hover:text-red-600 hover:bg-red-50
                         focus:outline-none focus:ring-2 focus:ring-red-400 transition-colors text-sm"
                  :aria-label="`Remove ${owner.name}`"
                  @click="deleteOwner(owner.id)"
                >✕</button>
              </div>
            </div>
          </div>

          <!-- Add / Edit form -->
          <div
            v-if="showForm"
            class="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-2.5 mt-2"
          >
            <p class="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">
              {{ editingId ? 'Edit Spec Owner' : 'New Spec Owner' }}
            </p>

            <!-- Area (with datalist suggestions) -->
            <div class="space-y-0.5">
              <label class="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Specification Area <span class="text-red-400">*</span>
              </label>
              <input
                v-model="form.area"
                type="text"
                list="spec-owner-areas"
                placeholder="Product, Quality, Financials…"
                class="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900
                       placeholder:text-gray-300
                       focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <datalist id="spec-owner-areas">
                <option v-for="area in AREA_SUGGESTIONS" :key="area" :value="area" />
              </datalist>
            </div>

            <!-- Name -->
            <div class="space-y-0.5">
              <label class="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Owner Name <span class="text-red-400">*</span>
              </label>
              <input
                v-model="form.name"
                type="text"
                placeholder="Full name…"
                class="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900
                       placeholder:text-gray-300
                       focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>

            <!-- Two-column: email + phone -->
            <div class="grid grid-cols-2 gap-2">
              <div class="space-y-0.5">
                <label class="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Email</label>
                <input
                  v-model="form.email"
                  type="email"
                  placeholder="email@…"
                  class="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900
                         placeholder:text-gray-300
                         focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <div class="space-y-0.5">
                <label class="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Phone</label>
                <input
                  v-model="form.phone"
                  type="tel"
                  placeholder="+1 555…"
                  class="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900
                         placeholder:text-gray-300
                         focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
            </div>

            <!-- Two-column: org + location -->
            <div class="grid grid-cols-2 gap-2">
              <div class="space-y-0.5">
                <label class="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Organisation</label>
                <input
                  v-model="form.organization"
                  type="text"
                  placeholder="Company…"
                  class="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900
                         placeholder:text-gray-300
                         focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <div class="space-y-0.5">
                <label class="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Location</label>
                <input
                  v-model="form.location"
                  type="text"
                  placeholder="City…"
                  class="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900
                         placeholder:text-gray-300
                         focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
            </div>

            <!-- Responsibility -->
            <div class="space-y-0.5">
              <label class="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Responsibility
              </label>
              <textarea
                v-model="form.responsibility"
                rows="2"
                placeholder="Brief description of their accountability for this area…"
                class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800
                       placeholder:text-gray-300 resize-none
                       focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>

            <!-- Form actions -->
            <div class="flex gap-2">
              <button
                type="button"
                class="flex-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white
                       hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400
                       transition-colors disabled:opacity-40"
                :disabled="!form.area.trim() || !form.name.trim()"
                @click="saveForm"
              >{{ editingId ? 'Update' : 'Add Owner' }}</button>
              <button
                type="button"
                class="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600
                       hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-colors"
                @click="cancelForm"
              >Cancel</button>
            </div>
          </div>
        </section>
      </ScrollContainer>
    </RightPanel>
  </Teleport>
</template>
