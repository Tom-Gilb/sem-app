// UNIT_TYPE=Hook
// useDictation — continuous Web Speech API voice command handler
//
// Four-mode design:
//   Wake mode    (active=false, no field focused):
//                 Recognition runs silently, only listening for wake phrases.
//                 Pauses when browser loses focus.
//   Command mode (active=true, no field focused):
//                 Explicit commands fire first; if nothing matches, a DOM scan
//                 clicks any visible button whose aria-label / text contains
//                 the phrase.
//   Field mode   (active=true, text input/textarea focused):
//                 ALL transcripts route into the focused field. Explicit commit
//                 phrases ("done", "save that") or 5 s of silence auto-commit.
//                 "cancel" restores the original value. Activates automatically
//                 on focusin — no per-component wiring required.
//   Text mode    (enterTextMode called explicitly):
//                 Same as field mode but targets a Ref<string> rather than a
//                 DOM element. Used by components that manage their own state.
//
// Startup: if the user previously had the mic ON (localStorage STORAGE_KEY),
// onMounted waits 1 s for App.vue's _warmMicPermission() to cache the OS grant,
// then calls ensureRunning() automatically.  On Safari/browsers that still block
// it, onerror 'not-allowed' sets micBlocked gracefully — user clicks mic button.

import { ref, onMounted, onUnmounted } from 'vue'
import type { Ref } from 'vue'

const STORAGE_KEY = 'sem-dictation-on'

const WAKE_PHRASES: string[] = [
  'sem dictate', 'app dictate',
  'turn on mic', 'turn on the mic', 'turn the mic on',
  'start mic', 'start the mic',
  'start listening', 'open mic', 'microphone on', 'enable mic',
]
const SLEEP_PHRASES: string[] = [
  // Core phrases
  'mic off', 'turn off mic', 'turn off the mic', 'turn the mic off',
  'stop mic', 'stop the mic', 'stop dictating', 'stop listening',
  'microphone off', 'disable mic',
  // Phonetic variants — speech engines mishear "mic" as "mike", "mick", "mix"
  'mike off', 'mick off', 'mix off',
  // Additional unambiguous alternatives the user can fall back on
  'go to sleep', 'sleep mode', 'pause mic', 'pause microphone',
  'voice off', 'voice stop', 'stop voice',
  'switch off mic', 'switch off microphone',
  'mute mic', 'mute microphone', 'mute',
]
const COMMIT_PHRASES: string[] = ['done', 'save that', 'save', 'confirm', 'submit']
const CANCEL_PHRASES: string[] = ['cancel', 'never mind', 'discard']

const SILENCE_MS        = 8_000   // 8 s of silence → auto-commit (5 s was too short for natural pauses)
const VOICE_CLASS       = 'sem-voice-active'
const PAUSED_PLACEHOLDER = '⏸ Paused — click or speak to add more'

// ── Inject global voice-active CSS once ──────────────────────────────────────

