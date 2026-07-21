// UNIT_TYPE=Hook
// usePlanInput — Parse any existing plan document into a Planguage SpecBlock.
//
// Supported inputs:
//   text   — plain pasted text (any format)
//   url    — public web page (direct fetch or allorigins.win CORS proxy)
//   file   — .pdf  (text extracted via pdfjs-dist in local mode; native document API in Anthropic mode)
//            .docx (text extracted via mammoth, then AI-parsed)
//            .txt / .md / .rtf / .html / .csv and other text types
//            .doc  (unsupported — user prompted to save as .docx)
//
// AI parsing prompt mirrors the CE methodology so the resulting SpecBlock
// matches the format produced by useSDK.translate().

// r41 v184 — Tom Gilb 2026-06-19 verbatim "this is totally screwed up and
// unnecessary to via claudian at all. just let the input in as usual".
// REVERSAL of v177 Claudian-routed migration for Plan Importer.  The
// direct-Anthropic-call path is restored.  The Claudian-routed helpers
// (buildClaudianParsePrompt etc.) stay in this file as opt-in alternatives
// — exported but not the default flow.  Trade-off (banked): the rate-limit
// cliff that caused yesterday's Google LLC failure can return here too.
// Tom has accepted that risk in exchange for removing the round-trip
// friction.  Claude-Code-as-AI-Layer SUPREME rule is therefore CARVED-OUT
// for Plan Importer per Tom's explicit waiver.
import { ref } from 'vue'
import Anthropic from '@anthropic-ai/sdk'
import { MODEL_ID } from '../config/llm'
import { CANONICAL_PLANGUAGE_DISCIPLINE_PROMPT } from '../config/planguagePrompt'
import type { SpecBlock, FEntry, VEntry, SEntry, CEntry, REntry } from '../types/spec'
import { stampEntries } from '../utils/sourceStamp'

// apiKey is optional in local mode — the ollamaAdapter ignores it entirely
const _client = new Anthropic({
  apiKey:                    (import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined) ?? 'local',
  dangerouslyAllowBrowser:   true,
  timeout:                   90_000,
})

const _MOCK_MODE = import.meta.env.VITE_MOCK_MODE === 'true'

export type PlanInputMode = 'text' | 'url' | 'file'

// ── Module-level reactive state ────────────────────────────────────────────────

export const planInputLoading  = ref(false)
export const planInputError    = ref('')
/** Short status message shown while multi-step extraction is running */
export const planInputProgress = ref('')

/** Loading / error state for the Merge Plans AI call — separate from planInputLoading. */
export const mergeLoading = ref(false)
export const mergeError   = ref('')

// ── URL extraction ─────────────────────────────────────────────────────────────

/**
 * Fetch a public URL and return its readable text content.
 * Tries direct fetch first; falls back to allorigins.win CORS proxy.
 */
