// UNIT_TYPE=Hook
// useSpecImport — parse the SEM App's own Markdown spec output back into a SpecBlock.
//
// Tom 2026-05-15: "I actually want to be able to load in files which are the
// final output from this app!" — when a user imports a .md or .txt file whose
// content is a serialised Planguage spec (produced by useSpecExport.serialise()),
// we should recognise it and load it directly as a live SpecBlock, bypassing
// the SEM classifier (which would mangle the structured format).
//
// Detection: the serialiser always writes `#### F.`, `#### V.`, or `#### S.`
// entry headings. If those patterns exist, the text is treated as a spec.
//
// Supported input formats:
//   • Markdown output of useSpecExport.serialise() — the canonical round-trip
//   • Both old "Success-Criteria:" and new "Presence-Test:" field names
//   • Both "Value of function:" and "valueOfFunction:" key spellings
//
// Returns null (with reason) if the text is not a recognisable spec format.

import type { SpecBlock, FEntry, VEntry, SEntry, CEntry } from '../types/spec'

// ── Detection ────────────────────────────────────────────────────────────────

/**
 * Returns true if the text looks like the output of useSpecExport.serialise().
 * Used by the import handler to decide whether to route to the spec parser
 * instead of dumping raw text into the classifier.
 */
export function looksLikeSpec(text: string): boolean {
  return /^#{1,4}\s+[FVSC]\./m.test(text)
}

// ── Parser ───────────────────────────────────────────────────────────────────

/**
 * Parse the Markdown spec format produced by useSpecExport.serialise() into
 * a SpecBlock. Returns null if the text cannot be parsed.
 *
 * The format is:
 *   #### F.SomeId
 *   Type: Function
 *   Level: Product
 *   Description: ...
 *   Presence-Test: ...       ← new (DD-004); also handles old Success-Criteria:
 *   Function of Value: V.Id
 *
 *   #### V.SomeId
 *   Type: Value
 *   ...
 *
 *   #### S.SomeId
 *   Type: Solution
 *   ...
 */
export function parseMarkdownSpec(text: string): SpecBlock | null {
  const functions: FEntry[] = []
  const values: VEntry[] = []
  const solutions: SEntry[] = []
  const constraints: CEntry[] = []

  // Split on #### headings that start an F./V./S./C. entry.
  // Non-spec #### headings (plain prose, section titles) are ignored below.
  const blocks = text.split(/\n(?=#{1,4}\s+[FVSC]\.)/)

  for (const block of blocks) {
    const lines = block.trim().split('\n')
    if (!lines.length) continue

    // First line: #### F.SomeId  or  ## C.SomeId etc.
    const headingMatch = lines[0].match(/^#{1,4}\s+([FVSC]\.[A-Za-z0-9_.]+)/)
    if (!headingMatch) continue

    const id = headingMatch[1]
    const prefix = id[0] // F / V / S / C

    // Parse remaining lines as "Key: Value" pairs (greedy — value may contain ": ")
    const fields: Record<string, string> = {}
    for (let i = 1; i < lines.length; i++) {
      const colonAt = lines[i].indexOf(':')
      if (colonAt < 1) continue
      const rawKey = lines[i].slice(0, colonAt).trim()
      const val = lines[i].slice(colonAt + 1).trim()
      // Normalise key to camelCase-ish for lookup
      const key = rawKey.toLowerCase().replace(/[\s-]+/g, '-')
      fields[key] = val
    }

    // Skip placeholder entries (missing content markers from the serialiser)
    const isMissing = (v: string) => v.startsWith('<!-- MISSING')

    if (prefix === 'F') {
      const presenceTest = fields['presence-test'] || fields['success-criteria'] || ''
      const entry: FEntry = {
        id,
        type: fields['type'] || 'Function',
        level: fields['level'] || 'Product',
        description: fields['description'] || '',
        presenceTest: isMissing(presenceTest) ? '' : presenceTest,
        functionOfValue: fields['function-of-value'] || fields['functionofvalue'] || '',
      }
      functions.push(entry)

    } else if (prefix === 'V') {
      const entry: VEntry = {
        id,
        type: fields['type'] || 'Value',
        level: fields['level'] || 'Product',
        description: fields['description'] || '',
        scale: isMissing(fields['scale'] || '') ? '' : (fields['scale'] || ''),
        meter: isMissing(fields['meter'] || '') ? '' : (fields['meter'] || ''),
        status: isMissing(fields['status'] || '') ? '' : (fields['status'] || ''),
        tolerable: isMissing(fields['tolerable'] || '') ? '' : (fields['tolerable'] || ''),
        goal: isMissing(fields['goal'] || '') ? '' : (fields['goal'] || ''),
        valueOfFunction: fields['value-of-function'] || fields['valueoffunction'] || '',
      }
      // Optional fields
      if (fields['wish']) entry.wish = fields['wish']
      if (fields['wish-stakeholder'] || fields['wishstakeholder'])
        entry.wishStakeholder = fields['wish-stakeholder'] || fields['wishstakeholder']
      values.push(entry)

    } else if (prefix === 'S') {
      const entry: SEntry = {
        id,
        type: fields['type'] || 'Solution',
        level: fields['level'] || 'Product',
        description: fields['description'] || '',
        impact: isMissing(fields['impact'] || '') ? '' : (fields['impact'] || ''),
        function: fields['function'] || '',
      }
      solutions.push(entry)

    } else if (prefix === 'C') {
      // Legacy import: if a spec file still has `Limit:` (pre-migration format),
      // use its value as the description if description is empty.
      const legacyLimit = isMissing(fields['limit'] || '') ? '' : (fields['limit'] || '')
      const description = fields['description'] || legacyLimit
      const entry: CEntry = {
        id,
        type: fields['type'] || 'Constraint',
        level: fields['level'] || 'Product',
        description: isMissing(description) ? '' : description,
        scope:     isMissing(fields['scope']     || '') ? '' : (fields['scope']     || ''),
        rationale: isMissing(fields['rationale'] || '') ? '' : (fields['rationale'] || ''),
      }
      if (fields['source'] && !isMissing(fields['source'])) entry.source = fields['source']
      constraints.push(entry)
    }
  }

  if (!functions.length && !values.length && !solutions.length && !constraints.length) return null
  return { functions, values, solutions, constraints }
}
