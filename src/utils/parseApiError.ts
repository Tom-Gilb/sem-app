// UNIT_TYPE=Util
// parseApiError — converts raw Anthropic SDK error strings into human-readable messages.
//
// The SDK throws errors whose `.message` looks like:
//   "400 {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance..."},...}"
// or
//   "401 {"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"},...}"
//
// We extract the inner message and map known error types to actionable copy.

export interface ParsedApiError {
  /** Short human-readable title (e.g. "API credits exhausted") */
  title: string
  /** Full detail sentence shown below the title */
  detail: string
  /** Optional URL the user can open to resolve the issue */
  actionUrl?: string
  /** Label for the action link */
  actionLabel?: string
}

export function parseApiError(raw: unknown): ParsedApiError {
  const str = raw instanceof Error ? raw.message : String(raw)

  // Try to pull the JSON body out of the SDK error string ("4xx {...}")
  let errorType = ''
  let innerMessage = ''
  try {
    const match = str.match(/\{[\s\S]*\}/)
    if (match) {
      const parsed = JSON.parse(match[0]) as {
        error?: { type?: string; message?: string }
      }
      errorType    = parsed?.error?.type    ?? ''
      innerMessage = parsed?.error?.message ?? ''
    }
  } catch {
    // Not JSON — fall through to generic handling
  }

  // Known error types → actionable messages
  if (
    errorType === 'invalid_request_error' &&
    innerMessage.toLowerCase().includes('credit balance')
  ) {
    return {
      title:       'API credits exhausted',
      detail:      'Your Anthropic account has run out of credits. Add credits to continue using live AI features.',
      actionUrl:   'https://console.anthropic.com/settings/billing',
      actionLabel: 'Add credits →',
    }
  }

  if (errorType === 'authentication_error') {
    return {
      title:  'Invalid API key',
      detail: 'The VITE_ANTHROPIC_API_KEY environment variable is missing or incorrect.',
    }
  }

  if (errorType === 'rate_limit_error') {
    return {
      title:  'Rate limit reached',
      detail: 'Too many requests — please wait a moment and try again.',
    }
  }

  if (errorType === 'overloaded_error') {
    return {
      title:  'API temporarily overloaded',
      detail: 'Anthropic\'s servers are busy. Try again in a few seconds.',
    }
  }

  if (str.toLowerCase().includes('timed out') || str.toLowerCase().includes('timeout')) {
    return {
      title:  'Request timed out',
      detail: 'The AI took too long to respond. Check your connection and try again.',
    }
  }

  // Generic fallback — show the inner message if we have it, otherwise the raw string
  const detail = innerMessage || str
  return {
    title:  'Request failed',
    detail: detail.length > 200 ? detail.slice(0, 200) + '…' : detail,
  }
}
