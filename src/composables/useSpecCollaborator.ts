// UNIT_TYPE=Hook
// useSpecCollaborator — AI Spec Collaborator composable.
// Spec: 4Sol.S.CollaborativeLiveSpec / 3P.F.ProvideAISpecCollaborator
// Evo Step 13.
//
// Manages conversation history + streaming responses + proposal lifecycle.
// Streaming via Anthropic SDK beta.messages.stream.
// Proposals are embedded in assistant messages as structured JSON.
// acceptProposal() returns a mutated copy of the spec — caller merges into state.
// rejectProposal() adds a dismissal record so the AI won't re-propose.
// Session is cleared on clear() — does not persist across page loads.
// No TwinPod — pure frontend composable.

import { ref, readonly } from 'vue'
import type { SpecBlock } from '../types/spec'
import type { FEntry, VEntry, SEntry } from '../types/spec'

// ── Types ────────────────────────────────────────────────────────────────────

export type MessageRole = 'user' | 'assistant'

/** A structured spec-change proposal embedded in an assistant message. */
export interface SpecProposal {
  type:      'add' | 'modify' | 'remove'
  entry:     'F' | 'V' | 'S'
  id:        string           // e.g. "3P.V.Sexiness"
  content:   string           // full entry text (for add/modify)
  rationale: string
}

