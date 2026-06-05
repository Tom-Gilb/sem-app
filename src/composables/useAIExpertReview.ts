// UNIT_TYPE=Composable
// useAIExpertReview — Feature #202b: AI Expert Reviewers for PHI
//
// One Expert = one named persona that reads the current SpecBlock + the rules
// the persona is configured to apply, and returns a single JSON object:
//
//   { "score": -10..+10, "why": "<short paragraph>" }
//
// The score × 10 maps to the PHI -100..+100 scale so the Expert's verdict is
// integrated into the overall Plan Health Index inside the 'ai-experts' group.
//
// LLM choice. Single-shot Anthropic Messages call (claude-sonnet-4-6 by
// default — same model as the rest of the app's LLM features). Output is
// strict JSON; we tolerate a trailing prose tail and a leading code fence.
//
// Mock mode. When VITE_ANTHROPIC_API_KEY is unset or VITE_MOCK_MODE='true',
// we synthesise a deterministic review from the spec content + persona prompt.
// This keeps the unit tests fast and free of external calls, AND lets the UI
// be demoed without an API key.

import Anthropic from '@anthropic-ai/sdk'
import type { SpecBlock } from '../types/spec'
import type { AIExpert, AIExpertReview } from './useSpecHealth'
import { MODEL_ID } from '../config/llm'

let _client: Anthropic | null = null

function getClient(): Anthropic | null {
  if (_client) return _client
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined
  if (!apiKey) return null
  _client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, timeout: 60_000 })
  return _client
}

/** Test-only — drop the cached client between mock + live runs. */
export function _resetExpertClient(): void { _client = null }

// ────────────────────────────────────────────────────────────────────────────
// Prompt construction
// ────────────────────────────────────────────────────────────────────────────

/**
 * Build the single user-message payload sent to the LLM. Includes:
 *  • Persona / domain framing (system-prompt-style preamble)
 *  • Active rule set (built-in or custom, depending on `ruleMode`)
 *  • The plan itself, JSON-serialised (truncated if oversized)
 *  • Strict output contract: ONLY a JSON object {score, why}
 */
function buildExpertPrompt(expert: AIExpert, spec: SpecBlock, planVersion: string): { prompt: string; ruleCount: number } {
  const { activeRules, ruleCount } = collectActiveRules(expert)
  const persona = expert.systemPromptOverride?.trim() || defaultPersonaPrompt(expert)

  // Cap spec serialisation so the request fits comfortably under 8k input tokens
  // even on giant plans. JSON pretty-printed at 2-space indent.
  const specJson = JSON.stringify(spec, null, 2).slice(0, 14_000)

  const prompt = `${persona}

== PLAN VERSION ==
${planVersion || '(unversioned)'}

== ACTIVE RULES (${ruleCount}) ==
${activeRules}

== PLAN (Planguage SpecBlock JSON) ==
\`\`\`json
${specJson}
\`\`\`

== YOUR TASK ==
Read the plan through the lens of your domain (${expert.domain}) and the active rules above.
Return your verdict as a SINGLE JSON object — no prose, no code fences:

{
  "score":      <integer from -10 (catastrophic for ${expert.domain}) to +10 (perfect for ${expert.domain})>,
  "why":        "<one short paragraph (3-6 sentences) explaining the score, naming concrete F./V./S. ids where relevant>",
  "references": ["<url1>", "<url2>", ...]  // REQUIRED: at least one real URL
}

Anchors:
  +10 = exceptional / nothing to improve from a ${expert.domain} POV
  + 5 = solidly above average, minor concerns
    0 = neither good nor bad / insufficient signal
  - 5 = clearly below standard, several concerns
  -10 = catastrophic — this plan will fail on ${expert.domain} grounds

Be concise. Be specific. Reference IDs (e.g. V.OnboardingSpeed) when you can.

URL REQUIREMENT (mandatory):
"references" must contain AT LEAST ONE real, publicly-reachable URL the
reader can open to verify or learn more about your reasoning — e.g. an
OWASP cheat-sheet for Security, an ISO/NIST standard for Quality, a
Harvard Business Review article for ROI, a published post-mortem for
Risk, a WCAG/Nielsen Norman page for Usability. Prefer canonical sources
over blog posts. NEVER invent a URL — if you only know a topic name, cite
the topic's well-known canonical URL (e.g. https://owasp.org/Top10/).`

  return { prompt, ruleCount }
}

function defaultPersonaPrompt(expert: AIExpert): string {
  return `You are "${expert.name}", an expert reviewer specialising in ${expert.domain}.
Your job: read a Planguage plan and judge it from the ${expert.domain} perspective.
${expert.description ? `\nFocus areas: ${expert.description}` : ''}`
}

/** Assemble the rule list according to `ruleMode`. The default Planguage rule
 *  set is intentionally compact — keeps prompt cost low. */
