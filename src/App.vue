<script setup lang="ts">
import { ref } from 'vue'
import SEMEntryForm from './components/SEMEntryForm.vue'
import SpecOutput from './components/SpecOutput.vue'
import { useSDK } from './composables/useSDK'
import { useSpecExport } from './composables/useSpecExport'

const { loading, error, translate } = useSDK()
const { serialise } = useSpecExport()

const markdown = ref('')

async function handleSubmit(payload: { stakes: string; ends: string; means: string }) {
  markdown.value = ''
  const spec = await translate(payload.stakes, payload.ends, payload.means)
  if (spec) {
    markdown.value = serialise(spec)
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex flex-col items-center justify-start pt-8 pb-16 px-4">
    <SEMEntryForm @submit="handleSubmit" />
    <div class="w-full max-w-xl">
      <SpecOutput :loading="loading" :error="error" :markdown="markdown" />
    </div>
  </div>
</template>
