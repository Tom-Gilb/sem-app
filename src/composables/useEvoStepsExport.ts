/**
 * useEvoStepsExport.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Evo Steps (Stage 6 — Suggested Evo Steps) colourful HTML export.
 *
 * Tom Gilb 2026-06-22 (verbatim, with screenshot of Stage 6 surface):
 *   "no export here"
 *
 * Sweep target for the Export-Button-on-All-Windows SUPREME rule
 * (memory: rule_export_button_on_all_windows.md). Stage 6 was on the pending
 * sweep list; this composable closes that gap.
 *
 * Architecture (mirrors useMultiVisionExport.ts):
 *   • ONE outer wrapper → sub-tables per section (header, summary card, per-step
 *     cards, footer). Each top-level <table> can be moved as ONE Keynote table.
 *   • Inline styles + bgcolor= attrs everywhere — Keynote/Mail/Notes safe.
 *   • Soft-wrap long strings every ~64 chars onto separate <tr> rows so Keynote
 *     does not clip descenders (r43 lesson).
 *   • Emerald + teal palette (canonical Evo family) with violet chips for
 *     impacted Value names. R-G colorblind-safe per DD-017 (text always on
 *     white background, never green text on red and never red text on dark).
 *
 * Composes with:
 *   • Export Button on All Windows Rule (SUPREME)
 *   • Colorful HTML Spec Email Rule (SUPREME)
 *   • Planguage Glossary Definitions in Tools rule (footer)
 *   • Stages-are-Cyclic + Stage-Has-a-Purpose (Velocity-of-Learning quote in footer)
 */

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * Reflects the runtime state of the Suggested Evo Steps surface at export time.
 * The caller (EvoPlanView.vue exportEvoSteps()) populates this from existing
 * refs (currentModel, plan.value.steps, voteSummaries, cycleHours…).
 */
