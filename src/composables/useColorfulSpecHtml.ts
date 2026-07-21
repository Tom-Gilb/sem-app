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
import { rBudget, rBudgetLabel } from '../types/spec'
import { mnemonicLabel } from './usePenta'

// ── Mnemonic-Tag fallback helper ────────────────────────────────────────────
// Tom Gilb 2026-06-09 SUPREME (Planguage Mnemonic ID Standard) +
// Tom Gilb 2026-06-06 SUPREME (Spell-out-Type-Names) +
// Tom Gilb screenshot 2026-06-19/20: "F:", "F2:", "V" badges visible in the
// colourful export — bare-letter type abbreviations + sequential V1/F2-style
// IDs both BANNED in user-visible text.  Root cause: every renderer passed
// raw `entry.id` to `entryHeaderBar`, and every cross-reference chip passed
// raw ID strings to `bodyChipsRow`, with NO call to `mnemonicLabel()` (the
// canonical fallback that strips dotted prefixes and substitutes the first
// significant words of the description for sequential IDs).  Composes with
// the Both-Surfaces SUPREME (in-app + export must agree) — `SpecOutput.vue`
// is being swept in the same change so the in-app Vue template uses the
// same `mnemonicLabel()` fallback at every tag-header + chip site.
function entryMnemonic(entry: { id: string; description?: string; definition?: string }): string {
  return mnemonicLabel(entry.id, entry.description ?? entry.definition ?? '')
}
function idToMnemonic(id: string | undefined, lookup: ReadonlyArray<{ id: string; description?: string; definition?: string }>): string {
  if (!id) return ''
  const hit = lookup.find(e => e.id === id)
  return mnemonicLabel(id, hit?.description ?? hit?.definition ?? '')
}

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
/** r41 v93 (Tom Gilb 2026-06-16 verbatim "the email paste exported plan is
 *  still not identical to the displayed plan, particularly missing all
 *  sources, maybe more") — subFieldRow now takes an optional `source` param.
 *  When provided, an inline `← <source>` chip renders directly below the
 *  value on its OWN row (matching the in-app `<span v-if="v.fieldSources?.
 *  [field]"> ← {{ fieldSources[field].source }}</span>` pattern beside every
 *  scalar value).  Composes with: BOTH-surfaces rule (in-app + export must
 *  look like the same Planguage Spec), Sources-of-Specs SUPREME (per-field
 *  source attribution required, not optional). */
function subFieldRow(
  stripeColour: string,
  softFill:     string,
  textColour:   string,
  label:        string,
  value:        string,
  source?:      string,
): string {
  if (!value || value.trim() === '' || value.trim() === '—') return ''
  const lines = softWrap(value, SUBFIELD_VALUE_WRAP)
  const hasSource = !!(source && source.trim())
  const valueRows = lines.map((ln, idx) => {
    const isFirst = idx === 0
    const isLast  = idx === lines.length - 1
    const padTop  = isFirst ? '6px' : '0'
    // when a source row follows, keep value-row bottom padding tight so the
    // source chip sits close beneath the value (matches in-app inline layout)
    const padBot  = isLast  ? (hasSource ? '2px' : '8px') : '0'
    const labelCell = isFirst
      ? `<td bgcolor="${softFill}" width="110" style="background:${softFill};color:${textColour};font-weight:700;font-size:11px;padding:6px 10px;white-space:nowrap;vertical-align:top;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${esc(label)}</td>`
      : `<td bgcolor="${softFill}" width="110" style="background:${softFill};padding:0 10px;">&nbsp;</td>`
    return `<tr>
    <td bgcolor="${stripeColour}" width="14" style="background:${stripeColour};width:14px;padding:0;">&nbsp;</td>
    ${labelCell}
    <td bgcolor="${softFill}" style="background:${softFill};color:#0f172a;font-size:12px;padding:${padTop} 10px ${padBot} 10px;white-space:normal;vertical-align:top;line-height:1.5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${esc(ln)}</td>
  </tr>`
  }).join('')
  // r41 v93 — inline source row beneath the value (no label echo; aligned
  // with the value column).  Italic slate to read as provenance, not data.
  const sourceRow = hasSource
    ? `<tr>
    <td bgcolor="${stripeColour}" width="14" style="background:${stripeColour};width:14px;padding:0;">&nbsp;</td>
    <td bgcolor="${softFill}" width="110" style="background:${softFill};padding:0 10px;">&nbsp;</td>
    <td bgcolor="${softFill}" style="background:${softFill};color:#64748b;font-size:10px;font-style:italic;padding:0 10px 8px 10px;line-height:1.4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">&larr; ${esc(source!.trim())}</td>
  </tr>`
    : ''
  return valueRows + sourceRow
}

// ── Qualifiers row (r93c6 — Tom Gilb 2026-06-13 "push on where you can") ─────
// Adds the canonical 3-class Qualifiers (Time / Place / Event per Planguage
// Glossary *124 + *666 + *153/*107/*062) to every scalar spec export. Fires
// the Infinity Trap warning (r93mmm SUPREME) when ALL three classes empty.
// Reads both canonical (time/place/event) and legacy (when/where/what/how/why)
// fields per the r93rrr PentaConditions migration aliases.
//
// Cite: https://www.gilb.com/tomtwin/concept/Qualifier.124 — Twin Consultant
// (by Kai Gilb — funds Claudian dev per r93ppp).
interface AnyConditions {
  time?:  string; place?: string; event?: string
  when?:  string; where?: string; what?:  string; how?:   string; why?:   string
}
function qualifiersRow(c: TypeColour, conditions: AnyConditions | null | undefined): string {
  const t  = conditions?.time  ?? conditions?.when  ?? ''
  const p  = conditions?.place ?? conditions?.where ?? ''
  const ev = conditions?.event ?? conditions?.what  ?? conditions?.how ?? ''
  const filled = [t, p, ev].filter(s => s && s.trim()).map(s => s.trim())
  if (filled.length === 0) {
    // Infinity Trap warning — render even when empty so recipients see the
    // discipline. Per r93mmm SUPREME + r93nnn surfacing rule.
    return `<tr>
      <td bgcolor="#dc2626" width="14" style="background:#dc2626;width:14px;padding:0;">&nbsp;</td>
      <td bgcolor="#fef2f2" width="110" style="background:#fef2f2;color:#991b1b;font-weight:700;font-size:11px;padding:6px 10px;white-space:nowrap;vertical-align:top;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Qualifiers</td>
      <td bgcolor="#fef2f2" style="background:#fef2f2;color:#7f1d1d;font-size:11px;padding:6px 10px;line-height:1.5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;"><b>⚠ [∞] INFINITY TRAP</b> — no Qualifiers; bound in Time + Place + Event or risk infinite costs. <a href="https://www.gilb.com/tomtwin/concept/Qualifier.124" style="color:#5b21b6;font-weight:bold;">*124 Qualifier ↗</a> <span style="font-size:10px;font-style:italic;opacity:0.75;">(via Tom Gilb Consultant Twin, by Kai Gilb)</span></td>
    </tr>`
  }
  const tag = filled.join(', ')
  return `<tr>
    <td bgcolor="${c.mid}" width="14" style="background:${c.mid};width:14px;padding:0;">&nbsp;</td>
    <td bgcolor="${c.soft}" width="110" style="background:${c.soft};color:${c.dark};font-weight:700;font-size:11px;padding:6px 10px;white-space:nowrap;vertical-align:top;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Qualifiers</td>
    <td bgcolor="${c.soft}" style="background:${c.soft};color:#0f172a;font-size:12px;padding:6px 10px;line-height:1.6;font-family:ui-monospace,monospace;"><b>[${esc(tag)}]</b><br><span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:11px;color:#334155;"><b>TIME:</b>&nbsp;${esc(t || '—')}</span><br><span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:11px;color:#334155;"><b>PLACE:</b>&nbsp;${esc(p || '—')}</span><br><span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:11px;color:#334155;"><b>EVENT:</b>&nbsp;${esc(ev || '—')}</span><br><span style="font-size:10px;font-style:italic;opacity:0.7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">(*124 Qualifier, AND-logic definitional)</span></td>
  </tr>`
}

