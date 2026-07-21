# CLAUDE-FOR-KAI-ZEN — Bootstrap for Kai's Claude Code (and any downstream Anthropic-ecosystem app)

**Written by Tom Gilb's Claudian, 2026-07-03 (r41 v470).**  Read this file first when starting a session on Kai-Zen, Graphmetrix TrinityX, or any other downstream app that intends to adopt SEM App patterns.

> **Tom Gilb 2026-07-03, verbatim:** *"GOOD WE MUST PREPARE THAT, THIS IS THE MAIN POINT OF SEM, MOVING TO TWIN"*.  This bootstrap file exists so the mission survives the trip from Tom's vault to Kai's laptop.

---

## What SEM App is (60 seconds)

SEM App is Tom Gilb's **design sandbox** for Planguage-native planning + contract analysis features.  It ships fast; it explores.  It is NOT the industrial-grade production app.  That is **Kai Gilb's Twin (Kai-Zen)**.

**The relationship:**
- Good SEM designs → candidate starting points for the Twin, **with alteration, not pure port**.
- SEM is allowed to be exploratory and piecemeal; the Twin is built standards-properly.
- **Every SEM design is portable-in-principle to the Twin** — that is the SUPREME design constraint SEM works under.

Kai's Claude's job when adopting a SEM pattern: **read the pattern, understand why it exists, adapt it to Twin's architecture, log the adaptation.**  Never copy-paste blindly; never reject blindly.

---

## Read order for a first session on Kai-Zen

1. **This file** — bootstrap; you are here.
2. **`TWIN-PORTABILITY-PORTFOLIO.md`** (at this repo's root) — the catalog of every SEM App pattern that is Twin-portable.  17 rows (as of v470), each with the SEM file path, port shape, namespacing, risks.
3. **`5 - Project/SEM App/03Execution/SEM-Design-History.md`** (in Tom's vault — Kai should ask Tom for a snapshot if not already provided) — the chronological log of every SEM App ship.  Every Portfolio row cites a version number (e.g. v465-v468); the design history has the full rationale.
4. **`<vault-root>/CLAUDE.md`** (Tom's vault — the SUPREME rule catalog) — the discipline set SEM App runs under.  Kai-Zen may inherit some rules verbatim (No-Silent-Data-Loss, Universal Undo, CloseDot, Term+Definition+Source), adapt others (Audience-declaration — Kai's audience is industrial operators, not Navy officers), and add its own (safety-critical review, compliance audit).
5. **`<vault-root>/.claude/pre-ship-rule-walk.md`** (Tom's vault) — the 19-row mechanical checklist SEM App walks before every ship.  Kai-Zen should fork this file and add Twin-specific rows.

---

## The Portfolio patterns, at a glance

For the full detail, read `TWIN-PORTABILITY-PORTFOLIO.md`.  Quick index:

| Category | Patterns |
|---|---|
| **Storage & durability** | #1 Fail-safe KV over IndexedDB (factory pattern) · #3 Save-failure event broadcaster · #10 Quota-tight aggressive pruning · #11 Emergency auto-Backup on quota failure |
| **UI safety** | #2 Modal backdrop-close hardening · #15 CloseDot 3-way close · #16 Universal Undo |
| **Scoring & measurement** | #4 Contract Health Score dashboard with drill-down (r93mmm Infinity Trap encoded) |
| **Content discipline** | #5 Term + Definition + Source · #6 Explicit column headings |
| **Export flows** | #12 Colorful HTML Email one-table pattern · #13 Auto-Open Email + Body Standard · #14 Mailto-No-Self-To · #17 EML recovery Node script |
| **Test harnesses** | #7 Feature-Smoke growing-list invariants · #9 Mount-Smoke Playwright harness |
| **Process discipline** | #8 Pre-Ship Rule-Walk mechanical checklist |

---

## How to port a pattern

1. **Open `TWIN-PORTABILITY-PORTFOLIO.md`** and find the row for the pattern you need.
2. **`Read` the SEM App file(s) listed in the row** — the JSDoc header of each named file carries the port pattern with worked examples.
3. **Understand the port shape column** — some patterns are verbatim adoption (composables like `useBackdropHardening.ts`, `useUndoHistory.ts`), some are factory-pattern reuse (`createKvStore(dbName, storeName)` — one-line adoption per app), some are plain-copy scripts (`scripts/recover-from-eml.mjs`).
4. **Adopt with the namespacing from the row** — e.g. Kai-Zen calls `createKvStore('kai-zen-kv', 'kv')`, Graphmetrix calls `createKvStore('graphmetrix-kv', 'kv')`.  Zero collision even when apps run in the same origin.
5. **APPEND a row to the "Twin adaptations" appendix at the bottom of `TWIN-PORTABILITY-PORTFOLIO.md`** — record what changed and why.  Never overwrite existing rows.  The appendix is a two-way sync record.
6. **If your port reveals a new pattern that SEM App does not yet have** — surface it to Tom Gilb.  New patterns flow both ways: SEM → Twin AND Twin → SEM.

---

## The trust-critical patterns (read these first if time is short)

Tom Gilb's trust in the SEM → Twin port depends most on these:

1. **Pattern #1 — Fail-safe KV storage.**  Tom verbatim: *"You cannot sink Navy ships without a trace. Indianapolis is not to be your inspiration."*  Storage failures MUST be loud + belt-and-braces recoverable.
2. **Pattern #4 — Contract Health Score with r93mmm Infinity Trap encoded.**  Zero/absent/placeholder MUST NOT be silently promoted to 100%.  Non-measurable dimensions are marked non-measurable, not falsely scored.
3. **Pattern #5 — Term + Definition + Source.**  Sources MUST be Reachable-Now.  No `graphmetrix://` or `toms-twin://` URIs; no hallucinated citations.
4. **Pattern #7 + #9 — Feature-Smoke + Mount-Smoke harnesses.**  Silent regressions destroy trust.  Every regression reported becomes an invariant so it can never repeat silently.
5. **Pattern #8 — Pre-Ship Rule-Walk.**  The meta-discipline that keeps every other pattern applied.  Without it, patterns drift.

---

## What to tell Tom Gilb after your first port

Tom is the meta-reviewer of both SEM App and (through Kai) the Twin.  He wants to know:

1. **What did you port?**  Which Portfolio patterns.
2. **What did you adapt?**  What changed and why (this should already be in the Twin adaptations appendix).
3. **What did you reject?**  Which patterns did not apply to Twin's context, and why.
4. **What new pattern did you find in the Twin that SEM App should adopt?**  Cross-pollination is the whole point.

Send that as a short summary email (SEM Email Body Standard — LOUD `PASTE ⌘V (CMD+V) HERE FOR COLOR VERSION` cue as first line, colorful HTML on clipboard).

---

## Audit trail

- **2026-07-03 r41 v470** — This bootstrap file created after Tom Gilb verbatim *"GOOD WE MUST PREPARE THAT, THIS IS THE MAIN POINT OF SEM, MOVING TO TWIN"*.  Ratified as the first-read artefact for Kai's Claude on Kai-Zen (and any downstream Anthropic-ecosystem app).  Composes with `TWIN-PORTABILITY-PORTFOLIO.md` (canonical Catalog) + `<vault-root>/CLAUDE.md` "Twin-Portability-Portfolio-Update" SUPREME rule (mechanical enforcement).

## Memory hook

*"SEM App is the sandbox.  The Twin is the shipyard.  This file is the bridge.  Read the Portfolio; port with intent; log every adaptation."*
