// UNIT_TYPE=Composable
/**
 * useContractStore — Singleton store for all Contracts mode data.
 *
 * Persistence: localStorage key 'sem-app:contracts:v1'
 * Pattern: mirrors usePlanModel.ts (load-on-init, auto-persist on mutation).
 *
 * All state is module-level (singleton) — Vue components share one source
 * of truth. Reactive refs are returned per composable call but point to the
 * same underlying refs.
 */

import { ref, computed } from 'vue'
import type {
  ContractModel,
  ContractClause,
  ContractParty,
  PlanguageContractEntry,
  ContractEntryType,
  ContractType,
  ContractParseStatus,
} from '../types/contractTypes'

// ── Storage ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'sem-app:contracts:v1'
const CURRENT_KEY = 'sem-app:contracts:current:v1'
const SNAPSHOT_KEY    = 'sem-contract-snapshots-v1'
const MAX_SNAPSHOTS   = 20

// ── Helpers ───────────────────────────────────────────────────────────────────

function _now(): string {
  return new Date().toISOString()
}

function _uuid(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)
}

function _migrate(c: ContractModel): ContractModel {
  // Future: add field migrations here when schemaVersion bumps.
  return {
    entryCounters: { F: 0, V: 0, C: 0, R: 0, S: 0, Task: 0 },
    ...c,
    schemaVersion: 1,
  }
}

// ── Contract snapshot ─────────────────────────────────────────────────────────

/**
 * A lightweight snapshot of a fully-parsed contract — stored separately from
 * the live ContractModel so HistoryPanel can list past analyses without loading
 * the full clause payload.  The `contractId` field links back to the live record
 * in `_contracts` for "restore" (switch current contract) operations.
 *
 * Twin-portable: no Vue types, no browser APIs, plain serialisable record.
 */
export interface ContractSnapshot {
  id:                 string
  contractId:         string
  contractTitle:      string
  contractType:       ContractType
  takenAt:            string       // ISO
  clauseCount:        number
  entryCount:         number
  entryTypeBreakdown: Partial<Record<ContractEntryType, number>>
}

function _loadSnapshots(): ContractSnapshot[] {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY)
    if (!raw) return []
    return JSON.parse(raw) as ContractSnapshot[]
  } catch {
    return []
  }
}

function _saveSnapshots(snaps: ContractSnapshot[]): void {
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snaps))
  } catch { /* ignore */ }
}

// ── Persistence ───────────────────────────────────────────────────────────────

function _loadAll(): ContractModel[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ContractModel[]
    return Array.isArray(parsed) ? parsed.map(_migrate) : []
  } catch {
    return []
  }
}

function _saveAll(contracts: ContractModel[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(contracts))
  } catch {
    // localStorage full or unavailable — fail silently
  }
}

function _loadCurrentId(): string | null {
  try {
    return localStorage.getItem(CURRENT_KEY) ?? null
  } catch {
    return null
  }
}

function _saveCurrentId(id: string | null): void {
  try {
    if (id) localStorage.setItem(CURRENT_KEY, id)
    else localStorage.removeItem(CURRENT_KEY)
  } catch { /* ignore */ }
}

// ── Singleton state ───────────────────────────────────────────────────────────

const _contracts    = ref<ContractModel[]>(_loadAll())
const _currentId    = ref<string | null>(_loadCurrentId())
const _snapshots = ref<ContractSnapshot[]>(_loadSnapshots())

// ── Derived ───────────────────────────────────────────────────────────────────

const _currentContract = computed<ContractModel | null>(() =>
  _contracts.value.find(c => c.id === _currentId.value) ?? null
)

// ── Internal mutators ─────────────────────────────────────────────────────────

function _upsert(contract: ContractModel): void {
  const idx = _contracts.value.findIndex(c => c.id === contract.id)
  if (idx >= 0) {
    _contracts.value[idx] = { ...contract, updatedAt: _now() }
  } else {
    _contracts.value.unshift(contract)
  }
  _saveAll(_contracts.value)
}

/** Take a lightweight snapshot of a contract when all its clauses are parsed. */
function _takeSnapshot(contractId: string): void {
  const c = _contracts.value.find(x => x.id === contractId)
  if (!c) return
  const allEntries = c.clauses.flatMap(cl => cl.entries)
  const breakdown: Partial<Record<ContractEntryType, number>> = {}
  for (const e of allEntries) {
    breakdown[e.type] = (breakdown[e.type] ?? 0) + 1
  }
  const snap: ContractSnapshot = {
    id:                 `csnap-${Date.now()}`,
    contractId:         c.id,
    contractTitle:      c.title,
    contractType:       c.contractType,
    takenAt:            _now(),
    clauseCount:        c.clauses.length,
    entryCount:         allEntries.length,
    entryTypeBreakdown: breakdown,
  }
  const updated = [snap, ..._snapshots.value].slice(0, MAX_SNAPSHOTS)
  _snapshots.value = updated
  _saveSnapshots(updated)
}

// ── Public API ────────────────────────────────────────────────────────────────

