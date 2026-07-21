// Feature #196 — Spec Editor
// Direct editing of F., V., S. entries at three levels.
// Produces either a saved Draft Edit Version (does not touch the master)
// or commits changes back to the Master Plan.

import { ref, computed } from 'vue'

// ── Shared commit-notification signal ─────────────────────────────────────────
// Set whenever a save or master-commit is confirmed so any subscriber (e.g.
// PlanTargetsPanel) can react without coupling through App.vue.
const _lastCommittedTargetId = ref('')
import type { SpecBlock, FEntry, VEntry, SEntry, CEntry } from '../types/spec'
import { stampEntry } from '../utils/sourceStamp'

// ── Types ──────────────────────────────────────────────────────────────────────

/** 1 = Descriptions only | 2 = + Metrics | 3 = Full Planguage */
export type EditLevel = 1 | 2 | 3

/** draft = save as Edit Version (does not touch master) | master = commit back to master plan */
export type EditMode = 'draft' | 'master'

export interface EditVersion {
  id:                  string
  name:                string
  createdAt:           string
  linkedTargetId:      string   // '' = not linked to a Plan Target
  linkedTargetName:    string
  level:               EditLevel
  spec:                SpecBlock
  changedCount:        number
}

export const EDIT_LEVEL_LABELS: Record<EditLevel, string> = {
  1: 'Descriptions Only',
  2: 'Value Metrics',
  3: 'Anything and Everything',
}

export const EDIT_LEVEL_HINTS: Record<EditLevel, string> = {
  1: 'Edit descriptions only — reword for plain language or a specific audience.',
  2: 'Edit descriptions plus all Value metrics (scale, meter, goal, tolerable) and Solution impact.',
  3: 'Edit everything including IDs, success criteria, links, and all Planguage fields.',
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function cloneSpec(s: SpecBlock): SpecBlock {
  return JSON.parse(JSON.stringify(s))
}

/** Generate a unique plain-word ID for a new entry (e.g. "Function 4").
 *  Increments the counter past any existing entries that already use the pattern. */
function _genId(prefix: string, existing: { id: string }[]): string {
  let n = existing.length + 1
  while (existing.some(e => e.id === `${prefix} ${n}`)) n++
  return `${prefix} ${n}`
}

const STORAGE_KEY = 'sem-spec-edit-versions'

function _loadVersions(): EditVersion[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as EditVersion[]) : []
  } catch { return [] }
}

function _saveVersions(versions: EditVersion[]): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(versions)) } catch { /* quota */ }
}

// ── Module-level singletons ────────────────────────────────────────────────────

const _editVersions      = ref<EditVersion[]>(_loadVersions())
const _workingSpec       = ref<SpecBlock | null>(null)
const _originalSpec      = ref<SpecBlock | null>(null)
const _editLevel         = ref<EditLevel>(1)
const _editMode          = ref<EditMode>('draft')
const _editName          = ref('Edit Version')
const _linkedTargetId    = ref('')
const _linkedTargetName  = ref('')
const _changedIds        = ref<Set<string>>(new Set())

// ── Composable ────────────────────────────────────────────────────────────────

