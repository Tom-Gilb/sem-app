// UNIT_TYPE=Hook
// useMaria — Vue composable wrapper for the portable Maria analysis pipeline.
//
// Responsibilities:
//   - Implements LlmCaller using the Anthropic SDK (browser-safe singleton)
//   - Manages reactive loading / error / result state for the UI
//   - Provides cancelCurrentMaria() abort control
//   - Handles mock mode (VITE_MOCK_MODE=true)
//
// All business logic lives in src/lib/maria/:
//   analyser.ts  — portable core pipeline (inject any LlmCaller)
//   parser.ts    — pure JSON parser
//   mock.ts      — deterministic fixture
//   email.ts     — HTML report builder
//
// Tom Gilb, 2026-05-29: "Part of Planning mode, basically an agent who can
// be explicitly called (agent menu)."
//
// Architectural Resilience Rule (2026-05-27):
//   This file MUST stay thin. Do not add business logic here.
//   Business logic belongs in lib/maria/ so it can be ported to any runtime.

import Anthropic from '@anthropic-ai/sdk'
import { ref }    from 'vue'
import type { Ref } from 'vue'
import { MARIA_MODEL_ID } from '../config/llm'
import { analyseDocument }         from '../lib/maria/analyser'
import { buildMockMariaResult }    from '../lib/maria/mock'
import type { LlmCaller }          from '../lib/maria/analyser'
import type { MariaResult }        from '../types/maria'
import { useLoadingState }         from './useLoadingState'
import { parseApiError }           from '../utils/parseApiError'

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
      timeout: 300_000, // board documents can be long; allow up to 300 s (5 min)
    })
  }
  return _mariaClient
}

/** Resets the singleton client. For test isolation only — do not call in production. */
export function _resetMariaClientForTest(): void {
  _mariaClient = null
}

// ─── Module-level AbortController ─────────────────────────────────────────────

let _mariaController: AbortController | null = null

// ─── Streaming text buffer ─────────────────────────────────────────────────────

/**
 * Accumulates the raw text response as it streams in from the API.
 * Updated in real-time by buildAnthropicCaller's stream.on('text') handler.
 * Exported so MariaAgentBoard can show a "N chars received" live indicator —
 * giving the user confidence the API is actively responding during long analyses.
 * Cleared at the start of every new buildAnthropicCaller call.
 */
export const mariaStreamedText = ref('')

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

// ─── Anthropic SDK LlmCaller implementation ───────────────────────────────────

/**
 * Builds the Anthropic SDK implementation of LlmCaller.
 * Called once per analyse() invocation — captures the AbortController so
 * the caller can be aborted from cancelCurrentMaria().
 *
 * Uses streaming (client.messages.stream) so the first tokens arrive in the
 * UI within a few seconds of the API responding, instead of waiting for the
 * complete response (~100–150 s). mariaStreamedText is updated reactively on
 * every text chunk, so MariaAgentBoard can show a live "N chars received"
 * indicator — confirming the API is actively working throughout the wait.
 */
function buildAnthropicCaller(signal: AbortSignal): LlmCaller {
  return async (systemPrompt: string, userContent: string) => {
    const client = getClient()

    // Clear the streaming buffer so the previous run's text does not show.
    mariaStreamedText.value = ''

    // Open a streaming connection — first tokens arrive within seconds of the
    // API accepting the request, not after the entire response is computed.
    const stream = client.messages.stream(
      {
        model:      MARIA_MODEL_ID, // override via VITE_MARIA_MODEL_ID in .env.local
        max_tokens: 4096,
        system:     systemPrompt,
        messages:   [{ role: 'user', content: userContent }],
      },
      { signal },
    )

    // Explicitly drive the stream via for-await — this is required.
    // stream.on('text', ...) only registers listeners; it does NOT pull data
    // from the async generator. Without an active consumer the generator
    // never advances and finalMessage() deadlocks indefinitely.
    // for-await pulls each MessageStreamEvent as it arrives from the API.
    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        // Narrow delta type — TextDelta | InputJsonDelta
        const d = event.delta as { type: string; text?: string }
        if (d.type === 'text_delta' && typeof d.text === 'string') {
          mariaStreamedText.value += d.text
        }
      }
    }

    // Stream fully consumed — finalMessage() returns the accumulated message.
    const finalMessage = await stream.finalMessage()

    if (finalMessage.stop_reason === 'max_tokens') {
      throw new Error(
        "Maria's response was cut off (max_tokens limit reached). " +
        'The board document may be too long — try analysing a shorter section.',
      )
    }

    if (!mariaStreamedText.value) {
      throw new Error('Maria returned an empty response — no text in the streamed response')
    }

    return mariaStreamedText.value
  }
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
   * Cancels any previous in-flight call before starting a new one.
   */
  analyse(documentText: string): Promise<MariaResult | null>
  /** Resets result and error to initial state without cancelling any in-flight call. */
  reset(): void
}

// ─── Composable ───────────────────────────────────────────────────────────────

/**
 * Maria Agent composable — thin Vue reactive layer over lib/maria/analyser.ts.
 *
 * Per-instance state (not module-level): each MariaAgentBoard.vue instance
 * manages its own loading/error/result independently. There is never more
 * than one Maria panel open at a time (registerExclusiveSurface ensures this).
 *
 * Mock mode: set VITE_MOCK_MODE=true in .env.local to bypass the API and
 * return buildMockMariaResult() with a 1.8 s simulated delay.
 */
export function useMaria(): MariaState {
  const loading = ref(false)
  const error   = ref('')
  const result  = ref<MariaResult | null>(null)
  const { startLoading, stopLoading } = useLoadingState()

  async function analyse(documentText: string): Promise<MariaResult | null> {
    cancelCurrentMaria()

    loading.value = true
    error.value   = ''
    startLoading('maria:analyse', 'Maria is analysing the board document…')

    try {
      // Mock mode — returns a realistic example result without hitting the API
      if (import.meta.env.VITE_MOCK_MODE === 'true') {
        await new Promise<void>((r) => setTimeout(r, 1800))
        result.value = buildMockMariaResult()
        return result.value
      }

      // Wire the Anthropic SDK LlmCaller with a fresh AbortController
      const controller = new AbortController()
      _mariaController  = controller
      const callLlm     = buildAnthropicCaller(controller.signal)

      // Delegate all pipeline logic to the portable lib
      const parsed = await analyseDocument(documentText, callLlm, { signal: controller.signal })
      result.value = parsed
      return parsed
    } catch (err) {
      const parsed = parseApiError(err)
      error.value  = `${parsed.title}: ${parsed.detail}${parsed.actionUrl ? ` ${parsed.actionUrl}` : ''}`
      return null
    } finally {
      loading.value = false
      stopLoading('maria:analyse')
      _mariaController = null
    }
  }

  function reset(): void {
    result.value = null
    error.value  = ''
  }

  return { loading, error, result, analyse, reset }
}
