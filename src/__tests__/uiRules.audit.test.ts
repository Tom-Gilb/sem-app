/**
 * uiRules.audit.test.ts — runs the audit-ui-rules.mjs script as a Vitest
 * test so the two SEM-app universal rules are enforced in CI / npm test:unit.
 *
 *   1. Universal Scroll Rule — every scrollable region uses <ScrollContainer>.
 *   2. Universal Close-Button Rule — every closable surface uses <CloseDot>.
 *
 * If a new component violates either rule, this test fails with the audit's
 * line-by-line report.
 */
import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

// In Vitest with happy-dom, import.meta.url is not always a file:// URL, so
// resolve from process.cwd() (the package root) instead.
const scriptPath = resolve(process.cwd(), 'scripts', 'audit-ui-rules.mjs')

describe('SEM app universal UI rules', () => {
  it('every scrollable region is wrapped in <ScrollContainer> and every closable surface uses <CloseDot>', () => {
    const result = spawnSync('node', [scriptPath], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim()
    if (result.status !== 0) {
      throw new Error(
        `audit-ui-rules.mjs reported violations.\n\n${output}\n\n` +
          `Fix each line above by wrapping the offending region in <ScrollContainer> or replacing the close button with <CloseDot>. ` +
          `See vault CLAUDE.md "Universal Scroll Rule" and "Universal Close-Button Rule" for patterns. ` +
          `If an opt-out is genuinely warranted, add a "<!-- audit-ignore: scroll -->" comment immediately above the element with a one-line reason.`,
      )
    }
    expect(result.status).toBe(0)
  })
})
