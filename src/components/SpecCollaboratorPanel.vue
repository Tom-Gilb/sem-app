<!-- SpecCollaboratorPanel.vue — AI Spec Collaborator slide-in panel.
     Spec: 4Sol.S.CollaborativeLiveSpec / 3P.F.ProvideAISpecCollaborator
     Evo Step 13.

     Slide-in right panel (320px on md+, full-screen sheet on mobile).
     Streaming conversation with the AI; proposal cards for spec changes.
     Accepts/rejects proposals and emits spec mutations back to parent.

     Props:
       spec     — SpecBlock — current spec (updated by parent on accept)
       stage    — number   — current workflow stage (1-5)

     Emits:
       close           — user dismissed the panel
       apply-proposal  — parent should merge the returned SpecBlock into its state -->

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import RightPanel from './RightPanel.vue'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'
import { useSpecCollaborator } from '../composables/useSpecCollaborator'
import type { SpecBlock } from '../types/spec'
import type { SpecProposal } from '../composables/useSpecCollaborator'

const props = defineProps<{
  spec:   SpecBlock
  stage?: number
}>()

const emit = defineEmits<{
  close:          []
  'apply-proposal': [SpecBlock]
}>()

const { messages, isStreaming, error, sendMessage, acceptProposal, rejectProposal, clear: clearConversation } = useSpecCollaborator()

// ── Input ────────────────────────────────────────────────────────────────────

const inputText   = ref('')
const inputRef    = ref<HTMLTextAreaElement | null>(null)
const messagesRef = ref<InstanceType<typeof ScrollContainer> | null>(null)

// ── Context summary line ─────────────────────────────────────────────────────

const contextLine = computed(() =>
  `AI sees: ${props.spec.functions.length} functions · ${props.spec.values.length} values · ${props.spec.solutions.length} solutions`,
)

// ── Send logic ───────────────────────────────────────────────────────────────

async function send(): Promise<void> {
  const text = inputText.value.trim()
  if (!text || isStreaming.value) return
  inputText.value = ''
  await sendMessage(text, props.spec, props.stage ?? 1)
  await nextTick()
  scrollToBottom()
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    send()
  }
}

function scrollToBottom(): void {
  const el = messagesRef.value?.el
  if (el) el.scrollTop = el.scrollHeight
}

// ── Proposal actions ─────────────────────────────────────────────────────────

function handleAccept(proposal: SpecProposal): void {
  const updated = acceptProposal(proposal, props.spec)
  emit('apply-proposal', updated)
}

function handleReject(proposal: SpecProposal): void {
  rejectProposal(proposal.id)
}

// ── Proposal type labels ─────────────────────────────────────────────────────

const PROPOSAL_TYPE_LABEL: Record<string, string> = {
  add:    '+ Add',
  modify: '✎ Modify',
  remove: '✕ Remove',
}
const PROPOSAL_ENTRY_LABEL: Record<string, string> = {
  F: 'Function',
  V: 'Value',
  S: 'Solution',
}
const PROPOSAL_COLOUR: Record<string, string> = {
  add:    'bg-emerald-50 border-emerald-200',
  modify: 'bg-indigo-50 border-indigo-200',
  remove: 'bg-red-50 border-red-200',
}

// ── Accepted/rejected state (in-session only) ─────────────────────────────────

const acceptedIds = ref<Set<string>>(new Set())
const rejectedIds = ref<Set<string>>(new Set())

function accept(proposal: SpecProposal): void {
  acceptedIds.value = new Set([...acceptedIds.value, proposal.id])
  handleAccept(proposal)
}

function reject(proposal: SpecProposal): void {
  rejectedIds.value = new Set([...rejectedIds.value, proposal.id])
  handleReject(proposal)
}

// ── Keyboard: Escape closes ──────────────────────────────────────────────────

function _onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => {
  window.addEventListener('keydown', _onKey)
  nextTick(() => inputRef.value?.focus())
})

onUnmounted(() => {
  window.removeEventListener('keydown', _onKey)
  clearConversation()
})
</script>

