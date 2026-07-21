import pkg from '../node_modules/playwright/index.js'
const { chromium } = pkg
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`))
page.on('console', m => { if (m.type() === 'error') errors.push(`console.error: ${m.text().slice(0, 600)}`) })
await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(2500)

// Check if SelectionDefiner is mounted
const mounted = await page.evaluate(() => {
  const all = [...document.querySelectorAll('*')]
  return {
    pillCount: all.filter(e => /Illuminate|Define|📖|💡/.test(e.textContent || '') && e.tagName === 'BUTTON').length,
    selectionDefinerPresent: !!document.querySelector('[data-selection-definer], [aria-label*="Define" i], [aria-label*="Illuminate" i]'),
  }
})
console.log('Selection definer mount:', JSON.stringify(mounted, null, 2))

// Try to select text + see if the pill appears
await page.evaluate(() => {
  // Find any text node with content
  const text = document.querySelector('p, span, h1, h2, h3, label')
  if (text) {
    const sel = window.getSelection()
    if (!sel) return
    const range = document.createRange()
    range.selectNodeContents(text)
    sel.removeAllRanges()
    sel.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))
  }
})
await page.waitForTimeout(800)

const afterSelect = await page.evaluate(() => {
  return {
    selection: window.getSelection()?.toString().slice(0, 80) ?? '',
    floatingPills: [...document.querySelectorAll('button')]
      .filter(b => /Illuminate|Define|📖|💡/.test(b.textContent || ''))
      .map(b => ({
        text: (b.textContent || '').slice(0, 60).trim(),
        visible: b.offsetParent !== null,
        z: getComputedStyle(b).zIndex,
      })),
  }
})
console.log('After select:', JSON.stringify(afterSelect, null, 2))

console.log('--- Errors ---')
errors.slice(0, 6).forEach(e => console.log(e))

await browser.close()
