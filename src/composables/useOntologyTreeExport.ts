/**
 * useOntologyTreeExport.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Planguage Ontology Tree — colourful HTML + plain-text export.
 *
 * Tom Gilb 2026-06-14 verbatim: "ontology tree, nice but no scrolling not export,
 * RULE all large windoes SCROLLING AND EXPORT".
 *
 * Universal Export-button-on-all-windows rule (rule_export_button_on_all_windows.md):
 *   1. Build a single full-model colourful HTML document (100% of the 663 concepts)
 *   2. Open a preview window so the user sees the full model immediately
 *   3. Put HTML + plain on the clipboard via ClipboardItem
 *   4. Auto-open Mail to Tom@Gilb.com per SEM Email Body Standard (LOUD ⌘V cue)
 *   5. Embed canonical Twin URLs for every concept (r93ppp Twin-as-Destination)
 *   6. Confirmation toast (caller responsibility)
 *
 * Composes with:
 *   • Colorful HTML Spec Email Rule (SUPREME) — inline styles + bgcolor attrs
 *   • One-table-for-cohesion (r93aaa) — single artefact, ONE outer <table>, sequential
 *     <tr> rows; per-category indented <div> blocks inside the row's <td>; NO nested
 *     <table>.  Reads as ONE cohesive document in Mail / Keynote / Notes.
 *   • r93ppp Twin-as-Destination — every concept is a clickable Twin URL; footer
 *     carries "Powered by knowledge from Tom Gilb Consultant Twin — by Kai Gilb"
 *   • American English Standard — Color, Center, Analyze
 *   • HoverHint vocabulary (not "tooltip") in comments
 *
 * Architecture: pure functions of an ExportState — no Vue reactivity, no DOM.
 * Portable to Kai's Twin verbatim.
 */

export interface OntologyExportConcept {
  name:          string
  conceptNumber: string
  type?:         string
  keyedIcon?:    string
  definition?:   string
  twinUrl?:      string
}

export interface OntologyExportCategory {
  name:     string
  slug?:    string
  concepts: OntologyExportConcept[]
}

