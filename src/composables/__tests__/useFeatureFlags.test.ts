// UNIT_TYPE=Test
// Feature #110 — useFeatureFlags composable tests

import { describe, it, expect, vi, afterEach } from 'vitest'
import { ref } from 'vue'
import { useFeatureFlags, toKebab } from '../useFeatureFlags'
import type { SpecBlock } from '../../types/spec'

function makeBlock(functionIds: string[], descriptions: Record<string, string> = {}): SpecBlock {
  return {
    functions: functionIds.map(id => ({
      id,
      type: 'Function',
      level: 'Product',
      description: descriptions[id] || `Description for ${id}`,
      successCriteria: '',
      functionOfValue: '',
    })),
    values: [],
    solutions: [],
  }
}

describe('toKebab', () => {
  it('strips F. prefix', () => {
    expect(toKebab('F.ProvideSEMInterface')).toBe('provide-sem-interface')
  })

  it('converts camelCase to kebab-case', () => {
    expect(toKebab('provideSemEntry')).toBe('provide-sem-entry')
  })

  it('converts spaces to hyphens', () => {
    expect(toKebab('Some Feature Name')).toBe('some-feature-name')
  })

  it('lowercases the result', () => {
    expect(toKebab('F.MyFeature')).toBe('my-feature')
  })

  it('strips special characters', () => {
    expect(toKebab('F.Feature#1!')).toBe('feature1')
  })
})

describe('useFeatureFlags', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('flags is empty when spec is null', () => {
    const specRef = ref<SpecBlock | null>(null)
    const { flags } = useFeatureFlags(specRef)
    expect(flags.value).toHaveLength(0)
  })

  it('builds flags from F. entries when spec is provided', () => {
    const specRef = ref<SpecBlock | null>(makeBlock(['F.Alpha', 'F.Beta']))
    const { flags } = useFeatureFlags(specRef)
    expect(flags.value).toHaveLength(2)
  })

  it('flag id is kebab-case of F. entry id', () => {
    const specRef = ref<SpecBlock | null>(makeBlock(['F.ProvideSEMInterface']))
    const { flags } = useFeatureFlags(specRef)
    expect(flags.value[0].id).toBe('provide-sem-interface')
  })

  it('flag label is original F. entry id', () => {
    const specRef = ref<SpecBlock | null>(makeBlock(['F.MyFeature']))
    const { flags } = useFeatureFlags(specRef)
    expect(flags.value[0].label).toBe('F.MyFeature')
  })

  it('flag enabled is true initially', () => {
    const specRef = ref<SpecBlock | null>(makeBlock(['F.Alpha']))
    const { flags } = useFeatureFlags(specRef)
    expect(flags.value[0].enabled).toBe(true)
  })

  it('flag description is first 60 chars of F. description', () => {
    const longDesc = 'A'.repeat(80)
    const specRef = ref<SpecBlock | null>(makeBlock(['F.Alpha'], { 'F.Alpha': longDesc }))
    const { flags } = useFeatureFlags(specRef)
    expect(flags.value[0].description).toHaveLength(60)
  })

  it('toggleFlag flips enabled from true to false', () => {
    const specRef = ref<SpecBlock | null>(makeBlock(['F.Alpha']))
    const { flags, toggleFlag } = useFeatureFlags(specRef)
    toggleFlag(flags.value[0].id)
    expect(flags.value[0].enabled).toBe(false)
  })

  it('toggleFlag flips enabled back to true on second call', () => {
    const specRef = ref<SpecBlock | null>(makeBlock(['F.Alpha']))
    const { flags, toggleFlag } = useFeatureFlags(specRef)
    const id = flags.value[0].id
    toggleFlag(id)
    toggleFlag(id)
    expect(flags.value[0].enabled).toBe(true)
  })

  it('toggleFlag with unknown id does nothing', () => {
    const specRef = ref<SpecBlock | null>(makeBlock(['F.Alpha']))
    const { flags, toggleFlag } = useFeatureFlags(specRef)
    toggleFlag('nonexistent-flag')
    expect(flags.value[0].enabled).toBe(true)
  })

  it('exportJson returns valid JSON with featureFlags key', () => {
    const specRef = ref<SpecBlock | null>(makeBlock(['F.Alpha']))
    const { exportJson } = useFeatureFlags(specRef)
    const json = exportJson()
    const parsed = JSON.parse(json)
    expect(parsed).toHaveProperty('featureFlags')
    expect(Array.isArray(parsed.featureFlags)).toBe(true)
  })

  it('exportJson includes toggled state', () => {
    const specRef = ref<SpecBlock | null>(makeBlock(['F.Alpha']))
    const { flags, toggleFlag, exportJson } = useFeatureFlags(specRef)
    toggleFlag(flags.value[0].id)
    const parsed = JSON.parse(exportJson())
    expect(parsed.featureFlags[0].enabled).toBe(false)
  })

  it('copied is false initially', () => {
    const specRef = ref<SpecBlock | null>(null)
    const { copied } = useFeatureFlags(specRef)
    expect(copied.value).toBe(false)
  })

  it('copyJson sets copied to true after clipboard write', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
    const specRef = ref<SpecBlock | null>(makeBlock(['F.Alpha']))
    const { copyJson, copied } = useFeatureFlags(specRef)
    await copyJson()
    expect(copied.value).toBe(true)
  })
})
