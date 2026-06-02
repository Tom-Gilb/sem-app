import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { exec, spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { Plugin } from 'vite'

/**
 * Vault path — Planguage Glossary directory.
 * This plugin runs only in dev mode; the endpoint is unavailable in production builds.
 */
const VAULT_GLOSSARY = '/Users/Tomgilbs/Documents/MyVault/10.Standard/2.Glossary/PlanguageGlossary'

// ── Term normalisation helpers ─────────────────────────────────────────────

/**
 * Parse an inline YAML array string like `[a, "b", 'c d']` into items.
 * Returns [] for empty arrays or non-array values.
 */
function parseYamlInlineArray(value: string): string[] {
  const v = value.trim()
  if (!v.startsWith('[') || !v.endsWith(']')) return []
  const inner = v.slice(1, -1)
  if (!inner.trim()) return []

  const items: string[] = []
  let current = ''
  let inQuote: '"' | "'" | null = null
  for (const ch of inner) {
    if ((ch === '"' || ch === "'") && !inQuote) { inQuote = ch; continue }
    if (ch === inQuote) { inQuote = null; continue }
    if (ch === ',' && !inQuote) {
      const t = current.trim()
      if (t) items.push(t)
      current = ''
    } else {
      current += ch
    }
  }
  const last = current.trim()
  if (last) items.push(last)
  return items
}

/**
 * Build a synonym/alias → filename index by scanning all glossary .md files.
 * Reads both `synonyms:` and `aliases:` inline YAML array fields from frontmatter.
 * Called lazily on the first synonym-lookup miss; result is cached in the closure.
 */
function buildSynonymIndex(files: string[]): Map<string, string> {
  const index = new Map<string, string>()
  for (const file of files) {
    if (!file.endsWith('.md') || file.startsWith('00-')) continue
    try {
      const content = readFileSync(join(VAULT_GLOSSARY, file), 'utf-8')
      const fmMatch = content.match(/^---\n([\s\S]*?)\n---/)
      if (!fmMatch) continue
      const fm = fmMatch[1]

      const extractField = (field: string): string[] => {
        const m = fm.match(new RegExp(`^${field}:\\s*(.+)$`, 'm'))
        return m ? parseYamlInlineArray(m[1]) : []
      }

      for (const term of [...extractField('synonyms'), ...extractField('aliases')]) {
        // Skip bare concept-number entries like "*168"
        if (/^\*\d+[a-z]?$/.test(term.trim())) continue
        const key = term.toLowerCase().trim().replace(/\s+/g, '-')
        if (key && !index.has(key)) index.set(key, file)
      }
    } catch {
      // skip unreadable files
    }
  }
  return index
}

/** Strip leading English articles (a / an / the) from a space-separated term. */
function stripArticles(s: string): string {
  return s.replace(/^(?:a|an|the)\s+/i, '').trim()
}

/**
 * Generate plural → singular candidates for a hyphen-normalised term.
 * Applies common English inflection rules to the whole term and to the
 * first / last hyphen-segment (handles "systems-level" → "system-level").
 */
function singularCandidates(hyphenated: string): string[] {
  const deflect = (s: string): string[] => {
    if (s.endsWith('ies') && s.length > 4) return [s.slice(0, -3) + 'y']   // policies → policy
    if (s.endsWith('ses') && s.length > 5) return [s.slice(0, -2)]          // processes → process
    if (s.endsWith('es')  && s.length > 4) return [s.slice(0, -2)]          // examples → exampl
    if (s.endsWith('s')   && s.length > 3) return [s.slice(0, -1)]          // systems  → system
    return []
  }
  const seen = new Set<string>()
  for (const c of deflect(hyphenated))
    if (c !== hyphenated) seen.add(c)
  const parts = hyphenated.split('-')
  if (parts.length > 1) {
    for (const c of deflect(parts[0])) {                                     // systems-level → system-level
      const cand = [c, ...parts.slice(1)].join('-')
      if (cand !== hyphenated) seen.add(cand)
    }
    for (const c of deflect(parts[parts.length - 1])) {
      const cand = [...parts.slice(0, -1), c].join('-')
      if (cand !== hyphenated) seen.add(cand)
    }
  }
  return [...seen]
}

/**
 * Find up to `limit` glossary files whose stem shares a common prefix with `prefix`.
 * Uses longest-common-prefix (LCP) ≥ 4 chars — catches inflected/plural forms that
 * the old startsWith check missed (e.g. "priorities" → "Priority": LCP "priorit" = 7).
 * Used to populate X-Near-Match-Options for "Did you mean?" suggestions.
 */
function findNearMatchOptions(prefix: string, files: string[], limit = 3): string[] {
  const p = prefix.toLowerCase()
  if (p.length < 3) return []
  const results: string[] = []
  for (const f of files) {
    if (!f.endsWith('.md') || f.startsWith('00-')) continue
    const stem = f.toLowerCase().split('.')[0]
    if (stem === p) continue
    // Longest common prefix — count chars that match from position 0
    let lcp = 0
    while (lcp < stem.length && lcp < p.length && stem[lcp] === p[lcp]) lcp++
    if (lcp >= 4) {
      const raw = f.replace(/\.\d+[a-z]?\.md$/, '').replace(/-/g, ' ')
      results.push(raw.charAt(0).toUpperCase() + raw.slice(1))
      if (results.length >= limit) break
    }
  }
  return results
}

/**
 * Vite dev-server plugin: POST /api/open-eml
 *
 * Receives a pre-built RFC 2822 .eml string, writes it to a temp file, and
 * calls macOS `open` to hand it to Mail.app — which opens a compose draft with
 * the full HTML body already populated. No user paste required.
 *
 * Design rationale (Tom Gilb 2026-05-31):
 *   - `mailto:` scheme only supports plain-text body — cannot carry HTML.
 *   - `a.download` blob approach saves to ~/Downloads but PWA dock apps do not
 *     auto-open downloaded files (no Finder integration in WKWebView).
 *   - This plugin runs only in dev mode (Vite server present). In production
 *     builds the endpoint is absent and the caller falls back to mailto: +
 *     clipboard (plain-text body in Mail.app + HTML copy for manual paste).
 *   - `open <file.eml>` is the macOS-native way to invoke the registered .eml
 *     handler (Mail.app / Mimestream / Spark) — equivalent to double-clicking
 *     in Finder, which is the only path that pre-fills the HTML body.
 *
 * Request body: `{ eml: string }` — the complete RFC 2822 multipart/alternative
 * email string built by `buildEml()` in useEmlExport.ts.
 *
 * Response: `{ ok: true, path: string }` on success; `{ ok: false, error: string }` on failure.
 */
function mariaMailPlugin(): Plugin {
  return {
    name: 'vite-plugin-maria-mail',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/open-eml', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method not allowed')
          return
        }

        let body = ''
        req.on('data', (chunk: Buffer) => { body += chunk.toString('utf-8') })
        req.on('end', () => {
          try {
            const parsed = JSON.parse(body) as { eml?: unknown }
            const eml = parsed.eml
            if (typeof eml !== 'string' || !eml.length) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: false, error: 'Missing or empty eml string in request body' }))
              return
            }

            // Unique temp path — timestamp suffix prevents concurrent-analysis collisions.
            // /tmp is cleaned by macOS periodically; no manual cleanup needed.
            const tmpPath = join(tmpdir(), `maria-report-${Date.now()}.eml`)
            writeFileSync(tmpPath, eml, 'utf-8')

            // `open` asks macOS to open the file with its registered MIME handler
            // (Mail.app for .eml / message/rfc822). Returns immediately — Mail.app
            // launches asynchronously. -W would wait for Mail.app to close, which
            // we do not want; omitting -W is the correct behaviour for a fire-and-forget.
            exec(`open "${tmpPath}"`, (err) => {
              res.setHeader('Content-Type', 'application/json')
              if (err) {
                res.statusCode = 500
                res.end(JSON.stringify({ ok: false, error: err.message }))
              } else {
                res.statusCode = 200
                res.end(JSON.stringify({ ok: true, path: tmpPath }))
              }
            })
          } catch (err: unknown) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: false, error: String(err) }))
          }
        })
      })
    },
  }
}

