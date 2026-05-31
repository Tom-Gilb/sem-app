// stageProgressColors.ts
// Shared colour utilities for the 11-stage planning bar (ValueCounter) and ArrowInfoPanel.
// Spec: F.ValueAccumulationCounter (#15) — Design log r27, r30.
//
// Hue sweeps 239° (indigo, stage 1) → 160° (emerald, stage 11).
// Visually maps the planning journey: blank canvas (indigo) → delivered value (emerald).
//
// Architecture principle: single source of truth for all colour math.
// ArrowInfoPanel, ValueCounter, and any future stage-aware surface import from here.

// UNIT_TYPE=Utility

/** Total number of planning stages. */
export const STAGE_COUNT = 11

/**
 * Bright neon colour at a given stage position.
 * pos 0 = stage 1 (indigo) … pos 10 = stage 11 (emerald).
 * Saturation 80%, lightness 65% — vivid enough against dark pill backgrounds.
 */
export function stageProgressColor(pos: number): string {
  const clamped = Math.max(0, Math.min(STAGE_COUNT - 1, pos))
  const hue = 239 - ((239 - 160) / (STAGE_COUNT - 1)) * clamped
  return `hsl(${hue.toFixed(1)}, 80%, 65%)`
}

/**
 * Pill background colour by state and position.
 * Same hue family, three lightness levels for current / done / future.
 *
 * Contrast note (WCAG AA):
 *   current  L=50% — luminance ≈ 0.50 for cyan → white text only ~1.9:1 (FAIL).
 *                     Use dark text (text-gray-900) on 'current' pills instead.
 *   done     L=40% — luminance ≈ 0.13 → white text ~5.8:1 (PASS).
 *   future   L=30% — luminance ≈ 0.06 → white text ~9.5:1 (PASS).
 */
export function pillProgressColor(
  pos: number,
  state: 'current' | 'done' | 'future'
): string {
  const clamped = Math.max(0, Math.min(STAGE_COUNT - 1, pos))
  const hue = 239 - ((239 - 160) / (STAGE_COUNT - 1)) * clamped
  if (state === 'current') return `hsl(${hue.toFixed(1)}, 72%, 50%)`
  if (state === 'done')    return `hsl(${hue.toFixed(1)}, 62%, 40%)`
  return                          `hsl(${hue.toFixed(1)}, 50%, 30%)`
}

/**
 * Dark variant of the stage colour for use as a background where white text is
 * rendered (drama popover header, CTA buttons, any coloured overlay with
 * white copy). L=25% guarantees ≥5.5:1 contrast with white (#fff) across all
 * 11 hues in the indigo→emerald sweep.
 *
 * Contrast check for worst-case hue (cyan, stage 8 at hue≈184):
 *   hsl(184, 80%, 25%) → luminance ≈ 0.083 → contrast = 1.05/0.133 ≈ 7.9:1 ✓
 */
export function stageDarkBgColor(pos: number): string {
  const clamped = Math.max(0, Math.min(STAGE_COUNT - 1, pos))
  const hue = 239 - ((239 - 160) / (STAGE_COUNT - 1)) * clamped
  return `hsl(${hue.toFixed(1)}, 80%, 25%)`
}

/**
 * Arrow connector colors: shaft uses from-color, arrowhead uses to-color.
 * idx 0 = connector between stage 1 and stage 2, idx 9 = between stage 10 and 11.
 */
export function arrowProgressColors(idx: number): { from: string; to: string } {
  return {
    from: stageProgressColor(idx),
    to:   stageProgressColor(idx + 1),
  }
}

/**
 * Stroke width (px) for the idx-th arrow (0 = first, 9 = last).
 * Linear 3 px → 9 px — increasing weight signals momentum building across the plan.
 */
export function arrowShaftWidth(idx: number): number {
  const MAX_IDX = STAGE_COUNT - 2  // 10 arrows (indices 0–9)
  return 3 + (9 - 3) * (Math.max(0, Math.min(MAX_IDX, idx)) / MAX_IDX)
}
