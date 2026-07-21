/**
 * useGoalLadderExport.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Goal Ladder (Feature #104) colourful HTML + plain-text export.
 *
 * Tom Gilb 2026-06-22 verbatim (always-continue greenlight for the Export-
 * Button-on-All-Windows SUPREME sweep): "always continue · research and
 * innovation project".  Goal Ladder is on the pending sweep list — this
 * composable closes that gap.
 *
 * The Goal Ladder visualises EACH Value entry's commitment ladder
 * (Tolerable → Goal → Wish) with the parsed numeric value per rung.  At
 * export time we render:
 *   • Header card (planName + version + exported timestamp)
 *   • Summary card (Value-entry count · rung totals · status counts)
 *   • Per-Value sub-tables — each shows Tolerable / Goal / Wish rung values
 *     in the canonical Planguage colours (amber / emerald / violet) on white
 *     (DD-017 colorblind-safe — white background, never green-on-dark).
 *   • Planguage Glossary footnote (canonical Tolerable / Goal / Wish defs)
 *   • Velocity-of-Learning quote footer (Stages-are-Cyclic SUPREME)
 *
 * Architecture mirrors useEvoStepsExport.ts:
 *   • ONE outer wrapper → sub-tables per section
 *   • Inline styles + bgcolor= attrs everywhere — Keynote/Mail/Notes safe
 *   • Soft-wrap long strings (Tag, status text) — Keynote descender-clip cure
 *   • NO nested <table> inside <td> (Keynote splits nested tables)
 *
 * Composes with:
 *   • Export Button on All Windows Rule (SUPREME)
 *   • Colorful HTML Spec Email Rule (SUPREME)
 *   • Gilb HTML Table Standard
 *   • DD-017 R-G colourblind-safe (white-background palette)
 *   • Planguage Glossary Definitions in Tools rule (footer)
 *   • Stages-are-Cyclic + Stage-Has-a-Purpose (Velocity-of-Learning footer)
 *   • Twin portability — pure renderer function
 */

import type { LadderEntry } from './useGoalLadder'

// ── Types ────────────────────────────────────────────────────────────────────

