// UNIT_TYPE=Hook
// useConflictAnalysis — detects stakeholder conflicts from a Planguage spec.
// Spec: 4Sol.S.StakeholderConflictDetector / 3P.F.DetectStakeholderConflicts
// Evo Step 12.
//
// Single Anthropic call with structured JSON output.
// Cache key: SHA-256 of serialised SpecBlock JSON — invalidated on any spec change.
// Mock mode: returns 2 canned conflict cards (VITE_MOCK_MODE=true).
// Dismiss state persisted to localStorage, keyed to spec SHA.
// No TwinPod — pure frontend composable.

import { ref, readonly } from 'vue'
import type { SpecBlock } from '../types/spec'

// ── Types ───────────────────────────────────────────────────────────────────

export interface Conflict {
  id: string
  stakeholders: string[]             // names of conflicting parties
  attribute: string                  // the V. entry they conflict on
  positions: Record<string, string>  // stakeholder → their position
  severity: 'low' | 'medium' | 'high'
  resolution: string                 // proposed path forward
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** SHA-256 of a string via the Web Crypto API (browser-native, no dependency). */
async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

/** Number of distinct Stakeholder-level function entries — proxy for stakeholder count. */
export function stakeholderCount(spec: SpecBlock): number {
  return spec.functions.filter(f => f.level === 'Stakeholder').length
}

/** Runtime-validate one candidate Conflict object. Returns the object if valid, null otherwise. */
function parseConflict(raw: unknown): Conflict | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o['id'] !== 'string') return null
  if (!Array.isArray(o['stakeholders']) || o['stakeholders'].some(s => typeof s !== 'string')) return null
  if (typeof o['attribute'] !== 'string') return null
  if (!o['positions'] || typeof o['positions'] !== 'object') return null
  if (!['low', 'medium', 'high'].includes(o['severity'] as string)) return null
  if (typeof o['resolution'] !== 'string') return null
  return {
    id:           o['id'] as string,
    stakeholders: o['stakeholders'] as string[],
    attribute:    o['attribute'] as string,
    positions:    o['positions'] as Record<string, string>,
    severity:     o['severity'] as 'low' | 'medium' | 'high',
    resolution:   o['resolution'] as string,
  }
}

/** Parse and validate a raw JSON payload into Conflict[]. Invalid items are silently dropped. */
function parseConflictArray(raw: unknown): Conflict[] {
  if (!Array.isArray(raw)) return []
  return raw.map(parseConflict).filter((c): c is Conflict => c !== null)
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_CONFLICTS: Conflict[] = [
  {
    id: 'mc1',
    stakeholders: ['Marketing', 'Engineering'],
    attribute: 'V.DeliverySpeed',
    positions: {
      Marketing:   'Wants bi-weekly feature releases to stay competitive — cost is secondary.',
      Engineering: 'Bi-weekly cadence accumulates tech debt; prefers monthly with full regression suite.',
    },
    severity: 'high',
    resolution: 'Negotiate a 3-week release cadence with a quality gate: no release unless regression suite passes. Engineering owns the gate; Marketing owns the go/no-go announcement window.',
  },
  {
    id: 'mc2',
    stakeholders: ['Finance', 'Product'],
    attribute: 'V.Usefulness',
    positions: {
      Finance:  'Needs ROI-positive features only; any feature with < 20% adoption within 90 days should be cut.',
      Product:  'Some features take 6+ months to reach target adoption; cutting at 90 days destroys long-term value.',
    },
    severity: 'medium',
    resolution: 'Agree a tiered adoption threshold: core features reviewed at 180 days, non-core at 90 days. Define "core" upfront in the planning spec before each Evo increment.',
  },
]

// ── Module-level cache ─────────────────────────────────────────────────────────
// Keyed by spec SHA-256. Invalidated automatically — a new sha means a new spec.

const _cache = new Map<string, Conflict[]>()

// ── localStorage dismiss helpers ───────────────────────────────────────────────

const LS_PREFIX = 'conflict-dismissed-'

function _loadDismissed(sha: string): Set<string> {
  try {
    const raw = localStorage.getItem(LS_PREFIX + sha)
    const arr: unknown = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(arr) ? (arr as string[]) : [])
  } catch {
    return new Set()
  }
}

