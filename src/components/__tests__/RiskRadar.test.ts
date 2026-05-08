// UNIT_TYPE=Widget
// Tests for RiskRadar.vue — Feature #27: Evo Step Risk Radar

import { describe, test, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RiskRadar from '../RiskRadar.vue'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ALL_ZERO = { complexity: 0, dependencies: 0, resource: 0, uncertainty: 0 }
const ALL_HALF = { complexity: 0.5, dependencies: 0.5, resource: 0.5, uncertainty: 0.5 }
const ALL_ONE  = { complexity: 1.0, dependencies: 1.0, resource: 1.0, uncertainty: 1.0 }
const MIXED    = { complexity: 0.8, dependencies: 0.3, resource: 0.8, uncertainty: 0.55 }

// ── Mini mode ─────────────────────────────────────────────────────────────────

describe('RiskRadar — mini mode (default)', () => {
  test('renders an SVG element', () => {
    const wrapper = mount(RiskRadar, { props: { scores: ALL_HALF } })
    const svg = wrapper.find('svg')
    expect(svg.exists()).toBe(true)
  })

  test('SVG has viewBox="0 0 36 36" by default', () => {
    const wrapper = mount(RiskRadar, { props: { scores: ALL_HALF } })
    const svg = wrapper.find('svg')
    expect(svg.attributes('viewBox')).toBe('0 0 36 36')
  })

  test('SVG width and height are 36 by default', () => {
    const wrapper = mount(RiskRadar, { props: { scores: ALL_HALF } })
    const svg = wrapper.find('svg')
    expect(svg.attributes('width')).toBe('36')
    expect(svg.attributes('height')).toBe('36')
  })

  test('contains a <polygon> element', () => {
    const wrapper = mount(RiskRadar, { props: { scores: ALL_HALF } })
    const polygon = wrapper.find('polygon')
    expect(polygon.exists()).toBe(true)
  })

  test('polygon has points attribute', () => {
    const wrapper = mount(RiskRadar, { props: { scores: ALL_HALF } })
    const polygon = wrapper.find('polygon')
    expect(polygon.attributes('points')).toBeTruthy()
  })

  test('polygon fill is red at 25% opacity', () => {
    const wrapper = mount(RiskRadar, { props: { scores: ALL_HALF } })
    const polygon = wrapper.find('polygon')
    expect(polygon.attributes('fill')).toBe('rgba(239, 68, 68, 0.25)')
  })

  test('polygon stroke is #ef4444', () => {
    const wrapper = mount(RiskRadar, { props: { scores: ALL_HALF } })
    const polygon = wrapper.find('polygon')
    expect(polygon.attributes('stroke')).toBe('#ef4444')
  })

  test('no axis labels visible in mini mode', () => {
    const wrapper = mount(RiskRadar, { props: { scores: ALL_HALF, expanded: false } })
    const texts = wrapper.findAll('text')
    // In mini mode there should be no text elements at all
    expect(texts.length).toBe(0)
  })

  test('single dashed ring (circle) visible in mini mode', () => {
    const wrapper = mount(RiskRadar, { props: { scores: ALL_HALF, expanded: false } })
    const circles = wrapper.findAll('circle')
    expect(circles.length).toBe(1)
  })
})

// ── Expanded mode ─────────────────────────────────────────────────────────────

describe('RiskRadar — expanded mode (size=180)', () => {
  test('renders SVG with viewBox="0 0 180 180"', () => {
    const wrapper = mount(RiskRadar, {
      props: { scores: ALL_HALF, size: 180, expanded: true },
    })
    const svg = wrapper.find('svg')
    expect(svg.attributes('viewBox')).toBe('0 0 180 180')
  })

  test('SVG width and height are 180', () => {
    const wrapper = mount(RiskRadar, {
      props: { scores: ALL_HALF, size: 180, expanded: true },
    })
    const svg = wrapper.find('svg')
    expect(svg.attributes('width')).toBe('180')
    expect(svg.attributes('height')).toBe('180')
  })

  test('contains a <polygon> element in expanded mode', () => {
    const wrapper = mount(RiskRadar, {
      props: { scores: ALL_HALF, size: 180, expanded: true },
    })
    expect(wrapper.find('polygon').exists()).toBe(true)
  })

  test('renders axis labels in expanded mode', () => {
    const wrapper = mount(RiskRadar, {
      props: { scores: ALL_HALF, size: 180, expanded: true },
    })
    const texts = wrapper.findAll('text')
    const textContents = texts.map((t) => t.text())
    expect(textContents).toContain('Complexity')
    expect(textContents).toContain('Dependencies')
    expect(textContents).toContain('Resource')
    expect(textContents).toContain('Uncertainty')
  })

  test('renders three background rings in expanded mode', () => {
    const wrapper = mount(RiskRadar, {
      props: { scores: ALL_HALF, size: 180, expanded: true },
    })
    // 3 rings at 25%, 50%, 75%
    const circles = wrapper.findAll('circle')
    expect(circles.length).toBe(3)
  })

  test('renders score percentage labels in expanded mode', () => {
    const wrapper = mount(RiskRadar, {
      props: { scores: MIXED, size: 180, expanded: true },
    })
    const texts = wrapper.findAll('text')
    const textContents = texts.map((t) => t.text())
    // 80% complexity, 30% dependencies, 80% resource, 55% uncertainty
    expect(textContents.some((t) => t.includes('80%'))).toBe(true)
    expect(textContents.some((t) => t.includes('30%'))).toBe(true)
    expect(textContents.some((t) => t.includes('55%'))).toBe(true)
  })

  test('axis labels are absent in mini mode', () => {
    const wrapper = mount(RiskRadar, {
      props: { scores: ALL_HALF, size: 36, expanded: false },
    })
    const texts = wrapper.findAll('text')
    expect(texts.length).toBe(0)
  })
})

// ── Score = 1.0 on all axes → polygon at outer radius ─────────────────────────

describe('RiskRadar — score boundary: all 1.0', () => {
  test('polygon points match outer radius when all scores are 1.0 (mini)', () => {
    const wrapper = mount(RiskRadar, {
      props: { scores: ALL_ONE, size: 36, expanded: false },
    })
    const polygon = wrapper.find('polygon')
    const points = polygon.attributes('points') ?? ''
    // outer radius = 15, centre = 18
    // top axis (0°): x=18, y=3    → "18,3"
    // right axis (90°): x=33, y=18  → "33,18"
    // bottom axis (180°): x=18, y=33 → "18,33"
    // left axis (270°): x=3, y=18   → "3,18"
    expect(points).toContain('18,3')
    expect(points).toContain('33,18')
    expect(points).toContain('18,33')
    expect(points).toContain('3,18')
  })

  test('polygon points match outer radius when all scores are 1.0 (expanded)', () => {
    const wrapper = mount(RiskRadar, {
      props: { scores: ALL_ONE, size: 180, expanded: true },
    })
    const polygon = wrapper.find('polygon')
    const points = polygon.attributes('points') ?? ''
    // outer radius = 75, centre = 90
    // top: 90, 15  right: 165, 90  bottom: 90, 165  left: 15, 90
    expect(points).toContain('90,15')
    expect(points).toContain('165,90')
    expect(points).toContain('90,165')
    expect(points).toContain('15,90')
  })

  test('polygon collapses to centre point when all scores are 0.0', () => {
    const wrapper = mount(RiskRadar, {
      props: { scores: ALL_ZERO, size: 36, expanded: false },
    })
    const polygon = wrapper.find('polygon')
    const points = polygon.attributes('points') ?? ''
    // All 4 points should be at centre (18,18)
    const pairs = points.trim().split(' ')
    for (const pair of pairs) {
      expect(pair).toBe('18,18')
    }
  })
})
