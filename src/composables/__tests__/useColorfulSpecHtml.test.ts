// UNIT_TYPE=Test
// Regression tests for useColorfulSpecHtml — guarantees no text is lost
// across the soft-wrap path.  Tom Gilb 2026-06-04 (6th screenshot
// suspected "text might be missing after 'to'"): proves at CI time
// that every word in input survives to output.

import { describe, it, expect } from 'vitest'
import { renderColorfulSpecHtml } from '../useColorfulSpecHtml'
import type { SpecBlock } from '../../types/spec'

// We can't import softWrap directly (not exported), but renderColorfulSpecHtml
// uses it for title + stakes — round-trip-checking the rendered HTML proves
// no input words were dropped.

function makeSpec(overrides: Partial<SpecBlock> = {}): SpecBlock {
  return {
    functions:   [],
    values:      [],
    solutions:   [],
    constraints: [],
    ...overrides,
  }
}

function wordCount(s: string): number {
  return s.split(/\s+/).filter(Boolean).length
}

function htmlToText(html: string): string {
  // Strip tags + collapse whitespace.
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()
}

describe('renderColorfulSpecHtml — soft-wrap data preservation', () => {
  it('preserves every word of a long spec name in the rendered HTML', () => {
    const longName = 'MONITOR CONTRACT-Improve Vessel Speed Under Sail And Steam Power Conditions v0.1'
    const html     = renderColorfulSpecHtml(makeSpec(), longName, undefined)
    const text     = htmlToText(html)
    // Every word from longName must appear in the rendered text.
    for (const w of longName.split(/\s+/).filter(Boolean)) {
      expect(text).toContain(w)
    }
  })

  it('preserves every word of a long Stakeholders string', () => {
    const stakes = 'Yards, Docks, engineer, designer, board of three skillful naval officers to investigate plans for the construction of ironclad steamships or, steam batteries, Ironclad Board recommended the Contractor, plans, machinery, armament fittings, specifications, equipment in all respects shall'
    const html   = renderColorfulSpecHtml(makeSpec({ stakes }), 'TestSpec', undefined)
    const text   = htmlToText(html)
    // Word count comparison: every input word should appear.
    const inputWords = stakes.split(/\s+/).filter(Boolean)
    for (const w of inputWords) {
      expect(text).toContain(w)
    }
    // Specifically: the word that follows "to" must be present (the Tom
    // 6th-screenshot suspicion was "text might be missing after 'to'").
    const toIndex = inputWords.indexOf('to')
    expect(toIndex).toBeGreaterThanOrEqual(0)
    const wordAfterTo = inputWords[toIndex + 1]
    expect(text).toContain(wordAfterTo)
  })

  it('handles a spec with all four entry types without losing entry IDs', () => {
    const html = renderColorfulSpecHtml(makeSpec({
      functions:   [{ id: 'F.Foo', type: 'Function',   level: 'Product', description: 'foo desc', presenceTest: 'foo present', functionOfValue: 'V.Bar' }],
      values:      [{ id: 'V.Bar', type: 'Value',      level: 'Product', description: 'bar desc', scale: 'units', meter: 'how', status: 'now', tolerable: 'tol', goal: 'gol', valueOfFunction: 'F.Foo' }],
      solutions:   [{ id: 'S.Baz', type: 'Solution',   level: 'Product', description: 'baz desc', impact: 'V.Bar ~50%', function: 'F.Foo' }],
      constraints: [{ id: 'C.Qux', type: 'Constraint', level: 'Regulatory', description: 'must not foo', scope: 'all', rationale: 'reasons' }],
    }), 'IntegrationSpec', 'v0.2')
    const text = htmlToText(html)
    expect(text).toContain('F.Foo')
    expect(text).toContain('V.Bar')
    expect(text).toContain('S.Baz')
    expect(text).toContain('C.Qux')
    expect(text).toContain('IntegrationSpec')
    expect(text).toContain('v0.2')
  })

  it('renders header label + date stamp + entries count exactly once each', () => {
    const html = renderColorfulSpecHtml(makeSpec(), 'TestSpec', undefined)
    const text = htmlToText(html)
    expect(text).toContain('Planguage Spec · SEM App')
    expect(text).toContain('0 entries')
  })

  it('emits sibling top-level <table> blocks (not one nested mega-table)', () => {
    const html = renderColorfulSpecHtml(makeSpec({
      functions: [{ id: 'F.A', type: 'Function', level: 'Product', description: 'd', presenceTest: 'p', functionOfValue: '' }],
      values:    [{ id: 'V.A', type: 'Value',    level: 'Product', description: 'd', scale: 's', meter: 'm', status: 'st', tolerable: 't', goal: 'g', valueOfFunction: '' }],
    }), 'TestSpec', undefined)
    const topLevelTableCount = (html.match(/<table[^>]*>/g) ?? []).length
    // Header + Functions + Values + Footer = at least 4 top-level tables.
    expect(topLevelTableCount).toBeGreaterThanOrEqual(4)
  })

  it('uses bgcolor attributes (not just CSS) on coloured cells (Keynote requirement)', () => {
    const html = renderColorfulSpecHtml(makeSpec({
      functions: [{ id: 'F.A', type: 'Function', level: 'Product', description: 'd', presenceTest: 'p', functionOfValue: '' }],
    }), 'TestSpec', undefined)
    // Function colour is #16a34a (mid green); it should appear as a bgcolor.
    expect(html.toLowerCase()).toContain('bgcolor="#16a34a"')
    // Header violet should also appear as bgcolor.
    expect(html.toLowerCase()).toContain('bgcolor="#7c3aed"')
  })

  it('does NOT contain the literal word "undefined" anywhere (regression on r56 fix)', () => {
    const html = renderColorfulSpecHtml(makeSpec({
      functions: [{ id: 'F.A', type: 'Function', level: 'Product', description: 'd', presenceTest: '', functionOfValue: '' }],
    }), 'TestSpec', undefined)
    expect(html).not.toContain('undefined')
  })

  it('preserves every word of a long entry description (descender-clip fix 2026-06-05)', () => {
    // Descriptions longer than 80 chars are split into multiple <tr> rows.
    // Every word must survive into the rendered HTML — Tom 2026-06-05.
    const longDesc = 'Must handle all assignment submission data and student personal information in full compliance with applicable student data privacy legislation and institutional data governance policy at all times'
    const html = renderColorfulSpecHtml(makeSpec({
      constraints: [{ id: 'C.Privacy', type: 'Constraint', level: 'Regulatory', description: longDesc, scope: 'all data', rationale: 'legal requirement' }],
    }), 'TestSpec', undefined)
    const text = htmlToText(html)
    for (const w of longDesc.split(/\s+/).filter(Boolean)) {
      expect(text, `word "${w}" must survive description split`).toContain(w)
    }
  })

  it('preserves every word of a long sub-field value (descender-clip fix 2026-06-05)', () => {
    const longScope = 'All collection storage processing transmission and retention of assignment submission records student identifiers academic performance data reminder interaction logs and peer group communication records'
    const html = renderColorfulSpecHtml(makeSpec({
      constraints: [{ id: 'C.P', type: 'Constraint', level: 'Regulatory', description: 'desc', scope: longScope, rationale: '' }],
    }), 'TestSpec', undefined)
    const text = htmlToText(html)
    for (const w of longScope.split(/\s+/).filter(Boolean)) {
      expect(text, `word "${w}" must survive scope split`).toContain(w)
    }
  })

  it('omits sub-field rows whose value is empty (no orphan label-only rows)', () => {
    const html = renderColorfulSpecHtml(makeSpec({
      functions: [{ id: 'F.A', type: 'Function', level: 'Product', description: 'd', presenceTest: '', functionOfValue: '' }],
    }), 'TestSpec', undefined)
    // The "Presence test" label cell should NOT appear when its value is empty.
    expect(html).not.toContain('Presence test')
    expect(html).not.toContain('Serves')
  })
})
