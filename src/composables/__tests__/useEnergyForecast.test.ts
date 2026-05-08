import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { useEnergyForecast, useEnergyForecastSpec } from '../useEnergyForecast'

const mockStorage = {
  getItem: vi.fn(() => null as string | null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
}

beforeEach(() => {
  mockStorage.getItem.mockReturnValue(null)
  mockStorage.setItem.mockClear()
  mockStorage.removeItem.mockClear()
  vi.stubGlobal('sessionStorage', mockStorage)
})

describe('useEnergyForecast — default pattern (no storage data)', () => {
  it('returns empty array when steps is empty', () => {
    const { forecastPoints } = useEnergyForecast([])
    expect(forecastPoints.value).toHaveLength(0)
  })

  it('uses default pattern [high, high, mid, mid, low] when no storage data', () => {
    const steps = [
      { name: 'A' },
      { name: 'B' },
      { name: 'C' },
      { name: 'D' },
      { name: 'E' },
    ]
    const { forecastPoints } = useEnergyForecast(steps)
    const levels = forecastPoints.value.map((p) => p.forecastLevel)
    expect(levels).toEqual(['high', 'high', 'mid', 'mid', 'low'])
  })

  it('cycles the default pattern for more than 5 steps', () => {
    const steps = Array.from({ length: 7 }, (_, i) => ({ name: `S${i}` }))
    const { forecastPoints } = useEnergyForecast(steps)
    const levels = forecastPoints.value.map((p) => p.forecastLevel)
    expect(levels[0]).toBe('high')
    expect(levels[5]).toBe('high') // index 5 → 5 % 5 = 0 → high
    expect(levels[6]).toBe('high') // index 6 → 6 % 5 = 1 → high
  })

  it('returns hasWarning=false when default pattern has no low', () => {
    // 4 steps → default: high, high, mid, mid — no low
    const steps = [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }]
    const { hasWarning } = useEnergyForecast(steps)
    expect(hasWarning.value).toBe(false)
  })

  it('returns hasWarning=true when default pattern has low (5+ steps)', () => {
    const steps = Array.from({ length: 5 }, (_, i) => ({ name: `S${i}` }))
    const { hasWarning } = useEnergyForecast(steps)
    expect(hasWarning.value).toBe(true)
  })
})

describe('useEnergyForecast — svgPolylinePoints', () => {
  it('returns "30,60" for a single step (no storage data)', () => {
    const { svgPolylinePoints } = useEnergyForecast([{ name: 'Solo' }])
    expect(svgPolylinePoints.value).toBe('30,60')
  })

  it('returns empty string for empty steps', () => {
    const { svgPolylinePoints } = useEnergyForecast([])
    expect(svgPolylinePoints.value).toBe('')
  })

  it('scales x correctly for multiple steps (2 steps)', () => {
    const steps = [{ name: 'A' }, { name: 'B' }]
    const { svgPolylinePoints } = useEnergyForecast(steps)
    // spacing = 460 / (2-1) = 460; x0=30, x1=490
    const parts = svgPolylinePoints.value.split(' ')
    expect(parts).toHaveLength(2)
    expect(parts[0]).toMatch(/^30,/)
    expect(parts[1]).toMatch(/^490,/)
  })

  it('scales x correctly for 3 steps', () => {
    const steps = [{ name: 'A' }, { name: 'B' }, { name: 'C' }]
    const { svgPolylinePoints } = useEnergyForecast(steps)
    // spacing = 460 / 2 = 230; x0=30, x1=260, x2=490
    const parts = svgPolylinePoints.value.split(' ')
    expect(parts[0]).toMatch(/^30,/)
    expect(parts[1]).toMatch(/^260,/)
    expect(parts[2]).toMatch(/^490,/)
  })

  it('format is "x,y" pairs separated by spaces', () => {
    const steps = [{ name: 'A' }, { name: 'B' }]
    const { svgPolylinePoints } = useEnergyForecast(steps)
    const pairs = svgPolylinePoints.value.split(' ')
    for (const pair of pairs) {
      expect(pair).toMatch(/^\d+(\.\d+)?,\d+(\.\d+)?$/)
    }
  })
})

