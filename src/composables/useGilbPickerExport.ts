/**
 * useGilbPickerExport.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Illumination · Information · Illustrations colourful HTML export.
 *
 * Tom Gilb 2026-06-13 verbatim: "i think you forgot, as usual, as our rules
 * dictate, scrolling, export on all windows that can exceed the screen."
 *
 * Universal Export-button-on-all-windows rule (rule_export_button_on_all_windows.md):
 *   1. Build a single full-model colourful HTML document
 *   2. Open a preview window with 100% of the model
 *   3. Put HTML + plain on the clipboard via ClipboardItem
 *   4. Auto-open Mail to Tom@Gilb.com per SEM Email Body Standard
 *   5. Embed the canonical Planguage Glossary footnote for every term
 *   6. Show confirmation toast
 *
 * Composes with:
 *   • Colorful HTML Spec Email Rule (SUPREME) — inline styles + bgcolor attrs
 *   • One-table-for-cohesion (r93aaa) — this is a single cohesive document, so
 *     a single outer table with sequential rows (NOT sibling-tables-per-section)
 *   • r93ppp Twin-as-Destination — every concept reference is a clickable
 *     Twin URL; footer carries "Powered by Tom Gilb Consultant Twin — by Kai Gilb"
 *   • SEM Email Body Standard — LOUD ⌘V cue + Exported stamp + separator
 *   • American English Standard — Color, Center, Analyze
 *   • HoverHint vocabulary (not "tooltip") in comments
 *
 * Architecture: pure functions of an ExportState — no Vue reactivity, no DOM.
 * Portable to Kai's Twin verbatim.
 */

import type { GilbIllustration } from './useGilbIllustrations'

export interface PickerTextResult {
  id:        string
  kind:      'glossary' | 'chapter'
  title:     string
  subtitle:  string
  body:      string
  twinUrl?:  string
  bookTitle?: string
}