function collectActiveRules(expert: AIExpert): { activeRules: string; ruleCount: number } {
  if (expert.ruleMode === 'custom') {
    const txt = (expert.customRules ?? '').trim()
    if (!txt) return { activeRules: '(no custom rules supplied — judge on professional ' + expert.domain + ' standards)', ruleCount: 0 }
    const lines = txt.split('\n').filter(l => l.trim()).length
    return { activeRules: txt, ruleCount: lines }
  }

  const all = BUILT_IN_RULES
  if (expert.ruleMode === 'select' && expert.selectedRuleIds && expert.selectedRuleIds.length > 0) {
    const sel = all.filter(r => expert.selectedRuleIds!.includes(r.id))
    return {
      activeRules: sel.map(r => `[${r.id}] ${r.text}`).join('\n'),
      ruleCount: sel.length,
    }
  }
  return {
    activeRules: all.map(r => `[${r.id}] ${r.text}`).join('\n'),
    ruleCount: all.length,
  }
}

/** Built-in Planguage / governance rules an Expert can choose to apply.
 *  Kept short and quotable so they land cleanly inside the LLM prompt. */
export const BUILT_IN_RULES: Array<{ id: string; text: string; category: string }> = [
  { id: 'PG.V.Scale',         category: 'Planguage', text: 'Every V. (Value) must declare a Scale.' },
  { id: 'PG.V.Meter',         category: 'Planguage', text: 'Every V. must declare a Meter.' },
  { id: 'PG.V.Goal',          category: 'Planguage', text: 'Every V. must declare a Goal threshold.' },
  { id: 'PG.V.Tolerable',     category: 'Planguage', text: 'Every V. must declare a Tolerable threshold (worst acceptable).' },
  { id: 'PG.F.Binary',        category: 'Planguage', text: 'F. successCriteria must be binary capability — no numbers/percentages.' },
  { id: 'PG.S.ImpactsV',      category: 'Planguage', text: 'Every S. (Solution) must impact at least one declared V.' },
  { id: 'PG.IDs.Unique',      category: 'Planguage', text: 'F./V./S. IDs must be unique across the plan.' },
  { id: 'GV.PlanOwner',       category: 'Governance', text: 'Plan must have at least one named Plan Owner accountable for outcomes.' },
  { id: 'GV.SpecOwners',      category: 'Governance', text: 'Spec areas should have named owners — single-owner concentration is a risk.' },
  { id: 'GV.Reversible',      category: 'Governance', text: 'High-impact S. should have a documented rollback / kill-switch.' },
  { id: 'GV.RiskMitigation',  category: 'Governance', text: 'Named risks should have a corresponding mitigating S.' },
  { id: 'GV.NoTBD',           category: 'Governance', text: 'No "TBD" / "TODO" / "???" tokens left in shipped specs.' },
  { id: 'GV.Stakeholders',    category: 'Governance', text: 'Every named stakeholder should have at least one V. they care about.' },
]

// ────────────────────────────────────────────────────────────────────────────
// Response parsing
// ────────────────────────────────────────────────────────────────────────────

function parseExpertResponse(raw: string): { score: number; why: string; references: string[] } {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  let parsed: { score?: unknown; why?: unknown; references?: unknown } | null = null
  try { parsed = JSON.parse(cleaned) } catch {
    // Fallback: capture the first {…} that contains both score and why keys.
    const m = cleaned.match(/\{[\s\S]*?"score"[\s\S]*?"why"[\s\S]*?\}/)
    if (m) try { parsed = JSON.parse(m[0]) } catch { /* fall through */ }
  }
  if (!parsed || typeof parsed.score !== 'number' || typeof parsed.why !== 'string') {
    throw new Error(`Expert response is not the expected {score, why} JSON: ${raw.slice(0, 200)}`)
  }
  const score = Math.max(-10, Math.min(10, Math.round(parsed.score)))
  const why = parsed.why.trim()
  if (!why) throw new Error('Expert response had an empty "why"')

  // Pull URLs out of the "references" array first; tolerate raw strings or
  // {"url": "..."} entries. If the model forgot the field, sweep the "why"
  // body for any URLs as a last-chance fallback so we never lose them.
  const refs: string[] = []
  if (Array.isArray(parsed.references)) {
    for (const r of parsed.references) {
      if (typeof r === 'string' && /^https?:\/\//i.test(r.trim())) refs.push(r.trim())
      else if (r && typeof r === 'object' && typeof (r as any).url === 'string' && /^https?:\/\//i.test((r as any).url)) {
        refs.push((r as any).url.trim())
      }
    }
  }
  if (refs.length === 0) {
    const found = why.match(/https?:\/\/[^\s)\]]+/g)
    if (found) for (const u of found) refs.push(u)
  }
  return { score, why, references: dedupe(refs) }
}

function dedupe(xs: string[]): string[] {
  return Array.from(new Set(xs))
}