// ── r41 v112 (Tom Gilb 2026-06-17 "I want it to look like this, exactly" + ─────
//    screenshot of on-screen Function card) — visual refit of entry-card
//    rendering to faithfully match the in-app SpecOutput.vue per-type card.
//    The screen shows:
//       ┌─[type-soft header bar]─────────────────────────────────────┐
//       │  Tag:    Type: Function.                                    │
//       ├─[white body]───────────────────────────────────────────────┤
//       │  FUNCTION:    | description text                           │
//       │  FUNCTION TEST:| presence test text                        │
//       │  VALUES:       | [chip] [chip] [chip]                      │
//       │  STAKEHOLDERS: | [chip] [chip]                             │
//       │  SUB-FUNCTIONS:| [chip] [chip]                             │
//       │  Owner: Phineas Pett · justification italic · ⚠ risks      │
//       └────────────────────────────────────────────────────────────┘
//    Email-side fidelity uses the same 3-column outer table as before but
//    drops the per-row stripe colour from body rows and uses WHITE
//    backgrounds with uppercase-coloured labels.  Header row keeps the
//    soft-coloured bg matching the entry type.  Chips render as inline-block
//    spans with type-coloured bg + border for array values.  Owner /
//    Justification / Risks compact into ONE footer row.  Description is
//    rendered as a labelled body row (label uses the entry-type name —
//    "Function:" / "Value:" / "Solution:" / "Binary Rule:" / "Resource:") —
//    this resolves the description-in-headline asymmetry by surfacing
//    description as a parameter-style row (matching on-screen).  The
//    Description-NOT-a-canonical-Planguage-parameter SUPREME rule is
//    honoured because the LABEL uses the entry-type name, not the banned
//    word "Description".  Composes with: Both-surfaces rule (faithful
//    reproduction of the screen), SUPREME description rule, Spell-out-
//    Type-Names rule (full English type names), American English Standard.
//
// ── Old single-purpose entry headline row (kept for compat; now superseded by
//    headerBar + bodyRow + chipsRow + metaFooterRow combination) ───────────────
// r41 v108 (Tom Gilb 2026-06-17 verbatim "cant u just copy whats on the screen?
// having 2 versions seems to invite differences, and there will be changes in
// future") — `description` PARAMETER REMOVED from this signature.  Previous
// behaviour rendered `<Tag big bold> | <description text>` as a two-cell
// headline row, but the in-app SpecOutput.vue Tag-row shows ONLY the Tag
// (`{{ c.id }}:`, `{{ v.id }}:`, etc. — see SpecOutput.vue:6813 et al), with
// the description body relocated to a separate labelled box BELOW the Tag-row
// (e.g. Constraint "Binary Rule" box, Value "Context:" sub-row).  The
// asymmetry meant Tom saw description IN the email's headline but NOT next
// to the on-screen Tag — exactly the silent-drift Trace-Before-Patch SUPREME
// rule warns about.  Composes with: BOTH-surfaces rule (display + export must
// agree on the canonical Planguage Spec shape) + the Description-NOT-a-
// canonical-Planguage-parameter SUPREME rule (description is the entry's
// tag-level identifier, not a parameter — and the Tag IS the identifier).
// Headline is now Tag-only: big bold underlined ID + colon, spanning the
// full row width.  Sub-field rows below carry all actual parameter data.
//
// r41 v59 (Tom Gilb 2026-06-16 verbatim): *"The Tag needs to be much bigger,
// and underlined (my old tradition)."*  Tag font 22 px extrabold + `<u>`
// underline (Keynote-stable HTML tag; outlasts inline CSS `text-decoration`).
// Pre-split into multiple <tr> rows when the Tag wraps so Keynote (which
// calculates row height up-front) never clips descenders on long tags.
const TAG_WRAP = 36  // safe chars per line at 22px in the full row width
const ENTRY_DESC_WRAP = 80  // safe chars per line at 13px in full row width

/** r41 v112 — Card HEADER bar.  Matches the in-app Function card chrome at
 *  SpecOutput.vue:6071: a `bg-blue-50` (type-soft) bar with the Tag (big
 *  bold underlined) + an inline `Type: Function.` mono chip, optionally a
 *  currentStatus chip and a 🔪 sharpened chip.  Email-side: ONE row with
 *  colspan=3, type-soft bgcolor, Tag at 22px extrabold underlined, mono
 *  Type chip inline next to it.  Tom Gilb 2026-06-17 verbatim "I want it
 *  to look like this, exactly" + on-screen card screenshot. */
function entryHeaderBar(c: TypeColour, id: string, typeName: string, extras: string = ''): string {
  // Soft Tag-cell wrap — keep Tag on its own line if it would otherwise
  // collide with the Type chip; multi-line Tag still rendered on subsequent
  // <tr> rows so Keynote can't clip descenders.
  const idLines = softWrap(id, TAG_WRAP)
  return idLines.map((ln, idx) => {
    const isFirst = idx === 0
    const isLast  = idx === idLines.length - 1
    const padTop  = isFirst ? '14px' : '0'
    const padBot  = isLast  ? '14px' : '0'
    // Only first line carries the Type chip + extras (currentStatus, 🔪 etc).
    const typeChip = isFirst
      ? ` <span style="font-family:ui-monospace,monospace;font-size:11px;font-weight:400;color:${c.dark};opacity:0.85;margin-left:8px;letter-spacing:0;">Type: ${esc(typeName)}.</span>${extras}`
      : ''
    return `<tr>
    <td colspan="3" bgcolor="${c.soft}" style="background:${c.soft};color:${c.dark};font-weight:800;font-size:22px;padding:${padTop} 16px ${padBot} 16px;vertical-align:middle;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.25;letter-spacing:0.01em;border-bottom:1px solid ${c.soft};">${descenderSafe(`<u>${esc(ln)}</u>:${typeChip}`)}</td>
  </tr>`
  }).join('')
}

/** r41 v112 — Body label-value row.  Two-column flex emulated as table cells:
 *  ~120px label cell (uppercase, type-dark, semibold, tracking-wide, 10px)
 *  on the LEFT, value cell (slate-800, 13px) on the right.  White bg, no
 *  stripe.  Matches in-app `<div class="flex gap-2 items-start">` rows at
 *  SpecOutput.vue:6104/6167 et al.  Returns '' when value empty. */
