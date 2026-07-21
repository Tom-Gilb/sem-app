// UNIT_TYPE=Composable
// useAgentReportExport.ts — shared colourful HTML + plain-text renderer for
// every analytical agent panel (Munger, Heilmeier, Role, and any future agent
// that follows the Finding/Report shape).
//
// Tom Gilb 2026-06-23 verbatim:
//   "role agent window, no export !!!! why do I always have to remind you of
//    this?"
//
// This module exists so the Export-Button-on-All-Windows SUPREME rule can be
// honored UNIVERSALLY for analytical agents — one shared renderer, called by
// every panel's per-agent handler, so future agents inherit the discipline
// from one place.
//
// Composes with:
//   • Export-Button-on-All-Windows Rule SUPREME (Tom 2026-06-06)
//   • Mailto-No-Self-To Rule SUPREME — every call site passes to: '' explicitly
//   • Colorful HTML Spec Email Rule SUPREME — sibling tables, bgcolor=, inline
//   • Conjunction-of-Technologies SUPREME — per-finding source-layer badges
//   • Universal Velocity-of-Learning quote (Tom 2026-06-21)
//   • Twin promotional discipline (r93ppp) — every agent footer cites the Twin
//
// The shape that callers pass is intentionally GENERIC — caller maps its
// agent-specific Finding/Report types onto this view before calling.

import { exportArtefact, htmlEsc, htmlDocumentShell, sectionHeaderHtml } from './useExportShared'

/** One generic finding view — caller maps its agent-specific finding to this. */
export interface AgentExportFinding {
  /** Stable finding id (for plain-text references and HTML anchors). */
  id: string
  /** Category bucket label — already human-readable. */
  categoryLabel: string
  /** One-line "principle violated" headline. */
  principleViolated: string
  /** Multi-sentence explanation. */
  explanation: string
  /** Severity label (e.g. 'CRITICAL' / 'MODERATE' / 'SUGGESTION'). */
  severityLabel: string
  /** Severity background colour hex (Keynote-safe bgcolor=). */
  severityBgHex: string
  /** Source-layer badge label (e.g. 'Derived from plan'). */
  sourceLayerLabel: string
  /** Source-layer hex (bgcolor=). */
  sourceLayerBgHex: string
  /** Spec entry / item that triggered this finding. */
  triggeredBy: string
  /** Proposed Planguage fix text. */
  fixPlanguage: string
  /** Rationale for the fix. */
  fixRationale: string
  /** Long-term consequence — one sentence. */
  longTermConsequence: string
  /** Citations — short text chips (Gilb / Munger / Musk / Heilmeier etc.). */
  citations: string[]
}

/** Group of findings by category — what the renderer iterates over. */
export interface AgentExportCategoryGroup {
  categoryLabel: string
  /** Optional category subtitle / principle one-liner. */
  categorySubtitle?: string
  findings: AgentExportFinding[]
}

/** Caller-supplied per-agent context. */
export interface AgentExportInput {
  /** Agent display name (header card). */
  agentName: string
  /** Agent subtitle / one-line method summary. */
  agentSubtitle: string
  /** Header background hex (matches the panel's gradient family). */
  agentHeaderBgHex: string
  /** Plan title — header card. */
  planTitle: string
  /** Score value (0-100). Optional — omit if the agent has no aggregate score. */
  scoreValue?: number
  /** Score label (e.g. 'Rationality', 'Clarity', 'Compliance'). */
  scoreLabel?: string
  /** Total findings count. */
  totalFindings: number
  /** Severity tally — array of {label, count, bgHex}. */
  severityTally: Array<{ label: string; count: number; bgHex: string }>
  /** One-line headline / executive summary. */
  headline: string
  /** Pre-grouped findings. */
  groups: AgentExportCategoryGroup[]
  /** Provenance / source footer block — short HTML allowed (already escaped). */
  sourcesFooterHtml: string
  /** Subject line for the email. */
  subject: string
  /** Friendly artefact name — toast + telemetry. */
  artefactName: string
}

