<!--
  PlSpecFieldIcon.vue — Planguage Spec Field Icon dispatcher (Family 4).

  Renders one of 10 small semantic icons annotating individual FIELDS within
  V. (and other) Planguage spec entries. Each icon encodes the field's
  Planguage meaning visually — not decorative, semantically precise.

  Family 4 — Spec Field Icons.  Distinct from:
    Family 1: Color Glyphs (entry TYPES)        → PlTypeIcon.vue dispatcher
    Family 2: Keyed Action Glyphs (OPERATIONS)  → SaveGlyph, EditGlyph, EmailGlyph …
    Family 3: Nav Tab Glyphs (WORKSPACES)       → App.vue tab area

  All 10 icons share a 20×20 viewBox. Three render sizes:
    xs = 14 px  (inline in tight label rows, editor inputs)
    sm = 18 px  (default — SpecOutput field headers, GlyphDataPanel glossary)
    md = 22 px  (prominent contexts — panel headings, scale bar markers)

  Colors are hardcoded per field semantic (never currentColor — each type has a
  fixed meaning that must be consistent across every surface it appears on).
  This differs from Family 2 glyphs which use currentColor so the parent controls ink.

  No DD-013 double-click wiring here: GlyphDataPanel currently handles
  PlGlyphType only. SpecFieldType → GlyphDataPanel extension is Phase 5
  wiring via the fieldIcon prop on GlossaryTerm — see design-decisions.md.

  Source:  Planguage-Icons-SEM-Selected.html (2026-06-02)
  History: SEM-Design-History.md — r06 (2026-06-02)
  Twin portability: props are type-safe union strings matching field names in
  Template_Write_Values.md; no framework assumptions in the geometry.
-->
<script setup lang="ts">
// UNIT_TYPE=Widget
import { computed } from 'vue'

/** All 10 canonical Spec Field types. Aligned with Template_Write_Values.md field names. */
export type SpecFieldType =
  | 'scale'
  | 'past'
  | 'tolerable'
  | 'goal'
  | 'wish'
  | 'stretch'
  | 'meter'
  | 'status'
  | 'tag'
  | 'ambition'

/**
 * Canonical Planguage-precise hover labels for all 10 field types.
 * Concise enough for a tooltip; precise enough to teach Planguage.
 * Aligned with Tom Gilb Competitive Engineering (2005) and 10.Standard/.
 */
const CANONICAL_LABELS: Record<SpecFieldType, string> = {
  'scale':     'Scale of Measure (-|-|-) — the axis against which all levels are defined. Every V. entry has exactly one Scale.',
  'past':      'Past (<) — the current measured level. Historical fact, not aspiration. Used in PHI scoring and Evo Learn cycle.',
  'tolerable': 'Tolerable (T:-- ) — the survival floor. Below Tolerable = unacceptable failure. The minimum the stakeholder can endure.',
  'goal':      'Goal (G:●) — the committed delivery target. PHI = 1.0 when Past ≥ Goal. The definition of value-delivered.',
  'wish':      "Wish (W:✳) — stakeholder's unconstrained aspiration. Not yet a committed Goal. Lives in the violet family (aspirational).",
  'stretch':   'Stretch (S!:↑↑) — beyond the Wish; high-ambition moonshot. Not a delivery commitment. Used in extraordinary scenarios.',
  'meter':     'Meter ({∆}) — how this value is measured. The instrument, method, or formula that returns a numeric level.',
  'status':    'Status ([●]) — lifecycle state of this entry: Draft → Proposed → Approved → Active → Met → Superseded → Retired.',
  'tag':       'Tag (#) — classification label. Used for filtering, grouping, and priority organisation across entry types.',
  'ambition':  'Ambition Level ({≡}) — a short quoted sentence describing a Value Objective (e.g. "Competitive Quality"). Ideally quoted from a responsible source (CEO, website, presentation). Seeds the Planguage spec (Scale, Wish) and provides authority for QC.',
}

const SIZE_PX: Record<'xs' | 'sm' | 'md', number> = { xs: 14, sm: 18, md: 22 }

const props = withDefaults(defineProps<{
  /** Which spec field to render an icon for. */
  field: SpecFieldType
  /**
   * Rendered pixel size. All sizes share the 20×20 viewBox;
   * only the outer dimensions change (SVG scales cleanly).
   * xs=14px · sm=18px (default) · md=22px.
   */
  size?: 'xs' | 'sm' | 'md'
  /** Override the default canonical label (aria-label + hover tooltip). */
  title?: string
}>(), {
  size: 'sm',
})

