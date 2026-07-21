/**
 * useInfoPanelExport.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Per-channel exporters for the two stage-bar info panels:
 *   • StageInfoPanel  — opens on stage-tile double-click (one Planguage stage)
 *   • ArrowInfoPanel  — opens on stage-arrow click (transition between two stages)
 *
 * Tom Gilb 2026-06-25 verbatim history:
 *   FIRST: *"The info windows stages and between arrows all lack export buttons"*.
 *   THEN (after v381 shipped a custom 📨 pin): *"the export is not the standard
 *   export option and did not go to email at all. I believe we need only one
 *   well designed export button and function and icon and this is not it"*.
 *
 * The fix shipped here (v382):
 *   • Use the canonical `<ExportSpecPin>` component (Tom 2026-06-05) instead of
 *     a one-off pin.  Same icon (GetGlyph [*]→*), same flow (auto-copy on click,
 *     channel menu with 20s countdown, separate user click per channel).
 *   • SPLIT the export action into PER-CHANNEL functions so each channel fires
 *     on its own fresh user click — Safari kills `mailto:` when it's chained
 *     after `clipboard.write()` + `window.open()` in the same handler, which is
 *     why v381's Email never opened Mail.app.  The canonical pin avoids this by
 *     having the user click Email as a separate action.
 *
 * Composes with:
 *   • Export-button-on-all-windows SUPREME (Tom 2026-06-06)
 *   • ExportSpecPin canonical multi-channel pattern (Tom 2026-06-05)
 *   • Colorful HTML Spec Email Rule SUPREME
 *   • One-table-for-cohesion (r93aaa)
 *   • SEM Email Body Standard SUPREME
 *   • Mailto-No-Self-To Rule — Tom is sender on Tom-clicked Export → To: ''
 *   • Auto-Open Email Rule SUPREME (mailto: auto-opens Mail.app on fresh click)
 *   • Twin portability (pure functions; ports verbatim to Kai's industrial Twin)
 */

import { exportCopy, getLastClipboardResult } from './useExportShared'
import { useToast } from './useToast'

// ── Types — both info-panel schemas share this generic shape ────────────────

export interface InfoSection {
  emoji: string
  title: string
  body: string
  links: Array<{ label: string; url: string }>
}

export interface InfoPanelExportInput {
  kind: 'stage' | 'arrow'
  /** Bold headline (e.g. "Stage 5 · Refine Attributes"). */
  title: string
  /** Short italic tagline shown directly under the title. */
  tagline: string
  /** Short subject-line tail used to build the email subject. */
  subjectTail: string
  /** Footer ID — e.g. "Stage 5 of 11 · constraint". */
  footerId: string
  /** Section cards (History / Planguage / SEM Examples or Fun Fact). */
  sections: InfoSection[]
}

// ── HTML escape helper ──────────────────────────────────────────────────────

