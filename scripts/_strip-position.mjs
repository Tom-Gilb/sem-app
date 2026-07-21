import { chromium } from 'playwright'
const browser = await chromium.launch({ headless: true })
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
await page.goto('http://localhost:5173/')
await page.waitForLoadState('networkidle')
await new Promise(r => setTimeout(r, 1500))
const info = await page.evaluate(() => {
  const strip = document.querySelector('[aria-label*="Stage 1 sub-step"]')
  const stripRect = strip ? strip.getBoundingClientRect() : null
  const stageBar = document.querySelector('[aria-label="Planning stages"]')
  const barRect = stageBar ? stageBar.getBoundingClientRect() : null
  const barStyle = stageBar ? window.getComputedStyle(stageBar) : null
  return {
    strip: stripRect ? { top: stripRect.top, bottom: stripRect.bottom, height: stripRect.height, hidden_behind_bar: stripRect.top < (barRect?.bottom ?? 0) } : null,
    stageBar: barRect ? { top: barRect.top, bottom: barRect.bottom, position: barStyle?.position } : null,
    bodyScrollTop: window.scrollY,
    viewportHeight: window.innerHeight,
  }
})
console.log(JSON.stringify(info, null, 2))
await browser.close()
