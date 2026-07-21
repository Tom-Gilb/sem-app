// UNIT_TYPE=Composable
// useRaciMatrix.ts — RACI matrix builder
// (Tom Gilb 2026-06-23 — Phase 2 of Roles redesign).
//
// PHASE 2 SCOPE
// Per Process (Evo Step or planning sub-step), enumerate which Stakeholders
// hold which RACI letters: Responsible / Accountable / Consulted / Informed.
// Sparse output — only populated cells emitted.  Derived from existing
// Stakeholder + Spec fields (specOwner, implementationResponsible, authority,
// defaultResponsibilities, heldRoles); ZERO new spec data required for v312
// — additional populations land in Phase 2.1+ when Tom requests them.
//
// CELL-POPULATION LOGIC (v312 baseline; pure derivation, no AI)
// • R (Responsible — does the work)
//     For each Evo Step: every Stakeholder whose id appears in any linked
//     Solution's implementationResponsible field gets R for that Process.
// • A (Accountable — owns the outcome; exactly one per Process ideally)
//     For each Evo Step: the Stakeholder whose id appears in the FIRST
//     linked Solution's specOwner field gets A.  If specOwner is absent,
//     authority is used as a fallback.
// • C (Consulted — input gatherer; many allowed)
//     Every Stakeholder whose defaultResponsibilities array contains the
//     words "review" / "consult" / "advise" / "approve" — these Roles are
//     by-design Consulted across all Processes.  Sparse: each such
//     Stakeholder yields one C cell per Process they have not already
//     received another letter for.
// • I (Informed — kept in the loop)
//     Every Stakeholder whose stakeholderType is 'Indirect' OR
//     'Regulatory' gets I across all Processes (one cell each).
//
// ISSUES the engine emits
//   • no-responsible       — Process has no R cell
//   • no-accountable       — Process has no A cell
//   • multiple-accountable — Process has 2+ A cells (Tom's R&A rule)
//
// COMPOSES WITH
// • Stakeholder Engineering (Gilb 2025) — Role IS Stakeholder
// • Solution Parameters SUPREME (v270) — specOwner / implementationResponsible
//   / authority are Tier-1/2 parameters that drive the matrix
// • Universal Undo SUPREME — pure read-side, no mutation, no Undo
// • AI-Max — sparse matrix triggers Sharpen suggestions in Phase 2.1
// • DD-009 Zero-Training UI — issues array surfaces in the Dashboard
// • Twin portability — pure function over SpecBlock + EvoStep[]

import type { SpecBlock, SEntry } from '../types/spec'
import type { EvoStep } from '../types/evo-plan'

// ── Public types ───────────────────────────────────────────────────────────

export type RaciLetter = 'R' | 'A' | 'C' | 'I'

export interface RaciCell {
  /** Process tag — e.g. 'evo-step:Diplomacy Channel' or 'substep:6.2'. */
  processId: string
  /** Display label for the Process (Evo Step name etc.). */
  processName: string
  /** Stakeholder mnemonic tag. */
  stakeholderId: string
  /** Display name — personName if set, else id. */
  stakeholderName: string
  /** RACI letters — usually one, occasionally multiple (e.g. ['R','A']). */
  letters: RaciLetter[]
}

export interface RaciIssue {
  processId: string
  processName: string
  issue: 'no-responsible' | 'no-accountable' | 'multiple-accountable'
}

export interface RaciMatrix {
  generatedAtIso: string
  planTitle: string
  cells: RaciCell[]
  /** Distinct Process count. */
  processCount: number
  /** Distinct Stakeholder count. */
  stakeholderCount: number
  /** Per-Process derived issues — every Process needs ≥1 R and exactly 1 A. */
  issues: RaciIssue[]
}

// ── Helpers ────────────────────────────────────────────────────────────────

function _now(): string {
  return new Date().toISOString()
}

const CONSULTED_PATTERN = /\b(review|consult|advise|approve|sign[\s-]?off)\b/i

function _displayName(stakeholderId: string, spec: SpecBlock): string {
  const s = (spec.stakeholderEntries ?? []).find(x => x.id === stakeholderId)
  if (!s) return stakeholderId
  if (s.personName && s.personName.trim().length > 0) return s.personName
  return s.id
}

/** Find the Solutions linked to an Evo Step by linkedSolutions name array. */
function _linkedSolutions(step: EvoStep, spec: SpecBlock): SEntry[] {
  const solutions = spec.solutions ?? []
  const linkedIds = step.linkedSolutions ?? []
  return solutions.filter(s => linkedIds.includes(s.id))
}