/** A single message in the collaborator conversation. */
export interface CollaboratorMessage {
  id:        string
  role:      MessageRole
  text:      string           // full message text (streaming: accumulates during stream)
  proposal?: SpecProposal     // extracted proposal, if any
  streaming: boolean          // true while the response is being received
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const PROPOSAL_START = '<<PROPOSAL>>'
const PROPOSAL_END   = '<</PROPOSAL>>'

/**
 * Extracts a SpecProposal JSON block from assistant text, if present.
 * Returns null if no well-formed proposal block is found.
 */
function extractProposal(text: string): SpecProposal | null {
  const start = text.indexOf(PROPOSAL_START)
  const end   = text.indexOf(PROPOSAL_END)
  if (start === -1 || end === -1) return null
  const json = text.slice(start + PROPOSAL_START.length, end).trim()
  try {
    const raw = JSON.parse(json) as Record<string, unknown>
    if (!['add', 'modify', 'remove'].includes(raw['type'] as string)) return null
    if (!['F', 'V', 'S'].includes(raw['entry'] as string)) return null
    if (typeof raw['id'] !== 'string') return null
    if (typeof raw['content'] !== 'string') return null
    if (typeof raw['rationale'] !== 'string') return null
    return {
      type:      raw['type'] as 'add' | 'modify' | 'remove',
      entry:     raw['entry'] as 'F' | 'V' | 'S',
      id:        raw['id'] as string,
      content:   raw['content'] as string,
      rationale: raw['rationale'] as string,
    }
  } catch {
    return null
  }
}

/** Human-readable display text (strips the <<PROPOSAL>> block from the message). */
function displayText(text: string): string {
  const start = text.indexOf(PROPOSAL_START)
  if (start === -1) return text
  return text.slice(0, start).trimEnd()
}

let _idCounter = 0
function nextId(): string {
  return `cm${++_idCounter}`
}

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(spec: SpecBlock, stage: number, rejectedIds: string[]): string {
  const specJson = JSON.stringify(spec, null, 2).slice(0, 3500)
  const rejectedNote = rejectedIds.length > 0
    ? `\n\nThe user has already rejected the following proposal IDs — do NOT re-propose them: ${rejectedIds.join(', ')}`
    : ''
  return `You are an expert Planguage consultant embedded live in a planning tool.
The user is building a CE spec with ${spec.functions.length} functions, ${spec.values.length} values, and ${spec.solutions.length} solutions. Current workflow stage: ${stage}.

Your role:
- Answer questions about Planguage, Gilb CE methodology, and the user's specific spec.
- Identify gaps, ambiguities, or improvement opportunities proactively.
- When you have a concrete spec change to suggest, emit exactly ONE proposal block per message.

A proposal block looks like:
<<PROPOSAL>>
{"type":"add","entry":"V","id":"3P.V.NewValue","content":"Type: Value\\nLevel: Product\\nDescription: ...\\nScale: ...\\nMeter: ...\\nStatus: pre-build\\nTolerable: ...\\nGoal: ...","rationale":"Brief reason"}
<</PROPOSAL>>

Entry types: "F" = Function, "V" = Value, "S" = Solution
Proposal types: "add" (new entry), "modify" (update existing), "remove" (delete entry)
For "remove", content is "".

Keep responses concise — 2–4 sentences + optional proposal block. Do not pad with pleasantries.

Current spec JSON:
${specJson}${rejectedNote}`
}

// ── Mock responses ────────────────────────────────────────────────────────────

const MOCK_TURNS = [
  // Turn 1
  `I can see your spec has ${0} values. Let me suggest adding a measurability dimension.
Here is a proposal to strengthen the value baseline:
<<PROPOSAL>>
{"type":"add","entry":"V","id":"V.SpecCompleteness","content":"Type: Value\\nLevel: Product\\nDescription: Percentage of Planguage fields populated per entry\\nScale: % of F./V./S. entries with all required fields non-empty\\nMeter: Automated field-completeness scan after each generation\\nStatus: pre-build\\nTolerable: 70%\\nGoal: 95%","rationale":"A completeness metric keeps the spec honest — partial entries create ambiguity downstream."}
<</PROPOSAL>>`,
  // Turn 2
  `Good question about Scale vs Meter. Scale is *what* you measure (the attribute and unit); Meter is *how* you measure it (the method, tool, and frequency). They must be independent — if your Scale says "% of users completing in 2 min", your Meter should not restate that but describe the measurement instrument: "Automated funnel analytics on production traffic, weekly report."`,
  // Turn 3
  `Your Goal for V.EntryFluency looks conservative at 65%. Based on benchmarks for similar onboarding funnels, 80% is achievable within one release cycle. Consider raising the Wish to 80% and leaving 65% as the Tolerable floor.`,
]

let _mockTurnIdx = 0

// ── Composable ────────────────────────────────────────────────────────────────

/**
 * Composable that drives the AI Spec Collaborator.
 *
 * @returns {{
 *   messages:    Readonly<Ref<CollaboratorMessage[]>>,
 *   isStreaming: Readonly<Ref<boolean>>,
 *   error:       Readonly<Ref<string>>,
 *   sendMessage(text: string, spec: SpecBlock, stage?: number): Promise<void>,
 *   acceptProposal(proposal: SpecProposal, spec: SpecBlock): SpecBlock,
 *   rejectProposal(id: string): void,
 *   clear(): void,
 * }}
 */
export function useSpecCollaborator() {
  const apiKey    = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined
  const messages  = ref<CollaboratorMessage[]>([])
  const isStreaming = ref(false)
  const error     = ref('')
  const _rejected = new Set<string>()

  async function sendMessage(userText: string, spec: SpecBlock, stage = 1): Promise<void> {
    if (!userText.trim() || isStreaming.value) return
    error.value = ''

    // Add user message
    messages.value.push({
      id:        nextId(),
      role:      'user',
      text:      userText.trim(),
      streaming: false,
    })

    // Add placeholder assistant message
    const assistantMsg: CollaboratorMessage = {
      id:        nextId(),
      role:      'assistant',
      text:      '',
      streaming: true,
    }
    messages.value.push(assistantMsg)

    isStreaming.value = true

    const ollamaModel = import.meta.env.VITE_OLLAMA_MODEL as string | undefined
    const isMock = import.meta.env.VITE_MOCK_MODE === 'true' || (!apiKey?.trim() && !ollamaModel?.trim())

    if (isMock) {
      // Simulate streaming word-by-word
      const mockText = MOCK_TURNS[_mockTurnIdx % MOCK_TURNS.length]!
      _mockTurnIdx++
      const words = mockText.split(' ')
      for (const word of words) {
        await new Promise(r => setTimeout(r, 40))
        assistantMsg.text += (assistantMsg.text ? ' ' : '') + word
      }
      assistantMsg.proposal  = extractProposal(assistantMsg.text) ?? undefined
      assistantMsg.text      = displayText(assistantMsg.text)
      assistantMsg.streaming = false
      isStreaming.value = false
      return
    }

    try {
      const { Anthropic } = await import('@anthropic-ai/sdk')
      const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })

      // Build conversation history (exclude current placeholder)
      const history = messages.value
        .slice(0, -1)  // skip the assistant placeholder just added
        .filter(m => !m.streaming)
        .map(m => ({
          role:    m.role as 'user' | 'assistant',
          content: m.text,
        }))

      const systemPrompt = buildSystemPrompt(spec, stage, [..._rejected])
      let   fullText     = ''

      const stream = client.beta.messages.stream({
        model:      'claude-opus-4-5',
        max_tokens: 800,
        system:     systemPrompt,
        messages:   history,
        betas:      ['prompt-caching-2024-07-31'],
      })

      stream.on('text', (delta: string) => {
        fullText             += delta
        assistantMsg.text     = displayText(fullText)
      })

      await stream.finalMessage()

      assistantMsg.proposal  = extractProposal(fullText) ?? undefined
      assistantMsg.text      = displayText(fullText)
      assistantMsg.streaming = false
    } catch (e) {
      error.value            = e instanceof Error ? e.message : 'Collaborator failed'
      assistantMsg.text      = '⚠ Failed to get response — check your network and API key.'
      assistantMsg.streaming = false
    }

