// UNIT_TYPE=Composable
// Feature #36 — Evo Step Effort Breakdown
// Computes per-step F./V./S. work-split ratios and SVG doughnut path data.

import { computed } from 'vue'
import type { EvoStep } from '../types/evo-plan'

/** Slice sizes (fixed proportions for F. / V. / S. work) */
const F_SHARE = 0.50   // 50% – Function (delivery)
const V_SHARE = 0.30   // 30% – Value     (measurement / acceptance)
const S_SHARE = 0.20   // 20% – Solution  (implementation)

export interface EffortSlice {
  label: string          // "F. Work" | "V. Work" | "S. Work"
  share: number          // 0.0–1.0
  colour: string         // hex fill
  hours: number          // derived from effortPercent × totalHours
}

export interface StepEffortBreakdown {
  step: EvoStep
  totalHours: number
  slices: EffortSlice[]
}

/**
 * Compute the SVG doughnut arc path for a single slice.
 *
 * @param startAngle  start angle in radians (0 = right, goes clockwise)
 * @param endAngle    end angle in radians
 * @param cx          centre x
 * @param cy          centre y
 * @param outerR      outer radius
 * @param innerR      inner radius (hole)
 */
export function doughnutSlicePath(
  startAngle: number,
  endAngle: number,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
): string {
  // Clamp arc so a full circle doesn't collapse to nothing
  const delta = Math.min(endAngle - startAngle, 2 * Math.PI - 0.001)
  const outerStart = {
    x: cx + outerR * Math.cos(startAngle),
    y: cy + outerR * Math.sin(startAngle),
  }
  const outerEnd = {
    x: cx + outerR * Math.cos(startAngle + delta),
    y: cy + outerR * Math.sin(startAngle + delta),
  }
  const innerEnd = {
    x: cx + innerR * Math.cos(startAngle + delta),
    y: cy + innerR * Math.sin(startAngle + delta),
  }
  const innerStart = {
    x: cx + innerR * Math.cos(startAngle),
    y: cy + innerR * Math.sin(startAngle),
  }
  const largeArc = delta > Math.PI ? 1 : 0

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ')
}

export function useEffortBreakdown(totalProjectHours = 40) {
  /**
   * Build breakdown data for a list of steps.
   * Each step's absolute hours = effortPercent / 100 × totalProjectHours.
   * The three slices always sum to 100% of that step's hours.
   */
  function breakdown(steps: EvoStep[]): StepEffortBreakdown[] {
    return steps.map((step) => {
      const totalHours = Math.round((step.effortPercent / 100) * totalProjectHours)
      const slices: EffortSlice[] = [
        {
          label: 'F. Work',
          share: F_SHARE,
          colour: '#6366f1',   // indigo
          hours: Math.round(totalHours * F_SHARE),
        },
        {
          label: 'V. Work',
          share: V_SHARE,
          colour: '#10b981',   // emerald
          hours: Math.round(totalHours * V_SHARE),
        },
        {
          label: 'S. Work',
          share: S_SHARE,
          colour: '#f59e0b',   // amber
          hours: Math.round(totalHours * S_SHARE),
        },
      ]
      return { step, totalHours, slices }
    })
  }

  /**
   * Pre-compute the SVG path for each slice of a breakdown entry.
   * Returns an array of { path, colour, label } ready for <path> elements.
   */
  function slicePaths(
    entry: StepEffortBreakdown,
    cx = 40,
    cy = 40,
    outerR = 36,
    innerR = 20,
  ): { path: string; colour: string; label: string; hours: number }[] {
    // Start at top (–π/2)
    let angle = -Math.PI / 2
    return entry.slices.map((slice) => {
      const sweep = slice.share * 2 * Math.PI
      const path = doughnutSlicePath(angle, angle + sweep, cx, cy, outerR, innerR)
      angle += sweep
      return { path, colour: slice.colour, label: slice.label, hours: slice.hours }
    })
  }

  const breakdownComputed = computed(() => breakdown([]))

  return { breakdown, slicePaths, breakdownComputed }
}
