// UNIT_TYPE=Hook
// useMaria — Board Work Parse agent composable
//
// Maria is the first agent in the SEM App Agent Menu. She analyses board
// documents (minutes, resolutions, strategy papers, committee reports) and
// returns a structured MariaResult with four sections:
//   decisionInventory  — every decision classified by governance layer
//   authorityReport    — authority clarity gaps (empty if none found)
//   governanceGaps     — topics missing a board decision
//   patternAnalysis    — 3–6 governance patterns (strengths / concerns)
//
// Design authority: Tom Gilb, 2026-05-29.
// Architecture: mirrors useSDK.ts — singleton client, module-level AbortController,
// cancelCurrentMaria() for watchdog, mock mode for demo/test.
//
// Design principle (Architectural Resilience Rule, 2026-05-27):
//   Composable is thin: only reactive state + one async pipeline method.
//   All LLM contract knowledge lives in src/config/maria-prompt.ts.
//   All MariaResult type definitions live in src/types/maria.ts.
//   No UI logic. No side effects at module level.

import Anthropic from '@anthropic-ai/sdk'
import type { BetaTextBlockParam } from '@anthropic-ai/sdk'
import { ref } from 'vue'
import type { Ref } from 'vue'
import { MODEL_ID } from '../config/llm'
import { MARIA_SYSTEM_PROMPT, MARIA_PROMPT_CACHE_CONTROL } from '../config/maria-prompt'
import type { MariaResult } from '../types/maria'
import { useLoadingState } from './useLoadingState'
import { parseApiError } from '../utils/parseApiError'

// ─── Module-level singleton client ────────────────────────────────────────────

let _mariaClient: Anthropic | null = null

function getClient(): Anthropic {
  if (!_mariaClient) {
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined
    if (!apiKey) {
      throw new Error(
        'VITE_ANTHROPIC_API_KEY is not set — configure this environment variable to enable the Maria agent',
      )
    }
    _mariaClient = new Anthropic({
      apiKey,
      dangerouslyAllowBrowser: true,
      timeout: 90_000, // board documents can be long; allow up to 90 s
    })
  }
  return _mariaClient
}

/** Resets the singleton Maria client. For test isolation only — do not call in production. */
export function _resetMariaClientForTest(): void {
  _mariaClient = null
}

// ─── Module-level AbortController ─────────────────────────────────────────────

let _mariaController: AbortController | null = null

/**
 * Hard-cancel any in-flight analyse() call.
 * Safe to call when no call is in flight (no-op).
 * Mirrors cancelCurrentTranslate() in useSDK.ts.
 */
export function cancelCurrentMaria(): void {
  if (_mariaController) {
    _mariaController.abort()
    _mariaController = null
  }
}

// ─── Mock result ──────────────────────────────────────────────────────────────

/**
 * Returns a mock MariaResult for VITE_MOCK_MODE=true or missing API key.
 * Simulates a realistic board-document analysis so the full UI can be
 * demonstrated without a live API connection.
 */
