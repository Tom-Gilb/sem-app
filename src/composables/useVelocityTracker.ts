// UNIT_TYPE=Composable
// Feature #114 — Spec Velocity Tracker
import { ref, computed, onMounted } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface VelocityEntry {
  id: string
  name: string
  history: { timestamp: number; statusRaw: string; statusNum: number }[]
  sparklinePoints: string // SVG polyline points, normalized to 40×20 viewBox
  trend: '↑' | '→' | '↓'
}

const STORAGE_KEY = 'sem-velocity-v1'

export function parseStatusNum(status: string): number {
  const match = status.match(/(\d[\d,.]*)/)
  if (!match) return 0
  const parsed = parseFloat(match[1].replace(/,/g, ''))
  return isNaN(parsed) ? 0 : parsed
}

export function buildSparklinePoints(history: { statusNum: number }[]): string {
  if (history.length === 0) return ''
  if (history.length === 1) {
    const y = 20 - 10 // center vertically when single point
    return `0,${y} 40,${y}`
  }
  const nums = history.map(h => h.statusNum)
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  const range = max - min === 0 ? 1 : max - min
  return history
    .map((h, i) => {
      const x = (i / (history.length - 1)) * 40
      const y = 20 - ((h.statusNum - min) / range) * 20
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

export function computeTrend(history: { statusNum: number }[]): '↑' | '→' | '↓' {
  if (history.length < 2) return '→'
  const first = history[0].statusNum
  const last = history[history.length - 1].statusNum
  if (last > first) return '↑'
  if (last < first) return '↓'
  return '→'
}

type StoredHistory = Record<string, { timestamp: number; statusRaw: string; statusNum: number }[]>

export function useVelocityTracker(blocks: SpecBlock[]) {
  const historyMap = ref<StoredHistory>({})

  function loadHistory(): StoredHistory {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (!raw) return {}
      return JSON.parse(raw) as StoredHistory
    } catch {
      return {}
    }
  }

  function saveHistory(map: StoredHistory): void {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map))
    } catch {
      // sessionStorage not available
    }
  }

  function recordSnapshot(): void {
    const map = { ...historyMap.value }
    for (const block of blocks) {
      for (const v of block.values) {
        if (!map[v.id]) map[v.id] = []
        map[v.id] = [
          ...map[v.id],
          {
            timestamp: Date.now(),
            statusRaw: v.status ?? '',
            statusNum: parseStatusNum(v.status ?? ''),
          },
        ]
      }
    }
    historyMap.value = map
    saveHistory(map)
  }

  onMounted(() => {
    historyMap.value = loadHistory()
    recordSnapshot()
  })

  const entries = computed<VelocityEntry[]>(() => {
    const result: VelocityEntry[] = []
    for (const block of blocks) {
      for (const v of block.values) {
        const history = historyMap.value[v.id] ?? []
        result.push({
          id: v.id,
          name: v.id,
          history,
          sparklinePoints: buildSparklinePoints(history),
          trend: computeTrend(history),
        })
      }
    }
    return result
  })

  const velocityScore = computed<number>(() => {
    const all = entries.value
    if (all.length === 0) return 0
    const improving = all.filter(e => e.history.length >= 2 && e.trend === '↑').length
    return Math.round((improving / all.length) * 100)
  })

  const overallTrend = computed<'↑' | '→' | '↓'>(() => {
    const all = entries.value
    const up = all.filter(e => e.trend === '↑').length
    const down = all.filter(e => e.trend === '↓').length
    if (up > down && up > all.length - up - down) return '↑'
    if (down > up && down > all.length - up - down) return '↓'
    return '→'
  })

  function clearHistory(): void {
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      // no-op
    }
    historyMap.value = {}
  }

  const copied = ref(false)

  async function copyMarkdown(): Promise<void> {
    const header = '| Name | Snapshots | Trend |'
    const sep = '|---|---|---|'
    const rows = entries.value.map(e => `| ${e.name} | ${e.history.length} | ${e.trend} |`)
    const text = [header, sep, ...rows].join('\n')
    try {
      await navigator.clipboard.writeText(text)
      copied.value = true
      setTimeout(() => { copied.value = false }, 2000)
    } catch {
      // clipboard not available
    }
  }

  return {
    entries,
    velocityScore,
    overallTrend,
    recordSnapshot,
    clearHistory,
    copyMarkdown,
    copied,
  }
}
