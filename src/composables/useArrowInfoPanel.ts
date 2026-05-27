// useArrowInfoPanel.ts
// Singleton composable for ArrowInfoPanel open state.
// Only one arrow info panel can be open at a time.
// The panel is driven by an arrow index (0–9); null means closed.
//
// Using a module-level ref (singleton pattern) ensures that any component
// that imports this composable shares the same state — no prop drilling needed.
// This is the same pattern as useExclusiveSurfaces for major panels.
//
// Spec: F.ValueAccumulationCounter (#15) — Design log r29.

// UNIT_TYPE=Composable

import { ref, readonly } from 'vue'

/** Currently open arrow index (0–9), or null if closed. */
const openArrowIdx = ref<number | null>(null)

export function useArrowInfoPanel() {
  function openArrow(idx: number): void {
    openArrowIdx.value = idx
  }

  function closeArrow(): void {
    openArrowIdx.value = null
  }

  function toggleArrow(idx: number): void {
    openArrowIdx.value = openArrowIdx.value === idx ? null : idx
  }

  return {
    openArrowIdx: readonly(openArrowIdx),
    openArrow,
    closeArrow,
    toggleArrow,
  }
}
