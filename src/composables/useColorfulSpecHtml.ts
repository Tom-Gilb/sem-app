/**
 * useColorfulSpecHtml.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Colorful HTML Spec Export — FLAT TABLE STRUCTURE (Keynote-paste compatible).
 *
 * Tom Gilb, 2026-06-04 — three rounds of feedback shaped this:
 *   1. *"send colorful html version of the spec. more fun and dramatic"*
 *   2. *"no colored border rectangles, which it does in email copy but not in
 *      copy and paste in Keynote"*  → switched from <div> to <table>.
 *   3. *"the upper left text often is part hidden by the color bar just below"* +
 *      screenshot showing nested entry tables landing as FREE-FLOATING tables
 *      scattered across the Keynote slide  → forced this rewrite to a SINGLE
 *      FLAT TABLE with NO NESTED TABLES.
 *
 * Lesson learned about Keynote's HTML paste filter (the hard way):
 *   • `<div>` background colours, borders, and margins are STRIPPED.
 *   • Nested `<table>` inside a `<td>` becomes a SEPARATE Keynote table —
 *     placed wherever Keynote's layout engine likes, NOT inside the parent
 *     cell.  This is why Tom's screenshot showed each Value's sub-fields
 *     floating as a standalone table elsewhere on the slide.
 *   • Only ONE big flat `<table>` with `<tr>` rows and `bgcolor=` attributes
 *     reliably round-trips into a single Keynote table.
 *
 * Architecture of THIS implementation:
 *   • A single outer `<table>` with three columns: stripe / label / value.
 *   • Header rows: `colspan="3"`, gradient via `bgcolor` (gradient itself is
 *     stripped by Keynote but the solid fallback colour wins).
 *   • Each entry header row: stripe-colour `<td>` with `colspan="2"`
 *     carrying the ID, then a single value `<td>` carrying the description.
 *   • Each sub-field: stripe `<td>` (1 col) + label `<td>` + value `<td>`,
 *     three discrete cells — no nesting, no margin, no overflow.
 *   • Spacer rows: 6 px white `<tr>` between sections so adjacent coloured
 *     bars cannot visually collide (Tom 2026-06-04 fix).
 *
 * Compositions:
 *   • Colorful HTML Spec Email Rule (SUPREME, CLAUDE.md).
 *   • Gilb HTML Table Standard (`.claude/gilb-html-table-standard.md`).
 *   • SEM Email Body Standard (mailto: cue + plain inline body).
 *   • Twin portability — pure function, no Vue, no DOM dependency.
 */

import type { SpecBlock, FEntry, VEntry, SEntry, CEntry, REntry } from '../types/spec'

// ── Canonical Planguage type colours ──────────────────────────────────────────
const TYPE_COLOURS = {
  function:   { dark: '#15803d', mid: '#16a34a', soft: '#dcfce7', glyph: '[*]'  },
  value:      { dark: '#6d28d9', mid: '#7c3aed', soft: '#ede9fe', glyph: '[*+]' },
  solution:   { dark: '#c2410c', mid: '#ea580c', soft: '#ffedd5', glyph: '[*→]' },
  constraint: { dark: '#b91c1c', mid: '#dc2626', soft: '#fee2e2', glyph: '[*!]' },
  stakeholder:{ dark: '#1d4ed8', mid: '#2563eb', soft: '#dbeafe', glyph: '[§*]' },
  // Resources — dark teal (distinct from Function green; Tom Gilb 2026-06-04 r77).
  resource:   { dark: '#0f766e', mid: '#0d9488', soft: '#ccfbf1', glyph: '[$*]' },
} as const

type TypeColour = typeof TYPE_COLOURS[keyof typeof TYPE_COLOURS]

