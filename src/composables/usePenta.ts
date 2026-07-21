// UNIT_TYPE=Composable
// usePenta — extracts PentaModel from SpecBlock, computes Efficiency, provides editing.
//
// Penta Model: Tom Gilb & Al Shalloway (2022). SVERD = Scope · Values · Efficiency · Resources · Designs.
// Penta is a sharpening framework (symbol: Sword). Canonical source: Simple book Ch.4; CE Design chapter.
//
// Claude-Code-as-AI-Layer rule: NO external API calls here.
// buildOptimaPrompt() returns a string the user copies to Claudian; response is pasted back.

import { computed, type Ref, type ComputedRef } from 'vue'
import type { SpecBlock, VEntry, REntry } from '../types/spec'
import { rBudget } from '../types/spec'
import type {
  PentaModel,
  PentaSectorId,
  PentaSector,
  PentaItem,
  PentaEfficiency,
  PentaOptimaCmd,
} from '../types/penta'
import { PENTA_SECTOR_ORDER } from '../types/penta'

// ── Canonical Penta sector colours (matching the 2022 paper's pinwheel) ──────

export const SECTOR_COLORS: Record<PentaSectorId, {
  bg:     string   // SVG fill for the arc / detail panel background
  stroke: string   // SVG stroke / accent border
  text:   string   // Text on white background (DD-017 contrast rule)
  label:  string   // Human-readable sector name
}> = {
  scope:        { bg: '#fef2f2', stroke: '#dc2626', text: '#991b1b', label: 'Scope' },
  values:       { bg: '#f0fdf4', stroke: '#16a34a', text: '#14532d', label: 'Values' },
  efficiency:   { bg: '#eff6ff', stroke: '#2563eb', text: '#1e3a8a', label: 'Efficiency' },
  resources:    { bg: '#fdf4ff', stroke: '#a855f7', text: '#581c87', label: 'Resources' },
  design:       { bg: '#fff7ed', stroke: '#ea580c', text: '#7c2d12', label: 'Design' },
}

// ── Mnemonic label helpers ────────────────────────────────────────────────────

/**
 * Extract 2 significant (non-stop-word) words from a description string.
 * Used as a fallback when a spec entry ID is a non-descriptive sequential code.
 */
function descriptionTag(description: string): string {
  if (!description) return ''
  const STOP = new Set([
    'the','a','an','of','for','in','on','at','to','be','is','are','was','were',
    'that','this','which','with','from','and','or','but','its','by','as','it',
    'not','have','must','never','always','should','all','any','each','how',
    'can','will','does','do','has','had','if','when','then','than','so','no',
  ])
  const words = description
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !STOP.has(w.toLowerCase()))
  return words.slice(0, 2).join(' ')
}

/**
 * Derive a human-readable mnemonic label from a Planguage entry's id + description.
 *
 * Priority order:
 *  1. Strip dotted type prefix ("V." "F." "S." "C." "R.") if present.
 *  2. Split CamelCase transitions (camelCase → camel Case, HTMLParser → HTML Parser).
 *  3. Normalize multiple spaces.
 *  4. If result is a bare number or single-letter+number sequential ID (V1, F2, S3 …),
 *     fall back to the first 2 significant words of description.
 *  5. Never return empty — last resort is the raw id.
 *
 * Tom Gilb 2026-06-09: "generate Great Mnemonic Unique Tags, about 1 to 3 words each,
 * derived from the essence of the definitions of the specs. Nobody can discuss, refer
 * to remember specs with V1 F1 etc."
 */
