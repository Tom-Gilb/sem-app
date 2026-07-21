/**
 * useValueFlowLayout — shared Planguage visualisation layout engine.
 *
 * v485 (2026-07-20) — extracted from ModelLibraryPanel.vue.  Tom Gilb 2026-07-20
 * verbatim "extract" after design brief asking for reusable Value Flow across
 * the whole app.  Complements the richer `ValueFlowDiagram.vue` (which handles
 * full 6-column Spec flows with ImpactMatrix) by providing a lighter 3-column
 * / grid layout suitable for ANY Planguage-shaped data: Model Library entries,
 * Spec crumb summaries, contract-agent extractions, etc.
 *
 * Design goals:
 *   • Pure functions — no Vue/DOM dependencies here.  Composable ports verbatim
 *     to Kai's Twin (Twin Portability Portfolio candidate Pattern #18).
 *   • Data-shape agnostic — accepts a normalised `VizModel` interface.  Callers
 *     provide their own adapter (ModelLibraryEntry → VizModel, Spec → VizModel,
 *     etc.).  Both existing ModelLibraryPanel visualisations use the same
 *     shape without conversion (ModelLibraryEntry is already `VizModel`-compatible).
 *   • Mode-parameterised — the same input renders as sankey-focus (3-column
 *     Stakeholders → Functions → Values + Constraints row) OR strongly-related
 *     (4-row grid with feedback arrows).  Future modes (isometric-city,
 *     sunburst, presenter-deck) plug in as new layout functions.
 *
 * See TWIN-PORTABILITY-PORTFOLIO.md Pattern #18 (proposed).
 */

// ── Public types ────────────────────────────────────────────────────────────

/** Normalised Planguage entry shape.  Callers convert their domain type to this. */
export interface VizEntry {
  type:        'F' | 'V' | 'C' | 'R' | 'S'
  description: string
  details?:    string
}

/** Normalised model shape the layout engine operates on. */
export interface VizModel {
  title:        string
  stakeholders: string[]
  entries:      VizEntry[]
}

/** One positioned node in a computed layout. */
export interface VizNode {
  id:    string
  label: string
  type:  VizEntry['type'] | 'stakeholder'
  x:     number
  y:     number
  w:     number
  h:     number
}

/** One arrow connecting two nodes in a computed layout. */
export interface VizArrow {
  fromId:      string
  toId:        string
  color:       string
  strokeWidth: number
  dashed:      boolean
  bidir:       boolean
}

/** Result of a layout computation. */
export interface VizLayout {
  nodes:  VizNode[]
  arrows: VizArrow[]
}

/** Supported layout modes.  Add new entries here as new modes ship. */
export type VizMode =
  | 'sankey-focus'
  | 'strongly-related'
  | 'isometric-city'
  | 'sunburst'
  | 'constellation'
  | 'focus-context'      // v490 — sankey layout + fade-unrelated on click
  | 'layered-accordion'  // v490 — 5 horizontal stripes
  | 'focus-ring'         // v490 — chosen node at centre + concentric neighbours
  | 'time-ribbon'        // v490 — horizontal timeline (Qualifier-aware when populated)

// ── Common-prefix stripping ─────────────────────────────────────────────────

/**
 * Strip the longest COMMON PREFIX across a list of labels, snapped to a word/
 * separator boundary.  Guards against over-stripping: only strips if the
 * prefix saves ≥ MIN_PREFIX_LEN chars AND every result stays ≥ MIN_RESULT_LEN.
 *
 * Motivation (v483.2): AI-extracted labels often share boilerplate lead-in
 * (e.g. six "Competitive Engineering — …" Functions from a single book paste).
 * The bar's short SVG label needs to show the DISTINGUISHING suffix.  The
 * caller keeps the full un-stripped description in the underlying entry for
 * drill-down display.
 */
export function stripCommonPrefix(labels: string[]): string[] {
  const MIN_PREFIX_LEN = 8
  const MIN_RESULT_LEN = 3
  if (labels.length < 2) return labels
  let prefix = labels[0]
  for (const s of labels.slice(1)) {
    let i = 0
    while (i < prefix.length && i < s.length && prefix[i] === s[i]) i++
    prefix = prefix.slice(0, i)
  }
  // Walk back to the last word/separator boundary so we don't split a word.
  const trimmed = prefix.replace(/[\s\-—:·|]*[^\s\-—:·|]*$/, '')
  if (trimmed.length < MIN_PREFIX_LEN) return labels
  const stripped = labels.map(l =>
    l.slice(trimmed.length).replace(/^[\s\-—:·|]+/, '').trim()
  )
  if (stripped.some(s => s.length < MIN_RESULT_LEN)) return labels
  return stripped
}

// ── Layout: sankey-focus (was computeValueFlowLayout) ───────────────────────

/**
 * 3-column Sankey-style layout: Stakeholders (left) → Functions (centre) →
 * Values (right), with Constraints + Resources as a bottom row under
 * Functions.  Arrows: Stakeholder→Function (dashed grey), Function→Value
 * (solid blue thick), Function→Constraint/Resource (dashed orange thin).
 */
