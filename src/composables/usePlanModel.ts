// UNIT_TYPE=Hook
// usePlanModel — Plan Model naming, versioning, persistence, and recall
//
// Every generated spec gets a named, versioned Plan Model.
// Version starts at 0.1 and bumps by 0.1 on each sharpen round (or user override).
// Models are stored in localStorage under 'sem-plan-models' (history array) and
// 'sem-current-plan-model' (active model). They can be exported as .json files and
// re-imported, or recalled by tag + version/date.

import { ref, readonly } from 'vue'
import type { SpecBlock } from '../types/spec'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PlanModel {
  /** Unique identifier (crypto.randomUUID) */
  id: string
  /** Human-readable name, e.g. "SEM App Plan" */
  name: string
  /** Semver-lite version string, e.g. "0.1", "0.2", "1.0" */
  version: string
  /** URL-safe slug derived from name — used for recall, e.g. "sem-app-plan" */
  tag: string
  /** ISO timestamp of first creation */
  createdAt: string
  /** ISO timestamp of last modification */
  updatedAt: string
  /** The spec snapshot this model was built from */
  spec: SpecBlock
  /** Number of sharpening rounds applied so far */
  sharpenRounds: number
}

// ── Storage keys ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'sem-plan-models'
const CURRENT_KEY = 'sem-current-plan-model'

// ── Helpers ───────────────────────────────────────────────────────────────────

function _slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'plan-model'
}

/**
 * Increment a semver-lite version string by 0.1.
 * 0.1 → 0.2 … 0.9 → 1.0 … 1.9 → 2.0
 * Falls through on non-standard strings (user-set).
 */
function _bumpVersion(v: string): string {
  const m = v.match(/^(\d+)\.(\d+)$/)
  if (!m) return v
  const major = parseInt(m[1], 10)
  const minor = parseInt(m[2], 10)
  const next = minor + 1
  return next >= 10 ? `${major + 1}.0` : `${major}.${next}`
}

function _loadAll(): PlanModel[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as PlanModel[]) : []
  } catch {
    return []
  }
}

function _saveAll(models: PlanModel[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(models))
}

/**
 * Derive a model name from the spec's Value entries.
 *
 * Format: "Improve [top value keywords] & [2nd value keywords]"
 * e.g. "Improve Entry Fluency & Planning Speed"
 *
 * Stop-words are stripped so only the meaningful nouns survive.
 * Falls back to the first Function description if no values exist.
 */
function _nameFromSpec(spec: SpecBlock): string {
  const STOP = new Set([
    'of', 'the', 'a', 'an', 'for', 'in', 'on', 'at', 'to', 'by',
    'with', 'and', 'or', 'its', 'their', 'our', 'is', 'are', 'be',
    'that', 'which', 'how', 'much', 'many', 'rate', 'level',
  ])

  /** Return up to `n` meaningful title-cased words from a description. */
  function headline(desc: string, n: number): string {
    return desc
      .trim()
      .split(/\s+/)
      .filter(w => w.length > 1 && !STOP.has(w.toLowerCase()) && /[a-zA-Z]/.test(w))
      .slice(0, n)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ')
  }

  if (spec.values.length > 0) {
    const h1 = headline(spec.values[0].description, 3)
    if (h1) {
      if (spec.values.length > 1) {
        const h2 = headline(spec.values[1].description, 2)
        return (`Improve ${h1}${h2 ? ` & ${h2}` : ''}`).slice(0, 50)
      }
      return `Improve ${h1}`
    }
  }

  // Fallback: first function description (first 5 words)
  const desc = spec.functions[0]?.description ?? ''
  const words = desc.trim().split(/\s+/).slice(0, 5).join(' ')
  return words || 'Plan Model'
}

// ── Module-level reactive state ───────────────────────────────────────────────

function _readCurrentFromStorage(): PlanModel | null {
  try {
    const raw = localStorage.getItem(CURRENT_KEY)
    return raw ? (JSON.parse(raw) as PlanModel) : null
  } catch {
    return null
  }
}

const _current = ref<PlanModel | null>(_readCurrentFromStorage())

function _persistCurrent(): void {
  if (_current.value) {
    localStorage.setItem(CURRENT_KEY, JSON.stringify(_current.value))
  } else {
    localStorage.removeItem(CURRENT_KEY)
  }
}

// ── Reactive all-models list ──────────────────────────────────────────────────
// Kept in sync whenever any model is written so components can watch it.

function _sortedModels(raw: PlanModel[]): PlanModel[] {
  return [...raw].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
}

const _allModels = ref<PlanModel[]>(_sortedModels(_loadAll()))

function _syncAllModels(): void {
  _allModels.value = _sortedModels(_loadAll())
}

function _upsertHistory(model: PlanModel): void {
  const all = _loadAll()
  const idx = all.findIndex((m) => m.id === model.id)
  if (idx >= 0) {
    all[idx] = model
  } else {
    all.push(model)
  }
  _saveAll(all)
  _syncAllModels()
}

