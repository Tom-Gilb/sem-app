<!--
  DemosMenu.vue — r41 v166 (Tom Gilb 2026-06-18 verbatim "can you make this
  menu more colorful and iconic? Ideally with icons based on the typical
  screen shot!")

  Catalog of demos: per Stage, per Tool, per Agent + an end-to-end demo.
  Each demo card now carries its CANONICAL visual identity:
   - Tool demos → the tool's mini-render Glyph SVG (PentaGlyph, MultiVisionGlyph,
     OptimaGlyph, etc.) per the v159 SUPREME rule "Tool Icon = Miniature of
     Its Display"
   - Agent demos → the agent's identity image from useAgentRegistry (Maria
     Montessori portrait, Eric Ries portrait, SpaceX Falcon 9, etc.) per the
     v126-v155 Agent Identity work
   - Stage demos → category-themed coloured gradient with a stage-number chip
   - End-to-end → fuchsia/violet "star of the show" gradient

  Per the new SUPREME rule `rule_demo_vs_guided_vs_tour_vs_history.md` +
  `rule_demo_production_evo.md`:
   - Demo = passive replay (this surface)
   - All entries Tolerable-tier initially: clip OR snapshot + source citation
   - Available flips per entry as content lands
-->
<script setup lang="ts">
import { type Component } from 'vue'
import CloseDot from './CloseDot.vue'

// Stage Tool mini-render glyphs (already wired into StageToolsStrip in v159+).
import PentaGlyph        from './icons/PentaGlyph.vue'
import MultiVisionGlyph  from './icons/MultiVisionGlyph.vue'
import OptimaGlyph       from './icons/OptimaGlyph.vue'
import SharpenKnifeGlyph from './icons/SharpenKnifeGlyph.vue'
import PlanHealthGlyph   from './icons/PlanHealthGlyph.vue'
import AnalyzerGlyph     from './icons/AnalyzerGlyph.vue'
import VdtMatrixGlyph    from './icons/VdtMatrixGlyph.vue'
import EvoCycleMiniGlyph from './icons/EvoCycleMiniGlyph.vue'
import MeasureLearnGlyph from './icons/MeasureLearnGlyph.vue'
import EditGlyph         from './icons/EditGlyph.vue'
import GetGlyph          from './icons/GetGlyph.vue'
import SaveGlyph         from './icons/SaveGlyph.vue'
import PlTaskIcon        from './icons/PlTaskIcon.vue'
import ModelThumbsStackGlyph from './icons/ModelThumbsStackGlyph.vue'
import ClaudianStarGlyph from './icons/ClaudianStarGlyph.vue'

// Agent identity images via the shared registry — same visual identity
// the AgentsStrip pin + AgentMenuPanel catalog tile already use.
import { AGENT_REGISTRY, type AgentRegistryId } from '../composables/useAgentRegistry'
// r41 v168 — Demo content registry per Tom Gilb 2026-06-18 "Populate all
// menu entries with at least one clip or snapshot".  Each demo entry's
// `available` flag reads from the registry now.
import { DEMO_REGISTRY } from '../composables/useDemoRegistry'

const emit = defineEmits<{
  close: []
  'play-demo': [payload: { id: string; title: string; subtitle: string }]
}>()

interface DemoEntry {
  id: string
  title: string
  subtitle: string
  available: boolean
  /** Mini-render Vue component for the demo's visual (tool glyph, etc.) */
  glyphComponent?: Component
  /** OR a real image URL (agent portrait, photo) */
  imageUrl?: string
  /** Optional category accent for the card border / glow */
  accent?: 'indigo' | 'violet' | 'fuchsia' | 'emerald' | 'amber' | 'rose' | 'cyan' | 'slate' | 'blue' | 'teal' | 'orange'
}

interface DemoSection {
  glyph: string
  title: string
  description: string
  demos: DemoEntry[]
}

/** Helper: build an Agent demo entry by registry id — auto-wires the
 *  identity image + accent. */
