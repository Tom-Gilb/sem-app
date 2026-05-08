// UNIT_TYPE=Test
// Tests for EffortRing.vue — Feature #36: Evo Step Effort Breakdown Doughnut

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import EffortRing from '../EffortRing.vue'

describe('EffortRing.vue — Feature #36', () => {
  // ── viewBox and dimensions ────────────────────────────────────────────────

  it('renders SVG with correct viewBox for default size (32)', () => {
    const wrapper = mount(EffortRing, { props: { effortPercent: 40 } })
    const svg = wrapper.find('svg')
    expect(svg.exists()).toBe(true)
    expect(svg.attributes('viewBox')).toBe('0 0 32 32')
  })

  it('renders SVG with correct viewBox for custom size (64)', () => {
    const wrapper = mount(EffortRing, { props: { effortPercent: 40, size: 64 } })
    const svg = wrapper.find('svg')
    expect(svg.attributes('viewBox')).toBe('0 0 64 64')
  })

  it('SVG width and height equal size prop (default 32)', () => {
    const wrapper = mount(EffortRing, { props: { effortPercent: 50 } })
    const svg = wrapper.find('svg')
    expect(svg.attributes('width')).toBe('32')
    expect(svg.attributes('height')).toBe('32')
  })

  it('SVG width and height equal custom size (48)', () => {
    const wrapper = mount(EffortRing, { props: { effortPercent: 50, size: 48 } })
    const svg = wrapper.find('svg')
    expect(svg.attributes('width')).toBe('48')
    expect(svg.attributes('height')).toBe('48')
  })

  // ── Centre text ───────────────────────────────────────────────────────────

  it('centre text shows effortPercent value', () => {
    const wrapper = mount(EffortRing, { props: { effortPercent: 37 } })
    const text = wrapper.find('text')
    expect(text.exists()).toBe(true)
    expect(text.text()).toContain('37%')
  })

  it('centre text shows 0% for effortPercent = 0', () => {
    const wrapper = mount(EffortRing, { props: { effortPercent: 0 } })
    const text = wrapper.find('text')
    expect(text.text()).toContain('0%')
  })

  it('centre text shows 100% for effortPercent = 100', () => {
    const wrapper = mount(EffortRing, { props: { effortPercent: 100 } })
    const text = wrapper.find('text')
    expect(text.text()).toContain('100%')
  })

  // ── stroke-dasharray on progress circle ───────────────────────────────────

  it('stroke-dasharray attribute is present on the progress (foreground) circle', () => {
    const wrapper = mount(EffortRing, { props: { effortPercent: 50 } })
    // The second circle is the progress arc
    const circles = wrapper.findAll('circle')
    expect(circles.length).toBeGreaterThanOrEqual(2)
    const progressCircle = circles[1]
    const dashArray = progressCircle.attributes('stroke-dasharray')
    expect(dashArray).toBeTruthy()
  })

  it('stroke-dasharray contains two space-separated numbers', () => {
    const wrapper = mount(EffortRing, { props: { effortPercent: 25 } })
    const circles = wrapper.findAll('circle')
    const progressCircle = circles[1]
    const dashArray = progressCircle.attributes('stroke-dasharray') ?? ''
    const parts = dashArray.trim().split(' ')
    expect(parts.length).toBe(2)
    expect(parseFloat(parts[0])).toBeGreaterThan(0)
    expect(parseFloat(parts[1])).toBeGreaterThan(0)
  })

  // ── Boundary values ───────────────────────────────────────────────────────

  it('renders without error for effortPercent = 0 (background circle only filled)', () => {
    const wrapper = mount(EffortRing, { props: { effortPercent: 0 } })
    const circles = wrapper.findAll('circle')
    expect(circles.length).toBeGreaterThanOrEqual(2)
    const dashArray = circles[1].attributes('stroke-dasharray') ?? ''
    const parts = dashArray.trim().split(' ')
    // filled arc = 0, remaining = full circumference
    expect(parseFloat(parts[0])).toBe(0)
  })

  it('renders without error for effortPercent = 100 (full circle filled)', () => {
    const wrapper = mount(EffortRing, { props: { effortPercent: 100 } })
    const circles = wrapper.findAll('circle')
    expect(circles.length).toBeGreaterThanOrEqual(2)
    const dashArray = circles[1].attributes('stroke-dasharray') ?? ''
    const parts = dashArray.trim().split(' ')
    // filled arc ≈ circumference, remainder ≈ 0
    expect(parseFloat(parts[0])).toBeGreaterThan(parseFloat(parts[1]))
  })

  // ── Background circle ─────────────────────────────────────────────────────

  it('background circle has stroke #e5e7eb (gray-200)', () => {
    const wrapper = mount(EffortRing, { props: { effortPercent: 50 } })
    const circles = wrapper.findAll('circle')
    expect(circles[0].attributes('stroke')).toBe('#e5e7eb')
  })

  it('progress circle has stroke #6366f1 (indigo-500)', () => {
    const wrapper = mount(EffortRing, { props: { effortPercent: 50 } })
    const circles = wrapper.findAll('circle')
    expect(circles[1].attributes('stroke')).toBe('#6366f1')
  })

  // ── Transform (start at top) ──────────────────────────────────────────────

  it('progress circle has rotate(-90) transform to start arc at top', () => {
    const wrapper = mount(EffortRing, { props: { effortPercent: 50 } })
    const circles = wrapper.findAll('circle')
    const transform = circles[1].attributes('transform') ?? ''
    expect(transform).toContain('rotate(-90')
  })
})