export interface EvoStepsExportState {
  planName: string
  versionLabel: string
  /** Cycle-length label e.g. "1 Day", "1 Week" — surfaced in summary card. */
  cycleLengthLabel: string
  /** Hours per Evo cycle (1 day ≈ 8h, 1 week ≈ 40h). */
  cycleHours: number
  steps: Array<{
    /** Position in plan: 1-based for human display ("Evo 1", "Evo 2"…). */
    index: number
    /** Spec-tag-style name e.g. "Diplomacy Channel Open". */
    name: string
    /** Plain-language description of the work this step performs. */
    description: string
    /** Names of Value entries this step is designed to move toward Goal. */
    impacts: string[]
    /** Estimated share of total project effort (integer 1–100). */
    effortPercent: number
    /** Estimated hours (effortPercent × cycleHours / 100, rounded). */
    estimatedHours: number
    /** Implementation status text e.g. "Step not implemented yet.". */
    status: string
    /** My confidence vote 1–5 (undefined if no vote). */
    confidenceMine?: number
    /** Team-average confidence 1–5 (undefined if no votes). */
    confidenceTeamAvg?: number
    /** Number of tasks suggested for this step (undefined if none). */
    tasksCount?: number
    /** True if step has flagged risk concerns. */
    hasRisk?: boolean
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

function totalEffort(state: EvoStepsExportState): number {
  return state.steps.reduce((sum, s) => sum + s.effortPercent, 0)
}

function totalHours(state: EvoStepsExportState): number {
  return state.steps.reduce((sum, s) => sum + s.estimatedHours, 0)
}

// ── Section: header ─────────────────────────────────────────────────────────

function renderHeader(state: EvoStepsExportState, exportedDate: string): string {
  const titleLines = softWrap(
    `Evo Steps Plan · ${state.planName}${state.versionLabel ? ' ' + state.versionLabel : ''}`,
    42,
  )
  const headerRows = titleLines
    .map(
      (line) =>
        `<tr><td bgcolor="#047857" style="background:#047857;color:#ffffff;padding:6px 22px 4px 22px;font:700 18px/1.4 'Helvetica Neue',Arial,sans-serif;">${esc(line)}</td></tr>`,
    )
    .join('')
  return `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px 0;border-collapse:collapse;">
  ${headerRows}
  <tr><td bgcolor="#0d9488" style="background:#0d9488;color:#ccfbf1;padding:4px 22px 12px 22px;font:600 11px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">Stage 6 · Suggested Evo Steps · the Evo cycle is where value is delivered</td></tr>
  <tr><td bgcolor="#064e3b" style="background:#064e3b;color:#a7f3d0;padding:6px 22px;font:500 10px/1.4 'Helvetica Neue',Arial,sans-serif;">Exported: ${esc(exportedDate)}</td></tr>
</table>`
}

// ── Section: summary card ────────────────────────────────────────────────────

function renderSummary(state: EvoStepsExportState): string {
  const effort = totalEffort(state)
  const hours = totalHours(state)
  const count = state.steps.length
  return `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px 0;border-collapse:collapse;border:2px solid #5eead4;">
  <tr>
    <td bgcolor="#f0fdfa" style="background:#f0fdfa;color:#134e4a;padding:10px 18px 4px 18px;font:700 11px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.16em;text-transform:uppercase;">⚡ Evo Plan Summary</td>
  </tr>
  <tr>
    <td bgcolor="#ffffff" style="background:#ffffff;padding:10px 18px;font:400 12px/1.6 'Helvetica Neue',Arial,sans-serif;color:#1f2937;">
      <span style="display:inline-block;background:#0d9488;color:#ffffff;font:800 22px/1 'Helvetica Neue',Arial,sans-serif;padding:8px 14px;border-radius:8px;">${count}</span>
      <span style="display:inline-block;margin-left:10px;font:600 12px/1.5 'Helvetica Neue',Arial,sans-serif;color:#134e4a;">
        Evo ${count === 1 ? 'step' : 'steps'} drafted · total build effort <strong>${effort}%</strong> · estimated <strong>~${hours} h</strong>
      </span>
    </td>
  </tr>
  <tr>
    <td bgcolor="#ffffff" style="background:#ffffff;padding:4px 18px 12px 18px;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;color:#475569;">
      ⏱ Maximum Evo Cycle Length is set to <strong>${esc(state.cycleLengthLabel)}</strong> (~${state.cycleHours} h per cycle). Each step is sized to fit within one cycle.
    </td>
  </tr>
</table>`
}

// ── Section: per-step card ──────────────────────────────────────────────────

function renderStepCard(step: EvoStepsExportState['steps'][number]): string {
  const descLines = softWrap(step.description || '(no description)', 64)
  const descRows = descLines
    .map(
      (line) =>
        `<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:1px 18px;font:400 12px/1.5 'Helvetica Neue',Arial,sans-serif;color:#1f2937;">${esc(line)}</td></tr>`,
    )
    .join('')

  // Violet chips for impacted Value names (canonical Value colour family).
  const impactsHtml =
    step.impacts.length > 0
      ? step.impacts
          .map(
            (name) =>
              `<span style="display:inline-block;background:#ede9fe;color:#5b21b6;padding:2px 8px;border-radius:9999px;font:700 10px/1.4 'Helvetica Neue',Arial,sans-serif;margin:2px 4px 2px 0;">${esc(name)}</span>`,
          )
          .join('')
      : `<span style="color:#94a3b8;font:400 11px/1.4 'Helvetica Neue',Arial,sans-serif;">(no Value entries linked)</span>`

  // Risk + tasks badges (only when present).
  const riskBadge = step.hasRisk
    ? `<span style="display:inline-block;background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:9999px;font:700 10px/1.4 'Helvetica Neue',Arial,sans-serif;margin-right:6px;">⚠ Risk flagged</span>`
    : ''
  const tasksBadge =
    step.tasksCount && step.tasksCount > 0
      ? `<span style="display:inline-block;background:#e0f2fe;color:#0c4a6e;padding:2px 8px;border-radius:9999px;font:700 10px/1.4 'Helvetica Neue',Arial,sans-serif;margin-right:6px;">${step.tasksCount} ${step.tasksCount === 1 ? 'task' : 'tasks'}</span>`
      : ''

  // Confidence (My + Team avg).
  const confParts: string[] = []
  if (step.confidenceMine !== undefined) {
    confParts.push(
      `<span style="color:#475569;">My confidence:</span> <strong style="color:#0d9488;">${step.confidenceMine.toFixed(1)}</strong>/5`,
    )
  }
  if (step.confidenceTeamAvg !== undefined) {
    confParts.push(
      `<span style="color:#475569;">Team avg:</span> <strong style="color:#0d9488;">${step.confidenceTeamAvg.toFixed(1)}</strong>/5`,
    )
  }
  const confidenceHtml =
    confParts.length > 0
      ? `<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:4px 18px 6px 18px;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;">${confParts.join(' &nbsp;·&nbsp; ')}</td></tr>`
      : ''

  return `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 8px 0;border-collapse:collapse;border:1px solid #5eead4;">
  <tr>
    <td bgcolor="#0d9488" style="background:#0d9488;color:#ffffff;padding:6px 18px;font:800 12px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.06em;">
      Evo ${step.index} · ${esc(step.name)}
      <span style="float:right;background:#ffffff;color:#0d9488;padding:2px 10px;border-radius:9999px;font:700 11px/1 'Helvetica Neue',Arial,sans-serif;">
        ${step.effortPercent}% · ~${step.estimatedHours} h
      </span>
    </td>
  </tr>
  ${descRows}
  <tr>
    <td bgcolor="#f0fdfa" style="background:#f0fdfa;padding:4px 18px;font:600 10px/1.4 'Helvetica Neue',Arial,sans-serif;color:#134e4a;letter-spacing:0.06em;text-transform:uppercase;">Impacts · Values moved toward Goal</td>
  </tr>
  <tr>
    <td bgcolor="#ffffff" style="background:#ffffff;padding:4px 18px;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;">${impactsHtml}</td>
  </tr>
  ${riskBadge || tasksBadge
    ? `<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:4px 18px;font:400 11px/1.4 'Helvetica Neue',Arial,sans-serif;">${riskBadge}${tasksBadge}</td></tr>`
    : ''}
  ${confidenceHtml}
  <tr>
    <td bgcolor="#f8fafc" style="background:#f8fafc;color:#475569;padding:4px 18px;font:400 10px/1.4 'Helvetica Neue',Arial,sans-serif;font-style:italic;">${esc(step.status)}</td>
  </tr>
</table>`
}

function renderStepsSection(state: EvoStepsExportState): string {
  if (state.steps.length === 0) {
    return `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px 0;border-collapse:collapse;"><tr><td bgcolor="#0d9488" style="background:#0d9488;color:#ffffff;padding:10px 18px;font:700 11px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">Suggested Evo Steps</td></tr><tr><td bgcolor="#f0fdfa" style="background:#f0fdfa;padding:10px 18px;font:400 12px/1.5 'Helvetica Neue',Arial,sans-serif;color:#475569;">No Evo steps drafted yet — generate the plan first.</td></tr></table>`
  }
  const header = `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 8px 0;border-collapse:collapse;">
  <tr><td bgcolor="#065f46" style="background:#065f46;color:#ffffff;padding:10px 18px;font:700 11px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">Suggested Evo Steps · ${state.steps.length} ${state.steps.length === 1 ? 'step' : 'steps'} · ranked most valuable first</td></tr>
</table>`
  return header + state.steps.map(renderStepCard).join('')
}

