/**
 * useStandardsAuditorExport.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Standards Auditor (Planguage-vs-Standards) colourful HTML + plain-text
 * export.  Tom Gilb 2026-06-23 — autonomous backlog batch — sweep target for
 * the Export-Button-on-All-Windows SUPREME rule
 * (memory: rule_export_button_on_all_windows.md).
 *
 * Architecture (mirrors useEvoStepsExport / useDecisionMapperExport):
 *   • ONE outer wrapper → sub-tables per section (header, summary card,
 *     standards-consulted strip, per-severity finding cards, footer).
 *   • Inline styles + bgcolor= attrs everywhere — Keynote / Mail / Notes safe.
 *   • Soft-wrap long strings every ~64 chars onto separate <tr> rows so
 *     Keynote does not clip descenders (r43 lesson).
 *   • Indigo + violet palette (canonical Standards-Auditor family) — the
 *     header gradient matches the in-app surface.  R-G colourblind-safe per
 *     DD-017 (severity chips always on WHITE; never red text on dark).
 *
 * Composes with:
 *   • Export Button on All Windows Rule (SUPREME)
 *   • Colorful HTML Spec Email Rule (SUPREME)
 *   • Planguage Glossary Definitions in Tools rule (footer)
 *   • Stages-are-Cyclic + Stage-Has-a-Purpose (Velocity-of-Learning quote)
 *   • Mailto-No-Self-To SUPREME (caller passes to:'')
 */

import type { StandardsAuditSet, StandardsFinding, StandardsSeverity, StandardsTargetType } from '../data/standardsAudit'

// ── Types ────────────────────────────────────────────────────────────────────

