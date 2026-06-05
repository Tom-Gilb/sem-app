<!--
  OwnerArtsyGlyph.vue — Color Artsy Icon synonym for OwnerGlyph (`[*]!`).
  5-pointed violet star inside a slate scroll-shield + red authority
  banner with `!` mark rising.  "Spec held under owner's banner."
  Ships alongside the Color Keyed Icon (OwnerGlyph) — Tom 2026-06-04:
  *"no harm in having both color keyed icons, and Color Artsy Icons"*.
-->
<script setup lang="ts">
withDefaults(defineProps<{
  size?: 'compact' | 'standard' | 'large'
  ariaLabel?: string
}>(), { size: 'standard', ariaLabel: 'Owner — authoritative spec (artsy synonym)' })
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :viewBox="size === 'large' ? '0 0 96 42' : size === 'standard' ? '0 0 72 32' : '0 0 56 24'"
    :width="size === 'large' ? 96 : size === 'standard' ? 72 : 56"
    :height="size === 'large' ? 42 : size === 'standard' ? 32 : 24"
    fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
    role="img" :aria-label="ariaLabel"
  >
    <!-- Stylised shield/scroll outline (the spec container) -->
    <path d="M 6 6 Q 18 2 30 6 L 30 22 Q 18 26 6 22 Z" stroke="#475569" fill="#f8fafc"
          :transform="size === 'large' ? 'scale(1.4) translate(0 1)' : size === 'compact' ? 'scale(0.85)' : ''" />
    <!-- 5-pointed violet star (Value content) -->
    <polygon points="18,7 20.4,13.5 27.2,13.5 21.7,17.5 23.8,24 18,20 12.2,24 14.3,17.5 8.8,13.5 15.6,13.5"
             fill="#7c3aed" stroke="#5b21b6"
             :transform="size === 'large' ? 'scale(1.4) translate(0 1)' : size === 'compact' ? 'scale(0.85)' : ''" />
    <!-- Authority banner + ! mark -->
    <line x1="40" y1="22" x2="40" y2="6" stroke="#dc2626" stroke-width="2.5"
          :transform="size === 'large' ? 'translate(16 0) scale(1.2)' : size === 'compact' ? 'translate(-4 0) scale(0.85)' : ''" />
    <path d="M 40 6 L 56 8 L 52 12 L 56 16 L 40 16" stroke="#dc2626" fill="#fecaca"
          :transform="size === 'large' ? 'translate(16 0) scale(1.2)' : size === 'compact' ? 'translate(-4 0) scale(0.85)' : ''" />
    <circle cx="40" cy="24" r="2" fill="#dc2626" stroke="none"
            :transform="size === 'large' ? 'translate(16 0) scale(1.2)' : size === 'compact' ? 'translate(-4 0) scale(0.85)' : ''" />
  </svg>
</template>
