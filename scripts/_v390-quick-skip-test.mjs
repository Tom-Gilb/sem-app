#!/usr/bin/env node
// r41 v392 verification — Tom Gilb 2026-06-27 "it move automatically to
// generating without me getting a chance to add suggested additions".
// v391 wrongly auto-fired submit; v392 REVERTS that.  Both modes show
// the review screen with chips + suggested additions; user clicks
// Generate Spec when ready.  Mode difference (quick vs precise) kicks
// in AFTER Generate Spec in App.vue's doTranslate path.
//
// Expected behaviour after v392:
//   - QUICK mode:   review heading + 4 columns VISIBLE; NO auto-fire;
//                   Generate Spec button shows "Generate Spec" (not
//                   "Generating…"); user clicks when ready.
//   - PRECISE mode: identical to quick — review heading + 4 columns +
//                   Generate Spec button waiting for click.

import pkg from '../node_modules/playwright/index.js'
const { chromium } = pkg

const URL = 'http://localhost:5173'
const TEST_INPUT = 'Improve customer retention by 30% within 12 months. Stakeholders: customers, support team. Means: better onboarding, faster response times.'

async function runOneMode(mode) {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext()
  const page = await ctx.newPage()

  // Set the mode BEFORE app boots
  await page.addInitScript((modeVal) => {
    localStorage.setItem('sem-analysis-mode', modeVal)
  }, mode)

  const errors = []
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`))
  page.on('console', m => {
    if (m.type() === 'error' && !m.text().includes('VITE_ANTHROPIC_API_KEY')) {
      errors.push(`console.error: ${m.text()}`)
    }
  })

  await page.goto(URL, { waitUntil: 'networkidle', timeout: 15000 })
  await page.waitForTimeout(1500)

  // Wait for the textarea to be ready
  const textarea = await page.waitForSelector('#sem-raw-input', { timeout: 8000 })
  await textarea.fill(TEST_INPUT)
  await page.waitForTimeout(300)

  // Find and click "Parse my input"
  const parseBtn = await page.waitForSelector('button[aria-label="Parse my input"]', { timeout: 5000 })
  await parseBtn.click()

  // Wait a moment for any stage transition to settle
  await page.waitForTimeout(800)

  // Check what's on screen now
  const hasReviewHeading = await page.evaluate(() => {
    return !!document.body.innerText.match(/Does this look right/i)
  })
  // r41 v391 — "Generating…" state visible when handleSubmit has fired
  const hasGeneratingButton = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'))
    return btns.some(b => /Generating/i.test(b.textContent || ''))
  })
  const hasReviewButton = await page.evaluate(() => {
    return !!document.querySelector('button[aria-label*="Generate Spec"]')
  })
  // r41 v391 — 4-column visibility check (Tom's actual concern)
  const hasFourColumns = await page.evaluate(() => {
    const txt = document.body.innerText
    const stakeholderLabel = /STAKEHOLDERS|NEEDS RESULTS/i.test(txt)
    const valuesLabel      = /GOALS.*VALUES|HOW WELL/i.test(txt)
    const meansLabel       = /STRATEGIES.*MEANS|^HOW —/im.test(txt)
    return stakeholderLabel && valuesLabel && meansLabel
  })

  await browser.close()
  return { mode, hasReviewHeading, hasGeneratingButton, hasReviewButton, hasFourColumns, errors }
}

console.log('\n=== r41 v392 verification — review screen + NO auto-fire ===\n')

const quickResult = await runOneMode('quick')
console.log(`MODE: quick (Analyze As Is)`)
console.log(`  hasReviewHeading ("Does this look right?"): ${quickResult.hasReviewHeading}    (expected: true)`)
console.log(`  hasFourColumns (Stake/Values/Means labels):  ${quickResult.hasFourColumns}     (expected: true)`)
console.log(`  hasGeneratingButton ("Generating…" text):     ${quickResult.hasGeneratingButton}  (expected: false — waiting for user click)`)
console.log(`  hasReviewButton (Generate Spec mounts):       ${quickResult.hasReviewButton}     (expected: true)`)
if (quickResult.errors.length > 0) {
  console.log(`  errors:`)
  for (const e of quickResult.errors.slice(0, 5)) console.log(`    - ${e}`)
}

const preciseResult = await runOneMode('precise')
console.log(`\nMODE: precise (Answer Some Questions)`)
console.log(`  hasReviewHeading ("Does this look right?"): ${preciseResult.hasReviewHeading}    (expected: true)`)
console.log(`  hasFourColumns (Stake/Values/Means labels):  ${preciseResult.hasFourColumns}     (expected: true)`)
console.log(`  hasGeneratingButton ("Generating…" text):     ${preciseResult.hasGeneratingButton}  (expected: false)`)
console.log(`  hasReviewButton (Generate Spec mounts):       ${preciseResult.hasReviewButton}     (expected: true)`)
if (preciseResult.errors.length > 0) {
  console.log(`  errors:`)
  for (const e of preciseResult.errors.slice(0, 5)) console.log(`    - ${e}`)
}

// Verdict — both modes should look IDENTICAL on the review screen.  Mode
// difference (clarifying questions vs not) kicks in AFTER Generate Spec.
const quickPass   = quickResult.hasReviewHeading && quickResult.hasFourColumns && !quickResult.hasGeneratingButton
const precisePass = preciseResult.hasReviewHeading && preciseResult.hasFourColumns && !preciseResult.hasGeneratingButton

console.log(`\n=== Verdict ===`)
console.log(`  Quick mode (review visible + NOT auto-fired):  ${quickPass   ? '✓ PASS' : '✗ FAIL'}`)
console.log(`  Precise mode (review visible + waiting):       ${precisePass ? '✓ PASS' : '✗ FAIL'}`)

process.exit(quickPass && precisePass ? 0 : 1)
