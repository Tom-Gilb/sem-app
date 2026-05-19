<!-- CopyrightPanel.vue — Copyright & Attribution panel
     Opens from Stage 1 footer link and from the Detail menu.
     Two modes: Notice view (polished read-only) and Edit mode (all fields editable).
     z-[475] — sits between SpecCollaborator (460) and PriorityRecordPanel (485).
-->
<script setup lang="ts">
import { ref, watch } from 'vue'
import RightPanel from './RightPanel.vue'
import ScrollContainer from './ScrollContainer.vue'
import CloseDot from './CloseDot.vue'
// DD-001 (2026-05-13).
import SaveGlyph from './icons/SaveGlyph.vue'
import Anthropic from '@anthropic-ai/sdk'
import { useCopyright } from '../composables/useCopyright'
import { MODEL_ID } from '../config/llm'

const emit = defineEmits<{ close: [] }>()

const { info, fullNoticeText, updateInfo, resetToDefaults, DEFAULTS } = useCopyright()

// ── Edit mode ──────────────────────────────────────────────────────────────────

const editOpen = ref(false)

// Per-field edit refs — populated from info when Edit opens
const eOwnerName    = ref('')
const eYear         = ref('')
const eAppName      = ref('')
const eTagline      = ref('')
const eIntent       = ref('')
const eContact      = ref('')
const eInstructions = ref('')
const eCreditFormat = ref('')
const eNotes        = ref('')

function openEdit(): void {
  eOwnerName.value    = info.value.ownerName
  eYear.value         = info.value.year
  eAppName.value      = info.value.appName
  eTagline.value      = info.value.tagline
  eIntent.value       = info.value.intent
  eContact.value      = info.value.permissionContact
  eInstructions.value = info.value.permissionInstructions
  eCreditFormat.value = info.value.creditFormat
  eNotes.value        = info.value.additionalNotes
  editOpen.value      = true
}

function saveEdit(): void {
  updateInfo({
    ownerName:               eOwnerName.value.trim() || DEFAULTS.ownerName,
    year:                    eYear.value.trim()      || DEFAULTS.year,
    appName:                 eAppName.value.trim()   || DEFAULTS.appName,
    tagline:                 eTagline.value.trim(),
    intent:                  eIntent.value.trim(),
    permissionContact:       eContact.value.trim(),
    permissionInstructions:  eInstructions.value.trim(),
    creditFormat:            eCreditFormat.value.trim(),
    additionalNotes:         eNotes.value.trim(),
  })
  editOpen.value = false
}

function cancelEdit(): void {
  editOpen.value = false
}

function handleReset(): void {
  if (!confirm('Reset all copyright details to their defaults?')) return
  resetToDefaults()
  editOpen.value = false
}

// Close edit mode when panel closes
watch(() => false, () => { editOpen.value = false })

// ── Clipboard copies ──────────────────────────────────────────────────────────

const _noticeCopied = ref(false)
const _creditCopied = ref(false)

async function copyNotice(): Promise<void> {
  try {
    await navigator.clipboard.writeText(fullNoticeText.value)
    _noticeCopied.value = true
    setTimeout(() => { _noticeCopied.value = false }, 2000)
  } catch { /* clipboard unavailable */ }
}

async function copyCreditFormat(): Promise<void> {
  try {
    await navigator.clipboard.writeText(info.value.creditFormat)
    _creditCopied.value = true
    setTimeout(() => { _creditCopied.value = false }, 2000)
  } catch { /* */ }
}

// ── AI consequence analysis ───────────────────────────────────────────────────

const aiLoading   = ref(false)
const aiText      = ref('')
const aiError     = ref('')
const aiRan       = ref(false)