function bodyRow(c: TypeColour, label: string, value: string | undefined | null, source?: string | null): string {
  if (!value || (typeof value === 'string' && value.trim() === '')) return ''
  const hasSource = !!(source && String(source).trim())
  const lines = softWrap(String(value), ENTRY_DESC_WRAP)
  const valueRows = lines.map((ln, idx) => {
    const isFirst = idx === 0
    const isLast  = idx === lines.length - 1
    const padTop  = isFirst ? '8px' : '0'
    // When a source row follows, tighten the value-row bottom padding so the
    // source chip sits close beneath the value (matches in-app inline layout
    // where `← <source>` appears immediately to the right of each scalar level).
    const padBot  = isLast  ? (hasSource ? '2px' : '8px') : '0'
    const labelCell = isFirst
      ? `<td bgcolor="#ffffff" width="130" style="background:#ffffff;color:${c.dark};font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;padding:${padTop} 8px 4px 16px;vertical-align:top;white-space:nowrap;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${esc(label)}:</td>`
      : `<td bgcolor="#ffffff" width="130" style="background:#ffffff;padding:0 8px 0 16px;">&nbsp;</td>`
    return `<tr>
    ${labelCell}
    <td colspan="2" bgcolor="#ffffff" style="background:#ffffff;color:#1e293b;font-size:13px;padding:${padTop} 16px ${padBot} 0;vertical-align:top;white-space:normal;line-height:1.5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${esc(ln)}</td>
  </tr>`
  }).join('')
  // r41 v115 (Tom Gilb 2026-06-17 verbatim "I want all the source (<-) detail
  // too in the email. Copy means 'Copy'") — restored the per-field source
  // row that was silently dropped when renderValue migrated from subFieldRow
  // (which had a source param) to bodyRow (which didn't).  Source row sits
  // immediately beneath the value, aligned with the value column, italic
  // slate so it reads as provenance not data.  Mirrors the in-app inline
  // `← {{ v.fieldSources[field].source }}` chip at SpecOutput.vue:6382 etc.
  const sourceRow = hasSource
    ? `<tr>
    <td bgcolor="#ffffff" width="130" style="background:#ffffff;padding:0 8px 0 16px;">&nbsp;</td>
    <td colspan="2" bgcolor="#ffffff" style="background:#ffffff;color:#64748b;font-size:10px;font-style:italic;padding:0 16px 8px 0;line-height:1.4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">&larr; ${esc(String(source).trim())}</td>
  </tr>`
    : ''
  return valueRows + sourceRow
}

/** r41 v112 — Body chips row for array-valued fields (Values / Stakeholders
 *  / Sub-functions / Constraints / Costs).  Each chip rendered as
 *  inline-block span with type-coloured bg + border + mono text.  Tom
 *  on-screen chips at SpecOutput.vue:6180 et al.  `chipColour` controls the
 *  chip palette; `c` controls the LABEL palette (label always matches the
 *  parent entry's type colour). */
function bodyChipsRow(c: TypeColour, label: string, items: string[] | undefined, chipColour: TypeColour | { dark: string; soft: string; mid: string }): string {
  if (!items || items.length === 0) return ''
  const chips = items.map(item => {
    return `<span style="display:inline-block;background:${chipColour.soft};border:1px solid ${chipColour.mid};color:${chipColour.dark};font-family:ui-monospace,monospace;font-size:10px;padding:1px 6px;margin:0 4px 3px 0;border-radius:3px;white-space:nowrap;">${esc(item)}</span>`
  }).join('')
  return `<tr>
    <td bgcolor="#ffffff" width="130" style="background:#ffffff;color:${c.dark};font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;padding:8px 8px 4px 16px;vertical-align:top;white-space:nowrap;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${esc(label)}:</td>
    <td colspan="2" bgcolor="#ffffff" style="background:#ffffff;padding:6px 16px 8px 0;vertical-align:top;line-height:1.7;">${chips}</td>
  </tr>`
}

/** r41 v112 — Compact footer row carrying Owner / Justification / Risks
 *  inline.  Owner uses orange-700 accent, justification slate-500 italic,
 *  risks amber-700 with ⚠ glyph.  Matches in-app footer at
 *  SpecOutput.vue:6253 et al.  Returns '' if all three empty. */
function entryMetaFooter(owner?: string, justification?: string, risks?: string): string {
  const parts: string[] = []
  if (owner && owner.trim()) {
    parts.push(`<span style="color:#c2410c;font-size:11px;"><b>Owner:</b> ${esc(owner.trim())}</span>`)
  }
  if (justification && justification.trim()) {
    parts.push(`<span style="color:#64748b;font-size:11px;font-style:italic;">${esc(justification.trim())}</span>`)
  }
  if (risks && risks.trim()) {
    parts.push(`<span style="color:#92400e;font-size:11px;"><b>⚠</b> ${esc(risks.trim())}</span>`)
  }
  if (parts.length === 0) return ''
  return `<tr>
    <td colspan="3" bgcolor="#ffffff" style="background:#ffffff;padding:8px 16px 12px 16px;border-top:1px solid #f1f5f9;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${parts.join(' &nbsp;·&nbsp; ')}</td>
  </tr>`
}

/** Legacy `entryHeadRow` adapter — kept for back-compat with any caller
 *  not yet swept.  Routes to the new header bar with a generic "Spec" type
 *  name when caller can't supply one.  Description argument is ignored
 *  (description now lives in a body row labelled with the entry type
 *  name via the new `bodyRow` helper). */
function entryHeadRow(c: TypeColour, id: string, _description?: string): string {
  void _description
  return entryHeaderBar(c, id, 'Spec')
}

// r41 v59 (Tom Gilb 2026-06-16 verbatim): *"The line between spec items needs
// to be much darker, clear spec item border."*  Dedicated separator row
// rendered BETWEEN consecutive entries within a section.  4 px tall, slate-800
// solid colour — survives Keynote (bgcolor attribute), Mail.app, Gmail, Outlook.
// NOT prepended to the first entry of a section (the colour section header
// already provides that visual break) and NOT appended to the last (the
// per-type tables themselves have a margin gap).  Composes with the
// One-table-for-cohesion rule (r93aaa) within each per-type sibling table.
const ENTRY_SEPARATOR_ROW = `<tr><td colspan="3" bgcolor="#1e293b" height="4" style="background:#1e293b;height:4px;padding:0;line-height:0;font-size:0;border:none;">&nbsp;</td></tr>`

// ── Export mode (Tom Gilb 2026-06-16 verbatim) ──────────────────────────────
// Tom: *"export does not give all details as we see in display, and that is
// sad, the details are great, all sources and rationale. You could offer a
// choice of formats: Default: exactly as in the display, 2 A Condensed Summary
// (without supporting details like sources and justifications), 3. A Table
// format with each spec on a line (not unlike the template table). If no
// choice is made the default is 1, as in display."*
//
// Three modes, default = 'full':
//   - 'full'      → every detail field that shows in the in-app display:
//                    Ambition Level + Source, Rationale, Justification,
//                    Risks, Assumptions, Stakeholders, Source attribution.
//                    Matches the rich spec editor view.
//   - 'condensed' → headline fields only (Tag, Description, Scale/Meter/
//                    Tolerable/Goal/Wish, Qualifier).  The pre-2026-06-16
//                    output, kept for callers that want a compact share.
//   - 'table'     → one row per entry, columnar overview — like the
//                    SEM-Planguage-Object-Templates.html reference tables.
export type SpecExportMode = 'full' | 'condensed' | 'table'

/** Detail-row helper for `full` mode — same shape as subFieldRow but used
 *  for the second-tier detail fields (Source, Rationale, Justification…).
 *  Returns '' for empty values so optional fields don't render blank rows. */
function detailRow(c: TypeColour, label: string, value: string | undefined | null): string {
  if (!value || (typeof value === 'string' && value.trim() === '')) return ''
  return subFieldRow('#cbd5e1', '#f8fafc', '#475569', label, String(value))
}

/** r41 v69 (Tom Gilb 2026-06-16 "no the export is still missing sources and
 *  other good detail and is not in the same format at the mac display") —
 *  Sources summary row that surfaces BOTH entry-level source AND per-field
 *  source attribution (fieldSources) AND Ambition Level sources in ONE row
 *  at the TOP of each entry, mirroring the in-app card's top-right `Source:`
 *  chip.  Visible in BOTH 'full' AND 'condensed' modes — sources are
 *  fundamental provenance, not "extra detail".  Renders as a slate italic
 *  banner immediately under the Tag/description headline so the reader
 *  knows WHO authored the entry before reading any field.
 *  Composes with: the BOTH-surfaces rule (r41 v63), No-Silent-Data-Loss
 *  SUPREME (source provenance is critical, not optional), the Conjunction-
 *  of-Technologies SUPREME (source-layer badges per finding). */
