// UNIT_TYPE=Test
// Feature #172 — useWbs composable tests

import { describe, it, expect, vi, afterEach } from 'vitest'
import { useWbs, buildWbsNode, seed } from '../useWbs'
import type { SpecBlock } from '../../types/spec'

function makeBlock(fId: string, desc = `Description for ${fId}`): SpecBlock {
  return {
    functions: [{ id: fId, type: 'Function', level: 'Product', description: desc, successCriteria: '', functionOfValue: '' }],
    values: [],
    solutions: [],
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

// ── seed helper tests ─────────────────────────────────────────────────────────

describe('seed', () => {
  it('returns 0 for empty string with any mod', () => {
    expect(seed('', 8)).toBe(0)
  })

  it('is deterministic — same inputs yield same output', () => {
    expect(seed('F.Build', 8)).toBe(seed('F.Build', 8))
  })

  it('result is within [0, mod-1]', () => {
    const result = seed('F.Deploy', 8)
    expect(result).toBeGreaterThanOrEqual(0)
    expect(result).toBeLessThan(8)
  })
})

// ── buildWbsNode unit tests ───────────────────────────────────────────────────

describe('buildWbsNode', () => {
  it('fId matches supplied id', () => {
    const node = buildWbsNode('F.Alpha', 'Build the alpha feature')
    expect(node.fId).toBe('F.Alpha')
  })

  it('fLabel is description truncated to 60 chars', () => {
    const node = buildWbsNode('F.Long', 'x'.repeat(100))
    expect(node.fLabel.length).toBeLessThanOrEqual(60)
  })

  it('always has exactly 3 subTasks', () => {
    const node = buildWbsNode('F.Three', 'desc')
    expect(node.subTasks).toHaveLength(3)
  })

  it('each subTask has exactly 2 microTasks', () => {
    const node = buildWbsNode('F.Micro', 'desc')
    for (const sub of node.subTasks) {
      expect(sub.microTasks).toHaveLength(2)
    }
  })

  it('subTask labels come from the known pool', () => {
    const SUB_POOL = [
      'Design interface', 'Write unit tests', 'Implement core logic',
      'Review with stakeholders', 'Document API', 'Validate edge cases',
      'Deploy to staging', 'Gather feedback',
    ]
    const node = buildWbsNode('F.Pool', 'desc')
    for (const sub of node.subTasks) {
      expect(SUB_POOL).toContain(sub.label)
    }
  })

  it('microTask labels come from the known pool', () => {
    const MICRO_POOL = [
      'Draft wireframe', 'Code scaffold', 'Write test cases', 'Peer review',
      'Update docs', 'CI/CD check', 'User acceptance', 'Post-deploy monitor',
    ]
    const node = buildWbsNode('F.Micro2', 'desc')
    for (const sub of node.subTasks) {
      for (const micro of sub.microTasks) {
        expect(MICRO_POOL).toContain(micro)
      }
    }
  })

  it('is deterministic — same inputs produce same subTask labels', () => {
    const n1 = buildWbsNode('F.Stable', 'desc')
    const n2 = buildWbsNode('F.Stable', 'desc')
    expect(n1.subTasks[0].label).toBe(n2.subTasks[0].label)
    expect(n1.subTasks[1].label).toBe(n2.subTasks[1].label)
    expect(n1.subTasks[2].label).toBe(n2.subTasks[2].label)
  })

  it('is deterministic — same inputs produce same microTask labels', () => {
    const n1 = buildWbsNode('F.Stable2', 'desc')
    const n2 = buildWbsNode('F.Stable2', 'desc')
    for (let s = 0; s < 3; s++) {
      expect(n1.subTasks[s].microTasks[0]).toBe(n2.subTasks[s].microTasks[0])
      expect(n1.subTasks[s].microTasks[1]).toBe(n2.subTasks[s].microTasks[1])
    }
  })
})

// ── useWbs composable tests ───────────────────────────────────────────────────

describe('useWbs', () => {
  it('nodes is empty for empty blocks array', () => {
    const { nodes } = useWbs([])
    expect(nodes.value).toHaveLength(0)
  })

  it('one node per F. entry', () => {
    const blocks = [makeBlock('F.One'), makeBlock('F.Two')]
    const { nodes } = useWbs(blocks)
    expect(nodes.value).toHaveLength(2)
  })

  it('node fId matches the F. entry id', () => {
    const { nodes } = useWbs([makeBlock('F.Check')])
    expect(nodes.value[0].fId).toBe('F.Check')
  })

  it('open starts as false', () => {
    const { open } = useWbs([])
    expect(open.value).toBe(false)
  })

  it('copied starts as false', () => {
    const { copied } = useWbs([])
    expect(copied.value).toBe(false)
  })

  it('expandedIds starts empty', () => {
    const { expandedIds } = useWbs([])
    expect(expandedIds.value.size).toBe(0)
  })

  it('toggleExpand adds an id', () => {
    const { expandedIds, toggleExpand } = useWbs([makeBlock('F.Expand')])
    toggleExpand('F.Expand')
    expect(expandedIds.value.has('F.Expand')).toBe(true)
  })

  it('toggleExpand on same id removes it', () => {
    const { expandedIds, toggleExpand } = useWbs([makeBlock('F.Toggle')])
    toggleExpand('F.Toggle')
    toggleExpand('F.Toggle')
    expect(expandedIds.value.has('F.Toggle')).toBe(false)
  })

  it('copyMarkdown writes WBS markdown to clipboard', async () => {
    const written: string[] = []
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn((t: string) => { written.push(t); return Promise.resolve() }) },
    })
    const { copyMarkdown } = useWbs([makeBlock('F.Wbs')])
    await copyMarkdown()
    expect(written[0]).toContain('## WBS: F.Wbs')
  })

  it('copyMarkdown includes sub-task labels indented with 2 spaces', async () => {
    const written: string[] = []
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn((t: string) => { written.push(t); return Promise.resolve() }) },
    })
    const { copyMarkdown } = useWbs([makeBlock('F.Sub')])
    await copyMarkdown()
    // Should contain lines starting with two spaces and a dash
    expect(written[0]).toMatch(/  - /)
  })

  it('copyMarkdown includes micro-task labels indented with 4 spaces', async () => {
    const written: string[] = []
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn((t: string) => { written.push(t); return Promise.resolve() }) },
    })
    const { copyMarkdown } = useWbs([makeBlock('F.Micro')])
    await copyMarkdown()
    expect(written[0]).toMatch(/    - /)
  })

  it('copyMarkdown does not throw for empty blocks', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn(() => Promise.resolve()) },
    })
    const { copyMarkdown } = useWbs([])
    await expect(copyMarkdown()).resolves.not.toThrow()
  })
})
