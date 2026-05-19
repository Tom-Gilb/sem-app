<script setup lang="ts">
// SpecCoach.vue — AI Spec Coach floating chat bubble (Feature #35)
// Fixed bottom-right FAB that expands into a chat panel.
//
// Focus mode (useFocusMode):
//   • Opening the panel calls enter('spec-coach') — activates the blur backdrop +
//     transitions the panel to a large centred overlay
//   • Typing or sending resets the 30-second inactivity timer (onActivity)
//   • The 📌 pin button in the header pauses the timer indefinitely
//   • Closing the panel or timer expiry calls exit()
//
// The expanded panel is always <Teleport>-ed to <body> so it can reposition
// independently of the FAB container when focus mode is active.

import { ref, computed, nextTick, onUnmounted } from 'vue'
import ScrollContainer from './ScrollContainer.vue'
import CloseDot from './CloseDot.vue'
import { useSpecCoach } from '../composables/useSpecCoach'
import { useFocusMode } from '../composables/useFocusMode'
import { useInputSafetyNet } from '../composables/useInputSafetyNet'
import type { SpecBlock } from '../types/spec'

const PANEL_ID = 'spec-coach'

const props = defineProps<{
  spec: SpecBlock | null
  visible: boolean
}>()

const { messages, loading, error, ask } = useSpecCoach()
const { enter, exit, togglePin, onActivity, pinned, isFocusedPanel } = useFocusMode()

const expanded      = ref(false)
const inputText     = ref('')
const lastSeenCount = ref(0)
const messagesEl    = ref<InstanceType<typeof ScrollContainer> | null>(null)

const hasUnread = computed(() => messages.value.length > lastSeenCount.value)
const isFocused = computed(() => isFocusedPanel(PANEL_ID))

// ── Panel open / close ────────────────────────────────────────────────────────

function openPanel(): void {
  expanded.value      = true
  lastSeenCount.value = messages.value.length
  enter(PANEL_ID)
  nextTick(() => {
    ;(document.getElementById('coach-input') as HTMLInputElement | null)?.focus()
  })
}

function closePanel(): void {
  expanded.value = false
  exit()
}

// ── Messaging ─────────────────────────────────────────────────────────────────

// Input Safety Net — protect the user's typed question from accidental wipe.
const _safetyNet = useInputSafetyNet()
_safetyNet.watchField('spec-coach-input', inputText, (t) => { inputText.value = t })

async function sendMessage(): Promise<void> {
  const question = inputText.value.trim()
  if (!question || loading.value || !props.spec) return
  onActivity()
  // Tell the safety net this clear is intentional (send), so it doesn't
  // raise a false Oops on the post-send empty-input transition.
  _safetyNet.markIntentionalClear('spec-coach-input')
  inputText.value = ''
  await ask(question, props.spec)
  await nextTick()
  const _el = messagesEl.value?.el
  if (_el) _el.scrollTop = _el.scrollHeight
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  } else {
    onActivity()
  }
}

// Clean up focus state if component is destroyed while the panel is open.
onUnmounted(() => { if (expanded.value) exit() })
</script>

