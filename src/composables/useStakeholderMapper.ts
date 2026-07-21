/**
 * useStakeholderMapper — persistent stakeholder registry with AI-drafted attribute levels.
 *
 * Each stakeholder has 10 attributes (Power, Interest, Influence, Support, Knowledge,
 * Resources, Urgency, Legitimacy, Network, RiskLevel). For each attribute the AI provides:
 *   - Current level (1–5)
 *   - Level label (e.g. "Influential")
 *   - Confidence: 'high' | 'medium' | 'low'
 *   - sourceUrl: a real, non-fabricated URL (Tom Gilb rule: must cite a URL)
 *   - sourceFact: the specific fact justifying the level (e.g. "Google had $76B cash 2023")
 *   - aiRationale: 1–2 sentence explanation
 *
 * Singleton, localStorage key 'sem-stakeholder-mapper-v1'.
 * Twin-portable: all types are plain data records.
 */

// r41 v185 — Tom Gilb 2026-06-19 "thanks, now sem and leftovers" + "pls do
// all requests".  The v176 Claudian-routed migration is REVERTED to match
// the v184 reversal of Plan Importer.  Same reasoning: the round-trip
// (prompt → paste into Claudian → paste reply → click Apply) is too much
// friction.  Direct-Anthropic call restored.  The Claudian-routed helpers
// (requestClaudianDraft / applyClaudianResult / loadDraftsFromDisk) stay
// exported as opt-in alternatives.  Trade-off: yesterday's Google LLC
// quota-exceeded error can return; accepted by Tom in exchange for
// removing the round-trip.  Claude-Code-as-AI-Layer SUPREME rule is
// therefore CARVED-OUT for both Plan Importer (v184) and Stakeholder
// Mapper (v185) per Tom's explicit waiver.
import Anthropic from '@anthropic-ai/sdk'
import { ref } from 'vue'
import { MODEL_ID } from '../config/llm'
import { CANONICAL_PLANGUAGE_DISCIPLINE_PROMPT } from '../config/planguagePrompt'

// ── Public types ──────────────────────────────────────────────────────────────

export type StakeholderType =
  | 'person'
  | 'organization'
  | 'government'
  | 'system'
  | 'regulatory'
  | 'inanimate'

export interface AttributeLevel {
  value: number             // 1–5
  levelLabel: string        // e.g. "Decisive"
  confidence: 'high' | 'medium' | 'low'
  sourceUrl: string         // REAL url, not fabricated
  sourceFact: string        // specific fact backing the level
  aiRationale: string       // 1–2 sentence explanation
  lastUpdated: string       // ISO timestamp
}

export interface MappedStakeholder {
  id: string
  name: string              // e.g. "Google LLC" / "Germany" / "GDPR Regulation"
  role: string              // e.g. "Primary Customer" / "Regulatory Body"
  type: StakeholderType
  description: string       // 1–2 sentence context
  attributes: Record<string, AttributeLevel>  // keyed by ATTRIBUTE_DEFS[i].id
  /** r41 v185 — restored to direct-Anthropic lifecycle.
   *  `idle`               — never analyzed
   *  `drafting`           — direct Anthropic API call in progress
   *  `done`               — API returned a valid result and it was applied
   *  `error`              — API call failed (quota / network / parse)
   *  `awaiting-claudian`  — retained for opt-in Claudian-routed flow */
  draftStatus: 'idle' | 'drafting' | 'awaiting-claudian' | 'done' | 'error'
  draftError?: string
  source: 'sample' | 'user'
  createdAt: number
  lastAnalyzed?: string
}

// ── Attribute definitions ─────────────────────────────────────────────────────

export interface AttributeLevelDef {
  value: number
  label: string
  description: string
}

export interface AttributeDef {
  id: string
  name: string
  description: string
  scaleMin: 1
  scaleMax: 5
  levels: AttributeLevelDef[]
}