function sourcesSummaryRow(entry: unknown): string {
  const e = entry as {
    source?: string
    sourceType?: string
    fieldSources?: Record<string, { source?: string; sourceType?: string; timestamp?: string; tool?: string }>
    ambitionLevel?: Array<{ sourcePerson?: string; sourceRef?: string; sourceUrl?: string }>
  }
  // r41 v109 (Tom Gilb 2026-06-17 screenshot) — two leaks fixed:
  //   (1) `description` raw key emitted as "description: SEM Stage 1…" in the
  //       sources row.  Description is NOT a Planguage parameter (CLAUDE.md
  //       SUPREME rule); its source-attribution row leaks the BANNED label
  //       word.  Skip it entirely — the entry's overall `Source` row already
  //       covers provenance for the entry as a whole.
  //   (2) camelCase keys (`presenceTest`, `functionOfValue`, `stakeholders`,
  //       `level`, `ambition`) rendered AS-IS, looking like code identifiers
  //       rather than English Planguage parameter labels.  Pretty-print to
  //       Title Case + space-separated words so the sources row reads like
  //       the on-screen card labels.
  //
  //   Composes with: Description-NOT-a-canonical-Planguage-parameter SUPREME,
  //   American English Standard (Title Case labels), Spell-out-Type-Names
  //   rule (full words, no abbreviations), Both-surfaces rule.
  // r41 v110 (Tom Gilb 2026-06-17 verbatim — same email, source repeated per
  // field): when EVERY per-field source carries the SAME provenance string
  // (e.g. all fields came from one SEM-LLM-Parser run, all stamped with the
  // same "SEM Stage 1, Based on User Script, 17Jun26 02:11" line), repeating
  // it per field is noise.  The on-screen card shows ONE `Source:` chip in the
  // entry header — not one per field.  Email must match that compaction.
  //
  // Dedup rule: collect distinct (source, tool) pairs across all fieldSources;
  // if exactly ONE distinct pair survives, emit ONE `Source: <text>` line
  // covering the entire entry — skip the per-field breakdown.  If more than
  // one distinct source exists (mixed-provenance entry), emit each per-field
  // chip (with the camelCase→Title Case pretty label) so the planner sees
  // which fields came from where.  Description is always skipped (NOT a
  // Planguage parameter).
  const FIELDS_NOT_TO_SOURCE = new Set(['description'])
  function prettyFieldLabel(key: string): string {
    const spaced = key.replace(/([A-Z])/g, ' $1').toLowerCase().trim()
    return spaced.charAt(0).toUpperCase() + spaced.slice(1)
  }
  const parts: string[] = []
  // Entry-level Source (overall provenance, kept as-is)
  if (typeof e.source === 'string' && e.source.trim()) {
    const tag = e.sourceType ? ` [${e.sourceType}]` : ''
    parts.push(`<b>Source</b>: ${esc(e.source.trim())}${esc(tag)}`)
  }
  // Per-field sources — dedup pass + emit pass
  if (e.fieldSources && typeof e.fieldSources === 'object') {
    type FieldSrc = { field: string; source: string; tool?: string }
    const collected: FieldSrc[] = []
    for (const [field, fs] of Object.entries(e.fieldSources)) {
      if (FIELDS_NOT_TO_SOURCE.has(field)) continue
      if (fs && typeof fs.source === 'string' && fs.source.trim()) {
        collected.push({ field, source: fs.source.trim(), tool: fs.tool })
      }
    }
    if (collected.length > 0) {
      // Distinct (source, tool) pair count — if 1, collapse into ONE line.
      const distinctKeys = new Set(collected.map(c => `${c.source}::${c.tool ?? ''}`))
      if (distinctKeys.size === 1) {
        const first = collected[0]!
        const tool = first.tool ? ` <span style="opacity:0.7;">(${esc(first.tool)})</span>` : ''
        // Only emit the all-fields Source line if the entry-level Source row
        // above did NOT already cover the same provenance string — avoids
        // back-to-back duplicates when both top-level + every-field carry
        // the identical source.
        const sameAsTop = (typeof e.source === 'string' && e.source.trim() === first.source)
        if (!sameAsTop) parts.push(`<b>Source (all fields)</b>: ${esc(first.source)}${tool}`)
      } else {
        // Mixed-provenance entry — emit per-field chips with pretty labels.
        for (const c of collected) {
          const tool = c.tool ? ` <span style="opacity:0.7;">(${esc(c.tool)})</span>` : ''
          parts.push(`<b>${esc(prettyFieldLabel(c.field))}</b>: ${esc(c.source)}${tool}`)
        }
      }
    }
  }
  if (Array.isArray(e.ambitionLevel)) {
    for (const am of e.ambitionLevel) {
      const sp = am?.sourcePerson || am?.sourceRef
      if (sp && typeof sp === 'string' && sp.trim()) {
        parts.push(`<b>Ambition</b>: ${esc(sp.trim())}`)
      }
    }
  }
  if (parts.length === 0) return ''
  return `<tr>
    <td colspan="3" bgcolor="#f8fafc" style="background:#f8fafc;color:#475569;font-size:11px;font-style:italic;padding:6px 14px 8px 14px;border-bottom:1px solid #e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.5;">${parts.join(' &nbsp;·&nbsp; ')}</td>
  </tr>`
}

/** Ambition Level renderer for `full` mode — sentence statement + source
 *  triple (Person + Ref + URL). Per Tom Gilb 2026-06-16 SUPREME: Ambition
 *  Level sits above Scale in the Value template; required with source. */
function ambitionRows(c: TypeColour, ambition: unknown): string {
  if (!Array.isArray(ambition) || ambition.length === 0) return ''
  return ambition.map((a: unknown) => {
    const e = a as { statement?: string; sourcePerson?: string; sourceRef?: string; sourceUrl?: string }
    if (!e.statement?.trim()) return ''
    const sourceParts = [e.sourcePerson, e.sourceRef, e.sourceUrl].filter(s => s && s.trim()).map(s => String(s).trim())
    const sourceText  = sourceParts.length > 0 ? ` — ${sourceParts.join(' · ')}` : ''
    return subFieldRow('#7c3aed', '#faf5ff', '#5b21b6', 'Ambition Level', `${e.statement.trim()}${sourceText}`)
  }).join('')
}

// ── Per-type renderers (each returns a string of <tr> rows for one entry) ────

// Detail-field accessors — pull arbitrary optional fields off entries.
// VEntry / FEntry / SEntry / REntry / CEntry don't share a common interface,
// so we widen to Record for the optional-field read.
function detailFields(entry: unknown): {
  rationale?: string; justification?: string; risks?: string;
  source?: string; sourceType?: string;
  assumptions?: string; stakeholders?: string; specOwner?: string;
  wishStakeholder?: string; owner?: string; authority?: string;
  definedAs?: string; test?: string; ambitionLevel?: unknown;
} {
  return entry as Record<string, never>
}

