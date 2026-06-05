// UNIT_TYPE=Hook
// useSpecExport — serialises a SpecBlock object to Planguage Markdown
// Full implementation — Evo Steps 3 + 8 + 9
//   S.EvoStep3.SerialiserComposable, S.Evo8.TaskMarkdownExport, S.Evo9.PrioritisedPlanExport
// Spec: S.MarkdownSerialiserSchema / F.ImplementMarkdownExportModule / F.SupportTaskDecomposition
//       F.EstimateImpactAndPrioritise

import type { SpecBlock, FEntry, VEntry, SEntry, CEntry, REntry } from '../types/spec'
import type { EvoStep } from '../types/evo-plan'
import type { TaskSuggestion } from '../types/task'
import type { ImpactMatrix } from '../types/impact'

// Any required field that is empty emits this comment so reviewers can
// locate gaps before exporting. The field name is embedded so the gap
// is immediately identifiable in the output.
const PLACEHOLDER = (field: string) => `<!-- MISSING — ${field} fill before export -->`

// Field order follows Planguage convention:
//   Type, Level, Description, then type-specific fields
function serialiseFEntry(entry: FEntry): string {
  return [
    `#### ${entry.id}`,
    `Type: ${entry.type || PLACEHOLDER('Type')}`,
    `Level: ${entry.level || PLACEHOLDER('Level')}`,
    `Description: ${entry.description || PLACEHOLDER('Description')}`,
    // DD-004 (Tom 2026-05-14, "REPURPOSE: NOT AS SUCCESS. AS PRESENCE OR ABSENCE
    // OF THE DEFINED FUNCTION."): successCriteria → presenceTest. Read presenceTest
    // first; fall back to legacy successCriteria so older saved specs still serialise.
    `Presence-Test: ${entry.presenceTest || entry.successCriteria || PLACEHOLDER('Presence-Test')}`,
    `Function of Value: ${entry.functionOfValue || PLACEHOLDER('Function of Value')}`,
  ].join('\n')
}

// Field order: Type, Level, Description, Scale, Meter, Status, Tolerable, Goal,
// Value of function — matching Planguage V. entry convention.
function serialiseVEntry(entry: VEntry): string {
  return [
    `#### ${entry.id}`,
    `Type: ${entry.type || PLACEHOLDER('Type')}`,
    `Level: ${entry.level || PLACEHOLDER('Level')}`,
    `Description: ${entry.description || PLACEHOLDER('Description')}`,
    `Scale: ${entry.scale || PLACEHOLDER('Scale')}`,
    `Meter: ${entry.meter || PLACEHOLDER('Meter')}`,
    `Status: ${entry.status || PLACEHOLDER('Status')}`,
    `Tolerable: ${entry.tolerable || PLACEHOLDER('Tolerable')}`,
    `Goal: ${entry.goal || PLACEHOLDER('Goal')}`,
    `Value of function: ${entry.valueOfFunction || PLACEHOLDER('Value of function')}`,
  ].join('\n')
}

// Field order: Type, Level, Description, Impact, Function.
function serialiseSEntry(entry: SEntry): string {
  return [
    `#### ${entry.id}`,
    `Type: ${entry.type || PLACEHOLDER('Type')}`,
    `Level: ${entry.level || PLACEHOLDER('Level')}`,
    `Description: ${entry.description || PLACEHOLDER('Description')}`,
    `Impact: ${entry.impact || PLACEHOLDER('Impact')}`,
    `Function: ${entry.function || PLACEHOLDER('Function')}`,
  ].join('\n')
}

