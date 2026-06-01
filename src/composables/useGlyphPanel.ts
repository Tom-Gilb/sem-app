/**
 * useGlyphPanel — singleton composable for the Planguage Glyph Data Panel.
 *
 * DD-013 (2026-06-01): Double-click for detailed icon info — universal rule.
 * Every PlTypeIcon emits glyph-info on double-click. Rather than threading
 * events through every intermediate component (fragile, O(N) wiring burden),
 * this composable holds module-level singleton state that PlTypeIcon calls
 * directly. App.vue consumes the same refs for rendering GlyphDataPanel.
 *
 * Architecture:
 *   - Module-level refs → true singleton (same instance across all imports)
 *   - PlTypeIcon calls openGlyphPanel() on dblclick
 *   - App.vue reads glyphPanelOpen / glyphPanelType for rendering
 *   - registerExclusiveSurface('glyphDataPanel', glyphPanelOpen) stays in App.vue
 *
 * Twin-portability note: the panel-open/close pattern maps to any state
 * management system (Pinia, Redux, Solid signals). The interface is
 * openGlyphPanel(type) / closeGlyphPanel() / navigateGlyphPanel(type).
 */
import { ref } from 'vue'
import type { PlGlyphType } from '@/components/icons/PlTypeIcon.vue'

// ── Module-level singleton state ──────────────────────────────────────────────
const _open = ref(false)
const _type = ref<PlGlyphType | null>(null)

// ── Public API ────────────────────────────────────────────────────────────────
export function useGlyphPanel() {
  /**
   * Open the GlyphDataPanel for the given Planguage type.
   * Safe to call from anywhere — even deep in the component tree.
   */
  function openGlyphPanel(type: PlGlyphType): void {
    _type.value = type
    _open.value = true
  }

  /** Close the panel. */
  function closeGlyphPanel(): void {
    _open.value = false
  }

  /**
   * Navigate to a different glyph while the panel is already open.
   * Keeps the panel visible; only changes the displayed type.
   */
  function navigateGlyphPanel(type: PlGlyphType): void {
    _type.value = type
    // _open stays true — caller must open the panel first
  }

  return {
    glyphPanelOpen: _open,
    glyphPanelType: _type,
    openGlyphPanel,
    closeGlyphPanel,
    navigateGlyphPanel,
  }
}
