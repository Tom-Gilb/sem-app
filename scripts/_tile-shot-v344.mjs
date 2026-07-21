/** Capture the v344 colorful tile grid in spinning state via DOM injection.
 *  We can't easily trigger a real LLM call but we can inject the loading
 *  state by directly setting Vue refs via the dev-test injection hook. */
import { chromium } from 'playwright'
const b = await chromium.launch({ headless: true })
const ctx = await b.newContext({ viewport: { width: 1700, height: 1100 } })
const p = await ctx.newPage()

await p.goto('http://localhost:5173/')
await p.waitForLoadState('networkidle')
await new Promise(r => setTimeout(r, 1500))

// Type input, parse, then click Generate Spec
await p.locator('textarea').first().fill('President of the contractor, Secretary of the Navy | high quality of construction, low cost of materials, completion by 1931 | modular construction, standardized components')
await new Promise(r => setTimeout(r, 300))
await p.locator('button:has-text("Parse my input")').first().click()
await new Promise(r => setTimeout(r, 1500))

// Click Generate
const gen = p.locator('button:has-text("Generate Spec")').first()
if (await gen.count() > 0) {
  await gen.click()
  console.log('clicked Generate Spec — waiting 8s for the loading state to be visible')
  await new Promise(r => setTimeout(r, 8000))
  await p.screenshot({ path: '/tmp/v344-tiles.png', fullPage: false })
  const survey = await p.evaluate(() => {
    const counter = Array.from(document.querySelectorAll('p')).find(el => /Translated to Planguage/i.test(el.textContent || ''))
    const card = counter?.closest('.rounded-xl')
    const tiles = card?.querySelectorAll('.aspect-square')
    return {
      counterMounted: !!counter,
      tileCount: tiles?.length ?? 0,
      tileWidths: Array.from(tiles ?? []).map(t => Math.round(t.getBoundingClientRect().width)).slice(0, 6),
    }
  })
  console.log('SURVEY:', JSON.stringify(survey, null, 2))
} else {
  console.log('Generate Spec button not visible — check input')
}
await b.close()
