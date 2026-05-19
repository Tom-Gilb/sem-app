// Feature #197 — Tool Info
// Stores the manually-entered metadata for the "Tool Info" panel on the identity bar.
// Auto-derived fields (purposes, related specs, originator) come from the spec/plan model.
// This composable persists only what cannot be derived.

import { ref, computed } from 'vue'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ToolInfoMeta {
  planModelId:   string
  tag:           string       // Short category label, e.g. "AI Tool", "Planguage Spec"
  description:   string       // Brief plain-language description of what this tool/plan does
  urls:          string[]     // Links to related external resources
  relatedSpecs:  string[]     // Names of related external specifications / standards
  deepInsights:  string       // Paragraph: non-obvious truths about this tool
  subtlePoints:  string       // Paragraph: edge cases, caveats, gotchas
  synonymNames:  string[]     // Other names this tool / product is known by
  relatedTools:  string[]     // Names of related external tools / systems
}

function _emptyMeta(id: string): ToolInfoMeta {
  return {
    planModelId:  id,
    tag:          '',
    description:  '',
    urls:         [],
    relatedSpecs: [],
    deepInsights: '',
    subtlePoints: '',
    synonymNames: [],
    relatedTools: [],
  }
}

const STORAGE_KEY = 'sem-tool-info'

function _load(): Record<string, ToolInfoMeta> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function _save(store: Record<string, ToolInfoMeta>): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)) } catch { /* quota */ }
}

// ── Module-level singletons ───────────────────────────────────────────────────

const _store     = ref<Record<string, ToolInfoMeta>>(_load())
const _panelOpen = ref(false)

// ── Composable ────────────────────────────────────────────────────────────────

export function useToolInfo() {
  const panelOpen = computed(() => _panelOpen.value)

  function openPanel(): void  { _panelOpen.value = true  }
  function closePanel(): void { _panelOpen.value = false }

  function getMeta(planModelId: string): ToolInfoMeta {
    return _store.value[planModelId] ?? _emptyMeta(planModelId)
  }

  function updateMeta(planModelId: string, patch: Partial<Omit<ToolInfoMeta, 'planModelId'>>): void {
    const existing = getMeta(planModelId)
    _store.value = {
      ..._store.value,
      [planModelId]: { ...existing, ...patch },
    }
    _save(_store.value)
  }

  // ── List helpers for URL / synonym / related-tool arrays ─────────────────────

  function addUrl(planModelId: string, url: string): void {
    const url_ = url.trim()
    if (!url_) return
    const meta = getMeta(planModelId)
    if (meta.urls.includes(url_)) return
    updateMeta(planModelId, { urls: [...meta.urls, url_] })
  }

  function removeUrl(planModelId: string, index: number): void {
    const meta = getMeta(planModelId)
    updateMeta(planModelId, { urls: meta.urls.filter((_, i) => i !== index) })
  }

  function addSynonym(planModelId: string, name: string): void {
    const name_ = name.trim()
    if (!name_) return
    const meta = getMeta(planModelId)
    if (meta.synonymNames.includes(name_)) return
    updateMeta(planModelId, { synonymNames: [...meta.synonymNames, name_] })
  }

  function removeSynonym(planModelId: string, index: number): void {
    const meta = getMeta(planModelId)
    updateMeta(planModelId, { synonymNames: meta.synonymNames.filter((_, i) => i !== index) })
  }

  function addRelatedTool(planModelId: string, tool: string): void {
    const tool_ = tool.trim()
    if (!tool_) return
    const meta = getMeta(planModelId)
    if (meta.relatedTools.includes(tool_)) return
    updateMeta(planModelId, { relatedTools: [...meta.relatedTools, tool_] })
  }

  function removeRelatedTool(planModelId: string, index: number): void {
    const meta = getMeta(planModelId)
    updateMeta(planModelId, { relatedTools: meta.relatedTools.filter((_, i) => i !== index) })
  }

  function addRelatedSpec(planModelId: string, spec: string): void {
    const spec_ = spec.trim()
    if (!spec_) return
    const meta = getMeta(planModelId)
    if (meta.relatedSpecs.includes(spec_)) return
    updateMeta(planModelId, { relatedSpecs: [...meta.relatedSpecs, spec_] })
  }

  function removeRelatedSpec(planModelId: string, index: number): void {
    const meta = getMeta(planModelId)
    updateMeta(planModelId, { relatedSpecs: meta.relatedSpecs.filter((_, i) => i !== index) })
  }

  return {
    panelOpen,
    openPanel,
    closePanel,
    getMeta,
    updateMeta,
    addUrl,
    removeUrl,
    addSynonym,
    removeSynonym,
    addRelatedTool,
    removeRelatedTool,
    addRelatedSpec,
    removeRelatedSpec,
  }
}
