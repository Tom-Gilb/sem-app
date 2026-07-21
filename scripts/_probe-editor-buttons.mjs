import { chromium } from 'playwright'
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
const errs = []
page.on('pageerror', e => errs.push('pageerror: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)) })
await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 20000 })
await page.waitForTimeout(2000)

// Try to find + click Spec Editor button to get into that view
const specEditorBtn = page.locator('button', { hasText: /Spec Editor/i }).first()
const found = await specEditorBtn.count()
console.log('Spec Editor button found:', found)
if (found) {
  await specEditorBtn.click({ force: true }).catch(() => {})
  await page.waitForTimeout(1500)
}

// Dump all visible buttons in the top viewport region (y < 250)
const probe = await page.evaluate(() => {
  const buttons = [...document.querySelectorAll('button')]
  return buttons
    .filter(b => {
      const r = b.getBoundingClientRect()
      return r.top >= 0 && r.top < 280 && r.width > 0 && r.height > 0
    })
    .map(b => {
      const text = (b.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 50)
      const aria = b.getAttribute('aria-label') || ''
      const title = b.getAttribute('title') || ''
      const disabled = b.disabled
      const ariaDisabled = b.getAttribute('aria-disabled')
      const hasOnClick = !!b.onclick
      // Vue 3 uses event listeners via __vueParentComponent, so check if any click listener is attached
      const r = b.getBoundingClientRect()
      return {
        text: text || `[no text · aria="${aria.slice(0, 30)}"]`,
        disabled,
        ariaDisabled,
        hasOnClick,
        title: title.slice(0, 60),
        x: Math.round(r.left), y: Math.round(r.top),
      }
    })
})
console.log(JSON.stringify(probe, null, 2).slice(0, 4000))
console.log('--- Errors ---')
console.log(errs.length ? errs.slice(0, 10).join('\n') : '(none)')
await browser.close()
