/**
 * useExportShared.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared infrastructure for the "Export button on all windows" rule
 * (Tom Gilb 2026-06-06). Every substantial SEM App panel exposes an Export
 * button — this composable handles the common plumbing so each panel only
 * needs to provide the per-artefact HTML + plain-text rendering.
 *
 * What it does in one call:
 *   1. Writes dual-MIME (HTML + plain) to the clipboard via ClipboardItem.
 *   2. Opens a preview window with 100% of the model immediately
 *      (`window.open('', '_blank', 'width=1100,height=820,scrollbars=yes')`)
 *      — this is Tom's "27 % of the model" cure.
 *   3. Auto-opens Mail addressed to Tom@Gilb.com with subject + SEM Email
 *      Body Standard plain body (LOUD ⌘V cue + Exported date + separator).
 *   4. Toasts confirmation.
 *
 * Composes with:
 *   • Export Button on All Windows Rule (memory)
 *   • Colorful HTML Spec Email Rule (SUPREME)
 *   • SEM Email Body Standard (SUPREME)
 *   • Claudian-Generated Emails Rule (To: Tom@Gilb.com)
 *   • Auto-Open Email Rule (SUPREME)
 */

import { useToast } from './useToast'

const MAX_MAILTO_BODY = 7000 // safe under Safari's ~8 KB mailto: ceiling

export interface ExportArtefactInput {
  /** Full colourful HTML document — opens in preview window, also clipboard. */
  htmlText: string
  /** Plain-text fallback — clipboard + mailto: body. */
  plainText: string
  /** Subject line for the email — short, concrete, not generic. */
  subject: string
  /** Display name for the artefact (for the toast). e.g. "OPTIMA", "Impact Table". */
  artefactName: string
  /** Recipient email — defaults to Tom@Gilb.com per the Claudian-Generated Emails Rule. */
  to?: string
}

/**
 * Shared export handler. Each panel calls this with its HTML + plain text.
 * Returns nothing — side effects only (clipboard, preview window, mailto, toast).
 */
