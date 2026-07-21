// UNIT_TYPE=Composable
// Feature #61 — Spec glossary auto-builder
import { ref } from 'vue'
import type { SpecBlock } from '../types/spec'
import { exportCopy } from './useExportShared'
import { mnemonicLabel } from './usePenta'

/**
 * r41 v393 (Tom Gilb 2026-07-01 verbatim "To the Local SEM spec Glossary add
 * an optional categy of 'PLanguage Tags' with brief description, in
 * alphabetical order, exportable of course") — new `'planguage-tag'` type is
 * an OPTIONAL fourth category alongside acronym / domain-term / metric.
 *
 * A Planguage Tag entry mirrors the Planguage Mnemonic ID Standard SUPREME
 * (Tom Gilb 2026-06-09): every F./V./S./C./R. spec entry carries a 1-3-word
 * mnemonic identifier — Great Mnemonic Unique Tags derived from the essence
 * of the definition.  This category surfaces every spec entry's Tag alongside
 * its brief description, alphabetised, colour-coded per canonical Planguage
 * type colour on export.  Composes with Spell-out-Type-Names SUPREME (the
 * displayed Tag is the mnemonic form — dotted `V.` / `F.` prefix stripped +
 * CamelCase transitions humanised via the shared `mnemonicLabel` helper),
 * Colorful Exports Rule (colour-coded rows on HTML export), Planguage Mnemonic
 * ID Standard SUPREME (the canonical source of truth for what a Planguage Tag
 * is), Twin portability.
 */
export interface GlossaryEntry {
  term: string
  definition: string
  usedIn: string[]   // entry IDs where this term appears
  type: 'acronym' | 'domain-term' | 'metric' | 'planguage-tag'
  /** For planguage-tag entries: the canonical Planguage entry-type
   *  (Function / Value / Solution / Constraint / Resource) — used to colour
   *  the row per the Colorful Exports Rule.  Undefined for other types. */
  planguageType?: 'Function' | 'Value' | 'Solution' | 'Constraint' | 'Resource'
}

// Common non-domain words to exclude
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'are', 'was', 'were', 'be',
  'this', 'that', 'these', 'those', 'it', 'its', 'will', 'should', 'must',
  'each', 'all', 'any', 'per', 'via', 'vs', 'etc', 'eg', 'ie',
])

function classifyTerm(term: string): 'acronym' | 'domain-term' | 'metric' {
  if (/^[A-Z]{2,}$/.test(term)) return 'acronym'
  if (/\d/.test(term) || /%|ms|px|usd|\$/.test(term.toLowerCase())) return 'metric'
  return 'domain-term'
}

function generateDefinition(term: string, type: 'acronym' | 'domain-term' | 'metric', context: string): string {
  if (type === 'acronym') {
    const acronyms: Record<string, string> = {
      'API': 'Application Programming Interface — a contract for software communication',
      'UI': 'User Interface — the visual layer users interact with',
      'UX': 'User Experience — the overall quality of a user\'s interaction',
      'SLA': 'Service Level Agreement — a contractual performance commitment',
      'KPI': 'Key Performance Indicator — a measurable value tracking goal progress',
      'NPS': 'Net Promoter Score — a measure of customer loyalty (-100 to +100)',
      'MRR': 'Monthly Recurring Revenue — predictable monthly income',
      'ARR': 'Annual Recurring Revenue — annualised predictable income',
      'MVP': 'Minimum Viable Product — smallest shippable version',
      'ROI': 'Return on Investment — benefit relative to cost',
    }
    return acronyms[term] ?? `${term} — acronym used in this specification`
  }
  if (type === 'metric') {
    return `${term} — a measurable quantity tracked in this specification`
  }
  // Domain term: generate from context
  const words = context.split(/\s+/).slice(0, 8).join(' ')
  return `${term} — domain concept referenced in the context of: "${words.slice(0, 60)}…"`
}

