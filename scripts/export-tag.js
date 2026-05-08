#!/usr/bin/env node
/**
 * export-tag.js — Filter CHANGELOG.md by tag and print matching entries.
 *
 * Usage:
 *   node scripts/export-tag.js <tag>          → Markdown output
 *   node scripts/export-tag.js <tag> --sem    → Stakes/Ends/Means triples (paste into SEM App)
 *   node scripts/export-tag.js --list         → List all tags found in the changelog
 *
 * Via npm:
 *   npm run export-tag -- voice-ux
 *   npm run export-tag -- exportable --sem
 *   npm run export-tag -- --list
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CHANGELOG = join(__dirname, '..', 'CHANGELOG.md')
const raw       = readFileSync(CHANGELOG, 'utf8')
const args      = process.argv.slice(2)

// ── --list mode ───────────────────────────────────────────────────────────────
if (args.includes('--list')) {
  const tagRe = /#([a-z][a-z0-9-]+)/g
  const found = new Set()
  let m
  while ((m = tagRe.exec(raw)) !== null) found.add(m[1])
  const tags = [...found].filter(t => isNaN(Number(t))).sort()
  console.log('\nTags found in CHANGELOG.md:\n')
  tags.forEach(t => console.log(`  #${t}`))
  console.log()
  process.exit(0)
}

// ── Normal / --sem mode ───────────────────────────────────────────────────────
const semMode = args.includes('--sem')
const rawTag  = args.find(a => !a.startsWith('--'))

if (!rawTag) {
  console.error('Usage: node scripts/export-tag.js <tag> [--sem] | --list')
  process.exit(1)
}

const tag = rawTag.startsWith('#') ? rawTag.slice(1) : rawTag

// Split changelog into sections at ### headings
const sections = []
const lines    = raw.split('\n')
let current    = null

for (const line of lines) {
  if (/^#{1,3} /.test(line)) {
    if (current) sections.push(current)
    current = { heading: line, body: [] }
  } else if (current) {
    current.body.push(line)
  }
}
if (current) sections.push(current)

// Filter sections containing the tag
const tagPattern = new RegExp(`#${tag}\\b`)
const matches    = sections.filter(s =>
  tagPattern.test(s.heading) || tagPattern.test(s.body.join('\n'))
)

if (matches.length === 0) {
  console.log(`\nNo entries found with tag #${tag}\n`)
  process.exit(0)
}

// ── Output ────────────────────────────────────────────────────────────────────

if (!semMode) {
  console.log(`\n# CHANGELOG export — #${tag}\n`)
  console.log(`Source: CHANGELOG.md  |  Tag: #${tag}  |  ${matches.length} entries\n`)
  console.log('---\n')
  matches.forEach(s => {
    console.log(s.heading)
    console.log(s.body.join('\n'))
    console.log()
  })
} else {
  console.log(`\n# SEM triples — #${tag}\n`)
  console.log(`Source: CHANGELOG.md  |  Tag: #${tag}  |  ${matches.length} entries\n`)
  console.log('Paste each triple into SEM App → Parse my input → Generate Planguage Spec\n')
  console.log('---\n')

  matches.forEach((s, i) => {
    const bodyText = s.body.join('\n')
    const semLine  = bodyText.match(/\*\*SEM:\*\*\s*(.+?)(?=\n|$)/)
    const title    = s.heading.replace(/^#+\s*/, '').replace(/`[^`]+`/g, '').split('(')[0].trim()

    console.log(`## Entry ${i + 1}: ${title}\n`)

    if (semLine) {
      console.log(semLine[1].trim())
    } else {
      const problemM = bodyText.match(/\*\*Problem[^:]*:\*\*\s*([^\n]+)/)
      const fixM     = bodyText.match(/\*\*(?:Fix|Change|Request):\*\*\s*([^\n]+)/)
      console.log(`Stakes: Users and developers of SEM App`)
      console.log(`Ends: ${problemM ? problemM[1].trim() : `Improve: ${title}`}`)
      console.log(`Means: ${fixM    ? fixM[1].trim()    : title}`)
    }
    console.log('\n---\n')
  })
}
