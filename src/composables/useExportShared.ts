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
import { showExportEmailBanner } from './useExportBanner'

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

// ── Three-button export primitives ──────────────────────────────────────────
//
// Tom Gilb 2026-06-06: "this design applies for all export in sem."
//
// Every export surface in the SEM App exposes exactly THREE actions:
//   1. Copy   — exportCopy(html, plain)          copies to clipboard, returns success
//   2. Email  — exportEmail(html, subject, label) copies + shows ⌘V banner + opens Mail
//   3. Download — exportDownload(html, filename)  saves as .html file
//
// Replace any existing Copy+Email or Copy-only pattern with these three.
// The ⌘V banner (showExportEmailBanner) is rendered once in App.vue via useExportBanner.

/** Outcome of a clipboard write so callers can surface the truth to the user. */
export type ClipboardWriteResult =
  | 'html+plain'       // dual-MIME wrote successfully → paste-as-HTML works
  | 'plain-fallback'   // HTML write FAILED, plain-only written → paste loses colour
  | 'failed'           // nothing on clipboard

/** Last clipboard write result, queryable by callers for honest UI feedback. */
let _lastClipboardResult: ClipboardWriteResult = 'failed'
export function getLastClipboardResult(): ClipboardWriteResult { return _lastClipboardResult }

/**
 * Copy colourful HTML + plain-text fallback to clipboard.
 * Returns true if SOMETHING was written; check `getLastClipboardResult()` to
 * see which flavour landed.
 *
 * r41 v81 (Tom Gilb 2026-06-16 verbatim "and where is my html color paste?????")
 * — the previous implementation swallowed the HTML-write error with a silent
 * `catch {}` and fell through to plain-text fallback, leaving Tom mystified
 * for hours about why paste was monochrome.  Now: every clipboard error is
 * console.error'd with the real reason (NotAllowedError / DataError / etc.)
 * AND the function records its outcome via `_lastClipboardResult` so callers
 * can show a HONEST toast — "Colour HTML written" vs "Colour write failed,
 * plain text only".  No more silent failures.
 */
export async function exportCopy(html: string, plainText: string): Promise<boolean> {
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html':  new Blob([html],      { type: 'text/html'  }),
          'text/plain': new Blob([plainText], { type: 'text/plain' }),
        }),
      ])
      _lastClipboardResult = 'html+plain'
      console.info('[exportCopy] ✓ HTML+plain written to clipboard · html size:', html.length, '· plain size:', plainText.length)
      return true
    } catch (htmlErr) {
      // LOUD — this is the bug Tom couldn't see for hours.
      console.error('[exportCopy] ✗ HTML clipboard write FAILED — falling back to plain text only.  Reason:', htmlErr, '· Common causes: (1) document not focused at write-time, (2) Safari permissions, (3) HTML too large.  HTML size:', html.length)
    }
  } else {
    console.warn('[exportCopy] ClipboardItem unavailable — plain-text-only fallback. (Old browser? Insecure context?)')
  }
  try {
    await navigator.clipboard.writeText(plainText)
    _lastClipboardResult = 'plain-fallback'
    console.info('[exportCopy] ✓ Plain-text fallback written.  Colour version NOT on clipboard.')
    return true
  } catch (plainErr) {
    _lastClipboardResult = 'failed'
    console.error('[exportCopy] ✗ Plain-text write ALSO failed — clipboard is empty.  Reason:', plainErr)
    return false
  }
}

/**
 * Email — copies colourful HTML to clipboard, shows the unmissable ⌘V banner
 * in the SEM App, then opens Mail via mailto: after 400 ms.
 *
 * Implements the Auto-Open Email Rule (SUPREME, CLAUDE.md):
 *   Auto-open Mail BEATS zero-paste. The mailto: URL auto-opens Mail.app;
 *   the ⌘V paste lands the colour version — total cost = one keystroke.
 *   .eml download is RETIRED (silently fails in Tom's browser config).
 *
 * Body follows the SEM Email Body Standard (CLAUDE.md):
 *   Line 1: PASTE ⌘V (CMD+V) HERE FOR COLOR VERSION  ← LOUD, always visible
 *   Line 2: Exported: YYYY-MM-DD
 *   Line 3: separator
 *   Line 4+: full plain-text content (truncated to fit mailto: ~7 KB ceiling)
 *
 * @param html       Full colourful HTML — goes to clipboard only (⌘V source).
 * @param subject    Email subject line.
 * @param label      What is on the clipboard — shown in the ⌘V banner.
 * @param to         Recipient (comma-separated for multiple) — defaults to Tom@Gilb.com.
 * @param plainText  Optional full plain-text body to embed inline after the separator.
 *                   If omitted, only the paste cue + date land in the body.
 */
