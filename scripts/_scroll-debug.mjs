import { chromium } from 'playwright'
const b = await chromium.launch({ headless: true })
const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 } })
const p = await ctx.newPage()
const logs = []
p.on('console', m => logs.push(m.type() + ': ' + m.text()))
p.on('pageerror', e => logs.push('PAGEERR: ' + e.message))
await p.goto('http://localhost:5173/')
await p.waitForLoadState('networkidle')
await new Promise(r => setTimeout(r, 1500))
await p.locator('textarea').first().fill('President | high quality, low cost | modular construction')
await new Promise(r => setTimeout(r, 300))
await p.locator('button:has-text("Parse my input")').first().click()
await new Promise(r => setTimeout(r, 2500))
const after = await p.evaluate(() => ({
  scrollY: window.scrollY,
  h1Top: Array.from(document.querySelectorAll('h1')).find(e => /Does this look right/.test(e.textContent || ''))?.getBoundingClientRect().top,
}))
console.log('AFTER:', JSON.stringify(after))
logs.filter(l => l.includes('parseInput') || l.includes('PAGEERR') || l.includes('error')).forEach(l => console.log(l.substring(0, 200)))
await b.close()