export function computeSankeyFocusLayout(model: VizModel): VizLayout {
  const nodes:  VizNode[]  = []
  const arrows: VizArrow[] = []
  const PX = { stakeholderX: 20, fnX: 230, valX: 510 }
  const NODE_W = 160, NODE_H = 36, GAP = 12

  // Stakeholders — left column (cap 6)
  const stks = model.stakeholders.slice(0, 6)
  stks.forEach((s, i) => {
    nodes.push({
      id: `stk-${i}`, label: s, type: 'stakeholder',
      x: PX.stakeholderX, y: 50 + i * (NODE_H + GAP), w: NODE_W, h: NODE_H,
    })
  })

  // Functions — centre column (cap 7, strip common prefix)
  const fns      = model.entries.filter(e => e.type === 'F').slice(0, 7)
  const fnLabels = stripCommonPrefix(fns.map(e => e.description))
  fns.forEach((_, i) => {
    nodes.push({
      id: `fn-${i}`, label: fnLabels[i], type: 'F',
      x: PX.fnX, y: 50 + i * (NODE_H + GAP), w: NODE_W, h: NODE_H,
    })
  })

  // Values — right column (cap 7, strip common prefix)
  const vals      = model.entries.filter(e => e.type === 'V').slice(0, 7)
  const valLabels = stripCommonPrefix(vals.map(e => e.description))
  vals.forEach((_, i) => {
    nodes.push({
      id: `val-${i}`, label: valLabels[i], type: 'V',
      x: PX.valX, y: 50 + i * (NODE_H + GAP), w: NODE_W, h: NODE_H,
    })
  })

  // Constraints + Resources — bottom row under Functions (cap 4, strip prefix)
  const constrs  = model.entries.filter(e => e.type === 'C' || e.type === 'R').slice(0, 4)
  const crLabels = stripCommonPrefix(constrs.map(e => e.description))
  const fnBottom = 50 + Math.max(fns.length, 1) * (NODE_H + GAP) + 20
  constrs.forEach((e, i) => {
    nodes.push({
      id: `cr-${i}`, label: crLabels[i], type: e.type,
      x: PX.fnX + i * (NODE_W + 10), y: fnBottom, w: NODE_W, h: NODE_H,
    })
  })

  // Arrows: Stakeholder → Function (dashed grey, top-2 fns per stakeholder)
  for (let si = 0; si < stks.length; si++) {
    for (let fi = 0; fi < Math.min(fns.length, 2); fi++) {
      arrows.push({ fromId: `stk-${si}`, toId: `fn-${fi}`, color: '#94a3b8', strokeWidth: 1.5, dashed: true,  bidir: false })
    }
  }
  // Function → Value (solid blue, one-to-one by index)
  for (let fi = 0; fi < fns.length; fi++) {
    const vi = Math.min(fi, vals.length - 1)
    if (vi >= 0) {
      arrows.push({ fromId: `fn-${fi}`, toId: `val-${vi}`, color: '#2563eb', strokeWidth: 2.5, dashed: false, bidir: false })
    }
  }
  // Function → Constraint/Resource (dashed orange, all-to-all)
  for (let fi = 0; fi < fns.length; fi++) {
    for (let ci = 0; ci < constrs.length; ci++) {
      arrows.push({ fromId: `fn-${fi}`, toId: `cr-${ci}`, color: '#f97316', strokeWidth: 1, dashed: true, bidir: false })
    }
  }

  return { nodes, arrows }
}

// ── Layout: strongly-related (was computeStronglyRelatedLayout) ─────────────

/**
 * 4-row grid layout with bidirectional feedback: Stakeholders (top),
 * Functions (upper-middle), Values (lower-middle), Constraints+Resources
 * (bottom).  Arrows: Stakeholder↔Function (medium blue), Function→Value
 * (thick blue), Value↔Function feedback (thin dashed blue), Function→Constraint
 * (thin orange).
 */
export function computeStronglyRelatedLayout(model: VizModel): VizLayout {
  const nodes:  VizNode[]  = []
  const arrows: VizArrow[] = []
  const NODE_W = 130, NODE_H = 32

  const rows = {
    stakeholders: model.stakeholders.slice(0, 5),
    functions:    model.entries.filter(e => e.type === 'F').slice(0, 5),
    values:       model.entries.filter(e => e.type === 'V').slice(0, 5),
    constrs:      model.entries.filter(e => e.type === 'C' || e.type === 'R').slice(0, 5),
  }

  function rowX(count: number, i: number, totalW = 800): number {
    const spacing = totalW / (count + 1)
    return spacing * (i + 1) - NODE_W / 2
  }

  const fnLabels  = stripCommonPrefix(rows.functions.map(e => e.description))
  const valLabels = stripCommonPrefix(rows.values.map(e => e.description))
  const crLabels  = stripCommonPrefix(rows.constrs.map(e => e.description))

  rows.stakeholders.forEach((s, i) => nodes.push({ id: `stk-${i}`, label: s,           type: 'stakeholder', x: rowX(rows.stakeholders.length, i), y: 20,  w: NODE_W, h: NODE_H }))
  rows.functions.forEach((e, i)    => nodes.push({ id: `fn-${i}`,  label: fnLabels[i], type: 'F',           x: rowX(rows.functions.length, i),    y: 120, w: NODE_W, h: NODE_H }))
  rows.values.forEach((e, i)       => nodes.push({ id: `val-${i}`, label: valLabels[i],type: 'V',           x: rowX(rows.values.length, i),       y: 220, w: NODE_W, h: NODE_H }))
  rows.constrs.forEach((e, i)      => nodes.push({ id: `cr-${i}`,  label: crLabels[i], type: e.type,        x: rowX(rows.constrs.length, i),      y: 320, w: NODE_W, h: NODE_H }))

  const stk = rows.stakeholders, fns = rows.functions, vals = rows.values, crs = rows.constrs

  // Stakeholder ↔ Function (medium blue, bidir)
  for (let si = 0; si < stk.length; si++) {
    const fi = si % Math.max(fns.length, 1)
    if (fi < fns.length) arrows.push({ fromId: `stk-${si}`, toId: `fn-${fi}`, color: '#2563eb', strokeWidth: 2, dashed: false, bidir: true })
  }
  // Function → Value (thick blue)
  for (let fi = 0; fi < fns.length; fi++) {
    const vi = Math.min(fi, vals.length - 1)
    if (vi >= 0) arrows.push({ fromId: `fn-${fi}`, toId: `val-${vi}`, color: '#2563eb', strokeWidth: 3.5, dashed: false, bidir: false })
  }
  // Value ↔ Function feedback (thin dashed blue, bidir)
  for (let vi = 0; vi < vals.length; vi++) {
    const fi = vi % Math.max(fns.length, 1)
    if (fi < fns.length) arrows.push({ fromId: `val-${vi}`, toId: `fn-${fi}`, color: '#3b82f6', strokeWidth: 1, dashed: true, bidir: true })
  }
  // Function → Constraint (thin orange)
  for (let fi = 0; fi < fns.length; fi++) {
    for (let ci = 0; ci < crs.length; ci++) {
      arrows.push({ fromId: `fn-${fi}`, toId: `cr-${ci}`, color: '#f97316', strokeWidth: 1.2, dashed: false, bidir: false })
    }
  }

  return { nodes, arrows }
}