describe('useEnergyForecast — fatigue model', () => {
  it('starts at baseline with fatigue 0 (first step)', () => {
    mockStorage.getItem.mockReturnValue(JSON.stringify([{ level: '🔥' }]))
    const steps = [{ name: 'S0' }, { name: 'S1' }]
    const { forecastPoints } = useEnergyForecast(steps)
    expect(forecastPoints.value[0].forecastLevel).toBe('high')
  })

  it('drops one level at fatigue >= 2', () => {
    mockStorage.getItem.mockReturnValue(JSON.stringify([{ level: '🔥' }]))
    // Steps: S0(f=0→high), S1(f=1→high), S2(f=2→mid)
    const steps = [{ name: 'S0' }, { name: 'S1' }, { name: 'S2' }]
    const { forecastPoints } = useEnergyForecast(steps)
    expect(forecastPoints.value[2].forecastLevel).toBe('mid')
  })

  it('fatigue resets to 0 after step at index divisible by 3', () => {
    mockStorage.getItem.mockReturnValue(JSON.stringify([{ level: '🔥' }]))
    // Index 3 is divisible by 3 → fatigue resets → step 4 should be back to baseline
    const steps = Array.from({ length: 6 }, (_, i) => ({ name: `S${i}` }))
    const { forecastPoints } = useEnergyForecast(steps)
    // Step at index 3 resets fatigue; step at index 4 should not be at max fatigue
    const level4 = forecastPoints.value[4]?.forecastLevel
    expect(['high', 'mid']).toContain(level4)
  })

  it('warningStepIndices lists indices where forecastLevel is low', () => {
    mockStorage.getItem.mockReturnValue(JSON.stringify([{ level: '😴' }]))
    const steps = Array.from({ length: 3 }, (_, i) => ({ name: `S${i}` }))
    const { warningStepIndices } = useEnergyForecast(steps)
    expect(Array.isArray(warningStepIndices.value)).toBe(true)
    for (const idx of warningStepIndices.value) {
      expect(typeof idx).toBe('number')
    }
  })

  it('hasWarning is false when no low forecast', () => {
    mockStorage.getItem.mockReturnValue(JSON.stringify([{ level: '🔥' }]))
    // Only 1 step, fatigue=0, baseline=high → high
    const { hasWarning } = useEnergyForecast([{ name: 'Solo' }])
    expect(hasWarning.value).toBe(false)
  })

  it('computes dominant baseline from last 3 records', () => {
    mockStorage.getItem.mockReturnValue(
      JSON.stringify([
        { level: '😐' },
        { level: '😐' },
        { level: '🔥' },
        { level: '🔥' }, // 4th record excluded from "last 3"
      ])
    )
    // Last 3: mid, mid, high → dominant = mid (2 > 1)
    const { forecastPoints } = useEnergyForecast([{ name: 'S0' }])
    expect(forecastPoints.value[0].forecastLevel).toBe('mid')
  })
})

// ── useEnergyForecastSpec (spec-compliant) ────────────────────────────────────

describe('useEnergyForecastSpec — empty steps → all 😐', () => {
  it('returns empty forecastPoints when steps ref is empty', () => {
    const steps = ref<{ id: string; name: string }[]>([])
    const { forecastPoints } = useEnergyForecastSpec(steps)
    expect(forecastPoints.value).toHaveLength(0)
  })

  it('forecasts all steps as 😐 when no storage data', () => {
    mockStorage.getItem.mockReturnValue(null)
    const steps = ref([{ id: 'a', name: 'Step A' }, { id: 'b', name: 'Step B' }])
    const { forecastPoints } = useEnergyForecastSpec(steps)
    for (const pt of forecastPoints.value) {
      expect(pt.forecastLevel).toBe('😐')
      expect(pt.numericValue).toBe(2)
    }
  })

  it('stepName and stepIndex are set correctly', () => {
    mockStorage.getItem.mockReturnValue(null)
    const steps = ref([{ id: 's1', name: 'Alpha' }, { id: 's2', name: 'Beta' }])
    const { forecastPoints } = useEnergyForecastSpec(steps)
    expect(forecastPoints.value[0].stepName).toBe('Alpha')
    expect(forecastPoints.value[0].stepIndex).toBe(0)
    expect(forecastPoints.value[1].stepName).toBe('Beta')
    expect(forecastPoints.value[1].stepIndex).toBe(1)
  })
})