function agentDemo(id: AgentRegistryId, demoId: string, title: string, subtitle: string): DemoEntry {
  const ident = AGENT_REGISTRY[id]
  return {
    id: demoId,
    title,
    subtitle,
    available: DEMO_REGISTRY[demoId as keyof typeof DEMO_REGISTRY]?.available ?? false,
    imageUrl: ident.image,
    accent: (ident.accent as DemoEntry['accent']) ?? 'fuchsia',
  }
}

const DEMO_SECTIONS: DemoSection[] = [
  {
    glyph: '🎬',
    title: 'End-to-End Demo',
    description: 'Watch a full planning session — all 11 stages, from Stakes through Export.',
    demos: [
      { id: 'e2e', title: 'Full Plan Walkthrough', subtitle: 'Stages 1–11, about 12 minutes', available: DEMO_REGISTRY['e2e']?.available ?? false, glyphComponent: ClaudianStarGlyph, accent: 'fuchsia' },
    ],
  },
  {
    glyph: '📐',
    title: 'Demos by Stage',
    description: 'Watch each Planning Stage in isolation — what to do and what the AI produces.',
    demos: [
      { id: 'stage-1',  title: 'Stage 1 · Spec Draft',          subtitle: 'Stakeholders + Ends + Means capture',     available: DEMO_REGISTRY['stage-1']?.available ?? false, accent: 'violet'  },
      { id: 'stage-2',  title: 'Stage 2 · Solutions',           subtitle: 'Generate Solutions from Values',          available: DEMO_REGISTRY['stage-2']?.available ?? false, accent: 'orange',   glyphComponent: PentaGlyph },
      { id: 'stage-3',  title: 'Stage 3 · Sharpening',          subtitle: 'Q&A → AI suggestions → Accept-Fix',       available: DEMO_REGISTRY['stage-3']?.available ?? false, accent: 'fuchsia',  glyphComponent: SharpenKnifeGlyph },
      { id: 'stage-4',  title: 'Stage 4 · Impact Estimation',   subtitle: 'VDT / IET matrix fill',                   available: DEMO_REGISTRY['stage-4']?.available ?? false, accent: 'emerald',  glyphComponent: VdtMatrixGlyph },
      { id: 'stage-5',  title: 'Stage 5 · Refine',              subtitle: 'Refine Solutions based on impacts',       available: DEMO_REGISTRY['stage-5']?.available ?? false, accent: 'amber',    glyphComponent: EditGlyph },
      { id: 'stage-6',  title: 'Stage 6 · Evo Steps',           subtitle: 'Slice Solutions into Evo Steps',          available: DEMO_REGISTRY['stage-6']?.available ?? false, accent: 'violet',   glyphComponent: EvoCycleMiniGlyph },
      { id: 'stage-7',  title: 'Stage 7 · Evo Impact',          subtitle: 'Per-step impact projection',              available: DEMO_REGISTRY['stage-7']?.available ?? false, accent: 'emerald',  glyphComponent: VdtMatrixGlyph },
      { id: 'stage-8',  title: 'Stage 8 · Tasks',               subtitle: 'Break Evo Steps into Tasks',              available: DEMO_REGISTRY['stage-8']?.available ?? false, accent: 'amber',    glyphComponent: PlTaskIcon },
      { id: 'stage-9',  title: 'Stage 9 · Study-Act',           subtitle: 'Measure → Learn loop',                    available: DEMO_REGISTRY['stage-9']?.available ?? false, accent: 'cyan',     glyphComponent: MeasureLearnGlyph },
      { id: 'stage-10', title: 'Stage 10 · Resources',          subtitle: 'Resources Sharpening + OPTIMA',           available: DEMO_REGISTRY['stage-10']?.available ?? false, accent: 'teal',     glyphComponent: OptimaGlyph },
      { id: 'stage-11', title: 'Stage 11 · Export',             subtitle: 'Email / Download the full plan',          available: DEMO_REGISTRY['stage-11']?.available ?? false, accent: 'rose',     glyphComponent: SaveGlyph },
    ],
  },
  {
    glyph: '🛠',
    title: 'Demos by Tool',
    description: 'Each Stage Tool in action.',
    demos: [
      { id: 'tool-penta',         title: 'Penta',              subtitle: '5-sector pentagon visualization', available: DEMO_REGISTRY['tool-penta']?.available ?? false, accent: 'slate',   glyphComponent: PentaGlyph },
      { id: 'tool-multivision',   title: 'MultiVision',        subtitle: '3-zone Tolerable/Goal/Wish bars', available: DEMO_REGISTRY['tool-multivision']?.available ?? false, accent: 'indigo',  glyphComponent: MultiVisionGlyph },
      { id: 'tool-iet',           title: 'IET / Impact Estimator', subtitle: 'Solution × Value impact table', available: DEMO_REGISTRY['tool-iet']?.available ?? false, accent: 'emerald', glyphComponent: VdtMatrixGlyph },
      { id: 'tool-optima',        title: 'OPTIMA',             subtitle: 'Alternative comparison',           available: DEMO_REGISTRY['tool-optima']?.available ?? false, accent: 'teal',    glyphComponent: OptimaGlyph },
      { id: 'tool-sharpen-spec',  title: 'Sharpen Spec',       subtitle: 'Q&A interview → Accept-Fix',       available: DEMO_REGISTRY['tool-sharpen-spec']?.available ?? false, accent: 'fuchsia', glyphComponent: SharpenKnifeGlyph },
      { id: 'tool-sharpen-tools', title: 'Sharpen Tools',      subtitle: 'Toolbox of sharpening passes',     available: DEMO_REGISTRY['tool-sharpen-tools']?.available ?? false, accent: 'fuchsia', glyphComponent: SharpenKnifeGlyph },
      { id: 'tool-phi',           title: 'Spec Health',      subtitle: 'Plan Health Index scoring',        available: DEMO_REGISTRY['tool-phi']?.available ?? false, accent: 'emerald', glyphComponent: PlanHealthGlyph },
      { id: 'tool-standards',     title: 'Standards Auditor',  subtitle: 'Audit against 10.Standard/',       available: DEMO_REGISTRY['tool-standards']?.available ?? false, accent: 'emerald', glyphComponent: AnalyzerGlyph },
      { id: 'tool-evo-plan',      title: 'Evo Plan',           subtitle: '9-step iterative-delivery cycle',  available: DEMO_REGISTRY['tool-evo-plan']?.available ?? false, accent: 'violet',  glyphComponent: EvoCycleMiniGlyph },
      { id: 'tool-templates',     title: 'Templates',          subtitle: 'Stack of model thumbnails',        available: DEMO_REGISTRY['tool-templates']?.available ?? false, accent: 'blue',    glyphComponent: ModelThumbsStackGlyph },
      { id: 'tool-get-a-plan',    title: 'Get A Plan',         subtitle: 'Import / load / merge',            available: DEMO_REGISTRY['tool-get-a-plan']?.available ?? false, accent: 'violet',  glyphComponent: GetGlyph },
    ],
  },
  {
    glyph: '🪄',
    title: 'Demos by Agent',
    description: 'Each AI Agent doing its work end-to-end.',
    demos: [
      agentDemo('maria',                 'agent-maria',         'Maria',                'Board Work Parse'),
      agentDemo('contracts',             'agent-contracts',     'Contracts',            'Contract → Planguage entries'),
      agentDemo('stakeholder-mapper',    'agent-stakeholder',   'Stakeholder Mapper',   '10 attribute levels AI-drafted'),
      agentDemo('evo-step-critique',     'agent-evo-sharp',     'Evo Sharpening',       'Evo health + Value Delivery + Accept-Fix'),
      agentDemo('plan-importer',         'agent-spec',          'Spec Agent',           'Any text → Planguage entries'),
      agentDemo('decisions',             'agent-decisions',     'Decisions',            'Scored decision matrix'),
      agentDemo('strategy-agent',        'agent-strategy',      'Strategy Sharpening',  '10-dim Gilb Strategy Audit'),
      agentDemo('incorruptible',         'agent-incorruptible', 'Incorruptible',        'Eric Ries 6-class check'),
      agentDemo('incorruptible-sharpen', 'agent-inc-sharp',     'Incorruptible Sharpening', 'Q&A companion'),
      agentDemo('elon',                  'agent-elon',          'Elon',                 "Musk's Methods 9-category check"),
      agentDemo('elon-sharpen',          'agent-elon-sharp',    'Elon Sharpening',      'Q&A companion'),
      agentDemo('autoDbo',               'agent-auto-dbo',      'Auto-DBO',             'Design BY Objectives versioning'),
    ],
  },
]

