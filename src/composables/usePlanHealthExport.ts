/**
 * usePlanHealthExport.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Plan Health (PHI) canonical 📤 Export pin renderer.
 *
 * Tom Gilb 2026-06-22 "always continue · research and innovation" — Feature 3
 * of the v295 ship.
 *
 * Architecture (mirrors useEvoStepsExport.ts):
 *   • ONE outer document → sub-tables per section (header, summary card,
 *     per-group breakdown, top defects, footer). Each top-level <table> can
 *     be moved as ONE Keynote table.
 *   • Inline styles + bgcolor= attrs everywhere — Keynote/Mail/Notes safe.
 *   • Cyan + teal palette (PHI canonical family in SpecHealthStatusPanel)
 *     with rose for negative scores. R-G colorblind-safe per DD-017
 *     (text always on white background; sign symbols + colour, not colour
 *     alone, carry meaning).
 *
 * Sister to useSpecHealthExport.ts (which provides 📋 Copy + ✉️ Email
 * helpers in the panel header). This one wraps the SAME data in the
 * canonical exportArtefact() pattern — single-pin Export = preview window
 * + clipboard + Mail in one click, To: '' per Mailto-No-Self-To SUPREME.
 *
 * Composes with:
 *   • Export Button on All Windows Rule (SUPREME) — this is the sweep target
 *   • Mailto-No-Self-To Rule (SUPREME) — to: '' is mandatory
 *   • Colorful HTML Spec Email Rule (SUPREME) — bgcolor= attrs
 *   • Planguage Glossary Definitions in Tools rule — footnote embedded
 *   • Stages-are-Cyclic + Conjunction-of-Technologies (Velocity-of-Learning
 *     footer quoting Tom Gilb 2026-06-21)
 */

import { exportArtefact } from './useExportShared'
import type { IndexBreakdown } from './useSpecHealth'