export interface StandardsAuditorExportState {
  planName: string
  versionLabel: string
  /** Full audit set — may be null when no findings have been generated yet. */
  audit: StandardsAuditSet | null
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

/** Spell-out-Type-Names SUPREME — never F./V./S./C./R./Stakeholder shorthand. */
function targetTypeLabel(t: StandardsTargetType): string {
  switch (t) {
    case 'function':    return 'Function'
    case 'value':       return 'Value'
    case 'solution':    return 'Solution'
    case 'constraint':  return 'Constraint'
    case 'resource':    return 'Resource'
    case 'stakeholder': return 'Stakeholder'
    case 'plan-level':  return 'Plan-Level'
  }
}

function severityMeta(sev: StandardsSeverity): { label: string; bg: string; border: string; text: string } {
  switch (sev) {
    case 'red':    return { label: 'RED — MUST FIX',   bg: '#fee2e2', border: '#fca5a5', text: '#b91c1c' }
    case 'orange': return { label: 'ORANGE',           bg: '#fef3c7', border: '#fcd34d', text: '#92400e' }
    case 'green':  return { label: 'GREEN — NUDGE',    bg: '#d1fae5', border: '#86efac', text: '#047857' }
  }
}

function severityOrder(sev: StandardsSeverity): number {
  if (sev === 'red')    return 0
  if (sev === 'orange') return 1
  return 2
}

// ── Section: header ─────────────────────────────────────────────────────────

function renderHeader(state: StandardsAuditorExportState, exportedDate: string): string {
  const titleLines = softWrap(
    `Planguage Standards Auditor · ${state.planName}${state.versionLabel ? ' ' + state.versionLabel : ''}`,
    42,
  )
  const headerRows = titleLines
    .map(
      (line) =>
        `<tr><td bgcolor="#4f46e5" style="background:#4f46e5;color:#ffffff;padding:6px 22px 4px 22px;font:700 18px/1.4 'Helvetica Neue',Arial,sans-serif;">${esc(line)}</td></tr>`,
    )
    .join('')
  return `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px 0;border-collapse:collapse;">
  ${headerRows}
  <tr><td bgcolor="#6d28d9" style="background:#6d28d9;color:#ddd6fe;padding:4px 22px 12px 22px;font:600 11px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">Planguage-vs-Standards Audit · every finding cites a Kai-Zen Standard</td></tr>
  <tr><td bgcolor="#312e81" style="background:#312e81;color:#c7d2fe;padding:6px 22px;font:500 10px/1.4 'Helvetica Neue',Arial,sans-serif;">Exported: ${esc(exportedDate)}</td></tr>
</table>`
}

// ── Section: summary card ────────────────────────────────────────────────────

function renderSummary(state: StandardsAuditorExportState): string {
  const findings = state.audit?.findings ?? []
  const red = findings.filter((f) => f.severity === 'red').length
  const orange = findings.filter((f) => f.severity === 'orange').length
  const green = findings.filter((f) => f.severity === 'green').length
  const total = findings.length
  const generatedBy = state.audit?.generatedBy ?? '—'
  return `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px 0;border-collapse:collapse;border:2px solid #c4b5fd;">
  <tr>
    <td bgcolor="#f5f3ff" style="background:#f5f3ff;color:#3730a3;padding:10px 18px 4px 18px;font:700 11px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.16em;text-transform:uppercase;">📚 Audit Summary</td>
  </tr>
  <tr>
    <td bgcolor="#ffffff" style="background:#ffffff;padding:10px 18px;font:400 12px/1.6 'Helvetica Neue',Arial,sans-serif;color:#1f2937;">
      <span style="display:inline-block;background:#4f46e5;color:#ffffff;font:800 22px/1 'Helvetica Neue',Arial,sans-serif;padding:8px 14px;border-radius:8px;">${total}</span>
      <span style="display:inline-block;margin-left:10px;font:600 12px/1.5 'Helvetica Neue',Arial,sans-serif;color:#3730a3;">
        ${total === 1 ? 'finding' : 'findings'} ·
        <span style="background:#fee2e2;color:#b91c1c;padding:2px 8px;border-radius:9999px;font:700 11px/1;">${red} red</span>
        <span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:9999px;font:700 11px/1;margin-left:4px;">${orange} orange</span>
        <span style="background:#d1fae5;color:#047857;padding:2px 8px;border-radius:9999px;font:700 11px/1;margin-left:4px;">${green} green</span>
      </span>
    </td>
  </tr>
  <tr>
    <td bgcolor="#ffffff" style="background:#ffffff;padding:4px 18px 12px 18px;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;color:#475569;">
      Generated by: <strong>${esc(generatedBy)}</strong> · Standards consulted: <strong>${(state.audit?.standardsConsulted ?? []).length}</strong>
    </td>
  </tr>
</table>`
}

// ── Section: standards-consulted strip ──────────────────────────────────────

function renderStandardsConsulted(state: StandardsAuditorExportState): string {
  const consulted = state.audit?.standardsConsulted ?? []
  if (consulted.length === 0) return ''
  const rows = consulted
    .map(
      (s) =>
        `<tr><td bgcolor="#eef2ff" style="background:#eef2ff;color:#3730a3;padding:4px 18px;font:500 11px/1.5 'Helvetica Neue',Arial,sans-serif;font-family:monospace;">· ${esc(s)}</td></tr>`,
    )
    .join('')
  return `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px 0;border-collapse:collapse;border:1px solid #c7d2fe;">
  <tr><td bgcolor="#4338ca" style="background:#4338ca;color:#ffffff;padding:8px 18px;font:700 10px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">Standards consulted · ${consulted.length} file${consulted.length === 1 ? '' : 's'}</td></tr>
  ${rows}
</table>`
}

// ── Section: per-finding card ────────────────────────────────────────────────

function renderFindingCard(f: StandardsFinding): string {
  const meta = severityMeta(f.severity)
  const titleLines = softWrap(f.title, 60)
  const titleRows = titleLines
    .map(
      (line) =>
        `<tr><td bgcolor="${meta.bg}" style="background:${meta.bg};color:${meta.text};padding:6px 18px;font:800 13px/1.4 'Helvetica Neue',Arial,sans-serif;">${esc(line)}</td></tr>`,
    )
    .join('')
  const descLines = softWrap(f.description, 64)
  const descRows = descLines
    .map(
      (line) =>
        `<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:1px 18px;font:400 12px/1.5 'Helvetica Neue',Arial,sans-serif;color:#1f2937;">${esc(line)}</td></tr>`,
    )
    .join('')
  const fixLines = softWrap(f.suggestedFix, 64)
  const fixRows = fixLines
    .map(
      (line) =>
        `<tr><td bgcolor="#ecfdf5" style="background:#ecfdf5;padding:1px 18px;font:500 12px/1.5 'Helvetica Neue',Arial,sans-serif;color:#065f46;">${esc(line)}</td></tr>`,
    )
    .join('')
  const citation = f.standardsCitation
  const citationFile = citation?.file ?? '(no file)'
  const citationSection = citation?.section ? ` · §${esc(citation.section)}` : ''
  const citationQuote = citation?.quote
    ? `<tr><td bgcolor="#eef2ff" style="background:#eef2ff;padding:4px 18px;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;font-style:italic;color:#3730a3;">"${esc(citation.quote)}"</td></tr>`
    : ''

  return `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 10px 0;border-collapse:collapse;border:2px solid ${meta.border};">
  <tr>
    <td bgcolor="${meta.bg}" style="background:${meta.bg};color:${meta.text};padding:4px 18px;font:700 10px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">
      ${esc(meta.label)} ·
      <span style="background:#ffffff;color:${meta.text};padding:1px 6px;border-radius:4px;font-family:monospace;font-weight:700;">${esc(targetTypeLabel(f.targetType))}</span>
      <span style="background:#ffffff;color:#475569;padding:1px 6px;border-radius:4px;font-family:monospace;font-weight:600;margin-left:4px;">${esc(f.targetRef)}</span>
    </td>
  </tr>
  ${titleRows}
  ${descRows}
  <tr>
    <td bgcolor="#d1fae5" style="background:#d1fae5;padding:4px 18px;font:700 10px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;color:#047857;">Suggested fix</td>
  </tr>
  ${fixRows}
  <tr>
    <td bgcolor="#c7d2fe" style="background:#c7d2fe;padding:4px 18px;font:700 10px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;color:#3730a3;">Standard cited</td>
  </tr>
  <tr>
    <td bgcolor="#eef2ff" style="background:#eef2ff;padding:4px 18px;font:600 11px/1.5 'Helvetica Neue',Arial,sans-serif;font-family:monospace;color:#312e81;">${esc(citationFile)}${citationSection}</td>
  </tr>
  ${citationQuote}
</table>`
}

function renderFindingsSection(state: StandardsAuditorExportState): string {
  const findings = state.audit?.findings ?? []
  if (findings.length === 0) {
    return `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px 0;border-collapse:collapse;"><tr><td bgcolor="#4f46e5" style="background:#4f46e5;color:#ffffff;padding:10px 18px;font:700 11px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">Findings</td></tr><tr><td bgcolor="#f5f3ff" style="background:#f5f3ff;padding:10px 18px;font:400 12px/1.5 'Helvetica Neue',Arial,sans-serif;color:#475569;">No findings yet — run the deterministic audit or copy the Claudian prompt first.</td></tr></table>`
  }
  // Group by targetType, but sort findings by severity within each group.
  const groups = new Map<StandardsTargetType, StandardsFinding[]>()
  for (const f of findings) {
    if (!groups.has(f.targetType)) groups.set(f.targetType, [])
    groups.get(f.targetType)!.push(f)
  }
  let out = ''
  for (const [targetType, group] of groups) {
    const sorted = group.slice().sort((a, b) => severityOrder(a.severity) - severityOrder(b.severity))
    out += `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:14px 0 6px 0;border-collapse:collapse;"><tr><td bgcolor="#3730a3" style="background:#3730a3;color:#ffffff;padding:8px 18px;font:700 11px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">${esc(targetTypeLabel(targetType))} · ${group.length} finding${group.length === 1 ? '' : 's'}</td></tr></table>`
    out += sorted.map(renderFindingCard).join('')
  }
  return out
}

// ── Section: Velocity-of-Learning footer ────────────────────────────────────

function renderVelocityFooter(): string {
  return `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:10px 0 0 0;border-collapse:collapse;border:1px solid #c4b5fd;">
  <tr><td bgcolor="#4c1d95" style="background:#4c1d95;color:#ffffff;padding:8px 18px;font:700 10px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">Why Standards Audit · Velocity of Learning</td></tr>
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
  <tr><td bgcolor="#fee2e2" style="background:#fee2e2;color:#7f1d1d;padding:6px 18px;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;"><b>Meter</b> (*281) — The measuring instrument or method for a Scale. Required for Value entries that will be tracked.</td></tr>
</table>`
}

// ── Main render function ────────────────────────────────────────────────────

export function renderStandardsAuditorHtml(state: StandardsAuditorExportState): string {
  const now = new Date()
  const datePart = now.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const timePart = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
  const exportedDate = `${datePart}  ${timePart}`

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" /><title>Standards Audit — ${esc(state.planName)}</title></head>
<body style="margin:0;padding:18px;background:#f9fafb;font-family:'Helvetica Neue',Arial,sans-serif;">
${renderHeader(state, exportedDate)}
${renderSummary(state)}
${renderStandardsConsulted(state)}
${renderFindingsSection(state)}
${renderGlossaryFootnote()}
${renderVelocityFooter()}
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:14px 0 0 0;border-collapse:collapse;">
  <tr><td bgcolor="#312e81" style="background:#312e81;color:#c7d2fe;padding:6px 18px;font:500 9px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.08em;">SEM App · Standards Auditor export · Conjunction-of-Technologies Exploit #1</td></tr>
</table>
</body></html>`
}

// ── Plain-text fallback ──────────────────────────────────────────────────────

export function renderStandardsAuditorPlain(state: StandardsAuditorExportState): string {
  const HR = '═'.repeat(56)
  const SR = '─'.repeat(56)
  const lines: string[] = []
  const findings = state.audit?.findings ?? []
  const red = findings.filter((f) => f.severity === 'red').length
  const orange = findings.filter((f) => f.severity === 'orange').length
  const green = findings.filter((f) => f.severity === 'green').length

  lines.push(HR)
  lines.push(
    `Planguage Standards Auditor · ${state.planName}${state.versionLabel ? ' ' + state.versionLabel : ''}`,
  )
  lines.push(
    `${findings.length} ${findings.length === 1 ? 'finding' : 'findings'} · ${red} red · ${orange} orange · ${green} green`,
  )
  if (state.audit?.generatedBy) {
    lines.push(`Generated by: ${state.audit.generatedBy}`)
  }
  lines.push(HR)
  lines.push('')

  const consulted = state.audit?.standardsConsulted ?? []
  if (consulted.length > 0) {
    lines.push('STANDARDS CONSULTED')
    lines.push(SR)
    for (const s of consulted) lines.push(`  · ${s}`)
    lines.push('')
  }

  if (findings.length === 0) {
    lines.push(
      'No findings yet — run the deterministic audit or copy the Claudian prompt first.',
    )
    lines.push('')
  } else {
    const groups = new Map<StandardsTargetType, StandardsFinding[]>()
    for (const f of findings) {
      if (!groups.has(f.targetType)) groups.set(f.targetType, [])
      groups.get(f.targetType)!.push(f)
    }
    for (const [targetType, group] of groups) {
      const sorted = group
        .slice()
        .sort((a, b) => severityOrder(a.severity) - severityOrder(b.severity))
      lines.push(`${targetTypeLabel(targetType).toUpperCase()} — ${group.length} finding${group.length === 1 ? '' : 's'}`)
      lines.push(SR)
      for (const f of sorted) {
        const meta = severityMeta(f.severity)
        lines.push(`[${meta.label}] ${f.targetRef}`)
        lines.push(`  ${f.title}`)
        lines.push(`  ${f.description}`)
        lines.push(`  Fix: ${f.suggestedFix}`)
        const c = f.standardsCitation
        if (c) {
          const section = c.section ? ` · §${c.section}` : ''
          lines.push(`  Standard: ${c.file ?? '(no file)'}${section}`)
          if (c.quote) lines.push(`  "${c.quote}"`)
        }
        lines.push('')
      }
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
  lines.push(
    'Scale (*450) — the unit of measure for a Value.',
  )
  lines.push(
    'Meter (*281) — the measuring instrument or method for a Scale.',
  )
  lines.push('')
  lines.push(SR)
  lines.push('Why Standards Audit · Velocity of Learning')
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
