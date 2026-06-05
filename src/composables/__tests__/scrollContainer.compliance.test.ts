/**
 * scrollContainer.compliance.test.ts
 *
 * Regression guard for the "panel does not scroll" bug family.
 *
 * Root cause (fixed 2026-06-05, r10–r12):
 *   `overflow-y-auto` only triggers scroll when the element's rendered height
 *   is LESS than its content height. In every panel that uses a `flex-1 min-h-0`
 *   outer, the inner scrollable div had no explicit height — it grew freely to fit
 *   all content, so scroll never activated. 35+ panels were affected.
 *
 * The fix: ScrollContainer.vue's `resolvedInnerClass` computed auto-injects
 * `h-full` when the outer contains `min-h-0` (checked in both the `outer-class`
 * prop AND the plain `class` attr, since some callers use the latter). Callers
 * that explicitly set max-height via innerStyle are not affected.
 *
 * These tests ensure:
 *   A. The self-heal logic itself is correct (pure-function unit tests).
 *   B. Every .vue file in src/ that contains a ScrollContainer with `flex-1`
 *      also has `min-h-0` — so the self-heal can fire and the panel will scroll.
 *      If any future panel is added without `min-h-0`, this test fails immediately.
 */

import fs   from 'node:fs'
import path from 'node:path'

// ─── Pure replica of ScrollContainer's resolvedInnerClass logic ───────────────
// Must stay in sync with src/components/ScrollContainer.vue.
// If that logic changes, update this replica to match.
function resolveInnerClass(
  outerClassProp: string,
  callerClassAttr: string,
  innerClass:      string,
  innerStyle:      string,
): string {
  const needsHFull =
    (outerClassProp.includes('min-h-0') || callerClassAttr.includes('min-h-0')) &&
    !innerClass.includes('h-full') &&
    !innerStyle.includes('max-height') &&
    !innerStyle.includes('height:')
  return needsHFull ? `h-full ${innerClass}`.trimEnd() : innerClass
}

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
 * Extract every <ScrollContainer …> opening tag from file content.
 * Handles single-line and multi-line attribute blocks.
 * Stops at the first `>` that closes the opening tag.
 */
function extractScrollContainerTags(content: string): string[] {
  const tags: string[] = []
  let pos = 0
  while (true) {
    const start = content.indexOf('<ScrollContainer', pos)
    if (start === -1) break
    const end = content.indexOf('>', start)
    if (end === -1) break
    tags.push(content.slice(start, end + 1))
    pos = end + 1
  }
  return tags
}

/** Return the value of an HTML/Vue attribute, or '' if absent. */
function attrValue(tag: string, attr: string): string {
  // Matches both: attr="value"  and  :attr="value"  (even across newlines)
  const re = new RegExp(`(?:^|[\\s\\n])${attr}="([^"]*)"`, 's')
  const m  = tag.match(re)
  return m ? m[1].replace(/\s+/g, ' ').trim() : ''
}

// ─── Unit tests: self-heal logic ─────────────────────────────────────────────

describe('ScrollContainer — resolveInnerClass self-heal logic', () => {

  it('injects h-full when outer-class prop contains min-h-0', () => {
    expect(resolveInnerClass('flex-1 min-h-0 relative', '', 'p-5 space-y-5', ''))
      .toBe('h-full p-5 space-y-5')
  })

  it('injects h-full when class attr (via attrs) contains min-h-0', () => {
    expect(resolveInnerClass('', 'flex-1 min-h-0', 'p-5', ''))
      .toBe('h-full p-5')
  })

  it('injects h-full when inner-class is empty', () => {
    expect(resolveInnerClass('flex-1 min-h-0', '', '', ''))
      .toBe('h-full')
  })

  it('does NOT inject h-full when inner-class already contains h-full', () => {
    expect(resolveInnerClass('flex-1 min-h-0', '', 'h-full p-5', ''))
      .toBe('h-full p-5')
  })

  it('does NOT inject h-full when outer has no min-h-0 (plain flex-1)', () => {
    expect(resolveInnerClass('flex-1', '', 'p-5', '')).toBe('p-5')
    expect(resolveInnerClass('', 'flex-1', 'p-5', '')).toBe('p-5')
  })

  it('does NOT inject h-full when inner-style sets max-height (explicit bounded scroll)', () => {
    expect(resolveInnerClass('flex-1 min-h-0', '', 'p-5', 'max-height: 24rem'))
      .toBe('p-5')
    expect(resolveInnerClass('flex-1 min-h-0', '', 'p-5', 'max-height: 16rem'))
      .toBe('p-5')
  })

  it('does NOT inject h-full when inner-style sets explicit height', () => {
    expect(resolveInnerClass('flex-1 min-h-0', '', 'p-5', 'height: 300px'))
      .toBe('p-5')
  })

  it('returns inner-class unchanged when there is no flex constraint', () => {
    expect(resolveInnerClass('', '', 'p-5 space-y-4', '')).toBe('p-5 space-y-4')
  })

  it('handles both outer-class prop and class attr simultaneously', () => {
    // Both present — either one having min-h-0 is sufficient
    expect(resolveInnerClass('relative', 'flex-1 min-h-0 bg-slate-950', 'p-6', ''))
      .toBe('h-full p-6')
  })

})

// ─── Compliance scan: every panel file ───────────────────────────────────────

describe('ScrollContainer — panel compliance scan', () => {

  const SRC_DIR = path.resolve(__dirname, '../..')   // → sem-app/src
  const vueFiles = findVueFiles(SRC_DIR)

  it('all .vue files found (sanity check)', () => {
    expect(vueFiles.length).toBeGreaterThan(20)
  })

  it('every ScrollContainer with flex-1 must also have min-h-0 (scroll will not work without it)', () => {
    const violations: string[] = []

    for (const file of vueFiles) {
      const content = fs.readFileSync(file, 'utf-8')
      const tags    = extractScrollContainerTags(content)

      for (const tag of tags) {
        const classAttr    = attrValue(tag, 'class')
        const outerAttr    = attrValue(tag, 'outer-class')
        const combinedOuter = `${classAttr} ${outerAttr}`

        if (combinedOuter.includes('flex-1') && !combinedOuter.includes('min-h-0')) {
          const rel = path.relative(SRC_DIR, file)
          violations.push(`${rel}\n    ↳ ${tag.replace(/\s+/g, ' ').trim().slice(0, 160)}`)
        }
      }
    }

    const message = violations.length
      ? [
          `${violations.length} ScrollContainer(s) have flex-1 but no min-h-0.`,
          'Without min-h-0 the inner div grows freely — overflow-y-auto never fires — panel will NOT scroll.',
          'Fix: add min-h-0 to the class or outer-class attribute on the ScrollContainer.',
          '',
          ...violations.map(v => `  • ${v}`),
        ].join('\n')
      : ''

    expect(violations, message).toHaveLength(0)
  })

  it('no ScrollContainer uses outer-class with flex-1 but missing min-h-0 (outer-class= variant)', () => {
    // Separate check focusing purely on outer-class= prop (belt-and-suspenders)
    const violations: string[] = []

    for (const file of vueFiles) {
      const content = fs.readFileSync(file, 'utf-8')
      const tags    = extractScrollContainerTags(content)

      for (const tag of tags) {
        const outer = attrValue(tag, 'outer-class')
        if (outer.includes('flex-1') && !outer.includes('min-h-0')) {
          const rel = path.relative(SRC_DIR, file)
          violations.push(`${rel}  outer-class="${outer}"`)
        }
      }
    }

    expect(violations, violations.join('\n')).toHaveLength(0)
  })

})
