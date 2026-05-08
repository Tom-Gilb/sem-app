<!-- UNIT_TYPE=Widget -->
<!--
  CollisionLog — Admin-only view listing identifier collisions in the current workspace.
  Spec: S.EvoStep4.InvitationFlow / S.EvoStep4.WorkspaceModel
  Mobile-first: 375px operable; touch targets ≥ 44×44px (MOBILE_03)
-->

<script setup lang="ts">
import { onMounted } from 'vue'
import { useCollisionLog } from '../composables/useCollisionLog'

const props = defineProps<{
  /** ID of the workspace whose collisions to display */
  workspaceId: string
}>()

const { collisions, loading, error, loadCollisions } = useCollisionLog()

onMounted(() => {
  loadCollisions(props.workspaceId)
})
</script>

<template>
  <section class="w-full space-y-4" aria-labelledby="collision-log-heading">
    <header class="flex items-center justify-between">
      <h2 id="collision-log-heading" class="text-lg font-semibold text-gray-900">
        Identifier Collision Log
      </h2>
      <!-- Reload button — 44×44px touch target via min-h + padding -->
      <button
        type="button"
        :disabled="loading"
        class="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg
               border border-gray-300 bg-white px-3 text-sm text-gray-700
               hover:bg-gray-50 focus-visible:outline focus-visible:outline-2
               focus-visible:outline-offset-2 focus-visible:outline-blue-600
               disabled:opacity-50 disabled:cursor-not-allowed
               transition-colors duration-150"
        aria-label="Reload collision log"
        @click="loadCollisions(workspaceId)"
      >
        <svg
          class="h-4 w-4"
          :class="loading ? 'animate-spin' : ''"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="2"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003
               8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      </button>
    </header>

    <!-- Loading indicator -->
    <div
      v-if="loading && collisions.length === 0"
      role="status"
      aria-live="polite"
      class="text-sm text-gray-500 py-6 text-center"
    >
      Loading collision log…
    </div>

    <!-- Error state -->
    <div
      v-else-if="error"
      role="alert"
      class="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
    >
      {{ error }}
    </div>

    <!-- Empty state -->
    <div
      v-else-if="collisions.length === 0"
      class="text-sm text-gray-400 py-6 text-center"
    >
      No identifier collisions recorded for this workspace.
    </div>

    <!-- Collision table — responsive; stacks gracefully at 375px -->
    <div v-else class="overflow-x-auto rounded-lg border border-gray-200">
      <table class="min-w-full divide-y divide-gray-200 text-sm">
        <thead class="bg-gray-50">
          <tr>
            <th
              scope="col"
              class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide"
            >
              Original ID
            </th>
            <th
              scope="col"
              class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide"
            >
              Resolved ID
            </th>
            <th
              scope="col"
              class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:table-cell"
            >
              Logged at
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 bg-white">
          <tr
            v-for="row in collisions"
            :key="row.id"
            class="hover:bg-gray-50 transition-colors duration-100"
          >
            <td class="px-4 py-3 font-mono text-xs text-gray-700 break-all">
              {{ row.original_id }}
            </td>
            <td class="px-4 py-3 font-mono text-xs text-blue-700 break-all">
              {{ row.suffixed_id }}
            </td>
            <td class="px-4 py-3 text-xs text-gray-400 hidden sm:table-cell whitespace-nowrap">
              {{ new Date(row.logged_at).toLocaleString() }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Row count summary -->
    <p
      v-if="collisions.length > 0"
      class="text-xs text-gray-400 text-right"
    >
      {{ collisions.length }} collision{{ collisions.length === 1 ? '' : 's' }} recorded
    </p>
  </section>
</template>
