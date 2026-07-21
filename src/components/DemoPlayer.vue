<!--
  DemoPlayer.vue — r41 v168 (Tom Gilb 2026-06-18, Option D Evo process).

  Renders the Tolerable-tier demo content from `useDemoRegistry`:
   - markdown-formatted text clip
   - optional snapshot image (added incrementally)
   - source citation (SEM App Book page reference)

  Goal-tier: Pl (Planguage) event-script replay against live SEM App (future).
  Wish-tier: audio narration + animated overlays (future).
  Stretch-tier: Claudian-authored from spoken description (future).

  Per `rule_demo_vs_guided_vs_tour_vs_history.md` SUPREME: demos are
  PASSIVE — no interaction; the planner watches.
-->
<script setup lang="ts">
import { computed } from 'vue'
import CloseDot from './CloseDot.vue'
import { getDemoContent } from '../composables/useDemoRegistry'

const props = defineProps<{
  demoId: string
  /** Optional title shown in the header band. */
  title?: string
  /** Optional subtitle shown beneath the title. */
  subtitle?: string
}>()

defineEmits<{
  close: []
}>()

const content = computed(() => getDemoContent(props.demoId))

/** Quick markdown-bold renderer: turns **text** into <strong>text</strong>.
 *  Keeps escaping simple; the source clip data is curated by Claudian. */
function renderClip(clip: string): string {
  return clip
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p class="mt-3">')
    .replace(/\n/g, '<br>')
}
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <div
      class="fixed inset-0 z-[495] bg-black/60 backdrop-blur-sm"
      aria-hidden="true"
      @click="$emit('close')"
    />

    <!-- Player card -->
    <div
      class="fixed inset-0 z-[500] flex items-center justify-center p-4 pointer-events-none"
      role="dialog"
      aria-modal="true"
      aria-label="Demo Player — passive replay"
    >
      <div
        class="pointer-events-auto w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden bg-white ring-1 ring-black/10"
      >
        <!-- Header -->
        <div class="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-indigo-700 via-violet-700 to-fuchsia-700 shrink-0">
          <span class="text-2xl" aria-hidden="true">🎬</span>
          <div class="flex-1 min-w-0">
            <h2 class="text-base font-bold text-white leading-tight tracking-tight">{{ title || 'Demo' }}</h2>
            <p v-if="subtitle" class="text-[11px] text-white/80 leading-tight mt-0.5">{{ subtitle }}</p>
          </div>
          <CloseDot
            size="lg"
            variant="on-dark"
            aria-label="Close demo"
            title="Close demo — return to the Demos Menu"
            @click="$emit('close')"
          />
        </div>

        <!-- Body -->
        <div class="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
          <template v-if="content">
            <!-- Snapshot if any -->
            <img
              v-if="content.snapshotUrl"
              :src="content.snapshotUrl"
              :alt="`${title || demoId} snapshot`"
              class="w-full rounded-lg ring-1 ring-slate-200 shadow-sm"
            />

            <!-- Clip text — rendered with simple bold markdown -->
            <div
              v-if="content.clip"
              class="prose-sm text-slate-700 leading-relaxed text-sm"
            >
              <p v-html="renderClip(content.clip)" />
            </div>

            <!-- Source citation -->
            <div class="pt-3 border-t border-slate-200 text-[11px] text-slate-500 italic">
              <strong class="not-italic text-slate-600">Source:</strong> {{ content.source }}
            </div>

            <!-- Evo-tier badge -->
            <div class="flex items-center gap-2 mt-2">
              <span class="text-[10px] uppercase tracking-widest font-bold text-fuchsia-700 bg-fuchsia-50 ring-1 ring-fuchsia-200 rounded px-2 py-0.5">
                Tolerable tier
              </span>
              <span class="text-[10px] text-slate-500">
                Full event-script replay (Goal tier) coming next pass.
              </span>
            </div>
          </template>

          <template v-else>
            <p class="text-sm text-slate-500 italic">
              ⏳ Demo content not yet registered for <code class="text-xs">{{ demoId }}</code>.  Coming soon.
            </p>
          </template>
        </div>

        <!-- Footer -->
        <div class="shrink-0 px-5 py-3 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-500 leading-snug">
          <strong>Demo</strong> = passive replay (you're watching).  For interactive learning use 🧙 Guided.  For UI walkthrough use ? Tour.
        </div>
      </div>
    </div>
  </Teleport>
</template>
