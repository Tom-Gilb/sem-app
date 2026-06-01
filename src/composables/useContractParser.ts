// UNIT_TYPE=Composable
/**
 * useContractParser — LLM pipeline for converting contract text into Planguage.
 *
 * Two-phase pipeline:
 *   Phase 1 — splitIntoClauses(rawText):
 *     LLM identifies clause boundaries, numbers, headings.
 *     Returns ContractClause[] (entries = [], parseStatus = 'pending').
 *
 *   Phase 2 — parseClause(clause, parties):
 *     LLM converts each clause's raw text into PlanguageContractEntry[].
 *     Flags ambiguous language with specific notes.
 *     Returns LLMEntryOutput[] which caller converts to PlanguageContractEntry[].
 *
 * LLM pattern: mirrors useSpecQualityCheck.ts (Anthropic SDK, JSON output,
 * no streaming, AbortController for cancellation).
 *
 * Planguage grounding: prompt injects canonical definitions for F./V./C./R./S.
 * so the model stays within the Planguage type system, not ad-hoc classification.
 */

import Anthropic from '@anthropic-ai/sdk'
import { MODEL_ID } from '../config/llm'
import type {
  ContractClause,
  ContractParty,
  PlanguageContractEntry,
  ContractEntryType,
  LLMClauseSplit,
  LLMEntryOutput,
} from '../types/contractTypes'

// ── LLM client ────────────────────────────────────────────────────────────────
// Model: imported from src/config/llm.ts (claude-sonnet-4-6).
// Contract parsing is complex multi-section JSON generation — Haiku produces
// malformed or wrapped-object responses. Sonnet required per Model Selection Rule.

function _getClient(): Anthropic {
  const apiKey  = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined
  const isLocal = !!(import.meta.env.VITE_OLLAMA_MODEL || import.meta.env.VITE_OLLAMA_BASE_URL)
  if (!apiKey && !isLocal) throw new Error('VITE_ANTHROPIC_API_KEY not set')
  return new Anthropic({ apiKey: apiKey ?? 'local', dangerouslyAllowBrowser: true, timeout: 120_000 })
}

// ── JSON extraction helper ────────────────────────────────────────────────────