function _saveDismissed(sha: string, dismissed: Set<string>): void {
  try {
    localStorage.setItem(LS_PREFIX + sha, JSON.stringify([...dismissed]))
  } catch {
    // Storage quota — silently ignore
  }
}

// ── Composable ────────────────────────────────────────────────────────────────

/**
 * Composable that fetches stakeholder conflicts from a Planguage spec.
 *
 * API key is read from VITE_ANTHROPIC_API_KEY automatically.
 * If the key is absent or VITE_MOCK_MODE=true, mock data is returned.
 *
 * @returns {{
 *   conflicts: Readonly<Ref<Conflict[]>>,
 *   loading:   Readonly<Ref<boolean>>,
 *   error:     Readonly<Ref<string>>,
 *   dismissed: Readonly<Ref<Set<string>>>,
 *   analyse(spec: SpecBlock): Promise<void>,
 *   dismissConflict(id: string): void,
 * }}
 *
 * Preconditions: spec must have ≥2 Stakeholder-level F. entries for meaningful output.
 * No streaming — single request/response cycle.
 */
export function useConflictAnalysis() {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined
  const conflicts  = ref<Conflict[]>([])
  const loading    = ref(false)
  const error      = ref('')
  const dismissed  = ref<Set<string>>(new Set())
  let   _currentSha = ''

  async function analyse(spec: SpecBlock): Promise<void> {
    loading.value = true
    error.value   = ''

    const specJson = JSON.stringify(spec)
    const sha      = await sha256(specJson)
    _currentSha   = sha

    // Restore dismiss state for this spec
    dismissed.value = _loadDismissed(sha)

    // Cache hit — no API call needed
    if (_cache.has(sha)) {
      conflicts.value = _cache.get(sha)!
      loading.value   = false
      return
    }

    const isMock = import.meta.env.VITE_MOCK_MODE === 'true' || !apiKey || apiKey.trim() === ''

    if (isMock) {
      await new Promise(r => setTimeout(r, 900))
      conflicts.value = MOCK_CONFLICTS
      _cache.set(sha, MOCK_CONFLICTS)
      loading.value = false
      return
    }

    try {
      const { Anthropic } = await import('@anthropic-ai/sdk')
      const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })

      // Trim spec to 4 000 chars to keep token cost predictable; cache hit handles repeats.
      const specPreview = specJson.length > 4000 ? specJson.slice(0, 4000) + '…' : specJson

      const SYSTEM = `You are a senior Planguage consultant specialising in stakeholder analysis.
Given a Planguage spec, identify conflicts between stakeholders — where different stakeholders have opposing positions on the same value attribute.
Return a JSON array of conflict objects. Each object must have exactly these keys:
  "id": string (unique, e.g. "c1")
  "stakeholders": string[] (2+ names of conflicting parties)
  "attribute": string (the V. entry id they conflict on)
  "positions": object (stakeholder name → position string)
  "severity": "low" | "medium" | "high"
  "resolution": string (proposed negotiation path)
Return 2–6 conflicts. Return only the JSON array — no markdown, no explanation.`

      const msg = await client.messages.create({
        model:      'claude-opus-4-5',
        max_tokens: 1200,
        system:     SYSTEM,
        messages:   [{ role: 'user', content: `Spec:\n${specPreview}\n\nReturn only valid JSON array.` }],
      })

      const text   = msg.content[0].type === 'text' ? msg.content[0].text : ''
      const match  = text.match(/\[[\s\S]*\]/)
      const parsed = parseConflictArray(match ? JSON.parse(match[0]) : [])

      if (parsed.length === 0 && text.length > 0) {
        error.value = 'AI returned no valid conflicts — try again or check the spec.'
      }

      conflicts.value = parsed
      _cache.set(sha, parsed)
    } catch (e) {
      error.value     = e instanceof Error ? e.message : 'Conflict analysis failed'
      conflicts.value = []
    }

    loading.value = false
  }

  function dismissConflict(id: string): void {
    dismissed.value = new Set([...dismissed.value, id])
    if (_currentSha) _saveDismissed(_currentSha, dismissed.value)
  }

  return {
    conflicts:       readonly(conflicts),
    loading:         readonly(loading),
    error:           readonly(error),
    dismissed:       readonly(dismissed),
    analyse,
    dismissConflict,
  }
}