export async function exportArtefact(input: ExportArtefactInput): Promise<void> {
  const { showToast } = useToast()
  const recipient = input.to ?? 'Tom@Gilb.com'

  try {
    // ── 1. SEM Email Body Standard — LOUD cue + stamp + separator + content ──
    const isoDate = new Date().toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    const separator = '─'.repeat(56)
    const mailBody = [
      'PASTE ⌘V (CMD+V) HERE FOR COLOR VERSION',
      `Exported: ${isoDate}`,
      separator,
      '',
      input.plainText,
    ].join('\n')

    // ── 2. Clipboard write (dual-MIME) ──────────────────────────────────────
    let clipboardOK = false
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html':  new Blob([input.htmlText],  { type: 'text/html'  }),
            'text/plain': new Blob([input.plainText], { type: 'text/plain' }),
          }),
        ])
        clipboardOK = true
      } catch (err) {
        console.warn(`[${input.artefactName} export] clipboard.write failed — falling back`, err)
      }
    }
    if (!clipboardOK) {
      try {
        await navigator.clipboard.writeText(input.plainText)
        clipboardOK = true
      } catch (err) {
        console.warn(`[${input.artefactName} export] clipboard.writeText also failed`, err)
      }
    }

    // ── 3. Preview window with 100% of the model ────────────────────────────
    let previewOK = false
    try {
      const w = window.open('', '_blank', 'width=1100,height=820,scrollbars=yes')
      if (w) {
        w.document.open()
        w.document.write(input.htmlText)
        w.document.close()
        previewOK = true
      }
    } catch (err) {
      console.warn(`[${input.artefactName} export] preview window failed`, err)
    }

    // ── 4. mailto: with truncation safety ───────────────────────────────────
    let mailtoBody = mailBody
    while (
      encodeURIComponent(mailtoBody).length > MAX_MAILTO_BODY &&
      mailtoBody.length > 200
    ) {
      mailtoBody =
        mailtoBody.slice(0, Math.max(200, mailtoBody.length - 500)) +
        '\n\n…[plain-text truncated to fit mailto: limit — press ⌘V above for the full colour version]'
    }
    const mailto = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(input.subject)}&body=${encodeURIComponent(mailtoBody)}`
    try {
      window.location.href = mailto
    } catch (err) {
      console.warn(`[${input.artefactName} export] mailto: open failed`, err)
    }

    // ── 5. Toast ────────────────────────────────────────────────────────────
    const fragments: string[] = []
    fragments.push(`⬇ ${input.artefactName} exported`)
    if (previewOK)   fragments.push('preview window open')
    if (clipboardOK) fragments.push('clipboard ready')
    fragments.push('Mail opening')
    fragments.push('press ⌘V in body for colour version')
    showToast(fragments.join(' · '), 6500)
  } catch (err) {
    console.error(`[${input.artefactName} export] unexpected failure`, err)
    showToast(`${input.artefactName} export failed: ${String(err).slice(0, 90)}`, 5000)
  }
}

// ── Shared HTML primitives ──────────────────────────────────────────────────

/** Escape user-controlled strings for HTML safety. */
export function htmlEsc(s: string | undefined | null): string {
  if (s == null) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Soft-wrap long strings at word boundaries — emit one line per row so Keynote
 * does not clip descenders (the recurring r43 / r46 lesson).
 */
export function softWrap(text: string, maxChars: number): string[] {
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

/**
 * Canonical Planguage Glossary footnote for the bottom of every exported
 * artefact. Static HTML cannot hover — so the definitions get embedded.
 * Mirrors PLANGUAGE_TERMS but flattened to HTML for embedding.
 */
export function planguageGlossaryFootnoteHtml(): string {
  return `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:14px 0 0 0;border-collapse:collapse;border:1px solid #cbd5e1;">
  <tr><td bgcolor="#475569" style="background:#475569;color:#ffffff;padding:8px 18px;font:700 10px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">Planguage Glossary · canonical definitions</td></tr>
  <tr><td bgcolor="#fef3c7" style="background:#fef3c7;color:#78350f;padding:6px 18px;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;"><b>Tolerable &gt;&gt;</b> (*539) — Project-viability threshold. Minimum non-failure level. Below it the WHOLE project fails. Tolerable is a Scalar <b>Constraint</b>. You MEET a Constraint by staying on the acceptable side.</td></tr>
  <tr><td bgcolor="#d1fae5" style="background:#d1fae5;color:#065f46;padding:6px 18px;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;"><b>Goal &gt;</b> (*109) — Committed promise. The level the project commits to deliver, negotiated against competing stakeholders and resources. A Goal is a <b>Target</b>. You MEET a Target by reaching the level.</td></tr>
  <tr><td bgcolor="#ede9fe" style="background:#ede9fe;color:#5b21b6;padding:6px 18px;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;"><b>Wish &gt;?</b> (*244) — Stakeholder dream, uncommitted. Complete satisfaction level. Independent of cost and physics. Wish is a <b>Target</b> (uncommitted).</td></tr>
  <tr><td bgcolor="#e0e7ff" style="background:#e0e7ff;color:#312e81;padding:6px 18px;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;"><b>Percentage Impact %.→</b> (*306) — IET relative scale: 0% = at Past/benchmark, 100% = target reached. Convertible to native units like Celsius/Fahrenheit. See the IET chapter in <i>Competitive Engineering</i> (Tom Gilb).</td></tr>
  <tr><td bgcolor="#f1f5f9" style="background:#f1f5f9;color:#334155;padding:6px 18px;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;"><b>Ambition @.∑</b> (*423) — Informal one-sentence summary ("much better security"). VAGUE — cannot be MET. The management-BS pattern Planguage exists to escape by quantifying Constraints and Targets.</td></tr>
</table>`
}

/**
 * Wrap a body of HTML sections in a full HTML5 document with the SEM App
 * standard wrapper — used by every panel's renderXxxHtml function so they
 * all produce a consistent shell.
 */
export function htmlDocumentShell(args: {
  title: string
  bodyHtml: string
  /** Optional extra footer (after the Glossary footnote). */
  footerHtml?: string
}): string {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" /><title>${htmlEsc(args.title)}</title></head>
<body style="margin:0;padding:18px;background:#f9fafb;font-family:'Helvetica Neue',Arial,sans-serif;">
${args.bodyHtml}
${planguageGlossaryFootnoteHtml()}
${args.footerHtml ?? ''}
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:14px 0 0 0;border-collapse:collapse;">
  <tr><td bgcolor="#1e1b4b" style="background:#1e1b4b;color:#a5b4fc;padding:6px 18px;font:500 9px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.08em;">SEM App · ${htmlEsc(args.title)}</td></tr>
</table>
</body></html>`
}

/**
 * Render a coloured section header bar — gradient via bgcolor= (Keynote-safe).
 */
export function sectionHeaderHtml(label: string, bgHex: string): string {
  return `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 8px 0;border-collapse:collapse;"><tr><td bgcolor="${bgHex}" style="background:${bgHex};color:#ffffff;padding:10px 18px;font:700 11px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">${htmlEsc(label)}</td></tr></table>`
}