/**
 * Vite dev-server plugin: serves glossary markdown files at /api/glossary?term=<TermName>.
 *
 * Resolution order (first hit wins):
 *   1. Direct file-name prefix match          "systems"      → no match
 *   2. Synonym / alias index                  "gain"         → Benefit.009.md  (X-Synonym-Of)
 *   3. Strip leading articles, retry 1+2      "a system"     → System.NNN.md   (X-Synonym-Of)
 *   4. Singularize candidates, retry 1+2      "systems"      → System.NNN.md   (X-Synonym-Of)
 *   5. Derived-form resolution                "measurement"  → Measure.NNN.md  (X-Synonym-Of)
 *        Input starts with a glossary stem ≥5 chars; longest stem wins.
 *        Handles -ment, -tion, -ing, -er, -ness, -ity, -al, -ive suffixes, etc.
 *   6. Near-match prefix scan → 404 + X-Near-Match-Options header
 *
 * Auto-resolved terms (steps 3–5) set X-Synonym-Of to the canonical concept name
 * so the UI shows an attribution badge ("↩ Matched as: System").
 */
function glossaryPlugin(): Plugin {
  return {
    name: 'vite-plugin-glossary',
    apply: 'serve',
    configureServer(server) {
      let _synonymIndex: Map<string, string> | null = null

      server.middlewares.use('/api/glossary', (req, res) => {
        try {
          const url  = new URL(req.url ?? '', 'http://localhost')
          const term = url.searchParams.get('term')?.trim()
          if (!term) { res.statusCode = 400; res.end('Missing ?term= parameter'); return }

          let files: string[]
          try { files = readdirSync(VAULT_GLOSSARY) }
          catch { res.statusCode = 503; res.end('Vault glossary directory not accessible'); return }

          // ── Scoped helpers ───────────────────────────────────────────────

          function tryResolve(key: string): { file: string; isExplicitSynonym: boolean } | null {
            const lk     = key.toLowerCase()
            const direct = files.find(f => f.toLowerCase().startsWith(lk + '.'))
            if (direct) return { file: direct, isExplicitSynonym: false }
            if (!_synonymIndex) _synonymIndex = buildSynonymIndex(files)
            const synFile = _synonymIndex.get(lk)
            return synFile ? { file: synFile, isExplicitSynonym: true } : null
          }

          function getCanonicalName(file: string, content: string): string {
            const m = content.match(/^english_name:\s*["']?([^"'\n]+)["']?/m)
            if (m) return m[1].trim()
            const raw = file.replace(/\.\d+[a-z]?\.md$/, '').replace(/-/g, ' ')
            return raw.charAt(0).toUpperCase() + raw.slice(1)
          }

          function serve(file: string, autoResolved: boolean, isExplicitSynonym: boolean): void {
            const content = readFileSync(join(VAULT_GLOSSARY, file), 'utf-8')
            res.setHeader('Content-Type', 'text/plain; charset=utf-8')
            res.setHeader('Cache-Control', 'no-store')
            // Set X-Synonym-Of for explicit synonyms and for all auto-normalized forms
            if (isExplicitSynonym || autoResolved) {
              res.setHeader('X-Synonym-Of', getCanonicalName(file, content))
            }
            res.end(content)
          }

          // ── Resolution pipeline ──────────────────────────────────────────

          const base = term.replace(/\s+/g, '-')

          // 1 + 2: Original term — direct match then synonym index
          let hit = tryResolve(base)
          if (hit) { serve(hit.file, false, hit.isExplicitSynonym); return }

          // 3: Strip leading articles (a / an / the) then retry
          const deArticled = stripArticles(base.replace(/-/g, ' ')).replace(/\s+/g, '-')
          if (deArticled !== base) {
            hit = tryResolve(deArticled)
            if (hit) { serve(hit.file, true, hit.isExplicitSynonym); return }
          }

          // 4: Singularize candidates (systems→system, policies→policy, etc.) then retry
          const searchBase = deArticled !== base ? deArticled : base
          for (const candidate of singularCandidates(searchBase)) {
            hit = tryResolve(candidate)
            if (hit) { serve(hit.file, true, hit.isExplicitSynonym); return }
          }

          // 5: Derived-form resolution — "measurement" → Measure, "requirements" → Requirement
          //    Resolves when the search base starts with a known glossary stem (≥5 chars).
          //    Longest matching stem wins (most specific concept takes priority).
          const derivedFile = files
            .filter(f => {
              if (!f.endsWith('.md') || f.startsWith('00-')) return false
              const stem = f.toLowerCase().split('.')[0]
              return stem.length >= 5
                && searchBase.length > stem.length
                && searchBase.startsWith(stem)
            })
            .sort((a, b) =>
              b.toLowerCase().split('.')[0].length - a.toLowerCase().split('.')[0].length,
            )[0]
          if (derivedFile) { serve(derivedFile, true, false); return }

          // 6: Near-match prefix scan — 404 with suggestions in header
          const suggestions = findNearMatchOptions(searchBase, files)
          res.statusCode = 404
          if (suggestions.length > 0) res.setHeader('X-Near-Match-Options', suggestions.join(','))
          res.end(`No glossary entry for "${term}"`)

        } catch {
          res.statusCode = 500
          res.end('Internal error reading glossary')
        }
      })
    },
  }
}

