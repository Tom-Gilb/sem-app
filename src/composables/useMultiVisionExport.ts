/**
 * useMultiVisionExport.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * MultiVision colourful HTML export — FLAT TABLE STRUCTURE (Keynote-paste compatible).
 *
 * Tom Gilb 2026-06-06: "we cannot see more than 27% o the model in this window
 * at on time" — the MultiVision panel scrolls, but on a single screen the user
 * can only see a small fraction of the Values + Resources + Funded Solutions +
 * Insights at once.  An Export button produces ONE static HTML document with
 * the full model — viewable in Safari / Mail / Keynote / Notes in its entirety.
 *
 * Composes with:
 *   • Colorful HTML Spec Email Rule (SUPREME, CLAUDE.md) — every export is a
 *     colour-coded HTML table with inline styles + bgcolor= attrs.
 *   • Gilb HTML Table Standard — flat single-table structure, no nested
 *     <table> inside <td> (Keynote splits nested tables).
 *   • SEM Email Body Standard — caller wires mailto: with LOUD ⌘V cue + plain
 *     fallback.
 *   • Planguage Glossary Definitions in Tools rule — the exported HTML
 *     includes the canonical definitions in a footer card so the document is
 *     self-describing (no hover available in static HTML).
 *
 * Architecture:
 *   • A single outer <table> with sub-tables-per-section (header, balance,
 *     values, resources, funded, insights, definitions, footer).  Each
 *     top-level <table> can be moved as ONE Keynote table.
 *   • All colours are inline + bgcolor= so the document survives the email +
 *     Keynote paste round-trip.
 *   • Soft-wraps long strings every ~70 chars onto separate <tr> rows so
 *     Keynote does not clip descenders (the recurring r43 lesson).
 */

import type { VEntry, REntry, SEntry } from '../types/spec'
import type { ImpactMatrix, VCRatio } from '../types/impact'

// ── Types ────────────────────────────────────────────────────────────────────