export function mnemonicLabel(id: string, description: string = ''): string {
  // 1. Strip dotted type prefix  e.g. "V." "F." "S." "C." "R."
  let cleaned = id.replace(/^[VFSCRvfscr]\./, '')
  // 2. Split CamelCase: lowercase→uppercase AND ALLCAPS→CapCase
  cleaned = cleaned
    .replace(/([a-z])([A-Z])/g, '$1 $2')          // camelCase → camel Case
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')    // HTMLParser → HTML Parser
    .replace(/\s+/g, ' ')
    .trim()
  // 3. Detect non-descriptive IDs: bare number, or single-letter+number (V1, F2, s3 …)
  const isSequential =
    /^\d+$/.test(cleaned.replace(/\s/g, '')) ||   // purely numeric after strip
    /^[VFSCRvfscr]\d+$/.test(id)                  // original ID is V1-style
  if (isSequential || cleaned === '') {
    const fallback = descriptionTag(description)
    return fallback || id
  }
  return cleaned
}

// ── Numeric parser ────────────────────────────────────────────────────────────

/**
 * Extract a numeric value from a Planguage threshold string.
 * Handles forms: "Goal [2026-Q2] 0.9", "Status 85%", "42", "~500"
 * Returns NaN if no numeric value found.
 */
function parseThreshold(raw: string | undefined): number {
  if (!raw || raw.trim() === '') return NaN
  // Strip common prefixes: Status, Tolerable, Goal, Wish, Budget, etc.
  const stripped = raw.replace(/^(Status|Tolerable|Goal|Wish|Budget|Deadline|Headcount|Forecast|Ideal)\s*/i, '')
  // Strip bracketed qualifiers: [2026-Q2, ...]
  const noBrackets = stripped.replace(/\[.*?\]/g, '')
  // Strip units that follow the number (e.g. "days", "hrs", "%", "k€")
  const match = noBrackets.match(/-?\d+(\.\d+)?/)
  if (!match) return NaN
  return parseFloat(match[0])
}

// ── Item builders ─────────────────────────────────────────────────────────────

function vEntryToItem(v: VEntry): PentaItem {
  const statusNum    = parseThreshold(v.status)
  const goalNum      = parseThreshold(v.goal)
  const tolerableNum = parseThreshold(v.tolerable)
  const wishNum      = parseThreshold(v.wish)
  return {
    id:            v.id,
    label:         mnemonicLabel(v.id, v.description),
    description:   v.description,
    type:          'value',
    ambitionLevel: v.ambitionLevel?.length ? v.ambitionLevel : undefined,
    status:        isNaN(statusNum)    ? undefined : statusNum,
    tolerable:     isNaN(tolerableNum) ? undefined : tolerableNum,
    goal:          isNaN(goalNum)      ? undefined : goalNum,
    wish:          isNaN(wishNum)      ? undefined : wishNum,
    scale:        v.scale,
    meter:        v.meter,
    specOwner:    v.specOwner,
    stakeholders: v.stakeholders,
    justification:v.justification,
    version:      v.version,
    risks:        v.risks,
    tags:         v.level ? [v.level] : [],
    entryRef:     v.id,
  }
}

function rEntryToItem(r: REntry): PentaItem {
  const budgetRaw  = rBudget(r)
  const budgetNum  = parseThreshold(budgetRaw)
  const consumedNum = parseThreshold(r.status)
  return {
    id:           r.id,
    label:        mnemonicLabel(r.id, r.description),
    description:  r.description,
    type:         'resource',
    budget:       isNaN(budgetNum)   ? undefined : budgetNum,
    consumed:     isNaN(consumedNum) ? undefined : consumedNum,
    unit:         r.scale,
    specOwner:    r.specOwner,
    stakeholders: r.stakeholders,
    justification:r.justification,
    version:      r.version,
    risks:        r.risks,
    tags:         r.level ? [r.level] : [],
    entryRef:     r.id,
  }
}

// ── Efficiency computation ────────────────────────────────────────────────────