// ── Public functions ──────────────────────────────────────────────────────────

/**
 * Create a new Plan Model for a freshly generated spec.
 * Starts at version 0.1. Call this inside doTranslate() after currentSpec is set.
 */
export function initPlanModel(spec: SpecBlock, name?: string): PlanModel {
  const modelName = name ?? _nameFromSpec(spec)
  const now = new Date().toISOString()
  const model: PlanModel = {
    id: crypto.randomUUID(),
    name: modelName,
    version: '0.1',
    tag: _slugify(modelName),
    createdAt: now,
    updatedAt: now,
    spec,
    sharpenRounds: 0,
  }
  _current.value = model
  _persistCurrent()
  _upsertHistory(model)
  return model
}

/**
 * Bump the version by 0.1. Call this after each successful sharpening round.
 * Also increments sharpenRounds and updates the spec snapshot.
 */
export function bumpPlanVersion(updatedSpec?: SpecBlock): void {
  if (!_current.value) return
  const updated: PlanModel = {
    ..._current.value,
    version: _bumpVersion(_current.value.version),
    sharpenRounds: _current.value.sharpenRounds + 1,
    updatedAt: new Date().toISOString(),
    ...(updatedSpec ? { spec: updatedSpec } : {}),
  }
  _current.value = updated
  _persistCurrent()
  _upsertHistory(updated)
}

/**
 * Save the current spec state without bumping the version number.
 * Updates updatedAt and persists to storage.
 * Use for periodic auto-save or explicit "Save now" actions.
 */
export function savePlanSnapshot(spec: SpecBlock): void {
  if (!_current.value) return
  const updated: PlanModel = {
    ..._current.value,
    spec,
    updatedAt: new Date().toISOString(),
  }
  _current.value = updated
  _persistCurrent()
  _upsertHistory(updated)
}

/**
 * Override the version with a user-stipulated string (e.g. "1.0", "2.0-beta").
 */
export function setPlanVersion(v: string): void {
  if (!_current.value) return
  const updated: PlanModel = {
    ..._current.value,
    version: v,
    updatedAt: new Date().toISOString(),
  }
  _current.value = updated
  _persistCurrent()
  _upsertHistory(updated)
}

/** Rename the plan model. Regenerates the tag slug. */
export function setPlanName(name: string): void {
  if (!_current.value) return
  const updated: PlanModel = {
    ..._current.value,
    name,
    tag: _slugify(name),
    updatedAt: new Date().toISOString(),
  }
  _current.value = updated
  _persistCurrent()
  _upsertHistory(updated)
}

/**
 * Recall a model by tag + optional version.
 * If version is omitted, returns the most recent model with that tag.
 * Returns null when not found.
 */
export function loadPlanByTag(tag: string, version?: string): PlanModel | null {
  const all = _loadAll()
  const matching = all.filter((m) => m.tag === tag)
  if (matching.length === 0) return null
  const found = version
    ? matching.find((m) => m.version === version)
    : matching[matching.length - 1]
  if (!found) return null
  _current.value = found
  _persistCurrent()
  return found
}

/**
 * Recall a model by tag + date (YYYY-MM-DD).
 * Matches against createdAt or updatedAt. Returns the most recent match.
 */
export function loadPlanByDate(tag: string, date: string): PlanModel | null {
  const all = _loadAll()
  const prefix = date.slice(0, 10) // "YYYY-MM-DD"
  const matching = all.filter(
    (m) =>
      m.tag === tag &&
      (m.createdAt.startsWith(prefix) || m.updatedAt.startsWith(prefix)),
  )
  if (matching.length === 0) return null
  const found = matching[matching.length - 1]
  _current.value = found
  _persistCurrent()
  return found
}

/**
 * Import a PlanModel from a parsed JSON object (e.g. from a .json file import).
 * Validates minimal required fields. Returns the loaded model, or null on failure.
 */
export function importPlanModel(data: unknown): PlanModel | null {
  try {
    const m = data as Partial<PlanModel>
    if (!m.name || !m.version || !m.spec) return null
    const model: PlanModel = {
      id: m.id ?? crypto.randomUUID(),
      name: m.name,
      version: m.version,
      tag: m.tag ?? _slugify(m.name),
      createdAt: m.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      spec: m.spec,
      sharpenRounds: m.sharpenRounds ?? 0,
    }
    _current.value = model
    _persistCurrent()
    _upsertHistory(model)
    return model
  } catch {
    return null
  }
}

/**
 * Trigger a browser download of the current model as a .json file.
 * Filename: <tag>-v<version>.json (e.g. "sem-app-plan-v0.3.json")
 */