export async function extractFromUrl(url: string): Promise<string> {
  planInputProgress.value = 'Fetching page…'

  // Direct fetch (works for CORS-enabled or same-origin pages)
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (res.ok) {
      const html = await res.text()
      return _htmlToText(html)
    }
  } catch { /* CORS blocked — fall through */ }

  // Proxy fallback
  planInputProgress.value = 'Fetching via proxy…'
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`
  const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(20_000) })
  if (!res.ok) {
    throw new Error(
      `Could not fetch the page (HTTP ${res.status}). ` +
      `If the URL is behind a login, copy-paste the content into the text tab instead.`,
    )
  }
  const data = (await res.json()) as { contents: string }
  return _htmlToText(data.contents)
}

function _htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('script,style,nav,header,footer,aside,iframe,[aria-hidden]').forEach(el => el.remove())
  const text = doc.body?.innerText ?? doc.documentElement.textContent ?? ''
  return text
    .replace(/\t/g, ' ')
    .replace(/[ ]{3,}/g, '  ')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
}

// ── File extraction ────────────────────────────────────────────────────────────

export interface FileExtractionResult {
  /** Extracted plain text. Non-empty for all formats including PDFs (in local mode, pdfjs-dist extracts the text). */
  text: string
  /** True only in Anthropic mode for PDFs — use pdfBase64 with the native documents API */
  isPdf: boolean
  /** Base-64 encoded PDF bytes — only set when isPdf is true (Anthropic mode only) */
  pdfBase64?: string
}

/**
 * Extract readable content from an uploaded file.
 * PDFs are returned as base-64 for native Anthropic document handling (no local PDF parser).
 * .docx files are extracted via mammoth (dynamically imported).
 * All other types are read as UTF-8 text.
 */
export async function extractFromFile(file: File): Promise<FileExtractionResult> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''

  // ── PDF: text extraction (local mode) or base-64 (Anthropic mode) ───────────
  //
  // Local mode:     pdfjs-dist extracts the text page-by-page in the browser.
  //                 pdfjs-dist is already in package.json and excluded from
  //                 esbuild pre-bundling in vite.config.ts; dynamic import works.
  //
  // Anthropic mode: pass base-64 to the native documents API — Claude reads the
  //                 PDF natively (richer than extracted text: layout, tables, etc.).
  if (ext === 'pdf') {
    // r41 v184 — PDF handling restored to the v176-era branched behaviour:
    //   • Anthropic mode (key present): base-64 to the native documents API
    //     — Claude reads the PDF natively including scanned/image PDFs via
    //     its visual document understanding.
    //   • Local mode (no key): pdfjs-dist extracts text page-by-page (only
    //     works on text-layer PDFs; scanned PDFs return empty).
    if (import.meta.env.VITE_ANTHROPIC_API_KEY) {
      planInputProgress.value = 'Reading PDF…'
      const buf = await file.arrayBuffer()
      const bytes = new Uint8Array(buf)
      let binary = ''
      const CHUNK = 8192
      for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
      }
      const pdfBase64 = btoa(binary)
      // r41 v219 (Tom Gilb 2026-06-19 — Indianapolis CL-35 contract parse
      // failure screenshot).  ALSO extract text via pdfjs-dist as a BACKUP
      // so the parser has a fallback when Claude's native PDF API returns
      // 0 entries (typical for narrative/legal documents where there are
      // no measurable claims to extract).  When parseAsPlanguage finds the
      // AI returned nothing useful, it can wrap this backup text as ONE
      // V.ImportedText entry so the planner sees the review grid + can
      // sharpen forward instead of hitting a dead-end error.  Non-fatal:
      // if pdfjs-dist fails (corrupt PDF, scanned image without OCR), we
      // still send the base64 to Claude and let the AI try.
      let backupText = ''
      try {
        planInputProgress.value = 'Extracting backup text from PDF…'
        const pdfjs = await import('pdfjs-dist')
        // r41 2026-06-20 (Tom Gilb verbatim "parse failed but file
        // accepted") — was `new URL('pdfjs-dist/build/pdf.worker.min.js',
        // import.meta.url).href` which fails silently for Vite-bundled
        // workers in dev + prod (worker file not actually resolved).
        // Switched to the public-folder strategy `/pdf.worker.js` that
        // useDocumentImport.ts (used by the Contracts agent) uses
        // successfully — same Indianapolis PDF that fails here imports
        // correctly via Contracts.  Composes with: Trace-Before-Patch
        // SUPREME (traced the divergence between the two PDF extraction
        // paths before patching either symptom), No-Silent-Data-Loss
        // SUPREME (the silent worker failure produced an empty extract,
        // making the user-facing "scanned image" error wildly misleading
        // when the PDF was perfectly readable).
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.js'
        const pdf = await pdfjs.getDocument({ data: buf }).promise
        const pageTexts: string[] = []
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)
          const content = await page.getTextContent()
          pageTexts.push(
            content.items
              .map((item) => ('str' in item ? (item as { str: string }).str : ''))
              .join(' '),
          )
        }
        backupText = pageTexts.join('\n\n').trim()
      } catch (err) {
        // Scanned PDF or pdfjs failure — just leave backupText empty.
        console.warn('[extractFromFile] pdfjs backup extraction failed:', err)
      }
      return { text: backupText, isPdf: true, pdfBase64 }
    }
    planInputProgress.value = 'Extracting text from PDF…'
    const pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.js',
      import.meta.url,
    ).href
    const buf = await file.arrayBuffer()
    const pdf = await pdfjs.getDocument({ data: buf }).promise
    const pageTexts: string[] = []
    for (let i = 1; i <= pdf.numPages; i++) {
      planInputProgress.value = `Extracting PDF — page ${i} of ${pdf.numPages}…`
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      pageTexts.push(
        content.items
          .map((item) => ('str' in item ? (item as { str: string }).str : ''))
          .join(' '),
      )
    }
    return { text: pageTexts.join('\n\n'), isPdf: false }
  }

  // ── Word .docx: extract via mammoth ──────────────────────────────────────────
  if (ext === 'docx') {
    planInputProgress.value = 'Reading Word document…'
    // Dynamic import keeps mammoth out of the initial bundle
    const mod = await import('mammoth')
    const mammoth = (mod as unknown as { default?: typeof mod }).default ?? mod
    const buf = await file.arrayBuffer()
    const { value } = await mammoth.extractRawText({ arrayBuffer: buf })
    return { text: value, isPdf: false }
  }

  // ── Legacy .doc: unsupported ──────────────────────────────────────────────────
  if (ext === 'doc') {
    throw new Error(
      '.doc (old Word format) is not supported. ' +
      'Open in Word / Pages, save as .docx, then re-import — or paste the content directly.',
    )
  }

  // ── HTML: strip tags before sending to LLM ──────────────────────────────────
  // Raw HTML contains thousands of chars of CSS, attribute noise, and markup
  // that swamp the LLM context and make Planguage extraction unreliable.
  // _htmlToText() removes scripts/styles and returns innerText so the LLM
  // receives clean prose and table content — the same path used for URL fetch.
  if (['html', 'htm'].includes(ext)) {
    planInputProgress.value = 'Extracting text from HTML…'
    return new Promise<FileExtractionResult>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = e => {
        const raw = (e.target?.result as string) ?? ''
        resolve({ text: _htmlToText(raw), isPdf: false })
      }
      reader.onerror = () => reject(new Error('Could not read the file. Try copy-pasting the content instead.'))
      reader.readAsText(file)
    })
  }

  // ── Plain text: .txt .md .rtf .csv and anything else ─────────────────────────
  planInputProgress.value = 'Reading file…'
  return new Promise<FileExtractionResult>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = e => resolve({ text: (e.target?.result as string) ?? '', isPdf: false })
    reader.onerror = () => reject(new Error('Could not read the file. Try copy-pasting the content instead.'))
    reader.readAsText(file)
  })
}

// ── AI parsing ─────────────────────────────────────────────────────────────────

// r41 v270 (Tom Gilb 2026-06-21 SUPREME — Canonical Planguage Extractor —
// Single Source of Truth): replaced the prior 53-line _PARSE_PROMPT (which
// used BANNED F.PascalCase IDs per the Planguage Mnemonic ID Standard
// SUPREME — Tom: "I do not like the V1 F1 stuff at all, I have tried to
// ban it"; AND was missing F-vs-Meter rule, V-parameter-rich requirement,
// Solution 26-parameter inventory, Qualifier framework, Infinity Trap, etc.)
// with the canonical primer.  Plan Importer is the path that produced the
// 4 June 2026 Monitor case (the gold-standard rich Planguage output Tom
// remembers); this restoration brings it forward to the current canonical.
const _PARSE_PROMPT = `You are a Competitive Engineering consultant trained in Tom Gilb's Planguage methodology.

== PLAN-DOCUMENT INPUT FORMAT (input shape for this caller) ==
The input you will receive is a plan DOCUMENT — slide deck, business brief,
OKR/DOVE framework, roadmap, strategy doc, or rough notes. Parse it into a
structured Planguage specification per the canonical discipline below.

BALANCE MANDATE (CRITICAL — if violated, the parse has failed):
  You MUST produce ≥3 F. entries, ≥4 V. entries, and ≥3 S. entries when the
  source has more than one paragraph. If you produce only F. entries (and no
  V. or S.), you have fundamentally mis-parsed. If you produce only V.
  entries (and no F. or S.), you have fundamentally mis-parsed. A well-parsed
  slide deck or strategic plan will ALWAYS have all three types. If you
  cannot find them explicitly, INFER them from context — that is the job of
  a CE consultant.

DOVE/OKR mapping (frame-specific):
  • "objective" → V.description + paired F. entry
  • "key result with number" → V.goal
  • current state → V.status (only if real measured data; never invent)
  • "initiatives" / "approaches" / "tools" / "methods" → S. entries
  • allocated budget amounts → R. entries (use 'budget' not 'goal' or 'wish')

DO NOT model people, teams, departments, or organisations as separate
entries. They appear in stakeholder entries and as wishStakeholder values
on V. entries.

${CANONICAL_PLANGUAGE_DISCIPLINE_PROMPT}

== OUTPUT JSON SHAPE (caller-specific) ==
Return ONLY valid JSON — no markdown fences, no explanation, no prose outside
the JSON. Field shape:
{
  "functions": [
    {"id":"Mnemonic Words","type":"Function","level":"Product","description":"...","successCriteria":"binary yes/no test","functionOfValue":"Mnemonic Words"}
  ],
  "values": [
    {"id":"Mnemonic Words","type":"Value","level":"Product","description":"...","scale":"unit of measurement","meter":"how measured","tolerable":"minimum acceptable","goal":"target","wish":"stakeholder dream","valueOfFunction":"Mnemonic Words","wishStakeholder":"who wants this"}
  ],
  "solutions": [
    {"id":"Mnemonic Words","type":"Solution","level":"Product","description":"...","derivedFrom":"[[V.Tag1]], [[V.Tag2]]","function":"[[F.Tag]]","mainImpacts":"[[V.Tag1]] ~target","status":"NotProduction"}
  ]
}

Cross-links mandatory: F.functionOfValue → V.id; V.valueOfFunction → F.id;
S.function → F.id. Use the EXACT id strings (mnemonic words, no PascalCase,
no V1/F1/S1 — see id format rule in the canonical discipline above).`