export const ATTRIBUTE_DEFS: AttributeDef[] = [
  {
    id: 'power',
    name: 'Power',
    description: 'The stakeholder\'s authority to make binding decisions or enforce outcomes.',
    scaleMin: 1,
    scaleMax: 5,
    levels: [
      { value: 1, label: 'Negligible', description: 'Has no meaningful authority over project decisions or outcomes.' },
      { value: 2, label: 'Low',        description: 'Can influence minor decisions but lacks formal authority over key outcomes.' },
      { value: 3, label: 'Moderate',   description: 'Has authority over a defined domain that affects the project.' },
      { value: 4, label: 'High',       description: 'Controls significant resources or decisions that shape project direction.' },
      { value: 5, label: 'Decisive',   description: 'Ultimate authority; can unilaterally approve, block, or cancel the project.' },
    ],
  },
  {
    id: 'interest',
    name: 'Interest',
    description: 'The degree to which the stakeholder is concerned with the project\'s outcomes.',
    scaleMin: 1,
    scaleMax: 5,
    levels: [
      { value: 1, label: 'Indifferent', description: 'Shows no interest in the project; unlikely to engage.' },
      { value: 2, label: 'Aware',       description: 'Knows the project exists but has minimal personal stake in it.' },
      { value: 3, label: 'Concerned',   description: 'Tracks progress and outcomes that affect their domain.' },
      { value: 4, label: 'Invested',    description: 'Actively engaged; outcomes meaningfully affect their goals.' },
      { value: 5, label: 'Critical',    description: 'Project outcomes are central to their mission or survival.' },
    ],
  },
  {
    id: 'influence',
    name: 'Influence',
    description: 'The stakeholder\'s capacity to shape others\' opinions, decisions, or behaviours without formal authority.',
    scaleMin: 1,
    scaleMax: 5,
    levels: [
      { value: 1, label: 'Isolated',         description: 'Has no meaningful reach beyond immediate personal contacts.' },
      { value: 2, label: 'Local',             description: 'Can influence a small team or immediate working group.' },
      { value: 3, label: 'Cross-functional',  description: 'Recognised across multiple teams or departments.' },
      { value: 4, label: 'Domain-wide',       description: 'Seen as a thought leader within an entire industry or sector.' },
      { value: 5, label: 'Pervasive',         description: 'Broad societal or global influence; widely cited or followed.' },
    ],
  },
  {
    id: 'support',
    name: 'Support',
    description: 'The stakeholder\'s current disposition toward the project — from active opposition to active championship.',
    scaleMin: 1,
    scaleMax: 5,
    levels: [
      { value: 1, label: 'Active Opponent', description: 'Actively working to block, undermine, or cancel the project.' },
      { value: 2, label: 'Resistant',       description: 'Opposed to the project but not actively sabotaging it.' },
      { value: 3, label: 'Neutral',         description: 'Neither for nor against; may participate if asked.' },
      { value: 4, label: 'Supportive',      description: 'Generally in favour; willing to help when asked.' },
      { value: 5, label: 'Champion',        description: 'Actively advocates for the project and brings others along.' },
    ],
  },
  {
    id: 'knowledge',
    name: 'Knowledge',
    description: 'The stakeholder\'s domain expertise relevant to the project.',
    scaleMin: 1,
    scaleMax: 5,
    levels: [
      { value: 1, label: 'Novice',     description: 'Has no relevant background knowledge; requires full explanation.' },
      { value: 2, label: 'Basic',      description: 'Understands general concepts but lacks depth in this domain.' },
      { value: 3, label: 'Competent',  description: 'Has working knowledge; can contribute meaningfully to discussions.' },
      { value: 4, label: 'Expert',     description: 'Deep specialist knowledge; a key source of technical insight.' },
      { value: 5, label: 'Master',     description: 'World-class authority; defines standards or methods in this domain.' },
    ],
  },
  {
    id: 'resources',
    name: 'Resources',
    description: 'The stakeholder\'s access to financial, human, or material resources relevant to the project.',
    scaleMin: 1,
    scaleMax: 5,
    levels: [
      { value: 1, label: 'Negligible',   description: 'No meaningful resources to contribute or deploy.' },
      { value: 2, label: 'Modest',       description: 'Limited budget or personnel; can assist on a small scale.' },
      { value: 3, label: 'Significant',  description: 'Sufficient resources to co-fund or co-staff key activities.' },
      { value: 4, label: 'Substantial',  description: 'Major resource provider; their backing materially changes scope.' },
      { value: 5, label: 'Vast',         description: 'Near-unlimited resources relative to project needs.' },
    ],
  },
  {
    id: 'urgency',
    name: 'Urgency',
    description: 'The time-sensitivity of the stakeholder\'s claims on the project.',
    scaleMin: 1,
    scaleMax: 5,
    levels: [
      { value: 1, label: 'None',     description: 'No time pressure; outcomes can be addressed whenever convenient.' },
      { value: 2, label: 'Low',      description: 'Prefers timely delivery but can tolerate delays.' },
      { value: 3, label: 'Medium',   description: 'Has a meaningful timeline; delays cause friction.' },
      { value: 4, label: 'High',     description: 'Operating under tight deadlines; delays cause measurable harm.' },
      { value: 5, label: 'Critical', description: 'Immediate action required; every delay risks severe consequences.' },
    ],
  },
  {
    id: 'legitimacy',
    name: 'Legitimacy',
    description: 'The perceived validity or appropriateness of the stakeholder\'s claim on the project.',
    scaleMin: 1,
    scaleMax: 5,
    levels: [
      { value: 1, label: 'Questionable',  description: 'Claim is widely seen as weak, self-serving, or illegitimate.' },
      { value: 2, label: 'Informal',      description: 'Claim is recognised informally but has no official backing.' },
      { value: 3, label: 'Formal',        description: 'Claim is backed by a contract, role, or formal agreement.' },
      { value: 4, label: 'Established',   description: 'Claim is well-recognised by all parties; a core stakeholder.' },
      { value: 5, label: 'Unquestioned',  description: 'Claim is legally mandated or universally accepted as authoritative.' },
    ],
  },
  {
    id: 'network',
    name: 'Network',
    description: 'The stakeholder\'s connections to other stakeholders that amplify their reach and influence.',
    scaleMin: 1,
    scaleMax: 5,
    levels: [
      { value: 1, label: 'Isolated',        description: 'Has few relevant connections; acts largely alone.' },
      { value: 2, label: 'Small',           description: 'Connected to a small cluster of related parties.' },
      { value: 3, label: 'Moderate',        description: 'Has a useful network spanning multiple relevant parties.' },
      { value: 4, label: 'Well-connected',  description: 'Known and connected to most key players in the ecosystem.' },
      { value: 5, label: 'Hub',             description: 'A central node; nearly all relevant parties connect through them.' },
    ],
  },
  {
    id: 'riskLevel',
    name: 'Risk Level',
    description: 'The degree of risk this stakeholder poses to the project if not properly engaged.',
    scaleMin: 1,
    scaleMax: 5,
    levels: [
      { value: 1, label: 'Negligible',  description: 'Poses no meaningful risk even if ignored.' },
      { value: 2, label: 'Low',         description: 'Minor disruption possible if disengaged.' },
      { value: 3, label: 'Moderate',    description: 'Can cause schedule or scope problems if not managed.' },
      { value: 4, label: 'High',        description: 'Could derail the project or cause major rework.' },
      { value: 5, label: 'Critical',    description: 'Has the power to terminate or fundamentally alter the project.' },
    ],
  },
]

