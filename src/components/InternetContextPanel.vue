<!-- UNIT_TYPE=Panel -->
<!--
/**
 * InternetContextPanel — combined Stakeholder Context Fetcher + Industry
 * Benchmark Layer.
 *
 * Tom Gilb 2026-06-03 Conjunction-of-Technologies SUPREME principle,
 * EXPLOITS #3 + #4.  Two tabs (Stakeholder / Industry) in one panel because
 * they share the same Claudian-driven internet-fetch + paste-back pattern.
 *
 * Per Conjunction principle: every finding carries an `internetCitation`
 * (URL + title + fetchedAt + optional quote) — no hallucinated sources.
 *
 * v1 ships the data layer + Claudian prompt copy + paste-back UX + findings
 * display.  Claudian does the actual WebSearch / WebFetch (its tools).
 * v2 could add per-finding "Apply to spec" buttons + citation freshness alerts.
 */
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import ScrollContainer from './ScrollContainer.vue'
import CloseDot from './CloseDot.vue'
import SourceBadge from './SourceBadge.vue'
import {
  type StakeholderContextSet,
  storageKey as stakeholderKey,
  buildClaudianPrompt as buildStakeholderPrompt,
} from '../data/stakeholderContext'
import {
  type BenchmarkSet,
  storageKey as benchmarkKey,
  buildClaudianPrompt as buildBenchmarkPrompt,
} from '../data/industryBenchmark'
import type { SpecBlock } from '../types/spec'

const props = defineProps<{
  spec: SpecBlock
  planId?: string
}>()

defineEmits<{ close: [] }>()

const planIdRef = computed(() => props.planId ?? 'default')
const activeTab = ref<'stakeholder' | 'benchmark'>('stakeholder')

// ── Stakeholder tab ──────────────────────────────────────────────────────────

/** Stakeholder names extracted from the spec — for the picker dropdown. */
const stakeholderOptions = computed<string[]>(() => {
  const names = new Set<string>()
  for (const f of props.spec.functions ?? []) {
    if (f.functionOfValue) names.add(f.functionOfValue)
  }
  for (const v of props.spec.values ?? []) {
    if (v.wishStakeholder) names.add(v.wishStakeholder)
  }
  return Array.from(names).sort()
})

const selectedStakeholder = ref<string>('')
watch(stakeholderOptions, (opts) => {
  if (!selectedStakeholder.value && opts.length > 0) selectedStakeholder.value = opts[0]
}, { immediate: true })

const stakeholderSet = ref<StakeholderContextSet | null>(null)
watch([planIdRef, selectedStakeholder], () => {
  if (!selectedStakeholder.value) return
  try {
    const raw = localStorage.getItem(stakeholderKey(planIdRef.value, selectedStakeholder.value))
    stakeholderSet.value = raw ? (JSON.parse(raw) as StakeholderContextSet) : null
  } catch { stakeholderSet.value = null }
}, { immediate: true })

const stakeholderCopyFlash = ref(false)
function copyStakeholderPrompt(): void {
  if (!selectedStakeholder.value) return
  const planSummary = `Plan id: ${planIdRef.value}\nFunctions: ${(props.spec.functions ?? []).map(f => f.id).join(', ')}\nValues: ${(props.spec.values ?? []).map(v => v.id).join(', ')}\nSolutions: ${(props.spec.solutions ?? []).map(s => s.id).join(', ')}`
  const prompt = buildStakeholderPrompt(selectedStakeholder.value, planSummary)
  if (navigator.clipboard) {
    navigator.clipboard.writeText(prompt).then(() => {
      stakeholderCopyFlash.value = true
      setTimeout(() => { stakeholderCopyFlash.value = false }, 2000)
    }).catch(() => { /* ignore */ })
  }
  stakeholderShowPaste.value = true
}