/** Map of {label, hex} chips used across the colourful HTML. */
function chipHtml(label: string, bgHex: string, fgHex = '#ffffff'): string {
  return `<span style="background:${bgHex};color:${fgHex};padding:2px 8px;border-radius:4px;font:700 10px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.04em;text-transform:uppercase;display:inline-block;margin:0 6px 4px 0;">${htmlEsc(label)}</span>`
}

function renderHeader(input: AgentExportInput): string {
  const scoreCell =
    input.scoreValue !== undefined && input.scoreLabel
      ? `<td bgcolor="#ffffff" align="center" style="background:#ffffff;color:#1e293b;padding:6px 14px;font:800 22px/1 'Helvetica Neue',Arial,sans-serif;border-radius:8px;">${htmlEsc(String(input.scoreValue))}<div style="font:700 9px/1.2 'Helvetica Neue',Arial,sans-serif;color:#475569;letter-spacing:0.1em;text-transform:uppercase;margin-top:2px;">${htmlEsc(input.scoreLabel)}</div></td>`
      : ''
  return `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px 0;border-collapse:collapse;">
  <tr>
    <td bgcolor="${input.agentHeaderBgHex}" style="background:${input.agentHeaderBgHex};color:#ffffff;padding:14px 22px;font:800 22px/1.2 'Helvetica Neue',Arial,sans-serif;">${htmlEsc(input.agentName)}</td>
    ${scoreCell ? `<td bgcolor="${input.agentHeaderBgHex}" align="right" style="background:${input.agentHeaderBgHex};padding:10px 14px;">${scoreCell}</td>` : ''}
  </tr>
  <tr><td bgcolor="${input.agentHeaderBgHex}" colspan="${scoreCell ? 2 : 1}" style="background:${input.agentHeaderBgHex};color:#e2e8f0;padding:0 22px 12px 22px;font:500 12px/1.4 'Helvetica Neue',Arial,sans-serif;">${htmlEsc(input.agentSubtitle)} &middot; Plan: <b>${htmlEsc(input.planTitle || '(Untitled Plan)')}</b></td></tr>
</table>`
}

function renderSummary(input: AgentExportInput): string {
  const pills = input.severityTally
    .filter(t => t.count > 0)
    .map(t => chipHtml(`${t.count} ${t.label}`, t.bgHex))
    .join('')
  return `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px 0;border-collapse:collapse;border:1px solid #cbd5e1;">
  <tr><td bgcolor="#f8fafc" style="background:#f8fafc;color:#1e293b;padding:10px 18px;font:600 13px/1.5 'Helvetica Neue',Arial,sans-serif;">${htmlEsc(input.headline)}</td></tr>
  <tr><td bgcolor="#ffffff" style="background:#ffffff;padding:8px 14px;">${pills || '<i style="color:#475569;font:400 11px/1.4 Helvetica Neue,Arial,sans-serif;">No findings &mdash; the plan passes every check at this moment.</i>'}</td></tr>
  <tr><td bgcolor="#f1f5f9" style="background:#f1f5f9;color:#334155;padding:6px 18px;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;">Total findings: <b>${input.totalFindings}</b></td></tr>
</table>`
}

