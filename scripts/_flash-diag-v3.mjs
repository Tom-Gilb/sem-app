/**
 * Provenance-flash diag v3 — better introspection of the post-parse DOM.
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

// Seed source text and parse
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

// Click Parse
const parseBtn = page.locator('button:has-text("Parse")').first()
await parseBtn.click()
await new Promise(r => setTimeout(r, 1200))

// Enumerate ALL buttons with aria-label starting with "Edit"
const editAria = await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('button[aria-label]'))
    .filter(b => /^Edit (stakeholder|value|mean)/i.test(b.getAttribute('aria-label') || ''))
  return btns.map(b => ({
    aria: b.getAttribute('aria-label'),
    visible: !!(b.offsetParent),
    text: (b.textContent || '').trim().substring(0, 50),
  }))
})
console.log(`Edit-buttons found (${editAria.length}):`)
editAria.slice(0, 12).forEach((b, i) => console.log(`  [${i}] vis=${b.visible} ${b.aria?.substring(0, 70)}`))

// Find the rawInput container
const containerInfo = await page.evaluate(() => {
  // Match: details > div.overflow-y-auto.leading-relaxed
  const c = document.querySelector('div.overflow-y-auto.leading-relaxed')
  if (!c) return { found: false }
  // Find line divs
  const lines = c.querySelectorAll('[data-line-idx]')
  return {
    found: true,
    lineCount: lines.length,
    firstLineText: lines[0]?.textContent?.substring(0, 80),
    yellows: c.querySelectorAll('.bg-yellow-300').length,
  }
})
console.log('CONTAINER:', JSON.stringify(containerInfo))

// Click first chip
if (editAria.length > 0 && editAria[0].visible) {
  const firstAria = editAria[0].aria
  console.log(`\n→ Clicking chip: ${firstAria?.substring(0, 60)}`)
  await page.locator(`button[aria-label="${firstAria.replace(/"/g, '\\"')}"]`).first().click({ force: true }).catch(e => console.log('  click err:', e.message))
  await new Promise(r => setTimeout(r, 500))
  const after = await page.evaluate(() => {
    const yellows = document.querySelectorAll('.bg-yellow-300')
    const cycle = !!Array.from(document.querySelectorAll('button')).find(
      b => /next match/i.test(b.textContent || '')
    )
    // Check details element open state
    const details = document.querySelector('details')
    return {
      yellowCount: yellows.length,
      yellowText: yellows[0]?.textContent?.substring(0, 80) || null,
      cycleStripShown: cycle,
      detailsOpen: details?.hasAttribute('open'),
      // Inspect the live DOM for chip-flash state via DevTools
    }
  })
  console.log('AFTER click:', JSON.stringify(after, null, 2))
}

// Try 2nd and 3rd chips
for (let i = 1; i < Math.min(4, editAria.length); i++) {
  if (!editAria[i].visible) continue
  const aria = editAria[i].aria
  console.log(`\n→ Clicking chip [${i}]: ${aria?.substring(0, 60)}`)
  await page.locator(`button[aria-label="${aria.replace(/"/g, '\\"')}"]`).first().click({ force: true }).catch(e => console.log('  click err:', e.message))
  await new Promise(r => setTimeout(r, 400))
  const after = await page.evaluate(() => ({
    yellowCount: document.querySelectorAll('.bg-yellow-300').length,
    yellowText: document.querySelectorAll('.bg-yellow-300')[0]?.textContent?.substring(0, 80) || null,
  }))
  console.log(`  AFTER click [${i}]:`, JSON.stringify(after))
}

if (errors.length) {
  console.log('\n=== CONSOLE ERRORS ===')
  errors.slice(0, 8).forEach(e => console.log('  •', e.substring(0, 250)))
}

await browser.close()