// ── Mode dispatcher ─────────────────────────────────────────────────────────

/** Compute layout for the given model + mode.  Extensible: add new modes here. */
export function computeLayout(model: VizModel, mode: VizMode): VizLayout {
  switch (mode) {
    case 'sankey-focus':     return computeSankeyFocusLayout(model)
    case 'strongly-related': return computeStronglyRelatedLayout(model)
    // v486 — isometric-city reuses the sankey-focus positional data; the CSS
    // 3D transform is applied in the component wrapper (not in geometry) so
    // click-through + drill-down keep working through the transform.
    case 'isometric-city':   return computeSankeyFocusLayout(model)
    case 'sunburst':         return computeSunburstLayout(model)         // v489
    case 'constellation':    return computeConstellationLayout(model)    // v489
    // v490 — focus-context reuses sankey-focus geometry; the "fade unrelated"
    // behaviour is a rendering concern applied in the component (not layout).
    case 'focus-context':    return computeSankeyFocusLayout(model)
    case 'layered-accordion':return computeLayeredAccordionLayout(model) // v490
    case 'focus-ring':       return computeFocusRingLayout(model)        // v490
    case 'time-ribbon':      return computeTimeRibbonLayout(model)       // v490
  }
}

// ── Layout: layered-accordion (v490) — 5 horizontal stripes ────────────────
// Tom Gilb 2026-07-21 design brief pick ⑤.  Five type-bands stacked
// vertically; entries within a band spaced left-to-right.  Each band gets a
// full-width stripe on the 900-wide canvas.  Bands sized proportionally so
// dense types (many entries) don't crowd; entries within a band cap at 8.
export function computeLayeredAccordionLayout(model: VizModel): VizLayout {
  const nodes:  VizNode[]  = []
  const arrows: VizArrow[] = []
  const NODE_W = 140, NODE_H = 32
  const BAND_HEIGHT = 90, BAND_GAP = 20, LEFT_MARGIN = 40, BAND_TOP_PAD = 40

  const stks = model.stakeholders.slice(0, 8)
  const fns  = model.entries.filter(e => e.type === 'F').slice(0, 8)
  const vals = model.entries.filter(e => e.type === 'V').slice(0, 8)
  const cons = model.entries.filter(e => e.type === 'C').slice(0, 8)
  const res  = model.entries.filter(e => e.type === 'R').slice(0, 8)

  const fnLabels  = stripCommonPrefix(fns.map(e => e.description))
  const valLabels = stripCommonPrefix(vals.map(e => e.description))
  const conLabels = stripCommonPrefix(cons.map(e => e.description))
  const resLabels = stripCommonPrefix(res.map(e => e.description))

  const bands: Array<{ y: number; items: Array<{ id: string; label: string; type: VizNode['type'] }> }> = [
    { y: BAND_TOP_PAD + 0 * (BAND_HEIGHT + BAND_GAP), items: stks.map((s, i) => ({ id: `stk-${i}`, label: s,           type: 'stakeholder' as const })) },
    { y: BAND_TOP_PAD + 1 * (BAND_HEIGHT + BAND_GAP), items: fns.map ((_, i) => ({ id: `fn-${i}`,  label: fnLabels[i],  type: 'F' as const })) },
    { y: BAND_TOP_PAD + 2 * (BAND_HEIGHT + BAND_GAP), items: vals.map((_, i) => ({ id: `val-${i}`, label: valLabels[i], type: 'V' as const })) },
    { y: BAND_TOP_PAD + 3 * (BAND_HEIGHT + BAND_GAP), items: cons.map((_, i) => ({ id: `cr-${i}`,  label: conLabels[i], type: 'C' as const })) },
    { y: BAND_TOP_PAD + 4 * (BAND_HEIGHT + BAND_GAP), items: res.map ((_, i) => ({ id: `cr-${cons.length + i}`, label: resLabels[i], type: 'R' as const })) },
  ]

  for (const band of bands) {
    const startX = LEFT_MARGIN + 120  // leave room for the type label on the left
    const availableW = 900 - startX - 20
    const spacing = band.items.length > 0 ? Math.min(NODE_W + 10, availableW / Math.max(band.items.length, 1)) : 0
    band.items.forEach((it, i) => {
      nodes.push({
        id: it.id, label: it.label, type: it.type,
        x: startX + i * spacing,
        y: band.y + (BAND_HEIGHT - NODE_H) / 2,
        w: NODE_W, h: NODE_H,
      })
    })
  }
  return { nodes, arrows }
}

