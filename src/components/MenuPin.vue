<script setup lang="ts">
// UNIT_TYPE=Vue Component
// MenuPin — the SINGLE button on the Aperture canvas.
//
// Tom 2026-05-14: *"There needs to be one button which is used to get any
// more clutter, and it should have choices such as Full Menu, Basic Menu,
// Start Menu, Previous Plan Menu, Novice Menu, Plan… This master Menu
// button is called 'Menu'."*
//
// Placement: top-right, away from the aperture's optical centre so it does
// not compete for attention. Hover-grows softly (no scale jump). When
// pressed it reveals a small list of 6 view modes (see MENU_ITEMS in
// useApertureMode). Picking one updates the shared `view` ref — App.vue
// reacts by either keeping the Aperture overlay (`'plan'`) or letting it
// hide so the underlying surface shows through.
//
// The current view's row is highlighted so the user can confirm where they
// are *and* see "Plan" listed so they always know how to get back.
//
// z-[400] keeps it above the Aperture canvas (350) but below major
// surfaces (≤500) — which is fine because when a major surface opens,
// the Menu is naturally hidden by it; the user reaches it again by
// closing that surface (which returns them to whatever view they had).

import { ref, onMounted, onUnmounted } from 'vue'
import { useApertureMode, type ApertureView } from '../composables/useApertureMode'

const { view, setView, MENU_ITEMS } = useApertureMode()
const open = ref(false)

function toggle(): void {
  open.value = !open.value
}

function pick(id: ApertureView): void {
  setView(id)
  open.value = false
}

function onDocClick(e: MouseEvent): void {
  const t = e.target as HTMLElement | null
  if (!t || !t.closest('[data-menu-pin]')) open.value = false
}

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape' && open.value) {
    e.preventDefault()
    open.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKey)
})
onUnmounted(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div data-menu-pin class="fixed top-4 right-4 z-[400]">
    <button
      type="button"
      @click="toggle"
      class="
        px-3.5 py-1.5 rounded-full text-sm font-medium
        text-slate-500 hover:text-slate-900
        bg-white/0 hover:bg-slate-100
        ring-1 ring-transparent hover:ring-slate-200
        transition
      "
      :class="open ? 'text-slate-900 bg-slate-100 ring-slate-200' : ''"
      aria-haspopup="menu"
      :aria-expanded="open"
      title="Menu — choose a view"
    >
      Menu
    </button>

    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 -translate-y-1 scale-95"
      enter-to-class="opacity-100 translate-y-0 scale-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        role="menu"
        aria-label="Choose a view"
        class="
          mt-2 w-72 rounded-2xl bg-white p-1.5
          shadow-2xl ring-1 ring-slate-200
          origin-top-right
        "
      >
        <button
          v-for="item in MENU_ITEMS"
          :key="item.id"
          type="button"
          role="menuitem"
          @click="pick(item.id)"
          class="
            w-full text-left px-3 py-2.5 rounded-xl
            flex flex-col gap-0.5
            transition
          "
          :class="[
            view === item.id
              ? 'bg-slate-100 ring-1 ring-slate-200'
              : 'hover:bg-slate-50',
          ]"
        >
          <span class="text-sm font-medium text-slate-900 flex items-center gap-2">
            <span
              v-if="item.id === 'plan'"
              class="inline-flex h-2 w-2 rounded-full bg-emerald-500"
              aria-hidden="true"
            />
            {{ item.label }}
            <span
              v-if="view === item.id"
              class="ml-auto text-[10px] uppercase tracking-wider text-slate-500"
            >Current</span>
          </span>
          <span class="text-xs text-slate-500">{{ item.blurb }}</span>
        </button>

        <!-- Whisper: how to return -->
        <div class="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-slate-400">
          Pick <span class="text-slate-600">Plan</span> any time to return to the aperture.
        </div>
      </div>
    </Transition>
  </div>
</template>
