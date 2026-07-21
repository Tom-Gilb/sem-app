import pkg from '../node_modules/playwright/index.js'
const { chromium } = pkg
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', e => errors.push({ msg: e.message, stack: (e.stack || '').slice(0, 3000) }))
page.on('console', m => { if (m.type() === 'error') errors.push({ msg: 'console.error: ' + m.text().slice(0, 2000) }) })
await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(3500)

const banner = await page.evaluate(() => {
  const el = [...document.querySelectorAll('h2,p,pre')]
    .find(e => /SEM App failed|createApp.*mount failed/i.test(e.textContent || ''))
  if (el) return (el.parentElement?.textContent || el.textContent || '').slice(0, 3000)
  return null
})
console.log('=== BANNER ===')
console.log(banner)
console.log('=== ERRORS ===')
for (const e of errors.slice(0, 10)) {
  console.log('---')
  console.log(e.msg)
  if (e.stack) console.log(e.stack)
}
await browser.close()