// ── Pre-loaded sample stakeholders ───────────────────────────────────────────

const _SAMPLES: MappedStakeholder[] = [
  {
    id: 'sample-google',
    name: 'Google LLC',
    role: 'Platform Provider',
    type: 'organization',
    description: 'Multinational technology company providing cloud, search, and AI infrastructure used by the project.',
    attributes: {},
    draftStatus: 'idle',
    source: 'sample',
    createdAt: 0,
  },
  {
    id: 'sample-eu',
    name: 'European Union',
    role: 'Regulatory Body',
    type: 'government',
    description: 'Supranational body whose GDPR, AI Act, and Digital Markets Act directly constrain system design and data handling.',
    attributes: {},
    draftStatus: 'idle',
    source: 'sample',
    createdAt: 0,
  },
  {
    id: 'sample-tom-gilb',
    name: 'Tom Gilb',
    role: 'Visionary / Author',
    type: 'person',
    description: 'Creator of Planguage and Evolutionary Project Management. Defines the methodology this system implements.',
    attributes: {},
    draftStatus: 'idle',
    source: 'sample',
    createdAt: 0,
  },
  {
    id: 'sample-customer-data',
    name: 'Customer Personal Data',
    role: 'Compliance Subject',
    type: 'inanimate',
    description: 'All personal data held on behalf of customers — has GDPR rights and requires explicit handling obligations.',
    attributes: {},
    draftStatus: 'idle',
    source: 'sample',
    createdAt: 0,
  },
]

