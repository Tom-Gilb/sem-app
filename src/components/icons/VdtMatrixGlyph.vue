<!--
  VdtMatrixGlyph.vue — Analyze category icon (Tom Gilb 2026-06-17 verbatim
  "Analyze: a miniature VDT ?" — Value Decision Table / Impact Estimation
  Table).

  Mini matrix: rows = Solutions, columns = Values; cells coloured by
  impact polarity (positive=emerald, negative=rose, neutral=slate).
  This IS what the Analyze tools display — VDT/IET scoring grids, PHI
  dashboards, Standards Auditor pass/fail.  Mini-render of the canonical
  display per "Tool Icon = Miniature of Its Display" SUPREME rule.

  Composes with DD-014 Thumbnail Reality + Agents Are Tools v157.
-->
<script setup lang="ts">
withDefaults(defineProps<{
  size?: 'compact' | 'standard' | 'large'
}>(), { size: 'standard' })
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    :width="size === 'large' ? 32 : size === 'compact' ? 16 : 24"
    :height="size === 'large' ? 32 : size === 'compact' ? 16 : 24"
    fill="none"
    role="img"
    aria-label="Analyze — mini Value Decision Table"
  >
    <!-- Outer table frame -->
    <rect x="2" y="2" width="20" height="20" rx="1.5" fill="#0f172a" stroke="#94a3b8" stroke-width="0.5"/>

    <!-- Header row (column = Values) -->
    <rect x="2" y="2" width="20" height="5" fill="#334155"/>
    <line x1="9" y1="2" x2="9" y2="22" stroke="#94a3b8" stroke-width="0.3"/>
    <line x1="14.5" y1="2" x2="14.5" y2="22" stroke="#94a3b8" stroke-width="0.3"/>
    <line x1="2" y1="7" x2="22" y2="7" stroke="#94a3b8" stroke-width="0.3"/>

    <!-- Row labels (rows = Solutions) -->
    <line x1="2" y1="12" x2="22" y2="12" stroke="#94a3b8" stroke-width="0.3"/>
    <line x1="2" y1="17" x2="22" y2="17" stroke="#94a3b8" stroke-width="0.3"/>

    <!-- Cells: a 3×3 grid below the header with impact-colored dots -->
    <!-- Row 1 -->
    <circle cx="5.5"  cy="9.5"  r="1.4" fill="#22c55e"/>
    <circle cx="11.7" cy="9.5"  r="1.4" fill="#22c55e"/>
    <circle cx="18.2" cy="9.5"  r="1.4" fill="#94a3b8"/>
    <!-- Row 2 -->
    <circle cx="5.5"  cy="14.5" r="1.4" fill="#94a3b8"/>
    <circle cx="11.7" cy="14.5" r="1.4" fill="#22c55e"/>
    <circle cx="18.2" cy="14.5" r="1.4" fill="#f87171"/>
    <!-- Row 3 -->
    <circle cx="5.5"  cy="19.5" r="1.4" fill="#22c55e"/>
    <circle cx="11.7" cy="19.5" r="1.4" fill="#f87171"/>
    <circle cx="18.2" cy="19.5" r="1.4" fill="#22c55e"/>

    <!-- Column header tiny squares as Value indicators -->
    <rect x="4" y="3.8" width="3" height="1.6" rx="0.4" fill="#a78bfa"/>
    <rect x="10.2" y="3.8" width="3" height="1.6" rx="0.4" fill="#a78bfa"/>
    <rect x="16.7" y="3.8" width="3" height="1.6" rx="0.4" fill="#a78bfa"/>
  </svg>
</template>
