// useSpecQualityCheck.ts — Feature #200: AI-powered spec quality audit
// Detects missing fields, ambiguous descriptions, misleading claims,
// and conflicts — both within the current spec and across all other saved plan models.

import Anthropic from '@anthropic-ai/sdk'
import { ref } from 'vue'
import { MODEL_ID } from '../config/llm'
import type { SpecBlock } from '../types/spec'
import type { SpecAnnotation, AnnotationType, ConflictRef } from './useSpecAnnotations'

// ── LLM client ────────────────────────────────────────────────────────────────

function _getClient(): Anthropic {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined
  const isLocal = !!(import.meta.env.VITE_OLLAMA_MODEL || import.meta.env.VITE_OLLAMA_BASE_URL)
  if (!apiKey && !isLocal) throw new Error('VITE_ANTHROPIC_API_KEY not set')
  return new Anthropic({ apiKey: apiKey ?? 'local', dangerouslyAllowBrowser: true, timeout: 120_000 })
}

// ── Serialisation ─────────────────────────────────────────────────────────────

/** Full detail for the spec under audit — exposes every field the AI needs. */
function _specToFull(spec: SpecBlock): string {
  const lines: string[] = []
  for (const f of spec.functions) {
    lines.push(`F. ${f.id}: ${f.description}`)
    lines.push(`   Presence test: ${(f.presenceTest || f.successCriteria)?.trim() || '[EMPTY — required field]'}`)
  }
  for (const v of spec.values) {
    lines.push(`V. ${v.id}: ${v.description}`)
    lines.push(`   Scale: ${v.scale?.trim() || '[EMPTY]'}`)
    lines.push(`   Meter: ${v.meter?.trim() || '[EMPTY]'}`)
    lines.push(`   Status: ${v.status?.trim() || '[EMPTY]'}`)
    lines.push(`   Tolerable: ${v.tolerable?.trim() || '[EMPTY]'}  Goal: ${v.goal?.trim() || '[EMPTY]'}`)
  }
  for (const s of spec.solutions) {
    lines.push(`S. ${s.id}: ${s.description}`)
    lines.push(`   Impact: ${s.impact?.trim() || '[EMPTY — required field]'}`)
  }
  for (const c of spec.constraints ?? []) {
    lines.push(`C. ${c.id}: ${c.description?.trim() || '[EMPTY — required field]'}`)
    lines.push(`   Scope: ${c.scope?.trim() || '[EMPTY — required field]'}`)
    lines.push(`   Rationale: ${c.rationale?.trim() || '[EMPTY — required field]'}`)
    if (c.source) lines.push(`   Source: ${c.source}`)
  }
  return lines.join('\n')
}

/** Compact summary of an other plan — enough for cross-spec conflict detection. */
function _specToSummary(spec: SpecBlock, name: string): string {
  const F = spec.functions.map(f =>
    `  F. ${f.id}: ${f.description.slice(0, 80)}${f.description.length > 80 ? '…' : ''}`,
  ).join('\n')
  const V = spec.values.map(v =>
    `  V. ${v.id}: ${v.description.slice(0, 60)} [Goal: ${v.goal}]`,
  ).join('\n')
  const S = spec.solutions.map(s =>
    `  S. ${s.id}: ${s.description.slice(0, 60)}`,
  ).join('\n')
  const C = (spec.constraints ?? []).map(c =>
    `  C. ${c.id}: ${c.description.slice(0, 60)} [Scope: ${(c.scope ?? '').slice(0, 30)}]`,
  ).join('\n')
  return [
    `Plan: "${name}"`,
    F || '  (no functions)',
    V || '  (no values)',
    S || '  (no solutions)',
    C || '',
  ].filter(Boolean).join('\n')
}

/** Extract and parse JSON from an LLM response (handles fences and prose wrapping). */
function _extractJson<T>(text: string): T {
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  try { return JSON.parse(stripped) as T } catch { /* */ }
  try { return JSON.parse(text.trim()) as T } catch { /* */ }
  const arrMatch = stripped.match(/\[[\s\S]*\]/)
  if (arrMatch) { try { return JSON.parse(arrMatch[0]) as T } catch { /* */ } }
  const objMatch = stripped.match(/\{[\s\S]*\}/)
  if (objMatch) { try { return JSON.parse(objMatch[0]) as T } catch { /* */ } }
  throw new Error(`LLM returned non-JSON:\n${text.slice(0, 200)}`)
}

// ── Module-level state (singleton — shared across any component using the composable) ───

const _loading    = ref(false)
const _error      = ref('')
const _lastRunAt  = ref<Date | null>(null)
/**
 * Synthetic 0–100 progress estimate. The underlying single LLM call emits
 * no progress events, so we run a "tortoise" curve that approaches but
 * never reaches a 92% ceiling while loading, then snaps to 100 on success.
 * This is purely a UX cue — it does NOT reflect real backend percentage.
 */
const _progress   = ref(0)

// ── Composable ────────────────────────────────────────────────────────────────

