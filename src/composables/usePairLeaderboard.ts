// UNIT_TYPE=Composable
// Feature #176 — Evo step "pair programming leaderboard"
import { ref, computed } from 'vue'
import type { Ref, ComputedRef } from 'vue'

export interface LeaderboardEntry {
  rank: number
  stepId: string
  stepTitle: string
  effort: number
  complexity: number
  productivity: number
  badge: '🥇' | '🥈' | '🥉' | ''
  tier: 'top' | 'mid' | 'low'
}

export interface UsePairLeaderboardReturn {
  open: Ref<boolean>
  entries: ComputedRef<LeaderboardEntry[]>
  topEntry: ComputedRef<LeaderboardEntry | null>
  copyMarkdown: () => Promise<void>
  copied: Ref<boolean>
}

function seed(s: string, mod: number): number {
  return s.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % mod
}

function badge(rank: number): '🥇' | '🥈' | '🥉' | '' {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return ''
}

function tier(rank: number): 'top' | 'mid' | 'low' {
  if (rank <= 3) return 'top'
  if (rank <= 6) return 'mid'
  return 'low'
}

export function usePairLeaderboard(
  stepData: () => Array<{ id: string; title: string; effort?: number }>,
): UsePairLeaderboardReturn {
  const open = ref(false)
  const copied = ref(false)

  const entries = computed((): LeaderboardEntry[] => {
    const allSteps = stepData()
    if (!allSteps.length) return []

    const scored = allSteps.map((s) => {
      const effort = s.effort !== undefined && s.effort > 0
        ? s.effort
        : seed(s.id + 'effort', 8) + 1
      const complexity = seed(s.id + 'complexity', 5) + 1
      const productivity = Math.round((effort / complexity) * 10) / 10
      return { stepId: s.id, stepTitle: s.title, effort, complexity, productivity }
    })

    scored.sort((a, b) => b.productivity - a.productivity)

    return scored.map((entry, i) => {
      const rank = i + 1
      return {
        rank,
        stepId: entry.stepId,
        stepTitle: entry.stepTitle,
        effort: entry.effort,
        complexity: entry.complexity,
        productivity: entry.productivity,
        badge: badge(rank),
        tier: tier(rank),
      }
    })
  })

  const topEntry = computed((): LeaderboardEntry | null => {
    const list = entries.value
    if (!list.length) return null
    return list.find((e) => e.rank === 1) ?? null
  })

  async function copyMarkdown(): Promise<void> {
    const list = entries.value
    const lines: string[] = []
    lines.push('## Pair Programming Leaderboard')
    lines.push('')
    lines.push('| Rank | Step | Effort | Complexity | Productivity |')
    lines.push('|---|---|---|---|---|')
    for (const e of list) {
      lines.push(`| ${e.badge || e.rank} | ${e.stepTitle} | ${e.effort} | ${e.complexity} | ${e.productivity} |`)
    }

    const md = lines.join('\n')
    try {
      await navigator.clipboard.writeText(md)
    } catch {
      // clipboard may not be available in all environments
    }
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  }

  return {
    open,
    entries,
    topEntry,
    copyMarkdown,
    copied,
  }
}
