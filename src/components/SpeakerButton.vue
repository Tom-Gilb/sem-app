<!-- SpeakerButton.vue — floating text-to-speech output toggle.
     Position: fixed bottom-24 right-6 — stacked below DictateButton (bottom-36 right-6).
     Always visible on every screen; greyed when SpeechSynthesis unavailable. -->

<script setup lang="ts">
import { speakerSupported, speaking, paused, stopSpeaking, togglePause } from '../composables/useSpeaker'

const props = defineProps<{
  /** Text to speak when the button is pressed (caller passes stage-appropriate content) */
  text: string
}>()

const emit = defineEmits<{ speak: [text: string] }>()

function handleClick(): void {
  if (!speakerSupported) return
  if (speaking.value) {
    stopSpeaking()
  } else {
    emit('speak', props.text)
  }
}
</script>

<template>
  <!-- Always visible on every screen. Disabled (greyed) when browser has no SpeechSynthesis. -->
  <button
    type="button"
    :disabled="!speakerSupported"
    :aria-label="!speakerSupported ? 'Text-to-speech not available' : speaking ? 'Stop reading' : 'Read aloud'"
    :aria-pressed="speaking"
    :title="!speakerSupported
      ? 'Text-to-speech is not supported in this browser'
      : speaking && paused
        ? 'Paused — click to stop'
        : speaking
          ? 'Reading aloud — click to stop'
          : 'Click to read current content aloud'"
    class="fixed bottom-24 right-6 z-[370] flex items-center gap-1.5 px-3 py-2
           rounded-full shadow-lg text-sm font-medium select-none
           transition-colors duration-150
           focus:outline-none focus:ring-2 focus:ring-offset-2"
    :class="!speakerSupported
      ? 'bg-white text-gray-300 border border-gray-100 cursor-not-allowed'
      : speaking
        ? 'bg-emerald-500 text-white focus:ring-emerald-400 animate-pulse'
        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 focus:ring-emerald-400'"
    @click="handleClick"
  >
    <span aria-hidden="true">{{ speaking ? '⏹' : '🔊' }}</span>
    {{ speaking ? 'Stop' : 'Read aloud' }}
  </button>
</template>
