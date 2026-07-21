<!-- UNIT_TYPE=Panel -->
<!--
/**
 * SettingsPanel — the SEM App settings modal Tom requested long-ago and
 * finally ratified 2026-06-03 with the binding directive:
 *   *"draft one and put all the useful ideas in you can think about, and
 *    ten let me list some: Setting: Ultra Light, or Pro SEM, Default Pro
 *    Sem. Settings: collect maximum feedback data from use of this app, Do
 *    not collect any feedback data"*
 *
 * Plus the AI-Max SUPREME principle (Tom 2026-06-03) — settings include AI
 * assistance level (default Maximum) per the universal "impressive help,
 * not simplified AI access" directive.
 *
 * Sidebar nav of 9 sections; each section renders the relevant settings as
 * radios / toggles / numeric inputs / selects.  Every control has a :title
 * (Interaction Disclosure DD-009) explaining what it does + when it matters.
 *
 * Rules complied with:
 *   - Single-Surface: caller registers `settingsOpen` exclusive surface
 *   - ScrollContainer: both sidebar + main pane wrapped
 *   - CloseDot: header end-of-flex
 *   - Planguage-Glyph-First: no inline SVG icons (emoji + text labels)
 *   - Interaction Disclosure: every control has :title
 *
 * v1: settings persist + UI works.  Components consume settings as they are
 * wired in subsequent iterations.  Each "live" setting will be marked in
 * its row when its consumer is shipped.
 */
-->
<script setup lang="ts">
import { ref, computed } from 'vue'
import ScrollContainer from './ScrollContainer.vue'
import CloseDot from './CloseDot.vue'
import { useSettings } from '../composables/useSettings'
import { useStrategyMode } from '../composables/useStrategyMode'
import { SETTINGS_SECTIONS } from '../data/settings'
import type { Settings, StrategyTerminology } from '../data/settings'

// r41 v48 — single defineEmits with close + new activate-contract-agent event.
const emit = defineEmits<{
  close: []
  /** Tom Gilb 2026-06-16 verbatim "IN CONTRACT MODE, THE CONTRACT AGENT IS
   *  ACTIVATED" — fires when the planner clicks Activate in the Contracts
   *  Mode section.  App.vue handler opens ContractHub. */
  'activate-contract-agent': []
}>()

const { settings, setOne, resetAll, exportJson, importJson } = useSettings()
const { isStrategyMode } = useStrategyMode()

// Type-safe setter for nested StrategyTerminology fields
function setTerminology<K extends keyof StrategyTerminology>(
  key: K,
  value: StrategyTerminology[K],
): void {
  setOne('strategyTerminology', { ...settings.value.strategyTerminology, [key]: value })
}

// ── Section navigation ───────────────────────────────────────────────────────
const activeSectionId = ref<string>('mode')

// ── Import/export UX ─────────────────────────────────────────────────────────
const showImport = ref(false)
const importText = ref('')
const importError = ref('')
function onImportConfirm(): void {
  if (importJson(importText.value)) {
    importText.value = ''
    importError.value = ''
    showImport.value = false
  } else {
    importError.value = 'Invalid Planguage Representation or schema mismatch.'
  }
}
function onExportCopy(): void {
  if (navigator.clipboard) navigator.clipboard.writeText(exportJson()).catch(() => { /* ignore */ })
}

// ── Reset confirm ────────────────────────────────────────────────────────────
function onResetConfirm(): void {
  if (confirm('Reset ALL settings to defaults?  Cannot be undone.')) {
    resetAll()
  }
}

// ── Type-safe setter helper for the template ─────────────────────────────────
// Vue template can't infer the generic K easily; wrap to coerce.
function set<K extends keyof Settings>(key: K, value: Settings[K]): void {
  setOne(key, value)
}

// ── "Live" marker — which settings are actually consumed by other components
// today vs queued for wiring.  Settings panel shows a small badge for each
// row so users know what's effective vs scaffold-only.
const LIVE_SETTINGS = new Set<keyof Settings>([
  // Today: nothing is live yet — every setting persists but is not consumed.
  // As components are wired, add their setting keys here.
])
function isLive(key: keyof Settings): boolean {
  return LIVE_SETTINGS.has(key)
}

// ── Counters for footer ──────────────────────────────────────────────────────
const liveCount = computed<number>(() => LIVE_SETTINGS.size)
const totalSettingsCount = Object.keys(settings.value).length

// ── Script-side option constants (avoid embedded-quote parse errors that
//    bit us 2026-06-03 when v-for inline arrays carried double-quoted help
//    text inside double-quoted attributes). ───────────────────────────────────
type TelLevel = 'none' | 'standard' | 'maximum'
const TELEMETRY_OPTIONS: Array<{ v: TelLevel; label: string; help: string }> = [
  { v: 'none',     label: 'None (default)', help: 'Do not collect any feedback data.  Tom verbatim.' },
  { v: 'standard', label: 'Standard',       help: 'Event counts only (e.g., counting when FEED ME! is opened).  No content, no PII.' },
  { v: 'maximum',  label: 'Maximum',        help: 'Tom verbatim — collect maximum feedback data from use of this app.  Events plus anonymised content samples.' },
]

// r41 v46 simple Model Mode options removed in r41 v48 — replaced by the
// rich 4-axis ModelModeConfig (see below).

// r41 v47 — Contracts Mode redesigned to Tom's 4-axis spec (Tom Gilb 2026-06-16).
// r41 v48 — Model Mode redesigned to Tom's parallel 4-axis spec.
import type {
  ContractsModeConfig,
  ContractsPresentation,
  ContractsPurpose,
  ContractsStandardId,
  ModelModeConfig,
  ModelDomain,
  ModelPresentation,
  ModelStandardId,
  ModelPurpose,
} from '../data/settings'

// ── Model Mode option arrays (Tom Gilb 2026-06-16) ───────────────────────────

const MODEL_DOMAIN_OPTIONS: Array<{ v: ModelDomain; label: string; help: string }> = [
  { v: 'organization',     label: '🏢 Organization',          help: 'The model describes an organization — units, roles, processes, governance.' },
  { v: 'product',          label: '📦 Product',               help: 'The model describes a product — features, performance, lifecycle.  Default.' },
  { v: 'building',         label: '🏛 Building',              help: 'The model describes a physical building or structure — materials, performance, regulatory compliance.' },
  { v: 'abstract-language', label: '🔤 Abstract · Language',   help: 'The model describes a language — grammar, semantics, vocabulary.  Planguage itself fits here.' },
  { v: 'abstract-process',  label: '🔁 Abstract · Process',    help: 'The model describes a process — sequence, conditions, decision points.  E.g. Evo cycle, Plan-Do-Study-Act.' },
  { v: 'abstract-method',   label: '🧪 Abstract · Method',     help: 'The model describes a method — sequence of techniques applied to achieve a goal.' },
  { v: 'abstract-policy',   label: '📜 Abstract · Policy',     help: 'The model describes a policy — principles, rules, obligations.' },
  { v: 'abstract-contract', label: '📋 Abstract · Contract',   help: 'The model describes a contract — parties, obligations, conditions, remedies.  Composes with Contracts Mode.' },
  { v: 'abstract-plan',     label: '📐 Abstract · Plan',       help: 'The model describes a plan — Stakes, Ends, Means, Evo Steps.  The native SEM artifact.' },
]

const MODEL_PRESENTATION_OPTIONS: Array<{ v: ModelPresentation; label: string; help: string }> = [
  // r41 2026-06-20 — Spell-out-Type-Names SUPREME (no F. V. C. R. S. dotted
  // abbreviations in user-visible help text) + Value-Definition-Identity
  // SUPREME corrected formulation (Scale + at-least-one-future-state are
  // the two unconditional requirements; Meter is desirable but not
  // initially required).
  { v: 'planguage',   label: '📝 Planguage',                help: 'Render as Planguage spec — Function / Value / Constraint / Resource / Solution / Stakeholder entries with Scale and at least one future state (Tolerable / Goal / Wish), Meter optional but recommended.  Default.' },
  { v: 'diagram',     label: '📊 Diagram',                  help: 'Render as a 2D diagram (mermaid / SVG flow / ontology graph).  Composes with Plan Diagrams + Penta Model.' },
  { v: '3d',          label: '🎲 3D',                       help: 'Render as a 3D model — depth, perspective, interactive rotation.  Best for spatial domains (building / product).' },
  { v: 'colorful',    label: '🎨 Colourful',                help: 'Render with full colour palette — for visual scanning, presentations, distinguishing categories at a glance.' },
  { v: 'black-white', label: '⬛ Black / White',             help: 'Render in monochrome — for accessibility, print, photocopying, formal academic papers.' },
  { v: 'slide-deck',  label: '🖼 Slide Deck',                help: 'Render as a Keynote / PowerPoint-ready slide deck — one model section per slide.' },
  { v: 'paper',       label: '📄 Paper',                    help: 'Render as a long-form academic / business paper — full text, citations, figures inline.' },
  { v: 'booklet',     label: '📔 Booklet',                  help: 'Render as a printable booklet — narrative chapters, illustrations, table of contents.' },
]

const MODEL_STANDARDS_OPTIONS: Array<{ v: ModelStandardId; label: string; help: string }> = [
  { v: 'planguage',     label: 'Tom Gilb · Planguage',        help: 'Tom Gilb\'s Planguage methodology — quantified entries, scale-and-meter discipline.  Default on; this app\'s native standard.' },
  { v: 'elon',          label: 'Musk\'s Methods (Gilb) + Dove Pace', help: 'Elon Sharpening — Pace of Innovation as dominant requirement (Dove et al.), first-principles violations, 5-step Musk algorithm.' },
  { v: 'incorruptible', label: 'Ries · Incorruptible',         help: 'Eric Ries Incorruptible 4-pillar framework — Purpose · Coherence · Integrity · Compliance.  Strategic-resilience check.' },
]

const MODEL_PURPOSE_OPTIONS: Array<{ v: ModelPurpose; label: string; help: string }> = [
  { v: 'complex-system-maintenance',  label: '🛠 Complex System Maintenance',        help: 'Model is used to keep a complex system running — surface dependencies, single points of failure, scheduled-maintenance windows.' },
  { v: 'academic-research-presentation', label: '🎓 Academic Research + Presentation', help: 'Model supports academic research — full citations, methodology section, reproducible parameters, peer-review ready.' },
  { v: 'management-decision-making',  label: '💼 Management Decision-Making',         help: 'Model supports management decisions — surface trade-offs, scenarios, decision matrices, KPI projections.  Default.' },
  { v: 'supply-chain-management',     label: '🚚 Supply Chain Management',            help: 'Model is used to manage supply chain and suppliers — surface dependencies, lead times, single-source risks, supplier KPIs.' },
  { v: 'organizational-design',       label: '🏢 Organizational Design',              help: 'Model is used to design an organization — units, roles, reporting lines, accountability chains.' },
  { v: 'product-development',         label: '📦 Product Development',                help: 'Model supports product development — feature roadmap, performance targets, integration points.' },
  { v: 'risk-assessment',             label: '⚠ Risk Assessment',                    help: 'Model is used to assess risk — surface exposure, mitigation, residual risk, monitoring cadence.' },
  { v: 'compliance-audit',            label: '⚖ Compliance Audit',                   help: 'Model supports compliance audit — surface every claim with a citation, traceable to a standard or regulation.' },
  { v: 'training-education',          label: '📚 Training + Education',               help: 'Model is used to teach — learning objectives, exercises, assessment criteria, instructor notes.' },
  { v: 'innovation-roadmap',          label: '💡 Innovation Roadmap',                 help: 'Model supports innovation planning — moonshot bets, current-state baseline, gap analysis, milestones.' },
]

