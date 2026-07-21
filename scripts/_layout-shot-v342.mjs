/** Take a screenshot at Tom's likely viewport width to confirm columns aren't cramped. */
import { chromium } from 'playwright'
const b = await chromium.launch({ headless: true })
const ctx = await b.newContext({ viewport: { width: 1900, height: 1100 } })
const p = await ctx.newPage()
await p.goto('http://localhost:5173/')
await p.waitForLoadState('networkidle')
await new Promise(r => setTimeout(r, 1500))
await p.locator('textarea').first().fill('President of the contractor, Secretary of the Navy, the Crew | high quality of construction, low cost of materials, completion by 1931 | modular construction, standardized components, inventory tracking after every voyage')
await new Promise(r => setTimeout(r, 300))
await p.locator('button:has-text("Parse my input")').first().click()
await new Promise(r => setTimeout(r, 2500))
// click a chip to trigger flash
await p.locator('button[aria-label^="Edit strategy: "]').first().click({ force: true })
await new Promise(r => setTimeout(r, 800))
await p.screenshot({ path: '/tmp/v342-layout.png', fullPage: false })
const m = await p.evaluate(() => {
  // Measure column widths
  const sections = Array.from(document.querySelectorAll('section[aria-labelledby^="section-"]'))
  return sections.map(s => ({
    label: s.getAttribute('aria-labelledby'),
    width: Math.round(s.getBoundingClientRect().width),
  }))
})
console.log('section widths:', JSON.stringify(m))
await b.close()
