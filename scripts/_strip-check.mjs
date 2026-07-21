import { chromium } from 'playwright'
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext()
const page = await ctx.newPage()
await page.goto('http://localhost:5173/')
await page.waitForLoadState('networkidle')
await new Promise(r => setTimeout(r, 1500))
// Check for Stage 1 strip elements
const stripHTML = await page.evaluate(() => {
  const aria = document.querySelector('[aria-label*="Stage 1 sub-step"]')
  return aria ? {
    found: true,
    visible: aria.offsetHeight > 0 && aria.offsetWidth > 0,
    height: aria.offsetHeight,
    width: aria.offsetWidth,
    parent: aria.parentElement?.tagName + '.' + aria.parentElement?.className?.substring(0,50),
    text: aria.textContent?.substring(0, 200),
  } : { found: false }
})
console.log('Stage1SubStepStrip in DOM:', JSON.stringify(stripHTML, null, 2))
// Also check planningStage
const stageInfo = await page.evaluate(() => {
  // Look for current stage indicator in the planning bar
  const stageTiles = document.querySelectorAll('[aria-label*="Stage" i]')
  return Array.from(stageTiles).slice(0, 3).map(el => ({
    tag: el.tagName,
    aria: el.getAttribute('aria-label')?.substring(0, 80),
    visible: el.offsetHeight > 0,
  }))
})
console.log('Stage-related elements:', JSON.stringify(stageInfo, null, 2))
await browser.close()
