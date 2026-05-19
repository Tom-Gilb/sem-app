<template>
  <div class="shrink-0 flex items-baseline gap-3 px-4 py-2 bg-gray-50 border-b border-gray-200/70">
    <!-- Level 1: always-visible short text -->
    <p class="flex-1 text-[11px] text-gray-400 leading-snug italic select-none">{{ short }}</p>

    <!-- Level 2: 💡 Illuminate button — opens Illuminate panel for the canonical term -->
    <button
      v-if="spec"
      type="button"
      class="shrink-0 inline-flex items-center gap-1 text-[10px] font-medium
             text-indigo-400/70 hover:text-indigo-600 transition-colors
             focus:outline-none focus:ring-1 focus:ring-indigo-400 rounded px-1 -mx-1
             whitespace-nowrap"
      :title="`Illuminate '${term}' in the glossary`"
      :aria-label="`Illuminate: ${term}`"
      @click="handleLookup"
    >
      <span aria-hidden="true">💡</span>
      <span>{{ term }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
// UNIT_TYPE=Widget
import { defineTerm } from '../composables/useDefine'
import type { SpecBlock } from '../types/spec'

const props = defineProps<{
  /** Canonical Planguage term sent to defineTerm() */
  term:  string
  /** Always-visible one-liner shown inline */
  short: string
  /** Spec context for the Illuminate LLM call — pass null to hide the Illuminate button */
  spec?: SpecBlock | null
}>()

function handleLookup(): void {
  if (props.spec) {
    defineTerm(props.term, props.spec)
  }
}
</script>