const stakeholderShowPaste = ref(false)
const stakeholderPasteText = ref('')
const stakeholderPasteError = ref('')
function stakeholderPaste(): void {
  if (!selectedStakeholder.value) return
  try {
    const parsed = JSON.parse(stakeholderPasteText.value.trim()) as Partial<StakeholderContextSet>
    if (!Array.isArray(parsed.findings)) { stakeholderPasteError.value = 'Missing "findings" array.'; return }
    const set: StakeholderContextSet = {
      planId: planIdRef.value,
      stakeholderName: selectedStakeholder.value,
      generatedAt: Date.now(),
      generatedBy: 'claudian',
      findings: parsed.findings,
    }
    stakeholderSet.value = set
    try { localStorage.setItem(stakeholderKey(planIdRef.value, selectedStakeholder.value), JSON.stringify(set)) } catch { /* quota */ }
    stakeholderPasteText.value = ''
    stakeholderPasteError.value = ''
    stakeholderShowPaste.value = false
  } catch (err) {
    stakeholderPasteError.value = `Parse error: ${err instanceof Error ? err.message : String(err)}`
  }
}

// ── Benchmark tab ────────────────────────────────────────────────────────────

const benchmarkSet = ref<BenchmarkSet | null>(null)
watch(planIdRef, () => {
  try {
    const raw = localStorage.getItem(benchmarkKey(planIdRef.value))
    benchmarkSet.value = raw ? (JSON.parse(raw) as BenchmarkSet) : null
  } catch { benchmarkSet.value = null }
}, { immediate: true })

const benchmarkCopyFlash = ref(false)
function copyBenchmarkPrompt(): void {
  const valueEntries = (props.spec.values ?? []).map(v => ({
    id: v.id, description: v.description, scale: v.scale, tolerable: v.tolerable, goal: v.goal, wish: v.wish,
  }))
  const prompt = buildBenchmarkPrompt(valueEntries)
  if (navigator.clipboard) {
    navigator.clipboard.writeText(prompt).then(() => {
      benchmarkCopyFlash.value = true
      setTimeout(() => { benchmarkCopyFlash.value = false }, 2000)
    }).catch(() => { /* ignore */ })
  }
  benchmarkShowPaste.value = true
}

const benchmarkShowPaste = ref(false)
const benchmarkPasteText = ref('')
const benchmarkPasteError = ref('')
function benchmarkPaste(): void {
  try {
    const parsed = JSON.parse(benchmarkPasteText.value.trim()) as Partial<BenchmarkSet>
    if (!Array.isArray(parsed.findings)) { benchmarkPasteError.value = 'Missing "findings" array.'; return }
    const set: BenchmarkSet = {
      planId: planIdRef.value,
      generatedAt: Date.now(),
      generatedBy: 'claudian',
      findings: parsed.findings,
    }
    benchmarkSet.value = set
    try { localStorage.setItem(benchmarkKey(planIdRef.value), JSON.stringify(set)) } catch { /* quota */ }
    benchmarkPasteText.value = ''
    benchmarkPasteError.value = ''
    benchmarkShowPaste.value = false
  } catch (err) {
    benchmarkPasteError.value = `Parse error: ${err instanceof Error ? err.message : String(err)}`
  }
}

