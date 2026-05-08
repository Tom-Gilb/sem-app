<!-- UNIT_TYPE=Widget -->
<!-- ComparisonMode — Side-by-side SEM spec generation -->
<!-- Feature #17: Two independent SEMEntryForm + SpecOutput pairs side by side -->
<!-- Desktop (≥768px): two columns; mobile: stacked -->

<script setup lang="ts">
import { ref } from 'vue'
import SEMEntryForm from './SEMEntryForm.vue'
import SpecOutput from './SpecOutput.vue'
import { useSDK } from '../composables/useSDK'
import { useSpecExport } from '../composables/useSpecExport'
import type { SpecBlock } from '../types/spec'

const emit = defineEmits<{
  close: []
}>()

// --- Side A pipeline ---
const { loading: loadingA, error: errorA, translate: translateA } = useSDK()
const { serialise: serialiseA } = useSpecExport()
const specA = ref<SpecBlock | null>(null)
const markdownA = ref('')
const originalInputA = ref<{ stakes: string; ends: string; means: string } | null>(null)

async function handleSubmitA(payload: { stakes: string; ends: string; means: string }) {
  specA.value = null
  markdownA.value = ''
  originalInputA.value = { ...payload }
  const spec = await translateA(payload.stakes, payload.ends, payload.means)
  if (spec) {
    specA.value = spec
    markdownA.value = serialiseA(spec)
  }
}

// --- Side B pipeline ---
const { loading: loadingB, error: errorB, translate: translateB } = useSDK()
const { serialise: serialiseB } = useSpecExport()
const specB = ref<SpecBlock | null>(null)
const markdownB = ref('')
const originalInputB = ref<{ stakes: string; ends: string; means: string } | null>(null)

async function handleSubmitB(payload: { stakes: string; ends: string; means: string }) {
  specB.value = null
  markdownB.value = ''
  originalInputB.value = { ...payload }
  const spec = await translateB(payload.stakes, payload.ends, payload.means)
  if (spec) {
    specB.value = spec
    markdownB.value = serialiseB(spec)
  }
}
</script>

<template>
  <div class="w-full max-w-7xl mx-auto px-4 pb-16">

    <!-- Header bar -->
    <div
      class="w-full rounded-xl mb-6 px-5 py-3 flex items-center justify-between
             bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md"
    >
      <h1 class="text-base font-semibold tracking-tight">
        ⇄ Comparison Mode — side-by-side spec generation
      </h1>

      <!-- Back to single view button -->
      <button
        type="button"
        class="min-h-[44px] px-4 rounded-lg bg-white/20 text-white text-sm font-medium
               hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white/60
               transition-colors duration-150 flex items-center gap-1.5"
        aria-label="Back to single view"
        @click="emit('close')"
      >
        ← Back to single view
      </button>
    </div>

    <!-- Two-panel layout -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">

      <!-- Panel A -->
      <div class="min-w-0">
        <div class="mb-3 px-1">
          <span
            class="inline-block rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold px-3 py-1"
          >
            Entry A
          </span>
        </div>
        <SEMEntryForm @submit="handleSubmitA" />
        <div class="w-full mt-2">
          <SpecOutput
            :loading="loadingA"
            :error="errorA"
            :spec="specA"
            :markdown="markdownA"
            :raw-input="originalInputA"
          />
        </div>
      </div>

      <!-- Panel B -->
      <div class="min-w-0">
        <div class="mb-3 px-1">
          <span
            class="inline-block rounded-full bg-purple-100 text-purple-700 text-xs font-semibold px-3 py-1"
          >
            Entry B
          </span>
        </div>
        <SEMEntryForm @submit="handleSubmitB" />
        <div class="w-full mt-2">
          <SpecOutput
            :loading="loadingB"
            :error="errorB"
            :spec="specB"
            :markdown="markdownB"
            :raw-input="originalInputB"
          />
        </div>
      </div>

    </div>
  </div>
</template>