// ── Layout: focus-ring (v490) — chosen focus at centre + concentric neighbours
// Tom Gilb 2026-07-21 design brief pick ⑥.  MVP default focus = first Function
// (or first Value if no Functions).  Focus node at (450, 450) large; ring 1 =
// direct neighbours of the focus (in the sankey Function↔Value mapping);
// ring 2 = second-degree; ring 3 = context (constraints/resources).
export function computeFocusRingLayout(model: VizModel): VizLayout {
  const nodes:  VizNode[]  = []
  const arrows: VizArrow[] = []
  const CX = 450, CY = 450
  const NODE_W = 130, NODE_H = 30

  const fns  = model.entries.filter(e => e.type === 'F').slice(0, 8)
  const vals = model.entries.filter(e => e.type === 'V').slice(0, 8)
  const crs  = model.entries.filter(e => e.type === 'C' || e.type === 'R').slice(0, 6)
  const stks = model.stakeholders.slice(0, 6)

  const fnLabels  = stripCommonPrefix(fns.map(e => e.description))
  const valLabels = stripCommonPrefix(vals.map(e => e.description))
  const crLabels  = stripCommonPrefix(crs.map(e => e.description))

  // Focus = first Function (large centre).  If no F, fall back to first V.
  const focusIsF = fns.length > 0
  const focusLabel = focusIsF ? (fnLabels[0] ?? 'Focus') : (valLabels[0] ?? 'Focus')
  const focusType: VizNode['type'] = focusIsF ? 'F' : 'V'
  const FOCUS_W = 200, FOCUS_H = 46
  nodes.push({
    id: focusIsF ? 'fn-0' : 'val-0',
    label: focusLabel, type: focusType,
    x: CX - FOCUS_W / 2, y: CY - FOCUS_H / 2, w: FOCUS_W, h: FOCUS_H,
  })

  function placeRing(items: number, r: number, mkId: (i: number) => string, mkLabel: (i: number) => string, type: VizNode['type']) {
    for (let i = 0; i < items; i++) {
      const theta = -Math.PI / 2 + (2 * Math.PI * i) / Math.max(items, 1)
      const cx = CX + r * Math.cos(theta)
      const cy = CY + r * Math.sin(theta)
      nodes.push({ id: mkId(i), label: mkLabel(i), type, x: cx - NODE_W / 2, y: cy - NODE_H / 2, w: NODE_W, h: NODE_H })
    }
  }

  // Ring 1 (r=170): Values (direct neighbours of the focus Function).  If focus is V, this ring is Functions.
  if (focusIsF) {
    placeRing(vals.length, 170, i => `val-${i}`, i => valLabels[i], 'V')
  } else {
    placeRing(fns.length, 170, i => `fn-${i}`, i => fnLabels[i], 'F')
  }

  // Ring 2 (r=300): Stakeholders (second-degree — reach the focus via Functions)
  placeRing(stks.length, 300, i => `stk-${i}`, i => stks[i], 'stakeholder')

  // Ring 3 (r=420): Constraints + Resources (context — the bounds)
  crs.forEach((e, i) => {
    const theta = -Math.PI / 2 + (2 * Math.PI * i) / Math.max(crs.length, 1)
    const cx = CX + 420 * Math.cos(theta)
    const cy = CY + 420 * Math.sin(theta)
    nodes.push({ id: `cr-${i}`, label: crLabels[i], type: e.type, x: cx - NODE_W / 2, y: cy - NODE_H / 2, w: NODE_W, h: NODE_H })
  })

  // Spokes from focus to ring-1
  const ring1Ids = focusIsF ? vals.map((_, i) => `val-${i}`) : fns.map((_, i) => `fn-${i}`)
  const focusId = focusIsF ? 'fn-0' : 'val-0'
  for (const rid of ring1Ids) {
    if (rid === focusId) continue
    arrows.push({ fromId: focusId, toId: rid, color: '#2563eb', strokeWidth: 1.5, dashed: false, bidir: false })
  }

  return { nodes, arrows }
}

// ── Layout: time-ribbon (v490) — horizontal timeline lanes ──────────────────
// Tom Gilb 2026-07-21 design brief pick ⑧.  Five lanes stacked top-down;
// entries within a lane arranged left-to-right by INDEX (MVP: no real time
// data yet — r93jjj Qualifiers Phase 2 will populate real time positions).
// When Qualifier data is populated (Phase 2 of r93jjj), swap the x-position
// derivation for `qualifier.when → date → normalized x` — the rest of the
// layout stays the same.  Lane order: Stakeholders / Functions / Values /
// Constraints / Resources (top to bottom, matching Accordion mode).
export function computeTimeRibbonLayout(model: VizModel): VizLayout {
  const nodes:  VizNode[]  = []
  const arrows: VizArrow[] = []
  const NODE_W = 110, NODE_H = 26
  const LANE_H = 80, LANE_GAP = 12, LEFT_MARGIN = 130, TOP_PAD = 50

  const stks = model.stakeholders.slice(0, 10)
  const fns  = model.entries.filter(e => e.type === 'F').slice(0, 10)
  const vals = model.entries.filter(e => e.type === 'V').slice(0, 10)
  const cons = model.entries.filter(e => e.type === 'C').slice(0, 10)
  const res  = model.entries.filter(e => e.type === 'R').slice(0, 10)

  const fnLabels  = stripCommonPrefix(fns.map(e => e.description))
  const valLabels = stripCommonPrefix(vals.map(e => e.description))
  const conLabels = stripCommonPrefix(cons.map(e => e.description))
  const resLabels = stripCommonPrefix(res.map(e => e.description))

  const lanes: Array<{ y: number; items: Array<{ id: string; label: string; type: VizNode['type'] }> }> = [
    { y: TOP_PAD + 0 * (LANE_H + LANE_GAP), items: stks.map((s, i) => ({ id: `stk-${i}`, label: s,           type: 'stakeholder' as const })) },
    { y: TOP_PAD + 1 * (LANE_H + LANE_GAP), items: fns.map ((_, i) => ({ id: `fn-${i}`,  label: fnLabels[i],  type: 'F' as const })) },
    { y: TOP_PAD + 2 * (LANE_H + LANE_GAP), items: vals.map((_, i) => ({ id: `val-${i}`, label: valLabels[i], type: 'V' as const })) },
    { y: TOP_PAD + 3 * (LANE_H + LANE_GAP), items: cons.map((_, i) => ({ id: `cr-${i}`,  label: conLabels[i], type: 'C' as const })) },
    { y: TOP_PAD + 4 * (LANE_H + LANE_GAP), items: res.map ((_, i) => ({ id: `cr-${cons.length + i}`, label: resLabels[i], type: 'R' as const })) },
  ]

  const timelineStart = LEFT_MARGIN + 20
  const timelineEnd = 900 - 40
  const timelineW = timelineEnd - timelineStart
  for (const lane of lanes) {
    const step = lane.items.length > 1 ? timelineW / (lane.items.length + 1) : timelineW / 2
    lane.items.forEach((it, i) => {
      const cx = timelineStart + (i + 1) * step
      nodes.push({
        id: it.id, label: it.label, type: it.type,
        x: cx - NODE_W / 2,
        y: lane.y + (LANE_H - NODE_H) / 2,
        w: NODE_W, h: NODE_H,
      })
    })
  }
  return { nodes, arrows }
}