// Phase 1 of Resources beef-up (Tom Gilb 2026-06-04, r77): Resource entries (R.).
// Field order: Description, Scale, Meter, Now (Status), Tolerable, Goal, optional Wish / Forecast / linkages.
function serialiseREntry(entry: REntry): string {
  const lines = [
    `#### ${entry.id}`,
    `Type: ${entry.type || PLACEHOLDER('Type')}`,
    `Level: ${entry.level || PLACEHOLDER('Level')}`,
    `Description: ${entry.description || PLACEHOLDER('Description')}`,
    `Scale: ${entry.scale || PLACEHOLDER('Scale')}`,
    `Meter: ${entry.meter || PLACEHOLDER('Meter')}`,
    `Now: ${entry.status || PLACEHOLDER('Now')}`,
    `Tolerable: ${entry.tolerable || PLACEHOLDER('Tolerable')}`,
    `Goal: ${entry.goal || PLACEHOLDER('Goal')}`,
  ]
  if (entry.wish)             lines.push(`Wish: ${entry.wish}`)
  if (entry.wishStakeholder)  lines.push(`Wish by: ${entry.wishStakeholder}`)
  if (entry.forecast)         lines.push(`Forecast: ${entry.forecast}`)
  if (entry.resourceForValue) lines.push(`Resource of Value: ${entry.resourceForValue}`)
  if (entry.consumedBy)       lines.push(`Consumed by: ${entry.consumedBy}`)
  if (entry.currentStatus)    lines.push(`Current Status: ${entry.currentStatus}`)
  return lines.join('\n')
}

// DD-006: Binary Constraint entries (C.)
// Field order follows Template_Write_Constraint.md: Description, Scope, Rationale, Source.
function serialiseCEntry(entry: CEntry): string {
  const lines = [
    `#### ${entry.id}`,
    `Type: ${entry.type || PLACEHOLDER('Type')}`,
    `Level: ${entry.level || PLACEHOLDER('Level')}`,
    `Description: ${entry.description || PLACEHOLDER('Description')}`,
    `Scope: ${entry.scope || PLACEHOLDER('Scope')}`,
    `Rationale: ${entry.rationale || PLACEHOLDER('Rationale')}`,
  ]
  if (entry.source) lines.push(`Source: ${entry.source}`)
  return lines.join('\n')
}

/**
 * Composable for serialising a SpecBlock to Planguage Markdown.
 *
 * Outputs entries in F → V → S order. Within each entry, fields appear in
 * Planguage convention order: Type, Level, Description, then type-specific fields.
 * Any required field with an empty string value emits an HTML placeholder comment
 * so the export remains valid while flagging gaps visually.
 *
 * @returns {{ serialise }}
 *   - serialise(spec): converts a SpecBlock to a Planguage Markdown string.
 *     Returns an empty string when all three arrays are empty.
 *
 * Preconditions: all entry `id` fields should be non-empty (used as section headers).
 * Errors: no exception is thrown for empty arrays or empty id strings.
 *
 * @example
 * const { serialise } = useSpecExport()
 * const markdown = serialise(specBlock)
 * // markdown contains "#### F.MyFunction\nType: Function\n…"
 */
export function useSpecExport() {
  function serialise(spec: SpecBlock): string {
    const sections: string[] = []

    for (const entry of spec.functions) {
      sections.push(serialiseFEntry(entry))
    }
    for (const entry of spec.values) {
      sections.push(serialiseVEntry(entry))
    }
    for (const entry of spec.solutions) {
      sections.push(serialiseSEntry(entry))
    }
    for (const entry of spec.constraints ?? []) {
      sections.push(serialiseCEntry(entry))
    }
    for (const entry of spec.resources ?? []) {
      sections.push(serialiseREntry(entry))
    }

    return sections.join('\n\n')
  }

  return { serialise }
}

// --- Serialise a single TaskSuggestion as a Markdown task item ---------------
// Format: "- [ ] description (Xh)" or "- [x] description (Xh)"
// The "(Xh)" suffix is omitted when effortHours is null.
function serialiseTask(task: TaskSuggestion): string {
  const check = task.completed ? '[x]' : '[ ]'
  const effort = task.effortHours !== null ? ` (${task.effortHours}h)` : ''
  return `- ${check} ${task.description}${effort}`
}