function _extractJson<T>(text: string): T | null {
  try {
    // Try direct parse first (model may output bare JSON)
    return JSON.parse(text) as T
  } catch { /* fall through */ }
  // Strip code fences
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (match) {
    try { return JSON.parse(match[1].trim()) as T } catch { /* fall through */ }
  }
  // Find first [ or { and parse from there
  const start = text.search(/[{[]/)
  if (start >= 0) {
    try { return JSON.parse(text.slice(start)) as T } catch { /* fall through */ }
  }
  return null
}

// Defensive array extractor — handles both bare arrays and LLM-wrapped objects
// e.g. {"clauses": [...]} or {"result": [...]} or just [...].
// Haiku (and occasionally Sonnet) wraps arrays even when told not to.
function _extractJsonArray<T>(text: string): T[] {
  const parsed = _extractJson<unknown>(text)
  if (parsed === null || parsed === undefined) return []
  if (Array.isArray(parsed)) return parsed as T[]
  if (typeof parsed === 'object') {
    const found = Object.values(parsed as Record<string, unknown>).find(v => Array.isArray(v))
    if (found) return found as T[]
  }
  return []
}

function _uuid(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)
}

// ── Planguage definitions injected into every prompt ─────────────────────────

const PLANGUAGE_PRIMER = `
You are a Planguage expert converting legal contract text into structured Planguage entries.

Planguage entry types:
- F. (Function): A BINARY obligation — something a party DOES or PROVIDES. Present or absent, YES or NO. No quantities here. Example: "F.1 Payment: SUPPLIER provides monthly invoices."
- V. (Value): A MEASURABLE performance obligation with Scale/Meter/Goal/Tolerable/Wish. Example: "V.1 Uptime: Scale: system availability %; Meter: automated monitoring; Goal: 99.9%; Tolerable: 99.0%; Wish: 99.99%."
- C. (Constraint): A HARD LIMIT or PROHIBITION. Express as "Must [not]...". Binary compliance. Example: "C.1 Data residency: Data MUST remain within EU jurisdiction."
- R. (Resource): A BUDGET, COST, or QUANTITY CAP. Example: "R.1 Annual fee: CLIENT pays £50,000 per calendar year."
- S. (Stakeholder): A PARTY-SPECIFIC DUTY or claim not fitting F/V/C/R. Example: "S.1 Governance: CLIENT designates a named relationship manager."
- Task: A specific ACTION ITEM with a deadline. Example: "Task.1 Onboarding: SUPPLIER delivers training within 30 days of contract signing."

Key rules:
1. F. entries are BINARY. If it has quantities (99%, £50k, 30 days), it is V., R., or Task, NOT F.
2. V. entries MUST have Goal at minimum. Tolerable and Wish are optional.
3. C. entries are hard limits that cannot be traded off. If it is "must/shall/prohibited/forbidden", it is C.
4. Flag isAmbiguous=true when: terms are undefined, thresholds are missing, "reasonable" appears without definition, scope is unclear.
5. obligatedParty should be the party ABBREVIATION (e.g. "CLIENT", "SUPPLIER") or null if mutual/unclear.
6. rawSource must be the verbatim sentence(s) from the clause that generated this entry.
7. Return ONLY valid JSON — no prose, no code fences.
`.trim()

// ── Phase 1: Split raw text into clauses ─────────────────────────────────────

const SPLIT_PROMPT = (rawText: string) => `
${PLANGUAGE_PRIMER}

Your task RIGHT NOW is Phase 1 only: split the following contract text into its logical clauses.

Rules:
- Identify natural clause boundaries: numbered sections, articles, schedules, headings.
- Each clause should be a self-contained unit (a numbered section or article).
- If no clear numbering exists, split by topic/heading.
- Keep rawText verbatim — do NOT paraphrase or summarise.
- Aim for 5–50 clauses. Do not fragment into sub-sentences; keep related sub-clauses together.

Return a JSON array of objects. Each object has:
{
  "number": "clause identifier, e.g. '3.2', 'Article IV', 'Schedule A'",
  "heading": "short descriptive title, max 8 words",
  "rawText": "verbatim clause text"
}

CONTRACT TEXT:
---
${rawText}
---

Return ONLY the JSON array. No explanation.
`.trim()

// ── Phase 2: Parse a single clause into Planguage entries ────────────────────

const PARSE_CLAUSE_PROMPT = (
  clause: ContractClause,
  parties: ContractParty[],
) => `
${PLANGUAGE_PRIMER}

Your task RIGHT NOW is Phase 2: convert the clause below into Planguage entries.

Contract parties:
${parties.map(p => `- ${p.abbreviation} (${p.name}, role: ${p.role})`).join('\n')}

Clause ${clause.number} — ${clause.heading}:
---
${clause.rawText}
---

Return a JSON array of entry objects. Each object has:
{
  "type": "F" | "V" | "C" | "R" | "S" | "Task",
  "description": "canonical Planguage description (tag will be assigned separately)",
  "obligatedParty": "PARTY_ABBREVIATION or null if mutual",
  "scale": "for V only — what is measured",
  "meter": "for V only — how it is measured",
  "goal": "for V only — target value",
  "tolerable": "for V only — minimum acceptable (optional)",
  "wish": "for V only — aspirational stretch (optional)",
  "constraintText": "for C only — 'Must [not]...' statement",
  "presenceTest": "for F only — binary presence statement",
  "deadline": "for Task/S only — ISO date or relative expression",
  "rawSource": "verbatim sentence(s) from clause text that generated this entry",
  "confidence": "high" | "medium" | "low",
  "isAmbiguous": true | false,
  "ambiguityNote": "specific explanation if isAmbiguous is true, else null"
}

If the clause contains no obligations (e.g. pure definitions), return [].
Return ONLY the JSON array. No explanation.
`.trim()

// ── Public composable ─────────────────────────────────────────────────────────

export function useContractParser() {
  /**
   * Phase 1 — Split raw contract text into clause objects.
   * Returns ContractClause[] with entries = [] and parseStatus = 'pending'.
   */
  async function splitIntoClauses(
    rawText:  string,
    signal?:  AbortSignal,
  ): Promise<ContractClause[]> {
    const client = _getClient()
    const response = await client.messages.create({
      model:      MODEL_ID,
      max_tokens: 4096,
      messages:   [{ role: 'user', content: SPLIT_PROMPT(rawText) }],
      ...(signal ? {} : {}),   // AbortController not directly supported by SDK; caller manages
    })
    const text = response.content.find(b => b.type === 'text')?.text ?? '[]'
    const splits = _extractJsonArray<LLMClauseSplit>(text)

    return splits.map((s): ContractClause => ({
      id:          _uuid(),
      number:      s.number?.trim()  ?? '?',
      heading:     s.heading?.trim() ?? 'Untitled',
      rawText:     s.rawText?.trim() ?? '',
      entries:     [],
      parseStatus: 'pending',
    }))
  }

  /**
   * Phase 2 — Parse a single clause into PlanguageContractEntry[].
   * Caller is responsible for calling nextTag() to assign sequential tags.
   */
  async function parseClause(
    clause:        ContractClause,
    parties:       ContractParty[],
    tagFn:         (type: ContractEntryType) => string,
    signal?:       AbortSignal,
  ): Promise<PlanguageContractEntry[]> {
    const client = _getClient()
    const response = await client.messages.create({
      model:      MODEL_ID,
      max_tokens: 2048,
      messages:   [{ role: 'user', content: PARSE_CLAUSE_PROMPT(clause, parties) }],
    })
    const text = response.content.find(b => b.type === 'text')?.text ?? '[]'
    const outputs = _extractJsonArray<LLMEntryOutput>(text)

    return outputs.map((o): PlanguageContractEntry => ({
      id:              _uuid(),
      clauseRef:       clause.id,
      type:            _sanitiseType(o.type),
      tag:             tagFn(_sanitiseType(o.type)),
      description:     o.description?.trim() ?? '',
      obligatedParty:  o.obligatedParty ?? undefined,
      scale:           o.scale          ?? undefined,
      meter:           o.meter          ?? undefined,
      goal:            o.goal           ?? undefined,
      tolerable:       o.tolerable      ?? undefined,
      wish:            o.wish           ?? undefined,
      constraintText:  o.constraintText ?? undefined,
      presenceTest:    o.presenceTest   ?? undefined,
      deadline:        o.deadline       ?? undefined,
      rawSource:       o.rawSource?.trim() ?? clause.rawText.slice(0, 200),
      confidence:      _sanitiseConfidence(o.confidence),
      isAmbiguous:     o.isAmbiguous    ?? false,
      ambiguityNote:   o.ambiguityNote  ?? undefined,
      llmGenerated:    true,
    }))
  }

  return { splitIntoClauses, parseClause }
}

// ── Sanitisers ────────────────────────────────────────────────────────────────

function _sanitiseType(t: unknown): ContractEntryType {
  const valid: ContractEntryType[] = ['F', 'V', 'C', 'R', 'S', 'Task']
  return valid.includes(t as ContractEntryType) ? (t as ContractEntryType) : 'F'
}

function _sanitiseConfidence(c: unknown): 'high' | 'medium' | 'low' {
  if (c === 'high' || c === 'medium' || c === 'low') return c
  return 'medium'
}