// ── Layout: sunburst (v489) — concentric rings ─────────────────────────────
// Tom Gilb 2026-07-20 design brief pick ②.  Model at centre; four rings
// (Stakeholders / Functions / Values / Constraints+Resources).  Each entry
// = a positioned NODE with a radial-arc "sector" mapped to cartesian x,y.
// The component renders these as <circle> nodes (not rects); the layout
// engine just supplies the positions.
//
// Coordinate system: 900×900 viewBox, centre at (450, 450).  Ring radii
// hand-tuned so labels have breathing room.  Ring assignment (inner→outer):
//   Ring 1 (r=90):  Stakeholders (the WHO — closest to centre)
//   Ring 2 (r=190): Values (the ENDS — Tom's most important)
//   Ring 3 (r=290): Functions (the MEANS)
//   Ring 4 (r=390): Constraints + Resources (the BOUNDS — outermost)
export function computeSunburstLayout(model: VizModel): VizLayout {
  const nodes:  VizNode[]  = []
  const arrows: VizArrow[] = []
  const CX = 450, CY = 450
  const NODE_W = 130, NODE_H = 28
  const RINGS: Record<string, number> = { stk: 90, val: 190, fn: 290, cr: 390 }

  const stks = model.stakeholders.slice(0, 8)
  const fns  = model.entries.filter(e => e.type === 'F').slice(0, 8)
  const vals = model.entries.filter(e => e.type === 'V').slice(0, 8)
  const crs  = model.entries.filter(e => e.type === 'C' || e.type === 'R').slice(0, 8)

  const fnLabels  = stripCommonPrefix(fns.map(e => e.description))
  const valLabels = stripCommonPrefix(vals.map(e => e.description))
  const crLabels  = stripCommonPrefix(crs.map(e => e.description))

  function placeRing(items: number, r: number, mkId: (i: number) => string, mkLabel: (i: number) => string, type: VizNode['type']) {
    for (let i = 0; i < items; i++) {
      const theta = -Math.PI / 2 + (2 * Math.PI * i) / Math.max(items, 1)  // start at top, go clockwise
      const cx = CX + r * Math.cos(theta)
      const cy = CY + r * Math.sin(theta)
      nodes.push({
        id: mkId(i), label: mkLabel(i), type,
        x: cx - NODE_W / 2, y: cy - NODE_H / 2, w: NODE_W, h: NODE_H,
      })
    }
  }

  placeRing(stks.length, RINGS.stk, i => `stk-${i}`, i => stks[i], 'stakeholder')
  placeRing(fns.length,  RINGS.fn,  i => `fn-${i}`,  i => fnLabels[i], 'F')
  placeRing(vals.length, RINGS.val, i => `val-${i}`, i => valLabels[i], 'V')
  crs.forEach((e, i) => {
    const theta = -Math.PI / 2 + (2 * Math.PI * i) / Math.max(crs.length, 1)
    const cx = CX + RINGS.cr * Math.cos(theta)
    const cy = CY + RINGS.cr * Math.sin(theta)
    nodes.push({ id: `cr-${i}`, label: crLabels[i], type: e.type, x: cx - NODE_W / 2, y: cy - NODE_H / 2, w: NODE_W, h: NODE_H })
  })

  // Spokes: connect Values → Functions (blue), Functions → Stakeholders (grey)
  for (let vi = 0; vi < vals.length; vi++) {
    const fi = vi % Math.max(fns.length, 1)
    if (fi < fns.length) arrows.push({ fromId: `val-${vi}`, toId: `fn-${fi}`, color: '#2563eb', strokeWidth: 1.5, dashed: false, bidir: false })
  }
  for (let fi = 0; fi < fns.length; fi++) {
    const si = fi % Math.max(stks.length, 1)
    if (si < stks.length) arrows.push({ fromId: `fn-${fi}`, toId: `stk-${si}`, color: '#94a3b8', strokeWidth: 1, dashed: true, bidir: false })
  }

  return { nodes, arrows }
}

