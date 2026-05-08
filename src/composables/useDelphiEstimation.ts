// UNIT_TYPE=Composable
// Feature #141 — Spec "delphi estimation"
import { ref } from 'vue'
import type { SpecBlock } from '../types/spec'

// ── Spec #141 interface ────────────────────────────────────────────────────────
export interface DelphiEntry {
  id: string
  name: string
  round1: number | null
  round2: number | null
  round3: number | null
  consensus: number | null  // round3 value if non-null
  unit: string              // extracted from scale field or 'units'
}

// ── Legacy interface (kept for backward compatibility) ─────────────────────────
export interface DelphiRound {
  roundNumber: 1 | 2 | 3
  estimates: number[]   // 3 anonymous estimates
  median: number
  spread: number        // max - min
}

export interface DelphiLegacyEntry {
  blockId: string
  blockName: string
  rounds: DelphiRound[]
  consensus: number      // median of round 3 estimates
  converged: boolean     // round 3 spread ≤ round 1 spread * 0.5
  unit: string           // extracted from Scale field, or "units"
}

/** Compute the median of a sorted (or unsorted) array of numbers */
function computeMedian(nums: number[]): number {
  if (nums.length === 0) return 0
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

/** Extract a unit string from a Scale field. Returns "units" if none found. */
function extractUnit(scale: string): string {
  if (!scale?.trim()) return 'units'
  // Try to find a unit-like word: look for patterns like "in X", "per X", or just last word
  const match = scale.match(/\b(per\s+\w+|\w+s?)\s*$/i)
  return match ? match[0].trim() : 'units'
}

function makeRound(roundNumber: 1 | 2 | 3, estimates: number[]): DelphiRound {
  const median = computeMedian(estimates)
  const spread = estimates.length > 0 ? Math.max(...estimates) - Math.min(...estimates) : 0
  return { roundNumber, estimates, median, spread }
}

function buildInitialLegacyEntry(blockId: string, blockName: string, unit: string): DelphiLegacyEntry {
  const round1 = makeRound(1, [0, 0, 0])
  const round2 = makeRound(2, [0, 0, 0])
  const round3 = makeRound(3, [0, 0, 0])
  return {
    blockId,
    blockName,
    rounds: [round1, round2, round3],
    consensus: 0,
    converged: false,
    unit,
  }
}

export function useDelphiEstimation(blocks: SpecBlock[]) {
  const allValues = blocks.flatMap(b => b.values)

  // ── Spec #141 API ──────────────────────────────────────────────────────────
  const entries = ref<DelphiEntry[]>(
    allValues.map(v => ({
      id: v.id,
      name: v.id,
      round1: null,
      round2: null,
      round3: null,
      consensus: null,
      unit: extractUnit(v.scale),
    }))
  )

  const currentRound = ref<1 | 2 | 3>(1)

  function submitRound(id: string, value: number): void {
    const entry = entries.value.find(e => e.id === id)
    if (!entry) return
    const round = currentRound.value
    if (round === 1) entry.round1 = value
    else if (round === 2) entry.round2 = value
    else if (round === 3) {
      entry.round3 = value
      entry.consensus = value
    }
  }

  function advanceRound(): void {
    if (currentRound.value < 3) {
      currentRound.value = (currentRound.value + 1) as 1 | 2 | 3
    }
  }

  function consensus(id: string): number | null {
    const entry = entries.value.find(e => e.id === id)
    return entry?.consensus ?? null
  }

  function convergenceTrend(_id: string): string {
    return 'Single-user: no consensus needed'
  }

  // ── Legacy API (kept for backward compatibility) ───────────────────────────
  const legacyEntries = ref<DelphiLegacyEntry[]>(
    allValues.map(v => buildInitialLegacyEntry(v.id, v.id, extractUnit(v.scale)))
  )

  function getLegacyEntry(blockId: string): DelphiLegacyEntry | undefined {
    return legacyEntries.value.find(e => e.blockId === blockId)
  }

  function recalcEntry(entry: DelphiLegacyEntry): void {
    for (const round of entry.rounds) {
      round.median = computeMedian(round.estimates)
      round.spread = round.estimates.length > 0
        ? Math.max(...round.estimates) - Math.min(...round.estimates)
        : 0
    }
    entry.consensus = entry.rounds[2].median
    entry.converged = entry.rounds[2].spread <= entry.rounds[0].spread * 0.5
  }

  function updateEstimate(
    blockId: string,
    roundNumber: 1 | 2 | 3,
    estimateIndex: number,
    value: number,
  ): void {
    const entry = getLegacyEntry(blockId)
    if (!entry) return
    const round = entry.rounds[roundNumber - 1]
    if (!round) return
    round.estimates[estimateIndex] = value
    recalcEntry(entry)
  }

  function openRound(blockId: string, roundNumber: 1 | 2 | 3): void {
    const entry = getLegacyEntry(blockId)
    if (!entry) return
    if (roundNumber === 1) return

    const prevRound = entry.rounds[roundNumber - 2]
    const currentRoundEntry = entry.rounds[roundNumber - 1]
    const prevMedian = prevRound.median

    const factors = roundNumber === 2 ? [0.8, 1.0, 1.2] : [0.9, 1.0, 1.1]
    currentRoundEntry.estimates = factors.map(f => Math.round(prevMedian * f * 100) / 100)
    recalcEntry(entry)
  }

  const copied = ref(false)

  async function copyMarkdown(): Promise<void> {
    const lines: string[] = []
    lines.push('| Name | Round 1 | Round 2 | Round 3 | Consensus |')
    lines.push('| --- | --- | --- | --- | --- |')
    for (const entry of entries.value) {
      const r1 = entry.round1 ?? '-'
      const r2 = entry.round2 ?? '-'
      const r3 = entry.round3 ?? '-'
      const cons = entry.consensus ?? '-'
      lines.push(`| ${entry.name} | ${r1} | ${r2} | ${r3} | ${cons} |`)
    }
    const text = lines.join('\n')
    try {
      await navigator.clipboard.writeText(text)
      copied.value = true
      setTimeout(() => { copied.value = false }, 2000)
    } catch {
      // clipboard not available
    }
  }

  return {
    // Spec #141 API
    entries,
    currentRound,
    submitRound,
    advanceRound,
    consensus,
    convergenceTrend,
    // Legacy API
    updateEstimate,
    openRound,
    copied,
    copyMarkdown,
  }
}
