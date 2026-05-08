<script setup lang="ts">
// DictateButton.vue — floating mic toggle, sits above the SpecCoach bubble.
// Position: fixed bottom-36 right-6 — stacked above SpeakerButton (bottom-24 right-6).
// aria-pressed reflects live on/off state for screen readers and Voice Control.

defineProps<{
  active: boolean
  supported: boolean
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
    class="fixed bottom-36 right-6 z-[370] flex items-center gap-1.5 px-3 py-2
           rounded-full shadow-lg text-sm font-medium select-none
           transition-colors duration-150
           focus:outline-none focus:ring-2 focus:ring-offset-2"
    :class="!supported
      ? 'bg-white text-gray-300 border border-gray-100 cursor-not-allowed'
      : active
        ? 'bg-red-500 text-white focus:ring-red-400 animate-pulse'
        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 focus:ring-indigo-400'"
    @click="supported && emit('toggle')"
  >
    <span aria-hidden="true">{{ active ? '🔴' : '🎤' }}</span>
    {{ active ? 'Mic Off' : 'Turn On Mic' }}
  </button>
</template>