// ── Layout: constellation (v489) — 5 clusters + orbital connectors ─────────
// Tom Gilb 2026-07-20 design brief pick ④.  Each type is a cluster zone in
// a 900×600 viewBox; entries within a cluster scatter in a small area with
// star-like glow (component adds SVG glow filter).  Arrows are subtle "orbital"
// lines between related entries — much thinner than sankey to preserve the
// starmap feel.
export function computeConstellationLayout(model: VizModel): VizLayout {
  const nodes:  VizNode[]  = []
  const arrows: VizArrow[] = []
  const NODE_W = 110, NODE_H = 26
  // Cluster centres (x, y, radius) — chosen so a wide constellation fits 900×600.
  const CLUSTERS = {
    stakeholder: { cx: 180, cy: 130, r: 90 },
    V:           { cx: 720, cy: 130, r: 90 },  // Values top-right (Tom's ends)
    F:           { cx: 450, cy: 340, r: 110 }, // Functions centre (the means)
    C:           { cx: 180, cy: 490, r: 70 },  // Constraints bottom-left
    R:           { cx: 720, cy: 490, r: 70 },  // Resources bottom-right
  }

  const stks = model.stakeholders.slice(0, 8)
  const fns  = model.entries.filter(e => e.type === 'F').slice(0, 8)
  const vals = model.entries.filter(e => e.type === 'V').slice(0, 8)
  const cons = model.entries.filter(e => e.type === 'C').slice(0, 6)
  const res  = model.entries.filter(e => e.type === 'R').slice(0, 6)

  const fnLabels  = stripCommonPrefix(fns.map(e => e.description))
  const valLabels = stripCommonPrefix(vals.map(e => e.description))
  const conLabels = stripCommonPrefix(cons.map(e => e.description))
  const resLabels = stripCommonPrefix(res.map(e => e.description))

  function scatterCluster<T>(
    items: T[], cluster: { cx: number; cy: number; r: number },
    mkId: (i: number) => string, mkLabel: (i: number, t: T) => string, type: VizNode['type'],
  ) {
    for (let i = 0; i < items.length; i++) {
      const theta = (2 * Math.PI * i) / Math.max(items.length, 1)
      // Alternate near/far so entries don't all sit on the perimeter.
      const r = cluster.r * (i % 2 === 0 ? 0.5 : 0.9)
      const cx = cluster.cx + r * Math.cos(theta)
      const cy = cluster.cy + r * Math.sin(theta)
      nodes.push({
        id: mkId(i), label: mkLabel(i, items[i]), type,
        x: cx - NODE_W / 2, y: cy - NODE_H / 2, w: NODE_W, h: NODE_H,
      })
    }
  }

  scatterCluster(stks, CLUSTERS.stakeholder, i => `stk-${i}`, (_, s) => s, 'stakeholder')
  scatterCluster(fns,  CLUSTERS.F,           i => `fn-${i}`,  i => fnLabels[i], 'F')
  scatterCluster(vals, CLUSTERS.V,           i => `val-${i}`, i => valLabels[i], 'V')
  scatterCluster(cons, CLUSTERS.C,           i => `cr-${i}`,  i => conLabels[i], 'C')
  // Resources use cr-{offset} ids so drill-down helper's C+R filter finds them.
  const rOffset = cons.length
  for (let i = 0; i < res.length; i++) {
    const theta = (2 * Math.PI * i) / Math.max(res.length, 1)
    const r = CLUSTERS.R.r * (i % 2 === 0 ? 0.5 : 0.9)
    const cx = CLUSTERS.R.cx + r * Math.cos(theta)
    const cy = CLUSTERS.R.cy + r * Math.sin(theta)
    nodes.push({ id: `cr-${rOffset + i}`, label: resLabels[i], type: 'R', x: cx - NODE_W / 2, y: cy - NODE_H / 2, w: NODE_W, h: NODE_H })
  }

  // Orbital connections (thin, subtle)
  for (let vi = 0; vi < vals.length; vi++) {
    const fi = vi % Math.max(fns.length, 1)
    if (fi < fns.length) arrows.push({ fromId: `val-${vi}`, toId: `fn-${fi}`, color: '#2563eb', strokeWidth: 1, dashed: false, bidir: false })
  }
  for (let si = 0; si < stks.length; si++) {
    const fi = si % Math.max(fns.length, 1)
    if (fi < fns.length) arrows.push({ fromId: `stk-${si}`, toId: `fn-${fi}`, color: '#64748b', strokeWidth: 0.8, dashed: true, bidir: false })
  }
  for (let ci = 0; ci < cons.length; ci++) {
    const fi = ci % Math.max(fns.length, 1)
    if (fi < fns.length) arrows.push({ fromId: `cr-${ci}`, toId: `fn-${fi}`, color: '#f97316', strokeWidth: 0.8, dashed: true, bidir: false })
  }
  return { nodes, arrows }
}

/**
 * Per-type "building height" for the isometric-city mode.  Higher values →
 * heavier drop-shadow + taller feel.  Chosen so Stakeholders feel like TOWERS
 * (tallest), Functions like WAREHOUSES (medium), Values like BEACONS
 * (glowing, medium-tall), Constraints like WALLS (short + wide), Resources
 * like DEPOTS (short + broad).
 */
export const ISOMETRIC_BUILDING_HEIGHT: Record<VizNode['type'], number> = {
  stakeholder: 14,   // towers
  F: 8,              // warehouses
  V: 12,             // beacons (glowing)
  C: 5,              // walls
  R: 6,              // depots
  S: 10,             // civic (rare in current models)
} as const

// ── Drill-down helper ───────────────────────────────────────────────────────

/** Result of drilling into a node — canonical full label + best-effort details. */
export interface VizDrillDown {
  label:   string
  type:    VizNode['type']
  details: string
}

/** Given a node id + the model, produce the drill-down card content.  Uses
 *  the underlying `entry.description` (NOT the stripped `node.label`) so the
 *  drill-down always shows canonical un-stripped Planguage text. */
export function computeDrillDown(model: VizModel, node: VizNode): VizDrillDown {
  if (node.id.startsWith('stk-')) {
    return {
      label:   node.label,
      type:    'stakeholder',
      details: `Stakeholder in the "${model.title}" model.  Full role and responsibilities live in the source document that produced this model.`,
    }
  }
  const parts = node.id.split('-')
  const kind  = parts[0]  // 'fn' | 'val' | 'cr'
  const idx   = parseInt(parts[1] ?? '', 10)
  const typeFilter: VizEntry['type'][] =
    kind === 'fn'  ? ['F']
    : kind === 'val' ? ['V']
    : kind === 'cr'  ? ['C', 'R']
    : []
  const matched = model.entries.filter(e => typeFilter.includes(e.type))[idx]
  return {
    label:   matched?.description ?? node.label,
    type:    node.type,
    details: matched?.details
      ?? '(No additional detail captured for this entry — re-run Analyse or edit the model to add depth.)',
  }
}

// ── Canonical Planguage colours (for renderers) ─────────────────────────────

/** Node fill colour by type.  Callers can use these OR override per-context. */
export const PLANGUAGE_FILL = {
  stakeholder: '#e2e8f0',
  F: '#fed7aa',
  V: '#bfdbfe',
  C: '#fdf4ff',
  R: '#f0f9ff',
  S: '#f0fdf4',
} as const

/** Node stroke colour by type (matches PLANGUAGE_FILL). */
export const PLANGUAGE_STROKE = {
  stakeholder: '#94a3b8',
  F: '#f97316',
  V: '#3b82f6',
  C: '#c026d3',
  R: '#0284c7',
  S: '#16a34a',
} as const

