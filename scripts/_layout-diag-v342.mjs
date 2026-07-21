import { chromium } from 'playwright'
const b = await chromium.launch({ headless: true })
const ctx = await b.newContext({ viewport: { width: 1900, height: 1100 } })
const p = await ctx.newPage()
await p.goto('http://localhost:5173/')
await p.waitForLoadState('networkidle')
await new Promise(r => setTimeout(r, 1500))
await p.locator('textarea').first().fill('A | B | C')
await new Promise(r => setTimeout(r, 200))
await p.locator('button:has-text("Parse my input")').first().click()
await new Promise(r => setTimeout(r, 1500))
const w = await p.evaluate(() => {
  // Walk up from the H1 to the body, reporting widths
  const h1 = Array.from(document.querySelectorAll('h1')).find(e => /Does this look right/.test(e.textContent || ''))
  if (!h1) return { error: 'h1 not found' }
  const chain = []
  let el = h1
  let i = 0
  while (el && el !== document.body && i < 15) {
    const w = Math.round(el.getBoundingClientRect().width)
    const cs = getComputedStyle(el)
    chain.push({
      tag: el.tagName,
      cls: el.className?.substring(0, 70),
      width: w,
      maxW: cs.maxWidth,
    })
    el = el.parentElement
    i++
  }
  return chain
})
console.log(JSON.stringify(w, null, 2))
await b.close()