describe('useEnergyForecastSpec — decay model', () => {
  it('applies decay: each step reduces by 0.1', () => {
    // All 🔥 records → trendAvg = 3; step 0 → 3.0, step 1 → 2.9, step 2 → 2.8
    mockStorage.getItem.mockReturnValue(JSON.stringify([
      { level: '🔥' }, { level: '🔥' }, { level: '🔥' },
    ]))
    const steps = ref([
      { id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' },
    ])
    const { forecastPoints } = useEnergyForecastSpec(steps)
    expect(forecastPoints.value[0].numericValue).toBeCloseTo(3.0)
    expect(forecastPoints.value[1].numericValue).toBeCloseTo(2.9)
    expect(forecastPoints.value[2].numericValue).toBeCloseTo(2.8)
  })

  it('numericValue never goes below 1.0', () => {
    // Low records, many steps → floor at 1.0
    mockStorage.getItem.mockReturnValue(JSON.stringify([{ level: '😴' }]))
    const steps = ref(Array.from({ length: 30 }, (_, i) => ({ id: `s${i}`, name: `S${i}` })))
    const { forecastPoints } = useEnergyForecastSpec(steps)
    for (const pt of forecastPoints.value) {
      expect(pt.numericValue).toBeGreaterThanOrEqual(1.0)
    }
  })

  it('level maps correctly: ≥2.5→🔥, ≥1.5→😐, <1.5→😴', () => {
    // trendAvg=3 → steps decay. After 6 steps (i=5): 3-0.5=2.5 → 🔥 boundary
    mockStorage.getItem.mockReturnValue(JSON.stringify([
      { level: '🔥' }, { level: '🔥' }, { level: '🔥' },
    ]))
    const steps = ref([
      { id: 'a', name: 'A' }, // 3.0 → 🔥
      { id: 'b', name: 'B' }, // 2.9 → 🔥
      { id: 'c', name: 'C' }, // 2.8 → 🔥
    ])
    const { forecastPoints } = useEnergyForecastSpec(steps)
    expect(forecastPoints.value[0].forecastLevel).toBe('🔥')
    expect(forecastPoints.value[1].forecastLevel).toBe('🔥')
    expect(forecastPoints.value[2].forecastLevel).toBe('🔥')
  })

  it('warnSteps only includes steps where numericValue ≤ 1.2', () => {
    // 😴 records → trendAvg=1; step 0 → 1.0 (≤1.2 → warn), step 1 → max(1, 0.9)=1.0 → also warn
    mockStorage.getItem.mockReturnValue(JSON.stringify([
      { level: '😴' }, { level: '😴' }, { level: '😴' },
    ]))
    const steps = ref([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }])
    const { warnSteps } = useEnergyForecastSpec(steps)
    for (const pt of warnSteps.value) {
      expect(pt.numericValue).toBeLessThanOrEqual(1.2)
    }
  })

  it('hasWarning is false when all steps are above 1.2', () => {
    mockStorage.getItem.mockReturnValue(JSON.stringify([
      { level: '🔥' }, { level: '🔥' },
    ]))
    const steps = ref([{ id: 'a', name: 'A' }])
    const { hasWarning } = useEnergyForecastSpec(steps)
    expect(hasWarning.value).toBe(false)
  })

  it('hasWarning is true when any step numericValue ≤ 1.2', () => {
    // Enough decay from 😴 baseline
    mockStorage.getItem.mockReturnValue(JSON.stringify([
      { level: '😴' }, { level: '😴' }, { level: '😴' },
    ]))
    const steps = ref([{ id: 'a', name: 'A' }])
    const { hasWarning } = useEnergyForecastSpec(steps)
    expect(hasWarning.value).toBe(true)
  })
})

describe('useEnergyForecastSpec — SVG helpers', () => {
  it('yForLevel returns 16 for 🔥, 40 for 😐, 64 for 😴', () => {
    const { yForLevel } = useEnergyForecastSpec(ref([]))
    expect(yForLevel('🔥')).toBe(16)
    expect(yForLevel('😐')).toBe(40)
    expect(yForLevel('😴')).toBe(64)
  })

  it('svgPoints format is "x,y x,y ..." pairs', () => {
    mockStorage.getItem.mockReturnValue(null)
    const steps = ref([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }])
    const { svgPoints } = useEnergyForecastSpec(steps)
    const pairs = svgPoints.value.split(' ')
    expect(pairs).toHaveLength(2)
    for (const pair of pairs) {
      expect(pair).toMatch(/^\d+(\.\d+)?,\d+(\.\d+)?$/)
    }
  })

  it('svgPoints x values are i*60+30', () => {
    mockStorage.getItem.mockReturnValue(null)
    const steps = ref([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }])
    const { svgPoints } = useEnergyForecastSpec(steps)
    const pairs = svgPoints.value.split(' ')
    expect(pairs[0]).toMatch(/^30,/)
    expect(pairs[1]).toMatch(/^90,/)
    expect(pairs[2]).toMatch(/^150,/)
  })

  it('svgWidth is max(200, steps.length * 60 + 20)', () => {
    mockStorage.getItem.mockReturnValue(null)
    const steps = ref([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }])
    const { svgWidth } = useEnergyForecastSpec(steps)
    expect(svgWidth.value).toBe(Math.max(200, 2 * 60 + 20))
  })

  it('svgWidth minimum is 200 for very few steps', () => {
    const steps = ref<{ id: string; name: string }[]>([])
    const { svgWidth } = useEnergyForecastSpec(steps)
    expect(svgWidth.value).toBe(200)
  })
})

describe('useEnergyForecastSpec — copyMarkdown', () => {
  it('copyMarkdown produces correct header', () => {
    mockStorage.getItem.mockReturnValue(null)
    const clipboardSpy = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText: clipboardSpy } })
    const steps = ref([{ id: 'a', name: 'Alpha' }])
    const { copyMarkdown } = useEnergyForecastSpec(steps)
    copyMarkdown()
    const written = clipboardSpy.mock.calls[0]?.[0] as string
    expect(written).toContain('## Energy Forecast')
    expect(written).toContain('| Step | Forecast |')
    expect(written).toContain('|---|---|')
  })

  it('copyMarkdown includes step name and emoji', () => {
    mockStorage.getItem.mockReturnValue(null)
    const clipboardSpy = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText: clipboardSpy } })
    const steps = ref([{ id: 'a', name: 'Alpha' }])
    const { copyMarkdown } = useEnergyForecastSpec(steps)
    copyMarkdown()
    const written = clipboardSpy.mock.calls[0]?.[0] as string
    expect(written).toContain('Alpha')
    expect(written).toMatch(/😐|🔥|😴/)
  })
})
