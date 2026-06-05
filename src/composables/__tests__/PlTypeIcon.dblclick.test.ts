/**
 * Regression tests — PlTypeIcon double-click → GlyphDataPanel bridge (DD-013).
 *
 * Architecture v3 (2026-06-02): TWO-LAYER dblclick detection.
 *   Layer A (global, primary): App.vue registers `document.addEventListener('dblclick',
 *     handler, true)` in CAPTURE phase. Handler calls glyphTypeFromDblClick(e) which
 *     walks up the DOM via Element.closest('[data-pl-type]'). PlTypeIcon exposes
 *     `data-pl-type` on its root span. Capture phase fires BEFORE child handlers —
 *     cannot be blocked by stopPropagation on buttons, table cells, or other wrappers.
 *   Layer B (per-icon, backup): PlTypeIcon's @dblclick.prevent calls openGlyphPanel()
 *     directly. Works whenever DOM event bubbling reaches the span.
 *
 * WHY THESE TESTS WORK IN HAPPY-DOM:
 *   The prior approach tried to trigger @dblclick via wrapper.trigger('dblclick').
 *   happy-dom does not synthesise dblclick events that Vue's @dblclick handler
 *   catches (known limitation). This test file instead:
 *   (a) Tests glyphTypeFromDblClick() directly — a pure function, zero Vue coupling.
 *   (b) Tests that PlTypeIcon renders the correct data-pl-type attribute.
 *   Both layers are fully verifiable in unit tests. The physical user gesture
 *   (double-clicking a mouse) remains the only thing that needs Playwright.
 *
 * WHAT THESE TESTS GUARD:
 *   - glyphTypeFromDblClick correctly identifies type from [data-pl-type] attribute
 *   - glyphTypeFromDblClick returns null for elements without the attribute
 *   - glyphTypeFromDblClick returns null for invalid type strings (injection guard)
 *   - glyphTypeFromDblClick works when target is a CHILD of the [data-pl-type] element
 *     (the real case — dblclick fires on the SVG inside the span)
 *   - PlTypeIcon sets data-pl-type when noDetailClick is false (the default)
 *   - PlTypeIcon removes data-pl-type when noDetailClick=true
 *   - Tooltip discloses the double-click affordance (DD-009)
 *   - End-to-end: glyphTypeFromDblClick → openGlyphPanel → CustomEvent dispatched
 *
 * Fix before shipping if ANY test here fails.
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PlTypeIcon from '../../components/icons/PlTypeIcon.vue'
import {
  glyphTypeFromDblClick,
  openGlyphPanel,
  GLYPH_PANEL_OPEN_EVENT,
} from '../useGlyphPanel'

/** Collect CustomEvents from document; returns array + cleanup. */
function listenOnDocument(eventName: string) {
  const collected: CustomEvent[] = []
  const handler = (e: Event) => collected.push(e as CustomEvent)
  document.addEventListener(eventName, handler)
  return {
    events: collected,
    cleanup: () => document.removeEventListener(eventName, handler),
  }
}

/** Create a span with [data-pl-type] attached to document.body. Returns el + cleanup. */
function makePlTypeSpan(type: string, child = false) {
  const parent = document.createElement('span')
  parent.setAttribute('data-pl-type', type)

  if (child) {
    // Simulate real usage: dblclick fires on the SVG inside the span
    const inner = document.createElement('svg')
    parent.appendChild(inner)
  }
  document.body.appendChild(parent)
  return {
    el: parent,
    target: child ? (parent.firstElementChild as HTMLElement) : parent,
    cleanup: () => parent.remove(),
  }
}

// ── Layer A: glyphTypeFromDblClick() ──────────────────────────────────────────

describe('glyphTypeFromDblClick — Layer A detection logic (DD-013)', () => {
  it('returns the type when dblclick target IS the [data-pl-type] span', () => {
    const { el, cleanup } = makePlTypeSpan('value')
    const evt = new MouseEvent('dblclick', { bubbles: true })
    Object.defineProperty(evt, 'target', { value: el })
    expect(glyphTypeFromDblClick(evt)).toBe('value')
    cleanup()
  })

  it('returns the type when dblclick target is a CHILD (SVG inside span)', () => {
    // The real case: dblclick fires on the SVG element, not the wrapper span.
    const { target, cleanup } = makePlTypeSpan('constraint', true)
    const evt = new MouseEvent('dblclick', { bubbles: true })
    Object.defineProperty(evt, 'target', { value: target })
    expect(glyphTypeFromDblClick(evt)).toBe('constraint')
    cleanup()
  })

  it('returns null when no [data-pl-type] ancestor exists', () => {
    const div = document.createElement('div')
    document.body.appendChild(div)
    const evt = new MouseEvent('dblclick', { bubbles: true })
    Object.defineProperty(evt, 'target', { value: div })
    expect(glyphTypeFromDblClick(evt)).toBeNull()
    div.remove()
  })

  it('returns null for unknown type strings (injection guard)', () => {
    const { el, cleanup } = makePlTypeSpan('malicious-type')
    const evt = new MouseEvent('dblclick', { bubbles: true })
    Object.defineProperty(evt, 'target', { value: el })
    expect(glyphTypeFromDblClick(evt)).toBeNull()
    cleanup()
  })

  it('covers all 8 Planguage types', () => {
    const types = [
      'value', 'function', 'constraint', 'solution',
      'stakeholder', 'evo-step', 'task', 'resource',
    ] as const
    for (const type of types) {
      const { el, cleanup } = makePlTypeSpan(type)
      const evt = new MouseEvent('dblclick', { bubbles: true })
      Object.defineProperty(evt, 'target', { value: el })
      expect(glyphTypeFromDblClick(evt), `type=${type}`).toBe(type)
      cleanup()
    }
  })

  it('returns null when target is null (defensive)', () => {
    const evt = new MouseEvent('dblclick')
    Object.defineProperty(evt, 'target', { value: null })
    expect(glyphTypeFromDblClick(evt)).toBeNull()
  })
})