// ── HTML escape ───────────────────────────────────────────────────────────────
function esc(s: string | undefined | null): string {
  if (s == null) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ── Full-width spacer row (6 px white) between coloured bands ────────────────
const SPACER_ROW =
  `<tr><td colspan="3" bgcolor="#ffffff" height="6" style="background:#ffffff;height:6px;line-height:6px;font-size:1px;padding:0;">&nbsp;</td></tr>`

// ── Sub-field row: stripe + label + value ────────────────────────────────────
// Each LINE of the value gets its own <tr> so Keynote never sees wrappable
// text (it calculates row height up-front and clips extra lines).
// Stripe + label appear only on the first row; subsequent rows carry a blank
// same-colour filler in those positions — visually seamless since the fill
// colour matches. Same softWrap() pattern used for title rows.
// Tom 2026-06-05: "the lowest line of text is half hidden".
const SUBFIELD_VALUE_WRAP = 80  // safe chars per line at 12px in ~696px wide cell
function subFieldRow(
  stripeColour: string,
  softFill:     string,
  textColour:   string,
  label:        string,
  value:        string,
): string {
  if (!value || value.trim() === '' || value.trim() === '—') return ''
  const lines = softWrap(value, SUBFIELD_VALUE_WRAP)
  return lines.map((ln, idx) => {
    const isFirst = idx === 0
    const isLast  = idx === lines.length - 1
    const padTop  = isFirst ? '6px' : '0'
    const padBot  = isLast  ? '8px' : '0'
    const labelCell = isFirst
      ? `<td bgcolor="${softFill}" width="110" style="background:${softFill};color:${textColour};font-weight:700;font-size:11px;padding:6px 10px;white-space:nowrap;vertical-align:top;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${esc(label)}</td>`
      : `<td bgcolor="${softFill}" width="110" style="background:${softFill};padding:0 10px;">&nbsp;</td>`
    return `<tr>
    <td bgcolor="${stripeColour}" width="14" style="background:${stripeColour};width:14px;padding:0;">&nbsp;</td>
    ${labelCell}
    <td bgcolor="${softFill}" style="background:${softFill};color:#0f172a;font-size:12px;padding:${padTop} 10px ${padBot} 10px;white-space:normal;vertical-align:top;line-height:1.5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${esc(ln)}</td>
  </tr>`
  }).join('')
}

// ── Entry-ID + description row (the "headline" row for one spec entry) ───────
// Description is pre-split into per-line rows — same clipping prevention as
// subFieldRow. ID cell appears only on first row; remaining rows carry a
// same-colour filler so the coloured left column stays visually continuous.
const ENTRY_DESC_WRAP = 80  // safe chars per line at 13px in ~696px wide cell
function entryHeadRow(c: TypeColour, id: string, description: string): string {
  const lines = softWrap(description, ENTRY_DESC_WRAP)
  return lines.map((ln, idx) => {
    const isFirst = idx === 0
    const isLast  = idx === lines.length - 1
    const padTop  = isFirst ? '8px' : '0'
    const padBot  = isLast  ? '10px' : '0'
    const idCell = isFirst
      ? `<td colspan="2" bgcolor="${c.mid}" width="124" style="background:${c.mid};color:#ffffff;font-weight:700;font-size:12px;padding:8px 10px;vertical-align:top;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.4;">${descenderSafe(esc(id))}</td>`
      : `<td colspan="2" bgcolor="${c.mid}" width="124" style="background:${c.mid};padding:0 10px;">&nbsp;</td>`
    return `<tr>
    ${idCell}
    <td bgcolor="#ffffff" style="background:#ffffff;color:#0f172a;font-size:13px;line-height:1.5;padding:${padTop} 12px ${padBot} 12px;vertical-align:top;white-space:normal;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${esc(ln)}</td>
  </tr>`
  }).join('')
}

// ── Per-type renderers (each returns a string of <tr> rows for one entry) ────

function renderFunction(f: FEntry): string {
  const c = TYPE_COLOURS.function
  return entryHeadRow(c, f.id, f.description)
       + subFieldRow(c.mid, c.soft, c.dark, 'Presence test', f.presenceTest ?? f.successCriteria ?? '')
       + subFieldRow('#94a3b8', '#f8fafc', '#475569', 'Serves', f.functionOfValue ?? '')
}

function renderValue(v: VEntry): string {
  const c = TYPE_COLOURS.value
  return entryHeadRow(c, v.id, v.description)
       + subFieldRow(c.mid,    c.soft,    c.dark,    'Scale',     v.scale ?? '')
       + subFieldRow(c.mid,    c.soft,    c.dark,    'Meter',     v.meter ?? '')
       + subFieldRow('#d97706', '#fef3c7', '#92400e', 'Tolerable', v.tolerable ?? '')
       + subFieldRow('#16a34a', '#dcfce7', '#15803d', 'Goal',      v.goal ?? '')
       + subFieldRow(c.mid,    c.soft,    c.dark,    'Wish',      v.wish ?? '')
       + subFieldRow('#94a3b8', '#f8fafc', '#475569', 'Status',    v.status ?? '')
       + subFieldRow('#94a3b8', '#f8fafc', '#475569', 'For',       v.valueOfFunction ?? '')
}

function renderSolution(s: SEntry): string {
  const c = TYPE_COLOURS.solution
  return entryHeadRow(c, s.id, s.description)
       + subFieldRow(c.mid,    c.soft,    c.dark,    'Impact',     s.impact ?? '')
       + subFieldRow('#94a3b8', '#f8fafc', '#475569', 'Implements', s.function ?? '')
}

function renderResource(r: REntry): string {
  const c = TYPE_COLOURS.resource
  return entryHeadRow(c, r.id, r.description)
       + subFieldRow(c.mid,    c.soft,    c.dark,    'Scale',     r.scale ?? '')
       + subFieldRow(c.mid,    c.soft,    c.dark,    'Meter',     r.meter ?? '')
       + subFieldRow('#d97706', '#fef3c7', '#92400e', 'Tolerable', r.tolerable ?? '')
       + subFieldRow('#16a34a', '#dcfce7', '#15803d', 'Goal',      r.goal ?? '')
       + subFieldRow(c.mid,    c.soft,    c.dark,    'Wish',      r.wish ?? '')
       + subFieldRow('#94a3b8', '#f8fafc', '#475569', 'Now',       r.status ?? '')
       + subFieldRow('#94a3b8', '#f8fafc', '#475569', 'Enables',   r.resourceForValue ?? '')
       + subFieldRow('#94a3b8', '#f8fafc', '#475569', 'Consumed by', r.consumedBy ?? '')
}

function renderConstraint(con: CEntry): string {
  const c = TYPE_COLOURS.constraint
  return entryHeadRow(c, con.id, con.description)
       + subFieldRow(c.mid, c.soft, c.dark, 'Scope',     con.scope ?? '')
       + subFieldRow(c.mid, c.soft, c.dark, 'Rationale', con.rationale ?? '')
}

// ── Section header row (full-width coloured bar at top of each per-type table) ─
// Each per-type table is now a STANDALONE top-level <table>, so the spacer
// row is no longer prepended here — the gap between top-level tables comes
// from `margin:0 0 14px 0` on OUTER_TABLE_OPEN.  This keeps each Keynote
// table starting cleanly with its coloured title bar.
function sectionHeader(title: string, count: number, c: TypeColour): string {
  // No `height=` — title can wrap on long section names; padding alone
  // controls vertical breathing room.  Trailing `<br>&nbsp;` reserves
  // descender space in Keynote (where CSS padding is stripped).
  const inner = `<span style="font-family:monospace;font-size:12px;color:#ffffff;opacity:0.85;margin-right:8px;">${esc(c.glyph)}</span>${esc(title)} <span style="opacity:0.85;font-weight:400;">· ${count}</span>`
  return `<tr>
    <td colspan="3" bgcolor="${c.mid}" style="background:${c.mid};color:#ffffff;font-weight:700;font-size:14px;letter-spacing:0.04em;padding:14px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.5;">${descenderSafe(inner)}</td>
  </tr>`
}

// ── Section assembly ──────────────────────────────────────────────────────────
function section(title: string, c: TypeColour, rows: string, count: number): string {
  return count === 0 ? '' : sectionHeader(title, count, c) + rows
}

// ── Main public function ──────────────────────────────────────────────────────

// Tom 2026-06-04 (4th screenshot): even with `padding:` in inline style,
// Keynote was clipping wrapped text descenders.  Root cause: Keynote
// ignores inline CSS `padding:` (strips most CSS) AND honours HTML
// `cellpadding="N"` uniformly across every cell — but `cellpadding=14`
// would inflate the thin colour-stripe cells in sub-field rows by 14 px
// per side, breaking the design.
//
// Resolution: keep `cellpadding="0"` on the outer table so the thin stripe
// cells stay thin, and use the EMAIL-HTML descender trick on every cell
// that contains wrappable text: append `<br>&nbsp;` at the END of the
// cell content.  This forces the cell to reserve one extra empty line of
// vertical space, which gives the previous line's descenders the room
// Keynote was clipping.  Invisible in Mail (the &nbsp; is a single space
// on a blank line below the content) and benign in every mail client.
const OUTER_TABLE_OPEN = `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;width:100%;max-width:820px;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0 0 14px 0;">`

/** Wrap text content with a trailing `<br>&nbsp;` to reserve descender
 *  space in Keynote.  Use on every cell that can contain WRAPPABLE text
 *  (titles, descriptions, stakeholder lists, sub-field values).
 *  Stripe cells and single-line label cells do NOT need this. */
function descenderSafe(text: string): string {
  return `${text}<br>&nbsp;`
}

/** Word-wrap a string into lines of at most `maxChars` each, splitting at
 *  word boundaries.  Used to pre-split long titles and long stakeholder
 *  lists into multiple `<tr>` rows so Keynote (which calculates row
 *  height up-front and clips wrapped text) never sees a wrappable cell.
 *
 *  Tom Gilb 2026-06-04 (5th screenshot): even `<br>&nbsp;` was not enough
 *  to prevent Keynote from clipping line-2 descenders on the spec name.
 *  Decisive resolution: every line gets its own `<tr>` row.  No wrap
 *  inside a cell, no clipping possible.
 */
function softWrap(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text]
  const words = text.split(/\s+/)
  const out: string[] = []
  let line = ''
  for (const w of words) {
    if (!line) {
      line = w
    } else if (line.length + 1 + w.length <= maxChars) {
      line += ' ' + w
    } else {
      out.push(line)
      line = w
    }
  }
  if (line) out.push(line)
  return out.length ? out : [text]
}
const OUTER_TABLE_CLOSE = `</table>`

