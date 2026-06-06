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
import { initEntriesFromSpec } from './useEntryProvenance'
import {
  _getRecordsForPlan as _getPriorityRecordsForPlan,
  _setRecordsForPlan as _setPriorityRecordsForPlan,
  type PriorityRecord,
} from './usePriorityRecord'
import {
  _getAnnotationsForPlan,
  _setAnnotationsForPlan,
  type SpecAnnotation,
} from './useSpecAnnotations'
import { readMigrated, writeBoth, oldKeyFor } from './useSpecKeyMigration'

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * A person with a contact card, a responsibility domain, and an empowerment date range.
 * Used for Plan Owners (approval authority), Planners (idea authors), and Scribes (typists).
 *
 * Roles:
 *   Owner   — accountable stakeholder with change sign-off authority.
 *   Planner — the person who thinks up and owns the plan ideas (often face-to-face or remote).
 *   Scribe  — the person who does the actual keying/dictation to get ideas into the app.
 *             In Mob Planning the scribe role rotates; multiple Scribes with overlapping
 *             date ranges record who was empowered at any given time.
 */
export interface SpecPerson {
  /** Auto-generated UUID for list management */
  id: string
  /** Full name */
  name: string
  email: string
  phone: string
  organization: string
  location: string
  /**
   * Responsibility domain — describes what this person owns/authors/types.
   * Owners: approval/change authority, e.g. "Product ownership + change sign-off".
   * Planners: idea scope, e.g. "Lead strategist", "Quality section".
   * Scribes: session scope, e.g. "Morning session", "Sprint 3 kickoff".
   */
  responsibility: string
  /**
   * ISO date (YYYY-MM-DD) when this person was first empowered in this role.
   * Defaults to today when the person is added. Empty = unknown/unset.
   */
  startDate: string
  /**
   * ISO date (YYYY-MM-DD) when this person's empowerment ended.
   * Empty = currently active. Naturally closes when someone with the same
   * responsibility domain is added with a later start date.
   */
  endDate: string
  /**
   * True when this Scribe entry was auto-created from the stored device-user
   * name rather than explicitly assigned.
   * Displayed as "(default setting)" in the panel so the user knows it is
   * just a placeholder for whoever is at the keyboard, not a named commitment.
   * Editing and saving the entry updates the stored device-user name for
   * future plans while keeping this flag set (still the device-user entry).
   * Only meaningful on Scribe entries.
   */
  isDefault?: boolean
}

/** @deprecated Use SpecPerson instead */
export type PlanOwner = SpecPerson

/**
 * A Spec Owner is accountable for a specific Specification Area of the plan
 * (e.g. Product, Quality, Financials, Innovation, Technical).
 * There can be any number of Spec Owners covering different areas.
 */
export interface SpecOwner {
  id: string
  /** Specification area this person governs (e.g. "Product", "Quality") */
  area: string
  name: string
  email: string
  phone: string
  organization: string
  location: string
  /** Short description of this person's accountability for the area */
  responsibility: string
}

/**
 * Plan Governance — The "Plan Itself" as a Stakeholder.
 *
 * Planguage concept: the Plan is treated as a stakeholder in its own right,
 * expressing all known/acknowledged stakeholder needs (Wish Level) and
 * project commitments (Goal Level). Governance assigns Spec Owners to
 * cover distinct specification areas of the plan.
 */
export interface SpecGovernance {
  /**
   * Wish Level — all known and acknowledged stakeholder needs.
   * Free-form Planguage Wish statements ("stakeholders wish for…").
   */
  wishLevel: string
  /**
   * Goal Level — measurable project commitments.
   * Free-form Planguage Goal statements ("the plan commits to…").
   */
  goalLevel: string
  /** Owners of specific Specification Areas within the plan. */
  specOwners: SpecOwner[]
}

/** @deprecated Use SpecGovernance instead */
export type PlanGovernance = SpecGovernance

export interface SpecModel {
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
  /**
   * How this plan's spec was first produced.
   * 'ai-generated' — came from the AI generation pipeline (the normal path).
   * 'imported'      — loaded from a .json file export.
   * 'manual'        — built without AI assistance.
   */
  specSource: 'ai-generated' | 'imported' | 'manual'
  /**
   * Cumulative count of times a human saved a manual edit in the Spec Editor.
   * Incremented by incrementManualEditCount(). Used by Plan DNA / Planner Consequences strip
   * to show how much of the plan was directly hand-authored vs AI-produced.
   */
  manualEditCount: number
  /**
   * Responsible owners — the Planguage stakeholders accountable for the whole
   * spec (approval authority, change sign-off). Multiple owners each cover a
   * named responsibility domain. Replaces the former singular `owner` field.
   */
  owners: SpecPerson[]
  /**
   * Planners — the people who conceived and own the ideas in this spec.
   * Distinct from Scribes: Planners think and direct; Scribes type.
   * Multiple planners each cover a named idea/authoring domain.
   */
  planners: SpecPerson[]
  /**
   * Scribes — the people doing the actual keying/dictation to enter ideas into the app.
   * In Mob Planning the scribe role rotates; record each person with their empowerment
   * date range so you know who was in the chair at any point.
   */
  scribes: SpecPerson[]
  /**
   * Spec Governance — "Spec Itself" as Stakeholder, including Wish/Goal levels
   * and the list of Spec Owners (area-specific accountability assignments).
   */
  governance: SpecGovernance
  /**
   * Working mode for this model.
   * 'plan'  = directed improvement planning (default, current behaviour)
   * 'model' = system model — describes the system as it IS (current/forecast states)
   * Optional for backwards-compat: old records default to 'plan' via migration.
   */
  workingMode?: 'plan' | 'model'
  /**
   * Free-text description of the system being modelled. Only meaningful in
   * 'model' mode. Passed as context to AI prompts in model mode.
   */
  systemDescription?: string
  /**
   * Evo Cycle Length — the planned duration of one Evo value delivery cycle.
   *
   * Constrains the AI when generating Evo step effort estimates: each step
   * must fit within one cycle, and effortPercent × cycleHours gives the
   * estimated wall-clock time for that step.
   *
   * Tom 2026-06-02 (SEM App Book p.179): "Evo steps are designed to fit a
   * specified cycle maximum." Reference hours per cycle:
   *   day     ~8 h   (daily Evo cycle)
   *   week    ~40 h  (default — weekly Evo cycle, the most common Evo cadence)
   *   month   ~160 h (monthly release cycle)
   *   quarter ~480 h (quarterly programme increment)
   *
   * Optional for backwards-compat: old records default to 'week' via migration.
   */
  evoCycleLength?: 'day' | 'week' | 'month' | 'quarter'
  /**
   * Project DEADLINE — scalar Condition [When] applying to the whole spec.
   * Tom Gilb 2026-06-06: "An evo step is to bring in the date condition. Time
   * is very critical. It is unrealistic to not include it any longer. Project
   * DEADLINE, it is sufficient to articulate Deadline = ? initially and have
   * an edit capability."
   *
   * Free-text initially (e.g. "?", "2027-Q1", "60 days from kickoff", "before
   * EU AI Act enforcement").  Later schema slices should add structured Date /
   * Event variants and propagate to Benchmark + per-entry Condition fields.
   * Default '?' means "not yet articulated".
   */
  deadline?: string
}

