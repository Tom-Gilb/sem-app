/**
 * Provenance-flash diag v4 — full DOM survey + screenshots at each step.
 */
import { chromium } from 'playwright'
import { writeFileSync } from 'fs'

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
const page = await ctx.newPage()
const errors = []
page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
page.on('pageerror', e => errors.push('PAGE_ERROR: ' + e.message))

await page.goto('http://localhost:5173/')
await page.waitForLoadState('networkidle')
await new Promise(r => setTimeout(r, 1500))

// Initial DOM survey: every visible button + textarea
const initial = await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('button'))
    .filter(b => b.offsetParent)
    .map(b => (b.textContent || '').trim().substring(0, 40))
    .filter(t => t.length > 0)
    .slice(0, 30)
  const tas = Array.from(document.querySelectorAll('textarea'))
    .filter(t => t.offsetParent)
    .map(t => ({ placeholder: t.placeholder?.substring(0, 60), rows: t.rows }))
  return { btns, tas }
})
console.log('INITIAL — buttons:', initial.btns)
console.log('INITIAL — textareas:', initial.tas)

await page.screenshot({ path: '/tmp/flash-diag-1-initial.png', fullPage: false })

// Type into textarea
const ta = page.locator('textarea').first()
const taCount = await ta.count()
console.log('textarea count:', taCount)
if (taCount === 0) {
  console.log('NO TEXTAREA — page state unexpected. Bailing.')
  await browser.close()
  process.exit(1)
}

const SOURCE = [
  'The President of the contractor represents the company.',
  'The Secretary of the Navy is the buyer authorizing the agreement.',
  'The goal is to complete construction by 1931 with high quality and low cost.',
  'The solution involves modular construction and standardized components.',
  'The Crew Retention must be included in the inventory after every voyage.',
].join('\n')
await ta.fill(SOURCE)
await new Promise(r => setTimeout(r, 400))

await page.screenshot({ path: '/tmp/flash-diag-2-typed.png', fullPage: false })

// Survey buttons now
const afterType = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('button'))
    .filter(b => b.offsetParent)
    .map(b => (b.textContent || '').trim().substring(0, 40))
    .filter(t => t.length > 0)
    .slice(0, 30)
})
console.log('AFTER TYPE — buttons:', afterType)

// Try Parse
const parseBtn = page.locator('button:has-text("Parse")').first()
if (await parseBtn.count() > 0) {
  await parseBtn.click()
  console.log('clicked Parse')
} else {
  // try other CTAs
  for (const t of ['Continue', 'Review', 'Next', 'Submit']) {
    const b = page.locator(`button:has-text("${t}")`).first()
    if (await b.count() > 0 && await b.isVisible()) {
      await b.click()
      console.log(`clicked ${t}`)
      break
    }
  }
}
await new Promise(r => setTimeout(r, 1500))
await page.screenshot({ path: '/tmp/flash-diag-3-after-parse.png', fullPage: false })

// Survey again
const afterParse = await page.evaluate(() => {
  const editBtns = Array.from(document.querySelectorAll('button[aria-label]'))
    .filter(b => /^Edit /i.test(b.getAttribute('aria-label') || ''))
    .map(b => b.getAttribute('aria-label'))
  return {
    editBtnsCount: editBtns.length,
    sampleEdit: editBtns.slice(0, 8),
    hasOverflowScroll: document.querySelectorAll('div.overflow-y-auto.leading-relaxed').length,
    hasDataLineIdx: document.querySelectorAll('[data-line-idx]').length,
  }
})
console.log('AFTER PARSE:', JSON.stringify(afterParse, null, 2))

if (afterParse.editBtnsCount > 0) {
  // Click first Edit chip and check yellow
  await page.locator('button[aria-label^="Edit "]').first().click({ force: true })
  await new Promise(r => setTimeout(r, 500))
  await page.screenshot({ path: '/tmp/flash-diag-4-after-chip-click.png', fullPage: false })
  const yellowState = await page.evaluate(() => {
    const ys = document.querySelectorAll('.bg-yellow-300')
    return {
      count: ys.length,
      text: ys[0]?.textContent?.substring(0, 80),
    }
  })
  console.log('YELLOW after chip click:', JSON.stringify(yellowState))
}

if (errors.length) {
  console.log('\n=== CONSOLE ERRORS ===')
  errors.slice(0, 8).forEach(e => console.log('  •', e.substring(0, 250)))
}

await browser.close()
console.log('\nScreenshots: /tmp/flash-diag-{1..4}.png')