export async function exportEmail(
  html: string,
  subject: string,
  label = 'colourful HTML',
  to = 'Tom@Gilb.com',
  plainText?: string,
): Promise<void> {
  // 1. Copy colourful HTML to clipboard FIRST so it is ready before Mail takes focus.
  //    r41 v94 (Tom Gilb 2026-06-16 "Planguage Spec HTML — paste via ⌘V in Mail")
  //    — when callers forget to pass plainText, derive a plain-text fallback
  //    by STRIPPING tags from the HTML so the clipboard plain channel still
  //    carries real content.  Previously the fallback was the bare placeholder
  //    string `${label} — paste via ⌘V in Mail`, which is what landed if the
  //    recipient pasted into Notes / Slack non-rich / terminal / search field.
  //    No-Silent-Data-Loss SUPREME — every clipboard write must carry real
  //    content, not an instructional placeholder.
  const fallbackPlain = plainText ?? htmlToPlainText(html)
  await exportCopy(html, fallbackPlain)

  // 2. Show the unmissable ⌘V banner BEFORE Mail steals the window.
  showExportEmailBanner(label)

  // 3. Build mailto body per SEM Email Body Standard (r93nn amendment 2026-06-11).
  //    Tom Gilb verbatim: "Remove the md text in the email (it is duplicate). WE need
  //    the reminder to Paste, and possibly edit it."
  //    Body is now JUST the LOUD paste cue + date + separator + blank space for the
  //    user to paste into and optionally add a brief note before/after. The full plain
  //    text is NOT included — once the user ⌘V the colourful HTML, the markdown would
  //    be a duplicate of the same content. The full plainText still goes on the
  //    clipboard via exportCopy at step 1, so ⌘V always works.
  //    Trade-off accepted by Tom: if recipient cannot render HTML (corporate filter /
  //    ancient client), the email body is the LOUD cue alone — they must request the
  //    HTML separately. Worth it to avoid duplicate content.
  const date    = new Date().toISOString().slice(0, 10)
  const SEP     = '─'.repeat(56)
  const HEADER  = `PASTE ⌘V (CMD+V) HERE FOR COLOR VERSION\nExported: ${date}\n${SEP}\n\n`
  const EDIT_SPACE = '\n\n[Add a brief note here if you like — or just ⌘V to paste the colour version above the line.]\n'
  // Note: plainText IS still used at step 1 above (clipboard plain-text fallback for
  // recipients that strip HTML). It is intentionally NOT embedded in the mailto body
  // per the r93nn amendment — that would duplicate the colour version after paste.
  const body = HEADER + EDIT_SPACE

  // 4. Open Mail after 400 ms so the banner renders first and clipboard settles.
  setTimeout(() => {
    window.location.href =
      `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }, 400)
}

/**
 * Download — saves the colourful HTML as a standalone .html file.
 * @param html      Full HTML document.
 * @param filename  Desired file name (with or without .html extension).
 */
export function exportDownload(html: string, filename: string): void {
  const name = filename.endsWith('.html') ? filename : `${filename}.html`
  const blob  = new Blob([html], { type: 'text/html' })
  const a     = document.createElement('a')
  a.href      = URL.createObjectURL(blob)
  a.download  = name
  a.click()
  URL.revokeObjectURL(a.href)
}

// ── Shared HTML primitives ──────────────────────────────────────────────────

/** Escape user-controlled strings for HTML safety. */
/**
 * r41 v94 (Tom Gilb 2026-06-16) — best-effort HTML→plain-text degrader for
 * the clipboard plain-text fallback when a caller forgets to pass plainText
 * to exportEmail()/exportCopy().  Strips tags, decodes the common entities,
 * collapses whitespace.  Output is "real content, badly formatted" rather
 * than a "${label} — paste via ⌘V in Mail" placeholder.  Composes with
 * No-Silent-Data-Loss SUPREME.  Not a full HTML parser — fine for the
 * SEM-shaped table HTML the renderers produce.
 */
export function htmlToPlainText(html: string): string {
  if (!html || typeof html !== 'string') return ''
  // Drop entire <style> + <script> blocks
  let s = html.replace(/<style[\s\S]*?<\/style>/gi, '')
              .replace(/<script[\s\S]*?<\/script>/gi, '')
  // Block-level closers become newlines so paragraphs stay separable
  s = s.replace(/<\/(tr|p|div|li|h[1-6]|table|thead|tbody|section)>/gi, '\n')
       .replace(/<br\s*\/?>/gi, '\n')
       .replace(/<\/td>/gi, '\t')
  // Strip all remaining tags
  s = s.replace(/<[^>]+>/g, '')
  // Decode the common entities
  s = s.replace(/&nbsp;/gi, ' ')
       .replace(/&amp;/gi, '&')
       .replace(/&lt;/gi, '<')
       .replace(/&gt;/gi, '>')
       .replace(/&quot;/gi, '"')
       .replace(/&#39;/gi, "'")
       .replace(/&larr;/gi, '←')
       .replace(/&middot;/gi, '·')
  // Collapse whitespace
  s = s.replace(/[ \t]+/g, ' ')
       .replace(/\n\s*\n\s*\n+/g, '\n\n')
       .trim()
  return s
}

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