// ── Section: Glossary footnote ──────────────────────────────────────────────

function renderGlossaryFootnote(): string {
  return `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:14px 0 0 0;border-collapse:collapse;border:1px solid #cbd5e1;">
  <tr><td bgcolor="#475569" style="background:#475569;color:#ffffff;padding:8px 18px;font:700 10px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">Planguage Glossary · canonical definitions</td></tr>
  <tr><td bgcolor="#d1fae5" style="background:#d1fae5;color:#065f46;padding:6px 18px;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;"><b>Evo Step</b> (*141) — A single increment of value delivery: a set of design ideas implemented to move one or more Values toward Goal. The smallest unit at which the plan can learn from reality (Study-Act).</td></tr>
  <tr><td bgcolor="#fef3c7" style="background:#fef3c7;color:#78350f;padding:6px 18px;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;"><b>Tolerable &gt;&gt;</b> (*539) — Project-viability threshold. Minimum non-failure level. Below it the WHOLE project fails.</td></tr>
  <tr><td bgcolor="#d1fae5" style="background:#d1fae5;color:#065f46;padding:6px 18px;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;"><b>Goal &gt;</b> (*109) — Committed promise. The level the project commits to deliver, negotiated against competing stakeholders and resources.</td></tr>
  <tr><td bgcolor="#ede9fe" style="background:#ede9fe;color:#5b21b6;padding:6px 18px;font:400 11px/1.5 'Helvetica Neue',Arial,sans-serif;"><b>Wish &gt;?</b> (*244) — Stakeholder dream, uncommitted. Independent of cost and physics.</td></tr>
</table>`
}

// ── Section: Velocity-of-Learning footer ────────────────────────────────────

function renderVelocityFooter(): string {
  return `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:10px 0 0 0;border-collapse:collapse;border:1px solid #c4b5fd;">
  <tr><td bgcolor="#4c1d95" style="background:#4c1d95;color:#ffffff;padding:8px 18px;font:700 10px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">Why Evo Steps · Velocity of Learning</td></tr>
  <tr><td bgcolor="#f5f3ff" style="background:#f5f3ff;color:#1e1b4b;padding:8px 18px;font:400 11px/1.6 'Helvetica Neue',Arial,sans-serif;">Stages are cyclic — Export is an entry, not an end. The purpose is not to achieve the initial Value requirements, but to <i>learn quickly and often</i> (Musk's Velocity of Learning) so the specifications are the best current set of ideas for the realities we encounter. We seek a current <b>reasonable balance</b>, maintained for the lifetime of the System of Concern.</td></tr>
  <tr><td bgcolor="#ede9fe" style="background:#ede9fe;color:#5b21b6;padding:6px 18px;font:400 10px/1.4 'Helvetica Neue',Arial,sans-serif;font-style:italic;">— Tom Gilb, 2026-06-21</td></tr>
</table>`
}