function renderFunction(f: FEntry, mode: SpecExportMode, ctx?: { spec?: SpecBlock }): string {
  const c = TYPE_COLOURS.function
  // r41 v98 (Tom Gilb 2026-06-16) — Sonnet-grade audit caught these missing
  // F. fields that DISPLAY shows but EXPORT was silently dropping.
  const ff = f as unknown as {
    costs?: string[]; subFunctions?: string[]; motherFunction?: string;
    currentStatus?: string; stakeholders?: string;
  }
  // r41 v112 (Tom Gilb 2026-06-17 "I want it to look like this, exactly") —
  // entry card REBUILT to mirror the on-screen Function card at
  // SpecOutput.vue:6063-6261 faithfully: header bar with Tag + Type chip
  // inline; body rows with uppercase blue labels + values; chips for arrays
  // (Values/Stakeholders/Sub-functions); compact Owner/Justification/Risks
  // footer.  The Description-NOT-a-Planguage-parameter SUPREME rule is
  // honoured because the description-row label is the entry-type name
  // ("Function:"), not the banned word "Description".
  const statusExtra = ff.currentStatus
    ? ` <span style="display:inline-block;background:#fef3c7;border:1px solid #fde68a;color:#92400e;font-family:ui-monospace,monospace;font-size:10px;padding:1px 6px;margin-left:6px;border-radius:3px;vertical-align:middle;">${esc(ff.currentStatus)}</span>`
    : ''
  // r41 v115 — per-field source helper (Function)
  const src = (k: string): string | undefined => {
    return (f as unknown as { fieldSources?: Record<string, { source?: string }> })
      .fieldSources?.[k]?.source
  }
  let out = entryHeaderBar(c, entryMnemonic(f), 'Function', statusExtra)
          + sourcesSummaryRow(f)
          // Description rendered as labelled body row (label = entry type
          // name; honours the no-"Description"-label SUPREME rule).
          + bodyRow(c, 'Function', f.description, src('description'))
          + bodyRow(c, 'Function Test', f.presenceTest ?? f.successCriteria ?? '', src('presenceTest') ?? src('successCriteria'))
  // Derived cross-reference chips (Values / Constraints / Stakeholders) —
  // mirror in-app at SpecOutput.vue:6172-6220.
  if (ctx?.spec) {
    const spec = ctx.spec
    const fidL = f.id.toLowerCase()
    // Cross-reference chips render the linked entry's mnemonic, not raw id
    // (Mnemonic-ID SUPREME + Spell-out-Type-Names SUPREME).
    const linkedV = spec.values.filter(v => v.valueOfFunction === f.id).map(v => mnemonicLabel(v.id, v.description))
    const linkedC = (spec.constraints ?? [])
      .filter(co => !co.scope || co.scope.toLowerCase().includes(fidL))
      .map(co => mnemonicLabel(co.id, co.description))
    const stakeholders = (spec as unknown as { stakeholders?: Array<{ id: string; description?: string; definition?: string }> }).stakeholders ?? []
    const linkedS = [...new Set(
      spec.values
        .filter(v => v.valueOfFunction === f.id)
        .map(v => v.wishStakeholder)
        .filter((x): x is string => !!x)
    )].map(id => idToMnemonic(id, stakeholders))
    if (linkedV.length) out += bodyChipsRow(c, 'Values',       linkedV, TYPE_COLOURS.value)
    if (linkedC.length) out += bodyChipsRow(c, 'Constraints',  linkedC, TYPE_COLOURS.constraint)
    if (linkedS.length) out += bodyChipsRow(c, 'Stakeholders', linkedS, TYPE_COLOURS.stakeholder)
  }
  // costs[] / subFunctions[] / motherFunction — were in-app at
  // SpecOutput.vue 6223-6250 but missing in export historically.
  if (ff.costs?.length)        out += bodyChipsRow(c, 'Costs',           ff.costs,        TYPE_COLOURS.solution)
  if (ff.subFunctions?.length) out += bodyChipsRow(c, 'Sub-functions',   ff.subFunctions, c)
  if (ff.motherFunction)       out += bodyChipsRow(c, 'Mother Function', [ff.motherFunction], c)
  // Compact meta footer row: Owner / Justification / Risks inline (matches
  // SpecOutput.vue:6253-6260).
  if (mode === 'full') {
    const d = detailFields(f)
    out += entryMetaFooter(d.specOwner, d.justification ?? d.rationale, d.risks)
  }
  return out
}

function renderValue(v: VEntry, mode: SpecExportMode): string {
  const c = TYPE_COLOURS.value
  const d = detailFields(v)
  const w = v as unknown as {
    past?: string; pastWhen?: string;
    statusWhen?: string; tolerableWhen?: string; goalWhen?: string;
    wishWhen?: string; stretchWhen?: string; stretch?: string;
  }
  const withWhen = (val: string | undefined, when: string | undefined): string => {
    if (!val || !val.trim()) return ''
    if (!when || !when.trim()) return val.trim()
    return `${val.trim()} [as of: ${when.trim()}]`
  }
  // r41 v112 — header bar + body rows (matches on-screen Value card).
  // Description labelled with the entry-type name "Value:" (honours
  // Description-NOT-a-Planguage-parameter SUPREME).
  // r41 v115 — sourcesSummaryRow restored (was silently dropped during the
  // bodyRow refactor; defined but never called).  Emits the consolidated
  // `Source (all fields)` banner per the v110 dedup rule at the top of
  // each entry, matching the in-app entry-header `← Source:` chip.
  let out = entryHeaderBar(c, entryMnemonic(v), 'Value')
          + sourcesSummaryRow(v)
          + bodyRow(c, 'Value', v.description)
  // Ambition Level rendered as labelled body row when present.
  if (mode === 'full' && Array.isArray(d.ambitionLevel)) {
    for (const a of d.ambitionLevel as Array<{ statement?: string; sourcePerson?: string; sourceRef?: string; sourceUrl?: string }>) {
      if (!a?.statement?.trim()) continue
      const srcParts = [a.sourcePerson, a.sourceRef, a.sourceUrl].filter(s => s && s.trim()).map(s => String(s).trim())
      const srcText  = srcParts.length > 0 ? ` — ${srcParts.join(' · ')}` : ''
      out += bodyRow(c, 'Ambition Level', `${a.statement.trim()}${srcText}`)
    }
  }
  // r41 v115 — per-field source helper (mirrors the in-app inline `←` chip at
  // SpecOutput.vue:6382 etc.).  Was lost when renderValue migrated from
  // subFieldRow (took a source param) to bodyRow (didn't).  Now bodyRow takes
  // an optional source 4th arg + emits a `← <source>` row beneath the value.
  const src = (k: string): string | undefined => {
    return (v as unknown as { fieldSources?: Record<string, { source?: string }> })
      .fieldSources?.[k]?.source
  }
  out += bodyRow(c, 'Scale',     v.scale,                                 src('scale'))
       + bodyRow(c, 'Meter',     v.meter,                                 src('meter'))
       + bodyRow(c, 'Past',      withWhen(w.past, w.pastWhen),            src('past'))
       + bodyRow(c, 'Tolerable', withWhen(v.tolerable, w.tolerableWhen),  src('tolerable'))
       + bodyRow(c, 'Goal',      withWhen(v.goal, w.goalWhen),            src('goal'))
       + bodyRow(c, 'Wish',      withWhen(v.wish, w.wishWhen),            src('wish'))
       + bodyRow(c, 'Stretch',   withWhen(w.stretch, w.stretchWhen),      src('stretch'))
       + bodyRow(c, 'Status',    withWhen(v.status, w.statusWhen),        src('status'))
  // Function link as chip — render mnemonic, not raw id (Mnemonic-ID SUPREME)
  if (v.valueOfFunction) out += bodyChipsRow(c, 'For Function', [mnemonicLabel(v.valueOfFunction, '')], TYPE_COLOURS.function)
  // Qualifiers rendered as a body row using the canonical Planguage bracket form
  const q = v.conditions as AnyConditions | undefined
  if (q) {
    const t  = (q.time  ?? q.when  ?? '').trim()
    const p  = (q.place ?? q.where ?? '').trim()
    const ev = (q.event ?? q.what  ?? q.how  ?? '').trim()
    const filled = [t, p, ev].filter(Boolean)
    if (filled.length > 0) {
      out += bodyRow(c, 'Qualifiers', `[${filled.join(', ')}]<br><b>TIME:</b>&nbsp;${t || '—'}<br><b>PLACE:</b>&nbsp;${p || '—'}<br><b>EVENT:</b>&nbsp;${ev || '—'}`)
    }
  }
  if (mode === 'full') {
    if (v.wishStakeholder) out += bodyChipsRow(c, 'Wish By', [mnemonicLabel(v.wishStakeholder, '')], TYPE_COLOURS.stakeholder)
    if (d.authority)       out += bodyRow(c, 'Authority',   d.authority)
    if (d.definedAs)       out += bodyRow(c, 'Defined As',  d.definedAs)
    if (d.test)            out += bodyRow(c, 'Test',        d.test)
    out += entryMetaFooter(d.owner ?? d.specOwner, d.justification ?? d.rationale, d.risks)
  }
  return out
}