export function useSpecQualityCheck() {

  /**
   * Run the full quality audit.
   * @param currentSpec    — the SpecBlock being audited
   * @param currentName    — display name of the current plan model
   * @param otherModels    — all other saved plan models for cross-spec conflict detection
   */
  async function runCheck(
    currentSpec: SpecBlock,
    currentName: string,
    otherModels: Array<{ id: string; name: string; spec: SpecBlock }>,
  ): Promise<SpecAnnotation[]> {
    _loading.value = true
    _error.value   = ''
    _progress.value = 0

    // Kick off the synthetic progress tortoise — approaches 92% but never hits it
    // while the LLM call is in flight. On success we snap to 100; on error we
    // reset to 0. Ticks every 350 ms.
    const CEILING = 92
    const _tick = setInterval(() => {
      const remaining = CEILING - _progress.value
      if (remaining <= 0) return
      // gentle ease-out: 8 % of remaining gap each tick → slows as it climbs
      _progress.value = Math.min(CEILING, _progress.value + Math.max(0.4, remaining * 0.08))
    }, 350)

    try {
      // Cap other-spec summaries at 8 models to control token budget
      const others = otherModels.slice(0, 8)
      const otherSection = others.length
        ? `OTHER KNOWN PLANS (use only for cross-spec conflict detection — do NOT audit them):\n\n${others.map(m => _specToSummary(m.spec, m.name)).join('\n\n---\n\n')}`
        : ''

      const prompt = `You are a Planguage specification quality auditor. Analyse ONLY the CURRENT SPEC below for quality issues.

CURRENT SPEC (Plan: "${currentName}"):
${_specToFull(currentSpec)}

${otherSection}

TASK: Return ONLY a JSON array of annotation objects. Each object must match exactly:
{
  "entryId": "<exact F./V./S. ID from the CURRENT SPEC>",
  "type": "missing" | "ambiguous" | "misleading" | "conflicting",
  "note": "<1–2 sentence explanation of the issue>",
  "conflictsWith": [
    { "scope": "same-spec", "entryId": "<other entry ID>", "description": "<conflict explanation>" },
    { "scope": "cross-spec", "specName": "<plan name>", "description": "<conflict explanation>" }
  ]
}

TYPE RULES — apply these strictly:
- "missing": A required field is [EMPTY] or description is a placeholder (TBD, TODO, N/A); OR the entry is so vague it provides no actionable information
- "ambiguous": Description uses undefined terms, has double meanings, lacks specificity, or two readers could reach opposite conclusions from it
- "misleading": Description makes a claim that contradicts measurable data elsewhere in the same spec, or overstates capability in a way that is not backed by any V. entry goal
- "conflicting": This entry directly contradicts another entry in the current spec (same-spec) OR a stated commitment or constraint in one of the other plans listed above (cross-spec); you MUST populate conflictsWith with at least one entry
- conflictsWith MUST be [] for missing/ambiguous/misleading types
- Only flag genuine issues — a well-written spec may have zero annotations
- Never annotate entries from the other plans, only from the CURRENT SPEC

SCALAR CONSTRAINT RULE (critical — always check):
For each V. entry, compare Status against Tolerable. Tolerable is the minimum acceptable level — the scalar constraint floor. If Status is present and appears to be worse than (below) the Tolerable threshold — for example Status is lower when higher is better, or higher when lower is better — flag the V. entry as "conflicting" with a note that reads: "Scalar constraint violated: Status [STATUS_VALUE] is below the Tolerable floor of [TOLERABLE_VALUE]. This plan as specified cannot meet its minimum performance commitment." Set conflictsWith to []. Do this check even when the values are percentages, times, scores, or prose ranges — use judgment to determine direction of improvement.

BINARY CONSTRAINT RULE:
For each C. entry, if the Description field is [EMPTY] or does not start with "Must" or "Must not", flag as "missing" with note: "Binary constraint description is missing or malformed — must begin with 'Must' or 'Must not'." If the Scope field is [EMPTY], flag as "missing" with note: "Constraint Scope is missing — must specify what the constraint binds." Also flag as "conflicting" (separate annotation) if any F. or S. entry in the spec appears to describe behaviour that would violate this constraint.

Return ONLY the JSON array — no prose, no markdown, no explanation.`

      const client = _getClient()
      const resp = await client.messages.create({
        model: MODEL_ID,
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      })

      const raw = resp.content[0]?.type === 'text' ? resp.content[0].text : '[]'

      type RawAnn = {
        entryId?: string
        type?: string
        note?: string
        conflictsWith?: ConflictRef[]
      }

      const _rawParsed = _extractJson<RawAnn[] | Record<string, unknown>>(raw)
      // LLM sometimes wraps the array: {"annotations":[...]} or {"issues":[...]}
      const parsed: RawAnn[] = Array.isArray(_rawParsed)
        ? _rawParsed
        : Array.isArray((_rawParsed as Record<string, unknown>).annotations)
          ? ((_rawParsed as Record<string, unknown>).annotations as RawAnn[])
          : Array.isArray((_rawParsed as Record<string, unknown>).issues)
            ? ((_rawParsed as Record<string, unknown>).issues as RawAnn[])
            : []

      const VALID_TYPES = new Set<string>(['missing', 'ambiguous', 'misleading', 'conflicting'])
      const validIds = new Set([
        ...currentSpec.functions.map(f => f.id),
        ...currentSpec.values.map(v => v.id),
        ...currentSpec.solutions.map(s => s.id),
        ...(currentSpec.constraints ?? []).map(c => c.id),
      ])

      const annotations: SpecAnnotation[] = parsed
        .filter(a => a.entryId && VALID_TYPES.has(a.type ?? '') && validIds.has(a.entryId ?? ''))
        .map(a => ({
          entryId:       a.entryId as string,
          type:          a.type as AnnotationType,
          note:          a.note ?? '',
          conflictsWith: Array.isArray(a.conflictsWith) ? a.conflictsWith : [],
          source:        'ai' as const,
          updatedAt:     new Date().toISOString(),
        }))

      _lastRunAt.value = new Date()
      _progress.value = 100
      return annotations

    } catch (err) {
      _error.value = err instanceof Error ? err.message : 'Quality check failed'
      _progress.value = 0
      return []
    } finally {
      clearInterval(_tick)
      _loading.value = false
    }
  }

  return {
    loading:   _loading,
    error:     _error,
    lastRunAt: _lastRunAt,
    progress:  _progress,
    runCheck,
  }
}
