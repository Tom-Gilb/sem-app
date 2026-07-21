/**
 * useModelModeContext — Tom Gilb 2026-06-16 verbatim 4-axis Model Mode design.
 *
 * Reads the active `modelMode` config from useSettings and produces a
 * structured prompt prefix that any spec / model generation flow can
 * inject into its LLM call.  Parallels `_buildContractsModeContext` in
 * `useContractParser.ts`.
 *
 * Tom Gilb 2026-06-16 verbatim: *"MODEL MODE SETTINGS, (IN MAIN SETTINGS)
 * SUGGESTIONS. 1. Model Domain: Organization, Product, Building, Abstract
 * (language, process, method, policy, contract, Plan). 2. Model Presentation:
 * Planguage, Diagram, 3d, Colorful, Black/White, Slide Deck Presentation,
 * Paper, Booklet. 3. Model Analytics: Conformance to Standards (Planguage,
 * Elon, Incorruptible, URLs of Any Standards, (search for additional
 * standards)), 4. Model Purpose: (complex system maintenance, academic
 * research and presentation, management decision-making, managing supply
 * chain and suppliers, ADD MORE)"*
 *
 * Composes with: Conjunction-of-Technologies SUPREME (the search-additional
 * toggle materialises the Internet layer); SEM-teaches-incrementally
 * (the prompt names what the model is FOR so the LLM tunes output to
 * audience + intent); AI-Max (the config enriches every LLM call).
 */

import type { ModelModeConfig } from '../data/settings'
import { useSettings } from './useSettings'

// ── Human-readable labels for the LLM prompt (mirrors the Settings UI) ───────

const DOMAIN_LABELS: Record<string, string> = {
  'organization':       'an organization (units, roles, processes, governance)',
  'product':            'a product (features, performance, lifecycle)',
  'building':           'a physical building or structure (materials, performance, regulatory compliance)',
  'abstract-language':  'a language (grammar, semantics, vocabulary)',
  'abstract-process':   'a process (sequence, conditions, decision points)',
  'abstract-method':    'a method (sequence of techniques applied to achieve a goal)',
  'abstract-policy':    'a policy (principles, rules, obligations)',
  'abstract-contract':  'a contract (parties, obligations, conditions, remedies)',
  'abstract-plan':      'a plan (Stakes, Ends, Means, Evo Steps)',
}

const PRESENTATION_LABELS: Record<string, string> = {
  'planguage':   'Planguage spec form — F. V. C. R. S. entries with Scale + Meter + Tolerable + Goal + Wish',
  'diagram':     '2D diagram (mermaid / SVG flow / ontology graph)',
  '3d':          '3D model — depth, perspective, interactive rotation',
  'colorful':    'Full-colour palette rendering — distinguish categories at a glance',
  'black-white': 'Monochrome rendering — accessibility, print, photocopy, formal academic',
  'slide-deck':  'Keynote / PowerPoint-ready slide deck — one section per slide',
  'paper':       'Long-form academic / business paper — full text, citations, figures inline',
  'booklet':     'Printable booklet — narrative chapters, illustrations, table of contents',
}

const STANDARD_LABELS: Record<string, string> = {
  'planguage':    'Tom Gilb · Planguage methodology (quantified entries, scale-and-meter discipline)',
  'elon':         'Musk\'s Methods (Gilb) + Dove Pace-of-Innovation Paper (Pace dominant requirement, first-principles, 5-step algorithm)',
  'incorruptible':'Eric Ries · Incorruptible 4-pillar framework (Purpose · Coherence · Integrity · Compliance)',
}

const PURPOSE_LABELS: Record<string, string> = {
  'complex-system-maintenance':     'COMPLEX SYSTEM MAINTENANCE — surface dependencies, single points of failure, scheduled-maintenance windows',
  'academic-research-presentation': 'ACADEMIC RESEARCH + PRESENTATION — include full citations, methodology section, reproducible parameters, peer-review ready',
  'management-decision-making':     'MANAGEMENT DECISION-MAKING — surface trade-offs, scenarios, decision matrices, KPI projections',
  'supply-chain-management':        'SUPPLY CHAIN MANAGEMENT — surface dependencies, lead times, single-source risks, supplier KPIs',
  'organizational-design':          'ORGANIZATIONAL DESIGN — units, roles, reporting lines, accountability chains',
  'product-development':            'PRODUCT DEVELOPMENT — feature roadmap, performance targets, integration points',
  'risk-assessment':                'RISK ASSESSMENT — surface exposure, mitigation, residual risk, monitoring cadence',
  'compliance-audit':               'COMPLIANCE AUDIT — surface every claim with a citation, traceable to a standard or regulation',
  'training-education':             'TRAINING + EDUCATION — learning objectives, exercises, assessment criteria, instructor notes',
  'innovation-roadmap':             'INNOVATION ROADMAP — moonshot bets, current-state baseline, gap analysis, milestones',
}