export function useSpecGlossary(_apiKey?: string) {
  const glossary = ref<GlossaryEntry[]>([])
  const loading = ref(false)
  const copied = ref(false)
  /** r41 v393 — planner's stated preference for the optional Planguage Tags
   *  category.  Persisted so it stays sticky between sessions.  Consumers can
   *  toggle it via the UI or pass `{ includePlanguageTags }` into
   *  `extractTerms`. */
  const includePlanguageTags = ref<boolean>(_hydrateIncludeTagsFlag())

  function _hydrateIncludeTagsFlag(): boolean {
    if (typeof localStorage === 'undefined') return false
    try { return localStorage.getItem('sem-app:glossary:includePlanguageTags') === '1' } catch { return false }
  }
  function _persistIncludeTagsFlag(v: boolean): void {
    if (typeof localStorage === 'undefined') return
    try { localStorage.setItem('sem-app:glossary:includePlanguageTags', v ? '1' : '0') } catch { /* ignore */ }
  }

  /** Extract Planguage Tag entries — one per spec entry across F/V/S/C/R.
   *  Definition is the entry's brief description (first line, trimmed).
   *  Alphabetised on final assembly by the shared sort in `extractTerms`. */
  function _extractPlanguageTags(spec: SpecBlock): GlossaryEntry[] {
    const rows: GlossaryEntry[] = []
    const briefOf = (raw: string | undefined): string => {
      if (!raw) return '(no description on this entry)'
      // Take the first sentence or first line — whichever comes first — to
      // keep the glossary row a "brief description" per Tom's spec.
      const firstLine = raw.split(/\n/)[0].trim()
      const firstSentence = firstLine.split(/(?<=[.!?])\s/)[0].trim()
      return firstSentence || firstLine || '(no description on this entry)'
    }
    for (const f of spec.functions ?? [])
      rows.push({ term: mnemonicLabel(f.id, f.description), definition: briefOf(f.description), usedIn: [f.id], type: 'planguage-tag', planguageType: 'Function'   })
    for (const v of spec.values ?? [])
      rows.push({ term: mnemonicLabel(v.id, v.description), definition: briefOf(v.description), usedIn: [v.id], type: 'planguage-tag', planguageType: 'Value'      })
    for (const s of spec.solutions ?? [])
      rows.push({ term: mnemonicLabel(s.id, s.description), definition: briefOf(s.description), usedIn: [s.id], type: 'planguage-tag', planguageType: 'Solution'   })
    for (const c of spec.constraints ?? [])
      rows.push({ term: mnemonicLabel(c.id, c.description), definition: briefOf(c.description), usedIn: [c.id], type: 'planguage-tag', planguageType: 'Constraint' })
    for (const r of spec.resources ?? [])
      rows.push({ term: mnemonicLabel(r.id, r.description), definition: briefOf(r.description), usedIn: [r.id], type: 'planguage-tag', planguageType: 'Resource'   })
    return rows
  }

  function extractTerms(spec: SpecBlock, opts?: { includePlanguageTags?: boolean }): void {
    // Caller may override the persisted preference on a per-call basis.
    const includeTags = opts?.includePlanguageTags ?? includePlanguageTags.value
    const termMap = new Map<string, { usedIn: string[]; contexts: string[] }>()
    const allEntries = [
      ...spec.functions.map(f => ({ id: f.id, text: f.description })),
      ...spec.values.map(v => ({ id: v.id, text: `${v.description} ${v.scale ?? ''} ${v.goal ?? ''}` })),
      ...spec.solutions.map(s => ({ id: s.id, text: s.description })),
    ]

    for (const entry of allEntries) {
      // Extract acronyms (2+ uppercase letters)
      const acronyms = entry.text.match(/\b[A-Z]{2,}\b/g) ?? []
      // Extract capitalised domain terms (not at sentence start)
      const capTerms = entry.text.match(/(?<![.!?]\s)(?<!\n)\b[A-Z][a-z]{2,}\b/g) ?? []
      // Extract hyphenated terms
      const hyphenated = entry.text.match(/\b[a-zA-Z]+-[a-zA-Z]+\b/g) ?? []

      const allTerms = [...new Set([...acronyms, ...capTerms, ...hyphenated])]
      for (const term of allTerms) {
        if (STOP_WORDS.has(term.toLowerCase())) continue
        if (term.length < 3) continue
        const existing = termMap.get(term) ?? { usedIn: [], contexts: [] }
        if (!existing.usedIn.includes(entry.id)) existing.usedIn.push(entry.id)
        existing.contexts.push(entry.text)
        termMap.set(term, existing)
      }
    }

    const wordEntries: GlossaryEntry[] = Array.from(termMap.entries())
      .filter(([, v]) => v.usedIn.length >= 1)
      .slice(0, 20)  // cap at 20 for readability
      .map(([term, data]): GlossaryEntry => {
        const type = classifyTerm(term)
        return {
          term,
          type,
          usedIn: data.usedIn,
          definition: generateDefinition(term, type, data.contexts[0] ?? ''),
        }
      })

    const planguageTagEntries: GlossaryEntry[] = includeTags ? _extractPlanguageTags(spec) : []

    glossary.value = [...wordEntries, ...planguageTagEntries]
      // Alphabetical order across the whole glossary — Planguage Tags interleave
      // with acronyms / domain terms / metrics.  Case-insensitive via localeCompare.
      .sort((a, b) => a.term.localeCompare(b.term))
  }

  /** Toggle the optional Planguage Tags category on/off.  Persists preference.
   *  Caller supplies the current spec so the glossary reflects the toggle
   *  immediately.  Composes with Universal Undo SUPREME (toggle is reversible
   *  — flip back). */
  function setIncludePlanguageTags(v: boolean, spec: SpecBlock | null): void {
    includePlanguageTags.value = v
    _persistIncludeTagsFlag(v)
    if (spec) extractTerms(spec)
  }

  function toMarkdown(): string {
    // r41 v393 — Planguage Tag rows carry their canonical type label so plain-
    // text targets (Notes, plain-mail, Markdown files) still convey the type.
    const labelFor = (e: GlossaryEntry): string => {
      if (e.type === 'planguage-tag') return `Planguage Tag · ${e.planguageType ?? 'Unknown'}`
      if (e.type === 'acronym')       return 'Acronym'
      if (e.type === 'metric')        return 'Metric'
      return 'Domain term'
    }
    const lines = [
      '# Spec Glossary',
      '',
      ...glossary.value.map(e => `**${e.term}** *(${labelFor(e)})* — ${e.definition} *(used in: ${e.usedIn.join(', ')})*`),
    ]
    return lines.join('\n\n')
  }

  /** r41 v83 (Tom Gilb 2026-06-16 "domain terms copy is not html or like the
   *  screen please fix") — was plain-markdown-only via writeText.  Now builds
   *  a colourful HTML table matching the in-app Glossary panel (per-type
   *  colour: acronym=violet, domain-term=indigo, metric=emerald) + emits via
   *  the dual-MIME exportCopy so HTML lands in Mail/Notes/Keynote and the
   *  markdown fallback covers plain-only targets. */
  function toHtml(): string {
    // r41 v393 — added planguage-tag rows with canonical Planguage type colours
    // (per Colorful Exports Rule + Colour-Glyph two-family rule).  When a
    // planguage-tag has `planguageType`, its bar/text hue picks the canonical
    // type colour (Function emerald / Value violet / Constraint red / Resource
    // teal / Solution orange).  Fallback slate for any planguage-tag without a
    // planguageType (should not happen in practice; defensive only).
    const TYPE_COLOR: Record<string, { bg: string; text: string; bar: string; label: string }> = {
      'acronym':      { bg: '#faf5ff', text: '#5b21b6', bar: '#7c3aed', label: 'Acronym' },
      'domain-term':  { bg: '#eef2ff', text: '#3730a3', bar: '#4f46e5', label: 'Domain term' },
      'metric':       { bg: '#ecfdf5', text: '#065f46', bar: '#10b981', label: 'Metric' },
      'planguage-tag':                       { bg: '#f8fafc', text: '#1e293b', bar: '#64748b', label: 'Planguage Tag' },
    }
    const PLANGUAGE_TYPE_COLOR: Record<string, { bg: string; text: string; bar: string; label: string }> = {
      'Function':   { bg: '#ecfdf5', text: '#065f46', bar: '#10b981', label: 'Planguage Tag · Function'   },
      'Value':      { bg: '#f5f3ff', text: '#5b21b6', bar: '#7c3aed', label: 'Planguage Tag · Value'      },
      'Constraint': { bg: '#fef2f2', text: '#991b1b', bar: '#dc2626', label: 'Planguage Tag · Constraint' },
      'Resource':   { bg: '#f0fdfa', text: '#115e59', bar: '#14b8a6', label: 'Planguage Tag · Resource'   },
      'Solution':   { bg: '#fff7ed', text: '#9a3412', bar: '#ea580c', label: 'Planguage Tag · Solution'   },
    }
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    const rows = glossary.value.map(e => {
      const c = (e.type === 'planguage-tag' && e.planguageType)
        ? (PLANGUAGE_TYPE_COLOR[e.planguageType] ?? TYPE_COLOR['planguage-tag'])
        : (TYPE_COLOR[e.type] ?? TYPE_COLOR['domain-term'])
      return `<tr>
        <td bgcolor="${c.bar}" width="6" style="background:${c.bar};width:6px;padding:0;">&nbsp;</td>
        <td bgcolor="${c.bg}" width="200" style="background:${c.bg};color:${c.text};font-weight:800;font-size:16px;padding:10px 14px;vertical-align:top;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.3;"><u>${esc(e.term)}</u><div style="font-size:10px;font-weight:600;opacity:0.7;text-transform:uppercase;letter-spacing:0.08em;margin-top:3px;">${c.label}</div></td>
        <td bgcolor="#ffffff" style="background:#ffffff;color:#0f172a;font-size:13px;padding:10px 14px;vertical-align:top;line-height:1.5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${esc(e.definition)}<div style="font-size:10px;color:#94a3b8;font-style:italic;margin-top:4px;">used in: ${esc(e.usedIn.join(', '))}</div></td>
      </tr>`
    }).join('<tr><td colspan="3" bgcolor="#1e293b" height="3" style="background:#1e293b;height:3px;padding:0;font-size:0;line-height:0;">&nbsp;</td></tr>')
    const now = new Date()
    const date = now.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    return `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;width:100%;max-width:900px;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0 0 14px 0;box-shadow:0 6px 0 0 #1e293b, 0 1px 3px rgba(0,0,0,0.08);">
      <tr><td colspan="3" bgcolor="#7c3aed" style="background:#7c3aed;color:#ffffff;padding:18px 22px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.4;">
        <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;font-weight:600;opacity:0.85;margin-bottom:4px;">📚 Spec Glossary · SEM App</div>
        <div style="font-size:22px;font-weight:800;">${glossary.value.length} term${glossary.value.length === 1 ? '' : 's'}</div>
        <div style="font-size:11px;opacity:0.85;margin-top:4px;">${esc(date)} · ${esc(time)} · acronyms violet · domain terms indigo · metrics emerald${glossary.value.some(e => e.type === 'planguage-tag') ? ' · Planguage Tags by canonical type colour' : ''}</div>
      </td></tr>
      <tr><td colspan="3" bgcolor="#1e293b" height="4" style="background:#1e293b;height:4px;padding:0;font-size:0;line-height:0;">&nbsp;</td></tr>
      ${rows}
    </table>`
  }

  async function copyGlossary(): Promise<void> {
    const html  = toHtml()
    const plain = toMarkdown()
    console.info('[copyGlossary] html size:', html.length, '· plain size:', plain.length, '· terms:', glossary.value.length)
    const ok = await exportCopy(html, plain)
    if (ok) {
      copied.value = true
      setTimeout(() => { copied.value = false }, 2000)
    }
  }

  return {
    glossary,
    loading,
    copied,
    extractTerms,
    copyGlossary,
    toMarkdown,
    toHtml,
    // r41 v393 — new optional Planguage Tags category
    includePlanguageTags,
    setIncludePlanguageTags,
  }
}
