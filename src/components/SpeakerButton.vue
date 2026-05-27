<!-- SpeakerButton.vue — text-to-speech toggle.
     2026-05-13: removed self-positioning (`fixed bottom-2 left-6 z-[370]`).
     Positioning is now owned by the parent (the persistent right-side FAB
     cluster in App.vue, stacked above ⚡ Actions). Tom: "the mic and speaker
     need to be on the surface at all times right side above actions and not
     colliding with it". -->

<script setup lang="ts">
import { speakerSupported, speaking, paused, stopSpeaking } from '../composables/useSpeaker'

const props = defineProps<{
  /** Text to speak when the button is pressed (caller passes stage-appropriate content) */
  text: string
  /** compact=true → icon-only pill (no label). Use inside tight bars. */
  compact?: boolean
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
  <!-- Disabled (greyed) when browser has no SpeechSynthesis. -->
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
    :class="[
      props.compact
        ? 'w-9 h-9 justify-center rounded-lg shadow-none border-0 text-xl px-0 py-0'
        : 'flex items-center gap-1.5 px-3 py-2 rounded-full shadow-lg text-sm font-medium',
      !speakerSupported
        ? 'bg-white/10 text-white/30 cursor-not-allowed'
        : speaking
          ? (props.compact ? 'bg-emerald-500/80 text-white animate-pulse focus:ring-emerald-400' : 'bg-emerald-500 text-white focus:ring-emerald-400 animate-pulse')
          : (props.compact
              ? 'bg-amber-400/80 text-amber-900 hover:bg-amber-400 focus:ring-amber-300'
              : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 focus:ring-emerald-400'),
      'flex items-center select-none transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2',
    ]"
    @click="handleClick"
  >
    <span aria-hidden="true">{{ speaking ? '⏹' : '🔊' }}</span>
    <span v-if="!props.compact">{{ speaking ? 'Stop' : 'Read aloud' }}</span>
  </button>
</template>
