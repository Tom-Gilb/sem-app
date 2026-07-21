// UNIT_TYPE=Composable
// useAutoDbo.ts — Auto-DBO singleton store
// Manages Solution Versions in localStorage under 'sem-dbo:versions:v1'
// Pattern: module-level singleton ref (same as useContractStore pattern)

import { ref, computed, readonly } from 'vue'
import type { SpecBlock } from '../types/spec'
import type {
  SolutionVersion,
  AutoDboStore,
  SolutionVersionPurpose,
  DboSharpenRecord,
  DboImpactCell,
} from '../types/autoDbo'

const STORAGE_KEY = 'sem-dbo:versions:v1'

// ── Helpers ──────────────────────────────────────────────────────────────────

function genId(): string {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 7)
  return `dbo-${ts}-${rand}`
}

function nextVersionNumber(versions: SolutionVersion[]): string {
  return `v${versions.length + 1}.0`
}

function nowIso(): string {
  return new Date().toISOString()
}

function loadStore(): AutoDboStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as AutoDboStore
  } catch { /* ignore */ }
  return { versions: [], activeVersionId: null }
}

function saveStore(store: AutoDboStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch { /* localStorage full — fail silently */ }
}

// ── Module-level singleton ───────────────────────────────────────────────────

const _store = ref<AutoDboStore>(loadStore())

// ── Composable ───────────────────────────────────────────────────────────────

export function useAutoDbo() {
  const versions     = computed(() => _store.value.versions)
  const activeVersionId = computed(() => _store.value.activeVersionId)
  const activeVersion   = computed<SolutionVersion | null>(() =>
    _store.value.versions.find(v => v.id === _store.value.activeVersionId) ?? null,
  )
  const draftCount    = computed(() => _store.value.versions.filter(v => v.status === 'draft').length)
  const approvedCount = computed(() => _store.value.versions.filter(v => v.status === 'approved').length)

  function _persist(): void { saveStore(_store.value) }

  /** Create a new version from a snapshot of the master spec. */
  function createVersion(
    masterSpec: SpecBlock,
    opts: {
      name: string
      purpose: SolutionVersionPurpose
      purposeCustom?: string
      description?: string
    },
  ): SolutionVersion {
    const id = genId()
    const v: SolutionVersion = {
      id,
      name: opts.name || `Design Version ${_store.value.versions.length + 1}`,
      versionNumber: nextVersionNumber(_store.value.versions),
      dateCreated: nowIso(),
      dateModified: nowIso(),
      purpose: opts.purpose,
      purposeCustom: opts.purposeCustom ?? '',
      status: 'draft',
      description: opts.description ?? '',
      specSnapshot: JSON.parse(JSON.stringify(masterSpec)),
      sharpeningHistory: [],
      impactEstimates: [],
      notes: '',
      tags: [],
    }
    _store.value.versions.push(v)
    _store.value.activeVersionId = id
    _persist()
    return v
  }

  /** Fork an existing version into a new draft. */
  function forkVersion(
    fromId: string,
    opts: { name: string; purpose: SolutionVersionPurpose; purposeCustom?: string; description?: string },
  ): SolutionVersion | null {
    const source = _store.value.versions.find(v => v.id === fromId)
    if (!source) return null
    const id = genId()
    const v: SolutionVersion = {
      ...JSON.parse(JSON.stringify(source)),
      id,
      name: opts.name,
      versionNumber: nextVersionNumber(_store.value.versions),
      dateCreated: nowIso(),
      dateModified: nowIso(),
      purpose: opts.purpose,
      purposeCustom: opts.purposeCustom ?? '',
      status: 'draft',
      description: opts.description ?? `Forked from "${source.name}"`,
      sharpeningHistory: [],
      impactEstimates: [],
      forkedFromId: fromId,
      forkedFromName: source.name,
    }
    _store.value.versions.push(v)
    _store.value.activeVersionId = id
    _persist()
    return v
  }

  /** Patch a version's metadata or specSnapshot. */
  function updateVersion(id: string, patch: Partial<Omit<SolutionVersion, 'id' | 'dateCreated'>>): void {
    const idx = _store.value.versions.findIndex(v => v.id === id)
    if (idx < 0) return
    _store.value.versions[idx] = {
      ..._store.value.versions[idx],
      ...patch,
      dateModified: nowIso(),
    }
    _persist()
  }

  /** Delete a version permanently. */
  function deleteVersion(id: string): void {
    _store.value.versions = _store.value.versions.filter(v => v.id !== id)
    if (_store.value.activeVersionId === id) {
      _store.value.activeVersionId = _store.value.versions[0]?.id ?? null
    }
    _persist()
  }

  /** Open a version in the Workspace tab. */
  function setActiveVersion(id: string | null): void {
    _store.value.activeVersionId = id
    _persist()
  }

  /**
   * Approve a version — marks it approved and returns its specSnapshot
   * for the caller to apply to currentSpec.
   */
  function approveVersion(id: string, note: string): SpecBlock | null {
    const v = _store.value.versions.find(x => x.id === id)
    if (!v) return null
    updateVersion(id, { status: 'approved', approvedAt: nowIso(), approvedNote: note })
    return JSON.parse(JSON.stringify(v.specSnapshot))
  }

  /** Archive a version without deleting. */
  function deprecateVersion(id: string): void {
    updateVersion(id, { status: 'deprecated' })
  }

  /** Record a DBO sharpening session on a version. */
  function addSharpenRecord(versionId: string, record: Omit<DboSharpenRecord, 'id'>): void {
    const v = _store.value.versions.find(x => x.id === versionId)
    if (!v) return
    v.sharpeningHistory.push({ id: genId(), ...record })
    v.dateModified = nowIso()
    _persist()
  }

  /** Update or insert an IET impact estimate cell. */
  function setImpactEstimate(versionId: string, valueId: string, patch: Partial<DboImpactCell>): void {
    const v = _store.value.versions.find(x => x.id === versionId)
    if (!v) return
    const existing = v.impactEstimates.find(c => c.valueId === valueId)
    if (existing) {
      Object.assign(existing, patch)
    } else {
      v.impactEstimates.push({
        versionId,
        valueId,
        impactEstimate: patch.impactEstimate ?? '',
        confidence: patch.confidence ?? 'unknown',
        notes: patch.notes ?? '',
      })
    }
    v.dateModified = nowIso()
    _persist()
  }

  return {
    versions:         readonly(versions),
    activeVersionId:  readonly(activeVersionId),
    activeVersion:    readonly(activeVersion),
    draftCount:       readonly(draftCount),
    approvedCount:    readonly(approvedCount),
    createVersion,
    forkVersion,
    updateVersion,
    deleteVersion,
    setActiveVersion,
    approveVersion,
    deprecateVersion,
    addSharpenRecord,
    setImpactEstimate,
  }
}
