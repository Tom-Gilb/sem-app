// UNIT_TYPE=Composable
// useRoleFlowModel.ts — Phase 3 of the Roles redesign (Tom Gilb 2026-06-23,
// 14-point spec #10): "We should be able to generate a Role diagram with all
// stakeholders, and how they relate to all Planguage specs (like Values,
// costs, solutions, other stakeholders). This can use logic and format of
// Value Flow diagram and Near neighbors diagrams."
//
// Pure-function builder. Takes (spec, roleHealthReport, evoSteps), produces a
// 5-column Role-Flow model:
//   1. Roles (Position-type Stakeholders)      indigo
//   2. People (Person-type Stakeholders)       indigo lighter
//   3. Solutions they own                      amber
//   4. Values they care about                  violet
//   5. Resources they consume                  teal
//
// Edge inference (text-match per the existing ValueFlowDiagram pattern):
//   • Person → Role         from StakeholderEntry.heldRoles[]
//   • Role  → Solution      from SEntry.specOwner + .implementationResponsible
//   • Role  → Value         from VEntry.wishStakeholder
//   • Role  → Resource      from REntry.specOwner
//
// Composes with:
//   • Stakeholder Engineering (Gilb 2025) — Role IS Stakeholder; the diagram
//     is a Stakeholder-centric view of how Roles bind to spec entries
//   • r93jjj Qualifiers + r93mmm Infinity-Trap — orphan-Role / orphan-Solution
//     counts surface as Plan Health Indicator hooks (Phase 4 wiring)
//   • Conjunction-of-Technologies SUPREME — Phase 4 will request AI suggestions
//     for orphan rows, citing Gilb-corpus owner-discipline passages
//   • Universal Undo — pure read-side composable, no mutation, no Undo wiring
//   • Twin portability — pure function over plain SpecBlock + RoleHealthReport
//   • DD-017 R-G colorblind-safe — indigo / amber / violet / teal palette;
//     RAG dot on Role/Person nodes carries the text label too, not colour alone

import type { SpecBlock } from '../types/spec'
import type { EvoStep } from '../types/evo-plan'
import type { RoleHealthReport, StakeholderHealth } from './useRoleHealthScore'

// ── Public types ───────────────────────────────────────────────────────────

export type RoleFlowNodeKind = 'role' | 'person' | 'solution' | 'value' | 'resource'

export interface RoleFlowNode {
  /** Stable node id — `{kind}::{specId}` for de-duplication. */
  id: string
  /** Original spec entry id (Stakeholder, Solution, Value, Resource). */
  specId: string
  kind: RoleFlowNodeKind
  /** Primary display label (Stakeholder name or spec tag). */
  label: string
  /** Optional secondary line — Position chip for Person nodes, scale for Value nodes. */
  subLabel?: string
  /** RAG band — only on role + person nodes. */
  rag?: 'red' | 'amber' | 'green'
  /** Per-Stakeholder Health Score 0-100 — only on role + person nodes. */
  score?: number
  /** Musk-#14 placeholder flag — only on role + person nodes. */
  isPlaceholder?: boolean
  /** Canonical fill colour for the node body. */
  fillHex: string
  /** Canonical text colour for label + sub-label. */
  textHex: string
  /** Canonical border colour. */
  borderHex: string
}

export type RoleFlowEdgeKind =
  | 'holds-role'         // Person → Role
  | 'owns-solution'      // Role → Solution (specOwner / implementationResponsible)
  | 'cares-about-value'  // Role → Value (wishStakeholder)
  | 'consumes-resource'  // Role → Resource (specOwner)

export interface RoleFlowEdge {
  /** Source node id (the actor). */
  source: string
  /** Target node id (the thing the actor relates to). */
  target: string
  kind: RoleFlowEdgeKind
  /** Which spec field this edge was inferred from (HoverHint copy). */
  sourceField: string
  /** SVG line style. */
  style: 'solid' | 'dashed'
  /** Canonical edge colour. */
  colorHex: string
}

export interface RoleFlowStats {
  roleCount: number
  personCount: number
  solutionCount: number
  valueCount: number
  resourceCount: number
  edgeCount: number
  placeholderCount: number
  /** Stakeholders with NO outgoing edges — likely Role-Agent fix-targets. */
  orphanRoleCount: number
  /** Solutions with no Stakeholder edge in (no specOwner/implementationResponsible binding). */
  orphanSolutionCount: number
  /** Values with no Stakeholder edge in (no wishStakeholder binding). */
  orphanValueCount: number
  /** Resources with no Stakeholder edge in (no specOwner binding). */
  orphanResourceCount: number
  /** Roles whose Phase-2 Health Score landed RED. */
  redRoleCount: number
}