/**
 * Vite dev-server plugin: POST /api/claude-code
 *
 * Spawns the local `claude` CLI in print mode (`-p --output-format json`) and
 * pipes the user prompt via stdin. Returns the response in a shape consumable
 * by claudeCodeAdapter.ts.
 *
 * Per CLAUDE.md "Claude-Code-as-AI-Layer Rule" (2026-06-02):
 *   The SEM App MUST NOT make external AI API calls. All AI flows through
 *   Tom's local Claude Code installation, which uses his OAuth subscription
 *   (no per-call ANTHROPIC_API_KEY billing). This middleware is the bridge
 *   between the browser composables (file-watch / file-read pattern is the
 *   long-term target; this subprocess proxy is the pragmatic shorter path
 *   that requires zero composable changes).
 *
 * Request body: { model: string, max_tokens?: number, system?: string, prompt: string }
 * Response shape:
 *   success: { ok: true, text: string, usage: {...}, stop_reason: string }
 *   error:   { ok: false, error: string, exit_code?: number, stderr?: string }
 *
 * Cancellation: the browser closes the connection on AbortSignal; the
 * middleware listens for `req.on('close')` and kills the subprocess if the
 * request was aborted before completion.
 *
 * Auth: the subprocess inherits Tom's environment, so `claude` uses his
 * existing OAuth session from ~/.claude/auth. No API key is read or sent.
 */
