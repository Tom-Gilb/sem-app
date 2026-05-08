// UNIT_TYPE=Test
// Tests for useSpecCoach composable (Feature #35)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useSpecCoach } from '../useSpecCoach'
import type { SpecBlock } from '../../types/spec'

const minimalSpec: SpecBlock = {
  functions: [
    {
      id: 'F.Test',
      type: 'Function',
      level: 'Product',
      description: 'Test function',
      successCriteria: 'It works',
      functionOfValue: 'V.Test',
    },
  ],
  values: [
    {
      id: 'V.Test',
      type: 'Value',
      level: 'Product',
      description: 'Test value',
      scale: '% passing',
      meter: 'Automated tests',
      status: 'pre-build',
      tolerable: '70%',
      goal: '90%',
      valueOfFunction: 'F.Test',
    },
  ],
  solutions: [
    {
      id: 'S.Test',
      type: 'Solution',
      level: 'Product',
      description: 'Test solution',
      impact: 'V.Test ~90%',
      function: 'F.Test',
    },
  ],
}

describe('useSpecCoach — mock mode (no API key)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ANTHROPIC_API_KEY', '')
    vi.stubEnv('VITE_MOCK_MODE', 'false')
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.useRealTimers()
  })

  it('messages starts empty', () => {
    const { messages } = useSpecCoach()
    expect(messages.value).toHaveLength(0)
  })

  it('ask() in mock mode appends user and coach messages', async () => {
    const { messages, ask } = useSpecCoach()

    const promise = ask('What is the scale?', minimalSpec)
    vi.runAllTimersAsync()
    await promise

    // Should have 2 messages: user + coach
    expect(messages.value).toHaveLength(2)
    expect(messages.value[0].role).toBe('user')
    expect(messages.value[0].text).toBe('What is the scale?')
    expect(messages.value[1].role).toBe('coach')
    expect(messages.value[1].text.length).toBeGreaterThan(0)
  })

  it('loading toggles true then false', async () => {
    const { loading, ask } = useSpecCoach()
    expect(loading.value).toBe(false)

    const promise = ask('Tell me about the goal', minimalSpec)
    expect(loading.value).toBe(true)

    vi.runAllTimersAsync()
    await promise

    expect(loading.value).toBe(false)
  })

  it('keyword "scale" routes to Scale response', async () => {
    const { messages, ask } = useSpecCoach()
    const promise = ask('Explain the scale to me', minimalSpec)
    vi.runAllTimersAsync()
    await promise

    const coachMsg = messages.value.find((m) => m.role === 'coach')
    expect(coachMsg).toBeDefined()
    expect(coachMsg!.text).toContain('Scale')
  })

  it('keyword "meter" routes to Meter response', async () => {
    const { messages, ask } = useSpecCoach()
    const promise = ask('How does the meter work?', minimalSpec)
    vi.runAllTimersAsync()
    await promise

    const coachMsg = messages.value.find((m) => m.role === 'coach')
    expect(coachMsg!.text).toContain('Meter')
  })

  it('keyword "goal" routes to Goal response', async () => {
    const { messages, ask } = useSpecCoach()
    const promise = ask('Tell me about the goal', minimalSpec)
    vi.runAllTimersAsync()
    await promise

    const coachMsg = messages.value.find((m) => m.role === 'coach')
    expect(coachMsg!.text).toContain('Goal')
  })

  it('keyword "tolerable" routes to Tolerable response', async () => {
    const { messages, ask } = useSpecCoach()
    const promise = ask('What is the tolerable level?', minimalSpec)
    vi.runAllTimersAsync()
    await promise

    const coachMsg = messages.value.find((m) => m.role === 'coach')
    expect(coachMsg!.text).toContain('Tolerable')
  })

  it('default fallback for unknown question', async () => {
    const { messages, ask } = useSpecCoach()
    const promise = ask('What is the meaning of this?', minimalSpec)
    vi.runAllTimersAsync()
    await promise

    const coachMsg = messages.value.find((m) => m.role === 'coach')
    expect(coachMsg!.text).toContain("That's a great question")
  })

  it('accumulates all messages across multiple asks (no cap)', async () => {
    const { messages, ask } = useSpecCoach()

    const p1 = ask('First question', minimalSpec)
    vi.runAllTimersAsync()
    await p1

    const p2 = ask('Second question', minimalSpec)
    vi.runAllTimersAsync()
    await p2

    // 2 user + 2 coach = 4 total
    expect(messages.value).toHaveLength(4)
  })

  it('each message has required id, role, text, timestamp fields', async () => {
    const { messages, ask } = useSpecCoach()
    const promise = ask('What about scale?', minimalSpec)
    vi.runAllTimersAsync()
    await promise

    for (const msg of messages.value) {
      expect(typeof msg.id).toBe('string')
      expect(msg.id.length).toBeGreaterThan(0)
      expect(['user', 'coach']).toContain(msg.role)
      expect(typeof msg.text).toBe('string')
      expect(typeof msg.timestamp).toBe('number')
    }
  })
})
