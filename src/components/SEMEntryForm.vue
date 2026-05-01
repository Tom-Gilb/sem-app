<!-- UNIT_TYPE=Widget -->
<!-- SEMEntryForm — Stakes · Ends · Means entry form
     Mobile-first: stacked layout at 375px base; two-column label/input at md:
     All touch targets ≥ 44×44px per MOBILE_03
     Spec: S.EvoStep1.TailwindMobileFirstForm / F.ImplementVue3SPAForm -->

<script setup lang="ts">
import { computed } from 'vue'
import { useEntryForm } from '../composables/useEntryForm'
import { useValidation } from '../composables/useValidation'

const emit = defineEmits<{
  submit: [payload: { stakes: string; ends: string; means: string }]
}>()

const { state, setStakes, setEnds, setMeans, setSubmitting, setHasSubmitted } = useEntryForm()
const { errors, validate, clearErrors } = useValidation()

const fields = computed(() => ({
  stakes: state.stakes,
  ends: state.ends,
  means: state.means,
}))

function handleSubmit() {
  const valid = validate(fields.value)
  if (!valid) return
  setSubmitting(true)
  setHasSubmitted(true)
  emit('submit', { ...fields.value })
  setSubmitting(false)
}

function handleInput(field: 'stakes' | 'ends' | 'means', value: string) {
  if (field === 'stakes') setStakes(value)
  if (field === 'ends') setEnds(value)
  if (field === 'means') setMeans(value)
  // Clear the error for this field as the user types
  clearErrors()
}
</script>

<template>
  <form
    class="w-full max-w-2xl mx-auto px-4 py-6 space-y-6"
    novalidate
    @submit.prevent="handleSubmit"
  >
    <!-- Header -->
    <div class="space-y-1">
      <h1 class="text-2xl font-semibold text-gray-900">SEM Entry</h1>
      <p class="text-sm text-gray-500">
        Express your plan as Stakes · Ends · Means — the app translates it into a
        Planguage spec.
      </p>
    </div>

    <!-- Stakes field -->
    <div class="space-y-1">
      <label
        for="sem-stakes"
        class="block text-sm font-medium text-gray-700"
      >
        <span class="font-semibold text-gray-900">Stakes</span>
        <span class="ml-2 text-gray-400 font-normal">— Stakeholder</span>
      </label>
      <p class="text-xs text-gray-400">
        Who cares about this outcome? e.g. "As a product manager…" or "I as a parent…"
      </p>
      <textarea
        id="sem-stakes"
        :value="state.stakes"
        rows="2"
        placeholder="I as [stakeholder role]…"
        class="w-full min-h-[44px] rounded-lg border px-3 py-2.5 text-sm text-gray-900
               placeholder-gray-400 resize-none
               focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
               transition-colors duration-150"
        :class="errors.stakes ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'"
        :aria-describedby="errors.stakes ? 'stakes-error' : undefined"
        :aria-invalid="!!errors.stakes"
        @input="handleInput('stakes', ($event.target as HTMLTextAreaElement).value)"
      />
      <p
        v-if="errors.stakes"
        id="stakes-error"
        class="text-xs text-red-600 flex items-center gap-1"
        role="alert"
      >
        {{ errors.stakes }}
      </p>
    </div>

    <!-- Ends field -->
    <div class="space-y-1">
      <label
        for="sem-ends"
        class="block text-sm font-medium text-gray-700"
      >
        <span class="font-semibold text-gray-900">Ends</span>
        <span class="ml-2 text-gray-400 font-normal">— Value / Goal</span>
      </label>
      <p class="text-xs text-gray-400">
        What measurable outcome do you want to achieve? e.g. "…want to achieve 90% user
        retention…"
      </p>
      <textarea
        id="sem-ends"
        :value="state.ends"
        rows="2"
        placeholder="…want to achieve [measurable outcome]…"
        class="w-full min-h-[44px] rounded-lg border px-3 py-2.5 text-sm text-gray-900
               placeholder-gray-400 resize-none
               focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
               transition-colors duration-150"
        :class="errors.ends ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'"
        :aria-describedby="errors.ends ? 'ends-error' : undefined"
        :aria-invalid="!!errors.ends"
        @input="handleInput('ends', ($event.target as HTMLTextAreaElement).value)"
      />
      <p
        v-if="errors.ends"
        id="ends-error"
        class="text-xs text-red-600 flex items-center gap-1"
        role="alert"
      >
        {{ errors.ends }}
      </p>
    </div>

    <!-- Means field -->
    <div class="space-y-1">
      <label
        for="sem-means"
        class="block text-sm font-medium text-gray-700"
      >
        <span class="font-semibold text-gray-900">Means</span>
        <span class="ml-2 text-gray-400 font-normal">— Solution / Strategy</span>
      </label>
      <p class="text-xs text-gray-400">
        How will you achieve it? Design, strategy, or architecture. e.g. "…by implementing a
        loyalty programme."
      </p>
      <textarea
        id="sem-means"
        :value="state.means"
        rows="2"
        placeholder="…using / by [design or strategy]."
        class="w-full min-h-[44px] rounded-lg border px-3 py-2.5 text-sm text-gray-900
               placeholder-gray-400 resize-none
               focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
               transition-colors duration-150"
        :class="errors.means ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'"
        :aria-describedby="errors.means ? 'means-error' : undefined"
        :aria-invalid="!!errors.means"
        @input="handleInput('means', ($event.target as HTMLTextAreaElement).value)"
      />
      <p
        v-if="errors.means"
        id="means-error"
        class="text-xs text-red-600 flex items-center gap-1"
        role="alert"
      >
        {{ errors.means }}
      </p>
    </div>

    <!-- Submit -->
    <button
      type="submit"
      :disabled="state.isSubmitting"
      class="w-full min-h-[44px] rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold
             text-white shadow-sm
             hover:bg-blue-700 focus-visible:outline focus-visible:outline-2
             focus-visible:outline-offset-2 focus-visible:outline-blue-600
             disabled:opacity-50 disabled:cursor-not-allowed
             transition-colors duration-150"
    >
      <span v-if="state.isSubmitting">Generating spec…</span>
      <span v-else>Generate Planguage Spec →</span>
    </button>
  </form>
</template>
