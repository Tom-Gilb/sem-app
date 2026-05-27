// useSemMetadata.ts — SEM App scoreboard: snapshot build constants + live session counters.
// Snapshot constants reflect build-time state; counters persist in localStorage.
// Singleton module: counters are hydrated once from localStorage at module load time.
// Multiple callers share the same reactive counter refs.

import { ref, computed } from 'vue'

// ── Snapshot constants (build-time truth) ────────────────────────────────────

const DATE_STARTED          = '2026-04-28'
const LAST_UPDATED          = '2026-05-27'
const VUE_VERSION           = '3.x'
const TS_VERSION            = '5.x'
const TAILWIND_VER          = '3.x'
const COMPONENT_COUNT       = 126
const COMPOSABLE_COUNT      = 249
const TEST_FILE_COUNT       = 205
const LOC_TOTAL             = 178_802
const DESIGN_HISTORY_LINES  = 2_501
const PLANGUAGE_CONCEPTS    = 729

// ── Counter key registry ──────────────────────────────────────────────────────

export const COUNTER_KEYS = [
  'plansExported',
  'dadJokesTold',
  'voiceCommandsUsed',
  'sessionsCount',
  'illuminatesFired',
  'sharpenRoundsDone',
  'planHealthChecks',
  'feedbackSent',
] as const

export type CounterKey = (typeof COUNTER_KEYS)[number]

const LS_PREFIX = 'sem.metadata.counters.v1.'

// ── Module-level singleton: single localStorage hydrate ───────────────────────
// All calls to useSemMetadata() share these same ref instances so counter
// mutations are immediately visible everywhere (reactive singleton pattern).

type CounterMap = { [K in CounterKey]: ReturnType<typeof ref<number>> }

function _hydrate(): CounterMap {
  const map = {} as CounterMap
  for (const k of COUNTER_KEYS) {
    const raw     = localStorage.getItem(LS_PREFIX + k)
    const initial = raw !== null ? parseInt(raw, 10) : 0
    map[k]        = ref(isNaN(initial) ? 0 : initial)
  }
  return map
}

const _counters: CounterMap = _hydrate()

// ── Exported field shape ──────────────────────────────────────────────────────

export interface SemMetadataField {
  key:    string
  label:  string
  value:  number | string | null
  unit?:  string
  note?:  string
  group:  'build' | 'lifetime' | 'counters' | 'fun'
  emoji:  string
}

// ── Public composable ─────────────────────────────────────────────────────────