let cssInjected = false
function injectVoiceCSS(): void {
  if (cssInjected || typeof document === 'undefined') return
  cssInjected = true
  const style = document.createElement('style')
  style.textContent = `
    .${VOICE_CLASS} {
      outline: none !important;
      border-color: #6366f1 !important;
      background-color: rgba(99,102,241,0.05) !important;
      animation: sem-voice-flash 1s ease-in-out infinite;
    }
    @keyframes sem-voice-flash {
      0%, 100% {
        box-shadow: 0 0 0 3px rgba(99,102,241,0.9);
        background-color: rgba(99,102,241,0.05) !important;
      }
      50% {
        box-shadow: 0 0 0 8px rgba(99,102,241,0.08);
        background-color: rgba(99,102,241,0.11) !important;
      }
    }
  `
  document.head.appendChild(style)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Strip emoji and decorative symbols for clean label comparison. */
function stripEmoji(text: string): string {
  return text
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/[→←↩↺▶✕×◉]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Normalise -ise/-ize spelling variants so British labels match American
 * speech-recognition output (Chrome en-US returns "prioritized", buttons say
 * "Prioritised"). Everything is collapsed to the -ize form for comparison.
 */
function normaliseSpelling(s: string): string {
  return s
    .replace(/\bised\b/g, 'ized')
    .replace(/\bise\b/g,  'ize')
    .replace(/\bising\b/g,'izing')
    .replace(/\biser\b/g, 'izer')
    // Speech engines often transcribe "mic" as "mike" or "mick" (phonetically close).
    // SLEEP_PHRASES already lists 'mick off' / 'mix off' as raw variants, but
    // normalising here means WAKE_PHRASES also benefit without listing every permutation.
    .replace(/\bmike\b/gi, 'mic')
    .replace(/\bmick\b/gi, 'mic')
    // "Planguage" is a domain-specific term unknown to speech engines.
    // Common mishearings: "plan language", "plan gauge", "plan edge", "plant language"
    .replace(/\bplan\s+(?:language|gauge|edge|guage|gage)\b/gi, 'planguage')
    // Normalise gerund/third-person verb forms so command matching works even when
    // the speech engine returns "generating" or "generates" instead of "generate".
    .replace(/\bgenerating\b/gi, 'generate')
    .replace(/\bgenerates\b/gi,  'generate')
    // "specs" is the plural form of "spec" — speech engines occasionally emit it
    // when the user says "spec" quickly or at the end of an utterance.
    .replace(/\bspecs\b/gi, 'spec')
}

/**
 * Returns true when the spoken transcript (already stripped + normalised) matches
 * a command phrase (also stripped + normalised).
 *
 * Short phrases ≤ 5 chars ("Go", "Next", "Demo", "Tour") use whole-word boundary
 * matching so that common words CONTAINING the command don't accidentally fire it:
 *   "goal"  → does NOT fire "Go"
 *   "next thing" → does NOT fire "Next"
 *   "tomorrow" → does NOT fire "Tour"
 *
 * Longer phrases keep the existing substring behaviour so natural insertions like
 * "please generate spec" still match "Generate Spec".
 */
function commandPhraseMatches(phraseNorm: string, spoken: string): boolean {
  if (!spoken.includes(phraseNorm)) return false
  if (phraseNorm.length <= 5) {
    // Require whole-word boundaries — the phrase must be surrounded by
    // start-of-string / whitespace on both sides.
    const esc = phraseNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(?:^|\\s)${esc}(?:\\s|$)`).test(spoken)
  }
  return true
}

/**
 * Strip common English articles and filler words that the speech engine often
 * inserts ("the", "a", "an", "please", "my", "your") so that natural phrases
 * like "turn on the mic" match button labels like "Turn On Mic".
 */
function stripFillers(s: string): string {
  return s
    .replace(/\b(the|a|an|please|my|your)\b\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Scan visible, enabled buttons for one whose aria-label or text content
 * matches the spoken phrase. Longest label wins on ambiguity.
 * Spelling variants (-ise/-ize) are normalised before comparison.
 * Returns true and fires click() if a match is found.
 */
/**
 * Find a visible, enabled button whose aria-label / text matches the spoken phrase.
 * @param lower          Normalised (lower-case) spoken text.
 * @param minLabelLength Minimum label length to consider — use a higher threshold
 *                       (e.g. 8) inside field mode so short words like "add" or
 *                       "save" don't accidentally fire while the user is dictating.
 */
/**
 * Returns true when a button appears to be in a "completed / already done" state.
 * Signals checked: aria-pressed="true", aria-checked="true", data-done="true",
 * or a label that starts with a checkmark.
 */
function isButtonDone(btn: HTMLButtonElement): boolean {
  if (btn.getAttribute('aria-pressed')  === 'true') return true
  if (btn.getAttribute('aria-checked')  === 'true') return true
  if (btn.getAttribute('data-done')     === 'true') return true
  const label = (btn.getAttribute('aria-label') || btn.textContent || '').trim()
  return /^[✓✔☑✅]/.test(label)
}

/**
 * Find a visible, enabled button whose aria-label / text matches the spoken phrase.
 *
 * When multiple buttons match, ties are broken by three priorities (in order):
 *   1. Not already done — completed/checked buttons rank last
 *   2. Top of page first — higher vertical position wins
 *   3. Nearest to the currently focused element — cursor proximity wins
 *
 * @param lower          Normalised (lower-case) spoken text.
 * @param minLabelLength Minimum label length to consider — use a higher threshold
 *                       (e.g. 8) inside field mode so short words like "add" or
 *                       "save" don't accidentally fire while the user is dictating.
 */
function findDOMButton(lower: string, minLabelLength = 2): HTMLButtonElement | null {
  const normSpoken = stripFillers(normaliseSpelling(lower))

  // Snapshot the active element's centre for proximity scoring
  const activeEl = document.activeElement as HTMLElement | null
  const activeR  = activeEl?.getBoundingClientRect()
  const focusCx  = activeR ? (activeR.left + activeR.right) / 2 : window.innerWidth  / 2
  const focusCy  = activeR ? (activeR.top  + activeR.bottom) / 2 : window.innerHeight / 2

  // inCollapsed: button lives inside a v-show="false" ancestor (display:none inline
  // style) — still in the DOM and clickable, just visually hidden.
  type Candidate = { btn: HTMLButtonElement; label: string; r: DOMRect; inCollapsed: boolean }

  const candidates: Candidate[] = Array.from(
    document.querySelectorAll<HTMLButtonElement>('button:not([disabled])')
  )
    .flatMap(btn => {
      const r           = btn.getBoundingClientRect()
      const inCollapsed = !!btn.closest('[style*="display: none"]')
      // Reject truly absent elements — zero rect AND not inside a v-show container
      if (r.width === 0 && r.height === 0 && !inCollapsed) return []
      const raw   = btn.getAttribute('aria-label') || btn.textContent || ''
      const label = stripFillers(normaliseSpelling(stripEmoji(raw).toLowerCase()))
      // Raise the minimum label bar for hidden buttons to avoid short accidental matches
      const effectiveMin = inCollapsed ? Math.max(4, minLabelLength) : minLabelLength
      if (label.length < effectiveMin) return []
      return [{ btn, label, r, inCollapsed }]
    })

  // Keep only buttons whose label matches the spoken phrase.
  // Primary: exact substring match in either direction.
  // Fallback (command mode only, minLabelLength ≤ 2): all significant words in
  // the label (≥ 4 chars) appear somewhere in the spoken text.  This tolerates
  // garbled domain terms like "Planguage" → "plan language" where the words
  // "generate" and "spec" still both land in the transcript individually.
  // Not applied in field mode (minLabelLength = 8) where exact matching prevents
  // false positives while the user is mid-dictation.
  const matches = candidates.filter(({ label }) => {
    if (normSpoken.includes(label) || label.includes(normSpoken)) return true
    if (minLabelLength <= 2) {
      const sigWords = label.split(/\s+/).filter(w => w.length >= 4)
      return sigWords.length >= 2 && sigWords.every(w => normSpoken.includes(w))
    }
    return false
  })

  if (matches.length === 0) return null

  // Prefer visible (non-collapsed) buttons; fall back to collapsed only when
  // no visible match exists (e.g. voice names an item inside a closed dropdown)
  const visibleMatches = matches.filter(c => !c.inCollapsed)
  const effectiveMatches = visibleMatches.length > 0 ? visibleMatches : matches

  if (effectiveMatches.length === 1) return effectiveMatches[0].btn

  // Sort matched candidates by priority
  effectiveMatches.sort((a, b) => {
    // ── Priority 0: specificity — longer label = more specific match ──────────
    if (a.label.length !== b.label.length) return b.label.length - a.label.length

    // ── Priority 1: not done — undone buttons before done/checked ones ────────
    const aDone = isButtonDone(a.btn) ? 1 : 0
    const bDone = isButtonDone(b.btn) ? 1 : 0
    if (aDone !== bDone) return aDone - bDone

    // ── Priority 2: top of page — higher vertical position wins ───────────────
    // Ignore differences < 60 px (same visual row); beyond that, prefer higher.
    const topDiff = a.r.top - b.r.top
    if (Math.abs(topDiff) >= 60) return topDiff

    // ── Priority 3: proximity to focused element ──────────────────────────────
    const distA = Math.hypot((a.r.left + a.r.right) / 2 - focusCx, (a.r.top + a.r.bottom) / 2 - focusCy)
    const distB = Math.hypot((b.r.left + b.r.right) / 2 - focusCx, (b.r.top + b.r.bottom) / 2 - focusCy)
    return distA - distB
  })

  return effectiveMatches[0].btn
}

/** Find and click a matching button. Returns true if a button was clicked. */
function tryDOMButton(lower: string): boolean {
  const btn = findDOMButton(lower)
  if (btn) { btn.click(); return true }
  return false
}

/** Text input types that accept voice dictation. */
const TEXT_INPUT_TYPES = new Set(['', 'text', 'search', 'url', 'email', 'tel'])

function isTextInput(el: HTMLElement): el is HTMLInputElement | HTMLTextAreaElement {
  if (el.tagName === 'TEXTAREA') return true
  if (el.tagName === 'INPUT') {
    const t = ((el as HTMLInputElement).type ?? '').toLowerCase()
    return TEXT_INPUT_TYPES.has(t)
  }
  return false
}

// ── Composable ────────────────────────────────────────────────────────────────

export function useDictation(commands: Record<string, () => void>) {
  const active     = ref(false)
  const lastHeard  = ref('')
  const micBlocked = ref(false)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SR = typeof window !== 'undefined'
    ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    : null
  const supported = !!SR

  let recognition:   SpeechRecognition | null = null
  let keepAlive      = false
  let pausedByBlur   = false
  let startedOnce    = false

  const sortedCommands = Object.entries(commands).sort((a, b) => b[0].length - a[0].length)

  // ── DOM field mode ─────────────────────────────────────────────────────────

  let domField:          (HTMLInputElement | HTMLTextAreaElement) | null = null
  let domFieldOrigValue  = ''
  let domFieldHadSpeech  = false
  let silenceTimer:      ReturnType<typeof setTimeout> | null = null

  // Saved placeholders so we can restore them when field mode ends.
  const savedPlaceholders = new Map<HTMLElement, string>()

  function clearSilenceTimer(): void {
    if (silenceTimer !== null) { clearTimeout(silenceTimer); silenceTimer = null }
  }

  /**
   * Apply the voice-active ring + "◉ Listening…" placeholder to `field`.
   * Saves the original placeholder so it can be restored on commit/cancel.
   */
  function applyFieldVisuals(field: HTMLInputElement | HTMLTextAreaElement): void {
    field.classList.add(VOICE_CLASS)
    if (!savedPlaceholders.has(field)) {
      savedPlaceholders.set(field, field.placeholder)
    }
    field.placeholder = '◉ Listening — talk or type here now'
  }

  /** Remove the voice-active ring and restore the original placeholder. */
  function removeFieldVisuals(field: HTMLInputElement | HTMLTextAreaElement): void {
    field.classList.remove(VOICE_CLASS)
    if (savedPlaceholders.has(field)) {
      field.placeholder = savedPlaceholders.get(field)!
      savedPlaceholders.delete(field)
    }
  }

  /**
   * @param paused  When true (silence timeout), leave the saved placeholder
   *                in the Map and show PAUSED_PLACEHOLDER instead of restoring
   *                the original.  Re-focusing the field re-activates voice mode
   *                and correctly restores the original on final commit/cancel.
   *                When false (explicit "done", Enter, blur), fully restore.
   */
  function commitDOMField(paused = false): void {
    clearSilenceTimer()
    if (domField) {
      if (paused) {
        // Soft-pause: remove the ring but keep savedPlaceholders entry intact
        // so the next focus cycle restores the real original placeholder.
        domField.classList.remove(VOICE_CLASS)
        domField.placeholder = PAUSED_PLACEHOLDER
      } else {
        removeFieldVisuals(domField)
      }
    }
    domField          = null
    domFieldHadSpeech = false
  }

  function cancelDOMField(): void {
    clearSilenceTimer()
    if (domField) {
      domField.value = domFieldOrigValue
      domField.dispatchEvent(new Event('input',  { bubbles: true }))
      domField.dispatchEvent(new Event('change', { bubbles: true }))
      removeFieldVisuals(domField)
    }
    domField          = null
    domFieldHadSpeech = false
  }

  /**
   * Activate the currently focused DOM element as the voice text target.
   * Called when the mic is switched on while a field is already focused —
   * no focusin event fires in that case, so we detect it manually.
   */
  /**
   * Find the best visible, writable text input on the page.
   * Prefers textareas over single-line inputs (more likely to be the main entry
   * area). Picks the highest one on the page within each type group.
   */
  function findBestTextField(): HTMLInputElement | HTMLTextAreaElement | null {
    const els = Array.from(
      document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        'textarea:not([disabled]):not([readonly]), input:not([disabled]):not([readonly])'
      )
    ).filter(el => {
      if (!isTextInput(el)) return false
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0
    })
    // Prefer textareas (main content areas) over single-line inputs
    const textareas = els.filter(el => el.tagName === 'TEXTAREA')
    const pool = textareas.length > 0 ? textareas : els
    // Pick the highest one on the page
    return pool.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0] ?? null
  }

  function activateCurrentField(): void {
    if (!supported) return
    if (!active.value) return   // never show ◉ Listening when mic is off
    const el = document.activeElement as HTMLElement | null
    if (!el || !isTextInput(el)) return
    const field = el as HTMLInputElement | HTMLTextAreaElement
    if (domField === field) {
      // Already tracking — make sure visuals are applied (idempotent)
      applyFieldVisuals(field)
      return
    }
    if (domField) commitDOMField()
    domField          = field
    domFieldOrigValue = field.value
    domFieldHadSpeech = false
    applyFieldVisuals(field)
  }

  function appendToDOMField(text: string): void {
    if (!domField) return
    const cur = domField.value.trimEnd()
    domField.value = cur ? `${cur} ${text}` : text
    domField.dispatchEvent(new Event('input',  { bubbles: true }))
    domField.dispatchEvent(new Event('change', { bubbles: true }))

    // Start / reset 5-second silence timer now that there's been speech
    domFieldHadSpeech = true
    clearSilenceTimer()
    silenceTimer = setTimeout(() => commitDOMField(true), SILENCE_MS)
  }

  // ── Ref text mode (explicit, for components that manage their own state) ───

  let textTarget:   Ref<string> | null = null
  let onTextCommit: (() => void) | null = null
  let onTextCancel: (() => void) | null = null

  function enterTextMode(
    target: Ref<string>,
    callbacks?: { onCommit?: () => void; onCancel?: () => void }
  ): void {
    textTarget   = target
    onTextCommit = callbacks?.onCommit ?? null
    onTextCancel = callbacks?.onCancel ?? null
    ensureRunning()
  }

  function exitTextMode(): void {
    textTarget   = null
    onTextCommit = null
    onTextCancel = null
  }

  // ── Transcript handler ──────────────────────────────────────────────────────

  /**
   * Returns true when a visible modal dialog is open AND the current voice
   * target field is NOT inside that dialog.
   *
   * The guard exists so that voice commands reach a modal's own buttons
   * rather than silently typing into a background field. But if the user
   * has focused a field *inside* the dialog (e.g. the SpecCoach chat input),
   * that field IS the intended target — we must not intercept.
   */
  function isModalOpen(): boolean {
    const els = document.querySelectorAll<HTMLElement>('[role="dialog"]')
    for (const el of els) {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) {
        // If the active voice field lives inside this dialog, the dialog is
        // not "blocking" from our perspective — speech should go to that field.
        if (domField && el.contains(domField)) continue
        return true
      }
    }
    return false
  }

  function handleTranscript(text: string): void {
    lastHeard.value = text
    // normaliseSpelling applied here so mike→mic, -ise→-ize etc. are resolved
    // for ALL checks below (wake phrases, sleep phrases, commands, button scan).
    const lower = normaliseSpelling(text.toLowerCase().trim())
    // lowerStripped: fillers ("the", "a", "an", "please", "my", "your") removed.
    // Used only in command dict matching so that natural insertions like
    // "generate the spec" still match the command "Generate Spec".
    // Wake/sleep phrase checks keep the unstripped form to stay predictable.
    const lowerStripped = stripFillers(lower)

    // ── Wake / Sleep phrases — checked FIRST, before field mode ──────────────
    // These are global commands that must work regardless of what the mic is
    // doing — even if a field is focused and actively receiving dictation.
    if (!active.value) {
      if (WAKE_PHRASES.some(p => lower.includes(p))) {
        active.value = true
        try { localStorage.setItem(STORAGE_KEY, 'true') } catch { /* ignore */ }
        // If a field is already focused, activate it immediately.
        activateCurrentField()
        // If no field was focused (domField still null), find the best visible
        // text input, focus it, and activate it — so the user gets the pulsing
        // ring and the very next utterance lands in a field without needing a click.
        if (!domField) {
          const best = findBestTextField()
          if (best) {
            best.focus()
            activateCurrentField()
          }
        }
        return
      }
      // In wake mode: every visible button is still reachable by name.
      tryDOMButton(lower)
      return
    }

    if (SLEEP_PHRASES.some(p => lower.includes(p))) {
      active.value = false
      try { localStorage.setItem(STORAGE_KEY, 'false') } catch { /* ignore */ }
      // Commit and release any focused field — mic is now off, stop field mode
      if (domField) commitDOMField()
      return
    }

    // ── DOM field mode ────────────────────────────────────────────────────────
    // Skip field mode when a modal dialog is open — the user is talking to the
    // modal, not the background field. Route directly to button scanning so that
    // short commands like "next", "back", "skip" reach the modal's buttons.
    if (domField && isModalOpen()) {
      tryDOMButton(lower)
      return
    }

    if (domField && active.value) {
      if (COMMIT_PHRASES.some(p => lower === p || lower.endsWith(` ${p}`))) {
        // Strip trailing commit phrase from text before appending
        const stripped = COMMIT_PHRASES
          .reduce((s, p) => s.replace(new RegExp(`\\s*\\b${p}\\b\\s*$`, 'i'), ''), text)
          .trim()
        if (stripped) appendToDOMField(stripped)
        commitDOMField()
        return
      }
      if (CANCEL_PHRASES.some(p => lower.includes(p))) {
        cancelDOMField()
        return
      }
      // If the spoken phrase matches a labeled button (label ≥ 8 chars to avoid
      // short words like "add" firing mid-dictation), commit the current field
      // content first then fire the button.  This lets "parse my input" or
      // "generate planguage spec" work without needing "done" beforehand.
      const matchedBtn = findDOMButton(lower, 8)
      if (matchedBtn) {
        commitDOMField()
        matchedBtn.click()
        return
      }
      // Also check the explicit command dictionary — catches named actions
      // (e.g. "Parse my input", "Generate") even when the DOM scan misses the
      // button (off-screen, zero-rect on some iOS reflows, etc.).
      // Require ≥ 8-char phrases so common dictation words can't accidentally
      // fire a command mid-sentence.
      for (const [phrase, action] of sortedCommands) {
        if (phrase.length >= 8 && lowerStripped.includes(stripFillers(normaliseSpelling(phrase.toLowerCase())))) {
          commitDOMField()
          action()
          return
        }
      }
      // Last-resort sleep check — in case the phrase somehow reached field mode
      if (SLEEP_PHRASES.some(p => lower.includes(p))) {
        active.value = false
        try { localStorage.setItem(STORAGE_KEY, 'false') } catch { /* ignore */ }
        commitDOMField()
        return
      }
      // Wake-phrase guard — mic is already on but the user said "Turn On Mic" (or
      // any other wake phrase).  Commit the field so the word isn't typed in, then
      // leave the mic running.  This handles two situations:
      //   1. The user is testing whether the mic is alive.
      //   2. The mic was active but the speech session silently died; the user
      //      instinctively repeats the activation phrase.
      // Either way: commit + no-op is safer than typing "Turn On Mic" into the field.
      if (WAKE_PHRASES.some(p => lower.includes(p))) {
        commitDOMField()
        return
      }
      appendToDOMField(text)
      return
    }

    // ── Ref text mode ─────────────────────────────────────────────────────────
    if (textTarget) {
      if (COMMIT_PHRASES.some(p => lower === p || lower.endsWith(` ${p}`))) {
        const stripped = COMMIT_PHRASES
          .reduce((s, p) => s.replace(new RegExp(`\\s*\\b${p}\\b\\s*$`, 'i'), ''), text)
          .trim()
        if (stripped) textTarget.value = (textTarget.value + ' ' + stripped).trim()
        const cb = onTextCommit; exitTextMode(); cb?.()
        return
      }
      if (CANCEL_PHRASES.some(p => lower.includes(p))) {
        const cb = onTextCancel; exitTextMode(); cb?.()
        return
      }
      textTarget.value = (textTarget.value + ' ' + text).trim()
      return
    }

    // Explicit command dictionary (longest phrase wins)
    // lowerStripped removes articles/fillers so "generate the spec" matches "Generate Spec".
    // commandPhraseMatches applies whole-word boundaries for short phrases (≤ 5 chars)
    // so "goal" doesn't fire "Go", "next thing" doesn't fire "Next", etc.
    for (const [phrase, action] of sortedCommands) {
      if (commandPhraseMatches(stripFillers(normaliseSpelling(phrase.toLowerCase())), lowerStripped)) {
        action()
        return
      }
    }

    // ── Soft-paused field re-activation ──────────────────────────────────────
    // The silence timer fired a soft-commit (domField → null) but the text field
    // is still focused and showing the ⏸ placeholder.  Resume dictation rather
    // than discarding the words into the void.  Commit/cancel phrases in this
    // state fall through to the DOM scan (safe no-op) rather than being typed.
    if (!textTarget
        && !COMMIT_PHRASES.some(p => lower === p || lower.endsWith(` ${p}`))
        && !CANCEL_PHRASES.some(p => lower.includes(p))) {
      const el = document.activeElement as HTMLElement | null
      if (el && isTextInput(el) && el.placeholder === PAUSED_PLACEHOLDER) {
        activateCurrentField()   // re-sets domField from document.activeElement
        if (domField) { appendToDOMField(text); return }
      }
    }

    // DOM button fallback
    tryDOMButton(lower)
  }

  // ── Recognition lifecycle ───────────────────────────────────────────────────

  function buildRecognition(): SpeechRecognition {
    const r: SpeechRecognition = new SR()
    r.continuous     = true
    r.interimResults = false
    r.lang           = 'en-US'

    r.onresult = (event: SpeechRecognitionEvent) => {
      const result = event.results[event.results.length - 1]
      if (result.isFinal) {
        startedOnce = true
        handleTranscript(result[0].transcript.trim())
      }
    }

    r.onstart = () => {
      startedOnce      = true
      micBlocked.value = false
      // Recognition successfully restarted after an app-switch — safe to clear
      // the blur guard now. Any error from here on is a genuine permission issue.
      pausedByBlur = false
    }

    r.onend = () => {
      if (keepAlive) {
        // Always rebuild — reusing a stale instance causes silent failures where
        // onend fires but r.start() is a no-op and recognition goes dead quietly.
        recognition = buildRecognition()
        try { recognition.start() } catch { /* ignore */ }
      }
    }

    r.onerror = (event: SpeechRecognitionErrorEvent) => {
      // If we stopped recognition because the window lost focus (handleBlur),
      // any error is a false positive from the deliberate stop — not a real
      // permission denial. Ignore it so micBlocked is never set on app-switch.
      if (pausedByBlur) return
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        keepAlive        = false
        active.value     = false
        micBlocked.value = true
        recognition      = null   // force fresh instance on next attempt
        try { localStorage.setItem(STORAGE_KEY, 'false') } catch { /* ignore */ }
        // Remove voice ring + restore placeholder — mic is blocked, ring would be misleading
        if (domField) removeFieldVisuals(domField)
        domField          = null
        domFieldHadSpeech = false
        clearSilenceTimer()
      }
    }

    return r
  }

  function ensureRunning(): void {
    if (!supported) return
    if (!recognition) recognition = buildRecognition()
    keepAlive = true
    try { recognition.start() } catch { /* already running */ }
  }

  // ── Focus guard — field text mode ───────────────────────────────────────────

  function handleFocusin(e: FocusEvent): void {
    // Only enter field mode when the mic is actively on (user-activated).
    // In wake-only mode (active=false) we leave recognition in command mode so
    // spoken words are never silently typed into inputs.
    if (!supported || !active.value) return
    const target = e.target as HTMLElement
    if (!isTextInput(target)) return
    if (domField === target) {
      // Already tracking — ensure visuals are shown (idempotent)
      applyFieldVisuals(domField)
      return
    }

    // Commit any previous field before switching
    if (domField) commitDOMField()

    domField          = target as HTMLInputElement | HTMLTextAreaElement
    domFieldOrigValue = domField.value
    domFieldHadSpeech = false
    applyFieldVisuals(domField)

    // Ensure recognition is running so the field can hear speech immediately.
    // This is a no-op if keepAlive is already true.
    if (!keepAlive) ensureRunning()
  }

  function handleFocusout(e: FocusEvent): void {
    if (domField && e.target === domField) {
      // User navigated away — commit whatever is in the field
      clearSilenceTimer()
      removeFieldVisuals(domField)
      domField          = null
      domFieldHadSpeech = false
    }
  }

  // ── Browser focus guard (Zoom / other apps) ─────────────────────────────────

  function handleBlur(): void {
    if (keepAlive) {
      pausedByBlur = true
      keepAlive    = false
      try { recognition?.stop() } catch { /* ignore */ }
      // Null the instance so ensureRunning() always builds a fresh one on return.
      // A stopped SpeechRecognition that is restarted on iOS Safari reliably fires
      // 'not-allowed'; a brand-new instance does not have that problem.
      recognition  = null
    }
  }

  function handleFocus(): void {
    if (pausedByBlur) {
      // Do NOT clear pausedByBlur here — it is cleared inside r.onstart once the
      // fresh recognition instance actually starts.  Clearing it before the start
      // call means a failed restart (onerror: 'not-allowed') would see
      // pausedByBlur=false and set micBlocked=true as a false positive.
      ensureRunning()
      // Re-apply voice ring to whatever field is focused after the tab switch
      activateCurrentField()
    }
  }

  // ── Keyboard shortcut ───────────────────────────────────────────────────────

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'F5' || e.key === 'MicrophoneToggle') {
      e.preventDefault()
      e.stopPropagation()
      toggle()
    }
    // Escape in field mode → cancel
    if (e.key === 'Escape' && domField) {
      cancelDOMField()
    }
    // Enter in field mode → commit
    if (e.key === 'Enter' && domField) {
      commitDOMField()
    }
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  function start(): void {
    active.value     = true
    micBlocked.value = false
    try { localStorage.setItem(STORAGE_KEY, 'true') } catch { /* ignore */ }
    ensureRunning()
    // If a text field is already focused, activate it immediately (no focusin fires).
    activateCurrentField()
    // If focus was on the mic button (or anywhere that isn't a text field),
    // domField is still null — find the best visible input, focus it, and
    // activate the voice ring so the user gets immediate visual feedback.
    if (!domField) {
      const best = findBestTextField()
      if (best) {
        best.focus()
        activateCurrentField()
      }
    }
  }

  function stop(): void {
    active.value = false
    if (domField) commitDOMField()   // commit any open field on mode exit
    try { localStorage.setItem(STORAGE_KEY, 'false') } catch { /* ignore */ }
  }

  function toggle(): void { active.value ? stop() : start() }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  onMounted(() => {
    injectVoiceCSS()

    try {
      if (localStorage.getItem(STORAGE_KEY) === 'true') active.value = true
    } catch { /* ignore */ }

    window.addEventListener('blur',    handleBlur)
    window.addEventListener('focus',   handleFocus)
    window.addEventListener('keydown', handleKeydown, { capture: true })
    document.addEventListener('focusin',  handleFocusin)
    document.addEventListener('focusout', handleFocusout)

    // If a text field was already focused before listeners registered
    // (e.g. SEMEntryForm auto-focuses its textarea on mount), activate it now.
    activateCurrentField()

    // Auto-resume: if the user had the mic ON in their last session, restart
    // the wake listener automatically.  A 1 s delay lets App.vue's
    // _warmMicPermission() finish caching the OS grant so SpeechRecognition
    // can start silently without a permission dialog.
    // If the browser still blocks it (Safari first-load, mic denied, etc.),
    // r.onerror fires 'not-allowed' → micBlocked = true → user sees the
    // blocked indicator on the DictateButton and can click to retry.
    if (active.value) {
      setTimeout(() => { ensureRunning() }, 1000)
    }
  })

  onUnmounted(() => {
    keepAlive = false
    clearSilenceTimer()
    window.removeEventListener('blur',    handleBlur)
    window.removeEventListener('focus',   handleFocus)
    window.removeEventListener('keydown', handleKeydown, { capture: true })
    document.removeEventListener('focusin',  handleFocusin)
    document.removeEventListener('focusout', handleFocusout)
    try { recognition?.stop() } catch { /* ignore */ }
    savedPlaceholders.clear()
  })

  return {
    active, lastHeard, supported, micBlocked,
    toggle, start, stop,
    enterTextMode, exitTextMode,
  }
}
