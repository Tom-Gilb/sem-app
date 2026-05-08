<script setup lang="ts">
// CelebrationEffect.vue — confetti burst overlay for CE stage 5 completion
// Spec: F.CompletionCelebration (#12)

import { watch, onUnmounted } from 'vue'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ (e: 'done'): void }>()

const COLOURS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6']
const PARTICLE_COUNT = 20

const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
  id: i,
  left: `${Math.round((i / PARTICLE_COUNT) * 100)}%`,
  colour: COLOURS[i % COLOURS.length],
  delay: `${Math.round((i / (PARTICLE_COUNT - 1)) * 1000)}ms`,
}))

let _doneTimer: ReturnType<typeof setTimeout> | null = null

watch(
  () => props.visible,
  (v) => {
    if (_doneTimer !== null) {
      clearTimeout(_doneTimer)
      _doneTimer = null
    }
    if (v) {
      _doneTimer = setTimeout(() => emit('done'), 3000)
    }
  },
  { immediate: true },
)

onUnmounted(() => {
  if (_doneTimer !== null) clearTimeout(_doneTimer)
})
</script>

<template>
  <Transition name="celebration-fade">
    <div
      v-if="visible"
      class="celebration-overlay"
      aria-hidden="true"
    >
      <div
        v-for="p in particles"
        :key="p.id"
        class="celebration-particle"
        :style="{
          left: p.left,
          backgroundColor: p.colour,
          animationDelay: p.delay,
        }"
      />
    </div>
  </Transition>
</template>

<style scoped>
.celebration-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 200;
  overflow: hidden;
}

.celebration-particle {
  position: absolute;
  top: -12px;
  width: 8px;
  height: 8px;
  border-radius: 1px;
  animation: confettiFall 2.5s ease-in forwards;
}

@keyframes confettiFall {
  0% {
    transform: translateY(0) rotate(0deg);
    opacity: 1;
  }
  80% {
    opacity: 1;
  }
  100% {
    transform: translateY(100vh) rotate(720deg);
    opacity: 0;
  }
}

.celebration-fade-enter-active,
.celebration-fade-leave-active {
  transition: opacity 0.3s ease;
}
.celebration-fade-enter-from,
.celebration-fade-leave-to {
  opacity: 0;
}
</style>
