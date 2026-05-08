// UNIT_TYPE=Composable
// Feature #153 — Evo Step Retrospective Themes Aggregator
import { ref, computed, type Ref, type ComputedRef } from 'vue'

export interface RetroTheme {
  name: string
  steps: string[]
  count: number
  topPrompt: string
}

export interface RetroThemesStep {
  id: string
  name: string
  effort?: number
}

// ── Theme definitions ────────────────────────────────────────────────────────

const THEME_NAMES = ['velocity', 'quality', 'team', 'process'] as const
type ThemeName = (typeof THEME_NAMES)[number]

const THEME_KEYWORDS: Record<ThemeName, string[]> = {
  velocity: ['speed', 'fast', 'slow', 'deliver', 'ship', 'rate', 'throughput'],
  quality:  ['test', 'bug', 'fix', 'review', 'spec', 'check', 'validate'],
  team:     ['pair', 'mob', 'collab', 'sync', 'standup', 'align', 'communicate'],
  process:  ['plan', 'retro', 'sprint', 'board', 'estimate', 'scope', 'backlog'],
}

const TOP_PROMPTS: Record<ThemeName, string> = {
  velocity: 'What slowed us down this sprint?',
  quality:  'What quality issues need addressing?',
  team:     'How can we improve team collaboration?',
  process:  'What process improvements would help most?',
}

// ── charCode-sum seed helper ─────────────────────────────────────────────────

function charCodeSeed(step: RetroThemesStep): number {
  const str = step.id + step.name
  return Array.from(str).reduce((acc, c) => acc + c.charCodeAt(0), 0)
}

// ── Theme detection ─────────────────────────────────────────────────────────

/**
 * Returns the ThemeName for a step.
 * Checks step.name.toLowerCase() for each keyword set in order; assigns to
 * first matching theme. If no match: seed % 4 → theme index.
 */
export function detectTheme(step: RetroThemesStep): ThemeName {
  const lower = step.name.toLowerCase()
  for (const theme of THEME_NAMES) {
    if (THEME_KEYWORDS[theme].some(kw => lower.includes(kw))) {
      return theme
    }
  }
  // Fallback: deterministic seed
  return THEME_NAMES[charCodeSeed(step) % 4]
}

// ── Composable ────────────────────────────────────────────────────────────────

export function useRetroThemes(steps: Ref<RetroThemesStep[]>) {
  const retroThemesOpen = ref(false)
  const copied = ref(false)

  /**
   * Map from stepId → theme name (deterministic, charCode-seeded).
   */
  const stepThemeMap: ComputedRef<Record<string, ThemeName>> = computed(() => {
    const map: Record<string, ThemeName> = {}
    for (const step of steps.value) {
      map[step.id] = detectTheme(step)
    }
    return map
  })

  /**
   * Returns the theme name for a given stepId.
   */
  function stepTheme(stepId: string): string {
    return stepThemeMap.value[stepId] ?? 'process'
  }

  /**
   * 4 RetroTheme objects, sorted descending by count.
   */
  const themes: ComputedRef<RetroTheme[]> = computed(() => {
    const buckets: Record<ThemeName, string[]> = {
      velocity: [],
      quality:  [],
      team:     [],
      process:  [],
    }

    for (const step of steps.value) {
      const theme = stepThemeMap.value[step.id] ?? detectTheme(step)
      buckets[theme].push(step.name)
    }

    return THEME_NAMES.map(name => ({
      name,
      steps: buckets[name],
      count: buckets[name].length,
      topPrompt: TOP_PROMPTS[name],
    })).sort((a, b) => b.count - a.count)
  })

  // ── Markdown copy ─────────────────────────────────────────────────────────

  function copyMarkdown(): void {
    const sections = themes.value.map(t => {
      const header = `## ${t.name.charAt(0).toUpperCase() + t.name.slice(1)} (${t.count} steps)`
      const prompt = `> ${t.topPrompt}`
      const stepLines = t.steps.length > 0
        ? t.steps.map(s => `- ${s}`).join('\n')
        : '- (none)'
      return [header, prompt, stepLines].join('\n')
    })
    const md = sections.join('\n\n')
    navigator.clipboard?.writeText(md).catch(() => {})
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }

  return {
    retroThemesOpen,
    themes,
    stepTheme,
    copyMarkdown,
    copied,
  }
}
