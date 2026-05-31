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

import Anthropic from '@anthropic-ai/sdk'
import { ref } from 'vue'
import { MODEL_ID } from '../config/llm'

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
  draftStatus: 'idle' | 'drafting' | 'done' | 'error'
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

// ── LLM client (same pattern as useSpecQualityCheck.ts) ───────────────────────

function _getClient(): Anthropic {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined
  return new Anthropic({ apiKey: apiKey ?? '', dangerouslyAllowBrowser: true, timeout: 120_000 })
}

// ── JSON extraction helper ────────────────────────────────────────────────────

function _extractJson<T>(text: string): T {
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  try { return JSON.parse(stripped) as T } catch { /* */ }
  try { return JSON.parse(text.trim()) as T } catch { /* */ }
  const objMatch = stripped.match(/\{[\s\S]*\}/)
  if (objMatch) { try { return JSON.parse(objMatch[0]) as T } catch { /* */ } }
  throw new Error('Could not extract valid JSON from AI response')
}

// ── AI Draft function ─────────────────────────────────────────────────────────

async function draftAttributes(stakeholderId: string, abortSignal?: AbortSignal): Promise<void> {
  const idx = stakeholders.value.findIndex(s => s.id === stakeholderId)
  if (idx === -1) return

  // Mark as drafting
  stakeholders.value[idx] = {
    ...stakeholders.value[idx],
    draftStatus: 'drafting',
    draftError: undefined,
  }
  _save()

  const sh = stakeholders.value[idx]

  const attrList = ATTRIBUTE_DEFS.map(a =>
    `  - ${a.id} (${a.name}): ${a.description} Scale 1=${a.levels[0].label} ... 5=${a.levels[4].label}`,
  ).join('\n')

  const systemPrompt = `You are an expert stakeholder analyst trained in Tom Gilb's Planguage and Stakeholder Engineering. \
For each attribute, provide a level (1-5), the matching level label, confidence, a REAL non-fabricated source URL, \
a specific source fact, and a brief rationale. \
If you do not know a specific URL, use a well-known authoritative source (Wikipedia, annual report, official government site, reputable news). \
Do NOT invent URLs. Return ONLY valid JSON with no prose or markdown fences.`

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
    const client = _getClient()
    const now = new Date().toISOString()

    const response = await client.messages.create(
      {
        model: MODEL_ID,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      },
      { signal: abortSignal },
    )

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')

    type AttrRaw = {
      value: number
      levelLabel: string
      confidence: string
      sourceUrl: string
      sourceFact: string
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
  // Auto-fire AI draft
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
  // Re-draft if name/role/type/description changed
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
    draftAttributes,
  }
}