export function exportPlanModel(): void {
  if (!_current.value) return
  const json = JSON.stringify(_current.value, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${_current.value.tag}-v${_current.value.version}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Export ALL saved models as a full security backup .json file.
 *
 * Filename: sem-app-backup-YYYY-MM-DD-HHmm.json
 * Format:   { semAppBackup: true, version: 1, exportedAt, modelCount, models: [...] }
 *
 * Store in iCloud Drive, Obsidian vault, email to yourself — anywhere offline.
 * Restore later with importPlanModelsBackup().
 */
export function exportAllPlanModelsBackup(): void {
  const models = _loadAll()
  const now  = new Date()
  const date = now.toISOString().slice(0, 10)
  const hh   = now.getHours().toString().padStart(2, '0')
  const mm   = now.getMinutes().toString().padStart(2, '0')
  const payload = {
    semAppBackup: true,
    version:      1,
    exportedAt:   now.toISOString(),
    modelCount:   models.length,
    models,
  }
  const json = JSON.stringify(payload, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `sem-app-backup-${date}-${hh}${mm}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Restore all models from a full backup .json file.
 *
 * Merge strategy: models whose ID already exists in localStorage are skipped
 * (no silent overwrites). Only genuinely new models are added.
 * Returns the count of models successfully restored.
 */
export function importPlanModelsBackup(data: unknown): number {
  try {
    const backup = data as Record<string, unknown>
    if (!backup.semAppBackup || !Array.isArray(backup.models)) return 0

    const existing   = _loadAll()
    const existingIds = new Set(existing.map((m) => m.id))
    let count = 0

    for (const raw of backup.models as unknown[]) {
      const m = raw as Partial<PlanModel>
      if (!m.name || !m.version || !m.spec) continue
      if (m.id && existingIds.has(m.id)) continue  // already present — skip

      const model: PlanModel = {
        id:           m.id ?? crypto.randomUUID(),
        name:         m.name,
        version:      m.version,
        tag:          m.tag ?? _slugify(m.name),
        createdAt:    m.createdAt ?? new Date().toISOString(),
        updatedAt:    m.updatedAt ?? new Date().toISOString(),
        spec:         m.spec,
        sharpenRounds: m.sharpenRounds ?? 0,
      }
      existing.push(model)
      existingIds.add(model.id)
      count++
    }

    if (count > 0) {
      _saveAll(existing)
      _syncAllModels()
    }
    return count
  } catch {
    return 0
  }
}

/** All unique tags saved in localStorage (for autocomplete / recall UI). */
export function allPlanTags(): string[] {
  const all = _loadAll()
  return [...new Set(all.map((m) => m.tag))]
}

/** All saved versions for a given tag, oldest first. */
export function planVersionsForTag(tag: string): PlanModel[] {
  return _loadAll().filter((m) => m.tag === tag)
}

/** Clear the current model reference. Call on startFresh(). */
export function clearPlanModel(): void {
  _current.value = null
  _persistCurrent()
}

// ── New model-management helpers ──────────────────────────────────────────────

/** All saved models, newest-first (reactive ref — updates whenever any model is written). */
export function getAllPlanModels(): ReadonlyArray<PlanModel> {
  return _allModels.value
}

/** The most recently updated saved model, or null if none are saved. */
export function latestPlanModel(): PlanModel | null {
  return _allModels.value[0] ?? null
}

/** Delete a saved model by ID. Clears current if it was the active model. */
export function deletePlanModel(id: string): void {
  const all = _loadAll().filter((m) => m.id !== id)
  _saveAll(all)
  _syncAllModels()
  if (_current.value?.id === id) {
    _current.value = null
    _persistCurrent()
  }
}

/** Rename any saved model by ID. Also updates current if it matches. */
export function renamePlanModel(id: string, name: string): void {
  const all = _loadAll()
  const idx = all.findIndex((m) => m.id === id)
  if (idx < 0) return
  const slug = _slugify(name)
  const updatedAt = new Date().toISOString()
  all[idx] = { ...all[idx], name, tag: slug, updatedAt }
  _saveAll(all)
  _syncAllModels()
  if (_current.value?.id === id) {
    _current.value = { ..._current.value, name, tag: slug, updatedAt }
    _persistCurrent()
  }
}

/** Make a saved model the active current model without modifying its data. */
export function activatePlanModel(model: PlanModel): void {
  _current.value = model
  _persistCurrent()
}

// ── Composable export ─────────────────────────────────────────────────────────

export function usePlanModel() {
  return {
    /** The currently active Plan Model (reactive, readonly). */
    currentModel: readonly(_current),
    /** All saved models, newest-first (reactive). */
    allModels: readonly(_allModels),
    initPlanModel,
    bumpPlanVersion,
    setPlanVersion,
    setPlanName,
    loadPlanByTag,
    loadPlanByDate,
    importPlanModel,
    exportPlanModel,
    exportAllPlanModelsBackup,
    importPlanModelsBackup,
    allPlanTags,
    planVersionsForTag,
    getAllPlanModels,
    latestPlanModel,
    deletePlanModel,
    renamePlanModel,
    activatePlanModel,
    savePlanSnapshot,
    clearPlanModel,
  }
}