/** Tailwind class-name maps — keep strings static so JIT scans them. */
const ACCENT_BG: Record<NonNullable<DemoEntry['accent']>, string> = {
  indigo:  'from-indigo-50  to-indigo-100  ring-indigo-200',
  violet:  'from-violet-50  to-violet-100  ring-violet-200',
  fuchsia: 'from-fuchsia-50 to-pink-100    ring-fuchsia-300',
  emerald: 'from-emerald-50 to-emerald-100 ring-emerald-200',
  amber:   'from-amber-50   to-amber-100   ring-amber-200',
  rose:    'from-rose-50    to-rose-100    ring-rose-200',
  cyan:    'from-cyan-50    to-cyan-100    ring-cyan-200',
  slate:   'from-slate-50   to-slate-100   ring-slate-200',
  blue:    'from-blue-50    to-blue-100    ring-blue-200',
  teal:    'from-teal-50    to-teal-100    ring-teal-200',
  orange:  'from-orange-50  to-orange-100  ring-orange-200',
}
const ACCENT_GLOW: Record<NonNullable<DemoEntry['accent']>, string> = {
  indigo:  'hover:ring-indigo-400  hover:shadow-indigo-200/60',
  violet:  'hover:ring-violet-400  hover:shadow-violet-200/60',
  fuchsia: 'hover:ring-fuchsia-400 hover:shadow-fuchsia-200/60',
  emerald: 'hover:ring-emerald-400 hover:shadow-emerald-200/60',
  amber:   'hover:ring-amber-400   hover:shadow-amber-200/60',
  rose:    'hover:ring-rose-400    hover:shadow-rose-200/60',
  cyan:    'hover:ring-cyan-400    hover:shadow-cyan-200/60',
  slate:   'hover:ring-slate-400   hover:shadow-slate-200/60',
  blue:    'hover:ring-blue-400    hover:shadow-blue-200/60',
  teal:    'hover:ring-teal-400    hover:shadow-teal-200/60',
  orange:  'hover:ring-orange-400  hover:shadow-orange-200/60',
}
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <div
      class="fixed inset-0 z-[485] bg-black/50 backdrop-blur-sm"
      aria-hidden="true"
      @click="$emit('close')"
    />

    <!-- Panel card -->
    <div
      class="fixed inset-0 z-[490] flex items-center justify-center p-4 pointer-events-none"
      role="dialog"
      aria-modal="true"
      aria-label="Demos Menu — watch SEM App in action"
    >
      <div
        class="pointer-events-auto w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden bg-white ring-1 ring-black/10"
      >
        <!-- Header -->
        <div class="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-indigo-700 via-violet-700 to-fuchsia-700 shrink-0">
          <span class="text-2xl" aria-hidden="true">🎬</span>
          <div class="flex-1 min-w-0">
            <h2 class="text-base font-bold text-white leading-tight tracking-tight">Demos Menu</h2>
            <p class="text-[11px] text-white/80 leading-tight mt-0.5">Watch SEM App + AI work end-to-end — passive replay, no interaction needed.  (Active learning?  Use 🧙 Guided.  UI walkthrough?  Use ? Tour.)</p>
          </div>
          <CloseDot
            size="lg"
            variant="on-dark"
            aria-label="Close Demos Menu"
            title="Close Demos Menu — return to the main planning workspace"
            @click="$emit('close')"
          />
        </div>

        <!-- Body — scrollable sections -->
        <div class="flex-1 min-h-0 overflow-y-auto p-5 space-y-6">
          <section
            v-for="section in DEMO_SECTIONS"
            :key="section.title"
          >
            <!-- Section header -->
            <div class="flex items-baseline gap-2 mb-2.5">
              <span class="text-xl" aria-hidden="true">{{ section.glyph }}</span>
              <h3 class="text-base font-extrabold text-slate-900">{{ section.title }}</h3>
              <span class="text-[11px] text-slate-500 italic">{{ section.description }}</span>
            </div>

            <!-- Demo grid — each card carries the tool/agent visual identity -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              <button
                v-for="demo in section.demos"
                :key="demo.id"
                type="button"
                class="group text-left rounded-xl ring-1 px-3 py-2.5 transition-all duration-200 flex items-center gap-3 bg-gradient-to-br shadow-sm hover:shadow-md hover:-translate-y-0.5"
                :class="[
                  ACCENT_BG[demo.accent ?? 'slate'],
                  demo.available ? `cursor-pointer ${ACCENT_GLOW[demo.accent ?? 'slate']}` : 'opacity-70 cursor-not-allowed grayscale-[35%]',
                ]"
                :title="demo.available
                  ? `▶ Play: ${demo.title} — ${demo.subtitle}`
                  : `⏳ ${demo.title} demo coming soon — ${demo.subtitle}.  Demo recordings are being produced incrementally; check back next session.`"
                :aria-label="demo.available ? `Play ${demo.title} demo` : `${demo.title} demo coming soon`"
                @click="demo.available ? emit('play-demo', { id: demo.id, title: demo.title, subtitle: demo.subtitle }) : null"
              >
                <!-- Visual — image OR glyph OR fallback hourglass -->
                <div class="shrink-0 h-11 w-11 flex items-center justify-center rounded-lg bg-white ring-1 ring-white/80 shadow-inner overflow-hidden">
                  <img
                    v-if="demo.imageUrl"
                    :src="demo.imageUrl"
                    :alt="`${demo.title} identity`"
                    class="h-full w-full object-cover"
                    loading="lazy"
                  />
                  <component
                    v-else-if="demo.glyphComponent"
                    :is="demo.glyphComponent"
                    class="h-7 w-auto"
                  />
                  <!-- r41 v167 — hourglass fallback dropped per Tom Gilb
                       2026-06-18.  The greyed card opacity + grayscale already
                       signal "coming soon"; the hourglass added visual noise. -->
                </div>
                <!-- Title + subtitle -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5 mb-0.5">
                    <!-- r41 v167 — hourglass dropped; only the emerald ▶ play
                         arrow renders when available.  Greyed card already
                         signals "coming soon" for unavailable demos. -->
                    <span v-if="demo.available" class="text-emerald-600 text-xs" aria-hidden="true">▶</span>
                    <span class="text-xs font-extrabold text-slate-900 truncate">{{ demo.title }}</span>
                  </div>
                  <p class="text-[10px] text-slate-700 leading-tight">{{ demo.subtitle }}</p>
                </div>
              </button>
            </div>
          </section>
        </div>

        <!-- Footer -->
        <div class="shrink-0 px-5 py-3 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-500 leading-snug">
          <strong>Demo</strong> = passive replay (watch).  <strong>Guided</strong> = interactive wizard (do-with-help).  <strong>Tour</strong> = annotated UI walkthrough.  <strong>Past Versions</strong> = list of saved past versions.
        </div>
      </div>
    </div>
  </Teleport>
</template>