export interface OntologyTreeExportState {
  query:       string
  matchCount:  number
  total:       number
  categories:  OntologyExportCategory[]   // flattened: one entry per category with its concepts
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function esc(s: string | undefined | null): string {
  if (s == null) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function truncate(s: string | undefined, n: number): string {
  if (!s) return ''
  const t = s.trim()
  return t.length > n ? t.slice(0, n - 1) + '…' : t
}

// ── HTML builder — ONE outer table, sequential <tr> rows (r93aaa cohesion) ──

export function renderOntologyTreeHtml(state: OntologyTreeExportState, exportedDate: string): string {
  const rows: string[] = []

  // Title — Planguage Ontology headline
  rows.push(
    `<tr><td bgcolor="#4f46e5" style="background:#4f46e5;color:#ffffff;padding:14px 22px 8px 22px;font:800 22px/1.3 'Helvetica Neue',Arial,sans-serif;">` +
      `🌳 Planguage Ontology` +
    `</td></tr>`,
  )
  rows.push(
    `<tr><td bgcolor="#7c3aed" style="background:#7c3aed;color:#ede9fe;padding:4px 22px 12px 22px;font:600 12px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">` +
      `${state.total} concepts in ${state.categories.length} categories` +
      (state.query ? ` &middot; Filter: &quot;${esc(state.query)}&quot; (${state.matchCount} match${state.matchCount === 1 ? '' : 'es'})` : '') +
    `</td></tr>`,
  )
  rows.push(
    `<tr><td bgcolor="#1e1b4b" style="background:#1e1b4b;color:#a5b4fc;padding:6px 22px;font:500 11px/1.4 'Helvetica Neue',Arial,sans-serif;">` +
      `Exported: ${esc(exportedDate)} &middot; Source: 10.Standard/2.Glossary/PlanguageGlossary/` +
    `</td></tr>`,
  )

  // Spacer
  rows.push(`<tr><td height="10" style="height:10px;line-height:10px;font-size:0;">&nbsp;</td></tr>`)

  // Per-category rows — each category is ONE <tr> with concepts as inline <div> rows
  for (const cat of state.categories) {
    if (!cat.concepts.length) continue

    // Category header row — slate sub-header
    rows.push(
      `<tr><td bgcolor="#ede9fe" style="background:#ede9fe;padding:10px 22px 6px 22px;font:700 13px/1.4 'Helvetica Neue',Arial,sans-serif;color:#5b21b6;letter-spacing:0.04em;border-left:4px solid #8b5cf6;">` +
        `📂 ${esc(cat.name)} ` +
        `<span style="color:#7c3aed;font:600 11px/1.4 'Helvetica Neue',Arial,sans-serif;">(${cat.concepts.length} concept${cat.concepts.length === 1 ? '' : 's'})</span>` +
      `</td></tr>`,
    )

    // Concepts under this category — inline <div> rows inside ONE <td>
    const conceptDivs = cat.concepts.map(c => {
      const icon = c.keyedIcon ? `<span style="display:inline-block;font:700 12px/1 'Courier New',monospace;color:#5b21b6;background:#f5f3ff;border:1px solid #c4b5fd;padding:2px 5px;border-radius:3px;margin-right:6px;">${esc(c.keyedIcon)}</span>` : ''
      const nameAndNum = c.twinUrl
        ? `<a href="${esc(c.twinUrl)}" style="color:#5b21b6;text-decoration:none;font-weight:700;">${esc(c.name)}</a> <span style="color:#7c3aed;font-weight:600;">*${esc(c.conceptNumber)}</span>`
        : `<strong style="color:#5b21b6;">${esc(c.name)}</strong> <span style="color:#7c3aed;font-weight:600;">*${esc(c.conceptNumber)}</span>`
      const typeChip = c.type
        ? ` <span style="display:inline-block;background:#ffffff;border:1px solid #c4b5fd;color:#64748b;padding:1px 6px;border-radius:3px;font:600 10px/1.4 'Helvetica Neue',Arial,sans-serif;">${esc(c.type)}</span>`
        : ''
      const def = c.definition
        ? `<div style="margin:2px 0 0 0;color:#475569;font:400 11px/1.45 'Helvetica Neue',Arial,sans-serif;">${esc(truncate(c.definition, 220))}</div>`
        : ''
      const linkLine = c.twinUrl
        ? `<div style="margin:2px 0 0 0;font:500 10px/1.4 'Helvetica Neue',Arial,sans-serif;"><a href="${esc(c.twinUrl)}" style="color:#7c3aed;text-decoration:underline;">${esc(c.twinUrl)}</a></div>`
        : ''
      return (
        `<div style="margin:6px 0;padding:4px 0 4px 8px;border-left:2px solid #ddd6fe;font:400 12px/1.5 'Helvetica Neue',Arial,sans-serif;color:#1e293b;">` +
          `<div>${icon}${nameAndNum}${typeChip}</div>` +
          def +
          linkLine +
        `</div>`
      )
    }).join('')

    rows.push(
      `<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:4px 22px 10px 22px;border-left:4px solid #8b5cf6;">${conceptDivs}</td></tr>`,
    )
    rows.push(`<tr><td height="6" style="height:6px;line-height:6px;font-size:0;">&nbsp;</td></tr>`)
  }

  // Glossary footnote — canonical Planguage commitment-category definitions
  rows.push(
    `<tr><td bgcolor="#1e293b" style="background:#1e293b;padding:8px 22px;font:700 10px/1.4 'Helvetica Neue',Arial,sans-serif;color:#cbd5e1;letter-spacing:0.10em;text-transform:uppercase;">` +
      `Canonical Planguage Glossary &middot; Source: 10.Standard/2.Glossary/PlanguageGlossary/` +
    `</td></tr>`,
  )
  rows.push(
    `<tr><td bgcolor="#0f172a" style="background:#0f172a;padding:10px 22px;font:400 11px/1.55 'Helvetica Neue',Arial,sans-serif;color:#e2e8f0;">` +
      `<div style="margin:2px 0;"><strong style="color:#a78bfa;">Tolerable &gt;&gt;</strong> &mdash; minimum non-failure / project-viability threshold (Scalar Constraint).</div>` +
      `<div style="margin:2px 0;"><strong style="color:#34d399;">Goal &gt;</strong> &mdash; committed promise (negotiated trade-off).</div>` +
      `<div style="margin:2px 0;"><strong style="color:#fbbf24;">Wish &gt;?</strong> &mdash; stakeholder dream, uncommitted (independent of cost + physics).</div>` +
    `</td></tr>`,
  )

  // Twin promotional footer (r93ppp)
  rows.push(
    `<tr><td bgcolor="#312e81" style="background:#312e81;padding:10px 22px;font:600 11px/1.4 'Helvetica Neue',Arial,sans-serif;color:#c7d2fe;text-align:center;">` +
      `Powered by knowledge from the <a href="https://www.gilb.com/tomtwin" style="color:#fde68a;text-decoration:underline;">Tom Gilb Consultant Twin</a> &mdash; by Kai Gilb` +
    `</td></tr>`,
  )

  return (
    `<!DOCTYPE html>` +
    `<html><head><meta charset="UTF-8"><title>Planguage Ontology Export</title></head>` +
    `<body style="margin:0;padding:20px;background:#f8fafc;font-family:'Helvetica Neue',Arial,sans-serif;">` +
      `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:960px;margin:0 auto;border-collapse:collapse;border:1px solid #c7d2fe;">` +
        rows.join('') +
      `</table>` +
    `</body></html>`
  )
}

// ── Plain-text builder ──────────────────────────────────────────────────────

export function renderOntologyTreePlain(state: OntologyTreeExportState, exportedDate: string): string {
  const HR = '━'.repeat(56)
  const SR = '─'.repeat(56)
  const lines: string[] = []
  lines.push(HR)
  lines.push(`🌳 Planguage Ontology — ${state.total} concepts in ${state.categories.length} categories`)
  if (state.query) {
    lines.push(`Filter: "${state.query}" (${state.matchCount} match${state.matchCount === 1 ? '' : 'es'})`)
  }
  lines.push(`Exported: ${exportedDate}`)
  lines.push(`Source: 10.Standard/2.Glossary/PlanguageGlossary/`)
  lines.push(HR)
  lines.push('')

  for (const cat of state.categories) {
    if (!cat.concepts.length) continue
    lines.push(`📂 ${cat.name.toUpperCase()} (${cat.concepts.length})`)
    lines.push(SR)
    for (const c of cat.concepts) {
      const icon = c.keyedIcon ? `${c.keyedIcon} ` : ''
      const type = c.type ? ` [${c.type}]` : ''
      const def  = c.definition ? ` — ${truncate(c.definition, 180)}` : ''
      lines.push(`  • ${icon}${c.name} *${c.conceptNumber}${type}${def}`)
      if (c.twinUrl) lines.push(`    ${c.twinUrl}`)
    }
    lines.push('')
  }

  lines.push(SR)
  lines.push('Glossary — canonical Planguage commitment categories')
  lines.push(SR)
  lines.push('Tolerable >> — Project-viability threshold. Below it the WHOLE project fails. Scalar Constraint.')
  lines.push('Goal >      — Committed promise. Negotiated trade-off against competing stakeholders.')
  lines.push('Wish >?     — Stakeholder dream, uncommitted. Independent of cost and physics.')
  lines.push('')
  lines.push('Powered by knowledge from the Tom Gilb Consultant Twin — by Kai Gilb')
  lines.push('https://www.gilb.com/tomtwin')

  return lines.join('\n')
}
