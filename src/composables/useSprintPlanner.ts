// UNIT_TYPE=Composable
// Feature #73 — Sprint Planner Export
import { ref, computed, type Ref } from 'vue'
import type { EvoStep } from '../types/evo-plan'

export interface Sprint {
  sprintNumber: number
  name: string          // "Sprint 1", "Sprint 2", etc.
  startDate: string     // formatted "Mon 04 May 2026"
  endDate: string       // startDate + 13 days
  steps: { title: string; effort: number }[]
  totalEffort: number
}

// ── Date helpers (pure, exported for testability) ────────────────────────────

/**
 * Returns the Date of the next Monday after `from` (default: today).
 * If `from` is itself a Monday, returns the FOLLOWING Monday (7 days ahead).
 */
export function nextMonday(from: Date = new Date()): Date {
  const d = new Date(from)
  d.setHours(0, 0, 0, 0)
  // getDay(): 0=Sun,1=Mon,2=Tue,...,6=Sat
  const dayOfWeek = d.getDay()
  // Days until next Monday: Monday(1) → 7, otherwise (8 - dayOfWeek) % 7
  const daysAhead = dayOfWeek === 1 ? 7 : (8 - dayOfWeek) % 7
  d.setDate(d.getDate() + daysAhead)
  return d
}

/**
 * Returns a new Date equal to `date` + `n` days.
 */
export function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

/**
 * Formats a Date as "Mon 04 May 2026".
 */
export function formatSprintDate(date: Date): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const dayName = days[date.getDay()]
  const dayNum = String(date.getDate()).padStart(2, '0')
  const monthName = months[date.getMonth()]
  const year = date.getFullYear()
  return `${dayName} ${dayNum} ${monthName} ${year}`
}

// ── Sprint capacity constant ─────────────────────────────────────────────────

const SPRINT_CAPACITY_HRS = 80  // 2 weeks × 5 days × 8 hrs

// ── Build sprints from EvoStep[] ─────────────────────────────────────────────

function buildSprints(evoSteps: EvoStep[]): Sprint[] {
  if (evoSteps.length === 0) return []

  // Map each EvoStep to { title, effort } — effortPercent is 0–100, convert to hours
  const stepItems = evoSteps.map((step, i) => ({
    title: step.name,
    effort:
      step.effortPercent !== undefined
        ? Math.round((step.effortPercent / 100) * 160)  // % of 4-week month (160 hrs)
        : (i + 1) * 8,                                  // fallback: 8h per step index
  }))

  const sprints: Sprint[] = []
  let sprintStart = nextMonday()
  let currentSteps: { title: string; effort: number }[] = []
  let currentEffort = 0
  let sprintNumber = 1

  for (const item of stepItems) {
    // If a single step exceeds capacity, or adding it would overflow, flush current sprint first
    if (currentSteps.length > 0 && currentEffort + item.effort > SPRINT_CAPACITY_HRS) {
      const end = addDays(sprintStart, 13)
      sprints.push({
        sprintNumber,
        name: `Sprint ${sprintNumber}`,
        startDate: formatSprintDate(sprintStart),
        endDate: formatSprintDate(end),
        steps: [...currentSteps],
        totalEffort: currentEffort,
      })
      sprintNumber++
      sprintStart = addDays(sprintStart, 14)
      currentSteps = []
      currentEffort = 0
    }

    currentSteps.push(item)
    currentEffort += item.effort

    // If single step fills/exceeds capacity on its own, flush immediately
    if (currentEffort >= SPRINT_CAPACITY_HRS) {
      const end = addDays(sprintStart, 13)
      sprints.push({
        sprintNumber,
        name: `Sprint ${sprintNumber}`,
        startDate: formatSprintDate(sprintStart),
        endDate: formatSprintDate(end),
        steps: [...currentSteps],
        totalEffort: currentEffort,
      })
      sprintNumber++
      sprintStart = addDays(sprintStart, 14)
      currentSteps = []
      currentEffort = 0
    }
  }

  // Flush any remaining steps
  if (currentSteps.length > 0) {
    const end = addDays(sprintStart, 13)
    sprints.push({
      sprintNumber,
      name: `Sprint ${sprintNumber}`,
      startDate: formatSprintDate(sprintStart),
      endDate: formatSprintDate(end),
      steps: [...currentSteps],
      totalEffort: currentEffort,
    })
  }

  return sprints
}

// ── Composable ────────────────────────────────────────────────────────────────

export function useSprintPlanner(steps: Ref<EvoStep[]>) {
  const sprintOpen = ref(false)
  const sprints = computed<Sprint[]>(() => buildSprints(steps.value))

  /**
   * Formats sprints as a Markdown pipe table and copies to clipboard.
   *
   * | Sprint | Dates | Steps | Total Effort |
   * |--------|-------|-------|--------------|
   * | Sprint 1 | Mon 04 May – Sun 17 May | Step A, Step B | 64 hrs |
   */
  function copySprintBoard(): void {
    const header = '| Sprint | Dates | Steps | Total Effort |'
    const separator = '|--------|-------|-------|--------------|'
    const rows = sprints.value.map((sprint) => {
      // endDate is "Sun DD MMM YYYY"; strip the year for the short range display
      const startShort = sprint.startDate.split(' ').slice(0, 3).join(' ')  // "Mon DD MMM"
      const endShort = sprint.endDate.split(' ').slice(0, 3).join(' ')      // "Sun DD MMM"
      const stepTitles = sprint.steps.map(s => s.title).join(', ')
      return `| ${sprint.name} | ${startShort} – ${endShort} | ${stepTitles} | ${sprint.totalEffort} hrs |`
    })
    const markdown = [header, separator, ...rows].join('\n')
    navigator.clipboard.writeText(markdown).catch(() => {
      // Silently ignore clipboard errors (e.g. in test environments)
    })
  }

  return { sprintOpen, sprints, copySprintBoard }
}
