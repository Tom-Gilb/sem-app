// Spec: S.Evo98.ExpectedValueCalculator — EV Mode composable tests (Feature #98)
// Tests for useExpectedValue composable

import { describe, test, expect } from 'vitest'
import { ref, nextTick } from 'vue'
import { useExpectedValue } from '../useExpectedValue'
import type { ImpactMatrix } from '../../types/impact'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMatrix(vIds: string[], sIds: string[], score: number): ImpactMatrix {
  const matrix: ImpactMatrix = {}
  for (const vId of vIds) {
    matrix[vId] = {}
    for (const sId of sIds) {
      matrix[vId][sId] = score
    }
  }
  return matrix
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useExpectedValue', () => {

  // 1. Initial: evModeOpen false
  test('evModeOpen is false on initialisation', () => {
    const vEntryIds = ref<string[]>(['V.One', 'V.Two'])
    const matrix = ref<ImpactMatrix>(makeMatrix(['V.One', 'V.Two'], ['S.Alpha'], 50))
    const { evModeOpen } = useExpectedValue(vEntryIds, matrix)
    expect(evModeOpen.value).toBe(false)
  })

  // 2. Probabilities initialised to 70 for all V. entry IDs
  test('probabilities initialised to 70 for each V. entry ID', () => {
    const vEntryIds = ref<string[]>(['V.One', 'V.Two', 'V.Three'])
    const matrix = ref<ImpactMatrix>(makeMatrix(['V.One', 'V.Two', 'V.Three'], [], 0))
    const { probabilities } = useExpectedValue(vEntryIds, matrix)
    expect(probabilities.value['V.One']).toBe(70)
    expect(probabilities.value['V.Two']).toBe(70)
    expect(probabilities.value['V.Three']).toBe(70)
  })

  // 3. setProbability updates the value
  test('setProbability updates the probability for a given V. entry', () => {
    const vEntryIds = ref<string[]>(['V.One'])
    const matrix = ref<ImpactMatrix>(makeMatrix(['V.One'], ['S.Alpha'], 40))
    const { probabilities, setProbability } = useExpectedValue(vEntryIds, matrix)
    setProbability('V.One', 55)
    expect(probabilities.value['V.One']).toBe(55)
  })

  // 4. setProbability clamps to 0 (lower bound)
  test('setProbability clamps negative values to 0', () => {
    const vEntryIds = ref<string[]>(['V.One'])
    const matrix = ref<ImpactMatrix>(makeMatrix(['V.One'], [], 0))
    const { probabilities, setProbability } = useExpectedValue(vEntryIds, matrix)
    setProbability('V.One', -20)
    expect(probabilities.value['V.One']).toBe(0)
  })

  // 5. setProbability clamps to 100 (upper bound)
  test('setProbability clamps values above 100 to 100', () => {
    const vEntryIds = ref<string[]>(['V.One'])
    const matrix = ref<ImpactMatrix>(makeMatrix(['V.One'], [], 0))
    const { probabilities, setProbability } = useExpectedValue(vEntryIds, matrix)
    setProbability('V.One', 150)
    expect(probabilities.value['V.One']).toBe(100)
  })

  // 6. expectedValues with prob=100 equals sum of all impact scores for that V. entry
  test('expectedValues with prob=100 equals sum of all impact scores for a V. entry', () => {
    const vId = 'V.One'
    const sIds = ['S.Alpha', 'S.Beta', 'S.Gamma']
    const score = 40
    const vEntryIds = ref<string[]>([vId])
    const matrix = ref<ImpactMatrix>(makeMatrix([vId], sIds, score))
    const { setProbability, expectedValues } = useExpectedValue(vEntryIds, matrix)
    setProbability(vId, 100)
    // 3 solutions × 40 = 120
    expect(expectedValues.value[vId]).toBeCloseTo(sIds.length * score)
  })

  // 7. expectedValues with prob=0 equals 0
  test('expectedValues with prob=0 equals 0', () => {
    const vId = 'V.One'
    const sIds = ['S.Alpha', 'S.Beta']
    const vEntryIds = ref<string[]>([vId])
    const matrix = ref<ImpactMatrix>(makeMatrix([vId], sIds, 80))
    const { setProbability, expectedValues } = useExpectedValue(vEntryIds, matrix)
    setProbability(vId, 0)
    expect(expectedValues.value[vId]).toBeCloseTo(0)
  })

  // 8. aggregateEV equals sum of all expectedValues
  test('aggregateEV equals sum of all expectedValues', () => {
    const vIds = ['V.One', 'V.Two']
    const sIds = ['S.Alpha', 'S.Beta']
    const score = 50
    const vEntryIds = ref<string[]>(vIds)
    const matrix = ref<ImpactMatrix>(makeMatrix(vIds, sIds, score))
    const { setProbability, expectedValues, aggregateEV } = useExpectedValue(vEntryIds, matrix)
    // Set both to 100% so EV = 2 solutions × 50 = 100 per entry
    setProbability('V.One', 100)
    setProbability('V.Two', 100)
    const expected = Object.values(expectedValues.value).reduce((a, b) => a + b, 0)
    expect(aggregateEV.value).toBeCloseTo(expected)
    expect(aggregateEV.value).toBeCloseTo(200) // 2 vIds × 2 sols × 50 * 1.0
  })

  // 9. topVEntry returns the ID with the highest EV
  test('topVEntry returns the V. entry ID with the highest EV', () => {
    const vEntryIds = ref<string[]>(['V.Low', 'V.High'])
    // V.Low gets score 10, V.High gets score 90 → at default 70% prob V.High > V.Low
    const matrix = ref<ImpactMatrix>({
      'V.Low':  { 'S.X': 10 },
      'V.High': { 'S.X': 90 },
    })
    const { topVEntry } = useExpectedValue(vEntryIds, matrix)
    expect(topVEntry.value).toBe('V.High')
  })

  // 10. topVEntry returns null for empty vEntryIds
  test('topVEntry returns null when vEntryIds is empty', () => {
    const vEntryIds = ref<string[]>([])
    const matrix = ref<ImpactMatrix>({})
    const { topVEntry } = useExpectedValue(vEntryIds, matrix)
    expect(topVEntry.value).toBeNull()
  })

  // 11. New vEntryId added: gets default prob=70
  test('new vEntryId added to list gets default probability of 70', async () => {
    const vEntryIds = ref<string[]>(['V.One'])
    const matrix = ref<ImpactMatrix>(makeMatrix(['V.One', 'V.New'], ['S.Alpha'], 30))
    const { probabilities } = useExpectedValue(vEntryIds, matrix)
    // Initially only V.One is present
    expect(probabilities.value['V.New']).toBeUndefined()
    // Now add V.New
    vEntryIds.value = ['V.One', 'V.New']
    await nextTick()
    expect(probabilities.value['V.New']).toBe(70)
  })

  // 12. expectedValues reacts to impactMatrix changes
  test('expectedValues updates when impactMatrix changes', async () => {
    const vId = 'V.One'
    const vEntryIds = ref<string[]>([vId])
    const matrix = ref<ImpactMatrix>({ [vId]: { 'S.Alpha': 20 } })
    const { setProbability, expectedValues } = useExpectedValue(vEntryIds, matrix)
    setProbability(vId, 100)
    expect(expectedValues.value[vId]).toBeCloseTo(20)

    // Update the matrix
    matrix.value = { [vId]: { 'S.Alpha': 60 } }
    await nextTick()
    expect(expectedValues.value[vId]).toBeCloseTo(60)
  })

})
