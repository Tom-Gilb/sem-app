<!-- UNIT_TYPE=Widget -->
<!-- PlanOwnerPanel — Owners, Planners, and Scribes for this plan.
     Three-tab panel for the three distinct people roles:
       🔑 Owner   — accountable stakeholder with approval/change sign-off authority.
       💡 Planner — the person who conceives and directs the plan ideas.
       ⌨️ Scribe  — the person who does the actual keying/dictation (rotates in Mob Planning).
     Each person carries a contact card + responsibility domain + empowerment date range.
     Open from the chips in the Plan Identity Bar or from the Detail menu.
     Auto-saves any open form on tab switch and on panel close so no edits are lost. -->

<script setup lang="ts">
import { ref, reactive, watch, computed, nextTick } from 'vue'
import ScrollContainer from './ScrollContainer.vue'
import CloseDot from './CloseDot.vue'
import EditGlyph from './icons/EditGlyph.vue'
import {
  addOwner, updateOwner, removeOwner,
  addPlanner, updatePlanner, removePlanner,
  addScribe, updateScribe, removeScribe,
  setDeviceUserName,
} from '../composables/usePlanModel'
import type { PlanModel, PlanOwner } from '../composables/usePlanModel'

const props = defineProps<{
  planModel: PlanModel
  /** Pre-select a tab on open */
  initialTab?: 'owners' | 'planners' | 'scribes'
}>()

const emit = defineEmits<{ close: [] }>()

// ── Tabs ──────────────────────────────────────────────────────────────────────

const activeTab = ref<'owners' | 'planners' | 'scribes'>(props.initialTab ?? 'owners')
watch(() => props.initialTab, (t) => { if (t) activeTab.value = t })

// ── Auto-save on tab switch ──────────────────────────────────────────────────
// Tom (2026-05-12): "There is a bug, it keeps losing things put in and puts
// Planner data in owner". The cause was that the watcher used to call
// saveForm() AFTER activeTab had already mutated to the NEW tab, so the
// save dispatcher misfiled the in-progress data into the wrong collection
// (e.g. typing a Planner, switching to Owners → addOwner() with Planner's
// data). The fix uses the watcher's old-value parameter and dispatches the
// save to the OLD tab explicitly via saveFormToTab(oldTab). The user's
// in-progress edit is now ALWAYS persisted to the tab they were editing,
// regardless of where they navigate next.
watch(activeTab, (_newTab, oldTab) => {
  if (formOpen.value && form.name.trim()) {
    saveFormToTab(oldTab as TabKey)
  } else {
    cancelForm()
  }
})

const TAB = {
  owners: {
    icon: '🔑', label: 'Owner',
    hint: 'Accountable for this plan — holds approval authority and change sign-off. Multiple owners each cover a named responsibility domain.',
    addLabel: '+ Add Owner',
    responsibilityPlaceholder: 'e.g. Product ownership + change sign-off',
  },
  planners: {
    icon: '💡', label: 'Planner',
    hint: 'The person (or people) who conceived the plan ideas — directing what goes in and why. Planners think and direct; Scribes type.',
    addLabel: '+ Add Planner',
    responsibilityPlaceholder: 'e.g. Lead strategist, Quality section',
  },
  scribes: {
    icon: '⌨️', label: 'Scribe',
    hint: 'Who is at the keyboard right now. New plans default to the device user (marked "default setting") — tap to set your name. In Mob Planning the Scribe rotates; add each person with their empowerment date range.',
    addLabel: '+ Add Scribe',
    responsibilityPlaceholder: 'e.g. Morning session, Sprint 3 kickoff',
  },
} as const

type TabKey = keyof typeof TAB

const cfg = computed(() => TAB[activeTab.value])

const list = computed<PlanOwner[]>(() => {
  if (activeTab.value === 'owners')   return props.planModel.owners
  if (activeTab.value === 'planners') return props.planModel.planners
  return props.planModel.scribes ?? []
})

