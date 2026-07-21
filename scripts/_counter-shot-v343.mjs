/** Force the loading state and screenshot the two-panel layout. */
import { chromium } from 'playwright'
const b = await chromium.launch({ headless: true })
const ctx = await b.newContext({ viewport: { width: 1600, height: 1100 } })
const p = await ctx.newPage()
await p.goto('http://localhost:5173/')
await p.waitForLoadState('networkidle')
await new Promise(r => setTimeout(r, 1500))

// Type something + click Parse my input (this triggers the Generate path which
// shows the loading state).  We can't easily fake the loading state without
// actually triggering generation, so we just go to the chip review stage and
// inspect.  For real loading-state preview we'd need to mock the SDK.
// Workaround: directly inject loading state via Vue devtools or just check
// the DOM structure exists.
await p.locator('textarea').first().fill('A | B | C')
await new Promise(r => setTimeout(r, 200))
await p.locator('button:has-text("Parse my input")').first().click()
await new Promise(r => setTimeout(r, 1500))

// Click Generate to trigger loading state — this will hit the real LLM but
// we screenshot the loading state in the first few seconds before it
// resolves/fails.
const gen = p.locator('button:has-text("Generate Spec")').first()
if (await gen.count() > 0) {
  await gen.click()
  await new Promise(r => setTimeout(r, 3000)) // capture mid-generation
  await p.screenshot({ path: '/tmp/v343-counter-loading.png', fullPage: false })
  const survey = await p.evaluate(() => {
    const counter = Array.from(document.querySelectorAll('p')).find(el => /Translated to Planguage/i.test(el.textContent || ''))
    const grid = counter?.closest('.grid')
    const cells = grid ? Array.from(grid.children).map(c => Math.round(c.getBoundingClientRect().width)) : []
    return {
      counterFound: !!counter,
      gridCellWidths: cells,
    }
  })
  console.log('SURVEY:', JSON.stringify(survey, null, 2))
} else {
  console.log('No "Generate Spec" button found — skipping loading-state screenshot')
}
await b.close()
