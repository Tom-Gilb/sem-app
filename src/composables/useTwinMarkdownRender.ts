// useTwinMarkdownRender.ts — focused Markdown → HTML renderer for Tom's Twin
// Consultant responses (Tom Gilb r93vvv 2026-06-13).
//
// Tom verbatim 2026-06-13: *"can you edit them bold and new lines so it is more
// appealing"* + *"can you make urls clickable so we go to them"* + *"it is not
// clear what these other than *145 concept numbers are, explain, and make them
// clickable (to maybe another window)"*.
//
// Purpose-built for the Twin's actual output format observed live (r93ooo +
// r93ttt + r93uuu probes): a mix of `#`/`##`/`###` headers, `**bold**`,
// `*italic*`, pipe tables, `---` hr, bullet lists, inline `https://…` URLs,
// and `*NNN` Planguage Glossary concept references.
//
// Design choices:
//   - No external Markdown dep — focused renderer, ~150 LOC, covers Twin output
//   - Concept numbers (*NNN) become clickable Twin concept links — we extract
//     the name from any preceding markdown table or `# Heading (*NNN)` form,
//     so `*099` in body text links to /tomtwin/concept/Object.099 when the
//     table earlier defined "Object | *099"; falls back to a search-by-number
//     URL if no name is in context
//   - URLs become clickable in a new tab with `rel="noopener"`
//   - Output is sanitized: we escape HTML entities BEFORE doing transformations,
//     then build our own `<a>` / `<strong>` / `<em>` / `<table>` tags — no
//     v-html risk of injected scripts since the input passes through escape first
//   - Tables get violet Planguage styling; headers get violet weights
//   - Composes with r93ppp Twin-as-Destination (every link is a funding-loop touch)

const TWIN_BASE = 'https://www.gilb.com/tomtwin'

/** Build a Twin concept URL from a name + number — same as useTwinCitation.twinConceptUrl. */
function _twinConceptUrl(name: string, n: string): string {
  const safe = name.trim().replace(/\s+/g, '-')
  return `${TWIN_BASE}/concept/${safe}.${n}`
}

/** Fallback when we don't know the concept name — link to Twin search-by-login. */
function _twinSearchByNumber(n: string): string {
  return `${TWIN_BASE}/login?concept=${n}`
}

/** Minimal HTML entity escape (must run BEFORE any tag construction). */
function _esc(s: string): string {
  return s.replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
}

/**
 * Pre-scan the raw text for any place a concept name + number co-occur:
 *   - Markdown table rows like  `| **Object** | *099 | ... |`
 *   - Heading lines like        `# System (*145) — Definition`
 *   - Inline phrases like       `**Object** (*099)` or `Object *099`
 * Returns a Map from "099" → "Object" so inline `*099` later in the text
 * can be linked to /concept/Object.099.
 */
