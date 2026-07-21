// UNIT_TYPE=Composable
// useTypingJournal — universal typing safety net.
//
// Tom Gilb 2026-06-19 verbatim: "It might be my hand accidentally hitting
// the trackpad. I tried mac key/track settings adjustments, they did not
// work, I do try to select A and if large write in notes first. But I
// have not got this problem in any other app like notes keynote."
//
// Diagnosis: text loss is SEM-App-specific — meaning some affordance in
// the SEM App is wiping typed content under conditions the planner
// cannot reliably predict (backdrop click closes a modal whose input
// had unsaved text; Escape on a textarea resets it; a stray "Cancel"
// click; etc.).  Rather than hunt every offending surface, this
// composable installs a UNIVERSAL READ-ONLY safety net at the document
// level: every keystroke landing in any `<input>` or `<textarea>` is
// captured to a rolling buffer + persisted to localStorage in real
// time.  Recovery is then a one-liner from Safari DevTools or a console
// search by phrase.
//
// What's captured per snapshot:
//   • `ts`        — ISO timestamp at write time
//   • `fieldHint` — a best-effort identifier of the field (id / name /
//                   aria-label / placeholder / nearest `<label>` text),
//                   truncated to keep the buffer small.
//   • `valuePrefix` — the first N characters of the value (default 800).
//                     Long inputs are head-truncated so the buffer stays
//                     bounded; the head is usually enough to grep for.
//
// Storage strategy:
//   • One localStorage key (`sem-typing-journal-v1`).
//   • Bounded ring buffer — `MAX_ENTRIES = 250`.  Oldest entries roll off
//     so the buffer cannot grow unbounded across long sessions.
//   • Writes are debounced per field — repeated keystrokes in the same
//     input within `DEBOUNCE_MS` (300ms) update the SAME journal entry
//     instead of creating a new one per keystroke (avoids 5000 entries
//     for a 5000-char paragraph).
//
// What's NOT captured:
//   • Passwords (any `<input type="password">` is excluded).
//   • Contenteditable elements (out of scope for this rev — Vue
//     `<textarea>` and `<input>` cover the typing surfaces Tom uses).
//   • Anything outside `document` (iframes, web workers, etc.).
//   • Anything that goes to the network — purely local.
//
// Public API:
//   • `installTypingJournal()` — call once at App.vue mount.
//   • `getTypingJournal()` — returns the in-memory buffer (most recent
//      first).  Also bound to `window.semTypingJournal()` for DevTools.
//   • `findInTypingJournal(query)` — case-insensitive substring search.
//      Also bound to `window.semFindTyping(query)`.
//   • `clearTypingJournal()` — wipes the buffer + localStorage.

const STORAGE_KEY  = 'sem-typing-journal-v1'
const MAX_ENTRIES  = 250
const VALUE_PREFIX = 800
const DEBOUNCE_MS  = 300

export interface TypingSnapshot {
  ts:          string
  fieldHint:   string
  valuePrefix: string
}

let _journal: TypingSnapshot[] = _loadFromStorage()
let _installed = false

function _loadFromStorage(): TypingSnapshot[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed as TypingSnapshot[]
  } catch {
    return []
  }
}

function _saveToStorage(): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_journal))
  } catch {
    /* quota / private mode — non-fatal */
  }
}

/** Build a short stable identifier for the field so the planner can tell
 *  WHERE the lost text came from when scanning the journal.  Falls back
 *  through a chain of attributes; never throws. */
function _fieldHint(el: HTMLElement): string {
  const parts: string[] = []
  const id          = el.getAttribute('id')          ?? ''
  const name        = el.getAttribute('name')        ?? ''
  const ariaLabel   = el.getAttribute('aria-label')  ?? ''
  const placeholder = el.getAttribute('placeholder') ?? ''
  if (id)          parts.push(`#${id}`)
  if (name)        parts.push(`name=${name}`)
  if (ariaLabel)   parts.push(`aria=${ariaLabel}`)
  if (placeholder) parts.push(`ph=${placeholder}`)
  // Nearest <label>-for or wrapping <label>.
  if (id) {
    const lbl = document.querySelector(`label[for="${CSS.escape(id)}"]`)
    if (lbl?.textContent) parts.push(`label=${lbl.textContent.trim().slice(0, 60)}`)
  }
  const wrapping = el.closest('label')
  if (wrapping?.textContent) parts.push(`labelWrap=${wrapping.textContent.trim().slice(0, 60)}`)
  if (parts.length === 0) parts.push(el.tagName.toLowerCase())
  // Keep the hint bounded so the buffer never blows up.
  return parts.join(' · ').slice(0, 240)
}