<template>
  <!-- ── FAB — shown only when panel is collapsed ──────────────────────────── -->
  <!-- Positioned bottom-right (right-6) above the ⚡ Actions button (bottom-6).
       bottom-20 (80 px) clears the Actions button top (~68 px from bottom).
       If a right-side drawer is open the FAB sits above it at z-[520]. -->
  <div
    v-if="visible && !expanded"
    class="fixed bottom-20 right-6 z-[520]"
  >
    <button
      type="button"
      class="relative flex items-center justify-center gap-2 min-h-[56px] min-w-[56px]
             rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg
             focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
             transition-colors duration-150 px-4"
      aria-label="Ask Anything"
      @click="openPanel"
    >
      <span class="text-sm leading-none" aria-hidden="true">💬</span>
      <span class="hidden md:inline text-sm font-medium">Ask Anything</span>

      <!-- Unread badge -->
      <span
        v-if="hasUnread"
        class="absolute -top-1 -right-1 h-4 min-w-[1rem] rounded-full
               bg-red-500 text-white text-[10px] font-bold
               flex items-center justify-center px-0.5 pointer-events-none"
        aria-hidden="true"
      >{{ messages.length - lastSeenCount }}</span>
    </button>
  </div>

  <!-- ── Expanded chat panel — Teleported to <body> for independent positioning ── -->
  <Teleport v-if="visible && expanded" to="body">
    <div
      :class="isFocused
        ? [
            'fixed top-1/2 left-1/2',
            '-translate-x-1/2 -translate-y-1/2',
            'w-[min(680px,90vw)] max-h-[85vh]',
            'z-[920]',
            'rounded-2xl bg-white overflow-hidden flex flex-col',
            'shadow-[0_0_0_1px_rgba(99,102,241,0.2),0_40px_100px_rgba(0,0,0,0.65),0_0_60px_rgba(99,102,241,0.10)]',
            'ring-1 ring-indigo-400/20',
            'transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
          ]
        : [
            'fixed bottom-20 right-6',
            'w-80 z-[521]',
            'rounded-2xl shadow-2xl bg-white border border-gray-200',
            'flex flex-col',
            'transition-all duration-300',
          ]"
      role="dialog"
      aria-label="Spec Coach chat"
      @pointerdown="onActivity"
    >
      <!-- Header -->
      <div
        :class="[
          'flex items-center justify-between px-4 min-h-[44px] border-b flex-shrink-0',
          isFocused ? 'border-indigo-100 bg-indigo-50/40' : 'border-gray-100',
        ]"
      >
        <h2 class="text-sm font-semibold text-gray-900">💬 Ask Anything</h2>

        <div class="flex items-center gap-2">
          <!-- 📌 Pin — pause the 30-second inactivity countdown -->
          <button
            type="button"
            :class="[
              'flex items-center justify-center h-7 w-7 rounded-full text-sm transition-all',
              pinned
                ? 'bg-indigo-100 text-indigo-600 ring-1 ring-indigo-300 scale-110'
                : 'text-gray-400 hover:text-indigo-500 hover:bg-indigo-50',
            ]"
            :title="pinned ? 'Unpin — resume 30s countdown' : 'Pin — stay open indefinitely'"
            :aria-label="pinned ? 'Unpin focus mode' : 'Pin focus mode'"
            @click="togglePin"
          >📌</button>

          <!-- macOS-style close dot -->
          <CloseDot
        title="Close"
        aria-label="Close Ask Anything"
        @click="closePanel"
      />
        </div>
      </div>

      <!-- Messages area — taller when focused -->
      <ScrollContainer
        ref="messagesEl"
        :outer-class="isFocused ? 'flex-1 min-h-0 relative' : 'relative'"
        :inner-class="isFocused ? 'h-full p-3 space-y-3' : 'max-h-72 p-3 space-y-3'"
        :no-pill="true"
      >
        <!-- Empty state — adapts to whether a spec is loaded -->
        <div
          v-if="messages.length === 0 && !loading"
          class="text-sm text-gray-400 text-center py-4 space-y-1.5"
        >
          <template v-if="!spec">
            <p class="text-2xl" aria-hidden="true">💡</p>
            <p class="font-medium text-gray-500">Generate a plan first</p>
            <p class="text-xs leading-snug px-2">
              Use <strong class="text-indigo-500">Get A Plan</strong> or fill in the form —
              then I can help you sharpen and refine your spec.
            </p>
          </template>
          <template v-else>
            <p>Ask me anything about your spec!</p>
            <p class="text-xs">Try: "Is this Scale measurable?" or "How can I improve this Goal?"</p>
          </template>
        </div>

        <!-- Message list -->
        <template v-for="msg in messages" :key="msg.id">
          <div v-if="msg.role === 'user'" class="flex justify-end">
            <span class="bg-indigo-600 text-white rounded-2xl px-3 py-2 text-sm max-w-[85%]">
              {{ msg.text }}
            </span>
          </div>
          <div v-else class="flex justify-start">
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
        <div
          v-if="error && !loading"
          class="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 space-y-1"
        >
          <p class="font-semibold">Coach error</p>
          <p class="break-all">{{ error }}</p>
        </div>
      </ScrollContainer>

      <!-- Input area -->
      <div class="flex items-center gap-2 p-3 border-t border-gray-100 flex-shrink-0">
        <input
          id="coach-input"
          v-model="inputText"
          type="text"
          class="flex-1 border border-gray-200 rounded-full px-4 py-2 text-sm h-11
                 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          :placeholder="spec ? 'Ask anything about your plan or spec…' : 'Generate a plan to unlock the coach'"
          :disabled="loading || !spec"
          @keydown="onKeydown"
        />
        <button
          type="button"
          class="flex items-center gap-1.5 h-11 px-3 bg-indigo-600 text-white rounded-full
                 text-xs font-semibold whitespace-nowrap
                 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500
                 disabled:opacity-50 transition-colors duration-150"
          :disabled="loading || !inputText.trim()"
          aria-label="Send question"
          @click="sendMessage"
        >
          <svg class="h-3.5 w-3.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
          </svg>
          Ask
        </button>
      </div>
    </div>
  </Teleport>
</template>
