// UNIT_TYPE=Test
// Feature #157 — useApiContract composable tests

import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  useApiContract,
  charCodeSeed,
  buildPath,
  buildRequestSchema,
  buildResponseSchema,
  buildYamlBlock,
  buildApiEndpoint,
  formatFullYaml,
} from '../useApiContract'
import type { SpecBlock } from '../../types/spec'

function makeFEntry(id: string, description: string) {
  return { id, type: 'Function', level: 'Product', description, successCriteria: '', functionOfValue: '' }
}

function makeSEntry(id: string, description: string) {
  return { id, type: 'Solution', level: 'Product', description, impact: '', function: '' }
}

function makeBlock(
  fEntries: Array<{ id: string; description: string }> = [],
  sEntries: Array<{ id: string; description: string }> = [],
): SpecBlock {
  return {
    functions: fEntries.map((f) => makeFEntry(f.id, f.description)),
    values: [],
    solutions: sEntries.map((s) => makeSEntry(s.id, s.description)),
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('charCodeSeed', () => {
  it('returns sum of char codes', () => {
    expect(charCodeSeed('AB')).toBe('A'.charCodeAt(0) + 'B'.charCodeAt(0))
  })

  it('returns 0 for empty string', () => {
    expect(charCodeSeed('')).toBe(0)
  })
})

describe('buildPath', () => {
  it('starts with /', () => {
    expect(buildPath('F.MyFunc')).toMatch(/^\//)
  })

  it('replaces dots with slashes', () => {
    expect(buildPath('F.MyFunc')).toContain('/')
  })

  it('lowercases the path', () => {
    expect(buildPath('F.MyFunc')).toBe(buildPath('F.MyFunc').toLowerCase())
  })

  it('replaces non-alphanumeric non-slash chars with hyphens', () => {
    const path = buildPath('F.My_Func')
    expect(path).not.toContain('_')
  })
})

describe('buildRequestSchema', () => {
  it('returns "none" for GET', () => {
    expect(buildRequestSchema('GET', 'some description')).toBe('none')
  })

  it('returns "none" for DELETE', () => {
    expect(buildRequestSchema('DELETE', 'some description')).toBe('none')
  })

  it('returns schema string for POST', () => {
    const schema = buildRequestSchema('POST', 'create something')
    expect(schema).toContain('id')
    expect(schema).toContain('payload')
  })

  it('returns schema string for PUT', () => {
    const schema = buildRequestSchema('PUT', 'update something')
    expect(schema).toContain('id')
    expect(schema).toContain('payload')
  })
})

describe('buildResponseSchema', () => {
  it('returns 201 status for POST', () => {
    expect(buildResponseSchema('POST', 'F.MyEndpoint')).toContain('201')
  })

  it('returns 200 status for GET', () => {
    expect(buildResponseSchema('GET', 'F.MyEndpoint')).toContain('200')
  })

  it('returns 200 status for PUT', () => {
    expect(buildResponseSchema('PUT', 'F.MyEndpoint')).toContain('200')
  })

  it('returns 200 status for DELETE', () => {
    expect(buildResponseSchema('DELETE', 'F.MyEndpoint')).toContain('200')
  })

  it('includes entryId in response schema', () => {
    const schema = buildResponseSchema('GET', 'F.SpecialEndpoint')
    expect(schema).toContain('F.SpecialEndpoint')
  })
})

describe('buildYamlBlock', () => {
  it('includes path field', () => {
    const yaml = buildYamlBlock('/f/myfunc', 'GET', 'none', '{ status: 200, data: {} }')
    expect(yaml).toContain('path: /f/myfunc')
  })

  it('includes method field', () => {
    const yaml = buildYamlBlock('/f/myfunc', 'POST', '{ id: string }', '{ status: 201 }')
    expect(yaml).toContain('method: POST')
  })

  it('includes request field', () => {
    const yaml = buildYamlBlock('/f/myfunc', 'GET', 'none', '{ status: 200 }')
    expect(yaml).toContain('request: none')
  })

  it('includes response field', () => {
    const yaml = buildYamlBlock('/f/myfunc', 'GET', 'none', '{ status: 200, data: {} }')
    expect(yaml).toContain('response:')
  })
})

describe('buildApiEndpoint', () => {
  it('sets entryId correctly', () => {
    const ep = buildApiEndpoint('F.MyFunc', 'description')
    expect(ep.entryId).toBe('F.MyFunc')
  })

  it('sets entryName to entryId', () => {
    const ep = buildApiEndpoint('F.MyFunc', 'description')
    expect(ep.entryName).toBe('F.MyFunc')
  })

  it('method is one of GET/POST/PUT/DELETE', () => {
    const ep = buildApiEndpoint('F.MyFunc', 'description')
    expect(['GET', 'POST', 'PUT', 'DELETE']).toContain(ep.method)
  })

  it('method is deterministic', () => {
    expect(buildApiEndpoint('F.Alpha', 'desc').method).toBe(buildApiEndpoint('F.Alpha', 'desc').method)
  })

  it('path starts with /', () => {
    expect(buildApiEndpoint('F.MyFunc', 'desc').path).toMatch(/^\//)
  })

  it('yamlBlock contains path and method', () => {
    const ep = buildApiEndpoint('F.MyFunc', 'desc')
    expect(ep.yamlBlock).toContain('path:')
    expect(ep.yamlBlock).toContain('method:')
  })
})

describe('formatFullYaml', () => {
  it('combines all endpoint yaml blocks', () => {
    const ep1 = buildApiEndpoint('F.A', 'description one')
    const ep2 = buildApiEndpoint('F.B', 'description two')
    const yaml = formatFullYaml([ep1, ep2])
    expect(yaml).toContain(ep1.path)
    expect(yaml).toContain(ep2.path)
  })

  it('returns empty string for empty array', () => {
    expect(formatFullYaml([])).toBe('')
  })
})

describe('useApiContract', () => {
  it('returns endpoints for F. entries first', () => {
    const block = makeBlock(
      [{ id: 'F.A', description: 'desc' }],
      [{ id: 'S.A', description: 'desc' }],
    )
    const { endpoints } = useApiContract([block])
    expect(endpoints.value[0].entryId).toBe('F.A')
    expect(endpoints.value[1].entryId).toBe('S.A')
  })

  it('returns one endpoint per F. entry', () => {
    const block = makeBlock([{ id: 'F.A', description: 'desc' }, { id: 'F.B', description: 'desc' }])
    const { endpoints } = useApiContract([block])
    expect(endpoints.value.filter((e) => e.entryId.startsWith('F.'))).toHaveLength(2)
  })

  it('returns one endpoint per S. entry', () => {
    const block = makeBlock([], [{ id: 'S.A', description: 'desc' }, { id: 'S.B', description: 'desc' }])
    const { endpoints } = useApiContract([block])
    expect(endpoints.value.filter((e) => e.entryId.startsWith('S.'))).toHaveLength(2)
  })

  it('returns empty endpoints for empty blocks', () => {
    const { endpoints } = useApiContract([])
    expect(endpoints.value).toHaveLength(0)
  })

  it('returns endpoints across multiple blocks', () => {
    const b1 = makeBlock([{ id: 'F.X', description: 'desc' }])
    const b2 = makeBlock([{ id: 'F.Y', description: 'desc' }])
    const { endpoints } = useApiContract([b1, b2])
    expect(endpoints.value).toHaveLength(2)
  })

  it('yamlCopied starts as false', () => {
    const { yamlCopied } = useApiContract([])
    expect(yamlCopied.value).toBe(false)
  })

  it('copyYaml writes YAML to clipboard and sets yamlCopied=true', async () => {
    const written: string[] = []
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn((t: string) => { written.push(t); return Promise.resolve() }) },
    })
    const block = makeBlock([{ id: 'F.Clip', description: 'some description' }])
    const { copyYaml, yamlCopied } = useApiContract([block])
    await copyYaml()
    expect(written[0]).toContain('path:')
    expect(yamlCopied.value).toBe(true)
  })

  it('copyYaml does nothing when no endpoints', async () => {
    const writeText = vi.fn()
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const { copyYaml } = useApiContract([])
    await copyYaml()
    expect(writeText).not.toHaveBeenCalled()
  })

  it('yamlCopied flips back to false after 2s', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn(() => Promise.resolve()) },
    })
    const block = makeBlock([{ id: 'F.Timer', description: 'timer description' }])
    const { copyYaml, yamlCopied } = useApiContract([block])
    await copyYaml()
    expect(yamlCopied.value).toBe(true)
    vi.advanceTimersByTime(2000)
    expect(yamlCopied.value).toBe(false)
    vi.useRealTimers()
  })

  it('endpoint fields are deterministic', () => {
    const block = makeBlock([{ id: 'F.DeterminismCheck', description: 'desc' }])
    const { endpoints: e1 } = useApiContract([block])
    const { endpoints: e2 } = useApiContract([block])
    expect(e1.value[0].method).toBe(e2.value[0].method)
    expect(e1.value[0].path).toBe(e2.value[0].path)
  })

  it('each endpoint has a non-empty yamlBlock', () => {
    const block = makeBlock([{ id: 'F.A', description: 'desc' }])
    const { endpoints } = useApiContract([block])
    expect(endpoints.value[0].yamlBlock).toBeTruthy()
  })
})
