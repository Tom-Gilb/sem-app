<!-- UNIT_TYPE=Panel -->
<!--
 * Stage4ToolsAndAgentsTable.vue — optional palette of Tools and Agents at
 * Stage 4 sub-step 4.4.
 *
 * Tom Gilb 2026-06-21 verbatim: *"Planner is Presented with an optional (can
 * ignore and move on) Menu of Tools and Agents (Like Penta and Munger) on a
 * Table describing how they might help them analyze and improve the spec and
 * the estimates. They should be able to use any number of tools any number
 * of times until they choose to 'Move Ahead to Next Stage'."*
 *
 * Composes with: rule_stage_4_impacts_design.md SUPREME · Demo vs Guided vs
 * Tour vs History rule (these are Tools/Agents, not demos) · CloseDot SUPREME
 * · Stages-are-Cyclic SUPREME (cycles are encouraged) · No-Silent-Removal
 * (existing tool launchers preserved; this table is an ADDITIONAL surface).
 -->
<script setup lang="ts">
import { computed } from 'vue'
import CloseDot from './CloseDot.vue'

export type Stage4ToolKey =
  | 'penta'
  | 'multivision'
  | 'value-flow'
  | 'compare'
  | 'spec-health'
  | 'munger'
  | 'maria'
  | 'elon'
  | 'incorruptible'
  | 'spec-agent'

interface Stage4ToolDef {
  key:         Stage4ToolKey
  kind:        'tool' | 'agent'
  label:       string
  glyph:       string
  oneLineHelp: string
  longHelp:    string
}

const TOOLS_AND_AGENTS: readonly Stage4ToolDef[] = [
  // Tools (visualizations / analyzers)
  { key: 'penta',         kind: 'tool',  label: 'Penta',         glyph: '⬠',
    oneLineHelp: 'Five-axis radar showing balance across Functions/Values/Solutions/Constraints/Resources.',
    longHelp:    'Reveals over- or under-investment in any of the five Planguage entry types — quickly shows whether the current estimate distribution is balanced for the Reasonable Balance test.' },
  { key: 'multivision',   kind: 'tool',  label: 'Multivision',   glyph: '◐',
    oneLineHelp: 'Multi-perspective view of the spec — different stakeholder lenses on the same estimates.',
    longHelp:    'Lets the planner see the IET through different stakeholder priorities (e.g. Customer view vs Finance view vs Engineering view) so estimates can be sharpened per audience.' },
  { key: 'value-flow',    kind: 'tool',  label: 'Value Flow',    glyph: '⤳',
    oneLineHelp: 'Diagram of how Solutions flow value to Values, weighted by estimates.',
    longHelp:    'Visualises the Solution → Value impact graph as a directed diagram with edge thickness proportional to estimate magnitude — surfaces orphan Solutions (no Value impact) and underserved Values (no Solution impact).' },
  { key: 'compare',       kind: 'tool',  label: 'Compare',       glyph: '⇄',
    oneLineHelp: 'Side-by-side comparison of two Estimates Versions.',
    longHelp:    'Diff two saved Estimates Versions to see what changed between approvals — supports the "create new Spec versions, revert to previous versions" workflow at sub-step 4.4.' },
  { key: 'spec-health',   kind: 'tool',  label: 'Spec Health',   glyph: '♥',
    oneLineHelp: 'Plan Health Indicator audit — surfaces missing fields, orphan entries, Infinity-Trap defects.',
    longHelp:    'Runs the full PHI audit (banked rules: ic-orphan-solutions, ic-solution-tier1-incomplete, cv-stakeholder-coverage, etc.).  At Stage 4 specifically, surfaces estimate gaps that need evidence before approval.' },

  // Agents (Claudian-driven personalities)
  { key: 'munger',        kind: 'agent', label: 'Munger',        glyph: '🎩',
    oneLineHelp: 'Charlie-Munger-style mental-models critique — inversion, second-order effects, lollapaloozas.',
    longHelp:    'Applies Munger\'s mental-models lens to the estimates: where are we ignoring second-order effects?  Where could low-probability tail events invalidate the estimate?  What\'s the inverted question we should be asking?' },
  { key: 'maria',         kind: 'agent', label: 'Maria',         glyph: '📋',
    oneLineHelp: 'Governance-grade four-section analysis — risk, compliance, ethics, board-readiness.',
    longHelp:    'Produces a governance-report on the current estimate set: risk exposure, compliance gaps, ethics-of-assumption, board-presentation readiness.  Sonnet-grade analysis (per Model Selection Rule).' },
  { key: 'elon',          kind: 'agent', label: 'Elon',          glyph: '🚀',
    oneLineHelp: 'First-principles + Velocity-of-Learning critique.',
    longHelp:    'Applies Elon\'s first-principles thinking to the estimates: which estimates rest on borrowed assumptions vs physics?  Where is the planner optimising for the wrong metric?  Composes with the Stages-are-Cyclic + Velocity-of-Learning quote (Tom Gilb 2026-06-21).' },
  { key: 'incorruptible', kind: 'agent', label: 'Incorruptible', glyph: '⚖',
    oneLineHelp: 'Eric-Ries-Incorruptible four-pillar audit (Purpose · Coherence · Integrity · Compliance).',
    longHelp:    'Runs the Ries Incorruptible Figure 5.1 framework against the estimates — does the estimate set hold up under the four pillars?  Pulls from the Ries-Incorruptible cumulative rules banked at .claude/ries-incorruptible-rules/.' },
  { key: 'spec-agent',    kind: 'agent', label: 'Spec Agent',    glyph: '✦',
    oneLineHelp: 'Spec-discipline enforcement — Parameter Discipline + Mnemonic ID + Spell-out + Qualifiers.',
    longHelp:    'Sweeps the spec for violations of banked rules (V1/V2 mnemonic IDs, paragraph descriptions, missing Qualifiers, abbreviated type names).  At Stage 4: ensures the estimates carry the same discipline as the entries they describe.' },
] as const