function renderSolution(s: SEntry, mode: SpecExportMode): string {
  const c = TYPE_COLOURS.solution
  // r41 v115 — per-field source helper (Solution)
  const src = (k: string): string | undefined => {
    return (s as unknown as { fieldSources?: Record<string, { source?: string }> })
      .fieldSources?.[k]?.source
  }
  // ━━ SUPREME 2026-06-21 — Solution Parameters pinned 26-parameter canonical inventory ━━
  // Tom Gilb verbatim: "Solution Parameters: I have brought this up before. … In all specs,
  // including solutions the Planguage statements are about a sentence for each parameter."
  // Tier 1 always renders (ship-blocker). Tier 2 renders when populated (Sharpen warning if missing).
  // Tier 3 renders in 'full' mode only when populated. Legacy fields fall back per canonical name:
  //   mainImpacts ← impact / impactsValues   ·   costAspects ← impactsCosts   ·   relatedTo ← stakeholders.

  let out = entryHeaderBar(c, entryMnemonic(s), 'Solution')
          + sourcesSummaryRow(s)

  // ── Tier 1 — REQUIRED (always render; bodyRow handles empty as fallback "—") ──
  if (s.status)         out += bodyRow(c, 'Status',         s.status,       src('status'))
  out += bodyRow(c, 'Solution', s.description, src('description'))
  if (s.derivedFrom)    out += bodyRow(c, 'Derived From',   s.derivedFrom,  src('derivedFrom'))
  if (s.function)       out += bodyChipsRow(c, 'Implements', [mnemonicLabel(s.function, '')], TYPE_COLOURS.function)
  const mainImpacts = s.mainImpacts || s.impact || s.impactsValues || ''
  if (mainImpacts)      out += bodyRow(c, 'Main Impacts',   mainImpacts,    src('mainImpacts') ?? src('impact') ?? src('impactsValues'))

  // ── Tier 2 — RECOMMENDED (render when populated) ──
  const relatedTo = s.relatedTo || s.stakeholders || ''
  if (relatedTo)                    out += bodyRow(c, 'Related To',                  relatedTo,                  src('relatedTo') ?? src('stakeholders'))
  if (s.specOwner)                  out += bodyRow(c, 'Spec Owner',                  s.specOwner,                src('specOwner'))
  if (s.implementationResponsible)  out += bodyRow(c, 'Implementation Responsible',  s.implementationResponsible, src('implementationResponsible'))
  if (s.risks)                      out += bodyRow(c, 'Risks',                       s.risks,                    src('risks'))
  if (s.sideEffects)                out += bodyRow(c, 'Side Effects',                s.sideEffects,              src('sideEffects'))
  const costAspects = s.costAspects || s.impactsCosts || ''
  if (costAspects)                  out += bodyRow(c, 'Cost Aspects',                costAspects,                src('costAspects') ?? src('impactsCosts'))
  if (s.longTermCosts)              out += bodyRow(c, 'Long Term Costs',             s.longTermCosts,            src('longTermCosts'))
  if (s.qualifiers)                 out += bodyRow(c, 'Qualifiers',                  s.qualifiers,               src('qualifiers'))

  // ── Tier 3 — OPTIONAL (full mode only, when populated) ──
  if (mode === 'full') {
    if (s.alternativeSolutions) out += bodyRow(c, 'Alternative Solutions', s.alternativeSolutions, src('alternativeSolutions'))
    if (s.rejectedSolutions)    out += bodyRow(c, 'Rejected Solutions',    s.rejectedSolutions,    src('rejectedSolutions'))
    if (s.urlsCaseStudies)      out += bodyRow(c, 'URLs / Case Studies',   s.urlsCaseStudies,      src('urlsCaseStudies'))
    if (s.prerequisites)        out += bodyRow(c, 'Prerequisites',         s.prerequisites,        src('prerequisites'))
    if (s.assumptions)          out += bodyRow(c, 'Assumptions',           s.assumptions,          src('assumptions'))
    if (s.constraints)          out += bodyRow(c, 'Constraints',           s.constraints,          src('constraints'))
    if (s.structural)           out += bodyRow(c, 'Structural',            s.structural,           src('structural'))
    if (s.authority)            out += bodyRow(c, 'Authority',             s.authority,            src('authority'))
    if (s.priority)             out += bodyRow(c, 'Priority',              s.priority,             src('priority'))
    if (s.note)                 out += bodyRow(c, 'Note',                  s.note,                 src('note'))
    const d = detailFields(s)
    out += entryMetaFooter(d.specOwner, d.justification ?? d.rationale, d.risks)
  }
  return out
}

function renderResource(r: REntry, mode: SpecExportMode): string {
  const c = TYPE_COLOURS.resource
  // r41 v93 — per-field source helper (mirrors Value).
  const src = (k: string): string | undefined => {
    return (r as unknown as { fieldSources?: Record<string, { source?: string }> })
      .fieldSources?.[k]?.source
  }
  // r41 v112 — header bar + body rows.  Description labelled "Resource:".
  // r41 v115 — per-field sources passed to bodyRow so `← <source>` chip
  // renders beneath each scalar level (mirrors in-app Resource card).
  let out = entryHeaderBar(c, entryMnemonic(r), 'Resource')
          + sourcesSummaryRow(r)
          + bodyRow(c, 'Resource',      r.description)
          + bodyRow(c, 'Scale',         r.scale,           src('scale'))
          + bodyRow(c, 'Meter',         r.meter,           src('meter'))
          + bodyRow(c, 'Tolerable',     r.tolerable,       src('tolerable'))
          + bodyRow(c, rBudgetLabel(r), rBudget(r),        src('budget') ?? src('consumed'))
          + bodyRow(c, 'Wish',          r.wish,            src('wish'))
          + bodyRow(c, 'Now',           r.status,          src('status'))
  if (r.resourceForValue) out += bodyChipsRow(c, 'Enables',     [mnemonicLabel(r.resourceForValue, '')], TYPE_COLOURS.value)
  if (r.consumedBy)       out += bodyChipsRow(c, 'Consumed By', [mnemonicLabel(r.consumedBy, '')],       TYPE_COLOURS.function)
  // Qualifiers as body row
  const q = r.conditions as AnyConditions | undefined
  if (q) {
    const t  = (q.time  ?? q.when  ?? '').trim()
    const p  = (q.place ?? q.where ?? '').trim()
    const ev = (q.event ?? q.what  ?? q.how  ?? '').trim()
    const filled = [t, p, ev].filter(Boolean)
    if (filled.length > 0) {
      out += bodyRow(c, 'Qualifiers', `[${filled.join(', ')}]<br><b>TIME:</b>&nbsp;${t || '—'}<br><b>PLACE:</b>&nbsp;${p || '—'}<br><b>EVENT:</b>&nbsp;${ev || '—'}`)
    }
  }
  if (mode === 'full') {
    const d = detailFields(r)
    out += entryMetaFooter(d.specOwner, d.justification ?? d.rationale, d.risks)
  }
  return out
}

