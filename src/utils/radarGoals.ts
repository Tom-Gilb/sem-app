// UNIT_TYPE=Utility
// Feature #55 — Value radar overlay helpers

export function parseGoalNumber(goal: string | undefined): number {
  if (!goal) return 0
  const match = goal.match(/[\d.]+/)
  return match ? parseFloat(match[0]) : 0
}

export function normaliseGoals(goals: (string | undefined)[]): number[] {
  const parsed = goals.map(parseGoalNumber)
  const max = Math.max(...parsed, 1)
  return parsed.map(v => v / max)
}