async function analyzeConsequences(): Promise<void> {
  aiLoading.value = true
  aiText.value    = ''
  aiError.value   = ''

  const i = info.value
  const prompt = `You are reviewing a software copyright and attribution notice for practical clarity and completeness.

COPYRIGHT DETAILS:
Owner: ${i.ownerName}
Year: ${i.year}
App: ${i.appName}
Tagline: ${i.tagline}

INTENT STATEMENT:
${i.intent}

PERMISSION PROCESS:
Contact: ${i.permissionContact}
Instructions: ${i.permissionInstructions}

CREDIT FORMAT (exact attribution string):
${i.creditFormat}

ADDITIONAL NOTES:
${i.additionalNotes || '(none)'}

Analyze this copyright notice and provide a brief, practical assessment. Structure your response with these sections:

**Gaps or ambiguities** — anything unclear, undefined, or open to interpretation in the intent statement

**Permission process** — is it clear what someone must do, what you will decide, and how long it takes?

**Credit format** — does the attribution string cover the key elements (who made it, what it is, where to find it, year)?

**Edge cases to consider** — scenarios the owner may not have thought through: academic citation, AI training data, resale of generated outputs, internal enterprise use, derivative works, open-source embedding

**Top suggestion** — the single most impactful improvement you would make

Keep the response under 450 words and be specific. Begin with: "⚠ AI draft analysis — not legal advice."`

  try {
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined
    const isLocal = !!(import.meta.env.VITE_OLLAMA_MODEL || import.meta.env.VITE_OLLAMA_BASE_URL)
    if (!apiKey && !isLocal) throw new Error('No AI key configured')
    const client = new Anthropic({ apiKey: apiKey ?? 'local', dangerouslyAllowBrowser: true, timeout: 90_000 })
    const resp = await client.messages.create({
      model: MODEL_ID,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })
    aiText.value = resp.content[0]?.type === 'text' ? resp.content[0].text : 'No response received.'
    aiRan.value  = true
  } catch (err) {
    aiError.value = err instanceof Error ? err.message : 'Analysis failed'
  } finally {
    aiLoading.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <div
      class="fixed inset-0 z-[474] bg-black/20"
      aria-hidden="true"
      @click="emit('close')"
    />

    <!-- Panel -->
    <RightPanel
      class="z-[475] w-[420px] max-w-[95vw] flex flex-col bg-white shadow-2xl"
      role="dialog"
      aria-label="Copyright and Attribution"
    >
      <!-- ── Header ─────────────────────────────────────────────────────────── -->
      <div class="flex items-center gap-2 px-5 py-3.5
                  bg-gradient-to-r from-slate-800 to-slate-700 text-white shrink-0">
        <span class="text-[13px] font-semibold flex-1">© Copyright &amp; Attribution</span>
        <!-- Edit / Done toggle -->
        <button
          v-if="!editOpen"
          type="button"
          class="text-[11px] font-semibold text-white/70 hover:text-white
                 px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 transition-colors
                 focus:outline-none focus:ring-2 focus:ring-white/50"
          @click="openEdit"
        >✏ Edit details</button>
        <template v-else>
          <button
            type="button"
            class="text-[11px] font-semibold text-white
                   px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 transition-colors
                   focus:outline-none focus:ring-2 focus:ring-emerald-300 inline-flex items-center gap-1.5"
            @click="saveEdit"
          >
            <SaveGlyph size="compact" class="h-3 w-auto" aria-hidden="true" />
            <span>Save</span>
          </button>
          <button
            type="button"
            class="text-[11px] font-medium text-white/70 hover:text-white
                   px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors
                   focus:outline-none"
            @click="cancelEdit"
          >Cancel</button>
        </template>

        <!-- Close — universal CloseDot per "Universal Close-Button Rule".
             Positioned at the END of the header so the close pin sits on
             the RIGHT — matches every other panel (universal UX rule). -->
        <CloseDot
          variant="on-dark"
          aria-label="Close copyright panel"
          @click="emit('close')"
        />
      </div>

      <!-- ── Body (scrollable) ──────────────────────────────────────────────── -->
      <ScrollContainer outer-class="flex-1 min-h-0 relative" inner-class="h-full">

        <!-- ═══ NOTICE VIEW ════════════════════════════════════════════════════ -->
        <template v-if="!editOpen">
          <!-- © header card -->
          <div class="bg-gradient-to-br from-slate-800 to-slate-900 text-white px-6 py-6">
            <p class="text-2xl font-bold tracking-tight leading-snug">
              © {{ info.year }} {{ info.ownerName }}
            </p>
            <p class="text-base font-semibold text-white/80 mt-0.5">{{ info.appName }}</p>
            <p class="text-[12px] text-white/50 mt-1 italic">{{ info.tagline }}</p>
          </div>

          <!-- Intent -->
          <div class="px-5 py-4 border-b border-gray-100">
            <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Intent</p>
            <p class="text-[13px] text-gray-700 leading-relaxed">{{ info.intent }}</p>
          </div>

          <!-- How to ask permission -->
          <div class="px-5 py-4 border-b border-gray-100">
            <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
              How to ask permission
            </p>
            <a
              :href="`mailto:${info.permissionContact}`"
              class="text-[13px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline break-all transition-colors"
            >{{ info.permissionContact }}</a>
            <p class="text-[12px] text-gray-500 leading-relaxed mt-2">{{ info.permissionInstructions }}</p>
          </div>

          <!-- How to give credit -->
          <div class="px-5 py-4 border-b border-gray-100">
            <div class="flex items-center justify-between mb-2">
              <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                How to give credit
              </p>
              <button
                type="button"
                class="text-[10px] font-semibold px-2 py-0.5 rounded
                       text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors
                       focus:outline-none focus:ring-1 focus:ring-indigo-300"
                @click="copyCreditFormat"
              >{{ _creditCopied ? '✓ Copied' : '📋 Copy' }}</button>
            </div>
            <!-- Attribution box — styled like a "paste this" block -->
            <div class="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
              <p class="text-[13px] text-slate-800 leading-relaxed italic">{{ info.creditFormat }}</p>
            </div>
            <p class="text-[11px] text-gray-400 mt-2 leading-snug">
              Copy and paste this attribution into any document, presentation, or publication that references SEM App or its outputs.
            </p>
          </div>

          <!-- Additional notes (only when set) -->
          <div
            v-if="info.additionalNotes.trim()"
            class="px-5 py-4 border-b border-gray-100"
          >
            <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
              Additional notes
            </p>
            <p class="text-[13px] text-gray-600 leading-relaxed">{{ info.additionalNotes }}</p>
          </div>

          <!-- Copy full notice -->
          <div class="px-5 py-4 border-b border-gray-100 flex justify-center">
            <button
              type="button"
              class="flex items-center gap-2 px-4 py-2 rounded-xl
                     text-[12px] font-semibold transition-colors
                     bg-slate-100 text-slate-700 hover:bg-slate-200
                     focus:outline-none focus:ring-2 focus:ring-slate-300"
              @click="copyNotice"
            >
              <span>{{ _noticeCopied ? '✓ Copied' : '📋 Copy full notice' }}</span>
            </button>
          </div>

          <!-- ── AI consequence analysis ─────────────────────────────────────── -->
          <div class="px-5 py-4">
            <div class="flex items-center justify-between mb-1.5">
              <p class="text-[10px] font-bold text-violet-500 uppercase tracking-widest">
                🤖 AI Consequence Analysis
              </p>
              <span class="text-[9px] text-gray-400 italic">rough draft · not legal advice</span>
            </div>
            <p class="text-[11px] text-gray-500 leading-snug mb-3">
              Ask AI to flag gaps, ambiguities, edge cases, and one key improvement in your copyright notice.
            </p>

            <!-- Run / Regenerate button -->
            <button
              type="button"
              :disabled="aiLoading"
              class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                     text-[12px] font-semibold transition-colors
                     focus:outline-none focus:ring-2 focus:ring-violet-400"
              :class="aiLoading
                ? 'bg-violet-100 text-violet-400 cursor-not-allowed'
                : 'bg-violet-600 text-white hover:bg-violet-700'"
              @click="analyzeConsequences"
            >
              <span v-if="aiLoading">
                <svg class="h-3.5 w-3.5 animate-spin inline mr-1" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/>
                </svg>
                Analyzing…
              </span>
              <span v-else>{{ aiRan ? '🔄 Re-analyze' : '🤖 Analyze consequences' }}</span>
            </button>

            <!-- Error state -->
            <p v-if="aiError" class="mt-2 text-[11px] text-red-500 leading-snug">⚠ {{ aiError }}</p>

            <!-- Analysis output -->
            <div
              v-if="aiText"
              class="mt-3 rounded-xl bg-violet-50 border border-violet-200 px-4 py-4"
            >
              <!-- Render the AI text: bold **…** headings + paragraphs -->
              <div class="space-y-2">
                <template v-for="(line, i) in aiText.split('\n')" :key="i">
                  <p
                    v-if="line.trim()"
                    class="text-[12px] leading-relaxed"
                    :class="line.startsWith('**') && line.endsWith('**')
                      ? 'font-bold text-violet-800 mt-3 first:mt-0'
                      : line.startsWith('⚠')
                        ? 'text-amber-700 font-medium italic'
                        : 'text-gray-700'"
                    v-html="line
                      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                      .replace(/\*(.*?)\*/g, '<em>$1</em>')"
                  />
                </template>
              </div>
            </div>
          </div>
        </template>

        <!-- ═══ EDIT FORM ═══════════════════════════════════════════════════════ -->
        <template v-else>
          <div class="px-5 py-4 space-y-4">
            <p class="text-[11px] text-gray-400 leading-snug">
              These details appear in the copyright notice on the first page and in the full Copyright panel. All fields are saved immediately.
            </p>

            <!-- Owner Name + Year side-by-side -->
            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1">
                <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Owner name</label>
                <input
                  v-model="eOwnerName"
                  type="text"
                  class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900
                         focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder="Gilb International"
                />
              </div>
              <div class="space-y-1">
                <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Year</label>
                <input
                  v-model="eYear"
                  type="text"
                  class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900
                         focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder="2026"
                />
              </div>
            </div>

            <!-- App Name + Tagline side-by-side -->
            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1">
                <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wide">App name</label>
                <input
                  v-model="eAppName"
                  type="text"
                  class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900
                         focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder="SEM App"
                />
              </div>
              <div class="space-y-1">
                <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Tagline</label>
                <input
                  v-model="eTagline"
                  type="text"
                  class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900
                         focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder="Planguage-based value planning"
                />
              </div>
            </div>

            <!-- Intent -->
            <div class="space-y-1">
              <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Intent</label>
              <p class="text-[10px] text-gray-400 leading-snug">
                Purpose of the software and what permitted use looks like.
              </p>
              <textarea
                v-model="eIntent"
                rows="5"
                class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900
                       resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="SEM App is a proprietary planning tool…"
              />
            </div>

            <!-- Permission contact -->
            <div class="space-y-1">
              <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                Permission contact (email or URL)
              </label>
              <input
                v-model="eContact"
                type="text"
                class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900
                       focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="contact@yourcompany.com"
              />
            </div>

            <!-- Permission instructions -->
            <div class="space-y-1">
              <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                What to include in a permission request
              </label>
              <textarea
                v-model="eInstructions"
                rows="3"
                class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900
                       resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="Include your name, intended use, and context…"
              />
            </div>

            <!-- Credit format -->
            <div class="space-y-1">
              <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                How to give credit — exact attribution string
              </label>
              <p class="text-[10px] text-gray-400 leading-snug">
                This is the text users will copy and paste into their documents. Keep it concise and complete.
              </p>
              <textarea
                v-model="eCreditFormat"
                rows="3"
                class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900
                       resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 font-medium"
                placeholder="Produced using SEM App by…"
              />
            </div>

            <!-- Additional notes -->
            <div class="space-y-1">
              <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                Additional notes
                <span class="normal-case font-normal text-gray-400">(optional)</span>
              </label>
              <textarea
                v-model="eNotes"
                rows="3"
                class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900
                       resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="Any supplementary legal, licence, or use notes…"
              />
            </div>

            <!-- Save / Cancel -->
            <div class="flex gap-2 pt-1">
              <button
                type="button"
                class="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white
                       hover:bg-indigo-700 transition-colors inline-flex items-center justify-center gap-1.5
                       focus:outline-none focus:ring-2 focus:ring-indigo-400"
                @click="saveEdit"
              >
                <SaveGlyph size="compact" class="h-3 w-auto" aria-hidden="true" />
                <span>Save details</span>
              </button>
              <button
                type="button"
                class="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600
                       hover:bg-gray-50 transition-colors
                       focus:outline-none focus:ring-2 focus:ring-gray-300"
                @click="cancelEdit"
              >Cancel</button>
            </div>

            <!-- Reset to defaults -->
            <div class="flex justify-center pt-1 pb-2">
              <button
                type="button"
                class="text-[11px] text-gray-400 hover:text-red-500 transition-colors
                       focus:outline-none underline underline-offset-2"
                @click="handleReset"
              >Reset all fields to defaults</button>
            </div>
          </div>
        </template>

      </ScrollContainer><!-- /body -->
    </RightPanel>
  </Teleport>
</template>
