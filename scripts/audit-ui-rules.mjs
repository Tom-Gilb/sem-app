#!/usr/bin/env node
/**
 * audit-ui-rules.mjs — enforces two SEM-app universal rules:
 *
 *   1. Universal Scroll Rule. Every scrollable region (overflow-y-auto,
 *      overflow-auto, max-h-*, max-height) MUST be wrapped in
 *      <ScrollContainer>. Without it the user gets no fade-edge cue and
 *      no bouncing pill — the scroll is silently invisible.
 *
 *   2. Universal Close-Button Rule. Every closable surface (modal, drawer,
 *      panel, dialog, popover) MUST use <CloseDot>. Never use ×, ✕, x, an
 *      SVG cross, or "⊖ Close" text as the close affordance.
 *
 * Both rules are codified in /Users/Tomgilbs/Documents/MyVault/CLAUDE.md.
 *
 * The audit reads every src/components/*.vue file and reports per-file
 * violations. Exit code 1 on any violation, 0 on clean.
 *
 * Usage:
 *   node scripts/audit-ui-rules.mjs
 *   npm run audit:ui          # if added to package.json scripts
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..', 'src', 'components')

// Files exempt from the rules entirely. Add sparingly + with reason.
const EXEMPT = new Set([
  'CloseDot.vue',          // the component itself
  'ScrollContainer.vue',   // the component itself
])

// ── Helpers ─────────────────────────────────────────────────────────────────

function listVueFiles(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const s = statSync(full)
    if (s.isDirectory()) out.push(...listVueFiles(full))
    else if (name.endsWith('.vue') && !name.endsWith('.bak') && !EXEMPT.has(name)) out.push(full)
  }
  return out
}

/**
 * Replace <script> and <style> blocks with whitespace of the same length so
 * line numbers in the resulting string still match the original source.
 * Avoids false positives from comments / class strings / type literals
 * while keeping line/column accuracy for violation reports.
 */
function templateOnly(src) {
  const replaceKeepLines = (s, re) =>
    s.replace(re, (block) => block.replace(/[^\n]/g, ' '))
  return replaceKeepLines(
    replaceKeepLines(src, /<script[\s\S]*?<\/script>/g),
    /<style[\s\S]*?<\/style>/g,
  )
}

/**
 * Find scrollable regions. Matches any element opening tag whose attributes
 * contain `overflow-y-auto`, `overflow-auto`, `overflow-x-auto`, `max-h-…`
 * (Tailwind), or inline `max-height:` style. Then walks ancestors backward
 * to check whether the element (or an ancestor inside the same root) is a
 * <ScrollContainer> tag, OR is itself the inner-class of a <ScrollContainer>.
 *
 * Heuristic but practical: we flag any open tag bearing one of those classes
 * unless the immediately enclosing tag (up to ~4 levels) is <ScrollContainer
 * …>, OR the matched tag is itself <ScrollContainer …>, OR the matched
 * attribute appears inside `inner-class="…"` / `outer-class="…"` of a
 * <ScrollContainer> on the same line (passthrough usage).
 */
