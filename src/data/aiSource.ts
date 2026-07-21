// UNIT_TYPE=Data
//
// aiSource.ts — Shared source-layer enum for the Conjunction-of-Technologies
// SUPREME principle (Tom Gilb 2026-06-03).
//
// Every AI suggestion / critique / observation in the SEM App MUST carry a
// source-layer badge so the user can see at a glance WHERE the assertion came
// from.  Provenance ordered most-to-least authoritative:
//
//   plan      — Derived from the current Planguage spec data (deterministic)
//   gilb      — Cited from Gilb's authored corpus (book + chapter / Template / Rule)
//   standards — Cited from `10.Standard/Standard.Kai-Zen/` (Tom's Planguage standards)
//   internet  — Fetched from the web (current data + URL citation)
//   llm       — From LLM training corpus (general knowledge, no citation)
//   template  — Generic static template (lowest provenance, fallback only)
//
// Used by FEED ME!, Evo Step Improvement, Sharp Interview, EvoPlanner,
// Planguage Standards Auditor, Planguage Analyzer, EHT, and any future
// AI-bearing surface.

export type AISource = 'plan' | 'gilb' | 'standards' | 'internet' | 'llm' | 'template'

/** Display metadata for each source — drives badge label + colour + HoverHint. */
export const AI_SOURCE_META: Record<AISource, {
  label: string
  shortLabel: string
  description: string
  /** Tailwind classes for the badge — light variant for inline use. */
  classes: string
  /** Severity for ordering (lower number = higher provenance). */
  rank: number
}> = {
  plan: {
    label: 'Derived from current plan',
    shortLabel: 'Plan',
    description: 'Deterministically derived from the current Planguage spec data — no inference, no hallucination.',
    classes: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    rank: 1,
  },
  gilb: {
    label: 'Cited from Gilb corpus',
    shortLabel: 'Gilb',
    description: 'Cited from Tom Gilb\'s authored books (Software Metrics, PoSEM, Competitive Engineering, EVO 2024, Stakeholder Engineering, SUCCESS, Value Improvement, etc.).',
    classes: 'bg-amber-100 text-amber-800 border-amber-300',
    rank: 2,
  },
  standards: {
    label: 'Cited from 10.Standard',
    shortLabel: 'Standard',
    description: 'Cited from the Kai-Zen Planguage standards in 10.Standard/ (Template_Write_*.md, Rule_Write_*.md, Proc_*.md).',
    classes: 'bg-indigo-100 text-indigo-700 border-indigo-300',
    rank: 2,
  },
  internet: {
    label: 'Internet-fetched',
    shortLabel: 'Web',
    description: 'Pulled from the internet — with URL citation. Industry benchmarks, current regulations, stakeholder context.',
    classes: 'bg-sky-100 text-sky-700 border-sky-300',
    rank: 3,
  },
  llm: {
    label: 'LLM training',
    shortLabel: 'LLM',
    description: 'From the language-model training corpus — general knowledge, no specific citation possible.',
    classes: 'bg-slate-100 text-slate-700 border-slate-300',
    rank: 4,
  },
  template: {
    label: 'Generic template',
    shortLabel: 'Template',
    description: 'Static fallback template — lowest provenance, not tailored to the current plan or any external knowledge source.',
    classes: 'bg-slate-100 text-slate-500 border-slate-300',
    rank: 5,
  },
}

/** Optional Gilb citation attached to a `gilb`-source finding. */
export interface GilbCitation {
  /** Book / publication title (e.g., "EVO 2024", "Competitive Engineering", "PoSEM"). */
  book: string
  /** Chapter / section / page reference (e.g., "ch.2 p.19", "Template_Write_Value.md"). */
  ref: string
  /** Optional quote / paraphrase of the cited content (≤ 200 chars). */
  quote?: string
  /** Optional URL if the citation is online (Gilb's site, glossary entry, etc.). */
  url?: string
}

/** Optional internet citation attached to an `internet`-source finding. */
export interface InternetCitation {
  /** URL (required for internet sources). */
  url: string
  /** Page / source title. */
  title?: string
  /** When fetched (ISO date) — citations age. */
  fetchedAt?: string
  /** Optional quote (≤ 200 chars). */
  quote?: string
}

/** Optional standards citation for `standards`-source findings. */
export interface StandardsCitation {
  /** Standard file (e.g., "Template_Write_Value.md", "Rule_Write_planguage-spec.md"). */
  file: string
  /** Optional section / line ref. */
  section?: string
  /** Optional quote. */
  quote?: string
}

/** Compound provenance object — attach to any AI-generated finding. */
export interface SourceProvenance {
  source: AISource
  gilbCitation?: GilbCitation
  internetCitation?: InternetCitation
  standardsCitation?: StandardsCitation
  /** Free-text rationale (any source). */
  note?: string
}