// r41 v68 (Tom Gilb 2026-06-16 verbatim "no ! tag and separation") — Stakeholder
// renderer added to the export so the in-app Stakeholder section now has parity
// in the colourful HTML.  Uses the existing `stakeholder` colour palette
// (slate-blue family) defined in TYPE_COLOURS.  Tag underlined per the spec-Tag
// tradition.  Needs[] array rendered as a chip list joined by ` · `.
function renderStakeholder(sh: unknown, mode: SpecExportMode): string {
  const c = TYPE_COLOURS.stakeholder
  const e = sh as { id: string; definition?: string; description?: string; stakeholderType?: string;
    needs?: string[]; source?: string; maintContact?: { name?: string; position?: string; email?: string; url?: string } }
  // r41 v112 — header bar + body rows.  Definition is the canonical
  // Stakeholder identifier (CE Stakeholder template), labelled "Definition"
  // here.  Description is NOT a Planguage parameter (SUPREME) — when only
  // description is set (no definition), it falls back into the Definition
  // row so no information is lost while the label-rule is honoured.
  let out = entryHeaderBar(c, entryMnemonic(e), 'Stakeholder')
          + sourcesSummaryRow(sh)
          + bodyRow(c, 'Definition', e.definition ?? e.description)
  if (e.stakeholderType) out += bodyChipsRow(c, 'Stakeholder Type', [e.stakeholderType], c)
  if (Array.isArray(e.needs) && e.needs.length > 0) {
    out += bodyChipsRow(c, 'Needs', e.needs, TYPE_COLOURS.value)
  }
  if (mode === 'full' && (e.maintContact?.name || e.maintContact?.email || e.maintContact?.url)) {
    const parts = [
      e.maintContact.name,
      e.maintContact.position,
      e.maintContact.email,
      e.maintContact.url,
    ].filter(s => s && s.trim()) as string[]
    out += bodyRow(c, 'Contact', parts.join(' · '))
  }
  if (e.source) out += bodyRow(c, 'Source', e.source)
  return out
}

function renderConstraint(con: CEntry, mode: SpecExportMode): string {
  const c = TYPE_COLOURS.constraint
  const conSource = (con as unknown as { source?: string }).source
  // r41 v115 — per-field source helper (Constraint)
  const src = (k: string): string | undefined => {
    return (con as unknown as { fieldSources?: Record<string, { source?: string }> })
      .fieldSources?.[k]?.source
  }
  // r41 v112 — header bar + body rows.  Description labelled "Binary Rule"
  // (matches in-app at SpecOutput.vue:6824 — Constraint is a binary rule,
  // and the description text IS that rule.  Honours the no-"Description"-
  // label SUPREME by using the on-screen domain-specific label).
  let out = entryHeaderBar(c, entryMnemonic(con), 'Constraint')
          + sourcesSummaryRow(con)
          + bodyRow(c, 'Binary Rule', con.description, src('description'))
          + bodyRow(c, 'Scope',       con.scope,       src('scope'))
          + bodyRow(c, 'Rationale',   con.rationale,   src('rationale'))
  if (conSource) out += bodyRow(c, 'Source', conSource)
  const q = con.conditions as AnyConditions | undefined
  if (q) {
    const t  = (q.time  ?? q.when  ?? '').trim()
    const p  = (q.place ?? q.where ?? '').trim()
    const ev = (q.event ?? q.what  ?? q.how  ?? '').trim()
    const filled = [t, p, ev].filter(Boolean)
    if (filled.length > 0) {
      out += bodyRow(c, 'Qualifiers', `[${filled.join(', ')}]<br><b>TIME:</b>&nbsp;${t || '—'}<br><b>PLACE:</b>&nbsp;${p || '—'}<br><b>EVENT:</b>&nbsp;${ev || '—'}`)
    }
  }
  if (mode === 'full') {
    const d = detailFields(con)
    out += entryMetaFooter(d.specOwner, d.justification, d.risks)
  }
  return out
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
  options?: { mode?: SpecExportMode },
): string {
  const mode: SpecExportMode = options?.mode ?? 'full'
  // Table mode delegates to a flat-row renderer; the rest of this function
  // builds the sibling-table per-type structure for 'full' + 'condensed'.
  if (mode === 'table') {
    return renderTableModeHtml(spec, specName, version)
  }
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
  // r41 v59 — entries within a section are joined by ENTRY_SEPARATOR_ROW
  // (4 px slate-800 bar) so adjacent entries have a clear visual border per
  // Tom Gilb 2026-06-16 verbatim *"The line between spec items needs to be
  // much darker, clear spec item border."*
  // r41 v68 — Stakeholders table per Tom's BOTH-surfaces rule (r41 v63).
  // Read from `spec.stakeholderEntries` (the structured Planguage form
  // generated from 2026-06-09 onward). Older specs without
  // stakeholderEntries omit this table; the legacy `stakes` line in the
  // header still surfaces the comma-separated names.
  const stakeholderEntries = (spec as unknown as { stakeholderEntries?: unknown[] }).stakeholderEntries ?? []
  const stakeTable2 = stakeholderEntries.length > 0
    ? wrapTable(sectionHeader('Stakeholders — who cares about this plan', stakeholderEntries.length, TYPE_COLOURS.stakeholder)
              + stakeholderEntries.map(sh => renderStakeholder(sh, mode)).join(ENTRY_SEPARATOR_ROW))
    : ''

  const fnsTable = (spec.functions?.length ?? 0) > 0
    ? wrapTable(sectionHeader('Functions — binary capabilities', spec.functions!.length, TYPE_COLOURS.function)
              + spec.functions!.map(f => renderFunction(f, mode, { spec })).join(ENTRY_SEPARATOR_ROW))
    : ''
  const valsTable = (spec.values?.length ?? 0) > 0
    ? wrapTable(sectionHeader('Values — quantified qualities', spec.values!.length, TYPE_COLOURS.value)
              + spec.values!.map(v => renderValue(v, mode)).join(ENTRY_SEPARATOR_ROW))
    : ''
  const solsTable = (spec.solutions?.length ?? 0) > 0
    ? wrapTable(sectionHeader('Solutions — how we deliver', spec.solutions!.length, TYPE_COLOURS.solution)
              + spec.solutions!.map(s => renderSolution(s, mode)).join(ENTRY_SEPARATOR_ROW))
    : ''
  const consTable = (spec.constraints?.length ?? 0) > 0
    ? wrapTable(sectionHeader('Constraints — hard boundaries', spec.constraints!.length, TYPE_COLOURS.constraint)
              + spec.constraints!.map(c => renderConstraint(c, mode)).join(ENTRY_SEPARATOR_ROW))
    : ''
  const resTable = (spec.resources?.length ?? 0) > 0
    ? wrapTable(sectionHeader('Resources — budgets and consumables', spec.resources!.length, TYPE_COLOURS.resource)
              + spec.resources!.map(r => renderResource(r, mode)).join(ENTRY_SEPARATOR_ROW))
    : ''

  const footerTable = wrapTable(
    `<tr><td colspan="3" bgcolor="#f1f5f9" style="background:#f1f5f9;color:#64748b;font-size:11px;padding:8px 14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.4;">Generated by the <b>SEM App</b> · Planguage methodology by Tom Gilb · ${esc(date)} ${esc(time)}</td></tr>`
  )

  // Returned as concatenated sibling tables (no outer wrapper).  Keynote
  // ingests each as a separate, draggable, resizable table.  Mail clients
  // stack them vertically with the same visual rhythm.
  // Stakeholders structured table sits AFTER the legacy comma-list stakeTable
  // (which is just the raw `stakes` string) so the reader gets identification
  // context first, then the rich entries.
  return [headerTable, stakeTable, stakeTable2, fnsTable, valsTable, solsTable, consTable, resTable, footerTable].join('\n')
}