function auditScrollRule(rel, tpl) {
  const violations = []
  // Strip <pre>…</pre> blocks — explicit exception per CLAUDE.md.
  const stripped = tpl.replace(/<pre[\s\S]*?<\/pre>/g, '')

  // Pattern: any tag whose attributes include the offending class/style.
  // We catch the tag NAME so we can ignore <ScrollContainer> itself.
  const tagRe = /<([A-Za-z][\w-]*)\b([^>]*?)\/?>/g
  let m
  while ((m = tagRe.exec(stripped)) !== null) {
    const [full, tagName, attrs] = m
    if (tagName === 'ScrollContainer') continue

    // Does the tag carry a vertical-scroll trigger?
    //
    // Excluded by design (per CLAUDE.md exceptions):
    //   - `overflow-x-auto` — table-scroll exception (horizontal); a vertical
    //     bouncing pill would be wrong here.
    //   - `max-h-*` combined with `overflow-hidden` — the documented modal
    //     restructure pattern (outer card is `flex flex-col overflow-hidden`,
    //     ScrollContainer wraps the inner body). Audit only flags the inner
    //     scrollable, not the outer card.
    //   - `max-h-*` combined with `overflow-x-auto` only — also exempt.
    const hasYScroll = /\boverflow-y-auto\b/.test(attrs) || /(^|\s|"|')overflow-auto(\s|"|'|$)/.test(attrs)
    // max-height present AND scrolling is actually possible on Y axis.
    // `overflow:hidden` means no scrollbar, so it's never a scroll surface.
    const hasInlineMaxHeight = /max-height\s*:/.test(attrs) && !/overflow\s*:\s*hidden/.test(attrs)
    const hasMaxH = /\bmax-h-(?!screen\b)[\w./[\]-]+/.test(attrs) || hasInlineMaxHeight
    const isOuterCard = /\boverflow-hidden\b/.test(attrs)
    const onlyXScroll = /\boverflow-x-auto\b/.test(attrs) && !hasYScroll
    const hasTrigger = (hasYScroll || (hasMaxH && !isOuterCard && !onlyXScroll))
    if (!hasTrigger) continue

    // Pass-through: trigger appears inside inner-class="…" of a
    // <ScrollContainer> elsewhere — those *are* the wrapper. Detect by
    // looking left ~200 chars for an unclosed <ScrollContainer.
    const window = stripped.slice(Math.max(0, m.index - 400), m.index)
    if (/<ScrollContainer\b[^>]*$/.test(window)) continue

    // Documented opt-out: a `<!-- audit-ignore: scroll -->` comment
    // somewhere in the preceding ~600 chars exempts this element. Use
    // sparingly + always with a one-line reason in the surrounding comment
    // (see SelectionDefiner.vue for an example).
    const optOutWindow = stripped.slice(Math.max(0, m.index - 600), m.index)
    if (/audit-ignore:\s*scroll/.test(optOutWindow)) continue

    // Find line number for the report.
    const lineNo = stripped.slice(0, m.index).split('\n').length
    violations.push({
      rule: 'scroll',
      file: rel,
      line: lineNo,
      detail: `<${tagName}> with ${attrs.match(/(overflow-[xy]?-auto|max-h-[\w./[\]-]+|max-height\s*:[^"']+)/)?.[0] ?? 'scroll-trigger'} not inside <ScrollContainer>`,
    })
  }
  return violations
}

/**
 * Find <button> elements whose visible text body is a close-glyph or
 * "⊖ Close" / "Close" + svg-cross AND whose @click looks like a window-close
 * call (emit('close'), props.onClose(), close()). Item-level remove/delete
 * buttons are intentionally allowed — they have aria-labels like
 * `Remove ${name}` / `Dismiss …` / `Delete …` and don't trigger a window close.
 */
function auditCloseRule(rel, tpl) {
  const violations = []
  const buttonRe = /<button\b([\s\S]*?)>([\s\S]*?)<\/button>/g
  let m
  while ((m = buttonRe.exec(tpl)) !== null) {
    const [, attrs, body] = m
    // Must look like a close-the-window click.
    const clickClose =
      /@click\s*=\s*"[^"]*\bemit\s*\(\s*['"]close['"]/.test(attrs) ||
      /@click\s*=\s*"[^"]*\bprops\.onClose\s*\(/.test(attrs) ||
      /@click\s*=\s*"[^"]*\bonClose\s*\(/.test(attrs) ||
      /@click\s*=\s*"\s*close\s*\(/.test(attrs)
    if (!clickClose) continue

    // Strip whitespace + comments from body for the glyph test.
    const visible = body
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\s+/g, '')

    // Allowed body: the body is empty (icon-only via slots) AND aria-label
    // says Close — but we want them to use CloseDot. So flag everything that
    // matches a close-click. Exception: the body contains <CloseDot — never,
    // because CloseDot wouldn't be wrapped in a <button>. In practice any
    // <button> with @click=emit('close') is a violation now.
    const looksLikeCloseGlyph =
      visible === '×' ||
      visible === '✕' ||
      visible === 'x' ||
      visible === 'X' ||
      visible === '⊖' ||
      visible === '⊖Close' ||
      visible.toLowerCase() === 'close' ||
      // SVG cross (rough): viewBox 0 0 20 20 cross path is the common one
      /M4\.293\s*4\.293/.test(visible) ||
      /<svg/.test(body) // any inline svg + close click is a violation
    if (!looksLikeCloseGlyph) continue

    // Documented opt-out: a `<!-- audit-ignore: close -->` comment in the
    // preceding ~600 chars exempts this button. Use sparingly + always with
    // a one-line reason (e.g. "secondary footer close", "navigation CTA").
    const closeOptOut = tpl.slice(Math.max(0, m.index - 600), m.index)
    if (/audit-ignore:\s*close/.test(closeOptOut)) continue

    const idx = m.index
    const lineNo = tpl.slice(0, idx).split('\n').length
    const sample = visible.length > 30 ? visible.slice(0, 30) + '…' : visible
    violations.push({
      rule: 'close',
      file: rel,
      line: lineNo,
      detail: `<button @click="…close…">${sample || '<svg/>'}</button> — replace with <CloseDot>`,
    })
  }
  return violations
}

// ── Main ────────────────────────────────────────────────────────────────────

const files = listVueFiles(ROOT)
let total = 0
const byRule = { scroll: 0, close: 0 }

for (const path of files) {
  const rel = path.slice(resolve(__dirname, '..').length + 1)
  const src = readFileSync(path, 'utf8')
  const tpl = templateOnly(src)
  const v = [...auditScrollRule(rel, tpl), ...auditCloseRule(rel, tpl)]
  for (const x of v) {
    total++
    byRule[x.rule]++
    console.log(`[${x.rule.toUpperCase()}] ${x.file}:${x.line}  ${x.detail}`)
  }
}

console.log('')
console.log(`audit-ui-rules: ${total} violation(s) — scroll=${byRule.scroll}, close=${byRule.close}`)
process.exit(total === 0 ? 0 : 1)
