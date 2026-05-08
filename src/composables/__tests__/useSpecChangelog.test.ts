// UNIT_TYPE=Test
// Feature #69 — useSpecChangelog composable tests

import { describe, it, expect } from 'vitest'
import { useSpecChangelog } from '../useSpecChangelog'
import type { SpecBlock } from '../../types/spec'

const makeSpec = (ids: string[]): SpecBlock => ({
  functions: [],
  values: ids.map(id => ({
    id,
    type: 'Value',
    level: 'Product',
    description: `Description for ${id}`,
    scale: 'units',
    meter: 'Tracked',
    status: '0',
    tolerable: '1',
    goal: '2',
    valueOfFunction: '',
  })),
  solutions: [],
})

const emptySpec: SpecBlock = { functions: [], values: [], solutions: [] }

describe('useSpecChangelog', () => {
  it('initial changelog has 2 seed entries', () => {
    const { changelog } = useSpecChangelog()
    expect(changelog.value.length).toBe(2)
  })

  it('changelogOpen starts false', () => {
    const { changelogOpen } = useSpecChangelog()
    expect(changelogOpen.value).toBe(false)
  })

  it('recordChange with null old marks all entries as added', () => {
    const { changelog, recordChange } = useSpecChangelog()
    const spec = makeSpec(['V.A', 'V.B', 'V.C'])
    recordChange(null, spec)
    const latest = changelog.value[0]
    expect(latest.entriesAdded).toBe(3)
    expect(latest.entriesChanged).toBe(0)
    expect(latest.entriesRemoved).toBe(0)
  })

  it('recordChange with identical spec gives 0 added, 0 changed, 0 removed', () => {
    const { changelog, recordChange } = useSpecChangelog()
    const spec = makeSpec(['V.A', 'V.B'])
    recordChange(spec, spec)
    const latest = changelog.value[0]
    expect(latest.entriesAdded).toBe(0)
    expect(latest.entriesChanged).toBe(0)
    expect(latest.entriesRemoved).toBe(0)
  })

  it('recordChange prepends entries so newest is first', () => {
    const { changelog, recordChange } = useSpecChangelog()
    const initial = changelog.value.length
    recordChange(null, makeSpec(['V.X']))
    recordChange(null, makeSpec(['V.Y', 'V.Z']))
    expect(changelog.value.length).toBe(initial + 2)
    // Newest entry is first: 2 entries added
    expect(changelog.value[0].entriesAdded).toBe(2)
    expect(changelog.value[1].entriesAdded).toBe(1)
  })

  it('summary string includes the entry counts', () => {
    const { changelog, recordChange } = useSpecChangelog()
    recordChange(null, makeSpec(['V.A', 'V.B']))
    const latest = changelog.value[0]
    expect(latest.summary).toContain('2')
    expect(latest.summary).toContain('added')
  })

  it('clearChangelog empties the array', () => {
    const { changelog, clearChangelog } = useSpecChangelog()
    clearChangelog()
    expect(changelog.value.length).toBe(0)
  })

  it('copyChangelog output contains "## Changelog"', async () => {
    const writes: string[] = []
    Object.defineProperty(globalThis, 'navigator', {
      value: { clipboard: { writeText: (t: string) => { writes.push(t); return Promise.resolve() } } },
      configurable: true,
    })
    const { copyChangelog } = useSpecChangelog()
    copyChangelog()
    expect(writes[0]).toContain('## Changelog')
  })

  it('changelog.length reflects actual count', () => {
    const { changelog, recordChange, clearChangelog } = useSpecChangelog()
    clearChangelog()
    expect(changelog.value.length).toBe(0)
    recordChange(null, makeSpec(['V.A']))
    expect(changelog.value.length).toBe(1)
    recordChange(null, makeSpec(['V.B']))
    expect(changelog.value.length).toBe(2)
  })

  it('each entry has required fields: id, timestamp, summary, entriesAdded/Changed/Removed', () => {
    const { changelog } = useSpecChangelog()
    for (const entry of changelog.value) {
      expect(entry).toHaveProperty('id')
      expect(entry).toHaveProperty('timestamp')
      expect(entry).toHaveProperty('summary')
      expect(entry).toHaveProperty('entriesAdded')
      expect(entry).toHaveProperty('entriesChanged')
      expect(entry).toHaveProperty('entriesRemoved')
    }
  })

  it('recordChange detects removed entries', () => {
    const { changelog, recordChange } = useSpecChangelog()
    const oldSpec = makeSpec(['V.A', 'V.B', 'V.C'])
    const newSpec = makeSpec(['V.A'])
    recordChange(oldSpec, newSpec)
    const latest = changelog.value[0]
    expect(latest.entriesRemoved).toBe(2)
  })

  it('recordChange detects changed descriptions', () => {
    const { changelog, recordChange } = useSpecChangelog()
    const oldSpec = makeSpec(['V.A'])
    const newSpec: SpecBlock = {
      functions: [],
      values: [{
        id: 'V.A',
        type: 'Value',
        level: 'Product',
        description: 'DIFFERENT DESCRIPTION',
        scale: 'units',
        meter: 'Tracked',
        status: '0',
        tolerable: '1',
        goal: '2',
        valueOfFunction: '',
      }],
      solutions: [],
    }
    recordChange(oldSpec, newSpec)
    const latest = changelog.value[0]
    expect(latest.entriesChanged).toBe(1)
    expect(latest.entriesAdded).toBe(0)
    expect(latest.entriesRemoved).toBe(0)
  })
})
