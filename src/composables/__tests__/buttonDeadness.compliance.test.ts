/**
 * buttonDeadness.compliance.test.ts
 *
 * Structural guard for dead / unwired buttons in .vue files.
 *
 * Root cause of the OPTIMA rebalancing buttons bug (2026-06-05):
 *   Button 1 was wired to fixViolations() which is a no-op when there are no
 *   Tolerable violations. The label said "↑ Lift lowest resources to Goal" but
 *   the implementation did nothing visible in demo mode. Fixed by implementing
 *   liftToGoal() and wiring it correctly.
 *
 * This test catches the STRUCTURAL class of dead buttons:
 *   A. Buttons with no @click or v-on:click attribute (guaranteed non-responsive).
 *   B. Buttons with an explicitly empty @click="" (no-op by definition).
 *
 * Semantic dead buttons (handler exists but does nothing meaningful) require
 * runtime or end-to-end tests — not covered here.
 *
 * Parser design:
 *   1. HTML comments (<!-- ... -->) are blanked out (non-newline chars → spaces)
 *      so that mentions of <button> in comment text are not scanned.
 *      Line numbers are preserved because newlines within comments are kept.
 *   2. A quote-aware walker finds the REAL closing > of the opening tag —
 *      skipping > characters that appear inside "..." or '...' attribute values
 *      (e.g. v-if="length > 0", title="close [->", :disabled="idx > 0").
 *
 * Exemptions (not flagged):
 *   - type="submit" — handled by a parent <form @submit.prevent="…">
 *   - disabled / :disabled — intentionally non-interactive
 *   - Bare <button> with no non-type attributes — slot-wrapper pattern that
 *     inherits @click from the caller via v-bind="$attrs".
 */

import fs   from 'node:fs'
import path from 'node:path'

// ─── File helpers ─────────────────────────────────────────────────────────────

function findVueFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...findVueFiles(full))
    else if (entry.name.endsWith('.vue')) out.push(full)
  }
  return out
}

/**
 * Extract every <button …> opening tag from file content.
 *
 * Two-pass approach:
 *   1. Replace HTML comment bodies (preserving newlines) so <!-- mentions of
 *      <button> --> are not scanned as real tags.
 *   2. Walk with a simple state machine that tracks single/double quote nesting
 *      so that '>' inside attribute values does not prematurely end the tag.
 */
function extractButtonTags(rawContent: string): Array<{ tag: string; line: number }> {
  // Blank comment interiors — replace non-newline chars with spaces so that
  // (a) line numbers are unchanged and (b) <button> in comments isn't matched.
  const content = rawContent.replace(/<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, ' '))

  const results: Array<{ tag: string; line: number }> = []
  let pos = 0

  while (true) {
    const start = content.indexOf('<button', pos)
    if (start === -1) break

    // Reject if immediately followed by an identifier char (e.g. <buttonGroup)
    const charAfter = content[start + 7]
    if (charAfter && /[a-zA-Z0-9_-]/.test(charAfter)) { pos = start + 7; continue }

    // Quote-aware scan for the closing > of this opening tag
    let i = start + 7
    let inDouble = false
    let inSingle = false
    let foundEnd = false

    while (i < content.length) {
      const ch = content[i]
      if      (ch === '"' && !inSingle) inDouble = !inDouble
      else if (ch === "'" && !inDouble) inSingle = !inSingle
      else if (ch === '>' && !inDouble && !inSingle) {
        const tag = content.slice(start, i + 1)
        const ln  = content.slice(0, start).split('\n').length
        results.push({ tag, line: ln })
        pos = i + 1
        foundEnd = true
        break
      }
      i++
    }

    if (!foundEnd) break  // malformed / unclosed tag — stop
  }

  return results
}

// ─── Attribute predicates ─────────────────────────────────────────────────────

/**
 * Returns true when the tag carries any Vue pointer/interaction handler.
 * Covers @click, @dblclick (glyph info buttons), @mousedown (e.g. SelectionDefiner pill),
 * @pointerdown, and their v-on: equivalents.
 * Any of these means the button IS responsive — not dead.
 */
