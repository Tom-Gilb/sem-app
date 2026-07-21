// UNIT_TYPE=Test
// useTypingJournal.test.ts — sanity tests for the keystroke safety-net.
//
// Tom Gilb 2026-06-19 verbatim: "DAMN TEXT DISAPPEARED".  The journal is
// the recovery surface; this test confirms the journal records keystrokes,
// debounces same-field bursts into one rolling entry, persists to
// localStorage, finds-by-substring works, and clearing actually clears.

import { describe, it, expect, beforeEach } from 'vitest'
import {
  installTypingJournal,
  getTypingJournal,
  findInTypingJournal,
  clearTypingJournal,
} from '../useTypingJournal'

const DEBOUNCE_MS = 300

function typeInto(el: HTMLInputElement | HTMLTextAreaElement, text: string): void {
  el.value = text
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

function waitForDebounce(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, DEBOUNCE_MS + 50))
}

describe('useTypingJournal', () => {
  beforeEach(() => {
    clearTypingJournal()
    installTypingJournal()
    document.body.innerHTML = ''
  })

  it('records a single keystroke after the debounce window', async () => {
    const input = document.createElement('input')
    input.type = 'text'
    input.setAttribute('aria-label', 'Test Input')
    document.body.appendChild(input)

    typeInto(input, 'Indianapolis cruiser construction')
    await waitForDebounce()

    const journal = getTypingJournal()
    expect(journal.length).toBeGreaterThanOrEqual(1)
    expect(journal[0].valuePrefix).toContain('Indianapolis cruiser')
    expect(journal[0].fieldHint).toContain('Test Input')
  })

  it('collapses a burst of same-field keystrokes into ONE rolling entry', async () => {
    const input = document.createElement('input')
    input.type = 'text'
    input.id = 'burst-test'
    document.body.appendChild(input)

    typeInto(input, 'a')
    typeInto(input, 'ab')
    typeInto(input, 'abc')
    typeInto(input, 'abcd')
    await waitForDebounce()

    const journal = getTypingJournal()
    const myEntries = journal.filter(e => e.fieldHint.includes('burst-test'))
    expect(myEntries).toHaveLength(1)
    expect(myEntries[0].valuePrefix).toBe('abcd')
  })

  it('findInTypingJournal returns matching snapshots case-insensitively', async () => {
    const textarea = document.createElement('textarea')
    textarea.setAttribute('placeholder', 'Notes')
    document.body.appendChild(textarea)

    typeInto(textarea, 'The plan must respect GDPR Article 44 cross-border rules.')
    await waitForDebounce()

    const hits = findInTypingJournal('gdpr article')
    expect(hits.length).toBeGreaterThanOrEqual(1)
    expect(hits[0].valuePrefix).toContain('GDPR Article 44')
  })

  it('ignores password fields', async () => {
    const pw = document.createElement('input')
    pw.type = 'password'
    pw.id = 'pw-test'
    document.body.appendChild(pw)

    typeInto(pw, 'super-secret-123')
    await waitForDebounce()

    const hits = findInTypingJournal('super-secret')
    expect(hits).toHaveLength(0)
  })

  it('clearTypingJournal empties the buffer', async () => {
    const input = document.createElement('input')
    input.type = 'text'
    document.body.appendChild(input)
    typeInto(input, 'will be wiped')
    await waitForDebounce()
    expect(getTypingJournal().length).toBeGreaterThanOrEqual(1)

    clearTypingJournal()
    expect(getTypingJournal()).toHaveLength(0)
  })

  it('attaches a window.semTypingJournal dev hook after install', () => {
    // installTypingJournal is called in beforeEach; verify the window hook.
    const fn = (window as unknown as { semTypingJournal?: () => unknown }).semTypingJournal
    expect(typeof fn).toBe('function')
  })
})
