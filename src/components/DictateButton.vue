<script setup lang="ts">
// DictateButton.vue — mic toggle button.
// Positioning is owned by the PARENT (it is mounted inside the persistent
// right-side FAB cluster in App.vue, stacked above the ⚡ Actions button so
// users always have one-tap access to voice without opening Actions).
// 2026-05-13: removed self-positioning `fixed bottom-12 left-6 z-[370]` per
// Tom: "the mic and speaker options are hidden in actions, theyneed to be on
// the surface at all times right side above actions and nnot colliding with
// it". Self-fixed positioning made the button collide with whichever bottom-
// left widget existed at the time and prevented stacking with Actions.

const props = defineProps<{
  active: boolean
  supported: boolean
  /** compact=true → icon-only pill (no label). Use inside tight bars. */
  compact?: boolean
}>()

const emit = defineEmits<{ toggle: [] }>()
</script>

<template>
  <!-- Always visible on every screen. Disabled (greyed) when browser has no Speech API. -->
  <button
    type="button"
    :disabled="!supported"
    :aria-label="!supported ? 'Voice not available' : active ? 'Mic Off' : 'Turn On Mic'"
    :aria-pressed="active"
    :title="!supported
      ? 'Voice commands are not supported in this browser'
      : active
        ? 'Voice commands on — say «Mic Off» or press F5 to stop'
        : 'Click, press F5, or say «Turn on Mic» to start'"
    :class="[
      props.compact
        ? 'w-9 h-9 justify-center rounded-lg shadow-none border-0 text-xl px-0 py-0'
        : 'flex items-center gap-1.5 px-3 py-2 rounded-full shadow-lg text-sm font-medium',
      !supported
        ? 'bg-white/10 text-white/30 cursor-not-allowed'
        : active
          ? (props.compact ? 'bg-red-500/80 text-white animate-pulse focus:ring-red-400' : 'bg-red-500 text-white focus:ring-red-400 animate-pulse')
          : (props.compact
              ? 'bg-amber-400/80 text-amber-900 hover:bg-amber-400 focus:ring-amber-300'
              : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 focus:ring-indigo-400'),
      'flex items-center select-none transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2',
    ]"
    @click="supported && emit('toggle')"
  >
    <span aria-hidden="true">{{ active ? '🔴' : '🎤' }}</span>
    <span v-if="!props.compact">{{ active ? 'Mic Off' : 'Turn On Mic' }}</span>
  </button>
</template>