function hasClickHandler(tag: string): boolean {
  // Primary click
  if (/@click(?:\.[a-z]+)*\s*=/.test(tag))        return true
  if (/v-on:click(?:\.[a-z]+)*\s*=/.test(tag))    return true
  // Double-click (glyph detail buttons — intentional dblclick-only interaction)
  if (/@dblclick(?:\.[a-z]+)*\s*=/.test(tag))     return true
  if (/v-on:dblclick(?:\.[a-z]+)*\s*=/.test(tag)) return true
  // mousedown / pointerdown (e.g. Illuminate pill — prevents selection loss on click)
  if (/@mousedown(?:\.[a-z]+)*\s*=/.test(tag))    return true
  if (/@pointerdown(?:\.[a-z]+)*\s*=/.test(tag))  return true
  return false
}

/** Returns true when @click is present but explicitly empty ("" or ''). */
function hasEmptyClickHandler(tag: string): boolean {
  return /@click(?:\.[a-z]+)*\s*=\s*["']\s*["']/.test(tag) ||
         /v-on:click(?:\.[a-z]+)*\s*=\s*["']\s*["']/.test(tag)
}

/** Returns true for type="submit" — handled by a parent form. */
function isSubmitButton(tag: string): boolean {
  return /type\s*=\s*["']submit["']/.test(tag)
}

/** Returns true when the button is explicitly disabled. */
function isDisabledButton(tag: string): boolean {
  // Covers: disabled   :disabled="..."   v-bind:disabled="..."
  return /(?:^|[\s\n])disabled(?:[\s\n>]|$)/.test(tag) ||
         /(?::disabled|v-bind:disabled)\s*=/.test(tag)
}

/**
 * Returns true for bare slot-wrapper buttons — <button> or <button type="button">
 * with no other attributes. These are wrapper components whose caller provides
 * the @click via v-bind="$attrs" / inheritAttrs-false. Not flagged.
 */
function isBareSlotWrapper(tag: string): boolean {
  // Strip <button, type="..", whitespace and the closing >
  const body = tag
    .replace(/^<button\s*/i, '')
    .replace(/type\s*=\s*["'][^"']*["']\s*/g, '')
    .replace(/\/?>$/, '')
    .trim()
  return body === ''
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Button compliance — dead button scan', () => {

  const SRC_DIR  = path.resolve(__dirname, '../..')   // → sem-app/src
  const vueFiles = findVueFiles(SRC_DIR)

  it('all .vue files found (sanity check)', () => {
    expect(vueFiles.length).toBeGreaterThan(20)
  })

  it('every non-trivial <button> must have a @click handler (structural dead-button check)', () => {
    const violations: string[] = []

    for (const file of vueFiles) {
      const content = fs.readFileSync(file, 'utf-8')
      const buttons = extractButtonTags(content)

      for (const { tag, line } of buttons) {
        if (isSubmitButton(tag))    continue  // form-handled
        if (isDisabledButton(tag))  continue  // intentionally non-interactive
        if (isBareSlotWrapper(tag)) continue  // inherits @click from caller

        if (!hasClickHandler(tag)) {
          const rel = path.relative(SRC_DIR, file)
          violations.push(
            `${rel}:${line}\n    ↳ ${tag.replace(/\s+/g, ' ').trim().slice(0, 140)}`
          )
        }
      }
    }

    const message = violations.length
      ? [
          `${violations.length} <button> element(s) have no @click handler.`,
          'A button without @click is unresponsive — structurally dead.',
          'Fix: add @click="functionName" or @click="() => { … }" to each.',
          'To suppress this check: add disabled for intentionally non-interactive buttons,',
          'or type="submit" if handled by a parent <form @submit.prevent="…">.',
          '',
          ...violations.map(v => `  • ${v}`),
        ].join('\n')
      : ''

    expect(violations, message).toHaveLength(0)
  })

  it('no <button> has an explicitly empty @click="" handler', () => {
    const violations: string[] = []

    for (const file of vueFiles) {
      const content = fs.readFileSync(file, 'utf-8')
      const buttons = extractButtonTags(content)

      for (const { tag, line } of buttons) {
        if (hasEmptyClickHandler(tag)) {
          const rel = path.relative(SRC_DIR, file)
          violations.push(
            `${rel}:${line}\n    ↳ ${tag.replace(/\s+/g, ' ').trim().slice(0, 140)}`
          )
        }
      }
    }

    const message = violations.length
      ? [
          `${violations.length} <button> element(s) have @click="" (explicitly empty — no-op).`,
          'Fix: implement the handler, or remove the button.',
          '',
          ...violations.map(v => `  • ${v}`),
        ].join('\n')
      : ''

    expect(violations, message).toHaveLength(0)
  })

})
