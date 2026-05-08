// UNIT_TYPE=Hook
// useSpeaker — Text-to-speech output composable wrapping Web SpeechSynthesis API.
// Independent of useDictation (mic input). Always-present loudspeaker function.

import { ref, readonly } from 'vue'

const _synth = typeof window !== 'undefined' ? window.speechSynthesis : null

/** True when the browser has SpeechSynthesis support */
export const speakerSupported = !!_synth

const _speaking = ref(false)
const _paused   = ref(false)

/** Reactive: true while an utterance is playing */
export const speaking = readonly(_speaking)

/** Reactive: true while speech is paused mid-utterance */
export const paused   = readonly(_paused)

function _syncState(): void {
  if (!_synth) return
  _speaking.value = _synth.speaking
  _paused.value   = _synth.paused
}

/**
 * Speak the given text aloud.
 * Cancels any in-flight utterance first.
 * @param text   Plain text to speak (HTML/Markdown stripped by caller or here)
 * @param lang   BCP-47 language tag (default 'en-GB')
 * @param rate   Speech rate 0.1–10 (default 1.0)
 */
export function speak(text: string, lang = 'en-GB', rate = 1.0): void {
  if (!_synth) return
  _synth.cancel()

  // Strip Markdown syntax so it doesn't get read literally
  const clean = text
    .replace(/#{1,6}\s+/g, '')          // headings
    .replace(/\*\*(.+?)\*\*/g, '$1')    // bold
    .replace(/\*(.+?)\*/g, '$1')        // italic
    .replace(/`{1,3}[^`]*`{1,3}/g, '') // code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
    .replace(/^[-*+]\s+/gm, '')        // list bullets
    .replace(/\n{2,}/g, '. ')          // paragraph breaks → pause
    .replace(/\n/g, ' ')
    .trim()

  if (!clean) return

  const utterance  = new SpeechSynthesisUtterance(clean)
  utterance.lang   = lang
  utterance.rate   = rate
  utterance.onstart = () => { _speaking.value = true; _paused.value = false }
  utterance.onend   = () => { _speaking.value = false; _paused.value = false }
  utterance.onerror = () => { _speaking.value = false; _paused.value = false }

  _synth.speak(utterance)
  _syncState()
}

/** Stop all speech immediately */
export function stopSpeaking(): void {
  if (!_synth) return
  _synth.cancel()
  _speaking.value = false
  _paused.value   = false
}

/** Toggle pause / resume mid-utterance */
export function togglePause(): void {
  if (!_synth) return
  if (_synth.paused) {
    _synth.resume()
    _paused.value = false
  } else {
    _synth.pause()
    _paused.value = true
  }
}
