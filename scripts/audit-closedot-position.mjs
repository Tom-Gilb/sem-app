// Audit: detect <CloseDot> instances that are positioned at the START
// of their parent flex container (i.e. visually on the LEFT) instead of
// the END (visually on the RIGHT). Per CLAUDE.md Universal Close-Button
// Rule companion: every close pin should appear on the right side of its
// header so the affordance is in a consistent place across the app.
//
// Heuristic:
//   For each <CloseDot ...> opening tag, walk UPWARD over blank/comment
//   lines to find a "previous sibling" — the first line at the SAME
//   indent that opens with `<`. If we hit the parent (a shallower line
//   ending with `>`) without finding any same-indent sibling, CloseDot
//   is the FIRST child. Then verify the parent is a flex container and
//   flag it.
//
// Output:
//   src/components/CopyrightPanel.vue:183  LEFT  (parent flex opens at 180)

import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '../src/components')
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.vue'))

const flagged = []

function isCommentLine(t) {
  return t.startsWith('<!--') || t.startsWith('//') || t.endsWith('-->')
}

for (const file of files) {
  const full = path.join(ROOT, file)
  const lines = fs.readFileSync(full, 'utf8').split('\n')

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\s*)<CloseDot\b/)
    if (!m) continue
    const cdLine   = i + 1
    const cdIndent = m[1].length

    // Walk upward looking for either (a) a same-indent sibling tag, or
    // (b) a strictly shallower-indent line — that line is part of the
    // parent's opening tag (which may span multiple lines).
    let parentLine = -1
    let hasSiblingBefore = false
    for (let j = i - 1; j >= 0 && j > i - 80; j--) {
      const raw = lines[j]
      const trimmed = raw.trim()
      if (!trimmed) continue
      if (isCommentLine(trimmed)) continue
      const indent = (raw.match(/^(\s*)/)?.[1] ?? '').length

      if (indent === cdIndent && /^<[a-zA-Z]/.test(trimmed)) {
        // Same-indent sibling tag → CloseDot is NOT first child → fine
        hasSiblingBefore = true
        break
      }
      if (indent < cdIndent) {
        // First strictly shallower line — could be parent opener (one-line)
        // or the start/middle/end of a multi-line opener. Walk further up
        // to find the actual <tagname start.
        let openerStart = j
        for (let k = j; k >= 0 && k > j - 8; k--) {
          if (/^\s*<[a-zA-Z]/.test(lines[k])) { openerStart = k; break }
        }
        parentLine = openerStart
        break
      }
    }

    if (hasSiblingBefore || parentLine < 0) continue

    // Concatenate parent's opening tag (multi-line aware)
    let parentBlock = ''
    for (let k = parentLine; k < i; k++) {
      parentBlock += lines[k] + '\n'
      if (lines[k].includes('>')) break
    }

    if (/<div\b[^>]*\bclass="[^"]*\bflex\b/.test(parentBlock)) {
      flagged.push(`${path.relative(process.cwd(), full)}:${cdLine}  LEFT  (parent flex opens at ${parentLine + 1})`)
    }
  }
}

if (flagged.length) {
  console.log('Left-positioned CloseDot instances (should be moved to right):')
  for (const f of flagged) console.log('  ' + f)
  console.log(`\naudit-closedot-position: ${flagged.length} violation(s)`)
  process.exit(1)
} else {
  console.log('audit-closedot-position: 0 violation(s) — all CloseDots on the right')
}
