// useSharpenExport.ts — Sharpening Q&A export (Tom Gilb 2026-06-16 verbatim
// "the sharpening q and a needs export badly everywhere now").
//
// Implements the SUPREME "Export button on all windows" rule (memory file
// `rule_export_button_on_all_windows.md`) for the Sharpening Cycles surface:
//   (1) builds a single full-detail colourful HTML document capturing every
//       sharpen round — category, every question, every answer, every AI
//       suggestion, every spec change made (before / after / changed fields)
//   (2) puts HTML + plain on the clipboard via the dual-MIME exportCopy
//   (3) opens a preview window with 100% of the model immediately
//   (4) auto-opens Mail to Tom@Gilb.com per the SEM Email Body Standard
//   (5) embeds a Planguage Glossary footnote pointing at the canonical
//       Sharpening / Q&A / Round definitions
//   (6) returns a success toast string the caller fires
//
// Composes with: BOTH-surfaces rule (r41 v63 — the in-app Sharpen surface
// and the exported document tell the same story), Colorful HTML Spec Email
// Rule SUPREME (inline-styled HTML, bgcolor attributes for Keynote, one
// outer cohesive table per round, dual-MIME clipboard), One-table-for-
// cohesion (r93aaa — each round renders as ONE cohesive Keynote block
// rather than scattered sibling tables).

import type { SharpenRound, SharpenChangedEntry } from './useSharpen'
import type { SpecBlock, FieldSource } from '../types/spec'
import { exportCopy, exportEmail } from './useExportShared'

// r41 v85 (Tom Gilb 2026-06-16 "sharpening change list color but still not
// giving all detail like sources!!!!!! / re full entry state: I want to the
// the logic chain for each change, ideally from entry spect, to parse, to
// planguage spece, then to sharpening question and answer, then to changes
// on Planguage spec") — looker-uppers + provenance helpers.
//
// The renderer now accepts an optional `spec` parameter so it can look up
// per-field source attribution (fieldSources) from the LIVE entry that the
// change targets.  fieldSources is the Sources-of-Specs SUPREME provenance
// data (Tom Gilb 2026-06-09: "when we now generate specs, and spec
// parameters like Scale, is the logic there to append the source").
// Per-change provenance header names the round + category so each change is
// explicitly linked back to the Q&A that motivated it.

interface SpecEntryWithSources {
  id: string
  fieldSources?: Record<string, FieldSource>
  source?: string
  sourceType?: string
}

function findEntryInSpec(spec: SpecBlock | undefined, entryId: string): SpecEntryWithSources | null {
  if (!spec) return null
  const all: SpecEntryWithSources[] = [
    ...(spec.functions   ?? []),
    ...(spec.values      ?? []),
    ...(spec.solutions   ?? []),
    ...(spec.constraints ?? []),
    ...(spec.resources   ?? []),
  ] as unknown as SpecEntryWithSources[]
  return all.find(e => e.id === entryId) ?? null
}

function fieldSourceLabel(fs: FieldSource | undefined): string {
  if (!fs?.source) return ''
  const date = fs.timestamp ? new Date(fs.timestamp).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : ''
  const tool = fs.tool ? ` · ${fs.tool}` : ''
  const type = fs.sourceType ? ` [${fs.sourceType}]` : ''
  return `${fs.source}${type}${tool}${date ? ' · ' + date : ''}`
}

// ── Per-round palette (mirrors the in-app amber Sharpening Cycles theme) ─────
const ROUND = {
  dark: '#92400e',   // amber-800
  mid:  '#d97706',   // amber-600
  soft: '#fef3c7',   // amber-100
  stripe: '#fbbf24', // amber-400 — Q-stripe
  ans:  '#10b981',   // emerald-500 — A-stripe
}