/**
 * Wrap a chunk of `<tr>` rows in their own top-level `<table>` block.
 *
 * Tom 2026-06-04: *"the split into multiple tables is surprising but useful
 * for presentation"*.  Keynote treats each top-level `<table>` as ONE
 * independent Keynote table that can be dragged, resized, and arranged on
 * a slide separately.  By splitting Functions / Values / Solutions /
 * Constraints into siblings instead of children, Tom gets one
 * presentation-ready table per Planguage type.  Each retains its own
 * coloured header bar so the type is identifiable at a glance.
 */
function wrapTable(rows: string): string {
  return rows ? `${OUTER_TABLE_OPEN}${rows}${OUTER_TABLE_CLOSE}\n` : ''
}

/**
 * Render the full SpecBlock as a sequence of colourful HTML TABLES — one
 * top-level `<table>` per Planguage type (plus a header and footer block).
 *
 * Each table is independent in Keynote: Tom can position Functions on one
 * slide, Values on another, etc.  In Apple Mail / Gmail / Outlook the
 * tables stack vertically with consistent visual style.
 *
 * Title-clipping fix (Tom 2026-06-04 third screenshot, FINAL):
 *   • First attempt added `height="56"` to force tall title rows — but
 *     Keynote treated the attribute as a MAXIMUM not a minimum; when the
 *     spec name wrapped to 2 lines the second line's descenders clipped.
 *     Same happened on the Stakeholders cell with a long stake list.
 *   • Final fix: ZERO `height=` attributes on any text-bearing row.
 *     Vertical space is controlled exclusively by `padding-top` /
 *     `padding-bottom` + `line-height:1.5`.  Rows auto-grow to fit
 *     any number of wrapped lines in Keynote and every mail client.
 *   • Only the 6 px SPACER_ROW keeps its `height="6"` because it is
 *     intentionally tiny and carries no wrappable text.
 *   • Font-size for the title is 20 px line-height 1.45 (was 22 / 1.3
 *     in earlier versions) — modestly smaller so a 2-line title fits
 *     comfortably even at a slide-width-constrained max-width.
 */