// ── Public API ──────────────────────────────────────────────────────────────

/** Safe-fallback Model Mode config when useSettings is unavailable
 *  (tests, headless rendering). */
function _safeFallbackConfig(): ModelModeConfig {
  return {
    domain: 'product',
    presentation: 'planguage',
    standards: ['planguage'],
    standardsCustomUrls: [],
    searchForAdditionalStandards: true,
    purposes: ['management-decision-making'],
  }
}

/** Read the active Model Mode config from useSettings, with safe fallback. */
export function readModelModeConfig(): ModelModeConfig {
  try {
    const { settings } = useSettings()
    // r41 v50 — explicit copy to strip readonly array types from useSettings.
    const m = settings.value.modelMode
    return {
      domain:                       m.domain,
      presentation:                 m.presentation,
      standards:                    [...m.standards],
      standardsCustomUrls:          [...m.standardsCustomUrls],
      searchForAdditionalStandards: m.searchForAdditionalStandards,
      purposes:                     [...m.purposes],
    }
  } catch {
    return _safeFallbackConfig()
  }
}

/**
 * Build a structured prompt prefix from the active Model Mode config.
 *
 * Inject this string at the TOP of any LLM prompt for spec / model generation.
 * The LLM treats it as a hard constraint: model the chosen domain in the
 * chosen presentation, check against the chosen standards, fulfil all chosen
 * purposes simultaneously.
 *
 * Returns an empty string only when the config is empty (defensive — should
 * never happen with `readModelModeConfig` since it guarantees a fallback).
 */
export function buildModelModeContext(cfg?: ModelModeConfig): string {
  const c = cfg ?? readModelModeConfig()
  if (!c) return ''
  const lines: string[] = []
  lines.push('━━ MODEL MODE (Tom Gilb 2026-06-16 4-axis config) ━━')
  lines.push(`DOMAIN — this model describes ${DOMAIN_LABELS[c.domain] || c.domain}.`)
  lines.push(`PRESENTATION — render as ${PRESENTATION_LABELS[c.presentation] || c.presentation}.`)
  if (c.standards.length > 0) {
    lines.push('STANDARDS the model must conform to:')
    for (const id of c.standards) {
      lines.push(`  - ${STANDARD_LABELS[id] || id}`)
    }
  }
  if (c.standardsCustomUrls.length > 0) {
    const nonEmpty = c.standardsCustomUrls.filter(u => u.trim())
    if (nonEmpty.length > 0) {
      lines.push('CUSTOM REFERENCE URLs (treat as additional standards):')
      for (const url of nonEmpty) lines.push(`  - ${url.trim()}`)
    }
  }
  if (c.searchForAdditionalStandards) {
    lines.push('SEARCH FOR ADDITIONAL STANDARDS — actively search the internet (or your training corpus) for additional relevant standards beyond those listed above; cite them by name + URL.')
  }
  if (c.purposes.length > 0) {
    lines.push('PURPOSE — apply ALL of the following (compose them):')
    for (const p of c.purposes) {
      lines.push(`  - ${PURPOSE_LABELS[p] || p}`)
    }
  } else {
    lines.push('PURPOSE: (none selected — defaulting to MANAGEMENT DECISION-MAKING)')
    lines.push(`  - ${PURPOSE_LABELS['management-decision-making']}`)
  }
  lines.push('━━ END MODEL MODE ━━')
  return lines.join('\n')
}

/** Composable wrapper for components that prefer the use*() ergonomic shape. */
export function useModelModeContext() {
  return {
    readModelModeConfig,
    buildModelModeContext,
  }
}
