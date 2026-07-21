/**
 * Provenance-flash diagnostic v2 — seeds Tom-shaped state directly into the
 * SEMEntryForm via the same code path the live app uses (typing into the
 * textarea), waits for parse to populate chips, then clicks each chip type
 * (stakeholder, value, mean) and reads back DOM state of the source pane.
 *
 * Goal: confirm whether `flashingChipText` / `flashMatch` actually wires the
 * yellow `.bg-yellow-300` span into the source pane after a chip click.
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

// Find the FIRST textarea (raw input) and type a Tom-shaped 3-line source.
// Use literal contract-like phrasing so substring matches CAN fire.
const ta = page.locator('textarea').first()
await ta.waitFor({ state: 'visible', timeout: 5000 })
const SOURCE = [
  'The President of the contractor represents the company.',
  'The Secretary of the Navy is the buyer authorizing the agreement.',
  'The goal is to complete construction by 1931 with high quality and low cost.',
  'The solution involves modular construction and standardized components.',
  'The Crew Retention must be included in the inventory after every voyage.',
].join('\n')
await ta.fill(SOURCE)
await new Promise(r => setTimeout(r, 300))

// Click any "Parse" / "Continue" / "Review" button to advance to review stage.
// Try several candidate selectors.
const candidates = [
  'button:has-text("Parse")',
  'button:has-text("Continue")',
  'button:has-text("Review")',
  'button:has-text("Next")',
  'button:has-text("Generate")',
]
let clickedBtn = null
for (const sel of candidates) {
  const c = page.locator(sel).first()
  if (await c.count() > 0 && await c.isVisible()) {
    clickedBtn = sel
    await c.click()
    break
  }
}
console.log('clicked button:', clickedBtn)
await new Promise(r => setTimeout(r, 1500))

// Survey DOM
const survey = await page.evaluate(() => {
  const chipsByAria = {}
  for (const sel of ['stakeholder', 'value', 'mean']) {
    chipsByAria[sel] = document.querySelectorAll(`button[aria-label^="Edit ${sel}"]`).length
  }
  // also enumerate all buttons containing chip-shaped text
  const allBtns = Array.from(document.querySelectorAll('button')).slice(0, 80)
  const btnAriaLabels = allBtns
    .map(b => b.getAttribute('aria-label'))
    .filter(Boolean)
    .filter(s => s.startsWith('Edit '))
  return {
    chipsByAria,
    sampleBtnAriaLabels: btnAriaLabels.slice(0, 20),
    rawInputContainer: !!document.querySelector('div.overflow-y-auto.leading-relaxed'),
    yellowCount: document.querySelectorAll('.bg-yellow-300').length,
    formStage: document.querySelector('[data-form-substage]')?.getAttribute('data-form-substage') || 'unknown',
  }
})
console.log('SURVEY:', JSON.stringify(survey, null, 2))

// Try every "Edit ..." button and report
const editBtns = await page.locator('button[aria-label^="Edit "]').all()
console.log('Found', editBtns.length, '"Edit " buttons total')

for (let i = 0; i < Math.min(editBtns.length, 6); i++) {
  const aria = await editBtns[i].getAttribute('aria-label')
  await editBtns[i].click({ force: true }).catch(e => console.log('click err:', e.message))
  await new Promise(r => setTimeout(r, 400))
  const state = await page.evaluate(() => {
    const yellows = document.querySelectorAll('.bg-yellow-300')
    const cycleStrip = !!Array.from(document.querySelectorAll('button')).find(
      b => /next match/i.test(b.textContent || '')
    )
    return {
      yellowCount: yellows.length,
      yellowSampleText: yellows[0]?.textContent?.substring(0, 80) || null,
      cycleStrip,
    }
  })
  console.log(`AFTER click #${i} (${aria?.substring(0, 60)}):`, JSON.stringify(state))
}

if (errors.length) {
  console.log('=== CONSOLE ERRORS ===')
  errors.slice(0, 8).forEach(e => console.log('  •', e.substring(0, 250)))
}

await browser.close()
