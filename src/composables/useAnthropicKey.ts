/**
 * useAnthropicKey — Provide Anthropic API key from environment or user settings
 *
 * Returns:
 *   - apiKey: Ref<string | null> — null triggers mock mode (pattern heuristics)
 *                                    string enables live Claude API calls
 *
 * Environment variable: VITE_ANTHROPIC_KEY (loaded at build time, not runtime)
 * Mock mode: When apiKey is null or VITE_MOCK_MODE is true
 */

import { ref } from 'vue'

export function useAnthropicKey() {
  // Load from environment variable at build time, fall back to null (mock mode)
  const apiKey = ref<string | null>(
    import.meta.env.VITE_ANTHROPIC_KEY || null
  )

  return {
    apiKey,
  }
}
