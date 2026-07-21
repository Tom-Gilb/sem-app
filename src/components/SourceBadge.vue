<!-- UNIT_TYPE=Widget -->
<!--
/**
 * SourceBadge — universal display of an AI-finding's source-layer provenance.
 *
 * Tom Gilb 2026-06-03 Conjunction-of-Technologies SUPREME principle: every AI
 * suggestion / critique / observation MUST carry a source-layer badge so the
 * user can see at a glance WHERE the assertion came from.
 *
 * Renders a compact pill with the short source label (Plan / Gilb / Standard
 * / Web / LLM / Template), colour-coded by provenance rank.  Hover reveals
 * the full description + any attached citation (Gilb book + page, URL,
 * Standard file).
 *
 * Use sites: FEED ME!, Evo Step Improvement, Sharp Interview, EHT,
 * Planguage Standards Auditor, Planguage Analyzer.
 *
 * Pure prop in, no state.  Twin-portable.
 */
-->
<script setup lang="ts">
import { computed } from 'vue'
import {
  type AISource,
  type SourceProvenance,
  AI_SOURCE_META,
} from '../data/aiSource'

const props = defineProps<{
  /** Either pass a full provenance object OR just the source enum. */
  source?: AISource
  provenance?: SourceProvenance
  /** Compact vs default rendering. */
  size?: 'compact' | 'default'
}>()

const resolvedSource = computed<AISource>(() => props.provenance?.source ?? props.source ?? 'template')
const meta = computed(() => AI_SOURCE_META[resolvedSource.value])

/** Build the HoverHint text: base description + any citation detail. */
const tooltip = computed<string>(() => {
  const parts: string[] = [meta.value.label, '— ' + meta.value.description]
  const p = props.provenance
  if (p?.gilbCitation) {
    parts.push(`\n\nGilb citation: ${p.gilbCitation.book} ${p.gilbCitation.ref}`)
    if (p.gilbCitation.quote) parts.push(`  "${p.gilbCitation.quote}"`)
    if (p.gilbCitation.url) parts.push(`  ${p.gilbCitation.url}`)
  }
  if (p?.standardsCitation) {
    parts.push(`\n\nStandard: ${p.standardsCitation.file}`)
    if (p.standardsCitation.section) parts.push(`  section ${p.standardsCitation.section}`)
    if (p.standardsCitation.quote) parts.push(`  "${p.standardsCitation.quote}"`)
  }
  if (p?.internetCitation) {
    parts.push(`\n\nURL: ${p.internetCitation.url}`)
    if (p.internetCitation.title) parts.push(`  ${p.internetCitation.title}`)
    if (p.internetCitation.fetchedAt) parts.push(`  fetched ${p.internetCitation.fetchedAt}`)
  }
  if (p?.note) parts.push(`\n\nNote: ${p.note}`)
  return parts.join('\n')
})

/** Has any citation detail to show as a small inline indicator. */
const hasCitation = computed<boolean>(() => {
  const p = props.provenance
  return !!(p?.gilbCitation || p?.internetCitation || p?.standardsCitation)
})
</script>

<template>
  <span
    class="inline-flex items-center gap-1 font-bold uppercase tracking-wide border rounded cursor-help"
    :class="[
      meta.classes,
      size === 'compact' ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5',
    ]"
    :title="tooltip"
    role="img"
    :aria-label="`Source: ${meta.label}`"
  >
    <span>{{ meta.shortLabel }}</span>
    <!-- Citation indicator dot — visible when citation detail attached -->
    <span
      v-if="hasCitation"
      class="inline-block w-1 h-1 rounded-full bg-current opacity-70"
      aria-hidden="true"
    />
  </span>
</template>
