<!--
  QualifiersBar.vue — UNIVERSAL Qualifiers (Conditions) bar (Tom Gilb r93rrr 2026-06-12).

  Tom verbatim 2026-06-12 (the unification call): *"3 classes, everywhere"*. This
  component is the SINGLE source of truth for the Qualifiers UI affordance across
  every SEM App surface that edits a scalar Planguage spec. Mount it in:
    - ValueAspectsPanel (per-Aspect row, below the parameter grid)
    - PentaPanel (per Value / Function / Solution / Constraint / Resource entry)
    - Phase 2: Spec Editor, Sharpen Plan, MultiVision, Decision Mapper, Stakeholder
      Mapper, IET — every per-spec editing surface

  CANONICAL 3-CLASS TAXONOMY (per Planguage Glossary, Twin-verified r93ooo):
    - Time  (*153) — when: dates, deadlines, weekdays, hours, operational windows
    - Place (*107) — where: geography, user type/role, system component, market segment
    - Event (*062) — if: occurrences, scenarios, system states ("Peace", "If Approved")

  AND-logic is DEFINITIONAL per Glossary *124: all classes in `[A, B, C]` must be
  true simultaneously. NO OR-form; OR-need = two Sets with different Qualifiers
  (Phase 2 r93kkk multi-set + CRITICAL flag + Two-Trigger UX).

  INFINITY TRAP warning (r93mmm SUPREME): when ALL three classes are empty, the bar
  switches to red and shows the *"No Qualifiers = INFINITY TRAP"* teaching with a
  one-click Twin Consultant *124 Qualifier link. Tom verbatim:
    *"INFINITY (no finiteness with Qualifiers) = INFINITE COSTS + FINITE CERTAINTY
    OF FAILURE to have enough resources to deliver Value in INFINITE SPACE AND TIME."*

  Canonical Planguage book preview line (r93fff): when at least one class is filled,
  renders `<LevelLabel> [<filled tags>]: <level-preview>` per the Spec-Tag-Uppermost-
  with-Colon convention.

  TWIN-AS-DESTINATION (r93ppp): every Infinity Trap warning links to the Tom Gilb
  Consultant Twin (by Kai Gilb) — funding-loop brick. Tom verbatim *"anything you
  can do to bring people directly to the Twin helps Kai earn money"*.

  Cite: https://www.gilb.com/tomtwin/concept/Qualifier.124 (Twin Consultant).
-->
<script setup lang="ts">
// UNIT_TYPE=Widget
import { computed } from 'vue'

/** Conditions shape — accepts both canonical (time/place/event) and legacy (when/where/what/how/why) field names per r93rrr migration. */
interface QualifiersValue {
  time?:  string
  place?: string
  event?: string
  when?:  string
  where?: string
  what?:  string
  how?:   string
  why?:   string
}

const props = withDefaults(defineProps<{
  /** Current conditions object — supports canonical + legacy fields */
  modelValue?: QualifiersValue | null | undefined
  /** Optional entry name (Spec Tag or Aspect name) for richer HoverHints */
  entryName?: string
  /** Optional level value to preview in canonical Planguage book form (e.g. the Goal) */
  levelPreview?: string
  /** Label for the preview line — defaults to 'Goal' */
  levelLabel?: string
  /** Visual variant — 'default' (full bar with preview + warning) or 'compact' (chips only) */
  variant?: 'default' | 'compact'
}>(), {
  modelValue: () => ({}),
  entryName: '',
  levelPreview: '',
  levelLabel: 'Goal',
  variant: 'default',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: QualifiersValue): void
}>()

/** Read canonical field with legacy fallback alias per r93rrr migration. */
const timeValue  = computed<string>(() => props.modelValue?.time  ?? props.modelValue?.when  ?? '')
const placeValue = computed<string>(() => props.modelValue?.place ?? props.modelValue?.where ?? '')
const eventValue = computed<string>(() => props.modelValue?.event ?? props.modelValue?.what  ?? props.modelValue?.how ?? '')

const anyFilled = computed<boolean>(() => Boolean(timeValue.value || placeValue.value || eventValue.value))

/** Canonical Planguage bracketed form `[<filled>, <filled>, ...]` */
const bracketedTags = computed<string>(() => {
  return [timeValue.value, placeValue.value, eventValue.value].filter(Boolean).join(', ')
})

function onInput(klass: 'time' | 'place' | 'event', e: Event): void {
  const target = e.target as HTMLInputElement
  emit('update:modelValue', { ...(props.modelValue ?? {}), [klass]: target.value })
}
</script>