// ── Mode 3 — Table format (Tom Gilb 2026-06-16) ──────────────────────────────
// Tom verbatim: *"A Table format with each spec on a line (not unlike the
// template table)"*.  One row per entry, columnar overview — matches the
// SEM-Planguage-Object-Templates.html reference table shape: Type / Tag /
// Description / Scale or Presence test / Targets / Source / Qualifier.
// Single outer <table> per the One-table-for-cohesion rule (r93aaa) — the
// document reads as ONE artifact, no per-type sibling tables.
function renderTableModeHtml(spec: SpecBlock, specName: string, version?: string): string {
  const now     = new Date()
  const date    = now.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
  const time    = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const versTxt = version ? ` ${esc(version)}` : ''

  // r41 v59 — Tag column rendered bigger + underlined per Tom Gilb 2026-06-16
  // verbatim *"The Tag needs to be much bigger, and underlined (my old
  // tradition)."*  Plus dark separator row injected between consecutive entry
  // rows so the spec-item border is unmistakable.
  function row(typeLabel: string, c: TypeColour, tag: string, description: string, keyField: string, targetsOrLevels: string, source: string, qualifier: string): string {
    return `<tr>
      <td bgcolor="${c.mid}" style="background:${c.mid};color:#ffffff;font-weight:700;font-size:11px;padding:12px 10px;white-space:nowrap;vertical-align:top;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${esc(typeLabel)}</td>
      <td bgcolor="${c.soft}" style="background:${c.soft};color:${c.dark};font-weight:800;font-size:18px;padding:12px 12px;vertical-align:top;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.3;"><u>${esc(tag)}</u></td>
      <td bgcolor="#ffffff" style="background:#ffffff;color:#0f172a;font-size:12px;padding:12px 10px;vertical-align:top;line-height:1.5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${esc(description)}</td>
      <td bgcolor="#f8fafc" style="background:#f8fafc;color:#475569;font-size:11px;padding:12px 10px;vertical-align:top;line-height:1.5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${esc(keyField || '—')}</td>
      <td bgcolor="#f8fafc" style="background:#f8fafc;color:#475569;font-size:11px;padding:12px 10px;vertical-align:top;line-height:1.5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${esc(targetsOrLevels || '—')}</td>
      <td bgcolor="#f8fafc" style="background:#f8fafc;color:#475569;font-size:11px;padding:12px 10px;vertical-align:top;line-height:1.5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${esc(source || '—')}</td>
      <td bgcolor="#f8fafc" style="background:#f8fafc;color:#475569;font-size:11px;padding:12px 10px;vertical-align:top;line-height:1.5;font-family:ui-monospace,monospace;">${esc(qualifier || '—')}</td>
    </tr>`
  }
  // Dark inter-entry separator row for table mode — 4 px slate-800 stripe.
  const TABLE_MODE_SEP = `<tr><td colspan="7" bgcolor="#1e293b" height="4" style="background:#1e293b;height:4px;padding:0;line-height:0;font-size:0;border:none;">&nbsp;</td></tr>`

  function pickSource(e: unknown): string {
    const d = detailFields(e)
    if (d.source?.trim()) return d.source.trim()
    const a = (d.ambitionLevel as unknown[]) ?? []
    if (a.length > 0) {
      const first = a[0] as { sourcePerson?: string; sourceRef?: string }
      const parts = [first.sourcePerson, first.sourceRef].filter(s => s && String(s).trim())
      if (parts.length > 0) return parts.join(' · ')
    }
    return ''
  }

  function pickQualifier(c: unknown): string {
    const conds = c as AnyConditions | undefined
    if (!conds) return ''
    const t  = conds.time  ?? conds.when  ?? ''
    const p  = conds.place ?? conds.where ?? ''
    const ev = conds.event ?? conds.what  ?? conds.how ?? ''
    const filled = [t, p, ev].filter(s => s && String(s).trim())
    return filled.length === 0 ? '[∞]' : `[${filled.join(', ')}]`
  }

  const headerHtml = `<tr>
    <td colspan="7" bgcolor="#7c3aed" style="background:#7c3aed;color:#ffffff;font-size:18px;font-weight:800;padding:14px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.4;">${esc(specName)}${versTxt} <span style="font-size:11px;font-weight:500;opacity:0.85;">· Table format · ${esc(date)} ${esc(time)}</span></td>
  </tr>
  <tr>
    <th bgcolor="#1e293b" style="background:#1e293b;color:#ffffff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;padding:8px 10px;text-align:left;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Type</th>
    <th bgcolor="#1e293b" style="background:#1e293b;color:#ffffff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;padding:8px 10px;text-align:left;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Tag</th>
    <th bgcolor="#1e293b" style="background:#1e293b;color:#ffffff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;padding:8px 10px;text-align:left;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Description</th>
    <th bgcolor="#1e293b" style="background:#1e293b;color:#ffffff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;padding:8px 10px;text-align:left;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Scale / Presence</th>
    <th bgcolor="#1e293b" style="background:#1e293b;color:#ffffff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;padding:8px 10px;text-align:left;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Targets / Levels</th>
    <th bgcolor="#1e293b" style="background:#1e293b;color:#ffffff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;padding:8px 10px;text-align:left;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Source</th>
    <th bgcolor="#1e293b" style="background:#1e293b;color:#ffffff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;padding:8px 10px;text-align:left;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Qualifier</th>
  </tr>`

  const stakeholderRows = ((spec as unknown as { stakeholderEntries?: unknown[] }).stakeholderEntries ?? []).map(sh => {
    const e = sh as { id: string; definition?: string; description?: string; stakeholderType?: string; needs?: string[]; source?: string }
    const needsLine = Array.isArray(e.needs) && e.needs.length > 0 ? e.needs.join(' · ') : ''
    return row('Stakeholder', TYPE_COLOURS.stakeholder, e.id, e.definition ?? e.description ?? '', e.stakeholderType ?? 'Stakeholder', needsLine, e.source ?? '', '')
  }).join(TABLE_MODE_SEP)

  const valueRows = (spec.values ?? []).map(v => {
    const levels = [
      v.tolerable ? `Tolerable: ${v.tolerable}` : '',
      v.goal      ? `Goal: ${v.goal}`           : '',
      v.wish      ? `Wish: ${v.wish}`           : '',
      v.status    ? `Status: ${v.status}`       : '',
    ].filter(Boolean).join(' · ')
    return row('Value', TYPE_COLOURS.value, v.id, v.description, v.scale ?? '', levels, pickSource(v), pickQualifier(v.conditions))
  }).join(TABLE_MODE_SEP)

  const funcRows = (spec.functions ?? []).map(f => {
    return row('Function', TYPE_COLOURS.function, f.id, f.description, f.presenceTest ?? f.successCriteria ?? '', f.functionOfValue ?? '', pickSource(f), '')
  }).join(TABLE_MODE_SEP)

  const solRows = (spec.solutions ?? []).map(s => {
    return row('Solution', TYPE_COLOURS.solution, s.id, s.description, s.function ?? '', s.impact ?? '', pickSource(s), '')
  }).join(TABLE_MODE_SEP)

  const conRows = (spec.constraints ?? []).map(c => {
    return row('Constraint', TYPE_COLOURS.constraint, c.id, c.description, c.scope ?? '', c.rationale ?? '', pickSource(c), pickQualifier(c.conditions))
  }).join(TABLE_MODE_SEP)

  const resRows = (spec.resources ?? []).map(r => {
    const levels = [
      r.tolerable    ? `Tolerable: ${r.tolerable}`        : '',
      rBudget(r)     ? `${rBudgetLabel(r)}: ${rBudget(r)}`: '',
      r.wish         ? `Wish: ${r.wish}`                  : '',
      r.status       ? `Now: ${r.status}`                 : '',
    ].filter(Boolean).join(' · ')
    return row('Resource', TYPE_COLOURS.resource, r.id, r.description, r.scale ?? '', levels, pickSource(r), pickQualifier(r.conditions))
  }).join(TABLE_MODE_SEP)

  const footerHtml = `<tr>
    <td colspan="7" bgcolor="#f1f5f9" style="background:#f1f5f9;color:#64748b;font-size:11px;padding:8px 14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.4;">Generated by the <b>SEM App</b> · Planguage methodology by Tom Gilb · ${esc(date)} ${esc(time)}</td>
  </tr>`

  return `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;width:100%;max-width:1100px;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0 0 14px 0;">${headerHtml}${stakeholderRows}${valueRows}${funcRows}${solRows}${conRows}${resRows}${footerHtml}</table>`
}