function _count(tab: TabKey): number {
  if (tab === 'owners')   return props.planModel.owners.length
  if (tab === 'planners') return props.planModel.planners.length
  return (props.planModel.scribes ?? []).length
}

// ── Edit / Add form ───────────────────────────────────────────────────────────

const editingId = ref<string | null>(null)  // null = "add new" mode
const formOpen  = ref(false)

const form = reactive({
  name: '', responsibility: '', email: '', phone: '', organization: '', location: '',
  startDate: '', endDate: '',
})

/** Set briefly when user clicks save with no name — drives the inline red
 *  "Please enter a name first" banner instead of a silently-disabled button.
 *  Tom 2026-05-13 mid-demo: "add scribe databutton inactive" — the button
 *  being grayed out (disabled) read as broken; making it always-clickable
 *  and surfacing the validation as a banner is the friendlier failure mode. */
const nameError = ref(false)

function _today(): string { return new Date().toISOString().slice(0, 10) }

function _fillForm(p: PlanOwner): void {
  form.name = p.name; form.responsibility = p.responsibility
  form.email = p.email; form.phone = p.phone
  form.organization = p.organization; form.location = p.location
  form.startDate = p.startDate ?? _today(); form.endDate = p.endDate ?? ''
}

function _clearForm(): void {
  form.name = ''; form.responsibility = ''; form.email = ''
  form.phone = ''; form.organization = ''; form.location = ''
  form.startDate = _today(); form.endDate = ''
}

/** Snapshot of the form when it was opened — used to detect "dirty" state */
const _openSnapshot = ref<string>('')
function _formSignature(): string {
  return [form.name, form.responsibility, form.email, form.phone,
          form.organization, form.location, form.startDate, form.endDate].join('|')
}
const isDirty = computed<boolean>(() => formOpen.value && _formSignature() !== _openSnapshot.value)

/** Last save status — drives the inline "Saved!" pill so the user has feedback */
const lastSaved = ref<{ tab: TabKey; name: string; ts: number } | null>(null)
const justSavedVisible = ref(false)
function _flashSavedPill(tab: TabKey, name: string): void {
  lastSaved.value = { tab, name, ts: Date.now() }
  justSavedVisible.value = true
  // Hide after 2.4 s
  setTimeout(() => { justSavedVisible.value = false }, 2400)
}

// ── Form scroll-into-view + autofocus ────────────────────────────────────────
// Tom 2026-05-15: "it must scroll up and present itself" + "blinking signal /
// write owner name here". After formOpen flips true we:
//   1. Scroll the footer (Save/Cancel) to the bottom edge — always reachable.
//   2. Scroll the form's top heading to the start of the visible area.
//   3. Focus the first <input> so the cursor blinks immediately — no hunting.
// For the add-new form `addFormEl` ref is used; for inline-edit forms we query
// the DOM by `[data-inline-edit-form]` (set on the expanded <li> edit block).
const addFormEl  = ref<HTMLElement | null>(null)
const footerEl   = ref<HTMLElement | null>(null)

function _scrollAndFocus(formEl: HTMLElement | null): void {
  footerEl.value?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  if (formEl) {
    formEl.scrollIntoView({ behavior: 'smooth', block: 'start' })
    formEl.querySelector<HTMLInputElement>('input')?.focus()
  }
}

function _scrollFormIntoView(): void {
  nextTick(() => {
    // Add-new path: addFormEl is set (v-if="formOpen && editingId===null").
    // Edit path: addFormEl is null; find the expanded inline form by data attr.
    const target = addFormEl.value
      ?? document.querySelector<HTMLElement>('[data-inline-edit-form]')
    _scrollAndFocus(target)
  })
}

function openAdd(): void {
  editingId.value = null; _clearForm(); formOpen.value = true
  _openSnapshot.value = _formSignature()
  _scrollFormIntoView()
}
function openEdit(p: PlanOwner): void {
  editingId.value = p.id; _fillForm(p); formOpen.value = true
  _openSnapshot.value = _formSignature()
  _scrollFormIntoView()
}

