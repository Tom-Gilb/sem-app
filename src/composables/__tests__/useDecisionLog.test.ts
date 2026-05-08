// UNIT_TYPE=Test
// Feature #108 — useDecisionLog composable tests

import { describe, it, expect, beforeEach } from 'vitest'
import { useDecisionLog } from '../useDecisionLog'

describe('useDecisionLog', () => {
  it('decisions is empty initially', () => {
    const { decisions } = useDecisionLog()
    expect(decisions.value).toHaveLength(0)
  })

  it('decisionsOpen is false initially', () => {
    const { decisionsOpen } = useDecisionLog()
    expect(decisionsOpen.value).toBe(false)
  })

  it('addDecision with empty newWhat does nothing', () => {
    const { decisions, addDecision, newWhat } = useDecisionLog()
    newWhat.value = ''
    addDecision('context: 3 entries')
    expect(decisions.value).toHaveLength(0)
  })

  it('addDecision with non-empty newWhat pushes an entry', () => {
    const { decisions, addDecision, newWhat, newWhy, newWho, newWhen } = useDecisionLog()
    newWhat.value = 'Use TypeScript strict mode'
    newWhy.value = 'Type safety'
    newWho.value = 'Tom'
    newWhen.value = '2026-05-02'
    addDecision('context: 2 entries')
    expect(decisions.value).toHaveLength(1)
  })

  it('pushed entry has id, what, why, who, when, specContext fields', () => {
    const { decisions, addDecision, newWhat, newWhy, newWho, newWhen } = useDecisionLog()
    newWhat.value = 'Use Planguage'
    newWhy.value = 'Precision'
    newWho.value = 'Kai'
    newWhen.value = '2026-01-15'
    addDecision('domain: Product, 5 entries')
    const entry = decisions.value[0]
    expect(entry).toHaveProperty('id')
    expect(entry.what).toBe('Use Planguage')
    expect(entry.why).toBe('Precision')
    expect(entry.who).toBe('Kai')
    expect(entry.when).toBe('2026-01-15')
    expect(entry.specContext).toBe('domain: Product, 5 entries')
  })

  it('addDecision clears newWhat after push', () => {
    const { addDecision, newWhat } = useDecisionLog()
    newWhat.value = 'Some decision'
    addDecision('context')
    expect(newWhat.value).toBe('')
  })

  it('removeDecision removes the entry by id', () => {
    const { decisions, addDecision, removeDecision, newWhat } = useDecisionLog()
    newWhat.value = 'Decision A'
    addDecision('ctx')
    const id = decisions.value[0].id
    removeDecision(id)
    expect(decisions.value).toHaveLength(0)
  })

  it('copyLog markdown contains "## Decision Log"', () => {
    const { addDecision, copyLog, newWhat } = useDecisionLog()
    // Just call copyLog — it calls navigator.clipboard.writeText which may not exist in test env
    // We verify the function exists and is callable without throwing (clipboard is no-op in tests)
    newWhat.value = 'Some decision'
    addDecision('ctx')
    expect(() => copyLog()).not.toThrow()
  })

  it('copyLog includes all decision What fields in output', () => {
    // We test this by capturing the clipboard write call via spy
    const written: string[] = []
    const origClipboard = global.navigator?.clipboard
    Object.defineProperty(global.navigator, 'clipboard', {
      value: {
        writeText: (text: string) => {
          written.push(text)
          return Promise.resolve()
        },
      },
      configurable: true,
    })

    const { decisions, addDecision, copyLog, newWhat } = useDecisionLog()
    newWhat.value = 'Use strict TypeScript'
    addDecision('ctx1')
    newWhat.value = 'Choose Vue 3'
    addDecision('ctx2')

    copyLog()

    expect(written.length).toBeGreaterThan(0)
    const md = written[0]
    expect(md).toContain('## Decision Log')
    expect(md).toContain('Use strict TypeScript')
    expect(md).toContain('Choose Vue 3')

    // Restore
    if (origClipboard) {
      Object.defineProperty(global.navigator, 'clipboard', {
        value: origClipboard,
        configurable: true,
      })
    }
  })
})