function _scanConceptNameMap(text: string): Map<string, string> {
  const map = new Map<string, string>()

  // (a) table rows: `| **Name** | *NNN | …` or `| Name | *NNN | …`
  const tableRe = /\|\s*(?:\*\*([^*|]+?)\*\*|([^|*]+?))\s*\|\s*\*(\d{2,4})\b/g
  for (let m: RegExpExecArray | null; (m = tableRe.exec(text)) !== null; ) {
    const name = (m[1] ?? m[2] ?? '').trim()
    const n = m[3]
    if (name && !map.has(n)) map.set(n, name)
  }

  // (b) heading lines: `# Name (*NNN)` or `## Name (*NNN)`
  const headRe = /^#{1,6}\s+([A-Za-z][A-Za-z0-9 \-/]+?)\s*\(\*(\d{2,4})\)/gm
  for (let m: RegExpExecArray | null; (m = headRe.exec(text)) !== null; ) {
    if (!map.has(m[2])) map.set(m[2], m[1].trim())
  }

  // (c) inline `**Name**` then `*NNN` within a few chars
  const inlineRe = /\*\*([A-Z][A-Za-z0-9 \-/]+?)\*\*\s*(?:\(|—|\s)\s*\*(\d{2,4})\b/g
  for (let m: RegExpExecArray | null; (m = inlineRe.exec(text)) !== null; ) {
    if (!map.has(m[2])) map.set(m[2], m[1].trim())
  }

  return map
}

/**
 * Linkify concept numbers (`*NNN`) within an already-escaped HTML fragment.
 * Uses the name map to build proper /concept/Name.NNN URLs when known.
 *
 * r93qqq r25 (Tom Gilb 2026-06-13: Illuminate panel Related Concepts rendering
 * was catastrophically broken — title attributes had `<a>` tags injected
 * inside their `(*NNN)` text, which closed the title attribute early and
 * leaked HTML attribute syntax as visible cell content) — the fix: split the
 * HTML into tag-segments vs text-segments and ONLY linkify `*NNN` in text
 * segments.  Tag interiors (attribute values, opening/closing tags) are left
 * untouched so the title attribute `title="...(*396)..."` stays a plain
 * string.  Pre-r25 behaviour was the regex eating `*NNN` everywhere including
 * inside attribute values.
 */
function _linkifyConceptNumbers(htmlSafe: string, nameMap: Map<string, string>): string {
  const linkifyText = (text: string): string =>
    text.replace(/\*(\d{2,4})\b/g, (_full, n: string) => {
      const name = nameMap.get(n)
      const url = name ? _twinConceptUrl(name, n) : _twinSearchByNumber(n)
      const title = name
        ? `Open Glossary entry *${n} ${name} in Tom Gilb's Twin Consultant (by Kai Gilb) — passwordless, free at-a-click.`
        : `Open Planguage Glossary concept *${n} in Tom Gilb's Twin Consultant (by Kai Gilb).`
      return `<a href="${url}" target="_blank" rel="noopener" class="font-mono font-bold text-violet-700 hover:text-violet-900 underline decoration-violet-400 decoration-1 underline-offset-2" title="${_esc(title)}">*${n}</a>`
    })
  // Walk the HTML respecting tag boundaries — tokens are either a full `<...>`
  // tag (kept as-is) or a run of text content (linkified).
  return htmlSafe.replace(/(<[^>]*>)|([^<]+)/g, (_match, tag: string | undefined, text: string | undefined) => {
    if (tag) return tag         // never touch tag interiors / attribute values
    return linkifyText(text ?? '')
  })
}

/**
 * Linkify bare URLs into clickable anchors (already-escaped input).
 * Restricted to http(s) URLs to avoid javascript: injection.
 *
 * r25 fix — same tag-aware split as `_linkifyConceptNumbers`. Without this
 * guard, URLs inside existing `<a href="...">` attribute values were being
 * re-linkified inside the attribute, corrupting the surrounding tag.
 */
function _linkifyUrls(htmlSafe: string): string {
  const linkifyText = (text: string): string =>
    text.replace(/(https?:\/\/[^\s<>"']+[A-Za-z0-9/])/g, (url: string) =>
      `<a href="${url}" target="_blank" rel="noopener" class="text-violet-700 hover:text-violet-900 underline decoration-violet-400 decoration-1 underline-offset-2 break-all" title="Open ${_esc(url)} in a new tab">${url}</a>`,
    )
  return htmlSafe.replace(/(<[^>]*>)|([^<]+)/g, (_match, tag: string | undefined, text: string | undefined) => {
    if (tag) return tag
    return linkifyText(text ?? '')
  })
}

/** Render a single line of inline markdown (bold + italic + code) — escaped input. */
function _renderInline(line: string): string {
  // 1. Bold: **text**  (run first so `*` collisions with italic resolve correctly)
  line = line.replace(/\*\*([^*]+?)\*\*/g, '<strong class="font-extrabold text-slate-900">$1</strong>')
  // 2. Italic: *text*  — but skip lone `*NNN` (concept numbers) which we linkify later.
  //    Strategy: `*` that is NOT followed by a digit AND is followed by non-`*` text.
  line = line.replace(/\*(?!\d)([^*\n]+?)\*/g, '<em class="italic text-slate-700">$1</em>')
  // 3. Inline code: `text`
  line = line.replace(/`([^`]+?)`/g, '<code class="font-mono text-[12px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-900 ring-1 ring-violet-200">$1</code>')
  // 4. "Definition:" / "Concept Number:" / "Canonical Source:" style key-value lines —
  //    when a line starts with `<strong>Key:</strong>`, wrap the value in a subtle pill so
  //    the structure reads as a definition list.
  return line
}

/**
 * Parse a markdown pipe table fragment (header row + separator + body rows).
 * Returns the rendered HTML `<table>` element string + the number of input lines consumed.
 * Beauty pass r93www — rounded card, gradient header, alternating bands, hover-highlight,
 * shadow, generous padding. Reads like a published Glossary table.
 */
function _renderTable(lines: string[], i: number): { html: string; consumed: number } {
  const isPipeRow = (s: string) => /^\s*\|/.test(s)
  if (!isPipeRow(lines[i] ?? '') || !/^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] ?? '')) {
    return { html: '', consumed: 0 }
  }
  const split = (row: string) => row.trim().replace(/^\|\s*/, '').replace(/\s*\|$/, '').split(/\s*\|\s*/)
  const head = split(lines[i])
  const rows: string[][] = []
  let j = i + 2
  while (j < lines.length && isPipeRow(lines[j])) {
    rows.push(split(lines[j]))
    j++
  }
  // r93yyy embellishment palette — cycle accent hues per row so the table
  // reads as a coloured constellation, not a uniform list. Each colour
  // composes with violet (the parent Twin family) — emerald / amber / rose /
  // sky / indigo / teal — all WCAG-AA on white per accessibility_tom.md.
  const ROW_ACCENTS = [
    'border-l-emerald-500 bg-emerald-50/30',
    'border-l-amber-500   bg-amber-50/30',
    'border-l-rose-500    bg-rose-50/30',
    'border-l-sky-500     bg-sky-50/30',
    'border-l-indigo-500  bg-indigo-50/30',
    'border-l-teal-500    bg-teal-50/30',
  ]
  let html = `<div class="my-4 rounded-xl ring-1 ring-violet-200 shadow-sm overflow-hidden bg-white">`
  html += `<div class="overflow-x-auto">`
  html += `<table class="w-full border-collapse text-[12.5px]">`
  // Header — violet→indigo gradient, white text, extrabold uppercase
  html += `<thead><tr class="bg-gradient-to-r from-violet-600 to-indigo-600 text-white">`
  for (const h of head) {
    html += `<th class="px-3 py-2.5 text-left font-extrabold uppercase tracking-wide text-[11px] border-b-2 border-indigo-700">${_renderInline(h)}</th>`
  }
  html += `</tr></thead><tbody>`
  for (let r = 0; r < rows.length; r++) {
    const accent = ROW_ACCENTS[r % ROW_ACCENTS.length]
    const cells = rows[r]
    // r93zzz — extract concept name + number from the row for drill-down click delegation.
    let conceptName = ''
    let conceptNumber = ''
    for (const c of cells) {
      const nm = /\*\*([^*]+?)\*\*/.exec(c)
      if (nm && !conceptName) conceptName = nm[1].trim()
      const num = /\*(\d{2,4})\b/.exec(c)
      if (num && !conceptNumber) conceptNumber = num[1]
    }
    const drillAttr = (conceptName && conceptNumber)
      ? ` data-concept-name="${_esc(conceptName)}" data-concept-number="${_esc(conceptNumber)}" role="link" tabindex="0" title="Click row to drill into ${_esc(conceptName)} (*${_esc(conceptNumber)}) inside this panel. Click 📚 to open sources + book figures in a new window."`
      : ''
    const clickClass = (conceptName && conceptNumber) ? 'cursor-pointer' : ''
    // r93a4 — Twin-window URL for the per-row "📚 Sources & Figures" button.
    // Opens the Twin Consultant SPA concept page in a NEW WINDOW (window.open
    // with sizing features) so the user can read book passages + view figures
    // side-by-side with the current panel. Tom Gilb 2026-06-13: "could use twin
    // to find sources of info and especially any figures from my books !! (in
    // separate window???". Composes with r93ppp Twin-as-Destination funding-loop.
    const twinSourcesUrl = (conceptName && conceptNumber)
      ? `https://www.gilb.com/tomtwin/concept/${conceptName.trim().replace(/\s+/g, '-')}.${conceptNumber}`
      : ''
    html += `<tr class="${accent} ${clickClass} border-l-4 hover:brightness-105 hover:shadow-sm transition-all"${drillAttr}>`
    for (let cIdx = 0; cIdx < cells.length; cIdx++) {
      const cell = cells[cIdx]
      if (cIdx === 0) {
        html += `<td class="px-3 py-2 text-slate-900 border-b border-violet-100 align-top leading-relaxed font-bold">` +
                `<span class="inline-flex items-center gap-1.5"><span aria-hidden="true" class="text-violet-500 text-[12px] shrink-0">✦</span><span class="min-w-0">${_renderInline(cell)}</span></span></td>`
      } else if (cIdx === cells.length - 1) {
        // r93a4 + r93d7 — Last cell: per-row action cluster — THREE explicit affordances.
        //   💡 Illuminate (⌘I) — full Illuminate flow for THIS concept (local Glossary
        //                        tier 1 + Twin fallback) — fires `defineTerm()` exactly
        //                        as the ⌥I keyboard shortcut would (Tom Gilb 2026-06-13
        //                        "click on the glossary diagram elements … look it up
        //                        in illustrate cmnd i")
        //   📚 Sources & Figures — open the concept in a NEW WINDOW via Tom Gilb's Twin
        //                          Consultant (book passages + chapter refs + figures)
        //   ↩ Drill (in-panel) — clicking the row BODY drills within this panel
        //                        (the existing r93zzz Twin re-cite path)
        // All three coexist; tooltips spell out the destination so users see which
        // affordance does what BEFORE they hover and click.
        const actionCluster = (conceptName && conceptNumber)
          ? `<span class="float-right ml-2 inline-flex items-center gap-1 shrink-0">
              <button type="button"
                data-action="illuminate-concept"
                data-concept-name="${_esc(conceptName)}"
                data-concept-number="${_esc(conceptNumber)}"
                class="text-violet-600 hover:text-violet-900 hover:bg-violet-100 rounded px-1 py-0.5 text-[13px] leading-none transition-colors"
                title="💡 Illuminate (⌘I) — look up ${_esc(conceptName)} (*${_esc(conceptNumber)}) via the full Illuminate flow: local Planguage Glossary tier 1 + Tom Gilb's Twin Consultant fallback. Same as selecting the concept and pressing ⌥I."
              >💡</button>
              <button type="button"
                data-action="open-twin-window"
                data-twin-url="${_esc(twinSourcesUrl)}"
                data-concept-name="${_esc(conceptName)}"
                class="text-violet-600 hover:text-violet-900 hover:bg-violet-100 rounded px-1 py-0.5 text-[13px] leading-none transition-colors"
                title="📚 Sources &amp; Figures — open ${_esc(conceptName)} (*${_esc(conceptNumber)}) in a new window via Tom Gilb's Twin Consultant. Find book passages, chapter references, and figures from the corpus relating to this concept. Passwordless, free at-a-click; by Kai Gilb."
              >📚<span aria-hidden="true" class="text-[10px] opacity-70">↗</span></button>
              <span class="text-violet-400 text-[11px]" aria-hidden="true" title="Click anywhere on the row body to drill into this concept's Twin entry inside this panel (with back navigation).">↩</span>
            </span>`
          : ''
        html += `<td class="px-3 py-2 text-slate-800 border-b border-violet-100 align-top leading-relaxed">${_renderInline(cell)}${actionCluster}</td>`
      } else {
        html += `<td class="px-3 py-2 text-slate-800 border-b border-violet-100 align-top leading-relaxed">${_renderInline(cell)}</td>`
      }
    }
    html += `</tr>`
  }
  html += `</tbody></table></div></div>`
  return { html, consumed: j - i }
}

/**
 * r93f9 — Render a parsed bullet-concept-list (Tom Gilb 2026-06-13 "I have asked
 * for more interesting editing from all such text blobs"). The Twin sometimes
 * returns the Related Concepts section as a markdown bullet list rather than a
 * pipe table; this renderer gives that bullet list the same featured-card +
 * colour-coded + ✦-glyph + 💡/📚/↩ action-cluster treatment as the table form,
 * so both shapes produce a coherent visual centerpiece.
 */
interface ConceptListItem {
  name: string
  number: string
  description: string   // already raw markdown — passed through _renderInline
  urlOverride?: string  // optional explicit URL embedded in the bullet (overrides the synthesised /concept/Name.N)
}
function _renderConceptList(items: ConceptListItem[]): string {
  const ROW_ACCENTS = [
    'border-l-emerald-500 bg-emerald-50/30',
    'border-l-amber-500   bg-amber-50/30',
    'border-l-rose-500    bg-rose-50/30',
    'border-l-sky-500     bg-sky-50/30',
    'border-l-indigo-500  bg-indigo-50/30',
    'border-l-teal-500    bg-teal-50/30',
  ]
  let html = `<div class="my-4 rounded-xl ring-1 ring-violet-200 shadow-sm overflow-hidden bg-white">`
  html += `<ul class="divide-y divide-violet-100 list-none ml-0 my-0">`
  for (let r = 0; r < items.length; r++) {
    const it = items[r]
    const accent = ROW_ACCENTS[r % ROW_ACCENTS.length]
    const twinUrl = it.urlOverride
      ?? `https://www.gilb.com/tomtwin/concept/${it.name.trim().replace(/\s+/g, '-')}.${it.number}`
    const drillAttr = (it.name && it.number)
      ? ` data-concept-name="${_esc(it.name)}" data-concept-number="${_esc(it.number)}" role="link" tabindex="0" title="Click row to drill into ${_esc(it.name)} (*${_esc(it.number)}) inside this panel. Click 💡 to Illuminate via local Glossary + Twin. Click 📚 to open sources + book figures in a new window."`
      : ''
    html += `<li class="${accent} ${(it.name && it.number) ? 'cursor-pointer' : ''} border-l-4 hover:brightness-105 hover:shadow-sm transition-all px-3 py-2 leading-relaxed flex items-start gap-2"${drillAttr}>`
    // First column: ✦ glyph + bold name + concept number
    html += `<div class="shrink-0 inline-flex items-center gap-1.5 pt-0.5">
      <span aria-hidden="true" class="text-violet-500 text-[12px]">✦</span>
    </div>
    <div class="flex-1 min-w-0">
      <div class="text-slate-900 font-bold text-[12.5px] flex items-center gap-2 flex-wrap">
        <span class="min-w-0">${_renderInline(it.name)}</span>
        <a href="${_esc(twinUrl)}" target="_blank" rel="noopener" class="font-mono font-bold text-[11px] px-1.5 py-0 rounded-full bg-white ring-1 ring-violet-300 text-violet-700 hover:bg-violet-100 hover:ring-violet-500 transition-colors shrink-0" title="Open concept *${_esc(it.number)} in Tom Gilb's Twin Consultant (passwordless, free at-a-click — by Kai Gilb).">*${_esc(it.number)} ↗</a>
      </div>
      <div class="text-slate-700 text-[12px] mt-0.5 leading-relaxed">${_renderInline(it.description)}</div>
    </div>
    <!-- Action cluster: 💡 Illuminate, 📚 Sources, ↩ drill hint -->
    <span class="shrink-0 inline-flex items-center gap-1 pt-0.5">
      <button type="button"
        data-action="illuminate-concept"
        data-concept-name="${_esc(it.name)}"
        data-concept-number="${_esc(it.number)}"
        class="text-violet-600 hover:text-violet-900 hover:bg-violet-100 rounded px-1 py-0.5 text-[13px] leading-none transition-colors"
        title="💡 Illuminate (⌘I) — look up ${_esc(it.name)} (*${_esc(it.number)}) via the full Illuminate flow."
      >💡</button>
      <button type="button"
        data-action="open-twin-window"
        data-twin-url="${_esc(twinUrl)}"
        data-concept-name="${_esc(it.name)}"
        class="text-violet-600 hover:text-violet-900 hover:bg-violet-100 rounded px-1 py-0.5 text-[13px] leading-none transition-colors"
        title="📚 Sources &amp; Figures — open ${_esc(it.name)} (*${_esc(it.number)}) in a new window via Tom Gilb's Twin Consultant."
      >📚<span aria-hidden="true" class="text-[10px] opacity-70">↗</span></button>
      <span class="text-violet-400 text-[11px]" aria-hidden="true" title="Click row body to drill into this concept's Twin entry inside the panel.">↩</span>
    </span>`
    html += `</li>`
  }
  html += `</ul></div>`
  return html
}

/**
 * r93yyy — wrap the hoisted Related-Concepts table OR concept-list in a
 * featured-card chrome that makes it the visual centerpiece of the response.
 * Tom Gilb 2026-06-13: *"I love the diagram, and I think it should be front
 * and center, top or just after the main def, not an option, can we embellish
 * it w color or ?"*. r93f9 reuses this wrapper for the bullet-concept-list
 * shape too — same chrome, same visual hierarchy.
 */
function _wrapFeaturedTable(tableHtml: string): string {
  return `<section class="my-4 rounded-2xl ring-2 ring-violet-300 shadow-md overflow-hidden bg-white">
    <header class="px-4 py-2.5 bg-gradient-to-r from-violet-700 via-violet-600 to-indigo-700 text-white flex items-center gap-2.5">
      <span class="text-[18px] leading-none" aria-hidden="true">✦</span>
      <div class="flex-1 min-w-0">
        <div class="text-[11px] font-extrabold uppercase tracking-[0.18em] leading-none">Related Concepts</div>
        <div class="text-[10.5px] opacity-85 mt-0.5 leading-snug italic">Click any <span class="font-mono font-bold">*NNN</span> to open the canonical Glossary entry in Tom Gilb's Twin Consultant — passwordless, free at-a-click.</div>
      </div>
    </header>
    <div class="px-1.5 pb-1.5">${tableHtml.replace(/^<div class="my-4 [^>]*>/, '<div class="mt-0 mb-0">').replace(/<\/div>$/, '')}</div>
  </section>`
}

/**
 * Main entry point — converts a Twin-flavoured Markdown string into safe
 * styled HTML suitable for `v-html` rendering inside a Vue template.
 *
 * r93yyy two-pass strategy: pass 1 parses every block into a typed segment;
 * pass 2 HOISTS the first table to the front of the response (right after
 * the first `---` HR, or right after the opening definition pills if no HR
 * appears), wraps it in the featured-card chrome, and skips the original
 * `## Related Concepts` heading + the original table position. Net effect:
 * the table becomes the visual centerpiece immediately after the main
 * definition, exactly where Tom wants it.
 */
export function renderTwinMarkdown(raw: string): string {
  if (!raw) return ''

  // STEP 1 — build the concept-name lookup map from the ORIGINAL text (we want
  // to read the markdown table verbatim before escaping mangles its pipes).
  const nameMap = _scanConceptNameMap(raw)

  // STEP 2 — escape ALL HTML entities so nothing the Twin returned can inject
  // markup. From here on, we add only HTML we ourselves construct.
  const lines = _esc(raw).split('\n')

  // STEP 3 — first pass: line-by-line block parse into typed segments so we
  // can reorder for hoisting in pass 2.
  // r93f9 adds `conceptList` (bullet list of `**Name** (*NNN) — description`
  // items) as a featured-card-able segment alongside `table`.
  type Segment =
    | { kind: 'h1' | 'h2' | 'h3'; html: string; text: string }
    | { kind: 'kvPill'; html: string }
    | { kind: 'table'; html: string; precedingHeading?: string }
    | { kind: 'conceptList'; html: string; precedingHeading?: string }
    | { kind: 'hr'; html: string }
    | { kind: 'para'; html: string }
    | { kind: 'list'; html: string }
  const segments: Segment[] = []
  let para: string[] = []
  let list: string[] = []

  const flushPara = () => {
    if (para.length === 0) return
    const joined = para.join(' ')
    segments.push({ kind: 'para', html: `<p class="my-2 text-slate-800 leading-relaxed">${_renderInline(joined)}</p>` })
    para = []
  }
  const flushList = () => {
    if (list.length === 0) return
    segments.push({ kind: 'list', html: `<ul class="list-disc ml-5 my-2 space-y-1 text-slate-800">${list.map(li => `<li>${_renderInline(li)}</li>`).join('')}</ul>` })
    list = []
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // Blank line — flush whatever we were building
    if (!trimmed) {
      flushPara(); flushList(); continue
    }

    // Horizontal rule — soft violet-300 gradient hairline
    if (/^[-*_]{3,}\s*$/.test(trimmed)) {
      flushPara(); flushList()
      segments.push({ kind: 'hr', html: `<hr class="my-5 border-0 h-px bg-gradient-to-r from-transparent via-violet-300 to-transparent">` })
      continue
    }

    // Heading (#, ##, ###)
    const hMatch = /^(#{1,6})\s+(.*)$/.exec(trimmed)
    if (hMatch) {
      flushPara(); flushList()
      const level = hMatch[1].length
      const text = hMatch[2]
      let html: string
      if (level === 1) {
        html = `<h2 class="text-[22px] font-black bg-gradient-to-r from-violet-700 to-indigo-700 bg-clip-text text-transparent mt-5 mb-3 leading-tight tracking-tight pb-1.5 border-b-2 border-violet-200">${_renderInline(text)}</h2>`
        segments.push({ kind: 'h1', html, text })
      } else if (level === 2) {
        html = `<h3 class="text-[16px] font-extrabold text-violet-800 mt-5 mb-2.5 leading-tight pl-3 border-l-4 border-violet-500 rounded-l-sm">${_renderInline(text)}</h3>`
        segments.push({ kind: 'h2', html, text })
      } else {
        html = `<h4 class="text-[13px] font-bold uppercase tracking-wider text-violet-700 mt-3 mb-1.5">${_renderInline(text)}</h4>`
        segments.push({ kind: 'h3', html, text })
      }
      continue
    }

    // Pipe table
    if (/^\s*\|/.test(trimmed) && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] ?? '')) {
      flushPara(); flushList()
      const { html, consumed } = _renderTable(lines, i)
      if (consumed > 0) {
        // Capture the preceding h2 (if any) so pass 2 can skip it when hoisting.
        const lastSeg = segments[segments.length - 1]
        const precedingHeading = lastSeg?.kind === 'h2' ? lastSeg.text : undefined
        segments.push({ kind: 'table', html, precedingHeading })
        i += consumed - 1
        continue
      }
    }

    // r93g0 — Bare-URL bullet pattern: `- https://www.gilb.com/tomtwin/concept/Name.NNN`
    // The Twin sometimes emits a "## Concept URLs" section with bare URLs only
    // (no `**Name** (*NNN)` prefix). Detect these as concept items and render
    // with the same featured-card treatment. We parse Name + NNN out of the URL.
    const bareUrlBulletRe = /^\s*[-*+]\s+(https?:\/\/(?:www\.)?gilb\.com\/tomtwin\/concept\/([A-Za-z][A-Za-z0-9\-]*?)\.(\d{2,4}[a-z]?))\s*$/
    const bareUrlHere = bareUrlBulletRe.exec(line)
    if (bareUrlHere) {
      const urlItems: ConceptListItem[] = []
      let j = i
      while (j < lines.length) {
        const m = bareUrlBulletRe.exec(lines[j])
        if (!m) break
        urlItems.push({
          name: m[2].replace(/-/g, ' '),
          number: m[3],
          description: '',
          urlOverride: m[1],
        })
        j++
        if (j < lines.length && !lines[j].trim()) break
      }
      if (urlItems.length >= 1) {
        flushPara(); flushList()
        const html = _renderConceptList(urlItems)
        const lastSeg = segments[segments.length - 1]
        const precedingHeading = lastSeg?.kind === 'h2' ? lastSeg.text : undefined
        segments.push({ kind: 'conceptList', html, precedingHeading })
        i = j - 1
        continue
      }
    }

    // r93f9 — Bullet-list-of-concepts pattern: lookahead for a run of
    //   - **Name** (*NNN) — description
    //   - **Name** (*NNN) — [URL] — description
    // bullets. If at least 2 consecutive bullets match the pattern, render
    // the entire run as a featured concept-list (mirrors the table treatment).
    const conceptBulletRe = /^\s*[-*+]\s+\*\*([^*]+?)\*\*(?:\s*\(\*(\d{2,4})\))?\s*(?:—|–|-)?\s*(.*)$/
    const conceptHere = conceptBulletRe.exec(line)
    if (conceptHere && conceptHere[2]) {
      // Look ahead — collect ALL consecutive concept bullets
      const items: ConceptListItem[] = []
      let j = i
      while (j < lines.length) {
        const cl = lines[j]
        const m = conceptBulletRe.exec(cl)
        if (!m || !m[2]) break
        // Extract optional URL embedded in the description body
        let descBody = m[3].trim()
        const urlMatch = /^(https?:\/\/[^\s]+)\s*(?:—|–|-)\s*(.*)$/.exec(descBody)
        let urlOverride: string | undefined
        if (urlMatch) {
          urlOverride = urlMatch[1]
          descBody = urlMatch[2]
        }
        items.push({
          name: m[1].trim(),
          number: m[2],
          description: descBody,
          urlOverride,
        })
        j++
        // Stop if next line is blank — allows tight clustering of concept bullets
        if (j < lines.length && !lines[j].trim()) break
      }
      if (items.length >= 2) {
        flushPara(); flushList()
        const html = _renderConceptList(items)
        // Capture the preceding h2 (if any — typically "Related concepts" or
        // similar) so pass 2 can skip it when hoisting (the featured-card
        // chrome already carries that headline).
        const lastSeg = segments[segments.length - 1]
        const precedingHeading = lastSeg?.kind === 'h2' ? lastSeg.text : undefined
        // Also catch the "Related concepts:" plain-paragraph form
        let absorbedPrecedingPara: number | null = null
        if (lastSeg?.kind === 'para' && /^<p[^>]*>(?:<strong[^>]*>)?[Rr]elated [Cc]oncepts:?(?:<\/strong>)?<\/p>$/.test(lastSeg.html)) {
          absorbedPrecedingPara = segments.length - 1
        }
        if (absorbedPrecedingPara !== null) segments.splice(absorbedPrecedingPara, 1)
        segments.push({ kind: 'conceptList', html, precedingHeading })
        i = j - 1
        continue
      }
      // Fall through to generic bullet if only one matched.
    }

    // Bullet list item
    const liMatch = /^\s*[-*+]\s+(.+)$/.exec(line)
    if (liMatch) {
      flushPara()
      list.push(liMatch[1])
      continue
    }

    // "Key: value" definition-list pattern — gradient pill.
    // r93g0 — extended label char class to include `'` (e.g. "Tom's formulation:")
    // and `/` (e.g. "Key/Value:") that the Twin actually emits but pre-r93g0 fell
    // through to plain paragraph. The first character still requires [A-Z] so
    // mid-sentence `**bold**:` runs aren't mis-promoted to KV pills.
    const kvMatch = /^\*\*([A-Z][A-Za-z0-9 '/\-]*?):\*\*\s+(.+)$/.exec(trimmed)
    if (kvMatch) {
      flushPara(); flushList()
      const key = _renderInline(kvMatch[1])
      const value = _renderInline(kvMatch[2])
      segments.push({ kind: 'kvPill', html: `<div class="my-2 rounded-lg bg-gradient-to-r from-violet-50 to-indigo-50/40 ring-1 ring-violet-200 px-3 py-2 flex items-baseline gap-2.5 flex-wrap">
        <span class="text-[10.5px] font-extrabold uppercase tracking-widest text-violet-700 shrink-0">${key}</span>
        <span class="text-[12.5px] text-slate-800 leading-relaxed flex-1 min-w-0">${value}</span>
      </div>` })
      continue
    }

    // Plain paragraph text
    flushList()
    para.push(trimmed)
  }
  flushPara(); flushList()

  // STEP 3.5 — PASS 2: hoist the FIRST featured segment (table OR conceptList,
  // r93f9 + r93yyy) to the front, right after the first hr (or right after the
  // trailing kvPill block if no hr appears). Skip the original `## Related
  // Concepts` heading + the original position. The hoisted segment is wrapped
  // in the featured-card chrome.
  const featuredIdx = segments.findIndex(s => s.kind === 'table' || s.kind === 'conceptList')
  const out: string[] = []
  if (featuredIdx >= 0) {
    const featuredSeg = segments[featuredIdx] as Extract<Segment, { kind: 'table' | 'conceptList' }>
    const precedingHeadingText = featuredSeg.precedingHeading
    // Find insertion target: first hr; else after last kvPill; else after h1.
    const hrIdx = segments.findIndex(s => s.kind === 'hr')
    let insertAfter: number
    if (hrIdx >= 0 && hrIdx < featuredIdx) {
      insertAfter = hrIdx
    } else {
      // last kvPill before the featured segment
      let lastKv = -1
      for (let k = 0; k < featuredIdx; k++) if (segments[k].kind === 'kvPill') lastKv = k
      if (lastKv >= 0) insertAfter = lastKv
      else {
        // first h1
        const h1Idx = segments.findIndex(s => s.kind === 'h1')
        insertAfter = h1Idx >= 0 ? h1Idx : -1
      }
    }
    // Build the emit order: segments[0..insertAfter], featured-card, then the
    // rest excluding the original position + its preceding "Related Concepts" h2.
    for (let k = 0; k <= insertAfter; k++) out.push(segments[k].html)
    out.push(_wrapFeaturedTable(featuredSeg.html))
    for (let k = insertAfter + 1; k < segments.length; k++) {
      if (k === featuredIdx) continue
      const seg = segments[k]
      // Skip the `## Related Concepts` heading immediately before the original
      // featured position (we've absorbed it into the featured-card title).
      if (seg.kind === 'h2'
          && precedingHeadingText
          && seg.text.trim() === precedingHeadingText.trim()
          && k === featuredIdx - 1) {
        continue
      }
      out.push(seg.html)
    }
  } else {
    // No featured segment — emit segments in original order
    for (const seg of segments) out.push(seg.html)
  }

  // STEP 4 — linkify URLs + concept numbers across the entire constructed HTML
  // (the substitution targets are still raw text inside our tags, never tag
  // attributes, so it's safe).
  let html = out.join('\n')
  html = _linkifyUrls(html)
  html = _linkifyConceptNumbers(html, nameMap)

  return html
}