function claudeCodeProxy(): Plugin {
  return {
    name: 'vite-plugin-claude-code-proxy',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/claude-code', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method not allowed')
          return
        }

        // Streaming mode is requested via ?stream=1. When enabled, this
        // middleware spawns claude with --output-format stream-json
        // --include-partial-messages and forwards each stdout JSON line
        // as a Server-Sent Event so the browser sees text deltas live.
        // Non-streaming mode (the default) returns a single JSON response
        // when the subprocess closes — used by .create() callers.
        const url = new URL(req.url ?? '', 'http://localhost')
        const streaming = url.searchParams.get('stream') === '1'

        let body = ''
        req.on('data', (chunk: Buffer) => { body += chunk.toString('utf-8') })
        req.on('end', () => {
          let parsed: { model?: string; max_tokens?: number; system?: string; prompt?: string }
          try {
            parsed = JSON.parse(body)
          } catch (err) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: false, error: `Invalid JSON body: ${String(err)}` }))
            return
          }

          const { model, system, prompt } = parsed
          if (!prompt || typeof prompt !== 'string') {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: false, error: 'Missing or empty `prompt` in request body' }))
            return
          }

          // Build the claude CLI args. Notable flags:
          //   -p                                          — print mode (non-interactive)
          //   --output-format json                        — structured response, easy to parse
          //   --output-format stream-json                 — line-delimited events (streaming mode)
          //   --include-partial-messages                  — emit text deltas (streaming mode)
          //   --model <X>                                 — use the model the composable requested
          //   --system-prompt <X>                         — system prompt
          //   --no-session-persistence                    — do not pollute Tom's session list
          //   --setting-sources user                      — skip project + local settings (Tom 2026-06-03)
          //   --exclude-dynamic-system-prompt-sections    — skip cwd/env/git/memory context (Tom 2026-06-03)
          //
          // SPEED FIX (Tom 2026-06-03): Without --setting-sources user +
          // --exclude-dynamic-system-prompt-sections + a clean cwd, every
          // subprocess call loaded ~16,000 tokens of project context
          // (sem-app's CLAUDE.md, git status, file memory, env info).
          // That input-token load alone added many seconds to every call
          // — the SEM App does NOT need Claude to know about its own code;
          // each call carries its own system+user prompt. Skipping these
          // context loads brought a 3-step Evo plan from 200s+ down to
          // model-time (~30-60s for Sonnet 4.6).
          //
          // Prompt is piped via stdin (avoids shell-arg length / escaping issues).
          const args: string[] = streaming
            ? ['-p', '--output-format', 'stream-json', '--include-partial-messages', '--verbose',
               '--no-session-persistence', '--setting-sources', 'user',
               '--exclude-dynamic-system-prompt-sections']
            : ['-p', '--output-format', 'json', '--no-session-persistence',
               '--setting-sources', 'user', '--exclude-dynamic-system-prompt-sections']
          if (model) args.push('--model', model)
          if (system) args.push('--system-prompt', system)

          // Absolute path — `spawn('claude', ...)` relies on PATH lookup which
          // can silently fail in the Vite dev-server's Node process (it doesn't
          // always inherit the full interactive-shell PATH on macOS). Using the
          // absolute path eliminates the lookup entirely. Override via
          // VITE_CLAUDE_CLI_PATH if your claude is elsewhere.
          const CLAUDE_BIN = process.env.VITE_CLAUDE_CLI_PATH || '/usr/local/bin/claude'

          // One concise log line per call — model + prompt size for visibility.
          // eslint-disable-next-line no-console
          console.log(`[claude-code-proxy] → claude ${model ?? 'default'} (${prompt.length}b prompt, ${system?.length ?? 0}b system)${streaming ? ' [stream]' : ''}`)
          const startMs = Date.now()

          // SPEED FIX (Tom 2026-06-03): spawn from tmpdir() so claude does NOT
          // auto-discover the sem-app CLAUDE.md / git status / project memory.
          // OAuth still works (the auth files are in ~/.claude, not the cwd).
          // The actual prompt the model sees is exactly what the composable
          // sent via system+user — Claude Code's project-aware features are
          // off-by-design for batch API calls.
          const child = spawn(CLAUDE_BIN, args, {
            cwd: tmpdir(),
            stdio: ['pipe', 'pipe', 'pipe'],
            env: process.env, // inherits OAuth, PATH, etc.
          })

          let stdout = ''
          let stderr = ''
          let aborted = false
          let responseSent = false

          // ── Streaming mode (SSE) ──────────────────────────────────────────
          // Set SSE headers immediately and forward each stdout JSON line as
          // a Server-Sent Event. We buffer partial lines because Node pipes
          // do not guarantee complete-line chunks. Each complete line is one
          // claude CLI event (message_start, content_block_delta, etc.).
          if (streaming) {
            res.statusCode = 200
            res.setHeader('Content-Type', 'text/event-stream')
            res.setHeader('Cache-Control', 'no-cache')
            res.setHeader('Connection', 'keep-alive')
            res.setHeader('X-Accel-Buffering', 'no') // disable proxy buffering if any
            // Hint to client that SSE has started before any events.
            res.write(': stream-open\n\n')

            let lineBuffer = ''
            child.stdout.on('data', (chunk: Buffer) => {
              if (responseSent) return
              const text = chunk.toString('utf-8')
              stdout += text
              lineBuffer += text
              let nl: number
              while ((nl = lineBuffer.indexOf('\n')) !== -1) {
                const line = lineBuffer.slice(0, nl).trim()
                lineBuffer = lineBuffer.slice(nl + 1)
                if (line) {
                  // Forward as SSE. Browser EventSource API expects "data: ...\n\n".
                  res.write(`data: ${line}\n\n`)
                }
              }
            })
            child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf-8') })
          } else {
            // ── Non-streaming mode ───────────────────────────────────────────
            child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf-8') })
            child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf-8') })
          }

          // Pipe the prompt to the subprocess's stdin and close it.
          child.stdin.write(prompt, 'utf-8')
          child.stdin.end()

          // Abort handling — kill the child only if the response stream is
          // closed BEFORE we've written a reply (i.e. the client disconnected
          // mid-request). Crucially: do NOT use `req.on('close')` — that fires
          // on normal request-body completion too (after `req.on('end')`),
          // which would SIGTERM every healthy child the instant it spawned.
          // `res.on('close')` only fires when the underlying TCP connection
          // closes, which is the real "client gave up" signal.
          res.on('close', () => {
            if (responseSent || child.killed) return
            // eslint-disable-next-line no-console
            console.log(`[claude-code-proxy] ⚠ client disconnected — killing pid=${child.pid}`)
            aborted = true
            child.kill('SIGTERM')
            setTimeout(() => { if (!child.killed) child.kill('SIGKILL') }, 2000).unref()
          })

          // Helper — write final response exactly once, and flip the
          // responseSent flag so the res.on('close') abort handler doesn't
          // SIGTERM an already-completed child.
          const send = (status: number, body: object): void => {
            if (responseSent) return
            responseSent = true
            res.statusCode = status
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(body))
          }

          // Send a final SSE event then close (streaming mode only).
          const sendSseEnd = (payload: object): void => {
            if (responseSent) return
            responseSent = true
            // Emit a sentinel event so the client knows to stop listening.
            res.write(`event: done\ndata: ${JSON.stringify(payload)}\n\n`)
            res.end()
          }

          child.on('close', (code) => {
            // eslint-disable-next-line no-console
            console.log(`[claude-code-proxy] ← ${Date.now() - startMs}ms code=${code} stdout=${stdout.length}b${aborted ? ' (aborted)' : ''}${streaming ? ' [stream]' : ''}`)
            if (aborted) return // response already closed

            if (streaming) {
              if (code !== 0) {
                sendSseEnd({ ok: false, error: `claude CLI exited with code ${code}`, exit_code: code, stderr: stderr.slice(0, 4000) })
              } else {
                sendSseEnd({ ok: true })
              }
              return
            }

            if (code !== 0) {
              send(500, {
                ok: false,
                error: `claude CLI exited with code ${code}`,
                exit_code: code,
                stderr: stderr.slice(0, 4000),
              })
              return
            }

            // Parse the CLI's JSON output (non-streaming). Shape:
            //   { type: 'result', result: '<text>', usage: {...},
            //     stop_reason: '...', total_cost_usd: <n>, ... }
            try {
              const out = JSON.parse(stdout) as {
                result?: string
                stop_reason?: string
                usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number }
                is_error?: boolean
                api_error_status?: unknown
              }

              if (out.is_error) {
                send(500, {
                  ok: false,
                  error: `claude CLI reported error: ${out.api_error_status ?? 'unknown'}`,
                  stderr: stderr.slice(0, 4000),
                })
                return
              }

              send(200, {
                ok: true,
                text: out.result ?? '',
                stop_reason: out.stop_reason ?? 'end_turn',
                usage: {
                  input_tokens:            out.usage?.input_tokens ?? 0,
                  output_tokens:           out.usage?.output_tokens ?? 0,
                  cache_read_input_tokens: out.usage?.cache_read_input_tokens ?? 0,
                },
              })
            } catch (err) {
              send(500, {
                ok: false,
                error: `Failed to parse claude CLI output: ${String(err)}`,
                stderr: stdout.slice(0, 4000),
              })
            }
          })

          child.on('error', (err) => {
            if (aborted) return
            send(500, {
              ok: false,
              error: `Failed to spawn claude CLI: ${err.message}. Is the 'claude' binary on PATH? Try \`which claude\`.`,
            })
          })
        })
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // loadEnv reads .env, .env.local, .env.[mode], .env.[mode].local in order.
  // In Vercel production builds neither VITE_AI_PROVIDER nor VITE_OLLAMA_MODEL
  // is set, so the alias is skipped and the real @anthropic-ai/sdk is bundled.
  const env = loadEnv(mode, process.cwd(), '')
  const useClaudeCode = env.VITE_AI_PROVIDER === 'claude-code'
  const useOllama     = !useClaudeCode && Boolean(env.VITE_OLLAMA_MODEL)

  // ── Pick the adapter (Claude Code wins over Ollama if both are set) ──────
  const adapterPath = useClaudeCode
    ? resolve(__dirname, 'src/lib/claudeCodeAdapter.ts')
    : useOllama
      ? resolve(__dirname, 'src/lib/ollamaAdapter.ts')
      : null

  return {
  plugins: [vue(), mariaMailPlugin(), glossaryPlugin(), claudeCodeProxy()],
  resolve: {
    alias: adapterPath ? {
      // Local dev only — route all SDK imports to the chosen adapter so no
      // Anthropic API key or internet access is needed during development.
      // The more-specific deep path must come first.
      '@anthropic-ai/sdk/resources/beta/messages/messages': adapterPath,
      '@anthropic-ai/sdk': adapterPath,
    } : {},
  },
  optimizeDeps: {
    exclude: [
      // mermaid is loaded as an IIFE script tag from /public/mermaid.min.js —
      // it is never imported via ESM, so esbuild must not try to pre-bundle it.
      // Including it in the dep scan causes esbuild to crash (mermaid uses
      // dynamic chunk imports that break when the entry point changes), which
      // prevents ALL deps (including vue) from being written to .vite/deps,
      // making the app fail to start.
      'mermaid',

      // pdfjs-dist/legacy/build/pdf.js is a webpack UMD bundle. esbuild cannot
      // reliably pre-bundle UMD files with dynamic __webpack_require__ chunk
      // imports — same failure mode as mermaid above. Excluding it from
      // optimisation lets Vite serve it directly from node_modules via /@fs/
      // with an on-the-fly CJS→ESM shim, which works fine.
      'pdfjs-dist',

      // When an adapter mode is active, @anthropic-ai/sdk is aliased to a
      // local source file. If esbuild pre-bundles the real npm package into
      // .vite/deps/ first, Vite serves that cached bundle instead of resolving
      // through the alias — silently bypassing the adapter and sending live
      // requests to api.anthropic.com. Excluding it forces Vite to always
      // resolve the alias at request time.
      ...(adapterPath ? ['@anthropic-ai/sdk'] : []),
    ],
  },
  server: {
    port: 5173,
    strictPort: true, // fail rather than silently move to another port
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    exclude: ['tests/e2e/**', 'tests/pending/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
    },
  },
  }
})
