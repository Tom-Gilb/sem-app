import { createApp } from 'vue'
import './style.css'

// Dynamic import catches module-level errors that static import silently swallows
import('./App.vue').then(({ default: App }) => {
  try {
    createApp(App).mount('#app')
  } catch (err) {
    showError('createApp/mount failed', err)
  }
}).catch(err => {
  showError('App.vue or one of its imports failed to load', err)
})

function showError(label: string, err: unknown): void {
  document.body.style.margin = '0'
  document.body.innerHTML = `
    <div style="font-family:monospace;padding:32px;background:#fee2e2;color:#991b1b;min-height:100vh;box-sizing:border-box">
      <h2 style="margin:0 0 8px;font-size:18px">❌ SEM App failed to start</h2>
      <p style="margin:0 0 16px;font-size:13px;color:#7f1d1d">${label}</p>
      <pre style="white-space:pre-wrap;font-size:13px;background:#fecaca;padding:16px;border-radius:8px">${String(err)}</pre>
      <pre style="white-space:pre-wrap;font-size:11px;margin-top:12px;color:#b91c1c">${err instanceof Error ? (err.stack ?? '') : ''}</pre>
    </div>`
}