// ── Storage ───────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'sem-stakeholder-mapper-v1'

// ── Module-level singleton state ──────────────────────────────────────────────

const stakeholders = ref<MappedStakeholder[]>([..._SAMPLES.map(s => ({ ...s, attributes: {} }))])
const selectedId   = ref<string | null>(null)

function _load(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as MappedStakeholder[]
      if (Array.isArray(parsed) && parsed.length > 0) {
        stakeholders.value = parsed
        return
      }
    }
  } catch {
    // ignore parse errors — fall through to defaults
  }
  // No saved data — use clean samples
  stakeholders.value = _SAMPLES.map(s => ({ ...s, attributes: {} }))
}

function _save(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stakeholders.value))
}

_load()

// ── r41 v185 — Direct-Anthropic flow restored ────────────────────────────────
// apiKey is optional in local mode — the ollamaAdapter ignores it entirely.
const _client = new Anthropic({
  apiKey:                  (import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined) ?? 'local',
  dangerouslyAllowBrowser: true,
  timeout:                 120_000,
})

/** Robust extractor for both the direct API path and the paste-back path. */
function _extractJson<T>(text: string): T {
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  try { return JSON.parse(stripped) as T } catch { /* fall through */ }
  try { return JSON.parse(text.trim()) as T } catch { /* fall through */ }
  const objMatch = stripped.match(/\{[\s\S]*\}/)
  if (objMatch) { try { return JSON.parse(objMatch[0]) as T } catch { /* fall through */ } }
  throw new Error('Could not extract valid JSON from AI response')
}