function buildMockMariaResult(): MariaResult {
  return {
    decisionInventory: [
      {
        id: 'D1',
        text: 'The Board approved the 2026 Annual Operating Plan and Budget of $4.2M.',
        layer: 'board',
        layerRationale: 'Full board budget approval above the delegated management threshold is a board-reserved decision under the constitution. The CFO presented and the board formally resolved.',
        authorityGapFlagged: false,
      },
      {
        id: 'D2',
        text: 'A new Chief Technology Officer was appointed at a total package of $320,000.',
        layer: 'board',
        layerRationale: 'Senior executive appointment at CTO level is board-reserved in most governance frameworks. However, the record states the CEO "advised" the board rather than the board formally approving — creating an authority record ambiguity.',
        authorityGapFlagged: true,
        authorityGapNote: 'The CTO appointment was presented as an information item ("the CEO advised") rather than as a board resolution. If CTO-level appointments require board approval under the delegation policy, the distinction between noting and approving creates a gap in the authority record.',
      },
      {
        id: 'D3',
        text: 'Management will finalise and implement the Q2 marketing strategy within the approved budget.',
        layer: 'management',
        layerRationale: 'Marketing strategy implementation within an approved budget is appropriately delegated to management. The board has set the budget boundary; management decides the approach within it.',
        authorityGapFlagged: false,
      },
      {
        id: 'D4',
        text: 'The Board noted the external audit report and requested a management response by the next meeting.',
        layer: 'board',
        layerRationale: 'Engaging with the external audit and directing management to respond is an appropriate board-level oversight action. The request for a formal management response at the next meeting creates a clear accountability loop.',
        authorityGapFlagged: false,
      },
    ],
    authorityReport: [
      {
        decisionIds: ['D2'],
        issue: 'The CTO appointment appears in the minutes as information provided by the CEO rather than as a board resolution. Under most governance frameworks, C-suite appointments require explicit board approval — the distinction between the board "noting" an appointment and the board "approving" it is legally and governance-materially significant.',
        opportunity: 'The board could strengthen the appointment record by passing a ratification resolution at the next meeting, and by updating the delegation policy to explicitly list which executive roles require board approval — creating a clear, durable framework for all future senior appointments.',
        severity: 'moderate',
      },
    ],
    governanceGaps: [
      {
        id: 'G1',
        category: 'Unresolved compliance matter',
        significance: 'The GDPR compliance review was mentioned as "ongoing" but no board direction, timeline, or resolution was recorded. A regulatory compliance matter at this level warrants a formal board disposition — acknowledging without directing leaves the board\'s oversight role unrecorded in the minutes.',
        opportunity: 'Adding a GDPR compliance update to the next agenda as a required resolution item — status, any identified risk, and a board-directed action or acceptance — would close this gap and create a defensible record of board oversight for any future regulatory inquiry.',
      },
    ],
    patternAnalysis: [
      {
        id: 'P1',
        type: 'strength',
        label: 'Formal strategic budget governance in place',
        description: 'The board formally approved the annual budget with CFO presentation — a correct and complete governance practice. The decision is clearly framed as a board resolution with a named amount, appropriate for the board\'s strategic authority level. This demonstrates that the board understands the distinction between board-reserved and delegated financial decisions.',
        opportunity: 'The board could further strengthen budget governance by scheduling a mid-year reforecast review point, ensuring board-level visibility into material variances before year-end pressure reduces options.',
        evidenceDecisionIds: ['D1'],
      },
      {
        id: 'P2',
        type: 'concern',
        label: 'Senior appointments recorded as information, not resolutions',
        description: 'The CTO appointment was presented to the board as a CEO advisory rather than a board resolution. This pattern — where significant management decisions are surfaced to the board as information — blurs the boundary between board authority and management authority, and creates gaps in the formal governance record that could be material in a dispute or regulatory review.',
        opportunity: 'Introducing a clear appointment authority matrix (which roles require board approval, which are CEO authority) and adopting a simple "board ratification" agenda item for all board-reserved appointments would take minimal meeting time and create a much stronger governance record going forward.',
        evidenceDecisionIds: ['D2'],
      },
      {
        id: 'P3',
        type: 'concern',
        label: 'Compliance matters acknowledged without formal board disposition',
        description: 'The GDPR compliance matter appears in the minutes as a progress note rather than a resolved item with a board direction. This pattern — acknowledging compliance and regulatory matters without a formal board response — limits the board\'s ability to demonstrate active oversight if a matter is later investigated by a regulator or raised in litigation.',
        opportunity: 'Adopting a standing compliance agenda template — flagging status (on track / at risk / breach), required board action, and a named resolution — would take minimal agenda time and significantly strengthen the governance record for all compliance and regulatory matters.',
        evidenceDecisionIds: ['D4'],
      },
      {
        id: 'P4',
        type: 'strength',
        label: 'Appropriate management delegation maintained',
        description: 'The Q2 marketing strategy was correctly left with management to finalise within the approved budget — the board set the financial boundary and delegated implementation decisions to the appropriate layer. This demonstrates healthy governance hygiene: the board is not reaching down into operational details it has appropriately delegated.',
        opportunity: 'The board could make this delegation practice more explicit by periodically reviewing the delegation policy to confirm that all delegated authorities have appropriate reporting-back mechanisms, ensuring the board receives the right signals without micromanaging the execution.',
        evidenceDecisionIds: ['D3'],
      },
    ],
    generatedAt: new Date().toISOString(),
    sourceWordCount: 142,
  }
}

// ─── JSON parser ──────────────────────────────────────────────────────────────

/**
 * Parses the raw JSON string returned by the LLM into a validated MariaResult.
 * Strips markdown fences if the model wrapped the output.
 * Throws a descriptive error if the structure does not match the contract.
 */
