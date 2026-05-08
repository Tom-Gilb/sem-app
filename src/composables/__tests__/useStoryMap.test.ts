// UNIT_TYPE=Test
// Tests for useStoryMap composable (Feature #96)

import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import type { SpecBlock } from '../../types/spec'

const emptySpec: SpecBlock = {
  functions: [],
  values: [],
  solutions: [],
}

const specWithFEntries: SpecBlock = {
  functions: [
    {
      id: 'F.UserLogin',
      type: 'Function',
      level: 'Product',
      description: 'Allow a user to log in to the system',
      successCriteria: 'User can authenticate',
      functionOfValue: 'V.LoginFluency',
    },
    {
      id: 'F.AdminReport',
      type: 'Function',
      level: 'Product',
      description: 'Allow admin to generate monthly reports',
      successCriteria: 'Reports generated correctly',
      functionOfValue: 'V.ReportQuality',
    },
    {
      id: 'F.NoKeyword',
      type: 'Function',
      level: 'Product',
      description: 'Process background batch jobs',
      successCriteria: 'Jobs complete',
      functionOfValue: 'V.Throughput',
    },
  ],
  values: [
    {
      id: 'V.LoginFluency',
      type: 'Value',
      level: 'Product',
      description: 'Time to log in',
      scale: 'seconds',
      meter: 'stopwatch',
      status: 'pre-build',
      tolerable: '5s',
      goal: '2s',
      valueOfFunction: 'F.UserLogin',
    },
  ],
  solutions: [],
}

describe('useStoryMap', () => {
  it('initial state: storyMapOpen is false', async () => {
    const { useStoryMap } = await import('../useStoryMap')
    const specRef = ref<SpecBlock | null>(null)
    const { storyMapOpen } = useStoryMap(specRef)
    expect(storyMapOpen.value).toBe(false)
  })

  it('initial state: selectedLane is null', async () => {
    const { useStoryMap } = await import('../useStoryMap')
    const specRef = ref<SpecBlock | null>(null)
    const { selectedLane } = useStoryMap(specRef)
    expect(selectedLane.value).toBeNull()
  })

  it('empty spec: lanes is an empty array', async () => {
    const { useStoryMap } = await import('../useStoryMap')
    const specRef = ref<SpecBlock | null>(emptySpec)
    const { lanes } = useStoryMap(specRef)
    expect(lanes.value).toHaveLength(0)
  })

  it('null spec: lanes is an empty array', async () => {
    const { useStoryMap } = await import('../useStoryMap')
    const specRef = ref<SpecBlock | null>(null)
    const { lanes } = useStoryMap(specRef)
    expect(lanes.value).toHaveLength(0)
  })

  it('spec with F. entries produces at least 1 lane', async () => {
    const { useStoryMap } = await import('../useStoryMap')
    const specRef = ref<SpecBlock | null>(specWithFEntries)
    const { lanes } = useStoryMap(specRef)
    expect(lanes.value.length).toBeGreaterThanOrEqual(1)
  })

  it('F. entry with "user" in description is assigned to a user-related lane', async () => {
    const { useStoryMap } = await import('../useStoryMap')
    const specRef = ref<SpecBlock | null>(specWithFEntries)
    const { lanes } = useStoryMap(specRef)
    const userLane = lanes.value.find(l => l.stakeholder === 'User')
    expect(userLane).toBeDefined()
    expect(userLane!.entries.some(e => e.id === 'F.UserLogin')).toBe(true)
  })

  it('F. entry with no stakeholder keyword is placed in "General" lane', async () => {
    const { useStoryMap } = await import('../useStoryMap')
    const specRef = ref<SpecBlock | null>(specWithFEntries)
    const { lanes } = useStoryMap(specRef)
    const generalLane = lanes.value.find(l => l.stakeholder === 'General')
    expect(generalLane).toBeDefined()
    expect(generalLane!.entries.some(e => e.id === 'F.NoKeyword')).toBe(true)
  })

  it('"General" lane comes last in the sorted order', async () => {
    const { useStoryMap } = await import('../useStoryMap')
    const specRef = ref<SpecBlock | null>(specWithFEntries)
    const { lanes } = useStoryMap(specRef)
    const generalIndex = lanes.value.findIndex(l => l.stakeholder === 'General')
    // General should be at the last position if it exists
    if (generalIndex !== -1) {
      expect(generalIndex).toBe(lanes.value.length - 1)
    }
  })

  it('all F. entries are assigned to exactly one lane', async () => {
    const { useStoryMap } = await import('../useStoryMap')
    const specRef = ref<SpecBlock | null>(specWithFEntries)
    const { lanes } = useStoryMap(specRef)
    const allLaneEntries = lanes.value.flatMap(l => l.entries)
    const uniqueIds = new Set(allLaneEntries.map(e => e.id))
    expect(uniqueIds.size).toBe(specWithFEntries.functions.length)
    expect(allLaneEntries.length).toBe(specWithFEntries.functions.length)
  })

  it('lane.entries contains only F. type blocks (FEntry objects)', async () => {
    const { useStoryMap } = await import('../useStoryMap')
    const specRef = ref<SpecBlock | null>(specWithFEntries)
    const { lanes } = useStoryMap(specRef)
    for (const lane of lanes.value) {
      for (const entry of lane.entries) {
        expect(entry).toHaveProperty('id')
        expect(entry).toHaveProperty('description')
        expect(entry).toHaveProperty('successCriteria')
      }
    }
  })
})