function computeEfficiency(
  valueItems:    PentaItem[],
  resourceItems: PentaItem[],
): PentaEfficiency {
  // Tom Gilb 2026-06-10: "efficiency cannot be 100% when no resources, a message
  // 'Efficiency cannot be computed. No Resources planned yet.'"
  //
  // r78 amendment (Tom Gilb 2026-06-10: "I put in money but no recomputation of efficiency"):
  // Previously required BOTH Consumed and Budget on each Resource to count it. That made the
  // very common case "I just set Budget" fail to recompute — Status (consumed) was assumed but
  // never measured. Now: Budget alone qualifies a Resource; missing Status defaults to 0
  // (treated as "nothing spent yet" → projected efficiency). The result is flagged with
  // `isProjected: true` + projectionNote so the UI can show a "projected — Status pending"
  // caveat instead of silently presenting it as actual-measured.
  //
  // Efficiency = Value Delivered / Resources Used. If NO Resources at all, OR no Budget set
  // anywhere, the denominator is undefined and we honestly say cannot-compute.

  // Value achievement: avg(status / goal) for entries with goal > 0
  // Missing status → 0 (treated as "not yet delivered" for projection)
  const vPairs = valueItems.filter(v => v.goal != null && v.goal > 0)
  const vMissingStatus = vPairs.filter(v => v.status == null).length
  const valueAchievement = vPairs.length > 0
    ? vPairs.reduce((sum, v) => sum + ((v.status ?? 0) / v.goal!), 0) / vPairs.length
    : 0.5  // no V. with Goal — use 0.5 placeholder

  // Resource utilisation: avg(consumed / budget) for entries with budget > 0
  // Missing consumed → 0 (treated as "not yet spent")
  const rPairs = resourceItems.filter(r => r.budget != null && r.budget > 0)
  const rMissingStatus = rPairs.filter(r => r.consumed == null).length

  // ── Cannot-compute guards (relaxed in r78) ────────────────────────────────
  // Only fires when there's literally no denominator possible.
  if (resourceItems.length === 0) {
    return {
      valueAchievement,
      resourceUtilization: 0,
      ratio:               0,
      balancePercent:      0,
      grade:               'poor',
      cannotCompute:       true,
      cannotComputeReason: 'Efficiency cannot be computed. No Resources planned yet.',
      isProjected:         false,
    }
  }
  if (rPairs.length === 0) {
    return {
      valueAchievement,
      resourceUtilization: 0,
      ratio:               0,
      balancePercent:      0,
      grade:               'poor',
      cannotCompute:       true,
      cannotComputeReason: `Efficiency cannot be computed. ${resourceItems.length} Resource${resourceItems.length !== 1 ? 's' : ''} planned, but no Budget data on any of them — set a Budget on at least one R. entry.`,
      isProjected:         false,
    }
  }

  const resourceUtilization = rPairs.reduce((sum, r) => sum + ((r.consumed ?? 0) / r.budget!), 0) / rPairs.length
  const ratio        = valueAchievement / Math.max(resourceUtilization, 0.01)
  // Tom Gilb 2026-06-11: "I have a problem with tilda 500% representing 417% drop it,
  //   417 is 417 or even tildaa 417". Upper clamp ceiling REMOVED — show the real number.
  // The previous Math.min(…, 500) rounded huge projected values up to a fake "+500%" that
  // misrepresented the underlying ratio. Now the displayed balance always equals the actual
  // computed value (only the lower bound at −100% is kept — a deficit can't be worse than
  // "all resources consumed, zero value delivered"). Display sites format the number directly
  // via fmtBalance(); the ~ prefix continues to mark projected state without distorting the value.
  const balancePercent = Math.max(-100, (ratio - 1) * 100)

  let grade: PentaEfficiency['grade']
  if (ratio >= 1.5)      grade = 'excellent'
  else if (ratio >= 1.0) grade = 'good'
  else if (ratio >= 0.6) grade = 'acceptable'
  else                   grade = 'poor'

  // Projected mode: any Status missing on either side → flag + note
  const isProjected = vMissingStatus > 0 || rMissingStatus > 0
  let projectionNote: string | undefined
  if (isProjected) {
    const parts: string[] = []
    if (rMissingStatus > 0) parts.push(`Resource Status pending on ${rMissingStatus} of ${rPairs.length}`)
    if (vMissingStatus > 0) parts.push(`Value Status pending on ${vMissingStatus} of ${vPairs.length}`)
    projectionNote = `Projected: ${parts.join(' · ')}. Record actual Status to lock in.`
  }

  return { valueAchievement, resourceUtilization, ratio, balancePercent, grade, cannotCompute: false, isProjected, projectionNote }
}