export interface RoleFlowModel {
  generatedAtIso: string
  planTitle: string
  columns: {
    roles: RoleFlowNode[]
    people: RoleFlowNode[]
    solutions: RoleFlowNode[]
    values: RoleFlowNode[]
    resources: RoleFlowNode[]
  }
  edges: RoleFlowEdge[]
  stats: RoleFlowStats
}

// ── Palette — DD-017 R-G colorblind-safe ──────────────────────────────────

const PALETTE = {
  role:      { fill: '#eef2ff', text: '#312e81', border: '#6366f1' }, // indigo
  person:    { fill: '#e0e7ff', text: '#3730a3', border: '#818cf8' }, // indigo lighter
  solution:  { fill: '#fff7ed', text: '#9a3412', border: '#fb923c' }, // amber/orange
  value:     { fill: '#f5f3ff', text: '#5b21b6', border: '#a78bfa' }, // violet
  resource:  { fill: '#f0fdfa', text: '#0f766e', border: '#14b8a6' }, // teal
}

const EDGE_COLOR = {
  'holds-role':         '#6366f1', // indigo
  'owns-solution':      '#ea580c', // orange-600
  'cares-about-value':  '#7c3aed', // violet-600
  'consumes-resource':  '#0d9488', // teal-600
}

// ── Helpers ────────────────────────────────────────────────────────────────

function _now(): string {
  return new Date().toISOString()
}

/**
 * Strip wikilink brackets / leading type prefix.
 * "[[Stakeholder.Maria]]" → "Stakeholder.Maria" → "Maria" (trailing path part).
 * "S.Foo" stays "S.Foo".
 */
function _normaliseRef(raw: string): string {
  const stripped = raw.trim()
    .replace(/^\[\[/, '')
    .replace(/\]\]$/, '')
    .trim()
  if (!stripped) return ''
  // For tags like "Stakeholder.Maria" the canonical id might be just "Maria";
  // we keep the full form AND the last dotted segment for matching below.
  return stripped
}

/** Split a comma/semicolon-separated list of Stakeholder references. */
function _splitRefs(text: string | null | undefined): string[] {
  if (!text) return []
  return [...new Set(
    text
      .split(/[,;\n]+/)
      .map(s => _normaliseRef(s))
      .filter(Boolean)
  )]
}

/**
 * Match a free-text Stakeholder reference against the known Stakeholder list.
 * Returns the StakeholderEntry.id of the first match (case-insensitive,
 * tolerates "Stakeholder.X" wikilink form, name-or-id match).
 */
function _matchStakeholderId(
  ref: string,
  stakeholders: Array<{ id: string; personName?: string; position?: string }>,
): string | null {
  if (!ref) return null
  const refLower = ref.toLowerCase()
  // Strip a leading "Stakeholder." prefix if present.
  const trimmed = ref.replace(/^Stakeholder\./i, '').trim()
  const trimmedLower = trimmed.toLowerCase()
  // Take the last dotted segment as a secondary fallback (handles "Plan.Stakeholders.Maria").
  const lastSeg = trimmed.split('.').pop() ?? trimmed
  const lastSegLower = lastSeg.toLowerCase()

  for (const s of stakeholders) {
    if (s.id.toLowerCase() === refLower)      return s.id
    if (s.id.toLowerCase() === trimmedLower)  return s.id
    if (s.id.toLowerCase() === lastSegLower)  return s.id
    if (s.personName && s.personName.trim().toLowerCase() === refLower)      return s.id
    if (s.personName && s.personName.trim().toLowerCase() === trimmedLower)  return s.id
    if (s.position   && s.position.trim().toLowerCase()   === refLower)      return s.id
    if (s.position   && s.position.trim().toLowerCase()   === trimmedLower)  return s.id
  }
  return null
}

/**
 * Classify a Stakeholder entry into Role (Position) vs Person.
 * Heuristic (per the spec):
 *   • personName set + non-empty → Person
 *   • else position set + non-empty → Role
 *   • else (legacy bare Stakeholder) → Role (column 1) by default — so it
 *     appears somewhere; the Role Agent can flag the missing fields.
 */
function _classifyStakeholder(s: { position?: string; personName?: string }): 'role' | 'person' {
  const hasPerson   = !!(s.personName && s.personName.trim())
  const hasPosition = !!(s.position && s.position.trim())
  if (hasPerson) return 'person'
  if (hasPosition) return 'role'
  return 'role'
}

// ── Public API ─────────────────────────────────────────────────────────────