export interface GilbPickerExportState {
  query:               string
  primaryGlossary:     PickerTextResult | null
  primarySource:       'local-exact' | 'local-loose' | 'twin' | null
  secondaryGlossary:   PickerTextResult[]
  chapterMatches:      PickerTextResult[]
  illustrations:       GilbIllustration[]   // the visible carousel window (<= 10)
  totalIllustrationMatches: number
  twinConceptUrls:     Array<{ name: string; number: string; url: string }>
  twinText?:           string
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

function twinBookUrl(i: GilbIllustration): string {
  return `https://www.gilb.com/tomtwin/book/${i.bookTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
}

// ── HTML builder — ONE outer table, sequential <tr> rows (r93aaa cohesion) ──

export function renderGilbPickerHtml(state: GilbPickerExportState, exportedDate: string): string {
  const rows: string[] = []

  // Title row
  rows.push(
    `<tr><td bgcolor="#4f46e5" style="background:#4f46e5;color:#ffffff;padding:14px 22px 8px 22px;font:800 22px/1.3 'Helvetica Neue',Arial,sans-serif;">` +
      `Illumination &middot; Information &middot; Illustrations` +
    `</td></tr>`,
  )
  rows.push(
    `<tr><td bgcolor="#7c3aed" style="background:#7c3aed;color:#ede9fe;padding:4px 22px 12px 22px;font:600 12px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">` +
      `Search: &quot;${esc(state.query)}&quot;` +
    `</td></tr>`,
  )
  rows.push(
    `<tr><td bgcolor="#1e1b4b" style="background:#1e1b4b;color:#a5b4fc;padding:6px 22px;font:500 11px/1.4 'Helvetica Neue',Arial,sans-serif;">` +
      `Exported: ${esc(exportedDate)}` +
    `</td></tr>`,
  )

  // Spacer
  rows.push(`<tr><td height="10" style="height:10px;line-height:10px;font-size:0;">&nbsp;</td></tr>`)

  // PRIMARY Glossary card
  if (state.primaryGlossary) {
    const p = state.primaryGlossary
    const sourceBadge = state.primarySource === 'twin'
      ? `<span style="display:inline-block;background:#7c3aed;color:#ffffff;padding:2px 8px;border-radius:4px;font:700 10px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.10em;text-transform:uppercase;">Twin concept &middot; Glossary not local</span>`
      : state.primarySource === 'local-loose'
        ? `<span style="display:inline-block;background:#f59e0b;color:#ffffff;padding:2px 8px;border-radius:4px;font:700 10px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.10em;text-transform:uppercase;">Loose match &middot; query found inside body</span>`
        : `<span style="display:inline-block;background:#059669;color:#ffffff;padding:2px 8px;border-radius:4px;font:700 10px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.10em;text-transform:uppercase;">Local Glossary &middot; exact match</span>`
    rows.push(
      `<tr><td bgcolor="#f5f3ff" style="background:#f5f3ff;padding:12px 22px 4px 22px;font:700 13px/1.4 'Helvetica Neue',Arial,sans-serif;color:#5b21b6;">` +
        `Top Glossary Hit &nbsp; ${sourceBadge}` +
      `</td></tr>`,
    )
    rows.push(
      `<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:10px 22px;font:800 18px/1.3 'Helvetica Neue',Arial,sans-serif;color:#5b21b6;border-left:4px solid #8b5cf6;">` +
        esc(p.title) +
      `</td></tr>`,
    )
    rows.push(
      `<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:0 22px 6px 22px;font:600 11px/1.4 'Helvetica Neue',Arial,sans-serif;color:#64748b;border-left:4px solid #8b5cf6;font-style:italic;">` +
        esc(p.subtitle) +
      `</td></tr>`,
    )
    rows.push(
      `<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:8px 22px 14px 22px;font:400 13px/1.55 'Helvetica Neue',Arial,sans-serif;color:#1e293b;border-left:4px solid #8b5cf6;white-space:pre-wrap;">` +
        esc(p.body || '(no body)') +
      `</td></tr>`,
    )
    if (p.twinUrl) {
      rows.push(
        `<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:0 22px 12px 22px;font:600 11px/1.4 'Helvetica Neue',Arial,sans-serif;border-left:4px solid #8b5cf6;">` +
          `<a href="${esc(p.twinUrl)}" style="color:#5b21b6;text-decoration:underline;">Open on Tom Gilb Consultant Twin &rarr;</a>` +
        `</td></tr>`,
      )
    }
    rows.push(`<tr><td height="10" style="height:10px;line-height:10px;font-size:0;">&nbsp;</td></tr>`)
  }

  // SECONDARY Glossary chips
  if (state.secondaryGlossary.length) {
    rows.push(
      `<tr><td bgcolor="#ede9fe" style="background:#ede9fe;padding:8px 22px;font:700 11px/1.4 'Helvetica Neue',Arial,sans-serif;color:#5b21b6;letter-spacing:0.10em;text-transform:uppercase;">` +
        `Other Glossary Matches (${state.secondaryGlossary.length})` +
      `</td></tr>`,
    )
    const chips = state.secondaryGlossary.map(t => {
      const link = t.twinUrl
        ? `<a href="${esc(t.twinUrl)}" style="color:#5b21b6;text-decoration:none;">${esc(t.title)}</a>`
        : esc(t.title)
      return `<span style="display:inline-block;background:#ffffff;border:1px solid #c4b5fd;color:#5b21b6;padding:3px 10px;border-radius:4px;margin:2px 4px 2px 0;font:600 11px/1.4 'Helvetica Neue',Arial,sans-serif;">${link}</span>`
    }).join('')
    rows.push(
      `<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:8px 22px 12px 22px;">${chips}</td></tr>`,
    )
    rows.push(`<tr><td height="10" style="height:10px;line-height:10px;font-size:0;">&nbsp;</td></tr>`)
  }

  // Twin drill-in concept URLs
  if (state.twinConceptUrls.length) {
    rows.push(
      `<tr><td bgcolor="#ddd6fe" style="background:#ddd6fe;padding:8px 22px;font:700 11px/1.4 'Helvetica Neue',Arial,sans-serif;color:#5b21b6;letter-spacing:0.10em;text-transform:uppercase;">` +
        `Twin Drill-In Concepts (${state.twinConceptUrls.length})` +
      `</td></tr>`,
    )
    const links = state.twinConceptUrls.slice(0, 12).map(c =>
      `<a href="${esc(c.url)}" style="display:inline-block;background:#ffffff;border:1px solid #8b5cf6;color:#5b21b6;padding:3px 10px;border-radius:4px;margin:2px 4px 2px 0;font:600 11px/1.4 'Helvetica Neue',Arial,sans-serif;text-decoration:none;">${esc(c.name)} *${esc(c.number)} &rarr;</a>`,
    ).join('')
    rows.push(
      `<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:8px 22px 12px 22px;">${links}</td></tr>`,
    )
    rows.push(`<tr><td height="10" style="height:10px;line-height:10px;font-size:0;">&nbsp;</td></tr>`)
  }

  // Chapter mentions
  if (state.chapterMatches.length) {
    rows.push(
      `<tr><td bgcolor="#fef3c7" style="background:#fef3c7;padding:8px 22px;font:700 11px/1.4 'Helvetica Neue',Arial,sans-serif;color:#92400e;letter-spacing:0.10em;text-transform:uppercase;">` +
        `Chapter Mentions (${state.chapterMatches.length})` +
      `</td></tr>`,
    )
    const items = state.chapterMatches.slice(0, 12).map(t =>
      `<div style="margin:4px 0;font:400 12px/1.45 'Helvetica Neue',Arial,sans-serif;color:#1e293b;">` +
        `<strong style="color:#0f172a;">${esc(t.title)}</strong>` +
        ` &mdash; <span style="color:#64748b;font-style:italic;">${esc(t.subtitle)}</span>` +
      `</div>`,
    ).join('')
    rows.push(
      `<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:8px 22px 12px 22px;">${items}</td></tr>`,
    )
    rows.push(`<tr><td height="10" style="height:10px;line-height:10px;font-size:0;">&nbsp;</td></tr>`)
  }

  // Illustrations thumbnail grid
  if (state.illustrations.length) {
    rows.push(
      `<tr><td bgcolor="#ffedd5" style="background:#ffedd5;padding:8px 22px;font:700 11px/1.4 'Helvetica Neue',Arial,sans-serif;color:#9a3412;letter-spacing:0.10em;text-transform:uppercase;">` +
        `Illustrations (${state.illustrations.length} of ${state.totalIllustrationMatches} matches)` +
      `</td></tr>`,
    )
    const thumbs = state.illustrations.map(i => {
      const cap = i.caption || i.chapterTitle || i.filename
      const cite = `${i.bookTitle}${i.page ? ' p.' + i.page : ''}`
      return (
        `<div style="display:inline-block;width:200px;vertical-align:top;margin:4px;background:#ffffff;border:1px solid #fdba74;border-radius:6px;padding:6px;">` +
          `<img src="${esc(i.url)}" alt="${esc(cap)}" style="display:block;width:100%;height:130px;object-fit:contain;background:#fff7ed;border-radius:4px;" />` +
          `<div style="margin-top:6px;font:700 11px/1.3 'Helvetica Neue',Arial,sans-serif;color:#9a3412;">${esc(cite)}</div>` +
          `<div style="margin-top:2px;font:400 10px/1.4 'Helvetica Neue',Arial,sans-serif;color:#475569;">${esc(cap.slice(0, 110))}</div>` +
          `<div style="margin-top:4px;"><a href="${esc(twinBookUrl(i))}" style="color:#7c3aed;font:600 10px/1 'Helvetica Neue',Arial,sans-serif;text-decoration:underline;">Open on Twin &rarr;</a></div>` +
        `</div>`
      )
    }).join('')
    rows.push(
      `<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:8px 14px 12px 14px;">${thumbs}</td></tr>`,
    )
    rows.push(`<tr><td height="10" style="height:10px;line-height:10px;font-size:0;">&nbsp;</td></tr>`)
  }

  // Glossary footnote — canonical Planguage definitions per rule
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
    `<html><head><meta charset="UTF-8"><title>Illumination Picker Export</title></head>` +
    `<body style="margin:0;padding:20px;background:#f8fafc;font-family:'Helvetica Neue',Arial,sans-serif;">` +
      `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:900px;margin:0 auto;border-collapse:collapse;border:1px solid #c7d2fe;">` +
        rows.join('') +
      `</table>` +
    `</body></html>`
  )
}