export function useContractStore() {

  /** Create a blank ContractModel and set it as current. */
  function createContract(
    title: string,
    contractType: ContractType = 'other',
    parties: ContractParty[] = [],
  ): ContractModel {
    const contract: ContractModel = {
      id:            _uuid(),
      title,
      contractType,
      parties,
      clauses:       [],
      parseStatus:   'empty',
      entryCounters: { F: 0, V: 0, C: 0, R: 0, S: 0, Task: 0 },
      createdAt:     _now(),
      updatedAt:     _now(),
      schemaVersion: 1,
    }
    _upsert(contract)
    setCurrentContract(contract.id)
    return contract
  }

  /** Update top-level fields on a contract (merges, does not replace clauses). */
  function updateContract(
    id: string,
    patch: Partial<Pick<ContractModel,
      'title' | 'subtitle' | 'contractType' | 'effectiveDate' | 'expiryDate' |
      'jurisdiction' | 'governingLaw' | 'parties' | 'rawImportText' | 'parseStatus' | 'parseError'
    >>,
  ): void {
    const c = _contracts.value.find(x => x.id === id)
    if (!c) return
    _upsert({ ...c, ...patch })
  }

  /** Delete a contract entirely. If it was current, unset current. */
  function deleteContract(id: string): void {
    _contracts.value = _contracts.value.filter(c => c.id !== id)
    _saveAll(_contracts.value)
    if (_currentId.value === id) {
      _currentId.value = null
      _saveCurrentId(null)
    }
  }

  /** Replace the full clauses array (used after phase-1 LLM split). */
  function setClauses(contractId: string, clauses: ContractClause[]): void {
    const c = _contracts.value.find(x => x.id === contractId)
    if (!c) return
    _upsert({ ...c, clauses })
  }

  /** Replace the parsed entries on a single clause. */
  function setClauseEntries(
    contractId: string,
    clauseId: string,
    entries: PlanguageContractEntry[],
    parseStatus: ContractClause['parseStatus'],
    parseError?: string,
  ): void {
    const c = _contracts.value.find(x => x.id === contractId)
    if (!c) return
    const updatedClauses = c.clauses.map(cl =>
      cl.id === clauseId
        ? { ...cl, entries, parseStatus, parseError }
        : cl
    )
    _upsert({ ...c, clauses: updatedClauses })
    // Auto-snapshot when all clauses have finished parsing.
    const updated2 = _contracts.value.find(x => x.id === contractId)
    if (
      updated2 &&
      updated2.clauses.length > 0 &&
      updated2.clauses.every(cl => cl.parseStatus === 'done')
    ) {
      _takeSnapshot(contractId)
    }
  }

  /** Mark a single clause as currently being parsed. */
  function setClauseParseStatus(
    contractId: string,
    clauseId: string,
    status: ContractClause['parseStatus'],
    error?: string,
  ): void {
    const c = _contracts.value.find(x => x.id === contractId)
    if (!c) return
    const updatedClauses = c.clauses.map(cl =>
      cl.id === clauseId
        ? { ...cl, parseStatus: status, parseError: error }
        : cl
    )
    _upsert({ ...c, clauses: updatedClauses })
  }

  /** Increment and return the next sequential tag for a given entry type. */
  function nextTag(contractId: string, type: ContractEntryType): string {
    const c = _contracts.value.find(x => x.id === contractId)
    if (!c) return `${type}.1`
    const next = (c.entryCounters[type] ?? 0) + 1
    _upsert({ ...c, entryCounters: { ...c.entryCounters, [type]: next } })
    return `${type}.${next}`
  }

  function setCurrentContract(id: string | null): void {
    _currentId.value = id
    _saveCurrentId(id)
  }

  // ── Computed helpers ──────────────────────────────────────────────────────

  /** All Planguage entries across all clauses for the current contract. */
  const allEntries = computed<PlanguageContractEntry[]>(() =>
    _currentContract.value?.clauses.flatMap(cl => cl.entries) ?? []
  )

  /** Entry counts by type for the current contract. */
  const entryCounts = computed(() => {
    const counts: Record<ContractEntryType, number> = { F: 0, V: 0, C: 0, R: 0, S: 0, Task: 0 }
    for (const e of allEntries.value) counts[e.type]++
    return counts
  })

  /** Obligation matrix: party abbreviation → entries grouped by type. */
  const obligationMatrix = computed(() => {
    const contract = _currentContract.value
    if (!contract) return {}
    const matrix: Record<string, Partial<Record<ContractEntryType, PlanguageContractEntry[]>>> = {}
    for (const party of contract.parties) {
      matrix[party.abbreviation] = {}
    }
    matrix['ALL'] = {}
    for (const e of allEntries.value) {
      const key = e.obligatedParty ?? 'ALL'
      if (!matrix[key]) matrix[key] = {}
      if (!matrix[key][e.type]) matrix[key][e.type] = []
      matrix[key][e.type]!.push(e)
    }
    return matrix
  })

  /** Overall parse status summary across all clauses. */
  const overallParseStatus = computed((): ContractParseStatus => {
    const c = _currentContract.value
    if (!c || c.clauses.length === 0) return c?.parseStatus ?? 'empty'
    if (c.clauses.some(cl => cl.parseStatus === 'parsing')) return 'parsing'
    if (c.clauses.every(cl => cl.parseStatus === 'done')) return 'complete'
    if (c.clauses.some(cl => cl.parseStatus === 'error')) return 'error'
    return c.parseStatus
  })

  return {
    contracts:         _contracts,
    currentId:         _currentId,
    currentContract:   _currentContract,
    contractSnapshots: _snapshots,
    allEntries,
    entryCounts,
    obligationMatrix,
    overallParseStatus,
    createContract,
    updateContract,
    deleteContract,
    setClauses,
    setClauseEntries,
    setClauseParseStatus,
    nextTag,
    setCurrentContract,
  }
}
