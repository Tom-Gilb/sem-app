<!-- UNIT_TYPE=Widget -->
<!--
/**
 * Renders a radar/spider chart for a single Evo step's risk profile.
 *
 * Four risk axes: Complexity, Dependencies, Resource, Uncertainty.
 * Mini mode (size=36, expanded=false): compact SVG for embedding in step cards.
 * Expanded mode (size=180, expanded=true): full labels, rings, score values,
 *   and an enter animation from centre to final polygon positions.
 *
 * Spec: Feature #27 — Evo Step Risk Radar
 */
-->
<script setup lang="ts">
// UNIT_TYPE=Widget
import { computed } from 'vue'

// ── Props ─────────────────────────────────────────────────────────────────────

const props = withDefaults(
  defineProps<{
    /** Risk axis scores, each 0.0–1.0 */
    scores: {
      complexity: number
      dependencies: number
      resource: number
      uncertainty: number
    }
    /** Diameter in px of the SVG element (default 36 = mini) */
    size?: number
    /** When true, renders labels, rings, and enter animation */
    expanded?: boolean
  }>(),
  {
    size: 36,
    expanded: false,
  },
)

// ── Constants ─────────────────────────────────────────────────────────────────

const AXES = ['complexity', 'dependencies', 'resource', 'uncertainty'] as const
type AxisKey = (typeof AXES)[number]

const AXIS_LABELS: Record<AxisKey, string> = {
  complexity: 'Complexity',
  dependencies: 'Dependencies',
  resource: 'Resource',
  uncertainty: 'Uncertainty',
}

/**
 * Angles for the four axes (degrees, measured clockwise from top).
 * 0° = top, 90° = right, 180° = bottom, 270° = left.
 */
const AXIS_ANGLES_DEG: Record<AxisKey, number> = {
  complexity: 0,
  dependencies: 90,
  resource: 180,
  uncertainty: 270,
}

// ── Computed layout values ────────────────────────────────────────────────────

const centre = computed(() => props.size / 2)
const outerRadius = computed(() => (props.size === 36 ? 15 : 75))
const viewBox = computed(() => `0 0 ${props.size} ${props.size}`)

/** Convert polar coords (angle in degrees from top, clockwise) → {x, y} */
function polarToXY(cx: number, cy: number, r: number, angleDeg: number): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  }
}

/** Compute SVG polygon points string from the four risk scores */
const polygonPoints = computed((): string => {
  const cx = centre.value
  const cy = centre.value
  const r = outerRadius.value
  return AXES.map((axis) => {
    const score = Math.min(1, Math.max(0, props.scores[axis]))
    const pt = polarToXY(cx, cy, score * r, AXIS_ANGLES_DEG[axis])
    return `${pt.x},${pt.y}`
  }).join(' ')
})

/** Background ring radii for expanded mode (25%, 50%, 75%) */
const expandedRings = computed(() => {
  if (!props.expanded) return []
  const r = outerRadius.value
  return [0.25, 0.5, 0.75].map((frac) => r * frac)
})

/** Background ring radius for mini mode (50%) — single dashed ring */
const miniRingRadius = computed(() => outerRadius.value * 0.5)

/** Axis tip positions for labels (expanded only) */
const axisTips = computed(() => {
  const cx = centre.value
  const cy = centre.value
  const r = outerRadius.value
  return AXES.map((axis) => ({
    axis,
    label: AXIS_LABELS[axis],
    ...polarToXY(cx, cy, r + (props.expanded ? 10 : 0), AXIS_ANGLES_DEG[axis]),
  }))
})

/** Score label positions — at the polygon point on each axis */
const scoreLabelPositions = computed(() => {
  const cx = centre.value
  const cy = centre.value
  const r = outerRadius.value
  return AXES.map((axis) => {
    const score = Math.min(1, Math.max(0, props.scores[axis]))
    const pt = polarToXY(cx, cy, score * r, AXIS_ANGLES_DEG[axis])
    return {
      axis,
      x: pt.x,
      y: pt.y,
      label: `${Math.round(score * 100)}%`,
    }
  })
})
</script>

<template>
  <svg
    :viewBox="viewBox"
    :width="size"
    :height="size"
    aria-hidden="true"
    focusable="false"
    overflow="visible"
  >
    <!-- ── Background rings ─────────────────────────────────────────────────── -->

    <!-- Mini: single dashed ring at 50% -->
    <circle
      v-if="!expanded"
      :cx="centre"
      :cy="centre"
      :r="miniRingRadius"
      fill="none"
      stroke="#e5e7eb"
      stroke-width="0.75"
      stroke-dasharray="2,2"
    />

    <!-- Expanded: rings at 25%, 50%, 75% -->
    <circle
      v-for="(ringR, ri) in expandedRings"
      :key="`ring-${ri}`"
      :cx="centre"
      :cy="centre"
      :r="ringR"
      fill="none"
      stroke="#e5e7eb"
      stroke-width="0.75"
      stroke-dasharray="3,3"
    />

    <!-- ── Axis lines (expanded only) ──────────────────────────────────────── -->
    <line
      v-if="expanded"
      v-for="tip in axisTips"
      :key="`axis-${tip.axis}`"
      :x1="centre"
      :y1="centre"
      :x2="polarToXY(centre, centre, outerRadius, AXIS_ANGLES_DEG[tip.axis as AxisKey]).x"
      :y2="polarToXY(centre, centre, outerRadius, AXIS_ANGLES_DEG[tip.axis as AxisKey]).y"
      stroke="#e5e7eb"
      stroke-width="0.75"
    />

    <!-- ── Risk polygon ─────────────────────────────────────────────────────── -->
    <polygon
      :points="polygonPoints"
      fill="rgba(239, 68, 68, 0.25)"
      stroke="#ef4444"
      :stroke-width="expanded ? 1.5 : 1"
      :class="expanded ? 'risk-polygon-animated' : ''"
    />

    <!-- ── Axis labels (expanded only) ─────────────────────────────────────── -->
    <text
      v-if="expanded"
      v-for="tip in axisTips"
      :key="`label-${tip.axis}`"
      :x="tip.x"
      :y="tip.y"
      font-size="9"
      fill="#6b7280"
      text-anchor="middle"
      dominant-baseline="middle"
    >{{ tip.label }}</text>

    <!-- ── Score labels on each axis vertex (expanded only) ────────────────── -->
    <text
      v-if="expanded"
      v-for="sl in scoreLabelPositions"
      :key="`score-${sl.axis}`"
      :x="sl.x"
      :y="sl.y - 5"
      font-size="8"
      fill="#ef4444"
      text-anchor="middle"
      dominant-baseline="auto"
    >{{ sl.label }}</text>
  </svg>
</template>

<style scoped>
@keyframes radarIn {
  from {
    /* Collapse polygon to centre by scaling to 0 from the centre */
    transform-origin: v-bind('`${centre}px ${centre}px`');
    transform: scale(0);
    opacity: 0;
  }
  to {
    transform-origin: v-bind('`${centre}px ${centre}px`');
    transform: scale(1);
    opacity: 1;
  }
}

.risk-polygon-animated {
  animation: radarIn 500ms ease forwards;
}
</style>
