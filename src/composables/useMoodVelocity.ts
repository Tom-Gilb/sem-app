// UNIT_TYPE=Composable
// Feature #173 — Evo step "mood × velocity" correlation
import { ref, computed } from 'vue'
import type { Ref, ComputedRef } from 'vue'

export interface MvPoint {
  stepId: string
  stepTitle: string
  mood: number       // 1-4 charCode-seeded: 1=😰, 2=😐, 3=😊, 4=🤩
  velocity: number   // 1-10 charCode-seeded (from step effort if available, else seed from stepId)
  moodEmoji: string  // '😰'|'😐'|'😊'|'🤩'
}

export interface UseMoodVelocityReturn {
  open: Ref<boolean>
  points: ComputedRef<MvPoint[]>
  correlation: ComputedRef<number>
  correlationLabel: ComputedRef<string>
  copyMarkdown: () => Promise<void>
  copied: Ref<boolean>
}

function seed(s: string, mod: number): number {
  return s.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % mod
}

const MOOD_EMOJIS: Record<number, string> = {
  1: '😰',
  2: '😐',
  3: '😊',
  4: '🤩',
}

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length
  if (n < 2) return 0
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  const num = xs.reduce((sum, x, i) => sum + (x - mx) * (ys[i] - my), 0)
  const dx = Math.sqrt(xs.reduce((s, x) => s + (x - mx) ** 2, 0))
  const dy = Math.sqrt(ys.reduce((s, y) => s + (y - my) ** 2, 0))
  if (dx === 0 || dy === 0) return 0
  return Math.round((num / (dx * dy)) * 100) / 100
}

export function useMoodVelocity(
  stepData: () => Array<{ id: string; title: string; effort?: number }>,
): UseMoodVelocityReturn {
  const open = ref(false)
  const copied = ref(false)

  const points = computed((): MvPoint[] => {
    const allSteps = stepData()
    if (!allSteps.length) return []

    return allSteps.map((s) => {
      const mood = (seed(s.id + 'mood', 4) + 1) // 1–4
      const moodEmoji = MOOD_EMOJIS[mood] ?? '😐'

      let velocity: number
      if (s.effort !== undefined && s.effort > 0) {
        velocity = Math.min(10, Math.max(1, Math.round(s.effort)))
      } else {
        velocity = seed(s.id + 'vel', 9) + 2 // 2–10
      }

      return {
        stepId: s.id,
        stepTitle: s.title,
        mood,
        velocity,
        moodEmoji,
      }
    })
  })

  const correlation = computed((): number => {
    const pts = points.value
    if (pts.length < 2) return 0
    const xs = pts.map((p) => p.mood)
    const ys = pts.map((p) => p.velocity)
    return pearson(xs, ys)
  })

  const correlationLabel = computed((): string => {
    const r = correlation.value
    if (r > 0.6) return 'Strong positive — high morale predicts faster delivery'
    if (r > 0.3) return 'Moderate positive — morale loosely tracks velocity'
    if (r >= -0.3) return 'Weak / no correlation — other factors dominate'
    return 'Negative correlation — investigate team dynamics'
  })

  async function copyMarkdown(): Promise<void> {
    const pts = points.value
    const lines: string[] = []
    lines.push('| Step | Mood | Mood Emoji | Velocity |')
    lines.push('|---|---|---|---|')
    for (const p of pts) {
      lines.push(`| ${p.stepTitle} | ${p.mood} | ${p.moodEmoji} | ${p.velocity} |`)
    }
    lines.push('')
    lines.push(`Pearson r: ${correlation.value} (${correlationLabel.value})`)

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
    points,
    correlation,
    correlationLabel,
    copyMarkdown,
    copied,
  }
}