export interface ParseOptions {
  /** Kept for back-compat with callers; ignored by the new Claudian-routed
   *  flow.  PDF text is always pre-extracted by `extractFromFile()` and
   *  passed as plain text to the prompt builder. */
  isPdf?:     boolean
  pdfBase64?: string
}

/** Where Claudian writes the batch parse result when running against the
 *  sem-app repo.  Vite serves `public/` at the root, so a browser fetch
 *  for `/data/getAPlanResult.json` reads what Claudian wrote on disk. */
const PARSE_RESULT_FILE_URL = '/data/getAPlanResult.json'

/**
 * r41 v177 — Build a paste-ready Claudian prompt for parsing extracted plan
 * text into a Planguage Representation.  Pure function; no side effects;
 * caller decides whether to copy to clipboard or display in a textarea.
 *
 * The previous `parseAsPlanguage()` (embedded Anthropic call) is replaced
 * by this prompt builder + the paste-back / refresh-from-disk handoff
 * implemented in `applyClaudianParseResult()` and `loadParseResultFromDisk()`.
 */
export function buildClaudianParsePrompt(rawText: string): string {
  const trimmed = rawText.slice(0, 14_000)
  return `${_PARSE_PROMPT}

PLAN DOCUMENT (extracted text):
---
${trimmed}
---

Return the Planguage Representation in the exact shape above.  When called as part of a batch, write the combined result to:
  sem-app/public/data/getAPlanResult.json
in the shape:
{
  "generatedAt": "<ISO timestamp>",
  "spec": { "functions": [...], "values": [...], "solutions": [...] }
}
The planner will click "Refresh from disk" in the panel to pull it in.`
}

/**
 * r41 v177 — Mark the panel as awaiting Claudian, build the prompt for the
 * given extracted text, and best-effort-copy it to the system clipboard.
 * Returns the prompt so the panel can also display it in a textarea (the
 * paste-back fallback when clipboard permission is denied).
 */
export async function requestClaudianParse(rawText: string): Promise<string> {
  const prompt = buildClaudianParsePrompt(rawText)
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(prompt)
    }
  } catch {
    // intentional swallow — fallback is the panel textarea
  }
  return prompt
}

/**
 * r41 v177 — Robust Planguage-result extractor.  Accepts a raw paste that
 * may include markdown fences, surrounding prose, or just the bare
 * structured-data form.  Throws a clear error on parse failure.
 */