export async function draftAttributes(stakeholderId: string, abortSignal?: AbortSignal): Promise<void> {
  const idx = stakeholders.value.findIndex(s => s.id === stakeholderId)
  if (idx === -1) return

  stakeholders.value[idx] = {
    ...stakeholders.value[idx],
    draftStatus: 'drafting',
    draftError:  undefined,
  }
  _save()

  const sh = stakeholders.value[idx]
  const attrList = ATTRIBUTE_DEFS.map(a =>
    `  - ${a.id} (${a.name}): ${a.description} Scale 1=${a.levels[0].label} ... 5=${a.levels[4].label}`,
  ).join('\n')

  // r41 v271 (Tom Gilb 2026-06-21 "sweep the rest"): canonical primer imported.
  // The Stakeholder discipline + parameter-discipline rules now flow from the
  // canonical primer; this prompt only adds the attribute-scoring-specific
  // framing (10 attributes × {level 1-5, label, confidence, sourceUrl,
  // sourceFact, aiRationale}) which is the caller-specific JSON shape.
  const systemPrompt = `You are an expert stakeholder analyst trained in Tom Gilb's Planguage and Stakeholder Engineering.

== STAKEHOLDER-ATTRIBUTE-SCORING INPUT FORMAT (input shape for this caller) ==
You are given a Stakeholder + a list of 10 attribute scales (each 1-5). For
EACH attribute, draft: level (1-5), matching level label, confidence, a REAL
non-fabricated source URL, a specific source fact, and a brief rationale.
If you do not know a specific URL, use a well-known authoritative source
(Wikipedia, annual report, official government site, reputable news). Do
NOT invent URLs.

${CANONICAL_PLANGUAGE_DISCIPLINE_PROMPT}

== STAKEHOLDER-ATTRIBUTE-SCORING SPECIFIC NOTES ==
• Stakeholder DEFINITION: ONE sentence ≤ 20 words (per canonical primer Stakeholder discipline above). NEVER a paragraph.
• aiRationale per attribute: 1 short sentence ≤ 25 words — just the WHY of the level chosen. Save metric data for the dedicated parameter fields.
• sourceFact: 1 short concrete fact backing the level. Not a narrative summary.
• Return ONLY valid JSON with no prose or markdown fences.`

  const userPrompt = `Analyse this stakeholder and draft all 10 attribute levels:

Name: ${sh.name}
Role: ${sh.role}
Type: ${sh.type}
Description: ${sh.description}

ATTRIBUTES TO SCORE:
${attrList}

Return JSON exactly in this shape:
{
  "attributes": {
    "<attrId>": {
      "value": <1-5>,
      "levelLabel": "<label from scale>",
      "confidence": "<high|medium|low>",
      "sourceUrl": "<real URL>",
      "sourceFact": "<specific fact backing the level>",
      "aiRationale": "<1-2 sentence explanation>"
    }
  }
}`

  try {
    const now = new Date().toISOString()
    const response = await _client.messages.create(
      {
        model:      MODEL_ID,
        max_tokens: 4096,
        system:     systemPrompt,
        messages:   [{ role: 'user', content: userPrompt }],
      },
      { signal: abortSignal },
    )

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')

    type AttrRaw = {
      value:       number
      levelLabel:  string
      confidence:  string
      sourceUrl:   string
      sourceFact:  string
      aiRationale: string
    }
    const parsed = _extractJson<{ attributes: Record<string, AttrRaw> }>(text)

    const updatedAttributes: Record<string, AttributeLevel> = {}
    for (const def of ATTRIBUTE_DEFS) {
      const raw = parsed.attributes?.[def.id]
      if (!raw) continue
      updatedAttributes[def.id] = {
        value:       Math.min(5, Math.max(1, Math.round(raw.value ?? 3))),
        levelLabel:  raw.levelLabel ?? def.levels[2].label,
        confidence:  (['high', 'medium', 'low'].includes(raw.confidence) ? raw.confidence : 'medium') as 'high' | 'medium' | 'low',
        sourceUrl:   raw.sourceUrl ?? '',
        sourceFact:  raw.sourceFact ?? '',
        aiRationale: raw.aiRationale ?? '',
        lastUpdated: now,
      }
    }

    const currentIdx = stakeholders.value.findIndex(s => s.id === stakeholderId)
    if (currentIdx !== -1) {
      stakeholders.value[currentIdx] = {
        ...stakeholders.value[currentIdx],
        attributes:   updatedAttributes,
        draftStatus:  'done',
        draftError:   undefined,
        lastAnalyzed: now,
      }
      _save()
    }
  } catch (err: unknown) {
    if ((err as { name?: string }).name === 'AbortError') return
    const currentIdx = stakeholders.value.findIndex(s => s.id === stakeholderId)
    if (currentIdx !== -1) {
      stakeholders.value[currentIdx] = {
        ...stakeholders.value[currentIdx],
        draftStatus: 'error',
        draftError:  err instanceof Error ? err.message : 'AI analysis failed',
      }
      _save()
    }
  }
}

