/**
 * v341 verification — type input, parse, then measure where the "Does this
 * look right?" H1 lands relative to the viewport.  Should be at y ≈ 180
 * (under the fixed chrome), NOT at y ≈ 0 (hidden under chrome) and NOT
 * at y > 300 (below the fold).
 */
import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
const page = await ctx.newPage()

await page.goto('http://localhost:5173/')
await page.waitForLoadState('networkidle')
await new Promise(r => setTimeout(r, 1500))

const ta = page.locator('textarea').first()
await ta.fill('President | high quality, low cost | modular construction, inventory tracking')
await new Promise(r => setTimeout(r, 300))
await page.locator('button:has-text("Parse my input")').first().click()

// Wait for the smooth scroll to complete (≈ 600ms)
await new Promise(r => setTimeout(r, 1500))

// Measure where the H1 lives in viewport coordinates
const m = await page.evaluate(() => {
  const h1 = Array.from(document.querySelectorAll('h1')).find(
    el => /Does this look right/i.test(el.textContent || '')
  )
  if (!h1) return { found: false }
  const box = h1.getBoundingClientRect()
  return {
    found: true,
    text: h1.textContent?.trim(),
    viewportTop: Math.round(box.top),
    viewportBottom: Math.round(box.bottom),
    scrollY: Math.round(window.scrollY),
    viewportHeight: window.innerHeight,
  }
})
console.log('H1 position after parse:', JSON.stringify(m, null, 2))

if (!m.found) {
  console.log('✗ H1 not found in DOM')
  process.exit(1)
}

if (m.viewportTop < 100) {
  console.log(`✗ H1 too close to viewport top (${m.viewportTop}px) — would be under fixed chrome`)
  process.exit(1)
}
if (m.viewportTop > 300) {
  console.log(`✗ H1 too far from viewport top (${m.viewportTop}px) — Tom would have to scroll down`)
  process.exit(1)
}
console.log(`✓ H1 at viewport y=${m.viewportTop}px — below chrome, above fold`)

await page.screenshot({ path: '/tmp/v341-scroll-check.png' })
await browser.close()
