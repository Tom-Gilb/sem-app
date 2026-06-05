// UNIT_TYPE=Composable
/**
 * useAgentContext — Cross-entity history context for AI prompts.
 *
 * Composes a concise plain-text summary of the user's recent work across all
 * four entity types (Plans, Models, Contracts, Maria analyses) and returns it
 * as a reactive computed string.  Drop this string into any Claude system prompt
 * so agents have workspace awareness without requiring the user to re-explain
 * their context in every conversation.
 *
 * Usage:
 *   const { contextSummary } = useAgentContext()
 *   // In an API call:
 *   system: `${BASE_PROMPT}\n\n${specContext}${contextSummary.value}`
 *
 * Twin-portability:
 *   All sources (usePlanImporter, useModelLibrary, useContractStore,
 *   mariaHistory) are framework-free singletons.  The composable itself
 *   only uses Vue's `computed()` — trivially portable to any reactive system.
 *
 * Performance:
 *   contextSummary is a lazy computed — it does not recompute until a
 *   dependency changes.  Each dependency is a module-level ref so
 *   recomputation is proportional to actual data changes, not render cycles.
 */

import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import { useSpecImporter } from './useSpecImporter'
import { useModelLibrary } from './useModelLibrary'
import { useContractStore } from './useContractStore'
import { mariaHistory } from '../lib/maria/mariaResultStore'

export function useAgentContext(): { contextSummary: ComputedRef<string> } {
  // All three composables are module-level singletons — calling them here
  // returns reactive refs pointing at the same underlying state as everywhere
  // else in the app.  No risk of duplicated data or stale snapshots.
  const { plans }                   = useSpecImporter()
  const { allEntries: allModels }   = useModelLibrary()
  const { contracts }               = useContractStore()

  const contextSummary = computed<string>(() => {
    const sections: string[] = []

    // ── Plans (last 3) ────────────────────────────────────────────────────────
    const planLines = plans.value.slice(0, 3).map(p => {
      const cv = p.versions.find(v => v.id === p.currentVersionId)
      const ec  = cv?.entries.length   ?? 0
      const sc  = cv?.overallScore     ?? 0
      const vc  = p.versions.length
      return `• "${p.title}": ${ec} entr${ec === 1 ? 'y' : 'ies'}, score ${sc}/100 (${vc} version${vc !== 1 ? 's' : ''})`
    })
    if (planLines.length) sections.push('PLANS (most recent first):\n' + planLines.join('\n'))

    // ── Models — user-created only (last 3) ───────────────────────────────────
    const modelLines = allModels.value
      .filter(m => m.source === 'user')
      .slice(0, 3)
      .map(m => {
        const vc = m.versions?.length ?? 0
        return `• "${m.title}": ${m.entries.length} entries, ${m.stakeholders.length} stakeholders${vc ? `, ${vc} saved version${vc !== 1 ? 's' : ''}` : ''}`
      })
    if (modelLines.length) sections.push('MODELS (user-created, most recent first):\n' + modelLines.join('\n'))

    // ── Contracts (last 3) ────────────────────────────────────────────────────
    const contractLines = contracts.value.slice(0, 3).map(c => {
      const entryCount = c.clauses.flatMap(cl => cl.entries).length
      const clauseStr  = `${c.clauses.length} clause${c.clauses.length !== 1 ? 's' : ''}`
      return `• "${c.title}" [${c.contractType}]: ${clauseStr}, ${entryCount} Planguage entries`
    })
    if (contractLines.length) sections.push('CONTRACTS (most recent first):\n' + contractLines.join('\n'))

    // ── Maria board analyses (last 3) ─────────────────────────────────────────
    const mariaLines = mariaHistory.value.slice(0, 3).map(r =>
      `• "${r.title}" (${r.takenAt.slice(0, 10)}): ${r.decisionCount} decisions, ${r.authorityGapCount} authority gap${r.authorityGapCount !== 1 ? 's' : ''}, ${r.governanceGapCount} governance gap${r.governanceGapCount !== 1 ? 's' : ''}`
    )
    if (mariaLines.length) sections.push('BOARD ANALYSES (most recent first):\n' + mariaLines.join('\n'))

    if (!sections.length) return ''
    return '\n\n[WORKSPACE CONTEXT — recent work across all entities]\n' + sections.join('\n\n') + '\n[/WORKSPACE CONTEXT]'
  })

  return { contextSummary }
}