function cancelForm(): void {
  formOpen.value = false; editingId.value = null; _clearForm()
  _openSnapshot.value = ''
}

/** Close the panel, auto-saving any open form with a valid name so no edits are lost. */
function closePanel(): void {
  if (formOpen.value && form.name.trim()) saveFormToTab(activeTab.value)
  else cancelForm()
  emit('close')
}

/**
 * Saves the current form data to a SPECIFIC tab.
 * Critical: do not use `activeTab.value` inside this dispatcher — it must be
 * passed in explicitly so auto-save-on-tab-switch can save to the OLD tab
 * (the one the user was actually editing) instead of the NEW tab the user
 * just navigated to. That misfiling was the "Planner data ends up in
 * Owners" bug Tom reported on 2026-05-12.
 */
function saveFormToTab(tab: TabKey): void {
  if (!form.name.trim()) {
    nameError.value = true
    // Clear the flash after 3 s so the banner doesn't linger forever
    setTimeout(() => { nameError.value = false }, 3000)
    return
  }
  nameError.value = false
  const data = {
    name: form.name.trim(), responsibility: form.responsibility.trim(),
    email: form.email.trim(), phone: form.phone.trim(),
    organization: form.organization.trim(), location: form.location.trim(),
    startDate: form.startDate, endDate: form.endDate,
  }
  if (tab === 'owners') {
    editingId.value ? updateOwner(editingId.value, data) : addOwner(data)
  } else if (tab === 'planners') {
    editingId.value ? updatePlanner(editingId.value, data) : addPlanner(data)
  } else {
    if (editingId.value) {
      // If this is the default device-user scribe, also update the stored device
      // name so future plans pre-populate with the corrected name.
      const isDefaultScribe = list.value.find(p => p.id === editingId.value)?.isDefault
      if (isDefaultScribe && data.name) setDeviceUserName(data.name)
      updateScribe(editingId.value, data)
    } else {
      addScribe(data)
    }
  }
  _flashSavedPill(tab, data.name)
  cancelForm()
}

/** Default save target = whatever tab is currently active. */
function saveForm(): void { saveFormToTab(activeTab.value) }

function removePerson(id: string): void {
  if (activeTab.value === 'owners')        removeOwner(id)
  else if (activeTab.value === 'planners') removePlanner(id)
  else                                     removeScribe(id)
  if (editingId.value === id) cancelForm()
}

// ── Date range display helper ─────────────────────────────────────────────────

function _dateLabel(p: PlanOwner): string {
  const s = p.startDate ?? ''
  const e = p.endDate ?? ''
  if (!s && !e) return ''
  if (s && !e)  return `from ${s} — active`
  if (!s && e)  return `until ${e}`
  return `${s} → ${e}`
}

// ── Form field definitions ────────────────────────────────────────────────────

const CONTACT_FIELDS = [
  { key: 'name'           as const, label: 'Name *',         type: 'text',  placeholder: 'Full name…' },
  { key: 'responsibility' as const, label: 'Responsibility', type: 'text',  placeholder: '' },
  { key: 'email'          as const, label: 'Email',          type: 'email', placeholder: 'email@example.com' },
  { key: 'phone'          as const, label: 'Phone',          type: 'tel',   placeholder: '+1 555 000 0000' },
  { key: 'organization'   as const, label: 'Organisation',   type: 'text',  placeholder: 'Company or team…' },
  { key: 'location'       as const, label: 'Location',       type: 'text',  placeholder: 'City, Country…' },
]

const DATE_FIELDS = [
  { key: 'startDate' as const, label: 'Empowered from', type: 'date', placeholder: '' },
  { key: 'endDate'   as const, label: 'Empowered until (blank = still active)', type: 'date', placeholder: '' },
]
</script>

