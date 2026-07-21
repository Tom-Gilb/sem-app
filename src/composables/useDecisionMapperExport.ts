/**
 * useDecisionMapperExport.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Decisions Agent (Decision Mapper) colourful HTML export.
 *
 * Tom Gilb 2026-06-06 SUPREME rule "Export Button on All Windows":
 *   every substantial SEM App window MUST expose an Export button that (1) builds
 *   a single full-model colourful HTML document, (2) opens a preview window with
 *   100 % of the model immediately, (3) puts HTML + plain on the clipboard,
 *   (4) auto-opens Mail per SEM Email Body Standard with LOUD ⌘V cue, (5) embeds
 *   canonical Planguage Glossary footnote, (6) shows confirmation notification.
 *
 * Mailto-No-Self-To SUPREME (Tom Gilb 2026-06-16): Tom is the SENDER; the
 * To: header MUST be empty.  Caller passes `to: ''` to exportArtefact().
 *
 * Architecture (mirrors useEvoStepsExport / useGoalLadderExport / useResourcesSharpenExport):
 *   • ONE outer wrapper → sub-tables per section (header, summary, matrix card,
 *     per-option cards, planguage model card, recommendation, comparison if
 *     present, glossary footnote, velocity footer).
 *   • Inline styles + bgcolor= attrs everywhere — Keynote / Mail / Notes safe.
 *   • NO nested <table> inside <td> (Keynote splits nested tables).  All sibling
 *     top-level tables for cohesion.
 *   • Soft-wrap long strings every ~64 chars onto separate <tr> rows so Keynote
 *     does not clip descenders (r43 lesson).
 *   • Rose + violet palette (Decisions canonical) with sky chips for options.
 *     R-G colorblind-safe per DD-017 — coloured text always on white background,
 *     never green text on dark and never red text on dark.
 *
 * Composes with:
 *   • Export Button on All Windows Rule (SUPREME)
 *   • Colorful HTML Spec Email Rule (SUPREME)
 *   • Mailto-No-Self-To Rule (SUPREME — caller passes to:'')
 *   • Planguage Glossary Definitions in Tools rule (footer)
 *   • Stages-are-Cyclic + Stage-Has-a-Purpose (Velocity-of-Learning quote in footer)
 *   • Spell-out-Type-Names (Function / Value / Constraint / Solution / Resource)
 *   • DD-017 colorblind-safe contrast
 *   • Twin portability (pure renderer, no Vue reactivity)
 */

// ── Types ────────────────────────────────────────────────────────────────────

