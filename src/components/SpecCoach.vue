<script setup lang="ts">
// SpecCoach.vue — AI Spec Coach floating chat bubble (Feature #35)
// Fixed bottom-right FAB that expands into a chat panel for asking questions about a spec.

import { ref, computed, nextTick } from 'vue'
import { useSpecCoach } from '../composables/useSpecCoach'
import type { SpecBlock } from '../types/spec'

const props = defineProps<{
  spec: SpecBlock | null
  visible: boolean
}>()

const { messages, loading, error, ask } = useSpecCoach()

const expanded = ref(false)
const inputText = ref('')
const lastSeenCount = ref(0)
const messagesEl = ref<HTMLElement | null>(null)

const hasUnread = computed(
  () => messages.value.length > lastSeenCount.value,
)

function openPanel(): void {
  expanded.value = true
  lastSeenCount.value = messages.value.length
  // Auto-focus the input so voice routes here immediately — no click required
  nextTick(() => {
    ;(document.getElementById('coach-input') as HTMLInputElement | null)?.focus()
  })
}

function closePanel(): void {
  expanded.value = false
}

async function sendMessage(): Promise<void> {
  const question = inputText.value.trim()
  if (!question || loading.value || !props.spec) return

  inputText.value = ''

  await ask(question, props.spec)

  // Scroll to bottom after DOM update
  await nextTick()
  if (messagesEl.value) {
    messagesEl.value.scrollTop = messagesEl.value.scrollHeight
  }
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}
</script>

<template>
  <div
    v-if="visible"
    class="fixed bottom-6 right-6 z-[370]"
  >
    <!-- Collapsed: FAB button -->
    <button
      v-if="!expanded"
      type="button"
      class="relative flex items-center justify-center gap-2 min-h-[56px] min-w-[56px] rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors duration-150 px-4"
      aria-label="Open spec coach"
      @click="openPanel"
    >
      <span class="text-sm leading-none" aria-hidden="true">🎓</span>
      <span class="hidden md:inline text-sm font-medium">Coach</span>

      <!-- Unread badge -->
      <span
        v-if="hasUnread"
        class="absolute -top-1 -right-1 h-4 min-w-[1rem] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-0.5 pointer-events-none"
        aria-hidden="true"
      >
        {{ messages.length - lastSeenCount }}
      </span>
    </button>

    <!-- Expanded: chat panel -->
    <div
      v-else
      class="w-80 rounded-2xl shadow-2xl bg-white border border-gray-200 flex flex-col"
      role="dialog"
      aria-label="Spec Coach chat"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-4 border-b border-gray-100 min-h-[44px]">
        <h2 class="text-sm font-semibold text-gray-900">🎓 Spec Coach</h2>
        <button
          type="button"
          class="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
          aria-label="Close spec coach"
          @click="closePanel"
        >
          ×
        </button>
      </div>

      <!-- Messages area -->
      <div
        ref="messagesEl"
        class="flex-1 overflow-y-auto p-3 space-y-3 max-h-72"
      >
        <!-- Empty state -->
        <p
          v-if="messages.length === 0 && !loading"
          class="text-sm text-gray-400 text-center py-4"
        >
          Ask me anything about your spec! Try: "Is this Scale measurable?" or "How can I improve this Goal?"
        </p>

        <!-- Message list -->
        <template v-for="msg in messages" :key="msg.id">
          <!-- User message -->
          <div
            v-if="msg.role === 'user'"
            class="flex justify-end"
          >
            <span class="bg-indigo-600 text-white rounded-2xl px-3 py-2 text-sm max-w-[85%]">
              {{ msg.text }}
            </span>
          </div>

          <!-- Coach message -->
          <div
            v-else
            class="flex justify-start"
          >
            <span class="bg-gray-100 text-gray-800 rounded-2xl px-3 py-2 text-sm max-w-[85%]">
              {{ msg.text }}
            </span>
          </div>
        </template>

        <!-- Loading indicator -->
        <div v-if="loading" class="flex justify-start">
          <span class="bg-gray-100 text-gray-400 rounded-2xl px-3 py-2 text-sm animate-pulse">
            · · ·
          </span>
        </div>

        <!-- Error banner -->
        <div v-if="error && !loading" class="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 space-y-1">
          <p class="font-semibold">Coach error</p>
          <p class="break-all">{{ error }}</p>
        </div>
      </div>

      <!-- Input area -->
      <div class="flex items-center gap-2 p-3 border-t border-gray-100">
        <input
          id="coach-input"
          v-model="inputText"
          type="text"
          class="flex-1 border border-gray-200 rounded-full px-4 py-2 text-sm h-11 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          placeholder="Ask about your spec…"
          :disabled="loading"
          @keydown="onKeydown"
        />
        <button
          type="button"
          class="flex items-center gap-1.5 h-11 px-3 bg-indigo-600 text-white rounded-full
                 text-xs font-semibold whitespace-nowrap
                 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500
                 disabled:opacity-50 transition-colors duration-150"
          :disabled="loading || !inputText.trim()"
          aria-label="Ask coach this question"
          @click="sendMessage"
        >
          <!-- Paper-plane send icon -->
          <svg class="h-3.5 w-3.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
          </svg>
          Ask Coach This
        </button>
      </div>
    </div>
  </div>
</template>
