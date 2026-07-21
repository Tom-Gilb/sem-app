// UNIT_TYPE=Composable
// useActiveModel.ts — Detect + report which AI provider + model the SEM App is
// currently talking to.
//
// v415 (Tom Gilb 2026-07-01 verbatim "Can you put a word or symbol telling me
// exactly which agent we are using for running SEM, on the sem surface,
// especially llama.  Is this something I can adjust in my settings?"):
// makes the active model VISIBLE on the SEM surface via a persistent chip
// mounted at the top title bar.
//
// **The provider decision** happens at build time via env vars:
//   - VITE_OLLAMA_MODEL / VITE_OLLAMA_BASE_URL set   → Ollama (local llama.cpp)
//   - neither set                                    → Anthropic Claude (MODEL_ID from config/llm.ts)
//
// Runtime-switchable settings toggle is Phase 2 (adds an in-app UI to override
// the env-var choice via localStorage + panel Settings surface). Until then,
// changing provider requires editing .env.local + restarting Vite.  The chip
// spells this out in its HoverHint so the planner knows their control surface.
//
// Composes with:
//   - Claude-Code-as-AI-Layer SUPREME (SEM App is the DATA + UI layer; the AI is
//     called from either Claude Sonnet or local Ollama; either way the same
//     provenance chain is preserved)
//   - Model Selection SUPREME (2026-05-30 "11 hours wasted with Haiku") — the
//     chip warns when a weaker model is active by tinting amber for Ollama
//   - MOVE Principle SUPREME (visible at-a-glance, no menu dive)
//   - DD-009 Zero-Training UI (HoverHint spells out where + how to change it)
//   - Twin portability — pure TS module; ports verbatim

import { computed } from 'vue'
import { MODEL_ID } from '../config/llm'

/** Which AI provider is currently active. */
export type ActiveProvider = 'anthropic' | 'ollama'

/** Rich record for the currently-active model. */
export interface ActiveModelInfo {
  /** Which provider is answering SEM's API calls. */
  provider:  ActiveProvider
  /** Human-readable display name, e.g. "Claude Sonnet 4.6", "Llama 3.1 8B (Ollama)". */
  displayName: string
  /** Raw model id string (Anthropic model slug, or Ollama model name). */
  rawId:     string
  /** One-line description for HoverHint / a11y label. */
  hint:      string
  /** Emoji or short glyph used in the chip. */
  glyph:     string
  /** True when this is a locally-run open model (currently only Ollama). */
  isLocal:   boolean
  /** Suggested chip theme — 'strong' = default trust; 'caution' = warn (weaker/local). */
  theme:     'strong' | 'caution'
}

/**
 * Detect the currently-configured provider from env vars.  This runs ONCE per
 * page load; the env is baked at Vite build time so no reactivity is needed.
 *
 * Env-var priority:
 *   - VITE_OLLAMA_MODEL     — model name to feed to the Ollama adapter
 *   - VITE_OLLAMA_BASE_URL  — where Ollama listens (default http://localhost:11434)
 *   - Presence of EITHER    — activates Ollama mode
 *   - Absence of BOTH       — Anthropic Claude via MODEL_ID from config/llm.ts
 */
function detectActiveModel(): ActiveModelInfo {
  const ollamaModel = (import.meta.env.VITE_OLLAMA_MODEL as string | undefined)?.trim() || ''
  const ollamaBase  = (import.meta.env.VITE_OLLAMA_BASE_URL as string | undefined)?.trim() || ''

  const ollamaActive = !!(ollamaModel || ollamaBase)

  if (ollamaActive) {
    const modelId = ollamaModel || '(default)'
    // Nice display name from common short forms like llama3.1:8b → Llama 3.1 8B
    const pretty = modelId
      .replace(/^llama/i, 'Llama ')
      .replace(/:/, ' ')
      .replace(/\b([0-9])b\b/i, '$1B')
      .replace(/\s+/g, ' ')
      .trim()
    return {
      provider:    'ollama',
      displayName: `${pretty} (Ollama · local)`,
      rawId:       modelId,
      hint:        `Currently talking to a LOCAL Ollama instance (${ollamaBase || 'http://localhost:11434'}) running model "${modelId}".  Local models are faster + private but weaker at complex multi-section JSON generation than Claude Sonnet.  To switch to Anthropic Claude: remove VITE_OLLAMA_MODEL + VITE_OLLAMA_BASE_URL from .env.local and restart Vite.  (Runtime Settings toggle is Phase 2.)`,
      glyph:       '🦙',
      isLocal:     true,
      theme:       'caution',
    }
  }

  // Anthropic Claude — the default path.
  // Pretty display name from a raw slug like "claude-sonnet-4-6" → "Claude Sonnet 4.6"
  const pretty = MODEL_ID
    .replace(/^claude-/i, 'Claude ')
    .replace(/-([a-z])/g, (_m, c: string) => ' ' + c.toUpperCase())
    .replace(/\b(\d)-(\d)\b/g, '$1.$2')
    .replace(/\s+/g, ' ')
    .trim()
  return {
    provider:    'anthropic',
    displayName: pretty,
    rawId:       MODEL_ID,
    hint:        `Currently talking to Anthropic ${pretty} via the @anthropic-ai/sdk.  Sonnet-tier: strong at multi-section JSON generation + Planguage discipline + citation vocabulary.  To switch to a local Ollama model, set VITE_OLLAMA_MODEL (e.g. llama3.1:8b) in .env.local and restart Vite.  (Runtime Settings toggle is Phase 2.)`,
    glyph:       '🤖',
    isLocal:     false,
    theme:       'strong',
  }
}

/** Singleton — the active model is decided at page-load time, not reactively. */
const ACTIVE_MODEL: ActiveModelInfo = detectActiveModel()

/**
 * Composable — returns a read-only view of the active model.
 * Returned refs are computed constants (env-driven, not reactive).
 */
export function useActiveModel() {
  return {
    /** All model info as an object (recommended for template destructuring). */
    activeModel:   computed(() => ACTIVE_MODEL),
    /** Convenience refs for template terseness. */
    provider:      computed(() => ACTIVE_MODEL.provider),
    displayName:   computed(() => ACTIVE_MODEL.displayName),
    hint:          computed(() => ACTIVE_MODEL.hint),
    glyph:         computed(() => ACTIVE_MODEL.glyph),
    isLocal:       computed(() => ACTIVE_MODEL.isLocal),
    theme:         computed(() => ACTIVE_MODEL.theme),
  }
}

/** Non-reactive accessor for use outside components (e.g. in composables). */
export function getActiveModel(): ActiveModelInfo {
  return ACTIVE_MODEL
}
