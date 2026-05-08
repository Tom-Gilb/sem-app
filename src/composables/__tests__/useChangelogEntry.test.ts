// UNIT_TYPE=Test
// Feature #152 — useChangelogEntry composable tests

import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  useChangelogEntry,
  buildChangelogEntry,
  formatChangelogBlock,
} from '../useChangelogEntry'
import type { SpecBlock } from '../../types/spec'

function makeBlock(fEntries: Array<{ id: string; description?: string }> = []): SpecBlock {
  return {
    functions: fEntries.map((f) => ({
      id: f.id,
      type: 'Function',
      level: 'Product',
      description: f.description ?? `Description for ${f.id}`,
      successCriteria: '',
      functionOfValue: '',
    })),
    values: [],
    solutions: [],
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('buildChangelogEntry', () => {
  it('sets fEntryId correctly', () => {
    const entry = buildChangelogEntry('F.Deploy', 'F.Deploy', 'Deploy to production')
    expect(entry.fEntryId).toBe('F.Deploy')
  })

  it('sets fEntryName correctly', () => {
    const entry = buildChangelogEntry('F.Deploy', 'F.Deploy', 'Deploy to production')
    expect(entry.fEntryName).toBe('F.Deploy')
  })

  it('type is one of the 5 valid types', () => {
    const validTypes = ['feat', 'fix', 'perf', 'docs', 'refactor']
    const entry = buildChangelogEntry('F.Alpha', 'F.Alpha', 'Some description')
    expect(validTypes).toContain(entry.type)
  })

  it('scope is first 12 non-whitespace chars of id, lowercased, dots replaced with dashes', () => {
    // 'F.Deploy' -> 'f-deploy' (8 chars, all within 12)
    const entry = buildChangelogEntry('F.Deploy', 'F.Deploy', 'Some description')
    expect(entry.scope).toBe('f-deploy')
  })

  it('scope truncates to 12 chars max', () => {
    const entry = buildChangelogEntry('F.VeryLongIdentifierName', 'F.VeryLongIdentifierName', 'desc')
    expect(entry.scope.length).toBeLessThanOrEqual(12)
  })

  it('message is first 60 chars of description, trimmed, sentence-case', () => {
    // 65-char description — slice(0,60) should truncate to 60 chars
    const desc = 'improve the overall performance of the system in production now'
    const entry = buildChangelogEntry('F.Perf', 'F.Perf', desc)
    expect(entry.message).toBe('Improve the overall performance of the system in production')
  })

  it('message is sentence-cased (first char uppercase)', () => {
    const entry = buildChangelogEntry('F.Fix', 'F.Fix', 'fix a bug in the login flow')
    expect(entry.message[0]).toBe('F')
  })

  it('fullEntry is type(scope): message format', () => {
    const entry = buildChangelogEntry('F.Test', 'F.Test', 'Some test description for this function')
    expect(entry.fullEntry).toBe(`${entry.type}(${entry.scope}): ${entry.message}`)
  })

  it('is deterministic — same id produces same entry', () => {
    const e1 = buildChangelogEntry('F.Stable', 'F.Stable', 'A stable description')
    const e2 = buildChangelogEntry('F.Stable', 'F.Stable', 'A stable description')
    expect(e1).toEqual(e2)
  })

  it('maps seed % 5 = 0 to feat', () => {
    // Find an id whose charCode sum % 5 === 0
    // 'F.E': F=70, .=46, E=69 → sum=185, 185%5=0 → feat
    const entry = buildChangelogEntry('F.E', 'F.E', 'Enable a new feature for users')
    expect(entry.type).toBe('feat')
  })
})

describe('formatChangelogBlock', () => {
  it('includes ## [Unreleased] header with date', () => {
    const entry = buildChangelogEntry('F.Test', 'F.Test', 'Test function')
    const block = formatChangelogBlock([entry], '2026-05-02')
    expect(block).toContain('## [Unreleased] — 2026-05-02')
  })

  it('includes all fullEntry strings', () => {
    const e1 = buildChangelogEntry('F.One', 'F.One', 'First function entry')
    const e2 = buildChangelogEntry('F.Two', 'F.Two', 'Second function entry')
    const block = formatChangelogBlock([e1, e2], '2026-05-02')
    expect(block).toContain(e1.fullEntry)
    expect(block).toContain(e2.fullEntry)
  })

  it('has blank line after header', () => {
    const entry = buildChangelogEntry('F.Test', 'F.Test', 'Test function')
    const block = formatChangelogBlock([entry], '2026-05-02')
    const lines = block.split('\n')
    expect(lines[1]).toBe('')
  })
})

describe('useChangelogEntry', () => {
  it('returns one entry per F. entry', () => {
    const blocks = [makeBlock([{ id: 'F.A' }, { id: 'F.B' }])]
    const { entries } = useChangelogEntry(blocks)
    expect(entries.value).toHaveLength(2)
  })

  it('returns entries across multiple blocks', () => {
    const blocks = [makeBlock([{ id: 'F.X' }]), makeBlock([{ id: 'F.Y' }])]
    const { entries } = useChangelogEntry(blocks)
    expect(entries.value).toHaveLength(2)
  })

  it('returns empty entries for empty blocks', () => {
    const { entries } = useChangelogEntry([])
    expect(entries.value).toHaveLength(0)
  })

  it('versionBump is minor when any entry has type feat', () => {
    // 'F.E': charCode sum=185, 185%5=0 → feat
    const blocks = [makeBlock([{ id: 'F.E', description: 'Enable feature for users' }])]
    const { versionBump } = useChangelogEntry(blocks)
    expect(versionBump.value).toBe('minor')
  })

  it('versionBump is patch when no feat entries exist', () => {
    // Use an id that maps to fix/perf/docs/refactor (not feat)
    // 'F.Fix': F=70, .=46, F=70, i=105, x=120 → sum=411, 411%5=1 → fix
    const blocks = [makeBlock([{ id: 'F.Fix', description: 'Fix bug in login flow' }])]
    const { versionBump } = useChangelogEntry(blocks)
    // Should be patch (not minor)
    expect(versionBump.value).toBe('patch')
  })

  it('versionBump defaults to patch for empty entries', () => {
    const { versionBump } = useChangelogEntry([])
    expect(versionBump.value).toBe('patch')
  })

  it('allCopied starts as false', () => {
    const { allCopied } = useChangelogEntry([])
    expect(allCopied.value).toBe(false)
  })

  it('copyAll writes to clipboard and sets allCopied=true', async () => {
    const written: string[] = []
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn((t: string) => { written.push(t); return Promise.resolve() }) },
    })
    const blocks = [makeBlock([{ id: 'F.Clip', description: 'Clipboard test function' }])]
    const { copyAll, allCopied } = useChangelogEntry(blocks)
    await copyAll()
    expect(written[0]).toContain('## [Unreleased]')
    expect(allCopied.value).toBe(true)
  })

  it('copyAll does nothing when there are no entries', async () => {
    const writeText = vi.fn()
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const { copyAll } = useChangelogEntry([])
    await copyAll()
    expect(writeText).not.toHaveBeenCalled()
  })

  it('allCopied flips back to false after 2s', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn(() => Promise.resolve()) },
    })
    const blocks = [makeBlock([{ id: 'F.Timer', description: 'Timer test function description' }])]
    const { copyAll, allCopied } = useChangelogEntry(blocks)
    await copyAll()
    expect(allCopied.value).toBe(true)
    vi.advanceTimersByTime(2000)
    expect(allCopied.value).toBe(false)
    vi.useRealTimers()
  })
})
