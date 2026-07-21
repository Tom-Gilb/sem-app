// UNIT_TYPE=Composable
//
// useUniversalSharpExport — generic Copy + Email exporter for ANY sharpening
// panel that holds question/answer state.
//
// Tom Gilb 2026-06-22 verbatim: "All sharpening answers must be exportable".
//
// Five SEM App sharpening panels lacked export (before r41 v283):
//   - SolutionSharpenPanel.vue
//   - ElonSharpeningPanel.vue
//   - EvoSharpInterview.vue
//   - IncorruptibleSharpeningPanel.vue
//   - ParseImpliedSharpeningPanel.vue
//
// Each panel has its own native answer-state shape (Map / Record / array).
// This helper takes a UNIVERSAL export model (sections of Q&A pairs) so each
// panel just transforms its state into that shape + calls copyUniversalSharp
// or emailUniversalSharp.
//
// Composes with:
//   - Export-button-on-all-windows SUPREME rule
//   - Colorful HTML Spec Email Rule SUPREME (colored HTML body + clipboard)
//   - Auto-Open Email Rule SUPREME (mailto: opens Mail.app + clipboard carries colorful body)
//   - SEM Email Body Standard (LOUD ⌘V cue + date + separator)

import { useToast } from './useToast'

/** One section of a sharpening export — a category of Q&A pairs. */
export interface UniversalSharpSection {
  /** Section headline — e.g. "Foundation" / "Mission Drive" / "Step 1.2 Adoption" */
  headline:  string
  /** Section accent color (hex or named). Falls back to slate. */
  color?:    string
  /** Optional subtitle / longer descriptor for the section. */
  subtitle?: string
  /** Q&A items within this section. Items with empty answer rendered as "(not answered)". */
  items:     UniversalSharpItem[]
}

/** One suggested-answer option with tick state — for fully-auditable export. */
export interface UniversalSharpSuggestion {
  /** The suggestion text the planner could tick. */
  text:   string
  /** Whether the planner ticked it. */
  ticked: boolean
  /** Optional provenance tag (e.g. "Plan-derived" / "Gilb · CE Ch.5" / "Template"). */
  source?: string
}

/** One Q&A pair within a section.  Tom Gilb 2026-06-22: "Sharpening export
 *  needs to include all answers, tick or written or not" — every question is
 *  rendered even when no answer was given, with ALL suggestions shown so a
 *  reviewer sees what was OFFERED + what was CHOSEN + what was WRITTEN. */
export interface UniversalSharpItem {
  /** The question text. */
  question: string
  /** The planner's free-text answer (may be empty). */
  typed?:   string
  /** All suggested answers (with tick state) — empty array OK. */
  suggestions?: UniversalSharpSuggestion[]
  /** LEGACY: pre-built single answer string.  Kept for backward-compat with
   *  v283 callers; use `typed` + `suggestions` for full auditability. */
  answer?:  string
  /** Optional rationale / longer explanation. */
  rationale?: string
  /** Optional source attribution (e.g. "AI suggestion" / "Ries Ch.8 p.114"). */
  source?:  string
}

/** The full export model. */
export interface UniversalSharpExportInput {
  /** Panel name — e.g. "Solution Sharpening" / "Elon Sharpening" / "Incorruptible Sharpening" */
  panelName: string
  /** Plan name from the active spec — e.g. "Indianapolis Cruiser" */
  planName:  string
  /** Optional plan version — e.g. "v0.1" */
  planVersion?: string
  /** Optional panel-level subtitle / description. */
  subtitle?: string
  /** The sections of Q&A pairs to export. */
  sections:  UniversalSharpSection[]
}

// HTML escape utility (mirrors the pattern in useColorfulSpecHtml.ts).
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Render the universal-sharp export as colorful HTML (one-outer-table per
 *  r93aaa "info-note" rule — pastes as ONE cohesive document into Mail.app,
 *  Notes, Keynote etc.).  Per SEM Email Body Standard, callers pre-pend the
 *  LOUD ⌘V cue in the email body. */