// ────────────────────────────────────────────────────────────────────────────
// Mock-mode review — deterministic, fast, free
// ────────────────────────────────────────────────────────────────────────────

/**
 * Derive a stable score from spec contents + persona. Used in tests and
 * whenever no API key is configured. The math is simple but produces
 * domain-flavoured scores (Quality Hawk gets penalised by missing meters,
 * Risk Inspector by single-S. coverage, etc.).
 */
function mockReview(expert: AIExpert, spec: SpecBlock, planVersion: string): AIExpertReview {
  const vMissingScale = spec.values.filter(v => !v.scale?.trim()).length
  const vMissingGoal  = spec.values.filter(v => !v.goal?.trim()).length
  const vMissingMeter = spec.values.filter(v => !v.meter?.trim()).length
  const sCount        = spec.solutions.length
  const vCount        = spec.values.length || 1

  // Per-domain weighting on the same defects produces distinct flavour
  let raw = 6 // mild positive baseline
  const dom = expert.domain.toLowerCase()
  if (dom.includes('quality')) {
    raw -= vMissingMeter * 1.5
    raw -= vMissingScale * 1.5
  } else if (dom.includes('risk')) {
    raw -= sCount < vCount ? (vCount - sCount) * 1.2 : 0
    raw -= vMissingGoal * 0.8
  } else if (dom.includes('roi')) {
    raw -= vMissingGoal * 1.4
    raw -= sCount === 0 ? 4 : 0
  } else if (dom.includes('security')) {
    const looksSensitive = JSON.stringify(spec).match(/auth|token|password|pii|consent|encrypt/gi)?.length ?? 0
    raw -= looksSensitive < 2 ? 3 : 0
  } else if (dom.includes('usability')) {
    raw -= vMissingMeter * 1.0
  } else {
    raw -= (vMissingScale + vMissingGoal + vMissingMeter) * 0.5
  }
  const score = Math.max(-10, Math.min(10, Math.round(raw)))

  const why = `[mock review] ${expert.name} (${expert.domain}) read v${planVersion || '?'} — ${spec.functions.length} F. / ${spec.values.length} V. / ${spec.solutions.length} S. ` +
              `Defects spotted: ${vMissingScale} V. without Scale, ${vMissingGoal} without Goal, ${vMissingMeter} without Meter. ` +
              `Score reflects domain-weighted impact of those defects on ${expert.domain}.`

  return {
    score,
    why,
    references: [mockReferenceFor(expert.domain)],
    ranAt: Date.now(),
    planVersion,
    ruleCount: collectActiveRules(expert).ruleCount,
    model: 'mock',
  }
}

/** Domain → canonical URL the mock reviewer always cites. Real reviews pull
 *  these from the LLM; this map only fires in offline / no-key mode. */
function mockReferenceFor(domain: string): string {
  const d = domain.toLowerCase()
  if (d.includes('security'))  return 'https://owasp.org/Top10/'
  if (d.includes('quality'))   return 'https://en.wikipedia.org/wiki/ISO/IEC_25010'
  if (d.includes('risk'))      return 'https://www.iso.org/iso-31000-risk-management.html'
  if (d.includes('roi'))       return 'https://hbr.org/2014/05/a-refresher-on-net-present-value'
  if (d.includes('usability')) return 'https://www.nngroup.com/articles/ten-usability-heuristics/'
  return 'https://en.wikipedia.org/wiki/Planguage'
}

// ────────────────────────────────────────────────────────────────────────────
// Public entry point
// ────────────────────────────────────────────────────────────────────────────

/**
 * Run a single Expert review. Always resolves; throws only on a real
 * unrecoverable error (network down, JSON malformed beyond repair).
 */
export async function runAIExpertReview(
  expert: AIExpert,
  spec: SpecBlock,
  planVersion: string,
): Promise<AIExpertReview> {
  const isMock =
    !import.meta.env.VITE_ANTHROPIC_API_KEY ||
    import.meta.env.VITE_MOCK_MODE === 'true'

  if (isMock) return mockReview(expert, spec, planVersion)

  const client = getClient()
  if (!client) return mockReview(expert, spec, planVersion)

  const { prompt, ruleCount } = buildExpertPrompt(expert, spec, planVersion)
  const response = await client.messages.create({
    model: MODEL_ID,
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  })
  const block = response.content.find(b => b.type === 'text')
  if (!block || block.type !== 'text') {
    throw new Error('Expert LLM call returned no text block')
  }
  const { score, why, references } = parseExpertResponse(block.text.trim())
  // Always supply at least one reference; if the model genuinely returned
  // none and the why-body had no URLs, fall back to a domain-canonical URL
  // so the UI's "more justification" link is never dead.
  const refs = references.length > 0 ? references : [mockReferenceFor(expert.domain)]
  return {
    score, why,
    references: refs,
    ranAt: Date.now(),
    planVersion,
    ruleCount,
    model: MODEL_ID,
  }
}
