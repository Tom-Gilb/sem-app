// UNIT_TYPE=Lib
// maria/email.ts — MariaResult → RFC 2822-ready HTML email body
//
// Pure function. No Vue, no Anthropic SDK, no browser APIs.
// Builds the full inline-styled HTML body for the Maria governance report email.
// All styles are inline (no <style> block) so email clients (Gmail, Apple Mail,
// Outlook) render them correctly without stripping external stylesheets.
//
// Colorful Exports Rule (2026-05-26): exports are always colored HTML tables,
// never plain text.
//
// Portability: import this anywhere — Node, Deno, Playwright, Kai-Zen, Twin.
// The only dependency is src/types/maria.ts which is also framework-free.

import type {
  MariaResult,
  MariaDecision,
  MariaAuthorityEntry,
  MariaGap,
  MariaPattern,
} from '../../types/maria'

// ─── Public options ────────────────────────────────────────────────────────────

export interface MariaEmailOptions {
  /**
   * The Todd usefulness rating (−100 to +100).
   * When provided and `ratingInteracted` is true, appended to the email header.
   * null or undefined = rating widget not engaged — omit from email.
   */
  ratingValue?: number | null
  /** Human-readable label for the rating (e.g. "✅ Very useful"). */
  ratingLabel?: string
  /**
   * Whether the user actually moved the rating slider.
   * False (default) = slider not touched — omit the rating line from the email.
   */
  ratingInteracted?: boolean
  /**
   * Override the date string shown in the email header.
   * Default: current date formatted as "Wednesday, 29 May 2026".
   */
  dateOverride?: string
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function layerBadge(layer: string): string {
  const colors: Record<string, string> = {
    board:      'background:#dcfce7;color:#166534;border:1px solid #bbf7d0',
    management: 'background:#e0e7ff;color:#3730a3;border:1px solid #c7d2fe',
    operations: 'background:#e0f2fe;color:#075985;border:1px solid #bae6fd',
  }
  return `<span style="display:inline-block;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:700;${colors[layer] ?? ''}">${layer.toUpperCase()}</span>`
}

function severityBadge(sev: string): string {
  const colors: Record<string, string> = {
    critical: 'background:#fee2e2;color:#991b1b;border:1px solid #fecaca',
    moderate: 'background:#fef3c7;color:#92400e;border:1px solid #fde68a',
    advisory: 'background:#f1f5f9;color:#475569;border:1px solid #e2e8f0',
  }
  return `<span style="display:inline-block;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:700;${colors[sev] ?? ''}">${sev.toUpperCase()}</span>`
}

// ─── Section builders ─────────────────────────────────────────────────────────

function decisionInventorySection(r: MariaResult): string {
  return `
    <h2 style="margin:24px 0 8px 0;font-size:16px;font-weight:700;color:#064e3b;border-left:4px solid #059669;padding-left:10px;">
      🗂 Decision Inventory
    </h2>
    <p style="margin:0 0 12px 0;font-size:12px;color:#475569;">${r.decisionInventory.length} decisions extracted from the board document.</p>
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead>
        <tr style="background:#f0fdf4;">
          <th style="padding:6px 10px;text-align:left;font-size:11px;color:#065f46;border-bottom:2px solid #a7f3d0;width:36px;">ID</th>
          <th style="padding:6px 10px;text-align:left;font-size:11px;color:#065f46;border-bottom:2px solid #a7f3d0;">Decision</th>
          <th style="padding:6px 10px;text-align:center;font-size:11px;color:#065f46;border-bottom:2px solid #a7f3d0;width:90px;">Layer</th>
          <th style="padding:6px 10px;text-align:center;font-size:11px;color:#065f46;border-bottom:2px solid #a7f3d0;width:60px;">Auth. Gap</th>
        </tr>
      </thead>
      <tbody>
        ${r.decisionInventory.map((d: MariaDecision, i: number) => `
        <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f9fafb'};">
          <td style="padding:8px 10px;color:#6b7280;font-weight:700;">${esc(d.id)}</td>
          <td style="padding:8px 10px;color:#1e293b;">
            ${esc(d.text)}
            ${d.authorityGapFlagged && d.authorityGapNote ? `<br/><span style="font-size:11px;color:#b45309;font-style:italic;">⚠ ${esc(d.authorityGapNote)}</span>` : ''}
          </td>
          <td style="padding:8px 10px;text-align:center;">${layerBadge(d.layer)}</td>
          <td style="padding:8px 10px;text-align:center;">${d.authorityGapFlagged ? '<span style="color:#dc2626;font-size:14px;">⚑</span>' : '<span style="color:#a3e635;">✓</span>'}</td>
        </tr>`).join('')}
      </tbody>
    </table>`
}

function authorityReportSection(r: MariaResult): string {
  if (r.authorityReport.length === 0) {
    return `
    <h2 style="margin:24px 0 8px 0;font-size:16px;font-weight:700;color:#1e1b4b;border-left:4px solid #6366f1;padding-left:10px;">
      ⚑ Authority Clarity Report
    </h2>
    <p style="margin:0 0 12px 0;font-size:12px;color:#059669;">✓ No authority clarity gaps were identified in this document.</p>`
  }

  return `
    <h2 style="margin:24px 0 8px 0;font-size:16px;font-weight:700;color:#1e1b4b;border-left:4px solid #6366f1;padding-left:10px;">
      ⚑ Authority Clarity Report
    </h2>
    <p style="margin:0 0 12px 0;font-size:12px;color:#475569;">${r.authorityReport.length} authority clarity gap${r.authorityReport.length !== 1 ? 's' : ''} identified.</p>
    ${r.authorityReport.map((a: MariaAuthorityEntry) => `
    <div style="margin-bottom:12px;border:1px solid #e0e7ff;border-radius:8px;overflow:hidden;">
      <div style="background:#e0e7ff;padding:8px 12px;display:flex;gap:8px;align-items:center;">
        <span style="font-size:11px;font-weight:700;color:#3730a3;">Decisions: ${esc(a.decisionIds.join(', '))}</span>
        <span style="margin-left:auto;">${severityBadge(a.severity)}</span>
      </div>
      <div style="padding:10px 12px;">
        <p style="margin:0 0 8px 0;font-size:12px;color:#1e293b;"><strong>Observation:</strong> ${esc(a.issue)}</p>
        <p style="margin:0;font-size:12px;color:#065f46;"><strong>Opportunity:</strong> ${esc(a.opportunity)}</p>
      </div>
    </div>`).join('')}`
}

function governanceGapsSection(r: MariaResult): string {
  if (r.governanceGaps.length === 0) {
    return `
    <h2 style="margin:24px 0 8px 0;font-size:16px;font-weight:700;color:#92400e;border-left:4px solid #f59e0b;padding-left:10px;">
      📋 Governance Gaps
    </h2>
    <p style="margin:0 0 12px 0;font-size:12px;color:#059669;">✓ No governance gaps were identified in this document.</p>`
  }

  return `
    <h2 style="margin:24px 0 8px 0;font-size:16px;font-weight:700;color:#92400e;border-left:4px solid #f59e0b;padding-left:10px;">
      📋 Governance Gaps
    </h2>
    <p style="margin:0 0 12px 0;font-size:12px;color:#475569;">${r.governanceGaps.length} topic${r.governanceGaps.length !== 1 ? 's' : ''} that should have a board decision but do not.</p>
    ${r.governanceGaps.map((g: MariaGap) => `
    <div style="margin-bottom:12px;border:1px solid #fde68a;border-radius:8px;overflow:hidden;">
      <div style="background:#fef3c7;padding:8px 12px;">
        <span style="font-size:11px;font-weight:700;color:#92400e;">${esc(g.id)} · ${esc(g.category)}</span>
      </div>
      <div style="padding:10px 12px;">
        <p style="margin:0 0 8px 0;font-size:12px;color:#1e293b;"><strong>Significance:</strong> ${esc(g.significance)}</p>
        <p style="margin:0;font-size:12px;color:#065f46;"><strong>Opportunity:</strong> ${esc(g.opportunity)}</p>
      </div>
    </div>`).join('')}`
}

function patternAnalysisSection(r: MariaResult): string {
  return `
    <h2 style="margin:24px 0 8px 0;font-size:16px;font-weight:700;color:#1e293b;border-left:4px solid #8b5cf6;padding-left:10px;">
      🔮 Governance Pattern Analysis
    </h2>
    <p style="margin:0 0 12px 0;font-size:12px;color:#475569;">${r.patternAnalysis.length} pattern${r.patternAnalysis.length !== 1 ? 's' : ''} identified across the document.</p>
    ${r.patternAnalysis.map((p: MariaPattern) => {
      const isStrength = p.type === 'strength'
      return `
      <div style="margin-bottom:12px;border:1px solid ${isStrength ? '#a7f3d0' : '#fecaca'};border-radius:8px;overflow:hidden;">
        <div style="background:${isStrength ? '#f0fdf4' : '#fff1f2'};padding:8px 12px;display:flex;gap:8px;align-items:center;">
          <span style="font-size:14px;">${isStrength ? '✅' : '⚠️'}</span>
          <span style="font-size:12px;font-weight:700;color:${isStrength ? '#065f46' : '#9f1239'};">${esc(p.id)} · ${esc(p.label)}</span>
          <span style="margin-left:auto;font-size:10px;font-weight:600;padding:2px 7px;border-radius:4px;${isStrength ? 'background:#dcfce7;color:#166534;border:1px solid #bbf7d0;' : 'background:#fee2e2;color:#991b1b;border:1px solid #fecaca;'}">${p.type.toUpperCase()}</span>
        </div>
        <div style="padding:10px 12px;">
          <p style="margin:0 0 8px 0;font-size:12px;color:#1e293b;"><strong>Pattern:</strong> ${esc(p.description)}</p>
          <p style="margin:0;font-size:12px;color:#065f46;"><strong>Opportunity:</strong> ${esc(p.opportunity)}</p>
          ${p.evidenceDecisionIds.length ? `<p style="margin:6px 0 0 0;font-size:10px;color:#6b7280;">Evidence: decisions ${p.evidenceDecisionIds.map(esc).join(', ')}</p>` : ''}
        </div>
      </div>`
    }).join('')}`
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Builds the full inline-styled HTML body for the Maria governance report email.
 *
 * All styles are inline — safe for Gmail, Apple Mail, and Outlook without
 * external stylesheet support.
 *
 * @param result  The MariaResult to render.
 * @param opts    Optional rendering context (rating widget state, date override).
 * @returns       Complete HTML string — pass directly to openEml() htmlBody param.
 */
export function buildMariaEmailHtml(
  result: MariaResult,
  opts: MariaEmailOptions = {},
): string {
  const date =
    opts.dateOverride ??
    new Date().toLocaleDateString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

  const ratingNote =
    opts.ratingInteracted && opts.ratingValue !== null && opts.ratingValue !== undefined
      ? `<p style="margin:4px 0 0 0;font-size:12px;color:#e2e8f0;">Todd usefulness rating: <strong>${opts.ratingValue > 0 ? '+' : ''}${opts.ratingValue}/100</strong>${opts.ratingLabel ? ` — ${opts.ratingLabel}` : ''}</p>`
      : ''

  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;color:#0f172a;max-width:760px;margin:0 auto;padding:20px;">

  <div style="background:linear-gradient(135deg,#064e3b,#065f46);border-radius:12px;padding:20px;margin-bottom:24px;">
    <h1 style="margin:0 0 4px 0;font-size:20px;font-weight:800;color:white;">🏛 Maria — Board Work Parse</h1>
    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.7);">Board Document Analysis · ${esc(date)}</p>
    ${ratingNote}
  </div>

  <p style="margin:0 0 16px 0;font-size:12px;color:#475569;">
    <strong>Document size:</strong> ~${result.sourceWordCount} words ·
    <strong>Decisions extracted:</strong> ${result.decisionInventory.length} ·
    <strong>Authority gaps:</strong> ${result.authorityReport.length} ·
    <strong>Governance gaps:</strong> ${result.governanceGaps.length} ·
    <strong>Patterns identified:</strong> ${result.patternAnalysis.length}
  </p>

  ${decisionInventorySection(result)}
  ${authorityReportSection(result)}
  ${governanceGapsSection(result)}
  ${patternAnalysisSection(result)}

  <div style="margin-top:32px;padding:16px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
    <p style="margin:0;font-size:11px;color:#94a3b8;text-align:center;">
      Generated by Maria Agent (SEM App) · ${new Date().toISOString().slice(0, 10)} ·
      Tone: opportunities for board action, not problems ·
      Three-layer governance model: Board · Management · Operations
    </p>
  </div>

</div>`
}