/**
 * Serialises a SpecBlock plus an Evo plan with per-step task lists to Planguage Markdown.
 *
 * Output format:
 *  1. Existing Planguage Markdown from the spec (F → V → S)
 *  2. "## Evo Plan" section
 *  3. Each step as "### <step.name>" heading
 *  4. Task items as "- [ ] description (Xh)" Markdown task list below each step heading
 *     - Completed tasks use "- [x]"
 *     - Steps with no tasks have no task items (heading only)
 *     - "(Xh)" suffix is omitted when effortHours is null
 *
 * Spec: S.Evo8.TaskMarkdownExport — V.EvoStep8.TaskExportFormat
 *
 * @param spec - The SpecBlock to serialise
 * @param steps - The Evo steps to include under the Evo Plan section
 * @param tasks - Map from step.name → TaskSuggestion[]; missing entries produce no task items
 * @returns The full Planguage + Evo Plan Markdown string
 *
 * @example
 * const md = exportWithTasks(spec, steps, { 'S.Evo8': [{ id: '1', description: 'Implement X', effortHours: 4, assignee: null, completed: false }] })
 * // md ends with "### S.Evo8\n- [ ] Implement X (4h)"
 */
export function exportWithTasks(
  spec: SpecBlock,
  steps: EvoStep[],
  tasks: Record<string, TaskSuggestion[]>,
): string {
  const { serialise } = useSpecExport()

  // --- Spec section ---
  const specSection = serialise(spec)

  // --- Evo Plan section ---
  const evoPlanLines: string[] = ['## Evo Plan']

  for (const step of steps) {
    evoPlanLines.push(`### ${step.name}`)

    const stepTasks = tasks[step.name]
    if (stepTasks && stepTasks.length > 0) {
      for (const task of stepTasks) {
        evoPlanLines.push(serialiseTask(task))
      }
    }
    // If no tasks for this step, only the heading appears (no task items added)
  }

  const evoPlanSection = evoPlanLines.join('\n')

  // Combine: spec content (if any) followed by the Evo Plan section.
  // A blank line separates the two sections for readability.
  if (specSection) {
    return `${specSection}\n\n${evoPlanSection}`
  }
  return evoPlanSection
}

// ── Plain-text serialisers (for email body + downloaded .txt) ─────────────────
//
// Produces human-readable output with no Markdown syntax — readable in Apple Mail,
// Keynote, Notes, or any plain text editor without rendering.

function _pad(label: string, width = 14): string {
  return label.padEnd(width)
}

// Tom 2026-06-04: never print the word "undefined" in plain-text exports.
// Optional fields render as an em-dash placeholder so the structure is
// visible but no JS-runtime artefact leaks into the email body.
function _opt(value: string | undefined | null): string {
  const v = (value ?? '').toString().trim()
  return v.length ? v : '—'
}

function serialiseFEntryPlain(entry: FEntry): string {
  return [
    entry.id,
    `  ${_pad('Type:')}      ${entry.type}`,
    `  ${_pad('Level:')}     ${entry.level}`,
    `  ${_pad('Description:')} ${entry.description}`,
    `  ${_pad('Presence:')}  ${_opt(entry.presenceTest ?? entry.successCriteria)}`,
    `  ${_pad('Delivers:')}  ${_opt(entry.functionOfValue)}`,
  ].join('\n')
}

function serialiseVEntryPlain(entry: VEntry): string {
  return [
    entry.id,
    `  ${_pad('Type:')}      ${entry.type}`,
    `  ${_pad('Level:')}     ${entry.level}`,
    `  ${_pad('Description:')} ${entry.description}`,
    `  ${_pad('Scale:')}     ${_opt(entry.scale)}`,
    `  ${_pad('Meter:')}     ${_opt(entry.meter)}`,
    `  ${_pad('Now:')}       ${_opt(entry.status)}`,
    `  ${_pad('Tolerable:')} ${_opt(entry.tolerable)}`,
    `  ${_pad('Goal:')}      ${_opt(entry.goal)}`,
    `  ${_pad('For:')}       ${_opt(entry.valueOfFunction)}`,
  ].join('\n')
}

