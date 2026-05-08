// UNIT_TYPE=Hook
// usePlanInput — Parse any existing plan document into a Planguage SpecBlock.
//
// Supported inputs:
//   text   — plain pasted text (any format)
//   url    — public web page (direct fetch or allorigins.win CORS proxy)
//   file   — .pdf  (sent to Anthropic as a native document — no local parser needed)
//            .docx (text extracted via mammoth, then AI-parsed)
//            .txt / .md / .rtf / .html / .csv and other text types
//            .doc  (unsupported — user prompted to save as .docx)
//
// AI parsing prompt mirrors the CE methodology so the resulting SpecBlock
// matches the format produced by useSDK.translate().

import { ref } from 'vue'
import Anthropic from '@anthropic-ai/sdk'
import { MODEL_ID } from '../config/llm'
import type { SpecBlock, FEntry, VEntry, SEntry } from '../types/spec'

const _client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY as string,
  dangerouslyAllowBrowser: true,
  timeout: 90_000,
})

const _MOCK_MODE = import.meta.env.VITE_MOCK_MODE === 'true'

export type PlanInputMode = 'text' | 'url' | 'file'

// ── Module-level reactive state ────────────────────────────────────────────────

export const planInputLoading  = ref(false)
export const planInputError    = ref('')
/** Short status message shown while multi-step extraction is running */
export const planInputProgress = ref('')

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
  /** Extracted plain text (empty for PDFs — use pdfBase64 instead) */
  text: string
  /** True when the file is a PDF; use pdfBase64 with the Anthropic documents API */
  isPdf: boolean
  /** Base-64 encoded PDF bytes — only set when isPdf is true */
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

  // ── PDF: return base-64 for Anthropic's native document API ──────────────────
  if (ext === 'pdf') {
    planInputProgress.value = 'Reading PDF…'
    const buf = await file.arrayBuffer()
    const bytes = new Uint8Array(buf)
    let binary = ''
    // Build binary string in chunks to avoid stack overflow on large PDFs
    const CHUNK = 8192
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
    }
    return { text: '', isPdf: true, pdfBase64: btoa(binary) }
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

  // ── Plain text: .txt .md .rtf .html .csv and anything else ───────────────────
  planInputProgress.value = 'Reading file…'
  return new Promise<FileExtractionResult>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = e => resolve({ text: (e.target?.result as string) ?? '', isPdf: false })
    reader.onerror = () => reject(new Error('Could not read the file. Try copy-pasting the content instead.'))
    reader.readAsText(file)
  })
}

// ── AI parsing ─────────────────────────────────────────────────────────────────

const _PARSE_PROMPT = `You are a Competitive Engineering consultant trained in Tom Gilb's Planguage methodology.
Parse the provided plan document into a structured Planguage specification.

Extract from the document:
- F. entries (Functions): WHAT the system/project delivers. Binary — it either works or it does not.
  successCriteria must be a binary capability test ("the system can do X without error") — never a number, rate, or percentage.
- V. entries (Values): HOW WELL it performs. Each must have all five measurement fields:
    scale    — the attribute being measured and its unit
    meter    — how it is measured (instrument or method)
    status   — current baseline; write "pre-build" if unknown
    tolerable — minimum acceptable level
    goal     — stakeholder's target aspiration
- S. entries (Solutions): HOW it achieves the functions. Strategies, approaches, architectures.

Rules:
- id format: F.PascalCase, V.PascalCase, S.PascalCase
- type: exactly "Function" | "Value" | "Solution"
- level: infer from context — "Business" | "Stakeholder" | "Product" | "Solution"
- Cross-links are mandatory: F.functionOfValue → a V.id; V.valueOfFunction → a F.id; S.function → a F.id
- If the source has no explicit metrics, infer reasonable ones from the stated goals and context
- Produce at least 2 F. entries, 2 V. entries, and 2 S. entries when the source material permits

Return ONLY valid JSON — no markdown fences, no explanation, no prose outside the JSON:
{
  "functions": [
    {"id":"F.Xxx","type":"Function","level":"Product","description":"...","successCriteria":"...","functionOfValue":"V.Xxx"}
  ],
  "values": [
    {"id":"V.Xxx","type":"Value","level":"Product","description":"...","scale":"...","meter":"...","status":"pre-build","tolerable":"...","goal":"...","valueOfFunction":"F.Xxx"}
  ],
  "solutions": [
    {"id":"S.Xxx","type":"Solution","level":"Product","description":"...","impact":"V.Xxx ~target","function":"F.Xxx"}
  ]
}`

export interface ParseOptions {
  isPdf?: boolean
  pdfBase64?: string
}

/**
 * Send extracted content to the AI and parse it into a SpecBlock.
 * For PDFs, uses Anthropic's native document API (base-64 source).
 * For all other text, sends raw text with the parse prompt.
 */
export async function parseAsPlanguage(
  rawText: string,
  options?: ParseOptions,
): Promise<SpecBlock | null> {
  if (_MOCK_MODE) return _mockParsedSpec(rawText)

  planInputProgress.value = 'Parsing as Planguage…'

  type UserContent = Anthropic.MessageParam['content']

  let content: UserContent

  if (options?.isPdf && options.pdfBase64) {
    // Native PDF: Anthropic extracts text internally — no local parser needed
    content = [
      {
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: options.pdfBase64,
        },
      } as unknown as Anthropic.TextBlockParam,
      { type: 'text', text: _PARSE_PROMPT },
    ]
  } else {
    // Text / URL / file-extracted text
    const trimmed = rawText.slice(0, 14_000)
    content = `${_PARSE_PROMPT}\n\nPlan document:\n---\n${trimmed}\n---`
  }

  const message = await _client.messages.create({
    model: MODEL_ID,
    max_tokens: 4096,
    messages: [{ role: 'user', content }],
  })

  const textBlock = message.content.find((b): b is Anthropic.TextBlock => b.type === 'text')
  if (!textBlock) return null

  // Strip markdown code fence if the model wraps its output
  const json = textBlock.text
    .replace(/^```json\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()

  try {
    const parsed = JSON.parse(json) as {
      functions?: Array<Record<string, string>>
      values?:    Array<Record<string, string>>
      solutions?: Array<Record<string, string>>
    }

    const functions: FEntry[] = (parsed.functions ?? []).map(f => ({
      id:              f.id              ?? '',
      type:            f.type            ?? 'Function',
      level:           f.level           ?? 'Product',
      description:     f.description     ?? '',
      successCriteria: f.successCriteria ?? '',
      functionOfValue: f.functionOfValue ?? '',
    }))

    const values: VEntry[] = (parsed.values ?? []).map(v => ({
      id:              v.id              ?? '',
      type:            v.type            ?? 'Value',
      level:           v.level          ?? 'Product',
      description:     v.description     ?? '',
      scale:           v.scale           ?? '',
      meter:           v.meter           ?? '',
      status:          v.status          ?? 'pre-build',
      tolerable:       v.tolerable       ?? '',
      goal:            v.goal            ?? '',
      valueOfFunction: v.valueOfFunction ?? '',
    }))

    const solutions: SEntry[] = (parsed.solutions ?? []).map(s => ({
      id:          s.id          ?? '',
      type:        s.type        ?? 'Solution',
      level:       s.level       ?? 'Product',
      description: s.description ?? '',
      impact:      s.impact      ?? '',
      function:    s.function    ?? '',
    }))

    if (!functions.length && !values.length) return null
    return { functions, values, solutions }
  } catch {
    return null
  }
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
