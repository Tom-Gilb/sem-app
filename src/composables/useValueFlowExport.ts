/**
 * useValueFlowExport.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Value Flow Diagram (6-column causal chain Tasks → Evo Steps → Solutions →
 * Values → Functions → Stakeholders) colourful HTML export.
 *
 * Tom Gilb 2026-06-22 (verbatim, with screenshot of Value Flow surface):
 *   "no option to export"
 *
 * Next sweep target for the Export-Button-on-All-Windows SUPREME rule
 * (memory: rule_export_button_on_all_windows.md). The preceding sweep target,
 * Evo Steps view, shipped as r41 v289 last turn. This composable mirrors
 * useEvoStepsExport.ts structure exactly.
 *
 * Architecture (mirrors useEvoStepsExport.ts):
 *   • ONE outer wrapper → sub-tables per section (header, summary card,
 *     six column-tables — one per causal-chain column — Glossary footnote,
 *     Velocity-of-Learning footer). Each top-level <table> can be moved as
 *     ONE Keynote table per the Gilb HTML Table Standard.
 *   • Inline styles + bgcolor= attrs everywhere — Keynote/Mail/Notes safe.
 *   • Per-column canonical SEM Planguage type colours
 *     (specTypeColors.ts is the source of truth; this file mirrors them):
 *       Tasks        slate  (#f9fafb / #6b7280 / #374151)
 *       Evo Steps    amber  (#fefce8 / #facc15 / #ca8a04)
 *       Solutions    orange (#fff7ed / #fb923c / #ea580c)
 *       Values       violet (#f5f3ff / #a78bfa / #7c3aed)
 *       Functions    green  (#f0fdf4 / #4ade80 / #16a34a)
 *       Stakeholders blue   (#eff6ff / #60a5fa / #2563eb)
 *   • Soft-wrap long strings every ~64 chars onto separate <tr> rows so
 *     Keynote does not clip descenders (r43 lesson).
 *   • R-G colorblind-safe per DD-017 — every coloured cell is dark text on
 *     light background; we never put green text on red or red text on dark.
 *
 * Composes with:
 *   • Export Button on All Windows Rule (SUPREME)
 *   • Colorful HTML Spec Email Rule (SUPREME)
 *   • Planguage Glossary Definitions in Tools rule (footer)
 *   • Stages-are-Cyclic + Stage-Has-a-Purpose (Velocity-of-Learning footer)
 *   • Mailto-No-Self-To SUPREME (caller passes to: '' to exportArtefact)
 */

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * Reflects the runtime state of the Value Flow surface at export time.
 * The caller (ValueFlowPanel.vue exportValueFlow()) populates this from the
 * existing props (spec, evoSteps, tasksByStep) so the export mirrors what the
 * planner sees on screen.
 */