export function buildRoleFlowModel(
  spec: SpecBlock | null,
  roleHealthReport: RoleHealthReport | null,
  evoSteps: EvoStep[] | null,
): RoleFlowModel {
  // Currently evoSteps is reserved for future RACI overlay in Phase 3.1 —
  // the parameter is accepted now so call sites are stable across phases.
  void evoSteps

  const safeSpec: SpecBlock = spec ?? {
    functions: [], values: [], solutions: [], constraints: [], resources: [],
  }
  const stakeholders = safeSpec.stakeholderEntries ?? []
  const values       = safeSpec.values    ?? []
  const solutions    = safeSpec.solutions ?? []
  const resources    = safeSpec.resources ?? []

  // Health lookup by stakeholder id.
  const healthById = new Map<string, StakeholderHealth>()
  for (const h of (roleHealthReport?.perStakeholder ?? [])) {
    healthById.set(h.stakeholderId, h)
  }

  // ── Build Role + Person nodes ──────────────────────────────────────────
  const roleNodes:   RoleFlowNode[] = []
  const personNodes: RoleFlowNode[] = []
  for (const s of stakeholders) {
    const kind = _classifyStakeholder(s)
    const palette = kind === 'role' ? PALETTE.role : PALETTE.person
    const h = healthById.get(s.id)
    const label = (s.personName && s.personName.trim().length > 0)
      ? s.personName.trim()
      : s.id
    const subLabel = s.position && s.position.trim() ? s.position.trim() : undefined
    const node: RoleFlowNode = {
      id:           `${kind}::${s.id}`,
      specId:       s.id,
      kind,
      label,
      subLabel,
      rag:          h?.rag,
      score:        h?.score,
      isPlaceholder: s.isPlaceholder === true,
      fillHex:      palette.fill,
      textHex:      palette.text,
      borderHex:    palette.border,
    }
    if (kind === 'role') roleNodes.push(node)
    else                  personNodes.push(node)
  }

  // ── Build Solution nodes ───────────────────────────────────────────────
  const solutionNodes: RoleFlowNode[] = solutions.map(sol => ({
    id:           `solution::${sol.id}`,
    specId:       sol.id,
    kind:         'solution',
    label:        sol.id,
    subLabel:     sol.description ? sol.description.slice(0, 60) : undefined,
    fillHex:      PALETTE.solution.fill,
    textHex:      PALETTE.solution.text,
    borderHex:    PALETTE.solution.border,
  }))

  // ── Build Value nodes ──────────────────────────────────────────────────
  const valueNodes: RoleFlowNode[] = values.map(v => ({
    id:           `value::${v.id}`,
    specId:       v.id,
    kind:         'value',
    label:        v.id,
    subLabel:     v.scale ? v.scale.slice(0, 60) : (v.description ? v.description.slice(0, 60) : undefined),
    fillHex:      PALETTE.value.fill,
    textHex:      PALETTE.value.text,
    borderHex:    PALETTE.value.border,
  }))

  // ── Build Resource nodes ───────────────────────────────────────────────
  const resourceNodes: RoleFlowNode[] = resources.map(r => ({
    id:           `resource::${r.id}`,
    specId:       r.id,
    kind:         'resource',
    label:        r.id,
    subLabel:     r.scale ? r.scale.slice(0, 60) : (r.description ? r.description.slice(0, 60) : undefined),
    fillHex:      PALETTE.resource.fill,
    textHex:      PALETTE.resource.text,
    borderHex:    PALETTE.resource.border,
  }))

  // ── Edge inference ─────────────────────────────────────────────────────
  const edges: RoleFlowEdge[] = []
  const sourceIdsBySolution = new Set<string>()
  const sourceIdsByValue    = new Set<string>()
  const sourceIdsByResource = new Set<string>()
  const outgoingByStakeholder = new Map<string, number>()
  for (const s of stakeholders) outgoingByStakeholder.set(s.id, 0)

  // (1) Person → Role  (heldRoles[])
  for (const s of stakeholders) {
    if (!s.heldRoles || s.heldRoles.length === 0) continue
    const sourceKind = _classifyStakeholder(s)
    if (sourceKind !== 'person') continue  // Only Person → Role; ignore Role-holds-Role
    for (const heldRef of s.heldRoles) {
      const targetId = _matchStakeholderId(heldRef, stakeholders)
      if (!targetId) continue
      const targetEntry = stakeholders.find(x => x.id === targetId)
      if (!targetEntry) continue
      const targetKind = _classifyStakeholder(targetEntry)
      if (targetKind !== 'role') continue
      edges.push({
        source:      `person::${s.id}`,
        target:      `role::${targetId}`,
        kind:        'holds-role',
        sourceField: 'Stakeholder.heldRoles',
        style:       'solid',
        colorHex:    EDGE_COLOR['holds-role'],
      })
      outgoingByStakeholder.set(s.id, (outgoingByStakeholder.get(s.id) ?? 0) + 1)
    }
  }

  // (2) Role/Person → Solution  (specOwner + implementationResponsible)
  for (const sol of solutions) {
    const ownerRefs    = _splitRefs(sol.specOwner)
    const implRefs     = _splitRefs(sol.implementationResponsible)
    const allRefs: Array<{ ref: string; field: string }> = [
      ...ownerRefs.map(r => ({ ref: r, field: 'Solution.specOwner' })),
      ...implRefs.map(r  => ({ ref: r, field: 'Solution.implementationResponsible' })),
    ]
    for (const { ref, field } of allRefs) {
      const sId = _matchStakeholderId(ref, stakeholders)
      if (!sId) continue
      const sEntry = stakeholders.find(x => x.id === sId)
      if (!sEntry) continue
      const sourceKind = _classifyStakeholder(sEntry)
      edges.push({
        source:      `${sourceKind}::${sId}`,
        target:      `solution::${sol.id}`,
        kind:        'owns-solution',
        sourceField: field,
        style:       'solid',
        colorHex:    EDGE_COLOR['owns-solution'],
      })
      outgoingByStakeholder.set(sId, (outgoingByStakeholder.get(sId) ?? 0) + 1)
      sourceIdsBySolution.add(sol.id)
    }
  }

  // (3) Role/Person → Value  (wishStakeholder)
  for (const v of values) {
    const refs = _splitRefs(v.wishStakeholder)
    for (const ref of refs) {
      const sId = _matchStakeholderId(ref, stakeholders)
      if (!sId) continue
      const sEntry = stakeholders.find(x => x.id === sId)
      if (!sEntry) continue
      const sourceKind = _classifyStakeholder(sEntry)
      edges.push({
        source:      `${sourceKind}::${sId}`,
        target:      `value::${v.id}`,
        kind:        'cares-about-value',
        sourceField: 'Value.wishStakeholder',
        style:       'dashed',
        colorHex:    EDGE_COLOR['cares-about-value'],
      })
      outgoingByStakeholder.set(sId, (outgoingByStakeholder.get(sId) ?? 0) + 1)
      sourceIdsByValue.add(v.id)
    }
  }

  // (4) Role/Person → Resource  (specOwner)
  for (const r of resources) {
    const refs = _splitRefs(r.specOwner)
    for (const ref of refs) {
      const sId = _matchStakeholderId(ref, stakeholders)
      if (!sId) continue
      const sEntry = stakeholders.find(x => x.id === sId)
      if (!sEntry) continue
      const sourceKind = _classifyStakeholder(sEntry)
      edges.push({
        source:      `${sourceKind}::${sId}`,
        target:      `resource::${r.id}`,
        kind:        'consumes-resource',
        sourceField: 'Resource.specOwner',
        style:       'dashed',
        colorHex:    EDGE_COLOR['consumes-resource'],
      })
      outgoingByStakeholder.set(sId, (outgoingByStakeholder.get(sId) ?? 0) + 1)
      sourceIdsByResource.add(r.id)
    }
  }

  // ── Stats ──────────────────────────────────────────────────────────────
  const placeholderCount     = stakeholders.filter(s => s.isPlaceholder === true).length
  const orphanRoleCount      = stakeholders.filter(s => (outgoingByStakeholder.get(s.id) ?? 0) === 0).length
  const orphanSolutionCount  = solutions.filter(sol => !sourceIdsBySolution.has(sol.id)).length
  const orphanValueCount     = values.filter(v => !sourceIdsByValue.has(v.id)).length
  const orphanResourceCount  = resources.filter(r => !sourceIdsByResource.has(r.id)).length
  const redRoleCount         = roleNodes.filter(n => n.rag === 'red').length
                              + personNodes.filter(n => n.rag === 'red').length

  const stats: RoleFlowStats = {
    roleCount:           roleNodes.length,
    personCount:         personNodes.length,
    solutionCount:       solutionNodes.length,
    valueCount:          valueNodes.length,
    resourceCount:       resourceNodes.length,
    edgeCount:           edges.length,
    placeholderCount,
    orphanRoleCount,
    orphanSolutionCount,
    orphanValueCount,
    orphanResourceCount,
    redRoleCount,
  }

  return {
    generatedAtIso: _now(),
    planTitle:      roleHealthReport?.planTitle ?? '',
    columns: {
      roles:     roleNodes,
      people:    personNodes,
      solutions: solutionNodes,
      values:    valueNodes,
      resources: resourceNodes,
    },
    edges,
    stats,
  }
}
