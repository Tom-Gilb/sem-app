// UNIT_TYPE=Utility
// Feature #47 — Emoji progress tracker

/**
 * Returns an array of emoji strings representing progress.
 * total: number of milestone emoji to show (default 5)
 * progress: 0.0 – 1.0
 *
 * Stages per emoji:
 *   - 0%     : 🌱 (seed — not started)
 *   - 1–49%  : 🌿 (sprout — in progress, first half)
 *   - 50–99% : 🌲 (tree — in progress, second half)
 *   - 100%   : 🌳 (full tree — complete)
 *
 * The "filled" count = Math.round(progress * total).
 * Emojis to the left of filledCount are 🌳; the one AT filledCount is 🌲 if progress > 0 and < 1; to the right are 🌱.
 */
export function getProgressEmojis(completedTasks: number, totalTasks: number, slots = 5): string[] {
  if (totalTasks === 0) return Array(slots).fill('🌱')
  const ratio = completedTasks / totalTasks
  if (ratio >= 1) return Array(slots).fill('🌳')
  if (ratio <= 0) return Array(slots).fill('🌱')
  const filledSlots = Math.round(ratio * slots)

  return Array.from({ length: slots }, (_, i) => {
    if (i < filledSlots - 1) return '🌳'  // fully done
    if (i === filledSlots - 1) return '🌲' // current frontier
    return '🌱'  // not yet
  })
}

/** Returns a text description for aria-label */
export function getProgressLabel(completedTasks: number, totalTasks: number): string {
  if (totalTasks === 0) return 'No tasks'
  const pct = Math.round((completedTasks / totalTasks) * 100)
  return `${completedTasks} of ${totalTasks} tasks complete (${pct}%)`
}
