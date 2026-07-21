/**
 * useIlluminationSession — Phase 5 of the Illumination AI design.
 *
 * Tom Gilb 2026-06-15 verbatim (Phase 5 mandate):
 *   *"Ill-AI: EMAIL ME EVERYTHING IN THIS SESSION ABOUT THIS CONCEPT.
 *    EMAIL ME THE FOLLOWING (give a list of those things we looked at to
 *    select from)"*
 *
 * Captures an in-memory session log of every artefact the planner examined
 * while exploring a single concept-session.  When the session ends (planner
 * clicks ✓ Sharp Enough or 📧 Email everything), a colourful HTML email is
 * composed per the SEM Email Body Standard + Colorful HTML Spec Email Rule,
 * sent to the planner's preferred email address.
 *
 * Two send modes:
 *   (a) EMAIL EVERYTHING — auto-include every logged item for the current
 *       concept (default action).
 *   (b) EMAIL THE FOLLOWING — open a checklist modal, planner ticks which
 *       items to include, then emails only the selected subset.
 *
 * Session lifecycle:
 *   - `startSession(concept)` — called when the picker opens or queryText changes.
 *     Resets the log + records the concept name + classification.
 *   - `log<Event>()` — recorded by each tab as the planner navigates.
 *   - `endSession()` — called when the planner clicks ✓ Sharp Enough.  Triggers
 *     auto-email if Phase 3 preferences say to.
 *
 * Composes with:
 *   - r41 v28 Phase 1 glance card (the ✓ Sharp Enough button triggers
 *     `endSession()` + auto-email)
 *   - r41 v30 Phase 2 classifier (recorded as session metadata)
 *   - r41 v32 Phase 3 per-Owner preferences (preferredEmailAddress)
 *   - Colorful HTML Spec Email Rule SUPREME (every email body is colourful)
 *   - SEM Email Body Standard SUPREME (LOUD ⌘V cue + colourful clipboard
 *     payload + auto-open Mail to recipient)
 *   - r93ppp Twin-as-Destination (every concept cited carries its Twin URL)
 *   - Universal Undo SUPREME (email-send is an EXTERNAL action — explicitly
 *     non-undoable per the rule's "What stays NOT undoable" list)
 *   - No-Silent-Data-Loss SUPREME (session log is purely in-memory but the
 *     planner can email it before it expires)
 *   - American English Standard
 *   - HoverHint (not "tooltip")
 */

import { ref, computed } from 'vue'

// ── Event taxonomy ──────────────────────────────────────────────────────────

export type SessionEventKind =
  | 'tab-visited'           // user activated a tab
  | 'glance-shown'          // glance card displayed
  | 'glance-expanded'       // user clicked "Want to know more"
  | 'glossary-card-shown'   // primary Glossary card rendered
  | 'glossary-secondary'    // secondary chip clicked
  | 'chapter-mention'       // chapter excerpt card clicked
  | 'diagram-rendered'      // mermaid diagram rendered for this concept
  | 'diagram-node-clicked'  // user drilled into a diagram node
  | 'illustration-viewed'   // illustration appeared in carousel
  | 'illustration-enlarged' // user clicked Enlarge / opened lightbox
  | 'universe-hovered'      // user hovered a star
  | 'universe-clicked'      // user clicked a star
  | 'book-opened'           // user clicked a book tile in kaleidoscope
  | 'twin-search-fired'     // Twin auto-fire happened
  | 'twin-result-received'  // Twin returned a response
  | 'twin-concept-drilled'  // user clicked a Twin drill-in concept chip
  | 'classifier-suggested'  // Phase 2 classifier suggested a tab
  | 'sharp-enough'          // user signaled completion

export interface SessionEvent {
  kind:        SessionEventKind
  timestamp:   number          // ms since session start
  /** Human-readable label for the email body (e.g. "Stakeholder *233" or
   *  "Diagram: Tolerable.NNN.md") */
  label:       string
  /** Optional Twin Consultant URL — r93ppp Twin-as-Destination */
  twinUrl?:    string
  /** Optional source file / origin (e.g. illustration URL) */
  sourceUrl?:  string
  /** Optional richer payload — definition snippet, mermaid SVG, etc. */
  detail?:     string
  /** Optional concept number for cross-reference */
  conceptNumber?: string
}

