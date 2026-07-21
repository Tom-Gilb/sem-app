import { chromium } from 'playwright'
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
const errs = []
page.on('pageerror', e => errs.push('pageerror: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)) })
await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 20000 })
await page.waitForTimeout(1500)
await page.evaluate(() => window.scrollTo(0, 0))
await page.waitForTimeout(300)
const before = await page.evaluate(() => !!document.querySelector('[role="dialog"][aria-label*="Settings" i]'))
console.log('Settings dialog visible BEFORE click?', before)
try {
  await page.locator('button[aria-label="Open SEM Settings panel (Cmd+,)"]').click({ timeout: 3000 })
  console.log('click did NOT throw')
} catch (e) { console.log('click threw:', e.message.slice(0, 200)) }
await page.waitForTimeout(800)
const after = await page.evaluate(() => !!document.querySelector('[role="dialog"][aria-label*="Settings" i], .settings-panel, [aria-label*="settings" i]'))
console.log('Settings dialog visible AFTER click?', after)
console.log('--- errors ---'); console.log(errs.length ? errs.slice(0, 5).join('\n') : '(none)')
await browser.close()
