// useFocusMode.ts — singleton focus mode for interactive panels.
//
// When a panel enters focus mode:
//   • A blur/dim backdrop fills the viewport (FocusModeBackdrop.vue)
//   • The panel expands and centers (each panel implements its own expansion)
//   • A 30-second inactivity timer counts down; any interaction resets it
//   • Pinning pauses the timer indefinitely
//   • Escape, clicking the backdrop, or timer expiry exits focus mode
//
// Usage in a panel component:
//   const { enter, exit, togglePin, onActivity, isFocusedPanel } = useFocusMode()
//   enter('my-panel-id')   // when panel opens / user triggers focus
//   isFocusedPanel('my-panel-id')  // reactive: is this panel focused?

import { ref, computed } from 'vue'

export type FocusPanelId = string

const INACTIVITY_SECS = 30

// ── Module-level singleton state ──────────────────────────────────────────────

const _active   = ref(false)
const _panelId  = ref<FocusPanelId | null>(null)
const _pinned   = ref(false)
const _secsLeft = ref(0)

let _timerHandle: ReturnType<typeof setInterval> | null = null

function _clearTimer(): void {
  if (_timerHandle !== null) {
    clearInterval(_timerHandle)
    _timerHandle = null
  }
}

function _doExit(): void {
  _clearTimer()
  _active.value   = false
  _panelId.value  = null
  _pinned.value   = false
  _secsLeft.value = 0
}

function _startTimer(): void {
  _clearTimer()
  if (_pinned.value) return
  _secsLeft.value = INACTIVITY_SECS
  _timerHandle = setInterval(() => {
    _secsLeft.value--
    if (_secsLeft.value <= 0) _doExit()
  }, 1000)
}

// ── Composable (same singleton shared across all callers) ──────────────────────

export function useFocusMode() {
  const active   = computed(() => _active.value)
  const panelId  = computed(() => _panelId.value)
  const pinned   = computed(() => _pinned.value)
  const secsLeft = computed(() => _secsLeft.value)

  /** True when secsLeft is in the final 10 seconds — show the countdown chip. */
  const showCountdown = computed(
    () => !_pinned.value && _active.value && _secsLeft.value > 0 && _secsLeft.value <= 10,
  )

  /** Enter focus mode for a given panel. Safe to call again with the same ID (resets timer). */
  function enter(id: FocusPanelId): void {
    _active.value  = true
    _panelId.value = id
    _pinned.value  = false
    _startTimer()
  }

  /** Exit focus mode. The panel remains open; it just returns to its normal size. */
  function exit(): void {
    _doExit()
  }

  /** Toggle the inactivity-timer pin. Pinned = timer suspended indefinitely. */
  function togglePin(): void {
    _pinned.value = !_pinned.value
    if (_pinned.value) {
      _clearTimer()
      _secsLeft.value = 0
    } else {
      _startTimer()
    }
  }

  /**
   * Reset the inactivity timer. Call this on any meaningful interaction inside
   * the focused panel (keydown, click, message sent, etc.).
   */
  function onActivity(): void {
    if (!_active.value || _pinned.value) return
    _startTimer()
  }

  /** Reactive check: is the given panel ID currently focused? */
  function isFocusedPanel(id: FocusPanelId): boolean {
    return _active.value && _panelId.value === id
  }

  return {
    active,
    panelId,
    pinned,
    secsLeft,
    showCountdown,
    enter,
    exit,
    togglePin,
    onActivity,
    isFocusedPanel,
  }
}