// ── Main composable ───────────────────────────────────────────────────────────

export interface UsePentaReturn {
  pentaModel:          ComputedRef<PentaModel | null>
  applyScaleToValue:   (entryId: string, factor: number) => SpecBlock | null
  applyScaleToResource:(entryId: string, factor: number) => SpecBlock | null
  applyScaleToAllValues:    (factor: number) => SpecBlock | null
  applyScaleToAllResources: (factor: number) => SpecBlock | null
  buildOptimaPrompt:   (cmd: PentaOptimaCmd) => string
}

export function usePenta(spec: Ref<SpecBlock | null>): UsePentaReturn {

  // ── Derived PentaModel ──────────────────────────────────────────────────────

  const pentaModel = computed<PentaModel | null>(() => {
    const s = spec.value
    if (!s) return null

    const functions   = s.functions ?? []
    const values      = s.values    ?? []
    const solutions   = s.solutions ?? []
    const constraints = s.constraints ?? []
    const resources   = s.resources   ?? []

    // Scope sector: F. entries (what system does) + C. entries (what it must NOT do / binary constraints)
    const stakeholderItems: PentaItem[] = [
      ...functions.map(f => ({
        id:           f.id,
        label:        mnemonicLabel(f.id, f.description),
        description:  f.description,
        type:         'function' as const,
        specOwner:    f.specOwner,
        stakeholders: f.stakeholders,
        justification:f.justification,
        version:      f.version,
        risks:        f.risks,
        tags:         f.level ? [f.level] : [],
        entryRef:     f.id,
      } satisfies PentaItem)),
      ...constraints.map(c => ({
        id:           c.id,
        label:        mnemonicLabel(c.id, c.description),
        description:  c.description,
        type:         'constraint' as const,
        specOwner:    c.specOwner,
        stakeholders: c.stakeholders,
        justification:c.justification,
        version:      c.version,
        risks:        c.risks,
        tags:         c.level ? [c.level] : [],
        entryRef:     c.id,
      } satisfies PentaItem)),
    ]

    const valueItems:    PentaItem[] = values.map(vEntryToItem)
    const resourceItems: PentaItem[] = resources.map(rEntryToItem)
    const designItems:   PentaItem[] = solutions.map(sol => ({
      id:           sol.id,
      label:        mnemonicLabel(sol.id, sol.description),
      description:  sol.description,
      type:         'solution' as const,
      impact:       sol.impact || undefined,
      specOwner:    sol.specOwner,
      stakeholders: sol.stakeholders,
      justification:sol.justification,
      version:      sol.version,
      risks:        sol.risks,
      tags:         sol.level ? [sol.level] : [],
      entryRef:     sol.id,
    } satisfies PentaItem))

    const efficiency = computeEfficiency(valueItems, resourceItems)

    // Efficiency sector shows the computed score as a single item for display.
    // r92c: when balance is huge, use ratio× notation instead of unreadable percent
    // ("417× cost" beats "+41567%" any day).
    const balanceN = efficiency.balancePercent
    const scoreText = Math.abs(balanceN) >= 1000
      ? `${balanceN > 0 ? '+' : '−'}${Math.round(Math.abs(balanceN) / 100 + 1)}× ratio`
      : `${balanceN > 0 ? '+' : ''}${Math.round(balanceN)}% score`
    const efficiencyItems: PentaItem[] = [
      {
        id:          'efficiency-ratio',
        label:       scoreText,
        description: `Efficiency ratio: ${efficiency.ratio.toFixed(2)} (${efficiency.grade}). Value achievement: ${Math.round(efficiency.valueAchievement * 100)}%. Resource utilisation: ${Math.round(efficiency.resourceUtilization * 100)}%.`,
        type:        'value',
        entryRef:    'efficiency-ratio',
      },
    ]

    function uniqueTags(items: PentaItem[]): string[] {
      return [...new Set(items.flatMap(i => i.tags ?? []))]
    }

    const sectors: Record<PentaSectorId, PentaSector> = {
      scope:        { id: 'scope', label: SECTOR_COLORS.scope.label, color: SECTOR_COLORS.scope.stroke, textColor: SECTOR_COLORS.scope.text, items: stakeholderItems, groupTags: uniqueTags(stakeholderItems) },
      values:       { id: 'values',       label: SECTOR_COLORS.values.label,       color: SECTOR_COLORS.values.stroke,       textColor: SECTOR_COLORS.values.text,       items: valueItems,       groupTags: uniqueTags(valueItems) },
      efficiency:   { id: 'efficiency',   label: SECTOR_COLORS.efficiency.label,   color: SECTOR_COLORS.efficiency.stroke,   textColor: SECTOR_COLORS.efficiency.text,   items: efficiencyItems,  groupTags: [] },
      resources:    { id: 'resources',    label: SECTOR_COLORS.resources.label,    color: SECTOR_COLORS.resources.stroke,    textColor: SECTOR_COLORS.resources.text,    items: resourceItems,    groupTags: uniqueTags(resourceItems) },
      design:       { id: 'design',       label: SECTOR_COLORS.design.label,       color: SECTOR_COLORS.design.stroke,       textColor: SECTOR_COLORS.design.text,       items: designItems,      groupTags: uniqueTags(designItems) },
    }

    return {
      sectors,
      efficiency,
      planName: '',
      specId:   '',
    }
  })

  // ── Spec mutation helpers (return new SpecBlock, caller emits update-spec) ──

  function applyScaleToValue(entryId: string, factor: number): SpecBlock | null {
    const s = spec.value
    if (!s) return null
    return {
      ...s,
      values: s.values.map(v => {
        if (v.id !== entryId) return v
        const goalNum    = parseThreshold(v.goal)
        const tolNum     = parseThreshold(v.tolerable)
        const statusNum  = parseThreshold(v.status)
        return {
          ...v,
          goal:      isNaN(goalNum)   ? v.goal      : String(Math.round(goalNum   * factor)),
          tolerable: isNaN(tolNum)    ? v.tolerable  : String(Math.round(tolNum   * factor)),
          status:    isNaN(statusNum) ? v.status     : String(Math.round(statusNum * factor)),
        }
      }),
    }
  }

  function applyScaleToResource(entryId: string, factor: number): SpecBlock | null {
    const s = spec.value
    if (!s) return null
    return {
      ...s,
      resources: (s.resources ?? []).map(r => {
        if (r.id !== entryId) return r
        const budgetNum = parseThreshold(rBudget(r))
        return {
          ...r,
          budget: isNaN(budgetNum) ? r.budget : String(Math.round(budgetNum * factor)),
        }
      }),
    }
  }

  function applyScaleToAllValues(factor: number): SpecBlock | null {
    const s = spec.value
    if (!s) return null
    // BUG FIX 2026-06-09: previous reduce chained applyScaleToValue() which
    // always re-reads spec.value (the original) — so each iteration returned a
    // fresh single-entry-scaled copy, discarding previous iterations' work.
    // Only the LAST entry ended up scaled.  Fix: one-pass map over all entries.
    return {
      ...s,
      values: s.values.map(v => {
        const goalNum   = parseThreshold(v.goal)
        const tolNum    = parseThreshold(v.tolerable)
        const statNum   = parseThreshold(v.status)
        return {
          ...v,
          goal:      isNaN(goalNum)  ? v.goal      : String(Math.round(goalNum  * factor)),
          tolerable: isNaN(tolNum)   ? v.tolerable  : String(Math.round(tolNum  * factor)),
          status:    isNaN(statNum)  ? v.status     : String(Math.round(statNum * factor)),
        }
      }),
    }
  }

  function applyScaleToAllResources(factor: number): SpecBlock | null {
    const s = spec.value
    if (!s) return null
    // Same fix: one-pass map instead of chained applyScaleToResource() calls.
    return {
      ...s,
      resources: (s.resources ?? []).map(r => {
        const budgetNum = parseThreshold(rBudget(r))
        return {
          ...r,
          budget: isNaN(budgetNum) ? r.budget : String(Math.round(budgetNum * factor)),
        }
      }),
    }
  }

  // ── PentaOptima prompt builder (Claude-Code-as-AI-Layer pattern) ────────────

  function buildOptimaPrompt(cmd: PentaOptimaCmd): string {
    const s = spec.value
    const specJson = s
      ? JSON.stringify({
          functions:   (s.functions   ?? []).map(f => ({ id: f.id, description: f.description })),
          values:      (s.values      ?? []).map(v => ({ id: v.id, description: v.description, scale: v.scale, tolerable: v.tolerable, goal: v.goal, status: v.status })),
          solutions:   (s.solutions   ?? []).map(sol => ({ id: sol.id, description: sol.description })),
          constraints: (s.constraints ?? []).map(c => ({ id: c.id, description: c.description })),
          resources:   (s.resources   ?? []).map(r => ({ id: r.id, description: r.description, scale: r.scale, budget: rBudget(r), status: r.status })),
        }, null, 2)
      : '(no spec loaded)'

    const effStr = pentaModel.value
      ? (() => {
          const b = pentaModel.value.efficiency.balancePercent
          const t = Math.abs(b) >= 1000
            ? `${b > 0 ? '+' : '−'}${Math.round(Math.abs(b) / 100 + 1)}× ratio`
            : `${Math.round(b)}%`
          return `Efficiency: ${t} (grade: ${pentaModel.value.efficiency.grade})`
        })()
      : '(no efficiency computed)'

    return `## PentaOptima Command — ${cmd.type}

### Requested change
${cmd.description}

### Current Penta Model state
${effStr}

### Full spec (Planguage JSON)
${specJson}

### Your task
Apply the requested change to the spec entries above. Follow these Planguage rules:
- Values (V.) use Tolerable (minimum non-failure), Goal (committed target), and optional Wish.
- Resources (R.) use Budget (official allocation) — never "Goal" for resources.
- Constraints (C.) are binary — must not be weakened without explicit stakeholder approval.
- Functions (F.) are presence/absence — do not turn them into quality measures.
- Solutions (S.) are implementable designs — keep descriptions actionable.

Return ONLY a JSON object in this exact shape (omit unchanged entries):
{
  "changes": [
    {
      "entryId": "V.ExampleValue",
      "field": "goal",
      "oldValue": "90",
      "newValue": "99",
      "rationale": "One sentence Planguage rationale"
    }
  ],
  "efficiencyImpact": "One sentence predicting how the Efficiency score will change",
  "warnings": ["Any constraint violations or Planguage standards concerns"]
}

Do not include explanatory prose outside the JSON object.`
  }

  return {
    pentaModel,
    applyScaleToValue,
    applyScaleToResource,
    applyScaleToAllValues,
    applyScaleToAllResources,
    buildOptimaPrompt,
    // Export constant so callers don't need to import separately
  }
}

// Re-export for callers who want only the colour map
export { PENTA_SECTOR_ORDER }
