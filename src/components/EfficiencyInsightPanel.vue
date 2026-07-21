<!-- UNIT_TYPE=Panel
  EfficiencyInsightPanel.vue — In-depth illumination of the Penta Efficiency score.

  Tom Gilb 2026-06-10 (verbatim): "People are not good at looking at that ratio,
   to prioritize and motivate. there is space to explain efficiency in an Info
   in depth (the usual several parts) and separate from that, to offer to display
   the basis for the efficiency computation in more detail. Have a go, make it
   colorful and interesting. Include 'So What (what they can do to improve it)'"

  Six sections (scrollable):
    1. Current State — live score badge + grade, with cannot-compute fallback
    2. What is Efficiency? — multi-paragraph Planguage definition
    3. The Formula — visual equation
    4. Computation Basis — actual per-Value + per-Resource breakdown driving the score
    5. So What? — deterministic action list tailored to the current state
    6. Sources — Gilb book citations

  Pattern: full-screen modal Teleport — backdrop z-[650] + panel z-[651] + CloseDot
  variant="on-dark" + ScrollContainer body (matches GlyphDataPanel).
  Composes with usePenta, PentaEfficiency, PentaModel types — no API calls.
-->
<template>
  <Teleport to="body">
    <!-- Backdrop (click to close — but only AFTER ~350ms grace, so the trailing click of a
         double-click that opened the panel does NOT immediately close it. r68 dblclick bug —
         Tom Gilb 2026-06-10: panel was flashing open + closed instantly because the 2nd click
         of his dblclick landed on the freshly-rendered backdrop instead of the original target.) -->
    <div class="fixed inset-0 z-[650] bg-black/70 backdrop-blur-sm" @click="onBackdropClick" />

    <!-- Panel -->
    <div
      ref="panelEl"
      class="fixed inset-x-4 top-8 bottom-8 z-[651] mx-auto max-w-4xl rounded-2xl bg-white shadow-2xl ring-1 ring-slate-300 flex flex-col outline-none"
      tabindex="-1"
      @keydown.esc.stop="$emit('close')"
    >

      <!-- ── Header bar (gradient) ─────────────────────────────────────────── -->
      <!-- r85 (Tom 2026-06-10: "text space"): score circle widened 64→80 px and
           percentage font shrunk so "+500%" fits without crowding the title. -->
      <div
        class="shrink-0 px-6 py-4 rounded-t-2xl text-white flex items-center gap-4 bg-gradient-to-r"
        :class="headerGradient"
      >
        <div class="shrink-0 flex items-center justify-center w-20 h-20 rounded-full bg-white/20 ring-2 ring-white/50">
          <div v-if="efficiency.cannotCompute" class="text-xl font-bold">N/A</div>
          <div v-else class="text-center px-1">
            <div class="text-base font-black leading-none whitespace-nowrap">{{ fmtBalance(efficiency.balancePercent) }}</div>
            <div class="text-[8px] font-bold uppercase tracking-wider mt-1 opacity-90">{{ efficiency.grade }}</div>
          </div>
        </div>
        <div class="flex-1 min-w-0">
          <h2 class="text-lg font-bold leading-tight">Efficiency · The Central Penta Metric</h2>
          <p class="text-xs opacity-90 leading-snug mt-0.5">
            <span v-if="efficiency.cannotCompute">{{ efficiency.cannotComputeReason }}</span>
            <span v-else>Value Delivered / Resources Used · ratio {{ efficiency.ratio.toFixed(2) }} → {{ fmtBalance(efficiency.balancePercent) }}</span>
          </p>
        </div>
        <!-- Export actions — inline buttons (Tom Gilb 2026-06-11 r93: "that upside down triangle
             to get the apply line is not intuitive, or documented, dont do that"). Flattened from
             popover to inline. The earlier "single Export button" instruction (r89) is overridden
             by Tom's observation in use — visibility beats minimalism for actions that are used. -->
        <button
          type="button"
          class="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-bold border border-white/30 transition-colors flex items-center gap-1.5"
          title="📋 Copy — captures MORE than what's currently visible. The export includes the WHAT IS EFFICIENCY explanation, all 3 FORMULA sub-steps, the 4-cell Grade Thresholds grid, the full COMPUTATION BASIS with every V. entry + every R. entry (including those flagged 'Status missing'), the SO WHAT actions, and the Sources footer — even if you have to scroll the panel to see them all. Paste with ⌘V into Mail, Notes, Keynote, anywhere."
          @click="exportInsight('copy')"
        >
          <span>📋</span><span>Copy</span>
        </button>
        <button
          type="button"
          class="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-bold border border-white/30 transition-colors flex items-center gap-1.5"
          title="✉ Email — captures MORE than what's currently visible. Includes WHAT IS EFFICIENCY explanation, all 3 FORMULA sub-steps, Grade Thresholds grid, full COMPUTATION BASIS with every V. + every R. entry, SO WHAT actions, and Sources — even content past the fold. Auto-opens Mail with colourful HTML on clipboard, paste with ⌘V in the body."
          @click="exportInsight('email')"
        >
          <span>✉</span><span>Email</span>
        </button>
        <CloseDot variant="on-dark" size="lg" :title="'Close insight panel (Esc)'" @click="$emit('close')" />
      </div>

      <!-- ── Scrollable body ───────────────────────────────────────────────── -->
      <!-- r85 (Tom 2026-06-10: "info window stopped scrolling"): outer-class needs
           min-h-0 OR the flex-1 child can't shrink below content height, so the
           ScrollContainer's overflow never activates. Same flexbox bug as r75. -->
      <ScrollContainer outer-class="flex-1 min-h-0" inner-class="px-6 py-5 space-y-5">

        <!-- ❶ WHAT IS EFFICIENCY? ─────────────────────────────────────────── -->
        <section class="rounded-xl border border-blue-200 bg-blue-50/60 p-5">
          <header class="flex items-center gap-2 mb-3">
            <span class="text-lg">📚</span>
            <h3 class="text-sm font-bold uppercase tracking-wide text-blue-800">What is Efficiency?</h3>
          </header>
          <div class="space-y-3 text-sm text-slate-700 leading-relaxed">
            <p>
              <strong class="text-blue-900">Efficiency is the ratio of Value Delivered to Resources Used.</strong>
              It is the central metric of the Penta Model — the hub that every outer sector (Scope,
              Values, Resources, Designs) feeds into.
            </p>
            <p>
              In Planguage terms, <em>Value Delivery</em> is the average of (Status / Goal) across
              every V. entry that has both a target and a current measurement. <em>Resource Use</em>
              is the average of (Status / Budget) across every R. entry with the same — Status here
              means how much of the budget has been consumed.
            </p>
            <p>
              Efficiency sits at the centre — not at any sector — for a deep reason: every planning
              decision (adding a Solution, increasing a Resource budget, accepting a Tolerable lower
              than Goal) shifts this single ratio. It is the one number that tells you whether the
              plan is winning the value-for-cost game.
            </p>
            <p class="bg-white border-l-4 border-blue-400 pl-3 py-2 italic text-slate-700">
              "The aim is more Value, faster, at less cost — that is the only definition of progress
              worth chasing." — Tom Gilb teaching, codified in <em>Value Improvement</em>.
            </p>
            <p>
              The Penta Model surfaces Efficiency as a <strong>signed percentage centred on zero</strong> —
              following Tom Gilb's natural framing (2026-06-10): "Zero means BALANCE — exactly enough resources
              to reach all Wishes and Goals." A <strong class="text-emerald-700">positive value (+50%)</strong>
              means you have 50% more resources than you need (surplus, headroom). A
              <strong class="text-red-700">negative value (−50%)</strong> means you have only half the resources
              you need (deficit, shortfall — the plan cannot deliver all targets on current funding).
              The further from zero, the bigger the gap in either direction. This sign convention reads
              the way budgets actually feel: + is "I have spare", − is "I'm short".
            </p>
          </div>
        </section>

        <!-- ❷ THE FORMULA ──────────────────────────────────────────────────── -->
        <section class="rounded-xl border border-indigo-200 bg-indigo-50/60 p-5">
          <header class="flex items-center gap-2 mb-3">
            <span class="text-lg">🧮</span>
            <h3 class="text-sm font-bold uppercase tracking-wide text-indigo-800">The Formula</h3>
          </header>

          <div class="space-y-4">
            <!-- Step 1: conceptual -->
            <div class="bg-white rounded-lg p-4 border border-indigo-200">
              <p class="text-[10px] font-bold uppercase tracking-wide text-indigo-500 mb-2">Step 1 · Concept</p>
              <div class="text-center font-mono text-base text-slate-800">
                <span class="text-violet-700 font-bold">Efficiency</span>
                <span class="mx-2 text-slate-400">=</span>
                <span class="text-emerald-700 font-bold">Value Delivered</span>
                <span class="mx-2 text-slate-400">/</span>
                <span class="text-amber-700 font-bold">Resources Used</span>
              </div>
            </div>

            <!-- Step 2: how each component is measured -->
            <div class="bg-white rounded-lg p-4 border border-indigo-200">
              <p class="text-[10px] font-bold uppercase tracking-wide text-indigo-500 mb-2">Step 2 · Planguage Measurement</p>
              <div class="font-mono text-xs text-slate-700 space-y-2">
                <div class="flex items-baseline gap-2">
                  <span class="text-emerald-700 font-bold whitespace-nowrap">Value Delivered</span>
                  <span class="text-slate-400">=</span>
                  <span>avg(<span class="text-emerald-700">Status</span> / <span class="text-emerald-700">Goal</span>) across all V. entries</span>
                </div>
                <div class="flex items-baseline gap-2">
                  <span class="text-amber-700 font-bold whitespace-nowrap">Resources Used</span>
                  <span class="text-slate-400">=</span>
                  <span>avg(<span class="text-amber-700">Status</span> / <span class="text-amber-700">Budget</span>) across all R. entries</span>
                </div>
              </div>
            </div>

            <!-- Step 3: signed balance percent (Tom 2026-06-10 r83 new semantic) -->
            <div class="bg-white rounded-lg p-4 border border-indigo-200">
              <p class="text-[10px] font-bold uppercase tracking-wide text-indigo-500 mb-2">Step 3 · Balance Percent</p>
              <div class="text-center font-mono text-sm text-slate-800">
                <div><span class="text-violet-700 font-bold">balancePercent</span> <span class="text-slate-400 mx-1">=</span> (ratio − 1) × 100</div>
                <div class="text-[11px] text-slate-500 mt-1.5">→ ratio 1.0 = <strong class="text-slate-700">0% (balance)</strong> · ratio 1.5 = <strong class="text-emerald-700">+50% (surplus)</strong> · ratio 0.5 = <strong class="text-red-700">−50% (deficit)</strong></div>
              </div>
            </div>

            <!-- Grade thresholds -->
            <div class="bg-white rounded-lg p-3 border border-indigo-200">
              <p class="text-[10px] font-bold uppercase tracking-wide text-indigo-500 mb-2">Grade Thresholds</p>
              <div class="grid grid-cols-4 gap-2 text-[10px]">
                <div class="rounded p-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 text-center"><div class="font-bold">EXCELLENT</div><div>≥ +50%</div></div>
                <div class="rounded p-1.5 bg-blue-50 text-blue-800 border border-blue-200 text-center"><div class="font-bold">GOOD</div><div>0% to +50%</div></div>
                <div class="rounded p-1.5 bg-amber-50 text-amber-800 border border-amber-200 text-center"><div class="font-bold">ACCEPTABLE</div><div>−40% to 0%</div></div>
                <div class="rounded p-1.5 bg-red-50 text-red-800 border border-red-200 text-center"><div class="font-bold">POOR</div><div>&lt; −40%</div></div>
              </div>
            </div>
          </div>
        </section>

        <!-- ❸ COMPUTATION BASIS ─────────────────────────────────────────────── -->
        <section class="rounded-xl border border-emerald-200 bg-emerald-50/60 p-5">
          <header class="flex items-center gap-2 mb-3">
            <span class="text-lg">🔬</span>
            <h3 class="text-sm font-bold uppercase tracking-wide text-emerald-800">Computation Basis · Your Live Data</h3>
          </header>

          <div v-if="efficiency.cannotCompute" class="rounded-lg bg-white border border-slate-200 p-4 text-center">
            <p class="text-sm font-semibold text-slate-700 mb-1">Cannot compute Efficiency yet.</p>
            <p class="text-xs text-slate-500 italic">{{ efficiency.cannotComputeReason }}</p>
          </div>

          <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Values column -->
            <div class="rounded-lg bg-white border border-emerald-200 overflow-hidden">
              <div class="px-3 py-2 bg-emerald-100 text-emerald-900 font-bold text-[10px] uppercase tracking-wide flex items-center gap-2">
                <span>Value Delivered</span>
                <span class="ml-auto font-mono text-emerald-700">avg: {{ pctOrDash(efficiency.valueAchievement) }}</span>
              </div>
              <div class="divide-y divide-emerald-50">
                <div
                  v-for="row in valueRows"
                  :key="row.id"
                  class="px-3 py-2 text-xs hover:bg-emerald-50/60 transition-colors"
                  :title="`${row.id} — Status ${row.status} / Goal ${row.goal} = ${Math.round(row.achievement * 100)}%`"
                >
                  <div class="flex items-center justify-between gap-2 mb-1">
                    <span class="font-mono font-semibold text-slate-700 truncate">{{ row.id }}</span>
                    <span class="font-mono text-[10px]" :class="achievementColor(row.achievement)">
                      {{ row.status }} / {{ row.goal }} = {{ Math.round(row.achievement * 100) }}%
                    </span>
                  </div>
                  <div class="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      class="h-full rounded-full transition-all"
                      :class="achievementBar(row.achievement)"
                      :style="`width: ${Math.min(100, row.achievement * 100)}%`"
                    />
                  </div>
                </div>
                <div v-if="valueRows.length === 0" class="px-3 py-3 text-center text-slate-400 italic text-[11px]">
                  No V. entries with both Status and Goal yet.
                </div>
              </div>
            </div>

            <!-- Resources column -->
            <div class="rounded-lg bg-white border border-amber-200 overflow-hidden">
              <div class="px-3 py-2 bg-amber-100 text-amber-900 font-bold text-[10px] uppercase tracking-wide flex items-center gap-2">
                <span>Resources Used</span>
                <span class="ml-auto font-mono text-amber-700">avg: {{ pctOrDash(efficiency.resourceUtilization) }}</span>
              </div>
              <div class="divide-y divide-amber-50">
                <div
                  v-for="row in resourceRows"
                  :key="row.id"
                  class="px-3 py-2 text-xs hover:bg-amber-50/60 transition-colors"
                  :title="row.statusMissing
                    ? `${row.id} — Budget ${row.budget}, Status NOT yet reported. The efficiency formula treats missing Status as 0 consumed, so this R. contributes 0% to the average. Update the R. Status field to get a real utilisation reading.`
                    : `${row.id} — Status ${row.consumed} / Budget ${row.budget} = ${Math.round(row.util * 100)}%`"
                >
                  <div class="flex items-center justify-between gap-2 mb-1">
                    <span class="font-mono font-semibold text-slate-700 truncate flex items-center gap-1">
                      {{ row.id }}
                      <!-- r93jj — flag Resources with Budget but no Status -->
                      <span
                        v-if="row.statusMissing"
                        class="inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-200 text-amber-900 text-[9px] font-bold ring-1 ring-amber-400"
                        title="Status (consumed) not yet reported on this R. entry. Treated as 0 by the efficiency formula."
                      >Status missing</span>
                    </span>
                    <span class="font-mono text-[10px]" :class="utilColor(row.util)">
                      <span v-if="row.statusMissing" class="text-slate-500">— / {{ row.budget }} = 0%</span>
                      <span v-else>{{ row.consumed }} / {{ row.budget }} = {{ Math.round(row.util * 100) }}%</span>
                    </span>
                  </div>
                  <div class="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      class="h-full rounded-full transition-all"
                      :class="row.statusMissing ? 'bg-slate-300' : utilBar(row.util)"
                      :style="`width: ${Math.min(100, row.util * 100)}%`"
                    />
                  </div>
                </div>
                <!-- r93jj — accurate empty-state text. The OLD message ("No R. with both Status
                     and Budget yet") was misleading when R. entries existed with Budget but no
                     Status — those now render above with a "Status missing" chip instead. This
                     empty state only fires when there are literally ZERO R. entries with Budget. -->
                <div v-if="resourceRows.length === 0" class="px-3 py-3 text-center text-slate-400 italic text-[11px]">
                  No R. entries with a Budget yet. Add R. entries (or set Budgets) to enable utilisation tracking.
                </div>
              </div>
            </div>
          </div>

          <!-- Final calculation footer -->
          <div v-if="!efficiency.cannotCompute" class="mt-3 rounded-lg bg-gradient-to-r from-emerald-50 via-white to-amber-50 border border-slate-200 p-3 font-mono text-xs">
            <div class="flex items-center justify-center gap-1.5 flex-wrap">
              <span class="text-emerald-700 font-bold">{{ pctOrDash(efficiency.valueAchievement) }}</span>
              <span class="text-slate-400">/</span>
              <span class="text-amber-700 font-bold">{{ pctOrDash(efficiency.resourceUtilization) }}</span>
              <span class="text-slate-400">=</span>
              <span class="text-violet-700 font-bold">ratio {{ efficiency.ratio.toFixed(2) }}</span>
              <span class="text-slate-400">→</span>
              <span class="font-bold" :class="scoreTextColor">{{ fmtBalance(efficiency.balancePercent) }} · {{ efficiency.grade }}</span>
            </div>
          </div>
        </section>

        <!-- ❹ SO WHAT? — actionable recommendations ──────────────────────── -->
        <section class="rounded-xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 p-5">
          <header class="flex items-center gap-2 mb-3">
            <span class="text-lg">🎯</span>
            <h3 class="text-sm font-bold uppercase tracking-wide text-amber-900">So What? · How to Improve</h3>
            <span class="text-[10px] text-amber-700 italic ml-auto">specific to your current state</span>
          </header>

          <div class="space-y-2.5">
            <div
              v-for="(action, idx) in soWhatActions"
              :key="idx"
              class="rounded-lg bg-white border border-amber-200 px-3 py-2.5 flex items-start gap-3 hover:border-amber-400 transition-colors"
            >
              <div class="shrink-0 flex items-center justify-center w-8 h-8 rounded-full text-base" :class="actionBadgeColor(action.priority)">
                {{ action.icon }}
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span class="text-sm font-bold text-slate-800">{{ action.title }}</span>
                  <span class="text-[9px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded-full" :class="actionPriorityChip(action.priority)">
                    {{ action.priority }}
                  </span>
                </div>
                <p class="text-xs text-slate-600 leading-relaxed">{{ action.rationale }}</p>
                <div v-if="action.items && action.items.length > 0" class="flex items-center gap-1.5 flex-wrap mt-1.5">
                  <span
                    v-for="it in action.items"
                    :key="it.id"
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-[10px] font-mono"
                    :title="it.detail"
                  >
                    <span class="font-bold text-amber-900">{{ it.id }}</span>
                    <span class="text-amber-700">·</span>
                    <span class="text-amber-700">{{ it.detail }}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- ❺ SOURCES ──────────────────────────────────────────────────────── -->
        <section class="rounded-xl border border-slate-200 bg-slate-50 p-5">
          <header class="flex items-center gap-2 mb-3">
            <span class="text-lg">📖</span>
            <h3 class="text-sm font-bold uppercase tracking-wide text-slate-700">Sources &amp; Further Reading</h3>
          </header>
          <ul class="text-xs text-slate-600 space-y-1.5">
            <li class="flex items-start gap-2">
              <span class="font-bold text-slate-500 shrink-0">[SM]</span>
              <span><em>Software Metrics</em> (Gilb 1976 / 1988) — the foundational text on quantifying Value and Cost; introduces the discipline of measuring delivery against numeric targets.</span>
            </li>
            <li class="flex items-start gap-2">
              <span class="font-bold text-slate-500 shrink-0">[CE]</span>
              <span><em>Competitive Engineering</em> (Gilb 2005) — Solutions deliver Values within Constraints; the value-per-cost calculus formalised as Engineering practice.</span>
            </li>
            <li class="flex items-start gap-2">
              <span class="font-bold text-slate-500 shrink-0">[VI]</span>
              <span><em>Value Improvement</em> (Gilb) — the discipline of increasing Value while decreasing Cost; explicit value/cost trade-off framing.</span>
            </li>
            <li class="flex items-start gap-2">
              <span class="font-bold text-slate-500 shrink-0">[Penta]</span>
              <span><em>The Penta Model</em> (Gilb &amp; Shalloway 2022) — places Efficiency at the centre of SVERD; this panel is the in-app expression of that hub.</span>
            </li>
          </ul>
        </section>

      </ScrollContainer>

      <!-- Footer -->
      <div class="shrink-0 px-6 py-2.5 bg-slate-50 border-t border-slate-200 rounded-b-2xl flex items-center justify-between text-[10px] text-slate-500">
        <span>Deterministic computation · no AI · live from the spec</span>
        <span class="font-mono">Plan: {{ pentaModel?.planName ?? '—' }}</span>
      </div>

    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'
import type { PentaModel } from '../types/penta'
import { exportCopy, exportEmail } from '../composables/useExportShared'
import { useToast } from '../composables/useToast'

const props = defineProps<{
  pentaModel: PentaModel
}>()
const emit = defineEmits<{ close: [] }>()
const { showToast } = useToast()

// ── Export actions (r89/r93) — inline Copy + Email buttons in header ─────────
async function exportInsight(mode: 'copy' | 'email'): Promise<void> {
  const html  = renderInsightHtml()
  const plain = renderInsightPlain()
  const planName = props.pentaModel.planName ?? '—'
  if (mode === 'copy') {
    await exportCopy(html, plain)
    showToast('Efficiency Insight copied as colourful HTML — paste with ⌘V')
  } else {
    await exportEmail(html, `Efficiency Insight · ${planName}`, planName, 'Tom@Gilb.com', plain)
  }
}

/** Render the Insight Panel content as colourful flat HTML for Copy/Email. */
function renderInsightHtml(): string {
  const eff      = props.pentaModel.efficiency
  const planName = props.pentaModel.planName ?? '—'
  // r93kk — score uses the same ratio× notation as the panel UI (r92c) when |balance| ≥ 1000%
  const fmtScore = (n: number): string => {
    const r = Math.round(n)
    if (Math.abs(r) >= 1000) {
      const ratio = n / 100 + 1
      const sign  = n > 0 ? '+' : '−'
      return `${sign}${Math.round(Math.abs(ratio))}× ratio`
    }
    if (r > 0) return `+${r}%`
    if (r < 0) return `${r}%`
    return '0%'
  }
  const score    = eff.cannotCompute ? 'N/A' : fmtScore(eff.balancePercent)
  const gradeColor =
    eff.cannotCompute        ? '#64748b' :
    eff.grade === 'excellent' ? '#15803d' :
    eff.grade === 'good'     ? '#1d4ed8' :
    eff.grade === 'acceptable'? '#b45309' : '#b91c1c'
  return `
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:780px;font-family:system-ui,-apple-system,sans-serif;border-collapse:collapse;">
  <tr><td bgcolor="${gradeColor}" style="background:${gradeColor};color:#fff;padding:18px 24px;border-radius:12px 12px 0 0;">
    <div style="font-size:22px;font-weight:900;">Efficiency Insight · ${score} · ${eff.grade}</div>
    <div style="font-size:13px;opacity:0.9;margin-top:4px;">${planName} · ${eff.cannotCompute ? (eff.cannotComputeReason ?? '') : `Value Delivered / Resources Used · ratio ${eff.ratio.toFixed(2)}`}</div>
  </td></tr>
  <tr><td bgcolor="#eff6ff" style="background:#eff6ff;padding:14px 20px;border-left:4px solid #2563eb;">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#1e3a8a;letter-spacing:1px;">What is Efficiency?</div>
    <div style="font-size:13px;color:#1e293b;line-height:1.55;margin-top:6px;">
      The ratio of Value Delivered to Resources Used — central metric of the Penta Model.
      Signed balance percent: <strong>0% = balance</strong> (exactly enough resources to reach all Wishes/Goals).
      <strong>+N% = surplus</strong> (N% more resources than needed). <strong>−N% = deficit</strong> (N% short).
      At extreme positive balance (≥ 1000%) the score switches to ratio× notation (e.g. +417× means Value Delivered is 417× Resources Used).
    </div>
  </td></tr>
  <!-- r93kk — Formula section now mirrors the panel UI: 3 explicit sub-steps + Grade Thresholds -->
  <tr><td bgcolor="#eef2ff" style="background:#eef2ff;padding:14px 20px;border-left:4px solid #6366f1;">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#3730a3;letter-spacing:1px;">The Formula · 3 Steps</div>
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:8px;border-collapse:collapse;">
      <tr><td bgcolor="#ffffff" style="background:#fff;padding:10px 12px;border:1px solid #c7d2fe;border-radius:6px;font-family:ui-monospace,monospace;font-size:12px;color:#1e293b;line-height:1.6;">
        <div style="font-weight:700;color:#6366f1;font-size:10px;text-transform:uppercase;margin-bottom:4px;">Step 1 · Conceptual</div>
        <strong>Efficiency</strong> = Value Delivered / Resources Used
      </td></tr>
      <tr><td style="padding:4px 0;"></td></tr>
      <tr><td bgcolor="#ffffff" style="background:#fff;padding:10px 12px;border:1px solid #c7d2fe;border-radius:6px;font-family:ui-monospace,monospace;font-size:12px;color:#1e293b;line-height:1.6;">
        <div style="font-weight:700;color:#6366f1;font-size:10px;text-transform:uppercase;margin-bottom:4px;">Step 2 · How each side is measured</div>
        <strong>Value Delivered</strong> = avg(<span style="color:#15803d;">Status</span> / <span style="color:#15803d;">Goal</span>) across all V. entries<br>
        <strong>Resources Used</strong> = avg(<span style="color:#b45309;">Status</span> / <span style="color:#b45309;">Budget</span>) across all R. entries
      </td></tr>
      <tr><td style="padding:4px 0;"></td></tr>
      <tr><td bgcolor="#ffffff" style="background:#fff;padding:10px 12px;border:1px solid #c7d2fe;border-radius:6px;font-family:ui-monospace,monospace;font-size:12px;color:#1e293b;line-height:1.6;">
        <div style="font-weight:700;color:#6366f1;font-size:10px;text-transform:uppercase;margin-bottom:4px;">Step 3 · Signed Balance Percent</div>
        <strong>balancePercent</strong> = (ratio − 1) × 100, lower-bound clamped at −100 (no upper ceiling).<br>
        <span style="font-size:11px;color:#475569;">ratio 1.0 = 0% balance · ratio 1.5 = +50% surplus · ratio 0.5 = −50% deficit · ratio ≥ 11 → switch to ratio× notation.</span>
      </td></tr>
    </table>
    <!-- Grade Thresholds grid -->
    <div style="margin-top:10px;font-size:10px;color:#3730a3;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Grade Thresholds</div>
    <table cellpadding="0" cellspacing="6" border="0" width="100%" style="margin-top:4px;border-collapse:separate;">
      <tr>
        <td bgcolor="#ecfdf5" style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:4px;padding:6px;text-align:center;font-size:10px;color:#065f46;"><strong>EXCELLENT</strong><br>≥ +50%</td>
        <td bgcolor="#eff6ff" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:4px;padding:6px;text-align:center;font-size:10px;color:#1e3a8a;"><strong>GOOD</strong><br>0% to +50%</td>
        <td bgcolor="#fffbeb" style="background:#fffbeb;border:1px solid #fde68a;border-radius:4px;padding:6px;text-align:center;font-size:10px;color:#92400e;"><strong>ACCEPTABLE</strong><br>−40% to 0%</td>
        <td bgcolor="#fef2f2" style="background:#fef2f2;border:1px solid #fecaca;border-radius:4px;padding:6px;text-align:center;font-size:10px;color:#991b1b;"><strong>POOR</strong><br>&lt; −40%</td>
      </tr>
    </table>
  </td></tr>
  <tr><td bgcolor="#f0fdf4" style="background:#f0fdf4;padding:14px 20px;border-left:4px solid #16a34a;">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#14532d;letter-spacing:1px;">Computation Basis (Live)</div>
    ${valueRows.value.length === 0 && resourceRows.value.length === 0 ? '<div style="font-size:12px;color:#64748b;font-style:italic;margin-top:6px;">No V. or R. data yet.</div>' : ''}
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:8px;font-family:ui-monospace,monospace;font-size:11px;">
      ${valueRows.value.map(r => `<tr><td style="padding:3px 8px;color:#5b21b6;font-weight:700;">${escapeHtml(r.id)}</td><td style="padding:3px 8px;color:#1e293b;">${r.status} / ${r.goal} = ${Math.round(r.achievement * 100)}%</td></tr>`).join('')}
      ${resourceRows.value.map(r => `<tr><td style="padding:3px 8px;color:#b45309;font-weight:700;">${escapeHtml(r.id)}</td><td style="padding:3px 8px;color:#1e293b;">${r.consumed} / ${r.budget} = ${Math.round(r.util * 100)}%</td></tr>`).join('')}
    </table>
    <div style="font-family:ui-monospace,monospace;font-size:11px;color:#475569;margin-top:8px;border-top:1px solid #d1fae5;padding-top:6px;">
      avg V achievement ${Math.round(eff.valueAchievement * 100)}% / avg R utilisation ${Math.round(eff.resourceUtilization * 100)}% → ratio ${eff.ratio.toFixed(2)} → <strong style="color:${gradeColor};">${score} · ${eff.grade}</strong>
    </div>
  </td></tr>
  <tr><td bgcolor="#fef3c7" style="background:#fef3c7;padding:14px 20px;border-left:4px solid #d97706;">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#7c2d12;letter-spacing:1px;">So What? · Actions to Improve</div>
    <ol style="margin:8px 0 0 18px;padding:0;font-size:13px;color:#1e293b;line-height:1.55;">
      ${soWhatActions.value.map(a => `<li style="margin:6px 0;"><strong>${escapeHtml(a.title)}</strong> <span style="font-size:11px;text-transform:uppercase;color:#92400e;font-weight:700;">[${a.priority}]</span><br><span style="color:#475569;">${escapeHtml(a.rationale)}</span></li>`).join('')}
    </ol>
  </td></tr>
  <tr><td bgcolor="#f8fafc" style="background:#f8fafc;padding:12px 20px;border-radius:0 0 12px 12px;font-size:10px;color:#64748b;">
    Sources: [SM] Software Metrics (Gilb 1976/1988) · [CE] Competitive Engineering (Gilb 2005) ·
    [VI] Value Improvement (Gilb) · [Penta] Gilb &amp; Shalloway 2022
  </td></tr>
</table>`
}

function renderInsightPlain(): string {
  const eff = props.pentaModel.efficiency
  // r93kk — match the HTML score format (ratio× notation for |balance| ≥ 1000%)
  const fmtScore = (n: number): string => {
    const r = Math.round(n)
    if (Math.abs(r) >= 1000) {
      const ratio = n / 100 + 1
      const sign  = n > 0 ? '+' : '−'
      return `${sign}${Math.round(Math.abs(ratio))}× ratio`
    }
    if (r > 0) return `+${r}%`
    if (r < 0) return `${r}%`
    return '0%'
  }
  const score = eff.cannotCompute ? 'N/A' : fmtScore(eff.balancePercent)
  return [
    `EFFICIENCY INSIGHT · ${score} · ${eff.grade}`,
    `Plan: ${props.pentaModel.planName ?? '—'}`,
    `Ratio: ${eff.ratio.toFixed(2)} · Value avg ${Math.round(eff.valueAchievement * 100)}% / Resource avg ${Math.round(eff.resourceUtilization * 100)}%`,
    ``,
    `WHAT IS EFFICIENCY?`,
    `The ratio of Value Delivered to Resources Used — central metric of the Penta Model.`,
    `Signed balance percent: 0% = balance, +N% = surplus, -N% = deficit.`,
    `At extreme positive balance (>= 1000%) the score switches to ratio× notation`,
    `(e.g. +417× means Value Delivered is 417× Resources Used).`,
    ``,
    `THE FORMULA — 3 STEPS:`,
    `  Step 1 (conceptual):  Efficiency = Value Delivered / Resources Used`,
    `  Step 2 (measurement): Value Delivered = avg(Status / Goal) across all V. entries`,
    `                       Resources Used  = avg(Status / Budget) across all R. entries`,
    `  Step 3 (signed):     balancePercent = (ratio - 1) × 100, lower-bound clamped at -100, no upper ceiling`,
    ``,
    `GRADE THRESHOLDS:`,
    `  EXCELLENT >= +50%  ·  GOOD 0% to +50%  ·  ACCEPTABLE -40% to 0%  ·  POOR < -40%`,
    ``,
    `COMPUTATION BASIS — YOUR LIVE DATA:`,
    `  Values delivered (avg ${Math.round(eff.valueAchievement * 100)}%):`,
    ...(valueRows.value.length === 0 ? ['    (none yet)'] : valueRows.value.map(r => `    ${r.id}: ${r.status}/${r.goal} = ${Math.round(r.achievement * 100)}%`)),
    `  Resources used (avg ${Math.round(eff.resourceUtilization * 100)}%):`,
    ...(resourceRows.value.length === 0
      ? ['    (no R. entries with Budget yet)']
      : resourceRows.value.map(r => `    ${r.id}: ${r.statusMissing ? `— / ${r.budget} = 0% (Status missing)` : `${r.consumed}/${r.budget} = ${Math.round(r.util * 100)}%`}`)),
    `  → ratio ${eff.ratio.toFixed(2)} → ${score} · ${eff.grade}`,
    ``,
    `SO WHAT? · ACTIONS TO IMPROVE:`,
    ...soWhatActions.value.map((a, i) => `  ${i + 1}. [${a.priority.toUpperCase()}] ${a.title}\n     ${a.rationale}`),
    ``,
    `Sources: [SM] Software Metrics (Gilb 1976/1988) · [CE] Competitive Engineering (Gilb 2005) · [VI] Value Improvement (Gilb) · [Penta] Gilb-Shalloway 2022`,
  ].join('\n')
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// ── Balance-percent formatting (Tom Gilb 2026-06-10 r83 signed semantic) ─────
// 0 = balance, +N% = N% surplus resources, -N% = N% deficit. Always show sign.
function fmtBalance(n: number): string {
  const r = Math.round(n)
  // r92c: switch to ratio× notation when % is too big to read (|balance| ≥ 1000%, ratio ≥ 11×)
  if (Math.abs(r) >= 1000) {
    const ratio = n / 100 + 1
    const sign  = n > 0 ? '+' : '−'
    return `${sign}${Math.round(Math.abs(ratio))}×`
  }
  if (r > 0) return `+${r}%`
  if (r < 0) return `${r}%`
  return '0%'
}

const panelEl = ref<HTMLElement | null>(null)
const _mountedAt = ref(0)
onMounted(() => {
  panelEl.value?.focus()
  _mountedAt.value = Date.now()
})

/** Backdrop click handler — ignores the trailing click of a double-click that opened the panel.
 *  Without this, double-clicking the Penta center hub flashed the panel open and immediately closed it. */
function onBackdropClick(): void {
  if (Date.now() - _mountedAt.value < 350) return
  emit('close')
}

// ── Convenience accessors ────────────────────────────────────────────────────
const efficiency = computed(() => props.pentaModel.efficiency)

// ── Per-row breakdown for the Computation Basis section ──────────────────────
interface ValueRow { id: string; status: number; goal: number; achievement: number }
interface ResourceRow { id: string; consumed: number; budget: number; util: number; statusMissing: boolean }

const valueRows = computed<ValueRow[]>(() =>
  (props.pentaModel.sectors.values?.items ?? [])
    .filter(v => v.status != null && v.goal != null && (v.goal as number) > 0)
    .map(v => ({
      id:          v.id,
      status:      v.status as number,
      goal:        v.goal as number,
      achievement: (v.status as number) / (v.goal as number),
    }))
    .sort((a, b) => a.achievement - b.achievement),
)

// r93jj (Tom Gilb 2026-06-11 "what is this zero, ther is resource"): include R. entries with
// Budget set even when Status (consumed) is null — they ARE Resources and they DO contribute
// to the avg utilisation (treated as consumed=0 per usePenta.ts:224 formula). Previously the
// table hid them entirely, making the popover say "No R. entries with Status and Budget yet"
// while the avg pill simultaneously showed 0% — two contradictory readings of the same state.
const resourceRows = computed<ResourceRow[]>(() =>
  (props.pentaModel.sectors.resources?.items ?? [])
    .filter(r => r.budget != null && (r.budget as number) > 0)
    .map(r => ({
      id:           r.id,
      consumed:     (r.consumed ?? 0) as number,
      budget:       r.budget as number,
      util:         ((r.consumed ?? 0) as number) / (r.budget as number),
      statusMissing: r.consumed == null,
    }))
    .sort((a, b) => b.util - a.util),
)

// ── "So What?" action engine ─────────────────────────────────────────────────
interface SoWhatAction {
  priority:  'critical' | 'protect' | 'high' | 'strategic' | 'maintain'
  icon:      string
  title:     string
  rationale: string
  items?:    { id: string; detail: string }[]
}

const soWhatActions = computed<SoWhatAction[]>(() => {
  const acts: SoWhatAction[] = []
  const eff = efficiency.value

  // ─ Cannot-compute branches first ──────────────────────────────────────────
  if (eff.cannotCompute) {
    const resourceCount = props.pentaModel.sectors.resources?.items?.length ?? 0
    if (resourceCount === 0) {
      acts.push({
        priority:  'critical',
        icon:      '⚠️',
        title:     'Plan your first Resource',
        rationale: 'Without any R. entries, Efficiency is mathematically undefined — there is no denominator. Open the Penta Resources sector and add at least one R. entry with a Budget so the system has something to measure against.',
      })
    } else {
      acts.push({
        priority:  'critical',
        icon:      '📝',
        title:     'Record Status + Budget on at least one Resource',
        rationale: `You have ${resourceCount} Resource${resourceCount !== 1 ? 's' : ''} in the spec but none with both Status (consumed) and Budget set. Edit a Resource entry to populate these — Efficiency reactivates the moment one R. row is complete.`,
      })
    }
    return acts
  }

  // ─ Identify worst-performing Values (delivery gaps) ───────────────────────
  const lowValues = valueRows.value
    .filter(v => v.achievement < 0.7)
    .slice(0, 3)

  // ─ Identify stretched Resources (cost gaps) ───────────────────────────────
  const stretchedResources = resourceRows.value
    .filter(r => r.util > 0.85)
    .slice(0, 3)

  // ─ Protect-this branch for excellent ratios ──────────────────────────────
  if (eff.ratio >= 1.5) {
    acts.push({
      priority:  'protect',
      icon:      '🛡️',
      title:     'Protect this winning efficiency',
      rationale: 'Your Solutions are delivering far more Value than they consume. Document what is working in the spec, look for replicable patterns across V. entries, and resist scope creep that would dilute the ratio.',
    })
  }

  // ─ Low-delivery Values recommendation ────────────────────────────────────
  if (lowValues.length > 0) {
    acts.push({
      priority:  'high',
      icon:      '🎯',
      title:     `Boost delivery of ${lowValues.length} underperforming Value${lowValues.length !== 1 ? 's' : ''}`,
      rationale: `${lowValues[0].id} is at only ${Math.round(lowValues[0].achievement * 100)}% of Goal. Run Solution Sharpening (or open Impact Estimation) on these Values to find Solutions with higher impact-per-cost — that lifts the Value Delivered numerator directly.`,
      items:     lowValues.map(v => ({ id: v.id, detail: `${Math.round(v.achievement * 100)}% of Goal` })),
    })
  }

  // ─ Over-budget Resources recommendation ──────────────────────────────────
  if (stretchedResources.length > 0) {
    acts.push({
      priority:  'high',
      icon:      '💸',
      title:     `Curb spending on ${stretchedResources.length} stretched Resource${stretchedResources.length !== 1 ? 's' : ''}`,
      rationale: `${stretchedResources[0].id} is at ${Math.round(stretchedResources[0].util * 100)}% utilization. Re-prioritize, find lower-cost alternatives, or accept Tolerable instead of Goal on the Values these Resources support — that shrinks the Resources Used denominator.`,
      items:     stretchedResources.map(r => ({ id: r.id, detail: `${Math.round(r.util * 100)}% used` })),
    })
  }

  // ─ Strategic options for poor ratios ─────────────────────────────────────
  if (eff.ratio < 0.6) {
    acts.push({
      priority:  'strategic',
      icon:      '🔄',
      title:     'Rethink the value/cost balance — not just spend more',
      rationale: 'A poor ratio almost never improves by adding Resources. Use the Sharpen tool to find higher-impact Solutions, or descope V. entries that consume disproportionate Resources for marginal stakeholder benefit. Constraints first, then optimize.',
    })
  } else if (eff.ratio < 1.0) {
    acts.push({
      priority:  'strategic',
      icon:      '⚖️',
      title:     'Move from break-even to net-positive',
      rationale: 'You are close to ratio 1.0 (break-even). Run MultiVision or Optima to find the Solution swap that most lifts Value Delivered without proportional Resource increase — small targeted changes shift the ratio fastest at this point.',
    })
  }

  // ─ Maintain branch — show only if nothing else fired ─────────────────────
  if (acts.length === 0) {
    acts.push({
      priority:  'maintain',
      icon:      '✓',
      title:     'Maintain current trajectory',
      rationale: 'Efficiency is in the acceptable band and your Values + Resources are balanced. Keep measuring V. Status against Goal on every delivery cycle; Penta will surface drift the moment it appears.',
    })
  }

  return acts
})

// ── Styling helpers ──────────────────────────────────────────────────────────
const headerGradient = computed(() => {
  if (efficiency.value.cannotCompute) return 'from-slate-600 to-slate-700'
  const g = efficiency.value.grade
  if (g === 'excellent')  return 'from-emerald-600 to-green-700'
  if (g === 'good')       return 'from-blue-600 to-indigo-700'
  if (g === 'acceptable') return 'from-amber-600 to-orange-700'
  return 'from-red-600 to-rose-700'
})

const scoreTextColor = computed(() => {
  const g = efficiency.value.grade
  if (g === 'excellent')  return 'text-emerald-700'
  if (g === 'good')       return 'text-blue-700'
  if (g === 'acceptable') return 'text-amber-700'
  return 'text-red-700'
})

function pctOrDash(v: number): string {
  return Number.isFinite(v) && v >= 0 ? `${Math.round(v * 100)}%` : '—'
}

function achievementColor(a: number): string {
  if (a >= 0.85) return 'text-emerald-700 font-bold'
  if (a >= 0.5)  return 'text-amber-700 font-bold'
  return 'text-red-700 font-bold'
}
function achievementBar(a: number): string {
  if (a >= 0.85) return 'bg-emerald-500'
  if (a >= 0.5)  return 'bg-amber-500'
  return 'bg-red-500'
}
function utilColor(u: number): string {
  if (u <= 0.7) return 'text-emerald-700 font-bold'
  if (u <= 0.9) return 'text-amber-700 font-bold'
  return 'text-red-700 font-bold'
}
function utilBar(u: number): string {
  if (u <= 0.7) return 'bg-emerald-500'
  if (u <= 0.9) return 'bg-amber-500'
  return 'bg-red-500'
}

function actionBadgeColor(priority: SoWhatAction['priority']): string {
  if (priority === 'critical')  return 'bg-red-100 ring-2 ring-red-400'
  if (priority === 'protect')   return 'bg-emerald-100 ring-2 ring-emerald-400'
  if (priority === 'high')      return 'bg-amber-100 ring-2 ring-amber-400'
  if (priority === 'strategic') return 'bg-indigo-100 ring-2 ring-indigo-400'
  return 'bg-slate-100 ring-2 ring-slate-300'
}
function actionPriorityChip(priority: SoWhatAction['priority']): string {
  if (priority === 'critical')  return 'bg-red-100 text-red-800 border border-red-300'
  if (priority === 'protect')   return 'bg-emerald-100 text-emerald-800 border border-emerald-300'
  if (priority === 'high')      return 'bg-amber-100 text-amber-800 border border-amber-300'
  if (priority === 'strategic') return 'bg-indigo-100 text-indigo-800 border border-indigo-300'
  return 'bg-slate-100 text-slate-700 border border-slate-300'
}
</script>
