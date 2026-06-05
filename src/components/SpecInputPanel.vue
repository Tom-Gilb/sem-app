<!-- PlanInputPanel.vue — Import any existing plan and parse it into a Planguage spec.
     Three input modes: paste text · URL · file upload (.pdf .docx .txt .md …)
     Emits:
       imported(spec)            — use spec as-is
       imported-and-sharpen(spec) — use spec then open SharpenPanel immediately
       close                     — dismiss modal -->

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import {
  planInputLoading,
  planInputError,
  planInputProgress,
  extractFromUrl,
  extractFromFile,
  parseAsPlanguage,
  type PlanInputMode,
} from '../composables/useSpecInput'
import type { SpecBlock } from '../types/spec'
import LoadingProgress from './LoadingProgress.vue'
import ScrollContainer from './ScrollContainer.vue'
import CloseDot from './CloseDot.vue'
// DD-001 (2026-05-13) — Get glyph (`[*]→*`) is the canonical icon for the
// import / get-back-out side of the Save/Get pair. Save glyph cited in the
// "Save now in the plan bar" guidance so the user can recognise the symbol
// on the destination button.
import SaveGlyph from './icons/SaveGlyph.vue'
import GetGlyph from './icons/GetGlyph.vue'

const props = defineProps<{
  /**
   * True when a live spec is already loaded in the app.
   * Used to warn the user that importing will replace it.
   */
  hasCurrentPlan?: boolean
}>()

const emit = defineEmits<{
  imported:             [spec: SpecBlock]
  'imported-and-sharpen': [spec: SpecBlock]
  /** Merge parsed spec into the existing live plan instead of replacing it. */
  'add-to':             [spec: SpecBlock]
  close:                []
}>()

// ── State ─────────────────────────────────────────────────────────────────────

const mode         = ref<PlanInputMode>('text')
const pastedText   = ref('')
const urlInput     = ref('')
const selectedFile = ref<File | null>(null)
const parsedSpec   = ref<SpecBlock | null>(null)
const scrollBodyRef = ref<InstanceType<typeof ScrollContainer> | null>(null)

// ── Helpers ───────────────────────────────────────────────────────────────────

function selectMode(m: PlanInputMode): void {
  mode.value       = m
  parsedSpec.value = null
  planInputError.value = ''
}

function handleFileChange(e: Event): void {
  const input = e.target as HTMLInputElement
  selectedFile.value   = input.files?.[0] ?? null
  parsedSpec.value     = null
  planInputError.value = ''
}

// ── Parse ─────────────────────────────────────────────────────────────────────

async function handleParse(): Promise<void> {
  planInputError.value = ''
  parsedSpec.value     = null
  planInputLoading.value  = true
  planInputProgress.value = ''

  try {
    if (mode.value === 'text') {
      if (!pastedText.value.trim()) { planInputError.value = 'Paste some text to parse.'; return }
      parsedSpec.value = await parseAsPlanguage(pastedText.value.trim())

    } else if (mode.value === 'url') {
      if (!urlInput.value.trim()) { planInputError.value = 'Enter a URL.'; return }
      const text = await extractFromUrl(urlInput.value.trim())
      parsedSpec.value = await parseAsPlanguage(text)

    } else {
      if (!selectedFile.value) { planInputError.value = 'Choose a file.'; return }
      const { text, isPdf, pdfBase64 } = await extractFromFile(selectedFile.value)
      parsedSpec.value = await parseAsPlanguage(text, { isPdf, pdfBase64 })
    }

    if (!parsedSpec.value) {
      planInputError.value =
        'Could not extract a Planguage spec from this content. ' +
        'Try adding more detail, or paste a longer section of the document.'
    } else {
      // Scroll the panel body down so the results section is immediately visible
      await nextTick()
      const el = scrollBodyRef.value?.el
      el?.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    }
  } catch (err) {
    planInputError.value = err instanceof Error ? err.message : 'An unexpected error occurred.'
  } finally {
    planInputLoading.value  = false
    planInputProgress.value = ''
  }
}

// ── Use ───────────────────────────────────────────────────────────────────────

function handleUse(): void {
  if (parsedSpec.value) emit('imported', parsedSpec.value)
}

