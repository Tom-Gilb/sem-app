#!/usr/bin/env node
// scripts/recover-from-eml.mjs — r41 v454 (Tom Gilb 2026-07-02).
//
// Recover a v440-shape Backup JSON from a SEM App Planguage-Analysis .eml
// export.  The .eml is a multipart/alternative message; the text/html part
// carries a single <table> where every <tr> is one Planguage entry with
// four <td>s: (1) Type + Tag chip, (2) Party, (3) Obligation + typed
// sub-fields, (4) Ambiguity / defect note.  This script reconstructs a
// ContractModel with all recovered entries in ONE clause called
// "Recovered from .eml — original clause boundaries lost" so Tom can
// re-import via the v452 Import Backup JSON button and get his work back
// on screen while the underlying clause boundaries can be re-established
// later by hand or by re-running Parse against the raw source text.
//
// Usage:
//   node scripts/recover-from-eml.mjs <input.eml> <output.json>

import fs from 'node:fs'
import crypto from 'node:crypto'

const uuid = () => crypto.randomUUID()

if (process.argv.length < 4) {
  console.error('Usage: node scripts/recover-from-eml.mjs <input.eml> <output.json>')
  process.exit(2)
}

const inputPath  = process.argv[2]
const outputPath = process.argv[3]

const raw = fs.readFileSync(inputPath, 'utf8')

// ── Extract the text/html section from the multipart/alternative body ─────
const boundaryMatch = raw.match(/boundary="([^"]+)"/)
if (!boundaryMatch) { console.error('No MIME boundary found'); process.exit(1) }
const boundary = boundaryMatch[1]
const parts = raw.split('--' + boundary)
const htmlPart = parts.find(p => /Content-Type:\s*text\/html/i.test(p))
if (!htmlPart) { console.error('No text/html part found'); process.exit(1) }
const bodyStart = htmlPart.search(/<!DOCTYPE|<html/i)
const html = bodyStart >= 0 ? htmlPart.slice(bodyStart) : htmlPart

// ── Extract the contract title from the <h1> ──────────────────────────────
const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
const contractTitle = titleMatch ? decodeEntities(stripTags(titleMatch[1])).trim() : 'Recovered Contract'

// ── Extract every entry row ───────────────────────────────────────────────
// Every entry row is <tr style="border-bottom:...vertical-align:top;">
// with 4 <td>s.
const rowRe = /<tr[^>]*border-bottom[^>]*>([\s\S]*?)<\/tr>/g
const rows = []
for (const m of html.matchAll(rowRe)) rows.push(m[1])

const TYPE_MAP = {
  'F':    'F',    'Function':    'F',
  'V':    'V',    'Value':       'V',
  'S':    'S',    'Stakeholder': 'S',
  'C':    'C',    'Constraint':  'C',
  'R':    'R',    'Resource':    'R',
  'Sol':  'Sol',  'Solution':    'Sol',
  'Task': 'Task', 'Task':        'Task',
}

const entries = []
let idx = 0
for (const rowHtml of rows) {
  const tds = extractTds(rowHtml)
  if (tds.length < 4) continue

  // (1) Type + Tag: "<span ...>S. Stakeholder</span> <span ...>New York Shipbuilding</span>"
  const typeMatch = tds[0].match(/>([A-Za-z]+)\.\s+(?:Function|Value|Stakeholder|Constraint|Resource|Solution|Task)</)
  if (!typeMatch) continue
  const rawType = typeMatch[1]
  const type = TYPE_MAP[rawType] ?? null
  if (!type) continue
  const tagMatch = tds[0].match(/monospace[^>]*>([\s\S]*?)<\/span>/)
  const tag = tagMatch ? decodeEntities(stripTags(tagMatch[1])).trim() : ''

  // (2) Party
  const party = decodeEntities(stripTags(tds[1])).trim()

  // (3) Obligation + typed sub-fields.  Description = first <div style="font-weight:600">.
  const descMatch = tds[2].match(/<div style="font-weight:600">([\s\S]*?)<\/div>/)
  const description = descMatch ? decodeEntities(stripTags(descMatch[1])).trim() : decodeEntities(stripTags(tds[2])).trim()

  // Typed sub-fields: Presence / Constraint / Scale / Meter / Wish / Goal /
  // Tolerable / Past / Status / Deadline — rendered as separate <div
  // style="margin-top:4px...">'s with a <span text-transform:uppercase>KEY:</span>
  // followed by a <span>VALUE</span>.  Note: the value span may itself
  // wrap nested tags; use non-greedy match up to </div>.
  const subFields = {}
  const subDivRe = /<div[^>]*margin-top:4px[^>]*>\s*<span[^>]*text-transform:uppercase[^>]*>([^<]+):<\/span>\s*<span[^>]*>([\s\S]*?)<\/span>\s*<\/div>/g
  for (const sm of tds[2].matchAll(subDivRe)) {
    const key = sm[1].trim()
    const val = decodeEntities(stripTags(sm[2])).trim()
    subFields[key] = val
  }

  // (4) Ambiguity
  const ambiguity = decodeEntities(stripTags(tds[3])).trim()

  idx++
  const entry = {
    id:            uuid(),
    clauseRef:     '',            // populated below
    type,
    tag:           tag || `${type}.${idx}`,
    description,
    obligatedParty: party || undefined,
    rawSource:     '',
    confidence:    'medium',
    isAmbiguous:   Boolean(ambiguity),
    ambiguityNote: ambiguity || undefined,
    llmGenerated:  true,
    source:        `Recovered from .eml · ${contractTitle} · 2026-07-02`,
    sourceType:    'system',
  }
  // Copy typed sub-fields into the entry.  Note the actual HTML uses
  // "Presence test:" (not "Presence:"); handle both spellings.
  if (subFields.Scale)     entry.scale     = subFields.Scale
  if (subFields.Meter)     entry.meter     = subFields.Meter
  if (subFields.Past)      entry.past      = subFields.Past
  if (subFields.Status)    entry.status    = subFields.Status
  if (subFields.Wish)      entry.wish      = subFields.Wish
  if (subFields.Goal)      entry.goal      = subFields.Goal
  if (subFields.Tolerable) entry.tolerable = subFields.Tolerable
  if (subFields.Constraint) entry.constraintText = subFields.Constraint
  const presenceVal = subFields['Presence test'] ?? subFields.Presence
  if (presenceVal) entry.presenceTest = presenceVal
  if (subFields.Deadline)   entry.deadline       = subFields.Deadline

  entries.push(entry)
}