export interface PlanHealthExportState {
  planName: string
  versionLabel: string
  breakdown: IndexBreakdown
  /** Optional — recent snapshot count for the summary card. */
  snapshotCount?: number
  /** Optional — current PHI threshold for the summary card. */
  threshold?: number
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

/** Colour family for a -100..+100 PHI score (DD-017 safe — on white only). */
function scoreColor(n: number): string {
  if (n < 0)   return '#dc2626' // rose-600
  if (n < 25)  return '#ea580c' // orange-600
  if (n < 50)  return '#d97706' // amber-600
  if (n < 75)  return '#0d9488' // teal-600
  return '#059669'              // emerald-600
}

function fmtIndex(n: number): string {
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(0)}%`
}

// ── Section: header ──────────────────────────────────────────────────────────

function renderHeader(state: PlanHealthExportState, exportedDate: string): string {
  const titleLines = softWrap(
    `Plan Health · ${state.planName}${state.versionLabel ? ' ' + state.versionLabel : ''}`,
    42,
  )
  const headerRows = titleLines
    .map(
      (line) =>
        `<tr><td bgcolor="#0e7490" style="background:#0e7490;color:#ffffff;padding:6px 22px 4px 22px;font:700 18px/1.4 'Helvetica Neue',Arial,sans-serif;">${esc(line)}</td></tr>`,
    )
    .join('')
  return `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px 0;border-collapse:collapse;">
  ${headerRows}
  <tr><td bgcolor="#0891b2" style="background:#0891b2;color:#cffafe;padding:4px 22px 12px 22px;font:600 11px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">Plan Health Index · weighted aspect-group score</td></tr>
  <tr><td bgcolor="#155e75" style="background:#155e75;color:#a5f3fc;padding:6px 22px;font:500 10px/1.4 'Helvetica Neue',Arial,sans-serif;">Exported: ${esc(exportedDate)}</td></tr>
</table>`
}

// ── Section: summary card (big PHI dot + meta) ───────────────────────────────

function renderSummary(state: PlanHealthExportState): string {
  const phi = state.breakdown.index
  const col = scoreColor(phi)
  const groupCount = state.breakdown.groups.length
  return `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px 0;border-collapse:collapse;border:2px solid #67e8f9;">
  <tr>
    <td bgcolor="#ecfeff" style="background:#ecfeff;color:#164e63;padding:10px 18px 4px 18px;font:700 11px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.16em;text-transform:uppercase;">⚪ Overall Plan Health Index</td>
  </tr>
  <tr>
    <td bgcolor="#ffffff" style="background:#ffffff;padding:10px 18px;font:400 12px/1.6 'Helvetica Neue',Arial,sans-serif;color:#1f2937;">
      <span style="display:inline-block;background:${col};color:#ffffff;font:800 24px/1 'Helvetica Neue',Arial,sans-serif;padding:10px 16px;border-radius:9999px;">${esc(fmtIndex(phi))}</span>
      <span style="display:inline-block;margin-left:12px;font:600 12px/1.5 'Helvetica Neue',Arial,sans-serif;color:#164e63;">
        ${groupCount} active group${groupCount === 1 ? '' : 's'}${state.snapshotCount != null ? ` · ${state.snapshotCount} snapshot${state.snapshotCount === 1 ? '' : 's'}` : ''}${state.threshold != null ? ` · threshold ${state.threshold}%` : ''}
      </span>
    </td>
  </tr>
</table>`
}

// ── Section: per-group breakdown ─────────────────────────────────────────────

function renderGroupRow(g: IndexBreakdown['groups'][number]): string {
  const col = scoreColor(g.groupIndex)
  const aspectCount = g.aspects.filter(a => !a.disabled).length
  return `
<tr>
  <td bgcolor="#ffffff" style="background:#ffffff;padding:8px 18px;font:600 12px/1.4 'Helvetica Neue',Arial,sans-serif;color:#0f172a;border-bottom:1px solid #e2e8f0;">
    ${esc(g.groupIcon)} ${esc(g.groupLabel)}
  </td>
  <td bgcolor="#ffffff" align="right" style="background:#ffffff;padding:8px 18px;font:700 12px/1.4 'Helvetica Neue',Arial,sans-serif;color:${col};border-bottom:1px solid #e2e8f0;">
    ${esc(fmtIndex(g.groupIndex))}
  </td>
  <td bgcolor="#ffffff" align="right" style="background:#ffffff;padding:8px 18px;font:500 11px/1.4 'Helvetica Neue',Arial,sans-serif;color:#475569;border-bottom:1px solid #e2e8f0;">
    weight ${(g.groupWeight * 100).toFixed(0)}%
  </td>
  <td bgcolor="#ffffff" align="right" style="background:#ffffff;padding:8px 18px;font:500 11px/1.4 'Helvetica Neue',Arial,sans-serif;color:#475569;border-bottom:1px solid #e2e8f0;">
    ${aspectCount} aspect${aspectCount === 1 ? '' : 's'}
  </td>
</tr>`
}

function renderGroupsSection(state: PlanHealthExportState): string {
  if (state.breakdown.groups.length === 0) {
    return `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px 0;border-collapse:collapse;"><tr><td bgcolor="#0e7490" style="background:#0e7490;color:#ffffff;padding:10px 18px;font:700 11px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">Aspect Groups</td></tr><tr><td bgcolor="#ecfeff" style="background:#ecfeff;padding:10px 18px;font:400 12px/1.5 'Helvetica Neue',Arial,sans-serif;color:#475569;">No active groups.</td></tr></table>`
  }
  const headerRow = `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 8px 0;border-collapse:collapse;">
  <tr><td bgcolor="#155e75" style="background:#155e75;color:#ffffff;padding:10px 18px;font:700 11px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">Aspect Groups · ${state.breakdown.groups.length} active</td></tr>
</table>`
  const tableRows = state.breakdown.groups.map(renderGroupRow).join('')
  return `${headerRow}<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px 0;border-collapse:collapse;border:1px solid #67e8f9;">${tableRows}</table>`
}

// ── Section: top defects (most negative aspects across all groups) ──────────