// ── Plain-text builder ──────────────────────────────────────────────────────

export function renderGilbPickerPlain(state: GilbPickerExportState, exportedDate: string): string {
  const HR = '━'.repeat(56)
  const SR = '─'.repeat(56)
  const lines: string[] = []
  lines.push(HR)
  lines.push(`Illumination · Information · Illustrations`)
  lines.push(`Search: "${state.query}"`)
  lines.push(`Exported: ${exportedDate}`)
  lines.push(HR)
  lines.push('')

  if (state.primaryGlossary) {
    const tag = state.primarySource === 'twin'
      ? '[Twin concept — Glossary not local]'
      : state.primarySource === 'local-loose'
        ? '[Loose match — query found inside body]'
        : '[Local Glossary — exact match]'
    lines.push(`TOP GLOSSARY HIT  ${tag}`)
    lines.push(SR)
    lines.push(`${state.primaryGlossary.title}`)
    lines.push(`  ${state.primaryGlossary.subtitle}`)
    lines.push('')
    lines.push(state.primaryGlossary.body || '(no body)')
    if (state.primaryGlossary.twinUrl) {
      lines.push('')
      lines.push(`Twin: ${state.primaryGlossary.twinUrl}`)
    }
    lines.push('')
  }

  if (state.secondaryGlossary.length) {
    lines.push(`OTHER GLOSSARY MATCHES (${state.secondaryGlossary.length})`)
    lines.push(SR)
    for (const t of state.secondaryGlossary) {
      lines.push(`  • ${t.title} — ${t.subtitle}${t.twinUrl ? `  [${t.twinUrl}]` : ''}`)
    }
    lines.push('')
  }

  if (state.twinConceptUrls.length) {
    lines.push(`TWIN DRILL-IN CONCEPTS (${state.twinConceptUrls.length})`)
    lines.push(SR)
    for (const c of state.twinConceptUrls.slice(0, 12)) {
      lines.push(`  • ${c.name} *${c.number} — ${c.url}`)
    }
    lines.push('')
  }

  if (state.chapterMatches.length) {
    lines.push(`CHAPTER MENTIONS (${state.chapterMatches.length})`)
    lines.push(SR)
    for (const t of state.chapterMatches.slice(0, 12)) {
      lines.push(`  • ${t.title} — ${t.subtitle}`)
    }
    lines.push('')
  }

  if (state.illustrations.length) {
    lines.push(`ILLUSTRATIONS (${state.illustrations.length} of ${state.totalIllustrationMatches} matches)`)
    lines.push(SR)
    for (const i of state.illustrations) {
      const cap = i.caption || i.chapterTitle || i.filename
      lines.push(`  • ${i.bookTitle}${i.page ? ' p.' + i.page : ''} — ${cap.slice(0, 100)}`)
      lines.push(`    ${i.url}`)
    }
    lines.push('')
  }

  lines.push(SR)
  lines.push('Glossary — canonical Planguage definitions')
  lines.push(SR)
  lines.push('Tolerable >> — Project-viability threshold. Below it the WHOLE project fails. Scalar Constraint.')
  lines.push('Goal >      — Committed promise. Negotiated trade-off against competing stakeholders.')
  lines.push('Wish >?     — Stakeholder dream, uncommitted. Independent of cost and physics.')
  lines.push('')
  lines.push('Powered by knowledge from the Tom Gilb Consultant Twin — by Kai Gilb')
  lines.push('https://www.gilb.com/tomtwin')

  return lines.join('\n')
}