interface SessionState {
  conceptName:   string | null    // canonical name of the concept under exploration
  startedAt:     number           // ms epoch
  endedAt:       number | null    // ms epoch — null = still active
  classification: {
    primaryArea:  string | null
    suggestedTab: string | null
    confidence:   number
  } | null
  events:        SessionEvent[]
}

// ── Singleton state ─────────────────────────────────────────────────────────
const _session = ref<SessionState>({
  conceptName:    null,
  startedAt:      0,
  endedAt:        null,
  classification: null,
  events:         [],
})

// ── Public API ──────────────────────────────────────────────────────────────

export function useIlluminationSession() {

  function startSession(concept: string | null, classification?: SessionState['classification']): void {
    _session.value = {
      conceptName:    (concept ?? '').trim() || null,
      startedAt:      Date.now(),
      endedAt:        null,
      classification: classification ?? null,
      events:         [],
    }
  }

  function endSession(): void {
    if (_session.value.endedAt === null) {
      _session.value.endedAt = Date.now()
    }
  }

  function recordEvent(ev: Omit<SessionEvent, 'timestamp'> & { timestamp?: number }): void {
    const ts = ev.timestamp ?? (Date.now() - _session.value.startedAt)
    _session.value.events.push({
      ...ev,
      timestamp: ts,
    })
  }

  // Convenience wrappers — one per event kind so call-sites read cleanly.
  function logTabVisited(tab: string): void                                    { recordEvent({ kind: 'tab-visited',          label: `Tab → ${tab}` }) }
  function logGlanceShown(concept: string): void                              { recordEvent({ kind: 'glance-shown',         label: `Glance: ${concept}` }) }
  function logGlanceExpanded(): void                                          { recordEvent({ kind: 'glance-expanded',      label: 'Expanded glance → full Glossary entry' }) }
  function logGlossaryCard(name: string, conceptNumber?: string, twinUrl?: string, detail?: string): void {
    recordEvent({ kind: 'glossary-card-shown', label: name, conceptNumber, twinUrl, detail })
  }
  function logSecondaryChip(name: string, twinUrl?: string): void              { recordEvent({ kind: 'glossary-secondary',    label: name, twinUrl }) }
  function logChapterMention(chapter: string, book: string): void              { recordEvent({ kind: 'chapter-mention',       label: `${chapter} — ${book}` }) }
  function logDiagramRendered(term: string): void                              { recordEvent({ kind: 'diagram-rendered',      label: `📐 ${term} ontology diagram` }) }
  function logDiagramNode(concept: string): void                               { recordEvent({ kind: 'diagram-node-clicked',  label: `📐 drilled → ${concept}` }) }
  function logIllustrationViewed(filename: string, sourceUrl: string, caption?: string): void {
    recordEvent({ kind: 'illustration-viewed', label: caption || filename, sourceUrl })
  }
  function logIllustrationEnlarged(filename: string, sourceUrl: string): void  { recordEvent({ kind: 'illustration-enlarged', label: filename, sourceUrl }) }
  function logUniverseHovered(concept: string, conceptNumber?: string): void   { recordEvent({ kind: 'universe-hovered',      label: concept, conceptNumber }) }
  function logUniverseClicked(concept: string, conceptNumber?: string): void   { recordEvent({ kind: 'universe-clicked',      label: concept, conceptNumber }) }
  function logBookOpened(title: string, sourceUrl?: string): void              { recordEvent({ kind: 'book-opened',           label: title, sourceUrl }) }
  function logTwinSearchFired(query: string): void                             { recordEvent({ kind: 'twin-search-fired',     label: `Twin query: "${query}"` }) }
  function logTwinResult(query: string, conceptCount: number, detail?: string): void {
    recordEvent({ kind: 'twin-result-received', label: `Twin returned ${conceptCount} concepts for "${query}"`, detail })
  }
  function logTwinConceptDrilled(concept: string, conceptNumber: string, twinUrl: string): void {
    recordEvent({ kind: 'twin-concept-drilled', label: `${concept} *${conceptNumber}`, twinUrl, conceptNumber })
  }
  function logClassifierSuggestion(area: string, suggestedTab: string, confidence: number): void {
    recordEvent({ kind: 'classifier-suggested', label: `Lens: ${area} → ${suggestedTab} (${Math.round(confidence * 100)}%)` })
  }
  function logSharpEnough(): void                                              { recordEvent({ kind: 'sharp-enough', label: '✓ Sharp Enough — session complete' }) }

  // Read-only views for UI.
  const events    = computed(() => _session.value.events)
  const concept   = computed(() => _session.value.conceptName)
  const duration  = computed(() => (_session.value.endedAt ?? Date.now()) - _session.value.startedAt)
  const isActive  = computed(() => _session.value.endedAt === null)

  return {
    // lifecycle
    startSession,
    endSession,
    // event loggers
    logTabVisited,
    logGlanceShown,
    logGlanceExpanded,
    logGlossaryCard,
    logSecondaryChip,
    logChapterMention,
    logDiagramRendered,
    logDiagramNode,
    logIllustrationViewed,
    logIllustrationEnlarged,
    logUniverseHovered,
    logUniverseClicked,
    logBookOpened,
    logTwinSearchFired,
    logTwinResult,
    logTwinConceptDrilled,
    logClassifierSuggestion,
    logSharpEnough,
    // reactive views
    session:  _session,
    events,
    concept,
    duration,
    isActive,
  }
}