function handleUseSharpen(): void {
  if (parsedSpec.value) emit('imported-and-sharpen', parsedSpec.value)
}

function handleAddTo(): void {
  if (parsedSpec.value) emit('add-to', parsedSpec.value)
}
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <div
      class="fixed inset-0 z-[500] bg-black/50 backdrop-blur-sm"
      aria-hidden="true"
      @click="emit('close')"
    />

    <!-- Panel -->
    <div
      class="fixed inset-0 z-[510] flex items-center justify-center p-4 pointer-events-none"
      role="dialog"
      aria-modal="true"
      aria-label="Import Planning Data"
    >
      <div class="w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden pointer-events-auto max-h-[90vh]">

        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-3.5 bg-indigo-600 rounded-t-2xl flex-shrink-0">
          <div class="flex items-center gap-2 text-white">
            <GetGlyph size="standard" class="h-4 w-auto" aria-hidden="true" />
            <h2 class="text-sm font-semibold text-white tracking-wide">Import Planning Data</h2>
          </div>
          <!-- Close — universal CloseDot per "Universal Close-Button Rule" -->
          <CloseDot
            variant="on-dark"
            aria-label="Close import panel"
            @click="emit('close')"
          />
        </div>

        <!-- Scrollable body -->
        <ScrollContainer ref="scrollBodyRef" outer-class="flex-1 min-h-0 relative" inner-class="h-full p-5 space-y-5">

          <!-- ── Format availability grid ── -->
          <div class="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div>
              <p class="text-[10px] font-bold text-emerald-700 uppercase tracking-wide mb-1.5">✅ Supported</p>
              <ul class="space-y-0.5 text-[11px] text-slate-600 leading-relaxed">
                <li>PDF <span class="text-slate-400">(.pdf)</span></li>
                <li>Word <span class="text-slate-400">(.docx)</span></li>
                <li>Plain text <span class="text-slate-400">(.txt · .md)</span></li>
                <li>HTML <span class="text-slate-400">(.html)</span></li>
                <li>CSV <span class="text-slate-400">(.csv)</span></li>
                <li>RTF <span class="text-slate-400">(.rtf)</span></li>
                <li>Any pasted text</li>
                <li>Public web URLs</li>
                <li>Google Docs <span class="text-slate-400">(set to "anyone with link")</span></li>
                <li>Google Sheets <span class="text-slate-400">(set to "anyone with link")</span></li>
                <li>Google Slides <span class="text-slate-400">(set to "anyone with link")</span></li>
              </ul>
            </div>
            <div>
              <p class="text-[10px] font-bold text-red-600 uppercase tracking-wide mb-1.5">❌ Not available</p>
              <ul class="space-y-0.5 text-[11px] text-slate-600 leading-relaxed">
                <li>.doc <span class="text-slate-400">→ save as .docx</span></li>
                <li>PowerPoint <span class="text-slate-400">→ export as PDF</span></li>
                <li>Excel <span class="text-slate-400">→ save as CSV</span></li>
                <li>Keynote <span class="text-slate-400">→ export as PDF</span></li>
                <li>Pages <span class="text-slate-400">→ export as PDF</span></li>
                <li>Private URLs <span class="text-slate-400">→ paste content instead</span></li>
                <li>Private Google docs <span class="text-slate-400">→ change sharing first</span></li>
              </ul>
            </div>
          </div>

          <!-- Mode tabs -->
          <div
            class="flex rounded-xl border border-slate-200 bg-slate-50 p-1 gap-1"
            role="tablist"
            aria-label="Input mode"
          >
            <button
              v-for="(tab, i) in ([
                { key: 'text', icon: '📝', label: 'Paste text' },
                { key: 'url',  icon: '🔗', label: 'URL' },
                { key: 'file', icon: '📄', label: 'Upload file' },
              ] as const)"
              :key="i"
              type="button"
              role="tab"
              :aria-selected="mode === tab.key"
              :class="[
                'flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-colors',
                mode === tab.key
                  ? 'bg-white shadow-sm text-indigo-700 border border-indigo-100'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-white/60',
              ]"
              @click="selectMode(tab.key)"
            >
              <span aria-hidden="true">{{ tab.icon }}</span>
              {{ tab.label }}
            </button>
          </div>

          <!-- ── Paste text ── -->
          <div v-if="mode === 'text'" class="space-y-2">
            <label class="block text-xs font-semibold text-slate-600 uppercase tracking-wide" for="plan-paste">
              Plan content
            </label>
            <textarea
              id="plan-paste"
              v-model="pastedText"
              rows="10"
              class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm
                     focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent
                     resize-y placeholder:text-slate-400 font-mono"
              placeholder="Paste your plan, strategy doc, project brief, meeting notes, OKRs, roadmap — any text…"
              :disabled="planInputLoading"
            />
            <p class="text-xs text-slate-400">Works with any plain text: Word copy-paste, PDF copy-paste, Notion export, email, slides notes, etc.</p>
            <!-- "What next" nudge — appears once there's something pasted -->
            <div
              v-if="pastedText.trim()"
              class="flex items-center gap-2 rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-2 text-xs text-indigo-700"
            >
              <span aria-hidden="true">👇</span>
              Text ready — click <strong>Parse as Planguage Spec</strong> below to import it.
            </div>
          </div>

          <!-- ── URL ── -->
          <div v-else-if="mode === 'url'" class="space-y-3">
            <label class="block text-xs font-semibold text-slate-600 uppercase tracking-wide" for="plan-url">
              Page URL
            </label>
            <input
              id="plan-url"
              v-model="urlInput"
              type="url"
              class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm
                     focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent
                     placeholder:text-slate-400"
              placeholder="https://…"
              :disabled="planInputLoading"
              @keydown.enter="handleParse"
            />
            <div class="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-700 space-y-1">
              <p><strong>Works best with:</strong> public web pages, Confluence/Notion public links, GitHub READMEs, Google Docs (published to web).</p>
              <p><strong>Behind a login?</strong> Copy-paste the content into the text tab instead.</p>
            </div>
          </div>

          <!-- ── File upload ── -->
          <div v-else class="space-y-3">
            <p class="text-xs font-semibold text-slate-600 uppercase tracking-wide">Choose file</p>
            <label
              class="flex flex-col items-center gap-3 px-6 py-8 rounded-xl border-2 border-dashed
                     cursor-pointer transition-colors"
              :class="selectedFile
                ? 'border-indigo-300 bg-indigo-50'
                : 'border-slate-300 bg-white hover:border-indigo-300 hover:bg-indigo-50'"
            >
              <span class="text-3xl" aria-hidden="true">{{ selectedFile ? '📄' : '📂' }}</span>
              <div class="text-center">
                <p class="text-sm font-medium text-slate-700">
                  {{ selectedFile ? selectedFile.name : 'Drop file here or click to browse' }}
                </p>
                <p class="text-xs text-slate-400 mt-1">
                  PDF · Word (.docx) · Text · Markdown · HTML · CSV
                </p>
              </div>
              <input
                type="file"
                accept=".pdf,.docx,.txt,.md,.markdown,.rtf,.html,.htm,.csv"
                class="sr-only"
                :disabled="planInputLoading"
                @change="handleFileChange"
              />
            </label>
            <p v-if="selectedFile" class="text-xs text-slate-500">
              {{ (selectedFile.size / 1024).toFixed(0) }} KB ·
              {{ selectedFile.name.split('.').pop()?.toUpperCase() }}
            </p>
          </div>

          <!-- Replace-warning — shown when a live plan is already loaded -->
          <div
            v-if="props.hasCurrentPlan"
            class="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800"
            role="alert"
          >
            <span class="flex-shrink-0 text-base" aria-hidden="true">⚠️</span>
            <div>
              <p class="font-semibold">This will replace your current live plan.</p>
              <p class="text-xs text-amber-700 mt-0.5">
                Your existing spec will be overwritten. Save it first
                (<span class="inline-flex items-center gap-1 align-middle"><SaveGlyph size="compact" class="inline-block h-3 w-auto -mt-0.5" /> Save now</span>
                in the plan bar) if you want to keep it.
                Archived model history is not affected.
              </p>
            </div>
          </div>

          <!-- Parse button -->
          <button
            type="button"
            class="w-full flex items-center justify-center gap-2 min-h-[48px] rounded-xl
                   bg-indigo-600 text-white text-sm font-semibold
                   hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed
                   focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2
                   transition-colors"
            :disabled="planInputLoading"
            @click="handleParse"
          >
            <template v-if="planInputLoading">
              <div class="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" aria-hidden="true" />
              {{ planInputProgress || 'Processing…' }}
            </template>
            <template v-else>
              <span aria-hidden="true">🔍</span>
              Parse as Planguage Spec
            </template>
          </button>

          <!-- Progress bar — appears below the button during any parse operation -->
          <LoadingProgress
            :loading="planInputLoading"
            :label="planInputProgress || 'Processing…'"
            :baseline="35"
            hint="can take up to 60s for large documents"
            color="indigo"
          />

          <!-- Error -->
          <p
            v-if="planInputError"
            class="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3"
            role="alert"
          >
            {{ planInputError }}
          </p>

          <!-- ── Results ── -->
          <template v-if="parsedSpec && !planInputLoading">
            <div class="border-t border-slate-100 pt-4 space-y-4">

              <!-- Counts summary -->
              <div class="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <span class="text-lg shrink-0" aria-hidden="true">✅</span>
                <div class="flex-1 text-sm text-emerald-800 font-medium">
                  Extracted
                  <strong>{{ parsedSpec.functions.length }} function{{ parsedSpec.functions.length !== 1 ? 's' : '' }}</strong> ·
                  <strong>{{ parsedSpec.values.length }} value{{ parsedSpec.values.length !== 1 ? 's' : '' }}</strong> ·
                  <strong>{{ parsedSpec.solutions.length }} solution{{ parsedSpec.solutions.length !== 1 ? 's' : '' }}</strong>
                </div>
              </div>

              <!-- Quick preview (first 2 F entries) -->
              <div class="space-y-1.5">
                <p class="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Preview</p>
                <div
                  v-for="f in parsedSpec.functions.slice(0, 3)"
                  :key="f.id"
                  class="flex items-start gap-2 text-xs text-slate-600"
                >
                  <span class="shrink-0 font-mono text-indigo-500 font-semibold">{{ f.id }}</span>
                  <span class="truncate">{{ f.description }}</span>
                </div>
                <p v-if="parsedSpec.functions.length > 3" class="text-xs text-slate-400 italic">
                  + {{ parsedSpec.functions.length - 3 }} more function{{ parsedSpec.functions.length - 3 !== 1 ? 's' : '' }}…
                </p>
              </div>

              <!-- Action buttons -->
              <div class="space-y-2">

                <!-- Add to current — only when a live plan exists -->
                <button
                  v-if="props.hasCurrentPlan"
                  type="button"
                  class="w-full flex items-center justify-center gap-2 min-h-[48px]
                         rounded-xl bg-emerald-600 text-white text-sm font-semibold
                         hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2
                         transition-colors"
                  @click="handleAddTo"
                >
                  <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
                  </svg>
                  Add to current plan
                  <span class="text-emerald-200 text-xs font-normal">(keeps existing entries)</span>
                </button>

                <div class="flex gap-3">
                  <button
                    type="button"
                    class="flex-1 flex items-center justify-center gap-1.5 min-h-[48px]
                           rounded-xl text-sm font-semibold
                           focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors"
                    :class="props.hasCurrentPlan
                      ? 'bg-slate-600 text-white hover:bg-slate-700 focus:ring-slate-400'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-400'"
                    @click="handleUse"
                  >
                    <span aria-hidden="true">{{ props.hasCurrentPlan ? '↩' : '✓' }}</span>
                    {{ props.hasCurrentPlan ? 'Replace current plan' : 'Use this spec' }}
                  </button>
                  <button
                    type="button"
                    class="flex-1 flex items-center justify-center gap-1.5 min-h-[48px]
                           rounded-xl bg-amber-500 text-white text-sm font-semibold
                           hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2
                           transition-colors"
                    @click="handleUseSharpen"
                  >
                    <span aria-hidden="true">🔪</span> Use + Sharpen
                  </button>
                </div>

              </div>
            </div>
          </template>

        </ScrollContainer>
      </div>
    </div>
  </Teleport>
</template>
