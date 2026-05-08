// UNIT_TYPE=Test
// Feature #56 — sparkline utility tests

import { describe, test, expect } from 'vitest'
import { sparklinePoints, trendDirection, trendColour } from '../sparkline'

describe('sparklinePoints', () => {
  test('empty array returns empty string', () => {
    expect(sparklinePoints([])).toBe('')
  })

  test('single value returns a single point string', () => {
    const result = sparklinePoints([50])
    // Default width=60, height=20 → single point at 30,10
    expect(result).toBe('30,10')
  })

  test('three values: first x=0, last x=60', () => {
    const result = sparklinePoints([0, 50, 100], 60, 20)
    const points = result.split(' ')
    expect(points).toHaveLength(3)
    const [x0] = points[0].split(',').map(Number)
    const [x2] = points[2].split(',').map(Number)
    expect(x0).toBe(0)
    expect(x2).toBe(60)
  })

  test('flat line: both points at same y', () => {
    const result = sparklinePoints([80, 80], 60, 20)
    const points = result.split(' ')
    const y0 = Number(points[0].split(',')[1])
    const y1 = Number(points[1].split(',')[1])
    expect(y0).toBe(y1)
  })
})

describe('trendDirection', () => {
  test('increasing by more than 5 returns up', () => {
    expect(trendDirection([60, 80])).toBe('up')
  })

  test('decreasing by more than 5 returns down', () => {
    expect(trendDirection([80, 60])).toBe('down')
  })

  test('change within 5 points returns stable', () => {
    expect(trendDirection([70, 72])).toBe('stable')
  })

  test('single value returns stable', () => {
    expect(trendDirection([70])).toBe('stable')
  })
})

describe('trendColour', () => {
  test('up returns green colour starting with #10', () => {
    expect(trendColour('up')).toMatch(/^#10/)
  })

  test('down returns red colour starting with #ef', () => {
    expect(trendColour('down')).toMatch(/^#ef/)
  })

  test('stable returns slate colour', () => {
    expect(trendColour('stable')).toBe('#94a3b8')
  })
})
