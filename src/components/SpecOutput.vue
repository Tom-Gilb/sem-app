<!-- UNIT_TYPE=Widget -->
<!-- SpecOutput — displays the generated Planguage Markdown spec -->
<!-- Spec: S.EvoStep2.PipelineHandler / V.EvoStep2.TranslationExitGate -->
<template>
  <section
    v-if="loading || error || markdown"
    aria-label="Generated Planguage Specification"
    class="w-full mt-6"
  >
    <!-- Loading state -->
    <div
      v-if="loading"
      role="status"
      aria-live="polite"
      aria-label="Generating specification"
      class="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <span
        class="inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700"
        aria-hidden="true"
      />
      <span class="text-sm text-slate-600">Generating specification…</span>
    </div>

    <!-- Error state -->
    <div
      v-else-if="error"
      role="alert"
      aria-live="assertive"
      class="rounded-xl border border-red-200 bg-red-50 p-5 shadow-sm"
    >
      <p class="text-sm font-semibold text-red-700">Translation failed</p>
      <p class="mt-1 text-sm text-red-600">{{ error }}</p>
    </div>

    <!-- Result state -->
    <div
      v-else-if="markdown"
      class="rounded-xl border border-slate-200 bg-white shadow-sm"
    >
      <!-- Header bar -->
      <div class="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 class="text-sm font-semibold text-slate-700">Generated Spec</h2>
        <button
          type="button"
          :aria-label="copied ? 'Copied to clipboard' : 'Copy spec to clipboard'"
          :title="copied ? 'Copied!' : 'Copy to clipboard'"
          class="flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 active:bg-slate-200"
          @click="copyToClipboard"
        >
          <!-- Check icon (copied) -->
          <svg
            v-if="copied"
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5 text-green-600"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fill-rule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clip-rule="evenodd"
            />
          </svg>
          <!-- Clipboard icon (default) -->
          <svg
            v-else
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M8 2a2 2 0 00-2 2v1H5a2 2 0 00-2 2v9a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H8zm0 2h4v1H8V4zm-3 3h10v9H5V7z" />
          </svg>
        </button>
      </div>

      <!-- Markdown content -->
      <pre
        class="overflow-x-auto whitespace-pre-wrap break-words px-4 py-4 font-mono text-xs leading-relaxed text-slate-800"
        aria-label="Planguage specification output"
      >{{ markdown }}</pre>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  loading: boolean
  error: string
  markdown: string
}>()

const copied = ref(false)

async function copyToClipboard() {
  if (!props.markdown) return
  try {
    await navigator.clipboard.writeText(props.markdown)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    // Fallback: select text for manual copy
    const pre = document.querySelector('pre[aria-label="Planguage specification output"]')
    if (pre) {
      const range = document.createRange()
      range.selectNodeContents(pre)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
    }
  }
}
</script>
