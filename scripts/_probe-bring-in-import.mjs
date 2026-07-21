#!/usr/bin/env node
// Probe: Model Library → Bring in a Model → paste text → click "Analyse & Import"
// Reports every pageerror, console error, and network failure.
// Purpose: diagnose "nothing happens" symptom Tom reported 2026-07-20.

import pkg from '../node_modules/playwright/index.js'
const { chromium } = pkg

const URL = 'http://localhost:5173'

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
const page = await ctx.newPage()

const events = []
page.on('pageerror', e => events.push({ kind: 'pageerror', msg: e.message, stack: (e.stack || '').slice(0, 800) }))
page.on('console', m => {
  const t = m.type()
  if (t === 'error' || t === 'warning') events.push({ kind: `console.${t}`, msg: m.text().slice(0, 400) })
})
page.on('requestfailed', r => events.push({ kind: 'requestfailed', url: r.url(), reason: r.failure()?.errorText }))
page.on('response', r => {
  if (r.status() >= 400) events.push({ kind: 'httpError', url: r.url().slice(0, 120), status: r.status() })
})

async function step(label, fn) {
  console.log(`→ ${label}`)
  try { await fn() } catch (e) { console.log(`   ✗ ${e.message.slice(0, 200)}`) }
}

await step('goto app', () => page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 }))
await page.waitForTimeout(1500)

// Open Model Library — need to find its opener.  Look for any button whose text includes "Model Library".
await step('open Model Library', async () => {
  const opened = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button, [role="button"]')]
      .find(el => /Model Library|models/i.test(el.textContent || '') && el.offsetParent !== null)
    if (btn) { (btn).click(); return true }
    return false
  })
  console.log(`   opener found: ${opened}`)
})
await page.waitForTimeout(1000)

// Click "Bring in Models" (or the "+ Bring in Models" button visible in screenshot)
await step('click Bring in Models', async () => {
  const clicked = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')]
      .find(el => /Bring in Model/i.test(el.textContent || ''))
    if (btn) { btn.click(); return btn.textContent?.trim().slice(0, 40) }
    return null
  })
  console.log(`   clicked: ${clicked}`)
})
await page.waitForTimeout(800)

// Fill textarea with sample text
await step('fill Model text', async () => {
  const filled = await page.evaluate(() => {
    const ta = [...document.querySelectorAll('textarea')].find(el => el.offsetParent !== null)
    if (!ta) return false
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
    setter.call(ta, 'ENGINEERING/MANAGEMENT Competitive Engineering is a revolutionary project management method. It requires clear stakeholder identification and quantified value goals.')
    ta.dispatchEvent(new Event('input', { bubbles: true }))
    ta.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  })
  console.log(`   filled: ${filled}`)
})
await page.waitForTimeout(500)

// Snapshot the Analyse & Import button's state (disabled? handler attached?)
const btnState = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')]
    .find(el => /Analyse\s*&\s*Import|Analyze\s*&\s*Import/i.test(el.textContent || ''))
  if (!btn) return { found: false }
  return {
    found: true,
    disabled: btn.disabled,
    ariaDisabled: btn.getAttribute('aria-disabled'),
    classes: btn.className.slice(0, 200),
    visible: btn.offsetParent !== null,
    rect: btn.getBoundingClientRect(),
  }
})
console.log('\n=== Analyse & Import button state ===')
console.log(JSON.stringify(btnState, null, 2))

// Click it and observe
await step('click Analyse & Import', async () => {
  const before = await page.evaluate(() => {
    return {
      panelTitle: document.querySelector('h2, h3')?.textContent?.slice(0, 60) || null,
      userEntriesCount: (() => {
        try { return JSON.parse(localStorage.getItem('sem-app:model-library:user-entries:v1') || '[]').length }
        catch { return -1 }
      })(),
    }
  })
  console.log(`   before: ${JSON.stringify(before)}`)
  const clicked = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')]
      .find(el => /Analyse\s*&\s*Import|Analyze\s*&\s*Import/i.test(el.textContent || ''))
    if (!btn) return 'button not found'
    btn.click()
    return 'clicked'
  })
  console.log(`   ${clicked}`)
})
await page.waitForTimeout(3000)

const after = await page.evaluate(() => {
  return {
    panelStillOpen: !!document.querySelector('textarea'),
    userEntriesCount: (() => {
      try {
        const raw = localStorage.getItem('sem-app:model-library:user-entries:v1') || '[]'
        const arr = JSON.parse(raw)
        return { count: arr.length, latest: arr[0] ? {
          id: arr[0].id, title: arr[0].title, status: arr[0].analysisStatus,
          err: arr[0].analysisError, entriesLen: (arr[0].entries || []).length,
        } : null }
      } catch (e) { return { error: e.message } }
    })(),
    analysingBanner: !!document.querySelector('[class*="amber"]'),
    errorBanner: !!document.querySelector('[class*="orange"]'),
  }
})
console.log('\n=== After click state ===')
console.log(JSON.stringify(after, null, 2))

console.log('\n=== Events ===')
for (const e of events) console.log(JSON.stringify(e))

await browser.close()
process.exit(0)