// ── Build one clause containing all recovered entries ─────────────────────
const clauseId = uuid()
for (const e of entries) e.clauseRef = clauseId

const clause = {
  id:            clauseId,
  number:        'Preamble',
  heading:       'Recovered from .eml — original clause boundaries lost',
  rawText:       'This clause is a container for all Planguage entries recovered from the ' +
                 contractTitle + ' Planguage Analysis .eml export.  ' +
                 'The original clause structure was not preserved in the export; every entry ' +
                 'is here so it can be worked with.  Re-split into real clauses at your leisure.',
  entries,
  parseStatus:   'done',
  lastParsedAt:  new Date().toISOString(),
}

// ── Build the ContractModel ───────────────────────────────────────────────
const contract = {
  id:              uuid(),
  title:           contractTitle + ' (recovered from .eml)',
  contractType:    'other',
  parties:         [],
  clauses:         [clause],
  parseStatus:     'complete',
  entryCounters:   {
    F:    entries.filter(e => e.type === 'F').length,
    V:    entries.filter(e => e.type === 'V').length,
    C:    entries.filter(e => e.type === 'C').length,
    R:    entries.filter(e => e.type === 'R').length,
    Sol:  entries.filter(e => e.type === 'Sol').length,
    S:    entries.filter(e => e.type === 'S').length,
    Task: entries.filter(e => e.type === 'Task').length,
  },
  createdAt:       new Date().toISOString(),
  updatedAt:       new Date().toISOString(),
  schemaVersion:   1,
}

// ── Wrap in v440 Backup JSON envelope ─────────────────────────────────────
const payload = {
  exportedAt:  new Date().toISOString(),
  exportKind:  'sem-app-single-contract-backup',
  appVersion:  'r41 v454 (eml-recovery)',
  contract,
  summary: {
    title:               contract.title,
    contractType:        contract.contractType,
    clauseCount:         contract.clauses.length,
    entryCount:          entries.length,
    entryTypeBreakdown:  {
      Function:    contract.entryCounters.F,
      Value:       contract.entryCounters.V,
      Constraint:  contract.entryCounters.C,
      Resource:    contract.entryCounters.R,
      Solution:    contract.entryCounters.Sol,
      Stakeholder: contract.entryCounters.S,
      Task:        contract.entryCounters.Task,
    },
    parseStatus:         'complete',
    rawImportTextLength: 0,
  },
}

fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2))
console.log(`✓ Recovered ${entries.length} entries from ${inputPath}`)
console.log(`  Breakdown: F=${contract.entryCounters.F} · V=${contract.entryCounters.V} · S=${contract.entryCounters.S} · C=${contract.entryCounters.C} · R=${contract.entryCounters.R} · Sol=${contract.entryCounters.Sol} · Task=${contract.entryCounters.Task}`)
console.log(`  Wrote ${outputPath}`)

// ── Helpers ───────────────────────────────────────────────────────────────
function extractTds(rowHtml) {
  const tds = []
  const re = /<td[^>]*>([\s\S]*?)<\/td>/g
  for (const m of rowHtml.matchAll(re)) tds.push(m[1])
  return tds
}
function stripTags(s) {
  return String(s).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ')
}
function decodeEntities(s) {
  return String(s)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
}
