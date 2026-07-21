import pkg from '../node_modules/playwright/index.js'
const { chromium } = pkg
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', e => errors.push({ msg: e.message, stack: (e.stack || '').slice(0, 1000) }))
page.on('console', m => { if (m.type() === 'error') errors.push({ msg: 'console.error: ' + m.text().slice(0, 800) }) })
await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(2500)

// Find the Munger pin and click it
const beforeClick = await page.evaluate(() => {
  const buttons = [...document.querySelectorAll('button')].filter(b => /Munger/i.test(b.textContent || ''))
  return { count: buttons.length, titles: buttons.map(b => (b.title || b.getAttribute('aria-label') || b.textContent || '').slice(0, 80)) }
})
console.log('Munger buttons found:', JSON.stringify(beforeClick, null, 2))

if (beforeClick.count > 0) {
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(b => /^Munger$/.test((b.textContent || '').trim()))
    if (btn) btn.click()
    return !!btn
  })
  await page.waitForTimeout(1200)
  const afterClick = await page.evaluate(() => {
    return {
      modePickerVisible: !!document.querySelector('[aria-label*="Mode" i], [role="dialog"]'),
      bodyText: document.body.textContent?.includes('Choose how you want Munger') || document.body.textContent?.includes('Principles') || document.body.textContent?.includes('Analysis') || false,
      visibleDialogTitles: [...document.querySelectorAll('h1,h2,h3')].map(h => (h.textContent || '').trim()).filter(t => /munger|mode/i.test(t)).slice(0, 5),
    }
  })
  console.log('After click:', JSON.stringify(afterClick, null, 2))
}

console.log('=== Errors ===')
for (const e of errors.slice(0, 8)) {
  console.log('---')
  console.log(e.msg)
}
await browser.close()
