<!--
  SwissArmyKnifeGlyph.vue — Swiss Army category icon (Tom Gilb 2026-06-17
  verbatim "Swiss Army: a real picture or drawing, with open some tools").

  Drawn Swiss Army knife with red plastic body + several tools open:
   - large blade (knife)
   - small blade (knife)
   - corkscrew (spiral)
   - bottle opener
  The "multi-purpose" nature is the message: ONE handle, MANY tools.
  This is the Penta/MultiVision/IET/OPTIMA category — multi-tool.

  No personification (Agents Are Tools v157 — tools are abstract instruments).
  No English letters (DD-015).
-->
<script setup lang="ts">
withDefaults(defineProps<{
  size?: 'compact' | 'standard' | 'large'
}>(), { size: 'standard' })
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 28 24"
    :width="size === 'large' ? 36 : size === 'compact' ? 18 : 28"
    :height="size === 'large' ? 32 : size === 'compact' ? 16 : 24"
    fill="none"
    role="img"
    aria-label="Swiss Army — multi-tool"
  >
    <!-- Body (red plastic handle) -->
    <rect x="6" y="9" width="16" height="6" rx="1" fill="#dc2626" stroke="#7f1d1d" stroke-width="0.8"/>
    <!-- Body highlight -->
    <rect x="7" y="9.6" width="14" height="0.8" rx="0.4" fill="#fca5a5" opacity="0.7"/>
    <!-- Pivot rivet at left -->
    <circle cx="7.5" cy="12" r="0.7" fill="#fbbf24" stroke="#92400e" stroke-width="0.3"/>
    <!-- Pivot rivet at right -->
    <circle cx="20.5" cy="12" r="0.7" fill="#fbbf24" stroke="#92400e" stroke-width="0.3"/>

    <!-- Large blade (opens up-left) -->
    <polygon points="6,9 6,2 12,8 12,9" fill="#e5e7eb" stroke="#64748b" stroke-width="0.6" stroke-linejoin="round"/>
    <!-- Blade edge highlight -->
    <line x1="6" y1="2" x2="12" y2="8" stroke="#fff" stroke-width="0.4"/>

    <!-- Small blade (opens up-right) -->
    <polygon points="16,9 16,4 21,9 21,9" fill="#e5e7eb" stroke="#64748b" stroke-width="0.5" stroke-linejoin="round"/>
    <line x1="16" y1="4" x2="21" y2="9" stroke="#fff" stroke-width="0.3"/>

    <!-- Corkscrew (opens down-left) — spiral -->
    <g stroke="#64748b" stroke-width="0.8" fill="none" stroke-linecap="round">
      <path d="M 8 15 Q 7.2 17 8 18.5 Q 8.8 20 8 21.5 Q 7.2 23 8 23.5"/>
    </g>

    <!-- Bottle opener (opens down-right) — curved hook -->
    <g stroke="#64748b" stroke-width="0.9" fill="none" stroke-linejoin="round">
      <path d="M 19 15 L 19 19 Q 19 21 21 21 Q 23 21 23 19" />
      <circle cx="20" cy="18" r="0.6" fill="#fff" stroke-width="0.6"/>
    </g>
  </svg>
</template>
