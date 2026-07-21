// UNIT_TYPE=Composable
// useSpecLock — global spec-lock state.
// Standard Done-Changing Close Process (DD-standard-close-2026-06-09).
//
// When isLocked === true every spec-editing surface:
//   • Disables its Apply / Start-round buttons.
//   • Shows the 🔒 badge in SpecActionFooter.
// When false (default): full editing permitted.
//
// State is a module-level singleton so ALL panels share one truth source.
// Persisted to localStorage so the lock survives a page refresh.

import { ref, watch } from 'vue'

const LOCK_KEY = 'sem-spec-lock:v1'

function _readLocked(): boolean {
  try { return localStorage.getItem(LOCK_KEY) === '1' } catch { return false }
}

const _locked = ref<boolean>(_readLocked())

watch(_locked, v => {
  try { localStorage.setItem(LOCK_KEY, v ? '1' : '0') } catch { /* ignore */ }
})

export function useSpecLock() {
  function lock():   void { _locked.value = true  }
  function unlock(): void { _locked.value = false }
  return { isLocked: _locked, lock, unlock }
}
