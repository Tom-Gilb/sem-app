<script setup lang="ts">
// ThinkingIndicator.vue — global async-work feedback bar
// Spec: F.GlobalThinkingIndicator
//
// A fixed top bar that appears whenever useLoadingState.isLoading is true.
// Communicates "the software is working on something" — not a generic spinner.
// Uses a travelling pulse animation that suggests active computation.

import { useLoadingState } from '../composables/useLoadingState'

const { isLoading, loadingMessage } = useLoadingState()
</script>

<template>
  <!-- role="status" + aria-live="polite" ensures screen readers announce changes -->
  <!-- pointer-events: none prevents the bar from blocking taps below it -->
  <div
    role="status"
    aria-live="polite"
    :aria-label="isLoading ? loadingMessage : undefined"
    class="thinking-indicator"
    :class="{ 'thinking-indicator--visible': isLoading }"
  >
    <!-- Animated pulse bar — three dots with staggered fade to suggest computation -->
    <div class="thinking-indicator__inner" aria-hidden="true">
      <span class="thinking-indicator__dot" />
      <span class="thinking-indicator__dot thinking-indicator__dot--2" />
      <span class="thinking-indicator__dot thinking-indicator__dot--3" />
    </div>
    <!-- Screen-reader text — updates via aria-live when message changes -->
    <span class="sr-only">{{ isLoading ? loadingMessage : '' }}</span>
  </div>
</template>

<style scoped>
/* Fixed top bar — never obscures content; z-index above nav but below modals */
.thinking-indicator {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 9000;
  height: 3px;
  pointer-events: none;        /* never blocks taps / clicks */
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s ease;
  background: transparent;
  overflow: visible;
}

.thinking-indicator--visible {
  opacity: 1;
}

/* Gradient progress bar — the core visual signal */
.thinking-indicator::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  right: 0;
  height: 3px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    #6366f1 30%,
    #818cf8 50%,
    #6366f1 70%,
    transparent 100%
  );
  animation: thinking-sweep 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  border-radius: 0 2px 2px 0;
}

/* Floating label below the bar — "thinking…" text with pulsing dots */
.thinking-indicator__inner {
  position: absolute;
  top: 8px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 3px;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid #e0e7ff;
  border-radius: 100px;
  padding: 4px 10px;
  box-shadow: 0 1px 6px rgba(99, 102, 241, 0.15);
}

/* Each dot in the "..." sequence */
.thinking-indicator__dot {
  display: inline-block;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background-color: #6366f1;
  animation: thinking-dot 1.4s ease-in-out infinite;
}

.thinking-indicator__dot--2 {
  animation-delay: 0.2s;
}

.thinking-indicator__dot--3 {
  animation-delay: 0.4s;
}

/* Travelling sweep for the top bar */
@keyframes thinking-sweep {
  0%   { transform: translateX(0); }
  100% { transform: translateX(200%); }
}

/* Staggered pulse for each dot */
@keyframes thinking-dot {
  0%, 80%, 100% {
    transform: scale(0.7);
    opacity: 0.4;
  }
  40% {
    transform: scale(1.15);
    opacity: 1;
  }
}

/* Screen-reader only utility */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Mobile: 375 px viewport — top bar stays 3 px, floating label stays right-anchored */
@media (max-width: 480px) {
  .thinking-indicator__inner {
    right: 8px;
    padding: 3px 8px;
  }

  .thinking-indicator__dot {
    width: 4px;
    height: 4px;
  }
}
</style>
