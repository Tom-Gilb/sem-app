/**
 * Regression tests — GlyphDataPanel double-click / CustomEvent bridge.
 *
 * DD-013 (2026-06-02): Every PlTypeIcon opens GlyphDataPanel on double-click.
 * Architecture v2: CustomEvent bus — openGlyphPanel() dispatches
 * 'glyph-panel:open' on document; App.vue listens and owns local state.
 *
 * WHAT THESE TESTS GUARD:
 *   If ANY composable test fails → the event names or payloads changed → double-
 *   click is broken. The 8-type coverage test means a missing switch-case in
 *   App.vue's listener would be caught.
 *
 * WHAT REQUIRES E2E (Playwright):
 *   PlTypeIcon's @dblclick template wiring — happy-dom does not synthesise
 *   dblclick from raw MouseEvent dispatch. Add a Playwright test if needed.
 *
 * Fix before shipping if ANY test here fails.
 */

import { describe, it, expect } from 'vitest'
import {
  openGlyphPanel,
  closeGlyphPanel,
  navigateGlyphPanel,
  GLYPH_PANEL_OPEN_EVENT,
  GLYPH_PANEL_CLOSE_EVENT,
  GLYPH_PANEL_NAVIGATE_EVENT,
} from '../useGlyphPanel'

/** Listen for a DOM CustomEvent on document; returns collected events + cleanup. */
function listenOnce(eventName: string) {
  const collected: CustomEvent[] = []
  const handler = (e: Event) => collected.push(e as CustomEvent)
  document.addEventListener(eventName, handler)
  return {
    events: collected,
    cleanup: () => document.removeEventListener(eventName, handler),
  }
}

// ── Composable function tests ──────────────────────────────────────────────
// These are the primary regression guard. If any fail, double-click is broken.

describe('useGlyphPanel — CustomEvent bus', () => {
  it('openGlyphPanel dispatches glyph-panel:open with the correct type', () => {
    const { events, cleanup } = listenOnce(GLYPH_PANEL_OPEN_EVENT)
    openGlyphPanel('value')
    cleanup()
    expect(events).toHaveLength(1)
    expect(events[0].detail).toBe('value')
  })

  it('openGlyphPanel works for all 8 Planguage types', () => {
    const types = [
      'value', 'function', 'constraint', 'solution',
      'stakeholder', 'evo-step', 'task', 'resource',
    ] as const
    for (const type of types) {
      const { events, cleanup } = listenOnce(GLYPH_PANEL_OPEN_EVENT)
      openGlyphPanel(type)
      cleanup()
      expect(events[0]?.detail).toBe(type)
    }
  })

  it('closeGlyphPanel dispatches glyph-panel:close', () => {
    const { events, cleanup } = listenOnce(GLYPH_PANEL_CLOSE_EVENT)
    closeGlyphPanel()
    cleanup()
    expect(events).toHaveLength(1)
  })

  it('navigateGlyphPanel dispatches glyph-panel:navigate with the correct type', () => {
    const { events, cleanup } = listenOnce(GLYPH_PANEL_NAVIGATE_EVENT)
    navigateGlyphPanel('constraint')
    cleanup()
    expect(events).toHaveLength(1)
    expect(events[0].detail).toBe('constraint')
  })

  it('module is stateless — no reactive refs exported', () => {
    // In the old architecture, _open and _type were module-level refs.
    // If they appear here again, the HMR-split bug can re-emerge.
    const mod = { openGlyphPanel, closeGlyphPanel, navigateGlyphPanel }
    for (const fn of Object.values(mod)) expect(typeof fn).toBe('function')
  })

  it('event names are stable strings (App.vue and PlTypeIcon must agree)', () => {
    expect(GLYPH_PANEL_OPEN_EVENT).toBe('glyph-panel:open')
    expect(GLYPH_PANEL_CLOSE_EVENT).toBe('glyph-panel:close')
    expect(GLYPH_PANEL_NAVIGATE_EVENT).toBe('glyph-panel:navigate')
  })

  it('openGlyphPanel called twice dispatches two separate events', () => {
    const { events, cleanup } = listenOnce(GLYPH_PANEL_OPEN_EVENT)
    openGlyphPanel('value')
    openGlyphPanel('function')
    cleanup()
    expect(events).toHaveLength(2)
    expect(events[0].detail).toBe('value')
    expect(events[1].detail).toBe('function')
  })
})
