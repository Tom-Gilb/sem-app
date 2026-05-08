<!-- UNIT_TYPE=Widget -->
<!--
  InviteAcceptView — Processes invitation tokens from deep-link URLs.
  Shown when the app detects ?invite=true&token=... in the URL.
  Spec: S.EvoStep4.InvitationFlow / F.ImplementMultiUserAuthLayer
  Mobile-first: 375px operable; touch targets ≥ 44×44px (MOBILE_03)
-->

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useAuth } from '../composables/useAuth'

const props = defineProps<{
  /** One-time invitation token from the URL query string */
  token: string
  /** Token type — defaults to 'invite' for workspace invitations */
  tokenType?: string
}>()

const emit = defineEmits<{
  /** Emitted when invitation is accepted and session is established */
  'invite-accepted': []
  /** Emitted when invitation token is expired or invalid */
  'invite-failed': [message: string]
}>()

const { loading, error, acceptInvite } = useAuth()
const status = ref<'processing' | 'success' | 'failed'>('processing')

onMounted(async () => {
  // Process the invitation token immediately on mount
  const ok = await acceptInvite(props.token, props.tokenType ?? 'invite')
  if (ok) {
    status.value = 'success'
    emit('invite-accepted')
  } else {
    status.value = 'failed'
    emit('invite-failed', error.value || 'Invitation token is invalid or has expired.')
  }
})
</script>

<template>
  <div
    class="w-full max-w-sm mx-auto px-4 py-12 space-y-6 text-center"
    role="status"
    aria-live="polite"
  >
    <!-- Processing state -->
    <template v-if="status === 'processing' || loading">
      <div class="space-y-3">
        <div
          class="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"
          aria-hidden="true"
        />
        <p class="text-sm text-gray-600">Verifying your invitation…</p>
      </div>
    </template>

    <!-- Success state -->
    <template v-else-if="status === 'success'">
      <div class="space-y-2">
        <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <svg
            class="h-6 w-6 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="2"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 class="text-xl font-semibold text-gray-900">Invitation accepted</h1>
        <p class="text-sm text-gray-500">Redirecting you to your workspace…</p>
      </div>
    </template>

    <!-- Failed state -->
    <template v-else>
      <div
        role="alert"
        class="space-y-3"
      >
        <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <svg
            class="h-6 w-6 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="2"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 class="text-xl font-semibold text-gray-900">Invitation failed</h1>
        <p class="text-sm text-red-600">
          {{ error || 'This invitation link is invalid or has expired (48-hour limit).' }}
        </p>
        <p class="text-xs text-gray-400">
          Ask the workspace admin to send a new invitation.
        </p>
      </div>
    </template>
  </div>
</template>