const px = computed(() => SIZE_PX[props.size])
const resolvedTitle = computed(() => props.title ?? CANONICAL_LABELS[props.field])
</script>

<template>
  <!--
    Wrapper span carries the browser-native hover tooltip via title attribute.
    SVG uses aria-label for the screen-reader accessible name (avoids duplicate
    announcement when both <title> element and aria-label are present).
    shrink-0 prevents icon compression in flex containers with long labels.
  -->
  <span :title="resolvedTitle" class="inline-flex shrink-0">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      :width="px"
      :height="px"
      fill="none"
      stroke-linecap="round"
      stroke-linejoin="round"
      role="img"
      :aria-label="resolvedTitle"
    >

      <!-- ── 1 · Scale · -|-|- · Dark Slate #1e293b ──────────────────────── -->
      <!--  Ruler: horizontal axis + directional arrowhead + 3 equidistant ticks.  -->
      <!--  The notation IS the visual — a baseline with tick marks.              -->
      <!--  Bliss-consistent: Bliss 'measurement' = ruler-style glyph with ticks. -->
      <g v-if="field === 'scale'" stroke="#1e293b" stroke-width="1.8">
        <line x1="1"  y1="12" x2="19" y2="12" />
        <polyline points="16.5,9.5 19,12 16.5,14.5" />
        <line x1="5"  y1="9.5" x2="5"  y2="14.5" />
        <line x1="10" y1="9.5" x2="10" y2="14.5" />
        <line x1="15" y1="9.5" x2="15" y2="14.5" />
      </g>

      <!-- ── 2 · Past · < · Gunmetal #374151 ─────────────────────────────── -->
      <!--  Left-pointing chevron = historical direction (delivered, measured).   -->
      <!--  Filled dot = the specific measured level on the Scale.               -->
      <g v-else-if="field === 'past'" stroke="#374151" stroke-width="1.8">
        <polyline points="12,7 6,10 12,13" />
        <circle cx="14" cy="10" r="3" fill="#374151" stroke="none" />
      </g>

      <!-- ── 3 · Tolerable · T:-- · Dark Amber #92400e ────────────────────── -->
      <!--  Dashed floor line = barely-acceptable minimum threshold.             -->
      <!--  T-bar vertical at left = the 'T' initial of Tolerable.              -->
      <!--  Amber-brown: caution, survival; not red (not yet failure).          -->
      <g v-else-if="field === 'tolerable'" stroke="#92400e" stroke-width="1.8">
        <line x1="2" y1="15" x2="19" y2="15" stroke-dasharray="3.5,2.5" stroke-linecap="butt" />
        <line x1="2" y1="11" x2="2"  y2="15" />
      </g>

      <!-- ── 4 · Goal · G:● · Deep Emerald #065f46 ───────────────────────── -->
      <!--  Crosshair (horizontal + vertical reference lines) + filled bull's-eye. -->
      <!--  Achievement green. The deep emerald distinguishes Goal from Function   -->
      <!--  green (#16a34a) and Open glyph emerald (#059669).                    -->
      <g v-else-if="field === 'goal'" stroke="#065f46" stroke-width="1.8">
        <line x1="2"  y1="11" x2="18" y2="11" />
        <line x1="11" y1="7"  x2="11" y2="15" />
        <circle cx="11" cy="11" r="3.5" fill="#065f46" stroke="none" />
      </g>

      <!-- ── 5 · Wish · W:✳ · Deep Violet #4c1d95 ───────────────────────── -->
      <!--  6-pointed asterisk (star of aspiration) + dashed connector below.    -->
      <!--  Dashed = not committed. The star floats; commitment would be solid.  -->
      <!--  Violet family: Wishes ARE values not yet committed.                  -->
      <g v-else-if="field === 'wish'" stroke="#4c1d95" stroke-width="1.8">
        <!-- Asterisk at (10, 5) r=3: vertical + two diagonals at ±60° -->
        <line x1="10"  y1="2"   x2="10"  y2="8"   />
        <line x1="7.4" y1="3.5" x2="12.6" y2="6.5" />
        <line x1="7.4" y1="6.5" x2="12.6" y2="3.5" />
        <!-- Dashed connector: aspiration descends toward commitment level -->
        <line x1="10" y1="8" x2="10" y2="15" stroke-dasharray="2.5,2" stroke-linecap="butt" />
      </g>

      <!-- ── 6 · Stretch · S!:↑↑ · Burnt Orange #c2410c ──────────────────── -->
      <!--  Two upward arrows: double ambition beyond even the Wish.            -->
      <!--  Orange = exciting-but-cautionary tension of moonshot ambition.      -->
      <g v-else-if="field === 'stretch'" stroke="#c2410c" stroke-width="1.8">
        <line     x1="7"  y1="16" x2="7"  y2="5" />
        <polyline points="4.5,8 7,5 9.5,8" />
        <line     x1="13" y1="16" x2="13" y2="5" />
        <polyline points="10.5,8 13,5 15.5,8" />
      </g>

      <!-- ── 7 · Meter · {∆} · Dark Teal #134e4a ─────────────────────────── -->
      <!--  Gauge face (outer circle) + measurement sweep arc (7→5 o'clock)     -->
      <!--  + needle pointing to 11 o'clock + pivot dot at centre.             -->
      <!--  Dark teal is distinct from all existing Family 1-3 colors.         -->
      <g v-else-if="field === 'meter'" stroke="#134e4a" stroke-width="1.8">
        <!-- Gauge face -->
        <circle cx="10" cy="10" r="8" />
        <!-- Sweep arc: 7 o'clock (7.25,14.76) → 5 o'clock (12.75,14.76) at r=5.5 -->
        <path d="M 7.25 14.76 A 5.5 5.5 0 0 1 12.75 14.76" />
        <!-- Needle to 11 o'clock (r=6 from centre) -->
        <line x1="10" y1="10" x2="7" y2="4.8" />
        <!-- Pivot dot -->
        <circle cx="10" cy="10" r="1.2" fill="#134e4a" stroke="none" />
      </g>

      <!-- ── 8 · Status · [●] · Graphite #1f2937 ──────────────────────────── -->
      <!--  Rounded-corner container (the lifecycle envelope) + filled state dot. -->
      <!--  [●] = a thing at a position within a bounded system of states.      -->
      <g v-else-if="field === 'status'" stroke="#1f2937" stroke-width="1.8">
        <rect x="2" y="5" width="16" height="10" rx="2.5" />
        <circle cx="10" cy="10" r="3" fill="#1f2937" stroke="none" />
      </g>

      <!-- ── 9 · Tag · # · Deep Indigo #312e81 ────────────────────────────── -->
      <!--  Hashtag: two vertical bars + two horizontal bars.                   -->
      <!--  Universal classification marker since IRC / Twitter / programming.  -->
      <g v-else-if="field === 'tag'" stroke="#312e81" stroke-width="1.8">
        <line x1="7"  y1="4"  x2="7"  y2="16" />
        <line x1="13" y1="4"  x2="13" y2="16" />
        <line x1="4"  y1="8"  x2="16" y2="8"  />
        <line x1="4"  y1="13" x2="16" y2="13" />
      </g>

      <!-- ── 10 · Ambition · {≡} · Fuchsia #701a75 ────────────────────────── -->
      <!--  Speech bubble: a QUOTED ASPIRATIONAL STATEMENT from a responsible   -->
      <!--  source (CEO, website, presentation). NOT a derived numeric metric.  -->
      <!--  {≡}: structured text content (≡ triple lines = text body) inside   -->
      <!--  a process container {}. Seeds Scale/Wish/Goal; used for QC/review. -->
      <!--  Tail at bottom-left (like 💬, already used in SpecOutput for this  -->
      <!--  field). Two horizontal lines = the quoted sentence content.         -->
      <g v-else-if="field === 'ambition'" stroke="#701a75" stroke-width="1.8">
        <!-- Speech bubble outline with tail pointing down-left -->
        <path d="M 3 2 Q 2 2 2 3 L 2 11 Q 2 12 3 12 L 5 12 L 4 16 L 8 12 L 17 12 Q 18 12 18 11 L 18 3 Q 18 2 17 2 Z" />
        <!-- Two text lines — the aspirational statement (first line full, second shorter) -->
        <line x1="5" y1="5.5" x2="15" y2="5.5" />
        <line x1="5" y1="9"   x2="11" y2="9" />
      </g>

    </svg>
  </span>
</template>