// Debounce bookkeeping — one timer per element so concurrent fields each
// get their own debounce window.
const _pendingTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>()
// Track which element most recently wrote so consecutive bursts collapse
// into ONE entry instead of stamping a new one every debounce-flush.
let _lastEl: HTMLElement | null = null

function _isTrackedField(el: EventTarget | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (!el || !(el instanceof HTMLElement)) return false
  const tag = el.tagName.toLowerCase()
  if (tag === 'textarea') return true
  if (tag === 'input') {
    const type = ((el as HTMLInputElement).type ?? 'text').toLowerCase()
    if (type === 'password') return false
    // Skip checkboxes / radios / file pickers / range etc.  Keep the typed
    // text types only.
    const TYPED_TYPES = new Set(['text', 'search', 'url', 'tel', 'email', 'number', ''])
    return TYPED_TYPES.has(type)
  }
  return false
}

function _record(el: HTMLInputElement | HTMLTextAreaElement): void {
  const raw = el.value ?? ''
  if (!raw) return
  const snap: TypingSnapshot = {
    ts:          new Date().toISOString(),
    fieldHint:   _fieldHint(el),
    valuePrefix: raw.length > VALUE_PREFIX ? raw.slice(0, VALUE_PREFIX) + '…' : raw,
  }
  // Collapse rapid edits to the same field into ONE rolling entry.
  if (_journal.length > 0 && _lastEl === el && _journal[0].fieldHint === snap.fieldHint) {
    _journal[0] = snap
  } else {
    _journal = [snap, ..._journal].slice(0, MAX_ENTRIES)
  }
  _lastEl = el
  _saveToStorage()
}

function _onInput(ev: Event): void {
  const el = ev.target
  if (!_isTrackedField(el)) return
  // Debounce per element.
  const existing = _pendingTimers.get(el)
  if (existing) clearTimeout(existing)
  const timer = setTimeout(() => {
    _pendingTimers.delete(el)
    _record(el)
  }, DEBOUNCE_MS)
  _pendingTimers.set(el, timer)
}

/** Call ONCE at App.vue mount — listens at the document for input events
 *  using bubble-phase, so every `<input>` / `<textarea>` in the app is
 *  covered without per-component wiring. */
export function installTypingJournal(): void {
  if (_installed) return
  if (typeof document === 'undefined') return
  document.addEventListener('input', _onInput, true)
  _installed = true
  if (typeof window !== 'undefined') {
    ;(window as unknown as {
      semTypingJournal?:   () => TypingSnapshot[]
      semFindTyping?:      (q: string) => TypingSnapshot[]
      semClearTyping?:     () => void
    }).semTypingJournal = getTypingJournal
    ;(window as unknown as { semFindTyping?: (q: string) => TypingSnapshot[] }).semFindTyping = findInTypingJournal
    ;(window as unknown as { semClearTyping?: () => void }).semClearTyping = clearTypingJournal
  }
}

/** Newest-first snapshot of the typing journal.  Bound to
 *  `window.semTypingJournal()` for DevTools convenience. */
export function getTypingJournal(): TypingSnapshot[] {
  return [..._journal]
}

/** Case-insensitive substring search over the journal's `valuePrefix`.
 *  Returns matching snapshots newest-first.  Bound to
 *  `window.semFindTyping(q)`. */
export function findInTypingJournal(query: string): TypingSnapshot[] {
  if (!query) return []
  const q = query.toLowerCase()
  return _journal.filter(s => s.valuePrefix.toLowerCase().includes(q))
}

/** Wipe the buffer + storage.  Bound to `window.semClearTyping()`. */
export function clearTypingJournal(): void {
  _journal = []
  if (typeof localStorage !== 'undefined') {
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
  }
}
