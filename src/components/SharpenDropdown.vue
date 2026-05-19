<!-- SharpenDropdown.vue — compact "🔪 Sharpen ▾" button for nav bars and toolbars.
     Clicking the button opens a dropdown of sharpening categories.
     Selecting a category emits 'open-sharpen' with the chosen category —
     the parent is responsible for showing the SharpenPanel (e.g. as a modal).

     Emits:  open-sharpen(SharpenCategory) — user chose a category -->

<script setup lang="ts">
import { ref } from 'vue'
import { SHARPEN_CATEGORIES, type SharpenCategory } from '../composables/useSharpen'

const emit = defineEmits<{ 'open-sharpen': [category: SharpenCategory] }>()

const open = ref(false)

function select(cat: SharpenCategory): void {
  open.value = false
  emit('open-sharpen', cat)
}

function toggle(): void {
  open.value = !open.value
}

function close(): void {
  open.value = false
}

// Exposed so App.vue can call close() from _closeAllOverlays() on stage navigation.
// Without this the backdrop lingers after navigation and blocks all clicks below it.
defineExpose({ close })
</script>

<template>
  <div class="relative">
    <!-- Trigger button -->
    <button
      type="button"
      :aria-expanded="open"
      aria-haspopup="true"
      aria-label="Sharpen spec"
      class="h-11 flex items-center gap-1.5 px-3 rounded-lg border border-amber-300
             bg-amber-50 text-amber-700 text-sm font-medium
             hover:bg-amber-100 hover:border-amber-400
             focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-1
             transition-colors duration-150 select-none"
      @click="toggle"
    >
      <span aria-hidden="true">🔪</span>
      Sharpen
      <span aria-hidden="true" class="text-xs opacity-70">▾</span>
    </button>

    <!-- Dropdown menu -->
    <!-- overflow-hidden removed: Safari clips pointer-event hit-testing at border-radius
         corners when overflow:hidden is set, making buttons near rounded corners unresponsive.
         Same fix as SharpenPanel.vue (inline mode) and modal mode. rounded-t-xl on the header
         preserves the clipped amber-50 background without affecting pointer events. -->
    <div
      v-if="open"
      class="absolute top-full right-0 mt-1.5 z-50 w-56 rounded-xl border border-amber-200
             bg-white shadow-xl"
      role="menu"
      aria-label="Sharpening dimensions"
    >
      <div class="px-3 py-2 border-b border-amber-100 bg-amber-50 rounded-t-xl">
        <p class="text-[11px] font-semibold text-amber-700 uppercase tracking-wide">
          Sharpen Aspects
        </p>
      </div>
      <div class="py-1">
        <button
          v-for="cat in SHARPEN_CATEGORIES"
          :key="cat.key"
          type="button"
          role="menuitem"
          :title="cat.hint"
          class="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700
                 hover:bg-amber-50 focus:outline-none focus:bg-amber-50 text-left
                 transition-colors duration-100"
          @click="select(cat)"
        >
          <span class="text-base leading-none w-5 text-center" aria-hidden="true">{{ cat.emoji }}</span>
          <span class="font-medium">{{ cat.label }}</span>
        </button>
      </div>
    </div>

    <!-- Invisible backdrop to close on outside click.
         Teleported to <body> so it lives in the root stacking context, not inside
         the nav bar's z-[55] stacking context. Without Teleport the z-40 backdrop
         resolves at z-55 level in the root, blocking all regular page content and
         causing the "everything freezes" bug after stage navigation. -->
    <Teleport to="body">
      <div
        v-if="open"
        class="fixed inset-0 z-40"
        aria-hidden="true"
        @click="close"
      />
    </Teleport>
  </div>
</template>
