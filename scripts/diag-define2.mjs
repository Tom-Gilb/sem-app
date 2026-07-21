import pkg from '../node_modules/playwright/index.js'
const { chromium } = pkg
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`))
page.on('console', m => { if (m.type() === 'error') errors.push(`console.error: ${m.text().slice(0, 400)}`) })
await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 30000 })

// Seed Tom-shaped session
await page.evaluate(() => {
  const spec = {
    functions: [{ id: 'F.Speed', type: 'Function', level: 'Product', description: 'maximum speed' }],
    values: [{ id: 'V.Latency', type: 'Value', level: 'Product', description: 'fast', goal: '95%' }],
    solutions: [{ id: 'S.Cache', type: 'Solution', level: 'Product', description: 'cache layer' }],
    constraints: [], resources: [],
    stakeholderEntries: [{ name: 'Top Politician', stakeholderType: 'Indirect' }],
  }
  localStorage.setItem('sem-session-v2', JSON.stringify({
    currentSpec: spec, planningStage: 1, stage: 1, stage1Sub: 'review',
    savedAt: new Date().toISOString(),
  }))
})
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(2500)

// Find a non-input element with selectable text and select via mouse drag
const selectableInfo = await page.evaluate(() => {
  const ps = [...document.querySelectorAll('p, span, h2, h3, label')].filter(el => {
    const r = el.getBoundingClientRect()
    const t = (el.textContent || '').trim()
    if (t.length < 5 || t.length > 50) return false
    if (r.width < 20 || r.height < 8) return false
    // Skip inside input/textarea
    if (el.closest('input,textarea')) return false
    return true
  }).slice(0, 5)
  return ps.map(el => ({
    tag: el.tagName,
    text: (el.textContent || '').trim().slice(0, 30),
    rect: el.getBoundingClientRect(),
  }))
})
console.log('Selectable candidates:', JSON.stringify(selectableInfo.slice(0, 3), null, 2))

if (selectableInfo.length > 0) {
  const target = selectableInfo[0]
  const x1 = target.rect.x + 2
  const y1 = target.rect.y + target.rect.height / 2
  const x2 = target.rect.x + target.rect.width - 2
  const y2 = y1
  await page.mouse.move(x1, y1)
  await page.mouse.down()
  await page.mouse.move(x2, y2, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(800)
}

const result = await page.evaluate(() => ({
  selection: window.getSelection()?.toString().slice(0, 60) ?? '',
  pillVisible: !!document.querySelector('[data-seldef-pill]'),
  pillText: document.querySelector('[data-seldef-pill]')?.textContent?.slice(0, 60) ?? '',
}))
console.log('After mouse-select:', JSON.stringify(result, null, 2))
console.log('--- Errors ---')
errors.slice(0, 5).forEach(e => console.log(e))

await browser.close()