function esc(s: string | undefined | null): string {
  if (s == null) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Canonical Planguage section-tint palette — same hues as the in-panel cards.
const SECTION_BG: ReadonlyArray<{ bg: string; border: string }> = [
  { bg: '#fffbeb', border: '#fde68a' }, // amber-50 / amber-200
  { bg: '#f5f3ff', border: '#ddd6fe' }, // violet-50 / violet-200
  { bg: '#ecfdf5', border: '#a7f3d0' }, // emerald-50 / emerald-200
]

// ── Colourful HTML renderer (one-table-for-cohesion per r93aaa) ─────────────

export function buildInfoHtml(input: InfoPanelExportInput, exportedDate: string): string {
  const sectionRows = input.sections.map((section, idx) => {
    const palette = SECTION_BG[idx % SECTION_BG.length]
    const linkChips = section.links.map(link =>
      `<a href="${esc(link.url)}" style="display:inline-block;margin:2px 6px 2px 0;padding:2px 8px;background:#eef2ff;border:1px solid #c7d2fe;border-radius:9999px;color:#3730a3;font:600 11px/1.4 'Helvetica Neue',Arial,sans-serif;text-decoration:none;">↗ ${esc(link.label)}</a>`
    ).join('')
    return `
<tr><td bgcolor="${palette.bg}" style="background:${palette.bg};border:1px solid ${palette.border};padding:14px 18px;font:600 13px/1.4 'Helvetica Neue',Arial,sans-serif;color:#1f2937;">
  <span style="font-size:15px;">${esc(section.emoji)}</span>&nbsp;&nbsp;${esc(section.title)}
</td></tr>
<tr><td bgcolor="${palette.bg}" style="background:${palette.bg};border-left:1px solid ${palette.border};border-right:1px solid ${palette.border};padding:0 18px 10px 18px;font:400 13px/1.55 'Helvetica Neue',Arial,sans-serif;color:#374151;">
  ${esc(section.body)}
</td></tr>
${linkChips ? `<tr><td bgcolor="${palette.bg}" style="background:${palette.bg};border-left:1px solid ${palette.border};border-right:1px solid ${palette.border};border-bottom:1px solid ${palette.border};padding:0 14px 12px 14px;">${linkChips}</td></tr>` : ''}
<tr><td style="height:10px;line-height:10px;font-size:1px;">&nbsp;</td></tr>`
  }).join('')

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(input.title)}</title></head>
<body style="margin:0;padding:24px;background:#f8fafc;font-family:'Helvetica Neue',Arial,sans-serif;">
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:780px;margin:0 auto;border-collapse:collapse;">
  <tr><td bgcolor="#4338ca" style="background:#4338ca;padding:14px 22px 6px 22px;font:800 20px/1.3 'Helvetica Neue',Arial,sans-serif;color:#ffffff;letter-spacing:-0.01em;">
    ${esc(input.title)}
  </td></tr>
  <tr><td bgcolor="#4338ca" style="background:#4338ca;padding:0 22px 14px 22px;font:400 12px/1.5 'Helvetica Neue',Arial,sans-serif;color:#c7d2fe;font-style:italic;">
    ${esc(input.tagline)}
  </td></tr>
  <tr><td bgcolor="#3730a3" style="background:#3730a3;padding:6px 22px;font:600 10px/1.4 'Helvetica Neue',Arial,sans-serif;color:#a5b4fc;letter-spacing:0.15em;text-transform:uppercase;">
    ${esc(input.footerId)} · exported ${esc(exportedDate)}
  </td></tr>
  <tr><td style="height:14px;line-height:14px;font-size:1px;">&nbsp;</td></tr>
  ${sectionRows}
  <tr><td bgcolor="#f1f5f9" style="background:#f1f5f9;padding:12px 18px;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;color:#475569;border:1px solid #e2e8f0;border-radius:6px;">
    <strong style="color:#1e293b;">SEM App</strong> · <em>Stakes · Ends · Means → Planguage Specification</em> · For deeper Planguage consultation, the <strong>Tom Gilb Consultant Twin</strong> (by Kai Gilb) is the source: <a href="https://www.gilb.com/tomtwin" style="color:#4338ca;text-decoration:underline;">gilb.com/tomtwin</a>.
  </td></tr>
</table>
</body></html>`
}

// ── Plain-text renderer ─────────────────────────────────────────────────────

export function buildInfoPlain(input: InfoPanelExportInput, exportedDate: string): string {
  const lines: string[] = []
  lines.push(input.title)
  lines.push('─'.repeat(56))
  lines.push(input.tagline)
  lines.push('')
  lines.push(`${input.footerId} · exported ${exportedDate}`)
  lines.push('')
  for (const section of input.sections) {
    lines.push(`${section.emoji}  ${section.title.toUpperCase()}`)
    lines.push('')
    lines.push(section.body)
    lines.push('')
    if (section.links.length > 0) {
      for (const link of section.links) {
        lines.push(`  ↗ ${link.label}`)
        lines.push(`    ${link.url}`)
      }
      lines.push('')
    }
    lines.push('─'.repeat(56))
    lines.push('')
  }
  lines.push('SEM App · Stakes · Ends · Means → Planguage Specification')
  lines.push('Tom Gilb Consultant Twin (by Kai Gilb): https://www.gilb.com/tomtwin')
  return lines.join('\n')
}

// ── Today's date ────────────────────────────────────────────────────────────

function isoDate(): string {
  return new Date().toLocaleDateString('en-AU', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

// ── Channel handlers — ONE side-effect per user click ───────────────────────

/**
 * COPY channel — auto-fires when ExportSpecPin opens.  Writes colourful HTML +
 * plain to clipboard.  Toast confirms which flavour landed.
 */
export async function copyInfoPanel(input: InfoPanelExportInput): Promise<void> {
  const { showToast } = useToast()
  const date  = isoDate()
  const html  = buildInfoHtml (input, date)
  const plain = buildInfoPlain(input, date)
  await exportCopy(html, plain)
  const result = getLastClipboardResult()
  if (result === 'html+plain') {
    showToast(`📋 ${input.subjectTail} · colour HTML + plain on clipboard`, 4000)
  } else if (result === 'plain-fallback') {
    showToast(`📋 ${input.subjectTail} · plain text on clipboard (colour write failed — paste will be monochrome)`, 5000)
  } else {
    showToast(`✗ Clipboard write failed for ${input.subjectTail}`, 5000)
  }
}

/**
 * EMAIL channel — opens Mail.app on a fresh user click.  SEM Email Body Standard:
 * LOUD ⌘V cue + Exported date + separator + edit-prompt line.  To: empty per
 * Mailto-No-Self-To Rule (Tom is the sender on a Tom-clicked Export).
 *
 * Browsers (Safari especially) require this to be the PRIMARY side-effect of
 * the click — not chained after clipboard.write() and window.open().  Hence
 * the ExportSpecPin pattern: copy on first click, channel choice on second.
 */
export function emailInfoPanel(input: InfoPanelExportInput): void {
  const date = isoDate()
  const subject = input.kind === 'stage'
    ? `SEM ${input.subjectTail} — Stage info`
    : `SEM ${input.subjectTail} — Stage transition`
  const separator = '─'.repeat(56)
  const body = [
    'PASTE ⌘V (CMD+V) HERE FOR COLOR VERSION',
    `Exported: ${date}`,
    separator,
    '',
    '[Add a brief note here if you like — or just ⌘V to paste the colour version above the line.]',
  ].join('\n')
  // To: empty per Mailto-No-Self-To Rule.
  const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  window.location.href = mailto
  const { showToast } = useToast()
  showToast(`✉ Mail opening · press ⌘V in body for ${input.subjectTail} colour version`, 5500)
}

/**
 * DOWNLOAD channel — saves the colourful HTML as a .html file.  Fresh user
 * click → safe under browser download policies.
 */
export function downloadInfoPanel(input: InfoPanelExportInput): void {
  const date  = isoDate()
  const html  = buildInfoHtml(input, date)
  const safeName = input.subjectTail.replace(/[^\w\d-]+/g, '_').slice(0, 60)
  const filename = `SEM-${input.kind === 'stage' ? 'Stage' : 'Arrow'}-${safeName}.html`
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  const { showToast } = useToast()
  showToast(`⬇ Saved ${filename} to Downloads`, 4000)
}

/**
 * MESSAGE channel — opens Messages.app via sms: URL with the plain-text
 * version pre-filled.  iMessage / SMS picks up.  No To: per the same rule.
 */
export function messageInfoPanel(input: InfoPanelExportInput): void {
  const date = isoDate()
  const plain = buildInfoPlain(input, date)
  // sms:&body=... is the Apple-supported form for empty-To pre-filled body.
  const sms = `sms:&body=${encodeURIComponent(plain.slice(0, 1500))}`
  window.location.href = sms
  const { showToast } = useToast()
  showToast(`💬 Messages opening · ${input.subjectTail} text pre-filled`, 4500)
}

/**
 * COPY-FOR-CHAT channel — writes PLAIN text only to clipboard.  Best for
 * pasting into Claude / ChatGPT / Twin Consultant.
 */
export async function copyForChatInfoPanel(input: InfoPanelExportInput): Promise<void> {
  const date  = isoDate()
  const plain = buildInfoPlain(input, date)
  try {
    await navigator.clipboard.writeText(plain)
    const { showToast } = useToast()
    showToast(`📋 ${input.subjectTail} plain text on clipboard · paste into Claude / ChatGPT / Twin`, 5000)
  } catch (err) {
    const { showToast } = useToast()
    showToast(`✗ Copy failed: ${String(err).slice(0, 80)}`, 4500)
  }
}