function serialiseSEntryPlain(entry: SEntry): string {
  return [
    entry.id,
    `  ${_pad('Type:')}      ${entry.type}`,
    `  ${_pad('Level:')}     ${entry.level}`,
    `  ${_pad('Description:')} ${entry.description}`,
    `  ${_pad('Impact:')}    ${_opt(entry.impact)}`,
    `  ${_pad('Function:')}  ${_opt(entry.function)}`,
  ].join('\n')
}

function serialiseREntryPlain(entry: REntry): string {
  const lines = [
    entry.id,
    `  ${_pad('Type:')}      ${entry.type}`,
    `  ${_pad('Level:')}     ${entry.level}`,
    `  ${_pad('Description:')} ${entry.description}`,
    `  ${_pad('Scale:')}     ${_opt(entry.scale)}`,
    `  ${_pad('Meter:')}     ${_opt(entry.meter)}`,
    `  ${_pad('Now:')}       ${_opt(entry.status)}`,
    `  ${_pad('Tolerable:')} ${_opt(entry.tolerable)}`,
    `  ${_pad('Goal:')}      ${_opt(entry.goal)}`,
  ]
  if (entry.wish)             lines.push(`  ${_pad('Wish:')}      ${entry.wish}`)
  if (entry.wishStakeholder)  lines.push(`  ${_pad('Wish by:')}   ${entry.wishStakeholder}`)
  if (entry.forecast)         lines.push(`  ${_pad('Forecast:')}  ${entry.forecast}`)
  if (entry.resourceForValue) lines.push(`  ${_pad('Enables:')}   ${entry.resourceForValue}`)
  if (entry.consumedBy)       lines.push(`  ${_pad('Consumed by:')} ${entry.consumedBy}`)
  return lines.join('\n')
}

function serialiseCEntryPlain(entry: CEntry): string {
  const lines = [
    entry.id,
    `  ${_pad('Type:')}      ${entry.type}`,
    `  ${_pad('Level:')}     ${entry.level}`,
    `  ${_pad('Description:')} ${entry.description}`,
    `  ${_pad('Scope:')}     ${entry.scope}`,
    `  ${_pad('Rationale:')} ${entry.rationale}`,
  ]
  if (entry.source) lines.push(`  ${_pad('Source:')}    ${entry.source}`)
  return lines.join('\n')
}

const _HR = '─'.repeat(48)

/**
 * Serialises a SpecBlock to plain readable text — no Markdown syntax.
 * Safe to paste into Apple Mail, Notes, Keynote, or any text editor.
 */
export function serialisePlainText(spec: SpecBlock): string {
  const parts: string[] = []

  if (spec.functions.length) {
    parts.push(`FUNCTIONS\n${_HR}`)
    parts.push(spec.functions.map(serialiseFEntryPlain).join('\n\n'))
  }

  if (spec.values.length) {
    parts.push(`VALUES\n${_HR}`)
    parts.push(spec.values.map(serialiseVEntryPlain).join('\n\n'))
  }

  if (spec.solutions.length) {
    parts.push(`SOLUTIONS\n${_HR}`)
    parts.push(spec.solutions.map(serialiseSEntryPlain).join('\n\n'))
  }

  if ((spec.constraints ?? []).length) {
    parts.push(`CONSTRAINTS\n${_HR}`)
    parts.push((spec.constraints ?? []).map(serialiseCEntryPlain).join('\n\n'))
  }

  if ((spec.resources ?? []).length) {
    parts.push(`RESOURCES\n${_HR}`)
    parts.push((spec.resources ?? []).map(serialiseREntryPlain).join('\n\n'))
  }

  return parts.join('\n\n')
}