// ── Main render function ────────────────────────────────────────────────────

export function renderEvoStepsHtml(state: EvoStepsExportState): string {
  const now = new Date()
  const datePart = now.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const timePart = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
  const exportedDate = `${datePart}  ${timePart}`

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" /><title>Evo Steps — ${esc(state.planName)}</title></head>
<body style="margin:0;padding:18px;background:#f9fafb;font-family:'Helvetica Neue',Arial,sans-serif;">
${renderHeader(state, exportedDate)}
${renderSummary(state)}
${renderStepsSection(state)}
${renderGlossaryFootnote()}
${renderVelocityFooter()}
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:14px 0 0 0;border-collapse:collapse;">
  <tr><td bgcolor="#064e3b" style="background:#064e3b;color:#a7f3d0;padding:6px 18px;font:500 9px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.08em;">SEM App · Evo Steps export · Stage 6 (Suggested Evo Steps)</td></tr>
</table>
</body></html>`
}

// ── Plain-text fallback ──────────────────────────────────────────────────────

export function renderEvoStepsPlain(state: EvoStepsExportState): string {
  const HR = '═'.repeat(56)
  const SR = '─'.repeat(56)
  const lines: string[] = []
  const effort = totalEffort(state)
  const hours = totalHours(state)

  lines.push(HR)
  lines.push(
    `Evo Steps Plan · ${state.planName}${state.versionLabel ? ' ' + state.versionLabel : ''}`,
  )
  lines.push(
    `${state.steps.length} ${state.steps.length === 1 ? 'step' : 'steps'} · total build effort ${effort}% · ~${hours} h estimated`,
  )
  lines.push(
    `Maximum Evo Cycle Length: ${state.cycleLengthLabel} (~${state.cycleHours} h per cycle)`,
  )
  lines.push(HR)
  lines.push('')

  if (state.steps.length === 0) {
    lines.push('No Evo steps drafted yet — generate the plan first.')
    lines.push('')
  } else {
    lines.push('SUGGESTED EVO STEPS')
    lines.push(SR)
    for (const step of state.steps) {
      lines.push(`Evo ${step.index} · ${step.name}`)
      lines.push(`  ${step.description}`)
      lines.push(
        `  Effort:    ${step.effortPercent}% of total build (~${step.estimatedHours} h)`,
      )
      if (step.impacts.length > 0) {
        lines.push(`  Impacts:   ${step.impacts.join(', ')}`)
      } else {
        lines.push(`  Impacts:   (no Value entries linked)`)
      }
      if (step.hasRisk) lines.push(`  ⚠ Risk flagged`)
      if (step.tasksCount && step.tasksCount > 0) {
        lines.push(
          `  Tasks:     ${step.tasksCount} ${step.tasksCount === 1 ? 'task' : 'tasks'} suggested`,
        )
      }
      const confParts: string[] = []
      if (step.confidenceMine !== undefined)
        confParts.push(`My ${step.confidenceMine.toFixed(1)}/5`)
      if (step.confidenceTeamAvg !== undefined)
        confParts.push(`Team avg ${step.confidenceTeamAvg.toFixed(1)}/5`)
      if (confParts.length > 0) {
        lines.push(`  Confidence: ${confParts.join(' · ')}`)
      }
      lines.push(`  Status:    ${step.status}`)
      lines.push('')
    }
  }

  lines.push(SR)
  lines.push('Glossary — canonical Planguage definitions')
  lines.push(SR)
  lines.push(
    'Evo Step (*141) — a single increment of value delivery; smallest unit at which the plan learns from reality.',
  )
  lines.push(
    'Tolerable >> (*539) — project-viability threshold. Below it the WHOLE project fails.',
  )
  lines.push(
    'Goal > (*109) — committed promise; level negotiated against competing stakeholders.',
  )
  lines.push(
    'Wish >? (*244) — stakeholder dream, uncommitted. Independent of cost and physics.',
  )
  lines.push('')
  lines.push(SR)
  lines.push('Why Evo Steps · Velocity of Learning')
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