export function useSemMetadata() {

  const daysSinceStart = computed<number>(() => {
    const ms = Date.now() - new Date(DATE_STARTED).getTime()
    return Math.max(0, Math.floor(ms / 86_400_000))
  })

  const daysSinceUpdate = computed<number>(() => {
    const ms = Date.now() - new Date(LAST_UPDATED).getTime()
    return Math.max(0, Math.floor(ms / 86_400_000))
  })

  const fields = computed<SemMetadataField[]>(() => {
    const rows: SemMetadataField[] = [
      // ── Build group ────────────────────────────────────────────────────────
      { key: 'dateStarted',       label: 'Date Started',         value: DATE_STARTED,             group: 'build',    emoji: '📅' },
      { key: 'lastUpdated',       label: 'Last Updated',         value: LAST_UPDATED,             group: 'build',    emoji: '🔄' },
      { key: 'vueVersion',        label: 'Vue Version',          value: VUE_VERSION,              group: 'build',    emoji: '💚' },
      { key: 'tsVersion',         label: 'TypeScript',           value: TS_VERSION,               group: 'build',    emoji: '💙' },
      { key: 'tailwindVersion',   label: 'Tailwind',             value: TAILWIND_VER,             group: 'build',    emoji: '🎨' },
      { key: 'componentCount',    label: 'Components',           value: COMPONENT_COUNT,          group: 'build',    emoji: '🧩', unit: 'files'    },
      { key: 'composableCount',   label: 'Composables',          value: COMPOSABLE_COUNT,         group: 'build',    emoji: '🔧', unit: 'files'    },
      { key: 'testFileCount',     label: 'Test Files',           value: TEST_FILE_COUNT,          group: 'build',    emoji: '🧪', unit: 'files'    },
      { key: 'locTotal',          label: 'Lines of Code',        value: LOC_TOTAL,                group: 'build',    emoji: '📄', unit: 'lines'    },
      // ── Lifetime group ──────────────────────────────────────────────────────
      { key: 'daysAlive',         label: 'Days Alive',           value: daysSinceStart.value,     group: 'lifetime', emoji: '🎂', unit: 'days'      },
      { key: 'daysSinceUpdate',   label: 'Since Last Update',    value: daysSinceUpdate.value,    group: 'lifetime', emoji: '📝', unit: 'days ago'  },
      { key: 'designHistory',     label: 'Design History',       value: DESIGN_HISTORY_LINES,     group: 'lifetime', emoji: '📚', unit: 'lines'    },
      { key: 'planguageConcepts', label: 'Planguage Concepts',   value: PLANGUAGE_CONCEPTS,       group: 'lifetime', emoji: '📖', unit: 'entries'  },
      { key: 'featuresInstalled', label: 'Features Installed',   value: null,                     group: 'lifetime', emoji: '⚙️', note: 'tracking soon' },
      { key: 'totalChanges',      label: 'Total Design Changes', value: null,                     group: 'lifetime', emoji: '📊', note: 'tracking soon' },
      // ── Counters group ──────────────────────────────────────────────────────
      { key: 'plansExported',     label: 'Plans Exported',       value: _counters.plansExported.value,     group: 'counters', emoji: '📤' },
      { key: 'dadJokesTold',      label: 'Dad Jokes Told',       value: _counters.dadJokesTold.value,      group: 'counters', emoji: '😄' },
      { key: 'voiceCommandsUsed', label: 'Voice Commands',       value: _counters.voiceCommandsUsed.value, group: 'counters', emoji: '🎤' },
      { key: 'sessionsCount',     label: 'Sessions',             value: _counters.sessionsCount.value,     group: 'counters', emoji: '🔌' },
      { key: 'illuminatesFired',  label: 'Illuminates Fired',    value: _counters.illuminatesFired.value,  group: 'counters', emoji: '💡' },
      { key: 'sharpenRoundsDone', label: 'Sharpen Rounds',       value: _counters.sharpenRoundsDone.value, group: 'counters', emoji: '🔪' },
      { key: 'planHealthChecks',  label: 'PHI Checks',           value: _counters.planHealthChecks.value,  group: 'counters', emoji: '🩺' },
      // ── Fun group ────────────────────────────────────────────────────────────
      { key: 'feedbackSent',      label: 'Feedback Sent',        value: _counters.feedbackSent.value,      group: 'fun',      emoji: '💬' },
      { key: 'tombstone',         label: 'Tombstone',            value: `${daysSinceStart.value} days strong!`, group: 'fun', emoji: '🪦' },
    ]
    return rows
  })

  /** The "headline" field shown in the tile thumbnail (days alive). */
  const headline = computed<SemMetadataField>(
    () => fields.value.find(f => f.key === 'daysAlive') ?? fields.value[0],
  )

  function bump(key: CounterKey, delta = 1): void {
    const r = _counters[key] as ReturnType<typeof ref<number>> | undefined
    if (!r) return
    r.value = (r.value ?? 0) + delta
    try { localStorage.setItem(LS_PREFIX + key, String(r.value)) } catch { /* storage full */ }
  }

  function resetCounter(key: CounterKey, to = 0): void {
    const r = _counters[key] as ReturnType<typeof ref<number>> | undefined
    if (!r) return
    r.value = to
    try { localStorage.setItem(LS_PREFIX + key, String(to)) } catch { /* storage full */ }
  }

  function resetAllCounters(): void {
    for (const k of COUNTER_KEYS) resetCounter(k, 0)
  }

  return {
    fields,
    headline,
    daysSinceStart,
    daysSinceUpdate,
    componentCount:   COMPONENT_COUNT,
    composableCount:  COMPOSABLE_COUNT,
    glossaryCount:    PLANGUAGE_CONCEPTS,
    bump,
    resetCounter,
    resetAllCounters,
  }
}
