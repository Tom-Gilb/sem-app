// useToast — lightweight module-level singleton toast
// Shared across all components that import it.
// showToast(message) displays a brief floating notification for `ms` milliseconds.
// Each call also plays a soft pling tone and triggers haptic feedback on mobile.

import { ref } from 'vue'

interface Toast { message: string; id: number }

const _toast = ref<Toast | null>(null)
let _timer: ReturnType<typeof setTimeout> | null = null

/** Brief 880 Hz sine pling + mobile haptic. Called on every showToast. */
function _playPling(): void {
  // Audio pling
  try {
    const ACtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (ACtx) {
      const ctx = new ACtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.10, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.13)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.14)
      ctx.close().catch(() => {})
    }
  } catch {}
  // Haptic feedback on mobile
  try { navigator.vibrate?.(18) } catch {}
}

export function useToast() {
  function showToast(message: string, ms = 1800) {
    if (_timer) clearTimeout(_timer)
    _toast.value = { message, id: Date.now() }
    _playPling()
    _timer = setTimeout(() => { _toast.value = null }, ms)
  }

  return { toast: _toast, showToast }
}
