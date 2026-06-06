<!--
  MultiVisionPanel.vue — Full-screen VDT-grounded planning panel.
  Sliders for Value commitment level and Resource budget; consequences shown live.

  CloseDot rule:    CloseDot on-dark in header (right, ml-auto).
  Backdrop rule:    Backdrop div rendered before the panel card.
  ScrollContainer:  Body content wrapped in ScrollContainer.
  Single-Surface:   registerExclusiveSurface called in App.vue.
  DD-017:           All canonical-color text on white/light backgrounds.
  DD-015:           No English letter abbreviations inside SVG glyphs.
  Spell-out-Type-Names: "Value" / "Resource" spelled out — never V/R as single letters.

  Tom 2026-06-06 redesign (post first-shot review):
    - Vision Balance defined in the app (definition card + breakdown).
    - Value rows now show Scale + Tolerable / Goal / Wish numeric thresholds + ⓘ info.
    - Resource panel shows real $ math, definition, no longer "dead".
    - When no Resource entries: Values column spans full width (no wasted right half).
    - Slider feedback: animated delivery badges + TransitionGroup on funded solutions.

  Spec: F.MultiVision (#MV1) — Design log r04.
-->
<script setup lang="ts">
// UNIT_TYPE=Panel
import { computed, ref } from 'vue'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'
import PlanguageTerm from './PlanguageTerm.vue'
import MultiForksGlyph from './icons/MultiForksGlyph.vue'
import { useMultiVision } from '../composables/useMultiVision'
import { PLANGUAGE_TERMS } from '../composables/usePlanguageTerms'
import { renderMultiVisionHtml, renderMultiVisionPlainText, type MultiVisionExportState } from '../composables/useMultiVisionExport'
import { useSpecModel } from '../composables/useSpecModel'
import { useToast } from '../composables/useToast'

const emit = defineEmits<{
  'close': []
  /** r97 — request parent open the MultiForks fork diagram. */
  'open-multiforks': []
}>()

const {
  vSliders,
  vTolerableSliders,
  vWishSliders,
  vDerivedGoal,
  rSliders,
  aggregateBudget,
  setVSlider,
  setVTolerableSlider,
  setVWishSlider,
  setRSlider,
  setAggregateBudget,
  resetSliders,
  fundedSolutions,
  vDelivery,
  vFeasibility,
  balanceScore,
  balanceBreakdown,
  totalCapitalCost,
  availableCapital,
  insights,
  restatementConsequences,
  snapshot,
  parsePlanguageThreshold,
  values,
  resources,
  solutions,
} = useMultiVision()

// ── Insights styling ─────────────────────────────────────────────────────────
function insightCardClass(severity: 'opportunity' | 'info' | 'warning'): string {
  if (severity === 'opportunity') return 'bg-indigo-50 border-indigo-300 text-indigo-900'
  if (severity === 'warning')     return 'bg-amber-50 border-amber-300 text-amber-900'
  return                                 'bg-slate-50 border-slate-300 text-slate-800'
}

// ── Vision-Balance definition popover state ───────────────────────────────────
const defShown = ref(false)
function toggleDef(): void { defShown.value = !defShown.value }

// ── Per-Value "what is this Value?" info popover ──────────────────────────────
const openInfoId = ref<string | null>(null)
function toggleInfo(id: string): void {
  openInfoId.value = openInfoId.value === id ? null : id
}

// ── Gauge SVG helpers ─────────────────────────────────────────────────────────

/**
 * SVG arc path for a semicircle gauge (180° to 0°, left to right).
 * `fraction` is 0..1 representing how far around the arc we fill.
 */
function arcPath(fraction: number): string {
  const cx = 90
  const cy = 90
  const r = 70
  const f = Math.max(0.001, Math.min(1, fraction))
  const startRad = Math.PI
  const endRad = Math.PI - f * Math.PI
  const x1 = cx + r * Math.cos(startRad)
  const y1 = cy + r * Math.sin(startRad)
  const x2 = cx + r * Math.cos(endRad)
  const y2 = cy + r * Math.sin(endRad)
  const largeArc = f > 0.5 ? 1 : 0
  return `M ${x1},${y1} A ${r},${r} 0 ${largeArc},1 ${x2},${y2}`
}

const gaugeTrackPath = computed(() => arcPath(1))
const gaugeFillPath = computed(() => arcPath(balanceScore.value / 100))
const gaugeColor = computed(() => {
  const s = balanceScore.value
  if (s >= 70) return '#10b981' // emerald-500
  if (s >= 40) return '#f59e0b' // amber-500
  return '#ef4444'              // red-500
})

// ── Delivery badge styling ────────────────────────────────────────────────────

function deliveryBadgeClass(id: string): string {
  const f = vFeasibility.value[id]
  if (f === 'green') return 'bg-emerald-500 text-white'
  if (f === 'amber') return 'bg-amber-500 text-white'
  return 'bg-red-500 text-white'
}

function feasibilityLabel(id: string): string {
  const f = vFeasibility.value[id]
  if (f === 'green') return 'at chosen commitment'
  if (f === 'amber') return 'close (≥ 70% of commitment)'
  return 'below commitment'
}

// ── Which named numeric level the slider currently selects ───────────────────
// Tom Gilb 2026-06-06 DOCTRINAL CORRECTION: there are NO "zones" in Planguage.
// Intel had "landing zones" (±0.5% around a numeric goal) but Planguage has
// unambiguously clear numeric Target / Constraint / Benchmark levels.  The
// slider doesn't lie on a continuum — it picks ONE of three NAMED LEVELS that
// the project commits to MEET (BINARY: met or not, like a speed limit or
// drinking age).  Function renamed `commitmentZone` → `commitmentLevelChoice`;
// the "zone" wording is retired throughout the file.
function commitmentLevelChoice(pos: number): {
  term: typeof PLANGUAGE_TERMS.Tolerable
  termName: 'Tolerable' | 'Goal' | 'Wish'
  classOfTerm: 'Constraint' | 'Target'
  color: string
  caption: string
} {
  if (pos < 33) {
    return {
      term: PLANGUAGE_TERMS.Tolerable,
      termName: 'Tolerable',
      classOfTerm: 'Constraint',
      color: 'text-amber-700',
      caption: 'Committing to MEET the declared Tolerable Constraint numeric level — escaping project failure but no more. MEET is binary against that number.',
    }
  }
  if (pos < 67) {
    return {
      term: PLANGUAGE_TERMS.Goal,
      termName: 'Goal',
      classOfTerm: 'Target',
      color: 'text-emerald-700',
      caption: 'Committing to MEET the declared Goal Target numeric level — the negotiated promise the project will deliver. MEET is binary against that number.',
    }
  }
  return {
    term: PLANGUAGE_TERMS.Wish,
    termName: 'Wish',
    classOfTerm: 'Target',
    color: 'text-violet-700',
    caption: 'Committing to MEET the declared Wish Target numeric level — stakeholder dream level, beyond the negotiated promise. MEET is binary against that number.',
  }
}
// Alias kept for any out-of-file consumer (no current external use; rename safely scoped).
const commitmentZone = commitmentLevelChoice

// ── Outcome-band label for a slider position (Tom Gilb 2026-06-06 directive) ─
// Tom verbatim: "text the colored zones as 'Failed: worse than Constraint',
// 'Tolerable' and from Goal/Wish 'Success ! Better than Target'.  For resources
// use 'Exceeds Budget', 'Under Budget', and 'Tolerable Budget Excess'."
// Polarity: red→amber→green visual gradient on left→right is preserved for
// BOTH kinds.  For Values, increasing position = better outcome (less Failed).
// For Resources, increasing position = better outcome (less Budget excess).
function bandLabel(pos: number, kind: 'value' | 'resource'): {
  name:      string
  color:     string
  semantics: string
} {
  if (kind === 'value') {
    if (pos < 33) {
      return {
        name:      'Failed: worse than Constraint',
        color:     'text-red-700',
        semantics: 'Outcome falls short of the declared Tolerable Constraint numeric level — the project did not even MEET the binary boundary of failure-avoidance.',
      }
    }
    if (pos < 67) {
      return {
        name:      'Tolerable',
        color:     'text-amber-700',
        semantics: 'Outcome MEETs the declared Tolerable Constraint numeric level but falls short of the Goal Target — escaping failure but not delivering the negotiated promise.',
      }
    }
    return {
      name:      'Success! Better than Target',
      color:     'text-emerald-700',
      semantics: 'Outcome MEETs or exceeds the declared Goal Target numeric level — the negotiated promise the project will deliver (or better, reaching toward the Wish Target).',
    }
  }
  // kind === 'resource'
  if (pos < 33) {
    return {
      name:      'Exceeds Budget',
      color:     'text-red-700',
      semantics: 'Resource consumption exceeds the declared Tolerable budget level — project failure on the Resource side; binary breach of the Resource Constraint.',
    }
  }
  if (pos < 67) {
    return {
      name:      'Tolerable Budget Excess',
      color:     'text-amber-700',
      semantics: 'Resource consumption stays within the declared Tolerable budget level but above the Goal budget — within failure-avoidance bounds but not the negotiated economy promise.',
    }
  }
  return {
    name:      'Under Budget',
    color:     'text-emerald-700',
    semantics: 'Resource consumption stays at or below the declared Goal budget level — meeting (or better than) the negotiated economy promise.',
  }
}

// ── Planguage Definitions panel state ─────────────────────────────────────────
const termsShown = ref(false)
function toggleTerms(): void { termsShown.value = !termsShown.value }

// ── Helper: truncate ──────────────────────────────────────────────────────────
function trunc(str: string, len: number): string {
  return str.length > len ? str.slice(0, len - 1) + '…' : str
}

// ── Scale / threshold display per Value entry ─────────────────────────────────
function scaleDisplay(scale: string): string {
  return scale ? trunc(scale, 60) : '(no Scale recorded)'
}

function meterDisplay(meter: string): string {
  return meter ? trunc(meter, 60) : ''
}

function thresholdDisplay(value: string): string {
  const parsed = parsePlanguageThreshold(value)
  if (parsed.num === null) return value ? trunc(value, 18) : '—'
  return parsed.display
}

// ── Layout: when there are no Resource entries, Values column spans full width ─
const hasResources = computed(() => resources.value.length > 0)

// ── Unfunded solutions ────────────────────────────────────────────────────────
const unfundedSolutions = computed(() => {
  const fundedIds = new Set(fundedSolutions.value.map(s => s.id))
  return solutions.value.filter(s => !fundedIds.has(s.id))
})

// ── Budget % display + dollar context ─────────────────────────────────────────
const budgetPct = computed(() => {
  if (resources.value.length > 0) {
    const sum = resources.value.reduce((a, r) => a + (rSliders[r.id] ?? 100), 0)
    return Math.round(sum / resources.value.length)
  }
  return aggregateBudget.value
})

// ── Export handler ────────────────────────────────────────────────────────────
// Tom Gilb 2026-06-06: "we cannot see more than 27% o the model in this window
// at on time" — the panel scrolls but the user cannot eyeball the WHOLE model
// at once.  Export produces a single colourful HTML document containing the
// entire MultiVision state: header + Vision Balance + every Value + every
// Resource + funded/unfunded Solutions + every Insight + canonical Planguage
// Glossary footnote.  Wired per the SEM Email Body Standard (clipboard HTML +
// mailto with LOUD ⌘V cue + plain inline fallback).
const { currentModel: specModel } = useSpecModel()
const { showToast } = useToast()

function _buildExportState(): MultiVisionExportState {
  return {
    planName:     specModel.value?.name ?? 'Plan',
    versionLabel: specModel.value?.version ? `v${specModel.value.version}` : '',
    values:           values.value,
    resources:        resources.value,
    solutions:        solutions.value,
    vSliders:         { ...vSliders },
    rSliders:         { ...rSliders },
    aggregateBudget:  aggregateBudget.value,
    vDelivery:        { ...vDelivery.value },
    vFeasibility:     { ...vFeasibility.value },
    fundedSolutions:  fundedSolutions.value,
    balanceScore:     balanceScore.value,
    balanceBreakdown: balanceBreakdown.value,
    totalCapitalCost: totalCapitalCost.value,
    availableCapital: availableCapital.value,
    insights:         insights.value.map(i => ({ id: i.id, icon: i.icon, message: i.message, severity: i.severity })),
    vcRatios:         { ...snapshot.value.vcRatios },
    capitalCosts:     { ...snapshot.value.capitalCosts },
  }
}

async function exportMultiVision(): Promise<void> {
  try {
    const state = _buildExportState()
    const htmlText  = renderMultiVisionHtml(state)
    const plainText = renderMultiVisionPlainText(state)

    // SEM Email Body Standard — LOUD paste cue at top of plain inline body
    const isoDate = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
    const separator = '─'.repeat(56)
    const mailBody = [
      'PASTE ⌘V (CMD+V) HERE FOR COLOR VERSION',
      `Exported: ${isoDate}`,
      separator,
      '',
      plainText,
    ].join('\n')

    // 1. Put HTML + plain on the clipboard (dual-MIME ClipboardItem).
    let clipboardOK = false
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html':  new Blob([htmlText],  { type: 'text/html'  }),
            'text/plain': new Blob([plainText], { type: 'text/plain' }),
          }),
        ])
        clipboardOK = true
      } catch (err) {
        console.warn('[MultiVision export] clipboard.write failed — falling back to writeText', err)
      }
    }
    if (!clipboardOK) {
      try {
        await navigator.clipboard.writeText(plainText)
        clipboardOK = true
      } catch (err) {
        console.warn('[MultiVision export] clipboard.writeText also failed', err)
      }
    }

    // 2. Open Mail with subject + plain body (per SEM Email Body Standard).
    const subject = `MultiVision · ${specModel.value?.name ?? 'Plan'} · ${isoDate}`
    // Truncate the mailto body if needed (≤ 7000 chars after encode).
    let bodyForMailto = mailBody
    const MAX_BODY = 7000
    while (encodeURIComponent(bodyForMailto).length > MAX_BODY && bodyForMailto.length > 200) {
      bodyForMailto = bodyForMailto.slice(0, Math.max(200, bodyForMailto.length - 500)) +
        '\n\n…[plain-text truncated to fit mailto: limit — press ⌘V above for the full colour version]'
    }
    const mailto = `mailto:Tom@Gilb.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyForMailto)}`

    // 3. Open a separate window with the full HTML so Tom can see 100% of the
    //    model immediately (his original complaint — "27% of the model").
    try {
      const w = window.open('', '_blank', 'width=1100,height=820,scrollbars=yes')
      if (w) {
        w.document.open()
        w.document.write(htmlText)
        w.document.close()
      }
    } catch (err) {
      console.warn('[MultiVision export] could not open preview window', err)
    }

    // 4. Trigger mailto.
    try {
      window.location.href = mailto
    } catch (err) {
      console.warn('[MultiVision export] mailto: open failed', err)
    }

    // 5. Toast.
    const msg = clipboardOK
      ? '⬇ MultiVision exported · preview window open · Mail opening · press ⌘V in the body for the colour version'
      : '⬇ MultiVision preview window open · Mail opening · clipboard copy failed (use the preview window)'
    showToast(msg, 6500)
  } catch (err) {
    console.error('[MultiVision export] unexpected failure', err)
    showToast(`Export failed: ${String(err).slice(0, 90)}`, 5000)
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="mv-fade">
      <div
        class="fixed inset-0 z-[600] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-label="MultiVision — Balance Values and Resources"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black/50 backdrop-blur-sm"
          aria-hidden="true"
          @click="emit('close')"
        />

        <!-- Panel card -->
        <div
          class="relative z-[601] w-full max-w-4xl rounded-2xl shadow-2xl
                 bg-white flex flex-col overflow-hidden
                 max-h-[92vh]"
          @click.stop
        >
          <!-- ── Gradient header ──────────────────────────────────────────── -->
          <div
            class="shrink-0 px-5 pt-4 pb-3 flex items-center gap-3"
            style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)"
          >
            <div class="flex-1 min-w-0">
              <div class="text-lg font-bold text-white leading-tight">
                ⚡ MultiVision
              </div>
              <div class="text-xs text-white/75 mt-0.5">
                Balance Values &amp; Resources · see consequences
              </div>
            </div>

            <div class="ml-auto shrink-0">
              <CloseDot
                variant="on-dark"
                size="lg"
                ariaLabel="Close MultiVision panel"
                @click="emit('close')"
              />
            </div>
          </div>

          <!-- Color swatch divider strip -->
          <div
            class="shrink-0 h-[10px] w-full"
            style="background: linear-gradient(90deg, #4f46e5 0%, #7c3aed 100%)"
            aria-hidden="true"
          />

          <!-- ── Scrollable body ──────────────────────────────────────────── -->
          <ScrollContainer
            outer-class="relative overflow-hidden"
            inner-class="px-5 py-5 space-y-6"
            inner-style="max-height: calc(92vh - 110px);"
            :no-pill="false"
          >

            <!-- ── Vision Balance card (gauge + definition + breakdown) ── -->
            <div class="rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-4">
              <div class="flex flex-col sm:flex-row items-center gap-4">
                <!-- Gauge SVG -->
                <div class="shrink-0 flex flex-col items-center">
                  <svg
                    viewBox="0 0 180 100"
                    width="180"
                    height="100"
                    fill="none"
                    aria-label="Vision balance gauge"
                    role="img"
                  >
                    <path
                      :d="gaugeTrackPath"
                      stroke="#e5e7eb"
                      stroke-width="14"
                      stroke-linecap="round"
                      fill="none"
                    />
                    <path
                      :d="gaugeFillPath"
                      :stroke="gaugeColor"
                      stroke-width="14"
                      stroke-linecap="round"
                      fill="none"
                      style="transition: all 300ms ease;"
                    />
                    <text
                      x="90"
                      y="80"
                      text-anchor="middle"
                      :fill="gaugeColor"
                      font-size="26"
                      font-weight="800"
                      font-family="sans-serif"
                      style="transition: fill 300ms ease;"
                    >{{ balanceScore }}%</text>
                  </svg>
                  <div class="text-[11px] font-bold text-gray-700 uppercase tracking-[0.18em] -mt-1 flex items-center gap-1">
                    Vision Balance
                    <button
                      type="button"
                      class="text-indigo-600 hover:text-indigo-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded-full"
                      :title="defShown ? 'Hide definition' : 'What is Vision Balance? · click for definition'"
                      :aria-expanded="defShown"
                      aria-controls="vb-definition"
                      @click="toggleDef()"
                    >
                      <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>

                <!-- Definition + breakdown -->
                <div class="flex-1 min-w-0 space-y-2">
                  <p class="text-sm text-gray-800 font-semibold">
                    The share of your Value entries that MEET the
                    <PlanguageTerm term="Constraint" class="text-amber-700" /> or
                    <PlanguageTerm term="Target" class="text-emerald-700" />
                    you committed to at the current Resource budget.
                  </p>
                  <p class="text-[11px] text-gray-600">
                    e.g. <strong>{{ balanceScore }}%</strong> means
                    <strong>{{ balanceBreakdown.green }} of {{ balanceBreakdown.total }}</strong>
                    Value entries are at the level you chose to commit to.
                  </p>
                  <p class="text-[10px] text-slate-500 italic">
                    Why "commitment" not "ambition"?
                    <PlanguageTerm term="Ambition" class="text-slate-600" />
                    is a vague summary — you cannot MEET it. You can only meet a
                    <PlanguageTerm term="Constraint" class="text-amber-700" /> or
                    <PlanguageTerm term="Target" class="text-emerald-700" />. (Glossary CE Planguage.)
                  </p>
                  <!-- Breakdown chips -->
                  <div class="flex flex-wrap gap-2 items-center text-xs">
                    <span class="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-white border border-emerald-300 text-emerald-800">
                      <span class="block w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span class="font-bold">{{ balanceBreakdown.green }}</span>
                      <span>at commitment</span>
                    </span>
                    <span class="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-white border border-amber-300 text-amber-800">
                      <span class="block w-2.5 h-2.5 rounded-full bg-amber-500" />
                      <span class="font-bold">{{ balanceBreakdown.amber }}</span>
                      <span>close to commitment</span>
                    </span>
                    <span class="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-white border border-red-300 text-red-800">
                      <span class="block w-2.5 h-2.5 rounded-full bg-red-500" />
                      <span class="font-bold">{{ balanceBreakdown.red }}</span>
                      <span>below commitment</span>
                    </span>
                    <span class="text-gray-500">of {{ balanceBreakdown.total }} Value entries</span>
                  </div>
                  <!-- Expanded definition (click ⓘ to show) -->
                  <div
                    v-if="defShown"
                    id="vb-definition"
                    class="rounded-lg bg-white border border-indigo-200 px-3 py-2 text-[12px] text-gray-700 space-y-1"
                  >
                    <p><strong>Formula:</strong> count(Value entries that MEET their chosen commitment level) ÷ count(all Values) × 100.</p>
                    <p><strong>Per-Value commitment level</strong> is set by your Value slider, which picks WHICH of the declared numeric levels from the spec the project commits to MEET: the <span class="text-amber-700 font-semibold"><PlanguageTerm term="Tolerable" class="text-amber-700" /> <PlanguageTerm term="Constraint" class="text-amber-700" /> level</span> (escape project failure), the <span class="text-emerald-700 font-semibold"><PlanguageTerm term="Goal" class="text-emerald-700" /> <PlanguageTerm term="Target" class="text-emerald-700" /> level</span> (committed promise), or the <span class="text-violet-700 font-semibold"><PlanguageTerm term="Wish" class="text-violet-700" /> <PlanguageTerm term="Target" class="text-violet-700" /> level</span> (stakeholder dream). MEET is BINARY against that chosen numeric level — Tom Gilb 2026-06-06: "speed limit 90, caught at 91 = exceeded; age 18 for alcohol, 17+11mo+28d = cannot legally buy." Planguage has no normalised 0/50/100 commitment scale.</p>
                    <p class="text-[11px] italic text-slate-600">Note: <PlanguageTerm term="Ambition" class="text-slate-600" /> is a vague summary, not a precise level — you cannot MEET it. The slider chooses a Constraint or Target (both precise) to commit to.</p>
                    <p><strong>Per-Value delivery</strong> is the average <strong>Percentage Impact `%.→`</strong> (Glossary *306) across all funded Solutions on that Value — 0 % = at Past/benchmark, 100 % = target reached (Goal or Wish). This is the IET relative scale: it lets us add and compare Values with different native units. Like Celsius / Fahrenheit, the IET scale is convertible to native units (CE book IET chapter).</p>
                    <p><strong>Color bands:</strong> ≥ 70 % balance = <span class="text-emerald-700 font-semibold">green</span>, 40–70 % = <span class="text-amber-700 font-semibold">amber</span>, &lt; 40 % = <span class="text-red-700 font-semibold">red</span>.</p>
                  </div>

                  <!-- Planguage Definitions toggle — Tom 2026-06-06: "apply these
                       glossary definition understanding in all tools, especially
                       Multivision". Always one click away. -->
                  <button
                    type="button"
                    class="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 hover:text-indigo-900 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded"
                    :aria-expanded="termsShown"
                    aria-controls="vb-planguage-terms"
                    :title="termsShown ? 'Hide canonical Planguage definitions' : 'Show canonical Planguage definitions for Tolerable, Goal, Wish (from the Glossary)'"
                    @click="toggleTerms()"
                  >
                    <span aria-hidden="true">{{ termsShown ? '▾' : '▸' }}</span>
                    ⚖ Reasonable Balance (CE 2005) · Planguage definitions · Tolerable {{ PLANGUAGE_TERMS.Tolerable.keyedIcon }} ·
                    Goal {{ PLANGUAGE_TERMS.Goal.keyedIcon }} ·
                    Wish {{ PLANGUAGE_TERMS.Wish.keyedIcon }} ·
                    IET {{ PLANGUAGE_TERMS.PercentageImpact.keyedIcon }}
                  </button>
                  <div
                    v-if="termsShown"
                    id="vb-planguage-terms"
                    class="space-y-2"
                  >
                    <!-- Principle of Reasonable Balance — the canonical anchor.
                         Tom Gilb, Competitive Engineering 2005 verbatim.  The
                         WHOLE POINT of MultiVision is to operationalise this
                         principle.  Paired with Brooks's harmony principle so
                         the user sees both the method (Planguage IET) and the
                         principle (architectural harmony) the tool descends from.
                         Tom Gilb 2026-06-06 verbatim teaching: "Brooks gives
                         you the principle. Planguage and the Impact Estimation
                         Table give you the method". -->
                    <div class="rounded-lg border-2 border-amber-300 bg-gradient-to-br from-amber-50 via-white to-orange-50 px-3 py-2.5 space-y-2">
                      <div class="flex items-baseline gap-1.5">
                        <span class="text-base" aria-hidden="true">⚖</span>
                        <span class="text-[11px] font-extrabold text-amber-900 uppercase">Principle of Reasonable Balance</span>
                        <span class="ml-auto text-[9px] text-amber-700 italic">CE 2005</span>
                      </div>
                      <blockquote class="text-[11px] text-amber-950 leading-snug border-l-4 border-amber-400 pl-2 italic">
                        "Reach for dreams, but don't let one of them destroy all the others. You cannot require an arbitrary set of requirements. There must be balance between performance requirement levels, resources available and available design technology."
                        <footer class="not-italic text-[10px] text-amber-700 font-semibold mt-0.5">— Tom Gilb, <i>Competitive Engineering</i> (2005)</footer>
                      </blockquote>
                      <div class="rounded bg-white/70 border border-amber-200 px-2.5 py-1.5 text-[10px] text-gray-800 leading-snug space-y-1">
                        <p><b>This IS what MultiVision does.</b>  Every slider move tests the principle.  When you raise a Value's required level you SEE the consequence — solutions that no longer reach it, the cost impact of the restatement, the funded set that has to be rebalanced.</p>
                        <p class="text-gray-600">
                          The companion principle from <b>Fred Brooks Jr.</b> (<i>The Design of Design</i>, 2010): an architect's job is not to maximise one thing but to <b>hold the system in equilibrium</b> — no single objective destroys the others.  Brooks gives the principle.  Planguage and the Impact Estimation Table give the <b>method</b> — concrete scoring of options against multiple values, defensible tradeoffs.
                        </p>
                      </div>
                    </div>

                    <!-- IET / Percentage Impact card — Tom 2026-06-06: this is the
                         scale every IET / VDT / MultiVision computation runs on. -->
                    <div class="rounded-lg border border-indigo-200 bg-indigo-50/70 px-3 py-2 space-y-1">
                      <div class="flex items-baseline gap-1.5">
                        <span class="text-[11px] font-extrabold text-indigo-800 uppercase">Percentage Impact</span>
                        <span class="font-mono text-[10px] text-indigo-700">{{ PLANGUAGE_TERMS.PercentageImpact.keyedIcon }}</span>
                        <span class="ml-auto text-[9px] text-indigo-700 italic">{{ PLANGUAGE_TERMS.PercentageImpact.conceptNumber }}</span>
                      </div>
                      <div class="text-[10px] font-semibold text-indigo-900">{{ PLANGUAGE_TERMS.PercentageImpact.role }}</div>
                      <p
                        v-for="(line, i) in PLANGUAGE_TERMS.PercentageImpact.longDef"
                        :key="i"
                        class="text-[11px] text-gray-700 leading-snug"
                      >{{ line }}</p>
                    </div>
                    <!-- Tolerable / Goal / Wish 3-column grid -->
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <!-- Tolerable card -->
                    <div class="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 space-y-1">
                      <div class="flex items-baseline gap-1.5">
                        <span class="text-[11px] font-extrabold text-amber-800 uppercase">Tolerable</span>
                        <span class="font-mono text-[10px] text-amber-700">{{ PLANGUAGE_TERMS.Tolerable.keyedIcon }}</span>
                        <span class="ml-auto text-[9px] text-amber-700 italic">{{ PLANGUAGE_TERMS.Tolerable.conceptNumber }}</span>
                      </div>
                      <div class="text-[10px] font-semibold text-amber-900">{{ PLANGUAGE_TERMS.Tolerable.role }}</div>
                      <p
                        v-for="(line, i) in PLANGUAGE_TERMS.Tolerable.longDef"
                        :key="i"
                        class="text-[11px] text-gray-700 leading-snug"
                      >{{ line }}</p>
                    </div>
                    <!-- Goal card -->
                    <div class="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 space-y-1">
                      <div class="flex items-baseline gap-1.5">
                        <span class="text-[11px] font-extrabold text-emerald-800 uppercase">Goal</span>
                        <span class="font-mono text-[10px] text-emerald-700">{{ PLANGUAGE_TERMS.Goal.keyedIcon }}</span>
                        <span class="ml-auto text-[9px] text-emerald-700 italic">{{ PLANGUAGE_TERMS.Goal.conceptNumber }}</span>
                      </div>
                      <div class="text-[10px] font-semibold text-emerald-900">{{ PLANGUAGE_TERMS.Goal.role }}</div>
                      <p
                        v-for="(line, i) in PLANGUAGE_TERMS.Goal.longDef"
                        :key="i"
                        class="text-[11px] text-gray-700 leading-snug"
                      >{{ line }}</p>
                    </div>
                    <!-- Wish card -->
                    <div class="rounded-lg border border-violet-200 bg-violet-50/70 px-3 py-2 space-y-1">
                      <div class="flex items-baseline gap-1.5">
                        <span class="text-[11px] font-extrabold text-violet-800 uppercase">Wish</span>
                        <span class="font-mono text-[10px] text-violet-700">{{ PLANGUAGE_TERMS.Wish.keyedIcon }}</span>
                        <span class="ml-auto text-[9px] text-violet-700 italic">{{ PLANGUAGE_TERMS.Wish.conceptNumber }}</span>
                      </div>
                      <div class="text-[10px] font-semibold text-violet-900">{{ PLANGUAGE_TERMS.Wish.role }}</div>
                      <p
                        v-for="(line, i) in PLANGUAGE_TERMS.Wish.longDef"
                        :key="i"
                        class="text-[11px] text-gray-700 leading-snug"
                      >{{ line }}</p>
                    </div>
                    </div><!-- end 3-col grid -->
                  </div>
                </div>
              </div>
            </div>

            <!-- ── Values + Resources grid ──────────────────────────────── -->
            <div
              class="grid gap-5"
              :class="hasResources ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'"
            >
              <!-- ── Values · Commitment column ───────────────────────────
                   Tom 2026-06-06: "Ambition" was the wrong word — Ambition is
                   a vague informal summary, cannot be MET. The slider chooses
                   a Constraint (Tolerable) or Target (Goal / Wish) to commit
                   to MEET. -->
              <div class="bg-violet-50 rounded-xl border border-violet-200 p-4 space-y-4">
                <div class="flex items-center gap-2 flex-wrap">
                  <span
                    class="text-[11px] font-bold px-2.5 py-0.5 rounded-full
                           bg-indigo-600 text-white uppercase tracking-wide"
                  >
                    Values · Commitment Level
                  </span>
                  <span class="text-[11px] text-violet-600">{{ values.length }} entries</span>
                  <!-- Tom Gilb 2026-06-06 doctrinal correction: the prior caption
                       "0 = MEET Tolerable · 50 = MEET Goal · 100 = MEET Wish"
                       was a hallucination — Planguage has no normalised 0/50/100
                       commitment scale.  A commitment is to a NUMERIC level
                       declared in the spec (e.g. 80%, 95%, …).  The slider lets
                       the project pick WHICH declared numeric level it commits to:
                       the Tolerable Constraint level, the Goal Target level, or
                       the Wish Target level.  "MEET" is binary against that
                       chosen numeric level (Tom's speed-limit-90 analogy). -->
                  <span class="ml-auto text-[10px] text-gray-600 italic">
                    Pick which declared numeric level this Value commits to MEET:
                    <PlanguageTerm term="Tolerable" class="text-amber-700" :show-icon="false" /> Constraint ·
                    <PlanguageTerm term="Goal" class="text-emerald-700" :show-icon="false" /> Target ·
                    <PlanguageTerm term="Wish" class="text-violet-700" :show-icon="false" /> Target.
                  </span>
                </div>

                <!-- Empty state -->
                <div
                  v-if="values.length === 0"
                  class="text-xs text-gray-500 italic py-2"
                >
                  No Value entries in the current spec. Open the Spec Editor to add Values.
                </div>

                <!-- Per-Value slider card
                     Tom 2026-06-06 (r06): "reconsile language you say 2x 50% then
                     right above it is a 95% VERY UNCLEAR WHAT I WHAT".  Root cause:
                     three different numbers were rendered as "%": (a) computed
                     Delivery on the conceptual 0–100 ambition scale, (b) Spec
                     Tolerable/Goal/Wish thresholds in the Value's measured Planguage
                     unit (which often is also %), (c) ambition slider position
                     0–100 shown as "(50/100)" — also looked like a %.  Three
                     numbers wearing the same "%" sign meaning three orthogonal
                     things.  Fix: (1) Delivery shown as "X / 100" (no %), labelled
                     ACHIEVES, in a coloured chip; (2) Spec thresholds gathered into
                     their own bordered slate-grey card with a header "SPEC TARGETS ·
                     in Planguage units" so it's clearly a different scale; (3) the
                     redundant "(50/100)" parenthetical removed — slider thumb IS
                     the visual ambition indicator. -->
                <div
                  v-for="v in values"
                  :key="v.id"
                  class="rounded-lg bg-white border border-violet-200 p-3 space-y-2 shadow-sm"
                >
                  <!-- Row 1: ID + description + Achievement chip -->
                  <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-1.5">
                        <span class="text-[10px] font-bold text-violet-700 uppercase tracking-wide shrink-0">
                          {{ v.id }}
                        </span>
                        <button
                          type="button"
                          class="text-indigo-500 hover:text-indigo-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded-full shrink-0"
                          :title="`Show full Planguage detail for ${v.id}`"
                          :aria-expanded="openInfoId === v.id"
                          @click="toggleInfo(v.id)"
                        >
                          <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                          </svg>
                        </button>
                      </div>
                      <div class="text-[12px] font-semibold text-gray-800 leading-tight mt-0.5">
                        {{ trunc(v.description, 80) }}
                      </div>
                      <div class="text-[10px] text-gray-500 mt-0.5 leading-snug">
                        <span class="font-bold">Scale:</span> {{ scaleDisplay(v.scale) }}
                      </div>
                    </div>
                    <!-- IET % Target Achievement chip (Percentage Impact *306).
                         Tom 2026-06-06: this IS the canonical IET relative scale —
                         0% = at Past/benchmark, 100% = target reached (Goal or
                         Wish). Per Glossary, written as a plain percentage.
                         The Spec Targets row clearly labels itself "native Scale
                         unit (NOT IET)" so the two %s can no longer collide. -->
                    <div class="shrink-0 flex flex-col items-end gap-0.5 min-w-[110px]">
                      <span
                        class="text-[9px] text-indigo-700 uppercase tracking-wide font-bold cursor-help"
                        :title="PLANGUAGE_TERMS.PercentageImpact.tooltipFull"
                      >
                        IET % Achieved
                      </span>
                      <span
                        class="text-[13px] font-extrabold rounded-lg px-2.5 py-1 transition-all duration-300"
                        :class="deliveryBadgeClass(v.id)"
                        :title="`Percentage Impact *306 — IET % Target Achievement: ${(vDelivery[v.id] ?? 0).toFixed(0)}%. 0% = at Past/benchmark; 100% = target reached (Goal or Wish). Funded Solutions move ${v.id} ${(vDelivery[v.id] ?? 0).toFixed(0)}% of the way from baseline to target. Your chosen commitment level is ${vSliders[v.id] ?? 50}% on the same scale. Status: ${feasibilityLabel(v.id)}.`"
                      >
                        {{ (vDelivery[v.id] ?? 0).toFixed(0) }}%
                      </span>
                      <span class="text-[9px] text-gray-500 italic">
                        {{ feasibilityLabel(v.id) }}
                      </span>
                    </div>
                  </div>

                  <!-- Expanded Planguage detail (click ⓘ) -->
                  <div
                    v-if="openInfoId === v.id"
                    class="rounded-md bg-violet-50 border border-violet-200 px-3 py-2 text-[11px] text-gray-700 space-y-1"
                  >
                    <p v-if="v.description" class="text-gray-800"><strong>Description:</strong> {{ v.description }}</p>
                    <p><strong>Scale:</strong> {{ v.scale || '(none)' }}</p>
                    <p v-if="v.meter"><strong>Meter:</strong> {{ meterDisplay(v.meter) }}</p>
                    <p><strong>Tolerable:</strong> {{ v.tolerable || '(none)' }}</p>
                    <p><strong>Goal:</strong> {{ v.goal || '(none)' }}</p>
                    <p v-if="v.wish"><strong>Wish:</strong> {{ v.wish }}</p>
                    <p v-if="v.status" class="text-gray-600"><strong>Status:</strong> {{ v.status }}</p>
                  </div>

                  <!-- SPEC TARGETS row — Tolerable / Goal / Wish numeric thresholds.
                       Now carries the canonical Planguage keyed icons (>> / > / >?)
                       and hover-tooltips with the Glossary definitions, so the user
                       sees the commitment semantics, not just colour-coded zones. -->
                  <div class="rounded-md bg-slate-50 border border-slate-200 px-2.5 py-1.5">
                    <div class="flex items-center text-[8px] font-bold uppercase tracking-wide mb-0.5">
                      <span class="flex-1 text-slate-600">Spec Targets · Planguage levels</span>
                      <span
                        class="text-slate-500 italic normal-case font-normal cursor-help"
                        title="Spec Targets are in this Value's NATIVE Scale unit (% of students, ms, defects, etc.) — NOT on the IET % Target Achievement scale. The IET conversion is: native_value = Past + (IET% / 100) × (Target − Past). See Glossary *306 Percentage Impact."
                      >native Scale unit · not IET</span>
                    </div>
                    <div class="flex items-baseline gap-1">
                      <div class="flex-1 text-left">
                        <span
                          class="text-[8px] font-bold text-amber-700 uppercase block cursor-help"
                          :title="PLANGUAGE_TERMS.Tolerable.tooltipFull"
                        >Tolerable <span class="font-mono opacity-70">{{ PLANGUAGE_TERMS.Tolerable.keyedIcon }}</span></span>
                        <span class="text-[12px] font-bold text-gray-800">{{ thresholdDisplay(v.tolerable) }}</span>
                      </div>
                      <div class="flex-1 text-center">
                        <span
                          class="text-[8px] font-bold text-emerald-700 uppercase block cursor-help"
                          :title="PLANGUAGE_TERMS.Goal.tooltipFull"
                        >Goal <span class="font-mono opacity-70">{{ PLANGUAGE_TERMS.Goal.keyedIcon }}</span></span>
                        <span class="text-[12px] font-bold text-gray-800">{{ thresholdDisplay(v.goal) }}</span>
                      </div>
                      <div class="flex-1 text-right">
                        <span
                          class="text-[8px] font-bold text-violet-700 uppercase block cursor-help"
                          :title="PLANGUAGE_TERMS.Wish.tooltipFull"
                        >Wish <span class="font-mono opacity-70">{{ PLANGUAGE_TERMS.Wish.keyedIcon }}</span></span>
                        <span class="text-[12px] font-bold text-gray-800">{{ thresholdDisplay(v.wish || '') }}</span>
                      </div>
                    </div>
                  </div>

                  <!-- TWO-THUMB requirement setting (Tom Gilb 2026-06-06 doctrinal
                       correction): "One for the scalar constraint (Tolerable by
                       default), and one for the success level (Wish, or Goal when
                       committed by the design and resources etc., we can actually
                       only set the Wish)". One slider sets the Tolerable
                       Constraint (failure-avoidance line); a second slider sets
                       the Wish Target (stakeholder dream). The Goal EMERGES from
                       OPTIMA balancing — shown as a derived position between the
                       two, not as a third slider. The user cannot set Goal
                       directly; it commits only when the 7 Glossary conditions
                       hold. -->
                  <div class="pt-1 space-y-3">

                    <!-- ── Tolerable Constraint slider ─────────────────────────── -->
                    <div>
                      <div class="text-[8px] font-bold uppercase tracking-wide text-amber-800 mb-1 flex items-center gap-1">
                        Tolerable
                        <span class="font-mono opacity-70">&gt;&gt;</span>
                        · Scalar Constraint · drag to set the failure-avoidance line
                      </div>
                      <!-- Floating label tracking thumb -->
                      <div class="relative h-4 mb-0.5 pointer-events-none">
                        <div
                          class="absolute -translate-x-1/2 px-1.5 py-0.5 rounded bg-amber-700 text-white text-[8px] font-bold uppercase tracking-wide whitespace-nowrap shadow-sm transition-[left] duration-75 flex items-center gap-1"
                          :style="{ left: `${vTolerableSliders[v.id] ?? 25}%` }"
                        >
                          <span>Tolerable Constraint Setting</span>
                          <span class="font-mono bg-white/20 rounded px-1">{{ vTolerableSliders[v.id] ?? 25 }}</span>
                        </div>
                        <div
                          class="absolute -translate-x-1/2 text-amber-700 text-[8px] leading-none pointer-events-none"
                          :style="{ left: `${vTolerableSliders[v.id] ?? 25}%`, top: '14px' }"
                          aria-hidden="true"
                        >▼</div>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        :value="vTolerableSliders[v.id] ?? 25"
                        class="v-slider w-full"
                        :title="`Tolerable Constraint for ${v.id} — failure-avoidance line. Below this number the WHOLE PROJECT fails (Glossary *539). Tom: 'we can actually only set the Wish' → here you also set the Constraint.`"
                        :aria-label="`Tolerable Constraint setting for ${v.description}`"
                        style="background: linear-gradient(to right, #ef4444 0%, #ef4444 50%, #fbbf24 50%, #fbbf24 100%)"
                        @input="setVTolerableSlider(v.id, +($event.target as HTMLInputElement).value)"
                      />
                    </div>

                    <!-- ── Wish Target slider ──────────────────────────────────── -->
                    <div>
                      <div class="text-[8px] font-bold uppercase tracking-wide text-violet-800 mb-1 flex items-center gap-1">
                        Wish
                        <span class="font-mono opacity-70">&gt;?</span>
                        · Stakeholder Target · drag to set the dream level
                      </div>
                      <div class="relative h-4 mb-0.5 pointer-events-none">
                        <div
                          class="absolute -translate-x-1/2 px-1.5 py-0.5 rounded bg-violet-700 text-white text-[8px] font-bold uppercase tracking-wide whitespace-nowrap shadow-sm transition-[left] duration-75 flex items-center gap-1"
                          :style="{ left: `${vWishSliders[v.id] ?? 75}%` }"
                        >
                          <span>Wish Target Setting</span>
                          <span class="font-mono bg-white/20 rounded px-1">{{ vWishSliders[v.id] ?? 75 }}</span>
                        </div>
                        <div
                          class="absolute -translate-x-1/2 text-violet-700 text-[8px] leading-none pointer-events-none"
                          :style="{ left: `${vWishSliders[v.id] ?? 75}%`, top: '14px' }"
                          aria-hidden="true"
                        >▼</div>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        :value="vWishSliders[v.id] ?? 75"
                        class="v-slider w-full"
                        :title="`Wish Target for ${v.id} — stakeholder dream level (Glossary *244). Per Tom: this is what stakeholders articulated; the project does NOT commit to it. Goal emerges from OPTIMA balancing.`"
                        :aria-label="`Wish Target setting for ${v.description}`"
                        style="background: linear-gradient(to right, #fbbf24 0%, #fbbf24 50%, #a78bfa 50%, #a78bfa 100%)"
                        @input="setVWishSlider(v.id, +($event.target as HTMLInputElement).value)"
                      />
                    </div>

                    <!-- ── Derived Goal indicator (Tom: "Goal when committed by
                         the design and resources etc.") — NOT a slider, computed
                         from OPTIMA balancing between Tolerable + Wish.  Shown
                         as a chip so the user understands Goal EMERGES, it is
                         not set directly. -->
                    <div class="rounded-md bg-emerald-50 border border-emerald-300 px-2.5 py-1.5 text-[10px] leading-snug space-y-0.5">
                      <div class="flex items-center gap-1.5">
                        <span class="font-bold uppercase tracking-wide text-[9px] text-emerald-800">
                          Goal <span class="font-mono opacity-70">&gt;</span> · derived
                        </span>
                        <span class="ml-auto inline-block px-1.5 py-0.5 rounded bg-emerald-700 text-white text-[9px] font-mono font-bold">
                          {{ vDerivedGoal[v.id] ?? 50 }} / 100
                        </span>
                      </div>
                      <p class="text-emerald-900">
                        EMERGES from OPTIMA balancing of Tolerable + Wish + Resource Budget.  The user does NOT set Goal directly — it commits only when the 7 Glossary validity conditions hold (technically + economically possible, cost-consistent, effective, profitable, prioritised, qualifying conditions true).
                      </p>
                    </div>

                    <!-- Restatement consequences (read from the legacy single-thumb
                         vSliders alias = vWishSliders — still meaningful when the
                         user moves the Wish away from default) -->
                    <div
                      v-if="restatementConsequences[v.id] && Math.abs(restatementConsequences[v.id].deltaFromDefault) >= 5"
                      class="mt-2 rounded-md border px-2.5 py-1.5 text-[10px] leading-snug space-y-1"
                      :class="restatementConsequences[v.id].deltaFromDefault > 0
                        ? 'bg-amber-50 border-amber-300 text-amber-900'
                        : 'bg-emerald-50 border-emerald-300 text-emerald-900'"
                    >
                      <div class="font-bold uppercase tracking-wide text-[9px] flex items-center gap-1">
                        <span aria-hidden="true">↻</span> Restatement consequence
                      </div>
                      <p>{{ restatementConsequences[v.id].hint }}</p>
                      <div v-if="restatementConsequences[v.id].solutionsToReconsider.length > 0"
                           class="flex flex-wrap gap-1 pt-0.5">
                        <span class="text-[9px] font-semibold opacity-75">Solutions to reconsider:</span>
                        <span v-for="solId in restatementConsequences[v.id].solutionsToReconsider"
                              :key="solId"
                              class="inline-block bg-white border rounded px-1.5 py-0.5 text-[9px] font-bold"
                              :class="restatementConsequences[v.id].deltaFromDefault > 0
                                ? 'border-amber-400 text-amber-800'
                                : 'border-emerald-400 text-emerald-800'">
                          {{ solId }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- ── Resources · Budget column ────────────────────────── -->
              <div class="bg-orange-50 rounded-xl border border-orange-200 p-4 space-y-4">
                <div class="flex items-center gap-2 flex-wrap">
                  <span
                    class="text-[11px] font-bold px-2.5 py-0.5 rounded-full
                           bg-orange-500 text-white uppercase tracking-wide"
                  >
                    Resources · Budget
                  </span>
                  <span class="text-[11px] text-orange-600">
                    {{ hasResources ? `${resources.length} entries` : 'aggregate' }}
                  </span>
                  <span class="ml-auto text-[10px] text-gray-600 font-semibold">
                    Funded capital:
                    <span class="text-orange-800">${{ availableCapital.toFixed(0) }}k</span>
                    of ${{ totalCapitalCost.toFixed(0) }}k
                    ({{ budgetPct }}%)
                  </span>
                </div>

                <!-- Definition card (always visible — Tom: "cannot be understood") -->
                <div class="rounded-lg bg-white border border-orange-200 px-3 py-2 text-[11px] text-gray-700 space-y-1">
                  <p>
                    The budget slider sets <strong>what fraction of total solution cost</strong>
                    is available. Solutions are funded greedily by Value-per-Cost ratio
                    until the budget runs out.
                  </p>
                  <p class="text-gray-600">
                    <strong>100%</strong> = all {{ solutions.length }} solutions affordable
                    (${{ totalCapitalCost.toFixed(0) }}k total). <strong>0%</strong> = no
                    budget · no solutions funded.
                  </p>
                </div>

                <!-- Per-Resource sliders when Resource entries exist -->
                <template v-if="hasResources">
                  <div
                    v-for="r in resources"
                    :key="r.id"
                    class="rounded-lg bg-white border border-orange-200 p-3 space-y-2 shadow-sm"
                  >
                    <div class="flex items-start justify-between gap-2">
                      <div class="min-w-0">
                        <span class="text-[10px] font-bold text-orange-800 uppercase tracking-wide">
                          {{ r.id }}
                        </span>
                        <div class="text-[12px] font-semibold text-gray-800 leading-tight">
                          {{ trunc(r.description, 60) }}
                        </div>
                        <div class="text-[10px] text-gray-500 mt-0.5">
                          <span class="font-bold">Scale:</span> {{ scaleDisplay(r.scale) }}
                        </div>
                      </div>
                      <span
                        class="shrink-0 text-[11px] font-extrabold rounded-full px-2.5 py-1
                               bg-orange-500 text-white"
                        :title="`Budget allocation: ${rSliders[r.id] ?? 100}%`"
                      >
                        {{ rSliders[r.id] ?? 100 }}%
                      </span>
                    </div>
                    <!-- Threshold labels -->
                    <div class="flex items-baseline text-[10px] text-gray-600">
                      <span class="flex-1"><strong class="text-amber-700">Tolerable:</strong> {{ thresholdDisplay(r.tolerable) }}</span>
                      <span class="flex-1 text-center"><strong class="text-emerald-700">Goal:</strong> {{ thresholdDisplay(r.goal) }}</span>
                      <span v-if="r.wish" class="flex-1 text-right"><strong class="text-violet-700">Wish:</strong> {{ thresholdDisplay(r.wish) }}</span>
                    </div>
                    <!-- Budget fill bar (behind slider) -->
                    <div class="relative h-[10px] rounded-full bg-gray-200 overflow-hidden">
                      <div
                        class="absolute inset-y-0 left-0 rounded-full transition-all duration-200"
                        style="background: linear-gradient(90deg, #4f46e5, #7c3aed)"
                        :style="{ width: (rSliders[r.id] ?? 100) + '%' }"
                        aria-hidden="true"
                      />
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      :value="rSliders[r.id] ?? 100"
                      class="r-slider w-full -mt-1"
                      :title="`Outcome band for ${r.id} — ${bandLabel(rSliders[r.id] ?? 100, 'resource').name}. ${bandLabel(rSliders[r.id] ?? 100, 'resource').semantics}`"
                      :aria-label="`Outcome band for ${r.description}`"
                      style="background: transparent"
                      @input="setRSlider(r.id, +($event.target as HTMLInputElement).value)"
                    />
                    <!-- Tom Gilb 2026-06-06 outcome wording for Resource slider:
                         three colored bands labelled Exceeds Budget / Tolerable
                         Budget Excess / Under Budget.  Same red→amber→green
                         polarity as Values (left = bad, right = good). -->
                    <div class="text-[10px] mt-1 leading-snug">
                      <span class="font-bold" :class="bandLabel(rSliders[r.id] ?? 100, 'resource').color">
                        {{ bandLabel(rSliders[r.id] ?? 100, 'resource').name }}
                      </span>
                      <span class="text-gray-700"> — {{ bandLabel(rSliders[r.id] ?? 100, 'resource').semantics }}</span>
                    </div>
                  </div>
                </template>

                <!-- Aggregate budget slider (no Resource entries) -->
                <template v-else>
                  <div class="rounded-lg bg-white border border-orange-200 p-3 space-y-2 shadow-sm">
                    <div class="flex items-center justify-between">
                      <div>
                        <div class="text-[12px] font-semibold text-gray-800">
                          Total Available Budget
                        </div>
                        <div class="text-[10px] text-gray-500">
                          aggregate · no Resource entries in the spec yet
                        </div>
                      </div>
                      <span
                        class="text-[12px] font-extrabold rounded-full px-2.5 py-1
                               bg-orange-500 text-white"
                      >
                        {{ aggregateBudget }}%
                      </span>
                    </div>
                    <div class="relative h-[10px] rounded-full bg-gray-200 overflow-hidden">
                      <div
                        class="absolute inset-y-0 left-0 rounded-full transition-all duration-200"
                        style="background: linear-gradient(90deg, #4f46e5, #7c3aed)"
                        :style="{ width: aggregateBudget + '%' }"
                        aria-hidden="true"
                      />
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      :value="aggregateBudget"
                      class="r-slider w-full -mt-1"
                      title="Aggregate budget fraction (0 = no budget · 100 = full)"
                      aria-label="Available budget percentage"
                      style="background: transparent"
                      @input="setAggregateBudget(+($event.target as HTMLInputElement).value)"
                    />
                    <div class="flex items-center justify-between text-[10px] text-gray-600">
                      <span>${{ availableCapital.toFixed(0) }}k available</span>
                      <span>${{ totalCapitalCost.toFixed(0) }}k total</span>
                    </div>
                    <p class="text-[11px] text-gray-500 italic mt-1">
                      Add Resource (R.) entries to the spec for unit-aware sliders ($, weeks, FTE…).
                    </p>
                  </div>
                </template>
              </div>
            </div>

            <!-- ── Funded Solutions card ────────────────────────────────── -->
            <div class="bg-emerald-50 rounded-xl border border-emerald-200 p-4 space-y-3">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-sm font-bold text-gray-800">
                  ⚡ Funded Solutions
                </span>
                <span
                  class="text-[11px] font-bold px-2 py-0.5 rounded-full
                         bg-emerald-600 text-white"
                >
                  {{ fundedSolutions.length }}
                </span>
                <span
                  v-if="unfundedSolutions.length > 0"
                  class="text-[11px] text-gray-500"
                >
                  · {{ unfundedSolutions.length }} unfunded
                </span>
                <span class="ml-auto text-[10px] text-gray-600">
                  ranked by Value-per-Cost ratio
                </span>
              </div>

              <!-- No solutions at all -->
              <div
                v-if="solutions.length === 0"
                class="text-xs text-gray-500 italic py-1"
              >
                No Solution entries in the current spec.
              </div>

              <!-- Funded list -->
              <TransitionGroup
                v-else
                name="solution-list"
                tag="div"
                class="flex flex-col gap-2"
              >
                <div
                  v-for="sol in fundedSolutions"
                  :key="sol.id"
                  class="flex items-center gap-2 rounded-lg px-3 py-2
                         bg-emerald-100 border border-emerald-300 transition-all duration-300"
                  :title="sol.description"
                >
                  <span class="text-[10px] font-bold text-emerald-900 uppercase shrink-0">
                    {{ sol.id }}
                  </span>
                  <span class="text-[12px] text-emerald-900 flex-1 truncate">
                    {{ trunc(sol.description, 60) }}
                  </span>
                  <span
                    v-if="snapshot.vcRatios[sol.id] !== undefined"
                    class="shrink-0 text-[10px] font-bold rounded-full px-2 py-0.5
                           bg-white border border-emerald-400 text-emerald-700"
                    :title="`Value-per-Cost ratio: ${snapshot.vcRatios[sol.id].toFixed(1)} (higher = more Value per $ spent)`"
                  >
                    {{ snapshot.vcRatios[sol.id].toFixed(1) }}
                  </span>
                </div>
              </TransitionGroup>

              <!-- Budget too low — no funded solutions -->
              <div
                v-if="solutions.length > 0 && fundedSolutions.length === 0"
                class="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5
                       text-xs text-amber-700 font-medium"
              >
                Increase the Resource budget to fund solutions.
              </div>

              <!-- Unfunded list -->
              <TransitionGroup
                v-if="unfundedSolutions.length > 0"
                name="solution-list"
                tag="div"
                class="flex flex-col gap-1.5 mt-1 pt-2 border-t border-emerald-200"
              >
                <div
                  v-for="sol in unfundedSolutions"
                  :key="sol.id"
                  class="flex items-center gap-2 rounded-lg px-3 py-1.5
                         bg-gray-100 border border-gray-200 opacity-60 transition-all duration-300"
                  :title="`Unfunded at current budget · ${sol.description}`"
                >
                  <span class="text-[10px] font-bold text-gray-600 uppercase shrink-0">
                    {{ sol.id }}
                  </span>
                  <span class="text-[12px] text-gray-600 flex-1 truncate">
                    {{ trunc(sol.description, 60) }}
                  </span>
                  <span
                    v-if="snapshot.vcRatios[sol.id] !== undefined"
                    class="shrink-0 text-[10px] font-bold rounded-full px-2 py-0.5
                           bg-white border border-gray-300 text-gray-500"
                    title="Value-per-Cost ratio (this solution is not funded at the current budget)"
                  >
                    {{ snapshot.vcRatios[sol.id].toFixed(1) }}
                  </span>
                </div>
              </TransitionGroup>
            </div>

            <!-- ── Insights card — Tom 2026-06-06 ────────────────────────────
                 "add to Multivision, at the end of a set of changes, you could
                  write a set of insights, like IF YOU REDUCE WISH LEVEL X TO Y
                  YOU CAN REDUCE COSTS BY 30% AND THESE CAN BE USED TO IMPROV
                  VALUE Y TO THE WISH LEVEL, THIS YER".
                 Insights are recomputed LIVE as sliders move so they stay
                 relevant — not a one-shot end-of-session summary.  Patterns
                 covered: tradeoff (lower-Wish-to-fund-shortfall) · headroom
                 (small-budget-bump-funds-next-solution) · over-deliver (Value
                 way above target) · all-green (everything met, try pushing
                 ambition).  All math runs off the deterministic mock VDT
                 snapshot — no LLM call. -->
            <div
              v-if="insights.length > 0"
              class="rounded-2xl border-2 border-violet-200 bg-gradient-to-br from-violet-50 via-white to-indigo-50 p-4 space-y-3"
            >
              <div class="flex items-center gap-2">
                <span class="text-base" aria-hidden="true">💡</span>
                <span class="text-sm font-bold text-gray-800">Tradeoff Insights</span>
                <span
                  class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-violet-600 text-white"
                >
                  {{ insights.length }}
                </span>
                <span class="ml-auto text-[10px] text-gray-500 italic">
                  Live · recomputes as you move sliders
                </span>
              </div>
              <TransitionGroup
                name="solution-list"
                tag="div"
                class="flex flex-col gap-2"
              >
                <div
                  v-for="ins in insights"
                  :key="ins.id"
                  class="flex items-start gap-2.5 rounded-lg border px-3 py-2.5 transition-all duration-300"
                  :class="insightCardClass(ins.severity)"
                >
                  <span class="text-base leading-tight shrink-0" aria-hidden="true">{{ ins.icon }}</span>
                  <p class="text-[12px] leading-snug flex-1">{{ ins.message }}</p>
                </div>
              </TransitionGroup>
            </div>

            <!-- ── Insights empty state (no actionable tradeoffs found) ──── -->
            <div
              v-else
              class="rounded-2xl border border-dashed border-violet-200 bg-violet-50/50 p-4 text-center"
            >
              <span class="text-base" aria-hidden="true">💡</span>
              <p class="text-[12px] text-gray-600 mt-1">
                No tradeoff insights yet. Move a slider to surface live observations.
              </p>
            </div>

            <!-- ── Bottom CTA row ─────────────────────────────────────────── -->
            <div class="flex items-center gap-3 pt-2 border-t border-gray-200 mt-2">
              <button
                type="button"
                class="text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200
                       rounded-lg px-4 py-2 transition-colors focus:outline-none
                       focus-visible:ring-2 focus-visible:ring-gray-400"
                title="Reset all sliders to default · Value sliders to 50 (Goal level), Resource sliders to 100% (full budget)"
                @click="resetSliders()"
              >
                ↺ Reset to Defaults
              </button>
              <!-- r97 — open the new MultiForks system fork diagram. -->
              <button
                type="button"
                class="text-sm font-semibold text-indigo-700 bg-white border-2 border-indigo-300
                       hover:bg-indigo-50 hover:border-indigo-500 rounded-lg px-4 py-2
                       transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                title="Open MultiForks — Resources → System ← Values fork diagram with status colour bands"
                @click="emit('open-multiforks')"
              >
                <MultiForksGlyph size="sm" class="inline-block align-middle mr-1" />
                Open MultiForks
              </button>
              <!-- ⬇ Export — Tom Gilb 2026-06-06: "we cannot see more than 27% o the
                   model in this window at on time" + "apply Export button on all
                   windows".  Builds the full colourful HTML (every Value + every
                   Resource + funded/unfunded Solutions + Insights + Glossary
                   footnote), copies it to the clipboard (HTML + plain), opens a
                   preview window showing 100% of the model in one view, AND
                   auto-opens Mail addressed to Tom@Gilb.com per the SEM Email
                   Body Standard.  See useMultiVisionExport.ts. -->
              <button
                type="button"
                class="text-sm font-semibold text-emerald-800 bg-emerald-50 border-2 border-emerald-400
                       hover:bg-emerald-100 hover:border-emerald-600 rounded-lg px-4 py-2
                       transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                title="⬇ Export MultiVision — opens a preview window with 100% of the model (Values, Resources, Funded Solutions, Insights, Glossary), copies colourful HTML to the clipboard, and opens Mail addressed to Tom@Gilb.com (paste ⌘V in the body for the colour version)."
                @click="exportMultiVision()"
              >
                ⬇ Export · Full Model
              </button>
              <button
                type="button"
                class="ml-auto text-sm font-semibold text-white rounded-lg px-5 py-2
                       transition-all hover:scale-[1.02] active:scale-[0.98]
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                style="background: linear-gradient(135deg, #4f46e5, #7c3aed)"
                title="Lock this Vision configuration and close the panel"
                @click="emit('close')"
              >
                Lock this Vision ✓
              </button>
            </div>

          </ScrollContainer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ── Slider base styles ──────────────────────────────────────────────────── */
input[type='range'] {
  -webkit-appearance: none;
  appearance: none;
  height: 10px;
  border-radius: 5px;
  cursor: pointer;
  outline: none;
  width: 100%;
  background: transparent;
}

/* ── Value slider thumb (indigo) ─────────────────────────────────────────── */
.v-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: white;
  border: 3px solid #4338ca;
  cursor: pointer;
  box-shadow: 0 1px 6px rgba(15, 23, 42, 0.4);
  transition: transform 100ms ease;
}
.v-slider::-webkit-slider-thumb:hover {
  transform: scale(1.15);
}

.v-slider::-webkit-slider-runnable-track {
  height: 10px;
  border-radius: 5px;
}

/* ── Resource slider thumb (violet) ──────────────────────────────────────── */
.r-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: white;
  border: 3px solid #7c3aed;
  cursor: pointer;
  box-shadow: 0 1px 6px rgba(15, 23, 42, 0.4);
  transition: transform 100ms ease;
}
.r-slider::-webkit-slider-thumb:hover {
  transform: scale(1.15);
}

.r-slider::-webkit-slider-runnable-track {
  height: 10px;
  border-radius: 5px;
}

/* ── Panel transition ────────────────────────────────────────────────────── */
.mv-fade-enter-active,
.mv-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.mv-fade-enter-from,
.mv-fade-leave-to {
  opacity: 0;
  transform: scale(0.96);
}

/* ── Funded-solutions list transitions (visible reaction to slider moves) ─ */
.solution-list-enter-active,
.solution-list-leave-active {
  transition: all 280ms ease;
}
.solution-list-enter-from {
  opacity: 0;
  transform: translateX(-12px);
}
.solution-list-leave-to {
  opacity: 0;
  transform: translateX(12px);
}
.solution-list-move {
  transition: transform 280ms ease;
}
</style>