// ── End-to-end: glyphTypeFromDblClick → openGlyphPanel → CustomEvent ─────────

describe('Layer A end-to-end: detect type → openGlyphPanel → CustomEvent dispatched', () => {
  it('dispatches glyph-panel:open when a valid [data-pl-type] element is dblclicked', () => {
    const { el, cleanup } = makePlTypeSpan('solution')
    const evt = new MouseEvent('dblclick', { bubbles: true })
    Object.defineProperty(evt, 'target', { value: el })

    const type = glyphTypeFromDblClick(evt)

    const { events, cleanup: cleanupListener } = listenOnDocument(GLYPH_PANEL_OPEN_EVENT)
    if (type) openGlyphPanel(type)
    cleanupListener()
    cleanup()

    expect(events).toHaveLength(1)
    expect(events[0].detail).toBe('solution')
  })

  it('does NOT dispatch when dblclick is outside any PlTypeIcon', () => {
    const div = document.createElement('div')
    document.body.appendChild(div)
    const evt = new MouseEvent('dblclick', { bubbles: true })
    Object.defineProperty(evt, 'target', { value: div })

    const type = glyphTypeFromDblClick(evt)

    const { events, cleanup } = listenOnDocument(GLYPH_PANEL_OPEN_EVENT)
    if (type) openGlyphPanel(type)
    cleanup()
    div.remove()

    expect(events).toHaveLength(0)
  })
})

// ── Layer B: data-pl-type attribute on PlTypeIcon component ───────────────────

describe('PlTypeIcon — data-pl-type attribute for Layer A detection (DD-013)', () => {
  it('sets data-pl-type attribute on root span by default', () => {
    const wrapper = mount(PlTypeIcon, { props: { plType: 'value' } })
    expect(wrapper.find('span').attributes('data-pl-type')).toBe('value')
    wrapper.unmount()
  })

  it('sets correct data-pl-type for all 8 types', () => {
    const types = [
      'value', 'function', 'constraint', 'solution',
      'stakeholder', 'evo-step', 'task', 'resource',
    ] as const
    for (const type of types) {
      const wrapper = mount(PlTypeIcon, { props: { plType: type } })
      expect(wrapper.find('span').attributes('data-pl-type'), `type=${type}`).toBe(type)
      wrapper.unmount()
    }
  })

  it('omits data-pl-type when noDetailClick=true (parent owns dblclick)', () => {
    const wrapper = mount(PlTypeIcon, {
      props: { plType: 'function', noDetailClick: true },
    })
    expect(wrapper.find('span').attributes('data-pl-type')).toBeUndefined()
    wrapper.unmount()
  })
})

// ── Tooltip content (DD-009 Interaction Disclosure) ───────────────────────────

describe('PlTypeIcon — tooltip discloses double-click affordance (DD-009)', () => {
  it('tooltip includes "Double-click for Glyph Detail" by default', () => {
    const wrapper = mount(PlTypeIcon, { props: { plType: 'constraint' } })
    expect(wrapper.find('span').attributes('title')).toContain('Double-click for Glyph Detail')
    wrapper.unmount()
  })

  it('tooltip omits double-click suffix when noDetailClick=true', () => {
    const wrapper = mount(PlTypeIcon, {
      props: { plType: 'constraint', noDetailClick: true },
    })
    expect(wrapper.find('span').attributes('title')).not.toContain('Double-click for Glyph Detail')
    wrapper.unmount()
  })

  it('caller-supplied title still gets the double-click suffix appended', () => {
    const wrapper = mount(PlTypeIcon, {
      props: { plType: 'value', title: 'Custom label' },
    })
    const title = wrapper.find('span').attributes('title')
    expect(title).toContain('Custom label')
    expect(title).toContain('Double-click for Glyph Detail')
    wrapper.unmount()
  })
})
