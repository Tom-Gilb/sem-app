// UNIT_TYPE=Composable
// Feature #101 — Evo Step Capacity Planner
import { ref, computed, type Ref } from 'vue'
import type { EvoStep } from '../types/evo-plan'
import { nextMonday, addDays, formatSprintDate } from './useSprintPlanner'

// ── Step colour palette (cycles) ─────────────────────────────────────────────

const STEP_COLOURS = [
  '#6366f1', // indigo-500
  '#f59e0b', // amber-500
  '#10b981', // emerald-500
  '#ef4444', // red-500
  '#8b5cf6', // violet-500
  '#3b82f6', // blue-500
  '#ec4899', // pink-500
  '#14b8a6', // teal-500
]

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StepContribution {
  stepTitle: string
  hours: number
  colour: string
}

export interface WeekData {
  weekLabel: string           // "Wk 1", "Wk 2", etc.
  startDate: string           // formatted "Mon DD MMM YYYY"
  available: number           // hrPerWeek
  required: number            // total step effort hours scheduled in this week
  overCapacity: boolean       // required > available
  stepContributions: StepContribution[]
}

// ── Core build function ───────────────────────────────────────────────────────

/**
 * Distributes EvoStep effort across 8 weekly buckets.
 *
 * Each step's effort in hours = effortPercent / 100 * 160 (or fallback (i+1)*8).
 * Steps are filled into weeks sequentially: fill week[0] up to hrPerWeek, then
 * spill into week[1], etc.  A step that straddles a week boundary is split.
 */
export function buildWeeks(evoSteps: EvoStep[], hrPerWeek: number): WeekData[] {
  const NUM_WEEKS = 8
  const start = nextMonday()

  // Initialise 8 empty weeks
  const weeks: WeekData[] = Array.from({ length: NUM_WEEKS }, (_, i) => ({
    weekLabel: `Wk ${i + 1}`,
    startDate: formatSprintDate(addDays(start, i * 7)),
    available: hrPerWeek,
    required: 0,
    overCapacity: false,
    stepContributions: [],
  }))

  if (evoSteps.length === 0) return weeks

  // Convert steps to { title, hours, colour }
  const stepItems = evoSteps.map((step, i) => ({
    title: step.name,
    hours:
      step.effortPercent !== undefined
        ? Math.round((step.effortPercent / 100) * 160)
        : (i + 1) * 8,
    colour: STEP_COLOURS[i % STEP_COLOURS.length],
  }))

  let weekIndex = 0
  let weekUsed = 0  // hours already consumed in current week

  for (const item of stepItems) {
    let remaining = item.hours

    while (remaining > 0 && weekIndex < NUM_WEEKS) {
      const capacity = hrPerWeek - weekUsed
      const placed = Math.min(remaining, capacity)

      if (placed > 0) {
        weeks[weekIndex].required += placed
        weeks[weekIndex].stepContributions.push({
          stepTitle: item.title,
          hours: placed,
          colour: item.colour,
        })
      }

      remaining -= placed
      weekUsed += placed

      // Move to next week when current week is full
      if (weekUsed >= hrPerWeek && remaining > 0) {
        weekIndex++
        weekUsed = 0
      }
    }

    // If we exactly hit the capacity limit move to the next week for the next step
    if (weekUsed >= hrPerWeek && weekIndex < NUM_WEEKS) {
      weekIndex++
      weekUsed = 0
    }
  }

  // Mark over-capacity weeks (required > available)
  for (const week of weeks) {
    week.overCapacity = week.required > week.available
  }

  return weeks
}

// ── Composable ────────────────────────────────────────────────────────────────

export function useCapacityPlanner(steps: Ref<EvoStep[]>) {
  const capacityOpen = ref(false)
  const hrPerWeek = ref(40)  // user-settable team capacity

  const weeks = computed<WeekData[]>(() => buildWeeks(steps.value, hrPerWeek.value))

  const overCapacityCount = computed(() => weeks.value.filter(w => w.overCapacity).length)

  /**
   * Copies a Markdown table of the capacity plan to the clipboard.
   * | Week | Available hrs | Required hrs | Status |
   */
  function copyCapacityPlan(): void {
    const header = '| Week | Available hrs | Required hrs | Status |'
    const separator = '|------|--------------|-------------|--------|'
    const rows = weeks.value.map(w => {
      const status = w.overCapacity ? '⚠ Over capacity' : '✓ OK'
      return `| ${w.weekLabel} | ${w.available} hrs | ${w.required} hrs | ${status} |`
    })
    const markdown = [header, separator, ...rows].join('\n')
    navigator.clipboard.writeText(markdown).catch(() => {
      // Silently ignore clipboard errors in test environments
    })
  }

  return { capacityOpen, hrPerWeek, weeks, overCapacityCount, copyCapacityPlan }
}