function _extractStructuredResult<T>(text: string): T {
  const stripped = text.replace(/^```(?:json|pl|planguage)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  try { return JSON.parse(stripped) as T } catch { /* fall through */ }
  try { return JSON.parse(text.trim()) as T } catch { /* fall through */ }
  const objMatch = stripped.match(/\{[\s\S]*\}/)
  if (objMatch) { try { return JSON.parse(objMatch[0]) as T } catch { /* fall through */ } }
  throw new Error('Could not extract a valid Planguage result from the pasted text.')
}

/** Shape the parser produces.  Validated field-by-field after extraction. */
type ParsedShape = {
  functions?: Array<Record<string, string>>
  values?:    Array<Record<string, string>>
  solutions?: Array<Record<string, string>>
}

/** Validate + coerce the parsed Planguage Representation into a SpecBlock.
 *  Returns null when nothing usable was found (matches the v176 contract
 *  callers already handle). */
function _coerceParsedSpec(parsed: ParsedShape): SpecBlock | null {
  const functions: FEntry[] = (parsed.functions ?? []).map(f => ({
    id:              f.id              ?? '',
    type:            (f.type as FEntry['type']) ?? 'Function',
    level:           (f.level as FEntry['level']) ?? 'Product',
    description:     f.description     ?? '',
    successCriteria: f.successCriteria ?? '',
    functionOfValue: f.functionOfValue ?? '',
  }))

  const values: VEntry[] = (parsed.values ?? []).map(v => ({
    id:              v.id              ?? '',
    type:            (v.type as VEntry['type']) ?? 'Value',
    level:           (v.level as VEntry['level']) ?? 'Product',
    description:     v.description     ?? '',
    scale:           v.scale           ?? '',
    meter:           v.meter           ?? '',
    status:          (v.status as VEntry['status']) ?? 'pre-build',
    tolerable:       v.tolerable       ?? '',
    goal:            v.goal            ?? '',
    valueOfFunction: v.valueOfFunction ?? '',
  }))

  const solutions: SEntry[] = (parsed.solutions ?? []).map(s => ({
    id:          s.id          ?? '',
    type:        (s.type as SEntry['type']) ?? 'Solution',
    level:       (s.level as SEntry['level']) ?? 'Product',
    description: s.description ?? '',
    impact:      s.impact      ?? '',
    function:    s.function    ?? '',
  }))

  if (!functions.length && !values.length) return null
  return { functions, values, solutions }
}

/**
 * r41 v177 — Apply a Planguage Representation that Claudian produced.
 * Accepts the raw paste; extracts + validates + coerces into a SpecBlock.
 * Throws a clear error on parse failure so the panel can show a friendly
 * banner; returns null only when the document genuinely contained no
 * Functions and no Values (a methodology-level failure, not a parse failure).
 */
export function applyClaudianParseResult(pastedText: string): SpecBlock | null {
  // Accept both the bare spec shape `{ functions, values, solutions }` AND
  // the batch-file shape `{ generatedAt, spec: { ... } }`.
  const raw = _extractStructuredResult<ParsedShape & { spec?: ParsedShape }>(pastedText)
  const candidate: ParsedShape = (raw && typeof raw === 'object' && raw.spec)
    ? raw.spec
    : raw

  return _coerceParsedSpec(candidate)
}

/**
 * r41 v177 — Fetch the batch parse result Claudian writes at
 * `public/data/getAPlanResult.json`.  Returns the coerced SpecBlock when
 * the file exists and contains a valid Planguage Representation; returns
 * `{ spec: null, reason }` otherwise so the panel can show a plain-English
 * banner.
 */
export async function loadParseResultFromDisk(): Promise<{ spec: SpecBlock | null; reason?: string }> {
  let res: Response
  try {
    res = await fetch(PARSE_RESULT_FILE_URL, { cache: 'no-store' })
  } catch (err) {
    return { spec: null, reason: `Could not fetch the result file (${err instanceof Error ? err.message : 'network error'}).` }
  }
  if (!res.ok) {
    return { spec: null, reason: 'No result file on disk yet — Claudian has not written one.  Ask Claudian to parse the document and write to public/data/getAPlanResult.json.' }
  }
  let body: unknown
  try {
    body = await res.json()
  } catch {
    return { spec: null, reason: 'The result file exists but is not a valid Planguage Representation.' }
  }
  type BatchShape = { generatedAt?: string; spec?: ParsedShape } & ParsedShape
  const batch = body as BatchShape
  const candidate: ParsedShape = batch.spec ?? batch
  const spec = _coerceParsedSpec(candidate)
  if (!spec) return { spec: null, reason: 'The result file did not contain any Functions or Values.' }
  return { spec }
}

/**
 * LOCAL DETERMINISTIC PARSER for already-tagged Planguage input.  Scans for
 * canonical entry-type markers at line starts in the form
 *   `<EntryType>.<MnemonicTag>: <body>`
 * where EntryType is one of Function / Value / Solution / Constraint /
 * Resource (or the single-letter shorthand the regex below also accepts
 * for back-compat with legacy files) and MnemonicTag is a real mnemonic
 * name (1–3 words like "Search Latency", "GDPR Compliance" — per the
 * Planguage Mnemonic Tag rule, NEVER placeholder words).
 *
 * Body text after each marker line continues until the next marker or EOF.
 * Bulk text WITHOUT markers is handled by the AI-extraction path in
 * `parseAsPlanguage()` below — not by this local parser.
 *
 * Spell-out-Type-Names rule (Tom Gilb): in user-visible text, use the
 * full word — Function, Value, Solution, Constraint, Resource.  The
 * single-letter regex shorthand below is a legacy I/O accommodation, not
 * a UI convention.
 */
function _parseLocalText(rawText: string): SpecBlock {
  const text = (rawText ?? '').trim()
  const empty: SpecBlock = { functions: [], values: [], solutions: [], constraints: [], resources: [] }
  if (!text) return empty

  // Scan for Planguage tag patterns at line starts: F.Name: / V.Name: etc.
  // Body text continues until the next tag or end of document.
  type Block = { kind: 'F' | 'V' | 'S' | 'C' | 'R'; tag: string; body: string[] }
  const blocks: Block[] = []
  let current: Block | null = null
  const TAG_RE = /^\s*([FVSCR])\.\s*([A-Za-z][A-Za-z0-9 _-]{0,60})\s*:\s*(.*)$/

  for (const line of text.split(/\r?\n/)) {
    const m = line.match(TAG_RE)
    if (m) {
      if (current) blocks.push(current)
      current = { kind: m[1] as Block['kind'], tag: m[2].trim().replace(/\s+/g, ' '), body: m[3] ? [m[3]] : [] }
    } else if (current) {
      current.body.push(line)
    }
  }
  if (current) blocks.push(current)

  const out: SpecBlock = { functions: [], values: [], solutions: [], constraints: [], resources: [] }

  for (const b of blocks) {
    const desc = b.body.join(' ').replace(/\s+/g, ' ').trim().slice(0, 600)
    const id = `${b.kind}.${b.tag}`
    switch (b.kind) {
      case 'F':
        out.functions.push({
          id, type: 'Function', level: 'Product', description: desc,
          successCriteria: '', functionOfValue: '',
        } as FEntry)
        break
      case 'V':
        out.values.push({
          id, type: 'Value', level: 'Product', description: desc,
          scale: '', meter: '', status: 'pre-build',
          tolerable: '', goal: '', valueOfFunction: '',
        } as VEntry)
        break
      case 'S':
        out.solutions.push({
          id, type: 'Solution', level: 'Product', description: desc,
          impact: '', function: '',
        } as SEntry)
        break
      case 'C':
        (out.constraints as CEntry[]).push({
          id, type: 'Constraint', level: 'Product', description: desc,
          scope: '', rationale: '',
        } as CEntry)
        break
      case 'R':
        (out.resources as REntry[]).push({
          id, type: 'Resource', level: 'Product', description: desc,
          scale: '', meter: '', status: 'pre-build',
          tolerable: '', goal: '',
        } as REntry)
        break
    }
  }

  // Fallback — no structured tags detected.  Wrap the bulk text as ONE
  // Value entry so the planner can keep moving; Sharpening fills the
  // structural parameters later.  Per Tom's verbatim "parse it and
  // move on" — no friction, the imported text lands as data.
  const total = out.functions.length + out.values.length + out.solutions.length
              + (out.constraints?.length ?? 0) + (out.resources?.length ?? 0)
  if (total === 0) {
    const snippet = text.length > 600 ? text.slice(0, 600).trim() + '…' : text.trim()
    out.values.push({
      id: 'V.ImportedText',
      type: 'Value', level: 'Product',
      description: snippet,
      scale: '', meter: '', status: 'pre-build',
      tolerable: '', goal: '', valueOfFunction: '',
    } as VEntry)
  }

  // r41 v220 (2026-06-20 producer-stamp sweep) — stamp the deterministic
  // tag-parser output too.  Even though no LLM was involved, the planner
  // still needs to know WHERE these entries came from (the SEM tag parser
  // running over the pasted text).  sourceType: 'system' marks the
  // deterministic origin distinctly from 'ai' (LLM) and 'human' (manual).
  // r41 v414 (Tom Gilb 2026-07-01 Source Attribution SUPREME architecture)
  // — added canonical stage id `plan-stage-1-input` per the SUPREME rule's
  // stage-id list.  Stage 1 tag parser is Class A (raw-text sourced) — the
  // pasted text is the raw input; each parsed tag IS the trigger.
  const stampOpts = {
    generator:  'SEM Stage 1 Tag Parser',
    sourceType: 'system' as const,
    tool:       'parseAsStructuredTags',
    stage:      'plan-stage-1-input',
  }
  out.functions   = stampEntries(out.functions,                  stampOpts)
  out.values      = stampEntries(out.values,                     stampOpts)
  out.solutions   = stampEntries(out.solutions,                  stampOpts)
  out.constraints = stampEntries((out.constraints ?? []) as CEntry[], stampOpts)
  out.resources   = stampEntries((out.resources   ?? []) as REntry[], stampOpts)

  return out
}

/**
 * Direct Anthropic extraction of Planguage entries from prose.  Used by
 * `parseAsPlanguage()` when the input contains no canonical entry-type
 * markers (the common case for pasted contracts, articles, web pages).
 *
 * Tom Gilb 2026-06-19 verbatim: "I want what we had before. Maybe that
 * is A." — Option A in the prior turn was the direct Anthropic SDK call
 * (no Claudian round-trip).  This restores it.
 *
 * The Anthropic client is the module-level singleton initialised at the
 * top of this file (see r41 v184 carve-out comment).  Returns null on
 * failure — the caller is expected to fall back to the local fallback
 * wrap so no data is ever silently dropped.
 */
async function _extractWithAnthropic(
  rawText: string,
  pdfBase64?: string,
): Promise<SpecBlock | null> {
  const text = (rawText ?? '').trim()
  const hasPdf = !!(pdfBase64 && pdfBase64.length > 0)

  // Either text OR a PDF document is required.  Both empty = nothing to extract.
  if (!text && !hasPdf) return null

  // Cap text input at ~50K chars to leave headroom for system prompt + JSON output.
  // Anthropic's 200K context window can take more; the cap is a defensive
  // ceiling against runaway costs from very large pasted documents.
  // When a PDF document is attached, the model reads the PDF natively — the
  // text parameter (if any) is supplemental context only.
  const cappedText = text.length > 50_000
    ? text.slice(0, 50_000) + '\n…[input truncated to 50K chars for extraction]'
    : text

  planInputProgress.value = hasPdf
    ? 'Sending PDF to Claude for native extraction (~30–90s)…'
    : 'Generating Planguage with Claude (~30–60s)…'
  planInputError.value    = ''

  try {
    const extractionPrompt =
      `You are a Planguage spec extractor.  Read the document and identify EVERY clause that creates an obligation, capability, performance target, hard rule, or resource allocation.  Be GENEROUS in extraction — the planner WANTS the raw document mined for Planguage entries.\n\n` +
      `ENTRY TYPES (be permissive — match the SHAPE of each clause, not a strict dictionary definition):\n` +
      `  • Functions    — capabilities the system DOES / shall do.  Anything stated as a positive deliverable capability without a measurable threshold.  In a contract: "shall be capable of…", "shall provide…", "shall include…".\n` +
      `  • Values       — measurable performance criteria.  Anything with a NUMBER + a UNIT (knots of speed, tons of displacement, inches of armor, days of delivery, dollars of cost ceiling).  Set scale to the unit; goal to the target number.\n` +
      `  • Solutions    — design choices, components, specified materials.  In a contract: "shall be constructed of…", "shall use [specified vendor / method]…", "the design shall…".\n` +
      `  • Constraints  — hard rules / prohibitions / regulatory references / compliance clauses.  In a contract: "shall not exceed…", "shall comply with…", "in accordance with…", "subject to…".\n` +
      `  • Resources    — budgets / capacities allocated.  In a contract: cost ceilings, schedule milestones, labour allocations, material quantities.\n\n` +
      `EXTRACTION RULES:\n` +
      `  1. Treat EVERY numbered clause / paragraph that creates obligation as a candidate entry.\n` +
      `  2. A long document (10+ pages) typically yields 10-30 entries.  A short document (1-3 pages) typically yields 3-10.  Do NOT under-extract.\n` +
      `  3. When in doubt about category, prefer Value (if it has a number) or Constraint (if it is a binding rule) or Function (if it is a positive capability).\n` +
      `  4. Do NOT invent facts not in the document.  Do extract every fact that IS in the document, even if the document uses pre-Planguage phrasing.\n` +
      `  5. If the document genuinely has no extractable entries (e.g. it is purely a cover letter or table of contents), return all five arrays empty.  But for any real contract / specification / requirements doc, expect at least 5 entries.\n\n` +
      `OUTPUT — return ONLY a JSON object with this shape (no prose, no markdown fences):\n` +
      `{ "functions": [...], "values": [...], "solutions": [...], "constraints": [...], "resources": [...] }\n\n` +
      `Each entry has: { id, type, level, description }.\n` +
      `  • id — Mnemonic Tag: 1-3 real-word names like "Search Latency", "Armor Thickness", "Delivery Schedule".\n` +
      `         NEVER use placeholder forms.  Spell every word out (Planguage Spell-out-Type-Names rule).\n` +
      `         Storage convention for back-compat: prefix with the single letter shorthand and a dot\n` +
      `         (e.g. id = "F.Steam Propulsion" for a Function, "V.Armor Thickness" for a Value).  Treat this\n` +
      `         strictly as a machine-internal storage convention — never surface the F./V. shorthand to the planner.\n` +
      `  • type — one of: Function | Value | Solution | Constraint | Resource\n` +
      `  • level — Product | Business | Project (best guess from context).\n` +
      `  • description — ONE distinguishing sentence (≤ 20 words).  Per the Planguage Parameter Discipline rule, do NOT cram scale/meter/rationale into the description; put them in their dedicated fields.\n` +
      `For Values:    add scale, meter, tolerable, goal, wish (strings — when the document gives the unit + number, set scale + goal; leave tolerable/wish blank if not stated).\n` +
      `For Resources: add scale, meter, tolerable, goal (strings).\n` +
      `For Functions: add successCriteria (string) — the binary presence test.`

    // Build the user-message content.  When a PDF is attached, send it as a
    // native document content block — Claude reads PDFs (including scanned
    // ones with OCR-quality glyphs) without needing pdfjs-dist pre-extraction.
    // Fixes the "PDF accepted but cannot parse" failure mode for historical
    // documents like the Indianapolis cruiser construction contract (1933).
    type UserContent = Parameters<typeof _client.beta.messages.create>[0]['messages'][number]['content']
    const userContent: UserContent = hasPdf
      ? [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64! },
          },
          {
            type: 'text',
            text: cappedText
              ? `DOCUMENT (PDF attached above; supplemental text below):\n\n${cappedText}`
              : 'DOCUMENT (PDF attached above — read it natively and extract Planguage entries).',
          },
        ]
      : `DOCUMENT:\n\n${cappedText}`

    const response = await _client.beta.messages.create({
      model: MODEL_ID,
      max_tokens: 16384,
      system: [{ type: 'text', text: extractionPrompt }],
      messages: [{ role: 'user', content: userContent }],
    })

    const textBlock = response.content.find(b => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      planInputError.value = 'AI extraction returned no text'
      return null
    }

    // Find the JSON object in the response (the model may wrap with markdown).
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      planInputError.value = 'AI extraction returned no JSON object'
      return null
    }

    const parsed = JSON.parse(jsonMatch[0]) as Partial<SpecBlock>
    // r41 v220 (Tom Gilb 2026-06-20 producer-stamp sweep) — every entry the
    // Stage 1 LLM extractor returns is stamped with its provenance so the
    // renderer's Source chips light up in the in-app card AND the colorful
    // HTML export.  Composes with Conjunction-of-Technologies SUPREME
    // (source-layer badges per finding) + No-Silent-Data-Loss SUPREME.
    // r41 v414 — Source Attribution SUPREME: Stage 1 LLM extraction is Class A
    // (raw-text sourced).  Stage canonical id matches the SUPREME rule.
    const stampOpts = {
      generator:  hasPdf ? 'SEM Stage 1 LLM (PDF native)' : 'SEM Stage 1 LLM (Text)',
      sourceType: 'ai' as const,
      tool:       'Sonnet 4.5 extractor',
      stage:      'plan-stage-1-input',
    }
    return {
      functions:   stampEntries((parsed.functions   ?? []) as FEntry[], stampOpts),
      values:      stampEntries((parsed.values      ?? []) as VEntry[], stampOpts),
      solutions:   stampEntries((parsed.solutions   ?? []) as SEntry[], stampOpts),
      constraints: stampEntries((parsed.constraints ?? []) as CEntry[], stampOpts),
      resources:   stampEntries((parsed.resources   ?? []) as REntry[], stampOpts),
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    planInputError.value = `AI extraction failed: ${msg}`
    return null
  } finally {
    planInputProgress.value = ''
  }
}

/**
 * Two-tier Planguage parser:
 *
 *   (1) TAG-DETECT — if the input already contains canonical type-letter
 *       markers (e.g. lines beginning with `F.<MnemonicTag>:` etc.), run
 *       the LOCAL deterministic parser.  Instant, free, no API call.
 *
 *   (2) AI EXTRACTION — if no markers are detected (the common case for
 *       prose paste from a web page / PDF / Word doc), call Anthropic
 *       directly via the module-level client to extract Planguage entries
 *       from the prose.  Tom Gilb 2026-06-19 verbatim: "I want what we
 *       had before.  Maybe that is A." — Option A = direct SDK call.
 *
 *   (3) FALLBACK — if AI extraction fails (rate limit, network, parse
 *       error), wrap the bulk text as ONE Value entry so the planner
 *       does not silently lose the data.  No-Silent-Data-Loss SUPREME.
 *
 * Returns null only for empty/whitespace input.  Every other failure
 * mode produces a SpecBlock (possibly with just the fallback entry).
 */
/** Recognises a single bare URL (https / http) as the entire input.  Used
 *  to auto-fetch when the planner pastes a URL into the Text tab instead
 *  of the URL tab (Tom Gilb 2026-06-19 — "I have seen no parsing").  The
 *  Text tab used to feed the URL string itself to the AI which obviously
 *  could not extract Planguage from a 200-char URL. */
function _looksLikeBareUrl(s: string): boolean {
  const t = s.trim()
  if (t.length > 600 || /\s/.test(t)) return false
  return /^https?:\/\/[^\s]+$/i.test(t)
}

export async function parseAsPlanguage(
  rawText: string,
  _options?: ParseOptions,
): Promise<SpecBlock | null> {
  if (_MOCK_MODE) return _mockParsedSpec(rawText)

  const pdfBase64 = _options?.pdfBase64
  const hasPdf    = !!(pdfBase64 && pdfBase64.length > 0)

  let text = (rawText ?? '').trim()

  // (0) PDF native path — when a base64 PDF is attached (extractFromFile sets
  // this in Anthropic mode), send it directly to Claude's native PDF document
  // API.  Fixes the "PDF accepted but cannot parse" failure mode where text
  // was empty (Tom Gilb 2026-06-19) — Claude reads the PDF natively, including
  // scanned historical documents that pdfjs-dist cannot extract.
  if (hasPdf) {
    const aiSpec = await _extractWithAnthropic(text, pdfBase64)
    if (aiSpec) {
      const total =
        aiSpec.functions.length + aiSpec.values.length + aiSpec.solutions.length +
        (aiSpec.constraints?.length ?? 0) + (aiSpec.resources?.length ?? 0)
      if (total > 0) return aiSpec
    }
    // r41 v219 (Tom Gilb 2026-06-19) — FALLBACK: when Claude returns 0
    // entries (typical for narrative/legal documents — Indianapolis CL-35
    // 1935 shipbuilding contract case) AND extractFromFile gave us backup
    // text via pdfjs-dist, wrap the bulk text as ONE V.ImportedText entry
    // so the planner sees the review grid + can sharpen forward.  The
    // grid loads with 1 ticked Value entry; user can untick or sharpen
    // it to break into structured F./V./S./C./R. via the Sharpening tool.
    // Aligns with Tom's verbatim "parse it and move on" (r41 v187 reverted
    // for direct-Anthropic primary path, but the local-text-as-Value
    // fallback was always orthogonal to that preference).
    if (text && text.length > 0) {
      const snippet = text.length > 800 ? text.slice(0, 800).trim() + '…' : text.trim()
      const fallbackSpec: SpecBlock = {
        functions: [],
        values: [
          {
            id: 'V.ImportedText',
            type: 'Value',
            level: 'Product',
            description: `Imported (no structured entries detected): ${snippet}`,
            scale: '',
            meter: '',
            status: 'pre-build',
            tolerable: '',
            goal: '',
            valueOfFunction: '',
          } as VEntry,
        ],
        solutions: [],
        constraints: [],
        resources: [],
      }
      planInputProgress.value = ''
      // Set a soft-warning so the planner sees what happened without it
      // looking like a hard failure.  No-Silent-Data-Loss SUPREME — the
      // text isn't lost; it lands as the V.ImportedText description.
      planInputError.value =
        'No structured Planguage entries detected by Claude — the document text was wrapped as a single ' +
        'V.ImportedText entry below so you can review and sharpen it into structured F./V./S./C./R. entries.'
      return fallbackSpec
    }
    // r41 2026-06-20 (Tom Gilb verbatim "parse failed but file accepted" —
    // misleading error after the Indianapolis Contract PDF was uploaded:
    // the previous message said "scanned image without OCR" even though
    // the same PDF imports correctly in the Contracts agent).
    //
    // Honest diagnosis: when we land here BOTH (a) Claude returned 0
    // entries from the native PDF read AND (b) pdfjs-dist's backup text
    // extraction returned empty.  Either is silent on its own; together
    // they tell us either the PDF really is scanned-without-OCR OR the
    // pdfjs worker failed (the more common case for the Indianapolis PDF
    // — its text IS extractable, the Contracts agent confirms this).
    //
    // Better recovery: tell the user where this kind of document
    // actually fits in SEM App (Contracts agent for legal documents) +
    // honest list of fall-back options.  Composes with: Honest Loading
    // Hint Copy SUPREME (the error tells what it actually knows), No-
    // Silent-Data-Loss SUPREME (the file isn't lost; we route to a
    // surface that can use it).
    planInputError.value =
      'Could not extract a Planguage spec from this PDF — Claude found no measurable Stakes/Ends/Means structure (typical for legal documents like contracts), and the local backup text extraction returned nothing.\n\n' +
      'If this is a CONTRACT or legal document: open the 📜 Contracts agent (top bar) and import it there — that agent is designed for contracts and DOES handle PDFs with this same kind of structure.\n\n' +
      'If this is a project brief or spec document: try (a) opening the PDF in Preview, selecting + copying the text into the Text tab, or (b) running the PDF through an OCR tool first if it really is a scanned image.'
    planInputProgress.value = ''
    return null
  }

  if (!text) return null

  // (1) URL auto-detect — if the input is a single bare URL, fetch the
  // page body first so the parser/AI see the document content rather than
  // the URL string itself.  Makes the Text tab tolerate URL paste.
  if (_looksLikeBareUrl(text)) {
    try {
      planInputProgress.value = 'Detected a URL — fetching page…'
      const fetched = await extractFromUrl(text)
      if (fetched && fetched.trim().length > 0) text = fetched.trim()
    } catch (err) {
      planInputError.value = `Could not fetch the URL — ${err instanceof Error ? err.message : String(err)}.  Paste the page contents directly into the Text tab instead.`
      planInputProgress.value = ''
      return null
    }
  }

  // (2) Tag-detect: any line starting with `[FVSCR]. <alpha>`?
  const hasTags = /^\s*[FVSCR]\.\s*[A-Za-z]/m.test(text)

  if (hasTags) {
    planInputProgress.value = 'Parsing Planguage tags locally…'
    const spec = _parseLocalText(text)
    planInputProgress.value = ''
    return spec
  }

  // (3) Prose input → AI extraction
  const aiSpec = await _extractWithAnthropic(text)
  if (aiSpec) {
    const total =
      aiSpec.functions.length + aiSpec.values.length + aiSpec.solutions.length +
      (aiSpec.constraints?.length ?? 0) + (aiSpec.resources?.length ?? 0)
    if (total > 0) return aiSpec
  }

  // (4) AI extraction failed or produced nothing → fallback wrap
  // (No-Silent-Data-Loss: never drop the user's pasted content.)
  planInputProgress.value = 'Wrapping bulk text as Imported Text entry…'
  const fallback = _parseLocalText(text)
  planInputProgress.value = ''
  return fallback
}

// ── Mock (VITE_MOCK_MODE=true) ─────────────────────────────────────────────────

function _mockParsedSpec(text: string): SpecBlock {
  const tag = (text.split(/\s+/).slice(0, 3).join('').replace(/[^a-zA-Z]/g, '') || 'Import')
  return {
    functions: [
      {
        id: `F.${tag}PrimaryGoal`, type: 'Function', level: 'Product',
        description: 'Deliver the primary goal stated in the imported plan',
        successCriteria: 'The system executes the primary goal without error.',
        functionOfValue: `V.${tag}Outcome`,
      },
      {
        id: `F.${tag}Reporting`, type: 'Function', level: 'Product',
        description: 'Report progress against the plan objectives',
        successCriteria: 'Progress reports can be generated on demand without error.',
        functionOfValue: `V.${tag}Visibility`,
      },
    ],
    values: [
      {
        id: `V.${tag}Outcome`, type: 'Value', level: 'Product',
        description: 'Core outcome metric from imported plan',
        scale: 'score 1–10 on stakeholder satisfaction', meter: 'quarterly stakeholder survey',
        status: 'pre-build', tolerable: '6', goal: '8',
        valueOfFunction: `F.${tag}PrimaryGoal`,
      },
      {
        id: `V.${tag}Visibility`, type: 'Value', level: 'Product',
        description: 'Plan progress visibility for decision-makers',
        scale: '% of milestones with up-to-date status', meter: 'dashboard completeness audit',
        status: 'pre-build', tolerable: '70%', goal: '95%',
        valueOfFunction: `F.${tag}Reporting`,
      },
    ],
    solutions: [
      {
        id: `S.${tag}Approach`, type: 'Solution', level: 'Product',
        description: 'Primary implementation approach from imported plan',
        impact: `V.${tag}Outcome ~8`, function: `F.${tag}PrimaryGoal`,
      },
      {
        id: `S.${tag}Dashboard`, type: 'Solution', level: 'Product',
        description: 'Live dashboard tracking plan milestones and KPIs',
        impact: `V.${tag}Visibility ~95%`, function: `F.${tag}Reporting`,
      },
    ],
  }
}

// ── Merge Plans ────────────────────────────────────────────────────────────────

// r41 v270 (Tom Gilb 2026-06-21 SUPREME — Canonical Planguage Extractor):
// replaced the prior ~30-line _MERGE_PROMPT (which also carried banned
// F.PascalCase IDs and missed every r93-wave SUPREME rule) with the
// canonical primer + merge-specific framing.
const _MERGE_PROMPT = `You are a Competitive Engineering consultant trained in Tom Gilb's Planguage methodology.

== MULTI-SOURCE MERGE INPUT FORMAT (input shape for this caller) ==
You have been given MULTIPLE planning sources (plan documents, spec versions,
meeting notes, etc.). Your task is to synthesise them into ONE consolidated
Planguage specification per the canonical discipline below.

Synthesis rules:
- Deduplicate: merge entries that represent the same concept, keeping the most complete/precise version
- Resolve contradictions: prefer the most recently dated source where dates are discernible; otherwise choose the more specific/quantified statement
- Combine complementary elements: an F. from source A can reference a V. from source B if they are conceptually linked
- Do NOT discard entries just because they appear in only one source — include them if they add value
- Produce at least 2 F. entries, 2 V. entries, and 2 S. entries

${CANONICAL_PLANGUAGE_DISCIPLINE_PROMPT}

== OUTPUT JSON SHAPE (caller-specific) ==
Return ONLY valid JSON — no markdown fences, no explanation. Field shape:
{
  "functions": [
    {"id":"Mnemonic Words","type":"Function","level":"Product","description":"...","successCriteria":"...","functionOfValue":"Mnemonic Words"}
  ],
  "values": [
    {"id":"Mnemonic Words","type":"Value","level":"Product","description":"...","scale":"...","meter":"...","tolerable":"...","goal":"...","wish":"...","valueOfFunction":"Mnemonic Words","wishStakeholder":"..."}
  ],
  "solutions": [
    {"id":"Mnemonic Words","type":"Solution","level":"Product","description":"...","derivedFrom":"[[V.Tag]]","function":"[[F.Tag]]","mainImpacts":"[[V.Tag]] ~target","status":"NotProduction"}
  ]
}

Cross-links mandatory: F.functionOfValue → V.id; V.valueOfFunction → F.id;
S.function → F.id. Use the EXACT id strings (mnemonic words, no PascalCase,
no V1/F1/S1).`

/**
 * r41 v177 — Build a paste-ready Claudian prompt for merging multiple plan
 * text sources into one consolidated Planguage Representation.  Pure
 * function; mirrors `buildClaudianParsePrompt()` for the merge case.
 */
export function buildClaudianMergePrompt(inputs: string[]): string {
  const MAX_PER_SOURCE = Math.floor(12_000 / Math.max(inputs.length, 1))
  const sourceSections = inputs
    .map((src, i) => `--- SOURCE ${i + 1} ---\n${src.slice(0, MAX_PER_SOURCE)}`)
    .join('\n\n')
  return `${_MERGE_PROMPT}

${sourceSections}

--- END OF SOURCES ---

Return the combined Planguage Representation in the exact shape above.  For the batch path, write the result to:
  sem-app/public/data/getAPlanResult.json
in the shape:
{ "generatedAt": "<ISO timestamp>", "spec": { "functions": [...], "values": [...], "solutions": [...] } }
so the planner can click "Refresh from disk".`
}

/**
 * r41 v177 — Mark the merge UI as awaiting Claudian, build the prompt, and
 * best-effort-copy it to the system clipboard.  Returns the prompt string
 * so callers can show it in a textarea fallback.
 */
export async function requestClaudianMerge(inputs: string[]): Promise<string | null> {
  if (!inputs.length) return null
  mergeError.value   = ''
  mergeLoading.value = false   // explicit: the new flow isn't a sync wait
  const prompt = buildClaudianMergePrompt(inputs)
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(prompt)
    }
  } catch {
    // intentional swallow — fallback is the panel textarea
  }
  return prompt
}

/**
 * r41 v177 — Apply Claudian's merged result.  Reuses the same extractor +
 * coercer as the parse path; accepts both bare and batch shapes.
 */
export function applyClaudianMergeResult(pastedText: string): SpecBlock | null {
  const raw = _extractStructuredResult<ParsedShape & { spec?: ParsedShape }>(pastedText)
  const candidate: ParsedShape = (raw && typeof raw === 'object' && raw.spec)
    ? raw.spec
    : raw
  return _coerceParsedSpec(candidate)
}

/**
 * r41 v187 (Tom Gilb 2026-06-18) — LOCAL DETERMINISTIC merge.  Parse each
 * input source locally via `_parseLocalText` and concatenate the resulting
 * entries (dedupe by id, last-write-wins on collision).  No Anthropic call.
 * Composes with Claude-Code-as-AI-Layer SUPREME (banned: embedded AI calls).
 */
export async function mergePlansAsPlanguage(inputs: string[]): Promise<SpecBlock | null> {
  if (!inputs.length) return null
  if (_MOCK_MODE) return _mockParsedSpec(inputs.join(' '))

  mergeLoading.value = true
  mergeError.value   = ''

  try {
    const merged: SpecBlock = { functions: [], values: [], solutions: [], constraints: [], resources: [] }
    const byId = new Map<string, true>()
    const pushUnique = <T extends { id: string }>(list: T[], next: T[]): void => {
      for (const entry of next) {
        if (!entry.id) continue
        if (byId.has(entry.id)) {
          // last-write-wins: replace existing
          const idx = list.findIndex(e => e.id === entry.id)
          if (idx >= 0) list[idx] = entry
        } else {
          byId.set(entry.id, true)
          list.push(entry)
        }
      }
    }
    for (const src of inputs) {
      const spec = _parseLocalText(src)
      pushUnique(merged.functions,  spec.functions)
      pushUnique(merged.values,     spec.values)
      pushUnique(merged.solutions,  spec.solutions)
      pushUnique(merged.constraints as CEntry[], spec.constraints ?? [])
      pushUnique(merged.resources   as REntry[], spec.resources   ?? [])
    }
    return merged
  } catch (err) {
    mergeError.value = err instanceof Error ? err.message : 'Merge failed — please try again.'
    return null
  } finally {
    mergeLoading.value = false
  }
}
