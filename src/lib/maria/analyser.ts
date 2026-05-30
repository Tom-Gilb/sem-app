// UNIT_TYPE=Lib
// maria/analyser.ts — portable Maria analysis pipeline
//
// Framework-free core. No Vue, no Anthropic SDK, no browser globals.
// The only external dependencies are:
//   - src/types/maria.ts  (MariaResult — pure TypeScript interface, no runtime deps)
//   - src/config/maria-prompt.ts  (MARIA_SYSTEM_PROMPT — plain string constant)
//   - ./parser.ts  (parseMariaResult — pure function)
//
// The LLM call itself is INJECTED via the LlmCaller interface.
// This makes the pipeline portable to any runtime:
//
//   SEM App (Anthropic SDK):
//     const caller = anthropicCaller(client, MODEL_ID, MARIA_PROMPT_CACHE_CONTROL)
//     const result = await analyseDocument(text, caller)
//
//   Standalone Node script:
//     const caller = openAiCaller(openaiClient, 'gpt-4o')
//     const result = await analyseDocument(text, caller)
//
//   Kai-Zen / Twin (custom HTTP):
//     const caller = (prompt, content) => fetch('/api/llm', { ... }).then(r => r.text())
//     const result = await analyseDocument(text, caller)
//
//   Tests:
//     const mockCaller: LlmCaller = async () => JSON.stringify(buildMockMariaResult())
//     const result = await analyseDocument('any text', mockCaller)

import { MARIA_SYSTEM_PROMPT } from '../../config/maria-prompt'
import type { MariaResult }    from '../../types/maria'
import { parseMariaResult }    from './parser'

// ─── LlmCaller interface ──────────────────────────────────────────────────────

/**
 * Injected LLM transport. Accepts the system prompt and user content as plain
 * strings and returns the raw text response from the model.
 *
 * The caller is responsible for:
 *   - Authentication and API key management
 *   - Model selection and token budget
 *   - Prompt caching headers (optional — a no-op caller is fine)
 *   - Timeout and retry policy
 *   - Aborting inflight calls (pass signal via opts if needed)
 *
 * @param systemPrompt  The Maria system prompt (from MARIA_SYSTEM_PROMPT).
 * @param userContent   The framed user message (schema reminder + document text).
 * @param opts.signal   Optional AbortSignal — pass to fetch/SDK to honour cancellation.
 * @returns             Raw text response — will be fed to parseMariaResult().
 */
export type LlmCaller = (
  systemPrompt: string,
  userContent: string,
  opts?: { signal?: AbortSignal },
) => Promise<string>

// ─── Core pipeline ────────────────────────────────────────────────────────────

/**
 * The portable Maria analysis pipeline.
 *
 * Builds the correct prompt + framing, calls the injected LlmCaller, and
 * parses the response into a typed MariaResult.
 *
 * @param documentText  Raw board document text (minutes, resolution, strategy paper…).
 * @param callLlm       The injected LLM transport — see LlmCaller above.
 * @param opts.signal   Optional AbortSignal forwarded to callLlm.
 * @returns             Parsed and validated MariaResult.
 * @throws              When callLlm rejects OR when the response is not valid MariaResult JSON.
 */
export async function analyseDocument(
  documentText: string,
  callLlm: LlmCaller,
  opts?: { signal?: AbortSignal },
): Promise<MariaResult> {
  console.log('[Maria Analyser] Starting analysis, document length:', documentText.length)

  // Reinforce the output schema in the user message — models attend to
  // user-message reminders more reliably than distant system prompt instructions.
  const userContent =
    'Return ONLY a JSON object matching the MariaResult schema exactly.\n\n' +
    'Board document to analyse:\n\n' +
    documentText.trim()

  console.log('[Maria Analyser] Calling LLM...')
  const rawResponse = await callLlm(MARIA_SYSTEM_PROMPT, userContent, opts)
  console.log('[Maria Analyser] LLM call returned, response length:', rawResponse.length)

  console.log('[Maria Analyser] Calling parseMariaResult...')
  const result = parseMariaResult(rawResponse)
  console.log('[Maria Analyser] parseMariaResult returned successfully')

  return result
}
