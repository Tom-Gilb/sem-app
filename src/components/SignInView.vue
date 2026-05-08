<!-- UNIT_TYPE=Widget -->
<!--
  SignInView — Email/password sign-in form
  Spec: S.EvoStep4.InvitationFlow / F.ImplementMultiUserAuthLayer
  Mobile-first: stacked layout at 375px; all touch targets ≥ 44×44px (MOBILE_03)
-->

<script setup lang="ts">
import { ref } from 'vue'
import { useAuth } from '../composables/useAuth'

const emit = defineEmits<{
  /** Emitted when sign-in succeeds — parent switches to workspace view */
  'signed-in': []
  /** Emitted when user clicks "Create an account" */
  'go-sign-up': []
}>()

const { loading, error, signIn } = useAuth()

const email = ref('')
const password = ref('')

async function handleSubmit() {
  const ok = await signIn(email.value, password.value)
  if (ok) emit('signed-in')
}
</script>

<template>
  <div class="w-full max-w-sm mx-auto px-4 py-8 space-y-6">
    <!-- Header -->
    <div class="space-y-1">
      <h1 class="text-2xl font-semibold text-gray-900">Sign in</h1>
      <p class="text-sm text-gray-500">Access your SEM App workspaces.</p>
    </div>

    <!-- Error banner -->
    <div
      v-if="error"
      role="alert"
      class="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
    >
      {{ error }}
    </div>

    <!-- Form -->
    <form class="space-y-4" novalidate @submit.prevent="handleSubmit">
      <!-- Email -->
      <div class="space-y-1">
        <label for="signin-email" class="block text-sm font-medium text-gray-700">
          Email
        </label>
        <input
          id="signin-email"
          v-model="email"
          type="email"
          autocomplete="email"
          required
          placeholder="you@example.com"
          class="w-full min-h-[44px] rounded-lg border border-gray-300 bg-white
                 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400
                 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                 transition-colors duration-150"
        />
      </div>

      <!-- Password -->
      <div class="space-y-1">
        <label for="signin-password" class="block text-sm font-medium text-gray-700">
          Password
        </label>
        <input
          id="signin-password"
          v-model="password"
          type="password"
          autocomplete="current-password"
          required
          placeholder="Your password"
          class="w-full min-h-[44px] rounded-lg border border-gray-300 bg-white
                 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400
                 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                 transition-colors duration-150"
        />
      </div>

      <!-- Submit -->
      <button
        type="submit"
        :disabled="loading"
        class="w-full min-h-[44px] rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold
               text-white shadow-sm
               hover:bg-blue-700 focus-visible:outline focus-visible:outline-2
               focus-visible:outline-offset-2 focus-visible:outline-blue-600
               disabled:opacity-50 disabled:cursor-not-allowed
               transition-colors duration-150"
      >
        <span v-if="loading">Signing in…</span>
        <span v-else>Sign in</span>
      </button>
    </form>

    <!-- Switch to sign-up -->
    <p class="text-sm text-center text-gray-500">
      Don't have an account?
      <button
        type="button"
        class="min-h-[44px] px-1 text-blue-600 font-medium hover:underline focus-visible:outline
               focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        @click="emit('go-sign-up')"
      >
        Create an account
      </button>
    </p>
  </div>
</template>
