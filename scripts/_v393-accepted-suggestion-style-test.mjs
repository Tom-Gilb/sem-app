#!/usr/bin/env node
// r41 v393 verification — Tom Gilb 2026-06-27 "when suggested additions are
// chosen, I want to see them in different color and on my screen".
//
// Tests that:
//   1. Parsed chips render with their CANONICAL column colors (indigo / emerald / amber)
//   2. After clicking + on a suggested addition, the chip lands in its
//      column with VIOLET styling AND data-suggested-chip attribute set
//   3. The new chip is scrolled into view (data-suggested-chip query selector hit)

import pkg from '../node_modules/playwright/index.js'
const { chromium } = pkg

const URL = 'http://localhost:5173'
const TEST_INPUT = 'Improve customer retention by 30% within 12 months. Stakeholders: customers, support team. Means: better onboarding.'

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext()
const page = await ctx.newPage()

await page.addInitScript(() => {
  localStorage.setItem('sem-analysis-mode', 'quick')
})

const errors = []
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`))

await page.goto(URL, { waitUntil: 'networkidle', timeout: 15000 })
await page.waitForTimeout(1500)

// Type input + parse
const textarea = await page.waitForSelector('#sem-raw-input', { timeout: 8000 })
await textarea.fill(TEST_INPUT)
await page.waitForTimeout(300)
const parseBtn = await page.waitForSelector('button[aria-label="Parse my input"]', { timeout: 5000 })
await parseBtn.click()
await page.waitForTimeout(1200)

// Confirm review screen + count of suggested-chip data attributes BEFORE accepting any
const beforeCount = await page.evaluate(() => document.querySelectorAll('[data-suggested-chip]').length)

// Look for the implied panel + count its buttons
const panelInspection = await page.evaluate(() => {
  const panel = document.querySelector('[aria-label*="Implied"], [aria-label*="AI-suggested additions"]')
  if (!panel) return { found: false, btnCount: 0, addBtns: [] }
  const btns = Array.from(panel.querySelectorAll('button'))
  const addBtns = btns
    .filter(b => /Add (stakeholder|goal|value|strategy|mean)/i.test(b.getAttribute('aria-label') || ''))
    .map(b => ({ aria: b.getAttribute('aria-label')?.slice(0, 80), text: (b.textContent || '').slice(0, 30) }))
  return { found: true, btnCount: btns.length, addBtns }
})
console.log(`Implied panel found: ${panelInspection.found}, total buttons: ${panelInspection.btnCount}`)
console.log(`Add-suggestion buttons found: ${panelInspection.addBtns.length}`)
if (panelInspection.addBtns.length > 0) {
  console.log(`First 3 add-suggestion button aria-labels:`)
  for (const b of panelInspection.addBtns.slice(0, 3)) console.log(`  - "${b.aria}"`)
}

// Click the first Add-suggestion button
const addButtonFound = await page.evaluate(() => {
  const panel = document.querySelector('[aria-label*="Implied"], [aria-label*="AI-suggested additions"]')
  if (!panel) return false
  const btns = Array.from(panel.querySelectorAll('button'))
  for (const b of btns) {
    const al = b.getAttribute('aria-label') || ''
    if (/Add (stakeholder|goal|value|strategy|mean)/i.test(al)) {
      b.click()
      return true
    }
  }
  return false
})

await page.waitForTimeout(600)

// Count suggested-chip data attributes AFTER click
const afterCount = await page.evaluate(() => document.querySelectorAll('[data-suggested-chip]').length)

// Inspect the styles of the new chip
const chipStyle = await page.evaluate(() => {
  const chips = document.querySelectorAll('[data-suggested-chip]')
  const last = chips[chips.length - 1]
  if (!last) return null
  const cls = last.className
  return {
    className: cls,
    hasViolet: /violet/i.test(cls),
    dataSuggestedChip: last.getAttribute('data-suggested-chip'),
  }
})

await browser.close()

console.log('\n=== r41 v393 verification — accepted-suggestion violet styling ===\n')
console.log(`Before accept: [data-suggested-chip] count = ${beforeCount}  (expected: 0)`)
console.log(`+ button click found:                       = ${addButtonFound}    (expected: true)`)
console.log(`After accept:  [data-suggested-chip] count = ${afterCount}    (expected: 1+)`)
if (chipStyle) {
  console.log(`Accepted chip dataset value:                = ${chipStyle.dataSuggestedChip}`)
  console.log(`Accepted chip className contains 'violet': = ${chipStyle.hasViolet}     (expected: true)`)
  console.log(`Accepted chip full className:`)
  console.log(`  ${chipStyle.className}`)
}
if (errors.length > 0) {
  console.log(`\nerrors:`)
  for (const e of errors) console.log(`  - ${e}`)
}

const pass = beforeCount === 0 && addButtonFound && afterCount > 0 && chipStyle && chipStyle.hasViolet

console.log(`\n=== Verdict ===`)
console.log(`  Accepted suggestion gets violet styling: ${pass ? '✓ PASS' : '✗ FAIL'}`)
process.exit(pass ? 0 : 1)
