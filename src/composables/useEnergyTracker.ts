// UNIT_TYPE=Composable
// Feature #97 — Spec "Energy Level" Tracker
import { ref, computed } from 'vue'

export type EnergyLevel = '😴' | '😐' | '🔥'

interface EnergyRecord {
  specKey: string
  level: EnergyLevel
  timestamp: string
}

const STORAGE_KEY = 'sem-energy-records'
const MAX_RECORDS = 5

function loadFromStorage(): EnergyRecord[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as EnergyRecord[]
  } catch {
    return []
  }
}

function saveToStorage(records: EnergyRecord[]): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  } catch { /* no-op */ }
}

export function useEnergyTracker() {
  const records = ref<EnergyRecord[]>(loadFromStorage())
  const currentSpecKey = ref<string>('')

  function setSpecKey(key: string): void {
    currentSpecKey.value = key
  }

  function recordEnergy(level: EnergyLevel): void {
    const entry: EnergyRecord = {
      specKey: currentSpecKey.value,
      level,
      timestamp: new Date().toISOString(),
    }
    // Prepend and cap at 5 (newest first)
    records.value = [entry, ...records.value].slice(0, MAX_RECORDS)
    saveToStorage(records.value)
  }

  const latestRecord = computed<EnergyRecord | null>(() =>
    records.value[0] ?? null,
  )

  const aggregateSummary = computed(() => {
    const counts: Record<EnergyLevel, number> = { '😴': 0, '😐': 0, '🔥': 0 }
    for (const r of records.value) {
      counts[r.level] = (counts[r.level] ?? 0) + 1
    }

    // Tie-break: 🔥 > 😐 > 😴
    let dominant: EnergyLevel = '😴'
    if (counts['😐'] > counts['😴']) dominant = '😐'
    if (counts['🔥'] >= counts['😐'] && counts['🔥'] > counts['😴']) dominant = '🔥'
    if (counts['🔥'] > counts['😐']) dominant = '🔥'

    return {
      '😴': counts['😴'],
      '😐': counts['😐'],
      '🔥': counts['🔥'],
      dominant,
    }
  })

  return { records, currentSpecKey, setSpecKey, recordEnergy, latestRecord, aggregateSummary }
}
