import pkg from '../node_modules/playwright/index.js'
const { chromium } = pkg
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`))
page.on('console', m => { if (m.type() === 'error') errors.push(`console.error: ${m.text().slice(0, 600)}`) })
await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 30000 })

// Seed a Tom-shaped session
await page.evaluate(() => {
  const spec = {
    functions: [{ id: 'F.A', type: 'Function', level: 'Product', description: 'do x' }],
    values: [{ id: 'V.A', type: 'Value', level: 'Product', description: 'win', goal: '95%' }],
    solutions: [{ id: 'S.A', type: 'Solution', level: 'Product', description: 'cache' }],
    constraints: [],
    resources: [],
    stakeholderEntries: [{ name: 'Top Politician', stakeholderType: 'Indirect' }],
  }
  localStorage.setItem('sem-session-v2', JSON.stringify({
    currentSpec: spec, planningStage: 1, stage: 1, stage1Sub: 'review',
    savedAt: new Date().toISOString(),
  }))
})
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(2500)

const found = await page.evaluate(() => {
  const buttons = [...document.querySelectorAll('button')].filter(b => /\bMunger\b/.test((b.textContent || '')) && !/Sharp/.test(b.textContent || ''))
  return buttons.map(b => ({
    title: (b.title || '').slice(0, 120),
    ariaLabel: b.getAttribute('aria-label') || '',
    disabled: b.disabled,
    classList: b.className.slice(0, 200),
  }))
})
console.log('Munger pin state:', JSON.stringify(found, null, 2))

// Click + check what appears
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(b => /\bMunger\b/.test(b.textContent || '') && !/Sharp/.test(b.textContent || ''))
  if (btn) btn.click()
})
await page.waitForTimeout(1200)

const after = await page.evaluate(() => ({
  hasModePicker: !!document.querySelector('[aria-modal="true"]'),
  modalText: ([...document.querySelectorAll('[aria-modal="true"]')].map(d => (d.textContent || '').slice(0, 200))).join(' | '),
  pickerDialogTitle: document.querySelector('h1, h2, h3')?.textContent?.slice(0, 80) ?? '',
  toastText: ([...document.querySelectorAll('[role="alert"], [role="status"]')].map(d => (d.textContent || '').slice(0, 200))).join(' | '),
}))
console.log('After Munger click:', JSON.stringify(after, null, 2))
console.log('--- Errors ---')
errors.slice(0, 8).forEach(e => console.log(e))

await browser.close()
