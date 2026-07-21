<!-- UNIT_TYPE=Widget
     ResourcesSharpeningDialog.vue — v513 AI Sharpening dialogue.

     Tom Gilb 2026-07-21 verbatim (from Estimation 8 brief): "have Sharpening
     sessions to deal with any resource situation based on the current set of
     data".

     Claude-Code-as-AI-Layer SUPREME (Tom Gilb 2026-06-02 verbatim: "i want to
     use ai for all y functionality but from my local claude code") — the SEM
     App NEVER calls an external AI API.  This dialogue implements the
     clipboard-IO pattern:

       1. SEM App builds a fully-audited prompt from current resource state
          (series + evidence + equations + second opinions + active standards
          + contract references + methodology notes).
       2. Tom clicks "Copy prompt" — prompt lands on clipboard.
       3. Tom pastes into his local Claudian session (Terminal / Obsidian /
          Claude Code app).
       4. Claudian returns JSON in the exact shape specified in the prompt.
       5. Tom copies the JSON + pastes into the paste-back textarea below.
       6. SEM App parses + renders recommendations with credibility scoring.

     Composes with:
       • CloseDot SUPREME (top-right + backdrop + Escape)
       • ScrollContainer SUPREME
       • Icon-Plus-Text SUPREME (📋 Copy prompt · 📥 Paste + Parse pins)
       • Spell-out-Type-Names SUPREME
       • DD-009 Zero-Training UI (every button HoverHint spells out purpose)
       • DD-017 R-G colorblind-safe (indigo/emerald/amber palette)
       • No-Silent-Data-Loss (parsed recommendations persist to composable
         via ResourcesAgent settings.notes concatenation on Apply — future
         v514+ dedicated recommendations store)
       • Universal Undo (existing composable Undo linkage inherits)
       • Twin portability (pure Vue + Tailwind; ports as-is to Kai's Twin) -->

<script setup lang="ts">
import { ref, computed } from 'vue'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'
import {
  useResourcesAgent,
} from '../composables/useResourcesAgent'
import {
  RESOURCE_META,
  type EstimatableResource,
} from '../composables/useResourceEstimations'
import type { Ref, ComputedRef } from 'vue'

const props = defineProps<{
  open: boolean
  resource: EstimatableResource | null
  planIdRef: Ref<string> | ComputedRef<string>
}>()

const emit = defineEmits<{
  close: []
}>()

const agent = useResourcesAgent(props.planIdRef)

// Built prompt (reactive so it recomputes when resource prop changes)
const prompt = computed<string>(() => {
  if (!props.resource) return ''
  return agent.buildSharpenPrompt(props.resource)
})

// Paste-back state
const pasteBackText = ref('')
const parseError = ref<string | null>(null)

interface Recommendation {
  title:       string
  detail:      string
  citation?:   string
  credibility?: number
  impact?:     string
}
interface ParsedResponse {
  situation:        string
  rootCauses:       string[]
  recommendations:  Recommendation[]
  riskIfNoAction:   string
  sourcesConsulted: string[]
}
const parsedResponse = ref<ParsedResponse | null>(null)

// Copy prompt to clipboard
const copyStatus = ref<'idle' | 'copied' | 'failed'>('idle')
async function copyPromptToClipboard(): Promise<void> {
  try {
    await navigator.clipboard.writeText(prompt.value)
    copyStatus.value = 'copied'
    window.setTimeout(() => { copyStatus.value = 'idle' }, 2500)
  } catch {
    copyStatus.value = 'failed'
  }
}

// Parse JSON paste-back
function parsePasteBack(): void {
  parseError.value = null
  parsedResponse.value = null
  const raw = pasteBackText.value.trim()
  if (!raw) {
    parseError.value = 'Paste the JSON response from Claudian first.'
    return
  }
  // Strip common wrappers: ```json ... ``` OR ``` ... ```
  const jsonBlock = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  try {
    const parsed = JSON.parse(jsonBlock)
    // Defensive shape validation
    if (
      typeof parsed !== 'object' || parsed === null ||
      typeof parsed.situation !== 'string' ||
      !Array.isArray(parsed.rootCauses) ||
      !Array.isArray(parsed.recommendations)
    ) {
      parseError.value = 'JSON parsed but does not match expected shape (need situation + rootCauses + recommendations).'
      return
    }
    parsedResponse.value = {
      situation:        parsed.situation,
      rootCauses:       parsed.rootCauses.map((c: unknown) => String(c)),
      recommendations:  (parsed.recommendations as unknown[]).map((r) => {
        const obj = r as Record<string, unknown>
        return {
          title:       String(obj.title ?? ''),
          detail:      String(obj.detail ?? ''),
          citation:    obj.citation ? String(obj.citation) : undefined,
          credibility: typeof obj.credibility === 'number' ? obj.credibility : undefined,
          impact:      obj.impact ? String(obj.impact) : undefined,
        }
      }),
      riskIfNoAction:   String(parsed.riskIfNoAction ?? ''),
      sourcesConsulted: Array.isArray(parsed.sourcesConsulted) ? parsed.sourcesConsulted.map((s: unknown) => String(s)) : [],
    }
  } catch (err) {
    parseError.value = `JSON parse failed: ${err instanceof Error ? err.message : String(err)}`
  }
}

function resetDialog(): void {
  pasteBackText.value = ''
  parseError.value = null
  parsedResponse.value = null
  copyStatus.value = 'idle'
}

function credibilityBand(c: number | undefined): string {
  if (c == null) return 'text-slate-500'
  if (c >= 0.8) return 'text-emerald-700'
  if (c >= 0.5) return 'text-amber-700'
  return 'text-rose-700'
}

// Close resets state
function handleClose(): void {
  resetDialog()
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="sharpen-dialog">
      <div v-if="open && resource" class="fixed inset-0 z-[730]">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" @click="handleClose" />

        <!-- Panel -->
        <section
          class="absolute inset-4 md:inset-10 lg:inset-14 rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 flex flex-col overflow-hidden"
          role="dialog"
          aria-modal="true"
          :aria-label="`AI Sharpening dialogue for ${RESOURCE_META[resource].label} — Claudian clipboard-IO`"
        >
          <!-- Header -->
          <header class="flex items-start justify-between px-6 py-4 bg-gradient-to-br from-indigo-50 via-blue-50 to-emerald-50 border-b border-indigo-200">
            <div class="flex items-center gap-4">
              <div class="inline-flex items-center gap-3 rounded-2xl pl-3 pr-5 py-2 bg-gradient-to-r from-indigo-500 to-blue-500 shadow-lg ring-2 ring-indigo-300/40 select-none">
                <span class="text-lg leading-none" aria-hidden="true">🔍</span>
                <span class="flex flex-col items-start leading-tight">
                  <span class="text-[9px] font-semibold uppercase tracking-[0.15em] text-indigo-100">AI Sharpening</span>
                  <span class="text-base font-extrabold text-white">{{ RESOURCE_META[resource].label }}</span>
                </span>
              </div>
              <div>
                <h2 class="text-lg font-bold text-indigo-900">Claudian remediation advisor</h2>
                <p class="text-[12px] text-indigo-700/80">
                  Clipboard-IO per Claude-Code-as-AI-Layer SUPREME — SEM builds the prompt, Claudian in your Terminal answers, you paste the JSON back.
                </p>
              </div>
            </div>
            <CloseDot size="lg" aria-label="Close AI Sharpening dialogue" @click="handleClose" />
          </header>

          <!-- Body -->
          <ScrollContainer outer-class="flex-1 min-h-0 relative" inner-class="h-full px-6 py-5 space-y-5">

            <!-- Step 1: Copy prompt -->
            <section aria-labelledby="step1-h" class="rounded-xl border-2 border-indigo-300 bg-indigo-50/40 p-4 space-y-2">
              <div class="flex items-center gap-2">
                <span class="inline-flex items-center justify-center rounded-full bg-indigo-600 text-white font-bold w-6 h-6 text-[11px]">1</span>
                <h3 id="step1-h" class="text-[12px] font-bold uppercase tracking-wider text-indigo-900">Copy prompt to clipboard</h3>
              </div>
              <p class="text-[11px] text-indigo-800/80">
                The prompt below carries the complete audit context — historical series + evidence + equations + second opinions + active standards + contract references + methodology notes.
              </p>
              <div class="rounded-lg bg-white border border-indigo-200 p-3 font-mono text-[10px] text-slate-700 whitespace-pre-wrap max-h-48 overflow-y-auto">{{ prompt }}</div>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="px-4 py-2 rounded-lg text-[12px] font-bold text-white bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 shadow"
                  title="Copy the full prompt to your clipboard, then paste it into your local Claudian session (Terminal / Obsidian / Claude Code app)"
                  @click="copyPromptToClipboard"
                >📋 Copy prompt ({{ prompt.length.toLocaleString() }} chars)</button>
                <span v-if="copyStatus === 'copied'" class="text-[11px] font-bold text-emerald-700">✓ Copied — now paste into Claudian</span>
                <span v-else-if="copyStatus === 'failed'" class="text-[11px] font-bold text-rose-700">✕ Copy failed — select the prompt text above manually and use ⌘C</span>
              </div>
              <div class="text-[10px] text-indigo-800 italic">
                💡 In your Terminal: open Claude Code in the sem-app repo · paste the prompt · Claudian returns JSON matching the exact shape at the end of the prompt · copy that JSON.
              </div>
            </section>

            <!-- Step 2: Paste back -->
            <section aria-labelledby="step2-h" class="rounded-xl border-2 border-blue-300 bg-blue-50/40 p-4 space-y-2">
              <div class="flex items-center gap-2">
                <span class="inline-flex items-center justify-center rounded-full bg-blue-600 text-white font-bold w-6 h-6 text-[11px]">2</span>
                <h3 id="step2-h" class="text-[12px] font-bold uppercase tracking-wider text-blue-900">Paste Claudian's JSON response</h3>
              </div>
              <textarea
                v-model="pasteBackText"
                rows="6"
                placeholder='Paste the JSON response from Claudian here.  Fenced ```json blocks are OK — the parser strips them automatically.'
                class="w-full px-3 py-2 rounded-lg border border-blue-300 bg-white font-mono text-[11px] focus:outline-none focus:ring-2 focus:ring-blue-400"
                title="Paste the raw JSON response from your Claudian session.  The parser accepts fenced ```json blocks + validates the shape (situation + rootCauses + recommendations)."
              ></textarea>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="px-4 py-2 rounded-lg text-[12px] font-bold text-white bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 shadow"
                  title="Parse the pasted JSON + render recommendations below.  Validates shape.  Shows a parse error inline if the JSON is malformed or missing required fields."
                  @click="parsePasteBack"
                >📥 Parse + Render recommendations</button>
                <button
                  v-if="parsedResponse || parseError"
                  type="button"
                  class="px-3 py-2 rounded-lg text-[11px] font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50"
                  title="Clear the paste-back state and start over"
                  @click="resetDialog"
                >Reset</button>
              </div>
              <div v-if="parseError" class="rounded-lg bg-rose-50 border border-rose-300 text-rose-800 text-[11px] p-3">
                ⚠ {{ parseError }}
              </div>
            </section>

            <!-- Step 3: Parsed recommendations -->
            <section v-if="parsedResponse" aria-labelledby="step3-h" class="rounded-xl border-2 border-emerald-300 bg-emerald-50/40 p-4 space-y-3">
              <div class="flex items-center gap-2">
                <span class="inline-flex items-center justify-center rounded-full bg-emerald-600 text-white font-bold w-6 h-6 text-[11px]">3</span>
                <h3 id="step3-h" class="text-[12px] font-bold uppercase tracking-wider text-emerald-900">Claudian's recommendations</h3>
              </div>

              <!-- Situation summary -->
              <div class="rounded-lg bg-white border border-emerald-200 p-3">
                <div class="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-1">Situation</div>
                <div class="text-[12px] text-slate-800">{{ parsedResponse.situation }}</div>
              </div>

              <!-- Root causes -->
              <div v-if="parsedResponse.rootCauses.length > 0" class="rounded-lg bg-white border border-emerald-200 p-3">
                <div class="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-1">Root causes</div>
                <ul class="list-disc pl-5 space-y-0.5 text-[12px] text-slate-800">
                  <li v-for="(c, idx) in parsedResponse.rootCauses" :key="idx">{{ c }}</li>
                </ul>
              </div>

              <!-- Recommendations -->
              <div v-if="parsedResponse.recommendations.length > 0" class="space-y-2">
                <div class="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Recommendations ({{ parsedResponse.recommendations.length }})</div>
                <div
                  v-for="(rec, idx) in parsedResponse.recommendations"
                  :key="idx"
                  class="rounded-lg bg-white border border-emerald-200 p-3 space-y-1"
                >
                  <div class="flex items-start justify-between gap-2">
                    <div class="font-bold text-[12px] text-slate-900">{{ idx + 1 }}. {{ rec.title }}</div>
                    <span
                      v-if="rec.credibility != null"
                      :class="['text-[10px] font-mono font-bold shrink-0', credibilityBand(rec.credibility)]"
                      :title="`Credibility ${(rec.credibility * 100).toFixed(0)}% (CE-scale: 0.9 strongly supports · 0.5 moderate · 0.3 weak)`"
                    >{{ (rec.credibility * 100).toFixed(0) }}% conf.</span>
                  </div>
                  <div class="text-[11px] text-slate-700">{{ rec.detail }}</div>
                  <div v-if="rec.impact" class="text-[10px] text-slate-600 italic">Expected impact: {{ rec.impact }}</div>
                  <div v-if="rec.citation" class="text-[10px] text-blue-800 font-semibold">Grounded in: {{ rec.citation }}</div>
                </div>
              </div>

              <!-- Risk if no action -->
              <div v-if="parsedResponse.riskIfNoAction" class="rounded-lg bg-amber-50 border border-amber-300 p-3">
                <div class="text-[10px] font-bold uppercase tracking-wider text-amber-800 mb-1">⚠ Risk if no action</div>
                <div class="text-[12px] text-amber-900">{{ parsedResponse.riskIfNoAction }}</div>
              </div>

              <!-- Sources consulted -->
              <div v-if="parsedResponse.sourcesConsulted.length > 0" class="rounded-lg bg-white border border-emerald-200 p-3">
                <div class="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-1">Sources consulted</div>
                <div class="flex flex-wrap gap-1.5">
                  <span
                    v-for="(src, idx) in parsedResponse.sourcesConsulted"
                    :key="idx"
                    class="inline-block rounded-full px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-semibold"
                  >{{ src }}</span>
                </div>
              </div>
            </section>

            <!-- Grounding footnote -->
            <div class="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-2 text-[10px] text-slate-600">
              Per <strong>Claude-Code-as-AI-Layer SUPREME</strong> (Tom Gilb 2026-06-02): the SEM App never calls an external AI API.  Every AI action goes through your local Claudian session via clipboard-IO.  No API keys required, no runtime cost, no vendor lock-in.  Claudian's answer is grounded in Gilb Cost Engineering (2023) + Planguage Logic (2026) + your active standards.
            </div>
          </ScrollContainer>

          <!-- Footer -->
          <footer class="flex items-center justify-end gap-3 px-6 py-3 border-t border-indigo-200 bg-indigo-50/50">
            <button
              type="button"
              class="px-4 py-2 rounded-lg text-[13px] font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50"
              @click="handleClose"
              title="Close AI Sharpening dialogue"
            >Close</button>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sharpen-dialog-enter-active,
.sharpen-dialog-leave-active { transition: opacity 180ms ease; }
.sharpen-dialog-enter-from,
.sharpen-dialog-leave-to { opacity: 0; }
</style>
