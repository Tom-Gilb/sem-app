import { chromium } from 'playwright'
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
// Capture console errors
const errors = []
page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
page.on('pageerror', e => errors.push('PAGE_ERROR: ' + e.message))

await page.goto('http://localhost:5173/')
await page.waitForLoadState('networkidle')
await new Promise(r => setTimeout(r, 1500))

// Seed: paste sample text, parse, wait for review state
await page.evaluate(() => {
  // Inject a tiny rawInput so chips appear without needing the full LLM
  // We'll trigger the input by typing into the textarea
})

// Try to find the textarea
const taSel = 'textarea'
const ta = await page.locator(taSel).first()
const taExists = await ta.count()
console.log('textareas found:', taExists)

if (taExists > 0) {
  await ta.fill('The President of the contractor represents the company. The Secretary of the Navy is the buyer. The goal is to complete construction by 1931 with high quality. The solution involves modular construction.')
  await new Promise(r => setTimeout(r, 500))
  // Click Parse button if visible
  const parseBtn = await page.locator('button:has-text("Parse")').first()
  const hasParse = await parseBtn.count()
  console.log('Parse button found:', hasParse)
}

// Look for the provenance flash refs/script signals
const diag = await page.evaluate(() => {
  const result = {}
  // Find chips
  const chips = document.querySelectorAll('button[aria-label^="Edit stakeholder:"], button[aria-label^="Edit value:"], button[aria-label^="Edit mean:"]')
  result.chipCount = chips.length
  result.firstChipText = chips[0]?.textContent?.trim().substring(0, 60)
  // Find the flash container
  const container = document.querySelector('[ref="rawInputContainerRef"]') ||
                    document.querySelector('div[class*="overflow-y-auto"][class*="leading-relaxed"]')
  result.containerFound = !!container
  // Find yellow highlight spans (when flash is active)
  const highlights = document.querySelectorAll('.bg-yellow-300')
  result.highlightCount = highlights.length
  return result
})
console.log('DIAG before click:', JSON.stringify(diag, null, 2))

// If we have chips, try clicking the first one
if (diag.chipCount > 0) {
  await page.locator('button[aria-label^="Edit stakeholder:"]').first().click()
  await new Promise(r => setTimeout(r, 600))
  const after = await page.evaluate(() => {
    return {
      highlightCount: document.querySelectorAll('.bg-yellow-300').length,
      cycleStripVisible: !!document.querySelector('button:has-text("See next match")'),
    }
  })
  console.log('AFTER first chip click:', JSON.stringify(after, null, 2))

  // Try a SECOND chip click
  await page.locator('button[aria-label^="Edit stakeholder:"]').nth(1).click()
  await new Promise(r => setTimeout(r, 600))
  const after2 = await page.evaluate(() => ({
    highlightCount: document.querySelectorAll('.bg-yellow-300').length,
  }))
  console.log('AFTER second chip click:', JSON.stringify(after2, null, 2))
}

if (errors.length > 0) {
  console.log('=== CONSOLE ERRORS ===')
  errors.slice(0, 10).forEach(e => console.log('  •', e.substring(0, 200)))
}

await browser.close()