// ── Email builders ──────────────────────────────────────────────────────────

const PALETTE = {
  amber:   '#fef3c7',
  amberB:  '#fbbf24',
  violet:  '#ede9fe',
  violetB: '#7c3aed',
  emerald: '#d1fae5',
  emeraldB:'#10b981',
  orange:  '#fed7aa',
  orangeB: '#f97316',
  blue:    '#dbeafe',
  blueB:   '#3b82f6',
  rose:    '#fee2e2',
  roseB:   '#ef4444',
  slate:   '#f1f5f9',
  slateB:  '#64748b',
  white:   '#ffffff',
} as const

function eventColour(kind: SessionEventKind): string {
  switch (kind) {
    case 'glance-shown':
    case 'glance-expanded':
    case 'glossary-card-shown':
    case 'glossary-secondary':
    case 'chapter-mention':
      return PALETTE.violetB
    case 'diagram-rendered':
    case 'diagram-node-clicked':
      return PALETTE.blueB
    case 'illustration-viewed':
    case 'illustration-enlarged':
      return PALETTE.orangeB
    case 'universe-hovered':
    case 'universe-clicked':
      return PALETTE.amberB
    case 'book-opened':
      return PALETTE.emeraldB
    case 'twin-search-fired':
    case 'twin-result-received':
    case 'twin-concept-drilled':
      return PALETTE.roseB
    case 'classifier-suggested':
    case 'tab-visited':
    case 'sharp-enough':
    default:
      return PALETTE.slateB
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]!)
}

