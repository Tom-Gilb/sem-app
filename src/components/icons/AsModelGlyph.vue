<!--
  AsModelGlyph.vue — the SEM App's "As Model" glyph: `[~*]`.

  Tom Gilb, 2026-06-04 — approved Color Keyed Icon for the Model mode marker.
  Semantic: "a vessel containing an approximate / draft / hypothetical spec
  entry."

  Three elements:
    [ ]  — spec vessel (same brackets as every Color Keyed Icon)
    ~    — universal "approximately / draft / not-yet-committed" mark
    *    — canonical Planguage entry placeholder

  Distinguishes Model from:
    - Plan        [*+*+*]   container of MULTIPLE committed entries
    - Contract    (TBD)     authoritative agreement
    - MeetingMin  (TBD)     recorded conversation snapshot

  Model is the "what if" mode — entries are tentative, exploratory, used to
  test ideas before committing them to a Plan or freezing them into a
  Contract.  The tilde encodes that uncertainty without needing the word
  "draft" or "model".

  No collision with PlannerGlyph `[?]→[*]` — Planner is the ACT of converting
  questions into spec (transformation); Model `[~*]` is a STATE of a draft
  entry (steady state).

  Drawn-≈-Keyed (DD-016): shape matches keyed `[~*]` element-by-element.
  International-Icons (DD-015): no Latin letter abbreviations; tilde is
  universal typographic symbol.
  Colour palette: brackets slate-600 · tilde slate-500 (transformation/
  qualifier) · asterisk violet-600 (Value, primary content).
-->
<script setup lang="ts">
// UNIT_TYPE=Widget
withDefaults(defineProps<{
  size?: 'compact' | 'standard' | 'large'
  ariaLabel?: string
}>(), {
  size: 'standard',
  ariaLabel: 'As Model — draft / hypothetical spec entry',
})
</script>

<template>
  <!-- ── Large: 60×32, stroke 2.8 ───────────────────────────────────────── -->
  <svg
    v-if="size === 'large'"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 60 32" width="60" height="32" fill="none"
    stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"
    role="img" :aria-label="ariaLabel"
  >
    <!-- [ -->
    <polyline points="10,2 3,2 3,30 10,30" stroke="#475569" />
    <!-- ~ tilde — two opposite arcs forming a sine wave; the "approximately" mark. -->
    <path d="M 14 17 Q 17 12 20 17 Q 23 22 26 17" stroke="#64748b" fill="none" />
    <!-- * asterisk (Value content) -->
    <line x1="36" y1="8" x2="36" y2="24" stroke="#7c3aed" />
    <line x1="29.34" y1="20" x2="42.66" y2="12" stroke="#7c3aed" />
    <line x1="29.34" y1="12" x2="42.66" y2="20" stroke="#7c3aed" />
    <!-- ] -->
    <polyline points="49,2 56,2 56,30 49,30" stroke="#475569" />
  </svg>

  <!-- ── Standard: 44×24, stroke 2.2 ────────────────────────────────────── -->
  <svg
    v-else-if="size === 'standard'"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 44 24" width="44" height="24" fill="none"
    stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"
    role="img" :aria-label="ariaLabel"
  >
    <polyline points="7,1 2,1 2,23 7,23" stroke="#475569" />
    <path d="M 10 13 Q 12.5 9 15 13 Q 17.5 17 20 13" stroke="#64748b" fill="none" />
    <line x1="27" y1="5" x2="27" y2="19" stroke="#7c3aed" />
    <line x1="20.94" y1="15.5" x2="33.06" y2="8.5" stroke="#7c3aed" />
    <line x1="20.94" y1="8.5" x2="33.06" y2="15.5" stroke="#7c3aed" />
    <polyline points="37,1 42,1 42,23 37,23" stroke="#475569" />
  </svg>

  <!-- ── Compact: 36×20, stroke 1.8 ─────────────────────────────────────── -->
  <svg
    v-else
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 36 20" width="36" height="20" fill="none"
    stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
    role="img" :aria-label="ariaLabel"
  >
    <polyline points="6,1 2,1 2,19 6,19" stroke="#475569" />
    <path d="M 8 11 Q 10 7.5 12 11 Q 14 14.5 16 11" stroke="#64748b" fill="none" />
    <line x1="22" y1="4" x2="22" y2="16" stroke="#7c3aed" />
    <line x1="16.94" y1="13" x2="27.06" y2="7" stroke="#7c3aed" />
    <line x1="16.94" y1="7" x2="27.06" y2="13" stroke="#7c3aed" />
    <polyline points="30,1 34,1 34,19 30,19" stroke="#475569" />
  </svg>
</template>