<template>
  <div
    class="rounded-lg ring-1 px-3 py-2"
    :class="anyFilled
      ? 'bg-violet-50/70 ring-violet-300'
      : 'bg-red-50 ring-2 ring-red-400'"
  >
    <!-- Chips row -->
    <div class="flex items-center gap-2 flex-wrap text-[11px]">
      <span
        class="font-bold uppercase tracking-wider text-[10px] shrink-0"
        :class="anyFilled ? 'text-violet-800' : 'text-red-800'"
      >
        Qualifiers
        <span
          v-if="!anyFilled"
          class="ml-1 text-red-700 font-extrabold"
        >⚠ [∞] INFINITY TRAP</span>
      </span>

      <!-- Open bracket -->
      <span class="font-mono font-bold text-violet-700 shrink-0">[</span>

      <!-- TIME chip (*153) -->
      <label
        class="inline-flex items-center gap-1 shrink-0"
        :title="`Time qualifier (when) — Planguage Glossary *153 Time, composes with *124 Qualifier + *666 Qualifier Condition. Examples: Q1.2026, Next Year, After Launch, Peak Hours 08:00–18:00 UTC. Tom Gilb: \&quot;the when: answer can easily drive solution costs up by 10X.\&quot; AND-logic — must coexist with Place + Event for finite scope.`"
      >
        <span class="font-mono text-[10px] uppercase tracking-wide text-violet-600">Time:</span>
        <input
          :value="timeValue"
          type="text"
          placeholder="when?"
          class="font-mono text-[12px] px-1.5 py-0.5 rounded border-0 bg-white ring-1 ring-violet-300 focus:ring-2 focus:ring-violet-500 focus:outline-none w-[10rem]"
          @input="(e) => onInput('time', e)"
        />
      </label>

      <!-- PLACE chip (*107) -->
      <label
        class="inline-flex items-center gap-1 shrink-0"
        :title="`Place qualifier (where) — Planguage Glossary *107 Place, composes with *124 Qualifier + *666 Qualifier Condition. Examples: EU.Region, Mobile.Devices, Premium.Users, US-East datacenter, Consumer.Market. Includes user type, role, system component, market segment (per Twin Glossary *124).`"
      >
        <span class="font-mono text-[10px] uppercase tracking-wide text-violet-600">Place:</span>
        <input
          :value="placeValue"
          type="text"
          placeholder="where?"
          class="font-mono text-[12px] px-1.5 py-0.5 rounded border-0 bg-white ring-1 ring-violet-300 focus:ring-2 focus:ring-violet-500 focus:outline-none w-[10rem]"
          @input="(e) => onInput('place', e)"
        />
      </label>

      <!-- EVENT chip (*062) -->
      <label
        class="inline-flex items-center gap-1 shrink-0"
        :title="`Event qualifier (if) — Planguage Glossary *062 Event, composes with *124 Qualifier + *666 Qualifier Condition. Examples: Peace, Cyberattack.Active, If Sale Agreed, Status = Approved, If Fierce Competition on Price. Tolstoy mnemonic: a spec that applies in war OR peace likely applies in every other event too — bound it.`"
      >
        <span class="font-mono text-[10px] uppercase tracking-wide text-violet-600">Event:</span>
        <input
          :value="eventValue"
          type="text"
          placeholder="if?"
          class="font-mono text-[12px] px-1.5 py-0.5 rounded border-0 bg-white ring-1 ring-violet-300 focus:ring-2 focus:ring-violet-500 focus:outline-none w-[10rem]"
          @input="(e) => onInput('event', e)"
        />
      </label>

      <!-- Close bracket -->
      <span class="font-mono font-bold text-violet-700 shrink-0">]</span>
    </div>

    <!-- Canonical Planguage book preview line (renders when at least one filled) -->
    <p
      v-if="anyFilled && variant === 'default'"
      class="font-mono text-[12px] text-violet-900 mt-1.5 leading-snug"
    >
      <b>{{ levelLabel }} [{{ bracketedTags }}]:</b> {{ levelPreview || '—' }}
      <span class="text-[10px] text-violet-600 italic ml-2">canonical Planguage form per *124 Qualifier (AND-logic, definitional)</span>
    </p>

    <!-- Infinity Trap inline warning (when all three empty) -->
    <p
      v-else-if="!anyFilled && variant === 'default'"
      class="text-[11px] text-red-900 mt-1.5 leading-snug"
    >
      <b>No Qualifiers = INFINITY TRAP.</b>
      Bound {{ entryName ? `"${entryName}"` : 'this spec' }} in Time + Place + Event or risk infinite costs.
      <a
        href="https://www.gilb.com/tomtwin/concept/Qualifier.124"
        target="_blank"
        rel="noopener"
        class="text-violet-700 underline font-bold"
      >*124 Qualifier ↗</a>
      <span class="text-[10px] text-red-700 italic ml-1">(via Tom Gilb Consultant Twin, by Kai Gilb)</span>
    </p>
  </div>
</template>