<template>
  <!-- Right-side slide-in panel — fixed on md+, full overlay on mobile -->
  <Teleport to="body">
    <!-- Panel container — fixed 320px right-side drawer; never full-screen -->
    <RightPanel
      class="z-[460] w-80 bg-white shadow-2xl border-l border-violet-200 flex flex-col"
      role="complementary"
      aria-label="Plan Advisor"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-violet-700 to-indigo-600 flex-shrink-0">
        <div>
          <h2 class="text-sm font-bold text-white flex items-center gap-1.5">
            <span aria-hidden="true">🧭</span> Plan Advisor
          </h2>
          <p class="text-[10px] text-violet-200 mt-0.5 truncate">{{ contextLine }}</p>
        </div>
        <CloseDot
        variant="on-dark"
        title="Close"
        aria-label="Close Plan Advisor"
        @click="emit('close')"
      />
      </div>

      <!-- Message thread -->
      <ScrollContainer
        ref="messagesRef"
        outer-class="flex-1 min-h-0 relative"
        inner-class="h-full px-3 py-3 space-y-3"
        :no-pill="true"
        aria-live="polite"
        aria-label="Conversation"
      >
        <!-- Empty state -->
        <div v-if="messages.length === 0" class="text-center py-8">
          <p class="text-3xl mb-2" aria-hidden="true">💬</p>
          <p class="text-xs font-semibold text-slate-600">Ask me anything about your spec</p>
          <p class="text-xs text-slate-400 mt-1">e.g. "Is my Goal too low?" or "What am I missing for this stakeholder?"</p>
        </div>

        <!-- Messages -->
        <template v-for="msg in messages" :key="msg.id">
          <!-- User message — right-aligned violet bubble -->
          <div
            v-if="msg.role === 'user'"
            class="flex justify-end"
          >
            <div
              class="max-w-[85%] px-3 py-2 rounded-2xl rounded-tr-sm bg-violet-600 text-white text-xs leading-relaxed"
              role="log"
              :aria-label="`You: ${msg.text}`"
            >{{ msg.text }}</div>
          </div>

          <!-- Assistant message — left-aligned slate bubble -->
          <div v-else class="flex flex-col gap-1.5">
            <div
              class="max-w-[90%] px-3 py-2 rounded-2xl rounded-tl-sm bg-slate-100 text-slate-800 text-xs leading-relaxed"
              :role="msg.streaming ? 'status' : 'log'"
              :aria-label="msg.streaming ? 'AI is responding…' : `AI: ${msg.text}`"
              :aria-busy="msg.streaming"
            >
              <!-- Streaming text with cursor -->
              <span>{{ msg.text }}</span>
              <span v-if="msg.streaming" class="animate-pulse text-violet-500 ml-0.5" aria-hidden="true">▋</span>
            </div>

            <!-- Proposal card (once streaming ends and proposal detected) -->
            <div
              v-if="msg.proposal && !msg.streaming"
              class="border rounded-xl px-3 py-2.5 text-xs"
              :class="PROPOSAL_COLOUR[msg.proposal.type] ?? 'bg-slate-50 border-slate-200'"
              role="group"
              :aria-label="`Proposal: ${PROPOSAL_TYPE_LABEL[msg.proposal.type]} ${PROPOSAL_ENTRY_LABEL[msg.proposal.entry]} ${msg.proposal.id}`"
            >
              <!-- Proposal header -->
              <div class="flex items-center gap-1.5 mb-1.5 flex-wrap">
                <span class="font-bold text-[10px] uppercase tracking-wider text-slate-500">
                  {{ PROPOSAL_TYPE_LABEL[msg.proposal.type] }}
                  {{ PROPOSAL_ENTRY_LABEL[msg.proposal.entry] }}
                </span>
                <code class="font-mono text-[10px] text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded">{{ msg.proposal.id }}</code>
              </div>

              <!-- Rationale -->
              <p class="text-[11px] text-slate-600 leading-snug mb-2">{{ msg.proposal.rationale }}</p>

              <!-- Content preview (for add/modify) -->
              <pre
                v-if="msg.proposal.type !== 'remove' && msg.proposal.content"
                class="text-[9px] font-mono text-slate-500 bg-white/60 rounded px-2 py-1 overflow-auto max-h-20 mb-2 whitespace-pre-wrap"
                aria-label="Proposed entry content"
              >{{ msg.proposal.content }}</pre>

              <!-- Accept / Reject buttons (if not already decided) -->
              <div
                v-if="!acceptedIds.has(msg.proposal.id) && !rejectedIds.has(msg.proposal.id)"
                class="flex gap-1.5"
              >
                <button
                  type="button"
                  class="flex-1 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-semibold
                         hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-colors"
                  :aria-label="`Accept proposal to ${msg.proposal.type} ${msg.proposal.id}`"
                  @click="accept(msg.proposal)"
                >✓ Accept</button>
                <button
                  type="button"
                  class="flex-1 py-1 rounded-lg bg-slate-200 text-slate-600 text-[10px] font-semibold
                         hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-300 transition-colors"
                  :aria-label="`Reject proposal to ${msg.proposal.type} ${msg.proposal.id}`"
                  @click="reject(msg.proposal)"
                >✕ Reject</button>
              </div>

              <!-- Decision badge -->
              <p
                v-else
                class="text-[10px] font-semibold"
                :class="acceptedIds.has(msg.proposal.id) ? 'text-emerald-600' : 'text-slate-400'"
                role="status"
              >{{ acceptedIds.has(msg.proposal.id) ? '✓ Accepted — spec updated' : '✕ Rejected' }}</p>
            </div>
          </div>
        </template>

        <!-- Error -->
        <p v-if="error" class="text-xs text-red-500 text-center" role="alert">{{ error }}</p>
      </ScrollContainer>

      <!-- Input area -->
      <div class="flex-shrink-0 border-t border-slate-200 px-3 py-2.5">
        <!-- Context line -->
        <p class="text-[9px] text-slate-400 mb-1.5 truncate" aria-live="polite">{{ contextLine }}</p>

        <div class="flex gap-2 items-end">
          <textarea
            ref="inputRef"
            v-model="inputText"
            rows="2"
            class="flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800
                   focus:outline-none focus:ring-2 focus:ring-violet-400 transition-colors"
            placeholder="Ask the AI about your spec…"
            aria-label="Message to AI collaborator"
            :disabled="isStreaming"
            @keydown="onKeydown"
          />
          <button
            type="button"
            class="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-xl
                   focus:outline-none focus:ring-2 focus:ring-violet-400 transition-colors"
            :class="isStreaming || !inputText.trim()
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
              : 'bg-violet-600 text-white hover:bg-violet-700'"
            :disabled="isStreaming || !inputText.trim()"
            aria-label="Send message"
            @click="send"
          >
            <!-- Send arrow icon -->
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </RightPanel>
  </Teleport>
</template>
