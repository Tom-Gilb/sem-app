<!-- UNIT_TYPE=Panel -->
<!--
/**
 * StandardsAuditorPanel — Planguage-vs-Standards Auditor.
 *
 * Tom Gilb 2026-06-03 Conjunction-of-Technologies SUPREME principle, EXPLOIT #1.
 * Reads the current Planguage spec, audits against `10.Standard/Standard.Kai-Zen/`
 * Templates + Rules, returns per-defect violations with Standards citations.
 *
 * Two detection paths:
 *   (a) Deterministic mock detector (v1 ships now) — built-in checks for the
 *       most common violations (missing Goal / Scale / Meter / presenceTest / impact).
 *       Fast, no Claudian needed, runs locally.
 *   (b) Claudian-driven full audit (v1 prompt ready, paste-back UX) — Claudian
 *       reads every Standards file directly + the spec, returns a rich finding set.
 *
 * Per Conjunction principle: every finding carries a SourceBadge (always "standards"
 * for this tool) and a citation that the user can click through to verify.
 *
 * Rules complied with: Single-Surface, ScrollContainer, CloseDot,
 * Planguage-Glyph-First, Interaction Disclosure, Banned-Scrum-Vocabulary,
 * AI-Max, Claude-Code-as-AI-Layer.
 */
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import ScrollContainer from './ScrollContainer.vue'
import CloseDot from './CloseDot.vue'
import SourceBadge from './SourceBadge.vue'
import {
  type StandardsFinding,
  type StandardsAuditSet,
  type StandardsSeverity,
  storageKey,
  buildMockAudit,
  buildClaudianPrompt,
} from '../data/standardsAudit'
import type { SpecBlock } from '../types/spec'

const props = defineProps<{
  spec: SpecBlock
  planId?: string
}>()

defineEmits<{ close: [] }>()

const planIdRef = computed(() => props.planId ?? 'default')

function load(): StandardsAuditSet | null {
  try {
    const raw = localStorage.getItem(storageKey(planIdRef.value))
    if (!raw) return null
    return JSON.parse(raw) as StandardsAuditSet
  } catch { return null }
}
function save(s: StandardsAuditSet): void {
  try { localStorage.setItem(storageKey(planIdRef.value), JSON.stringify(s)) } catch { /* quota */ }
}

const auditSet = ref<StandardsAuditSet | null>(load())
watch(auditSet, (s) => { if (s) save(s) }, { deep: true })
watch(planIdRef, () => { auditSet.value = load() })

// ── Detection ────────────────────────────────────────────────────────────────

function runDeterministicAudit(): void {
  auditSet.value = buildMockAudit(planIdRef.value, props.spec)
}

const copyFlash = ref(false)
function copyClaudianPrompt(): void {
  const prompt = buildClaudianPrompt(props.spec)
  if (navigator.clipboard) {
    navigator.clipboard.writeText(prompt).then(() => {
      copyFlash.value = true
      setTimeout(() => { copyFlash.value = false }, 2000)
    }).catch(() => { /* ignore */ })
  }
  showPaste.value = true
}

// ── Paste-back ───────────────────────────────────────────────────────────────

const showPaste = ref(false)
const pasteText = ref('')
const pasteError = ref('')
function onPaste(): void {
  try {
    const parsed = JSON.parse(pasteText.value.trim()) as Partial<StandardsAuditSet>
    if (!Array.isArray(parsed.findings)) {
      pasteError.value = 'Missing "findings" array.'
      return
    }
    auditSet.value = {
      planId: planIdRef.value,
      generatedAt: Date.now(),
      generatedBy: 'claudian',
      findings: parsed.findings,
      standardsConsulted: parsed.standardsConsulted ?? [],
    }
    pasteText.value = ''
    pasteError.value = ''
    showPaste.value = false
  } catch (err) {
    pasteError.value = `Parse error: ${err instanceof Error ? err.message : String(err)}`
  }
}

function clearAll(): void {
  if (confirm('Clear all findings?')) {
    auditSet.value = null
    try { localStorage.removeItem(storageKey(planIdRef.value)) } catch { /* ignore */ }
  }
}

// ── Computed displays ────────────────────────────────────────────────────────

function severityChip(sev: StandardsSeverity): { label: string; classes: string } {
  switch (sev) {
    case 'red':    return { label: 'RED — MUST FIX', classes: 'bg-red-100 text-red-700 border-red-300' }
    case 'orange': return { label: 'ORANGE',          classes: 'bg-amber-100 text-amber-700 border-amber-300' }
    case 'green':  return { label: 'GREEN — NUDGE',  classes: 'bg-emerald-100 text-emerald-700 border-emerald-300' }
  }
}

const redCount = computed(() => auditSet.value?.findings.filter(f => f.severity === 'red').length ?? 0)
const orangeCount = computed(() => auditSet.value?.findings.filter(f => f.severity === 'orange').length ?? 0)
const greenCount = computed(() => auditSet.value?.findings.filter(f => f.severity === 'green').length ?? 0)
const totalFindings = computed(() => auditSet.value?.findings.length ?? 0)

