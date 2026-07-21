// useQualifiersRender.ts — Universal HTML + plain-text renderers for the
// 3-class Qualifiers strip (Tom Gilb r93rrr 2026-06-12).
//
// Single source of truth for serializing the canonical 3-class Qualifiers
// (Time / Place / Event per Glossary *124 + *666 + *153/*107/*062) into:
//   - HTML (for colourful exports / Mail.app / Keynote paste)
//   - Plain text (for r93zz Completeness Pledge mirrors)
//
// Renders the Infinity Trap warning (r93mmm SUPREME) when all three classes
// empty, with a Twin Consultant *124 link (r93ppp funding-loop discipline).
// Renders the canonical Planguage book form `<Level> [<tags>]: <value>` when
// at least one class is filled, per r93fff Spec-Tag-Uppermost-with-Colon.

/** Shared shape — accepts both canonical (time/place/event) and legacy (when/where/what/how/why) field names per r93rrr migration aliases. */
export interface UniversalConditions {
  time?:  string
  place?: string
  event?: string
  // Legacy Phase-1 aliases (read-only):
  when?:  string
  where?: string
  what?:  string
  how?:   string
  why?:   string
}

/** Read canonical with legacy alias fallback. */
function readCanonical(c?: UniversalConditions | null): { t?: string; p?: string; ev?: string } {
  if (!c) return {}
  return {
    t:  c.time  ?? c.when  ?? undefined,
    p:  c.place ?? c.where ?? undefined,
    ev: c.event ?? c.what  ?? c.how   ?? undefined,
  }
}

/** Minimal HTML escape — same shape as ValueAspectsPanel._escHtml. */
function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Renders the Qualifiers strip as one HTML block (for embedding in a larger spec
 * export). Emits either the violet canonical preview row OR the red Infinity Trap
 * warning row. Returns an empty string if `conditions` is omitted AND `forceTrap` is false.
 */
export function qualifiersHtml(
  conditions: UniversalConditions | null | undefined,
  opts: { entryName?: string; levelLabel?: string; levelValue?: string; forceTrap?: boolean } = {},
): string {
  const { entryName = '', levelLabel = 'Goal', levelValue = '', forceTrap = false } = opts
  const { t, p, ev } = readCanonical(conditions ?? null)
  const filled = [t, p, ev].filter(Boolean) as string[]

  // Empty + not forced → omit
  if (filled.length === 0 && !forceTrap) return ''

  // Infinity Trap warning
  if (filled.length === 0) {
    return `<div style="margin-top:8px;padding:6px 10px;background:#fef2f2;border-left:3px solid #dc2626;font-size:11px;color:#7f1d1d;border-radius:4px;line-height:1.45;"><b>⚠ [∞] INFINITY TRAP</b> — no Qualifiers on ${escHtml(entryName || 'this spec')}. Bound in Time + Place + Event or risk infinite costs. <a href="https://www.gilb.com/tomtwin/concept/Qualifier.124" style="color:#5b21b6;font-weight:bold;">*124 Qualifier ↗</a> <span style="font-size:10px;font-style:italic;opacity:0.75;">(via Tom Gilb Consultant Twin, by Kai Gilb)</span></div>`
  }

  // Canonical preview — r41 v122 (Tom Gilb 2026-06-17 verbatim "AT THE VERY
  // LEAST THESE IMPORTANT CRITERIA ARE SQUASHED INTO ILLEGIBLE. 1. make the
  // conditon header bold (WHO, WHEN, ...). Then make them on a new line.").
  // Each Qualifier class on its OWN <div> row, header uppercase+bold for
  // legibility, Planguage book form on the headline.
  const tag = filled.join(', ')
  const tHtml  = t  ? escHtml(t)  : '—'
  const pHtml  = p  ? escHtml(p)  : '—'
  const evHtml = ev ? escHtml(ev) : '—'
  return `<div style="margin-top:8px;padding:8px 12px;background:#faf5ff;border-left:3px solid #7c3aed;font-size:12px;color:#5b21b6;font-family:ui-monospace,monospace;border-radius:4px;line-height:1.6;"><div style="font-weight:bold;font-size:13px;margin-bottom:4px;">Qualifiers &nbsp; <span style="font-weight:bold;">${escHtml(levelLabel)} [${escHtml(tag)}]:</span> ${escHtml(levelValue || '—')}</div><div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;color:#334155;"><b>TIME:</b>&nbsp;${tHtml}</div><div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;color:#334155;"><b>PLACE:</b>&nbsp;${pHtml}</div><div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;color:#334155;"><b>EVENT:</b>&nbsp;${evHtml}</div><div style="font-size:10px;font-style:italic;opacity:0.7;margin-top:3px;">canonical Planguage form per *124</div></div>`
}

/**
 * Renders the Qualifiers strip as plain-text lines for the export. Returns an
 * empty array if `conditions` is omitted AND `forceTrap` is false. Each returned
 * line is unindented (caller adds indent if needed).
 */
export function qualifiersPlain(
  conditions: UniversalConditions | null | undefined,
  opts: { entryName?: string; levelLabel?: string; levelValue?: string; forceTrap?: boolean } = {},
): string[] {
  const { entryName = '', levelLabel = 'Goal', levelValue = '', forceTrap = false } = opts
  const { t, p, ev } = readCanonical(conditions ?? null)
  const filled = [t, p, ev].filter(Boolean) as string[]

  if (filled.length === 0 && !forceTrap) return []

  if (filled.length === 0) {
    return [
      `Qualifiers:  ⚠ [∞] INFINITY TRAP — no qualifiers on ${entryName || 'this spec'};`,
      `             bound in Time + Place + Event or risk infinite costs.`,
      `             *124 Qualifier  https://www.gilb.com/tomtwin/concept/Qualifier.124`,
      `             (via Tom Gilb Consultant Twin, by Kai Gilb)`,
    ]
  }

  // r41 v122 plain-text variant — each class on its own line for legibility.
  const tag = filled.join(', ')
  return [
    `Qualifiers:  ${levelLabel} [${tag}]: ${levelValue || '—'}`,
    `             TIME:  ${t ?? '—'}`,
    `             PLACE: ${p ?? '—'}`,
    `             EVENT: ${ev ?? '—'}`,
  ]
}