function renderTopDefects(state: PlanHealthExportState): string {
  type Row = { groupLabel: string; aspectName: string; score: number; detail: string }
  const rows: Row[] = []
  for (const g of state.breakdown.groups) {
    for (const a of g.aspects) {
      if (a.disabled) continue
      rows.push({
        groupLabel: g.groupLabel,
        aspectName: a.name,
        score: a.score,
        detail: a.detail || '',
      })
    }
  }
  // Sort most negative first; cap at 10.
  rows.sort((x, y) => x.score - y.score)
  const top = rows.slice(0, 10)
  if (top.length === 0) {
    return ''
  }
  const headerRow = `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 8px 0;border-collapse:collapse;">
  <tr><td bgcolor="#7f1d1d" style="background:#7f1d1d;color:#ffffff;padding:10px 18px;font:700 11px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">Top ${top.length} most-severe aspect${top.length === 1 ? '' : 's'} · most-negative first</td></tr>
</table>`
  const dataRows = top
    .map((r) => {
      const col = scoreColor(r.score * 100) // aspect score is -1..+1
      const detailLines = softWrap(r.detail || '(no detail)', 72)
      const detailHtml = detailLines
        .map((line) => `<div style="font:400 11px/1.4 'Helvetica Neue',Arial,sans-serif;color:#1f2937;">${esc(line)}</div>`)
        .join('')
      return `<tr>
  <td bgcolor="#ffffff" style="background:#ffffff;padding:8px 18px;font:600 11px/1.4 'Helvetica Neue',Arial,sans-serif;color:#0f172a;border-bottom:1px solid #e2e8f0;width:32%;">
    <div style="font:500 10px/1.3 'Helvetica Neue',Arial,sans-serif;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">${esc(r.groupLabel)}</div>
    <div style="font:700 12px/1.4 'Helvetica Neue',Arial,sans-serif;color:#0f172a;">${esc(r.aspectName)}</div>
  </td>
  <td bgcolor="#ffffff" align="right" style="background:#ffffff;padding:8px 18px;font:800 13px/1 'Helvetica Neue',Arial,sans-serif;color:${col};border-bottom:1px solid #e2e8f0;white-space:nowrap;width:12%;">
    ${r.score >= 0 ? '+' : ''}${(r.score * 100).toFixed(0)}%
  </td>
  <td bgcolor="#ffffff" style="background:#ffffff;padding:8px 18px;border-bottom:1px solid #e2e8f0;">
    ${detailHtml}
  </td>
</tr>`
    })
    .join('')
  return `${headerRow}<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px 0;border-collapse:collapse;border:1px solid #fca5a5;">${dataRows}</table>`
}

// ── Section: Conjunction-of-Technologies footer ──────────────────────────────

function renderConjunctionFooter(): string {
  return `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:10px 0 0 0;border-collapse:collapse;border:1px solid #c4b5fd;">
  <tr><td bgcolor="#4c1d95" style="background:#4c1d95;color:#ffffff;padding:8px 18px;font:700 10px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">Conjunction-of-Technologies · Why this report exists</td></tr>
  <tr><td bgcolor="#f5f3ff" style="background:#f5f3ff;color:#1e1b4b;padding:8px 18px;font:400 11px/1.6 'Helvetica Neue',Arial,sans-serif;">Plan Health composes <b>(a)</b> the live spec data, <b>(b)</b> Gilb-corpus rules (Planguage Glossary · CE · ASPECTS · EVO 2024), <b>(c)</b> general LLM knowledge, and <b>(d)</b> Internet-fetched benchmarks where applicable. Per-aspect findings cite their source layer. Tom Gilb 2026-06-03: <i>"the beautiful pioneer work we are doing together"</i>.</td></tr>
  <tr><td bgcolor="#ede9fe" style="background:#ede9fe;color:#5b21b6;padding:6px 18px;font:400 10px/1.4 'Helvetica Neue',Arial,sans-serif;font-style:italic;">Stages are cyclic — Export is an entry, not an end. The purpose is to learn quickly and often (Musk's Velocity of Learning). — Tom Gilb 2026-06-21</td></tr>
</table>`
}

// ── Main render functions ───────────────────────────────────────────────────