function esc(s: string | undefined | null): string {
  if (s == null) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function fmtDate(d: Date = new Date()): string {
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
}

function fmtTime(d: Date = new Date()): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// ── Change block — entry id + FULL Planguage card with per-field diff overlay ──
// r41 v84 (Tom Gilb 2026-06-16 verbatim "I want the detail for each sharpening
// change, included with the detailed sharpening list") — previous renderer
// only emitted `c.changedFields` for MODIFIED entries, hiding all the
// unchanged context.  Now: ALL fields in `c.after` with values are rendered
// every time — Tag headline (big underlined) + Scale / Meter / Tolerable /
// Goal / Wish / Status / Ambition Level / Source / Rationale / Justification /
// Risks / Assumptions / etc. — with strikethrough+red on PRIOR value for
// fields that actually changed.  Unchanged fields render in plain black
// (full context).  Changed-fields badge in the header names exactly what
// shifted ("3 fields changed: scale · tolerable · goal").

// Canonical Planguage field order — id / type-specific identity / scalar
// levels / detail provenance.  Unknown fields fall through at the end.
const FIELD_ORDER = [
  'description',
  'presenceTest', 'successCriteria',
  'scale', 'meter',
  'past', 'status', 'trend',
  'survival', 'fail', 'tolerable',
  'goal', 'stretch', 'wish', 'monster', 'trigger',
  'budget', 'consumed', 'now',
  'valueOfFunction', 'functionOfValue', 'impact', 'function',
  'resourceForValue', 'consumedBy',
  'scope', 'rationale',
  'ambitionLevel',
  'wishStakeholder', 'stakeholders', 'specOwner', 'owner', 'authority',
  'justification', 'risks', 'assumptions', 'definedAs', 'test',
  'source', 'sourceType',
  'conditions',
]

const FIELD_LABEL: Record<string, string> = {
  description: 'Description', presenceTest: 'Presence test', successCriteria: 'Success criteria',
  scale: 'Scale', meter: 'Meter',
  past: 'Past', status: 'Status', trend: 'Trend',
  survival: 'Survival', fail: 'Fail', tolerable: 'Tolerable',
  goal: 'Goal', stretch: 'Stretch', wish: 'Wish', monster: 'Monster', trigger: 'Trigger',
  budget: 'Budget', consumed: 'Consumed', now: 'Now',
  valueOfFunction: 'Value-of-Function', functionOfValue: 'Function-of-Value',
  impact: 'Impact', function: 'Function (parent)',
  resourceForValue: 'Resource-for-Value', consumedBy: 'Consumed by',
  scope: 'Scope', rationale: 'Rationale',
  ambitionLevel: 'Ambition Level',
  wishStakeholder: 'Wish Stakeholder', stakeholders: 'Stakeholders',
  specOwner: 'Spec Owner', owner: 'Owner', authority: 'Authority',
  justification: 'Justification', risks: 'Risks', assumptions: 'Assumptions',
  definedAs: 'Defined as', test: 'Test',
  source: 'Source', sourceType: 'Source type',
  conditions: 'Qualifier Conditions',
}

function orderedFields(after: Record<string, string>): Array<[string, string]> {
  const seen = new Set<string>()
  const out: Array<[string, string]> = []
  for (const k of FIELD_ORDER) {
    if (k in after) {
      const v = after[k]
      if (v && String(v).trim()) out.push([k, String(v)])
      seen.add(k)
    }
  }
  for (const [k, v] of Object.entries(after)) {
    if (seen.has(k) || k === 'id' || k === 'type' || k === 'level') continue
    if (v && String(v).trim()) out.push([k, String(v)])
  }
  return out
}

function renderChange(c: SharpenChangedEntry, round: SharpenRound, roundIdx: number, spec?: SpecBlock): string {
  const statusBg    = c.status === 'added' ? '#dcfce7' : '#fef3c7'
  const statusText  = c.status === 'added' ? '#15803d' : '#92400e'
  const statusLabel = c.status === 'added' ? 'ADDED — NEW ENTRY' : 'MODIFIED'
  const changedSet  = new Set(c.changedFields ?? [])
  const fields      = orderedFields(c.after)

  // r41 v85 — look up the live entry so we can surface fieldSources per
  // field.  Returns null when the change targets an entry no longer in the
  // current spec (rare — only happens for deleted entries; sharpening
  // doesn't delete so this should always resolve).
  const liveEntry = findEntryInSpec(spec, c.entryId)
  const entrySource = liveEntry?.source ? fieldSourceLabel({ source: liveEntry.source, sourceType: liveEntry.sourceType ?? 'unknown', timestamp: new Date().toISOString() } as FieldSource) : ''

  const changedSummary = c.status === 'modified' && changedSet.size > 0
    ? `<span style="font-size:11px;font-weight:600;color:${statusText};margin-left:8px;">${changedSet.size} field${changedSet.size === 1 ? '' : 's'} changed: ${[...changedSet].map(esc).join(' · ')}</span>`
    : ''

  // Header row — status badge + Tag (big, underlined, like a Planguage card headline)
  const header = `<tr>
    <td colspan="3" bgcolor="${statusBg}" style="background:${statusBg};color:${statusText};font-weight:700;font-size:13px;padding:10px 14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;border-top:1px solid #fbbf24;">
      <span style="background:${statusText};color:#ffffff;font-size:10px;font-weight:800;padding:2px 8px;border-radius:4px;margin-right:10px;letter-spacing:0.04em;">${esc(statusLabel)}</span>
      <span style="font-size:18px;font-weight:800;letter-spacing:0.01em;"><u>${esc(c.entryId)}</u></span>
      <span style="color:#94a3b8;font-weight:500;font-size:11px;margin-left:8px;">${esc(c.entryType)}.</span>
      ${changedSummary}
    </td>
  </tr>`

  // r41 v85 — Provenance chain row: explicit logic chain from Q&A to this
  // change.  Per Tom verbatim: "I want to the logic chain for each change,
  // ideally from entry spect, to parse, to planguage spece, then to
  // sharpening question and answer, then to changes on Planguage spec".
  // Named round + category + entry-level source if available.
  const provenance = `<tr>
    <td colspan="3" bgcolor="#f8fafc" style="background:#f8fafc;color:#475569;font-size:11px;font-style:italic;padding:6px 14px 8px 14px;border-bottom:1px solid #e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.5;">
      <b>Provenance:</b>
      raw input → parsed entries → Planguage Spec
      → <b>Round ${roundIdx + 1} · ${esc(round.category.emoji)} ${esc(round.category.label)}</b> Sharpening Q&amp;A
      → this change${entrySource ? ` · <b>entry-level source</b>: ${esc(entrySource)}` : ''}
    </td>
  </tr>`

  // All fields rendered (full Planguage card context).  Changed fields get
  // a red strikethrough on the prior value + the new value highlighted.
  // Per-field source line under each value (fieldSources from the live spec).
  const fieldRows = fields.map(([field, value]) => {
    const isChanged = changedSet.has(field)
    const before    = c.status === 'modified' && c.before ? (c.before[field] ?? '') : ''
    const label     = FIELD_LABEL[field] ?? field
    const labelColor = isChanged ? statusText : '#64748b'
    const valueBg    = isChanged ? '#fffbeb' : '#ffffff'
    const stripeBg   = isChanged ? '#d97706' : '#cbd5e1'
    const beforeBlock = (isChanged && before)
      ? `<div style="font-size:11px;color:#dc2626;text-decoration:line-through;margin-bottom:3px;padding:2px 6px;background:#fee2e2;border-radius:3px;display:inline-block;">${esc(before)}</div><br>`
      : ''
    const changedPill = isChanged
      ? `<span style="background:#d97706;color:#ffffff;font-size:9px;font-weight:700;padding:1px 5px;border-radius:3px;margin-left:6px;vertical-align:middle;">CHANGED</span>`
      : ''
    // r41 v85 — per-field source attribution from fieldSources
    const fs        = liveEntry?.fieldSources?.[field]
    const sourceBlock = fs?.source
      ? `<div style="font-size:10px;color:#64748b;margin-top:4px;font-style:italic;padding:2px 6px;background:#f1f5f9;border-radius:3px;display:inline-block;"><b style="color:#475569;">Source:</b> ${esc(fieldSourceLabel(fs))}</div>`
      : ''
    return `<tr>
      <td bgcolor="${stripeBg}" width="14" style="background:${stripeBg};width:14px;padding:0;">&nbsp;</td>
      <td bgcolor="${ROUND.soft}" width="130" style="background:${ROUND.soft};color:${labelColor};font-weight:700;font-size:11px;padding:7px 10px;white-space:nowrap;vertical-align:top;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;letter-spacing:0.02em;text-transform:uppercase;">${esc(label)}${changedPill}</td>
      <td bgcolor="${valueBg}" style="background:${valueBg};color:#0f172a;font-size:13px;padding:7px 12px;line-height:1.55;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${beforeBlock}${esc(value)}${sourceBlock}</td>
    </tr>`
  }).join('')

  return header + provenance + fieldRows
}

// ── One Q&A row — question + answer + suggestions ──────────────────────────
function renderQA(q: string, a: string, suggestions: string[], n: number): string {
  const suggBlock = suggestions.length > 0
    ? `<div style="margin-top:6px;font-size:10px;color:#94a3b8;font-style:italic;">AI suggestions: ${suggestions.map(s => esc(s)).join(' · ')}</div>`
    : ''
  return `<tr>
    <td bgcolor="${ROUND.stripe}" width="14" style="background:${ROUND.stripe};width:14px;padding:0;">&nbsp;</td>
    <td bgcolor="${ROUND.soft}" width="38" style="background:${ROUND.soft};color:${ROUND.dark};font-weight:800;font-size:14px;padding:8px 10px;vertical-align:top;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;text-align:center;">Q${n}</td>
    <td bgcolor="#ffffff" style="background:#ffffff;color:#0f172a;font-size:13px;padding:8px 12px;line-height:1.55;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <div style="font-weight:600;color:#92400e;margin-bottom:4px;">${esc(q)}</div>
      ${suggBlock}
    </td>
  </tr>
  <tr>
    <td bgcolor="${ROUND.ans}" width="14" style="background:${ROUND.ans};width:14px;padding:0;">&nbsp;</td>
    <td bgcolor="#dcfce7" width="38" style="background:#dcfce7;color:#15803d;font-weight:800;font-size:14px;padding:8px 10px;vertical-align:top;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;text-align:center;">A${n}</td>
    <td bgcolor="#f0fdf4" style="background:#f0fdf4;color:#0f172a;font-size:13px;padding:8px 12px;line-height:1.55;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${a.trim() ? esc(a.trim()) : '<span style="color:#94a3b8;font-style:italic;">(skipped)</span>'}</td>
  </tr>`
}

// ── One Round — category header + Q&A list + change list ───────────────────
function renderRound(round: SharpenRound, idx: number, spec?: SpecBlock): string {
  const qaRows = round.questions.map((q, i) => {
    const a = round.answers[i] ?? ''
    return renderQA(q.text, a, q.suggestions ?? [], i + 1)
  }).join('')
  const changeRows = round.changes.length > 0
    ? round.changes.map(c => renderChange(c, round, idx, spec)).join('')
    : `<tr><td colspan="3" bgcolor="#fef3c7" style="background:#fef3c7;color:#92400e;font-style:italic;font-size:12px;padding:10px 14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">No spec changes recorded for this round.</td></tr>`
  const headerRow = `<tr>
    <td colspan="3" bgcolor="${ROUND.mid}" style="background:${ROUND.mid};color:#ffffff;padding:14px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.4;">
      <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;font-weight:600;opacity:0.85;margin-bottom:4px;">Round ${idx + 1} · Sharpening Cycle</div>
      <div style="font-size:20px;font-weight:800;letter-spacing:0.01em;"><u>${esc(round.category.emoji)} ${esc(round.category.label)}</u></div>
      <div style="font-size:11px;opacity:0.85;margin-top:4px;">${round.questions.length} question${round.questions.length === 1 ? '' : 's'} · ${round.changes.length} spec change${round.changes.length === 1 ? '' : 's'}</div>
    </td>
  </tr>`
  return `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;width:100%;max-width:820px;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0 0 18px 0;box-shadow:0 6px 0 0 #1e293b, 0 1px 3px rgba(0,0,0,0.08);">
    ${headerRow}
    ${qaRows}
    ${changeRows}
  </table>`
}

// ── Public — full Sharpening Q&A export HTML ────────────────────────────────
export function renderSharpenHtml(rounds: SharpenRound[], planName: string, version?: string, spec?: SpecBlock): string {
  const date    = fmtDate()
  const time    = fmtTime()
  const versTxt = version ? ` ${esc(version)}` : ''
  const totalQ  = rounds.reduce((s, r) => s + r.questions.length, 0)
  const totalC  = rounds.reduce((s, r) => s + r.changes.length, 0)

  const headerHtml = `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;width:100%;max-width:820px;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0 0 14px 0;">
    <tr><td bgcolor="${ROUND.mid}" style="background:${ROUND.mid};color:#ffffff;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;font-weight:600;padding:18px 22px 6px 22px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.5;">🔪 Sharpening Q&amp;A · SEM App</td></tr>
    <tr><td bgcolor="${ROUND.mid}" style="background:${ROUND.mid};color:#ffffff;font-size:22px;font-weight:800;padding:6px 22px 14px 22px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.3;">${esc(planName)}${versTxt}</td></tr>
    <tr><td bgcolor="${ROUND.mid}" style="background:${ROUND.mid};color:#ffffff;font-size:11px;opacity:0.9;padding:4px 22px 18px 22px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.5;">${esc(date)} · ${esc(time)} · ${rounds.length} round${rounds.length === 1 ? '' : 's'} · ${totalQ} question${totalQ === 1 ? '' : 's'} · ${totalC} spec change${totalC === 1 ? '' : 's'}</td></tr>
  </table>`

  const roundsHtml = rounds.length > 0
    ? rounds.map((r, i) => renderRound(r, i, spec)).join('\n')
    : `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;width:100%;max-width:820px;background:#fff7ed;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0 0 14px 0;"><tr><td style="padding:18px 22px;font-style:italic;color:#92400e;font-size:13px;">No sharpening rounds recorded yet.</td></tr></table>`

  // Glossary footnote — points at Tom Gilb Consultant Twin concept URLs for
  // Sharpening / Round / Q&A discipline.  Per the Twin-as-Destination
  // promotional rule (r93ppp) and the Sources-of-Specs SUPREME provenance
  // rule.
  const footerHtml = `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;width:100%;max-width:820px;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0 0 14px 0;">
    <tr><td bgcolor="#f1f5f9" style="background:#f1f5f9;color:#64748b;font-size:11px;padding:10px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.5;">
      <b>Glossary footnote</b> · <i>Sharpening Cycle</i> = an iterative Q&amp;A pass over one Planguage dimension that progressively refines the spec until the planner declares it "Sharp Enough". Each Round captures the AI's questions, the planner's answers, and the concrete spec changes derived from them — preserving the full Source chain.<br>
      Source: Tom Gilb Consultant Twin — <a href="https://www.gilb.com/tomtwin" style="color:#5b21b6;font-weight:bold;">gilb.com/tomtwin</a> (by Kai Gilb).
    </td></tr>
    <tr><td bgcolor="#f1f5f9" style="background:#f1f5f9;color:#64748b;font-size:11px;padding:6px 16px 12px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.5;">Generated by the <b>SEM App</b> · Planguage methodology by Tom Gilb · ${esc(date)} ${esc(time)}</td></tr>
  </table>`

  return [headerHtml, roundsHtml, footerHtml].join('\n')
}

// ── Public — plain-text fallback for chat / non-HTML targets ───────────────
export function renderSharpenPlain(rounds: SharpenRound[], planName: string, version?: string, spec?: SpecBlock): string {
  const date    = fmtDate()
  const time    = fmtTime()
  const versTxt = version ? ` ${version}` : ''
  const lines: string[] = []
  lines.push(`🔪 Sharpening Q&A · ${planName}${versTxt}`)
  lines.push(`${date} · ${time}`)
  lines.push('═'.repeat(64))
  for (let i = 0; i < rounds.length; i++) {
    const r = rounds[i]
    lines.push('')
    lines.push(`Round ${i + 1} · ${r.category.emoji} ${r.category.label}`)
    lines.push('─'.repeat(48))
    for (let j = 0; j < r.questions.length; j++) {
      const q = r.questions[j]
      const a = r.answers[j] ?? ''
      lines.push(`Q${j + 1}. ${q.text}`)
      if (q.suggestions?.length) lines.push(`   suggestions: ${q.suggestions.join(' · ')}`)
      lines.push(`A${j + 1}. ${a.trim() || '(skipped)'}`)
      lines.push('')
    }
    if (r.changes.length === 0) {
      lines.push('  No spec changes recorded for this round.')
    } else {
      lines.push(`  ${r.changes.length} spec change${r.changes.length === 1 ? '' : 's'}:`)
      for (const c of r.changes) {
        // r41 v84 — full Planguage card on every change (not just changed
        // fields).  MODIFIED fields prefixed `*` so they stand out.
        const changedSet = new Set(c.changedFields ?? [])
        const summary = c.status === 'modified' && changedSet.size > 0
          ? ` — ${changedSet.size} field${changedSet.size === 1 ? '' : 's'} changed: ${[...changedSet].join(', ')}`
          : ''
        lines.push(`  · [${c.status.toUpperCase()}] ${c.entryId} (${c.entryType}.)${summary}`)
        const fields = orderedFields(c.after)
        for (const [field, value] of fields) {
          const label  = FIELD_LABEL[field] ?? field
          const marker = changedSet.has(field) ? '*' : ' '
          if (changedSet.has(field) && c.before?.[field]) {
            lines.push(`    ${marker} ${label}: ${c.before[field]} → ${value}`)
          } else {
            lines.push(`    ${marker} ${label}: ${value}`)
          }
        }
      }
    }
  }
  lines.push('')
  lines.push('═'.repeat(64))
  lines.push('Glossary: Sharpening Cycle — iterative Q&A pass over one Planguage dimension that progressively refines the spec until "Sharp Enough".')
  lines.push('Source: Tom Gilb Consultant Twin (by Kai Gilb) — https://www.gilb.com/tomtwin')
  return lines.join('\n')
}

// ── Public — one-call export wiring ────────────────────────────────────────
/** Copy the colourful HTML + plain text to clipboard and return the HTML. */
export async function copySharpen(rounds: SharpenRound[], planName: string, version?: string, spec?: SpecBlock): Promise<string> {
  const html  = renderSharpenHtml(rounds, planName, version, spec)
  const plain = renderSharpenPlain(rounds, planName, version, spec)
  console.info('[copySharpen] html size:', html.length, '· plain size:', plain.length, '· rounds:', rounds.length, '· spec source-lookup:', !!spec)
  await exportCopy(html, plain)
  return html
}

/** Copy to clipboard AND open Mail.app with an EMPTY To: field per SEM Email
 *  Body Standard.  r41 v80 (Tom Gilb 2026-06-16 verbatim "EMAIL SHARPENING
 *  YOU PUT THE MAIN IN THE TO SECTION, SILLY BOY"): Tom is the SENDER, not
 *  the recipient.  Pre-filling To: with his own address means he's emailing
 *  himself.  Leave To: empty so he picks the actual recipient. */
export async function emailSharpen(rounds: SharpenRound[], planName: string, version?: string, spec?: SpecBlock): Promise<void> {
  const html    = renderSharpenHtml(rounds, planName, version, spec)
  const plain   = renderSharpenPlain(rounds, planName, version, spec)
  const date    = new Date().toISOString().slice(0, 10)
  const versTxt = version ? ` ${version}` : ''
  const subject = `Sharpening Q&A · ${planName}${versTxt} · ${date}`
  console.info('[emailSharpen] html size:', html.length, '· plain size:', plain.length, '· rounds:', rounds.length, '· spec source-lookup:', !!spec, '· first 600 chars of HTML:', html.slice(0, 600))
  // r41 v113 (Tom Gilb 2026-06-17) — pre-fill To: with Tom@Gilb.com (Scribe
  // default) so ⌘V lands in body, not the empty To: slot.  Supersedes
  // Mailto-No-Self-To rule.
  await exportEmail(html, subject, 'Sharpening Q&A', undefined, plain)
}

/** Open a preview window with 100% of the rendered HTML.
 *
 *  r41 v227 (Tom Gilb 2026-06-20 verbatim "no close export or return to last
 *  for this new Munger") — preview window now includes a STICKY top action
 *  bar AND a STICKY bottom action bar (DD-014 Top-and-Bottom Nav Mirror)
 *  with three universal affordances per the SUPREME rules:
 *    1) ← Return — closes the preview, returns to the parent SEM App window.
 *    2) 📤 Copy + Email — copies the HTML body to clipboard + opens Mail.app
 *       (mailto:) with an empty To and a meaningful Subject.  Honours the
 *       SEM Email Body Standard (LOUD ⌘V cue in the body).
 *    3) ✕ Close — closes the preview window.
 *
 *  Composes with: CloseDot SUPREME (close affordance on every panel/window),
 *  Export-button-on-all-windows SUPREME, MOVE Principle (primary actions
 *  visible at-a-glance), DD-014 Top-and-Bottom Navigation Mirror (long
 *  scroll content needs nav at both ends), accessibility_tom.md (≥ 36 px
 *  hit targets), Icon-Plus-Text SUPREME (glyph + text label on every btn). */
export function previewSharpen(rounds: SharpenRound[], planName: string, version?: string, spec?: SpecBlock): void {
  const html = renderSharpenHtml(rounds, planName, version, spec)
  const w    = window.open('', '_blank', 'width=920,height=920,scrollbars=yes,resizable=yes')
  if (!w) {
    console.warn('[previewSharpen] window.open blocked — clipboard still has the HTML')
    return
  }
  const subject = encodeURIComponent(`Sharpening Q&A · ${planName}${version ? ' ' + version : ''} · ${fmtDate()}`)
  const mailtoBody = encodeURIComponent(`PASTE ⌘V (CMD+V) HERE FOR COLOR VERSION\nExported: ${fmtDate()}\n────────────────────────────────────────────────────────\n\n[Add a brief note here if you like — or just ⌘V to paste the colour version above the line.]\n`)
  // Inline JS in the popup must escape literal "</script>" sequences from
  // the body HTML.  We render body HTML via a textContent assignment for
  // the clipboard so the popup's inline script can copy it safely.
  const actionBarStyle = 'background:#1e293b;color:#fff;padding:10px 18px;display:flex;align-items:center;justify-content:space-between;gap:8px;box-shadow:0 2px 8px rgba(0,0,0,0.25);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;'
  const btnBase       = 'border:0;padding:8px 14px;border-radius:8px;font-weight:700;font-size:12px;cursor:pointer;display:inline-flex;align-items:center;gap:4px;min-height:36px;'
  const btnReturn     = `style='${btnBase}background:#475569;color:#fff;' title='← Return — close this preview and return to the SEM App window' onclick='window.close()'`
  const btnExport     = `style='${btnBase}background:#059669;color:#fff;' title='📤 Copy + Email — copy this colour HTML to clipboard, then open Mail.app to paste with ⌘V' onclick='copyAndEmail()'`
  const btnClose      = `style='${btnBase}background:#dc2626;color:#fff;' title='✕ Close — close this preview window' onclick='window.close()'`
  const topBar    = `<div style="position:sticky;top:0;z-index:1000;${actionBarStyle}"><span style="font-weight:700;font-size:13px;letter-spacing:.05em;">🔪 Sharpening Q&amp;A · ${esc(planName)}</span><div style="display:flex;gap:6px;">  <button ${btnReturn}>← Return</button>  <button ${btnExport}>📤 Copy + Email</button>  <button ${btnClose}>✕ Close</button></div></div>`
  const bottomBar = `<div style="position:sticky;bottom:0;z-index:1000;${actionBarStyle}"><span style="font-weight:600;font-size:12px;opacity:0.9;">End of Sharpening Q&amp;A export</span><div style="display:flex;gap:6px;">  <button ${btnReturn}>← Return</button>  <button ${btnExport}>📤 Copy + Email</button>  <button ${btnClose}>✕ Close</button></div></div>`
  // Inline script — copies the rendered body HTML (minus the action bars)
  // to the clipboard then opens Mail.app via mailto.
  const inlineScript = `
    function copyAndEmail() {
      try {
        var container = document.getElementById('sharpen-body')
        var html = container ? container.innerHTML : document.body.innerHTML
        var plain = (container ? container.innerText : document.body.innerText) || ''
        if (navigator.clipboard && window.ClipboardItem) {
          var item = new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([plain], { type: 'text/plain' }),
          })
          navigator.clipboard.write([item]).then(function() {
            window.location.href = 'mailto:?subject=${subject}&body=${mailtoBody}'
          }).catch(function() { fallbackCopy() })
        } else { fallbackCopy() }
      } catch (e) { fallbackCopy() }
    }
    function fallbackCopy() {
      var ta = document.createElement('textarea')
      ta.value = document.getElementById('sharpen-body').innerText
      document.body.appendChild(ta); ta.select()
      try { document.execCommand('copy') } catch (e) {}
      ta.remove()
      window.location.href = 'mailto:?subject=${subject}&body=${mailtoBody}'
    }
  `
  w.document.open()
  w.document.write(`<!DOCTYPE html><html><head><title>Sharpening Q&amp;A · ${esc(planName)}</title><meta charset="utf-8"><script>${inlineScript}<\/script></head><body style="margin:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${topBar}<div id="sharpen-body" style="padding:24px;">${html}</div>${bottomBar}</body></html>`)
  w.document.close()
}