/**
 * Plain-text equivalent of exportWithTasks — spec + evo plan with task lists.
 * No Markdown syntax.
 */
export function exportWithTasksPlainText(
  spec: SpecBlock,
  steps: EvoStep[],
  tasks: Record<string, TaskSuggestion[]>,
): string {
  const specSection = serialisePlainText(spec)

  const evoLines: string[] = [`EVO PLAN\n${_HR}`]
  steps.forEach((step, i) => {
    evoLines.push(`${i + 1}. ${step.name}`)
    const stepTasks = tasks[step.name] ?? []
    stepTasks.forEach(t => {
      const done = t.completed ? '✓' : '○'
      const effort = t.effortHours !== null ? ` (${t.effortHours}h)` : ''
      evoLines.push(`     ${done} ${t.description}${effort}`)
    })
  })

  const evoSection = evoLines.join('\n')
  return specSection ? `${specSection}\n\n${evoSection}` : evoSection
}

// ── exportPrioritisedPlan — Evo Step 9 (S.Evo9.PrioritisedPlanExport) ──────────

/**
 * Builds the Ranked Evo Plan section — solutions ordered by V/C descending,
 * each with its task list in "- [ ]" format.
 *
 * @param steps - All Evo steps to include
 * @param tasks - Map from step.name → TaskSuggestion[]
 * @param rankedSolutionIds - Solution IDs in V/C descending order
 * @returns Markdown string for the "## Ranked Evo Plan" section
 */
function buildRankedEvoPlanSection(
  steps: EvoStep[],
  tasks: Record<string, TaskSuggestion[]>,
  rankedSolutionIds: string[],
): string {
  const lines: string[] = ['## Ranked Evo Plan']

  // Index steps by each linkedSolutions entry — a step spanning multiple solutions
  // appears under all of them so export rendering picks it up regardless of which
  // solution ID is used as the lookup key.
  const stepBySolution: Record<string, EvoStep> = {}
  for (const step of steps) {
    for (const solId of step.linkedSolutions ?? []) {
      stepBySolution[solId] = step
    }
  }

  let rank = 1
  for (const solId of rankedSolutionIds) {
    // Find the step(s) linked to this solution
    const step = stepBySolution[solId]
    if (step) {
      lines.push(`${rank}. ### ${step.name}`)
      const stepTasks = tasks[step.name] ?? []
      for (const task of stepTasks) {
        const check = task.completed ? '[x]' : '[ ]'
        const effort = task.effortHours !== null ? ` (${task.effortHours}h)` : ''
        lines.push(`   - ${check} ${task.description}${effort}`)
      }
      rank++
    }
  }

  // If no steps matched, fall back to listing all steps in their given order
  if (rank === 1) {
    for (const step of steps) {
      lines.push(`${rank}. ### ${step.name}`)
      const stepTasks = tasks[step.name] ?? []
      for (const task of stepTasks) {
        const check = task.completed ? '[x]' : '[ ]'
        const effort = task.effortHours !== null ? ` (${task.effortHours}h)` : ''
        lines.push(`   - ${check} ${task.description}${effort}`)
      }
      rank++
    }
  }

  return lines.join('\n')
}

/**
 * Exports the full prioritised Evo plan as Planguage Markdown.
 *
 * Output sections (in order):
 *  1. Full Planguage Markdown spec (existing serialiser output)
 *  2. "## VDT Impact Matrix" — pipe-delimited Markdown table
 *     - Header row: blank | solution IDs
 *     - Each data row: value ID | impact% per solution
 *  3. "## V/C Ratios" — Markdown table: solution ID | valueImpactSum | resourceClaim% | V/C ratio
 *  4. "## Ranked Evo Plan" — numbered list of solutions by V/C descending, each with task list
 *
 * Spec: S.Evo9.PrioritisedPlanExport — V.EvoStep9.VCCalculationCorrectness
 *
 * @param spec - The SpecBlock to serialise
 * @param steps - The Evo steps to include
 * @param tasks - Map from step.name → TaskSuggestion[]
 * @param impactMatrix - The V×S impact matrix (impactMatrix[valueId][solutionId] = 0–100)
 * @param vcRatios - Map from solutionId → V/C ratio number
 * @returns The full prioritised plan as a Markdown string
 *
 * @example
 * const md = exportPrioritisedPlan(spec, steps, tasks, impactMatrix, vcRatios)
 * // md contains "## VDT Impact Matrix", "## V/C Ratios", "## Ranked Evo Plan"
 */