const props = defineProps<{
  /** True when the panel is currently open. */
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'invoke', key: Stage4ToolKey): void
  (e: 'close'): void
  (e: 'continue'): void
}>()

const tools  = computed(() => TOOLS_AND_AGENTS.filter(t => t.kind === 'tool'))
const agents = computed(() => TOOLS_AND_AGENTS.filter(t => t.kind === 'agent'))

function invoke(key: Stage4ToolKey): void {
  emit('invoke', key)
}

function rowClass(kind: 'tool' | 'agent'): string {
  return kind === 'tool'
    ? 'bg-sky-50 hover:bg-sky-100 border-sky-200'
    : 'bg-violet-50 hover:bg-violet-100 border-violet-200'
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[600] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Stage 4 — Tools and Agents"
      @click.self="emit('close')"
    >
      <div
        class="w-full max-w-3xl max-h-[85vh] flex flex-col bg-white rounded-2xl shadow-2xl border-2 border-indigo-300 overflow-hidden"
      >
        <header class="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-indigo-700 to-violet-700 text-white shrink-0">
          <span aria-hidden="true" class="text-base">🛠</span>
          <div class="flex-1 min-w-0">
            <h2 class="text-sm font-bold tracking-wide">Stage 4 · 4.4 — Tools and Agents</h2>
            <p class="text-[10px] text-indigo-100">Optional. Any number of tools, any number of times. Then "Move Ahead to Next Stage".</p>
          </div>
          <CloseDot variant="on-dark" size="lg" title="Close — return to Stage 4" aria-label="Close Tools and Agents" @click="emit('close')" />
        </header>

        <div class="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <!-- TOOLS section -->
          <section>
            <h3 class="text-[11px] font-bold uppercase tracking-widest text-sky-700 mb-2">Tools — visualise · analyse</h3>
            <table class="w-full text-sm border-collapse">
              <thead>
                <tr class="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <th class="text-left py-1.5 w-[40px]"></th>
                  <th class="text-left py-1.5 w-[130px]">Tool</th>
                  <th class="text-left py-1.5">How it helps at Stage 4</th>
                  <th class="text-right py-1.5 w-[80px]">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="t in tools"
                  :key="t.key"
                  :class="['border-b border-slate-100 transition-colors', rowClass(t.kind)]"
                >
                  <td class="py-2 pl-3 text-xl text-center" :aria-hidden="true">{{ t.glyph }}</td>
                  <td class="py-2 font-semibold text-slate-800">{{ t.label }}</td>
                  <td class="py-2 text-[12px] text-slate-700 leading-snug" :title="t.longHelp">{{ t.oneLineHelp }}</td>
                  <td class="py-2 pr-3 text-right">
                    <button
                      type="button"
                      class="h-7 px-2.5 rounded-md text-[10px] font-semibold bg-sky-600 text-white hover:bg-sky-700 transition-colors"
                      :aria-label="`Invoke ${t.label}`"
                      :title="`Invoke ${t.label} — ${t.longHelp}`"
                      @click="invoke(t.key)"
                    >Invoke →</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <!-- AGENTS section -->
          <section>
            <h3 class="text-[11px] font-bold uppercase tracking-widest text-violet-700 mb-2">Agents — Claudian-driven critique + analysis</h3>
            <table class="w-full text-sm border-collapse">
              <thead>
                <tr class="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <th class="text-left py-1.5 w-[40px]"></th>
                  <th class="text-left py-1.5 w-[130px]">Agent</th>
                  <th class="text-left py-1.5">How it helps at Stage 4</th>
                  <th class="text-right py-1.5 w-[80px]">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="a in agents"
                  :key="a.key"
                  :class="['border-b border-slate-100 transition-colors', rowClass(a.kind)]"
                >
                  <td class="py-2 pl-3 text-xl text-center" :aria-hidden="true">{{ a.glyph }}</td>
                  <td class="py-2 font-semibold text-slate-800">{{ a.label }}</td>
                  <td class="py-2 text-[12px] text-slate-700 leading-snug" :title="a.longHelp">{{ a.oneLineHelp }}</td>
                  <td class="py-2 pr-3 text-right">
                    <button
                      type="button"
                      class="h-7 px-2.5 rounded-md text-[10px] font-semibold bg-violet-600 text-white hover:bg-violet-700 transition-colors"
                      :aria-label="`Invoke ${a.label}`"
                      :title="`Invoke ${a.label} — ${a.longHelp}`"
                      @click="invoke(a.key)"
                    >Invoke →</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <!-- Cyclic reminder -->
          <div class="rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-2">
            <p class="text-[11px] text-indigo-800 leading-relaxed italic">
              Use any number of tools and agents, any number of times. Create new Spec versions
              and revert/nickname as needed. When ready, "Move Ahead to Next Stage" — you can
              always return to Stage 4 to refine after later-stage discoveries.
              <span class="not-italic font-semibold">(Stages are Cyclic — Tom Gilb, 21 June 2026)</span>
            </p>
          </div>
        </div>

        <footer class="flex items-center justify-between gap-2 px-5 py-3 bg-slate-50 border-t border-slate-200 shrink-0">
          <button
            type="button"
            class="h-9 px-3 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-200 transition-colors"
            @click="emit('close')"
          >Close — stay at Stage 4</button>
          <button
            type="button"
            class="h-9 px-4 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm"
            @click="emit('continue')"
          >Move Ahead to Stage 5 →</button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>
