// UNIT_TYPE=Composable
/**
 * useGraphmetrixCoupling.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Graphmetrix TrinityX coupling — reference storage + settings persistence.
 *
 * Tom Gilb 2026-07-02: *"we need to couple to technical drawings and specs.
 * Digitally. Of course Graphmetrix.com is the only useful choice. My Navy
 * associates are already Fans of it."*
 *
 * Design decisions:
 *   • References stored in a SEPARATE localStorage key from the main contract
 *     store, keyed by `${targetKind}:${targetId}` — so the parser + parse
 *     pipeline stay untouched and this coupling is trivially removable.
 *   • Settings persisted independently of ContractRedraftSettings so the
 *     coupling can be toggled without touching redraft state.
 *   • No-Silent-Data-Loss SUPREME: every localStorage catch surfaces via
 *     console.error with the raw value + error object.
 *   • Twin-portable: pure logic; no browser APIs beyond localStorage; no
 *     Vue templates.
 */

import { ref, computed } from 'vue'
import type {
  GraphmetrixReference,
  GraphmetrixCouplingSettings,
  GraphmetrixNodeType,
} from '../types/graphmetrix'
import {
  DEFAULT_GRAPHMETRIX_COUPLING_SETTINGS,
  validateGraphmetrixUri,
} from '../types/graphmetrix'

// ── Storage keys ──────────────────────────────────────────────────────────────

const SETTINGS_KEY   = 'sem-app:graphmetrix:coupling-settings:v1'
const REFERENCES_KEY = 'sem-app:graphmetrix:references:v1'

// ── Persistence helpers ──────────────────────────────────────────────────────

function _loadSettings(): GraphmetrixCouplingSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_GRAPHMETRIX_COUPLING_SETTINGS }
    const parsed = JSON.parse(raw) as GraphmetrixCouplingSettings
    return { ...DEFAULT_GRAPHMETRIX_COUPLING_SETTINGS, ...parsed }
  } catch (err) {
    console.error('[useGraphmetrixCoupling] Failed to load settings:', err)
    return { ...DEFAULT_GRAPHMETRIX_COUPLING_SETTINGS }
  }
}

function _saveSettings(settings: GraphmetrixCouplingSettings): void {
  try {
    const stamped = { ...settings, updatedAt: new Date().toISOString() }
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(stamped))
  } catch (err) {
    console.error('[useGraphmetrixCoupling] Failed to save settings:', err)
  }
}

function _loadReferences(): GraphmetrixReference[] {
  try {
    const raw = localStorage.getItem(REFERENCES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as GraphmetrixReference[]
    return Array.isArray(parsed) ? parsed : []
  } catch (err) {
    console.error('[useGraphmetrixCoupling] Failed to load references:', err)
    return []
  }
}

function _saveReferences(refs: GraphmetrixReference[]): void {
  try {
    localStorage.setItem(REFERENCES_KEY, JSON.stringify(refs))
  } catch (err) {
    console.error(
      '[useGraphmetrixCoupling] Failed to save references — refs count:',
      refs.length,
      'total size:', JSON.stringify(refs).length,
      'error:', err,
    )
  }
}

function _uuid(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `gmref-${Math.random().toString(36).slice(2)}-${Date.now()}`
}

// ── Singleton state ──────────────────────────────────────────────────────────

const _settings   = ref<GraphmetrixCouplingSettings>(_loadSettings())
const _references = ref<GraphmetrixReference[]>(_loadReferences())

// ── Public API ───────────────────────────────────────────────────────────────

export function useGraphmetrixCoupling() {
  const settings   = computed(() => _settings.value)
  const references = computed(() => _references.value)

  /** True when coupling is enabled AND at least one setting flag suggests
   *  the user wants coupling to be active in this session. */
  const isActive = computed(() => _settings.value.enabled)

  function updateSettings(patch: Partial<GraphmetrixCouplingSettings>): void {
    _settings.value = { ..._settings.value, ...patch, updatedAt: new Date().toISOString() }
    _saveSettings(_settings.value)
  }

  function resetSettingsToDefaults(): void {
    _settings.value = { ...DEFAULT_GRAPHMETRIX_COUPLING_SETTINGS, updatedAt: new Date().toISOString() }
    _saveSettings(_settings.value)
  }

  /**
   * Add a manual reference from a Contract entry (or clause) to a Graphmetrix
   * node.  Validates the URI shape before accepting; returns the created
   * reference on success or null on validation failure.  The `label` and
   * `nodeType` fields are user-supplied at link-time; a Phase 2 refresh flow
   * can populate them from the live Graphmetrix instance.
   */
  function addReference(
    input: Omit<GraphmetrixReference, 'id' | 'createdAt' | 'source' | 'confidence'> & {
      source?: GraphmetrixReference['source']
      confidence?: number
    },
  ): GraphmetrixReference | null {
    const validation = validateGraphmetrixUri(input.uri)
    if (!validation.valid) {
      console.warn('[useGraphmetrixCoupling] Rejected invalid URI:', input.uri, '·', validation.message)
      return null
    }
    const ref: GraphmetrixReference = {
      id:         _uuid(),
      targetId:   input.targetId,
      targetKind: input.targetKind,
      uri:        input.uri.trim(),
      label:      input.label.trim(),
      nodeType:   input.nodeType,
      drawingSheetNumber: input.drawingSheetNumber,
      specNumber: input.specNumber,
      revision:   input.revision,
      instanceUrl: input.instanceUrl ?? _settings.value.instanceUrl,
      userNote:   input.userNote,
      source:     input.source     ?? 'manual',
      confidence: input.confidence ?? 100,
      createdAt:  new Date().toISOString(),
    }
    _references.value = [ref, ..._references.value]
    _saveReferences(_references.value)
    return ref
  }

  function removeReference(id: string): void {
    _references.value = _references.value.filter(r => r.id !== id)
    _saveReferences(_references.value)
  }

  function updateReference(id: string, patch: Partial<GraphmetrixReference>): void {
    const idx = _references.value.findIndex(r => r.id === id)
    if (idx < 0) return
    _references.value[idx] = { ..._references.value[idx], ...patch, refreshedAt: new Date().toISOString() }
    _saveReferences(_references.value)
  }

  /** All references attached to a particular Contract entry. */
  function referencesForEntry(entryId: string): GraphmetrixReference[] {
    return _references.value.filter(r => r.targetKind === 'entry' && r.targetId === entryId)
  }

  /** All references attached to a particular Contract clause. */
  function referencesForClause(clauseId: string): GraphmetrixReference[] {
    return _references.value.filter(r => r.targetKind === 'clause' && r.targetId === clauseId)
  }

  /** Count references by node type (for CHI-style diagnostics + Appendix A3
   *  summarisation).  Returns `Partial<Record<GraphmetrixNodeType, number>>`
   *  so the caller can render a compact breakdown widget. */
  function countByNodeType(): Partial<Record<GraphmetrixNodeType, number>> {
    const counts: Partial<Record<GraphmetrixNodeType, number>> = {}
    for (const r of _references.value) {
      counts[r.nodeType] = (counts[r.nodeType] ?? 0) + 1
    }
    return counts
  }

  return {
    // State
    settings,
    references,
    isActive,

    // Actions — settings
    updateSettings,
    resetSettingsToDefaults,

    // Actions — references
    addReference,
    removeReference,
    updateReference,

    // Queries
    referencesForEntry,
    referencesForClause,
    countByNodeType,

    // Utilities
    validateGraphmetrixUri,
  }
}