// ── Claudian-routed analysis flow (r41 v176) ──────────────────────────────────
// Per the Claude-Code-as-AI-Layer SUPREME rule, the SEM App never calls an
// external AI API at runtime.  Instead, Tom invokes Claudian (this Claude
// Code session) and Claudian does the work:
//
//   1. Planner clicks "Request Claudian Analysis" on a stakeholder
//   2. The composable marks the stakeholder `awaiting-claudian` AND copies
//      a ready-to-paste prompt to the system clipboard
//   3. Tom pastes the prompt into a Claudian chat (or runs Claudian against
//      the sem-app repo)
//   4. Claudian returns a Planguage-shaped result (the canonical structured-
//      data form used everywhere in SEM, per the existing rule on the term)
//   5. The planner pastes the result back via "Paste Claudian Result", OR
//      Claudian writes it to `public/data/stakeholderDrafts.json` and the
//      planner clicks "Refresh from disk"
//   6. The composable parses + validates + applies the result; status → done
//
// No API key, no quota cliff, no browser-side network call to an AI provider.

/** Where Claudian writes the batch-result file when running against the
 *  sem-app repo.  Vite serves anything under `public/` at the root, so a
 *  `fetch('/data/stakeholderDrafts.json')` in the browser reads what
 *  Claudian wrote on disk. */
const DRAFTS_FILE_URL = '/data/stakeholderDrafts.json'

/** Robust Planguage-result extractor.  Accepts a raw paste that may include
 *  markdown fences, surrounding prose, or just the bare result. */
