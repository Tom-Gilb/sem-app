import { chromium } from 'playwright'
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
const errs = []
page.on('pageerror', e => errs.push('pageerror: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)) })
await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 20000 })
await page.waitForTimeout(1500)
// Scroll to top so button is visible
await page.evaluate(() => window.scrollTo(0, 0))
await page.waitForTimeout(300)
const urlBefore = page.url()
console.log('URL before click:', urlBefore)
// Click the Refresh button
try {
  await page.locator('button[aria-label^="Refresh —"]').click({ timeout: 3000 })
  console.log('click() did NOT throw')
} catch (e) {
  console.log('click() threw:', e.message)
}
await page.waitForTimeout(1500)
const urlAfter = page.url()
console.log('URL after click:', urlAfter)
console.log('URL changed?', urlBefore !== urlAfter)
console.log('--- console errors ---')
console.log(errs.length ? errs.slice(0, 10).join('\n') : '(none)')
await browser.close()