// Single-field updater for the rich ContractsModeConfig object — keeps the
// other axes intact (avoids whole-object replacement bugs).
function updateContractsMode<K extends keyof ContractsModeConfig>(
  key:   K,
  value: ContractsModeConfig[K],
): void {
  set('contractsMode', { ...settings.value.contractsMode, [key]: value })
}

function toggleStandard(id: ContractsStandardId): void {
  const cur = settings.value.contractsMode.standards
  const next = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]
  updateContractsMode('standards', next)
}

function togglePurpose(id: ContractsPurpose): void {
  const cur = settings.value.contractsMode.purposes
  const next = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]
  updateContractsMode('purposes', next)
}

function addCustomUrl(): void {
  updateContractsMode('standardsCustomUrls', [...settings.value.contractsMode.standardsCustomUrls, ''])
}

function updateCustomUrl(idx: number, value: string): void {
  const next = [...settings.value.contractsMode.standardsCustomUrls]
  next[idx] = value
  updateContractsMode('standardsCustomUrls', next)
}

function removeCustomUrl(idx: number): void {
  const next = settings.value.contractsMode.standardsCustomUrls.filter((_, i) => i !== idx)
  updateContractsMode('standardsCustomUrls', next)
}

// r41 v48 — Model Mode multi-pick + custom-url helpers (parallel to Contracts Mode).
function updateModelMode<K extends keyof ModelModeConfig>(
  key:   K,
  value: ModelModeConfig[K],
): void {
  set('modelMode', { ...settings.value.modelMode, [key]: value })
}

function toggleModelStandard(id: ModelStandardId): void {
  const cur = settings.value.modelMode.standards
  const next = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]
  updateModelMode('standards', next)
}

function toggleModelPurpose(id: ModelPurpose): void {
  const cur = settings.value.modelMode.purposes
  const next = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]
  updateModelMode('purposes', next)
}

function addModelCustomUrl(): void {
  updateModelMode('standardsCustomUrls', [...settings.value.modelMode.standardsCustomUrls, ''])
}

function updateModelCustomUrl(idx: number, value: string): void {
  const next = [...settings.value.modelMode.standardsCustomUrls]
  next[idx] = value
  updateModelMode('standardsCustomUrls', next)
}

function removeModelCustomUrl(idx: number): void {
  const next = settings.value.modelMode.standardsCustomUrls.filter((_, i) => i !== idx)
  updateModelMode('standardsCustomUrls', next)
}

// r41 v48 (Tom Gilb 2026-06-16 verbatim "IN CONTRACT MODE, THE CONTRACT AGENT
// IS ACTIVATED") — Activate button in the Contracts Mode section fires the
// activate-contract-agent emit (declared at top with defineEmits).
function activateContractAgent(): void {
  emit('activate-contract-agent')
}

const CONTRACTS_STANDARDS_OPTIONS: Array<{ v: ContractsStandardId; label: string; help: string }> = [
  { v: 'gilb-planguage', label: 'Tom Gilb · Planguage',                    help: 'Tom Gilb\'s Planguage methodology — quantified Values, Functions, Constraints, Resources, Solutions.  Default on; this app\'s native standard.' },
  { v: 'plain-english',  label: 'Plain English Contract',                   help: 'Plain English Campaign style — no archaic or redundant legal phrasing.  Recommended for managerial-audience contracts.' },
  { v: 'iso-9001',       label: 'ISO 9001 · Quality Management',            help: 'Quality Management Systems — clauses must align with the 7 ISO 9001 quality principles.' },
  { v: 'iso-27001',      label: 'ISO 27001 · Information Security',         help: 'Information Security Management — flags clauses missing security controls / breach handling / access policies.' },
  { v: 'gdpr',           label: 'GDPR · EU Data Protection',                help: 'EU General Data Protection Regulation — personal-data processing clauses checked for consent, retention, subject rights, breach notice.' },
  { v: 'hipaa',          label: 'HIPAA · US Health Privacy',                help: 'US Health Insurance Portability + Accountability Act — PHI handling, business associate clauses, breach notification.' },
  { v: 'sox',            label: 'SOX · US Accounting Controls',             help: 'Sarbanes-Oxley — internal controls, attestation, document retention for financial obligations.' },
  { v: 'incoterms-2020', label: 'Incoterms 2020 · International Trade',     help: 'ICC Incoterms 2020 — Delivery + risk + cost allocation in international sale-of-goods contracts.' },
  { v: 'unidroit',       label: 'UNIDROIT Principles',                       help: 'UNIDROIT Principles of International Commercial Contracts — neutral framework for cross-border agreements.' },
  { v: 'common-law',     label: 'Common-Law jurisdictional framing',         help: 'Anglo-American common-law tradition — consideration, parol-evidence, precedent-based interpretation.' },
  { v: 'civil-law',      label: 'Civil-Law jurisdictional framing',          help: 'European civil-law tradition — code-based, good-faith doctrine, less reliance on precedent.' },
]

const CONTRACTS_PRESENTATION_OPTIONS: Array<{ v: ContractsPresentation; label: string; help: string }> = [
  { v: 'legal-experts',     label: '⚖️ Legal Experts',     help: 'Precise legal terminology, full citations, defined terms, careful preservation of nuance.  Output reads like a lawyer-drafted memorandum.' },
  { v: 'managers',          label: '💼 Managers',          help: 'Plain-English summary, key obligations + risks + dates surfaced first, jargon defined inline.  Default — broadest audience.' },
  { v: 'technical-experts', label: '🔬 Technical Experts', help: 'Engineering / domain-specific precision (SLAs, throughput numbers, system architecture).  Quantifications + protocols preserved; legal boilerplate condensed.' },
]

const CONTRACTS_PURPOSE_OPTIONS: Array<{ v: ContractsPurpose; label: string; help: string }> = [
  { v: 'strict-analytical',    label: '🔍 Strictly Analytical',    help: 'Analyze only — surface issues, ambiguities, missing fields, conflicts.  Do NOT modify the contract.  Safe default for audits.' },
  { v: 'change-log',           label: '📝 Give a log of all changes', help: 'Whenever the AI changes anything, emit a structured before/after diff with rationale.  Composes with rewrite + creative.' },
  { v: 'rewrite',              label: '✍ Re-write the contract',   help: 'Produce a rewritten version of the contract in the chosen Presentation style.  Original preserved in version history; new version returned.' },
  { v: 'creative-suggestions', label: '💡 Creative Suggestions',   help: 'Propose: changes to the contract · additional appendices · supporting documents · other actions · negotiating tactics.  All clearly labeled as suggestions, not edits.' },
]

