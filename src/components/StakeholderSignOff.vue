<!-- UNIT_TYPE=Widget -->
<!-- Feature #25 — Stakeholder Sign-Off Panel -->
<!-- Extracts stakeholder names from a SpecBlock and tracks approval status locally. -->
<template>
  <div class="rounded-xl border border-violet-200 bg-violet-50 p-4 space-y-3" aria-label="Stakeholder sign-off panel">

    <!-- Progress bar -->
    <div>
      <div class="flex items-center justify-between mb-1">
        <p class="text-xs font-semibold text-violet-700">Sign-Off Progress</p>
        <p class="text-xs text-violet-600">{{ approvedCount }} / {{ stakeholders.length }} approved</p>
      </div>
      <div class="w-full h-2 bg-violet-100 rounded-full overflow-hidden">
        <div
          class="h-2 bg-emerald-500 rounded-full transition-all duration-500"
          :style="{ width: progressWidth }"
          role="progressbar"
          :aria-valuenow="approvedCount"
          :aria-valuemax="stakeholders.length"
          aria-label="Approval progress"
        />
      </div>
    </div>

    <!-- All-approved banner -->
    <div
      v-if="allApproved"
      role="status"
      aria-live="polite"
      class="rounded-lg bg-emerald-100 border border-emerald-200 px-3 py-2.5 text-sm font-medium text-emerald-700 text-center"
    >
      All stakeholders have approved this spec ✓
    </div>

    <!-- Stakeholder rows -->
    <ul class="space-y-2" aria-label="Stakeholders">
      <li
        v-for="name in stakeholders"
        :key="name"
        class="flex items-center gap-3 rounded-lg bg-white border border-violet-100 px-3 py-2"
      >
        <!-- Name + status indicator -->
        <div class="flex-1 min-w-0">
          <p class="text-sm font-bold text-slate-800 truncate">{{ name }}</p>
          <p class="text-xs mt-0.5" :class="statusTextClass(name)">
            {{ statusLabel(name) }}
          </p>
        </div>

        <!-- Approve button -->
        <button
          type="button"
          :aria-label="`Approve for ${name}`"
          class="min-h-[44px] px-3 text-xs font-medium rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors
                 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          :class="statuses[name] === 'approved' ? 'ring-2 ring-emerald-400' : ''"
          @click="setStatus(name, 'approved')"
        >
          ✓ Approve
        </button>

        <!-- Revise button -->
        <button
          type="button"
          :aria-label="`Request revision for ${name}`"
          class="min-h-[44px] px-3 text-xs font-medium rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors
                 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
          :class="statuses[name] === 'revise' ? 'ring-2 ring-amber-400' : ''"
          @click="setStatus(name, 'revise')"
        >
          ↺ Revise
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { SpecBlock } from '../types/spec'

const props = defineProps<{
  spec: SpecBlock | null
}>()

// ── Stakeholder extraction ────────────────────────────────────────────────────

/**
 * Scan all V. entry descriptions for capitalised words following
 * "Stakeholder:", "for", "by", or "of".
 * Deduplicate; fall back to default list if none found.
 */
const stakeholders = computed<string[]>(() => {
  const found = new Set<string>()

  if (props.spec) {
    const allDescriptions = [
      ...props.spec.values.map((v) => v.description),
      ...props.spec.functions.map((f) => f.description),
      ...props.spec.solutions.map((s) => s.description),
    ]

    // Match capitalised words following the trigger words/phrases
    const pattern = /(?:Stakeholder:\s*|(?:\bfor|\bby|\bof)\s+)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g

    for (const desc of allDescriptions) {
      let match: RegExpExecArray | null
      while ((match = pattern.exec(desc)) !== null) {
        found.add(match[1].trim())
      }
    }
  }

  if (found.size === 0) {
    return ['Reviewer', 'Sponsor', 'Team Lead']
  }

  return Array.from(found)
})

// ── Status state ──────────────────────────────────────────────────────────────

type SignOffStatus = 'pending' | 'approved' | 'revise'

const statuses = ref<Record<string, SignOffStatus>>({})

function setStatus(name: string, status: SignOffStatus): void {
  statuses.value = { ...statuses.value, [name]: status }
}

function getStatus(name: string): SignOffStatus {
  return statuses.value[name] ?? 'pending'
}

function statusLabel(name: string): string {
  const s = getStatus(name)
  if (s === 'approved') return '✅ Approved'
  if (s === 'revise')   return '🔄 Revise'
  return '⏳ Pending'
}

function statusTextClass(name: string): string {
  const s = getStatus(name)
  if (s === 'approved') return 'text-emerald-600'
  if (s === 'revise')   return 'text-amber-600'
  return 'text-slate-400'
}

// ── Progress ──────────────────────────────────────────────────────────────────

const approvedCount = computed(() =>
  stakeholders.value.filter((n) => getStatus(n) === 'approved').length
)

const allApproved = computed(() =>
  stakeholders.value.length > 0 && approvedCount.value === stakeholders.value.length
)

const progressWidth = computed(() => {
  if (stakeholders.value.length === 0) return '0%'
  return `${(approvedCount.value / stakeholders.value.length) * 100}%`
})
</script>
