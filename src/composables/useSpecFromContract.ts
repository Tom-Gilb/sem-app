// UNIT_TYPE=Composable
/**
 * useSpecFromContract — Contract → SpecBlock bridge.
 *
 * ━━ Bug fix: 2026-07-14 (Tom Gilb verbatim) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * *"I have the indianapolis contract in clearly but when I go to penta no
 * data from a project registers, this is true for some other sub apps"*.
 *
 * Root cause: Contracts mode stored entries in `useContractStore` (via
 * `allEntries` grouped-by-clause), but NOTHING populated `currentSpec` in
 * App.vue.  PentaPanel / MultiVisionPanel / ResourceOptimaPanel and every
 * other component receiving `:spec="currentSpec ?? specModel?.spec"` saw an
 * empty spec and rendered nothing.
 *
 * Fix (Direction 1 — Contract → Spec bridge, Tom-approved): a pure
 * function that shape-converts `PlanguageContractEntry[]` (the store's
 * flat list) into a `SpecBlock` (the shape every downstream tool
 * expects).  App.vue watches `contractStore.allEntries` and calls this
 * converter whenever the active contract's entries change.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * Twin-portable: no Vue reactivity, no browser APIs, no side effects.
 * Kai's Twin can adopt this pattern verbatim for its own contract → spec
 * transform (industrial procurement / SLA contracts → Planguage plans).
 *
 * Type mapping (ContractEntryType → SpecBlock bucket):
 *   'F'    → functions        (obligation as bare-noun capability + presenceTest)
 *   'V'    → values           (measurable performance: scale/meter/tolerable/goal/wish)
 *   'C'    → constraints      (binary rule; description = the "Must..." text)
 *   'R'    → resources        (budgeted quantity; goal-alias mapped to budget)
 *   'S'    → stakeholderEntries (party-specific duty holder)
 *   'Sol'  → solutions        (proposed design / policy)
 *   'Task' → solutions        (specific action item; folded into solutions as
 *                              closest SpecBlock cousin — SpecBlock has no Task
 *                              bucket.  Tag prefix preserves the distinction so
 *                              downstream renderers can filter if needed).
 *
 * All target-type entries carry a `source` provenance string of the form
 * "Contract Parse · <clauseRef> · <YYYY-MM-DD>" and `sourceType: 'ai'`
 * (per Source Attribution SUPREME) so PentaPanel + every other consumer
 * knows these were AI-derived from a contract, not user-typed.
 */

import type {
  SpecBlock,
  FEntry,
  VEntry,
  SEntry,
  CEntry,
  REntry,
  StakeholderEntry,
} from '../types/spec'
import type { PlanguageContractEntry } from '../types/contractTypes'

/** Today as YYYY-MM-DD for source stamps. */
function _today(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Build the canonical source stamp for a contract-derived entry. */
function _sourceStamp(clauseRef: string): string {
  return `Contract Parse · ${clauseRef} · ${_today()}`
}

/**
 * Pure function — no reactivity, no side effects.  Bucketises contract
 * entries into a SpecBlock.  Empty input → empty (but well-formed)
 * SpecBlock with every array populated (never undefined).
 */
export function contractEntriesToSpec(entries: PlanguageContractEntry[]): SpecBlock {
  const functions:          FEntry[]           = []
  const values:             VEntry[]           = []
  const solutions:          SEntry[]           = []
  const constraints:        CEntry[]           = []
  const resources:          REntry[]           = []
  const stakeholderEntries: StakeholderEntry[] = []

  if (!Array.isArray(entries)) {
    return { functions, values, solutions, constraints, resources, stakeholderEntries }
  }

  for (const e of entries) {
    const src        = e.source ?? _sourceStamp(e.clauseRef)
    const sourceType = e.sourceType ?? (e.llmGenerated ? 'ai' : 'human')

    switch (e.type) {
      case 'F': {
        const f: FEntry = {
          id:              e.tag,
          type:            'Function',
          level:           'Product',
          description:     e.description,
          presenceTest:    e.presenceTest ?? e.description,
          functionOfValue: '',
          stakeholders:    e.obligatedParty ?? '',
          source:          src,
          sourceType,
        }
        functions.push(f)
        break
      }
      case 'V': {
        const v: VEntry = {
          id:              e.tag,
          type:            'Value',
          level:           'Product',
          description:     e.description,
          scale:           e.scale     ?? '',
          meter:           e.meter     ?? '',
          status:          e.status    ?? '',
          tolerable:       e.tolerable ?? '',
          goal:            e.goal      ?? '',
          valueOfFunction: '',
          wish:            e.wish,
          past:            e.past,
          stakeholders:    e.obligatedParty ?? '',
          source:          src,
          sourceType,
        }
        values.push(v)
        break
      }
      case 'C': {
        const c: CEntry = {
          id:           e.tag,
          type:         'Constraint',
          level:        'Product',
          description:  e.constraintText ?? e.description,
          scope:        e.obligatedParty ?? '',
          rationale:    e.ambiguityNote  ?? '',
          stakeholders: e.obligatedParty ?? '',
          sourceType,
        }
        constraints.push(c)
        break
      }
      case 'R': {
        const r: REntry = {
          id:           e.tag,
          type:         'Resource',
          level:        'Product',
          description:  e.description,
          scale:        e.scale     ?? '',
          meter:        e.meter     ?? '',
          status:       e.status    ?? '',
          tolerable:    e.tolerable ?? '',
          budget:       e.goal,      // canonical Budget label per Tom Gilb 2026-06-07
          goal:         e.goal      ?? '',  // legacy back-compat (rBudget helper reads budget ?? goal)
          wish:         e.wish,
          stakeholders: e.obligatedParty ?? '',
          source:       src,
          sourceType,
        }
        resources.push(r)
        break
      }
      case 'S': {
        // Stakeholder — a party-specific duty holder identified by the contract
        // parse.  Description carries who the stakeholder is; obligatedParty
        // (when present) is the abbreviation the parse latched onto.
        const s: StakeholderEntry = {
          id:              e.tag,
          type:            'Stakeholder',
          stakeholderType: 'Direct',
          definition:      e.description,
          description:     e.rawSource,
          source:          src,
          sourceType,
        }
        stakeholderEntries.push(s)
        break
      }
      case 'Sol':
      case 'Task': {
        // Solutions AND Tasks fold into the solutions bucket — SpecBlock has
        // no Task type, and Sol/Task are the closest siblings semantically
        // (both are proposed designs / actions rather than measurements).
        // The tag prefix (`Sol.` or `Task.`) preserves the distinction if a
        // downstream renderer needs to filter.
        const sol: SEntry = {
          id:           e.tag,
          type:         e.type === 'Task' ? 'Task' : 'Solution',
          level:        'Product',
          description:  e.description,
          function:     '',
          impact:       '',   // legacy field required by SEntry shape
          mainImpacts:  '',
          stakeholders: e.obligatedParty ?? '',
          source:       src,
          sourceType,
        }
        solutions.push(sol)
        break
      }
    }
  }

  return {
    functions,
    values,
    solutions,
    constraints,
    resources,
    stakeholderEntries,
  }
}