export function exportPrioritisedPlan(
  spec: SpecBlock,
  steps: EvoStep[],
  tasks: Record<string, TaskSuggestion[]>,
  impactMatrix: ImpactMatrix,
  vcRatios: Record<string, number>,
): string {
  const { serialise } = useSpecExport()

  // --- Section 1: Full Planguage spec ---
  const specSection = serialise(spec)

  // --- Section 2: VDT Impact Matrix ---
  const solutionIds = spec.solutions.map((s) => s.id)
  const valueIds = spec.values.map((v) => v.id)

  // Pipe-delimited Markdown table: header row then data rows
  const vdtLines: string[] = ['## VDT Impact Matrix']

  // Header: blank cell for the row header column, then one column per solution
  vdtLines.push(`| Value | ${solutionIds.join(' | ')} |`)
  // Alignment row
  vdtLines.push(`| --- | ${solutionIds.map(() => '---').join(' | ')} |`)
  // Data rows
  for (const vid of valueIds) {
    const cells = solutionIds.map((sid) => {
      const val = impactMatrix[vid]?.[sid]
      return val !== undefined ? String(val) : '0'
    })
    vdtLines.push(`| ${vid} | ${cells.join(' | ')} |`)
  }

  const vdtSection = vdtLines.join('\n')

  // --- Section 3: V/C Ratios ---
  const vcLines: string[] = ['## V/C Ratios']
  vcLines.push('| Solution | Value Impact Sum | Resource Claim % | V/C Ratio |')
  vcLines.push('| --- | --- | --- | --- |')

  for (const sid of solutionIds) {
    // Recompute valueImpactSum from the matrix
    const valueImpactSum = valueIds.reduce((sum, vid) => {
      return sum + (impactMatrix[vid]?.[sid] ?? 0)
    }, 0)
    const ratio = vcRatios[sid]
    // Detect unconstrained (resource claim = 0) by checking if ratio equals valueImpactSum
    // and the sum is non-zero, OR if the raw ratio is Infinity
    const ratioDisplay = ratio === Infinity ? '∞' : (ratio !== undefined ? ratio.toFixed(2) : '–')
    // Back-calculate resource claim from valueImpactSum and ratio
    const resourceClaim =
      ratio === Infinity || ratio === 0
        ? 0
        : ratio !== undefined
          ? parseFloat((valueImpactSum / ratio).toFixed(0))
          : 20
    vcLines.push(`| ${sid} | ${valueImpactSum} | ${resourceClaim} | ${ratioDisplay} |`)
  }

  const vcSection = vcLines.join('\n')

  // --- Section 4: Ranked Evo Plan ---
  // Sort solution IDs by V/C descending to determine the ranking
  const rankedSolutionIds = [...solutionIds].sort((a, b) => {
    const ra = vcRatios[a] ?? 0
    const rb = vcRatios[b] ?? 0
    return rb - ra
  })

  const rankedSection = buildRankedEvoPlanSection(steps, tasks, rankedSolutionIds)

  // --- Combine all sections with double blank lines between them ---
  const sections: string[] = []
  if (specSection) sections.push(specSection)
  sections.push(vdtSection)
  sections.push(vcSection)
  sections.push(rankedSection)

  return sections.join('\n\n')
}