    isStreaming.value = false
  }

  /**
   * Applies an accepted proposal to the spec, returning a mutated copy.
   * The caller is responsible for committing the returned spec to state.
   */
  function acceptProposal(proposal: SpecProposal, spec: SpecBlock): SpecBlock {
    const copy: SpecBlock = {
      functions: [...spec.functions],
      values:    [...spec.values],
      solutions: [...spec.solutions],
    }

    if (proposal.type === 'remove') {
      if (proposal.entry === 'F') copy.functions = copy.functions.filter(e => e.id !== proposal.id)
      if (proposal.entry === 'V') copy.values    = copy.values.filter(e => e.id !== proposal.id)
      if (proposal.entry === 'S') copy.solutions = copy.solutions.filter(e => e.id !== proposal.id)
      return copy
    }

    // Parse content as key: value lines into a partial entry object
    const parsed: Record<string, string> = {}
    for (const line of proposal.content.split('\n')) {
      const colonIdx = line.indexOf(':')
      if (colonIdx > -1) {
        const key   = line.slice(0, colonIdx).trim().toLowerCase()
        const value = line.slice(colonIdx + 1).trim()
        parsed[key] = value
      }
    }

    if (proposal.type === 'add') {
      if (proposal.entry === 'F') {
        const entry: FEntry = {
          id:              proposal.id,
          type:            'Function',
          level:           parsed['level'] ?? 'Product',
          description:     parsed['description'] ?? proposal.content,
          presenceTest: parsed['presencetest'] ?? parsed['successcriteria'] ?? '',
          functionOfValue: parsed['functionofvalue'] ?? '',
        }
        copy.functions.push(entry)
      } else if (proposal.entry === 'V') {
        const entry: VEntry = {
          id:              proposal.id,
          type:            'Value',
          level:           parsed['level'] ?? 'Product',
          description:     parsed['description'] ?? proposal.content,
          scale:           parsed['scale'] ?? '',
          meter:           parsed['meter'] ?? '',
          status:          parsed['status'] ?? 'pre-build',
          tolerable:       parsed['tolerable'] ?? '',
          goal:            parsed['goal'] ?? '',
          valueOfFunction: parsed['valueoffunction'] ?? '',
        }
        copy.values.push(entry)
      } else if (proposal.entry === 'S') {
        const entry: SEntry = {
          id:          proposal.id,
          type:        'Solution',
          level:       parsed['level'] ?? 'Product',
          description: parsed['description'] ?? proposal.content,
          impact:      parsed['impact'] ?? '',
          function:    parsed['function'] ?? '',
        }
        copy.solutions.push(entry)
      }
    } else if (proposal.type === 'modify') {
      if (proposal.entry === 'F') {
        copy.functions = copy.functions.map(e =>
          e.id === proposal.id
            ? {
                ...e,
                description:     parsed['description'] ?? e.description,
                presenceTest: parsed['presencetest'] ?? parsed['successcriteria'] ?? e.presenceTest ?? e.successCriteria ?? '',
                level:           parsed['level'] ?? e.level,
              }
            : e,
        )
      } else if (proposal.entry === 'V') {
        copy.values = copy.values.map(e =>
          e.id === proposal.id
            ? {
                ...e,
                description:     parsed['description'] ?? e.description,
                scale:           parsed['scale'] ?? e.scale,
                meter:           parsed['meter'] ?? e.meter,
                tolerable:       parsed['tolerable'] ?? e.tolerable,
                goal:            parsed['goal'] ?? e.goal,
              }
            : e,
        )
      } else if (proposal.entry === 'S') {
        copy.solutions = copy.solutions.map(e =>
          e.id === proposal.id
            ? {
                ...e,
                description: parsed['description'] ?? e.description,
                impact:      parsed['impact'] ?? e.impact,
              }
            : e,
        )
      }
    }

    return copy
  }

  /** Mark a proposal ID as rejected so the AI won't re-propose it. */
  function rejectProposal(id: string): void {
    _rejected.add(id)
  }

  /** Clear conversation history and rejection list. Call on Start Over or new spec generation. */
  function clear(): void {
    messages.value    = []
    error.value       = ''
    isStreaming.value = false
    _rejected.clear()
    _mockTurnIdx = 0
  }

  return {
    messages:    readonly(messages),
    isStreaming:  readonly(isStreaming),
    error:        readonly(error),
    sendMessage,
    acceptProposal,
    rejectProposal,
    clear,
  }
}
