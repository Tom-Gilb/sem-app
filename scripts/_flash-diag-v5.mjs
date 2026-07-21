/**
 * Provenance-flash diag v5 — click the right "Parse my input" CTA (not the
 * "Parse as Planguage" modal CTA), then probe chip click → yellow highlight.
 */
import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
const page = await ctx.newPage()
const errors = []
page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
page.on('pageerror', e => errors.push('PAGE_ERROR: ' + e.message))

await page.goto('http://localhost:5173/')
await page.waitForLoadState('networkidle')
await new Promise(r => setTimeout(r, 1500))

const ta = page.locator('textarea').first()
const SOURCE = [
  'The President of the contractor represents the company.',
  'The Secretary of the Navy is the buyer authorizing the agreement.',
  'The goal is to complete construction by 1931 with high quality and low cost.',
  'The solution involves modular construction and standardized components.',
  'The Crew Retention must be included in the inventory after every voyage.',
].join('\n')
await ta.fill(SOURCE)
await new Promise(r => setTimeout(r, 400))

// Click the specific "Parse my input" CTA (matches the SEMEntryForm input-stage button)
const parse = page.locator('button:has-text("Parse my input")').first()
console.log('Parse my input count:', await parse.count())
await parse.click()
await new Promise(r => setTimeout(r, 1200))

await page.screenshot({ path: '/tmp/flash-diag-5-after-parse.png', fullPage: false })

// Survey post-parse
const afterParse = await page.evaluate(() => {
  const editBtns = Array.from(document.querySelectorAll('button[aria-label]'))
    .filter(b => /^Edit (stakeholder|value|mean)/i.test(b.getAttribute('aria-label') || ''))
  return {
    editBtnsCount: editBtns.length,
    sampleEdit: editBtns.slice(0, 8).map(b => b.getAttribute('aria-label')),
    hasOverflowScroll: document.querySelectorAll('div.overflow-y-auto.leading-relaxed').length,
    hasDataLineIdx: document.querySelectorAll('[data-line-idx]').length,
    firstLineText: document.querySelector('[data-line-idx="0"]')?.textContent?.substring(0, 80),
  }
})
console.log('POST-PARSE:', JSON.stringify(afterParse, null, 2))

if (afterParse.editBtnsCount === 0) {
  console.log('Still no chips — bailing.')
  if (errors.length) errors.slice(0,5).forEach(e => console.log('ERR:', e.substring(0, 200)))
  await browser.close()
  process.exit(0)
}

// Click each of first 3 distinct-group chips and report
const groups = ['stakeholder', 'value', 'mean']
for (const grp of groups) {
  const btn = page.locator(`button[aria-label^="Edit ${grp}: "]`).first()
  if (await btn.count() === 0) {
    console.log(`\n[${grp}] no chip in this group`)
    continue
  }
  const aria = await btn.getAttribute('aria-label')
  console.log(`\n→ Clicking [${grp}] chip: ${aria?.substring(0, 70)}`)
  await btn.click({ force: true })
  await new Promise(r => setTimeout(r, 500))
  const state = await page.evaluate(() => {
    const ys = document.querySelectorAll('.bg-yellow-300')
    const cycle = !!Array.from(document.querySelectorAll('button')).find(
      b => /next match/i.test(b.textContent || '')
    )
    return {
      yellowCount: ys.length,
      yellowText: ys[0]?.textContent?.substring(0, 80) || null,
      cycle,
    }
  })
  console.log(`  result:`, JSON.stringify(state))
}

await page.screenshot({ path: '/tmp/flash-diag-5-after-chip.png', fullPage: false })

if (errors.length) {
  console.log('\n=== ERRORS ===')
  errors.slice(0, 5).forEach(e => console.log('  •', e.substring(0, 250)))
}

await browser.close()
