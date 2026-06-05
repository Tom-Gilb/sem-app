<!--
  EvoCycleLengthPicker.vue — Evo Cycle Length selector banner
  UNIT_TYPE=Widget

  Amber sticky banner at the top of the Evo stage.
  Lets the user pick how long each Evo value delivery cycle will be:
    Day (~8h) · Week (~40h, default) · Month (~160h) · Quarter (~480h)

  When the selection changes:
    1. PlanModel.evoCycleLength is updated immediately via setEvoCycleLength().
    2. Step cards derive "~Nh" estimates from effortPercent × cycleHours — live, no LLM call.
    3. The next "Generate Evo Plan" call injects the cycle constraint into the LLM prompt
       so steps are sized to fit the chosen cycle.

  Tom 2026-06-02 (SEM App Book p.179):
    "Evo steps are designed to fit a specified cycle maximum."
    "In this case a weekly evo cycle was selected."
    "Each Evo step has a set of tools (Analyze spec...Criticize spec) to look at it individually."
    "The specific estimated Evo step impact on a named Value is specified."
    "The % of total solution effort that each step is expected to take, is specified."
    "There is a slider for people to adjust the expected effort for each Evo step."

  Colours: dark amber #92400e bg · amber text + borders · bright amber #d97706 selected button.
  Glyph:   PlEvoStepIcon (< ->+-> canonical amber) — consistent with EvoStep identity.
  Interaction Disclosure rule (DD-009): title on every button.
-->
<script setup lang="ts">
// UNIT_TYPE=Widget
import { computed } from 'vue'
import PlEvoStepIcon from './icons/PlEvoStepIcon.vue'
import { EVO_CYCLE_HOURS, setEvoCycleLength } from '../composables/useSpecModel'

const props = withDefaults(defineProps<{
  /** Currently selected cycle length from PlanModel.evoCycleLength */
  modelValue: 'day' | 'week' | 'month' | 'quarter'
}>(), {
  modelValue: 'week',
})

const emit = defineEmits<{
  'update:modelValue': [value: 'day' | 'week' | 'month' | 'quarter']
}>()

type CycleKey = 'day' | 'week' | 'month' | 'quarter'

const OPTIONS: Array<{ key: CycleKey; label: string; hours: number }> = [
  { key: 'day',     label: 'Day',     hours: EVO_CYCLE_HOURS.day     },
  { key: 'week',    label: 'Week',    hours: EVO_CYCLE_HOURS.week    },
  { key: 'month',   label: 'Month',   hours: EVO_CYCLE_HOURS.month   },
  { key: 'quarter', label: 'Quarter', hours: EVO_CYCLE_HOURS.quarter },
]

const currentHours = computed(() => EVO_CYCLE_HOURS[props.modelValue])
const currentLabel = computed(() => OPTIONS.find(o => o.key === props.modelValue)?.label ?? 'Week')

function select(key: CycleKey): void {
  setEvoCycleLength(key)
  emit('update:modelValue', key)
}
</script>

<template>
  <!--
    Amber banner — deliberately prominent to show this is a global cycle constraint.
    Sticky so it remains visible as the step list scrolls.
    z-10 keeps it above step cards but below modal overlays.
  -->
  <div
    class="flex items-center gap-3 flex-wrap mb-4 px-4 py-2.5 rounded-xl
           bg-amber-900 border border-amber-700 shadow-md sticky top-0 z-10"
    role="region"
    aria-label="Evo Cycle Length selector"
  >
    <!-- Left: glyph + label + description -->
    <div class="flex items-center gap-2 min-w-0 flex-1">
      <!-- EvoStep glyph — amber family, matches the step cards -->
      <PlEvoStepIcon size="sm" class="shrink-0 opacity-90" aria-hidden="true" />

      <div class="min-w-0">
        <span class="block text-[10px] font-bold tracking-widest text-amber-400 uppercase leading-none">
          EVO CYCLE LENGTH
        </span>
        <span class="block text-xs text-amber-200 leading-snug mt-0.5">
          Current: <strong class="text-amber-100">{{ currentLabel }} (~{{ currentHours }} h)</strong>
          · Each Evo step fits within one cycle
          · AI plans and estimates to match
        </span>
      </div>
    </div>

    <!-- Right: 4 segmented option buttons -->
    <div
      class="flex items-stretch gap-1 shrink-0 rounded-lg overflow-hidden
             border border-amber-700 bg-amber-950 p-0.5"
      role="radiogroup"
      aria-label="Select Evo cycle duration"
    >
      <button
        v-for="opt in OPTIONS"
        :key="opt.key"
        type="button"
        role="radio"
        :aria-checked="modelValue === opt.key"
        :title="`Set Evo cycle to ${opt.label} (~${opt.hours}h per step) · AI generation will size steps to fit`"
        class="flex flex-col items-center justify-center px-3 py-1.5 rounded-md text-center
               transition-all duration-150 min-w-[54px] focus:outline-none focus:ring-2 focus:ring-amber-400"
        :class="modelValue === opt.key
          ? 'bg-amber-500 text-amber-950 shadow-inner font-semibold'
          : 'text-amber-300 hover:bg-amber-800 hover:text-amber-100'"
        @click="select(opt.key)"
      >
        <span class="text-xs font-semibold leading-tight">{{ opt.label }}</span>
        <span class="text-[10px] leading-none mt-0.5 opacity-80">~{{ opt.hours }} h</span>
      </button>
    </div>
  </div>
</template>