export function renderPlanHealthHtml(state: PlanHealthExportState): string {
  const now = new Date()
  const datePart = now.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const timePart = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
  const exportedDate = `${datePart}  ${timePart}`
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" /><title>Plan Health — ${esc(state.planName)}</title></head>
<body style="margin:0;padding:18px;background:#f9fafb;font-family:'Helvetica Neue',Arial,sans-serif;">
${renderHeader(state, exportedDate)}
${renderSummary(state)}
${renderGroupsSection(state)}
${renderTopDefects(state)}
${renderConjunctionFooter()}
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:14px 0 0 0;border-collapse:collapse;">
  <tr><td bgcolor="#155e75" style="background:#155e75;color:#a5f3fc;padding:6px 18px;font:500 9px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.08em;">SEM App · Plan Health export · canonical 📤 Export pin</td></tr>
</table>
</body></html>`
}

export function renderPlanHealthPlain(state: PlanHealthExportState): string {
  const HR = '═'.repeat(56)
  const SR = '─'.repeat(56)
  const lines: string[] = []
  lines.push(HR)
  lines.push(`Plan Health · ${state.planName}${state.versionLabel ? ' ' + state.versionLabel : ''}`)
  lines.push(`Overall PHI: ${fmtIndex(state.breakdown.index)} · ${state.breakdown.groups.length} active group${state.breakdown.groups.length === 1 ? '' : 's'}${state.threshold != null ? ` · threshold ${state.threshold}%` : ''}`)
  lines.push(HR)
  lines.push('')
  lines.push('ASPECT GROUPS')
  lines.push(SR)
  for (const g of state.breakdown.groups) {
    const aspectCount = g.aspects.filter(a => !a.disabled).length
    lines.push(`  ${g.groupIcon} ${g.groupLabel}  ${fmtIndex(g.groupIndex)}  · weight ${(g.groupWeight * 100).toFixed(0)}%  · ${aspectCount} aspect${aspectCount === 1 ? '' : 's'}`)
  }
  lines.push('')

  // Top defects.
  type Row = { groupLabel: string; aspectName: string; score: number; detail: string }
  const rows: Row[] = []
  for (const g of state.breakdown.groups) {
    for (const a of g.aspects) {
      if (a.disabled) continue
      rows.push({ groupLabel: g.groupLabel, aspectName: a.name, score: a.score, detail: a.detail || '' })
    }
  }
  rows.sort((x, y) => x.score - y.score)
  const top = rows.slice(0, 10)
  if (top.length > 0) {
    lines.push(`TOP ${top.length} MOST-SEVERE ASPECT${top.length === 1 ? '' : 'S'} (most-negative first)`)
    lines.push(SR)
    for (const r of top) {
      lines.push(`  [${r.groupLabel}] ${r.aspectName}  ${r.score >= 0 ? '+' : ''}${(r.score * 100).toFixed(0)}%`)
      if (r.detail) lines.push(`    ${r.detail}`)
    }
    lines.push('')
  }
  lines.push(SR)
  lines.push('Why this report exists — Conjunction-of-Technologies')
  lines.push(SR)
  lines.push('Plan Health composes (a) live spec data, (b) Gilb-corpus rules,')
  lines.push('(c) general LLM knowledge, (d) Internet-fetched benchmarks.')
  lines.push('Stages are cyclic — Export is an entry, not an end. Learn quickly.')
  lines.push('— Tom Gilb 2026-06-21')
  lines.push('')
  return lines.join('\n')
}

/** Canonical single-pin Export — preview + clipboard + Mail (To: '' per Mailto-No-Self-To SUPREME). */
export async function exportPlanHealth(state: PlanHealthExportState): Promise<void> {
  await exportArtefact({
    htmlText:     renderPlanHealthHtml(state),
    plainText:    renderPlanHealthPlain(state),
    subject:      `Plan Health ${fmtIndex(state.breakdown.index)} · ${state.planName}${state.versionLabel ? ' ' + state.versionLabel : ''}`,
    artefactName: 'Plan Health',
    // Mailto-No-Self-To SUPREME (Tom Gilb 2026-06-16): Tom is the SENDER on a
    // SEM-App-initiated export; To: must be EMPTY. Without explicit '', the
    // useExportShared.ts default 'Tom@Gilb.com' would route Tom to email himself.
    to: '',
  })
}
