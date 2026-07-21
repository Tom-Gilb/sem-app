/** Capture the counter tile area at high resolution + force later elapsed
 *  state so we see SPINNING + DONE tiles, not all-PENDING. */
import { chromium } from 'playwright'
const b = await chromium.launch({ headless: true })
const ctx = await b.newContext({ viewport: { width: 1700, height: 1100 } })
const p = await ctx.newPage()
await p.goto('http://localhost:5173/')
await p.waitForLoadState('networkidle')
await new Promise(r => setTimeout(r, 1500))
await p.locator('textarea').first().fill('A | B | C')
await new Promise(r => setTimeout(r, 200))
await p.locator('button:has-text("Parse my input")').first().click()
await new Promise(r => setTimeout(r, 1500))
const gen = p.locator('button:has-text("Generate Spec")').first()
if (await gen.count() === 0) { console.log('no Generate Spec button'); await b.close(); process.exit(0) }
await gen.click({ force: true }).catch(e => console.log('click err:', e.message))
// Wait long enough to see Stakeholders DONE + Values SPINNING (~25s)
console.log('waiting 25s to see SPINNING + DONE states')
await new Promise(r => setTimeout(r, 25000))
// Focus screenshot on counter region
const counter = p.locator('text=Translated to Planguage').locator('..').locator('..')
const box = await counter.boundingBox()
if (box) {
  await p.screenshot({
    path: '/tmp/v345-tiles-closeup.png',
    clip: { x: box.x - 10, y: box.y - 10, width: box.width + 20, height: box.height + 20 },
  })
  console.log('closeup saved:', JSON.stringify(box))
}
await b.close()
