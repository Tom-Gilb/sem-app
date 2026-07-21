/**
 * Deeper diag — measure document/body scroll geometry to find what's
 * actually scrollable.
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
await new Promise(r => setTimeout(r, 1500))

const g = await page.evaluate(() => {
  const h1 = Array.from(document.querySelectorAll('h1')).find(
    el => /Does this look right/i.test(el.textContent || '')
  )
  const ancestors = []
  let el = h1
  while (el && el !== document.body) {
    el = el.parentElement
    if (!el) break
    const cs = getComputedStyle(el)
    if (['auto', 'scroll'].includes(cs.overflowY) || cs.overflowY === 'overlay') {
      ancestors.push({
        tag: el.tagName,
        cls: el.className?.substring(0, 80),
        overflowY: cs.overflowY,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        scrollTop: el.scrollTop,
      })
    }
  }
  return {
    docScrollHeight: document.documentElement.scrollHeight,
    bodyScrollHeight: document.body.scrollHeight,
    docClientHeight: document.documentElement.clientHeight,
    windowInnerHeight: window.innerHeight,
    scrollingElementTag: document.scrollingElement?.tagName,
    scrollingElementScrollTop: document.scrollingElement?.scrollTop,
    scrollingElementScrollHeight: document.scrollingElement?.scrollHeight,
    h1Found: !!h1,
    h1Top: h1?.getBoundingClientRect().top,
    overflowAncestors: ancestors,
  }
})
console.log(JSON.stringify(g, null, 2))
await browser.close()