<template>
  <Teleport to="body">
    <!-- NO backdrop — Tom 2026-05-12: the previous `fixed inset-0 z-[57]`
         invisible click-trap blocked all clicks on the dark `PlanModelBar`
         (and anything else outside the panel). Result: tapping a chip on the
         dark bar landed on the backdrop, closed the panel, and the chip's
         `open-people` event never fired ("the lower black bar does not react
         to me clicking the icents"). Removing the backdrop preserves full
         interactivity of the rest of the app while the panel is open; closing
         is still one click away via the ⊖ CloseDot in the panel header (or
         Escape from any field). The universal-single-surface rule still auto-
         closes this panel when another major surface opens. -->

    <!-- Panel — starts at top-[112px] to clear the Plan Crest. The Plan
         Crest is now TWO rows (py-1.5 + h-12 hero title + h-10 controls
         ≈ 108 px) after Tom's 2026-05-12 third-pass redesign — "the title
         is still not what I asked for, large long color, drama attention,
         own line if necessary". The title now occupies its own dedicated
         hero row at text-2xl, so the panel must drop lower than the
         single-row top-[72px] used after the second-pass redesign.
         Max-height uses calc(100vh - 13rem) so the panel is GUARANTEED to
         fit between the Plan Crest and the viewport bottom — AND leave a
         ~5rem (80 px) buffer at the bottom-left corner so the Save button
         is NEVER covered by any bottom-left floating widget (Vue DevTools'
         draggable pin showing "Drag to move", any 🆘-style escape pill, or
         a dictation badge). Tom 2026-05-13: "the add owner save is covered
         with junk and cannot be added" — the previous `calc(100vh - 8rem)`
         left only 16 px clearance from viewport bottom, and any ~40 px tall
         bottom-left widget sat right on top of the Save button. Tom earlier
         2026-05-12: "the save scribe button is under the window and
         unreachable" — addressed by capping max-height to viewport instead
         of the old 80vh. -->
    <!-- 2026-05-13 (third pass) — Tom screenshot shows the footer Add button
         visually overlapping the form's "📅 Dates Empowered" section EVEN AFTER
         the previous z-index/isolate fix. Root cause: flex-col + shrink-0 +
         flex-1 min-h-0 was supposed to give the footer its own row at the
         bottom, but in some viewport heights the math allowed the form's bottom
         to render in the same vertical band as the footer. Switched the panel
         to **CSS Grid with explicit grid-template-rows** — `auto auto 1fr auto`
         — so each row's height is mathematically reserved by the browser:
           row 1 (auto) — header (its content height, never shrinks)
           row 2 (auto) — tabs   (its content height, never shrinks)
           row 3 (1fr)  — ScrollContainer (gets ALL remaining space, scrolls)
           row 4 (auto) — footer (its content height, never shrinks; absent when !formOpen)
         When the footer's v-if is false, grid silently uses 3 rows. Children
         can NEVER occupy each other's rows under grid; this regression class
         is now structurally impossible. Note `grid-rows-[auto_auto_auto_1fr_auto]`
         uses Tailwind arbitrary-value syntax — 5 rows: header / tabs /
         confirmation-bar (collapses to 0 when v-if false) / ScrollContainer
         (1fr) / footer. Tom 2026-05-15: "feedback / save button / save on close". -->
    <div
      class="fixed top-[112px] left-4 z-[58] w-96 bg-white rounded-xl shadow-2xl
             border border-indigo-100 grid grid-rows-[auto_auto_auto_1fr_auto] overflow-hidden"
      style="max-height: calc(100vh - 13rem)"
      role="dialog"
      :aria-label="`Plan ${cfg.label}s`"
    >
      <!-- Header — "Plan Responsibilities" (renamed 2026-05-12 per Tom). The
           inline status pill shows either "● Unsaved" (warning) or "✓ Saved
           {Tab} {name}" (transient ack), so users always know the save state. -->
      <div class="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-700 to-violet-600 text-white shrink-0">
        <span class="text-sm font-semibold whitespace-nowrap">Plan Responsibilities</span>

        <!-- Status pill — Unsaved (amber) > Saved (green) > nothing -->
        <Transition
          enter-active-class="transition-opacity duration-150"
          leave-active-class="transition-opacity duration-200"
          enter-from-class="opacity-0"
          leave-to-class="opacity-0"
        >
          <span
            v-if="isDirty"
            class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full
                   bg-amber-300 text-amber-900 shadow-sm"
            aria-live="polite"
            data-testid="dirty-pill"
          >● Unsaved</span>
          <span
            v-else-if="justSavedVisible && lastSaved"
            class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full
                   bg-emerald-300 text-emerald-900 shadow-sm"
            aria-live="polite"
            data-testid="saved-pill"
          >
            ✓ {{ lastSaved.name }} noted
          </span>
        </Transition>

        <span class="ml-auto"></span>

        <!-- FOMO-killer label — Tom 2026-05-15: "not sufficient to dare to
             hover close before we know the data is actually saved".
             When the form is dirty the label appears BEFORE the CloseDot so
             the user sees "close = saves ↑" without hovering. The arrow
             points at the dot directly. Fades in/out with the dirty state. -->
        <Transition
          enter-active-class="transition-opacity duration-200"
          leave-active-class="transition-opacity duration-150"
          enter-from-class="opacity-0"
          leave-to-class="opacity-0"
        >
          <span
            v-if="isDirty"
            class="text-[11px] font-semibold text-emerald-300 whitespace-nowrap select-none"
            aria-hidden="true"
          >close = saves ↑</span>
        </Transition>

        <CloseDot
          variant="on-dark"
          :title="isDirty ? 'Save & Close — your data will be saved' : 'Close'"
          :ariaLabel="isDirty ? 'Save and close — data is auto-saved on close' : 'Close Plan Responsibilities'"
          @click="closePanel()"
        />
      </div>

      <!-- Tabs -->
      <div class="flex border-b border-gray-100 shrink-0">
        <button
          v-for="tab in (['owners', 'planners', 'scribes'] as const)"
          :key="tab"
          type="button"
          :class="[
            'flex-1 py-2.5 flex flex-col items-center gap-0.5 text-xs font-semibold transition-colors',
            activeTab === tab
              ? 'border-b-2 border-indigo-600 text-indigo-700 bg-indigo-50/50'
              : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50',
          ]"
          @click="activeTab = tab"
        >
          <!-- Icon — bigger than the label for easy tap targeting -->
          <span class="text-xl leading-none" aria-hidden="true">{{ TAB[tab].icon }}</span>
          <span class="flex items-center gap-1">
            {{ TAB[tab].label }}
            <span
              :class="['rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                       activeTab === tab ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500']"
            >{{ _count(tab) }}</span>
          </span>
        </button>
      </div>

      <!-- Confirmation bar — row 3. Appears for 2.4 s after any save.
           Tom 2026-05-15: "feedback ([Steward] data is noted)".
           Lives between tabs and ScrollContainer so it is ALWAYS in view
           regardless of scroll position — v-if collapses it to zero height
           when not showing. -->
      <Transition
        enter-active-class="transition-all duration-200 overflow-hidden"
        leave-active-class="transition-all duration-300 overflow-hidden"
        enter-from-class="max-h-0 opacity-0"
        enter-to-class="max-h-16 opacity-100"
        leave-from-class="max-h-16 opacity-100"
        leave-to-class="max-h-0 opacity-0"
      >
        <div
          v-if="justSavedVisible && lastSaved"
          class="shrink-0 px-4 py-2.5 bg-emerald-50 border-b border-emerald-100 flex items-center gap-2"
          aria-live="polite"
          role="status"
        >
          <span class="text-emerald-500 text-base leading-none" aria-hidden="true">✓</span>
          <span class="text-emerald-800 text-sm font-semibold">
            {{ lastSaved.name }} data is noted
          </span>
          <span class="ml-auto text-emerald-500/60 text-[10px] uppercase tracking-wide">
            {{ TAB[lastSaved.tab].label }}
          </span>
        </div>
      </Transition>

      <!-- Scrollable body — :no-pill because the panel has a sticky Save /
           Cancel footer immediately below; the bouncing dark pill would visually
           collide with the bottom row of form fields and the footer, hiding
           the date inputs and making the user think the form was clipped.
           The gradient fade alone still cues "scroll for more". -->
      <!-- inner-class pb-6 (was pb-2) so the form's last row (date inputs) cannot
           rest visually under the footer's top shadow, which the user reads as
           "junk overlapping the Add button" (Tom 2026-05-13). -->
      <ScrollContainer outer-class="min-h-0 relative" inner-class="h-full pb-6" :no-pill="true">

        <!-- Hint -->
        <p class="px-4 pt-3 pb-2 text-[10px] text-gray-400 leading-snug">{{ cfg.hint }}</p>

        <!-- List of people -->
        <ul class="px-3 space-y-2">
          <li
            v-for="person in list"
            :key="person.id"
            class="rounded-lg border bg-gray-50 overflow-hidden"
            :class="editingId === person.id ? 'border-indigo-300' : 'border-gray-100'"
          >
            <!-- Person row — 2026-05-13 Tom: "show detail (email, respo, dates etc)"
                 when looking at existing people. Expanded from single-line name
                 to a multi-line contact card showing all filled fields inline. -->
            <div class="flex items-start gap-2 px-3 py-2.5">
              <div class="flex-1 min-w-0 space-y-0.5">
                <!-- Name + default badge -->
                <div class="flex items-center gap-1.5 flex-wrap">
                  <p class="text-sm font-semibold text-gray-800 truncate">{{ person.name || '(unnamed — tap ✏️ to set your name)' }}</p>
                  <span
                    v-if="person.isDefault"
                    class="shrink-0 px-2.5 py-1 rounded text-sm font-bold uppercase tracking-wide
                           bg-amber-100 text-amber-700 border border-amber-200"
                  >default</span>
                </div>
                <!-- Responsibility -->
                <p v-if="person.responsibility" class="text-sm text-indigo-600 leading-snug">{{ person.responsibility }}</p>
                <p v-else-if="person.isDefault && !person.name" class="text-xs text-amber-600 leading-snug">Tap ✏️ to set your name — saved for future plans</p>
                <!-- Contact details — email, phone, org, location -->
                <p v-if="person.email" class="text-sm text-gray-500 leading-snug">
                  <span class="text-gray-300 mr-0.5">✉</span>{{ person.email }}
                </p>
                <p v-if="person.phone" class="text-sm text-gray-500 leading-snug">
                  <span class="text-gray-300 mr-0.5">📞</span>{{ person.phone }}
                </p>
                <p v-if="person.organization || person.location" class="text-sm text-gray-400 leading-snug truncate">
                  {{ [person.organization, person.location].filter(Boolean).join(' · ') }}
                </p>
                <!-- Dates — made more visible (gray-400 not gray-300) -->
                <p v-if="_dateLabel(person)" class="text-sm text-indigo-400 leading-snug">
                  📅 {{ _dateLabel(person) }}
                </p>
              </div>
              <button
                type="button"
                class="shrink-0 text-xs text-indigo-500 hover:text-indigo-700 px-2 py-1 rounded hover:bg-indigo-50 transition-colors"
                :aria-label="`Edit ${person.name}`"
                @click="editingId === person.id && formOpen ? cancelForm() : openEdit(person)"
              >{{ editingId === person.id && formOpen ? '✕' : '' }}<EditGlyph v-if="!(editingId === person.id && formOpen)" size="compact" class="h-3 w-auto shrink-0" aria-label="Edit person" /></button>
              <button
                type="button"
                class="shrink-0 text-[10px] text-red-400 hover:text-red-600 px-1.5 py-1 rounded hover:bg-red-50 transition-colors"
                :aria-label="`Remove ${person.name}`"
                @click="removePerson(person.id)"
              >Remove</button>
            </div>

            <!-- Inline edit form for this person -->
            <div v-if="formOpen && editingId === person.id" data-inline-edit-form class="px-3 pb-3 pt-2 bg-white border-t border-gray-100 space-y-2">
              <!-- Contact fields -->
              <div v-for="f in CONTACT_FIELDS" :key="f.key">
                <label class="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{{ f.label }}</label>
                <input
                  v-model="form[f.key]"
                  :type="f.type"
                  :placeholder="f.key === 'responsibility' ? cfg.responsibilityPlaceholder : f.placeholder"
                  class="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-900
                         placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400
                         focus:border-transparent transition-colors"
                  @keydown.escape="cancelForm"
                  @keydown.enter.ctrl="saveForm"
                  @keydown.enter.meta="saveForm"
                />
              </div>
              <!-- Date range -->
              <p class="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider pt-1">📅 Dates Empowered</p>
              <div class="grid grid-cols-2 gap-2">
                <div v-for="f in DATE_FIELDS" :key="f.key">
                  <label class="block text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{{ f.label }}</label>
                  <input
                    v-model="form[f.key]"
                    type="date"
                    class="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-900
                           focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-colors"
                    @keydown.escape="cancelForm"
                  />
                </div>
              </div>
              <!-- Inline edit form intentionally does NOT render its own save row.
                   A single panel-level action footer (below the ScrollContainer)
                   shows Save / Cancel pinned to the bottom of the panel so the
                   user can always see how to save — regardless of how far they
                   have scrolled. Tom 2026-05-12: "it says unsaved but there is
                   no save possibility here yet" — the in-form sticky button was
                   below the fold on shorter viewports. -->
            </div>
          </li>

          <!-- Empty state -->
          <li v-if="list.length === 0" class="text-center py-5 text-gray-300 text-sm italic">
            No {{ cfg.label.toLowerCase() }}s added yet
          </li>
        </ul>

        <!-- Add-new form (floating below list when not editing an existing person) -->
        <div v-if="formOpen && editingId === null" ref="addFormEl" class="mx-3 mt-2 rounded-lg border border-indigo-200 bg-indigo-50/40 p-3 space-y-2">
          <p class="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider">
            New {{ cfg.label }}
          </p>
          <!-- Contact fields -->
          <div v-for="f in CONTACT_FIELDS" :key="f.key">
            <label class="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{{ f.label }}</label>
            <input
              v-model="form[f.key]"
              :type="f.type"
              :placeholder="f.key === 'name'
                ? 'Type ' + cfg.label.toLowerCase() + ' name…'
                : f.key === 'responsibility' ? cfg.responsibilityPlaceholder : f.placeholder"
              class="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-900
                     placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400
                     focus:border-transparent transition-colors"
              @keydown.escape="cancelForm"
              @keydown.enter.ctrl="saveForm"
              @keydown.enter.meta="saveForm"
            />
          </div>
          <!-- Date range -->
          <p class="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider pt-1">📅 Dates Empowered</p>
          <div class="grid grid-cols-2 gap-2">
            <div v-for="f in DATE_FIELDS" :key="f.key">
              <label class="block text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{{ f.label }}</label>
              <input
                v-model="form[f.key]"
                type="date"
                class="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-900
                       focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-colors"
                @keydown.escape="cancelForm"
              />
            </div>
          </div>
          <!-- Add-new form intentionally does NOT render its own save row.
               See note on the inline edit form above — Save / Cancel live in
               the panel-level footer below the ScrollContainer. -->
        </div>

        <!-- Add button — hidden on Scribe tab when ≥1 scribe already exists.
             Tom 2026-05-15: "it went from save scribe to new scribe, not
             necessary, usually only 1 scribe." The prominent dashed button
             pushed the user toward adding a second scribe they didn't want.
             Owners and Planners always show the button (multiple is normal).
             For the rare Mob Planning case a quiet text link stays available. -->
        <div v-if="!formOpen && (activeTab !== 'scribes' || list.length === 0)" class="px-3 mt-2">
          <button
            type="button"
            class="w-full rounded-lg border border-dashed border-indigo-300 py-2 text-xs font-medium
                   text-indigo-500 hover:bg-indigo-50 hover:border-indigo-400 transition-colors"
            @click="openAdd"
          >{{ cfg.addLabel }}</button>
        </div>
        <!-- Mob Planning escape hatch — scribes tab, already has ≥1 scribe -->
        <div v-if="!formOpen && activeTab === 'scribes' && list.length > 0" class="px-3 mt-1 text-center">
          <button
            type="button"
            class="text-[10px] text-gray-400 hover:text-indigo-500 transition-colors underline-offset-2 hover:underline"
            @click="openAdd"
          >Add another scribe (Mob Planning)</button>
        </div>

      </ScrollContainer>

      <!-- Action footer — pinned to the bottom of the panel itself (not inside
           ScrollContainer) so Save / Cancel are always visible while the form is
           open, regardless of scroll position. Was previously stuck at the end
           of the scrolled form content, which on the 80vh panel meant the user
           saw the "● Unsaved" pill but no Save button. (2026-05-12, Tom)
           STACK (2026-05-13, Tom "could not save planner data"): the side-by-side
           Save / Cancel row could NOT fit "Add Planner Data" + 💾 icon inside
           Save's flex-[2] share AND keep Cancel on screen — neither flex child
           had min-w-0, so the intrinsic content widths pushed the row past the
           panel's w-96 boundary and the panel's `overflow-hidden` clipped the
           Cancel button entirely (and the tail of "Data" on Save). Solution:
           stack Save full-width primary, Cancel as a smaller centered secondary
           below. Width distribution can no longer break. Also dropped the 💾
           floppy disk (retired per Tom 2026-05-12 anachronistic glyph ruling).
           ISOLATION (2026-05-13, Tom "junk in front of add planner button isnot
           yet fixed"): added `relative isolate z-10` + an explicit solid white
           background AND `shadow-[0_-8px_12px_-8px_rgba(0,0,0,0.12)]` top-edge
           shadow so the footer creates its own stacking context that NOTHING
           inside the scrolled form can ever bleed into — regardless of overflow
           leak or transform-induced repaint glitch. The shadow also gives a
           visible "this footer is on top" affordance so the user can see that
           the buttons below ARE the active save row. -->
      <div
        v-if="formOpen"
        ref="footerEl"
        class="shrink-0 border-t border-gray-100 bg-white px-3 py-2.5 space-y-1.5 relative isolate z-10
               shadow-[0_-8px_12px_-8px_rgba(0,0,0,0.12)]"
      >
        <!-- Inline error banner — surfaces when the user clicks save without
             entering a name. Replaces the old silently-disabled button which
             read as broken. Tom 2026-05-13 mid-demo: "add scribe databutton
             inactive". -->
        <p
          v-if="nameError"
          role="alert"
          aria-live="assertive"
          class="rounded-md bg-red-50 border border-red-300 text-red-800 text-xs font-semibold px-3 py-1.5 text-center"
          data-testid="name-error"
        >⚠️ Please enter a name first</p>
        <button type="button"
          class="w-full inline-flex items-center justify-center rounded-lg
                 bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:shadow
                 hover:bg-indigo-700 active:bg-indigo-800
                 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1
                 transition-all cursor-pointer"
          :title="editingId ? `Save changes to this ${cfg.label}` : `Save this ${cfg.label} (⌘↩)`"
          data-testid="footer-save"
          @click="saveForm"
        >
          <span class="truncate">{{ editingId ? `Save ${cfg.label}` : `Save ${cfg.label}` }}</span>
        </button>
        <button type="button"
          class="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium
                 text-gray-600 hover:bg-gray-50 hover:text-gray-800
                 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-colors"
          @click="cancelForm">Cancel</button>
        <p class="text-[10px] text-gray-400 italic text-center">
          ⌘↩ saves · Esc cancels · closing auto-saves
        </p>
      </div>
    </div>
  </Teleport>
</template>
