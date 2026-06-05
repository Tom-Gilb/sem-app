/**
 * useGlyphPanel — Planguage Glyph Data Panel event bridge.
 *
 * DD-013 (2026-06-01): Double-click for detailed icon info — universal rule.
 * Every PlTypeIcon emits glyph-info on double-click.
 *
 * Architecture v2 — CustomEvent bus (2026-06-02):
 *   - PlTypeIcon calls openGlyphPanel() on dblclick
 *   - openGlyphPanel() dispatches a DOM CustomEvent on document
 *   - App.vue listens for the event and updates its LOCAL reactive refs
 *   - State lives in App.vue, not here — zero module-level reactivity
 *
 * Why CustomEvent (not module singleton, not Pinia, not provide/inject):
 *   Module singleton (v1): broke on Vite HMR re-evaluation.
 *   When useGlyphPanel.ts was edited, Vite re-evaluated the module and created
 *   new _open/_type Refs. App.vue held stale refs from the prior evaluation.
 *   import.meta.hot.data workaround helped but did not fully prevent the issue
 *   (Cmd+Shift+R hard refresh still failed).
 *
 *   CustomEvent: stateless composable = zero HMR sensitivity. The document is
 *   always the same object. Any component anywhere can open the panel without
 *   coupling to Vue's module graph or DI tree. App.vue owns the reactive state
 *   locally so Vue's reactivity tracking is unambiguous.
 *
 * Public API:
 *   openGlyphPanel(type)     — dispatch 'glyph-panel:open'
 *   closeGlyphPanel()        — dispatch 'glyph-panel:close'
 *   navigateGlyphPanel(type) — dispatch 'glyph-panel:navigate'
 *
 * Consumers:
 *   PlTypeIcon.vue  — calls openGlyphPanel() on dblclick
 *   App.vue         — listens; owns glyphPanelOpen / glyphPanelType refs locally
 *   GlyphDataPanel  — emits @close / @show-glyph handled by App.vue directly
 *
 * Twin-portability: pure functions dispatching typed events — maps directly
 * to any event-bus, Redux action, or RxJS observable in the Twin.
 */
import type { PlGlyphType } from '../components/icons/PlTypeIcon.vue'

/** DOM event names — single source of truth for producers and consumers. */
export const GLYPH_PANEL_OPEN_EVENT     = 'glyph-panel:open'
export const GLYPH_PANEL_CLOSE_EVENT    = 'glyph-panel:close'
export const GLYPH_PANEL_NAVIGATE_EVENT = 'glyph-panel:navigate'

/**
 * Open the GlyphDataPanel for the given Planguage type.
 * Safe to call from anywhere — no Vue DI required.
 */
export function openGlyphPanel(type: PlGlyphType): void {
  document.dispatchEvent(
    new CustomEvent<PlGlyphType>(GLYPH_PANEL_OPEN_EVENT, { detail: type }),
  )
}

/** Close the panel. */
export function closeGlyphPanel(): void {
  document.dispatchEvent(new CustomEvent(GLYPH_PANEL_CLOSE_EVENT))
}

/**
 * Navigate to a different glyph while the panel is already open.
 * Does not open the panel — caller must open it first.
 */
export function navigateGlyphPanel(type: PlGlyphType): void {
  document.dispatchEvent(
    new CustomEvent<PlGlyphType>(GLYPH_PANEL_NAVIGATE_EVENT, { detail: type }),
  )
}

/**
 * Global dblclick detection — resolves which PlGlyphType was double-clicked.
 *
 * Architecture (v3 — capture phase, 2026-06-02):
 *   PlTypeIcon sets `data-pl-type="<type>"` on its root span.
 *   App.vue registers `document.addEventListener('dblclick', handler, true)`
 *   (capture phase = fires before any child handler; cannot be blocked by
 *   stopPropagation on buttons, table cells, etc. that wrap the icon).
 *   This function is the pure decision logic: given a dblclick event, walk up
 *   the DOM via closest() to find the nearest [data-pl-type] element.
 *
 * Pure function — testable without mounting any Vue component.
 * Returns null when the click was NOT on or inside a PlTypeIcon.
 */
export function glyphTypeFromDblClick(e: MouseEvent): PlGlyphType | null {
  const el = (e.target as HTMLElement | null)
    ?.closest<HTMLElement>('[data-pl-type]') ?? null
  if (!el) return null
  const raw = el.dataset.plType
  // Validate against the 8 canonical types before returning
  const VALID: PlGlyphType[] = [
    'value', 'function', 'constraint', 'solution',
    'stakeholder', 'evo-step', 'task', 'resource',
  ]
  return VALID.includes(raw as PlGlyphType) ? (raw as PlGlyphType) : null
}

/**
 * Composable wrapper — returns the three functions so existing call sites
 * that do `const { openGlyphPanel } = useGlyphPanel()` still compile.
 */
export function useGlyphPanel() {
  return { openGlyphPanel, closeGlyphPanel, navigateGlyphPanel }
}
