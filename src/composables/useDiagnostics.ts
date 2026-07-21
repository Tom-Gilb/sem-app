// UNIT_TYPE=Composable
//
// useDiagnostics.ts — r41 v335 (Tom Gilb 2026-06-24)
//
// In-app console-error capture, designed for the PWA window where Safari Web
// Inspector is awkward to reach.  Replaces "open Safari to see errors" with
// "click the 🔍 badge in the title bar".
//
// Tom Gilb 2026-06-24 verbatim: "I do have plan now contains, so that is good"
// (after v321 SpecPulse) + "I would like to avoid safari console, I have to
// restart in safari" + "lets get this fixed" (with 1.5-2.5 hours runway tonight).
//
// Listens for THREE classes of runtime issue:
//   1. console.error(...)          — anything explicitly logged as error
//   2. window 'error' event        — uncaught exceptions, asset 404s
//   3. unhandledrejection event    — promise rejections with no .catch()
//
// Each captured error is stored as a DiagnosticError record in a reactive ref
// + persisted to localStorage (key 'sem-app:diagnostics:v1').  Last 50 retained.
//
// Singleton — install ONCE on first consumer; subsequent useDiagnostics() calls
// share the same ref.  This means the diagnostic panel + the title-bar badge
// both read from the same source of truth, reactively.

import { ref, computed, type Ref, type ComputedRef } from 'vue'

export interface DiagnosticError {
  id: string
  timestamp: number
  type: 'console.error' | 'window.error' | 'unhandledrejection'
  message: string
  stack?: string
  source?: string
}

const STORAGE_KEY = 'sem-app:diagnostics:v1'
const MAX_ERRORS = 50

const errors = ref<DiagnosticError[]>([])
let hydrated = false
let installed = false

function _hydrate(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) errors.value = parsed as DiagnosticError[]
    }
  } catch {
    // Ignore parse failures — diagnostics shouldn't break the app
  }
  hydrated = true
}

function _persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(errors.value))
  } catch {
    // localStorage may be full; ignore
  }
}

function _push(partial: Omit<DiagnosticError, 'id' | 'timestamp'>): void {
  const e: DiagnosticError = {
    id: 'err-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    timestamp: Date.now(),
    ...partial,
  }
  // Prepend (most recent first), cap at MAX_ERRORS
  errors.value = [e, ...errors.value].slice(0, MAX_ERRORS)
  _persist()
}

function _safeStringify(arg: unknown): string {
  if (arg instanceof Error) return arg.message
  if (arg === null) return 'null'
  if (arg === undefined) return 'undefined'
  if (typeof arg === 'string') return arg
  if (typeof arg === 'number' || typeof arg === 'boolean') return String(arg)
  try {
    return JSON.stringify(arg).substring(0, 500)
  } catch {
    return '[unserialisable object]'
  }
}

function _installListeners(): void {
  if (installed) return
  installed = true

  // ── Listener 1: console.error ────────────────────────────────────────────
  // Wrap the native console.error so EVERY error log gets captured.  Always
  // forward to the original after capture so the dev-tools console still shows
  // the error normally (no regression for dev-time inspection).
  const origConsoleError = console.error.bind(console)
  console.error = (...args: unknown[]) => {
    try {
      const message = args.map(_safeStringify).join(' ').substring(0, 1500)
      const stack = (args.find(a => a instanceof Error) as Error | undefined)?.stack
      _push({ type: 'console.error', message, stack })
    } catch {
      // Diagnostic capture itself must never break console.error
    }
    origConsoleError(...args)
  }

  // ── Listener 2: window 'error' event ─────────────────────────────────────
  window.addEventListener('error', (ev: ErrorEvent) => {
    try {
      _push({
        type: 'window.error',
        message: ev.message || 'Unknown window error',
        stack: ev.error?.stack,
        source: ev.filename ? `${ev.filename}:${ev.lineno}:${ev.colno}` : undefined,
      })
    } catch {
      // Never break the page's own error handling
    }
  })

  // ── Listener 3: unhandled promise rejection ──────────────────────────────
  window.addEventListener('unhandledrejection', (ev: PromiseRejectionEvent) => {
    try {
      const reason = ev.reason
      const message = reason instanceof Error
        ? reason.message
        : _safeStringify(reason)
      const stack = reason instanceof Error ? reason.stack : undefined
      _push({ type: 'unhandledrejection', message, stack })
    } catch {
      // Never break the page's own rejection handling
    }
  })
}

/**
 * Hook into the diagnostics store.  Idempotent — installs listeners on first
 * call, just returns refs on subsequent calls.  Use ONCE in App.vue setup to
 * install + ALSO call from DiagnosticsPanel.vue to read.
 */
export function useDiagnostics(): {
  errors:     Ref<DiagnosticError[]>
  errorCount: ComputedRef<number>
  clear:      () => void
  dismissOne: (id: string) => void
} {
  if (!hydrated) _hydrate()
  _installListeners()
  return {
    errors,
    errorCount: computed(() => errors.value.length),
    clear: () => {
      errors.value = []
      _persist()
    },
    dismissOne: (id: string) => {
      errors.value = errors.value.filter(e => e.id !== id)
      _persist()
    },
  }
}