export interface GoalLadderExportState {
  planName: string
  versionLabel: string
  entries: LadderEntry[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function esc(s: string | undefined | null): string {
  if (s == null) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Soft-wrap text at word boundaries close to maxChars. Keynote-safe. */
function softWrap(text: string, maxChars: number): string[] {
  const lines: string[] = []
  const words = text.split(/\s+/).filter(Boolean)
  let current = ''
  for (const w of words) {
    if (!current) {
      current = w
    } else if (current.length + 1 + w.length <= maxChars) {
      current += ' ' + w
    } else {
      lines.push(current)
      current = w
    }
  }
  if (current) lines.push(current)
  return lines.length > 0 ? lines : [text]
}

/** Map a LadderRung colour family to bgcolor + fg hex pair (DD-017 white-bg safe). */
function rungColours(colour: string): { bg: string; fg: string; label: string } {
  switch (colour) {
    case 'amber':
      return { bg: '#fef3c7', fg: '#78350f', label: 'Tolerable >>' }
    case 'emerald':
      return { bg: '#d1fae5', fg: '#065f46', label: 'Goal >' }
    case 'violet':
      return { bg: '#ede9fe', fg: '#5b21b6', label: 'Wish >?' }
    default:
      return { bg: '#f1f5f9', fg: '#334155', label: 'Rung' }
  }
}

// ── Section: header ─────────────────────────────────────────────────────────

function renderHeader(state: GoalLadderExportState, exportedDate: string): string {
  const titleLines = softWrap(
    `Goal Ladder · ${state.planName}${state.versionLabel ? ' ' + state.versionLabel : ''}`,
    42,
  )
  const headerRows = titleLines
    .map(
      (line) =>
        `<tr><td bgcolor="#b45309" style="background:#b45309;color:#ffffff;padding:6px 22px 4px 22px;font:700 18px/1.4 'Helvetica Neue',Arial,sans-serif;">${esc(line)}</td></tr>`,
    )
    .join('')
  return `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px 0;border-collapse:collapse;">
  ${headerRows}
  <tr><td bgcolor="#d97706" style="background:#d97706;color:#fef3c7;padding:4px 22px 12px 22px;font:600 11px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">Value commitment ladders · Tolerable &gt;&gt; · Goal &gt; · Wish &gt;?</td></tr>
  <tr><td bgcolor="#78350f" style="background:#78350f;color:#fde68a;padding:6px 22px;font:500 10px/1.4 'Helvetica Neue',Arial,sans-serif;">Exported: ${esc(exportedDate)}</td></tr>
</table>`
}

// ── Section: summary card ────────────────────────────────────────────────────

function renderSummary(state: GoalLadderExportState): string {
  const valueCount = state.entries.length
  const populated = state.entries.filter((e) => e.rungs.length > 0).length
  const empty = valueCount - populated
  const rungTotal = state.entries.reduce((sum, e) => sum + e.rungs.length, 0)
  return `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px 0;border-collapse:collapse;border:2px solid #fbbf24;">
  <tr>
    <td bgcolor="#fffbeb" style="background:#fffbeb;color:#78350f;padding:10px 18px 4px 18px;font:700 11px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.16em;text-transform:uppercase;">🪜 Ladder Summary</td>
  </tr>
  <tr>
    <td bgcolor="#ffffff" style="background:#ffffff;padding:10px 18px;font:400 12px/1.6 'Helvetica Neue',Arial,sans-serif;color:#1f2937;">
      <span style="display:inline-block;background:#b45309;color:#ffffff;font:800 22px/1 'Helvetica Neue',Arial,sans-serif;padding:8px 14px;border-radius:8px;">${valueCount}</span>
      <span style="display:inline-block;margin-left:10px;font:600 12px/1.5 'Helvetica Neue',Arial,sans-serif;color:#78350f;">
        Value ${valueCount === 1 ? 'entry' : 'entries'} · <strong>${populated}</strong> with rungs · <strong>${empty}</strong> empty · <strong>${rungTotal}</strong> total rungs
      </span>
    </td>
  </tr>
  <tr>
    <td bgcolor="#ffffff" style="background:#ffffff;padding:4px 18px 12px 18px;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;color:#475569;">
      Each rung is the parsed numeric Value at that commitment level. Empty entries surface a Sharpening opportunity — every Value should carry at minimum Tolerable + Goal under explicit Qualifiers.
    </td>
  </tr>
</table>`
}

// ── Section: per-Value ladder card ──────────────────────────────────────────

function renderEntryCard(entry: LadderEntry): string {
  const idLines = softWrap(entry.id, 56)
  const idRows = idLines
    .map(
      (line, i) =>
        `<tr><td bgcolor="#b45309" style="background:#b45309;color:#ffffff;padding:${i === 0 ? '6' : '1'}px 18px;font:${i === 0 ? '800' : '600'} 12px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.04em;">${esc(line)}</td></tr>`,
    )
    .join('')

  if (entry.rungs.length === 0) {
    return `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 8px 0;border-collapse:collapse;border:1px solid #fcd34d;">
  ${idRows}
  <tr><td bgcolor="#fef3c7" style="background:#fef3c7;color:#78350f;padding:6px 18px;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;font-style:italic;">No rungs specified yet — no Tolerable, Goal, or Wish on this Value. Sharpening target.</td></tr>
</table>`
  }

  // Render each rung as its own row (one <td> only — never nested <table>)
  const rungRows = entry.rungs
    .map((r) => {
      const c = rungColours(r.colour)
      const valLines = softWrap(r.value || '—', 64)
      const valHtml = valLines
        .map(
          (line) =>
            `<div style="font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;color:${c.fg};">${esc(line)}</div>`,
        )
        .join('')
      return `
  <tr><td bgcolor="${c.bg}" style="background:${c.bg};color:${c.fg};padding:5px 18px;font:700 10px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.08em;text-transform:uppercase;">${c.label}</td></tr>
  <tr><td bgcolor="#ffffff" style="background:#ffffff;padding:3px 18px 6px 18px;">${valHtml}<div style="font:400 10px/1.4 'Helvetica Neue',Arial,sans-serif;color:#94a3b8;margin-top:2px;">parsed: ${r.numericValue}</div></td></tr>`
    })
    .join('')

  const statusRow = entry.statusValue
    ? `<tr><td bgcolor="#f8fafc" style="background:#f8fafc;color:#475569;padding:4px 18px;font:400 10px/1.4 'Helvetica Neue',Arial,sans-serif;font-style:italic;">Status: ${esc(entry.statusValue)}</td></tr>`
    : ''

  return `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 8px 0;border-collapse:collapse;border:1px solid #fcd34d;">
  ${idRows}
  ${rungRows}
  ${statusRow}
</table>`
}

function renderEntriesSection(state: GoalLadderExportState): string {
  if (state.entries.length === 0) {
    return `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px 0;border-collapse:collapse;"><tr><td bgcolor="#b45309" style="background:#b45309;color:#ffffff;padding:10px 18px;font:700 11px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">Goal Ladder</td></tr><tr><td bgcolor="#fffbeb" style="background:#fffbeb;padding:10px 18px;font:400 12px/1.5 'Helvetica Neue',Arial,sans-serif;color:#475569;">No Value entries in this spec yet — add Value (V.) entries with Tolerable / Goal / Wish to populate the ladder.</td></tr></table>`
  }
  const header = `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 8px 0;border-collapse:collapse;">
  <tr><td bgcolor="#78350f" style="background:#78350f;color:#ffffff;padding:10px 18px;font:700 11px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">Value Commitment Ladders · ${state.entries.length} ${state.entries.length === 1 ? 'Value' : 'Values'}</td></tr>
</table>`
  return header + state.entries.map(renderEntryCard).join('')
}

// ── Section: Glossary footnote ──────────────────────────────────────────────

function renderGlossaryFootnote(): string {
  return `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:14px 0 0 0;border-collapse:collapse;border:1px solid #cbd5e1;">
  <tr><td bgcolor="#475569" style="background:#475569;color:#ffffff;padding:8px 18px;font:700 10px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">Planguage Glossary · canonical definitions</td></tr>
  <tr><td bgcolor="#fef3c7" style="background:#fef3c7;color:#78350f;padding:6px 18px;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;"><b>Tolerable &gt;&gt;</b> (*539) — Project-viability threshold. Minimum non-failure level. Below it the WHOLE project fails. Tolerable is a Scalar <b>Constraint</b>. You MEET a Constraint by staying on the acceptable side.</td></tr>
  <tr><td bgcolor="#d1fae5" style="background:#d1fae5;color:#065f46;padding:6px 18px;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;"><b>Goal &gt;</b> (*109) — Committed promise. The level the project commits to deliver, negotiated against competing stakeholders and resources. A Goal is a <b>Target</b>. You MEET a Target by reaching the level.</td></tr>
  <tr><td bgcolor="#ede9fe" style="background:#ede9fe;color:#5b21b6;padding:6px 18px;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;"><b>Wish &gt;?</b> (*244) — Stakeholder dream, uncommitted. Complete satisfaction level. Independent of cost and physics. Wish is a <b>Target</b> (uncommitted).</td></tr>
</table>`
}

// ── Section: Velocity-of-Learning footer ────────────────────────────────────

function renderVelocityFooter(): string {
  return `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:10px 0 0 0;border-collapse:collapse;border:1px solid #c4b5fd;">
  <tr><td bgcolor="#4c1d95" style="background:#4c1d95;color:#ffffff;padding:8px 18px;font:700 10px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">Why the Goal Ladder · Velocity of Learning</td></tr>
  <tr><td bgcolor="#f5f3ff" style="background:#f5f3ff;color:#1e1b4b;padding:8px 18px;font:400 11px/1.6 'Helvetica Neue',Arial,sans-serif;">Stages are cyclic — Export is an entry, not an end. The purpose is not to achieve the initial Value requirements, but to <i>learn quickly and often</i> (Musk's Velocity of Learning) so the specifications are the best current set of ideas for the realities we encounter. We seek a current <b>reasonable balance</b>, maintained for the lifetime of the System of Concern.</td></tr>
  <tr><td bgcolor="#ede9fe" style="background:#ede9fe;color:#5b21b6;padding:6px 18px;font:400 10px/1.4 'Helvetica Neue',Arial,sans-serif;font-style:italic;">— Tom Gilb, 2026-06-21</td></tr>
</table>`
}

// ── Main render functions ───────────────────────────────────────────────────

export function renderGoalLadderHtml(state: GoalLadderExportState): string {
  const now = new Date()
  const datePart = now.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const timePart = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
  const exportedDate = `${datePart}  ${timePart}`

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" /><title>Goal Ladder — ${esc(state.planName)}</title></head>
<body style="margin:0;padding:18px;background:#f9fafb;font-family:'Helvetica Neue',Arial,sans-serif;">
${renderHeader(state, exportedDate)}
${renderSummary(state)}
${renderEntriesSection(state)}
${renderGlossaryFootnote()}
${renderVelocityFooter()}
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:14px 0 0 0;border-collapse:collapse;">
  <tr><td bgcolor="#78350f" style="background:#78350f;color:#fde68a;padding:6px 18px;font:500 9px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.08em;">SEM App · Goal Ladder export · Feature #104 (Value commitment-ladder visualiser)</td></tr>
</table>
</body></html>`
}

export function renderGoalLadderPlain(state: GoalLadderExportState): string {
  const HR = '═'.repeat(56)
  const SR = '─'.repeat(56)
  const lines: string[] = []
  const valueCount = state.entries.length
  const populated = state.entries.filter((e) => e.rungs.length > 0).length
  const empty = valueCount - populated
  const rungTotal = state.entries.reduce((sum, e) => sum + e.rungs.length, 0)

  lines.push(HR)
  lines.push(
    `Goal Ladder · ${state.planName}${state.versionLabel ? ' ' + state.versionLabel : ''}`,
  )
  lines.push(
    `${valueCount} Value ${valueCount === 1 ? 'entry' : 'entries'} · ${populated} with rungs · ${empty} empty · ${rungTotal} total rungs`,
  )
  lines.push(HR)
  lines.push('')

  if (state.entries.length === 0) {
    lines.push('No Value entries in this spec yet — add Value (V.) entries with Tolerable / Goal / Wish to populate the ladder.')
    lines.push('')
  } else {
    lines.push('VALUE COMMITMENT LADDERS')
    lines.push(SR)
    for (const e of state.entries) {
      lines.push(`${e.id}`)
      if (e.rungs.length === 0) {
        lines.push(`  (no rungs specified yet — Sharpening target)`)
      } else {
        for (const r of e.rungs) {
          const label =
            r.colour === 'amber'
              ? 'Tolerable >>'
              : r.colour === 'emerald'
                ? 'Goal >'
                : r.colour === 'violet'
                  ? 'Wish >?'
                  : 'Rung'
          lines.push(`  ${label}: ${r.value || '—'}   (parsed: ${r.numericValue})`)
        }
      }
      if (e.statusValue) lines.push(`  Status: ${e.statusValue}`)
      lines.push('')
    }
  }

  lines.push(SR)
  lines.push('Glossary — canonical Planguage definitions')
  lines.push(SR)
  lines.push(
    'Tolerable >> (*539) — project-viability threshold. Below it the WHOLE project fails.',
  )
  lines.push(
    'Goal > (*109) — committed promise; level negotiated against competing stakeholders.',
  )
  lines.push(
    'Wish >? (*244) — stakeholder dream, uncommitted. Independent of cost and physics.',
  )
  lines.push('')
  lines.push(SR)
  lines.push('Why the Goal Ladder · Velocity of Learning')
  lines.push(SR)
  lines.push(
    'Stages are cyclic — Export is an entry, not an end. The purpose is not to achieve the initial',
  )
  lines.push(
    "Value requirements, but to learn quickly and often (Musk's Velocity of Learning) so the",
  )
  lines.push(
    'specifications are the best current set of ideas for the realities we encounter. We seek a',
  )
  lines.push(
    'current reasonable balance, maintained for the lifetime of the System of Concern.',
  )
  lines.push('— Tom Gilb, 2026-06-21')
  lines.push('')

  return lines.join('\n')
}
