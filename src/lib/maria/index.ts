// UNIT_TYPE=Lib
// maria/index.ts — barrel export for the portable Maria library
//
// All public API for the Maria Board Work Parse agent in one import:
//
//   import { analyseDocument, buildMariaEmailHtml, buildMockMariaResult } from '@/lib/maria'
//
// For standalone / Kai-Zen / Twin use, copy this folder (lib/maria/) alongside
// src/types/maria.ts and src/config/maria-prompt.ts.
// Wire analyseDocument() to your own LlmCaller implementation.
// No Vue, no Anthropic SDK, no browser APIs required.

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  MariaResult,
  MariaDecision,
  MariaAuthorityEntry,
  MariaGap,
  MariaPattern,
  GovernanceLayer,
  AuthorityGapSeverity,
} from '../../types/maria'

// ── Prompt ────────────────────────────────────────────────────────────────────
export { MARIA_SYSTEM_PROMPT, MARIA_PROMPT_CACHE_CONTROL } from '../../config/maria-prompt'

// ── Core pipeline (inject your LlmCaller) ─────────────────────────────────────
export type { LlmCaller } from './analyser'
export { analyseDocument } from './analyser'

// ── JSON parser (use directly when you control the raw LLM response) ──────────
export { parseMariaResult } from './parser'

// ── Mock / fixture ────────────────────────────────────────────────────────────
export { buildMockMariaResult } from './mock'

// ── Email report builder ──────────────────────────────────────────────────────
export type { MariaEmailOptions } from './email'
export { buildMariaEmailHtml } from './email'
