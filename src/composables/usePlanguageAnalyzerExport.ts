/**
 * usePlanguageAnalyzerExport.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Planguage Analyzer (Unified — Conjunction-of-Technologies Exploit #5)
 * colourful HTML + plain-text export.  Tom Gilb 2026-06-23 — autonomous backlog
 * batch — sweep target for the Export-Button-on-All-Windows SUPREME rule
 * (memory: rule_export_button_on_all_windows.md).
 *
 * Architecture (mirrors useDecisionMapperExport / useStandardsAuditorExport):
 *   • ONE outer wrapper → sub-tables per section (header, summary card,
 *     per-source-layer counts strip, per-finding cards grouped by origin tool,
 *     Conjunction footer, Glossary footnote, Velocity-of-Learning footer).
 *   • Inline styles + bgcolor= attrs everywhere — Keynote / Mail / Notes safe.
 *   • Soft-wrap long strings every ~64 chars onto separate <tr> rows so
 *     Keynote does not clip descenders (r43 lesson).
 *   • Fuchsia + violet + indigo palette (the canonical Planguage-Analyzer
 *     identity — header gradient matches the in-app surface).  R-G colourblind-
 *     safe per DD-017 (severity chips always on WHITE; never red text on dark).
 *
 * Composes with:
 *   • Export Button on All Windows Rule (SUPREME)
 *   • Colorful HTML Spec Email Rule (SUPREME)
 *   • Planguage Glossary Definitions in Tools rule (footer)
 *   • Stages-are-Cyclic + Stage-Has-a-Purpose (Velocity-of-Learning quote)
 *   • Mailto-No-Self-To SUPREME (caller passes to:'')
 */

import type { AISource, SourceProvenance } from '../data/aiSource'

// ── Types ────────────────────────────────────────────────────────────────────

export type AnalyzerSeverity = 'red' | 'orange' | 'green' | 'info'

export interface AnalyzerFinding {
  id: string
  /** Originating tool key. */
  origin: 'standards' | 'improvement' | 'feedMe'
  /** Originating tool display label e.g. "Standards Auditor". */
  originLabel: string
  severity: AnalyzerSeverity
  /** Target ref (spec entry id, step name, etc.). */
  targetRef: string
  title: string
  description: string
  provenance: SourceProvenance
}