/** @deprecated Use SpecModel instead */
export type PlanModel = SpecModel

/**
 * Self-documenting Plan Story snapshot embedded in every .json export
 * (Option C of the Plan Story export brief, Tom 2026-05-13). Lets a human
 * reading the raw JSON — or any future tool — see the computed authorship
 * narrative as of the export moment, without having to fire up the app or
 * re-implement the formula. Reconstructed on re-import from the underlying
 * fields plus the `_planStorySidecar` collections; the snapshot itself is
 * NOT used to drive the UI on import (the UI always recomputes from live
 * data) — it is purely documentation.
 */
export interface SpecStorySnapshot {
  /** ISO timestamp when the export was produced */
  exportedAt: string
  /** Hand-Tuned authorship — your share (0–100) */
  handTunedPct: number
  /** AI authorship — complement (0–100) */
  aiPct: number
  /** Plain-English narrative, e.g. "AI drafted from your prompt · sharpened 2× · 5 decisions" */
  narrative: string
  /** Per-chapter snapshot string, mirroring what the Spec Story strip shows */
  chapters: {
    origin: string
    handTuned: string
    sharpened: string
    stewards: string
    age: string
  }
  /** Formula breakdown — explicit math for transparency */
  formula: {
    baseline: number
    sharpenPts: number
    priorityPts: number
    editPts: number
    annotationPts: number
    totalTilt: number
  }
}

/** @deprecated Use SpecStorySnapshot instead */
export type PlanStorySnapshot = SpecStorySnapshot

/**
 * Sidecar block embedded at the top level of an exported .json file
 * (Option B of the Plan Story export brief, Tom 2026-05-13). Carries the
 * two collections that drive Hand-Tuned authorship but live in their own
 * localStorage keys (`sem-priority-records`, `sem-spec-annotations`) — so
 * an exported file is now a complete, portable record of the plan and its
 * authorship provenance. On import, these are written back into the
 * separate stores via `_setPriorityRecordsForPlan` / `_setAnnotationsForPlan`.
 */
export interface SpecStorySidecar {
  priorityRecords: PriorityRecord[]
  annotations: Record<string, SpecAnnotation>
}

/** @deprecated Use SpecStorySidecar instead */
export type PlanStorySidecar = SpecStorySidecar

/**
 * The full exported-plan payload: the PlanModel itself, plus the sidecar
 * and snapshot. Top-level field layout (PlanModel fields are spread at the
 * root) so older importers that read only `name` / `version` / `spec` still
 * succeed; the new fields are opportunistically picked up when present.
 */
export type ExportedSpecFile = SpecModel & {
  _planStorySidecar?: SpecStorySidecar
  _planStorySnapshot?: SpecStorySnapshot
}

/** @deprecated Use ExportedSpecFile instead */
export type ExportedPlanFile = ExportedSpecFile

// ── Defaults ──────────────────────────────────────────────────────────────────

function _emptyPerson(): SpecPerson {
  return {
    id: crypto.randomUUID(),
    name: '', email: '', phone: '', organization: '', location: '', responsibility: '',
    startDate: new Date().toISOString().slice(0, 10),  // today as YYYY-MM-DD default
    endDate: '',  // empty = currently active
  }
}

const DEFAULT_GOVERNANCE: SpecGovernance = {
  wishLevel: '',
  goalLevel: '',
  specOwners: [],
}

// ── Storage keys ──────────────────────────────────────────────────────────────

const STORAGE_KEY      = 'sem-specs'             // Phase A rename; shim reads old 'sem-plan-models' as fallback
const CURRENT_KEY      = 'sem-current-spec'      // Phase A rename; shim reads old 'sem-current-plan-model' as fallback
const DEVICE_USER_KEY  = 'sem-device-user-name'

// ── Device-user name (used as default Scribe) ─────────────────────────────────

/**
 * Read the stored device-user name — the person currently at the keyboard.
 * Returns an empty string if not yet set.
 */
export function getDeviceUserName(): string {
  try { return localStorage.getItem(DEVICE_USER_KEY) ?? '' } catch { return '' }
}

