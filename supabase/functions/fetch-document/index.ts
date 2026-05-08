// fetch-document — Supabase Edge Function
// Fetches a remote document URL server-side, bypassing browser CORS restrictions.
// Rewrites Google Sheets / Docs / Slides viewer URLs to their plain-text export equivalents.
//
// POST body: { url: string }
// Response:  { text: string, sourceUrl: string } | { error: string }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Rewrite a Google-hosted viewer URL to a direct export URL.
 * Returns the original URL unchanged if it is not a recognised Google URL.
 */
function rewriteGoogleUrl(raw: string): string {
  // Google Sheets  …/spreadsheets/d/{ID}/edit?gid={GID}
  const sheets = raw.match(/docs\.google\.com\/spreadsheets\/d\/([\w-]+)/)
  if (sheets) {
    const gid = (raw.match(/[?&#]gid=(\d+)/) ?? [])[1] ?? '0'
    return `https://docs.google.com/spreadsheets/d/${sheets[1]}/export?format=csv&gid=${gid}`
  }

  // Google Docs    …/document/d/{ID}/edit
  const docs = raw.match(/docs\.google\.com\/document\/d\/([\w-]+)/)
  if (docs) {
    return `https://docs.google.com/document/d/${docs[1]}/export?format=txt`
  }

  // Google Slides  …/presentation/d/{ID}/edit
  const slides = raw.match(/docs\.google\.com\/presentation\/d\/([\w-]+)/)
  if (slides) {
    return `https://docs.google.com/presentation/d/${slides[1]}/export/txt`
  }

  return raw
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const body = await req.json() as { url?: unknown }
    const rawUrl = typeof body?.url === 'string' ? body.url.trim() : null

    if (!rawUrl) {
      return json({ error: 'Request body must include a "url" string.' }, 400)
    }

    const fetchUrl = rewriteGoogleUrl(rawUrl)

    const res = await fetch(fetchUrl, {
      redirect: 'follow',
      headers: {
        // Mimic a browser so servers that reject headless clients will respond
        'User-Agent': 'Mozilla/5.0 (compatible; SEM-App/1.0)',
      },
    })

    // Google redirects private documents to the accounts.google.com sign-in page
    const isGoogleLoginRedirect = res.url.includes('accounts.google.com')
    if (isGoogleLoginRedirect || res.status === 401 || res.status === 403) {
      return json({
        error:
          'This document is private. In Google, open Share → change access to "Anyone with the link can view", then try again.',
      }, 403)
    }

    if (!res.ok) {
      return json({ error: `Could not fetch document — server returned ${res.status}.` }, res.status)
    }

    const text = await res.text()

    if (!text.trim()) {
      return json({ error: 'The document appears to be empty.' }, 422)
    }

    return json({ text, sourceUrl: fetchUrl })
  } catch (err) {
    return json({ error: `Unexpected error: ${String(err)}` }, 500)
  }
})
