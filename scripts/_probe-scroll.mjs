import { chromium } from 'playwright'
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 20000 })
await page.waitForTimeout(1500)

const probe = await page.evaluate(() => {
  return {
    scrollY: window.scrollY,
    pageHeight: document.documentElement.scrollHeight,
    viewportHeight: window.innerHeight,
    bodyChildren: [...document.body.children].slice(0, 5).map(el => ({ tag: el.tagName.toLowerCase(), id: el.id || '', cls: (el.className || '').toString().slice(0, 80), height: el.getBoundingClientRect().height })),
  }
})
console.log(JSON.stringify(probe, null, 2))

// Scroll to top and re-check
await page.evaluate(() => window.scrollTo(0, 0))
await page.waitForTimeout(500)
const after = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(b => /^Refresh —/.test(b.getAttribute('aria-label') || ''))
  if (!btn) return { found: false }
  const r = btn.getBoundingClientRect()
  return { y: Math.round(r.top), scrollY: window.scrollY }
})
console.log('after scrollTo(0,0):', JSON.stringify(after))
await browser.close()