/** Type-badge background colour by type. */
export const PLANGUAGE_BADGE = {
  F: '#f97316',
  V: '#3b82f6',
  C: '#d946ef',
  R: '#0ea5e9',
  S: '#22c55e',
} as const

/** Human-readable spelled-out type label (per Spell-out-Type-Names SUPREME). */
export const PLANGUAGE_TYPE_LABEL = {
  stakeholder: 'Stakeholder',
  F: 'Function',
  V: 'Value',
  C: 'Constraint',
  R: 'Resource',
  S: 'Solution',
} as const

// ── Server-side SVG rendering (for email/HTML export) ──────────────────────

/**
 * v488 (2026-07-20) — Tom Gilb "the email of rotatable model did not contain
 * right model, it had the Planguage model".  Root cause: email export was
 * mode-blind — always shipped the Planguage entry table regardless of which
 * visualisation Tom was viewing.  Fix: render the actual diagram SVG for the
 * current mode + embed it in the export HTML above the entry table.  Email
 * clients render inline SVG (Mail.app + Gmail + Outlook all support it since
 * ~2018).  CSS 3D transforms are stripped by email clients — that's fine for
 * isometric-city; recipients see the flat 2D layout, which is the honest
 * representation (the rotatable feel only exists in the live app).
 *
 * Pure function: takes the model + mode, produces SVG source string with
 * inline styles.  No DOM APIs, no Vue reactivity.  Ports verbatim.
 */
function _escXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function _truncLabel(s: string, max = 28): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

