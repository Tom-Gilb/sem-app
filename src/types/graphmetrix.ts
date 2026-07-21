// UNIT_TYPE=Types
/**
 * graphmetrix.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Graphmetrix TrinityX coupling — types for linking Contract entries + clauses
 * to live technical drawings, specifications, ontology nodes, and 3D models
 * hosted in a Graphmetrix graph platform.
 *
 * Tom Gilb 2026-07-02 verbatim: *"PS addition to Contract: we need to couple
 * to technical drawings and specs. Digitally. Of course Graphmetrix.com is
 * the only useful choice. My Navy associates are already Fans of it. So
 * integrate it somehow in the contract."*
 *
 * Coupling strategy (Level 1 MVP — Manual URI Attachment):
 *   • Each Contract Entry can carry ZERO OR MORE `GraphmetrixReference`
 *     objects, stored in a SEPARATE keyed-by-entry-id map.  Contract entries
 *     themselves are NOT modified — this keeps the parser + parse pipeline
 *     untouched and the coupling trivially removable.
 *   • References are URIs into a Graphmetrix instance (production graph or
 *     private customer instance).
 *   • Redraft output surfaces every reference in Appendix A3 (Related
 *     Documents) with the Graphmetrix URI + node label + node type.
 *
 * Later levels (banked for Phase 2+):
 *   Level 2 — auto-suggest during parse (Sonnet identifies "the drawings"
 *             / "Schedule A" references and queries Graphmetrix)
 *   Level 3 — bidirectional live coupling (contract becomes a Graphmetrix
 *             node; change here reflects there via webhooks)
 *
 * Twin-portable: plain-object shapes, no Vue reactivity, no browser APIs.
 * Kai's Twin can inherit these types verbatim for its own contract flow.
 */

// ── Node type taxonomy (Graphmetrix / TrinityX / ISO 15926 lineage) ──────────

/**
 * Types of Graphmetrix graph nodes a Contract entry can reference.  Aligned
 * with common industrial engineering data classes (ISO 15926 lineage is the
 * broader ontology, but this list is the pragmatic subset most useful for
 * Navy shipbuilding / construction / procurement contract analysis).
 */
export type GraphmetrixNodeType =
  | 'drawing'            // 2D engineering drawing (blueprint, elevation, plan)
  | 'specification'      // Written technical specification
  | 'p-and-id'           // Piping and Instrumentation Diagram
  | '3d-model'           // 3D CAD model or BIM node
  | 'material'           // Material spec (steel grade, coating, etc.)
  | 'component'          // Named component / assembly (engine, gun mount, etc.)
  | 'system'             // System-level node (propulsion system, weapon system)
  | 'requirement'        // Requirement node (Planguage-style, or SysML)
  | 'ontology-concept'   // Neo / TwinPod ontology concept URI
  | 'test-procedure'     // Trial or acceptance-test procedure
  | 'standard'           // Cited engineering standard (MIL-STD, ASTM, etc.)
  | 'other'

export const GRAPHMETRIX_NODE_LABELS: Record<GraphmetrixNodeType, string> = {
  'drawing':          'Drawing',
  'specification':    'Specification',
  'p-and-id':         'Piping and Instrumentation Diagram',
  '3d-model':         '3D Model',
  'material':         'Material',
  'component':        'Component',
  'system':           'System',
  'requirement':      'Requirement',
  'ontology-concept': 'Ontology Concept',
  'test-procedure':   'Test Procedure',
  'standard':         'Standard',
  'other':            'Other',
}

// ── Reference record ─────────────────────────────────────────────────────────

/**
 * One link from a Contract entry (or clause) to a Graphmetrix graph node.
 * URIs are the durable identity — labels + types are cached-at-link-time
 * metadata so the UI can render without a round-trip if Graphmetrix is
 * offline.  When online, `refreshedAt` bumps and cached fields update.
 */