/** Add a letter to (processId, stakeholderId) — collapses duplicates. */
function _addLetter(
  cellMap: Map<string, RaciCell>,
  processId: string,
  processName: string,
  stakeholderId: string,
  stakeholderName: string,
  letter: RaciLetter,
): void {
  const key = `${processId}::${stakeholderId}`
  const existing = cellMap.get(key)
  if (existing) {
    if (!existing.letters.includes(letter)) existing.letters.push(letter)
    return
  }
  cellMap.set(key, {
    processId, processName, stakeholderId, stakeholderName,
    letters: [letter],
  })
}

// ── Public API ─────────────────────────────────────────────────────────────

export function buildRaciMatrix(
  spec: SpecBlock | null,
  evoSteps: EvoStep[],
  planTitle: string,
): RaciMatrix {
  const safeSpec: SpecBlock = spec ?? {
    functions: [], values: [], solutions: [], constraints: [], resources: [],
  }
  const stakeholders = safeSpec.stakeholderEntries ?? []
  const safeSteps    = evoSteps ?? []

  const cellMap = new Map<string, RaciCell>()
  const issues:  RaciIssue[] = []

  // ── Pass 1: per-Evo-Step R + A derivation ────────────────────────────────
  for (const step of safeSteps) {
    const processId   = `evo-step:${step.name}`
    const processName = step.name
    const solutions   = _linkedSolutions(step, safeSpec)

    // R: every Stakeholder named in any linked Solution's implementationResponsible
    const rIds = new Set<string>()
    for (const sol of solutions) {
      const ir = (sol.implementationResponsible ?? '').trim()
      if (ir.length > 0) rIds.add(ir)
    }
    for (const sId of rIds) {
      const sExists = stakeholders.some(s => s.id === sId)
      if (!sExists) continue
      _addLetter(cellMap, processId, processName, sId, _displayName(sId, safeSpec), 'R')
    }

    // A: FIRST linked Solution's specOwner; fallback to authority
    const aIds = new Set<string>()
    for (const sol of solutions) {
      const owner = (sol.specOwner ?? '').trim()
      if (owner.length > 0) { aIds.add(owner); break }
    }
    if (aIds.size === 0) {
      for (const sol of solutions) {
        const auth = (sol.authority ?? '').trim()
        if (auth.length > 0) { aIds.add(auth); break }
      }
    }
    for (const sId of aIds) {
      const sExists = stakeholders.some(s => s.id === sId)
      if (!sExists) continue
      _addLetter(cellMap, processId, processName, sId, _displayName(sId, safeSpec), 'A')
    }
  }

  // ── Pass 2: cross-Process C + I derivation ────────────────────────────────
  for (const step of safeSteps) {
    const processId   = `evo-step:${step.name}`
    const processName = step.name
    for (const s of stakeholders) {
      // C — defaultResponsibilities contains a consulted-pattern word
      const consultedByDefault = (s.defaultResponsibilities ?? [])
        .some(r => CONSULTED_PATTERN.test(r))
      if (consultedByDefault) {
        _addLetter(cellMap, processId, processName, s.id, _displayName(s.id, safeSpec), 'C')
      }
      // I — Indirect / Regulatory Stakeholders by classification
      if (s.stakeholderType === 'Indirect' || s.stakeholderType === 'Regulatory') {
        _addLetter(cellMap, processId, processName, s.id, _displayName(s.id, safeSpec), 'I')
      }
    }
  }

  // ── Issue derivation per Process ──────────────────────────────────────────
  const cells = [...cellMap.values()]
  const processIds = new Set(cells.map(c => c.processId))
  // Also include processes that may have zero cells:
  for (const step of safeSteps) processIds.add(`evo-step:${step.name}`)
  for (const processId of processIds) {
    const processName = cells.find(c => c.processId === processId)?.processName
      ?? processId.replace(/^evo-step:/, '')
    const inProcess = cells.filter(c => c.processId === processId)
    const rCount = inProcess.filter(c => c.letters.includes('R')).length
    const aCount = inProcess.filter(c => c.letters.includes('A')).length
    if (rCount === 0) issues.push({ processId, processName, issue: 'no-responsible' })
    if (aCount === 0) issues.push({ processId, processName, issue: 'no-accountable' })
    if (aCount >= 2) issues.push({ processId, processName, issue: 'multiple-accountable' })
  }

  // Distinct counts.
  const stakeholderCount = new Set(cells.map(c => c.stakeholderId)).size

  return {
    generatedAtIso: _now(),
    planTitle,
    cells,
    processCount: processIds.size,
    stakeholderCount,
    issues,
  }
}
