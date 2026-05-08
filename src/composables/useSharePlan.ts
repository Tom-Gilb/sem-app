// UNIT_TYPE=Hook
// useSharePlan — generates shareable plan URLs and QR codes (Feature #7)

import type { SpecBlock } from '../types/spec'
import type { EvoStep } from '../types/evo-plan'

/**
 * Composable for generating shareable plan links and QR codes.
 *
 * encodeState: serialises spec + optional steps to a base64 URL param.
 * qrUrl: returns a QR code image URL from a free public API.
 */
export function useSharePlan() {
  /**
   * Serialises spec + steps to base64-encoded JSON and returns a full URL.
   * Format: `${window.location.origin}?plan=<base64>`
   */
  function encodeState(spec: SpecBlock, steps?: EvoStep[]): string {
    const payload = JSON.stringify({ spec, steps: steps ?? [] })
    const base64 = btoa(unescape(encodeURIComponent(payload)))
    const origin =
      typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
    return `${origin}?plan=${base64}`
  }

  /**
   * Decodes a plan URL produced by encodeState.
   * Returns null if the URL is missing the plan param or the payload is invalid.
   */
  function decodeState(url: string): { spec: SpecBlock; steps: EvoStep[] } | null {
    try {
      const parsed = new URL(url)
      const base64 = parsed.searchParams.get('plan')
      if (!base64) return null
      const json = decodeURIComponent(escape(atob(base64)))
      return JSON.parse(json) as { spec: SpecBlock; steps: EvoStep[] }
    } catch {
      return null
    }
  }

  /**
   * Returns a QR code image URL for the given plan URL.
   * Uses the free api.qrserver.com API — no auth required.
   */
  function qrUrl(planUrl: string): string {
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(planUrl)}`
  }

  return { encodeState, decodeState, qrUrl }
}