export function renderLayoutToSvgString(model: VizModel, mode: VizMode): string {
  const layout = computeLayout(model, mode)
  const viewBox =
    mode === 'strongly-related'  ? '0 0 860 400'
    : mode === 'sunburst'         ? '0 0 900 900'
    : mode === 'constellation'    ? '0 0 900 600'
    : mode === 'focus-ring'       ? '0 0 900 900'
    : mode === 'layered-accordion' ? '0 0 900 600'
    : mode === 'time-ribbon'      ? '0 0 900 500'
    : '0 0 900 520'  // sankey-focus | isometric-city | focus-context

  const nodeById = (id: string) => layout.nodes.find(n => n.id === id)

  const arrowMarkerRef = (color: string): string => {
    if (color === '#2563eb') return 'url(#eArrowBlue)'
    if (color === '#f97316') return 'url(#eArrowOrange)'
    return 'url(#eArrowGray)'
  }

  const arrows = layout.arrows.map(a => {
    const from = nodeById(a.fromId), to = nodeById(a.toId)
    if (!from || !to) return ''
    const x1 = from.x + from.w
    const y1 = from.y + from.h / 2
    const x2 = to.x
    const y2 = to.y + to.h / 2
    const dash = a.dashed ? 'stroke-dasharray="4 3" ' : ''
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${a.color}" stroke-width="${a.strokeWidth}" ${dash}marker-end="${arrowMarkerRef(a.color)}" opacity="0.7" />`
  }).join('')

  // v491 — mode-branched shape rendering.  Sunburst + constellation use circles
  // (matching the in-app component); other modes use rects.  Constellation also
  // uses light-on-dark text since the surface background is dark slate.
  // v496 — badges + type markers spell out the full type name (Spell-out-Type-Names SUPREME).
  const useCircles     = mode === 'sunburst' || mode === 'constellation'
  const constellationBg = mode === 'constellation'
  const _typeBadgeWidth = (t: VizNode['type']): number => Math.ceil(PLANGUAGE_TYPE_LABEL[t].length * 5.2 + 8)
  const nodes = layout.nodes.map(n => {
    const fill = PLANGUAGE_FILL[n.type]
    const stroke = PLANGUAGE_STROKE[n.type]
    if (useCircles) {
      const cx = n.x + n.w / 2
      const cy = n.y + n.h / 2
      const r = mode === 'constellation' ? 8 : 10
      const textFill = constellationBg ? '#e2e8f0' : '#1e293b'
      // v496 — spelled-out type name above the circle (was single letter).
      const typeName = n.type !== 'stakeholder'
        ? `<text x="${cx}" y="${cy - 14}" font-size="8" font-weight="800" text-anchor="middle" fill="${constellationBg ? '#e2e8f0' : stroke}">${PLANGUAGE_TYPE_LABEL[n.type]}</text>`
        : ''
      return (
        `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="1.5" />` +
        typeName +
        `<text x="${cx}" y="${cy + (constellationBg ? 22 : 26)}" text-anchor="middle" font-size="9" fill="${textFill}" font-weight="500">${_escXml(_truncLabel(n.label, 18))}</text>`
      )
    }
    // Rect mode (sankey-focus, strongly-related, isometric-city, focus-context,
    // layered-accordion, focus-ring, time-ribbon)
    // v496 — badge pill sized to the full type name at font-size 8; label
    // moved to bottom of the rect to make room for the wider badge.
    const badgeFill = n.type === 'stakeholder' ? '' : PLANGUAGE_BADGE[n.type as 'F'|'V'|'C'|'R'|'S']
    const badgeW = n.type === 'stakeholder' ? 0 : _typeBadgeWidth(n.type)
    const badge = n.type === 'stakeholder' ? '' :
      `<rect x="${n.x + 4}" y="${n.y + 3}" width="${badgeW}" height="12" rx="3" fill="${badgeFill}" />` +
      `<text x="${n.x + 4 + badgeW / 2}" y="${n.y + 12}" text-anchor="middle" font-size="8" fill="white" font-weight="700">${PLANGUAGE_TYPE_LABEL[n.type]}</text>`
    const labelX = n.type !== 'stakeholder' ? n.x + 6 : n.x + 8
    const labelY = n.y + n.h - 8
    const textFill = n.type === 'stakeholder' ? '#475569' : '#1e293b'
    return (
      `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="1.5" />` +
      badge +
      `<text x="${labelX}" y="${labelY}" font-size="10" fill="${textFill}" font-weight="500">${_escXml(_truncLabel(n.label))}</text>`
    )
  }).join('')

  // v495 (2026-07-21) — Tom Gilb "the focus ring circle lines are invisible".
  // Focus-ring + sunburst LAYOUT places nodes on concentric rings but the
  // rings themselves were never DRAWN — nodes appeared to float without the
  // structural cue.  Fix: draw dashed guide circles at each ring radius
  // centred at (450, 450) BEHIND everything.  Same fix pattern as v493 lane
  // stripes: applied to both in-app + export via shared code.
  const ringGuides: string = (() => {
    if (mode !== 'focus-ring' && mode !== 'sunburst') return ''
    const CX = 450, CY = 450
    const radii = mode === 'focus-ring'
      ? [170, 300, 420]              // Ring 1 · Ring 2 · Ring 3
      : [90, 190, 290, 390]          // Sunburst 4 rings
    return radii.map(r =>
      `<circle cx="${CX}" cy="${CY}" r="${r}" fill="none" stroke="#cbd5e1" stroke-width="1" stroke-dasharray="4 4" opacity="0.7" />`
    ).join('')
  })()

  // v493 (2026-07-21) — Tom Gilb "the horizontal lanes did not paste in email
  // same way as I see it on screen, fear this is true for all visuals".
  // Root cause: lane-based modes (time-ribbon, layered-accordion) had NO
  // visible lane background, so the lane STRUCTURE was implied only by
  // y-positioning of entries — visually easy to miss in the export.  Fix:
  // draw subtle alternating lane background stripes ("swimlanes") so the
  // lane grouping is visible at a glance.  Applied to BOTH in-app + export
  // renderers via shared helper so they render identically.
  const laneStripes: string = (() => {
    if (mode !== 'time-ribbon' && mode !== 'layered-accordion') return ''
    // Lane geometry duplicated from the layout functions.  Kept small +
    // co-located so a lane-count change only touches this + the layout fn.
    const lanes = mode === 'time-ribbon'
      ? [   // TOP_PAD=50, LANE_H=80, LANE_GAP=12 (5 lanes)
          { y: 50,  h: 80 }, { y: 142, h: 80 }, { y: 234, h: 80 },
          { y: 326, h: 80 }, { y: 418, h: 80 },
        ]
      : [   // BAND_TOP_PAD=40, BAND_HEIGHT=90, BAND_GAP=20 (5 bands)
          { y: 40,  h: 90 }, { y: 150, h: 90 }, { y: 260, h: 90 },
          { y: 370, h: 90 }, { y: 480, h: 90 },
        ]
    // Alternate light-grey + white; canonical DD-017 colours safe for R-G.
    const width = 900
    return lanes.map((l, i) =>
      `<rect x="0" y="${l.y}" width="${width}" height="${l.h}" fill="${i % 2 === 0 ? '#f8fafc' : '#ffffff'}" />`
    ).join('')
  })()

  // v491 — mode-specific column/row header positions.  Constellation renders
  // in light colour on the dark background.
  const headerFill = mode === 'constellation' ? '#cbd5e1' : '#64748b'
  const _lh = (x: number, y: number, label: string, anchor: 'start' | 'middle' = 'middle', size = 11) =>
    `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" fill="${headerFill}" font-weight="600">${_escXml(label)}</text>`

  let columnHeaders: string
  if (mode === 'strongly-related') {
    columnHeaders =
      _lh(10, 16,  'STAKEHOLDERS',            'start') +
      _lh(10, 116, 'FUNCTIONS',               'start') +
      _lh(10, 236, 'VALUES',                  'start') +
      _lh(10, 336, 'CONSTRAINTS + RESOURCES', 'start')
  } else if (mode === 'sunburst') {
    const title = model.title.length > 30 ? model.title.slice(0, 27) + '…' : model.title
    columnHeaders = _lh(450, 445, title, 'middle', 13) + _lh(450, 465, 'MODEL', 'middle')
  } else if (mode === 'constellation') {
    columnHeaders =
      _lh(180, 30,  'STAKEHOLDERS') + _lh(720, 30,  'VALUES') +
      _lh(450, 210, 'FUNCTIONS')    + _lh(180, 580, 'CONSTRAINTS') + _lh(720, 580, 'RESOURCES')
  } else if (mode === 'layered-accordion') {
    columnHeaders =
      _lh(90, 90,  'STAKEHOLDERS') + _lh(90, 200, 'FUNCTIONS') +
      _lh(90, 310, 'VALUES')       + _lh(90, 420, 'CONSTRAINTS') + _lh(90, 530, 'RESOURCES')
  } else if (mode === 'focus-ring') {
    columnHeaders = _lh(450, 20, 'CONTEXT (Constraints + Resources)') + _lh(450, 480, 'FOCUS')
  } else if (mode === 'time-ribbon') {
    columnHeaders =
      _lh(80, 92,  'STAKEHOLDERS') + _lh(80, 184, 'FUNCTIONS') +
      _lh(80, 276, 'VALUES')       + _lh(80, 368, 'CONSTRAINTS') + _lh(80, 460, 'RESOURCES')
  } else {
    // sankey-focus | isometric-city | focus-context
    columnHeaders =
      _lh(100, 20, 'STAKEHOLDERS') + _lh(390, 20, 'FUNCTIONS') + _lh(680, 20, 'VALUES')
  }

  const defs =
    '<defs>' +
    '<marker id="eArrowBlue"   markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#2563eb" /></marker>' +
    '<marker id="eArrowGray"   markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#94a3b8" /></marker>' +
    '<marker id="eArrowOrange" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#f97316" /></marker>' +
    '</defs>'

  // v491 — constellation renders on dark background for star-map drama;
  // matches the in-app component's surface colour so email + app look the same.
  const svgBg = mode === 'constellation' ? '#0f172a' : '#ffffff'
  // v493 — lane stripes render FIRST (behind everything) so entries + arrows
  // + column labels overlay cleanly.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" style="width:100%;max-width:820px;height:auto;background:${svgBg};">` +
         defs + laneStripes + ringGuides + columnHeaders + arrows + nodes +
         '</svg>'
}