export interface GraphmetrixReference {
  id:               string
  /** Which Contract entry (or clause) this reference is attached to. */
  targetId:         string
  targetKind:       'entry' | 'clause'
  /** The Graphmetrix URI — durable identity of the graph node. */
  uri:              string
  /** Cached label at link-time (e.g. "Hull Outboard Profile Drawing"). */
  label:            string
  /** Cached node type. */
  nodeType:         GraphmetrixNodeType
  /** Optional cached fields for common node types. */
  drawingSheetNumber?: string
  specNumber?:      string
  revision?:        string
  /** Which Graphmetrix instance URL served this reference (for multi-tenant
   *  auditing — some Navy programs will run private instances). */
  instanceUrl?:     string
  /** Free-text note the user attaches to explain WHY this link matters. */
  userNote?:        string
  /** Provenance — where the link came from. */
  source:           'manual' | 'ai-suggested' | 'auto-detected' | 'imported'
  /** Confidence for AI-suggested links (0-100).  Manual = 100. */
  confidence:       number
  createdAt:        string
  refreshedAt?:     string
}

// ── Coupling settings (extends ContractRedraftSettings via composition) ──────

/**
 * User-editable settings for the Graphmetrix coupling.  Persisted separately
 * from ContractRedraftSettings so the coupling can be toggled independently
 * of the redraft feature (a user might want coupling active during PARSE too,
 * even without ever generating a redraft).
 */
export interface GraphmetrixCouplingSettings {
  /** Master switch — when false, the coupling composable is a no-op. */
  enabled:              boolean
  /** Graphmetrix instance URL — default is https://graphmetrix.com; can be
   *  overridden for private customer instances. */
  instanceUrl:          string
  /** Include Graphmetrix references in the redraft body (as hyperlinks). */
  includeInRedraft:     boolean
  /** Include Graphmetrix references in Appendix A3 (Related Documents). */
  includeInAppendixA3:  boolean
  /** Attempt AI-driven auto-suggestion of links during PARSE (Sonnet
   *  identifies "the drawings" / "Schedule A" phrases and proposes URIs).
   *  Requires the Graphmetrix Query API to be reachable. */
  autoSuggestOnParse:   boolean
  /** When AI-suggested, min confidence to auto-accept (0-100).  Below this
   *  threshold, suggestions go to a review queue. */
  autoAcceptConfidence: number
  /** Enable bidirectional coupling (Level 3) — currently unimplemented; the
   *  flag exists so Ship 2/3 can gate the feature. */
  bidirectionalSync:    boolean
  createdAt:            string
  updatedAt:            string
  schemaVersion:        1
}

/** Ship-safe defaults — Navy pilot: enabled by default; instance URL to
 *  Graphmetrix's canonical endpoint; conservative auto-accept threshold. */
export const DEFAULT_GRAPHMETRIX_COUPLING_SETTINGS: GraphmetrixCouplingSettings = {
  enabled:              true,
  instanceUrl:          'https://graphmetrix.com',
  includeInRedraft:     true,
  includeInAppendixA3:  true,
  autoSuggestOnParse:   false,   // Off by default — requires API reachability
  autoAcceptConfidence: 85,
  bidirectionalSync:    false,   // Level 3 — not yet implemented
  createdAt:            new Date().toISOString(),
  updatedAt:            new Date().toISOString(),
  schemaVersion:        1,
}

// ── URI validation ───────────────────────────────────────────────────────────

/**
 * Basic URI shape validator.  Accepts:
 *   - graphmetrix://... — canonical Graphmetrix URI scheme
 *   - https://<host>/... where host contains "graphmetrix" — instance URL
 *   - Any URI containing a well-known Graphmetrix path prefix (best-effort)
 *
 * Returns { valid: boolean, message?: string } — message populated when
 * invalid so the settings UI can surface a specific reason to the user.
 */
export function validateGraphmetrixUri(uri: string): { valid: boolean; message?: string } {
  const trimmed = (uri ?? '').trim()
  if (!trimmed) return { valid: false, message: 'URI is empty' }
  if (trimmed.startsWith('graphmetrix://')) {
    // Canonical scheme — accept anything after the prefix
    const rest = trimmed.slice('graphmetrix://'.length)
    if (rest.length < 1) return { valid: false, message: 'graphmetrix:// prefix but no node path' }
    return { valid: true }
  }
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    try {
      const url = new URL(trimmed)
      const host = url.hostname.toLowerCase()
      if (host.includes('graphmetrix') || host.includes('trinityx')) return { valid: true }
      return { valid: false, message: `Host "${host}" does not look like a Graphmetrix / TrinityX endpoint` }
    } catch {
      return { valid: false, message: 'Not a valid URL' }
    }
  }
  return { valid: false, message: 'URI must start with graphmetrix://, https://, or http://' }
}