export function renderColorfulSpecHtml(
  spec: SpecBlock,
  specName: string,
  version?: string,
): string {
  const now      = new Date()
  const date     = now.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
  const time     = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const versTxt  = version ? ` ${esc(version)}` : ''

  const totals = (spec.functions?.length ?? 0) + (spec.values?.length ?? 0)
               + (spec.solutions?.length ?? 0) + (spec.constraints?.length ?? 0)
               + (spec.resources?.length ?? 0)

  // Header block — Tom 2026-06-04 second-screenshot fix:
  //   `height="N"` attributes acted as MAXIMUMS in Keynote — when the spec
  //   name wrapped to 2 lines the row capped at 56 px and clipped the
  //   descenders of the second line.  Same for the Stakeholders cell when
  //   the stake list wrapped to 4-5 lines.
  //
  //   Resolution: NO `height=` attributes anywhere on header / stakeholder /
  //   section-header rows.  Vertical space is controlled exclusively by
  //   `padding-top` + `padding-bottom` so the row grows to fit any number
  //   of wrapped lines, and Keynote can never clip.  This makes the surface
  //   slightly less compact on short titles but absolutely safe on long
  //   ones — a worthy trade-off given the title-clipping risk.
  // Pre-split the title into multiple <tr> rows so Keynote never sees a
  // wrappable cell.  Tom 2026-06-04 (6th screenshot): suspected line-1
  // text loss after "to" — confirmed via softWrap trace that text is NOT
  // dropped, but tightening to 36 chars (was 42) gives Keynote-imported
  // narrower cells more right-edge headroom.  Cleaner visual, zero risk
  // of horizontal overflow.  First line gets top padding, last line
  // gets bottom padding, middle lines get tight padding.
  const titleFull   = esc(specName) + versTxt
  const titleLines  = softWrap(titleFull, 36)
  const titleRows   = titleLines.map((ln, idx) => {
    const isFirst = idx === 0
    const isLast  = idx === titleLines.length - 1
    const padTop  = isFirst ? 10 : 0
    const padBot  = isLast  ? 16 : 0
    return `<tr><td colspan="3" bgcolor="#7c3aed" style="background:#7c3aed;color:#ffffff;font-size:20px;font-weight:800;padding:${padTop}px 22px ${padBot}px 22px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.3;">${ln}</td></tr>`
  }).join('')

  const headerRows =
    `<tr><td colspan="3" bgcolor="#7c3aed" style="background:#7c3aed;color:#ffffff;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;font-weight:600;padding:18px 22px 6px 22px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.5;">Planguage Spec · SEM App</td></tr>` +
    titleRows +
    `<tr><td colspan="3" bgcolor="#7c3aed" style="background:#7c3aed;color:#ffffff;font-size:11px;opacity:0.9;padding:4px 22px 18px 22px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.5;">${esc(date)} · ${esc(time)} · ${totals} entries</td></tr>`
  const headerTable = wrapTable(headerRows)

  // Same one-line-per-<tr> treatment for the Stakeholders block (~70 chars
  // per line at the smaller font).
  let stakeTable = ''
  if (spec.stakes) {
    const stakeLines = softWrap(esc(spec.stakes), 64)
    const stakeRows  = stakeLines.map((ln, idx) => {
      const isFirst = idx === 0
      const isLast  = idx === stakeLines.length - 1
      const padTop  = isFirst ? 14 : 0
      const padBot  = isLast  ? 14 : 0
      const prefix  = isFirst ? '<b>Stakeholders:</b> ' : ''
      return `<tr><td colspan="3" bgcolor="#dbeafe" style="background:#dbeafe;color:#1d4ed8;font-size:12px;padding:${padTop}px 18px ${padBot}px 18px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.4;">${prefix}${ln}</td></tr>`
    }).join('')
    stakeTable = wrapTable(stakeRows)
  }

  // Per-type tables — each is a standalone top-level <table> that Keynote
  // treats as one draggable, resizable Keynote table.
  const fnsTable = (spec.functions?.length ?? 0) > 0
    ? wrapTable(sectionHeader('Functions — binary capabilities', spec.functions!.length, TYPE_COLOURS.function)
              + spec.functions!.map(renderFunction).join(''))
    : ''
  const valsTable = (spec.values?.length ?? 0) > 0
    ? wrapTable(sectionHeader('Values — quantified qualities', spec.values!.length, TYPE_COLOURS.value)
              + spec.values!.map(renderValue).join(''))
    : ''
  const solsTable = (spec.solutions?.length ?? 0) > 0
    ? wrapTable(sectionHeader('Solutions — how we deliver', spec.solutions!.length, TYPE_COLOURS.solution)
              + spec.solutions!.map(renderSolution).join(''))
    : ''
  const consTable = (spec.constraints?.length ?? 0) > 0
    ? wrapTable(sectionHeader('Constraints — hard boundaries', spec.constraints!.length, TYPE_COLOURS.constraint)
              + spec.constraints!.map(renderConstraint).join(''))
    : ''
  const resTable = (spec.resources?.length ?? 0) > 0
    ? wrapTable(sectionHeader('Resources — budgets and consumables', spec.resources!.length, TYPE_COLOURS.resource)
              + spec.resources!.map(renderResource).join(''))
    : ''

  const footerTable = wrapTable(
    `<tr><td colspan="3" bgcolor="#f1f5f9" style="background:#f1f5f9;color:#64748b;font-size:11px;padding:8px 14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.4;">Generated by the <b>SEM App</b> · Planguage methodology by Tom Gilb · ${esc(date)} ${esc(time)}</td></tr>`
  )

  // Returned as concatenated sibling tables (no outer wrapper).  Keynote
  // ingests each as a separate, draggable, resizable table.  Mail clients
  // stack them vertically with the same visual rhythm.
  return [headerTable, stakeTable, fnsTable, valsTable, solsTable, consTable, resTable, footerTable].join('\n')
}