export function useSpecEditor() {
  const editVersions     = computed(() => _editVersions.value)
  const workingSpec      = computed(() => _workingSpec.value)
  const originalSpec     = computed(() => _originalSpec.value)
  const editLevel        = computed(() => _editLevel.value)
  const editMode         = computed(() => _editMode.value)
  const editName         = computed(() => _editName.value)
  const linkedTargetId   = computed(() => _linkedTargetId.value)
  const linkedTargetName = computed(() => _linkedTargetName.value)
  const changedCount     = computed(() => _changedIds.value.size)
  const hasChanges       = computed(() => _changedIds.value.size > 0)

  function isChanged(id: string): boolean {
    return _changedIds.value.has(id)
  }

  /** Return a snapshot array of all currently-changed entry IDs. */
  function getChangedIds(): string[] {
    return [..._changedIds.value]
  }

  /** Initialise the editor from a master spec. Call before opening the panel. */
  function openEditor(
    spec: SpecBlock,
    options?: {
      level?:      EditLevel
      mode?:       EditMode
      targetId?:   string
      targetName?: string
      name?:       string
    },
  ): void {
    _originalSpec.value      = cloneSpec(spec)
    _workingSpec.value       = cloneSpec(spec)
    _editLevel.value         = options?.level      ?? 1
    _editMode.value          = options?.mode       ?? 'draft'
    _linkedTargetId.value    = options?.targetId   ?? ''
    _linkedTargetName.value  = options?.targetName ?? ''
    _editName.value          = options?.name
      ?? (options?.targetName ? `${options.targetName} Edit` : 'Edit Version')
    _changedIds.value        = new Set()
  }

  // ── Entry mutations ──────────────────────────────────────────────────────────

  function _markChanged(id: string): void {
    _changedIds.value = new Set([..._changedIds.value, id])
  }

  function updateFEntry(index: number, patch: Partial<FEntry>): void {
    if (!_workingSpec.value) return
    const e = _workingSpec.value.functions[index]
    if (!e) return
    _workingSpec.value.functions[index] = { ...e, ...patch }
    _markChanged(e.id)
  }

  function updateVEntry(index: number, patch: Partial<VEntry>): void {
    if (!_workingSpec.value) return
    const e = _workingSpec.value.values[index]
    if (!e) return
    _workingSpec.value.values[index] = { ...e, ...patch }
    _markChanged(e.id)
  }

  function updateSEntry(index: number, patch: Partial<SEntry>): void {
    if (!_workingSpec.value) return
    const e = _workingSpec.value.solutions[index]
    if (!e) return
    _workingSpec.value.solutions[index] = { ...e, ...patch }
    _markChanged(e.id)
  }

  function updateCEntry(index: number, patch: Partial<CEntry>): void {
    if (!_workingSpec.value) return
    const constraints = _workingSpec.value.constraints ?? []
    const e = constraints[index]
    if (!e) return
    constraints[index] = { ...e, ...patch }
    _workingSpec.value.constraints = constraints
    _markChanged(e.id)
  }

  // ── Add new entries ──────────────────────────────────────────────────────────
  // Each function appends a blank entry to the working spec, marks it changed,
  // and returns the new entry's ID so the panel can auto-expand + scroll to it.

  // r41 v220 (2026-06-20 producer-stamp sweep) — every manually-added entry
  // is stamped with provenance ("Spec Editor Add · <Date>", sourceType:
  // 'human') so the renderer's Source chip lights up the moment the entry
  // is created.  Per-field stamping happens later via applyItemEdits()
  // when the planner types content into a field (see spec.ts FEntry comment).
  // r41 v415 (Source Attribution SUPREME sweep) — Class B (SEM-app human).
  const _stampOpts = {
    generator:   'Spec Editor',
    sourceType:  'human' as const,
    tool:        'Manual Add',
    stage:       'manual-add',
    triggerText: '+ Add (Spec Editor)',
  }

  function addFEntry(): string {
    if (!_workingSpec.value) return ''
    const id = _genId('Function', _workingSpec.value.functions)
    const entry: FEntry = stampEntry({ id, type: 'Function', level: 'Product', description: '', presenceTest: '', functionOfValue: '' }, _stampOpts)
    _workingSpec.value.functions = [..._workingSpec.value.functions, entry]
    _markChanged(id)
    return id
  }

  function addVEntry(): string {
    if (!_workingSpec.value) return ''
    const id = _genId('Value', _workingSpec.value.values)
    const entry: VEntry = stampEntry({ id, type: 'Value', level: 'Product', description: '', scale: '', meter: '', status: '', tolerable: '', goal: '', valueOfFunction: '' }, _stampOpts)
    _workingSpec.value.values = [..._workingSpec.value.values, entry]
    _markChanged(id)
    return id
  }

  function addSEntry(): string {
    if (!_workingSpec.value) return ''
    const id = _genId('Solution', _workingSpec.value.solutions)
    const entry: SEntry = stampEntry({ id, type: 'Solution', level: 'Product', description: '', impact: '', function: '' }, _stampOpts)
    _workingSpec.value.solutions = [..._workingSpec.value.solutions, entry]
    _markChanged(id)
    return id
  }

  function addCEntry(): string {
    if (!_workingSpec.value) return ''
    const constraints = _workingSpec.value.constraints ?? []
    const id = _genId('Constraint', constraints)
    const entry: CEntry = stampEntry({ id, type: 'Constraint', level: 'Product', description: '', scope: '', rationale: '' }, _stampOpts)
    _workingSpec.value.constraints = [...constraints, entry]
    _markChanged(id)
    return id
  }

  // ── Revert ───────────────────────────────────────────────────────────────────

  function revertEntry(id: string): void {
    if (!_workingSpec.value || !_originalSpec.value) return
    const fi = _originalSpec.value.functions.findIndex(e => e.id === id)
    if (fi >= 0) _workingSpec.value.functions[fi] = { ..._originalSpec.value.functions[fi] }
    const vi = _originalSpec.value.values.findIndex(e => e.id === id)
    if (vi >= 0) _workingSpec.value.values[vi] = { ..._originalSpec.value.values[vi] }
    const si = _originalSpec.value.solutions.findIndex(e => e.id === id)
    if (si >= 0) _workingSpec.value.solutions[si] = { ..._originalSpec.value.solutions[si] }
    const origConstraints = _originalSpec.value.constraints ?? []
    const ci = origConstraints.findIndex(e => e.id === id)
    if (ci >= 0) {
      const workConstraints = _workingSpec.value.constraints ?? []
      workConstraints[ci] = { ...origConstraints[ci] }
      _workingSpec.value.constraints = workConstraints
    }
    const next = new Set(_changedIds.value)
    next.delete(id)
    _changedIds.value = next
  }

  function revertAll(): void {
    if (!_originalSpec.value) return
    _workingSpec.value = cloneSpec(_originalSpec.value)
    _changedIds.value  = new Set()
  }

  // ── Settings ─────────────────────────────────────────────────────────────────

  function setEditLevel(level: EditLevel): void    { _editLevel.value = level }
  function setEditMode(mode: EditMode): void       { _editMode.value  = mode  }
  function setEditName(name: string): void         { _editName.value  = name  }
  function setLinkedTarget(id: string, name: string): void {
    _linkedTargetId.value   = id
    _linkedTargetName.value = name
  }

  // ── Persist ──────────────────────────────────────────────────────────────────

  const lastCommittedTargetId = computed(() => _lastCommittedTargetId.value)

  /** Save as a Draft Edit Version. Does NOT modify the master plan.
   *  Signals PlanTargetsPanel via lastCommittedTargetId. */
  function saveEditVersion(): EditVersion | null {
    if (!_workingSpec.value) return null
    const version: EditVersion = {
      id:                `ev-${Date.now()}`,
      name:              _editName.value || 'Edit Version',
      createdAt:         new Date().toISOString(),
      linkedTargetId:    _linkedTargetId.value,
      linkedTargetName:  _linkedTargetName.value,
      level:             _editLevel.value,
      spec:              cloneSpec(_workingSpec.value),
      changedCount:      _changedIds.value.size,
    }
    _editVersions.value = [version, ..._editVersions.value]
    _saveVersions(_editVersions.value)
    // Signal: draft saved — notify subscribers
    _lastCommittedTargetId.value = _linkedTargetId.value
    return version
  }

  /** Return the working spec ready to commit to master. */
  function getSpecForMaster(): SpecBlock | null {
    return _workingSpec.value ? cloneSpec(_workingSpec.value) : null
  }

  /** Call when a master commit completes (App.vue @commit-master handler).
   *  Clears changed IDs and signals the "Edited" state to subscribers. */
  function markCommitted(): void {
    _lastCommittedTargetId.value = _linkedTargetId.value
    _changedIds.value = new Set()
  }

  function deleteEditVersion(id: string): void {
    _editVersions.value = _editVersions.value.filter(v => v.id !== id)
    _saveVersions(_editVersions.value)
  }

  /** Get the original (pre-edit) value of any entry by ID. */
  function getOriginalEntry(id: string): FEntry | VEntry | SEntry | CEntry | null {
    if (!_originalSpec.value) return null
    return (
      _originalSpec.value.functions.find(e => e.id === id) ??
      _originalSpec.value.values.find(e => e.id === id) ??
      _originalSpec.value.solutions.find(e => e.id === id) ??
      (_originalSpec.value.constraints ?? []).find(e => e.id === id) ??
      null
    )
  }

  return {
    // State
    editVersions,
    workingSpec,
    originalSpec,
    editLevel,
    editMode,
    editName,
    linkedTargetId,
    linkedTargetName,
    changedCount,
    hasChanges,
    lastCommittedTargetId,
    // Queries
    isChanged,
    getChangedIds,
    getOriginalEntry,
    // Actions
    openEditor,
    updateFEntry,
    updateVEntry,
    updateSEntry,
    updateCEntry,
    addFEntry,
    addVEntry,
    addSEntry,
    addCEntry,
    revertEntry,
    revertAll,
    setEditLevel,
    setEditMode,
    setEditName,
    setLinkedTarget,
    saveEditVersion,
    getSpecForMaster,
    markCommitted,
    deleteEditVersion,
  }
}