/** Group findings by targetType for display. */
const groupedFindings = computed<Record<string, StandardsFinding[]>>(() => {
  const groups: Record<string, StandardsFinding[]> = {}
  for (const f of auditSet.value?.findings ?? []) {
    if (!groups[f.targetType]) groups[f.targetType] = []
    groups[f.targetType].push(f)
  }
  return groups
})
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[500] bg-slate-900/70 flex items-stretch justify-center p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="standards-audit-title"
      @click.self="$emit('close')"
    >
      <div class="w-full max-w-5xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col">

        <header class="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-indigo-700 to-violet-700 text-white">
          <span class="text-2xl leading-none" aria-hidden="true">📚</span>
          <div class="flex-1 min-w-0">
            <h2 id="standards-audit-title" class="text-base font-bold">Planguage Standards Auditor</h2>
            <p class="text-[11px] text-indigo-100 mt-0.5">
              Cross-references current spec against <code class="bg-white/15 rounded px-1">10.Standard/Standard.Kai-Zen/</code> ·
              every finding cites the standard violated
              <span v-if="totalFindings > 0" class="ml-2">
                · <span class="text-red-200 font-bold">{{ redCount }} red</span>
                · <span class="text-amber-200 font-bold">{{ orangeCount }} orange</span>
                <span v-if="greenCount > 0"> · <span class="text-emerald-200 font-bold">{{ greenCount }} green</span></span>
              </span>
            </p>
          </div>
          <CloseDot variant="on-dark" aria-label="Close Standards Auditor" @click="$emit('close')" />
        </header>

        <ScrollContainer outer-class="flex-1 min-h-0" inner-class="p-5 space-y-5">

          <!-- Action bar -->
          <section class="flex gap-2 flex-wrap items-center">
            <button
              type="button"
              class="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700"
              title="Runs the deterministic auditor against the current spec (no Claudian needed — checks missing Goal / Scale / Meter / presenceTest / impact). Fast + local."
              @click="runDeterministicAudit"
            >Run Deterministic Audit</button>
            <button
              type="button"
              class="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-bold hover:bg-amber-700"
              title="Copies a full Claudian audit prompt to clipboard. Claudian reads every Standards file + the spec, returns a rich finding set with verbatim citations."
              @click="copyClaudianPrompt"
            >{{ copyFlash ? '✓ Prompt copied' : 'Full Audit via Claudian (citations)' }}</button>
            <button
              v-if="totalFindings > 0"
              type="button"
              class="px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100"
              title="Clear all findings"
              @click="clearAll"
            >Clear</button>
          </section>

          <!-- Standards-consulted strip -->
          <section v-if="auditSet && auditSet.standardsConsulted.length > 0" class="rounded-lg border border-indigo-200 bg-indigo-50/40 px-3 py-2 text-[11px]">
            <span class="font-bold text-indigo-700">Standards consulted:</span>
            <span class="text-slate-700 ml-1">{{ auditSet.standardsConsulted.join(' · ') }}</span>
          </section>

          <!-- Findings (empty state) -->
          <section v-if="!auditSet || totalFindings === 0" class="text-center py-10 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50">
            <p class="text-sm text-slate-700">No findings yet.  Click <strong>Run Deterministic Audit</strong> for the built-in checks, or <strong>Full Audit via Claudian</strong> for a rich audit with verbatim Standards citations.</p>
          </section>

          <!-- Findings grouped by entry type -->
          <section v-else v-for="(group, targetType) in groupedFindings" :key="targetType" class="space-y-2">
            <h3 class="text-xs font-bold uppercase tracking-wide text-slate-700">
              {{ targetType }} — {{ group.length }} finding{{ group.length === 1 ? '' : 's' }}
            </h3>
            <article
              v-for="f in group"
              :key="f.id"
              class="rounded-xl border-2 bg-white overflow-hidden"
              :class="f.severity === 'red' ? 'border-red-300' : f.severity === 'orange' ? 'border-amber-300' : 'border-emerald-300'"
            >
              <header class="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2 flex-wrap">
                <span class="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border" :class="severityChip(f.severity).classes">{{ severityChip(f.severity).label }}</span>
                <span class="text-[10px] font-mono text-slate-500">{{ f.targetRef }}</span>
                <h4 class="text-sm font-bold text-slate-800 flex-1 min-w-0">{{ f.title }}</h4>
                <SourceBadge :provenance="f.provenance" size="compact" />
              </header>
              <div class="p-3 space-y-2">
                <p class="text-xs text-slate-700">{{ f.description }}</p>
                <div class="rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1.5">
                  <p class="text-[10px] font-bold uppercase tracking-wide text-emerald-700 mb-0.5">Suggested fix</p>
                  <p class="text-xs text-slate-800">{{ f.suggestedFix }}</p>
                </div>
                <div class="rounded-lg bg-indigo-50 border border-indigo-200 px-2.5 py-1.5">
                  <p class="text-[10px] font-bold uppercase tracking-wide text-indigo-700 mb-0.5">Standard cited</p>
                  <p class="text-[11px] font-mono text-indigo-900">
                    {{ f.standardsCitation.file }}<span v-if="f.standardsCitation.section"> · §{{ f.standardsCitation.section }}</span>
                  </p>
                  <p v-if="f.standardsCitation.quote" class="text-[11px] text-slate-700 italic mt-1">"{{ f.standardsCitation.quote }}"</p>
                </div>
              </div>
            </article>
          </section>

          <!-- Paste area for Claudian JSON -->
          <section v-if="showPaste" class="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <h4 class="text-xs font-bold text-slate-700 mb-1">Paste Claudian JSON</h4>
            <textarea
              v-model="pasteText"
              rows="4"
              placeholder='{"findings": [...], "standardsConsulted": [...]}'
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-[11px] font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <div class="flex items-center gap-2 mt-2">
              <button type="button" class="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700" @click="onPaste">Paste &amp; Save</button>
              <button type="button" class="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs hover:bg-slate-100" @click="showPaste = false; pasteText = ''">Cancel</button>
              <p v-if="pasteError" class="text-xs text-red-700">{{ pasteError }}</p>
            </div>
          </section>
        </ScrollContainer>
      </div>
    </div>
  </Teleport>
</template>
