import Anthropic from '@anthropic-ai/sdk'
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const CLAUSE = `1. MONITORING SCOPE
The Provider shall deliver continuous performance monitoring covering all production systems, critical business processes, and key performance indicators (KPIs) listed in Schedule A. Coverage includes server uptime, application response time, database query performance, and network latency.

The Provider shall maintain 24/7 monitoring capabilities with dedicated on-call engineers available at all times. Response to critical alerts must occur within fifteen (15) minutes of detection. Root cause analysis reports shall be delivered to the Client within twenty-four (24) hours of incident resolution.

Monthly performance reports summarising availability metrics, SLA compliance, incident counts, and mean time to resolution shall be delivered to the Client's IT Director no later than the 5th business day of the following month.`

const MINIMAL_PROMPT = `You are a Planguage expert extracting structured obligations from a contract clause.
Return ONLY a JSON array of entry objects.  Each object has:
{
  "type": "F" | "V" | "C" | "R" | "S" | "Task",
  "description": "short canonical Planguage description",
  "rawSource": "verbatim clause fragment",
  "confidence": "high" | "medium" | "low",
  "isAmbiguous": true | false,
  "ambiguityNote": "specific explanation if isAmbiguous, else null",
  "standardsViolations": []
}

In CONTRACTS MODE: F=Function, V=Value, C=Constraint, R=Resource, S=Stakeholder, Task=Task.
S is Stakeholder (party, authority, regulator, beneficiary), NOT Solution.
For every party doing something, receiving something, being required to do something, or being paid — EMIT an entry.
Empty array is CORRECT ONLY when clause is pure definitions, recitals, or boilerplate.
For any clause of 200+ chars containing "shall", "will", "must", "delivers", "provides", "warrants" — output has ≥1 entry.

Contract parties:
- PROVIDER (Monitoring Service Provider)
- CLIENT (Organisation)

Clause 1 — Monitoring Scope:
---
${CLAUSE}
---

Return ONLY the JSON array.  No wrapper.  No preamble.`

const t0 = Date.now()
const response = await client.messages.create({
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 8192,
  messages: [{ role: 'user', content: MINIMAL_PROMPT }],
})
const dt = ((Date.now() - t0) / 1000).toFixed(1)

console.log(`=== Sonnet took ${dt}s, stop_reason=${response.stop_reason} ===`)
console.log(`Input tokens: ${response.usage.input_tokens}, Output: ${response.usage.output_tokens}`)
const text = response.content.find(b => b.type === 'text')?.text ?? '(no text)'
console.log('=== RAW RESPONSE ===')
console.log(text.slice(0, 3000))
console.log('=== END ===')