function parseMariaResult(raw: string): MariaResult {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    // Try to extract the first {...} block in case the model prepended prose
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (match) {
      try { parsed = JSON.parse(match[0]) } catch { /* fall through */ }
    }
    if (!parsed) {
      throw new Error(`Maria response is not valid JSON:\n${raw.slice(0, 400)}`)
    }
  }

  const obj = parsed as Record<string, unknown>

  // Structural validation — all four arrays must be present
  if (!Array.isArray(obj.decisionInventory)) {
    throw new Error('Maria response is missing required array: decisionInventory')
  }
  if (!Array.isArray(obj.authorityReport)) {
    throw new Error('Maria response is missing required array: authorityReport')
  }
  if (!Array.isArray(obj.governanceGaps)) {
    throw new Error('Maria response is missing required array: governanceGaps')
  }
  if (!Array.isArray(obj.patternAnalysis)) {
    throw new Error('Maria response is missing required array: patternAnalysis')
  }

  // Defensive coercion — ensure scalar fields are strings/numbers
  if (typeof obj.generatedAt !== 'string') obj.generatedAt = new Date().toISOString()
  if (typeof obj.sourceWordCount !== 'number') obj.sourceWordCount = 0

  // Defensive: ensure authorityGapNote is only present when authorityGapFlagged is true
  for (const d of obj.decisionInventory as Array<Record<string, unknown>>) {
    if (!d.authorityGapFlagged) delete d.authorityGapNote
  }

  return obj as unknown as MariaResult
}

// ─── Composable state interface ───────────────────────────────────────────────

export interface MariaState {
  /** True while an analyse() call is in flight. */
  loading: Ref<boolean>
  /** Non-empty string when the last call failed. Empty string when idle or succeeded. */
  error: Ref<string>
  /** The parsed MariaResult from the most recent successful analyse() call. Null before first run. */
  result: Ref<MariaResult | null>
  /**
   * Submits a board document for analysis and populates result on success.
   * Returns the MariaResult on success, null on failure (error ref is set).
   * Safe to call while a previous call is in flight — it cancels the previous call first.
   */
  analyse(documentText: string): Promise<MariaResult | null>
  /** Resets result and error to initial state. Does not cancel an in-flight call. */
  reset(): void
}

// ─── Composable ───────────────────────────────────────────────────────────────

/**
 * Maria Agent composable — Board Work Parse.
 *
 * Thin reactive state layer. All LLM configuration is in maria-prompt.ts;
 * all type definitions are in types/maria.ts. Components import this and
 * bind to loading / error / result.
 *
 * Per-instance state (not module-level): each MariaAgentBoard.vue instance
 * manages its own loading/error/result independently. There is never more
 * than one Maria panel open at a time (registerExclusiveSurface ensures this).
 */
export function useMaria(): MariaState {
  const loading = ref(false)
  const error = ref('')
  const result = ref<MariaResult | null>(null)
  const { startLoading, stopLoading } = useLoadingState()

  async function analyse(documentText: string): Promise<MariaResult | null> {
    // Cancel any previous in-flight call from this or another instance
    cancelCurrentMaria()

    loading.value = true
    error.value = ''
    startLoading('maria:analyse', 'Maria is analysing the board document…')

    try {
      // Mock mode — returns a realistic example result without hitting the API
      if (import.meta.env.VITE_MOCK_MODE === 'true') {
        await new Promise<void>((r) => setTimeout(r, 1800)) // simulate network delay
        result.value = buildMockMariaResult()
        return result.value
      }

      const client = getClient()

      const systemBlock: BetaTextBlockParam = {
        type: 'text',
        text: MARIA_SYSTEM_PROMPT,
        cache_control: MARIA_PROMPT_CACHE_CONTROL,
      }

      // Reinforce the output schema in the user message — models attend to
      // user-message reminders more reliably than distant system prompt instructions.
      const userContent =
        'Return ONLY a JSON object matching the MariaResult schema exactly.\n\n' +
        'Board document to analyse:\n\n' +
        documentText.trim()

      const controller = new AbortController()
      _mariaController = controller

      const response = await client.beta.messages.create(
        {
          model: MODEL_ID,
          // Maria responses can be large for long board documents with many decisions.
          // 8192 tokens comfortably fits a full board-meeting analysis.
          max_tokens: 8192,
          system: [systemBlock],
          messages: [{ role: 'user', content: userContent }],
          betas: ['prompt-caching-2024-07-31'],
        },
        { signal: controller.signal },
      )

      if (response.stop_reason === 'max_tokens') {
        throw new Error(
          'Maria\'s response was cut off (max_tokens limit reached). ' +
          'The board document may be too long — try analysing a shorter section.',
        )
      }

      const textBlock = response.content.find((b) => b.type === 'text')
      if (!textBlock || textBlock.type !== 'text') {
        throw new Error('Maria returned an empty response — no text block in the API response')
      }

      const parsed = parseMariaResult(textBlock.text.trim())
      result.value = parsed
      return parsed
    } catch (err) {
      const parsed = parseApiError(err)
      error.value = `${parsed.title}: ${parsed.detail}${parsed.actionUrl ? ` ${parsed.actionUrl}` : ''}`
      return null
    } finally {
      loading.value = false
      stopLoading('maria:analyse')
      _mariaController = null
    }
  }

  function reset(): void {
    result.value = null
    error.value = ''
  }

  return { loading, error, result, analyse, reset }
}
