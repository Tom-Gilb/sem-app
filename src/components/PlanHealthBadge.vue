<!-- UNIT_TYPE=Widget -->
<!-- PlanHealthBadge.vue — Feature #202: large coloured Plan Health Index circle.
     Lives on the Plan ID Bar. Click to open the Plan Health panel.

     Color band:
       index < 0    → red       (catastrophe / heading toward it)
       0 .. 25      → orange    (very poor)
       25 .. 50     → amber     (poor)
       50 .. 75     → lime      (acceptable)
       75 .. 100    → emerald   (good → perfect)

     Animation:
       index < threshold → vibrate (custom keyframes; falls back to pulse)
-->
<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  index: number          // -100 .. +100
  threshold?: number     // default 50
  /** size in px (default 56) */
  size?: number
  /** Tooltip override */
  title?: string
  /** When true, show a small red notification dot at the top-right of the badge.
   *  Set by App.vue when there are pending Plan Health notifications (e.g. a
   *  significant drop after Replan) — gives the Plan Owner an at-a-glance cue. */
  hasAlert?: boolean
  /** Count of pending alerts. Drives the tooltip wording; the dot itself
   *  always shows "!" (a universal alert glyph) so users never have to wonder
   *  what a bare digit means. Tom 2026-05-12: "The meaning of the pulsating
   *  '1' on the plan quality % is not clear". */
  alertCount?: number
  /** Short descriptive label appended to the badge's title / aria-label when
   *  `hasAlert` is true. Should read like a complete instruction, e.g.
   *  "1 Plan Health alert pending — click to review". Surfacing this is the
   *  primary fix for the "what does the 1 mean?" confusion. */
  alertHint?: string
}>(), {
  threshold: 50,
  size: 56,
  hasAlert: false,
  alertCount: 0,
  alertHint: '',
})

const emit = defineEmits<{ click: [] }>()

const bandColor = computed(() => {
  const i = props.index
  if (i < 0)    return { ring: 'ring-red-500',     fill: 'bg-red-500/95',     text: 'text-white',       glow: 'shadow-red-500/60'     }
  if (i < 25)   return { ring: 'ring-orange-500',  fill: 'bg-orange-500/95',  text: 'text-white',       glow: 'shadow-orange-500/60'  }
  if (i < 50)   return { ring: 'ring-amber-500',   fill: 'bg-amber-400/95',   text: 'text-amber-900',   glow: 'shadow-amber-500/60'   }
  if (i < 75)   return { ring: 'ring-lime-500',    fill: 'bg-lime-400/95',    text: 'text-lime-900',    glow: 'shadow-lime-500/60'    }
  return              { ring: 'ring-emerald-500', fill: 'bg-emerald-500/95', text: 'text-white',       glow: 'shadow-emerald-500/60' }
})

const shouldVibrate = computed(() => props.index < props.threshold)
const displayValue = computed(() => `${props.index >= 0 ? '+' : ''}${props.index}%`)

const dim = computed(() => `${props.size}px`)
const fontSize = computed(() => `${Math.round(props.size * 0.27)}px`)

/** Composite tooltip — Plan Health + optional alert hint. The alert hint
 *  is what makes the pulsating "!" dot self-explanatory: hovering reveals
 *  "1 Plan Health alert pending — click to review" so the user knows
 *  exactly what the attention signal means. */
const composedTitle = computed<string>(() => {
  const base = props.title ?? `Plan Health: ${displayValue.value} — click for details`
  if (props.hasAlert && props.alertHint) return `${base} · ${props.alertHint}`
  return base
})
const composedAria = computed<string>(() => {
  const threshTag = shouldVibrate.value ? ' (below threshold)' : ''
  const alertTag  = props.hasAlert
    ? ` — ${props.alertHint || `${props.alertCount} alert${props.alertCount === 1 ? '' : 's'} pending`}`
    : ''
  return `Plan Health Index ${displayValue.value}${threshTag}${alertTag}`
})
</script>

<template>
  <button
    type="button"
    class="relative shrink-0 rounded-full ring-2 ring-offset-2 ring-offset-indigo-700 shadow-lg
           transition-transform duration-150 hover:scale-110 focus:outline-none focus:scale-110
           flex items-center justify-center font-bold leading-none select-none"
    :class="[bandColor.ring, bandColor.fill, bandColor.text, bandColor.glow,
             shouldVibrate ? 'phi-vibrate' : '']"
    :style="{ width: dim, height: dim, fontSize: fontSize }"
    :aria-label="composedAria"
    :title="composedTitle"
    @click="emit('click')"
  >
    <span>{{ displayValue }}</span>
    <!-- Inner heartbeat ring shown only when vibrating, gives a second visual cue -->
    <span
      v-if="shouldVibrate"
      aria-hidden="true"
      class="absolute inset-0 rounded-full ring-2 ring-white/40 phi-pulse-ring pointer-events-none"
    ></span>
    <!-- Alert dot — top-right, separate concern from band colour. The dot
         keeps its own pulse so it's visible even in the emerald band. Tom
         2026-05-12: "The meaning of the pulsating '1' on the plan quality
         % is not clear" — the dot now shows the universal "!" alert glyph
         (instead of a bare count digit) so the attention signal is
         self-explanatory. Count is surfaced via tooltip + aria-label
         instead. When count > 1, the badge below the dot shows e.g. "!3"
         so multi-alert state is still visible. -->
    <span
      v-if="hasAlert"
      :aria-hidden="true"
      class="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full
             bg-rose-600 text-white text-[11px] font-extrabold leading-none
             flex items-center justify-center shadow ring-2 ring-white phi-dot-pulse"
    >{{ alertCount > 1 ? `!${alertCount}` : '!' }}</span>
  </button>
</template>

<style scoped>
/* Vibrate = small fast jitter — strong attention without being epileptic.
   Reduced-motion users see only the secondary pulse ring. */
@keyframes phi-vibrate {
  0%, 100% { transform: translate(0, 0); }
  20%      { transform: translate(-1px, 1px); }
  40%      { transform: translate(1px, -1px); }
  60%      { transform: translate(-1px, -1px); }
  80%      { transform: translate(1px, 1px); }
}
.phi-vibrate {
  animation: phi-vibrate 0.45s ease-in-out infinite;
}
@keyframes phi-pulse-ring {
  0%   { opacity: 0.7; transform: scale(1); }
  100% { opacity: 0;   transform: scale(1.35); }
}
.phi-pulse-ring {
  animation: phi-pulse-ring 1.2s ease-out infinite;
}
@keyframes phi-dot-pulse {
  0%, 100% { transform: scale(1);    opacity: 1;   }
  50%      { transform: scale(1.25); opacity: 0.7; }
}
.phi-dot-pulse {
  animation: phi-dot-pulse 1.4s ease-in-out infinite;
  transform-origin: center;
}
@media (prefers-reduced-motion: reduce) {
  .phi-vibrate, .phi-dot-pulse { animation: none; }
}
</style>