export function renderUniversalSharpHtml(input: UniversalSharpExportInput): string {
  const now      = new Date()
  const date     = now.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
  const time     = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const versTxt  = input.planVersion ? ` ${esc(input.planVersion)}` : ''

  // Outer header — colored band naming the panel + plan + date
  const headerBg = '#0f172a'    // slate-900 — neutral dark
  const headerTxt = '#ffffff'
  let html = '<table style="border-collapse:collapse;font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;width:100%;max-width:780px;margin:0 auto;">'

  // Title row
  html += `<tr><td colspan="2" bgcolor="${headerBg}" style="background:${headerBg};color:${headerTxt};font-size:11px;letter-spacing:0.18em;text-transform:uppercase;font-weight:600;padding:14px 22px 6px 22px;line-height:1.5;">SEM App · Sharpening Export</td></tr>`
  html += `<tr><td colspan="2" bgcolor="${headerBg}" style="background:${headerBg};color:${headerTxt};font-size:20px;font-weight:800;padding:0 22px 6px 22px;line-height:1.3;">${esc(input.panelName)}</td></tr>`
  html += `<tr><td colspan="2" bgcolor="${headerBg}" style="background:${headerBg};color:${headerTxt};font-size:13px;font-weight:500;padding:0 22px 6px 22px;line-height:1.4;">${esc(input.planName)}${versTxt}</td></tr>`
  if (input.subtitle) {
    html += `<tr><td colspan="2" bgcolor="${headerBg}" style="background:${headerBg};color:#cbd5e1;font-size:11px;padding:0 22px 6px 22px;line-height:1.4;">${esc(input.subtitle)}</td></tr>`
  }
  html += `<tr><td colspan="2" bgcolor="${headerBg}" style="background:${headerBg};color:#94a3b8;font-size:11px;padding:0 22px 14px 22px;line-height:1.4;">${esc(date)} · ${esc(time)} · ${input.sections.reduce((n, s) => n + s.items.length, 0)} questions across ${input.sections.length} ${input.sections.length === 1 ? 'category' : 'categories'} — every question shown, ticked / typed / unanswered alike</td></tr>`

  // One row per section
  for (const section of input.sections) {
    const color = section.color || '#475569' // slate-600 default
    // Section header
    html += `<tr><td colspan="2" bgcolor="${color}" style="background:${color};color:#ffffff;font-size:13px;font-weight:700;padding:10px 18px;letter-spacing:0.03em;">${esc(section.headline)}<span style="font-weight:400;opacity:0.85;"> &nbsp; · &nbsp; ${section.items.length} ${section.items.length === 1 ? 'answer' : 'answers'}</span></td></tr>`
    if (section.subtitle) {
      html += `<tr><td colspan="2" style="background:#f8fafc;color:#64748b;font-size:11px;padding:6px 18px;font-style:italic;">${esc(section.subtitle)}</td></tr>`
    }
    // Items — r41 v284 (Tom Gilb 2026-06-22 "Sharpening export needs to include
    // all answers, tick or written or not") — every question rendered with FULL
    // audit: typed text + ALL suggestions (each marked ✓ ticked / ◯ not ticked) +
    // explicit "(no answer)" marker when neither typed nor any tick.  Legacy
    // `answer` field still honored if `typed` + `suggestions` are absent.
    for (const item of section.items) {
      const typed       = (item.typed ?? '').trim()
      const suggestions = item.suggestions ?? []
      const legacyAnswer = (item.answer ?? '').trim()
      const tickedCount = suggestions.filter(s => s.ticked).length
      const hasAnswer   = typed.length > 0 || tickedCount > 0 || legacyAnswer.length > 0
      html += `<tr>`
      html += `<td style="width:42%;background:#f1f5f9;color:#334155;font-size:12px;font-weight:600;padding:8px 14px 8px 18px;border-bottom:1px solid #e2e8f0;vertical-align:top;line-height:1.45;">${esc(item.question)}</td>`
      html += `<td style="background:#ffffff;font-size:12px;padding:8px 18px 8px 14px;border-bottom:1px solid #e2e8f0;vertical-align:top;line-height:1.45;color:#0f172a;">`
      // Block 1: typed answer (or legacy single answer)
      if (typed) {
        html += `<div style="margin-bottom:4px;"><span style="color:#64748b;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Typed:</span> ${esc(typed)}</div>`
      } else if (legacyAnswer && suggestions.length === 0) {
        html += `<div style="margin-bottom:4px;">${esc(legacyAnswer)}</div>`
      }
      // Block 2: ALL suggestions with tick status
      if (suggestions.length > 0) {
        html += `<div style="margin:4px 0;"><span style="color:#64748b;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Suggested answers:</span></div>`
        html += `<ul style="margin:0 0 4px 0;padding:0;list-style:none;">`
        for (const s of suggestions) {
          const mark = s.ticked ? '<span style="color:#059669;font-weight:700;">✓</span>' : '<span style="color:#cbd5e1;">◯</span>'
          const wt   = s.ticked ? 'font-weight:600;color:#0f172a;' : 'color:#64748b;'
          html += `<li style="margin:2px 0;padding:1px 0;${wt}">${mark} ${esc(s.text)}`
          if (s.source) {
            html += ` <span style="color:#94a3b8;font-size:10px;">← ${esc(s.source)}</span>`
          }
          html += `</li>`
        }
        html += `</ul>`
      }
      // Block 3: not-answered marker
      if (!hasAnswer) {
        html += `<div style="color:#cbd5e1;font-style:italic;font-size:11px;">(no answer)</div>`
      }
      // Block 4: rationale + source
      if (item.rationale && item.rationale.trim()) {
        html += `<div style="margin-top:4px;color:#64748b;font-size:11px;font-style:italic;">${esc(item.rationale)}</div>`
      }
      if (item.source && item.source.trim()) {
        html += `<div style="margin-top:3px;color:#94a3b8;font-size:10px;">← ${esc(item.source)}</div>`
      }
      html += `</td>`
      html += `</tr>`
    }
  }

  // Footer
  html += `<tr><td colspan="2" style="background:#f1f5f9;color:#64748b;font-size:10px;padding:10px 18px;text-align:center;font-style:italic;line-height:1.5;">SEM App — Sharpening export.  Question/answer pairs captured at ${esc(time)} on ${esc(date)}.</td></tr>`

  html += '</table>'
  return html
}