/**
 * Persist the device-user name to localStorage so future plans auto-populate
 * the default Scribe entry.  Called whenever the user explicitly edits and
 * saves the default scribe in PlanOwnerPanel.
 */
export function setDeviceUserName(name: string): void {
  try { localStorage.setItem(DEVICE_USER_KEY, name) } catch { /* ignore */ }
}

/** Build the auto-populated default Scribe entry for a new spec. */
function _defaultScribe(): SpecPerson {
  return {
    ..._emptyPerson(),
    name: getDeviceUserName(),
    responsibility: 'Default setting — device user',
    isDefault: true,
  }
}

// ── Migration ─────────────────────────────────────────────────────────────────

/**
 * Migrate a raw localStorage object to the current PlanModel shape.
 * Handles models saved before the PlanOwner / PlanGovernance fields existed.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function _migrate(raw: any): SpecModel {
  // owners: migrate from legacy singular `owner` field
  if (!Array.isArray(raw.owners)) {
    if (raw.owner && typeof raw.owner === 'object' && raw.owner.name) {
      // Promote old singular owner to owners[0], adding id if missing
      raw.owners = [{ id: raw.owner.id ?? crypto.randomUUID(), ..._emptyPerson(), ...raw.owner }]
    } else if (typeof raw.owner === 'string' && raw.owner) {
      raw.owners = [{ ..._emptyPerson(), name: raw.owner }]
    } else {
      raw.owners = []
    }
  } else {
    // Ensure each owner has an id
    raw.owners = (raw.owners as SpecPerson[]).map((o) =>
      ({ ..._emptyPerson(), ...o, id: o.id ?? crypto.randomUUID() }),
    )
  }

  // planners: new field — default to empty
  if (!Array.isArray(raw.planners)) {
    raw.planners = []
  } else {
    raw.planners = (raw.planners as SpecPerson[]).map((p) =>
      ({ ..._emptyPerson(), ...p, id: p.id ?? crypto.randomUUID() }),
    )
  }

  // specSource / manualEditCount: new fields — default for old models
  if (!raw.specSource) raw.specSource = 'ai-generated'
  if (typeof raw.manualEditCount !== 'number') raw.manualEditCount = 0

  // scribes: new field — default to empty; migrate each record with _emptyPerson defaults
  if (!Array.isArray(raw.scribes)) {
    raw.scribes = []
  } else {
    raw.scribes = (raw.scribes as SpecPerson[]).map((s) =>
      ({ ..._emptyPerson(), ...s, id: s.id ?? crypto.randomUUID() }),
    )
  }

  // Add governance if missing
  if (!raw.governance || typeof raw.governance !== 'object') {
    raw.governance = { ...DEFAULT_GOVERNANCE, specOwners: [] }
  } else {
    raw.governance = {
      wishLevel: raw.governance.wishLevel ?? '',
      goalLevel: raw.governance.goalLevel ?? '',
      specOwners: Array.isArray(raw.governance.specOwners) ? raw.governance.specOwners : [],
    }
  }

  // workingMode: new field — default 'plan' for all existing records
  if (!raw.workingMode) raw.workingMode = 'plan'

  // evoCycleLength: new field — default 'week' (the standard Evo sprint cadence)
  if (!raw.evoCycleLength) raw.evoCycleLength = 'week'
  if (raw.deadline == null) raw.deadline = '?'   // r98 — backfill scalar Deadline default

  // CEntry schema migration (2026-05-15): limit → description + scope + rationale + source?
  // Old format: { description (gist), limit (binary rule) }
  // New format: { description (binary rule), scope, rationale, source? }
  // If an entry still has `limit` but no `scope`, migrate it now.
  if (raw.spec && Array.isArray(raw.spec.constraints)) {
    for (const c of raw.spec.constraints as Array<Record<string, unknown>>) {
      if (typeof c.limit === 'string' && c.limit.trim()) {
        // Old gist text was in description; binary rule was in limit.
        // Promote binary rule to description, preserve gist in rationale context.
        if (!c.scope && !c.rationale) {
          // Fully migrate: old description (gist) → rationale prefix; limit → description
          c.rationale = c.description ? `Context: ${c.description}` : ''
          c.description = c.limit
        }
        delete c.limit
      }
      if (typeof c.scope !== 'string')     c.scope     = ''
      if (typeof c.rationale !== 'string') c.rationale = ''
    }
  }

  return raw as SpecModel
}

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

function _loadAll(): SpecModel[] {
  try {
    const raw = readMigrated(STORAGE_KEY)   // reads 'sem-specs', falls back to 'sem-plan-models'
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(_migrate)
  } catch {
    return []
  }
}

function _saveAll(models: SpecModel[]): void {
  writeBoth(STORAGE_KEY, JSON.stringify(models))  // writes 'sem-specs' + 'sem-plan-models' during transition
}

/**
 * List all stored plans as lightweight summaries — for "recent plans" UI
 * in panels that need to help users pick a plan when none is loaded.
 * Returns newest-first (sorted by updatedAt descending).
 * Twin-portable: pure data transform, no Vue dependency.
 */
export function listRecentSpecs(): { tag: string; version: string; name: string; updatedAt: string }[] {
  const all = _loadAll()
  return all
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(m => ({ tag: m.tag, version: m.version, name: m.name || m.tag, updatedAt: m.updatedAt }))
    .slice(0, 10)
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
    const raw = readMigrated(CURRENT_KEY)   // reads 'sem-current-spec', falls back to 'sem-current-plan-model'
    if (!raw) return null
    return _migrate(JSON.parse(raw))
  } catch {
    return null
  }
}

const _current = ref<SpecModel | null>(_readCurrentFromStorage())

