<!-- SemMetadataPanel.vue — SEM App scoreboard drawer.
     Shows build snapshot constants (versions, counts, dates) and live session
     counters (plans exported, voice commands, PHI checks, etc.).
     Header accent: fuchsia → rose gradient.
     Grouped into 4 sections: Build, Lifetime, Counters, Fun.
     Reset counters button (requires window.confirm for safety).

     Props: none (reads from useSemMetadata singleton)
     Emits: close -->

<script setup lang="ts">
import { computed }    from 'vue'
import RightPanel      from './RightPanel.vue'
import CloseDot        from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'
import { useSemMetadata, type SemMetadataField } from '../composables/useSemMetadata'

const emit = defineEmits<{ close: [] }>()

const { fields, daysSinceStart, resetAllCounters } = useSemMetadata()

// ── Group specs ───────────────────────────────────────────────────────────────

interface GroupSpec {
  key:    'build' | 'lifetime' | 'counters' | 'fun'
  label:  string
  accent: 'indigo' | 'amber' | 'emerald' | 'violet'
}

const GROUPS: GroupSpec[] = [
  { key: 'build',    label: 'Build',    accent: 'indigo'  },
  { key: 'lifetime', label: 'Lifetime', accent: 'amber'   },
  { key: 'counters', label: 'Counters', accent: 'emerald' },
  { key: 'fun',      label: 'Fun',      accent: 'violet'  },
]

// Literal Tailwind classes — no dynamic concatenation (purge-safe)
const ACCENT_LABEL: Record<string, string> = {
  indigo:  'text-indigo-700  bg-indigo-50  border-indigo-100',
  amber:   'text-amber-700   bg-amber-50   border-amber-100',
  emerald: 'text-emerald-700 bg-emerald-50 border-emerald-100',
  violet:  'text-violet-700  bg-violet-50  border-violet-100',
}
const ACCENT_BADGE: Record<string, string> = {
  indigo:  'bg-indigo-100  text-indigo-700',
  amber:   'bg-amber-100   text-amber-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  violet:  'bg-violet-100  text-violet-700',
}

const bucketed = computed(() => {
  const out: Record<string, SemMetadataField[]> = {}
  for (const g of GROUPS) out[g.key] = []
  for (const f of fields.value) {
    if (out[f.group]) out[f.group].push(f)
  }
  return out
})

function displayValue(f: SemMetadataField): string {
  if (f.value === null) return f.note ?? 'tracking soon'
  if (typeof f.value === 'number') {
    return f.value.toLocaleString() + (f.unit ? ` ${f.unit}` : '')
  }
  return String(f.value)
}

function confirmResetAll(): void {
  if (window.confirm('Reset all counters to zero? This cannot be undone.')) {
    resetAllCounters()
  }
}
</script>

<template>
  <Teleport to="body">
    <!-- Click-outside backdrop -->
    <div
      class="fixed inset-0 z-[489]"
      aria-hidden="true"
      @click="emit('close')"
    />

    <!-- Drawer -->
    <RightPanel
      class="z-[490] w-96 bg-white shadow-2xl border-l border-fuchsia-100 flex flex-col overflow-hidden"
      role="dialog"
      aria-label="SEM Metadata"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-3
                  bg-gradient-to-r from-fuchsia-700 to-rose-600 text-white shrink-0">
        <div class="flex items-center gap-2">
          <span class="text-lg" aria-hidden="true">🧬</span>
          <div>
            <p class="text-sm font-bold uppercase tracking-wider leading-none">SEM METADATA</p>
            <p class="text-[10px] text-fuchsia-200 mt-0.5 leading-none">{{ daysSinceStart }} days alive</p>
          </div>
        </div>
        <CloseDot
          variant="on-dark"
          aria-label="Close SEM Metadata"
          @click="emit('close')"
        />
      </div>

      <!-- Scrollable body -->
      <ScrollContainer outer-class="flex-1 min-h-0 relative" inner-class="h-full px-4 py-4 space-y-5">

        <!-- Groups -->
        <section
          v-for="group in GROUPS"
          :key="group.key"
        >
          <!-- Group header -->
          <p :class="['text-[10px] font-bold uppercase tracking-widest mb-2 px-2 py-1 rounded-md border text-center', ACCENT_LABEL[group.accent]]">
            {{ group.label }}
          </p>

          <!-- Fields -->
          <div class="space-y-1">
            <div
              v-for="field in bucketed[group.key]"
              :key="field.key"
              class="flex items-center gap-2 px-1"
            >
              <span class="text-sm flex-shrink-0" aria-hidden="true">{{ field.emoji }}</span>
              <span class="text-xs text-slate-600 flex-1 leading-snug">{{ field.label }}</span>
              <span
                :class="['text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 tabular-nums', ACCENT_BADGE[group.accent]]"
              >{{ displayValue(field) }}</span>
            </div>
          </div>
        </section>

        <!-- Reset counters -->
        <div class="border-t border-slate-100 pt-4">
          <button
            type="button"
            class="w-full text-xs text-slate-400 hover:text-red-600 hover:bg-red-50
                   rounded-lg px-3 py-2 transition-colors focus:outline-none focus:ring-2 focus:ring-red-300"
            @click="confirmResetAll"
          >
            ↺ Reset all counters to zero
          </button>
        </div>

        <!-- Bottom padding -->
        <div class="h-4" />
      </ScrollContainer>
    </RightPanel>
  </Teleport>
</template>