/** Render the same export as plain text (for clipboard fallback + plaintext
 *  email recipients). */
export function renderUniversalSharpPlain(input: UniversalSharpExportInput): string {
  const now = new Date()
  const ts = `${now.toISOString().slice(0, 10)} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const versTxt = input.planVersion ? ` ${input.planVersion}` : ''
  const lines: string[] = []
  lines.push(`SEM App — ${input.panelName}`)
  lines.push(`${input.planName}${versTxt}`)
  if (input.subtitle) lines.push(input.subtitle)
  lines.push(`Exported: ${ts}`)
  lines.push('')
  for (const section of input.sections) {
    lines.push(`══ ${section.headline} ${'═'.repeat(Math.max(0, 60 - section.headline.length))}`)
    if (section.subtitle) lines.push(`   ${section.subtitle}`)
    lines.push('')
    for (const item of section.items) {
      const typed = (item.typed ?? '').trim()
      const suggestions = item.suggestions ?? []
      const legacyAnswer = (item.answer ?? '').trim()
      const tickedCount = suggestions.filter(s => s.ticked).length
      const hasAnswer = typed.length > 0 || tickedCount > 0 || legacyAnswer.length > 0
      lines.push(`Q: ${item.question}`)
      if (typed) lines.push(`   Typed: ${typed}`)
      else if (legacyAnswer && suggestions.length === 0) lines.push(`   A: ${legacyAnswer}`)
      if (suggestions.length > 0) {
        lines.push(`   Suggested answers:`)
        for (const s of suggestions) {
          const mark = s.ticked ? '✓' : '◯'
          const src  = s.source ? ` ← ${s.source}` : ''
          lines.push(`     ${mark} ${s.text}${src}`)
        }
      }
      if (!hasAnswer) lines.push(`   (no answer)`)
      if (item.rationale?.trim()) lines.push(`   Rationale: ${item.rationale}`)
      if (item.source?.trim())    lines.push(`   ← ${item.source}`)
      lines.push('')
    }
  }
  return lines.join('\n')
}

/** Copy the export to clipboard (text/html + text/plain ClipboardItem with
 *  plain fallback).  Shows a notification on success/failure via useToast. */
export async function copyUniversalSharp(input: UniversalSharpExportInput): Promise<void> {
  const html  = renderUniversalSharpHtml(input)
  const plain = renderUniversalSharpPlain(input)
  const { showToast } = useToast()
  try {
    await navigator.clipboard.write([new ClipboardItem({
      'text/html':  new Blob([html],  { type: 'text/html'  }),
      'text/plain': new Blob([plain], { type: 'text/plain' }),
    })])
    showToast(`✓ ${input.panelName} copied — ${input.sections.reduce((n, s) => n + s.items.length, 0)} Q&A pairs across ${input.sections.length} categories. Paste with ⌘V.`, 20000)
  } catch {
    try {
      await navigator.clipboard.writeText(plain)
      showToast(`✓ ${input.panelName} copied (plain text — HTML clipboard denied). Paste with ⌘V.`, 20000)
    } catch (err) {
      showToast(`Copy failed: ${err instanceof Error ? err.message : String(err)}`, 8000)
    }
  }
}

/** Email the export — opens Mail.app per the Auto-Open Email Rule SUPREME.
 *  Per the Mailto-No-Self-To rule (Tom Gilb 2026-06-16: "EMAIL SHARPENING YOU
 *  PUT THE MAIN IN THE TO SECTION, SILLY BOY"), To: is EMPTY — Tom is the
 *  sender, recipient is someone else he chooses.  Colorful HTML is also
 *  copied to the clipboard so ⌘V in the Mail compose pastes the rich body. */
export async function emailUniversalSharp(input: UniversalSharpExportInput): Promise<void> {
  const html  = renderUniversalSharpHtml(input)
  const plain = renderUniversalSharpPlain(input)
  const { showToast } = useToast()
  // Put colorful HTML on clipboard so the user can ⌘V it into Mail
  try {
    await navigator.clipboard.write([new ClipboardItem({
      'text/html':  new Blob([html],  { type: 'text/html'  }),
      'text/plain': new Blob([plain], { type: 'text/plain' }),
    })])
  } catch { /* plain-text fallback handled by caller pasting */ }

  // mailto: with SEM Email Body Standard
  const now = new Date()
  const ts  = now.toISOString().slice(0, 10)
  const subject = `${input.panelName} — ${input.planName} · ${ts}`
  const body =
    `PASTE ⌘V (CMD+V) HERE FOR COLOR VERSION\n` +
    `Exported: ${ts}\n` +
    `────────────────────────────────────────────────────────\n\n` +
    `[Add a brief note here if you like — or just ⌘V to paste the colour version above the line.]`
  // To: is EMPTY (per Mailto-No-Self-To SUPREME)
  const href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  try {
    window.location.href = href
    showToast(`📧 Mail opening — press ⌘V to paste the colourful ${input.panelName} Q&A above the line, then Send.`, 20000)
  } catch (err) {
    showToast(`Email open failed: ${err instanceof Error ? err.message : String(err)}`, 8000)
  }
}