function _extractStructuredResult<T>(text: string): T {
  const stripped = text.replace(/^```(?:json|pl|planguage)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  try { return JSON.parse(stripped) as T } catch { /* fall through */ }
  try { return JSON.parse(text.trim()) as T } catch { /* fall through */ }
  const objMatch = stripped.match(/\{[\s\S]*\}/)
  if (objMatch) { try { return JSON.parse(objMatch[0]) as T } catch { /* fall through */ } }
  throw new Error('Could not extract a valid Planguage result from the pasted text.')
}

/** Build the prompt Claudian needs to draft a stakeholder's 10 attributes.
 *  Pure function — no side effects.  Returned string is paste-ready. */
export function buildClaudianStakeholderPrompt(stakeholderId: string): string | null {
  const sh = stakeholders.value.find(s => s.id === stakeholderId)
  if (!sh) return null

  const attrList = ATTRIBUTE_DEFS.map(a =>
    `  - ${a.id} (${a.name}): ${a.description} Scale 1=${a.levels[0].label} ... 5=${a.levels[4].label}`,
  ).join('\n')

  return `You are an expert stakeholder analyst trained in Tom Gilb's Planguage and Stakeholder Engineering.  For the stakeholder below, draft all 10 attribute levels.  For each attribute provide: a level (1-5), the matching level label, a confidence rating, a REAL non-fabricated source URL, a specific source fact, and a brief rationale.

If you do not know a specific URL, use a well-known authoritative source (Wikipedia, annual report, official government site, reputable news).  Do NOT invent URLs.

Return ONLY a valid Planguage Representation (the canonical structured-data form used in SEM App), with no surrounding prose and no markdown fences.

━━ TOM GILB SUPREME RULE 2026-06-16 — STAKEHOLDER PARAMETER DISCIPLINE ━━
Tom Gilb 2026-06-16 verbatim: "Planguage specification is NOT about writing a story. It is about specifying entities with a series of short parameter descriptions.  Learn from the standards and my books.  Do not fall back on massive paragraphs."

• Stakeholder DEFINITION: ONE sentence ≤ 20 words.  Identifies + DISTINGUISHES this stakeholder from any other similar one.  NEVER a paragraph.  NEVER includes metrics, business case, rationale, or scale.
• aiRationale per attribute: 1 short sentence ≤ 25 words.  Just the WHY of the level chosen.  Save metric data for the dedicated parameter fields.
• sourceFact: 1 short concrete fact backing the level.  Not a narrative summary.

Reference: Tom Gilb · Competitive Engineering · Stakeholder Engineering · 10.Standard/Standard.Kai-Zen/Template_Write_Stakeholder.md
━━ END SUPREME RULE ━━

STAKEHOLDER:
  Stakeholder ID: ${sh.id}
  Name: ${sh.name}
  Role: ${sh.role}
  Type: ${sh.type}
  Description: ${sh.description}

ATTRIBUTES TO SCORE:
${attrList}

Return exactly this Planguage Representation shape:
{
  "stakeholderId": "${sh.id}",
  "attributes": {
    "<attrId>": {
      "value": <1-5>,
      "levelLabel": "<label from scale>",
      "confidence": "<high|medium|low>",
      "sourceUrl": "<real URL>",
      "sourceFact": "<specific fact backing the level>",
      "aiRationale": "<1-2 sentence explanation>"
    }
  }
}

When you have many stakeholders to draft in one pass, write the combined result to:
  sem-app/public/data/stakeholderDrafts.json
in the shape:
{
  "generatedAt": "<ISO timestamp>",
  "results": [ { "stakeholderId": "...", "attributes": { ... } }, ... ]
}
The planner will click "Refresh from disk" in the panel to pull it in.`
}

/** Mark a stakeholder as awaiting Claudian, build the prompt, and copy it
 *  to the system clipboard.  Returns the prompt text so the caller can
 *  also display it (e.g. in a textarea for manual copy when clipboard
 *  permission is denied). */
export async function requestClaudianDraft(stakeholderId: string): Promise<string | null> {
  const idx = stakeholders.value.findIndex(s => s.id === stakeholderId)
  if (idx === -1) return null

  const prompt = buildClaudianStakeholderPrompt(stakeholderId)
  if (!prompt) return null

  stakeholders.value[idx] = {
    ...stakeholders.value[idx],
    draftStatus: 'awaiting-claudian',
    draftError:  undefined,
  }
  _save()

  // Best-effort clipboard copy.  If the browser denies (no user gesture or
  // permission), the panel's textarea is the fallback so the planner can
  // copy manually.
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(prompt)
    }
  } catch {
    // intentional swallow — fallback is the panel textarea
  }

  return prompt
}

/** Apply a Planguage result that Claudian produced.  Accepts the raw paste;
 *  extracts the structured result; validates against the attribute schema;
 *  writes to the matching stakeholder.  Throws on parse failure so the
 *  caller can show a friendly error. */
export function applyClaudianResult(stakeholderId: string, pastedText: string): void {
  type AttrRaw = {
    value:       number
    levelLabel:  string
    confidence:  string
    sourceUrl:   string
    sourceFact:  string
    aiRationale: string
  }
  type ResultShape = {
    stakeholderId?: string
    attributes:     Record<string, AttrRaw>
  }

  const parsed = _extractStructuredResult<ResultShape>(pastedText)
  if (!parsed || typeof parsed !== 'object' || !parsed.attributes) {
    throw new Error('Pasted result is missing the "attributes" section.')
  }

  const now = new Date().toISOString()
  const updatedAttributes: Record<string, AttributeLevel> = {}
  for (const def of ATTRIBUTE_DEFS) {
    const raw = parsed.attributes[def.id]
    if (!raw) continue
    updatedAttributes[def.id] = {
      value:       Math.min(5, Math.max(1, Math.round(Number(raw.value) || 3))),
      levelLabel:  raw.levelLabel ?? def.levels[2].label,
      confidence:  (['high', 'medium', 'low'].includes(raw.confidence) ? raw.confidence : 'medium') as 'high' | 'medium' | 'low',
      sourceUrl:   raw.sourceUrl ?? '',
      sourceFact:  raw.sourceFact ?? '',
      aiRationale: raw.aiRationale ?? '',
      lastUpdated: now,
    }
  }

  if (Object.keys(updatedAttributes).length === 0) {
    throw new Error('Pasted result did not contain any of the 10 expected attributes.')
  }

  const idx = stakeholders.value.findIndex(s => s.id === stakeholderId)
  if (idx === -1) {
    throw new Error(`Stakeholder ${stakeholderId} no longer exists in the panel.`)
  }
  stakeholders.value[idx] = {
    ...stakeholders.value[idx],
    attributes:   updatedAttributes,
    draftStatus:  'done',
    draftError:   undefined,
    lastAnalyzed: now,
  }
  _save()
}

/** Fetch the batch-result file Claudian writes at
 *  `public/data/stakeholderDrafts.json`.  If present, apply every result to
 *  its matching stakeholder.  Returns the number of stakeholders updated.
 *  Returns 0 (and a friendly reason) if the file is missing or empty. */
export async function loadDraftsFromDisk(): Promise<{ updated: number; reason?: string }> {
  let res: Response
  try {
    res = await fetch(DRAFTS_FILE_URL, { cache: 'no-store' })
  } catch (err) {
    return { updated: 0, reason: `Could not fetch the drafts file (${err instanceof Error ? err.message : 'network error'}).` }
  }
  if (!res.ok) {
    return { updated: 0, reason: `No drafts file yet — Claudian has not written one.  Ask Claudian to draft a batch and write to public/data/stakeholderDrafts.json.` }
  }

  let body: unknown
  try {
    body = await res.json()
  } catch {
    return { updated: 0, reason: 'The drafts file exists but is not valid Planguage Representation.' }
  }

  type BatchShape = {
    generatedAt?: string
    results: Array<{
      stakeholderId: string
      attributes:    Record<string, {
        value:       number
        levelLabel:  string
        confidence:  string
        sourceUrl:   string
        sourceFact:  string
        aiRationale: string
      }>
    }>
  }
  const batch = body as BatchShape
  if (!batch.results || !Array.isArray(batch.results)) {
    return { updated: 0, reason: 'The drafts file is missing the "results" list.' }
  }

  let updated = 0
  for (const entry of batch.results) {
    try {
      applyClaudianResult(entry.stakeholderId, JSON.stringify(entry))
      updated += 1
    } catch {
      // skip — entry is for a stakeholder no longer in the panel, or malformed
    }
  }
  return { updated }
}

// ── Mutation functions ────────────────────────────────────────────────────────

function addStakeholder(
  name: string,
  role: string,
  type: StakeholderType,
  description: string,
): MappedStakeholder {
  const sh: MappedStakeholder = {
    id:          `user-${Date.now()}`,
    name:        name.trim(),
    role:        role.trim(),
    type,
    description: description.trim(),
    attributes:  {},
    draftStatus: 'idle',
    source:      'user',
    createdAt:   Date.now(),
  }
  stakeholders.value = [sh, ...stakeholders.value]
  _save()
  // r41 v185 — auto-fire restored.  New stakeholders kick off a direct
  // Anthropic draft immediately.
  void draftAttributes(sh.id)
  return sh
}

function removeStakeholder(id: string): void {
  stakeholders.value = stakeholders.value.filter(s => s.id !== id)
  if (selectedId.value === id) selectedId.value = null
  _save()
}

function updateStakeholder(id: string, patch: Partial<MappedStakeholder>): void {
  const idx = stakeholders.value.findIndex(s => s.id === id)
  if (idx === -1) return
  stakeholders.value[idx] = { ...stakeholders.value[idx], ...patch }
  _save()
  // r41 v185 — auto-redraft restored: name/role/type/description edits fire
  // a fresh direct Anthropic draft.
  if (patch.name !== undefined || patch.role !== undefined || patch.type !== undefined || patch.description !== undefined) {
    void draftAttributes(id)
  }
}

function selectStakeholder(id: string | null): void {
  selectedId.value = id
}

// ── Public composable ─────────────────────────────────────────────────────────

export function useStakeholderMapper() {
  return {
    stakeholders,
    selectedId,
    addStakeholder,
    removeStakeholder,
    updateStakeholder,
    selectStakeholder,
    // r41 v185 — direct-Anthropic flow restored.  draftAttributes is the
    // default; Claudian-routed helpers remain opt-in.
    draftAttributes,
    requestClaudianDraft,
    applyClaudianResult,
    loadDraftsFromDisk,
    buildClaudianStakeholderPrompt,
  }
}