export interface ValueFlowExportState {
  planName: string
  versionLabel: string
  tasks: Array<{
    id: string
    name: string
    status?: string
  }>
  evoSteps: Array<{
    id: string
    name: string
    effortPercent?: number
  }>
  solutions: Array<{
    id: string
    name: string
    description?: string
  }>
  values: Array<{
    id: string
    name: string
    description?: string
  }>
  functions: Array<{
    id: string
    name: string
    description?: string
  }>
  stakeholders: Array<{
    id: string
    name: string
    accent?: string
  }>
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

function totalElements(state: ValueFlowExportState): number {
  return (
    state.tasks.length +
    state.evoSteps.length +
    state.solutions.length +
    state.values.length +
    state.functions.length +
    state.stakeholders.length
  )
}

// ── Column palette table ─────────────────────────────────────────────────────

interface ColPalette {
  label: string
  /** Header bar (dark) background colour. */
  hdrBg: string
  /** Header bar text colour (always white on dark hdrBg). */
  hdrFg: string
  /** Soft accent strip background colour (lighter than hdrBg, darker than chipBg). */
  accentBg: string
  /** Accent strip text colour (dark on accentBg). */
  accentFg: string
  /** Entry chip background colour (palest tier). */
  chipBg: string
  /** Entry chip text colour (dark on chipBg). */
  chipFg: string
}

const COL_PALETTE: Record<
  'tasks' | 'evoSteps' | 'solutions' | 'values' | 'functions' | 'stakeholders',
  ColPalette
> = {
  // Tasks — slate (no canonical type colour; matches diagram)
  tasks: {
    label: 'Tasks',
    hdrBg: '#374151', hdrFg: '#ffffff',
    accentBg: '#f1f5f9', accentFg: '#1f2937',
    chipBg: '#f9fafb', chipFg: '#111827',
  },
  // Evo Steps — amber (canonical Evo family)
  evoSteps: {
    label: 'Evo Steps',
    hdrBg: '#ca8a04', hdrFg: '#ffffff',
    accentBg: '#fef9c3', accentFg: '#713f12',
    chipBg: '#fefce8', chipFg: '#713f12',
  },
  // Solutions — orange (canonical Solution type colour)
  solutions: {
    label: 'Solutions',
    hdrBg: '#ea580c', hdrFg: '#ffffff',
    accentBg: '#fed7aa', accentFg: '#9a3412',
    chipBg: '#fff7ed', chipFg: '#9a3412',
  },
  // Values — violet (canonical Value type colour)
  values: {
    label: 'Values',
    hdrBg: '#7c3aed', hdrFg: '#ffffff',
    accentBg: '#ddd6fe', accentFg: '#5b21b6',
    chipBg: '#f5f3ff', chipFg: '#5b21b6',
  },
  // Functions — green (canonical Function type colour)
  functions: {
    label: 'Functions',
    hdrBg: '#16a34a', hdrFg: '#ffffff',
    accentBg: '#bbf7d0', accentFg: '#065f46',
    chipBg: '#f0fdf4', chipFg: '#166534',
  },
  // Stakeholders — blue (canonical Stakeholder type colour)
  stakeholders: {
    label: 'Stakeholders',
    hdrBg: '#2563eb', hdrFg: '#ffffff',
    accentBg: '#c7d2fe', accentFg: '#312e81',
    chipBg: '#eff6ff', chipFg: '#1e40af',
  },
}

// ── Section: header ─────────────────────────────────────────────────────────

function renderHeader(state: ValueFlowExportState, exportedDate: string): string {
  const titleLines = softWrap(
    `Value Flow · ${state.planName}${state.versionLabel ? ' ' + state.versionLabel : ''}`,
    42,
  )
  const headerRows = titleLines
    .map(
      (line) =>
        `<tr><td bgcolor="#1e1b4b" style="background:#1e1b4b;color:#ffffff;padding:6px 22px 4px 22px;font:700 18px/1.4 'Helvetica Neue',Arial,sans-serif;">${esc(line)}</td></tr>`,
    )
    .join('')
  return `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px 0;border-collapse:collapse;">
  ${headerRows}
  <tr><td bgcolor="#3730a3" style="background:#3730a3;color:#e0e7ff;padding:4px 22px 12px 22px;font:600 11px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">Value Flow · Tasks → Evo Steps → Solutions → Values → Functions → Stakeholders</td></tr>
  <tr><td bgcolor="#312e81" style="background:#312e81;color:#c7d2fe;padding:6px 22px;font:500 10px/1.4 'Helvetica Neue',Arial,sans-serif;">Exported: ${esc(exportedDate)}</td></tr>
</table>`
}

// ── Section: summary card ────────────────────────────────────────────────────

function renderSummary(state: ValueFlowExportState): string {
  const total = totalElements(state)
  return `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px 0;border-collapse:collapse;border:2px solid #a5b4fc;">
  <tr>
    <td bgcolor="#eef2ff" style="background:#eef2ff;color:#312e81;padding:10px 18px 4px 18px;font:700 11px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.16em;text-transform:uppercase;">⟶ Value Flow Summary</td>
  </tr>
  <tr>
    <td bgcolor="#ffffff" style="background:#ffffff;padding:10px 18px;font:400 12px/1.6 'Helvetica Neue',Arial,sans-serif;color:#1f2937;">
      <span style="display:inline-block;background:#4338ca;color:#ffffff;font:800 22px/1 'Helvetica Neue',Arial,sans-serif;padding:8px 14px;border-radius:8px;">${total}</span>
      <span style="display:inline-block;margin-left:10px;font:600 12px/1.5 'Helvetica Neue',Arial,sans-serif;color:#312e81;">
        elements traced across the six-column causal chain
      </span>
    </td>
  </tr>
  <tr>
    <td bgcolor="#ffffff" style="background:#ffffff;padding:4px 18px 12px 18px;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;color:#475569;">
      Tasks <strong>${state.tasks.length}</strong> · Evo Steps <strong>${state.evoSteps.length}</strong> · Solutions <strong>${state.solutions.length}</strong> · Values <strong>${state.values.length}</strong> · Functions <strong>${state.functions.length}</strong> · Stakeholders <strong>${state.stakeholders.length}</strong>
    </td>
  </tr>
</table>`
}

// ── Section: per-column table ────────────────────────────────────────────────

interface ColEntry {
  /** Short headline (column-row name, e.g. "Iran Tension Reduction"). */
  name: string
  /** Optional descriptive subtitle line(s). */
  subtitle?: string
  /** Optional trailing chip text — surfaced as a small pill. */
  trailing?: string
}

function renderColumnTable(palette: ColPalette, entries: ColEntry[]): string {
  if (entries.length === 0) {
    return `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px 0;border-collapse:collapse;border:1px solid ${palette.accentBg};">
  <tr><td bgcolor="${palette.hdrBg}" style="background:${palette.hdrBg};color:${palette.hdrFg};padding:8px 18px;font:800 12px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.08em;text-transform:uppercase;">${esc(palette.label)} · 0 entries</td></tr>
  <tr><td bgcolor="${palette.chipBg}" style="background:${palette.chipBg};color:${palette.chipFg};padding:10px 18px;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;font-style:italic;opacity:0.7;">No ${esc(palette.label).toLowerCase()} on this surface yet.</td></tr>
</table>`
  }
  const rowsHtml = entries
    .map((entry) => {
      const nameLines = softWrap(entry.name || '(unnamed)', 60)
      const nameRows = nameLines
        .map(
          (line) =>
            `<tr><td bgcolor="${palette.chipBg}" style="background:${palette.chipBg};color:${palette.chipFg};padding:1px 18px;font:700 12px/1.5 'Helvetica Neue',Arial,sans-serif;">${esc(line)}</td></tr>`,
        )
        .join('')
      const subtitleHtml = entry.subtitle
        ? softWrap(entry.subtitle, 64)
            .map(
              (line) =>
                `<tr><td bgcolor="${palette.chipBg}" style="background:${palette.chipBg};color:${palette.chipFg};padding:1px 18px 4px 18px;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;opacity:0.85;">${esc(line)}</td></tr>`,
            )
            .join('')
        : ''
      const trailingHtml = entry.trailing
        ? `<tr><td bgcolor="${palette.chipBg}" style="background:${palette.chipBg};padding:2px 18px 6px 18px;font:400 10px/1.4 'Helvetica Neue',Arial,sans-serif;"><span style="display:inline-block;background:${palette.accentBg};color:${palette.accentFg};padding:2px 8px;border-radius:9999px;font:700 10px/1.4 'Helvetica Neue',Arial,sans-serif;">${esc(entry.trailing)}</span></td></tr>`
        : ''
      const spacer = `<tr><td bgcolor="#ffffff" style="background:#ffffff;height:4px;line-height:4px;font-size:1px;">&nbsp;</td></tr>`
      return nameRows + subtitleHtml + trailingHtml + spacer
    })
    .join('')
  return `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px 0;border-collapse:collapse;border:1px solid ${palette.accentBg};">
  <tr><td bgcolor="${palette.hdrBg}" style="background:${palette.hdrBg};color:${palette.hdrFg};padding:8px 18px;font:800 12px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.08em;text-transform:uppercase;">${esc(palette.label)} · ${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}</td></tr>
  ${rowsHtml}
</table>`
}

function renderTasksCol(state: ValueFlowExportState): string {
  const entries: ColEntry[] = state.tasks.map((t) => ({
    name: t.name,
    subtitle: t.status,
  }))
  return renderColumnTable(COL_PALETTE.tasks, entries)
}

function renderEvoStepsCol(state: ValueFlowExportState): string {
  const entries: ColEntry[] = state.evoSteps.map((s) => ({
    name: s.name,
    trailing:
      typeof s.effortPercent === 'number'
        ? `${s.effortPercent}% effort`
        : undefined,
  }))
  return renderColumnTable(COL_PALETTE.evoSteps, entries)
}

function renderSolutionsCol(state: ValueFlowExportState): string {
  const entries: ColEntry[] = state.solutions.map((s) => ({
    name: s.name,
    subtitle: s.description,
  }))
  return renderColumnTable(COL_PALETTE.solutions, entries)
}

function renderValuesCol(state: ValueFlowExportState): string {
  const entries: ColEntry[] = state.values.map((v) => ({
    name: v.name,
    subtitle: v.description,
  }))
  return renderColumnTable(COL_PALETTE.values, entries)
}

function renderFunctionsCol(state: ValueFlowExportState): string {
  const entries: ColEntry[] = state.functions.map((f) => ({
    name: f.name,
    subtitle: f.description,
  }))
  return renderColumnTable(COL_PALETTE.functions, entries)
}

function renderStakeholdersCol(state: ValueFlowExportState): string {
  const entries: ColEntry[] = state.stakeholders.map((s) => ({
    name: s.name,
  }))
  return renderColumnTable(COL_PALETTE.stakeholders, entries)
}

function renderColumnsSection(state: ValueFlowExportState): string {
  // One sibling table per column — KEY for Keynote paste: each top-level table
  // becomes its own Keynote table that can be dragged across slides.
  return (
    renderTasksCol(state) +
    renderEvoStepsCol(state) +
    renderSolutionsCol(state) +
    renderValuesCol(state) +
    renderFunctionsCol(state) +
    renderStakeholdersCol(state)
  )
}

// ── Section: Glossary footnote ──────────────────────────────────────────────

function renderGlossaryFootnote(): string {
  return `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:14px 0 0 0;border-collapse:collapse;border:1px solid #cbd5e1;">
  <tr><td bgcolor="#475569" style="background:#475569;color:#ffffff;padding:8px 18px;font:700 10px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">Planguage Glossary · canonical definitions</td></tr>
  <tr><td bgcolor="#f5f3ff" style="background:#f5f3ff;color:#5b21b6;padding:6px 18px;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;"><b>Value</b> (*047) — A measurable quality of the System of Concern that stakeholders care about. Defined by a Scale and quantified by Tolerable / Goal / Wish levels.</td></tr>
  <tr><td bgcolor="#f0fdf4" style="background:#f0fdf4;color:#166534;padding:6px 18px;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;"><b>Function</b> (*586) — A binary capability the System provides — present or not. Functions ARE the system; Values describe how well Functions perform.</td></tr>
  <tr><td bgcolor="#fff7ed" style="background:#fff7ed;color:#9a3412;padding:6px 18px;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;"><b>Solution</b> (*830) — A design idea that moves one or more Values toward Goal. Solutions are the levers; their estimated Impact on each Value is recorded in the Impact Estimation Table.</td></tr>
  <tr><td bgcolor="#fefce8" style="background:#fefce8;color:#713f12;padding:6px 18px;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;"><b>Evo Step</b> (*141) — A single increment of value delivery: a set of design ideas implemented to move one or more Values toward Goal. The smallest unit at which the plan can learn from reality (Study-Act).</td></tr>
  <tr><td bgcolor="#eff6ff" style="background:#eff6ff;color:#1e40af;padding:6px 18px;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;"><b>Stakeholder</b> — Any party with a stake in the System of Concern. Stakeholders define which Values matter and at which Goal levels.</td></tr>
</table>`
}

// ── Section: Velocity-of-Learning footer ────────────────────────────────────

function renderVelocityFooter(): string {
  return `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:10px 0 0 0;border-collapse:collapse;border:1px solid #c4b5fd;">
  <tr><td bgcolor="#4c1d95" style="background:#4c1d95;color:#ffffff;padding:8px 18px;font:700 10px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">Why the Value Flow · Velocity of Learning</td></tr>
  <tr><td bgcolor="#f5f3ff" style="background:#f5f3ff;color:#1e1b4b;padding:8px 18px;font:400 11px/1.6 'Helvetica Neue',Arial,sans-serif;">Stages are cyclic — Export is an entry, not an end. The purpose is not to achieve the initial Value requirements, but to <i>learn quickly and often</i> (Musk's Velocity of Learning) so the specifications are the best current set of ideas for the realities we encounter. We seek a current <b>reasonable balance</b>, maintained for the lifetime of the System of Concern.</td></tr>
  <tr><td bgcolor="#ede9fe" style="background:#ede9fe;color:#5b21b6;padding:6px 18px;font:400 10px/1.4 'Helvetica Neue',Arial,sans-serif;font-style:italic;">— Tom Gilb, 2026-06-21</td></tr>
</table>`
}

// ── Main render function ────────────────────────────────────────────────────

export function renderValueFlowHtml(state: ValueFlowExportState): string {
  const now = new Date()
  const datePart = now.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const timePart = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
  const exportedDate = `${datePart}  ${timePart}`

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" /><title>Value Flow — ${esc(state.planName)}</title></head>
<body style="margin:0;padding:18px;background:#f9fafb;font-family:'Helvetica Neue',Arial,sans-serif;">
${renderHeader(state, exportedDate)}
${renderSummary(state)}
${renderColumnsSection(state)}
${renderGlossaryFootnote()}
${renderVelocityFooter()}
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:14px 0 0 0;border-collapse:collapse;">
  <tr><td bgcolor="#312e81" style="background:#312e81;color:#c7d2fe;padding:6px 18px;font:500 9px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.08em;">SEM App · Value Flow export · 6-column causal chain</td></tr>
</table>
</body></html>`
}

// ── Plain-text fallback ──────────────────────────────────────────────────────

export function renderValueFlowPlain(state: ValueFlowExportState): string {
  const HR = '═'.repeat(56)
  const SR = '─'.repeat(56)
  const lines: string[] = []
  const total = totalElements(state)

  lines.push(HR)
  lines.push(
    `Value Flow · ${state.planName}${state.versionLabel ? ' ' + state.versionLabel : ''}`,
  )
  lines.push('Tasks → Evo Steps → Solutions → Values → Functions → Stakeholders')
  lines.push(
    `${total} elements · Tasks ${state.tasks.length} · Evo Steps ${state.evoSteps.length} · Solutions ${state.solutions.length} · Values ${state.values.length} · Functions ${state.functions.length} · Stakeholders ${state.stakeholders.length}`,
  )
  lines.push(HR)
  lines.push('')

  function section(label: string, entries: ColEntry[]): void {
    lines.push(`${label.toUpperCase()} · ${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`)
    lines.push(SR)
    if (entries.length === 0) {
      lines.push(`  (none on this surface yet)`)
    } else {
      for (const e of entries) {
        lines.push(`  • ${e.name}`)
        if (e.subtitle) lines.push(`      ${e.subtitle}`)
        if (e.trailing) lines.push(`      [${e.trailing}]`)
      }
    }
    lines.push('')
  }

  section(
    'Tasks',
    state.tasks.map((t) => ({ name: t.name, subtitle: t.status })),
  )
  section(
    'Evo Steps',
    state.evoSteps.map((s) => ({
      name: s.name,
      trailing:
        typeof s.effortPercent === 'number'
          ? `${s.effortPercent}% effort`
          : undefined,
    })),
  )
  section(
    'Solutions',
    state.solutions.map((s) => ({ name: s.name, subtitle: s.description })),
  )
  section(
    'Values',
    state.values.map((v) => ({ name: v.name, subtitle: v.description })),
  )
  section(
    'Functions',
    state.functions.map((f) => ({ name: f.name, subtitle: f.description })),
  )
  section(
    'Stakeholders',
    state.stakeholders.map((s) => ({ name: s.name })),
  )

  lines.push(SR)
  lines.push('Glossary — canonical Planguage definitions')
  lines.push(SR)
  lines.push(
    'Value (*047) — measurable quality of the System; quantified by Tolerable / Goal / Wish.',
  )
  lines.push(
    'Function (*586) — binary capability the System provides; present or not.',
  )
  lines.push(
    'Solution (*830) — design idea that moves Values toward Goal; lever for the plan.',
  )
  lines.push(
    'Evo Step (*141) — single increment of value delivery; smallest unit at which the plan learns.',
  )
  lines.push(
    'Stakeholder — any party with a stake; defines which Values matter and at what Goal levels.',
  )
  lines.push('')
  lines.push(SR)
  lines.push('Why the Value Flow · Velocity of Learning')
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