function renderFinding(f: AgentExportFinding): string {
  const sev = chipHtml(f.severityLabel, f.severityBgHex)
  const src = chipHtml(f.sourceLayerLabel, f.sourceLayerBgHex, '#1e293b')
  const cit = f.citations.length
    ? `<div style="margin-top:6px;">${f.citations.map(c => chipHtml(c, '#e0e7ff', '#312e81')).join('')}</div>`
    : ''
  return `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 10px 0;border-collapse:collapse;border:1px solid #e2e8f0;">
  <tr><td bgcolor="#ffffff" style="background:#ffffff;padding:8px 14px;">${sev}${src}<span style="color:#475569;font:500 11px/1.4 'Helvetica Neue',Arial,sans-serif;">&rarr; ${htmlEsc(f.triggeredBy)}</span></td></tr>
  <tr><td bgcolor="#ffffff" style="background:#ffffff;padding:0 14px 6px 14px;color:#0f172a;font:700 13px/1.4 'Helvetica Neue',Arial,sans-serif;">${htmlEsc(f.principleViolated)}</td></tr>
  <tr><td bgcolor="#ffffff" style="background:#ffffff;padding:0 14px 8px 14px;color:#334155;font:400 12px/1.5 'Helvetica Neue',Arial,sans-serif;">${htmlEsc(f.explanation)}</td></tr>
  <tr><td bgcolor="#f0f9ff" style="background:#f0f9ff;padding:8px 14px;color:#0c4a6e;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;border-top:1px solid #bae6fd;"><b style="text-transform:uppercase;letter-spacing:0.06em;font-size:10px;">Proposed Planguage edit</b><pre style="margin:4px 0 0 0;font:500 11px/1.5 ui-monospace,Menlo,monospace;color:#0f172a;white-space:pre-wrap;">${htmlEsc(f.fixPlanguage)}</pre><i style="display:block;margin-top:4px;color:#0c4a6e;">${htmlEsc(f.fixRationale)}</i></td></tr>
  <tr><td bgcolor="#fef9c3" style="background:#fef9c3;padding:6px 14px;color:#713f12;font:400italic 11px/1.5 'Helvetica Neue',Arial,sans-serif;">Long-term consequence: ${htmlEsc(f.longTermConsequence)}${cit}</td></tr>
  <tr><td bgcolor="#ffffff" style="background:#ffffff;padding:8px 14px;border-top:1px solid #e2e8f0;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;color:#475569;"><!-- r41 v310 (Tom Gilb 2026-06-23 "the fix stuff is in the display but NOT in the paste !!!! a copy is a copy!") — Accept Fix + Dismiss visual buttons mirrored from the panel so the export is a faithful copy of what the planner sees on screen.  Buttons render as styled pills (not clickable in email/Keynote); the actionable form lives in the SEM App. --><span style="display:inline-block;background:#0891b2;color:#ffffff;padding:4px 10px;border-radius:6px;font-weight:700;font-size:11px;margin-right:8px;">&#10003; Accept Fix</span><span style="display:inline-block;background:#e2e8f0;color:#334155;padding:4px 10px;border-radius:6px;font-weight:600;font-size:11px;margin-right:8px;">Dismiss</span><span style="font-style:italic;color:#94a3b8;font-size:10px;">(action pills mirror the SEM App panel &mdash; the live buttons are in the Role Agent / Munger / Heilmeier modal.)</span></td></tr>
</table>`
}

function renderGroup(g: AgentExportCategoryGroup): string {
  const head = sectionHeaderHtml(g.categoryLabel + (g.findings.length > 1 ? ` (${g.findings.length})` : ''), '#475569')
  const sub = g.categorySubtitle
    ? `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 8px 0;border-collapse:collapse;"><tr><td bgcolor="#f1f5f9" style="background:#f1f5f9;color:#475569;padding:4px 18px;font:400italic 11px/1.4 'Helvetica Neue',Arial,sans-serif;">${htmlEsc(g.categorySubtitle)}</td></tr></table>`
    : ''
  return head + sub + g.findings.map(renderFinding).join('')
}

function renderVelocityOfLearningFooter(): string {
  return `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:14px 0 0 0;border-collapse:collapse;">
  <tr><td bgcolor="#1e1b4b" style="background:#1e1b4b;color:#a5b4fc;padding:8px 18px;font:500italic 10px/1.5 'Helvetica Neue',Arial,sans-serif;">Velocity of Learning (Tom Gilb 2026-06-21): &ldquo;The purpose is not to achieve the initial Value requirements, but to learn quickly and often (Musk&rsquo;s Velocity of Learning) so that the specifications are the best current set of ideas for the realities we encounter.&rdquo;</td></tr>
  <tr><td bgcolor="#312e81" style="background:#312e81;color:#c7d2fe;padding:6px 18px;font:500 10px/1.4 'Helvetica Neue',Arial,sans-serif;">Tom Gilb Consultant Twin (by Kai Gilb) &middot; <a href="https://www.gilb.com/tomtwin" style="color:#a5b4fc;">https://www.gilb.com/tomtwin</a></td></tr>
</table>`
}

