<!--
  ModelThumbsStackGlyph.vue — Templates tool icon (Tom Gilb 2026-06-17
  verbatim "design model thumbs glyph (I love them, so do others who see
  them)").

  A stack of 3 model-thumb cards, slightly fan-offset to suggest a library /
  collection.  Each card carries:
   - a coloured header band (a different canonical Planguage entry-type
     colour per card — violet = Value-focused model, orange = Solution-
     focused, blue = Resource/Plan model)
   - 3 tiny content rows representing spec entries inside
   - a tiny coloured dot in the title bar suggesting the entry-type that
     dominates

  Per Tool Icon = Miniature of Its Display SUPREME — this IS exactly what
  the ModelLibraryPanel shows: a tiled grid of model thumbs.  Mini-render
  the canonical form.

  DD-015 compliant: no English letters anywhere in the SVG.
  DD-016 compliant: canonical Planguage type colours (violet Value /
  orange Solution / blue Resource) carry the semantic meaning.
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
    aria-label="Templates — stack of model thumbs"
  >
    <!-- Back card (tilted slightly left, blue-Resource family) -->
    <g transform="rotate(-7 7 14)">
      <rect x="2" y="5"  width="14" height="17" rx="1.5" fill="#fff" stroke="#1e3a8a" stroke-width="0.8" filter="drop-shadow(0 1px 1px rgba(0,0,0,0.2))"/>
      <!-- Header band -->
      <rect x="2" y="5" width="14" height="3.2" fill="#3b82f6"/>
      <circle cx="4" cy="6.6" r="0.7" fill="#fff"/>
      <!-- Content rows -->
      <rect x="3.5" y="10"  width="11" height="0.9" rx="0.4" fill="#cbd5e1"/>
      <rect x="3.5" y="12"  width="9"  height="0.9" rx="0.4" fill="#cbd5e1"/>
      <rect x="3.5" y="14"  width="10" height="0.9" rx="0.4" fill="#cbd5e1"/>
      <rect x="3.5" y="16"  width="7"  height="0.9" rx="0.4" fill="#cbd5e1"/>
      <rect x="3.5" y="18"  width="9"  height="0.9" rx="0.4" fill="#cbd5e1"/>
    </g>

    <!-- Middle card (slightly right of back, orange-Solution family) -->
    <g transform="rotate(0 14 13)">
      <rect x="7" y="3.5" width="14" height="17" rx="1.5" fill="#fff" stroke="#9a3412" stroke-width="0.8" filter="drop-shadow(0 1px 1px rgba(0,0,0,0.2))"/>
      <!-- Header band -->
      <rect x="7" y="3.5" width="14" height="3.2" fill="#fb923c"/>
      <circle cx="9" cy="5.1" r="0.7" fill="#fff"/>
      <!-- Content rows -->
      <rect x="8.5" y="8.5" width="11" height="0.9" rx="0.4" fill="#cbd5e1"/>
      <rect x="8.5" y="10.5" width="9"  height="0.9" rx="0.4" fill="#cbd5e1"/>
      <rect x="8.5" y="12.5" width="11" height="0.9" rx="0.4" fill="#cbd5e1"/>
      <rect x="8.5" y="14.5" width="8"  height="0.9" rx="0.4" fill="#cbd5e1"/>
      <rect x="8.5" y="16.5" width="10" height="0.9" rx="0.4" fill="#cbd5e1"/>
    </g>

    <!-- Front card (tilted right, violet-Value family — the dominant) -->
    <g transform="rotate(8 21 14)">
      <rect x="12" y="2"  width="14" height="17" rx="1.5" fill="#fff" stroke="#5b21b6" stroke-width="0.8" filter="drop-shadow(0 2px 2px rgba(0,0,0,0.3))"/>
      <!-- Header band -->
      <rect x="12" y="2" width="14" height="3.2" fill="#a78bfa"/>
      <circle cx="14" cy="3.6" r="0.7" fill="#fff"/>
      <!-- Content rows -->
      <rect x="13.5" y="7"  width="11" height="0.9" rx="0.4" fill="#cbd5e1"/>
      <rect x="13.5" y="9"  width="10" height="0.9" rx="0.4" fill="#cbd5e1"/>
      <rect x="13.5" y="11" width="11" height="0.9" rx="0.4" fill="#cbd5e1"/>
      <rect x="13.5" y="13" width="7"  height="0.9" rx="0.4" fill="#cbd5e1"/>
      <rect x="13.5" y="15" width="10" height="0.9" rx="0.4" fill="#cbd5e1"/>
    </g>
  </svg>
</template>