function severityClasses(sev: string): string {
  if (sev === 'red') return 'border-red-300'
  if (sev === 'orange') return 'border-amber-300'
  return 'border-emerald-300'
}
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[500] bg-slate-900/70 flex items-stretch justify-center p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="internet-context-title"
      @click.self="$emit('close')"
    >
      <div class="w-full max-w-5xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col">

        <header class="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-sky-600 to-cyan-600 text-white">
          <span class="text-2xl leading-none" aria-hidden="true">🌐</span>
          <div class="flex-1 min-w-0">
            <h2 id="internet-context-title" class="text-base font-bold">Internet Context Fetcher</h2>
            <p class="text-[11px] text-sky-100 mt-0.5">
              Conjunction Exploits #3 + #4 · Stakeholder updates + Industry benchmarks · all findings URL-cited
            </p>
          </div>
          <CloseDot variant="on-dark" aria-label="Close Internet Context Fetcher" @click="$emit('close')" />
        </header>

        <nav class="flex border-b border-slate-200 bg-slate-50">
          <button
            type="button"
            class="px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors"
            :class="activeTab === 'stakeholder' ? 'text-sky-700 border-sky-600 bg-white' : 'text-slate-600 border-transparent hover:text-slate-800'"
            @click="activeTab = 'stakeholder'"
          >👥 Stakeholder Context</button>
          <button
            type="button"
            class="px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors"
            :class="activeTab === 'benchmark' ? 'text-sky-700 border-sky-600 bg-white' : 'text-slate-600 border-transparent hover:text-slate-800'"
            @click="activeTab = 'benchmark'"
          >📊 Industry Benchmark</button>
        </nav>

        <ScrollContainer outer-class="flex-1 min-h-0" inner-class="p-5 space-y-4">

          <!-- ── STAKEHOLDER TAB ────────────────────────────────────────────── -->
          <template v-if="activeTab === 'stakeholder'">
            <p class="text-xs text-slate-600">
              For a chosen stakeholder, Claudian fetches current internet context (regulations, incidents, published standards)
              and proposes concrete Planguage spec updates with URL citations.  Every finding carries an
              <SourceBadge :source="'internet'" size="compact" /> badge.
            </p>

            <div class="flex gap-2 items-center flex-wrap">
              <label class="text-xs text-slate-700 flex items-center gap-1.5">
                Stakeholder:
                <select v-model="selectedStakeholder" class="rounded border border-slate-300 px-2 py-1 text-sm">
                  <option v-if="stakeholderOptions.length === 0" disabled value="">No stakeholders detected in spec</option>
                  <option v-for="name in stakeholderOptions" :key="name" :value="name">{{ name }}</option>
                </select>
              </label>
              <button
                v-if="selectedStakeholder"
                type="button"
                class="px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-bold hover:bg-sky-700"
                title="Copies a Claudian prompt for this stakeholder to clipboard.  Claudian uses WebSearch / WebFetch to find current authoritative information + cites URLs.  Paste the Planguage Representation result back here."
                @click="copyStakeholderPrompt"
              >{{ stakeholderCopyFlash ? '✓ Prompt copied' : 'Fetch via Claudian' }}</button>
            </div>

            <section v-if="stakeholderSet && stakeholderSet.findings.length > 0" class="space-y-2">
              <h3 class="text-xs font-bold uppercase tracking-wide text-slate-700">Findings for {{ selectedStakeholder }}</h3>
              <article
                v-for="f in stakeholderSet.findings"
                :key="f.id"
                class="rounded-xl border-2 bg-white overflow-hidden"
                :class="severityClasses(f.severity)"
              >
                <header class="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2 flex-wrap">
                  <h4 class="text-sm font-bold text-slate-800 flex-1 min-w-0">{{ f.title }}</h4>
                  <SourceBadge :provenance="f.provenance" size="compact" />
                </header>
                <div class="p-3 space-y-2 text-xs">
                  <p class="text-slate-800">{{ f.observation }}</p>
                  <div class="rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1.5">
                    <p class="text-[10px] font-bold uppercase tracking-wide text-emerald-700 mb-0.5">Suggested spec update</p>
                    <p class="text-slate-800">{{ f.suggestedSpecUpdate }}</p>
                  </div>
                  <a
                    :href="f.citation.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="block rounded-lg bg-sky-50 border border-sky-200 px-2.5 py-1.5 hover:bg-sky-100 transition-colors"
                  >
                    <p class="text-[10px] font-bold uppercase tracking-wide text-sky-700">Source URL · {{ f.citation.fetchedAt }}</p>
                    <p class="text-[11px] text-sky-900 font-mono truncate">{{ f.citation.url }}</p>
                    <p v-if="f.citation.title" class="text-[11px] text-slate-700">{{ f.citation.title }}</p>
                  </a>
                </div>
              </article>
            </section>
            <div v-else-if="selectedStakeholder" class="text-center py-8 text-slate-500 text-sm">
              No findings yet for {{ selectedStakeholder }}.  Click <strong>Fetch via Claudian</strong> to generate.
            </div>

            <section v-if="stakeholderShowPaste" class="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <h4 class="text-xs font-bold text-slate-700 mb-1">Paste Claudian Planguage Representation</h4>
              <textarea v-model="stakeholderPasteText" rows="4" placeholder='{"findings": [...]}' class="w-full rounded-lg border border-slate-300 px-3 py-2 text-[11px] font-mono focus:outline-none focus:ring-2 focus:ring-sky-400" />
              <div class="flex items-center gap-2 mt-2">
                <button type="button" class="px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-bold hover:bg-sky-700" @click="stakeholderPaste">Paste &amp; Save</button>
                <button type="button" class="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs hover:bg-slate-100" @click="stakeholderShowPaste = false">Cancel</button>
                <p v-if="stakeholderPasteError" class="text-xs text-red-700">{{ stakeholderPasteError }}</p>
              </div>
            </section>
          </template>

          <!-- ── BENCHMARK TAB ──────────────────────────────────────────────── -->
          <template v-else>
            <p class="text-xs text-slate-600">
              For every Value Spec, Claudian fetches published industry benchmarks (Auth0 / Okta / Gartner / academic papers)
              and tells you where your Tolerable / Goal / Wish sits relative to the industry norm — with URL citations per data point.
            </p>

            <div class="flex gap-2 items-center flex-wrap">
              <button
                type="button"
                class="px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-bold hover:bg-sky-700"
                title="Copies a benchmark-fetch prompt for all Value Specs in the current spec to clipboard."
                @click="copyBenchmarkPrompt"
              >{{ benchmarkCopyFlash ? '✓ Prompt copied' : 'Fetch Benchmarks via Claudian' }}</button>
            </div>

            <section v-if="benchmarkSet && benchmarkSet.findings.length > 0" class="space-y-2">
              <h3 class="text-xs font-bold uppercase tracking-wide text-slate-700">Benchmark Findings</h3>
              <article
                v-for="f in benchmarkSet.findings"
                :key="f.id"
                class="rounded-xl border-2 border-slate-200 bg-white overflow-hidden"
              >
                <header class="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2 flex-wrap">
                  <span class="text-[10px] font-mono text-slate-500">{{ f.valueRef }}</span>
                  <span class="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border bg-sky-100 text-sky-700 border-sky-300">{{ f.verdict }}</span>
                  <h4 class="text-sm font-bold text-slate-800 flex-1 min-w-0">{{ f.verdictExplanation }}</h4>
                  <SourceBadge :provenance="f.provenance" size="compact" />
                </header>
                <div class="p-3 space-y-2 text-xs">
                  <div class="rounded-lg bg-sky-50 border border-sky-200 px-2.5 py-1.5 space-y-1">
                    <p class="text-[10px] font-bold uppercase tracking-wide text-sky-700">Industry data points</p>
                    <a
                      v-for="(dp, i) in f.dataPoints"
                      :key="i"
                      :href="dp.citation.url"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="block text-[11px] hover:bg-sky-100 px-1 py-0.5 rounded transition-colors"
                    >
                      <span class="font-bold text-slate-800">{{ dp.value }}</span>
                      <span class="text-slate-600 ml-1">— {{ dp.label }}</span>
                      <span class="text-sky-700 font-mono ml-1 truncate">{{ dp.citation.url }}</span>
                    </a>
                  </div>
                  <div v-if="f.suggestedTolerable || f.suggestedGoal || f.suggestedWish" class="rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1.5">
                    <p class="text-[10px] font-bold uppercase tracking-wide text-emerald-700 mb-0.5">Suggested thresholds</p>
                    <p v-if="f.suggestedTolerable" class="text-slate-800">Tolerable → <strong>{{ f.suggestedTolerable }}</strong></p>
                    <p v-if="f.suggestedGoal" class="text-slate-800">Goal → <strong>{{ f.suggestedGoal }}</strong></p>
                    <p v-if="f.suggestedWish" class="text-slate-800">Wish → <strong>{{ f.suggestedWish }}</strong></p>
                  </div>
                </div>
              </article>
            </section>
            <div v-else class="text-center py-8 text-slate-500 text-sm">
              No benchmark findings yet.  Click <strong>Fetch Benchmarks via Claudian</strong> to generate.
            </div>

            <section v-if="benchmarkShowPaste" class="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <h4 class="text-xs font-bold text-slate-700 mb-1">Paste Claudian Planguage Representation</h4>
              <textarea v-model="benchmarkPasteText" rows="4" placeholder='{"findings": [...]}' class="w-full rounded-lg border border-slate-300 px-3 py-2 text-[11px] font-mono focus:outline-none focus:ring-2 focus:ring-sky-400" />
              <div class="flex items-center gap-2 mt-2">
                <button type="button" class="px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-bold hover:bg-sky-700" @click="benchmarkPaste">Paste &amp; Save</button>
                <button type="button" class="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs hover:bg-slate-100" @click="benchmarkShowPaste = false">Cancel</button>
                <p v-if="benchmarkPasteError" class="text-xs text-red-700">{{ benchmarkPasteError }}</p>
              </div>
            </section>
          </template>
        </ScrollContainer>
      </div>
    </div>
  </Teleport>
</template>
