<!-- UNIT_TYPE=Widget -->
<!--
  SignUpView — Email/password sign-up form
  Spec: S.EvoStep4.InvitationFlow / F.ImplementMultiUserAuthLayer
  Mobile-first: stacked layout at 375px; all touch targets ≥ 44×44px (MOBILE_03)
-->

<script setup lang="ts">
import { ref } from 'vue'
import { useAuth } from '../composables/useAuth'

const emit = defineEmits<{
  /** Emitted after successful sign-up — parent shows email-confirmation message */
  'signed-up': []
  /** Emitted when user clicks "Sign in instead" */
  'go-sign-in': []
}>()

const { loading, error, signUp } = useAuth()

const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const localError = ref('')

async function handleSubmit() {
  localError.value = ''

  if (password.value !== confirmPassword.value) {
    localError.value = 'Passwords do not match.'
    return
  }
  if (password.value.length < 8) {
    localError.value = 'Password must be at least 8 characters.'
    return
  }

  const ok = await signUp(email.value, password.value)
  if (ok) emit('signed-up')
}

const displayError = () => localError.value || error.value
</script>

<template>
  <div class="w-full max-w-sm mx-auto px-4 py-8 space-y-6">
    <!-- Header -->
    <div class="space-y-1">
      <h1 class="text-2xl font-semibold text-gray-900">Create an account</h1>
      <p class="text-sm text-gray-500">Start building Planguage specs with your team.</p>
    </div>

    <!-- Error banner -->
    <div
      v-if="displayError()"
      role="alert"
      class="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
    >
      {{ displayError() }}
    </div>

    <!-- Form -->
    <form class="space-y-4" novalidate @submit.prevent="handleSubmit">
      <!-- Email -->
      <div class="space-y-1">
        <label for="signup-email" class="block text-sm font-medium text-gray-700">
          Email
        </label>
        <input
          id="signup-email"
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
        <label for="signup-password" class="block text-sm font-medium text-gray-700">
          Password
          <span class="font-normal text-gray-400 ml-1">(min. 8 characters)</span>
        </label>
        <input
          id="signup-password"
          v-model="password"
          type="password"
          autocomplete="new-password"
          required
          placeholder="Choose a password"
          class="w-full min-h-[44px] rounded-lg border border-gray-300 bg-white
                 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400
                 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                 transition-colors duration-150"
        />
      </div>

      <!-- Confirm password -->
      <div class="space-y-1">
        <label for="signup-confirm" class="block text-sm font-medium text-gray-700">
          Confirm password
        </label>
        <input
          id="signup-confirm"
          v-model="confirmPassword"
          type="password"
          autocomplete="new-password"
          required
          placeholder="Repeat your password"
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
        <span v-if="loading">Creating account…</span>
        <span v-else>Create account</span>
      </button>
    </form>

    <!-- Switch to sign-in -->
    <p class="text-sm text-center text-gray-500">
      Already have an account?
      <button
        type="button"
        class="min-h-[44px] px-1 text-blue-600 font-medium hover:underline focus-visible:outline
               focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        @click="emit('go-sign-in')"
      >
        Sign in
      </button>
    </p>
  </div>
</template>