/** Build the full colourful HTML body — used by every agent panel's export handler. */
export function renderAgentReportHtml(input: AgentExportInput): string {
  const body =
    renderHeader(input) +
    renderSummary(input) +
    input.groups.map(renderGroup).join('') +
    `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:14px 0 0 0;border-collapse:collapse;border:1px solid #cbd5e1;">
      <tr><td bgcolor="#f1f5f9" style="background:#f1f5f9;color:#334155;padding:8px 18px;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;">${input.sourcesFooterHtml}</td></tr>
    </table>` +
    renderVelocityOfLearningFooter()
  return htmlDocumentShell({ title: `${input.agentName} report`, bodyHtml: body })
}

/** Plain-text fallback — minimal but readable. */
export function renderAgentReportPlain(input: AgentExportInput): string {
  const lines: string[] = []
  lines.push(`${input.agentName} — ${input.agentSubtitle}`)
  lines.push(`Plan: ${input.planTitle || '(Untitled Plan)'}`)
  if (input.scoreValue !== undefined && input.scoreLabel) {
    lines.push(`${input.scoreLabel}: ${input.scoreValue}`)
  }
  lines.push(`Total findings: ${input.totalFindings}`)
  lines.push('')
  lines.push(input.headline)
  lines.push('')
  for (const t of input.severityTally) {
    if (t.count > 0) lines.push(`  ${t.count} ${t.label}`)
  }
  lines.push('')
  lines.push('─'.repeat(60))
  for (const g of input.groups) {
    lines.push('')
    lines.push(`■ ${g.categoryLabel}`)
    if (g.categorySubtitle) lines.push(`  ${g.categorySubtitle}`)
    for (const f of g.findings) {
      lines.push('')
      lines.push(`  [${f.severityLabel}] ${f.principleViolated}`)
      lines.push(`  Source: ${f.sourceLayerLabel} · Triggered by: ${f.triggeredBy}`)
      lines.push(`  ${f.explanation}`)
      lines.push(`  Proposed Planguage edit:`)
      for (const ln of f.fixPlanguage.split('\n')) lines.push(`    ${ln}`)
      lines.push(`  Rationale: ${f.fixRationale}`)
      lines.push(`  Long-term consequence: ${f.longTermConsequence}`)
      if (f.citations.length) lines.push(`  Citations: ${f.citations.join(' · ')}`)
    }
  }
  lines.push('')
  lines.push('─'.repeat(60))
  lines.push('Velocity of Learning (Tom Gilb 2026-06-21): The purpose is not to achieve the')
  lines.push('initial Value requirements, but to learn quickly and often so that the')
  lines.push('specifications are the best current set of ideas for the realities we encounter.')
  lines.push('')
  lines.push('Tom Gilb Consultant Twin (by Kai Gilb) · https://www.gilb.com/tomtwin')
  return lines.join('\n')
}

/**
 * Top-level export entry-point for any analytical agent panel.
 * Mailto-No-Self-To SUPREME: to:'' is passed explicitly — Tom is the SENDER.
 */
export async function exportAgentReport(input: AgentExportInput): Promise<void> {
  const htmlText  = renderAgentReportHtml(input)
  const plainText = renderAgentReportPlain(input)
  await exportArtefact({
    htmlText,
    plainText,
    subject: input.subject,
    artefactName: input.artefactName,
    to: '', // Mailto-No-Self-To SUPREME — Tom is the sender; recipient must be empty.
  })
}
