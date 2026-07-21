#!/usr/bin/env node
// r41 v398 verification — Tom Gilb 2026-06-27 "Now the highlighting, which
// worked, is not working for stakes and means, but works for ends".
// Tests whether clicking a parser-extracted chip in each column fires the
// flash (sets flashingChipText / produces yellow .bg-yellow-300 span in
// the rawInput pane).

import pkg from '../node_modules/playwright/index.js'
const { chromium } = pkg

const URL = 'http://localhost:5173'
// Crafted to produce parser-extracted chips in all three columns whose
// texts ARE in the rawInput so substring match should succeed.
const TEST_INPUT = 'The Board approves the project. We need to improve customer retention by 30 percent. The Engineer will deliver better onboarding. The Department oversees compliance. We will reduce cycle time. The team applies new processes.'

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext()
const page = await ctx.newPage()

await page.addInitScript(() => { localStorage.setItem('sem-analysis-mode', 'quick') })

const errors = []
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`))

await page.goto(URL, { waitUntil: 'networkidle', timeout: 15000 })
await page.waitForTimeout(1500)

const textarea = await page.waitForSelector('#sem-raw-input', { timeout: 8000 })
await textarea.fill(TEST_INPUT)
await page.waitForTimeout(300)

const parseBtn = await page.waitForSelector('button[aria-label="Parse my input"]', { timeout: 5000 })
await parseBtn.click()
await page.waitForTimeout(1000)

// Find what chips landed in each column
const columns = await page.evaluate(() => {
  const out = { stakeholders: [], values: [], means: [] }
  const sections = document.querySelectorAll('section[aria-labelledby]')
  for (const sec of sections) {
    const id = sec.getAttribute('aria-labelledby')
    let group = null
    if (/section-who/i.test(id || '')) group = 'stakeholders'
    else if (/section-what/i.test(id || '')) group = 'values'
    else if (/section-how/i.test(id || '')) group = 'means'
    if (!group) continue
    const chipBtns = sec.querySelectorAll('button[aria-label^="Edit"]')
    for (const b of chipBtns) out[group].push((b.textContent || '').trim())
  }
  return out
})
console.log('Parsed chips:')
console.log('  stakeholders:', columns.stakeholders.slice(0, 4))
console.log('  values:      ', columns.values.slice(0, 4))
console.log('  means:       ', columns.means.slice(0, 4))

async function clickAndCheckFlash(group) {
  // Reset by clicking somewhere neutral first (Esc to cancel any edit mode)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  // Click the LONGEST chip in the given column (>=5 chars so the flash logic
  // doesn't early-return on too-short needles)
  const clicked = await page.evaluate((g) => {
    let sectionId
    if (g === 'stakeholders') sectionId = 'section-who'
    else if (g === 'values') sectionId = 'section-what'
    else sectionId = 'section-how'
    const sec = document.querySelector(`section[aria-labelledby="${sectionId}"]`)
    if (!sec) return { found: false }
    const btns = Array.from(sec.querySelectorAll('button[aria-label^="Edit"]'))
    // Sort by text length, longest first
    btns.sort((a, b) => (b.textContent || '').trim().length - (a.textContent || '').trim().length)
    if (btns.length === 0) return { found: false }
    const b = btns[0]
    const text = (b.textContent || '').trim()
    b.click()
    return { found: true, clickedText: text }
  }, group)
  await page.waitForTimeout(400)
  // Check if a yellow flash span exists somewhere in the document
  const flashFound = await page.evaluate(() => {
    const yellow = document.querySelector('.bg-yellow-300')
    return yellow ? { present: true, text: (yellow.textContent || '').slice(0, 60) } : { present: false }
  })
  return { clicked, flashFound }
}

console.log('\n=== Flash test per column ===')
for (const g of ['stakeholders', 'values', 'means']) {
  const r = await clickAndCheckFlash(g)
  console.log(`\n${g}:`)
  console.log(`  Click target: ${r.clicked.found ? `"${r.clicked.clickedText}"` : 'NOT FOUND'}`)
  console.log(`  Flash present (.bg-yellow-300): ${r.flashFound.present}`)
  if (r.flashFound.present) console.log(`  Flash text: "${r.flashFound.text}"`)
}

if (errors.length > 0) {
  console.log('\nerrors:')
  for (const e of errors) console.log('  - ' + e)
}

await browser.close()