/** Mirrors the runtime state of a DecisionModel at export time. */
export interface DecisionExportState {
  /** Plan / decision title for the header card. */
  planName: string
  /** Optional version label (e.g. "v3" or analysis date). */
  versionLabel: string
  /** The decision question being analysed. */
  question: string
  /** Free-text background / context the user supplied. */
  context: string
  /** AI's recommended-option label, e.g. "Build Internally". */
  recommendation: string
  /** AI's recommended option id (for highlighting). */
  recommendedOptionId: string
  criteria: Array<{
    id: string
    label: string
    type: 'value' | 'constraint'   // V. or C. in Planguage
    weight: number                  // 0-1
    description: string
    scale?: string
    direction: 'higher-better' | 'lower-better'
  }>
  options: Array<{
    id: string
    label: string
    description: string
    /** criterion id → 0–100 score */
    scores: Record<string, number>
    /** constraint criterion id → met? */
    constraintsMet: Record<string, boolean>
    /** Per-option Planguage entries (F. / V. / C. / R. / S.). */
    planguageEntries: Array<{
      id: string
      type: 'F' | 'V' | 'C' | 'R' | 'S'
      tag: string
      description: string
      details?: string
      confidence: 'high' | 'medium' | 'low'
    }>
    pros: string[]
    cons: string[]
    feasibilityScore: number   // 0–100
    valueScore: number         // 0–100
    /** Per-option assessment. */
    recommendation: string
  }>
  /** The decision SPACE as F./V./C. entries (Planguage model of the decision). */
  planguageModel: Array<{
    id: string
    type: 'F' | 'V' | 'C' | 'R' | 'S'
    tag: string
    description: string
    details?: string
    confidence: 'high' | 'medium' | 'low'
  }>
  /** Optional external plan text used for comparison. */
  comparisonText?: string
  /** Optional AI comparison analysis. */
  comparisonAnalysis?: string
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

/** Spell-out-Type-Names rule — never use bare F. / V. / S. / C. / R. in UI text. */
function typeFullName(t: 'F' | 'V' | 'C' | 'R' | 'S'): string {
  switch (t) {
    case 'F': return 'Function'
    case 'V': return 'Value'
    case 'C': return 'Constraint'
    case 'R': return 'Resource'
    case 'S': return 'Solution'
  }
}

/** Canonical Planguage palette per DD-017 — text always on white background. */
function typeBg(t: 'F' | 'V' | 'C' | 'R' | 'S'): { chip: string; text: string } {
  switch (t) {
    case 'F': return { chip: '#fb923c', text: '#9a3412' } // orange
    case 'V': return { chip: '#3b82f6', text: '#1e3a8a' } // blue
    case 'C': return { chip: '#c026d3', text: '#86198f' } // fuchsia
    case 'R': return { chip: '#0284c7', text: '#0c4a6e' } // sky
    case 'S': return { chip: '#8b5cf6', text: '#4c1d95' } // violet
  }
}

/** Traffic-light colour for a score 0–100 — text always readable on white. */
function scoreColour(score: number): string {
  if (score >= 75) return '#1d4ed8' // blue-700
  if (score >= 60) return '#2563eb' // blue-600
  if (score >= 40) return '#b45309' // amber-700
  return '#c2410c'                  // orange-700
}

// ── Section: header ─────────────────────────────────────────────────────────

function renderHeader(state: DecisionExportState, exportedDate: string): string {
  const titleLines = softWrap(
    `Decisions Agent · ${state.planName}${state.versionLabel ? ' ' + state.versionLabel : ''}`,
    42,
  )
  const headerRows = titleLines
    .map(
      (line) =>
        `<tr><td bgcolor="#9f1239" style="background:#9f1239;color:#ffffff;padding:6px 22px 4px 22px;font:700 18px/1.4 'Helvetica Neue',Arial,sans-serif;">${esc(line)}</td></tr>`,
    )
    .join('')
  return `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px 0;border-collapse:collapse;">
  ${headerRows}
  <tr><td bgcolor="#be185d" style="background:#be185d;color:#fce7f3;padding:4px 22px 12px 22px;font:600 11px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">Decision Analysis · Planguage decision matrix · Options · Criteria</td></tr>
  <tr><td bgcolor="#831843" style="background:#831843;color:#fbcfe8;padding:6px 22px;font:500 10px/1.4 'Helvetica Neue',Arial,sans-serif;">Exported: ${esc(exportedDate)}</td></tr>
</table>`
}

// ── Section: question / context summary ─────────────────────────────────────

function renderQuestion(state: DecisionExportState): string {
  const qLines = softWrap(state.question || '(no question stated)', 64)
  const cLines = state.context ? softWrap(state.context, 64) : []
  const qRows = qLines
    .map(
      (line) =>
        `<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:1px 18px;font:600 13px/1.5 'Helvetica Neue',Arial,sans-serif;color:#9f1239;">${esc(line)}</td></tr>`,
    )
    .join('')
  const cRows = cLines
    .map(
      (line) =>
        `<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:1px 18px;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;color:#475569;">${esc(line)}</td></tr>`,
    )
    .join('')
  return `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px 0;border-collapse:collapse;border:2px solid #fbcfe8;">
  <tr><td bgcolor="#fdf2f8" style="background:#fdf2f8;color:#831843;padding:8px 18px 4px 18px;font:700 10px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.16em;text-transform:uppercase;">Decision Question</td></tr>
  ${qRows}
  ${cRows
    ? `<tr><td bgcolor="#fdf2f8" style="background:#fdf2f8;color:#831843;padding:8px 18px 4px 18px;font:700 10px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.16em;text-transform:uppercase;">Context</td></tr>${cRows}`
    : ''}
  <tr><td bgcolor="#ffffff" style="background:#ffffff;padding:8px 18px;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;color:#1f2937;">
    ${state.options.length} ${state.options.length === 1 ? 'option' : 'options'} analysed against ${state.criteria.length} ${state.criteria.length === 1 ? 'criterion' : 'criteria'}
    (${state.criteria.filter(c => c.type === 'value').length} Value, ${state.criteria.filter(c => c.type === 'constraint').length} Constraint)
  </td></tr>
</table>`
}

// ── Section: criteria summary ───────────────────────────────────────────────

function renderCriteriaSection(state: DecisionExportState): string {
  if (state.criteria.length === 0) {
    return ''
  }
  const rows = state.criteria
    .map((c) => {
      const labelLines = softWrap(c.label, 32)
      const descLines = softWrap(c.description, 64)
      const typeFull = c.type === 'value' ? 'Value (V.)' : 'Constraint (C.)'
      const typeBgC = c.type === 'value' ? '#3b82f6' : '#c026d3'
      const dirArrow = c.direction === 'higher-better' ? '↑ higher better' : '↓ lower better'
      const weightPct = Math.round(c.weight * 100)
      const labelTd = labelLines.map(l => esc(l)).join('<br />')
      const descTd = descLines.map(l => esc(l)).join('<br />')
      return `
        <tr>
          <td bgcolor="#ffffff" style="background:#ffffff;padding:6px 12px;font:700 11px/1.4 'Helvetica Neue',Arial,sans-serif;color:#1f2937;border-top:1px solid #f1f5f9;vertical-align:top;">${labelTd}</td>
          <td bgcolor="#ffffff" style="background:#ffffff;padding:6px 12px;font:600 10px/1.4 'Helvetica Neue',Arial,sans-serif;color:#ffffff;border-top:1px solid #f1f5f9;vertical-align:top;">
            <span style="display:inline-block;background:${typeBgC};color:#ffffff;padding:1px 6px;border-radius:4px;">${typeFull}</span>
          </td>
          <td bgcolor="#ffffff" style="background:#ffffff;padding:6px 12px;font:700 11px/1.4 'Helvetica Neue',Arial,sans-serif;color:#1d4ed8;border-top:1px solid #f1f5f9;vertical-align:top;text-align:right;">${weightPct}%</td>
          <td bgcolor="#ffffff" style="background:#ffffff;padding:6px 12px;font:400 10px/1.4 'Helvetica Neue',Arial,sans-serif;color:#475569;border-top:1px solid #f1f5f9;vertical-align:top;">${dirArrow}</td>
          <td bgcolor="#ffffff" style="background:#ffffff;padding:6px 12px;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;color:#1f2937;border-top:1px solid #f1f5f9;vertical-align:top;">${descTd}${c.scale ? `<br /><span style="font:600 10px/1.4 'Helvetica Neue',Arial,sans-serif;color:#0d9488;">Scale: ${esc(c.scale)}</span>` : ''}</td>
        </tr>`
    })
    .join('')
  return `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px 0;border-collapse:collapse;border:1px solid #fbcfe8;">
  <tr><td bgcolor="#9f1239" colspan="5" style="background:#9f1239;color:#ffffff;padding:8px 18px;font:700 11px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">Criteria · ${state.criteria.length} ${state.criteria.length === 1 ? 'entry' : 'entries'}</td></tr>
  <tr>
    <td bgcolor="#fdf2f8" style="background:#fdf2f8;color:#831843;padding:6px 12px;font:700 10px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.06em;text-transform:uppercase;">Criterion</td>
    <td bgcolor="#fdf2f8" style="background:#fdf2f8;color:#831843;padding:6px 12px;font:700 10px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.06em;text-transform:uppercase;">Type</td>
    <td bgcolor="#fdf2f8" style="background:#fdf2f8;color:#831843;padding:6px 12px;font:700 10px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.06em;text-transform:uppercase;text-align:right;">Weight</td>
    <td bgcolor="#fdf2f8" style="background:#fdf2f8;color:#831843;padding:6px 12px;font:700 10px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.06em;text-transform:uppercase;">Direction</td>
    <td bgcolor="#fdf2f8" style="background:#fdf2f8;color:#831843;padding:6px 12px;font:700 10px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.06em;text-transform:uppercase;">Description</td>
  </tr>
  ${rows}
</table>`
}

// ── Section: decision matrix (Options × Criteria scores) ────────────────────

function renderMatrixSection(state: DecisionExportState): string {
  if (state.options.length === 0 || state.criteria.length === 0) {
    return ''
  }
  const headerCells = state.criteria
    .map(
      (c) =>
        `<td bgcolor="#fdf2f8" style="background:#fdf2f8;color:#831843;padding:6px 8px;font:700 10px/1.3 'Helvetica Neue',Arial,sans-serif;text-align:center;border-left:1px solid #fbcfe8;">${esc(c.label)}<br /><span style="font:500 9px/1.3 'Helvetica Neue',Arial,sans-serif;color:#9f1239;">${c.type === 'value' ? 'V.' : 'C.'} · ${Math.round(c.weight * 100)}%</span></td>`,
    )
    .join('')
  const rows = state.options
    .map((o) => {
      const isReco = o.id === state.recommendedOptionId
      const optBg = isReco ? '#fef3c7' : '#ffffff'
      const optBorder = isReco ? '2px solid #f59e0b' : '1px solid #f1f5f9'
      const cells = state.criteria
        .map((c) => {
          if (c.type === 'constraint') {
            const met = o.constraintsMet[c.id]
            const mark = met === true
              ? '<span style="color:#15803d;font:800 14px/1 sans-serif;">✓</span>'
              : met === false
                ? '<span style="color:#b91c1c;font:800 14px/1 sans-serif;">✗</span>'
                : '<span style="color:#94a3b8;">—</span>'
            return `<td bgcolor="${optBg}" style="background:${optBg};padding:6px 8px;font:600 14px/1 'Helvetica Neue',Arial,sans-serif;text-align:center;border-top:${optBorder};border-left:1px solid #f1f5f9;">${mark}</td>`
          }
          const score = o.scores[c.id]
          if (score == null) {
            return `<td bgcolor="${optBg}" style="background:${optBg};padding:6px 8px;font:400 11px/1.4 'Helvetica Neue',Arial,sans-serif;text-align:center;color:#94a3b8;border-top:${optBorder};border-left:1px solid #f1f5f9;">—</td>`
          }
          const eff = c.direction === 'lower-better' ? 100 - score : score
          const colour = scoreColour(eff)
          return `<td bgcolor="${optBg}" style="background:${optBg};padding:6px 8px;font:700 12px/1.3 'Helvetica Neue',Arial,sans-serif;text-align:center;color:${colour};border-top:${optBorder};border-left:1px solid #f1f5f9;">${Math.round(score)}</td>`
        })
        .join('')
      const labelLines = softWrap(o.label, 22)
      const labelHtml = labelLines.map(l => esc(l)).join('<br />')
      const valColour = scoreColour(o.valueScore)
      return `
        <tr>
          <td bgcolor="${optBg}" style="background:${optBg};padding:6px 10px;font:700 12px/1.3 'Helvetica Neue',Arial,sans-serif;color:${isReco ? '#92400e' : '#1f2937'};border-top:${optBorder};vertical-align:top;">${isReco ? '★ ' : ''}${labelHtml}</td>
          ${cells}
          <td bgcolor="${optBg}" style="background:${optBg};padding:6px 8px;font:800 14px/1.3 'Helvetica Neue',Arial,sans-serif;text-align:center;color:${valColour};border-top:${optBorder};border-left:1px solid #f1f5f9;">${Math.round(o.valueScore)}</td>
          <td bgcolor="${optBg}" style="background:${optBg};padding:6px 8px;font:700 12px/1.3 'Helvetica Neue',Arial,sans-serif;text-align:center;color:${scoreColour(o.feasibilityScore)};border-top:${optBorder};border-left:1px solid #f1f5f9;">${Math.round(o.feasibilityScore)}</td>
        </tr>`
    })
    .join('')
  return `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px 0;border-collapse:collapse;border:1px solid #fbcfe8;">
  <tr><td bgcolor="#9f1239" colspan="${state.criteria.length + 3}" style="background:#9f1239;color:#ffffff;padding:8px 18px;font:700 11px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">Decision Matrix · ${state.options.length} ${state.options.length === 1 ? 'option' : 'options'} × ${state.criteria.length} ${state.criteria.length === 1 ? 'criterion' : 'criteria'} · ★ = recommended</td></tr>
  <tr>
    <td bgcolor="#fdf2f8" style="background:#fdf2f8;color:#831843;padding:6px 10px;font:700 10px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.06em;text-transform:uppercase;">Option</td>
    ${headerCells}
    <td bgcolor="#fdf2f8" style="background:#fdf2f8;color:#831843;padding:6px 8px;font:700 10px/1.3 'Helvetica Neue',Arial,sans-serif;text-align:center;border-left:1px solid #fbcfe8;">Value<br />Score</td>
    <td bgcolor="#fdf2f8" style="background:#fdf2f8;color:#831843;padding:6px 8px;font:700 10px/1.3 'Helvetica Neue',Arial,sans-serif;text-align:center;border-left:1px solid #fbcfe8;">Feasi-<br />bility</td>
  </tr>
  ${rows}
</table>`
}

// ── Section: per-option card ────────────────────────────────────────────────

function renderOptionCard(o: DecisionExportState['options'][number], isReco: boolean): string {
  const descLines = softWrap(o.description || '(no description)', 64)
  const descRows = descLines
    .map(
      (line) =>
        `<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:1px 18px;font:400 12px/1.5 'Helvetica Neue',Arial,sans-serif;color:#1f2937;">${esc(line)}</td></tr>`,
    )
    .join('')
  const recoLines = o.recommendation ? softWrap(o.recommendation, 64) : []
  const recoRows = recoLines
    .map(
      (line) =>
        `<tr><td bgcolor="#fdf2f8" style="background:#fdf2f8;padding:1px 18px;font:500 11px/1.5 'Helvetica Neue',Arial,sans-serif;color:#831843;font-style:italic;">${esc(line)}</td></tr>`,
    )
    .join('')
  const prosHtml = o.pros.length > 0
    ? o.pros
        .map((p) => `<div style="margin:1px 0;color:#15803d;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;">+ ${esc(p)}</div>`)
        .join('')
    : '<span style="color:#94a3b8;font:400 11px/1.4 sans-serif;">(no pros listed)</span>'
  const consHtml = o.cons.length > 0
    ? o.cons
        .map((c) => `<div style="margin:1px 0;color:#b91c1c;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;">− ${esc(c)}</div>`)
        .join('')
    : '<span style="color:#94a3b8;font:400 11px/1.4 sans-serif;">(no cons listed)</span>'
  const planguageChips = o.planguageEntries.length > 0
    ? o.planguageEntries
        .map((e) => {
          const c = typeBg(e.type)
          return `<span style="display:inline-block;background:${c.chip};color:#ffffff;padding:1px 6px;border-radius:4px;font:700 9px/1.4 'Helvetica Neue',Arial,sans-serif;margin:2px 4px 2px 0;">${typeFullName(e.type)}: ${esc(e.tag)}</span>`
        })
        .join('')
    : '<span style="color:#94a3b8;font:400 11px/1.4 sans-serif;">(no Planguage entries)</span>'
  const headerBg = isReco ? '#f59e0b' : '#9f1239'
  const headerLabel = isReco ? '★ RECOMMENDED · ' + esc(o.label) : esc(o.label)
  return `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 8px 0;border-collapse:collapse;border:1px solid ${isReco ? '#f59e0b' : '#fbcfe8'};">
  <tr>
    <td bgcolor="${headerBg}" style="background:${headerBg};color:#ffffff;padding:6px 18px;font:800 12px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.06em;">
      ${headerLabel}
      <span style="float:right;background:#ffffff;color:${isReco ? '#92400e' : '#9f1239'};padding:2px 10px;border-radius:9999px;font:700 11px/1 'Helvetica Neue',Arial,sans-serif;">
        Value ${Math.round(o.valueScore)} · Feasibility ${Math.round(o.feasibilityScore)}
      </span>
    </td>
  </tr>
  ${descRows}
  <tr><td bgcolor="#f0fdf4" style="background:#f0fdf4;padding:4px 18px;font:700 10px/1.4 'Helvetica Neue',Arial,sans-serif;color:#14532d;letter-spacing:0.06em;text-transform:uppercase;">Pros</td></tr>
  <tr><td bgcolor="#ffffff" style="background:#ffffff;padding:4px 18px;">${prosHtml}</td></tr>
  <tr><td bgcolor="#fef2f2" style="background:#fef2f2;padding:4px 18px;font:700 10px/1.4 'Helvetica Neue',Arial,sans-serif;color:#7f1d1d;letter-spacing:0.06em;text-transform:uppercase;">Cons</td></tr>
  <tr><td bgcolor="#ffffff" style="background:#ffffff;padding:4px 18px;">${consHtml}</td></tr>
  <tr><td bgcolor="#fdf2f8" style="background:#fdf2f8;padding:4px 18px;font:700 10px/1.4 'Helvetica Neue',Arial,sans-serif;color:#831843;letter-spacing:0.06em;text-transform:uppercase;">Planguage Model · ${o.planguageEntries.length} ${o.planguageEntries.length === 1 ? 'entry' : 'entries'}</td></tr>
  <tr><td bgcolor="#ffffff" style="background:#ffffff;padding:4px 18px;">${planguageChips}</td></tr>
  ${recoRows ? `<tr><td bgcolor="#fdf2f8" style="background:#fdf2f8;padding:4px 18px;font:700 10px/1.4 'Helvetica Neue',Arial,sans-serif;color:#831843;letter-spacing:0.06em;text-transform:uppercase;">Assessment</td></tr>${recoRows}` : ''}
</table>`
}

function renderOptionsSection(state: DecisionExportState): string {
  if (state.options.length === 0) {
    return `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px 0;border-collapse:collapse;"><tr><td bgcolor="#9f1239" style="background:#9f1239;color:#ffffff;padding:10px 18px;font:700 11px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">Options</td></tr><tr><td bgcolor="#fdf2f8" style="background:#fdf2f8;padding:10px 18px;font:400 12px/1.5 'Helvetica Neue',Arial,sans-serif;color:#475569;">No options analysed yet — describe a decision question first.</td></tr></table>`
  }
  const header = `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 8px 0;border-collapse:collapse;">
    <tr><td bgcolor="#831843" style="background:#831843;color:#ffffff;padding:10px 18px;font:700 11px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">Per-Option Details · ${state.options.length} ${state.options.length === 1 ? 'option' : 'options'}</td></tr>
  </table>`
  return header + state.options.map((o) => renderOptionCard(o, o.id === state.recommendedOptionId)).join('')
}

// ── Section: decision space (Planguage model of the decision SPACE) ─────────

function renderPlanguageModelSection(state: DecisionExportState): string {
  if (state.planguageModel.length === 0) return ''
  const rows = state.planguageModel
    .map((e) => {
      const c = typeBg(e.type)
      const descLines = softWrap(e.description, 64)
      const descHtml = descLines.map(l => esc(l)).join('<br />')
      return `
        <tr>
          <td bgcolor="#ffffff" style="background:#ffffff;padding:6px 12px;font:700 10px/1.4 'Helvetica Neue',Arial,sans-serif;color:${c.text};border-top:1px solid #f1f5f9;vertical-align:top;">
            <span style="display:inline-block;background:${c.chip};color:#ffffff;padding:1px 6px;border-radius:4px;">${typeFullName(e.type)}</span>
          </td>
          <td bgcolor="#ffffff" style="background:#ffffff;padding:6px 12px;font:700 11px/1.4 'Helvetica Neue',Arial,sans-serif;color:#1f2937;border-top:1px solid #f1f5f9;vertical-align:top;">${esc(e.tag)}</td>
          <td bgcolor="#ffffff" style="background:#ffffff;padding:6px 12px;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;color:#1f2937;border-top:1px solid #f1f5f9;vertical-align:top;">${descHtml}</td>
        </tr>`
    })
    .join('')
  return `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px 0;border-collapse:collapse;border:1px solid #fbcfe8;">
  <tr><td bgcolor="#9f1239" colspan="3" style="background:#9f1239;color:#ffffff;padding:8px 18px;font:700 11px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">Decision Space · Planguage model · ${state.planguageModel.length} ${state.planguageModel.length === 1 ? 'entry' : 'entries'}</td></tr>
  <tr>
    <td bgcolor="#fdf2f8" style="background:#fdf2f8;color:#831843;padding:6px 12px;font:700 10px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.06em;text-transform:uppercase;">Type</td>
    <td bgcolor="#fdf2f8" style="background:#fdf2f8;color:#831843;padding:6px 12px;font:700 10px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.06em;text-transform:uppercase;">Tag</td>
    <td bgcolor="#fdf2f8" style="background:#fdf2f8;color:#831843;padding:6px 12px;font:700 10px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.06em;text-transform:uppercase;">Description</td>
  </tr>
  ${rows}
</table>`
}

// ── Section: recommendation ─────────────────────────────────────────────────

function renderRecommendation(state: DecisionExportState): string {
  if (!state.recommendation) return ''
  const recoLines = softWrap(state.recommendation, 72)
  const recoRows = recoLines
    .map(
      (line) =>
        `<tr><td bgcolor="#fffbeb" style="background:#fffbeb;padding:1px 18px;font:500 12px/1.6 'Helvetica Neue',Arial,sans-serif;color:#78350f;">${esc(line)}</td></tr>`,
    )
    .join('')
  return `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px 0;border-collapse:collapse;border:2px solid #f59e0b;">
  <tr><td bgcolor="#f59e0b" style="background:#f59e0b;color:#ffffff;padding:8px 18px;font:800 11px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">★ AI Recommendation</td></tr>
  ${recoRows}
</table>`
}

// ── Section: comparison (if present) ────────────────────────────────────────

function renderComparison(state: DecisionExportState): string {
  if (!state.comparisonAnalysis && !state.comparisonText) return ''
  const txtLines = state.comparisonAnalysis ? softWrap(state.comparisonAnalysis, 72) : []
  const txtRows = txtLines
    .map(
      (line) =>
        `<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:1px 18px;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;color:#1f2937;">${esc(line)}</td></tr>`,
    )
    .join('')
  return `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px 0;border-collapse:collapse;border:1px solid #fbcfe8;">
  <tr><td bgcolor="#831843" style="background:#831843;color:#ffffff;padding:8px 18px;font:700 11px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">Comparison · how options affect external plan</td></tr>
  ${txtRows}
</table>`
}

// ── Section: Glossary footnote ──────────────────────────────────────────────

function renderGlossaryFootnote(): string {
  return `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:14px 0 0 0;border-collapse:collapse;border:1px solid #cbd5e1;">
  <tr><td bgcolor="#475569" style="background:#475569;color:#ffffff;padding:8px 18px;font:700 10px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">Planguage Glossary · canonical definitions</td></tr>
  <tr><td bgcolor="#dbeafe" style="background:#dbeafe;color:#1e3a8a;padding:6px 18px;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;"><b>Value (V.)</b> — A scalar quality the stakeholder wants more of. Has Scale, Meter, Tolerable, Goal, Wish. Decisions maximise Values.</td></tr>
  <tr><td bgcolor="#fae8ff" style="background:#fae8ff;color:#86198f;padding:6px 18px;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;"><b>Constraint (C.)</b> — A binary rule. Either met or violated; no partial credit. Decisions must meet ALL Constraints.</td></tr>
  <tr><td bgcolor="#fed7aa" style="background:#fed7aa;color:#9a3412;padding:6px 18px;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;"><b>Function (F.)</b> — A binary capability ("what it does"). Has Presence Test. Decisions deliver Functions.</td></tr>
  <tr><td bgcolor="#ede9fe" style="background:#ede9fe;color:#4c1d95;padding:6px 18px;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;"><b>Solution (S.)</b> — A design idea. Has Description, Impacts, Costs. Decision options ARE Solutions.</td></tr>
  <tr><td bgcolor="#fef3c7" style="background:#fef3c7;color:#78350f;padding:6px 18px;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;"><b>Tolerable &gt;&gt;</b> (*539) · <b>Goal &gt;</b> (*109) · <b>Wish &gt;?</b> (*244) — commitment ladder: project-viability floor, committed promise, stakeholder dream.</td></tr>
</table>`
}

// ── Section: Velocity-of-Learning footer ────────────────────────────────────

function renderVelocityFooter(): string {
  return `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:10px 0 0 0;border-collapse:collapse;border:1px solid #c4b5fd;">
  <tr><td bgcolor="#4c1d95" style="background:#4c1d95;color:#ffffff;padding:8px 18px;font:700 10px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">Why Re-Decide · Velocity of Learning</td></tr>
  <tr><td bgcolor="#f5f3ff" style="background:#f5f3ff;color:#1e1b4b;padding:8px 18px;font:400 11px/1.6 'Helvetica Neue',Arial,sans-serif;">Stages are cyclic — every decision is revisable. The purpose is not to lock the verdict, but to <i>learn quickly and often</i> (Musk's Velocity of Learning) so the criteria, options, and weights are the best current set of ideas for the realities we encounter. We seek a current <b>reasonable balance</b>, maintained for the lifetime of the System of Concern.</td></tr>
  <tr><td bgcolor="#ede9fe" style="background:#ede9fe;color:#5b21b6;padding:6px 18px;font:400 10px/1.4 'Helvetica Neue',Arial,sans-serif;font-style:italic;">— Tom Gilb, 2026-06-21</td></tr>
</table>`
}

// ── Main render function ────────────────────────────────────────────────────

export function renderDecisionMapperHtml(state: DecisionExportState): string {
  const now = new Date()
  const datePart = now.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const timePart = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
  const exportedDate = `${datePart}  ${timePart}`

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" /><title>Decisions Agent — ${esc(state.planName)}</title></head>
<body style="margin:0;padding:18px;background:#f9fafb;font-family:'Helvetica Neue',Arial,sans-serif;">
${renderHeader(state, exportedDate)}
${renderQuestion(state)}
${renderRecommendation(state)}
${renderCriteriaSection(state)}
${renderMatrixSection(state)}
${renderOptionsSection(state)}
${renderPlanguageModelSection(state)}
${renderComparison(state)}
${renderGlossaryFootnote()}
${renderVelocityFooter()}
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:14px 0 0 0;border-collapse:collapse;">
  <tr><td bgcolor="#831843" style="background:#831843;color:#fbcfe8;padding:6px 18px;font:500 9px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.08em;">SEM App · Decisions Agent export · Planguage decision analysis</td></tr>
</table>
</body></html>`
}

// ── Plain-text fallback ──────────────────────────────────────────────────────

export function renderDecisionMapperPlain(state: DecisionExportState): string {
  const HR = '═'.repeat(56)
  const SR = '─'.repeat(56)
  const lines: string[] = []

  lines.push(HR)
  lines.push(
    `Decisions Agent · ${state.planName}${state.versionLabel ? ' ' + state.versionLabel : ''}`,
  )
  lines.push(
    `${state.options.length} ${state.options.length === 1 ? 'option' : 'options'} · ${state.criteria.length} ${state.criteria.length === 1 ? 'criterion' : 'criteria'} (${state.criteria.filter(c => c.type === 'value').length} Value, ${state.criteria.filter(c => c.type === 'constraint').length} Constraint)`,
  )
  lines.push(HR)
  lines.push('')

  lines.push('DECISION QUESTION')
  lines.push(SR)
  lines.push(state.question || '(no question stated)')
  if (state.context) {
    lines.push('')
    lines.push('Context:')
    lines.push(state.context)
  }
  lines.push('')

  if (state.recommendation) {
    lines.push('★ AI RECOMMENDATION')
    lines.push(SR)
    lines.push(state.recommendation)
    lines.push('')
  }

  if (state.criteria.length > 0) {
    lines.push(`CRITERIA · ${state.criteria.length} ${state.criteria.length === 1 ? 'entry' : 'entries'}`)
    lines.push(SR)
    for (const c of state.criteria) {
      const typeFull = c.type === 'value' ? 'Value (V.)' : 'Constraint (C.)'
      const dirArrow = c.direction === 'higher-better' ? '↑ higher better' : '↓ lower better'
      lines.push(`${c.label}  [${typeFull}, weight ${Math.round(c.weight * 100)}%, ${dirArrow}]`)
      lines.push(`  ${c.description}`)
      if (c.scale) lines.push(`  Scale: ${c.scale}`)
      lines.push('')
    }
  }

  if (state.options.length > 0) {
    lines.push(`OPTIONS · ${state.options.length} ${state.options.length === 1 ? 'option' : 'options'}`)
    lines.push(SR)
    for (const o of state.options) {
      const isReco = o.id === state.recommendedOptionId
      lines.push(`${isReco ? '★ RECOMMENDED · ' : ''}${o.label}`)
      lines.push(`  Value score: ${Math.round(o.valueScore)}/100 · Feasibility: ${Math.round(o.feasibilityScore)}/100`)
      lines.push(`  ${o.description}`)
      if (o.pros.length > 0) {
        lines.push('  Pros:')
        for (const p of o.pros) lines.push(`    + ${p}`)
      }
      if (o.cons.length > 0) {
        lines.push('  Cons:')
        for (const c of o.cons) lines.push(`    − ${c}`)
      }
      if (o.planguageEntries.length > 0) {
        lines.push(`  Planguage model · ${o.planguageEntries.length} ${o.planguageEntries.length === 1 ? 'entry' : 'entries'}:`)
        for (const e of o.planguageEntries) {
          lines.push(`    ${e.type === 'F' ? 'Function' : e.type === 'V' ? 'Value' : e.type === 'C' ? 'Constraint' : e.type === 'R' ? 'Resource' : 'Solution'}: ${e.tag} — ${e.description}`)
        }
      }
      if (o.recommendation) {
        lines.push(`  Assessment: ${o.recommendation}`)
      }
      lines.push('')
    }
  }

  if (state.planguageModel.length > 0) {
    lines.push(`DECISION SPACE · Planguage model · ${state.planguageModel.length} ${state.planguageModel.length === 1 ? 'entry' : 'entries'}`)
    lines.push(SR)
    for (const e of state.planguageModel) {
      lines.push(`${e.type === 'F' ? 'Function' : e.type === 'V' ? 'Value' : e.type === 'C' ? 'Constraint' : e.type === 'R' ? 'Resource' : 'Solution'}: ${e.tag}`)
      lines.push(`  ${e.description}`)
      lines.push('')
    }
  }

  if (state.comparisonAnalysis) {
    lines.push('COMPARISON · how options affect external plan')
    lines.push(SR)
    lines.push(state.comparisonAnalysis)
    lines.push('')
  }

  lines.push(SR)
  lines.push('Glossary — canonical Planguage definitions')
  lines.push(SR)
  lines.push('Value (V.)       — scalar quality the stakeholder wants more of; has Scale, Tolerable, Goal, Wish.')
  lines.push('Constraint (C.)  — binary rule; either met or violated. Decisions must meet ALL Constraints.')
  lines.push('Function (F.)    — binary capability ("what it does"); has Presence Test.')
  lines.push('Solution (S.)    — a design idea with Description, Impacts, Costs. Decision options ARE Solutions.')
  lines.push('Tolerable >> (*539) — project-viability threshold. Below it the WHOLE project fails.')
  lines.push('Goal > (*109)       — committed promise; level negotiated against competing stakeholders.')
  lines.push('Wish >? (*244)      — stakeholder dream, uncommitted. Independent of cost and physics.')
  lines.push('')
  lines.push(SR)
  lines.push('Why Re-Decide · Velocity of Learning')
  lines.push(SR)
  lines.push('Stages are cyclic — every decision is revisable. The purpose is not to lock the verdict,')
  lines.push("but to learn quickly and often (Musk's Velocity of Learning) so the criteria, options, and")
  lines.push('weights are the best current set of ideas for the realities we encounter. We seek a current')
  lines.push('reasonable balance, maintained for the lifetime of the System of Concern.')
  lines.push('— Tom Gilb, 2026-06-21')
  lines.push('')

  return lines.join('\n')
}
