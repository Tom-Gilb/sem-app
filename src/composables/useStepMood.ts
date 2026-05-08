// UNIT_TYPE=Composable
// Feature #158 — Evo step mood tracker
// Per-step emoji reaction bar (😰/😐/😊/🤩); charCode-seeded default; sessionStorage-backed
import { ref, computed } from 'vue'

export type MoodEmoji = '😰' | '😐' | '😊' | '🤩'
const MOODS: MoodEmoji[] = ['😰', '😐', '😊', '🤩']
const MOOD_LABELS = ['Anxious', 'Neutral', 'Good', 'Excited']
const STORAGE_KEY = 'sem-step-moods'

export function useStepMood() {
  const moodMap = ref<Record<string, MoodEmoji>>({})
  const openSteps = ref<Set<string>>(new Set())

  function seed(s: string): number {
    return s.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  }

  function loadFromStorage(): Record<string, MoodEmoji> {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : {}
    } catch { return {} }
  }

  function saveToStorage() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(moodMap.value))
    } catch { /* noop */ }
  }

  function getMood(stepId: string, stepTitle: string): MoodEmoji {
    if (moodMap.value[stepId]) return moodMap.value[stepId]
    // Load from storage first
    const stored = loadFromStorage()
    if (stored[stepId]) {
      moodMap.value[stepId] = stored[stepId]
      return stored[stepId]
    }
    // Charcode-seeded default
    const s = seed(stepId + stepTitle)
    const defaultMood = MOODS[s % MOODS.length]
    moodMap.value[stepId] = defaultMood
    return defaultMood
  }

  function setMood(stepId: string, mood: MoodEmoji) {
    moodMap.value[stepId] = mood
    saveToStorage()
  }

  function toggleOpen(stepId: string) {
    if (openSteps.value.has(stepId)) openSteps.value.delete(stepId)
    else openSteps.value.add(stepId)
  }

  function isOpen(stepId: string): boolean {
    return openSteps.value.has(stepId)
  }

  const dominantMood = computed((): MoodEmoji => {
    const counts: Record<MoodEmoji, number> = { '😰': 0, '😐': 0, '😊': 0, '🤩': 0 }
    for (const mood of Object.values(moodMap.value)) {
      counts[mood]++
    }
    return MOODS.reduce((a, b) => counts[a] >= counts[b] ? a : b)
  })

  function moodLabel(mood: MoodEmoji): string {
    return MOOD_LABELS[MOODS.indexOf(mood)]
  }

  function copyMarkdown(steps: Array<{ id: string; title: string }>): string {
    const lines = ['# Step Mood Tracker\n']
    lines.push(`Overall mood: ${dominantMood.value}\n`)
    lines.push('| Step | Mood | Label |')
    lines.push('|---|---|---|')
    for (const s of steps) {
      const mood = moodMap.value[s.id] ?? '😐'
      lines.push(`| ${s.title} | ${mood} | ${moodLabel(mood)} |`)
    }
    return lines.join('\n')
  }

  return { moodMap, openSteps, toggleOpen, isOpen, getMood, setMood, dominantMood, moodLabel, copyMarkdown, MOODS }
}
