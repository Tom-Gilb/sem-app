<!--
  ScribeArtsyGlyph.vue — Color Artsy Icon synonym for ScribeGlyph (`[ ]→[*]`).
  Blank parchment with dotted lines → quill mid-stroke (with ink drop) →
  filled page with violet asterisk + text lines.  "The scribe's act made visible."
-->
<script setup lang="ts">
withDefaults(defineProps<{
  size?: 'compact' | 'standard' | 'large'
  ariaLabel?: string
}>(), { size: 'standard', ariaLabel: 'Scribe — writes spec content (artsy synonym)' })
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 88 28"
    :width="size === 'large' ? 132 : size === 'standard' ? 88 : 66"
    :height="size === 'large' ? 42 : size === 'standard' ? 28 : 21"
    fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
    role="img" :aria-label="ariaLabel"
  >
    <!-- Blank parchment -->
    <path d="M 4 4 L 22 4 L 22 26 L 4 26 Z" stroke="#94a3b8" fill="#f8fafc" />
    <line x1="8" y1="10" x2="18" y2="10" stroke="#cbd5e1" stroke-dasharray="2 2" />
    <line x1="8" y1="15" x2="18" y2="15" stroke="#cbd5e1" stroke-dasharray="2 2" />
    <line x1="8" y1="20" x2="18" y2="20" stroke="#cbd5e1" stroke-dasharray="2 2" />
    <!-- Quill-pen mid-stroke -->
    <path d="M 30 18 Q 40 8 52 14" stroke="#64748b" stroke-width="2" />
    <polyline points="48,10 52,14 48,17" stroke="#64748b" stroke-width="2" />
    <circle cx="30" cy="18" r="1.2" fill="#1e293b" stroke="none" />
    <!-- Filled page -->
    <path d="M 60 4 L 84 4 L 84 26 L 60 26 Z" stroke="#475569" fill="#fff" />
    <line x1="72" y1="9" x2="72" y2="17" stroke="#7c3aed" stroke-width="2" />
    <line x1="68" y1="15" x2="76" y2="11" stroke="#7c3aed" stroke-width="2" />
    <line x1="68" y1="11" x2="76" y2="15" stroke="#7c3aed" stroke-width="2" />
    <line x1="64" y1="20" x2="80" y2="20" stroke="#475569" stroke-width="1.4" />
    <line x1="64" y1="23" x2="76" y2="23" stroke="#475569" stroke-width="1.4" />
  </svg>
</template>