function _persistCurrent(): void {
  if (_current.value) {
    writeBoth(CURRENT_KEY, JSON.stringify(_current.value))  // writes both keys during transition
  } else {
    // Remove both keys so readMigrated can't resurrect stale data from the old key
    try { localStorage.removeItem(CURRENT_KEY) } catch { /* quota */ }
    const legacyKey = oldKeyFor(CURRENT_KEY)
    if (legacyKey) { try { localStorage.removeItem(legacyKey) } catch { /* quota */ } }
  }
}

// ── Reactive all-models list ──────────────────────────────────────────────────
// Kept in sync whenever any model is written so components can watch it.

function _sortedModels(raw: SpecModel[]): SpecModel[] {
  return [...raw].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
}

const _allModels = ref<SpecModel[]>(_sortedModels(_loadAll()))

function _syncAllModels(): void {
  _allModels.value = _sortedModels(_loadAll())
}

function _upsertHistory(model: SpecModel): void {
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
 *
 * People policy (Planguage principle: roles are plan-specific commitments):
 *   owners   → [] — Owner is the accountable stakeholder for *this* plan, unknown until assigned.
 *   planners → [] — Planner is the idea-director for *this* plan, unknown until assigned.
 *   scribes  → [device user default] — We always know who is at the keyboard.
 *              The default Scribe entry is pre-populated from the stored device-user
 *              name (sem-device-user-name localStorage key) and marked isDefault:true
 *              so it is clearly labelled "(default setting)" in the UI.
 *
 * Migration path: if sem-device-user-name has not been set yet but the previous
 * plan had a named default scribe, that name is promoted to the device-user store
 * automatically so future plans pick it up.
 */
export function initSpecModel(spec: SpecBlock, name?: string): SpecModel {
  const modelName = name ?? _nameFromSpec(spec)
  const now = new Date().toISOString()

  // If no device-user name is stored yet, try to migrate from the previous plan's
  // default scribe so the user doesn't start blank after the first upgrade.
  if (!getDeviceUserName()) {
    const prev = _current.value
    const prevDefaultName = prev?.scribes?.find(s => s.isDefault)?.name
      ?? prev?.scribes?.[0]?.name
      ?? ''
    if (prevDefaultName) setDeviceUserName(prevDefaultName)
  }

  const model: SpecModel = {
    id: crypto.randomUUID(),
    name: modelName,
    version: '0.1',
    tag: _slugify(modelName),
    createdAt: now,
    updatedAt: now,
    spec,
    sharpenRounds: 0,
    owners:   [],
    planners: [],
    scribes:  [_defaultScribe()],
    specSource: 'ai-generated',
    manualEditCount: 0,
    governance: { ...DEFAULT_GOVERNANCE, specOwners: [] },
    // Evo Cycle Length: default weekly cadence (Tom 2026-06-02 SEM App Book p.179)
    evoCycleLength: 'week',
    // Project DEADLINE: '?' until the user articulates it (Tom 2026-06-06 r98).
    deadline: '?',
  }
  _current.value = model
  _persistCurrent()
  _upsertHistory(model)
  return model
}

/** Derive a model name from the spec — uses "Model: X" prefix. */
function _modelNameFromSpec(spec: SpecBlock): string {
  const STOP = new Set(['of','the','a','an','for','in','on','at','to','by','with','and','or','its','their','our','is','are','be'])
  function headline(desc: string, n: number): string {
    return desc.trim().split(/\s+/)
      .filter(w => w.length > 1 && !STOP.has(w.toLowerCase()) && /[a-zA-Z]/.test(w))
      .slice(0, n)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ')
  }
  if (spec.functions.length > 0) {
    const h = headline(spec.functions[0].description, 4)
    if (h) return `Model: ${h}`.slice(0, 50)
  }
  if (spec.values.length > 0) {
    const h = headline(spec.values[0].description, 3)
    if (h) return `Model: ${h}`.slice(0, 50)
  }
  return 'System Model'
}

/**
 * Create a new System Model record (workingMode: 'model').
 * Similar to initPlanModel() but sets the working mode to 'model'
 * and uses "Model: " prefix in the auto-generated name.
 */
export function initModelRecord(spec: SpecBlock, name?: string, systemDescription?: string): SpecModel {
  // Reuse the existing initSpecModel logic, then patch the mode
  const model = initSpecModel(spec, name ?? _modelNameFromSpec(spec))
  const patched: SpecModel = {
    ...model,
    workingMode: 'model',
    specSource: 'ai-generated',
    ...(systemDescription ? { systemDescription } : {}),
  }
  _current.value = patched
  _persistCurrent()
  _upsertHistory(patched)
  return patched
}

/**
 * Canonical hours per Evo cycle length value.
 * Used by EvoCycleLengthPicker and step-card hour estimates.
 * Tom 2026-06-02 (SEM App Book p.179).
 */
export const EVO_CYCLE_HOURS: Record<'day' | 'week' | 'month' | 'quarter', number> = {
  day:     8,
  week:    40,
  month:   160,
  quarter: 480,
}

/**
 * Set the Evo Cycle Length for the current plan model.
 * Tom 2026-06-02 (SEM App Book p.179): "Evo steps are designed to fit a specified cycle maximum."
 * This constrains how the LLM generates step effort estimates and how effortPercent maps to hours.
 */
export function setEvoCycleLength(length: 'day' | 'week' | 'month' | 'quarter'): void {
  if (!_current.value) return
  const updated: SpecModel = {
    ..._current.value,
    evoCycleLength: length,
    updatedAt: new Date().toISOString(),
  }
  _current.value = updated
  _persistCurrent()
  _upsertHistory(updated)
}

/**
 * Set the project DEADLINE — scalar Condition [When] applying whole-spec.
 * Tom Gilb 2026-06-06 r98 directive: every spec needs an articulable Deadline,
 * even if initially "?".  Free-text accepted; future schema slices can add
 * structured Date / Event variants.
 */
export function setDeadline(deadline: string): void {
  if (!_current.value) return
  const updated: SpecModel = {
    ..._current.value,
    deadline: deadline.trim() || '?',
    updatedAt: new Date().toISOString(),
  }
  _current.value = updated
  _persistCurrent()
  _upsertHistory(updated)
}

/**
 * Switch the working mode of the current model.
 * Safe to call at any time — the spec data is preserved unchanged.
 */
export function setWorkingMode(mode: 'plan' | 'model'): void {
  if (!_current.value) return
  const updated: SpecModel = {
    ..._current.value,
    workingMode: mode,
    updatedAt: new Date().toISOString(),
  }
  _current.value = updated
  _persistCurrent()
  _upsertHistory(updated)
}

/**
 * Bump the version by 0.1. Call this after each successful sharpening round.
 * Also increments sharpenRounds and updates the spec snapshot.
 */
export function bumpSpecVersion(updatedSpec?: SpecBlock): void {
  if (!_current.value) return
  const updated: SpecModel = {
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
export function saveSpecSnapshot(spec: SpecBlock): void {
  if (!_current.value) return
  const updated: SpecModel = {
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
export function setSpecVersion(v: string): void {
  if (!_current.value) return
  const updated: SpecModel = {
    ..._current.value,
    version: v,
    updatedAt: new Date().toISOString(),
  }
  _current.value = updated
  _persistCurrent()
  _upsertHistory(updated)
}

/** Rename the spec model. Regenerates the tag slug. */
export function setSpecName(name: string): void {
  if (!_current.value) return
  const updated: SpecModel = {
    ..._current.value,
    name,
    tag: _slugify(name),
    updatedAt: new Date().toISOString(),
  }
  _current.value = updated
  _persistCurrent()
  _upsertHistory(updated)
}

// ── Owners CRUD ───────────────────────────────────────────────────────────────
//
// Tom 2026-05-13: "is Handtuned in story really updated? it seems stuck at 50%".
// The Hand-Tuned bar formula only moved when SpecEditorPanel saved a draft —
// nothing else bumped `manualEditCount`. Adding/updating/removing stewards is
// real human curation work (typing a name, choosing dates, assigning roles)
// and absolutely should tilt the bar toward You. Every steward CRUD function
// below now bumps `manualEditCount` so the strip moves visibly with each save.

/** Add a new owner. Returns the new record (with generated id). */
export function addOwner(data: Omit<SpecPerson, 'id'>): SpecPerson {
  if (!_current.value) throw new Error('No active spec model')
  const person: SpecPerson = { id: crypto.randomUUID(), ..._emptyPerson(), ...data }
  const updated: SpecModel = {
    ..._current.value,
    owners: [..._current.value.owners, person],
    manualEditCount: (_current.value.manualEditCount ?? 0) + 1,
    updatedAt: new Date().toISOString(),
  }
  _current.value = updated; _persistCurrent(); _upsertHistory(updated)
  return person
}

/** Update an owner's fields by id. */
export function updateOwner(id: string, data: Partial<Omit<SpecPerson, 'id'>>): void {
  if (!_current.value) return
  const updated: SpecModel = {
    ..._current.value,
    owners: _current.value.owners.map((o) => o.id === id ? { ...o, ...data } : o),
    manualEditCount: (_current.value.manualEditCount ?? 0) + 1,
    updatedAt: new Date().toISOString(),
  }
  _current.value = updated; _persistCurrent(); _upsertHistory(updated)
}

/** Remove an owner by id. */
export function removeOwner(id: string): void {
  if (!_current.value) return
  const updated: SpecModel = {
    ..._current.value,
    owners: _current.value.owners.filter((o) => o.id !== id),
    manualEditCount: (_current.value.manualEditCount ?? 0) + 1,
    updatedAt: new Date().toISOString(),
  }
  _current.value = updated; _persistCurrent(); _upsertHistory(updated)
}

// ── Planners CRUD ─────────────────────────────────────────────────────────────

/** Add a new planner (scribe/author). Returns the new record. */
export function addPlanner(data: Omit<SpecPerson, 'id'>): SpecPerson {
  if (!_current.value) throw new Error('No active spec model')
  const person: SpecPerson = { id: crypto.randomUUID(), ..._emptyPerson(), ...data }
  const updated: SpecModel = {
    ..._current.value,
    planners: [..._current.value.planners, person],
    manualEditCount: (_current.value.manualEditCount ?? 0) + 1,
    updatedAt: new Date().toISOString(),
  }
  _current.value = updated; _persistCurrent(); _upsertHistory(updated)
  return person
}

/** Update a planner's fields by id. */
export function updatePlanner(id: string, data: Partial<Omit<SpecPerson, 'id'>>): void {
  if (!_current.value) return
  const updated: SpecModel = {
    ..._current.value,
    planners: _current.value.planners.map((p) => p.id === id ? { ...p, ...data } : p),
    manualEditCount: (_current.value.manualEditCount ?? 0) + 1,
    updatedAt: new Date().toISOString(),
  }
  _current.value = updated; _persistCurrent(); _upsertHistory(updated)
}

/** Remove a planner by id. */
export function removePlanner(id: string): void {
  if (!_current.value) return
  const updated: SpecModel = {
    ..._current.value,
    planners: _current.value.planners.filter((p) => p.id !== id),
    manualEditCount: (_current.value.manualEditCount ?? 0) + 1,
    updatedAt: new Date().toISOString(),
  }
  _current.value = updated; _persistCurrent(); _upsertHistory(updated)
}

// ── Scribes CRUD ──────────────────────────────────────────────────────────────

/** Add a new scribe (the person doing the actual keying/dictation). Returns the new record. */
export function addScribe(data: Omit<SpecPerson, 'id'>): SpecPerson {
  if (!_current.value) throw new Error('No active spec model')
  const person: SpecPerson = { id: crypto.randomUUID(), ..._emptyPerson(), ...data }
  const updated: SpecModel = {
    ..._current.value,
    scribes: [...(_current.value.scribes ?? []), person],
    manualEditCount: (_current.value.manualEditCount ?? 0) + 1,
    updatedAt: new Date().toISOString(),
  }
  _current.value = updated; _persistCurrent(); _upsertHistory(updated)
  return person
}

/** Update a scribe's fields by id. */
export function updateScribe(id: string, data: Partial<Omit<SpecPerson, 'id'>>): void {
  if (!_current.value) return
  const updated: SpecModel = {
    ..._current.value,
    scribes: (_current.value.scribes ?? []).map((s) => s.id === id ? { ...s, ...data } : s),
    manualEditCount: (_current.value.manualEditCount ?? 0) + 1,
    updatedAt: new Date().toISOString(),
  }
  _current.value = updated; _persistCurrent(); _upsertHistory(updated)
}

/** Remove a scribe by id. */
export function removeScribe(id: string): void {
  if (!_current.value) return
  const updated: SpecModel = {
    ..._current.value,
    scribes: (_current.value.scribes ?? []).filter((s) => s.id !== id),
    manualEditCount: (_current.value.manualEditCount ?? 0) + 1,
    updatedAt: new Date().toISOString(),
  }
  _current.value = updated; _persistCurrent(); _upsertHistory(updated)
}

// ── Planner Consequences tracking ─────────────────────────────────────────────

/**
 * Increment the manual-edit counter on the active plan model.
 * Call this whenever a human saves a manual edit in the Spec Editor.
 * Used by PlanDNAStrip to compute the human-engagement ratio.
 */
export function incrementManualEditCount(): void {
  if (!_current.value) return
  const updated: SpecModel = {
    ..._current.value,
    manualEditCount: (_current.value.manualEditCount ?? 0) + 1,
    updatedAt: new Date().toISOString(),
  }
  _current.value = updated; _persistCurrent(); _upsertHistory(updated)
}

/**
 * @deprecated Use addOwner / updateOwner instead.
 * Thin shim kept for legacy callers (quick-rename popover sets owner name).
 * Upserts owners[0] with the given fields; creates an entry if owners is empty.
 */
export function updatePlanOwner(data: Partial<Omit<SpecPerson, 'id'>>): void {
  if (!_current.value) return
  if (_current.value.owners.length === 0) {
    addOwner({ ..._emptyPerson(), ...data })
  } else {
    updateOwner(_current.value.owners[0].id, data)
  }
}

/**
 * Update the Plan-as-Stakeholder governance fields (wishLevel, goalLevel).
 * Does NOT touch the specOwners list.
 */
export function updateGovernance(data: Partial<Pick<SpecGovernance, 'wishLevel' | 'goalLevel'>>): void {
  if (!_current.value) return
  const updated: SpecModel = {
    ..._current.value,
    governance: { ..._current.value.governance, ...data },
    updatedAt: new Date().toISOString(),
  }
  _current.value = updated
  _persistCurrent()
  _upsertHistory(updated)
}

/**
 * Add a new Spec Owner covering a named specification area.
 * Returns the newly created SpecOwner (with generated id).
 */
export function addSpecOwner(data: Omit<SpecOwner, 'id'>): SpecOwner {
  if (!_current.value) throw new Error('No active spec model')
  const newOwner: SpecOwner = { id: crypto.randomUUID(), ...data }
  const updated: SpecModel = {
    ..._current.value,
    governance: {
      ..._current.value.governance,
      specOwners: [..._current.value.governance.specOwners, newOwner],
    },
    updatedAt: new Date().toISOString(),
  }
  _current.value = updated
  _persistCurrent()
  _upsertHistory(updated)
  return newOwner
}

/**
 * Update a Spec Owner's fields by id.
 * Pass only the fields you want to change; others are preserved.
 */
export function updateSpecOwner(id: string, data: Partial<Omit<SpecOwner, 'id'>>): void {
  if (!_current.value) return
  const specOwners = _current.value.governance.specOwners.map((o) =>
    o.id === id ? { ...o, ...data } : o,
  )
  const updated: SpecModel = {
    ..._current.value,
    governance: { ..._current.value.governance, specOwners },
    updatedAt: new Date().toISOString(),
  }
  _current.value = updated
  _persistCurrent()
  _upsertHistory(updated)
}

/** Remove a Spec Owner by id. */
export function removeSpecOwner(id: string): void {
  if (!_current.value) return
  const specOwners = _current.value.governance.specOwners.filter((o) => o.id !== id)
  const updated: SpecModel = {
    ..._current.value,
    governance: { ..._current.value.governance, specOwners },
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
export function loadPlanByTag(tag: string, version?: string): SpecModel | null {
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
export function loadPlanByDate(tag: string, date: string): SpecModel | null {
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
export function importPlanModel(data: unknown): SpecModel | null {
  try {
    const m = data as Partial<ExportedSpecFile>
    if (!m.name || !m.version || !m.spec) return null

    // Pull off the non-SpecModel fields BEFORE constructing the model — they
    // must not end up persisted in localStorage. The snapshot is documentary only;
    // we drop it. The sidecar collections get routed back to their own composables'
    // stores below.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { _planStorySidecar, _planStorySnapshot: _snapshot, ...rawPlan } = data as any
    void _snapshot  // intentionally discarded — UI always recomputes live

    // Spread raw data first so legacy `owner` (singular) is visible to _migrate();
    // then override computed / required fields. _migrate() handles owner → owners[].
    const model = _migrate({
      ...rawPlan,
      id: m.id ?? crypto.randomUUID(),
      tag: m.tag ?? _slugify(m.name),
      createdAt: m.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sharpenRounds: m.sharpenRounds ?? 0,
      // Mark as imported unless the source file already carries a specSource value
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      specSource: (data as any).specSource ?? 'imported',
    })
    _current.value = model
    _persistCurrent()
    _upsertHistory(model)

    // ── Plan Story sidecar restore (Tom 2026-05-13 — Option B). ────────────
    // Re-attach priority records and spec annotations from the export's
    // sidecar block to their own localStorage keys, keyed by the (possibly
    // new) model id. `_set...ForPlan` updates the reactive store too, so
    // every live `usePriorityRecord(id)` / `useSpecAnnotations(id)`
    // subscriber re-renders without a page reload.
    if (_planStorySidecar && typeof _planStorySidecar === 'object') {
      const sc = _planStorySidecar as Partial<SpecStorySidecar>
      if (Array.isArray(sc.priorityRecords) && sc.priorityRecords.length > 0) {
        _setPriorityRecordsForPlan(model.id, sc.priorityRecords as PriorityRecord[])
      }
      if (sc.annotations && typeof sc.annotations === 'object') {
        _setAnnotationsForPlan(model.id, sc.annotations as Record<string, SpecAnnotation>)
      }
    }

    // Phase 1 (Sources of Specs) — record import provenance for all entries
    initEntriesFromSpec(model.id, model.spec, {
      actor:           'app',
      changeType:      'import',
      humanInputWords: 0,
      label:           'plan import',
    })
    return model
  } catch {
    return null
  }
}

/**
 * Compute the Plan Story snapshot at export time. Mirrors the formula in
 * `PlanDNAStrip.vue` (the strip's Hand-Tuned chapter) so a JSON reader sees
 * exactly the percentage / narrative the user saw when they hit export.
 *
 * Origin baseline (Tom 2026-05-12 fairness rule — never under-credit the user):
 *   manual    → 80% You (you typed it from scratch)
 *   ai-gen    → 50% You (you prompted, AI drafted)
 *   imported  → 30% You (you found / loaded it)
 *
 * Tilt weights (cognitive significance, not raw signal count):
 *   sharpen round    +5
 *   priority record  +3
 *   manual edit      +2
 *   annotation       +1
 *
 * Capped [0, 100].
 */
function _computeSpecStorySnapshot(
  model: SpecModel,
  priorityRecordCount: number,
  annotationCount: number,
): SpecStorySnapshot {
  const baseline =
    model.specSource === 'manual'   ? 80
  : model.specSource === 'imported' ? 30
  :                                   50  // 'ai-generated'

  const sharpenRounds = model.sharpenRounds ?? 0
  const manualEdits   = model.manualEditCount ?? 0

  const sharpenPts    = sharpenRounds       * 5
  const priorityPts   = priorityRecordCount * 3
  const editPts       = manualEdits         * 2
  const annotationPts = annotationCount     * 1

  const totalTilt    = sharpenPts + priorityPts + editPts + annotationPts
  const handTunedPct = Math.min(100, Math.max(0, baseline + totalTilt))
  const aiPct        = 100 - handTunedPct

  // Narrative — same join order as PlanDNAStrip.vue `handTunedNarrative`
  const parts: string[] = []
  if (model.specSource === 'manual')        parts.push('You typed this from scratch')
  else if (model.specSource === 'imported') parts.push('You loaded this plan')
  else                                      parts.push('AI drafted from your prompt')
  if (sharpenRounds       > 0) parts.push(`sharpened ${sharpenRounds}×`)
  if (priorityRecordCount > 0) parts.push(`${priorityRecordCount} decision${priorityRecordCount === 1 ? '' : 's'}`)
  if (manualEdits         > 0) parts.push(`${manualEdits} edit${manualEdits === 1 ? '' : 's'}`)
  if (annotationCount     > 0) parts.push(`${annotationCount} flag${annotationCount === 1 ? '' : 's'}`)
  const narrative = parts.join(' · ')

  // Chapters — mirror the strip's chapter labels
  const originLabel =
    model.specSource === 'manual'   ? 'Hand-built'
  : model.specSource === 'imported' ? 'Imported'
  :                                   'AI draft'

  const stewardCount =
      (model.owners?.length   ?? 0)
    + (model.planners?.length ?? 0)
    + (model.scribes?.filter(s => s.name && !s.isDefault).length ?? 0)

  const ms   = Date.now() - new Date(model.createdAt).getTime()
  const days = Math.max(0, Math.floor(ms / 86_400_000))
  const age  = days === 0 ? 'Today' : days === 1 ? '1 day' : `${days} days`

  return {
    exportedAt:   new Date().toISOString(),
    handTunedPct,
    aiPct,
    narrative,
    chapters: {
      origin:     originLabel,
      handTuned:  `${handTunedPct}% You · ${aiPct}% AI`,
      sharpened:  sharpenRounds === 0 ? 'None yet' : `${sharpenRounds} round${sharpenRounds === 1 ? '' : 's'}`,
      stewards:   stewardCount === 0 ? 'Unowned'    : `${stewardCount} ${stewardCount === 1 ? 'person' : 'people'}`,
      age,
    },
    formula: {
      baseline,
      sharpenPts,
      priorityPts,
      editPts,
      annotationPts,
      totalTilt,
    },
  }
}

/**
 * Trigger a browser download of the current model as a .json file.
 * Filename: <tag>-v<version>.json (e.g. "sem-app-plan-v0.3.json")
 *
 * Plan Story export rule (Tom 2026-05-13 "yes B+C"):
 * The exported JSON includes — at the top level alongside the PlanModel
 * fields — two extra blocks so the recipient gets the full authorship story
 * regardless of whether the Plan Story strip was open at export time:
 *
 *   _planStorySidecar  → priorityRecords[] + annotations{} that drive
 *                        the Hand-Tuned percentage but live in separate
 *                        localStorage keys; restored on re-import.
 *   _planStorySnapshot → human-readable computed snapshot of the strip
 *                        as of the export moment (handTunedPct, narrative,
 *                        per-chapter labels, formula breakdown). Purely
 *                        documentary — the UI always recomputes from live
 *                        data on import.
 *
 * Backwards compatible: older importers that read only PlanModel root
 * fields keep working; the new fields are opportunistic.
 */
export function exportPlanModel(): void {
  if (!_current.value) return
  const m = _current.value

  const priorityRecords = _getPriorityRecordsForPlan(m.id)
  const annotations     = _getAnnotationsForPlan(m.id)
  const snapshot        = _computeSpecStorySnapshot(
    m,
    priorityRecords.length,
    Object.keys(annotations).length,
  )

  const payload: ExportedSpecFile = {
    ...m,
    _planStorySidecar:  { priorityRecords, annotations },
    _planStorySnapshot: snapshot,
  }

  const json = JSON.stringify(payload, null, 2)
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
      const m = raw as Partial<SpecModel>
      if (!m.name || !m.version || !m.spec) continue
      if (m.id && existingIds.has(m.id)) continue  // already present — skip

      // Spread raw entry first so legacy `owner` (singular) is visible to _migrate();
      // then override computed / required fields. _migrate() handles owner → owners[].
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const model = _migrate({
        ...(raw as any),
        id:           m.id ?? crypto.randomUUID(),
        tag:          m.tag ?? _slugify(m.name),
        createdAt:    m.createdAt ?? new Date().toISOString(),
        updatedAt:    m.updatedAt ?? new Date().toISOString(),
        sharpenRounds: m.sharpenRounds ?? 0,
      })
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
export function specVersionsForTag(tag: string): SpecModel[] {
  return _loadAll().filter((m) => m.tag === tag)
}

/** Clear the current model reference. Call on startFresh(). */
export function clearPlanModel(): void {
  _current.value = null
  _persistCurrent()
}

// ── New model-management helpers ──────────────────────────────────────────────

/** All saved models, newest-first (reactive ref — updates whenever any model is written). */
export function getAllPlanModels(): ReadonlyArray<SpecModel> {
  return _allModels.value
}

/** The most recently updated saved model, or null if none are saved. */
export function latestPlanModel(): SpecModel | null {
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
export function renameSpecModel(id: string, name: string): void {
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
export function activatePlanModel(model: SpecModel): void {
  _current.value = model
  _persistCurrent()
}

// ── Composable export ─────────────────────────────────────────────────────────

// ── Backward-compat top-level exports ────────────────────────────────────────
// Kept so test files and any external callers that import by old name still work.
// These are direct references to the renamed functions — no wrapping, no overhead.

/** @deprecated Use initSpecModel */
export const initPlanModel = initSpecModel
/** @deprecated Use bumpSpecVersion */
export const bumpPlanVersion = bumpSpecVersion
/** @deprecated Use saveSpecSnapshot */
export const savePlanSnapshot = saveSpecSnapshot
/** @deprecated Use renameSpecModel */
export const renamePlanModel = renameSpecModel
/** @deprecated Use setSpecVersion */
export const setPlanVersion = setSpecVersion
/** @deprecated Use setSpecName */
export const setPlanName = setSpecName
/** @deprecated Use specVersionsForTag */
export const planVersionsForTag = specVersionsForTag
/** @deprecated Use listRecentSpecs */
export const listRecentPlans = listRecentSpecs

export function useSpecModel() {
  return {
    /** The currently active Spec Model (reactive, readonly). */
    currentModel: readonly(_current),
    /** All saved models, newest-first (reactive). */
    allModels: readonly(_allModels),
    initSpecModel,
    bumpSpecVersion,
    setSpecVersion,
    setSpecName,
    addOwner,
    updateOwner,
    removeOwner,
    addPlanner,
    updatePlanner,
    removePlanner,
    updatePlanOwner,
    updateGovernance,
    addSpecOwner,
    updateSpecOwner,
    removeSpecOwner,
    loadPlanByTag,
    loadPlanByDate,
    importPlanModel,
    exportPlanModel,
    exportAllPlanModelsBackup,
    importPlanModelsBackup,
    allPlanTags,
    specVersionsForTag,
    getAllPlanModels,
    latestPlanModel,
    deletePlanModel,
    renameSpecModel,
    activatePlanModel,
    saveSpecSnapshot,
    clearPlanModel,
    initModelRecord,
    setWorkingMode,
    setEvoCycleLength,
    setDeadline,    // r98 — scalar Deadline editor
    // Backward-compat aliases (deprecated — use new names above)
    initPlanModel: initSpecModel,
    bumpPlanVersion: bumpSpecVersion,
    setPlanVersion: setSpecVersion,
    setPlanName: setSpecName,
    savePlanSnapshot: saveSpecSnapshot,
    planVersionsForTag: specVersionsForTag,
    renamePlanModel: renameSpecModel,
    listRecentPlans: listRecentSpecs,
  }
}