export interface PlanguageAnalyzerExportState {
  planName: string
  versionLabel: string
  findings: AnalyzerFinding[]
  /** Counts per source layer for the summary strip. */
  countsBySource: Partial<Record<AISource | 'all', number>>
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

function severityMeta(sev: AnalyzerSeverity): { label: string; bg: string; border: string; text: string } {
  switch (sev) {
    case 'red':    return { label: 'RED',    bg: '#fee2e2', border: '#fca5a5', text: '#b91c1c' }
    case 'orange': return { label: 'AMBER',  bg: '#fef3c7', border: '#fcd34d', text: '#92400e' }
    case 'green':  return { label: 'GREEN',  bg: '#d1fae5', border: '#86efac', text: '#047857' }
    case 'info':   return { label: 'INFO',   bg: '#f1f5f9', border: '#cbd5e1', text: '#475569' }
  }
}

function severityOrder(sev: AnalyzerSeverity): number {
  if (sev === 'red')    return 0
  if (sev === 'orange') return 1
  if (sev === 'green')  return 2
  return 3
}

function sourceMeta(s: AISource): { label: string; bg: string; text: string } {
  switch (s) {
    case 'plan':      return { label: 'Plan',      bg: '#d1fae5', text: '#065f46' }
    case 'gilb':      return { label: 'Gilb',      bg: '#fef3c7', text: '#78350f' }
    case 'standards': return { label: 'Standards', bg: '#e0e7ff', text: '#3730a3' }
    case 'internet':  return { label: 'Internet',  bg: '#dbeafe', text: '#1e40af' }
    case 'llm':       return { label: 'LLM',       bg: '#fce7f3', text: '#9d174d' }
    case 'template':  return { label: 'Template',  bg: '#f1f5f9', text: '#475569' }
  }
}

// ── Section: header ─────────────────────────────────────────────────────────

function renderHeader(state: PlanguageAnalyzerExportState, exportedDate: string): string {
  const titleLines = softWrap(
    `Planguage Analyzer · ${state.planName}${state.versionLabel ? ' ' + state.versionLabel : ''}`,
    42,
  )
  const headerRows = titleLines
    .map(
      (line) =>
        `<tr><td bgcolor="#a21caf" style="background:#a21caf;color:#ffffff;padding:6px 22px 4px 22px;font:700 18px/1.4 'Helvetica Neue',Arial,sans-serif;">${esc(line)}</td></tr>`,
    )
    .join('')
  return `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px 0;border-collapse:collapse;">
  ${headerRows}
  <tr><td bgcolor="#7e22ce" style="background:#7e22ce;color:#f5d0fe;padding:4px 22px 12px 22px;font:600 11px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">Conjunction-of-Technologies Exploit #5 · all knowledge layers in ONE view</td></tr>
  <tr><td bgcolor="#4c1d95" style="background:#4c1d95;color:#ddd6fe;padding:6px 22px;font:500 10px/1.4 'Helvetica Neue',Arial,sans-serif;">Exported: ${esc(exportedDate)}</td></tr>
</table>`
}

// ── Section: summary card ────────────────────────────────────────────────────

function renderSummary(state: PlanguageAnalyzerExportState): string {
  const findings = state.findings
  const red = findings.filter((f) => f.severity === 'red').length
  const orange = findings.filter((f) => f.severity === 'orange').length
  const green = findings.filter((f) => f.severity === 'green').length
  const info = findings.filter((f) => f.severity === 'info').length
  const total = findings.length
  return `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px 0;border-collapse:collapse;border:2px solid #d8b4fe;">
  <tr>
    <td bgcolor="#faf5ff" style="background:#faf5ff;color:#6b21a8;padding:10px 18px 4px 18px;font:700 11px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.16em;text-transform:uppercase;">🔬 Analysis Summary</td>
  </tr>
  <tr>
    <td bgcolor="#ffffff" style="background:#ffffff;padding:10px 18px;font:400 12px/1.6 'Helvetica Neue',Arial,sans-serif;color:#1f2937;">
      <span style="display:inline-block;background:#a21caf;color:#ffffff;font:800 22px/1 'Helvetica Neue',Arial,sans-serif;padding:8px 14px;border-radius:8px;">${total}</span>
      <span style="display:inline-block;margin-left:10px;font:600 12px/1.5 'Helvetica Neue',Arial,sans-serif;color:#6b21a8;">
        ${total === 1 ? 'finding' : 'findings'} aggregated across all knowledge layers ·
        <span style="background:#fee2e2;color:#b91c1c;padding:2px 8px;border-radius:9999px;font:700 11px/1;">${red} red</span>
        <span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:9999px;font:700 11px/1;margin-left:4px;">${orange} amber</span>
        <span style="background:#d1fae5;color:#047857;padding:2px 8px;border-radius:9999px;font:700 11px/1;margin-left:4px;">${green} green</span>
        <span style="background:#f1f5f9;color:#475569;padding:2px 8px;border-radius:9999px;font:700 11px/1;margin-left:4px;">${info} info</span>
      </span>
    </td>
  </tr>
</table>`
}

// ── Section: per-source-layer counts strip ──────────────────────────────────

function renderSourceCounts(state: PlanguageAnalyzerExportState): string {
  const sources: AISource[] = ['plan', 'gilb', 'standards', 'internet', 'llm', 'template']
  const cells = sources
    .map((s) => {
      const meta = sourceMeta(s)
      const count = state.countsBySource[s] ?? 0
      return `<td bgcolor="${meta.bg}" style="background:${meta.bg};color:${meta.text};padding:6px 10px;font:700 11px/1.4 'Helvetica Neue',Arial,sans-serif;text-align:center;border:1px solid #ffffff;">${esc(meta.label)} <span style="background:#ffffff;color:${meta.text};padding:1px 6px;border-radius:9999px;margin-left:4px;">${count}</span></td>`
    })
    .join('')
  return `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px 0;border-collapse:collapse;border:1px solid #d8b4fe;">
  <tr><td bgcolor="#7e22ce" style="background:#7e22ce;color:#ffffff;padding:8px 18px;font:700 10px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">Findings by knowledge layer (Conjunction-of-Technologies)</td></tr>
  <tr>${cells}</tr>
</table>`
}

// ── Section: per-finding card ────────────────────────────────────────────────

function renderFindingCard(f: AnalyzerFinding): string {
  const sev = severityMeta(f.severity)
  const src = sourceMeta(f.provenance.source)
  const titleLines = softWrap(f.title, 60)
  const titleRows = titleLines
    .map(
      (line) =>
        `<tr><td bgcolor="${sev.bg}" style="background:${sev.bg};color:${sev.text};padding:6px 18px;font:800 13px/1.4 'Helvetica Neue',Arial,sans-serif;">${esc(line)}</td></tr>`,
    )
    .join('')
  const descLines = softWrap(f.description, 64)
  const descRows = descLines
    .map(
      (line) =>
        `<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:1px 18px;font:400 12px/1.5 'Helvetica Neue',Arial,sans-serif;color:#1f2937;">${esc(line)}</td></tr>`,
    )
    .join('')

  // Provenance footer line (note / citation file if present)
  let provenanceDetail = ''
  if (f.provenance.note) {
    provenanceDetail = `<tr><td bgcolor="#f8fafc" style="background:#f8fafc;color:#475569;padding:4px 18px;font:400 10px/1.4 'Helvetica Neue',Arial,sans-serif;font-style:italic;">${esc(f.provenance.note)}</td></tr>`
  } else if (f.provenance.standardsCitation?.file) {
    const sc = f.provenance.standardsCitation
    const section = sc.section ? ` · §${esc(sc.section)}` : ''
    provenanceDetail = `<tr><td bgcolor="#eef2ff" style="background:#eef2ff;color:#312e81;padding:4px 18px;font:600 10px/1.4 'Helvetica Neue',Arial,sans-serif;font-family:monospace;">${esc(sc.file)}${section}</td></tr>`
  } else if (f.provenance.gilbCitation) {
    const gc = f.provenance.gilbCitation as { book?: string; chapter?: string; page?: string }
    const parts = [gc.book, gc.chapter, gc.page].filter(Boolean).join(' · ')
    if (parts) {
      provenanceDetail = `<tr><td bgcolor="#fef3c7" style="background:#fef3c7;color:#78350f;padding:4px 18px;font:600 10px/1.4 'Helvetica Neue',Arial,sans-serif;">📖 ${esc(parts)}</td></tr>`
    }
  } else if (f.provenance.internetCitation) {
    const ic = f.provenance.internetCitation as { url?: string; title?: string }
    const label = ic.title || ic.url || ''
    if (label) {
      provenanceDetail = `<tr><td bgcolor="#dbeafe" style="background:#dbeafe;color:#1e40af;padding:4px 18px;font:600 10px/1.4 'Helvetica Neue',Arial,sans-serif;">🌐 ${esc(label)}</td></tr>`
    }
  }

  return `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 10px 0;border-collapse:collapse;border:2px solid ${sev.border};">
  <tr>
    <td bgcolor="${sev.bg}" style="background:${sev.bg};color:${sev.text};padding:4px 18px;font:700 10px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">
      ${esc(sev.label)} ·
      <span style="background:#ffffff;color:${sev.text};padding:1px 6px;border-radius:4px;font-weight:700;">${esc(f.originLabel)}</span>
      <span style="background:${src.bg};color:${src.text};padding:1px 6px;border-radius:4px;font-weight:700;margin-left:4px;">${esc(src.label)} source</span>
      <span style="background:#ffffff;color:#475569;padding:1px 6px;border-radius:4px;font-family:monospace;font-weight:600;margin-left:4px;">${esc(f.targetRef)}</span>
    </td>
  </tr>
  ${titleRows}
  ${descRows}
  ${provenanceDetail}
</table>`
}

function renderFindingsSection(state: PlanguageAnalyzerExportState): string {
  if (state.findings.length === 0) {
    return `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px 0;border-collapse:collapse;"><tr><td bgcolor="#a21caf" style="background:#a21caf;color:#ffffff;padding:10px 18px;font:700 11px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">Findings</td></tr><tr><td bgcolor="#faf5ff" style="background:#faf5ff;padding:10px 18px;font:400 12px/1.5 'Helvetica Neue',Arial,sans-serif;color:#475569;">No findings yet from any tool. Run the Standards Auditor, generate Evo Step Improvements, or load a FEED ME! set first — the analyzer aggregates their output into one filterable view.</td></tr></table>`
  }
  // Group by origin tool — Standards Auditor first, then Improvement, then FEED ME!
  const order: AnalyzerFinding['origin'][] = ['standards', 'improvement', 'feedMe']
  const groupLabels: Record<AnalyzerFinding['origin'], string> = {
    standards:   'Standards Auditor',
    improvement: 'Evo Step Improvement',
    feedMe:      'FEED ME!',
  }
  const groups = new Map<AnalyzerFinding['origin'], AnalyzerFinding[]>()
  for (const f of state.findings) {
    if (!groups.has(f.origin)) groups.set(f.origin, [])
    groups.get(f.origin)!.push(f)
  }
  let out = ''
  for (const origin of order) {
    const g = groups.get(origin)
    if (!g || g.length === 0) continue
    const sorted = g.slice().sort((a, b) => severityOrder(a.severity) - severityOrder(b.severity))
    out += `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:14px 0 6px 0;border-collapse:collapse;"><tr><td bgcolor="#6b21a8" style="background:#6b21a8;color:#ffffff;padding:8px 18px;font:700 11px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">${esc(groupLabels[origin])} · ${g.length} finding${g.length === 1 ? '' : 's'}</td></tr></table>`
    out += sorted.map(renderFindingCard).join('')
  }
  return out
}

// ── Section: Conjunction footer ─────────────────────────────────────────────

function renderConjunctionFooter(): string {
  return `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:14px 0 0 0;border-collapse:collapse;border:1px solid #d8b4fe;">
  <tr><td bgcolor="#6b21a8" style="background:#6b21a8;color:#ffffff;padding:8px 18px;font:700 10px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">Conjunction-of-Technologies · the SEM App advantage</td></tr>
  <tr><td bgcolor="#faf5ff" style="background:#faf5ff;color:#581c87;padding:8px 18px;font:400 11px/1.6 'Helvetica Neue',Arial,sans-serif;">The SEM App's pioneer advantage: AI applied to <b>structured Planguage</b> + Tom Gilb's authored corpus + LLM training + Internet — all four knowledge layers reasoning over the same quantified Plan. Every finding above carries a source-layer badge so you see at a glance which layer asserted it.</td></tr>
  <tr><td bgcolor="#ede9fe" style="background:#ede9fe;color:#5b21b6;padding:6px 18px;font:400 10px/1.4 'Helvetica Neue',Arial,sans-serif;font-style:italic;">— Tom Gilb, 2026-06-03</td></tr>
</table>`
}

// ── Section: Velocity-of-Learning footer ────────────────────────────────────

function renderVelocityFooter(): string {
  return `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:10px 0 0 0;border-collapse:collapse;border:1px solid #c4b5fd;">
  <tr><td bgcolor="#4c1d95" style="background:#4c1d95;color:#ffffff;padding:8px 18px;font:700 10px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">Why Planguage Analyzer · Velocity of Learning</td></tr>
  <tr><td bgcolor="#f5f3ff" style="background:#f5f3ff;color:#1e1b4b;padding:8px 18px;font:400 11px/1.6 'Helvetica Neue',Arial,sans-serif;">Stages are cyclic — Export is an entry, not an end. The purpose is not to achieve the initial Value requirements, but to <i>learn quickly and often</i> (Musk's Velocity of Learning) so the specifications are the best current set of ideas for the realities we encounter. We seek a current <b>reasonable balance</b>, maintained for the lifetime of the System of Concern.</td></tr>
  <tr><td bgcolor="#ede9fe" style="background:#ede9fe;color:#5b21b6;padding:6px 18px;font:400 10px/1.4 'Helvetica Neue',Arial,sans-serif;font-style:italic;">— Tom Gilb, 2026-06-21</td></tr>
</table>`
}

// ── Section: Planguage Glossary footnote ────────────────────────────────────

function renderGlossaryFootnote(): string {
  return `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:14px 0 0 0;border-collapse:collapse;border:1px solid #cbd5e1;">
  <tr><td bgcolor="#475569" style="background:#475569;color:#ffffff;padding:8px 18px;font:700 10px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">Planguage Glossary · canonical definitions</td></tr>
  <tr><td bgcolor="#fef3c7" style="background:#fef3c7;color:#78350f;padding:6px 18px;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;"><b>Tolerable &gt;&gt;</b> (*539) — Project-viability threshold. Minimum non-failure level. Below it the WHOLE project fails.</td></tr>
  <tr><td bgcolor="#d1fae5" style="background:#d1fae5;color:#065f46;padding:6px 18px;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;"><b>Goal &gt;</b> (*109) — Committed promise. The level the project commits to deliver, negotiated against competing stakeholders and resources.</td></tr>
  <tr><td bgcolor="#ede9fe" style="background:#ede9fe;color:#5b21b6;padding:6px 18px;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;"><b>Wish &gt;?</b> (*244) — Stakeholder dream, uncommitted. Independent of cost and physics.</td></tr>
  <tr><td bgcolor="#e0e7ff" style="background:#e0e7ff;color:#312e81;padding:6px 18px;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;"><b>Scale</b> (*450) — The unit of measure for a Value. Every Value must have a Scale before it can be quantified.</td></tr>
</table>`
}

// ── Main render function ────────────────────────────────────────────────────

export function renderPlanguageAnalyzerHtml(state: PlanguageAnalyzerExportState): string {
  const now = new Date()
  const datePart = now.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const timePart = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
  const exportedDate = `${datePart}  ${timePart}`

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" /><title>Planguage Analyzer — ${esc(state.planName)}</title></head>
<body style="margin:0;padding:18px;background:#f9fafb;font-family:'Helvetica Neue',Arial,sans-serif;">
${renderHeader(state, exportedDate)}
${renderSummary(state)}
${renderSourceCounts(state)}
${renderFindingsSection(state)}
${renderConjunctionFooter()}
${renderGlossaryFootnote()}
${renderVelocityFooter()}
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:14px 0 0 0;border-collapse:collapse;">
  <tr><td bgcolor="#4c1d95" style="background:#4c1d95;color:#ddd6fe;padding:6px 18px;font:500 9px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.08em;">SEM App · Planguage Analyzer export · Conjunction-of-Technologies Exploit #5</td></tr>
</table>
</body></html>`
}

// ── Plain-text fallback ──────────────────────────────────────────────────────

export function renderPlanguageAnalyzerPlain(state: PlanguageAnalyzerExportState): string {
  const HR = '═'.repeat(56)
  const SR = '─'.repeat(56)
  const lines: string[] = []
  const red = state.findings.filter((f) => f.severity === 'red').length
  const orange = state.findings.filter((f) => f.severity === 'orange').length
  const green = state.findings.filter((f) => f.severity === 'green').length
  const info = state.findings.filter((f) => f.severity === 'info').length

  lines.push(HR)
  lines.push(
    `Planguage Analyzer · ${state.planName}${state.versionLabel ? ' ' + state.versionLabel : ''}`,
  )
  lines.push(
    `${state.findings.length} ${state.findings.length === 1 ? 'finding' : 'findings'} · ${red} red · ${orange} amber · ${green} green · ${info} info`,
  )
  lines.push(`Conjunction-of-Technologies Exploit #5 — all knowledge layers in ONE view`)
  lines.push(HR)
  lines.push('')

  // Source counts
  const sources: AISource[] = ['plan', 'gilb', 'standards', 'internet', 'llm', 'template']
  lines.push('FINDINGS BY KNOWLEDGE LAYER')
  lines.push(SR)
  for (const s of sources) {
    const count = state.countsBySource[s] ?? 0
    lines.push(`  · ${sourceMeta(s).label.padEnd(12)} ${count}`)
  }
  lines.push('')

  if (state.findings.length === 0) {
    lines.push(
      'No findings yet from any tool. Run the Standards Auditor, generate Evo Step',
    )
    lines.push(
      'Improvements, or load a FEED ME! set first.',
    )
    lines.push('')
  } else {
    const order: AnalyzerFinding['origin'][] = ['standards', 'improvement', 'feedMe']
    const groupLabels: Record<AnalyzerFinding['origin'], string> = {
      standards:   'STANDARDS AUDITOR',
      improvement: 'EVO STEP IMPROVEMENT',
      feedMe:      'FEED ME!',
    }
    const groups = new Map<AnalyzerFinding['origin'], AnalyzerFinding[]>()
    for (const f of state.findings) {
      if (!groups.has(f.origin)) groups.set(f.origin, [])
      groups.get(f.origin)!.push(f)
    }
    for (const origin of order) {
      const g = groups.get(origin)
      if (!g || g.length === 0) continue
      const sorted = g
        .slice()
        .sort((a, b) => severityOrder(a.severity) - severityOrder(b.severity))
      lines.push(`${groupLabels[origin]} — ${g.length} finding${g.length === 1 ? '' : 's'}`)
      lines.push(SR)
      for (const f of sorted) {
        lines.push(`[${severityMeta(f.severity).label}] [${sourceMeta(f.provenance.source).label}] ${f.originLabel} · ${f.targetRef}`)
        lines.push(`  ${f.title}`)
        lines.push(`  ${f.description}`)
        if (f.provenance.note) {
          lines.push(`  Note: ${f.provenance.note}`)
        } else if (f.provenance.standardsCitation?.file) {
          const sc = f.provenance.standardsCitation
          const section = sc.section ? ` · §${sc.section}` : ''
          lines.push(`  Standard: ${sc.file}${section}`)
        }
        lines.push('')
      }
    }
  }

  lines.push(SR)
  lines.push('Conjunction-of-Technologies — the SEM App advantage')
  lines.push(SR)
  lines.push(
    "The SEM App's pioneer advantage: AI applied to structured Planguage + Tom Gilb's",
  )
  lines.push(
    'authored corpus + LLM training + Internet — all four knowledge layers reasoning',
  )
  lines.push(
    'over the same quantified Plan. Every finding above carries a source-layer badge.',
  )
  lines.push('— Tom Gilb, 2026-06-03')
  lines.push('')

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
  lines.push(
    'Scale (*450) — the unit of measure for a Value.',
  )
  lines.push('')
  lines.push(SR)
  lines.push('Why Planguage Analyzer · Velocity of Learning')
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
