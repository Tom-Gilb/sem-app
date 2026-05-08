// UNIT_TYPE=Composable
// Feature #158 — Evo Step Mood Tracker
import { ref, computed, type Ref, type ComputedRef } from 'vue'

export type MoodEmoji = '😰' | '😐' | '😊' | '🤩'

export interface MoodEntry {
  stepId: string
  stepName: string
  mood: MoodEmoji
  isOpen: boolean
}

export interface MoodTrackerStep {
  id: string
  name: string
}

const MOODS: MoodEmoji[] = ['😰', '😐', '😊', '🤩']

// ── charCode-sum seed helper ─────────────────────────────────────────────────

export function charCodeSeed(step: MoodTrackerStep): number {
  const str = step.id + step.name
  return Array.from(str).reduce((acc, c) => acc + c.charCodeAt(0), 0)
}

// ── Mood detection ──────────────────────────────────────────────────────────

export function defaultMood(step: MoodTrackerStep): MoodEmoji {
  return MOODS[charCodeSeed(step) % 4]
}

// ── Composable ────────────────────────────────────────────────────────────────

export function useStepMoodTracker(steps: Ref<MoodTrackerStep[]>) {
  const moodMap = ref<Record<string, MoodEntry>>({})
  const moodCopied = ref(false)

  // ── Init / load ──────────────────────────────────────────────────────────

  function loadMoods(): void {
    for (const step of steps.value) {
      const stored = sessionStorage.getItem(`sem-step-mood-${step.id}`)
      const mood: MoodEmoji = (stored && MOODS.includes(stored as MoodEmoji))
        ? (stored as MoodEmoji)
        : defaultMood(step)

      // Preserve isOpen state if already exists
      const existing = moodMap.value[step.id]
      moodMap.value[step.id] = {
        stepId: step.id,
        stepName: step.name,
        mood,
        isOpen: existing?.isOpen ?? false,
      }
    }
  }

  // Initialise on creation
  loadMoods()

  // ── setMood ──────────────────────────────────────────────────────────────

  function setMood(stepId: string, mood: MoodEmoji): void {
    const entry = moodMap.value[stepId]
    if (!entry) return
    moodMap.value[stepId] = { ...entry, mood }
    sessionStorage.setItem(`sem-step-mood-${stepId}`, mood)
  }

  // ── toggleOpen ───────────────────────────────────────────────────────────

  function toggleOpen(stepId: string): void {
    const entry = moodMap.value[stepId]
    if (!entry) return
    moodMap.value[stepId] = { ...entry, isOpen: !entry.isOpen }
  }

  // ── aggregateMood ────────────────────────────────────────────────────────

  // Tie-break order: 🤩 > 😊 > 😐 > 😰 (highest index wins)
  const aggregateMood: ComputedRef<MoodEmoji> = computed(() => {
    const entries = Object.values(moodMap.value)
    if (entries.length === 0) return '😐'

    const counts: Record<MoodEmoji, number> = { '😰': 0, '😐': 0, '😊': 0, '🤩': 0 }
    for (const e of entries) {
      counts[e.mood]++
    }

    // Find max count
    const maxCount = Math.max(...Object.values(counts))

    // Among those tied at maxCount, pick the one with highest tie-break order
    // Tie-break order: 🤩 (index 3) > 😊 (index 2) > 😐 (index 1) > 😰 (index 0)
    for (let i = MOODS.length - 1; i >= 0; i--) {
      if (counts[MOODS[i]] === maxCount) {
        return MOODS[i]
      }
    }
    return '😐'
  })

  // ── Markdown copy ──────────────────────────────────────────────────────────

  function copyMarkdown(): void {
    const header = '| Step | Mood |'
    const sep = '|---|---|'
    const rows = steps.value.map(step => {
      const entry = moodMap.value[step.id]
      const mood = entry?.mood ?? defaultMood(step)
      return `| ${step.name} | ${mood} |`
    })
    const md = [header, sep, ...rows].join('\n')
    navigator.clipboard?.writeText(md).catch(() => {})
    moodCopied.value = true
    setTimeout(() => { moodCopied.value = false }, 2000)
  }

  return {
    moodMap,
    setMood,
    toggleOpen,
    loadMoods,
    aggregateMood,
    copyMarkdown,
    moodCopied,
    MOODS,
  }
}