/** Reflects the runtime state of MultiVision at export time. */
export interface MultiVisionExportState {
  planName: string
  versionLabel: string
  values:     VEntry[]
  resources:  REntry[]
  solutions:  SEntry[]
  vSliders:   Record<string, number>
  rSliders:   Record<string, number>
  aggregateBudget: number
  vDelivery:        Record<string, number>
  vFeasibility:     Record<string, 'green' | 'amber' | 'red'>
  fundedSolutions:  SEntry[]
  balanceScore:     number
  balanceBreakdown: { green: number; amber: number; red: number; total: number }
  totalCapitalCost: number
  availableCapital: number
  insights:         Array<{ id: string; icon: string; message: string; severity: 'opportunity' | 'info' | 'warning' }>
  vcRatios:      Record<string, number>
  capitalCosts:  Record<string, number>
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

function commitmentLevelName(pos: number): { name: string; classOfTerm: string; color: string; bg: string } {
  if (pos < 33) return { name: 'Tolerable >>', classOfTerm: 'Constraint',  color: '#92400e', bg: '#fef3c7' }
  if (pos < 67) return { name: 'Goal >',       classOfTerm: 'Target',      color: '#065f46', bg: '#d1fae5' }
  return            { name: 'Wish >?',         classOfTerm: 'Target',      color: '#5b21b6', bg: '#ede9fe' }
}

function feasibilityChip(f: 'green' | 'amber' | 'red'): { label: string; bg: string; fg: string } {
  if (f === 'green') return { label: 'at commitment',    bg: '#10b981', fg: '#ffffff' }
  if (f === 'amber') return { label: 'close',            bg: '#f59e0b', fg: '#ffffff' }
  return                   { label: 'below commitment',  bg: '#ef4444', fg: '#ffffff' }
}

function balanceColor(score: number): string {
  if (score >= 70) return '#10b981'
  if (score >= 40) return '#f59e0b'
  return '#ef4444'
}

// ── Section: header ─────────────────────────────────────────────────────────

function renderHeader(state: MultiVisionExportState, exportedDate: string): string {
  const titleLines = softWrap(`MultiVision · ${state.planName}${state.versionLabel ? ' ' + state.versionLabel : ''}`, 42)
  const headerRows = titleLines.map((line) =>
    `<tr><td bgcolor="#4f46e5" style="background:#4f46e5;color:#ffffff;padding:6px 22px 4px 22px;font:700 18px/1.4 'Helvetica Neue',Arial,sans-serif;">${esc(line)}</td></tr>`
  ).join('')
  return `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px 0;border-collapse:collapse;">
  ${headerRows}
  <tr><td bgcolor="#7c3aed" style="background:#7c3aed;color:#ede9fe;padding:4px 22px 12px 22px;font:600 11px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">Balance Values &amp; Resources · see consequences</td></tr>
  <tr><td bgcolor="#1e1b4b" style="background:#1e1b4b;color:#a5b4fc;padding:6px 22px;font:500 10px/1.4 'Helvetica Neue',Arial,sans-serif;">Exported: ${esc(exportedDate)}</td></tr>
</table>`
}

// ── Section: Vision Balance ─────────────────────────────────────────────────

function renderVisionBalance(state: MultiVisionExportState): string {
  const score = state.balanceScore
  const bg = balanceColor(score)
  return `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px 0;border-collapse:collapse;border:2px solid #c7d2fe;">
  <tr>
    <td bgcolor="#eef2ff" style="background:#eef2ff;color:#312e81;padding:10px 18px 4px 18px;font:700 11px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.16em;text-transform:uppercase;">⚡ Vision Balance</td>
  </tr>
  <tr>
    <td bgcolor="#ffffff" style="background:#ffffff;padding:10px 18px;font:400 12px/1.5 'Helvetica Neue',Arial,sans-serif;color:#1f2937;">
      <span style="display:inline-block;background:${bg};color:#ffffff;font:800 22px/1 'Helvetica Neue',Arial,sans-serif;padding:8px 14px;border-radius:8px;">${score}%</span>
      <span style="display:inline-block;margin-left:10px;font:600 12px/1.5 'Helvetica Neue',Arial,sans-serif;color:#1f2937;">
        ${state.balanceBreakdown.green} of ${state.balanceBreakdown.total} Value entries MEET the Constraint or Target you committed to
      </span>
    </td>
  </tr>
  <tr>
    <td bgcolor="#ffffff" style="background:#ffffff;padding:6px 18px 12px 18px;font:400 11px/1.4 'Helvetica Neue',Arial,sans-serif;">
      <span style="display:inline-block;background:#10b981;color:#ffffff;padding:3px 8px;border-radius:9999px;margin-right:6px;font:700 10px/1 'Helvetica Neue',Arial,sans-serif;">${state.balanceBreakdown.green} at commitment</span>
      <span style="display:inline-block;background:#f59e0b;color:#ffffff;padding:3px 8px;border-radius:9999px;margin-right:6px;font:700 10px/1 'Helvetica Neue',Arial,sans-serif;">${state.balanceBreakdown.amber} close</span>
      <span style="display:inline-block;background:#ef4444;color:#ffffff;padding:3px 8px;border-radius:9999px;font:700 10px/1 'Helvetica Neue',Arial,sans-serif;">${state.balanceBreakdown.red} below commitment</span>
    </td>
  </tr>
</table>`
}

// ── Section: Values ─────────────────────────────────────────────────────────

function renderValuesSection(state: MultiVisionExportState): string {
  if (state.values.length === 0) {
    return `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px 0;border-collapse:collapse;"><tr><td bgcolor="#7c3aed" style="background:#7c3aed;color:#ffffff;padding:10px 18px;font:700 11px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">Values · Commitment Levels</td></tr><tr><td bgcolor="#faf5ff" style="background:#faf5ff;padding:10px 18px;font:400 12px/1.5 'Helvetica Neue',Arial,sans-serif;color:#6b7280;">No Value entries in the current spec.</td></tr></table>`
  }
  const rowsHtml = state.values.map((v) => {
    const sliderPos = state.vSliders[v.id] ?? 50
    const delivery = state.vDelivery[v.id] ?? 0
    const feasibility = state.vFeasibility[v.id] ?? 'red'
    const commitment = commitmentLevelName(sliderPos)
    const chip = feasibilityChip(feasibility)
    const descLines = softWrap(v.description || '(no description)', 64)
    const scaleLines = softWrap(v.scale || '(no Scale recorded)', 64)
    const descRows = descLines.map((line) =>
      `<tr><td bgcolor="#faf5ff" style="background:#faf5ff;padding:1px 18px;font:400 12px/1.5 'Helvetica Neue',Arial,sans-serif;color:#1f2937;">${esc(line)}</td></tr>`
    ).join('')
    const scaleRows = scaleLines.map((line) =>
      `<tr><td bgcolor="#faf5ff" style="background:#faf5ff;padding:0px 18px;font:400 10px/1.4 'Helvetica Neue',Arial,sans-serif;color:#6b7280;"><b>Scale:</b> ${esc(line)}</td></tr>`
    ).join('')
    return `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 8px 0;border-collapse:collapse;border:1px solid #c4b5fd;">
  <tr>
    <td bgcolor="#7c3aed" style="background:#7c3aed;color:#ffffff;padding:4px 18px;font:800 11px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.08em;text-transform:uppercase;">
      ${esc(v.id)}
      <span style="float:right;background:${chip.bg};color:${chip.fg};padding:2px 8px;border-radius:9999px;font:700 11px/1 'Helvetica Neue',Arial,sans-serif;">
        ${delivery.toFixed(0)}% IET · ${chip.label}
      </span>
    </td>
  </tr>
  ${descRows}
  ${scaleRows}
  <tr>
    <td bgcolor="#f5f3ff" style="background:#f5f3ff;padding:4px 18px;font:600 10px/1.4 'Helvetica Neue',Arial,sans-serif;color:#312e81;">SPEC TARGETS · native Scale unit (not IET)</td>
  </tr>
  <tr>
    <td bgcolor="#ffffff" style="background:#ffffff;padding:4px 18px 8px 18px;font:400 11px/1.4 'Helvetica Neue',Arial,sans-serif;color:#1f2937;">
      <span style="display:inline-block;color:#b45309;font-weight:700;">Tolerable &gt;&gt;:</span> ${esc(v.tolerable || '—')}
      &nbsp;·&nbsp;
      <span style="display:inline-block;color:#065f46;font-weight:700;">Goal &gt;:</span> ${esc(v.goal || '—')}
      &nbsp;·&nbsp;
      <span style="display:inline-block;color:#5b21b6;font-weight:700;">Wish &gt;?:</span> ${esc(v.wish || '—')}
    </td>
  </tr>
  <tr>
    <td bgcolor="${commitment.bg}" style="background:${commitment.bg};color:${commitment.color};padding:6px 18px;font:700 11px/1.4 'Helvetica Neue',Arial,sans-serif;">
      Committing to MEET the <u>${commitment.name}</u> ${commitment.classOfTerm} · slider ${sliderPos}/100
    </td>
  </tr>
</table>`
  }).join('')
  return `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px 0;border-collapse:collapse;">
  <tr><td bgcolor="#5b21b6" style="background:#5b21b6;color:#ffffff;padding:10px 18px;font:700 11px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">Values · Commitment Levels · ${state.values.length} entries</td></tr>
</table>
${rowsHtml}`
}

// ── Section: Resources ──────────────────────────────────────────────────────

function renderResourcesSection(state: MultiVisionExportState): string {
  const header = `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 8px 0;border-collapse:collapse;">
  <tr><td bgcolor="#c2410c" style="background:#c2410c;color:#ffffff;padding:10px 18px;font:700 11px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">Resources · Budget</td></tr>
</table>`

  const intro = `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 8px 0;border-collapse:collapse;border:1px solid #fdba74;">
  <tr><td bgcolor="#fff7ed" style="background:#fff7ed;padding:8px 18px;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;color:#7c2d12;">
    Available capital: <b>$${state.availableCapital.toFixed(0)}k</b> of $${state.totalCapitalCost.toFixed(0)}k total · ${state.resources.length > 0 ? state.resources.length + ' Resource entries' : 'aggregate budget'}
  </td></tr>
</table>`

  let rows = ''
  if (state.resources.length > 0) {
    rows = state.resources.map((r) => {
      const pos = state.rSliders[r.id] ?? 100
      const descLines = softWrap(r.description || '(no description)', 64)
      const descRows = descLines.map((line) =>
        `<tr><td bgcolor="#fff7ed" style="background:#fff7ed;padding:1px 18px;font:400 12px/1.5 'Helvetica Neue',Arial,sans-serif;color:#1f2937;">${esc(line)}</td></tr>`
      ).join('')
      return `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 6px 0;border-collapse:collapse;border:1px solid #fdba74;">
  <tr><td bgcolor="#c2410c" style="background:#c2410c;color:#ffffff;padding:4px 18px;font:800 11px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.08em;text-transform:uppercase;">${esc(r.id)} <span style="float:right;background:#ffffff;color:#c2410c;padding:2px 8px;border-radius:9999px;font:700 11px/1 'Helvetica Neue',Arial,sans-serif;">${pos}% budget</span></td></tr>
  ${descRows}
  <tr><td bgcolor="#ffffff" style="background:#ffffff;padding:4px 18px 6px 18px;font:400 11px/1.4 'Helvetica Neue',Arial,sans-serif;color:#1f2937;"><b>Scale:</b> ${esc(r.scale || '—')} · <b>Goal:</b> ${esc(r.goal || '—')}</td></tr>
</table>`
    }).join('')
  } else {
    rows = `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 6px 0;border-collapse:collapse;border:1px solid #fdba74;">
  <tr><td bgcolor="#c2410c" style="background:#c2410c;color:#ffffff;padding:4px 18px;font:700 11px/1.4 'Helvetica Neue',Arial,sans-serif;">AGGREGATE BUDGET <span style="float:right;background:#ffffff;color:#c2410c;padding:2px 8px;border-radius:9999px;">${state.aggregateBudget}%</span></td></tr>
  <tr><td bgcolor="#ffffff" style="background:#ffffff;padding:6px 18px;font:400 11px/1.4 'Helvetica Neue',Arial,sans-serif;color:#6b7280;">No Resource entries in the spec — add R. entries for unit-aware sliders.</td></tr>
</table>`
  }
  return header + intro + rows
}

// ── Section: Funded Solutions ───────────────────────────────────────────────

function renderFundedSection(state: MultiVisionExportState): string {
  if (state.solutions.length === 0) {
    return ''
  }
  const fundedIds = new Set(state.fundedSolutions.map((s) => s.id))
  const unfunded = state.solutions.filter((s) => !fundedIds.has(s.id))
  const header = `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 8px 0;border-collapse:collapse;">
  <tr><td bgcolor="#065f46" style="background:#065f46;color:#ffffff;padding:10px 18px;font:700 11px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">⚡ Funded Solutions · ${state.fundedSolutions.length} funded · ${unfunded.length} unfunded</td></tr>
</table>`

  const renderSolRow = (sol: SEntry, funded: boolean): string => {
    const vc = state.vcRatios[sol.id]
    const lines = softWrap(sol.description || '(no description)', 60)
    const rowsHtml = lines.map((line, i) =>
      `<tr><td bgcolor="${funded ? '#d1fae5' : '#f3f4f6'}" style="background:${funded ? '#d1fae5' : '#f3f4f6'};color:${funded ? '#065f46' : '#6b7280'};padding:${i === 0 ? '4' : '1'}px 18px;font:400 12px/1.4 'Helvetica Neue',Arial,sans-serif;">${i === 0 ? `<b>${esc(sol.id)}</b> · ` : ''}${esc(line)}</td></tr>`
    ).join('')
    const vcChip = vc !== undefined
      ? `<tr><td bgcolor="${funded ? '#d1fae5' : '#f3f4f6'}" style="background:${funded ? '#d1fae5' : '#f3f4f6'};padding:0 18px 4px 18px;font:600 10px/1.4 'Helvetica Neue',Arial,sans-serif;color:${funded ? '#065f46' : '#6b7280'};">Value-per-Cost: ${vc.toFixed(1)}</td></tr>`
      : ''
    return `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 4px 0;border-collapse:collapse;border:1px solid ${funded ? '#10b981' : '#d1d5db'};">${rowsHtml}${vcChip}</table>`
  }

  const fundedRows = state.fundedSolutions.map((s) => renderSolRow(s, true)).join('')
  const unfundedRows = unfunded.length > 0
    ? `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:6px 0 4px 0;border-collapse:collapse;"><tr><td bgcolor="#9ca3af" style="background:#9ca3af;color:#ffffff;padding:4px 18px;font:600 10px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.1em;text-transform:uppercase;">Unfunded at current budget</td></tr></table>` + unfunded.map((s) => renderSolRow(s, false)).join('')
    : ''
  return header + fundedRows + unfundedRows
}

// ── Section: Tradeoff Insights ──────────────────────────────────────────────

function renderInsightsSection(state: MultiVisionExportState): string {
  if (state.insights.length === 0) {
    return ''
  }
  const header = `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 8px 0;border-collapse:collapse;">
  <tr><td bgcolor="#4338ca" style="background:#4338ca;color:#ffffff;padding:10px 18px;font:700 11px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">💡 Tradeoff Insights · ${state.insights.length}</td></tr>
</table>`
  const rows = state.insights.map((ins) => {
    const bg = ins.severity === 'opportunity' ? '#eef2ff' : ins.severity === 'warning' ? '#fef3c7' : '#f1f5f9'
    const fg = ins.severity === 'opportunity' ? '#312e81' : ins.severity === 'warning' ? '#78350f' : '#334155'
    const lines = softWrap(ins.message, 72)
    return `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 4px 0;border-collapse:collapse;border:1px solid ${ins.severity === 'opportunity' ? '#c7d2fe' : ins.severity === 'warning' ? '#fcd34d' : '#cbd5e1'};">
${lines.map((line, i) => `<tr><td bgcolor="${bg}" style="background:${bg};color:${fg};padding:${i === 0 ? '6' : '1'}px 18px;font:400 12px/1.5 'Helvetica Neue',Arial,sans-serif;">${i === 0 ? esc(ins.icon) + ' · ' : ''}${esc(line)}</td></tr>`).join('')}
</table>`
  }).join('')
  return header + rows
}

// ── Section: Glossary footnote ──────────────────────────────────────────────

function renderGlossaryFootnote(): string {
  return `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:14px 0 0 0;border-collapse:collapse;border:1px solid #cbd5e1;">
  <tr><td bgcolor="#475569" style="background:#475569;color:#ffffff;padding:8px 18px;font:700 10px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">Planguage Glossary · canonical definitions</td></tr>
  <tr><td bgcolor="#fef3c7" style="background:#fef3c7;color:#78350f;padding:6px 18px;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;"><b>Tolerable &gt;&gt;</b> (*539) — Project-viability threshold. Minimum non-failure level. Below it the WHOLE project fails. Tolerable is a Scalar <b>Constraint</b>. You MEET a Constraint by staying on the acceptable side.</td></tr>
  <tr><td bgcolor="#d1fae5" style="background:#d1fae5;color:#065f46;padding:6px 18px;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;"><b>Goal &gt;</b> (*109) — Committed promise. The level the project commits to deliver, negotiated against competing stakeholders and resources. A Goal is a <b>Target</b>. You MEET a Target by reaching the level.</td></tr>
  <tr><td bgcolor="#ede9fe" style="background:#ede9fe;color:#5b21b6;padding:6px 18px;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;"><b>Wish &gt;?</b> (*244) — Stakeholder dream, uncommitted. Complete satisfaction level. Independent of cost and physics. Wish is a <b>Target</b> (uncommitted).</td></tr>
  <tr><td bgcolor="#e0e7ff" style="background:#e0e7ff;color:#312e81;padding:6px 18px;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;"><b>Percentage Impact %.→</b> (*306) — IET relative scale: 0% = at Past/benchmark, 100% = target reached. Convertible to native units like Celsius/Fahrenheit. See the IET chapter in Tom Gilb's <i>Competitive Engineering</i> book.</td></tr>
  <tr><td bgcolor="#f1f5f9" style="background:#f1f5f9;color:#334155;padding:6px 18px;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;"><b>Ambition @.∑</b> (*423) — Informal one-sentence summary ("much better security"). VAGUE — cannot be MET. The management-BS pattern Planguage exists to escape by quantifying Constraints and Targets.</td></tr>
</table>`
}

// ── Main render function ────────────────────────────────────────────────────

export function renderMultiVisionHtml(state: MultiVisionExportState): string {
  const now = new Date()
  const datePart = now.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
  const timePart = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
  const exportedDate = `${datePart}  ${timePart}`

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" /><title>MultiVision — ${esc(state.planName)}</title></head>
<body style="margin:0;padding:18px;background:#f9fafb;font-family:'Helvetica Neue',Arial,sans-serif;">
${renderHeader(state, exportedDate)}
${renderVisionBalance(state)}
${renderValuesSection(state)}
${renderResourcesSection(state)}
${renderFundedSection(state)}
${renderInsightsSection(state)}
${renderGlossaryFootnote()}
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:14px 0 0 0;border-collapse:collapse;">
  <tr><td bgcolor="#1e1b4b" style="background:#1e1b4b;color:#a5b4fc;padding:6px 18px;font:500 9px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.08em;">SEM App · MultiVision export · F.MultiVision (#MV1)</td></tr>
</table>
</body></html>`
}

// ── Plain-text fallback ──────────────────────────────────────────────────────

export function renderMultiVisionPlainText(state: MultiVisionExportState): string {
  const HR = '═'.repeat(56)
  const SR = '─'.repeat(56)
  const lines: string[] = []
  lines.push(HR)
  lines.push(`MultiVision · ${state.planName}${state.versionLabel ? ' ' + state.versionLabel : ''}`)
  lines.push(`Vision Balance: ${state.balanceScore}%  (${state.balanceBreakdown.green} at commitment · ${state.balanceBreakdown.amber} close · ${state.balanceBreakdown.red} below · of ${state.balanceBreakdown.total} Values)`)
  lines.push(HR)
  lines.push('')

  lines.push('VALUES · COMMITMENT LEVELS')
  lines.push(SR)
  for (const v of state.values) {
    const pos = state.vSliders[v.id] ?? 50
    const cm = commitmentLevelName(pos)
    const delivery = state.vDelivery[v.id] ?? 0
    const feasibility = state.vFeasibility[v.id] ?? 'red'
    lines.push(`${v.id}: ${v.description}`)
    lines.push(`  Scale:     ${v.scale || '—'}`)
    lines.push(`  Tolerable >>:  ${v.tolerable || '—'}`)
    lines.push(`  Goal >:        ${v.goal || '—'}`)
    lines.push(`  Wish >?:       ${v.wish || '—'}`)
    lines.push(`  Committing to MEET the ${cm.name} ${cm.classOfTerm} (slider ${pos}/100)`)
    lines.push(`  Achievement:   ${delivery.toFixed(0)}% IET · ${feasibility === 'green' ? 'at commitment' : feasibility === 'amber' ? 'close' : 'below commitment'}`)
    lines.push('')
  }

  lines.push('RESOURCES · BUDGET')
  lines.push(SR)
  lines.push(`Available capital: $${state.availableCapital.toFixed(0)}k of $${state.totalCapitalCost.toFixed(0)}k total`)
  if (state.resources.length === 0) {
    lines.push(`Aggregate budget: ${state.aggregateBudget}%  (no R. entries in spec)`)
  } else {
    for (const r of state.resources) {
      const pos = state.rSliders[r.id] ?? 100
      lines.push(`${r.id} (${pos}% budget): ${r.description}`)
      lines.push(`  Scale: ${r.scale || '—'}   Goal: ${r.goal || '—'}`)
    }
  }
  lines.push('')

  if (state.solutions.length > 0) {
    lines.push(`FUNDED SOLUTIONS · ${state.fundedSolutions.length} funded · ${state.solutions.length - state.fundedSolutions.length} unfunded`)
    lines.push(SR)
    for (const s of state.fundedSolutions) {
      const vc = state.vcRatios[s.id]
      lines.push(`✓ ${s.id} (V/C ${vc?.toFixed(1) ?? '—'}): ${s.description}`)
    }
    const unfunded = state.solutions.filter((s) => !state.fundedSolutions.some((f) => f.id === s.id))
    for (const s of unfunded) {
      const vc = state.vcRatios[s.id]
      lines.push(`  ${s.id} (V/C ${vc?.toFixed(1) ?? '—'}): ${s.description}  [unfunded]`)
    }
    lines.push('')
  }

  if (state.insights.length > 0) {
    lines.push('TRADEOFF INSIGHTS')
    lines.push(SR)
    for (const ins of state.insights) {
      lines.push(`${ins.icon}  ${ins.message}`)
      lines.push('')
    }
  }

  lines.push(SR)
  lines.push('Glossary — canonical Planguage definitions')
  lines.push(SR)
  lines.push('Tolerable >> (*539) — Project-viability threshold. Below it the WHOLE project fails. Scalar Constraint.')
  lines.push('Goal > (*109) — Committed promise. The level the project will deliver, negotiated against competing stakeholders.')
  lines.push('Wish >? (*244) — Stakeholder dream, uncommitted. Independent of cost and physics.')
  lines.push('Percentage Impact %.→ (*306) — IET relative scale: 0% = at Past/benchmark, 100% = target reached.')
  lines.push('Ambition @.∑ (*423) — VAGUE summary. Cannot be MET. The management-BS pattern Planguage exists to escape.')
  lines.push('')

  return lines.join('\n')
}
