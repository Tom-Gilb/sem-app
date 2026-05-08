// UNIT_TYPE=Composable
// Feature #82 — Evo step confidence vote
import { ref, computed, type Ref } from 'vue'
import type { EvoStep } from '../types/evo-plan'

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface VoteRecord {
  stepId: string
  votes: number[]  // each vote is 1–5; up to 5 simulated voters in mock mode
}

export interface VoteSummary {
  stepId: string
  avg: number           // mean, 1 decimal place
  tally: number[]       // tally[0] = count of 1-star votes, ..., tally[4] = count of 5-star votes
  hasOutlier: boolean   // true if any vote deviates from avg by >1.5
  userVote: number | null   // the current user's vote (1–5 or null)
}

// ── SVG arc helper ────────────────────────────────────────────────────────────

/**
 * ringArc(avg, size) — pure function.
 * avg 1–5 scaled to 0–1; arc drawn as path from 12 o'clock clockwise.
 * size = SVG width/height (e.g. 32).
 * colour: emerald if avg ≥ 4, amber if 3–3.9, red if < 3.
 */
export function ringArc(avg: number, size: number): { d: string; colour: string } {
  const fraction = Math.max(0, Math.min(1, (avg - 1) / 4))  // scale 1–5 to 0–1
  const cx = size / 2
  const cy = size / 2
  const r = size * 0.38
  const strokeWidth = size * 0.14

  // Arc path from 12 o'clock (top) clockwise by fraction of full circle
  const startAngle = -Math.PI / 2
  const endAngle = startAngle + fraction * 2 * Math.PI
  const largeArc = fraction > 0.5 ? 1 : 0

  const topX = cx + r * Math.cos(startAngle)
  const topY = cy + r * Math.sin(startAngle)
  const endX = cx + r * Math.cos(endAngle)
  const endY = cy + r * Math.sin(endAngle)

  // Full circle fallback for fraction ~= 1
  let d: string
  if (fraction >= 0.9999) {
    d = `M ${topX},${topY} A ${r},${r} 0 1,1 ${topX - 0.001},${topY}`
  } else if (fraction <= 0.0001) {
    d = ''
  } else {
    d = `M ${topX},${topY} A ${r},${r} 0 ${largeArc},1 ${endX},${endY}`
  }

  // Colour thresholds
  let colour: string
  if (avg >= 4) {
    colour = '#10b981'  // emerald-500
  } else if (avg >= 3) {
    colour = '#f59e0b'  // amber-500
  } else {
    colour = '#ef4444'  // red-500
  }

  return { d, colour }
}

// ── Composable ────────────────────────────────────────────────────────────────

export function useConfidenceVote(steps: Ref<EvoStep[]>) {
  // Keyed by stepId — stores mock + user votes
  const voteRecords = ref<Record<string, VoteRecord>>({})

  // Separate map for user votes (by stepId)
  const userVotes = ref<Record<string, number>>({})

  /**
   * Seed 3 deterministic mock votes for a step.
   * Seed: charCode sum of stepId mod 3 + 3 → base vote (3, 4, or 5).
   * Three votes are generated at offsets -1, 0, +1 from the base,
   * clamped to 1–5 so results are always valid.
   */
  function seedMockVotes(stepId: string): number[] {
    const charSum = stepId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
    const base = (charSum % 3) + 3  // 3, 4, or 5
    return [
      Math.max(1, Math.min(5, base - 1)),
      Math.max(1, Math.min(5, base)),
      Math.max(1, Math.min(5, base + 1)),
    ]
  }

  /**
   * Lazily ensure a VoteRecord exists for stepId with seeded mock votes.
   */
  function ensureRecord(stepId: string): void {
    if (!voteRecords.value[stepId]) {
      voteRecords.value[stepId] = {
        stepId,
        votes: seedMockVotes(stepId),
      }
    }
  }

  /**
   * setUserVote — update the user's vote for a step (stars: 1–5).
   * The user's vote is kept in userVotes; summaries includes it.
   */
  function setUserVote(stepId: string, stars: number): void {
    ensureRecord(stepId)
    userVotes.value[stepId] = stars
  }

  /**
   * Summaries — computed Record<stepId, VoteSummary>.
   * Merges mock votes + user vote per step.
   */
  const summaries = computed<Record<string, VoteSummary>>(() => {
    const result: Record<string, VoteSummary> = {}

    for (const step of steps.value) {
      const stepId = step.name  // use step.name as the stepId (EvoStep has no id field)
      ensureRecord(stepId)
      const record = voteRecords.value[stepId]
      const userVote = userVotes.value[stepId] ?? null

      // Combine mock votes + user vote
      const allVotes = userVote !== null ? [...record.votes, userVote] : [...record.votes]

      // Compute average
      const avg = allVotes.length > 0
        ? Math.round((allVotes.reduce((s, v) => s + v, 0) / allVotes.length) * 10) / 10
        : 0

      // Tally: index 0 = 1-star count, ..., index 4 = 5-star count
      const tally = [0, 0, 0, 0, 0]
      for (const v of allVotes) {
        if (v >= 1 && v <= 5) tally[v - 1]++
      }

      // Outlier: any vote deviating from avg by > 1.5
      const hasOutlier = allVotes.some(v => Math.abs(v - avg) > 1.5)

      result[stepId] = { stepId, avg, tally, hasOutlier, userVote }
    }

    return result
  })

  return { voteRecords, summaries, setUserVote, ringArc }
}
