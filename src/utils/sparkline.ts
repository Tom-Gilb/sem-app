// UNIT_TYPE=Utility
// Feature #56 — SVG sparkline generator for quality trend
export interface SparkPoint { x: number; y: number }

/**
 * Generates SVG polyline points string for a sparkline.
 * values: array of 0-100 numbers
 * width: total SVG width (default 60)
 * height: total SVG height (default 20)
 */
export function sparklinePoints(values: number[], width = 60, height = 20): string {
  if (values.length === 0) return ''
  if (values.length === 1) return `${width / 2},${height / 2}`
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const step = width / (values.length - 1)
  return values
    .map((v, i) => {
      const x = Math.round(i * step)
      const y = Math.round(height - ((v - min) / range) * (height - 2) - 1)
      return `${x},${y}`
    })
    .join(' ')
}

/**
 * Returns 'up', 'down', or 'stable' trend from a series of values.
 */
export function trendDirection(values: number[]): 'up' | 'down' | 'stable' {
  if (values.length < 2) return 'stable'
  const first = values[0]
  const last = values[values.length - 1]
  if (last > first + 5) return 'up'
  if (last < first - 5) return 'down'
  return 'stable'
}

/**
 * Returns colour class for a trend direction.
 */
export function trendColour(dir: 'up' | 'down' | 'stable'): string {
  return dir === 'up' ? '#10b981' : dir === 'down' ? '#ef4444' : '#94a3b8'
}
