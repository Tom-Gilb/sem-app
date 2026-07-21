import { chromium } from 'playwright'
const b = await chromium.launch({ headless: true })
const ctx = await b.newContext({ viewport: { width: 1700, height: 1000 } })
const p = await ctx.newPage()
await p.goto('http://localhost:5173/')
await p.waitForLoadState('networkidle')
await new Promise(r => setTimeout(r, 1500))

// Open Spec Editor (where the embedded PlanningStageBar surfaces)
const editor = p.locator('button:has-text("Spec Editor")').first()
if (await editor.count() > 0) {
  await editor.click({ force: true })
  await new Promise(r => setTimeout(r, 1200))
}
await p.screenshot({ path: '/tmp/v350-stage-bar.png', fullPage: false })
const survey = await p.evaluate(() => {
  const bar = document.querySelector('[aria-label="Planning workflow stages"]')
  const tiles = bar?.querySelectorAll('button[aria-label^="Stage "]')
  const sizes = Array.from(tiles ?? []).slice(0, 3).map(t => {
    const r = t.getBoundingClientRect()
    return { w: Math.round(r.width), h: Math.round(r.height) }
  })
  // Find the first Pl*Icon SVG inside the first tile
  const firstIcon = tiles?.[0]?.querySelector('svg[aria-label*="glyph"]')
  const iconBox = firstIcon?.getBoundingClientRect()
  return {
    barFound: !!bar,
    tileCount: tiles?.length ?? 0,
    tileSizes: sizes,
    firstIconWidth: iconBox ? Math.round(iconBox.width) : null,
    firstIconHeight: iconBox ? Math.round(iconBox.height) : null,
  }
})
console.log(JSON.stringify(survey, null, 2))
await b.close()