function formatTimestamp(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Render a colourful HTML email body for a session (or a subset of events).
 * One outer table per r93aaa One-table-for-cohesion (this is an info note,
 * not a multi-entry-type spec).  Each event = one row with timestamp + label +
 * Twin URL when present.
 */
export function renderSessionHtml(opts: {
  conceptName:    string | null
  startedAt:      number
  endedAt:        number | null
  classification: SessionState['classification']
  events:         SessionEvent[]
  recipientName?: string
}): string {
  const conceptDisplay = opts.conceptName ?? '(concept not named)'
  const durationMs = (opts.endedAt ?? Date.now()) - opts.startedAt
  const durationStr = formatTimestamp(durationMs)
  const dateStr = new Date(opts.startedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
  const lensRow = opts.classification?.primaryArea
    ? `<tr><td bgcolor="${PALETTE.amber}" style="background:${PALETTE.amber};padding:8px 14px;border-top:1px solid ${PALETTE.amberB};font-size:13px;color:#1e293b;">
         <strong>Primary lens:</strong> ${escapeHtml(opts.classification.primaryArea)} · <em>suggested starting tab:</em> ${escapeHtml(opts.classification.suggestedTab ?? '?')} · <em>confidence ${Math.round(opts.classification.confidence * 100)}%</em>
       </td></tr>`
    : ''

  const eventRows = opts.events.map((ev, i) => {
    const colour = eventColour(ev.kind)
    const twinLink = ev.twinUrl
      ? `<br><a href="${escapeHtml(ev.twinUrl)}" style="color:${PALETTE.violetB};font-weight:bold;">↗ Tom Gilb Consultant Twin</a>`
      : ''
    const sourceLink = ev.sourceUrl
      ? `<br><a href="${escapeHtml(ev.sourceUrl)}" style="color:${PALETTE.slateB};font-size:11px;">source ↗</a>`
      : ''
    const detail = ev.detail
      ? `<br><span style="color:#475569;font-size:11px;font-style:italic;">${escapeHtml(ev.detail.slice(0, 280))}</span>`
      : ''
    return `<tr><td bgcolor="${PALETTE.white}" style="background:${PALETTE.white};padding:8px 14px;border-top:1px solid ${PALETTE.slate};font-size:13px;color:#0f172a;">
              <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;"><tr>
                <td style="width:50px;font-family:ui-monospace,Menlo,monospace;font-size:11px;color:#64748b;vertical-align:top;">${escapeHtml(formatTimestamp(ev.timestamp))}</td>
                <td style="width:6px;background:${colour};"></td>
                <td style="padding-left:10px;vertical-align:top;">
                  <strong style="color:${colour};">${i + 1}.</strong>
                  ${escapeHtml(ev.label)}${twinLink}${sourceLink}${detail}
                </td>
              </tr></table>
            </td></tr>`
  }).join('\n')

  return `<table cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:680px;margin:0 auto;border-collapse:collapse;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <tr><td bgcolor="${PALETTE.violetB}" style="background:${PALETTE.violetB};padding:18px 22px;color:${PALETTE.white};font-size:22px;font-weight:800;">
      💡 Illumination Session: ${escapeHtml(conceptDisplay)}
    </td></tr>
    <tr><td bgcolor="${PALETTE.violet}" style="background:${PALETTE.violet};padding:10px 22px;font-size:12px;color:#1e293b;">
      <strong>Session started:</strong> ${escapeHtml(dateStr)} · <strong>Duration:</strong> ${escapeHtml(durationStr)} · <strong>Events captured:</strong> ${opts.events.length}${opts.recipientName ? ` · <strong>For:</strong> ${escapeHtml(opts.recipientName)}` : ''}
    </td></tr>
    ${lensRow}
    <tr><td bgcolor="${PALETTE.slate}" style="background:${PALETTE.slate};padding:6px 22px;font-size:11px;color:#475569;font-style:italic;">
      Captured by SEM App's Illumination AI (Phase 5 — Tom Gilb 2026-06-15 design).  Click any ↗ Twin link to drill into the canonical Glossary entry on Tom Gilb Consultant Twin (free, no login).
    </td></tr>
    ${eventRows}
    <tr><td bgcolor="${PALETTE.violet}" style="background:${PALETTE.violet};padding:12px 22px;font-size:11px;color:#475569;font-style:italic;border-top:2px solid ${PALETTE.violetB};">
      🌳 <strong>Open Tom Gilb Consultant Twin</strong> at <a href="https://www.gilb.com/tomtwin" style="color:${PALETTE.violetB};font-weight:bold;">gilb.com/tomtwin</a> for sustained browsing across every Gilb book.  Composing with r93ppp Twin-as-Destination.
    </td></tr>
  </table>`
}

/**
 * Render a plain-text fallback for the session — same content, no HTML.
 * Used as the `text/plain` clipboard fallback when the recipient client
 * cannot render HTML, and as the `.eml` plain body when relevant.
 */
export function renderSessionPlain(opts: Parameters<typeof renderSessionHtml>[0]): string {
  const conceptDisplay = opts.conceptName ?? '(concept not named)'
  const durationMs = (opts.endedAt ?? Date.now()) - opts.startedAt
  const durationStr = formatTimestamp(durationMs)
  const dateStr = new Date(opts.startedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
  const lines: string[] = []
  lines.push(`💡 Illumination Session: ${conceptDisplay}`)
  lines.push(`Started: ${dateStr} · Duration: ${durationStr} · Events: ${opts.events.length}`)
  if (opts.classification?.primaryArea) {
    lines.push(`Primary lens: ${opts.classification.primaryArea} → suggested ${opts.classification.suggestedTab} (${Math.round(opts.classification.confidence * 100)}%)`)
  }
  lines.push('─'.repeat(56))
  for (let i = 0; i < opts.events.length; i++) {
    const ev = opts.events[i]
    lines.push(`${i + 1}. [${formatTimestamp(ev.timestamp)}] ${ev.label}`)
    if (ev.twinUrl)   lines.push(`   ↗ Twin: ${ev.twinUrl}`)
    if (ev.sourceUrl) lines.push(`   source: ${ev.sourceUrl}`)
    if (ev.detail)    lines.push(`   ${ev.detail.slice(0, 200)}`)
  }
  lines.push('─'.repeat(56))
  lines.push('Tom Gilb Consultant Twin: https://www.gilb.com/tomtwin')
  return lines.join('\n')
}