// r41 v29 — Illumination depth options (Tom Gilb 2026-06-15).
type IllumDepth = 'short' | 'standard' | 'deep'
const ILLUMINATION_DEPTH_OPTIONS: Array<{ v: IllumDepth; label: string; tip: string }> = [
  { v: 'short',    label: '⚡ Short',    tip: 'Glance card only — one sentence + CTAs.  Fastest path.' },
  { v: 'standard', label: '📖 Standard', tip: 'Glance + primary Glossary entry visible on expand.  Default.' },
  { v: 'deep',     label: '🔬 Deep',     tip: 'Tom verbatim (I want deepest possible insights).  Pre-expand everything + Twin always-on + history included.' },
]
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[500] bg-slate-900/70 flex items-stretch justify-center p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      @click.self="$emit('close')"
    >
      <div class="w-full max-w-5xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col">

        <!-- Header -->
        <header class="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-slate-700 to-slate-900 text-white">
          <span class="text-2xl leading-none" aria-hidden="true">⚙</span>
          <div class="flex-1 min-w-0">
            <h2 id="settings-title" class="text-base font-bold">SEM Settings</h2>
            <p class="text-[11px] text-slate-300 mt-0.5">
              Mode · AI · Privacy · Evo defaults · Visual · Workflow · Export · Collab · Diagnostics · Strategy
              <span class="text-amber-300 ml-2">· v1: {{ liveCount }}/{{ totalSettingsCount }} live, rest persist but not yet consumed</span>
            </p>
          </div>
          <CloseDot @click="$emit('close')" />
        </header>

        <!-- Body — sidebar + main pane -->
        <div class="flex-1 flex min-h-0">

          <!-- Sidebar — Tom 2026-06-03: "setting left pane does not scroll".
               Was passing sizing via `class=` directly which lands on the wrapper
               but ScrollContainer expects sizing on `outer-class` (the prop that
               gets `min-h-0` for the flex shrink that triggers inner overflow).
               Adding 9 sections worth of content exceeds modal height; without
               min-h-0 the inner overflow-y-auto cannot activate. -->
          <ScrollContainer
            outer-class="w-56 flex-shrink-0 border-r border-slate-200 bg-slate-50 min-h-0"
            inner-class="p-2 space-y-0.5"
          >
            <button
              v-for="sec in SETTINGS_SECTIONS"
              :key="sec.id"
              type="button"
              class="w-full text-left rounded-lg px-3 py-2 transition-colors"
              :class="sec.id === activeSectionId
                ? 'bg-white shadow-sm ring-1 ring-slate-300'
                : 'hover:bg-white/70'"
              :title="`${sec.label} — ${sec.description}`"
              @click="activeSectionId = sec.id"
            >
              <div class="flex items-center gap-2">
                <div class="w-1 h-3.5 rounded-full bg-gradient-to-b" :class="sec.accent" aria-hidden="true" />
                <span class="text-[12px] font-semibold text-slate-800">{{ sec.label }}</span>
              </div>
              <p class="text-[10px] text-slate-500 leading-snug ml-3 mt-0.5">{{ sec.description }}</p>
            </button>
          </ScrollContainer>

          <!-- Main pane -->
          <ScrollContainer outer-class="flex-1 min-h-0" inner-class="p-6 space-y-6">

            <!-- ── Mode ───────────────────────────────────────────────────── -->
            <section v-show="activeSectionId === 'mode'">
              <h3 class="text-sm font-bold text-slate-800 mb-1">Mode</h3>
              <p class="text-[11px] text-slate-500 mb-4">Tom 2026-06-03: <em>"Ultra Light, or Pro SEM, Default Pro Sem"</em></p>

              <fieldset class="space-y-2">
                <legend class="sr-only">App mode</legend>
                <label
                  v-for="opt in [
                    { v: 'pro-sem' as const,    label: 'Pro SEM (default)', help: 'Full toolkit — every panel, every Evo Tool, every audit trail.  Recommended for serious Evo planning.' },
                    { v: 'ultra-light' as const, label: 'Ultra Light',       help: 'Minimal UI — fewer options, smaller panels.  For quick spec exploration without the full machinery.' },
                  ]"
                  :key="opt.v"
                  class="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 cursor-pointer hover:bg-slate-50"
                  :class="settings.mode === opt.v ? 'border-violet-300 bg-violet-50/40' : ''"
                  :title="opt.help"
                >
                  <input
                    type="radio"
                    :checked="settings.mode === opt.v"
                    name="mode"
                    class="mt-1 accent-violet-600"
                    @change="set('mode', opt.v)"
                  />
                  <div>
                    <p class="text-sm font-semibold text-slate-800">{{ opt.label }}</p>
                    <p class="text-[11px] text-slate-600">{{ opt.help }}</p>
                  </div>
                </label>
              </fieldset>
            </section>

            <!-- ── Stage 1 Workflow (Tom Gilb 2026-06-24 verbatim) ─────────────
                 First per-stage settings section. Tom verbatim:
                 "in Settings, for Stage 1 (we need settings for each stage)
                  option 'Go from Source Input, directly to Generation of
                  Planguage Specs', (This skips the Implied Specs stage).
                  Option 2 'After Generation of Planguage Specs, run an
                  'Implied Specs Options' (Stage 1.3, I think) and generate
                  additional Planguage specs as a possible result."
                 Phase 1 (v325): UI ships + setting persists.
                 Phase 2 (post-demo): wire the routing layer to honour. -->
            <section v-show="activeSectionId === 'stage1'">
              <h3 class="text-sm font-bold text-slate-800 mb-1">Stage 1 Workflow</h3>
              <p class="text-[11px] text-slate-500 mb-4">
                Tom Gilb 2026-06-24 — first per-stage settings section.  Controls how
                Stage 1 routes <strong>1.3 Add Implied Optional</strong> relative to
                <strong>1.4 Generate Planguage Spec</strong>.  Default is the canonical order
                (Implied review BEFORE Generation).  Two alternatives available.
              </p>

              <!-- Phase-1 note: setting persists but doesn't yet wire through to the actual
                   sub-step routing.  Phase 2 (post-demo) lands the routing change. -->
              <div class="mb-4 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
                <strong>Phase 1 status (r41 v325):</strong> the Setting persists in
                localStorage.  Phase 2 (post-demo) wires the actual sub-step routing
                to honour the selection.  Today, the canonical workflow (1.1 → 1.2 → 1.3
                → 1.4 → 1.5) still runs regardless of selection.
              </div>

              <fieldset class="space-y-2">
                <legend class="sr-only">Stage 1 workflow mode</legend>
                <label
                  v-for="opt in [
                    { v: 'default-implied-before-generate' as const,
                      label: 'Default — Implied Review BEFORE Generation',
                      flow: '1.1 Capture → 1.2 Parse → 1.3 Add Implied Optional → 1.4 Generate Planguage Spec → 1.5 Edit & Refine',
                      help: 'Canonical order. Implied entries are surfaced for review BEFORE the full Planguage generation. Best when you want to refine the parser implications before committing.' },
                    { v: 'skip-implied' as const,
                      label: 'Skip Implied — Direct to Generation',
                      flow: '1.1 Capture → 1.2 Parse → 1.4 Generate Planguage Spec → 1.5 Edit & Refine',
                      help: 'Fastest path. Skips 1.3 entirely. Best when the source is already well-structured and you do not need to review implied entries. Tom verbatim — Go from Source Input, directly to Generation of Planguage Specs.' },
                    { v: 'implied-after-generate' as const,
                      label: 'Implied AFTER Generation (as Options)',
                      flow: '1.1 Capture → 1.2 Parse → 1.4 Generate Planguage Spec → 1.3 Add Implied Optional → 1.5 Edit & Refine',
                      help: 'AI generates the full Planguage Spec first; THEN proposes ADDITIONAL implied entries as possible additions on top of what was already generated. Tom verbatim — After Generation of Planguage Specs, run an Implied Specs Options and generate additional Planguage specs as a possible result.' },
                  ]"
                  :key="opt.v"
                  class="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 cursor-pointer hover:bg-slate-50"
                  :class="settings.stage1WorkflowMode === opt.v ? 'border-indigo-300 bg-indigo-50/40' : ''"
                  :title="opt.help"
                >
                  <input
                    type="radio"
                    :checked="settings.stage1WorkflowMode === opt.v"
                    name="stage1WorkflowMode"
                    class="mt-1 accent-indigo-600"
                    @change="set('stage1WorkflowMode', opt.v)"
                  />
                  <div>
                    <p class="text-sm font-semibold text-slate-800">{{ opt.label }}</p>
                    <p class="text-[11px] font-mono text-indigo-700 mt-0.5">{{ opt.flow }}</p>
                    <p class="text-[11px] text-slate-600 mt-1">{{ opt.help }}</p>
                  </div>
                </label>
              </fieldset>

              <!-- Pattern banked for the other 10 stages -->
              <div class="mt-6 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-700">
                <strong>Pattern banked:</strong> Stage 1 is the FIRST per-stage settings
                section.  Tom verbatim: <em>"we need settings for each stage"</em>.  The
                same shape (radio-button workflow options + per-stage rationale) extends
                to Stages 2-11 as their workflow choices are surfaced.
              </div>
            </section>

            <!-- ── Model Mode (Tom Gilb 2026-06-16 verbatim 4-axis design) ──
                 1. Model Domain · 2. Model Presentation · 3. Model Analytics
                 (standards + URLs + search-additional toggle) · 4. Model Purpose -->
            <section v-show="activeSectionId === 'modelMode'">
              <h3 class="text-sm font-bold text-slate-800 mb-1">Model Mode</h3>
              <p class="text-[11px] text-slate-500 mb-4">
                Tom Gilb 2026-06-16 four-axis design.  Every Spec Model generation + analysis call composes all four axes.
              </p>

              <!-- AXIS 1 — Model Domain -->
              <div class="rounded-xl border-2 border-blue-200 bg-blue-50/40 p-4 mb-4">
                <h4 class="text-xs font-extrabold text-blue-900 uppercase tracking-wider mb-2">1 · Domain (subject)</h4>
                <p class="text-[11px] text-slate-700 mb-2">What subject does the model describe?  Pick ONE.</p>
                <fieldset class="space-y-1.5">
                  <legend class="sr-only">Model domain</legend>
                  <label
                    v-for="opt in MODEL_DOMAIN_OPTIONS"
                    :key="opt.v"
                    class="flex items-start gap-2 rounded-md px-2 py-1 cursor-pointer hover:bg-white"
                    :class="settings.modelMode.domain === opt.v ? 'bg-white ring-1 ring-blue-400' : ''"
                    :title="opt.help"
                  >
                    <input
                      type="radio"
                      :checked="settings.modelMode.domain === opt.v"
                      name="modelDomain"
                      class="mt-1 accent-blue-600 shrink-0"
                      @change="updateModelMode('domain', opt.v)"
                    />
                    <div>
                      <p class="text-xs font-semibold text-slate-800">{{ opt.label }}</p>
                      <p class="text-[10px] text-slate-600 leading-snug">{{ opt.help }}</p>
                    </div>
                  </label>
                </fieldset>
              </div>

              <!-- AXIS 2 — Model Presentation -->
              <div class="rounded-xl border-2 border-blue-200 bg-blue-50/40 p-4 mb-4">
                <h4 class="text-xs font-extrabold text-blue-900 uppercase tracking-wider mb-2">2 · Presentation</h4>
                <p class="text-[11px] text-slate-700 mb-2">How should the model be rendered + exported?  Pick ONE.</p>
                <fieldset class="space-y-1.5">
                  <legend class="sr-only">Model presentation</legend>
                  <label
                    v-for="opt in MODEL_PRESENTATION_OPTIONS"
                    :key="opt.v"
                    class="flex items-start gap-2 rounded-md px-2 py-1 cursor-pointer hover:bg-white"
                    :class="settings.modelMode.presentation === opt.v ? 'bg-white ring-1 ring-blue-400' : ''"
                    :title="opt.help"
                  >
                    <input
                      type="radio"
                      :checked="settings.modelMode.presentation === opt.v"
                      name="modelPresentation"
                      class="mt-1 accent-blue-600 shrink-0"
                      @change="updateModelMode('presentation', opt.v)"
                    />
                    <div>
                      <p class="text-xs font-semibold text-slate-800">{{ opt.label }}</p>
                      <p class="text-[10px] text-slate-600 leading-snug">{{ opt.help }}</p>
                    </div>
                  </label>
                </fieldset>
              </div>

              <!-- AXIS 3 — Model Analytics (Standards) -->
              <div class="rounded-xl border-2 border-blue-200 bg-blue-50/40 p-4 mb-4">
                <h4 class="text-xs font-extrabold text-blue-900 uppercase tracking-wider mb-2">3 · Analytics · Standards Conformance</h4>
                <p class="text-[11px] text-slate-700 mb-2">Tick any number — the LLM checks the model conforms to these.</p>
                <div class="space-y-1.5 mb-3">
                  <label
                    v-for="opt in MODEL_STANDARDS_OPTIONS"
                    :key="opt.v"
                    class="flex items-start gap-2 rounded-md px-2 py-1 cursor-pointer hover:bg-white"
                    :class="settings.modelMode.standards.includes(opt.v) ? 'bg-white ring-1 ring-blue-300' : ''"
                    :title="opt.help"
                  >
                    <input
                      type="checkbox"
                      :checked="settings.modelMode.standards.includes(opt.v)"
                      class="mt-1 accent-blue-600 shrink-0"
                      @change="toggleModelStandard(opt.v)"
                    />
                    <div class="min-w-0">
                      <p class="text-xs font-semibold text-slate-800">{{ opt.label }}</p>
                      <p class="text-[10px] text-slate-600 leading-snug">{{ opt.help }}</p>
                    </div>
                  </label>
                </div>
                <!-- Custom URLs -->
                <div class="border-t border-blue-200 pt-3 mt-3 mb-3">
                  <p class="text-[11px] font-bold text-blue-900 mb-1.5">Custom standard URLs <span class="font-normal text-slate-500">(one URL per row)</span></p>
                  <div v-for="(url, idx) in settings.modelMode.standardsCustomUrls" :key="idx" class="flex items-center gap-1.5 mb-1.5">
                    <input
                      type="url"
                      :value="url"
                      placeholder="https://example.com/standard.pdf"
                      class="flex-1 text-xs px-2 py-1 border border-blue-300 rounded bg-white focus:outline-none focus:border-blue-600 font-mono"
                      title="A custom standard URL the AI should treat as a reference for this model."
                      @change="updateModelCustomUrl(idx, ($event.target as HTMLInputElement).value)"
                    />
                    <button
                      type="button"
                      class="px-2 py-1 text-[10px] font-bold text-rose-700 hover:bg-rose-100 border border-rose-200 rounded bg-white"
                      title="Remove this URL"
                      @click="removeModelCustomUrl(idx)"
                    >✕</button>
                  </div>
                  <button
                    type="button"
                    class="text-[11px] px-2 py-1 rounded bg-white border border-blue-300 text-blue-800 font-bold hover:bg-blue-50"
                    title="Append a blank URL row"
                    @click="addModelCustomUrl"
                  >+ Add another URL</button>
                </div>
                <!-- Search-additional toggle -->
                <div class="border-t border-blue-200 pt-3 mt-3">
                  <label class="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      :checked="settings.modelMode.searchForAdditionalStandards"
                      class="mt-1 accent-blue-600"
                      title="When on, the AI actively searches the internet for additional relevant standards beyond those explicitly listed. Composes the Conjunction-of-Technologies SUPREME rule (Plan + Gilb corpus + LLM + Internet)."
                      @change="updateModelMode('searchForAdditionalStandards', ($event.target as HTMLInputElement).checked)"
                    />
                    <div>
                      <p class="text-xs font-bold text-blue-900">🔍 Search for additional standards</p>
                      <p class="text-[10px] text-slate-700 leading-snug">When on, the AI actively searches the internet for additional relevant standards beyond those listed above.  Composes Conjunction-of-Technologies SUPREME (Plan + Gilb corpus + LLM + Internet).</p>
                    </div>
                  </label>
                </div>
              </div>

              <!-- AXIS 4 — Model Purpose -->
              <div class="rounded-xl border-2 border-blue-200 bg-blue-50/40 p-4">
                <h4 class="text-xs font-extrabold text-blue-900 uppercase tracking-wider mb-2">4 · Purpose</h4>
                <p class="text-[11px] text-slate-700 mb-2">Tick any combination — the AI composes them all.</p>
                <div class="space-y-1.5">
                  <label
                    v-for="opt in MODEL_PURPOSE_OPTIONS"
                    :key="opt.v"
                    class="flex items-start gap-2 rounded-md px-2 py-1.5 cursor-pointer hover:bg-white"
                    :class="settings.modelMode.purposes.includes(opt.v) ? 'bg-white ring-1 ring-blue-400' : ''"
                    :title="opt.help"
                  >
                    <input
                      type="checkbox"
                      :checked="settings.modelMode.purposes.includes(opt.v)"
                      class="mt-1 accent-blue-600 shrink-0"
                      @change="toggleModelPurpose(opt.v)"
                    />
                    <div>
                      <p class="text-xs font-semibold text-slate-800">{{ opt.label }}</p>
                      <p class="text-[10px] text-slate-600 leading-snug">{{ opt.help }}</p>
                    </div>
                  </label>
                </div>
              </div>

              <p class="text-[10px] text-slate-500 italic mt-3 border-l-2 border-blue-200 pl-3">
                Defaults: Product domain · Planguage presentation · Planguage standard on · Search-additional ON · Management Decision-Making purpose.  Tom Gilb 2026-06-16: <em>"ADD MORE"</em> — additional purposes Claudian seeded: organizational-design, product-development, risk-assessment, compliance-audit, training-education, innovation-roadmap.  Tell me which to keep/drop/rename.
              </p>
            </section>

            <!-- ── Contracts Mode (Tom Gilb 2026-06-16 verbatim) ──────────
                 4-axis rich design: 1. Apply Contract Sharpening · 2. Apply
                 Standards (list + custom URLs) · 3. Presentation (Legal Experts
                 / Managers / Technical Experts) · 4. Purpose (Re-write / Change
                 log / Strictly Analytical / Creative Suggestions). -->
            <section v-show="activeSectionId === 'contractsMode'">
              <h3 class="text-sm font-bold text-slate-800 mb-1">Contracts Mode</h3>
              <p class="text-[11px] text-slate-500 mb-4">
                Tom Gilb 2026-06-16 four-axis design.  Every Contract Hub parse + analysis call composes all four.
              </p>

              <!-- AXIS 1 — Apply Contract Sharpening -->
              <div class="rounded-xl border-2 border-teal-200 bg-teal-50/40 p-4 mb-4">
                <h4 class="text-xs font-extrabold text-teal-900 uppercase tracking-wider mb-2">1 · Sharpening</h4>
                <label class="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    :checked="settings.contractsMode.applyContractSharpening"
                    class="mt-1 accent-teal-600"
                    title="When on, every parsed clause runs through the same Planguage Sharpening pipeline used for specs (Tolerable / Goal / Wish inference, Scale + Meter detection, ambiguity flagging).  When off, raw clauses are imported as-is."
                    @change="updateContractsMode('applyContractSharpening', ($event.target as HTMLInputElement).checked)"
                  />
                  <div>
                    <p class="text-sm font-bold text-teal-900">Apply Contract Sharpening</p>
                    <p class="text-[11px] text-slate-700">Every clause runs through the Planguage Sharpening pipeline — Tolerable / Goal / Wish inference, Scale + Meter detection, ambiguity flagging.</p>
                  </div>
                </label>
              </div>

              <!-- AXIS 2 — Apply Standards -->
              <div class="rounded-xl border-2 border-teal-200 bg-teal-50/40 p-4 mb-4">
                <h4 class="text-xs font-extrabold text-teal-900 uppercase tracking-wider mb-2">2 · Apply Standards</h4>
                <p class="text-[11px] text-slate-700 mb-2">Tick any number — the LLM uses these as the ground-truth references the contract should conform to.</p>
                <div class="space-y-1.5 mb-3">
                  <label
                    v-for="opt in CONTRACTS_STANDARDS_OPTIONS"
                    :key="opt.v"
                    class="flex items-start gap-2 rounded-md px-2 py-1 cursor-pointer hover:bg-white"
                    :class="settings.contractsMode.standards.includes(opt.v) ? 'bg-white ring-1 ring-teal-300' : ''"
                    :title="opt.help"
                  >
                    <input
                      type="checkbox"
                      :checked="settings.contractsMode.standards.includes(opt.v)"
                      class="mt-1 accent-teal-600 shrink-0"
                      @change="toggleStandard(opt.v)"
                    />
                    <div class="min-w-0">
                      <p class="text-xs font-semibold text-slate-800">{{ opt.label }}</p>
                      <p class="text-[10px] text-slate-600 leading-snug">{{ opt.help }}</p>
                    </div>
                  </label>
                </div>
                <!-- Custom URLs sub-panel -->
                <div class="border-t border-teal-200 pt-3 mt-3">
                  <p class="text-[11px] font-bold text-teal-900 mb-1.5">Custom standard URLs <span class="font-normal text-slate-500">(paste one URL per row — references, company policies, additional standards)</span></p>
                  <div v-for="(url, idx) in settings.contractsMode.standardsCustomUrls" :key="idx" class="flex items-center gap-1.5 mb-1.5">
                    <input
                      type="url"
                      :value="url"
                      placeholder="https://example.com/standard.pdf"
                      class="flex-1 text-xs px-2 py-1 border border-teal-300 rounded bg-white focus:outline-none focus:border-teal-600 font-mono"
                      title="A custom standard URL (PDF, web page, policy document) the AI should treat as a reference for this contract."
                      @change="updateCustomUrl(idx, ($event.target as HTMLInputElement).value)"
                    />
                    <button
                      type="button"
                      class="px-2 py-1 text-[10px] font-bold text-rose-700 hover:bg-rose-100 border border-rose-200 rounded bg-white"
                      title="Remove this URL"
                      @click="removeCustomUrl(idx)"
                    >✕</button>
                  </div>
                  <button
                    type="button"
                    class="text-[11px] px-2 py-1 rounded bg-white border border-teal-300 text-teal-800 font-bold hover:bg-teal-50"
                    title="Append a blank URL row"
                    @click="addCustomUrl"
                  >+ Add another URL</button>
                </div>
              </div>

              <!-- AXIS 3 — Presentation -->
              <div class="rounded-xl border-2 border-teal-200 bg-teal-50/40 p-4 mb-4">
                <h4 class="text-xs font-extrabold text-teal-900 uppercase tracking-wider mb-2">3 · Presentation (audience)</h4>
                <p class="text-[11px] text-slate-700 mb-2">Pick ONE — shapes tone, vocabulary depth, citation style.</p>
                <fieldset class="space-y-1.5">
                  <legend class="sr-only">Presentation audience</legend>
                  <label
                    v-for="opt in CONTRACTS_PRESENTATION_OPTIONS"
                    :key="opt.v"
                    class="flex items-start gap-2 rounded-md px-2 py-1.5 cursor-pointer hover:bg-white"
                    :class="settings.contractsMode.presentation === opt.v ? 'bg-white ring-1 ring-teal-400' : ''"
                    :title="opt.help"
                  >
                    <input
                      type="radio"
                      :checked="settings.contractsMode.presentation === opt.v"
                      name="contractsPresentation"
                      class="mt-1 accent-teal-600"
                      @change="updateContractsMode('presentation', opt.v)"
                    />
                    <div>
                      <p class="text-xs font-semibold text-slate-800">{{ opt.label }}</p>
                      <p class="text-[10px] text-slate-600 leading-snug">{{ opt.help }}</p>
                    </div>
                  </label>
                </fieldset>
              </div>

              <!-- AXIS 4 — Purpose -->
              <div class="rounded-xl border-2 border-teal-200 bg-teal-50/40 p-4">
                <h4 class="text-xs font-extrabold text-teal-900 uppercase tracking-wider mb-2">4 · Purpose</h4>
                <p class="text-[11px] text-slate-700 mb-2">Tick any combination — the AI composes them all (e.g. Strictly Analytical + Change log = analysis plus structured diff).</p>
                <div class="space-y-1.5">
                  <label
                    v-for="opt in CONTRACTS_PURPOSE_OPTIONS"
                    :key="opt.v"
                    class="flex items-start gap-2 rounded-md px-2 py-1.5 cursor-pointer hover:bg-white"
                    :class="settings.contractsMode.purposes.includes(opt.v) ? 'bg-white ring-1 ring-teal-400' : ''"
                    :title="opt.help"
                  >
                    <input
                      type="checkbox"
                      :checked="settings.contractsMode.purposes.includes(opt.v)"
                      class="mt-1 accent-teal-600 shrink-0"
                      @change="togglePurpose(opt.v)"
                    />
                    <div>
                      <p class="text-xs font-semibold text-slate-800">{{ opt.label }}</p>
                      <p class="text-[10px] text-slate-600 leading-snug">{{ opt.help }}</p>
                    </div>
                  </label>
                </div>
              </div>

              <!-- r41 v48 (Tom Gilb 2026-06-16 verbatim "IN CONTRACT MODE,
                   THE CONTRACT AGENT IS ACTIVATED") — Activate button at the
                   bottom of the Contracts Mode section.  One click jumps to
                   the Contract Agent with the current config already applied. -->
              <div class="mt-4 p-3 rounded-xl bg-gradient-to-br from-teal-100 to-emerald-100 border-2 border-teal-300 flex items-center gap-3 flex-wrap">
                <div class="text-2xl">📋</div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-extrabold text-teal-900">In Contract Mode, the Contract Agent is activated.</p>
                  <p class="text-[11px] text-teal-800 leading-snug mt-0.5">Tom Gilb 2026-06-16 verbatim.  Click to open the Contract Agent now — your active 4-axis Contracts Mode config above applies to every parse + analysis call.</p>
                </div>
                <button
                  type="button"
                  class="px-3 py-1.5 rounded-lg text-xs font-extrabold text-white bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 shadow ring-2 ring-white/60 focus:outline-none focus:ring-4 focus:ring-teal-300"
                  title="Activate the Contract Agent (ContractHub) — closes Settings and opens the Contract Agent with the current Contracts Mode config already applied to every LLM call."
                  @click="activateContractAgent"
                >📋 Activate Contract Agent →</button>
              </div>

              <p class="text-[10px] text-slate-500 italic mt-3 border-l-2 border-teal-200 pl-3">
                These settings are read by <code class="bg-white px-1 rounded">useContractParser</code> on every parse + analysis call.  Defaults: Sharpening on · Planguage + Plain English standards · Managers audience · Strictly Analytical purpose (safe — no modifications unless you opt into Re-write or Creative Suggestions).
              </p>
            </section>

            <!-- ── AI Assistance ──────────────────────────────────────────── -->
            <section v-show="activeSectionId === 'ai'">
              <h3 class="text-sm font-bold text-slate-800 mb-1">AI Assistance</h3>
              <p class="text-[11px] text-slate-500 mb-4">
                AI-Max SUPREME principle (Tom 2026-06-03): <em>"Maximize AI assistance everywhere... WE want impressive help, not simplified ai access."</em>
                All AI work happens via Claudian or deterministic spec-derivation — never via in-app API call.
              </p>

              <!-- OFFLINE MODE — Tom 2026-06-03: "I would like to be about to run
                   my app successfully even when you claudian lock me out". When
                   ON: all AI / Claudian calls disabled; app uses deterministic
                   logic + manual entry + previously-cached data only.  Sits at
                   the TOP of the AI section because it's the master kill-switch. -->
              <div class="rounded-xl border-2 p-3 mb-4"
                :class="settings.offlineMode ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-slate-50'"
              >
                <label class="flex items-start gap-2 cursor-pointer"
                  title="When ON: disables every AI/Claudian call across the SEM App. The app remains fully usable for manual planning and review — Sharp Interview shows typed-only answers, FEED ME! reads existing data, no Evo plan generation. Use this when Claudian is rate-limited / locked out / offline. Tom 2026-06-03 standing requirement: SEM App must work without AI."
                >
                  <input
                    type="checkbox"
                    :checked="settings.offlineMode"
                    class="mt-1 accent-amber-600 h-4 w-4"
                    @change="set('offlineMode', !settings.offlineMode); if (settings.offlineMode) set('aiAssistanceLevel', 'off')"
                  />
                  <div>
                    <p class="text-sm font-bold text-amber-900">
                      <span aria-hidden="true">🛟</span> Offline / Local-Only Mode
                      <span class="text-[9px] uppercase font-bold px-1 py-px rounded bg-amber-200 text-amber-800 ml-1">trust-rebuild</span>
                    </p>
                    <p class="text-[11px] text-slate-700 mt-0.5">
                      Master kill-switch: disables every AI / Claudian call across the SEM App so it works when Claudian is rate-limited, locked out, or unreachable. Manual entry, deterministic logic, and previously-cached data remain fully usable.  Tom 2026-06-03 standing requirement.
                    </p>
                    <p v-if="settings.offlineMode" class="text-[11px] text-amber-800 font-semibold mt-1.5">
                      ✓ AI is currently OFF.  Sharp Interview shows typed answers only; FEED ME! reads existing data; no Evo plan generation; no Claudian prompts copied to clipboard.
                    </p>
                  </div>
                </label>
              </div>

              <div class="space-y-4">
                <fieldset>
                  <legend class="text-xs font-bold uppercase tracking-wide text-fuchsia-700 mb-1">AI Level
                    <span v-if="settings.offlineMode" class="text-[9px] font-normal text-amber-700 normal-case ml-1">(forced OFF — disable Offline Mode above to change)</span>
                  </legend>
                  <div class="flex gap-2 flex-wrap">
                    <button
                      v-for="lvl in ['off', 'standard', 'maximum'] as const"
                      :key="lvl"
                      type="button"
                      class="px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors capitalize"
                      :class="settings.aiAssistanceLevel === lvl
                        ? 'bg-fuchsia-600 text-white border-fuchsia-700'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'"
                      :title="lvl === 'off'
                        ? 'No AI suggestions or auto-derivations anywhere.  Manual input only.'
                        : lvl === 'standard'
                          ? 'AI suggestions on opt-in surfaces only.'
                          : 'AI suggestions, defaults, and derivations on every input surface (default).'"
                      @click="set('aiAssistanceLevel', lvl)"
                    >{{ lvl }}{{ lvl === 'maximum' ? ' (default)' : '' }}</button>
                  </div>
                </fieldset>

                <label class="flex items-start gap-2 cursor-pointer" :title="'Show the &quot;Why this matters&quot; rationale below every AI-derived suggestion.'">
                  <input type="checkbox" :checked="settings.showAIRationales" class="mt-1 accent-fuchsia-600" @change="set('showAIRationales', !settings.showAIRationales)" />
                  <div>
                    <p class="text-sm font-semibold text-slate-800">Show AI rationales inline</p>
                    <p class="text-[11px] text-slate-600">Below every suggestion, show the "Why this matters" explanation grounded in Evo theory.</p>
                  </div>
                </label>

                <label class="flex items-start gap-2 cursor-pointer" :title="'When opening Sharp Interview, derive suggestions from the current plan (v2 — not yet live).'">
                  <input type="checkbox" :checked="settings.autoDerivePlanAwareSuggestions" class="mt-1 accent-fuchsia-600" @change="set('autoDerivePlanAwareSuggestions', !settings.autoDerivePlanAwareSuggestions)" />
                  <div>
                    <p class="text-sm font-semibold text-slate-800">Auto-derive plan-aware suggestions <span class="text-[9px] uppercase font-bold px-1 py-px rounded bg-amber-100 text-amber-700 ml-1">v2 — not yet live</span></p>
                    <p class="text-[11px] text-slate-600">Derive Sharp Interview suggestions from the live plan (step.linkedSolutions, V. status, cycle length) instead of generic templates.</p>
                  </div>
                </label>

                <fieldset>
                  <legend class="text-xs font-bold uppercase tracking-wide text-fuchsia-700 mb-1">Suggestion count per question</legend>
                  <div class="flex gap-2 flex-wrap">
                    <button
                      v-for="n in [2, 3, 5, 10] as const"
                      :key="n"
                      type="button"
                      class="px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors"
                      :class="settings.sharpSuggestionCount === n
                        ? 'bg-fuchsia-600 text-white border-fuchsia-700'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'"
                      :title="`Show ${n} AI-suggested answers per Sharp Interview question (default 3).`"
                      @click="set('sharpSuggestionCount', n)"
                    >{{ n }}{{ n === 3 ? ' (default)' : '' }}</button>
                  </div>
                </fieldset>

                <fieldset>
                  <legend class="text-xs font-bold uppercase tracking-wide text-fuchsia-700 mb-1">Default Sharp Interview selection mode</legend>
                  <div class="flex gap-2 flex-wrap">
                    <button
                      v-for="m in [
                        { v: 'mixed' as const,       label: 'Mixed (default)' },
                        { v: 'all' as const,         label: 'All' },
                        { v: 'typed-only' as const,  label: 'Typed only' },
                        { v: 'ticked-only' as const, label: 'Ticked only' },
                      ]"
                      :key="m.v"
                      type="button"
                      class="px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors"
                      :class="settings.defaultSharpSelectionMode === m.v
                        ? 'bg-fuchsia-600 text-white border-fuchsia-700'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'"
                      :title="`Default mode applied to new Sharp Interview questions.`"
                      @click="set('defaultSharpSelectionMode', m.v)"
                    >{{ m.label }}</button>
                  </div>
                </fieldset>
              </div>
            </section>

            <!-- ════════════════════════════════════════════════════════════════
                 r41 v29 — ILLUMINATION AI defaults (Tom Gilb 2026-06-15 verbatim:
                 *"To Settings Menu (Illumination defaults for all users, before
                 personal preferences)"*).  These are the BASELINE defaults
                 applied to the ⌘I picker for everyone.  When the Phase 3
                 per-Owner/Planner preferences ship, they OVERRIDE these.
                 ════════════════════════════════════════════════════════════════ -->
            <section v-show="activeSectionId === 'illumination'">
              <h3 class="text-sm font-bold text-slate-800 mb-1">Illumination AI — defaults for everyone</h3>
              <p class="text-[11px] text-slate-500 mb-4">
                Tom 2026-06-15 verbatim: <em>"Illumination defaults for all users, before personal preferences"</em>. These settings shape the ⌘I picker for every user as a BASELINE.  Once Phase 3 ships, each Plan Owner / Planner can set their own personal preferences that override these.
              </p>

              <div class="rounded-xl border-2 border-amber-200 bg-amber-50/40 p-3 mb-4 space-y-3">

                <!-- Default tab -->
                <fieldset>
                  <legend class="text-xs font-bold text-amber-900">Default tab on open</legend>
                  <p class="text-[10px] text-slate-500 mb-1.5">Which tab the ⌘I picker lands on when the planner has no last-used tab yet.</p>
                  <select
                    :value="settings.illuminationDefaultTab"
                    class="text-xs px-2 py-1 border-2 border-amber-300 rounded bg-white"
                    title="Pick the tab the ⌘I picker opens to on a fresh session.  Default 📖 Define — the glance card with short definition."
                    @change="set('illuminationDefaultTab', ($event.target as HTMLSelectElement).value as Settings['illuminationDefaultTab'])"
                  >
                    <option value="define">📖 Define — short definition + glance card</option>
                    <option value="diagram">📐 Diagram — ontology diagram</option>
                    <option value="pictures">🎨 Pictures — illustration carousel</option>
                    <option value="universe">🌌 Universe — 663-concept constellation map</option>
                    <option value="books">📚 Books — kaleidoscope of Tom's published corpus</option>
                    <option value="twin">🧠 Ask Twin — ontology-backed Twin Consultant search</option>
                  </select>
                </fieldset>

                <!-- Show glance card -->
                <label class="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    :checked="settings.illuminationShowGlanceCard"
                    class="mt-0.5"
                    title="When on, the Define tab opens with a short definition + 💡 Yes, want to know more + ✓ Sharp Enough CTAs.  When off, the full Glossary entry is visible immediately."
                    @change="set('illuminationShowGlanceCard', ($event.target as HTMLInputElement).checked)"
                  />
                  <div class="text-xs">
                    <div class="font-bold text-amber-900">Show the GLANCE card first</div>
                    <div class="text-[10px] text-slate-600">One short definition + "Want to know more?" + "Sharp Enough" — before the full entry reveals.  Tom Gilb 2026-06-15: <em>"we give one thing initially"</em>.</div>
                  </div>
                </label>

                <!-- Auto-fire Twin -->
                <label class="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    :checked="settings.illuminationAutoFireTwin"
                    class="mt-0.5"
                    title="When on, the Tom Gilb Consultant Twin auto-fires 800 ms after the user pauses typing.  Composes with r93ppp Twin-as-Destination (drives Twin discovery)."
                    @change="set('illuminationAutoFireTwin', ($event.target as HTMLInputElement).checked)"
                  />
                  <div class="text-xs">
                    <div class="font-bold text-amber-900">Auto-fire Twin Consultant search</div>
                    <div class="text-[10px] text-slate-600">800 ms after the user pauses typing — Twin returns ontology-backed concepts with cite-back URLs.</div>
                  </div>
                </label>

                <!-- Always diagram first -->
                <label class="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    :checked="settings.illuminationAlwaysDiagramFirst"
                    class="mt-0.5"
                    title='Tom Gilb 2026-06-15 example preference verbatim: "Always Give Me An Ontology Diagram". When on, the ⌘I picker auto-switches to the 📐 Diagram tab whenever a Glossary entry has a mermaid block — regardless of last-used tab.'
                    @change="set('illuminationAlwaysDiagramFirst', ($event.target as HTMLInputElement).checked)"
                  />
                  <div class="text-xs">
                    <div class="font-bold text-amber-900">Always show ontology diagram first</div>
                    <div class="text-[10px] text-slate-600">Tom verbatim example: <em>"Always Give Me An Ontology Diagram"</em>.  Overrides the default tab when the concept has a diagram.</div>
                  </div>
                </label>

                <!-- Depth -->
                <fieldset>
                  <legend class="text-xs font-bold text-amber-900">Illumination depth</legend>
                  <p class="text-[10px] text-slate-500 mb-1.5">How much to reveal by default.</p>
                  <div class="flex flex-wrap gap-2">
                    <button
                      v-for="d in ILLUMINATION_DEPTH_OPTIONS"
                      :key="d.v"
                      type="button"
                      class="text-xs px-2 py-1 rounded border-2 font-semibold"
                      :class="settings.illuminationDepth === d.v
                        ? 'bg-amber-600 text-white border-amber-700'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-amber-50'"
                      :title="d.tip"
                      @click="set('illuminationDepth', d.v as Settings['illuminationDepth'])"
                    >{{ d.label }}</button>
                  </div>
                </fieldset>

                <!-- Include history -->
                <label class="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    :checked="settings.illuminationIncludeHistory"
                    class="mt-0.5"
                    title='Tom Gilb 2026-06-15 example preference verbatim: "I like historical background". When on, Twin AI prompts ask the Twin to include relevant historical context (Planguage evolution, prior naming, Gilb-book lineage) in its response.'
                    @change="set('illuminationIncludeHistory', ($event.target as HTMLInputElement).checked)"
                  />
                  <div class="text-xs">
                    <div class="font-bold text-amber-900">Include historical background in Twin answers</div>
                    <div class="text-[10px] text-slate-600">Tom verbatim example: <em>"I like historical background"</em>.  When on, Twin responses include Planguage evolution + prior naming + Gilb-book lineage where relevant.</div>
                  </div>
                </label>
              </div>

              <!-- Footnote — Phase 3 preview -->
              <div class="text-[11px] text-slate-600 italic border-l-2 border-amber-300 pl-3">
                <strong class="text-amber-900">Coming next (Phase 3):</strong> per-Plan-Owner and per-Planner personal preferences that override these defaults for individual users.  Each Owner / Planner will set their own preferences in an Illumination Settings panel inside the ⌘I picker (⚙ pin in the picker header).  These global defaults are the BASELINE that personal preferences will sit on top of.
              </div>
            </section>

            <!-- ── Sharpening Processes ──────────────────────────────────── -->
            <section v-show="activeSectionId === 'sharpening'">
              <h3 class="text-sm font-bold text-slate-800 mb-1">Sharpening Processes</h3>
              <p class="text-[11px] text-slate-500 mb-4">
                Tom 2026-06-03 verbatim: <em>"Sharpening Processes (SEM and EVO separately).  Options 1. Collect Project Data on all Answers, 2. Apply Feedback data to next sharpening (to make it smarter and more tailored to the Plan and Planner preferences)"</em>
              </p>

              <!-- SEM Sharpening (Stage 3 — Sharpen the spec) -->
              <div class="rounded-xl border-2 border-amber-200 bg-amber-50/40 p-3 mb-4">
                <h4 class="text-xs font-bold uppercase tracking-wide text-amber-800 mb-2">SEM Sharpening <span class="text-[10px] font-normal normal-case text-amber-700">(Stage 3 — spec sharpening)</span></h4>
                <label class="flex items-start gap-2 cursor-pointer mb-2" title="Capture every answer + every accept/reject decision in this project's sharpening, so future sharpening sessions can learn from the data.">
                  <input type="checkbox" :checked="settings.semSharpeningCollectData" class="mt-1 accent-amber-600" @change="set('semSharpeningCollectData', !settings.semSharpeningCollectData)" />
                  <div>
                    <p class="text-sm font-semibold text-slate-800">Collect Project Data on all Answers</p>
                    <p class="text-[11px] text-slate-600">Records typed answers, ticked suggestions, accept/reject decisions per (project, spec entry, question).  Data stays local; not telemetry.</p>
                  </div>
                </label>
                <label class="flex items-start gap-2 cursor-pointer" title="Feed the collected sharpening history back into the suggestion generator, so subsequent sharpening sessions are tailored to the plan's history and the Planner's preferences.">
                  <input type="checkbox" :checked="settings.semSharpeningApplyFeedback" class="mt-1 accent-amber-600" @change="set('semSharpeningApplyFeedback', !settings.semSharpeningApplyFeedback)" />
                  <div>
                    <p class="text-sm font-semibold text-slate-800">Apply Feedback data to next sharpening</p>
                    <p class="text-[11px] text-slate-600">Subsequent sharpening sessions read past answers + preferences and adapt suggestions accordingly (smarter, more tailored to this Plan + Planner).</p>
                  </div>
                </label>
              </div>

              <!-- Evo Sharpening (Sharpen Next Step — the new Sharp Interview) -->
              <div class="rounded-xl border-2 border-rose-200 bg-rose-50/40 p-3">
                <h4 class="text-xs font-bold uppercase tracking-wide text-rose-800 mb-2">Evo Sharpening <span class="text-[10px] font-normal normal-case text-rose-700">(Sharpen Next Step — the Evo Sharp Interview, 12 categories × 36 questions)</span></h4>
                <label class="flex items-start gap-2 cursor-pointer mb-2" title="Capture every answer + every ticked suggestion + every selection-mode choice across Evo Sharpening for this project.">
                  <input type="checkbox" :checked="settings.evoSharpeningCollectData" class="mt-1 accent-rose-600" @change="set('evoSharpeningCollectData', !settings.evoSharpeningCollectData)" />
                  <div>
                    <p class="text-sm font-semibold text-slate-800">Collect Project Data on all Answers</p>
                    <p class="text-[11px] text-slate-600">Records typed Planner answers, ticked AI suggestions, selection modes per (project, step, question).  Data stays local.</p>
                  </div>
                </label>
                <label class="flex items-start gap-2 cursor-pointer" title="Use the collected Evo Sharp Interview history to make the next interview's suggestions smarter and tailored to this plan + this planner's pattern.">
                  <input type="checkbox" :checked="settings.evoSharpeningApplyFeedback" class="mt-1 accent-rose-600" @change="set('evoSharpeningApplyFeedback', !settings.evoSharpeningApplyFeedback)" />
                  <div>
                    <p class="text-sm font-semibold text-slate-800">Apply Feedback data to next sharpening</p>
                    <p class="text-[11px] text-slate-600">Subsequent Sharp Interview sessions adapt suggestions to the patterns of past answers — fewer rejected suggestions, more relevant prompts, planner-voice-aware.</p>
                  </div>
                </label>
              </div>

              <p class="text-[10px] text-slate-400 mt-3 italic">Default: all four ON.  Per AI-Max principle (default to maximum helpfulness, user can opt out).</p>
            </section>

            <!-- ── Telemetry ──────────────────────────────────────────────── -->
            <section v-show="activeSectionId === 'telemetry'">
              <h3 class="text-sm font-bold text-slate-800 mb-1">Privacy &amp; Telemetry</h3>
              <p class="text-[11px] text-slate-500 mb-4">
                Tom 2026-06-03 explicitly named two endpoints: <em>"collect maximum feedback data"</em> and <em>"Do not collect any feedback data"</em>.  Defaults to <strong>None</strong> — privacy by default.
              </p>

              <fieldset class="space-y-2 mb-4">
                <legend class="text-xs font-bold uppercase tracking-wide text-slate-700 mb-1">Telemetry level</legend>
                <label
                  v-for="opt in TELEMETRY_OPTIONS"
                  :key="opt.v"
                  class="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 cursor-pointer hover:bg-slate-50"
                  :class="settings.telemetryLevel === opt.v ? 'border-slate-400 bg-slate-100/60' : ''"
                  :title="opt.help"
                >
                  <input
                    type="radio"
                    :checked="settings.telemetryLevel === opt.v"
                    name="telemetryLevel"
                    class="mt-1 accent-slate-700"
                    @change="set('telemetryLevel', opt.v)"
                  />
                  <div>
                    <p class="text-sm font-semibold text-slate-800">{{ opt.label }}</p>
                    <p class="text-[11px] text-slate-600">{{ opt.help }}</p>
                  </div>
                </label>
              </fieldset>

              <label class="flex items-start gap-2 cursor-pointer mb-2" :title="'Send anonymous error reports when the app crashes.  Separate from telemetry.'">
                <input type="checkbox" :checked="settings.allowErrorReports" class="mt-1 accent-slate-700" @change="set('allowErrorReports', !settings.allowErrorReports)" />
                <p class="text-sm text-slate-800">Allow anonymous error reports <span class="text-[11px] text-slate-500">(separate from telemetry)</span></p>
              </label>
              <label class="flex items-start gap-2 cursor-pointer" :title="'Capture session screen recordings for debugging.  Very intrusive — opt-in only.'">
                <input type="checkbox" :checked="settings.allowSessionRecordings" class="mt-1 accent-slate-700" @change="set('allowSessionRecordings', !settings.allowSessionRecordings)" />
                <p class="text-sm text-slate-800">Allow session recordings for debugging <span class="text-[11px] text-amber-700">(intrusive — opt-in only)</span></p>
              </label>
            </section>

            <!-- ── Evo Defaults ───────────────────────────────────────────── -->
            <section v-show="activeSectionId === 'evo'">
              <h3 class="text-sm font-bold text-slate-800 mb-3">Evo Defaults</h3>

              <fieldset class="mb-4">
                <legend class="text-xs font-bold uppercase tracking-wide text-amber-700 mb-1">Default cycle length for new plans</legend>
                <div class="flex gap-2 flex-wrap">
                  <button
                    v-for="cl in [
                      { v: 'day' as const,     label: 'Day (~8h)' },
                      { v: 'week' as const,    label: 'Week (~40h, default)' },
                      { v: 'month' as const,   label: 'Month (~160h)' },
                      { v: 'quarter' as const, label: 'Quarter (~480h)' },
                    ]"
                    :key="cl.v"
                    type="button"
                    class="px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors"
                    :class="settings.defaultCycleLength === cl.v
                      ? 'bg-amber-600 text-white border-amber-700'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'"
                    :title="`Default Evo cycle length applied to new plans.  Overridable per-plan via EvoCycleLengthPicker.`"
                    @click="set('defaultCycleLength', cl.v)"
                  >{{ cl.label }}</button>
                </div>
              </fieldset>

              <label class="block mb-3" :title="'Stamped as reviewedBy when you approve / reject FEED ME! actions.'">
                <span class="text-sm font-semibold text-slate-800">Default reviewer name</span>
                <input type="text" :value="settings.defaultReviewerName" class="mt-1 w-64 rounded border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400" @input="(e) => set('defaultReviewerName', (e.target as HTMLInputElement).value)" />
              </label>

              <label class="block mb-3" :title="'How many days after a step delivery to capture lagging measures (FEED ME! Last Step in Paris).'">
                <span class="text-sm font-semibold text-slate-800">Default lagging-measurement window (days)</span>
                <input type="number" :value="settings.defaultLaggingWindowDays" min="1" max="90" class="mt-1 w-24 rounded border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400" @input="(e) => set('defaultLaggingWindowDays', parseInt((e.target as HTMLInputElement).value) || 7)" />
              </label>

              <label class="flex items-start gap-2 cursor-pointer mb-3" :title="'When a new Evo Step is generated, automatically open the Sharpen Next Step interview for it.'">
                <input type="checkbox" :checked="settings.autoOpenSharpOnNewStep" class="mt-1 accent-amber-600" @change="set('autoOpenSharpOnNewStep', !settings.autoOpenSharpOnNewStep)" />
                <p class="text-sm text-slate-800">Auto-open Sharpen Next Step for new steps</p>
              </label>

              <fieldset>
                <legend class="text-xs font-bold uppercase tracking-wide text-amber-700 mb-1">Default risk tolerance (for Skunkworks)</legend>
                <div class="flex gap-2 flex-wrap">
                  <button
                    v-for="r in ['low', 'medium', 'high'] as const"
                    :key="r"
                    type="button"
                    class="px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors capitalize"
                    :class="settings.defaultRiskTolerance === r
                      ? 'bg-amber-600 text-white border-amber-700'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'"
                    :title="`Default risk tolerance applied to Skunkworks idea generation prompts.`"
                    @click="set('defaultRiskTolerance', r)"
                  >{{ r }}{{ r === 'medium' ? ' (default)' : '' }}</button>
                </div>
              </fieldset>
            </section>

            <!-- ── Visualization ──────────────────────────────────────────── -->
            <section v-show="activeSectionId === 'visual'">
              <h3 class="text-sm font-bold text-slate-800 mb-3">Visualization</h3>

              <div class="space-y-4">
                <fieldset>
                  <legend class="text-xs font-bold uppercase tracking-wide text-emerald-700 mb-1">Theme</legend>
                  <div class="flex gap-2 flex-wrap">
                    <button v-for="t in ['light', 'dark', 'auto'] as const" :key="t" type="button" class="px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors capitalize" :class="settings.theme === t ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'" :title="`Theme: ${t === 'auto' ? 'follows system' : t}`" @click="set('theme', t)">{{ t }}{{ t === 'auto' ? ' (default)' : '' }}</button>
                  </div>
                </fieldset>

                <fieldset>
                  <legend class="text-xs font-bold uppercase tracking-wide text-emerald-700 mb-1">Density</legend>
                  <div class="flex gap-2 flex-wrap">
                    <button v-for="d in ['compact', 'comfortable', 'spacious'] as const" :key="d" type="button" class="px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors capitalize" :class="settings.density === d ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'" :title="`Padding density across tables, lists, and panels.`" @click="set('density', d)">{{ d }}{{ d === 'comfortable' ? ' (default)' : '' }}</button>
                  </div>
                </fieldset>

                <fieldset>
                  <legend class="text-xs font-bold uppercase tracking-wide text-emerald-700 mb-1">Animation level</legend>
                  <div class="flex gap-2 flex-wrap">
                    <button v-for="a in ['full', 'reduced', 'none'] as const" :key="a" type="button" class="px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors capitalize" :class="settings.animationLevel === a ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'" :title="`Animation level — reduced respects prefers-reduced-motion.`" @click="set('animationLevel', a)">{{ a }}{{ a === 'full' ? ' (default)' : '' }}</button>
                  </div>
                </fieldset>

                <fieldset>
                  <legend class="text-xs font-bold uppercase tracking-wide text-emerald-700 mb-1">Font scale</legend>
                  <div class="flex gap-2 flex-wrap">
                    <button v-for="n in [90, 100, 110, 125] as const" :key="n" type="button" class="px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors" :class="settings.fontScalePercent === n ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'" :title="`Font scale ${n}%.`" @click="set('fontScalePercent', n)">{{ n }}%{{ n === 100 ? ' (default)' : '' }}</button>
                  </div>
                </fieldset>

                <fieldset>
                  <legend class="text-xs font-bold uppercase tracking-wide text-emerald-700 mb-1">Colour-blindness mode</legend>
                  <div class="flex gap-2 flex-wrap">
                    <button v-for="c in ['none', 'deuteranopia', 'protanopia', 'tritanopia'] as const" :key="c" type="button" class="px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors capitalize" :class="settings.colorBlindMode === c ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'" :title="`Colour filter for colour-blind users.`" @click="set('colorBlindMode', c)">{{ c }}</button>
                  </div>
                </fieldset>
              </div>
            </section>

            <!-- ── Workflow ────────────────────────────────────────────────── -->
            <section v-show="activeSectionId === 'workflow'">
              <h3 class="text-sm font-bold text-slate-800 mb-3">Workflow</h3>
              <label class="block mb-3" :title="'Seconds between auto-saves (0 = manual save only).'">
                <span class="text-sm font-semibold text-slate-800">Auto-save interval (seconds)</span>
                <input type="number" :value="settings.autoSaveIntervalSeconds" min="0" max="3600" class="mt-1 w-24 rounded border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-sky-400" @input="(e) => set('autoSaveIntervalSeconds', parseInt((e.target as HTMLInputElement).value) || 0)" />
                <span class="text-[11px] text-slate-500 ml-2">(0 = manual only)</span>
              </label>
              <label class="flex items-start gap-2 cursor-pointer mb-2" :title="'Confirm before destructive ops (Clear All, Reset, Discard).'">
                <input type="checkbox" :checked="settings.confirmBeforeDestructive" class="mt-1 accent-sky-600" @change="set('confirmBeforeDestructive', !settings.confirmBeforeDestructive)" />
                <p class="text-sm text-slate-800">Confirm before destructive operations</p>
              </label>
              <label class="flex items-start gap-2 cursor-pointer mb-2" :title="'Show toast notifications on save / completion / errors.'">
                <input type="checkbox" :checked="settings.showToasts" class="mt-1 accent-sky-600" @change="set('showToasts', !settings.showToasts)" />
                <p class="text-sm text-slate-800">Show toast notifications</p>
              </label>
              <label class="flex items-start gap-2 cursor-pointer" :title="'Remind me to capture lagging measures (~7d after step delivery).'">
                <input type="checkbox" :checked="settings.enableLaggingMeasureReminders" class="mt-1 accent-sky-600" @change="set('enableLaggingMeasureReminders', !settings.enableLaggingMeasureReminders)" />
                <p class="text-sm text-slate-800">Enable lagging-measure reminders</p>
              </label>
            </section>

            <!-- ── Export ──────────────────────────────────────────────────── -->
            <section v-show="activeSectionId === 'export'">
              <h3 class="text-sm font-bold text-slate-800 mb-3">Export</h3>

              <!-- r41 v58 (Tom Gilb 2026-06-16) — Spec export format choice.
                   Tom verbatim: *"You could offer a choice of formats:
                   Default: exactly as in the display, 2 A Condensed Summary
                   (without supporting details like sources and justifications),
                   3. A Table format with each spec on a line.  If no choice is
                   made the default is 1, as in display."* -->
              <fieldset class="mb-4 rounded-lg border-2 border-violet-200 bg-violet-50/40 p-3">
                <legend class="text-xs font-bold uppercase tracking-wide text-violet-700 mb-1 px-1">Spec export detail level</legend>
                <p class="text-[11px] text-slate-600 mb-2 leading-snug">
                  How much of the spec to include when you Save Plan, Email Plan, or Copy Spec.  Default <b>Full</b> matches exactly what you see in the SEM App display.
                </p>
                <div class="flex gap-2 flex-wrap">
                  <button
                    v-for="opt in ([
                      { v: 'full',      label: 'Full',      hint: '1 · Default — exactly as in display (Ambition Level, Source, Rationale, Justifications, Risks, all detail).' },
                      { v: 'condensed', label: 'Condensed', hint: '2 · Summary without supporting details (no Sources, no Rationale, no Justifications).' },
                      { v: 'table',     label: 'Table',     hint: '3 · One row per entry, columnar — like the Object Templates reference table.' },
                    ] as const)"
                    :key="opt.v"
                    type="button"
                    class="px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors"
                    :class="settings.specExportFormat === opt.v ? 'bg-violet-600 text-white border-violet-700' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'"
                    :title="opt.hint"
                    @click="set('specExportFormat', opt.v)"
                  >{{ opt.label }}{{ opt.v === 'full' ? ' (default)' : '' }}</button>
                </div>
              </fieldset>

              <fieldset class="mb-4">
                <legend class="text-xs font-bold uppercase tracking-wide text-pink-700 mb-1">Default export format</legend>
                <div class="flex gap-2 flex-wrap">
                  <button v-for="f in ['html', 'markdown', 'json', 'tsv'] as const" :key="f" type="button" class="px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors uppercase" :class="settings.defaultExportFormat === f ? 'bg-pink-600 text-white border-pink-700' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'" :title="`Default format for export buttons.`" @click="set('defaultExportFormat', f)">{{ f }}{{ f === 'html' ? ' (default)' : '' }}</button>
                </div>
              </fieldset>
              <label class="flex items-start gap-2 cursor-pointer mb-3" :title="'Include audit trail (Source + Reason) in every export.'">
                <input type="checkbox" :checked="settings.includeAuditTrailInExports" class="mt-1 accent-pink-600" @change="set('includeAuditTrailInExports', !settings.includeAuditTrailInExports)" />
                <p class="text-sm text-slate-800">Always include audit trail (Source + Reason) in exports</p>
              </label>
              <label class="block" :title="'Default sender address for email exports.'">
                <span class="text-sm font-semibold text-slate-800">Default email sender</span>
                <input type="email" :value="settings.defaultEmailFrom" class="mt-1 w-72 rounded border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-pink-400" @input="(e) => set('defaultEmailFrom', (e.target as HTMLInputElement).value)" />
              </label>
            </section>

            <!-- ── Collaboration ──────────────────────────────────────────── -->
            <section v-show="activeSectionId === 'collab'">
              <h3 class="text-sm font-bold text-slate-800 mb-3">Collaboration</h3>
              <label class="block mb-3" :title="'Default plan-owner name stamped onto new plans.'">
                <span class="text-sm font-semibold text-slate-800">Default plan owner</span>
                <input type="text" :value="settings.defaultPlanOwner" class="mt-1 w-72 rounded border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-400" @input="(e) => set('defaultPlanOwner', (e.target as HTMLInputElement).value)" />
              </label>
              <fieldset>
                <legend class="text-xs font-bold uppercase tracking-wide text-cyan-700 mb-1">Twin (Kai's industrial app) sharing</legend>
                <div class="flex gap-2 flex-wrap">
                  <button v-for="m in [
                    { v: 'manual' as const, label: 'Manual (default)' },
                    { v: 'auto' as const,   label: 'Auto-share' },
                    { v: 'off' as const,    label: 'Off' },
                  ]" :key="m.v" type="button" class="px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors" :class="settings.twinShareMode === m.v ? 'bg-cyan-600 text-white border-cyan-700' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'" :title="`How to share plans with Tom's Twin (Kai's industrial app).`" @click="set('twinShareMode', m.v)">{{ m.label }}</button>
                </div>
              </fieldset>
            </section>

            <!-- ── Diagnostics ────────────────────────────────────────────── -->
            <section v-show="activeSectionId === 'diagnostics'">
              <h3 class="text-sm font-bold text-slate-800 mb-3">Diagnostics</h3>
              <label class="flex items-start gap-2 cursor-pointer mb-2" :title="'Show developer hints in tooltips (e.g., which composable backs each panel).'">
                <input type="checkbox" :checked="settings.showDevHints" class="mt-1 accent-slate-700" @change="set('showDevHints', !settings.showDevHints)" />
                <p class="text-sm text-slate-800">Show developer hints in tooltips</p>
              </label>
              <label class="flex items-start gap-2 cursor-pointer" :title="'Log AI-suggestion resolution failures to console (helps debug LLM drift).'">
                <input type="checkbox" :checked="settings.logAIResolutionFailures" class="mt-1 accent-slate-700" @change="set('logAIResolutionFailures', !settings.logAIResolutionFailures)" />
                <p class="text-sm text-slate-800">Log AI-suggestion resolution failures to console</p>
              </label>
            </section>

            <!-- ── Strategy Mode ──────────────────────────────────────────── -->
            <section v-show="activeSectionId === 'strategy'">
              <h3 class="text-sm font-bold text-slate-800 mb-1">Strategy Mode</h3>
              <p class="text-[11px] text-slate-500 mb-1">
                Tom Gilb 2026-06-09: <em>"Purpose: to tune SEM to the needs and culture of organizational strategic planning."</em>
              </p>
              <p class="text-[11px] text-slate-500 mb-4">
                SEM Official Tag: <strong>Strategy</strong>
                · Long Name: <em>SEM Design for Organizational Strategy Planning and Execution</em>
                · Primary Gilb texts: <strong>Strategy-Ring</strong>, <strong>Value Improvement</strong>
              </p>

              <!-- Master toggle -->
              <div
                class="rounded-xl border-2 p-3 mb-4"
                :class="settings.strategyMode ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-slate-50'"
              >
                <label
                  class="flex items-start gap-2 cursor-pointer"
                  title="Enable Strategy Management mode — display labels switch to strategic-planning vocabulary. Underlying Planguage data model is unchanged (Twin-portable). Tom Gilb 2026-06-09."
                >
                  <input
                    type="checkbox"
                    :checked="settings.strategyMode"
                    class="mt-1 accent-blue-600 h-4 w-4"
                    @change="set('strategyMode', !settings.strategyMode)"
                  />
                  <div>
                    <p class="text-sm font-bold text-blue-900">
                      <span aria-hidden="true">🎯</span> Strategy Management Mode
                      <span
                        v-if="settings.strategyMode"
                        class="text-[9px] uppercase font-bold px-1 py-px rounded bg-blue-200 text-blue-800 ml-1"
                      >ON</span>
                    </p>
                    <p class="text-[11px] text-slate-700 mt-0.5">
                      Overrides display terminology so Values show as Strategic Objectives,
                      Solutions as Strategies, Evo Steps as Strategic Value Delivery Increments,
                      and steward role names in the organization's strategic vocabulary.
                      The Planguage data model is UNCHANGED — fully Twin-portable.
                    </p>
                    <p v-if="settings.strategyMode" class="text-[11px] text-blue-800 font-semibold mt-1.5">
                      ✓ Strategy Mode active — all SEM surfaces now use strategic terminology.
                    </p>
                  </div>
                </label>
              </div>

              <!-- Terminology preview + customization -->
              <div
                class="rounded-lg border border-blue-200 bg-white p-3"
                :class="settings.strategyMode ? '' : 'opacity-50 pointer-events-none'"
              >
                <h4 class="text-xs font-bold uppercase tracking-wide text-blue-700 mb-2">
                  Terminology Overrides
                  <span class="text-[10px] font-normal normal-case text-slate-500 ml-1">
                    (editable · effective only when Strategy Mode is ON)
                  </span>
                </h4>

                <!-- Term rows — Planguage standard → Strategy override input -->
                <div class="space-y-2">
                  <div
                    v-for="termRow in [
                      { key: 'valueTerm' as const,         standard: 'Value (singular)',       placeholder: 'Strategic Objective' },
                      { key: 'valuesTermPlural' as const,  standard: 'Values (plural)',         placeholder: 'Strategic Objectives' },
                      { key: 'solutionTerm' as const,      standard: 'Solution (singular)',     placeholder: 'Strategy' },
                      { key: 'solutionsTermPlural' as const, standard: 'Solutions / Design sector', placeholder: 'Strategies' },
                      { key: 'evoStepTerm' as const,       standard: 'Evo Step (singular)',     placeholder: 'Strategic Value Delivery Increment' },
                      { key: 'evoStepsTermPlural' as const, standard: 'Evo Steps (plural)',     placeholder: 'Strategic Value Delivery Increments' },
                      { key: 'evoFeedbackTerm' as const,   standard: 'Evo Feedback Measures',  placeholder: 'Strategic Results' },
                      { key: 'ownerRoleTerm' as const,     standard: 'Owner role',              placeholder: 'Strategy Responsible' },
                      { key: 'plannerRoleTerm' as const,   standard: 'Planner role',            placeholder: 'Strategy Planner' },
                      { key: 'scribeRoleTerm' as const,    standard: 'Scribe role',             placeholder: 'Results Responsible' },
                    ]"
                    :key="termRow.key"
                    class="flex items-center gap-2"
                  >
                    <span class="w-44 shrink-0 text-[11px] text-slate-500 font-medium">{{ termRow.standard }}</span>
                    <span class="text-[10px] text-slate-400 font-mono shrink-0">→</span>
                    <input
                      type="text"
                      :value="settings.strategyTerminology[termRow.key]"
                      :placeholder="termRow.placeholder"
                      class="flex-1 rounded border border-slate-300 px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                      :title="`Override display label for '${termRow.standard}' when Strategy Mode is active`"
                      @input="(e) => setTerminology(termRow.key, (e.target as HTMLInputElement).value)"
                    />
                  </div>
                </div>

                <!-- Reset terminology to Tom's defaults -->
                <button
                  type="button"
                  class="mt-3 px-3 py-1 rounded-lg bg-slate-100 border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-200"
                  title="Reset all strategy terminology to Tom Gilb's recommended defaults (Strategy-Ring vocabulary)"
                  @click="set('strategyTerminology', {
                    valueTerm: 'Strategic Objective',
                    valuesTermPlural: 'Strategic Objectives',
                    solutionTerm: 'Strategy',
                    solutionsTermPlural: 'Strategies',
                    evoStepTerm: 'Strategic Value Delivery Increment',
                    evoStepsTermPlural: 'Strategic Value Delivery Increments',
                    evoFeedbackTerm: 'Strategic Results',
                    ownerRoleTerm: 'Strategy Responsible',
                    plannerRoleTerm: 'Strategy Planner',
                    scribeRoleTerm: 'Results Responsible',
                  })"
                >Reset to Tom's defaults</button>
              </div>

              <!-- Strategy Agent Tool — future work note -->
              <div class="mt-3 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2">
                <p class="text-[11px] text-amber-800 font-semibold">
                  <span aria-hidden="true">🤖</span> Strategy Agent Tool
                  <span class="text-[9px] uppercase font-bold px-1 py-px rounded bg-amber-200 text-amber-700 ml-1">planned — next</span>
                </p>
                <p class="text-[11px] text-amber-700 mt-0.5">
                  Tom Gilb 2026-06-09: "There will be a Strategy Agent Tool" — designed for prompting Claudian
                  with strategic-planning context (Strategy-Ring vocabulary, Value Improvement methodology,
                  organizational stakeholder mapping).
                </p>
              </div>
            </section>

            <!-- Import / Export / Reset always visible at the bottom -->
            <section class="border-t border-slate-200 pt-4">
              <h4 class="text-xs font-bold uppercase tracking-wide text-slate-600 mb-2">Backup &amp; Reset</h4>
              <div class="flex gap-2 flex-wrap">
                <button type="button" class="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50" title="Copy all settings as JSON to clipboard" @click="onExportCopy">Export to clipboard</button>
                <button type="button" class="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50" title="Paste JSON to restore settings" @click="showImport = !showImport">{{ showImport ? 'Cancel import' : 'Import from JSON' }}</button>
                <button type="button" class="px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold hover:bg-red-100" title="Reset all settings to defaults — cannot be undone" @click="onResetConfirm">Reset all to defaults</button>
              </div>
              <div v-if="showImport" class="mt-3">
                <textarea v-model="importText" rows="4" placeholder="Paste settings Planguage Representation here" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-[11px] font-mono focus:outline-none focus:ring-2 focus:ring-slate-400" />
                <div class="flex items-center gap-2 mt-2">
                  <button type="button" class="px-3 py-1.5 rounded-lg bg-slate-700 text-white text-xs font-bold hover:bg-slate-800" @click="onImportConfirm">Apply</button>
                  <p v-if="importError" class="text-xs text-red-700">{{ importError }}</p>
                </div>
              </div>
            </section>
          </ScrollContainer>
        </div>

      </div>
    </div>
  </Teleport>
</template>
