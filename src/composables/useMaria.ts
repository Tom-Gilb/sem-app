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
 * Debug logs ref — visible log messages that appear in the UI debug panel.
 * Populated by addDebugLog() so Tom can diagnose analysis issues without
 * needing to open the Safari developer console.
 * Each entry is a timestamp + message pair for readability.
 */
export const debugLogs = ref<string[]>([])

/**
 * Append a debug message to the visible debug logs.
 * Prepends with [HH:MM:SS] timestamp for easy scan.
 * Called by diagnostic console.log statements.
 */
function addDebugLog(message: string): void {
  const now = new Date()
  const stamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
  debugLogs.value.push(`[${stamp}] ${message}`)
}

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
    addDebugLog('Calling Anthropic API…')

    // Clear the streaming buffer so the previous run's text does not show.
    mariaStreamedText.value = ''

    // Non-streaming messages.create — the only proven-working API path in this
    // Electron/Chromium context. MessageStream[Symbol.asyncIterator] is
    // incompatible with the current runtime (throws "undefined is not a function")
    // and the event-emitter streaming approach (stream.on('text', ...)) cannot
    // self-drive data delivery before the API responds.
    //
    // The client timeout is set to 300 s so complex board documents have full
    // headroom. The response arrives as a single payload after model generation
    // completes (~100–200 s for claude-sonnet-4-6 on 3–5 k tokens).
    //
    // To switch to a faster model, set VITE_MARIA_MODEL_ID in .env.local.
    const response = await client.messages.create(
      {
        model:      MARIA_MODEL_ID, // override via VITE_MARIA_MODEL_ID in .env.local
        max_tokens: 4096,
        system:     systemPrompt,
        messages:   [{ role: 'user', content: userContent }],
      },
      { signal },
    )

    if (response.stop_reason === 'max_tokens') {
      const msg = "Maria's response was cut off (max_tokens limit reached). The board document may be too long — try analysing a shorter section."
      addDebugLog(`ERROR: ${msg}`)
      throw new Error(msg)
    }

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      const msg = 'Maria returned an empty response — no text block in the API response'
      addDebugLog(`ERROR: ${msg}`)
      throw new Error(msg)
    }

    // Expose the full response text so the streaming indicator shows "received"
    // once the API responds (non-streaming: updates once, not incrementally).
    mariaStreamedText.value = textBlock.text

    // DEBUG: Log response so we can diagnose parsing failures
    const respJson = {
      length: textBlock.text.length,
      firstChars: textBlock.text.slice(0, 100),
      lastChars: textBlock.text.slice(-100),
      hasDecisionInventory: textBlock.text.includes('decisionInventory'),
      startsWithBrace: textBlock.text.trim().startsWith('{'),
    }
    console.log('[Maria] API response received', respJson)
    addDebugLog(`API response received: ${respJson.length} chars, JSON valid: ${respJson.startsWithBrace}`)

    return textBlock.text
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
    debugLogs.value = [] // Clear prior logs at the start of each analyse() call

    loading.value = true
    error.value   = ''
    startLoading('maria:analyse', 'Maria is analysing the board document…')
    addDebugLog('Analysis started')

    try {
      // Mock mode — returns a realistic example result without hitting the API
      if (import.meta.env.VITE_MOCK_MODE === 'true') {
        addDebugLog('Using mock mode (VITE_MOCK_MODE=true)')
        await new Promise<void>((r) => setTimeout(r, 1800))
        result.value = buildMockMariaResult()
        addDebugLog('Mock result generated')
        return result.value
      }

      // Wire the Anthropic SDK LlmCaller with a fresh AbortController
      const controller = new AbortController()
      _mariaController  = controller
      const callLlm     = buildAnthropicCaller(controller.signal)
      addDebugLog('Anthropic SDK client initialized')

      // Delegate all pipeline logic to the portable lib
      const parsed = await analyseDocument(documentText, callLlm, { signal: controller.signal })

      // DEBUG: Log result before setting
      const resultStats = {
        hasParsed: !!parsed,
        hasDecisionInventory: parsed?.decisionInventory?.length || 0,
        hasAuthorityReport: parsed?.authorityReport?.length || 0,
        hasGovernanceGaps: parsed?.governanceGaps?.length || 0,
        hasPatternAnalysis: parsed?.patternAnalysis?.length || 0,
      }
      console.log('[Maria] Analysis parsed successfully', resultStats)
      addDebugLog(`Parser result: ${resultStats.hasDecisionInventory} decisions, ${resultStats.hasAuthorityReport} auth gaps, ${resultStats.hasGovernanceGaps} gov gaps, ${resultStats.hasPatternAnalysis} patterns`)

      result.value = parsed
      addDebugLog('Analysis complete ✓')

      // DEBUG: Show an alert so Tom knows the result was parsed successfully
      alert(`✓ Analysis succeeded!\n\n${resultStats.hasDecisionInventory} decisions\n${resultStats.hasAuthorityReport} authority gaps\n${resultStats.hasGovernanceGaps} governance gaps\n${resultStats.hasPatternAnalysis} patterns`)

      // DEBUG: Confirm result.value is set
      setTimeout(() => {
        alert(`result.value is ${result.value ? 'SET ✓' : 'NOT SET ✗'}\n\nIf set, the UI should now show the results panel.`)
      }, 100)

      return parsed
    } catch (err) {
      const parsed = parseApiError(err)
      const errDetails = {
        title: parsed.title,
        detail: parsed.detail,
        originalError: err instanceof Error ? err.message : String(err),
      }
      console.log('[Maria] Analysis failed with error', errDetails)
      addDebugLog(`ERROR: ${errDetails.title} — ${errDetails.detail}`)
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
